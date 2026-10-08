import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { doctorAPI, otAPI } from '../../utils/api';
import socket from '../../utils/socket';
import OTHeader from './OTHeader';
import { useOTResponsive } from './otResponsive';

const OTSurgeonsPage = () => {
    const navigation = useNavigation();
    const responsive = useOTResponsive();
    const { isSmallPhone, isPhone, isTablet, isLargeTablet, pagePadding, cardPadding } = responsive;

    const [doctors, setDoctors] = useState([]);
    const [surgeries, setSurgeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchSurgeonsData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [docsRes, schedRes] = await Promise.all([
                doctorAPI.getDoctors(),
                otAPI.getScheduledSurgeries()
            ]);

            if (docsRes?.doctors) setDoctors(docsRes.doctors || []);
            if (schedRes?.surgeries) setSurgeries(schedRes.surgeries || []);

            setLastUpdated(new Date());
        } catch (err) {
            console.error('Fetch surgeons error:', err);
            setError(err.response?.data?.message || 'Unable to load surgeons roster. Please check connection and retry.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSurgeonsData();

        if (!socket) return;
        const handleUpdate = () => fetchSurgeonsData();
        socket.on('ot_update', handleUpdate);
        socket.on('ot_surgery_scheduled', handleUpdate);
        socket.on('surgery_plan_created', handleUpdate);

        return () => {
            socket.off('ot_update', handleUpdate);
            socket.off('ot_surgery_scheduled', handleUpdate);
            socket.off('surgery_plan_created', handleUpdate);
        };
    }, [fetchSurgeonsData]);

    const todayStr = new Date().toISOString().split('T')[0];

    const surgeonCards = doctors.map(doc => {
        const docId = doc._id ? doc._id.toString() : '';
        const docName = (doc.name || `${doc.firstName || ''} ${doc.lastName || ''}`).replace(/^Dr\.?\s*/i, '');

        const todayCases = surgeries.filter(s => {
            const sDate = s.surgeryDate ? new Date(s.surgeryDate).toISOString().split('T')[0] : '';
            if (sDate !== todayStr) return false;
            const primaryId = s.surgeonId ? (typeof s.surgeonId === 'object' ? s.surgeonId._id?.toString() : s.surgeonId.toString()) : '';
            const isPrimary = primaryId === docId;
            const isAssistant = Array.isArray(s.assistantSurgeonIds) && s.assistantSurgeonIds.some(as => {
                const asId = typeof as === 'object' ? as._id?.toString() : as.toString();
                return asId === docId;
            });
            return isPrimary || isAssistant;
        });

        const upcomingCases = surgeries.filter(s => {
            const sDate = s.surgeryDate ? new Date(s.surgeryDate).toISOString().split('T')[0] : '';
            if (!sDate || sDate <= todayStr) return false;
            const primaryId = s.surgeonId ? (typeof s.surgeonId === 'object' ? s.surgeonId._id?.toString() : s.surgeonId.toString()) : '';
            const isPrimary = primaryId === docId;
            const isAssistant = Array.isArray(s.assistantSurgeonIds) && s.assistantSurgeonIds.some(as => {
                const asId = typeof as === 'object' ? as._id?.toString() : as.toString();
                return asId === docId;
            });
            return isPrimary || isAssistant;
        });

        return {
            ...doc,
            cleanName: docName,
            todayCount: todayCases.length,
            upcomingCount: upcomingCases.length,
            todayCases
        };
    });

    const filteredSurgeons = surgeonCards.filter(s => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const name = (s.cleanName || '').toLowerCase();
        const spec = (s.specialization || '').toLowerCase();
        const dept = (s.department || '').toLowerCase();
        return name.includes(q) || spec.includes(q) || dept.includes(q);
    });

    const cardWidth = isLargeTablet ? '31.5%' : isTablet ? '48.5%' : '100%';

    return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, { padding: pagePadding }]}>
            <OTHeader
                title="OT Surgeons & Surgical Roster"
                subtitle="Active operating surgeons, surgical assistants, caseload distribution, and individual daily schedules."
                lastUpdated={lastUpdated}
                loading={loading}
                onRefresh={fetchSurgeonsData}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
            />

            {error ? (
                <View style={[styles.errorState, { padding: isSmallPhone ? 20 : 36 }]}>
                    <Feather name="alert-circle" size={isSmallPhone ? 36 : 44} color="#ef4444" style={{ marginBottom: 12 }} />
                    <Text style={styles.errorTitle}>Unable to Load Data</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={fetchSurgeonsData}
                        activeOpacity={0.7}
                    >
                        <Feather name="refresh-cw" size={16} color="#ffffff" style={{ marginRight: 8 }} />
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : filteredSurgeons.length === 0 ? (
                <View style={[styles.emptyState, { padding: isSmallPhone ? 32 : 56 }]}>
                    <Text style={{ fontSize: isSmallPhone ? 32 : 40, marginBottom: 12 }}>👨‍⚕️</Text>
                    <Text style={styles.emptyTitle}>No Surgeons Found</Text>
                    <Text style={styles.emptyText}>No doctors matching your query are currently registered.</Text>
                </View>
            ) : (
                <View style={styles.grid}>
                    {filteredSurgeons.map(surgeon => (
                        <View
                            key={surgeon._id}
                            style={[
                                styles.card,
                                {
                                    width: cardWidth,
                                    padding: cardPadding
                                }
                            ]}
                        >
                            <View style={styles.cardHeader}>
                                <View style={[styles.avatar, isSmallPhone && { width: 42, height: 42, borderRadius: 21 }]}>
                                    <Text style={{ fontSize: isSmallPhone ? 20 : 24 }}>👨‍⚕️</Text>
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={[styles.docName, isSmallPhone && { fontSize: 15 }]} numberOfLines={2}>
                                        Dr. {surgeon.cleanName}
                                    </Text>
                                    <Text style={styles.docSpec} numberOfLines={2}>
                                        {surgeon.specialization || surgeon.department || 'General Surgery'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.statsGrid}>
                                <View style={styles.statBox}>
                                    <Text style={styles.statLabel}>Today's Surgeries</Text>
                                    <Text style={[styles.statValue, { color: surgeon.todayCount > 0 ? '#2563eb' : '#64748b' }]}>
                                        {surgeon.todayCount}
                                    </Text>
                                </View>
                                <View style={styles.statBox}>
                                    <Text style={styles.statLabel}>Upcoming</Text>
                                    <Text style={[styles.statValue, { color: surgeon.upcomingCount > 0 ? '#7c3aed' : '#64748b' }]}>
                                        {surgeon.upcomingCount}
                                    </Text>
                                </View>
                            </View>

                            {surgeon.todayCases.length > 0 && (
                                <View style={styles.caseList}>
                                    <Text style={styles.caseListTitle}>TODAY'S CASE LIST ({surgeon.todayCases.length}):</Text>
                                    {surgeon.todayCases.map((c, idx) => (
                                        <View key={idx} style={styles.caseItem}>
                                            <Text style={styles.caseItemText} numberOfLines={2}>
                                                • <Text style={{ fontWeight: 'bold' }}>{c.surgery}</Text> at {c.startTime || '--:--'} ({c.otRoomId?.name || 'OT'})
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View style={[styles.cardActions, !isTablet && { justifyContent: 'stretch' }]}>
                                <TouchableOpacity
                                    onPress={() => navigation.navigate('OTSchedulePage')}
                                    style={[styles.viewScheduleBtn, !isTablet && { width: '100%' }]}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.viewScheduleBtnText}>View Full OT Schedule →</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    contentContainer: { width: '100%', maxWidth: 1440, alignSelf: 'center', padding: 16, paddingBottom: 40 },
    emptyState: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 50, alignItems: 'center' },
    emptyTitle: { marginVertical: 6, color: '#1e293b', fontSize: 18, fontWeight: '700' },
    emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between' },
    card: {
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        marginBottom: 4,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eff6ff', borderWidth: 1.5, borderColor: '#bfdbfe', justifyContent: 'center', alignItems: 'center' },
    docName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    docSpec: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    statBox: { flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
    statLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
    statValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
    caseList: { marginBottom: 14 },
    caseListTitle: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 6 },
    caseItem: { backgroundColor: '#f8fafc', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 5 },
    caseItemText: { fontSize: 12, color: '#334155', lineHeight: 17 },
    cardActions: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    viewScheduleBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        borderRadius: 8,
    },
    viewScheduleBtnText: { fontSize: 13, fontWeight: '700', color: '#1d4ed8' },
    errorState: {
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#fee2e2',
        padding: 36,
        alignItems: 'center',
        marginVertical: 16,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#b91c1c',
        marginBottom: 8,
    },
    errorText: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 16,
        maxWidth: 400,
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563eb',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        minHeight: 44,
    },
    retryBtnText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 14,
    },
});

export default OTSurgeonsPage;
