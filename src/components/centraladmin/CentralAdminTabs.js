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
      {/* 1. DASHBOARD HEADER AREA */}
      <View style={styles.headerRow}> {/* .cad-header-row */}
        <View style={styles.titleGroup}> {/* .cad-title-group */}
          <View style={styles.titleIconBox}> {/* .cad-title-icon-box */}
            <Text style={{ fontSize: 24 }}>🎛️</Text>
          </View>
          <View style={styles.titleTextCol}> {/* .cad-title-text-col */}
            <Text style={styles.mainTitle}> {/* .cad-main-title */}
              Central Administration Dashboard
            </Text>
            <Text style={styles.mainSubtitle}> {/* .cad-main-subtitle */}
              Manage all hospitals, staff, and system configurations
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.revenueAnalyticsBtn} 
          onPress={onRevenueAnalyticsPress}
        >
          <Text style={styles.revenueAnalyticsBtnText}> {/* .cad-revenue-analytics-btn text */}
            📊 System Revenue Analytics ▼
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. CATEGORY / PLAN TABS NAVIGATION */}
      <View style={styles.tabsNavContainer}> {/* .cad-tabs-nav-container */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollWrapper} 
        >
          {tabs.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            
            // Map to multi-colored active tab pills (.cad-tab-pill.active)
            let activeStyle = {};
            let activeTextStyle = {};
            if (isActive) {
               // Assign alternating styles based on index for variety matching web behavior
               if(idx % 2 === 0) {
                   activeStyle = styles.tabPillActiveBlue; // .cad-tab-pill.tab-theme-blue.active
                   activeTextStyle = styles.tabPillTextActiveBlue;
               } else {
                   activeStyle = styles.tabPillActiveGreen; // .cad-tab-pill.tab-theme-green.active
                   activeTextStyle = styles.tabPillTextActiveGreen;
               }
            }

            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabPill, activeStyle]} 
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={{ fontSize: 16 }}>{tab.icon}</Text> {/* .cad-tab-icon */}
                <Text style={[styles.tabPillText, activeTextStyle]}> {/* text inside .cad-tab-pill */}
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
