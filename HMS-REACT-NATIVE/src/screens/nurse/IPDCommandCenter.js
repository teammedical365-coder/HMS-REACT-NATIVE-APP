import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  useWindowDimensions,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ipdCommandCenterAPI } from '../../utils/api';
import socket from '../../utils/socket';

const STAGE_CONFIG = {
  ADMITTED: { label: 'Admitted (<24h)', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: '#93c5fd' },
  ACTIVE_CARE: { label: 'Active Care', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)', border: '#7dd3fc' },
  INVESTIGATION: { label: 'Investigation', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', border: '#c4b5fd' },
  PROCEDURE_OT: { label: 'OT / Procedure', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', border: '#f9a8d4' },
  POST_OP: { label: 'Post-Op Recovery', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: '#fcd34d' },
  DISCHARGE_PLANNED: { label: 'Discharge Planned', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: '#6ee7b7' },
  DISCHARGE_CLEARANCE: { label: 'Safety Clearance', color: '#059669', bg: 'rgba(5, 150, 105, 0.1)', border: '#34d399' },
  DISCHARGED: { label: 'Discharged (24h)', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)', border: '#cbd5e1' },
};

export default function IPDCommandCenter({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isMobile = windowWidth < 768;
  const isSmallPhone = windowWidth < 380;
  const isVerySmall = windowWidth < 350;

  const [activeTab, setActiveTab] = useState('board'); // 'board', 'wards', 'analytics', 'reconcile'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Overview & Flow Board Data
  const [census, setCensus] = useState(null);
  const [workload, setWorkload] = useState(null);
  const [wardBreakdown, setWardBreakdown] = useState([]);
  const [flowBoard, setFlowBoard] = useState({});
  const [flowCards, setFlowCards] = useState([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWard, setSelectedWard] = useState('ALL');
  const [selectedStage, setSelectedStage] = useState('ALL');
  const [wardModalOpen, setWardModalOpen] = useState(false);

  // Blocker Drawer Modal
  const [blockerModalOpen, setBlockerModalOpen] = useState(false);
  const [selectedAdmissionId, setSelectedAdmissionId] = useState(null);
  const [blockerData, setBlockerData] = useState(null);
  const [loadingBlockers, setLoadingBlockers] = useState(false);

  // Analytics Data
  const [trendsData, setTrendsData] = useState(null);
  const [nurseWorkloadData, setNurseWorkloadData] = useState([]);
  const [trendsDays, setTrendsDays] = useState(14);

  // Bed Reconciliation State
  const [reconcileResult, setReconcileResult] = useState(null);
  const [reconciling, setReconciling] = useState(false);

  // Pulse & Spin Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.35,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (refreshing || reconciling) {
      const spinLoop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spinLoop.start();
      return () => spinLoop.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [refreshing, reconciling, spinAnim]);

  const spinRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── Fetch Main Data ──
  const fetchCommandCenterData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [overviewRes, boardRes] = await Promise.all([
        ipdCommandCenterAPI.getOverview().catch((err) => {
          console.error('Overview error:', err);
          return { success: false };
        }),
        ipdCommandCenterAPI
          .getFlowBoard({
            ward: selectedWard,
            search: searchQuery,
            stageFilter: selectedStage,
          })
          .catch((err) => {
            console.error('Flow board error:', err);
            return { success: false };
          }),
      ]);

      if (overviewRes?.success) {
        setCensus(overviewRes.census);
        setWorkload(overviewRes.clinicalWorkload);
        setWardBreakdown(overviewRes.wardBreakdown || []);
      }

      if (boardRes?.success) {
        setFlowBoard(boardRes.board || {});
        setFlowCards(boardRes.cards || []);
      }

      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to load IPD Command Center data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedWard, searchQuery, selectedStage]);

  // ── Fetch Analytics Data ──
  const fetchAnalyticsData = useCallback(async () => {
    try {
      const [trendsRes, nursesRes] = await Promise.all([
        ipdCommandCenterAPI.getCensusTrends({ days: trendsDays }),
        ipdCommandCenterAPI.getNurseWorkload(),
      ]);
      if (trendsRes?.success) setTrendsData(trendsRes);
      if (nursesRes?.success) setNurseWorkloadData(nursesRes.workload || []);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  }, [trendsDays]);

  useEffect(() => {
    fetchCommandCenterData();
  }, [fetchCommandCenterData]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalyticsData();
    }
  }, [activeTab, fetchAnalyticsData]);

  // ── Socket.IO Realtime Listeners ──
  useEffect(() => {
    if (!socket || !socket.on) return;

    const handleRealtimeEvent = () => {
      fetchCommandCenterData(true);
    };

    const events = [
      'patient_admitted',
      'patient_discharged',
      'bed_status_updated',
      'vitals_recorded',
      'mar_administered',
      'doctor_order_created',
      'doctor_order_acknowledged',
      'order_clarification_requested',
      'order_clarification_resolved',
      'discharge_readiness_changed',
      'discharge_summary_updated',
      'nurse_handover_recorded',
      'nursing_clearance_signed',
    ];

    events.forEach((evt) => socket.on(evt, handleRealtimeEvent));

    return () => {
      events.forEach((evt) => socket.off(evt, handleRealtimeEvent));
    };
  }, [fetchCommandCenterData]);

  // ── Inspect Discharge Blockers ──
  const handleOpenBlockerModal = async (admissionId) => {
    setSelectedAdmissionId(admissionId);
    setBlockerModalOpen(true);
    setLoadingBlockers(true);
    try {
      const res = await ipdCommandCenterAPI.getDischargeBlockers(admissionId);
      if (res?.success) {
        setBlockerData(res);
      }
    } catch (error) {
      console.error('Failed to inspect blockers:', error);
    } finally {
      setLoadingBlockers(false);
    }
  };

  // ── Bed Reconciliation Execution ──
  const handleRunReconciliation = async () => {
    setReconciling(true);
    try {
      const res = await ipdCommandCenterAPI.reconcileBeds();
      setReconcileResult(res);
      fetchCommandCenterData(true);
    } catch (error) {
      console.error('Reconciliation failed:', error);
      setReconcileResult({
        success: false,
        message: error.response?.data?.message || 'Reconciliation failed',
      });
    } finally {
      setReconciling(false);
    }
  };

  // Available Wards
  const availableWards = useMemo(() => {
    const wards = new Set(wardBreakdown.map((w) => w.wardName).filter(Boolean));
    return ['ALL', ...Array.from(wards)];
  }, [wardBreakdown]);

  // Responsive padding calculations & safe area clearance
  const scrollPaddingHorizontal = isVerySmall ? 10 : isSmallPhone ? 12 : isMobile ? 16 : isTablet ? 20 : 28;
  const availableContentWidth = windowWidth - scrollPaddingHorizontal * 2;
  const topInsetPadding = Math.max(insets.top, isMobile ? 10 : 16);
  const bottomInsetPadding = Math.max(insets.bottom + 20, isMobile ? 44 : 56);

  // Responsive column width for mobile Kanban
  const mobileKanbanColumnWidth = Math.min(Math.max(availableContentWidth * 0.9, 280), 340);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: scrollPaddingHorizontal,
            paddingTop: topInsetPadding,
            paddingBottom: bottomInsetPadding,
            gap: isVerySmall ? 12 : isSmallPhone ? 14 : isDesktop ? 20 : 16,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Command Bar ── */}
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.85)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.ccHeader,
            isVerySmall && { padding: 12 },
            !isMobile && styles.ccHeaderDesktop,
          ]}
        >
          <View style={[styles.ccHeaderLeft, !isMobile && styles.ccHeaderLeftDesktop]}>
            <View style={styles.ccBadgeLive}>
              <Animated.View
                style={[
                  styles.pulseDot,
                  {
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />
              <Text style={styles.ccBadgeLiveText}>LIVE COMMAND CENTER</Text>
            </View>
            <Text
              style={[
                styles.ccMainTitle,
                isVerySmall ? { fontSize: 18 } : isSmallPhone ? { fontSize: 20 } : null,
              ]}
            >
              IPD Clinical Operations & Census
            </Text>
            <Text style={styles.ccSubTitle}>
              Real-time patient progression, bed occupancy, doctor-nurse coordination & discharge blocker intelligence
            </Text>
          </View>

          <View style={[styles.ccHeaderRight, !isMobile && styles.ccHeaderRightDesktop]}>
            <View style={styles.syncInfo}>
              <Feather name="clock" size={13} color="#94a3b8" />
              <Text style={styles.syncText}>
                Updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            </View>

            <View style={[styles.headerActionsRow, isMobile && styles.headerActionsRowMobile]}>
              <TouchableOpacity
                style={[styles.btnRefresh, refreshing && styles.btnRefreshActive, isMobile && { flex: 1 }]}
                onPress={() => fetchCommandCenterData(false)}
                activeOpacity={0.7}
              >
                <Animated.View style={{ transform: [{ rotate: spinRotation }] }}>
                  <Feather name="refresh-cw" size={14} color="#e2e8f0" />
                </Animated.View>
                <Text style={styles.btnRefreshText}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnWorkspaceShortcut, isMobile && { flex: 1.2 }]}
                onPress={() => navigation.navigate('NurseDashboard')}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#0284c7', '#0369a1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.btnWorkspaceGradient}
                >
                  <Feather name="user-check" size={14} color="#ffffff" />
                  <Text style={styles.btnWorkspaceShortcutText}>Nurse Station</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {/* ── KPI Census Deck (6 Cards) ── */}
        <View style={[styles.kpiDeck, isVerySmall && { gap: 8 }]}>
          {/* 1. Bed Occupancy */}
          <View style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop, isTablet && styles.kpiCardTablet, isMobile && styles.kpiCardMobile]}>
            <View style={styles.kpiHeaderRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Feather name="pie-chart" size={18} color="#60a5fa" />
              </View>
              <Text style={styles.kpiLabel}>BED OCCUPANCY</Text>
            </View>
            <View style={styles.kpiContent}>
              <View style={styles.kpiValGroup}>
                <Text style={[styles.kpiMainVal, isVerySmall && { fontSize: 20 }]}>{census?.occupancyRate || '0%'}</Text>
                <Text style={styles.kpiSubVal}>
                  ({census?.occupiedBeds || 0} / {census?.totalBeds || 0} Beds)
                </Text>
              </View>
              <View style={styles.kpiBarTrack}>
                <LinearGradient
                  colors={['#3b82f6', '#06b6d4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.kpiBarFill,
                    {
                      width: `${Math.min(100, census?.occupancyRateValue || parseFloat(census?.occupancyRate) || 0)}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* 2. Active Inpatients */}
          <View style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop, isTablet && styles.kpiCardTablet, isMobile && styles.kpiCardMobile]}>
            <View style={styles.kpiHeaderRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
                <Feather name="users" size={18} color="#22d3ee" />
              </View>
              <Text style={styles.kpiLabel}>ACTIVE INPATIENTS</Text>
            </View>
            <View style={styles.kpiContent}>
              <View style={styles.kpiValGroup}>
                <Text style={[styles.kpiMainVal, isVerySmall && { fontSize: 20 }]}>{census?.activeInpatients || 0}</Text>
                <Text style={[styles.kpiSubVal, { color: '#34d399', fontWeight: '600' }]}>
                  +{census?.admittedToday || 0} Today
                </Text>
              </View>
              <Text style={styles.kpiHint}>
                {census?.unassignedPatients ? `⚠️ ${census.unassignedPatients} unassigned` : 'All patients assigned to nurses'}
              </Text>
            </View>
          </View>

          {/* 3. Discharge Pipeline */}
          <View style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop, isTablet && styles.kpiCardTablet, isMobile && styles.kpiCardMobile]}>
            <View style={styles.kpiHeaderRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Feather name="log-out" size={18} color="#34d399" />
              </View>
              <Text style={styles.kpiLabel}>DISCHARGE PIPELINE</Text>
            </View>
            <View style={styles.kpiContent}>
              <View style={styles.kpiValGroup}>
                <Text style={[styles.kpiMainVal, isVerySmall && { fontSize: 20 }]}>{census?.dischargesPlanned || 0}</Text>
                <Text style={styles.kpiSubVal}>Planned</Text>
              </View>
              <Text style={styles.kpiHint}>
                {census?.dischargesToday || 0} completed discharges today
              </Text>
            </View>
          </View>

          {/* 4. Long-Stay Patients */}
          <View style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop, isTablet && styles.kpiCardTablet, isMobile && styles.kpiCardMobile]}>
            <View style={styles.kpiHeaderRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Feather name="clock" size={18} color="#fbbf24" />
              </View>
              <Text style={styles.kpiLabel}>LONG-STAY PATIENTS</Text>
            </View>
            <View style={styles.kpiContent}>
              <View style={styles.kpiValGroup}>
                <Text style={[styles.kpiMainVal, isVerySmall && { fontSize: 20 }]}>{census?.longStayCount || 0}</Text>
                <Text style={styles.kpiSubVal}>Stay &gt; 7 Days</Text>
              </View>
              <Text style={styles.kpiHint}>Clinical course review suggested</Text>
            </View>
          </View>

          {/* 5. Clinical Workload */}
          <View style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop, isTablet && styles.kpiCardTablet, isMobile && styles.kpiCardMobile]}>
            <View style={styles.kpiHeaderRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Feather name="activity" size={18} color="#c084fc" />
              </View>
              <Text style={styles.kpiLabel}>CLINICAL WORKLOAD</Text>
            </View>
            <View style={styles.kpiContent}>
              <View style={styles.kpiValGroup}>
                <Text style={[styles.kpiMainVal, isVerySmall && { fontSize: 20 }]}>
                  {(workload?.pendingMedications || 0) + (workload?.pendingTasks || 0)}
                </Text>
                <Text style={styles.kpiSubVal}>Pending Actions</Text>
              </View>
              <Text style={styles.kpiHint}>
                {workload?.overdueMedications
                  ? `🚨 ${workload.overdueMedications} overdue doses`
                  : 'MAR on schedule'}
              </Text>
            </View>
          </View>

          {/* 6. Clarifications */}
          <View style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop, isTablet && styles.kpiCardTablet, isMobile && styles.kpiCardMobile]}>
            <View style={styles.kpiHeaderRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
                <Feather name="help-circle" size={18} color="#fb7185" />
              </View>
              <Text style={styles.kpiLabel}>CLARIFICATIONS</Text>
            </View>
            <View style={styles.kpiContent}>
              <View style={styles.kpiValGroup}>
                <Text style={[styles.kpiMainVal, isVerySmall && { fontSize: 20 }]}>{workload?.openClarifications || 0}</Text>
                <Text style={styles.kpiSubVal}>Open Doctor Questions</Text>
              </View>
              <Text style={styles.kpiHint}>Doctor ↔ Nurse active threads</Text>
            </View>
          </View>
        </View>

        {/* ── Navigation Tabs Bar ── */}
        <View style={[styles.tabsBar, !isMobile && styles.tabsBarDesktop]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled={true}
            contentContainerStyle={styles.tabsScroll}
            style={styles.tabsScrollFlex}
          >
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'board' && styles.tabBtnActive]}
              onPress={() => setActiveTab('board')}
              activeOpacity={0.8}
            >
              <Feather name="layers" size={15} color={activeTab === 'board' ? '#38bdf8' : '#94a3b8'} />
              <Text style={[styles.tabBtnText, activeTab === 'board' && styles.tabBtnTextActive]}>
                Patient Flow Board
              </Text>
              <View style={[styles.tabPill, activeTab === 'board' && styles.tabPillActive]}>
                <Text style={[styles.tabPillText, activeTab === 'board' && styles.tabPillTextActive]}>
                  {flowCards.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'wards' && styles.tabBtnActive]}
              onPress={() => setActiveTab('wards')}
              activeOpacity={0.8}
            >
              <Feather name="pie-chart" size={15} color={activeTab === 'wards' ? '#38bdf8' : '#94a3b8'} />
              <Text style={[styles.tabBtnText, activeTab === 'wards' && styles.tabBtnTextActive]}>
                Ward Breakdown
              </Text>
              <View style={[styles.tabPill, activeTab === 'wards' && styles.tabPillActive]}>
                <Text style={[styles.tabPillText, activeTab === 'wards' && styles.tabPillTextActive]}>
                  {wardBreakdown.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'analytics' && styles.tabBtnActive]}
              onPress={() => setActiveTab('analytics')}
              activeOpacity={0.8}
            >
              <Feather name="trending-up" size={15} color={activeTab === 'analytics' ? '#38bdf8' : '#94a3b8'} />
              <Text style={[styles.tabBtnText, activeTab === 'analytics' && styles.tabBtnTextActive]}>
                Census & ALOS Analytics
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'reconcile' && styles.tabBtnActive]}
              onPress={() => setActiveTab('reconcile')}
              activeOpacity={0.8}
            >
              <Feather name="database" size={15} color={activeTab === 'reconcile' ? '#38bdf8' : '#94a3b8'} />
              <Text style={[styles.tabBtnText, activeTab === 'reconcile' && styles.tabBtnTextActive]}>
                Bed Concurrency Tool
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Right filters (Search & Ward Selector) */}
          {activeTab === 'board' && (
            <View style={[styles.flowFiltersRight, isMobile && styles.flowFiltersRightMobile]}>
              <View style={[styles.searchWrap, isMobile && { width: '100%' }]}>
                <Feather name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search patient, MRN, Bed..."
                  placeholderTextColor="#64748b"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.clearSearchBtn}
                  >
                    <Feather name="x" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Ward Selector Button */}
              <TouchableOpacity
                style={[styles.wardSelectBtn, isMobile && { width: '100%' }]}
                onPress={() => setWardModalOpen(true)}
                activeOpacity={0.8}
              >
                <Feather name="filter" size={15} color="#64748b" style={{ marginRight: 8 }} />
                <Text style={styles.wardSelectBtnText} numberOfLines={1}>
                  {selectedWard === 'ALL' ? 'All Wards' : `Ward: ${selectedWard}`}
                </Text>
                <Feather name="chevron-down" size={15} color="#94a3b8" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Loading Spinner ── */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.loadingText}>Loading IPD Command Center data...</Text>
          </View>
        )}

        {/* ── TAB 1: PATIENT FLOW BOARD (8 STAGES) ── */}
        {!loading && activeTab === 'board' && (
          <View style={styles.boardWrapper}>
            {/* Stage Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled={true}
              contentContainerStyle={styles.stageFilterPillsScroll}
            >
              <TouchableOpacity
                style={[styles.stagePill, selectedStage === 'ALL' && styles.stagePillActive]}
                onPress={() => setSelectedStage('ALL')}
                activeOpacity={0.8}
              >
                <Text style={[styles.stagePillText, selectedStage === 'ALL' && styles.stagePillTextActive]}>
                  All Stages ({flowCards.length})
                </Text>
              </TouchableOpacity>

              {Object.entries(STAGE_CONFIG).map(([stageKey, cfg]) => {
                const count = flowBoard[stageKey]?.length || 0;
                const isSelected = selectedStage === stageKey;
                return (
                  <TouchableOpacity
                    key={stageKey}
                    style={[
                      styles.stagePill,
                      { borderColor: isSelected ? cfg.border : 'rgba(255, 255, 255, 0.08)' },
                      isSelected && { backgroundColor: cfg.bg },
                    ]}
                    onPress={() => setSelectedStage(stageKey)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.stageDot, { backgroundColor: cfg.color }]} />
                    <Text style={[styles.stagePillText, isSelected && { color: '#ffffff', fontWeight: '700' }]}>
                      {cfg.label}
                    </Text>
                    <View style={styles.stageCountBadge}>
                      <Text style={[styles.stageCountText, isSelected && { color: '#ffffff' }]}>{count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Kanban Columns — Rendered with Responsive Native Architecture */}
            {isMobile && selectedStage === 'ALL' ? (
              /* Option A: True Horizontal ScrollView for Mobile Kanban when ALL stages active */
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                nestedScrollEnabled={true}
                contentContainerStyle={styles.kanbanHorizontalScroll}
              >
                {Object.entries(STAGE_CONFIG).map(([stageKey, cfg]) => {
                  const patients = flowBoard[stageKey] || [];
                  return renderKanbanColumn(stageKey, cfg, patients, mobileKanbanColumnWidth);
                })}
              </ScrollView>
            ) : (
              /* Single Selected Column or Desktop/Tablet Multi-Column Grid */
              <View style={styles.flowColumnsContainer}>
                {Object.entries(STAGE_CONFIG).map(([stageKey, cfg]) => {
                  const patients = flowBoard[stageKey] || [];
                  if (selectedStage !== 'ALL' && selectedStage !== stageKey) return null;

                  return renderKanbanColumn(stageKey, cfg, patients, undefined, isDesktop, isTablet, selectedStage !== 'ALL');
                })}
              </View>
            )}
          </View>
        )}

        {/* ── TAB 2: WARD BREAKDOWN ── */}
        {!loading && activeTab === 'wards' && (
          <View style={styles.wardBreakdownGrid}>
            {wardBreakdown.map((w, idx) => (
              <View
                key={idx}
                style={[
                  styles.wardCard,
                  isVerySmall && { padding: 12 },
                  isDesktop && styles.wardCardDesktop,
                  isTablet && styles.wardCardTablet,
                ]}
              >
                <View style={styles.wardCardHeader}>
                  <Text style={styles.wardName}>{w.wardName}</Text>
                  <View style={styles.wardOccupancyPill}>
                    <Text style={styles.wardOccupancyPillText}>{w.occupancyRate}% Occupied</Text>
                  </View>
                </View>

                {/* Ward Metrics Row */}
                <View style={[styles.wardMetricsRow, isVerySmall && { flexWrap: 'wrap', gap: 8 }]}>
                  <View style={[styles.wStat, isVerySmall && { flexBasis: '47%' }]}>
                    <Text style={styles.wStatNum}>{w.totalBeds}</Text>
                    <Text style={styles.wStatLbl}>Total Beds</Text>
                  </View>
                  <View style={[styles.wStat, isVerySmall && { flexBasis: '47%' }]}>
                    <Text style={[styles.wStatNum, { color: '#38bdf8' }]}>{w.occupiedBeds}</Text>
                    <Text style={styles.wStatLbl}>Occupied</Text>
                  </View>
                  <View style={[styles.wStat, isVerySmall && { flexBasis: '47%' }]}>
                    <Text style={[styles.wStatNum, { color: '#34d399' }]}>{w.availableBeds}</Text>
                    <Text style={styles.wStatLbl}>Available</Text>
                  </View>
                  <View style={[styles.wStat, isVerySmall && { flexBasis: '47%' }]}>
                    <Text style={[styles.wStatNum, { color: '#fbbf24' }]}>{w.maintenanceBeds}</Text>
                    <Text style={styles.wStatLbl}>Maint.</Text>
                  </View>
                </View>

                {/* Ward Progress Bar */}
                <View style={styles.wardProgressBar}>
                  <LinearGradient
                    colors={['#3b82f6', '#06b6d4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.wardProgressFill,
                      {
                        width: `${Math.min(100, parseFloat(w.occupancyRate) || 0)}%`,
                      },
                    ]}
                  />
                </View>

                {/* Active Inpatients Preview */}
                <View style={styles.wardActivePatientsPreview}>
                  <Text style={styles.wardActivePatientsTitle}>
                    Active Inpatients ({w.activePatientsCount || 0})
                  </Text>
                  <View style={styles.wardPtList}>
                    {(!w.activePatients || w.activePatients.length === 0) ? (
                      <Text style={styles.noPtText}>No patients currently in this ward</Text>
                    ) : (
                      w.activePatients.map((pt, pidx) => (
                        <TouchableOpacity
                          key={pidx}
                          style={styles.wardPtItem}
                          onPress={() =>
                            navigation.navigate('NursePatientWorkspace', {
                              admissionId: pt.admissionId,
                            })
                          }
                          activeOpacity={0.7}
                        >
                          <Text style={styles.wptBed}>Bed {pt.bedNumber}</Text>
                          <Text style={styles.wptName} numberOfLines={1}>
                            {pt.patientName}
                          </Text>
                          <Text style={styles.wptDoc} numberOfLines={1}>
                            Dr. {pt.doctorName || 'Attending'}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── TAB 3: CENSUS & ALOS ANALYTICS ── */}
        {!loading && activeTab === 'analytics' && (
          <View style={styles.analyticsContainer}>
            {/* Top Deck: ALOS & Admission/Discharge Balance */}
            <View style={styles.analyticsTopDeck}>
              <View style={styles.analyticsSummaryCard}>
                <Text style={styles.analyticsCardTitle}>Average Length of Stay (ALOS)</Text>
                <View style={styles.alosMetricRow}>
                  <Text style={styles.alosNumber}>{trendsData?.alosDays || '0.0'}</Text>
                  <Text style={styles.alosUnit}>Days</Text>
                </View>
                <Text style={styles.alosSub}>
                  Calculated across {trendsData?.totalDischargesInPeriod || 0} discharges in the past {trendsDays} days.
                </Text>
              </View>

              <View style={styles.analyticsSummaryCard}>
                <Text style={styles.analyticsCardTitle}>Admission / Discharge Balance</Text>
                <View style={styles.balanceRow}>
                  <View style={[styles.balBox, styles.balBoxAdmissions]}>
                    <Text style={styles.balNumGreen}>+{trendsData?.totalAdmissionsInPeriod || 0}</Text>
                    <Text style={styles.balLbl}>Admissions</Text>
                  </View>
                  <View style={[styles.balBox, styles.balBoxDischarges]}>
                    <Text style={styles.balNumRed}>-{trendsData?.totalDischargesInPeriod || 0}</Text>
                    <Text style={styles.balLbl}>Discharges</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Daily Timeline Table / Visual Bars */}
            <View style={styles.analyticsTableCard}>
              <View style={[styles.tableCardHeader, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}>
                <Text style={styles.tableCardTitle}>Daily Census Timeline ({trendsDays} Days)</Text>
                <View style={styles.timeframeButtonsRow}>
                  {[7, 14, 30].map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={[styles.btnTimeframe, trendsDays === days && styles.btnTimeframeActive]}
                      onPress={() => setTrendsDays(days)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.btnTimeframeText,
                          trendsDays === days && styles.btnTimeframeTextActive,
                        ]}
                      >
                        Past {days} Days
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Chart Legend */}
              <View style={styles.chartLegendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColorBox, { backgroundColor: '#10b981' }]} />
                  <Text style={styles.legendText}>Admissions</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColorBox, { backgroundColor: '#f43f5e' }]} />
                  <Text style={styles.legendText}>Discharges</Text>
                </View>
              </View>

              {/* Bar Chart Scroll with Android nested scroll enabled */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                nestedScrollEnabled={true}
                contentContainerStyle={styles.trendsBarChart}
              >
                {(trendsData?.dailyTrends || []).map((day, idx) => (
                  <View key={idx} style={styles.trendDayCol}>
                    <View style={styles.barPair}>
                      <View
                        style={[
                          styles.barAdmissions,
                          { height: Math.min(120, (day.admissions || 0) * 20 + 4) },
                        ]}
                      >
                        {day.admissions > 0 && (
                          <Text style={styles.barCountText}>{day.admissions}</Text>
                        )}
                      </View>
                      <View
                        style={[
                          styles.barDischarges,
                          { height: Math.min(120, (day.discharges || 0) * 20 + 4) },
                        ]}
                      >
                        {day.discharges > 0 && (
                          <Text style={styles.barCountText}>{day.discharges}</Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.trendDateLbl}>{day.date || '—'}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Nurse Workload Distribution — Exact 5-Column Table */}
            <View style={styles.analyticsTableCard}>
              <View style={styles.tableCardHeader}>
                <Text style={styles.tableCardTitle}>Active Nurse Workload & Performance Today</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={true}
                nestedScrollEnabled={true}
                style={styles.workloadTableWrapper}
              >
                <View style={styles.tableInner}>
                  {/* Table Header */}
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.thCell, { width: 180 }]}>NURSE NAME</Text>
                    <Text style={[styles.thCell, { width: 170 }]}>ACTIVE ASSIGNED PATIENTS</Text>
                    <Text style={[styles.thCell, { width: 160 }]}>COVERED WARDS</Text>
                    <Text style={[styles.thCell, { width: 170 }]}>TASKS COMPLETED TODAY</Text>
                    <Text style={[styles.thCell, { width: 190 }]}>MAR DOSES ADMINISTERED TODAY</Text>
                  </View>

                  {/* Table Body */}
                  {nurseWorkloadData.length === 0 ? (
                    <View style={styles.emptyTableBox}>
                      <Text style={styles.emptyTableText}>No nurse assignments found</Text>
                    </View>
                  ) : (
                    nurseWorkloadData.map((nw, idx) => (
                      <View key={idx} style={[styles.tableDataRow, idx % 2 === 1 && styles.tableDataRowAlt]}>
                        <View style={[styles.tdCell, styles.nurseCell, { width: 180 }]}>
                          <Feather name="user" size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                          <Text style={styles.nurseNameText} numberOfLines={1}>{nw.nurseName}</Text>
                        </View>
                        <View style={[styles.tdCell, { width: 170 }]}>
                          <View style={styles.countPill}>
                            <Text style={styles.countPillText}>{nw.activePatientsCount} Patients</Text>
                          </View>
                        </View>
                        <View style={[styles.tdCell, { width: 160 }]}>
                          <Text style={styles.wardCoveredText} numberOfLines={1}>
                            {nw.assignedWards?.join(', ') || 'General'}
                          </Text>
                        </View>
                        <View style={[styles.tdCell, { width: 170 }]}>
                          <View style={styles.taskPill}>
                            <Text style={styles.taskPillText}>{nw.completedTasksToday} Completed</Text>
                          </View>
                        </View>
                        <View style={[styles.tdCell, { width: 190 }]}>
                          <View style={styles.marPill}>
                            <Text style={styles.marPillText}>{nw.administeredDosesToday} Doses</Text>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        )}

        {/* ── TAB 4: BED CONCURRENCY & RECONCILIATION ── */}
        {!loading && activeTab === 'reconcile' && (
          <View style={styles.reconcileContainer}>
            <LinearGradient
              colors={['rgba(30, 41, 59, 0.9)', 'rgba(15, 23, 42, 0.9)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.reconcileHeroBox,
                isMobile && { flexDirection: 'column', alignItems: 'flex-start' },
              ]}
            >
              <View style={styles.reconcileHeroIcon}>
                <Feather name="database" size={28} color="#38bdf8" />
              </View>
              <View style={styles.reconcileHeroContent}>
                <Text style={styles.reconcileHeroTitle}>Bed Concurrency Guard & State Healer</Text>
                <Text style={styles.reconcileHeroDesc}>
                  Validates active admissions against bed allocation tables, detects orphaned locks, resets ghost occupancy, and fixes desynchronized bed states.
                </Text>
                <TouchableOpacity
                  style={[styles.btnRunReconcile, reconciling && styles.btnRunReconcileRunning, isMobile && { width: '100%' }]}
                  onPress={handleRunReconciliation}
                  disabled={reconciling}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#0284c7', '#0369a1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.btnRunReconcileInner}
                  >
                    <Animated.View style={reconciling ? { transform: [{ rotate: spinRotation }] } : undefined}>
                      <Feather name="refresh-cw" size={15} color="#ffffff" style={{ marginRight: 8 }} />
                    </Animated.View>
                    <Text style={styles.btnRunReconcileText}>
                      {reconciling ? 'Reconciling Beds...' : 'Run State Reconciliation'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {reconcileResult && (
              <View style={styles.reconcileResultsPanel}>
                <Text style={styles.reconcileResultsTitle}>Reconciliation Report</Text>
                <View style={[styles.reconcileKpiRow, isMobile && { flexWrap: 'wrap' }]}>
                  <View style={[styles.rkpiBox, isMobile && { flexBasis: '47%' }]}>
                    <Text style={styles.rkpiVal}>{reconcileResult.totalBedsChecked || 0}</Text>
                    <Text style={styles.rkpiLbl}>Beds Checked</Text>
                  </View>
                  <View style={[styles.rkpiBox, isMobile && { flexBasis: '47%' }]}>
                    <Text style={styles.rkpiVal}>{reconcileResult.activeAdmissionsCount || 0}</Text>
                    <Text style={styles.rkpiLbl}>Active Inpatients</Text>
                  </View>
                  <View
                    style={[
                      styles.rkpiBox,
                      isMobile && { flexBasis: '100%' },
                      (reconcileResult.anomaliesFixedCount || 0) > 0 && styles.rkpiBoxGreen,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rkpiVal,
                        (reconcileResult.anomaliesFixedCount || 0) > 0 && { color: '#34d399' },
                      ]}
                    >
                      {reconcileResult.anomaliesFixedCount || 0}
                    </Text>
                    <Text style={styles.rkpiLbl}>Anomalies Repaired</Text>
                  </View>
                </View>

                {reconcileResult.anomaliesFixed?.length > 0 && (
                  <View style={styles.anomaliesList}>
                    <Text style={styles.anomaliesTitle}>Repaired Items:</Text>
                    {reconcileResult.anomaliesFixed.map((ano, idx) => (
                      <View key={idx} style={styles.anomalyItem}>
                        <Feather name="check-circle" size={15} color="#34d399" style={{ marginRight: 8, marginTop: 1 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.anoBed}>
                            Bed {ano.bedNumber} ({ano.ward})
                          </Text>
                          <Text style={styles.anoAction}>{ano.action}</Text>
                          <Text style={styles.anoReason}>{ano.reason}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── WARD SELECTOR MODAL ── */}
      <Modal
        visible={wardModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setWardModalOpen(false)}
      >
        <Pressable
          style={[
            styles.modalOverlay,
            {
              paddingTop: Math.max(insets.top + 16, 24),
              paddingBottom: Math.max(insets.bottom + 16, 24),
            },
          ]}
          onPress={() => setWardModalOpen(false)}
        >
          <Pressable
            style={[
              styles.wardModalCard,
              { maxHeight: Math.min(windowHeight - insets.top - insets.bottom - 48, 480) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.wardModalHeader}>
              <View style={styles.wardModalTitleRow}>
                <Feather name="filter" size={16} color="#38bdf8" style={{ marginRight: 8 }} />
                <Text style={styles.wardModalTitle}>Filter by Ward</Text>
              </View>
              <TouchableOpacity
                onPress={() => setWardModalOpen(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.modalCloseHitbox}
              >
                <Feather name="x" size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={true}>
              {availableWards.map((w) => {
                const isSelected = selectedWard === w;
                return (
                  <TouchableOpacity
                    key={w}
                    style={[styles.wardModalItem, isSelected && styles.wardModalItemActive]}
                    onPress={() => {
                      setSelectedWard(w);
                      setWardModalOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.wardModalItemText, isSelected && styles.wardModalItemTextActive]}>
                      {w === 'ALL' ? 'All Wards' : `Ward: ${w}`}
                    </Text>
                    {isSelected && <Feather name="check" size={16} color="#38bdf8" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── DISCHARGE BLOCKER MODAL / INSPECTOR ── */}
      <Modal
        visible={blockerModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setBlockerModalOpen(false)}
      >
        <Pressable
          style={[
            styles.modalOverlay,
            {
              paddingTop: Math.max(insets.top + 16, 24),
              paddingBottom: Math.max(insets.bottom + 16, 24),
            },
          ]}
          onPress={() => setBlockerModalOpen(false)}
        >
          <Pressable
            style={[
              styles.modalCard,
              { maxHeight: Math.min(windowHeight - insets.top - insets.bottom - 48, 680) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleLeft}>
                <Feather name="shield" size={24} color="#38bdf8" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>Discharge Blocker Intelligence</Text>
                  <Text style={styles.modalSubtitle}>Comprehensive Safety & Clinical Criteria Analysis</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setBlockerModalOpen(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Feather name="x" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              {loadingBlockers ? (
                <View style={styles.modalLoadingBox}>
                  <ActivityIndicator size="large" color="#38bdf8" />
                  <Text style={styles.modalLoadingText}>
                    Evaluating clinical criteria & safety checklists...
                  </Text>
                </View>
              ) : blockerData ? (
                <View>
                  {/* Decision Banner */}
                  <View
                    style={[
                      styles.blockerDecisionBanner,
                      blockerData.canDischarge ? styles.decisionBannerClear : styles.decisionBannerBlocked,
                    ]}
                  >
                    <Feather
                      name={blockerData.canDischarge ? 'check-circle' : 'alert-triangle'}
                      size={24}
                      color={blockerData.canDischarge ? '#34d399' : '#f87171'}
                      style={{ marginRight: 12, marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.bannerTitle,
                          { color: blockerData.canDischarge ? '#34d399' : '#f87171' },
                        ]}
                      >
                        {blockerData.canDischarge
                          ? 'Safety Clear: Ready for Discharge'
                          : `Discharge Blocked: ${blockerData.summary?.blockingCount || 0} Hard Blocker(s)`}
                      </Text>
                      <Text style={styles.bannerDesc}>
                        {blockerData.canDischarge
                          ? 'All hard clinical, nursing, and line removal criteria have been satisfied.'
                          : 'Patient cannot be discharged until all safety requirements below are resolved.'}
                      </Text>
                    </View>
                  </View>

                  {/* Checklist Evaluation */}
                  <View style={styles.blockersListSection}>
                    <Text style={styles.checklistTitle}>Clinical Checklist Evaluation:</Text>
                    <View style={styles.blockerItems}>
                      {(!blockerData.blockers || blockerData.blockers.length === 0) ? (
                        <Text style={styles.noBlockersText}>No active blockers reported</Text>
                      ) : (
                        blockerData.blockers.map((b, idx) => {
                          const typeLower = (b.type || '').toLowerCase();
                          const isBlocking = typeLower === 'blocking' || typeLower === 'critical' || typeLower === 'hard';
                          const isWarning = typeLower === 'warning';
                          const isInfo = typeLower === 'info';

                          return (
                            <View
                              key={idx}
                              style={[
                                styles.blockerRow,
                                isBlocking && styles.blockerRowBlocking,
                                isWarning && styles.blockerRowWarning,
                                isInfo && styles.blockerRowInfo,
                              ]}
                            >
                              <View
                                style={[
                                  styles.blockerTypePill,
                                  isBlocking && styles.blockerTypePillBlocking,
                                  isWarning && styles.blockerTypePillWarning,
                                  isInfo && styles.blockerTypePillInfo,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.blockerTypePillText,
                                    isBlocking && { color: '#fca5a5' },
                                    isWarning && { color: '#fcd34d' },
                                    isInfo && { color: '#93c5fd' },
                                  ]}
                                >
                                  {b.type}
                                </Text>
                              </View>
                              <View style={styles.blockerDetails}>
                                <Text style={styles.blockerItemTitle}>{b.title}</Text>
                                <Text style={styles.blockerItemMsg}>{b.message}</Text>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                </View>
              ) : (
                <Text style={styles.modalErrorText}>Failed to load blocker data</Text>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={[styles.modalFooter, isSmallPhone && { flexDirection: 'column-reverse', gap: 8 }]}>
              <TouchableOpacity
                style={[styles.btnCloseModal, isSmallPhone && { width: '100%', alignItems: 'center' }]}
                onPress={() => setBlockerModalOpen(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.btnCloseModalText}>Close</Text>
              </TouchableOpacity>

              {selectedAdmissionId && (
                <TouchableOpacity
                  style={[styles.btnGotoWorkspace, isSmallPhone && { width: '100%' }]}
                  onPress={() => {
                    setBlockerModalOpen(false);
                    navigation.navigate('NursePatientWorkspace', {
                      admissionId: selectedAdmissionId,
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#0284c7', '#0369a1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.btnGotoWorkspaceInner}
                  >
                    <Text style={styles.btnGotoWorkspaceText}>Open Patient Workspace</Text>
                    <Feather name="arrow-right" size={14} color="#ffffff" style={{ marginLeft: 6 }} />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );

  // Helper render function for each Kanban Column
  function renderKanbanColumn(stageKey, cfg, patients, fixedWidth, isDesktopView, isTabletView, isSingle) {
    return (
      <View
        key={stageKey}
        style={[
          styles.flowColumn,
          fixedWidth ? { width: fixedWidth, flexShrink: 0 } : null,
          isDesktopView && styles.flowColumnDesktop,
          isTabletView && styles.flowColumnTablet,
          isSingle && styles.flowColumnSingle,
        ]}
      >
        {/* Column Header */}
        <View style={[styles.flowColumnHeader, { borderTopColor: cfg.color }]}>
          <View style={styles.colTitleLeft}>
            <View style={[styles.colDot, { backgroundColor: cfg.color }]} />
            <Text style={styles.colTitle}>{cfg.label}</Text>
          </View>
          <View style={[styles.colCounterBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.colCounterText, { color: cfg.color }]}>{patients.length}</Text>
          </View>
        </View>

        {/* Column Patient Cards List */}
        <View style={styles.flowCardsList}>
          {patients.length === 0 ? (
            <View style={styles.emptyStageBox}>
              <Text style={styles.emptyStageText}>No patients in this stage</Text>
            </View>
          ) : (
            patients.map((card) => {
              const wl = card.workloadSummary || {};
              const vitals = card.latestVitals;

              return (
                <View key={card.admissionId} style={styles.patientCard}>
                  {/* Top Name & Los */}
                  <View style={styles.pcardTop}>
                    <LinearGradient
                      colors={['#0284c7', '#0369a1']}
                      style={styles.pcardAvatar}
                    >
                      <Text style={styles.pcardAvatarText}>
                        {card.patient?.name ? card.patient.name.slice(0, 2).toUpperCase() : 'PT'}
                      </Text>
                    </LinearGradient>
                    <View style={styles.pcardInfo}>
                      <View style={styles.pcardNameRow}>
                        <Text style={styles.pcardName} numberOfLines={1}>
                          {card.patient?.name || 'Unknown Patient'}
                        </Text>
                        <View style={styles.losPill}>
                          <Text style={styles.losPillText}>{card.losDays || 0}d Stay</Text>
                        </View>
                      </View>
                      <View style={styles.pcardMeta}>
                        <Text style={styles.pcardMetaText}>
                          {card.patient?.age || '—'}y / {card.patient?.gender || '—'}
                        </Text>
                        <Text style={styles.dotSep}>•</Text>
                        <Text style={styles.pcardMetaText}>MRN: {card.patient?.mrn || '—'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Location & Bed Badges */}
                  <View style={styles.locationBadgesRow}>
                    <View style={[styles.locBadge, styles.wardBadge]}>
                      <Text style={styles.wardBadgeText}>Ward: {card.location?.ward || '—'}</Text>
                    </View>
                    <View style={[styles.locBadge, styles.bedBadge]}>
                      <Text style={styles.bedBadgeText}>
                        Bed {card.location?.bedNumber || '—'} ({card.location?.bedType || 'General'})
                      </Text>
                    </View>
                  </View>

                  {/* Doctor Row */}
                  <View style={styles.doctorRow}>
                    <Feather name="user" size={13} color="#38bdf8" />
                    <Text style={styles.doctorName}>Dr. {card.doctor?.name || 'Attending'}</Text>
                  </View>

                  {/* Latest Vitals Snapshot */}
                  {vitals && (
                    <View
                      style={[
                        styles.vitalsStrip,
                        wl.hasCriticalVitals && styles.vitalsStripCritical,
                      ]}
                    >
                      <View style={styles.vitalItem}>
                        <Text style={styles.vitalLabel}>BP</Text>
                        <Text style={styles.vitalValue}>{vitals.bloodPressure || '—'}</Text>
                      </View>
                      <View style={styles.vitalItem}>
                        <Text style={styles.vitalLabel}>HR</Text>
                        <Text style={styles.vitalValue}>
                          {vitals.pulseRate ? `${vitals.pulseRate} bpm` : '—'}
                        </Text>
                      </View>
                      <View style={styles.vitalItem}>
                        <Text style={styles.vitalLabel}>SpO2</Text>
                        <Text style={styles.vitalValue}>
                          {vitals.spo2 ? `${vitals.spo2}%` : '—'}
                        </Text>
                      </View>
                      <View style={styles.vitalItem}>
                        <Text style={styles.vitalLabel}>Temp</Text>
                        <Text style={styles.vitalValue}>
                          {vitals.temperature ? `${vitals.temperature}°F` : '—'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Alert Flags Strip */}
                  <View style={styles.flagsStrip}>
                    {wl.urgentTasksCount > 0 && (
                      <View style={[styles.flagTag, styles.flagUrgent]}>
                        <Feather name="alert-triangle" size={11} color="#f87171" />
                        <Text style={styles.flagUrgentText}>
                          {wl.urgentTasksCount} Urgent Task
                        </Text>
                      </View>
                    )}
                    {wl.overdueDosesCount > 0 && (
                      <View style={[styles.flagTag, styles.flagOverdue]}>
                        <Feather name="clock" size={11} color="#fbbf24" />
                        <Text style={styles.flagOverdueText}>
                          {wl.overdueDosesCount} Overdue Dose
                        </Text>
                      </View>
                    )}
                    {wl.openClarificationsCount > 0 && (
                      <View style={[styles.flagTag, styles.flagClarification]}>
                        <Feather name="help-circle" size={11} color="#fb7185" />
                        <Text style={styles.flagClarificationText}>
                          {wl.openClarificationsCount} Clarification
                        </Text>
                      </View>
                    )}
                    {card.hasDischargeSummary && (
                      <View
                        style={[
                          styles.flagTag,
                          card.dischargeSummaryStatus === 'FINALIZED'
                            ? styles.flagSummarySigned
                            : styles.flagSummaryDraft,
                        ]}
                      >
                        <Feather
                          name="file-text"
                          size={11}
                          color={card.dischargeSummaryStatus === 'FINALIZED' ? '#34d399' : '#cbd5e1'}
                        />
                        <Text
                          style={
                            card.dischargeSummaryStatus === 'FINALIZED'
                              ? styles.flagSummarySignedText
                              : styles.flagSummaryDraftText
                          }
                        >
                          Summary: {card.dischargeSummaryStatus}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Assigned Nurses */}
                  {card.assignedNurses?.length > 0 ? (
                    <View style={styles.nurseRow}>
                      <Feather name="user-check" size={13} color="#10b981" />
                      <Text style={styles.nurseNames}>
                        Nurse: {card.assignedNurses.map((n) => n.name).join(', ')}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.nurseRow}>
                      <Feather name="alert-circle" size={13} color="#fbbf24" />
                      <Text style={styles.nurseUnassignedText}>No Nurse Assigned</Text>
                    </View>
                  )}

                  {/* Card Actions Footer */}
                  <View style={styles.pcardActions}>
                    <TouchableOpacity
                      style={styles.btnBlockers}
                      onPress={() => handleOpenBlockerModal(card.admissionId)}
                      activeOpacity={0.7}
                    >
                      <Feather name="shield" size={13} color="#e2e8f0" />
                      <Text style={styles.btnBlockersText}>Blockers</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnWorkspace}
                      onPress={() =>
                        navigation.navigate('NursePatientWorkspace', {
                          admissionId: card.admissionId,
                        })
                      }
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={['#0284c7', '#0369a1']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.btnWorkspaceInner}
                      >
                        <Text style={styles.btnWorkspaceText}>Workspace</Text>
                        <Feather name="arrow-right" size={13} color="#ffffff" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1120',
  },
  scrollContent: {
    // Dynamically applied in JSX
  },

  // ── Header ──
  ccHeader: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  ccHeaderDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  ccHeaderLeft: {
    marginBottom: 12,
  },
  ccHeaderLeftDesktop: {
    marginBottom: 0,
    flex: 1,
    marginRight: 20,
  },
  ccBadgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    minHeight: 28,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  ccBadgeLiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34d399',
    letterSpacing: 0.5,
  },
  ccMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  ccSubTitle: {
    fontSize: 12.5,
    color: '#94a3b8',
    lineHeight: 18,
  },
  ccHeaderRight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    gap: 10,
  },
  ccHeaderRightDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 0,
    borderTopWidth: 0,
    flexShrink: 0,
  },
  syncInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  syncText: {
    fontSize: 12,
    color: '#64748b',
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerActionsRowMobile: {
    width: '100%',
    gap: 8,
  },
  btnRefresh: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  btnRefreshActive: {
    opacity: 0.7,
  },
  btnRefreshText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  btnWorkspaceShortcut: {
    borderRadius: 10,
    overflow: 'hidden',
    minHeight: 44,
  },
  btnWorkspaceGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    height: '100%',
  },
  btnWorkspaceShortcutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  // ── KPI Census Deck ──
  kpiDeck: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 14,
    padding: 13,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '47%',
    minWidth: 135,
  },
  kpiCardDesktop: {
    flexBasis: 180,
    minWidth: 190,
  },
  kpiCardTablet: {
    flexBasis: 220,
    minWidth: 200,
  },
  kpiCardMobile: {
    flexBasis: '47%',
    minWidth: 135,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  kpiContent: {
    flex: 1,
    minWidth: 0,
  },
  kpiLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    flex: 1,
  },
  kpiValGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    flexWrap: 'wrap',
  },
  kpiMainVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
  },
  kpiSubVal: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  kpiBarTrack: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
  },
  kpiBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  kpiHint: {
    fontSize: 10.5,
    color: '#64748b',
    lineHeight: 14,
    marginTop: 4,
  },

  // ── Navigation Tabs Bar ──
  tabsBar: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 12,
    gap: 12,
  },
  tabsBarDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabsScroll: {
    flexDirection: 'row',
    gap: 6,
  },
  tabsScrollFlex: {
    flexGrow: 0,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    flexShrink: 0,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabBtnTextActive: {
    color: '#38bdf8',
  },
  tabPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tabPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
  },
  tabPillText: {
    fontSize: 11,
    color: '#f1f5f9',
    fontWeight: '700',
  },
  tabPillTextActive: {
    color: '#bae6fd',
  },

  // ── Filters Right ──
  flowFiltersRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flowFiltersRightMobile: {
    width: '100%',
    flexDirection: 'column',
    gap: 8,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    minWidth: 180,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wardSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  wardSelectBtnText: {
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: '600',
  },

  // ── Stage Filter Pills ──
  stageFilterPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 6,
  },
  stagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 13,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexShrink: 0,
  },
  stagePillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
  },
  stageDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  stagePillText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  stagePillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  stageCountBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  stageCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
  },

  // ── Flow Columns Container ──
  boardWrapper: {
    gap: 14,
  },
  kanbanHorizontalScroll: {
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 10,
  },
  flowColumnsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'flex-start',
  },
  flowColumn: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 4,
  },
  flowColumnDesktop: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 290,
    minWidth: 280,
    maxWidth: 380,
  },
  flowColumnTablet: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 320,
    minWidth: 300,
    maxWidth: 480,
  },
  flowColumnSingle: {
    maxWidth: '100%',
    flexBasis: '100%',
  },
  flowColumnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderTopWidth: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  colTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  colDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  colTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  colCounterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  colCounterText: {
    fontSize: 12,
    fontWeight: '800',
  },
  flowCardsList: {
    padding: 12,
    gap: 12,
  },
  emptyStageBox: {
    minHeight: 110,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
  },
  emptyStageText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },

  // ── Patient Card ──
  patientCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 13,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  pcardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pcardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  pcardAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  pcardInfo: {
    flex: 1,
    minWidth: 0,
  },
  pcardNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  pcardName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
  },
  losPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    flexShrink: 0,
  },
  losPillText: {
    fontSize: 10.5,
    color: '#fbbf24',
    fontWeight: '700',
  },
  pcardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  pcardMetaText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  dotSep: {
    marginHorizontal: 4,
    color: '#64748b',
    fontSize: 11,
  },

  // Location Badges
  locationBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  locBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  wardBadge: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
  },
  wardBadgeText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '600',
  },
  bedBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  bedBadgeText: {
    fontSize: 11,
    color: '#c084fc',
    fontWeight: '600',
  },

  // Doctor Row
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  doctorName: {
    fontSize: 11.5,
    color: '#cbd5e1',
    fontWeight: '500',
    flex: 1,
  },

  // Vitals Strip
  vitalsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  vitalsStripCritical: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  vitalItem: {
    flex: 1,
    alignItems: 'center',
  },
  vitalLabel: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '700',
  },
  vitalValue: {
    fontSize: 11,
    color: '#f1f5f9',
    fontWeight: '700',
    marginTop: 1,
  },

  // Flags Strip
  flagsStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  flagTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 1,
  },
  flagUrgent: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  flagUrgentText: {
    fontSize: 10.5,
    color: '#f87171',
    fontWeight: '600',
  },
  flagOverdue: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  flagOverdueText: {
    fontSize: 10.5,
    color: '#fbbf24',
    fontWeight: '600',
  },
  flagClarification: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  flagClarificationText: {
    fontSize: 10.5,
    color: '#fb7185',
    fontWeight: '600',
  },
  flagSummarySigned: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  flagSummarySignedText: {
    fontSize: 10.5,
    color: '#34d399',
    fontWeight: '600',
  },
  flagSummaryDraft: {
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  flagSummaryDraftText: {
    fontSize: 10.5,
    color: '#cbd5e1',
    fontWeight: '600',
  },

  // Nurse Row
  nurseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nurseNames: {
    fontSize: 11,
    color: '#94a3b8',
    flex: 1,
    flexWrap: 'wrap',
  },
  nurseUnassignedText: {
    fontSize: 11,
    color: '#fbbf24',
    fontWeight: '600',
  },

  // Card Actions
  pcardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  btnBlockers: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingVertical: 9,
    minHeight: 44,
  },
  btnBlockersText: {
    fontSize: 12,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  btnWorkspace: {
    flex: 1.3,
    borderRadius: 8,
    overflow: 'hidden',
    minHeight: 44,
  },
  btnWorkspaceInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    height: '100%',
  },
  btnWorkspaceText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },

  // ── Tab 2: Ward Breakdown ──
  wardBreakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'flex-start',
  },
  wardCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 3,
  },
  wardCardDesktop: {
    flexGrow: 1,
    flexBasis: 320,
    minWidth: 300,
    maxWidth: 480,
  },
  wardCardTablet: {
    flexGrow: 1,
    flexBasis: 320,
    minWidth: 300,
  },
  wardCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wardName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
  },
  wardOccupancyPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  wardOccupancyPillText: {
    fontSize: 11.5,
    color: '#38bdf8',
    fontWeight: '700',
  },
  wardMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  wStat: {
    alignItems: 'center',
  },
  wStatNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  wStatLbl: {
    fontSize: 10.5,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  wardProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 14,
  },
  wardProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  wardActivePatientsPreview: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
  },
  wardActivePatientsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 8,
  },
  wardPtList: {
    gap: 6,
  },
  noPtText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  wardPtItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    minHeight: 44,
  },
  wptBed: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#38bdf8',
  },
  wptName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f1f5f9',
    flex: 1,
  },
  wptDoc: {
    fontSize: 11,
    color: '#94a3b8',
  },

  // ── Tab 3: Analytics ──
  analyticsContainer: {
    gap: 18,
  },
  analyticsTopDeck: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  analyticsSummaryCard: {
    flex: 1,
    minWidth: 240,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
  },
  analyticsCardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 8,
  },
  alosMetricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
  },
  alosNumber: {
    fontSize: 32,
    fontWeight: '900',
    color: '#38bdf8',
  },
  alosUnit: {
    fontSize: 15,
    color: '#94a3b8',
  },
  alosSub: {
    fontSize: 11.5,
    color: '#64748b',
    lineHeight: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  balBox: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  balBoxAdmissions: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  balBoxDischarges: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  balNumGreen: {
    fontSize: 22,
    fontWeight: '800',
    color: '#34d399',
  },
  balNumRed: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f87171',
  },
  balLbl: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  analyticsTableCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
  },
  tableCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  tableCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  timeframeButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  btnTimeframe: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
  },
  btnTimeframeActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  btnTimeframeText: {
    fontSize: 11.5,
    color: '#94a3b8',
    fontWeight: '600',
  },
  btnTimeframeTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  chartLegendRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColorBox: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11.5,
    color: '#94a3b8',
  },
  trendsBarChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    height: 170,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  trendDayCol: {
    alignItems: 'center',
    minWidth: 44,
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 130,
    marginBottom: 6,
  },
  barAdmissions: {
    width: 14,
    backgroundColor: '#10b981',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  barDischarges: {
    width: 14,
    backgroundColor: '#f43f5e',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  barCountText: {
    fontSize: 8,
    color: '#ffffff',
    fontWeight: '800',
    marginTop: 2,
  },
  trendDateLbl: {
    fontSize: 10.5,
    color: '#64748b',
  },

  // ── Workload Table ──
  workloadTableWrapper: {
    width: '100%',
  },
  tableInner: {
    minWidth: 870,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
  },
  thCell: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.5,
    paddingHorizontal: 10,
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 10,
    minHeight: 44,
  },
  tableDataRowAlt: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  tdCell: {
    paddingHorizontal: 10,
  },
  nurseCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nurseNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  countPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  countPillText: {
    fontSize: 11.5,
    color: '#38bdf8',
    fontWeight: '700',
  },
  wardCoveredText: {
    fontSize: 12.5,
    color: '#e2e8f0',
  },
  taskPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  taskPillText: {
    fontSize: 11.5,
    color: '#34d399',
    fontWeight: '700',
  },
  marPill: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  marPillText: {
    fontSize: 11.5,
    color: '#c084fc',
    fontWeight: '700',
  },
  emptyTableBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyTableText: {
    fontSize: 12.5,
    color: '#64748b',
    fontStyle: 'italic',
  },

  // ── Tab 4: Bed Reconciliation ──
  reconcileContainer: {
    gap: 16,
  },
  reconcileHeroBox: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
  },
  reconcileHeroIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  reconcileHeroContent: {
    flex: 1,
  },
  reconcileHeroTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 5,
  },
  reconcileHeroDesc: {
    fontSize: 12.5,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 14,
  },
  btnRunReconcile: {
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
    minHeight: 44,
  },
  btnRunReconcileRunning: {
    opacity: 0.7,
  },
  btnRunReconcileInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    height: '100%',
  },
  btnRunReconcileText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  reconcileResultsPanel: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
  },
  reconcileResultsTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 14,
  },
  reconcileKpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  rkpiBox: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    minHeight: 70,
    justifyContent: 'center',
  },
  rkpiBoxGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  rkpiVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
  },
  rkpiLbl: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 3,
    textAlign: 'center',
  },
  anomaliesList: {
    gap: 8,
  },
  anomaliesTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  anomalyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
    borderRadius: 6,
    padding: 10,
  },
  anoBed: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  anoAction: {
    fontSize: 12,
    color: '#34d399',
    fontWeight: '600',
    marginTop: 1,
  },
  anoReason: {
    fontSize: 11.5,
    color: '#94a3b8',
    marginTop: 2,
  },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.7,
    shadowRadius: 40,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseHitbox: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 16,
  },
  modalLoadingBox: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 12,
  },
  modalLoadingText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  blockerDecisionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  decisionBannerClear: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  decisionBannerBlocked: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  bannerDesc: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 17,
  },
  blockersListSection: {
    marginBottom: 8,
  },
  checklistTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 10,
  },
  blockerItems: {
    gap: 9,
  },
  noBlockersText: {
    fontSize: 12.5,
    color: '#64748b',
    fontStyle: 'italic',
  },
  blockerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#64748b',
    padding: 11,
  },
  blockerRowBlocking: {
    borderLeftColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  blockerRowWarning: {
    borderLeftColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  blockerRowInfo: {
    borderLeftColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  blockerTypePill: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  blockerTypePillBlocking: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  blockerTypePillWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  blockerTypePillInfo: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  blockerTypePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  blockerDetails: {
    flex: 1,
  },
  blockerItemTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 2,
  },
  blockerItemMsg: {
    fontSize: 11.5,
    color: '#94a3b8',
    lineHeight: 16,
  },
  modalErrorText: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  btnCloseModal: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 44,
    justifyContent: 'center',
  },
  btnCloseModalText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  btnGotoWorkspace: {
    borderRadius: 8,
    overflow: 'hidden',
    minHeight: 44,
  },
  btnGotoWorkspaceInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    height: '100%',
  },
  btnGotoWorkspaceText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#ffffff',
  },

  // ── Ward Modal ──
  wardModalCard: {
    width: '90%',
    maxWidth: 360,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  wardModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 6,
  },
  wardModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wardModalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  wardModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 8,
  },
  wardModalItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  wardModalItemText: {
    fontSize: 13,
    color: '#cbd5e1',
  },
  wardModalItemTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },

  // ── Loading Container ──
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13.5,
    color: '#94a3b8',
  },
});
