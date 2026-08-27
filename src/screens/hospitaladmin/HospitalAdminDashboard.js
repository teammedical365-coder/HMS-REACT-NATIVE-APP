import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, ScrollView, Image, 
    StyleSheet, ActivityIndicator, Alert, Modal, Platform, Dimensions 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch } from '../../store/hooks';
import { updateUser as updateUserAction } from '../../store/slices/authSlice';
import { adminAPI, uploadAPI, hospitalAPI } from '../../utils/api';
import BedManagement from './BedManagement';
import OTDashboard from './OTDashboard';
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

const HospitalAdminDashboard = () => {
    const navigation = useNavigation();
    const dispatch = useAppDispatch();
    const [activeTab, setActiveTab] = useState('overview');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [currentUser, setCurrentUser] = useState({});

    // My Profile state
    const [profileFile, setProfileFile] = useState(null);
    const [savingProfile, setSavingProfile] = useState(false);

    // Hospital info
    const [hospitalInfo, setHospitalInfo] = useState(null);

    // Users state
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [roles, setRoles] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: '', email: '', password: '', phone: '', roleId: '', file: null, department: ''
    });
    const [creating, setCreating] = useState(false);
    const [editModal, setEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        id: '', name: '', email: '', phone: '', roleId: '', currentAvatar: '', newAvatarFile: null, specialty: '', department: ''
    });
    const [updating, setUpdating] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    const [stats, setStats] = useState({ totalUsers: 0, totalDoctors: 0, totalPatients: 0, totalRoles: 0 });

    // --- Stats & Date Filtering State ---
    const [datePreset, setDatePreset] = useState('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [hospitalStats, setHospitalStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);

    // --- Accounts State ---
    const [accountsSubTab, setAccountsSubTab] = useState('upi');
    const [deptUpis, setDeptUpis] = useState([]);
    const [upiStaffOptions, setUpiStaffOptions] = useState([]);
    const [newDeptUpi, setNewDeptUpi] = useState({ staffUserId: '', upiId: '', label: '' });
    const [loadingDeptUpis, setLoadingDeptUpis] = useState(false);
    const [savingDeptUpi, setSavingDeptUpi] = useState(false);

    // --- Inventory State ---
    const [inventory, setInventory] = useState([]);
    const [loadingInventory, setLoadingInventory] = useState(false);
    const [showInventoryForm, setShowInventoryForm] = useState(false);
    const [editingInventoryId, setEditingInventoryId] = useState(null);
    const defaultInventoryForm = {
        name: '', salt: '', category: 'General', stock: '', unit: 'Tablets', vendor: '', batchNumber: '', expiryDate: '', buyingPrice: '', sellingPrice: '',
        unitConfig: { purchaseUnit: 'Box', saleUnit: 'Strip', baseUnit: 'Tablet', purchaseToSaleMultiplier: '10', saleToBaseMultiplier: '10' },
        inventoryConfig: { openingStock: '0', minStock: '0', maxStock: '0', reorderLevel: '0', warehouse: 'Main Store', rackNumber: '', shelfNumber: '' },
        pricingConfig: { purchasePrice: '0', landingCost: '0', mrp: '0', sellingPrice: '0', maxDiscount: '0', taxType: 'Inclusive' }
    };
    const [inventoryForm, setInventoryForm] = useState(defaultInventoryForm);
    const [savingInventory, setSavingInventory] = useState(false);

    // --- Lab Test Pricing State ---
    const [labTests, setLabTests] = useState([]);
    const [loadingLabTests, setLoadingLabTests] = useState(false);
    const [savingLabPrice, setSavingLabPrice] = useState(null);
    const [labPriceInputs, setLabPriceInputs] = useState({});
    const [showLabTestForm, setShowLabTestForm] = useState(false);
    const [savingLabTest, setSavingLabTest] = useState(false);
    const [labTestForm, setLabTestForm] = useState({ name: '', code: '', description: '', price: '', category: 'General' });

    useEffect(() => {
        const loadUser = async () => {
            const userStr = await AsyncStorage.getItem('user');
            const user = JSON.parse(userStr || '{}');
            setCurrentUser(user);
            if (user?.role !== 'hospitaladmin') {
                navigation.navigate('HospitalAdminLogin');
            }
        };
        loadUser();
    }, [navigation]);

    useEffect(() => {
        const initDashboard = async () => {
            try {
                await Promise.all([
                    fetchMyHospital(),
                    fetchUsers(),
                    fetchRoles()
                ]);
            } catch (err) {
                console.error('Failed to initialize dashboard:', err);
            }
        };
        initDashboard();
    }, []);

    useEffect(() => {
        if (activeTab === 'inventory' && inventory.length === 0) fetchInventory();
        if (activeTab === 'labpricing' && labTests.length === 0) fetchLabTests();
        if (activeTab === 'accounts' && deptUpis.length === 0) fetchDepartmentUpis();
    }, [activeTab]);

    const fetchDepartmentUpis = async () => {
        try {
            setLoadingDeptUpis(true);
            const [upiRes, staffRes] = await Promise.all([
                hospitalAPI.getDepartmentUpis(),
                hospitalAPI.getStaffForUpi()
            ]);
            if (upiRes.success) setDeptUpis(upiRes.departmentUpis);
            if (staffRes.success) setUpiStaffOptions(staffRes.staff.filter(s => !s.hasUpiAssigned));
        } catch (err) { console.error('Failed to fetch department UPIs', err); }
        finally { setLoadingDeptUpis(false); }
    };

    const handleAddDeptUpi = async () => {
        setSavingDeptUpi(true);
        try {
            const res = await hospitalAPI.createDepartmentUpi(newDeptUpi);
            if (res.success) {
                setNewDeptUpi({ staffUserId: '', upiId: '', label: '' });
                fetchDepartmentUpis();
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to add Department UPI');
        } finally {
            setSavingDeptUpi(false);
        }
    };

    const handleDeleteDeptUpi = async (id) => {
        Alert.alert('Confirm Delete', 'Are you sure you want to delete this UPI account?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                    const res = await hospitalAPI.deleteDepartmentUpi(id);
                    if (res.success) fetchDepartmentUpis();
                } catch (err) {
                    Alert.alert('Error', err.response?.data?.message || 'Failed to delete Department UPI');
                }
            }}
        ]);
    };
    
    const handleToggleDeptUpi = async (upiDoc) => {
        try {
            const res = await hospitalAPI.updateDepartmentUpi(upiDoc._id, { isActive: !upiDoc.isActive });
            if (res.success) {
                fetchDepartmentUpis();
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to update status');
        }
    };

    const fetchMyHospital = async () => {
        try {
            const res = await hospitalAPI.getMyHospital();
            if (res.success && res.hospital) {
                setHospitalInfo(res.hospital);
                fetchHospitalStats(res.hospital._id, 'all', '', '');
            }
        } catch (err) {
            console.error('Error fetching hospital info:', err);
        }
    };

    const fetchHospitalStats = async (hospitalId, preset = datePreset, start = customStartDate, end = customEndDate) => {
        try {
            setLoadingStats(true);
            setHospitalStats(null);

            let queryStart = '';
            let queryEnd = '';

            if (preset !== 'all' && preset !== 'custom') {
                const now = new Date();
                const endD = new Date(now);
                const startD = new Date(now);

                if (preset === 'today') {
                    startD.setHours(0, 0, 0, 0);
                    endD.setHours(23, 59, 59, 999);
                } else if (preset === '30') {
                    startD.setDate(startD.getDate() - 30);
                } else if (preset === '60') {
                    startD.setDate(startD.getDate() - 60);
                } else if (preset === '90') {
                    startD.setDate(startD.getDate() - 90);
                }

                queryStart = startD.toISOString();
                queryEnd = endD.toISOString();
            } else if (preset === 'custom') {
                if (start) queryStart = new Date(start).toISOString();
                if (end) queryEnd = new Date(end).toISOString();
            }

            const res = await hospitalAPI.getHospitalStats(hospitalId, queryStart, queryEnd);
            if (res.success) setHospitalStats(res);
        } catch (err) {
            console.error('Stats error:', err);
            setHospitalStats(null);
        } finally { setLoadingStats(false); }
    };

    const handleDatePresetChange = (preset) => {
        setDatePreset(preset);
        if (preset !== 'custom' && hospitalInfo) {
            fetchHospitalStats(hospitalInfo._id, preset, customStartDate, customEndDate);
        }
    };

    const handleApplyCustomDate = () => {
        if (hospitalInfo) {
            fetchHospitalStats(hospitalInfo._id, 'custom', customStartDate, customEndDate);
        }
    };

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);
            const res = await adminAPI.getUsers();
            if (res.success) {
                setUsers(res.users);
                setStats({
                    totalUsers: res.users.length,
                    totalDoctors: res.users.filter(u => (u.role || '').toLowerCase().includes('doctor')).length,
                    totalPatients: res.users.filter(u => (u.role || '').toLowerCase() === 'patient').length,
                    totalRoles: 0
                });
            }
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const res = await adminAPI.getRoles();
            if (res.success) {
                setRoles(res.data);
                setStats(prev => ({ ...prev, totalRoles: res.data.length }));
            }
        } catch (err) {
            console.error('Error fetching roles:', err);
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

        try {
            let avatarUrl = null;
            if (createForm.file) {
                const formData = new FormData();
                formData.append('images', {
                    uri: createForm.file.uri,
                    type: 'image/jpeg',
                    name: 'avatar.jpg'
                });
                const uploadRes = await uploadAPI.uploadImages(formData);
                if (uploadRes.success && uploadRes.files?.length > 0) avatarUrl = uploadRes.files[0].url;
            }

            const userData = { ...createForm, avatar: avatarUrl, departments: createForm.department ? [createForm.department] : [] };
            const res = await adminAPI.createUser(userData);
            if (res.success) {
                setSuccess(`✅ ${res.user?.role || 'Staff'} account created! Login: ${createForm.email}`);
                setCreateForm({ name: '', email: '', password: '', phone: '', roleId: '', file: null, department: '' });
                setShowCreateForm(false);
                fetchUsers();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error creating staff account.');
        } finally {
            setCreating(false);
        }
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
                if (uploadRes.success && uploadRes.files?.length > 0) avatarUrl = uploadRes.files[0].url;
            }
            const updateData = {
                name: editForm.name, email: editForm.email, phone: editForm.phone,
                roleId: editForm.roleId, avatar: avatarUrl, specialty: editForm.specialty,
                departments: editForm.department ? [editForm.department] : []
            };
            const res = await adminAPI.updateUser(editForm.id, updateData);
            if (res.success) {
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
            const res = await adminAPI.deleteUser(userId);
            if (res.success || res.status === 200) {
                setSuccess('User deleted successfully!');
                setDeleteConfirm(null);
                fetchUsers();
            }
        } catch (err) {
            setError('Error deleting user.');
            setDeleteConfirm(null);
        }
    };

    const openEditModal = (userItem) => {
        setEditForm({
            id: userItem.id || userItem._id,
            name: userItem.name, email: userItem.email, phone: userItem.phone || '',
            roleId: userItem.roleId || userItem.role,
            currentAvatar: userItem.avatar, newAvatarFile: null, specialty: userItem.specialty || '',
            department: (userItem.departments && userItem.departments.length > 0) ? userItem.departments[0] : ''
        });
        setEditModal(true);
        setError('');
        setSuccess('');
    };

    // --- Inventory Functions ---
    const fetchInventory = async () => {
        setLoadingInventory(true);
        try {
            const res = await hospitalAPI.getInventory();
            if (res.success) setInventory(res.data);
        } catch (err) { console.error(err); } finally { setLoadingInventory(false); }
    };

    const resetInventoryForm = () => {
        setInventoryForm(defaultInventoryForm);
        setEditingInventoryId(null);
        setShowInventoryForm(false);
    };

    const handleInventorySubmit = async () => {
        setSavingInventory(true); setError(''); setSuccess('');
        try {
            const p2s = Number(inventoryForm.unitConfig?.purchaseToSaleMultiplier) || 1;
            const s2b = Number(inventoryForm.unitConfig?.saleToBaseMultiplier) || 1;
            const opStock = Number(inventoryForm.inventoryConfig?.openingStock) || 0;
            const calculatedStock = opStock * p2s * s2b;

            const data = { 
                ...inventoryForm, 
                stock: calculatedStock, 
                buyingPrice: Number(inventoryForm.pricingConfig?.purchasePrice || 0), 
                sellingPrice: Number(inventoryForm.pricingConfig?.sellingPrice || 0) 
            };

            if (editingInventoryId) {
                await hospitalAPI.updateInventory(editingInventoryId, data);
                setSuccess('Item updated!');
            } else {
                await hospitalAPI.addInventory(data);
                setSuccess('Item added!');
            }
            resetInventoryForm();
            fetchInventory();
        } catch (err) { setError(err.response?.data?.message || 'Error saving item.'); }
        finally { setSavingInventory(false); }
    };

    const handleEditInventory = (item) => {
        setInventoryForm({
            name: item.name, salt: item.salt || '', category: item.category, stock: String(item.stock),
            unit: item.unit, buyingPrice: String(item.buyingPrice), sellingPrice: String(item.sellingPrice),
            vendor: item.vendor || '', batchNumber: item.batchNumber || '',
            expiryDate: item.expiryDate ? item.expiryDate.split('T')[0] : '',
            unitConfig: item.unitConfig || defaultInventoryForm.unitConfig,
            inventoryConfig: item.inventoryConfig || defaultInventoryForm.inventoryConfig,
            pricingConfig: item.pricingConfig || defaultInventoryForm.pricingConfig
        });
        setEditingInventoryId(item._id);
        setShowInventoryForm(true);
    };

    const handleDeleteInventory = async (id) => {
        Alert.alert('Confirm Delete', 'Delete this inventory item?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                    await hospitalAPI.deleteInventory(id);
                    setSuccess('Item deleted.');
                    fetchInventory();
                } catch (err) { setError('Error deleting item.'); }
            }}
        ]);
    };

    // --- Lab Test Pricing Functions ---
    const fetchLabTests = async () => {
        setLoadingLabTests(true);
        try {
            const res = await hospitalAPI.getHospitalLabTests();
            if (res.success) {
                setLabTests(res.data);
                const inputs = {};
                res.data.forEach(t => { inputs[t._id] = t.hospitalPrice !== null ? String(t.hospitalPrice) : ''; });
                setLabPriceInputs(inputs);
            }
        } catch (err) { console.error(err); } finally { setLoadingLabTests(false); }
    };

    const handleSaveLabPrice = async (testId) => {
        setSavingLabPrice(testId); setError('');
        try {
            const val = labPriceInputs[testId];
            await hospitalAPI.setLabTestPrice(testId, val === '' ? null : Number(val));
            setSuccess('Lab test price updated!');
            fetchLabTests();
        } catch (err) { setError('Error saving price.'); }
        finally { setSavingLabPrice(null); }
    };

    const handleCreateLabTest = async () => {
        if (!labTestForm.name.trim()) return setError('Test name is required.');
        setSavingLabTest(true); setError('');
        try {
            const res = await hospitalAPI.createLabTest({
                ...labTestForm,
                price: Number(labTestForm.price) || 0
            });
            if (res.success) {
                setSuccess('Lab test added successfully!');
                setShowLabTestForm(false);
                setLabTestForm({ name: '', code: '', description: '', price: '', category: 'General' });
                fetchLabTests();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error creating lab test.');
        } finally { setSavingLabTest(false); }
    };

    const handleDeleteLabTest = async (testId) => {
        Alert.alert('Confirm Delete', 'Delete this lab test? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                setError('');
                try {
                    const res = await hospitalAPI.deleteLabTest(testId);
                    if (res.success || res.status === 200) {
                        setSuccess('Lab test deleted.');
                        fetchLabTests();
                    }
                } catch (err) {
                    setError(err.response?.data?.message || 'Error deleting lab test.');
                }
            }}
        ]);
    };

    const formatCurrency = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

    const handleSaveProfilePhoto = async () => {
        if (!profileFile) return;
        setSavingProfile(true);
        setError(''); setSuccess('');
        try {
            const formData = new FormData();
            formData.append('images', {
                uri: profileFile.uri,
                type: 'image/jpeg',
                name: 'avatar.jpg'
            });
            const uploadRes = await uploadAPI.uploadImages(formData);
            if (uploadRes.success && uploadRes.files?.length > 0) {
                const avatarUrl = uploadRes.files[0].url;
                await adminAPI.updateUser(currentUser.id || currentUser._id, { avatar: avatarUrl });
                dispatch(updateUserAction({ avatar: avatarUrl }));
                setSuccess('Profile photo updated successfully!');
                setProfileFile(null);
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (err) {
            setError('Failed to update profile photo.');
        } finally {
            setSavingProfile(false);
        }
    };

    const tabs = [
        { id: 'overview', label: '📊 Overview' },
        { id: 'staff', label: '👥 Staff' },
        { id: 'departments', label: '🏥 Departments' },
        { id: 'facilities', label: '🏨 Facilities' },
        { id: 'beds', label: '🛏️ Beds' },
        { id: 'inventory', label: '📦 Inventory' },
        { id: 'labpricing', label: '🧪 Lab Pricing' },
        { id: 'accounts', label: '💰 Accounts' },
    ];
    
    if (currentUser.subscriptionPlan !== 'starter') {
        tabs.splice(5, 0, { id: 'ot', label: '🔪 Operation Theatre' });
    }

    const availableRoles = roles.map(role => ({
        label: `${role.name} ${role.description ? `— ${role.description}` : ''}`,
        value: role._id
    }));

    const upiStaffSelectOptions = upiStaffOptions.map(s => ({
        label: `${s.name} (${s.roleName})`,
        value: s._id
    }));

    return (
        <ScrollView style={styles.hospitaladminPage} contentContainerStyle={styles.hospitaladminContainer}>
            <View style={{ marginBottom: 32 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.haHospitalBadge}>
                        <Text style={styles.haHospitalBadgeText}>{hospitalInfo ? `🏥 ${hospitalInfo.name.toUpperCase()}` : 'HOSPITAL ADMIN'}</Text>
                    </View>
                </View>
                <Text style={styles.pageTitle}>Hospital Administration Dashboard</Text>
                <Text style={styles.pageSubtitle}>Manage staff, departments, and hospital operations</Text>
            </View>

            {error ? <View style={styles.errorMessage}><Text style={styles.errorMessageText}>⚠️ {error}</Text></View> : null}
            {success ? <View style={styles.successMessage}><Text style={styles.successMessageText}>✅ {success}</Text></View> : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 28 }} contentContainerStyle={styles.haTabs}>
                {tabs.filter(t => t.id !== 'accounts').map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[styles.haTab, activeTab === tab.id && styles.haTabActive]}
                        onPress={() => setActiveTab(tab.id)}
                    >
                        <Text style={[styles.haTabText, activeTab === tab.id && styles.haTabTextActive]}>{tab.label}</Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity
                    style={[styles.haTab, activeTab === 'accounts' && styles.haTabActive]}
                    onPress={() => setActiveTab('accounts')}
                >
                    <Text style={[styles.haTabText, activeTab === 'accounts' && styles.haTabTextActive]}>🏦 Accounts</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* ===================== OVERVIEW TAB ===================== */}
            {activeTab === 'overview' && (
                <View>
                    {/* ---- DATE FILTER BAR ---- */}
                    <View style={styles.adminCard}>
                        <Text style={styles.cardTitle}>📅 Analytics Timeframe</Text>
                        <View style={styles.dateFilterControls}>
                            <View style={styles.presetButtons}>
                                <TouchableOpacity style={[styles.presetBtn, datePreset === 'all' && styles.presetBtnActive]} onPress={() => handleDatePresetChange('all')}><Text style={[styles.presetBtnText, datePreset === 'all' && styles.presetBtnTextActive]}>All Time</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.presetBtn, datePreset === 'today' && styles.presetBtnActive]} onPress={() => handleDatePresetChange('today')}><Text style={[styles.presetBtnText, datePreset === 'today' && styles.presetBtnTextActive]}>Today</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.presetBtn, datePreset === '30' && styles.presetBtnActive]} onPress={() => handleDatePresetChange('30')}><Text style={[styles.presetBtnText, datePreset === '30' && styles.presetBtnTextActive]}>Last 30 Days</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.presetBtn, datePreset === '60' && styles.presetBtnActive]} onPress={() => handleDatePresetChange('60')}><Text style={[styles.presetBtnText, datePreset === '60' && styles.presetBtnTextActive]}>Last 60 Days</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.presetBtn, datePreset === '90' && styles.presetBtnActive]} onPress={() => handleDatePresetChange('90')}><Text style={[styles.presetBtnText, datePreset === '90' && styles.presetBtnTextActive]}>Last 90 Days</Text></TouchableOpacity>
                            </View>
                            <View style={styles.customDateInputs}>
                                <TextInput style={styles.dateInput} placeholder="YYYY-MM-DD" value={customStartDate} onChangeText={(t) => { setDatePreset('custom'); setCustomStartDate(t); }} />
                                <Text style={{ color: '#64748b' }}>to</Text>
                                <TextInput style={styles.dateInput} placeholder="YYYY-MM-DD" value={customEndDate} onChangeText={(t) => { setDatePreset('custom'); setCustomEndDate(t); }} />
                                <TouchableOpacity style={styles.btnSave} onPress={handleApplyCustomDate}>
                                    <Text style={styles.btnSaveText}>Apply Custom</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Stats Grid */}
                    {loadingStats ? (
                        <View style={styles.hospitalKpiGrid}>
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <View key={i} style={styles.kpiSkeleton}></View>
                            ))}
                        </View>
                    ) : hospitalStats?.stats ? (
                        <View style={styles.hospitalKpiGrid}>
                            <View style={[styles.kpiCard, styles.kpiBlue]}><Text style={styles.kpiIcon}>👩⚕️</Text><Text style={styles.kpiValue}>{hospitalStats.stats.totalStaff}</Text><Text style={styles.kpiLabel}>Total Staff</Text><Text style={styles.kpiSub}>Active staff members</Text></View>
                            <View style={[styles.kpiCard, styles.kpiGreen]}><Text style={styles.kpiIcon}>🧑🤝🧑</Text><Text style={styles.kpiValue}>{hospitalStats.stats.totalPatients}</Text><Text style={styles.kpiLabel}>Unique Patients</Text><Text style={styles.kpiSub}>In selected period</Text></View>
                            <View style={[styles.kpiCard, styles.kpiPurple]}><Text style={styles.kpiIcon}>📅</Text><Text style={styles.kpiValue}>{hospitalStats.stats.totalAppointments}</Text><Text style={styles.kpiLabel}>Total Appointments</Text><Text style={styles.kpiSub}>In selected period</Text></View>
                            <View style={[styles.kpiCard, styles.kpiOrange]}><Text style={styles.kpiIcon}>💰</Text><Text style={styles.kpiValue}>{formatCurrency(hospitalStats.stats.totalRevenue)}</Text><Text style={styles.kpiLabel}>Total Revenue</Text><Text style={styles.kpiSub}>From paid appointments</Text></View>
                            <View style={[styles.kpiCard, styles.kpiTeal]}><Text style={styles.kpiIcon}>✅</Text><Text style={styles.kpiValue}>{hospitalStats.stats.completedAppointments}</Text><Text style={styles.kpiLabel}>Completed</Text><Text style={styles.kpiSub}>{hospitalStats.stats.pendingAppointments} pending/upcoming</Text></View>
                            <View style={[styles.kpiCard, styles.kpiPink]}><Text style={styles.kpiIcon}>🧪</Text><Text style={styles.kpiValue}>{hospitalStats.stats.labReportCount}</Text><Text style={styles.kpiLabel}>Lab Reports</Text><Text style={styles.kpiSub}>{hospitalStats.stats.pendingLabReports} pending</Text></View>
                        </View>
                    ) : null}

                    {/* My Profile Card */}
                    <View style={styles.adminCard}>
                        <Text style={styles.cardTitle}>👤 My Profile</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                            <View>
                                {profileFile ? (
                                    <Image source={{ uri: profileFile.uri }} style={styles.profileImage} />
                                ) : currentUser?.avatar ? (
                                    <Image source={{ uri: currentUser.avatar }} style={styles.profileImage} />
                                ) : (
                                    <View style={styles.profileAvatarFallback}>
                                        <Text style={styles.profileAvatarFallbackText}>{(currentUser?.name || 'A').charAt(0).toUpperCase()}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: '600', fontSize: 16, color: '#1e293b', marginBottom: 4 }}>{currentUser?.name}</Text>
                                <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{currentUser?.email}</Text>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity style={styles.btnSelectPhoto} onPress={() => {/* Mock Image Picker */}}>
                                        <Text style={styles.btnSelectPhotoText}>📷 Choose Photo</Text>
                                    </TouchableOpacity>
                                    {profileFile && (
                                        <TouchableOpacity onPress={handleSaveProfilePhoto} disabled={savingProfile} style={styles.btnSave}>
                                            <Text style={styles.btnSaveText}>{savingProfile ? 'Saving...' : 'Save Photo'}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Hospital Info */}
                    {hospitalInfo && (
                        <View style={styles.adminCard}>
                            <Text style={styles.cardTitle}>🏥 My Hospital</Text>
                            <View style={styles.haHospitalInfo}>
                                <Text style={styles.hospitalInfoText}><Text style={styles.hospitalInfoBold}>Name:</Text> {hospitalInfo.name}</Text>
                                {hospitalInfo.city && <Text style={styles.hospitalInfoText}><Text style={styles.hospitalInfoBold}>City:</Text> {hospitalInfo.city}{hospitalInfo.state ? `, ${hospitalInfo.state}` : ''}</Text>}
                                {hospitalInfo.phone && <Text style={styles.hospitalInfoText}><Text style={styles.hospitalInfoBold}>Phone:</Text> {hospitalInfo.phone}</Text>}
                                {hospitalInfo.email && <Text style={styles.hospitalInfoText}><Text style={styles.hospitalInfoBold}>Email:</Text> {hospitalInfo.email}</Text>}
                                {hospitalInfo.address && <Text style={styles.hospitalInfoText}><Text style={styles.hospitalInfoBold}>Address:</Text> {hospitalInfo.address}</Text>}
                            </View>
                        </View>
                    )}
                </View>
            )}

            {/* ===================== STAFF TAB ===================== */}
            {activeTab === 'staff' && (
                <View>
                    <View style={styles.adminCard}>
                        <Text style={styles.cardTitle}>⚡ Staff Management</Text>
                        <Text style={styles.cardSubtitle}>Manage your hospital's staff and doctors from here.</Text>
                        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                            <TouchableOpacity onPress={() => navigation.navigate('AdminDoctors')} style={[styles.btnOutline, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                                <Text style={{ color: '#1d4ed8', fontWeight: '600' }}>👨⚕️ Manage Doctors</Text>
                            </TouchableOpacity>
                            {!['enterprise', 'clinic_basic', 'multi_speciality_starter'].includes(currentUser?.subscriptionPlan) && (
                                <TouchableOpacity onPress={() => navigation.navigate('AdminRoles')} style={[styles.btnOutline, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
                                    <Text style={{ color: '#7e22ce', fontWeight: '600' }}>🔑 Manage Roles</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <View style={styles.adminCard}>
                        <Text style={styles.cardTitle}>All Staff & Doctors</Text>
                        {loadingUsers ? (
                            <View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: '#94a3b8' }}>Loading users...</Text></View>
                        ) : users.length === 0 ? (
                            <View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: '#94a3b8' }}>No users found</Text></View>
                        ) : (
                            <ScrollView horizontal style={styles.tableWrapper}>
                                <View style={{ minWidth: 800 }}>
                                    <View style={styles.tableHeaderRow}>
                                        <Text style={[styles.th, { width: 60 }]}>Avatar</Text>
                                        <Text style={[styles.th, { width: 150 }]}>Name</Text>
                                        <Text style={[styles.th, { width: 200 }]}>Email</Text>
                                        <Text style={[styles.th, { width: 120 }]}>Role</Text>
                                        <Text style={[styles.th, { width: 120 }]}>Phone</Text>
                                        <Text style={[styles.th, { width: 150 }]}>Actions</Text>
                                    </View>
                                    {users.map(userItem => {
                                        const isCurrentUser = (userItem.id || userItem._id) === currentUser.id;
                                        const isSuperUser = ['centraladmin', 'superadmin'].includes(userItem.role?.toLowerCase());
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
                                                        <Text style={{ color: roleColor, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>{(userItem.role || 'No Role').toUpperCase()}</Text>
                                                    </View>
                                                </View>
                                                <Text style={[styles.td, { width: 120 }]}>{userItem.phone || '-'}</Text>
                                                <View style={[styles.td, { width: 150, flexDirection: 'row', gap: 6 }]}>
                                                    {!isCurrentUser && !isSuperUser && (
                                                        <>
                                                            <TouchableOpacity onPress={() => openEditModal(userItem)} style={styles.btnEditSmall}><Text style={{ color: '#2563eb', fontSize: 12, fontWeight: '600' }}>Edit</Text></TouchableOpacity>
                                                            <TouchableOpacity onPress={() => setDeleteConfirm(userItem.id || userItem._id)} style={styles.btnDeleteSmall}><Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Delete</Text></TouchableOpacity>
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
            )}

            {/* ===================== DEPARTMENTS TAB ===================== */}
            {activeTab === 'departments' && (
                <View style={styles.adminCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                        <View style={{ flex: 1, minWidth: 200, paddingRight: 20 }}>
                            <Text style={styles.cardTitle}>💵 Department Consultation Fees</Text>
                            <Text style={styles.cardSubtitle}>Configure the consultation fee for each department. Receptionists cannot alter these fees during booking.</Text>
                        </View>
                        <TouchableOpacity style={styles.btnSave} onPress={async () => {
                            try {
                                setError('');
                                await hospitalAPI.updateDepartmentFees({ 
                                    departmentFees: hospitalInfo.departmentFees,
                                    departmentValidity: hospitalInfo.departmentValidity 
                                });
                                setSuccess('All department fees and validity saved!');
                                setTimeout(() => setSuccess(''), 3000);
                            } catch (err) {
                                setError('Error saving fees');
                            }
                        }}>
                            <Text style={styles.btnSaveText}>Save All Fees</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView horizontal style={styles.tableWrapper}>
                        <View style={{ minWidth: 600 }}>
                            <View style={styles.tableHeaderRow}>
                                <Text style={[styles.th, { flex: 1 }]}>Department</Text>
                                <Text style={[styles.th, { flex: 1 }]}>Consultation Fee (₹)</Text>
                                <Text style={[styles.th, { flex: 1 }]}>Consultation Validity (Days)</Text>
                            </View>
                            {(hospitalInfo?.departments || []).length === 0 ? (
                                <View style={styles.tableRow}><Text style={{ color: '#666', textAlign: 'center', flex: 1, padding: 10 }}>No departments assigned yet. Contact Central Admin.</Text></View>
                            ) : (
                                hospitalInfo.departments.map(dept => (
                                    <View key={dept} style={styles.tableRow}>
                                        <Text style={[styles.td, { flex: 1, fontWeight: '500' }]}>{dept}</Text>
                                        <View style={[styles.td, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                                            <Text style={{ color: '#64748b' }}>₹</Text>
                                            <TextInput style={[styles.staffInput, { width: 100, paddingVertical: 8 }]} value={String(hospitalInfo?.departmentFees?.[dept] ?? 500)} keyboardType="numeric" onChangeText={(t) => {
                                                const newFee = Number(t);
                                                setHospitalInfo(prev => ({ ...prev, departmentFees: { ...(prev.departmentFees || {}), [dept]: newFee } }));
                                            }} />
                                        </View>
                                        <View style={[styles.td, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                                            <TextInput style={[styles.staffInput, { width: 100, paddingVertical: 8 }]} value={String(hospitalInfo?.departmentValidity?.[dept] ?? 5)} keyboardType="numeric" onChangeText={(t) => {
                                                const newValidity = Number(t);
                                                setHospitalInfo(prev => ({ ...prev, departmentValidity: { ...(prev.departmentValidity || {}), [dept]: newValidity } }));
                                            }} />
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* ===================== FACILITIES TAB ===================== */}
            {activeTab === 'facilities' && (
                <View style={styles.adminCard}>
                    <Text style={styles.cardTitle}>🛏️ Manage Facilities & Rooms</Text>
                    <Text style={styles.cardSubtitle}>Add facilities like ICU, NCU, Deluxe Rooms, and their per-day pricing.</Text>
                    
                    <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <View style={{ flex: 1, minWidth: 150 }}>
                                <Text style={styles.staffLabel}>Facility/Room Name</Text>
                                <TextInput style={styles.staffInput} placeholder="e.g. ICU" id="facName" />
                            </View>
                            <View style={{ flex: 1, minWidth: 150 }}>
                                <Text style={styles.staffLabel}>Price Per Day (₹)</Text>
                                <TextInput style={styles.staffInput} placeholder="e.g. 5000" keyboardType="numeric" id="facPrice" />
                            </View>
                            <TouchableOpacity style={[styles.btnSave, { height: 44, justifyContent: 'center' }]} onPress={() => { Alert.alert("Native Notice", "Use state mapping for refs in React Native.") }}>
                                <Text style={styles.btnSaveText}>+ Add Facility</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView horizontal style={styles.tableWrapper}>
                        <View style={{ minWidth: 500 }}>
                            <View style={styles.tableHeaderRow}>
                                <Text style={[styles.th, { flex: 1 }]}>Facility Name</Text>
                                <Text style={[styles.th, { flex: 1 }]}>Price Per Day</Text>
                                <Text style={[styles.th, { width: 100 }]}>Actions</Text>
                            </View>
                            {(hospitalInfo?.facilities || []).length === 0 ? (
                                <View style={styles.tableRow}><Text style={{ color: '#666', textAlign: 'center', flex: 1, padding: 10 }}>No facilities added yet.</Text></View>
                            ) : (
                                hospitalInfo.facilities.map((fac, idx) => (
                                    <View key={idx} style={styles.tableRow}>
                                        <Text style={[styles.td, { flex: 1 }]}>{fac.name}</Text>
                                        <Text style={[styles.td, { flex: 1 }]}>{formatCurrency(fac.pricePerDay)}/day</Text>
                                        <View style={[styles.td, { width: 100 }]}>
                                            <TouchableOpacity style={styles.btnDeleteSmall} onPress={() => {
                                                Alert.alert('Confirm', 'Delete this facility?', [
                                                    { text: 'Cancel', style: 'cancel' },
                                                    { text: 'Delete', style: 'destructive', onPress: async () => {
                                                        try {
                                                            const newFacilities = hospitalInfo.facilities.filter((_, i) => i !== idx);
                                                            const res = await hospitalAPI.updateFacilities({ facilities: newFacilities });
                                                            if (res.success) setHospitalInfo(res.hospital);
                                                        } catch (err) { setError('Error deleting facility'); }
                                                    }}
                                                ]);
                                            }}>
                                                <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Delete</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* ===================== BEDS TAB ===================== */}
            {activeTab === 'beds' && <BedManagement />}
            
            {/* ===================== OT TAB ===================== */}
            {activeTab === 'ot' && <OTDashboard />}
            
            {/* ===================== INVENTORY TAB ===================== */}
            {activeTab === 'inventory' && (
                <View>
                    <View style={styles.adminCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                            <View style={{ flex: 1, minWidth: 200 }}>
                                <Text style={styles.cardTitle}>💊 Medicine Inventory</Text>
                                <Text style={styles.cardSubtitle}>Manage your hospital's medicine stock, pricing, and expiry tracking</Text>
                            </View>
                            <TouchableOpacity style={showInventoryForm ? styles.btnCancel : styles.btnSave} onPress={() => { if (showInventoryForm && !editingInventoryId) { resetInventoryForm(); } else { resetInventoryForm(); setShowInventoryForm(true); } }}>
                                <Text style={showInventoryForm ? styles.btnCancelText : styles.btnSaveText}>{showInventoryForm ? 'Cancel' : '+ Add Medicine'}</Text>
                            </TouchableOpacity>
                        </View>

                        {showInventoryForm && (
                            <View style={{ marginBottom: 20 }}>
                                {/* BASIC INFO */}
                                <View style={styles.inventorySection}>
                                    <Text style={styles.sectionHeader}>{editingInventoryId ? 'Edit Medicine' : 'Add New Medicine'}</Text>
                                    <View style={styles.formRow}>
                                        <View style={styles.formGroup}>
                                            <Text style={styles.staffLabel}>Medicine Name *</Text>
                                            <TextInput style={styles.staffInput} placeholder="e.g. Paracetamol 500mg" value={inventoryForm.name} onChangeText={t => setInventoryForm({ ...inventoryForm, name: t })} />
                                        </View>
                                        <View style={styles.formGroup}>
                                            <Text style={styles.staffLabel}>Salt / Composition</Text>
                                            <TextInput style={styles.staffInput} placeholder="e.g. Acetaminophen" value={inventoryForm.salt} onChangeText={t => setInventoryForm({ ...inventoryForm, salt: t })} />
                                        </View>
                                        <View style={styles.formGroup}>
                                            <Text style={styles.staffLabel}>Category *</Text>
                                            <TextInput style={styles.staffInput} placeholder="e.g. Analgesic" value={inventoryForm.category} onChangeText={t => setInventoryForm({ ...inventoryForm, category: t })} />
                                        </View>
                                    </View>
                                    <View style={styles.formRow}>
                                        <View style={styles.formGroup}>
                                            <Text style={styles.staffLabel}>Batch Number</Text>
                                            <TextInput style={styles.staffInput} placeholder="e.g. BT-2026-001" value={inventoryForm.batchNumber} onChangeText={t => setInventoryForm({ ...inventoryForm, batchNumber: t })} />
                                        </View>
                                        <View style={styles.formGroup}>
                                            <Text style={styles.staffLabel}>Expiry Date *</Text>
                                            <TextInput style={styles.staffInput} placeholder="YYYY-MM-DD" value={inventoryForm.expiryDate} onChangeText={t => setInventoryForm({ ...inventoryForm, expiryDate: t })} />
                                        </View>
                                        <View style={styles.formGroup}>
                                            <Text style={styles.staffLabel}>Vendor / Supplier</Text>
                                            <TextInput style={styles.staffInput} placeholder="e.g. MedSupply Co." value={inventoryForm.vendor} onChangeText={t => setInventoryForm({ ...inventoryForm, vendor: t })} />
                                        </View>
                                    </View>
                                </View>

                                {/* UNIT CONFIGURATION */}
                                <View style={styles.inventorySection}>
                                    <Text style={styles.sectionHeader}>Unit Configuration</Text>
                                    <View style={styles.formRow}>
                                        <View style={[styles.formGroup, { zIndex: 30 }]}>
                                            <Text style={styles.staffLabel}>Purchase Unit</Text>
                                            <CustomSelect options={[{label:'Box',value:'Box'},{label:'Carton',value:'Carton'},{label:'Pack',value:'Pack'},{label:'Bottle',value:'Bottle'}]} value={inventoryForm.unitConfig.purchaseUnit} onChange={v => setInventoryForm({ ...inventoryForm, unitConfig: { ...inventoryForm.unitConfig, purchaseUnit: v }})} placeholder="Select" />
                                        </View>
                                        <View style={[styles.formGroup, { zIndex: 20 }]}>
                                            <Text style={styles.staffLabel}>Sale Unit</Text>
                                            <CustomSelect options={[{label:'Strip',value:'Strip'},{label:'Sheet',value:'Sheet'},{label:'Vial',value:'Vial'},{label:'Piece',value:'Piece'}]} value={inventoryForm.unitConfig.saleUnit} onChange={v => setInventoryForm({ ...inventoryForm, unitConfig: { ...inventoryForm.unitConfig, saleUnit: v }})} placeholder="Select" />
                                        </View>
                                        <View style={[styles.formGroup, { zIndex: 10 }]}>
                                            <Text style={styles.staffLabel}>Base Unit</Text>
                                            <CustomSelect options={[{label:'Tablet',value:'Tablet'},{label:'Capsule',value:'Capsule'},{label:'ml',value:'ml'},{label:'mg',value:'mg'}]} value={inventoryForm.unitConfig.baseUnit} onChange={v => setInventoryForm({ ...inventoryForm, unitConfig: { ...inventoryForm.unitConfig, baseUnit: v }})} placeholder="Select" />
                                        </View>
                                    </View>
                                    
                                    <View style={{ borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', padding: 16, borderRadius: 8, backgroundColor: '#f8fafc', marginBottom: 16 }}>
                                        <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 12, fontWeight: '600' }}>Conversion Builder</Text>
                                        <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Text style={{ fontSize: 14, fontWeight: '500' }}>1 {inventoryForm.unitConfig.purchaseUnit} = </Text>
                                                <TextInput style={[styles.staffInput, { width: 80, paddingVertical: 6 }]} value={String(inventoryForm.unitConfig.purchaseToSaleMultiplier)} keyboardType="numeric" onChangeText={t => setInventoryForm({ ...inventoryForm, unitConfig: { ...inventoryForm.unitConfig, purchaseToSaleMultiplier: t }})} />
                                                <Text style={{ fontSize: 14 }}>{inventoryForm.unitConfig.saleUnit}</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Text style={{ fontSize: 14, fontWeight: '500' }}>1 {inventoryForm.unitConfig.saleUnit} = </Text>
                                                <TextInput style={[styles.staffInput, { width: 80, paddingVertical: 6 }]} value={String(inventoryForm.unitConfig.saleToBaseMultiplier)} keyboardType="numeric" onChangeText={t => setInventoryForm({ ...inventoryForm, unitConfig: { ...inventoryForm.unitConfig, saleToBaseMultiplier: t }})} />
                                                <Text style={{ fontSize: 14 }}>{inventoryForm.unitConfig.baseUnit}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* INVENTORY CONFIGURATION */}
                                <View style={styles.inventorySection}>
                                    <Text style={styles.sectionHeader}>Inventory Configuration</Text>
                                    <View style={styles.formRow}>
                                        <View style={styles.formGroup}><Text style={styles.staffLabel}>Opening Stock</Text><TextInput style={styles.staffInput} value={String(inventoryForm.inventoryConfig.openingStock)} keyboardType="numeric" onChangeText={t => setInventoryForm({ ...inventoryForm, inventoryConfig: { ...inventoryForm.inventoryConfig, openingStock: t }})} /></View>
                                        <View style={styles.formGroup}><Text style={styles.staffLabel}>Min Stock</Text><TextInput style={styles.staffInput} value={String(inventoryForm.inventoryConfig.minStock)} keyboardType="numeric" onChangeText={t => setInventoryForm({ ...inventoryForm, inventoryConfig: { ...inventoryForm.inventoryConfig, minStock: t }})} /></View>
                                        <View style={styles.formGroup}><Text style={styles.staffLabel}>Max Stock</Text><TextInput style={styles.staffInput} value={String(inventoryForm.inventoryConfig.maxStock)} keyboardType="numeric" onChangeText={t => setInventoryForm({ ...inventoryForm, inventoryConfig: { ...inventoryForm.inventoryConfig, maxStock: t }})} /></View>
                                    </View>
                                </View>

                                {/* PRICING CONFIGURATION */}
                                <View style={styles.inventorySection}>
                                    <Text style={styles.sectionHeader}>Pricing & Margins (Per {inventoryForm.unitConfig.saleUnit})</Text>
                                    <View style={styles.formRow}>
                                        <View style={styles.formGroup}><Text style={styles.staffLabel}>Purchase Price (₹)</Text><TextInput style={styles.staffInput} value={String(inventoryForm.pricingConfig.purchasePrice)} keyboardType="numeric" onChangeText={t => setInventoryForm({ ...inventoryForm, pricingConfig: { ...inventoryForm.pricingConfig, purchasePrice: t }})} /></View>
                                        <View style={styles.formGroup}><Text style={styles.staffLabel}>Landing Cost (₹)</Text><TextInput style={styles.staffInput} value={String(inventoryForm.pricingConfig.landingCost)} keyboardType="numeric" onChangeText={t => setInventoryForm({ ...inventoryForm, pricingConfig: { ...inventoryForm.pricingConfig, landingCost: t }})} /></View>
                                        <View style={styles.formGroup}><Text style={styles.staffLabel}>MRP (₹)</Text><TextInput style={styles.staffInput} value={String(inventoryForm.pricingConfig.mrp)} keyboardType="numeric" onChangeText={t => setInventoryForm({ ...inventoryForm, pricingConfig: { ...inventoryForm.pricingConfig, mrp: t }})} /></View>
                                        <View style={styles.formGroup}><Text style={styles.staffLabel}>Selling Price (₹)</Text><TextInput style={styles.staffInput} value={String(inventoryForm.pricingConfig.sellingPrice)} keyboardType="numeric" onChangeText={t => setInventoryForm({ ...inventoryForm, pricingConfig: { ...inventoryForm.pricingConfig, sellingPrice: t }})} /></View>
                                    </View>
                                </View>

                                <TouchableOpacity style={[styles.btnSave, { padding: 16, alignItems: 'center', marginTop: 10 }]} onPress={handleInventorySubmit} disabled={savingInventory}>
                                    <Text style={[styles.btnSaveText, { fontSize: 16 }]}>{savingInventory ? 'Saving...' : editingInventoryId ? 'Update Medicine' : 'Add Medicine'}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View style={styles.adminCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={styles.cardTitle}>Current Stock ({inventory.length} items)</Text>
                            {!inventory.length && !loadingInventory && (
                                <TouchableOpacity onPress={fetchInventory} style={styles.btnEditSmall}><Text style={{ color: '#2563eb' }}>Load Inventory</Text></TouchableOpacity>
                            )}
                        </View>
                        {loadingInventory ? (
                            <View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: '#94a3b8' }}>Loading inventory...</Text></View>
                        ) : (
                            <ScrollView horizontal style={styles.tableWrapper}>
                                <View style={{ minWidth: 1100 }}>
                                    <View style={styles.tableHeaderRow}>
                                        <Text style={[styles.th, { width: 150 }]}>Name</Text>
                                        <Text style={[styles.th, { width: 120 }]}>Category</Text>
                                        <Text style={[styles.th, { width: 100 }]}>Stock</Text>
                                        <Text style={[styles.th, { width: 80 }]}>Cost (₹)</Text>
                                        <Text style={[styles.th, { width: 80 }]}>Sell (₹)</Text>
                                        <Text style={[styles.th, { width: 100 }]}>Margin</Text>
                                        <Text style={[styles.th, { width: 100 }]}>Batch</Text>
                                        <Text style={[styles.th, { width: 120 }]}>Expiry</Text>
                                        <Text style={[styles.th, { width: 100 }]}>Status</Text>
                                        <Text style={[styles.th, { width: 120 }]}>Actions</Text>
                                    </View>
                                    {inventory.length === 0 ? (
                                        <View style={styles.tableRow}><Text style={{ color: '#94a3b8', textAlign: 'center', flex: 1, padding: 30 }}>No inventory items yet. Click "+ Add Medicine" to start.</Text></View>
                                    ) : inventory.map(item => {
                                        const margin = item.sellingPrice - item.buyingPrice;
                                        const marginPct = item.buyingPrice ? ((margin / item.buyingPrice) * 100).toFixed(1) : '0';
                                        const isExpired = new Date(item.expiryDate) < new Date();
                                        const isExpiringSoon = !isExpired && new Date(item.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
                                        return (
                                            <View key={item._id} style={[styles.tableRow, isExpired ? { backgroundColor: '#fef2f2' } : isExpiringSoon ? { backgroundColor: '#fffbeb' } : {}]}>
                                                <Text style={[styles.td, { width: 150, fontWeight: '600' }]}>{item.name}</Text>
                                                <Text style={[styles.td, { width: 120 }]}>{item.category}</Text>
                                                <Text style={[styles.td, { width: 100 }]}><Text style={{ fontWeight: 'bold' }}>{item.stock}</Text> <Text style={{ color: '#94a3b8', fontSize: 11 }}>{item.unit}</Text></Text>
                                                <Text style={[styles.td, { width: 80 }]}>₹{item.buyingPrice}</Text>
                                                <Text style={[styles.td, { width: 80 }]}>₹{item.sellingPrice}</Text>
                                                <Text style={[styles.td, { width: 100, fontWeight: '600', color: margin >= 0 ? '#059669' : '#dc2626' }]}>₹{margin.toFixed(2)}</Text>
                                                <Text style={[styles.td, { width: 100, fontSize: 12, color: '#64748b' }]}>{item.batchNumber || '-'}</Text>
                                                <View style={[styles.td, { width: 120 }]}>
                                                    <View style={{ backgroundColor: isExpired ? '#fee2e2' : isExpiringSoon ? '#fef3c7' : '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' }}>
                                                        <Text style={{ fontSize: 11, fontWeight: '600', color: isExpired ? '#b91c1c' : isExpiringSoon ? '#92400e' : '#334155' }}>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-IN') : '-'}</Text>
                                                    </View>
                                                </View>
                                                <View style={[styles.td, { width: 100 }]}>
                                                    <View style={{ backgroundColor: item.status === 'In Stock' ? '#dcfce7' : item.status === 'Low Stock' ? '#fef3c7' : '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' }}>
                                                        <Text style={{ fontSize: 10, fontWeight: '700', color: item.status === 'In Stock' ? '#166534' : item.status === 'Low Stock' ? '#92400e' : '#b91c1c' }}>{item.status}</Text>
                                                    </View>
                                                </View>
                                                <View style={[styles.td, { width: 120, flexDirection: 'row', gap: 6 }]}>
                                                    <TouchableOpacity onPress={() => handleEditInventory(item)} style={styles.btnEditSmall}><Text style={{ color: '#2563eb', fontSize: 11, fontWeight: '600' }}>Edit</Text></TouchableOpacity>
                                                    <TouchableOpacity onPress={() => handleDeleteInventory(item._id)} style={styles.btnDeleteSmall}><Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600' }}>Del</Text></TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            )}

            {/* ===================== LAB PRICING TAB ===================== */}
            {activeTab === 'labpricing' && (
                <View style={styles.adminCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                        <View style={{ flex: 1, minWidth: 200 }}>
                            <Text style={styles.cardTitle}>🧪 Lab Tests & Pricing</Text>
                            <Text style={styles.cardSubtitle}>Add your own hospital tests or set custom prices for global tests.</Text>
                        </View>
                        <TouchableOpacity style={showLabTestForm ? styles.btnCancel : styles.btnSave} onPress={() => { setShowLabTestForm(v => !v); setError(''); }}>
                            <Text style={showLabTestForm ? styles.btnCancelText : styles.btnSaveText}>{showLabTestForm ? 'Cancel' : '+ Add Lab Test'}</Text>
                        </TouchableOpacity>
                    </View>

                    {showLabTestForm && (
                        <View style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 10, padding: 20, marginBottom: 20 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 16 }}>New Hospital-Specific Lab Test</Text>
                            <View style={styles.formRow}>
                                <View style={styles.formGroup}><Text style={styles.staffLabel}>Test Name *</Text><TextInput style={styles.staffInput} placeholder="e.g. Vitamin D3 Test" value={labTestForm.name} onChangeText={t => setLabTestForm(p => ({ ...p, name: t }))} /></View>
                                <View style={styles.formGroup}><Text style={styles.staffLabel}>Test Code</Text><TextInput style={styles.staffInput} placeholder="e.g. VD3" value={labTestForm.code} onChangeText={t => setLabTestForm(p => ({ ...p, code: t }))} /></View>
                            </View>
                            <View style={styles.formRow}>
                                <View style={styles.formGroup}><Text style={styles.staffLabel}>Category</Text><TextInput style={styles.staffInput} placeholder="e.g. Endocrinology" value={labTestForm.category} onChangeText={t => setLabTestForm(p => ({ ...p, category: t }))} /></View>
                                <View style={styles.formGroup}><Text style={styles.staffLabel}>Price (₹)</Text><TextInput style={styles.staffInput} placeholder="e.g. 800" keyboardType="numeric" value={labTestForm.price} onChangeText={t => setLabTestForm(p => ({ ...p, price: t }))} /></View>
                            </View>
                            <TouchableOpacity style={[styles.btnSave, { padding: 14, alignItems: 'center', marginTop: 10 }]} onPress={handleCreateLabTest} disabled={savingLabTest}>
                                <Text style={styles.btnSaveText}>{savingLabTest ? 'Saving...' : 'Save Lab Test'}</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {loadingLabTests ? (
                        <View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: '#94a3b8' }}>Loading lab tests...</Text></View>
                    ) : labTests.length === 0 ? (
                        <View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: '#94a3b8' }}>No lab tests yet. Add your first hospital-specific test above.</Text></View>
                    ) : (
                        <ScrollView horizontal style={styles.tableWrapper}>
                            <View style={{ minWidth: 800 }}>
                                <View style={styles.tableHeaderRow}>
                                    <Text style={[styles.th, { flex: 2 }]}>Test Name</Text>
                                    <Text style={[styles.th, { flex: 1 }]}>Code</Text>
                                    <Text style={[styles.th, { flex: 1 }]}>Category</Text>
                                    <Text style={[styles.th, { flex: 1 }]}>Base Price (₹)</Text>
                                    <Text style={[styles.th, { flex: 1.5 }]}>Your Price (₹)</Text>
                                    <Text style={[styles.th, { flex: 1 }]}>Action</Text>
                                </View>
                                {labTests.map(test => (
                                    <View key={test._id} style={[styles.tableRow, { backgroundColor: test.isOwnTest ? '#f0fdf4' : 'white' }]}>
                                        <View style={[styles.td, { flex: 2 }]}>
                                            <Text style={{ fontWeight: '600', color: '#0f172a' }}>{test.name}</Text>
                                            {test.isOwnTest && (
                                                <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start', marginTop: 4 }}>
                                                    <Text style={{ color: '#166534', fontSize: 10, fontWeight: '700' }}>Your Hospital</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={[styles.td, { flex: 1, color: '#64748b' }]}>{test.code || '-'}</Text>
                                        <Text style={[styles.td, { flex: 1 }]}>{test.category}</Text>
                                        <Text style={[styles.td, { flex: 1 }]}>₹{test.price}</Text>
                                        <View style={[styles.td, { flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                                            {test.isOwnTest ? (
                                                <Text style={{ fontSize: 13, color: '#64748b' }}>— (your test)</Text>
                                            ) : (
                                                <>
                                                    <Text style={{ color: '#64748b' }}>₹</Text>
                                                    <TextInput style={[styles.staffInput, { width: 90, paddingVertical: 6 }]} placeholder={String(test.price)} keyboardType="numeric" value={labPriceInputs[test._id] || ''} onChangeText={t => setLabPriceInputs(prev => ({ ...prev, [test._id]: t }))} />
                                                    {test.hospitalPrice !== null && <Text style={{ fontSize: 11, color: '#059669', fontWeight: '600' }}>Custom</Text>}
                                                </>
                                            )}
                                        </View>
                                        <View style={[styles.td, { flex: 1 }]}>
                                            {test.isOwnTest ? (
                                                <TouchableOpacity onPress={() => handleDeleteLabTest(test._id)} style={styles.btnDeleteSmall}><Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Delete</Text></TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity onPress={() => handleSaveLabPrice(test._id)} disabled={savingLabPrice === test._id} style={styles.btnSaveSmall}><Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>{savingLabPrice === test._id ? '...' : 'Set Price'}</Text></TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    )}
                </View>
            )}

            {/* ===================== ACCOUNTS TAB ===================== */}
            {activeTab === 'accounts' && (
                <View>
                    <View style={styles.adminCard}>
                        <Text style={styles.cardTitle}>🏦 Accounts & Payments Configuration</Text>
                        <Text style={styles.cardSubtitle}>Manage payment options, banking integrations, and gateways.</Text>
                        
                        <View style={{ flexDirection: 'row', gap: 15, marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#e2e8f0', paddingBottom: 10, flexWrap: 'wrap' }}>
                            <TouchableOpacity onPress={() => setAccountsSubTab('upi')} style={[styles.haTab, accountsSubTab === 'upi' && styles.haTabActive]}><Text style={[styles.haTabText, accountsSubTab === 'upi' && styles.haTabTextActive]}>UPI Settings</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => setAccountsSubTab('bank')} style={[styles.haTab, accountsSubTab === 'bank' && styles.haTabActive]}><Text style={[styles.haTabText, accountsSubTab === 'bank' && styles.haTabTextActive]}>Bank Details</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => setAccountsSubTab('card')} style={[styles.haTab, accountsSubTab === 'card' && styles.haTabActive]}><Text style={[styles.haTabText, accountsSubTab === 'card' && styles.haTabTextActive]}>Card Payments</Text></TouchableOpacity>
                        </View>

                        {accountsSubTab === 'upi' && (
                            <View>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 20 }}>Department UPI Management</Text>
                                <View style={{ backgroundColor: '#f8fafc', padding: 16, borderRadius: 8, borderColor: '#e2e8f0', borderWidth: 1, marginBottom: 30 }}>
                                    <View style={styles.formRow}>
                                        <View style={[styles.formGroup, { zIndex: 20 }]}><Text style={styles.staffLabel}>Assign To Staff *</Text><CustomSelect options={upiStaffSelectOptions} value={newDeptUpi.staffUserId} onChange={v => setNewDeptUpi({ ...newDeptUpi, staffUserId: v })} placeholder="-- Select Staff --" /></View>
                                        <View style={styles.formGroup}><Text style={styles.staffLabel}>Account Label *</Text><TextInput style={styles.staffInput} placeholder="e.g. Reception Desk" value={newDeptUpi.label} onChangeText={t => setNewDeptUpi({ ...newDeptUpi, label: t })} /></View>
                                        <View style={styles.formGroup}><Text style={styles.staffLabel}>UPI ID *</Text><TextInput style={styles.staffInput} placeholder="e.g. counter@upi" value={newDeptUpi.upiId} onChangeText={t => setNewDeptUpi({ ...newDeptUpi, upiId: t })} /></View>
                                    </View>
                                    <TouchableOpacity style={[styles.btnSave, { alignSelf: 'flex-start', marginTop: 16, backgroundColor: '#059669' }]} onPress={handleAddDeptUpi} disabled={savingDeptUpi || upiStaffOptions.length === 0}>
                                        <Text style={styles.btnSaveText}>{savingDeptUpi ? 'Saving...' : '+ Add UPI Account'}</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={{ fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 15 }}>Configured UPI Accounts</Text>
                                {loadingDeptUpis ? (
                                    <Text style={{ color: '#64748b' }}>Loading...</Text>
                                ) : deptUpis.length === 0 ? (
                                    <Text style={{ color: '#64748b' }}>No department UPI accounts configured yet.</Text>
                                ) : (
                                    <View style={{ gap: 12 }}>
                                        {deptUpis.map(upi => (
                                            <View key={upi._id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 8, backgroundColor: '#fff', flexWrap: 'wrap', gap: 16 }}>
                                                <View>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        <Text style={{ fontWeight: 'bold', color: '#0f172a', fontSize: 16 }}>{upi.label}</Text>
                                                        <View style={{ backgroundColor: upi.isActive ? '#dcfce7' : '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                                                            <Text style={{ color: upi.isActive ? '#166534' : '#64748b', fontSize: 12, fontWeight: '600' }}>{upi.isActive ? 'Active' : 'Inactive'}</Text>
                                                        </View>
                                                    </View>
                                                    <Text style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
                                                        {upi.upiId} — Assigned to: <Text style={{ fontWeight: 'bold' }}>{upi.staffUserId?.name || 'Unknown'}</Text> ({upi.staffRoleName})
                                                    </Text>
                                                </View>
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    <TouchableOpacity style={styles.btnOutline} onPress={() => handleToggleDeptUpi(upi)}>
                                                        <Text style={{ color: '#475569', fontWeight: 'bold' }}>{upi.isActive ? 'Deactivate' : 'Activate'}</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={[styles.btnOutline, { backgroundColor: '#fee2e2', borderColor: '#f87171' }]} onPress={() => handleDeleteDeptUpi(upi._id)}>
                                                        <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Delete</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            )}

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
                                    <Text style={styles.staffLabel}>Change Photo</Text>
                                    <TouchableOpacity style={[styles.staffInput, { justifyContent: 'center', backgroundColor: '#f8fafc' }]}>
                                        <Text style={{ color: '#64748b' }}>Select Image...</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <View style={styles.formRow}>
                                <View style={styles.formGroup}><Text style={styles.staffLabel}>Name *</Text><TextInput style={styles.staffInput} value={editForm.name} onChangeText={t => setEditForm({ ...editForm, name: t })} /></View>
                                <View style={styles.formGroup}><Text style={styles.staffLabel}>Email</Text><TextInput style={styles.staffInput} value={editForm.email} onChangeText={t => setEditForm({ ...editForm, email: t })} /></View>
                            </View>
                            <View style={styles.formRow}>
                                <View style={styles.formGroup}><Text style={styles.staffLabel}>Phone *</Text><TextInput style={styles.staffInput} placeholder="e.g. 9876543210" value={editForm.phone || ''} keyboardType="numeric" maxLength={10} onChangeText={t => { const clean = t.replace(/\D/g, '').slice(0, 10); setEditForm({ ...editForm, phone: clean }); }} /></View>
                                <View style={[styles.formGroup, { zIndex: 10 }]}><Text style={styles.staffLabel}>Role</Text><CustomSelect options={availableRoles} value={editForm.roleId} onChange={() => {}} disabled={true} placeholder="Role" /></View>
                            </View>
                            {hospitalInfo && hospitalInfo.departments && hospitalInfo.departments.length > 0 && (
                                <View style={[styles.formRow, { marginTop: 10 }]}>
                                    <View style={[styles.formGroup, { flex: 1, zIndex: 5 }]}><Text style={styles.staffLabel}>Assign Department (Optional)</Text>
                                        <CustomSelect options={hospitalInfo.departments.map(d => ({label: d, value: d}))} value={editForm.department} onChange={v => setEditForm({ ...editForm, department: v })} placeholder="-- Select Department --" />
                                    </View>
                                </View>
                            )}
                            <View style={styles.modalButtons}>
                                <TouchableOpacity onPress={handleUpdateUser} disabled={updating} style={styles.btnSave}><Text style={styles.btnSaveText}>{updating ? 'Saving...' : 'Save Changes'}</Text></TouchableOpacity>
                                <TouchableOpacity onPress={() => setEditModal(false)} style={styles.btnCancel}><Text style={styles.btnCancelText}>Cancel</Text></TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    hospitaladminPage: {
        flex: 1,
        backgroundColor: '#f8fafc',
        padding: 20,
    },
    hospitaladminContainer: {
        maxWidth: 1400,
        marginHorizontal: 'auto',
        width: '100%',
        paddingBottom: 40,
    },
    haHospitalBadge: {
        paddingVertical: 4,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: '#f0fdfa',
        borderColor: '#ccfbf1',
        borderWidth: 1,
        marginBottom: 4,
    },
    haHospitalBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#14b8a6',
        letterSpacing: 0.5,
    },
    pageTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1e293b',
        marginVertical: 4,
    },
    pageSubtitle: {
        color: '#64748b',
        fontSize: 15,
    },
    haTabs: {
        flexDirection: 'row',
        gap: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: 16,
        padding: 8,
        borderColor: 'rgba(203, 213, 225, 0.5)',
        borderWidth: 1,
    },
    haTab: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: 'transparent',
    },
    haTabActive: {
        backgroundColor: '#0d9488', // var(--gradient-brand) fallback
        shadowColor: '#0d9488',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    haTabText: {
        color: '#64748b',
        fontSize: 15,
        fontWeight: '600',
    },
    haTabTextActive: {
        color: 'white',
    },
    adminCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: 20,
        padding: 28,
        marginBottom: 24,
        borderColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 22,
        color: '#0f172a',
        fontWeight: '700',
        marginBottom: 8,
    },
    cardSubtitle: {
        color: '#64748b',
        fontSize: 14,
        marginBottom: 20,
    },
    dateFilterControls: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
    },
    presetButtons: {
        flexDirection: 'row',
        gap: 8,
        flexWrap: 'wrap',
    },
    presetBtn: {
        backgroundColor: '#f1f5f9',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    presetBtnActive: {
        backgroundColor: '#eff6ff',
        borderColor: '#bfdbfe',
    },
    presetBtnText: {
        color: '#475569',
        fontWeight: '600',
        fontSize: 13,
    },
    presetBtnTextActive: {
        color: '#2563eb',
    },
    customDateInputs: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
    },
    dateInput: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        borderRadius: 8,
        fontSize: 13,
        color: '#1e293b',
        backgroundColor: 'white',
        minWidth: 120,
    },
    hospitalKpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 20,
    },
    kpiSkeleton: {
        flex: 1,
        minWidth: 300,
        height: 120,
        borderRadius: 16,
        backgroundColor: '#e2e8f0',
    },
    kpiCard: {
        flex: 1,
        minWidth: 280,
        borderRadius: 16,
        paddingVertical: 22,
        paddingHorizontal: 24,
    },
    kpiBlue: { backgroundColor: '#3b82f6' },
    kpiGreen: { backgroundColor: '#10b981' },
    kpiPurple: { backgroundColor: '#8b5cf6' },
    kpiOrange: { backgroundColor: '#f97316' },
    kpiTeal: { backgroundColor: '#14b8a6' },
    kpiPink: { backgroundColor: '#ec4899' },
    kpiIcon: { fontSize: 28, marginBottom: 8 },
    kpiValue: { fontSize: 32, fontWeight: '800', color: 'white', marginBottom: 4 },
    kpiLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', marginBottom: 4 },
    kpiSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
    btnSelectPhoto: {
        backgroundColor: '#f1f5f9',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    btnSelectPhotoText: {
        color: '#334155',
        fontSize: 12,
        fontWeight: '600',
    },
    profileImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderColor: '#14b8a6',
        borderWidth: 3,
    },
    profileAvatarFallback: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#e0e7ff',
        borderColor: '#c7d2fe',
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileAvatarFallbackText: {
        fontSize: 28,
        fontWeight: '700',
        color: '#6366f1',
    },
    haHospitalInfo: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        padding: 20,
        backgroundColor: '#f0fdf4',
        borderRadius: 12,
        borderColor: '#d1fae5',
        borderWidth: 1,
    },
    hospitalInfoText: {
        fontSize: 15,
        color: '#374151',
        width: '45%',
        minWidth: 240,
    },
    hospitalInfoBold: {
        color: '#0d9488',
        fontWeight: '700',
    },
    tableWrapper: {
        borderRadius: 16,
        borderColor: 'rgba(226, 232, 240, 0.6)',
        borderWidth: 1,
        overflow: 'hidden',
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(241, 245, 249, 0.5)',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 16,
        paddingHorizontal: 20,
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
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    td: {
        color: '#0f172a',
        fontSize: 14,
    },
    btnSave: {
        backgroundColor: '#0d9488',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    btnSaveSmall: {
        backgroundColor: '#0d9488',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
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
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    btnCancelText: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 14,
    },
    btnEditSmall: {
        backgroundColor: '#eff6ff',
        borderColor: '#dbeafe',
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    btnDeleteSmall: {
        backgroundColor: '#fef2f2',
        borderColor: '#fee2e2',
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    btnOutline: {
        backgroundColor: '#f8fafc',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    errorMessage: {
        backgroundColor: '#fef2f2',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        borderColor: '#fee2e2',
        borderWidth: 1,
    },
    errorMessageText: { color: '#ef4444', fontWeight: '600' },
    successMessage: {
        backgroundColor: '#f0fdfa',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        borderColor: '#ccfbf1',
        borderWidth: 1,
    },
    successMessageText: { color: '#0d9488', fontWeight: '600' },
    inventorySection: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 12,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        marginBottom: 20,
    },
    sectionHeader: {
        fontSize: 14,
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 16,
        fontWeight: '700',
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
    },
    staffLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    staffInput: {
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderColor: '#cbd5e1',
        borderWidth: 1,
        backgroundColor: 'white',
        color: '#0f172a',
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
        maxWidth: 600,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 20,
    },
    dropdownMenu: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        borderRadius: 8,
        zIndex: 100,
        elevation: 5,
        maxHeight: 200,
    },
    dropdownItem: {
        paddingVertical: 12,
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

export default HospitalAdminDashboard;
