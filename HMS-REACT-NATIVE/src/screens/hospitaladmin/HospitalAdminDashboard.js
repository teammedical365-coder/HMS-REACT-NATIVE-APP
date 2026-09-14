import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, ScrollView, Image, 
    StyleSheet, ActivityIndicator, Alert, Modal, Platform, Dimensions, useWindowDimensions,
    Animated, Easing 
} from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch, useAuth } from '../../store/hooks';
import { updateUser as updateUserAction, logout } from '../../store/slices/authSlice';
import { adminAPI, uploadAPI, hospitalAPI, aiWalletAPI } from '../../utils/api';
import BedManagement from './BedManagement';
import OTDashboard from './OTDashboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, Ellipse, G, Rect, Pattern } from 'react-native-svg';
import DatePickerInput from '../../components/common/DatePickerInput';
import * as DocumentPicker from 'expo-document-picker';

import DropdownSelect from '../../components/common/DropdownSelect';

// --- Universal Dropdown Select Wrapper ---
const CustomSelect = (props) => <DropdownSelect {...props} />;


const HospitalAdminDashboard = () => {
    const navigation = useNavigation();
    const dispatch = useAppDispatch();
    const { width } = useWindowDimensions();
    const isMobile = width < 768;
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
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [staffRoleFilter, setStaffRoleFilter] = useState('all');

    const [stats, setStats] = useState({ totalUsers: 0, totalDoctors: 0, totalPatients: 0, totalRoles: 0 });

    const { user: authUser, isAuthenticated } = useAuth();
    const [datePreset, setDatePreset] = useState('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [showCustomDateModal, setShowCustomDateModal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [hospitalStats, setHospitalStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [chartRange, setChartRange] = useState('this_month');

    // --- AI Intelligence & Wallet State ---
    const [aiWallet, setAiWallet] = useState(null);
    const [aiTransactions, setAiTransactions] = useState([]);
    const [aiDoctorBreakdown, setAiDoctorBreakdown] = useState([]);
    const [loadingAIStats, setLoadingAIStats] = useState(false);
    const [aiSearchQuery, setAiSearchQuery] = useState('');
    const [visibleLogCount, setVisibleLogCount] = useState(10);
    const [showAIDoctorModal, setShowAIDoctorModal] = useState(false);

    // --- Facility State ---
    const [newFacilityName, setNewFacilityName] = useState('');
    const [newFacilityPrice, setNewFacilityPrice] = useState('');
    const [addingFacility, setAddingFacility] = useState(false);

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

    // Animations
    const spinAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const beamAnim = useRef(new Animated.Value(0)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.35, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
            ])
        ).start();

        Animated.loop(
            Animated.timing(beamAnim, {
                toValue: 1,
                duration: 7000,
                easing: Easing.linear,
                useNativeDriver: Platform.OS !== 'web',
            })
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, { toValue: -3, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(floatAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
            ])
        ).start();
    }, [pulseAnim, beamAnim, floatAnim]);

    useEffect(() => {
        if (loadingAIStats || isRefreshing) {
            Animated.loop(
                Animated.timing(spinAnim, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.linear,
                    useNativeDriver: Platform.OS !== 'web',
                })
            ).start();
        } else {
            spinAnim.setValue(0);
        }
    }, [loadingAIStats, isRefreshing, spinAnim]);

    const spinInterpolate = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const beamInterpolate = beamAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['-35%', '110%'],
    });

    const getActiveTabGradient = (tabId) => {
        switch (tabId) {
            case 'overview': return ['#0284c7', '#2563eb'];
            case 'staff': return ['#8b5cf6', '#6366f1'];
            case 'departments': return ['#0d9488', '#10b981'];
            case 'facilities': return ['#f59e0b', '#ea580c'];
            case 'beds': return ['#06b6d4', '#0284c7'];
            case 'inventory': return ['#059669', '#10b981'];
            case 'labpricing': return ['#10b981', '#06b6d4'];
            case 'aiwallet': return ['#6366f1', '#3b82f6'];
            case 'accounts': return ['#eab308', '#d97706'];
            case 'ot': return ['#8b5cf6', '#7c3aed'];
            default: return ['#0284c7', '#2563eb'];
        }
    };

    const formatAICredits = (val) => {
        if (val === undefined || val === null || isNaN(val)) return '0.00';
        return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const fetchAIDoctorTracking = async () => {
        try {
            setLoadingAIStats(true);
            const [walletRes, transRes] = await Promise.all([
                aiWalletAPI.getWallet(),
                aiWalletAPI.getTransactions(1, 50)
            ]);
            if (walletRes && walletRes.success && walletRes.wallet) {
                setAiWallet(walletRes.wallet);
            }
            if (transRes && transRes.success) {
                setAiTransactions(transRes.transactions || []);
                setAiDoctorBreakdown(transRes.doctorBreakdown || []);
                setVisibleLogCount(10);
            }
        } catch (err) {
            console.error('Failed to fetch AI Doctor Tracking:', err);
        } finally {
            setLoadingAIStats(false);
        }
    };

    const fetchAIWallet = fetchAIDoctorTracking;

    useEffect(() => {
        if (authUser) {
            setCurrentUser(authUser);
        }
    }, [authUser]);

    useEffect(() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash.includes('hospitaladmin')) {
            return;
        }
        // If authenticated user's role is not hospital admin or central admin, logout cleanly
        if (authUser && authUser.role) {
            const role = (authUser.role || '').toLowerCase();
            if (role !== 'hospitaladmin' && role !== 'centraladmin' && role !== 'superadmin') {
                dispatch(logout());
            }
        }
    }, [authUser, dispatch]);

    useEffect(() => {
        const initDashboard = async () => {
            try {
                await Promise.all([
                    fetchMyHospital(),
                    fetchUsers(),
                    fetchRoles(),
                    fetchAIWallet()
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
        if (activeTab === 'aiwallet') fetchAIDoctorTracking();
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
        if (!newDeptUpi.staffUserId || !newDeptUpi.label?.trim() || !newDeptUpi.upiId?.trim()) {
            Alert.alert('Validation Error', 'Please select a staff member and enter both Account Label and UPI ID.');
            return;
        }
        setSavingDeptUpi(true);
        try {
            const res = await hospitalAPI.createDepartmentUpi(newDeptUpi);
            if (res && res.success) {
                setNewDeptUpi({ staffUserId: '', upiId: '', label: '' });
                fetchDepartmentUpis();
            } else {
                Alert.alert('Error', res?.message || 'Failed to add Department UPI');
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

    const isValidDateString = (str) => {
        if (!str || typeof str !== 'string') return false;
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(str.trim())) return false;
        const d = new Date(str.trim());
        return !isNaN(d.getTime());
    };

    const handleApplyCustomDate = () => {
        if (!isValidDateString(customStartDate) || !isValidDateString(customEndDate)) {
            Alert.alert('Invalid Date Format', 'Please enter dates in YYYY-MM-DD format (e.g. 2026-01-15).');
            return;
        }
        if (new Date(customStartDate) > new Date(customEndDate)) {
            Alert.alert('Invalid Date Range', 'Start date must be earlier than or equal to End date.');
            return;
        }
        setDatePreset('custom');
        setShowCustomDateModal(false);
        if (hospitalInfo) {
            fetchHospitalStats(hospitalInfo._id, 'custom', customStartDate, customEndDate);
        }
    };

    const handleRefreshData = async () => {
        try {
            setIsRefreshing(true);
            await Promise.all([
                fetchMyHospital(),
                fetchUsers(),
                fetchRoles(),
                fetchAIWallet()
            ]);
        } catch (err) {
            console.error('Failed to refresh data:', err);
        } finally {
            setIsRefreshing(false);
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

    const handlePickProfilePhoto = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/jpeg', 'image/png', 'image/webp'],
                copyToCacheDirectory: true
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setProfileFile({
                    uri: asset.uri,
                    name: asset.name || 'avatar.jpg',
                    type: asset.mimeType || 'image/jpeg'
                });
            }
        } catch (err) {
            console.error('Photo picker error:', err);
        }
    };

    const handleAddFacility = async () => {
        if (!newFacilityName.trim()) {
            Alert.alert('Validation', 'Please enter a facility/room name.');
            return;
        }
        setAddingFacility(true);
        setError('');
        try {
            const currentFacilities = hospitalInfo?.facilities || [];
            const updated = [
                ...currentFacilities,
                { name: newFacilityName.trim(), pricePerDay: Number(newFacilityPrice) || 0 }
            ];
            const res = await hospitalAPI.updateFacilities({ facilities: updated });
            if (res.success) {
                setHospitalInfo(res.hospital);
                setNewFacilityName('');
                setNewFacilityPrice('');
                setSuccess('Facility added successfully!');
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error adding facility.');
        } finally {
            setAddingFacility(false);
        }
    };

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

    const getTabIcon = (tabId, isActive) => {
        const color = isActive ? '#ffffff' : '#64748b';
        switch (tabId) {
            case 'overview': return <Feather name="bar-chart-2" size={17} color={color} />;
            case 'staff': return <Feather name="users" size={17} color={color} />;
            case 'departments': return <Feather name="layers" size={17} color={color} />;
            case 'facilities': return <Feather name="plus-square" size={17} color={color} />;
            case 'beds': return <Ionicons name="bed-outline" size={17} color={color} />;
            case 'ot': return <Feather name="activity" size={17} color={color} />;
            case 'inventory': return <Feather name="package" size={17} color={color} />;
            case 'labpricing': return <MaterialCommunityIcons name="flask-outline" size={17} color={color} />;
            case 'aiwallet': return <Feather name="cpu" size={17} color={color} />;
            case 'accounts': return <MaterialCommunityIcons name="bank-outline" size={17} color={color} />;
            default: return <Feather name="grid" size={17} color={color} />;
        }
    };

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'staff', label: 'Staff' },
        { id: 'departments', label: 'Departments' },
        { id: 'facilities', label: 'Facilities' },
        { id: 'beds', label: 'Beds' },
        { id: 'labpricing', label: 'Lab Pricing' },
        { id: 'aiwallet', label: 'AI Intelligence' },
        { id: 'accounts', label: 'Accounts' },
    ];

    const renderAIIntelligenceContent = (isModal = false) => {
        const filteredBreakdown = (aiDoctorBreakdown || []).filter(d =>
            (d.userName || '').toLowerCase().includes(aiSearchQuery.toLowerCase())
        );
        const visibleTransactions = aiTransactions.slice(0, visibleLogCount);

        return (
            <View style={[styles.haAiIntelligenceContainer, isModal && styles.haAiModalMode]}>
                {/* 1. Header Card */}
                <ExpoLinearGradient
                    colors={['#ffffff', '#f8fafc']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.haAiHeaderCard}
                >
                    <View style={styles.haAiHeaderLeft}>
                        <ExpoLinearGradient
                            colors={['#eff6ff', '#dbeafe']}
                            style={styles.haAiHeaderIconBox}
                        >
                            <Text style={{ fontSize: 26 }}>🤖</Text>
                        </ExpoLinearGradient>
                        <View style={{ flex: 1 }}>
                            <View style={styles.haAiHeaderTitleRow}>
                                <Text style={styles.haAiMainTitle}>AI Intelligence & Doctor Credit Tracking</Text>
                                <View style={[styles.haAiStatusPill, (aiWallet?.status === 'ACTIVE' || aiWallet?.status === 'active') ? styles.haAiStatusPillActive : styles.haAiStatusPillInactive]}>
                                    <Animated.View style={[styles.haAiStatusDot, { opacity: pulseAnim }]} />
                                    <Text style={[styles.haAiStatusPillText, (aiWallet?.status === 'ACTIVE' || aiWallet?.status === 'active') ? styles.haAiStatusPillTextActive : styles.haAiStatusPillTextInactive]}>
                                        {aiWallet?.status || 'ACTIVE'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.haAiHeaderDesc}>
                                Live tracking of doctor-wise AI credit consumption, diagnostic analysis requests, and remaining hospital allocation.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.haAiHeaderActions}>
                        <TouchableOpacity
                            onPress={fetchAIDoctorTracking}
                            disabled={loadingAIStats}
                            style={styles.haAiRefreshBtn}
                            activeOpacity={0.7}
                        >
                            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                                <Text style={{ fontSize: 13 }}>🔄</Text>
                            </Animated.View>
                            <Text style={styles.haAiRefreshBtnLabel}>
                                {loadingAIStats ? 'Refreshing...' : 'Refresh Stats'}
                            </Text>
                        </TouchableOpacity>
                        {isModal && (
                            <TouchableOpacity
                                onPress={() => setShowAIDoctorModal(false)}
                                style={styles.haAiModalCloseBtn}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.haAiModalCloseBtnText}>✕</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </ExpoLinearGradient>

                {/* 2. 4 Summary Metric Cards Grid */}
                <View style={styles.haAiMetricsGrid}>
                    {/* Card 1: Remaining AI Balance */}
                    <View style={[styles.haAiMetricCard, styles.haAiCardRemaining]}>
                        <ExpoLinearGradient colors={['#3b82f6', '#60a5fa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.haAiMetricTopBar} />
                        <View style={styles.haAiMetricHeader}>
                            <Text style={styles.haAiMetricLabel}>Remaining AI Balance</Text>
                            <View style={styles.haAiMetricBadge}><Text style={styles.haAiMetricBadgeText}>Available</Text></View>
                        </View>
                        <View style={styles.haAiMetricValRow}>
                            <Text style={[styles.haAiMetricNumber, { color: '#1d4ed8' }]}>
                                {formatAICredits(aiWallet?.remainingAmount !== undefined ? aiWallet.remainingAmount : 2000)}
                            </Text>
                            <Text style={styles.haAiMetricUnit}>Credits</Text>
                        </View>
                        <View style={styles.haAiMetricFooter}>
                            <Text style={styles.haAiMetricPillGreen}>● Active & Ready</Text>
                        </View>
                    </View>

                    {/* Card 2: Hospital AI Budget */}
                    <View style={[styles.haAiMetricCard, styles.haAiCardBudget]}>
                        <ExpoLinearGradient colors={['#6366f1', '#818cf8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.haAiMetricTopBar} />
                        <View style={styles.haAiMetricHeader}>
                            <Text style={styles.haAiMetricLabel}>Hospital AI Budget</Text>
                            <View style={styles.haAiMetricBadge}><Text style={styles.haAiMetricBadgeText}>Allocation</Text></View>
                        </View>
                        <View style={styles.haAiMetricValRow}>
                            <Text style={[styles.haAiMetricNumber, { color: '#4338ca' }]}>
                                {formatAICredits(aiWallet?.budgetAmount || 2000)}
                            </Text>
                            <Text style={styles.haAiMetricUnit}>Credits</Text>
                        </View>
                        <View style={styles.haAiMetricFooter}>
                            <Text style={styles.haAiMetricSubtext}>Total Quota Allocated</Text>
                        </View>
                    </View>

                    {/* Card 3: Total Credits Used */}
                    <View style={[styles.haAiMetricCard, styles.haAiCardUsed]}>
                        <ExpoLinearGradient colors={['#f97316', '#fb923c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.haAiMetricTopBar} />
                        <View style={styles.haAiMetricHeader}>
                            <Text style={styles.haAiMetricLabel}>Total Credits Used</Text>
                            <View style={styles.haAiMetricBadge}><Text style={styles.haAiMetricBadgeText}>Consumed</Text></View>
                        </View>
                        <View style={styles.haAiMetricValRow}>
                            <Text style={[styles.haAiMetricNumber, { color: '#c2410c' }]}>
                                {formatAICredits(aiWallet?.usedAmount || 0)}
                            </Text>
                            <Text style={styles.haAiMetricUnit}>Credits</Text>
                        </View>
                        <View style={styles.haAiMetricFooter}>
                            <Text style={styles.haAiMetricPillOrange}>
                                {aiWallet && aiWallet.budgetAmount ? `${((Number(aiWallet.usedAmount) / Number(aiWallet.budgetAmount)) * 100).toFixed(1)}% of Budget` : '0% used'}
                            </Text>
                        </View>
                    </View>

                    {/* Card 4: Total AI Requests */}
                    <View style={[styles.haAiMetricCard, styles.haAiCardRequests]}>
                        <ExpoLinearGradient colors={['#10b981', '#34d399']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.haAiMetricTopBar} />
                        <View style={styles.haAiMetricHeader}>
                            <Text style={styles.haAiMetricLabel}>Total AI Requests</Text>
                            <View style={styles.haAiMetricBadge}><Text style={styles.haAiMetricBadgeText}>Activity</Text></View>
                        </View>
                        <View style={styles.haAiMetricValRow}>
                            <Text style={[styles.haAiMetricNumber, { color: '#047857' }]}>
                                {(aiWallet?.totalRequests ?? aiTransactions.length ?? 0).toLocaleString()}
                            </Text>
                            <Text style={styles.haAiMetricUnit}>Inferences</Text>
                        </View>
                        <View style={styles.haAiMetricFooter}>
                            <Text style={styles.haAiMetricPillTeal}>Diagnostic AI Scans</Text>
                        </View>
                    </View>
                </View>

                {/* 3. Doctor-Wise AI Usage Breakdown */}
                <View style={styles.haAiSectionCard}>
                    <View style={styles.haAiSectionHeader}>
                        <View style={{ flex: 1, minWidth: 220 }}>
                            <Text style={styles.haAiSectionTitle}>👨‍⚕️ Doctor-Wise AI Usage Breakdown</Text>
                            <Text style={styles.haAiSectionSubtitle}>Track which doctor is using how many AI credits and calls.</Text>
                        </View>
                        <View style={styles.haAiSearchWrap}>
                            <Text style={styles.haAiSearchIcon}>🔍</Text>
                            <TextInput
                                placeholder="Search doctor by name..."
                                value={aiSearchQuery}
                                onChangeText={setAiSearchQuery}
                                style={styles.haAiSearchInput}
                                placeholderTextColor="#94a3b8"
                            />
                            {aiSearchQuery ? (
                                <TouchableOpacity onPress={() => setAiSearchQuery('')} style={styles.haAiSearchClear}>
                                    <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '700' }}>✕</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>

                    {loadingAIStats ? (
                        <View style={styles.haAiLoadingBox}>
                            <ActivityIndicator size="small" color="#2563eb" />
                            <Text style={styles.haAiLoadingText}>Loading AI Doctor breakdown...</Text>
                        </View>
                    ) : filteredBreakdown.length === 0 ? (
                        <View style={styles.haAiEmptyBox}>
                            <Text style={{ fontSize: 36, marginBottom: 8 }}>🩺</Text>
                            <Text style={styles.haAiEmptyTitle}>No Doctor AI Usage Recorded Yet</Text>
                            <Text style={styles.haAiEmptyDesc}>When doctors use AI Assistant (summary, diagnosis, lab compare), their credit usage will appear here.</Text>
                        </View>
                    ) : (
                        <ScrollView horizontal style={styles.haAiTableWrap} showsHorizontalScrollIndicator={false}>
                            <View style={{ minWidth: 780 }}>
                                <View style={styles.haAiTableHeader}>
                                    <Text style={[styles.haAiTh, { width: 240 }]}>DOCTOR / STAFF</Text>
                                    <Text style={[styles.haAiTh, { width: 140 }]}>CREDITS USED</Text>
                                    <Text style={[styles.haAiTh, { width: 120 }]}>AI REQUESTS</Text>
                                    <Text style={[styles.haAiTh, { width: 160 }]}>BUDGET SHARE</Text>
                                    <Text style={[styles.haAiTh, { width: 120 }]}>LAST ACTIVE</Text>
                                </View>
                                {filteredBreakdown.map((doc, idx) => {
                                    const totalBudget = Number(aiWallet?.budgetAmount || 2000);
                                    const sharePercent = totalBudget > 0 ? ((doc.totalCreditsUsed / totalBudget) * 100).toFixed(1) : '0';
                                    return (
                                        <View key={doc.userId || idx} style={styles.haAiTableRow}>
                                            <View style={[styles.haAiTd, { width: 240, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                                                <ExpoLinearGradient colors={['#3b82f6', '#1d4ed8']} style={styles.haAiDoctorAvatar}>
                                                    <Text style={styles.haAiDoctorAvatarText}>{(doc.userName || 'D').charAt(0).toUpperCase()}</Text>
                                                </ExpoLinearGradient>
                                                <View>
                                                    <Text style={styles.haAiDoctorName}>{doc.userName}</Text>
                                                    <Text style={styles.haAiDoctorId}>Doctor ID: {String(doc.userId || '').slice(-6)}</Text>
                                                </View>
                                            </View>
                                            <View style={[styles.haAiTd, { width: 140 }]}>
                                                <View style={styles.haAiCreditChip}>
                                                    <Text style={styles.haAiCreditVal}>{Number(doc.totalCreditsUsed || 0).toFixed(2)}</Text>
                                                    <Text style={styles.haAiCreditTag}>Credits</Text>
                                                </View>
                                            </View>
                                            <View style={[styles.haAiTd, { width: 120 }]}>
                                                <View style={styles.haAiCallsBadge}>
                                                    <Text style={styles.haAiCallsBadgeText}>{doc.requestCount} calls</Text>
                                                </View>
                                            </View>
                                            <View style={[styles.haAiTd, { width: 160 }]}>
                                                <View style={styles.haAiProgressWrap}>
                                                    <View style={styles.haAiProgressBar}>
                                                        <View style={[styles.haAiProgressFill, { width: `${Math.min(100, Number(sharePercent))}%` }]} />
                                                    </View>
                                                    <Text style={styles.haAiProgressPercent}>{sharePercent}%</Text>
                                                </View>
                                            </View>
                                            <View style={[styles.haAiTd, { width: 120 }]}>
                                                <Text style={styles.haAiDateText}>
                                                    {doc.lastUsed ? new Date(doc.lastUsed).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    )}
                </View>

                {/* 4. Recent AI Usage Logs (10 Items Infinite Scroll) */}
                <View style={styles.haAiSectionCard}>
                    <View style={styles.haAiSectionHeader}>
                        <View style={{ flex: 1, minWidth: 220 }}>
                            <Text style={styles.haAiSectionTitle}>📜 Recent AI Usage Logs</Text>
                            <Text style={styles.haAiSectionSubtitle}>Real-time inference logs with 10-item infinite scroll.</Text>
                        </View>
                        <View style={styles.haAiLogsCountBadge}>
                            <Text style={styles.haAiLogsCountBadgeText}>
                                Showing {Math.min(visibleLogCount, aiTransactions.length)} of {aiTransactions.length} logs
                            </Text>
                        </View>
                    </View>

                    {aiTransactions.length === 0 ? (
                        <View style={styles.haAiEmptyBox}>
                            <Text style={{ fontSize: 36, marginBottom: 8 }}>📊</Text>
                            <Text style={styles.haAiEmptyTitle}>No Activity Logs Recorded</Text>
                            <Text style={styles.haAiEmptyDesc}>AI inference transactions will appear here in real time as doctors query the system.</Text>
                        </View>
                    ) : (
                        <View>
                            <ScrollView horizontal style={styles.haAiTableWrap} showsHorizontalScrollIndicator={false}>
                                <View style={{ minWidth: 780 }}>
                                    <View style={styles.haAiTableHeader}>
                                        <Text style={[styles.haAiTh, { width: 150 }]}>DATE & TIME</Text>
                                        <Text style={[styles.haAiTh, { width: 160 }]}>USER / DOCTOR</Text>
                                        <Text style={[styles.haAiTh, { width: 180 }]}>ACTION / FEATURE</Text>
                                        <Text style={[styles.haAiTh, { width: 150 }]}>CREDITS CONSUMED</Text>
                                        <Text style={[styles.haAiTh, { width: 140 }]}>STATUS</Text>
                                    </View>
                                    {visibleTransactions.map((log, i) => (
                                        <View key={log._id || i} style={styles.haAiTableRow}>
                                            <View style={[styles.haAiTd, { width: 150 }]}>
                                                <Text style={styles.haAiDateText}>
                                                    {log.createdAt ? new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                                </Text>
                                            </View>
                                            <View style={[styles.haAiTd, { width: 160 }]}>
                                                <Text style={styles.haAiLogUser}>{log.userName || 'Doctor'}</Text>
                                            </View>
                                            <View style={[styles.haAiTd, { width: 180 }]}>
                                                <View style={styles.haAiFeaturePill}>
                                                    <Text style={styles.haAiFeaturePillText}>
                                                        {log.actionType || log.feature || 'AI Analysis'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={[styles.haAiTd, { width: 150 }]}>
                                                <View style={[styles.haAiCreditChip, styles.haAiCreditChipConsumed]}>
                                                    <Text style={[styles.haAiCreditVal, { color: '#c2410c' }]}>
                                                        {Number(log.actualApiCost || 0).toFixed(2)}
                                                    </Text>
                                                    <Text style={[styles.haAiCreditTag, { color: '#ea580c' }]}>Credits</Text>
                                                </View>
                                            </View>
                                            <View style={[styles.haAiTd, { width: 140 }]}>
                                                <View style={[styles.haAiStatusPill, styles.haAiStatusPillActive]}>
                                                    <View style={styles.haAiStatusDot} />
                                                    <Text style={[styles.haAiStatusPillText, styles.haAiStatusPillTextActive]}>Success</Text>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>

                            {/* Infinite scroll status / Load More button */}
                            <View style={styles.haAiLogsFooter}>
                                {visibleLogCount < aiTransactions.length ? (
                                    <TouchableOpacity
                                        onPress={() => setVisibleLogCount(prev => Math.min(prev + 10, aiTransactions.length))}
                                        style={styles.haAiLoadMoreBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.haAiLoadMoreBtnText}>Scroll down or Click to Load More</Text>
                                        <View style={styles.haAiLoadBadge}>
                                            <Text style={styles.haAiLoadBadgeText}>+{Math.min(10, aiTransactions.length - visibleLogCount)} more</Text>
                                        </View>
                                    </TouchableOpacity>
                                ) : (
                                    <Text style={styles.haAiAllLoadedText}>
                                        ✓ All {aiTransactions.length} AI usage logs displayed
                                    </Text>
                                )}
                            </View>
                        </View>
                    )}
                </View>
            </View>
        );
    };

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
            {/* 1. Modern Hero Header Banner (Matching Web ha-ai-hero-banner) */}
            <View style={styles.haAiHeroBannerWrapper}>
                <ExpoLinearGradient
                    colors={['#f0fdfa', '#e0f2fe', '#f8fafc', '#f0fdf4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    locations={[0, 0.32, 0.68, 1]}
                    style={styles.haAiHeroBanner}
                >
                    {/* Circuit / Grid Background overlay */}
                    <Svg style={styles.haAiCircuitBg} width="100%" height="100%">
                        <Defs>
                            <Pattern id="haAiCircuitDots" width={20} height={20} patternUnits="userSpaceOnUse">
                                <Circle cx={2} cy={2} r={1.3} fill="#0ea5e9" opacity={0.32} />
                            </Pattern>
                        </Defs>
                        <Rect width="100%" height="100%" fill="url(#haAiCircuitDots)" />
                    </Svg>

                    <View style={styles.haAiHeroLeft}>
                        <Text style={[
                            styles.haAiHeroTitle,
                            Platform.OS === 'web' && {
                                backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 25%, #4338ca 50%, #7c3aed 75%, #0284c7 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }
                        ]}>
                            Hospital Administration Dashboard
                        </Text>
                        <View style={styles.haAiSubtitleRow}>
                            <Animated.View style={[styles.haSubtitlePulseDot, { transform: [{ scale: pulseAnim }] }]} />
                            <Text style={styles.haAiHeroSubtitle}>
                                Manage staff, departments, and hospital operations with AI intelligence.
                            </Text>
                        </View>
                    </View>

                    {/* Right: High-Definition Realistic Modern Hospital Campus Visual */}
                    {!isMobile && (
                        <View style={styles.haAiRightBuilding}>
                            <Image 
                                source={require('../../assets/realistic_hospital_banner_art.png')} 
                                style={styles.haAiHospitalImg}
                                resizeMode="cover" 
                            />
                            <ExpoLinearGradient
                                colors={['#f0fdfa', 'rgba(240, 253, 250, 0.6)', 'transparent']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.haAiHospitalFadeOverlay}
                            />
                        </View>
                    )}
                </ExpoLinearGradient>
            </View>

            {error ? <View style={styles.errorMessage}><Text style={styles.errorMessageText}>⚠️ {error}</Text></View> : null}
            {success ? <View style={styles.successMessage}><Text style={styles.successMessageText}>✅ {success}</Text></View> : null}

            {/* 2. Floating Modern Tab Navigation Bar (Matching Web ha-ai-tabs-card) */}
            <View style={styles.haAiTabsCardWrapper}>
                <ExpoLinearGradient
                    colors={['#f5f3ff', '#ede9fe', '#f0f9ff', '#ecfdf5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    locations={[0, 0.22, 0.6, 1]}
                    style={styles.haAiTabsCard}
                >
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.haAiTabsScroll, isMobile && { justifyContent: 'flex-start', gap: 6, flexGrow: 0 }]}>
                        {tabs.map(tab => {
                            const isTabActive = activeTab === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[styles.haAiTabBtn, isMobile && { flex: 0, minWidth: 68, paddingHorizontal: 4 }, isTabActive && styles.haAiTabBtnActive]}
                                    onPress={() => setActiveTab(tab.id)}
                                    activeOpacity={0.78}
                                >
                                    {isTabActive ? (
                                        <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
                                            <ExpoLinearGradient
                                                colors={getActiveTabGradient(tab.id)}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={[styles.haAiTabIconWrap, styles.haAiTabIconWrapActive]}
                                            >
                                                {getTabIcon(tab.id, true)}
                                            </ExpoLinearGradient>
                                        </Animated.View>
                                    ) : (
                                        <View style={styles.haAiTabIconWrap}>
                                            {getTabIcon(tab.id, false)}
                                        </View>
                                    )}
                                    <Text style={[styles.haAiTabLabel, isTabActive && styles.haAiTabLabelActive]}>
                                        {tab.label}
                                    </Text>
                                    {isTabActive && (
                                        <View style={styles.haActiveNeonSlider}>
                                            <ExpoLinearGradient
                                                colors={['#8b5cf6', '#06b6d4', '#10b981']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={{ width: '100%', height: '100%' }}
                                            />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Continuous travelling bottom neon beam (ha-patti-full-beam) */}
                    <Animated.View
                        style={[
                            styles.haPattiFullBeam,
                            { left: beamInterpolate }
                        ]}
                    >
                        <ExpoLinearGradient
                            colors={['transparent', '#8b5cf6', '#06b6d4', '#10b981', 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ width: '100%', height: '100%' }}
                        />
                    </Animated.View>
                </ExpoLinearGradient>
            </View>

            {/* ===================== OVERVIEW TAB ===================== */}
            {activeTab === 'overview' && (
                <View>
                    {/* Analytics Timeframe Bar (Matching Web ha-ai-timeframe-bar) */}
                    <View style={styles.haAiTimeframeBar}>
                        <View style={styles.haAiTimeframeTitle}>
                            <Text style={{ fontSize: 16 }}>📈</Text>
                            <Text style={styles.haAiTimeframeTitleText}>Analytics Timeframe</Text>
                        </View>

                        <View style={styles.haAiTimeframeControls}>
                            <View style={styles.haAiPresetPills}>
                                <TouchableOpacity 
                                    style={[styles.haAiPresetBtn, datePreset === 'all' && styles.haAiPresetBtnActive]} 
                                    onPress={() => handleDatePresetChange('all')}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.haAiPresetBtnText, datePreset === 'all' && styles.haAiPresetBtnTextActive]}>All Time</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.haAiPresetBtn, datePreset === 'today' && styles.haAiPresetBtnActive]} 
                                    onPress={() => handleDatePresetChange('today')}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.haAiPresetBtnText, datePreset === 'today' && styles.haAiPresetBtnTextActive]}>Today</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.haAiPresetBtn, datePreset === '30' && styles.haAiPresetBtnActive]} 
                                    onPress={() => handleDatePresetChange('30')}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.haAiPresetBtnText, datePreset === '30' && styles.haAiPresetBtnTextActive]}>30 Days</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.haAiPresetBtn, styles.haAiApplyCustomBtn, datePreset === 'custom' && styles.haAiPresetBtnActive]} 
                                    onPress={() => setShowCustomDateModal(true)}
                                    activeOpacity={0.7}
                                >
                                    <Feather name="calendar" size={13} color={datePreset === 'custom' ? '#ffffff' : '#2563eb'} />
                                    <Text style={[styles.haAiPresetBtnText, datePreset === 'custom' && styles.haAiPresetBtnTextActive, { marginLeft: 5 }]}>
                                        {datePreset === 'custom' && customStartDate && customEndDate
                                            ? `${customStartDate} → ${customEndDate}`
                                            : 'Apply Custom'}
                                    </Text>
                                    {datePreset === 'custom' && <View style={styles.haAiCustomBadgeDot} />}
                                </TouchableOpacity>
                            </View>

                            {/* Refresh Button */}
                            <TouchableOpacity 
                                style={[styles.haAiRefreshBtn, isRefreshing && styles.haAiRefreshBtnActive]} 
                                onPress={handleRefreshData}
                                disabled={isRefreshing}
                                activeOpacity={0.7}
                            >
                                <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                                    <Feather 
                                        name="refresh-cw" 
                                        size={13} 
                                        color={isRefreshing ? '#94a3b8' : '#334155'} 
                                    />
                                </Animated.View>
                                <Text style={styles.haAiRefreshBtnText}>
                                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Custom Date Range Filter Modal (Matching Web ha-custom-date-modal-card) */}
                    <Modal
                        visible={showCustomDateModal}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={() => setShowCustomDateModal(false)}
                    >
                        <TouchableOpacity 
                            style={styles.haCustomDateModalBackdrop} 
                            activeOpacity={1} 
                            onPress={() => setShowCustomDateModal(false)}
                        >
                            <TouchableOpacity 
                                style={styles.haCustomDateModalCard} 
                                activeOpacity={1} 
                                onPress={(e) => e.stopPropagation()}
                            >
                                <View style={styles.haCustomModalHeader}>
                                    <View style={styles.haCustomModalTitle}>
                                        <View style={styles.haModalTitleIconBox}>
                                            <Feather name="calendar" size={18} color="#2563eb" />
                                        </View>
                                        <View>
                                            <Text style={styles.haCustomModalTitleText}>Filter Custom Date Range</Text>
                                            <Text style={styles.haCustomModalSubtitle}>Select start and end dates to filter hospital analytics</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => setShowCustomDateModal(false)}
                                        style={styles.haCustomModalClose}
                                    >
                                        <Text style={{ fontSize: 16, color: '#64748b', fontWeight: '700' }}>✕</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.haCustomModalBody}>
                                    <View style={styles.haDateInputsRow}>
                                        <View style={styles.haDateFieldGroup}>
                                            <Text style={styles.haDateFieldLabel}>Start Date</Text>
                                            <DatePickerInput
                                                value={customStartDate}
                                                onChange={(val) => {
                                                    setDatePreset('custom');
                                                    setCustomStartDate(val);
                                                }}
                                                placeholder="YYYY-MM-DD"
                                                title="Select Start Date"
                                            />
                                        </View>
                                        <View style={styles.haDateArrowSeparator}>
                                            <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '700' }}>to</Text>
                                        </View>
                                        <View style={styles.haDateFieldGroup}>
                                            <Text style={styles.haDateFieldLabel}>End Date</Text>
                                            <DatePickerInput
                                                value={customEndDate}
                                                onChange={(val) => {
                                                    setDatePreset('custom');
                                                    setCustomEndDate(val);
                                                }}
                                                placeholder="YYYY-MM-DD"
                                                title="Select End Date"
                                            />
                                        </View>
                                    </View>

                                    {/* Quick Presets inside modal */}
                                    <View style={styles.haModalQuickPresets}>
                                        <Text style={styles.haQuickPresetsTitle}>Quick Presets</Text>
                                        <View style={styles.haQuickPresetChips}>
                                            {[
                                                { label: 'Today', val: 'today' },
                                                { label: '30 Days', val: '30' },
                                                { label: '60 Days', val: '60' },
                                                { label: '90 Days', val: '90' },
                                                { label: 'All Time', val: 'all' },
                                            ].map((presetItem) => (
                                                <TouchableOpacity
                                                    key={presetItem.val}
                                                    style={[
                                                        styles.haQuickChip,
                                                        datePreset === presetItem.val && styles.haQuickChipActive
                                                    ]}
                                                    onPress={() => {
                                                        handleDatePresetChange(presetItem.val);
                                                        setShowCustomDateModal(false);
                                                    }}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={[
                                                        styles.haQuickChipText,
                                                        datePreset === presetItem.val && styles.haQuickChipTextActive
                                                    ]}>
                                                        {presetItem.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.haCustomModalFooter}>
                                    <TouchableOpacity
                                        style={styles.haBtnModalReset}
                                        onPress={() => {
                                            handleDatePresetChange('all');
                                            setCustomStartDate('');
                                            setCustomEndDate('');
                                            setShowCustomDateModal(false);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.haBtnModalResetText}>Reset to All</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.haBtnModalApply,
                                            (!customStartDate || !customEndDate) && { opacity: 0.5 }
                                        ]}
                                        disabled={!customStartDate || !customEndDate}
                                        onPress={handleApplyCustomDate}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.haBtnModalApplyText}>Apply Custom Filter</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </Modal>

                    {/* 5 KPI Metric Cards + AI Wallet (Matching Web ha-ai-kpis-grid) */}
                    {loadingStats ? (
                        <View style={styles.haAiKpisGrid}>
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <View key={i} style={styles.kpiSkeleton}></View>
                            ))}
                        </View>
                    ) : (() => {
                        const getKpiCardResponsiveStyle = (isOccupancy = false) => {
                            if (width > 1300) return { width: '18.8%' };
                            if (width > 900) return { width: '31.8%' };
                            if (isOccupancy) return { width: '100%' };
                            return { width: width <= 768 ? '48.2%' : '48.8%' };
                        };
                        return (
                        <View style={[styles.haAiKpisGrid, { gap: width <= 768 ? 10 : 14 }]}>
                            {/* 1. Total Patients */}
                            <ExpoLinearGradient
                                colors={['#eff6ff', '#e0e7ff', '#ffffff']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[styles.haAiKpiCard, { borderColor: '#bfdbfe', paddingVertical: width <= 768 ? 12 : 15, paddingHorizontal: width <= 768 ? 12 : 18 }, getKpiCardResponsiveStyle(false)]}
                            >
                                <View style={styles.haAiKpiHeader}>
                                    <ExpoLinearGradient
                                        colors={['#2563eb', '#1d4ed8']}
                                        style={styles.haAiKpiIconBoxGrad}
                                    >
                                        <Feather name="users" size={18} color="#ffffff" />
                                    </ExpoLinearGradient>
                                    <View style={styles.haAiKpiMeta}>
                                        <Text style={styles.haAiKpiLabel}>Total Patients</Text>
                                        <Text style={[styles.haAiKpiVal, { color: '#1d4ed8' }]}>
                                            {(hospitalStats?.stats?.totalPatients ?? stats.totalPatients ?? 0).toLocaleString()}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.haAiKpiFooter}>
                                    <View style={[styles.haAiKpiTrendBadge, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}>
                                        <Text style={[styles.haAiKpiTrend, { color: '#2563eb' }]}>● Active Patients</Text>
                                    </View>
                                    <Svg viewBox="0 0 80 25" width={76} height={24} fill="none">
                                        <Path d="M 2 20 Q 20 15 40 18 T 78 5" stroke="#2563eb" strokeWidth={2.2} strokeLinecap="round" />
                                    </Svg>
                                </View>
                            </ExpoLinearGradient>

                            {/* 2. Total Doctors */}
                            <ExpoLinearGradient
                                colors={['#ecfdf5', '#d1fae5', '#ffffff']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[styles.haAiKpiCard, { borderColor: '#a7f3d0', paddingVertical: width <= 768 ? 12 : 15, paddingHorizontal: width <= 768 ? 12 : 18 }, getKpiCardResponsiveStyle(false)]}
                            >
                                <View style={styles.haAiKpiHeader}>
                                    <ExpoLinearGradient
                                        colors={['#10b981', '#059669']}
                                        style={styles.haAiKpiIconBoxGrad}
                                    >
                                        <Feather name="user-check" size={18} color="#ffffff" />
                                    </ExpoLinearGradient>
                                    <View style={styles.haAiKpiMeta}>
                                        <Text style={styles.haAiKpiLabel}>Total Doctors</Text>
                                        <Text style={[styles.haAiKpiVal, { color: '#047857' }]}>
                                            {hospitalStats?.stats?.totalDoctors ?? hospitalStats?.stats?.doctorCount ?? stats.totalDoctors ?? 0}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.haAiKpiFooter}>
                                    <View style={[styles.haAiKpiTrendBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                                        <Text style={[styles.haAiKpiTrend, { color: '#059669' }]}>● Hospital Doctors</Text>
                                    </View>
                                    <Svg viewBox="0 0 80 25" width={76} height={24} fill="none">
                                        <Path d="M 2 22 Q 25 10 50 16 T 78 4" stroke="#059669" strokeWidth={2.2} strokeLinecap="round" />
                                    </Svg>
                                </View>
                            </ExpoLinearGradient>

                            {/* 3. Total Appointments */}
                            <ExpoLinearGradient
                                colors={['#faf5ff', '#ede9fe', '#ffffff']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[styles.haAiKpiCard, { borderColor: '#ddd6fe', paddingVertical: width <= 768 ? 12 : 15, paddingHorizontal: width <= 768 ? 12 : 18 }, getKpiCardResponsiveStyle(false)]}
                            >
                                <View style={styles.haAiKpiHeader}>
                                    <ExpoLinearGradient
                                        colors={['#8b5cf6', '#7c3aed']}
                                        style={styles.haAiKpiIconBoxGrad}
                                    >
                                        <Feather name="calendar" size={18} color="#ffffff" />
                                    </ExpoLinearGradient>
                                    <View style={styles.haAiKpiMeta}>
                                        <Text style={styles.haAiKpiLabel}>Total Appointments</Text>
                                        <Text style={[styles.haAiKpiVal, { color: '#6d28d9' }]}>
                                            {(hospitalStats?.stats?.totalAppointments ?? 0).toLocaleString()}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.haAiKpiFooter}>
                                    <View style={[styles.haAiKpiTrendBadge, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                                        <Text style={[styles.haAiKpiTrend, { color: '#7c3aed' }]}>● Booked Records</Text>
                                    </View>
                                    <Svg viewBox="0 0 80 25" width={76} height={24} fill="none">
                                        <Path d="M 2 20 Q 20 18 45 8 T 78 4" stroke="#7c3aed" strokeWidth={2.2} strokeLinecap="round" />
                                    </Svg>
                                </View>
                            </ExpoLinearGradient>

                            {/* 4. Total Revenue */}
                            <ExpoLinearGradient
                                colors={['#fffbeb', '#fef3c7', '#ffffff']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[styles.haAiKpiCard, { borderColor: '#fde68a', paddingVertical: width <= 768 ? 12 : 15, paddingHorizontal: width <= 768 ? 12 : 18 }, getKpiCardResponsiveStyle(false)]}
                            >
                                <View style={styles.haAiKpiHeader}>
                                    <ExpoLinearGradient
                                        colors={['#f59e0b', '#ea580c']}
                                        style={styles.haAiKpiIconBoxGrad}
                                    >
                                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#ffffff' }}>₹</Text>
                                    </ExpoLinearGradient>
                                    <View style={styles.haAiKpiMeta}>
                                        <Text style={styles.haAiKpiLabel}>Total Revenue</Text>
                                        <Text style={[styles.haAiKpiVal, { color: '#c2410c' }]}>
                                            {formatCurrency(hospitalStats?.stats?.totalRevenue ?? 0)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.haAiKpiFooter}>
                                    <View style={[styles.haAiKpiTrendBadge, { backgroundColor: 'rgba(234, 88, 12, 0.12)' }]}>
                                        <Text style={[styles.haAiKpiTrend, { color: '#c2410c' }]}>● Billed Invoices</Text>
                                    </View>
                                    <Svg viewBox="0 0 80 25" width={76} height={24} fill="none">
                                        <Path d="M 2 22 Q 22 18 45 12 T 78 3" stroke="#ea580c" strokeWidth={2.2} strokeLinecap="round" />
                                    </Svg>
                                </View>
                            </ExpoLinearGradient>

                            {/* 5. Occupancy Rate */}
                            <ExpoLinearGradient
                                colors={['#f0fdfa', '#ccfbf1', '#ffffff']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[styles.haAiKpiCard, { borderColor: '#99f6e4', paddingVertical: width <= 768 ? 12 : 15, paddingHorizontal: width <= 768 ? 12 : 18 }, getKpiCardResponsiveStyle(true)]}
                            >
                                <View style={styles.haAiKpiHeader}>
                                    <ExpoLinearGradient
                                        colors={['#0d9488', '#0f766e']}
                                        style={styles.haAiKpiIconBoxGrad}
                                    >
                                        <Ionicons name="bed-outline" size={18} color="#ffffff" />
                                    </ExpoLinearGradient>
                                    <View style={styles.haAiKpiMeta}>
                                        <Text style={styles.haAiKpiLabel}>Occupancy Rate</Text>
                                        <Text style={[styles.haAiKpiVal, { color: '#0f766e' }]}>
                                            {`${hospitalStats?.stats?.occupancyRate ?? 0}%`}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.haAiKpiFooter}>
                                    <View style={[styles.haAiKpiTrendBadge, { backgroundColor: 'rgba(13, 148, 136, 0.12)' }]}>
                                        <Text style={[styles.haAiKpiTrend, { color: '#0d9488' }]}>● Bed Utilization</Text>
                                    </View>
                                    <Svg viewBox="0 0 80 25" width={76} height={24} fill="none">
                                        <Path d="M 2 18 Q 25 22 50 10 T 78 6" stroke="#0d9488" strokeWidth={2.2} strokeLinecap="round" />
                                    </Svg>
                                </View>
                            </ExpoLinearGradient>

                        </View>
                        );
                    })()}

                    {/* Dedicated Hospital AI Credits Card (Matching Web ha-ai-metric-card card-remaining) */}
                    <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => setActiveTab('aiwallet')}
                        style={styles.haAiCreditsBannerWrapper}
                    >
                        <ExpoLinearGradient
                            colors={['#f8faff', '#ffffff']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.haAiCreditsBannerCard}
                        >
                            <ExpoLinearGradient
                                colors={['#3b82f6', '#60a5fa']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.haAiCreditsTopBar}
                            />
                            
                            <View style={styles.haAiCreditsContent}>
                                <View style={styles.haAiCreditsLeft}>
                                    <View style={styles.haAiCreditsHeader}>
                                        <View style={styles.haAiCreditsIconBox}>
                                            <MaterialCommunityIcons name="robot-outline" size={20} color="#2563eb" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <Text style={styles.haAiCreditsLabel}>REMAINING HOSPITAL AI BALANCE</Text>
                                                <View style={styles.haAiCreditsBadge}>
                                                    <Text style={styles.haAiCreditsBadgeText}>Allocated Quota</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.haAiCreditsSub}>Live cognitive diagnostic balance & allocation tracker</Text>
                                        </View>
                                    </View>

                                    <View style={styles.haAiCreditsValRow}>
                                        <Text style={styles.haAiCreditsVal}>
                                            ₹{aiWallet ? Number(aiWallet.remainingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '2,000.00'}
                                        </Text>
                                        <Text style={styles.haAiCreditsUnit}>Credits</Text>
                                        <View style={styles.haAiCreditsPillGreen}>
                                            <Text style={styles.haAiCreditsPillGreenText}>● Active & Ready</Text>
                                        </View>
                                        {aiWallet && (
                                            <Text style={styles.haAiCreditsUsedText}>
                                                Used: ₹{Number(aiWallet.usedAmount || 0).toFixed(2)} ({aiWallet.budgetAmount ? `${((Number(aiWallet.usedAmount) / Number(aiWallet.budgetAmount)) * 100).toFixed(1)}%` : '0%'})
                                            </Text>
                                        )}
                                    </View>
                                </View>

                                <View style={styles.haAiCreditsRight}>
                                    <View style={styles.haAiCreditsManageBtn}>
                                        <Text style={styles.haAiCreditsManageBtnText}>Open AI Intelligence Portal</Text>
                                        <Feather name="arrow-right" size={14} color="#ffffff" />
                                    </View>
                                </View>
                            </View>
                        </ExpoLinearGradient>
                    </TouchableOpacity>

                    {/* Bottom Panels (Appointments Overview & Quick Summary - Matching Web .bottom) */}
                    {(() => {
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const now = new Date();
                        const curM = monthNames[now.getMonth()];
                        const prevM = monthNames[(now.getMonth() - 1 + 12) % 12];
                        const dateLabels = chartRange === 'last_month' 
                            ? [`01 ${prevM}`, `05 ${prevM}`, `10 ${prevM}`, `15 ${prevM}`, `20 ${prevM}`, `25 ${prevM}`, `30 ${prevM}`]
                            : chartRange === 'this_year'
                                ? ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov', 'Dec']
                                : [`01 ${curM}`, `05 ${curM}`, `10 ${curM}`, `15 ${curM}`, `20 ${curM}`, `25 ${curM}`, `30 ${curM}`];

                        const chartAreaD = chartRange === 'last_month'
                            ? 'M10,185 C45,150 70,165 95,130 S150,140 180,100 S225,115 250,80 S300,95 330,110 S375,140 405,120 S440,85 465,100 S510,90 540,85 S575,65 605,75 S645,55 675,80 S730,60 790,90 L790,205 L10,205 Z'
                            : chartRange === 'this_year'
                                ? 'M10,160 C50,140 80,120 120,100 S180,110 220,70 S280,85 320,50 S380,60 420,80 S480,55 520,40 S580,45 620,35 S680,50 720,30 S760,25 790,45 L790,205 L10,205 Z'
                                : 'M10,178 C40,135 65,158 90,145 S140,155 170,120 S215,130 240,90 S290,105 320,125 S365,170 395,155 S430,105 455,125 S500,105 530,112 S565,78 595,95 S635,70 665,100 S720,80 790,105 L790,205 L10,205 Z';

                        const chartLineD = chartRange === 'last_month'
                            ? 'M10,185 C45,150 70,165 95,130 S150,140 180,100 S225,115 250,80 S300,95 330,110 S375,140 405,120 S440,85 465,100 S510,90 540,85 S575,65 605,75 S645,55 675,80 S730,60 790,90'
                            : chartRange === 'this_year'
                                ? 'M10,160 C50,140 80,120 120,100 S180,110 220,70 S280,85 320,50 S380,60 420,80 S480,55 520,40 S580,45 620,35 S680,50 720,30 S760,25 790,45'
                                : 'M10,178 C40,135 65,158 90,145 S140,155 170,120 S215,130 240,90 S290,105 320,125 S365,170 395,155 S430,105 455,125 S500,105 530,112 S565,78 595,95 S635,70 665,100 S720,80 790,105';

                        return (
                            <View style={[styles.haBottomGrid, width <= 768 && { flexDirection: 'column' }]}>
                                {/* Left Panel: Appointments Overview (Matching Web .panel) */}
                                <View style={[styles.haChartPanel, width <= 768 && { width: '100%', minWidth: '100%' }]}>
                                    <View style={styles.haPanelHead}>
                                        <View style={styles.haPanelTitle}>
                                            <View style={styles.haMiniIconBox}>
                                                <Text style={{ fontSize: 14, color: '#4c72ee' }}>▦</Text>
                                            </View>
                                            <Text style={styles.haPanelTitleText}>Appointments Overview</Text>
                                        </View>
                                        <View style={styles.haChartRangeRow}>
                                            {[
                                                { id: 'this_month', label: 'This Month' },
                                                { id: 'last_month', label: 'Last Month' },
                                                { id: 'this_year', label: 'This Year' },
                                            ].map((r) => (
                                                <TouchableOpacity 
                                                    key={r.id}
                                                    style={[styles.haRangePill, chartRange === r.id && styles.haRangePillActive]}
                                                    onPress={() => setChartRange(r.id)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={[styles.haRangePillText, chartRange === r.id && styles.haRangePillTextActive]}>
                                                        {r.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Chart container with 4 exact Web gridlines */}
                                    <View style={styles.haChartContainer}>
                                        <View style={[styles.haGridline, { top: 20 }]} />
                                        <View style={[styles.haGridline, { top: 72 }]} />
                                        <View style={[styles.haGridline, { top: 124 }]} />
                                        <View style={[styles.haGridline, { top: 176 }]} />

                                        <Svg style={styles.haLineSvg} viewBox="0 0 800 210" preserveAspectRatio="none">
                                            <Defs>
                                                <LinearGradient id="areaGradHaOverview" x1="0" y1="0" x2="0" y2="1">
                                                    <Stop offset="0%" stopColor="#7560ee" stopOpacity={0.25} />
                                                    <Stop offset="100%" stopColor="#7560ee" stopOpacity={0.0} />
                                                </LinearGradient>
                                            </Defs>
                                            <Path d={chartAreaD} fill="url(#areaGradHaOverview)" />
                                            <Path d={chartLineD} fill="none" stroke="#7658ed" strokeWidth={4} strokeLinecap="round" />
                                        </Svg>
                                    </View>

                                    <View style={styles.haChartDatesRow}>
                                        {dateLabels.map((lbl, idx) => (
                                            <Text key={idx} style={styles.haChartDateText}>{lbl}</Text>
                                        ))}
                                    </View>
                                </View>

                                {/* Right Panel: Quick Summary (Matching Web .panel .quick-list) */}
                                <View style={[styles.haSummaryPanel, width <= 768 && { width: '100%', minWidth: '100%' }]}>
                                    <View style={styles.haPanelHead}>
                                        <View style={styles.haPanelTitle}>
                                            <View style={styles.haMiniIconBox}>
                                                <Text style={{ fontSize: 14, color: '#4c72ee' }}>▣</Text>
                                            </View>
                                            <Text style={styles.haPanelTitleText}>Quick Summary</Text>
                                        </View>
                                    </View>

                                    <View style={styles.haQuickList}>
                                        {/* Row 1: Completed */}
                                        <View style={styles.haQuickRow}>
                                            <View style={[styles.haQuickIconBox, { backgroundColor: '#e9faf6' }]}>
                                                <Text style={{ color: '#09a997', fontSize: 14, fontWeight: '700' }}>✓</Text>
                                            </View>
                                            <View style={styles.haQuickText}>
                                                <Text style={styles.haQuickTitle}>Completed</Text>
                                                <Text style={styles.haQuickSubtitle}>Completed appointments</Text>
                                            </View>
                                            <Text style={styles.haQuickCount}>
                                                {hospitalStats?.stats?.completedAppointments ?? 0}
                                            </Text>
                                        </View>

                                        {/* Row 2: Pending / Upcoming */}
                                        <View style={styles.haQuickRow}>
                                            <View style={[styles.haQuickIconBox, { backgroundColor: '#fff1dc' }]}>
                                                <Text style={{ color: '#ee9d27', fontSize: 14, fontWeight: '700' }}>◷</Text>
                                            </View>
                                            <View style={styles.haQuickText}>
                                                <Text style={styles.haQuickTitle}>Pending / Upcoming</Text>
                                                <Text style={styles.haQuickSubtitle}>Upcoming appointments</Text>
                                            </View>
                                            <Text style={styles.haQuickCount}>
                                                {hospitalStats?.stats?.pendingAppointments ?? 0}
                                            </Text>
                                        </View>

                                        {/* Row 3: Lab Reports */}
                                        <View style={styles.haQuickRow}>
                                            <View style={[styles.haQuickIconBox, { backgroundColor: '#eaf1ff' }]}>
                                                <Text style={{ color: '#4c75ed', fontSize: 14, fontWeight: '700' }}>♜</Text>
                                            </View>
                                            <View style={styles.haQuickText}>
                                                <Text style={styles.haQuickTitle}>Lab Reports</Text>
                                                <Text style={styles.haQuickSubtitle}>Pending reports</Text>
                                            </View>
                                            <Text style={styles.haQuickCount}>
                                                {hospitalStats?.stats?.pendingLabReports ?? (hospitalStats?.stats?.labReportCount ?? 0)}
                                            </Text>
                                        </View>

                                        {/* Row 4: Pharmacy Orders */}
                                        <View style={[styles.haQuickRow, { borderBottomWidth: 0 }]}>
                                            <View style={[styles.haQuickIconBox, { backgroundColor: '#f1ebff' }]}>
                                                <Text style={{ color: '#7a53e8', fontSize: 14, fontWeight: '700' }}>▣</Text>
                                            </View>
                                            <View style={styles.haQuickText}>
                                                <Text style={styles.haQuickTitle}>Pharmacy Orders</Text>
                                                <Text style={styles.haQuickSubtitle}>Pending pharmacy orders</Text>
                                            </View>
                                            <Text style={styles.haQuickCount}>
                                                {hospitalStats?.stats?.pharmacyOrderCount ?? 0}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    })()}

                    {/* 1. Modern Glassmorphic "My Profile" Card (Matching Web ha-profile-modern-card) */}
                    <View style={styles.haProfileModernCard}>
                        <View style={styles.haCardHeaderWrap}>
                            <View style={styles.haCardTitleBadge}>
                                <Feather name="user" size={18} color="#2563eb" />
                            </View>
                            <View>
                                <Text style={styles.haCardTitle}>My Profile</Text>
                                <View style={styles.haTitleUnderline} />
                            </View>
                        </View>

                        <View style={styles.haProfileBody}>
                            {/* Left: Avatar with Double Glow Rings & Edit Pencil Badge */}
                            <View style={styles.haAvatarContainer}>
                                {profileFile ? (
                                    <Image source={{ uri: profileFile.uri }} style={styles.haAvatarImg} />
                                ) : currentUser?.avatar ? (
                                    <Image source={{ uri: currentUser.avatar }} style={styles.haAvatarImg} />
                                ) : (
                                    <View style={styles.haAvatarInitials}>
                                        <Text style={styles.haAvatarInitialsText}>{(currentUser?.name || 'A').charAt(0).toUpperCase()}</Text>
                                    </View>
                                )}
                                <TouchableOpacity 
                                    style={styles.haAvatarEditBadge} 
                                    onPress={handlePickProfilePhoto}
                                    activeOpacity={0.8}
                                >
                                    <Feather name="edit-2" size={12} color="#0284c7" />
                                </TouchableOpacity>
                            </View>

                            {/* Middle: User Info & Actions */}
                            <View style={styles.haProfileInfoBlock}>
                                <Text style={styles.haProfileName}>{currentUser?.name || 'Hospital Admin'}</Text>
                                <Text style={styles.haProfileEmail}>{currentUser?.email || ''}</Text>
                                
                                <View style={styles.haProfileActions}>
                                    <TouchableOpacity style={styles.haChoosePhotoBtn} onPress={handlePickProfilePhoto}>
                                        <Feather name="camera" size={14} color="#334155" />
                                        <Text style={styles.haChoosePhotoBtnText}>Choose Photo</Text>
                                    </TouchableOpacity>
                                    
                                    {profileFile && (
                                        <TouchableOpacity 
                                            onPress={handleSaveProfilePhoto} 
                                            disabled={savingProfile} 
                                            style={styles.haSavePhotoBtn}
                                        >
                                            <Text style={styles.haSavePhotoBtnText}>{savingProfile ? 'Saving...' : 'Save Photo'}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* Right: 3D Holographic AI Security Shield & Floating Orbs (Desktop Only) */}
                            {!isMobile && (
                                <View style={styles.haProfileSecurityShield}>
                                    <Svg viewBox="0 0 280 180" width={220} height={140} fill="none">
                                        <Defs>
                                            <LinearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
                                                <Stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.8" />
                                                <Stop offset="100%" stopColor="#bae6fd" stopOpacity="0.2" />
                                            </LinearGradient>
                                            <LinearGradient id="userGlowGrad" x1="0" y1="0" x2="0" y2="1">
                                                <Stop offset="0%" stopColor="#0ea5e9" />
                                                <Stop offset="100%" stopColor="#3b82f6" />
                                            </LinearGradient>
                                        </Defs>

                                        {/* Planetary Orbit Rings */}
                                        <Ellipse cx="140" cy="90" rx="105" ry="42" stroke="#38bdf8" strokeWidth={1.2} strokeDasharray="3 4" transform="rotate(-15 140 90)" opacity={0.6} />
                                        <Ellipse cx="140" cy="90" rx="95" ry="36" stroke="#60a5fa" strokeWidth={1.2} transform="rotate(25 140 90)" opacity={0.5} />
                                        <Circle cx="140" cy="90" r="70" fill="none" stroke="#e0f2fe" strokeWidth={1} opacity={0.4} />

                                        {/* Central Security Shield */}
                                        <Path d="M 140 32 C 168 32 186 44 192 62 C 192 108 158 140 140 152 C 122 140 88 108 88 62 C 94 44 112 32 140 32 Z"
                                            fill="url(#shieldGrad)" stroke="#38bdf8" strokeWidth={1.8} strokeLinejoin="round" />

                                        {/* User Silhouette Inside Shield */}
                                        <Circle cx="140" cy="74" r="16" stroke="url(#userGlowGrad)" strokeWidth={3} fill="none" />
                                        <Path d="M 118 122 C 118 104 128 98 140 98 C 152 98 162 104 162 122" stroke="url(#userGlowGrad)" strokeWidth={3} strokeLinecap="round" fill="none" />

                                        {/* Floating Micro Orbs */}
                                        {/* Heartbeat Orb */}
                                        <G transform="translate(68, 38)">
                                            <Circle cx="14" cy="14" r="14" fill="#eff6ff" stroke="#93c5fd" strokeWidth={1.2} />
                                            <Path d="M 8 15 L 11 15 L 13 11 L 15 18 L 17 13 L 19 15 L 21 15" stroke="#0284c7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                        </G>

                                        {/* Users Group Orb */}
                                        <G transform="translate(208, 118)">
                                            <Circle cx="14" cy="14" r="14" fill="#ecfeff" stroke="#a5f3fc" strokeWidth={1.2} />
                                            <Path d="M 11 12 A 3 3 0 1 0 11 6 A 3 3 0 1 0 11 12 Z M 17 11 A 2.5 2.5 0 1 0 17 6 M 6 20 C 6 17 8.5 15 11 15 C 13.5 15 16 17 16 20 M 16 15 C 18 15 21 16.5 21 19"
                                                stroke="#0891b2" strokeWidth={1.6} strokeLinecap="round" fill="none" />
                                        </G>

                                        {/* Particle Sparkles */}
                                        <Circle cx="64" cy="132" r="3" fill="#38bdf8" />
                                        <Circle cx="218" cy="46" r="2.5" fill="#60a5fa" />
                                        <Path d="M 52 74 L 56 74 M 54 72 L 54 76" stroke="#93c5fd" strokeWidth={1.5} strokeLinecap="round" />
                                        <Path d="M 235 94 L 239 94 M 237 92 L 237 96" stroke="#93c5fd" strokeWidth={1.5} strokeLinecap="round" />
                                    </Svg>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* 2. Modern Glassmorphic "My Hospital" Card (Matching Web ha-hospital-modern-card) */}
                    {hospitalInfo && (
                        <View style={styles.haHospitalModernCard}>
                            <View style={styles.haCardHeaderWrap}>
                                <View style={styles.haCardTitleBadge}>
                                    <Feather name="home" size={18} color="#2563eb" />
                                </View>
                                <View>
                                    <Text style={styles.haCardTitle}>My Hospital</Text>
                                    <View style={styles.haTitleUnderline} />
                                </View>
                            </View>

                            {/* 4-Column Structured Glass Pill Bar */}
                            <View style={styles.haHospitalPillGrid}>
                                {/* Col 1: Name */}
                                <View style={styles.haHospitalPillCol}>
                                    <View style={[styles.haHospitalIconBadge, { backgroundColor: '#eff6ff' }]}>
                                        <Feather name="activity" size={18} color="#0284c7" />
                                    </View>
                                    <View style={styles.haHospitalPillInfo}>
                                        <Text style={styles.haHospitalPillLabel}>Name</Text>
                                        <Text style={styles.haHospitalPillValue} numberOfLines={1}>{hospitalInfo.name || '—'}</Text>
                                    </View>
                                </View>

                                {/* Col 2: City */}
                                <View style={styles.haHospitalPillCol}>
                                    <View style={[styles.haHospitalIconBadge, { backgroundColor: '#eff6ff' }]}>
                                        <Feather name="map-pin" size={18} color="#3b82f6" />
                                    </View>
                                    <View style={styles.haHospitalPillInfo}>
                                        <Text style={styles.haHospitalPillLabel}>City</Text>
                                        <Text style={styles.haHospitalPillValue} numberOfLines={1}>
                                            {hospitalInfo.city ? `${hospitalInfo.city}${hospitalInfo.state ? `, ${hospitalInfo.state}` : ''}` : (hospitalInfo.address || '—')}
                                        </Text>
                                    </View>
                                </View>

                                {/* Col 3: Phone */}
                                <View style={styles.haHospitalPillCol}>
                                    <View style={[styles.haHospitalIconBadge, { backgroundColor: '#f0fdf4' }]}>
                                        <Feather name="phone" size={18} color="#0d9488" />
                                    </View>
                                    <View style={styles.haHospitalPillInfo}>
                                        <Text style={styles.haHospitalPillLabel}>Phone</Text>
                                        <Text style={styles.haHospitalPillValue} numberOfLines={1}>{hospitalInfo.phone || '—'}</Text>
                                    </View>
                                </View>

                                {/* Col 4: Email */}
                                <View style={styles.haHospitalPillCol}>
                                    <View style={[styles.haHospitalIconBadge, { backgroundColor: '#eff6ff' }]}>
                                        <Feather name="mail" size={18} color="#0284c7" />
                                    </View>
                                    <View style={styles.haHospitalPillInfo}>
                                        <Text style={styles.haHospitalPillLabel}>Email</Text>
                                        <Text style={styles.haHospitalPillValue} numberOfLines={1}>{hospitalInfo.email || '—'}</Text>
                                    </View>
                                </View>
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
                        <View style={{ flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: 16, gap: 12 }}>
                            <View>
                                <Text style={styles.cardTitle}>All Staff & Doctors</Text>
                                <Text style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
                                    {users.filter(u => {
                                        const q = (staffSearchQuery || '').toLowerCase().trim();
                                        const matchesQ = !q || (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.phone || '').includes(q) || (u.role || '').toLowerCase().includes(q);
                                        const matchesRole = staffRoleFilter === 'all' || (u.role || '').toLowerCase() === staffRoleFilter.toLowerCase();
                                        return matchesQ && matchesRole;
                                    }).length} members listed
                                </Text>
                            </View>

                            {/* Search and Role Filter Toolbar */}
                            <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 10, width: isMobile ? '100%' : 'auto', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#e2e8f0', minWidth: isMobile ? '100%' : 220 }}>
                                    <Feather name="search" size={15} color="#94a3b8" />
                                    <TextInput
                                        style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 8, fontSize: 13, color: '#0f172a' }}
                                        placeholder="Search staff, email, role..."
                                        placeholderTextColor="#94a3b8"
                                        value={staffSearchQuery}
                                        onChangeText={setStaffSearchQuery}
                                    />
                                    {staffSearchQuery !== '' && (
                                        <TouchableOpacity onPress={() => setStaffSearchQuery('')}>
                                            <Feather name="x" size={14} color="#94a3b8" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Role Filter */}
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: isMobile ? '100%' : 340 }}>
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                        {['all', ...Array.from(new Set(users.map(u => (u.role || '').toLowerCase()).filter(Boolean)))].map(rKey => (
                                            <TouchableOpacity
                                                key={rKey}
                                                onPress={() => setStaffRoleFilter(rKey)}
                                                style={{
                                                    paddingVertical: 6,
                                                    paddingHorizontal: 12,
                                                    borderRadius: 20,
                                                    borderWidth: 1,
                                                    backgroundColor: staffRoleFilter === rKey ? '#2563eb' : '#f8fafc',
                                                    borderColor: staffRoleFilter === rKey ? '#1d4ed8' : '#e2e8f0'
                                                }}
                                            >
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: staffRoleFilter === rKey ? '#ffffff' : '#64748b', textTransform: 'capitalize' }}>
                                                    {rKey === 'all' ? 'All Roles' : rKey}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>
                        </View>

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
                                    {users.filter(userItem => {
                                        const q = (staffSearchQuery || '').toLowerCase().trim();
                                        const matchesQ = !q || (userItem.name || '').toLowerCase().includes(q) || (userItem.email || '').toLowerCase().includes(q) || (userItem.phone || '').includes(q) || (userItem.role || '').toLowerCase().includes(q);
                                        const matchesRole = staffRoleFilter === 'all' || (userItem.role || '').toLowerCase() === staffRoleFilter.toLowerCase();
                                        return matchesQ && matchesRole;
                                    }).map(userItem => {
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
                                <TextInput style={styles.staffInput} placeholder="e.g. ICU" value={newFacilityName} onChangeText={setNewFacilityName} />
                            </View>
                            <View style={{ flex: 1, minWidth: 150 }}>
                                <Text style={styles.staffLabel}>Price Per Day (₹)</Text>
                                <TextInput style={styles.staffInput} placeholder="e.g. 5000" keyboardType="numeric" value={newFacilityPrice} onChangeText={setNewFacilityPrice} />
                            </View>
                            <TouchableOpacity style={[styles.btnSave, { height: 44, justifyContent: 'center' }]} onPress={handleAddFacility} disabled={addingFacility}>
                                <Text style={styles.btnSaveText}>{addingFacility ? 'Adding...' : '+ Add Facility'}</Text>
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
                                            <DatePickerInput
                                                value={inventoryForm.expiryDate}
                                                onChange={t => setInventoryForm({ ...inventoryForm, expiryDate: t })}
                                                placeholder="YYYY-MM-DD"
                                                title="Select Expiry Date"
                                            />
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

            {/* ===================== AI INTELLIGENCE TAB ===================== */}
            {activeTab === 'aiwallet' && (
                <View>
                    {renderAIIntelligenceContent(false)}
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

                        {accountsSubTab === 'bank' && (
                            <View style={{ padding: 40, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, borderColor: '#e2e8f0', borderWidth: 1 }}>
                                <Text style={{ fontSize: 44, marginBottom: 12 }}>🏦</Text>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 6 }}>Bank Transfers Integration</Text>
                                <Text style={{ fontSize: 14, color: '#64748b' }}>This feature is coming soon.</Text>
                            </View>
                        )}

                        {accountsSubTab === 'card' && (
                            <View style={{ padding: 40, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, borderColor: '#e2e8f0', borderWidth: 1 }}>
                                <Text style={{ fontSize: 44, marginBottom: 12 }}>💳</Text>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 6 }}>Card Payment Gateways</Text>
                                <Text style={{ fontSize: 14, color: '#64748b' }}>This feature is coming soon.</Text>
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

            {/* ===================== AI INTELLIGENCE & DOCTOR TRACKING MODAL ===================== */}
            <Modal
                visible={showAIDoctorModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowAIDoctorModal(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setShowAIDoctorModal(false)}
                >
                    <TouchableOpacity 
                        activeOpacity={1} 
                        onPress={e => e.stopPropagation()} 
                        style={styles.haAiModalWrapper}
                    >
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {renderAIIntelligenceContent(true)}
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    // --- Web Parity Hero Banner (Matching Web ha-ai-hero-banner) ---
    haAiHeroBannerWrapper: {
        marginBottom: 20,
        width: '100%',
    },
    haAiHeroBanner: {
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: 'rgba(226, 232, 240, 0.8)',
        paddingVertical: 26,
        paddingHorizontal: 32,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        overflow: 'hidden',
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 30,
        elevation: 4,
        position: 'relative',
    },
    haAiCircuitBg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
    },
    haAiHeroLeft: {
        flex: 1,
        zIndex: 3,
        maxWidth: 620,
    },
    haAiHeroTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: 8,
        letterSpacing: -0.5,
        lineHeight: 34,
    },
    haAiSubtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    haSubtitlePulseDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#8b5cf6',
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 8,
        elevation: 3,
    },
    haAiHeroSubtitle: {
        fontSize: 14,
        color: '#475569',
        fontWeight: '600',
        lineHeight: 20,
    },
    haAiRightBuilding: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 360,
        height: '100%',
        zIndex: 2,
        pointerEvents: 'none',
        justifyContent: 'flex-end',
    },
    haAiHospitalImg: {
        width: '100%',
        height: '100%',
        borderBottomRightRadius: 22,
    },
    haAiHospitalFadeOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },

    // --- Web Parity Floating Tabs Card (Matching Web ha-ai-tabs-card) ---
    haAiTabsCardWrapper: {
        marginBottom: 16,
        width: '100%',
    },
    haAiTabsCard: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#c7d2fe',
        paddingVertical: 6,
        paddingHorizontal: 8,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.07,
        shadowRadius: 20,
        elevation: 3,
        position: 'relative',
        overflow: 'hidden',
    },
    haAiTabsScroll: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    haAiTabBtn: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 6,
        paddingBottom: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        position: 'relative',
    },
    haAiTabBtnActive: {
        backgroundColor: '#ffffff',
        borderColor: '#38bdf8',
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
        elevation: 2,
    },
    haAiTabIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
    },
    haAiTabIconWrapActive: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#38bdf8',
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 4,
    },
    haAiTabLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        textAlign: 'center',
    },
    haAiTabLabelActive: {
        color: '#0284c7',
        fontWeight: '800',
    },
    haActiveNeonSlider: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2.5,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        overflow: 'hidden',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
    },
    haPattiFullBeam: {
        position: 'absolute',
        bottom: 0,
        height: 2,
        width: 260,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 8,
    },

    // --- Web Parity Analytics Timeframe Bar ---
    haAiTimeframeBar: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 14,
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 1,
    },
    haAiTimeframeTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    haAiTimeframeTitleText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    haAiTimeframeControls: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
    },
    haAiCustomDateInputs: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    haAiDatePicker: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        fontSize: 12,
        color: '#1e293b',
        backgroundColor: '#f8fafc',
        width: 110,
    },
    haAiApplyBtn: {
        backgroundColor: '#2563eb',
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
    haAiApplyBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
    haAiPresetPills: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
    },
    haAiPresetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    haAiApplyCustomBtn: {
        backgroundColor: '#eff6ff',
        borderColor: '#bfdbfe',
    },
    haAiPresetBtnActive: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },
    haAiPresetBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    haAiPresetBtnTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    haAiCustomBadgeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ffffff',
        marginLeft: 6,
    },
    haAiRefreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    haAiRefreshBtnActive: {
        backgroundColor: '#f1f5f9',
    },
    haAiRefreshBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
    },

    // Custom Date Range Modal
    haCustomDateModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    haCustomDateModalCard: {
        width: '100%',
        maxWidth: 440,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
        overflow: 'hidden',
    },
    haCustomModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    haCustomModalTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    haModalTitleIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#eff6ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    haCustomModalTitleText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
    },
    haCustomModalSubtitle: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    haCustomModalClose: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    haCustomModalBody: {
        padding: 18,
    },
    haDateInputsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    haDateFieldGroup: {
        flex: 1,
    },
    haDateFieldLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 6,
    },
    haDateInputField: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#ffffff',
    },
    haDateArrowSeparator: {
        paddingTop: 18,
    },
    haModalQuickPresets: {
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 14,
    },
    haQuickPresetsTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        marginBottom: 8,
    },
    haQuickPresetChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    haQuickChip: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    haQuickChipActive: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },
    haQuickChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
    },
    haQuickChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    haCustomModalFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 10,
        padding: 16,
        backgroundColor: '#f8fafc',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    haBtnModalReset: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    haBtnModalResetText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    haBtnModalApply: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#2563eb',
    },
    haBtnModalApplyText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },

    // --- Web Parity 5 KPI Metric Cards (Matching Web ha-ai-kpis-grid) ---
    haAiKpisGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 18,
        width: '100%',
    },
    haAiKpiCard: {
        borderRadius: 16,
        borderWidth: 1.5,
        paddingVertical: 15,
        paddingHorizontal: 18,
        justifyContent: 'space-between',
        gap: 12,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
        elevation: 2,
        overflow: 'hidden',
    },
    haAiKpiHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    haAiKpiIconBoxGrad: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    haAiKpiMeta: {
        flex: 1,
    },
    haAiKpiLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        marginBottom: 2,
    },
    haAiKpiVal: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.4,
        lineHeight: 26,
    },
    haAiKpiFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
    },
    haAiKpiTrendBadge: {
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 20,
    },
    haAiKpiTrend: {
        fontSize: 11,
        fontWeight: '800',
    },

    // --- Dedicated Hospital AI Credits Banner Card (Matching Web ha-ai-metric-card card-remaining) ---
    haAiCreditsBannerWrapper: {
        marginBottom: 18,
        width: '100%',
    },
    haAiCreditsBannerCard: {
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#dbeafe',
        backgroundColor: '#ffffff',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 2,
        overflow: 'hidden',
    },
    haAiCreditsTopBar: {
        height: 4,
        width: '100%',
    },
    haAiCreditsContent: {
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
    },
    haAiCreditsLeft: {
        flex: 1,
        minWidth: 260,
    },
    haAiCreditsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
    },
    haAiCreditsIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    haAiCreditsLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748b',
        letterSpacing: 0.5,
    },
    haAiCreditsBadge: {
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    haAiCreditsBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#2563eb',
    },
    haAiCreditsSub: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    haAiCreditsValRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    haAiCreditsVal: {
        fontSize: 26,
        fontWeight: '900',
        color: '#1d4ed8',
        letterSpacing: -0.5,
    },
    haAiCreditsUnit: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
    },
    haAiCreditsPillGreen: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 20,
        backgroundColor: '#dcfce7',
    },
    haAiCreditsPillGreenText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#16a34a',
    },
    haAiCreditsUsedText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
    },
    haAiCreditsRight: {
        alignSelf: 'auto',
    },
    haAiCreditsManageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#2563eb',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 2,
    },
    haAiCreditsManageBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },

    // --- Web Parity Bottom Panels Grid (Matching Web .bottom) ---
    haBottomGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 15,
        marginTop: 16,
        marginBottom: 24,
    },
    haChartPanel: {
        flex: 1.55,
        minWidth: 320,
        minHeight: 300,
        padding: 18,
        borderWidth: 1,
        borderColor: '#dfecec',
        borderRadius: 19,
        backgroundColor: '#ffffff',
        shadowColor: '#235e64',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 28,
        elevation: 3,
    },
    haSummaryPanel: {
        flex: 0.85,
        minWidth: 260,
        minHeight: 300,
        padding: 18,
        borderWidth: 1,
        borderColor: '#dfecec',
        borderRadius: 19,
        backgroundColor: '#ffffff',
        shadowColor: '#235e64',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 28,
        elevation: 3,
    },
    haPanelHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    haPanelTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
    },
    haMiniIconBox: {
        width: 31,
        height: 31,
        borderRadius: 9,
        backgroundColor: '#edf2ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    haPanelTitleText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#17324d',
    },
    haChartRangeRow: {
        flexDirection: 'row',
        gap: 6,
    },
    haRangePill: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#e0e8ed',
        borderRadius: 9,
        backgroundColor: '#ffffff',
    },
    haRangePillActive: {
        backgroundColor: '#eff6ff',
        borderColor: '#3b82f6',
    },
    haRangePillText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#536b7e',
    },
    haRangePillTextActive: {
        color: '#1d4ed8',
        fontWeight: '700',
    },
    haChartContainer: {
        height: 215,
        marginTop: 18,
        position: 'relative',
        paddingLeft: 35,
        paddingRight: 8,
    },
    haGridline: {
        position: 'absolute',
        left: 35,
        right: 8,
        borderTopWidth: 1,
        borderTopColor: '#edf1f4',
    },
    haLineSvg: {
        width: '100%',
        height: '100%',
        zIndex: 2,
    },
    haChartDatesRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingLeft: 35,
        paddingRight: 10,
        marginTop: 6,
    },
    haChartDateText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#91a0ad',
    },
    haQuickList: {
        marginTop: 16,
    },
    haQuickRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        paddingVertical: 12,
        paddingHorizontal: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#edf1f3',
    },
    haQuickIconBox: {
        width: 35,
        height: 35,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    haQuickText: {
        flex: 1,
    },
    haQuickTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1e293b',
    },
    haQuickSubtitle: {
        fontSize: 9,
        color: '#8b9ba8',
        marginTop: 3,
    },
    haQuickCount: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0f172a',
    },

    // --- Web Parity Profile & Hospital Cards ---
    haProfileModernCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 12,
        elevation: 2,
    },
    haCardHeaderWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    haCardTitleBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#eff6ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    haCardTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
    },
    haTitleUnderline: {
        width: 28,
        height: 3,
        borderRadius: 2,
        backgroundColor: '#3b82f6',
        marginTop: 3,
    },
    haProfileBody: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 20,
    },
    haAvatarContainer: {
        position: 'relative',
        width: 76,
        height: 76,
    },
    haAvatarImg: {
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 3,
        borderColor: '#38bdf8',
    },
    haAvatarInitials: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#eff6ff',
        borderWidth: 3,
        borderColor: '#93c5fd',
        alignItems: 'center',
        justifyContent: 'center',
    },
    haAvatarInitialsText: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0284c7',
    },
    haAvatarEditBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#bae6fd',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    haProfileInfoBlock: {
        flex: 1,
        minWidth: 200,
    },
    haProfileName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 2,
    },
    haProfileEmail: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 12,
    },
    haProfileActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
    },
    haChoosePhotoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#f8fafc',
    },
    haChoosePhotoBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
    },
    haSavePhotoBtn: {
        backgroundColor: '#0284c7',
        paddingVertical: 7,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    haSavePhotoBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    haProfileSecurityShield: {
        alignItems: 'center',
        justifyContent: 'center',
    },

    haHospitalModernCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 12,
        elevation: 2,
    },
    haHospitalPillGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    haHospitalPillCol: {
        flex: 1,
        minWidth: 180,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    haHospitalIconBadge: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    haHospitalPillInfo: {
        flex: 1,
    },
    haHospitalPillLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    haHospitalPillValue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
        marginTop: 1,
    },

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
    chartRangeBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    chartRangeBtnActive: {
        backgroundColor: '#ede9fe',
        borderColor: '#c4b5fd',
    },
    chartRangeBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    chartRangeBtnTextActive: {
        color: '#7c3aed',
    },
    quickSummaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    quickSummaryIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
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
    },

    // --- Web Parity AI Intelligence & Doctor Credit Tracking ---
    haAiIntelligenceContainer: {
        width: '100%',
        gap: 20,
        marginBottom: 24,
    },
    haAiModalMode: {
        padding: 4,
    },
    haAiModalWrapper: {
        width: '95%',
        maxWidth: 1040,
        maxHeight: '90%',
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 25 },
        shadowOpacity: 0.25,
        shadowRadius: 60,
        elevation: 20,
    },
    haAiHeaderCard: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 2,
    },
    haAiHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flex: 1,
        minWidth: 280,
    },
    haAiHeaderIconBox: {
        width: 52,
        height: 52,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#bfdbfe',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 3,
    },
    haAiHeaderTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
    },
    haAiMainTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.3,
    },
    haAiHeaderDesc: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 4,
        lineHeight: 18,
    },
    haAiStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: 20,
    },
    haAiStatusPillActive: {
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
    },
    haAiStatusPillInactive: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    haAiStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10b981',
    },
    haAiStatusPillText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    haAiStatusPillTextActive: {
        color: '#065f46',
    },
    haAiStatusPillTextInactive: {
        color: '#991b1b',
    },
    haAiHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    haAiRefreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 9,
        paddingHorizontal: 16,
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderRadius: 12,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    haAiRefreshBtnLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    haAiModalCloseBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    haAiModalCloseBtnText: {
        color: '#64748b',
        fontSize: 16,
        fontWeight: '800',
    },

    // 4 Summary Metric Cards
    haAiMetricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    haAiMetricCard: {
        flex: 1,
        minWidth: 200,
        borderRadius: 18,
        paddingVertical: 20,
        paddingHorizontal: 22,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 2,
    },
    haAiMetricTopBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
    },
    haAiCardRemaining: {
        borderColor: '#dbeafe',
        backgroundColor: '#ffffff',
    },
    haAiCardBudget: {
        borderColor: '#ede9fe',
        backgroundColor: '#ffffff',
    },
    haAiCardUsed: {
        borderColor: '#ffedd5',
        backgroundColor: '#ffffff',
    },
    haAiCardRequests: {
        borderColor: '#dcfce7',
        backgroundColor: '#ffffff',
    },
    haAiMetricHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    haAiMetricLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    haAiMetricBadge: {
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(148, 163, 184, 0.12)',
    },
    haAiMetricBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    haAiMetricValRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
        marginBottom: 10,
    },
    haAiMetricNumber: {
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    haAiMetricUnit: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    haAiMetricFooter: {
        marginTop: 6,
    },
    haAiMetricPillGreen: {
        fontSize: 12,
        fontWeight: '700',
        color: '#059669',
    },
    haAiMetricSubtext: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    haAiMetricPillOrange: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ea580c',
    },
    haAiMetricPillTeal: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0d9488',
    },

    // Doctor & Logs Section Cards
    haAiSectionCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 20,
        padding: 22,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 16,
        elevation: 2,
    },
    haAiSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
        flexWrap: 'wrap',
        gap: 12,
    },
    haAiSectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.2,
    },
    haAiSectionSubtitle: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
        marginTop: 3,
    },
    haAiSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 260,
        position: 'relative',
    },
    haAiSearchIcon: {
        position: 'absolute',
        left: 12,
        fontSize: 13,
        zIndex: 2,
    },
    haAiSearchInput: {
        width: '100%',
        paddingVertical: 8,
        paddingLeft: 34,
        paddingRight: 34,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        fontSize: 13,
        backgroundColor: '#ffffff',
        color: '#0f172a',
    },
    haAiSearchClear: {
        position: 'absolute',
        right: 10,
        zIndex: 2,
        padding: 4,
    },
    haAiLoadingBox: {
        padding: 40,
        alignItems: 'center',
        gap: 12,
    },
    haAiLoadingText: {
        color: '#64748b',
        fontSize: 13,
        fontWeight: '600',
    },
    haAiEmptyBox: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
    },
    haAiEmptyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
    },
    haAiEmptyDesc: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        maxWidth: 440,
        lineHeight: 18,
    },
    haAiTableWrap: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
    },
    haAiTableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1.5,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    haAiTh: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    haAiTableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    haAiTd: {
        justifyContent: 'center',
    },
    haAiDoctorAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 2,
    },
    haAiDoctorAvatarText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '800',
    },
    haAiDoctorName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
    },
    haAiDoctorId: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
        marginTop: 2,
    },
    haAiCreditChip: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 5,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignSelf: 'flex-start',
    },
    haAiCreditChipConsumed: {
        backgroundColor: '#fff7ed',
        borderColor: '#fed7aa',
    },
    haAiCreditVal: {
        fontWeight: '800',
        color: '#0f172a',
        fontSize: 14,
    },
    haAiCreditTag: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    haAiCallsBadge: {
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderRadius: 10,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        alignSelf: 'flex-start',
    },
    haAiCallsBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1d4ed8',
    },
    haAiFeaturePill: {
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignSelf: 'flex-start',
    },
    haAiFeaturePillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
    },
    haAiProgressWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        width: 140,
    },
    haAiProgressBar: {
        flex: 1,
        height: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 4,
        overflow: 'hidden',
    },
    haAiProgressFill: {
        height: '100%',
        backgroundColor: '#3b82f6',
        borderRadius: 4,
    },
    haAiProgressPercent: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        minWidth: 36,
    },
    haAiDateText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
    },
    haAiLogUser: {
        fontWeight: '700',
        color: '#0f172a',
        fontSize: 13,
    },
    haAiLogsCountBadge: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    haAiLogsCountBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
    },
    haAiLogsFooter: {
        alignItems: 'center',
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        borderStyle: 'dashed',
        marginTop: 10,
    },
    haAiLoadMoreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 18,
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderRadius: 12,
    },
    haAiLoadMoreBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
    },
    haAiLoadBadge: {
        paddingVertical: 2,
        paddingHorizontal: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 6,
    },
    haAiLoadBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    haAiAllLoadedText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    haSubtitlePulseDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#10b981',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
        elevation: 3,
    },
    haAiKpiIconBoxGrad: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    haAiKpiTrendBadge: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    userForm: {
        width: '100%',
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
