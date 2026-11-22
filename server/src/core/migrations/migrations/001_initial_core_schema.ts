import { Db } from 'mongodb';
import { Migration } from '../types.js';

export const migration001: Migration = {
  id: '001_initial_core_schema',
  name: 'Initial Core Schema Setup',
  description: 'Creates essential collections and ensures the primary tenant structure exists',
  up: async (db: Db) => {
    const existingCollections = await db.listCollections().toArray();
    const existingNames = new Set(existingCollections.map((c) => c.name));

    const requiredCollections = [
      'tenants',
      'users',
      'memberships',
      'employees',
      'teammembers',
      'roles',
      'job_openings',
      'candidates',
      'applications',
      'pipeline_stages',
      'mailbox_connections',
      'email_threads',
      'email_messages',
      'email_notes',
      'leads',
      'call_activities',
      'follow_ups',
      'customers',
      'projects',
      'tasks',
      'attendance_records',
      'leave_types',
      'leave_balances',
      'leave_requests',
      'audit_logs',
      'tenant_email_configs',
      'email_templates'
    ];

    for (const colName of requiredCollections) {
      if (!existingNames.has(colName)) {
        await db.createCollection(colName);
      }
    }
  }
};
