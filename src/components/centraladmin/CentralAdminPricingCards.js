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
  let title = '';
  let subtitle = '';
  let btnAddAdmin = '+ Add Admin';
  let btnAddHospital = '+ Add';
  let planPrice = '';
  let features = [];

  if (activeTab === 'hospitals' || activeTab === 'enterprise') {
    title = 'Enterprise Plan';
    subtitle = 'Click any hospital card to view full analytics';
    btnAddAdmin = '+ Add Hospital Admin';
    btnAddHospital = '+ Add Enterprise Hospital';
    planPrice = 'Custom Quote';
    features = [
      'Unlimited Hospital Admins', 'Multi-Branch Management', 
      'Unlimited Doctor Accounts', 'Dedicated Account Manager',
      'Unlimited Staff Accounts', 'Priority Support',
      'Unlimited Branch Locations', 'SLA Support',
      'Unlimited Patients', 'All HMS Modules Included',
      'Advanced Role & Permissions'
    ];
  } else if (activeTab === 'multi-speciality') {
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
  } else if (activeTab === 'simple-clinics' || activeTab === 'starter') {
    title = 'Starter Plan';
    subtitle = 'Designed for single-doctor clinics and basic OPD setups.';
    btnAddHospital = '+ Add Starter Clinic';
    planPrice = '₹5,000 / Year';
    features = [
      '1 Doctor Account', 'Up to 2 Staff Accounts',
      'Basic OPD Module', 'Email Support',
      '1 Branch Location', 'Appointment Scheduling',
      'Digital Prescriptions', 'Basic Reporting'
    ];
  } else {
    // Hide pricing cards for non-plan tabs like configurations and revenue-plans
    return null;
  }

  return (
    <View style={styles.featuredPlanSection}>
      
      {/* SECTION HEADER */}
      <View style={styles.planHeaderRow}>
        <View style={styles.planTitleCol}>
          <View style={styles.planBadgeIcon}>
            {/* Using text for SVG representation */}
            <Text style={{ fontSize: 22, color: '#2563eb' }}>💼</Text> 
          </View>
          <View>
            <Text style={styles.planSectionTitle}>{title}</Text>
            <Text style={styles.planSectionSub}>{subtitle}</Text>
          </View>
        </View>

        <View style={styles.planActionsRow}>
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
      <View style={styles.planCardsGrid}>
        
        {/* Left Card: Plan Operational Provision */}
        <View style={styles.planInfoCard}>
          <View style={styles.infoCardHeader}>
            <Text style={styles.infoPlanName}>
              {title} Plan
            </Text>
            <Text style={styles.infoPlanPrice}>
              {planPrice}
            </Text>
          </View>
          <Text style={styles.infoProvisionHeading}>
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
        <View style={styles.addonCard}>
          <View style={styles.addonContentCol}>
            <View style={styles.addonTag}>
              <Text style={{ fontSize: 16 }}>✨</Text>
              <Text style={styles.addonTagText}>
                Digital Presence Add-on
              </Text>
            </View>
            <View style={{ gap: 9 }}>
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
          
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 10 }}>
            <Text style={{ fontSize: 60, opacity: 0.9 }}>📱</Text>
          </View>
        </View>

      </View>
    </View>
  );
}
