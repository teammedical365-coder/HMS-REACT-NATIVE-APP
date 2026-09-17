import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Pressable, useWindowDimensions, Alert, Linking, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { rnBuildAPI } from '../../utils/api';
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
}) {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [buildStatuses, setBuildStatuses] = useState({});

  const isDesktop = width >= 1024;
  const isTablet = width >= 640 && width < 1024;
  const cardWidth = Platform.select({
    web: isDesktop ? 'calc((100% - 36px) / 3)' : (isTablet ? 'calc((100% - 18px) / 2)' : '100%'),
    default: isDesktop ? '31.8%' : (isTablet ? '48.5%' : '100%'),
  });

  if (showHospitalForm || showHospitalAdminForm || editHospital) return null;

  const filteredHospitals = (hospitals || []).filter((h) => {
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
      ? 'No clinics found in this plan. Click + Add Starter Clinic to get started.'
      : 'No hospitals found for this plan. Add your first hospital above.';

  if (!loading && filteredHospitals.length === 0) {
    return (
      <View style={styles.emptyBanner}>
        <Text style={{ fontSize: 18, marginRight: 8 }}>{emptyIcon}</Text>
        <Text style={styles.emptyBannerText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.hospitalsGrid}>
      {filteredHospitals.map((hospital) => {
        const logoUrl = hospital.brandingSchema?.logoUrl || hospital.branding?.logoUrl;
        const hospitalId = hospital._id || hospital.id;
        const currentStatus = buildStatuses[hospitalId] || hospital.appConfig?.rnBuildStatus || 'NOT_BUILT';

        return (
          <Pressable
            key={hospitalId}
            style={({ pressed, hovered }) => [
              styles.hospitalCard,
              { width: cardWidth },
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
                {logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
                ) : (
                  <Text style={{ fontSize: 24 }}>🏥</Text>
                )}
              </View>

              <View style={styles.hospitalInfo}>
                <Text style={styles.hospitalName} numberOfLines={1}>{hospital.branding?.appName || hospital.name || 'Untitled Hospital'}</Text>
                {hospital.branding?.tagline ? (
                  <Text style={styles.hospitalTagline} numberOfLines={1}>{hospital.branding.tagline}</Text>
                ) : hospital.city ? (
                  <Text style={styles.hospitalTagline} numberOfLines={1}>
                    📍 {hospital.city}{hospital.state ? `, ${hospital.state}` : ''}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.hospitalMetaList}>
              {hospital.city ? <Text style={styles.hospitalMetaItem}>📍 {hospital.city}{hospital.state ? `, ${hospital.state}` : ''}</Text> : null}
              {hospital.phone ? <Text style={styles.hospitalMetaItem}>📞 {hospital.phone}</Text> : null}
              {hospital.email ? <Text style={styles.hospitalMetaItem}>✉️ {hospital.email}</Text> : null}

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
              </View>
            </View>

            <View style={styles.hospitalCardFooter}>
              <Text style={styles.hospitalClickHint}>
                📊 Click to view full analytics →
              </Text>

              <View style={styles.hospitalBtnGroup}>
                <Pressable 
                  style={({ pressed, hovered }) => [
                    styles.btnSmEdit,
                    (currentStatus === 'BUILDING' || currentStatus === 'PROCESSING') ? { backgroundColor: '#fef3c7', borderColor: '#fde68a' } :
                    currentStatus === 'COMPLETED' ? { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' } :
                    currentStatus === 'FAILED' ? { backgroundColor: '#fee2e2', borderColor: '#fecaca' } :
                    { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
                    Platform.select({ web: { transition: 'all 0.15s ease', cursor: (currentStatus === 'BUILDING' || currentStatus === 'PROCESSING') ? 'not-allowed' : 'pointer' } }),
                    hovered && { transform: [{ translateY: -1 }] },
                    pressed && { transform: [{ scale: 0.96 }] },
                  ]} 
                  onPress={(e) => { 
                    e.stopPropagation?.(); 
                    if (currentStatus === 'BUILDING' || currentStatus === 'PROCESSING') return;
                    if (currentStatus === 'COMPLETED') {
                      Linking.openURL(rnBuildAPI.getApkDownloadUrl(hospitalId)).catch(err => console.error(err));
                    } else {
                      handleBuildRNApp(hospital);
                    }
                  }}
                  disabled={currentStatus === 'BUILDING' || currentStatus === 'PROCESSING'}
                >
                  <Text style={[styles.btnSmEditText, {
                    color: (currentStatus === 'BUILDING' || currentStatus === 'PROCESSING') ? '#d97706' :
                           currentStatus === 'COMPLETED' ? '#16a34a' :
                           currentStatus === 'FAILED' ? '#dc2626' : '#2563eb'
                  }]}>
                    {currentStatus === 'BUILDING' ? '⏳ Building...' :
                     currentStatus === 'PROCESSING' ? '⚙️ Processing...' :
                     currentStatus === 'COMPLETED' ? '📥 APK' :
                     currentStatus === 'FAILED' ? '⚠️ Retry Build' : '⚡ Build APK'}
                  </Text>
                </Pressable>

                {activeTab !== 'simple-clinics' && (
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
                  onPress={(e) => { e.stopPropagation?.(); onEditHospital?.(hospital); }}
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
                  onPress={(e) => { e.stopPropagation?.(); onDeleteHospital?.(hospitalId); }}
                >
                  <Text style={styles.btnSmDeleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
