import { Db } from 'mongodb';

export interface Migration {
  id: string; // e.g. "001_initial_core_schema"
  name: string;
  description: string;
  up: (db: Db) => Promise<void>;
  down?: (db: Db) => Promise<void>;
}

export interface MigrationRecord {
  id: string;
  name: string;
  batch: number;
  executedAt: Date;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
}
