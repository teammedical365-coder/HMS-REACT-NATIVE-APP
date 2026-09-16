import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, StyleSheet, 
    TextInput, ActivityIndicator, Alert, Dimensions, Modal, Image 
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Feather, FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle, Line, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import socket from '../../utils/socket';
import { receptionAPI, hospitalAPI, publicAPI, bedAPI, admissionAPI, uploadAPI } from '../../utils/api';
import { getSubdomain } from '../../utils/subdomain';
import SlotPicker from '../../components/SlotPicker';

const { width } = Dimensions.get('window');

const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30'
];

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const getInitialBgColor = (name = '') => {
    const colors = ['#8b5cf6', '#0d9488', '#f59e0b', '#2563eb', '#ec4899', '#10b981', '#6366f1'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[hash % colors.length];
};

const ReceptionDashboard = ({ isPatientPortal = false }) => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user: currentUser } = useSelector(state => state.auth);

    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('welcome'); // 'welcome', 'desk', 'intake'
    const [listTab, setListTab] = useState('queue'); // 'queue', 'hospitalized'
    
    // Data states
    const [appointments, setAppointments] = useState([]);
    const [hospitalizedPatients, setHospitalizedPatients] = useState([]);
    const [availableBeds, setAvailableBeds] = useState([]);
    const [doctorsList, setDoctorsList] = useState([]);
    const [hospitalContext, setHospitalContext] = useState(null);
    const [selectedPatientId, setSelectedPatientId] = useState(null);
    const [stats, setStats] = useState(null);
    const [saving, setSaving] = useState(false);
    const [pendingDownload, setPendingDownload] = useState(null);
    const [nextToken, setNextToken] = useState(null);
    const [upiOptions, setUpiOptions] = useState([]);
    const [selectedUpiId, setSelectedUpiId] = useState('');
    const [intakePaymentData, setIntakePaymentData] = useState({ upiId: '', transactionId: '', cardDetails: '', bankReference: '' });

    // Transactions Ledger state (1:1 Web Parity)
    const [transactions, setTransactions] = useState([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [transactionSearch, setTransactionSearch] = useState('');
    const [transactionStatusFilter, setTransactionStatusFilter] = useState('all'); // 'all', 'paid', 'pending'
    const [selectedTxModal, setSelectedTxModal] = useState(null);

    // Live search states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const searchDebounceRef = useRef(null);

    // Bed & Ward live view states
    const [bedSearch, setBedSearch] = useState('');
    const [wardFilter, setWardFilter] = useState('all');
    const [bedStatusFilter, setBedStatusFilter] = useState('all');

    // Queue filter
    const [queueSearch, setQueueSearch] = useState('');

    // Availability Check State
    const [availabilityCheck, setAvailabilityCheck] = useState({
        doctorId: '', date: new Date().toISOString().split('T')[0], bookedSlots: []
    });

    // ─── INTAKE / REGISTRATION STEPPER STATE (SLICE 3) ──────────────────────
    const [currentStep, setCurrentStep] = useState(1); // Steps 1 to 5
    const [verifyingAadhaar, setVerifyingAadhaar] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [aadhaarOtp, setAadhaarOtp] = useState('');
    const [patientPhoto, setPatientPhoto] = useState(null);
    const [paymentScreenshot, setPaymentScreenshot] = useState(null);
    const [followupStatus, setFollowupStatus] = useState(null);
    const [intakePolicyAgreed, setIntakePolicyAgreed] = useState(true);

    // Intake Form State
    const [intakeForm, setIntakeForm] = useState({
        // Step 1: Identity & Demographics
        title: 'Mrs.', firstName: '', middleName: '', lastName: '',
        dob: '', age: '', gender: 'Female', mobile: '', email: '',
        houseNo: '', street: '', city: '', state: '', zipCode: '', address: '',
        aadhaar: '', isAadhaarVerified: false, avatar: '',

        // Step 2: Relative / Partner
        partnerTitle: 'Mr.', partnerFirstName: '', partnerLastName: '', partnerMobile: '',
        relationToPatient: 'Spouse',

        // Step 3: Vitals & Clinical Intake
        height: '', weight: '', bmi: '', bloodGroup: 'B+',
        consultationFee: '500', referralType: 'Walk In', reasonForVisit: '', bio: '',

        // Step 4: Doctor & Slot
        department: '', doctor: '', visitDate: new Date().toISOString().split('T')[0], visitTime: '',

        // Step 5: Payment
        paymentMethod: 'Cash', paymentStatus: 'Paid',
        splitPayments: [{ method: 'Cash', amount: '500' }]
    });

    // Modals
    const [hospitalizeModal, setHospitalizeModal] = useState({ open: false, appointment: null });
    const [hospitalizeForm, setHospitalizeForm] = useState({
        ward: 'General', bedId: '', admissionDate: new Date().toISOString().split('T')[0],
        provisionalDiagnosis: '', advancePayment: '0', notes: ''
    });

    const [vitalsModal, setVitalsModal] = useState({ open: false, appointment: null });
    const [vitalsForm, setVitalsForm] = useState({ bp: '', pulse: '', temp: '', spo2: '', weight: '', notes: '' });

    const [detailsModal, setDetailsModal] = useState({ open: false, item: null, type: 'appointment' });

    const [transferModal, setTransferModal] = useState({
        open: false, admission: null, newWard: 'General', newBedId: '',
        transferDate: new Date().toISOString().split('T')[0],
        transferTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        notes: ''
    });

    const [dischargeModal, setDischargeModal] = useState({
        open: false, admission: null,
        dischargeDate: new Date().toISOString().split('T')[0],
        dischargeTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        notes: ''
    });

    const [paymentModal, setPaymentModal] = useState({
        open: false, appointment: null, method: 'Cash', amount: '', splitPayments: [{ method: 'Cash', amount: '' }]
    });

    // Profile detail modal
    const [profileModal, setProfileModal] = useState({ open: false, patient: null });

    const timeOfDay = new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening';
    const todayStr = new Date().toISOString().split('T')[0];

    // Handle view param from navigation
    useEffect(() => {
        if (route.params?.view) {
            const v = route.params.view;
            if (v === 'desk' || v === 'list') setViewMode('desk');
            else if (v === 'transactions') {
                fetchTransactions();
                setViewMode('transactions');
            } else setViewMode(v);
        }
    }, [route.params?.view]);

    // Initial Data Fetch
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let hosp = null;
            try {
                const myHospRes = await hospitalAPI.getMyHospital();
                if (myHospRes?.success && myHospRes.hospital) {
                    hosp = myHospRes.hospital;
                }
            } catch (e) {}

            if (!hosp) {
                const sub = getSubdomain();
                if (sub && sub !== 'null') {
                    const res = await hospitalAPI.resolveHospital(sub);
                    if (res?.success && res.hospital) hosp = res.hospital;
                }
            }

            if (hosp) {
                setHospitalContext(hosp);
                fetchDoctors(hosp._id);
                try {
                    const deptUpiRes = await hospitalAPI.getDepartmentUpiByRole('Reception');
                    if (deptUpiRes?.success && deptUpiRes.departmentUpi) {
                        setUpiOptions([{ label: deptUpiRes.departmentUpi.label, upiId: deptUpiRes.departmentUpi.upiId }]);
                    } else {
                        const upiRes = await hospitalAPI.getUpiIds();
                        if (upiRes?.success && upiRes.upiIds) setUpiOptions(upiRes.upiIds);
                    }
                } catch (e) {}
            }
        } catch (err) {
            console.warn('Failed to resolve hospital:', err);
        }

        try {
            const apptsRes = await receptionAPI.getAllAppointments();
            if (apptsRes?.success) {
                setAppointments(apptsRes.appointments || []);
            }
        } catch (err) {
            console.warn('Failed to fetch appointments:', err);
        }

        try {
            const admRes = await admissionAPI.getActiveAdmissions();
            if (admRes?.success) {
                setHospitalizedPatients(admRes.admissions || []);
            }
        } catch (err) {
            console.warn('Failed to fetch admissions:', err);
        }

        try {
            const bedsRes = await bedAPI.getBeds({ status: 'AVAILABLE' });
            if (bedsRes?.success) {
                setAvailableBeds(bedsRes.beds || []);
            }
        } catch (err) {
            console.warn('Failed to fetch beds:', err);
        }

        try {
            const upiRes = await hospitalAPI.getUpiIds();
            if (upiRes?.success) {
                try {
                    const deptUpiRes = await hospitalAPI.getDepartmentUpiByRole('Reception');
                    if (deptUpiRes?.success && deptUpiRes.departmentUpi) {
                        const du = deptUpiRes.departmentUpi;
                        setUpiOptions([{ label: du.label, upiId: du.upiId }]);
                        setSelectedUpiId(du.upiId);
                    } else {
                        setUpiOptions(upiRes.upiIds || []);
                        if (upiRes.upiIds?.length) setSelectedUpiId(upiRes.upiIds[0].upiId);
                    }
                } catch {
                    setUpiOptions(upiRes.upiIds || []);
                    if (upiRes.upiIds?.length) setSelectedUpiId(upiRes.upiIds[0].upiId);
                }
            }
        } catch (err) {
            console.warn('Failed to fetch UPI config:', err);
        }

        try {
            const statsRes = await receptionAPI.getStats();
            if (statsRes?.success) {
                setStats(statsRes.stats || statsRes);
            }
        } catch (err) {
            console.warn('Failed to fetch stats:', err);
        }

        try {
            const txRes = await receptionAPI.getTransactions();
            if (txRes?.success && Array.isArray(txRes.transactions)) {
                setTransactions(txRes.transactions);
            }
        } catch (err) {
            console.warn('Failed to fetch transactions:', err);
        }
        setLoading(false);
    }, []);

    const fetchTransactions = async () => {
        setLoadingTransactions(true);
        try {
            const res = await receptionAPI.getTransactions();
            if (res?.success && Array.isArray(res.transactions)) {
                setTransactions(res.transactions);
            }
        } catch (err) {
            console.error('Error fetching transactions:', err);
        } finally {
            setLoadingTransactions(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Real-time socket sync for admissions, beds, queue, and orders
    useEffect(() => {
        if (!socket) return;
        if (!socket.connected) socket.connect();
        if (hospitalContext?._id) {
            socket.emit('joinHospitalRoom', hospitalContext._id);
        }
        const handleRealtimeRefresh = () => {
            fetchData();
        };

        socket.on('admission_created', handleRealtimeRefresh);
        socket.on('bed_status_changed', handleRealtimeRefresh);
        socket.on('bed_transferred', handleRealtimeRefresh);
        socket.on('patient_discharged', handleRealtimeRefresh);
        socket.on('inpatient_order_created', handleRealtimeRefresh);
        socket.on('inpatient_order_updated', handleRealtimeRefresh);
        socket.on('appointment_booked', handleRealtimeRefresh);
        socket.on('appointment_cancelled', handleRealtimeRefresh);

        return () => {
            socket.off('admission_created', handleRealtimeRefresh);
            socket.off('bed_status_changed', handleRealtimeRefresh);
            socket.off('bed_transferred', handleRealtimeRefresh);
            socket.off('patient_discharged', handleRealtimeRefresh);
            socket.off('inpatient_order_created', handleRealtimeRefresh);
            socket.off('inpatient_order_updated', handleRealtimeRefresh);
            socket.off('appointment_booked', handleRealtimeRefresh);
            socket.off('appointment_cancelled', handleRealtimeRefresh);
        };
    }, [hospitalContext?._id, fetchData]);

    const fetchDoctors = async (hospitalId) => {
        try {
            const hid = hospitalId || hospitalContext?._id || '';
            const res = await publicAPI.getDoctors(null, hid);
            if (res?.success && Array.isArray(res.doctors)) setDoctorsList(res.doctors);
        } catch (err) {
            console.error('Failed to fetch doctors:', err);
        }
    };

    const validateDoctorAvailability = (doctorId, dateStr) => {
        if (!doctorId || !dateStr) return true;
        const selectedDoc = doctorsList.find(d => (d._id === doctorId || d.id === doctorId));
        if (selectedDoc && selectedDoc.availability) {
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const [year, month, day] = dateStr.split('-');
            const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
            const dayName = daysOfWeek[dateObj.getDay()];
            const isAvailable = selectedDoc.availability[dayName] && selectedDoc.availability[dayName].available === true;
            if (!isAvailable) {
                const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
                Alert.alert(
                    'Doctor Unavailable',
                    `Doctor ${selectedDoc.name} is not scheduled on ${capitalizedDay}s. Please select another date before assigning this doctor.`
                );
                return false;
            }
        }
        return true;
    };

    // Web 1:1 Followup Status Sync
    useEffect(() => {
        if (!intakeForm.department) {
            setFollowupStatus(null);
            return;
        }
        if (!selectedPatientId && !isPatientPortal) {
            return;
        }
        const fetchStatus = async () => {
            try {
                const pId = selectedPatientId || '';
                const res = isPatientPortal
                    ? await patientAuthAPI.getFollowupStatus(intakeForm.department, intakeForm.visitDate)
                    : await receptionAPI.getFollowupStatus(pId, intakeForm.department, intakeForm.visitDate);
                if (res?.success) {
                    setFollowupStatus(res);
                    if (res.active) {
                        setIntakeForm(prev => ({ 
                            ...prev, 
                            consultationFee: '0',
                            splitPayments: [{ method: prev.splitPayments?.[0]?.method || 'Cash', amount: '0' }]
                        }));
                    } else if (res.fee !== undefined) {
                        setIntakeForm(prev => ({ 
                            ...prev, 
                            consultationFee: String(res.fee),
                            splitPayments: [{ method: prev.splitPayments?.[0]?.method || 'Cash', amount: String(res.fee) }]
                        }));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch followup status", err);
            }
        };
        fetchStatus();
    }, [selectedPatientId, intakeForm.department, intakeForm.visitDate, isPatientPortal]);

    const fetchBookedSlots = async (doctorId, date) => {
        try {
            const res = await receptionAPI.getBookedSlots(doctorId, date, hospitalContext?._id);
            if (res.success) {
                setAvailabilityCheck(prev => ({ ...prev, bookedSlots: res.bookedSlots || [] }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (availabilityCheck.doctorId && availabilityCheck.date) {
            fetchBookedSlots(availabilityCheck.doctorId, availabilityCheck.date);
        }
    }, [availabilityCheck.doctorId, availabilityCheck.date]);

    // Token Mode check
    useEffect(() => {
        const isTokenMode = hospitalContext?.appointmentMode === 'token';
        if (isTokenMode && intakeForm.doctor && intakeForm.visitDate && hospitalContext?._id) {
            hospitalAPI.getNextToken(hospitalContext._id, intakeForm.doctor, intakeForm.visitDate)
                .then(res => { if (res.success) setNextToken(res.nextToken); })
                .catch(() => setNextToken(null));
        } else {
            setNextToken(null);
        }
    }, [hospitalContext, intakeForm.doctor, intakeForm.visitDate]);

    // Live search handler with debounce
    const handleSearchTextChange = (text) => {
        setSearchQuery(text);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

        if (!text.trim()) {
            setSearchResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        searchDebounceRef.current = setTimeout(async () => {
            try {
                const res = await receptionAPI.searchPatients(text.trim());
                if (res?.success) setSearchResults(res.patients || []);
            } catch (e) {
                console.warn('Patient search error:', e);
            } finally {
                setSearching(false);
            }
        }, 300);
    };

    // Quick fill from search result
    const handleSelectPatient = async (patient) => {
        setSearchResults([]);
        setSearchQuery('');
        const pId = patient._id || patient.patientId;
        setSelectedPatientId(pId);
        const nameParts = (patient.name || '').split(' ');
        setIntakeForm(prev => ({
            ...prev,
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            mobile: patient.phone || '',
            email: patient.email || '',
            gender: patient.gender || prev.gender,
            age: String(patient.age || prev.age),
            address: patient.address || '',
            city: patient.city || '',
            state: patient.state || '',
            zipCode: patient.zipCode || ''
        }));

        // Follow-up status check
        try {
            const pId = patient._id || patient.patientId;
            const res = await receptionAPI.getFollowupStatus(pId, 'auto', todayStr);
            if (res?.success) {
                setFollowupStatus(res);
                if (res.active) {
                    setIntakeForm(p => ({
                        ...p,
                        consultationFee: '0',
                        splitPayments: [{ method: 'Cash', amount: '0' }]
                    }));
                }
            }
        } catch (e) {
            console.warn('Follow-up check error:', e);
        }

        setCurrentStep(4);
        setViewMode('intake');
    };

    // Form field updater with Web 1:1 downstream dependencies
    const handleFormChange = (field, value) => {
        if (field === 'department') {
            if (followupStatus?.active) return;
            const defaultFee = hospitalContext?.departmentFees?.[value] ?? hospitalContext?.appointmentFee ?? 500;
            setIntakeForm(prev => ({
                ...prev,
                department: value,
                consultationFee: String(defaultFee),
                doctor: '',
                visitTime: '',
                splitPayments: [{ method: prev.splitPayments[0]?.method || 'Cash', amount: String(defaultFee) }]
            }));
            setAvailabilityCheck(prev => ({ ...prev, doctorId: '', bookedSlots: [] }));
            return;
        }

        if (field === 'doctor') {
            if (followupStatus?.active) return;
            if (intakeForm.visitDate) {
                const ok = validateDoctorAvailability(value, intakeForm.visitDate);
                if (!ok) return;
            }
            setIntakeForm(prev => ({ ...prev, doctor: value, visitTime: '' }));
            setAvailabilityCheck(prev => ({ ...prev, doctorId: value }));
            return;
        }

        if (field === 'visitDate') {
            if (value < todayStr) {
                Alert.alert('Invalid Date', 'Appointment date cannot be in the past.');
                return;
            }
            if (intakeForm.doctor) {
                const ok = validateDoctorAvailability(intakeForm.doctor, value);
                if (!ok) return;
            }
            setIntakeForm(prev => ({ ...prev, visitDate: value, visitTime: '' }));
            setAvailabilityCheck(prev => ({ ...prev, date: value }));
            return;
        }

        setIntakeForm(prev => {
            const updated = { ...prev, [field]: value };

            // Automated BMI calculation
            if (field === 'height' || field === 'weight') {
                const h = field === 'height' ? Number(value) : Number(prev.height);
                const w = field === 'weight' ? Number(value) : Number(prev.weight);
                if (h > 0 && w > 0) {
                    const hMeter = h / 100;
                    updated.bmi = (w / (hMeter * hMeter)).toFixed(2);
                }
            }

            // Sync consultation fee with split payments
            if (field === 'consultationFee') {
                updated.splitPayments = [{ method: prev.splitPayments[0]?.method || 'Cash', amount: value }];
            }

            return updated;
        });
    };

    // ─── AADHAAR OTP FLOW ───────────────────────────────────────────────────
    const handleSendAadhaarOTP = async () => {
        if (!intakeForm.aadhaar || intakeForm.aadhaar.length !== 12) {
            Alert.alert("Invalid Aadhaar", "Please enter a valid 12-digit Aadhaar number.");
            return;
        }
        setVerifyingAadhaar(true);
        try {
            const res = await receptionAPI.sendAadhaarOTP(intakeForm.aadhaar);
            if (res.success) {
                setOtpSent(true);
                Alert.alert("OTP Sent", res.message || "Aadhaar verification OTP sent to linked mobile number.");
            } else {
                Alert.alert("Error", res.message || "Failed to send OTP.");
            }
        } catch (err) {
            Alert.alert("Error", err.response?.data?.message || "Failed to send Aadhaar OTP.");
        } finally {
            setVerifyingAadhaar(false);
        }
    };

    const handleVerifyAadhaarOTP = async () => {
        if (!aadhaarOtp || aadhaarOtp.length < 4) {
            Alert.alert("Invalid OTP", "Please enter the OTP received.");
            return;
        }
        setVerifyingAadhaar(true);
        try {
            const res = await receptionAPI.verifyAadhaarOTP(intakeForm.aadhaar, aadhaarOtp);
            if (res.success && res.data) {
                const kyc = res.data;
                Alert.alert("Verified", `Aadhaar verified successfully for ${kyc.fullName || 'Patient'}`);
                setIntakeForm(prev => ({
                    ...prev,
                    isAadhaarVerified: true,
                    firstName: (kyc.fullName || '').split(' ')[0] || prev.firstName,
                    lastName: (kyc.fullName || '').split(' ').slice(1).join(' ') || prev.lastName,
                    dob: kyc.dob || prev.dob,
                    gender: kyc.gender || prev.gender,
                    address: kyc.address || prev.address
                }));
                setOtpSent(false);
                setAadhaarOtp('');
            } else {
                Alert.alert("Verification Failed", res.message || "Invalid Aadhaar OTP.");
            }
        } catch (err) {
            Alert.alert("Error", err.response?.data?.message || "OTP verification failed.");
        } finally {
            setVerifyingAadhaar(false);
        }
    };

    // Photo picker
    const handlePickPhoto = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
            if (!res.canceled && res.assets && res.assets.length > 0) {
                setPatientPhoto(res.assets[0]);
                setIntakeForm(p => ({ ...p, avatar: res.assets[0].uri }));
            }
        } catch (e) {
            console.warn('Photo pick error:', e);
        }
    };

    const handlePickPaymentProof = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
            if (!res.canceled && res.assets && res.assets.length > 0) {
                setPaymentScreenshot(res.assets[0]);
            }
        } catch (e) {
            console.warn('Proof pick error:', e);
        }
    };

    // Split payment handlers
    const addSplitRow = () => {
        setIntakeForm(p => ({
            ...p,
            splitPayments: [...p.splitPayments, { method: 'UPI', amount: '' }]
        }));
    };

    const updateSplitRow = (idx, field, val) => {
        const updated = [...intakeForm.splitPayments];
        updated[idx][field] = val;
        setIntakeForm(p => ({ ...p, splitPayments: updated }));
    };

    const removeSplitRow = (idx) => {
        const updated = intakeForm.splitPayments.filter((_, i) => i !== idx);
        setIntakeForm(p => ({ ...p, splitPayments: updated }));
    };

    // ─── STEPPER NAVIGATION VALIDATIONS ─────────────────────────────────────
    const goToNextStep = () => {
        if (currentStep === 1) {
            if (!intakeForm.firstName?.trim()) {
                Alert.alert("Validation Error", "Patient First Name is required.");
                return;
            }
            if (!intakeForm.mobile?.trim() || intakeForm.mobile.length !== 10) {
                Alert.alert("Validation Error", "A valid 10-digit Mobile number is required.");
                return;
            }
            setCurrentStep(2);
        } else if (currentStep === 2) {
            setCurrentStep(3);
        } else if (currentStep === 3) {
            setCurrentStep(4);
        } else if (currentStep === 4) {
            if (!intakeForm.department) {
                Alert.alert("Validation Error", "Please select a Department.");
                return;
            }
            if (!intakeForm.doctor) {
                Alert.alert("Validation Error", "Please select a Doctor.");
                return;
            }
            const isTokenMode = hospitalContext?.appointmentMode === 'token';
            if (!isTokenMode && !intakeForm.visitTime) {
                Alert.alert("Validation Error", "Please select a Consultation Time Slot.");
                return;
            }
            setCurrentStep(5);
        }
    };

    // ─── FINAL SUBMISSION: REGISTER + BOOK APPOINTMENT ───────────────────────
    const handleRegisterAndBook = async () => {
        if (!intakePolicyAgreed) {
            Alert.alert("Policy Agreement", "Please agree to the hospital policies and terms of service before registering.");
            return;
        }

        const fee = Number(intakeForm.consultationFee) || 0;
        const totalSplit = intakeForm.splitPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

        if (fee > 0 && totalSplit !== fee) {
            Alert.alert("Payment Mismatch", `Total payment entered (₹${totalSplit}) must match consultation fee (₹${fee}).`);
            return;
        }

        setSaving(true);
        try {
            // 1. Register Patient (Web 1:1 Payload Parity)
            const regPayload = {
                name: `${intakeForm.firstName || ''} ${intakeForm.lastName || ''}`.trim(),
                phone: intakeForm.mobile,
                email: intakeForm.email,
                age: intakeForm.age,
                gender: intakeForm.gender,
                aadhaarNumber: intakeForm.aadhaar,
                address: `${intakeForm.houseNo || ''} ${intakeForm.street || ''} ${intakeForm.city || ''} ${intakeForm.state || ''} ${intakeForm.zipCode || ''}`.trim(),
                partnerFirstName: intakeForm.partnerFirstName,
                partnerLastName: intakeForm.partnerLastName,
                partnerMobile: intakeForm.partnerMobile,
                relationToPatient: intakeForm.relationToPatient,
                referralType: intakeForm.referralType || 'Walk In',
                bloodGroup: intakeForm.bloodGroup,
                height: intakeForm.height,
                weight: intakeForm.weight,
                bmi: intakeForm.bmi,
                bio: intakeForm.reasonForVisit || ''
            };

            const regRes = await receptionAPI.registerPatient(regPayload);
            const patientId = regRes.user?._id || regRes.patient?._id;

            if (!patientId) {
                throw new Error("Patient registration did not return a valid patient ID.");
            }

            // 2. Book Appointment
            const isTokenMode = hospitalContext?.appointmentMode === 'token';
            const bookPayload = {
                patientId,
                doctorId: intakeForm.doctor,
                appointmentDate: intakeForm.visitDate,
                date: intakeForm.visitDate,
                appointmentTime: isTokenMode ? undefined : intakeForm.visitTime,
                time: isTokenMode ? undefined : intakeForm.visitTime,
                department: intakeForm.department,
                reason: intakeForm.reasonForVisit || 'OPD Consultation',
                amount: fee,
                paymentStatus: 'Paid',
                paymentMethod: intakeForm.splitPayments[0]?.method || 'Cash',
                splitPayments: intakeForm.splitPayments
            };

            const bookingRes = await receptionAPI.bookAppointment(bookPayload);

            // 3. Document Download Notice
            const pName = `${intakeForm.firstName} ${intakeForm.lastName}`.trim();
            const docName = doctorsList.find(d => d._id === intakeForm.doctor)?.name || 'Consultant';
            const allocatedToken = bookingRes?.appointment?.tokenNumber || nextToken;
            const hName = hospitalContext?.name || 'Care Medical Hospital & Health Center';
            const hAddr = [hospitalContext?.address, hospitalContext?.city, hospitalContext?.state].filter(Boolean).join(', ');
            const hPhone = hospitalContext?.phone || '';
            const hEmail = hospitalContext?.email || '';
            const issuedBy = currentUser?.name || 'Reception Desk';
            const paymentMethodsStr = intakeForm.splitPayments.map(p => `${p.method} (₹${p.amount})`).join(' + ');

            Alert.alert(
                "Registration Completed!",
                `Patient ${pName} has been successfully registered and queued for Dr. ${docName}.${allocatedToken ? ` Allocated Token: #${allocatedToken}` : ''}`,
                [
                    { text: "View Desk Queue", onPress: () => { setViewMode('desk'); fetchData(); } },
                    { 
                        text: "🖨️ Print Registration Slip", 
                        onPress: async () => {
                            try {
                                const html = `
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                        <meta charset="utf-8">
                                        <title>Registration Slip - ${pName}</title>
                                        <style>
                                            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; background: #ffffff; }
                                            .header { text-align: center; border-bottom: 2px solid #2980b9; padding-bottom: 14px; margin-bottom: 18px; }
                                            .h-name { font-size: 22px; font-weight: 800; color: #0f172a; }
                                            .h-addr { font-size: 11px; color: #64748b; margin-top: 3px; }
                                            .h-contact { font-size: 10px; color: #64748b; margin-top: 2px; }
                                            .slip-title { font-size: 14px; font-weight: 800; color: #2980b9; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
                                            ${allocatedToken ? `
                                            .token-box { margin: 14px auto; padding: 8px 18px; background: #fef3c7; border: 2px dashed #f59e0b; border-radius: 8px; width: 150px; text-align: center; }
                                            .token-label { font-size: 10px; font-weight: 800; color: #b45309; text-transform: uppercase; }
                                            .token-num { font-size: 28px; font-weight: 900; color: #d97706; margin: 2px 0; }
                                            ` : ''}
                                            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
                                            td { padding: 9px 12px; border: 1px solid #e2e8f0; }
                                            td.label { font-weight: bold; color: #334155; width: 35%; background: #f8fafc; }
                                            td.value { color: #0f172a; }
                                            .footer { margin-top: 26px; border-top: 1px solid #cbd5e1; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
                                            .thanks { text-align: center; margin-top: 14px; font-size: 11px; color: #64748b; font-style: italic; }
                                        </style>
                                    </head>
                                    <body>
                                        <div class="header">
                                            <div class="h-name">${hName}</div>
                                            ${hAddr ? `<div class="h-addr">${hAddr}</div>` : ''}
                                            ${hPhone || hEmail ? `<div class="h-contact">${[hPhone && `Ph: ${hPhone}`, hEmail && `Email: ${hEmail}`].filter(Boolean).join('  |  ')}</div>` : ''}
                                            <div class="slip-title">Registration Slip / Consultation Receipt</div>
                                        </div>

                                        ${allocatedToken ? `
                                        <div class="token-box">
                                            <div class="token-label">Queue Token</div>
                                            <div class="token-num">#${allocatedToken}</div>
                                        </div>
                                        ` : ''}

                                        <table>
                                            <tr><td class="label">Patient Name</td><td class="value"><strong>${pName}</strong> (${intakeForm.gender}, ${intakeForm.age} yrs)</td></tr>
                                            <tr><td class="label">MRN / Patient ID</td><td class="value">${bookingRes?.appointment?.patientId || patientId || 'N/A'}</td></tr>
                                            <tr><td class="label">Phone Contact</td><td class="value">${intakeForm.mobile || '-'}</td></tr>
                                            <tr><td class="label">Aadhaar Verification</td><td class="value">${intakeForm.isAadhaarVerified ? 'YES — Verified' : 'NO'}</td></tr>
                                            <tr><td class="label">Department</td><td class="value">${intakeForm.department || 'General'}</td></tr>
                                            <tr><td class="label">Consulting Doctor</td><td class="value">Dr. ${docName}</td></tr>
                                            <tr><td class="label">Appointment / Slot</td><td class="value">${intakeForm.visitDate}${isTokenMode ? ` (Token #${allocatedToken || '?'})` : ` @ ${intakeForm.visitTime}`}</td></tr>
                                            <tr><td class="label">Consultation Fee</td><td class="value"><strong>₹${Number(fee).toLocaleString('en-IN')}</strong></td></tr>
                                            <tr><td class="label">Payment Method</td><td class="value">${paymentMethodsStr || 'Cash'}</td></tr>
                                            <tr><td class="label">Payment Status</td><td class="value" style="color: #16a34a; font-weight: bold;">PAID ✓</td></tr>
                                        </table>

                                        <div class="footer">
                                            <span>Issued by: ${issuedBy}</span>
                                            <span>Generated: ${new Date().toLocaleString('en-IN')}</span>
                                        </div>
                                        <div class="thanks">Thank you for choosing ${hName}</div>
                                    </body>
                                    </html>
                                `;
                                await Print.printAsync({ html });
                            } catch (e) { console.warn('Registration slip print error', e); }
                            setViewMode('desk');
                            fetchData();
                        } 
                    }
                ]
            );

            // Reset form
            setCurrentStep(1);
            setIntakeForm({
                title: 'Mrs.', firstName: '', middleName: '', lastName: '',
                dob: '', age: '', gender: 'Female', mobile: '', email: '',
                houseNo: '', street: '', city: '', state: '', zipCode: '', address: '',
                aadhaar: '', isAadhaarVerified: false, avatar: '',
                partnerTitle: 'Mr.', partnerFirstName: '', partnerLastName: '', partnerMobile: '',
                relationToPatient: 'Spouse',
                height: '', weight: '', bmi: '', bloodGroup: 'B+',
                consultationFee: '500', referralType: 'Walk In', reasonForVisit: '',
                department: '', doctor: '', visitDate: new Date().toISOString().split('T')[0], visitTime: '',
                paymentMethod: 'Cash', paymentStatus: 'Paid',
                splitPayments: [{ method: 'Cash', amount: '500' }]
            });
        } catch (err) {
            console.error('Registration/Booking error:', err);
            Alert.alert("Registration Failed", err.response?.data?.message || err.message || "Failed to register patient.");
        } finally {
            setSaving(false);
        }
    };

    // ─── ACTION HANDLERS FOR QUEUE ──────────────────────────────────────────
    const handleCancelAppointment = (aptId) => {
        Alert.alert(
            "Cancel Appointment",
            "Are you sure you want to cancel this appointment?",
            [
                { text: "No", style: "cancel" },
                { 
                    text: "Yes, Cancel", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const res = await receptionAPI.cancelAppointment(aptId);
                            if (res.success) {
                                Alert.alert("Cancelled", "Appointment has been cancelled.");
                                fetchData();
                            }
                        } catch (err) {
                            Alert.alert("Error", err.response?.data?.message || "Failed to cancel appointment.");
                        }
                    }
                }
            ]
        );
    };

    const openHospitalize = (apt) => {
        const patientId = apt.userId?._id || apt.patientId?._id || apt.patientId;
        const activeAdm = hospitalizedPatients.find(adm => {
            const admPid = adm.patientId?._id || adm.patientId;
            return (admPid === patientId || adm.appointmentId?._id === apt._id) && adm.status === 'Admitted';
        });

        if (activeAdm) {
            Alert.alert("Already Admitted", "This patient currently has an active admission in " + (activeAdm.ward || 'Ward'));
            return;
        }

        setHospitalizeForm({
            ward: 'General',
            bedId: availableBeds[0]?._id || '',
            admissionDate: new Date().toISOString().split('T')[0],
            admissionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            notes: ''
        });
        setHospitalizeModal({ open: true, appointment: apt });
    };

    const submitHospitalize = async () => {
        if (!hospitalizeForm.bedId) {
            Alert.alert("Error", "Please select an available bed.");
            return;
        }
        try {
            setSaving(true);
            const apt = hospitalizeModal.appointment;
            const patientId = apt.userId?._id || apt.patientId?._id || apt.patientId;

            await admissionAPI.createAdmission({
                patientId,
                appointmentId: apt._id,
                ward: hospitalizeForm.ward,
                bedId: hospitalizeForm.bedId,
                admissionDate: hospitalizeForm.admissionDate,
                admissionTime: hospitalizeForm.admissionTime,
                notes: hospitalizeForm.notes
            });

            Alert.alert("Success", "Patient successfully hospitalized & admitted!");
            setHospitalizeModal({ open: false, appointment: null });
            fetchData();
        } catch (err) {
            Alert.alert("Error", err.response?.data?.message || "Failed to hospitalize patient.");
        } finally {
            setSaving(false);
        }
    };

    const openTransfer = (adm) => {
        setTransferModal({
            open: true,
            admission: adm,
            newWard: adm.ward || 'General',
            newBedId: availableBeds[0]?._id || '',
            transferDate: new Date().toISOString().split('T')[0],
            transferTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            notes: ''
        });
    };

    const submitTransfer = async () => {
        if (!transferModal.newBedId) {
            Alert.alert("Error", "Please select a target bed for transfer.");
            return;
        }
        try {
            setSaving(true);
            await admissionAPI.transferBed(transferModal.admission._id, {
                newWard: transferModal.newWard,
                newBedId: transferModal.newBedId,
                transferDate: transferModal.transferDate,
                transferTime: transferModal.transferTime,
                notes: transferModal.notes
            });
            Alert.alert("Success", "Bed transfer completed successfully!");
            setTransferModal({ open: false, admission: null, newWard: 'General', newBedId: '', transferDate: '', transferTime: '', notes: '' });
            fetchData();
        } catch (err) {
            Alert.alert("Error", err.response?.data?.message || "Failed to transfer bed.");
        } finally {
            setSaving(false);
        }
    };

    const openDischarge = (adm) => {
        setDischargeModal({
            open: true,
            admission: adm,
            dischargeDate: new Date().toISOString().split('T')[0],
            dischargeTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            notes: ''
        });
    };

    const printDischargeBill = async (adm) => {
        try {
            const pName = adm?.patientId?.name || 'Patient';
            const html = `
                <html>
                    <body style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b;">
                        <h2 style="text-align: center; color: #0f172a; margin-bottom: 4px;">INPATIENT DISCHARGE BILL & RECEIPT</h2>
                        <p style="text-align: center; color: #64748b; font-size: 12px; margin-top: 0;">Date: ${new Date().toLocaleDateString('en-IN')}</p>
                        <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 16px 0;" />
                        <table style="width: 100%; font-size: 14px; margin-bottom: 20px;">
                            <tr>
                                <td><strong>Patient Name:</strong> ${pName}</td>
                                <td><strong>MRN:</strong> ${adm?.patientId?.mrn || adm?.patientId?.patientId || '-'}</td>
                            </tr>
                            <tr>
                                <td><strong>Ward / Bed:</strong> ${adm?.ward || 'General'} - Bed ${adm?.bedId?.bedNumber || '-'}</td>
                                <td><strong>Admission Date:</strong> ${adm?.admissionDate || '-'}</td>
                            </tr>
                            <tr>
                                <td><strong>Discharge Date:</strong> ${adm?.dischargeDate || new Date().toISOString().split('T')[0]}</td>
                                <td><strong>Attending Doctor:</strong> Dr. ${adm?.admittingDoctorId?.name || adm?.doctorId?.name || 'Doctor'}</td>
                            </tr>
                        </table>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-top: 20px;">
                            <h4 style="margin: 0 0 10px; color: #0f172a;">Billing & Clearance Summary</h4>
                            <p style="margin: 4px 0; font-size: 13px;"><strong>Daily Bed Rate:</strong> ₹${adm?.bedId?.pricePerDay || 2000}</p>
                            <p style="margin: 4px 0; font-size: 13px;"><strong>Status:</strong> <span style="color: #16a34a; font-weight: bold;">CLEARED & DISCHARGED</span></p>
                        </div>
                        <p style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 40px;">This is a computer-generated discharge receipt.</p>
                    </body>
                </html>
            `;
            await Print.printAsync({ html });
        } catch (err) {
            console.warn('Discharge bill print error:', err);
        }
    };

    const submitDischarge = async () => {
        const admToPrint = dischargeModal.admission;
        const dDate = dischargeModal.dischargeDate;
        try {
            setSaving(true);
            await admissionAPI.dischargePatient(dischargeModal.admission._id, {
                dischargeDate: dischargeModal.dischargeDate,
                dischargeTime: dischargeModal.dischargeTime,
                notes: dischargeModal.notes
            });
            Alert.alert(
                "Patient Discharged",
                "Patient discharged successfully. Would you like to print the Inpatient Discharge Bill?",
                [
                    { text: "Later", style: "cancel" },
                    { text: "🖨️ Print Discharge Bill", onPress: () => printDischargeBill({ ...admToPrint, dischargeDate: dDate }) }
                ]
            );
            setDischargeModal({ open: false, admission: null, dischargeDate: '', dischargeTime: '', notes: '' });
            fetchData();
        } catch (err) {
            Alert.alert("Error", err.response?.data?.message || "Failed to discharge patient.");
        } finally {
            setSaving(false);
        }
    };

    const openPaymentModal = (apt) => {
        setPaymentModal({
            open: true,
            appointment: apt,
            method: 'Cash',
            amount: String(apt.amount || apt.consultationFee || 500),
            splitPayments: [{ method: 'Cash', amount: String(apt.amount || 500) }]
        });
    };

    const submitPayment = async () => {
        try {
            setSaving(true);
            await receptionAPI.confirmPayment(
                paymentModal.appointment._id,
                paymentModal.method,
                paymentModal.amount,
                { splitPayments: paymentModal.splitPayments }
            );
            Alert.alert("Payment Confirmed", "Payment of ₹" + paymentModal.amount + " confirmed successfully!");
            setPaymentModal({ open: false, appointment: null, method: 'Cash', amount: '', splitPayments: [] });
            fetchData();
        } catch (err) {
            Alert.alert("Error", err.response?.data?.message || "Failed to record payment.");
        } finally {
            setSaving(false);
        }
    };

    const handlePrintReceipt = (apt) => {
        const pName = apt.userId?.name || apt.patientName || 'Patient';
        setPendingDownload({
            title: 'Payment Receipt',
            filename: `Receipt_${pName.replace(/\s+/g, '_')}.pdf`
        });
        Alert.alert("Receipt Ready", "Receipt generated for " + pName + ". Tap the top banner to download.");
    };

    // Filter appointments for queue
    const filteredQueue = appointments.filter(apt => {
        if (!queueSearch.trim()) return true;
        const q = queueSearch.toLowerCase();
        const pName = String(apt.userId?.name || apt.patientName || '').toLowerCase();
        const pPhone = String(apt.userId?.phone || apt.patientPhone || '');
        const pMrn = String(apt.patientId || apt.userId?.patientId || '').toLowerCase();
        const docName = String(apt.doctorName || apt.doctorId?.name || '').toLowerCase();
        return pName.includes(q) || pPhone.includes(q) || pMrn.includes(q) || docName.includes(q);
    });

    // Filter hospitalized patients
    const filteredHospitalized = hospitalizedPatients.filter(adm => {
        if (!queueSearch.trim()) return true;
        const q = queueSearch.toLowerCase();
        const pName = String(adm.patientId?.name || '').toLowerCase();
        const pPhone = String(adm.patientId?.phone || '');
        const pMrn = String(adm.patientId?.patientId || adm.patientId?.mrn || '').toLowerCase();
        return pName.includes(q) || pPhone.includes(q) || pMrn.includes(q);
    });

    // ─── 0. WELCOME HUB VIEW ─────────────────────────────────────────────────
    const renderWelcome = () => {
        const isMobile = width < 768;
        return (
            <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {pendingDownload && (
                    <View style={styles.wDocBanner}>
                        <Text style={styles.wDocBannerText}>{'✅ '}{pendingDownload.title || 'Document Generated'}{' — '}{pendingDownload.filename}{' is ready'}</Text>
                        <TouchableOpacity style={styles.wDocBannerBtn} onPress={() => setPendingDownload(null)}>
                            <Text style={styles.wDocBannerBtnText}>{'📥 Download'}</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {/* 1. Hero Greeting Banner — Web 1:1 Parity with Illustration & Action Controls */}
                <ExpoLinearGradient colors={['#f8faff', '#f0f4ff', '#e8effe']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.wHeroCard, isMobile && { flexDirection: 'column', alignItems: 'stretch', paddingVertical: 24, paddingHorizontal: 20 }]}>
                    <View style={[styles.wHeroLeft, isMobile && { maxWidth: '100%', marginBottom: 16, paddingRight: 0 }]}>
                        <View style={styles.wBadgePill}>
                            <Text style={{ fontSize: 13, color: '#ffffff' }}>{'👋'}</Text>
                            <Text style={styles.wBadgePillText}>RECEPTIONIST</Text>
                        </View>
                        <Text style={[styles.wHeroTitle, isMobile && { fontSize: 22, lineHeight: 28 }]}>{'Good '}{timeOfDay.toLowerCase()},{' '}<Text style={styles.wNameHighlight}>{currentUser?.name || 'Aman Sharma'}</Text></Text>
                        <Text style={styles.wHeroSubtitle}>{"Here's your workspace. Pick any section to get started."}</Text>
                    </View>

                    {!isMobile && (
                        <View style={styles.wHeroArt}>
                            <Svg viewBox="0 0 260 160" width={190} height={120} fill="none">
                                <Defs>
                                    <LinearGradient id="wDeskGrad" x1="0" y1="0" x2="0" y2="1"><Stop offset="0%" stopColor="#6366f1" /><Stop offset="100%" stopColor="#4f46e5" /></LinearGradient>
                                    <LinearGradient id="wScreenGrad" x1="0" y1="0" x2="0" y2="1"><Stop offset="0%" stopColor="#1e293b" /><Stop offset="100%" stopColor="#334155" /></LinearGradient>
                                </Defs>
                                <Circle cx="130" cy="90" r="55" fill="#ede9fe" opacity={0.6} />
                                <Circle cx="110" cy="50" r="18" fill="#fbcfe8" opacity={0.5} />
                                <Circle cx="180" cy="70" r="10" fill="#bae6fd" opacity={0.7} />
                                <Rect x="50" y="115" width="160" height="12" rx="4" fill="url(#wDeskGrad)" />
                                <Rect x="65" y="127" width="8" height="25" rx="2" fill="#4f46e5" />
                                <Rect x="187" y="127" width="8" height="25" rx="2" fill="#4f46e5" />
                                <Rect x="75" y="90" width="38" height="25" rx="3" fill="url(#wScreenGrad)" />
                                <Line x1="80" y1="97" x2="106" y2="97" stroke="#38bdf8" strokeWidth="1.5" opacity={0.8} />
                                <Line x1="80" y1="101" x2="98" y2="101" stroke="#a78bfa" strokeWidth="1.5" opacity={0.6} />
                                <Line x1="80" y1="105" x2="103" y2="105" stroke="#34d399" strokeWidth="1.5" opacity={0.7} />
                                <Circle cx="145" cy="82" r="10" fill="#f0abfc" opacity={0.7} />
                                <Rect x="136" y="93" width="18" height="22" rx="6" fill="#c084fc" opacity={0.6} />
                                <Rect x="195" y="105" width="12" height="10" rx="2" fill="#fbbf24" />
                                <Path d="M207 108 Q212 108 210 113" stroke="#f59e0b" strokeWidth="1.5" fill="none" />
                                <Circle cx="60" cy="75" r="4" fill="#f472b6" opacity={0.6} />
                                <Path d="M60 79 Q60 92 75 90" stroke="#ec4899" strokeWidth="1.5" fill="none" />
                            </Svg>
                        </View>
                    )}
                </ExpoLinearGradient>
                {/* Search Bar — Web: radius 16, border #e2e8f0 */}
                <View style={styles.wSearchWrap}>
                    <View style={styles.wSearchBar}>
                        <Feather name="search" size={17} color="#94a3b8" style={{ marginRight: 12 }} />
                        <TextInput style={styles.wSearchInput} placeholder="Search Patient by Name, Mobile or MRN..." placeholderTextColor="#94a3b8" value={searchQuery} onChangeText={handleSearchTextChange} />
                        {searching && <ActivityIndicator size="small" color="#6366f1" />}
                    </View>
                    {searchQuery.trim().length > 0 && searchResults.length > 0 && (
                        <View style={styles.wSearchDropdown}>
                            {searchResults.map(p => (
                                <View key={p._id} style={styles.wSearchRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.wSearchName}>{p.name} <Text style={styles.wSearchMrn}>({p.patientId || 'N/A'})</Text></Text>
                                        <Text style={styles.wSearchPhone}>{'📱 '}{p.phone}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity style={[styles.wSearchAction, { backgroundColor: '#10b981' }]} onPress={() => handleSelectPatientForBooking(p)}>
                                            <Text style={styles.wSearchActionText}>{'📋 Book Appointment'}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.wSearchAction, { backgroundColor: '#3b82f6' }]} onPress={() => setProfileModal({ open: true, patient: p })}>
                                            <Text style={styles.wSearchActionText}>{'👤 View Profile'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
                {/* Quick Access Section */}
                <View style={styles.wQuickSection}>
                    <View style={styles.wSectionHeading}>
                        <View style={styles.wHeadingBadge}><Text style={styles.wHeadingBadgeText}>{'⚡ QUICK ACCESS'}</Text></View>
                        <Text style={styles.wHeadingSub}>Frequently used workflows & portals</Text>
                    </View>
                    <View style={[styles.wQuickGrid, isMobile && { flexDirection: 'column' }]}>
                        {/* Card 1: Patient Registration — Mint, border #bbf7d0 */}
                        <TouchableOpacity style={[styles.wSplitCard, { flex: 1, borderColor: '#bbf7d0' }]} activeOpacity={0.85} onPress={() => setViewMode('intake')}>
                            <ExpoLinearGradient colors={['#ecfdf5', '#f0fdf4', '#d1fae5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.wCardTopHalf, { borderBottomWidth: 1, borderBottomColor: '#bbf7d0' }]}>
                                <View style={[styles.wCardIconBox, { backgroundColor: '#10b981' }]}><Feather name="user-plus" size={22} color="#ffffff" /></View>
                                <View style={{ flex: 1 }}><Text style={[styles.wCardTitle, { color: '#064e3b' }]}>Patient Registration</Text><Text style={[styles.wCardDesc, { color: '#047857' }]}>Register new patients and manage records</Text></View>
                            </ExpoLinearGradient>
                            <View style={styles.wCardBottomHalf}>
                                <ExpoLinearGradient colors={['#059669', '#10b981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.wActionBtn, { elevation: 3, shadowColor: '#10b981', shadowOpacity: 0.28, shadowRadius: 14 }]}>
                                    <Text style={styles.wActionBtnText}>Get Started</Text><Text style={styles.wActionBtnArrow}>{'→'}</Text>
                                </ExpoLinearGradient>
                            </View>
                        </TouchableOpacity>
                        {/* Card 2: Patient Search — Blue, border #bfdbfe */}
                        <TouchableOpacity style={[styles.wSplitCard, { flex: 1, borderColor: '#bfdbfe' }]} activeOpacity={0.85} onPress={() => navigation.navigate('ReceptionPatients')}>
                            <ExpoLinearGradient colors={['#eff6ff', '#f0f9ff', '#dbeafe']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.wCardTopHalf, { borderBottomWidth: 1, borderBottomColor: '#bfdbfe' }]}>
                                <View style={[styles.wCardIconBox, { backgroundColor: '#3b82f6' }]}><Feather name="search" size={22} color="#ffffff" /></View>
                                <View style={{ flex: 1 }}><Text style={[styles.wCardTitle, { color: '#1e3a8a' }]}>Patient Search</Text><Text style={[styles.wCardDesc, { color: '#1d4ed8' }]}>Search and view patient information quickly</Text></View>
                            </ExpoLinearGradient>
                            <View style={styles.wCardBottomHalf}>
                                <ExpoLinearGradient colors={['#2563eb', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.wActionBtn, { elevation: 3, shadowColor: '#2563eb', shadowOpacity: 0.28, shadowRadius: 14 }]}>
                                    <Text style={styles.wActionBtnText}>Search Now</Text><Text style={styles.wActionBtnArrow}>{'→'}</Text>
                                </ExpoLinearGradient>
                            </View>
                        </TouchableOpacity>
                        {/* Card 3: Finance — Purple, border #ddd6fe */}
                        <TouchableOpacity style={[styles.wSplitCard, { flex: 1, borderColor: '#ddd6fe' }]} activeOpacity={0.85} onPress={() => navigation.navigate('PatientBillingProfile')}>
                            <ExpoLinearGradient colors={['#f5f3ff', '#faf5ff', '#ede9fe']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.wCardTopHalf, { borderBottomWidth: 1, borderBottomColor: '#ddd6fe' }]}>
                                <View style={[styles.wCardIconBox, { backgroundColor: '#8b5cf6' }]}><FontAwesome5 name="rupee-sign" size={20} color="#ffffff" /></View>
                                <View style={{ flex: 1 }}><Text style={[styles.wCardTitle, { color: '#4c1d95' }]}>Finance & Accounting</Text><Text style={[styles.wCardDesc, { color: '#6d28d9' }]}>Access billing, payments and financial reports</Text></View>
                            </ExpoLinearGradient>
                            <View style={styles.wCardBottomHalf}>
                                <ExpoLinearGradient colors={['#7c3aed', '#8b5cf6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.wActionBtn, { elevation: 3, shadowColor: '#7c3aed', shadowOpacity: 0.28, shadowRadius: 14 }]}>
                                    <Text style={styles.wActionBtnText}>Open Finance</Text><Text style={styles.wActionBtnArrow}>{'→'}</Text>
                                </ExpoLinearGradient>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
                {/* ECG / Care Banner — Web: bg gradient white→#f8fafc, border #e2e8f0, radius 18 */}
                <View style={styles.wQuoteBanner}>
                    <View style={styles.wQuoteLeft}>
                        <View style={styles.wQuoteIconBox}><Text style={styles.wQuoteIconText}>{'\u201C'}</Text></View>
                        <View><Text style={styles.wQuoteTitle}>Compassionate care, every patient, every time.</Text><Text style={styles.wQuoteSub}>{"Let's make a difference together!"}</Text></View>
                    </View>
                    <Svg viewBox="0 0 140 44" width={140} height={44} fill="none">
                        <Defs><LinearGradient id="heartGlow" x1="0" y1="0" x2="1" y2="1"><Stop offset="0%" stopColor="#34d399" /><Stop offset="100%" stopColor="#059669" /></LinearGradient></Defs>
                        <G translate="45, 2">
                            <Path d="M20 7 C 12 -2, 0 5, 0 14 C 0 24, 18 34, 20 36 C 22 34, 40 24, 40 14 C 40 5, 28 -2, 20 7 Z" fill="url(#heartGlow)" />
                            <Path d="M 8 18 L 14 18 L 17 12 L 21 24 L 24 16 L 27 19 L 32 19" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                            <Path d="M 3 24 Q -4 16 2 8 Q 8 20 3 24 Z" fill="#6ee7b7" opacity="0.8" />
                            <Path d="M 37 24 Q 44 16 38 8 Q 32 20 37 24 Z" fill="#6ee7b7" opacity="0.8" />
                        </G>
                        <Circle cx="105" cy="14" r="2" fill="#34d399" /><Circle cx="118" cy="24" r="1.5" fill="#10b981" />
                    </Svg>
                </View>
            </ScrollView>
        );
    };

    // ─── 1. RECEPTION DESK / LIST VIEW (SLICE 2) ─────────────────────────────
    const renderDesk = () => {
        const isMobile = width < 768;

        const totalTodayPatients = appointments.length || stats?.todayAppointments || 0;
        const totalHospitalized = hospitalizedPatients.filter(adm => adm.status === 'Admitted').length || stats?.currentlyHospitalized || 0;
        const todayAdmissionsCount = hospitalizedPatients.filter(adm => {
            const d = adm.admissionDate ? new Date(adm.admissionDate).toISOString().split('T')[0] : '';
            return d === todayStr;
        }).length || stats?.todayAdmissions || 0;
        const totalVacantBeds = availableBeds.length || stats?.availableBeds || 0;

        return (
            <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Desk Page Header */}
                <View style={styles.deskHeaderRow}>
                    <View>
                        <Text style={styles.deskTitle}>Reception Desk & Queue</Text>
                        <Text style={styles.deskSubtitle}>Manage today's OPD flow and inpatient admissions</Text>
                    </View>
                    <TouchableOpacity 
                        style={styles.switchHubBtn}
                        onPress={() => setViewMode('intake')}
                    >
                        <Feather name="user-plus" size={14} color="#0d9488" />
                        <Text style={styles.switchHubBtnText}>New Walk-in</Text>
                    </TouchableOpacity>
                </View>

                {/* Hero Mini Action Chips */}
                <View style={styles.miniChipsRow}>
                    <TouchableOpacity 
                        style={[styles.miniChip, { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' }]}
                        onPress={() => { fetchTransactions(); setViewMode('transactions'); }}
                    >
                        <View style={[styles.miniChipIcon, { backgroundColor: '#c084fc' }]}>
                            <FontAwesome5 name="rupee-sign" size={12} color="#ffffff" />
                        </View>
                        <View>
                            <Text style={styles.miniChipTitle}>Transactions</Text>
                            <Text style={styles.miniChipSub}>View all</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.miniChip, { backgroundColor: '#ccfbf1', borderColor: '#99f6e4' }]}
                        onPress={() => navigation.navigate('PatientBillingProfile')}
                    >
                        <View style={[styles.miniChipIcon, { backgroundColor: '#14b8a6' }]}>
                            <Feather name="file-text" size={12} color="#ffffff" />
                        </View>
                        <View>
                            <Text style={styles.miniChipTitle}>Patient Billing</Text>
                            <Text style={styles.miniChipSub}>Manage</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.miniChip, { backgroundColor: '#dbeafe', borderColor: '#bfdbfe' }]}
                        onPress={() => setViewMode('intake')}
                    >
                        <View style={[styles.miniChipIcon, { backgroundColor: '#3b82f6' }]}>
                            <Feather name="user-plus" size={12} color="#ffffff" />
                        </View>
                        <View>
                            <Text style={styles.miniChipTitle}>New Registration</Text>
                            <Text style={styles.miniChipSub}>Add Patient</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* 4 KPI Cards with Real API Data & Sparkline SVGs */}
                <View style={[styles.kpiGrid, isMobile && styles.kpiGridMobile]}>
                    <TouchableOpacity style={[styles.kpiCard, { borderColor: '#ccfbf1' }]} onPress={() => setListTab('queue')} activeOpacity={0.8}>
                        <View style={styles.kpiTopRow}>
                            <View style={[styles.kpiIconWrap, { backgroundColor: '#ccfbf1' }]}><Feather name="users" size={18} color="#0d9488" /></View>
                            <Svg width="55" height="20" viewBox="0 0 60 20" fill="none">
                                <Path d="M2 14 C 15 18, 30 6, 45 10 C 52 12, 58 4, 58 4" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" />
                            </Svg>
                        </View>
                        <Text style={styles.kpiValue}>{String(totalTodayPatients).padStart(2, '0')}</Text>
                        <Text style={styles.kpiLabel}>Today's Patients</Text>
                        <Text style={[styles.kpiSub, { color: '#0d9488' }]}>Live OPD Queue</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.kpiCard, { borderColor: '#e9d5ff' }]} onPress={() => setListTab('hospitalized')} activeOpacity={0.8}>
                        <View style={styles.kpiTopRow}>
                            <View style={[styles.kpiIconWrap, { backgroundColor: '#f3e8ff' }]}><Feather name="home" size={18} color="#8b5cf6" /></View>
                            <Svg width="55" height="20" viewBox="0 0 60 20" fill="none">
                                <Path d="M2 12 C 14 4, 28 16, 42 6 C 50 2, 58 8, 58 8" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" />
                            </Svg>
                        </View>
                        <Text style={styles.kpiValue}>{String(totalHospitalized).padStart(2, '0')}</Text>
                        <Text style={styles.kpiLabel}>Hospitalized</Text>
                        <Text style={[styles.kpiSub, { color: '#8b5cf6' }]}>Active In-Patients</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.kpiCard, { borderColor: '#fed7aa' }]} onPress={() => setListTab('hospitalized')} activeOpacity={0.8}>
                        <View style={styles.kpiTopRow}>
                            <View style={[styles.kpiIconWrap, { backgroundColor: '#ffedd5' }]}><Feather name="activity" size={18} color="#ea580c" /></View>
                            <Svg width="55" height="20" viewBox="0 0 60 20" fill="none">
                                <Path d="M2 12 C 12 6, 25 16, 38 8 C 48 2, 58 10, 58 10" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" />
                            </Svg>
                        </View>
                        <Text style={styles.kpiValue}>{String(todayAdmissionsCount).padStart(2, '0')}</Text>
                        <Text style={styles.kpiLabel}>Today's Admissions</Text>
                        <Text style={[styles.kpiSub, { color: '#ea580c' }]}>New IPD Admitted</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.kpiCard, { borderColor: '#bfdbfe' }]} onPress={() => fetchData()} activeOpacity={0.8}>
                        <View style={styles.kpiTopRow}>
                            <View style={[styles.kpiIconWrap, { backgroundColor: '#dbeafe' }]}><Feather name="check-circle" size={18} color="#2563eb" /></View>
                            <Svg width="55" height="20" viewBox="0 0 60 20" fill="none">
                                <Path d="M2 16 C 18 10, 32 14, 44 4 C 52 -2, 58 2, 58 2" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
                            </Svg>
                        </View>
                        <Text style={styles.kpiValue}>{String(totalVacantBeds).padStart(2, '0')}</Text>
                        <Text style={styles.kpiLabel}>Available Beds</Text>
                        <Text style={[styles.kpiSub, { color: '#2563eb' }]}>Vacant for Admission</Text>
                    </TouchableOpacity>
                </View>

                {/* Queue Controls: Search & Dual Tabs */}
                <View style={styles.queueControlHeader}>
                    <View style={styles.tabPillContainer}>
                        <TouchableOpacity 
                            style={[styles.tabPill, listTab === 'queue' && styles.tabPillActive]}
                            onPress={() => setListTab('queue')}
                        >
                            <Feather name="clock" size={14} color={listTab === 'queue' ? '#ffffff' : '#475569'} />
                            <Text style={[styles.tabPillText, listTab === 'queue' && styles.tabPillTextActive]}>
                                Today's Queue ({appointments.length})
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.tabPill, listTab === 'hospitalized' && styles.tabPillActiveHosp]}
                            onPress={() => setListTab('hospitalized')}
                        >
                            <Feather name="home" size={14} color={listTab === 'hospitalized' ? '#ffffff' : '#475569'} />
                            <Text style={[styles.tabPillText, listTab === 'hospitalized' && styles.tabPillTextActive]}>
                                Hospitalized ({hospitalizedPatients.length})
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.queueSearchBox}>
                        <Feather name="search" size={16} color="#94a3b8" />
                        <TextInput 
                            placeholder="Filter queue by name, phone, MRN..." 
                            placeholderTextColor="#94a3b8"
                            value={queueSearch}
                            onChangeText={setQueueSearch}
                            style={styles.queueSearchInput}
                        />
                    </View>
                </View>

                {/* Tab 1: Today's OPD Queue Table */}
                {listTab === 'queue' && (
                    <View style={styles.tableCard}>
                        {loading ? (
                            <ActivityIndicator size="large" color="#0d9488" style={{ padding: 40 }} />
                        ) : filteredQueue.length === 0 ? (
                            <View style={styles.emptyWrap}>
                                <Text style={styles.emptyIcon}>📋</Text>
                                <Text style={styles.emptyText}>No appointments in queue today.</Text>
                            </View>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                <View style={styles.tableWrap}>
                                    <View style={styles.tableHeaderRow}>
                                        <Text style={[styles.th, { width: 40 }]}>#</Text>
                                        <Text style={[styles.th, { width: 220 }]}>PATIENT</Text>
                                        <Text style={[styles.th, { width: 130 }]}>MRN</Text>
                                        <Text style={[styles.th, { width: 180 }]}>DOCTOR</Text>
                                        <Text style={[styles.th, { width: 110 }]}>TIME</Text>
                                        <Text style={[styles.th, { width: 120 }]}>STATUS</Text>
                                        <Text style={[styles.th, { width: 330, textAlign: 'center' }]}>ACTIONS</Text>
                                    </View>

                                    {filteredQueue.map((apt, idx) => {
                                        const isHospitalized = hospitalizedPatients.some(adm => 
                                            (adm.appointmentId?._id === apt._id || adm.appointmentId === apt._id) && adm.status === 'Admitted'
                                        );
                                        const pName = apt.userId?.name || apt.patientName || 'Patient';
                                        const pPhone = apt.userId?.phone || apt.patientPhone || '-';
                                        const pMrn = apt.patientId || apt.userId?.patientId || '-';
                                        const dName = apt.doctorName || apt.doctorId?.name || 'Doctor';
                                        const aTime = apt.appointmentTime || '10:00 AM';
                                        const st = (apt.status || 'CONFIRMED').toUpperCase();
                                        const isPaid = apt.paymentStatus === 'Paid' || apt.paymentStatus === 'completed';

                                        return (
                                            <View key={apt._id || idx} style={styles.tr}>
                                                <Text style={[styles.tdNum, { width: 40 }]}>{String(idx + 1).padStart(2, '0')}</Text>
                                                
                                                <TouchableOpacity 
                                                    style={[styles.tdPatient, { width: 220 }]} 
                                                    onPress={() => setProfileModal({ open: true, patient: apt.userId || apt })}
                                                >
                                                    <View style={[styles.avatarCircle, { backgroundColor: getInitialBgColor(pName) }]}>
                                                        <Text style={styles.avatarText}>{pName.substring(0, 2).toUpperCase()}</Text>
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.tdPatientName}>{pName}</Text>
                                                        <Text style={styles.tdPatientPhone}>📱 {pPhone}</Text>
                                                    </View>
                                                </TouchableOpacity>

                                                <View style={{ width: 130 }}>
                                                    <View style={styles.mrnPill}><Text style={styles.mrnPillText}>{pMrn}</Text></View>
                                                </View>

                                                <View style={{ width: 180, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <View style={styles.docAvatar}>
                                                        <Text style={styles.docAvatarText}>{dName.replace('Dr. ', '').substring(0, 2).toUpperCase()}</Text>
                                                    </View>
                                                    <Text style={styles.tdDocName} numberOfLines={1}>{dName}</Text>
                                                </View>

                                                <View style={{ width: 110 }}>
                                                    <View style={styles.timeBadge}>
                                                        <Feather name="clock" size={11} color="#475569" />
                                                        <Text style={styles.timeBadgeText}>{aTime}</Text>
                                                    </View>
                                                </View>

                                                <View style={{ width: 120 }}>
                                                    <View style={[styles.statusBadge, st === 'CONFIRMED' ? styles.statusConfirmed : st === 'COMPLETED' ? styles.statusCompleted : styles.statusPending]}>
                                                        <Text style={[styles.statusBadgeText, st === 'CONFIRMED' ? styles.statusConfirmedText : st === 'COMPLETED' ? styles.statusCompletedText : styles.statusPendingText]}>
                                                            {st}
                                                        </Text>
                                                    </View>
                                                </View>

                                                <View style={{ width: 330, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                                                    <TouchableOpacity style={styles.tblBtnProfile} onPress={() => setProfileModal({ open: true, patient: apt.userId || apt })}>
                                                        <Feather name="eye" size={12} color="#0284c7" />
                                                        <Text style={styles.tblBtnProfileText}>Profile</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity style={styles.tblBtnPrint} onPress={() => handlePrintReceipt(apt)}>
                                                        <Feather name="printer" size={12} color="#059669" />
                                                        <Text style={styles.tblBtnPrintText}>Print</Text>
                                                    </TouchableOpacity>

                                                    {!isPaid && (
                                                        <TouchableOpacity style={styles.tblBtnPay} onPress={() => openPaymentModal(apt)}>
                                                            <Feather name="dollar-sign" size={12} color="#b45309" />
                                                            <Text style={styles.tblBtnPayText}>Pay</Text>
                                                        </TouchableOpacity>
                                                    )}

                                                    <TouchableOpacity style={[styles.tblBtnHosp, isHospitalized && styles.tblBtnHospActive]} onPress={() => openHospitalize(apt)}>
                                                        <Feather name="home" size={12} color={isHospitalized ? '#dc2626' : '#2563eb'} />
                                                        <Text style={[styles.tblBtnHospText, isHospitalized && styles.tblBtnHospActiveText]}>
                                                            {isHospitalized ? 'Admitted' : 'Hospitalize'}
                                                        </Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity style={styles.tblBtnCancel} onPress={() => handleCancelAppointment(apt._id)}>
                                                        <Feather name="x" size={12} color="#ef4444" />
                                                        <Text style={styles.tblBtnCancelText}>Cancel</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        )}
                    </View>
                )}

                {/* Tab 2: Hospitalized In-Patients Table */}
                {listTab === 'hospitalized' && (
                    <View style={styles.tableCard}>
                        {loading ? (
                            <ActivityIndicator size="large" color="#8b5cf6" style={{ padding: 40 }} />
                        ) : filteredHospitalized.length === 0 ? (
                            <View style={styles.emptyWrap}>
                                <Text style={styles.emptyIcon}>🛏️</Text>
                                <Text style={styles.emptyText}>No hospitalized in-patients currently admitted.</Text>
                            </View>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                <View style={styles.tableWrap}>
                                    <View style={styles.tableHeaderRow}>
                                        <Text style={[styles.th, { width: 40 }]}>#</Text>
                                        <Text style={[styles.th, { width: 220 }]}>PATIENT</Text>
                                        <Text style={[styles.th, { width: 130 }]}>MRN</Text>
                                        <Text style={[styles.th, { width: 180 }]}>WARD & BED</Text>
                                        <Text style={[styles.th, { width: 180 }]}>ATTENDING DOCTOR</Text>
                                        <Text style={[styles.th, { width: 140 }]}>ADMISSION DATE</Text>
                                        <Text style={[styles.th, { width: 100 }]}>STATUS</Text>
                                        <Text style={[styles.th, { width: 260, textAlign: 'center' }]}>ACTIONS</Text>
                                    </View>

                                    {filteredHospitalized.map((adm, idx) => {
                                        const pName = adm.patientId?.name || 'In-Patient';
                                        const pPhone = adm.patientId?.phone || '-';
                                        const pMrn = adm.patientId?.patientId || adm.patientId?.mrn || '-';
                                        const dName = adm.appointmentId?.doctorName || adm.appointmentId?.doctorId?.name || 'Attending Physician';
                                        const ward = adm.ward || 'General';
                                        const bedNum = adm.bedNumber || (adm.bedId?.bedNumber) || '#1';
                                        const admDate = adm.admissionDate ? new Date(adm.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Today';

                                        return (
                                            <View key={adm._id || idx} style={styles.tr}>
                                                <Text style={[styles.tdNum, { width: 40 }]}>{String(idx + 1).padStart(2, '0')}</Text>

                                                <TouchableOpacity style={[styles.tdPatient, { width: 220 }]} onPress={() => setProfileModal({ open: true, patient: adm.patientId || adm })}>
                                                    <View style={[styles.avatarCircle, { backgroundColor: getInitialBgColor(pName) }]}>
                                                        <Text style={styles.avatarText}>{pName.substring(0, 2).toUpperCase()}</Text>
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.tdPatientName}>{pName}</Text>
                                                        <Text style={styles.tdPatientPhone}>📱 {pPhone}</Text>
                                                    </View>
                                                </TouchableOpacity>

                                                <View style={{ width: 130 }}><View style={styles.mrnPill}><Text style={styles.mrnPillText}>{pMrn}</Text></View></View>

                                                <View style={{ width: 180, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                                    <View style={styles.wardPill}><Text style={styles.wardPillText}>{ward}</Text></View>
                                                    <View style={styles.bedPill}><Text style={styles.bedPillText}>Bed {bedNum}</Text></View>
                                                </View>

                                                <View style={{ width: 180, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <View style={[styles.docAvatar, { backgroundColor: '#8b5cf6' }]}>
                                                        <Text style={styles.docAvatarText}>{dName.replace('Dr. ', '').substring(0, 2).toUpperCase()}</Text>
                                                    </View>
                                                    <Text style={styles.tdDocName} numberOfLines={1}>{dName}</Text>
                                                </View>

                                                <View style={{ width: 140 }}>
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e293b' }}>{admDate}</Text>
                                                    <Text style={{ fontSize: 11, color: '#64748b' }}>{adm.admissionTime || '10:00 AM'}</Text>
                                                </View>

                                                <View style={{ width: 100 }}><View style={[styles.statusBadge, styles.statusAdmitted]}><Text style={styles.statusAdmittedText}>ADMITTED</Text></View></View>

                                                <View style={{ width: 260, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                                                    <TouchableOpacity style={styles.tblBtnProfile} onPress={() => setProfileModal({ open: true, patient: adm.patientId || adm })}>
                                                        <Feather name="eye" size={12} color="#0284c7" />
                                                        <Text style={styles.tblBtnProfileText}>Profile</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity style={styles.tblBtnTransfer} onPress={() => openTransfer(adm)}>
                                                        <Feather name="repeat" size={12} color="#0d9488" />
                                                        <Text style={styles.tblBtnTransferText}>Transfer</Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity style={styles.tblBtnDischarge} onPress={() => openDischarge(adm)}>
                                                        <Feather name="log-out" size={12} color="#ea580c" />
                                                        <Text style={styles.tblBtnDischargeText}>Discharge</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        )}
                    </View>
                )}
            </ScrollView>
        );
    };

    // ─── 2. PATIENT REGISTRATION & INTAKE (SLICE 3 CORE) ─────────────────────
    const renderIntake = () => {
        const isMobile = width < 768;
        const isTokenMode = hospitalContext?.appointmentMode === 'token';
        const availableDepartments = [...new Set([
            ...(hospitalContext?.departments || []),
            ...doctorsList.flatMap(d => (d.departments && d.departments.length > 0 ? d.departments : (d.department ? [d.department] : [])))
        ])].filter(Boolean);
        const deptsToDisplay = availableDepartments.length > 0
            ? availableDepartments
            : ['General Medicine', 'Gynecology', 'Obstetrics', 'Pediatrics', 'Orthopedics', 'Cardiology', 'Dermatology', 'Neurology', 'ENT'];

        const filteredDocs = doctorsList.filter(doc => {
            if (!intakeForm.department) return true;
            if (doc.departments && doc.departments.length > 0) {
                return doc.departments.includes(intakeForm.department);
            }
            return doc.department === intakeForm.department;
        });

        return (
            <View style={styles.intakeContainer}>
                {/* Centered Heading with Prominent Right Close Button — Web 1:1 */}
                <View style={styles.regHeadingRow}>
                    <View style={styles.regHeadingPlaceholder} />
                    <View style={styles.regHeadingCenter}>
                        <Text style={styles.regTitleGradient}>
                            {isPatientPortal ? (followupStatus?.active ? 'Re-Book Appointment' : 'Book Appointment') : 'New Patient Registration'}
                        </Text>
                        <ExpoLinearGradient colors={['#38bdf8', '#6366f1', '#a855f7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.regTitleGlowAccent} />
                    </View>
                    <View style={styles.regHeadingRight}>
                        <TouchableOpacity 
                            style={styles.regBtnCloseProminent}
                            onPress={() => setViewMode('welcome')}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.regBtnCloseText}>✕ Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Workspace: Left Steps Sidebar on Desktop + Form Cards */}
                <View style={[styles.regWorkspace, isMobile && { flexDirection: 'column' }]}>
                    {!isMobile ? (
                        <View style={styles.regStepsSidebar}>
                            <Text style={styles.regStepsTitle}>REGISTRATION FLOW</Text>
                            {[
                                { step: 1, title: 'Patient Identity', sub: 'KYC & relative' },
                                { step: 2, title: 'Address & Source', sub: 'Address & referral' },
                                { step: 3, title: 'Vitals', sub: 'Health measurements' },
                                { step: 4, title: 'Assignment', sub: 'Doctor & consultant' },
                                { step: 5, title: 'Payment', sub: 'Registration fee' },
                            ].map(item => {
                                const isActive = currentStep === item.step;
                                return (
                                    <TouchableOpacity 
                                        key={item.step} 
                                        style={[styles.regStepItem, isActive && styles.regStepItemActive]}
                                        onPress={() => setCurrentStep(item.step)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[styles.regStepNumBox, isActive && styles.regStepNumBoxActive]}>
                                            <Text style={[styles.regStepNumText, isActive && styles.regStepNumTextActive]}>0{item.step}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.regStepItemTitle, isActive && styles.regStepItemTitleActive]}>{item.title}</Text>
                                            <Text style={styles.regStepItemSub}>{item.sub}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            <View style={styles.regStepsAiBox}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={styles.regScanIcon}><Text style={{ color: '#4f46e5', fontWeight: '900', fontSize: 13 }}>✦</Text></View>
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#1e293b' }}>AI Verification</Text>
                                </View>
                                <View style={styles.regScanLine}>
                                    <ExpoLinearGradient colors={['#06b6d4', '#4f46e5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: '50%', height: '100%', borderRadius: 10 }} />
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.stepperContainer}>
                            {[
                                { step: 1, label: 'Identity' },
                                { step: 2, label: 'Address' },
                                { step: 3, label: 'Vitals' },
                                { step: 4, label: 'Doctor' },
                                { step: 5, label: 'Payment' },
                            ].map(item => {
                                const isActive = currentStep === item.step;
                                const isDone = currentStep > item.step;
                                return (
                                    <TouchableOpacity 
                                        key={item.step} 
                                        style={[styles.stepItem, isActive && styles.stepItemActive]}
                                        onPress={() => setCurrentStep(item.step)}
                                    >
                                        <View style={[styles.stepCircle, isActive && styles.stepCircleActive, isDone && styles.stepCircleDone]}>
                                            {isDone ? (
                                                <Feather name="check" size={12} color="#ffffff" />
                                            ) : (
                                                <Text style={[styles.stepNum, (isActive || isDone) && styles.stepNumActive]}>0{item.step}</Text>
                                            )}
                                        </View>
                                        <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{item.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={true}>
                        {/* ──── STEP 1: IDENTITY & DEMOGRAPHICS ──── */}
                        {currentStep === 1 && (
                            <View style={styles.stepCard}>
                                <View style={styles.cardHeaderRow}>
                                    <View style={styles.cardHeaderLeft}>
                                        <View style={[styles.stepIconWrap, { backgroundColor: '#ccfbf1' }]}>
                                            <Feather name="user" size={16} color="#0d9488" />
                                        </View>
                                        <View>
                                            <Text style={styles.stepTitle}>Patient Identity & KYC</Text>
                                            <Text style={styles.stepSub}>Secure demographic identification</Text>
                                        </View>
                                    </View>
                                    {intakeForm.isAadhaarVerified && (
                                        <View style={styles.verifiedTag}>
                                            <Feather name="check-circle" size={12} color="#15803d" />
                                            <Text style={styles.verifiedTagText}>AADHAAR VERIFIED</Text>
                                        </View>
                                    )}
                                </View>

                            {/* Patient Photo Capture & Upload */}
                            <View style={styles.photoRow}>
                                <View style={styles.photoFrame}>
                                    {intakeForm.avatar || patientPhoto ? (
                                        <Image source={{ uri: intakeForm.avatar || patientPhoto.uri }} style={styles.photoPreview} />
                                    ) : (
                                        <View style={styles.photoPlaceholder}>
                                            <Feather name="camera" size={24} color="#94a3b8" />
                                            <Text style={styles.photoPlaceholderText}>Patient Photo</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.photoBtnCol}>
                                    <TouchableOpacity style={styles.uploadPhotoBtn} onPress={handlePickPhoto}>
                                        <Feather name="upload" size={14} color="#ffffff" />
                                        <Text style={styles.uploadPhotoBtnText}>{intakeForm.avatar ? 'Change Photo' : 'Upload Photo'}</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.photoHelper}>Clear passport-size face photo</Text>
                                </View>
                            </View>

                            {/* Aadhaar Number & OTP Verification */}
                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Aadhaar Number (12 Digits) *</Text>
                                <View style={styles.aadhaarRow}>
                                    <TextInput 
                                        style={[styles.formInput, { flex: 1 }]}
                                        keyboardType="numeric"
                                        maxLength={12}
                                        placeholder="Enter 12-digit Aadhaar"
                                        value={intakeForm.aadhaar}
                                        onChangeText={t => handleFormChange('aadhaar', t.replace(/\D/g, ''))}
                                    />
                                    <TouchableOpacity 
                                        style={[styles.otpBtn, (intakeForm.isAadhaarVerified || verifyingAadhaar) && styles.otpBtnDisabled]}
                                        onPress={handleSendAadhaarOTP}
                                        disabled={intakeForm.isAadhaarVerified || verifyingAadhaar}
                                    >
                                        {verifyingAadhaar ? (
                                            <ActivityIndicator size="small" color="#ffffff" />
                                        ) : (
                                            <Text style={styles.otpBtnText}>{otpSent ? 'Resend OTP' : 'Send OTP'}</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {otpSent && (
                                <View style={styles.fieldBlock}>
                                    <Text style={styles.fieldLabel}>Enter Aadhaar Verification OTP</Text>
                                    <View style={styles.aadhaarRow}>
                                        <TextInput 
                                            style={[styles.formInput, { flex: 1 }]}
                                            keyboardType="numeric"
                                            maxLength={6}
                                            placeholder="Enter 6-digit OTP"
                                            value={aadhaarOtp}
                                            onChangeText={setAadhaarOtp}
                                        />
                                        <TouchableOpacity 
                                            style={[styles.otpBtn, { backgroundColor: '#10b981' }]}
                                            onPress={handleVerifyAadhaarOTP}
                                            disabled={verifyingAadhaar}
                                        >
                                            <Text style={styles.otpBtnText}>Verify OTP</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {/* Demographics Fields */}
                            <View style={styles.formRow2}>
                                <View style={styles.col1}>
                                    <Text style={styles.fieldLabel}>Title</Text>
                                    <View style={styles.pillSelector}>
                                        {['Mr.', 'Mrs.', 'Ms.', 'Dr.'].map(t => (
                                            <TouchableOpacity 
                                                key={t} 
                                                style={[styles.miniPill, intakeForm.title === t && styles.miniPillActive]}
                                                onPress={() => handleFormChange('title', t)}
                                            >
                                                <Text style={[styles.miniPillText, intakeForm.title === t && styles.miniPillTextActive]}>{t}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                                <View style={styles.col2}>
                                    <Text style={styles.fieldLabel}>Gender *</Text>
                                    <View style={styles.pillSelector}>
                                        {['Male', 'Female', 'Other'].map(g => (
                                            <TouchableOpacity 
                                                key={g} 
                                                style={[styles.miniPill, intakeForm.gender === g && styles.miniPillActive]}
                                                onPress={() => handleFormChange('gender', g)}
                                            >
                                                <Text style={[styles.miniPillText, intakeForm.gender === g && styles.miniPillTextActive]}>{g}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            <View style={styles.formRow2}>
                                <View style={styles.col1}>
                                    <Text style={styles.fieldLabel}>First Name *</Text>
                                    <TextInput 
                                        style={styles.formInput} 
                                        placeholder="First Name" 
                                        value={intakeForm.firstName} 
                                        onChangeText={t => handleFormChange('firstName', t)} 
                                    />
                                </View>
                                <View style={styles.col2}>
                                    <Text style={styles.fieldLabel}>Last Name</Text>
                                    <TextInput 
                                        style={styles.formInput} 
                                        placeholder="Last Name" 
                                        value={intakeForm.lastName} 
                                        onChangeText={t => handleFormChange('lastName', t)} 
                                    />
                                </View>
                            </View>

                            <View style={styles.formRow2}>
                                <View style={styles.col1}>
                                    <Text style={styles.fieldLabel}>Mobile Number (10 Digits) *</Text>
                                    <TextInput 
                                        style={styles.formInput} 
                                        keyboardType="numeric" 
                                        maxLength={10} 
                                        placeholder="Mobile" 
                                        value={intakeForm.mobile} 
                                        onChangeText={t => handleFormChange('mobile', t.replace(/\D/g, ''))} 
                                    />
                                </View>
                                <View style={styles.col2}>
                                    <Text style={styles.fieldLabel}>Age</Text>
                                    <TextInput 
                                        style={styles.formInput} 
                                        keyboardType="numeric" 
                                        placeholder="Age" 
                                        value={intakeForm.age} 
                                        onChangeText={t => handleFormChange('age', t)} 
                                    />
                                </View>
                            </View>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Email Address</Text>
                                <TextInput 
                                    style={styles.formInput} 
                                    keyboardType="email-address" 
                                    placeholder="patient@example.com" 
                                    value={intakeForm.email} 
                                    onChangeText={t => handleFormChange('email', t)} 
                                />
                            </View>

                            {/* Relative & Companion Details */}
                            <View style={[styles.fieldBlock, { marginTop: 10 }]}>
                                <Text style={styles.fieldLabel}>Relation To Patient</Text>
                                <View style={styles.pillSelector}>
                                    {['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Sibling', 'Other'].map(r => (
                                        <TouchableOpacity 
                                            key={r} 
                                            style={[styles.miniPill, intakeForm.relationToPatient === r && styles.miniPillActive]}
                                            onPress={() => handleFormChange('relationToPatient', r)}
                                        >
                                            <Text style={[styles.miniPillText, intakeForm.relationToPatient === r && styles.miniPillTextActive]}>{r}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.formRow2}>
                                <View style={styles.col1}>
                                    <Text style={styles.fieldLabel}>Relative First Name</Text>
                                    <TextInput 
                                        style={styles.formInput} 
                                        placeholder="First Name" 
                                        value={intakeForm.partnerFirstName} 
                                        onChangeText={t => handleFormChange('partnerFirstName', t)} 
                                    />
                                </View>
                                <View style={styles.col2}>
                                    <Text style={styles.fieldLabel}>Relative Last Name</Text>
                                    <TextInput 
                                        style={styles.formInput} 
                                        placeholder="Last Name" 
                                        value={intakeForm.partnerLastName} 
                                        onChangeText={t => handleFormChange('partnerLastName', t)} 
                                    />
                                </View>
                            </View>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Relative Contact Mobile (10 Digits)</Text>
                                <TextInput 
                                    style={styles.formInput} 
                                    keyboardType="numeric" 
                                    maxLength={10} 
                                    placeholder="10-digit mobile number" 
                                    value={intakeForm.partnerMobile} 
                                    onChangeText={t => handleFormChange('partnerMobile', t.replace(/\D/g, ''))} 
                                />
                            </View>
                        </View>
                    )}

                    {/* ──── STEP 2: ADDRESS & SOURCE INFORMATION ──── */}
                    {currentStep === 2 && (
                        <View style={styles.stepCard}>
                            <View style={styles.cardHeaderRow}>
                                <View style={styles.cardHeaderLeft}>
                                    <View style={[styles.stepIconWrap, { backgroundColor: '#eff6ff' }]}>
                                        <Feather name="map-pin" size={16} color="#2563eb" />
                                    </View>
                                    <View>
                                        <Text style={styles.stepTitle}>Address & Referral Source</Text>
                                        <Text style={styles.stepSub}>Patient residential and acquisition details</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>House No / Flat / Building Name</Text>
                                <TextInput 
                                    style={styles.formInput} 
                                    placeholder="House No / Flat / Building Name" 
                                    value={intakeForm.houseNo} 
                                    onChangeText={t => handleFormChange('houseNo', t)} 
                                />
                            </View>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Street / Area / Locality</Text>
                                <TextInput 
                                    style={styles.formInput} 
                                    placeholder="Street / Area / Locality" 
                                    value={intakeForm.street} 
                                    onChangeText={t => handleFormChange('street', t)} 
                                />
                            </View>

                            <View style={styles.formRow3}>
                                <View style={styles.col3}>
                                    <Text style={styles.fieldLabel}>City</Text>
                                    <TextInput style={styles.formInput} placeholder="City" value={intakeForm.city} onChangeText={t => handleFormChange('city', t)} />
                                </View>
                                <View style={styles.col3}>
                                    <Text style={styles.fieldLabel}>State</Text>
                                    <TextInput style={styles.formInput} placeholder="State" value={intakeForm.state} onChangeText={t => handleFormChange('state', t)} />
                                </View>
                                <View style={styles.col3}>
                                    <Text style={styles.fieldLabel}>Pincode</Text>
                                    <TextInput style={styles.formInput} placeholder="Pincode" keyboardType="numeric" value={intakeForm.zipCode} onChangeText={t => handleFormChange('zipCode', t)} />
                                </View>
                            </View>

                            <View style={[styles.fieldBlock, { marginTop: 10 }]}>
                                <Text style={styles.fieldLabel}>Patient Source / Referral Type</Text>
                                <View style={styles.pillSelector}>
                                    {['Walk In', 'Doctor Referral', 'Hospital Referral', 'Online', 'Social Media', 'Google/Website', 'Friend/Relative', 'Other'].map(ref => (
                                        <TouchableOpacity 
                                            key={ref} 
                                            style={[styles.miniPill, intakeForm.referralType === ref && styles.miniPillActive]}
                                            onPress={() => handleFormChange('referralType', ref)}
                                        >
                                            <Text style={[styles.miniPillText, intakeForm.referralType === ref && styles.miniPillTextActive]}>{ref}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>
                    )}

                    {/* ──── STEP 3: VITALS & CLINICAL INTAKE ──── */}
                    {currentStep === 3 && (
                        <View style={styles.stepCard}>
                            <View style={styles.cardHeaderRow}>
                                <View style={styles.cardHeaderLeft}>
                                    <View style={[styles.stepIconWrap, { backgroundColor: '#fff7ed' }]}>
                                        <Feather name="heart" size={16} color="#ea580c" />
                                    </View>
                                    <View>
                                        <Text style={styles.stepTitle}>Vitals & Clinical Measurements</Text>
                                        <Text style={styles.stepSub}>Preliminary triage vitals calculation</Text>
                                    </View>
                                </View>
                                <View style={styles.smartBadge}>
                                    <Text style={styles.smartBadgeText}>SMART BMI</Text>
                                </View>
                            </View>

                            <View style={styles.formRow3}>
                                <View style={styles.col3}>
                                    <Text style={styles.fieldLabel}>Height (cm)</Text>
                                    <TextInput 
                                        style={styles.formInput} 
                                        keyboardType="numeric" 
                                        placeholder="e.g. 172" 
                                        value={intakeForm.height} 
                                        onChangeText={t => handleFormChange('height', t)} 
                                    />
                                </View>
                                <View style={styles.col3}>
                                    <Text style={styles.fieldLabel}>Weight (kg)</Text>
                                    <TextInput 
                                        style={styles.formInput} 
                                        keyboardType="numeric" 
                                        placeholder="e.g. 68" 
                                        value={intakeForm.weight} 
                                        onChangeText={t => handleFormChange('weight', t)} 
                                    />
                                </View>
                                <View style={styles.col3}>
                                    <Text style={styles.fieldLabel}>Calculated BMI</Text>
                                    <View style={styles.bmiDisplayBox}>
                                        <Text style={styles.bmiDisplayText}>{intakeForm.bmi || '--'}</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Blood Group</Text>
                                <View style={styles.pillSelector}>
                                    {bloodGroups.map(bg => (
                                        <TouchableOpacity 
                                            key={bg} 
                                            style={[styles.miniPill, intakeForm.bloodGroup === bg && styles.miniPillActive]}
                                            onPress={() => handleFormChange('bloodGroup', bg)}
                                        >
                                            <Text style={[styles.miniPillText, intakeForm.bloodGroup === bg && styles.miniPillTextActive]}>{bg}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Chief Complaint / Reason for Visit</Text>
                                <TextInput 
                                    style={[styles.formInput, { height: 70 }]} 
                                    multiline 
                                    placeholder="e.g. High fever, routine follow-up, consultation..." 
                                    value={intakeForm.reasonForVisit} 
                                    onChangeText={t => handleFormChange('reasonForVisit', t)} 
                                />
                            </View>
                        </View>
                    )}

                    {/* ──── STEP 4: DOCTOR / SLOT / TOKEN ──── */}
                    {currentStep === 4 && (
                        <View style={styles.stepCard}>
                            <View style={styles.cardHeaderRow}>
                                <View style={styles.cardHeaderLeft}>
                                    <View style={[styles.stepIconWrap, { backgroundColor: '#f5f3ff' }]}>
                                        <Feather name="calendar" size={16} color="#7c3aed" />
                                    </View>
                                    <View>
                                        <Text style={styles.stepTitle}>Doctor Assignment & Scheduling</Text>
                                        <Text style={styles.stepSub}>Choose clinic specialist and appointment slot</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Department Selection */}
                            <View style={styles.fieldBlock}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <Text style={styles.fieldLabel}>Select Department *</Text>
                                    {followupStatus?.active && (
                                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#15803d' }}>READ ONLY (Active Follow-up)</Text>
                                    )}
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8 }}>
                                    {deptsToDisplay.map(dept => {
                                        const isSel = intakeForm.department === dept;
                                        return (
                                            <TouchableOpacity 
                                                key={dept} 
                                                disabled={followupStatus?.active}
                                                style={[
                                                    styles.chipPill, 
                                                    isSel && styles.chipPillActive,
                                                    followupStatus?.active && { opacity: 0.6 }
                                                ]}
                                                onPress={() => handleFormChange('department', dept)}
                                            >
                                                <Text style={[styles.chipPillText, isSel && styles.chipPillTextActive]}>{dept}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* Doctor Selection */}
                            <View style={styles.fieldBlock}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <Text style={styles.fieldLabel}>Select Specialist *</Text>
                                    {followupStatus?.active && (
                                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#15803d' }}>READ ONLY</Text>
                                    )}
                                </View>
                                {!intakeForm.department ? (
                                    <View style={{ padding: 14, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 12, color: '#64748b' }}>Please select a department above to view available specialists.</Text>
                                    </View>
                                ) : filteredDocs.length === 0 ? (
                                    <View style={{ padding: 14, backgroundColor: '#fff7ed', borderRadius: 10, borderWidth: 1, borderColor: '#fed7aa', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 12, color: '#c2410c' }}>No specialists currently assigned to {intakeForm.department}.</Text>
                                    </View>
                                ) : (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8 }}>
                                        {filteredDocs.map(doc => {
                                            const isSel = intakeForm.doctor === doc._id;
                                            return (
                                                <TouchableOpacity 
                                                    key={doc._id} 
                                                    disabled={followupStatus?.active}
                                                    style={[
                                                        styles.doctorCardChip, 
                                                        isSel && styles.doctorCardChipActive,
                                                        followupStatus?.active && { opacity: 0.6 }
                                                    ]}
                                                    onPress={() => handleFormChange('doctor', doc._id)}
                                                >
                                                    <View style={[styles.docAvatar, { backgroundColor: isSel ? '#0d9488' : '#e2e8f0' }]}>
                                                        <Text style={[styles.docAvatarText, { color: isSel ? '#ffffff' : '#334155' }]}>
                                                            {doc.name?.replace('Dr. ', '').substring(0, 2).toUpperCase()}
                                                        </Text>
                                                    </View>
                                                    <View>
                                                        <Text style={[styles.doctorChipName, isSel && { color: '#0d9488' }]}>{doc.name}</Text>
                                                        <Text style={styles.doctorChipDept}>{(doc.departments || [doc.department || 'General'])[0]}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                )}
                            </View>

                            {/* Appointment Date */}
                            <View style={styles.fieldBlock}>
                                <Text style={styles.fieldLabel}>Appointment Date *</Text>
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                    <TextInput 
                                        style={[styles.formInput, { flex: 1 }]} 
                                        placeholder="YYYY-MM-DD" 
                                        value={intakeForm.visitDate} 
                                        onChangeText={t => handleFormChange('visitDate', t)} 
                                    />
                                    <TouchableOpacity 
                                        style={[styles.miniPill, intakeForm.visitDate === todayStr && styles.miniPillActive]}
                                        onPress={() => handleFormChange('visitDate', todayStr)}
                                    >
                                        <Text style={[styles.miniPillText, intakeForm.visitDate === todayStr && styles.miniPillTextActive]}>Today</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.miniPill, intakeForm.visitDate === (() => {
                                            const tom = new Date();
                                            tom.setDate(tom.getDate() + 1);
                                            return tom.toISOString().split('T')[0];
                                        })() && styles.miniPillActive]}
                                        onPress={() => {
                                            const tom = new Date();
                                            tom.setDate(tom.getDate() + 1);
                                            handleFormChange('visitDate', tom.toISOString().split('T')[0]);
                                        }}
                                    >
                                        <Text style={styles.miniPillText}>Tomorrow</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Token Mode vs Slot Picker */}
                            {intakeForm.doctor ? (
                                isTokenMode ? (
                                    <View style={styles.tokenModeBox}>
                                        <Text style={{ fontSize: 32 }}>🎟️</Text>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.tokenModeTitle}>Daily Token Mode Active</Text>
                                            <Text style={styles.tokenModeSub}>
                                                {nextToken ? `Next Available Token: #${nextToken}` : 'Token will be allocated on queue registration.'}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: '#92400e', marginTop: 2, opacity: 0.8 }}>Tokens reset daily at midnight</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={{ marginTop: 8 }}>
                                        <SlotPicker
                                            doctorId={intakeForm.doctor}
                                            date={intakeForm.visitDate}
                                            selectedTime={intakeForm.visitTime}
                                            onSelectTime={(time) => handleFormChange('visitTime', time)}
                                        />
                                    </View>
                                )
                            ) : (
                                <View style={{ padding: 14, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 12, color: '#64748b' }}>Select a specialist above to check available consultation slots.</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* ──── STEP 5: PAYMENT & BILLING ──── */}
                    {currentStep === 5 && (
                        <View style={styles.stepCard}>
                            <View style={styles.cardHeaderRow}>
                                <View style={styles.cardHeaderLeft}>
                                    <View style={[styles.stepIconWrap, { backgroundColor: '#ecfdf5' }]}>
                                        <FontAwesome5 name="rupee-sign" size={16} color="#059669" />
                                    </View>
                                    <View>
                                        <Text style={styles.stepTitle}>Payment & Billing Settlement</Text>
                                        <Text style={styles.stepSub}>Collect consultation fees and finalize appointment</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Follow-up Fee Waiver Banner */}
                            {followupStatus?.active && (
                                <View style={styles.followupBanner}>
                                    <Feather name="check-circle" size={16} color="#15803d" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.followupBannerTitle}>Active Follow-up Visit — Payment Waived (₹0)</Text>
                                        <Text style={styles.followupBannerSub}>
                                            Previous paid consultation valid till {new Date(followupStatus.validUntil).toLocaleDateString('en-IN')}.
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Summary Box */}
                            <View style={styles.paymentSummaryBox}>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Consultation Fee</Text>
                                    <Text style={styles.summaryValue}>₹{intakeForm.consultationFee}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Total Payable</Text>
                                    <Text style={[styles.summaryValue, { color: '#059669', fontSize: 18 }]}>
                                        ₹{intakeForm.consultationFee}
                                    </Text>
                                </View>
                            </View>

                            {/* Split Payment Rows */}
                            <Text style={styles.fieldLabel}>Payment Split Breakdown</Text>
                            {intakeForm.splitPayments.map((row, idx) => (
                                <View key={idx} style={styles.splitRow}>
                                    <View style={styles.splitMethodCol}>
                                        {['Cash', 'UPI', 'Card', 'NetBanking'].map(m => (
                                            <TouchableOpacity 
                                                key={m} 
                                                style={[styles.miniPill, row.method === m && styles.miniPillActive]}
                                                onPress={() => updateSplitRow(idx, 'method', m)}
                                            >
                                                <Text style={[styles.miniPillText, row.method === m && styles.miniPillTextActive]}>{m}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <TextInput 
                                        style={[styles.formInput, { width: 100, textAlign: 'right', fontWeight: '800' }]} 
                                        keyboardType="numeric" 
                                        placeholder="Amount" 
                                        value={row.amount} 
                                        onChangeText={t => updateSplitRow(idx, 'amount', t)} 
                                    />
                                    {intakeForm.splitPayments.length > 1 && (
                                        <TouchableOpacity onPress={() => removeSplitRow(idx)} style={styles.removeSplitBtn}>
                                            <Feather name="trash-2" size={14} color="#ef4444" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}

                            <TouchableOpacity style={styles.addSplitRowBtn} onPress={addSplitRow}>
                                <Feather name="plus" size={14} color="#0d9488" />
                                <Text style={styles.addSplitRowBtnText}>Add Split Payment Method</Text>
                            </TouchableOpacity>

                            {/* Dynamic UPI QR Display & Dept UPI Picker */}
                            {intakeForm.splitPayments.some(p => p.method === 'UPI') && (() => {
                                const upiAmount = intakeForm.splitPayments.filter(p => p.method === 'UPI').reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || Number(intakeForm.consultationFee) || 0;
                                const activeUpi = selectedUpiId || upiOptions[0]?.upiId || (hospitalContext?.upiId || 'clinic@upi');
                                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent('upi://pay?pa=' + activeUpi.trim() + '&pn=Medical365&am=' + upiAmount + '&cu=INR')}`;

                                return (
                                    <View style={styles.upiQrBox}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <Feather name="smartphone" size={18} color="#0d9488" />
                                            <Text style={styles.upiTitle}>Clinic Department UPI QR Code</Text>
                                        </View>
                                        <Text style={styles.upiSub}>Scan & pay using any UPI app (GPay / PhonePe / Paytm)</Text>

                                        {upiOptions.length > 1 && (
                                            <View style={{ marginBottom: 12 }}>
                                                <Text style={[styles.fieldLabel, { fontSize: 11 }]}>Select Department UPI</Text>
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                                    {upiOptions.map((opt, oIdx) => (
                                                        <TouchableOpacity
                                                            key={oIdx}
                                                            onPress={() => setSelectedUpiId(opt.upiId)}
                                                            style={[
                                                                styles.miniPill,
                                                                (selectedUpiId === opt.upiId || (!selectedUpiId && oIdx === 0)) && styles.miniPillActive
                                                            ]}
                                                        >
                                                            <Text style={[styles.miniPillText, (selectedUpiId === opt.upiId || (!selectedUpiId && oIdx === 0)) && styles.miniPillTextActive]}>
                                                                {opt.label || opt.upiId}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        )}

                                        <View style={{ alignItems: 'center', padding: 12, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginVertical: 8 }}>
                                            <Image 
                                                source={{ uri: qrUrl }} 
                                                style={{ width: 150, height: 150, borderRadius: 8 }} 
                                                resizeMode="contain" 
                                            />
                                            <Text style={[styles.upiIdText, { marginTop: 8, fontWeight: '700', color: '#0f766e' }]}>
                                                UPI ID: {activeUpi}
                                            </Text>
                                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#0d9488', marginTop: 2 }}>
                                                Amount: ₹{upiAmount}
                                            </Text>
                                        </View>

                                        <View style={{ marginTop: 8 }}>
                                            <Text style={styles.fieldLabel}>UPI Transaction Reference / UTR *</Text>
                                            <TextInput
                                                style={styles.formInput}
                                                placeholder="Enter 12-digit UPI reference number"
                                                value={intakePaymentData.transactionId}
                                                onChangeText={val => setIntakePaymentData(prev => ({ ...prev, transactionId: val }))}
                                            />
                                        </View>

                                        <TouchableOpacity style={styles.proofUploadBtn} onPress={handlePickPaymentProof}>
                                            <Feather name="image" size={14} color="#475569" />
                                            <Text style={styles.proofUploadBtnText}>
                                                {paymentScreenshot ? '✅ Proof Attached (Tap to Change)' : 'Upload Payment Screenshot'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })()}

                            {/* Patient Notes / Bio */}
                            <View style={[styles.fieldBlock, { marginTop: 14 }]}>
                                <Text style={styles.fieldLabel}>Patient Notes / Clinical Bio</Text>
                                <TextInput
                                    style={[styles.formInput, { height: 60 }]}
                                    multiline
                                    placeholder="Patient's profile bio or initial clinical observations..."
                                    value={intakeForm.bio || ''}
                                    onChangeText={val => handleFormChange('bio', val)}
                                />
                            </View>

                            {/* Hospital Policy Agreement Checkbox (1:1 Web) */}
                            <TouchableOpacity 
                                style={{
                                    marginTop: 14,
                                    padding: 12,
                                    backgroundColor: '#f8fafc',
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    borderColor: '#e2e8f0',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 10
                                }}
                                activeOpacity={0.8}
                                onPress={() => setIntakePolicyAgreed(!intakePolicyAgreed)}
                            >
                                <View style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 4,
                                    borderWidth: 1.5,
                                    borderColor: intakePolicyAgreed ? '#2563eb' : '#cbd5e1',
                                    backgroundColor: intakePolicyAgreed ? '#2563eb' : '#ffffff',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {intakePolicyAgreed && <Feather name="check" size={14} color="#ffffff" />}
                                </View>
                                <Text style={{ flex: 1, fontSize: 12, color: '#334155', lineHeight: 18 }}>
                                    I have read, understood, and agree to the{' '}
                                    <Text style={{ color: '#2563eb', fontWeight: '700' }}>Hospital Policies</Text>,{' '}
                                    <Text style={{ color: '#2563eb', fontWeight: '700' }}>Consent to Treatment</Text>, and{' '}
                                    <Text style={{ color: '#2563eb', fontWeight: '700' }}>Privacy Notice</Text>.
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Stepper Footer Controls */}
                    <View style={styles.stepperFooter}>
                        {currentStep > 1 && (
                            <TouchableOpacity style={styles.stepperPrevBtn} onPress={() => setCurrentStep(p => p - 1)}>
                                <Feather name="arrow-left" size={16} color="#475569" />
                                <Text style={styles.stepperPrevBtnText}>Previous</Text>
                            </TouchableOpacity>
                        )}

                        {currentStep < 5 ? (
                            <TouchableOpacity style={styles.stepperNextBtn} onPress={goToNextStep}>
                                <Text style={styles.stepperNextBtnText}>Next Step</Text>
                                <Feather name="arrow-right" size={16} color="#ffffff" />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity 
                                style={[styles.stepperSubmitBtn, saving && styles.stepperSubmitBtnDisabled]} 
                                onPress={handleRegisterAndBook}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <>
                                        <Feather name="check-circle" size={18} color="#ffffff" />
                                        <Text style={styles.stepperSubmitBtnText}>Register & Book Appointment</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </ScrollView>
            </View>
        </View>
    );
};

    // ─── TRANSACTIONS LEDGER (1:1 Web Parity Lines 2699-2801) ─────────────
    const handlePrintTransactionReceipt = async (t) => {
        if (!t) return;
        try {
            const isPaid = (t.paymentStatus || '').toLowerCase() === 'paid';
            const d = t.createdAt ? new Date(t.createdAt) : new Date();
            const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            const hospitalName = hospitalContext?.name || 'Care Hospital & Medical Centre';
            const hospitalAddress = hospitalContext?.address || 'Healthcare Way, Medical Enclave';

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Payment Receipt - ${t._id || 'TX'}</title>
                    <style>
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
                        .header { border-bottom: 2px solid #0d9488; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
                        .title { font-size: 22px; font-weight: bold; color: #0f766e; margin: 0; }
                        .sub { font-size: 12px; color: #64748b; margin-top: 4px; }
                        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; background: ${isPaid ? '#dcfce7' : '#fef3c7'}; color: ${isPaid ? '#166534' : '#92400e'}; }
                        .details-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        .details-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
                        .details-table td.label { font-weight: bold; color: #475569; width: 35%; }
                        .total-box { margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; }
                        .total-amount { font-size: 24px; font-weight: 800; color: #0f172a; }
                        .footer { margin-top: 40px; font-size: 11px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <h1 class="title">${hospitalName}</h1>
                            <div class="sub">${hospitalAddress}</div>
                            <div class="sub" style="margin-top: 8px;"><strong>Official Billing Receipt</strong></div>
                        </div>
                        <div style="text-align: right;">
                            <div class="badge">${isPaid ? 'PAID ✓' : 'PENDING'}</div>
                            <div class="sub" style="margin-top: 6px;">Date: ${dateStr} ${timeStr}</div>
                            <div class="sub">Receipt ID: #${(t._id || '').slice(-8).toUpperCase()}</div>
                        </div>
                    </div>

                    <table class="details-table">
                        <tr>
                            <td class="label">Patient Name:</td>
                            <td><strong>${t.userId?.name || t.patientName || 'Walk-in Patient'}</strong></td>
                        </tr>
                        <tr>
                            <td class="label">Patient ID / MRN:</td>
                            <td>${t.userId?.patientId || t.patientId || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td class="label">Consulting Doctor:</td>
                            <td>${t.doctorName || t.doctorId?.name || 'General OPD'}</td>
                        </tr>
                        <tr>
                            <td class="label">Payment Method:</td>
                            <td>${t.paymentMethod || 'Cash'}</td>
                        </tr>
                        <tr>
                            <td class="label">Transaction Reference:</td>
                            <td>${t.transactionId || t.bankReference || t._id || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td class="label">Status:</td>
                            <td>${t.paymentStatus || 'Paid'}</td>
                        </tr>
                    </table>

                    <div class="total-box">
                        <span style="font-weight: bold; font-size: 15px; color: #334155;">Total Amount Paid:</span>
                        <span class="total-amount">₹${Number(t.amount || 0).toLocaleString('en-IN')}</span>
                    </div>

                    <div class="footer">
                        Computer-generated receipt issued at Reception Desk • ${new Date().toLocaleString('en-IN')}
                    </div>
                </body>
                </html>
            `;
            await Print.printAsync({ html });
        } catch (err) {
            Alert.alert('Print Error', 'Could not print receipt: ' + err.message);
        }
    };

    const renderTransactions = () => {
        const totalCollected = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const totalBills = transactions.length;
        const pendingBills = transactions.filter(t => (t.paymentStatus || '').toLowerCase() !== 'paid').length;

        // Payment mode breakdown
        const cashTotal = transactions.filter(t => (t.paymentMethod || 'Cash').toLowerCase() === 'cash').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const upiTotal = transactions.filter(t => (t.paymentMethod || '').toLowerCase() === 'upi').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const cardTotal = transactions.filter(t => ['card', 'debit card', 'credit card'].includes((t.paymentMethod || '').toLowerCase())).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const filteredTransactions = transactions.filter(t => {
            const matchesStatus = transactionStatusFilter === 'all' 
                ? true 
                : transactionStatusFilter === 'paid' 
                    ? (t.paymentStatus || '').toLowerCase() === 'paid'
                    : (t.paymentStatus || '').toLowerCase() !== 'paid';
            
            const q = transactionSearch.trim().toLowerCase();
            const matchesSearch = !q || (
                (t.userId?.name || t.patientName || '').toLowerCase().includes(q) ||
                (t.doctorName || t.doctorId?.name || '').toLowerCase().includes(q) ||
                (t.paymentMethod || '').toLowerCase().includes(q) ||
                (t.transactionId || t._id || '').toLowerCase().includes(q)
            );

            return matchesStatus && matchesSearch;
        });

        return (
            <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.txHeader}>
                    <TouchableOpacity onPress={() => setViewMode('welcome')} style={styles.txBackBtn}>
                        <Feather name="arrow-left" size={18} color="#334155" />
                        <Text style={styles.txBackBtnText}>Back</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginLeft: 12 }}>
                        <Text style={{ fontSize: 24 }}>💳</Text>
                        <View>
                            <Text style={styles.txHeaderTitle}>Patient Billing & Transactions</Text>
                            <Text style={styles.txHeaderSub}>View lifetime collections and receipts</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={fetchTransactions} style={styles.txRefreshBtn} activeOpacity={0.8}>
                        {loadingTransactions ? (
                            <ActivityIndicator size="small" color="#0d9488" />
                        ) : (
                            <Feather name="refresh-cw" size={16} color="#0d9488" />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Summary Cards (1:1 Web Lines 2717-2734) */}
                <View style={styles.txSummaryGrid}>
                    <View style={[styles.txStatCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                        <Text style={[styles.txStatLabel, { color: '#1e40af' }]}>Total Collected</Text>
                        <Text style={[styles.txStatValue, { color: '#1d4ed8' }]}>₹{totalCollected.toLocaleString('en-IN')}</Text>
                        <Text style={[styles.txStatSub, { color: '#3b82f6' }]}>Lifetime collections</Text>
                    </View>

                    <View style={[styles.txStatCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                        <Text style={[styles.txStatLabel, { color: '#166534' }]}>Total Transactions</Text>
                        <Text style={[styles.txStatValue, { color: '#15803d' }]}>{totalBills}</Text>
                        <Text style={[styles.txStatSub, { color: '#22c55e' }]}>Total bills generated</Text>
                    </View>

                    <View style={[styles.txStatCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                        <Text style={[styles.txStatLabel, { color: '#991b1b' }]}>Pending Payments</Text>
                        <Text style={[styles.txStatValue, { color: '#b91c1c' }]}>{pendingBills}</Text>
                        <Text style={[styles.txStatSub, { color: '#ef4444' }]}>Requires attention</Text>
                    </View>
                </View>

                {/* Payment Mode Breakdown Bar */}
                <View style={styles.txBreakdownBar}>
                    <View style={styles.txBreakdownItem}>
                        <Text style={styles.txBreakdownLabel}>💵 Cash:</Text>
                        <Text style={styles.txBreakdownVal}>₹{cashTotal.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.txBreakdownDivider} />
                    <View style={styles.txBreakdownItem}>
                        <Text style={styles.txBreakdownLabel}>📱 UPI:</Text>
                        <Text style={styles.txBreakdownVal}>₹{upiTotal.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.txBreakdownDivider} />
                    <View style={styles.txBreakdownItem}>
                        <Text style={styles.txBreakdownLabel}>💳 Card/Other:</Text>
                        <Text style={styles.txBreakdownVal}>₹{cardTotal.toLocaleString('en-IN')}</Text>
                    </View>
                </View>

                {/* Search & Filter Controls Card */}
                <View style={styles.txControlsCard}>
                    <View style={styles.txSearchBox}>
                        <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 10 }} />
                        <TextInput 
                            style={styles.txSearchInput} 
                            placeholder="Search by patient name, doctor, reference..."
                            placeholderTextColor="#94a3b8"
                            value={transactionSearch}
                            onChangeText={setTransactionSearch}
                        />
                        {transactionSearch.length > 0 && (
                            <TouchableOpacity onPress={() => setTransactionSearch('')}>
                                <Feather name="x" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Status Tabs */}
                    <View style={styles.txFilterTabs}>
                        {[
                            { key: 'all', label: `All (${transactions.length})` },
                            { key: 'paid', label: `Paid (${totalBills - pendingBills})` },
                            { key: 'pending', label: `Pending (${pendingBills})` }
                        ].map(tab => (
                            <TouchableOpacity 
                                key={tab.key}
                                style={[styles.txFilterTab, transactionStatusFilter === tab.key && styles.txFilterTabActive]}
                                onPress={() => setTransactionStatusFilter(tab.key)}
                            >
                                <Text style={[styles.txFilterTabText, transactionStatusFilter === tab.key && styles.txFilterTabTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Transactions Card List */}
                {loadingTransactions && transactions.length === 0 ? (
                    <View style={styles.txLoadingBox}>
                        <ActivityIndicator size="large" color="#0d9488" />
                        <Text style={styles.txLoadingText}>Loading transactions ledger...</Text>
                    </View>
                ) : filteredTransactions.length === 0 ? (
                    <View style={styles.txEmptyBox}>
                        <Text style={{ fontSize: 44, marginBottom: 12 }}>🧾</Text>
                        <Text style={styles.txEmptyTitle}>No transactions found</Text>
                        <Text style={styles.txEmptySub}>There are no billing records matching your filter.</Text>
                    </View>
                ) : (
                    <View style={styles.txCardList}>
                        {filteredTransactions.map(t => {
                            const isPaid = (t.paymentStatus || '').toLowerCase() === 'paid';
                            const d = t.createdAt ? new Date(t.createdAt) : new Date();
                            const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                            const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                            const method = t.paymentMethod || 'Cash';
                            const icon = method === 'Cash' ? '💵' : method === 'UPI' ? '📱' : '💳';

                            return (
                                <TouchableOpacity 
                                    key={t._id || Math.random().toString()} 
                                    style={styles.txCard}
                                    activeOpacity={0.9}
                                    onPress={() => setSelectedTxModal(t)}
                                >
                                    <View style={styles.txCardHeader}>
                                        <View style={{ flex: 1, marginRight: 12 }}>
                                            <Text style={styles.txPatientName}>
                                                {t.userId?.name || t.patientName || 'Walk-in'}
                                            </Text>
                                            <Text style={styles.txDoctorName}>
                                                Doctor: <Text style={{ fontWeight: '700', color: '#334155' }}>{t.doctorName || t.doctorId?.name || '-'}</Text>
                                            </Text>
                                        </View>
                                        <Text style={styles.txAmount}>₹{Number(t.amount || 0).toLocaleString('en-IN')}</Text>
                                    </View>

                                    <View style={styles.txCardFooter}>
                                        <View style={styles.txDateTimeBox}>
                                            <Feather name="calendar" size={12} color="#64748b" style={{ marginRight: 4 }} />
                                            <Text style={styles.txDateTimeText}>{dateStr} • {timeStr}</Text>
                                        </View>

                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={styles.txMethodBadge}>
                                                <Text style={styles.txMethodText}>{icon} {method}</Text>
                                            </View>
                                            <View style={[styles.txStatusBadge, isPaid ? styles.txStatusPaid : styles.txStatusPending]}>
                                                <Text style={[styles.txStatusText, isPaid ? styles.txStatusTextPaid : styles.txStatusTextPending]}>
                                                    {isPaid ? 'Paid ✓' : 'Pending'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        );
    };

    // ─── MODALS RENDERING ───────────────────────────────────────────────────
    const renderModals = () => (
        <>
            {/* Hospitalize Modal */}
            <Modal visible={hospitalizeModal.open} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🛏️ Hospitalize Patient</Text>
                            <TouchableOpacity onPress={() => setHospitalizeModal({ open: false, appointment: null })}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalPatientSub}>
                            Patient: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{hospitalizeModal.appointment?.userId?.name || hospitalizeModal.appointment?.patientName || 'Patient'}</Text>
                        </Text>

                        <Text style={styles.modalSectionLabel}>Select Ward:</Text>
                        <View style={styles.modalRowSelector}>
                            {['General', 'Semi-Private', 'Private', 'ICU'].map(w => (
                                <TouchableOpacity 
                                    key={w} 
                                    onPress={() => setHospitalizeForm(p => ({ ...p, ward: w }))}
                                    style={[styles.modalPill, hospitalizeForm.ward === w && styles.modalPillActive]}
                                >
                                    <Text style={[styles.modalPillText, hospitalizeForm.ward === w && styles.modalPillTextActive]}>{w}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.modalSectionLabel}>Select Available Bed:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                            {availableBeds.length > 0 ? (
                                availableBeds.map(b => (
                                    <TouchableOpacity 
                                        key={b._id} 
                                        onPress={() => setHospitalizeForm(p => ({ ...p, bedId: b._id }))}
                                        style={[styles.bedChip, hospitalizeForm.bedId === b._id && styles.bedChipActive]}
                                    >
                                        <Text style={[styles.bedChipText, hospitalizeForm.bedId === b._id && styles.bedChipTextActive]}>
                                            Bed #{b.bedNumber} ({b.ward || 'General'})
                                        </Text>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Text style={{ color: '#ef4444', fontStyle: 'italic', fontSize: 12 }}>No vacant beds found.</Text>
                            )}
                        </ScrollView>

                        <Text style={styles.modalSectionLabel}>Admission Notes / Reason:</Text>
                        <TextInput 
                            placeholder="Reason for hospitalization..."
                            style={styles.modalInput}
                            value={hospitalizeForm.notes}
                            onChangeText={t => setHospitalizeForm(p => ({ ...p, notes: t }))}
                        />

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setHospitalizeModal({ open: false, appointment: null })}>
                                <Text style={styles.modalCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalConfirmBtn} onPress={submitHospitalize} disabled={saving}>
                                <Text style={styles.modalConfirmBtnText}>{saving ? 'Admitting...' : 'Confirm Admission'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Transfer Bed Modal */}
            <Modal visible={transferModal.open} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🔄 Transfer Ward / Bed</Text>
                            <TouchableOpacity onPress={() => setTransferModal({ open: false, admission: null })}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalPatientSub}>
                            Patient: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{transferModal.admission?.patientId?.name || 'Patient'}</Text>
                        </Text>

                        <Text style={styles.modalSectionLabel}>Target Ward:</Text>
                        <View style={styles.modalRowSelector}>
                            {['General', 'Semi-Private', 'Private', 'ICU'].map(w => (
                                <TouchableOpacity 
                                    key={w} 
                                    onPress={() => setTransferModal(p => ({ ...p, newWard: w }))}
                                    style={[styles.modalPill, transferModal.newWard === w && styles.modalPillActive]}
                                >
                                    <Text style={[styles.modalPillText, transferModal.newWard === w && styles.modalPillTextActive]}>{w}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.modalSectionLabel}>Select Target Available Bed:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                            {availableBeds.map(b => (
                                <TouchableOpacity 
                                    key={b._id} 
                                    onPress={() => setTransferModal(p => ({ ...p, newBedId: b._id }))}
                                    style={[styles.bedChip, transferModal.newBedId === b._id && styles.bedChipActive]}
                                >
                                    <Text style={[styles.bedChipText, transferModal.newBedId === b._id && styles.bedChipTextActive]}>
                                        Bed #{b.bedNumber} ({b.ward})
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.modalSectionLabel}>Transfer Reason / Notes:</Text>
                        <TextInput 
                            placeholder="Reason for bed transfer..."
                            style={styles.modalInput}
                            value={transferModal.notes}
                            onChangeText={t => setTransferModal(p => ({ ...p, notes: t }))}
                        />

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setTransferModal({ open: false, admission: null })}>
                                <Text style={styles.modalCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: '#0d9488' }]} onPress={submitTransfer} disabled={saving}>
                                <Text style={styles.modalConfirmBtnText}>{saving ? 'Transferring...' : 'Execute Transfer'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Discharge Modal */}
            <Modal visible={dischargeModal.open} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🚪 Discharge Patient</Text>
                            <TouchableOpacity onPress={() => setDischargeModal({ open: false, admission: null })}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalPatientSub}>
                            Patient: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{dischargeModal.admission?.patientId?.name || 'Patient'}</Text>
                        </Text>
                        <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                            Current Bed: <Text style={{ fontWeight: '700' }}>{dischargeModal.admission?.ward} - Bed #{dischargeModal.admission?.bedNumber}</Text>
                        </Text>

                        <Text style={styles.modalSectionLabel}>Discharge Date & Time:</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                            <TextInput 
                                style={[styles.modalInput, { flex: 1 }]}
                                value={dischargeModal.dischargeDate}
                                onChangeText={t => setDischargeModal(p => ({ ...p, dischargeDate: t }))}
                                placeholder="YYYY-MM-DD"
                            />
                            <TextInput 
                                style={[styles.modalInput, { width: 100 }]}
                                value={dischargeModal.dischargeTime}
                                onChangeText={t => setDischargeModal(p => ({ ...p, dischargeTime: t }))}
                                placeholder="HH:MM"
                            />
                        </View>

                        <Text style={styles.modalSectionLabel}>Discharge Summary / Clinical Notes:</Text>
                        <TextInput 
                            placeholder="Condition upon discharge, medications..."
                            style={[styles.modalInput, { height: 60 }]}
                            multiline
                            value={dischargeModal.notes}
                            onChangeText={t => setDischargeModal(p => ({ ...p, notes: t }))}
                        />

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDischargeModal({ open: false, admission: null })}>
                                <Text style={styles.modalCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: '#ea580c' }]} onPress={submitDischarge} disabled={saving}>
                                <Text style={styles.modalConfirmBtnText}>{saving ? 'Discharging...' : 'Confirm Discharge'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Payment Confirm Modal */}
            <Modal visible={paymentModal.open} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>💳 Confirm Payment</Text>
                            <TouchableOpacity onPress={() => setPaymentModal({ open: false, appointment: null })}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalPatientSub}>
                            Patient: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{paymentModal.appointment?.userId?.name || paymentModal.appointment?.patientName || 'Patient'}</Text>
                        </Text>

                        <Text style={styles.modalSectionLabel}>Payment Method:</Text>
                        <View style={styles.modalRowSelector}>
                            {['Cash', 'UPI', 'Card', 'NetBanking'].map(m => (
                                <TouchableOpacity 
                                    key={m} 
                                    onPress={() => setPaymentModal(p => ({ ...p, method: m }))}
                                    style={[styles.modalPill, paymentModal.method === m && styles.modalPillActive]}
                                >
                                    <Text style={[styles.modalPillText, paymentModal.method === m && styles.modalPillTextActive]}>{m}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.modalSectionLabel}>Amount (₹):</Text>
                        <TextInput 
                            style={styles.modalInput}
                            keyboardType="numeric"
                            value={paymentModal.amount}
                            onChangeText={t => setPaymentModal(p => ({ ...p, amount: t }))}
                        />

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPaymentModal({ open: false, appointment: null })}>
                                <Text style={styles.modalCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: '#10b981' }]} onPress={submitPayment} disabled={saving}>
                                <Text style={styles.modalConfirmBtnText}>{saving ? 'Processing...' : 'Confirm Paid'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Patient Profile Preview Modal */}
            <Modal visible={profileModal.open} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>👤 Patient Details</Text>
                            <TouchableOpacity onPress={() => setProfileModal({ open: false, patient: null })}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        {profileModal.patient && (
                            <View style={{ gap: 8, paddingVertical: 10 }}>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{profileModal.patient.name || 'Patient'}</Text>
                                <Text style={{ fontSize: 13, color: '#64748b' }}>MRN: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{profileModal.patient.patientId || profileModal.patient.mrn || 'N/A'}</Text></Text>
                                <Text style={{ fontSize: 13, color: '#64748b' }}>Phone: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{profileModal.patient.phone || '-'}</Text></Text>
                                <Text style={{ fontSize: 13, color: '#64748b' }}>Age / Gender: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{profileModal.patient.age || '-'} / {profileModal.patient.gender || '-'}</Text></Text>
                                <Text style={{ fontSize: 13, color: '#64748b' }}>Address: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{profileModal.patient.address || 'Not specified'}</Text></Text>
                            </View>
                        )}
                        <TouchableOpacity style={[styles.modalConfirmBtn, { marginTop: 14 }]} onPress={() => setProfileModal({ open: false, patient: null })}>
                            <Text style={styles.modalConfirmBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );

    // ─── RENDER MAIN VIEW ───────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            {viewMode === 'welcome' 
                ? renderWelcome() 
                : viewMode === 'intake' 
                    ? renderIntake() 
                    : viewMode === 'transactions'
                        ? renderTransactions()
                        : renderDesk()}
            {renderModals()}
            {/* Transaction Details Modal */}
            <Modal visible={!!selectedTxModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🧾 Receipt & Transaction</Text>
                            <TouchableOpacity onPress={() => setSelectedTxModal(null)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {selectedTxModal && (
                            <View style={{ gap: 12, marginVertical: 8 }}>
                                <View style={{ backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>Patient:</Text>
                                        <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '800' }}>{selectedTxModal.userId?.name || selectedTxModal.patientName || 'Walk-in'}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>Doctor:</Text>
                                        <Text style={{ fontSize: 13, color: '#334155', fontWeight: '700' }}>{selectedTxModal.doctorName || selectedTxModal.doctorId?.name || 'General'}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>Payment Mode:</Text>
                                        <Text style={{ fontSize: 13, color: '#0f766e', fontWeight: '800' }}>{selectedTxModal.paymentMethod || 'Cash'}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>Status:</Text>
                                        <Text style={{ fontSize: 13, color: (selectedTxModal.paymentStatus || '').toLowerCase() === 'paid' ? '#166534' : '#92400e', fontWeight: '800' }}>
                                            {selectedTxModal.paymentStatus || 'Paid'}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>Date & Time:</Text>
                                        <Text style={{ fontSize: 12, color: '#475569' }}>
                                            {new Date(selectedTxModal.createdAt).toLocaleString('en-IN')}
                                        </Text>
                                    </View>
                                    <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 4 }} />
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 14, color: '#0f172a', fontWeight: '800' }}>Total Amount:</Text>
                                        <Text style={{ fontSize: 20, color: '#0d9488', fontWeight: '900' }}>₹{Number(selectedTxModal.amount || 0).toLocaleString('en-IN')}</Text>
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                                    <TouchableOpacity 
                                        style={styles.modalCancelBtn} 
                                        onPress={() => setSelectedTxModal(null)}
                                    >
                                        <Text style={styles.modalCancelBtnText}>Close</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.modalConfirmBtn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]} 
                                        onPress={() => handlePrintTransactionReceipt(selectedTxModal)}
                                    >
                                        <Feather name="printer" size={14} color="#ffffff" />
                                        <Text style={styles.modalConfirmBtnText}>Print Receipt</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc', minHeight: 0 },
    scrollContainer: { flex: 1, overflowY: 'auto' },
    scrollContent: { padding: 20, paddingBottom: 60 },

    // ── Welcome Hub Styles (1:1 Web Parity) ──
    wDocBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ecfdf5', borderWidth: 1.5, borderColor: '#a7f3d0', borderRadius: 12, padding: 12, paddingHorizontal: 20, marginBottom: 20, elevation: 1, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 },
    wDocBannerText: { color: '#065f46', fontWeight: '600', fontSize: 14, flex: 1 },
    wDocBannerBtn: { backgroundColor: '#059669', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, marginLeft: 12 },
    wDocBannerBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
    wHeroCard: { borderRadius: 22, paddingVertical: 32, paddingHorizontal: 36, minHeight: 220, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderWidth: 1.5, borderColor: '#dbeafe', elevation: 2, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 24, overflow: 'hidden' },
    wHeroLeft: { flex: 1, paddingRight: 20, gap: 10 },
    wBadgePill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, alignSelf: 'flex-start', marginBottom: 4, elevation: 2, shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6 },
    wBadgePillText: { fontSize: 11.5, fontWeight: '800', color: '#1e40af', letterSpacing: 0.7 },
    wHeroTitle: { fontSize: 26, fontWeight: '800', color: '#0f172a', lineHeight: 34, letterSpacing: -0.3, marginTop: 4 },
    wNameHighlight: { color: '#4f46e5', fontWeight: '900' },
    wHeroSubtitle: { fontSize: 14.5, color: '#64748b', fontWeight: '500', lineHeight: 21 },
    wHeroArt: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
    wHeroActions: { gap: 10, justifyContent: 'center', flexShrink: 0 },
    wActionChip: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, minWidth: 160 },
    wChipIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    wChipIconPurple: { backgroundColor: '#ede9fe' },
    wChipIconTeal: { backgroundColor: '#ccfbf1' },
    wChipIconBlue: { backgroundColor: '#dbeafe' },
    wChipInfo: { justifyContent: 'center' },
    wChipTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    wChipSub: { fontSize: 11, color: '#64748b', fontWeight: '500', marginTop: 1 },
    wSearchWrap: { position: 'relative', marginBottom: 20, zIndex: 100 },
    wSearchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8 },
    wSearchInput: { flex: 1, fontSize: 14, color: '#1e293b', fontWeight: '500' },
    wSearchDropdown: { position: 'absolute', top: 52, left: 0, right: 0, backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 32, maxHeight: 320, overflow: 'hidden', padding: 6, zIndex: 200 },
    wSearchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', borderRadius: 8 },
    wSearchName: { fontWeight: '700', fontSize: 14, color: '#0f172a' },
    wSearchMrn: { color: '#64748b', fontSize: 12, fontWeight: '600' },
    wSearchPhone: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    wSearchAction: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
    wSearchActionText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
    wQuickSection: { marginBottom: 20, gap: 14 },
    wSectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    wHeadingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef3c7', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#fde68a' },
    wHeadingBadgeText: { fontSize: 11.5, fontWeight: '800', color: '#b45309', letterSpacing: 0.5 },
    wHeadingSub: { fontSize: 12, fontWeight: '500', color: '#64748b' },
    wQuickGrid: { flexDirection: 'row', gap: 18 },
    wSplitCard: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#ffffff', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 15, borderWidth: 1.5, borderColor: '#e2e8f0' },
    wCardTopHalf: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingTop: 22, paddingBottom: 18, paddingHorizontal: 22 },
    wCardIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    wCardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 4, letterSpacing: -0.1 },
    wCardDesc: { fontSize: 12, color: '#64748b', lineHeight: 17, fontWeight: '500' },
    wCardBottomHalf: { backgroundColor: '#ffffff', paddingTop: 16, paddingBottom: 18, paddingHorizontal: 20 },
    wActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 18, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10 },
    wActionBtnText: { color: '#ffffff', fontSize: 13.5, fontWeight: '700' },
    wActionBtnArrow: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
    wQuoteBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 24, marginBottom: 18, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8 },
    wQuoteLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
    wQuoteIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center' },
    wQuoteIconText: { fontSize: 22, color: '#059669', fontWeight: '900', lineHeight: 26 },
    wQuoteTitle: { fontSize: 13.5, fontWeight: '800', color: '#0f172a', lineHeight: 19 },
    wQuoteSub: { fontSize: 12, color: '#64748b', marginTop: 2 },

    // Header Row
    deskHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
    deskTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
    deskSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
    switchHubBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#ccfbf1', borderWidth: 1, borderColor: '#99f6e4' },
    switchHubBtnText: { fontSize: 12, fontWeight: '700', color: '#0f766e' },

    // Mini Chips
    miniChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    miniChip: { flex: 1, minWidth: 160, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, elevation: 1 },
    miniChipIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    miniChipTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
    miniChipSub: { fontSize: 11, color: '#64748b' },

    // KPI Grid
    kpiGrid: { flexDirection: 'row', gap: 14, marginBottom: 20 },
    kpiGridMobile: { flexDirection: 'column' },
    kpiCard: { flex: 1, minWidth: 160, backgroundColor: '#ffffff', borderRadius: 16, padding: 18, borderWidth: 1.5, elevation: 2 },
    kpiTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    kpiIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    kpiValue: { fontSize: 26, fontWeight: '900', color: '#0f172a', marginBottom: 2 },
    kpiLabel: { fontSize: 13, fontWeight: '800', color: '#1e293b' },
    kpiSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },

    // Queue Header & Tabs
    queueControlHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 },
    tabPillContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 10, padding: 3 },
    tabPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
    tabPillActive: { backgroundColor: '#0d9488' },
    tabPillActiveHosp: { backgroundColor: '#8b5cf6' },
    tabPillText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    tabPillTextActive: { color: '#ffffff' },
    queueSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, flex: 1, minWidth: 260 },
    queueSearchInput: { flex: 1, paddingVertical: 8, paddingHorizontal: 8, fontSize: 13, color: '#0f172a' },

    // Table Card
    tableCard: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2, overflow: 'hidden' },
    tableWrap: { minWidth: 1050 },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 2, borderBottomColor: '#edf2f7', paddingVertical: 12, paddingHorizontal: 14 },
    th: { color: '#475569', fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
    tr: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 12, paddingHorizontal: 14 },
    tdNum: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
    tdPatient: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatarCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
    tdPatientName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    tdPatientPhone: { fontSize: 11, color: '#64748b', marginTop: 1 },
    mrnPill: { backgroundColor: '#f1f5f9', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-start' },
    mrnPillText: { fontSize: 12, fontWeight: '700', color: '#334155' },
    docAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0d9488', justifyContent: 'center', alignItems: 'center' },
    docAvatarText: { color: '#ffffff', fontWeight: '800', fontSize: 11 },
    tdDocName: { fontSize: 13, fontWeight: '600', color: '#334155', flex: 1 },
    timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-start' },
    timeBadgeText: { fontSize: 12, fontWeight: '700', color: '#334155' },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, alignSelf: 'flex-start' },
    statusBadgeText: { fontSize: 11, fontWeight: '800' },
    statusConfirmed: { backgroundColor: '#dcfce7' },
    statusConfirmedText: { color: '#15803d' },
    statusCompleted: { backgroundColor: '#eff6ff' },
    statusCompletedText: { color: '#1d4ed8' },
    statusPending: { backgroundColor: '#fef3c7' },
    statusPendingText: { color: '#b45309' },
    statusAdmitted: { backgroundColor: '#dcfce7' },
    statusAdmittedText: { color: '#15803d', fontSize: 11, fontWeight: '800' },
    wardPill: { backgroundColor: '#ede9fe', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
    wardPillText: { color: '#6b21a8', fontSize: 12, fontWeight: '700' },
    bedPill: { backgroundColor: '#e0f2fe', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
    bedPillText: { color: '#0369a1', fontSize: 12, fontWeight: '700' },

    // Action Buttons
    tblBtnProfile: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0f9ff', borderColor: '#bae6fd', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
    tblBtnProfileText: { color: '#0284c7', fontSize: 11, fontWeight: '700' },
    tblBtnPrint: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
    tblBtnPrintText: { color: '#059669', fontSize: 11, fontWeight: '700' },
    tblBtnPay: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
    tblBtnPayText: { color: '#b45309', fontSize: 11, fontWeight: '700' },
    tblBtnHosp: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
    tblBtnHospText: { color: '#2563eb', fontSize: 11, fontWeight: '700' },
    tblBtnHospActive: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
    tblBtnHospActiveText: { color: '#dc2626' },
    tblBtnCancel: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
    tblBtnCancelText: { color: '#ef4444', fontSize: 11, fontWeight: '700' },
    tblBtnTransfer: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ccfbf1', borderColor: '#99f6e4', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
    tblBtnTransferText: { color: '#0d9488', fontSize: 11, fontWeight: '700' },
    tblBtnDischarge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ffedd5', borderColor: '#fed7aa', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
    tblBtnDischargeText: { color: '#ea580c', fontSize: 11, fontWeight: '700' },

    // Empty state
    emptyWrap: { padding: 40, alignItems: 'center' },
    emptyIcon: { fontSize: 32, marginBottom: 8 },
    emptyText: { color: '#64748b', fontSize: 14, fontWeight: '600' },

    // ─── STEPPER STYLES (SLICE 3) ───────────────────────────────────────────
    intakeContainer: { flex: 1, backgroundColor: '#f8fafc', minHeight: 0 },
    regHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 14, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    regHeadingPlaceholder: { width: 90 },
    regHeadingCenter: { alignItems: 'center', flex: 1 },
    regTitleGradient: { fontSize: 22, fontWeight: '800', color: '#4f46e5', letterSpacing: -0.4 },
    regTitleGlowAccent: { width: 60, height: 3, borderRadius: 2, marginTop: 4 },
    regHeadingRight: { width: 90, alignItems: 'flex-end' },
    regBtnCloseProminent: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1' },
    regBtnCloseText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    regWorkspace: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
    regStepsSidebar: { width: 250, backgroundColor: '#ffffff', borderRightWidth: 1, borderRightColor: '#e2e8f0', padding: 16, gap: 8 },
    regStepsTitle: { fontSize: 11, fontWeight: '800', color: '#8796aa', letterSpacing: 1, marginBottom: 8 },
    regStepItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
    regStepItemActive: { backgroundColor: '#eff6ff', borderColor: '#c7d2fe' },
    regStepNumBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#f1f5fa', alignItems: 'center', justifyContent: 'center' },
    regStepNumBoxActive: { backgroundColor: '#4f46e5' },
    regStepNumText: { fontSize: 11, fontWeight: '800', color: '#71819a' },
    regStepNumTextActive: { color: '#ffffff' },
    regStepItemTitle: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
    regStepItemTitleActive: { color: '#4f46e5' },
    regStepItemSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
    regStepsAiBox: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: '#f4f0ff', borderWidth: 1, borderColor: '#e9d5ff' },
    regScanIcon: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
    regScanLine: { height: 4, borderRadius: 10, backgroundColor: '#e2e8f0', marginTop: 10, overflow: 'hidden' },
    intakeTopHeader: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    backBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 14 },
    backBtnText: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
    stepperContainer: { flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'space-between' },
    stepItem: { alignItems: 'center', gap: 4, flex: 1 },
    stepItemActive: { opacity: 1 },
    stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
    stepCircleActive: { backgroundColor: '#0d9488', borderColor: '#0f766e' },
    stepCircleDone: { backgroundColor: '#10b981', borderColor: '#059669' },
    stepNum: { fontSize: 11, fontWeight: '800', color: '#64748b' },
    stepNumActive: { color: '#ffffff' },
    stepLabel: { fontSize: 11, fontWeight: '700', color: '#64748b' },
    stepLabelActive: { color: '#0d9488' },
    formScroll: { padding: 16, paddingBottom: 60 },

    // Step Card
    stepCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#e2e8f0', elevation: 2, marginBottom: 16 },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepIconWrap: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    stepTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    stepSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
    verifiedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
    verifiedTagText: { fontSize: 10, fontWeight: '800', color: '#15803d' },
    smartBadge: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#ffedd5', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
    smartBadgeText: { fontSize: 10, fontWeight: '800', color: '#ea580c' },

    // Photo Box
    photoRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16, backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    photoFrame: { width: 70, height: 70, borderRadius: 10, borderWidth: 1.5, borderColor: '#cbd5e1', overflow: 'hidden', backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' },
    photoPreview: { width: '100%', height: '100%' },
    photoPlaceholder: { alignItems: 'center' },
    photoPlaceholderText: { fontSize: 9, fontWeight: '700', color: '#94a3b8', marginTop: 2 },
    photoBtnCol: { flex: 1, gap: 4 },
    uploadPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0d9488', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
    uploadPhotoBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
    photoHelper: { fontSize: 11, color: '#64748b' },

    // Inputs & Blocks
    fieldBlock: { marginBottom: 14 },
    fieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
    formInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, backgroundColor: '#f8fafc', fontSize: 13, color: '#0f172a' },
    formRow2: { flexDirection: 'row', gap: 12, marginBottom: 14 },
    col1: { flex: 1 },
    col2: { flex: 1 },
    formRow3: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    col3: { flex: 1 },
    pillSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    miniPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    miniPillActive: { backgroundColor: '#ccfbf1', borderColor: '#0d9488' },
    miniPillText: { fontSize: 11, fontWeight: '700', color: '#475569' },
    miniPillTextActive: { color: '#0f766e' },

    // Aadhaar Block
    aadhaarRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    otpBtn: { backgroundColor: '#0d9488', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center' },
    otpBtnDisabled: { backgroundColor: '#94a3b8' },
    otpBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },

    // BMI Box
    bmiDisplayBox: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
    bmiDisplayText: { fontSize: 14, fontWeight: '800', color: '#0f766e' },

    // Doctor & Slots
    chipPill: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
    chipPillActive: { backgroundColor: '#0d9488', borderColor: '#0f766e' },
    chipPillText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    chipPillTextActive: { color: '#ffffff' },
    doctorCardChip: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', marginRight: 8 },
    doctorCardChipActive: { backgroundColor: '#ccfbf1', borderColor: '#0d9488' },
    doctorChipName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    doctorChipDept: { fontSize: 11, color: '#64748b' },
    tokenModeBox: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fef3c7', padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#f59e0b', marginVertical: 10 },
    tokenModeTitle: { fontSize: 14, fontWeight: '800', color: '#78350f' },
    tokenModeSub: { fontSize: 12, color: '#92400e', marginTop: 2 },
    slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    slotBtn: { paddingVertical: 7, paddingHorizontal: 11, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 8, backgroundColor: '#ffffff' },
    slotBtnBooked: { backgroundColor: '#fef2f2', borderColor: '#fecaca', opacity: 0.6 },
    slotBtnSelected: { backgroundColor: '#0d9488', borderColor: '#0f766e' },
    slotBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    slotBtnTextBooked: { color: '#991b1b', textDecorationLine: 'line-through' },
    slotBtnTextSelected: { color: '#ffffff' },

    // Step 5: Payment
    followupBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0fdf4', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 14 },
    followupBannerTitle: { fontSize: 13, fontWeight: '800', color: '#15803d' },
    followupBannerSub: { fontSize: 11, color: '#166534', marginTop: 2 },
    paymentSummaryBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
    summaryLabel: { fontSize: 13, color: '#475569', fontWeight: '600' },
    summaryValue: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    splitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    splitMethodCol: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    removeSplitBtn: { padding: 8 },
    addSplitRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 14 },
    addSplitRowBtnText: { fontSize: 12, fontWeight: '700', color: '#0d9488' },
    upiQrBox: { backgroundColor: '#f0fdfa', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#99f6e4', marginTop: 8 },
    upiTitle: { fontSize: 14, fontWeight: '800', color: '#0f766e' },
    upiSub: { fontSize: 11, color: '#0d9488', marginBottom: 10 },
    qrPlaceholder: { alignItems: 'center', backgroundColor: '#ffffff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#ccfbf1', marginBottom: 10 },
    upiIdText: { fontSize: 12, fontWeight: '700', color: '#0f766e', marginTop: 6 },
    proofUploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', padding: 8, borderRadius: 8 },
    proofUploadBtnText: { fontSize: 12, fontWeight: '600', color: '#475569' },

    // Stepper Footer
    stepperFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 10 },
    stepperPrevBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#e2e8f0' },
    stepperPrevBtnText: { fontSize: 13, fontWeight: '700', color: '#334155' },
    stepperNextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 10, backgroundColor: '#0d9488', marginLeft: 'auto' },
    stepperNextBtnText: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
    stepperSubmitBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 10, backgroundColor: '#059669', flex: 1, justifyContent: 'center' },
    stepperSubmitBtnDisabled: { backgroundColor: '#94a3b8' },
    stepperSubmitBtnText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { backgroundColor: '#ffffff', width: '100%', maxWidth: 500, borderRadius: 18, padding: 22, elevation: 6 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    modalTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
    modalPatientSub: { fontSize: 13, color: '#475569', marginBottom: 12 },
    modalSectionLabel: { fontSize: 12, fontWeight: '800', color: '#475569', marginTop: 10, marginBottom: 6 },
    modalRowSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    modalPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    modalPillActive: { backgroundColor: '#0d9488', borderColor: '#0f766e' },
    modalPillText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    modalPillTextActive: { color: '#ffffff' },
    bedChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', marginRight: 8 },
    bedChipActive: { backgroundColor: '#ccfbf1', borderColor: '#0d9488' },
    bedChipText: { fontSize: 12, fontWeight: '700', color: '#334155' },
    bedChipTextActive: { color: '#0f766e' },
    modalInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 13, color: '#0f172a', backgroundColor: '#f8fafc' },
    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
    modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#f1f5f9' },
    modalCancelBtnText: { color: '#475569', fontWeight: '700', fontSize: 13 },
    modalConfirmBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, backgroundColor: '#0d9488' },
    modalConfirmBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },

    // ── Transactions Ledger Styles (1:1 Web Parity) ──
    txHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, backgroundColor: '#ffffff', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
    txBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    txBackBtnText: { fontSize: 13, fontWeight: '700', color: '#334155' },
    txHeaderTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
    txHeaderSub: { fontSize: 11, color: '#64748b', marginTop: 1 },
    txRefreshBtn: { padding: 10, borderRadius: 8, backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#99f6e4' },
    txSummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
    txStatCard: { flex: 1, minWidth: 150, padding: 16, borderRadius: 14, borderWidth: 1, elevation: 1 },
    txStatLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
    txStatValue: { fontSize: 22, fontWeight: '900' },
    txStatSub: { fontSize: 10, fontWeight: '600', marginTop: 4 },
    txBreakdownBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#ffffff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    txBreakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    txBreakdownLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
    txBreakdownVal: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
    txBreakdownDivider: { width: 1, height: 18, backgroundColor: '#e2e8f0' },
    txControlsCard: { backgroundColor: '#ffffff', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, gap: 12 },
    txSearchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    txSearchInput: { flex: 1, fontSize: 13, color: '#0f172a', padding: 0 },
    txFilterTabs: { flexDirection: 'row', gap: 8 },
    txFilterTab: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    txFilterTabActive: { backgroundColor: '#0d9488', borderColor: '#0f766e' },
    txFilterTabText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    txFilterTabTextActive: { color: '#ffffff' },
    txLoadingBox: { padding: 40, alignItems: 'center', justifyContent: 'center', gap: 12 },
    txLoadingText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    txEmptyBox: { padding: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginVertical: 10 },
    txEmptyTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    txEmptySub: { fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' },
    txCardList: { gap: 10 },
    txCard: { backgroundColor: '#ffffff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 10, elevation: 1 },
    txCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    txPatientName: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    txDoctorName: { fontSize: 12, color: '#64748b', marginTop: 2 },
    txAmount: { fontSize: 17, fontWeight: '900', color: '#0f172a' },
    txCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    txDateTimeBox: { flexDirection: 'row', alignItems: 'center' },
    txDateTimeText: { fontSize: 11, color: '#64748b' },
    txMethodBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    txMethodText: { fontSize: 11, fontWeight: '700', color: '#475569' },
    txStatusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
    txStatusPaid: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac' },
    txStatusPending: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a' },
    txStatusText: { fontSize: 11, fontWeight: '800' },
    txStatusTextPaid: { color: '#166534' },
    txStatusTextPending: { color: '#92400e' }
});

export default ReceptionDashboard;
