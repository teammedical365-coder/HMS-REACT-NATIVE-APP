import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Path, Ellipse, Rect, Circle, G } from 'react-native-svg';
import { styles } from './CentralAdminDashboardStyles';

// Exact Web React Central Admin plan definitions (Source: CentralAdminDashboard.jsx)
export const PLAN_CONFIGS = {
  hospitals: {
    id: 'hospitals',
    sectionTitle: 'Enterprise Plan',
    sectionSubtitle: 'Click any hospital card to view full analytics',
    badgeIcon: 'building',
    showAdminButton: true,
    btnAddAdmin: '+ Add Hospital Admin',
    btnAddHospital: '+ Add Enterprise Hospital',
    planName: 'Enterprise Plan',
    planPrice: 'Custom Quote',
    features: [
      'Unlimited Hospital Admins',
      'Multi-Branch Management',
      'Unlimited Doctor Accounts',
      'Dedicated Account Manager',
      'Unlimited Staff Accounts',
      'Priority Support',
      'Unlimited Branch Locations',
      'SLA Support',
      'Unlimited Patients',
      'All HMS Modules Included',
      'Advanced Role & Permissions',
    ],
  },
  'multi-speciality': {
    id: 'multi-speciality',
    sectionTitle: 'Multi-Speciality Starter',
    sectionSubtitle: 'Optimized for Multi-Speciality Hospitals and Diagnostic Centers.',
    badgeIcon: 'building',
    showAdminButton: true,
    btnAddAdmin: '+ Add Hospital Admin',
    btnAddHospital: '+ Add Multi-Speciality',
    planName: 'Multi-Speciality Starter Plan',
    planPrice: '₹30,000 / Year',
    features: [
      '1 Hospital Admin (Included)',
      'Up to 15 Doctor Accounts',
      'Up to 25 Staff Accounts',
      '1 Branch Location',
      'Unlimited Patients',
      'All Facilities Included*',
      'Dedicated Support',
    ],
  },
  'clinic-basic': {
    id: 'clinic-basic',
    sectionTitle: 'Clinic Basic Plan',
    sectionSubtitle: 'Advanced clinics supporting up to 5 Doctors & 3 Staff.',
    badgeIcon: 'building',
    showAdminButton: true,
    btnAddAdmin: '+ Add Hospital Admin',
    btnAddHospital: '+ Add Clinic Basic',
    planName: 'Clinic Basic Plan',
    planPrice: '₹15,000 / Year',
    features: [
      '1 Hospital Admin (Included)',
      'Up to 5 Doctor Accounts',
      'Up to 3 Staff Accounts',
      '1 Branch Location',
      'Unlimited Patients',
      'All Core HMS Facilities Included',
      'Dedicated Support',
    ],
  },
  'simple-clinics': {
    id: 'simple-clinics',
    sectionTitle: 'Starter Plan',
    sectionSubtitle: 'Small clinics managed by 1 doctor. All features included.',
    badgeIcon: 'file',
    showAdminButton: false,
    btnAddAdmin: '',
    btnAddHospital: '+ Add Starter Clinic',
    planName: 'Starter Plan',
    planPrice: '₹6,000 / Year',
    features: [
      '1 Doctor Account',
      '1 Receptionist Account',
      'Unlimited Patients',
      'All Facilities Included',
      'Dedicated Support',
    ],
  },
};

const ADDON_FEATURES = [
  '5-Page Custom Website',
  '100% Responsive & Modern UI/UX',
  'Free Hosting (1 Year)',
  '.in Domain (1 Year)',
  'WhatsApp Integration',
  'On-Page SEO',
  'Lead Gen (Forms, Click-to-call)',
];

const getPlanConfig = (tab) => {
  if (PLAN_CONFIGS[tab]) return PLAN_CONFIGS[tab];
  if (tab === 'enterprise') return PLAN_CONFIGS.hospitals;
  if (tab === 'starter') return PLAN_CONFIGS['simple-clinics'];
  return null;
};

