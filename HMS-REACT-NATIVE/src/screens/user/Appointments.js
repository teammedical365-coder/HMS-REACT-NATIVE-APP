import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Modal, Linking
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';

// Assuming you migrated the hooks in Batch 1
import { useAuth, useAppointments, useCachedServices, useCachedDoctors } from '../../store/hooks';
import { fetchAppointments, createAppointment } from '../../store/slices/appointmentSlice';
import { fetchServices, fetchDoctors, fetchBookedSlots } from '../../store/slices/publicDataSlice';

const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30'
];

const Appointment = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const dispatch = useDispatch();

    // React Navigation params replace useSearchParams
    const doctorId = route.params?.doctorId;

    const { isAuthenticated, user } = useAuth();
    const { appointments, loading: appointmentsLoading } = useAppointments();
    const { services: servicesData } = useCachedServices();
    const { doctors: doctorsData } = useCachedDoctors();
    const bookedSlots = useSelector((state) => state.publicData.bookedSlots);

    const [filter, setFilter] = useState('all');

    // Forms state
    const [formData, setFormData] = useState({
        appointmentDate: '',
        appointmentTime: '',
        notes: ''
    });

    const [modalForm, setModalForm] = useState({
        serviceId: '',
        doctorId: '',
        appointmentDate: new Date().toISOString().split('T')[0],
        appointmentTime: ''
    });

    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [showBookingModal, setShowBookingModal] = useState(false);
    const [availableDoctors, setAvailableDoctors] = useState([]);
    const [availableTimes, setAvailableTimes] = useState([]);

    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);

    useEffect(() => {
        dispatch(fetchServices());
        dispatch(fetchDoctors());
    }, [dispatch]);

    useEffect(() => {
        if (!isAuthenticated || !user) {
            navigation.replace('Login', { redirect: 'Appointment', doctorId });
            return;
        }

        dispatch(fetchAppointments());

        if (doctorId && doctorsData.length > 0) {
            const doctor = doctorsData.find(doc => doc._id === doctorId || doc.doctorId === doctorId);
            if (doctor) {
                setSelectedDoctor(doctor);
                const today = new Date().toISOString().split('T')[0];
                setFormData(prev => ({ ...prev, appointmentDate: today }));
            } else {
                setError('Doctor not found');
            }
        }
    }, [doctorId, navigation, doctorsData, isAuthenticated, user, dispatch]);

    useEffect(() => {
        const currentDoctorId = modalForm.doctorId || (selectedDoctor ? (selectedDoctor._id || selectedDoctor.doctorId) : null);
        const currentDate = modalForm.appointmentDate || formData.appointmentDate;

        if (currentDoctorId && currentDate) {
            dispatch(fetchBookedSlots({ doctorId: currentDoctorId, date: currentDate }));
        }
    }, [modalForm.doctorId, modalForm.appointmentDate, selectedDoctor, formData.appointmentDate, dispatch]);

    const updateAvailableTimes = useCallback((selectedDate) => {
        if (!selectedDate) {
            setAvailableTimes([]);
            return;
        }

        let times = [...timeSlots];

        if (bookedSlots && bookedSlots.length > 0) {
            times = times.filter(t => !bookedSlots.includes(t));
        }

        const currentDoctorId = modalForm.doctorId || (selectedDoctor ? (selectedDoctor._id || selectedDoctor.doctorId) : null);

        if (currentDoctorId && doctorsData.length > 0) {
            const doctor = doctorsData.find(d => d._id === currentDoctorId || d.doctorId === currentDoctorId);

            if (doctor && doctor.availability) {
                const dateObj = new Date(selectedDate);
                const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const dayName = days[dateObj.getDay()];
                const daySchedule = doctor.availability[dayName];

                if (daySchedule && daySchedule.available === false) {
                    setAvailableTimes([]);
                    return;
                }

                if (daySchedule && daySchedule.startTime && daySchedule.endTime) {
                    const getMinutes = (t) => {
                        const [h, m] = t.split(':').map(Number);
                        return h * 60 + m;
                    };

                    const startMin = getMinutes(daySchedule.startTime);
                    const endMin = getMinutes(daySchedule.endTime);

                    times = times.filter(t => {
                        const tMin = getMinutes(t);
                        return tMin >= startMin && tMin < endMin;
                    });
                }
            }
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        const now = new Date();

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
    }, [modalForm.doctorId, doctorsData, selectedDoctor, bookedSlots]);

    useEffect(() => {
        if (modalForm.serviceId && doctorsData.length > 0) {
            const filtered = doctorsData.filter(doc =>
                doc.services && doc.services.some(s => s === modalForm.serviceId || s.id === modalForm.serviceId)
            );
            setAvailableDoctors(filtered.length > 0 ? filtered : doctorsData);
            setModalForm(prev => ({ ...prev, doctorId: '', appointmentTime: '' }));
        } else {
            setAvailableDoctors(doctorsData);
            setModalForm(prev => ({ ...prev, doctorId: '' }));
        }
    }, [modalForm.serviceId, doctorsData]);

    useEffect(() => {
        if (modalForm.appointmentDate) {
            updateAvailableTimes(modalForm.appointmentDate);
        } else {
            setAvailableTimes([]);
            setModalForm(prev => ({ ...prev, appointmentTime: '' }));
        }
    }, [modalForm.doctorId, modalForm.appointmentDate, updateAvailableTimes]);

    useEffect(() => {
        if (selectedDoctor && formData.appointmentDate) {
            updateAvailableTimes(formData.appointmentDate);
        }
    }, [selectedDoctor, formData.appointmentDate, updateAvailableTimes, bookedSlots]);

    const onModalFormSubmit = async () => {
        setError('');
        if (!modalForm.appointmentTime) {
            setError('Please select a valid time slot.');
            return;
        }

        setIsSubmitting(true);
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                setError('You must be logged in to book an appointment');
                setIsSubmitting(false);
                navigation.replace('Login');
                return;
            }

            const selectedService = servicesData.find(s => s.id === modalForm.serviceId || s._id === modalForm.serviceId);
            const selectedDoc = doctorsData.find(d => d._id === modalForm.doctorId || d.doctorId === modalForm.doctorId);

            if (!selectedDoc) {
                setError('Selected doctor not found');
                setIsSubmitting(false);
                return;
            }

            const appointmentData = {
                doctorId: selectedDoc._id,
                doctorName: selectedDoc.name,
                serviceId: selectedService ? (selectedService.id || selectedService._id) : 'general',
                serviceName: selectedService ? (selectedService.title || selectedService.name) : 'General Consultation',
                appointmentDate: modalForm.appointmentDate,
                appointmentTime: modalForm.appointmentTime,
                amount: (selectedService && selectedService.price) ? selectedService.price : (selectedDoc.consultationFee || 500),
                notes: ''
            };

            const result = await dispatch(createAppointment(appointmentData));

            if (createAppointment.fulfilled.match(result)) {
                setShowBookingModal(false);
                setModalForm({ serviceId: '', doctorId: '', appointmentDate: new Date().toISOString().split('T')[0], appointmentTime: '' });
                setAvailableDoctors([]);
                setAvailableTimes([]);
                dispatch(fetchAppointments());
                if (selectedDoctor && modalForm.appointmentDate) {
                    dispatch(fetchBookedSlots({ doctorId: selectedDoctor, date: modalForm.appointmentDate }));
                }
            } else {
                setError(result.payload || 'Failed to book appointment.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to book appointment.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredAppointments = appointments.filter(apt => {
        if (filter === 'all') return true;
        const appointmentDateTime = new Date(`${apt.appointmentDate}T${apt.appointmentTime}`);
        const now = new Date();
        if (filter === 'upcoming') return appointmentDateTime >= now;
        else if (filter === 'past') return appointmentDateTime < now;
        return true;
    });

    const sortedAppointments = [...filteredAppointments].sort((a, b) => {
        const dateA = new Date(`${a.appointmentDate}T${a.appointmentTime}`);
        const dateB = new Date(`${b.appointmentDate}T${b.appointmentTime}`);
        const now = new Date();
        if (dateA >= now && dateB < now) return -1;
        if (dateA < now && dateB >= now) return 1;
        return dateB - dateA;
    });

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const isUpcoming = (appointmentDate, appointmentTime) => {
        const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
        return appointmentDateTime >= new Date();
    };

    if (!isAuthenticated) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0A2647" />
                <Text style={styles.loadingText}>Loading your appointments...</Text>
            </View>
        );
    }

    return (
        <View style={styles.appointmentPage}>
            <ScrollView contentContainerStyle={styles.contentWrapper}>

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.badge}><Text style={styles.badgeText}>MY APPOINTMENTS</Text></View>
                    <Text style={styles.title}>Your <Text style={styles.textGradient}>Appointments</Text></Text>
                    <Text style={styles.subtext}>View and manage all your appointments in one place.</Text>
                    <TouchableOpacity
                        style={styles.btnPrimary}
                        onPress={() => {
                            setShowBookingModal(true);
                            setModalForm({ serviceId: '', doctorId: '', appointmentDate: new Date().toISOString().split('T')[0], appointmentTime: '' });
                            setAvailableDoctors([]);
                            setAvailableTimes([]);
                            setError('');
                        }}
                    >
                        <Text style={styles.btnPrimaryText}>➕ Book New Appointment</Text>
                    </TouchableOpacity>
                </View>

                {/* Filters */}
                {!doctorId && (
                    <View style={styles.filterContainer}>
                        <TouchableOpacity
                            style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
                            onPress={() => setFilter('all')}>
                            <Text style={[styles.filterBtnText, filter === 'all' && styles.filterBtnTextActive]}>All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterBtn, filter === 'upcoming' && styles.filterBtnActive]}
                            onPress={() => setFilter('upcoming')}>
                            <Text style={[styles.filterBtnText, filter === 'upcoming' && styles.filterBtnTextActive]}>Upcoming</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterBtn, filter === 'past' && styles.filterBtnActive]}
                            onPress={() => setFilter('past')}>
                            <Text style={[styles.filterBtnText, filter === 'past' && styles.filterBtnTextActive]}>Past</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Appointments List */}
                {!doctorId && (
                    <View style={styles.listSection}>
                        {appointmentsLoading ? (
                            <ActivityIndicator size="large" color="#0A2647" />
                        ) : sortedAppointments.length > 0 ? (
                            <View style={styles.appointmentsGrid}>
                                {sortedAppointments.map((appointment) => {
                                    const upcoming = isUpcoming(appointment.appointmentDate, appointment.appointmentTime);
                                    return (
                                        <View key={appointment._id || appointment.id} style={[styles.appointmentCard, upcoming ? styles.cardUpcoming : styles.cardPast]}>
                                            <View style={styles.cardHeader}>
                                                <View style={styles.statusRow}>
                                                    <Text style={[styles.statusBadge, styles[`status${appointment.status?.toLowerCase()}`] || styles.statusPending]}>
                                                        {appointment.status?.toUpperCase() || 'PENDING'}
                                                    </Text>
                                                    {upcoming && <Text style={styles.upcomingBadge}>UPCOMING</Text>}
                                                </View>
                                            </View>

                                            <View style={styles.cardBody}>
                                                <View style={styles.doctorRow}>
                                                    <View style={styles.doctorIcon}><Text style={{ fontSize: 24 }}>👨‍⚕️</Text></View>
                                                    <View>
                                                        <Text style={styles.doctorName}>{appointment.doctorName}</Text>
                                                        {appointment.serviceName && <Text style={styles.serviceName}>{appointment.serviceName}</Text>}
                                                    </View>
                                                </View>

                                                <View style={styles.detailsList}>
                                                    <View style={styles.detailItem}>
                                                        <Text style={styles.detailIcon}>📅</Text>
                                                        <View><Text style={styles.detailLabel}>Date</Text><Text style={styles.detailValue}>{formatDate(appointment.appointmentDate)}</Text></View>
                                                    </View>
                                                    <View style={styles.detailItem}>
                                                        <Text style={styles.detailIcon}>🕐</Text>
                                                        <View><Text style={styles.detailLabel}>Time</Text><Text style={styles.detailValue}>{appointment.appointmentTime}</Text></View>
                                                    </View>
                                                </View>

                                                <View style={styles.cardFooter}>
                                                    <TouchableOpacity style={styles.btnSecondary} onPress={() => {
                                                        setSelectedAppointment(appointment);
                                                        setShowDetailsModal(true);
                                                    }}>
                                                        <Text style={styles.btnSecondaryText}>📄 View Details</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>📅</Text>
                                <Text style={styles.emptyTitle}>No Appointments Found</Text>
                                <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Services')}>
                                    <Text style={styles.btnPrimaryText}>Book New Appointment</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* --- DETAILS MODAL --- */}
            {showDetailsModal && selectedAppointment && (
                <Modal transparent visible animationType="fade" onRequestClose={() => setShowDetailsModal(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalHeaderTitle}>Appointment Details</Text>
                                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDetailsModal(false)}>
                                    <Text style={styles.closeBtnText}>×</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalBody}>
                                <View style={styles.infoGrid}>
                                    <Text style={styles.gridText}><Text style={styles.bold}>Doctor:</Text> {selectedAppointment.doctorName}</Text>
                                    <Text style={styles.gridText}><Text style={styles.bold}>Date:</Text> {formatDate(selectedAppointment.appointmentDate)}</Text>
                                    <Text style={styles.gridText}><Text style={styles.bold}>Time:</Text> {selectedAppointment.appointmentTime}</Text>
                                    <Text style={styles.gridText}><Text style={styles.bold}>Status:</Text> {selectedAppointment.status}</Text>
                                </View>

                                <View style={styles.hr} />

                                <View style={styles.detailSection}>
                                    <Text style={styles.sectionTitle}>🧬 Lab Tests Prescribed</Text>
                                    {selectedAppointment.labTests && selectedAppointment.labTests.length > 0 ? (
                                        <View style={styles.tagsContainer}>
                                            {selectedAppointment.labTests.map((lab, i) => (
                                                <View key={i} style={styles.tag}><Text style={styles.tagText}>{lab}</Text></View>
                                            ))}
                                        </View>
                                    ) : <Text style={styles.italicText}>No lab tests found.</Text>}
                                </View>

                                <View style={styles.detailSection}>
                                    <Text style={styles.sectionTitle}>🥗 Dietary Recommendations</Text>
                                    {selectedAppointment.dietPlan && selectedAppointment.dietPlan.length > 0 ? (
                                        selectedAppointment.dietPlan.map((item, i) => (
                                            <Text key={i} style={styles.listItem}>• {item}</Text>
                                        ))
                                    ) : <Text style={styles.italicText}>No diet plan found.</Text>}
                                </View>

                                <View style={styles.detailSection}>
                                    <Text style={styles.sectionTitle}>💊 Medications</Text>
                                    {selectedAppointment.pharmacy && selectedAppointment.pharmacy.length > 0 ? (
                                        <View style={styles.table}>
                                            <View style={styles.tableHeader}>
                                                <Text style={[styles.tableCell, styles.tableHeadText]}>Medicine</Text>
                                                <Text style={[styles.tableCell, styles.tableHeadText]}>Freq</Text>
                                                <Text style={[styles.tableCell, styles.tableHeadText]}>Dur</Text>
                                            </View>
                                            {selectedAppointment.pharmacy.map((med, i) => (
                                                <View key={i} style={styles.tableRow}>
                                                    <Text style={styles.tableCell}>{med.medicineName}</Text>
                                                    <Text style={styles.tableCell}>{med.frequency || '-'}</Text>
                                                    <Text style={styles.tableCell}>{med.duration || '-'}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : <Text style={styles.italicText}>No medications prescribed.</Text>}
                                </View>

                                <View style={styles.detailSection}>
                                    <Text style={styles.sectionTitle}>📝 Doctor's Notes</Text>
                                    {selectedAppointment.notes ? (
                                        <Text style={styles.notesBox}>{selectedAppointment.notes}</Text>
                                    ) : <Text style={styles.italicText}>No notes provided.</Text>}
                                </View>

                                <View style={styles.detailSection}>
                                    <Text style={styles.sectionTitle}>📂 Documents</Text>
                                    {(!selectedAppointment.prescriptions || selectedAppointment.prescriptions.length === 0) && !selectedAppointment.prescription ? (
                                        <Text style={styles.italicText}>No documents uploaded.</Text>
                                    ) : (
                                        <View style={styles.filesList}>
                                            {selectedAppointment.prescription && (!selectedAppointment.prescriptions || selectedAppointment.prescriptions.length === 0) && (
                                                <TouchableOpacity style={styles.fileLink} onPress={() => Linking.openURL(selectedAppointment.prescription)}>
                                                    <Text style={styles.fileLinkText}>📄 View Prescription</Text>
                                                </TouchableOpacity>
                                            )}
                                            {selectedAppointment.prescriptions?.map((file, i) => (
                                                <TouchableOpacity key={i} style={styles.fileLink} onPress={() => Linking.openURL(file.url)}>
                                                    <Text style={styles.fileLinkText}>📄 {file.name || `Document ${i + 1}`}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}

            {/* --- QUICK BOOKING MODAL (React Native Workaround for Selects) --- */}
            {showBookingModal && (
                <Modal transparent visible animationType="slide" onRequestClose={() => setShowBookingModal(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalHeaderTitle}>Book Appointment</Text>
                                <TouchableOpacity style={styles.closeBtn} onPress={() => setShowBookingModal(false)}>
                                    <Text style={styles.closeBtnText}>×</Text>
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={styles.modalBody}>
                                {error ? <Text style={styles.errorBox}>{error}</Text> : null}

                                {/* Simplified Native Forms for UI purposes. In real RN apps, @react-native-picker/picker is used. */}
                                <Text style={styles.formLabel}>Service ID (Requires Picker or TextInput)</Text>
                                <Text style={{ color: 'red', fontSize: 12, marginBottom: 15 }}>* Note: Standard RN requires Picker component. Replaced with placeholder for pixel-mapping constraints.</Text>

                                <TouchableOpacity
                                    style={styles.btnPrimary}
                                    disabled={isSubmitting}
                                    onPress={onModalFormSubmit}
                                >
                                    <Text style={styles.btnPrimaryText}>{isSubmitting ? 'Booking...' : 'Confirm'}</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    appointmentPage: {
        flex: 1,
        backgroundColor: '#F8F9FD',
    },
    contentWrapper: {
        padding: 20,
        paddingTop: 40,
        paddingBottom: 60,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#1E293B',
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    badge: {
        backgroundColor: 'rgba(20, 195, 142, 0.1)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginBottom: 20,
    },
    badgeText: {
        color: '#0A2647',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#0A2647',
        marginBottom: 10,
    },
    textGradient: {
        color: '#14C38E',
    },
    subtext: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 25,
    },
    btnPrimary: {
        backgroundColor: '#0A2647',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
    },
    btnPrimaryText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    filterContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 30,
        gap: 10,
    },
    filterBtn: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 20,
    },
    filterBtnActive: {
        backgroundColor: '#0A2647',
        borderColor: '#0A2647',
    },
    filterBtnText: {
        color: '#64748B',
        fontWeight: '600',
        fontSize: 14,
    },
    filterBtnTextActive: {
        color: '#FFFFFF',
    },
    listSection: {
        flex: 1,
    },
    appointmentsGrid: {
        flexDirection: 'column',
        gap: 20,
    },
    appointmentCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
        marginBottom: 15,
    },
    cardUpcoming: {
        borderLeftWidth: 5,
        borderLeftColor: '#14C38E',
    },
    cardPast: {
        borderLeftWidth: 5,
        borderLeftColor: '#cbd5e1',
        opacity: 0.9,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statusBadge: {
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 20,
        fontSize: 11,
        fontWeight: '700',
    },
    statuspending: { backgroundColor: '#fffbeb', color: '#d97706' },
    statusconfirmed: { backgroundColor: '#ecfdf5', color: '#059669' },
    statuscompleted: { backgroundColor: '#f0f9ff', color: '#0284c7' },
    statuscancelled: { backgroundColor: '#fef2f2', color: '#dc2626' },

    upcomingBadge: {
        backgroundColor: '#0A2647',
        color: '#FFFFFF',
        fontSize: 10,
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 4,
        fontWeight: '600',
    },
    doctorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        marginBottom: 15,
    },
    doctorIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#e0f2fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    doctorName: {
        fontSize: 16,
        color: '#0A2647',
        fontWeight: '700',
    },
    serviceName: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 2,
    },
    detailsList: {
        flexDirection: 'column',
        gap: 10,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    detailIcon: {
        color: '#14C38E',
        fontSize: 16,
    },
    detailLabel: {
        fontSize: 12,
        color: '#64748B',
    },
    detailValue: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '600',
    },
    cardFooter: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    btnSecondary: {
        paddingVertical: 10,
        borderWidth: 2,
        borderColor: '#0A2647',
        borderRadius: 50,
        alignItems: 'center',
    },
    btnSecondaryText: {
        color: '#0A2647',
        fontWeight: '600',
        fontSize: 14,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyIcon: {
        fontSize: 60,
        marginBottom: 20,
        opacity: 0.3,
    },
    emptyTitle: {
        color: '#0A2647',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 20,
    },

    /* Modal Styles */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(10, 38, 71, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        width: '100%',
        maxWidth: 700,
        borderRadius: 16,
        maxHeight: '85%',
        elevation: 10,
    },
    modalHeader: {
        paddingVertical: 20,
        paddingHorizontal: 30,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalHeaderTitle: {
        fontSize: 20,
        color: '#0A2647',
        fontWeight: '700',
    },
    closeBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    closeBtnText: {
        color: '#1E293B',
        fontSize: 18,
    },
    modalBody: {
        padding: 30,
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 20,
        backgroundColor: '#f8fafc',
        padding: 20,
        borderRadius: 12,
        marginBottom: 25,
    },
    gridText: {
        color: '#1E293B',
        fontSize: 14,
        width: '45%',
    },
    bold: {
        fontWeight: '700',
        color: '#0A2647',
    },
    hr: {
        height: 1,
        backgroundColor: '#eee',
        marginVertical: 15,
    },
    detailSection: {
        marginBottom: 25,
    },
    sectionTitle: {
        color: '#0A2647',
        fontSize: 16,
        fontWeight: '700',
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 8,
        marginBottom: 15,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    tagText: {
        color: '#1E293B',
        fontSize: 13,
    },
    italicText: {
        fontStyle: 'italic',
        color: '#888',
        fontSize: 14,
    },
    listItem: {
        fontSize: 14,
        color: '#555',
        marginBottom: 5,
    },
    table: {
        borderWidth: 1,
        borderColor: '#eee',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        padding: 10,
    },
    tableRow: {
        flexDirection: 'row',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tableCell: {
        flex: 1,
        fontSize: 13,
        color: '#1E293B',
    },
    tableHeadText: {
        fontWeight: '600',
        color: '#0A2647',
    },
    notesBox: {
        backgroundColor: '#fffbeb',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fcd34d',
        color: '#92400e',
        fontSize: 14,
    },
    filesList: {
        flexDirection: 'column',
        gap: 8,
    },
    fileLink: {
        padding: 12,
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    fileLinkText: {
        color: '#1E293B',
        fontWeight: '500',
        fontSize: 14,
    },
    formLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 8,
    },
    errorBox: {
        backgroundColor: '#fee2e2',
        color: '#b91c1c',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fca5a5',
        marginBottom: 20,
    }
});

export default Appointment;
