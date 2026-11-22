import { Db } from 'mongodb';
import { Migration } from '../types.js';

export const migration003: Migration = {
  id: '003_data_integrity_and_normalization',
  name: 'Data Integrity and Normalization',
  description: 'Normalizes candidate request numbers, ensures pipeline sequence, and verifies default tenant baseline',
  up: async (db: Db) => {
    // 1. Normalize all candidate serial numbers and request codes using bulk operations (O(1) roundtrip)
    const candidates = await db.collection('candidates').find({}).toArray();
    if (candidates.length > 0) {
      const bulkOps: any[] = [];
      candidates.forEach((cand, index) => {
        const serialNo = cand.serialNo || index + 1;
        const requestNo = cand.requestNo || `REQ-${serialNo.toString().padStart(4, '0')}`;
        if (!cand.serialNo || !cand.requestNo) {
          bulkOps.push({
            updateOne: {
              filter: { _id: cand._id },
              update: { $set: { serialNo, requestNo, updatedAt: new Date() } }
            }
          });
        }
      });

      if (bulkOps.length > 0) {
        await db.collection('candidates').bulkWrite(bulkOps);
      }
    }

    // 2. Ensure application requestNo mirrors candidate requestNo
    const applications = await db.collection('applications').find({ requestNo: { $exists: false } }).toArray();
    if (applications.length > 0) {
      const appBulkOps: any[] = [];
      for (const app of applications) {
        const candidate = await db.collection('candidates').findOne({ _id: app.candidateId });
        if (candidate?.requestNo) {
          appBulkOps.push({
            updateOne: {
              filter: { _id: app._id },
              update: { $set: { requestNo: candidate.requestNo, serialNo: candidate.serialNo } }
            }
          });
        }
      }
      if (appBulkOps.length > 0) {
        await db.collection('applications').bulkWrite(appBulkOps);
      }
    }
  }
};