export default function CentralAdminPricingCards({ 
  activeTab, 
  showHospitalForm, 
  showHospitalAdminForm, 
  editHospital,
  onToggleAdminForm,
  onToggleHospitalForm 
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isMobile = width < 640;

  const config = getPlanConfig(activeTab);
  if (!config) {
    return null; // Hidden for non-plan tabs (e.g. revenue-plans, configurations)
  }

  const isFormOpen = Boolean(showHospitalForm || showHospitalAdminForm || editHospital);

  return (
    <View style={styles.featuredPlanSection}>
      
      {/* SECTION HEADER */}
      <View style={styles.planHeaderRow}>
        <View style={styles.planTitleCol}>
          <View style={styles.planBadgeIcon}>
            {config.badgeIcon === 'file' ? (
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <Path d="M14 2v6h6" />
              </Svg>
            ) : (
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M3 21h18" />
                <Path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
                <Path d="M9 9h.01" /><Path d="M9 13h.01" /><Path d="M9 17h.01" />
                <Path d="M15 9h.01" /><Path d="M15 13h.01" /><Path d="M15 17h.01" />
              </Svg>
            )}
          </View>
          <View>
            <Text style={styles.planSectionTitle}>{config.sectionTitle}</Text>
            <Text style={styles.planSectionSub}>{config.sectionSubtitle}</Text>
          </View>
        </View>

        <View style={styles.planActionsRow}>
          {config.showAdminButton && (
            <TouchableOpacity 
              style={styles.btnSecondary} 
              onPress={onToggleAdminForm}
            >
              <Text style={styles.btnSecondaryText}>
                {showHospitalAdminForm ? 'Cancel' : config.btnAddAdmin}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.btnPrimary} 
            onPress={onToggleHospitalForm}
          >
            <Text style={styles.btnPrimaryText}>
              {showHospitalForm ? 'Cancel' : config.btnAddHospital}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TWO INFORMATION CARDS ROW - Hidden when form is open */}
      {!isFormOpen && (
        <View style={[styles.planCardsGrid, { flexDirection: isDesktop ? 'row' : 'column' }]}>
          
          {/* Left Card: Plan Operational Provision */}
          <View style={[styles.planInfoCard, { position: 'relative', overflow: 'hidden' }]}>
            <View style={styles.infoCardHeader}>
              <Text style={styles.infoPlanName}>
                {config.planName}
              </Text>
              <Text style={styles.infoPlanPrice}>
                {config.planPrice}
              </Text>
            </View>
            <Text style={styles.infoProvisionHeading}>
              Operational Provision
            </Text>
            
            <View style={styles.infoFeaturesGrid}>
              {config.features.map((feature, idx) => (
                <View key={idx} style={[styles.infoFeatureItemCol, isMobile && { width: '100%' }]}>
                  <View style={styles.featureItem}>
                    <Text style={{ color: '#2563eb', fontWeight: '800', fontSize: 14 }}>✓</Text>
                    <Text style={styles.featureItemText}>{feature}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Shield Watermark matching Web */}
            <View style={localCardStyles.shieldWatermark} pointerEvents="none">
              <Svg width={90} height={90} viewBox="0 0 24 24" fill="none" stroke="#dbeafe" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <Path d="m9 12 2 2 4-4" stroke="#93c5fd" strokeWidth={2} />
              </Svg>
            </View>
          </View>

          {/* Right Card: Digital Presence Add-on */}
          <View style={[styles.addonCard, isMobile && { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={styles.addonContentCol}>
              <View style={styles.addonTag}>
                <Text style={{ fontSize: 14, marginRight: 4 }}>✨</Text>
                <Text style={styles.addonTagText}>
                  DIGITAL PRESENCE ADD-ON (₹5,000 EXTRA)
                </Text>
              </View>
              <View style={{ gap: 8 }}>
                {ADDON_FEATURES.map((item, idx) => (
                  <View key={idx} style={styles.featureItem}>
                    <Text style={{ color: '#2563eb', fontWeight: '800', fontSize: 14 }}>✓</Text>
                    <Text style={styles.featureItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
            
            {/* Exact Web SVG Clipboard & Pen Illustration */}
            <View style={{ alignItems: 'center', justifyContent: 'center', padding: 4 }}>
              <Svg width={170} height={190} viewBox="0 0 200 220" fill="none">
                <Ellipse cx="100" cy="195" rx="80" ry="18" fill="#e0f0fe" />
                <Ellipse cx="100" cy="190" rx="65" ry="12" fill="#bfdbfe" fillOpacity={0.7} />
                <Rect x="40" y="30" width="110" height="150" rx="14" fill="#ffffff" stroke="#93c5fd" strokeWidth={2.5} />
                <Rect x="68" y="20" width="54" height="20" rx="6" fill="#60a5fa" />
                <Circle cx="95" cy="28" r="4" fill="#ffffff" />
                <Rect x="85" y="55" width="20" height="20" rx="4" fill="#eff6ff" />
                <Rect x="92" y="58" width="6" height="14" rx="2" fill="#2563eb" />
                <Rect x="88" y="62" width="14" height="6" rx="2" fill="#2563eb" />
                <Rect x="58" y="90" width="74" height="5" rx="2.5" fill="#93c5fd" />
                <Rect x="58" y="104" width="74" height="5" rx="2.5" fill="#cbd5e1" />
                <Rect x="58" y="118" width="74" height="5" rx="2.5" fill="#cbd5e1" />
                <Rect x="58" y="132" width="50" height="5" rx="2.5" fill="#cbd5e1" />
                <Rect x="58" y="146" width="60" height="5" rx="2.5" fill="#cbd5e1" />
                <G transform="rotate(35 155 125)">
                  <Rect x="145" y="60" width="14" height="90" rx="7" fill="#2563eb" />
                  <Path d="M145 150 L152 166 L159 150 Z" fill="#1e293b" />
                  <Circle cx="152" cy="166" r="1.5" fill="#38bdf8" />
                  <Rect x="148" y="70" width="8" height="15" rx="2" fill="#60a5fa" />
                  <Rect x="143" y="66" width="3" height="30" rx="1.5" fill="#93c5fd" />
                </G>
              </Svg>
            </View>
          </View>

        </View>
      )}
    </View>
  );
}

const localCardStyles = StyleSheet.create({
  shieldWatermark: {
    position: 'absolute',
    right: 15,
    bottom: 15,
    opacity: 0.6,
  },
});
