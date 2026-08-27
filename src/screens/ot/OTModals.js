import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, TextInput, Dimensions, Alert } from 'react-native';

const { width } = Dimensions.get('window');

export const getStatusStyle = (status) => {
    switch(status) {
        case 'PLANNED': return { label: 'PLANNED', bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
        case 'SCHEDULED': return { label: 'SCHEDULED', bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' };
        case 'ADMITTED': return { label: 'ADMITTED', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
        case 'PRE_OP': return { label: 'PRE-OP', bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
        case 'READY_FOR_OT': return { label: 'READY FOR OT', bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' };
        case 'IN_OT': return { label: '🔴 IN OT', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' };
        case 'SURGERY_COMPLETED': return { label: 'SURGERY DONE', bg: '#ccfbf1', color: '#0f766e', border: '#99f6e4' };
        case 'POST_OP': return { label: 'POST-OP', bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' };
        case 'COMPLETED': return { label: '✓ COMPLETED', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
        case 'CANCELLED': return { label: 'CANCELLED', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' };
        default: return { label: status || 'UNKNOWN', bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
    }
};

export const getElapsedTime = (startTime) => {
    if (!startTime) return null;
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now - start;
    if (diffMs < 0) return '0m';
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return `${hrs}h ${remMins}m`;
    return `${mins}m`;
};

export const checkIfDelayed = (surgery) => {
    if (!surgery || !surgery.startTime || surgery.status !== 'SCHEDULED') return false;
    const today = new Date().toISOString().split('T')[0];
    const surgeryDate = surgery.surgeryDate ? new Date(surgery.surgeryDate).toISOString().split('T')[0] : today;
    if (surgeryDate !== today) return false;

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeVal = currentHours * 60 + currentMinutes;

    const match = String(surgery.startTime).match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!match) return false;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const mer = match[3];
    if (mer) {
        if (mer.toUpperCase() === 'PM' && h < 12) h += 12;
        if (mer.toUpperCase() === 'AM' && h === 12) h = 0;
    }
    const scheduledTimeVal = h * 60 + m;

    return currentTimeVal > scheduledTimeVal;
};

// Simplified native details modal
export const SurgeryDetailsModal = ({ open, surgery, onClose, onOpenScheduleModal }) => {
    if (!surgery) return null;
    const s = surgery;
    const statusInfo = getStatusStyle(s.status);
    const sElapsed = s.status === 'IN_OT' ? getElapsedTime(s.actualStartTime) : null;
    const surgeonName = (s.surgeonId?.name || 'Surgeon').replace(/^Dr\.?\s*/i, '');
    const cost = Number(s.surgeryCost) || 0;
    const paid = Number(s.paidAmount) || 0;
    const remaining = Math.max(0, cost - paid);

    return (
        <Modal visible={open} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>📋 Surgery Details</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Text style={styles.closeBtnText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalBody}>
                        <View style={styles.procedureBanner}>
                            <View>
                                <Text style={styles.procedureLabel}>PROCEDURE</Text>
                                <Text style={styles.procedureName}>{s.surgery}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg, borderColor: statusInfo.border }]}>
                                <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                            </View>
                        </View>

                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>PATIENT</Text>
                            <Text style={styles.infoValue}>{s.patientId?.name || 'Patient'}</Text>
                            <Text style={styles.infoSub}>MRN: {s.patientId?.mrn || '-'}</Text>
                        </View>

                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>OPERATING SURGEON</Text>
                            <Text style={styles.infoValue}>Dr. {surgeonName}</Text>
                        </View>

                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>OT ROOM & TIMING</Text>
                            {s.otRoomId?.name ? (
                                <>
                                    <Text style={styles.infoValue}>🚪 {s.otRoomId.name}</Text>
                                    <Text style={styles.infoSub}>⏰ {s.startTime || '--:--'} {s.endTime ? `- ${s.endTime}` : ''}</Text>
                                </>
                            ) : (
                                <Text style={[styles.infoSub, { color: '#b45309', fontWeight: 'bold' }]}>⏳ OT scheduling pending</Text>
                            )}
                        </View>

                        {cost > 0 && (
                            <View style={[styles.infoBox, { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' }]}>
                                <Text style={[styles.infoLabel, { color: '#475569' }]}>💳 Financial Status</Text>
                                <Text style={styles.infoValue}>Total: ₹{cost.toLocaleString()} | Paid: ₹{paid.toLocaleString()}</Text>
                                <Text style={[styles.infoSub, { color: remaining > 0 ? '#dc2626' : '#16a34a' }]}>Remaining: ₹{remaining.toLocaleString()}</Text>
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity onPress={onClose} style={styles.footerCancelBtn}>
                            <Text style={styles.footerCancelText}>Close</Text>
                        </TouchableOpacity>
                        {s.status === 'PLANNED' && onOpenScheduleModal && (
                            <TouchableOpacity onPress={() => { onClose(); onOpenScheduleModal(s); }} style={styles.footerActionBtn}>
                                <Text style={styles.footerActionText}>📅 Schedule</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export const ScheduleSurgeryModal = ({ open, activePlan, onClose, doctorsList, otRoomsList, onSuccess }) => {
    if (!activePlan) return null;
    
    return (
        <Modal visible={open} transparent={true} animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>📅 Schedule Surgery</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Text style={styles.closeBtnText}>×</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.modalBody}>
                        <Text style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>Scheduling from mobile app is limited. Please use the Web Dashboard for full scheduling features including assistant assignments.</Text>
                        
                        <View style={styles.infoBox}>
                            <Text style={styles.infoLabel}>PROCEDURE</Text>
                            <Text style={styles.infoValue}>{activePlan.surgery}</Text>
                            <Text style={styles.infoSub}>Patient: {activePlan.patientId?.name}</Text>
                        </View>

                        <Text style={{ fontSize: 16, fontWeight: 'bold', marginVertical: 10 }}>Form Placeholder</Text>
                        <TextInput style={styles.input} placeholder="Room ID..." editable={false} />
                        <TextInput style={styles.input} placeholder="Start Time..." editable={false} />
                    </ScrollView>
                    <View style={styles.modalFooter}>
                        <TouchableOpacity onPress={onClose} style={styles.footerCancelBtn}>
                            <Text style={styles.footerCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export const WorkflowBedModal = ({ open, modalConfig, onClose, onSuccess, bedsList }) => {
    if (!modalConfig?.open) return null;
    return (
        <Modal visible={true} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>🛏️ Transfer Bed</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Text style={styles.closeBtnText}>×</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.modalBody}>
                        <Text>Bed transfer is handled via the Inpatient module. Please assign bed from IPD dashboard.</Text>
                    </View>
                    <View style={styles.modalFooter}>
                        <TouchableOpacity onPress={onClose} style={styles.footerCancelBtn}>
                            <Text style={styles.footerCancelText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', width: '100%', maxWidth: 500, borderRadius: 14, maxHeight: '80%', overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
    closeBtnText: { fontSize: 20, color: '#475569', fontWeight: 'bold' },
    modalBody: { padding: 20 },
    procedureBanner: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', padding: 14, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    procedureLabel: { fontSize: 11, fontWeight: '700', color: '#166534' },
    procedureName: { fontSize: 16, fontWeight: '800', color: '#14532d' },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 },
    statusBadgeText: { fontSize: 11, fontWeight: '800' },
    infoBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    infoLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 4 },
    infoValue: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
    infoSub: { fontSize: 13, color: '#475569', marginTop: 2 },
    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    footerCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
    footerCancelText: { fontSize: 14, fontWeight: '700', color: '#475569' },
    footerActionBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#7c3aed' },
    footerActionText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, marginBottom: 12, backgroundColor: '#f8fafc', color: '#0f172a' }
});
