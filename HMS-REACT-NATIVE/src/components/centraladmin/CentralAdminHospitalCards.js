import React, { useState } from 'react';
import { View, Text, TextInput, Image, TouchableOpacity, Pressable, useWindowDimensions, Alert, Linking, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { rnBuildAPI } from '../../utils/api';
import { isSafeImageUrl } from '../../utils/resourceSecurity';
import { styles } from './CentralAdminDashboardStyles';

const normalizePlan = (value) => {
  const plan = String(value || '').trim().toLowerCase().replace(/[\s-]/g, '_');
  if (!plan || plan === 'none' || plan === 'enterprise') return 'enterprise';
  if (plan.includes('multi_speciality') || plan.includes('multi_specialty')) return 'multi-speciality';
  if (plan.includes('clinic_basic') || plan === 'basic') return 'clinic-basic';
  if (plan.includes('starter') && !plan.includes('multi')) return 'simple-clinics';
  return plan;
};

export default function CentralAdminHospitalCards({
  loading,
  hospitals,
  activeTab,
  onSelectHospital,
  onEditHospital,
  onDeleteHospital,
  onBrandingHospital,
  showHospitalForm,
  showHospitalAdminForm,
  editHospital,
  // Simple Clinic Props (1:1 Web Parity)
  onEditClinic,
  onDeleteClinic,
  showClinicForm,
  editClinic,
  // Controlled version counter per hospital: { [hospitalId]: number }
  // Incremented by dashboard on every successful branding save.
  // Allows cache-bust even when the logoUrl string is identical between saves.
  brandingVersions = {},
}) {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [buildStatuses, setBuildStatuses] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('a-z'); // 'a-z' | 'z-a' | 'newest' | 'oldest'

  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;
  const isFilterStack = width <= 900;
  const isSmallSort = width <= 640;
  const isSmallPhone = width < 480;

  const cardWidth = Platform.select({
    web: isDesktop ? 'calc((100% - 36px) / 3)' : (isTablet ? 'calc((100% - 18px) / 2)' : '100%'),
    default: isDesktop ? '31.8%' : (isTablet ? '48.5%' : '100%'),
  });

  if (showHospitalForm || showHospitalAdminForm || editHospital || showClinicForm || editClinic) return null;

  const planEntities = (hospitals || []).filter((h) => {
    const isClinic = h.clinicType === 'clinic';
    if (activeTab === 'all') return true;
    if (activeTab === 'simple-clinics') {
      return isClinic;
    }
    // All other tabs are for hospitals only (hospitals cannot appear in simple-clinics, clinics cannot appear in hospital tabs)
    if (isClinic) return false;

    const plan = normalizePlan(h.subscriptionPlan || h.clinicPlan || h.plan);
    if (activeTab === 'multi-speciality') return plan === 'multi-speciality';
    if (activeTab === 'clinic-basic') return plan === 'clinic-basic';
    if (activeTab === 'hospitals') {
      return plan !== 'multi-speciality' && plan !== 'clinic-basic';
    }
    return true;
  });

  // Apply search filter (1:1 Web Parity)
  let filteredHospitals = [...planEntities];
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filteredHospitals = filteredHospitals.filter(h => {
      const name = (h.brandingSchema?.appName || h.branding?.appName || h.name || '').toLowerCase();
      const city = (h.city || '').toLowerCase();
      const state = (h.state || '').toLowerCase();
      const email = (h.email || '').toLowerCase();
      const phone = (h.phone || '').toLowerCase();
      const slug = (h.slug || '').toLowerCase();
      const domain = (h.customDomain || '').toLowerCase();
      return name.includes(q) || city.includes(q) || state.includes(q) || email.includes(q) || phone.includes(q) || slug.includes(q) || domain.includes(q);
    });
  }

  // Apply sorting (1:1 Web Parity)
  filteredHospitals.sort((a, b) => {
    const nameA = (a.brandingSchema?.appName || a.branding?.appName || a.name || '').trim();
    const nameB = (b.brandingSchema?.appName || b.branding?.appName || b.name || '').trim();

    if (sortBy === 'a-z') {
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
    }
    if (sortBy === 'z-a') {
      return nameB.localeCompare(nameA, undefined, { sensitivity: 'base', numeric: true });
    }
    if (sortBy === 'newest') {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (dateA && dateB) return dateB - dateA;
      return (b._id || b.id || '').localeCompare(a._id || a.id || '');
    }
    if (sortBy === 'oldest') {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (dateA && dateB) return dateA - dateB;
      return (a._id || a.id || '').localeCompare(b._id || b.id || '');
    }
    return 0;
  });

  const handleBuildRNApp = async (hospital) => {
    try {
      const hospitalId = hospital?._id || hospital?.id;
      setBuildStatuses(prev => ({ ...prev, [hospitalId]: 'BUILDING' }));
      
      const response = await rnBuildAPI.buildApp(hospitalId);
      
      if (response?.success !== false) {
        setBuildStatuses(prev => ({ ...prev, [hospitalId]: 'BUILDING' }));
        Alert.alert('Success', 'Android App build triggered successfully.');
      } else {
        setBuildStatuses(prev => ({ ...prev, [hospitalId]: 'FAILED' }));
        Alert.alert('Build Failed', response?.message || 'Failed to build app.');
      }
    } catch (error) {
      console.error('Build App failed:', error);
      const hospitalId = hospital?._id || hospital?.id;
      setBuildStatuses(prev => ({ ...prev, [hospitalId]: 'FAILED' }));
      Alert.alert('Error', error?.response?.data?.message || 'Failed to trigger App build.');
    }
  };

  const emptyIcon = activeTab === 'simple-clinics' ? '🏪' : '📄';
  const emptyMessage =
    activeTab === 'simple-clinics'
      ? (searchQuery ? 'No clinics match your search query.' : 'No clinics found in this plan. Click + Add Starter Clinic to get started.')
      : (searchQuery ? 'No hospitals match your search query.' : 'No hospitals found for this plan. Add your first hospital above.');

  return (
    <View style={{ width: '100%' }}>
      {/* Filter & Sort Bar (1:1 Web Parity) */}
      <View style={[styles.filterBar, isFilterStack && { flexDirection: 'column', alignItems: 'stretch', gap: 12 }]}>
        <View style={[styles.filterLeft, isFilterStack && { width: '100%', minWidth: 0 }]}>
          <View style={styles.searchBox}>
            <Feather name="search" size={15} color="#64748b" />
            <TextInput
              style={styles.searchInput}
              placeholder={activeTab === 'simple-clinics' ? "Search clinics..." : "Search hospitals..."}
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {Boolean(searchQuery) && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
                <Text style={{ fontSize: 13, color: '#94a3b8', fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={[styles.countBadge, isSmallPhone && { paddingHorizontal: 7, paddingVertical: 4 }]}>
            <Text style={[styles.countBadgeText, isSmallPhone && { fontSize: 11 }]}>
              {filteredHospitals.length} {filteredHospitals.length === 1 ? (activeTab === 'simple-clinics' ? 'Clinic' : 'Hospital') : (activeTab === 'simple-clinics' ? 'Clinics' : 'Hospitals')}
              {searchQuery ? ` (${planEntities.length})` : ''}
            </Text>
          </View>
        </View>

        <View style={[styles.filterRight, isFilterStack && { width: '100%', justifyContent: 'flex-start' }]}>
          <Text style={styles.sortLabel}>Sort:</Text>
          <View style={[styles.sortPillsWrap, { flexWrap: 'wrap', gap: 6 }]}>
            <TouchableOpacity 
              style={[styles.sortPill, isSmallSort && { paddingHorizontal: 8, paddingVertical: 5 }, sortBy === 'a-z' && styles.sortPillActive]} 
              onPress={() => setSortBy('a-z')}
            >
              <Text style={[styles.sortPillText, isSmallSort && { fontSize: 10.5 }, sortBy === 'a-z' && styles.sortPillTextActive]}>🔤 A → Z</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.sortPill, isSmallSort && { paddingHorizontal: 8, paddingVertical: 5 }, sortBy === 'z-a' && styles.sortPillActive]} 
              onPress={() => setSortBy('z-a')}
            >
              <Text style={[styles.sortPillText, isSmallSort && { fontSize: 10.5 }, sortBy === 'z-a' && styles.sortPillTextActive]}>🔤 Z → A</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.sortPill, isSmallSort && { paddingHorizontal: 8, paddingVertical: 5 }, sortBy === 'newest' && styles.sortPillActive]} 
              onPress={() => setSortBy('newest')}
            >
              <Text style={[styles.sortPillText, isSmallSort && { fontSize: 10.5 }, sortBy === 'newest' && styles.sortPillTextActive]}>✨ Newest</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.sortPill, isSmallSort && { paddingHorizontal: 8, paddingVertical: 5 }, sortBy === 'oldest' && styles.sortPillActive]} 
              onPress={() => setSortBy('oldest')}
            >
              <Text style={[styles.sortPillText, isSmallSort && { fontSize: 10.5 }, sortBy === 'oldest' && styles.sortPillTextActive]}>⏳ Oldest</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {!loading && filteredHospitals.length === 0 ? (
        <View style={styles.emptyBanner}>
          <Text style={{ fontSize: 18, marginRight: 8 }}>{emptyIcon}</Text>
          <Text style={styles.emptyBannerText}>{emptyMessage}</Text>
        </View>
      ) : (
        <View style={styles.hospitalsGrid}>
          {filteredHospitals.map((hospital) => {
            const isClinicCard = hospital.clinicType === 'clinic';
            const rawLogo = hospital.brandingSchema?.logoUrl || hospital.branding?.logoUrl;
            const logoUrl = isSafeImageUrl(rawLogo) ? rawLogo : null;
            const hospitalId = hospital._id || hospital.id;
            // Version key: combines logoUrl + save counter so the Image remounts
            // even if the URL string happens to be identical between two saves.
            const logoVersion = brandingVersions[hospitalId] || 0;
            const logoImageKey = logoUrl ? `${logoUrl}-v${logoVersion}` : undefined;
            const currentStatus = buildStatuses[hospitalId] || hospital.appConfig?.rnBuildStatus || 'NOT_BUILT';
            const hasApk = currentStatus === 'COMPLETED' && Boolean(hospital.appConfig?.rnApkUrl);

            return (
              <Pressable
                key={hospitalId}
                style={({ pressed, hovered }) => [
                  styles.hospitalCard,
                  { width: cardWidth },
                  isMobile && { padding: 14, borderRadius: 14 },
                  Platform.select({
                    web: {
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      cursor: 'pointer',
                    },
                  }),
                  hovered && {
                    borderColor: '#2563eb',
                    transform: [{ translateY: -2 }],
                    ...Platform.select({
                      web: {
                        boxShadow: '0 8px 24px rgba(37, 99, 235, 0.12)',
                      },
                    }),
                  },
                  pressed && {
                    transform: [{ translateY: 0 }, { scale: 0.99 }],
                  },
                ]}
                onPress={() => onSelectHospital?.(hospital)}
              >
                <View style={styles.hospitalCardHeader}>
                  <View style={styles.hospitalLogoBox}>
                    {isClinicCard ? (
                      <Text style={{ fontSize: 24 }}>🏪</Text>
                    ) : logoUrl ? (
                      <Image key={logoImageKey} source={{ uri: logoUrl }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
                    ) : (
                      <Text style={{ fontSize: 24 }}>🏥</Text>
                    )}
                  </View>

                  <View style={styles.hospitalInfo}>
                    <Text style={styles.hospitalName} numberOfLines={1}>{hospital.branding?.appName || hospital.name || (isClinicCard ? 'Starter Clinic' : 'Untitled Hospital')}</Text>
                    {hospital.branding?.tagline ? (
                      <Text style={styles.hospitalTagline} numberOfLines={1}>{hospital.branding.tagline}</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.hospitalMetaList}>
                  {hospital.city ? <Text style={styles.hospitalMetaItem}>📍 {hospital.city}{hospital.state ? `, ${hospital.state}` : ''}</Text> : null}
                  {hospital.phone ? <Text style={styles.hospitalMetaItem}>📞 {hospital.phone}</Text> : null}
                  {hospital.email ? <Text style={styles.hospitalMetaItem}>✉️ {hospital.email}</Text> : null}
                  {isClinicCard && hospital.defaultFee !== undefined ? (
                    <Text style={[styles.hospitalMetaItem, { color: '#059669', fontWeight: '700' }]}>
                      💰 Consultation Fee: ₹{Number(hospital.defaultFee || 0).toLocaleString('en-IN')}
                    </Text>
                  ) : null}
                  {isClinicCard && hospital.adminUserId?.name ? (
                    <Text style={[styles.hospitalMetaItem, { color: '#16a34a', fontWeight: '600' }]}>
                      👤 Admin: {hospital.adminUserId.name}
                    </Text>
                  ) : null}

                  <View style={styles.domainBadgeWrap}>
                    {hospital.slug ? (
                      <TouchableOpacity 
                        style={styles.domainBadge}
                        onPress={() => Linking.openURL(`https://${hospital.slug}.medical365.in`)}
                      >
                        <Text style={styles.domainBadgeText}>🌐 {hospital.slug}.medical365.in</Text>
                      </TouchableOpacity>
                    ) : null}
                    {hospital.customDomain ? (
                      <TouchableOpacity 
                        style={styles.domainBadge}
                        onPress={() => Linking.openURL(`https://${hospital.customDomain.replace(/^https?:\/\//, '')}`)}
                      >
                        <Text style={styles.domainBadgeText}>🌐 {hospital.customDomain.replace(/^https?:\/\//, '')}</Text>
                      </TouchableOpacity>
                    ) : null}

                    {/* WhiteLabel App Builder (1:1 Web Parity in cad-domain-badge-wrap) */}
                    {!isClinicCard && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 8, width: '100%' }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: currentStatus === 'COMPLETED' ? '#10b981' : currentStatus === 'FAILED' ? '#ef4444' : currentStatus === 'BUILDING' ? '#f59e0b' : '#64748b' }}>
                          {currentStatus === 'BUILDING' ? '⏳ Building...' :
                           currentStatus === 'COMPLETED' ? 'App Ready ✅' :
                           currentStatus === 'FAILED' ? 'Build Failed ❌' : 'Not Built'}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <Pressable
                            style={{ backgroundColor: (currentStatus === 'BUILDING') ? '#93c5fd' : '#3b82f6', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 }}
                            disabled={currentStatus === 'BUILDING'}
                            onPress={(e) => { e.stopPropagation?.(); handleBuildRNApp(hospital); }}
                          >
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
                              {currentStatus === 'BUILDING' ? 'Building...' : currentStatus === 'FAILED' ? 'Retry Build' : '⚙️ Build App'}
                            </Text>
                          </Pressable>
                          {currentStatus === 'COMPLETED' && hasApk && (
                            <Pressable
                              style={{ backgroundColor: '#10b981', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 }}
                              onPress={(e) => { e.stopPropagation?.(); Linking.openURL(rnBuildAPI.getApkDownloadUrl(hospitalId)).catch(err => console.error(err)); }}
                            >
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>📥 APK</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {/* 1:1 Web Parity Card Footer */}
                <View style={styles.hospitalCardFooter}>
                  <Text style={styles.hospitalClickHint}>
                    📊 Click to view full analytics →
                  </Text>

                  <View style={styles.hospitalBtnGroup}>
                    {!isClinicCard && activeTab !== 'simple-clinics' && (
                      <Pressable 
                        style={({ pressed, hovered }) => [
                          styles.btnSmBranding,
                          Platform.select({ web: { transition: 'all 0.15s ease', cursor: 'pointer' } }),
                          hovered && { backgroundColor: '#dbeafe', transform: [{ translateY: -1 }] },
                          pressed && { transform: [{ scale: 0.96 }] },
                        ]} 
                        onPress={(e) => { e.stopPropagation?.(); onBrandingHospital?.(hospital); }}
                      >
                        <Text style={styles.btnSmBrandingText}>🎨 Branding</Text>
                      </Pressable>
                    )}

                    <Pressable 
                      style={({ pressed, hovered }) => [
                        styles.btnSmEdit,
                        Platform.select({ web: { transition: 'all 0.15s ease', cursor: 'pointer' } }),
                        hovered && { backgroundColor: '#f1f5f9', borderColor: '#94a3b8', transform: [{ translateY: -1 }] },
                        pressed && { transform: [{ scale: 0.96 }] },
                      ]} 
                      onPress={(e) => { 
                        e.stopPropagation?.(); 
                        if (isClinicCard && onEditClinic) {
                          onEditClinic(hospital);
                        } else {
                          onEditHospital?.(hospital); 
                        }
                      }}
                    >
                      <Text style={styles.btnSmEditText}>Edit</Text>
                    </Pressable>

                    <Pressable 
                      style={({ pressed, hovered }) => [
                        styles.btnSmDelete,
                        Platform.select({ web: { transition: 'all 0.15s ease', cursor: 'pointer' } }),
                        hovered && { backgroundColor: '#fee2e2', borderColor: '#f87171', transform: [{ translateY: -1 }] },
                        pressed && { transform: [{ scale: 0.96 }] },
                      ]} 
                      onPress={(e) => { 
                        e.stopPropagation?.(); 
                        if (isClinicCard && onDeleteClinic) {
                          onDeleteClinic(hospitalId);
                        } else {
                          onDeleteHospital?.(hospitalId); 
                        }
                      }}
                    >
                      <Text style={styles.btnSmDeleteText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

