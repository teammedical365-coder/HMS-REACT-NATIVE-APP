import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    useWindowDimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { otAPI } from '../../utils/api';

const MySurgeryPlans = () => {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isMobile = width > 0 ? width < 768 : false;

    const [surgeryPlans, setSurgeryPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchSurgeryPlans = useCallback(async (isPull = false) => {
        if (isPull) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        try {
            const res = await otAPI.getMySurgeryPlans();
            if (res && res.success && Array.isArray(res.data)) {
                setSurgeryPlans(res.data);
            } else {
                setSurgeryPlans([]);
            }
        } catch (err) {
            console.error('Error fetching surgery plans:', err);
            setSurgeryPlans([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchSurgeryPlans();
    }, [fetchSurgeryPlans]);

    const q = searchQuery.toLowerCase().trim();
    const filtered = useMemo(() => {
        return surgeryPlans.filter(sp => {
            const surgery = sp.surgery || '';
            const planId = sp.planId || '';
            const pName = sp.patientId?.name || '';
            const pMrn = sp.patientId?.mrn || '';
            const dx = sp.diagnosis || '';
            const otName = sp.otRoomId?.name || '';

            const matchesQuery = !q || (
                surgery.toLowerCase().includes(q) ||
                planId.toLowerCase().includes(q) ||
                pName.toLowerCase().includes(q) ||
                pMrn.toLowerCase().includes(q) ||
                dx.toLowerCase().includes(q) ||
                otName.toLowerCase().includes(q)
            );

            const status = (sp.status || '').toLowerCase();
            const matchesStatus = statusFilter === 'all' || status === statusFilter.toLowerCase();

            return matchesQuery && matchesStatus;
        });
    }, [surgeryPlans, q, statusFilter]);

    const handleViewProfile = (sp) => {
        const targetId = sp.patientId?._id || sp.patientId?.patientId || sp.patientId?.mrn || sp._id;
        const dept = sp.department || 'Surgery';
        if (targetId) {
            navigation.navigate('UnifiedPatientProfile', {
                id: targetId,
                patientId: targetId,
                department: dept
            });
        }
    };

    const currentDate = new Date();
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const getStatusStyle = (status) => {
        const s = (status || 'planned').toLowerCase();
        switch (s) {
            case 'completed':
                return { bg: '#dbeafe', color: '#2563eb' };
            case 'scheduled':
                return { bg: '#dcfce7', color: '#16a34a' };
            case 'cancelled':
                return { bg: '#fee2e2', color: '#dc2626' };
            case 'planned':
            default:
                return { bg: '#fef3c7', color: '#b45309' };
        }
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => fetchSurgeryPlans(true)}
                    colors={['#0284c7']}
                    tintColor="#0284c7"
                />
            }
            showsVerticalScrollIndicator={false}
        >
            {/* Header Banner */}
            <View style={styles.bannerCard}>
                <View style={styles.bannerLeft}>
                    <View style={styles.titleRow}>
                        <Text style={styles.bannerTitle}>My Surgery Plans</Text>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>DOCTOR</Text>
                        </View>
                        <View style={styles.countPill}>
                            <Text style={styles.countPillText}>{surgeryPlans.length} Plans</Text>
                        </View>
                    </View>
                    <Text style={styles.bannerSubtitle}>
                        Track planned surgical procedures, OT suite bookings, surgical teams, and patient operational status.
                    </Text>
                </View>

                <View style={styles.bannerRight}>
                    <View style={styles.dateCard}>
                        <View style={styles.dateIconWrap}>
                            <Feather name="calendar" size={16} color="#0284c7" />
                        </View>
                        <View style={styles.dateInfo}>
                            <Text style={styles.dateDay}>{dayName}</Text>
                            <Text style={styles.dateFull}>{formattedDate}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Filter & Search Toolbar */}
            <View style={styles.toolbarCard}>
                <View style={styles.searchPillContainer}>
                    <Feather name="search" size={16} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search procedure, plan ID, patient name, or OT room..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                            <Feather name="x" size={13} color="#64748b" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.filterRightActions}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusPillsRow}>
                        {['all', 'planned', 'scheduled', 'completed', 'cancelled'].map(st => {
                            const isActive = statusFilter === st;
                            return (
                                <TouchableOpacity
                                    key={st}
                                    style={[styles.statusFilterBtn, isActive && styles.statusFilterBtnActive]}
                                    onPress={() => setStatusFilter(st)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.statusFilterBtnText, isActive && styles.statusFilterBtnTextActive]}>
                                        {st === 'all' ? 'All Plans' : st.charAt(0).toUpperCase() + st.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.refreshBtn, loading && styles.refreshBtnDisabled]}
                        onPress={() => fetchSurgeryPlans()}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        <Feather name="refresh-cw" size={13} color="#334155" />
                        <Text style={styles.refreshBtnText}>Refresh</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Table / List Card Wrapper */}
            <View style={styles.tableCardWrapper}>
                <View style={styles.tableHeaderBar}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Feather name="file-text" size={16} color="#0f172a" style={{ marginRight: 8 }} />
                        <Text style={styles.tableHeaderTitle}>
                            My Surgery Plans & OT Status ({filtered.length})
                        </Text>
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0284c7" />
                        <Text style={styles.loadingText}>Loading surgery plans...</Text>
                    </View>
                ) : filtered.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyEmoji}>📋</Text>
                        <Text style={styles.emptyTitle}>No Surgery Plans Found</Text>
                        <Text style={styles.emptySubtitle}>
                            {searchQuery || statusFilter !== 'all'
                                ? 'No surgery plans matched your filter criteria.'
                                : 'No surgery plans have been scheduled yet.'}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.plansList}>
                        {filtered.map(sp => {
                            const status = (sp.status || 'planned').toLowerCase();
                            const stStyle = getStatusStyle(status);

                            return (
                                <View key={sp._id} style={styles.planCard}>
                                    <View style={styles.planCardTop}>
                                        <View style={styles.procedureInfoCol}>
                                            <Text style={styles.procedureName}>{sp.surgery || 'Surgical Procedure'}</Text>
                                            <View style={styles.planBadge}>
                                                <Text style={styles.planBadgeText}>{sp.planId || 'PLAN-AUTO'}</Text>
                                            </View>
                                            {Boolean(sp.diagnosis) && (
                                                <Text style={styles.diagnosisText}>Dx: {sp.diagnosis}</Text>
                                            )}
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: stStyle.bg }]}>
                                            <Text style={[styles.statusBadgeText, { color: stStyle.color }]}>
                                                {sp.status || 'Planned'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.detailsGrid}>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Patient:</Text>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.detailValBold}>{sp.patientId?.name || 'Patient'}</Text>
                                                <Text style={styles.detailValMuted}>MRN: {sp.patientId?.mrn || sp.patientId?.patientId || '—'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Referring Doctor:</Text>
                                            <Text style={styles.detailVal}>{sp.referringDoctorId?.name || 'Self-Planned'}</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>OT Suite:</Text>
                                            <Text style={styles.detailValBold}>🚪 {sp.otRoomId?.name || 'OT Suite TBD'}</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Schedule:</Text>
                                            <Text style={styles.detailVal}>
                                                📅 {sp.surgeryDate || 'Flexible'} {sp.startTime ? `(${sp.startTime} - ${sp.endTime || '--:--'})` : ''}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.planCardFooter}>
                                        <TouchableOpacity
                                            style={styles.viewProfileBtn}
                                            activeOpacity={0.85}
                                            onPress={() => handleViewProfile(sp)}
                                        >
                                            <Feather name="user" size={13} color="#2563eb" style={{ marginRight: 6 }} />
                                            <Text style={styles.viewProfileBtnText}>View Profile</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40,
    },
    bannerCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        padding: 20,
        marginBottom: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    bannerLeft: {
        flex: 1,
        minWidth: 260,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 6,
    },
    bannerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    roleBadge: {
        backgroundColor: '#ccfbf1',
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 9999,
    },
    roleBadgeText: {
        color: '#0f766e',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    countPill: {
        backgroundColor: '#e0f2fe',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 9999,
    },
    countPillText: {
        color: '#0284c7',
        fontSize: 11,
        fontWeight: '700',
    },
    bannerSubtitle: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
    },
    bannerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    dateIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#f0f9ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateInfo: {
        flexDirection: 'column',
    },
    dateDay: {
        fontSize: 10.5,
        color: '#64748b',
        fontWeight: '600',
    },
    dateFull: {
        fontSize: 12.5,
        color: '#0f172a',
        fontWeight: '700',
    },
    toolbarCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 12,
        marginBottom: 18,
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    searchPillContainer: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 12,
        minHeight: 40,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 13.5,
        color: '#0f172a',
        paddingVertical: 6,
    },
    clearBtn: {
        padding: 4,
        borderRadius: 999,
        backgroundColor: '#f1f5f9',
    },
    filterRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
    },
    statusPillsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 2,
    },
    statusFilterBtn: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 9999,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    statusFilterBtnActive: {
        backgroundColor: '#0284c7',
        borderColor: '#0284c7',
    },
    statusFilterBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    statusFilterBtnTextActive: {
        color: '#ffffff',
    },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
    },
    refreshBtnDisabled: {
        opacity: 0.6,
    },
    refreshBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
    },
    tableCardWrapper: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    tableHeaderBar: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tableHeaderTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    loadingContainer: {
        padding: 48,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 13,
        color: '#64748b',
    },
    emptyContainer: {
        padding: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyEmoji: {
        fontSize: 36,
        marginBottom: 10,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        maxWidth: 320,
    },
    plansList: {
        padding: 12,
        gap: 12,
    },
    planCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 14,
        gap: 10,
    },
    planCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    procedureInfoCol: {
        flex: 1,
        marginRight: 10,
    },
    procedureName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    planBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginTop: 4,
    },
    planBadgeText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#475569',
    },
    diagnosisText: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 3,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 9999,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    detailsGrid: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 9,
        padding: 10,
        gap: 6,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
    },
    detailLabel: {
        fontSize: 11.5,
        color: '#64748b',
        fontWeight: '600',
    },
    detailVal: {
        fontSize: 12,
        color: '#334155',
        fontWeight: '500',
    },
    detailValBold: {
        fontSize: 12,
        color: '#0f172a',
        fontWeight: '700',
    },
    detailValMuted: {
        fontSize: 11,
        color: '#64748b',
    },
    planCardFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingTop: 4,
    },
    viewProfileBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 8,
    },
    viewProfileBtnText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#2563eb',
    },
});

export default MySurgeryPlans;
