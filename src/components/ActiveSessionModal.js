import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';

const ActiveSessionModal = ({ activeSession, activeSessions, onForceLogin, onCancel, loading }) => {
    if (!activeSession && (!activeSessions || activeSessions.length === 0)) return null;

    const sessionsList = activeSessions && activeSessions.length > 0
        ? activeSessions
        : (Array.isArray(activeSession) ? activeSession : [activeSession]);

    const isMultiple = sessionsList.length > 1;

    const formatTime = (dateStr) => {
        if (!dateStr) return 'Unknown';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true,
            });
        } catch {
            return 'Unknown';
        }
    };

    return (
        <Modal transparent animationType="fade" visible={true}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <Feather name="alert-circle" size={32} color="#ef4444" />
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.title}>
                                {isMultiple ? 'Active Session Limit Reached' : 'Active Session Detected'}
                            </Text>
                            <Text style={styles.subtitle}>
                                {isMultiple
                                    ? `Your account is already active on ${sessionsList.length} devices.`
                                    : 'Your account is already logged in on another device.'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.body}>
                        <Text style={styles.message}>
                            {isMultiple
                                ? 'Would you like to logout the oldest active device and continue with this new login?'
                                : 'Would you like to logout the previous device and continue? The other session will be immediately terminated.'}
                        </Text>

                        <View style={styles.sessionList}>
                            {sessionsList.map((session, idx) => (
                                <View key={session.sessionId || idx} style={styles.sessionItem}>
                                    <Text style={styles.sessionTitle}>
                                        {isMultiple ? `Active Device ${idx + 1}` : 'Previous Session Details'}
                                    </Text>
                                    
                                    <View style={styles.sessionRow}>
                                        <Feather name="globe" size={16} color="#64748b" />
                                        <View style={styles.sessionCol}>
                                            <Text style={styles.sessionLabel}>Browser</Text>
                                            <Text style={styles.sessionValue}>{session.browser || 'Unknown'}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.sessionRow}>
                                        <Feather name="monitor" size={16} color="#64748b" />
                                        <View style={styles.sessionCol}>
                                            <Text style={styles.sessionLabel}>Operating System</Text>
                                            <Text style={styles.sessionValue}>{session.os || 'Unknown'}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.sessionRow}>
                                        <Feather name="clock" size={16} color="#64748b" />
                                        <View style={styles.sessionCol}>
                                            <Text style={styles.sessionLabel}>Last Active</Text>
                                            <Text style={styles.sessionValue}>{formatTime(session.lastActive)}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity style={[styles.btnForce, loading && {opacity: 0.7}]} onPress={onForceLogin} disabled={loading}>
                            <Text style={styles.textForce}>
                                {loading ? 'Logging out device...' : (isMultiple ? 'Logout Oldest & Continue' : 'Logout Previous & Continue')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btnCancel, loading && {opacity: 0.7}]} onPress={onCancel} disabled={loading}>
                            <Text style={styles.textCancel}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    card: { backgroundColor: 'white', padding: 20, borderRadius: 16, width: '100%', maxHeight: '90%' },
    header: { flexDirection: 'row', marginBottom: 16, alignItems: 'center' },
    headerTextContainer: { marginLeft: 12, flex: 1 },
    title: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
    body: { marginBottom: 20 },
    message: { fontSize: 14, color: '#334155', marginBottom: 16, lineHeight: 20 },
    sessionList: { maxHeight: 300 },
    sessionItem: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    sessionTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    sessionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    sessionCol: { marginLeft: 10 },
    sessionLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: '600' },
    sessionValue: { fontSize: 13, color: '#1e293b', fontWeight: '500', marginTop: 2 },
    actions: { gap: 10 },
    btnForce: { backgroundColor: '#ef4444', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
    textForce: { color: 'white', fontWeight: 'bold', fontSize: 15 },
    btnCancel: { backgroundColor: '#f1f5f9', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
    textCancel: { color: '#475569', fontWeight: 'bold', fontSize: 15 }
});

export default ActiveSessionModal;
