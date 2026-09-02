import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

// Assuming you have mapped these API utilities to work in React Native
import { doctorAPI, labTestAPI, questionLibraryAPI, hospitalAPI, patientAPI, receptionAPI, otAPI, adminEntitiesAPI, referralAPI, publicAPI } from '../../utils/api';
// Assuming useAuth is mapped for React Native context
import { useAuth } from '../../store/hooks';

// Dummy imports for child components to avoid breaking
import DynamicQuestionForm from '../../components/DynamicQuestionForm';
import AppointmentReports from '../../components/AppointmentReports';

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

const DoctorPatientDetails = () => {
    const route = useRoute();
    const navigation = useNavigation();
    
    // In React Native, route params are used instead of useParams/useLocation
    const id = route.params?.id;
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

    // Surgery Plan States
    const [operationRequired, setOperationRequired] = useState(false);
    const [showSurgeryPlanModal, setShowSurgeryPlanModal] = useState(false);
    const [surgeonsList, setSurgeonsList] = useState([]);
    const [surgeryPlanData, setSurgeryPlanData] = useState({
        surgery: '', diagnosis: '', surgeonId: '', preferredDate: '', preferredTime: '', admissionRequired: false, admissionDate: '', preOpRequired: false, notes: ''
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
                        diagnosis: refObj.notes || prev.diagnosis
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

                        setSessionData({
                            diagnosis: res.appointment.diagnosis || '',
                            notes: res.appointment.doctorNotes || '',
                            medicines: (res.appointment.pharmacy || []).map(p => ({
                                medicineName: p.medicineName || '',
                                saltName: p.saltName || '',
                                dose: p.frequency || '',
                                days: p.duration || ''
                            })),
                            labTests: (res.appointment.labTests || []).join(', ')
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
                            setLoading(false);
                            return;
                        }
                    } catch(e) { console.error("Error loading fallback profile", e); }
                }
            } catch (err) { console.error(err); }
            finally {
                setLoading(false);
            }

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
                    surgery: '', diagnosis: '', surgeonId: '', preferredDate: '', preferredTime: '', admissionRequired: false, admissionDate: '', preOpRequired: false, notes: ''
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
                            labTests: sessionData.labTests.split(',').map(s => s.trim()).filter(Boolean),
                            pharmacy: (sessionData.medicines || []).filter(m => m.medicineName?.trim()).map(m => ({
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
                                { text: "No, stay here", style: "cancel", onPress: () => {
                                    Alert.alert('Session Completed', 'This consultation has already been completed. This record is now read-only.');
                                }},
                                { text: "Yes", onPress: () => {
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
                        
                        // NOTE: jsPDF generation logic omitted for React Native since it requires native modules (expo-print).
                        Alert.alert('PDF Generation', 'PDFs are currently unsupported natively without the expo-print module.');

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
                    <Text style={styles.backBtnText}>← Back to Dashboard</Text>
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

    const tabs = [
        { id: 'overview', label: 'Overview', icon: '📋' },
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

    const isValAvailable = (val) => {
        return val && val !== '-' && val !== 'None' && val.toString().trim() !== '';
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView horizontal={false} style={styles.containerScroll}>
                <View style={isJrDoctor ? styles.containerGridJr : styles.containerGrid}>
                    
                    {/* LEFT PANEL */}
                    <View style={styles.leftPanel}>
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
                                        <Text style={[styles.tag, styles.tagMrn]}>MRN: {patient.patientId || 'N/A'}</Text>
                                        <Text style={[styles.tag, styles.tagPhone]}>📱 {patient.phone || '-'}</Text>
                                        {isValAvailable(profile.age) && <Text style={[styles.tag, styles.tagAge]}>Age: {profile.age}</Text>}
                                        {isValAvailable(profile.gender) && <Text style={[styles.tag, styles.tagGender]}>{profile.gender}</Text>}
                                        {isValAvailable(profile.bloodGroup) && <Text style={[styles.tag, styles.tagBlood]}>{profile.bloodGroup}</Text>}
                                    </View>
                                </View>
                            </View>
                            <View style={styles.apptInfo}>
                                <View style={styles.apptItem}>
                                    <Text style={styles.apptLabel}>Date</Text>
                                    <Text style={styles.apptValue}>{new Date(appointment.appointmentDate).toLocaleDateString()}</Text>
                                </View>
                                <View style={styles.apptItem}>
                                    <Text style={styles.apptLabel}>Time</Text>
                                    <Text style={styles.apptValue}>{appointment.appointmentTime}</Text>
                                </View>
                                <View style={styles.apptItem}>
                                    <Text style={styles.apptLabel}>Status</Text>
                                    <View style={[styles.apptStatus, styles[`status_${appointment.status}`] || styles.status_pending]}>
                                        <Text style={[styles.apptStatusText, styles[`statusText_${appointment.status}`] || styles.statusText_pending]}>{appointment.status} {isLocked ? '🔒 Locked' : ''}</Text>
                                    </View>
                                </View>
                                <View style={styles.apptItem}>
                                    <Text style={styles.apptLabel}>Service</Text>
                                    <Text style={styles.apptValue}>{appointment.serviceName || 'Consultation'}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Tabs Nav */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer} contentContainerStyle={styles.tabsNav}>
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

                        {/* Tab Content */}
                        <View style={styles.tabContent}>
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
                                        
                                        {(() => {
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
                                            return (
                                                <>
                                                    {isValAvailable(vitalsInfo.height) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Height</Text><Text style={styles.ovValue}>{vitalsInfo.height} cm</Text></View>}
                                                    {isValAvailable(vitalsInfo.weight) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Weight</Text><Text style={styles.ovValue}>{vitalsInfo.weight} kg</Text></View>}
                                                    {isValAvailable(vitalsInfo.bmi) && <View style={styles.ovCard}><Text style={styles.ovLabel}>BMI</Text><Text style={styles.ovValue}>{vitalsInfo.bmi}</Text></View>}
                                                    {isValAvailable(vitalsInfo.bp) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Blood Pressure</Text><Text style={styles.ovValue}>{vitalsInfo.bp}</Text></View>}
                                                    {isValAvailable(vitalsInfo.pulse) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Pulse</Text><Text style={styles.ovValue}>{vitalsInfo.pulse} bpm</Text></View>}
                                                    {isValAvailable(vitalsInfo.temp) && <View style={styles.ovCard}><Text style={styles.ovLabel}>Temperature</Text><Text style={styles.ovValue}>{vitalsInfo.temp} °F</Text></View>}
                                                    {isValAvailable(vitalsInfo.spo2) && <View style={styles.ovCard}><Text style={styles.ovLabel}>SpO2</Text><Text style={styles.ovValue}>{vitalsInfo.spo2}%</Text></View>}
                                                </>
                                            );
                                        })()}
                                        <View style={styles.ovCard}><Text style={styles.ovLabel}>Address</Text><Text style={styles.ovValue}>{patient.address || profile.address || '-'}</Text></View>
                                        <View style={styles.ovCard}><Text style={styles.ovLabel}>Reason for Visit</Text><Text style={styles.ovValue}>{profile.reasonForVisit || intakeData.reasonForVisit || '-'}</Text></View>
                                    </View>
                                </View>
                            )}
                            
                            {activeTab === 'history' && (
                                <View style={styles.tabPanel}>
                                    <Text style={styles.panelTitle}>📜 Previous Consultations ({history.length})</Text>
                                    {history.length === 0 ? (
                                        <View style={styles.emptyHist}><Text style={styles.emptyHistText}>No previous visits recorded.</Text></View>
                                    ) : (
                                        <View style={styles.historyList}>
                                            {history.map(h => (
                                                <TouchableOpacity key={h._id} style={[styles.historyCard, h._id === appointmentId && styles.historyCardCurrent, viewingPastSession?._id === h._id && styles.historyCardViewing]} onPress={() => {
                                                    if (h._id === appointmentId) setViewingPastSession(null);
                                                    else setViewingPastSession(viewingPastSession?._id === h._id ? null : h);
                                                }}>
                                                    {viewingPastSession?._id === h._id && (
                                                        <View style={styles.viewingBadge}><Text style={styles.viewingBadgeText}>👁️ Viewing Right Now</Text></View>
                                                    )}
                                                    <View style={styles.histTop}>
                                                        <Text style={styles.histDate}>{new Date(h.appointmentDate || h.visitDate || h.createdAt).toLocaleDateString()}</Text>
                                                        <View style={[styles.apptStatus, styles[`status_${h.status}`] || styles.status_pending]}><Text style={[styles.apptStatusText, styles[`statusText_${h.status}`] || styles.statusText_pending]}>{h.status}</Text></View>
                                                    </View>
                                                    <Text style={styles.histDiagnosis}><Text style={{fontWeight: 'bold'}}>Diagnosis: </Text>{h.doctorConsultation?.diagnosis?.length > 0 ? h.doctorConsultation.diagnosis.join(', ') : (h.diagnosis || 'None')}</Text>
                                                    {h._id === appointmentId && <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>📌 Current Session</Text></View>}
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            )}

                            {activeTab === 'reports' && (
                                <AppointmentReports appointmentId={appointment?._id} prescriptions={appointment?.prescriptions} />
                            )}
                        </View>
                    </View>

                    {/* RIGHT PANEL - SESSION NOTEPAD */}
                    {!isJrDoctor && (
                        <View style={[styles.rightPanel, viewingPastSession ? styles.rightPanelTimeMachine : null]}>
                            {viewingPastSession ? (
                                <>
                                    <View style={[styles.rightHeader, { backgroundColor: '#eff6ff', borderBottomColor: '#bfdbfe' }]}>
                                        <View>
                                            <Text style={[styles.rightHeaderTitle, { color: '#1e3a8a' }]}>🕰️ Past Session</Text>
                                            <Text style={[styles.rightSubtitle, { color: '#3b82f6' }]}>Viewing notes from {new Date(viewingPastSession.appointmentDate).toLocaleDateString()}</Text>
                                        </View>
                                        <TouchableOpacity onPress={() => setViewingPastSession(null)} style={styles.exitTmBtn}>
                                            <Text style={styles.exitTmBtnText}>✕ Exit Time Machine</Text>
                                        </TouchableOpacity>
                                    </View>
                                    
                                    <ScrollView style={styles.rightContent}>
                                        <View style={styles.sessionField}>
                                            <Text style={styles.fieldLabel}>🔍 Diagnosis at the time</Text>
                                            <View style={styles.tmFieldBox}><Text style={styles.tmFieldText}>{viewingPastSession.diagnosis || 'No diagnosis'}</Text></View>
                                        </View>
                                        <View style={styles.sessionField}>
                                            <Text style={styles.fieldLabel}>📋 Clinical Notes</Text>
                                            <View style={styles.tmFieldBox}><Text style={styles.tmFieldText}>{viewingPastSession.doctorNotes || 'No notes'}</Text></View>
                                        </View>
                                        <View style={styles.sessionField}>
                                            <Text style={styles.fieldLabel}>💊 Prescription Given</Text>
                                            <View style={styles.tmFieldBox}>
                                                {viewingPastSession.pharmacy?.length > 0 ? viewingPastSession.pharmacy.map((p, i) => (
                                                    <Text key={i} style={styles.tmFieldText}>• {p.medicineName}</Text>
                                                )) : <Text style={styles.tmFieldText}>No prescription</Text>}
                                            </View>
                                        </View>
                                        <View style={styles.sessionField}>
                                            <Text style={styles.fieldLabel}>🧪 Lab Tests Ordered</Text>
                                            <View style={styles.tmFieldBox}>
                                                <Text style={styles.tmFieldText}>{(viewingPastSession.labTests || []).join(', ') || 'None'}</Text>
                                            </View>
                                        </View>
                                    </ScrollView>

                                    <View style={[styles.rightFooter, { backgroundColor: '#f1f5f9' }]}>
                                        <TouchableOpacity style={styles.copyTmBtn} onPress={() => {
                                            setSessionData(prev => ({
                                                ...prev,
                                                diagnosis: viewingPastSession.diagnosis || '',
                                                notes: viewingPastSession.doctorNotes || '',
                                                labTests: (viewingPastSession.labTests || []).join(', ')
                                            }));
                                            setViewingPastSession(null);
                                            Alert.alert('Success', 'Historical data copied into your Current Session editor!');
                                        }}>
                                            <Text style={styles.copyTmBtnText}>📋 Copy to Current Session</Text>
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
                                        <View style={[styles.apptStatus, styles[`status_${appointment.status}`] || styles.status_pending]}><Text style={[styles.apptStatusText, styles[`statusText_${appointment.status}`] || styles.statusText_pending]}>{appointment.status}</Text></View>
                                    </View>

                                    <ScrollView style={styles.rightContent}>
                                        <View style={styles.sessionField}>
                                            <Text style={styles.fieldLabel}>🔍 Diagnosis</Text>
                                            <TextInput
                                                style={[styles.input, styles.diagInput]}
                                                placeholder="Enter diagnosis..."
                                                value={sessionData.diagnosis}
                                                onChangeText={(text) => !isLocked && setSessionData(prev => ({ ...prev, diagnosis: text }))}
                                                editable={!isLocked}
                                            />
                                        </View>
                                        <View style={styles.sessionField}>
                                            <Text style={styles.fieldLabel}>📋 Clinical Notes</Text>
                                            <TextInput
                                                style={styles.textArea}
                                                placeholder="Write detailed clinical notes..."
                                                multiline={true}
                                                textAlignVertical="top"
                                                value={sessionData.notes}
                                                onChangeText={(text) => !isLocked && setSessionData(prev => ({ ...prev, notes: text }))}
                                                editable={!isLocked}
                                            />
                                        </View>

                                        {!isLocked && (
                                            <View style={styles.referralBanner}>
                                                <Text style={styles.referralLabel}>🔪 Operation Required?</Text>
                                                <View style={styles.radioGroup}>
                                                    <TouchableOpacity style={styles.radioBtn} onPress={() => setOperationRequired(false)}>
                                                        <View style={[styles.radioOuter, !operationRequired && styles.radioOuterActive]}><View style={!operationRequired && styles.radioInner}/></View>
                                                        <Text style={styles.radioText}>No</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={styles.radioBtn} onPress={() => setOperationRequired(true)}>
                                                        <View style={[styles.radioOuter, operationRequired && styles.radioOuterActive]}><View style={operationRequired && styles.radioInner}/></View>
                                                        <Text style={styles.radioText}>Yes</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                {operationRequired && (
                                                    <View style={styles.surgeryActions}>
                                                        <TouchableOpacity style={styles.surgeryBtn} onPress={() => {
                                                            setSurgeryPlanData(prev => ({ ...prev, diagnosis: sessionData.diagnosis, surgeonId: user?._id || '' }));
                                                            setShowSurgeryPlanModal(true);
                                                        }}>
                                                            <Text style={styles.surgeryBtnText}>+ Create Surgery Plan</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity style={styles.referralBtn} onPress={() => {
                                                            setReferralData(prev => ({ ...prev, reason: sessionData.diagnosis }));
                                                            setShowReferralModal(true);
                                                        }}>
                                                            <Text style={styles.referralBtnText}>🔄 Refer for Surgery</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        )}

                                        <View style={styles.sessionField}>
                                            {!isLocked && (
                                                <TouchableOpacity style={styles.prescribeBtn} onPress={() => setShowPrescribeModal(true)}>
                                                    <Text style={styles.prescribeBtnText}>💊 / 🧪 Prescribe Medicines & Lab Tests</Text>
                                                </TouchableOpacity>
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
                                                    <Text style={styles.btnFinishText}>{saving ? '⏳ Saving...' : '✅ Save & Finish'}</Text>
                                                </TouchableOpacity>
                                            </>
                                        ) : (
                                            <>
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

            {/* PRESCRIBE MODAL */}
            <Modal visible={showPrescribeModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>⚕️ Prescribe Medicines & Lab Tests</Text>
                            <TouchableOpacity onPress={() => setShowPrescribeModal(false)} style={styles.modalCloseBtn}><Text style={styles.modalCloseText}>✕</Text></TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            
                            {/* Medicine Details - Simplified for Mobile layout */}
                            <Text style={styles.modalSectionTitle}>💊 Medicines Prescribed</Text>
                            <TextInput style={styles.input} placeholder="Search medicine..." value={medSearch} onChangeText={text => setMedSearch(text)} />
                            
                            {medSearch.length > 0 && (
                                <View style={styles.searchList}>
                                    {catalogMedicines.filter(m => m.name.toLowerCase().includes(medSearch.toLowerCase())).map(med => (
                                        <TouchableOpacity key={med._id} style={styles.searchItem} onPress={() => {
                                            setSessionData(prev => ({ ...prev, medicines: [...prev.medicines, { medicineName: med.name, saltName: '', dose: '', days: '7' }] }));
                                            setMedSearch('');
                                        }}>
                                            <Text style={styles.searchItemTitle}>{med.name}</Text>
                                            <Text style={styles.searchItemSub}>{med.genericName || 'Inventory'}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {sessionData.medicines.map((med, idx) => (
                                <View key={idx} style={styles.medicineRow}>
                                    <View style={styles.medHeaderRow}>
                                        <TextInput style={[styles.input, {flex: 1}]} value={med.medicineName} placeholder="Medicine Name" onChangeText={text => {
                                            const m = [...sessionData.medicines]; m[idx].medicineName = text; setSessionData(prev => ({ ...prev, medicines: m }));
                                        }} />
                                        <TouchableOpacity style={styles.medDelete} onPress={() => setSessionData(prev => ({ ...prev, medicines: prev.medicines.filter((_, i) => i !== idx) }))}><Text style={styles.medDeleteText}>✕</Text></TouchableOpacity>
                                    </View>
                                    <View style={styles.pickerContainer}>
                                        <Picker selectedValue={med.dose} onValueChange={val => {
                                            const m = [...sessionData.medicines]; m[idx].dose = val; setSessionData(prev => ({ ...prev, medicines: m }));
                                        }}>
                                            <Picker.Item label="-- Dose --" value="" />
                                            {doseOptions.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
                                        </Picker>
                                    </View>
                                    <View style={styles.pickerContainer}>
                                        <Picker selectedValue={med.saltName} onValueChange={val => {
                                            const m = [...sessionData.medicines]; m[idx].saltName = val; setSessionData(prev => ({ ...prev, medicines: m }));
                                        }}>
                                            <Picker.Item label="-- Timing --" value="" />
                                            {timingOptions.map(opt => <Picker.Item key={opt} label={opt} value={opt} />)}
                                        </Picker>
                                    </View>
                                    <TextInput style={styles.input} value={med.days} placeholder="Days (e.g. 7)" onChangeText={text => {
                                        const m = [...sessionData.medicines]; m[idx].days = text; setSessionData(prev => ({ ...prev, medicines: m }));
                                    }} />
                                </View>
                            ))}
                            <TouchableOpacity style={styles.addMedBtn} onPress={() => setSessionData(prev => ({ ...prev, medicines: [...prev.medicines, { medicineName: '', saltName: '', dose: '', days: '' }] }))}>
                                <Text style={styles.addMedBtnText}>+ Add Medicine</Text>
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            <Text style={styles.modalSectionTitle}>🧪 Lab Tests Ordered</Text>
                            <TextInput style={styles.input} placeholder="Comma separated tests..." value={sessionData.labTests} onChangeText={text => setSessionData(prev => ({ ...prev, labTests: text }))} />
                            
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalActionBtn} onPress={() => setShowPrescribeModal(false)}>
                                <Text style={styles.modalActionBtnText}>Save & Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* SURGERY PLAN MODAL */}
            <Modal visible={showSurgeryPlanModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🔪 Create Surgery Plan</Text>
                            <TouchableOpacity onPress={() => setShowSurgeryPlanModal(false)} style={styles.modalCloseBtn}><Text style={styles.modalCloseText}>✕</Text></TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.sessionField}>
                                <Text style={styles.fieldLabel}>Surgery / Procedure *</Text>
                                <TextInput style={styles.input} value={surgeryPlanData.surgery} onChangeText={text => setSurgeryPlanData(prev => ({...prev, surgery: text}))} />
                            </View>
                            <View style={styles.sessionField}>
                                <Text style={styles.fieldLabel}>Diagnosis / Reason</Text>
                                <TextInput style={styles.input} value={surgeryPlanData.diagnosis} onChangeText={text => setSurgeryPlanData(prev => ({...prev, diagnosis: text}))} />
                            </View>
                            <View style={styles.sessionField}>
                                <Text style={styles.fieldLabel}>Surgeon *</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker selectedValue={surgeryPlanData.surgeonId} onValueChange={val => setSurgeryPlanData(prev => ({...prev, surgeonId: val}))}>
                                        <Picker.Item label="-- Select Surgeon --" value="" />
                                        {surgeonsList.map(s => <Picker.Item key={s._id} label={`Dr. ${s.name}`} value={s._id || s.userId} />)}
                                    </Picker>
                                </View>
                            </View>
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalActionBtn} onPress={handleCreateSurgeryPlan}>
                                <Text style={styles.modalActionBtnText}>Save Surgery Plan</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* REFERRAL MODAL */}
            <Modal visible={showReferralModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🔄 Refer for Surgery</Text>
                            <TouchableOpacity onPress={() => setShowReferralModal(false)} style={styles.modalCloseBtn}><Text style={styles.modalCloseText}>✕</Text></TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.sessionField}>
                                <Text style={styles.fieldLabel}>Refer To Doctor *</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker selectedValue={referralData.referredToDoctorId} onValueChange={val => setReferralData(prev => ({...prev, referredToDoctorId: val}))}>
                                        <Picker.Item label="-- Select Doctor --" value="" />
                                        {surgeonsList.filter(s => s._id !== user?._id).map(s => <Picker.Item key={s._id} label={`Dr. ${s.name}`} value={s._id || s.userId} />)}
                                    </Picker>
                                </View>
                            </View>
                            <View style={styles.sessionField}>
                                <Text style={styles.fieldLabel}>Reason for Referral *</Text>
                                <TextInput style={styles.input} value={referralData.reason} onChangeText={text => setReferralData(prev => ({...prev, reason: text}))} />
                            </View>
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={[styles.modalActionBtn, {backgroundColor: '#8b5cf6'}]} onPress={handleCreateReferral}>
                                <Text style={styles.modalActionBtnText}>Create Referral</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const { width } = Dimensions.get('window');
const isTablet = width > 768;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4ff' },
    containerScroll: { flex: 1 },
    containerGrid: { flexDirection: isTablet ? 'row' : 'column', flex: 1, minHeight: '100%' },
    containerGridJr: { flexDirection: 'column', flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f4ff' },
    loadingText: { marginTop: 16, color: '#64748b', fontSize: 16 },
    backBtn: { marginTop: 16, padding: 12, backgroundColor: '#3b82f6', borderRadius: 8 },
    backBtnText: { color: 'white', fontWeight: 'bold' },
    
    leftPanel: { flex: isTablet ? 0.45 : 1, borderRightWidth: isTablet ? 1 : 0, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    rightPanel: { flex: isTablet ? 0.55 : 1, backgroundColor: '#ffffff' },
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
    tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, fontSize: 11, overflow: 'hidden' },
    tagMrn: { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
    tagPhone: { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' },
    tagAge: { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' },
    tagGender: { backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#f472b6' },
    tagBlood: { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171' },
    
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

    tabsContainer: { backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#e2e8f0', flexGrow: 0 },
    tabsNav: { padding: 12, flexDirection: 'row', gap: 6 },
    tabBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f1f5f9', borderRadius: 8, marginRight: 8 },
    tabBtnActive: { backgroundColor: '#3b82f6' },
    tabIcon: { marginRight: 6, fontSize: 14 },
    tabLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    tabLabelActive: { color: 'white' },

    tabContent: { padding: 20 },
    tabPanel: { flex: 1 },
    panelTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', borderBottomWidth: 2, borderColor: '#e2e8f0', paddingBottom: 8, marginBottom: 20 },
    overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    ovCard: { width: '48%', backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, marginBottom: 12 },
    ovLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 4 },
    ovValue: { fontSize: 14, color: '#1e293b', fontWeight: '600' },

    emptyHist: { padding: 40, alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', borderRadius: 14 },
    emptyHistText: { color: '#94a3b8' },
    historyList: { gap: 12 },
    historyCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 16, marginBottom: 12 },
    historyCardCurrent: { borderColor: '#3b82f6', borderWidth: 2, backgroundColor: '#eff6ff' },
    historyCardViewing: { borderColor: '#3b82f6', borderWidth: 2 },
    histTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    histDate: { fontWeight: 'bold', color: '#1e40af', fontSize: 14 },
    histDiagnosis: { fontSize: 14, color: '#334155', marginBottom: 6 },
    currentBadge: { backgroundColor: '#3b82f6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginTop: 8 },
    currentBadgeText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
    viewingBadge: { backgroundColor: '#3b82f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 8 },
    viewingBadgeText: { color: 'white', fontSize: 11, fontWeight: 'bold' },

    rightHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fafbff' },
    rightHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    rightSubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
    exitTmBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
    exitTmBtnText: { color: 'white', fontWeight: 'bold' },

    rightContent: { padding: 20 },
    sessionField: { marginBottom: 16 },
    fieldLabel: { fontSize: 13, fontWeight: 'bold', color: '#334155', marginBottom: 8 },
    input: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 14, color: '#1e293b', backgroundColor: 'white' },
    diagInput: { fontWeight: 'bold', fontSize: 16, borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
    textArea: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 16, fontSize: 14, color: '#1e293b', backgroundColor: 'white', minHeight: 140 },
    tmFieldBox: { padding: 12, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 8 },
    tmFieldText: { color: '#334155', fontSize: 14 },

    referralBanner: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    referralLabel: { fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
    radioGroup: { flexDirection: 'row', gap: 16, marginBottom: 16 },
    radioBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
    radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    radioOuterActive: { borderColor: '#3b82f6' },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' },
    radioText: { fontSize: 14, color: '#475569' },
    surgeryActions: { gap: 10 },
    surgeryBtn: { backgroundColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
    surgeryBtnText: { color: 'white', fontWeight: 'bold' },
    referralBtn: { backgroundColor: '#7c3aed', padding: 12, borderRadius: 8, alignItems: 'center' },
    referralBtnText: { color: 'white', fontWeight: 'bold' },

    prescribeBtn: { backgroundColor: '#4f46e5', padding: 14, borderRadius: 10, alignItems: 'center', elevation: 4 },
    prescribeBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },

    rightFooter: { padding: 16, flexDirection: 'row', gap: 12, borderTopWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fafbff' },
    btnSaveDraft: { padding: 14, backgroundColor: 'white', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, flex: 1, alignItems: 'center' },
    btnSaveDraftText: { color: '#475569', fontWeight: 'bold' },
    btnFinish: { padding: 14, backgroundColor: '#10b981', borderRadius: 12, flex: 1, alignItems: 'center', elevation: 2 },
    btnFinishText: { color: 'white', fontWeight: 'bold' },
    copyTmBtn: { padding: 14, borderWidth: 1, borderColor: '#3b82f6', borderRadius: 8, flex: 1, alignItems: 'center' },
    copyTmBtnText: { color: '#3b82f6', fontWeight: 'bold' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalContent: { backgroundColor: 'white', borderRadius: 16, width: '100%', maxWidth: 850, maxHeight: '90%', overflow: 'hidden' },
    modalHeader: { padding: 20, borderBottomWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
    modalCloseBtn: { backgroundColor: '#f1f5f9', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    modalCloseText: { color: '#475569', fontWeight: 'bold' },
    modalBody: { padding: 20 },
    modalSectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 12, marginTop: 10 },
    searchList: { maxHeight: 150, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginBottom: 16 },
    searchItem: { padding: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' },
    searchItemTitle: { fontWeight: 'bold', color: '#1e293b' },
    searchItemSub: { fontSize: 11, color: '#94a3b8' },
    
    medicineRow: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    medHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    medDelete: { marginLeft: 10, backgroundColor: '#fee2e2', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    medDeleteText: { color: '#dc2626', fontWeight: 'bold' },
    pickerContainer: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginBottom: 8, backgroundColor: 'white', overflow: 'hidden' },
    addMedBtn: { padding: 10, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', borderStyle: 'dashed', borderRadius: 8, alignItems: 'center', marginBottom: 20 },
    addMedBtnText: { color: '#16a34a', fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 10, borderStyle: 'dashed' },

    modalFooter: { padding: 16, borderTopWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'flex-end' },
    modalActionBtn: { backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, alignItems: 'center' },
    modalActionBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default DoctorPatientDetails;
