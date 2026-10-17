import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WARD_OPTIONS } from '../monitoringMockData';

export default function MonitoringHeader({
  ward,
  setWard,
  searchQuery,
  setSearchQuery,
  soundMuted,
  setSoundMuted,
  activeAlertsCount = 0,
  onOpenAlerts,
  socketStatus = 'connected',
  onReconnect,
}) {
  const [wardModalOpen, setWardModalOpen] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.header}>
      {/* Left side: title + badge */}
      <View style={styles.left}>
        <LinearGradient
          colors={['#0d9488', '#0284c7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconBadge}
        >
          <Feather name="activity" size={17} color="#ffffff" />
        </LinearGradient>
        <View style={styles.titleWrap}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Real-Time Monitoring</Text>
            {socketStatus === 'connected' ? (
              <View style={styles.liveBadge}>
                <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
                <Text style={styles.liveText}>LIVE SOCKET</Text>
              </View>
            ) : socketStatus === 'reconnecting' ? (
              <View style={[styles.liveBadge, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                <View style={[styles.liveDot, { backgroundColor: '#f59e0b' }]} />
                <Text style={[styles.liveText, { color: '#b45309' }]}>RECONNECTING</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.liveBadge, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
                onPress={onReconnect}
                activeOpacity={0.7}
              >
                <View style={[styles.liveDot, { backgroundColor: '#ef4444' }]} />
                <Text style={[styles.liveText, { color: '#b91c1c' }]}>OFFLINE (Retry)</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            Continuous patient vitals & connected telemetry surveillance
          </Text>
        </View>
      </View>

      {/* Right side: controls */}
      <View style={styles.right}>
        {/* Ward Selector Button */}
        <TouchableOpacity
          style={styles.wardButton}
          onPress={() => setWardModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.wardText} numberOfLines={1}>
            {ward}
          </Text>
          <Feather name="chevron-down" size={14} color="#64748b" />
        </TouchableOpacity>

        {/* Search Box */}
        <View style={styles.searchBox}>
          <Feather name="search" size={13} color="#94a3b8" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patient / MRN / bed..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={12} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Sound Mute Button */}
        <TouchableOpacity
          style={[styles.iconButton, soundMuted && styles.iconButtonMuted]}
          onPress={() => setSoundMuted(!soundMuted)}
          activeOpacity={0.7}
          accessibilityLabel={soundMuted ? 'Unmute Alarms' : 'Mute Alarms'}
        >
          <Feather
            name={soundMuted ? 'volume-x' : 'volume-2'}
            size={16}
            color={soundMuted ? '#ef4444' : '#475569'}
          />
        </TouchableOpacity>

        {/* Bell / Alert Button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onOpenAlerts}
          activeOpacity={0.7}
          accessibilityLabel="Active Alerts"
        >
          <Feather name="bell" size={16} color="#475569" />
          {activeAlertsCount > 0 ? (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {activeAlertsCount > 9 ? '9+' : activeAlertsCount}
              </Text>
            </View>
          ) : (
            <View style={styles.notifDot} />
          )}
        </TouchableOpacity>
      </View>

      {/* Ward Picker Modal */}
      <Modal
        visible={wardModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWardModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setWardModalOpen(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Surveillance Ward</Text>
              <TouchableOpacity onPress={() => setWardModalOpen(false)}>
                <Feather name="x" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>
            {WARD_OPTIONS.map((w) => (
              <TouchableOpacity
                key={w}
                style={[styles.wardOption, ward === w && styles.wardOptionActive]}
                onPress={() => {
                  setWard(w);
                  setWardModalOpen(false);
                }}
              >
                <Text style={[styles.wardOptionText, ward === w && styles.wardOptionTextActive]}>
                  {w}
                </Text>
                {ward === w && <Feather name="check" size={16} color="#0d9488" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    minWidth: 220,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  titleWrap: {
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 0.5,
  },
  simBadge: {
    backgroundColor: '#fffbeb',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  simText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  wardButton: {
    height: 32,
    paddingHorizontal: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    maxWidth: 90,
  },
  searchBox: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 8,
    minWidth: 160,
    maxWidth: 220,
  },
  searchInput: {
    fontSize: 11.5,
    color: '#0f172a',
    paddingVertical: 0,
    flex: 1,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconButtonMuted: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  notifDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  wardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  wardOptionActive: {
    backgroundColor: '#f0fdfa',
  },
  wardOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
  wardOptionTextActive: {
    fontWeight: '700',
    color: '#0d9488',
  },
});
