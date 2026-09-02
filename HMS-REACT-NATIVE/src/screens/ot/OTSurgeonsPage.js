import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { doctorAPI, otAPI } from '../../utils/api';
import OTHeader from './OTHeader';

const { width } = Dimensions.get('window');

const OTSurgeonsPage = () => {
    const navigation = useNavigation();
    const [doctors, setDoctors] = useState([]);
    const [surgeries, setSurgeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchSurgeonsData = useCallback(async () => {
        setLoading(true);
        try {
            const docsRes = await doctorAPI.getDoctors().catch(() => ({ doctors: [] }));
            const schedRes = await otAPI.getScheduledSurgeries().catch(() => ({ surgeries: [] }));
            
            if (docsRes.doctors) setDoctors(docsRes.doctors || []);
            if (schedRes.surgeries) setSurgeries(schedRes.surgeries || []);

            setLastUpdated(new Date());
        } catch (err) {
            console.error('Fetch surgeons error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSurgeonsData();
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

    const isLargeScreen = width > 768;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <OTHeader
                title="OT Surgeons & Surgical Roster"
                subtitle="Active operating surgeons, surgical assistants, caseload distribution, and individual daily schedules."
                lastUpdated={lastUpdated}
                loading={loading}
                onRefresh={fetchSurgeonsData}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
            />

            {filteredSurgeons.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={{ fontSize: 40, marginBottom: 12 }}>👨‍⚕️</Text>
                    <Text style={styles.emptyTitle}>No Surgeons Found</Text>
                    <Text style={styles.emptyText}>No doctors matching your query are currently registered.</Text>
                </View>
            ) : (
                <View style={[styles.grid, !isLargeScreen && { flexDirection: 'column' }]}>
                    {filteredSurgeons.map(surgeon => (
                        <View key={surgeon._id} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={styles.avatar}>
                                    <Text style={{ fontSize: 24 }}>👨‍⚕️</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.docName}>Dr. {surgeon.cleanName}</Text>
                                    <Text style={styles.docSpec}>{surgeon.specialization || surgeon.department || 'General Surgery'}</Text>
                                </View>
                            </View>

                            <View style={styles.statsGrid}>
                                <View style={styles.statBox}>
                                    <Text style={styles.statLabel}>Today's Surgeries</Text>
                                    <Text style={[styles.statValue, { color: surgeon.todayCount > 0 ? '#2563eb' : '#64748b' }]}>{surgeon.todayCount}</Text>
                                </View>
                                <View style={styles.statBox}>
                                    <Text style={styles.statLabel}>Upcoming</Text>
                                    <Text style={[styles.statValue, { color: surgeon.upcomingCount > 0 ? '#7c3aed' : '#64748b' }]}>{surgeon.upcomingCount}</Text>
                                </View>
                            </View>

                            {surgeon.todayCases.length > 0 && (
                                <View style={styles.caseList}>
                                    <Text style={styles.caseListTitle}>TODAY'S CASE LIST:</Text>
                                    {surgeon.todayCases.map((c, idx) => (
                                        <View key={idx} style={styles.caseItem}>
                                            <Text style={styles.caseItemText}>• <Text style={{fontWeight: 'bold'}}>{c.surgery}</Text> at {c.startTime || '--:--'} ({c.otRoomId?.name || 'OT'})</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View style={styles.cardActions}>
                                <TouchableOpacity onPress={() => navigation.navigate('OTSchedulePage')} style={styles.viewScheduleBtn}>
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
    contentContainer: { padding: 16 },
    emptyState: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 60, alignItems: 'center' },
    emptyTitle: { marginVertical: 6, color: '#1e293b', fontSize: 18, fontWeight: '700' },
    emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    card: { flex: 1, minWidth: 320, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eff6ff', borderWidth: 1.5, borderColor: '#bfdbfe', justifyContent: 'center', alignItems: 'center' },
    docName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    docSpec: { fontSize: 12, fontWeight: '700', color: '#2563eb' },
    statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    statBox: { flex: 1, backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
    statLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
    statValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
    caseList: { marginBottom: 12 },
    caseListTitle: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 6 },
    caseItem: { backgroundColor: '#f8fafc', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 4 },
    caseItemText: { fontSize: 12, color: '#334155' },
    cardActions: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    viewScheduleBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8 },
    viewScheduleBtnText: { fontSize: 13, fontWeight: '700', color: '#1d4ed8' }
});

export default OTSurgeonsPage;
