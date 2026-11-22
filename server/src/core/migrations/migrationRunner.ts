import { Db } from 'mongodb';
import { Migration, MigrationRecord } from './types.js';
import { migration001 } from './migrations/001_initial_core_schema.js';
import { migration002 } from './migrations/002_performance_indexes.js';
import { migration003 } from './migrations/003_data_integrity_and_normalization.js';
import { migration004 } from './migrations/004_ttl_and_audit_cleanup.js';

export class MigrationRunner {
  private static registeredMigrations: Migration[] = [
    migration001,
    migration002,
    migration003,
    migration004
  ];

  /**
   * Runs all pending migrations in sequential order.
   * Atomic, idempotent, and non-blocking for production zero-downtime deploys.
   */
  static async runPending(db: Db): Promise<{ executed: number; total: number; durationMs: number }> {
    const startTime = Date.now();
    const migrationCol = db.collection<MigrationRecord>('_migrations');

    // Ensure index on migration records
    await migrationCol.createIndex({ id: 1 }, { unique: true });

    // Fetch already executed migrations
    const executedRecords = await migrationCol.find().toArray();
    const executedMap = new Map<string, MigrationRecord>(executedRecords.map((r) => [r.id, r]));

    // Determine current batch number
    const maxBatch = executedRecords.reduce((max, r) => Math.max(max, r.batch || 0), 0);
    const currentBatch = maxBatch + 1;

    let executedCount = 0;

    for (const migration of this.registeredMigrations) {
      if (!executedMap.has(migration.id)) {
        const migStart = Date.now();
        console.log(`🚀 Executing Migration [${migration.id}]: ${migration.name}...`);

        try {
          await migration.up(db);
          const durationMs = Date.now() - migStart;

          await migrationCol.insertOne({
            id: migration.id,
            name: migration.name,
            batch: currentBatch,
            executedAt: new Date(),
            durationMs,
            status: 'SUCCESS'
          });

          console.log(`✅ Migration [${migration.id}] completed in ${durationMs}ms`);
          executedCount++;
        } catch (err: any) {
          const durationMs = Date.now() - migStart;
          await migrationCol.insertOne({
            id: migration.id,
            name: migration.name,
            batch: currentBatch,
            executedAt: new Date(),
            durationMs,
            status: 'FAILED',
            error: err?.message || String(err)
          });

          console.error(`❌ Migration [${migration.id}] failed after ${durationMs}ms:`, err?.message || err);
          throw err;
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    if (executedCount > 0) {
      console.log(`🎉 Migrations complete: ${executedCount} migration(s) applied in ${totalDuration}ms`);
    } else {
      console.log(`✨ All ${this.registeredMigrations.length} database migrations are already up-to-date.`);
    }

    return {
      executed: executedCount,
      total: this.registeredMigrations.length,
      durationMs: totalDuration
    };
  }

  /**
   * Retrieves the current migration status report
   */
  static async getStatus(db: Db): Promise<Array<{ id: string; name: string; executed: boolean; executedAt?: Date; durationMs?: number }>> {
    const migrationCol = db.collection<MigrationRecord>('_migrations');
    const executedRecords = await migrationCol.find().toArray();
    const executedMap = new Map<string, MigrationRecord>(executedRecords.map((r) => [r.id, r]));

    return this.registeredMigrations.map((m) => {
      const record = executedMap.get(m.id);
      return {
        id: m.id,
        name: m.name,
        executed: Boolean(record && record.status === 'SUCCESS'),
        executedAt: record?.executedAt,
        durationMs: record?.durationMs
      };
    });
  }
}
