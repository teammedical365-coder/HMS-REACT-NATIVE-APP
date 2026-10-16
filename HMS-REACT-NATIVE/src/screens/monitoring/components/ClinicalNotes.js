import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function ClinicalNotes({ notes = [], onOpenAddNote }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Feather name="file-text" size={14} color="#0d9488" />
          <Text style={styles.title}>Clinical Notes & Surveillance Log</Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={onOpenAddNote}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={12} color="#ffffff" style={{ marginRight: 3 }} />
          <Text style={styles.addBtnText}>Add Note</Text>
        </TouchableOpacity>
      </View>

      {notes.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Feather name="edit-3" size={18} color="#94a3b8" />
          <Text style={styles.emptyText}>No clinical shift notes recorded</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {notes.map((note) => (
            <View key={note.id} style={styles.noteItem}>
              <View style={styles.noteHeader}>
                <View style={styles.authorRow}>
                  <Text style={styles.authorText}>{note.author}</Text>
                  <View style={styles.roleTag}>
                    <Text style={styles.roleText}>{note.role}</Text>
                  </View>
                </View>
                <Text style={styles.timeText}>{note.time}</Text>
              </View>
              <Text style={styles.noteBody}>{note.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d9488',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  addBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptyWrap: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  list: {
    gap: 8,
  },
  noteItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1e293b',
  },
  roleTag: {
    backgroundColor: '#e0f2fe',
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 3,
  },
  roleText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#0369a1',
  },
  timeText: {
    fontSize: 9.5,
    color: '#64748b',
  },
  noteBody: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 15,
  },
});
