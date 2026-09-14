import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, useWindowDimensions, Alert, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { whiteLabelAPI } from '../../utils/api';
import { styles } from './CentralAdminDashboardStyles';

const normalizePlan = (value) => {
  const plan = String(value || '').trim().toLowerCase().replace(/[\s-]/g, '_');
  if (!plan || plan === 'none' || plan === 'null' || plan === 'enterprise') return 'enterprise';
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
  const cardWidth = isDesktop ? '31.8%' : (isTablet ? '48.5%' : '100%');

  if (showHospitalForm || showHospitalAdminForm || editHospital) return null;

  const filteredHospitals = (hospitals || []).filter((h) => {
    const plan = normalizePlan(h.subscriptionPlan || h.clinicPlan || h.plan);
    if (activeTab === 'all') return true;
    if (activeTab === 'multi-speciality') return plan === 'multi-speciality';
    if (activeTab === 'clinic-basic') return plan === 'clinic-basic';
    if (activeTab === 'simple-clinics') return plan === 'simple-clinics';
    if (activeTab === 'hospitals') {
      return !['multi-speciality', 'clinic-basic', 'simple-clinics'].includes(plan);
    }
    return true;
  });

  const handleBuildRNApp = async (hospital) => {
    try {
      const hospitalId = hospital?._id || hospital?.id;
      setBuildStatuses(prev => ({ ...prev, [hospitalId]: 'BUILDING' }));
      
      const response = await whiteLabelAPI.buildApp(hospitalId);
      
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
          <TouchableOpacity
            key={hospitalId}
            style={[styles.hospitalCard, { width: cardWidth }]}
            activeOpacity={0.85}
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
                {activeTab !== 'simple-clinics' && (
                  <TouchableOpacity 
                    style={styles.btnSmBranding} 
                    onPress={(e) => { e.stopPropagation(); onBrandingHospital?.(hospital); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnSmBrandingText}>🎨 Branding</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={styles.btnSmEdit} 
                  onPress={(e) => { e.stopPropagation(); onEditHospital?.(hospital); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnSmEditText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.btnSmDelete} 
                  onPress={(e) => { e.stopPropagation(); onDeleteHospital?.(hospitalId); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnSmDeleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
