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
    Dimensions
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { freeOpdAPI } from '../../utils/api';
import { useAuth } from '../../store/hooks';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DoctorPatientTray = () => {
    const { user } = useAuth();
    const [trayData, setTrayData] = useState({
        todayAppointments: [],
        waiting: [],
        inConsultation: [],
        completed: [],
        summary: { total: 0, waitingCount: 0, inConsultationCount: 0, completedCount: 0 }
    });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Active Consultation Workspace state
    const [activeAppt, setActiveAppt] = useState(null);
    const [consultForm, setConsultForm] = useState({
        diagnosis: '',
        vitals: { bp: '', pulse: '', temp: '', weight: '', spo2: '' },
        medicines: [
            { medicineName: '', dosage: '1 tab', frequency: '1-0-1', duration: '5 days', instructions: 'After meal' }
        ],
        doctorNotes: '',
        followUpDate: ''
    });

    const loadTray = useCallback(async () => {
        setLoading(true);
        try {
            const res = await freeOpdAPI.getTodayTray();
            if (res && res.success) {
                setTrayData(res);
                if (res.inConsultation?.length > 0) {
                    const first = res.inConsultation[0];
                    setActiveAppt(first);
                    setConsultForm({
                        diagnosis: first.diagnosis || '',
                        vitals: first.vitals || { bp: '', pulse: '', temp: '', weight: '', spo2: '' },
                        medicines: first.pharmacy?.length > 0
                            ? first.pharmacy
                            : [{ medicineName: '', dosage: '1 tab', frequency: '1-0-1', duration: '5 days', instructions: 'After meal' }],
                        doctorNotes: first.doctorNotes || first.notes || '',
                        followUpDate: first.followUpDate ? first.followUpDate.split('T')[0] : ''
                    });
                } else {
                    setActiveAppt(null);
                }
            }
        } catch (err) {
            console.error('Error fetching today patient tray:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTray();
    }, [loadTray]);

    const handleStartConsultation = async (appt) => {
        setActionLoading(true);
        try {
            const res = await freeOpdAPI.startConsultation(appt._id);
            if (res && res.success) {
                setActiveAppt(appt);
                setConsultForm({
                    diagnosis: appt.diagnosis || '',
                    vitals: appt.vitals || { bp: '', pulse: '', temp: '', weight: '', spo2: '' },
                    medicines: appt.pharmacy?.length > 0
                        ? appt.pharmacy
                        : [{ medicineName: '', dosage: '1 tab', frequency: '1-0-1', duration: '5 days', instructions: 'After meal' }],
                    doctorNotes: appt.doctorNotes || '',
                    followUpDate: appt.followUpDate ? appt.followUpDate.split('T')[0] : ''
                });
                loadTray();
            }
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to start consultation.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddMedicineRow = () => {
        setConsultForm(p => ({
            ...p,
            medicines: [
                ...p.medicines,
                { medicineName: '', dosage: '1 tab', frequency: '1-0-1', duration: '5 days', instructions: 'After meal' }
            ]
        }));
    };

    const handleRemoveMedicineRow = (idx) => {
        setConsultForm(p => ({
            ...p,
            medicines: p.medicines.filter((_, i) => i !== idx)
        }));
    };

    const handleMedicineChange = (idx, field, val) => {
        setConsultForm(p => {
            const list = [...p.medicines];
            list[idx] = { ...list[idx], [field]: val };
            return { ...p, medicines: list };
        });
    };

    const handleCompleteConsultation = async () => {
        if (!activeAppt) return;
        if (!consultForm.diagnosis.trim()) {
            Alert.alert('Validation', 'Please enter a diagnosis before completing consultation.');
            return;
        }

        setActionLoading(true);
        try {
            const validMeds = consultForm.medicines.filter(m => m.medicineName && m.medicineName.trim());
            const payload = {
                diagnosis: consultForm.diagnosis.trim(),
                vitals: consultForm.vitals,
                pharmacy: validMeds,
                doctorNotes: consultForm.doctorNotes.trim(),
                followUpDate: consultForm.followUpDate || null
            };

            await freeOpdAPI.completeConsultation(activeAppt._id, payload);
            Alert.alert('Success', 'Consultation marked as completed.');
            setActiveAppt(null);
            loadTray();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to complete consultation.');
        } finally {
            setActionLoading(false);
        }
    };

    const handlePrintPrescription = async (appt) => {
        try {
            const pt = appt.patientId || {};
            const meds = appt.pharmacy || [];
            const medsHtml = meds.map(m => `
                <tr>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold;">${m.medicineName}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${m.dosage}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${m.frequency}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${m.duration}</td>
                    <td style="padding: 6px; border: 1px solid #cbd5e1;">${m.instructions}</td>
                </tr>
            `).join('');

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>OPD Prescription</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 20px; color: #0f172a; font-size: 12px; }
                        .hdr { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 8px; margin-bottom: 12px; }
                        .doc-name { font-size: 18px; font-weight: 800; color: #0f172a; }
                        .pt-box { background: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 15px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                        th { background: #0d9488; color: #ffffff; padding: 6px; text-align: center; border: 1px solid #0f766e; }
                    </style>
                </head>
                <body>
                    <div class="hdr">
                        <div class="doc-name">Dr. ${user?.name || 'Doctor'}</div>
                        <div style="color: #64748b; font-size: 11px;">OPD Clinical Prescription</div>
                    </div>
                    <div class="pt-box">
                        <div><strong>Patient:</strong> ${pt.name || 'Patient'} (${pt.age ? pt.age + 'y' : '—'}/${pt.gender || '—'})</div>
                        <div><strong>Date:</strong> ${new Date(appt.appointmentDate || Date.now()).toLocaleDateString('en-GB')}</div>
                        <div><strong>Diagnosis:</strong> ${appt.diagnosis || 'Clinical evaluation'}</div>
                    </div>
                    <div><strong>Rx — Prescribed Medicines:</strong></div>
                    <table>
                        <thead>
                            <tr>
                                <th>Medicine Name</th>
                                <th>Dosage</th>
                                <th>Frequency</th>
                                <th>Duration</th>
                                <th>Instructions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${medsHtml || '<tr><td colspan="5" style="text-align: center; padding: 10px;">No medicines prescribed</td></tr>'}
                        </tbody>
                    </table>
                    ${appt.doctorNotes ? `<div style="margin-top: 15px;"><strong>Advice / Notes:</strong> ${appt.doctorNotes}</div>` : ''}
                    ${appt.followUpDate ? `<div style="margin-top: 8px;"><strong>Follow-up Date:</strong> ${new Date(appt.followUpDate).toLocaleDateString('en-GB')}</div>` : ''}
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to generate prescription PDF.');
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            {/* Header & Metric Summary */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.pageTitle}>Doctor Patient Tray</Text>
                    <Text style={styles.pageSub}>Today's OPD Consultation Queue &amp; Prescription Desk</Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={loadTray}>
                    <Feather name="refresh-cw" size={16} color="#0d9488" />
                </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderLeftColor: '#3b82f6' }]}>
                    <Text style={styles.statNum}>{trayData.summary?.total || 0}</Text>
                    <Text style={styles.statLabel}>Total Today</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
                    <Text style={styles.statNum}>{trayData.summary?.waitingCount || 0}</Text>
                    <Text style={styles.statLabel}>Waiting</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#0d9488' }]}>
                    <Text style={styles.statNum}>{trayData.summary?.inConsultationCount || 0}</Text>
                    <Text style={styles.statLabel}>In Consultation</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}>
                    <Text style={styles.statNum}>{trayData.summary?.completedCount || 0}</Text>
                    <Text style={styles.statLabel}>Completed</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centerLoading}>
                    <ActivityIndicator size="large" color="#0d9488" />
                    <Text style={styles.loadingText}>Loading today's tray...</Text>
                </View>
            ) : (
                <View>
                    {/* Active Consultation Desk (If any) */}
                    {activeAppt ? (
                        <View style={styles.activeDeskCard}>
                            <View style={styles.activeDeskHeader}>
                                <View>
                                    <View style={styles.inConsulBadge}>
                                        <Text style={styles.inConsulBadgeText}>CURRENTLY CONSULTING</Text>
                                    </View>
                                    <Text style={styles.activePtName}>{activeAppt.patientId?.name || 'Inpatient'}</Text>
                                    <Text style={styles.activePtMeta}>
                                        Token #{activeAppt.tokenNumber || '—'} • {activeAppt.patientId?.age ? `${activeAppt.patientId?.age} yrs` : ''} • {activeAppt.patientId?.gender || ''} • {activeAppt.patientId?.phone || ''}
                                    </Text>
                                </View>
                            </View>

                            {/* Vitals Input Strip */}
                            <Text style={styles.sectionLabel}>Patient Vitals</Text>
                            <View style={styles.vitalsRow}>
                                <View style={styles.vitalCol}>
                                    <Text style={styles.vitalSub}>BP</Text>
                                    <TextInput
                                        style={styles.vitalInput}
                                        placeholder="120/80"
                                        value={consultForm.vitals.bp}
                                        onChangeText={v => setConsultForm(p => ({ ...p, vitals: { ...p.vitals, bp: v } }))}
                                    />
                                </View>
                                <View style={styles.vitalCol}>
                                    <Text style={styles.vitalSub}>Pulse</Text>
                                    <TextInput
                                        style={styles.vitalInput}
                                        placeholder="72"
                                        keyboardType="numeric"
                                        value={consultForm.vitals.pulse}
                                        onChangeText={v => setConsultForm(p => ({ ...p, vitals: { ...p.vitals, pulse: v } }))}
                                    />
                                </View>
                                <View style={styles.vitalCol}>
                                    <Text style={styles.vitalSub}>Temp</Text>
                                    <TextInput
                                        style={styles.vitalInput}
                                        placeholder="98.6"
                                        value={consultForm.vitals.temp}
                                        onChangeText={v => setConsultForm(p => ({ ...p, vitals: { ...p.vitals, temp: v } }))}
                                    />
                                </View>
                                <View style={styles.vitalCol}>
                                    <Text style={styles.vitalSub}>Weight</Text>
                                    <TextInput
                                        style={styles.vitalInput}
                                        placeholder="65 kg"
                                        value={consultForm.vitals.weight}
                                        onChangeText={v => setConsultForm(p => ({ ...p, vitals: { ...p.vitals, weight: v } }))}
                                    />
                                </View>
                            </View>

                            {/* Diagnosis */}
                            <Text style={styles.sectionLabel}>Clinical Diagnosis *</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Enter diagnosis (e.g. Acute Bronchitis, Type 2 DM)..."
                                value={consultForm.diagnosis}
                                onChangeText={v => setConsultForm(p => ({ ...p, diagnosis: v }))}
                            />

                            {/* Prescriptions */}
                            <View style={styles.medHeaderRow}>
                                <Text style={styles.sectionLabel}>Prescription (Rx)</Text>
                                <TouchableOpacity style={styles.addMedBtn} onPress={handleAddMedicineRow}>
                                    <Feather name="plus" size={13} color="#0d9488" />
                                    <Text style={styles.addMedBtnText}>Add Medicine</Text>
                                </TouchableOpacity>
                            </View>

                            {consultForm.medicines.map((med, idx) => (
                                <View key={idx} style={styles.medRowCard}>
                                    <View style={styles.medTopRow}>
                                        <TextInput
                                            style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                                            placeholder="Medicine Name (e.g. Paracetamol 500mg)"
                                            value={med.medicineName}
                                            onChangeText={v => handleMedicineChange(idx, 'medicineName', v)}
                                        />
                                        {consultForm.medicines.length > 1 && (
                                            <TouchableOpacity onPress={() => handleRemoveMedicineRow(idx)} style={styles.delBtn}>
                                                <Feather name="trash-2" size={15} color="#ef4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <View style={styles.medDetailsRow}>
                                        <TextInput
                                            style={styles.medSubInput}
                                            placeholder="Dosage (1 tab)"
                                            value={med.dosage}
                                            onChangeText={v => handleMedicineChange(idx, 'dosage', v)}
                                        />
                                        <TextInput
                                            style={styles.medSubInput}
                                            placeholder="Freq (1-0-1)"
                                            value={med.frequency}
                                            onChangeText={v => handleMedicineChange(idx, 'frequency', v)}
                                        />
                                        <TextInput
                                            style={styles.medSubInput}
                                            placeholder="Duration (5 days)"
                                            value={med.duration}
                                            onChangeText={v => handleMedicineChange(idx, 'duration', v)}
                                        />
                                    </View>
                                </View>
                            ))}

                            {/* Doctor Notes & Follow up */}
                            <Text style={styles.sectionLabel}>Doctor Notes &amp; Advice</Text>
                            <TextInput
                                style={[styles.textInput, { minHeight: 60 }]}
                                multiline
                                placeholder="Diet advice, precautions, lifestyle recommendations..."
                                value={consultForm.doctorNotes}
                                onChangeText={v => setConsultForm(p => ({ ...p, doctorNotes: v }))}
                            />

                            <Text style={styles.sectionLabel}>Follow-up Date (Optional)</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="YYYY-MM-DD"
                                value={consultForm.followUpDate}
                                onChangeText={v => setConsultForm(p => ({ ...p, followUpDate: v }))}
                            />

                            <TouchableOpacity
                                style={[styles.completeBtn, actionLoading && styles.completeBtnDisabled]}
                                onPress={handleCompleteConsultation}
                                disabled={actionLoading}
                            >
                                {actionLoading ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <>
                                        <Feather name="check-circle" size={16} color="#ffffff" />
                                        <Text style={styles.completeBtnText}>Complete &amp; Issue Prescription</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {/* Waiting Patients List */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Waiting Queue ({trayData.waiting?.length || 0})</Text>
                        {(trayData.waiting || []).length === 0 ? (
                            <Text style={styles.emptyNotice}>No patients waiting in queue.</Text>
                        ) : (
                            trayData.waiting.map(appt => (
                                <View key={appt._id} style={styles.queueItem}>
                                    <View style={styles.tokenPill}>
                                        <Text style={styles.tokenPillText}>#{appt.tokenNumber || '—'}</Text>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.queuePtName}>{appt.patientId?.name || 'Inpatient'}</Text>
                                        <Text style={styles.queuePtSub}>
                                            {appt.patientId?.age ? `${appt.patientId.age} yrs • ` : ''}{appt.patientId?.gender || ''} • Time: {appt.timeSlot || 'Now'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.startBtn}
                                        onPress={() => handleStartConsultation(appt)}
                                        disabled={actionLoading}
                                    >
                                        <Feather name="play" size={13} color="#ffffff" />
                                        <Text style={styles.startBtnText}>Start</Text>
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </View>

                    {/* Completed Consultations */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Completed Today ({trayData.completed?.length || 0})</Text>
                        {(trayData.completed || []).length === 0 ? (
                            <Text style={styles.emptyNotice}>No completed consultations yet today.</Text>
                        ) : (
                            trayData.completed.map(appt => (
                                <View key={appt._id} style={styles.queueItem}>
                                    <View style={[styles.tokenPill, { backgroundColor: '#ccfbf1' }]}>
                                        <Text style={[styles.tokenPillText, { color: '#0f766e' }]}>#{appt.tokenNumber || '—'}</Text>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.queuePtName}>{appt.patientId?.name || 'Inpatient'}</Text>
                                        <Text style={styles.queuePtSub}>
                                            Diagnosis: {appt.diagnosis || 'Completed'} • Prescribed: {appt.pharmacy?.length || 0} meds
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.printPrescriptionBtn}
                                        onPress={() => handlePrintPrescription(appt)}
                                    >
                                        <Feather name="printer" size={13} color="#0d9488" />
                                        <Text style={styles.printPrescriptionBtnText}>Print</Text>
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </View>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    pageTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
    },
    pageSub: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    refreshBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderLeftWidth: 4,
    },
    statNum: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    statLabel: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 2,
    },
    centerLoading: {
        paddingVertical: 48,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 8,
        fontSize: 13,
        color: '#64748b',
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 14,
        marginBottom: 14,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 10,
    },
    emptyNotice: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        paddingVertical: 14,
    },
    queueItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    tokenPill: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#fef3c7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tokenPillText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#b45309',
    },
    queuePtName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    queuePtSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    startBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#0d9488',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    startBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    printPrescriptionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#f0fdfa',
        borderWidth: 1,
        borderColor: '#99f6e4',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    printPrescriptionBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0d9488',
    },
    activeDeskCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#0d9488',
        padding: 16,
        marginBottom: 16,
    },
    activeDeskHeader: {
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    inConsulBadge: {
        backgroundColor: '#0d9488',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        alignSelf: 'flex-start',
        marginBottom: 6,
    },
    inConsulBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#ffffff',
    },
    activePtName: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0f172a',
    },
    activePtMeta: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
        marginTop: 8,
    },
    vitalsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    vitalCol: {
        flex: 1,
    },
    vitalSub: {
        fontSize: 10,
        color: '#64748b',
        marginBottom: 2,
    },
    vitalInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        padding: 6,
        fontSize: 12,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
        textAlign: 'center',
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        padding: 10,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
        marginBottom: 10,
    },
    medHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 6,
    },
    addMedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    addMedBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0d9488',
    },
    medRowCard: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 8,
        marginBottom: 8,
    },
    medTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    delBtn: {
        padding: 6,
    },
    medDetailsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    medSubInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        padding: 6,
        fontSize: 11,
        color: '#0f172a',
        backgroundColor: '#ffffff',
    },
    completeBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#0d9488',
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 14,
    },
    completeBtnDisabled: {
        backgroundColor: '#94a3b8',
    },
    completeBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
});

export default DoctorPatientTray;

