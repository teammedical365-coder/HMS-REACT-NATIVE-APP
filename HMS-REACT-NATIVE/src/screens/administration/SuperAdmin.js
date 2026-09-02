import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, ScrollView, Image, 
    StyleSheet, ActivityIndicator, Alert, Modal, Platform 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminAPI, uploadAPI } from '../../utils/api';
import { SafeAreaView } from 'react-native-safe-area-context';

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
                <Text style={{ fontSize: 12, color: '#64748b' }}>▼</Text>
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

const SuperAdmin = () => {
    const navigation = useNavigation();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [roles, setRoles] = useState([]);
    const [currentUser, setCurrentUser] = useState({});

    const [editModal, setEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        id: '', name: '', email: '', phone: '', roleId: '', currentAvatar: '', newAvatarFile: null, specialty: ''
    });
    const [updating, setUpdating] = useState(false);

    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Create Staff Form state
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: '', email: '', password: '', phone: '', roleId: '', file: null
    });
    const [creating, setCreating] = useState(false);

    const processFormChange = useCallback((name, value, formSetter) => {
        if (name === 'phone') {
            const cleanVal = value.replace(/\D/g, '').slice(0, 10);
            formSetter(prev => ({ ...prev, [name]: cleanVal }));
        }
        else {
            formSetter(prev => ({ ...prev, [name]: value }));
        }
    }, []);

    const handleCreateFormChange = useCallback(
        (name, value) => processFormChange(name, value, setCreateForm), 
        [processFormChange]
    );

    const handleEditFormChange = useCallback(
        (name, value) => processFormChange(name, value, setEditForm), 
        [processFormChange]
    );

    // Check auth
    useEffect(() => {
        const loadUser = async () => {
            const userStr = await AsyncStorage.getItem('user');
            const user = JSON.parse(userStr || '{}');
            setCurrentUser(user);
            if (user.role !== 'superadmin' && user.role !== 'centraladmin') {
                navigation.navigate('CentralAdminLogin');
            }
        };
        loadUser();
    }, [navigation]);

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);
            const response = await adminAPI.getUsers();
            if (response.success) {
                setUsers(response.users);
            }
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Error fetching users.');
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const response = await adminAPI.getRoles();
            if (response.success) {
                setRoles(response.data);
            }
        } catch (err) {
            console.error('Error fetching roles:', err);
        }
    };

    // Open Edit Modal
    const openEditModal = (userItem) => {
        setEditForm({
            id: userItem.id || userItem._id,
            name: userItem.name,
            email: userItem.email,
            phone: userItem.phone || '',
            roleId: userItem.roleId || userItem.role, // Assuming roleId is available or can be derived from role name
            currentAvatar: userItem.avatar,
            newAvatarFile: null,
            specialty: userItem.specialty || ''
        });
        setEditModal(true);
        setError('');
        setSuccess('');
    };

    // Update User Logic
    const handleUpdateUser = async () => {
        setUpdating(true);
        setError('');
        setSuccess('');

        try {
            let avatarUrl = editForm.currentAvatar;

            // 1. Upload new image if selected
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

            // 2. Prepare Update Data
            const updateData = {
                name: editForm.name,
                email: editForm.email,
                phone: editForm.phone,
                roleId: editForm.roleId,
                avatar: avatarUrl,
                specialty: editForm.specialty
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
        try {
            const response = await adminAPI.deleteUser(userId);
            if (response.success || response.status === 200) {
                setSuccess('User deleted successfully!');
                setDeleteConfirm(null);
                fetchUsers();
            }
        } catch (err) {
            setError('Error deleting user.');
            setDeleteConfirm(null);
        }
    };

    // --- Create Staff Account ---
    const handleCreateStaff = async () => {
        setCreating(true);
        setError('');
        setSuccess('');

        if (!createForm.name || !createForm.email || !createForm.password || !createForm.roleId) {
            setError('Name, email, password, and role are all required.');
            setCreating(false);
            return;
        }

        try {
            let avatarUrl = null;

            // 1. Upload Image if selected
            if (createForm.file) {
                const formData = new FormData();
                formData.append('images', {
                    uri: createForm.file.uri,
                    type: 'image/jpeg',
                    name: 'avatar.jpg'
                });

                // Use generic upload utility
                const uploadRes = await uploadAPI.uploadImages(formData);
                if (uploadRes.success && uploadRes.urls && uploadRes.urls.length > 0) {
                    avatarUrl = uploadRes.urls[0];
                } else if (uploadRes.success && uploadRes.files && uploadRes.files.length > 0) {
                    avatarUrl = uploadRes.files[0].url;
                }
            }

            // 2. Create User with avatar URL
            const userData = {
                ...createForm,
                avatar: avatarUrl
            };

            const response = await adminAPI.createUser(userData);
            if (response.success) {
                setSuccess(`✅ ${response.user?.role?.name || response.user?.role || 'Staff'} account created! They can now log in with: ${createForm.email}`);
                setCreateForm({ name: '', email: '', password: '', phone: '', roleId: '', file: null });
                setShowCreateForm(false);
                fetchUsers();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error creating staff account.');
        } finally {
            setCreating(false);
        }
    };

    const handleLogout = async () => {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        navigation.navigate('CentralAdminLogin');
    };

    const availableRoles = roles.map(role => ({
        label: `${role.name} ${role.description ? `— ${role.description}` : ''}`,
        value: role._id
    }));

    return (
        <ScrollView style={styles.superadminPage} contentContainerStyle={styles.superadminContainer}>
            
            <View style={styles.adminHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <Image source={require('../../../assets/medical365-logo.png')} style={{ height: 36, width: 150, marginRight: 10, resizeMode: 'contain' }} />
                    <View>
                        <Text style={styles.headerTitle}>SuperAdmin Dashboard</Text>
                        <Text style={styles.headerSubtitle}>Manage System Users & Staff Accounts</Text>
                    </View>
                </View>
                <View style={styles.adminUserInfo}>
                    <Text style={styles.adminUserInfoText}>Welcome, {currentUser.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity onPress={() => navigation.navigate('AdminRoles')} style={[styles.btnEdit, { paddingHorizontal: 16, paddingVertical: 8 }]}>
                            <Text style={{ color: '#2563eb', fontWeight: '600' }}>🔑 Manage Roles</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                            <Text style={styles.logoutBtnText}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {error ? <View style={styles.errorMessage}><Text style={styles.errorMessageText}>{error}</Text></View> : null}
            {success ? <View style={styles.successMessage}><Text style={styles.successMessageText}>{success}</Text></View> : null}

            {/* ==========================================
                QUICK CONFIGURATIONS SECTION
                ========================================== */}
            <View style={[styles.adminCard, { marginBottom: 20 }]}>
                <Text style={styles.cardTitle}>⚙️ Quick Configurations</Text>
                <Text style={{ color: '#888', fontSize: 14, marginVertical: 10 }}>
                    Setup forms, catalogs, and permissions for the hospital system.
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    <TouchableOpacity onPress={() => navigation.navigate('AdminRoles')} style={[styles.quickBtn, { backgroundColor: '#0d9488' }]}>
                        <Text style={styles.quickBtnText}>🔑 Roles</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('AdminQuestionLibrary')} style={[styles.quickBtn, { backgroundColor: '#8e44ad' }]}>
                        <Text style={styles.quickBtnText}>❓ Questions</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('AdminLabTests')} style={[styles.quickBtn, { backgroundColor: '#e83e8c' }]}>
                        <Text style={styles.quickBtnText}>🧪 Lab Tests</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('AdminMedicines')} style={[styles.quickBtn, { backgroundColor: '#e74c3c' }]}>
                        <Text style={styles.quickBtnText}>💊 Medicines</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('AdminServices')} style={[styles.quickBtn, { backgroundColor: '#e67e22' }]}>
                        <Text style={styles.quickBtnText}>🛠️ Services</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ==========================================
                CREATE STAFF ACCOUNT SECTION
                ========================================== */}
            <View style={[styles.adminCard, { marginBottom: 20 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={styles.cardTitle}>👤 Create Staff Account</Text>
                    <TouchableOpacity
                        onPress={() => setShowCreateForm(!showCreateForm)}
                        style={[styles.toggleBtn, showCreateForm ? styles.btnCancel : styles.btnSave]}
                    >
                        <Text style={showCreateForm ? styles.btnCancelText : styles.btnSaveText}>
                            {showCreateForm ? 'Cancel' : '+ New Staff'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {!showCreateForm && (
                    <Text style={{ color: '#888', fontSize: 14 }}>
                        Create login credentials for doctors, lab technicians, pharmacists, receptionists, or any custom role.
                    </Text>
                )}

                {showCreateForm && (
                    <View style={styles.userForm}>
                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.staffLabel}>Full Name *</Text>
                                <TextInput style={styles.staffInput} placeholder="e.g. Dr. Sharma" placeholderTextColor="#94a3b8" value={createForm.name} onChangeText={(t) => handleCreateFormChange('name', t)} />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.staffLabel}>Email Address *</Text>
                                <TextInput style={styles.staffInput} placeholder="e.g. dr.sharma@hospital.com" placeholderTextColor="#94a3b8" value={createForm.email} onChangeText={(t) => handleCreateFormChange('email', t)} keyboardType="email-address" autoCapitalize="none" />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.staffLabel}>Password *</Text>
                                <TextInput style={styles.staffInput} placeholder="Set a temporary password" placeholderTextColor="#94a3b8" value={createForm.password} onChangeText={(t) => handleCreateFormChange('password', t)} />
                                <Text style={styles.formHint}>Share this password with the staff member</Text>
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.staffLabel}>Phone Number *</Text>
                                <TextInput style={styles.staffInput} placeholder="Enter 10-digit phone number" placeholderTextColor="#94a3b8" value={createForm.phone} onChangeText={(t) => handleCreateFormChange('phone', t)} keyboardType="numeric" maxLength={10} />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.staffLabel}>Profile Image (Mock)</Text>
                                <TouchableOpacity style={[styles.staffInput, { justifyContent: 'center', backgroundColor: '#f8fafc' }]}>
                                    <Text style={{ color: '#64748b' }}>Upload Image...</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.formGroup, { zIndex: 10 }]}>
                                <Text style={styles.staffLabel}>
                                    Assign Role * <Text style={{ fontWeight: '400', color: '#94a3b8', fontSize: 12, textTransform: 'none' }}>(Don't see your role? </Text><Text style={{ fontWeight: '400', color: '#0ea5e9', fontSize: 12, textTransform: 'none' }} onPress={() => navigation.navigate('AdminRoles')}>Create one here</Text><Text style={{ fontWeight: '400', color: '#94a3b8', fontSize: 12, textTransform: 'none' }}>)</Text>
                                </Text>
                                <CustomSelect 
                                    options={availableRoles}
                                    value={createForm.roleId}
                                    onChange={(v) => handleCreateFormChange('roleId', v)}
                                    placeholder="-- Select a Role --"
                                />
                            </View>
                        </View>

                        <TouchableOpacity onPress={handleCreateStaff} disabled={creating} style={styles.submitButton}>
                            <Text style={styles.submitButtonText}>{creating ? 'Creating Account...' : '✅ Create Staff Account'}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* ==========================================
                USER TABLE
                ========================================== */}
            <View style={styles.adminCard}>
                <Text style={[styles.cardTitle, { marginBottom: 20 }]}>All Staff & Users</Text>
                
                {loadingUsers ? (
                    <View style={{ padding: 20, alignItems: 'center' }}><ActivityIndicator size="large" color="#0d9488" /><Text style={{ color: '#64748b', marginTop: 10 }}>Loading users...</Text></View>
                ) : users.length === 0 ? (
                    <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: '#64748b' }}>No users found</Text></View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.usersTableWrapper}>
                        <View style={styles.usersTable}>
                            <View style={styles.tableHeaderRow}>
                                <Text style={[styles.th, { width: 60 }]}>Avatar</Text>
                                <Text style={[styles.th, { width: 150 }]}>Name</Text>
                                <Text style={[styles.th, { width: 200 }]}>Email</Text>
                                <Text style={[styles.th, { width: 120 }]}>Role</Text>
                                <Text style={[styles.th, { width: 120 }]}>Phone</Text>
                                <Text style={[styles.th, { width: 150 }]}>Actions</Text>
                            </View>
                            
                            {users.map((userItem) => {
                                const isCurrentUser = (userItem.id || userItem._id) === currentUser.id;
                                const canModify = !isCurrentUser;
                                const roleStr = (userItem.role || '').toLowerCase();
                                
                                let roleBg = '#f1f5f9', roleColor = '#64748b', roleBorder = '#e2e8f0';
                                if (roleStr.includes('admin') || roleStr.includes('superadmin')) { roleBg = '#fee2e2'; roleColor = '#dc2626'; roleBorder = '#fecaca'; }
                                else if (roleStr.includes('doctor')) { roleBg = '#dbeafe'; roleColor = '#2563eb'; roleBorder = '#bfdbfe'; }
                                else if (roleStr.includes('lab')) { roleBg = '#f3e8ff'; roleColor = '#9333ea'; roleBorder = '#e9d5ff'; }
                                else if (roleStr.includes('pharmacy')) { roleBg = '#ffedd5'; roleColor = '#ea580c'; roleBorder = '#fed7aa'; }
                                else if (roleStr.includes('reception')) { roleBg = '#dcfce7'; roleColor = '#166534'; roleBorder = '#bbf7d0'; }

                                return (
                                    <View key={userItem.id || userItem._id} style={styles.tableRow}>
                                        <View style={[styles.td, { width: 60 }]}>
                                            {userItem.avatar ? (
                                                <Image source={{ uri: userItem.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                                            ) : (
                                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Text style={{ fontSize: 18, color: '#334155', fontWeight: 'bold' }}>{userItem.name?.charAt(0).toUpperCase()}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={[styles.td, { width: 150, fontWeight: '500' }]}>{userItem.name}</Text>
                                        <Text style={[styles.td, { width: 200 }]} numberOfLines={1}>{userItem.email}</Text>
                                        <View style={[styles.td, { width: 120 }]}>
                                            <View style={{ backgroundColor: roleBg, borderColor: roleBorder, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, alignSelf: 'flex-start' }}>
                                                <Text style={{ color: roleColor, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>{(userItem.role || 'No Role').toUpperCase()}</Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.td, { width: 120 }]}>{userItem.phone || '-'}</Text>
                                        <View style={[styles.td, { width: 150, flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
                                            {canModify && (
                                                <>
                                                    <TouchableOpacity onPress={() => openEditModal(userItem)} style={styles.btnEdit}>
                                                        <Text style={{ color: '#2563eb', fontWeight: '600', fontSize: 12 }}>Edit</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => setDeleteConfirm(userItem.id || userItem._id)} style={styles.btnDelete}>
                                                        <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 12 }}>Delete</Text>
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

            {/* EDIT USER MODAL */}
            <Modal visible={editModal} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Staff Details</Text>
                        <View style={styles.userForm}>
                            <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center', marginBottom: 20 }}>
                                <View>
                                    {editForm.newAvatarFile ? (
                                        <Image source={{ uri: editForm.newAvatarFile.uri }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                                    ) : editForm.currentAvatar ? (
                                        <Image source={{ uri: editForm.currentAvatar }} style={{ width: 80, height: 80, borderRadius: 40 }} />
                                    ) : (
                                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#cbd5e1' }} />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.staffLabel}>Change Photo (Native Mock)</Text>
                                    <TouchableOpacity style={[styles.staffInput, { justifyContent: 'center', backgroundColor: '#f8fafc' }]}>
                                        <Text style={{ color: '#64748b' }}>Select Image...</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Name *</Text>
                                    <TextInput style={styles.staffInput} value={editForm.name} onChangeText={(t) => handleEditFormChange('name', t)} />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Email</Text>
                                    <TextInput style={styles.staffInput} value={editForm.email} onChangeText={(t) => handleEditFormChange('email', t)} />
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.staffLabel}>Phone *</Text>
                                    <TextInput style={styles.staffInput} placeholder="Enter 10-digit phone number" value={editForm.phone} onChangeText={(t) => handleEditFormChange('phone', t)} keyboardType="numeric" maxLength={10} />
                                </View>
                                <View style={[styles.formGroup, { zIndex: 10 }]}>
                                    <Text style={styles.staffLabel}>Role</Text>
                                    <CustomSelect 
                                        options={availableRoles}
                                        value={editForm.roleId}
                                        onChange={() => {}}
                                        disabled={true}
                                        placeholder="Role"
                                    />
                                </View>
                            </View>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity onPress={handleUpdateUser} disabled={updating} style={styles.btnSave}>
                                    <Text style={styles.btnSaveText}>{updating ? 'Saving...' : 'Save Changes'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setEditModal(false)} style={styles.btnCancel}>
                                    <Text style={styles.btnCancelText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* DELETE MODAL */}
            <Modal visible={!!deleteConfirm} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 400 }]}>
                        <Text style={styles.modalTitle}>Confirm Delete</Text>
                        <Text style={styles.modalText}>Are you sure?</Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => handleDeleteUser(deleteConfirm)} style={styles.btnConfirmDelete}>
                                <Text style={{ color: 'white', fontWeight: '700' }}>Delete</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setDeleteConfirm(null)} style={styles.btnCancel}>
                                <Text style={styles.btnCancelText}>Cancel</Text>
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
        backgroundColor: '#edf2f7', // Fallback for radial-gradient(circle at top right, #f8fafc, #edf2f7, #e2e8f0)
        padding: 20,
    },
    superadminContainer: {
        maxWidth: 1400,
        marginHorizontal: 'auto',
        width: '100%',
        paddingBottom: 40,
    },
    adminHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 48,
        padding: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        borderRadius: 24,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        borderWidth: 1,
        shadowColor: '#1f2687',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 32,
        elevation: 5,
        flexWrap: 'wrap',
        gap: 20,
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
        flexWrap: 'wrap',
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
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 4,
    },
    logoutBtnText: {
        color: 'white',
        fontWeight: '700',
    },
    adminCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        borderRadius: 24,
        padding: 40,
        marginBottom: 32,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        borderWidth: 1,
        shadowColor: '#1f2687',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 32,
        elevation: 5,
    },
    cardTitle: {
        fontSize: 24,
        color: '#0f172a',
        fontWeight: '700',
    },
    quickBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 4,
    },
    quickBtnText: {
        color: 'white',
        fontWeight: '600',
    },
    toggleBtn: {
        paddingVertical: 8,
        paddingHorizontal: 20,
    },
    staffInput: {
        width: '100%',
        paddingVertical: 14,
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
        fontSize: 13,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    formHint: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
    },
    userForm: {
        flexDirection: 'column',
        gap: 24,
        marginTop: 20,
    },
    formRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24,
    },
    formGroup: {
        flex: 1,
        minWidth: 250,
        flexDirection: 'column',
        gap: 8,
    },
    submitButton: {
        width: '100%',
        paddingVertical: 16,
        backgroundColor: '#0d9488', // Fallback for gradient
        borderRadius: 12,
        marginTop: 12,
        shadowColor: '#0d9488',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 5,
        alignItems: 'center',
    },
    submitButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    errorMessage: {
        backgroundColor: '#fef2f2',
        color: '#ef4444',
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
        color: '#0d9488',
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
        paddingVertical: 18,
        paddingHorizontal: 24,
    },
    th: {
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        fontSize: 12,
        letterSpacing: 0.5,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 18,
        paddingHorizontal: 24,
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
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    btnDelete: {
        backgroundColor: '#fef2f2',
        borderColor: '#fee2e2',
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    btnSave: {
        backgroundColor: '#0d9488',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    btnSaveText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    btnCancel: {
        backgroundColor: 'white',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    btnCancelText: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 14,
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
        padding: 40,
        width: '100%',
        maxWidth: 600,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 25 },
        shadowOpacity: 0.25,
        shadowRadius: 50,
        elevation: 10,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 16,
    },
    modalText: {
        color: '#64748b',
        fontSize: 16,
        marginBottom: 32,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 16,
        marginTop: 20,
    },
    btnConfirmDelete: {
        backgroundColor: '#ef4444',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    dropdownMenu: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderColor: '#767676',
        borderWidth: 1,
        borderRadius: 8,
        zIndex: 100,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        overflow: 'hidden',
    },
    dropdownItem: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    dropdownItemActive: {
        backgroundColor: '#0d9488',
    },
    dropdownItemText: {
        color: '#334155',
        fontSize: 14,
    },
    dropdownItemTextActive: {
        color: '#fff',
    }
});

export default SuperAdmin;
