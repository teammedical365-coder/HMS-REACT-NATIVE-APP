import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Image,
    Alert,
    Modal,
    TextInput,
    Platform,
    RefreshControl,
    Dimensions
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { patientAPI, receptionAPI, reportAPI, consentAPI } from '../../utils/api';
import { useAuth } from '../../store/hooks';
import DoctorIPDOrdersPanel from '../../components/ipd/DoctorIPDOrdersPanel';
import FamilyHealthTree from './FamilyHealthTree';
import PatientVialsSection from '../../components/vials/PatientVialsSection';

const { width } = Dimensions.get('window');

const UnifiedPatientProfile = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { user: authUser } = useAuth();

    // Patient ID resolution: route param (id or patientId) or current auth user if patient
    const patientId = route.params?.id || route.params?.patientId || authUser?._id || authUser?.id || authUser?.patientId;
    const departmentParam = route.params?.department || 'Unassigned';

    // State
    const [patientData, setPatientData] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('timeline');

    // Consents & Documents
    const [consentList, setConsentList] = useState([]);
    const [documentList, setDocumentList] = useState([]);
    const [currentFollowupStatus, setCurrentFollowupStatus] = useState(null);
    const [consentTemplates, setConsentTemplates] = useState([]);
    const [selectedConsentTemplate, setSelectedConsentTemplate] = useState('');
    const [generatingConsentPdf, setGeneratingConsentPdf] = useState(false);

    // AI Summary
    const [aiLoading, setAiLoading] = useState({});
    const [aiSummaries, setAiSummaries] = useState({});
    const [aiErrors, setAiErrors] = useState({});

    // Modals
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        phone: '',
        email: '',
        age: '',
        gender: '',
        bloodGroup: '',
        address: ''
    });
    const [savingProfile, setSavingProfile] = useState(false);

    const [showAllergyModal, setShowAllergyModal] = useState(false);
    const [newAllergyText, setNewAllergyText] = useState('');
    const [savingAllergy, setSavingAllergy] = useState(false);

    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadType, setUploadType] = useState('document'); // 'document' | 'consent'
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadingDoc, setUploadingDoc] = useState(false);

    // Load data
    const loadProfileData = useCallback(async (isRefresh = false) => {
        if (!patientId) {
            setError('No patient ID provided');
            setLoading(false);
            return;
        }

        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError('');

        try {
            // Full History
            const res = await patientAPI.getFullHistory(patientId, departmentParam);
            if (res && res.success && res.user) {
                setPatientData(res.user);
                setTimeline(Array.isArray(res.timeline) ? res.timeline : []);

                // Initialize edit form
                setEditForm({
                    name: res.user.name || '',
                    phone: res.user.phone || '',
                    email: res.user.email || '',
                    age: String(res.user.age || res.user.fertilityProfile?.age || ''),
                    gender: res.user.gender || res.user.fertilityProfile?.gender || '',
                    bloodGroup: res.user.bloodGroup || res.user.fertilityProfile?.bloodGroup || '',
                    address: res.user.address || ''
                });

                // Consents & documents from fertilityProfile if present
                const fp = res.user.fertilityProfile || {};
                if (Array.isArray(fp.consentForms) && fp.consentForms.length > 0) {
                    setConsentList(fp.consentForms);
                }
                const combinedDocs = [
                    ...(Array.isArray(fp.documents) ? fp.documents : []),
                    ...(Array.isArray(fp.previousReports) ? fp.previousReports.map(r => ({
                        fileName: r.fileName || r.name || 'Medical Report',
                        docType: r.docType || 'Medical Report',
                        url: r.url || r.fileUrl || r.filename,
                        uploadedAt: r.date || r.uploadedAt || new Date().toISOString(),
                        fileId: r.fileId || r._id || null,
                        uploadedBy: 'Doctor'
                    })) : []),
                    ...(Array.isArray(fp.reports) ? fp.reports.map(r => ({
                        fileName: r.name || r.fileName || 'Medical Report',
                        docType: r.docType || 'Medical Report',
                        url: r.url || r.fileUrl || (r.filename ? ((r.filename || '').startsWith('http') ? r.filename : `/api/patients/reports/${encodeURIComponent(r.filename)}`) : null),
                        uploadedAt: r.uploadedAt || r.date || new Date().toISOString(),
                        fileId: r.fileId || r._id || null,
                        uploadedBy: 'Doctor'
                    })) : [])
                ];
                const seen = new Set();
                const uniqueDocs = combinedDocs.filter(d => {
                    const key = d.url || d.fileName;
                    if (key && seen.has(key)) return false;
                    if (key) seen.add(key);
                    return true;
                });
                if (uniqueDocs.length > 0) {
                    setDocumentList(uniqueDocs);
                }
            } else {
                setError('Could not load patient details.');
            }
        } catch (err) {
            console.error('Error fetching patient profile:', err);
            setError(err?.response?.data?.message || 'Failed to load patient profile.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }

        // Secondary fetches (silent catch)
        try {
            const consentRes = await patientAPI.getConsent(patientId);
            if (consentRes?.success && Array.isArray(consentRes.consentForms)) {
                setConsentList(consentRes.consentForms);
            }
        } catch (_) {}

        try {
            const docRes = await patientAPI.getDocuments(patientId, departmentParam);
            if (docRes?.success && Array.isArray(docRes.documents)) {
                setDocumentList(docRes.documents);
            }
        } catch (_) {}

        try {
            const resAuto = await receptionAPI.getFollowupStatus(patientId, 'auto');
            if (resAuto?.success) {
                setCurrentFollowupStatus(resAuto);
            }
        } catch (_) {}

        try {
            const tmplRes = await consentAPI.getTemplates({ status: 'active' });
            if (tmplRes?.success && Array.isArray(tmplRes.data)) {
                setConsentTemplates(tmplRes.data);
                if (tmplRes.data.length > 0 && !selectedConsentTemplate) {
                    setSelectedConsentTemplate(tmplRes.data[0]._id);
                }
            }
        } catch (_) {}
    }, [patientId, departmentParam]);

    useEffect(() => {
        loadProfileData();
    }, [loadProfileData]);

    // Metrics calculation
    const calculateMetrics = () => {
        const safeTimeline = Array.isArray(timeline) ? timeline : [];
        const appointments = safeTimeline.filter(t => t.type === 'appointment' || t.type === 'clinicalVisit');
        const upcoming = safeTimeline.filter(t => {
            if (t.type !== 'appointment') return false;
            const status = (t.data?.status || '').toLowerCase();
            return status === 'pending' || status === 'confirmed' || status === 'scheduled';
        });

        let totalPaid = 0;
        let pendingDues = 0;
        let totalBills = 0;

        safeTimeline.forEach(t => {
            const amt = Number(t.data?.amount || t.data?.totalAmount || t.data?.fee || 0);
            if (!amt) return;
            totalBills += amt;
            const pStatus = (t.data?.paymentStatus || t.data?.status || '').toLowerCase();
            if (pStatus === 'paid' || pStatus === 'completed') {
                totalPaid += amt;
            } else if (pStatus === 'pending' || pStatus === 'due') {
                pendingDues += amt;
            }
        });

        return {
            totalVisits: appointments.length,
            upcomingCount: upcoming.length,
            totalPaid,
            pendingDues,
            totalBills
        };
    };

    // AI Summary Handler
    const handleGenerateSummary = async (fileUrl, mimeType, index, fileName) => {
        if (!fileUrl) {
            Alert.alert('Notice', 'No valid file URL available for AI summary.');
            return;
        }
        setAiLoading(prev => ({ ...prev, [index]: true }));
        setAiErrors(prev => ({ ...prev, [index]: null }));
        try {
            const res = await reportAPI.generateAISummary(fileUrl, mimeType || 'application/pdf');
            if (res && res.success) {
                setAiSummaries(prev => ({ ...prev, [index]: res.summary }));
            } else {
                setAiErrors(prev => ({ ...prev, [index]: res?.message || 'Failed to generate summary.' }));
            }
        } catch (err) {
            console.error('AI Summary error:', err);
            const msg = err?.response?.data?.message || err.message || 'Error generating AI summary.';
            setAiErrors(prev => ({ ...prev, [index]: msg }));
        } finally {
            setAiLoading(prev => ({ ...prev, [index]: false }));
        }
    };

    // PDF Download via expo-print and expo-sharing
    const handleDownloadPDF = async () => {
        if (!patientData) return;
        try {
            const fp = patientData.fertilityProfile || {};
            const vitals = fp.vitals || {};
            const metrics = calculateMetrics();

            const timelineRowsHtml = timeline.slice(0, 15).map(t => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px; font-size: 11px;">${new Date(t.date || Date.now()).toLocaleDateString('en-IN')}</td>
                    <td style="padding: 8px; font-size: 11px; font-weight: bold; color: #2563eb;">${String(t.type || 'Visit').toUpperCase()}</td>
                    <td style="padding: 8px; font-size: 11px;">${t.data?.doctorName || t.data?.doctorConsultation?.doctorId || 'Staff'}</td>
                    <td style="padding: 8px; font-size: 11px;">${t.summary?.primaryComplaint || t.data?.serviceName || t.data?.title || t.data?.testName || 'Consultation'}</td>
                    <td style="padding: 8px; font-size: 11px;"><span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px;">${t.data?.status || 'Recorded'}</span></td>
                </tr>
            `).join('');

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8" />
                    <title>Patient Clinical Summary</title>
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 24px; color: #0f172a; }
                        .header { background: #2563eb; color: #ffffff; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                        .header h1 { margin: 0; font-size: 20px; }
                        .header p { margin: 4px 0 0 0; font-size: 12px; opacity: 0.9; }
                        .grid { display: flex; flex-wrap: wrap; margin-bottom: 16px; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; }
                        .col { width: 50%; margin-bottom: 8px; font-size: 12px; }
                        .col strong { color: #475569; }
                        .vitals-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; margin-bottom: 20px; }
                        .vitals-title { font-size: 12px; font-weight: bold; color: #065f46; margin-bottom: 8px; text-transform: uppercase; }
                        .vitals-pills { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; }
                        .pill { background: #ffffff; border: 1px solid #10b981; padding: 4px 10px; border-radius: 6px; color: #047857; font-weight: bold; }
                        table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                        th { background: #f1f5f9; padding: 8px; font-size: 11px; text-align: left; color: #475569; border-bottom: 2px solid #cbd5e1; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>PATIENT CLINICAL SUMMARY</h1>
                        <p>Hospital Medical Record • Generated on ${new Date().toLocaleDateString('en-IN')}</p>
                    </div>

                    <div class="grid">
                        <div class="col"><strong>Patient Name:</strong> ${patientData.name || '—'}</div>
                        <div class="col"><strong>MRN / Patient ID:</strong> ${patientData.patientId || patientData.mrn || '—'}</div>
                        <div class="col"><strong>Contact Phone:</strong> ${patientData.phone || '—'}</div>
                        <div class="col"><strong>Email:</strong> ${patientData.email || '—'}</div>
                        <div class="col"><strong>Gender / Blood Group:</strong> ${patientData.gender || '—'} / ${patientData.bloodGroup || '—'}</div>
                        <div class="col"><strong>Known Allergies:</strong> ${fp.allergies || 'None recorded'}</div>
                    </div>

                    <div class="vitals-box">
                        <div class="vitals-title">Latest Recorded Clinical Vitals</div>
                        <div class="vitals-pills">
                            <div class="pill">Weight: ${vitals.weight || '—'} kg</div>
                            <div class="pill">Height: ${vitals.height || '—'} cm</div>
                            <div class="pill">BP: ${vitals.bp || vitals.bloodPressure || '—'}</div>
                            <div class="pill">Pulse: ${vitals.pulse || '—'} bpm</div>
                            <div class="pill">SpO2: ${vitals.spo2 || '—'}%</div>
                        </div>
                    </div>

                    <h3>Clinical History & Timeline</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Provider</th>
                                <th>Description / Diagnosis</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${timelineRowsHtml || '<tr><td colspan="5" style="text-align:center; padding: 12px; color: #94a3b8;">No records found.</td></tr>'}
                        </tbody>
                    </table>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    UTI: '.pdf',
                    mimeType: 'application/pdf',
                    dialogTitle: `Patient_Summary_${patientData.patientId || 'Record'}.pdf`
                });
            } else {
                Alert.alert('Success', 'PDF generated successfully: ' + uri);
            }
        } catch (err) {
            console.error('PDF generation error:', err);
            Alert.alert('Error', 'Failed to generate summary PDF: ' + (err.message || 'Unknown error'));
        }
    };

    // Save Demographics
    const handleSaveProfile = async () => {
        if (!editForm.name.trim()) {
            Alert.alert('Required', 'Patient name cannot be empty');
            return;
        }
        setSavingProfile(true);
        try {
            const res = await patientAPI.updateProfile(patientId, editForm);
            if (res && res.success) {
                Alert.alert('Success', 'Patient profile updated successfully!');
                setShowEditModal(false);
                loadProfileData(true);
            } else {
                Alert.alert('Notice', res?.message || 'Profile saved.');
                setShowEditModal(false);
                loadProfileData(true);
            }
        } catch (err) {
            console.error('Update profile error:', err);
            Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to update profile.');
        } finally {
            setSavingProfile(false);
        }
    };

    // Add Allergy
    const handleSaveAllergy = async () => {
        if (!newAllergyText.trim()) return;
        setSavingAllergy(true);
        try {
            const currentAllergies = patientData?.fertilityProfile?.allergies || '';
            const updated = currentAllergies
                ? `${currentAllergies}, ${newAllergyText.trim()}`
                : newAllergyText.trim();

            await patientAPI.updateProfile(patientId, { allergies: updated });
            Alert.alert('Success', 'Allergy added successfully!');
            setNewAllergyText('');
            setShowAllergyModal(false);
            loadProfileData(true);
        } catch (err) {
            console.error('Save allergy error:', err);
            Alert.alert('Error', err?.response?.data?.message || 'Failed to add allergy.');
        } finally {
            setSavingAllergy(false);
        }
    };

    // Document Picker & Upload
    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setSelectedFile(result.assets[0]);
            }
        } catch (err) {
            console.error('Picker error:', err);
            Alert.alert('Error', 'Failed to open file picker.');
        }
    };

    const handleUploadSelectedFile = async () => {
        if (!selectedFile) {
            Alert.alert('Required', 'Please select a file to upload');
            return;
        }
        setUploadingDoc(true);
        try {
            const formData = new FormData();
            const fileObj = {
                uri: selectedFile.uri,
                name: selectedFile.name || 'document.pdf',
                type: selectedFile.mimeType || 'application/pdf'
            };

            if (uploadType === 'consent') {
                formData.append('consentFile', fileObj);
                const res = await patientAPI.uploadConsent(patientData._id || patientId, formData);
                if (res && res.success) {
                    Alert.alert('Success', 'Consent form uploaded successfully!');
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    loadProfileData(true);
                } else {
                    Alert.alert('Error', res?.message || 'Upload failed.');
                }
            } else {
                formData.append('document', fileObj);
                const res = await patientAPI.uploadDocument(patientData._id || patientId, formData);
                if (res && res.success) {
                    Alert.alert('Success', 'Document uploaded successfully!');
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    loadProfileData(true);
                } else {
                    Alert.alert('Error', res?.message || 'Upload failed.');
                }
            }
        } catch (err) {
            console.error('Upload error:', err);
            Alert.alert('Error', err?.response?.data?.message || err.message || 'Upload failed.');
        } finally {
            setUploadingDoc(false);
        }
    };

    // Delete Consent
    const handleDeleteConsent = (index, fileId) => {
        Alert.alert(
            'Delete Consent Form',
            'Are you sure you want to delete this consent form?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await patientAPI.deleteConsent(patientData._id || patientId, index, fileId);
                            if (res && res.success) {
                                setConsentList(prev => prev.filter((_, i) => i !== index));
                                Alert.alert('Success', 'Consent form deleted.');
                            } else {
                                Alert.alert('Error', res?.message || 'Failed to delete.');
                            }
                        } catch (err) {
                            Alert.alert('Error', err?.message || 'Failed to delete consent.');
                        }
                    }
                }
            ]
        );
    };

    // Delete Document
    const handleDeleteDocument = (index, doc) => {
        Alert.alert(
            'Delete Document',
            'Are you sure you want to delete this document?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const fileId = typeof doc === 'object' ? doc.fileId : doc;
                            const url = typeof doc === 'object' ? doc.url : null;
                            const fileName = typeof doc === 'object' ? doc.fileName : null;
                            const res = await patientAPI.deleteDocument(patientData._id || patientId, index, fileId, url, fileName);
                            if (res && res.success) {
                                setDocumentList(prev => prev.filter((_, i) => i !== index));
                                Alert.alert('Success', 'Document deleted.');
                            } else {
                                Alert.alert('Error', res?.message || 'Failed to delete.');
                            }
                        } catch (err) {
                            Alert.alert('Error', err?.message || 'Failed to delete document.');
                        }
                    }
                }
            ]
        );
    };

    // Loading State
    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Loading Unified Patient Record...</Text>
            </View>
        );
    }

    // Error State
    if (error || !patientData) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorTitle}>Unable to access profile</Text>
                <Text style={styles.errorSubtitle}>{error || 'Patient record could not be retrieved.'}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => loadProfileData()}>
                    <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.retryBtn, { backgroundColor: '#64748b', marginTop: 10 }]} onPress={() => navigation.goBack()}>
                    <Text style={styles.retryBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Derived helpers
    const initials = (patientData.name || 'P')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const fp = patientData.fertilityProfile || {};
    const allergiesText = fp.allergies || '';
    const allergiesList = allergiesText
        ? allergiesText.split(',').map(a => a.trim()).filter(Boolean)
        : [];

    const metrics = calculateMetrics();

    // Categorized timeline items
    const safeTimeline = Array.isArray(timeline) ? timeline : [];
    const recentVisits = safeTimeline
        .filter(t => t.type === 'appointment' || t.type === 'clinicalVisit')
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 5);

    const upcomingAppointments = safeTimeline.filter(t => {
        if (t.type !== 'appointment') return false;
        const status = (t.data?.status || '').toLowerCase();
        return status === 'pending' || status === 'confirmed' || status === 'scheduled';
    });

    const medications = safeTimeline.filter(
        t => t.type === 'pharmacyOrder' || (t.type === 'clinicalVisit' && t.data?.prescriptions?.length > 0)
    );

    const recentLabs = safeTimeline.filter(t => t.type === 'labReport');

    const vitalsHistory = safeTimeline.filter(
        t => t.data?.vitals && Object.keys(t.data.vitals).length > 0
    );

    const notesItems = safeTimeline.filter(t => t.data?.notes);

    const financialTransactions = safeTimeline.filter(
        t => t.data?.amount || t.data?.totalAmount || t.data?.fee
    );

    const userRole = String(authUser?.role || '').toLowerCase();
    const dynRole = String(authUser?._roleData?.name || '').toLowerCase();
    const permissions = authUser?._roleData?.permissions || [];
    const canViewVials = ['hospitaladmin', 'centraladmin', 'superadmin', 'reception', 'receptionist', 'doctor', 'clinicdoctor', 'clinic doctor', 'staff', 'frontdesk'].includes(userRole) || 
                         ['hospitaladmin', 'centraladmin', 'superadmin', 'reception', 'receptionist', 'doctor', 'clinicdoctor', 'clinic doctor', 'staff', 'frontdesk'].includes(dynRole) ||
                         permissions.includes('reception_access') ||
                         permissions.includes('admin_manage_roles');

    const tabs = [
        { key: 'timeline', label: 'Timeline' },
        { key: 'ipdOrders', label: '🏥 IPD Orders' },
        { key: 'familyHistory', label: '🌳 Family History' },
        { key: 'clinical', label: 'Clinical History' },
        { key: 'vitals', label: 'Vitals' },
        { key: 'prescriptions', label: 'Prescriptions' },
        { key: 'reports', label: 'Reports' },
        { key: 'notes', label: 'Notes' },
        ...(canViewVials ? [{ key: 'vialManagement', label: '🧪 Vial Storage' }] : []),
        { key: 'documents', label: 'Documents & Consents' },
        { key: 'billing', label: 'Billing & Payments' }
    ];

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadProfileData(true)} colors={['#2563eb']} />}
        >
            {/* ====== TOP HEADER ====== */}
            <View style={styles.topNav}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <View style={styles.breadcrumbRow}>
                    <Text style={styles.breadcrumbText}>Dashboard › </Text>
                    <Text style={[styles.breadcrumbText, styles.breadcrumbActive]}>Unified Patient Profile</Text>
                </View>
            </View>

            {/* ====== IDENTITY CARD ====== */}
            <View style={styles.identityCard}>
                <View style={styles.identityHeaderRow}>
                    <View style={styles.avatarCircle}>
                        {patientData.avatar ? (
                            <Image source={{ uri: patientData.avatar }} style={styles.avatarImg} />
                        ) : (
                            <Text style={styles.avatarInitials}>{initials}</Text>
                        )}
                    </View>
                    <View style={styles.identityInfo}>
                        <View style={styles.nameRow}>
                            <Text style={styles.patientName} numberOfLines={1}>{patientData.name}</Text>
                            <View style={[styles.statusBadge, currentFollowupStatus?.active ? styles.statusActive : styles.statusInactive]}>
                                <Text style={[styles.statusBadgeText, currentFollowupStatus?.active ? styles.statusActiveText : styles.statusInactiveText]}>
                                    {currentFollowupStatus?.active ? 'Active' : 'Inactive'}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.tagWrap}>
                            <View style={[styles.tagChip, styles.tagChipPrimary]}>
                                <Text style={styles.tagChipPrimaryText}>MRN: {patientData.patientId || patientData.mrn || 'N/A'}</Text>
                            </View>
                            <View style={styles.tagChip}>
                                <Text style={styles.tagChipText}>{patientData.age || fp.age ? `${patientData.age || fp.age} Yrs` : 'Age N/A'}</Text>
                            </View>
                            <View style={styles.tagChip}>
                                <Text style={styles.tagChipText}>{patientData.gender || fp.gender || 'Gender N/A'}</Text>
                            </View>
                            <View style={styles.tagChip}>
                                <Text style={styles.tagChipText}>🩸 {patientData.bloodGroup || fp.bloodGroup || 'N/A'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Identity Action Buttons */}
                <View style={styles.identityActionsRow}>
                    <TouchableOpacity style={[styles.headerActionBtn, styles.editBtn]} onPress={() => setShowEditModal(true)}>
                        <Text style={styles.editBtnText}>✏️ Edit Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.headerActionBtn, styles.downloadPdfBtn]} onPress={handleDownloadPDF}>
                        <Text style={styles.downloadPdfBtnText}>📄 Download PDF</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ====== 5 METRICS CARDS ====== */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricsScrollView} contentContainerStyle={styles.metricsContainer}>
                <View style={[styles.metricCard, { borderLeftColor: '#3b82f6' }]}>
                    <Text style={styles.metricLabel}>Total Visits</Text>
                    <Text style={[styles.metricVal, { color: '#1d4ed8' }]}>{metrics.totalVisits}</Text>
                </View>
                <View style={[styles.metricCard, { borderLeftColor: '#f59e0b' }]}>
                    <Text style={styles.metricLabel}>Upcoming</Text>
                    <Text style={[styles.metricVal, { color: '#b45309' }]}>{metrics.upcomingCount}</Text>
                </View>
                <View style={[styles.metricCard, { borderLeftColor: '#8b5cf6' }]}>
                    <Text style={styles.metricLabel}>Total Bills</Text>
                    <Text style={[styles.metricVal, { color: '#6d28d9' }]}>₹{metrics.totalBills.toLocaleString('en-IN')}</Text>
                </View>
                <View style={[styles.metricCard, { borderLeftColor: '#ef4444' }]}>
                    <Text style={styles.metricLabel}>Outstanding</Text>
                    <Text style={[styles.metricVal, { color: '#b91c1c' }]}>₹{metrics.pendingDues.toLocaleString('en-IN')}</Text>
                </View>
                <View style={[styles.metricCard, { borderLeftColor: '#10b981' }]}>
                    <Text style={styles.metricLabel}>Total Paid</Text>
                    <Text style={[styles.metricVal, { color: '#047857' }]}>₹{metrics.totalPaid.toLocaleString('en-IN')}</Text>
                </View>
            </ScrollView>

            {/* ====== ALLERGIES BAR ====== */}
            <View style={styles.allergiesBar}>
                <Text style={styles.allergiesIcon}>🫀</Text>
                <Text style={styles.allergiesLabel}>Allergies:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.allergiesPillsScroll}>
                    {allergiesList.length > 0 ? (
                        allergiesList.map((allergy, idx) => (
                            <View key={idx} style={styles.allergyPill}>
                                <Text style={styles.allergyPillText}>{allergy}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.noAllergiesText}>No allergies recorded</Text>
                    )}
                </ScrollView>
                <TouchableOpacity style={styles.addAllergyBtn} onPress={() => setShowAllergyModal(true)}>
                    <Text style={styles.addAllergyBtnText}>+ Add</Text>
                </TouchableOpacity>
            </View>

            {/* ====== TAB NAVIGATION ====== */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabNavScroll} contentContainerStyle={styles.tabNavContainer}>
                {tabs.map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* ====== TAB CONTENT PANELS ====== */}
            <View style={styles.tabContent}>

                {/* 1. TIMELINE TAB */}
                {activeTab === 'timeline' && (
                    <View>
                        {/* Recent Visits */}
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>🩺 Recent Visits</Text>
                            {recentVisits.length === 0 ? (
                                <Text style={styles.emptyText}>No clinical visits recorded yet.</Text>
                            ) : (
                                recentVisits.map((item, idx) => {
                                    const dateStr = new Date(item.date || Date.now()).toLocaleDateString('en-IN');
                                    const doctor = item.data?.doctorName || item.data?.doctorConsultation?.doctorId || 'Staff';
                                    const complaint = item.summary?.primaryComplaint || item.data?.serviceName || 'Consultation';
                                    const status = item.data?.status || 'Completed';
                                    return (
                                        <View key={idx} style={styles.visitItem}>
                                            <View style={styles.visitItemHeader}>
                                                <Text style={styles.visitItemDate}>{dateStr}</Text>
                                                <View style={styles.statusBadgeSmall}>
                                                    <Text style={styles.statusBadgeSmallText}>{status}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.visitItemComplaint}>{complaint}</Text>
                                            <Text style={styles.visitItemDoctor}>Provider: {doctor}</Text>
                                            {item.data?.vitals && Object.keys(item.data.vitals).length > 0 && (
                                                <View style={styles.vitalsRow}>
                                                    {item.data.vitals.weight && <Text style={styles.vitalsBadge}>Wt: {item.data.vitals.weight}kg</Text>}
                                                    {item.data.vitals.bp && <Text style={styles.vitalsBadge}>BP: {item.data.vitals.bp}</Text>}
                                                    {item.data.vitals.pulse && <Text style={styles.vitalsBadge}>Pulse: {item.data.vitals.pulse}</Text>}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </View>

                        {/* Upcoming Appointments */}
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>📅 Upcoming Appointments</Text>
                            {upcomingAppointments.length === 0 ? (
                                <Text style={styles.emptyText}>No upcoming appointments scheduled.</Text>
                            ) : (
                                upcomingAppointments.map((appt, idx) => (
                                    <View key={idx} style={styles.listItemRow}>
                                        <View style={styles.listItemLeft}>
                                            <Text style={styles.listItemTitle}>{appt.data?.serviceName || 'Hospital Visit'}</Text>
                                            <Text style={styles.listItemSub}>
                                                {new Date(appt.date).toLocaleDateString('en-IN')} • {appt.data?.appointmentTime || 'Scheduled'} with {appt.data?.doctorName || 'Doctor'}
                                            </Text>
                                        </View>
                                        <View style={styles.statusBadgeSmall}>
                                            <Text style={styles.statusBadgeSmallText}>{appt.data?.status || 'Confirmed'}</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* Recent Prescriptions */}
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>💊 Recent Prescriptions</Text>
                            {medications.length === 0 ? (
                                <Text style={styles.emptyText}>No prescriptions found.</Text>
                            ) : (
                                medications.slice(0, 5).map((med, idx) => {
                                    const title = med.data?.medicineName || (med.data?.items ? `${med.data.items.length} Pharmacy Items` : 'Clinical Prescription');
                                    return (
                                        <View key={idx} style={styles.listItemRow}>
                                            <View style={styles.listItemLeft}>
                                                <Text style={styles.listItemTitle}>{title}</Text>
                                                <Text style={styles.listItemSub}>{new Date(med.date).toLocaleDateString('en-IN')} • {med.data?.dosage || med.data?.status || 'Dispensed'}</Text>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    </View>
                )}

                {/* IPD ORDERS TAB */}
                {activeTab === 'ipdOrders' && (
                    <DoctorIPDOrdersPanel
                        patientId={patientData?._id || patientId}
                        patient={patientData}
                    />
                )}

                {/* FAMILY HEALTH TREE TAB */}
                {activeTab === 'familyHistory' && (
                    <View style={{ marginBottom: 16 }}>
                        <FamilyHealthTree
                            patientId={patientData?._id || patientId}
                            patientData={patientData}
                        />
                    </View>
                )}

                {/* VIAL MANAGEMENT TAB */}
                {activeTab === 'vialManagement' && (
                    <View style={{ marginBottom: 16 }}>
                        <PatientVialsSection
                            patientId={patientData?._id || patientId}
                            patientData={patientData}
                        />
                    </View>
                )}

                {/* 2. CLINICAL HISTORY TAB */}
                {activeTab === 'clinical' && (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>📋 Chronological Visit History ({safeTimeline.length})</Text>
                        {safeTimeline.length === 0 ? (
                            <Text style={styles.emptyText}>No clinical records available.</Text>
                        ) : (
                            safeTimeline.map((item, idx) => (
                                <View key={idx} style={styles.historyCard}>
                                    <View style={styles.historyCardHeader}>
                                        <Text style={styles.historyDate}>{new Date(item.date || Date.now()).toLocaleDateString('en-IN')}</Text>
                                        <Text style={styles.historyType}>{String(item.type || 'Visit').toUpperCase()}</Text>
                                    </View>
                                    <Text style={styles.historyDoctor}>Doctor: {item.data?.doctorName || item.data?.doctorConsultation?.doctorId || 'Staff'}</Text>
                                    <Text style={styles.historyTitle}>{item.summary?.primaryComplaint || item.data?.serviceName || item.data?.title || 'Consultation'}</Text>
                                    {item.data?.notes && (
                                        <Text style={styles.historyNotes}>Notes: {item.data.notes}</Text>
                                    )}
                                    {item.data?.vitals && Object.keys(item.data.vitals).length > 0 && (
                                        <View style={styles.vitalsRow}>
                                            {item.data.vitals.weight && <Text style={styles.vitalsBadge}>Weight: {item.data.vitals.weight}kg</Text>}
                                            {item.data.vitals.bp && <Text style={styles.vitalsBadge}>BP: {item.data.vitals.bp}</Text>}
                                            {item.data.vitals.pulse && <Text style={styles.vitalsBadge}>Pulse: {item.data.vitals.pulse}</Text>}
                                        </View>
                                    )}
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* 3. VITALS TAB */}
                {activeTab === 'vitals' && (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>❤️ Patient Vitals History</Text>
                        {vitalsHistory.length === 0 ? (
                            <Text style={styles.emptyText}>No recorded vitals found.</Text>
                        ) : (
                            vitalsHistory.map((item, idx) => (
                                <View key={idx} style={styles.vitalsItemCard}>
                                    <Text style={styles.vitalsItemDate}>{new Date(item.date).toLocaleDateString('en-IN')}</Text>
                                    <View style={styles.vitalsGrid}>
                                        {item.data.vitals.weight && <View style={styles.vitalBox}><Text style={styles.vitalBoxLabel}>Weight</Text><Text style={styles.vitalBoxVal}>{item.data.vitals.weight} kg</Text></View>}
                                        {item.data.vitals.height && <View style={styles.vitalBox}><Text style={styles.vitalBoxLabel}>Height</Text><Text style={styles.vitalBoxVal}>{item.data.vitals.height} cm</Text></View>}
                                        {item.data.vitals.bp && <View style={styles.vitalBox}><Text style={styles.vitalBoxLabel}>BP</Text><Text style={styles.vitalBoxVal}>{item.data.vitals.bp}</Text></View>}
                                        {item.data.vitals.pulse && <View style={styles.vitalBox}><Text style={styles.vitalBoxLabel}>Pulse</Text><Text style={styles.vitalBoxVal}>{item.data.vitals.pulse} bpm</Text></View>}
                                        {item.data.vitals.temperature && <View style={styles.vitalBox}><Text style={styles.vitalBoxLabel}>Temp</Text><Text style={styles.vitalBoxVal}>{item.data.vitals.temperature}°F</Text></View>}
                                        {item.data.vitals.spo2 && <View style={styles.vitalBox}><Text style={styles.vitalBoxLabel}>SpO2</Text><Text style={styles.vitalBoxVal}>{item.data.vitals.spo2}%</Text></View>}
                                        {item.data.vitals.bmi && <View style={styles.vitalBox}><Text style={styles.vitalBoxLabel}>BMI</Text><Text style={styles.vitalBoxVal}>{item.data.vitals.bmi}</Text></View>}
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* 4. PRESCRIPTIONS TAB */}
                {activeTab === 'prescriptions' && (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>💊 Medications & Prescriptions ({medications.length})</Text>
                        {medications.length === 0 ? (
                            <Text style={styles.emptyText}>No medications found.</Text>
                        ) : (
                            medications.map((med, idx) => (
                                <View key={idx} style={styles.listItemRow}>
                                    <View style={styles.listItemLeft}>
                                        <Text style={styles.listItemTitle}>{med.data?.medicineName || 'Prescription'}</Text>
                                        <Text style={styles.listItemSub}>{new Date(med.date).toLocaleDateString('en-IN')} • {med.data?.dosage || 'Dosage N/A'}</Text>
                                    </View>
                                    <View style={styles.statusBadgeSmall}>
                                        <Text style={styles.statusBadgeSmallText}>{med.data?.status || 'Dispensed'}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* 5. REPORTS TAB */}
                {activeTab === 'reports' && (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>🔬 Diagnostic Lab Reports ({recentLabs.length})</Text>
                        {recentLabs.length === 0 ? (
                            <Text style={styles.emptyText}>No lab reports recorded.</Text>
                        ) : (
                            recentLabs.map((lab, idx) => (
                                <View key={idx} style={styles.reportCard}>
                                    <View style={styles.listItemRow}>
                                        <View style={styles.listItemLeft}>
                                            <Text style={styles.listItemTitle}>{lab.data?.testName || lab.data?.reportName || 'Diagnostic Test'}</Text>
                                            <Text style={styles.listItemSub}>{new Date(lab.date).toLocaleDateString('en-IN')} • {lab.data?.reportStatus || 'Completed'}</Text>
                                        </View>
                                    </View>
                                    {(lab.data?.reportFile?.url || lab.data?.fileUrl) && (
                                        <TouchableOpacity
                                            style={styles.aiSummaryBtn}
                                            onPress={() => handleGenerateSummary(lab.data?.reportFile?.url || lab.data?.fileUrl, 'application/pdf', `lab-${idx}`, lab.data?.testName)}
                                        >
                                            <Text style={styles.aiSummaryBtnText}>
                                                {aiLoading[`lab-${idx}`] ? '⏳ Analyzing...' : '✨ AI Summary'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                    {aiSummaries[`lab-${idx}`] && (
                                        <View style={styles.aiSummaryBox}>
                                            <Text style={styles.aiSummaryBoxTitle}>🤖 AI Insights:</Text>
                                            <Text style={styles.aiSummaryBoxContent}>{aiSummaries[`lab-${idx}`]}</Text>
                                        </View>
                                    )}
                                    {aiErrors[`lab-${idx}`] && (
                                        <Text style={styles.aiErrorText}>{aiErrors[`lab-${idx}`]}</Text>
                                    )}
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* 6. NOTES TAB */}
                {activeTab === 'notes' && (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>📝 Clinical Notes ({notesItems.length})</Text>
                        {notesItems.length === 0 ? (
                            <Text style={styles.emptyText}>No clinical notes recorded.</Text>
                        ) : (
                            notesItems.map((note, idx) => (
                                <View key={idx} style={styles.noteItemCard}>
                                    <Text style={styles.noteItemDate}>{new Date(note.date).toLocaleDateString('en-IN')} • {note.data?.doctorName || 'Doctor'}</Text>
                                    <Text style={styles.noteItemContent}>{note.data?.notes}</Text>
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* 7. DOCUMENTS & CONSENTS TAB */}
                {activeTab === 'documents' && (
                    <View>
                        {/* Consent Forms */}
                        <View style={styles.sectionCard}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>🛡️ Consent Forms ({consentList.length})</Text>
                                <TouchableOpacity
                                    style={styles.smallActionBtn}
                                    onPress={() => {
                                        setUploadType('consent');
                                        setSelectedFile(null);
                                        setShowUploadModal(true);
                                    }}
                                >
                                    <Text style={styles.smallActionBtnText}>+ Upload Consent</Text>
                                </TouchableOpacity>
                            </View>
                            {consentList.length === 0 ? (
                                <Text style={styles.emptyText}>No consent forms uploaded.</Text>
                            ) : (
                                consentList.map((c, idx) => (
                                    <View key={idx} style={styles.docItemRow}>
                                        <View style={styles.docInfo}>
                                            <Text style={styles.docName}>{c.fileName || `Consent Form #${idx + 1}`}</Text>
                                            <Text style={styles.docDate}>{c.uploadedAt ? new Date(c.uploadedAt).toLocaleDateString('en-IN') : 'Saved'}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.deleteIconBtn}
                                            onPress={() => handleDeleteConsent(idx, c.fileId)}
                                        >
                                            <Text style={styles.deleteIconText}>🗑️</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* Uploaded Documents */}
                        <View style={styles.sectionCard}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>📁 Reports & Documents ({documentList.length})</Text>
                                <TouchableOpacity
                                    style={styles.smallActionBtn}
                                    onPress={() => {
                                        setUploadType('document');
                                        setSelectedFile(null);
                                        setShowUploadModal(true);
                                    }}
                                >
                                    <Text style={styles.smallActionBtnText}>+ Upload Document</Text>
                                </TouchableOpacity>
                            </View>
                            {documentList.length === 0 ? (
                                <Text style={styles.emptyText}>No documents uploaded.</Text>
                            ) : (
                                documentList.map((doc, idx) => (
                                    <View key={idx} style={styles.docCardContainer}>
                                        <View style={styles.docItemRow}>
                                            <View style={styles.docInfo}>
                                                <Text style={styles.docName}>{doc.fileName || 'Hospital Document'}</Text>
                                                <Text style={styles.docDate}>{doc.docType || 'General'} • {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('en-IN') : 'Saved'}</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.deleteIconBtn}
                                                onPress={() => handleDeleteDocument(idx, doc)}
                                            >
                                                <Text style={styles.deleteIconText}>🗑️</Text>
                                            </TouchableOpacity>
                                        </View>
                                        {doc.url && (
                                            <TouchableOpacity
                                                style={styles.aiSummaryBtn}
                                                onPress={() => handleGenerateSummary(doc.url, 'application/pdf', `doc-${idx}`, doc.fileName)}
                                            >
                                                <Text style={styles.aiSummaryBtnText}>
                                                    {aiLoading[`doc-${idx}`] ? '⏳ Analyzing...' : '✨ AI Summary'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                        {aiSummaries[`doc-${idx}`] && (
                                            <View style={styles.aiSummaryBox}>
                                                <Text style={styles.aiSummaryBoxTitle}>🤖 AI Insights:</Text>
                                                <Text style={styles.aiSummaryBoxContent}>{aiSummaries[`doc-${idx}`]}</Text>
                                            </View>
                                        )}
                                        {aiErrors[`doc-${idx}`] && (
                                            <Text style={styles.aiErrorText}>{aiErrors[`doc-${idx}`]}</Text>
                                        )}
                                    </View>
                                ))
                            )}
                        </View>
                    </View>
                )}

                {/* 8. BILLING & PAYMENTS TAB */}
                {activeTab === 'billing' && (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>💳 Financial Transactions ({financialTransactions.length})</Text>
                        {financialTransactions.length === 0 ? (
                            <Text style={styles.emptyText}>No payments recorded.</Text>
                        ) : (
                            financialTransactions.map((t, idx) => {
                                const amt = Number(t.data?.amount || t.data?.totalAmount || t.data?.fee || 0);
                                const pStatus = (t.data?.paymentStatus || t.data?.status || 'recorded').toLowerCase();
                                const isPaid = pStatus.includes('paid') || pStatus.includes('completed');
                                return (
                                    <View key={idx} style={styles.billingItemRow}>
                                        <View>
                                            <Text style={styles.billingItemDate}>{new Date(t.date).toLocaleDateString('en-IN')}</Text>
                                            <Text style={styles.billingItemMethod}>{t.data?.paymentMethod || 'Hospital Counter'}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.billingItemAmt}>₹{amt.toLocaleString('en-IN')}</Text>
                                            <Text style={[styles.billingItemStatus, isPaid ? styles.paidStatus : styles.pendingStatus]}>
                                                {isPaid ? 'Paid' : 'Pending'}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>
                )}
            </View>

            {/* ====== EDIT PROFILE MODAL ====== */}
            <Modal visible={showEditModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>✏️ Edit Demographics</Text>
                        <ScrollView style={{ maxHeight: 400 }}>
                            <Text style={styles.inputLabel}>Full Name</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editForm.name}
                                onChangeText={v => setEditForm(prev => ({ ...prev, name: v }))}
                                placeholder="Patient Full Name"
                            />

                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editForm.phone}
                                onChangeText={v => setEditForm(prev => ({ ...prev, phone: v }))}
                                keyboardType="phone-pad"
                                placeholder="Phone"
                            />

                            <Text style={styles.inputLabel}>Email</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editForm.email}
                                onChangeText={v => setEditForm(prev => ({ ...prev, email: v }))}
                                keyboardType="email-address"
                                placeholder="Email"
                            />

                            <Text style={styles.inputLabel}>Age</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editForm.age}
                                onChangeText={v => setEditForm(prev => ({ ...prev, age: v }))}
                                keyboardType="numeric"
                                placeholder="Age"
                            />

                            <Text style={styles.inputLabel}>Gender</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editForm.gender}
                                onChangeText={v => setEditForm(prev => ({ ...prev, gender: v }))}
                                placeholder="Male / Female / Other"
                            />

                            <Text style={styles.inputLabel}>Blood Group</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editForm.bloodGroup}
                                onChangeText={v => setEditForm(prev => ({ ...prev, bloodGroup: v }))}
                                placeholder="e.g. O+, B+, A+"
                            />

                            <Text style={styles.inputLabel}>Address</Text>
                            <TextInput
                                style={styles.textInput}
                                value={editForm.address}
                                onChangeText={v => setEditForm(prev => ({ ...prev, address: v }))}
                                placeholder="Address"
                            />
                        </ScrollView>

                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setShowEditModal(false)}>
                                <Text style={styles.cancelModalBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveModalBtn} onPress={handleSaveProfile} disabled={savingProfile}>
                                <Text style={styles.saveModalBtnText}>{savingProfile ? 'Saving...' : 'Save Changes'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ====== ADD ALLERGY MODAL ====== */}
            <Modal visible={showAllergyModal} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>🫀 Add Known Allergy</Text>
                        <Text style={styles.inputLabel}>Allergy Name or Substance</Text>
                        <TextInput
                            style={styles.textInput}
                            value={newAllergyText}
                            onChangeText={setNewAllergyText}
                            placeholder="e.g. Penicillin, Peanuts, Sulfa"
                        />
                        <View style={styles.quickAllergiesRow}>
                            {['Penicillin', 'Sulfa', 'Aspirin', 'Latex', 'Peanuts'].map(item => (
                                <TouchableOpacity key={item} style={styles.quickAllergyChip} onPress={() => setNewAllergyText(item)}>
                                    <Text style={styles.quickAllergyChipText}>+{item}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setShowAllergyModal(false)}>
                                <Text style={styles.cancelModalBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveModalBtn} onPress={handleSaveAllergy} disabled={savingAllergy}>
                                <Text style={styles.saveModalBtnText}>{savingAllergy ? 'Saving...' : 'Add Allergy'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ====== UPLOAD DOCUMENT / CONSENT MODAL ====== */}
            <Modal visible={showUploadModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>
                            {uploadType === 'consent' ? '🛡️ Upload Consent Form' : '📁 Upload Patient Document'}
                        </Text>
                        <TouchableOpacity style={styles.pickerBox} onPress={handlePickDocument}>
                            <Text style={styles.pickerBoxIcon}>📄</Text>
                            <Text style={styles.pickerBoxText}>
                                {selectedFile ? selectedFile.name : 'Tap to select PDF or Image file'}
                            </Text>
                        </TouchableOpacity>
                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setShowUploadModal(false)}>
                                <Text style={styles.cancelModalBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveModalBtn, !selectedFile && { opacity: 0.6 }]}
                                onPress={handleUploadSelectedFile}
                                disabled={!selectedFile || uploadingDoc}
                            >
                                <Text style={styles.saveModalBtnText}>{uploadingDoc ? 'Uploading...' : 'Upload'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f8fafc' },
    loadingText: { marginTop: 12, color: '#2563eb', fontWeight: '700', fontSize: 15 },
    errorIcon: { fontSize: 36, marginBottom: 8 },
    errorTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
    errorSubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 16 },
    retryBtn: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
    retryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },

    topNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    backButton: { marginRight: 12, paddingVertical: 4 },
    backButtonText: { color: '#2563eb', fontWeight: '700', fontSize: 14 },
    breadcrumbRow: { flexDirection: 'row', alignItems: 'center' },
    breadcrumbText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    breadcrumbActive: { color: '#0f172a', fontWeight: '700' },

    identityCard: { backgroundColor: '#ffffff', margin: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
    identityHeaderRow: { flexDirection: 'row', alignItems: 'center' },
    avatarCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    avatarImg: { width: '100%', height: '100%' },
    avatarInitials: { color: '#ffffff', fontSize: 24, fontWeight: '800' },
    identityInfo: { marginLeft: 14, flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    patientName: { fontSize: 18, fontWeight: '800', color: '#0f172a', flex: 1 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    statusActive: { backgroundColor: '#dcfce7' },
    statusInactive: { backgroundColor: '#f1f5f9' },
    statusBadgeText: { fontSize: 11, fontWeight: '700' },
    statusActiveText: { color: '#15803d' },
    statusInactiveText: { color: '#64748b' },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tagChip: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    tagChipText: { fontSize: 11, color: '#475569', fontWeight: '600' },
    tagChipPrimary: { backgroundColor: '#eff6ff' },
    tagChipPrimaryText: { fontSize: 11, color: '#2563eb', fontWeight: '700' },

    identityActionsRow: { flexDirection: 'row', gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    headerActionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    editBtn: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1' },
    editBtnText: { color: '#1e293b', fontWeight: '700', fontSize: 13 },
    downloadPdfBtn: { backgroundColor: '#2563eb' },
    downloadPdfBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },

    metricsScrollView: { marginHorizontal: 16, marginBottom: 12 },
    metricsContainer: { flexDirection: 'row', gap: 10 },
    metricCard: { backgroundColor: '#ffffff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4, minWidth: 110 },
    metricLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', marginBottom: 4 },
    metricVal: { fontSize: 16, fontWeight: '800' },

    allergiesBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', marginHorizontal: 16, marginBottom: 16, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' },
    allergiesIcon: { fontSize: 16, marginRight: 6 },
    allergiesLabel: { fontSize: 12, fontWeight: '800', color: '#991b1b', marginRight: 8 },
    allergiesPillsScroll: { flex: 1 },
    allergyPill: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginRight: 6, borderWidth: 1, borderColor: '#fca5a5' },
    allergyPillText: { fontSize: 11, color: '#b91c1c', fontWeight: '700' },
    noAllergiesText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
    addAllergyBtn: { backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
    addAllergyBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },

    tabNavScroll: { backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    tabNavContainer: { paddingHorizontal: 16 },
    tabBtn: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabBtnActive: { borderBottomColor: '#2563eb' },
    tabBtnText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    tabBtnTextActive: { color: '#2563eb', fontWeight: '800' },

    tabContent: { padding: 16 },
    sectionCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
    emptyText: { color: '#94a3b8', fontSize: 13, fontStyle: 'italic', paddingVertical: 8 },

    visitItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    visitItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    visitItemDate: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
    statusBadgeSmall: { backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    statusBadgeSmallText: { fontSize: 10, fontWeight: '700', color: '#2563eb' },
    visitItemComplaint: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
    visitItemDoctor: { fontSize: 12, color: '#64748b' },
    vitalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    vitalsBadge: { backgroundColor: '#f0fdf4', color: '#166534', fontSize: 11, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#bbf7d0' },

    listItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    listItemLeft: { flex: 1, marginRight: 10 },
    listItemTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    listItemSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

    historyCard: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    historyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    historyDate: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    historyType: { fontSize: 11, fontWeight: '800', color: '#2563eb' },
    historyDoctor: { fontSize: 12, color: '#475569', fontWeight: '600', marginBottom: 2 },
    historyTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    historyNotes: { fontSize: 12, color: '#64748b', marginTop: 4, fontStyle: 'italic' },

    vitalsItemCard: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    vitalsItemDate: { fontSize: 12, fontWeight: '700', color: '#2563eb', marginBottom: 8 },
    vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    vitalBox: { backgroundColor: '#f8fafc', padding: 8, borderRadius: 6, minWidth: 80, borderWidth: 1, borderColor: '#e2e8f0' },
    vitalBoxLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: '700' },
    vitalBoxVal: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginTop: 2 },

    reportCard: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    aiSummaryBtn: { alignSelf: 'flex-start', backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 6, borderWidth: 1, borderColor: '#bfdbfe' },
    aiSummaryBtnText: { color: '#2563eb', fontSize: 11, fontWeight: '700' },
    aiSummaryBox: { backgroundColor: '#f0fdf4', padding: 10, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: '#bbf7d0' },
    aiSummaryBoxTitle: { fontSize: 11, fontWeight: '800', color: '#166534', marginBottom: 4 },
    aiSummaryBoxContent: { fontSize: 12, color: '#14532d', lineHeight: 18 },
    aiErrorText: { color: '#ef4444', fontSize: 11, marginTop: 4 },

    noteItemCard: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    noteItemDate: { fontSize: 11, color: '#64748b', fontWeight: '600', marginBottom: 4 },
    noteItemContent: { fontSize: 13, color: '#1e293b', lineHeight: 18 },

    docCardContainer: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    docItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    docInfo: { flex: 1 },
    docName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    docDate: { fontSize: 11, color: '#64748b', marginTop: 2 },
    deleteIconBtn: { padding: 8 },
    deleteIconText: { fontSize: 16 },
    smallActionBtn: { backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    smallActionBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },

    billingItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    billingItemDate: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    billingItemMethod: { fontSize: 11, color: '#64748b', marginTop: 2 },
    billingItemAmt: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
    billingItemStatus: { fontSize: 11, fontWeight: '700', marginTop: 2 },
    paidStatus: { color: '#15803d' },
    pendingStatus: { color: '#b91c1c' },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20 },
    modalTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 14 },
    inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4, marginTop: 8 },
    textInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#0f172a', backgroundColor: '#f8fafc' },
    quickAllergiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    quickAllergyChip: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    quickAllergyChipText: { fontSize: 11, color: '#475569', fontWeight: '600' },
    modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
    cancelModalBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#f1f5f9' },
    cancelModalBtnText: { color: '#475569', fontWeight: '700', fontSize: 13 },
    saveModalBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#2563eb' },
    saveModalBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
    pickerBox: { borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 12, padding: 24, alignItems: 'center', justifyContent: 'center', marginVertical: 14, backgroundColor: '#f8fafc' },
    pickerBoxIcon: { fontSize: 32, marginBottom: 8 },
    pickerBoxText: { fontSize: 13, color: '#475569', fontWeight: '600', textAlign: 'center' }
});

export default UnifiedPatientProfile;
