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
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { referralAPI } from '../../utils/api';

const SurgeryReferrals = () => {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isMobile = width > 0 ? width < 768 : false;

    const [referrals, setReferrals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchReferrals = useCallback(async (isPull = false) => {
        if (isPull) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        try {
            const res = await referralAPI.getMyReferrals();
            if (res && res.success && Array.isArray(res.referrals)) {
                setReferrals(res.referrals);
            } else {
                setReferrals([]);
            }
        } catch (err) {
            console.error('Error fetching surgery referrals:', err);
            setReferrals([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchReferrals();
    }, [fetchReferrals]);

    const q = searchQuery.toLowerCase().trim();
    const filtered = useMemo(() => {
        return referrals.filter(ref => {
            const pName = ref.patientId?.name || '';
            const pMrn = ref.patientId?.mrn || ref.patientId?.patientId || '';
            const docName = ref.referringDoctorId?.name || '';
            const reason = ref.reason || '';

            const matchesQuery = !q || (
                pName.toLowerCase().includes(q) ||
                pMrn.toLowerCase().includes(q) ||
                docName.toLowerCase().includes(q) ||
                reason.toLowerCase().includes(q)
            );

            const status = (ref.status || '').toLowerCase();
            const matchesStatus = statusFilter === 'all' || status === statusFilter.toLowerCase();

            return matchesQuery && matchesStatus;
        });
    }, [referrals, q, statusFilter]);

    const currentDate = new Date();
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const getStatusStyle = (status) => {
        const s = (status || 'pending').toLowerCase();
        switch (s) {
            case 'completed':
                return { bg: '#dbeafe', color: '#2563eb' };
            case 'confirmed':
            case 'accepted':
                return { bg: '#dcfce7', color: '#16a34a' };
            case 'cancelled':
            case 'rejected':
                return { bg: '#fee2e2', color: '#dc2626' };
            case 'pending':
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
                    onRefresh={() => fetchReferrals(true)}
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
                        <Text style={styles.bannerTitle}>Surgery Referrals</Text>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>DOCTOR</Text>
                        </View>
                        <View style={styles.countPill}>
                            <Text style={styles.countPillText}>{referrals.length} Total</Text>
                        </View>
                    </View>
                    <Text style={styles.bannerSubtitle}>
                        Review consultation surgery referrals assigned to you, assess clinical indications, and formulate surgical plans.
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
                        placeholder="Search patient, MRN, referring doctor, or indication..."
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
                        {['all', 'pending', 'confirmed', 'completed'].map(st => {
                            const isActive = statusFilter === st;
                            return (
                                <TouchableOpacity
                                    key={st}
                                    style={[styles.statusFilterBtn, isActive && styles.statusFilterBtnActive]}
                                    onPress={() => setStatusFilter(st)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.statusFilterBtnText, isActive && styles.statusFilterBtnTextActive]}>
                                        {st === 'all' ? 'All Referrals' : st.charAt(0).toUpperCase() + st.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.refreshBtn, loading && styles.refreshBtnDisabled]}
                        onPress={() => fetchReferrals()}
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
                        <Feather name="scissors" size={16} color="#0f172a" style={{ marginRight: 8 }} />
                        <Text style={styles.tableHeaderTitle}>
                            Surgery Referrals Assigned to You ({filtered.length})
                        </Text>
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0284c7" />
                        <Text style={styles.loadingText}>Loading surgery referrals...</Text>
                    </View>
                ) : filtered.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyEmoji}>✂️</Text>
                        <Text style={styles.emptyTitle}>No Surgery Referrals Found</Text>
                        <Text style={styles.emptySubtitle}>
                            {searchQuery || statusFilter !== 'all'
                                ? 'No referrals matched your filter criteria.'
                                : 'There are currently no surgery referrals assigned to you.'}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.referralsList}>
                        {filtered.map(ref => {
                            const pid = ref.patientId?.patientId || ref.patientId?.mrn || ref.patientId?._id;
                            const status = (ref.status || 'pending').toLowerCase();
                            const stStyle = getStatusStyle(status);
                            const refDate = ref.referralDate
                                ? new Date(ref.referralDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '—';

                            return (
                                <View key={ref._id} style={styles.referralCard}>
                                    <View style={styles.referralCardTop}>
                                        <View style={styles.patientInfoCol}>
                                            <Text style={styles.patientName}>{ref.patientId?.name || 'Unknown Patient'}</Text>
                                            <Text style={styles.patientMrn}>MRN: {ref.patientId?.mrn || ref.patientId?.patientId || '—'}</Text>
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: stStyle.bg }]}>
                                            <Text style={[styles.statusBadgeText, { color: stStyle.color }]}>
                                                {ref.status || 'Pending'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.detailsGrid}>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Referred By:</Text>
                                            <Text style={styles.detailVal}>{ref.referringDoctorId?.name || 'Clinical Staff'}</Text>
                                        </View>
                                        <View style={styles.detailItem}>
                                            <Text style={styles.detailLabel}>Referral Date:</Text>
                                            <Text style={styles.detailVal}>{refDate}</Text>
                                        </View>
                                        <View style={[styles.detailItem, { width: '100%' }]}>
                                            <Text style={styles.detailLabel}>Clinical Reason:</Text>
                                            <Text style={styles.detailValHighlight}>{ref.reason || 'Surgical Evaluation'}</Text>
                                        </View>
                                        {Boolean(ref.notes) && (
                                            <View style={[styles.detailItem, { width: '100%' }]}>
                                                <Text style={styles.detailLabel}>Clinical Notes:</Text>
                                                <Text style={styles.detailVal}>{ref.notes}</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.referralCardFooter}>
                                        <TouchableOpacity
                                            style={styles.reviewPlanBtn}
                                            activeOpacity={0.85}
                                            onPress={() => {
                                                navigation.navigate('DoctorPatientDetails', {
                                                    id: pid || ref._id,
                                                    patientId: pid || ref._id,
                                                    referralId: ref._id,
                                                    referral: ref
                                                });
                                            }}
                                        >
                                            <Text style={styles.reviewPlanBtnText}>Review & Plan</Text>
                                            <Feather name="arrow-right" size={13} color="#ffffff" style={{ marginLeft: 6 }} />
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
    referralsList: {
        padding: 12,
        gap: 12,
    },
    referralCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 14,
        gap: 10,
    },
    referralCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    patientInfoCol: {
        flex: 1,
        marginRight: 10,
    },
    patientName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    patientMrn: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 2,
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
    detailValHighlight: {
        fontSize: 12,
        color: '#0f172a',
        fontWeight: '700',
    },
    referralCardFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingTop: 4,
    },
    reviewPlanBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0284c7',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    reviewPlanBtnText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#ffffff',
    },
});

export default SurgeryReferrals;
