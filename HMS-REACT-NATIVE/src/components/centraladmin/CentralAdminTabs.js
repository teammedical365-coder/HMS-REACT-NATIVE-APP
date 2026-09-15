import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Pressable, ScrollView, StyleSheet, useWindowDimensions, Animated, Platform } from 'react-native';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { styles } from './CentralAdminDashboardStyles';

const TAB_THEMES = {
  hospitals: {
    bg: '#ecfdf5',
    border: '#a7f3d0',
    color: '#059669',
    shadow: 'rgba(5, 150, 105, 0.18)',
  },
  'multi-speciality': {
    bg: '#f0f9ff',
    border: '#bae6fd',
    color: '#0284c7',
    shadow: 'rgba(2, 132, 199, 0.18)',
  },
  'clinic-basic': {
    bg: '#eef2ff',
    border: '#c7d2fe',
    color: '#6366f1',
    shadow: 'rgba(99, 102, 241, 0.18)',
  },
  'simple-clinics': {
    bg: '#fdf2f8',
    border: '#fbcfe8',
    color: '#ec4899',
    shadow: 'rgba(236, 72, 153, 0.18)',
  },
  'revenue-plans': {
    bg: '#fef3c7',
    border: '#fde68a',
    color: '#d97706',
    shadow: 'rgba(217, 119, 6, 0.18)',
  },
  configurations: {
    bg: '#f0fdfa',
    border: '#99f6e4',
    color: '#0d9488',
    shadow: 'rgba(13, 148, 136, 0.18)',
  },
};

