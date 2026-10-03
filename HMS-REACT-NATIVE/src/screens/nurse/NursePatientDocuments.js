import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Modal,
    Platform,
    Linking,
    Alert,
    RefreshControl,
    useWindowDimensions,
    KeyboardAvoidingView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import { reportAPI, patientAPI, admissionAPI, doctorAPI } from '../../utils/api';

const REPORT_CATEGORIES = [
    { value: 'LAB_REPORT', label: '🔬 Blood / Lab Investigation' },
    { value: 'RADIOLOGY', label: '🩻 Radiology (X-Ray / CT / MRI / USG)' },
    { value: 'CARDIOLOGY', label: '❤️ ECG / 2D-Echo / Cardiac' },
    { value: 'PATHOLOGY', label: '🧪 Pathology / Biopsy Report' },
    { value: 'DISCHARGE_SUMMARY', label: '📑 Previous Hospital Discharge' },
    { value: 'SURGERY_NOTES', label: '🏥 Operation / Procedure Notes' },
    { value: 'PRESCRIPTION', label: '💊 External Prescription / RX' },
    { value: 'OTHER', label: '📁 Other Clinical Record' }
];

const CONSENT_TEMPLATES = [
    {
        value: 'GENERAL_ADMISSION',
        label: '🏥 General Inpatient Admission & Treatment Consent',
        title: 'GENERAL INFORMED ADMISSION & TREATMENT CONSENT',
        description: 'Standard consent for inpatient admission, routine diagnostic tests, vital monitoring, and general nursing care.'
    },
    {
        value: 'SURGERY_PROCEDURE',
        label: '🔪 Surgical Operation & Invasive Procedure Consent',
        title: 'INFORMED CONSENT FOR SURGERY / INVASIVE PROCEDURE',
        description: 'Specific consent explaining operative procedure, surgical risks, alternatives, and contingency interventions.'
    },
    {
        value: 'ANESTHESIA',
        label: '💉 Anesthesia & Sedation Administration Consent',
        title: 'CONSENT FOR ANESTHESIA & ANALGESIC ADMINISTRATION',
        description: 'Consent for general, spinal, epidural, or local sedation detailing anesthetic risks and hemodynamic monitoring.'
    },
    {
        value: 'HIGH_RISK',
        label: '⚠️ High-Risk Clinical Treatment & Critical Care Consent',
        title: 'HIGH-RISK CLINICAL INTERVENTION & ICU CARE CONSENT',
        description: 'Consent for critical care management, mechanical ventilation, central venous line access, and advanced life support.'
    },
    {
        value: 'BLOOD_TRANSFUSION',
        label: '🩸 Blood & Blood Component Transfusion Consent',
        title: 'CONSENT FOR BLOOD & BLOOD PRODUCTS TRANSFUSION',
        description: 'Consent explaining transfusion indication, compatibility cross-matching, and potential immunological/allergic risks.'
    },
    {
        value: 'DAMA',
        label: '🚪 Discharge Against Medical Advice (DAMA) Declaration',
        title: 'DISCHARGE AGAINST MEDICAL ADVICE (DAMA) REFUSAL',
        description: 'Patient/Family legal declaration releasing hospital and doctors from liability upon self-directed premature discharge.'
    }
];

const WITNESS_RELATIONS = ['Self', 'Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Legal Guardian', 'Other'];

const getPatientAge = (pt) => {
    if (!pt) return '—';
    if (pt.age && Number(pt.age) > 0) return `${pt.age} yrs`;
    const rawDob = pt.dob || pt.dateOfBirth || pt.birthDate;
    if (rawDob) {
        try {
            const bDate = new Date(rawDob);
            if (!isNaN(bDate.getTime())) {
                const now = new Date();
                let age = now.getFullYear() - bDate.getFullYear();
                const m = now.getMonth() - bDate.getMonth();
                if (m < 0 || (m === 0 && now.getDate() < bDate.getDate())) {
                    age--;
                }
                if (age >= 0) return `${age} yrs`;
            }
        } catch (e) {}
    }
    return '—';
};

const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
};

