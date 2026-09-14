import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ipdCommandCenterAPI } from '../../utils/api';
import socket from '../../utils/socket';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STAGE_CONFIG = {
  ADMITTED: { label: 'Admitted (<24h)', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: '#93c5fd' },
  ACTIVE_CARE: { label: 'Active Care', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.12)', border: '#7dd3fc' },
  INVESTIGATION: { label: 'Investigation', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', border: '#c4b5fd' },
  PROCEDURE_OT: { label: 'OT / Procedure', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', border: '#f9a8d4' },
  POST_OP: { label: 'Post-Op Recovery', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: '#fcd34d' },
  DISCHARGE_PLANNED: { label: 'Discharge Planned', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: '#6ee7b7' },
  DISCHARGE_CLEARANCE: { label: 'Safety Clearance', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)', border: '#34d399' },
  DISCHARGED: { label: 'Discharged (24h)', color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', border: '#cbd5e1' },
};

export default function IPDCommandCenter({ navigation }) {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 1024;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;
  const isMobile = windowWidth < 768;

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
  const [wardDropdownOpen, setWardDropdownOpen] = useState(false);

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
    if (!socket) return;

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

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Command Bar ── */}
        <View style={[styles.ccHeader, !isMobile && styles.ccHeaderDesktop]}>
          <View style={[styles.ccHeaderLeft, !isMobile && styles.ccHeaderLeftDesktop]}>
            <View style={styles.ccBadgeLive}>
              <View style={styles.pulseDot} />
              <Text style={styles.ccBadgeLiveText}>LIVE COMMAND CENTER</Text>
            </View>
            <Text style={styles.ccMainTitle}>IPD Clinical Operations & Census</Text>
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

            <View style={[styles.headerActionsRow, !isMobile && styles.headerActionsRowDesktop]}>
              <TouchableOpacity
                style={[styles.btnRefresh, refreshing && styles.btnRefreshActive]}
                onPress={() => fetchCommandCenterData(false)}
                activeOpacity={0.7}
              >
                <Feather name="refresh-cw" size={14} color="#e2e8f0" />
                <Text style={styles.btnRefreshText}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnWorkspaceShortcut}
                onPress={() => navigation.navigate('NurseDashboard')}
                activeOpacity={0.8}
              >
                <Feather name="user-check" size={14} color="#ffffff" />
                <Text style={styles.btnWorkspaceShortcutText}>Nurse Station</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── KPI Census Deck (6 Cards) ── */}
        <View style={styles.kpiDeck}>
          {/* 1. Bed Occupancy */}
          <View style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop, isTablet && styles.kpiCardTablet]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Feather name="pie-chart" size={22} color="#3b82f6" />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiLabel}>BED OCCUPANCY</Text>
              <View style={styles.kpiValGroup}>
                <Text style={styles.kpiMainVal}>{census?.occupancyRate || '0%'}</Text>
                <Text style={styles.kpiSubVal}>
                  ({census?.occupiedBeds || 0} / {census?.totalBeds || 0} Beds)
                </Text>
              </View>
              <View style={styles.kpiBarTrack}>
                <View
                  style={[
                    styles.kpiBarFill,
                    {
                      width: `${Math.min(100, census?.occupancyRateValue || parseFloat(census?.occupancyRate) || 0)}%`,
                      backgroundColor: '#3b82f6',
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* 2. Active Inpatients */}
          <View style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop, isTablet && styles.kpiCardTablet]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(14, 165, 233, 0.15)' }]}>
              <Feather name="users" size={22} color="#0ea5e9" />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiLabel}>ACTIVE INPATIENTS</Text>
              <View style={styles.kpiValGroup}>
                <Text style={styles.kpiMainVal}>{census?.activeInpatients || 0}</Text>
                <Text style={[styles.kpiSubVal, { color: '#10b981' }]}>
                  +{census?.admittedToday || 0} Today
                </Text>
              </View>
              <Text style={styles.kpiHint}>
                {census?.unassignedPatients ? `⚠️ ${census.unassignedPatients} unassigned` : 'All patients assigned to nurses'}
              </Text>
            </View>
          </View>

          {/* 3. Discharge Pipeline */}
          <View style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop, isTablet && styles.kpiCardTablet]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Feather name="log-out" size={22} color="#10b981" />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiLabel}>DISCHARGE PIPELINE</Text>
              <View style={styles.kpiValGroup}>
                <Text style={styles.kpiMainVal}>{census?.dischargesPlanned || 0}</Text>
                <Text style={styles.kpiSubVal}>Planned</Text>
              </View>
              <Text style={styles.kpiHint}>
                {census?.dischargesToday || 0} completed discharges today
              </Text>
            </View>
          </View>

          {/* 4. Long-Stay Patients */}
          <View style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop, isTablet && styles.kpiCardTablet]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
              <Feather name="clock" size={22} color="#f59e0b" />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiLabel}>LONG-STAY PATIENTS</Text>
              <View style={styles.kpiValGroup}>
                <Text style={styles.kpiMainVal}>{census?.longStayCount || 0}</Text>
                <Text style={styles.kpiSubVal}>Stay &gt; 7 Days</Text>
              </View>
              <Text style={styles.kpiHint}>Clinical course review suggested</Text>
            </View>
          </View>

          {/* 5. Clinical Workload */}
          <View style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop, isTablet && styles.kpiCardTablet]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Feather name="activity" size={22} color="#8b5cf6" />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiLabel}>CLINICAL WORKLOAD</Text>
              <View style={styles.kpiValGroup}>
                <Text style={styles.kpiMainVal}>
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
          <View style={[styles.kpiCard, isDesktop && styles.kpiCardDesktop, isTablet && styles.kpiCardTablet]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
              <Feather name="help-circle" size={22} color="#f43f5e" />
            </View>
            <View style={styles.kpiContent}>
              <Text style={styles.kpiLabel}>CLARIFICATIONS</Text>
              <View style={styles.kpiValGroup}>
                <Text style={styles.kpiMainVal}>{workload?.openClarifications || 0}</Text>
                <Text style={styles.kpiSubVal}>Open Doctor Questions</Text>
              </View>
              <Text style={styles.kpiHint}>Doctor ↔ Nurse active threads</Text>
            </View>
          </View>
        </View>

        {/* ── Navigation Tabs & Filters Bar ── */}
        <View style={[styles.tabsBar, !isMobile && styles.tabsBarDesktop]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScroll}
            style={styles.tabsScrollFlex}
          >
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'board' && styles.tabBtnActive]}
              onPress={() => setActiveTab('board')}
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
            >
              <Feather name="trending-up" size={15} color={activeTab === 'analytics' ? '#38bdf8' : '#94a3b8'} />
              <Text style={[styles.tabBtnText, activeTab === 'analytics' && styles.tabBtnTextActive]}>
                Census & ALOS Analytics
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'reconcile' && styles.tabBtnActive]}
              onPress={() => setActiveTab('reconcile')}
            >
              <Feather name="database" size={15} color={activeTab === 'reconcile' ? '#38bdf8' : '#94a3b8'} />
              <Text style={[styles.tabBtnText, activeTab === 'reconcile' && styles.tabBtnTextActive]}>
                Bed Concurrency Tool
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Right filters (Search & Ward Selector) on the same row on desktop/tablet */}
          {activeTab === 'board' && (
            <View style={[styles.flowFiltersRight, isMobile && styles.flowFiltersRightMobile]}>
              <View style={styles.searchWrap}>
                <Feather name="search" size={15} color="#94a3b8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search patient, MRN, Bed..."
                  placeholderTextColor="#64748b"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Feather name="x" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Ward Selector */}
              <View style={styles.wardFilterWrap}>
                <TouchableOpacity
                  style={styles.wardSelectBtn}
                  onPress={() => setWardDropdownOpen(!wardDropdownOpen)}
                >
                  <Feather name="filter" size={14} color="#38bdf8" />
                  <Text style={styles.wardSelectBtnText}>
                    {selectedWard === 'ALL' ? 'All Wards' : `Ward: ${selectedWard}`}
                  </Text>
                  <Feather name="chevron-down" size={14} color="#94a3b8" />
                </TouchableOpacity>

                {wardDropdownOpen && (
                  <View style={styles.wardDropdownMenu}>
                    {availableWards.map((w) => (
                      <TouchableOpacity
                        key={w}
                        style={[styles.wardDropdownItem, selectedWard === w && styles.wardDropdownItemActive]}
                        onPress={() => {
                          setSelectedWard(w);
                          setWardDropdownOpen(false);
                        }}
                      >
                        <Text style={[styles.wardDropdownItemText, selectedWard === w && styles.wardDropdownItemTextActive]}>
                          {w === 'ALL' ? 'All Wards' : `Ward: ${w}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
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
              contentContainerStyle={styles.stageFilterPillsScroll}
            >
              <TouchableOpacity
                style={[styles.stagePill, selectedStage === 'ALL' && styles.stagePillActive]}
                onPress={() => setSelectedStage('ALL')}
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
                      { borderColor: cfg.border },
                      isSelected && { backgroundColor: cfg.bg, borderColor: cfg.color },
                    ]}
                    onPress={() => setSelectedStage(stageKey)}
                  >
                    <View style={[styles.stageDot, { backgroundColor: cfg.color }]} />
                    <Text style={[styles.stagePillText, isSelected && { color: '#f8fafc', fontWeight: '700' }]}>
                      {cfg.label}
                    </Text>
                    <View style={[styles.stageCountBadge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.stageCountText, { color: cfg.color }]}>{count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Kanban Columns */}
            <View style={styles.flowColumnsContainer}>
              {Object.entries(STAGE_CONFIG).map(([stageKey, cfg]) => {
                const patients = flowBoard[stageKey] || [];
                if (selectedStage !== 'ALL' && selectedStage !== stageKey) return null;

                return (
                  <View
                    key={stageKey}
                    style={[
                      styles.flowColumn,
                      isDesktop && styles.flowColumnDesktop,
                      isTablet && styles.flowColumnTablet,
                      selectedStage !== 'ALL' && styles.flowColumnSingle,
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

                    {/* Column Patient Cards */}
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
                                <View style={styles.pcardAvatar}>
                                  <Text style={styles.pcardAvatarText}>
                                    {card.patient?.name ? card.patient.name.slice(0, 2).toUpperCase() : 'PT'}
                                  </Text>
                                </View>
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
                                <Feather name="user" size={13} color="#94a3b8" />
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
                                    <Feather name="alert-triangle" size={11} color="#f59e0b" />
                                    <Text style={styles.flagUrgentText}>
                                      {wl.urgentTasksCount} Urgent Task{wl.urgentTasksCount > 1 ? 's' : ''}
                                    </Text>
                                  </View>
                                )}
                                {wl.overdueDosesCount > 0 && (
                                  <View style={[styles.flagTag, styles.flagOverdue]}>
                                    <Feather name="clock" size={11} color="#ef4444" />
                                    <Text style={styles.flagOverdueText}>
                                      {wl.overdueDosesCount} Overdue Dose{wl.overdueDosesCount > 1 ? 's' : ''}
                                    </Text>
                                  </View>
                                )}
                                {wl.openClarificationsCount > 0 && (
                                  <View style={[styles.flagTag, styles.flagClarification]}>
                                    <Feather name="help-circle" size={11} color="#38bdf8" />
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
                                      color={card.dischargeSummaryStatus === 'FINALIZED' ? '#10b981' : '#f59e0b'}
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
                                  <Text style={styles.nurseNames} numberOfLines={1}>
                                    Nurse: {card.assignedNurses.map((n) => n.name).join(', ')}
                                  </Text>
                                </View>
                              ) : (
                                <View style={[styles.nurseRow, styles.nurseRowUnassigned]}>
                                  <Feather name="alert-circle" size={13} color="#f59e0b" />
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
                                  <Feather name="shield" size={13} color="#38bdf8" />
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
                                  <Text style={styles.btnWorkspaceText}>Workspace</Text>
                                  <Feather name="arrow-right" size={13} color="#ffffff" />
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
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
                <View style={styles.wardMetricsRow}>
                  <View style={styles.wStat}>
                    <Text style={styles.wStatNum}>{w.totalBeds}</Text>
                    <Text style={styles.wStatLbl}>Total Beds</Text>
                  </View>
                  <View style={styles.wStat}>
                    <Text style={[styles.wStatNum, { color: '#0ea5e9' }]}>{w.occupiedBeds}</Text>
                    <Text style={styles.wStatLbl}>Occupied</Text>
                  </View>
                  <View style={styles.wStat}>
                    <Text style={[styles.wStatNum, { color: '#10b981' }]}>{w.availableBeds}</Text>
                    <Text style={styles.wStatLbl}>Available</Text>
                  </View>
                  <View style={styles.wStat}>
                    <Text style={[styles.wStatNum, { color: '#f59e0b' }]}>{w.maintenanceBeds}</Text>
                    <Text style={styles.wStatLbl}>Maint.</Text>
                  </View>
                </View>

                {/* Ward Progress Bar */}
                <View style={styles.wardProgressBar}>
                  <View
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
                          <View style={styles.wptBedBadge}>
                            <Text style={styles.wptBedText}>Bed {pt.bedNumber}</Text>
                          </View>
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
              <View style={styles.tableCardHeader}>
                <Text style={styles.tableCardTitle}>Daily Census Timeline ({trendsDays} Days)</Text>
                <View style={styles.timeframeButtonsRow}>
                  {[7, 14, 30].map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={[styles.btnTimeframe, trendsDays === days && styles.btnTimeframeActive]}
                      onPress={() => setTrendsDays(days)}
                    >
                      <Text
                        style={[
                          styles.btnTimeframeText,
                          trendsDays === days && styles.btnTimeframeTextActive,
                        ]}
                      >
                        {days}D
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Chart Legend */}
              <View style={styles.chartLegendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColorBox, { backgroundColor: '#3b82f6' }]} />
                  <Text style={styles.legendText}>Admissions</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColorBox, { backgroundColor: '#10b981' }]} />
                  <Text style={styles.legendText}>Discharges</Text>
                </View>
              </View>

              {/* Bar Chart Scroll */}
              <ScrollView horizontal showsHorizontalScrollIndicator={true} contentContainerStyle={styles.trendsBarChart}>
                {(trendsData?.dailyTrends || []).map((day, idx) => (
                  <View key={idx} style={styles.trendDayCol}>
                    <View style={styles.barPair}>
                      <View
                        style={[
                          styles.barAdmissions,
                          { height: Math.max(4, Math.min(120, (day.admissions || 0) * 16 + 4)) },
                        ]}
                      >
                        {day.admissions > 0 && (
                          <Text style={styles.barCountText}>{day.admissions}</Text>
                        )}
                      </View>
                      <View
                        style={[
                          styles.barDischarges,
                          { height: Math.max(4, Math.min(120, (day.discharges || 0) * 16 + 4)) },
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

            {/* Nurse Workload Distribution */}
            <View style={styles.analyticsTableCard}>
              <View style={styles.tableCardHeader}>
                <Text style={styles.tableCardTitle}>Active Nurse Workload & Performance Today</Text>
              </View>

              {nurseWorkloadData.length === 0 ? (
                <View style={styles.emptyTableBox}>
                  <Text style={styles.emptyTableText}>No nurse assignments found</Text>
                </View>
              ) : (
                <View style={styles.nurseTable}>
                  {nurseWorkloadData.map((nw, idx) => (
                    <View key={idx} style={styles.nurseRowCard}>
                      <View style={styles.nurseCardTop}>
                        <View style={styles.nurseCardLeft}>
                          <Feather name="user" size={14} color="#38bdf8" style={{ marginRight: 6 }} />
                          <Text style={styles.nurseCardName}>{nw.nurseName}</Text>
                        </View>
                        <View style={styles.nursePatientsPill}>
                          <Text style={styles.nursePatientsPillText}>
                            {nw.activePatientsCount} Patients
                          </Text>
                        </View>
                      </View>

                      <View style={styles.nurseCardBottom}>
                        <Text style={styles.nurseWardsText}>
                          Wards: {nw.assignedWards?.join(', ') || 'General'}
                        </Text>
                        <View style={styles.nurseStatsPillsRow}>
                          <View style={styles.taskPill}>
                            <Text style={styles.taskPillText}>{nw.completedTasksToday} Tasks</Text>
                          </View>
                          <View style={styles.marPill}>
                            <Text style={styles.marPillText}>{nw.administeredDosesToday} Doses</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── TAB 4: BED CONCURRENCY & RECONCILIATION ── */}
        {!loading && activeTab === 'reconcile' && (
          <View style={styles.reconcileContainer}>
            <View style={styles.reconcileHeroBox}>
              <View style={styles.reconcileHeroIcon}>
                <Feather name="database" size={32} color="#38bdf8" />
              </View>
              <View style={styles.reconcileHeroContent}>
                <Text style={styles.reconcileHeroTitle}>Bed Concurrency Guard & State Healer</Text>
                <Text style={styles.reconcileHeroDesc}>
                  Validates active admissions against bed allocation tables, detects orphaned locks, resets ghost occupancy, and fixes desynchronized bed states.
                </Text>
                <TouchableOpacity
                  style={[styles.btnRunReconcile, reconciling && styles.btnRunReconcileRunning]}
                  onPress={handleRunReconciliation}
                  disabled={reconciling}
                  activeOpacity={0.8}
                >
                  <Feather
                    name="refresh-cw"
                    size={16}
                    color="#ffffff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.btnRunReconcileText}>
                    {reconciling ? 'Reconciling Beds...' : 'Run State Reconciliation'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {reconcileResult && (
              <View style={styles.reconcileResultsPanel}>
                <Text style={styles.reconcileResultsTitle}>Reconciliation Report</Text>
                <View style={styles.reconcileKpiRow}>
                  <View style={styles.rkpiBox}>
                    <Text style={styles.rkpiVal}>{reconcileResult.totalBedsChecked || 0}</Text>
                    <Text style={styles.rkpiLbl}>Beds Checked</Text>
                  </View>
                  <View style={styles.rkpiBox}>
                    <Text style={styles.rkpiVal}>{reconcileResult.activeAdmissionsCount || 0}</Text>
                    <Text style={styles.rkpiLbl}>Active Inpatients</Text>
                  </View>
                  <View
                    style={[
                      styles.rkpiBox,
                      (reconcileResult.anomaliesFixedCount || 0) > 0 && styles.rkpiBoxGreen,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rkpiVal,
                        (reconcileResult.anomaliesFixedCount || 0) > 0 && { color: '#10b981' },
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
                        <Feather name="check-circle" size={15} color="#10b981" style={{ marginRight: 8 }} />
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

      {/* ── DISCHARGE BLOCKER MODAL / INSPECTOR ── */}
      <Modal
        visible={blockerModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setBlockerModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleLeft}>
                <View style={styles.modalShieldIconWrap}>
                  <Feather name="shield" size={18} color="#38bdf8" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Discharge Blocker Intelligence</Text>
                  <Text style={styles.modalSubtitle}>Comprehensive Safety & Clinical Criteria Analysis</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setBlockerModalOpen(false)}
              >
                <Feather name="x" size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
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
                      size={22}
                      color={blockerData.canDischarge ? '#10b981' : '#ef4444'}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.bannerTitle,
                          { color: blockerData.canDischarge ? '#10b981' : '#ef4444' },
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
                        blockerData.blockers.map((b, idx) => (
                          <View key={idx} style={styles.blockerRow}>
                            <View style={[styles.blockerTypePill, { backgroundColor: getBlockerTypeBg(b.type) }]}>
                              <Text style={[styles.blockerTypePillText, { color: getBlockerTypeColor(b.type) }]}>
                                {b.type}
                              </Text>
                            </View>
                            <View style={styles.blockerDetails}>
                              <Text style={styles.blockerItemTitle}>{b.title}</Text>
                              <Text style={styles.blockerItemMsg}>{b.message}</Text>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                </View>
              ) : (
                <Text style={styles.modalErrorText}>Failed to load blocker data</Text>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnCloseModal}
                onPress={() => setBlockerModalOpen(false)}
              >
                <Text style={styles.btnCloseModalText}>Close</Text>
              </TouchableOpacity>

              {selectedAdmissionId && (
                <TouchableOpacity
                  style={styles.btnGotoWorkspace}
                  onPress={() => {
                    setBlockerModalOpen(false);
                    navigation.navigate('NursePatientWorkspace', {
                      admissionId: selectedAdmissionId,
                    });
                  }}
                >
                  <Text style={styles.btnGotoWorkspaceText}>Open Patient Workspace</Text>
                  <Feather name="arrow-right" size={14} color="#ffffff" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getBlockerTypeBg(type = '') {
  const t = type.toUpperCase();
  if (t === 'BLOCKING' || t === 'CRITICAL' || t === 'HARD' || t === 'ERROR') return 'rgba(239, 68, 68, 0.15)';
  if (t === 'WARNING' || t === 'MEDIUM') return 'rgba(245, 158, 11, 0.15)';
  return 'rgba(56, 189, 248, 0.15)';
}

function getBlockerTypeColor(type = '') {
  const t = type.toUpperCase();
  if (t === 'BLOCKING' || t === 'CRITICAL' || t === 'HARD' || t === 'ERROR') return '#ef4444';
  if (t === 'WARNING' || t === 'MEDIUM') return '#f59e0b';
  return '#38bdf8';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1120',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  scrollContentDesktop: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    paddingBottom: 48,
  },

  // ── Header ──
  ccHeader: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  ccHeaderDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 22,
  },
  ccHeaderLeft: {
    marginBottom: 12,
  },
  ccHeaderLeftDesktop: {
    marginBottom: 0,
    flex: 1,
    marginRight: 24,
  },
  ccBadgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  pulseDot: {
    width: 7,
    height: 7,
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
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  ccSubTitle: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19,
  },
  ccHeaderRight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
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
    gap: 8,
    marginTop: 6,
  },
  headerActionsRowDesktop: {
    marginTop: 0,
    gap: 10,
  },
  btnRefresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  btnRefreshActive: {
    opacity: 0.6,
  },
  btnRefreshText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  btnWorkspaceShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  btnWorkspaceShortcutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  // ── KPI Deck ──
  kpiDeck: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 18,
  },
  kpiCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '47%',
    minWidth: 150,
  },
  kpiCardDesktop: {
    flexBasis: 180,
    minWidth: 190,
  },
  kpiCardTablet: {
    flexBasis: 220,
    minWidth: 200,
  },
  kpiIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  kpiContent: {
    flex: 1,
    minWidth: 0,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  kpiValGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
  },
  kpiMainVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
  },
  kpiSubVal: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  kpiBarTrack: {
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
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },

  // ── Tabs Bar ──
  tabsBar: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 12,
    marginBottom: 16,
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
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
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

  // ── Flow Filters (in Tabs bar on desktop) ──
  flowFiltersRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flowFiltersRightMobile: {
    width: '100%',
    flexWrap: 'wrap',
  },
  searchWrap: {
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
  },
  wardFilterWrap: {
    position: 'relative',
    minWidth: 130,
  },
  wardSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
  },
  wardSelectBtnText: {
    fontSize: 12,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  wardDropdownMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  wardDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  wardDropdownItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  wardDropdownItemText: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  wardDropdownItemTextActive: {
    color: '#38bdf8',
    fontWeight: '700',
  },

  // ── Stage Filter Pills ──
  stageFilterPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  stagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#38bdf8',
    fontWeight: '700',
  },
  stageCountBadge: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  stageCountText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Flow Columns Container ──
  flowColumnsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    alignItems: 'flex-start',
  },
  flowColumn: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 400,
    width: '100%',
  },
  flowColumnDesktop: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 285,
    minWidth: 280,
    maxWidth: 380,
    width: undefined,
  },
  flowColumnTablet: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 320,
    minWidth: 300,
    maxWidth: 480,
    width: undefined,
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
    paddingVertical: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderTopWidth: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  colTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    margin: 8,
  },
  emptyStageText: {
    fontSize: 12.5,
    color: '#64748b',
    fontStyle: 'italic',
  },

  // ── Patient Card ──
  patientCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
  },
  pcardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  pcardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pcardAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  pcardInfo: {
    flex: 1,
  },
  pcardNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  pcardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
    marginRight: 6,
  },
  losPill: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  losPillText: {
    fontSize: 10,
    color: '#38bdf8',
    fontWeight: '700',
  },
  pcardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pcardMetaText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  dotSep: {
    color: '#64748b',
    fontSize: 10,
  },

  // Location Badges
  locationBadgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  locBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  wardBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  wardBadgeText: {
    fontSize: 10,
    color: '#60a5fa',
    fontWeight: '600',
  },
  bedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  bedBadgeText: {
    fontSize: 10,
    color: '#34d399',
    fontWeight: '600',
  },

  // Doctor Row
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  doctorName: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '500',
  },

  // Vitals Strip
  vitalsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  vitalsStripCritical: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  vitalItem: {
    alignItems: 'center',
  },
  vitalLabel: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '600',
  },
  vitalValue: {
    fontSize: 11,
    color: '#f8fafc',
    fontWeight: '700',
    marginTop: 1,
  },

  // Flags Strip
  flagsStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  flagTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  flagUrgent: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  flagUrgentText: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '600',
  },
  flagOverdue: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  flagOverdueText: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '600',
  },
  flagClarification: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  flagClarificationText: {
    fontSize: 10,
    color: '#38bdf8',
    fontWeight: '600',
  },
  flagSummarySigned: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  flagSummarySignedText: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: '600',
  },
  flagSummaryDraft: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  flagSummaryDraftText: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '600',
  },

  // Nurse Row
  nurseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  nurseNames: {
    fontSize: 11,
    color: '#34d399',
    flex: 1,
  },
  nurseRowUnassigned: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nurseUnassignedText: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600',
  },

  // Card Actions
  pcardActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
  },
  btnBlockers: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 8,
    paddingVertical: 6,
  },
  btnBlockersText: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '600',
  },
  btnWorkspace: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#0284c7',
    borderRadius: 8,
    paddingVertical: 6,
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
    gap: 18,
    alignItems: 'flex-start',
  },
  wardCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    width: '100%',
  },
  wardCardDesktop: {
    flexGrow: 1,
    flexBasis: 320,
    minWidth: 300,
    maxWidth: 480,
    width: undefined,
  },
  wardCardTablet: {
    flexGrow: 1,
    flexBasis: 320,
    minWidth: 300,
    width: undefined,
  },
  wardCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  wardOccupancyPill: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  wardOccupancyPillText: {
    fontSize: 11,
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
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  wStatLbl: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  wardProgressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  wardProgressFill: {
    height: '100%',
    backgroundColor: '#0284c7',
    borderRadius: 3,
  },
  wardActivePatientsPreview: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
  },
  wardActivePatientsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 8,
  },
  wardPtList: {
    gap: 6,
  },
  noPtText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
  wardPtItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  wptBedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  wptBedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34d399',
  },
  wptName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f8fafc',
    flex: 1,
  },
  wptDoc: {
    fontSize: 11,
    color: '#94a3b8',
  },

  // ── Tab 3: Analytics ──
  analyticsContainer: {
    gap: 16,
  },
  analyticsTopDeck: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  analyticsSummaryCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 14,
  },
  analyticsCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 8,
  },
  alosMetricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 6,
  },
  alosNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: '#38bdf8',
  },
  alosUnit: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  alosSub: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  balBox: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
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
    fontSize: 18,
    fontWeight: '800',
    color: '#10b981',
  },
  balNumRed: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ef4444',
  },
  balLbl: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  analyticsTableCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 14,
  },
  tableCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  timeframeButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  btnTimeframe: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
  },
  btnTimeframeActive: {
    backgroundColor: '#0284c7',
  },
  btnTimeframeText: {
    fontSize: 11,
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
    marginBottom: 10,
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
    fontSize: 11,
    color: '#94a3b8',
  },
  trendsBarChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    paddingVertical: 10,
  },
  trendDayCol: {
    alignItems: 'center',
    minWidth: 40,
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 120,
    marginBottom: 6,
  },
  barAdmissions: {
    width: 16,
    backgroundColor: '#3b82f6',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  barDischarges: {
    width: 16,
    backgroundColor: '#10b981',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
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
    fontSize: 10,
    color: '#94a3b8',
  },
  emptyTableBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyTableText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  nurseTable: {
    gap: 8,
  },
  nurseRowCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 10,
    padding: 10,
  },
  nurseCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  nurseCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nurseCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  nursePatientsPill: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  nursePatientsPillText: {
    fontSize: 11,
    color: '#38bdf8',
    fontWeight: '700',
  },
  nurseCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nurseWardsText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  nurseStatsPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  taskPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  taskPillText: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '600',
  },
  marPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  marPillText: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: '600',
  },

  // ── Tab 4: Bed Reconciliation ──
  reconcileContainer: {
    gap: 16,
  },
  reconcileHeroBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
  },
  reconcileHeroIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reconcileHeroContent: {
    flex: 1,
  },
  reconcileHeroTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  reconcileHeroDesc: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
    marginBottom: 12,
  },
  btnRunReconcile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  btnRunReconcileRunning: {
    opacity: 0.7,
  },
  btnRunReconcileText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  reconcileResultsPanel: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 14,
  },
  reconcileResultsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 12,
  },
  reconcileKpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  rkpiBox: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  rkpiBoxGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  rkpiVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  rkpiLbl: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  anomaliesList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
    gap: 8,
  },
  anomaliesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  anomalyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 8,
    padding: 8,
  },
  anoBed: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f8fafc',
  },
  anoAction: {
    fontSize: 11,
    color: '#34d399',
    fontWeight: '600',
  },
  anoReason: {
    fontSize: 10,
    color: '#94a3b8',
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 550,
    maxHeight: '85%',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalShieldIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  modalSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 14,
  },
  modalLoadingBox: {
    paddingVertical: 30,
    alignItems: 'center',
    gap: 10,
  },
  modalLoadingText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  blockerDecisionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  decisionBannerClear: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  decisionBannerBlocked: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerDesc: {
    fontSize: 11,
    color: '#cbd5e1',
    lineHeight: 16,
  },
  blockersListSection: {
    marginBottom: 10,
  },
  checklistTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 8,
  },
  blockerItems: {
    gap: 8,
  },
  noBlockersText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  blockerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 8,
    padding: 10,
  },
  blockerTypePill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  blockerTypePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  blockerDetails: {
    flex: 1,
  },
  blockerItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 2,
  },
  blockerItemMsg: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
  },
  modalErrorText: {
    fontSize: 12,
    color: '#ef4444',
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  btnCloseModal: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  btnCloseModalText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  btnGotoWorkspace: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  btnGotoWorkspaceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },

  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#94a3b8',
  },
});