export default function CentralAdminTabs({ activeTab, setActiveTab, onRevenueAnalyticsPress, onRefreshPress, isRefreshing = false }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation;
    if (isRefreshing) {
      spinAnim.setValue(0);
      animation = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      animation.start();
    } else {
      spinAnim.setValue(0);
    }
    return () => animation?.stop();
  }, [isRefreshing]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const tabs = [
    { id: 'hospitals', label: 'Enterprise Plan', iconType: 'user' },
    { id: 'multi-speciality', label: 'Multi-Speciality Starter', iconType: 'file' },
    { id: 'clinic-basic', label: 'Clinic Basic Plan', iconType: 'edit' },
    { id: 'simple-clinics', label: 'Starter Plan', iconType: 'file' },
    { id: 'revenue-plans', label: 'Revenue Plans', iconType: 'credit-card' },
    { id: 'configurations', label: 'Configurations', iconType: 'settings' },
  ];

  const renderTabIcon = (type, isActive, activeColor) => {
    const strokeColor = isActive ? activeColor : '#64748b';
    switch (type) {
      case 'user':
        return (
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <Circle cx="12" cy="7" r="4" />
          </Svg>
        );
      case 'file':
        return (
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <Path d="M14 2v6h6" />
          </Svg>
        );
      case 'edit':
        return (
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 20h9" />
            <Path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </Svg>
        );
      case 'credit-card':
        return (
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <Path d="M14 2v6h6" />
            <Line x1="12" y1="18" x2="12" y2="12" />
            <Line x1="9" y1="15" x2="15" y2="15" />
          </Svg>
        );
      case 'settings':
        return (
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="12" cy="12" r="3" />
            <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </Svg>
        );
      default:
        return null;
    }
  };

  return (
    <View style={{ marginBottom: 16 }}>
      {/* 1. Header Row */}
      <View style={[styles.headerRow, isMobile && { flexDirection: 'column', alignItems: 'stretch', gap: 14 }]}>
        <View style={styles.titleGroup}>
          <View style={styles.titleIconBox}>
            {/* Exact Web 3D Hospital Building SVG */}
            <Svg width={28} height={28} viewBox="0 0 40 40" fill="none">
              <Rect width="40" height="40" rx="10" fill="#2563EB" />
              <Rect x="8" y="10" width="24" height="22" rx="4" fill="#ffffff" />
              <Rect x="17" y="5" width="6" height="6" rx="2" fill="#60A5FA" />
              <Rect x="17" y="24" width="6" height="8" rx="1" fill="#2563EB" />
              <Circle cx="13" cy="16" r="2" fill="#93C5FD" />
              <Circle cx="27" cy="16" r="2" fill="#93C5FD" />
              <Circle cx="13" cy="22" r="2" fill="#93C5FD" />
              <Circle cx="27" cy="22" r="2" fill="#93C5FD" />
            </Svg>
          </View>
          <View style={styles.titleTextCol}>
            <Text style={[styles.mainTitle, isMobile && { fontSize: 20 }]}>
              Central Administration Dashboard
            </Text>
            <Text style={[styles.mainSubtitle, isMobile && { fontSize: 12.5 }]}>
              Manage all hospitals, staff, and system configurations
            </Text>
          </View>
        </View>
        
        {/* Header Actions */}
        <View style={[styles.headerActionsRow, isMobile && { width: '100%', justifyContent: 'space-between' }]}>
          <Pressable 
            style={({ pressed, hovered }) => [
              styles.revenueAnalyticsBtn, 
              isMobile && { flex: 1, paddingVertical: 10, paddingHorizontal: 12 },
              hovered && {
                backgroundColor: '#1d4ed8',
                transform: [{ translateY: -1 }],
                ...Platform.select({
                  web: {
                    boxShadow: '0 6px 18px rgba(37, 99, 235, 0.35)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }
                }),
              },
              pressed && {
                backgroundColor: '#1e40af',
                transform: [{ scale: 0.98 }],
              }
            ]} 
            onPress={onRevenueAnalyticsPress}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2.2} style={{ marginRight: 6 }}>
              <Path d="M3 3v18h18" /><Path d="m19 9-5 5-4-4-3 3" />
            </Svg>
            <Text style={[styles.revenueAnalyticsBtnText, isMobile && { fontSize: 12.5 }]}>
              System Revenue Analytics
            </Text>
            <Text style={{ color: '#ffffff', fontSize: 10, marginLeft: 6 }}>▼</Text>
          </Pressable>

          <Pressable 
            style={({ pressed, hovered }) => [
              localStyles.refreshBtn, 
              isMobile && { paddingVertical: 10, paddingHorizontal: 12 },
              hovered && !isRefreshing && {
                backgroundColor: '#eff6ff',
                borderColor: '#93c5fd',
                transform: [{ translateY: -1 }],
                ...Platform.select({
                  web: {
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.16)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }
                }),
              },
              pressed && !isRefreshing && {
                transform: [{ scale: 0.97 }]
              },
              isRefreshing && {
                opacity: 0.7,
                ...Platform.select({ web: { cursor: 'not-allowed' } })
              }
            ]} 
            onPress={isRefreshing ? undefined : onRefreshPress}
            disabled={isRefreshing}
          >
            <Animated.View style={{ transform: [{ rotate: spinInterpolate }], marginRight: 6 }}>
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={isRefreshing ? '#1d4ed8' : '#2563eb'} strokeWidth={2.2}>
                <Path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <Path d="M3 3v5h5"/>
                <Path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <Path d="M16 21h5v-5"/>
              </Svg>
            </Animated.View>
            <Text style={[localStyles.refreshBtnText, isMobile && { fontSize: 12.5 }, isRefreshing && { color: '#1d4ed8' }]}>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 2. Category / Plan Tabs Navigation (Multi-Colored Web Themes) */}
      <View style={styles.tabsNavContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollWrapper} 
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const theme = TAB_THEMES[tab.id] || TAB_THEMES.hospitals;

            return (
              <Pressable
                key={tab.id}
                style={({ pressed, hovered }) => [
                  localStyles.tabPill, 
                  isMobile && { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
                  isActive ? {
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    shadowColor: theme.shadow,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 1,
                    shadowRadius: 14,
                    elevation: 3,
                    ...Platform.select({
                      web: {
                        boxShadow: `0 4px 14px ${theme.shadow}`,
                        cursor: 'pointer',
                        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                      }
                    }),
                  } : [
                    localStyles.tabPillInactive,
                    hovered && {
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      transform: [{ translateY: -1 }],
                      ...Platform.select({
                        web: {
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
                          cursor: 'pointer',
                          transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                        }
                      }),
                    }
                  ],
                  pressed && {
                    transform: [{ scale: 0.97 }]
                  }
                ]} 
                onPress={() => setActiveTab(tab.id)}
              >
                {renderTabIcon(tab.iconType, isActive, theme.color)}
                <Text style={[
                  localStyles.tabPillText, 
                  isMobile && { fontSize: 12.5 },
                  isActive ? { color: theme.color, fontWeight: '800' } : localStyles.tabPillTextInactive
                ]}>
                  {tab.label}
                </Text>
              </Pressable>
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    shadowColor: 'rgba(37, 99, 235, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  refreshBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2563eb',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: 'rgba(226, 232, 240, 0.85)',
  },
  tabPillInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: 'rgba(226, 232, 240, 0.85)',
  },
  tabPillText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  tabPillTextInactive: {
    color: '#334155',
  },
});
