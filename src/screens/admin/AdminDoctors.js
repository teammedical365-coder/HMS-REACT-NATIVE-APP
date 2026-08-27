import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, TextInput, 
    StyleSheet, Alert, Dimensions, Modal, ActivityIndicator, Image
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAuth, useAdminEntities } from '../../store/hooks';
import { fetchAdminDoctors, createDoctor, updateDoctor, deleteDoctor } from '../../store/slices/adminEntitiesSlice';
import { adminEntitiesAPI, hospitalAPI } from '../../utils/api';
import { getSubscriptionLimits } from '../../utils/subscriptionPlans';
import PasswordInput from '../../components/PasswordInput';
import { Feather } from '@expo/vector-icons';

const AdminDoctors = () => {
    const navigation = useNavigation();
    const dispatch = useAppDispatch();
    const { user } = useAuth();
    const { doctors: doctorsState } = useAdminEntities();

    const doctors = doctorsState.data || [];
    const loadingData = doctorsState.loading;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editingDoctor, setEditingDoctor] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [hospital, setHospital] = useState(null);

    useEffect(() => {
        const fetchHospital = async () => {
            try {
                const res = await hospitalAPI.getMyHospital();
                if (res.success && res.hospital) {
                    setHospital(res.hospital);
                }
            } catch (err) {
                console.error('Error fetching hospital:', err);
            }
        };
        if (user?.role === 'hospitaladmin') {
            fetchHospital();
        }
    }, [user]);

    // Viewing doctor details modal state
    const [viewingDoctor, setViewingDoctor] = useState(null);
    const [loadingDoctorDetails, setLoadingDoctorDetails] = useState(false);
    const [viewDoctorError, setViewDoctorError] = useState('');

    // Default Availability Structure
    const defaultAvailability = {
        monday: { available: false, startTime: '09:00', endTime: '17:00' },
        tuesday: { available: false, startTime: '09:00', endTime: '17:00' },
        wednesday: { available: false, startTime: '09:00', endTime: '17:00' },
        thursday: { available: false, startTime: '09:00', endTime: '17:00' },
        friday: { available: false, startTime: '09:00', endTime: '17:00' },
        saturday: { available: false, startTime: '09:00', endTime: '17:00' },
        sunday: { available: false, startTime: '09:00', endTime: '17:00' }
    };

    const initialFormState = {
        name: '',
        email: '',
        phone: '',
        password: '',
        gender: '',
        specialty: '',
        experience: '',
        education: '',
        services: [],
        departments: [],
        availability: defaultAvailability,
        successRate: '90%',
        patientsCount: '100+',
        image: '👨‍⚕️',
        bio: '',
        consultationFee: '0'
    };

    const [formData, setFormData] = useState(initialFormState);

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    const isHospitalAdmin = user?.role === 'hospitaladmin';

    useEffect(() => {
        if (!user || !['admin', 'hospitaladmin'].includes(user.role)) {
            navigation.navigate('Home'); // fallback
            return;
        }
        dispatch(fetchAdminDoctors());
    }, [navigation, user, dispatch]);

    useEffect(() => {
        if (doctorsState.error) setError(doctorsState.error);
    }, [doctorsState.error]);

    useEffect(() => {
        if (!editingDoctor && formData.departments && formData.departments.length > 0) {
            const selectedDept = formData.departments[0];
            if (hospital && hospital.departmentFees && hospital.departmentFees[selectedDept] !== undefined) {
                setFormData(prev => ({
                    ...prev,
                    consultationFee: String(hospital.departmentFees[selectedDept])
                }));
            }
        }
    }, [formData.departments, hospital, editingDoctor]);

    const handleChange = (name, value) => {
        setFormData({ ...formData, [name]: value });
        setError('');
        setSuccess('');
    };

    const handleAvailabilityChange = (day, field, value) => {
        setFormData(prev => ({
            ...prev,
            availability: {
                ...prev.availability,
                [day]: {
                    ...prev.availability[day],
                    [field]: field === 'available' ? value : value
                }
            }
        }));
    };

    const handleSubmit = async () => {
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (editingDoctor) {
                const result = await dispatch(updateDoctor({ id: editingDoctor._id, doctorData: formData }));
                if (updateDoctor.fulfilled.match(result)) {
                    setSuccess('Doctor updated successfully');
                    resetForm();
                    dispatch(fetchAdminDoctors());
                } else {
                    setError(result.payload || 'Failed to update doctor');
                }
            } else {
                if (!formData.name || !formData.email) {
                    setError('Name and email are required');
                    setLoading(false);
                    return;
                }
                if (!formData.password || formData.password.length < 6) {
                    setError('Password is required and must be at least 6 characters');
                    setLoading(false);
                    return;
                }

                const doctorData = {
                    ...formData,
                    consultationFee: formData.consultationFee ? Number(formData.consultationFee) : 0
                };

                const result = await dispatch(createDoctor(doctorData));
                if (createDoctor.fulfilled.match(result)) {
                    setSuccess('Doctor created successfully.');
                    resetForm();
                    dispatch(fetchAdminDoctors());
                } else {
                    setError(result.payload || 'Failed to create doctor');
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving doctor');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (id) => {
        setLoadingDoctorDetails(true);
        setViewDoctorError('');
        setViewingDoctor(null);
        try {
            const res = await adminEntitiesAPI.getDoctor(id);
            if (res.success && res.doctor) {
                setViewingDoctor(res.doctor);
            } else {
                setViewDoctorError(res.message || 'Failed to load doctor profile details.');
            }
        } catch (err) {
            setViewDoctorError(err.response?.data?.message || 'Error fetching doctor profile details.');
        } finally {
            setLoadingDoctorDetails(false);
        }
    };

    const renderAvailability = (availability) => {
        if (!availability) return <Text style={{ color: '#475569', fontSize: 13 }}>No availability defined</Text>;
        const activeDays = Object.entries(availability).filter(([_, info]) => info.available);
        if (activeDays.length === 0) return <Text style={{ color: '#475569', fontSize: 13 }}>Not available (No active days)</Text>;
        return (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {activeDays.map(([day, info]) => (
                    <View key={day} style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 }}>
                        <Text style={{ textTransform: 'capitalize', color: '#1e293b', fontWeight: 'bold', fontSize: 11 }}>{day}</Text>
                        <Text style={{ color: '#64748b', fontSize: 11 }}>{info.startTime} - {info.endTime}</Text>
                    </View>
                ))}
            </View>
        );
    };

    const handleEdit = (doctor) => {
        setEditingDoctor(doctor);

        const mergedAvailability = { ...defaultAvailability };
        if (doctor.availability) {
            Object.keys(doctor.availability).forEach(day => {
                if (mergedAvailability[day]) {
                    mergedAvailability[day] = { ...mergedAvailability[day], ...doctor.availability[day] };
                }
            });
        }

        setFormData({
            name: doctor.name || doctor.userId?.name || '',
            email: doctor.email,
            phone: doctor.phone || '',
            password: '',
            gender: doctor.userId?.gender || '',
            specialty: doctor.specialty || '',
            experience: doctor.experience || '',
            education: doctor.education || '',
            services: doctor.services || [],
            departments: doctor.departments || [],
            availability: mergedAvailability,
            successRate: doctor.successRate || '90%',
            patientsCount: doctor.patientsCount || '100+',
            image: doctor.image || '👨‍⚕️',
            bio: doctor.bio || '',
            consultationFee: doctor.consultationFee ? String(doctor.consultationFee) : '0'
        });
        setShowForm(true);
    };

    const handleDelete = (id) => {
        Alert.alert('Confirm Delete', 'Are you sure you want to delete this doctor?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                await dispatch(deleteDoctor(id));
                setSuccess('Doctor deleted successfully');
                dispatch(fetchAdminDoctors());
            }}
        ]);
    };

    const resetForm = () => {
        setFormData(initialFormState);
        setEditingDoctor(null);
        setShowForm(false);
    };

    // Department Breakdown
    const deptMap = {};
    doctors.forEach(doc => {
        const depts = doc.departments?.length ? doc.departments : [doc.specialty || 'Unassigned'];
        depts.forEach(dept => {
            deptMap[dept] = (deptMap[dept] || 0) + 1;
        });
    });

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                        >
                            <Feather name="arrow-left" size={14} color="#64748b" />
                            <Text style={styles.backButtonText}>Back to {isHospitalAdmin ? 'Hospital Admin' : 'Dashboard'}</Text>
                        </TouchableOpacity>
                        <Text style={styles.pageTitle}>Manage Doctors</Text>
                        <Text style={styles.pageSubtitle}>Add and manage doctor profiles for the user platform.</Text>
                    </View>
                    
                    <View style={styles.headerRight}>
                        {hospital && (hospital.subscriptionPlan === 'clinic_basic' || hospital.subscriptionPlan === 'multi_speciality_starter') && (() => {
                            const limits = getSubscriptionLimits(hospital.subscriptionPlan);
                            const maxDoctors = limits.maxDoctors;
                            const doctorCount = doctors.length;
                            const remaining = Math.max(0, maxDoctors - doctorCount);
                            
                            return (
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={styles.quotaBox}>
                                        <Text style={styles.quotaLabel}>Doctors</Text>
                                        <Text style={styles.quotaValue}>{doctorCount} / {maxDoctors} Used</Text>
                                    </View>
                                    <View style={[styles.quotaBox, { backgroundColor: remaining === 0 ? '#fee2e2' : '#f0fdf4', borderColor: remaining === 0 ? '#fecaca' : '#bbf7d0' }]}>
                                        <Text style={[styles.quotaLabel, { color: remaining === 0 ? '#dc2626' : '#16a34a' }]}>Remaining</Text>
                                        <Text style={[styles.quotaValue, { color: remaining === 0 ? '#dc2626' : '#16a34a' }]}>{remaining}</Text>
                                    </View>
                                </View>
                            );
                        })()}

                        <TouchableOpacity 
                            onPress={() => setShowForm(!showForm)} 
                            style={[styles.btnPrimary, (() => {
                                if (hospital && (hospital.subscriptionPlan === 'clinic_basic' || hospital.subscriptionPlan === 'multi_speciality_starter')) {
                                    const limits = getSubscriptionLimits(hospital.subscriptionPlan);
                                    if (doctors.length >= limits.maxDoctors) return { backgroundColor: '#94a3b8' };
                                }
                                return {};
                            })()]}
                            disabled={(() => {
                                if (hospital && (hospital.subscriptionPlan === 'clinic_basic' || hospital.subscriptionPlan === 'multi_speciality_starter')) {
                                    const limits = getSubscriptionLimits(hospital.subscriptionPlan);
                                    return doctors.length >= limits.maxDoctors;
                                }
                                return false;
                            })()}
                        >
                            <Text style={styles.btnPrimaryText}>{showForm ? 'Cancel' : '+ Add Doctor'}</Text>
                        </TouchableOpacity>

                        {hospital && (hospital.subscriptionPlan === 'clinic_basic' || hospital.subscriptionPlan === 'multi_speciality_starter') && (() => {
                            const limits = getSubscriptionLimits(hospital.subscriptionPlan);
                            if (doctors.length >= limits.maxDoctors && !showForm) {
                                return (
                                    <Text style={{ color: '#be123c', fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>
                                        ⚠️ Doctor quota reached. Upgrade to add more.
                                    </Text>
                                );
                            }
                            return null;
                        })()}
                    </View>
                </View>

                {error ? <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{error}</Text></View> : null}
                {success ? <View style={styles.successBanner}><Text style={styles.successBannerText}>{success}</Text></View> : null}

                {showForm && (
                    <View style={styles.formCard}>
                        <Text style={styles.formCardTitle}>{editingDoctor ? `Edit: ${editingDoctor.name || editingDoctor.userId?.name}` : 'Add New Doctor'}</Text>
                        
                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Name *</Text>
                                <TextInput style={styles.input} value={formData.name} onChangeText={t => handleChange('name', t)} />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Email *</Text>
                                <TextInput style={styles.input} value={formData.email} onChangeText={t => handleChange('email', t)} keyboardType="email-address" />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Phone *</Text>
                                <TextInput 
                                    style={styles.input} 
                                    value={formData.phone} 
                                    onChangeText={t => handleChange('phone', t.replace(/\D/g, '').slice(0, 10))} 
                                    keyboardType="phone-pad" 
                                    maxLength={10} 
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>{editingDoctor ? 'New Password' : 'Password *'}</Text>
                                {/* Note: Assuming PasswordInput handles its own styling, falling back to TextInput just in case */}
                                <TextInput style={styles.input} value={formData.password} onChangeText={t => handleChange('password', t)} placeholder="Min 6 characters" secureTextEntry />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                                <Text style={styles.label}>Gender</Text>
                                {/* Simple text input fallback since native picker requires separate library */}
                                <TextInput style={styles.input} value={formData.gender} onChangeText={t => handleChange('gender', t)} placeholder="Male, Female, or Other" />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Specialty</Text>
                                <TextInput style={styles.input} value={formData.specialty} onChangeText={t => handleChange('specialty', t)} placeholder="e.g. IVF Specialist" />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Experience</Text>
                                <TextInput style={styles.input} value={formData.experience} onChangeText={t => handleChange('experience', t)} placeholder="e.g. 10 Years" />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Education</Text>
                                <TextInput style={styles.input} value={formData.education} onChangeText={t => handleChange('education', t)} placeholder="e.g. MBBS, MD" />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Consultation Fee (₹)</Text>
                                <TextInput style={styles.input} value={formData.consultationFee} onChangeText={t => handleChange('consultationFee', t)} placeholder="e.g. 500" keyboardType="numeric" />
                            </View>
                        </View>

                        {hospital && hospital.departments && hospital.departments.length > 0 && (
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Assign Department (Optional - type exactly as exists)</Text>
                                <TextInput 
                                    style={styles.input} 
                                    value={formData.departments && formData.departments.length > 0 ? formData.departments[0] : ''} 
                                    onChangeText={t => setFormData({ ...formData, departments: t ? [t] : [] })} 
                                    placeholder="e.g. Cardiology" 
                                />
                            </View>
                        )}

                        <View style={styles.formGroup}>
                            <Text style={styles.sectionLabel}>Weekly Availability & Timing</Text>
                            <View style={styles.availabilityGrid}>
                                {days.map(day => (
                                    <View key={day} style={styles.availabilityDay}>
                                        <TouchableOpacity 
                                            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}
                                            onPress={() => handleAvailabilityChange(day, 'available', !(formData.availability?.[day]?.available))}
                                        >
                                            <View style={[styles.checkbox, formData.availability?.[day]?.available && styles.checkboxChecked]}>
                                                {formData.availability?.[day]?.available && <Feather name="check" size={12} color="#fff" />}
                                            </View>
                                            <Text style={styles.dayLabel}>{day}</Text>
                                        </TouchableOpacity>

                                        {formData.availability?.[day]?.available && (
                                            <View style={styles.timeInputs}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.timeLabel}>Start</Text>
                                                    <TextInput 
                                                        style={styles.timeInput}
                                                        value={formData.availability?.[day]?.startTime || ''}
                                                        onChangeText={t => handleAvailabilityChange(day, 'startTime', t)}
                                                        placeholder="09:00"
                                                    />
                                                </View>
                                                <Text style={{ alignSelf: 'flex-end', marginBottom: 8, marginHorizontal: 4 }}>to</Text>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.timeLabel}>End</Text>
                                                    <TextInput 
                                                        style={styles.timeInput}
                                                        value={formData.availability?.[day]?.endTime || ''}
                                                        onChangeText={t => handleAvailabilityChange(day, 'endTime', t)}
                                                        placeholder="17:00"
                                                    />
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Bio</Text>
                            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={formData.bio} onChangeText={t => handleChange('bio', t)} multiline placeholder="Doctor's profile bio..." />
                        </View>

                        <View style={styles.formActions}>
                            <TouchableOpacity onPress={resetForm} style={styles.btnSecondary}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSubmit} disabled={loading} style={styles.btnPrimarySubmit}>
                                <Text style={styles.btnPrimaryText}>{loading ? 'Saving...' : editingDoctor ? 'Update Profile' : 'Create Doctor'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Department Breakdown */}
                {doctors.length > 0 && Object.keys(deptMap).length > 0 && (
                    <View style={styles.deptCard}>
                        <Text style={styles.deptCardTitle}>Doctors by Department</Text>
                        <View style={styles.deptGrid}>
                            {Object.entries(deptMap).sort((a, b) => b[1] - a[1]).map(([dept, count]) => (
                                <View key={dept} style={styles.deptBadge}>
                                    <Text style={styles.deptCount}>{count}</Text>
                                    <Text style={styles.deptName}>{dept}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Doctor List */}
                <View style={styles.tableCard}>
                    <Text style={styles.tableTitle}>All Doctors</Text>
                    {loadingData ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#3b82f6" />
                            <Text style={{ color: '#64748b', marginTop: 10 }}>Loading doctors...</Text>
                        </View>
                    ) : doctors.length === 0 ? (
                        <Text style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>No doctors found.</Text>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ minWidth: 800 }}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { flex: 2 }]}>Name</Text>
                                    <Text style={[styles.th, { flex: 2 }]}>Email</Text>
                                    <Text style={[styles.th, { flex: 1.5 }]}>Specialty</Text>
                                    <Text style={[styles.th, { flex: 2 }]}>Departments</Text>
                                    <Text style={[styles.th, { flex: 2, textAlign: 'center' }]}>Actions</Text>
                                </View>
                                {doctors.map((doctor) => (
                                    <View key={doctor._id} style={styles.tableRow}>
                                        <View style={[styles.td, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                                            <Text>{doctor.image || '👨‍⚕️'}</Text>
                                            <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>{doctor.name || doctor.userId?.name || 'Unknown Name'}</Text>
                                        </View>
                                        <Text style={[styles.td, { flex: 2 }]}>{doctor.email}</Text>
                                        <Text style={[styles.td, { flex: 1.5 }]}>{doctor.specialty || '-'}</Text>
                                        <View style={[styles.td, { flex: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }]}>
                                            {doctor.departments?.length ? doctor.departments.map((d, i) => (
                                                <View key={i} style={styles.deptTag}>
                                                    <Text style={styles.deptTagText}>{d}</Text>
                                                </View>
                                            )) : <Text style={{ color: '#94a3b8' }}>—</Text>}
                                        </View>
                                        <View style={[styles.td, { flex: 2, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}>
                                            <TouchableOpacity onPress={() => handleViewDetails(doctor._id)} style={[styles.actionBtn, { backgroundColor: '#1976d2' }]}>
                                                <Text style={styles.actionBtnText}>ℹ️ View Profile</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleEdit(doctor)} style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}>
                                                <Text style={styles.actionBtnText}>Edit</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDelete(doctor._id)} style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}>
                                                <Text style={styles.actionBtnText}>Delete</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>

            {/* Doctor Details Modal */}
            <Modal visible={!!(viewingDoctor || loadingDoctorDetails || viewDoctorError)} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity 
                            onPress={() => { setViewingDoctor(null); setViewDoctorError(''); }}
                            style={styles.modalCloseBtn}
                        >
                            <Feather name="x" size={24} color="#94a3b8" />
                        </TouchableOpacity>

                        {loadingDoctorDetails && (
                            <View style={styles.modalCenterContent}>
                                <ActivityIndicator size="large" color="#14b8a6" />
                                <Text style={styles.modalLoadingText}>Fetching doctor profile details...</Text>
                            </View>
                        )}

                        {viewDoctorError !== '' && (
                            <View style={styles.modalCenterContent}>
                                <Text style={{ fontSize: 40 }}>⚠️</Text>
                                <Text style={styles.modalErrorText}>{viewDoctorError}</Text>
                                <TouchableOpacity style={styles.btnSecondary} onPress={() => setViewDoctorError('')}>
                                    <Text style={styles.btnSecondaryText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {viewingDoctor && (
                            <ScrollView style={{ padding: 28, maxHeight: Dimensions.get('window').height * 0.8 }}>
                                <View style={styles.profileHeader}>
                                    {(() => {
                                        const avatar = viewingDoctor.userId?.avatar || viewingDoctor.image;
                                        if (avatar && (avatar.startsWith('http') || avatar.startsWith('/'))) {
                                            return <Image source={{ uri: avatar }} style={styles.profileAvatarImg} />;
                                        }
                                        return (
                                            <View style={styles.profileAvatarBox}>
                                                <Text style={{ fontSize: 40 }}>{avatar || '👨‍⚕️'}</Text>
                                            </View>
                                        );
                                    })()}
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.profileName}>{viewingDoctor.name || viewingDoctor.userId?.name || 'Unknown Name'}</Text>
                                        <Text style={styles.profileSpecialty}>{viewingDoctor.specialty || 'General Practitioner'}</Text>
                                        <View style={styles.profileDepts}>
                                            {viewingDoctor.departments?.map((dept, idx) => (
                                                <View key={idx} style={styles.profileDeptTag}>
                                                    <Text style={styles.profileDeptTagText}>🏢 {dept}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.profileGrid}>
                                    {/* Contact & Demographics */}
                                    <View style={styles.profileColumn}>
                                        <Text style={styles.profileSectionTitle}>Contact & Demographics</Text>
                                        <View style={styles.profileField}>
                                            <Text style={styles.profileFieldLabel}>Email Address</Text>
                                            <Text style={styles.profileFieldValue}>{viewingDoctor.email || viewingDoctor.userId?.email || '—'}</Text>
                                        </View>
                                        <View style={styles.profileField}>
                                            <Text style={styles.profileFieldLabel}>Mobile Number</Text>
                                            <Text style={styles.profileFieldValue}>{viewingDoctor.phone || viewingDoctor.userId?.phone || '—'}</Text>
                                        </View>
                                        <View style={styles.profileField}>
                                            <Text style={styles.profileFieldLabel}>Gender</Text>
                                            <Text style={[styles.profileFieldValue, { textTransform: 'capitalize' }]}>{viewingDoctor.userId?.gender || '—'}</Text>
                                        </View>
                                        <View style={styles.profileField}>
                                            <Text style={styles.profileFieldLabel}>Date of Birth</Text>
                                            <Text style={styles.profileFieldValue}>{viewingDoctor.userId?.dob ? new Date(viewingDoctor.userId.dob).toLocaleDateString('en-IN') : '—'}</Text>
                                        </View>
                                        <View style={styles.profileField}>
                                            <Text style={styles.profileFieldLabel}>Residential Address</Text>
                                            <Text style={styles.profileFieldValue}>{viewingDoctor.userId?.address || '—'}</Text>
                                        </View>
                                    </View>

                                    {/* Professional Profile */}
                                    <View style={styles.profileColumn}>
                                        <Text style={styles.profileSectionTitle}>Professional Profile</Text>
                                        <View style={styles.profileField}>
                                            <Text style={styles.profileFieldLabel}>Registration Number / Doc ID</Text>
                                            <Text style={[styles.profileFieldValue, { fontFamily: 'monospace' }]}>{viewingDoctor.doctorId || '—'}</Text>
                                        </View>
                                        <View style={styles.profileField}>
                                            <Text style={styles.profileFieldLabel}>Department</Text>
                                            <Text style={styles.profileFieldValue}>{viewingDoctor.departments && viewingDoctor.departments.length > 0 ? viewingDoctor.departments[0] : 'All Departments'}</Text>
                                        </View>
                                        <View style={styles.profileField}>
                                            <Text style={styles.profileFieldLabel}>Qualification / Education</Text>
                                            <Text style={styles.profileFieldValue}>{viewingDoctor.education || '—'}</Text>
                                        </View>
                                        <View style={styles.profileField}>
                                            <Text style={styles.profileFieldLabel}>Years of Experience</Text>
                                            <Text style={styles.profileFieldValue}>{viewingDoctor.experience || '—'}</Text>
                                        </View>
                                        <View style={styles.profileField}>
                                            <Text style={styles.profileFieldLabel}>Consultation Fee</Text>
                                            <Text style={[styles.profileFieldValue, { color: '#16a34a' }]}>₹{Number(viewingDoctor.consultationFee || 0).toLocaleString('en-IN')}</Text>
                                        </View>
                                        <View style={styles.profileField}>
                                            <Text style={styles.profileFieldLabel}>Joining Date</Text>
                                            <Text style={styles.profileFieldValue}>{viewingDoctor.createdAt ? new Date(viewingDoctor.createdAt).toLocaleDateString('en-IN') : '—'}</Text>
                                        </View>
                                        <View style={styles.profileField}>
                                            <Text style={styles.profileFieldLabel}>Status</Text>
                                            <View style={{ alignSelf: 'flex-start', backgroundColor: '#dcfce7', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4, marginTop: 2 }}>
                                                <Text style={{ color: '#15803d', fontSize: 10, fontWeight: '700' }}>Active</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* Availability & Bio section */}
                                <View style={styles.profileFooterSection}>
                                    <View style={{ marginBottom: 16 }}>
                                        <Text style={[styles.profileFieldLabel, { marginBottom: 6 }]}>WEEKLY AVAILABILITY & TIMING</Text>
                                        {renderAvailability(viewingDoctor.availability)}
                                    </View>

                                    {viewingDoctor.bio ? (
                                        <View>
                                            <Text style={[styles.profileFieldLabel, { marginBottom: 4 }]}>BIOGRAPHY</Text>
                                            <View style={styles.bioBox}>
                                                <Text style={styles.bioText}>"{viewingDoctor.bio}"</Text>
                                            </View>
                                        </View>
                                    ) : null}
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
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    content: {
        padding: 20,
        maxWidth: 1200,
        marginHorizontal: 'auto',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingBottom: 8,
    },
    backButtonText: {
        color: '#64748b',
        fontSize: 14,
    },
    pageTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    pageSubtitle: {
        color: '#64748b',
        marginTop: 4,
    },
    headerRight: {
        alignItems: 'flex-end',
        gap: 8,
    },
    quotaBox: {
        backgroundColor: '#fff',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    quotaLabel: {
        color: '#64748b',
        fontSize: 10,
        fontWeight: '600',
    },
    quotaValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#334155',
    },
    btnPrimary: {
        backgroundColor: '#3b82f6',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    btnPrimaryText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    errorBanner: {
        backgroundColor: '#fee2e2',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#fca5a5',
    },
    errorBannerText: {
        color: '#b91c1c',
    },
    successBanner: {
        backgroundColor: '#dcfce7',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#86efac',
    },
    successBannerText: {
        color: '#15803d',
    },
    formCard: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    formCardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 20,
    },
    formRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 16,
    },
    formGroup: {
        flex: 1,
        minWidth: 200,
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        padding: 10,
        fontSize: 14,
        backgroundColor: '#fff',
        color: '#0f172a',
    },
    sectionLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
        color: '#1e293b',
    },
    availabilityGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    availabilityDay: {
        padding: 10,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        width: 150,
    },
    checkbox: {
        width: 18,
        height: 18,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 4,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    dayLabel: {
        fontWeight: 'bold',
        textTransform: 'capitalize',
        color: '#1e293b',
    },
    timeInputs: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
        gap: 8,
    },
    timeLabel: {
        fontSize: 10,
        color: '#64748b',
    },
    timeInput: {
        padding: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 4,
        fontSize: 12,
        backgroundColor: '#fff',
    },
    formActions: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 12,
        marginTop: 20,
    },
    btnPrimarySubmit: {
        backgroundColor: '#3b82f6',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 6,
    },
    btnSecondary: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    btnSecondaryText: {
        color: '#475569',
        fontWeight: 'bold',
    },
    deptCard: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20,
    },
    deptCardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 14,
        color: '#1e293b',
    },
    deptGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    deptBadge: {
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 18,
        alignItems: 'center',
        minWidth: 120,
    },
    deptCount: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1d4ed8',
    },
    deptName: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 2,
    },
    tableCard: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    tableTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#1e293b',
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 10,
        marginBottom: 10,
    },
    th: {
        fontWeight: 'bold',
        color: '#475569',
        fontSize: 14,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 12,
        alignItems: 'center',
    },
    td: {
        fontSize: 14,
        color: '#334155',
    },
    deptTag: {
        backgroundColor: '#eff6ff',
        borderRadius: 4,
        paddingVertical: 2,
        paddingHorizontal: 7,
    },
    deptTagText: {
        color: '#1d4ed8',
        fontSize: 11,
        fontWeight: '600',
    },
    actionBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 750,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.15,
        shadowRadius: 48,
        elevation: 10,
    },
    modalCloseBtn: {
        position: 'absolute',
        right: 20,
        top: 20,
        zIndex: 10,
    },
    modalCenterContent: {
        minHeight: 320,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        padding: 20,
    },
    modalLoadingText: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 14,
    },
    modalErrorText: {
        color: '#ef4444',
        fontWeight: '700',
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 10,
    },
    profileHeader: {
        flexDirection: 'row',
        gap: 24,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 20,
        marginBottom: 20,
    },
    profileAvatarImg: {
        width: 90,
        height: 90,
        borderRadius: 45,
        borderWidth: 3,
        borderColor: '#14b8a6',
    },
    profileAvatarBox: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: '#f0fdfa',
        borderWidth: 3,
        borderColor: '#14b8a6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileName: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0f172a',
    },
    profileSpecialty: {
        fontWeight: '700',
        color: '#0d9488',
        fontSize: 16,
        marginTop: 6,
    },
    profileDepts: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
        marginTop: 10,
    },
    profileDeptTag: {
        backgroundColor: '#f0fdfa',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#ccfbef',
    },
    profileDeptTagText: {
        color: '#0d9488',
        fontSize: 11,
        fontWeight: '700',
    },
    profileGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24,
    },
    profileColumn: {
        flex: 1,
        minWidth: 250,
        gap: 14,
    },
    profileSectionTitle: {
        fontSize: 13,
        borderBottomWidth: 2,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 6,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: '800',
    },
    profileField: {},
    profileFieldLabel: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    profileFieldValue: {
        fontSize: 13.5,
        color: '#334155',
        fontWeight: '600',
    },
    profileFooterSection: {
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        marginTop: 16,
        paddingTop: 16,
    },
    bioBox: {
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#14b8a6',
    },
    bioText: {
        fontSize: 13,
        color: '#475569',
        fontStyle: 'italic',
        lineHeight: 20,
    }
});

export default AdminDoctors;