const NursePatientDocuments = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;

    const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'consent'
    const [currentUser, setCurrentUser] = useState(null);

    // Patient Directory & Selection
    const [patients, setPatients] = useState([]);
    const [admissions, setAdmissions] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [loadingPatients, setLoadingPatients] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [patientPickerOpen, setPatientPickerOpen] = useState(false);

    // Reports State
    const [reportsList, setReportsList] = useState([]);
    const [loadingReports, setLoadingReports] = useState(false);
    const [uploadReportOpen, setUploadReportOpen] = useState(false);
    const [reportForm, setReportForm] = useState({
        category: 'LAB_REPORT',
        title: '',
        notes: '',
        file: null
    });
    const [uploadingReport, setUploadingReport] = useState(false);

    // Consents State
    const [consentList, setConsentList] = useState([]);
    const [loadingConsents, setLoadingConsents] = useState(false);
    const [uploadConsentOpen, setUploadConsentOpen] = useState(false);
    const [selectedTemplateKey, setSelectedTemplateKey] = useState('GENERAL_ADMISSION');
    const [customDoctorName, setCustomDoctorName] = useState('');
    const [consentForm, setConsentForm] = useState({
        consentType: 'GENERAL_ADMISSION',
        procedureName: '',
        doctorName: '',
        witnessName: '',
        witnessRelation: 'Self',
        witnessPhone: '',
        notes: '',
        file: null
    });
    const [uploadingConsent, setUploadingConsent] = useState(false);

    // Toast State
    const [toast, setToast] = useState(null);
    const toastTimerRef = useRef(null);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 3500);
    }, []);

    // ── Load Current User from Storage ──
    useEffect(() => {
        const loadUser = async () => {
            try {
                const uStr = await AsyncStorage.getItem('user');
                if (uStr) {
                    setCurrentUser(JSON.parse(uStr));
                }
            } catch (e) {
                console.warn('Failed to parse current user:', e);
            }
        };
        loadUser();
    }, []);

    // ── Fetch Patients & IPD Admissions ──
    const fetchInitialData = useCallback(async () => {
        setLoadingPatients(true);
        try {
            const [ptsRes, admRes] = await Promise.all([
                patientAPI.search('').catch(() => ({ data: [] })),
                admissionAPI.getActiveAdmissions().catch(() => ({ admissions: [] }))
            ]);

            const rawPts = ptsRes.data || ptsRes.patients || [];
            const activeAdms = admRes.admissions || admRes.data || [];

            setPatients(rawPts);
            setAdmissions(activeAdms);

            // If param passed, select that patient
            const initialPatientId = route.params?.patientId;
            if (initialPatientId && rawPts.length > 0) {
                const target = rawPts.find(p => String(p._id) === String(initialPatientId));
                if (target) {
                    const matchAdm = activeAdms.find(a => String(a.patientId?._id || a.patientId) === String(target._id));
                    setSelectedPatient({ ...target, admission: matchAdm });
                    return;
                }
            }

            // Auto-select first patient if none currently selected
            setSelectedPatient(prev => {
                if (prev) return prev;
                if (rawPts.length > 0) {
                    const firstPt = rawPts[0];
                    const matchAdm = activeAdms.find(a => String(a.patientId?._id || a.patientId) === String(firstPt._id));
                    return { ...firstPt, admission: matchAdm };
                }
                return null;
            });
        } catch (err) {
            console.error('Error fetching patients:', err);
            showToast('Failed to load patient directory', 'error');
        } finally {
            setLoadingPatients(false);
            setRefreshing(false);
        }
    }, [route.params?.patientId, showToast]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    // ── Fetch Selected Patient's Reports & Consents ──
    const fetchPatientRecords = useCallback(async () => {
        if (!selectedPatient?._id) return;
        const patientId = selectedPatient._id;

        // Fetch reports
        setLoadingReports(true);
        try {
            const [repRes, docRes, userHistory] = await Promise.all([
                reportAPI.getReportsByPatient(patientId).catch(() => ({ reports: [] })),
                patientAPI.getDocuments(patientId).catch(() => ({ documents: [] })),
                patientAPI.getFullHistory(patientId).catch(() => ({}))
            ]);

            const serverReports = repRes.reports || repRes.data || [];
            const docs = docRes.documents || docRes.data || [];
            const userReports = userHistory.patient?.fertilityProfile?.reports || userHistory.patient?.fertilityProfile?.previousReports || [];

            // Combine unique reports by url/fileId
            const combined = [...serverReports];
            const seen = new Set(serverReports.map(r => r.url || r.fileId || r._id));

            docs.forEach(d => {
                const key = d.url || d.fileId || d._id;
                if (key && !seen.has(key)) {
                    seen.add(key);
                    combined.push(d);
                }
            });

            userReports.forEach(ur => {
                const key = ur.url || ur.fileId || ur._id;
                if (key && !seen.has(key)) {
                    seen.add(key);
                    combined.push({
                        ...ur,
                        fileName: ur.name || ur.fileName || 'Diagnostic Report',
                        uploadedAt: ur.date || ur.uploadedAt || new Date()
                    });
                }
            });

            setReportsList(combined);
        } catch (err) {
            console.warn('Could not load reports:', err);
        } finally {
            setLoadingReports(false);
        }

        // Fetch consents
        setLoadingConsents(true);
        try {
            const consentRes = await patientAPI.getConsent(patientId).catch(() => ({ consentForms: [] }));
            setConsentList(consentRes.consentForms || consentRes.data || []);
        } catch (err) {
            console.warn('Could not load consents:', err);
        } finally {
            setLoadingConsents(false);
        }
    }, [selectedPatient]);

    useEffect(() => {
        fetchPatientRecords();
    }, [fetchPatientRecords]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchInitialData();
        fetchPatientRecords();
    };

    // ── Filtered Patients for Picker ──
    const filteredPatients = useMemo(() => {
        if (!searchTerm.trim()) return patients;
        const q = searchTerm.toLowerCase().trim();
        return patients.filter(p => {
            const name = (p.name || '').toLowerCase();
            const mrn = (p.patientId || p.mrn || p.uhid || '').toLowerCase();
            const phone = (p.phone || '').toLowerCase();
            return name.includes(q) || mrn.includes(q) || phone.includes(q);
        });
    }, [patients, searchTerm]);

    const handleSelectPatient = (pt) => {
        const matchAdm = admissions.find(a => String(a.patientId?._id || a.patientId) === String(pt._id));
        setSelectedPatient({ ...pt, admission: matchAdm });
        setPatientPickerOpen(false);
    };

    // ── Document Pickers ──
    const handlePickReportFile = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true
            });
            if (!res.canceled && res.assets && res.assets.length > 0) {
                setReportForm(prev => ({ ...prev, file: res.assets[0] }));
            }
        } catch (err) {
            console.error('File pick error:', err);
            showToast('Failed to select file', 'error');
        }
    };

    const handlePickConsentFile = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true
            });
            if (!res.canceled && res.assets && res.assets.length > 0) {
                setConsentForm(prev => ({ ...prev, file: res.assets[0] }));
            }
        } catch (err) {
            console.error('Consent pick error:', err);
            showToast('Failed to select consent file', 'error');
        }
    };

    // ── Handle Upload Diagnostic Report ──
    const handleReportSubmit = async () => {
        if (!selectedPatient?._id) {
            showToast('Please select a patient first', 'error');
            return;
        }
        if (!reportForm.file) {
            showToast('Please select a report file to upload', 'error');
            return;
        }

        setUploadingReport(true);
        try {
            const formData = new FormData();
            if (Platform.OS === 'web' && reportForm.file.file) {
                formData.append('reportFile', reportForm.file.file);
            } else {
                formData.append('reportFile', {
                    uri: reportForm.file.uri,
                    name: reportForm.file.name || 'diagnostic_report.pdf',
                    type: reportForm.file.mimeType || 'application/octet-stream'
                });
            }
            formData.append('patientId', selectedPatient._id);
            formData.append('category', reportForm.category);
            formData.append('reportName', reportForm.title || reportForm.file.name || 'Medical Report');
            formData.append('notes', reportForm.notes || '');

            if (selectedPatient.admission?._id) {
                formData.append('admissionId', selectedPatient.admission._id);
            }

            let uploadSuccess = false;
            try {
                const res = await reportAPI.uploadReport(formData);
                if (res && (res.success || res.report)) uploadSuccess = true;
            } catch (rErr) {
                console.warn('reportAPI.uploadReport failed, falling back to patient document upload...', rErr);
                const docFormData = new FormData();
                if (Platform.OS === 'web' && reportForm.file.file) {
                    docFormData.append('document', reportForm.file.file);
                } else {
                    docFormData.append('document', {
                        uri: reportForm.file.uri,
                        name: reportForm.file.name || 'medical_document.pdf',
                        type: reportForm.file.mimeType || 'application/octet-stream'
                    });
                }
                docFormData.append('docType', reportForm.category);
                docFormData.append('title', reportForm.title || reportForm.file.name || 'Medical Document');
                docFormData.append('notes', reportForm.notes || '');
                const docRes = await patientAPI.uploadDocument(selectedPatient._id, docFormData);
                if (docRes && (docRes.success || docRes.document)) uploadSuccess = true;
            }

            if (uploadSuccess) {
                showToast('Diagnostic report uploaded successfully!', 'success');
                setReportForm({
                    category: 'LAB_REPORT',
                    title: '',
                    notes: '',
                    file: null
                });
                setUploadReportOpen(false);
                fetchPatientRecords();
            } else {
                showToast('Failed to upload report. Please check file format.', 'error');
            }
        } catch (err) {
            console.error('Report upload failed:', err);
            showToast(err.response?.data?.message || err.message || 'Error uploading report', 'error');
        } finally {
            setUploadingReport(false);
        }
    };

    // ── Generate Printable Legal Consent via expo-print ──
    const handlePrintConsentForm = async (templateKey, isBlank = false) => {
        if (!selectedPatient && !isBlank) {
            showToast('Please select a patient first', 'error');
            return;
        }

        const template = CONSENT_TEMPLATES.find(t => t.value === templateKey) || CONSENT_TEMPLATES[0];
        const ptName = isBlank ? '______________________________' : (selectedPatient?.name || '—');
        const ptMRN = isBlank ? '___________________' : (selectedPatient?.patientId || selectedPatient?.mrn || selectedPatient?.uhid || 'N/A');
        const ptAge = isBlank ? '______' : getPatientAge(selectedPatient);
        const ptGender = isBlank ? '______' : (selectedPatient?.gender || '—');
        const ptPhone = isBlank ? '___________________' : (selectedPatient?.phone || '—');
        const docName = customDoctorName.trim() || (currentUser?.name ? `Dr. ${currentUser.name}` : 'Attending Physician');
        const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                <title>${template.title} - ${ptName}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        color: #0f172a;
                        padding: 24px;
                        line-height: 1.5;
                        font-size: 13px;
                    }
                    .h-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 2px solid #0284c7;
                        padding-bottom: 10px;
                        margin-bottom: 14px;
                    }
                    .h-logo {
                        font-size: 18px;
                        font-weight: 800;
                        color: #0284c7;
                    }
                    .h-sub {
                        font-size: 11px;
                        color: #64748b;
                        text-align: right;
                    }
                    .doc-title {
                        text-align: center;
                        font-size: 15px;
                        font-weight: 800;
                        color: #0f172a;
                        margin: 12px 0 14px;
                        text-transform: uppercase;
                        letter-spacing: 0.03em;
                        border-bottom: 1px dashed #cbd5e1;
                        padding-bottom: 6px;
                    }
                    .pt-box {
                        background: #f8fafc;
                        border: 1px solid #cbd5e1;
                        border-radius: 6px;
                        padding: 10px 14px;
                        margin-bottom: 16px;
                        font-size: 12px;
                    }
                    .pt-row {
                        margin-bottom: 4px;
                    }
                    .pt-row strong {
                        color: #334155;
                        display: inline-block;
                        width: 120px;
                    }
                    .clause-list {
                        padding-left: 16px;
                        margin-bottom: 24px;
                    }
                    .clause-list li {
                        margin-bottom: 8px;
                        text-align: justify;
                    }
                    .sig-section {
                        margin-top: 36px;
                        display: flex;
                        justify-content: space-between;
                        gap: 20px;
                    }
                    .sig-box {
                        border-top: 1px solid #475569;
                        padding-top: 6px;
                        font-size: 11px;
                        width: 45%;
                    }
                    .sig-box strong {
                        display: block;
                        font-size: 12px;
                        margin-bottom: 4px;
                    }
                </style>
            </head>
            <body>
                <div class="h-header">
                    <div>
                        <div class="h-logo">🏥 MEDICAL365 HEALTHCARE SYSTEM</div>
                        <div style="font-size: 10px; color: #475569;">Clinical Documentation & Legal Medical Records</div>
                    </div>
                    <div class="h-sub">
                        <div>Date: <strong>${dateStr}</strong></div>
                        <div>MRN: <strong>${ptMRN}</strong></div>
                    </div>
                </div>

                <div class="doc-title">${template.title}</div>

                <div class="pt-box">
                    <div class="pt-row"><strong>Patient Name:</strong> <span>${ptName}</span></div>
                    <div class="pt-row"><strong>MRN / UHID:</strong> <span>${ptMRN}</span></div>
                    <div class="pt-row"><strong>Age / Gender:</strong> <span>${ptAge} / ${ptGender}</span></div>
                    <div class="pt-row"><strong>Contact:</strong> <span>${ptPhone}</span></div>
                    <div class="pt-row"><strong>Doctor In-Charge:</strong> <span>${docName}</span></div>
                    <div class="pt-row"><strong>Date:</strong> <span>${dateStr}</span></div>
                </div>

                <p style="font-size: 12px; color: #475569; margin-bottom: 8px;">
                    <strong>Clinical Purpose:</strong> ${template.description}
                </p>

                <ol class="clause-list">
                    <li><strong>Acknowledgment of Clinical Examination & Treatment:</strong> I hereby give my informed consent to undergo the medical evaluation, inpatient admission, nursing care, diagnostic examinations, and therapeutic treatments deemed clinically appropriate by the attending physicians and nursing staff.</li>
                    <li><strong>Explanation of Risks & Alternatives:</strong> The purpose, potential medical benefits, risks, foreseeable side effects, and available alternative courses of treatment have been thoroughly explained to me in a language that I understand.</li>
                    <li><strong>Medication & Emergency Interventions:</strong> I authorize the medical and nursing team to administer prescribed medications, IV fluids, injections, and life-saving emergency medical interventions as required during the course of my treatment.</li>
                    <li><strong>Accuracy of Information:</strong> I confirm that I have disclosed all known past medical illnesses, prior surgeries, drug allergies, and current ongoing medications accurately to the healthcare team.</li>
                    <li><strong>Voluntary Consent:</strong> I confirm that I am signing this informed consent document voluntarily, in a sound state of mind, without any coercion or undue influence.</li>
                </ol>

                <div class="sig-section">
                    <div class="sig-box">
                        <strong>Patient / Legal Guardian Signature</strong>
                        <div>Name: _______________________________</div>
                        <div>Relationship: _______________________</div>
                        <div>Date & Time: ________________________</div>
                    </div>
                    <div class="sig-box">
                        <strong>Attending Doctor / Nurse Witness</strong>
                        <div>Name: ${docName}</div>
                        <div>Designation: Staff Nurse / Medical Officer</div>
                        <div>Date & Time: ________________________</div>
                    </div>
                </div>
            </body>
            </html>
        `;

        try {
            await Print.printAsync({ html });
            showToast('Consent form generated successfully');
        } catch (err) {
            console.error('Print error:', err);
            showToast('Failed to generate consent print document', 'error');
        }
    };

    // ── Handle Upload Signed Consent Form ──
    const handleConsentSubmit = async () => {
        if (!selectedPatient?._id) {
            showToast('Please select a patient first', 'error');
            return;
        }
        if (!consentForm.file) {
            showToast('Please attach the signed consent document or photo', 'error');
            return;
        }

        setUploadingConsent(true);
        try {
            const formData = new FormData();
            if (Platform.OS === 'web' && consentForm.file.file) {
                formData.append('consentFile', consentForm.file.file);
            } else {
                formData.append('consentFile', {
                    uri: consentForm.file.uri,
                    name: consentForm.file.name || 'signed_consent.pdf',
                    type: consentForm.file.mimeType || 'application/octet-stream'
                });
            }
            formData.append('consentType', consentForm.consentType);
            formData.append('procedureName', consentForm.procedureName || '');
            formData.append('doctorName', consentForm.doctorName || (currentUser?.name ? `Dr. ${currentUser.name}` : ''));
            formData.append('witnessName', consentForm.witnessName || '');
            formData.append('witnessRelation', consentForm.witnessRelation || 'Self');
            formData.append('witnessPhone', consentForm.witnessPhone || '');
            formData.append('notes', consentForm.notes || '');

            const res = await patientAPI.uploadConsent(selectedPatient._id, formData);
            if (res && (res.success || res.consent)) {
                showToast('Signed consent recorded and archived!', 'success');
                setConsentForm({
                    consentType: 'GENERAL_ADMISSION',
                    procedureName: '',
                    doctorName: '',
                    witnessName: '',
                    witnessRelation: 'Self',
                    witnessPhone: '',
                    notes: '',
                    file: null
                });
                setUploadConsentOpen(false);
                fetchPatientRecords();
            } else {
                showToast(res?.message || 'Failed to upload consent form', 'error');
            }
        } catch (err) {
            console.error('Consent upload failed:', err);
            showToast(err.response?.data?.message || err.message || 'Error uploading consent', 'error');
        } finally {
            setUploadingConsent(false);
        }
    };

    const handleOpenDocument = (url) => {
        if (!url) {
            showToast('No document link available', 'error');
            return;
        }
        Linking.openURL(url).catch(() => {
            showToast('Could not open document URL', 'error');
        });
    };

    return (
        <View style={styles.container}>
            {/* ── Toast Banner ── */}
            {toast && (
                <View style={[styles.toastBanner, toast.type === 'error' ? styles.toastError : styles.toastSuccess]}>
                    <Feather
                        name={toast.type === 'error' ? 'alert-circle' : 'check-circle'}
                        size={16}
                        color={toast.type === 'error' ? '#dc2626' : '#16a34a'}
                    />
                    <Text style={[styles.toastText, { color: toast.type === 'error' ? '#991b1b' : '#166534' }]}>
                        {toast.message}
                    </Text>
                </View>
            )}

            <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0284c7']} />}
            >
                {/* ── Header Banner ── */}
                <LinearGradient colors={['#0369a1', '#0284c7']} style={styles.headerGradient}>
                    <View style={styles.headerTop}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.headerBadge}>
                                <Text style={styles.headerBadgeText}>CLINICAL DOCUMENTATION PORTAL</Text>
                            </View>
                            <Text style={styles.headerTitle}>Patient Reports & Consents</Text>
                            <Text style={styles.headerSubtitle}>
                                Search patients, view and upload clinical diagnostic reports, print standard legal consents, and archive signed documents.
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.refreshIconBtn} onPress={onRefresh} activeOpacity={0.8}>
                            <Feather name="refresh-cw" size={16} color="#ffffff" />
                        </TouchableOpacity>
                    </View>

                    {/* Quick Stats Chips */}
                    <View style={styles.statsRow}>
                        <View style={styles.statChip}>
                            <Feather name="users" size={14} color="#0284c7" />
                            <Text style={styles.statVal}>{patients.length}</Text>
                            <Text style={styles.statLbl}>Patients</Text>
                        </View>
                        <View style={styles.statChip}>
                            <Feather name="file-text" size={14} color="#0d9488" />
                            <Text style={styles.statVal}>{reportsList.length}</Text>
                            <Text style={styles.statLbl}>Reports</Text>
                        </View>
                        <View style={styles.statChip}>
                            <Feather name="shield" size={14} color="#7c3aed" />
                            <Text style={styles.statVal}>{consentList.length}</Text>
                            <Text style={styles.statLbl}>Consents</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* ── Selected Patient Overview & Directory Trigger ── */}
                <View style={styles.patientBarCard}>
                    <View style={styles.patientBarLeft}>
                        <View style={styles.patientAvatar}>
                            <Text style={styles.avatarText}>{getInitials(selectedPatient?.name)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <Text style={styles.patientName}>{selectedPatient?.name || 'Select Patient'}</Text>
                                {selectedPatient?.admission && (
                                    <View style={styles.inpatientBadge}>
                                        <Text style={styles.inpatientBadgeText}>
                                            🛏️ {selectedPatient.admission.ward || 'Ward'} / Bed {selectedPatient.admission.bedNumber || '—'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.patientMeta}>
                                {selectedPatient?.patientId || selectedPatient?.mrn || selectedPatient?.uhid ? `MRN: ${selectedPatient.patientId || selectedPatient.mrn || selectedPatient.uhid}` : 'No MRN'}
                                {' • '}Age: {getPatientAge(selectedPatient)}
                                {' • '}{selectedPatient?.gender || '—'}
                                {selectedPatient?.phone ? ` • 📞 ${selectedPatient.phone}` : ''}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.changePatientBtn}
                        onPress={() => setPatientPickerOpen(true)}
                        activeOpacity={0.8}
                    >
                        <Feather name="user-check" size={14} color="#0284c7" />
                        <Text style={styles.changePatientBtnText}>Change Patient</Text>
                    </TouchableOpacity>
                </View>

                {/* ── Tabs Selector ── */}
                <View style={styles.tabsRow}>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'reports' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('reports')}
                        activeOpacity={0.8}
                    >
                        <Feather name="file-text" size={15} color={activeTab === 'reports' ? '#0284c7' : '#64748b'} />
                        <Text style={[styles.tabBtnText, activeTab === 'reports' && styles.tabBtnTextActive]}>
                            Diagnostic & Lab Reports ({reportsList.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'consent' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('consent')}
                        activeOpacity={0.8}
                    >
                        <Feather name="shield" size={15} color={activeTab === 'consent' ? '#0284c7' : '#64748b'} />
                        <Text style={[styles.tabBtnText, activeTab === 'consent' && styles.tabBtnTextActive]}>
                            Clinical Consents ({consentList.length})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ───────────────────────────────────────────────────────────── */}
                {/* ── TAB 1: DIAGNOSTIC & LAB REPORTS ── */}
                {/* ───────────────────────────────────────────────────────────── */}
                {activeTab === 'reports' && (
                    <View style={styles.tabContent}>
                        <View style={styles.sectionHeaderRow}>
                            <View>
                                <Text style={styles.sectionTitle}>Archived Diagnostic Reports</Text>
                                <Text style={styles.sectionSub}>All uploaded lab, imaging, and external documents</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.actionBtnPrimary}
                                onPress={() => setUploadReportOpen(true)}
                                activeOpacity={0.8}
                            >
                                <Feather name="upload-cloud" size={14} color="#ffffff" />
                                <Text style={styles.actionBtnPrimaryText}>Attach Report</Text>
                            </TouchableOpacity>
                        </View>

                        {loadingReports ? (
                            <View style={styles.loaderBox}>
                                <ActivityIndicator size="small" color="#0284c7" />
                                <Text style={styles.loaderText}>Loading diagnostic reports...</Text>
                            </View>
                        ) : reportsList.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Feather name="file-text" size={36} color="#94a3b8" />
                                <Text style={styles.emptyTitle}>No diagnostic reports attached</Text>
                                <Text style={styles.emptySub}>
                                    Tap "Attach Report" to upload lab investigations, radiology films, or prescriptions.
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.itemsList}>
                                {reportsList.map((r, idx) => {
                                    const fileName = r.fileName || r.name || r.title || 'Diagnostic Report';
                                    const category = r.category || r.docType || 'LAB_REPORT';
                                    const dateStr = r.uploadedAt || r.date || r.createdAt ? new Date(r.uploadedAt || r.date || r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent';
                                    const fileUrl = r.url || r.fileUrl;

                                    return (
                                        <View key={r._id || r.fileId || idx} style={styles.itemCard}>
                                            <View style={styles.itemIconWrap}>
                                                <Feather name="file-text" size={18} color="#0284c7" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                    <Text style={styles.itemTitle} numberOfLines={1}>{fileName}</Text>
                                                    <View style={styles.categoryBadge}>
                                                        <Text style={styles.categoryBadgeText}>{category}</Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.itemMeta}>
                                                    Uploaded: {dateStr}
                                                    {r.uploadedByRole ? ` • By: ${r.uploadedByRole}` : ''}
                                                </Text>
                                                {r.notes ? <Text style={styles.itemNotes}>{r.notes}</Text> : null}
                                            </View>
                                            {fileUrl ? (
                                                <TouchableOpacity
                                                    style={styles.viewDocBtn}
                                                    onPress={() => handleOpenDocument(fileUrl)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Feather name="external-link" size={13} color="#0284c7" />
                                                    <Text style={styles.viewDocBtnText}>View</Text>
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                )}

                {/* ───────────────────────────────────────────────────────────── */}
                {/* ── TAB 2: CLINICAL CONSENTS ── */}
                {/* ───────────────────────────────────────────────────────────── */}
                {activeTab === 'consent' && (
                    <View style={styles.tabContent}>
                        {/* Section 1: Standard Consent Templates */}
                        <View style={styles.consentTemplateCard}>
                            <View style={styles.templateCardHead}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.templateCardTitle}>Standard Clinical Consent Templates</Text>
                                    <Text style={styles.templateCardSub}>Generate and print prefilled legal medical consents</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.actionBtnEmerald}
                                    onPress={() => setUploadConsentOpen(true)}
                                    activeOpacity={0.8}
                                >
                                    <Feather name="upload" size={14} color="#ffffff" />
                                    <Text style={styles.actionBtnPrimaryText}>Upload Signed</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.fieldWrap}>
                                <Text style={styles.fieldLabel}>Select Consent Form Template</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateChipsRow}>
                                    {CONSENT_TEMPLATES.map(t => {
                                        const isSel = selectedTemplateKey === t.value;
                                        return (
                                            <TouchableOpacity
                                                key={t.value}
                                                style={[styles.templateChip, isSel && styles.templateChipActive]}
                                                onPress={() => setSelectedTemplateKey(t.value)}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={[styles.templateChipText, isSel && styles.templateChipTextActive]}>
                                                    {t.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* Template Preview Description & Print Actions */}
                            {(() => {
                                const currentTpl = CONSENT_TEMPLATES.find(t => t.value === selectedTemplateKey) || CONSENT_TEMPLATES[0];
                                return (
                                    <View style={styles.templatePreviewBox}>
                                        <Text style={styles.tplPreviewTitle}>{currentTpl.title}</Text>
                                        <Text style={styles.tplPreviewDesc}>{currentTpl.description}</Text>

                                        <View style={{ marginTop: 10 }}>
                                            <Text style={styles.fieldLabel}>Attending Physician Name (Optional override)</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="e.g. Dr. Jane Smith, MD"
                                                placeholderTextColor="#94a3b8"
                                                value={customDoctorName}
                                                onChangeText={setCustomDoctorName}
                                            />
                                        </View>

                                        <View style={styles.printActionsRow}>
                                            <TouchableOpacity
                                                style={styles.printBtnPrimary}
                                                onPress={() => handlePrintConsentForm(selectedTemplateKey, false)}
                                                activeOpacity={0.8}
                                            >
                                                <Feather name="printer" size={14} color="#ffffff" />
                                                <Text style={styles.printBtnPrimaryText}>Print Prefilled Consent Form</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.printBtnOutline}
                                                onPress={() => handlePrintConsentForm(selectedTemplateKey, true)}
                                                activeOpacity={0.8}
                                            >
                                                <Feather name="file" size={14} color="#0284c7" />
                                                <Text style={styles.printBtnOutlineText}>Print Blank Form</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })()}
                        </View>

                        {/* Section 2: Signed Consent Archive */}
                        <View style={{ marginTop: 20 }}>
                            <View style={styles.sectionHeaderRow}>
                                <View>
                                    <Text style={styles.sectionTitle}>Signed Legal Consents Archive</Text>
                                    <Text style={styles.sectionSub}>Digitized signed consent documentation for this patient</Text>
                                </View>
                            </View>

                            {loadingConsents ? (
                                <View style={styles.loaderBox}>
                                    <ActivityIndicator size="small" color="#0284c7" />
                                    <Text style={styles.loaderText}>Loading consent archive...</Text>
                                </View>
                            ) : consentList.length === 0 ? (
                                <View style={styles.emptyCard}>
                                    <Feather name="shield" size={36} color="#94a3b8" />
                                    <Text style={styles.emptyTitle}>No signed consent forms recorded</Text>
                                    <Text style={styles.emptySub}>
                                        After obtaining the patient's signature on the printed form, tap "Upload Signed" to archive it.
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.itemsList}>
                                    {consentList.map((c, idx) => {
                                        const cTitle = c.consentType || c.title || 'Informed Clinical Consent';
                                        const dateStr = c.signedAt || c.createdAt ? new Date(c.signedAt || c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Archived';
                                        const fileUrl = c.fileUrl || c.url;

                                        return (
                                            <View key={c._id || idx} style={styles.itemCard}>
                                                <View style={[styles.itemIconWrap, { backgroundColor: '#f5f3ff' }]}>
                                                    <Feather name="shield" size={18} color="#7c3aed" />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                        <Text style={styles.itemTitle}>{cTitle}</Text>
                                                        <View style={[styles.categoryBadge, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                                                            <Text style={[styles.categoryBadgeText, { color: '#047857' }]}>✓ SIGNED</Text>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.itemMeta}>
                                                        Date: {dateStr}
                                                        {c.witnessName ? ` • Witness: ${c.witnessName} (${c.witnessRelation || 'Relative'})` : ''}
                                                        {c.doctorName ? ` • Doctor: ${c.doctorName}` : ''}
                                                    </Text>
                                                    {c.notes ? <Text style={styles.itemNotes}>{c.notes}</Text> : null}
                                                </View>
                                                {fileUrl ? (
                                                    <TouchableOpacity
                                                        style={styles.viewDocBtn}
                                                        onPress={() => handleOpenDocument(fileUrl)}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Feather name="external-link" size={13} color="#0284c7" />
                                                        <Text style={styles.viewDocBtnText}>View</Text>
                                                    </TouchableOpacity>
                                                ) : null}
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* ── MODAL 1: PATIENT PICKER ── */}
            <Modal visible={patientPickerOpen} transparent animationType="fade" onRequestClose={() => setPatientPickerOpen(false)}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={styles.keyboardAvoidWrap}
                    >
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Select Patient</Text>
                                <TouchableOpacity onPress={() => setPatientPickerOpen(false)}>
                                    <Feather name="x" size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <View style={{ padding: 12 }}>
                                <View style={styles.searchBox}>
                                    <Feather name="search" size={15} color="#94a3b8" />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search by name, MRN, UHID, or phone..."
                                        placeholderTextColor="#94a3b8"
                                        value={searchTerm}
                                        onChangeText={setSearchTerm}
                                    />
                                    {searchTerm.length > 0 && (
                                        <TouchableOpacity onPress={() => setSearchTerm('')}>
                                            <Feather name="x" size={14} color="#94a3b8" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                            <ScrollView style={{ maxHeight: 350, paddingHorizontal: 12 }}>
                                {filteredPatients.length === 0 ? (
                                    <Text style={styles.emptyInlineText}>No patients found matching "{searchTerm}"</Text>
                                ) : (
                                    filteredPatients.map(pt => {
                                        const isSel = selectedPatient?._id === pt._id;
                                        const matchAdm = admissions.find(a => String(a.patientId?._id || a.patientId) === String(pt._id));
                                        return (
                                            <TouchableOpacity
                                                key={pt._id}
                                                style={[styles.patientPickerRow, isSel && styles.patientPickerRowActive]}
                                                onPress={() => handleSelectPatient(pt)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.patientAvatarSm}>
                                                    <Text style={styles.avatarTextSm}>{getInitials(pt.name)}</Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.pickerPtName}>{pt.name}</Text>
                                                    <Text style={styles.pickerPtSub}>
                                                        {pt.patientId || pt.mrn || 'No MRN'} • {pt.gender || '—'} • {getPatientAge(pt)}
                                                    </Text>
                                                </View>
                                                {matchAdm && (
                                                    <View style={styles.pickerWardBadge}>
                                                        <Text style={styles.pickerWardBadgeText}>🛏️ {matchAdm.ward || 'Ward'}</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </ScrollView>
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.btnSecondary} onPress={() => setPatientPickerOpen(false)}>
                                    <Text style={styles.btnSecondaryText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* ── MODAL 2: UPLOAD REPORT ── */}
            <Modal visible={uploadReportOpen} transparent animationType="fade" onRequestClose={() => setUploadReportOpen(false)}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={styles.keyboardAvoidWrap}
                    >
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Attach Diagnostic Report</Text>
                                <TouchableOpacity onPress={() => setUploadReportOpen(false)}>
                                    <Feather name="x" size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={{ padding: 16, maxHeight: 420 }}>
                                <View style={styles.fieldWrap}>
                                    <Text style={styles.fieldLabel}>Report Category *</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChipsRow}>
                                        {REPORT_CATEGORIES.map(c => {
                                            const isSel = reportForm.category === c.value;
                                            return (
                                                <TouchableOpacity
                                                    key={c.value}
                                                    style={[styles.catChip, isSel && styles.catChipActive]}
                                                    onPress={() => setReportForm(p => ({ ...p, category: c.value }))}
                                                    activeOpacity={0.8}
                                                >
                                                    <Text style={[styles.catChipText, isSel && styles.catChipTextActive]}>
                                                        {c.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>

                                <View style={styles.fieldWrap}>
                                    <Text style={styles.fieldLabel}>Report Title / Description</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. Complete Blood Count (CBC) / Chest X-Ray"
                                        placeholderTextColor="#94a3b8"
                                        value={reportForm.title}
                                        onChangeText={t => setReportForm(p => ({ ...p, title: t }))}
                                    />
                                </View>

                                <View style={styles.fieldWrap}>
                                    <Text style={styles.fieldLabel}>Clinical Findings / Notes</Text>
                                    <TextInput
                                        style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                                        multiline
                                        placeholder="Enter notable bedside or radiologist notes..."
                                        placeholderTextColor="#94a3b8"
                                        value={reportForm.notes}
                                        onChangeText={t => setReportForm(p => ({ ...p, notes: t }))}
                                    />
                                </View>

                                <View style={styles.fieldWrap}>
                                    <Text style={styles.fieldLabel}>Select File (PDF or Image) *</Text>
                                    <TouchableOpacity style={styles.filePickerBtn} onPress={handlePickReportFile} activeOpacity={0.8}>
                                        <Feather name={reportForm.file ? 'check-circle' : 'file-plus'} size={18} color={reportForm.file ? '#059669' : '#0284c7'} />
                                        <Text style={[styles.filePickerBtnText, reportForm.file && { color: '#059669', fontWeight: '700' }]}>
                                            {reportForm.file ? reportForm.file.name : 'Choose PDF / Photo'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.btnSecondary} onPress={() => setUploadReportOpen(false)}>
                                    <Text style={styles.btnSecondaryText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.btnPrimary, uploadingReport && { opacity: 0.6 }]}
                                    onPress={handleReportSubmit}
                                    disabled={uploadingReport}
                                >
                                    {uploadingReport ? (
                                        <ActivityIndicator size="small" color="#ffffff" />
                                    ) : (
                                        <Text style={styles.btnPrimaryText}>Upload Report</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* ── MODAL 3: UPLOAD SIGNED CONSENT ── */}
            <Modal visible={uploadConsentOpen} transparent animationType="fade" onRequestClose={() => setUploadConsentOpen(false)}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={styles.keyboardAvoidWrap}
                    >
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Archive Signed Consent Form</Text>
                                <TouchableOpacity onPress={() => setUploadConsentOpen(false)}>
                                    <Feather name="x" size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={{ padding: 16, maxHeight: 440 }}>
                                <View style={styles.fieldWrap}>
                                    <Text style={styles.fieldLabel}>Consent Form Type *</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChipsRow}>
                                        {CONSENT_TEMPLATES.map(c => {
                                            const isSel = consentForm.consentType === c.value;
                                            return (
                                                <TouchableOpacity
                                                    key={c.value}
                                                    style={[styles.catChip, isSel && styles.catChipActive]}
                                                    onPress={() => setConsentForm(p => ({ ...p, consentType: c.value }))}
                                                    activeOpacity={0.8}
                                                >
                                                    <Text style={[styles.catChipText, isSel && styles.catChipTextActive]}>
                                                        {c.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>

                                <View style={styles.fieldWrap}>
                                    <Text style={styles.fieldLabel}>Procedure Name (If surgical/invasive)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. Laparoscopic Appendectomy"
                                        placeholderTextColor="#94a3b8"
                                        value={consentForm.procedureName}
                                        onChangeText={t => setConsentForm(p => ({ ...p, procedureName: t }))}
                                    />
                                </View>

                                <View style={styles.fieldWrap}>
                                    <Text style={styles.fieldLabel}>Witness / Guardian Name</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Full name of signatory witness"
                                        placeholderTextColor="#94a3b8"
                                        value={consentForm.witnessName}
                                        onChangeText={t => setConsentForm(p => ({ ...p, witnessName: t }))}
                                    />
                                </View>

                                <View style={styles.fieldWrap}>
                                    <Text style={styles.fieldLabel}>Witness Relationship</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChipsRow}>
                                        {WITNESS_RELATIONS.map(rel => {
                                            const isSel = consentForm.witnessRelation === rel;
                                            return (
                                                <TouchableOpacity
                                                    key={rel}
                                                    style={[styles.catChip, isSel && styles.catChipActive]}
                                                    onPress={() => setConsentForm(p => ({ ...p, witnessRelation: rel }))}
                                                    activeOpacity={0.8}
                                                >
                                                    <Text style={[styles.catChipText, isSel && styles.catChipTextActive]}>{rel}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>

                                <View style={styles.fieldWrap}>
                                    <Text style={styles.fieldLabel}>Attach Signed Consent (Scan / Photo) *</Text>
                                    <TouchableOpacity style={styles.filePickerBtn} onPress={handlePickConsentFile} activeOpacity={0.8}>
                                        <Feather name={consentForm.file ? 'check-circle' : 'file-plus'} size={18} color={consentForm.file ? '#059669' : '#0284c7'} />
                                        <Text style={[styles.filePickerBtnText, consentForm.file && { color: '#059669', fontWeight: '700' }]}>
                                            {consentForm.file ? consentForm.file.name : 'Choose Signed Scan / Photo'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.btnSecondary} onPress={() => setUploadConsentOpen(false)}>
                                    <Text style={styles.btnSecondaryText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.btnPrimary, uploadingConsent && { opacity: 0.6 }]}
                                    onPress={handleConsentSubmit}
                                    disabled={uploadingConsent}
                                >
                                    {uploadingConsent ? (
                                        <ActivityIndicator size="small" color="#ffffff" />
                                    ) : (
                                        <Text style={styles.btnPrimaryText}>Archive Consent</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    keyboardAvoidWrap: { width: '100%', maxWidth: 460, alignItems: 'center' },
    scrollArea: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    headerGradient: { padding: 18, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    headerBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginBottom: 6 },
    headerBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    headerTitle: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
    headerSubtitle: { color: '#e0f2fe', fontSize: 12, marginTop: 4, lineHeight: 16 },
    refreshIconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    statChip: { flex: 1, backgroundColor: '#ffffff', borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
    statVal: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    statLbl: { fontSize: 11, fontWeight: '600', color: '#64748b' },
    patientBarCard: { margin: 16, marginBottom: 8, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
    patientBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 220 },
    patientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0284c7', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
    patientName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    inpatientBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#bfdbfe' },
    inpatientBadgeText: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
    patientMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
    changePatientBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0f9ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd' },
    changePatientBtnText: { color: '#0284c7', fontSize: 12, fontWeight: '700' },
    tabsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 8 },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    tabBtnActive: { borderColor: '#0284c7', backgroundColor: '#f0f9ff' },
    tabBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    tabBtnTextActive: { color: '#0284c7', fontWeight: '800' },
    tabContent: { padding: 16 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    sectionSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
    actionBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0284c7', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
    actionBtnEmerald: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
    actionBtnPrimaryText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
    loaderBox: { padding: 24, alignItems: 'center', justifyContent: 'center' },
    loaderText: { fontSize: 12, color: '#64748b', marginTop: 6 },
    emptyCard: { backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 28, alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 10 },
    emptySub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, maxWidth: 300 },
    itemsList: { gap: 10 },
    itemCard: { backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
    itemIconWrap: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#f0f9ff', justifyContent: 'center', alignItems: 'center' },
    itemTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', maxWidth: 220 },
    categoryBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
    categoryBadgeText: { fontSize: 10, fontWeight: '700', color: '#475569' },
    itemMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
    itemNotes: { fontSize: 11, color: '#0284c7', marginTop: 4, fontStyle: 'italic' },
    viewDocBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0f9ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#bae6fd' },
    viewDocBtnText: { fontSize: 11, fontWeight: '700', color: '#0284c7' },
    consentTemplateCard: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 16 },
    templateCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    templateCardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    templateCardSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
    templateChipsRow: { gap: 8, paddingVertical: 4 },
    templateChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    templateChipActive: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
    templateChipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
    templateChipTextActive: { color: '#ffffff', fontWeight: '700' },
    templatePreviewBox: { marginTop: 12, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', padding: 14 },
    tplPreviewTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a', textTransform: 'uppercase' },
    tplPreviewDesc: { fontSize: 11, color: '#475569', marginTop: 4, lineHeight: 16 },
    printActionsRow: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
    printBtnPrimary: { flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#0284c7', paddingVertical: 10, borderRadius: 6 },
    printBtnPrimaryText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
    printBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6, borderWidth: 1, borderColor: '#0284c7', backgroundColor: '#ffffff' },
    printBtnOutlineText: { color: '#0284c7', fontSize: 12, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalContent: { width: '100%', maxWidth: 460, backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    fieldWrap: { marginBottom: 12 },
    fieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0f172a', backgroundColor: '#ffffff' },
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 10, height: 38 },
    searchInput: { flex: 1, fontSize: 12, color: '#0f172a' },
    patientPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    patientPickerRowActive: { backgroundColor: '#f0f9ff' },
    patientAvatarSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0284c7', justifyContent: 'center', alignItems: 'center' },
    avatarTextSm: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
    pickerPtName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    pickerPtSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
    pickerWardBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    pickerWardBadgeText: { fontSize: 10, fontWeight: '700', color: '#1d4ed8' },
    emptyInlineText: { fontSize: 12, color: '#64748b', textAlign: 'center', padding: 20 },
    categoryChipsRow: { gap: 6, paddingVertical: 4 },
    catChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
    catChipActive: { borderColor: '#0284c7', backgroundColor: '#eff6ff' },
    catChipText: { fontSize: 11, color: '#475569', fontWeight: '600' },
    catChipTextActive: { color: '#0284c7', fontWeight: '700' },
    filePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', backgroundColor: '#f8fafc', justifyContent: 'center' },
    filePickerBtnText: { fontSize: 12, color: '#0284c7', fontWeight: '600' },
    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#f8fafc' },
    btnSecondary: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, backgroundColor: '#e2e8f0' },
    btnSecondaryText: { color: '#475569', fontSize: 12, fontWeight: '700' },
    btnPrimary: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, backgroundColor: '#0284c7' },
    btnPrimaryText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
    toastBanner: { position: 'absolute', top: 12, left: 16, right: 16, zIndex: 999, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    toastSuccess: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
    toastError: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
    toastText: { fontSize: 12, fontWeight: '700' }
});

export default NursePatientDocuments;
