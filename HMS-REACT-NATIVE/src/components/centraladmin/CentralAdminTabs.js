import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { styles } from './CentralAdminDashboardStyles';

export default function CentralAdminTabs({ activeTab, setActiveTab, onRevenueAnalyticsPress }) {
  const tabs = [
    { id: 'hospitals', label: 'Enterprise Plan', icon: '🏢' },
    { id: 'multi-speciality', label: 'Multi-Speciality Starter', icon: '🏥' },
    { id: 'clinic-basic', label: 'Clinic Basic Plan', icon: '🩺' },
    { id: 'simple-clinics', label: 'Starter Plan', icon: '🏠' },
    { id: 'revenue-plans', label: 'Revenue Plans', icon: '💰' },
    { id: 'configurations', label: 'Configurations', icon: '⚙️' },
  ];

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.titleIconBox}>
            <Text style={{ fontSize: 24 }}>🎛️</Text>
          </View>
          <View style={styles.titleTextCol}>
            <Text style={styles.mainTitle}>
              Central Administration Dashboard
            </Text>
            <Text style={styles.mainSubtitle}>
              Manage all hospitals, staff, and system configurations
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.revenueAnalyticsBtn} 
          onPress={onRevenueAnalyticsPress}
        >
          <Text style={styles.revenueAnalyticsBtnText}>
            📊 System Revenue Analytics ▼
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabsNavContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollWrapper} 
        >
          {tabs.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            
            let activeStyle = {};
            let activeTextStyle = {};
            if (isActive) {
               if(idx % 2 === 0) {
                   activeStyle = styles.tabPillActiveBlue;
                   activeTextStyle = styles.tabPillTextActiveBlue;
               } else {
                   activeStyle = styles.tabPillActiveGreen;
                   activeTextStyle = styles.tabPillTextActiveGreen;
               }
            }

            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabPill, activeStyle]} 
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={{ fontSize: 16 }}>{tab.icon}</Text>
                <Text style={[styles.tabPillText, activeTextStyle]}>
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
