import { getCollections } from '../mongodb.js';
import { UserContext } from '../auth/types.js';

export interface AuditEventParams {
  tenantId?: string;
  user?: UserContext;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  requestId?: string;
}

export class AuditService {
  static async log(params: AuditEventParams): Promise<void> {
    try {
      const cols = getCollections();
      await cols.auditLogs.insertOne({
        tenantId: params.tenantId || params.user?.tenantId,
        actorUserId: params.user?.userId,
        actorEmail: params.user?.email,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        details: params.details ? JSON.stringify(params.details) : undefined,
        ipAddress: params.ipAddress,
        requestId: params.requestId,
        createdAt: new Date()
      });
    } catch (err) {
      console.error('Audit log persist error:', err);
    }
  }
}
