import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { styles } from './CentralAdminDashboardStyles';

export default function CentralAdminHospitalList({ 
  loading,
  hospitals, 
  activeTab,
  onSelectHospital,
  onEditHospital,
  onDeleteHospital,
  onBrandingHospital,
  showHospitalForm,
  showHospitalAdminForm,
  editHospital 
}) {
  
  if (showHospitalForm || showHospitalAdminForm || editHospital) {
    return null; // Hidden when forms are open
  }

  const navigation = useNavigation();

  const handleLoginAsHospital = async (hospital) => {
    try {
      // Save selected hospital tenant details to storage
      await AsyncStorage.setItem('tenant_id', hospital._id || hospital.id);
      await AsyncStorage.setItem('selected_hospital', JSON.stringify(hospital));
      
      if (Platform.OS === 'web') {
        localStorage.setItem('tenant_id', hospital._id || hospital.id);
        localStorage.setItem('selected_hospital', JSON.stringify(hospital));
      }

      // Redirect to hospital admin dashboard or login page with pre-filled tenant
      if (Platform.OS === 'web') {
        // Direct redirect for Web environment
        window.location.href = `/dashboard?tenantId=${hospital._id || hospital.id}`;
      } else {
        // Safely try common screen names if navigation context exists
        try {
          navigation.navigate('AdminDashboard', { hospitalId: hospital._id || hospital.id });
        } catch (e) {
          console.error("Navigation screen not found:", e);
        }
      }
    } catch (err) {
      console.error("Failed to switch hospital portal:", err);
    }
  };

  const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  
  const filteredHospitals = hospitals.filter(h => {
    // 1. Unify the plan source (handling legacy clinic payloads)
    const plan = h.subscriptionPlan || h.clinicPlan || h.plan || 'none';

    // 2. All tab
    if (activeTab === 'all') return true;

    // 3. Exact matching based on Web Blueprint
    if (activeTab === 'multi-speciality') {
      return plan === 'multi_speciality_starter';
    }
    if (activeTab === 'clinic-basic') {
      return plan === 'clinic_basic';
    }
    if (activeTab === 'simple-clinics') {
      return plan === 'starter' || plan === 'basic';
    }
    
    // 4. Enterprise uses the Negative Filter
    if (activeTab === 'hospitals') {
      return plan !== 'multi_speciality_starter' && plan !== 'clinic_basic' && plan !== 'starter' && plan !== 'basic';
    }
    
    return true;
  });

  const isEmpty = filteredHospitals.length === 0;

  let emptyMessage = 'No enterprise hospitals found. Add one to get started.';
  if (activeTab === 'multi-speciality') emptyMessage = 'No multi-speciality hospitals found.';
  else if (activeTab === 'clinic-basic') emptyMessage = 'No basic clinics found.';
  else if (activeTab === 'simple-clinics') emptyMessage = 'No starter clinics found.';

  return (
    <View style={{ width: '100%' }}>
      
      {/* EMPTY STATE BANNER */}
      {!loading && isEmpty && (
        <View style={styles.emptyBanner}>
          <Text style={styles.emptyIcon}>ℹ️</Text>
          <Text style={styles.emptyBannerText}>{emptyMessage}</Text>
        </View>
      )}

      {/* HOSPITAL CARDS GRID */}
      <View style={styles.hospitalsGrid}>
        {filteredHospitals.map((hospital) => {
          const logoUrl = hospital.brandingSchema?.logoUrl || hospital.branding?.logoUrl;
          
          return (
            <TouchableOpacity 
              key={hospital._id} 
              style={styles.hospitalCard} 
              onPress={() => onSelectHospital(hospital)}
              activeOpacity={0.7}
            >
              {/* Card Header */}
              <View style={styles.hospitalCardHeader}>
                <View style={styles.hospitalLogoBox}>
                  {Boolean(logoUrl) ? (
                    <Image 
                      source={{ uri: logoUrl }} 
                      style={{ width: '100%', height: '100%', resizeMode: 'contain' }} 
                    />
                  ) : (
                    <Text style={{ fontSize: 24 }}>🏥</Text>
                  )}
                </View>
                
                <View style={styles.hospitalInfo}>
                  <Text style={styles.hospitalName} numberOfLines={1}>
                    {hospital.name}
                  </Text>
                  <Text style={styles.hospitalTagline} numberOfLines={1}>
                    {Boolean(hospital.city) ? `${hospital.city}${hospital.state ? `, ${hospital.state}` : ''}` : 'Location not set'}
                  </Text>
                </View>
              </View>

              {/* Meta List */}
              <View style={{ gap: 4, marginBottom: 14 }}>
                {Boolean(hospital.phone) ? <Text style={{ fontSize: 13, color: '#64748b' }}>📞 {hospital.phone}</Text> : null}
                {Boolean(hospital.email) ? <Text style={{ fontSize: 13, color: '#64748b' }}>✉️ {hospital.email}</Text> : null}
                
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {Boolean(hospital.customDomain) ? (
                    <View style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 }}>
                      <Text style={{ color: '#2563eb', fontSize: 11, fontWeight: '600' }}>
                        {hospital.customDomain}
                      </Text>
                    </View>
                  ) : null}
                  {Boolean(hospital.slug) ? (
                    <View style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 }}>
                      <Text style={{ color: '#2563eb', fontSize: 11, fontWeight: '600' }}>
                        {hospital.slug}.hms.com
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Card Footer */}
              <View style={styles.hospitalCardFooter}>
                <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: '700' }}>
                  📊 Click to view full analytics →
                </Text>
                
                <View style={styles.hospitalBtnGroup}>
                  <TouchableOpacity 
                    style={styles.loginAsBtn} 
                    onPress={(e) => { e.stopPropagation(); handleLoginAsHospital(hospital); }}
                  >
                    <Text style={styles.loginAsBtnText}>🔑 Login to Portal</Text>
                  </TouchableOpacity>
                  
                  {activeTab !== 'simple-clinics' && (
                    <TouchableOpacity 
                      style={styles.btnSmBranding} 
                      onPress={(e) => { e.stopPropagation(); onBrandingHospital?.(hospital); }}
                    >
                      <Text style={styles.btnSmBrandingText}>🎨 Branding</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={styles.btnSmEdit} 
                    onPress={(e) => { e.stopPropagation(); onEditHospital(hospital); }}
                  >
                    <Text style={styles.btnSmEditText}>✏️ Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.btnSmEdit, { backgroundColor: '#fef2f2', borderColor: '#fecaca', marginLeft: 'auto' }]} 
                    onPress={(e) => { e.stopPropagation(); onDeleteHospital(hospital._id); }}
                  >
                    <Text style={[styles.btnSmEditText, { color: '#dc2626' }]}>🗑️ Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
