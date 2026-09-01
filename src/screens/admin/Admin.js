import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, ScrollView, Image, 
    StyleSheet, ActivityIndicator, Alert, Modal, Platform 
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { adminAPI, uploadAPI, hospitalAPI } from '../../utils/api';
import { getSubscriptionLimits } from '../../utils/subscriptionPlans';

// --- Custom Select Dropdown ---
const CustomSelect = ({ options, value, onChange, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedObj = options.find(o => o.value === value);
    const selectedName = selectedObj ? selectedObj.label : placeholder;

    return (
        <View style={{ position: 'relative', width: '100%', zIndex: isOpen ? 50 : 1 }}>
            <TouchableOpacity 
                style={[styles.staffInput, { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, disabled && { opacity: 0.6 }]} 
                onPress={() => !disabled && setIsOpen(!isOpen)}
                activeOpacity={0.7}
            >
                <Text style={{ color: value ? '#000' : '#94a3b8' }} numberOfLines={1}>{selectedName}</Text>
                <Feather name="chevron-down" size={14} color="#64748b" />
            </TouchableOpacity>

            {isOpen && (
                <View style={styles.dropdownMenu}>
                    <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 160 }}>
                        <TouchableOpacity 
                            onPress={() => { onChange(''); setIsOpen(false); }}
                            style={[styles.dropdownItem, value === '' && styles.dropdownItemActive]}
                        >
                            <Text style={[styles.dropdownItemText, value === '' && styles.dropdownItemTextActive]}>{placeholder}</Text>
                        </TouchableOpacity>
                        {options.map(opt => (
                            <TouchableOpacity 
                                key={opt.value}
                                onPress={() => { onChange(opt.value); setIsOpen(false); }}
                                style={[styles.dropdownItem, opt.value === value && styles.dropdownItemActive]}
                            >
                                <Text style={[styles.dropdownItemText, opt.value === value && styles.dropdownItemTextActive]}>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
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

    const fetchRoles = async () => {
        try {
            const response = await adminAPI.getRoles();
            console.log("🔥 API RESPONSE (Roles):", response);
            const actualData = response?.data?.data || response?.data?.roles || response?.roles || response?.data || response || [];
            setRoles(Array.isArray(actualData) ? actualData : []);
        } catch (err) {
            console.error('Error fetching roles:', err);
        }
    };

    const fetchUsers = async (plan = staffPlanFilter, hospitalId = staffHospitalFilter) => {
        try {
            setLoadingUsers(true);
            const response = await adminAPI.getUsers(plan, hospitalId);
            console.log("🔥 API RESPONSE (Users):", response);
            
            const actualData = response?.data?.data || response?.data?.users || response?.users || response?.data || response || [];
            const safeUsers = Array.isArray(actualData) ? actualData : [];

            if (response.success || safeUsers.length > 0) {
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
            }
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Error fetching users');
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

    return (
        <ScrollView style={styles.superadminPage} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.superadminContainer}>
                {/* Header */}
                <View style={styles.adminHeader}>
                    <View style={{ marginBottom: 16 }}>
                        <Text style={styles.headerTitle}>Admin Dashboard</Text>
                        <Text style={styles.headerSubtitle}>Manage staff accounts, roles, and permissions</Text>
                    </View>
                    <View style={styles.adminUserInfo}>
                        <Text style={styles.adminUserInfoText}>Welcome, {currentUser.name}</Text>
                        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                            <Text style={styles.logoutBtnText}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {error ? <View style={styles.errorMessage}><Text style={styles.errorMessageText}>{error}</Text></View> : null}
                {success ? <View style={styles.successMessage}><Text style={styles.successMessageText}>{success}</Text></View> : null}

                {/* Create Staff Account */}
                <View style={[styles.adminCard, { marginBottom: 20 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: showCreateForm ? 20 : 0, flexWrap: 'wrap', gap: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={styles.cardTitle}>Create Staff Account</Text>
                            {remainingStaff > 0 && (
                                <View style={{ backgroundColor: '#dcfce7', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 }}>
                                    <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: '600' }}>{remainingStaff} left</Text>
                                </View>
                            )}
                        </View>
                        {!isStaffQuotaFull && (
                            <TouchableOpacity 
                                onPress={handleToggleCreateForm} 
                                style={[styles.btnEdit, { backgroundColor: showCreateForm ? '#f1f5f9' : '#eef2ff', borderWidth: 0 }]}
                            >
                                <Text style={{ color: showCreateForm ? '#64748b' : '#4f46e5', fontWeight: '600' }}>
                                    {showCreateForm ? '✕ Close' : '+ Add Staff'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {showCreateForm && (
                        <View style={styles.userForm}>
                            {hospital?.clinicType === 'clinic' && clinicDoctorExists && (
                                <View style={{ backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#fecaca' }}>
                                    <Text style={{ color: '#dc2626', fontSize: 14 }}>⚠️ This clinic already has an assigned Clinic Doctor. Only 1 Doctor account is permitted under this plan.</Text>
                                </View>
                            )}
                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Full Name *</Text>
                                    <TextInput 
                                        style={styles.staffInput} 
                                        placeholder="e.g. Dr. Sharma" 
                                        value={createForm.name} 
                                        onChangeText={t => setCreateForm({ ...createForm, name: t })} 
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Email Address *</Text>
                                    <TextInput 
                                        style={styles.staffInput} 
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
                                    <TextInput 
                                        style={styles.staffInput} 
                                        placeholder="Temporary password" 
                                        secureTextEntry
                                        value={createForm.password} 
                                        onChangeText={t => setCreateForm({ ...createForm, password: t })} 
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Phone *</Text>
                                    <TextInput 
                                        style={styles.staffInput} 
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
                                    {/* Mocking file input for RN */}
                                    <TouchableOpacity style={[styles.staffInput, { justifyContent: 'center', backgroundColor: '#f8fafc' }]}>
                                        <Text style={{ color: '#64748b' }}>Upload Image...</Text>
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
                                    <Text style={{ color: 'white', fontWeight: '500' }}>{creating ? 'Creating...' : 'Create Staff Account'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* Quota Card */}
                {hospital && (hospital.subscriptionPlan === 'clinic_basic' || hospital.subscriptionPlan === 'multi_speciality_starter') && (
                    <View style={[styles.adminCard, { marginBottom: 20, backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
                        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                            <Feather name="pie-chart" size={16} color="#0f172a" style={{marginRight: 8}} />
                            <Text style={[styles.cardTitle, { fontSize: 15, marginBottom: 0 }]}>Subscription Quota (Staff)</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap' }}>
                            <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 8, borderColor: '#cbd5e1', borderWidth: 1, flex: 1, minWidth: 150 }}>
                                <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600' }}>Staff Accounts</Text>
                                <Text style={{ fontSize: 20, fontWeight: '700', color: '#334155' }}>{currentStaffCount} / {maxStaffCount} Used</Text>
                            </View>
                            <View style={{ backgroundColor: remainingStaff === 0 ? '#fee2e2' : '#f0fdf4', padding: 16, borderRadius: 8, borderWidth: 1, borderColor: remainingStaff === 0 ? '#fecaca' : '#bbf7d0', flex: 1, minWidth: 150 }}>
                                <Text style={{ color: remainingStaff === 0 ? '#dc2626' : '#16a34a', fontSize: 12, fontWeight: '600' }}>Remaining</Text>
                                <Text style={{ fontSize: 20, fontWeight: '700', color: remainingStaff === 0 ? '#dc2626' : '#16a34a' }}>{remainingStaff}</Text>
                            </View>
                        </View>
                        {remainingStaff === 0 && (
                            <View style={{ backgroundColor: '#fee2e2', padding: 16, borderRadius: 8, borderColor: '#fecaca', borderWidth: 1, marginTop: 16, flexDirection: 'row', alignItems: 'center' }}>
                                <Feather name="alert-triangle" size={16} color="#dc2626" style={{marginRight: 8}} />
                                <Text style={{ color: '#dc2626', fontSize: 13, fontWeight: '600', flex: 1 }}>Staff quota has been fully utilized. Upgrade your plan to add more staff.</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* All Staff */}
                <View style={styles.adminCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                        <Text style={styles.cardTitle}>All Staff ({users.length})</Text>
                        
                        <View style={{ flex: 1, minWidth: 200, maxWidth: 300 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 4, paddingHorizontal: 10, height: 38 }}>
                                <Feather name="search" size={14} color="#94a3b8" />
                                <TextInput
                                    style={{ flex: 1, paddingHorizontal: 8, height: '100%', outlineStyle: 'none' }}
                                    placeholder="Search by name, email..."
                                    value={staffSearchQuery}
                                    onChangeText={setStaffSearchQuery}
                                />
                            </View>
                        </View>

                        {['superadmin', 'centraladmin'].includes(currentUser.role) && (
                            <View style={{ flexDirection: 'row', gap: 10, zIndex: 10 }}>
                                <View style={{ width: 200, zIndex: 11 }}>
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
                                <View style={{ width: 200, zIndex: 10 }}>
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
                        <View style={{ padding: 20, alignItems: 'center' }}><ActivityIndicator size="large" color="#0d9488" /></View>
                    ) : users.length === 0 ? (
                        <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: '#64748b' }}>No users found for this selection</Text></View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.usersTableWrapper}>
                            <View style={styles.usersTable}>
                                <View style={styles.tableHeaderRow}>
                                    <Text style={[styles.th, { width: 60 }]}>Avatar</Text>
                                    <Text style={[styles.th, { width: 150 }]}>Name</Text>
                                    <Text style={[styles.th, { width: 150 }]}>Hospital</Text>
                                    <Text style={[styles.th, { width: 150 }]}>Plan</Text>
                                    <Text style={[styles.th, { width: 120 }]}>Role</Text>
                                    <Text style={[styles.th, { width: 200 }]}>Email</Text>
                                    <Text style={[styles.th, { width: 120 }]}>Phone</Text>
                                    <Text style={[styles.th, { width: 150 }]}>Actions</Text>
                                </View>
                                
                                {filteredUsers.map((userItem) => {
                                    const isCurrentUser = (userItem.id || userItem._id) === currentUser.id;
                                    const canModify = !isCurrentUser;
                                    const roleStr = (userItem.role || '').toLowerCase();
                                    
                                    let roleBg = '#f1f5f9', roleColor = '#64748b', roleBorder = '#e2e8f0';
                                    if (roleStr.includes('admin')) { roleBg = '#fee2e2'; roleColor = '#dc2626'; roleBorder = '#fecaca'; }
                                    else if (roleStr.includes('doctor')) { roleBg = '#dbeafe'; roleColor = '#2563eb'; roleBorder = '#bfdbfe'; }
                                    else if (roleStr.includes('lab')) { roleBg = '#f3e8ff'; roleColor = '#9333ea'; roleBorder = '#e9d5ff'; }
                                    else if (roleStr.includes('pharmacy')) { roleBg = '#ffedd5'; roleColor = '#ea580c'; roleBorder = '#fed7aa'; }
                                    else if (roleStr.includes('reception')) { roleBg = '#dcfce7'; roleColor = '#166534'; roleBorder = '#bbf7d0'; }

                                    return (
                                        <View key={userItem.id || userItem._id} style={styles.tableRow}>
                                            <View style={[styles.td, { width: 60 }]}>
                                                {userItem.avatar ? (
                                                    <Image source={{ uri: userItem.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                                                ) : (
                                                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Text style={{ fontWeight: '700', color: '#6366f1', fontSize: 14 }}>{userItem.name?.charAt(0).toUpperCase()}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={[styles.td, { width: 150, fontWeight: '500' }]}>{userItem.name}</Text>
                                            <View style={[styles.td, { width: 150 }]}>
                                                <View style={{ backgroundColor: '#f0f9ff', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#bae6fd' }}>
                                                    <Text style={{ color: '#0284c7', fontSize: 11, fontWeight: '700' }}>
                                                        {userItem.hospitalId ? (hospitals.find(h => h._id === String(userItem.hospitalId))?.name || hospital?.name || 'Unknown') : 'No hospital'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={[styles.td, { width: 150 }]}>
                                                <View style={{ backgroundColor: '#fdf4ff', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#fbcfe8' }}>
                                                    <Text style={{ color: '#d946ef', fontSize: 11, fontWeight: '700' }}>
                                                        {userItem.hospitalId ? (hospitals.find(h => h._id === String(userItem.hospitalId))?.plan || 'Enterprise') : 'Enterprise'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={[styles.td, { width: 120 }]}>
                                                <View style={{ backgroundColor: roleBg, borderColor: roleBorder, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, alignSelf: 'flex-start' }}>
                                                    <Text style={{ color: roleColor, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{(userItem.role || 'No Role').toUpperCase()}</Text>
                                                </View>
                                            </View>
                                            <Text style={[styles.td, { width: 200 }]} numberOfLines={1}>{userItem.email}</Text>
                                            <Text style={[styles.td, { width: 120 }]}>{userItem.phone || '—'}</Text>
                                            <View style={[styles.td, { width: 150, flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
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
                                    <TextInput style={styles.staffInput} value={editForm.name} onChangeText={t => setEditForm({ ...editForm, name: t })} />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Email</Text>
                                    <TextInput style={styles.staffInput} value={editForm.email} onChangeText={t => setEditForm({ ...editForm, email: t })} />
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Phone</Text>
                                    <TextInput
                                        style={styles.staffInput}
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
        backgroundColor: '#edf2f7',
        padding: 20,
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
        backgroundColor: 'white',
        color: '#0f172a',
        fontSize: 14,
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
        borderRadius: 16,
        borderColor: 'rgba(226, 232, 240, 0.6)',
        borderWidth: 1,
        overflow: 'hidden',
    },
    usersTable: {
        minWidth: 800,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(241, 245, 249, 0.5)',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    th: {
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        fontSize: 11,
        letterSpacing: 0.5,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    td: {
        color: '#0f172a',
        fontSize: 14,
    },
    btnEdit: {
        backgroundColor: '#eff6ff',
        borderColor: '#dbeafe',
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    btnDelete: {
        backgroundColor: '#fef2f2',
        borderColor: '#fee2e2',
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
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
    }
});

export default Admin;
