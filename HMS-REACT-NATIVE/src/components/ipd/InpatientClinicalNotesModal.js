import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ipdClinicalAPI } from '../../utils/api';
import { useAuth } from '../../store/hooks';
import { useBranding } from '../../context/BrandingContext';

const InpatientClinicalNotesModal = ({
    visible,
    onClose,
    admissionId,
    patient,
    admission
}) => {
    const { user } = useAuth();
    const { branding } = useBranding();

    const [activePage, setActivePage] = useState(1); // 1 = Page 1, 2 = Page 2
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [downloading, setDownloading] = useState(false);

    // Page 1 State
    const [historyAndComplaints, setHistoryAndComplaints] = useState('');
    const [relevantPhysicalExamination, setRelevantPhysicalExamination] = useState('');
    const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState('');
    const [pastMedicalSurgicalHistory, setPastMedicalSurgicalHistory] = useState('');
    const [personalSocialHistory, setPersonalSocialHistory] = useState('');
    const [anyDrugAllergy, setAnyDrugAllergy] = useState('');

    // Page 2 State
    const [bp, setBp] = useState('');
    const [temp, setTemp] = useState('');
    const [pulse, setPulse] = useState('');
    const [spo2, setSpo2] = useState('');
    const [pallor, setPallor] = useState('');
    const [pain, setPain] = useState('');
    const [systemicExamination, setSystemicExamination] = useState('');
    const [provisionalDiagnosis, setProvisionalDiagnosis] = useState('');
    const [investigations, setInvestigations] = useState('');
    const [dischargeAndFollowUp, setDischargeAndFollowUp] = useState('');

    // Sign-off
    const [consultantName, setConsultantName] = useState('');
    const [signDate, setSignDate] = useState('');

    const loadNote = useCallback(async () => {
        if (!admissionId) return;
        setLoading(true);
        try {
            const res = await ipdClinicalAPI.getInpatientClinicalNotes(admissionId);
            const doc = res?.note || res?.data || {};

            setHistoryAndComplaints(doc.historyAndComplaints || '');
            setRelevantPhysicalExamination(doc.relevantPhysicalExamination || '');
            setHistoryOfPresentIllness(doc.historyOfPresentIllness || '');
            setPastMedicalSurgicalHistory(doc.pastMedicalSurgicalHistory || '');
            setPersonalSocialHistory(doc.personalSocialHistory || '');
            setAnyDrugAllergy(doc.anyDrugAllergy || '');

            const ge = doc.generalExamination || {};
            setBp(ge.bp || '');
            setTemp(ge.temp || '');
            setPulse(ge.pulse || '');
            setSpo2(ge.spo2 || '');
            setPallor(ge.pallor || '');
            setPain(ge.pain || '');

            setSystemicExamination(doc.systemicExamination || '');
            setProvisionalDiagnosis(doc.provisionalDiagnosis || '');
            setInvestigations(doc.investigations || '');
            setDischargeAndFollowUp(doc.dischargeAndFollowUp || '');

            const foot = doc.footer || {};
            setConsultantName(foot.consultantName || doc.consultantName || '');
            setSignDate(foot.signDate || '');
        } catch (err) {
            console.error('Error loading clinical note:', err);
        } finally {
            setLoading(false);
        }
    }, [admissionId]);

    useEffect(() => {
        if (visible) {
            loadNote();
        }
    }, [visible, loadNote]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                historyAndComplaints,
                relevantPhysicalExamination,
                historyOfPresentIllness,
                pastMedicalSurgicalHistory,
                personalSocialHistory,
                anyDrugAllergy,
                generalExamination: {
                    bp,
                    temp,
                    pulse,
                    spo2,
                    pallor,
                    pain
                },
                systemicExamination,
                provisionalDiagnosis,
                investigations,
                dischargeAndFollowUp,
                footer: {
                    consultantName,
                    signDate: signDate || new Date().toLocaleDateString('en-GB')
                }
            };

            await ipdClinicalAPI.saveInpatientClinicalNotes(admissionId, payload);
            Alert.alert('Success', 'In-Patient Clinical Notes saved successfully.');
        } catch (err) {
            console.error('Error saving clinical notes:', err);
            Alert.alert('Error', err?.response?.data?.message || 'Failed to save notes.');
        } finally {
            setSaving(false);
        }
    };

    const handlePrintOrPdf = async () => {
        setDownloading(true);
        try {
            const hospitalName = branding?.customHospitalName || branding?.hospitalName || 'Medical 365 Super Speciality Hospital';
            const patientName = patient?.name || admission?.patientId?.name || 'Inpatient';
            const uhid = patient?.uhid || patient?.patientId || '—';
            const ipdNo = admission?.ipdNumber || admission?.admissionId || '—';
            const age = patient?.age || '—';
            const gender = patient?.gender || '—';
            const ward = admission?.ward || 'General';
            const bed = admission?.bedNumber || '—';

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>In-Patient Clinical Notes (NABH)</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 15px; color: #0f172a; font-size: 11px; }
                        .hdr { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 6px; margin-bottom: 10px; }
                        .hosp-title { font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
                        .chart-name { font-size: 13px; font-weight: 700; color: #0d9488; margin-top: 3px; }
                        .pt-line { display: flex; justify-content: space-between; font-size: 10.5px; background: #f8fafc; padding: 6px 10px; border: 1px solid #e2e8f0; margin-bottom: 12px; }
                        .sec-box { border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 10px; overflow: hidden; }
                        .sec-hdr { background: #0d9488; color: #ffffff; font-weight: 700; padding: 5px 8px; font-size: 11px; }
                        .sec-body { padding: 8px; line-height: 1.5; min-height: 40px; }
                        .vitals-grid { display: flex; gap: 15px; padding: 6px 8px; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 11px; }
                        .page-break { page-break-after: always; }
                    </style>
                </head>
                <body>
                    <!-- Page 1 -->
                    <div class="hdr">
                        <div class="hosp-title">${hospitalName}</div>
                        <div class="chart-name">IN-PATIENT CLINICAL NOTES (PAGE 1 OF 2) — NABH AAC.2</div>
                    </div>
                    <div class="pt-line">
                        <span><strong>Patient:</strong> ${patientName} (${age}/${gender})</span>
                        <span><strong>UHID:</strong> ${uhid}</span>
                        <span><strong>IPD No:</strong> ${ipdNo}</span>
                        <span><strong>Ward/Bed:</strong> ${ward}/${bed}</span>
                    </div>
                    <div class="sec-box">
                        <div class="sec-hdr">1. CHIEF COMPLAINTS &amp; DURATION</div>
                        <div class="sec-body">${historyAndComplaints || 'Nil documented'}</div>
                    </div>
                    <div class="sec-box">
                        <div class="sec-hdr">2. HISTORY OF PRESENT ILLNESS (HOPI)</div>
                        <div class="sec-body">${historyOfPresentIllness || 'Nil documented'}</div>
                    </div>
                    <div class="sec-box">
                        <div class="sec-hdr">3. PAST MEDICAL &amp; SURGICAL HISTORY</div>
                        <div class="sec-body">${pastMedicalSurgicalHistory || 'Nil documented'}</div>
                    </div>
                    <div class="sec-box">
                        <div class="sec-hdr">4. PERSONAL &amp; SOCIAL HISTORY</div>
                        <div class="sec-body">${personalSocialHistory || 'Nil documented'}</div>
                    </div>
                    <div class="sec-box" style="border-color: #ef4444;">
                        <div class="sec-hdr" style="background: #ef4444;">5. KNOWN DRUG ALLERGIES (CRITICAL)</div>
                        <div class="sec-body" style="color: #991b1b; font-weight: bold;">${anyDrugAllergy || 'NO KNOWN DRUG ALLERGIES (NKDA)'}</div>
                    </div>

                    <div class="page-break"></div>

                    <!-- Page 2 -->
                    <div class="hdr">
                        <div class="hosp-title">${hospitalName}</div>
                        <div class="chart-name">IN-PATIENT CLINICAL NOTES (PAGE 2 OF 2) — NABH AAC.2</div>
                    </div>
                    <div class="sec-box">
                        <div class="sec-hdr">6. GENERAL PHYSICAL EXAMINATION &amp; VITALS</div>
                        <div class="vitals-grid">
                            <span><strong>BP:</strong> ${bp || '—'}</span>
                            <span><strong>Temp:</strong> ${temp ? temp + '°F' : '—'}</span>
                            <span><strong>Pulse:</strong> ${pulse ? pulse + ' bpm' : '—'}</span>
                            <span><strong>SpO2:</strong> ${spo2 ? spo2 + '%' : '—'}</span>
                            <span><strong>Pallor:</strong> ${pallor || '—'}</span>
                            <span><strong>Pain:</strong> ${pain ? pain + '/10' : '—'}</span>
                        </div>
                        <div class="sec-body">${relevantPhysicalExamination || 'Nil documented'}</div>
                    </div>
                    <div class="sec-box">
                        <div class="sec-hdr">7. SYSTEMIC EXAMINATION (CVS, RS, PA, CNS)</div>
                        <div class="sec-body">${systemicExamination || 'Nil documented'}</div>
                    </div>
                    <div class="sec-box">
                        <div class="sec-hdr">8. PROVISIONAL / ADMISSION DIAGNOSIS</div>
                        <div class="sec-body">${provisionalDiagnosis || 'Nil documented'}</div>
                    </div>
                    <div class="sec-box">
                        <div class="sec-hdr">9. PLANNED INVESTIGATIONS &amp; TREATMENT PLAN</div>
                        <div class="sec-body">${investigations || 'Nil documented'}</div>
                    </div>
                    <div class="sec-box">
                        <div class="sec-hdr">10. DISCHARGE &amp; FOLLOW-UP ADVICE</div>
                        <div class="sec-body">${dischargeAndFollowUp || 'Nil documented'}</div>
                    </div>
                    <div style="margin-top: 20px; display: flex; justify-content: flex-end; text-align: right;">
                        <div>
                            <div>_____________________________</div>
                            <div style="font-weight: bold; margin-top: 4px;">Dr. ${consultantName || 'Attending Consultant'}</div>
                            <div style="color: #64748b;">Sign &amp; Date: ${signDate || new Date().toLocaleDateString('en-GB')}</div>
                        </div>
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Alert.alert('Success', 'PDF generated successfully.');
            }
        } catch (err) {
            console.error('PDF error:', err);
            Alert.alert('Error', 'Failed to generate PDF.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.overlay}
            >
                <View style={styles.modalBox}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>2-Page In-Patient Clinical Notes</Text>
                            <Text style={styles.subtitle}>
                                Patient: {patient?.name || admission?.patientId?.name || 'Inpatient'} | IPD #{admission?.ipdNumber || '—'}
                            </Text>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity
                                style={styles.pdfBtn}
                                onPress={handlePrintOrPdf}
                                disabled={downloading}
                            >
                                {downloading ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <>
                                        <Feather name="printer" size={13} color="#ffffff" />
                                        <Text style={styles.pdfBtnText}>Print / PDF</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Feather name="x" size={20} color="#475569" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Page Tab Selector */}
                    <View style={styles.tabBar}>
                        <TouchableOpacity
                            style={[styles.tabItem, activePage === 1 && styles.tabItemActive]}
                            onPress={() => setActivePage(1)}
                        >
                            <Text style={[styles.tabText, activePage === 1 && styles.tabTextActive]}>
                                Page 1: History &amp; Allergies
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabItem, activePage === 2 && styles.tabItemActive]}
                            onPress={() => setActivePage(2)}
                        >
                            <Text style={[styles.tabText, activePage === 2 && styles.tabTextActive]}>
                                Page 2: Exam &amp; Diagnosis
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    {loading ? (
                        <View style={styles.centerLoading}>
                            <ActivityIndicator size="large" color="#0d9488" />
                            <Text style={styles.loadingText}>Loading clinical notes...</Text>
                        </View>
                    ) : (
                        <ScrollView style={styles.body} contentContainerStyle={styles.scrollContent}>
                            {activePage === 1 ? (
                                <View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>1. Chief Complaints &amp; Duration *</Text>
                                        <TextInput
                                            style={styles.inputArea}
                                            multiline
                                            placeholder="Document presenting symptoms, onset, and duration..."
                                            value={historyAndComplaints}
                                            onChangeText={setHistoryAndComplaints}
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>2. History of Present Illness (HOPI)</Text>
                                        <TextInput
                                            style={styles.inputArea}
                                            multiline
                                            placeholder="Detailed chronological progression of the illness..."
                                            value={historyOfPresentIllness}
                                            onChangeText={setHistoryOfPresentIllness}
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>3. Past Medical &amp; Surgical History</Text>
                                        <TextInput
                                            style={styles.inputArea}
                                            multiline
                                            placeholder="Previous hospitalizations, surgeries, chronic illnesses (DM, HTN)..."
                                            value={pastMedicalSurgicalHistory}
                                            onChangeText={setPastMedicalSurgicalHistory}
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>4. Personal &amp; Social History</Text>
                                        <TextInput
                                            style={styles.inputArea}
                                            multiline
                                            placeholder="Diet, sleep, smoking, alcohol, occupational history..."
                                            value={personalSocialHistory}
                                            onChangeText={setPersonalSocialHistory}
                                        />
                                    </View>

                                    <View style={[styles.formGroup, styles.allergyBox]}>
                                        <Text style={styles.allergyLabel}>5. Known Drug Allergies (CRITICAL)</Text>
                                        <TextInput
                                            style={styles.allergyInput}
                                            placeholder="e.g. Penicillin, Sulfa drugs, NSAIDs (or write NKDA)"
                                            placeholderTextColor="#f87171"
                                            value={anyDrugAllergy}
                                            onChangeText={setAnyDrugAllergy}
                                        />
                                    </View>
                                </View>
                            ) : (
                                <View>
                                    <Text style={styles.sectionHeader}>General Physical Examination</Text>
                                    <View style={styles.vitalsRow}>
                                        <View style={styles.vitalCol}>
                                            <Text style={styles.vitalLabel}>BP (mmHg)</Text>
                                            <TextInput style={styles.vitalInput} placeholder="120/80" value={bp} onChangeText={setBp} />
                                        </View>
                                        <View style={styles.vitalCol}>
                                            <Text style={styles.vitalLabel}>Temp (°F)</Text>
                                            <TextInput style={styles.vitalInput} placeholder="98.6" value={temp} onChangeText={setTemp} />
                                        </View>
                                        <View style={styles.vitalCol}>
                                            <Text style={styles.vitalLabel}>Pulse (bpm)</Text>
                                            <TextInput style={styles.vitalInput} placeholder="72" value={pulse} onChangeText={setPulse} />
                                        </View>
                                        <View style={styles.vitalCol}>
                                            <Text style={styles.vitalLabel}>SpO2 (%)</Text>
                                            <TextInput style={styles.vitalInput} placeholder="98" value={spo2} onChangeText={setSpo2} />
                                        </View>
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>General Physical Findings &amp; Pallor/Cyanosis/Oedema</Text>
                                        <TextInput
                                            style={styles.inputArea}
                                            multiline
                                            placeholder="Note findings on pallor, cyanosis, jaundice, clubbing, lymphadenopathy, oedema..."
                                            value={relevantPhysicalExamination}
                                            onChangeText={setRelevantPhysicalExamination}
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>6. Systemic Examination (CVS, RS, PA, CNS)</Text>
                                        <TextInput
                                            style={styles.inputArea}
                                            multiline
                                            placeholder="Heart sounds (CVS), breath sounds (RS), abdomen soft/tender (PA), CNS normal..."
                                            value={systemicExamination}
                                            onChangeText={setSystemicExamination}
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>7. Provisional / Initial Diagnosis *</Text>
                                        <TextInput
                                            style={styles.inputArea}
                                            multiline
                                            placeholder="Primary working diagnosis..."
                                            value={provisionalDiagnosis}
                                            onChangeText={setProvisionalDiagnosis}
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>8. Planned Investigations &amp; Treatment Plan</Text>
                                        <TextInput
                                            style={styles.inputArea}
                                            multiline
                                            placeholder="Lab investigations ordered, IV fluid plan, antibiotic regimen..."
                                            value={investigations}
                                            onChangeText={setInvestigations}
                                        />
                                    </View>

                                    <View style={styles.formGroup}>
                                        <Text style={styles.label}>9. Attending Consultant Name</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="Dr. Consultant Name"
                                            value={consultantName}
                                            onChangeText={setConsultantName}
                                        />
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    )}

                    {/* Bottom Save Bar */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <>
                                    <Feather name="save" size={15} color="#ffffff" />
                                    <Text style={styles.saveBtnText}>Save Clinical Notes</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        padding: 12,
    },
    modalBox: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        height: '92%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    pdfBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#0d9488',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    pdfBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#ffffff',
    },
    closeBtn: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: '#e2e8f0',
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#ffffff',
    },
    tabItem: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabItemActive: {
        borderBottomColor: '#0d9488',
    },
    tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    tabTextActive: {
        color: '#0d9488',
        fontWeight: '700',
    },
    centerLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 8,
        fontSize: 13,
        color: '#64748b',
    },
    body: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 30,
    },
    formGroup: {
        marginBottom: 14,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 4,
    },
    inputArea: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        padding: 10,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
        minHeight: 70,
        textAlignVertical: 'top',
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        padding: 10,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
    },
    allergyBox: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        borderRadius: 8,
        padding: 10,
    },
    allergyLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#b91c1c',
        marginBottom: 4,
    },
    allergyInput: {
        borderWidth: 1,
        borderColor: '#f87171',
        borderRadius: 6,
        padding: 8,
        fontSize: 13,
        color: '#991b1b',
        backgroundColor: '#ffffff',
        fontWeight: '600',
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 8,
    },
    vitalsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    vitalCol: {
        flex: 1,
    },
    vitalLabel: {
        fontSize: 11,
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
    footer: {
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#ffffff',
    },
    saveBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#0d9488',
        paddingVertical: 12,
        borderRadius: 10,
    },
    saveBtnDisabled: {
        backgroundColor: '#94a3b8',
    },
    saveBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
});

export default InpatientClinicalNotesModal;

