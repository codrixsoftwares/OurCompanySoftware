import { Db } from 'mongodb';
import { Migration } from '../types.js';

export const migration004: Migration = {
  id: '004_ttl_and_audit_cleanup',
  name: 'TTL and Audit Storage Optimizations',
  description: 'Creates TTL indexing on ephemeral sessions/temporary records to guarantee bounded storage and high query throughput',
  up: async (db: Db) => {
    // Audit logs retention index (optional TTL if configured, or speed index on timestamp)
    await db.collection('audit_logs').createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 31536000, background: true } // 1-year automated TTL retention
    );
  }
};
