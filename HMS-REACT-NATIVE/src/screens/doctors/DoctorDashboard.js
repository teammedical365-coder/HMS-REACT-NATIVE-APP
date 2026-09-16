import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Image,
  ImageBackground,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../store/hooks';
import { doctorAPI } from '../../utils/api';

const DoctorDashboard = () => {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768;

  const { user: authUser } = useAuth();
  const [localUser, setLocalUser] = useState({});
  const [stats, setStats] = useState({ today: 0, pending: 0, completed: 0, total: 0 });
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const stored = localStorage.getItem('user');
          if (stored) setLocalUser(JSON.parse(stored));
        } else {
          const userStr = await AsyncStorage.getItem('user');
          if (userStr) setLocalUser(JSON.parse(userStr));
        }
      } catch (e) {
        console.error('Error reading user:', e);
      }
    };
    loadUser();
  }, []);

  const user = authUser || localUser || {};

  // Time-based greeting (Morning, Afternoon, Evening) matching Web 1:1
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning,';
    if (hour >= 12 && hour < 17) return 'Good afternoon,';
    return 'Good evening,';
  }, []);

  // Doctor display name matching Web 1:1
  const doctorDisplayName = useMemo(() => {
    const rawName = user.name || 'Doctor';
    return rawName.replace(/^Dr\.?\s*/i, '');
  }, [user.name]);

  const fetchDoctorStats = useCallback(async (isPullRefresh = false) => {
    try {
      if (isPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const aptRes = await doctorAPI.getAppointments();
      if (aptRes && aptRes.success) {
        const apts = aptRes.appointments || [];
        setAppointments(apts);

        const todayStr = new Date().toISOString().split('T')[0];
        const todayApts = apts.filter(a => a.appointmentDate && String(a.appointmentDate).startsWith(todayStr));
        const pendingApts = apts.filter(a => ['pending', 'confirmed', 'scheduled', 'in_progress'].includes(a.status));
        const completedApts = apts.filter(a => a.status === 'completed');

        setStats({
          today: todayApts.length,
          pending: pendingApts.length,
          completed: completedApts.length,
          total: apts.length,
        });
      }
    } catch (err) {
      console.error("Error fetching doctor stats:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctorStats();
  }, [fetchDoctorStats]);

  const onRefresh = () => {
    fetchDoctorStats(true);
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayAppointments = useMemo(() => {
    return appointments.filter(a => a.appointmentDate && String(a.appointmentDate).startsWith(todayStr));
  }, [appointments, todayStr]);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

  const getStatusBadge = (s) => {
    const m = {
      confirmed: { b: '#dcfce7', c: '#166534' },
      completed: { b: '#dbeafe', c: '#1e40af' },
      cancelled: { b: '#fee2e2', c: '#991b1b' },
      pending: { b: '#fef3c7', c: '#92400e' },
      in_progress: { b: '#e0e7ff', c: '#3730a3' },
      scheduled: { b: '#f0fdf4', c: '#15803d' },
    };
    return m[s] || { b: '#f1f5f9', c: '#475569' };
  };

  // Permission items matching Web 1:1
  const permissionItems = [
    {
      id: 'ai_assistant',
      title: 'AI Assistant',
      icon: <Feather name="cpu" size={15} color="#7c3aed" />,
      iconBg: '#ede9fe',
      iconColor: '#7c3aed',
      path: 'AIAssistant',
    },
    {
      id: 'visit_diagnose',
      title: 'Visit Diagnose',
      icon: <FontAwesome5 name="stethoscope" size={14} color="#2563eb" />,
      iconBg: '#eff6ff',
      iconColor: '#2563eb',
      path: 'DoctorPatients',
    },
    {
      id: 'patient_view',
      title: 'Patient View',
      icon: <Feather name="users" size={15} color="#059669" />,
      iconBg: '#ecfdf5',
      iconColor: '#059669',
      path: 'DoctorPatients',
    },
    {
      id: 'clinical_history',
      title: 'Clinical History View',
      icon: <Feather name="file-text" size={15} color="#7c3aed" />,
      iconBg: '#f5f3ff',
      iconColor: '#7c3aed',
      path: 'DoctorPatients',
    },
    {
      id: 'lab_view',
      title: 'Lab View',
      icon: <FontAwesome5 name="flask" size={14} color="#d97706" />,
      iconBg: '#fffbeb',
      iconColor: '#d97706',
      path: 'LabReports',
    },
    {
      id: 'pharmacy_view',
      title: 'Pharmacy View',
      icon: <FontAwesome5 name="capsules" size={14} color="#db2777" />,
      iconBg: '#fdf2f8',
      iconColor: '#db2777',
      path: 'DoctorPatients',
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingHorizontal: isDesktop ? 28 : (isTablet ? 20 : 16),
          paddingTop: 14,
          paddingBottom: 24,
        }
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" colors={['#3b82f6']} />
      }
    >
      <View style={styles.innerWrapper}>
        {/* 1. HERO BANNER SECTION (Full Width, Sleek Dark Navy Theme, Seamlessly Blended Doctor AI Graphic) */}
        <View style={styles.heroBannerContainer}>
          <ImageBackground
            source={require('../../../assets/doctor_ai_neural_banner.png')}
            style={[styles.heroBanner, { minHeight: isDesktop ? 250 : (isTablet ? 220 : 185) }]}
            imageStyle={styles.heroBannerImage}
          >
            <LinearGradient
              colors={[
                'rgba(15, 23, 42, 0.98)',
                'rgba(15, 23, 42, 0.90)',
                'rgba(15, 23, 42, 0.40)',
                'rgba(15, 23, 42, 0.04)',
              ]}
              locations={[0, 0.34, 0.62, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.heroOverlay,
                {
                  paddingHorizontal: isDesktop ? 44 : (isTablet ? 32 : 20),
                  paddingVertical: isDesktop ? 34 : (isTablet ? 26 : 20),
                }
              ]}
            >
              <View style={styles.heroContent}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroWave}>👋</Text>
                  <Text style={styles.heroBadgeText}>WELCOME BACK, DOCTOR</Text>
                </View>

                <Text style={[styles.heroHeading, { fontSize: isDesktop ? 34 : (isTablet ? 28 : 22), lineHeight: isDesktop ? 42 : (isTablet ? 34 : 28) }]}>
                  {greeting}{'\n'}
                  <Text style={styles.heroNameHighlight}>{doctorDisplayName}</Text>
                </Text>

                <Text style={[styles.heroSubtext, { fontSize: isDesktop ? 15 : 13.5, lineHeight: isDesktop ? 22 : 19 }]}>
                  Here's your workspace.{'\n'}Pick any section to get started.
                </Text>
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>

        {/* 2. STATS OVERVIEW CARDS (Real dynamic counts calculated from doctorAPI.getAppointments) */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Feather name="activity" size={15} color="#64748b" style={{ marginRight: 7 }} />
            <Text style={styles.sectionTitle}>WORKFLOW OVERVIEW</Text>
          </View>

          <View style={styles.statsGrid}>
            <TouchableOpacity 
              style={styles.statCard} 
              activeOpacity={0.85}
              onPress={() => navigation.navigate('DoctorPatients')}
            >
              <View style={[styles.statIconWrap, { backgroundColor: '#eff6ff' }]}>
                <Feather name="calendar" size={20} color="#2563eb" />
              </View>
              <View>
                <Text style={styles.statValue}>{loading ? '...' : stats.today}</Text>
                <Text style={styles.statLabel}>Today's Visits</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.statCard} 
              activeOpacity={0.85}
              onPress={() => navigation.navigate('DoctorPatients')}
            >
              <View style={[styles.statIconWrap, { backgroundColor: '#fffbeb' }]}>
                <Feather name="clock" size={20} color="#d97706" />
              </View>
              <View>
                <Text style={styles.statValue}>{loading ? '...' : stats.pending}</Text>
                <Text style={styles.statLabel}>Pending / Queue</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.statCard} 
              activeOpacity={0.85}
              onPress={() => navigation.navigate('DoctorPatients')}
            >
              <View style={[styles.statIconWrap, { backgroundColor: '#ecfdf5' }]}>
                <Feather name="check-circle" size={20} color="#059669" />
              </View>
              <View>
                <Text style={styles.statValue}>{loading ? '...' : stats.completed}</Text>
                <Text style={styles.statLabel}>Completed Visits</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.statCard} 
              activeOpacity={0.85}
              onPress={() => navigation.navigate('DoctorPatients')}
            >
              <View style={[styles.statIconWrap, { backgroundColor: '#f5f3ff' }]}>
                <Feather name="users" size={20} color="#7c3aed" />
              </View>
              <View>
                <Text style={styles.statValue}>{loading ? '...' : stats.total}</Text>
                <Text style={styles.statLabel}>Total Patients</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 3. QUICK ACCESS SECTION */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Feather name="zap" size={15} color="#64748b" style={{ marginRight: 7 }} />
            <Text style={styles.sectionTitle}>QUICK ACCESS</Text>
          </View>

          <View style={[styles.quickAccessGrid, { flexDirection: isTablet ? 'row' : 'column' }]}>
            {/* Patients Card */}
            <TouchableOpacity
              style={styles.quickAccessCard}
              onPress={() => navigation.navigate('DoctorPatients')}
              activeOpacity={0.85}
            >
              <View style={styles.quickLeft}>
                <View style={[styles.quickIconWrapper, { backgroundColor: '#eff6ff' }]}>
                  <Feather name="users" size={24} color="#2563eb" />
                </View>
                <View style={styles.quickInfo}>
                  <Text style={styles.quickTitle}>Patients</Text>
                  <Text style={styles.quickDesc}>
                    Access your patient queue and clinical workspace
                  </Text>
                </View>
              </View>

              <View style={styles.docQuickArtWrapper} pointerEvents="none">
                <Image
                  source={require('../../../assets/stethoscope_card_bg.jpg')}
                  style={styles.docQuickStethoscopeImg}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['#ffffff', 'rgba(255, 255, 255, 0.65)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.7, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            </TouchableOpacity>

            {/* AI Assistant Card */}
            <TouchableOpacity
              style={[styles.quickAccessCard, styles.docQuickAiCard]}
              onPress={() => navigation.navigate('AIAssistant')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#ffffff', '#fdf4ff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.quickLeft}>
                <View style={[styles.quickIconWrapper, styles.docAiIconWrap]}>
                  <Feather name="cpu" size={24} color="#7c3aed" />
                </View>
                <View style={styles.quickInfo}>
                  <View style={styles.aiTitleRow}>
                    <Text style={styles.quickTitle}>AI Assistant</Text>
                    <View style={styles.docQuickAiBadge}>
                      <Text style={styles.docQuickAiBadgeText}>⚡ AI POWERED</Text>
                    </View>
                  </View>
                  <Text style={styles.quickDesc}>
                    Clinical intelligence, report analysis & diagnostic assistant
                  </Text>
                </View>
              </View>

              <View style={styles.docQuickAiArtWrapper} pointerEvents="none">
                <View style={styles.docQuickAiOrb} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. TODAY'S APPOINTMENTS / PATIENT QUEUE (Preview with direct session launcher) */}
        {todayAppointments.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={styles.sectionHeader}>
                <Feather name="calendar" size={15} color="#64748b" style={{ marginRight: 7 }} />
                <Text style={styles.sectionTitle}>TODAY'S SCHEDULE & QUEUE ({todayAppointments.length})</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('DoctorPatients')}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563eb' }}>View All →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.appointmentsContainer}>
              {todayAppointments.slice(0, 4).map((apt, i) => {
                const badge = getStatusBadge(apt.status);
                const ptName = apt.userId?.name || apt.patientName || 'Patient';
                const ptId = apt.userId?.patientId || apt.patientId || 'Pending';
                return (
                  <View key={apt._id || i} style={styles.appointmentRow}>
                    <View style={styles.appointmentTimeCol}>
                      <Text style={styles.appointmentTimeText}>{apt.appointmentTime || 'Today'}</Text>
                      <Text style={styles.appointmentDateText}>{formatDate(apt.appointmentDate)}</Text>
                    </View>

                    <View style={styles.appointmentPatientCol}>
                      <Text style={styles.appointmentPatientName} numberOfLines={1}>{ptName}</Text>
                      <Text style={styles.appointmentPatientId}>MRN: {ptId}</Text>
                    </View>

                    <View style={styles.appointmentServiceCol}>
                      <Text style={styles.appointmentServiceText} numberOfLines={1}>{apt.serviceName || 'Consultation'}</Text>
                    </View>

                    <View style={styles.appointmentStatusCol}>
                      <View style={[styles.statusBadge, { backgroundColor: badge.b }]}>
                        <Text style={[styles.statusBadgeText, { color: badge.c }]}>{apt.status}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.appointmentActionBtn}
                      onPress={() => navigation.navigate('DoctorPatientDetails', {
                        appointmentId: apt._id,
                        patientId: apt.userId?._id || apt.userId?.patientId || apt.patientId
                      })}
                    >
                      <Text style={styles.appointmentActionText}>Consult</Text>
                      <Feather name="arrow-right" size={13} color="#2563eb" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 5. YOUR PERMISSIONS SECTION (Display-Only / Non-Clickable Badges matching Web 1:1) */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Feather name="lock" size={15} color="#64748b" style={{ marginRight: 7 }} />
            <Text style={styles.sectionTitle}>YOUR PERMISSIONS</Text>
          </View>

          <View style={[
            styles.permissionsContainer,
            {
              justifyContent: isDesktop ? 'space-between' : 'flex-start',
            }
          ]}>
            {permissionItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.permissionPillBtn,
                  isDesktop ? { flex: 1, justifyContent: 'center' } : {
                    flexBasis: isTablet ? '31.8%' : '48%',
                    justifyContent: 'flex-start'
                  }
                ]}
                onPress={() => navigation.navigate(item.path)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.permissionIconCircle,
                    { backgroundColor: item.iconBg },
                  ]}
                >
                  {item.icon}
                </View>
                <Text style={styles.permissionLabel} numberOfLines={1}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
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
    flexGrow: 1,
  },
  innerWrapper: {
    width: '100%',
    maxWidth: 1600,
    alignSelf: 'center',
    gap: 18,
  },

  // ── 1. Hero Banner ──
  heroBannerContainer: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 36,
    elevation: 5,
    backgroundColor: '#1e293b',
  },
  heroBanner: {
    width: '100%',
    justifyContent: 'center',
  },
  heroBannerImage: {
    resizeMode: 'cover',
    position: 'absolute',
    right: 0,
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'center',
  },
  heroContent: {
    maxWidth: 540,
    zIndex: 2,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  heroWave: {
    fontSize: 14,
    marginRight: 8,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroHeading: {
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  heroNameHighlight: {
    color: '#38bdf8',
    fontWeight: '900',
  },
  heroSubtext: {
    fontWeight: '500',
    color: '#cbd5e1',
  },

  // ── 2. Workflow Overview Stats ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 26,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },

  // ── 3. Section Headers ──
  sectionBlock: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // ── 4. Quick Access Cards ──
  quickAccessGrid: {
    gap: 16,
    width: '100%',
  },
  quickAccessCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 18,
    elevation: 2,
    minHeight: 84,
    position: 'relative',
    overflow: 'hidden',
  },
  docQuickAiCard: {
    borderColor: 'rgba(124, 58, 237, 0.25)',
  },
  quickLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    zIndex: 2,
  },
  quickIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
    flexShrink: 0,
  },
  docAiIconWrap: {
    backgroundColor: '#f3e8ff',
  },
  quickInfo: {
    flex: 1,
  },
  aiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  docQuickAiBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  docQuickAiBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#7c3aed',
    letterSpacing: 0.4,
  },
  quickTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  quickDesc: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#64748b',
    lineHeight: 18,
  },
  docQuickArtWrapper: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 220,
    overflow: 'hidden',
  },
  docQuickStethoscopeImg: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  docQuickAiArtWrapper: {
    width: 90,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  docQuickAiOrb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    shadowColor: '#a855f7',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 3,
  },

  // ── 5. Today's Appointments List ──
  appointmentsContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  appointmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  appointmentTimeCol: {
    width: 75,
  },
  appointmentTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  appointmentDateText: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  appointmentPatientCol: {
    flex: 1.5,
  },
  appointmentPatientName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  appointmentPatientId: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  appointmentServiceCol: {
    flex: 1,
  },
  appointmentServiceText: {
    fontSize: 12,
    color: '#64748b',
  },
  appointmentStatusCol: {
    width: 85,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  appointmentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  appointmentActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },

  // ── 6. Your Permissions Container ──
  permissionsContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 18,
    elevation: 2,
  },
  permissionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  permissionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  permissionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
});

export default DoctorDashboard;
