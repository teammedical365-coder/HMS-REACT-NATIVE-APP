import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TouchableOpacity, 
    TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, 
    Platform, useWindowDimensions 
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Feather, FontAwesome5 } from '@expo/vector-icons';

import { 
    doctorAPI, labTestAPI, questionLibraryAPI, hospitalAPI, 
    patientAPI, receptionAPI, otAPI, adminEntitiesAPI, referralAPI, publicAPI 
} from '../../utils/api';
import { useAuth } from '../../store/hooks';

// Dynamic / child components
import DynamicQuestionForm from '../../components/DynamicQuestionForm';
import AppointmentReports from '../../components/AppointmentReports';
import DoctorIPDOrdersPanel from '../../components/ipd/DoctorIPDOrdersPanel';

const doseOptions = [
    'OD – Once Daily',
    'BD – Twice Daily',
    'TDS – Three Times Daily',
    'QID – Four Times Daily',
    'OM – Every Morning',
    'ON – Every Night',
    'QOD – Every Alternate Day',
    'OW – Once Weekly',
    'SOS – As Needed'
];

const timingOptions = [
    'Before Breakfast (BBF)',
    'After Breakfast (ABF)',
    'Before Lunch (BL)',
    'After Lunch (AL)',
    'Before Dinner (BDN)',
    'After Dinner (ADN)',
    'Before Meals (AC)',
    'After Meals (PC)',
    'With Food',
    'On Empty Stomach',
    'At Bedtime (HS)'
];

const isDocumentFileName = (str) => {
    if (!str || typeof str !== 'string') return false;
    const trimmed = str.trim();
    if (/\.(jpe?g|png|webp|gif|bmp|svg|pdf|docx?|xlsx?|txt|csv)$/i.test(trimmed)) return true;
    if (/^(WhatsApp Image|Screenshot|IMG[-_]|PXL[-_]|Scan[-_]|Document[-_])/i.test(trimmed)) return true;
    if (/^(https?:\/\/|blob:|data:|file:\/\/)/i.test(trimmed)) return true;
    return false;
};

const isValidMedicineRecord = (item) => {
    if (!item) return false;
    if (typeof item === 'string') {
        const trimmed = item.trim();
        return trimmed.length > 0 && !isDocumentFileName(trimmed);
    }
    if (typeof item !== 'object') return false;
    
    // Completely reject any object containing file / document / report metadata
    if (item.url || item.fileUrl || item.mimetype || item.mimeType || item.uploadedAt || item.source === 'report' || item.source === 'prescription') {
        return false;
    }
    
    // Medicine name must not match document or file formats
    const medName = (item.medicineName || item.medicine || (item.name && !isDocumentFileName(item.name)) || '').trim();
    if (!medName || isDocumentFileName(medName)) {
        return false;
    }
    return true;
};

const extractMedicinesFromAppt = (appt) => {
    if (!appt) return [];
    let list = [];
    // Only accept valid pharmacy or doctorConsultation medicines - NEVER appt.prescriptions or reports (which are uploaded files)
    if (Array.isArray(appt.pharmacy) && appt.pharmacy.length > 0) {
        list = appt.pharmacy;
    } else if (Array.isArray(appt.medicines) && appt.medicines.length > 0) {
        list = appt.medicines;
    } else if (Array.isArray(appt.doctorConsultation?.medicines) && appt.doctorConsultation.medicines.length > 0) {
        list = appt.doctorConsultation.medicines;
    } else if (Array.isArray(appt.doctorConsultation?.prescription) && appt.doctorConsultation.prescription.length > 0) {
        list = appt.doctorConsultation.prescription;
    }
    
    return list
        .filter(isValidMedicineRecord)
        .map(p => {
            if (typeof p === 'string') return { medicineName: p.trim(), saltName: '', dose: '', days: '7' };
            const medName = (p.medicineName || p.medicine || p.name || '').trim();
            const salt = (p.saltName || p.genericName || p.instructions || p.timing || '').trim();
            const doseVal = (p.frequency || p.dose || p.dosage || '').trim();
            const daysVal = String(p.duration || p.days || (p.period ? p.period : '') || '7').trim();
            return {
                medicineName: medName,
                saltName: salt,
                dose: doseVal,
                days: daysVal
            };
        })
        .filter(m => m.medicineName && !isDocumentFileName(m.medicineName));
};

const extractLabTestsFromAppt = (appt) => {
    if (!appt) return '';
    const raw = appt.labTests || appt.labOrders || appt.doctorConsultation?.labTests || [];
    if (typeof raw === 'string') return isDocumentFileName(raw) ? '' : raw;
    if (Array.isArray(raw)) {
        return raw.map(t => {
            if (typeof t === 'string') return isDocumentFileName(t) ? '' : t;
            if (t?.url || t?.fileUrl || t?.mimeType) return '';
            const testName = t.name || t.testName || t.testId?.name || '';
            return isDocumentFileName(testName) ? '' : testName;
        }).filter(Boolean).join(', ');
    }
    return '';
};

const isValAvailable = (val) => {
    return val && val !== '-' && val !== 'None' && val.toString().trim() !== '';
};

