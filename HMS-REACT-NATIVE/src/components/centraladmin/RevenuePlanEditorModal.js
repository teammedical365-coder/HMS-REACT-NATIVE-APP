import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

export default function RevenuePlanEditorModal({ visible, onClose, hospital, onSave }) {
  const [formData, setFormData] = useState({
    platformFee: '0',
    revenueShare: '0',
  });

  useEffect(() => {
    if (hospital && hospital.revenueConfig) {
      setFormData({
        platformFee: String(hospital.revenueConfig.platformFee || '0'),
        revenueShare: String(hospital.revenueConfig.revenueShare || '0'),
      });
    } else {
      setFormData({ platformFee: '0', revenueShare: '0' });
    }
  }, [hospital]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={styles.overlayTouchable}
          pointerEvents="auto"
        />
        <View style={styles.modalContainer} pointerEvents="box-auto">
          <View style={styles.header} pointerEvents="box-none">
            <Text style={styles.title}>Edit Revenue Plan</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              pointerEvents="auto"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} pointerEvents="box-none">
            <Text style={styles.subtitle}>
              Configure revenue sharing and platform fees for {hospital?.name || 'this hospital'}.
            </Text>

            <View style={styles.inputGroup} pointerEvents="box-none">
              <Text style={styles.label}>Platform Fee (₹)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={formData.platformFee}
                onChangeText={(val) => setFormData({ ...formData, platformFee: val })}
                pointerEvents="auto"
              />
            </View>

            <View style={styles.inputGroup} pointerEvents="box-none">
              <Text style={styles.label}>Revenue Share (%)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={formData.revenueShare}
                onChangeText={(val) => setFormData({ ...formData, revenueShare: val })}
                pointerEvents="auto"
              />
            </View>
          </ScrollView>

          <View style={styles.footer} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
              pointerEvents="auto"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => onSave(formData)}
              activeOpacity={0.7}
              pointerEvents="auto"
            >
              <Text style={styles.saveText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayTouchable: {
    ...StyleSheet.absoluteFill,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: 'bold',
  },
  content: {
    padding: 20,
    gap: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 10,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  saveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#2563eb',
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
