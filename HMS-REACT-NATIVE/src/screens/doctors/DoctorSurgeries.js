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
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { referralAPI, otAPI } from '../../utils/api';

const DoctorSurgeries = ({ defaultTab = 'referrals' }) => {
    const navigation = useNavigation();
    const route = useRoute();
    const { width } = useWindowDimensions();
    const isMobile = width > 0 ? width < 768 : false;

    const initialTab = route.params?.tab || defaultTab || 'referrals';
    const [activeTab, setActiveTab] = useState(
        initialTab === 'plans' || initialTab === 'surgery_plans' ? 'plans' : 'referrals'
    );

    // ─── Referrals State ───
    const [referrals, setReferrals] = useState([]);
    const [loadingReferrals, setLoadingReferrals] = useState(true);
    const [searchReferrals, setSearchReferrals] = useState('');
    const [statusFilterReferrals, setStatusFilterReferrals] = useState('all');

    // ─── Plans State ───
    const [surgeryPlans, setSurgeryPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [searchPlans, setSearchPlans] = useState('');
    const [statusFilterPlans, setStatusFilterPlans] = useState('all');

    const [refreshing, setRefreshing] = useState(false);

    const fetchReferrals = useCallback(async () => {
        try {
            const res = await referralAPI.getMyReferrals();
            if (res && res.success && Array.isArray(res.referrals)) {
                setReferrals(res.referrals);
            } else if (res && Array.isArray(res)) {
                setReferrals(res);
            } else {
                setReferrals([]);
            }
        } catch (err) {
            console.error('Error fetching surgery referrals:', err);
            setReferrals([]);
        } finally {
            setLoadingReferrals(false);
        }
    }, []);

    const fetchSurgeryPlans = useCallback(async () => {
        try {
            const res = await otAPI.getMySurgeryPlans();
            if (res && res.success && Array.isArray(res.data)) {
                setSurgeryPlans(res.data);
            } else if (res && Array.isArray(res)) {
                setSurgeryPlans(res);
            } else {
                setSurgeryPlans([]);
            }
        } catch (err) {
            console.error('Error fetching surgery plans:', err);
            setSurgeryPlans([]);
        } finally {
            setLoadingPlans(false);
        }
    }, []);

    const fetchAll = useCallback(async (isPull = false) => {
        if (isPull) setRefreshing(true);
        await Promise.all([fetchReferrals(), fetchSurgeryPlans()]);
        if (isPull) setRefreshing(false);
    }, [fetchReferrals, fetchSurgeryPlans]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // Filter referrals
    const filteredReferrals = useMemo(() => {
        const qRef = searchReferrals.toLowerCase().trim();
        return referrals.filter(ref => {
            const pName = ref.patientId?.name || '';
            const pMrn = ref.patientId?.mrn || ref.patientId?.patientId || '';
            const docName = ref.referringDoctorId?.name || '';
            const reason = ref.reason || '';

            const matchesQuery = !qRef || (
                pName.toLowerCase().includes(qRef) ||
                pMrn.toLowerCase().includes(qRef) ||
                docName.toLowerCase().includes(qRef) ||
                reason.toLowerCase().includes(qRef)
            );

            const status = (ref.status || '').toLowerCase();
            const matchesStatus = statusFilterReferrals === 'all' || status === statusFilterReferrals.toLowerCase();

            return matchesQuery && matchesStatus;
        });
    }, [referrals, searchReferrals, statusFilterReferrals]);

    // Filter plans
    const filteredPlans = useMemo(() => {
        const qPlan = searchPlans.toLowerCase().trim();
        return surgeryPlans.filter(sp => {
            const surgery = sp.surgery || '';
            const planId = sp.planId || '';
            const pName = sp.patientId?.name || '';
            const pMrn = sp.patientId?.mrn || '';
            const dx = sp.diagnosis || '';
            const otName = sp.otRoomId?.name || '';

            const matchesQuery = !qPlan || (
                surgery.toLowerCase().includes(qPlan) ||
                planId.toLowerCase().includes(qPlan) ||
                pName.toLowerCase().includes(qPlan) ||
                pMrn.toLowerCase().includes(qPlan) ||
                dx.toLowerCase().includes(qPlan) ||
                otName.toLowerCase().includes(qPlan)
            );

            const status = (sp.status || '').toLowerCase();
            const matchesStatus = statusFilterPlans === 'all' || status === statusFilterPlans.toLowerCase();

            return matchesQuery && matchesStatus;
        });
    }, [surgeryPlans, searchPlans, statusFilterPlans]);

    const handleViewProfile = (item) => {
        const patientId = item.patientId?._id || item.patientId?.id || item.patientId;
        if (patientId) {
            navigation.navigate('DoctorPatientDetails', {
                patientId,
                referralId: item._id,
                referral: item
            });
        }
    };

    const currentDate = new Date();
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const getUrgencyBadge = (urgency) => {
        const u = (urgency || 'ROUTINE').toUpperCase();
        if (u === 'EMERGENCY') return { bg: '#fee2e2', color: '#dc2626' };
        if (u === 'URGENT') return { bg: '#fef3c7', color: '#d97706' };
        return { bg: '#e0f2fe', color: '#0284c7' };
    };

    const getStatusBadge = (status) => {
        const s = (status || 'planned').toLowerCase();
        if (s === 'completed' || s === 'surgery_completed') return { bg: '#dcfce7', color: '#16a34a' };
        if (s === 'in_ot' || s === 'in-progress') return { bg: '#fef3c7', color: '#d97706' };
        if (s === 'cancelled' || s === 'declined') return { bg: '#fee2e2', color: '#dc2626' };
        if (s === 'admitted' || s === 'scheduled') return { bg: '#e0f2fe', color: '#0284c7' };
        return { bg: '#f1f5f9', color: '#475569' };
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => fetchAll(true)}
                    colors={['#0d9488']}
                    tintColor="#0d9488"
                />
            }
            showsVerticalScrollIndicator={false}
        >
            {/* 1. Header Banner */}
            <View style={[styles.modernBanner, isMobile && styles.modernBannerMobile]}>
                <View style={[styles.bannerLeft, isMobile && { minWidth: 0, width: '100%' }]}>
                    <View style={styles.titleRow}>
                        <Text style={styles.exactTitle}>Surgeries</Text>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>DOCTOR</Text>
                        </View>
                        <View style={styles.countPill}>
                            <Text style={styles.countPillText}>
                                {activeTab === 'referrals' ? `${referrals.length} Referrals` : `${surgeryPlans.length} Plans`}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.exactSubtitle}>
                        Comprehensive surgery console: review incoming consultation referrals, formulate surgical plans, and track operational OT procedures.
                    </Text>
                </View>

                <View style={[styles.bannerRight, isMobile && { width: '100%', justifyContent: 'flex-start', marginTop: 8 }]}>
                    <View style={styles.dateCard}>
                        <View style={styles.dateIconWrap}>
                            <Feather name="calendar" size={15} color="#0d9488" />
                        </View>
                        <View style={styles.dateInfo}>
                            <Text style={styles.dateDay}>{dayName}</Text>
                            <Text style={styles.dateFull}>{formattedDate}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* 2. TAB SELECTOR STRIP */}
            <View style={styles.tabStrip}>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'referrals' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('referrals')}
                    activeOpacity={0.8}
                >
                    <Feather name="scissors" size={15} color={activeTab === 'referrals' ? '#ffffff' : '#64748b'} />
                    <Text style={[styles.tabBtnText, activeTab === 'referrals' && styles.tabBtnTextActive]}>
                        Surgery Referrals
                    </Text>
                    <View style={[styles.tabBadge, activeTab === 'referrals' && styles.tabBadgeActive]}>
                        <Text style={[styles.tabBadgeText, activeTab === 'referrals' && styles.tabBadgeTextActive]}>
                            {referrals.length}
                        </Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'plans' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('plans')}
                    activeOpacity={0.8}
                >
                    <Feather name="file-text" size={15} color={activeTab === 'plans' ? '#ffffff' : '#64748b'} />
                    <Text style={[styles.tabBtnText, activeTab === 'plans' && styles.tabBtnTextActive]}>
                        My Surgery Plans
                    </Text>
                    <View style={[styles.tabBadge, activeTab === 'plans' && styles.tabBadgeActive]}>
                        <Text style={[styles.tabBadgeText, activeTab === 'plans' && styles.tabBadgeTextActive]}>
                            {surgeryPlans.length}
                        </Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* 3. TAB CONTENT */}
            {activeTab === 'referrals' ? (
                <View style={styles.sectionBlock}>
                    {/* Toolbar */}
                    <View style={styles.toolbarCard}>
                        <View style={styles.searchPillContainer}>
                            <Feather name="search" size={15} color="#64748b" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by patient name, MRN, referring doctor..."
                                placeholderTextColor="#94a3b8"
                                value={searchReferrals}
                                onChangeText={setSearchReferrals}
                            />
                            {Boolean(searchReferrals) && (
                                <TouchableOpacity onPress={() => setSearchReferrals('')}>
                                    <Feather name="x" size={14} color="#64748b" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Status Filters */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                            {['all', 'pending', 'accepted', 'declined', 'planned'].map((status) => (
                                <TouchableOpacity
                                    key={status}
                                    style={[styles.filterPill, statusFilterReferrals === status && styles.filterPillActive]}
                                    onPress={() => setStatusFilterReferrals(status)}
                                >
                                    <Text style={[styles.filterPillText, statusFilterReferrals === status && styles.filterPillTextActive]}>
                                        {status.toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Referrals Cards */}
                    {loadingReferrals ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color="#0d9488" />
                            <Text style={styles.loadingText}>Loading surgery referrals...</Text>
                        </View>
                    ) : filteredReferrals.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Feather name="inbox" size={44} color="#cbd5e1" />
                            <Text style={styles.emptyTitle}>No surgery referrals found</Text>
                            <Text style={styles.emptySubtitle}>All incoming surgical consultation referrals will appear here.</Text>
                        </View>
                    ) : (
                        <View style={styles.cardsList}>
                            {filteredReferrals.map((ref) => {
                                const urg = getUrgencyBadge(ref.urgency);
                                const stat = getStatusBadge(ref.status);
                                return (
                                    <View key={ref._id} style={styles.surgeryCard}>
                                        <View style={styles.cardHeaderRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.cardMainTitle}>
                                                    {ref.patientId?.name || 'Patient'}
                                                </Text>
                                                <Text style={styles.cardSubMeta}>
                                                    MRN: {ref.patientId?.mrn || ref.patientId?.patientId || '—'} • {ref.patientId?.age ? `${ref.patientId.age}y` : ''} {ref.patientId?.gender || ''}
                                                </Text>
                                            </View>
                                            <View style={styles.badgesCol}>
                                                <View style={[styles.badgePill, { backgroundColor: urg.bg }]}>
                                                    <Text style={[styles.badgePillText, { color: urg.color }]}>
                                                        {ref.urgency || 'ROUTINE'}
                                                    </Text>
                                                </View>
                                                <View style={[styles.badgePill, { backgroundColor: stat.bg, marginTop: 4 }]}>
                                                    <Text style={[styles.badgePillText, { color: stat.color }]}>
                                                        {ref.status || 'Pending'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>

                                        <View style={styles.cardDivider} />

                                        <View style={styles.cardDetailGrid}>
                                            <View style={styles.detailItem}>
                                                <Text style={styles.detailLabel}>Referring Doctor</Text>
                                                <Text style={styles.detailValue}>
                                                    {ref.referringDoctorId?.name ? `Dr. ${ref.referringDoctorId.name.replace(/^Dr\.?\s*/i, '')}` : 'OPD Doctor'}
                                                </Text>
                                            </View>
                                            <View style={styles.detailItem}>
                                                <Text style={styles.detailLabel}>Specialty / Dept</Text>
                                                <Text style={styles.detailValue}>{ref.targetSpecialty || ref.department || 'Surgery'}</Text>
                                            </View>
                                            <View style={[styles.detailItem, { width: '100%' }]}>
                                                <Text style={styles.detailLabel}>Clinical Indication / Reason</Text>
                                                <Text style={styles.detailValue} numberOfLines={2}>
                                                    {ref.reason || ref.clinicalSummary || 'Consultation for surgical evaluation'}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.cardFooterRow}>
                                            <Text style={styles.dateFooterText}>
                                                📅 {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString('en-GB') : 'Today'}
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.actionBtnPrimary}
                                                onPress={() => handleViewProfile(ref)}
                                                activeOpacity={0.8}
                                            >
                                                <Feather name="arrow-right" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                                                <Text style={styles.actionBtnPrimaryText}>Review & Plan</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            ) : (
                <View style={styles.sectionBlock}>
                    {/* Toolbar */}
                    <View style={styles.toolbarCard}>
                        <View style={styles.searchPillContainer}>
                            <Feather name="search" size={15} color="#64748b" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by procedure, plan ID, patient, OT room..."
                                placeholderTextColor="#94a3b8"
                                value={searchPlans}
                                onChangeText={setSearchPlans}
                            />
                            {Boolean(searchPlans) && (
                                <TouchableOpacity onPress={() => setSearchPlans('')}>
                                    <Feather name="x" size={14} color="#64748b" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Status Filters */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                            {['all', 'PLANNED', 'SCHEDULED', 'ADMITTED', 'IN_OT', 'POST_OP', 'SURGERY_COMPLETED', 'CANCELLED'].map((status) => (
                                <TouchableOpacity
                                    key={status}
                                    style={[styles.filterPill, statusFilterPlans.toLowerCase() === status.toLowerCase() && styles.filterPillActive]}
                                    onPress={() => setStatusFilterPlans(status)}
                                >
                                    <Text style={[styles.filterPillText, statusFilterPlans.toLowerCase() === status.toLowerCase() && styles.filterPillTextActive]}>
                                        {status.replace('_', ' ')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Plans Cards */}
                    {loadingPlans ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color="#0d9488" />
                            <Text style={styles.loadingText}>Loading surgery plans...</Text>
                        </View>
                    ) : filteredPlans.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Feather name="file-text" size={44} color="#cbd5e1" />
                            <Text style={styles.emptyTitle}>No surgery plans found</Text>
                            <Text style={styles.emptySubtitle}>Formulated surgical plans will appear here once planned.</Text>
                        </View>
                    ) : (
                        <View style={styles.cardsList}>
                            {filteredPlans.map((sp) => {
                                const stat = getStatusBadge(sp.status);
                                return (
                                    <View key={sp._id} style={styles.surgeryCard}>
                                        <View style={styles.cardHeaderRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.cardMainTitle}>
                                                    {sp.surgery || 'Surgical Procedure'}
                                                </Text>
                                                <Text style={styles.cardSubMeta}>
                                                    Plan: {sp.planId || 'PLAN-AUTO'} • Patient: {sp.patientId?.name || 'Patient'} (MRN: {sp.patientId?.mrn || '—'})
                                                </Text>
                                            </View>
                                            <View style={[styles.badgePill, { backgroundColor: stat.bg }]}>
                                                <Text style={[styles.badgePillText, { color: stat.color }]}>
                                                    {sp.status || 'PLANNED'}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.cardDivider} />

                                        <View style={styles.cardDetailGrid}>
                                            <View style={styles.detailItem}>
                                                <Text style={styles.detailLabel}>OT Suite</Text>
                                                <Text style={styles.detailValue}>🚪 {sp.otRoomId?.name || 'TBD'}</Text>
                                            </View>
                                            <View style={styles.detailItem}>
                                                <Text style={styles.detailLabel}>Scheduled Date & Time</Text>
                                                <Text style={styles.detailValue}>
                                                    📅 {sp.surgeryDate || 'Flexible'} {sp.startTime ? `(${sp.startTime})` : ''}
                                                </Text>
                                            </View>
                                            {Boolean(sp.diagnosis) && (
                                                <View style={[styles.detailItem, { width: '100%' }]}>
                                                    <Text style={styles.detailLabel}>Diagnosis</Text>
                                                    <Text style={styles.detailValue}>{sp.diagnosis}</Text>
                                                </View>
                                            )}
                                        </View>

                                        <View style={styles.cardFooterRow}>
                                            <Text style={styles.dateFooterText}>
                                                Primary Surgeon: {sp.surgeonId?.name ? `Dr. ${sp.surgeonId.name.replace(/^Dr\.?\s*/i, '')}` : 'You'}
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.actionBtnOutline}
                                                onPress={() => handleViewProfile(sp)}
                                                activeOpacity={0.8}
                                            >
                                                <Feather name="user" size={13} color="#0d9488" style={{ marginRight: 5 }} />
                                                <Text style={styles.actionBtnOutlineText}>View Profile</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
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
    contentContainer: {
        padding: 16,
        paddingBottom: 40,
    },
    modernBanner: {
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
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    modernBannerMobile: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: 16,
    },
    bannerLeft: {
        flex: 1,
        minWidth: 200,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 6,
    },
    exactTitle: {
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
        backgroundColor: '#ccfbf1',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 9999,
    },
    countPillText: {
        color: '#0d9488',
        fontSize: 11,
        fontWeight: '700',
    },
    exactSubtitle: {
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
        maxWidth: '100%',
        flexShrink: 1,
    },
    dateIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#f0fdfa',
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
    tabStrip: {
        flexDirection: 'row',
        gap: 10,
        backgroundColor: '#ffffff',
        padding: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 16,
        alignSelf: 'flex-start',
        flexWrap: 'wrap',
    },
    tabBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: 'transparent',
    },
    tabBtnActive: {
        backgroundColor: '#0d9488',
    },
    tabBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
    },
    tabBtnTextActive: {
        color: '#ffffff',
    },
    tabBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
    },
    tabBadgeActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    tabBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
    },
    tabBadgeTextActive: {
        color: '#ffffff',
    },
    sectionBlock: {
        width: '100%',
    },
    toolbarCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 10,
        marginBottom: 16,
        gap: 10,
    },
    searchPillContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 12,
        minHeight: 38,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
        paddingVertical: 6,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 4,
    },
    filterPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    filterPillActive: {
        backgroundColor: '#0d9488',
        borderColor: '#0d9488',
    },
    filterPillText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#475569',
    },
    filterPillTextActive: {
        color: '#ffffff',
    },
    cardsList: {
        gap: 12,
    },
    surgeryCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 10,
    },
    cardMainTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
    },
    cardSubMeta: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    badgesCol: {
        alignItems: 'flex-end',
    },
    badgePill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    badgePillText: {
        fontSize: 10.5,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    cardDivider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 12,
    },
    cardDetailGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    detailItem: {
        flex: 1,
        minWidth: 140,
    },
    detailLabel: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    detailValue: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#334155',
        marginTop: 2,
    },
    cardFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
        flexWrap: 'wrap',
        gap: 10,
    },
    dateFooterText: {
        fontSize: 11.5,
        color: '#64748b',
        fontWeight: '500',
    },
    actionBtnPrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0d9488',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8,
    },
    actionBtnPrimaryText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    actionBtnOutline: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdfa',
        borderWidth: 1,
        borderColor: '#99f6e4',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    actionBtnOutlineText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0d9488',
    },
    loadingBox: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 13,
        color: '#64748b',
    },
    emptyCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
        marginTop: 12,
    },
    emptySubtitle: {
        fontSize: 12.5,
        color: '#64748b',
        marginTop: 4,
        textAlign: 'center',
    },
});

export default DoctorSurgeries;
