import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    Modal
} from 'react-native';
import { ipdClinicalAPI, admissionAPI } from '../../utils/api';
import { useAuth } from '../../store/hooks';

const COMMON_UNITS = [
    'mg', 'g', 'mcg', 'ml', 'tablet', 'capsule', 'vial', 'ampoule', 'drop', 'puff', 'patch', 'other'
];

const COMMON_ROUTES = [
    'Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhalation', 'Sublingual', 'Rectal', 'Other'
];

const COMMON_FREQUENCIES = [
    'Once Daily', 'BD', 'TDS', 'QID', 'SOS', 'STAT', 'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'Every 12 hours'
];

const ADMISSION_REASONS = [
    'Observation & Monitoring',
    'Post-Operative Recovery',
    'Intensive Care (ICU)',
    'IV Antibiotic / Fluid Therapy',
    'Acute Pain Management',
    'Unstable Vital Signs',
    'Planned Surgical Procedure',
    'Diagnostic Workup / Biopsy',
    'Severe Infection / Sepsis',
    'Cardiac Monitoring',
    'Other Clinical Indication'
];

const DISCHARGE_CONDITIONS = [
    'STABLE', 'IMPROVED', 'RECOVERED', 'CRITICAL', 'TRANSFERRED', 'LAMA', 'EXPIRED'
];

const createEmptyMedRow = () => ({
    medicineName: '',
    dosageValue: '',
    dosageUnit: 'mg',
    route: 'Oral',
    frequency: 'BD',
    startDate: new Date().toISOString().split('T')[0],
    duration: '3 days',
    instructions: 'After food'
});

const createEmptyDischargeMedRow = () => ({
    medicineName: '',
    dosage: '',
    route: 'Oral',
    frequency: 'BD',
    duration: '5 days',
    instructions: 'After meals'
});

