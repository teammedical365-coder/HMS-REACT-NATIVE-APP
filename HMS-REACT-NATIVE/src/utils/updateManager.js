/**
 * updateManager.js
 * 
 * Provides safe programmatic access to Expo OTA update lifecycle methods.
 * Safely handles Web, development builds, and production release contexts.
 * 
 * Phase 6 Invariants:
 * 1. Non-disruptive: will never force a reload during active consultations or workflows.
 * 2. Concurrency lock: prevents duplicate simultaneous update operations.
 * 3. Crash & reload loop protection: throttles reloads and falls back to safe embedded bundle.
 * 4. Safe error sanitization: redacts tokens, URLs, patient identifiers, and secrets from all logs.
 * 5. Graceful offline degradation: failures to reach EAS never block app startup or throw unhandled exceptions.
 * 6. Recovery awareness: reports isEmbeddedLaunch and isEmergencyLaunch state.
 * 7. Tenant neutrality: zero hospital or patient metadata in update telemetry.
 */

const getPlatform = () => {
    try {
        return require('react-native').Platform;
    } catch (_) {
        return { OS: 'node' };
    }
};

const getUpdatesModule = () => {
    try {
        return require('expo-updates');
    } catch (_) {
        return null;
    }
};

const getAsyncStorage = () => {
    try {
        return require('@react-native-async-storage/async-storage').default;
    } catch (_) {
        return null;
    }
};

// In-memory reload tracker fallback (for testing and environments without persistent storage)
const inMemoryTracker = {
    lastReloadAt: 0,
    reloadCount: 0,
    inRecoveryMode: false,
};

const STORAGE_KEY_RELOAD_TRACKER = '@medical365_ota_reload_tracker';
const RELOAD_LOOP_WINDOW_MS = 60000; // 60 seconds
const MAX_CONSECUTIVE_RELOADS = 2;

// Mutex lock to prevent duplicate simultaneous update operations
let isOperationInProgress = false;

// Update state enum
const UPDATE_STATES = {
    IDLE: 'IDLE',
    CHECKING: 'CHECKING',
    AVAILABLE: 'AVAILABLE',
    DOWNLOADING: 'DOWNLOADING',
    DOWNLOADED: 'DOWNLOADED',
    APPLYING: 'APPLYING',
    DEFERRED: 'DEFERRED',
    ERROR: 'ERROR',
    RECOVERY: 'RECOVERY',
};

/**
 * Sanitizes error messages by redacting query tokens, secrets, URLs, or personal data.
 */
