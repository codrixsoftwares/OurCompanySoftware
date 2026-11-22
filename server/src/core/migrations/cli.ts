import dotenv from 'dotenv';
import { connectMongo, getDb } from '../mongodb.js';
import { MigrationRunner } from './migrationRunner.js';

dotenv.config();

async function main() {
  const command = process.argv[2] || 'up';

  console.log(`📡 Connecting to MongoDB Atlas for migration task: [${command}]...`);
  await connectMongo();
  const db = getDb();

  if (command === 'up') {
    await MigrationRunner.runPending(db);
    process.exit(0);
  } else if (command === 'status') {
    const statuses = await MigrationRunner.getStatus(db);
    console.log('\n📊 Migration Status Matrix:');
    console.table(
      statuses.map((s) => ({
        ID: s.id,
        Name: s.name,
        Status: s.executed ? '✅ APPLIED' : '⏳ PENDING',
        ExecutedAt: s.executedAt ? s.executedAt.toISOString() : 'N/A',
        Duration: s.durationMs ? `${s.durationMs}ms` : 'N/A'
      }))
    );
    process.exit(0);
  } else {
    console.error(`Unknown command: ${command}. Use "up" or "status".`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
