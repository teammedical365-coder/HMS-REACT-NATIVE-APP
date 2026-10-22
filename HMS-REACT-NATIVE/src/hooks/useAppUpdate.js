import { useState, useEffect, useCallback, useRef } from 'react';
import {
    isUpdatesEnabled,
    getUpdateMetadata,
    checkForAppUpdate,
    downloadAppUpdate,
    applyUpdateSafely,
    checkReloadLoopProtection,
    resetRecoveryMode,
    UPDATE_STATES,
} from '../utils/updateManager';

/**
 * useAppUpdate hook
 * Provides high-level lifecycle state and user actions for in-app OTA updates.
 */
export function useAppUpdate(options = false) {
    const isAutoCheck = typeof options === 'boolean' ? options : Boolean(options?.autoCheck);
    const [state, setState] = useState(UPDATE_STATES.IDLE);
    const [updateInfo, setUpdateInfo] = useState(null);
    const [metadata, setMetadata] = useState(getUpdateMetadata());
    const [inRecoveryMode, setInRecoveryMode] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const mountedRef = useRef(true);

    // Initial check for recovery mode and metadata
    useEffect(() => {
        mountedRef.current = true;
        (async () => {
            const loopStatus = await checkReloadLoopProtection();
            if (mountedRef.current) {
                setInRecoveryMode(loopStatus.recoveryMode);
                const meta = getUpdateMetadata();
                setMetadata(meta);
                if (meta.isEmergencyLaunch || loopStatus.recoveryMode) {
                    setState(UPDATE_STATES.RECOVERY);
                }
            }
        })();

        if (isAutoCheck && isUpdatesEnabled()) {
            checkForUpdate(false);
        }

        return () => {
            mountedRef.current = false;
        };
    }, [isAutoCheck]);

    const checkForUpdate = useCallback(async (manual = true) => {
        if (!isUpdatesEnabled()) {
            if (manual && mountedRef.current) {
                setErrorMessage('Updates are disabled in this environment.');
                setIsModalVisible(true);
            }
            return { isAvailable: false };
        }

        if (mountedRef.current) {
            setState(UPDATE_STATES.CHECKING);
            setErrorMessage(null);
            if (manual) setIsModalVisible(true);
        }

        const result = await checkForAppUpdate();
        if (!mountedRef.current) return result;

        if (result.isAvailable) {
            setState(UPDATE_STATES.AVAILABLE);
            setUpdateInfo(result);
            setIsModalVisible(true);
        } else {
            if (result.error) {
                setState(UPDATE_STATES.ERROR);
                setErrorMessage(result.error);
            } else {
                setState(UPDATE_STATES.IDLE);
                if (manual) {
                    setErrorMessage(null); // Clean up to date
                }
            }
        }
        return result;
    }, []);

    const downloadUpdate = useCallback(async () => {
        if (!mountedRef.current) return;
        setState(UPDATE_STATES.DOWNLOADING);

        const result = await downloadAppUpdate();
        if (!mountedRef.current) return;

        if (result.downloaded) {
            setState(UPDATE_STATES.DOWNLOADED);
        } else {
            setState(UPDATE_STATES.ERROR);
            setErrorMessage(result.error || 'Failed to download update package.');
        }
        return result;
    }, []);

    const applyUpdate = useCallback(async (force = false) => {
        const result = await applyUpdateSafely(force);
        if (!mountedRef.current) return result;

        if (result.inRecoveryMode) {
            setState(UPDATE_STATES.RECOVERY);
            setInRecoveryMode(true);
            setErrorMessage('Update reload deferred: recovery mode active.');
        } else if (!result.success) {
            setState(UPDATE_STATES.ERROR);
            setErrorMessage(result.error || 'Failed to apply update.');
        }
        return result;
    }, []);

    const deferUpdate = useCallback(() => {
        setState(UPDATE_STATES.DEFERRED);
        setIsModalVisible(false);
    }, []);

    const downloadAndApply = useCallback(async () => {
        const dlRes = await downloadUpdate();
        if (dlRes?.downloaded) {
            return await applyUpdate();
        }
        return dlRes;
    }, [downloadUpdate, applyUpdate]);

    const clearRecovery = useCallback(async () => {
        await resetRecoveryMode();
        if (mountedRef.current) {
            setInRecoveryMode(false);
            setState(UPDATE_STATES.IDLE);
        }
    }, []);

    return {
        state,
        status: state,
        isAvailable: state === UPDATE_STATES.AVAILABLE,
        isDownloading: state === UPDATE_STATES.DOWNLOADING,
        isDownloaded: state === UPDATE_STATES.DOWNLOADED,
        isChecking: state === UPDATE_STATES.CHECKING,
        inRecoveryMode,
        updateInfo,
        metadata,
        recoveryMetadata: metadata,
        errorMessage,
        isModalVisible,
        modalVisible: isModalVisible,
        setIsModalVisible,
        closeModal: () => setIsModalVisible(false),
        checkForUpdate,
        downloadUpdate,
        applyUpdate,
        downloadAndApply,
        deferUpdate,
        clearRecovery,
        resetRecovery: clearRecovery,
    };
}

export default useAppUpdate;
