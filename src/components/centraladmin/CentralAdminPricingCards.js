import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { styles } from './CentralAdminDashboardStyles';

export default function CentralAdminPricingCards({ 
  activeTab, 
  showHospitalForm, 
  showHospitalAdminForm, 
  editHospital,
  onToggleAdminForm,
  onToggleHospitalForm 
}) {
  
  if (showHospitalForm || showHospitalAdminForm || editHospital) {
    return null; // Hidden when forms are open
  }

  // Content configuration based on active tab
  let title = 'Enterprise Plan';
  let subtitle = 'Click any hospital card to view full analytics';
  let btnAddAdmin = '+ Add Hospital Admin';
  let btnAddHospital = '+ Add Enterprise Hospital';
  let planPrice = 'Custom Quote';
  let features = [
    'Unlimited Hospital Admins', 'Multi-Branch Management', 
    'Unlimited Doctor Accounts', 'Dedicated Account Manager',
    'Unlimited Staff Accounts', 'Priority Support',
    'Unlimited Branch Locations', 'SLA Support',
    'Unlimited Patients', 'All HMS Modules Included',
    'Advanced Role & Permissions'
  ];

  if (activeTab === 'multi-speciality') {
    title = 'Multi-Speciality Starter';
    subtitle = 'Optimized for Multi-Speciality Hospitals and Diagnostic Centers.';
    btnAddHospital = '+ Add Multi-Speciality';
    planPrice = '₹30,000 / Year';
    features = [
      '1 Hospital Admin (Included)', 'Up to 15 Doctor Accounts',
      'Up to 14 Staff Accounts', 'Priority Support',
      '1 Branch Location', 'Unlimited Patients',
      'All HMS Modules Included', 'Advanced Role & Permissions'
    ];
  } else if (activeTab === 'clinic-basic') {
    title = 'Clinic Basic Plan';
    subtitle = 'Advanced clinics supporting up to 5 Doctors & 3 Staff.';
    btnAddHospital = '+ Add Clinic Basic';
    planPrice = '₹15,000 / Year';
    features = [
      '1 Admin Account (Included)', 'Up to 5 Doctor Accounts',
      'Up to 3 Staff Accounts', 'Email Support',
      '1 Branch Location', 'Unlimited Patients',
      'Basic Modules Included', 'Standard Permissions'
    ];
  }

  return (
    <View style={styles.featuredPlanSection}> {/* .cad-featured-plan-section */}
      
      {/* SECTION HEADER */}
      <View style={styles.planHeaderRow}> {/* .cad-plan-header-row */}
        <View style={styles.planTitleCol}> {/* .cad-plan-title-col */}
          <View style={styles.planBadgeIcon}> {/* .cad-plan-badge-icon */}
            {/* Using text for SVG representation */}
            <Text style={{ fontSize: 22, color: '#2563eb' }}>💼</Text> 
          </View>
          <View>
            <Text style={styles.planSectionTitle}>{title}</Text> {/* .cad-plan-section-title */}
            <Text style={styles.planSectionSub}>{subtitle}</Text> {/* .cad-plan-section-sub */}
          </View>
        </View>

        <View style={styles.planActionsRow}> {/* .cad-plan-actions-row */}
          <TouchableOpacity 
            style={styles.btnSecondary} 
            onPress={onToggleAdminForm}
          >
            <Text style={styles.btnSecondaryText}>{btnAddAdmin}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.btnPrimary} 
            onPress={onToggleHospitalForm}
          >
            <Text style={styles.btnPrimaryText}>{btnAddHospital}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TWO INFORMATION CARDS ROW */}
      <View style={styles.planCardsGrid}> {/* .cad-plan-cards-grid */}
        
        {/* Left Card: Plan Operational Provision */}
        <View style={styles.planInfoCard}> {/* .cad-plan-info-card */}
          <View style={styles.infoCardHeader}> {/* .cad-info-card-header */}
            <Text style={styles.infoPlanName}> {/* .cad-info-plan-name */}
              {title} Plan
            </Text>
            <Text style={styles.infoPlanPrice}> {/* .cad-info-plan-price */}
              {planPrice}
            </Text>
          </View>
          <Text style={styles.infoProvisionHeading}> {/* .cad-info-provision-heading */}
            Operational Provision
          </Text>
          
          <View style={styles.infoFeaturesGrid}>
            {features.map((feature, idx) => (
              <View key={idx} style={styles.infoFeatureItemCol}>
                <View style={styles.featureItem}>
                  <Text style={{ color: '#2563eb', fontWeight: '800', fontSize: 14 }}>✓</Text>
                  <Text style={styles.featureItemText}>{feature}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Right Card: Digital Presence Add-on */}
        <View style={styles.addonCard}> {/* .cad-addon-card */}
          <View style={styles.addonContentCol}> {/* .cad-addon-content-col */}
            <View style={styles.addonTag}> {/* .cad-addon-tag */}
              <Text style={{ fontSize: 16 }}>✨</Text> {/* .cad-addon-sparkle */}
              <Text style={styles.addonTagText}> {/* .cad-addon-tag-text */}
                Digital Presence Add-on
              </Text>
            </View>
            <View style={{ gap: 9 }}> {/* .cad-addon-checklist */}
              <View style={styles.featureItem}>
                <Text style={{ color: '#2563eb', fontWeight: '800', fontSize: 14 }}>✓</Text>
                <Text style={styles.featureItemText}>White-Labeled Patient App (Android/iOS)</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={{ color: '#2563eb', fontWeight: '800', fontSize: 14 }}>✓</Text>
                <Text style={styles.featureItemText}>Hospital Custom Domain</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={{ color: '#2563eb', fontWeight: '800', fontSize: 14 }}>✓</Text>
                <Text style={styles.featureItemText}>Custom App Icon & Splash Screen</Text>
              </View>
            </View>
          </View>
          
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 10 }}> {/* .cad-addon-graphic-col */}
            <Text style={{ fontSize: 60, opacity: 0.9 }}>📱</Text>
          </View>
        </View>

      </View>
    </View>
  );
}
