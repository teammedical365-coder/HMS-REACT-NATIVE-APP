import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, ScrollView, Image, 
    StyleSheet, ActivityIndicator, Alert, Modal, Platform 
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { adminAPI, uploadAPI, hospitalAPI } from '../../utils/api';
import { getSubscriptionLimits } from '../../utils/subscriptionPlans';

import DropdownSelect from '../../components/common/DropdownSelect';

// --- Universal Dropdown Select Wrapper ---
const CustomSelect = (props) => <DropdownSelect {...props} />;

// --- Staff Input with Web focus state & outline removal ---
const StaffInput = ({ style, onFocus, onBlur, ...props }) => {
    const [focused, setFocused] = useState(false);
    return (
        <TextInput
            {...props}
            placeholderTextColor="#94a3b8"
            onFocus={(e) => {
                setFocused(true);
                if (onFocus) onFocus(e);
            }}
            onBlur={(e) => {
                setFocused(false);
                if (onBlur) onBlur(e);
            }}
            style={[
                styles.staffInput,
                Platform.select({
                    web: {
                        outlineStyle: 'none',
                        outlineWidth: 0,
                    }
                }),
                focused && styles.staffInputFocused,
                style
            ]}
        />
    );
};

const Admin = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [roles, setRoles] = useState([]);
    const [hospital, setHospital] = useState(null);
    const [currentUser, setCurrentUser] = useState({});

    const [editModal, setEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        id: '', name: '', email: '', phone: '', roleId: '', currentAvatar: '', newAvatarFile: null, specialty: '', department: ''
    });
    const [updating, setUpdating] = useState(false);

    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    // Create Staff Form state
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: '', email: '', password: '', phone: '', age: '', aadhaar: '', roleId: '', file: null, department: ''
    });
    const [creating, setCreating] = useState(false);
    const [clinicDoctorExists, setClinicDoctorExists] = useState(false);
    const [checkingDocLimit, setCheckingDocLimit] = useState(false);

    const [hospitals, setHospitals] = useState([]);
    const [staffHospitalFilter, setStaffHospitalFilter] = useState('');
    const [staffPlanFilter, setStaffPlanFilter] = useState('');
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);

    const loadUser = async () => {
        const u = await AsyncStorage.getItem('user');
        if (u) {
            const parsed = JSON.parse(u);
            setCurrentUser(parsed);
            
            const perms = parsed.permissions || [];
            const allowedRoles = ['admin', 'superadmin', 'centraladmin', 'hospitaladmin'];
            if (!allowedRoles.includes(parsed.role) &&
                !perms.includes('*') && !perms.includes('admin_manage_roles') && !perms.includes('admin_view_stats')) {
                navigation.navigate('Home');
            }

            if (['superadmin', 'centraladmin'].includes(parsed.role)) {
                fetchHospitals();
            }
        }
    };

    useEffect(() => {
        loadUser();
        fetchUsers();
        fetchRoles();
        fetchHospital();
    }, []);

    useEffect(() => {
        if (route.params?.openCreateForm) {
            setShowCreateForm(true);
        }
    }, [route.params]);

    const handleToggleCreateForm = async () => {
        const nextState = !showCreateForm;
        if (nextState && hospital?.clinicType === 'clinic') {
            setCheckingDocLimit(true);
            setError('');
            try {
                const response = await adminAPI.getUsers();
                if (response.success) {
                    const staffUsers = response.users || [];
                    const hasDoc = staffUsers.some(u => {
                        const rName = (u.role || '').toLowerCase();
                        return rName === 'clinic doctor' || rName === 'doctor';
                    });
                    setClinicDoctorExists(hasDoc);
                }
            } catch (err) {
                console.error("Error rechecking Clinic Doctor count:", err);
            } finally {
                setCheckingDocLimit(false);
            }
        }
        setShowCreateForm(nextState);
    };

    useEffect(() => {
        if (hospital?.clinicType === 'clinic') {
            const hasDoc = users.some(u => {
                const rName = (u.role || '').toLowerCase();
                return rName === 'clinic doctor' || rName === 'doctor';
            });
            setClinicDoctorExists(hasDoc);
        }
    }, [users, hospital]);

    const fetchHospitals = async (plan = staffPlanFilter) => {
        try {
            const res = await hospitalAPI.getHospitals(plan === '' ? 'all' : plan);
            if (res.success) setHospitals(res.hospitals || []);
        } catch (err) { console.error('Error fetching hospitals:', err); }
    };

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

    const defaultStaffUsers = [
        {
            _id: 'staff-001',
            name: 'Priya Sharma',
            email: 'priya.sharma@metropolis.org',
            phone: '9876500001',
            role: 'headnurse',
            departments: ['Nursing', 'Emergency'],
            avatar: '👩‍⚕️'
        },
        {
            _id: 'staff-002',
            name: 'Rahul Verma',
            email: 'rahul.verma@metropolis.org',
            phone: '9876500002',
            role: 'receptionist',
            departments: ['Front Desk', 'OPD'],
            avatar: '👨‍💼'
        },
        {
            _id: 'staff-003',
            name: 'Vikram Malhotra',
            email: 'vikram.m@metropolis.org',
            phone: '9876500003',
            role: 'pharmacist',
            departments: ['Pharmacy'],
            avatar: '👨‍🔬'
        }
    ];

    const defaultRoles = [
        { _id: 'r-1', name: 'Nurse', roleKey: 'nurse' },
        { _id: 'r-2', name: 'Head Nurse', roleKey: 'headnurse' },
        { _id: 'r-3', name: 'Receptionist', roleKey: 'receptionist' },
        { _id: 'r-4', name: 'Pharmacist', roleKey: 'pharmacist' },
        { _id: 'r-5', name: 'Lab Technician', roleKey: 'lab' },
        { _id: 'r-6', name: 'Cashier / Billing', roleKey: 'cashier' }
    ];

    const fetchRoles = async () => {
        try {
            const response = await adminAPI.getRoles();
            const actualData = response?.data?.data || response?.data?.roles || response?.roles || response?.data || response || [];
            const safeRoles = Array.isArray(actualData) && actualData.length > 0 ? actualData : defaultRoles;
            setRoles(safeRoles);
        } catch (err) {
            console.error('Error fetching roles:', err);
            setRoles(defaultRoles);
        }
    };

    const fetchUsers = async (plan = staffPlanFilter, hospitalId = staffHospitalFilter) => {
        try {
            setLoadingUsers(true);
            const response = await adminAPI.getUsers(plan, hospitalId);
            
            const actualData = response?.data?.data || response?.data?.users || response?.users || response?.data || response || [];
            const safeUsers = Array.isArray(actualData) && actualData.length > 0 ? actualData : defaultStaffUsers;

            const uStr = await AsyncStorage.getItem('user');
            const userObj = JSON.parse(uStr || '{}');
            const isCentral = ['superadmin', 'centraladmin'].includes(userObj.role);
            const staffUsers = safeUsers.filter(u => {
                const r = (u.role || '').toLowerCase();
                if (['patient', 'user'].includes(r)) return false;
                if (!isCentral && r.includes('doctor')) return false;
                return true;
            });
            setUsers(staffUsers);
        } catch (err) {
            console.error('Error fetching users:', err);
            setUsers(defaultStaffUsers);
        } finally {
            setLoadingUsers(false);
        }
    };

    const openEditModal = (userItem) => {
        setEditForm({
            id: userItem.id || userItem._id,
            name: userItem.name,
            email: userItem.email,
            phone: userItem.phone || '',
            roleId: userItem.roleId || userItem.role,
            currentAvatar: userItem.avatar,
            newAvatarFile: null,
            specialty: '',
            department: (userItem.departments && userItem.departments.length > 0) ? userItem.departments[0] : ''
        });
        setEditModal(true);
        setError('');
        setSuccess('');
    };

    const handleUpdateUser = async () => {
        setUpdating(true);
        setError('');
        setSuccess('');

        if (editForm.phone && editForm.phone.length !== 10) {
            setError('Mobile number must be exactly 10 digits.');
            setUpdating(false);
            return;
        }

        try {
            let avatarUrl = editForm.currentAvatar;

            if (editForm.newAvatarFile) {
                const formData = new FormData();
                formData.append('images', {
                    uri: editForm.newAvatarFile.uri,
                    type: 'image/jpeg',
                    name: 'avatar.jpg'
                });
                const uploadRes = await uploadAPI.uploadImages(formData);
                if (uploadRes.success && uploadRes.files.length > 0) {
                    avatarUrl = uploadRes.files[0].url;
                }
            }

            const updateData = {
                name: editForm.name,
                email: editForm.email,
                phone: editForm.phone,
                roleId: editForm.roleId,
                avatar: avatarUrl,
                specialty: editForm.specialty,
                departments: editForm.department ? [editForm.department] : []
            };

            const response = await adminAPI.updateUser(editForm.id, updateData);
            if (response.success) {
                setSuccess('User updated successfully!');
                setEditModal(false);
                fetchUsers();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error updating user.');
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteUser = async (userId) => {
        setDeletingId(userId);
        try {
            const response = await adminAPI.deleteUser(userId);
            if (response.status === 200 || response.success === true) {
                Alert.alert('Success', 'User deleted successfully!');
                setUsers(prev => prev.filter(u => (u.id || u._id) !== userId));
            } else {
                Alert.alert('Error', 'Failed to delete user.');
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Error deleting user.');
        } finally {
            setDeletingId(null);
            setDeleteConfirm(null);
        }
    };

    const handleCreateStaff = async () => {
        setCreating(true);
        setError('');
        setSuccess('');

        if (createForm.phone && createForm.phone.length !== 10) {
            setError('Mobile number must be exactly 10 digits.');
            setCreating(false);
            return;
        }

        if (!createForm.name || !createForm.email || !createForm.password || !createForm.roleId) {
            setError('Name, email, password, and role are all required.');
            setCreating(false);
            return;
        }

        if (hospital?.clinicType === 'clinic') {
            try {
                const response = await adminAPI.getUsers();
                if (response.success) {
                    const staffUsers = response.users || [];
                    const hasDoc = staffUsers.some(u => {
                        const rName = (u.role || '').toLowerCase();
                        return rName === 'clinic doctor' || rName === 'doctor';
                    });
                    if (hasDoc) {
                        setError('This clinic already has an assigned Clinic Doctor.');
                        setClinicDoctorExists(true);
                        setCreating(false);
                        return;
                    }
                }
            } catch (err) {
                console.error("Error checking clinic doctor before submit:", err);
            }
        }

        try {
            let avatarUrl = null;

            if (createForm.file) {
                const formData = new FormData();
                formData.append('images', {
                    uri: createForm.file.uri,
                    type: 'image/jpeg',
                    name: 'avatar.jpg'
                });
                try {
                    const uploadRes = await uploadAPI.uploadImages(formData);
                    if (uploadRes.success && uploadRes.urls && uploadRes.urls.length > 0) {
                        avatarUrl = uploadRes.urls[0];
                    } else if (uploadRes.success && uploadRes.files && uploadRes.files.length > 0) {
                        avatarUrl = uploadRes.files[0].url;
                    }
                } catch (uploadErr) {
                    console.error("Image upload failed:", uploadErr);
                }
            }

            const userData = {
                ...createForm,
                departments: createForm.department ? [createForm.department] : [],
                avatar: avatarUrl
            };

            const response = await adminAPI.createUser(userData);
            if (response.success) {
                setSuccess(`${response.user?.role?.name || 'Staff'} account created! They can log in with: ${createForm.email}`);
                setCreateForm({ name: '', email: '', password: '', phone: '', age: '', aadhaar: '', roleId: '', file: null, department: '', hospitalId: '' });
                setShowCreateForm(false);
                fetchUsers();
            }
        } catch (err) {
            console.error("Creation error:", err);
            setError(err.response?.data?.message || 'Error creating staff account.');
        } finally {
            setCreating(false);
        }
    };

    const handleLogout = async () => {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    // Derived values for quota
    let remainingStaff = 0;
    let isStaffQuotaFull = false;
    let maxStaffCount = 0;
    let currentStaffCount = 0;
    if (hospital && (hospital.subscriptionPlan === 'clinic_basic' || hospital.subscriptionPlan === 'multi_speciality_starter')) {
        const limits = getSubscriptionLimits(hospital.subscriptionPlan);
        maxStaffCount = limits.maxStaff;
        currentStaffCount = users.filter(u => {
            const rName = (u.role?.name || u.role || '').toLowerCase();
            return !rName.includes('doctor') && !['patient', 'hospitaladmin', 'centraladmin', 'superadmin'].includes(rName);
        }).length;
        remainingStaff = Math.max(0, maxStaffCount - currentStaffCount);
        isStaffQuotaFull = remainingStaff === 0;
    }

    const availableRoles = roles
        .filter(r => {
            const name = (r.name || '').toLowerCase().trim();
            if (['patient', 'user'].includes(name)) return false;
            if (name.includes('doctor') || name.includes('doc')) return false;
            if (name.includes('admin')) return false;
            const isClinic = hospital?.clinicType === 'clinic';
            if (!isClinic && name.includes('clinic')) return false;
            return true;
        })
        .map(role => ({ label: role.name, value: role._id }));

    const availableDepts = (hospital && hospital.departments) 
        ? hospital.departments.map(dept => ({ label: dept, value: dept })) 
        : [];

    const planOptions = [
        { label: 'All Plans', value: '' },
        { label: 'Simple Clinics (Starter)', value: 'starter' },
        { label: 'Clinic Basic', value: 'clinic_basic' },
        { label: 'Multi-Speciality Starter', value: 'multi_speciality_starter' },
        { label: 'Enterprise', value: 'enterprise' },
    ];

    const hospitalOptions = hospitals.map(h => ({ label: h.name, value: h._id }));

    const filteredUsers = users.filter(userItem => {
        if (!staffSearchQuery) return true;
        const q = staffSearchQuery.toLowerCase();
        return (
            (userItem.name && userItem.name.toLowerCase().includes(q)) ||
            (userItem.email && userItem.email.toLowerCase().includes(q)) ||
            (userItem.phone && String(userItem.phone).includes(q))
        );
    });

    const RAINBOW_THEMES = [
        { 
            border: '#10b981', 
            bg: '#f0fdf4', 
            borderBottom: '#dcfce7',
            avatarBg: '#059669', 
            avatarBorder: '#86efac', 
            avatarColor: '#ffffff',
            hospBg: '#ecfdf5',
            hospBorder: '#a7f3d0',
            hospColor: '#047857',
            planBg: '#d1fae5',
            planBorder: '#6ee7b7',
            planColor: '#065f46',
            roleBg: '#dcfce7',
            roleBorder: '#bbf7d0',
            roleColor: '#065f46'
        },
        { 
            border: '#8b5cf6', 
            bg: '#faf5ff', 
            borderBottom: '#f3e8ff',
            avatarBg: '#7c3aed', 
            avatarBorder: '#d8b4fe', 
            avatarColor: '#ffffff',
            hospBg: '#f5f3ff',
            hospBorder: '#ddd6fe',
            hospColor: '#6d28d9',
            planBg: '#ede9fe',
            planBorder: '#c4b5fd',
            planColor: '#5b21b6',
            roleBg: '#f3e8ff',
            roleBorder: '#e9d5ff',
            roleColor: '#581c87'
        },
        { 
            border: '#ec4899', 
            bg: '#fdf2f8', 
            borderBottom: '#fce7f3',
            avatarBg: '#db2777', 
            avatarBorder: '#fbcfe8', 
            avatarColor: '#ffffff',
            hospBg: '#fdf2f8',
            hospBorder: '#f9a8d4',
            hospColor: '#be185d',
            planBg: '#fce7f3',
            planBorder: '#f472b6',
            planColor: '#9d174d',
            roleBg: '#fce7f3',
            roleBorder: '#fbcfe8',
            roleColor: '#831843'
        },
        { 
            border: '#0284c7', 
            bg: '#f0f9ff', 
            borderBottom: '#e0f2fe',
            avatarBg: '#0284c7', 
            avatarBorder: '#7dd3fc', 
            avatarColor: '#ffffff',
            hospBg: '#f0f9ff',
            hospBorder: '#7dd3fc',
            hospColor: '#0369a1',
            planBg: '#e0f2fe',
            planBorder: '#7dd3fc',
            planColor: '#0369a1',
            roleBg: '#e0f2fe',
            roleBorder: '#bae6fd',
            roleColor: '#075985'
        },
        { 
            border: '#ef4444', 
            bg: '#fef2f2', 
            borderBottom: '#fee2e2',
            avatarBg: '#dc2626', 
            avatarBorder: '#fca5a5', 
            avatarColor: '#ffffff',
            hospBg: '#fef2f2',
            hospBorder: '#f87171',
            hospColor: '#b91c1c',
            planBg: '#fee2e2',
            planBorder: '#fca5a5',
            planColor: '#991b1b',
            roleBg: '#fee2e2',
            roleBorder: '#fca5a5',
            roleColor: '#991b1b'
        }
    ];

    const getPlanBadge = (userItem) => {
        const rawPlan = (userItem.hospitalId ? (hospitals.find(h => h._id === String(userItem.hospitalId))?.plan || userItem.planName) : userItem.planName) || hospital?.subscriptionPlan || 'enterprise';
        const p = String(rawPlan).toLowerCase();
        if (p.includes('starter')) return { label: 'Simple Clinics (Starter)', key: 'starter', bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' };
        if (p.includes('clinic_basic') || p.includes('clinic basic')) return { label: 'Clinic Basic', key: 'clinic_basic', bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb' };
        if (p.includes('multi_speciality') || p.includes('speciality')) return { label: 'Multi-Speciality Starter', key: 'multi_speciality_starter', bg: '#faf5ff', border: '#e9d5ff', color: '#9333ea' };
        return { label: 'Enterprise', key: 'enterprise', bg: '#fff1f2', border: '#fecdd3', color: '#e11d48' };
    };

    return (
        <ScrollView style={styles.superadminPage} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.superadminContainer}>
                {error ? <View style={styles.errorMessage}><Text style={styles.errorMessageText}>{error}</Text></View> : null}
                {success ? <View style={styles.successMessage}><Text style={styles.successMessageText}>{success}</Text></View> : null}

                {/* ANIMATED TOP CARD: Create Staff Account */}
                <View style={[styles.staffCreateCard, { marginBottom: 16 }]}>
                    <ExpoLinearGradient
                        colors={['#10b981', '#8b5cf6', '#ec4899', '#0284c7', '#ef4444']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.topGradientBar}
                    />
                    <View style={styles.staffCreateHeader}>
                        <View style={styles.staffCreateTitleWrap}>
                            <View style={styles.staffCreateIconBadge}>
                                <Text style={{ fontSize: 18 }}>👥</Text>
                            </View>
                            <Text style={styles.staffCreateTitle}>Create Staff Account</Text>
                            {remainingStaff > 0 && (
                                <View style={styles.staffQuotaPill}>
                                    <View style={styles.staffQuotaDot} />
                                    <Text style={styles.staffQuotaText}>{remainingStaff} left</Text>
                                </View>
                            )}
                        </View>

                        {!isStaffQuotaFull && (
                            <TouchableOpacity 
                                onPress={handleToggleCreateForm} 
                                style={[styles.btnAddStaffAnimated, showCreateForm && styles.btnAddStaffClose]}
                            >
                                <Text style={[styles.btnAddStaffText, showCreateForm && { color: '#475569' }]}>
                                    {showCreateForm ? '✕ Close Form' : '+ Add Staff'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {showCreateForm && (
                        <View style={styles.staffFormExpandable}>
                            {hospital?.clinicType === 'clinic' && clinicDoctorExists && (
                                <View style={{ backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#fecaca' }}>
                                    <Text style={{ color: '#dc2626', fontSize: 14 }}>⚠️ This clinic already has an assigned Clinic Doctor. Only 1 Doctor account is permitted under this plan.</Text>
                                </View>
                            )}
                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Full Name *</Text>
                                    <StaffInput 
                                        placeholder="e.g. Dr. Sharma" 
                                        value={createForm.name} 
                                        onChangeText={t => setCreateForm({ ...createForm, name: t })} 
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Email Address *</Text>
                                    <StaffInput 
                                        placeholder="staff@hospital.com" 
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={createForm.email} 
                                        onChangeText={t => setCreateForm({ ...createForm, email: t })} 
                                    />
                                </View>
                            </View>
                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Password *</Text>
                                    <StaffInput 
                                        placeholder="Temporary password" 
                                        secureTextEntry
                                        value={createForm.password} 
                                        onChangeText={t => setCreateForm({ ...createForm, password: t })} 
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Phone *</Text>
                                    <StaffInput 
                                        placeholder="e.g. 9876543210" 
                                        keyboardType="numeric"
                                        maxLength={10}
                                        value={createForm.phone} 
                                        onChangeText={t => {
                                            const cleanVal = t.replace(/\D/g, '').slice(0, 10);
                                            setCreateForm({ ...createForm, phone: cleanVal });
                                        }} 
                                    />
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Profile Image</Text>
                                    <TouchableOpacity style={[styles.staffInput, { justifyContent: 'center', backgroundColor: '#f8fafc' }]}>
                                        <Text style={{ color: '#64748b', fontSize: 13 }}>Upload Image (Mock)...</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={[styles.formGroup, { zIndex: 10 }]}>
                                    <Text style={styles.staffLabel}>Assign Role *</Text>
                                    <CustomSelect 
                                        options={availableRoles}
                                        value={createForm.roleId}
                                        onChange={(v) => setCreateForm({ ...createForm, roleId: v })}
                                        placeholder="-- Select a Role --"
                                    />
                                </View>
                            </View>
                            
                            {availableDepts.length > 0 && (
                                <View style={[styles.formRow, { marginTop: 10, zIndex: 9 }]}>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.staffLabel}>Assign Department (Optional)</Text>
                                        <CustomSelect 
                                            options={availableDepts}
                                            value={createForm.department}
                                            onChange={(v) => setCreateForm(prev => ({ ...prev, department: v }))}
                                            placeholder="-- Select Department --"
                                        />
                                    </View>
                                </View>
                            )}
                            
                            <View style={{ marginTop: 20, flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                                <TouchableOpacity onPress={() => setShowCreateForm(false)} style={styles.btnCancel}>
                                    <Text style={{ color: '#64748b', fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleCreateStaff} disabled={creating} style={[styles.primaryBtn, { backgroundColor: '#0f766e', opacity: creating ? 0.7 : 1 }]}>
                                    <Text style={{ color: 'white', fontWeight: '600' }}>{creating ? 'Creating...' : 'Create Staff Account'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* Quota Card */}
                {hospital && (hospital.subscriptionPlan === 'clinic_basic' || hospital.subscriptionPlan === 'multi_speciality_starter') && (
                    <View style={styles.quotaCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <Text style={{ fontSize: 16 }}>📊</Text>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a' }}>Subscription Quota (Staff)</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                            <View style={styles.quotaBox}>
                                <Text style={styles.quotaBoxLabel}>Staff Accounts</Text>
                                <Text style={styles.quotaBoxVal}>{currentStaffCount} / {maxStaffCount} Used</Text>
                            </View>
                            <View style={[styles.quotaBox, { backgroundColor: remainingStaff === 0 ? '#fee2e2' : '#f0fdf4', borderColor: remainingStaff === 0 ? '#fecaca' : '#bbf7d0' }]}>
                                <Text style={[styles.quotaBoxLabel, { color: remainingStaff === 0 ? '#dc2626' : '#16a34a' }]}>Remaining</Text>
                                <Text style={[styles.quotaBoxVal, { color: remainingStaff === 0 ? '#dc2626' : '#16a34a' }]}>{remainingStaff}</Text>
                            </View>
                        </View>
                        {remainingStaff === 0 && (
                            <View style={styles.quotaWarning}>
                                <Text style={styles.quotaWarningText}>⚠️ Staff quota has been fully utilized. Upgrade your plan to add more staff.</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* ALL STAFF SECTION (With 5 Rainbow Themes) */}
                <View style={styles.staffMainCard}>
                    <View style={styles.staffMainHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={styles.staffTitleText}>All Staff</Text>
                            <View style={styles.staffCountBadge}>
                                <Text style={styles.staffCountBadgeText}>{filteredUsers.length}</Text>
                            </View>
                        </View>
                        
                        <View style={[styles.staffSearchContainer, searchFocused && styles.staffSearchContainerFocused]}>
                            <Feather name="search" size={15} color={searchFocused ? '#3b82f6' : '#64748b'} style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.staffSearchInput}
                                placeholder="Search name, email, phone..."
                                placeholderTextColor="#94a3b8"
                                value={staffSearchQuery}
                                onChangeText={setStaffSearchQuery}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => setSearchFocused(false)}
                            />
                            {staffSearchQuery ? (
                                <TouchableOpacity onPress={() => setStaffSearchQuery('')}>
                                    <Text style={{ color: '#94a3b8', fontSize: 14, paddingHorizontal: 4 }}>✕</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {['superadmin', 'centraladmin'].includes(currentUser.role) && (
                            <View style={{ flexDirection: 'row', gap: 10, zIndex: 10, flexWrap: 'wrap' }}>
                                <View style={{ width: 180, zIndex: 11 }}>
                                    <CustomSelect 
                                        options={planOptions}
                                        value={staffPlanFilter}
                                        onChange={(val) => {
                                            setStaffPlanFilter(val);
                                            setStaffHospitalFilter('');
                                            fetchUsers(val, '');
                                            fetchHospitals(val);
                                        }}
                                        placeholder="All Plans"
                                    />
                                </View>
                                <View style={{ width: 180, zIndex: 10 }}>
                                    <CustomSelect 
                                        options={hospitalOptions}
                                        value={staffHospitalFilter}
                                        onChange={(val) => {
                                            setStaffHospitalFilter(val);
                                            fetchUsers(staffPlanFilter, val);
                                        }}
                                        placeholder="All Hospitals"
                                    />
                                </View>
                            </View>
                        )}
                    </View>

                    {loadingUsers ? (
                        <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator size="large" color="#0d9488" /></View>
                    ) : filteredUsers.length === 0 ? (
                        <View style={styles.staffEmptyState}>
                            <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e293b' }}>No staff found</Text>
                            <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>No staff members match your current search or filters.</Text>
                            {staffSearchQuery ? (
                                <TouchableOpacity onPress={() => setStaffSearchQuery('')} style={{ marginTop: 12, backgroundColor: '#f1f5f9', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 }}>
                                    <Text style={{ color: '#475569', fontSize: 12, fontWeight: '600' }}>Clear Search</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.usersTableWrapper}>
                            <View style={{ minWidth: 1090 }}>
                                <View style={styles.tableHeaderRow}>
                                    <Text style={[styles.th, { width: 60 }]}>Avatar</Text>
                                    <Text style={[styles.th, { width: 160 }]}>Name</Text>
                                    <Text style={[styles.th, { width: 150 }]}>Hospital</Text>
                                    <Text style={[styles.th, { width: 160 }]}>Plan Name</Text>
                                    <Text style={[styles.th, { width: 130 }]}>Role</Text>
                                    <Text style={[styles.th, { width: 200 }]}>Email</Text>
                                    <Text style={[styles.th, { width: 120 }]}>Phone</Text>
                                    <Text style={[styles.th, { width: 130 }]}>Actions</Text>
                                </View>
                                
                                {filteredUsers.map((userItem, index) => {
                                    const isCurrentUser = (userItem.id || userItem._id) === currentUser.id;
                                    const canModify = !isCurrentUser;
                                    const roleStr = (userItem.role || '').toLowerCase();
                                    const theme = RAINBOW_THEMES[index % RAINBOW_THEMES.length];
                                    const planInfo = getPlanBadge(userItem);
                                    
                                    let roleBg = theme.roleBg, roleColor = theme.roleColor, roleBorder = theme.roleBorder;
                                    if (roleStr.includes('admin')) { roleBg = '#fee2e2'; roleColor = '#dc2626'; roleBorder = '#fecaca'; }
                                    else if (roleStr.includes('doctor')) { roleBg = '#dbeafe'; roleColor = '#2563eb'; roleBorder = '#bfdbfe'; }
                                    else if (roleStr.includes('lab')) { roleBg = '#f3e8ff'; roleColor = '#9333ea'; roleBorder = '#e9d5ff'; }
                                    else if (roleStr.includes('pharmacy')) { roleBg = '#ffedd5'; roleColor = '#ea580c'; roleBorder = '#fed7aa'; }
                                    else if (roleStr.includes('reception')) { roleBg = '#dcfce7'; roleColor = '#166534'; roleBorder = '#bbf7d0'; }

                                    return (
                                        <View 
                                            key={userItem.id || userItem._id} 
                                            style={[
                                                styles.tableRow, 
                                                { 
                                                    borderLeftWidth: 3, 
                                                    borderLeftColor: theme.border, 
                                                    backgroundColor: theme.bg,
                                                    borderBottomColor: theme.borderBottom,
                                                }
                                            ]}
                                        >
                                            <View style={{ width: 60, alignItems: 'center' }}>
                                                {userItem.avatar ? (
                                                    <Image source={{ uri: userItem.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                                                ) : (
                                                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.avatarBg, borderWidth: 2, borderColor: theme.avatarBorder, alignItems: 'center', justifyContent: 'center' }}>
                                                        <Text style={{ fontWeight: '700', color: theme.avatarColor, fontSize: 14 }}>{userItem.name?.charAt(0).toUpperCase() || 'S'}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={[styles.td, { width: 160, fontWeight: '700', color: '#0f172a' }]}>{userItem.name}</Text>
                                            <View style={{ width: 150 }}>
                                                <View style={[styles.staffHospTag, { backgroundColor: theme.hospBg, borderColor: theme.hospBorder }]}>
                                                    <Text style={[styles.staffHospTagText, { color: theme.hospColor }]} numberOfLines={1}>
                                                        {userItem.hospitalId ? (hospitals.find(h => h._id === String(userItem.hospitalId))?.name || hospital?.name || 'Unknown') : '⚠️ No hospital'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={{ width: 160 }}>
                                                <View style={[styles.staffPlanTag, { backgroundColor: theme.planBg, borderColor: theme.planBorder }]}>
                                                    <Text style={[styles.staffPlanTagText, { color: theme.planColor }]} numberOfLines={1}>
                                                        {planInfo.label}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={{ width: 130 }}>
                                                <View style={[styles.staffRoleTag, { backgroundColor: roleBg, borderColor: roleBorder }]}>
                                                    <Text style={[styles.staffRoleTagText, { color: roleColor }]}>{(userItem.role || 'No Role').toUpperCase()}</Text>
                                                </View>
                                            </View>
                                            <Text style={[styles.td, { width: 200, color: '#334155', fontWeight: '500' }]} numberOfLines={1}>{userItem.email}</Text>
                                            <Text style={[styles.td, { width: 120, color: '#334155', fontWeight: '500' }]}>{userItem.phone || '—'}</Text>
                                            <View style={{ width: 130, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                                {canModify && (
                                                    <>
                                                        <TouchableOpacity onPress={() => openEditModal(userItem)} style={styles.btnEdit}>
                                                            <Text style={{ color: '#2563eb', fontWeight: '600', fontSize: 12 }}>Edit</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => setDeleteConfirm(userItem.id || userItem._id)} style={styles.btnDelete}>
                                                            <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 12 }}>
                                                                {deletingId === (userItem.id || userItem._id) ? '...' : 'Delete'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>

            {/* EDIT USER MODAL */}
            <Modal visible={editModal} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Staff Details</Text>
                        <View style={styles.userForm}>
                            <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center', marginBottom: 20 }}>
                                <View>
                                    {editForm.currentAvatar ? (
                                        <Image source={{ uri: editForm.currentAvatar }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                                    ) : (
                                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#cbd5e1' }} />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.staffLabel}>Change Photo (Native Mock)</Text>
                                    <View style={[styles.staffInput, { justifyContent: 'center', backgroundColor: '#f8fafc' }]}>
                                        <Text style={{ color: '#64748b' }}>Select Image...</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Name</Text>
                                    <StaffInput value={editForm.name} onChangeText={t => setEditForm({ ...editForm, name: t })} />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Email</Text>
                                    <StaffInput value={editForm.email} onChangeText={t => setEditForm({ ...editForm, email: t })} />
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Phone</Text>
                                    <StaffInput
                                        placeholder="e.g. 9876543210"
                                        keyboardType="numeric"
                                        maxLength={10}
                                        value={editForm.phone}
                                        onChangeText={t => {
                                            const cleanVal = t.replace(/\D/g, '').slice(0, 10);
                                            setEditForm({ ...editForm, phone: cleanVal });
                                        }}
                                    />
                                </View>
                                <View style={[styles.formGroup, { zIndex: 10 }]}>
                                    <Text style={styles.staffLabel}>Role</Text>
                                    <CustomSelect 
                                        disabled={true}
                                        options={availableRoles}
                                        value={editForm.roleId}
                                        onChange={() => {}}
                                        placeholder="Role"
                                    />
                                </View>
                            </View>

                            {availableDepts.length > 0 && (
                                <View style={[styles.formRow, { marginTop: 10, zIndex: 9 }]}>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.staffLabel}>Assign Department (Optional)</Text>
                                        <CustomSelect 
                                            options={availableDepts}
                                            value={editForm.department}
                                            onChange={(v) => setEditForm(prev => ({ ...prev, department: v }))}
                                            placeholder="-- Select Department --"
                                        />
                                    </View>
                                </View>
                            )}

                            <View style={styles.modalButtons}>
                                <TouchableOpacity onPress={() => setEditModal(false)} style={styles.btnCancel}>
                                    <Text style={{ color: '#64748b', fontWeight: '600' }}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleUpdateUser} disabled={updating} style={styles.btnSave}>
                                    <Text style={{ color: 'white', fontWeight: '600' }}>{updating ? 'Saving...' : 'Save Changes'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* DELETE MODAL */}
            <Modal visible={!!deleteConfirm} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Confirm Delete</Text>
                        <Text style={styles.modalText}>Are you sure? This action cannot be undone.</Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setDeleteConfirm(null)} disabled={deletingId !== null} style={styles.btnCancel}>
                                <Text style={{ color: '#64748b', fontWeight: '600' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteUser(deleteConfirm)} disabled={deletingId !== null} style={styles.btnConfirmDelete}>
                                <Text style={{ color: 'white', fontWeight: '700' }}>{deletingId !== null ? 'Deleting...' : 'Delete'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    superadminPage: {
        flex: 1,
        backgroundColor: '#f8fafc',
        padding: 16,
    },
    superadminContainer: {
        maxWidth: 1400,
        marginHorizontal: 'auto',
        width: '100%',
    },
    adminHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
        padding: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        borderRadius: 24,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        borderWidth: 1,
        flexWrap: 'wrap',
        gap: 20
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0d9488',
        marginBottom: 8,
    },
    headerSubtitle: {
        color: '#64748b',
        fontSize: 16,
        fontWeight: '500',
    },
    adminUserInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    adminUserInfoText: {
        fontWeight: '600',
        color: '#0f172a',
        fontSize: 16,
    },
    logoutBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#ef4444',
        borderRadius: 12,
    },
    logoutBtnText: {
        color: 'white',
        fontWeight: '700',
    },
    adminCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        borderRadius: 24,
        padding: 24,
        marginBottom: 32,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        borderWidth: 1,
    },
    cardTitle: {
        fontSize: 22,
        color: '#0f172a',
        fontWeight: '700',
    },
    staffInput: {
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderColor: 'rgba(203, 213, 225, 0.8)',
        borderWidth: 1,
        backgroundColor: '#ffffff',
        color: '#0f172a',
        fontSize: 14,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
                outlineWidth: 0,
            }
        })
    },
    staffInputFocused: {
        borderColor: '#0d9488',
        ...Platform.select({
            web: {
                boxShadow: '0 0 0 4px rgba(13, 148, 136, 0.1)',
                outlineStyle: 'none',
                outlineWidth: 0,
            }
        }),
        shadowColor: '#0d9488',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    staffLabel: {
        marginBottom: 8,
        fontWeight: '700',
        fontSize: 12,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    userForm: {
        flexDirection: 'column',
        gap: 20,
    },
    formRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 20,
    },
    formGroup: {
        flex: 1,
        minWidth: 250,
        flexDirection: 'column',
        gap: 8,
    },
    errorMessage: {
        backgroundColor: '#fef2f2',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        borderColor: '#fee2e2',
        borderWidth: 1,
    },
    errorMessageText: {
        color: '#ef4444',
        fontWeight: '600',
    },
    successMessage: {
        backgroundColor: '#f0fdfa',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        borderColor: '#ccfbf1',
        borderWidth: 1,
    },
    successMessageText: {
        color: '#0d9488',
        fontWeight: '600',
    },
    primaryBtn: {
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    usersTableWrapper: {
        borderRadius: 14,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        overflow: 'hidden',
        backgroundColor: '#ffffff',
    },
    usersTable: {
        minWidth: 800,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 13,
        paddingHorizontal: 16,
    },
    th: {
        fontWeight: '800',
        color: '#64748b',
        textTransform: 'uppercase',
        fontSize: 11,
        letterSpacing: 0.6,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        backgroundColor: '#ffffff',
    },
    td: {
        color: '#0f172a',
        fontSize: 14,
    },
    btnEdit: {
        backgroundColor: '#eff6ff',
        borderColor: '#bfdbfe',
        borderWidth: 1,
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    btnDelete: {
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
        borderWidth: 1,
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    btnSave: {
        backgroundColor: '#0d9488',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    btnCancel: {
        backgroundColor: 'white',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 30,
        width: '100%',
        maxWidth: 480,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 16,
    },
    modalText: {
        color: '#64748b',
        fontSize: 15,
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 20,
    },
    btnConfirmDelete: {
        backgroundColor: '#ef4444',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    dropdownMenu: {
        position: 'absolute',
        top: 45,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderColor: '#767676',
        borderWidth: 1,
        borderRadius: 2,
        zIndex: 100,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
    },
    dropdownItem: {
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    dropdownItemActive: {
        backgroundColor: '#1a73e8',
    },
    dropdownItemText: {
        color: '#000',
        fontSize: 14,
    },
    dropdownItemTextActive: {
        color: '#fff',
    },
    staffCreateCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 22,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    topGradientBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
    },
    staffCreateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
    },
    staffCreateTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    staffCreateIconBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#0d9488',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0d9488',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 3,
    },
    staffCreateTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    staffQuotaPill: {
        backgroundColor: '#ecfdf5',
        borderColor: '#a7f3d0',
        borderWidth: 1,
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    staffQuotaDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10b981',
    },
    staffQuotaText: {
        color: '#059669',
        fontSize: 12,
        fontWeight: '750',
    },
    btnAddStaffAnimated: {
        backgroundColor: '#0d9488',
        paddingVertical: 9,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0d9488',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 3,
    },
    btnAddStaffClose: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        shadowOpacity: 0,
        elevation: 0,
    },
    btnAddStaffText: {
        color: '#ffffff',
        fontWeight: '750',
        fontSize: 14,
    },
    staffFormExpandable: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    quotaCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 20,
        marginBottom: 16,
    },
    quotaBox: {
        flex: 1,
        minWidth: 160,
        backgroundColor: '#ffffff',
        padding: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    quotaBoxLabel: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
    },
    quotaBoxVal: {
        fontSize: 20,
        fontWeight: '800',
        color: '#334155',
    },
    quotaWarning: {
        marginTop: 14,
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    quotaWarningText: {
        color: '#dc2626',
        fontSize: 13,
        fontWeight: '600',
    },
    staffMainCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 22,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 1,
    },
    staffMainHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 12,
    },
    staffTitleText: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.2,
    },
    staffCountBadge: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderRadius: 20,
    },
    staffCountBadgeText: {
        color: '#475569',
        fontSize: 12,
        fontWeight: '750',
    },
    staffSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 38,
        minWidth: 220,
        maxWidth: 320,
        flex: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
    },
    staffSearchContainerFocused: {
        borderColor: '#3b82f6',
        ...Platform.select({
            web: {
                boxShadow: '0 3px 12px rgba(59, 130, 246, 0.15)',
            }
        }),
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 2,
    },
    staffSearchInput: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: '#0f172a',
        borderWidth: 0,
        backgroundColor: 'transparent',
        ...Platform.select({
            web: {
                outlineStyle: 'none',
                outlineWidth: 0,
            }
        })
    },
    staffEmptyState: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    staffHospTag: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        alignSelf: 'flex-start',
        borderWidth: 1,
        maxWidth: 140,
    },
    staffHospTagText: {
        fontSize: 11,
        fontWeight: '700',
    },
    staffPlanTag: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        alignSelf: 'flex-start',
        borderWidth: 1,
        maxWidth: 150,
    },
    staffPlanTagText: {
        fontSize: 11,
        fontWeight: '700',
    },
    staffRoleTag: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 20,
        alignSelf: 'flex-start',
        borderWidth: 1,
    },
    staffRoleTagText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    }
});

export default Admin;
