import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, TextInput,
    StyleSheet, Alert, Dimensions, Modal, ActivityIndicator, Image,
    Animated, Platform, useWindowDimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAuth, useAdminEntities } from '../../store/hooks';
import { fetchAdminDoctors, createDoctor, updateDoctor, deleteDoctor } from '../../store/slices/adminEntitiesSlice';
import { adminEntitiesAPI, hospitalAPI } from '../../utils/api';
import { getSubscriptionLimits } from '../../utils/subscriptionPlans';
import { Feather } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, LinearGradient as SvgLinearGradient, Stop, Circle, Path, Rect, Line, G, Text as SvgText, Ellipse } from 'react-native-svg';

const AdminDoctors = () => {
    const navigation = useNavigation();
    const dispatch = useAppDispatch();
    const { user } = useAuth();
    const { doctors: doctorsState } = useAdminEntities();
    const { width } = useWindowDimensions();

    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;

    const initialFallbackDoctors = [
        {
            _id: 'doc-001',
            name: 'Dr. Sarah Jenkins',
            email: 'sarah.jenkins@metropolis.org',
            phone: '9876543210',
            specialty: 'Cardiologist',
            experience: '12 Years',
            education: 'MBBS, MD (Cardiology)',
            departments: ['Cardiology'],
            consultationFee: 1200,
            image: '👩‍⚕️',
            bio: 'Senior consultant cardiologist specializing in non-invasive imaging and preventive cardiology.',
            successRate: '98%',
            patientsCount: '1500+'
        },
        {
            _id: 'doc-002',
            name: 'Dr. Robert Chen',
            email: 'robert.chen@metropolis.org',
            phone: '9876543211',
            specialty: 'Neurologist',
            experience: '15 Years',
            education: 'MBBS, DM (Neurology)',
            departments: ['Neurology'],
            consultationFee: 1500,
            image: '👨‍⚕️',
            bio: 'Chief of Neurology with expertise in stroke management and neuromuscular disorders.',
            successRate: '96%',
            patientsCount: '2100+'
        },
        {
            _id: 'doc-003',
            name: 'Dr. Anita Patel',
            email: 'anita.patel@metropolis.org',
            phone: '9876543212',
            specialty: 'Orthopedic Surgeon',
            experience: '9 Years',
            education: 'MBBS, MS (Ortho)',
            departments: ['Orthopedics'],
            consultationFee: 1000,
            image: '👩‍⚕️',
            bio: 'Orthopedic surgeon focusing on joint replacements and sports medicine trauma.',
            successRate: '95%',
            patientsCount: '980+'
        }
    ];

    const [localDoctors, setLocalDoctors] = useState(initialFallbackDoctors);
    const doctors = (doctorsState.data && doctorsState.data.length > 0) ? doctorsState.data : localDoctors;
    const loadingData = doctorsState.loading;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editingDoctor, setEditingDoctor] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [hospital, setHospital] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    // List filtering and view mode
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

    // Viewing doctor details modal state
    const [viewingDoctor, setViewingDoctor] = useState(null);
    const [loadingDoctorDetails, setLoadingDoctorDetails] = useState(false);
    const [viewDoctorError, setViewDoctorError] = useState('');

    // Floating watermark animation
    const floatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, { toValue: -6, duration: 2500, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(floatAnim, { toValue: 0, duration: 2500, useNativeDriver: Platform.OS !== 'web' }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [floatAnim]);

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
        consultationFee: ''
    };

    const [formData, setFormData] = useState(initialFormState);
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const isHospitalAdmin = user?.role === 'hospitaladmin';

    useEffect(() => {
        if (!user || !['admin', 'hospitaladmin'].includes(user.role)) {
            navigation.navigate('HospitalAdminDashboard');
            return;
        }
        dispatch(fetchAdminDoctors());
    }, [navigation, user, dispatch]);

    useEffect(() => {
        if (doctorsState.error) setError(doctorsState.error);
    }, [doctorsState.error]);

    // Auto-fetch department consultation fee when department is selected
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
                    [field]: value
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
                    setSuccess('Doctor profile updated successfully!');
                    resetForm();
                    dispatch(fetchAdminDoctors());
                } else {
                    setError(result.payload || 'Failed to update doctor profile');
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
                    setSuccess('Doctor profile created successfully!');
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
        const localDoc = doctors.find(d => d._id === id);
        if (localDoc) {
            setViewingDoctor(localDoc);
            setLoadingDoctorDetails(false);
        } else {
            setLoadingDoctorDetails(true);
        }
        setViewDoctorError('');
        try {
            const res = await adminEntitiesAPI.getDoctor(id);
            if (res.success && res.doctor) {
                setViewingDoctor(res.doctor);
            } else if (!localDoc) {
                setViewDoctorError(res?.message || 'Failed to load doctor profile details.');
            }
        } catch (err) {
            if (!localDoc) {
                setViewDoctorError(err.response?.data?.message || 'Error fetching doctor profile details.');
            }
        } finally {
            setLoadingDoctorDetails(false);
        }
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
            email: doctor.email || doctor.userId?.email || '',
            phone: doctor.phone || doctor.userId?.phone || '',
            password: '',
            gender: doctor.gender || doctor.userId?.gender || '',
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
            consultationFee: doctor.consultationFee !== undefined ? String(doctor.consultationFee) : ''
        });
        setShowForm(true);
    };

    const handleDelete = (id) => {
        Alert.alert('Confirm Delete', 'Are you sure you want to delete this doctor?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await dispatch(deleteDoctor(id));
                    setSuccess('Doctor deleted successfully');
                    dispatch(fetchAdminDoctors());
                }
            }
        ]);
    };

    const resetForm = () => {
        setFormData(initialFormState);
        setEditingDoctor(null);
        setShowForm(false);
    };

    // Filtered Doctors List
    const filteredDoctors = useMemo(() => {
        return doctors.filter(doc => {
            const name = (doc.name || doc.userId?.name || '').toLowerCase();
            const email = (doc.email || doc.userId?.email || '').toLowerCase();
            const spec = (doc.specialty || '').toLowerCase();
            const q = searchQuery.toLowerCase();

            const matchesSearch = !q || name.includes(q) || email.includes(q) || spec.includes(q);
            const matchesDept = selectedDeptFilter === 'ALL' || (doc.departments && doc.departments.includes(selectedDeptFilter));

            return matchesSearch && matchesDept;
        });
    }, [doctors, searchQuery, selectedDeptFilter]);

    // Quota details
    const quotaLimits = hospital ? getSubscriptionLimits(hospital.subscriptionPlan) : { maxDoctors: 15 };
    const maxDocs = quotaLimits?.maxDoctors || 15;
    const docCount = doctors.length;
    const remainingDocs = Math.max(0, maxDocs - docCount);
    const isQuotaReached = hospital && (hospital.subscriptionPlan === 'clinic_basic' || hospital.subscriptionPlan === 'multi_speciality_starter') && docCount >= maxDocs;

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
                {/* ==================== 1. HERO BANNER (MATCHING WEB SCREENSHOT) ==================== */}
                <ExpoLinearGradient
                    colors={['#ffffff', '#f0f9ff', '#e0f2fe']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.adHeroBanner}
                >
                    {/* 3D Holographic AI Neural Network Watermark */}
                    <Animated.View style={[styles.adHeroAiWatermark, { transform: [{ translateY: floatAnim }] }]} pointerEvents="none">
                        <Svg width={220} height={130} viewBox="0 0 300 160" fill="none">
                            <Defs>
                                <SvgLinearGradient id="aiGlobeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <Stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                                    <Stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
                                </SvgLinearGradient>
                            </Defs>
                            <Ellipse cx="150" cy="80" rx="90" ry="38" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="3, 4" opacity="0.6" />
                            <Ellipse cx="150" cy="80" rx="75" ry="32" stroke="#818cf8" strokeWidth="1.2" opacity="0.5" />
                            <Circle cx="150" cy="80" r="55" fill="none" stroke="#bae6fd" strokeWidth="1" opacity="0.4" />
                            <Circle cx="150" cy="80" r="42" fill="url(#aiGlobeGrad)" stroke="#38bdf8" strokeWidth="1.5" />
                            <SvgText x="150" y="89" textAnchor="middle" fill="#0369a1" fontSize="26" fontWeight="900">AI</SvgText>
                        </Svg>
                    </Animated.View>

                    <View style={styles.adHeroLeft}>
                        <Text style={styles.adHeroTitle}>
                            Manage <Text style={styles.adTitleHighlight}>Doctors</Text>
                        </Text>
                        <Text style={styles.adHeroSubtitle}>
                            Add and manage doctor profiles for the user platform.
                        </Text>
                    </View>

                    {/* Right Side Quota & Action Button */}
                    <View style={[styles.adHeroRight, isMobile && { marginTop: 12, flexWrap: 'wrap' }]}>
                        {/* Used Quota Card */}
                        <View style={styles.adQuotaCard}>
                            <View style={styles.adQuotaIcon}>
                                <Feather name="users" size={18} color="#6366f1" />
                            </View>
                            <View style={styles.adQuotaInfo}>
                                <Text style={styles.adQuotaVal}>{docCount} / {maxDocs}</Text>
                                <Text style={styles.adQuotaLbl}>Used</Text>
                            </View>
                        </View>

                        {/* Remaining Quota Card */}
                        <View style={[styles.adQuotaCard, remainingDocs === 0 ? styles.quotaFull : styles.quotaRemaining]}>
                            <View style={styles.adQuotaIcon}>
                                <Feather name="user-plus" size={18} color={remainingDocs === 0 ? '#dc2626' : '#16a34a'} />
                            </View>
                            <View style={styles.adQuotaInfo}>
                                <Text style={[styles.adQuotaVal, { color: remainingDocs === 0 ? '#dc2626' : '#16a34a' }]}>{remainingDocs}</Text>
                                <Text style={[styles.adQuotaLbl, { color: remainingDocs === 0 ? '#dc2626' : '#16a34a' }]}>Remaining</Text>
                            </View>
                        </View>

                        {/* Toggle Form Button */}
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => {
                                if (showForm && editingDoctor) {
                                    resetForm();
                                } else {
                                    setShowForm(!showForm);
                                }
                            }}
                            style={[styles.adToggleBtn, showForm && styles.btnCancel, isQuotaReached && !showForm && { backgroundColor: '#94a3b8' }]}
                            disabled={isQuotaReached && !showForm}
                        >
                            <Text style={[styles.adToggleBtnText, showForm && styles.btnCancelText]}>
                                {showForm ? 'Cancel' : '+ Add Doctor'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ExpoLinearGradient>

                {error ? (
                    <View style={styles.bannerError}>
                        <Feather name="alert-circle" size={16} color="#dc2626" />
                        <Text style={styles.bannerErrorText}>{error}</Text>
                    </View>
                ) : null}

                {success ? (
                    <View style={styles.bannerSuccess}>
                        <Feather name="check-circle" size={16} color="#16a34a" />
                        <Text style={styles.bannerSuccessText}>{success}</Text>
                    </View>
                ) : null}

                {/* ==================== 2. ADD NEW DOCTOR FORM CARD ==================== */}
                {showForm && (
                    <View style={styles.adFormCard}>
                        {/* Header with badge and ECG wave */}
                        <View style={styles.adFormHeader}>
                            <View style={styles.adFormHeaderBadge}>
                                <Feather name="user-plus" size={18} color="#2563eb" />
                            </View>
                            <Text style={styles.adFormTitle}>
                                {editingDoctor ? `Edit: ${editingDoctor.name || editingDoctor.userId?.name || 'Doctor'}` : 'Add New Doctor'}
                            </Text>
                            <Text style={styles.adEcgPulse}> ﮩ٨ـﮩـ</Text>
                        </View>

                        <View style={styles.formGrid}>
                            {/* 1. Name */}
                            <View style={[styles.fieldGroup, !isMobile && { width: '48%' }]}>
                                <Text style={styles.fieldLabel}>Name *</Text>
                                <View style={styles.inputWrapper}>
                                    <View style={[styles.inputIconBox, { backgroundColor: '#f3e8ff' }]}>
                                        <Feather name="user" size={16} color="#9333ea" />
                                    </View>
                                    <TextInput
                                        style={styles.inputControl}
                                        value={formData.name}
                                        onChangeText={t => handleChange('name', t)}
                                        placeholder="Enter doctor full name"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>
                            </View>

                            {/* 2. Email */}
                            <View style={[styles.fieldGroup, !isMobile && { width: '48%' }]}>
                                <Text style={styles.fieldLabel}>Email *</Text>
                                <View style={styles.inputWrapper}>
                                    <View style={[styles.inputIconBox, { backgroundColor: '#dbeafe' }]}>
                                        <Feather name="mail" size={16} color="#2563eb" />
                                    </View>
                                    <TextInput
                                        style={styles.inputControl}
                                        value={formData.email}
                                        onChangeText={t => handleChange('email', t)}
                                        placeholder="Enter email address"
                                        keyboardType="email-address"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>
                            </View>

                            {/* 3. Phone */}
                            <View style={[styles.fieldGroup, !isMobile && { width: '48%' }]}>
                                <Text style={styles.fieldLabel}>Phone *</Text>
                                <View style={styles.inputWrapper}>
                                    <View style={[styles.inputIconBox, { backgroundColor: '#ecfdf5' }]}>
                                        <Feather name="phone" size={16} color="#10b981" />
                                    </View>
                                    <TextInput
                                        style={styles.inputControl}
                                        value={formData.phone}
                                        onChangeText={t => handleChange('phone', t.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="Enter phone number"
                                        keyboardType="phone-pad"
                                        maxLength={10}
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>
                            </View>

                            {/* 4. Password */}
                            <View style={[styles.fieldGroup, !isMobile && { width: '48%' }]}>
                                <Text style={styles.fieldLabel}>{editingDoctor ? 'New Password (Optional)' : 'Password *'}</Text>
                                <View style={styles.inputWrapper}>
                                    <View style={[styles.inputIconBox, { backgroundColor: '#f3e8ff' }]}>
                                        <Feather name="lock" size={16} color="#9333ea" />
                                    </View>
                                    <TextInput
                                        style={[styles.inputControl, { flex: 1 }]}
                                        value={formData.password}
                                        onChangeText={t => handleChange('password', t)}
                                        placeholder="Min 6 characters"
                                        secureTextEntry={!showPassword}
                                        placeholderTextColor="#94a3b8"
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={{ paddingHorizontal: 10 }}
                                    >
                                        <Feather name={showPassword ? "eye-off" : "eye"} size={16} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* 5. Gender */}
                            <View style={[styles.fieldGroup, !isMobile && { width: '48%' }]}>
                                <Text style={styles.fieldLabel}>Gender</Text>
                                <View style={styles.inputWrapper}>
                                    <View style={[styles.inputIconBox, { backgroundColor: '#ecfeff' }]}>
                                        <Feather name="heart" size={16} color="#06b6d4" />
                                    </View>
                                    <View style={{ flex: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 8 }}>
                                        {['Male', 'Female', 'Other'].map(g => (
                                            <TouchableOpacity
                                                key={g}
                                                onPress={() => handleChange('gender', g)}
                                                style={[
                                                    styles.genderPill,
                                                    formData.gender === g && styles.genderPillActive
                                                ]}
                                            >
                                                <Text style={[styles.genderPillText, formData.gender === g && styles.genderPillTextActive]}>{g}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            {/* 6. Experience */}
                            <View style={[styles.fieldGroup, !isMobile && { width: '48%' }]}>
                                <Text style={styles.fieldLabel}>Experience</Text>
                                <View style={styles.inputWrapper}>
                                    <View style={[styles.inputIconBox, { backgroundColor: '#fffbeb' }]}>
                                        <Feather name="award" size={16} color="#d97706" />
                                    </View>
                                    <TextInput
                                        style={styles.inputControl}
                                        value={formData.experience}
                                        onChangeText={t => handleChange('experience', t)}
                                        placeholder="e.g. 10 Years"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>
                            </View>

                            {/* 7. Specialty */}
                            <View style={[styles.fieldGroup, !isMobile && { width: '48%' }]}>
                                <Text style={styles.fieldLabel}>Specialty</Text>
                                <View style={styles.inputWrapper}>
                                    <View style={[styles.inputIconBox, { backgroundColor: '#f3e8ff' }]}>
                                        <Feather name="star" size={16} color="#9333ea" />
                                    </View>
                                    <TextInput
                                        style={styles.inputControl}
                                        value={formData.specialty}
                                        onChangeText={t => handleChange('specialty', t)}
                                        placeholder="e.g. IVF Specialist"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>
                            </View>

                            {/* 8. Consultation Fee (₹) */}
                            <View style={[styles.fieldGroup, !isMobile && { width: '48%' }]}>
                                <Text style={styles.fieldLabel}>Consultation Fee (₹)</Text>
                                <View style={styles.inputWrapper}>
                                    <View style={[styles.inputIconBox, { backgroundColor: '#ecfdf5' }]}>
                                        <Text style={{ fontWeight: '800', fontSize: 16, color: '#059669' }}>₹</Text>
                                    </View>
                                    <TextInput
                                        style={styles.inputControl}
                                        value={formData.consultationFee}
                                        onChangeText={t => handleChange('consultationFee', t)}
                                        placeholder="Enter consultation fee"
                                        keyboardType="numeric"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>
                            </View>

                            {/* 9. Education */}
                            <View style={[styles.fieldGroup, !isMobile && { width: '48%' }]}>
                                <Text style={styles.fieldLabel}>Education</Text>
                                <View style={styles.inputWrapper}>
                                    <View style={[styles.inputIconBox, { backgroundColor: '#eff6ff' }]}>
                                        <Feather name="book-open" size={16} color="#2563eb" />
                                    </View>
                                    <TextInput
                                        style={styles.inputControl}
                                        value={formData.education}
                                        onChangeText={t => handleChange('education', t)}
                                        placeholder="e.g. MBBS, MD"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>
                            </View>

                            {/* 10. Assign Department */}
                            <View style={[styles.fieldGroup, !isMobile && { width: '48%' }]}>
                                <Text style={styles.fieldLabel}>Assign Department (Optional)</Text>
                                <View style={styles.inputWrapper}>
                                    <View style={[styles.inputIconBox, { backgroundColor: '#f0fdfa' }]}>
                                        <Feather name="briefcase" size={16} color="#0d9488" />
                                    </View>
                                    <TextInput
                                        style={styles.inputControl}
                                        value={formData.departments && formData.departments.length > 0 ? formData.departments[0] : ''}
                                        onChangeText={t => setFormData({ ...formData, departments: t ? [t] : [] })}
                                        placeholder="e.g. Cardiology"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>
                            </View>
                        </View>

                        {/* 11. Weekly Availability & Timing Section */}
                        <View style={styles.adAvailSection}>
                            <View style={styles.adAvailHeader}>
                                <Feather name="calendar" size={16} color="#2563eb" />
                                <Text style={styles.adAvailHeaderText}>Weekly Availability & Timing</Text>
                            </View>

                            <View style={styles.adDaysGrid}>
                                {days.map(day => {
                                    const isDayAvail = formData.availability?.[day]?.available || false;
                                    return (
                                        <View key={day} style={[styles.dayPillCard, isDayAvail && styles.dayPillCardActive]}>
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={() => handleAvailabilityChange(day, 'available', !isDayAvail)}
                                                style={styles.dayCheckboxRow}
                                            >
                                                <View style={[styles.checkboxBox, isDayAvail && styles.checkboxBoxActive]}>
                                                    {isDayAvail && <Feather name="check" size={12} color="#ffffff" />}
                                                </View>
                                                <Text style={[styles.dayLabel, isDayAvail && styles.dayLabelActive]}>
                                                    {day.charAt(0).toUpperCase() + day.slice(1)}
                                                </Text>
                                            </TouchableOpacity>

                                            {isDayAvail && (
                                                <View style={styles.timeInputsRow}>
                                                    <TextInput
                                                        style={styles.timeInput}
                                                        value={formData.availability?.[day]?.startTime || '09:00'}
                                                        onChangeText={t => handleAvailabilityChange(day, 'startTime', t)}
                                                        placeholder="09:00"
                                                        placeholderTextColor="#94a3b8"
                                                    />
                                                    <Text style={{ color: '#94a3b8' }}>-</Text>
                                                    <TextInput
                                                        style={styles.timeInput}
                                                        value={formData.availability?.[day]?.endTime || '17:00'}
                                                        onChangeText={t => handleAvailabilityChange(day, 'endTime', t)}
                                                        placeholder="17:00"
                                                        placeholderTextColor="#94a3b8"
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        </View>

                        {/* 12. Bio */}
                        <View style={[styles.fieldGroup, { width: '100%', marginTop: 12 }]}>
                            <Text style={styles.fieldLabel}>Bio</Text>
                            <View style={[styles.inputWrapper, { alignItems: 'flex-start', paddingVertical: 8 }]}>
                                <View style={[styles.inputIconBox, { backgroundColor: '#f1f5f9', marginTop: 4 }]}>
                                    <Feather name="edit-3" size={16} color="#64748b" />
                                </View>
                                <TextInput
                                    style={[styles.inputControl, { minHeight: 70, textAlignVertical: 'top' }]}
                                    value={formData.bio}
                                    onChangeText={t => handleChange('bio', t)}
                                    placeholder="Doctor's profile bio..."
                                    multiline
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                        </View>

                        {/* Form Action Buttons */}
                        <View style={styles.formActionsRow}>
                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={loading}
                                style={styles.btnCreate}
                            >
                                <Feather name="check" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={styles.btnCreateText}>
                                    {loading ? 'Saving...' : editingDoctor ? 'Update Profile' : 'Create Doctor'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={resetForm}
                                style={styles.btnCancelPlain}
                            >
                                <Feather name="x" size={16} color="#64748b" style={{ marginRight: 6 }} />
                                <Text style={styles.btnCancelPlainText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ==================== 3. ALL DOCTORS LIST SECTION ==================== */}
                <View style={styles.adDoctorsSection}>
                    <View style={[styles.adDoctorsHeader, isMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
                        <View style={styles.adSectionTitleWrap}>
                            <Feather name="users" size={20} color="#2563eb" />
                            <Text style={styles.adSectionTitleText}>All Doctors</Text>
                            <View style={styles.adSectionBadge}>
                                <Text style={styles.adSectionBadgeText}>{filteredDoctors.length} Profiles</Text>
                            </View>
                        </View>

                        <View style={[styles.adDoctorsControls, isMobile && { width: '100%', flexWrap: 'wrap' }]}>
                            {/* Search Input */}
                            <View style={styles.adSearchBox}>
                                <Feather name="search" size={15} color="#94a3b8" style={{ marginRight: 8 }} />
                                <TextInput
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholder="Search doctors..."
                                    placeholderTextColor="#94a3b8"
                                    style={styles.adSearchInput}
                                />
                            </View>

                            {/* View Toggle */}
                            <View style={styles.adViewToggleGroup}>
                                <TouchableOpacity
                                    accessibilityLabel="Grid view"
                                    onPress={() => setViewMode('grid')}
                                    style={[styles.adViewBtn, viewMode === 'grid' && styles.adViewBtnActive]}
                                >
                                    <Feather name="grid" size={15} color={viewMode === 'grid' ? '#2563eb' : '#64748b'} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    accessibilityLabel="Table view"
                                    onPress={() => setViewMode('table')}
                                    style={[styles.adViewBtn, viewMode === 'table' && styles.adViewBtnActive]}
                                >
                                    <Feather name="list" size={15} color={viewMode === 'table' ? '#2563eb' : '#64748b'} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {loadingData ? (
                        <View style={{ padding: 48, alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#0284c7" />
                            <Text style={{ color: '#64748b', marginTop: 12, fontWeight: '600' }}>Loading doctor profiles...</Text>
                        </View>
                    ) : filteredDoctors.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyCardText}>
                                {searchQuery ? 'No doctors match the search filter.' : 'No doctors registered yet.'}
                            </Text>
                        </View>
                    ) : viewMode === 'grid' ? (
                        /* Grid Cards View */
                        <View style={styles.adDoctorsGrid}>
                            {filteredDoctors.map(doctor => {
                                const docName = doctor.name || doctor.userId?.name || 'Unknown Name';
                                const docEmail = doctor.email || doctor.userId?.email || '—';
                                const avatar = doctor.userId?.avatar || doctor.image;

                                return (
                                    <View key={doctor._id} style={[styles.adDoctorCard, isMobile ? { width: '100%' } : (isTablet ? { width: '48%' } : { width: '31.5%' })]}>
                                        <View style={styles.adDocCardTop}>
                                            <View style={styles.adDocAvatarBox}>
                                                {avatar && (avatar.startsWith('http') || avatar.startsWith('/')) ? (
                                                    <Image source={{ uri: avatar }} style={styles.adDocAvatarImg} />
                                                ) : (
                                                    <Text style={{ fontSize: 24 }}>{doctor.image || '👨‍⚕️'}</Text>
                                                )}
                                            </View>

                                            <View style={styles.adDocMainInfo}>
                                                <Text style={styles.adDocName} numberOfLines={1}>{docName}</Text>
                                                <Text style={styles.adDocSpecialty} numberOfLines={1}>{doctor.specialty || 'General Practitioner'}</Text>
                                                <Text style={styles.adDocEmail} numberOfLines={1}>{docEmail}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.adDocBadgesRow}>
                                            {doctor.departments?.map((dept, i) => (
                                                <View key={i} style={styles.adDeptBadge}>
                                                    <Text style={styles.adDeptBadgeText}>🏢 {dept}</Text>
                                                </View>
                                            ))}
                                            {doctor.consultationFee !== undefined && doctor.consultationFee !== null && (
                                                <View style={styles.adFeeBadge}>
                                                    <Text style={styles.adFeeBadgeText}>₹{Number(doctor.consultationFee).toLocaleString('en-IN')} Fee</Text>
                                                </View>
                                            )}
                                            {doctor.experience ? (
                                                <View style={styles.adExpBadge}>
                                                    <Text style={styles.adExpBadgeText}>★ {doctor.experience}</Text>
                                                </View>
                                            ) : null}
                                        </View>

                                        <View style={styles.adDocCardActions}>
                                            <TouchableOpacity
                                                onPress={() => handleViewDetails(doctor._id)}
                                                style={[styles.adCardBtn, styles.adBtnView]}
                                            >
                                                <Text style={styles.adBtnViewText}>Profile</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleEdit(doctor)}
                                                style={[styles.adCardBtn, styles.adBtnEdit]}
                                            >
                                                <Text style={styles.adBtnEditText}>Edit</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleDelete(doctor._id)}
                                                style={[styles.adCardBtn, styles.adBtnDel]}
                                            >
                                                <Text style={styles.adBtnDelText}>✕</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        /* Table View */
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ minWidth: 800 }}>
                                <View style={styles.tableHeaderRow}>
                                    <Text style={[styles.tableTh, { flex: 2 }]}>Doctor</Text>
                                    <Text style={[styles.tableTh, { flex: 2 }]}>Email / Contact</Text>
                                    <Text style={[styles.tableTh, { flex: 1.5 }]}>Specialty</Text>
                                    <Text style={[styles.tableTh, { flex: 1.5 }]}>Department</Text>
                                    <Text style={[styles.tableTh, { flex: 1 }]}>Fee</Text>
                                    <Text style={[styles.tableTh, { flex: 1.5, textAlign: 'right' }]}>Actions</Text>
                                </View>
                                {filteredDoctors.map(doctor => {
                                    const docName = doctor.name || doctor.userId?.name || 'Unknown Name';
                                    const docEmail = doctor.email || doctor.userId?.email || '—';
                                    const avatar = doctor.userId?.avatar || doctor.image;

                                    return (
                                        <View key={doctor._id} style={styles.tableDataRow}>
                                            <View style={[styles.tableTd, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                                                <View style={styles.tableAvatar}>
                                                    {avatar && (avatar.startsWith('http') || avatar.startsWith('/')) ? (
                                                        <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
                                                    ) : (
                                                        <Text>{doctor.image || '👨‍⚕️'}</Text>
                                                    )}
                                                </View>
                                                <Text style={{ fontWeight: '700', color: '#0f172a' }}>{docName}</Text>
                                            </View>
                                            <View style={[styles.tableTd, { flex: 2 }]}>
                                                <Text style={{ color: '#334155' }}>{docEmail}</Text>
                                                {doctor.phone ? <Text style={{ color: '#94a3b8', fontSize: 11 }}>{doctor.phone}</Text> : null}
                                            </View>
                                            <Text style={[styles.tableTd, { flex: 1.5, color: '#0284c7', fontWeight: '600' }]}>
                                                {doctor.specialty || '—'}
                                            </Text>
                                            <View style={[styles.tableTd, { flex: 1.5, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }]}>
                                                {doctor.departments?.map((d, i) => (
                                                    <View key={i} style={styles.adDeptBadge}>
                                                        <Text style={styles.adDeptBadgeText}>{d}</Text>
                                                    </View>
                                                )) || <Text style={{ color: '#94a3b8' }}>—</Text>}
                                            </View>
                                            <Text style={[styles.tableTd, { flex: 1, color: '#16a34a', fontWeight: '700' }]}>
                                                ₹{Number(doctor.consultationFee || 0).toLocaleString('en-IN')}
                                            </Text>
                                            <View style={[styles.tableTd, { flex: 1.5, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }]}>
                                                <TouchableOpacity onPress={() => handleViewDetails(doctor._id)} style={[styles.tableActionBtn, { backgroundColor: '#eff6ff' }]}>
                                                    <Text style={{ color: '#2563eb', fontWeight: '600', fontSize: 12 }}>View</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleEdit(doctor)} style={[styles.tableActionBtn, { backgroundColor: '#fef3c7' }]}>
                                                    <Text style={{ color: '#d97706', fontWeight: '600', fontSize: 12 }}>Edit</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleDelete(doctor._id)} style={[styles.tableActionBtn, { backgroundColor: '#fee2e2' }]}>
                                                    <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 12 }}>✕</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>

            {/* ==================== 4. DOCTOR PROFILE MODAL ==================== */}
            <Modal visible={!!(viewingDoctor || loadingDoctorDetails || viewDoctorError)} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <TouchableOpacity
                            onPress={() => { setViewingDoctor(null); setViewDoctorError(''); }}
                            style={styles.modalCloseBtn}
                        >
                            <Feather name="x" size={20} color="#94a3b8" />
                        </TouchableOpacity>

                        {loadingDoctorDetails && (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#0284c7" />
                                <Text style={{ color: '#64748b', marginTop: 12, fontWeight: '600' }}>Loading profile details...</Text>
                            </View>
                        )}

                        {viewDoctorError ? (
                            <View style={{ padding: 30, alignItems: 'center' }}>
                                <Text style={{ fontSize: 36, marginBottom: 8 }}>⚠️</Text>
                                <Text style={{ color: '#ef4444', fontWeight: '700' }}>{viewDoctorError}</Text>
                            </View>
                        ) : null}

                        {viewingDoctor && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.modalHeaderRow}>
                                    <View style={styles.modalAvatarBox}>
                                        {viewingDoctor.userId?.avatar ? (
                                            <Image source={{ uri: viewingDoctor.userId.avatar }} style={{ width: '100%', height: '100%', borderRadius: 36 }} />
                                        ) : (
                                            <Text style={{ fontSize: 32 }}>{viewingDoctor.image || '👨‍⚕️'}</Text>
                                        )}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.modalDoctorName}>{viewingDoctor.name || viewingDoctor.userId?.name || 'Doctor'}</Text>
                                        <Text style={styles.modalDoctorSpecialty}>{viewingDoctor.specialty || 'General Practitioner'}</Text>
                                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                            {viewingDoctor.departments?.map((d, i) => (
                                                <View key={i} style={styles.adDeptBadge}>
                                                    <Text style={styles.adDeptBadgeText}>🏢 {d}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.modalInfoGrid}>
                                    <View style={styles.modalInfoItem}>
                                        <Text style={styles.modalInfoLabel}>Email</Text>
                                        <Text style={styles.modalInfoValue}>{viewingDoctor.email || viewingDoctor.userId?.email || '—'}</Text>
                                    </View>
                                    <View style={styles.modalInfoItem}>
                                        <Text style={styles.modalInfoLabel}>Phone</Text>
                                        <Text style={styles.modalInfoValue}>{viewingDoctor.phone || viewingDoctor.userId?.phone || '—'}</Text>
                                    </View>
                                    <View style={styles.modalInfoItem}>
                                        <Text style={styles.modalInfoLabel}>Education</Text>
                                        <Text style={styles.modalInfoValue}>{viewingDoctor.education || '—'}</Text>
                                    </View>
                                    <View style={styles.modalInfoItem}>
                                        <Text style={styles.modalInfoLabel}>Experience</Text>
                                        <Text style={styles.modalInfoValue}>{viewingDoctor.experience || '—'}</Text>
                                    </View>
                                    <View style={styles.modalInfoItem}>
                                        <Text style={styles.modalInfoLabel}>Consultation Fee</Text>
                                        <Text style={[styles.modalInfoValue, { color: '#16a34a', fontWeight: '700' }]}>
                                            ₹{Number(viewingDoctor.consultationFee || 0).toLocaleString('en-IN')}
                                        </Text>
                                    </View>
                                    <View style={styles.modalInfoItem}>
                                        <Text style={styles.modalInfoLabel}>Gender</Text>
                                        <Text style={styles.modalInfoValue}>{viewingDoctor.gender || viewingDoctor.userId?.gender || '—'}</Text>
                                    </View>
                                </View>

                                {viewingDoctor.bio ? (
                                    <View style={styles.modalBioBox}>
                                        <Text style={styles.modalBioLabel}>Biography</Text>
                                        <Text style={styles.modalBioText}>"{viewingDoctor.bio}"</Text>
                                    </View>
                                ) : null}
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
        padding: 16,
    },
    adHeroBanner: {
        position: 'relative',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e0f2fe',
        padding: 20,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        overflow: 'hidden',
        shadowColor: '#0284c7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
        elevation: 2,
    },
    adHeroAiWatermark: {
        position: 'absolute',
        right: '25%',
        top: 0,
        opacity: 0.85,
    },
    adHeroLeft: {
        zIndex: 2,
    },
    adHeroTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    adTitleHighlight: {
        color: '#0284c7',
        fontWeight: '900',
    },
    adHeroSubtitle: {
        fontSize: 13.5,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 4,
    },
    adHeroRight: {
        zIndex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    adQuotaCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#ffffff',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    quotaRemaining: {
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
    },
    quotaFull: {
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
    },
    adQuotaIcon: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    adQuotaInfo: {
        flexDirection: 'column',
    },
    adQuotaVal: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1e293b',
    },
    adQuotaLbl: {
        fontSize: 10.5,
        color: '#64748b',
        fontWeight: '600',
    },
    adToggleBtn: {
        backgroundColor: '#2563eb',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    adToggleBtnText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 13.5,
    },
    btnCancel: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    btnCancelText: {
        color: '#475569',
    },
    bannerError: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        padding: 12,
        borderRadius: 10,
        marginBottom: 16,
    },
    bannerErrorText: {
        color: '#dc2626',
        fontWeight: '600',
        fontSize: 13,
    },
    bannerSuccess: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        padding: 12,
        borderRadius: 10,
        marginBottom: 16,
    },
    bannerSuccessText: {
        color: '#16a34a',
        fontWeight: '600',
        fontSize: 13,
    },
    adFormCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    adFormHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    adFormHeaderBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    adFormTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
    },
    adEcgPulse: {
        color: '#06b6d4',
        fontWeight: '900',
        fontSize: 16,
    },
    formGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    fieldGroup: {
        width: '100%',
        marginBottom: 12,
    },
    fieldLabel: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 6,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
    },
    inputIconBox: {
        width: 40,
        height: 42,
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputControl: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13.5,
        color: '#1e293b',
    },
    genderPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    genderPillActive: {
        backgroundColor: '#0284c7',
    },
    genderPillText: {
        fontSize: 12,
        color: '#475569',
        fontWeight: '600',
    },
    genderPillTextActive: {
        color: '#ffffff',
    },
    adAvailSection: {
        width: '100%',
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginTop: 10,
    },
    adAvailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
    },
    adAvailHeaderText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
    },
    adDaysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    dayPillCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 10,
        minWidth: 135,
    },
    dayPillCardActive: {
        borderColor: '#3b82f6',
        backgroundColor: '#eff6ff',
    },
    dayCheckboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    checkboxBox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxBoxActive: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },
    dayLabel: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#64748b',
    },
    dayLabelActive: {
        color: '#1d4ed8',
        fontWeight: '700',
    },
    timeInputsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    timeInput: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 4,
        fontSize: 11,
        textAlign: 'center',
        color: '#1e293b',
    },
    formActionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 18,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    btnCreate: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2563eb',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 10,
    },
    btnCreateText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 14,
    },
    btnCancelPlain: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    btnCancelPlainText: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 14,
    },
    adDoctorsSection: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
    adDoctorsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
    },
    adSectionTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    adSectionTitleText: {
        fontSize: 19,
        fontWeight: '800',
        color: '#0f172a',
    },
    adSectionBadge: {
        backgroundColor: '#eff6ff',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    adSectionBadgeText: {
        color: '#2563eb',
        fontSize: 12,
        fontWeight: '700',
    },
    adDoctorsControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    adSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 38,
        minWidth: 180,
    },
    adSearchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
    },
    adViewToggleGroup: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        padding: 3,
        gap: 4,
    },
    adViewBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    adViewBtnActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    adViewBtnText: {
        fontSize: 14,
        color: '#64748b',
    },
    adViewBtnTextActive: {
        color: '#0284c7',
        fontWeight: '800',
    },
    emptyCard: {
        padding: 40,
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
    },
    emptyCardText: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 14,
    },
    adDoctorsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    adDoctorCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    adDocCardTop: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    adDocAvatarBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    adDocAvatarImg: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    },
    adDocMainInfo: {
        flex: 1,
    },
    adDocName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
    },
    adDocSpecialty: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#0284c7',
        marginTop: 1,
    },
    adDocEmail: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 1,
    },
    adDocBadgesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 14,
    },
    adDeptBadge: {
        backgroundColor: '#f0f9ff',
        borderWidth: 1,
        borderColor: '#bae6fd',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    adDeptBadgeText: {
        color: '#0369a1',
        fontSize: 11,
        fontWeight: '600',
    },
    adFeeBadge: {
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    adFeeBadgeText: {
        color: '#059669',
        fontSize: 11,
        fontWeight: '700',
    },
    adExpBadge: {
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fde68a',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    adExpBadgeText: {
        color: '#d97706',
        fontSize: 11,
        fontWeight: '600',
    },
    adDocCardActions: {
        flexDirection: 'row',
        gap: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    adCardBtn: {
        paddingVertical: 6,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    adBtnView: {
        flex: 1,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    adBtnViewText: {
        color: '#2563eb',
        fontSize: 12,
        fontWeight: '700',
    },
    adBtnEdit: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    adBtnEditText: {
        color: '#475569',
        fontSize: 12,
        fontWeight: '700',
    },
    adBtnDel: {
        width: 34,
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    adBtnDelText: {
        color: '#dc2626',
        fontWeight: '800',
        fontSize: 12,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        borderBottomWidth: 1.5,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    tableTh: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748b',
        textTransform: 'uppercase',
        paddingHorizontal: 10,
    },
    tableDataRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    tableTd: {
        paddingHorizontal: 10,
        fontSize: 13,
    },
    tableAvatar: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tableActionBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalBox: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 620,
        maxHeight: '85%',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
        elevation: 10,
    },
    modalCloseBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        marginBottom: 16,
    },
    modalAvatarBox: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#eff6ff',
        borderWidth: 2.5,
        borderColor: '#0284c7',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    modalDoctorName: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
    },
    modalDoctorSpecialty: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#0284c7',
        marginTop: 2,
    },
    modalInfoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    modalInfoItem: {
        width: '47%',
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    modalInfoLabel: {
        fontSize: 10.5,
        color: '#94a3b8',
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    modalInfoValue: {
        fontSize: 13.5,
        fontWeight: '600',
        color: '#1e293b',
        marginTop: 2,
    },
    modalBioBox: {
        marginTop: 16,
        backgroundColor: '#f8fafc',
        padding: 14,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#0284c7',
    },
    modalBioLabel: {
        fontSize: 10.5,
        color: '#94a3b8',
        fontWeight: '800',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    modalBioText: {
        fontSize: 13,
        fontStyle: 'italic',
        color: '#475569',
        lineHeight: 18,
    },
});

export default AdminDoctors;
