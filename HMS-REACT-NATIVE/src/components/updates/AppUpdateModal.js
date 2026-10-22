import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Platform,
    useWindowDimensions,
} from 'react-native';
import { UPDATE_STATES } from '../../utils/updateManager';

export default function AppUpdateModal({
    visible,
    state,
    status,
    updateInfo,
    metadata,
    recoveryMetadata,
    errorMessage,
    onClose,
    onDownload,
    onUpdateNow,
    onApply,
    onDefer,
    onLater,
    onRetry,
    onResetRecovery,
}) {
    const { width } = useWindowDimensions();
    const isMobile = width < 600;

    const activeState = state || status;
    const activeMeta = metadata || recoveryMetadata;
    const handleDownload = onDownload || onUpdateNow;
    const handleDefer = onDefer || onLater;

    if (!visible) return null;

    const renderContent = () => {
        switch (state) {
            case UPDATE_STATES.CHECKING:
                return (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color="#0d9488" style={{ marginBottom: 16 }} />
                        <Text style={styles.title}>Checking for Updates</Text>
                        <Text style={styles.subtitle}>Connecting to Medical365 update service...</Text>
                    </View>
                );

            case UPDATE_STATES.AVAILABLE:
                return (
                    <View style={styles.contentBox}>
                        <View style={styles.badgeSuccess}>
                            <Text style={styles.badgeText}>Update Available</Text>
                        </View>
                        <Text style={styles.title}>New Version Available</Text>
                        <Text style={styles.bodyText}>
                            An authorized software update is ready for your clinical application.
                        </Text>

                        {metadata?.runtimeVersion && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Runtime Cohort:</Text>
                                <Text style={styles.infoValue}>{metadata.runtimeVersion}</Text>
                            </View>
                        )}

                        {metadata?.channel && (
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Channel:</Text>
                                <Text style={styles.infoValue}>{metadata.channel}</Text>
                            </View>
                        )}

                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={styles.btnSecondary} onPress={handleDefer}>
                                <Text style={styles.btnSecondaryText}>Later</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnPrimary} onPress={handleDownload}>
                                <Text style={styles.btnPrimaryText}>Update Now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            case UPDATE_STATES.DOWNLOADING:
                return (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color="#0d9488" style={{ marginBottom: 16 }} />
                        <Text style={styles.title}>Downloading Update</Text>
                        <Text style={styles.subtitle}>
                            Preparing software package safely in background. Clinical work will not be interrupted.
                        </Text>
                    </View>
                );

            case UPDATE_STATES.DOWNLOADED:
                return (
                    <View style={styles.contentBox}>
                        <View style={styles.badgeSuccess}>
                            <Text style={styles.badgeText}>Ready to Apply</Text>
                        </View>
                        <Text style={styles.title}>Update Downloaded</Text>
                        <Text style={styles.bodyText}>
                            The update has been safely verified and downloaded. You can restart the app now or let it apply automatically on the next launch.
                        </Text>

                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={styles.btnSecondary} onPress={onDefer}>
                                <Text style={styles.btnSecondaryText}>On Next Launch</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnPrimary} onPress={onApply}>
                                <Text style={styles.btnPrimaryText}>Restart Now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            case UPDATE_STATES.RECOVERY:
                return (
                    <View style={styles.contentBox}>
                        <View style={styles.badgeAmber}>
                            <Text style={styles.badgeAmberText}>Emergency Recovery Mode Active</Text>
                        </View>
                        <Text style={styles.title}>Baseline Safety Protection</Text>
                        <Text style={styles.bodyText}>
                            Medical365 is running on its embedded base configuration. Automatic reloads have been deferred to ensure uninterrupted clinical workflows.
                        </Text>
                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={styles.btnPrimary} onPress={onResetRecovery || onClose}>
                                <Text style={styles.btnPrimaryText}>Acknowledge & Reset</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            case UPDATE_STATES.ERROR:
                return (
                    <View style={styles.contentBox}>
                        <View style={styles.badgeError}>
                            <Text style={styles.badgeErrorText}>Update Notice</Text>
                        </View>
                        <Text style={styles.title}>Update Check Incomplete</Text>
                        <Text style={styles.bodyText}>
                            {errorMessage || 'Unable to complete update check. The app will continue normally.'}
                        </Text>
                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={styles.btnSecondary} onPress={onClose}>
                                <Text style={styles.btnSecondaryText}>Dismiss</Text>
                            </TouchableOpacity>
                            {onRetry && (
                                <TouchableOpacity style={styles.btnPrimary} onPress={onRetry}>
                                    <Text style={styles.btnPrimaryText}>Retry</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                );

            case UPDATE_STATES.IDLE:
            default:
                return (
                    <View style={styles.contentBox}>
                        <View style={styles.badgeSuccess}>
                            <Text style={styles.badgeText}>Up to Date</Text>
                        </View>
                        <Text style={styles.title}>Application is Current</Text>
                        <Text style={styles.bodyText}>
                            You are running the latest verified version of Medical365.
                        </Text>
                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={styles.btnPrimary} onPress={onClose}>
                                <Text style={styles.btnPrimaryText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );
        }
    };

    return (
        <Modal
            transparent
            animationType="fade"
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.modalCard, { width: isMobile ? '92%' : 440 }]}>
                    {renderContent()}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 8,
    },
    centerBox: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    contentBox: {
        alignItems: 'flex-start',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 20,
    },
    bodyText: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 21,
        marginBottom: 16,
    },
    badgeSuccess: {
        backgroundColor: '#ccfbf1',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 12,
    },
    badgeText: {
        color: '#0f766e',
        fontSize: 12,
        fontWeight: '600',
    },
    badgeAmber: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 12,
    },
    badgeAmberText: {
        color: '#b45309',
        fontSize: 12,
        fontWeight: '600',
    },
    badgeError: {
        backgroundColor: '#fee2e2',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        marginBottom: 12,
    },
    badgeErrorText: {
        color: '#b91c1c',
        fontSize: 12,
        fontWeight: '600',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    infoLabel: {
        fontSize: 13,
        color: '#64748b',
    },
    infoValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        width: '100%',
        marginTop: 20,
        gap: 10,
    },
    btnSecondary: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    btnSecondaryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },
    btnPrimary: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 8,
        backgroundColor: '#0d9488',
    },
    btnPrimaryText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },
});
