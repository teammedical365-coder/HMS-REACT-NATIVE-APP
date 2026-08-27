import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Modal, TextInput, Platform, Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';
import { useCachedServices, useCachedDoctors } from '../../store/hooks';
import { fetchServices, fetchDoctors } from '../../store/slices/publicDataSlice';
import { Picker } from '@react-native-picker/picker';
import api from '../../utils/api';

const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30'
];

const getSpecialtyFromServices = (services) => {
    if (!services || services.length === 0) return 'General Practitioner';
    const specialtyMap = {
        'ivf': 'IVF Specialist',
        'iui': 'Infertility Specialist',
        'icsi': 'Reproductive Specialist',
        'egg-freezing': 'Fertility Preservation Specialist',
        'genetic-testing': 'Reproductive Geneticist',
        'donor-program': 'Reproductive Endocrinologist',
        'male-fertility': 'Urologist & Andrologist',
        'surrogacy': 'Reproductive Endocrinologist',
        'fertility-surgery': 'Fertility Surgeon'
    };
    return specialtyMap[services[0]] || (typeof services[0] === 'string' ? services[0] : 'Specialist');
};

const Services = () => {
    const navigation = useNavigation();
    const dispatch = useDispatch();

    const { services: servicesFromRedux, loading: loadingServices } = useCachedServices();
    const { doctors: allDoctorsData } = useCachedDoctors();
    const services = servicesFromRedux || [];

    const [showBookingForm, setShowBookingForm] = useState(false);
    const [formData, setFormData] = useState({
        serviceId: '',
        doctorId: '',
        appointmentDate: new Date().toISOString().split('T')[0],
        appointmentTime: ''
    });
    const [availableDoctors, setAvailableDoctors] = useState([]);
    const [availableTimes, setAvailableTimes] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        dispatch(fetchServices());
        dispatch(fetchDoctors());
    }, [dispatch]);

    const allDoctors = useMemo(() => {
        return allDoctorsData.map((doctor) => ({
            id: doctor._id || doctor.doctorId,
            name: doctor.name,
            specialty: doctor.specialty || getSpecialtyFromServices(doctor.services || []),
            services: doctor.services || [],
            original: doctor
        }));
    }, [allDoctorsData]);

    useEffect(() => {
        if (formData.serviceId && allDoctors.length > 0) {
            const selectedService = services.find(s =>
                (s.id && s.id.toString() === formData.serviceId) ||
                (s._id && s._id.toString() === formData.serviceId)
            );

            let matchers = [formData.serviceId];
            if (selectedService) {
                matchers = [
                    ...matchers,
                    selectedService.id,
                    selectedService._id,
                    selectedService.title,
                    selectedService.name
                ].filter(Boolean);
            }

            const normalizedMatchers = matchers.map(m => m.toString().toLowerCase());

            const filtered = allDoctors.filter(doc => {
                if (!doc.services || !Array.isArray(doc.services)) return false;
                return doc.services.some(docService => {
                    const serviceVal = (typeof docService === 'object')
                        ? (docService.id || docService._id || docService.name)
                        : docService;
                    return serviceVal && normalizedMatchers.includes(serviceVal.toString().toLowerCase());
                });
            });

            setAvailableDoctors(filtered);
        } else {
            setAvailableDoctors([]);
        }
    }, [formData.serviceId, allDoctors, services]);

    const updateAvailableTimes = useCallback((selectedDate) => {
        if (!selectedDate) {
            setAvailableTimes([]);
            return;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        const now = new Date();

        let times = [...timeSlots];

        if (selectedDateObj.getTime() === today.getTime()) {
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTimeInMinutes = currentHour * 60 + currentMinute;

            times = times.filter(time => {
                const [hours, minutes] = time.split(':').map(Number);
                const timeInMinutes = hours * 60 + minutes;
                return timeInMinutes > (currentTimeInMinutes + 30);
            });
        }
        setAvailableTimes(times);
    }, []);

    useEffect(() => {
        if (formData.doctorId && formData.appointmentDate) {
            updateAvailableTimes(formData.appointmentDate);
        } else {
            setAvailableTimes([]);
        }
    }, [formData.doctorId, formData.appointmentDate, updateAvailableTimes]);

    const handleServiceClick = (serviceId) => {
        navigation.navigate('Doctors', { serviceId });
    };

    const handleBookAppointment = async () => {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
            navigation.navigate('Login');
            return;
        }
        setShowBookingForm(true);
        setError('');
        setSuccess('');
        setFormData({
            serviceId: '',
            doctorId: '',
            appointmentDate: new Date().toISOString().split('T')[0],
            appointmentTime: ''
        });
        setAvailableDoctors([]);
        setAvailableTimes([]);
    };

    const handleServiceChange = (itemValue) => {
        setFormData({
            ...formData,
            serviceId: itemValue,
            doctorId: '',
            appointmentTime: ''
        });
    };

    const handleDoctorChange = (itemValue) => {
        setFormData({
            ...formData,
            doctorId: itemValue,
            appointmentTime: ''
        });
    };

    const handleDateChange = (text) => {
        setFormData({
            ...formData,
            appointmentDate: text,
            appointmentTime: ''
        });
    };

    const handleSubmit = async () => {
        setError('');
        setSuccess('');
        setIsSubmitting(true);

        if (!formData.serviceId || !formData.doctorId || !formData.appointmentDate || !formData.appointmentTime) {
            setError('Please fill in all fields');
            setIsSubmitting(false);
            return;
        }

        const token = await AsyncStorage.getItem('token');
        if (!token) {
            setError('You must be logged in to book an appointment');
            setIsSubmitting(false);
            navigation.navigate('Login');
            return;
        }

        try {
            const selectedService = services.find(s =>
                (s.id && s.id.toString() === formData.serviceId) ||
                (s._id && s._id.toString() === formData.serviceId)
            );
            const selectedDoctor = allDoctors.find(d => d.id === formData.doctorId);

            if (!selectedDoctor) {
                setError('Selected doctor not found');
                setIsSubmitting(false);
                return;
            }

            const appointmentData = {
                doctorId: selectedDoctor.id,
                doctorName: selectedDoctor.name,
                serviceId: selectedService ? (selectedService.id || selectedService._id) : formData.serviceId,
                serviceName: selectedService ? (selectedService.title || selectedService.name) : 'Service',
                appointmentDate: formData.appointmentDate,
                appointmentTime: formData.appointmentTime,
                amount: selectedService ? (selectedService.price || 0) : 0,
                notes: ''
            };

            const response = await api.post('/api/appointments/create', appointmentData);

            if (response.data.success) {
                setSuccess('Appointment booked successfully!');
                setTimeout(() => {
                    setShowBookingForm(false);
                }, 2000);
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to book appointment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View style={styles.page}>
            <ScrollView contentContainerStyle={styles.contentWrapper}>
                {/* Header Section */}
                <View style={styles.header}>
                    <View style={styles.badge}><Text style={styles.badgeText}>OUR SPECIALIZED SERVICES</Text></View>
                    <Text style={styles.title}>Comprehensive <Text style={styles.textGradient}>Medical Services</Text></Text>
                    <Text style={styles.subtext}>
                        World-class treatments with cutting-edge technology and compassionate care.
                        Choose a service to view our specialized doctors.
                    </Text>
                </View>

                {/* Services Grid */}
                <View style={styles.gridSection}>
                    {loadingServices ? (
                        <View style={styles.loadingState}><ActivityIndicator size="large" color="#14C38E" /><Text style={styles.loadingText}>Loading services...</Text></View>
                    ) : services.length === 0 ? (
                        <View style={styles.emptyState}><Text style={styles.emptyText}>No services currently available.</Text></View>
                    ) : (
                        <View style={styles.grid}>
                            {services.map((service, index) => (
                                <TouchableOpacity
                                    key={service.id || service._id}
                                    style={styles.serviceCard}
                                    onPress={() => handleServiceClick(service.id || service._id)}
                                >
                                    <View style={styles.iconWrapper}>
                                        <View style={[styles.serviceIcon, { borderColor: service.color || '#14C38E' }]}>
                                            <Text style={styles.iconEmoji}>{service.icon || '🏥'}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.serviceContent}>
                                        <Text style={styles.serviceTitle}>{service.title || service.name}</Text>
                                        <Text style={styles.serviceDesc}>{service.description}</Text>
                                        {service.price > 0 && (
                                            <Text style={styles.servicePrice}>Starting at ₹{service.price}</Text>
                                        )}
                                    </View>
                                    <View style={styles.serviceFooter}>
                                        <Text style={styles.learnMore}>View Specialists <Text style={styles.arrow}>→</Text></Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* CTA Section */}
                <View style={styles.ctaCard}>
                    <Text style={styles.ctaTitle}>Ready to Book Your Appointment?</Text>
                    <Text style={styles.ctaSubtext}>Schedule your consultation with our expert team today.</Text>
                    <TouchableOpacity style={styles.btnPrimary} onPress={handleBookAppointment}>
                        <Text style={styles.btnPrimaryText}>Book New Appointment</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Booking Form Modal */}
            <Modal visible={showBookingForm} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Book New Appointment</Text>
                            <TouchableOpacity onPress={() => setShowBookingForm(false)}>
                                <Text style={styles.closeBtn}>×</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {error ? <Text style={styles.errorMsg}>{error}</Text> : null}
                            {success ? <Text style={styles.successMsg}>{success}</Text> : null}

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Service *</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker
                                        selectedValue={formData.serviceId}
                                        onValueChange={handleServiceChange}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Select a service" value="" color="#64748B" />
                                        {services.map(s => (
                                            <Picker.Item key={s.id || s._id} label={s.title || s.name} value={s.id || s._id} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Doctor *</Text>
                                <View style={[styles.pickerContainer, (!formData.serviceId || availableDoctors.length === 0) && styles.pickerDisabled]}>
                                    <Picker
                                        selectedValue={formData.doctorId}
                                        onValueChange={handleDoctorChange}
                                        enabled={!!formData.serviceId && availableDoctors.length > 0}
                                        style={styles.picker}
                                    >
                                        <Picker.Item
                                            label={!formData.serviceId ? 'Please select a service first' : availableDoctors.length === 0 ? 'No doctors available' : 'Select a doctor'}
                                            value=""
                                            color="#64748B"
                                        />
                                        {availableDoctors.map(d => (
                                            <Picker.Item key={d.id} label={`${d.name} - ${d.specialty}`} value={d.id} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Date (YYYY-MM-DD) *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.appointmentDate}
                                    onChangeText={handleDateChange}
                                    placeholder="YYYY-MM-DD"
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Time *</Text>
                                <View style={[styles.pickerContainer, (!formData.doctorId || !formData.appointmentDate || availableTimes.length === 0) && styles.pickerDisabled]}>
                                    <Picker
                                        selectedValue={formData.appointmentTime}
                                        onValueChange={(val) => setFormData({ ...formData, appointmentTime: val })}
                                        enabled={!!formData.doctorId && !!formData.appointmentDate && availableTimes.length > 0}
                                        style={styles.picker}
                                    >
                                        <Picker.Item
                                            label={(!formData.doctorId || !formData.appointmentDate) ? 'Please select doctor & date first' : availableTimes.length === 0 ? 'No available time slots' : 'Select a time'}
                                            value=""
                                            color="#64748B"
                                        />
                                        {availableTimes.map(t => (
                                            <Picker.Item key={t} label={t} value={t} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>

                            <View style={styles.formActions}>
                                <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowBookingForm(false)} disabled={isSubmitting}>
                                    <Text style={styles.btnSecondaryText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.btnModalPrimary} onPress={handleSubmit} disabled={isSubmitting}>
                                    <Text style={styles.btnModalPrimaryText}>{isSubmitting ? 'Booking...' : 'Confirm and Pay'}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: '#F8F9FD' },
    contentWrapper: { padding: 24, paddingBottom: 100 },
    header: { alignItems: 'center', marginBottom: 60, paddingTop: 40 },
    badge: { backgroundColor: 'rgba(20, 195, 142, 0.1)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginBottom: 20 },
    badgeText: { color: '#0A2647', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
    title: { fontSize: 32, fontWeight: '700', color: '#1E293B', marginBottom: 20, textAlign: 'center' },
    textGradient: { color: '#14C38E' },
    subtext: { fontSize: 16, color: '#64748B', textAlign: 'center', lineHeight: 24, maxWidth: 700 },
    gridSection: { marginBottom: 60 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'center' },
    serviceCard: {
        backgroundColor: '#FFFFFF', borderRadius: 16, padding: 30, width: '100%',
        maxWidth: 350, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderColor: 'rgba(226, 232, 240, 0.8)',
        borderWidth: 1, marginBottom: 20
    },
    iconWrapper: { alignItems: 'center', marginBottom: 24 },
    serviceIcon: { width: 80, height: 80, backgroundColor: '#F8F9FD', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
    iconEmoji: { fontSize: 32 },
    serviceContent: { flex: 1, marginBottom: 20 },
    serviceTitle: { fontSize: 20, color: '#0A2647', fontWeight: '700', marginBottom: 12 },
    serviceDesc: { color: '#64748B', fontSize: 14, lineHeight: 22 },
    servicePrice: { marginTop: 8, fontWeight: 'bold', color: '#14C38E' },
    serviceFooter: { paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(226, 232, 240, 0.5)' },
    learnMore: { color: '#14C38E', fontWeight: '600', fontSize: 14 },
    arrow: { fontSize: 16 },
    ctaCard: { backgroundColor: '#0A2647', borderRadius: 24, padding: 40, alignItems: 'center', marginTop: 40 },
    ctaTitle: { fontSize: 24, color: '#FFFFFF', fontWeight: '700', marginBottom: 15, textAlign: 'center' },
    ctaSubtext: { fontSize: 16, color: '#FFFFFF', opacity: 0.9, marginBottom: 30, textAlign: 'center' },
    btnPrimary: { backgroundColor: '#14C38E', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 50 },
    btnPrimaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFFFFF', width: '100%', maxWidth: 500, borderRadius: 24, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 24, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    modalTitle: { fontSize: 22, fontWeight: '700', color: '#0A2647' },
    closeBtn: { fontSize: 28, color: '#64748B', lineHeight: 28 },
    modalBody: { padding: 24 },
    formGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginBottom: 8 },
    pickerContainer: { borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 8, backgroundColor: '#FFFFFF' },
    pickerDisabled: { backgroundColor: '#F8F9FD', opacity: 0.6 },
    picker: { height: 50, width: '100%' },
    input: { borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 16, color: '#1E293B', backgroundColor: '#FFFFFF' },
    formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
    btnSecondary: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: '#F8F9FD', borderRadius: 8, borderWidth: 2, borderColor: '#E2E8F0' },
    btnSecondaryText: { color: '#1E293B', fontWeight: '600' },
    btnModalPrimary: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#14C38E', borderRadius: 8 },
    btnModalPrimaryText: { color: '#FFFFFF', fontWeight: '600' },
    errorMsg: { backgroundColor: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 20 },
    successMsg: { backgroundColor: '#d1fae5', color: '#065f46', padding: 12, borderRadius: 8, marginBottom: 20 },
    loadingState: { alignItems: 'center', padding: 40 },
    loadingText: { marginTop: 10, color: '#64748B' },
    emptyState: { alignItems: 'center', padding: 40 },
    emptyText: { color: '#64748B', fontSize: 16 }
});

export default Services;
