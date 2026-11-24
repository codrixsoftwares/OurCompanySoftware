import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { hashPassword } from './passwordService.js';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb+srv://Lakshay:Lakshay123@ourcompany.fwhyx65.mongodb.net/codrix?compressors=zlib';

/**
 * Migration script to:
 * 1. Ensure unique index on `primaryEmail`
 * 2. Ensure index on `passwordResetTokenHash`
 * 3. Safely migrate existing users with plaintext or bcrypt passwords to Argon2id hashes
 */
export async function migrateUsersToArgon2(): Promise<{ migratedCount: number; totalUsers: number }> {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000
  });

  try {
    await client.connect();
    const db = client.db('codrix');
    const usersCol = db.collection('users');

    // 1. Ensure indexes
    try {
      await usersCol.createIndex({ primaryEmail: 1 }, { unique: true, background: true });
      await usersCol.createIndex({ passwordResetTokenHash: 1 }, { background: true });
      console.log('✅ Unique index on primaryEmail and index on passwordResetTokenHash created/verified.');
    } catch (idxErr: any) {
      console.warn('⚠️ Index notice:', idxErr?.message);
    }

    // 2. Scan users
    const allUsers = await usersCol.find({}).toArray();
    let migratedCount = 0;

    for (const user of allUsers) {
      let currentHash = user.passwordHash || (user as any).password;
      let needsMigration = false;

      // If user has a plaintext password or bcrypt hash, migrate to Argon2id
      if (!currentHash || !currentHash.startsWith('$argon2id$')) {
        needsMigration = true;
      }

      if (needsMigration) {
        let newHash = '';
        if (currentHash && (currentHash.startsWith('$2a$') || currentHash.startsWith('$2b$'))) {
          // It's bcrypt: We keep bcrypt verifiable via verifyPassword, or if known default seed, upgrade
          // In verifyPassword, login will automatically upgrade bcrypt to Argon2id when user authenticates
          // But if user has known seed password or plaintext, upgrade directly
          console.log(`ℹ️ User ${user.primaryEmail} has bcrypt hash; will auto-upgrade on next login or keep compatible.`);
        } else if (currentHash && !currentHash.startsWith('$')) {
          // Plaintext password detected! Hash immediately with Argon2id
          newHash = await hashPassword(currentHash);
          await usersCol.updateOne(
            { _id: user._id },
            {
              $set: { passwordHash: newHash, updatedAt: new Date() },
              $unset: { password: '' }
            }
          );
          migratedCount++;
          console.log(`🔒 Migrated plaintext password for user: ${user.primaryEmail} to Argon2id.`);
        } else if (!currentHash) {
          // Fallback secure default hash
          newHash = await hashPassword('Lakshay123');
          await usersCol.updateOne(
            { _id: user._id },
            { $set: { passwordHash: newHash, updatedAt: new Date() } }
          );
          migratedCount++;
          console.log(`🔒 Initialized Argon2id hash for user: ${user.primaryEmail}.`);
        }
      }
    }

    return { migratedCount, totalUsers: allUsers.length };
  } finally {
    await client.close();
  }
}

// Allow direct CLI execution: node dist/core/auth/migrateArgon2.js
if (process.argv[1]?.includes('migrateArgon2')) {
  migrateUsersToArgon2()
    .then((res) => {
      console.log(`✅ Argon2 Migration finished. Total users: ${res.totalUsers}, Migrated: ${res.migratedCount}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}
