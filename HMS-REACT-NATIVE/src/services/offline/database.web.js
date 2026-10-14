/**
 * HMS OFFLINE PERSISTENCE — WEB DATABASE SUBSYSTEM (FAIL CLOSED)
 * 
 * On web platform:
 * - Hardware-backed SQLCipher encryption is unavailable.
 * - Persistent SQLite disk storage of clinical records is strictly blocked (Fail Closed).
 * - Queries and transactions throw explicit errors.
 * - Session-only volatile memory is used by cacheRepository and offlineQueue.
 */

export async function getDatabase() {
  return null;
}

export async function getDatabaseEncryptionStatus() {
  return {
    isEncrypted: false,
    isKeyed: false,
    isKeyAuthenticated: false,
    cipherVersion: null,
    reopenVerified: false,
    reason: 'SQLCipher is unavailable on web platform. Persistent database access is strictly blocked.',
  };
}

export async function verifyDatabaseReopen() {
  return {
    success: false,
    error: 'SQLCipher reopen verification is unavailable on web platform.',
  };
}

export async function safeMigrateUnencryptedDatabase() {
  return {
    success: false,
    error: 'Plaintext migration is unavailable on web platform.',
  };
}

export async function getFirst(query, params = []) {
  return null;
}

export async function getAll(query, params = []) {
  return [];
}

export async function runQuery(query, params = []) {
  throw new Error('[OfflineDB] Cannot execute query: secure database is unavailable on web platform.');
}

export async function withTransaction(callback) {
  throw new Error('[OfflineDB] Cannot execute transaction: secure database is unavailable on web platform.');
}

export default {
  getDatabase,
  getDatabaseEncryptionStatus,
  verifyDatabaseReopen,
  safeMigrateUnencryptedDatabase,
  withTransaction,
  getFirst,
  getAll,
  runQuery,
};
