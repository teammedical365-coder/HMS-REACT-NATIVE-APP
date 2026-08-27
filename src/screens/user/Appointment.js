import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAppDispatch, useAuth, useAppointments, useCachedServices, useCachedDoctors } from '../../store/hooks';
import { fetchAppointments, createAppointment } from '../../store/slices/appointmentSlice';
import { fetchServices, fetchDoctors, fetchBookedSlots } from '../../store/slices/publicDataSlice';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker'; // You might need to install @react-native-picker/picker if not already present, fallback to simple modal if needed

// Base available time slots
const timeSlots = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30'
];

const Appointment = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useAppDispatch();
  const doctorId = route.params?.doctorId;
  
  // Redux state
  const { isAuthenticated, user } = useAuth();
  const { appointments, loading: appointmentsLoading } = useAppointments();
  const { services: servicesData } = useCachedServices();
  const { doctors: doctorsData } = useCachedDoctors();
  const bookedSlots = useSelector((state) => state.publicData.bookedSlots);
  
  const [filter, setFilter] = useState('all'); 
  
  // Booking form state
  const [formData, setFormData] = useState({
    appointmentDate: '',
    appointmentTime: '',
    notes: ''
  });
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Modal form state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [modalFormData, setModalFormData] = useState({
    serviceId: '',
    doctorId: '',
    appointmentDate: new Date().toISOString().split('T')[0],
    appointmentTime: ''
  });

  // --- NEW: Details Modal State ---
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  // --------------------------------

  useEffect(() => {
    dispatch(fetchServices());
    dispatch(fetchDoctors());
  }, [dispatch]);

  // --- AUTHENTICATION CHECK PRESERVED ---
  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigation.replace('Login', { redirect: 'Appointment' });
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

  // Fetch booked slots when doctor or date changes
  useEffect(() => {
    const currentDoctorId = modalFormData.doctorId || (selectedDoctor ? (selectedDoctor._id || selectedDoctor.doctorId) : null);
    const currentDate = modalFormData.appointmentDate || formData.appointmentDate;

    if (currentDoctorId && currentDate) {
      dispatch(fetchBookedSlots({ doctorId: currentDoctorId, date: currentDate }));
    }
  }, [modalFormData.doctorId, modalFormData.appointmentDate, selectedDoctor, formData.appointmentDate, dispatch]);

  const updateAvailableTimes = useCallback((selectedDate) => {
    if (!selectedDate) {
      setAvailableTimes([]);
      return;
    }

    let times = [...timeSlots];

    // Filter by Booked Slots
    if (bookedSlots && bookedSlots.length > 0) {
      times = times.filter(t => !bookedSlots.includes(t));
    }

    // Filter by Doctor's Schedule
    const currentDoctorId = modalFormData.doctorId || (selectedDoctor ? (selectedDoctor._id || selectedDoctor.doctorId) : null);
    
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

    // Filter by Current Time (if Today)
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
  }, [modalFormData.doctorId, doctorsData, selectedDoctor, bookedSlots]);

  useEffect(() => {
    if (modalFormData.serviceId && doctorsData.length > 0) {
      const filtered = doctorsData.filter(doc => 
        doc.services && doc.services.some(s => s === modalFormData.serviceId || s.id === modalFormData.serviceId)
      );
      setAvailableDoctors(filtered.length > 0 ? filtered : doctorsData);
      setModalFormData(prev => ({ ...prev, doctorId: '', appointmentTime: '' }));
    } else {
      setAvailableDoctors(doctorsData);
      setModalFormData(prev => ({ ...prev, doctorId: '' }));
    }
  }, [modalFormData.serviceId, doctorsData]);

  useEffect(() => {
    if (modalFormData.appointmentDate) {
      updateAvailableTimes(modalFormData.appointmentDate);
    } else {
      setAvailableTimes([]);
      setModalFormData(prev => ({ ...prev, appointmentTime: '' }));
    }
  }, [modalFormData.doctorId, modalFormData.appointmentDate, updateAvailableTimes]);
  
  useEffect(() => {
      if (selectedDoctor && formData.appointmentDate) {
          updateAvailableTimes(formData.appointmentDate);
      }
  }, [selectedDoctor, formData.appointmentDate, updateAvailableTimes, bookedSlots]);

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 14);
    return maxDate.toISOString().split('T')[0];
  };

  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const onModalFormSubmit = async () => {
    setError('');
    
    if (!modalFormData.appointmentTime || !modalFormData.serviceId || !modalFormData.doctorId) {
        setError('Please fill all required fields.');
        return;
    }

    setIsSubmitting(true);

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setError('You must be logged in to book an appointment');
        setIsSubmitting(false);
        navigation.replace('Login', { redirect: 'Appointment' });
        return;
      }

      const selectedService = servicesData.find(s => s.id === modalFormData.serviceId || s._id === modalFormData.serviceId);
      const selectedDoc = doctorsData.find(d => 
        d._id === modalFormData.doctorId || d.doctorId === modalFormData.doctorId
      );

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
        appointmentDate: modalFormData.appointmentDate,
        appointmentTime: modalFormData.appointmentTime,
        amount: (selectedService && selectedService.price) ? selectedService.price : (selectedDoc.consultationFee || 500),
        notes: ''
      };

      const result = await dispatch(createAppointment(appointmentData));
      
      if (createAppointment.fulfilled.match(result)) {
        setShowBookingModal(false);
        setModalFormData({ serviceId: '', doctorId: '', appointmentDate: new Date().toISOString().split('T')[0], appointmentTime: '' });
        setAvailableDoctors([]);
        setAvailableTimes([]);
        dispatch(fetchAppointments());
        if (selectedDoctor && modalFormData.appointmentDate) {
          dispatch(fetchBookedSlots({ doctorId: selectedDoctor, date: modalFormData.appointmentDate }));
        }
      } else {
        setError(result.payload || 'Failed to book appointment.');
      }
    } catch (err) {
      setError(err.message || 'Failed to book appointment.');
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

  const handleInputChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleBookingFormSubmit = async () => {
    setError('');

    if (!formData.appointmentDate || !formData.appointmentTime) {
      setError('Please select both date and time');
      return;
    }

    const selectedDate = new Date(formData.appointmentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      setError('Please select a future date');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedService = selectedDoctor.services && selectedDoctor.services[0] 
        ? servicesData.find(s => s.id === selectedDoctor.services[0])
        : null;

      const appointmentData = {
        doctorId: selectedDoctor._id, 
        doctorName: selectedDoctor.name,
        serviceId: selectedService ? selectedService.id : (selectedDoctor.services ? selectedDoctor.services[0] : ''),
        serviceName: selectedService ? selectedService.title : '',
        appointmentDate: formData.appointmentDate,
        appointmentTime: formData.appointmentTime,
        amount: selectedDoctor.consultationFee || 500,
        notes: formData.notes
      };

      const result = await dispatch(createAppointment(appointmentData));

      if (createAppointment.fulfilled.match(result)) {
        dispatch(fetchAppointments());
        setFormData({ appointmentDate: '', appointmentTime: '', notes: '' });
        navigation.setParams({ doctorId: undefined });
        setSelectedDoctor(null);
      } else {
        setError(result.payload || 'Failed to create appointment');
      }
    } catch (err) {
      console.error('Appointment creation error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleViewDetails = (apt) => {
    setSelectedAppointment(apt);
    setShowDetailsModal(true);
  };

  const isUpcoming = (appointmentDate, appointmentTime) => {
    if (!appointmentDate || !appointmentTime) return false;
    const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
    return appointmentDateTime >= new Date();
  };

  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#333' }}>Loading your appointments...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      
      <View style={styles.header}>
        <View style={styles.badge}><Text style={styles.badgeText}>My Appointments</Text></View>
        <Text style={styles.title}>Your Appointments</Text>
        <Text style={styles.subtitle}>View and manage all your appointments in one place.</Text>
        <TouchableOpacity 
          style={styles.btnPrimary}
          onPress={() => {
            setShowBookingModal(true);
            setModalFormData({ serviceId: '', doctorId: '', appointmentDate: new Date().toISOString().split('T')[0], appointmentTime: '' });
            setAvailableDoctors([]);
            setAvailableTimes([]);
            setError('');
          }}
        >
          <Text style={styles.btnPrimaryText}>➕ Book New Appointment</Text>
        </TouchableOpacity>
      </View>

      {doctorId && selectedDoctor && (
        <View style={styles.bookingFormSection}>
          <View style={styles.bookingFormHeader}>
            <Text style={styles.bookingFormTitle}>Schedule Appointment with {selectedDoctor.name}</Text>
            <TouchableOpacity onPress={() => { navigation.setParams({ doctorId: undefined }); setSelectedDoctor(null); }}>
              <Text style={styles.btnClose}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Select Date (YYYY-MM-DD)</Text>
            {/* Note: React Native TextInput for date is tricky, simplified to plain text for this migration, ideally use DateTimePicker */}
            <TextInput 
              style={styles.input}
              value={formData.appointmentDate}
              onChangeText={(v) => handleInputChange('appointmentDate', v)}
              placeholder="YYYY-MM-DD"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Select Time</Text>
            {availableTimes.length > 0 ? (
              <View style={styles.timeSlotsGrid}>
                {availableTimes.map(t => (
                  <TouchableOpacity 
                    key={t}
                    style={[styles.timeSlotBtn, formData.appointmentTime === t && styles.timeSlotBtnActive]}
                    onPress={() => handleInputChange('appointmentTime', t)}
                  >
                    <Text style={[styles.timeSlotText, formData.appointmentTime === t && styles.timeSlotTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.errorText}>No slots available for this date.</Text>
            )}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity 
            style={[styles.btnPrimary, (isSubmitting || !formData.appointmentTime || availableTimes.length === 0) && styles.btnDisabled]}
            onPress={handleBookingFormSubmit}
            disabled={isSubmitting || !formData.appointmentTime || availableTimes.length === 0}
          >
            <Text style={styles.btnPrimaryText}>{isSubmitting ? 'Booking...' : 'Confirm Appointment'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!doctorId && (
        <View style={styles.filterSection}>
          <TouchableOpacity style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]} onPress={() => setFilter('all')}>
            <Text style={[styles.filterBtnText, filter === 'all' && styles.filterBtnTextActive]}>All Appointments</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, filter === 'upcoming' && styles.filterBtnActive]} onPress={() => setFilter('upcoming')}>
            <Text style={[styles.filterBtnText, filter === 'upcoming' && styles.filterBtnTextActive]}>Upcoming</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, filter === 'past' && styles.filterBtnActive]} onPress={() => setFilter('past')}>
            <Text style={[styles.filterBtnText, filter === 'past' && styles.filterBtnTextActive]}>Past</Text>
          </TouchableOpacity>
        </View>
      )}

      {!doctorId && (
        <View style={styles.listSection}>
          {appointmentsLoading ? (
            <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 20 }} />
          ) : sortedAppointments.length > 0 ? (
            <View style={styles.appointmentsGrid}>
              {sortedAppointments.map((appointment) => {
                const upcoming = isUpcoming(appointment.appointmentDate, appointment.appointmentTime);
                return (
                  <View key={appointment._id || appointment.id} style={[styles.aptCard, upcoming ? styles.aptCardUpcoming : styles.aptCardPast]}>
                    <View style={styles.aptCardHeader}>
                      <View style={styles.aptStatus}>
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusBadgeText}>{appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}</Text>
                        </View>
                        {upcoming && <View style={styles.upcomingBadge}><Text style={styles.upcomingBadgeText}>Upcoming</Text></View>}
                      </View>
                    </View>

                    <View style={styles.aptCardBody}>
                      <View style={styles.aptDoctor}>
                        <Text style={styles.doctorIcon}>👨‍⚕️</Text>
                        <View>
                          <Text style={styles.doctorName}>{appointment.doctorName}</Text>
                          {appointment.serviceName && <Text style={styles.serviceName}>{appointment.serviceName}</Text>}
                        </View>
                      </View>

                      <View style={styles.aptDetailsList}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailIcon}>📅</Text>
                          <View>
                            <Text style={styles.detailLabel}>Date</Text>
                            <Text style={styles.detailValue}>{formatDate(appointment.appointmentDate)}</Text>
                          </View>
                        </View>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailIcon}>🕐</Text>
                          <View>
                            <Text style={styles.detailLabel}>Time</Text>
                            <Text style={styles.detailValue}>{appointment.appointmentTime}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 16 }}>
                        <TouchableOpacity style={styles.btnSecondary} onPress={() => handleViewDetails(appointment)}>
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
              <Text style={{ fontSize: 48, marginBottom: 16 }}>📅</Text>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 16 }}>No Appointments Found</Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Services')}>
                <Text style={styles.btnPrimaryText}>Book New Appointment</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* BOOKING MODAL */}
      <Modal visible={showBookingModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Book New Appointment</Text>
              <TouchableOpacity onPress={() => setShowBookingModal(false)}>
                <Text style={styles.btnClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Fallback to simple selection via Picker or simplified input for RN */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Service * (Enter ID or Name)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="E.g. general"
                    value={modalFormData.serviceId}
                    onChangeText={v => setModalFormData(prev => ({...prev, serviceId: v}))}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Doctor ID *</Text>
                <TextInput
                    style={styles.input}
                    value={modalFormData.doctorId}
                    onChangeText={v => setModalFormData(prev => ({...prev, doctorId: v}))}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Date * (YYYY-MM-DD)</Text>
                <TextInput
                    style={styles.input}
                    value={modalFormData.appointmentDate}
                    onChangeText={v => setModalFormData(prev => ({...prev, appointmentDate: v}))}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Time *</Text>
                {availableTimes.length > 0 ? (
                  <View style={styles.timeSlotsGrid}>
                    {availableTimes.map(t => (
                      <TouchableOpacity 
                        key={t}
                        style={[styles.timeSlotBtn, modalFormData.appointmentTime === t && styles.timeSlotBtnActive]}
                        onPress={() => setModalFormData(prev => ({...prev, appointmentTime: t}))}
                      >
                        <Text style={[styles.timeSlotText, modalFormData.appointmentTime === t && styles.timeSlotTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.errorText}>No slots available.</Text>
                )}
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity 
                style={[styles.btnPrimary, { marginTop: 20 }, (isSubmitting || availableTimes.length === 0 || !modalFormData.appointmentTime) && styles.btnDisabled]}
                onPress={onModalFormSubmit}
                disabled={isSubmitting || availableTimes.length === 0 || !modalFormData.appointmentTime}
              >
                <Text style={styles.btnPrimaryText}>{isSubmitting ? 'Booking...' : 'Confirm'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DETAILS MODAL */}
      <Modal visible={showDetailsModal && !!selectedAppointment} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Appointment Details</Text>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <Text style={styles.btnClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedAppointment && (
              <ScrollView>
                <View style={styles.detailsInfoGrid}>
                  <Text style={styles.detailText}><Text style={{ fontWeight: 'bold' }}>Doctor:</Text> {selectedAppointment.doctorName}</Text>
                  <Text style={styles.detailText}><Text style={{ fontWeight: 'bold' }}>Date:</Text> {formatDate(selectedAppointment.appointmentDate)}</Text>
                  <Text style={styles.detailText}><Text style={{ fontWeight: 'bold' }}>Time:</Text> {selectedAppointment.appointmentTime}</Text>
                  <Text style={styles.detailText}><Text style={{ fontWeight: 'bold' }}>Status:</Text> {selectedAppointment.status}</Text>
                </View>

                <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 16 }} />

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>🧬 Lab Tests Prescribed</Text>
                  {selectedAppointment.labTests && selectedAppointment.labTests.length > 0 ? (
                    <View style={styles.tagsContainer}>
                      {selectedAppointment.labTests.map((lab, i) => (
                        <View key={i} style={styles.tag}><Text style={styles.tagText}>{lab}</Text></View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyDataText}>No lab tests found.</Text>
                  )}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>🥗 Dietary Recommendations</Text>
                  {selectedAppointment.dietPlan && selectedAppointment.dietPlan.length > 0 ? (
                    <View style={{ gap: 4 }}>
                      {selectedAppointment.dietPlan.map((item, i) => (
                        <Text key={i} style={styles.listItem}>• {item}</Text>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyDataText}>No diet plan found.</Text>
                  )}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>💊 Medications</Text>
                  {selectedAppointment.pharmacy && selectedAppointment.pharmacy.length > 0 ? (
                    <View style={styles.table}>
                      <View style={styles.tableHeader}>
                        <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>Medicine</Text>
                        <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>Freq.</Text>
                        <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>Dur.</Text>
                      </View>
                      {selectedAppointment.pharmacy.map((med, i) => (
                        <View key={i} style={styles.tableRow}>
                          <Text style={[styles.tableCell, { flex: 2 }]}>{med.medicineName}</Text>
                          <Text style={styles.tableCell}>{med.frequency || '-'}</Text>
                          <Text style={styles.tableCell}>{med.duration || '-'}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.emptyDataText}>No medications prescribed.</Text>
                  )}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>📝 Doctor's Notes</Text>
                  {selectedAppointment.notes ? (
                    <Text style={styles.notesText}>{selectedAppointment.notes}</Text>
                  ) : (
                    <Text style={styles.emptyDataText}>No notes provided.</Text>
                  )}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>📂 Documents & Prescriptions</Text>
                  {(!selectedAppointment.prescriptions || selectedAppointment.prescriptions.length === 0) && !selectedAppointment.prescription ? (
                    <Text style={styles.emptyDataText}>No documents uploaded.</Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {selectedAppointment.prescription && (!selectedAppointment.prescriptions || selectedAppointment.prescriptions.length === 0) && (
                        <Text style={styles.fileLink}>📄 View Prescription</Text>
                      )}
                      {selectedAppointment.prescriptions?.map((file, i) => (
                        <Text key={i} style={styles.fileLink}>📄 {file.name || `Document ${i+1}`}</Text>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { alignItems: 'center', marginBottom: 30 },
  badge: { backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  badgeText: { color: '#2563eb', fontWeight: 'bold', fontSize: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 20 },
  btnPrimary: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  btnSecondary: { backgroundColor: '#f1f5f9', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnSecondaryText: { color: '#475569', fontWeight: 'bold', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  bookingFormSection: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#e2e8f0' },
  bookingFormHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  bookingFormTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  btnClose: { fontSize: 20, color: '#94a3b8' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, backgroundColor: '#fff', fontSize: 15 },
  timeSlotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeSlotBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  timeSlotBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  timeSlotText: { color: '#475569', fontWeight: '600' },
  timeSlotTextActive: { color: '#fff' },
  errorText: { color: '#ef4444', marginBottom: 16, fontSize: 14 },
  filterSection: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 24 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
  filterBtnActive: { backgroundColor: '#2563eb' },
  filterBtnText: { color: '#475569', fontWeight: '600' },
  filterBtnTextActive: { color: '#fff' },
  listSection: { gap: 16 },
  aptCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  aptCardUpcoming: { borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
  aptCardPast: { borderLeftWidth: 4, borderLeftColor: '#94a3b8' },
  aptCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  aptStatus: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#f1f5f9' },
  statusBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#475569' },
  upcomingBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  upcomingBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#2563eb' },
  aptDoctor: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  doctorIcon: { fontSize: 32 },
  doctorName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  serviceName: { fontSize: 14, color: '#64748b' },
  aptDetailsList: { gap: 12 },
  detailItem: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  detailIcon: { fontSize: 20 },
  detailLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  detailValue: { fontSize: 15, color: '#1e293b', fontWeight: '500' },
  emptyState: { alignItems: 'center', padding: 40, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  detailsInfoGrid: { gap: 8, marginBottom: 16 },
  detailText: { fontSize: 15, color: '#334155' },
  detailSection: { marginBottom: 20 },
  detailSectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#e0e7ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tagText: { color: '#4338ca', fontSize: 13, fontWeight: '600' },
  emptyDataText: { fontStyle: 'italic', color: '#94a3b8' },
  listItem: { fontSize: 14, color: '#475569', marginBottom: 4 },
  table: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableRow: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableCell: { flex: 1, fontSize: 13, color: '#334155' },
  notesText: { fontSize: 14, color: '#475569', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8 },
  fileLink: { fontSize: 14, color: '#2563eb', textDecorationLine: 'underline', marginBottom: 4 }
});

export default Appointment;