const DoctorPatientDetails = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isTablet = width > 768;

    const id = route.params?.id || route.params?.patientId;
    const [appointmentId, setAppointmentId] = useState(route.params?.appointmentId);

    const { user } = useAuth();
    
    // Check if the current user is a Junior Doctor
    const roleName = user?._roleData?.name?.toLowerCase() || (typeof user?.role === 'string' ? user.role.toLowerCase() : '');
    const isJrDoctor = roleName.includes('jr') && roleName.includes('doctor');
    const [medSearch, setMedSearch] = useState('');

    const [appointment, setAppointment] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [catalogTests, setCatalogTests] = useState([]);
    const [catalogMedicines, setCatalogMedicines] = useState([]);
    const [dynamicLibrary, setDynamicLibrary] = useState(null);
    const [hospitalDepartments, setHospitalDepartments] = useState([]);
    const [isLocked, setIsLocked] = useState(false);
    const [hospitalContext, setHospitalContext] = useState(null);

    // Modal States
    const [showPrescribeModal, setShowPrescribeModal] = useState(false);
    const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
    const [prescriptionMode, setPrescriptionMode] = useState('slip'); // 'slip' | 'cumulative'

    // Surgery Plan States
    const [operationRequired, setOperationRequired] = useState(false);
    const [showSurgeryPlanModal, setShowSurgeryPlanModal] = useState(false);
    const [surgeonsList, setSurgeonsList] = useState([]);
    const [surgeryPlanData, setSurgeryPlanData] = useState({
        surgery: '', diagnosis: '', surgeonId: '', preferredDate: '', preferredTime: '', admissionRequired: false, admissionDate: '', preOpRequired: false, notes: '', referralId: '', referringDoctorId: ''
    });

    // Referral States
    const [showReferralModal, setShowReferralModal] = useState(false);
    const [referralData, setReferralData] = useState({ referredToDoctorId: '', reason: '', notes: '' });
    const [patientReferrals, setPatientReferrals] = useState([]);
    const [showReferralReviewModal, setShowReferralReviewModal] = useState(false);
    const [activeReferralForReview, setActiveReferralForReview] = useState(null);

    // Tab State for Left Panel
    const [activeTab, setActiveTab] = useState('overview');

    // Time Machine Feature State
    const [viewingPastSession, setViewingPastSession] = useState(null);

    // Doctor's Session Notepad (Right Panel)
    const [sessionData, setSessionData] = useState({
        diagnosis: '', notes: '', medicines: [], labTests: ''
    });

    // Patient Intake Profile (Left Panel - Editable by Doctor)
    const [intakeData, setIntakeData] = useState({});

    // Follow-up status for Patient
    const [currentFollowupStatus, setCurrentFollowupStatus] = useState(null);

    // Tab Scroll ref
    const tabsScrollViewRef = useRef(null);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            try {
                let currentApptId = appointmentId || route.params?.appointmentId;
                let refObj = route.params?.referral || null;

                // 1. If referralId is passed, fetch referral data
                if (route.params?.referralId && !refObj) {
                    try {
                        const refRes = await referralAPI.getById(route.params.referralId);
                        if (refRes.success && refRes.referral) {
                            refObj = refRes.referral;
                        }
                    } catch(e) { console.error("Error fetching referral by ID", e); }
                }

                if (refObj) {
                    setActiveReferralForReview(refObj);
                    if (!currentApptId && refObj.appointmentId) {
                        currentApptId = typeof refObj.appointmentId === 'object' ? refObj.appointmentId._id : refObj.appointmentId;
                    }
                    setSurgeryPlanData(prev => ({
                        ...prev,
                        surgery: refObj.reason || prev.surgery,
                        diagnosis: refObj.notes || prev.diagnosis,
                        referralId: refObj._id,
                        referringDoctorId: refObj.referringDoctorId?._id || refObj.referringDoctorId || ''
                    }));
                }

                // 2. If no appointmentId yet, search across all appointments
                if (!currentApptId && id) {
                    try {
                        const apptsRes = await doctorAPI.getAllAppointments().catch(() => null) || await doctorAPI.getAppointments().catch(() => null);
                        if (apptsRes && apptsRes.success) {
                            const ptAppts = (apptsRes.appointments || []).filter(a => 
                                a.userId?.patientId === id || 
                                a.clinicPatientId?.patientUid === id || 
                                a.patientId === id ||
                                (a.userId?._id && a.userId._id.toString() === id.toString()) ||
                                (a.userId?.name || '').replace(/\s+/g, '-') === id ||
                                (a.clinicPatientId?.name || '').replace(/\s+/g, '-') === id ||
                                a._id === id
                            );
                            if (ptAppts.length > 0) {
                                currentApptId = ptAppts[0]._id;
                                setAppointmentId(currentApptId);
                            }
                        }
                    } catch(e) { console.error("Error finding appointment", e); }
                }

                // 3. If we have an appointment ID, fetch full appointment details
                if (currentApptId) {
                    const res = await doctorAPI.getAppointmentDetails(currentApptId);
                    if (res.success && res.appointment) {
                        setAppointment(res.appointment);
                        const cp = res.appointment.clinicPatientId || {};
                        const fert = res.appointment.userId?.fertilityProfile || {};
                        setIntakeData({
                            ...cp,
                            ...fert,
                            ...(cp.vitals || {}),
                            age: cp.age || fert.age || res.appointment.userId?.age || '',
                            gender: cp.gender || fert.gender || res.appointment.userId?.gender || '',
                            bloodGroup: cp.bloodGroup || fert.bloodGroup || '',
                            address: cp.address || fert.address || '',
                            allergies: cp.allergies || fert.allergies || '',
                            chronicConditions: cp.chronicConditions || fert.chronicConditions || ''
                        });
                        
                        // Lock if completed
                        if (res.appointment.status === 'completed') {
                            setIsLocked(true);
                            Alert.alert('Session Completed', 'This consultation has already been completed. This record is now read-only.');
                        }

                        const pId = res.appointment.clinicPatientId?._id || res.appointment.clinicPatientId || res.appointment.userId?._id;
                        const deptContext = res.appointment.department || res.appointment.serviceName || 'Unassigned';
                        if (pId) {
                            const histRes = await doctorAPI.getPatientHistory(pId, deptContext);
                            if (histRes.success) setHistory(histRes.history || histRes.data || []);
                            
                            try {
                                const fRes = await receptionAPI.getFollowupStatus(pId, 'auto');
                                if (fRes.success) setCurrentFollowupStatus(fRes);
                            } catch(e) { console.error("Error fetching follow-up", e); }
                        }

                        const loadedMeds = extractMedicinesFromAppt(res.appointment);
                        const loadedLabs = extractLabTestsFromAppt(res.appointment);

                        setSessionData({
                            diagnosis: res.appointment.diagnosis || '',
                            notes: res.appointment.doctorNotes || '',
                            medicines: loadedMeds,
                            labTests: loadedLabs
                        });
                        
                        if (res.departments) {
                            setHospitalDepartments(res.departments);
                        }
                        setLoading(false);
                        return;
                    }
                }

                // 4. Fallback if no appointment is found
                const targetPatientId = refObj?.patientId?._id || (typeof refObj?.patientId === 'string' ? refObj.patientId : null) || id;
                if (targetPatientId) {
                    try {
                        const profRes = await doctorAPI.getFullPatientProfile(targetPatientId).catch(() => null) || 
                                        await patientAPI.getPatient(targetPatientId).catch(() => null);
                        if (profRes && (profRes.patient || profRes.user)) {
                            const pt = profRes.patient || profRes.user;
                            const loggedUser = user || {};
                            const fallbackAppt = {
                                _id: 'session-' + (pt._id || targetPatientId),
                                patientId: pt.patientId || pt.mrn || targetPatientId,
                                userId: pt,
                                doctorName: loggedUser.name || 'Doctor',
                                status: 'in-progress',
                                serviceName: refObj ? 'Surgery Referral Consultation' : 'Doctor Consultation',
                                appointmentDate: new Date(),
                                appointmentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            };
                            setAppointment(fallbackAppt);

                            const cp = pt.fertilityProfile || {};
                            setIntakeData({
                                ...cp,
                                ...(cp.vitals || {}),
                                age: pt.age || cp.age || '',
                                gender: pt.gender || cp.gender || '',
                                bloodGroup: pt.bloodGroup || cp.bloodGroup || '',
                                address: pt.address || cp.address || '',
                                allergies: pt.allergies || cp.allergies || '',
                                chronicConditions: pt.chronicConditions || cp.chronicConditions || ''
                            });

                            if (profRes.appointments) {
                                setHistory(profRes.appointments);
                            }

                            // Web Parity: fallback profile consultation starts with clean empty sessionData
                            setSessionData({
                                diagnosis: '',
                                notes: '',
                                medicines: [],
                                labTests: ''
                            });

                            setLoading(false);
                            return;
                        }
                    } catch(e) { console.error("Error loading fallback profile", e); }
                }
            } catch (err) { console.error(err); }
            finally {
                setLoading(false);
            }
        };

        const fetchCatalogs = async () => {
            try {
                const testRes = await labTestAPI.getLabTests();
                if (testRes.success) {
                    setCatalogTests(testRes.data || []);
                }
            } catch (err) { console.error("Error fetching lab test catalog", err); }

            try {
                const medRes = await doctorAPI.getMedicines();
                if (medRes.success) {
                    setCatalogMedicines(medRes.medicines || []);
                }
            } catch (err) { console.error("Error fetching pharmacy inventory", err); }

            try {
                const libRes = await questionLibraryAPI.getLibrary();
                if (libRes.success && libRes.data && libRes.data.data) {
                    setDynamicLibrary(libRes.data.data);
                }
            } catch (err) { console.error("Error fetching dynamic question library", err); }
        };

        fetchCatalogs();
        fetchDetails();

        const fetchHospital = async () => {
            try {
                const res = await hospitalAPI.getMyHospital();
                if (res.success) setHospitalContext(res.hospital);
            } catch (err) { /* ignore */ }
        };
        fetchHospital();

        const fetchSurgeons = async () => {
            try {
                const hospitalId = user?.hospitalId || appointment?.hospitalId || '';
                const res = await publicAPI.getDoctors(null, hospitalId || null);
                let docs = (res.doctors || res.data || []).slice();
                const currentDocId = user?._id || user?.id;
                if (currentDocId && !docs.some(d => (d.userId?._id || d.userId || d._id)?.toString() === currentDocId?.toString())) {
                    docs.push({
                        _id: currentDocId,
                        userId: currentDocId,
                        name: user.name || 'Current Doctor',
                        specialty: user.specialty || ''
                    });
                }
                setSurgeonsList(docs);
            } catch (err) {
                console.error("fetchSurgeons error:", err);
                const currentDocId = user?._id || user?.id;
                if (currentDocId) {
                    setSurgeonsList([{
                        _id: currentDocId,
                        userId: currentDocId,
                        name: user.name || 'Current Doctor',
                        specialty: user.specialty || ''
                    }]);
                }
            }
        };
        fetchSurgeons();
    }, [appointmentId, user, appointment?.hospitalId]);

    useEffect(() => {
        const fetchPatientReferrals = async () => {
            try {
                const pid = appointment?.clinicPatientId?._id || appointment?.userId?._id || appointment?.patientId;
                if (!pid) return;
                const res = await referralAPI.getPatientReferrals(pid);
                if (res.success) setPatientReferrals(res.referrals || []);
            } catch (err) { /* ignore */ }
        };
        if (appointment) fetchPatientReferrals();
    }, [appointment]);

    const handleCreateReferral = async () => {
        try {
            const dataToSubmit = {
                patientId: appointment?.userId?._id || appointment?.patientId || intakeData?.userId,
                appointmentId: appointment?._id,
                referredToDoctorId: referralData.referredToDoctorId,
                reason: referralData.reason,
                notes: referralData.notes
            };
            const res = await referralAPI.create(dataToSubmit);
            if (res.success) {
                Alert.alert('Success', 'Referral created successfully!');
                setShowReferralModal(false);
                setReferralData({ referredToDoctorId: '', reason: '', notes: '' });
                const pid = appointment?.userId?._id || appointment?.patientId;
                if (pid) {
                    const refRes = await referralAPI.getPatientReferrals(pid);
                    if (refRes.success) setPatientReferrals(refRes.referrals || []);
                }
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Error creating referral');
        }
    };

    const handleReviewReferral = async (referralId, status, reviewNotes) => {
        try {
            const res = await referralAPI.review(referralId, { status, reviewNotes });
            if (res.success) {
                Alert.alert('Success', `Referral ${status.toLowerCase()} successfully!`);
                setShowReferralReviewModal(false);
                setActiveReferralForReview(null);
                const pid = appointment?.userId?._id || appointment?.patientId;
                if (pid) {
                    const refRes = await referralAPI.getPatientReferrals(pid);
                    if (refRes.success) setPatientReferrals(refRes.referrals || []);
                }
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Error reviewing referral');
        }
    };

    const handleCreateSurgeryPlan = async () => {
        try {
            const dataToSubmit = {
                ...surgeryPlanData,
                patientId: appointment?.userId?._id || appointment?.patientId || intakeData?.userId,
                appointmentId: appointment?._id,
                referralId: surgeryPlanData.referralId || undefined,
                referringDoctorId: surgeryPlanData.referringDoctorId || undefined
            };
            const res = await otAPI.createSurgeryPlan(dataToSubmit);
            if(res.success) {
                Alert.alert('Success', 'Surgery Plan created successfully!');
                setShowSurgeryPlanModal(false);
                setOperationRequired(false);
                setSurgeryPlanData({
                    surgery: '', diagnosis: '', surgeonId: '', preferredDate: '', preferredTime: '', admissionRequired: false, admissionDate: '', preOpRequired: false, notes: '', referralId: '', referringDoctorId: ''
                });
            }
        } catch(err) {
            Alert.alert('Error', err.response?.data?.message || 'Error creating surgery plan');
        }
    };

    const handleSaveProfile = async () => {
        const patientId = appointment?.clinicPatientId?._id || appointment?.userId?._id;
        if (!patientId) return;
        setSaving(true);
        try {
            await doctorAPI.updatePatientProfile(patientId, intakeData);
            Alert.alert('Success', 'Patient profile saved successfully!');
        } catch (err) {
            Alert.alert('Error', "Error saving profile: " + (err.response?.data?.message || err.message));
        } finally { setSaving(false); }
    };

    const handleSaveAndMerge = () => {
        Alert.alert(
            "Confirm Save",
            "Save all changes and finish session?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Save", onPress: async () => {
                    setSaving(true);
                    try {
                        const patientId = appointment?.clinicPatientId?._id || appointment?.userId?._id;
                        if (patientId) {
                            await doctorAPI.updatePatientProfile(patientId, intakeData);
                        }

                        const payload = {
                            status: 'completed',
                            diagnosis: sessionData.diagnosis,
                            notes: sessionData.notes,
                            labTests: sessionData.labTests.split(',').map(s => s.trim()).filter(Boolean).filter(t => !isDocumentFileName(t)),
                            pharmacy: (sessionData.medicines || []).filter(m => m.medicineName?.trim() && !isDocumentFileName(m.medicineName)).map(m => ({
                                medicineName: m.medicineName?.trim() || '',
                                saltName: m.saltName?.trim() || '',
                                frequency: m.dose?.trim() || '',
                                duration: m.days?.trim() || ''
                            }))
                        };
                        await doctorAPI.updateSession(appointmentId, payload);
                        setIsLocked(true);

                        Alert.alert(
                            "Consultation Completed",
                            "Do you want to transition to the Reception Desk to Admit/Hospitalize this patient?",
                            [
                                { text: "Stay Here", style: "cancel", onPress: () => {
                                    Alert.alert('Session Completed', 'This consultation has already been completed. This record is now read-only.');
                                }},
                                { text: "Go to Reception", onPress: () => {
                                    navigation.navigate('ReceptionDashboard', { view: 'intake', patient: appointment?.userId || appointment?.clinicPatientId || appointment });
                                }}
                            ]
                        );

                        setAppointment(prev => ({
                            ...prev,
                            status: 'completed',
                            diagnosis: sessionData.diagnosis,
                            doctorNotes: sessionData.notes,
                            labTests: payload.labTests,
                            pharmacy: payload.pharmacy,
                            vitals: {
                                ...prev?.vitals,
                                weight: intakeData.weight || prev?.vitals?.weight || '',
                                height: intakeData.height || prev?.vitals?.height || '',
                                bmi: intakeData.bmi || prev?.vitals?.bmi || '',
                                bp: intakeData.historyBp || intakeData.bp || intakeData.bloodPressure || prev?.vitals?.bp || '',
                                pulse: intakeData.historyPulse || intakeData.pulse || intakeData.pulseRate || prev?.vitals?.pulse || '',
                                temperature: intakeData.temperature || intakeData.temp || prev?.vitals?.temperature || '',
                                spo2: intakeData.spo2 || prev?.vitals?.spo2 || '',
                                rr: intakeData.respiratoryRate || intakeData.rr || prev?.vitals?.rr || ''
                            }
                        }));
                        
                        setPrescriptionMode('slip');
                        setShowPrescriptionModal(true);

                    } catch (err) {
                        Alert.alert('Error', "Error: " + (err.response?.data?.message || err.message));
                    } finally { setSaving(false); }
                }}
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading patient data...</Text>
            </View>
        );
    }

    if (!appointment) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>❌ Appointment not found.</Text>
                <TouchableOpacity onPress={() => navigation.navigate('DoctorPatients')} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>← Back to Patients</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const rawPatient = appointment.userId || {};
    const clinicPatient = appointment.clinicPatientId || {};
    
    let calculatedAge = '';
    const dobVal = clinicPatient.dob || rawPatient.dob;
    if (dobVal) {
        const ageDifMs = Date.now() - new Date(dobVal).getTime();
        const ageDate = new Date(ageDifMs);
        calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970).toString();
    }
    
    const patient = {
        ...rawPatient,
        name: clinicPatient.name || rawPatient.name || 'Unknown Patient',
        patientId: clinicPatient.patientUid || rawPatient.patientId || 'N/A',
        phone: clinicPatient.phone || rawPatient.phone || '-',
        email: clinicPatient.email || rawPatient.email || '-',
        address: clinicPatient.address || rawPatient.address || '-',
    };

    const rawProfile = rawPatient.fertilityProfile || intakeData || {};
    const profile = {
        ...rawProfile,
        age: clinicPatient.age || calculatedAge || rawProfile.age || '-',
        gender: clinicPatient.gender || rawProfile.gender || '-',
        bloodGroup: clinicPatient.bloodGroup || rawProfile.bloodGroup || '-',
        height: clinicPatient.vitals?.height || clinicPatient.height || rawProfile.height || '-',
        weight: clinicPatient.vitals?.weight || clinicPatient.weight || rawProfile.weight || '-',
        bmi: clinicPatient.vitals?.bmi || clinicPatient.bmi || rawProfile.bmi || '-',
        chiefComplaint: clinicPatient.chiefComplaint || rawProfile.chiefComplaint || '-',
        reasonForVisit: clinicPatient.reasonForVisit || rawProfile.reasonForVisit || '-',
        partnerFirstName: clinicPatient.partnerFirstName || rawProfile.partnerFirstName || '',
        partnerLastName: clinicPatient.partnerLastName || rawProfile.partnerLastName || '',
        partnerMobile: clinicPatient.partnerMobile || rawProfile.partnerMobile || '',
        partnerAge: clinicPatient.partnerAge || rawProfile.partnerAge || rawProfile.husbandAge || '',
        partnerBloodGroup: clinicPatient.partnerBloodGroup || rawProfile.partnerBloodGroup || '',
        allergies: clinicPatient.allergies || rawProfile.allergies || '-',
        chronicConditions: clinicPatient.chronicConditions || rawProfile.chronicConditions || '-'
    };

    const getPrescriptionHTML = () => {
        const pt = patient || {};
        const prof = profile || {};
        const hName = hospitalContext?.name || 'TEAM MEDICAL 365 HOSPITAL';
        const hAddr = [hospitalContext?.address, hospitalContext?.city, hospitalContext?.state].filter(Boolean).join(', ');
        const hPhone = hospitalContext?.phone || '';
        
        const rxItems = (sessionData.medicines || []).filter(m => m.medicineName?.trim() && !isDocumentFileName(m.medicineName)).length > 0
            ? sessionData.medicines.filter(m => m.medicineName?.trim() && !isDocumentFileName(m.medicineName))
            : (appointment?.pharmacy || []).filter(isValidMedicineRecord).map(p => ({
                medicineName: p.medicineName || p.medicine || '',
                saltName: p.saltName || '',
                dose: p.frequency || p.dose || '',
                days: p.duration || p.days || ''
            })).filter(m => m.medicineName?.trim() && !isDocumentFileName(m.medicineName));

        const labItems = sessionData.labTests
            ? sessionData.labTests.split(',').map(t => t.trim()).filter(Boolean)
            : (appointment?.labTests || []);

        const doctorName = appointment?.doctorName || user?.name || 'Attending Physician';
        const diagnosis = appointment?.diagnosis || sessionData.diagnosis || '-';
        const notes = sessionData.notes || appointment?.doctorNotes || '';
        const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Prescription Slip</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 24px; margin: 0; line-height: 1.4; }
        .header { text-align: center; border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 16px; }
        .h-name { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
        .h-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
        .badge-title { display: inline-block; background: #dcfce7; color: #166534; font-size: 13px; font-weight: 700; padding: 4px 16px; border-radius: 9999px; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
        .info-table td { padding: 6px 10px; border: 1px solid #e2e8f0; }
        .label-col { font-weight: 700; color: #475569; background: #f8fafc; width: 22%; }
        .sec-title { font-size: 14px; font-weight: 700; color: #0f172a; margin: 16px 0 8px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
        .data-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
        .data-table th { background: #16a34a; color: #ffffff; text-align: left; padding: 8px 10px; font-weight: 700; }
        .data-table.lab th { background: #0284c7; }
        .data-table td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
        .data-table tr:nth-child(even) td { background: #f8fafc; }
        .notes-box { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 10px 14px; font-size: 12px; color: #334155; margin-bottom: 16px; white-space: pre-wrap; }
        .footer { border-top: 1px solid #cbd5e1; padding-top: 12px; margin-top: 24px; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; align-items: flex-end; }
        .validity-note { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 12px; }
        .doc-signature { text-align: right; }
        .sig-line { width: 160px; border-bottom: 1px solid #475569; margin-bottom: 4px; margin-left: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="h-name">${hName}</h1>
        ${hAddr ? `<div class="h-sub">${hAddr}</div>` : ''}
        ${hPhone ? `<div class="h-sub">Phone: ${hPhone}</div>` : ''}
        <div class="badge-title">Prescription Slip</div>
    </div>

    <table class="info-table">
        <tr>
            <td class="label-col">Patient Name</td>
            <td><strong>${pt.name || intakeData.name || '-'}</strong></td>
            <td class="label-col">MRN / ID</td>
            <td><strong>${pt.patientId || pt.patientUid || appointment?.patientId || 'N/A'}</strong></td>
        </tr>
        <tr>
            <td class="label-col">Age / Gender</td>
            <td>${prof.age || intakeData.age || '-'} / ${prof.gender || intakeData.gender || '-'}</td>
            <td class="label-col">Phone</td>
            <td>${pt.phone || intakeData.phone || '-'}</td>
        </tr>
        <tr>
            <td class="label-col">Doctor</td>
            <td><strong>Dr. ${doctorName.replace(/^Dr\.?\s*/i, '')}</strong></td>
            <td class="label-col">Date & Time</td>
            <td>${dateStr} ${timeStr}</td>
        </tr>
        <tr>
            <td class="label-col">Diagnosis</td>
            <td colspan="3" style="color: #0f172a; font-weight: 600;">${diagnosis}</td>
        </tr>
    </table>

    <div class="sec-title">💊 Medicines Prescribed</div>
    ${rxItems.length > 0 ? `
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 30px;">#</th>
                    <th>Medicine Name</th>
                    <th>Timing / Instructions</th>
                    <th>Dose / Frequency</th>
                    <th style="width: 70px;">Duration</th>
                </tr>
            </thead>
            <tbody>
                ${rxItems.map((m, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td><strong>${m.medicineName}</strong></td>
                        <td>${m.saltName || '-'}</td>
                        <td>${m.dose || '-'}</td>
                        <td>${m.days ? `${m.days} days` : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    ` : '<p style="color: #64748b; font-size: 12px; font-style: italic;">No medicines prescribed.</p>'}

    <div class="sec-title">🧪 Diagnostic & Lab Orders</div>
    ${labItems.length > 0 ? `
        <table class="data-table lab">
            <thead>
                <tr>
                    <th style="width: 30px;">#</th>
                    <th>Test Name / Panel</th>
                </tr>
            </thead>
            <tbody>
                ${labItems.map((test, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td><strong>${test}</strong></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    ` : '<p style="color: #64748b; font-size: 12px; font-style: italic;">No lab tests requested.</p>'}

    ${notes ? `
        <div class="sec-title">📋 Clinical Advice / Notes</div>
        <div class="notes-box">${notes}</div>
    ` : ''}

    <div class="footer">
        <div>
            <div>Generated via Team Medical 365 Health Suite</div>
            <div class="validity-note">Valid across all in-network pharmacies and laboratories</div>
        </div>
        <div class="doc-signature">
            <div class="sig-line"></div>
            <strong>Dr. ${doctorName.replace(/^Dr\.?\s*/i, '')}</strong>
            <div style="font-size: 10px; color: #64748b;">Authorized Medical Practitioner</div>
        </div>
    </div>
</body>
</html>`;
    };

    const handlePrintPrescription = async (isCumulative = false) => {
        try {
            const html = getPrescriptionHTML();
            await Print.printAsync({ html });
        } catch (err) {
            console.error("Print error:", err);
            Alert.alert("Print Error", err.message || "Failed to print prescription");
        }
    };

    const handleDownloadPrescriptionPDF = async (isCumulative = false) => {
        try {
            const html = getPrescriptionHTML();
            const file = await Print.printToFileAsync({ html });
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(file.uri, {
                    UTI: '.pdf',
                    mimeType: 'application/pdf',
                    dialogTitle: isCumulative ? 'Cumulative Clinical Record' : 'Prescription Slip'
                });
            } else {
                Alert.alert("PDF Generated", `Saved to: ${file.uri}`);
            }
        } catch (err) {
            console.error("PDF generation error:", err);
            Alert.alert("Export Error", err.message || "Failed to export PDF");
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: '📋' },
        { id: 'ipd_orders', label: 'IPD / Admission Orders', icon: '🏥' },
        { id: 'history', label: 'Past Visits', icon: '📜' },
        { id: 'reports', label: 'Reports & Files', icon: '📁' },
    ];

    let dynamicTabs = [];
    if (dynamicLibrary) {
        const docDept = user?.department || user?._roleData?.department || '';
        const apptDept = appointment?.department || appointment?.serviceName || '';
        let targetDept = docDept || apptDept || '';
        const normalizedTarget = targetDept.toLowerCase().trim();
        const isGeneral = !normalizedTarget || normalizedTarget.includes('general') || normalizedTarget === 'unassigned';
        let allowedDepts = [];

        if (isGeneral) {
            const generalMatch = Object.keys(dynamicLibrary).find(d => d.toLowerCase() === 'general' || d.toLowerCase() === 'general medicine');
            if (generalMatch) allowedDepts.push(generalMatch);
        } else {
            const exactMatch = Object.keys(dynamicLibrary).find(d => d.toLowerCase() === normalizedTarget);
            if (exactMatch) {
                allowedDepts.push(exactMatch);
            } else {
                const partialMatch = Object.keys(dynamicLibrary).find(d => 
                    d.toLowerCase().includes(normalizedTarget) || normalizedTarget.includes(d.toLowerCase())
                );
                if (partialMatch) allowedDepts.push(partialMatch);
            }
            if (allowedDepts.length === 0) {
                const generalMatch = Object.keys(dynamicLibrary).find(d => d.toLowerCase() === 'general' || d.toLowerCase() === 'general medicine');
                if (generalMatch) allowedDepts.push(generalMatch);
            }
        }
        
        allowedDepts.forEach(dept => {
            if (dynamicLibrary[dept]) {
                Object.keys(dynamicLibrary[dept]).forEach((catKey, i) => {
                    dynamicTabs.push({ 
                        id: `dyn_${dept.replace(/\s/g, '')}_${i}`, 
                        label: `${dept} - ${catKey}`, 
                        icon: '📋', 
                        data: dynamicLibrary[dept][catKey] 
                    });
                });
            }
        });
    }

    const allTabs = [...tabs, ...dynamicTabs];

    const scrollTabs = (dir) => {
        if (tabsScrollViewRef.current) {
            tabsScrollViewRef.current.scrollTo({ x: dir === 'left' ? 0 : 300, animated: true });
        }
    };

    // Vitals extraction matching Web
    const apptVitals = appointment?.vitals || {};
    const vitalsInfo = {
        height: apptVitals.height || profile.height || intakeData.height || intakeData.vitals?.height,
        weight: apptVitals.weight || profile.weight || intakeData.weight || intakeData.vitals?.weight,
        bmi: apptVitals.bmi || profile.bmi || intakeData.bmi || intakeData.vitals?.bmi,
        bp: apptVitals.bp || profile.bp || profile.bloodPressure || profile.historyBp || intakeData.bp || intakeData.bloodPressure || intakeData.historyBp || intakeData.vitals?.bloodPressure || intakeData.vitals?.bp,
        pulse: apptVitals.pulse || profile.pulse || profile.pulseRate || profile.historyPulse || intakeData.pulse || intakeData.pulseRate || intakeData.historyPulse || intakeData.vitals?.pulse,
        rr: apptVitals.rr || apptVitals.respiratoryRate || profile.rr || profile.respiratoryRate || intakeData.rr || intakeData.respiratoryRate || intakeData.vitals?.respiratoryRate,
        temp: apptVitals.temperature || apptVitals.temp || profile.temperature || profile.temp || intakeData.temperature || intakeData.temp || intakeData.vitals?.temperature,
        spo2: apptVitals.spo2 || profile.spo2 || intakeData.spo2 || intakeData.vitals?.spo2,
        bloodSugar: apptVitals.bloodSugar || profile.bloodSugar || profile.blood_sugar || intakeData.bloodSugar || intakeData.blood_sugar,
        heartRate: apptVitals.heartRate || apptVitals.heart_rate || profile.heartRate || profile.heart_rate || intakeData.heartRate || intakeData.heart_rate,
        painScale: apptVitals.painScale || apptVitals.pain_scale || profile.painScale || profile.pain_scale || intakeData.painScale || intakeData.pain_scale,
        allergies: (profile.allergies && profile.allergies !== '-') ? profile.allergies : ((intakeData.allergies && intakeData.allergies !== '-') ? intakeData.allergies : ''),
        medications: profile.currentMedications || profile.currentMedication || intakeData.currentMedications || intakeData.currentMedication || profile.medications || intakeData.medications,
        history: (profile.chronicConditions && profile.chronicConditions !== '-') ? profile.chronicConditions : ((intakeData.chronicConditions && intakeData.chronicConditions !== '-') ? intakeData.chronicConditions : '')
    };

    // Filtered history in current department
    const currentDept = (appointment?.department || appointment?.serviceName || '').toLowerCase();
    const filteredHistory = history.filter(h => {
        if (!currentDept) return true;
        if (h._id === appointmentId) return true;
        const hDept = (h.department || h.serviceName || h.doctorConsultation?.department || '').toLowerCase();
        return hDept === currentDept;
    });

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView horizontal={false} style={styles.containerScroll}>
                <View style={isJrDoctor ? styles.containerGridJr : styles.containerGrid}>
                    
                    {/* LEFT PANEL */}
                    <View style={styles.leftPanel}>
                        {/* Patient Header Card */}
                        <View style={styles.patientHeader}>
                            <TouchableOpacity style={styles.backLink} onPress={() => navigation.navigate('DoctorPatients')}>
                                <Text style={styles.backLinkText}>← Back</Text>
                            </TouchableOpacity>

                            <View style={styles.patientIdentity}>
                                <View style={styles.patientAvatar}>
                                    <Text style={styles.patientAvatarText}>{(patient.name || 'P')[0].toUpperCase()}</Text>
                                </View>
                                <View style={styles.patientMeta}>
                                    <Text style={styles.patientName}>{patient.name || 'Unknown Patient'}</Text>
                                    <View style={styles.patientTags}>
                                        <View style={[styles.tag, styles.tagMrn]}><Text style={styles.tagMrnText}>MRN: {patient.patientId || 'N/A'}</Text></View>
                                        <View style={[styles.tag, styles.tagPhone]}><Text style={styles.tagPhoneText}>📱 {patient.phone || '-'}</Text></View>
                                        {isValAvailable(profile.age) && <View style={[styles.tag, styles.tagAge]}><Text style={styles.tagAgeText}>Age: {profile.age}</Text></View>}
                                        {isValAvailable(profile.gender) && <View style={[styles.tag, styles.tagGender]}><Text style={styles.tagGenderText}>{profile.gender}</Text></View>}
                                        {isValAvailable(profile.bloodGroup) && <View style={[styles.tag, styles.tagBlood]}><Text style={styles.tagBloodText}>{profile.bloodGroup}</Text></View>}
                                    </View>
                                </View>
                            </View>

                            <View style={styles.apptInfo}>
                                <View style={styles.apptItem}>
                                    <Text style={styles.apptLabel}>Date</Text>
                                    <Text style={styles.apptValue}>{new Date(appointment.appointmentDate).toLocaleDateString('en-IN')}</Text>
                                </View>
                                <View style={styles.apptItem}>
                                    <Text style={styles.apptLabel}>Time</Text>
                                    <Text style={styles.apptValue}>{appointment.appointmentTime}</Text>
                                </View>
                                <View style={styles.apptItem}>
                                    <Text style={styles.apptLabel}>Status</Text>
                                    <View style={[styles.apptStatus, styles[`status_${appointment.status}`] || styles.status_pending]}>
                                        <Text style={[styles.apptStatusText, styles[`statusText_${appointment.status}`] || styles.statusText_pending]}>
                                            {appointment.status} {isLocked ? '🔒 Locked' : ''}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.apptItem}>
                                    <Text style={styles.apptLabel}>Service</Text>
                                    <Text style={styles.apptValue}>{appointment.serviceName || 'Consultation'}</Text>
                                </View>

                                {/* AI Assistant Button (Web 1:1 Parity) */}
                                <View style={[styles.apptItem, { width: '100%', marginTop: 8, alignItems: 'flex-start' }]}>
                                    <TouchableOpacity
                                        style={styles.openAiBtn}
                                        onPress={() => navigation.navigate('AIAssistant', {
                                            patientId: patient._id || id,
                                            appointmentId: appointmentId || appointment?._id
                                        })}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.openAiBtnText}>🤖 Open AI Assistant</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* Tabs Nav with Left/Right Scroll controls */}
                        <View style={styles.tabsContainerWrapper}>
                            <TouchableOpacity style={styles.tabScrollBtn} onPress={() => scrollTabs('left')}>
                                <Text style={styles.tabScrollBtnText}>‹</Text>
                            </TouchableOpacity>

                            <ScrollView 
                                ref={tabsScrollViewRef} 
                                horizontal 
                                showsHorizontalScrollIndicator={false} 
                                style={styles.tabsContainer} 
                                contentContainerStyle={styles.tabsNav}
                            >
                                {allTabs.map(tab => (
                                    <TouchableOpacity
                                        key={tab.id}
                                        style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
                                        onPress={() => setActiveTab(tab.id)}
                                    >
                                        <Text style={styles.tabIcon}>{tab.icon}</Text>
                                        <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>{tab.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <TouchableOpacity style={styles.tabScrollBtn} onPress={() => scrollTabs('right')}>
                                <Text style={styles.tabScrollBtnText}>›</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Tab Content */}
                        <View style={styles.tabContent}>
                            {/* OVERVIEW TAB */}
                            {activeTab === 'overview' && (
                                <View style={styles.tabPanel}>
                                    <Text style={styles.panelTitle}>📋 Patient Overview</Text>
                                    <View style={styles.overviewGrid}>
                                        <View style={styles.ovCard}><Text style={styles.ovLabel}>Full Name</Text><Text style={styles.ovValue}>{patient.name || '-'}</Text></View>
                                        <View style={styles.ovCard}><Text style={styles.ovLabel}>Phone</Text><Text style={styles.ovValue}>{patient.phone || '-'}</Text></View>
                                        <View style={styles.ovCard}><Text style={styles.ovLabel}>Email</Text><Text style={styles.ovValue}>{patient.email || '-'}</Text></View>
                                        <View style={styles.ovCard}><Text style={styles.ovLabel}>Age</Text><Text style={styles.ovValue}>{profile.age || intakeData.age || '-'}</Text></View>
                                        <View style={styles.ovCard}><Text style={styles.ovLabel}>Gender</Text><Text style={styles.ovValue}>{profile.gender || intakeData.gender || '-'}</Text></View>
                                        <View style={styles.ovCard}><Text style={styles.ovLabel}>Blood Group</Text><Text style={styles.ovValue}>{profile.bloodGroup || intakeData.bloodGroup || '-'}</Text></View>
                                        
                                        {/* Full Web Vitals & Clinical Cards */}
                                        {isValAvailable(vitalsInfo.height) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Height</Text><Text style={styles.ovValue}>{vitalsInfo.height} cm</Text></View>}
                                        {isValAvailable(vitalsInfo.weight) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Weight</Text><Text style={styles.ovValue}>{vitalsInfo.weight} kg</Text></View>}
                                        {isValAvailable(vitalsInfo.bmi) && <View style={styles.ovCard}><Text style={styles.ovLabel}>BMI</Text><Text style={styles.ovValue}>{vitalsInfo.bmi}</Text></View>}
                                        {isValAvailable(vitalsInfo.bp) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Blood Pressure</Text><Text style={styles.ovValue}>{vitalsInfo.bp}</Text></View>}
                                        {isValAvailable(vitalsInfo.pulse) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Pulse Rate</Text><Text style={styles.ovValue}>{vitalsInfo.pulse} bpm</Text></View>}
                                        {isValAvailable(vitalsInfo.rr) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Respiratory Rate</Text><Text style={styles.ovValue}>{vitalsInfo.rr} breaths/min</Text></View>}
                                        {isValAvailable(vitalsInfo.temp) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Temperature</Text><Text style={styles.ovValue}>{vitalsInfo.temp} °F</Text></View>}
                                        {isValAvailable(vitalsInfo.spo2) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Oxygen Saturation (SpO₂)</Text><Text style={styles.ovValue}>{vitalsInfo.spo2}%</Text></View>}
                                        {isValAvailable(vitalsInfo.bloodSugar) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Blood Sugar</Text><Text style={styles.ovValue}>{vitalsInfo.bloodSugar}</Text></View>}
                                        {isValAvailable(vitalsInfo.heartRate) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Heart Rate</Text><Text style={styles.ovValue}>{vitalsInfo.heartRate} bpm</Text></View>}
                                        {isValAvailable(vitalsInfo.painScale) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Pain Scale</Text><Text style={styles.ovValue}>{vitalsInfo.painScale} / 10</Text></View>}
                                        {isValAvailable(vitalsInfo.allergies) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Allergies</Text><Text style={styles.ovValue}>{vitalsInfo.allergies}</Text></View>}
                                        {isValAvailable(vitalsInfo.medications) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Current Medications</Text><Text style={styles.ovValue}>{vitalsInfo.medications}</Text></View>}
                                        {isValAvailable(vitalsInfo.history) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Medical History</Text><Text style={styles.ovValue}>{vitalsInfo.history}</Text></View>}
                                        
                                        <View style={styles.ovCard}><Text style={styles.ovLabel}>Address</Text><Text style={styles.ovValue}>{patient.address || profile.address || '-'}</Text></View>
                                        <View style={styles.ovCard}><Text style={styles.ovLabel}>Reason for Visit</Text><Text style={styles.ovValue}>{profile.reasonForVisit || intakeData.reasonForVisit || '-'}</Text></View>
                                    </View>

                                    {/* Partner / Spouse Quick Info (Web 1:1 Parity) */}
                                    {(profile.partnerFirstName || intakeData.partnerFirstName) && (
                                        <View style={styles.partnerQuick}>
                                            <Text style={styles.partnerTitle}>👫 Spouse/Partner Info</Text>
                                            <View style={styles.overviewGrid}>
                                                <View style={styles.ovCard}>
                                                    <Text style={styles.ovLabel}>Partner Name</Text>
                                                    <Text style={styles.ovValue}>
                                                        {profile.partnerFirstName || intakeData.partnerFirstName || '-'} {profile.partnerLastName || intakeData.partnerLastName || ''}
                                                    </Text>
                                                </View>
                                                <View style={styles.ovCard}>
                                                    <Text style={styles.ovLabel}>Partner Phone</Text>
                                                    <Text style={styles.ovValue}>{profile.partnerMobile || intakeData.partnerMobile || '-'}</Text>
                                                </View>
                                                <View style={styles.ovCard}>
                                                    <Text style={styles.ovLabel}>Partner Age</Text>
                                                    <Text style={styles.ovValue}>{profile.partnerAge || intakeData.partnerAge || profile.husbandAge || intakeData.husbandAge || '-'}</Text>
                                                </View>
                                                <View style={styles.ovCard}>
                                                    <Text style={styles.ovLabel}>Partner Blood Group</Text>
                                                    <Text style={styles.ovValue}>{profile.partnerBloodGroup || intakeData.partnerBloodGroup || '-'}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}
                            
                            {/* PAST VISITS TAB */}
                            {activeTab === 'history' && (
                                <View style={styles.tabPanel}>
                                    <Text style={styles.panelTitle}>📜 Previous Consultations ({filteredHistory.length})</Text>
                                    {filteredHistory.length === 0 ? (
                                        <View style={styles.emptyHist}>
                                            <Text style={styles.emptyHistText}>No previous visits recorded in this department context.</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.historyList}>
                                            {filteredHistory.map(h => (
                                                <TouchableOpacity 
                                                    key={h._id} 
                                                    style={[
                                                        styles.historyCard, 
                                                        h._id === appointmentId && styles.historyCardCurrent, 
                                                        viewingPastSession?._id === h._id && styles.historyCardViewing
                                                    ]} 
                                                    onPress={() => {
                                                        if (h._id === appointmentId) setViewingPastSession(null);
                                                        else setViewingPastSession(viewingPastSession?._id === h._id ? null : h);
                                                    }}
                                                >
                                                    {viewingPastSession?._id === h._id && (
                                                        <View style={styles.viewingBadge}>
                                                            <Text style={styles.viewingBadgeText}>👁️ Viewing Right Now</Text>
                                                        </View>
                                                    )}
                                                    <View style={styles.histTop}>
                                                        <Text style={styles.histDate}>
                                                            {new Date(h.appointmentDate || h.visitDate || h.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </Text>
                                                        <View style={[styles.apptStatus, styles[`status_${h.status}`] || styles.status_pending]}>
                                                            <Text style={[styles.apptStatusText, styles[`statusText_${h.status}`] || styles.statusText_pending]}>{h.status}</Text>
                                                        </View>
                                                    </View>
                                                    <Text style={styles.histDiagnosis}>
                                                        <Text style={{ fontWeight: 'bold' }}>Diagnosis: </Text>
                                                        {h.doctorConsultation?.diagnosis?.length > 0 ? h.doctorConsultation.diagnosis.join(', ') : (h.diagnosis || 'No diagnosis recorded')}
                                                    </Text>
                                                    {(h.doctorConsultation?.clinicalNotes || h.doctorNotes) && (
                                                        <Text style={styles.histNotesText}>
                                                            <Text style={{ fontWeight: 'bold' }}>Notes: </Text>
                                                            {h.doctorConsultation?.clinicalNotes || h.doctorNotes}
                                                        </Text>
                                                    )}
                                                    {((h.doctorConsultation?.prescription?.filter(isValidMedicineRecord) || []).length > 0 || (h.pharmacy?.filter(isValidMedicineRecord) || []).length > 0) && (
                                                        <Text style={[styles.histNotesText, { color: '#059669' }]}>
                                                            <Text style={{ fontWeight: 'bold' }}>💊 Medicines: </Text>
                                                            {(h.doctorConsultation?.prescription?.filter(isValidMedicineRecord) || []).length > 0
                                                                ? h.doctorConsultation.prescription.filter(isValidMedicineRecord).map(p => `${p.medicine || p.medicineName} (${p.dosage || p.frequency || '-'}, ${p.duration || p.days || '-'})`).join(' · ')
                                                                : (h.pharmacy || []).filter(isValidMedicineRecord).map(p => `${p.medicineName || p.medicine} (${p.frequency || p.dose || '-'}, ${p.duration || p.days || '-'} days)`).join(' · ')}
                                                        </Text>
                                                    )}
                                                    {(h.doctorConsultation?.labTests?.length > 0 || h.labTests?.length > 0) && (
                                                        <Text style={[styles.histNotesText, { color: '#2563eb' }]}>
                                                            <Text style={{ fontWeight: 'bold' }}>🧪 Lab Tests: </Text>
                                                            {h.doctorConsultation?.labTests?.length > 0
                                                                ? h.doctorConsultation.labTests.join(', ')
                                                                : (h.labTests || []).join(', ')}
                                                        </Text>
                                                    )}
                                                    {h._id === appointmentId && <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>📌 Current Session</Text></View>}
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* IPD / ADMISSION ORDERS TAB */}
                            {activeTab === 'ipd_orders' && (
                                <DoctorIPDOrdersPanel
                                    patientId={id || patient?._id}
                                    patient={patient}
                                    appointment={appointment}
                                    currentUser={user}
                                />
                            )}

                            {/* REPORTS & FILES TAB */}
                            {activeTab === 'reports' && (
                                <AppointmentReports appointmentId={appointment?._id} prescriptions={appointment?.prescriptions} />
                            )}

                            {/* DYNAMIC FORMS RENDERER */}
                            {dynamicTabs.map(dTab => (
                                activeTab === dTab.id && (
                                    <View key={dTab.id} style={{ display: 'flex' }}>
                                        <DynamicQuestionForm
                                            categoryName={dTab.label}
                                            questions={dTab.data}
                                            intakeData={intakeData}
                                            setIntakeData={setIntakeData}
                                            readOnly={isLocked}
                                        />
                                        {!isLocked && (
                                            <TouchableOpacity 
                                                style={styles.saveSectionBtn} 
                                                onPress={handleSaveProfile} 
                                                disabled={saving}
                                            >
                                                <Text style={styles.saveSectionBtnText}>
                                                    {saving ? 'Saving...' : `💾 Save ${dTab.label} Data`}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )
                            ))}
                        </View>
                    </View>

                    {/* RIGHT PANEL - SESSION NOTEPAD */}
                    {!isJrDoctor && (
                        <View style={[styles.rightPanel, viewingPastSession ? styles.rightPanelTimeMachine : null]}>
                            {viewingPastSession ? (
                                <>
                                    <View style={[styles.rightHeader, { backgroundColor: '#eff6ff', borderBottomColor: '#bfdbfe' }]}>
                                        <View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Text style={[styles.rightHeaderTitle, { color: '#1e3a8a' }]}>🕰️ Past Session</Text>
                                                <View style={styles.tmReadOnlyBadge}><Text style={styles.tmReadOnlyBadgeText}>Read-only</Text></View>
                                            </View>
                                            <Text style={[styles.rightSubtitle, { color: '#3b82f6' }]}>
                                                Viewing notes from {new Date(viewingPastSession.appointmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={() => setViewingPastSession(null)} style={styles.exitTmBtn}>
                                            <Text style={styles.exitTmBtnText}>✕ Exit Time Machine</Text>
                                        </TouchableOpacity>
                                    </View>
                                    
                                    <ScrollView style={styles.rightContent}>
                                        <View style={styles.sessionField}>
                                            <Text style={styles.fieldLabel}>🔍 Diagnosis at the time</Text>
                                            <View style={styles.tmFieldBox}><Text style={styles.tmFieldText}>{viewingPastSession.diagnosis || 'No diagnosis recorded'}</Text></View>
                                        </View>
                                        <View style={styles.sessionField}>
                                            <Text style={styles.fieldLabel}>📋 Clinical Notes</Text>
                                            <View style={styles.tmFieldBox}><Text style={styles.tmFieldText}>{viewingPastSession.doctorNotes || 'No notes recorded'}</Text></View>
                                        </View>
                                        <View style={styles.sessionField}>
                                            <Text style={styles.fieldLabel}>💊 Prescription Given</Text>
                                            <View style={styles.tmFieldBox}>
                                                {viewingPastSession.pharmacy?.length > 0 ? viewingPastSession.pharmacy.map((p, i) => (
                                                    <Text key={i} style={styles.tmFieldText}>• {p.medicineName}</Text>
                                                )) : <Text style={styles.tmFieldText}>No prescription recorded</Text>}
                                            </View>
                                        </View>
                                        <View style={styles.sessionField}>
                                            <Text style={styles.fieldLabel}>🧪 Lab Tests Ordered</Text>
                                            <View style={styles.tmFieldBox}>
                                                <Text style={styles.tmFieldText}>{(viewingPastSession.labTests || []).join(', ') || 'No lab tests ordered'}</Text>
                                            </View>
                                        </View>
                                    </ScrollView>

                                    <View style={[styles.rightFooter, { backgroundColor: '#f1f5f9' }]}>
                                        <TouchableOpacity style={styles.copyTmBtn} onPress={() => {
                                            setSessionData(prev => ({
                                                ...prev,
                                                diagnosis: viewingPastSession.diagnosis || '',
                                                notes: viewingPastSession.doctorNotes || '',
                                                medicines: (viewingPastSession.pharmacy || []).filter(isValidMedicineRecord).map(p => ({
                                                    medicineName: p.medicineName || '',
                                                    saltName: '',
                                                    dose: p.frequency || '',
                                                    days: p.duration || '7'
                                                })).filter(m => m.medicineName && !isDocumentFileName(m.medicineName)),
                                                labTests: (viewingPastSession.labTests || []).join(', ')
                                            }));
                                            setViewingPastSession(null);
                                            Alert.alert('Success', 'Historical data copied into your Current Session editor!');
                                        }}>
                                            <Text style={styles.copyTmBtnText}>📋 Copy to Current Session</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.btnFinish, { backgroundColor: '#64748b' }]} onPress={() => setViewingPastSession(null)}>
                                            <Text style={styles.btnFinishText}>Return to Current Editing</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <View style={styles.rightHeader}>
                                        <View>
                                            <Text style={styles.rightHeaderTitle}>📝 Current Session</Text>
                                            <Text style={styles.rightSubtitle}>Record diagnosis, notes & prescription</Text>
                                        </View>
                                        <View style={[styles.apptStatus, styles[`status_${appointment.status}`] || styles.status_pending]}>
                                            <Text style={[styles.apptStatusText, styles[`statusText_${appointment.status}`] || styles.statusText_pending]}>{appointment.status}</Text>
                                        </View>
                                    </View>

                                    <ScrollView style={styles.rightContent}>
                                        <View style={styles.sessionField}>
                                            <Text style={styles.fieldLabel}>🔍 Diagnosis</Text>
                                            <TextInput
                                                style={[styles.input, styles.diagInput]}
                                                placeholder="Enter diagnosis..."
                                                placeholderTextColor="#94a3b8"
                                                value={sessionData.diagnosis}
                                                onChangeText={(text) => !isLocked && setSessionData(prev => ({ ...prev, diagnosis: text }))}
                                                editable={!isLocked}
                                            />
                                        </View>

                                        <View style={styles.sessionField}>
                                            <Text style={styles.fieldLabel}>📋 Clinical Notes</Text>
                                            <TextInput
                                                style={styles.textArea}
                                                placeholder="Write detailed clinical notes, observations, examination findings..."
                                                placeholderTextColor="#94a3b8"
                                                multiline={true}
                                                textAlignVertical="top"
                                                value={sessionData.notes}
                                                onChangeText={(text) => !isLocked && setSessionData(prev => ({ ...prev, notes: text }))}
                                                editable={!isLocked}
                                            />
                                        </View>

                                        {/* Operation & Referral Box */}
                                        {!isLocked && (
                                            <View style={styles.referralBanner}>
                                                {/* Referral Banner for incoming referred doctor */}
                                                {patientReferrals.filter(r => r.status === 'REFERRED' && (r.referredToDoctorId?._id === user?._id || r.referredToDoctorId === user?._id)).length > 0 && (
                                                    <View style={styles.incomingReferralBanner}>
                                                        <Text style={styles.incomingReferralTitle}>📋 Surgery Referral Pending</Text>
                                                        {patientReferrals.filter(r => r.status === 'REFERRED' && (r.referredToDoctorId?._id === user?._id || r.referredToDoctorId === user?._id)).map(ref => (
                                                            <View key={ref._id} style={{ marginBottom: 8 }}>
                                                                <Text style={styles.incomingReferralText}>
                                                                    <Text style={{ fontWeight: 'bold' }}>From: </Text>{ref.referringDoctorId?.name || 'Unknown'} &nbsp;|&nbsp;
                                                                    <Text style={{ fontWeight: 'bold' }}>Reason: </Text>{ref.reason}
                                                                </Text>
                                                                <TouchableOpacity 
                                                                    style={styles.reviewReferralBtn}
                                                                    onPress={() => { setActiveReferralForReview(ref); setShowReferralReviewModal(true); }}
                                                                >
                                                                    <Text style={styles.reviewReferralBtnText}>Review Referral</Text>
                                                                </TouchableOpacity>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}

                                                <Text style={styles.referralLabel}>🔪 Operation Required?</Text>
                                                <View style={styles.radioGroup}>
                                                    <TouchableOpacity style={styles.radioBtn} onPress={() => setOperationRequired(false)}>
                                                        <View style={[styles.radioOuter, !operationRequired && styles.radioOuterActive]}>
                                                            {!operationRequired && <View style={styles.radioInner}/>}
                                                        </View>
                                                        <Text style={styles.radioText}>No</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={styles.radioBtn} onPress={() => setOperationRequired(true)}>
                                                        <View style={[styles.radioOuter, operationRequired && styles.radioOuterActive]}>
                                                            {operationRequired && <View style={styles.radioInner}/>}
                                                        </View>
                                                        <Text style={styles.radioText}>Yes</Text>
                                                    </TouchableOpacity>
                                                </View>

                                                {operationRequired && (
                                                    <View style={styles.surgeryActions}>
                                                        <TouchableOpacity 
                                                            style={styles.surgeryBtn} 
                                                            onPress={() => {
                                                                setSurgeryPlanData(prev => ({ 
                                                                    ...prev, 
                                                                    diagnosis: sessionData.diagnosis || prev.diagnosis || '',
                                                                    surgeonId: prev.surgeonId || user?._id || user?.id || ''
                                                                }));
                                                                setShowSurgeryPlanModal(true);
                                                            }}
                                                        >
                                                            <Text style={styles.surgeryBtnText}>+ Create Surgery Plan (Self / Direct)</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity 
                                                            style={styles.referralBtn} 
                                                            onPress={() => {
                                                                setReferralData(prev => ({ ...prev, reason: sessionData.diagnosis || '' }));
                                                                setShowReferralModal(true);
                                                            }}
                                                        >
                                                            <Text style={styles.referralBtnText}>🔄 Refer for Surgery (To Another Doctor)</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        )}

                                        <View style={styles.sessionField}>
                                            {!isLocked && (
                                                <>
                                                    <TouchableOpacity 
                                                        style={styles.prescribeBtn} 
                                                        onPress={() => setShowPrescribeModal(true)}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Text style={styles.prescribeBtnText}>💊 / 🧪 Prescribe Medicines & Lab Tests</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        style={styles.ipdOrdersQuickBtn}
                                                        onPress={() => setActiveTab('ipd_orders')}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Text style={styles.ipdOrdersQuickBtnText}>🏥 Hospitalization & IPD Orders</Text>
                                                    </TouchableOpacity>
                                                </>
                                            )}

                                            {((sessionData.medicines || []).filter(m => m.medicineName?.trim() && !isDocumentFileName(m.medicineName)).length > 0 || sessionData.labTests || (isLocked && (appointment?.pharmacy || []).filter(isValidMedicineRecord).length > 0)) && (
                                                <View style={styles.includedSummaryBox}>
                                                    {((sessionData.medicines || []).filter(m => m.medicineName?.trim() && !isDocumentFileName(m.medicineName)).length > 0 || (isLocked && (appointment?.pharmacy || []).filter(isValidMedicineRecord).length > 0)) && (
                                                        <Text style={styles.includedSummaryTitle}>
                                                            ✅ Medicines included ({(sessionData.medicines || []).filter(m => m.medicineName?.trim() && !isDocumentFileName(m.medicineName)).length || (appointment?.pharmacy || []).filter(isValidMedicineRecord).length || 0})
                                                        </Text>
                                                    )}
                                                    {(sessionData.labTests || (isLocked && (appointment?.labTests?.length > 0))) && (
                                                        <Text style={styles.includedSummaryTitle}>
                                                            ✅ Lab Tests included
                                                        </Text>
                                                    )}
                                                    {!isLocked ? (
                                                        <TouchableOpacity onPress={() => setShowPrescribeModal(true)}>
                                                            <Text style={styles.includedSummaryLink}>Click above button to view/edit details.</Text>
                                                        </TouchableOpacity>
                                                    ) : (
                                                        <Text style={styles.includedSummaryHint}>Check the Consultation Report (PDF) for full history.</Text>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    </ScrollView>

                                    <View style={styles.rightFooter}>
                                        {!isLocked ? (
                                            <>
                                                <TouchableOpacity style={styles.btnSaveDraft} onPress={handleSaveProfile} disabled={saving}>
                                                    <Text style={styles.btnSaveDraftText}>💾 Save Profile</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.btnFinish} onPress={handleSaveAndMerge} disabled={saving}>
                                                    <Text style={styles.btnFinishText}>{saving ? '⏳ Saving...' : '✅ Save & Generate Prescription'}</Text>
                                                </TouchableOpacity>
                                            </>
                                        ) : (
                                            <>
                                                <TouchableOpacity
                                                    style={styles.btnReprint}
                                                    onPress={() => {
                                                        setPrescriptionMode('slip');
                                                        setShowPrescriptionModal(true);
                                                    }}
                                                >
                                                    <Text style={styles.btnReprintText}>📄 Reprint Prescription</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={[styles.btnFinish, { backgroundColor: '#64748b' }]} onPress={() => navigation.navigate('DoctorPatients')}>
                                                    <Text style={styles.btnFinishText}>← Back to Queue</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </View>
                                </>
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* PRESCRIBE MEDICINES & LAB TESTS MODAL (1:1 Web Source Parity) */}
            <Modal visible={showPrescribeModal} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentLarge}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>⚕️ Prescribe Medicines & Lab Tests</Text>
                            <TouchableOpacity onPress={() => setShowPrescribeModal(false)} style={styles.modalCloseBtn}>
                                <Text style={styles.modalCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            
                            {/* Medicines Section */}
                            <Text style={styles.modalSectionTitle}>💊 Medicines Prescribed</Text>
                            
                            {/* Quick search from inventory */}
                            <Text style={styles.fieldSublabel}>Search Medicine From Inventory</Text>
                            <TextInput 
                                style={styles.input} 
                                placeholder="Search medicine by name..." 
                                placeholderTextColor="#94a3b8"
                                value={medSearch} 
                                onChangeText={setMedSearch} 
                            />
                            
                            {medSearch.trim().length > 0 && (
                                <View style={styles.searchList}>
                                    {catalogMedicines
                                        .filter(m => m?.name && !isDocumentFileName(m.name) && m.name.toLowerCase().includes(medSearch.toLowerCase()))
                                        .map(med => {
                                            const exists = sessionData.medicines.some(m => m.medicineName === med.name);
                                            return (
                                                <TouchableOpacity 
                                                    key={med._id || med.name} 
                                                    style={styles.searchItem} 
                                                    onPress={() => {
                                                        if (!exists) {
                                                            setSessionData(prev => ({ 
                                                                ...prev, 
                                                                medicines: [...prev.medicines, { medicineName: med.name, saltName: '', dose: '', days: '7' }] 
                                                            }));
                                                        }
                                                        setMedSearch('');
                                                    }}
                                                >
                                                    <Text style={styles.searchItemTitle}>{med.name}</Text>
                                                    <Text style={styles.searchItemSub}>{med.genericName || 'Inventory'}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    {catalogMedicines.filter(m => m?.name && !isDocumentFileName(m.name) && m.name.toLowerCase().includes(medSearch.toLowerCase())).length === 0 && (
                                        <View style={{ padding: 12, alignItems: 'center' }}>
                                            <Text style={{ color: '#94a3b8', fontSize: 13 }}>No medicines found.</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Structured Medicine Table (Web 1:1 Layout) */}
                            <View style={styles.webTableWrapper}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true}>
                                    <View style={styles.webTableContent}>
                                        {/* Table Header */}
                                        <View style={styles.tableHeaderRow}>
                                            <Text style={[styles.tableHeaderCell, { width: 220 }]}>Medicine Name</Text>
                                            <Text style={[styles.tableHeaderCell, { width: 170 }]}>Dose / Frequency</Text>
                                            <Text style={[styles.tableHeaderCell, { width: 190 }]}>Food / Timing Instructions</Text>
                                            <Text style={[styles.tableHeaderCell, { width: 70, textAlign: 'center' }]}>Days</Text>
                                            <Text style={[styles.tableHeaderCell, { width: 40, textAlign: 'center' }]}></Text>
                                        </View>

                                        {/* Table Body Rows */}
                                        {sessionData.medicines.map((med, idx) => (
                                            <View key={idx} style={[styles.tableBodyRow, { backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }]}>
                                                <View style={{ width: 220, paddingRight: 8 }}>
                                                    <TextInput 
                                                        style={styles.tableInput} 
                                                        value={med.medicineName} 
                                                        placeholder="Paracetamol 500mg"
                                                        placeholderTextColor="#94a3b8"
                                                        onChangeText={text => {
                                                            const m = [...sessionData.medicines];
                                                            m[idx] = { ...m[idx], medicineName: text };
                                                            setSessionData(prev => ({ ...prev, medicines: m }));
                                                        }} 
                                                    />
                                                </View>

                                                <View style={{ width: 170, paddingRight: 8 }}>
                                                    <View style={styles.tablePickerBox}>
                                                        <Picker 
                                                            selectedValue={med.dose} 
                                                            onValueChange={val => {
                                                                const m = [...sessionData.medicines];
                                                                m[idx] = { ...m[idx], dose: val };
                                                                setSessionData(prev => ({ ...prev, medicines: m }));
                                                            }}
                                                            style={styles.tablePicker}
                                                        >
                                                            <Picker.Item label="-- Select Dose --" value="" />
                                                            {doseOptions.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
                                                        </Picker>
                                                    </View>
                                                </View>

                                                <View style={{ width: 190, paddingRight: 8 }}>
                                                    <View style={styles.tablePickerBox}>
                                                        <Picker 
                                                            selectedValue={med.saltName} 
                                                            onValueChange={val => {
                                                                const m = [...sessionData.medicines];
                                                                m[idx] = { ...m[idx], saltName: val };
                                                                setSessionData(prev => ({ ...prev, medicines: m }));
                                                            }}
                                                            style={styles.tablePicker}
                                                        >
                                                            <Picker.Item label="-- Select Timing --" value="" />
                                                            {timingOptions.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
                                                        </Picker>
                                                    </View>
                                                </View>

                                                <View style={{ width: 70, paddingRight: 8 }}>
                                                    <TextInput 
                                                        style={[styles.tableInput, { textAlign: 'center' }]} 
                                                        value={med.days} 
                                                        placeholder="e.g. 7"
                                                        placeholderTextColor="#94a3b8"
                                                        keyboardType="numeric"
                                                        onChangeText={text => {
                                                            const m = [...sessionData.medicines];
                                                            m[idx] = { ...m[idx], days: text };
                                                            setSessionData(prev => ({ ...prev, medicines: m }));
                                                        }} 
                                                    />
                                                </View>

                                                <View style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}>
                                                    <TouchableOpacity 
                                                        style={styles.tableDeleteBtn} 
                                                        onPress={() => setSessionData(prev => ({ ...prev, medicines: prev.medicines.filter((_, i) => i !== idx) }))}
                                                    >
                                                        <Text style={styles.tableDeleteBtnText}>✕</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ))}

                                        {sessionData.medicines.length === 0 && (
                                            <View style={styles.emptyMedTableRow}>
                                                <Text style={styles.emptyMedText}>No medicines added yet. Use quick-add above or click "+ Add Row".</Text>
                                            </View>
                                        )}
                                    </View>
                                </ScrollView>
                            </View>

                            <TouchableOpacity 
                                style={styles.addMedBtn} 
                                onPress={() => setSessionData(prev => ({ 
                                    ...prev, 
                                    medicines: [...prev.medicines, { medicineName: '', saltName: '', dose: '', days: '' }] 
                                }))}
                            >
                                <Text style={styles.addMedBtnText}>+ Add Row</Text>
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            {/* Lab Tests Section */}
                            <Text style={styles.modalSectionTitle}>🧪 Select Lab Tests</Text>
                            <View style={styles.labGrid}>
                                {catalogTests.length > 0 ? (
                                    catalogTests.filter(t => t.isActive !== false).map(test => {
                                        const currentList = sessionData.labTests ? sessionData.labTests.split(',').map(s => s.trim()) : [];
                                        const isChecked = currentList.includes(test.name);
                                        return (
                                            <TouchableOpacity
                                                key={test._id || test.name}
                                                style={[styles.labTestCard, isChecked && styles.labTestCardActive]}
                                                onPress={() => {
                                                    let list = sessionData.labTests ? sessionData.labTests.split(',').map(s => s.trim()).filter(Boolean) : [];
                                                    if (isChecked) {
                                                        list = list.filter(t => t !== test.name);
                                                    } else {
                                                        list.push(test.name);
                                                    }
                                                    setSessionData(prev => ({ ...prev, labTests: list.join(', ') }));
                                                }}
                                            >
                                                <View style={[styles.labCheckCircle, isChecked && styles.labCheckCircleActive]}>
                                                    {isChecked && <Text style={styles.labCheckmark}>✓</Text>}
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.labTestNameText, isChecked && { color: '#1d4ed8' }]}>{test.name}</Text>
                                                    {test.category ? <Text style={styles.labTestCatText}>{test.category}</Text> : null}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })
                                ) : (
                                    <Text style={{ color: '#94a3b8', fontSize: 13, padding: 12 }}>No lab tests defined by Super Admin.</Text>
                                )}
                            </View>

                            <Text style={[styles.fieldSublabel, { marginTop: 14 }]}>Edit Final Lab Tests (Comma separated):</Text>
                            <TextInput 
                                style={styles.input} 
                                placeholder="CBC, LFT, KFT..." 
                                placeholderTextColor="#94a3b8"
                                value={sessionData.labTests} 
                                onChangeText={text => setSessionData(prev => ({ ...prev, labTests: text }))} 
                            />
                            
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPrescribeModal(false)}>
                                <Text style={styles.modalCancelBtnText}>Close</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalActionBtn} onPress={() => setShowPrescribeModal(false)}>
                                <Text style={styles.modalActionBtnText}>Save Selections & Resume Note</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* SURGERY PLAN MODAL (Web 1:1 Parity) */}
            <Modal visible={showSurgeryPlanModal} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🔪 Create Surgery Plan</Text>
                            <TouchableOpacity onPress={() => setShowSurgeryPlanModal(false)} style={styles.modalCloseBtn}>
                                <Text style={styles.modalCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.patientSummaryCard}>
                                <Text style={styles.patientSummaryText}>
                                    <Text style={{ fontWeight: 'bold' }}>Patient: </Text>{intakeData?.name || appointment?.userId?.name || appointment?.patientId || 'N/A'}
                                </Text>
                                <Text style={styles.patientSummaryText}>
                                    <Text style={{ fontWeight: 'bold' }}>MRN / Age / Gender: </Text>{intakeData?.patientUid || appointment?.userId?.patientId || '-'} / {intakeData?.age || '-'} / {intakeData?.gender || '-'}
                                </Text>
                            </View>

                            {surgeryPlanData.referralId ? (
                                <View style={styles.referredCaseBadge}>
                                    <Text style={styles.referredCaseBadgeText}>🔄 Referred Surgery Case (Referral linked to this Surgery Plan)</Text>
                                </View>
                            ) : null}

                            <View style={styles.sessionField}>
                                <Text style={styles.fieldLabel}>Surgery / Procedure *</Text>
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="e.g. Laparoscopic Appendectomy" 
                                    placeholderTextColor="#94a3b8"
                                    value={surgeryPlanData.surgery} 
                                    onChangeText={text => setSurgeryPlanData(prev => ({...prev, surgery: text}))} 
                                />
                            </View>

                            <View style={styles.sessionField}>
                                <Text style={styles.fieldLabel}>Diagnosis / Reason</Text>
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="Diagnosis or indication"
                                    placeholderTextColor="#94a3b8"
                                    value={surgeryPlanData.diagnosis} 
                                    onChangeText={text => setSurgeryPlanData(prev => ({...prev, diagnosis: text}))} 
                                />
                            </View>

                            <View style={styles.sessionField}>
                                <Text style={styles.fieldLabel}>Surgeon *</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker 
                                        selectedValue={surgeryPlanData.surgeonId} 
                                        onValueChange={val => setSurgeryPlanData(prev => ({...prev, surgeonId: val}))}
                                    >
                                        <Picker.Item label="-- Select Surgeon --" value="" />
                                        {surgeonsList.map(s => {
                                            const sId = s.userId?._id || s.userId || s._id;
                                            const docName = s.name || s.userId?.name || 'Doctor';
                                            return (
                                                <Picker.Item key={s._id || sId} label={`Dr. ${docName.replace(/^Dr\.?\s*/i, '')} ${s.specialty ? `(${s.specialty})` : ''}`} value={sId} />
                                            );
                                        })}
                                    </Picker>
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.fieldLabel}>Preferred Date *</Text>
                                    <TextInput 
                                        style={styles.input} 
                                        placeholder="YYYY-MM-DD" 
                                        placeholderTextColor="#94a3b8"
                                        value={surgeryPlanData.preferredDate} 
                                        onChangeText={text => setSurgeryPlanData(prev => ({...prev, preferredDate: text}))} 
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.fieldLabel}>Preferred Time *</Text>
                                    <TextInput 
                                        style={styles.input} 
                                        placeholder="HH:MM (e.g. 09:30)" 
                                        placeholderTextColor="#94a3b8"
                                        value={surgeryPlanData.preferredTime} 
                                        onChangeText={text => setSurgeryPlanData(prev => ({...prev, preferredTime: text}))} 
                                    />
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={styles.checkboxRow} 
                                onPress={() => setSurgeryPlanData(prev => ({...prev, admissionRequired: !prev.admissionRequired}))}
                            >
                                <View style={[styles.checkboxBox, surgeryPlanData.admissionRequired && styles.checkboxBoxActive]}>
                                    {surgeryPlanData.admissionRequired && <Text style={styles.checkboxCheck}>✓</Text>}
                                </View>
                                <Text style={styles.checkboxLabel}>Admission Required</Text>
                            </TouchableOpacity>

                            {surgeryPlanData.admissionRequired && (
                                <View style={styles.sessionField}>
                                    <Text style={styles.fieldLabel}>Admission Date *</Text>
                                    <TextInput 
                                        style={styles.input} 
                                        placeholder="YYYY-MM-DD" 
                                        placeholderTextColor="#94a3b8"
                                        value={surgeryPlanData.admissionDate} 
                                        onChangeText={text => setSurgeryPlanData(prev => ({...prev, admissionDate: text}))} 
                                    />
                                </View>
                            )}

                            <TouchableOpacity 
                                style={styles.checkboxRow} 
                                onPress={() => setSurgeryPlanData(prev => ({...prev, preOpRequired: !prev.preOpRequired}))}
                            >
                                <View style={[styles.checkboxBox, surgeryPlanData.preOpRequired && styles.checkboxBoxActive]}>
                                    {surgeryPlanData.preOpRequired && <Text style={styles.checkboxCheck}>✓</Text>}
                                </View>
                                <Text style={styles.checkboxLabel}>Pre-Operative Preparation Required</Text>
                            </TouchableOpacity>

                            <View style={styles.sessionField}>
                                <Text style={styles.fieldLabel}>Notes</Text>
                                <TextInput 
                                    style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} 
                                    placeholder="Any specific requirements..." 
                                    placeholderTextColor="#94a3b8"
                                    multiline 
                                    value={surgeryPlanData.notes} 
                                    onChangeText={text => setSurgeryPlanData(prev => ({...prev, notes: text}))} 
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowSurgeryPlanModal(false)}>
                                <Text style={styles.modalCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#10b981' }]} onPress={handleCreateSurgeryPlan}>
                                <Text style={styles.modalActionBtnText}>Save Surgery Plan</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* REFERRAL MODAL (Web 1:1 Parity) */}
            <Modal visible={showReferralModal} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🔄 Refer for Surgery</Text>
                            <TouchableOpacity onPress={() => setShowReferralModal(false)} style={styles.modalCloseBtn}>
                                <Text style={styles.modalCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.patientSummaryCard}>
                                <Text style={styles.patientSummaryText}><Text style={{ fontWeight: 'bold' }}>Patient: </Text>{intakeData?.name || appointment?.userId?.name || 'N/A'}</Text>
                                <Text style={styles.patientSummaryText}><Text style={{ fontWeight: 'bold' }}>MRN: </Text>{intakeData?.patientUid || appointment?.userId?.patientId || '-'}</Text>
                            </View>

                            <View style={styles.referringDoctorCard}>
                                <Text style={styles.referringDoctorText}>
                                    <Text style={{ fontWeight: 'bold' }}>Referring Doctor: </Text>{user?.name || 'Current Doctor'} (You)
                                </Text>
                            </View>

                            <View style={styles.sessionField}>
                                <Text style={styles.fieldLabel}>Refer To Doctor / Surgeon *</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker 
                                        selectedValue={referralData.referredToDoctorId} 
                                        onValueChange={val => setReferralData(prev => ({...prev, referredToDoctorId: val}))}
                                    >
                                        <Picker.Item label="-- Select Doctor --" value="" />
                                        {surgeonsList
                                            .filter(s => {
                                                const docUserId = (s.userId?._id || s.userId || s._id)?.toString();
                                                const currentUserId = (user?._id || user?.id)?.toString();
                                                return docUserId !== currentUserId;
                                            })
                                            .map(s => {
                                                const sId = s.userId?._id || s.userId || s._id;
                                                const docName = s.name || s.userId?.name || 'Doctor';
                                                return (
                                                    <Picker.Item key={s._id || sId} label={`Dr. ${docName.replace(/^Dr\.?\s*/i, '')} ${s.specialty ? `(${s.specialty})` : ''}`} value={sId} />
                                                );
                                            })}
                                    </Picker>
                                </View>
                            </View>

                            <View style={styles.sessionField}>
                                <Text style={styles.fieldLabel}>Reason for Referral *</Text>
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="e.g. Appendectomy required" 
                                    placeholderTextColor="#94a3b8"
                                    value={referralData.reason} 
                                    onChangeText={text => setReferralData(prev => ({...prev, reason: text}))} 
                                />
                            </View>

                            <View style={styles.sessionField}>
                                <Text style={styles.fieldLabel}>Notes (Optional)</Text>
                                <TextInput 
                                    style={[styles.input, { minHeight: 65, textAlignVertical: 'top' }]} 
                                    placeholder="Any additional information..." 
                                    placeholderTextColor="#94a3b8"
                                    multiline 
                                    value={referralData.notes} 
                                    onChangeText={text => setReferralData(prev => ({...prev, notes: text}))} 
                                />
                            </View>
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowReferralModal(false)}>
                                <Text style={styles.modalCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#8b5cf6' }]} onPress={handleCreateReferral}>
                                <Text style={styles.modalActionBtnText}>Create Referral</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* REFERRAL REVIEW MODAL (Web 1:1 Parity) */}
            {showReferralReviewModal && activeReferralForReview && (
                <Modal visible={showReferralReviewModal} animationType="fade" transparent={true}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>📋 Review Referral</Text>
                                <TouchableOpacity 
                                    onPress={() => { setShowReferralReviewModal(false); setActiveReferralForReview(null); }} 
                                    style={styles.modalCloseBtn}
                                >
                                    <Text style={styles.modalCloseText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.modalBody}>
                                <View style={styles.patientSummaryCard}>
                                    <Text style={styles.patientSummaryText}><Text style={{ fontWeight: 'bold' }}>Patient: </Text>{activeReferralForReview.patientId?.name || 'N/A'}</Text>
                                    <Text style={styles.patientSummaryText}><Text style={{ fontWeight: 'bold' }}>MRN: </Text>{activeReferralForReview.patientId?.patientId || activeReferralForReview.patientId?.mrn || '-'}</Text>
                                </View>
                                
                                <View style={styles.referralReviewDetailsBox}>
                                    <Text style={styles.referralReviewDetailItem}><Text style={{ fontWeight: 'bold' }}>Referred By: </Text>{activeReferralForReview.referringDoctorId?.name || 'N/A'}</Text>
                                    <Text style={styles.referralReviewDetailItem}><Text style={{ fontWeight: 'bold' }}>Reason: </Text>{activeReferralForReview.reason}</Text>
                                    {activeReferralForReview.notes && <Text style={styles.referralReviewDetailItem}><Text style={{ fontWeight: 'bold' }}>Notes: </Text>{activeReferralForReview.notes}</Text>}
                                    <Text style={styles.referralReviewDetailItem}><Text style={{ fontWeight: 'bold' }}>Date: </Text>{new Date(activeReferralForReview.referralDate).toLocaleDateString()}</Text>
                                </View>

                                <Text style={[styles.fieldLabel, { fontSize: 15, color: '#1e293b', marginTop: 14 }]}>Surgery Required?</Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                                    <TouchableOpacity
                                        style={[styles.modalActionBtn, { flex: 1, backgroundColor: '#fee2e2', borderWidth: 2, borderColor: '#fecaca' }]}
                                        onPress={() => handleReviewReferral(activeReferralForReview._id, 'NOT_REQUIRED', 'Surgery not required after evaluation')}
                                    >
                                        <Text style={{ color: '#991b1b', fontWeight: 'bold', fontSize: 13 }}>❌ No — Not Required</Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity
                                        style={[styles.modalActionBtn, { flex: 1, backgroundColor: '#dcfce7', borderWidth: 2, borderColor: '#bbf7d0' }]}
                                        onPress={() => {
                                            handleReviewReferral(activeReferralForReview._id, 'ACCEPTED', 'Surgery confirmed after evaluation').then(() => {
                                                setSurgeryPlanData(prev => ({
                                                    ...prev,
                                                    surgery: activeReferralForReview.reason || prev.surgery || '',
                                                    diagnosis: activeReferralForReview.reason || '',
                                                    surgeonId: user?._id || '',
                                                    referralId: activeReferralForReview._id,
                                                    referringDoctorId: activeReferralForReview.referringDoctorId?._id || ''
                                                }));
                                                setShowSurgeryPlanModal(true);
                                            });
                                        }}
                                    >
                                        <Text style={{ color: '#166534', fontWeight: 'bold', fontSize: 13 }}>✅ Yes — Create Surgery Plan</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* PRESCRIPTION PREVIEW & PRINT MODAL */}
            <Modal visible={showPrescriptionModal} animationType="fade" transparent={true}>
                <View style={styles.pdfModalOverlay}>
                    <View style={styles.pdfModalContent}>
                        <View style={styles.pdfHeader}>
                            <Text style={styles.pdfTitle}>
                                {prescriptionMode === 'cumulative' ? '📜 Cumulative Clinical Record' : '📄 Prescription Slip'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowPrescriptionModal(false)} style={styles.modalCloseBtn}>
                                <Text style={styles.modalCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.pdfBody}>
                            <View style={styles.pdfCard}>
                                <Text style={styles.pdfHospitalName}>{hospitalContext?.name || 'TEAM MEDICAL 365 HOSPITAL'}</Text>
                                <Text style={styles.pdfHospitalSub}>
                                    {[hospitalContext?.address, hospitalContext?.city, hospitalContext?.state].filter(Boolean).join(', ') || 'Excellence in Healthcare'}
                                </Text>
                                {hospitalContext?.phone ? <Text style={styles.pdfHospitalSub}>Ph: {hospitalContext.phone}</Text> : null}

                                <View style={[styles.pdfDivider, prescriptionMode === 'cumulative' && { backgroundColor: '#2563eb' }]} />

                                <View style={styles.pdfInfoRow}>
                                    <Text style={styles.pdfInfoLabel}>Patient:</Text>
                                    <Text style={styles.pdfInfoVal}>{patient.name || intakeData.name || '-'}</Text>
                                </View>
                                <View style={styles.pdfInfoRow}>
                                    <Text style={styles.pdfInfoLabel}>MRN / ID:</Text>
                                    <Text style={styles.pdfInfoVal}>{patient.patientId || patient.patientUid || appointment?.patientId || 'N/A'}</Text>
                                </View>
                                <View style={styles.pdfInfoRow}>
                                    <Text style={styles.pdfInfoLabel}>Age / Gender:</Text>
                                    <Text style={styles.pdfInfoVal}>{profile.age || intakeData.age || '-'} / {profile.gender || intakeData.gender || '-'}</Text>
                                </View>
                                <View style={styles.pdfInfoRow}>
                                    <Text style={styles.pdfInfoLabel}>Doctor:</Text>
                                    <Text style={styles.pdfInfoVal}>Dr. {(appointment?.doctorName || user?.name || 'Doctor').replace(/^Dr\.?\s*/i, '')}</Text>
                                </View>
                                <View style={styles.pdfInfoRow}>
                                    <Text style={styles.pdfInfoLabel}>Diagnosis:</Text>
                                    <Text style={[styles.pdfInfoVal, { fontWeight: 'bold' }]}>{sessionData.diagnosis || appointment?.diagnosis || '-'}</Text>
                                </View>

                                <Text style={styles.pdfSectionHead}>💊 Prescribed Medicines</Text>
                                {(sessionData.medicines || []).filter(m => m.medicineName?.trim()).length > 0 ? (
                                    (sessionData.medicines || []).filter(m => m.medicineName?.trim()).map((m, idx) => (
                                        <View key={idx} style={styles.pdfMedItem}>
                                            <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>{idx + 1}. {m.medicineName}</Text>
                                            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                                Dose: {m.dose || 'Standard'} &bull; Timing: {m.saltName || 'As directed'} &bull; Duration: {m.days ? `${m.days} days` : 'Ongoing'}
                                            </Text>
                                        </View>
                                    ))
                                ) : (
                                    <Text style={{ color: '#94a3b8', fontSize: 12, marginVertical: 4 }}>No medicines prescribed.</Text>
                                )}

                                <Text style={styles.pdfSectionHead}>🧪 Lab Tests Ordered</Text>
                                {sessionData.labTests ? (
                                    <Text style={{ color: '#0f172a', fontSize: 13, marginBottom: 8 }}>{sessionData.labTests}</Text>
                                ) : (
                                    <Text style={{ color: '#94a3b8', fontSize: 12, marginVertical: 4 }}>No lab tests ordered.</Text>
                                )}

                                {sessionData.notes ? (
                                    <>
                                        <Text style={styles.pdfSectionHead}>📋 Clinical Notes</Text>
                                        <Text style={{ color: '#334155', fontSize: 13, lineHeight: 18 }}>{sessionData.notes}</Text>
                                    </>
                                ) : null}
                            </View>
                        </ScrollView>

                        <View style={styles.pdfFooterBar}>
                            <TouchableOpacity
                                style={[styles.modalActionBtn, { backgroundColor: '#10b981', flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                                onPress={() => handlePrintPrescription(false)}
                            >
                                <Text style={styles.modalActionBtnText}>🖨️ Print / Save PDF</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalActionBtn, { backgroundColor: '#3b82f6', flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                                onPress={() => handleDownloadPrescriptionPDF(false)}
                            >
                                <Text style={styles.modalActionBtnText}>📤 Export / Share</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4ff' },
    containerScroll: { flex: 1 },
    containerGrid: { flexDirection: 'row', flex: 1, minHeight: '100%' },
    containerGridJr: { flexDirection: 'column', flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f4ff' },
    loadingText: { marginTop: 16, color: '#64748b', fontSize: 16 },
    backBtn: { marginTop: 16, padding: 12, backgroundColor: '#3b82f6', borderRadius: 8 },
    backBtnText: { color: 'white', fontWeight: 'bold' },
    
    leftPanel: { flex: 0.45, borderRightWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    rightPanel: { flex: 0.55, backgroundColor: '#ffffff' },
    rightPanelTimeMachine: { borderLeftWidth: 4, borderColor: '#3b82f6', backgroundColor: '#f8fafc' },
    
    patientHeader: { padding: 20, backgroundColor: '#0f172a' },
    backLink: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12 },
    backLinkText: { color: '#94a3b8', fontWeight: '600', fontSize: 12 },
    patientIdentity: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
    patientAvatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    patientAvatarText: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    patientMeta: { flex: 1 },
    patientName: { color: '#60a5fa', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
    patientTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
    tagMrn: { backgroundColor: 'rgba(59, 130, 246, 0.15)' }, tagMrnText: { color: '#60a5fa', fontSize: 11, fontWeight: '600' },
    tagPhone: { backgroundColor: 'rgba(16, 185, 129, 0.15)' }, tagPhoneText: { color: '#34d399', fontSize: 11, fontWeight: '600' },
    tagAge: { backgroundColor: 'rgba(245, 158, 11, 0.15)' }, tagAgeText: { color: '#fbbf24', fontSize: 11, fontWeight: '600' },
    tagGender: { backgroundColor: 'rgba(236, 72, 153, 0.15)' }, tagGenderText: { color: '#f472b6', fontSize: 11, fontWeight: '600' },
    tagBlood: { backgroundColor: 'rgba(239, 68, 68, 0.15)' }, tagBloodText: { color: '#f87171', fontSize: 11, fontWeight: '600' },
    
    apptInfo: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#f0f4ff', padding: 12, borderRadius: 12, gap: 10 },
    apptItem: { width: '48%', marginBottom: 6 },
    apptLabel: { fontSize: 10, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' },
    apptValue: { fontSize: 13, color: '#1e293b', fontWeight: '600' },
    apptStatus: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
    apptStatusText: { fontSize: 11, fontWeight: 'bold', textTransform: 'capitalize' },
    status_confirmed: { backgroundColor: 'rgba(34,197,94,0.2)' }, statusText_confirmed: { color: '#16a34a' },
    status_completed: { backgroundColor: 'rgba(59,130,246,0.2)' }, statusText_completed: { color: '#2563eb' },
    status_cancelled: { backgroundColor: 'rgba(239,68,68,0.2)' }, statusText_cancelled: { color: '#dc2626' },
    status_pending: { backgroundColor: 'rgba(245,158,11,0.2)' }, statusText_pending: { color: '#b45309' },

    openAiBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#6366f1',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    openAiBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 12.5 },

    tabsContainerWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
    tabScrollBtn: { paddingHorizontal: 10, paddingVertical: 10, justifyContent: 'center', alignItems: 'center' },
    tabScrollBtnText: { fontSize: 18, color: '#64748b', fontWeight: 'bold' },
    tabsContainer: { flex: 1 },
    tabsNav: { paddingVertical: 10, paddingHorizontal: 8, flexDirection: 'row', gap: 6 },
    tabBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#f1f5f9', borderRadius: 8, marginRight: 6 },
    tabBtnActive: { backgroundColor: '#3b82f6' },
    tabIcon: { marginRight: 6, fontSize: 13 },
    tabLabel: { fontSize: 12.5, color: '#64748b', fontWeight: '600' },
    tabLabelActive: { color: '#ffffff', fontWeight: '700' },

    tabContent: { padding: 18 },
    tabPanel: { flex: 1 },
    panelTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a', borderBottomWidth: 2, borderColor: '#e2e8f0', paddingBottom: 8, marginBottom: 16 },
    overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
    ovCard: { width: '48%', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12 },
    ovLabel: { fontSize: 10.5, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 3 },
    ovValue: { fontSize: 13.5, color: '#1e293b', fontWeight: '600' },

    partnerQuick: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    partnerTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 12 },

    emptyHist: { padding: 30, alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', borderRadius: 14 },
    emptyHistText: { color: '#94a3b8', fontSize: 13 },
    historyList: { gap: 12 },
    historyCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 14, marginBottom: 10 },
    historyCardCurrent: { borderColor: '#3b82f6', borderWidth: 2, backgroundColor: '#eff6ff' },
    historyCardViewing: { borderColor: '#3b82f6', borderWidth: 2 },
    histTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    histDate: { fontWeight: 'bold', color: '#1e40af', fontSize: 13.5 },
    histDiagnosis: { fontSize: 13, color: '#334155', marginBottom: 4 },
    histNotesText: { fontSize: 12.5, color: '#475569', marginBottom: 4 },
    currentBadge: { backgroundColor: '#3b82f6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginTop: 6 },
    currentBadgeText: { color: '#ffffff', fontSize: 10.5, fontWeight: 'bold' },
    viewingBadge: { backgroundColor: '#3b82f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 6 },
    viewingBadgeText: { color: '#ffffff', fontSize: 10.5, fontWeight: 'bold' },

    saveSectionBtn: { marginTop: 16, backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center' },
    saveSectionBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },

    rightHeader: { padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fafbff' },
    rightHeaderTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
    rightSubtitle: { fontSize: 12.5, color: '#94a3b8', marginTop: 2 },
    tmReadOnlyBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
    tmReadOnlyBadgeText: { fontSize: 11, color: '#1e40af', fontWeight: 'bold' },
    exitTmBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    exitTmBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },

    rightContent: { padding: 18 },
    sessionField: { marginBottom: 16 },
    fieldLabel: { fontSize: 12.5, fontWeight: 'bold', color: '#334155', marginBottom: 6 },
    fieldSublabel: { fontSize: 11.5, fontWeight: '700', color: '#64748b', marginBottom: 4 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 13, color: '#1e293b', backgroundColor: '#ffffff' },
    diagInput: { fontWeight: '600', fontSize: 14, borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
    textArea: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 13, color: '#1e293b', backgroundColor: '#ffffff', minHeight: 120 },
    tmFieldBox: { padding: 12, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 8 },
    tmFieldText: { color: '#334155', fontSize: 13 },

    referralBanner: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    incomingReferralBanner: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 10, borderWidth: 2, borderColor: '#f59e0b', marginBottom: 14 },
    incomingReferralTitle: { fontWeight: 'bold', color: '#92400e', fontSize: 13.5, marginBottom: 4 },
    incomingReferralText: { fontSize: 12.5, color: '#78350f', marginBottom: 6 },
    reviewReferralBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#f59e0b', borderRadius: 6 },
    reviewReferralBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 11.5 },
    referralLabel: { fontWeight: 'bold', color: '#1e293b', marginBottom: 10, fontSize: 13 },
    radioGroup: { flexDirection: 'row', gap: 16, marginBottom: 12 },
    radioBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
    radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    radioOuterActive: { borderColor: '#3b82f6' },
    radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' },
    radioText: { fontSize: 13, color: '#475569' },
    surgeryActions: { gap: 8, marginTop: 6 },
    surgeryBtn: { backgroundColor: '#2563eb', padding: 11, borderRadius: 8, alignItems: 'center' },
    surgeryBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
    referralBtn: { backgroundColor: '#7c3aed', padding: 11, borderRadius: 8, alignItems: 'center' },
    referralBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },

    prescribeBtn: { backgroundColor: '#4f46e5', padding: 13, borderRadius: 10, alignItems: 'center', elevation: 2 },
    prescribeBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
    ipdOrdersQuickBtn: { backgroundColor: '#0284c7', padding: 11, borderRadius: 10, alignItems: 'center', marginTop: 8 },
    ipdOrdersQuickBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
    includedSummaryBox: { padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 10 },
    includedSummaryTitle: { fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 3 },
    includedSummaryLink: { fontSize: 11.5, color: '#2563eb', fontWeight: '700', marginTop: 4 },
    includedSummaryHint: { fontSize: 11, color: '#64748b', marginTop: 4, fontStyle: 'italic' },
    
    labGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    labTestCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, minWidth: '47%', flex: 1 },
    labTestCardActive: { backgroundColor: '#eff6ff', borderColor: '#93c5fd' },
    labCheckCircle: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#cbd5e1', marginRight: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
    labCheckCircleActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    labCheckmark: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
    labTestNameText: { fontSize: 12.5, fontWeight: '700', color: '#0f172a' },
    labTestCatText: { fontSize: 11, color: '#64748b', marginTop: 1 },

    rightFooter: { padding: 16, flexDirection: 'row', gap: 10, borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fafbff' },
    btnSaveDraft: { padding: 12, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, flex: 1, alignItems: 'center' },
    btnSaveDraftText: { color: '#475569', fontWeight: 'bold', fontSize: 13 },
    btnFinish: { padding: 12, backgroundColor: '#10b981', borderRadius: 10, flex: 1, alignItems: 'center', elevation: 2 },
    btnFinishText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
    btnReprint: { padding: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, flex: 1, alignItems: 'center' },
    btnReprintText: { color: '#334155', fontWeight: 'bold', fontSize: 12.5 },
    copyTmBtn: { padding: 12, borderWidth: 1, borderColor: '#3b82f6', borderRadius: 8, flex: 1, alignItems: 'center' },
    copyTmBtnText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 12.5 },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalContent: { backgroundColor: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '90%', overflow: 'hidden' },
    modalContentLarge: { backgroundColor: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 850, maxHeight: '90%', overflow: 'hidden' },
    modalHeader: { padding: 18, borderBottomWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    modalCloseBtn: { backgroundColor: '#f1f5f9', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    modalCloseText: { color: '#475569', fontWeight: 'bold', fontSize: 15 },
    modalBody: { padding: 18 },
    modalSectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 10, marginTop: 6 },
    searchList: { maxHeight: 160, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginBottom: 14 },
    searchItem: { padding: 10, borderBottomWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    searchItemTitle: { fontWeight: '600', color: '#1e293b', fontSize: 13 },
    searchItemSub: { fontSize: 11, color: '#94a3b8' },
    
    // Web Table Styling
    webTableWrapper: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 10, backgroundColor: '#ffffff' },
    webTableContent: { minWidth: 690 },
    tableHeaderRow: { backgroundColor: '#f1f5f9', flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 10 },
    tableHeaderCell: { fontSize: 13, fontWeight: '700', color: '#374151' },
    tableBodyRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#f1f5f9', paddingVertical: 6, paddingHorizontal: 10 },
    tableInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 6, fontSize: 12, backgroundColor: '#ffffff', color: '#1e293b' },
    tablePickerBox: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 5, backgroundColor: '#ffffff', overflow: 'hidden', height: 38, justifyContent: 'center' },
    tablePicker: { height: 38, fontSize: 12, color: '#1e293b' },
    tableDeleteBtn: { backgroundColor: '#fee2e2', borderRadius: 4, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    tableDeleteBtnText: { color: '#dc2626', fontWeight: 'bold', fontSize: 14 },
    emptyMedTableRow: { padding: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },

    emptyMedBox: { padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    emptyMedText: { color: '#94a3b8', fontSize: 12.5, textAlign: 'center' },
    addMedBtn: { padding: 9, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', borderStyle: 'dashed', borderRadius: 8, alignItems: 'center', marginBottom: 16 },
    addMedBtnText: { color: '#16a34a', fontWeight: '700', fontSize: 12.5 },
    divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 10, borderStyle: 'dashed' },

    modalFooter: { padding: 14, borderTopWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    modalCancelBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f1f5f9', borderRadius: 8 },
    modalCancelBtnText: { color: '#475569', fontWeight: 'bold', fontSize: 13 },
    modalActionBtn: { backgroundColor: '#3b82f6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center' },
    modalActionBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13.5 },

    patientSummaryCard: { background: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    patientSummaryText: { fontSize: 13, color: '#334155', lineHeight: 18 },
    referringDoctorCard: { backgroundColor: '#f0fdf4', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 12 },
    referringDoctorText: { fontSize: 13, color: '#166534' },
    referredCaseBadge: { backgroundColor: '#f5f3ff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ddd6fe', marginBottom: 12 },
    referredCaseBadgeText: { fontSize: 12.5, color: '#5b21b6', fontWeight: '600' },
    formRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    checkboxBox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
    checkboxBoxActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    checkboxCheck: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
    checkboxLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
    referralReviewDetailsBox: { backgroundColor: '#fffbeb', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fde68a', marginVertical: 10 },
    referralReviewDetailItem: { fontSize: 13, color: '#92400e', marginBottom: 4 },

    pdfModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    pdfModalContent: { backgroundColor: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90%', overflow: 'hidden' },
    pdfHeader: { padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' },
    pdfTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
    pdfBody: { padding: 16 },
    pdfCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16 },
    pdfHospitalName: { fontSize: 18, fontWeight: '800', textAlign: 'center', color: '#0f172a' },
    pdfHospitalSub: { fontSize: 11, textAlign: 'center', color: '#64748b', marginTop: 2 },
    pdfDivider: { height: 2, backgroundColor: '#16a34a', marginVertical: 12 },
    pdfInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    pdfInfoLabel: { fontSize: 12, fontWeight: 'bold', color: '#475569' },
    pdfInfoVal: { fontSize: 12, color: '#0f172a' },
    pdfSectionHead: { fontSize: 13.5, fontWeight: 'bold', color: '#0f172a', marginTop: 12, marginBottom: 8, borderBottomWidth: 1, borderColor: '#e2e8f0', paddingBottom: 4 },
    pdfMedItem: { backgroundColor: '#f8fafc', padding: 8, borderRadius: 6, marginBottom: 6, borderWidth: 1, borderColor: '#e2e8f0' },
    pdfFooterBar: { padding: 16, borderTopWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', gap: 10 },
});

export default DoctorPatientDetails;
