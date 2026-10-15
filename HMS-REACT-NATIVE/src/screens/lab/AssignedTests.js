import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, Platform, useWindowDimensions,
    RefreshControl, TextInput
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import {
    fetchLabAssignedRequestsWithOffline,
    saveLabResultDraftWithOffline,
    getLabResultDraft,
    clearLabResultDraft,
    uploadLabReportOnlineOnly,
} from '../../services/offline/offlineLabService';
import OfflineBanner from '../../components/OfflineBanner';
import OfflineEmptyState from '../../components/OfflineEmptyState';

const AssignedTests = () => {
    const { width } = useWindowDimensions();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploadingId, setUploadingId] = useState(null);
    const [drafts, setDrafts] = useState({});
    const [expandedDrafts, setExpandedDrafts] = useState({});
    const [savingDraftId, setSavingDraftId] = useState(null);

    const [offlineState, setOfflineState] = useState({
        isOffline: false,
        fromCache: false,
        lastFetchedAt: null,
        noCache: false,
    });

    // Hydrate existing drafts for loaded requests
    const hydrateDrafts = useCallback(async (reqList) => {
        if (!Array.isArray(reqList) || reqList.length === 0) return;
        const draftMap = {};
        for (const req of reqList) {
            try {
                const draft = await getLabResultDraft({ reportId: req._id });
                if (draft) {
                    draftMap[req._id] = draft;
                }
            } catch (e) {}
        }
        setDrafts((prev) => ({ ...prev, ...draftMap }));
    }, []);

    const loadRequests = useCallback(async (isPullToRefresh = false) => {
        if (isPullToRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const res = await fetchLabAssignedRequestsWithOffline({
                status: 'pending',
                onCacheHit: (cached) => {
                    if (cached && Array.isArray(cached.requests)) {
                        setRequests(cached.requests);
                        setOfflineState({
                            isOffline: false,
                            fromCache: true,
                            lastFetchedAt: cached.lastFetchedAt,
                            noCache: false,
                        });
                        setLoading(false);
                        hydrateDrafts(cached.requests);
                    }
                },
            });

            if (res && res.success && Array.isArray(res.requests)) {
                setRequests(res.requests);
                setOfflineState({
                    isOffline: !!res.isOffline,
                    fromCache: !!res.fromCache,
                    lastFetchedAt: res.lastFetchedAt || Date.now(),
                    noCache: false,
                });
                hydrateDrafts(res.requests);
            }
        } catch (err) {
            console.error('[AssignedTests] Error loading requests:', err?.message || err);
            setOfflineState((prev) => ({
                ...prev,
                isOffline: true,
                noCache: requests.length === 0,
            }));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [hydrateDrafts, requests.length]);

    useEffect(() => {
        loadRequests();
    }, []);

    const toggleDraftExpand = (reportId) => {
        setExpandedDrafts((prev) => ({
            ...prev,
            [reportId]: !prev[reportId],
        }));
    };

    const handleDraftFieldChange = (reportId, field, value) => {
        setDrafts((prev) => ({
            ...prev,
            [reportId]: {
                ...(prev[reportId] || {}),
                [field]: value,
            },
        }));
    };

    const handleSaveDraft = async (reportId) => {
        setSavingDraftId(reportId);
        try {
            const draftData = drafts[reportId] || {};
            await saveLabResultDraftWithOffline({
                reportId,
                draftData: {
                    specimenCondition: draftData.specimenCondition || '',
                    observations: draftData.observations || '',
                    technicianNotes: draftData.technicianNotes || '',
                },
            });
            Alert.alert("Draft Saved", "Test findings and specimen notes saved locally. They will persist across sessions.");
        } catch (err) {
            Alert.alert("Error Saving Draft", err?.message || "Failed to save local draft.");
        } finally {
            setSavingDraftId(null);
        }
    };

    const handleClearDraft = async (reportId) => {
        Alert.alert(
            "Discard Draft",
            "Are you sure you want to discard your unsynced test notes for this patient?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Discard",
                    style: "destructive",
                    onPress: async () => {
                        await clearLabResultDraft({ reportId });
                        setDrafts((prev) => {
                            const updated = { ...prev };
                            delete updated[reportId];
                            return updated;
                        });
                        setExpandedDrafts((prev) => ({ ...prev, [reportId]: false }));
                    },
                },
            ]
        );
    };

    const submitReport = (reportId, fileData, fileName) => {
        const ext = fileName.split('.').pop().toLowerCase();
        const allowedExts = ['pdf', 'jpg', 'jpeg', 'png'];
        if (!allowedExts.includes(ext)) {
            Alert.alert('Invalid File', 'Only JPEG, PNG and PDF allowed');
            return;
        }

        Alert.alert(
            "Upload Lab Report",
            `Upload ${fileName} for this patient?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Upload File",
                    onPress: async () => {
                        setUploadingId(reportId);
                        try {
                            const currentDraft = drafts[reportId] || {};
                            const notesText = currentDraft.observations
                                ? `Findings: ${currentDraft.observations}. Notes: ${currentDraft.technicianNotes || 'Uploaded via Lab Dashboard'}`
                                : 'Uploaded via Lab Dashboard';

                            const formData = new FormData();
                            formData.append('reportFile', fileData);
                            formData.append('notes', notesText);

                            const res = await uploadLabReportOnlineOnly(reportId, formData);
                            if (res.success) {
                                Alert.alert("Success", "Report uploaded & sent to doctor!");
                                setDrafts((prev) => {
                                    const updated = { ...prev };
                                    delete updated[reportId];
                                    return updated;
                                });
                                loadRequests();
                            } else {
                                Alert.alert("Upload Failed", res.message || "Upload failed");
                            }
                        } catch (err) {
                            const errMsg = err.response?.data?.message || err.message || "Upload Failed";
                            Alert.alert("Upload Refused (Offline)", errMsg);
                        } finally {
                            setUploadingId(null);
                        }
                    }
                }
            ]
        );
    };

    const handleFileUpload = async (reportId) => {
        if (uploadingId) return;

        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf,.jpg,.jpeg,.png';
            input.onchange = async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                submitReport(reportId, file, file.name);
            };
            input.click();
        } else {
            try {
                const result = await DocumentPicker.getDocumentAsync({
                    type: ['application/pdf', 'image/jpeg', 'image/png'],
                    copyToCacheDirectory: true
                });
                if (!result.canceled && result.assets && result.assets.length > 0) {
                    const asset = result.assets[0];
                    const fileData = {
                        uri: asset.uri,
                        name: asset.name,
                        type: asset.mimeType || (asset.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
                    };
                    submitReport(reportId, fileData, asset.name);
                }
            } catch (err) {
                console.error("Document picking error:", err);
                Alert.alert("Error", "Could not open file picker");
            }
        }
    };

    if (loading && requests.length === 0 && !offlineState.fromCache) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0ea5e9" />
                <Text style={styles.loadingText}>Loading Test Requests...</Text>
            </View>
        );
    }

    const isLargeScreen = width > 768;

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.contentContainer, width < 400 && { padding: 16 }]}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => loadRequests(true)} colors={['#0ea5e9']} />
            }
        >
            <OfflineBanner
                isOffline={offlineState.isOffline}
                fromCache={offlineState.fromCache}
                lastFetchedAt={offlineState.lastFetchedAt}
            />

            <View style={[styles.header, !isLargeScreen && { flexDirection: 'column', alignItems: 'flex-start', gap: 15 }, width < 400 && { padding: 16, marginBottom: 24 }]}>
                <View>
                    <Text style={styles.headerTitle}>📋 Pending Lab Requests</Text>
                    <Text style={styles.headerSubtitle}>View and process requested tests</Text>
                </View>
            </View>

            {offlineState.noCache && requests.length === 0 ? (
                <OfflineEmptyState
                    title="No Cached Lab Requests"
                    message="Pending test requests are not available offline on this device yet. Please connect to the hospital network."
                    onRetry={() => loadRequests(false)}
                />
            ) : requests.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No pending tests assigned to your lab.</Text>
                </View>
            ) : (
                <View style={[styles.grid, !isLargeScreen && { flexDirection: 'column' }]}>
                    {requests.map((req) => {
                        const hasDraft = !!drafts[req._id]?.savedAt;
                        const isExpanded = !!expandedDrafts[req._id];
                        const draftData = drafts[req._id] || {};

                        return (
                            <View key={req._id} style={[styles.card, !isLargeScreen && { minWidth: '100%', width: '100%' }]}>
                                <View style={styles.cardHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.patientName}>{req.userId?.name || 'Unknown Patient'}</Text>
                                        <Text style={styles.patientId}>ID: {req.patientId}</Text>
                                    </View>
                                    {hasDraft && (
                                        <View style={styles.draftBadge}>
                                            <Text style={styles.draftBadgeText}>💾 LOCAL DRAFT</Text>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.cardBody}>
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Doctor:</Text>
                                        <Text style={styles.infoValue}>Dr. {req.doctorId?.name || 'N/A'}</Text>
                                    </View>
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Date:</Text>
                                        <Text style={styles.infoValue}>{new Date(req.createdAt).toLocaleDateString()}</Text>
                                    </View>

                                    <View style={styles.testListContainer}>
                                        <Text style={styles.infoLabel}>Tests Requested:</Text>
                                        <View style={styles.tagsContainer}>
                                            {req.testNames && req.testNames.map((test, idx) => (
                                                <View key={idx} style={styles.tag}>
                                                    <Text style={styles.tagText}>{test}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Offline Draft Findings Section */}
                                    <View style={styles.draftSection}>
                                        <TouchableOpacity
                                            style={styles.btnToggleDraft}
                                            onPress={() => toggleDraftExpand(req._id)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.btnToggleDraftText}>
                                                {isExpanded ? '▲ Hide Test Findings Draft' : '📝 Test Findings & Notes Draft'}
                                            </Text>
                                        </TouchableOpacity>

                                        {isExpanded && (
                                            <View style={styles.draftFormContainer}>
                                                <Text style={styles.inputLabel}>Specimen Condition / Vial Status:</Text>
                                                <TextInput
                                                    style={styles.textInput}
                                                    placeholder="e.g., EDTA vial, fasting, intact cold-chain"
                                                    value={draftData.specimenCondition || ''}
                                                    onChangeText={(val) => handleDraftFieldChange(req._id, 'specimenCondition', val)}
                                                />

                                                <Text style={styles.inputLabel}>Preliminary Findings / Test Values:</Text>
                                                <TextInput
                                                    style={[styles.textInput, { height: 60 }]}
                                                    placeholder="e.g., Blood Glucose: 110 mg/dL, Hb: 13.5 g/dL"
                                                    multiline={true}
                                                    value={draftData.observations || ''}
                                                    onChangeText={(val) => handleDraftFieldChange(req._id, 'observations', val)}
                                                />

                                                <Text style={styles.inputLabel}>Technician Notes:</Text>
                                                <TextInput
                                                    style={styles.textInput}
                                                    placeholder="e.g., Analyzed on Sysmex XN-550"
                                                    value={draftData.technicianNotes || ''}
                                                    onChangeText={(val) => handleDraftFieldChange(req._id, 'technicianNotes', val)}
                                                />

                                                <View style={styles.draftActionsRow}>
                                                    <TouchableOpacity
                                                        style={styles.btnSaveDraft}
                                                        disabled={savingDraftId === req._id}
                                                        onPress={() => handleSaveDraft(req._id)}
                                                    >
                                                        <Text style={styles.btnSaveDraftText}>
                                                            {savingDraftId === req._id ? 'Saving...' : '💾 Save Local Draft'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                    {hasDraft && (
                                                        <TouchableOpacity
                                                            style={styles.btnDiscardDraft}
                                                            onPress={() => handleClearDraft(req._id)}
                                                        >
                                                            <Text style={styles.btnDiscardDraftText}>Discard</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                <View style={styles.cardFooter}>
                                    <TouchableOpacity
                                        style={[styles.btnUpload, uploadingId === req._id && { opacity: 0.7 }]}
                                        disabled={uploadingId === req._id}
                                        onPress={() => handleFileUpload(req._id)}
                                    >
                                        <LinearGradient
                                            colors={['#0ea5e9', '#0284c7']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.gradientBg}
                                        >
                                            <Text style={styles.btnUploadText}>
                                                {uploadingId === req._id ? 'Uploading...' : '📤 Upload Report (Online)'}
                                            </Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#eff6ff',
    },
    contentContainer: {
        padding: 32,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#eff6ff'
    },
    loadingText: {
        marginTop: 10,
        color: '#64748b',
        fontSize: 16
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        padding: 24,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        shadowColor: '#1f2687',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 32,
        elevation: 5,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0ea5e9',
    },
    headerSubtitle: {
        color: '#64748b',
        fontSize: 16,
        marginTop: 4,
        fontWeight: '500'
    },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        borderRadius: 20
    },
    emptyStateText: {
        color: '#64748b',
        fontSize: 16,
        fontWeight: '500'
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24
    },
    card: {
        flex: 1,
        minWidth: 280,
        maxWidth: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 2
    },
    cardHeader: {
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(226, 232, 240, 0.6)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    patientName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a'
    },
    patientId: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 2,
    },
    draftBadge: {
        backgroundColor: '#fef3c7',
        borderWidth: 1,
        borderColor: '#fde68a',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    draftBadgeText: {
        color: '#b45309',
        fontSize: 11,
        fontWeight: '800',
    },
    cardBody: {
        padding: 24,
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: 10,
        alignItems: 'center'
    },
    infoLabel: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '700',
        width: 110
    },
    infoValue: {
        fontSize: 14,
        color: '#1e293b',
        fontWeight: '500',
        flex: 1
    },
    testListContainer: {
        marginTop: 10,
        marginBottom: 15,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 8
    },
    tag: {
        backgroundColor: '#fff7ed',
        borderWidth: 1,
        borderColor: '#ffedd5',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 10
    },
    tagText: {
        color: '#ea580c',
        fontSize: 13,
        fontWeight: '600'
    },
    draftSection: {
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 12,
    },
    btnToggleDraft: {
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    btnToggleDraftText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0369a1',
    },
    draftFormContainer: {
        marginTop: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
        marginTop: 6,
        marginBottom: 4,
    },
    textInput: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 13,
        color: '#0f172a',
    },
    draftActionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 10,
        marginTop: 12,
    },
    btnSaveDraft: {
        backgroundColor: '#0284c7',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 14,
    },
    btnSaveDraftText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
    btnDiscardDraft: {
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    btnDiscardDraftText: {
        color: '#dc2626',
        fontSize: 12,
        fontWeight: '600',
    },
    cardFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(241, 245, 249, 0.8)',
        backgroundColor: 'rgba(255, 255, 255, 0.4)'
    },
    btnUpload: {
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 4
    },
    gradientBg: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center'
    },
    btnUploadText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 15
    }
});

export default AssignedTests;
