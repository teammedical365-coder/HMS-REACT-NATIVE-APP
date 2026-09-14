import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { styles } from './CentralAdminDashboardStyles';

export default function CentralAdminTabs({ activeTab, setActiveTab, onRevenueAnalyticsPress, onRefreshPress }) {
  const tabs = [
    { id: 'hospitals', label: 'Enterprise Plan', iconType: 'user' },
    { id: 'multi-speciality', label: 'Multi-Speciality Starter', iconType: 'file' },
    { id: 'clinic-basic', label: 'Clinic Basic Plan', iconType: 'edit' },
    { id: 'simple-clinics', label: 'Starter Plan', iconType: 'file' },
    { id: 'revenue-plans', label: 'Revenue Plans', iconType: 'credit-card' },
    { id: 'configurations', label: 'Configurations', iconType: 'settings' },
  ];

  const renderTabIcon = (type, isActive) => {
    const strokeColor = isActive ? '#059669' : '#64748b';
    switch (type) {
      case 'user':
        return (
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </Svg>
        );
      case 'file':
        return (
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </Svg>
        );
      case 'edit':
        return (
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </Svg>
        );
      case 'credit-card':
        return (
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </Svg>
        );
      case 'settings':
        return (
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </Svg>
        );
      default:
        return null;
    }
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.titleIconBox}>
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18" />
              <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
              <path d="M9 9h.01" /><path d="M9 13h.01" /><path d="M9 17h.01" />
              <path d="M15 9h.01" /><path d="M15 13h.01" /><path d="M15 17h.01" />
            </Svg>
          </View>
          <View style={styles.titleTextCol}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.mainTitle}>
                Central Administration{' '}
              </Text>
              <Text style={[styles.mainTitle, { color: '#c026d3' }]}>
                Dashboard
              </Text>
            </View>
            <Text style={styles.mainSubtitle}>
              Manage all hospitals, staff, and system configurations
            </Text>
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity 
            style={styles.revenueAnalyticsBtn} 
            onPress={onRevenueAnalyticsPress}
            activeOpacity={0.85}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2} style={{ marginRight: 6 }}>
              <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
            </Svg>
            <Text style={styles.revenueAnalyticsBtnText}>
              System Revenue Analytics
            </Text>
            <Text style={{ color: '#ffffff', fontSize: 10, marginLeft: 6 }}>▼</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={localStyles.refreshBtn} 
            onPress={onRefreshPress}
            activeOpacity={0.85}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={2} style={{ marginRight: 5 }}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </Svg>
            <Text style={localStyles.refreshBtnText}>
              Refresh
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabsNavContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollWrapper} 
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  localStyles.tabPill, 
                  isActive ? localStyles.tabPillActive : localStyles.tabPillInactive
                ]} 
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.8}
              >
                {renderTabIcon(tab.iconType, isActive)}
                <Text style={[
                  localStyles.tabPillText, 
                  isActive ? localStyles.tabPillTextActive : localStyles.tabPillTextInactive
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#ffffff',
  },
  tabPillActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  tabPillInactive: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabPillTextActive: {
    color: '#059669',
  },
  tabPillTextInactive: {
    color: '#475569',
  },
});
