import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, Image, TextInput, 
    StyleSheet, ActivityIndicator, Alert, Modal, Dimensions
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { doctorAPI, receptionAPI, otAPI, adminEntitiesAPI, admissionAPI, bedAPI } from '../../utils/api';
import { Picker } from '@react-native-picker/picker';

const { width } = Dimensions.get('window');

const PatientProfile = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { patientId } = route.params || {};
    
    const [patient, setPatient] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [labReports, setLabReports] = useState([]);
    const [pharmacyOrders, setPharmacyOrders] = useState([]);
    const [surgeryPlans, setSurgeryPlans] = useState([]);
    const [currentFollowupStatus, setCurrentFollowupStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    const [surgeonsList, setSurgeonsList] = useState([]);
    const [otRoomsList, setOtRoomsList] = useState([]);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    
    const [showWorkflowModal, setShowWorkflowModal] = useState(false);
    const [workflowActionType, setWorkflowActionType] = useState(null); // 'ADMIT' or 'TRANSFER'
    const [activeSurgeryId, setActiveSurgeryId] = useState(null);
    const [workflowBeds, setWorkflowBeds] = useState([]);
    const [selectedBedId, setSelectedBedId] = useState('');

    const [scheduleData, setScheduleData] = useState({
        id: null,
        otRoomId: '',
        surgeryDate: '',
        startTime: '',
        endTime: '',
        surgeonId: ''
    });

    useEffect(() => {
        if (patientId) fetchProfile();
    }, [patientId]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const res = await doctorAPI.getFullPatientProfile(patientId);
            if (res.success) {
                setPatient(res.patient);
                setAppointments(res.appointments || []);
                setLabReports(res.labReports || []);
                setPharmacyOrders(res.pharmacyOrders || []);
            } else {
                setError(res.message || 'Failed to load profile');
            }

            try {
                const spRes = await otAPI.getPatientSurgeryPlans(patientId);
                if (spRes.success) {
                    setSurgeryPlans(spRes.data || []);
                }
            } catch (err) {
                console.warn("Could not fetch surgery plans:", err?.message);
            }

            try {
                const resAuto = await receptionAPI.getFollowupStatus(patientId, 'auto');
                if (resAuto.success) {
                    setCurrentFollowupStatus(resAuto);
                }
            } catch (err) {
                console.warn("Could not fetch followup status:", err?.message);
            }

        } catch (err) {
            setError(err.response?.data?.message || err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchExtras = async () => {
            try {
                const sRes = await adminEntitiesAPI.getDoctors();
                if (sRes.success) setSurgeonsList(sRes.data || []);
            } catch (e) {}
            try {
                const rRes = await otAPI.getRooms();
                if (rRes.success) setOtRoomsList(rRes.rooms.filter(r => r.status !== 'Maintenance' && r.status !== 'MAINTENANCE') || []);
            } catch (e) {}
        };
        fetchExtras();
    }, []);

    const handleOpenScheduleModal = (sp) => {
        setScheduleData({
            id: sp._id,
            otRoomId: sp.otRoomId?._id || sp.otRoomId || '',
            surgeryDate: sp.surgeryDate ? String(sp.surgeryDate).split('T')[0] : sp.preferredDate ? String(sp.preferredDate).split('T')[0] : '',
            startTime: sp.startTime || sp.preferredTime || '',
            endTime: sp.endTime || '',
            surgeonId: sp.surgeonId?._id || sp.surgeonId || ''
        });
        setShowScheduleModal(true);
    };

    const handleScheduleSubmit = async () => {
        try {
            const isEdit = surgeryPlans.find(s => s._id === scheduleData.id)?.status === 'SCHEDULED';
            const apiCall = isEdit ? otAPI.updateScheduledSurgery : otAPI.scheduleSurgery;
            const res = await apiCall(scheduleData.id, scheduleData);
            if (res.success) {
                Alert.alert('Success', res.message || 'Surgery scheduled successfully');
                setShowScheduleModal(false);
                fetchProfile();
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Error scheduling surgery');
        }
    };

    const handleWorkflowTransition = async (id, status) => {
        try {
            const res = await otAPI.updateSurgeryWorkflow(id, { status });
            if (res.success) {
                Alert.alert('Success', res.message || `Status updated to ${status}`);
                fetchProfile();
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Error updating workflow');
        }
    };

    const handleOpenWorkflowModal = async (id, type) => {
        setActiveSurgeryId(id);
        setWorkflowActionType(type);
        try {
            const res = await bedAPI.getBeds({ status: 'AVAILABLE' });
            if (res.success) setWorkflowBeds(res.beds || []);
            setShowWorkflowModal(true);
        } catch (err) {
            Alert.alert('Error', 'Failed to fetch available beds');
        }
    };

    const handleWorkflowModalSubmit = async () => {
        if (!selectedBedId) {
            Alert.alert('Validation Error', 'Please select a bed');
            return;
        }
        try {
            if (workflowActionType === 'ADMIT') {
                const targetBed = workflowBeds.find(b => b._id === selectedBedId);
                const admRes = await admissionAPI.createAdmission({
                    patientId,
                    ward: targetBed?.ward,
                    bedId: selectedBedId,
                    admissionDate: new Date().toISOString().split('T')[0],
                    admissionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                });
                if (admRes.success) {
                    await otAPI.updateSurgeryWorkflow(activeSurgeryId, { status: 'ADMITTED' });
                    Alert.alert('Success', 'Patient admitted successfully');
                }
            } else if (workflowActionType === 'TRANSFER') {
                const actAdmRes = await admissionAPI.getPatientAdmissions(patientId);
                const activeAdm = actAdmRes.admissions?.find(a => a.status === 'Admitted');
                if (activeAdm) {
                    const targetBed = workflowBeds.find(b => b._id === selectedBedId);
                    const transRes = await admissionAPI.transferBed(activeAdm._id, {
                        newWard: targetBed?.ward,
                        newBedId: selectedBedId,
                        transferDate: new Date().toISOString().split('T')[0],
                        transferTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                    });
                    if (transRes.success) {
                        await otAPI.updateSurgeryWorkflow(activeSurgeryId, { status: 'POST_OP' });
                        Alert.alert('Success', 'Patient transferred successfully');
                    }
                } else {
                    Alert.alert('Notice', 'No active admission found to transfer');
                }
            }
            setShowWorkflowModal(false);
            setSelectedBedId('');
            fetchProfile();
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Error processing request');
        }
    };

    const handleCancelSurgery = (id) => {
        Alert.alert(
            "Confirm Cancellation",
            "Are you sure you want to cancel this scheduled surgery?",
            [
                { text: "No", style: "cancel" },
                { 
                    text: "Yes, Cancel", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const res = await otAPI.cancelSurgery(id);
                            if (res.success) {
                                Alert.alert('Success', res.message || 'Surgery cancelled');
                                fetchProfile();
                            }
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.message || 'Error cancelling surgery');
                        }
                    }
                }
            ]
        );
    };

    const fp = patient?.fertilityProfile || {};
    const vitals = fp.vitals || {};

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const age = patient?.dob ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

    if (loading) {
        return (
            <View style={styles.page}>
                <View style={styles.loadWrap}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={{ marginTop: 14, color: '#94a3b8' }}>Loading patient profile...</Text>
                </View>
            </View>
        );
    }

    if (error || !patient) {
        return (
            <View style={styles.page}>
                <View style={styles.topbar}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.backBtnText}>← Back</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 }}>
                    <Text style={{ fontSize: 48, marginBottom: 12 }}>⚠️</Text>
                    <Text style={{ color: '#f8fafc', fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>Patient Not Found</Text>
                    <Text style={{ color: '#64748b' }}>{error || 'Unable to load patient data.'}</Text>
                </View>
            </View>
        );
    }

    const tabs = [
        { key: 'overview', label: '📋 Overview' },
        { key: 'surgery', label: `🔪 Surgery Plans (${surgeryPlans.length})` },
        { key: 'vitals', label: '💓 Vitals' },
        { key: 'medical', label: '🏥 Medical History' },
        { key: 'visits', label: '📅 All Visits' },
        { key: 'labs', label: '🧪 Lab Reports' },
        { key: 'prescriptions', label: '💊 Prescriptions' },
        { key: 'clinical', label: '🩺 Clinical Profile' },
    ];

    const renderField = (label, value) => (
        <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <Text style={styles.fieldValue}>{value || '—'}</Text>
        </View>
    );

    const getStatusStyle = (s) => {
        const m = { 
            confirmed: { b: '#dcfce7', c: '#166534' }, 
            completed: { b: '#dbeafe', c: '#1e40af' }, 
            cancelled: { b: '#fee2e2', c: '#991b1b' }, 
            pending: { b: '#fef3c7', c: '#92400e' }, 
            PENDING: { b: '#fef3c7', c: '#92400e' }, 
            DONE: { b: '#dcfce7', c: '#166534' }, 
            IN_PROGRESS: { b: '#dbeafe', c: '#1e40af' }, 
            UPLOADED: { b: '#dcfce7', c: '#166534' }, 
            PAID: { b: '#dcfce7', c: '#166534' },
            PLANNED: { b: '#fef3c7', c: '#92400e' },
            SCHEDULED: { b: '#e0e7ff', c: '#3730a3' },
            ADMITTED: { b: '#eff6ff', c: '#1d4ed8' },
            PRE_OP: { b: '#fef3c7', c: '#b45309' },
            READY_FOR_OT: { b: '#f3e8ff', c: '#6b21a8' },
            IN_OT: { b: '#fee2e2', c: '#b91c1c' },
            SURGERY_COMPLETED: { b: '#ccfbf1', c: '#0f766e' },
            POST_OP: { b: '#ecfeff', c: '#0e7490' },
            COMPLETED: { b: '#dcfce7', c: '#15803d' },
            CANCELLED: { b: '#f1f5f9', c: '#64748b' }
        };
        return m[s] || { b: '#f1f5f9', c: '#475569' };
    };

    const renderOverview = () => {
        let isFollowupActive = currentFollowupStatus?.active;
        let isNewPatient = currentFollowupStatus?.message === 'New Patient / First Visit' && appointments.length === 0;

        return (
            <View>
                {/* Quick Stats */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                    {[
                        { label: 'Total Visits', value: appointments.length, icon: '📅', g: ['#3b82f6', '#6366f1'] },
                        { label: 'Completed', value: appointments.filter(a => a.status === 'completed').length, icon: '✅', g: ['#10b981', '#059669'] },
                        { label: 'Lab Tests', value: labReports.length, icon: '🧪', g: ['#f59e0b', '#d97706'] },
                        { label: 'Prescriptions', value: pharmacyOrders.length, icon: '💊', g: ['#ef4444', '#dc2626'] },
                    ].map((s, i) => (
                        <View key={i} style={[styles.card, { flexDirection: 'row', alignItems: 'center', padding: 18, marginRight: 14, minWidth: 160 }]}>
                            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: s.g[0], alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                                <Text style={{ fontSize: 20 }}>{s.icon}</Text>
                            </View>
                            <View>
                                <Text style={{ color: '#f8fafc', fontSize: 24, fontWeight: '900' }}>{s.value}</Text>
                                <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600' }}>{s.label}</Text>
                            </View>
                        </View>
                    ))}
                    
                    {/* Follow-up Card */}
                    <View style={{
                        backgroundColor: isFollowupActive ? '#f0fdf4' : '#fef2f2',
                        borderLeftWidth: 4,
                        borderLeftColor: isFollowupActive ? '#22c55e' : '#ef4444',
                        borderColor: isFollowupActive ? '#bbf7d0' : '#fecaca',
                        borderWidth: 1,
                        padding: 16,
                        borderRadius: 16,
                        justifyContent: 'center',
                        marginRight: 14,
                        minWidth: 160
                    }}>
                        <Text style={{ color: isFollowupActive ? '#166534' : '#991b1b', fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold' }}>Follow-up</Text>
                        <Text style={{ color: isFollowupActive ? '#15803d' : '#b91c1c', fontSize: 18, fontWeight: '900', marginTop: 4 }}>
                            {isFollowupActive ? 'Active' : (isNewPatient ? 'New Patient' : 'Expired')}
                        </Text>
                        {currentFollowupStatus && !isNewPatient && (
                            <Text style={{ fontSize: 12, color: isFollowupActive ? '#166534' : '#7f1d1d', marginTop: 4, fontWeight: '500' }}>
                                {isFollowupActive 
                                    ? `Valid: ${Math.max(0, Math.ceil((new Date(currentFollowupStatus.validUntil).getTime() - new Date().getTime()) / (1000 * 3600 * 24)))} Days`
                                    : (() => {
                                        const lastVisit = appointments.length > 0 ? appointments[0] : null;
                                        const lastDate = currentFollowupStatus.lastConsultation || (lastVisit ? lastVisit.appointmentDate : null);
                                        return lastDate ? `Last: ${new Date(lastDate).toLocaleDateString('en-IN')}` : 'Fee Applicable';
                                    })()
                                }
                            </Text>
                        )}
                    </View>
                </ScrollView>

                {/* Demographics */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>👤 Demographics</Text>
                    <View style={styles.grid4}>
                        {renderField('Full Name', patient.name)}
                        {renderField('Phone', patient.phone)}
                        {renderField('Email', patient.email)}
                        {renderField('MRN', patient.patientId)}
                        {renderField('Date of Birth', formatDate(patient.dob))}
                        {renderField('Age', age ? `${age} years` : null)}
                        {renderField('Gender', patient.gender)}
                        {renderField('Blood Group', patient.bloodGroup)}
                        {renderField('Address', patient.address)}
                        {renderField('City', patient.city)}
                        {renderField('Aadhaar', patient.aadhaarNumber ? `****${patient.aadhaarNumber.slice(-4)}` : null)}
                        {renderField('Verified', patient.isAadhaarVerified ? '✅ Yes' : '❌ No')}
                    </View>
                </View>

                {/* Recent Visits Timeline */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🕐 Recent Visits</Text>
                    {appointments.length === 0 ? (
                        <Text style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>No visits recorded yet.</Text>
                    ) : (
                        appointments.slice(0, 5).map((apt, i) => {
                            const badge = getStatusStyle(apt.status);
                            return (
                                <View key={apt._id} style={styles.timelineCard}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <Text style={{ color: '#3b82f6', fontWeight: '900', fontSize: 13 }}>#{i + 1}</Text>
                                            <Text style={{ color: '#f8fafc', fontWeight: 'bold' }}>{formatDate(apt.appointmentDate)}</Text>
                                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>at {apt.appointmentTime}</Text>
                                        </View>
                                        <View style={[styles.badge, { backgroundColor: badge.b }]}>
                                            <Text style={[styles.badgeText, { color: badge.c }]}>{apt.status}</Text>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 24, flexWrap: 'wrap' }}>
                                        <Text style={{ color: '#94a3b8', fontSize: 13 }}>👨‍⚕️ Dr. {apt.doctorId?.name || apt.doctorName || 'N/A'}</Text>
                                        <Text style={{ color: '#94a3b8', fontSize: 13 }}>📋 {apt.serviceName || 'Consultation'}</Text>
                                        {apt.diagnosis && <Text style={{ color: '#94a3b8', fontSize: 13 }}>🩺 {apt.diagnosis}</Text>}
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            </View>
        );
    };

    const renderSurgeryPlans = () => (
        <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: '#7c3aed' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.cardTitle, { color: '#c084fc', marginBottom: 0 }]}>🔪 Surgery Plans ({surgeryPlans.length})</Text>
            </View>

            {surgeryPlans.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>📋</Text>
                    <Text style={{ color: '#64748b' }}>No surgery plans found for this patient.</Text>
                </View>
            ) : (
                <View style={{ gap: 14 }}>
                    {surgeryPlans.map(sp => {
                        const surgeonName = sp.surgeonId?.name || (sp.surgeonId?.firstName ? `${sp.surgeonId.firstName} ${sp.surgeonId.lastName || ''}` : 'Surgeon');
                        const cleanSurgeon = surgeonName.replace(/^Dr\.?\s*/i, '');
                        const refDocName = sp.referringDoctorId?.name ? sp.referringDoctorId.name.replace(/^Dr\.?\s*/i, '') : null;
                        const docName = sp.doctorId?.name ? sp.doctorId.name.replace(/^Dr\.?\s*/i, '') : null;
                        const statusBadge = getStatusStyle(sp.status);

                        return (
                            <View key={sp._id} style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 18 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                                    <View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <Text style={{ fontSize: 18, fontWeight: '900', color: '#f8fafc' }}>{sp.surgery}</Text>
                                            {sp.planId && (
                                                <View style={{ backgroundColor: '#e0e7ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#3730a3' }}>{sp.planId}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                                            <Text style={{ fontWeight: 'bold' }}>Diagnosis:</Text> {sp.diagnosis || 'N/A'}
                                        </Text>
                                    </View>
                                    
                                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <View style={[styles.badge, { backgroundColor: statusBadge.b, paddingHorizontal: 14, paddingVertical: 6 }]}>
                                            <Text style={[styles.badgeText, { color: statusBadge.c }]}>{sp.status}</Text>
                                        </View>
                                        
                                        {sp.status === 'PLANNED' && (
                                            <TouchableOpacity onPress={() => handleOpenScheduleModal(sp)} style={[styles.actionBtn, { backgroundColor: '#7c3aed' }]}>
                                                <Text style={styles.actionBtnText}>Schedule Surgery</Text>
                                            </TouchableOpacity>
                                        )}
                                        {sp.status === 'SCHEDULED' && (
                                            <TouchableOpacity onPress={() => sp.admissionRequired ? handleOpenWorkflowModal(sp._id, 'ADMIT') : handleWorkflowTransition(sp._id, 'PRE_OP')} style={[styles.actionBtn, { backgroundColor: '#8b5cf6' }]}>
                                                <Text style={styles.actionBtnText}>{sp.admissionRequired ? 'Admit Patient' : 'Start Pre-Op'}</Text>
                                            </TouchableOpacity>
                                        )}
                                        {sp.status === 'ADMITTED' && (
                                            <TouchableOpacity onPress={() => handleWorkflowTransition(sp._id, 'PRE_OP')} style={[styles.actionBtn, { backgroundColor: '#8b5cf6' }]}>
                                                <Text style={styles.actionBtnText}>Start Pre-Op</Text>
                                            </TouchableOpacity>
                                        )}
                                        {sp.status === 'PRE_OP' && (
                                            <TouchableOpacity onPress={() => handleWorkflowTransition(sp._id, 'READY_FOR_OT')} style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}>
                                                <Text style={styles.actionBtnText}>Mark Ready for OT</Text>
                                            </TouchableOpacity>
                                        )}
                                        {sp.status === 'READY_FOR_OT' && (
                                            <TouchableOpacity onPress={() => handleWorkflowTransition(sp._id, 'IN_OT')} style={[styles.actionBtn, { backgroundColor: '#10b981' }]}>
                                                <Text style={styles.actionBtnText}>Send to OT</Text>
                                            </TouchableOpacity>
                                        )}
                                        {sp.status === 'IN_OT' && (
                                            <TouchableOpacity onPress={() => handleWorkflowTransition(sp._id, 'SURGERY_COMPLETED')} style={[styles.actionBtn, { backgroundColor: '#06b6d4' }]}>
                                                <Text style={styles.actionBtnText}>Complete Surgery</Text>
                                            </TouchableOpacity>
                                        )}
                                        {sp.status === 'SURGERY_COMPLETED' && (
                                            <>
                                                <TouchableOpacity onPress={() => handleOpenWorkflowModal(sp._id, 'TRANSFER')} style={[styles.actionBtn, { backgroundColor: '#8b5cf6' }]}>
                                                    <Text style={styles.actionBtnText}>Transfer & Post-Op</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleWorkflowTransition(sp._id, 'POST_OP')} style={[styles.actionBtn, { backgroundColor: '#64748b' }]}>
                                                    <Text style={styles.actionBtnText}>Start Post-Op</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                        {sp.status === 'SCHEDULED' && (
                                            <>
                                                <TouchableOpacity onPress={() => handleOpenScheduleModal(sp)} style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}>
                                                    <Text style={styles.actionBtnText}>Edit</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleCancelSurgery(sp._id)} style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}>
                                                    <Text style={styles.actionBtnText}>Cancel</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                                    <View style={{ minWidth: 220, flex: 1 }}>
                                        <Text style={{ color: '#94a3b8', fontSize: 13 }}>Operating Surgeon: </Text>
                                        <Text style={{ color: '#f8fafc', fontWeight: 'bold' }}>Dr. {cleanSurgeon}</Text>
                                        {sp.assistantSurgeonIds && sp.assistantSurgeonIds.length > 0 && (
                                            <Text style={{ color: '#cbd5e1', fontSize: 12, marginTop: 2 }}>
                                                🤝 Assistants: {sp.assistantSurgeonIds.map(a => `Dr. ${(a.name || 'Doctor').replace(/^Dr\.?\s*/i, '')}`).join(', ')}
                                            </Text>
                                        )}
                                        {(refDocName || docName) && (refDocName !== cleanSurgeon && docName !== cleanSurgeon) && (
                                            <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                                                Referred by: Dr. {refDocName || docName}
                                            </Text>
                                        )}
                                    </View>

                                    {['SCHEDULED','ADMITTED','PRE_OP','READY_FOR_OT','IN_OT','SURGERY_COMPLETED','POST_OP','COMPLETED'].includes(sp.status) ? (
                                        <>
                                            <View style={{ minWidth: 150, flex: 1 }}>
                                                <Text style={{ color: '#94a3b8', fontSize: 13 }}>OT Room: </Text>
                                                <Text style={{ color: '#f8fafc', fontWeight: 'bold' }}>🚪 {sp.otRoomId?.name || 'Assigned'}</Text>
                                            </View>
                                            <View style={{ minWidth: 150, flex: 1 }}>
                                                <Text style={{ color: '#94a3b8', fontSize: 13 }}>Scheduled: </Text>
                                                <Text style={{ color: '#f8fafc', fontWeight: 'bold' }}>{formatDate(sp.surgeryDate)} ({sp.startTime} - {sp.endTime})</Text>
                                            </View>
                                        </>
                                    ) : (
                                        <View style={{ minWidth: 150, flex: 1 }}>
                                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>OT Status: </Text>
                                            <Text style={{ color: '#fbbf24', fontWeight: 'bold' }}>⏳ OT scheduling pending</Text>
                                            <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                                                Preferred: {sp.preferredDate ? formatDate(sp.preferredDate) : 'Flexible'} {sp.preferredTime || ''}
                                            </Text>
                                        </View>
                                    )}

                                    {sp.surgeryCost > 0 && (
                                        <View style={{ minWidth: 150, flex: 1 }}>
                                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>Surgery Fee: </Text>
                                            <Text style={{ color: '#38bdf8', fontWeight: 'bold' }}>₹{Number(sp.surgeryCost).toLocaleString('en-IN')} <Text style={{ fontSize: 12, color: sp.paymentStatus === 'PAID' ? '#4ade80' : (sp.paymentStatus === 'PARTIALLY PAID' ? '#fbbf24' : '#f87171') }}>[{sp.paymentStatus || 'UNPAID'}]</Text></Text>
                                        </View>
                                    )}

                                    <View style={{ minWidth: 150, flex: 1 }}>
                                        <Text style={{ color: '#94a3b8', fontSize: 13 }}>Admission Required: </Text>
                                        <Text style={{ color: '#f8fafc', fontWeight: 'bold' }}>{sp.admissionRequired ? 'Yes' : 'No'}</Text>
                                    </View>
                                </View>

                                {sp.notes && (
                                    <View style={{ marginTop: 12, padding: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                                        <Text style={{ color: '#cbd5e1', fontSize: 13 }}><Text style={{ fontWeight: 'bold' }}>Notes:</Text> {sp.notes}</Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );

    const renderVitals = () => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>
                💓 Current Vitals 
                {vitals.lastRecorded && <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '500' }}> (Last: {formatDate(vitals.lastRecorded)})</Text>}
            </Text>
            <View style={styles.grid4}>
                {renderField('Weight', vitals.weight ? `${vitals.weight} kg` : null)}
                {renderField('Height', vitals.height ? `${vitals.height} cm` : null)}
                {renderField('BMI', vitals.bmi)}
                {renderField('Blood Pressure', vitals.bloodPressure || fp.historyBp)}
                {renderField('Pulse', vitals.pulse ? `${vitals.pulse} bpm` : (fp.historyPulse ? `${fp.historyPulse}` : null))}
                {renderField('Chest Exam', fp.chestExam)}
                {renderField('CVS Exam', fp.cvsExam)}
                {renderField('Temperature', vitals.temperature ? `${vitals.temperature} °F` : null)}
                {renderField('SpO₂', vitals.spo2 ? `${vitals.spo2}%` : null)}
                {renderField('Resp. Rate', vitals.respiratoryRate ? `${vitals.respiratoryRate}/min` : null)}
            </View>
        </View>
    );

    const renderMedicalHistory = () => {
        const h = fp;
        return (
            <View>
                {surgeryPlans && surgeryPlans.length > 0 && renderSurgeryPlans()}

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🤰 Obstetric History</Text>
                    <View style={styles.grid3}>
                        {renderField('Gravida', h.gravida)}
                        {renderField('Para', h.para)}
                        {renderField('Abortions', h.abortion || h.abortions)}
                        {renderField('Living Children', h.living || h.livingChildren)}
                        {renderField('Ectopic', h.ectopic)}
                        {renderField('Stillbirth', h.stillbirth)}
                    </View>
                    {Number(h.abortion) > 0 && (
                        <View style={{ marginTop: 14, backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 10 }}>
                            <Text style={{ marginBottom: 10, fontSize: 12, color: '#fca5a5', fontWeight: 'bold' }}>📉 Abortion Reasons</Text>
                            <View style={styles.grid2}>
                                {Array.from({ length: Number(h.abortion) }).map((_, idx) => (
                                    h[`abortionReason_${idx}`] && renderField(`Abortion #${idx + 1}`, h[`abortionReason_${idx}`])
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>📅 Menstrual History</Text>
                    <View style={styles.grid3}>
                        {renderField('LMP', formatDate(h.lmp))}
                        {renderField('Cycle Length', h.cycleLength ? `${h.cycleLength} days` : null)}
                        {renderField('Cycle Regularity', h.cycleRegularity)}
                        {renderField('Menarche Age', h.menarcheAge)}
                        {renderField('Flow Duration', h.flowDuration)}
                        {renderField('Dysmenorrhea', h.dysmenorrhea)}
                        {renderField('Inter. Pain', h.intermenstrualPain)}
                        {renderField('Inter. Bleeding', h.intermenstrualBleeding)}
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🏥 Chronic Conditions & Habits</Text>
                    <View style={styles.grid3}>
                        {renderField('Diabetes', h.diabetes)}
                        {renderField('Hypertension', h.hypertension)}
                        {renderField('Thyroid', h.thyroid)}
                        {renderField('Tuberculosis', h.tb)}
                        {renderField('Allergies', h.allergies)}
                        {renderField('Smoking', h.smoking)}
                        {renderField('Alcohol', h.alcohol)}
                        {renderField('Previous Surgery', h.previousSurgery)}
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>👨 Male Factor / Partner Details</Text>
                    <View style={styles.grid3}>
                        {renderField('Spouse Name', h.spouseName)}
                        {renderField('Spouse Age', h.spouseAge)}
                        {renderField('Spouse Occupation', h.spouseOccupation)}
                        {renderField('Semen Analysis', h.semenAnalysis)}
                        {renderField('Male Factor', h.maleFactor)}
                        {renderField('Partner Medical History', h.partnerMedicalHistory)}
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>💉 Previous Treatment History</Text>
                    <View style={styles.grid2}>
                        {renderField('Previous Treatments', h.previousTreatments)}
                        {renderField('IVF Cycles', h.ivfCycles)}
                        {renderField('IUI Attempts', h.iuiAttempts)}
                        {renderField('Outcome', h.treatmentOutcome)}
                    </View>
                </View>
            </View>
        );
    };

    const renderVisits = () => (
        <View style={styles.tableWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ minWidth: 800 }}>
                    <View style={styles.tableHeaderRow}>
                        <Text style={[styles.th, { width: 40 }]}>#</Text>
                        <Text style={[styles.th, { flex: 1 }]}>Date</Text>
                        <Text style={[styles.th, { flex: 1 }]}>Time</Text>
                        <Text style={[styles.th, { flex: 1.5 }]}>Doctor</Text>
                        <Text style={[styles.th, { flex: 1.5 }]}>Service</Text>
                        <Text style={[styles.th, { flex: 1.5 }]}>Diagnosis</Text>
                        <Text style={[styles.th, { flex: 1 }]}>Status</Text>
                        <Text style={[styles.th, { flex: 2 }]}>Notes</Text>
                    </View>
                    {appointments.length === 0 ? (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                            <Text style={{ color: '#64748b' }}>No visits recorded</Text>
                        </View>
                    ) : (
                        appointments.map((apt, i) => {
                            const badge = getStatusStyle(apt.status);
                            return (
                                <View key={apt._id} style={styles.tableRow}>
                                    <Text style={[styles.td, { width: 40, color: '#64748b', fontWeight: 'bold' }]}>{i + 1}</Text>
                                    <Text style={[styles.td, { flex: 1, color: '#f8fafc', fontWeight: 'bold' }]}>{formatDate(apt.appointmentDate)}</Text>
                                    <Text style={[styles.td, { flex: 1, color: '#94a3b8' }]}>{apt.appointmentTime}</Text>
                                    <Text style={[styles.td, { flex: 1.5, color: '#e2e8f0', fontWeight: 'bold' }]}>Dr. {apt.doctorId?.name || apt.doctorName || 'N/A'}</Text>
                                    <Text style={[styles.td, { flex: 1.5, color: '#94a3b8' }]}>{apt.serviceName || 'Consultation'}</Text>
                                    <Text style={[styles.td, { flex: 1.5, color: '#e2e8f0' }]}>{apt.diagnosis || '—'}</Text>
                                    <View style={[styles.td, { flex: 1 }]}>
                                        <View style={[styles.badge, { backgroundColor: badge.b, alignSelf: 'flex-start' }]}>
                                            <Text style={[styles.badgeText, { color: badge.c }]}>{apt.status}</Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.td, { flex: 2, color: '#94a3b8' }]} numberOfLines={1}>{apt.notes || apt.doctorNotes || '—'}</Text>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        </View>
    );

    const renderLabs = () => (
        <View style={styles.tableWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ minWidth: 900 }}>
                    <View style={styles.tableHeaderRow}>
                        <Text style={[styles.th, { width: 40 }]}>#</Text>
                        <Text style={[styles.th, { flex: 1 }]}>Date</Text>
                        <Text style={[styles.th, { flex: 2 }]}>Tests</Text>
                        <Text style={[styles.th, { flex: 1 }]}>Status</Text>
                        <Text style={[styles.th, { flex: 1 }]}>Report</Text>
                        <Text style={[styles.th, { flex: 1 }]}>Payment</Text>
                        <Text style={[styles.th, { flex: 1 }]}>Amount</Text>
                        <Text style={[styles.th, { flex: 1.5 }]}>Notes</Text>
                        <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Action</Text>
                    </View>
                    {labReports.length === 0 ? (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                            <Text style={{ color: '#64748b' }}>No lab reports found</Text>
                        </View>
                    ) : (
                        labReports.map((lr, i) => {
                            const testBadge = getStatusStyle(lr.testStatus);
                            const repBadge = getStatusStyle(lr.reportStatus);
                            const payBadge = getStatusStyle(lr.paymentStatus);
                            
                            return (
                                <View key={lr._id} style={styles.tableRow}>
                                    <Text style={[styles.td, { width: 40, color: '#64748b', fontWeight: 'bold' }]}>{i + 1}</Text>
                                    <Text style={[styles.td, { flex: 1, color: '#f8fafc', fontWeight: 'bold' }]}>{formatDate(lr.createdAt)}</Text>
                                    <View style={[styles.td, { flex: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }]}>
                                        {(lr.testNames || []).map((t, j) => (
                                            <View key={j} style={{ backgroundColor: 'rgba(59,130,246,0.15)', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12 }}>
                                                <Text style={{ color: '#93c5fd', fontSize: 11, fontWeight: 'bold' }}>{t}</Text>
                                            </View>
                                        ))}
                                    </View>
                                    <View style={[styles.td, { flex: 1 }]}>
                                        <View style={[styles.badge, { backgroundColor: testBadge.b, alignSelf: 'flex-start' }]}><Text style={[styles.badgeText, { color: testBadge.c }]}>{lr.testStatus}</Text></View>
                                    </View>
                                    <View style={[styles.td, { flex: 1 }]}>
                                        <View style={[styles.badge, { backgroundColor: repBadge.b, alignSelf: 'flex-start' }]}><Text style={[styles.badgeText, { color: repBadge.c }]}>{lr.reportStatus}</Text></View>
                                    </View>
                                    <View style={[styles.td, { flex: 1 }]}>
                                        <View style={[styles.badge, { backgroundColor: payBadge.b, alignSelf: 'flex-start' }]}><Text style={[styles.badgeText, { color: payBadge.c }]}>{lr.paymentStatus}</Text></View>
                                    </View>
                                    <Text style={[styles.td, { flex: 1, color: '#f8fafc', fontWeight: 'bold' }]}>{lr.amount ? `₹${lr.amount}` : '—'}</Text>
                                    <Text style={[styles.td, { flex: 1.5, color: '#94a3b8' }]}>{lr.notes || '—'}</Text>
                                    <View style={[styles.td, { flex: 1, alignItems: 'center' }]}>
                                        {lr.reportFile?.url && (
                                            <TouchableOpacity 
                                                onPress={() => Alert.alert('Open File', 'Requires Native PDF Viewer implementation.')}
                                                style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)' }}
                                            >
                                                <Text style={{ color: '#60a5fa', fontSize: 11, fontWeight: 'bold' }}>👁️ View</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        </View>
    );

    const renderPrescriptions = () => (
        <View>
            {pharmacyOrders.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>💊</Text>
                    <Text style={{ color: '#64748b' }}>No prescriptions found.</Text>
                </View>
            ) : (
                pharmacyOrders.map((order, i) => {
                    const oBadge = getStatusStyle(order.orderStatus || 'pending');
                    const pBadge = getStatusStyle(order.paymentStatus || 'PENDING');
                    return (
                        <View key={order._id} style={styles.timelineCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Text style={{ color: '#3b82f6', fontWeight: 'bold' }}>Rx #{i + 1}</Text>
                                    <Text style={{ color: '#f8fafc', fontWeight: 'bold' }}>{formatDate(order.createdAt)}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <View style={[styles.badge, { backgroundColor: oBadge.b }]}><Text style={[styles.badgeText, { color: oBadge.c }]}>{order.orderStatus || 'Pending'}</Text></View>
                                    <View style={[styles.badge, { backgroundColor: pBadge.b }]}><Text style={[styles.badgeText, { color: pBadge.c }]}>{order.paymentStatus || 'Pending'}</Text></View>
                                </View>
                            </View>
                            <View style={styles.tableWrap}>
                                <View style={styles.tableHeaderRow}>
                                    <Text style={[styles.th, { flex: 2 }]}>Medicine</Text>
                                    <Text style={[styles.th, { flex: 1.5 }]}>Dosage / Frequency</Text>
                                    <Text style={[styles.th, { flex: 1 }]}>Duration</Text>
                                </View>
                                {(order.items || []).map((item, j) => (
                                    <View key={j} style={styles.tableRow}>
                                        <Text style={[styles.td, { flex: 2, color: '#f8fafc', fontWeight: 'bold' }]}>{item.medicineName}</Text>
                                        <Text style={[styles.td, { flex: 1.5, color: '#94a3b8' }]}>{item.frequency || '—'}</Text>
                                        <Text style={[styles.td, { flex: 1, color: '#94a3b8' }]}>{item.duration || '—'}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    );
                })
            )}
        </View>
    );

    const renderClinical = () => {
        const h = fp;
        return (
            <View>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🩺 Clinical Examination</Text>
                    <View style={styles.grid2}>
                        {renderField('General Examination', h.generalExam)}
                        {renderField('Systemic Examination', h.systemicExam)}
                        {renderField('Per Abdomen', h.perAbdomen)}
                        {renderField('Per Speculum', h.perSpeculum)}
                        {renderField('Per Vaginum', h.perVaginum)}
                        {renderField('Breast Examination', h.breastExam)}
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>📊 Investigation Results</Text>
                    <View style={styles.grid2}>
                        {renderField('AMH', h.amh)}
                        {renderField('FSH', h.fsh)}
                        {renderField('LH', h.lh)}
                        {renderField('TSH', h.tsh)}
                        {renderField('Prolactin', h.prolactin)}
                        {renderField('E2', h.e2)}
                        {renderField('AFC (Antral Follicle Count)', h.afc)}
                        {renderField('HSG Report', h.hsgReport)}
                        {renderField('Ultrasound Findings', h.ultrasoundFindings)}
                        {renderField('Other Investigations', h.otherInvestigations)}
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>📝 Additional Notes</Text>
                    <View style={{ padding: 14, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, minHeight: 60 }}>
                        <Text style={{ color: '#94a3b8', fontSize: 13, lineHeight: 20 }}>
                            {h.additionalNotes || h.notes || 'No additional notes recorded.'}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.page}>
            {/* Top Bar */}
            <View style={styles.topbar}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={{ color: '#f8fafc', fontSize: 16, fontWeight: '900' }}>Patient Profile</Text>
                </View>
                <Text style={{ color: '#64748b', fontSize: 12 }}>MRN: <Text style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{patient.patientId || 'N/A'}</Text></Text>
            </View>

            <ScrollView contentContainerStyle={styles.container}>
                {/* Identity Card */}
                <View style={styles.idCard}>
                    <View style={styles.avatar}>
                        {patient.avatar ? (
                            <Image source={{ uri: patient.avatar }} style={{ width: '100%', height: '100%', borderRadius: 20 }} resizeMode="cover" />
                        ) : (
                            <Text style={styles.avatarText}>{(patient.name || 'P')[0].toUpperCase()}</Text>
                        )}
                    </View>
                    <View style={styles.idInfo}>
                        <Text style={styles.idName}>{patient.name}</Text>
                        <View style={styles.idMeta}>
                            <View style={[styles.idBadge, { backgroundColor: 'rgba(59,130,246,0.15)' }]}><Text style={[styles.idBadgeText, { color: '#93c5fd' }]}>📞 {patient.phone || 'No Phone'}</Text></View>
                            {patient.gender && <View style={[styles.idBadge, { backgroundColor: 'rgba(139,92,246,0.15)' }]}><Text style={[styles.idBadgeText, { color: '#c4b5fd' }]}>{patient.gender === 'male' ? '♂️' : '♀️'} {patient.gender}</Text></View>}
                            {age && <View style={[styles.idBadge, { backgroundColor: 'rgba(16,185,129,0.15)' }]}><Text style={[styles.idBadgeText, { color: '#6ee7b7' }]}>{age} years</Text></View>}
                            {patient.bloodGroup && <View style={[styles.idBadge, { backgroundColor: 'rgba(239,68,68,0.15)' }]}><Text style={[styles.idBadgeText, { color: '#fca5a5' }]}>{patient.bloodGroup}</Text></View>}
                            <View style={[styles.idBadge, { backgroundColor: 'rgba(255,255,255,0.06)' }]}><Text style={[styles.idBadgeText, { color: '#94a3b8' }]}>Since {formatDate(patient.createdAt)}</Text></View>
                        </View>
                        <View style={styles.idGrid}>
                            {renderField('Email', patient.email)}
                            {renderField('Address', patient.address)}
                            {renderField('City', patient.city)}
                            {renderField('Aadhaar', patient.isAadhaarVerified ? '✅ Verified' : 'Not Verified')}
                        </View>
                    </View>
                </View>

                {/* Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 20 }}>
                    <View style={styles.tabsBar}>
                        {tabs.map(t => {
                            const isActive = activeTab === t.key;
                            return (
                                <TouchableOpacity 
                                    key={t.key} 
                                    style={[styles.tab, isActive && styles.tabActive]}
                                    onPress={() => setActiveTab(t.key)}
                                >
                                    <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>

                {/* Tab Content */}
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'surgery' && renderSurgeryPlans()}
                {activeTab === 'vitals' && renderVitals()}
                {activeTab === 'medical' && renderMedicalHistory()}
                {activeTab === 'visits' && renderVisits()}
                {activeTab === 'labs' && renderLabs()}
                {activeTab === 'prescriptions' && renderPrescriptions()}
                {activeTab === 'clinical' && renderClinical()}
            </ScrollView>

            {/* Schedule Surgery Modal */}
            <Modal visible={showScheduleModal} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Schedule Operation / Surgery</Text>
                        
                        <ScrollView style={{ maxHeight: 400 }}>
                            <Text style={styles.modalLabel}>Operating Surgeon *</Text>
                            <View style={styles.pickerWrap}>
                                <Picker
                                    selectedValue={scheduleData.surgeonId}
                                    onValueChange={(val) => setScheduleData({ ...scheduleData, surgeonId: val })}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="Select Surgeon" value="" color="#94a3b8" />
                                    {surgeonsList.map(s => <Picker.Item key={s._id} label={`Dr. ${s.name || `${s.firstName} ${s.lastName || ''}`}`} value={s._id} />)}
                                </Picker>
                            </View>

                            <Text style={styles.modalLabel}>Assign OT Room *</Text>
                            <View style={styles.pickerWrap}>
                                <Picker
                                    selectedValue={scheduleData.otRoomId}
                                    onValueChange={(val) => setScheduleData({ ...scheduleData, otRoomId: val })}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="Select OT Room" value="" color="#94a3b8" />
                                    {otRoomsList.map(r => <Picker.Item key={r._id} label={`${r.name} (${r.roomNumber || ''})`} value={r._id} />)}
                                </Picker>
                            </View>

                            <Text style={styles.modalLabel}>Surgery Date (YYYY-MM-DD) *</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={scheduleData.surgeryDate}
                                onChangeText={(t) => setScheduleData({ ...scheduleData, surgeryDate: t })}
                                placeholder="e.g. 2025-05-12"
                                placeholderTextColor="#64748b"
                            />

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalLabel}>Start Time *</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        value={scheduleData.startTime}
                                        onChangeText={(t) => setScheduleData({ ...scheduleData, startTime: t })}
                                        placeholder="09:00"
                                        placeholderTextColor="#64748b"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalLabel}>End Time *</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        value={scheduleData.endTime}
                                        onChangeText={(t) => setScheduleData({ ...scheduleData, endTime: t })}
                                        placeholder="12:00"
                                        placeholderTextColor="#64748b"
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                            <TouchableOpacity onPress={() => setShowScheduleModal(false)} style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }]}>
                                <Text style={{ color: '#94a3b8' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleScheduleSubmit} style={[styles.actionBtn, { backgroundColor: '#7c3aed' }]}>
                                <Text style={styles.actionBtnText}>Confirm Schedule</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Workflow Modal (Admit / Transfer) */}
            <Modal visible={showWorkflowModal} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 400 }]}>
                        <Text style={styles.modalTitle}>
                            {workflowActionType === 'ADMIT' ? '🏥 Admit Patient for Surgery' : '🔄 Transfer Patient Bed'}
                        </Text>
                        
                        <Text style={styles.modalLabel}>Select Available Bed *</Text>
                        <View style={styles.pickerWrap}>
                            <Picker
                                selectedValue={selectedBedId}
                                onValueChange={(val) => setSelectedBedId(val)}
                                style={styles.picker}
                            >
                                <Picker.Item label="Choose Bed" value="" color="#94a3b8" />
                                {workflowBeds.map(b => (
                                    <Picker.Item key={b._id} label={`${b.ward} - Bed ${b.bedNumber} (${b.bedType})`} value={b._id} />
                                ))}
                            </Picker>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                            <TouchableOpacity onPress={() => setShowWorkflowModal(false)} style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }]}>
                                <Text style={{ color: '#94a3b8' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleWorkflowModalSubmit} style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]}>
                                <Text style={styles.actionBtnText}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    topbar: {
        backgroundColor: 'rgba(15,23,42,0.92)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
        paddingVertical: 14,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 100,
    },
    backBtn: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    backBtnText: {
        color: '#94a3b8',
        fontWeight: '600',
        fontSize: 13,
    },
    container: {
        padding: 20,
    },
    loadWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    idCard: {
        backgroundColor: 'rgba(59,130,246,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(59,130,246,0.2)',
        borderRadius: 20,
        padding: 24,
        flexDirection: width > 600 ? 'row' : 'column',
        gap: 20,
        alignItems: width > 600 ? 'flex-start' : 'center',
        marginBottom: 24,
    },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 20,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    avatarText: {
        color: '#fff',
        fontSize: 36,
        fontWeight: '900',
    },
    idInfo: {
        flex: 1,
        alignItems: width > 600 ? 'flex-start' : 'center',
    },
    idName: {
        fontSize: 24,
        fontWeight: '900',
        color: '#f8fafc',
        marginBottom: 8,
    },
    idMeta: {
        flexDirection: 'row',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 16,
        justifyContent: width > 600 ? 'flex-start' : 'center',
    },
    idBadge: {
        paddingVertical: 4,
        paddingHorizontal: 14,
        borderRadius: 20,
    },
    idBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
    },
    idGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        width: '100%',
    },
    tabsBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.04)',
        padding: 4,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    tab: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
    },
    tabActive: {
        backgroundColor: '#3b82f6',
        elevation: 5,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    tabText: {
        fontWeight: 'bold',
        fontSize: 12,
        color: '#94a3b8',
    },
    tabTextActive: {
        color: '#fff',
    },
    card: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: 22,
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#f8fafc',
        marginBottom: 16,
    },
    grid2: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    grid3: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    grid4: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    fieldGroup: {
        minWidth: 140,
        flex: 1,
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    fieldLabel: {
        color: '#64748b',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    fieldValue: {
        color: '#e2e8f0',
        fontSize: 13,
        fontWeight: 'bold',
    },
    tableWrap: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    },
    tableHeaderRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    th: {
        padding: 12,
        color: '#64748b',
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.04)',
        alignItems: 'center',
    },
    td: {
        padding: 12,
        fontSize: 13,
    },
    timelineCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: 18,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#3b82f6',
    },
    badge: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'capitalize',
    },
    actionBtn: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 6,
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyState: {
        alignItems: 'center',
        padding: 40,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#1e293b',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 500,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#f8fafc',
        marginBottom: 16,
    },
    modalLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 4,
        marginTop: 10,
    },
    pickerWrap: {
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        overflow: 'hidden',
    },
    picker: {
        color: '#fff',
        width: '100%',
        height: 50,
    },
    modalInput: {
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 8,
        color: '#fff',
        padding: 10,
        height: 44,
    }
});

export default PatientProfile;