const DoctorIPDOrdersPanel = ({
    patientId,
    patient = {},
    appointment = null,
    currentUser = null,
    onOrderCreated = null
}) => {
    const { user: authUser } = useAuth();
    const activeDoctor = currentUser || authUser;

    // Active sub-tab: 'orders', 'clarifications', 'discharge'
    const [activeTab, setActiveTab] = useState('orders');

    // Active admission state
    const [activeAdmission, setActiveAdmission] = useState(null);
    const [loadingAdmission, setLoadingAdmission] = useState(true);

    // Form fields for New Clinical Order
    const [admissionReason, setAdmissionReason] = useState('Observation & Monitoring');
    const [diagnosis, setDiagnosis] = useState(appointment?.diagnosis || appointment?.department || '');
    const [clinicalNotes, setClinicalNotes] = useState('');
    const [investigationNotes, setInvestigationNotes] = useState('');
    const [procedureNotes, setProcedureNotes] = useState('');
    const [anesthesiaNotes, setAnesthesiaNotes] = useState('');
    const [medicationRows, setMedicationRows] = useState([createEmptyMedRow()]);

    // Existing orders state
    const [existingOrders, setExistingOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Cancel modal state
    const [orderToCancel, setOrderToCancel] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelling, setCancelling] = useState(false);

    // Clarifications state
    const [clarifications, setClarifications] = useState([]);
    const [loadingClarifications, setLoadingClarifications] = useState(false);
    const [activeClarificationId, setActiveClarificationId] = useState(null);
    const [doctorResponseText, setDoctorResponseText] = useState('');
    const [submittingResponse, setSubmittingResponse] = useState(false);

    // Discharge Summary state
    const [dischargeSummary, setDischargeSummary] = useState({
        diagnosis: appointment?.diagnosis || '',
        admissionReason: '',
        hospitalCourse: '',
        proceduresSummary: '',
        keyInvestigationsSummary: '',
        treatmentSummary: '',
        conditionAtDischarge: 'STABLE',
        dischargeMedications: [createEmptyDischargeMedRow()],
        followUpInstructions: '',
        returnPrecautions: 'Seek emergency care immediately if experiencing high fever, chest pain, shortness of breath, severe pain, or bleeding.',
        followUpDate: '',
        status: 'DRAFT'
    });
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [savingSummary, setSavingSummary] = useState(false);

    // Fetch active admission
    const fetchAdmission = useCallback(async () => {
        if (!patientId) return;
        setLoadingAdmission(true);
        try {
            const res = await admissionAPI.getAdmissions({ patientId, status: 'ADMITTED' });
            const list = res.data?.admissions || res.data || (Array.isArray(res) ? res : []);
            const active = list.find(a => (a.status || '').toUpperCase() === 'ADMITTED');
            setActiveAdmission(active || null);
        } catch (err) {
            console.warn('Could not fetch admission status:', err);
            setActiveAdmission(null);
        } finally {
            setLoadingAdmission(false);
        }
    }, [patientId]);

    // Fetch existing orders
    const fetchOrders = useCallback(async () => {
        if (!patientId) return;
        setLoadingOrders(true);
        try {
            const res = await ipdClinicalAPI.getPatientOrders(patientId);
            if (res && res.success) {
                setExistingOrders(res.data || []);
            } else {
                setExistingOrders([]);
            }
        } catch (err) {
            console.warn('Could not fetch IPD orders:', err);
            setExistingOrders([]);
        } finally {
            setLoadingOrders(false);
        }
    }, [patientId]);

    // Fetch clarifications
    const fetchClarifications = useCallback(async () => {
        if (!activeAdmission?._id) return;
        setLoadingClarifications(true);
        try {
            const res = await ipdClinicalAPI.getClarificationsInbox({
                admissionId: activeAdmission._id,
                status: 'ALL'
            });
            if (res && res.success) {
                setClarifications(res.clarifications || res.data || []);
            }
        } catch (err) {
            console.warn('Could not fetch clarifications:', err);
        } finally {
            setLoadingClarifications(false);
        }
    }, [activeAdmission]);

    // Fetch discharge summary
    const fetchDischargeSummary = useCallback(async () => {
        if (!activeAdmission?._id) return;
        setLoadingSummary(true);
        try {
            const res = await ipdClinicalAPI.getDischargeSummary(activeAdmission._id);
            if (res && res.success && res.dischargeSummary) {
                const s = res.dischargeSummary;
                setDischargeSummary({
                    diagnosis: s.diagnosis || '',
                    admissionReason: s.admissionReason || '',
                    hospitalCourse: s.hospitalCourse || '',
                    proceduresSummary: s.proceduresSummary || '',
                    keyInvestigationsSummary: s.keyInvestigationsSummary || '',
                    treatmentSummary: s.treatmentSummary || '',
                    conditionAtDischarge: s.conditionAtDischarge || 'STABLE',
                    dischargeMedications: s.dischargeMedications?.length > 0
                        ? s.dischargeMedications
                        : [createEmptyDischargeMedRow()],
                    followUpInstructions: s.followUpInstructions || '',
                    returnPrecautions: s.returnPrecautions || '',
                    followUpDate: s.followUpDate ? s.followUpDate.split('T')[0] : '',
                    status: s.status || 'DRAFT'
                });
            }
        } catch (err) {
            console.warn('Could not fetch discharge summary:', err);
        } finally {
            setLoadingSummary(false);
        }
    }, [activeAdmission]);

    useEffect(() => {
        fetchAdmission();
        fetchOrders();
    }, [fetchAdmission, fetchOrders]);

    useEffect(() => {
        if (activeAdmission?._id) {
            if (activeTab === 'clarifications') fetchClarifications();
            if (activeTab === 'discharge') fetchDischargeSummary();
        }
    }, [activeAdmission, activeTab, fetchClarifications, fetchDischargeSummary]);

    // Medication row operations
    const handleMedChange = (index, field, value) => {
        setMedicationRows(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleAddMedRow = () => {
        setMedicationRows(prev => [...prev, createEmptyMedRow()]);
    };

    const handleRemoveMedRow = (index) => {
        if (medicationRows.length === 1) return;
        setMedicationRows(prev => prev.filter((_, i) => i !== index));
    };

    // Submit New Clinical Order
    const handleSubmitOrder = async () => {
        if (!diagnosis.trim()) {
            Alert.alert('Required', 'Please enter a diagnosis for the inpatient order.');
            return;
        }

        const validMeds = medicationRows.filter(m => m.medicineName.trim());

        setSubmitting(true);
        try {
            const payload = {
                patientId,
                admissionId: activeAdmission?._id || null,
                doctorId: activeDoctor?._id || activeDoctor?.id,
                doctorName: activeDoctor?.name || 'Attending Doctor',
                admissionReason,
                diagnosis,
                clinicalNotes,
                dietOrders: clinicalNotes,
                investigationNotes,
                procedureNotes,
                anesthesiaNotes,
                medications: validMeds.map(m => ({
                    medicineName: m.medicineName.trim(),
                    dosage: `${m.dosageValue} ${m.dosageUnit}`.trim(),
                    route: m.route,
                    frequency: m.frequency,
                    duration: m.duration,
                    instructions: m.instructions
                }))
            };

            const res = await ipdClinicalAPI.createOrder(payload);
            if (res && res.success) {
                Alert.alert('Success', 'Inpatient clinical order created successfully!');
                setClinicalNotes('');
                setInvestigationNotes('');
                setProcedureNotes('');
                setAnesthesiaNotes('');
                setMedicationRows([createEmptyMedRow()]);
                fetchOrders();
                if (onOrderCreated) onOrderCreated(res.data);
            } else {
                Alert.alert('Error', res?.message || 'Failed to create order.');
            }
        } catch (err) {
            console.error('Order creation error:', err);
            Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to submit order.');
        } finally {
            setSubmitting(false);
        }
    };

    // Cancel Order
    const handleConfirmCancelOrder = async () => {
        if (!orderToCancel) return;
        setCancelling(true);
        try {
            const res = await ipdClinicalAPI.updateOrder(orderToCancel._id, {
                status: 'CANCELLED',
                cancellationReason: cancelReason.trim() || 'Cancelled by physician'
            });
            if (res && res.success) {
                Alert.alert('Success', 'Order cancelled successfully.');
                setOrderToCancel(null);
                setCancelReason('');
                fetchOrders();
            } else {
                Alert.alert('Error', res?.message || 'Failed to cancel order.');
            }
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to cancel order.');
        } finally {
            setCancelling(false);
        }
    };

    // Respond to Clarification
    const handleRespondClarification = async (clarification) => {
        if (!doctorResponseText.trim()) {
            Alert.alert('Required', 'Please type a response to the nursing clarification.');
            return;
        }
        setSubmittingResponse(true);
        try {
            const res = await ipdClinicalAPI.respondClarification(
                activeAdmission._id,
                clarification.orderId?._id || clarification.orderId,
                { response: doctorResponseText.trim(), clarificationId: clarification._id }
            );
            if (res && res.success) {
                Alert.alert('Success', 'Clarification response sent to nursing staff.');
                setDoctorResponseText('');
                setActiveClarificationId(null);
                fetchClarifications();
            } else {
                Alert.alert('Error', res?.message || 'Failed to send response.');
            }
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to respond.');
        } finally {
            setSubmittingResponse(false);
        }
    };

    // Save Discharge Summary
    const handleSaveDischargeSummary = async (isFinalize = false) => {
        if (!activeAdmission?._id) {
            Alert.alert('Notice', 'Patient is not currently admitted to an IPD bed.');
            return;
        }

        setSavingSummary(true);
        try {
            const payload = {
                ...dischargeSummary,
                status: isFinalize ? 'FINALIZED' : 'DRAFT'
            };

            const res = await ipdClinicalAPI.saveDischargeSummary(activeAdmission._id, payload);
            if (res && res.success) {
                if (isFinalize) {
                    await ipdClinicalAPI.createDischargeOrder(activeAdmission._id, {
                        conditionAtDischarge: dischargeSummary.conditionAtDischarge,
                        dischargeNotes: dischargeSummary.treatmentSummary,
                        followUpDate: dischargeSummary.followUpDate
                    });
                    Alert.alert('Success', 'Discharge order finalized and clinical summary signed!');
                } else {
                    Alert.alert('Success', 'Discharge summary draft saved.');
                }
                fetchDischargeSummary();
            } else {
                Alert.alert('Error', res?.message || 'Failed to save discharge summary.');
            }
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to save discharge summary.');
        } finally {
            setSavingSummary(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header Admission Banner */}
            <View style={styles.admissionBanner}>
                <View style={styles.bannerLeft}>
                    <Text style={styles.bannerTitle}>🏥 Inpatient Department (IPD)</Text>
                    {loadingAdmission ? (
                        <ActivityIndicator size="small" color="#2563eb" style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                    ) : activeAdmission ? (
                        <View style={styles.admissionStatusRow}>
                            <View style={styles.admittedBadge}>
                                <Text style={styles.admittedBadgeText}>ADMITTED</Text>
                            </View>
                            <Text style={styles.admissionDetailsText}>
                                Ward: {activeAdmission.wardId?.name || activeAdmission.ward || 'General Ward'} • Bed: {activeAdmission.bedId?.bedNumber || activeAdmission.bed || 'N/A'}
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.notAdmittedText}>⚠️ Patient is not currently admitted to an IPD bed.</Text>
                    )}
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={() => { fetchAdmission(); fetchOrders(); }}>
                    <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
                </TouchableOpacity>
            </View>

            {/* Sub-tab Navigation */}
            <View style={styles.subTabNav}>
                <TouchableOpacity
                    style={[styles.subTabBtn, activeTab === 'orders' && styles.subTabBtnActive]}
                    onPress={() => setActiveTab('orders')}
                >
                    <Text style={[styles.subTabBtnText, activeTab === 'orders' && styles.subTabBtnTextActive]}>
                        📝 Clinical Orders ({existingOrders.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.subTabBtn, activeTab === 'clarifications' && styles.subTabBtnActive]}
                    onPress={() => setActiveTab('clarifications')}
                >
                    <Text style={[styles.subTabBtnText, activeTab === 'clarifications' && styles.subTabBtnTextActive]}>
                        💬 Clarifications ({clarifications.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.subTabBtn, activeTab === 'discharge' && styles.subTabBtnActive]}
                    onPress={() => setActiveTab('discharge')}
                >
                    <Text style={[styles.subTabBtnText, activeTab === 'discharge' && styles.subTabBtnTextActive]}>
                        🏁 Discharge Order
                    </Text>
                </TouchableOpacity>
            </View>

            {/* 1. ORDERS TAB */}
            {activeTab === 'orders' && (
                <View>
                    {/* Create New IPD Order Card */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>➕ Create Inpatient Clinical Order</Text>

                        {/* Admission Reason Selector */}
                        <Text style={styles.inputLabel}>Reason for Admission / Order</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                            {ADMISSION_REASONS.map(r => (
                                <TouchableOpacity
                                    key={r}
                                    style={[styles.reasonChip, admissionReason === r && styles.reasonChipActive]}
                                    onPress={() => setAdmissionReason(r)}
                                >
                                    <Text style={[styles.reasonChipText, admissionReason === r && styles.reasonChipTextActive]}>{r}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.inputLabel}>Primary Diagnosis</Text>
                        <TextInput
                            style={styles.textInput}
                            value={diagnosis}
                            onChangeText={setDiagnosis}
                            placeholder="e.g. Acute Appendicitis, Severe Pneumonia"
                        />

                        <Text style={styles.inputLabel}>Clinical & Diet Orders / General Nursing Instructions</Text>
                        <TextInput
                            style={[styles.textInput, styles.textArea]}
                            value={clinicalNotes}
                            onChangeText={setClinicalNotes}
                            placeholder="e.g. NPO from midnight, High protein diabetic diet, Elevate head of bed 30 degrees"
                            multiline
                            numberOfLines={3}
                        />

                        <Text style={styles.inputLabel}>Laboratory & Radiology / Imaging Orders</Text>
                        <TextInput
                            style={[styles.textInput, styles.textArea]}
                            value={investigationNotes}
                            onChangeText={setInvestigationNotes}
                            placeholder="e.g. CBC, Serum Electrolytes stat, Chest X-Ray portable"
                            multiline
                            numberOfLines={2}
                        />

                        <Text style={styles.inputLabel}>Nursing Care & Procedure Orders</Text>
                        <TextInput
                            style={[styles.textInput, styles.textArea]}
                            value={procedureNotes}
                            onChangeText={setProcedureNotes}
                            placeholder="e.g. Foley catheter insertion, Strict I/O charting Q2H, Wound dressing OD"
                            multiline
                            numberOfLines={2}
                        />

                        {/* Inpatient Medication Orders Section */}
                        <View style={styles.medSectionHeader}>
                            <Text style={styles.medSectionTitle}>💊 Inpatient Medication Orders (MAR)</Text>
                            <TouchableOpacity style={styles.addMedBtn} onPress={handleAddMedRow}>
                                <Text style={styles.addMedBtnText}>+ Add Medication</Text>
                            </TouchableOpacity>
                        </View>

                        {medicationRows.map((med, idx) => (
                            <View key={idx} style={styles.medRowCard}>
                                <View style={styles.medRowTop}>
                                    <Text style={styles.medRowIndex}>Item #{idx + 1}</Text>
                                    {medicationRows.length > 1 && (
                                        <TouchableOpacity onPress={() => handleRemoveMedRow(idx)}>
                                            <Text style={styles.deleteMedText}>✕ Remove</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <TextInput
                                    style={styles.textInput}
                                    value={med.medicineName}
                                    onChangeText={v => handleMedChange(idx, 'medicineName', v)}
                                    placeholder="Medicine Name (e.g. Inj. Ceftriaxone 1g)"
                                />

                                <View style={styles.multiColRow}>
                                    <View style={{ flex: 1, marginRight: 6 }}>
                                        <TextInput
                                            style={styles.textInput}
                                            value={med.dosageValue}
                                            onChangeText={v => handleMedChange(idx, 'dosageValue', v)}
                                            placeholder="Dose (e.g. 500)"
                                        />
                                    </View>
                                    <View style={{ flex: 1, marginRight: 6 }}>
                                        <TextInput
                                            style={styles.textInput}
                                            value={med.route}
                                            onChangeText={v => handleMedChange(idx, 'route', v)}
                                            placeholder="Route (IV/Oral)"
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <TextInput
                                            style={styles.textInput}
                                            value={med.frequency}
                                            onChangeText={v => handleMedChange(idx, 'frequency', v)}
                                            placeholder="Freq (BD/TDS)"
                                        />
                                    </View>
                                </View>

                                <View style={styles.multiColRow}>
                                    <View style={{ flex: 1, marginRight: 6 }}>
                                        <TextInput
                                            style={styles.textInput}
                                            value={med.duration}
                                            onChangeText={v => handleMedChange(idx, 'duration', v)}
                                            placeholder="Duration (3 days)"
                                        />
                                    </View>
                                    <View style={{ flex: 2 }}>
                                        <TextInput
                                            style={styles.textInput}
                                            value={med.instructions}
                                            onChangeText={v => handleMedChange(idx, 'instructions', v)}
                                            placeholder="Timing / Instructions"
                                        />
                                    </View>
                                </View>
                            </View>
                        ))}

                        <TouchableOpacity
                            style={[styles.submitOrderBtn, submitting && { opacity: 0.6 }]}
                            onPress={handleSubmitOrder}
                            disabled={submitting}
                        >
                            <Text style={styles.submitOrderBtnText}>
                                {submitting ? 'Submitting Order...' : '🚀 Submit Clinical IPD Order'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Existing Orders List Card */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>📋 Active & Past IPD Orders ({existingOrders.length})</Text>
                        {loadingOrders ? (
                            <ActivityIndicator size="small" color="#2563eb" style={{ padding: 20 }} />
                        ) : existingOrders.length === 0 ? (
                            <Text style={styles.emptyText}>No IPD clinical orders recorded yet.</Text>
                        ) : (
                            existingOrders.map((order, idx) => {
                                const isCancelled = order.status === 'CANCELLED';
                                return (
                                    <View key={order._id || idx} style={[styles.orderItemCard, isCancelled && styles.orderItemCancelled]}>
                                        <View style={styles.orderItemHeader}>
                                            <View>
                                                <Text style={styles.orderDate}>{new Date(order.createdAt || Date.now()).toLocaleString('en-IN')}</Text>
                                                <Text style={styles.orderDoctor}>Ordered by: {order.doctorName || 'Attending Physician'}</Text>
                                            </View>
                                            <View style={[styles.orderStatusBadge, isCancelled ? styles.statusBadgeCancelled : styles.statusBadgeActive]}>
                                                <Text style={[styles.orderStatusBadgeText, isCancelled ? styles.statusBadgeTextCancelled : styles.statusBadgeTextActive]}>
                                                    {order.status || 'ACTIVE'}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text style={styles.orderDiagnosis}><Text style={{ fontWeight: '700' }}>Diagnosis: </Text>{order.diagnosis || 'General'}</Text>
                                        {order.admissionReason && (
                                            <Text style={styles.orderReason}><Text style={{ fontWeight: '700' }}>Reason: </Text>{order.admissionReason}</Text>
                                        )}

                                        {order.clinicalNotes ? (
                                            <Text style={styles.orderNote}><Text style={{ fontWeight: '700' }}>Clinical/Diet: </Text>{order.clinicalNotes}</Text>
                                        ) : null}

                                        {order.investigationNotes ? (
                                            <Text style={styles.orderNote}><Text style={{ fontWeight: '700' }}>Investigations: </Text>{order.investigationNotes}</Text>
                                        ) : null}

                                        {order.medications && order.medications.length > 0 && (
                                            <View style={styles.orderMedsBox}>
                                                <Text style={styles.orderMedsTitle}>Medications:</Text>
                                                {order.medications.map((m, mIdx) => (
                                                    <Text key={mIdx} style={styles.orderMedLine}>
                                                        • {m.medicineName} — {m.dosage} ({m.route}, {m.frequency}) for {m.duration}
                                                    </Text>
                                                ))}
                                            </View>
                                        )}

                                        {!isCancelled && (
                                            <TouchableOpacity
                                                style={styles.cancelOrderActionBtn}
                                                onPress={() => setOrderToCancel(order)}
                                            >
                                                <Text style={styles.cancelOrderActionBtnText}>✕ Cancel Order</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })
                        )}
                    </View>
                </View>
            )}

            {/* 2. CLARIFICATIONS TAB */}
            {activeTab === 'clarifications' && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>💬 Nursing Clarification Requests</Text>
                    {loadingClarifications ? (
                        <ActivityIndicator size="small" color="#2563eb" style={{ padding: 20 }} />
                    ) : clarifications.length === 0 ? (
                        <Text style={styles.emptyText}>No pending clarification requests from nursing staff.</Text>
                    ) : (
                        clarifications.map((item, idx) => (
                            <View key={item._id || idx} style={styles.clarificationCard}>
                                <View style={styles.clarificationHeader}>
                                    <Text style={styles.clarificationNurse}>Nurse: {item.nurseName || 'Floor Nurse'}</Text>
                                    <Text style={styles.clarificationDate}>{new Date(item.createdAt).toLocaleDateString('en-IN')}</Text>
                                </View>
                                <Text style={styles.clarificationQuestion}><Text style={{ fontWeight: '700' }}>Query: </Text>{item.question || item.notes}</Text>

                                {item.doctorResponse ? (
                                    <View style={styles.clarificationResponseBox}>
                                        <Text style={styles.clarificationResponseTitle}>Doctor Response:</Text>
                                        <Text style={styles.clarificationResponseText}>{item.doctorResponse}</Text>
                                    </View>
                                ) : activeClarificationId === item._id ? (
                                    <View style={{ marginTop: 10 }}>
                                        <TextInput
                                            style={[styles.textInput, styles.textArea]}
                                            value={doctorResponseText}
                                            onChangeText={setDoctorResponseText}
                                            placeholder="Type your clarification instructions here..."
                                            multiline
                                            numberOfLines={3}
                                        />
                                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                                            <TouchableOpacity
                                                style={styles.cancelModalBtn}
                                                onPress={() => { setActiveClarificationId(null); setDoctorResponseText(''); }}
                                            >
                                                <Text style={styles.cancelModalBtnText}>Cancel</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.saveModalBtn}
                                                onPress={() => handleRespondClarification(item)}
                                                disabled={submittingResponse}
                                            >
                                                <Text style={styles.saveModalBtnText}>
                                                    {submittingResponse ? 'Sending...' : 'Send Response'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.respondBtn}
                                        onPress={() => { setActiveClarificationId(item._id); setDoctorResponseText(''); }}
                                    >
                                        <Text style={styles.respondBtnText}>✏️ Respond to Nurse</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))
                    )}
                </View>
            )}

            {/* 3. DISCHARGE SUMMARY TAB */}
            {activeTab === 'discharge' && (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🏁 Clinical Discharge Summary & Order</Text>

                    <Text style={styles.inputLabel}>Condition at Discharge</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                        {DISCHARGE_CONDITIONS.map(c => (
                            <TouchableOpacity
                                key={c}
                                style={[styles.reasonChip, dischargeSummary.conditionAtDischarge === c && styles.reasonChipActive]}
                                onPress={() => setDischargeSummary(prev => ({ ...prev, conditionAtDischarge: c }))}
                            >
                                <Text style={[styles.reasonChipText, dischargeSummary.conditionAtDischarge === c && styles.reasonChipTextActive]}>{c}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <Text style={styles.inputLabel}>Hospital Course Summary</Text>
                    <TextInput
                        style={[styles.textInput, styles.textArea]}
                        value={dischargeSummary.hospitalCourse}
                        onChangeText={v => setDischargeSummary(prev => ({ ...prev, hospitalCourse: v }))}
                        placeholder="Describe course in hospital, clinical improvements, and procedures performed"
                        multiline
                        numberOfLines={3}
                    />

                    <Text style={styles.inputLabel}>Treatment Given & Investigations Summary</Text>
                    <TextInput
                        style={[styles.textInput, styles.textArea]}
                        value={dischargeSummary.treatmentSummary}
                        onChangeText={v => setDischargeSummary(prev => ({ ...prev, treatmentSummary: v }))}
                        placeholder="Key treatments given, antibiotics course, and diagnostic findings"
                        multiline
                        numberOfLines={3}
                    />

                    <Text style={styles.inputLabel}>Follow-up Instructions & Date</Text>
                    <TextInput
                        style={styles.textInput}
                        value={dischargeSummary.followUpInstructions}
                        onChangeText={v => setDischargeSummary(prev => ({ ...prev, followUpInstructions: v }))}
                        placeholder="e.g. Return in 7 days for suture removal, review in OPD"
                    />

                    <View style={styles.dischargeActionsRow}>
                        <TouchableOpacity
                            style={[styles.saveDraftBtn, savingSummary && { opacity: 0.6 }]}
                            onPress={() => handleSaveDischargeSummary(false)}
                            disabled={savingSummary}
                        >
                            <Text style={styles.saveDraftBtnText}>💾 Save Draft</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.finalizeBtn, savingSummary && { opacity: 0.6 }]}
                            onPress={() => handleSaveDischargeSummary(true)}
                            disabled={savingSummary}
                        >
                            <Text style={styles.finalizeBtnText}>✅ Sign & Finalize Discharge Order</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Cancel Order Modal */}
            <Modal visible={!!orderToCancel} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Cancel IPD Order</Text>
                        <Text style={styles.inputLabel}>Reason for Cancellation</Text>
                        <TextInput
                            style={[styles.textInput, styles.textArea]}
                            value={cancelReason}
                            onChangeText={setCancelReason}
                            placeholder="e.g. Patient condition changed, order revised"
                            multiline
                            numberOfLines={2}
                        />
                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setOrderToCancel(null)}>
                                <Text style={styles.cancelModalBtnText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveModalBtn, { backgroundColor: '#ef4444' }]}
                                onPress={handleConfirmCancelOrder}
                                disabled={cancelling}
                            >
                                <Text style={styles.saveModalBtnText}>{cancelling ? 'Cancelling...' : 'Confirm Cancellation'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    admissionBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eff6ff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', marginBottom: 14 },
    bannerLeft: { flex: 1, marginRight: 10 },
    bannerTitle: { fontSize: 14, fontWeight: '800', color: '#1e3a8a', marginBottom: 4 },
    admissionStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    admittedBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    admittedBadgeText: { fontSize: 10, fontWeight: '800', color: '#15803d' },
    admissionDetailsText: { fontSize: 12, color: '#1e40af', fontWeight: '600' },
    notAdmittedText: { fontSize: 12, color: '#b45309', fontWeight: '600' },
    refreshBtn: { backgroundColor: '#ffffff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe' },
    refreshBtnText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },

    subTabNav: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 10, padding: 4, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
    subTabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    subTabBtnActive: { backgroundColor: '#2563eb' },
    subTabBtnText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
    subTabBtnTextActive: { color: '#ffffff' },

    card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' },
    cardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
    inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4, marginTop: 8 },
    textInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#0f172a', backgroundColor: '#f8fafc', marginBottom: 6 },
    textArea: { height: 60, textAlignVertical: 'top' },

    chipsScroll: { flexDirection: 'row', marginBottom: 10 },
    reasonChip: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 8, borderWidth: 1, borderColor: '#cbd5e1' },
    reasonChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    reasonChipText: { fontSize: 11, color: '#475569', fontWeight: '600' },
    reasonChipTextActive: { color: '#ffffff', fontWeight: '700' },

    medSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 },
    medSectionTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
    addMedBtn: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#bfdbfe' },
    addMedBtnText: { fontSize: 11, fontWeight: '700', color: '#2563eb' },

    medRowCard: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    medRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    medRowIndex: { fontSize: 11, fontWeight: '800', color: '#475569' },
    deleteMedText: { fontSize: 11, color: '#ef4444', fontWeight: '700' },
    multiColRow: { flexDirection: 'row', marginBottom: 4 },

    submitOrderBtn: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 14 },
    submitOrderBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },

    emptyText: { color: '#94a3b8', fontSize: 13, fontStyle: 'italic', paddingVertical: 10 },
    orderItemCard: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    orderItemCancelled: { opacity: 0.6, borderColor: '#fca5a5' },
    orderItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    orderDate: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    orderDoctor: { fontSize: 12, fontWeight: '700', color: '#0f172a', marginTop: 2 },
    orderStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    statusBadgeActive: { backgroundColor: '#dcfce7' },
    statusBadgeCancelled: { backgroundColor: '#fee2e2' },
    orderStatusBadgeText: { fontSize: 10, fontWeight: '800' },
    statusBadgeTextActive: { color: '#15803d' },
    statusBadgeTextCancelled: { color: '#b91c1c' },
    orderDiagnosis: { fontSize: 13, color: '#1e293b', marginBottom: 4 },
    orderReason: { fontSize: 12, color: '#475569', marginBottom: 4 },
    orderNote: { fontSize: 12, color: '#334155', marginBottom: 4 },
    orderMedsBox: { backgroundColor: '#ffffff', padding: 8, borderRadius: 6, marginTop: 6, borderWidth: 1, borderColor: '#e2e8f0' },
    orderMedsTitle: { fontSize: 11, fontWeight: '800', color: '#475569', marginBottom: 4 },
    orderMedLine: { fontSize: 12, color: '#0f172a', marginBottom: 2 },
    cancelOrderActionBtn: { alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, backgroundColor: '#fee2e2' },
    cancelOrderActionBtnText: { color: '#b91c1c', fontSize: 11, fontWeight: '700' },

    clarificationCard: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    clarificationHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    clarificationNurse: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
    clarificationDate: { fontSize: 11, color: '#64748b' },
    clarificationQuestion: { fontSize: 13, color: '#1e293b', marginTop: 4 },
    clarificationResponseBox: { backgroundColor: '#ecfdf5', padding: 8, borderRadius: 6, marginTop: 8, borderWidth: 1, borderColor: '#a7f3d0' },
    clarificationResponseTitle: { fontSize: 11, fontWeight: '800', color: '#065f46', marginBottom: 2 },
    clarificationResponseText: { fontSize: 12, color: '#047857' },
    respondBtn: { alignSelf: 'flex-start', backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginTop: 8, borderWidth: 1, borderColor: '#bfdbfe' },
    respondBtnText: { fontSize: 12, fontWeight: '700', color: '#2563eb' },

    dischargeActionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    saveDraftBtn: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
    saveDraftBtnText: { color: '#475569', fontWeight: '700', fontSize: 13 },
    finalizeBtn: { flex: 2, backgroundColor: '#16a34a', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
    finalizeBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16 },
    modalTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
    modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    cancelModalBtn: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    cancelModalBtnText: { color: '#475569', fontWeight: '700', fontSize: 13 },
    saveModalBtn: { flex: 1, backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    saveModalBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 }
});

export default DoctorIPDOrdersPanel;
