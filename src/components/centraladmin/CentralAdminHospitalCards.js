import React from 'react';
import { View, Text, Image, TouchableOpacity, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { centralAdminAPI } from '../../utils/api';
import { styles } from './CentralAdminDashboardStyles';

const normalizePlan = (value) => {
  const plan = String(value || '').trim().toLowerCase();
  if (!plan || plan === 'none' || plan === 'null') return 'enterprise';
  if (plan === 'multi_speciality_starter' || plan === 'multi-specialty' || plan === 'multi-speciality') return 'multi-speciality';
  if (plan === 'clinic_basic' || plan === 'clinic-basic' || plan === 'basic') return 'clinic-basic';
  if (plan === 'starter') return 'simple-clinics';
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

  const handleLoginAsHospital = async (hospital) => {
    try {
      const hospitalId = hospital?._id || hospital?.id;
      const response = await centralAdminAPI.impersonateHospital(hospitalId);
      const token = response?.token || response?.data?.token || response?.accessToken;
      const user = response?.user || response?.data?.user || hospital;
      if (token) {
        await AsyncStorage.setItem('token', token);
        await AsyncStorage.setItem('tenant_id', String(hospitalId));
        await AsyncStorage.setItem('selected_hospital', JSON.stringify(hospital));
        if (user) await AsyncStorage.setItem('user', JSON.stringify(user));
      }

      navigation.navigate('HospitalAdminStack', { hospitalId, hospital });
    } catch (error) {
      console.error('Hospital impersonation failed:', error);
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
                <TouchableOpacity style={styles.loginAsBtn} onPress={(e) => { e.stopPropagation(); handleLoginAsHospital(hospital); }}>
                  <Text style={styles.loginAsBtnText}>🔑 Login to Portal</Text>
                </TouchableOpacity>

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