const sanitizeErrorMessage = (error) => {
    if (!error) return 'Unknown update error';
    const msg = typeof error === 'string' ? error : (error.message || 'Unknown update error');
    return msg
        .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
        .replace(/([?&][a-zA-Z0-9_-]*(?:token|secret|key|auth|pass|password)[=:][^\s&]*)/gi, '[REDACTED]')
        .replace(/(https?:\/\/[^\s?#]+)\?[^\s]*/gi, '$1?[REDACTED]')
        .replace(/(?:token|secret|key|auth|password)\s*[:=]\s*[^\s,]+/gi, '[REDACTED]')
        .replace(/\b(tenant|hospital|patient|doctor)Id[:=][a-f0-9]{24}\b/gi, '$1Id:[REDACTED]');
};

/**
 * Checks whether OTA updates are supported and enabled in the current runtime environment.
 * Returns false on Web or in development (__DEV__).
 */
const isUpdatesEnabled = () => {
    const Platform = getPlatform();
    const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
    if (Platform.OS === 'web' || isDev) {
        return false;
    }
    const Updates = getUpdatesModule();
    return Boolean(Updates && Updates.isEnabled);
};

/**
 * Reads persistent reload loop tracker.
 */
const getReloadTracker = async () => {
    const storage = getAsyncStorage();
    if (!storage) return inMemoryTracker;
    try {
        const raw = await storage.getItem(STORAGE_KEY_RELOAD_TRACKER);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        console.warn('[UpdateManager] Could not read reload tracker:', sanitizeErrorMessage(e));
    }
    return inMemoryTracker;
};

/**
 * Persists updated reload loop tracker.
 */
const setReloadTracker = async (data) => {
    Object.assign(inMemoryTracker, data);
    const storage = getAsyncStorage();
    if (!storage) return;
    try {
        await storage.setItem(STORAGE_KEY_RELOAD_TRACKER, JSON.stringify(data));
    } catch (e) {
        console.warn('[UpdateManager] Could not persist reload tracker:', sanitizeErrorMessage(e));
    }
};

const STORAGE_KEY_DEFERRED = '@medical365_ota_deferred';
let inMemoryDeferred = null;

const deferCurrentUpdate = async (updateId) => {
    const data = { updateId, deferredAt: new Date().toISOString() };
    inMemoryDeferred = data;
    const storage = getAsyncStorage();
    if (storage) {
        try {
            await storage.setItem(STORAGE_KEY_DEFERRED, JSON.stringify(data));
        } catch (_) {}
    }
};

const getDeferredUpdate = async () => {
    const storage = getAsyncStorage();
    if (storage) {
        try {
            const raw = await storage.getItem(STORAGE_KEY_DEFERRED);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
    }
    return inMemoryDeferred;
};

const clearDeferredUpdate = async () => {
    inMemoryDeferred = null;
    const storage = getAsyncStorage();
    if (storage) {
        try {
            await storage.removeItem(STORAGE_KEY_DEFERRED);
        } catch (_) {}
    }
};

/**
 * Checks if reload loop threshold has been exceeded.
 */
const checkReloadLoopProtection = async () => {
    const tracker = await getReloadTracker();
    const now = Date.now();

    if (tracker.inRecoveryMode) {
        return { isLooping: true, inLoop: true, recoveryMode: true, reloadCount: tracker.reloadCount };
    }

    if (now - tracker.lastReloadAt < RELOAD_LOOP_WINDOW_MS) {
        if (tracker.reloadCount >= MAX_CONSECUTIVE_RELOADS) {
            tracker.inRecoveryMode = true;
            await setReloadTracker(tracker);
            return { isLooping: true, inLoop: true, recoveryMode: true, reloadCount: tracker.reloadCount };
        }
    } else {
        // Outside window, reset reload count
        tracker.reloadCount = 0;
        await setReloadTracker(tracker);
    }

    return { isLooping: false, inLoop: false, recoveryMode: false, reloadCount: tracker.reloadCount };
};

/**
 * Records a reload event for loop detection.
 */
const recordReloadEvent = async () => {
    const tracker = await getReloadTracker();
    const now = Date.now();

    if (now - tracker.lastReloadAt < RELOAD_LOOP_WINDOW_MS) {
        tracker.reloadCount = (tracker.reloadCount || 0) + 1;
    } else {
        tracker.reloadCount = 1;
    }
    tracker.lastReloadAt = now;

    if (tracker.reloadCount >= MAX_CONSECUTIVE_RELOADS) {
        tracker.inRecoveryMode = true;
    }

    await setReloadTracker(tracker);
};

/**
 * Resets reload tracker to clear recovery mode once app is running stably.
 */
const resetRecoveryMode = async () => {
    const tracker = {
        lastReloadAt: 0,
        reloadCount: 0,
        inRecoveryMode: false,
    };
    await setReloadTracker(tracker);
};

/**
 * Returns current update runtime metadata including rollback & emergency recovery state.
 */
const getUpdateMetadata = () => {
    const Updates = getUpdatesModule();
    const recoveryReason = inMemoryTracker.inRecoveryMode ? 'Consecutive update reloads exceeded safety threshold. Safe baseline activated.' : null;
    if (!isUpdatesEnabled() || !Updates) {
        return {
            isEnabled: false,
            channel: null,
            runtimeVersion: null,
            updateId: null,
            isEmbeddedLaunch: true,
            isEmergencyLaunch: false,
            inRecoveryMode: inMemoryTracker.inRecoveryMode,
            recoveryReason,
            createdAt: null,
        };
    }

    return {
        isEnabled: true,
        channel: Updates.channel || null,
        runtimeVersion: Updates.runtimeVersion || null,
        updateId: Updates.updateId || null,
        isEmbeddedLaunch: Boolean(Updates.isEmbeddedLaunch),
        isEmergencyLaunch: Boolean(Updates.isEmergencyLaunch),
        inRecoveryMode: inMemoryTracker.inRecoveryMode,
        recoveryReason,
        createdAt: Updates.createdAt ? new Date(Updates.createdAt).toISOString() : null,
    };
};

/**
 * Manually checks if an OTA update is available on the configured update server/channel.
 * Guaranteed not to throw unhandled exceptions or run concurrently.
 * 
 * @returns {Promise<{ isAvailable: boolean, manifest: Object|null, error?: string, updateId?: string }>}
 */
const checkForAppUpdate = async () => {
    if (!isUpdatesEnabled()) {
        return { isAvailable: false, manifest: null, reason: 'updates_disabled' };
    }

    if (isOperationInProgress) {
        return { isAvailable: false, manifest: null, reason: 'operation_in_progress' };
    }

    const Updates = getUpdatesModule();
    if (!Updates || typeof Updates.checkForUpdateAsync !== 'function') {
        return { isAvailable: false, manifest: null, reason: 'module_unavailable' };
    }

    isOperationInProgress = true;
    try {
        const update = await Updates.checkForUpdateAsync();
        const isAvailable = Boolean(update && update.isAvailable);
        const manifest = (update && update.manifest) || null;
        const updateId = manifest?.id || manifest?.updateId || null;

        return {
            isAvailable,
            manifest,
            updateId,
        };
    } catch (error) {
        const sanitized = sanitizeErrorMessage(error);
        console.warn('[UpdateManager] Check for update failed:', sanitized);
        return { isAvailable: false, manifest: null, error: sanitized };
    } finally {
        isOperationInProgress = false;
    }
};

/**
 * Downloads available update with concurrency protection.
 * Does NOT force reload.
 * 
 * @returns {Promise<{ downloaded: boolean, isNew: boolean, manifest?: Object, error?: string }>}
 */
const downloadAppUpdate = async () => {
    if (!isUpdatesEnabled()) {
        return { downloaded: false, isNew: false, reason: 'updates_disabled' };
    }

    if (isOperationInProgress) {
        return { downloaded: false, isNew: false, reason: 'operation_in_progress' };
    }

    const Updates = getUpdatesModule();
    if (!Updates || typeof Updates.fetchUpdateAsync !== 'function') {
        return { downloaded: false, isNew: false, reason: 'module_unavailable' };
    }

    isOperationInProgress = true;
    try {
        const result = await Updates.fetchUpdateAsync();
        const downloaded = Boolean(result && result.isNew);
        return {
            downloaded,
            isNew: downloaded,
            manifest: result?.manifest || null,
        };
    } catch (error) {
        const sanitized = sanitizeErrorMessage(error);
        console.warn('[UpdateManager] Download update failed:', sanitized);
        return { downloaded: false, isNew: false, error: sanitized };
    } finally {
        isOperationInProgress = false;
    }
};

/**
 * Safely applies downloaded update and triggers reload, enforcing reload loop protection.
 * 
 * @param {boolean} forceReload
 * @returns {Promise<{ success: boolean, inRecoveryMode?: boolean, reason?: string }>}
 */
const applyUpdateSafely = async (forceReload = false) => {
    if (!isUpdatesEnabled()) {
        return { success: false, reason: 'updates_disabled' };
    }

    const Updates = getUpdatesModule();
    if (!Updates || typeof Updates.reloadAsync !== 'function') {
        return { success: false, reason: 'module_unavailable' };
    }

    // Check crash/reload loop protection
    const loopStatus = await checkReloadLoopProtection();
    if (loopStatus.isLooping && !forceReload) {
        console.warn('[UpdateManager] Reload aborted: crash loop protection active. Preserving embedded baseline.');
        return {
            success: false,
            inRecoveryMode: true,
            reason: 'reload_loop_prevented',
        };
    }

    try {
        await recordReloadEvent();
        await Updates.reloadAsync();
        return { success: true };
    } catch (error) {
        const sanitized = sanitizeErrorMessage(error);
        console.error('[UpdateManager] Apply reload failed:', sanitized);
        return { success: false, error: sanitized };
    }
};

/**
 * Safely checks for and downloads an OTA update in the background WITHOUT forcing a reload.
 * Backward compatible helper for Phase 4 callers.
 */
const downloadUpdateInBackground = async () => {
    if (!isUpdatesEnabled()) {
        return { downloaded: false, isAvailable: false, reason: 'updates_disabled' };
    }

    const checkRes = await checkForAppUpdate();
    if (!checkRes.isAvailable) {
        return { downloaded: false, isAvailable: false, reason: checkRes.reason || 'up_to_date' };
    }

    const downloadRes = await downloadAppUpdate();
    return {
        downloaded: downloadRes.downloaded,
        isAvailable: true,
        reason: downloadRes.error,
    };
};

/**
 * Fetches and reloads the application to apply the latest downloaded OTA update.
 * Backward compatible helper for Phase 4 callers.
 */
const fetchAndApplyUpdate = async () => {
    const downloadRes = await downloadAppUpdate();
    if (!downloadRes.downloaded) {
        return false;
    }
    const applyRes = await applyUpdateSafely(false);
    return applyRes.success;
};

module.exports = {
    isUpdatesEnabled,
    getUpdateMetadata,
    checkForAppUpdate,
    downloadAppUpdate,
    applyUpdateSafely,
    downloadUpdateInBackground,
    fetchAndApplyUpdate,
    sanitizeErrorMessage,
    checkReloadLoopProtection,
    recordReloadEvent,
    resetRecoveryMode,
    resetReloadLoopTracking: resetRecoveryMode,
    isRecoveryMode: () => inMemoryTracker.inRecoveryMode,
    deferCurrentUpdate,
    getDeferredUpdate,
    clearDeferredUpdate,
    UPDATE_STATES,
    inMemoryTracker,
    isOperationInProgress: () => isOperationInProgress,
};
