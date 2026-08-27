import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
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

  const isEmpty = hospitals.length === 0;

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
        {hospitals.map((hospital) => {
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
                  {logoUrl ? (
                    <Image 
                      source={{ uri: logoUrl }} 
                      style={{ width: '100%', height: '100%', resizeMode: 'contain' }} 
                    />
                  ) : (
                    <Text style={{ fontSize: 24 }}>🏥</Text>
                  )}
                </View>
                
                <View style={styles.hospitalInfo}> {/* .cad-hospital-info */}
                  <Text style={styles.hospitalName} numberOfLines={1}> {/* .cad-hospital-name */}
                    {hospital.name}
                  </Text>
                  <Text style={styles.hospitalTagline} numberOfLines={1}> {/* .cad-hospital-tagline */}
                    {hospital.city ? `${hospital.city}, ${hospital.state || ''}` : 'Location not set'}
                  </Text>
                </View>
              </View>

              {/* Meta List */}
              <View style={{ gap: 4, marginBottom: 14 }}> {/* .cad-hospital-meta-list */}
                {hospital.phone && <Text style={{ fontSize: 13, color: '#64748b' }}>📞 {hospital.phone}</Text>}
                {hospital.email && <Text style={{ fontSize: 13, color: '#64748b' }}>✉️ {hospital.email}</Text>}
                
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}> {/* .cad-domain-badge-wrap */}
                  {hospital.customDomain ? (
                    <View style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 }}>
                      <Text style={{ color: '#2563eb', fontSize: 11, fontWeight: '600' }}> {/* .cad-domain-badge */}
                        {hospital.customDomain}
                      </Text>
                    </View>
                  ) : null}
                  {hospital.slug ? (
                    <View style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 6 }}>
                      <Text style={{ color: '#2563eb', fontSize: 11, fontWeight: '600' }}>
                        {hospital.slug}.hms.com
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Card Footer */}
              <View style={styles.hospitalCardFooter}> {/* .cad-hospital-card-footer */}
                <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: '700' }}> {/* .cad-hospital-click-hint */}
                  📊 Click to view full analytics →
                </Text>
                
                <View style={styles.hospitalBtnGroup}> {/* .cad-hospital-btn-group */}
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
