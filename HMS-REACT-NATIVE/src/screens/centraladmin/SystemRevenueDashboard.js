import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, TextInput, 
    StyleSheet, ActivityIndicator, Dimensions, Modal, Pressable,
    useWindowDimensions, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { revenueAPI } from '../../utils/api';

const MODEL_META = {
    per_patient: {
        label: 'Model B — Per Patient',
        short: 'Per Patient',
        color: '#6366f1',
        bg: 'rgba(99,102,241,0.12)',
        border: 'rgba(99,102,241,0.3)',
        icon: '👤',
    },
    fixed_monthly: {
        label: 'Model A — Fixed Monthly',
        short: 'Fixed Monthly',
        color: '#10b981',
        bg: 'rgba(16,185,129,0.12)',
        border: 'rgba(16,185,129,0.3)',
        icon: '📅',
    },
    per_login: {
        label: 'Model C — Per Login',
        short: 'Per Login',
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.12)',
        border: 'rgba(245,158,11,0.3)',
        icon: '🔑',
    },
};

const fmt = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const SystemRevenueDashboard = () => {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1100;
    const isTablet = width >= 768 && width < 1100;
    const isMobile = width < 768;
    const isSmallPhone = width < 480;

    const kpiCardWidth = Platform.select({
        web: isDesktop
            ? 'calc((100% - 48px) / 4)'
            : (isSmallPhone ? '100%' : 'calc((100% - 10px) / 2)'),
        default: isDesktop
            ? '23.5%'
            : (isSmallPhone ? '100%' : '48%'),
    });

    const modelCardWidth = Platform.select({
        web: isDesktop
            ? 'calc((100% - 32px) / 3)'
            : (isTablet ? 'calc((100% - 16px) / 2)' : '100%'),
        default: isDesktop
            ? '31.5%'
            : (isTablet ? '48%' : '100%'),
    });

    const quarterlyCardWidth = Platform.select({
        web: isDesktop
            ? 'calc((100% - 36px) / 4)'
            : (isSmallPhone ? '100%' : 'calc((100% - 10px) / 2)'),
        default: isDesktop
            ? '23%'
            : (isSmallPhone ? '100%' : '48%'),
    });

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeView, setActiveView] = useState('overview'); // overview | hospitals | monthly | quarterly
    const [search, setSearch] = useState('');
    const [filterModel, setFilterModel] = useState('all');
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [currentUser, setCurrentUser] = useState({});

    useEffect(() => {
        loadUser();
        load();
    }, []);

    const loadUser = async () => {
        const u = await AsyncStorage.getItem('user');
        if (u) setCurrentUser(JSON.parse(u));
    };

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await revenueAPI.getSystemAnalytics();
            if (res.success) setData(res);
            else setError(res.message || 'Failed to load analytics');
        } catch (err) {
            setError(err?.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.srdPage}>
                <View style={styles.srdLoader}>
                    <ActivityIndicator size="large" color="#6366f1" />
                    <Text style={{ color: 'rgba(255,255,255,0.6)' }}>Loading revenue analytics…</Text>
                </View>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.srdPage}>
                <View style={styles.srdErrorBox}>
                    <Text style={{ fontSize: 24 }}>⚠️</Text>
                    <Text style={{ color: '#fca5a5' }}>{error}</Text>
                    <TouchableOpacity style={styles.srdErrorBtn} onPress={load}>
                        <Text style={{ color: '#fca5a5' }}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const { summary, monthlyBreakdown = [], quarterlyBreakdown = [], hospitals = [] } = data || {};

    const maxMonthlyTotal = Math.max(...monthlyBreakdown.map(m => m.total), 1);
    const maxQuarterTotal = Math.max(...quarterlyBreakdown.map(q => q.total), 1);

    const filteredHospitals = hospitals.filter(h => {
        const matchSearch = !search || h.name.toLowerCase().includes(search.toLowerCase());
        const matchModel = filterModel === 'all' || h.revenueModel === filterModel;
        return matchSearch && matchModel;
    });

    const annualProjected = monthlyBreakdown.length
        ? (monthlyBreakdown.reduce((s, m) => s + m.total, 0) / monthlyBreakdown.length) * 12
        : 0;

    const quarterlyTotal = quarterlyBreakdown.reduce((s, q) => s + q.total, 0);

    return (
        <ScrollView 
            style={[styles.srdPage, { flex: 1, width: '100%' }]} 
            contentContainerStyle={[styles.srdContainer, isMobile && { padding: 14 }]}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
        >

            {/* ── Header ───────────────────────────────────── */}
            <View style={[styles.srdHeader, isMobile && { padding: 18, flexDirection: 'column', gap: 14, borderRadius: 14 }]}>
                <View style={styles.srdHeaderLeft}>
                    <TouchableOpacity style={styles.srdBackBtn} onPress={() => navigation.navigate('CentralAdminDashboard')}>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>← Back to Dashboard</Text>
                    </TouchableOpacity>
                    <View style={styles.srdBrandBadge}>
                        <Text style={styles.srdBrandBadgeText}>REVENUE INTELLIGENCE</Text>
                    </View>
                    <Text style={[styles.headerTitle, isMobile && { fontSize: 21 }]}>System Revenue Analytics</Text>
                    <Text style={[styles.headerSubtitle, isMobile && { fontSize: 12.5 }]}>Complete financial overview of your SaaS platform across all hospitals & clinics</Text>
                </View>
                <View style={[styles.srdHeaderRight, isMobile && { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <Text style={styles.srdAdminName}>{currentUser?.name}</Text>
                    <TouchableOpacity style={styles.srdRefreshBtn} onPress={load}>
                        <Text style={{ color: '#a5b4fc', fontSize: 13, fontWeight: '600' }}>↻ Refresh</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Top KPI Cards ─────────────────────────────────── */}
            <View style={[styles.srdKpiGrid, isMobile && { gap: 10 }]}>
                <View style={[styles.srdKpiCard, styles.srdKpiPrimary, { width: kpiCardWidth, minWidth: isSmallPhone ? '100%' : undefined }, isMobile && { padding: 14, borderRadius: 12, gap: 10 }]}>
                    <Text style={[styles.srdKpiIcon, isMobile && { fontSize: 22 }]}>💰</Text>
                    <View style={styles.srdKpiBody}>
                        <Text style={styles.srdKpiLabel}>Current Month Revenue</Text>
                        <Text style={[styles.srdKpiValue, isMobile && { fontSize: 17 }]}>{fmt(summary?.totalCurrentMonthRevenue)}</Text>
                        <Text style={styles.srdKpiDesc}>All models combined</Text>
                    </View>
                </View>
                <View style={[styles.srdKpiCard, { width: kpiCardWidth, minWidth: isSmallPhone ? '100%' : undefined }, isMobile && { padding: 14, borderRadius: 12, gap: 10 }]}>
                    <Text style={[styles.srdKpiIcon, isMobile && { fontSize: 22 }]}>📊</Text>
                    <View style={styles.srdKpiBody}>
                        <Text style={styles.srdKpiLabel}>Annual Projected</Text>
                        <Text style={[styles.srdKpiValue, isMobile && { fontSize: 17 }]}>{fmt(annualProjected)}</Text>
                        <Text style={styles.srdKpiDesc}>Based on 12-month average</Text>
                    </View>
                </View>
                <View style={[styles.srdKpiCard, { width: kpiCardWidth, minWidth: isSmallPhone ? '100%' : undefined }, isMobile && { padding: 14, borderRadius: 12, gap: 10 }]}>
                    <Text style={[styles.srdKpiIcon, isMobile && { fontSize: 22 }]}>🏥</Text>
                    <View style={styles.srdKpiBody}>
                        <Text style={styles.srdKpiLabel}>Total Entities</Text>
                        <Text style={[styles.srdKpiValue, isMobile && { fontSize: 17 }]}>{summary?.totalEntities || 0}</Text>
                        <Text style={styles.srdKpiDesc}>Active hospitals & clinics</Text>
                    </View>
                </View>
                <View style={[styles.srdKpiCard, { width: kpiCardWidth, minWidth: isSmallPhone ? '100%' : undefined }, isMobile && { padding: 14, borderRadius: 12, gap: 10 }]}>
                    <Text style={[styles.srdKpiIcon, isMobile && { fontSize: 22 }]}>📆</Text>
                    <View style={styles.srdKpiBody}>
                        <Text style={styles.srdKpiLabel}>Last 4 Quarters</Text>
                        <Text style={[styles.srdKpiValue, isMobile && { fontSize: 17 }]}>{fmt(quarterlyTotal)}</Text>
                        <Text style={styles.srdKpiDesc}>Total collected</Text>
                    </View>
                </View>
            </View>

            {/* ── Model Breakdown Cards ─────────────────────────── */}
            <View style={[styles.srdModelGrid, isMobile && { gap: 12 }]}>
                {['fixed_monthly', 'per_patient', 'per_login'].map(key => {
                    const meta = MODEL_META[key];
                    const s = summary?.[key === 'fixed_monthly' ? 'fixedMonthly' : key === 'per_patient' ? 'perPatient' : 'perLogin'];
                    return (
                        <View key={key} style={[styles.srdModelCard, { width: modelCardWidth, minWidth: isMobile ? '100%' : undefined, borderColor: meta.border, backgroundColor: meta.bg }, isMobile && { padding: 16, borderRadius: 14 }]}>
                            <View style={styles.srdModelHeader}>
                                <Text style={styles.srdModelIcon}>{meta.icon}</Text>
                                <View>
                                    <Text style={{ color: meta.color, fontSize: 14, fontWeight: '700' }}>{meta.label}</Text>
                                    {key === 'per_login' && (
                                        <View style={styles.srdComingSoonWrap}>
                                            <Text style={styles.srdComingSoon}>Coming Soon</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <View style={styles.srdModelStats}>
                                <View style={styles.srdModelStat}>
                                    <Text style={styles.srdModelStatLabel}>Hospitals/Clinics</Text>
                                    <Text style={{ color: meta.color, fontSize: 18, fontWeight: '800' }}>{s?.count || 0}</Text>
                                </View>
                                <View style={styles.srdModelStat}>
                                    <Text style={styles.srdModelStatLabel}>This Month</Text>
                                    <Text style={{ color: meta.color, fontSize: 18, fontWeight: '800' }}>{fmt(s?.currentMonthRevenue)}</Text>
                                </View>
                            </View>
                            {summary?.totalEntities > 0 && (
                                <View style={styles.srdModelBarWrap}>
                                    <View style={[
                                        styles.srdModelBar,
                                        { width: `${((s?.count || 0) / summary.totalEntities) * 100}%`, backgroundColor: meta.color }
                                    ]} />
                                </View>
                            )}
                            <Text style={styles.srdModelPct}>
                                {summary?.totalEntities > 0
                                    ? `${(((s?.count || 0) / summary.totalEntities) * 100).toFixed(0)}% of entities`
                                    : 'No entities'}
                            </Text>
                        </View>
                    );
                })}
            </View>

            {/* ── View Tabs ─────────────────────────────────────── */}
            <View style={styles.srdViewTabs}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true}>
                    {[
                        { id: 'overview', label: '📈 Monthly Chart' },
                        { id: 'quarterly', label: '📆 Quarterly' },
                        { id: 'hospitals', label: '🏥 All Hospitals' },
                    ].map(v => (
                        <TouchableOpacity
                            key={v.id}
                            style={[styles.srdViewTab, activeView === v.id && styles.srdViewTabActive]}
                            onPress={() => setActiveView(v.id)}
                        >
                            <Text style={[styles.srdViewTabText, activeView === v.id && styles.srdViewTabTextActive]}>{v.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* ── Monthly Chart ─────────────────────────────────── */}
            {activeView === 'overview' && (
                <View style={[styles.srdCard, isMobile && { padding: 16, borderRadius: 14 }]}>
                    <View style={styles.srdCardHeader}>
                        <Text style={styles.srdCardTitle}>Monthly Revenue — Last 12 Months</Text>
                        <Text style={styles.srdCardSubtitle}>Breakdown by revenue model per month</Text>
                    </View>

                    <View style={styles.srdChartLegend}>
                        {[
                            { label: 'Model A (Fixed Monthly)', color: MODEL_META.fixed_monthly.color },
                            { label: 'Model B (Per Patient)', color: MODEL_META.per_patient.color },
                        ].map(l => (
                            <View key={l.label} style={styles.srdLegendItem}>
                                <View style={[styles.srdLegendDot, { backgroundColor: l.color }]} />
                                <Text style={styles.srdLegendText}>{l.label}</Text>
                            </View>
                        ))}
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true}>
                        <View style={styles.srdBarChart}>
                            {monthlyBreakdown.map((m, i) => (
                                <View key={i} style={styles.srdBarCol}>
                                    <Text style={styles.srdBarAmount}>{fmt(m.total)}</Text>
                                    <View style={styles.srdBarStack}>
                                        <View
                                            style={[styles.srdBarSeg, {
                                                height: `${maxMonthlyTotal > 0 ? (m.perPatient / maxMonthlyTotal) * 100 : 0}%`,
                                                backgroundColor: MODEL_META.per_patient.color,
                                            }]}
                                        />
                                        <View
                                            style={[styles.srdBarSeg, {
                                                height: `${maxMonthlyTotal > 0 ? (m.fixedMonthly / maxMonthlyTotal) * 100 : 0}%`,
                                                backgroundColor: MODEL_META.fixed_monthly.color,
                                            }]}
                                        />
                                    </View>
                                    <Text style={styles.srdBarLabel}>{m.label}</Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    {monthlyBreakdown.length === 0 && (
                        <Text style={styles.srdEmpty}>No monthly data available yet.</Text>
                    )}

                    {/* Monthly table */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true} style={{ marginTop: 24 }}>
                        <View style={styles.srdTable}>
                            <View style={styles.srdTableRowHeader}>
                                <Text style={[styles.th, { width: 100 }]}>Month</Text>
                                <Text style={[styles.th, { width: 140 }]}>Model A (Fixed)</Text>
                                <Text style={[styles.th, { width: 140 }]}>Model B (Per Patient)</Text>
                                <Text style={[styles.th, { width: 140 }]}>Model C (Per Login)</Text>
                                <Text style={[styles.th, { width: 120 }]}>Total</Text>
                            </View>
                            {monthlyBreakdown.map((m, i) => (
                                <View key={i} style={styles.srdTableRow}>
                                    <Text style={[styles.td, { width: 100, fontWeight: '700' }]}>{m.label}</Text>
                                    <Text style={[styles.td, { width: 140 }]}>{fmt(m.fixedMonthly)}</Text>
                                    <Text style={[styles.td, { width: 140 }]}>{fmt(m.perPatient)}</Text>
                                    <Text style={[styles.td, { width: 140, color: '#94a3b8' }]}>—</Text>
                                    <Text style={[styles.td, { width: 120, fontWeight: '700' }]}>{fmt(m.total)}</Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* ── Quarterly View ────────────────────────────────── */}
            {activeView === 'quarterly' && (
                <View style={[styles.srdCard, isMobile && { padding: 16, borderRadius: 14 }]}>
                    <View style={styles.srdCardHeader}>
                        <Text style={styles.srdCardTitle}>Quarterly Revenue Breakdown</Text>
                        <Text style={styles.srdCardSubtitle}>Revenue summaries across last 4 quarters</Text>
                    </View>

                    <View style={[styles.srdQuarterlyGrid, isMobile && { gap: 10 }]}>
                        {quarterlyBreakdown.map((q, i) => (
                            <View key={i} style={[styles.srdQuarterCard, { width: quarterlyCardWidth, minWidth: isSmallPhone ? '100%' : undefined }]}>
                                <Text style={styles.srdQuarterLabel}>{q.label}</Text>
                                <Text style={styles.srdQuarterAmount}>{fmt(q.total)}</Text>
                                <View style={styles.srdQuarterBarWrap}>
                                    <View
                                        style={[styles.srdQuarterBar, { width: `${maxQuarterTotal > 0 ? (q.total / maxQuarterTotal) * 100 : 0}%` }]}
                                    />
                                </View>
                                <Text style={styles.srdQuarterPct}>
                                    {maxQuarterTotal > 0 ? `${((q.total / maxQuarterTotal) * 100).toFixed(0)}% of peak quarter` : '—'}
                                </Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.srdQuarterlySummary}>
                        <View style={styles.srdQsItem}>
                            <Text style={styles.srdQsLabel}>Total (Last 4 Quarters)</Text>
                            <Text style={styles.srdQsValue}>{fmt(quarterlyTotal)}</Text>
                        </View>
                        <View style={styles.srdQsItem}>
                            <Text style={styles.srdQsLabel}>Average per Quarter</Text>
                            <Text style={styles.srdQsValue}>{fmt(quarterlyTotal / (quarterlyBreakdown.length || 1))}</Text>
                        </View>
                        <View style={styles.srdQsItem}>
                            <Text style={styles.srdQsLabel}>Best Quarter</Text>
                            <Text style={styles.srdQsValue}>{quarterlyBreakdown.reduce((best, q) => q.total > (best.total || 0) ? q : best, {}).label || '—'}</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* ── All Hospitals ─────────────────────────────────── */}
            {activeView === 'hospitals' && (
                <View style={[styles.srdCard, isMobile && { padding: 16, borderRadius: 14 }]}>
                    <View style={styles.srdCardHeader}>
                        <Text style={styles.srdCardTitle}>All Hospitals & Clinics</Text>
                        <Text style={styles.srdCardSubtitle}>Revenue model, rate, and current month charge for each entity</Text>
                    </View>

                    <View style={styles.srdFilters}>
                        <TextInput
                            style={styles.srdSearch}
                            placeholder="Search by name…"
                            placeholderTextColor="#94a3b8"
                            value={search}
                            onChangeText={setSearch}
                        />
                        <TouchableOpacity 
                            style={styles.srdSelect} 
                            onPress={() => setFilterModalVisible(true)}
                            accessibilityLabel="Filter by revenue model"
                        >
                            <Text style={{ color: '#1e293b', flex: 1, fontSize: 13 }}>
                                {filterModel === 'all' ? 'All Models' : 
                                 filterModel === 'fixed_monthly' ? 'Model A — Fixed Monthly' : 
                                 filterModel === 'per_patient' ? 'Model B — Per Patient' : 'Model C — Per Login'}
                            </Text>
                            <Feather name="chevron-down" size={16} color="#64748b" />
                        </TouchableOpacity>

                        {/* Revenue Model Filter Modal */}
                        <Modal
                            visible={filterModalVisible}
                            transparent={true}
                            animationType="fade"
                            onRequestClose={() => setFilterModalVisible(false)}
                        >
                            <Pressable 
                                style={styles.pickerOverlay} 
                                onPress={() => setFilterModalVisible(false)}
                            >
                                <View style={styles.pickerModalContent} onStartShouldSetResponder={() => true}>
                                    <View style={styles.pickerHeader}>
                                        <Text style={styles.pickerTitle}>Filter by Revenue Model</Text>
                                        <TouchableOpacity 
                                            onPress={() => setFilterModalVisible(false)}
                                            style={styles.pickerCloseBtn}
                                        >
                                            <Feather name="x" size={18} color="#64748b" />
                                        </TouchableOpacity>
                                    </View>
                                    {[
                                        { value: 'all', label: 'All Models' },
                                        { value: 'fixed_monthly', label: 'Model A — Fixed Monthly' },
                                        { value: 'per_patient', label: 'Model B — Per Patient' },
                                        { value: 'per_login', label: 'Model C — Per Login' }
                                    ].map(opt => {
                                        const isSelected = filterModel === opt.value;
                                        return (
                                            <TouchableOpacity
                                                key={opt.value}
                                                style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                                                onPress={() => {
                                                    setFilterModel(opt.value);
                                                    setFilterModalVisible(false);
                                                }}
                                            >
                                                <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                                                    {opt.label}
                                                </Text>
                                                {isSelected && <Feather name="check" size={18} color="#6366f1" />}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </Pressable>
                        </Modal>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true}>
                        <View style={styles.srdTable}>
                            <View style={styles.srdTableRowHeader}>
                                <Text style={[styles.th, { width: 40 }]}>#</Text>
                                <Text style={[styles.th, { width: 180 }]}>Name</Text>
                                <Text style={[styles.th, { width: 100 }]}>Type</Text>
                                <Text style={[styles.th, { width: 160 }]}>Revenue Model</Text>
                                <Text style={[styles.th, { width: 100 }]}>Rate / Fee</Text>
                                <Text style={[styles.th, { width: 140 }]}>This Month Charge</Text>
                                <Text style={[styles.th, { width: 120 }]}>Action</Text>
                            </View>
                            
                            {filteredHospitals.length === 0 && (
                                <View style={[styles.srdTableRow, { justifyContent: 'center', padding: 24 }]}>
                                    <Text style={styles.srdEmptyTd}>No results found.</Text>
                                </View>
                            )}
                            
                            {filteredHospitals.map((h, i) => {
                                const meta = MODEL_META[h.revenueModel] || MODEL_META.per_patient;
                                return (
                                    <View key={h._id} style={styles.srdTableRow}>
                                        <Text style={[styles.td, { width: 40, color: '#94a3b8' }]}>{i + 1}</Text>
                                        <Text style={[styles.td, { width: 180, fontWeight: '700' }]}>{h.name}</Text>
                                        <View style={[styles.td, { width: 100, justifyContent: 'center' }]}>
                                            <View style={[styles.srdTypeBadge, h.clinicType === 'hospital' ? styles.srdTypeBadgeHospital : styles.srdTypeBadgeClinic]}>
                                                <Text style={[styles.srdTypeBadgeText, h.clinicType === 'hospital' ? {color: '#3b82f6'} : {color: '#8b5cf6'}]}>
                                                    {h.clinicType === 'hospital' ? '🏥 Hospital' : '🏪 Clinic'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={[styles.td, { width: 160, justifyContent: 'center' }]}>
                                            <View style={[styles.srdModelBadge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                                                <Text style={{ color: meta.color, fontSize: 11, fontWeight: '700' }}>{meta.icon} {meta.short}</Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.td, { width: 100 }]}>{h.rateLabel || '—'}</Text>
                                        <Text style={[styles.td, { width: 140, fontWeight: '700' }]}>{fmt(h.currentCharge)}</Text>
                                        <View style={[styles.td, { width: 120, justifyContent: 'center' }]}>
                                            <TouchableOpacity
                                                style={styles.srdManageBtn}
                                                onPress={() => navigation.navigate('CentralAdminDashboard', { openTab: 'revenue-plans', hospitalId: h._id })}
                                            >
                                                <Text style={styles.srdManageBtnText}>Manage Plan</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>
            )}

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    srdPage: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    srdContainer: {
        maxWidth: 1400,
        marginHorizontal: 'auto',
        width: '100%',
        padding: 24,
    },
    srdLoader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 400,
        gap: 16,
    },
    srdErrorBox: {
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 300,
        gap: 12,
    },
    srdErrorBtn: {
        backgroundColor: 'rgba(239,68,68,0.15)',
        borderColor: 'rgba(239,68,68,0.3)',
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    srdHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderRadius: 20,
        paddingVertical: 28,
        paddingHorizontal: 36,
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 20
    },
    srdHeaderLeft: {
        flexDirection: 'column',
        gap: 6,
    },
    srdHeaderRight: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
    },
    srdBackBtn: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 10
    },
    srdBrandBadge: {
        backgroundColor: '#3b82f6',
        paddingVertical: 4,
        paddingHorizontal: 14,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    srdBrandBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 2,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: 'white',
    },
    headerSubtitle: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 14,
    },
    srdAdminName: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
    },
    srdRefreshBtn: {
        backgroundColor: 'rgba(99,102,241,0.2)',
        borderColor: 'rgba(99,102,241,0.35)',
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 18,
        borderRadius: 10,
    },
    srdKpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 20,
    },
    srdKpiCard: {
        flex: 1,
        minWidth: 200,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderRadius: 16,
        padding: 20,
        flexDirection: 'row',
        gap: 14,
        alignItems: 'center',
    },
    srdKpiPrimary: {
        backgroundColor: 'rgba(99,102,241,0.15)',
        borderColor: 'rgba(99,102,241,0.4)',
    },
    srdKpiIcon: {
        fontSize: 28,
    },
    srdKpiBody: {
        flexDirection: 'column',
    },
    srdKpiLabel: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
        marginBottom: 4,
    },
    srdKpiValue: {
        color: 'white',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 4,
    },
    srdKpiDesc: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: 11,
    },
    srdModelGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
    },
    srdModelCard: {
        flex: 1,
        minWidth: 280,
        borderWidth: 1,
        borderRadius: 16,
        padding: 20,
    },
    srdModelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    srdModelIcon: {
        fontSize: 26,
    },
    srdComingSoonWrap: {
        backgroundColor: 'rgba(245,158,11,0.2)',
        borderColor: 'rgba(245,158,11,0.3)',
        borderWidth: 1,
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 10,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    srdComingSoon: {
        color: '#fbbf24',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    srdModelStats: {
        flexDirection: 'row',
        gap: 24,
        marginBottom: 14,
    },
    srdModelStat: {
        flexDirection: 'column',
        gap: 2,
    },
    srdModelStatLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.65)',
    },
    srdModelBarWrap: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 6,
    },
    srdModelBar: {
        height: '100%',
        borderRadius: 4,
    },
    srdModelPct: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
    },
    srdViewTabs: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    srdViewTab: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        marginRight: 8,
    },
    srdViewTabActive: {
        backgroundColor: 'rgba(99,102,241,0.25)',
        borderColor: 'rgba(99,102,241,0.5)',
    },
    srdViewTabText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: '600',
    },
    srdViewTabTextActive: {
        color: '#a5b4fc',
    },
    srdCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 28,
        marginBottom: 20,
    },
    srdCardHeader: {
        marginBottom: 20,
    },
    srdCardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    srdCardSubtitle: {
        fontSize: 13,
        color: '#64748b',
    },
    srdChartLegend: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 16,
    },
    srdLegendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    srdLegendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    srdLegendText: {
        fontSize: 12,
        color: '#64748b',
    },
    srdBarChart: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        paddingVertical: 12,
        minHeight: 200,
    },
    srdBarCol: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        minWidth: 52,
    },
    srdBarAmount: {
        fontSize: 9,
        color: '#64748b',
        textAlign: 'center',
    },
    srdBarStack: {
        flexDirection: 'column-reverse',
        width: 40,
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
        overflow: 'hidden',
        height: 160,
        backgroundColor: '#f1f5f9',
    },
    srdBarSeg: {
        width: '100%',
    },
    srdBarLabel: {
        fontSize: 10,
        color: '#94a3b8',
        textAlign: 'center',
    },
    srdEmpty: {
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: 14,
        paddingVertical: 24,
    },
    srdTable: {
        flexDirection: 'column',
    },
    srdTableRowHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    th: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    srdTableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 12,
        paddingHorizontal: 14,
        alignItems: 'center',
    },
    td: {
        color: '#374151',
        fontSize: 13,
    },
    srdEmptyTd: {
        color: '#94a3b8',
        fontSize: 14,
        textAlign: 'center',
    },
    srdQuarterlyGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
    },
    srdQuarterCard: {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        minWidth: 160,
        flex: 1,
    },
    srdQuarterLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    srdQuarterAmount: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 12,
    },
    srdQuarterBarWrap: {
        height: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 6,
        width: '100%',
    },
    srdQuarterBar: {
        height: '100%',
        backgroundColor: '#6366f1',
        borderRadius: 4,
    },
    srdQuarterPct: {
        fontSize: 11,
        color: '#94a3b8',
    },
    srdQuarterlySummary: {
        flexDirection: 'row',
        gap: 32,
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        flexWrap: 'wrap',
    },
    srdQsItem: {
        flexDirection: 'column',
        gap: 4,
    },
    srdQsLabel: {
        fontSize: 12,
        color: '#64748b',
    },
    srdQsValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    srdFilters: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
        flexWrap: 'wrap',
    },
    srdSearch: {
        flex: 1,
        minWidth: 200,
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        borderRadius: 8,
        fontSize: 13,
        color: '#1e293b',
    },
    srdSelect: {
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        borderRadius: 8,
        backgroundColor: 'white',
        justifyContent: 'center',
    },
    srdModelBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 20,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    srdTypeBadge: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        alignSelf: 'flex-start',
    },
    srdTypeBadgeHospital: {
        backgroundColor: '#eff6ff',
    },
    srdTypeBadgeClinic: {
        backgroundColor: '#f5f3ff',
    },
    srdTypeBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    srdManageBtn: {
        backgroundColor: '#f1f5f9',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    srdManageBtnText: {
        color: '#374151',
        fontSize: 12,
        fontWeight: '600',
    },
    pickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    pickerModalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 380,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    pickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    pickerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    pickerCloseBtn: {
        padding: 4,
    },
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        marginBottom: 6,
    },
    pickerItemActive: {
        backgroundColor: '#f5f3ff',
    },
    pickerItemText: {
        fontSize: 14,
        color: '#334155',
        fontWeight: '500',
    },
    pickerItemTextActive: {
        color: '#6366f1',
        fontWeight: '700',
    },
});

export default SystemRevenueDashboard;
