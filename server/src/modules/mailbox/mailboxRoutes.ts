import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../../core/mongodb.js';
import { requireAuth, requireLakshaySuperAdmin } from '../../core/auth/middleware.js';
import { AuditService } from '../../core/audit/auditService.js';
import { EmailDispatcher } from '../../core/email/emailDispatcher.js';
import { ResendSyncService } from '../../core/email/resendSyncService.js';
import { SocketService } from '../../core/socket/socketService.js';

const router = Router();

// Core leadership identifiers allowed to access confidential company mailbox
const CORE_TEAM_MEMBERS = ['lakshay', 'anshuman', 'suryansh', 'parth', 'diya', 'ishita'];

export function requireCoreTeamMailbox(req: Request, res: Response, next: any) {
  const user = req.auth?.user;
  if (!user) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
    return;
  }

  const email = (user.email || '').toLowerCase();
  const name = (user.fullName || '').toLowerCase();
  const roles = user.roles || [];

  const isCore =
    CORE_TEAM_MEMBERS.some((m) => email.includes(m) || name.includes(m)) ||
    roles.includes('COMPANY_ADMIN' as any) ||
    roles.includes('SUPER_ADMIN' as any);

  if (!isCore) {
    res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Access restricted: Mailbox Workspace is confidential and only accessible to core leadership (Lakshay, Anshuman, Suryansh, Parth, Diya, and Ishita).'
      }
    });
    return;
  }

  next();
}

// Global guard for all mailbox workspace endpoints (exempting inbound webhooks)
router.use((req, res, next) => {
  if (req.path === '/webhook/inbound') {
    return next();
  }
  requireAuth(req, res, () => {
    requireCoreTeamMailbox(req, res, next);
  });
});

