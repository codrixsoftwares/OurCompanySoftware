import { Db } from 'mongodb';
import { Migration } from '../types.js';

export const migration002: Migration = {
  id: '002_performance_indexes',
  name: 'High-Performance Compound Indexes',
  description: 'Creates compound indexes across all high-traffic collections reducing query complexity from O(N) to O(log N)',
  up: async (db: Db) => {
    await Promise.allSettled([
      // Tenants & Users
      db.collection('tenants').createIndex({ slug: 1 }, { unique: true, background: true }),
      db.collection('users').createIndex({ primaryEmail: 1 }, { unique: true, background: true }),
      db.collection('users').createIndex({ status: 1 }, { background: true }),

      // Memberships & Roles
      db.collection('memberships').createIndex({ tenantId: 1, userId: 1 }, { unique: true, background: true }),
      db.collection('memberships').createIndex({ tenantId: 1, roles: 1 }, { background: true }),

      // Employees
      db.collection('employees').createIndex({ tenantId: 1, email: 1 }, { background: true }),
      db.collection('employees').createIndex({ tenantId: 1, employeeCode: 1 }, { background: true }),
      db.collection('employees').createIndex({ tenantId: 1, userId: 1 }, { background: true }),
      db.collection('employees').createIndex({ membershipId: 1 }, { background: true }),

      // Recruitment & ATS (High Traffic)
      db.collection('candidates').createIndex({ tenantId: 1, emailNormalized: 1 }, { background: true }),
      db.collection('candidates').createIndex({ tenantId: 1, createdAt: -1 }, { background: true }),
      db.collection('candidates').createIndex({ tenantId: 1, serialNo: 1 }, { background: true }),
      db.collection('applications').createIndex({ tenantId: 1, candidateId: 1 }, { background: true }),
      db.collection('applications').createIndex({ tenantId: 1, stageId: 1 }, { background: true }),
      db.collection('applications').createIndex({ tenantId: 1, jobOpeningId: 1 }, { background: true }),
      db.collection('applications').createIndex({ tenantId: 1, status: 1 }, { background: true }),
      db.collection('pipeline_stages').createIndex({ tenantId: 1, stageOrder: 1 }, { background: true }),
      db.collection('job_openings').createIndex({ tenantId: 1, status: 1 }, { background: true }),

      // HRMS & Attendance
      db.collection('attendance_records').createIndex({ tenantId: 1, employeeId: 1, date: 1 }, { unique: true, background: true }),
      db.collection('attendance_records').createIndex({ tenantId: 1, date: 1 }, { background: true }),

      // Email Studio & Messaging
      db.collection('email_templates').createIndex({ tenantId: 1, templateKey: 1 }, { unique: true, background: true }),
      db.collection('email_messages').createIndex({ tenantId: 1, providerMessageId: 1 }, { background: true }),
      db.collection('email_messages').createIndex({ tenantId: 1, createdAt: -1 }, { background: true }),

      // CRM Leads & Deals
      db.collection('leads').createIndex({ tenantId: 1, status: 1 }, { background: true }),
      db.collection('leads').createIndex({ tenantId: 1, stage: 1 }, { background: true }),
      db.collection('leads').createIndex({ tenantId: 1, assignedBdeEmail: 1 }, { background: true }),

      // Projects & Engineering
      db.collection('projects').createIndex({ tenantId: 1, status: 1 }, { background: true }),
      db.collection('tasks').createIndex({ tenantId: 1, projectId: 1, status: 1 }, { background: true }),

      // Audit Logs
      db.collection('audit_logs').createIndex({ tenantId: 1, timestamp: -1 }, { background: true })
    ]);
  }
};
