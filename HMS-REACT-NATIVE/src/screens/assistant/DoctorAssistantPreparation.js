import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Linking,
    useWindowDimensions
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { assistantAPI } from '../../utils/api';
import {
    getOfflinePreparation,
    savePreparationLocalDraft,
    getPreparationLocalDraft,
    clearPreparationLocalDraft,
    markPreparationReady,
    uploadAssistantReportOnlineOnly
} from '../../services/offline/offlineAssistantService';
import DynamicQuestionForm from '../../components/DynamicQuestionForm';
import { MASTER_DEFAULT_QUESTION_LIBRARY, resolveDepartmentKey } from '../../config/masterQuestionLibrary';
import OfflineBanner from '../../components/OfflineBanner';

const DoctorAssistantPreparation = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const appointmentId = route.params?.appointmentId;

    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [markingReady, setMarkingReady] = useState(false);

    const [appointment, setAppointment] = useState(null);
    const [department, setDepartment] = useState('General');
    const [preparation, setPreparation] = useState(null);
    const [departmentQuestions, setDepartmentQuestions] = useState({});
    const [availableDepartments, setAvailableDepartments] = useState([]);

    // Active Tab in Workspace
    const [activeTab, setActiveTab] = useState('vitals'); // 'vitals' | 'history' | 'questions' | 'reports' | 'investigations' | 'notes'

    // Form States
    const [vitals, setVitals] = useState({
        height: '', weight: '', bmi: '', bp: '', pulse: '',
        temperature: '', spo2: '', rr: '', bloodSugar: '', painScore: ''
    });

    const [clinicalHistory, setClinicalHistory] = useState({
        chiefComplaint: '', historyOfPresentIllness: '', pastMedicalHistory: '',
        pastSurgicalHistory: '', familyHistory: '', allergies: '',
        currentMedicines: '', lifestyle: '', assistantRemarks: ''
    });

    const [questionnaireAnswers, setQuestionnaireAnswers] = useState({});
    const [draftNotes, setDraftNotes] = useState('');
    const [investigations, setInvestigations] = useState([]);
    const [newInvestigation, setNewInvestigation] = useState({ testName: '', notes: '', urgency: 'Routine' });

    // Modals
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [showUrgencyModal, setShowUrgencyModal] = useState(false);

    // Document & Upload states
    const [selectedFile, setSelectedFile] = useState(null); // { uri, name, size, mimeType, file }
    const [uploadingReport, setUploadingReport] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [reportName, setReportName] = useState('');
    const [reportDocType, setReportDocType] = useState('Previous Report');
    const [showDocTypeModal, setShowDocTypeModal] = useState(false);

    const fetchPreparationDetails = useCallback(async (deptToFetch) => {
        if (!appointmentId) return;
        setLoading(true);
        try {
            const params = deptToFetch ? { dept: deptToFetch } : {};
            const res = await getOfflinePreparation(appointmentId, params);

            if (res) {
                setAppointment(res.appointment);
                setDepartment(res.department || 'General');
                setPreparation(res.preparation);
                setDepartmentQuestions(res.departmentQuestions || {});
                setAvailableDepartments(res.availableDepartments || []);

                const p = res.preparation || {};
                const initialVitals = {
                    height: p.vitals?.height || res.appointment?.vitals?.height || '',
                    weight: p.vitals?.weight || res.appointment?.vitals?.weight || '',
                    bmi: p.vitals?.bmi || res.appointment?.vitals?.bmi || '',
                    bp: p.vitals?.bp || res.appointment?.vitals?.bp || '',
                    pulse: p.vitals?.pulse || res.appointment?.vitals?.pulse || '',
                    temperature: p.vitals?.temperature || res.appointment?.vitals?.temperature || '',
                    spo2: p.vitals?.spo2 || res.appointment?.vitals?.spo2 || '',
                    rr: p.vitals?.rr || res.appointment?.vitals?.rr || '',
                    bloodSugar: p.vitals?.bloodSugar || '',
                    painScore: p.vitals?.painScore || ''
                };

                const initialHistory = {
                    chiefComplaint: p.preparation?.chiefComplaint || '',
                    historyOfPresentIllness: p.preparation?.historyOfPresentIllness || '',
                    pastMedicalHistory: p.preparation?.pastMedicalHistory || '',
                    pastSurgicalHistory: p.preparation?.pastSurgicalHistory || '',
                    familyHistory: p.preparation?.familyHistory || '',
                    allergies: p.preparation?.allergies || '',
                    currentMedicines: p.preparation?.currentMedicines || '',
                    lifestyle: p.preparation?.lifestyle || '',
                    assistantRemarks: p.preparation?.assistantRemarks || ''
                };

                const initialAnswers = p.questionnaireAnswers || {};
                const initialNotes = p.draftClinicalNotes || '';
                const initialInvs = p.investigationSuggestions || [];

                // Check if a more recent local draft exists
                const localDraft = await getPreparationLocalDraft(appointmentId);
                if (localDraft?.draftData) {
                    const d = localDraft.draftData;
                    setVitals(d.vitals || initialVitals);
                    setClinicalHistory(d.clinicalHistory || initialHistory);
                    setQuestionnaireAnswers(d.questionnaireAnswers || initialAnswers);
                    setDraftNotes(d.draftNotes || initialNotes);
                    setInvestigations(d.investigations || initialInvs);
                } else {
                    setVitals(initialVitals);
                    setClinicalHistory(initialHistory);
                    setQuestionnaireAnswers(initialAnswers);
                    setDraftNotes(initialNotes);
                    setInvestigations(initialInvs);
                }
            }
        } catch (error) {
            console.error('Preparation fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [appointmentId]);

    useEffect(() => {
        fetchPreparationDetails();
    }, [fetchPreparationDetails]);

    // Save local draft on form change
    const persistDraft = (overrides = {}) => {
        const draft = {
            vitals,
            clinicalHistory,
            questionnaireAnswers,
            draftNotes,
            investigations,
            ...overrides
        };
        savePreparationLocalDraft(appointmentId, draft);
    };

    // BMI Auto-calculation
    const handleVitalsChange = (field, value) => {
        setVitals(prev => {
            const updated = { ...prev, [field]: value };
            if (field === 'height' || field === 'weight') {
                const h = field === 'height' ? value : prev.height;
                const w = field === 'weight' ? value : prev.weight;
                if (h && w && parseFloat(h) > 0 && parseFloat(w) > 0) {
                    const hM = parseFloat(h) / 100;
                    updated.bmi = (parseFloat(w) / (hM * hM)).toFixed(1);
                }
            }
            persistDraft({ vitals: updated });
            return updated;
        });
    };

    // Save Vitals
    const handleSaveVitals = async () => {
        setSaving(true);
        try {
            const res = await assistantAPI.updateVitals(appointmentId, vitals);
            if (res && res.success) {
                setPreparation(res.preparation);
                Alert.alert('Saved', 'Vitals saved successfully');
            } else {
                Alert.alert('Notice', res?.message || 'Failed to save vitals');
            }
        } catch (error) {
            Alert.alert('Saved Locally', 'Network unavailable. Vitals saved as a local draft.');
            persistDraft({ vitals });
        } finally {
            setSaving(false);
        }
    };

    // Save Clinical History
    const handleSaveHistory = async () => {
        setSaving(true);
        try {
            const res = await assistantAPI.updateHistory(appointmentId, clinicalHistory);
            if (res && res.success) {
                setPreparation(res.preparation);
                Alert.alert('Saved', 'Clinical history saved successfully');
            } else {
                Alert.alert('Notice', res?.message || 'Failed to save history');
            }
        } catch (error) {
            Alert.alert('Saved Locally', 'Network unavailable. Clinical history saved as a local draft.');
            persistDraft({ clinicalHistory });
        } finally {
            setSaving(false);
        }
    };

    // Save Questionnaire Answers
    const handleSaveQuestionnaire = async () => {
        setSaving(true);
        try {
            const res = await assistantAPI.updateQuestionnaire(appointmentId, { questionnaireAnswers });
            if (res && res.success) {
                setPreparation(res.preparation);
                Alert.alert('Saved', 'Questionnaire responses saved successfully');
            } else {
                Alert.alert('Notice', res?.message || 'Failed to save questionnaire');
            }
        } catch (error) {
            Alert.alert('Saved Locally', 'Network unavailable. Questionnaire answers saved as a local draft.');
            persistDraft({ questionnaireAnswers });
        } finally {
            setSaving(false);
        }
    };

    // Save Suggested Investigations
    const handleAddInvestigation = () => {
        if (!newInvestigation.testName.trim()) {
            Alert.alert('Required', 'Please enter a test name');
            return;
        }
        const updated = [...investigations, { ...newInvestigation }];
        setInvestigations(updated);
        setNewInvestigation({ testName: '', notes: '', urgency: 'Routine' });
        persistDraft({ investigations: updated });

        assistantAPI.updateInvestigations(appointmentId, { investigations: updated })
            .then(res => { if (res && res.success) setPreparation(res.preparation); })
            .catch(() => {});
    };

    const handleRemoveInvestigation = (index) => {
        const updated = investigations.filter((_, i) => i !== index);
        setInvestigations(updated);
        persistDraft({ investigations: updated });
        assistantAPI.updateInvestigations(appointmentId, { investigations: updated })
            .then(res => { if (res && res.success) setPreparation(res.preparation); })
            .catch(() => {});
    };

    // Save Draft Notes
    const handleSaveDraftNotes = async () => {
        setSaving(true);
        try {
            const res = await assistantAPI.updateNotes(appointmentId, { draftClinicalNotes: draftNotes });
            if (res && res.success) {
                setPreparation(res.preparation);
                Alert.alert('Saved', 'Draft clinical notes saved');
            } else {
                Alert.alert('Notice', res?.message || 'Failed to save notes');
            }
        } catch (error) {
            Alert.alert('Saved Locally', 'Network unavailable. Draft notes saved as a local draft.');
            persistDraft({ draftNotes });
        } finally {
            setSaving(false);
        }
    };

    // Save All Sections
    const handleSaveAll = async () => {
        setSaving(true);
        try {
            await Promise.all([
                assistantAPI.updateVitals(appointmentId, vitals),
                assistantAPI.updateHistory(appointmentId, clinicalHistory),
                assistantAPI.updateQuestionnaire(appointmentId, { questionnaireAnswers }),
                assistantAPI.updateNotes(appointmentId, { draftClinicalNotes: draftNotes })
            ]);
            await clearPreparationLocalDraft(appointmentId);
            await fetchPreparationDetails();
            Alert.alert('Success', 'All preparation sections saved successfully to server');
        } catch (error) {
            persistDraft();
            Alert.alert('Saved Locally', 'Network unavailable. All sections persisted to local draft storage.');
        } finally {
            setSaving(false);
        }
    };

    // Mark Ready for Doctor (Strict Online-Only Gate)
    const handleMarkReady = async () => {
        if (!vitals.bp && !vitals.pulse && !vitals.temperature && !vitals.weight) {
            Alert.alert('Incomplete Vitals', 'Please record patient vitals before marking ready for doctor.');
            setActiveTab('vitals');
            return;
        }

        setMarkingReady(true);
        try {
            // First ensure latest updates are sent
            await Promise.all([
                assistantAPI.updateVitals(appointmentId, vitals),
                assistantAPI.updateHistory(appointmentId, clinicalHistory),
                assistantAPI.updateQuestionnaire(appointmentId, { questionnaireAnswers }),
                assistantAPI.updateNotes(appointmentId, { draftClinicalNotes: draftNotes })
            ]);

            const res = await markPreparationReady(appointmentId);
            if (res && res.success) {
                setPreparation(res.preparation);
                Alert.alert('Ready For Doctor', '🎉 Patient marked READY FOR DOCTOR! Notification dispatched to consulting doctor.');
            } else {
                Alert.alert('Notice', res?.message || 'Failed to mark ready');
            }
        } catch (error) {
            Alert.alert('Action Blocked', error.message || 'Error updating patient status');
        } finally {
            setMarkingReady(false);
        }
    };

    // ── Document Selection & Upload Handlers ──
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit (consistent with web & server)
    const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const ALLOWED_EXTENSIONS = ['pdf', 'jpeg', 'jpg', 'png'];

    const formatFileSize = (bytes) => {
        if (!bytes || isNaN(bytes)) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const validateSelectedFile = (asset) => {
        if (!asset) return { valid: false, error: 'No file selected' };

        if (asset.size && asset.size > MAX_FILE_SIZE) {
            const sizeMb = (asset.size / (1024 * 1024)).toFixed(1);
            return {
                valid: false,
                error: `File size (${sizeMb} MB) exceeds the 10 MB limit. Please select a smaller document.`
            };
        }

        const mime = (asset.mimeType || '').toLowerCase();
        const name = (asset.name || '').toLowerCase();
        const ext = name.split('.').pop() || '';

        const isMimeValid = mime ? ALLOWED_MIME_TYPES.some(t => mime.includes(t) || t === mime) : false;
        const isExtValid = ALLOWED_EXTENSIONS.includes(ext);

        if (!isMimeValid && !isExtValid) {
            return {
                valid: false,
                error: 'Invalid file type. Only JPEG, PNG and PDF documents are supported.'
            };
        }

        return { valid: true };
    };

    const handlePickDocument = async () => {
        if (uploadingReport) return;
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/jpeg', 'image/png'],
                copyToCacheDirectory: true,
                multiple: false
            });

            if (res.canceled) return;

            const asset = res.assets && res.assets.length > 0 ? res.assets[0] : null;
            if (!asset) return;

            const validation = validateSelectedFile(asset);
            if (!validation.valid) {
                Alert.alert('Invalid Document', validation.error);
                return;
            }

            setSelectedFile(asset);
            setUploadError(null);
            if (!reportName.trim()) {
                const baseName = (asset.name || '').replace(/\.[^/.]+$/, '');
                setReportName(baseName || 'Patient Document');
            }
        } catch (err) {
            console.error('File pick error:', err);
            Alert.alert('Error', 'Could not open device file selector');
        }
    };

    const handleClearSelectedFile = () => {
        if (uploadingReport) return;
        setSelectedFile(null);
        setUploadError(null);
    };

    const handleUploadReport = async () => {
        if (uploadingReport) return;

        if (!selectedFile) {
            Alert.alert('File Required', 'Please select a document file to upload (PDF, JPEG, or PNG).');
            return;
        }

        setUploadingReport(true);
        setUploadError(null);

        try {
            const formData = new FormData();

            if (Platform.OS === 'web' && selectedFile.file) {
                formData.append('file', selectedFile.file);
            } else if (Platform.OS === 'web' && selectedFile.uri && (selectedFile.uri.startsWith('blob:') || selectedFile.uri.startsWith('data:'))) {
                try {
                    const resp = await fetch(selectedFile.uri);
                    const blob = await resp.blob();
                    formData.append('file', blob, selectedFile.name || 'document.pdf');
                } catch (e) {
                    formData.append('file', selectedFile);
                }
            } else {
                formData.append('file', {
                    uri: Platform.OS === 'android' ? selectedFile.uri : selectedFile.uri.replace('file://', ''),
                    name: selectedFile.name || 'document.pdf',
                    type: selectedFile.mimeType || (selectedFile.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
                });
            }

            formData.append('name', reportName.trim() || selectedFile.name || 'Medical Document');
            formData.append('docType', reportDocType || 'Previous Report');

            const res = await uploadAssistantReportOnlineOnly(appointmentId, formData);

            if (res && res.success) {
                if (res.preparation) {
                    setPreparation(res.preparation);
                } else {
                    await fetchPreparationDetails();
                }
                setSelectedFile(null);
                setReportName('');
                setUploadError(null);
                Alert.alert('Success', 'Document uploaded successfully to patient record!');
            } else {
                const msg = res?.message || 'Upload failed on server.';
                setUploadError(msg);
                Alert.alert('Upload Failed', msg);
            }
        } catch (error) {
            const msg = error.response?.data?.message || error.message || 'Error uploading document.';
            setUploadError(msg);
            Alert.alert('Upload Failed', msg);
        } finally {
            setUploadingReport(false);
        }
    };

    const handleOpenDocument = (url) => {
        if (!url) {
            Alert.alert('Unavailable', 'No valid document URL available');
            return;
        }
        Linking.openURL(url).catch(err => {
            console.error('Failed to open URL:', err);
            Alert.alert('Error', 'Unable to open document. Please verify your browser or PDF viewer.');
        });
    };

    const patient = appointment?.userId || {};
    const doctor = appointment?.doctorId || {};
    const progress = preparation?.progressPercentage || 0;
    const isReady = preparation?.status === 'ready_for_doctor';
    const isCompleted = preparation?.status === 'completed' || appointment?.status === 'completed';

    const effectiveDepartmentQuestions = useMemo(() => {
        const availableMaster = Object.keys(MASTER_DEFAULT_QUESTION_LIBRARY);
        const matchedKey = resolveDepartmentKey([department], availableMaster);
        const fallbackQs = (matchedKey && MASTER_DEFAULT_QUESTION_LIBRARY[matchedKey]) ? MASTER_DEFAULT_QUESTION_LIBRARY[matchedKey] : {};
        if (departmentQuestions && Object.keys(departmentQuestions).length > 0) {
            return {
                ...fallbackQs,
                ...departmentQuestions
            };
        }
        return fallbackQs;
    }, [department, departmentQuestions]);

    const questionCategories = Object.keys(effectiveDepartmentQuestions || {});

    if (loading && !appointment) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#0ea5e9" />
                <Text style={styles.loadingText}>Loading consultation workspace...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <OfflineBanner />

            {/* Back button */}
            <TouchableOpacity
                style={styles.backBtn}
                onPress={() => navigation.navigate('DoctorAssistantQueue')}
            >
                <Feather name="arrow-left" size={16} color="#0f172a" />
                <Text style={styles.backBtnText}>Back to Queue</Text>
            </TouchableOpacity>

            {/* Patient Header Card */}
            <View style={styles.patientHeaderCard}>
                <View style={styles.patientHeaderLeft}>
                    <View style={styles.patientAvatar}>
                        <Text style={styles.patientAvatarText}>
                            {(patient.name || 'P').charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.patientHeaderDetails}>
                        <Text style={styles.patientName}>{patient.name || 'Unknown Patient'}</Text>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaText}>UHID: {patient.uhid || patient.patientId || 'N/A'}</Text>
                            <Text style={styles.metaText}>• Age/Sex: {patient.age ? `${patient.age}y` : 'N/A'} / {patient.gender || 'N/A'}</Text>
                            {patient.bloodGroup ? <Text style={styles.metaText}>• {patient.bloodGroup}</Text> : null}
                            {patient.phone ? <Text style={styles.metaText}>• {patient.phone}</Text> : null}
                        </View>
                    </View>
                </View>

                <View style={styles.patientHeaderRight}>
                    <View style={styles.doctorTag}>
                        <Text style={styles.doctorTagText}>
                            👨‍⚕️ {doctor.name || appointment?.doctorName || 'Doctor'} • {department}
                        </Text>
                    </View>
                    <View style={styles.statusRow}>
                        <Text style={styles.apptTimeText}>Appt: {appointment?.appointmentTime || 'Today'}</Text>
                        {isReady ? (
                            <View style={[styles.badge, styles.badgeReady]}>
                                <Text style={styles.badgeTextReady}>● Ready For Doctor</Text>
                            </View>
                        ) : isCompleted ? (
                            <View style={[styles.badge, styles.badgeCompleted]}>
                                <Text style={styles.badgeTextCompleted}>✓ Completed</Text>
                            </View>
                        ) : (
                            <View style={[styles.badge, styles.badgeInProgress]}>
                                <Text style={styles.badgeTextInProgress}>● In Preparation</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* Progress & Checklist Banner */}
            <View style={styles.checklistBanner}>
                <View style={styles.progressHeaderRow}>
                    <Feather name="check-square" size={16} color="#0ea5e9" />
                    <Text style={styles.progressTitle}>Preparation Progress: {progress}%</Text>
                </View>
                <View style={styles.checklistPills}>
                    <View style={[styles.chkPill, (vitals.bp || vitals.pulse) && styles.chkPillDone]}>
                        <Text style={[styles.chkPillText, (vitals.bp || vitals.pulse) && styles.chkPillTextDone]}>
                            {(vitals.bp || vitals.pulse) ? '✓' : '○'} Vitals
                        </Text>
                    </View>
                    <View style={[styles.chkPill, clinicalHistory.chiefComplaint && styles.chkPillDone]}>
                        <Text style={[styles.chkPillText, clinicalHistory.chiefComplaint && styles.chkPillTextDone]}>
                            {clinicalHistory.chiefComplaint ? '✓' : '○'} Chief Complaint
                        </Text>
                    </View>
                    <View style={[styles.chkPill, clinicalHistory.historyOfPresentIllness && styles.chkPillDone]}>
                        <Text style={[styles.chkPillText, clinicalHistory.historyOfPresentIllness && styles.chkPillTextDone]}>
                            {clinicalHistory.historyOfPresentIllness ? '✓' : '○'} History
                        </Text>
                    </View>
                    <View style={[styles.chkPill, Object.keys(questionnaireAnswers).length > 0 && styles.chkPillDone]}>
                        <Text style={[styles.chkPillText, Object.keys(questionnaireAnswers).length > 0 && styles.chkPillTextDone]}>
                            {Object.keys(questionnaireAnswers).length > 0 ? '✓' : '○'} {department} Questions
                        </Text>
                    </View>
                    <View style={[styles.chkPill, draftNotes && styles.chkPillDone]}>
                        <Text style={[styles.chkPillText, draftNotes && styles.chkPillTextDone]}>
                            {draftNotes ? '✓' : '○'} Draft Notes
                        </Text>
                    </View>
                </View>
            </View>

            {/* Workspace Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScrollView}>
                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'vitals' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('vitals')}
                    >
                        <Feather name="heart" size={14} color={activeTab === 'vitals' ? '#0ea5e9' : '#64748b'} />
                        <Text style={[styles.tabBtnText, activeTab === 'vitals' && styles.tabBtnTextActive]}>1. Vitals</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('history')}
                    >
                        <Feather name="activity" size={14} color={activeTab === 'history' ? '#0ea5e9' : '#64748b'} />
                        <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>2. History</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'questions' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('questions')}
                    >
                        <Feather name="book-open" size={14} color={activeTab === 'questions' ? '#0ea5e9' : '#64748b'} />
                        <Text style={[styles.tabBtnText, activeTab === 'questions' && styles.tabBtnTextActive]}>3. Questionnaire</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'reports' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('reports')}
                    >
                        <Feather name="paperclip" size={14} color={activeTab === 'reports' ? '#0ea5e9' : '#64748b'} />
                        <Text style={[styles.tabBtnText, activeTab === 'reports' && styles.tabBtnTextActive]}>4. Reports</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'investigations' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('investigations')}
                    >
                        <Feather name="clipboard" size={14} color={activeTab === 'investigations' ? '#0ea5e9' : '#64748b'} />
                        <Text style={[styles.tabBtnText, activeTab === 'investigations' && styles.tabBtnTextActive]}>5. Suggested Tests</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'notes' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('notes')}
                    >
                        <Feather name="file-text" size={14} color={activeTab === 'notes' ? '#0ea5e9' : '#64748b'} />
                        <Text style={[styles.tabBtnText, activeTab === 'notes' && styles.tabBtnTextActive]}>6. Draft Notes</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* TAB 1: VITALS */}
            {activeTab === 'vitals' && (
                <View style={styles.formPanel}>
                    <View style={styles.panelTitleRow}>
                        <Feather name="heart" size={18} color="#ef4444" />
                        <Text style={styles.panelTitle}>Patient Vitals & Biometrics</Text>
                    </View>

                    <View style={styles.formGrid}>
                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>Height (cm)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 170"
                                placeholderTextColor="#94a3b8"
                                value={vitals.height}
                                onChangeText={(val) => handleVitalsChange('height', val)}
                                keyboardType="numeric"
                            />
                        </View>

                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>Weight (kg)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 70"
                                placeholderTextColor="#94a3b8"
                                value={vitals.weight}
                                onChangeText={(val) => handleVitalsChange('weight', val)}
                                keyboardType="numeric"
                            />
                        </View>

                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>BMI (Auto-calculated)</Text>
                            <TextInput
                                style={[styles.input, styles.inputReadOnly]}
                                placeholder="Auto"
                                value={vitals.bmi}
                                editable={false}
                            />
                        </View>

                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>Blood Pressure (mmHg)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 120/80"
                                placeholderTextColor="#94a3b8"
                                value={vitals.bp}
                                onChangeText={(val) => handleVitalsChange('bp', val)}
                            />
                        </View>

                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>Pulse Rate (bpm)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 72"
                                placeholderTextColor="#94a3b8"
                                value={vitals.pulse}
                                onChangeText={(val) => handleVitalsChange('pulse', val)}
                                keyboardType="numeric"
                            />
                        </View>

                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>Temperature (°F)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 98.6"
                                placeholderTextColor="#94a3b8"
                                value={vitals.temperature}
                                onChangeText={(val) => handleVitalsChange('temperature', val)}
                                keyboardType="numeric"
                            />
                        </View>

                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>SpO2 Saturation (%)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 99"
                                placeholderTextColor="#94a3b8"
                                value={vitals.spo2}
                                onChangeText={(val) => handleVitalsChange('spo2', val)}
                                keyboardType="numeric"
                            />
                        </View>

                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>Respiratory Rate (/min)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 16"
                                placeholderTextColor="#94a3b8"
                                value={vitals.rr}
                                onChangeText={(val) => handleVitalsChange('rr', val)}
                                keyboardType="numeric"
                            />
                        </View>

                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>Blood Sugar (mg/dL)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 110"
                                placeholderTextColor="#94a3b8"
                                value={vitals.bloodSugar}
                                onChangeText={(val) => handleVitalsChange('bloodSugar', val)}
                            />
                        </View>
                    </View>

                    {/* Pain Score */}
                    <View style={styles.painScoreSection}>
                        <Text style={styles.fieldLabel}>Pain Score Rating (0 = No Pain, 10 = Unbearable)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.painBar}>
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                                <TouchableOpacity
                                    key={score}
                                    style={[styles.painBtn, String(vitals.painScore) === String(score) && styles.painBtnActive]}
                                    onPress={() => handleVitalsChange('painScore', String(score))}
                                >
                                    <Text style={[styles.painBtnText, String(vitals.painScore) === String(score) && styles.painBtnTextActive]}>
                                        {score}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.saveSectionRow}>
                        <TouchableOpacity
                            style={[styles.btn, styles.btnPrimary]}
                            onPress={handleSaveVitals}
                            disabled={saving}
                        >
                            <Feather name="save" size={14} color="#ffffff" />
                            <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : 'Save Vitals'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* TAB 2: CLINICAL HISTORY */}
            {activeTab === 'history' && (
                <View style={styles.formPanel}>
                    <View style={styles.panelTitleRow}>
                        <Feather name="activity" size={18} color="#0ea5e9" />
                        <Text style={styles.panelTitle}>Preliminary Clinical History & Intake</Text>
                    </View>

                    <View style={styles.formGroupFull}>
                        <Text style={styles.fieldLabel}>Chief Complaint (Primary Reason for Visit) *</Text>
                        <TextInput
                            style={[styles.input, styles.textareaSmall]}
                            multiline
                            numberOfLines={2}
                            placeholder="e.g. Chest discomfort on exertion for 3 days, mild shortness of breath..."
                            placeholderTextColor="#94a3b8"
                            value={clinicalHistory.chiefComplaint}
                            onChangeText={(val) => {
                                setClinicalHistory(prev => ({ ...prev, chiefComplaint: val }));
                                persistDraft({ clinicalHistory: { ...clinicalHistory, chiefComplaint: val } });
                            }}
                        />
                    </View>

                    <View style={styles.formGroupFull}>
                        <Text style={styles.fieldLabel}>History of Present Illness (HPI)</Text>
                        <TextInput
                            style={[styles.input, styles.textareaMedium]}
                            multiline
                            numberOfLines={3}
                            placeholder="Details regarding onset, duration, character, radiation, aggravating & relieving factors..."
                            placeholderTextColor="#94a3b8"
                            value={clinicalHistory.historyOfPresentIllness}
                            onChangeText={(val) => {
                                setClinicalHistory(prev => ({ ...prev, historyOfPresentIllness: val }));
                                persistDraft({ clinicalHistory: { ...clinicalHistory, historyOfPresentIllness: val } });
                            }}
                        />
                    </View>

                    <View style={styles.formGrid}>
                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>Known Allergies</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Penicillin, Peanuts (or None)"
                                placeholderTextColor="#94a3b8"
                                value={clinicalHistory.allergies}
                                onChangeText={(val) => {
                                    setClinicalHistory(prev => ({ ...prev, allergies: val }));
                                    persistDraft({ clinicalHistory: { ...clinicalHistory, allergies: val } });
                                }}
                            />
                        </View>

                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>Current Medicines & Dosages</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Telmisartan 40mg OD, Metformin 500mg BD"
                                placeholderTextColor="#94a3b8"
                                value={clinicalHistory.currentMedicines}
                                onChangeText={(val) => {
                                    setClinicalHistory(prev => ({ ...prev, currentMedicines: val }));
                                    persistDraft({ clinicalHistory: { ...clinicalHistory, currentMedicines: val } });
                                }}
                            />
                        </View>

                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>Past Medical History</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Hypertension (5 yrs), Type 2 Diabetes"
                                placeholderTextColor="#94a3b8"
                                value={clinicalHistory.pastMedicalHistory}
                                onChangeText={(val) => {
                                    setClinicalHistory(prev => ({ ...prev, pastMedicalHistory: val }));
                                    persistDraft({ clinicalHistory: { ...clinicalHistory, pastMedicalHistory: val } });
                                }}
                            />
                        </View>

                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>Past Surgical History</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Appendectomy in 2018"
                                placeholderTextColor="#94a3b8"
                                value={clinicalHistory.pastSurgicalHistory}
                                onChangeText={(val) => {
                                    setClinicalHistory(prev => ({ ...prev, pastSurgicalHistory: val }));
                                    persistDraft({ clinicalHistory: { ...clinicalHistory, pastSurgicalHistory: val } });
                                }}
                            />
                        </View>

                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>Family Medical History</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Father had CAD at age 52, Mother has Type 2 DM"
                                placeholderTextColor="#94a3b8"
                                value={clinicalHistory.familyHistory}
                                onChangeText={(val) => {
                                    setClinicalHistory(prev => ({ ...prev, familyHistory: val }));
                                    persistDraft({ clinicalHistory: { ...clinicalHistory, familyHistory: val } });
                                }}
                            />
                        </View>

                        <View style={styles.fieldWrap}>
                            <Text style={styles.fieldLabel}>Lifestyle / Habits</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Non-smoker, occasional alcohol"
                                placeholderTextColor="#94a3b8"
                                value={clinicalHistory.lifestyle}
                                onChangeText={(val) => {
                                    setClinicalHistory(prev => ({ ...prev, lifestyle: val }));
                                    persistDraft({ clinicalHistory: { ...clinicalHistory, lifestyle: val } });
                                }}
                            />
                        </View>
                    </View>

                    <View style={styles.formGroupFull}>
                        <Text style={styles.fieldLabel}>Assistant Remarks / Observations</Text>
                        <TextInput
                            style={[styles.input, styles.textareaSmall]}
                            multiline
                            numberOfLines={2}
                            placeholder="Any additional observational notes for the consulting doctor..."
                            placeholderTextColor="#94a3b8"
                            value={clinicalHistory.assistantRemarks}
                            onChangeText={(val) => {
                                setClinicalHistory(prev => ({ ...prev, assistantRemarks: val }));
                                persistDraft({ clinicalHistory: { ...clinicalHistory, assistantRemarks: val } });
                            }}
                        />
                    </View>

                    <View style={styles.saveSectionRow}>
                        <TouchableOpacity
                            style={[styles.btn, styles.btnPrimary]}
                            onPress={handleSaveHistory}
                            disabled={saving}
                        >
                            <Feather name="save" size={14} color="#ffffff" />
                            <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : 'Save Clinical History'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* TAB 3: DEPARTMENT QUESTIONNAIRE */}
            {activeTab === 'questions' && (
                <View style={styles.formPanel}>
                    <View style={styles.panelHeaderRow}>
                        <View>
                            <View style={styles.panelTitleRow}>
                                <Feather name="book-open" size={18} color="#0ea5e9" />
                                <Text style={styles.panelTitle}>{department} Clinical Questionnaire</Text>
                            </View>
                            <Text style={styles.panelSubtitle}>
                                Structured clinical questions for {doctor.name || 'Doctor'} ({appointment?.department || department})
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.switchProtocolBtn}
                            onPress={() => setShowDeptModal(true)}
                        >
                            <Text style={styles.switchProtocolText}>Protocol: {department}</Text>
                            <Feather name="chevron-down" size={12} color="#0ea5e9" />
                        </TouchableOpacity>
                    </View>

                    {/* Department Switcher Modal */}
                    <Modal visible={showDeptModal} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Select Intake Protocol</Text>
                                {(availableDepartments.length > 0 ? availableDepartments : [
                                    'General Medicine', 'Cardiology', 'ENT', 'Orthopedics', 'Pediatrics',
                                    'Gynecology & Obstetrics', 'Dermatology', 'Ophthalmology', 'Neurology',
                                    'Gastroenterology', 'Pulmonology', 'Dentistry', 'IVF & Fertility',
                                    'General Surgery', 'Urology'
                                ]).map(d => (
                                    <TouchableOpacity
                                        key={d}
                                        style={styles.modalOption}
                                        onPress={() => {
                                            setDepartment(d);
                                            setShowDeptModal(false);
                                            fetchPreparationDetails(d);
                                        }}
                                    >
                                        <Text style={styles.modalOptionText}>🏥 {d}</Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDeptModal(false)}>
                                    <Text style={styles.modalCloseText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

                    {questionCategories.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>
                                No specific intake questionnaires configured for {department}. Select another specialty above or proceed with vitals and general history.
                            </Text>
                        </View>
                    ) : (
                        questionCategories.map(catName => (
                            <View key={catName} style={{ marginBottom: 16 }}>
                                <DynamicQuestionForm
                                    categoryName={catName}
                                    questions={effectiveDepartmentQuestions[catName] || []}
                                    intakeData={questionnaireAnswers}
                                    setIntakeData={(fn) => {
                                        setQuestionnaireAnswers(prev => {
                                            const updated = typeof fn === 'function' ? fn(prev) : fn;
                                            persistDraft({ questionnaireAnswers: updated });
                                            return updated;
                                        });
                                    }}
                                    readOnly={isCompleted}
                                />
                            </View>
                        ))
                    )}

                    {questionCategories.length > 0 && (
                        <View style={styles.saveSectionRow}>
                            <TouchableOpacity
                                style={[styles.btn, styles.btnPrimary]}
                                onPress={handleSaveQuestionnaire}
                                disabled={saving}
                            >
                                <Feather name="save" size={14} color="#ffffff" />
                                <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : 'Save Questionnaire Responses'}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            {/* TAB 4: REPORTS & FILES */}
            {activeTab === 'reports' && (
                <View style={styles.formPanel}>
                    <View style={styles.panelTitleRow}>
                        <Feather name="paperclip" size={18} color="#0ea5e9" />
                        <Text style={styles.panelTitle}>Previous Reports & External Documents</Text>
                    </View>
                    <Text style={styles.disclaimerText}>
                        Attach previous medical reports, external prescriptions, scan results, or clinical documents for the doctor's review.
                    </Text>

                    {/* Upload Box */}
                    <View style={styles.uploadBox}>
                        <Text style={styles.uploadBoxTitle}>Upload New File / Report</Text>

                        <View style={styles.formGrid}>
                            <View style={styles.fieldWrap}>
                                <Text style={styles.fieldLabel}>Document Title</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Previous 2D Echo, Blood Test"
                                    placeholderTextColor="#94a3b8"
                                    value={reportName}
                                    onChangeText={setReportName}
                                    editable={!uploadingReport}
                                />
                            </View>

                            <View style={styles.fieldWrap}>
                                <Text style={styles.fieldLabel}>Document Type</Text>
                                <TouchableOpacity
                                    style={[styles.docTypeBtn, uploadingReport && styles.btnDisabled]}
                                    onPress={() => !uploadingReport && setShowDocTypeModal(true)}
                                    disabled={uploadingReport}
                                >
                                    <Text style={styles.docTypeText}>{reportDocType}</Text>
                                    <Feather name="chevron-down" size={14} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* File Picker Section */}
                        <View style={{ marginTop: 12 }}>
                            <Text style={styles.fieldLabel}>Select File (PDF, JPEG, PNG • Max 10 MB)</Text>

                            {!selectedFile ? (
                                <TouchableOpacity
                                    style={[styles.filePickerButton, uploadingReport && styles.btnDisabled]}
                                    onPress={handlePickDocument}
                                    disabled={uploadingReport}
                                >
                                    <Feather name="upload-cloud" size={20} color="#0ea5e9" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.filePickerButtonTitle}>Choose Document from Device</Text>
                                        <Text style={styles.filePickerButtonSubtitle}>PDF, JPEG, or PNG up to 10 MB</Text>
                                    </View>
                                    <Feather name="chevron-right" size={16} color="#94a3b8" />
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.selectedFileCard}>
                                    <View style={styles.selectedFileIconWrap}>
                                        <Feather
                                            name={selectedFile.name?.toLowerCase().endsWith('.pdf') ? 'file-text' : 'image'}
                                            size={20}
                                            color="#0284c7"
                                        />
                                    </View>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <Text style={styles.selectedFileName} numberOfLines={1} ellipsizeMode="middle">
                                            {selectedFile.name}
                                        </Text>
                                        <Text style={styles.selectedFileMeta}>
                                            {formatFileSize(selectedFile.size)} • {selectedFile.mimeType || 'Document'}
                                        </Text>
                                    </View>
                                    {!uploadingReport && (
                                        <TouchableOpacity
                                            style={styles.removeFileBtn}
                                            onPress={handleClearSelectedFile}
                                            accessibilityLabel="Remove selected file"
                                        >
                                            <Feather name="x" size={16} color="#ef4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Upload Failure & Honest Retry Notice */}
                        {uploadError && (
                            <View style={styles.uploadErrorBanner}>
                                <Feather name="alert-triangle" size={16} color="#b91c1c" />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.uploadErrorTitle}>Upload Failed</Text>
                                    <Text style={styles.uploadErrorMessage}>{uploadError}</Text>
                                </View>
                            </View>
                        )}

                        {/* Upload Action Button */}
                        <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
                            {selectedFile && uploadError && (
                                <TouchableOpacity
                                    style={[styles.btn, styles.btnSecondary]}
                                    onPress={handleClearSelectedFile}
                                    disabled={uploadingReport}
                                >
                                    <Text style={styles.btnSecondaryText}>Cancel</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[
                                    styles.btn,
                                    styles.btnPrimary,
                                    (!selectedFile || uploadingReport) && styles.btnDisabled
                                ]}
                                onPress={handleUploadReport}
                                disabled={!selectedFile || uploadingReport}
                            >
                                {uploadingReport ? (
                                    <>
                                        <ActivityIndicator size="small" color="#ffffff" />
                                        <Text style={styles.btnPrimaryText}>Uploading...</Text>
                                    </>
                                ) : uploadError ? (
                                    <>
                                        <Feather name="refresh-cw" size={14} color="#ffffff" />
                                        <Text style={styles.btnPrimaryText}>Retry Upload</Text>
                                    </>
                                ) : (
                                    <>
                                        <Feather name="upload-cloud" size={14} color="#ffffff" />
                                        <Text style={styles.btnPrimaryText}>Upload Document</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Doc Type Modal */}
                    <Modal visible={showDocTypeModal} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Select Document Type</Text>
                                {['Previous Report', 'External Prescription', 'Lab Test Result', 'X-Ray / Scan', 'Other Document'].map(t => (
                                    <TouchableOpacity
                                        key={t}
                                        style={styles.modalOption}
                                        onPress={() => { setReportDocType(t); setShowDocTypeModal(false); }}
                                    >
                                        <Text style={[styles.modalOptionText, reportDocType === t && { color: '#0ea5e9', fontWeight: '700' }]}>
                                            {t === 'Previous Report' ? 'Previous Medical Report' : t}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDocTypeModal(false)}>
                                    <Text style={styles.modalCloseText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

                    {/* List of uploaded reports */}
                    <Text style={[styles.fieldLabel, { marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: '700' }]}>
                        Uploaded Patient Documents ({preparation?.reportReferences?.length || 0})
                    </Text>

                    {(preparation?.reportReferences || []).length === 0 ? (
                        <View style={styles.emptyState}>
                            <Feather name="inbox" size={28} color="#94a3b8" style={{ marginBottom: 6 }} />
                            <Text style={styles.emptyStateText}>No previous reports uploaded yet.</Text>
                            <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                Uploaded documents will be immediately accessible to the doctor during consultation.
                            </Text>
                        </View>
                    ) : (
                        <View style={{ gap: 8 }}>
                            {preparation.reportReferences.map((rep, rIdx) => (
                                <View key={rep._id || rep.fileId || rIdx} style={styles.reportItem}>
                                    <View style={styles.reportItemRow}>
                                        <View style={{ flex: 1, marginRight: 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Feather
                                                    name={rep.name?.toLowerCase().endsWith('.pdf') ? 'file-text' : 'image'}
                                                    size={14}
                                                    color="#0284c7"
                                                />
                                                <Text style={styles.reportName}>{rep.name}</Text>
                                            </View>
                                            <Text style={styles.reportMeta}>
                                                {rep.docType} • Uploaded by {rep.uploadedBy || 'Assistant'} on {rep.uploadedAt ? new Date(rep.uploadedAt).toLocaleDateString() : 'Today'}
                                            </Text>
                                        </View>

                                        {rep.url ? (
                                            <TouchableOpacity
                                                style={styles.viewDocBtn}
                                                onPress={() => handleOpenDocument(rep.url)}
                                            >
                                                <Text style={styles.viewDocBtnText}>View Document</Text>
                                                <Feather name="external-link" size={12} color="#0284c7" />
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {/* TAB 5: SUGGESTED INVESTIGATIONS */}
            {activeTab === 'investigations' && (
                <View style={styles.formPanel}>
                    <View style={styles.panelTitleRow}>
                        <Feather name="activity" size={18} color="#0ea5e9" />
                        <Text style={styles.panelTitle}>Suggested Investigations for Doctor Review</Text>
                    </View>
                    <Text style={styles.disclaimerText}>
                        Note: Assistant suggestions are preliminary flags for the consulting doctor. The doctor retains final ordering authority.
                    </Text>

                    {/* Add form */}
                    <View style={styles.invAddForm}>
                        <TextInput
                            style={[styles.input, { flex: 2, minWidth: 150 }]}
                            placeholder="e.g. ECG, CBC, Serum Creatinine"
                            placeholderTextColor="#94a3b8"
                            value={newInvestigation.testName}
                            onChangeText={(val) => setNewInvestigation(prev => ({ ...prev, testName: val }))}
                        />
                        <TextInput
                            style={[styles.input, { flex: 2, minWidth: 150 }]}
                            placeholder="Clinical indication / notes"
                            placeholderTextColor="#94a3b8"
                            value={newInvestigation.notes}
                            onChangeText={(val) => setNewInvestigation(prev => ({ ...prev, notes: val }))}
                        />
                        <TouchableOpacity
                            style={[styles.input, styles.urgencyBtn]}
                            onPress={() => setShowUrgencyModal(true)}
                        >
                            <Text style={styles.urgencyBtnText}>{newInvestigation.urgency}</Text>
                            <Feather name="chevron-down" size={12} color="#64748b" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.btn, styles.btnPrimary]}
                            onPress={handleAddInvestigation}
                        >
                            <Feather name="plus" size={14} color="#ffffff" />
                            <Text style={styles.btnPrimaryText}>Suggest</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Urgency Modal */}
                    <Modal visible={showUrgencyModal} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Select Urgency</Text>
                                {['Routine', 'Urgent', 'Stat'].map(u => (
                                    <TouchableOpacity
                                        key={u}
                                        style={styles.modalOption}
                                        onPress={() => {
                                            setNewInvestigation(prev => ({ ...prev, urgency: u }));
                                            setShowUrgencyModal(false);
                                        }}
                                    >
                                        <Text style={styles.modalOptionText}>{u}</Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowUrgencyModal(false)}>
                                    <Text style={styles.modalCloseText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Modal>

                    {/* List */}
                    {investigations.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>No investigations suggested yet.</Text>
                        </View>
                    ) : (
                        <View style={{ gap: 8, marginTop: 12 }}>
                            {investigations.map((inv, idx) => (
                                <View key={idx} style={styles.invItem}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={styles.invName}>{inv.testName}</Text>
                                            <View style={[styles.urgencyBadge, inv.urgency === 'Urgent' && styles.urgencyBadgeUrgent]}>
                                                <Text style={[styles.urgencyBadgeText, inv.urgency === 'Urgent' && styles.urgencyBadgeTextUrgent]}>
                                                    {inv.urgency}
                                                </Text>
                                            </View>
                                        </View>
                                        {inv.notes ? <Text style={styles.invNotes}>— {inv.notes}</Text> : null}
                                    </View>
                                    <TouchableOpacity onPress={() => handleRemoveInvestigation(idx)}>
                                        <Feather name="trash-2" size={16} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {/* TAB 6: DRAFT CLINICAL NOTES */}
            {activeTab === 'notes' && (
                <View style={styles.formPanel}>
                    <View style={styles.draftNoticeBanner}>
                        <Feather name="alert-circle" size={16} color="#d97706" />
                        <Text style={styles.draftNoticeText}>
                            DRAFT — FOR DOCTOR REVIEW ONLY. This preliminary note will be available for doctor review during consultation.
                        </Text>
                    </View>

                    <View style={styles.panelTitleRow}>
                        <Feather name="file-text" size={18} color="#0ea5e9" />
                        <Text style={styles.panelTitle}>Assistant Draft Clinical Notes</Text>
                    </View>

                    <TextInput
                        style={[styles.input, styles.textareaLarge]}
                        multiline
                        numberOfLines={8}
                        placeholder="Draft clinical intake summary, key observations, and pre-consultation notes for the doctor..."
                        placeholderTextColor="#94a3b8"
                        value={draftNotes}
                        onChangeText={(val) => {
                            setDraftNotes(val);
                            persistDraft({ draftNotes: val });
                        }}
                    />

                    <View style={styles.saveSectionRow}>
                        <TouchableOpacity
                            style={[styles.btn, styles.btnPrimary]}
                            onPress={handleSaveDraftNotes}
                            disabled={saving}
                        >
                            <Feather name="save" size={14} color="#ffffff" />
                            <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : 'Save Draft Notes'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Action Footer Bar */}
            <View style={styles.footerBar}>
                <View style={styles.footerStatus}>
                    <Text style={styles.footerStatusText}>
                        Status: {isReady ? 'Ready For Doctor' : isCompleted ? 'Completed' : 'In Preparation'}
                    </Text>
                    {preparation?.readyAt ? (
                        <Text style={styles.readyAtText}>
                            • Marked ready on {new Date(preparation.readyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    ) : null}
                </View>

                <View style={styles.footerActions}>
                    <TouchableOpacity
                        style={[styles.btn, styles.btnSecondary]}
                        onPress={handleSaveAll}
                        disabled={saving}
                    >
                        <Feather name="save" size={14} color="#0f172a" />
                        <Text style={styles.btnSecondaryText}>{saving ? 'Saving...' : 'Save Progress'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, styles.btnReady, (markingReady || isCompleted) && styles.btnDisabled]}
                        onPress={handleMarkReady}
                        disabled={markingReady || isCompleted}
                    >
                        <Feather name="check-circle" size={14} color="#ffffff" />
                        <Text style={styles.btnReadyText}>
                            {markingReady ? 'Marking Ready...' : isReady ? 'Update Ready Status' : 'MARK READY FOR DOCTOR'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 60,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 12,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
        alignSelf: 'flex-start',
    },
    backBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0f172a',
    },
    patientHeaderCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
    },
    patientHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        minWidth: 260,
    },
    patientAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#0ea5e9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    patientAvatarText: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    patientHeaderDetails: {
        flex: 1,
    },
    patientName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 4,
    },
    metaText: {
        fontSize: 12,
        color: '#64748b',
    },
    patientHeaderRight: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 6,
    },
    doctorTag: {
        backgroundColor: '#f0f9ff',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    doctorTagText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0369a1',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    apptTimeText: {
        fontSize: 11,
        color: '#64748b',
    },
    checklistBanner: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        marginBottom: 16,
    },
    progressHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    progressTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    checklistPills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chkPill: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    chkPillDone: {
        backgroundColor: '#ecfdf5',
    },
    chkPillText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '500',
    },
    chkPillTextDone: {
        color: '#059669',
        fontWeight: '700',
    },
    tabsScrollView: {
        marginBottom: 16,
    },
    tabsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    tabBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    tabBtnActive: {
        backgroundColor: '#e0f2fe',
        borderColor: '#0ea5e9',
    },
    tabBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    tabBtnTextActive: {
        color: '#0284c7',
        fontWeight: '700',
    },
    formPanel: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
        marginBottom: 20,
    },
    panelTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    panelTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    panelSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    panelHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 8,
    },
    switchProtocolBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f0f9ff',
        borderWidth: 1,
        borderColor: '#bae6fd',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    switchProtocolText: {
        fontSize: 12,
        color: '#0284c7',
        fontWeight: '600',
    },
    formGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    fieldWrap: {
        flex: 1,
        minWidth: 140,
    },
    formGroupFull: {
        marginBottom: 12,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 4,
    },
    input: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: '#0f172a',
    },
    inputReadOnly: {
        backgroundColor: '#f8fafc',
        fontWeight: '700',
        color: '#0284c7',
    },
    textareaSmall: {
        minHeight: 60,
        textAlignVertical: 'top',
    },
    textareaMedium: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    textareaLarge: {
        minHeight: 160,
        textAlignVertical: 'top',
    },
    painScoreSection: {
        marginTop: 16,
    },
    painBar: {
        flexDirection: 'row',
        marginTop: 6,
    },
    painBtn: {
        width: 34,
        height: 34,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    painBtnActive: {
        backgroundColor: '#ef4444',
        borderColor: '#ef4444',
    },
    painBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    painBtnTextActive: {
        color: '#ffffff',
    },
    saveSectionRow: {
        marginTop: 18,
        alignItems: 'flex-end',
    },
    uploadBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 14,
        marginBottom: 16,
    },
    uploadBoxTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 10,
    },
    docTypeBtn: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    docTypeText: {
        fontSize: 13,
        color: '#0f172a',
    },
    reportItem: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 12,
    },
    reportItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    reportName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    reportMeta: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    viewDocBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#f0f9ff',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#bae6fd',
    },
    viewDocBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0284c7',
    },
    filePickerButton: {
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    filePickerButtonTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    filePickerButtonSubtitle: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    selectedFileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f9ff',
        borderWidth: 1,
        borderColor: '#bae6fd',
        borderRadius: 8,
        padding: 10,
    },
    selectedFileIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 6,
        backgroundColor: '#e0f2fe',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    selectedFileName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0369a1',
    },
    selectedFileMeta: {
        fontSize: 11,
        color: '#0284c7',
        marginTop: 2,
    },
    removeFileBtn: {
        padding: 6,
        borderRadius: 4,
        backgroundColor: '#fee2e2',
    },
    uploadErrorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 8,
        padding: 10,
        marginTop: 12,
    },
    uploadErrorTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#b91c1c',
    },
    uploadErrorMessage: {
        fontSize: 11,
        color: '#991b1b',
        marginTop: 2,
    },
    disclaimerText: {
        fontSize: 12,
        color: '#64748b',
        marginTop: -8,
        marginBottom: 14,
        fontStyle: 'italic',
    },
    invAddForm: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
    },
    urgencyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        minWidth: 100,
    },
    urgencyBtnText: {
        fontSize: 12,
        color: '#0f172a',
    },
    invItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 10,
    },
    invName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    invNotes: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    urgencyBadge: {
        backgroundColor: '#e0f2fe',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
    },
    urgencyBadgeUrgent: {
        backgroundColor: '#fee2e2',
    },
    urgencyBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#0369a1',
    },
    urgencyBadgeTextUrgent: {
        color: '#b91c1c',
    },
    draftNoticeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fef3c7',
        padding: 10,
        borderRadius: 8,
        marginBottom: 14,
    },
    draftNoticeText: {
        fontSize: 12,
        color: '#92400e',
        flex: 1,
    },
    footerBar: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
    },
    footerStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    footerStatusText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
    },
    readyAtText: {
        fontSize: 11,
        color: '#059669',
        fontWeight: '600',
    },
    footerActions: {
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap',
    },
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 6,
    },
    btnPrimary: {
        backgroundColor: '#0ea5e9',
    },
    btnPrimaryText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 13,
    },
    btnSecondary: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    btnSecondaryText: {
        color: '#0f172a',
        fontWeight: '700',
        fontSize: 13,
    },
    btnReady: {
        backgroundColor: '#059669',
    },
    btnReadyText: {
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    btnDisabled: {
        opacity: 0.6,
    },
    badge: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    badgeReady: {
        backgroundColor: '#ecfdf5',
    },
    badgeTextReady: {
        color: '#059669',
        fontSize: 11,
        fontWeight: '700',
    },
    badgeInProgress: {
        backgroundColor: '#ecfeff',
    },
    badgeTextInProgress: {
        color: '#0891b2',
        fontSize: 11,
        fontWeight: '700',
    },
    badgeCompleted: {
        backgroundColor: '#f5f3ff',
    },
    badgeTextCompleted: {
        color: '#7c3aed',
        fontSize: 11,
        fontWeight: '700',
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 8,
    },
    emptyStateText: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 18,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 12,
    },
    modalOption: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalOptionText: {
        fontSize: 14,
        color: '#334155',
    },
    modalCloseBtn: {
        marginTop: 14,
        paddingVertical: 10,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        alignItems: 'center',
    },
    modalCloseText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },
});

export default DoctorAssistantPreparation;
