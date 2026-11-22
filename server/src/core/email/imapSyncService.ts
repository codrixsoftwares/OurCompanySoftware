import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { ObjectId } from 'mongodb';
import { getCollections } from '../mongodb.js';
import { SocketService } from '../socket/socketService.js';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  folder: string;
  message?: string;
  foldersScanned?: string[];
}

export class ImapSyncService {
  /**
   * Syncs historical & current emails from all IMAP folders (INBOX, SENT, TRASH, SPAM, DRAFTS)
   * and broadcasts real-time updates via Socket.IO
   */
  static async syncMailbox(tenantId: string, mailboxConnectionId: string): Promise<SyncResult> {
    const cols = getCollections();
    const config = await cols.tenantEmailConfigs.findOne({ tenantId });
    const mailbox = await cols.mailboxConnections.findOne({ _id: new ObjectId(mailboxConnectionId) });

    if (!mailbox) {
      return { success: false, syncedCount: 0, folder: 'INBOX', message: 'Mailbox connection not found.' };
    }

    const host = config?.imap?.host || 'imap.gmail.com';
    const port = Number(config?.imap?.port) || 993;
    const secure = Boolean(config?.imap?.secure ?? true);
    const user = config?.imap?.username || mailbox.mailboxAddress;
    const pass = config?.imap?.password;

    if (!pass) {
      return {
        success: false,
        syncedCount: 0,
        folder: 'INBOX',
        message: 'IMAP password not configured. Set your App Password in Domain & Settings to enable live IMAP sync.'
      };
    }

    const client = new ImapFlow({
      host,
      port,
      secure,
      auth: {
        user,
        pass
      },
      logger: false,
      tls: {
        rejectUnauthorized: false
      }
    });

    let syncedCount = 0;
    const foldersScanned: string[] = [];

    try {
      await client.connect();

      // List all folders on the mail server to discover INBOX, Sent, Drafts, Trash, Spam
      const serverMailboxes = await client.list();
      const targets: Array<{ imapPath: string; appFolder: string }> = [];

      // Always include INBOX
      targets.push({ imapPath: 'INBOX', appFolder: 'INBOX' });

      for (const m of serverMailboxes) {
        const pathLower = m.path.toLowerCase();
        const specialUse = m.specialUse?.toLowerCase();

        if (specialUse === '\\sent' || pathLower.includes('sent')) {
          if (!targets.some((t) => t.appFolder === 'SENT')) {
            targets.push({ imapPath: m.path, appFolder: 'SENT' });
          }
        } else if (specialUse === '\\drafts' || pathLower.includes('draft')) {
          if (!targets.some((t) => t.appFolder === 'DRAFTS')) {
            targets.push({ imapPath: m.path, appFolder: 'DRAFTS' });
          }
        } else if (specialUse === '\\trash' || pathLower.includes('trash') || pathLower.includes('bin')) {
          if (!targets.some((t) => t.appFolder === 'TRASH')) {
            targets.push({ imapPath: m.path, appFolder: 'TRASH' });
          }
        } else if (specialUse === '\\junk' || pathLower.includes('spam') || pathLower.includes('junk')) {
          if (!targets.some((t) => t.appFolder === 'SPAM')) {
            targets.push({ imapPath: m.path, appFolder: 'SPAM' });
          }
        }
      }

      // Sync across all discovered folders
      for (const target of targets) {
        foldersScanned.push(target.appFolder);
        try {
          const lock = await client.getMailboxLock(target.imapPath);
          try {
            const status: any = await client.status(target.imapPath, { messages: true });
            const totalMessages = (status && typeof status === 'object' && typeof status.messages === 'number') ? status.messages : 0;
            if (totalMessages === 0) continue;

            // Fetch up to the last 50 messages per folder for historical & current sync
            const fetchLimit = 50;
            const startSeq = Math.max(1, totalMessages - fetchLimit + 1);
            const range = `${startSeq}:*`;

            for await (const message of client.fetch(range, { uid: true, envelope: true, source: true, flags: true })) {
              if (!message.source) continue;
              const parsed: any = await (simpleParser as any)(message.source);
              const providerMessageId = parsed.messageId || `msg_${message.uid}_${target.appFolder}`;
              const subject = parsed.subject || 'No Subject';
              const fromAddr = parsed.from?.text || parsed.from?.value?.[0]?.address || 'unknown@sender.com';
              const toAddrs = parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map((t: any) => t.text) : [parsed.to.text]) : [mailbox.mailboxAddress];
              const date = parsed.date || new Date();
              const body = parsed.text || parsed.html || '';
              const isUnread = !message.flags?.has('\\Seen');

              // Check if message already exists
              const existingMsg = await cols.emailMessages.findOne({ providerMessageId });
              if (existingMsg) continue;

              // Find or create thread
              let thread = await cols.emailThreads.findOne({
                tenantId,
                mailboxConnectionId,
                subject
              });

              let threadId: string;
              if (!thread) {
                const threadDoc = {
                  tenantId,
                  mailboxConnectionId,
                  providerThreadId: `th_${message.uid}_${Date.now()}`,
                  subject,
                  snippet: body.substring(0, 120).trim() || 'No preview available',
                  folder: target.appFolder,
                  unread: isUnread,
                  lastMessageAt: date
                };
                const insertedThread = await cols.emailThreads.insertOne(threadDoc);
                threadId = insertedThread.insertedId.toString();
              } else {
                threadId = thread._id.toString();
                await cols.emailThreads.updateOne(
                  { _id: thread._id },
                  {
                    $set: {
                      lastMessageAt: date,
                      snippet: body.substring(0, 120).trim() || thread.snippet,
                      unread: isUnread ? true : thread.unread
                    }
                  }
                );
              }

              // Insert email message
              const messageDoc = {
                tenantId,
                threadId,
                providerMessageId,
                direction: target.appFolder === 'SENT' ? 'OUTBOUND' : 'INBOUND',
                sender: fromAddr,
                recipients: toAddrs,
                subject,
                body,
                sentAt: date
              };
              await cols.emailMessages.insertOne(messageDoc);

              syncedCount++;

              // Broadcast individual real-time message via Socket.IO
              SocketService.emitToTenant(tenantId, 'email:new', {
                mailboxConnectionId,
                threadId,
                folder: target.appFolder,
                message: { ...messageDoc, id: providerMessageId }
              });
            }
          } finally {
            lock.release();
          }
        } catch (folderErr) {
          console.warn(`Could not sync folder ${target.imapPath}:`, folderErr);
        }
      }

      await client.logout();

      // Update mailbox connection in MongoDB Atlas
      await cols.mailboxConnections.updateOne(
        { _id: new ObjectId(mailboxConnectionId) },
        {
          $set: {
            connectionStatus: 'CONNECTED',
            lastSyncedAt: new Date()
          }
        }
      );

      // Broadcast completed sync event to all connected sockets
      SocketService.emitToTenant(tenantId, 'mailbox:synced', {
        mailboxConnectionId,
        syncedCount,
        foldersScanned,
        timestamp: new Date()
      });

      return {
        success: true,
        syncedCount,
        folder: 'ALL_FOLDERS',
        foldersScanned,
        message: `Successfully synchronized ${syncedCount} email(s) across folders (${foldersScanned.join(', ')}).`
      };
    } catch (err: any) {
      console.error('IMAP Sync Error:', err);
      return {
        success: false,
        syncedCount: 0,
        folder: 'ALL_FOLDERS',
        message: err.message || 'Failed connecting to IMAP server.'
      };
    }
  }
}