// GET /api/v1/mailboxes
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const mailboxes = await cols.mailboxConnections.find({ tenantId: req.auth!.user.tenantId }).toArray();
    res.json({
      data: mailboxes.map((m) => ({
        ...m,
        id: m._id.toString()
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/mailboxes/:id/sync (Trigger live Resend / Server sync)
router.post('/:id/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const mailboxConnectionId = req.params.id;
    const tenantId = req.auth!.user.tenantId;

    const result = await ResendSyncService.syncMailbox(tenantId, mailboxConnectionId);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SYNC_ERROR', message: err.message } });
  }
});

// GET /api/v1/mailboxes/:id/counts (Folder & Category message counts)
router.get('/:id/counts', requireAuth, async (req: Request, res: Response) => {
  try {
    const mailboxConnectionId = req.params.id;
    const tenantId = req.auth!.user.tenantId;
    const cols = getCollections();

    const folders = ['INBOX', 'SENT', 'DRAFTS', 'SPAM', 'TRASH', 'ARCHIVE', 'STARRED', 'SNOOZED', 'ALL'];
    const categories = ['PRIMARY', 'PROMOTIONS', 'SOCIAL', 'UPDATES'];
    const counts: Record<string, { total: number; unread: number }> = {};

    for (const f of folders) {
      let filter: any = { tenantId, mailboxConnectionId };
      if (f === 'STARRED') {
        filter = { tenantId, mailboxConnectionId, starred: true, folder: { $ne: 'TRASH' } };
      } else if (f === 'SNOOZED') {
        filter = { tenantId, mailboxConnectionId, $or: [{ folder: 'SNOOZED' }, { snoozedUntil: { $ne: null } }] };
      } else if (f === 'ALL') {
        filter = { tenantId, mailboxConnectionId, folder: { $ne: 'TRASH' } };
      } else {
        filter.folder = f;
      }

      const total = await cols.emailThreads.countDocuments(filter);
      const unread = await cols.emailThreads.countDocuments({ ...filter, unread: true });
      counts[f] = { total, unread };
    }

    for (const c of categories) {
      let filter: any = {
        tenantId,
        mailboxConnectionId,
        folder: 'INBOX'
      };
      if (c === 'PRIMARY') {
        filter.$or = [{ category: 'PRIMARY' }, { category: { $exists: false } }, { category: null }];
      } else {
        filter.category = c;
      }
      const total = await cols.emailThreads.countDocuments(filter);
      const unread = await cols.emailThreads.countDocuments({ ...filter, unread: true });
      counts[c] = { total, unread };
    }

    res.json({ data: counts });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/mailboxes/:id/threads (Search & Filter Support for Gmail layout)
router.get('/:id/threads', requireAuth, async (req: Request, res: Response) => {
  try {
    const { folder = 'INBOX', category, label, search } = req.query;
    const mailboxConnectionId = req.params.id;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const folderUpper = String(folder).toUpperCase();
    let query: any = { tenantId, mailboxConnectionId };

    if (folderUpper === 'STARRED') {
      query.starred = true;
      query.folder = { $ne: 'TRASH' };
    } else if (folderUpper === 'SNOOZED') {
      query.$or = [{ folder: 'SNOOZED' }, { snoozedUntil: { $ne: null } }];
    } else if (folderUpper === 'ALL') {
      query.folder = { $ne: 'TRASH' };
    } else {
      query.folder = folderUpper;
    }

    // ONLY filter by category when browsing INBOX, never in SENT, STARRED, DRAFTS, etc.
    if (folderUpper === 'INBOX' && category && String(category).toUpperCase() !== 'ALL') {
      const catUpper = String(category).toUpperCase();
      if (catUpper === 'PRIMARY') {
        query.$or = [{ category: 'PRIMARY' }, { category: { $exists: false } }, { category: null }];
      } else {
        query.category = catUpper;
      }
    }

    if (label) {
      query.labels = String(label);
    }

    if (search && String(search).trim()) {
      const searchRegex = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { subject: searchRegex },
        { snippet: searchRegex }
      ];
    }

    const threads = await cols.emailThreads
      .find(query)
      .sort({ lastMessageAt: -1 })
      .toArray();

    const threadIds = threads.map((t) => t._id.toString());
    const messages = await cols.emailMessages.find({ threadId: { $in: threadIds } }).sort({ sentAt: 1 }).toArray();
    const notes = await cols.emailNotes.find({ threadId: { $in: threadIds } }).toArray();

    const enriched = threads.map((t) => {
      const tId = t._id.toString();
      return {
        ...t,
        id: tId,
        messages: messages.filter((m) => m.threadId === tId).map((m) => ({ ...m, id: m._id.toString() })),
        notes: notes.filter((n) => n.threadId === tId).map((n) => ({ ...n, id: n._id.toString() }))
      };
    });

    res.json({ data: enriched });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/v1/mailboxes/threads/:threadId
router.get('/threads/:threadId', requireAuth, async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const threadId = req.params.threadId;

    const thread = await cols.emailThreads.findOne({ _id: new ObjectId(threadId) });
    if (!thread) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Thread not found' } });
      return;
    }

    const messages = await cols.emailMessages.find({ threadId }).sort({ sentAt: 1 }).toArray();
    const notes = await cols.emailNotes.find({ threadId }).toArray();

    if (thread.unread) {
      await cols.emailThreads.updateOne({ _id: new ObjectId(threadId) }, { $set: { unread: false } });
    }

    res.json({
      data: {
        ...thread,
        id: thread._id.toString(),
        messages: messages.map((m) => ({ ...m, id: m._id.toString() })),
        notes: notes.map((n) => ({ ...n, id: n._id.toString() }))
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/mailboxes/send
router.post('/send', requireAuth, async (req: Request, res: Response) => {
  try {
    const { mailboxConnectionId, threadId, to, subject, body, idempotencyKey } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const mailbox = await cols.mailboxConnections.findOne({ _id: new ObjectId(mailboxConnectionId) });
    if (!mailbox) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Mailbox not found' } });
      return;
    }

    let activeThreadId = threadId;

    if (!activeThreadId) {
      const newThreadDoc = {
        tenantId,
        mailboxConnectionId,
        providerThreadId: `th_${Date.now()}`,
        subject: subject || 'No Subject',
        snippet: body?.substring(0, 100),
        folder: 'SENT',
        unread: false,
        lastMessageAt: new Date()
      };
      const res = await cols.emailThreads.insertOne(newThreadDoc);
      activeThreadId = res.insertedId.toString();
    }

    const messageDoc = {
      tenantId,
      threadId: activeThreadId,
      providerMessageId: `msg_${Date.now()}`,
      direction: 'OUTBOUND',
      sender: mailbox.mailboxAddress,
      recipients: Array.isArray(to) ? to : [to],
      subject: subject || 'Re: Conversation',
      body: body || '',
      sentAt: new Date()
    };
    const msgRes = await cols.emailMessages.insertOne(messageDoc);

    // Dispatch via configured live SMTP or Transactional API
    const dispatchResult = await EmailDispatcher.send({
      tenantId,
      from: mailbox.mailboxAddress,
      to,
      subject: messageDoc.subject,
      text: body
    });

    await cols.emailThreads.updateOne(
      { _id: new ObjectId(activeThreadId) },
      { $set: { lastMessageAt: new Date(), snippet: body?.substring(0, 100) } }
    );

    await AuditService.log({
      user: req.auth!.user,
      action: 'EMAIL_SEND',
      resourceType: 'EMAIL_THREAD',
      resourceId: activeThreadId,
      details: {
        to,
        sender: mailbox.mailboxAddress,
        subject,
        deliveryMethod: dispatchResult.deliveryMethod,
        success: dispatchResult.success
      }
    });

    // Real-time Socket.IO notification across both event naming schemes
    SocketService.emitToTenant(tenantId, 'email:new', {
      mailboxConnectionId,
      threadId: activeThreadId,
      folder: 'SENT',
      message: { ...messageDoc, id: msgRes.insertedId.toString() }
    });
    SocketService.emitToTenant(tenantId, 'mailbox:new_message', {
      mailboxConnectionId,
      threadId: activeThreadId,
      folder: 'SENT',
      message: { ...messageDoc, id: msgRes.insertedId.toString() }
    });
    SocketService.emitToTenant(tenantId, 'email:thread_updated', {
      mailboxConnectionId,
      threadId: activeThreadId,
      folder: 'SENT'
    });
    SocketService.emitToTenant(tenantId, 'mailbox:thread_updated', {
      mailboxConnectionId,
      threadId: activeThreadId,
      folder: 'SENT'
    });
    SocketService.emitToTenant(tenantId, 'mailbox:message_sent', {
      mailboxConnectionId,
      threadId: activeThreadId,
      folder: 'SENT'
    });

    res.status(201).json({
      data: {
        messageId: msgRes.insertedId.toString(),
        threadId: activeThreadId,
        status: dispatchResult.success ? 'DELIVERED' : 'QUEUED',
        deliveryMethod: dispatchResult.deliveryMethod,
        idempotencyKey
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/mailboxes/webhook/inbound (Inbound Email Ingestion from Webhook / Gateway)
router.post('/webhook/inbound', async (req: Request, res: Response) => {
  try {
    const { from, to, subject, text, html } = req.body;
    const cols = getCollections();

    const recipientAddr = (Array.isArray(to) ? to[0] : to)?.toLowerCase() || '';
    const mailbox = await cols.mailboxConnections.findOne({
      mailboxAddress: { $regex: new RegExp(recipientAddr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
    });

    const tenantId = mailbox?.tenantId || (await cols.tenants.findOne({ slug: 'codrix' }))?._id.toString();
    const mailboxConnectionId = mailbox?._id.toString() || 'inbound_default';

    const newThreadDoc = {
      tenantId,
      mailboxConnectionId,
      providerThreadId: `in_${Date.now()}`,
      subject: subject || 'Incoming Conversation',
      snippet: text?.substring(0, 100) || 'New incoming message',
      folder: 'INBOX',
      unread: true,
      lastMessageAt: new Date()
    };
    const threadRes = await cols.emailThreads.insertOne(newThreadDoc);
    const threadId = threadRes.insertedId.toString();

    const messageDoc = {
      tenantId,
      threadId,
      providerMessageId: `msg_${Date.now()}`,
      direction: 'INBOUND',
      sender: from || 'external@domain.com',
      recipients: Array.isArray(to) ? to : [to],
      subject: subject || 'No Subject',
      body: text || html || '',
      sentAt: new Date()
    };
    const msgRes = await cols.emailMessages.insertOne(messageDoc);

    // Real-time Socket.IO notification for new inbound email
    SocketService.emitToTenant(tenantId, 'email:new', {
      mailboxConnectionId,
      threadId,
      folder: 'INBOX',
      message: { ...messageDoc, id: msgRes.insertedId.toString() }
    });
    SocketService.emitToTenant(tenantId, 'email:thread_updated', {
      mailboxConnectionId,
      threadId,
      folder: 'INBOX'
    });

    res.status(200).json({ status: 'ok', threadId });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/v1/mailboxes/threads/:threadId/notes
router.post('/threads/:threadId/notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const threadId = req.params.threadId;
    const cols = getCollections();

    const noteDoc = {
      threadId,
      authorId: req.auth!.user.fullName,
      content,
      createdAt: new Date()
    };
    const resNote = await cols.emailNotes.insertOne(noteDoc);

    res.status(201).json({ data: { ...noteDoc, id: resNote.insertedId.toString() } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PATCH /api/v1/mailboxes/threads/:threadId/folder (Move thread between folders e.g. TRASH, ARCHIVE, SPAM, INBOX)
router.patch('/threads/:threadId/folder', requireAuth, async (req: Request, res: Response) => {
  try {
    const { folder } = req.body;
    const threadId = req.params.threadId;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    await cols.emailThreads.updateOne(
      { _id: new ObjectId(threadId) },
      { $set: { folder: String(folder).toUpperCase() } }
    );

    const thread = await cols.emailThreads.findOne({ _id: new ObjectId(threadId) });

    SocketService.emitToTenant(tenantId, 'email:thread_updated', {
      mailboxConnectionId: thread?.mailboxConnectionId,
      threadId,
      folder: String(folder).toUpperCase()
    });
    SocketService.emitToTenant(tenantId, 'mailbox:thread_updated', {
      mailboxConnectionId: thread?.mailboxConnectionId,
      threadId,
      folder: String(folder).toUpperCase()
    });

    res.json({ data: { success: true, threadId, folder } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PATCH /api/v1/mailboxes/threads/:threadId/star (Toggle Starred status)
router.patch('/threads/:threadId/star', requireAuth, async (req: Request, res: Response) => {
  try {
    const { starred } = req.body;
    const threadId = req.params.threadId;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    await cols.emailThreads.updateOne(
      { _id: new ObjectId(threadId) },
      { $set: { starred: Boolean(starred) } }
    );

    const thread = await cols.emailThreads.findOne({ _id: new ObjectId(threadId) });

    SocketService.emitToTenant(tenantId, 'email:thread_updated', {
      mailboxConnectionId: thread?.mailboxConnectionId,
      threadId,
      starred: Boolean(starred)
    });
    SocketService.emitToTenant(tenantId, 'mailbox:thread_updated', {
      mailboxConnectionId: thread?.mailboxConnectionId,
      threadId,
      starred: Boolean(starred)
    });

    res.json({ data: { success: true, threadId, starred: Boolean(starred) } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PATCH /api/v1/mailboxes/threads/:threadId/unread (Toggle Read / Unread status)
router.patch('/threads/:threadId/unread', requireAuth, async (req: Request, res: Response) => {
  try {
    const { unread } = req.body;
    const threadId = req.params.threadId;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    await cols.emailThreads.updateOne(
      { _id: new ObjectId(threadId) },
      { $set: { unread: Boolean(unread) } }
    );

    const thread = await cols.emailThreads.findOne({ _id: new ObjectId(threadId) });

    SocketService.emitToTenant(tenantId, 'email:thread_updated', {
      mailboxConnectionId: thread?.mailboxConnectionId,
      threadId,
      unread: Boolean(unread)
    });
    SocketService.emitToTenant(tenantId, 'mailbox:thread_updated', {
      mailboxConnectionId: thread?.mailboxConnectionId,
      threadId,
      unread: Boolean(unread)
    });

    res.json({ data: { success: true, threadId, unread: Boolean(unread) } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PATCH /api/v1/mailboxes/threads/:threadId/snooze (Snooze conversation)
router.patch('/threads/:threadId/snooze', requireAuth, async (req: Request, res: Response) => {
  try {
    const { snoozedUntil } = req.body;
    const threadId = req.params.threadId;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    await cols.emailThreads.updateOne(
      { _id: new ObjectId(threadId) },
      {
        $set: {
          snoozedUntil: snoozedUntil ? new Date(snoozedUntil) : null,
          folder: snoozedUntil ? 'SNOOZED' : 'INBOX'
        }
      }
    );

    const thread = await cols.emailThreads.findOne({ _id: new ObjectId(threadId) });

    SocketService.emitToTenant(tenantId, 'email:thread_updated', {
      mailboxConnectionId: thread?.mailboxConnectionId,
      threadId,
      snoozedUntil,
      folder: snoozedUntil ? 'SNOOZED' : 'INBOX'
    });
    SocketService.emitToTenant(tenantId, 'mailbox:thread_updated', {
      mailboxConnectionId: thread?.mailboxConnectionId,
      threadId,
      snoozedUntil,
      folder: snoozedUntil ? 'SNOOZED' : 'INBOX'
    });

    res.json({ data: { success: true, threadId, snoozedUntil } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// PATCH /api/v1/mailboxes/threads/:threadId/labels (Add/Remove labels or category)
router.patch('/threads/:threadId/labels', requireAuth, async (req: Request, res: Response) => {
  try {
    const { labels, category } = req.body;
    const threadId = req.params.threadId;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const updateFields: any = {};
    if (labels !== undefined) updateFields.labels = labels;
    if (category !== undefined) updateFields.category = category;

    await cols.emailThreads.updateOne(
      { _id: new ObjectId(threadId) },
      { $set: updateFields }
    );

    const thread = await cols.emailThreads.findOne({ _id: new ObjectId(threadId) });

    SocketService.emitToTenant(tenantId, 'email:thread_updated', {
      mailboxConnectionId: thread?.mailboxConnectionId,
      threadId,
      ...updateFields
    });
    SocketService.emitToTenant(tenantId, 'mailbox:thread_updated', {
      mailboxConnectionId: thread?.mailboxConnectionId,
      threadId,
      ...updateFields
    });

    res.json({ data: { success: true, threadId, ...updateFields } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// POST /api/v1/mailboxes/threads/batch (Batch Operations: Star, Unstar, Read, Unread, Move, Delete)
router.post('/threads/batch', requireAuth, async (req: Request, res: Response) => {
  try {
    const { threadIds, action, folder } = req.body;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;
    const objectIds = (threadIds || []).map((id: string) => new ObjectId(id));

    if (action === 'MARK_READ') {
      await cols.emailThreads.updateMany({ _id: { $in: objectIds } }, { $set: { unread: false } });
    } else if (action === 'MARK_UNREAD') {
      await cols.emailThreads.updateMany({ _id: { $in: objectIds } }, { $set: { unread: true } });
    } else if (action === 'STAR') {
      await cols.emailThreads.updateMany({ _id: { $in: objectIds } }, { $set: { starred: true } });
    } else if (action === 'UNSTAR') {
      await cols.emailThreads.updateMany({ _id: { $in: objectIds } }, { $set: { starred: false } });
    } else if (action === 'MOVE_FOLDER') {
      await cols.emailThreads.updateMany({ _id: { $in: objectIds } }, { $set: { folder: String(folder).toUpperCase() } });
    } else if (action === 'DELETE') {
      const email = (req.auth!.user.email || '').toLowerCase().trim();
      const name = (req.auth!.user.fullName || '').toLowerCase().trim();
      const isLakshay = email === 'lakshay@codrix.co.in' || email.startsWith('lakshay@') || name === 'lakshay';
      if (!isLakshay) {
        res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only Lakshay the founder is authorized to delete email threads.' } });
        return;
      }
      await cols.emailThreads.updateMany({ _id: { $in: objectIds } }, { $set: { folder: 'TRASH' } });
    }

    SocketService.emitToTenant(tenantId, 'email:thread_updated', {
      threadIds,
      action,
      folder
    });
    SocketService.emitToTenant(tenantId, 'mailbox:thread_updated', {
      threadIds,
      action,
      folder
    });

    res.json({ data: { success: true, count: objectIds.length } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/mailboxes/threads/:threadId (Founder & Superadmin Delete Thread Only)
router.delete('/threads/:threadId', requireAuth, requireLakshaySuperAdmin, async (req: Request, res: Response) => {
  try {
    const threadId = req.params.threadId;
    const cols = getCollections();
    const tenantId = req.auth!.user.tenantId;

    const thread = await cols.emailThreads.findOne({ _id: new ObjectId(threadId) });
    const mbConnId = thread?.mailboxConnectionId;

    if (thread?.folder === 'TRASH') {
      // Permanently delete
      await cols.emailThreads.deleteOne({ _id: new ObjectId(threadId) });
      await cols.emailMessages.deleteMany({ threadId });
      await cols.emailNotes.deleteMany({ threadId });
    } else {
      // Move to TRASH
      await cols.emailThreads.updateOne(
        { _id: new ObjectId(threadId) },
        { $set: { folder: 'TRASH' } }
      );
    }

    // High-speed real-time notification
    SocketService.emitToTenant(tenantId, 'email:thread_updated', {
      mailboxConnectionId: mbConnId,
      threadId,
      action: 'DELETE',
      folder: 'TRASH'
    });
    SocketService.emitToTenant(tenantId, 'mailbox:thread_updated', {
      mailboxConnectionId: mbConnId,
      threadId,
      action: 'DELETE',
      folder: 'TRASH'
    });

    res.json({ data: { success: true } });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
