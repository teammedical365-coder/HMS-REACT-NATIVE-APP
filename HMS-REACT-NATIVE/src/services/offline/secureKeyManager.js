/**
 * HMS OFFLINE PERSISTENCE — SECURE DATABASE KEY MANAGER
 * 
 * Manages the SQLCipher 256-bit database encryption key:
 * - Generates cryptographically secure 256-bit random keys using expo-crypto
 * - Stores keys in hardware-backed storage (Android Keystore / iOS Keychain) via expo-secure-store
 * - ZERO hardcoded keys in source code
 * - ZERO logging of keys or key fragments
 * - Fails closed if secure storage is unavailable or key retrieval fails
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const SECURE_KEY_ALIAS = 'hms_offline_db_encryption_key_v1';
const KEY_BYTE_LENGTH = 32; // 256 bits

/**
 * Validates that a string is a 64-character lowercase hex string (256-bit key).
 */
function isValidHexKey(key) {
  return typeof key === 'string' && /^[0-9a-fA-F]{64}$/.test(key);
}

/**
 * Securely retrieves an existing database key or generates and stores a new 256-bit key.
 * 
 * @returns {Promise<{ success: boolean, key: string | null, isNew: boolean, error?: string }>}
 */
export async function getOrCreateDatabaseKey() {
  try {
    // 1. Verify platform support for secure credential storage
    if (Platform.OS === 'web') {
      return {
        success: false,
        key: null,
        isNew: false,
        error: 'SECURE_STORE_UNAVAILABLE: Hardware-backed keystore is unavailable in web environment.',
      };
    }

    const isAvailable = await SecureStore.isAvailableAsync();
    if (!isAvailable) {
      return {
        success: false,
        key: null,
        isNew: false,
        error: 'SECURE_STORE_UNAVAILABLE: Device does not support secure credential storage.',
      };
    }

    // 2. Attempt to retrieve existing key
    let existingKey = null;
    try {
      existingKey = await SecureStore.getItemAsync(SECURE_KEY_ALIAS, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      });
    } catch (retrieveErr) {
      console.warn('[SecureKeyManager] Failed reading existing key from SecureStore:', retrieveErr.message);
      return {
        success: false,
        key: null,
        isNew: false,
        error: `SECURE_KEY_READ_ERROR: ${retrieveErr.message}`,
      };
    }

    // 3. If valid key exists, return it (never logging the key!)
    if (existingKey && isValidHexKey(existingKey)) {
      console.log('[SecureKeyManager] Successfully retrieved existing 256-bit encryption key from SecureStore.');
      return {
        success: true,
        key: existingKey,
        isNew: false,
      };
    }

    // 4. Generate new cryptographically random 256-bit key
    console.log('[SecureKeyManager] Generating new cryptographically secure 256-bit database key...');
    const randomBytes = await Crypto.getRandomBytesAsync(KEY_BYTE_LENGTH);
    const newKeyHex = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // 5. Persist to SecureStore
    await SecureStore.setItemAsync(SECURE_KEY_ALIAS, newKeyHex, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });

    // 6. Verify persistence with readback
    const readback = await SecureStore.getItemAsync(SECURE_KEY_ALIAS, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });

    if (readback !== newKeyHex) {
      return {
        success: false,
        key: null,
        isNew: false,
        error: 'SECURE_KEY_VERIFICATION_FAILED: Written key failed readback verification.',
      };
    }

    console.log('[SecureKeyManager] New 256-bit database key successfully generated, persisted, and verified in SecureStore.');
    return {
      success: true,
      key: newKeyHex,
      isNew: true,
    };
  } catch (err) {
    console.error('[SecureKeyManager] Unexpected error during key resolution:', err.message);
    return {
      success: false,
      key: null,
      isNew: false,
      error: `SECURE_KEY_EXCEPTION: ${err.message}`,
    };
  }
}

/**
 * Remove key from SecureStore (for explicit reset / testing).
 */
export async function deleteDatabaseKey() {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEY_ALIAS);
    console.log('[SecureKeyManager] Database encryption key removed from SecureStore.');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export default {
  getOrCreateDatabaseKey,
  deleteDatabaseKey,
};
