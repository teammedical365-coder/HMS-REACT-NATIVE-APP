import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    FlatList
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { localAgentAPI, localSyncAPI } from '../../utils/api';

const LocalSync = () => {
    const [agentStatus, setAgentStatus] = useState(null);
    const [syncStatus, setSyncStatus] = useState(null);
    const [uploadStats, setUploadStats] = useState(null);
    const [conflicts, setConflicts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [testing, setTesting] = useState(false);

    const loadSyncInfo = useCallback(async () => {
        setLoading(true);
        try {
            const [agentRes, syncRes, upRes, confRes] = await Promise.all([
                localAgentAPI.getStatus().catch(() => null),
                localSyncAPI.getSyncStatus().catch(() => null),
                localSyncAPI.getUploadStats().catch(() => null),
                localSyncAPI.getConflicts({ status: 'PENDING' }).catch(() => ({ conflicts: [] }))
            ]);
            setAgentStatus(agentRes);
            setSyncStatus(syncRes);
            setUploadStats(upRes);
            setConflicts(confRes?.conflicts || confRes?.data || []);
        } catch (err) {
            console.error('Error fetching local sync status:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSyncInfo();
    }, [loadSyncInfo]);

    const handleSyncNow = async () => {
        setSyncing(true);
        try {
            await localSyncAPI.syncNow();
            Alert.alert('Success', 'Cloud to Local sync initiated.');
            loadSyncInfo();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to trigger sync.');
        } finally {
            setSyncing(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        try {
            const res = await localAgentAPI.testConnection();
            Alert.alert('Connection Test', res?.message || 'Local agent connection established successfully.');
        } catch (err) {
            Alert.alert('Connection Failed', 'Could not reach local agent.');
        } finally {
            setTesting(false);
        }
    };

    const handleResolveConflict = async (conflictId, strategy) => {
        try {
            await localSyncAPI.resolveConflict(conflictId, { strategy });
            Alert.alert('Resolved', `Conflict resolved using ${strategy} version.`);
            loadSyncInfo();
        } catch (err) {
            Alert.alert('Error', 'Failed to resolve conflict.');
        }
    };

    const isOnline = agentStatus?.connected || syncStatus?.isOnline || false;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.pageTitle}>Local Database Sync</Text>
                    <Text style={styles.pageSub}>LAN Gateway &amp; Offline Server Continuity</Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={loadSyncInfo}>
                    <Feather name="refresh-cw" size={16} color="#0d9488" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centerLoading}>
                    <ActivityIndicator size="large" color="#0d9488" />
                    <Text style={styles.loadingText}>Fetching sync topology...</Text>
                </View>
            ) : (
                <View>
                    {/* Status Overview Card */}
                    <View style={styles.card}>
                        <View style={styles.agentStatusRow}>
                            <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={styles.agentTitle}>
                                    Local Sync Agent: {isOnline ? 'ONLINE & PAIRED' : 'DISCONNECTED / OFFLINE'}
                                </Text>
                                <Text style={styles.agentMeta}>
                                    Agent Name: {agentStatus?.agentName || 'Default Hospital Agent'} • Version: {agentStatus?.version || 'v2.4'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={styles.testBtn}
                                onPress={handleTestConnection}
                                disabled={testing}
                            >
                                <Feather name="activity" size={13} color="#0d9488" />
                                <Text style={styles.testBtnText}>{testing ? 'Testing...' : 'Test Ping'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
                                onPress={handleSyncNow}
                                disabled={syncing}
                            >
                                {syncing ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <>
                                        <Feather name="refresh-cw" size={13} color="#ffffff" />
                                        <Text style={styles.syncBtnText}>Sync Cloud to Local</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Sync Statistics */}
                    <View style={styles.statsGrid}>
                        <View style={styles.statBox}>
                            <Text style={styles.statNum}>{uploadStats?.pendingUploads || syncStatus?.pendingCount || 0}</Text>
                            <Text style={styles.statLabel}>Pending Sync</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statNum}>{conflicts.length}</Text>
                            <Text style={[styles.statLabel, conflicts.length > 0 && { color: '#ef4444' }]}>Conflicts</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statNum}>{syncStatus?.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Never'}</Text>
                            <Text style={styles.statLabel}>Last Sync</Text>
                        </View>
                    </View>

                    {/* Conflict Resolution Console */}
                    <View style={styles.card}>
                        <View style={styles.conflictHeader}>
                            <Feather name="git-merge" size={16} color="#ef4444" />
                            <Text style={styles.conflictTitle}>
                                Sync Conflicts Requiring Review ({conflicts.length})
                            </Text>
                        </View>

                        {conflicts.length === 0 ? (
                            <Text style={styles.emptyNotice}>No pending synchronization conflicts. Databases are in sync.</Text>
                        ) : (
                            conflicts.map(c => (
                                <View key={c._id} style={styles.conflictItem}>
                                    <Text style={styles.conflictEntity}>{c.entityType || 'Record'} #{c.entityId?.slice(-6)}</Text>
                                    <Text style={styles.conflictDesc}>Conflict detected between Cloud and Local record modifications.</Text>
                                    <View style={styles.conflictBtnsRow}>
                                        <TouchableOpacity
                                            style={styles.resolveCloudBtn}
                                            onPress={() => handleResolveConflict(c._id, 'CLOUD_WINS')}
                                        >
                                            <Text style={styles.resolveBtnText}>Keep Cloud Version</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.resolveLocalBtn}
                                            onPress={() => handleResolveConflict(c._id, 'LOCAL_WINS')}
                                        >
                                            <Text style={styles.resolveBtnText}>Keep Local Version</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
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
    refreshBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
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
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 14,
        marginBottom: 14,
    },
    agentStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    dotOnline: { backgroundColor: '#10b981' },
    dotOffline: { backgroundColor: '#ef4444' },
    agentTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    agentMeta: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    testBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#f0fdfa',
        borderWidth: 1,
        borderColor: '#99f6e4',
    },
    testBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0d9488',
    },
    syncBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#0d9488',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
    syncBtnDisabled: {
        backgroundColor: '#94a3b8',
    },
    syncBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
    },
    statBox: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        alignItems: 'center',
    },
    statNum: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
    },
    statLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 2,
    },
    conflictHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
    },
    conflictTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#b91c1c',
    },
    emptyNotice: {
        fontSize: 12,
        color: '#94a3b8',
        paddingVertical: 12,
        textAlign: 'center',
    },
    conflictItem: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
    },
    conflictEntity: {
        fontSize: 12,
        fontWeight: '700',
        color: '#991b1b',
    },
    conflictDesc: {
        fontSize: 11,
        color: '#64748b',
        marginVertical: 4,
    },
    conflictBtnsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 6,
    },
    resolveCloudBtn: {
        flex: 1,
        backgroundColor: '#0d9488',
        paddingVertical: 6,
        borderRadius: 6,
        alignItems: 'center',
    },
    resolveLocalBtn: {
        flex: 1,
        backgroundColor: '#475569',
        paddingVertical: 6,
        borderRadius: 6,
        alignItems: 'center',
    },
    resolveBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
    },
});

export default LocalSync;

