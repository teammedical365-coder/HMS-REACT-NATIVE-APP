import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, Modal,
    StyleSheet, TextInput, Alert,
    KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { otAPI, admissionAPI } from '../../utils/api';
import DatePickerInput from '../common/DatePickerInput';
import TimePickerInput from '../common/TimePickerInput';
import DropdownSelect from '../common/DropdownSelect';
import { useOTResponsive } from '../../screens/ot/otResponsive';

export const getStatusStyle = (status) => {
    switch(status) {
        case 'PLANNED':
            return { label: 'PLANNED', bg: '#fef3c7', color: '#b45309', border: '#fde68a', stepIndex: -1 };
        case 'SCHEDULED':
            return { label: 'SCHEDULED', bg: '#e0e7ff', color: '#3730a3', border: '#c7d2fe', stepIndex: 0 };
        case 'ADMITTED':
            return { label: 'ADMITTED', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', stepIndex: 1 };
        case 'PRE_OP':
            return { label: 'PRE-OP', bg: '#fef3c7', color: '#b45309', border: '#fde68a', stepIndex: 2 };
        case 'READY_FOR_OT':
            return { label: 'READY FOR OT', bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff', stepIndex: 3 };
        case 'IN_OT':
            return { label: '🔴 IN OT', bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', stepIndex: 4, isPulse: true };
        case 'SURGERY_COMPLETED':
            return { label: 'SURGERY DONE', bg: '#ccfbf1', color: '#0f766e', border: '#99f6e4', stepIndex: 5 };
        case 'POST_OP':
            return { label: 'POST-OP', bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc', stepIndex: 6 };
        case 'COMPLETED':
            return { label: '✓ COMPLETED', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0', stepIndex: 6 };
        case 'CANCELLED':
            return { label: 'CANCELLED', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1', stepIndex: -1 };
        default:
            return { label: status, bg: '#f1f5f9', color: '#475569', border: '#e2e8f0', stepIndex: 0 };
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

// --- Custom Select Component (Universal Dropdown) ---
const CustomSelect = (props) => <DropdownSelect {...props} />;

// ==========================================
// 1. SURGERY VIEW DETAILS MODAL
// ==========================================
export const SurgeryDetailsModal = ({ open, surgery, onClose, onOpenScheduleModal }) => {
    const responsive = useOTResponsive();
    const { height, isSmallPhone, isPhone, modalMaxWidth, modalMaxHeight, isLandscapePhone } = responsive;
    const isMobile = isPhone;

    if (!open || !surgery) return null;

    const s = surgery;
    const statusInfo = getStatusStyle(s.status);
    const sElapsed = s.status === 'IN_OT' ? getElapsedTime(s.actualStartTime) : null;
    const surgeonName = (s.surgeonId?.name || 'Surgeon').replace(/^Dr\.?\s*/i, '');
    const consultingDoctorName = s.doctorId?.name ? (s.doctorId?.name).replace(/^Dr\.?\s*/i, '') : null;
    const referringDoctorName = s.referringDoctorId?.name ? (s.referringDoctorId?.name).replace(/^Dr\.?\s*/i, '') : null;
    const assistants = s.assistantSurgeonIds || [];
    const cost = Number(s.surgeryCost) || 0;
    const paid = Number(s.paidAmount) || 0;
    const remaining = Math.max(0, cost - paid);

    const bodyPadding = isSmallPhone ? 12 : isPhone ? 16 : 22;

    return (
        <Modal visible={open} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={[styles.modalOverlay, { padding: isSmallPhone ? 8 : 16 }]}>
                <View style={[styles.modalContent, { maxWidth: Math.min(modalMaxWidth, 600), maxHeight: modalMaxHeight }]}>
                    <View style={[styles.modalHeader, { paddingVertical: isSmallPhone ? 12 : 16, paddingHorizontal: bodyPadding }]}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <Text style={[styles.modalTitle, isSmallPhone && { fontSize: 16 }]}>📋 Surgery Details</Text>
                                {Boolean(s.planId) && (
                                    <View style={styles.planBadge}>
                                        <Text style={styles.planBadgeText}>{s.planId}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.modalSubtitle} numberOfLines={2}>
                                {s.surgeryDate
                                    ? `Scheduled for ${new Date(s.surgeryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                    : `Planned Preferred Date: ${new Date(s.preferredDate || s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.btnCloseIcon}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            activeOpacity={0.7}
                        >
                            <Feather name="x" size={18} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={{ padding: bodyPadding, maxHeight: isLandscapePhone ? height * 0.62 : height * 0.72 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Procedure Banner */}
                        <View style={[styles.procedureBanner, { flexWrap: 'wrap', gap: 8 }]}>
                            <View style={{ flex: 1, minWidth: 160 }}>
                                <Text style={styles.procedureBannerLabel}>PROCEDURE</Text>
                                <Text style={styles.procedureBannerTitle}>{s.surgery}</Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg, borderColor: statusInfo.border }]}>
                                <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                            <View style={[styles.infoBox, { width: isMobile ? '100%' : '48%' }]}>
                                <Text style={styles.infoBoxLabel}>PATIENT</Text>
                                <Text style={styles.infoBoxBold}>{s.patientId?.name || 'Patient'}</Text>
                                <Text style={styles.infoBoxText}>MRN: {s.patientId?.mrn || s.patientId?.patientId || '-'}</Text>
                                {Boolean(s.patientId?.phone) && <Text style={styles.infoBoxText}>📞 {s.patientId.phone}</Text>}
                            </View>

                            <View style={[styles.infoBox, { width: isMobile ? '100%' : '48%' }]}>
                                <Text style={styles.infoBoxLabel}>OPERATING SURGEON (PRIMARY)</Text>
                                <Text style={styles.infoBoxBold}>Dr. {surgeonName}</Text>
                                {Boolean(referringDoctorName || consultingDoctorName) && (referringDoctorName !== surgeonName && consultingDoctorName !== surgeonName) && (
                                    <Text style={[styles.infoBoxText, { marginTop: 2 }]}>
                                        Ref: Dr. {referringDoctorName || consultingDoctorName}
                                    </Text>
                                )}
                                {Boolean(s.surgeonId?.specialization) && <Text style={styles.infoBoxText}>Spec: {s.surgeonId.specialization}</Text>}
                            </View>

                            {/* Surgical Assistants */}
                            <View style={[styles.infoBox, { width: '100%' }]}>
                                <Text style={styles.infoBoxLabel}>SURGICAL ASSISTANTS</Text>
                                {assistants.length > 0 ? (
                                    <View style={{ flexDirection: 'column', gap: 4 }}>
                                        {assistants.map((ast, idx) => {
                                            const astName = typeof ast === 'object' && ast.name ? ast.name.replace(/^Dr\.?\s*/i, '') : 'Doctor';
                                            const spec = typeof ast === 'object' && ast.specialization ? ` (${ast.specialization})` : '';
                                            return (
                                                <Text key={idx} style={{ color: '#0f172a', fontWeight: '600', fontSize: 13 }}>
                                                    • Dr. {astName}{spec}
                                                </Text>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <Text style={{ color: '#64748b', fontStyle: 'italic', fontSize: 13 }}>
                                        None assigned
                                    </Text>
                                )}
                            </View>

                            <View style={[styles.infoBox, { width: isMobile ? '100%' : '48%' }]}>
                                <Text style={styles.infoBoxLabel}>OT ROOM & TIMING</Text>
                                {s.otRoomId?.name ? (
                                    <View>
                                        <Text style={styles.infoBoxBold}>🚪 {s.otRoomId.name}</Text>
                                        <Text style={{ color: '#334155', fontWeight: '600', fontSize: 13, marginTop: 2 }}>
                                            ⏰ {s.startTime || '--:--'} {s.endTime ? `- ${s.endTime}` : ''}
                                        </Text>
                                    </View>
                                ) : (
                                    <Text style={{ color: '#b45309', fontWeight: '700', fontSize: 13 }}>⏳ OT scheduling pending</Text>
                                )}
                            </View>

                            <View style={[styles.infoBox, { width: isMobile ? '100%' : '48%' }]}>
                                <Text style={styles.infoBoxLabel}>CLINICAL CONTEXT</Text>
                                <Text style={{ color: '#0f172a', fontSize: 13 }}><Text style={{ fontWeight: 'bold' }}>Diagnosis:</Text> {s.diagnosis || 'N/A'}</Text>
                                <Text style={{ color: '#475569', fontSize: 13, marginTop: 2 }}>
                                    <Text style={{ fontWeight: 'bold' }}>Priority:</Text> {s.priority || 'Normal'} | <Text style={{ fontWeight: 'bold' }}>Admission Req:</Text> {s.admissionRequired ? 'Yes' : 'No'}
                                </Text>
                            </View>
                        </View>

                        {/* Financial & Billing Status */}
                        {cost > 0 && (
                            <View style={styles.billingBanner}>
                                <Text style={styles.billingBannerTitle}>
                                    💳 Financial & Billing Status (Collected by Reception)
                                </Text>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                                    <Text style={{ fontSize: 13, color: '#1e293b', flex: 1, minWidth: 180 }}>
                                        Fee: <Text style={{ fontWeight: 'bold' }}>₹{cost.toLocaleString('en-IN')}</Text> | Paid: <Text style={{ fontWeight: 'bold', color: '#16a34a' }}>₹{paid.toLocaleString('en-IN')}</Text> | Remaining: <Text style={{ fontWeight: 'bold', color: remaining > 0 ? '#dc2626' : '#16a34a' }}>₹{remaining.toLocaleString('en-IN')}</Text>
                                    </Text>
                                    <View style={[
                                        styles.paymentBadge,
                                        { backgroundColor: s.paymentStatus === 'PAID' ? '#dcfce7' : (s.paymentStatus === 'PARTIALLY PAID' ? '#fef3c7' : '#fee2e2'), borderColor: s.paymentStatus === 'PAID' ? '#86efac' : (s.paymentStatus === 'PARTIALLY PAID' ? '#fde68a' : '#fca5a5') }
                                    ]}>
                                        <Text style={[
                                            styles.paymentBadgeText,
                                            { color: s.paymentStatus === 'PAID' ? '#15803d' : (s.paymentStatus === 'PARTIALLY PAID' ? '#b45309' : '#b91c1c') }
                                        ]}>
                                            {s.paymentStatus || 'UNPAID'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Actual Timestamps if available */}
                        {Boolean(s.actualStartTime || s.actualEndTime) && (
                            <View style={styles.timestampBanner}>
                                <Text style={styles.timestampBannerTitle}>⏱️ Real-time Surgery Timestamps:</Text>
                                {Boolean(s.actualStartTime) && <Text style={styles.timestampBannerText}>• Started at: <Text style={{ fontWeight: 'bold' }}>{new Date(s.actualStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text> {sElapsed ? `(${sElapsed} elapsed)` : ''}</Text>}
                                {Boolean(s.actualEndTime) && <Text style={styles.timestampBannerText}>• Completed at: <Text style={{ fontWeight: 'bold' }}>{new Date(s.actualEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></Text>}
                            </View>
                        )}

                        {Boolean(s.notes) && (
                            <View style={{ marginBottom: 20 }}>
                                <Text style={styles.notesLabel}>Clinical / OT Notes:</Text>
                                <View style={styles.notesBox}>
                                    <Text style={styles.notesText}>{s.notes}</Text>
                                </View>
                            </View>
                        )}

                        <View style={[styles.modalFooter, isMobile && styles.modalFooterMobile]}>
                            <TouchableOpacity onPress={onClose} style={[styles.btnSecondary, isMobile && styles.btnMobile]} activeOpacity={0.7}>
                                <Text style={styles.btnSecondaryText}>Close</Text>
                            </TouchableOpacity>
                            {s.status === 'PLANNED' && onOpenScheduleModal && (
                                <TouchableOpacity
                                    onPress={() => {
                                        onClose();
                                        onOpenScheduleModal(s);
                                    }}
                                    style={[styles.btnPrimary, isMobile && styles.btnMobile]}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.btnPrimaryText}>📅 Schedule Surgery Now</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

// ==========================================
// 2. SCHEDULE SURGERY MODAL
// ==========================================
export const ScheduleSurgeryModal = ({
    open,
    activePlan,
    onClose,
    doctorsList = [],
    otRoomsList = [],
    onSuccess
}) => {
    const responsive = useOTResponsive();
    const { height, isSmallPhone, isPhone, modalMaxWidth, modalMaxHeight, isLandscapePhone } = responsive;
    const isMobile = isPhone;

    const [selectedAssistantToAdd, setSelectedAssistantToAdd] = useState('');
    const [scheduling, setScheduling] = useState(false);
    const [scheduleError, setScheduleError] = useState('');

    const [form, setForm] = useState({
        otRoomId: '',
        surgeryDate: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        endTime: '12:00',
        surgeonId: '',
        assistantSurgeonIds: [],
        surgeryCost: '',
        priority: 'Normal',
        notes: ''
    });

    useEffect(() => {
        if (open && activePlan) {
            const initialSurgeonId = activePlan.surgeonId
                ? (typeof activePlan.surgeonId === 'object' ? (activePlan.surgeonId._id || '') : activePlan.surgeonId)
                : (activePlan.doctorId ? (typeof activePlan.doctorId === 'object' ? (activePlan.doctorId._id || '') : activePlan.doctorId) : '');

            const initialAssistants = Array.isArray(activePlan.assistantSurgeonIds)
                ? activePlan.assistantSurgeonIds.map(as => typeof as === 'object' ? as._id : as).filter(Boolean)
                : [];

            setForm({
                otRoomId: activePlan.otRoomId ? (typeof activePlan.otRoomId === 'object' ? activePlan.otRoomId._id : activePlan.otRoomId) : '',
                surgeryDate: activePlan.preferredDate ? new Date(activePlan.preferredDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                startTime: '10:00',
                endTime: '12:00',
                surgeonId: initialSurgeonId,
                assistantSurgeonIds: initialAssistants,
                surgeryCost: activePlan.surgeryCost ? String(activePlan.surgeryCost) : '',
                priority: activePlan.priority || 'Normal',
                notes: activePlan.notes || ''
            });
            setSelectedAssistantToAdd('');
            setScheduleError('');
            setScheduling(false);
        }
    }, [open, activePlan]);

    if (!open || !activePlan) return null;

    const handleAddAssistant = () => {
        if (!selectedAssistantToAdd) return;
        if (selectedAssistantToAdd === form.surgeonId) {
            setScheduleError('The Operating Surgeon cannot also be added as an Assistant.');
            return;
        }
        if (form.assistantSurgeonIds.includes(selectedAssistantToAdd)) {
            setScheduleError('This assistant doctor is already added.');
            return;
        }
        setScheduleError('');
        setForm(prev => ({
            ...prev,
            assistantSurgeonIds: [...prev.assistantSurgeonIds, selectedAssistantToAdd]
        }));
        setSelectedAssistantToAdd('');
    };

    const handleRemoveAssistant = (docId) => {
        setForm(prev => ({
            ...prev,
            assistantSurgeonIds: prev.assistantSurgeonIds.filter(id => id !== docId)
        }));
    };

    const handleSubmit = async () => {
        if (!form.otRoomId || !form.surgeryDate || !form.startTime || !form.endTime || !form.surgeonId) {
            setScheduleError('Please fill all required fields (OT Room, Date, Time, Operating Surgeon)');
            return;
        }
        if (form.startTime >= form.endTime) {
            setScheduleError('End time must be after start time');
            return;
        }
        setScheduling(true);
        setScheduleError('');
        try {
            const res = await otAPI.scheduleSurgery(activePlan._id, form);
            if (res.success) {
                Alert.alert('Success', 'Surgery scheduled successfully');
                onClose();
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            console.error('Scheduling error:', err);
            setScheduleError(err.response?.data?.message || 'Failed to schedule surgery');
        } finally {
            setScheduling(false);
        }
    };

    const bodyPadding = isSmallPhone ? 12 : isPhone ? 16 : 22;

    return (
        <Modal visible={open} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={[styles.modalOverlay, { padding: isSmallPhone ? 8 : 16 }]}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ width: '100%', alignItems: 'center' }}
                >
                    <View style={[styles.modalContent, { maxWidth: Math.min(modalMaxWidth, 560), maxHeight: modalMaxHeight }]}>
                        <View style={[styles.modalHeader, { paddingVertical: isSmallPhone ? 12 : 16, paddingHorizontal: bodyPadding }]}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={[styles.modalTitle, isSmallPhone && { fontSize: 16 }]}>📅 Schedule OT Surgery</Text>
                                <Text style={styles.modalSubtitle} numberOfLines={1}>Plan: {activePlan.planId || activePlan._id}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={onClose}
                                style={styles.btnCloseIcon}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                activeOpacity={0.7}
                            >
                                <Feather name="x" size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={{ padding: bodyPadding }}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {scheduleError !== '' && (
                                <View style={styles.errorBox}>
                                    <Text style={styles.errorText}>⚠️ {scheduleError}</Text>
                                </View>
                            )}

                            {/* Auto-carried Summary */}
                            <View style={styles.autoSummaryBox}>
                                <Text style={styles.autoSummaryLabel}>PROCEDURE & PATIENT (AUTO-CARRIED)</Text>
                                <Text style={styles.autoSummaryTitle}>{activePlan.surgery}</Text>
                                <Text style={styles.autoSummaryText}>
                                    👤 <Text style={{ fontWeight: 'bold' }}>{activePlan.patientId?.name || 'Patient'}</Text> [MRN: {activePlan.patientId?.mrn || activePlan.patientId?.patientId || '-'}]
                                </Text>
                                {Boolean(activePlan.diagnosis) && (
                                    <Text style={styles.autoSummarySubtext}>Diagnosis: {activePlan.diagnosis}</Text>
                                )}
                            </View>

                            {/* Operating Surgeon */}
                            <View style={[styles.formGroup, { zIndex: 100 }]}>
                                <Text style={styles.formLabel}>Operating Surgeon (Primary) *</Text>
                                <CustomSelect
                                    options={doctorsList.map(doc => ({
                                        label: `👨‍⚕️ Dr. ${(doc.name || `${doc.firstName || ''} ${doc.lastName || ''}` || 'Doctor').replace(/^Dr\.?\s*/i, '')} ${doc.specialization ? `(${doc.specialization})` : ''}`,
                                        value: doc._id
                                    }))}
                                    value={form.surgeonId}
                                    onChange={(val) => {
                                        setForm(prev => ({
                                            ...prev,
                                            surgeonId: val,
                                            assistantSurgeonIds: prev.assistantSurgeonIds.filter(id => id !== val)
                                        }));
                                    }}
                                    placeholder="-- Select Primary Operating Surgeon --"
                                />
                            </View>

                            {/* Surgical Assistants */}
                            <View style={styles.assistantsBox}>
                                <Text style={styles.formLabel}>Surgical Assistants</Text>
                                <Text style={styles.assistantsSublabel}>Add assistant doctors supporting the primary surgeon in OT</Text>

                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, zIndex: 90 }}>
                                    <View style={{ flex: 1 }}>
                                        <CustomSelect
                                            options={doctorsList
                                                .filter(doc => doc._id !== form.surgeonId && !form.assistantSurgeonIds.includes(doc._id))
                                                .map(doc => ({
                                                    label: `👨‍⚕️ Dr. ${(doc.name || `${doc.firstName || ''} ${doc.lastName || ''}` || 'Doctor').replace(/^Dr\.?\s*/i, '')} ${doc.specialization ? `(${doc.specialization})` : ''}`,
                                                    value: doc._id
                                                }))}
                                            value={selectedAssistantToAdd}
                                            onChange={setSelectedAssistantToAdd}
                                            placeholder="-- Select Assistant --"
                                        />
                                    </View>
                                    <TouchableOpacity
                                        onPress={handleAddAssistant}
                                        disabled={!selectedAssistantToAdd}
                                        style={[styles.btnAddAssistant, !selectedAssistantToAdd && { backgroundColor: '#94a3b8' }]}
                                        activeOpacity={0.7}
                                    >
                                        <Feather name="plus" color="#fff" size={14} />
                                        <Text style={styles.btnAddAssistantText}>Add</Text>
                                    </TouchableOpacity>
                                </View>

                                {form.assistantSurgeonIds.length > 0 ? (
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                                        {form.assistantSurgeonIds.map(docId => {
                                            const docObj = doctorsList.find(d => d._id === docId);
                                            const docName = docObj ? (docObj.name || `${docObj.firstName || ''} ${docObj.lastName || ''}`).replace(/^Dr\.?\s*/i, '') : 'Doctor';
                                            return (
                                                <View key={docId} style={styles.assistantPill}>
                                                    <Text style={styles.assistantPillText}>👨‍⚕️ Dr. {docName}</Text>
                                                    <TouchableOpacity
                                                        onPress={() => handleRemoveAssistant(docId)}
                                                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                                    >
                                                        <Feather name="x" size={14} color="#ef4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <Text style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>None assigned yet</Text>
                                )}
                            </View>

                            {/* OT Room */}
                            <View style={[styles.formGroup, { zIndex: 80 }]}>
                                <Text style={styles.formLabel}>Assign OT Room *</Text>
                                <CustomSelect
                                    options={otRoomsList
                                        .filter(r => r.status !== 'Maintenance' && r.status !== 'MAINTENANCE')
                                        .map(r => ({
                                            label: `🚪 ${r.name} (${r.status})`,
                                            value: r._id
                                        }))}
                                    value={form.otRoomId}
                                    onChange={(val) => setForm(prev => ({ ...prev, otRoomId: val }))}
                                    placeholder="-- Select OT Room --"
                                />
                            </View>

                            {/* Surgery Date */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Surgery Date *</Text>
                                <DatePickerInput
                                    value={form.surgeryDate}
                                    onChange={d => setForm(prev => ({ ...prev, surgeryDate: d }))}
                                    placeholder="Select Surgery Date"
                                />
                            </View>

                            {/* Start Time & End Time */}
                            <View style={{ flexDirection: isSmallPhone ? 'column' : 'row', gap: 14, marginBottom: 16 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.formLabel}>Start Time *</Text>
                                    <TimePickerInput
                                        value={form.startTime}
                                        onChange={t => setForm(prev => ({ ...prev, startTime: t }))}
                                        placeholder="HH:MM"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.formLabel}>End Time *</Text>
                                    <TimePickerInput
                                        value={form.endTime}
                                        onChange={t => setForm(prev => ({ ...prev, endTime: t }))}
                                        placeholder="HH:MM"
                                    />
                                </View>
                            </View>

                            {/* Priority & Surgery Cost */}
                            <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 14, marginBottom: 16, zIndex: 70 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.formLabel}>Priority</Text>
                                    <CustomSelect
                                        options={[
                                            { label: 'Normal', value: 'Normal' },
                                            { label: 'High Priority', value: 'High' },
                                            { label: '🚨 Emergency', value: 'Emergency' }
                                        ]}
                                        value={form.priority}
                                        onChange={(val) => setForm(prev => ({ ...prev, priority: val }))}
                                        placeholder="Normal"
                                    />
                                </View>
                                <View style={{ flex: 1, marginTop: isMobile ? 8 : 0 }}>
                                    <Text style={styles.formLabel}>Surgery Charges (₹)</Text>
                                    <TextInput
                                        style={styles.inputField}
                                        value={form.surgeryCost}
                                        onChangeText={t => setForm(prev => ({ ...prev, surgeryCost: t }))}
                                        placeholder="e.g. 30000"
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            {/* Billing notice */}
                            <View style={styles.billingNoticeBox}>
                                <Feather name="dollar-sign" size={16} color="#92400e" style={{ marginTop: 2 }} />
                                <Text style={styles.billingNoticeText}>
                                    <Text style={{ fontWeight: 'bold' }}>Billing Notice:</Text> Scheduling generates an <Text style={{ fontWeight: 'bold' }}>UNPAID</Text> surgery charge for Reception/Billing to collect. Payment is not collected in OT.
                                </Text>
                            </View>

                            {/* Notes */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Clinical / OT Notes</Text>
                                <TextInput
                                    style={[styles.inputField, { height: 64, textAlignVertical: 'top' }]}
                                    value={form.notes}
                                    onChangeText={t => setForm(prev => ({ ...prev, notes: t }))}
                                    placeholder="Special OT instructions..."
                                    multiline
                                    numberOfLines={2}
                                />
                            </View>

                            <View style={[styles.modalFooter, isMobile && styles.modalFooterMobile]}>
                                <TouchableOpacity onPress={onClose} style={[styles.btnSecondary, isMobile && styles.btnMobile]} activeOpacity={0.7}>
                                    <Text style={styles.btnSecondaryText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleSubmit}
                                    disabled={scheduling}
                                    style={[styles.btnPrimary, isMobile && styles.btnMobile]}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.btnPrimaryText}>{scheduling ? 'Scheduling...' : '✓ Confirm & Schedule Surgery'}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

// ==========================================
// 3. WORKFLOW BED MODAL (ADMIT / TRANSFER)
// ==========================================
export const WorkflowBedModal = ({ open, actionType, patientId, surgeryId, onClose, onSuccess }) => {
    const responsive = useOTResponsive();
    const { isSmallPhone, isPhone, modalMaxWidth, modalMaxHeight } = responsive;
    const isMobile = isPhone;

    const [beds, setBeds] = useState([]);
    const [selectedBedId, setSelectedBedId] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) {
            setSubmitting(false);
            setSelectedBedId('');
        }
    }, [open]);

    useEffect(() => {
        if (open) {
            const fetchBeds = async () => {
                try {
                    const { bedAPI } = await import('../../utils/api');
                    const res = await bedAPI.getBeds({ status: 'AVAILABLE' });
                    if (res.success) setBeds(res.beds || []);
                } catch (err) {
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            };
            fetchBeds();
        }
    }, [open]);

    if (!open) return null;

    const handleSubmit = async () => {
        if (submitting) return;
        if (!selectedBedId) return Alert.alert('Error', 'Please select a bed');
        setSubmitting(true);
        try {
            const targetBed = beds.find(b => b._id === selectedBedId);
            if (actionType === 'ADMIT') {
                await admissionAPI.createAdmission({
                    patientId,
                    bedId: selectedBedId,
                    ward: targetBed?.ward,
                    admissionDate: new Date().toISOString().split('T')[0],
                    admissionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                    notes: 'Pre-Op Admission for Surgery'
                });
                await otAPI.updateSurgeryWorkflow(surgeryId, { status: 'ADMITTED' });
                Alert.alert('Success', 'Patient admitted for surgery');
            } else if (actionType === 'TRANSFER') {
                const actAdmRes = await admissionAPI.getPatientAdmissions(patientId);
                const activeAdm = actAdmRes.admissions?.find(a => a.status === 'Admitted');
                if (activeAdm) {
                    await admissionAPI.transferBed(activeAdm._id, {
                        newWard: targetBed?.ward,
                        newBedId: selectedBedId,
                        transferDate: new Date().toISOString().split('T')[0],
                        transferTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
                        notes: 'Post-Op Ward Transfer'
                    });
                    await otAPI.updateSurgeryWorkflow(surgeryId, { status: 'POST_OP' });
                    Alert.alert('Success', 'Patient transferred to Post-Op');
                } else {
                    Alert.alert('Error', 'No active admission found for this patient to transfer');
                    return;
                }
            }
            onClose();
            if (onSuccess) onSuccess();
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Action failed');
        } finally {
            setSubmitting(false);
        }
    };

    const bodyPadding = isSmallPhone ? 14 : isPhone ? 18 : 24;

    return (
        <Modal visible={open} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={[styles.modalOverlay, { padding: isSmallPhone ? 8 : 16 }]}>
                <View style={[styles.modalContent, { maxWidth: Math.min(modalMaxWidth, 460), maxHeight: modalMaxHeight }]}>
                    <View style={[styles.modalHeader, { paddingVertical: isSmallPhone ? 12 : 16, paddingHorizontal: bodyPadding }]}>
                        <Text style={[styles.modalTitle, isSmallPhone && { fontSize: 16 }]}>
                            {actionType === 'ADMIT' ? '🏥 Admit Patient' : '🔄 Transfer Bed'}
                        </Text>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.btnCloseIcon}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            activeOpacity={0.7}
                        >
                            <Feather name="x" size={18} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <View style={{ padding: bodyPadding, zIndex: 10 }}>
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Select Available Bed *</Text>
                            <CustomSelect
                                options={beds.map(b => ({
                                    label: `${b.ward} - Bed ${b.bedNumber} (${b.bedType})`,
                                    value: b._id
                                }))}
                                value={selectedBedId}
                                onChange={setSelectedBedId}
                                placeholder="-- Choose Bed --"
                            />

                            {selectedBedId ? (() => {
                                const targetBed = beds.find(b => b._id === selectedBedId);
                                const isIcu = (targetBed?.ward || '').toLowerCase().includes('icu');
                                const rate = targetBed?.pricePerDay || (isIcu ? 20000 : 5000);
                                const hourly = Math.round((rate / 24) * 100) / 100;
                                return (
                                    <View style={styles.rateBox}>
                                        <Text style={styles.rateBoxLabel}>Ward Rate:</Text>
                                        <Text style={styles.rateBoxValue}>₹{rate.toLocaleString('en-IN')}/day (₹{hourly}/hr)</Text>
                                    </View>
                                );
                            })() : null}
                        </View>

                        <View style={[styles.modalFooter, { marginTop: 24, paddingTop: 0, borderTopWidth: 0 }, isMobile && styles.modalFooterMobile]}>
                            <TouchableOpacity onPress={onClose} disabled={submitting} style={[styles.btnSecondary, isMobile && styles.btnMobile]} activeOpacity={0.7}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={[styles.btnPrimary, isMobile && styles.btnMobile]} activeOpacity={0.7}>
                                {submitting ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        <ActivityIndicator size="small" color="#fff" />
                                        <Text style={styles.btnPrimaryText}>Processing...</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.btnPrimaryText}>Confirm</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// --- Shared Styles ---
const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContent: {
        backgroundColor: '#fff',
        width: '100%',
        borderRadius: 14,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 25 },
        shadowOpacity: 0.25,
        shadowRadius: 50,
        maxHeight: '92%',
        overflow: 'hidden',
    },
    modalHeader: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
    },
    modalTitle: {
        fontSize: 18,
        color: '#0f172a',
        fontWeight: '800',
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    planBadge: {
        backgroundColor: '#e0e7ff',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    planBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#3730a3',
    },
    btnCloseIcon: {
        backgroundColor: '#f1f5f9',
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    procedureBanner: {
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
        borderWidth: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 10,
        marginBottom: 18,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    procedureBannerLabel: {
        fontSize: 11,
        color: '#166534',
        fontWeight: '700',
    },
    procedureBannerTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#14532d',
    },
    statusBadge: {
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: 1,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '800',
    },
    infoBox: {
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 8,
        borderColor: '#e2e8f0',
        borderWidth: 1,
    },
    infoBoxLabel: {
        color: '#64748b',
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 2,
    },
    infoBoxBold: {
        fontWeight: '700',
        color: '#0f172a',
        fontSize: 14,
    },
    infoBoxText: {
        color: '#475569',
        fontSize: 12,
    },
    billingBanner: {
        backgroundColor: '#f1f5f9',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        marginBottom: 16,
    },
    billingBannerTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 6,
    },
    paymentBadge: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    paymentBadgeText: {
        fontSize: 11,
        fontWeight: '800',
    },
    timestampBanner: {
        backgroundColor: '#fdf2f8',
        borderColor: '#fbcfe8',
        borderWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 8,
        marginBottom: 16,
    },
    timestampBannerTitle: {
        fontWeight: '700',
        color: '#9d174d',
        marginBottom: 4,
        fontSize: 13,
    },
    timestampBannerText: {
        fontSize: 13,
        color: '#831843',
    },
    notesLabel: {
        color: '#475569',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    notesBox: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderColor: '#e2e8f0',
        borderWidth: 1,
    },
    notesText: {
        fontSize: 13,
        color: '#334155',
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    modalFooterMobile: {
        flexDirection: 'column-reverse',
        alignItems: 'stretch',
        gap: 10,
    },
    btnMobile: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    btnSecondary: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        minHeight: 44,
        justifyContent: 'center',
        backgroundColor: '#f1f5f9',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        borderRadius: 8,
    },
    btnSecondaryText: {
        fontWeight: '600',
        color: '#475569',
        fontSize: 14,
    },
    btnPrimary: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        minHeight: 44,
        justifyContent: 'center',
        backgroundColor: '#7c3aed',
        borderRadius: 8,
    },
    btnPrimaryText: {
        fontWeight: '700',
        color: '#fff',
        fontSize: 14,
    },
    errorBox: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: '#fee2e2',
        borderColor: '#fca5a5',
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 16,
    },
    errorText: {
        color: '#b91c1c',
        fontSize: 13,
        fontWeight: '600',
    },
    autoSummaryBox: {
        backgroundColor: '#eff6ff',
        borderColor: '#bfdbfe',
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    autoSummaryLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1d4ed8',
        marginBottom: 2,
    },
    autoSummaryTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e3a8a',
    },
    autoSummaryText: {
        fontSize: 13,
        color: '#334155',
        marginTop: 3,
    },
    autoSummarySubtext: {
        fontSize: 12,
        color: '#475569',
        marginTop: 2,
    },
    formGroup: {
        marginBottom: 16,
    },
    formLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    inputField: {
        width: '100%',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderColor: '#cbd5e1',
        borderWidth: 1.5,
        backgroundColor: '#fff',
        color: '#0f172a',
        fontSize: 14,
        minHeight: 44,
    },
    assistantsBox: {
        backgroundColor: '#f8fafc',
        padding: 14,
        borderRadius: 10,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        marginBottom: 16,
    },
    assistantsSublabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 10,
    },
    btnAddAssistant: {
        paddingVertical: 9,
        paddingHorizontal: 14,
        minHeight: 44,
        justifyContent: 'center',
        backgroundColor: '#2563eb',
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    btnAddAssistantText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    assistantPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#eff6ff',
        borderColor: '#bfdbfe',
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 20,
    },
    assistantPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1e40af',
    },
    billingNoticeBox: {
        backgroundColor: '#fef3c7',
        borderColor: '#fde68a',
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        marginBottom: 16,
    },
    billingNoticeText: {
        fontSize: 12,
        color: '#92400e',
        flex: 1,
    },
    rateBox: {
        marginTop: 10,
        backgroundColor: '#eff6ff',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderColor: '#bfdbfe',
        borderWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rateBoxLabel: {
        fontSize: 12,
        color: '#1e40af',
        fontWeight: '600',
    },
    rateBoxValue: {
        fontSize: 13,
        color: '#1d4ed8',
        fontWeight: '800',
    },
    dropdownMenu: {
        position: 'absolute',
        top: 45,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        borderRadius: 8,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    dropdownItem: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    dropdownItemActive: {
        backgroundColor: '#e0f2fe',
    },
    dropdownItemText: {
        fontSize: 14,
        color: '#334155',
    },
    dropdownItemTextActive: {
        color: '#0284c7',
        fontWeight: '600',
    }
});
