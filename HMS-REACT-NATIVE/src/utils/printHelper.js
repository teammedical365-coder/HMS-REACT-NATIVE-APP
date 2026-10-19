/**
 * printHelper.js — Universal Native Printing & PDF Utilities for React Native HMS
 *
 * Provides safe wrappers for expo-print and expo-sharing:
 * 1. Handles print dialog cancellation without false-positive error alerts or unneeded fallback actions.
 * 2. Downloads remote PDF URLs before printing on Android (Android PrintManager requires local file/content URIs).
 * 3. Safe HTML escaping for patient, doctor, medicine, and transaction records.
 * 4. Temporary PDF file lifecycle management (prevents storage leaks).
 */

let Platform = { OS: 'android' };
let Alert = { alert: () => {} };
try {
  const RN = require('react-native');
  if (RN && RN.Platform) Platform = RN.Platform;
  if (RN && RN.Alert) Alert = RN.Alert;
} catch (_) {}

let Print = {};
let Sharing = {};
let FileSystem = {};
let AsyncStorage = null;
let baseURL = '';
try {
  Print = require('expo-print');
  Sharing = require('expo-sharing');
  FileSystem = require('expo-file-system');
  AsyncStorage = require('@react-native-async-storage/async-storage').default || require('@react-native-async-storage/async-storage');
  const api = require('./api');
  if (api?.baseURL) baseURL = api.baseURL;
} catch (_) {}

/**
 * Resolves authentication headers from AsyncStorage if available.
 */
async function getAuthHeaders() {
  if (!AsyncStorage) return {};
  try {
    const raw = (await AsyncStorage.getItem('TOKEN')) || (await AsyncStorage.getItem('token'));
    if (!raw) return {};
    const token = String(raw).replace(/^"(.*)"$/, '$1').trim();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch (_) {
    return {};
  }
}

/**
 * Detects whether an exception was triggered by a user explicitly cancelling or dismissing
 * the native print modal or share sheet.
 * 
 * @param {Error|any} err
 * @returns {boolean}
 */
export function isUserCancellation(err) {
  if (!err) return false;
  const msg = (err?.message || String(err || '')).toLowerCase();
  return (
    msg.includes('cancel') ||
    msg.includes('dismiss') ||
    msg.includes('abort') ||
    msg.includes('user canceled') ||
    msg.includes('user cancelled') ||
    msg.includes('printjobcancelled')
  );
}

/**
 * Escapes dynamic text for safe inclusion inside HTML print templates.
 * 
 * @param {any} val
 * @returns {string}
 */
export function escapeHtml(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Safe print for HTML templates:
 * - On Web: uses Print.printAsync or fallback iframe
 * - On Native: uses Print.printAsync and catches user cancellation cleanly
 * 
 * @param {string} html - Valid HTML string
 * @param {Object} [options]
 * @returns {Promise<{ success: boolean, cancelled?: boolean, error?: string }>}
 */
export async function safePrintHtml(html, options = {}) {
  if (!html || typeof html !== 'string') {
    throw new Error('Print template content is empty or invalid.');
  }

  try {
    await Print.printAsync({ html, ...options });
    return { success: true };
  } catch (err) {
    if (isUserCancellation(err)) {
      console.log('[printHelper] User cancelled print dialog.');
      return { success: false, cancelled: true };
    }
    console.error('[printHelper] Native print error:', err);
    throw err;
  }
}

/**
 * Safe print for remote or local PDF documents:
 * - If url is relative, prepends backend baseURL
 * - Tries direct Print.printAsync({ uri }) first (supported natively on Expo Print)
 * - If direct print fails on native and URL is remote, falls back to authenticated download
 *   preserving protected endpoint access via JWT token
 * - Cleans up the temporary downloaded file afterwards
 * 
 * @param {string} url - Local or remote PDF URL
 * @param {Object} [options]
 * @returns {Promise<{ success: boolean, cancelled?: boolean, error?: string }>}
 */
export async function safePrintDocument(url, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('Document URL is missing or invalid.');
  }

  // Prepend backend base URL if relative path
  let resolvedUrl = url.trim();
  if (resolvedUrl.startsWith('/')) {
    resolvedUrl = `${baseURL}${resolvedUrl}`;
  }

  const isRemote = resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://');

  // Try direct printing first (both Web and Native Expo Print support remote and local URIs)
  try {
    await Print.printAsync({ uri: resolvedUrl, ...options });
    return { success: true };
  } catch (directErr) {
    if (isUserCancellation(directErr)) {
      return { success: false, cancelled: true };
    }

    // If local file or running on web, direct error is final
    if (!isRemote || Platform.OS === 'web') {
      throw directErr;
    }

    console.warn('[printHelper] Direct remote print failed, attempting authenticated local download fallback:', directErr?.message);
  }

  // Fallback for native devices where PrintManager fails to stream remote URI directly:
  // Download locally with authentication headers, print the local file, then delete it.
  let localUriToClean = null;
  try {
    const fileName = `print_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.pdf`;
    const targetUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${fileName}`;
    const headers = await getAuthHeaders();
    const downloadResult = await FileSystem.downloadAsync(resolvedUrl, targetUri, { headers });
    if (!downloadResult?.uri) {
      throw new Error('Failed to download document for printing.');
    }
    localUriToClean = downloadResult.uri;

    await Print.printAsync({ uri: downloadResult.uri, ...options });
    return { success: true };
  } catch (fallbackErr) {
    if (isUserCancellation(fallbackErr)) {
      return { success: false, cancelled: true };
    }
    throw fallbackErr;
  } finally {
    if (localUriToClean) {
      FileSystem.deleteAsync(localUriToClean, { idempotent: true }).catch(() => {});
    }
  }
}

/**
 * Safe PDF generation and native share/save:
 * - Generates PDF via Print.printToFileAsync
 * - Shares via expo-sharing if available
 * - Catches user cancellation gracefully
 * - Returns generated URI
 * 
 * @param {string} html - HTML content
 * @param {string} [fileName='document.pdf']
 * @param {Object} [shareOptions]
 * @returns {Promise<{ success: boolean, uri?: string, cancelled?: boolean }>}
 */
export async function safeGenerateAndSharePdf(html, fileName = 'document.pdf', shareOptions = {}) {
  if (!html) throw new Error('HTML content required for PDF generation.');

  const sanitizedFileName = (fileName || 'document.pdf').replace(/[/\\?%*:|"<>]/g, '_');
  const finalFileName = sanitizedFileName.toLowerCase().endsWith('.pdf') ? sanitizedFileName : `${sanitizedFileName}.pdf`;

  const { uri } = await Print.printToFileAsync({ html });
  if (!uri) throw new Error('PDF generation produced an empty file.');

  let targetUri = uri;
  try {
    const dest = `${FileSystem.cacheDirectory}${finalFileName}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    targetUri = dest;
  } catch (_) {
    targetUri = uri;
  }

  try {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(targetUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: finalFileName,
        ...shareOptions,
      });
    } else {
      Alert.alert('PDF Generated', `Document saved at: ${targetUri}`);
    }
    return { success: true, uri: targetUri };
  } catch (err) {
    if (isUserCancellation(err)) {
      return { success: false, cancelled: true, uri: targetUri };
    }
    throw err;
  }
}

export default {
  isUserCancellation,
  escapeHtml,
  safePrintHtml,
  safePrintDocument,
  safeGenerateAndSharePdf,
};
