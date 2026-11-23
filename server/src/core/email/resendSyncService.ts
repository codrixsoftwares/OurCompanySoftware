import { ObjectId } from 'mongodb';
import { getCollections } from '../mongodb.js';
import { SocketService } from '../socket/socketService.js';

export interface ResendSyncResult {
  success: boolean;
  syncedCount: number;
  message?: string;
  errors?: string[];
}

export class ResendSyncService {
  /**
   * Syncs emails from Resend REST API into CodRix Mailbox Workspace in real-time.
   */
  static async syncMailbox(tenantId: string, mailboxConnectionId?: string): Promise<ResendSyncResult> {
    const cols = getCollections();
    const config = await cols.tenantEmailConfigs.findOne({ tenantId }) ||
                   await cols.tenantEmailConfigs.findOne({});

    const apiKey = process.env.RESEND_API_KEY || config?.transactional?.apiKey || config?.resend?.apiKey;

    if (!apiKey) {
      return {
        success: false,
        syncedCount: 0,
        message: 'Resend API Key is not configured. Please add RESEND_API_KEY in Settings or Environment.'
      };
    }

    // Resolve target mailbox connection
    let mailbox: any = null;
    if (mailboxConnectionId) {
      mailbox = await cols.mailboxConnections.findOne({ _id: new ObjectId(mailboxConnectionId) });
    }
    if (!mailbox) {
      mailbox = await cols.mailboxConnections.findOne({ tenantId }) ||
                await cols.mailboxConnections.findOne({ mailboxAddress: 'connect@codrix.co.in' });
    }

    const resolvedMailboxId = mailbox ? mailbox._id.toString() : mailboxConnectionId || 'default_mailbox';
    const mailboxAddress = mailbox?.mailboxAddress || 'connect@codrix.co.in';

    try {
      const res = await fetch('https://api.resend.com/emails', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          syncedCount: 0,
          message: `Resend API returned status ${res.status}: ${errText}`
        };
      }

      const resData: any = await res.json();
      const emailList: any[] = resData.data || [];

      let syncedCount = 0;

      for (const email of emailList) {
        const providerMessageId = email.id;

        // Check if message already exists in DB
        const existingMsg = await cols.emailMessages.findOne({ providerMessageId });
        if (existingMsg) continue;

        // Fetch detailed email text and html from Resend
        let htmlBody = '';
        let textBody = '';

        try {
          const detailRes = await fetch(`https://api.resend.com/emails/${providerMessageId}`, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          if (detailRes.ok) {
            const detailData: any = await detailRes.json();
            htmlBody = detailData.html || '';
            textBody = detailData.text || '';
          }
        } catch {
          // Fall back gracefully
        }

        const subject = email.subject || 'No Subject';
        const fromAddr = email.from || mailboxAddress;
        const toAddrs = Array.isArray(email.to) ? email.to : [email.to];
        const date = email.created_at ? new Date(email.created_at) : new Date();
        const snippet = textBody
          ? textBody.substring(0, 120).trim()
          : (htmlBody ? htmlBody.replace(/<[^>]*>/g, '').substring(0, 120).trim() : 'Email via Resend Engine');

        // Determine folder: if sent from company address, it's SENT, otherwise INBOX
        const isFromCompany = fromAddr.toLowerCase().includes('codrix.co.in');
        const folder = isFromCompany ? 'SENT' : 'INBOX';

        // Find or create thread
        let thread = await cols.emailThreads.findOne({
          tenantId,
          mailboxConnectionId: resolvedMailboxId,
          subject
        });

        let threadId: string;
        if (!thread) {
          const threadDoc = {
            tenantId,
            mailboxConnectionId: resolvedMailboxId,
            providerThreadId: `th_resend_${providerMessageId}`,
            subject,
            snippet,
            folder,
            unread: !isFromCompany,
            lastMessageAt: date
          };
          const ins = await cols.emailThreads.insertOne(threadDoc);
          threadId = ins.insertedId.toString();
        } else {
          threadId = thread._id.toString();
          await cols.emailThreads.updateOne(
            { _id: thread._id },
            {
              $set: {
                lastMessageAt: date,
                snippet
              }
            }
          );
        }

        const messageDoc = {
          tenantId,
          threadId,
          providerMessageId,
          direction: isFromCompany ? 'OUTBOUND' : 'INBOUND',
          sender: fromAddr,
          recipients: toAddrs,
          subject,
          body: htmlBody || textBody || `<p>${snippet}</p>`,
          sentAt: date,
          provider: 'RESEND'
        };

        await cols.emailMessages.insertOne(messageDoc);
        syncedCount++;
      }

      // Real-time Socket.IO emission to update all connected clients
      SocketService.emitToTenant(tenantId, 'mailbox:synced', {
        mailboxConnectionId: resolvedMailboxId,
        syncedCount,
        timestamp: new Date()
      });
      SocketService.emitToTenant(tenantId, 'email:thread_updated', {
        mailboxConnectionId: resolvedMailboxId
      });
      SocketService.emitToTenant(tenantId, 'mailbox:thread_updated', {
        mailboxConnectionId: resolvedMailboxId
      });

      return {
        success: true,
        syncedCount,
        message: syncedCount > 0
          ? `Successfully synchronized ${syncedCount} email${syncedCount > 1 ? 's' : ''} live from Resend API!`
          : 'Mailbox is completely synchronized with Resend Engine in real time!'
      };
    } catch (err: any) {
      console.error('[ResendSyncService] Sync error:', err.message);
      return {
        success: false,
        syncedCount: 0,
        message: err.message || 'Error communicating with Resend API.'
      };
    }
  }
}
