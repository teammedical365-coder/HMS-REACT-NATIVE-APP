import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function AddNoteModal({ visible, onClose, onSave }) {
  const [author, setAuthor] = useState('');
  const [role, setRole] = useState('Staff Nurse');
  const [text, setText] = useState('');

  const roles = ['Staff Nurse', 'Attending Doctor', 'ICU Resident', 'Specialist'];

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({
      author: author.trim() || 'Attending Staff',
      role,
      text: text.trim(),
    });
    setAuthor('');
    setText('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Clinical Note</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Author Name */}
          <Text style={styles.label}>Author Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Dr. Rajesh / Nurse Priya"
            placeholderTextColor="#94a3b8"
            value={author}
            onChangeText={setAuthor}
          />

          {/* Role selector */}
          <Text style={styles.label}>Role</Text>
          <View style={styles.roleRow}>
            {roles.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleChip, role === r && styles.roleChipActive]}
                onPress={() => setRole(r)}
              >
                <Text
                  style={[
                    styles.roleChipText,
                    role === r && styles.roleChipTextActive,
                  ]}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Note content */}
          <Text style={styles.label}>Observation / Note</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Document patient telemetry observation, medication titration, or condition changes..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={text}
            onChangeText={setText}
          />

          {/* Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, !text.trim() && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!text.trim()}
            >
              <Text style={styles.saveText}>Save Note</Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#0f172a',
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  roleChip: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roleChipActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0f766e',
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  roleChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  textArea: {
    height: 90,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  cancelBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  cancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  saveBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#0d9488',
  },
  saveBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  saveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
});
