import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import apiClient, { centralAdminAPI } from '../../utils/api';
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
  const [buildStatuses, setBuildStatuses] = useState({});

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
      
      // Call the exact backend API
      console.log("TRIGGERING BUILD FOR ID:", hospitalId);
      const response = await apiClient.post(`/api/superadmin/hospitals/${hospitalId}/trigger-mobile-build`);
      
      if (response.data?.success) {
        setBuildStatuses(prev => ({ ...prev, [hospitalId]: 'BUILDING' }));
        Alert.alert('Success', 'React Native App build triggered successfully.');
      } else {
        setBuildStatuses(prev => ({ ...prev, [hospitalId]: 'FAILED' }));
        Alert.alert('Build Failed', response.data?.message || 'Failed to build app.');
      }
    } catch (error) {
      console.error('Build RN App failed:', error);
      const hospitalId = hospital?._id || hospital?.id;
      setBuildStatuses(prev => ({ ...prev, [hospitalId]: 'FAILED' }));
      Alert.alert('Error', 'Failed to trigger React Native App build.');
    }
  };

  const emptyMessage =
    activeTab === 'multi-speciality'
      ? 'No multi-speciality hospitals found.'
      : activeTab === 'clinic-basic'
        ? 'No clinic basic hospitals found.'
        : activeTab === 'simple-clinics'
          ? 'No starter clinics found.'
          : 'No enterprise hospitals found. Add one to get started.';

  if (!loading && filteredHospitals.length === 0) {
    return (
      <View style={styles.emptyBanner}>
        <Text style={styles.emptyIcon}>ℹ️</Text>
        <Text style={styles.emptyBannerText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.hospitalsGrid}>
      {filteredHospitals.map((hospital) => {
        const logoUrl = hospital.brandingSchema?.logoUrl || hospital.branding?.logoUrl;
        const planKey = normalizePlan(hospital.subscriptionPlan || hospital.clinicPlan || hospital.plan);

        return (
          <TouchableOpacity
            key={hospital._id || hospital.id}
            style={styles.hospitalCard}
            activeOpacity={0.8}
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
                <Text style={styles.hospitalName} numberOfLines={1}>{hospital.name || 'Untitled Hospital'}</Text>
                <Text style={styles.hospitalTagline} numberOfLines={1}>
                  {hospital.city ? `${hospital.city}${hospital.state ? `, ${hospital.state}` : ''}` : 'Location not set'}
                </Text>
              </View>
            </View>

            <View style={{ gap: 4, marginBottom: 14 }}>
              {hospital.phone ? <Text style={{ fontSize: 13, color: '#64748b' }}>📞 {hospital.phone}</Text> : null}
              {hospital.email ? <Text style={{ fontSize: 13, color: '#64748b' }}>✉️ {hospital.email}</Text> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {hospital.customDomain ? (
                  <View style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 }}>
                    <Text style={{ color: '#2563eb', fontSize: 11, fontWeight: '600' }}>{hospital.customDomain}</Text>
                  </View>
                ) : null}
                {hospital.slug ? (
                  <View style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 }}>
                    <Text style={{ color: '#2563eb', fontSize: 11, fontWeight: '600' }}>{hospital.slug}.hms.com</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.hospitalCardFooter}>
              <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: '700', marginBottom: 6 }}>
                📊 {planKey === 'multi-speciality' ? 'Multi-speciality plan' : planKey === 'clinic-basic' ? 'Clinic basic plan' : planKey === 'simple-clinics' ? 'Starter plan' : 'Enterprise plan'}
              </Text>

              <View style={styles.hospitalBtnGroup}>
                {(() => {
                  const currentStatus = buildStatuses[hospital._id || hospital.id] || hospital.appConfig?.rnBuildStatus || 'NOT_BUILT';
                  
                  if (currentStatus === 'BUILDING') {
                    return (
                      <TouchableOpacity style={[styles.loginAsBtn, { backgroundColor: '#f59e0b' }]} disabled>
                        <Text style={styles.loginAsBtnText}>Building...</Text>
                      </TouchableOpacity>
                    );
                  }
                  
                  if (currentStatus === 'FAILED') {
                    return (
                      <TouchableOpacity 
                        style={[styles.loginAsBtn, { backgroundColor: '#ef4444' }]} 
                        onPress={(e) => { e.stopPropagation(); handleBuildRNApp(hospital); }}
                      >
                        <Text style={styles.loginAsBtnText}>Build Failed</Text>
                      </TouchableOpacity>
                    );
                  }
                  
                  if (currentStatus === 'COMPLETED') {
                    return (
                      <>
                        <TouchableOpacity 
                          style={styles.loginAsBtn} 
                          onPress={(e) => { e.stopPropagation(); handleBuildRNApp(hospital); }}
                        >
                          <Text style={styles.loginAsBtnText}>Build RN App</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.loginAsBtn, { backgroundColor: '#10b981', marginLeft: 6 }]} 
                          onPress={(e) => { e.stopPropagation(); }}
                        >
                          <Text style={styles.loginAsBtnText}>Download APK</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.loginAsBtn, { backgroundColor: '#8b5cf6', marginLeft: 6 }]} 
                          onPress={(e) => { e.stopPropagation(); }}
                        >
                          <Text style={styles.loginAsBtnText}>Download AAB</Text>
                        </TouchableOpacity>
                      </>
                    );
                  }
                  
                  return (
                    <TouchableOpacity 
                      style={styles.loginAsBtn} 
                      onPress={(e) => { e.stopPropagation(); handleBuildRNApp(hospital); }}
                    >
                      <Text style={styles.loginAsBtnText}>Build RN App</Text>
                    </TouchableOpacity>
                  );
                })()}

                {activeTab !== 'simple-clinics' && (
                  <TouchableOpacity style={styles.btnSmBranding} onPress={(e) => { e.stopPropagation(); onBrandingHospital?.(hospital); }}>
                    <Text style={styles.btnSmBrandingText}>🎨 Branding</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.btnSmEdit} onPress={(e) => { e.stopPropagation(); onEditHospital?.(hospital); }}>
                  <Text style={styles.btnSmEditText}>✏️ Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.btnSmEdit, { backgroundColor: '#fef2f2', borderColor: '#fecaca', marginLeft: 'auto' }]} onPress={(e) => { e.stopPropagation(); onDeleteHospital?.(hospital._id || hospital.id); }}>
                  <Text style={[styles.btnSmEditText, { color: '#dc2626' }]}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}


