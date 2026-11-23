import { getCollections } from '../mongodb.js';
import { SocketService } from '../socket/socketService.js';

export interface EmailSendOptions {
  tenantId: string;
  from?: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  channelEmail?: string;
  providerType?: 'RESEND';
}

export interface EmailDispatchResult {
  success: boolean;
  messageId?: string;
  deliveryMethod: string;
  info?: any;
  error?: string;
}

export class EmailDispatcher {
  /**
   * Dispatches all emails across CodRix Enterprise OS exclusively via Resend HTTPS REST API (Port 443).
   * 100% white-labeled on verified domain codrix.co.in (connect@codrix.co.in) with 0ms cloud port blocks.
   */
  static async send(options: EmailSendOptions): Promise<EmailDispatchResult> {
    const cols = getCollections();
    const config = await cols.tenantEmailConfigs.findOne({ tenantId: options.tenantId }) ||
                   await cols.tenantEmailConfigs.findOne({});

    const apiKey = process.env.RESEND_API_KEY || config?.transactional?.apiKey;

    if (!apiKey) {
      console.warn('[EmailDispatcher] Resend API Key is missing. Email dispatch aborted.');
      return {
        success: false,
        deliveryMethod: 'RESEND_HTTPS_API',
        error: 'Resend API Key is not configured. Please add RESEND_API_KEY in Environment or Settings.'
      };
    }

    const defaultSenderEmail = config?.transactional?.fromEmail || 'connect@codrix.co.in';
    const defaultSenderName = config?.transactional?.fromName || 'Codrix Private Limited';

    const fromAddress = options.from || `"${defaultSenderName}" <${defaultSenderEmail}>`;
    const toAddresses = Array.isArray(options.to) ? options.to : [options.to];

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromAddress,
          to: toAddresses,
          subject: options.subject,
          reply_to: options.replyTo,
          html: options.html || `<p>${(options.text || '').replace(/\n/g, '<br/>')}</p>`,
          text: options.text || ''
        })
      });

      const resData: any = await res.json();

      if (res.ok) {
        console.log(`✉️ Live Email successfully dispatched via Resend HTTPS (Port 443) [MessageID: ${resData.id}] to [${toAddresses.join(', ')}]`);

        // Automatically record message in Mailbox DB & broadcast in real time across Socket.IO
        try {
          const existingMsg = await cols.emailMessages.findOne({ providerMessageId: resData.id });
          if (!existingMsg) {
            const mb = await cols.mailboxConnections.findOne({ tenantId: options.tenantId }) ||
                       await cols.mailboxConnections.findOne({});
            const mbId = mb?._id?.toString() || 'default_mailbox';

            let thread = await cols.emailThreads.findOne({
              tenantId: options.tenantId,
              mailboxConnectionId: mbId,
              subject: options.subject
            });

            const snippet = options.text
              ? options.text.substring(0, 120).trim()
              : (options.html ? options.html.replace(/<[^>]*>/g, '').substring(0, 120).trim() : 'Email via Resend Engine');

            let threadId: string;
            if (!thread) {
              const threadDoc = {
                tenantId: options.tenantId,
                mailboxConnectionId: mbId,
                providerThreadId: `th_resend_${resData.id}`,
                subject: options.subject,
                snippet,
                folder: 'SENT',
                unread: false,
                lastMessageAt: new Date()
              };
              const ins = await cols.emailThreads.insertOne(threadDoc);
              threadId = ins.insertedId.toString();
            } else {
              threadId = thread._id.toString();
              await cols.emailThreads.updateOne(
                { _id: thread._id },
                { $set: { lastMessageAt: new Date(), snippet } }
              );
            }

            const msgDoc = {
              tenantId: options.tenantId,
              threadId,
              providerMessageId: resData.id,
              direction: 'OUTBOUND',
              sender: fromAddress,
              recipients: toAddresses,
              subject: options.subject,
              body: options.html || options.text || `<p>${snippet}</p>`,
              sentAt: new Date(),
              provider: 'RESEND'
            };
            await cols.emailMessages.insertOne(msgDoc);

            SocketService.emitToTenant(options.tenantId, 'mailbox:new_message', {
              mailboxConnectionId: mbId,
              threadId,
              folder: 'SENT',
              message: { ...msgDoc }
            });
            SocketService.emitToTenant(options.tenantId, 'email:new', {
              mailboxConnectionId: mbId,
              threadId,
              folder: 'SENT',
              message: { ...msgDoc }
            });
            SocketService.emitToTenant(options.tenantId, 'mailbox:thread_updated', {
              mailboxConnectionId: mbId,
              threadId,
              folder: 'SENT'
            });
            SocketService.emitToTenant(options.tenantId, 'email:thread_updated', {
              mailboxConnectionId: mbId,
              threadId,
              folder: 'SENT'
            });
          }
        } catch (dbErr: any) {
          console.warn('[EmailDispatcher] Notice: Mailbox tracking async sync:', dbErr.message);
        }

        return {
          success: true,
          messageId: resData.id,
          deliveryMethod: 'RESEND_HTTPS_API (Port 443)',
          info: resData
        };
      } else {
        console.error('[EmailDispatcher] Resend API rejected dispatch:', resData);
        return {
          success: false,
          deliveryMethod: 'RESEND_HTTPS_API',
          error: resData.message || 'Resend API returned an error.'
        };
      }
    } catch (err: any) {
      console.error('[EmailDispatcher] Network error contacting Resend API:', err.message);
      return {
        success: false,
        deliveryMethod: 'RESEND_HTTPS_API',
        error: err.message || 'Failed connecting to Resend API.'
      };
    }
  }

  /**
   * Verify Resend API Key and domain status in real-time
   */
  static async verifyResend(apiKey: string): Promise<{ valid: boolean; message: string; domains?: any[] }> {
    try {
      const res = await fetch('https://api.resend.com/domains', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (res.ok) {
        const data: any = await res.json();
        return {
          valid: true,
          message: 'Resend API Key verified successfully! Connection active.',
          domains: data.data || []
        };
      } else {
        const errData: any = await res.json().catch(() => ({}));
        return {
          valid: false,
          message: errData.message || 'Invalid Resend API Key.'
        };
      }
    } catch (err: any) {
      return {
        valid: false,
        message: err.message || 'Error connecting to Resend API.'
      };
    }
  }
}
