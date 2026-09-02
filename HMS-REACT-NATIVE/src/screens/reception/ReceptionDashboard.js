import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Modal, ActivityIndicator, Alert, Dimensions, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { receptionAPI, hospitalAPI, publicAPI, bedAPI, uploadAPI, patientAuthAPI } from '../../utils/api';
import { getSubdomain } from '../../utils/subdomain';

const { width } = Dimensions.get('window');

const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30'
];

const ReceptionDashboard = ({ isPatientPortal = false }) => {
    const navigation = useNavigation();
    const route = useRoute();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('welcome'); // welcome, intake, list, transactions
    const [hospitalContext, setHospitalContext] = useState(null);
    const [doctorsList, setDoctorsList] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState(null);
    const [saving, setSaving] = useState(false);

    // Intake Form State
    const [intakeForm, setIntakeForm] = useState({
        title: 'Mrs.', firstName: '', middleName: '', lastName: '',
        dob: '', age: '', gender: '', mobile: '', email: '',
        address: '', houseNo: '', street: '', city: '', state: '', zipCode: '',
        aadhaar: '', isAadhaarVerified: false, relationToPatient: '',
        partnerTitle: 'Mr.', partnerFirstName: '', partnerLastName: '', partnerMobile: '',
        height: '', weight: '', bmi: '', bloodGroup: '',
        consultationFee: '500', paymentStatus: 'Pending',
        department: '', doctor: '', visitDate: new Date().toISOString().split('T')[0], visitTime: '',
        referralType: '', reasonForVisit: '', paymentMethod: 'Cash',
        splitPayments: [{ method: 'Cash', amount: '' }]
    });

    const [availabilityCheck, setAvailabilityCheck] = useState({
        doctorId: '', date: new Date().toISOString().split('T')[0], bookedSlots: []
    });

    useEffect(() => {
        const fetchHospital = async () => {
            try {
                const sub = getSubdomain();
                const res = await hospitalAPI.resolveHospital(sub);
                if (res.success) {
                    setHospitalContext(res.hospital);
                    fetchDoctors(res.hospital._id);
                }
            } catch (err) { console.error(err); }
        };
        fetchHospital();
    }, []);

    const fetchDoctors = async (hospitalId) => {
        try {
            const res = await publicAPI.getDoctors(null, hospitalId);
            if (res.success) setDoctorsList(res.doctors || []);
        } catch (err) { console.error(err); }
    };

    const fetchBookedSlots = async (doctorId, date) => {
        try {
            const res = await receptionAPI.getBookedSlots(doctorId, date, hospitalContext?._id);
            if (res.success) {
                setAvailabilityCheck(prev => ({ ...prev, bookedSlots: res.bookedSlots || [] }));
            }
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        if (availabilityCheck.doctorId && availabilityCheck.date) {
            fetchBookedSlots(availabilityCheck.doctorId, availabilityCheck.date);
        }
    }, [availabilityCheck.doctorId, availabilityCheck.date]);

    const handleFormChange = (field, value) => {
        setIntakeForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSlotClick = (time) => {
        if (availabilityCheck.bookedSlots.includes(time)) return;
        setIntakeForm(prev => ({
            ...prev, doctor: availabilityCheck.doctorId, visitDate: availabilityCheck.date, visitTime: time
        }));
    };

    const submitIntakeForm = async () => {
        if (!intakeForm.firstName || !intakeForm.mobile) {
            Alert.alert("Error", "Patient Name and Mobile are required.");
            return;
        }
        setSaving(true);
        try {
            const formData = new FormData();
            Object.keys(intakeForm).forEach(key => {
                if (key === 'splitPayments') {
                    formData.append(key, JSON.stringify(intakeForm[key]));
                } else {
                    formData.append(key, intakeForm[key]);
                }
            });
            if (selectedPatientId) formData.append('patientId', selectedPatientId);

            const res = await receptionAPI.saveIntake(formData);
            if (res.success) {
                Alert.alert("Success", "Patient Intake Saved!");
                setViewMode('welcome');
            } else {
                Alert.alert("Error", res.message || "Failed to save intake.");
            }
        } catch (err) {
            console.error(err);
            Alert.alert("Error", "An unexpected error occurred.");
        } finally {
            setSaving(false);
        }
    };

    const renderWelcome = () => (
        <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>Reception Dashboard</Text>
            <Text style={styles.welcomeSub}>Manage patient flow, appointments, and admissions seamlessly.</Text>
            
            <View style={styles.actionGrid}>
                <TouchableOpacity onPress={() => setViewMode('intake')} style={styles.actionCard}>
                    <Text style={styles.actionIcon}>➕</Text>
                    <Text style={styles.actionLabel}>New Intake / Walk-in</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('ReceptionPatients')} style={styles.actionCard}>
                    <Text style={styles.actionIcon}>👥</Text>
                    <Text style={styles.actionLabel}>Patient Queue</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('AdminLabs')} style={styles.actionCard}>
                    <Text style={styles.actionIcon}>🧪</Text>
                    <Text style={styles.actionLabel}>Lab Orders</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Alert.alert("Coming Soon", "Bed Allocation module loading")} style={styles.actionCard}>
                    <Text style={styles.actionIcon}>🛏️</Text>
                    <Text style={styles.actionLabel}>Bed Allocation</Text>
                </TouchableOpacity>
            </View>

            {/* Quick Availability Widget */}
            <View style={styles.widgetBox}>
                <Text style={styles.widgetTitle}>Check Doctor Availability</Text>
                <View style={styles.widgetForm}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Doctor</Text>
                        <View style={styles.pickerSim}>
                            <Text style={{color: '#0f172a'}}>{doctorsList.find(d => d._id === availabilityCheck.doctorId)?.name || 'Select Doctor'}</Text>
                        </View>
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Date</Text>
                        <TextInput 
                            style={styles.input} 
                            value={availabilityCheck.date} 
                            onChangeText={t => setAvailabilityCheck(p => ({...p, date: t}))} 
                            placeholder="YYYY-MM-DD"
                        />
                    </View>
                </View>
                {availabilityCheck.doctorId ? (
                    <View style={styles.slotGrid}>
                        {timeSlots.map(time => {
                            const isBooked = availabilityCheck.bookedSlots.includes(time);
                            return (
                                <TouchableOpacity 
                                    key={time} 
                                    onPress={() => handleSlotClick(time)}
                                    disabled={isBooked}
                                    style={[styles.slotBtn, isBooked && styles.slotBtnBooked]}
                                >
                                    <Text style={[styles.slotBtnText, isBooked && styles.slotBtnTextBooked]}>{time}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                ) : (
                    <Text style={styles.placeholderText}>Select a doctor to view slots.</Text>
                )}
            </View>
        </View>
    );

    const renderIntake = () => (
        <View style={styles.intakeContainer}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => setViewMode('welcome')} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Patient Registration</Text>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Identity & Demographics</Text>
                    <View style={styles.row}>
                        <View style={styles.flex1}><Text style={styles.label}>First Name *</Text><TextInput style={styles.input} value={intakeForm.firstName} onChangeText={t => handleFormChange('firstName', t)} /></View>
                        <View style={styles.flex1}><Text style={styles.label}>Last Name</Text><TextInput style={styles.input} value={intakeForm.lastName} onChangeText={t => handleFormChange('lastName', t)} /></View>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.flex1}><Text style={styles.label}>Mobile *</Text><TextInput style={styles.input} keyboardType="numeric" value={intakeForm.mobile} onChangeText={t => handleFormChange('mobile', t)} /></View>
                        <View style={styles.flex1}><Text style={styles.label}>Age / DOB</Text><TextInput style={styles.input} value={intakeForm.age} onChangeText={t => handleFormChange('age', t)} placeholder="Age" /></View>
                        <View style={styles.flex1}><Text style={styles.label}>Gender</Text><TextInput style={styles.input} value={intakeForm.gender} onChangeText={t => handleFormChange('gender', t)} placeholder="M/F/O" /></View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Appointment Details</Text>
                    <View style={styles.row}>
                        <View style={styles.flex1}><Text style={styles.label}>Department</Text><TextInput style={styles.input} value={intakeForm.department} onChangeText={t => handleFormChange('department', t)} /></View>
                        <View style={styles.flex1}><Text style={styles.label}>Doctor</Text><TextInput style={styles.input} value={intakeForm.doctor} onChangeText={t => handleFormChange('doctor', t)} /></View>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.flex1}><Text style={styles.label}>Visit Date</Text><TextInput style={styles.input} value={intakeForm.visitDate} onChangeText={t => handleFormChange('visitDate', t)} /></View>
                        <View style={styles.flex1}><Text style={styles.label}>Visit Time</Text><TextInput style={styles.input} value={intakeForm.visitTime} onChangeText={t => handleFormChange('visitTime', t)} /></View>
                    </View>
                    <View style={styles.row}>
                        <View style={styles.flex1}><Text style={styles.label}>Reason for Visit</Text><TextInput style={styles.input} value={intakeForm.reasonForVisit} onChangeText={t => handleFormChange('reasonForVisit', t)} /></View>
                    </View>
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={submitIntakeForm} disabled={saving}>
                    <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Register & Queue Patient'}</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );

    return (
        <View style={styles.container}>
            {viewMode === 'welcome' && renderWelcome()}
            {viewMode === 'intake' && renderIntake()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    welcomeContainer: { padding: 20 },
    welcomeTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
    welcomeSub: { fontSize: 14, color: '#64748b', marginBottom: 24 },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 30 },
    actionCard: { flex: 1, minWidth: 200, backgroundColor: '#ffffff', borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
    actionIcon: { fontSize: 32, marginBottom: 12 },
    actionLabel: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
    widgetBox: { backgroundColor: '#ffffff', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4, borderLeftColor: '#14b8a6' },
    widgetTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
    widgetForm: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    inputGroup: { flex: 1 },
    label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, backgroundColor: '#f8fafc', fontSize: 14, color: '#0f172a' },
    pickerSim: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, backgroundColor: '#f8fafc' },
    slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    slotBtn: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 8, backgroundColor: '#ffffff' },
    slotBtnBooked: { backgroundColor: '#fef2f2', borderColor: '#fecaca', opacity: 0.7 },
    slotBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
    slotBtnTextBooked: { color: '#991b1b', textDecorationLine: 'line-through' },
    placeholderText: { color: '#94a3b8', fontStyle: 'italic', fontSize: 13 },
    
    intakeContainer: { flex: 1 },
    headerRow: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    backBtn: { marginRight: 16 },
    backBtnText: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    formScroll: { padding: 20, paddingBottom: 60 },
    section: { backgroundColor: '#ffffff', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1e293b', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8 },
    row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    flex1: { flex: 1 },
    saveBtn: { backgroundColor: '#14b8a6', padding: 16, borderRadius: 10, alignItems: 'center' },
    saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '800' }
});

export default ReceptionDashboard;
