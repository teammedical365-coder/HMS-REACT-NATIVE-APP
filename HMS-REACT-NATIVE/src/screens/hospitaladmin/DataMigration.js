import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
    Modal
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { migrationAPI } from '../../utils/api';

const DataMigration = () => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [selectedSession, setSelectedSession] = useState(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [importing, setImporting] = useState(false);

    const loadSessions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await migrationAPI.listSessions();
            setSessions(res?.sessions || res?.data || []);
        } catch (err) {
            console.error('Error fetching migration sessions:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const handleCreateSession = async () => {
        setCreating(true);
        try {
            const res = await migrationAPI.createSession();
            Alert.alert('Success', 'New data migration session initialized.');
            loadSessions();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to initialize session.');
        } finally {
            setCreating(false);
        }
    };

    const handleOpenSession = async (sess) => {
        setSelectedSession(sess);
        setDetailModalOpen(true);
    };

    const handleExecuteImport = async (id) => {
        setImporting(true);
        try {
            await migrationAPI.executeImport(id);
            Alert.alert('Success', 'Import process triggered in background.');
            setDetailModalOpen(false);
            loadSessions();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to trigger import.');
        } finally {
            setImporting(false);
        }
    };

    const renderItem = ({ item }) => {
        const status = item.status || 'DRAFT';
        const isCompleted = status === 'COMPLETED';
        const isReady = status === 'READY_FOR_IMPORT';

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.iconBox}>
                        <Feather name="database" size={18} color="#0d9488" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.cardTitle}>Migration #{item._id?.slice(-6).toUpperCase()}</Text>
                        <Text style={styles.cardMeta}>
                            Created: {new Date(item.createdAt).toLocaleDateString('en-IN')} • Files: {item.files?.length || 0}
                        </Text>
                    </View>
                    <View style={[styles.badge, isCompleted ? styles.badgeSuccess : isReady ? styles.badgeWarning : styles.badgeDefault]}>
                        <Text style={[styles.badgeText, isCompleted ? styles.textSuccess : isReady ? styles.textWarning : styles.textDefault]}>
                            {status}
                        </Text>
                    </View>
                </View>

                <View style={styles.statsStrip}>
                    <Text style={styles.statsText}>Detected Entities: {(item.detectedEntities || []).join(', ') || 'None'}</Text>
                    <Text style={styles.statsText}>Mapped: {item.stats?.mappedCount || 0} / {item.stats?.totalHeaders || 0}</Text>
                </View>

                <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.detailsBtn} onPress={() => handleOpenSession(item)}>
                        <Feather name="eye" size={13} color="#0d9488" />
                        <Text style={styles.detailsBtnText}>View Details</Text>
                    </TouchableOpacity>
                    {isReady && (
                        <TouchableOpacity style={styles.importBtn} onPress={() => handleExecuteImport(item._id)} disabled={importing}>
                            <Feather name="upload-cloud" size={13} color="#ffffff" />
                            <Text style={styles.importBtnText}>Execute Import</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.pageTitle}>Data Migration Suite</Text>
                    <Text style={styles.pageSub}>Legacy EMR / Clinic Import Console</Text>
                </View>
                <TouchableOpacity style={styles.newBtn} onPress={handleCreateSession} disabled={creating}>
                    {creating ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                        <>
                            <Feather name="plus" size={15} color="#ffffff" />
                            <Text style={styles.newBtnText}>New Migration</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.centerLoading}>
                    <ActivityIndicator size="large" color="#0d9488" />
                    <Text style={styles.loadingText}>Loading migration history...</Text>
                </View>
            ) : (
                <FlatList
                    data={sessions}
                    keyExtractor={item => item._id || String(Math.random())}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Feather name="upload-cloud" size={40} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No data migration sessions found.</Text>
                            <Text style={styles.emptySub}>Initialize a new migration session to import legacy patient records.</Text>
                        </View>
                    }
                />
            )}

            {/* Session Detail Modal */}
            <Modal visible={detailModalOpen} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Session #{selectedSession?._id?.slice(-6).toUpperCase()}</Text>
                                <Text style={styles.modalSub}>Status: {selectedSession?.status}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setDetailModalOpen(false)}>
                                <Feather name="x" size={20} color="#475569" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ padding: 16 }}>
                            <Text style={styles.secTitle}>Session Metadata</Text>
                            <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>Session ID:</Text>
                                <Text style={styles.metaVal}>{selectedSession?._id}</Text>
                            </View>
                            <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>Created At:</Text>
                                <Text style={styles.metaVal}>{new Date(selectedSession?.createdAt || Date.now()).toLocaleString('en-IN')}</Text>
                            </View>

                            <Text style={[styles.secTitle, { marginTop: 14 }]}>Detected Entities</Text>
                            <Text style={styles.entitiesList}>
                                {(selectedSession?.detectedEntities || []).join(' • ') || 'No entities mapped yet'}
                            </Text>

                            <Text style={[styles.secTitle, { marginTop: 14 }]}>Uploads &amp; Files</Text>
                            {(selectedSession?.files || []).length === 0 ? (
                                <Text style={styles.emptySub}>No files uploaded in this session.</Text>
                            ) : (
                                selectedSession.files.map((f, i) => (
                                    <View key={i} style={styles.fileItem}>
                                        <Feather name="file" size={14} color="#64748b" />
                                        <Text style={styles.fileName}>{f.originalName || f.filename || `File ${i + 1}`}</Text>
                                    </View>
                                ))
                            )}

                            {selectedSession?.status === 'READY_FOR_IMPORT' && (
                                <TouchableOpacity
                                    style={styles.fullImportBtn}
                                    onPress={() => handleExecuteImport(selectedSession._id)}
                                    disabled={importing}
                                >
                                    {importing ? (
                                        <ActivityIndicator size="small" color="#ffffff" />
                                    ) : (
                                        <>
                                            <Feather name="play" size={15} color="#ffffff" />
                                            <Text style={styles.fullImportBtnText}>Execute Production Import</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 10,
        backgroundColor: '#ffffff',
    },
    pageTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
    },
    pageSub: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    newBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#0d9488',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    newBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    listContent: {
        padding: 16,
        paddingBottom: 30,
    },
    centerLoading: {
        paddingVertical: 48,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 48,
        paddingHorizontal: 24,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 10,
    },
    emptySub: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 4,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 14,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#ccfbf1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    cardMeta: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    badgeSuccess: { backgroundColor: '#ccfbf1' },
    badgeWarning: { backgroundColor: '#fef3c7' },
    badgeDefault: { backgroundColor: '#f1f5f9' },
    badgeText: { fontSize: 10, fontWeight: '700' },
    textSuccess: { color: '#0f766e' },
    textWarning: { color: '#b45309' },
    textDefault: { color: '#475569' },
    statsStrip: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 8,
        marginTop: 10,
        gap: 2,
    },
    statsText: {
        fontSize: 11,
        color: '#475569',
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 10,
    },
    detailsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#f0fdfa',
        borderWidth: 1,
        borderColor: '#99f6e4',
    },
    detailsBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0d9488',
    },
    importBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#0d9488',
    },
    importBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'flex-end',
    },
    modalBox: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    modalSub: {
        fontSize: 12,
        color: '#0d9488',
        fontWeight: '600',
        marginTop: 2,
    },
    secTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    metaLabel: { fontSize: 11, color: '#64748b' },
    metaVal: { fontSize: 11, fontWeight: '600', color: '#0f172a' },
    entitiesList: {
        fontSize: 12,
        color: '#0f766e',
        fontWeight: '600',
        backgroundColor: '#f0fdfa',
        padding: 8,
        borderRadius: 6,
    },
    fileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
    },
    fileName: { fontSize: 12, color: '#334155' },
    fullImportBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#0d9488',
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 20,
        marginBottom: 10,
    },
    fullImportBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
});

export default DataMigration;

