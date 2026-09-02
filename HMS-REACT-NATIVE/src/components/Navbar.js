import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAuth, useNotifications } from '../store/hooks';
import { logout } from '../store/slices/authSlice';
import { fetchNotifications, markAsRead } from '../store/slices/notificationSlice';
import { Ionicons } from '@expo/vector-icons';
import { useBranding } from '../context/BrandingContext';

/* ---- Brand Logo ---- */
const BrandLogo = () => (
  <Image source={require('../../assets/icon.png')} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
);

const Navbar = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAuth();
  const { items: notifications, unreadCount } = useNotifications();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { branding } = useBranding();

  useEffect(() => {
    if (isAuthenticated && user) {
      dispatch(fetchNotifications());
    }
  }, [isAuthenticated, user, dispatch]);

  const handleLogout = () => {
    dispatch(logout());
    setShowSettings(false);
    navigation.reset({
      index: 0,
      routes: [{ name: 'LoginScreen' }],
    });
  };

  const handleNotificationClick = (id) => {
    dispatch(markAsRead(id));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navbar}>
        <View style={styles.navbarContainer}>

          {/* Logo/Brand */}
          <TouchableOpacity 
            style={styles.navbarBrand} 
            onPress={() => navigation.navigate(isAuthenticated ? 'DashboardLayout' : 'Home')}
          >
            {branding.logoUrl ? (
              <Image source={{ uri: branding.logoUrl }} style={{ height: 36, width: 100, resizeMode: 'contain' }} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.navbarLogoIcon}>
                  <BrandLogo />
                </View>
                <View style={styles.navbarLogoText}>
                  <Text style={styles.navbarLogoMain}>{branding.appName || 'Medical 365'}</Text>
                  <Text style={styles.navbarLogoSub}>{branding.tagline || 'Healthcare Suite'}</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {/* Navigation Links */}
          <View style={styles.navbarLinks}>

            {isAuthenticated && user && (
              <TouchableOpacity
                style={styles.navLink}
                onPress={() => navigation.navigate('DashboardLayout')}
              >
                <Ionicons name="home-outline" size={18} color="#334155" />
              </TouchableOpacity>
            )}

            <View style={styles.navDivider} />

            {/* Notifications */}
            {isAuthenticated && (
              <View style={styles.notificationWrapper}>
                <TouchableOpacity
                  style={styles.notificationBtn}
                  onPress={() => {
                    setShowNotifications(!showNotifications);
                    setShowSettings(false);
                  }}
                >
                  <Ionicons name="notifications-outline" size={22} color="#334155" />
                  {unreadCount > 0 && (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {showNotifications && (
                  <View style={styles.dropdownMenu}>
                    <View style={styles.notificationHeader}>
                      <Text style={styles.notificationTitle}>Notifications</Text>
                      {unreadCount > 0 && <View style={styles.badgeDanger}><Text style={styles.badgeDangerText}>{unreadCount} new</Text></View>}
                    </View>
                    <View style={styles.notificationList}>
                      {notifications.length === 0 ? (
                        <Text style={styles.noNotifications}>🔔 You're all caught up!</Text>
                      ) : (
                        notifications.slice(0, 5).map(notif => (
                          <TouchableOpacity
                            key={notif._id}
                            style={[styles.notificationItem, notif.status === 'Unread' && styles.unread]}
                            onPress={() => handleNotificationClick(notif._id)}
                          >
                            <Text style={styles.notificationMsg} numberOfLines={2}>{notif.message}</Text>
                            <Text style={styles.notificationTime}>
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                    <TouchableOpacity style={styles.notificationFooter} onPress={() => { setShowNotifications(false); navigation.navigate('DashboardLayout'); }}>
                      <Text style={styles.notificationFooterText}>View all notifications →</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Settings / User Dropdown */}
            <View style={styles.settingsDropdown}>
              <TouchableOpacity 
                style={styles.settingsLink}
                onPress={() => {
                  setShowSettings(!showSettings);
                  setShowNotifications(false);
                }}
              >
                {isAuthenticated && user ? (
                  <Text style={styles.settingsUserName}>
                    {(user.name || 'User').split(' ')[0]}
                  </Text>
                ) : (
                  <Ionicons name="settings-outline" size={20} color="#334155" />
                )}
                <Ionicons name="chevron-down" size={14} color="#64748b" style={styles.dropdownArrow} />
              </TouchableOpacity>

              {showSettings && (
                <View style={styles.dropdownMenu}>
                  {isAuthenticated ? (
                    <>
                      {user && (
                        <View style={styles.dropdownUserInfo}>
                          <Text style={styles.userName}>{user.name}</Text>
                          <Text style={styles.userEmail}>{user.email}</Text>
                          {user.role && (
                            <View style={styles.userRoleBadge}>
                              <Text style={styles.userRoleText}>{user.role}</Text>
                            </View>
                          )}
                        </View>
                      )}
                      <TouchableOpacity style={[styles.dropdownItem, styles.logoutBtn]} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={18} color="#ef4444" style={styles.dropdownIcon} />
                        <Text style={styles.logoutBtnText}>Logout</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity 
                        style={styles.dropdownItem} 
                        onPress={() => {
                          setShowSettings(false);
                          navigation.navigate('LoginScreen');
                        }}
                      >
                        <Ionicons name="log-in-outline" size={18} color="#0ea5e9" style={styles.dropdownIcon} />
                        <Text style={styles.dropdownItemText}>Staff Login</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>

          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingTop: Platform.OS === 'android' ? 25 : 0, // safe area adjustment
  },
  navbar: {
    height: 60,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  navbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
  },
  navbarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navbarLogoIcon: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  navbarLogoText: {
    justifyContent: 'center',
  },
  navbarLogoMain: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  navbarLogoSub: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  navbarLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navLink: {
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 8,
  },
  notificationWrapper: {
    position: 'relative',
    marginRight: 4,
  },
  notificationBtn: {
    padding: 8,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  settingsDropdown: {
    position: 'relative',
  },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  settingsUserName: {
    fontWeight: '700',
    fontSize: 13,
    color: '#0ea5e9', // using brand color roughly
    marginRight: 4,
  },
  dropdownArrow: {
    marginLeft: 2,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 50,
    right: 0,
    width: 280,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 9999,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  notificationTitle: {
    fontWeight: '700',
    fontSize: 15,
    color: '#0f172a',
  },
  badgeDanger: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeDangerText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '600',
  },
  notificationList: {
    maxHeight: 250,
  },
  noNotifications: {
    padding: 20,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 13,
  },
  notificationItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  unread: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 3,
    borderLeftColor: '#0ea5e9',
  },
  notificationMsg: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  notificationFooter: {
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  notificationFooterText: {
    color: '#0ea5e9',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownUserInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  userName: {
    fontWeight: '700',
    fontSize: 15,
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  userRoleBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  userRoleText: {
    color: '#0369a1',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  dropdownIcon: {
    marginRight: 10,
  },
  logoutBtn: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fff1f2',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  logoutBtnText: {
    fontSize: 14,
    color: '#e11d48',
    fontWeight: '600',
  },
});

export default Navbar;
