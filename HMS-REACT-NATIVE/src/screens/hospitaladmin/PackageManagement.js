import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Platform,
    KeyboardAvoidingView,
    useWindowDimensions
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { receptionAPI, packageAPI } from '../../utils/api';
import OfflineBanner from '../../components/common/OfflineBanner';
import {
    fetchHospitalPackagesWithOffline,
    fetchHospitalPackageAssignmentsWithOffline,
    fetchHospitalPackageStatsWithOffline,
    createPackageOnlineOnly,
    updatePackageOnlineOnly,
    togglePackageOnlineOnly,
    deletePackageOnlineOnly,
    assignPackageOnlineOnly,
    cancelPackageAssignmentOnlineOnly,
    savePackageDraftWithOffline,
    getPackageDraftWithOffline,
    clearPackageDraftWithOffline
} from '../../services/offline/offlineHospitalAdminService';

const CATEGORIES = ['General', 'Maternity', 'Surgery', 'Wellness', 'Dialysis', 'Physiotherapy', 'Dental', 'Eye', 'Cardiology', 'Other'];
const SERVICE_CATEGORIES = ['Consultation', 'Lab', 'Pharmacy', 'Facility', 'Surgery', 'Procedure', 'Nursing', 'Other'];

const emptyService = () => ({
    serviceName: '',
    serviceCategory: 'Other',
    includedQuantity: 1,
    extraChargePerUnit: 0,
    unitPrice: 0,
    notes: ''
});

const emptyForm = () => ({
    name: '',
    code: '',
    description: '',
    category: 'General',
    totalPrice: '',
    discountedPrice: '',
    validityDays: 365,
    services: [emptyService()]
});

const formatCurrency = (amount) => {
    if (amount == null) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN');
};

const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const PackageManagement = () => {
    const { width: windowWidth } = useWindowDimensions();
    const isTablet = windowWidth >= 768;

    // ── State ──────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('packages'); // 'packages' | 'assignments'
    const [packages, setPackages] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [offlineMeta, setOfflineMeta] = useState(null);

    // Modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(null);
    const [editingPackage, setEditingPackage] = useState(null);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [formData, setFormData] = useState(emptyForm());
    const [saving, setSaving] = useState(false);
    const [togglingId, setTogglingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [cancellingId, setCancellingId] = useState(null);

    // Filter Pickers
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const [showFormCategoryPicker, setShowFormCategoryPicker] = useState(false);
    const [activeServiceCategoryPickerIdx, setActiveServiceCategoryPickerIdx] = useState(null);
    const [showPackagePicker, setShowPackagePicker] = useState(false);

    // Assignment form state
    const [assignFormData, setAssignFormData] = useState({ packageId: '', patientId: '', notes: '' });
    const [patientSearch, setPatientSearch] = useState('');
    const [patientResults, setPatientResults] = useState([]);
    const [searchingPatients, setSearchingPatients] = useState(false);
    const searchTimeoutRef = useRef(null);

    // ── Data Loading ───────────────────────────────────────────────────
    const loadPackages = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const params = {};
            if (categoryFilter) params.category = categoryFilter;

            const res = await fetchHospitalPackagesWithOffline(params, isRefresh);
            if (res) {
                setPackages(res.data || []);
                setOfflineMeta(res.fromCache ? {
                    isOffline: true,
                    isStale: res.isStale,
                    cachedAt: res.lastSynced,
                    freshnessNote: res.freshnessNote
                } : null);
            }
        } catch (err) {
            console.error('Load packages error:', err);
            Alert.alert('Error', 'Failed to load packages');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [categoryFilter]);

    const loadAssignments = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const params = {};
            if (statusFilter) params.status = statusFilter;

            const res = await fetchHospitalPackageAssignmentsWithOffline(params, isRefresh);
            if (res) {
                setAssignments(res.data || []);
                setOfflineMeta(res.fromCache ? {
                    isOffline: true,
                    isStale: res.isStale,
                    cachedAt: res.lastSynced,
                    freshnessNote: res.freshnessNote
                } : null);
            }
        } catch (err) {
            console.error('Load assignments error:', err);
            Alert.alert('Error', 'Failed to load assignments');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [statusFilter]);

    const loadStats = useCallback(async (isRefresh = false) => {
        try {
            setStatsLoading(true);
            const res = await fetchHospitalPackageStatsWithOffline(isRefresh);
            if (res) setStats(res.data || null);
        } catch (err) {
            console.error('Load stats error:', err);
        } finally {
            setStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    useEffect(() => {
        if (activeTab === 'packages') loadPackages();
        else if (activeTab === 'assignments') loadAssignments();
    }, [activeTab, loadPackages, loadAssignments]);

    const handleRefreshAll = () => {
        loadPackages(true);
        loadAssignments(true);
        loadStats(true);
    };

    // ── Patient Search for Assignment ──────────────────────────────────
    useEffect(() => {
        if (!patientSearch || patientSearch.length < 2) {
            setPatientResults([]);
            return;
        }
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                setSearchingPatients(true);
                const res = await receptionAPI.searchPatients(patientSearch.trim());
                setPatientResults(res?.patients || res?.data || []);
            } catch (err) {
                console.error('Patient search error:', err);
            } finally {
                setSearchingPatients(false);
            }
        }, 400);
        return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
    }, [patientSearch]);

    // ── Filtered Data ──────────────────────────────────────────────────
    const filteredPackages = packages.filter(p => {
        if (search) {
            const q = search.toLowerCase();
            if (!p.name?.toLowerCase().includes(q) && !p.code?.toLowerCase().includes(q) && !p.description?.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const filteredAssignments = assignments.filter(a => {
        if (search) {
            const q = search.toLowerCase();
            if (!a.patientName?.toLowerCase().includes(q) && !a.patientMRN?.toLowerCase().includes(q) && !a.packageName?.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    // ── Package CRUD Handlers ──────────────────────────────────────────
    const openCreateModal = async () => {
        setEditingPackage(null);
        try {
            const draft = await getPackageDraftWithOffline();
            if (draft && draft.name) {
                setFormData(draft);
            } else {
                setFormData(emptyForm());
            }
        } catch (e) {
            setFormData(emptyForm());
        }
        setShowCreateModal(true);
    };

    const openEditModal = (pkg) => {
        setEditingPackage(pkg);
        setFormData({
            name: pkg.name || '',
            code: pkg.code || '',
            description: pkg.description || '',
            category: pkg.category || 'General',
            totalPrice: pkg.totalPrice != null ? pkg.totalPrice.toString() : '',
            discountedPrice: pkg.discountedPrice != null ? pkg.discountedPrice.toString() : '',
            validityDays: pkg.validityDays || 365,
            services: pkg.services?.length ? pkg.services.map(s => ({
                serviceName: s.serviceName || '',
                serviceCategory: s.serviceCategory || 'Other',
                includedQuantity: s.includedQuantity ?? 1,
                extraChargePerUnit: s.extraChargePerUnit ?? 0,
                unitPrice: s.unitPrice ?? 0,
                notes: s.notes || ''
            })) : [emptyService()]
        });
        setShowCreateModal(true);
    };

    const handleSavePackage = async () => {
        if (!formData.name.trim()) {
            return Alert.alert('Validation Error', 'Package name is required');
        }
        if (!formData.totalPrice || Number(formData.totalPrice) < 0) {
            return Alert.alert('Validation Error', 'Valid total price is required');
        }
        if (!formData.services.length || !formData.services[0].serviceName) {
            return Alert.alert('Validation Error', 'At least one service is required');
        }

        const invalidService = formData.services.find(s => !s.serviceName.trim());
        if (invalidService) {
            return Alert.alert('Validation Error', 'All services must have a name');
        }

        try {
            setSaving(true);
            const payload = {
                name: formData.name.trim(),
                code: formData.code.trim().toUpperCase(),
                description: formData.description.trim(),
                category: formData.category,
                totalPrice: Number(formData.totalPrice),
                discountedPrice: formData.discountedPrice ? Number(formData.discountedPrice) : null,
                validityDays: Number(formData.validityDays) || 365,
                services: formData.services.filter(s => s.serviceName.trim()).map(s => ({
                    serviceName: s.serviceName.trim(),
                    serviceCategory: s.serviceCategory,
                    includedQuantity: Number(s.includedQuantity),
                    extraChargePerUnit: Number(s.extraChargePerUnit) || 0,
                    unitPrice: Number(s.unitPrice) || 0,
                    notes: s.notes || ''
                }))
            };

            let res;
            if (editingPackage) {
                res = await updatePackageOnlineOnly(editingPackage._id, payload);
            } else {
                res = await createPackageOnlineOnly(payload);
            }

            if (res.success) {
                await clearPackageDraftWithOffline();
                Alert.alert('Success', res.message || 'Package saved successfully');
                setShowCreateModal(false);
                loadPackages(true);
                loadStats(true);
            } else {
                Alert.alert('Error', res.message || 'Failed to save package');
            }
        } catch (err) {
            console.error('Save package error:', err);
            Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to save package');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDraft = async () => {
        try {
            await savePackageDraftWithOffline(formData);
            Alert.alert('Draft Saved', 'Package draft saved locally on this device.');
        } catch (err) {
            Alert.alert('Error', 'Failed to save local draft.');
        }
    };

    const handleTogglePackage = async (pkg) => {
        if (togglingId) return;
        try {
            setTogglingId(pkg._id);
            const res = await togglePackageOnlineOnly(pkg._id);
            if (res.success) {
                Alert.alert('Success', res.message);
                loadPackages(true);
                loadStats(true);
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to toggle package');
        } finally {
            setTogglingId(null);
        }
    };

    const handleDeletePackage = async (pkg) => {
        if (deletingId) return;
        try {
            setDeletingId(pkg._id);
            const res = await deletePackageOnlineOnly(pkg._id);
            if (res.success) {
                Alert.alert('Success', res.message);
                setShowConfirmModal(null);
                loadPackages(true);
                loadStats(true);
            }
        } catch (err) {
            Alert.alert('Cannot Delete Package', err.response?.data?.message || err.message || 'Cannot delete this package');
            setShowConfirmModal(null);
        } finally {
            setDeletingId(null);
        }
    };

    // ── Assignment Handlers ────────────────────────────────────────────
    const openAssignModal = (pkg = null) => {
        setAssignFormData({ packageId: pkg?._id || '', patientId: '', notes: '' });
        setPatientSearch('');
        setPatientResults([]);
        setShowAssignModal(true);
    };

    const handleAssignPackage = async () => {
        if (!assignFormData.packageId) return Alert.alert('Validation Error', 'Select a package');
        if (!assignFormData.patientId) return Alert.alert('Validation Error', 'Select a patient');

        try {
            setSaving(true);
            const res = await assignPackageOnlineOnly(assignFormData);
            if (res.success) {
                Alert.alert('Success', res.message || 'Package assigned successfully');
                setShowAssignModal(false);
                loadAssignments(true);
                loadStats(true);
            }
        } catch (err) {
            Alert.alert('Assignment Error', err.response?.data?.message || err.message || 'Failed to assign package');
        } finally {
            setSaving(false);
        }
    };

    const handleCancelAssignment = async (assignment) => {
        if (!assignment || cancellingId) return;
        if (assignment.status && assignment.status !== 'ACTIVE') {
            Alert.alert('Action Not Allowed', 'Only active package assignments can be cancelled');
            return;
        }
        try {
            setCancellingId(assignment._id);
            const res = await cancelPackageAssignmentOnlineOnly(assignment._id, { reason: 'Cancelled by admin' });
            if (res.success) {
                Alert.alert('Success', res.message || 'Package assignment cancelled successfully');
                setShowConfirmModal(null);
                loadAssignments(true);
                loadStats(true);
            }
        } catch (err) {
            Alert.alert('Cancellation Error', err.response?.data?.message || err.message || 'Failed to cancel assignment');
            setShowConfirmModal(null);
        } finally {
            setCancellingId(null);
        }
    };

    // ── Form Helpers ───────────────────────────────────────────────────
    const updateService = (idx, field, value) => {
        setFormData(prev => {
            const services = [...prev.services];
            services[idx] = { ...services[idx], [field]: value };
            return { ...prev, services };
        });
    };

    const addService = () => {
        setFormData(prev => ({ ...prev, services: [...prev.services, emptyService()] }));
    };

    const removeService = (idx) => {
        if (formData.services.length <= 1) {
            return Alert.alert('Validation Error', 'At least one service is required');
        }
        setFormData(prev => ({ ...prev, services: prev.services.filter((_, i) => i !== idx) }));
    };

    // ── Usage calculation helper ───────────────────────────────────────
    const getUsagePercent = (assignment) => {
        if (!assignment.snapshotServices?.length) return 0;
        let totalIncluded = 0, totalUsed = 0;
        assignment.snapshotServices.forEach(s => {
            if (s.includedQuantity === -1) return;
            totalIncluded += s.includedQuantity;
            totalUsed += Math.min(s.usedQuantity || 0, s.includedQuantity);
        });
        return totalIncluded > 0 ? Math.round((totalUsed / totalIncluded) * 100) : 0;
    };

    // ── Assignment status badge styling helper (100% Web Parity) ───────
    const getAssignmentStatusStyles = (status) => {
        switch (status) {
            case 'ACTIVE':
                return {
                    badge: styles.statusBadgeActive,
                    text: styles.statusBadgeTextActive,
                };
            case 'COMPLETED':
                return {
                    badge: styles.statusBadgeCompleted,
                    text: styles.statusBadgeTextCompleted,
                };
            case 'EXPIRED':
                return {
                    badge: styles.statusBadgeWarning,
                    text: styles.statusBadgeTextWarning,
                };
            case 'CANCELLED':
                return {
                    badge: styles.statusBadgeDanger,
                    text: styles.statusBadgeTextDanger,
                };
            default:
                return {
                    badge: styles.statusBadgeInactive,
                    text: styles.statusBadgeTextInactive,
                };
        }
    };

    // ════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefreshAll} colors={['#3b82f6']} />}
            keyboardShouldPersistTaps="handled"
        >
            {offlineMeta && <OfflineBanner {...offlineMeta} />}

            {/* ── Header ─────────────────────────────────────────────── */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerTitleRow}>
                        <Feather name="package" size={24} color="#1e293b" style={{ marginRight: 8 }} />
                        <Text style={styles.headerTitle}>Package Management</Text>
                    </View>
                    <Text style={styles.headerSubtitle}>Create, manage, and assign clinical service packages to patients</Text>
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.btnSecondary} onPress={handleRefreshAll}>
                        <Feather name="refresh-cw" size={15} color="#475569" />
                        <Text style={styles.btnSecondaryText}>Refresh</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => openAssignModal()}>
                        <Feather name="user-plus" size={15} color="#ffffff" />
                        <Text style={styles.btnPrimaryText}>Assign Package</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#2563eb' }]} onPress={openCreateModal}>
                        <Feather name="plus" size={15} color="#ffffff" />
                        <Text style={styles.btnPrimaryText}>Create Package</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Stats Grid ─────────────────────────────────────────── */}
            <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#eff6ff' }]}>
                        <Feather name="package" size={20} color="#2563eb" />
                    </View>
                    <View style={styles.statContent}>
                        <Text style={styles.statNumber}>{statsLoading ? '—' : stats?.totalPackages || 0}</Text>
                        <Text style={styles.statLabel}>Total Packages</Text>
                    </View>
                </View>

                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#ecfdf5' }]}>
                        <Feather name="check" size={20} color="#059669" />
                    </View>
                    <View style={styles.statContent}>
                        <Text style={styles.statNumber}>{statsLoading ? '—' : stats?.activePackages || 0}</Text>
                        <Text style={styles.statLabel}>Active Packages</Text>
                    </View>
                </View>

                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#f0fdf4' }]}>
                        <Feather name="users" size={20} color="#16a34a" />
                    </View>
                    <View style={styles.statContent}>
                        <Text style={styles.statNumber}>{statsLoading ? '—' : stats?.activeAssignments || 0}</Text>
                        <Text style={styles.statLabel}>Active Assignments</Text>
                    </View>
                </View>

                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#fffbeb' }]}>
                        <Feather name="trending-up" size={20} color="#d97706" />
                    </View>
                    <View style={styles.statContent}>
                        <Text style={styles.statNumber}>{statsLoading ? '—' : formatCurrency(stats?.totalRevenue)}</Text>
                        <Text style={styles.statLabel}>Total Package Revenue</Text>
                    </View>
                </View>
            </View>

            {/* ── Tabs ───────────────────────────────────────────────── */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'packages' && styles.tabButtonActive]}
                    onPress={() => setActiveTab('packages')}
                >
                    <Feather name="package" size={15} color={activeTab === 'packages' ? '#2563eb' : '#64748b'} />
                    <Text style={[styles.tabText, activeTab === 'packages' && styles.tabTextActive]}>Packages</Text>
                    <View style={[styles.tabBadge, activeTab === 'packages' && styles.tabBadgeActive]}>
                        <Text style={[styles.tabBadgeText, activeTab === 'packages' && styles.tabBadgeTextActive]}>{packages.length}</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'assignments' && styles.tabButtonActive]}
                    onPress={() => setActiveTab('assignments')}
                >
                    <Feather name="users" size={15} color={activeTab === 'assignments' ? '#2563eb' : '#64748b'} />
                    <Text style={[styles.tabText, activeTab === 'assignments' && styles.tabTextActive]}>Patient Assignments</Text>
                    <View style={[styles.tabBadge, activeTab === 'assignments' && styles.tabBadgeActive]}>
                        <Text style={[styles.tabBadgeText, activeTab === 'assignments' && styles.tabBadgeTextActive]}>{assignments.length}</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* ── Toolbar ────────────────────────────────────────────── */}
            <View style={styles.toolbar}>
                <View style={styles.searchContainer}>
                    <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={activeTab === 'packages' ? 'Search packages by name, code...' : 'Search assignments by patient, MRN...'}
                        placeholderTextColor="#94a3b8"
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Feather name="x" size={16} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>

                {activeTab === 'packages' && (
                    <TouchableOpacity style={styles.filterDropdownBtn} onPress={() => setShowCategoryPicker(true)}>
                        <Text style={styles.filterDropdownText}>{categoryFilter || 'All Categories'}</Text>
                        <Feather name="chevron-down" size={14} color="#64748b" />
                    </TouchableOpacity>
                )}

                {activeTab === 'assignments' && (
                    <TouchableOpacity style={styles.filterDropdownBtn} onPress={() => setShowStatusPicker(true)}>
                        <Text style={styles.filterDropdownText}>{statusFilter || 'All Status'}</Text>
                        <Feather name="chevron-down" size={14} color="#64748b" />
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Content ────────────────────────────────────────────── */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2563eb" />
                    <Text style={styles.loadingText}>Loading data...</Text>
                </View>
            ) : activeTab === 'packages' ? (
                /* ── Packages Tab ─── */
                filteredPackages.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Feather name="package" size={48} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>No packages found</Text>
                        <Text style={styles.emptySubtitle}>Create your first clinical service package to get started</Text>
                    </View>
                ) : (
                    <View style={styles.cardsGrid}>
                        {filteredPackages.map(pkg => {
                            const effective = pkg.discountedPrice != null ? pkg.discountedPrice : pkg.totalPrice;
                            const discount = pkg.discountedPrice != null && pkg.totalPrice > 0
                                ? Math.round(((pkg.totalPrice - pkg.discountedPrice) / pkg.totalPrice) * 100) : 0;
                            return (
                                <View key={pkg._id} style={[styles.pkgCard, !pkg.isActive && styles.pkgCardInactive]}>
                                    <View style={styles.pkgCardHeader}>
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <Text style={styles.pkgCardTitle}>{pkg.name}</Text>
                                            {pkg.code ? <Text style={styles.pkgCardCode}>{pkg.code}</Text> : null}
                                        </View>
                                        <View style={[styles.statusBadge, pkg.isActive ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
                                            <Text style={[styles.statusBadgeText, pkg.isActive ? styles.statusBadgeTextActive : styles.statusBadgeTextInactive]}>
                                                {pkg.isActive ? 'Active' : 'Inactive'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.pkgCategoryRow}>
                                        <Feather name="tag" size={12} color="#64748b" style={{ marginRight: 4 }} />
                                        <Text style={styles.pkgCategoryText}>{pkg.category || 'General'}</Text>
                                    </View>

                                    {pkg.description ? (
                                        <Text style={styles.pkgDescText} numberOfLines={2}>{pkg.description}</Text>
                                    ) : null}

                                    <View style={styles.servicesBox}>
                                        <Text style={styles.servicesBoxTitle}>Included Services ({pkg.services?.length || 0})</Text>
                                        <View style={styles.servicesChipsRow}>
                                            {(pkg.services || []).slice(0, 5).map((s, idx) => (
                                                <View key={idx} style={styles.serviceChip}>
                                                    <Text style={styles.serviceChipText} numberOfLines={1}>{s.serviceName}</Text>
                                                </View>
                                            ))}
                                            {(pkg.services?.length || 0) > 5 && (
                                                <View style={[styles.serviceChip, { backgroundColor: '#e2e8f0' }]}>
                                                    <Text style={[styles.serviceChipText, { color: '#475569' }]}>+{pkg.services.length - 5} more</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    <View style={styles.pricingRow}>
                                        <Text style={styles.effectivePrice}>{formatCurrency(effective)}</Text>
                                        {discount > 0 && (
                                            <View style={styles.discountRow}>
                                                <Text style={styles.originalPrice}>{formatCurrency(pkg.totalPrice)}</Text>
                                                <View style={styles.discountBadge}>
                                                    <Text style={styles.discountBadgeText}>-{discount}%</Text>
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.metaRow}>
                                        <View style={styles.metaItem}>
                                            <Feather name="calendar" size={12} color="#64748b" style={{ marginRight: 4 }} />
                                            <Text style={styles.metaText}>{pkg.validityDays} days</Text>
                                        </View>
                                        <View style={styles.metaItem}>
                                            <Feather name="users" size={12} color="#64748b" style={{ marginRight: 4 }} />
                                            <Text style={styles.metaText}>{pkg.totalAssignments || 0} assigned</Text>
                                        </View>
                                    </View>

                                    <View style={styles.pkgCardFooter}>
                                        {pkg.isActive && (
                                            <TouchableOpacity style={styles.btnAssignQuick} onPress={() => openAssignModal(pkg)}>
                                                <Feather name="user-plus" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                                                <Text style={styles.btnAssignQuickText}>Assign</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity style={styles.btnIconAction} onPress={() => openEditModal(pkg)}>
                                            <Feather name="edit-2" size={15} color="#475569" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.btnIconAction}
                                            onPress={() => handleTogglePackage(pkg)}
                                            disabled={togglingId === pkg._id}
                                        >
                                            {togglingId === pkg._id ? (
                                                <ActivityIndicator size="small" color="#16a34a" />
                                            ) : (
                                                <Feather
                                                    name={pkg.isActive ? "toggle-right" : "toggle-left"}
                                                    size={18}
                                                    color={pkg.isActive ? "#16a34a" : "#94a3b8"}
                                                />
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.btnIconAction} onPress={() => setShowConfirmModal({ type: 'delete', item: pkg })}>
                                            <Feather name="trash-2" size={15} color="#dc2626" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )
            ) : (
                /* ── Assignments Tab ─── */
                filteredAssignments.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Feather name="users" size={48} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>No assignments found</Text>
                        <Text style={styles.emptySubtitle}>Assign a package to a patient to begin tracking usage</Text>
                    </View>
                ) : (
                    <View style={styles.cardsGrid}>
                        {filteredAssignments.map(a => {
                            const usagePct = getUsagePercent(a);
                            return (
                                <View key={a._id} style={styles.assignCard}>
                                    <View style={styles.assignCardHeader}>
                                        <View style={{ flex: 1, marginRight: 8 }}>
                                            <Text style={styles.assignPatientName}>{a.patientName || 'Unknown Patient'}</Text>
                                            <Text style={styles.assignPatientMRN}>MRN: {a.patientMRN || '—'}</Text>
                                        </View>
                                        {(() => {
                                            const statusStyle = getAssignmentStatusStyles(a.status);
                                            return (
                                                <View style={[styles.statusBadge, statusStyle.badge]}>
                                                    <Text style={[styles.statusBadgeText, statusStyle.text]}>
                                                        {a.status}
                                                    </Text>
                                                </View>
                                            );
                                        })()}
                                    </View>

                                    <View style={styles.assignPkgRow}>
                                        <Feather name="package" size={13} color="#2563eb" style={{ marginRight: 6 }} />
                                        <Text style={styles.assignPkgName}>{a.packageName}</Text>
                                        {a.packageCode ? <Text style={styles.assignPkgCode}>({a.packageCode})</Text> : null}
                                    </View>

                                    {/* Usage Bar */}
                                    <View style={styles.usageContainer}>
                                        <View style={styles.usageHeader}>
                                            <Text style={styles.usageLabel}>Usage</Text>
                                            <Text style={styles.usagePct}>{usagePct}%</Text>
                                        </View>
                                        <View style={styles.usageTrack}>
                                            <View
                                                style={[
                                                    styles.usageFill,
                                                    { width: `${Math.min(usagePct, 100)}%` },
                                                    usagePct >= 100 ? { backgroundColor: '#ef4444' } :
                                                    usagePct >= 75 ? { backgroundColor: '#f59e0b' } : { backgroundColor: '#2563eb' }
                                                ]}
                                            />
                                        </View>
                                    </View>

                                    {/* 4 Details Grid */}
                                    <View style={styles.assignDetailsGrid}>
                                        <View style={styles.assignDetailItem}>
                                            <Text style={styles.assignDetailLabel}>Package Price</Text>
                                            <Text style={styles.assignDetailValue}>{formatCurrency(a.effectivePrice)}</Text>
                                        </View>
                                        <View style={styles.assignDetailItem}>
                                            <Text style={styles.assignDetailLabel}>Extra Charges</Text>
                                            <Text style={[styles.assignDetailValue, a.totalExtraCharges > 0 && { color: '#d97706' }]}>
                                                {formatCurrency(a.totalExtraCharges)}
                                            </Text>
                                        </View>
                                        <View style={styles.assignDetailItem}>
                                            <Text style={styles.assignDetailLabel}>Assigned</Text>
                                            <Text style={styles.assignDetailValue}>{formatDate(a.assignedDate)}</Text>
                                        </View>
                                        <View style={styles.assignDetailItem}>
                                            <Text style={styles.assignDetailLabel}>Expires</Text>
                                            <Text style={styles.assignDetailValue}>{formatDate(a.expiryDate)}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.assignCardFooter}>
                                        <TouchableOpacity
                                            style={styles.btnSecondarySm}
                                            onPress={() => { setSelectedAssignment(a); setShowDetailModal(true); }}
                                        >
                                            <Feather name="eye" size={13} color="#475569" style={{ marginRight: 4 }} />
                                            <Text style={styles.btnSecondarySmText}>Details</Text>
                                        </TouchableOpacity>

                                        {a.status === 'ACTIVE' && (
                                            <TouchableOpacity
                                                style={styles.btnDangerSm}
                                                onPress={() => setShowConfirmModal({ type: 'cancelAssignment', item: a })}
                                            >
                                                <Feather name="x-circle" size={13} color="#dc2626" style={{ marginRight: 4 }} />
                                                <Text style={styles.btnDangerSmText}>Cancel</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* CREATE / EDIT PACKAGE MODAL                                */}
            {/* ════════════════════════════════════════════════════════════ */}
            <Modal visible={showCreateModal} animationType="slide" transparent={true} onRequestClose={() => setShowCreateModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={[styles.modalBox, { maxWidth: 640 }]}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHeaderTitleRow}>
                                <Feather name="package" size={20} color="#1e293b" style={{ marginRight: 8 }} />
                                <Text style={styles.modalTitle}>{editingPackage ? 'Edit Package' : 'Create Package'}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <View style={styles.formRow}>
                                <View style={[styles.formGroup, { flex: 2, marginRight: 8 }]}>
                                    <Text style={styles.formLabel}>Package Name <Text style={styles.required}>*</Text></Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={formData.name}
                                        onChangeText={(val) => setFormData(p => ({ ...p, name: val }))}
                                        placeholder="e.g., Maternity Gold"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Code</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={formData.code}
                                        onChangeText={(val) => setFormData(p => ({ ...p, code: val.toUpperCase() }))}
                                        placeholder="e.g., MAT-GOLD"
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="characters"
                                    />
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Description</Text>
                                <TextInput
                                    style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                                    value={formData.description}
                                    onChangeText={(val) => setFormData(p => ({ ...p, description: val }))}
                                    placeholder="Package description..."
                                    placeholderTextColor="#94a3b8"
                                    multiline
                                />
                            </View>

                            <View style={styles.formRow}>
                                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                                    <Text style={styles.formLabel}>Category</Text>
                                    <TouchableOpacity style={styles.formSelectTrigger} onPress={() => setShowFormCategoryPicker(true)}>
                                        <Text style={styles.formSelectText}>{formData.category}</Text>
                                        <Feather name="chevron-down" size={14} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Total Price (₹) <Text style={styles.required}>*</Text></Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={formData.totalPrice}
                                        onChangeText={(val) => setFormData(p => ({ ...p, totalPrice: val }))}
                                        placeholder="0"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                                    <Text style={styles.formLabel}>Discounted Price (₹)</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={formData.discountedPrice}
                                        onChangeText={(val) => setFormData(p => ({ ...p, discountedPrice: val }))}
                                        placeholder="Optional"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Validity (Days)</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={formData.validityDays.toString()}
                                        onChangeText={(val) => setFormData(p => ({ ...p, validityDays: val }))}
                                        placeholder="365"
                                        placeholderTextColor="#94a3b8"
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            {/* ── Services Builder ─── */}
                            <View style={styles.servicesBuilderSection}>
                                <View style={styles.servicesBuilderHeader}>
                                    <Text style={styles.servicesBuilderTitle}>Included Services <Text style={styles.required}>*</Text></Text>
                                    <TouchableOpacity style={styles.btnAddService} onPress={addService}>
                                        <Feather name="plus" size={13} color="#2563eb" style={{ marginRight: 4 }} />
                                        <Text style={styles.btnAddServiceText}>Add Service</Text>
                                    </TouchableOpacity>
                                </View>

                                {formData.services.map((svc, idx) => (
                                    <View key={idx} style={styles.serviceItemCard}>
                                        <View style={styles.serviceItemTopRow}>
                                            <View style={{ flex: 2, marginRight: 8 }}>
                                                <Text style={styles.serviceFieldLabel}>Service Name <Text style={styles.required}>*</Text></Text>
                                                <TextInput
                                                    style={styles.serviceInput}
                                                    value={svc.serviceName}
                                                    onChangeText={(val) => updateService(idx, 'serviceName', val)}
                                                    placeholder="e.g., Consultation"
                                                    placeholderTextColor="#94a3b8"
                                                />
                                            </View>
                                            <View style={{ flex: 1.5, marginRight: 8 }}>
                                                <Text style={styles.serviceFieldLabel}>Category</Text>
                                                <TouchableOpacity
                                                    style={styles.serviceSelectTrigger}
                                                    onPress={() => setActiveServiceCategoryPickerIdx(idx)}
                                                >
                                                    <Text style={styles.serviceSelectText} numberOfLines={1}>{svc.serviceCategory}</Text>
                                                    <Feather name="chevron-down" size={12} color="#64748b" />
                                                </TouchableOpacity>
                                            </View>
                                            <TouchableOpacity style={styles.btnRemoveService} onPress={() => removeService(idx)}>
                                                <Feather name="trash-2" size={16} color="#dc2626" />
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.serviceItemBottomRow}>
                                            <View style={[styles.serviceCol, { marginRight: 6 }]}>
                                                <Text style={styles.serviceFieldLabel}>Qty (-1=∞)</Text>
                                                <TextInput
                                                    style={styles.serviceInputSm}
                                                    value={svc.includedQuantity.toString()}
                                                    onChangeText={(val) => updateService(idx, 'includedQuantity', val)}
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                            <View style={[styles.serviceCol, { marginRight: 6 }]}>
                                                <Text style={styles.serviceFieldLabel}>Extra/Unit (₹)</Text>
                                                <TextInput
                                                    style={styles.serviceInputSm}
                                                    value={svc.extraChargePerUnit.toString()}
                                                    onChangeText={(val) => updateService(idx, 'extraChargePerUnit', val)}
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                            <View style={styles.serviceCol}>
                                                <Text style={styles.serviceFieldLabel}>Unit Price (₹)</Text>
                                                <TextInput
                                                    style={styles.serviceInputSm}
                                                    value={svc.unitPrice.toString()}
                                                    onChangeText={(val) => updateService(idx, 'unitPrice', val)}
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowCreateModal(false)}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            {!editingPackage && (
                                <TouchableOpacity style={[styles.btnSecondary, { borderColor: '#93c5fd', backgroundColor: '#eff6ff' }]} onPress={handleSaveDraft}>
                                    <Feather name="save" size={14} color="#1d4ed8" style={{ marginRight: 4 }} />
                                    <Text style={[styles.btnSecondaryText, { color: '#1d4ed8' }]}>Save Draft</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={[styles.btnPrimary, saving && { opacity: 0.7 }]} onPress={handleSavePackage} disabled={saving}>
                                {saving ? (
                                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                                ) : (
                                    <Feather name="check" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                                )}
                                <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : editingPackage ? 'Update Package' : 'Create Package'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* ASSIGN PACKAGE MODAL                                       */}
            {/* ════════════════════════════════════════════════════════════ */}
            <Modal visible={showAssignModal} animationType="slide" transparent={true} onRequestClose={() => setShowAssignModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={[styles.modalBox, { maxWidth: 540 }]}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHeaderTitleRow}>
                                <Feather name="user-plus" size={20} color="#1e293b" style={{ marginRight: 8 }} />
                                <Text style={styles.modalTitle}>Assign Package to Patient</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Select Package <Text style={styles.required}>*</Text></Text>
                                <TouchableOpacity style={styles.formSelectTrigger} onPress={() => setShowPackagePicker(true)}>
                                    <Text style={styles.formSelectText}>
                                        {assignFormData.packageId
                                            ? (() => {
                                                const p = packages.find(pkg => pkg._id === assignFormData.packageId);
                                                return p ? `${p.name} — ${formatCurrency(p.discountedPrice != null ? p.discountedPrice : p.totalPrice)}` : '— Choose a package —';
                                            })()
                                            : '— Choose a package —'
                                        }
                                    </Text>
                                    <Feather name="chevron-down" size={14} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Search Patient <Text style={styles.required}>*</Text></Text>
                                <View style={styles.searchContainer}>
                                    <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search by name, phone, MRN..."
                                        placeholderTextColor="#94a3b8"
                                        value={patientSearch}
                                        onChangeText={(val) => {
                                            setPatientSearch(val);
                                            setAssignFormData(p => ({ ...p, patientId: '' }));
                                        }}
                                    />
                                    {searchingPatients && <ActivityIndicator size="small" color="#2563eb" />}
                                </View>

                                {assignFormData.patientId ? (
                                    <View style={styles.patientSelectedNotice}>
                                        <Feather name="check" size={14} color="#16a34a" style={{ marginRight: 4 }} />
                                        <Text style={styles.patientSelectedText}>Patient selected</Text>
                                    </View>
                                ) : null}

                                {patientResults.length > 0 && !assignFormData.patientId && (
                                    <View style={styles.patientResultsDropdown}>
                                        {patientResults.map(pt => (
                                            <TouchableOpacity
                                                key={pt._id}
                                                style={styles.patientResultItem}
                                                onPress={() => {
                                                    setAssignFormData(p => ({ ...p, patientId: pt._id }));
                                                    setPatientSearch(pt.name || '');
                                                    setPatientResults([]);
                                                }}
                                            >
                                                <Text style={styles.patientResultName}>{pt.name}</Text>
                                                <Text style={styles.patientResultMeta}>
                                                    {pt.mrn || pt.patientId || 'No MRN'} • {pt.phone || 'No Phone'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Notes</Text>
                                <TextInput
                                    style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                                    value={assignFormData.notes}
                                    onChangeText={(val) => setAssignFormData(p => ({ ...p, notes: val }))}
                                    placeholder="Optional notes..."
                                    placeholderTextColor="#94a3b8"
                                    multiline
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowAssignModal(false)}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.btnPrimary,
                                    (saving || !assignFormData.packageId || !assignFormData.patientId) && { opacity: 0.6 }
                                ]}
                                onPress={handleAssignPackage}
                                disabled={saving || !assignFormData.packageId || !assignFormData.patientId}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                                ) : (
                                    <Feather name="user-check" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                                )}
                                <Text style={styles.btnPrimaryText}>{saving ? 'Assigning...' : 'Assign Package'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* ASSIGNMENT DETAIL MODAL                                     */}
            {/* ════════════════════════════════════════════════════════════ */}
            <Modal visible={showDetailModal && !!selectedAssignment} animationType="slide" transparent={true} onRequestClose={() => setShowDetailModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalBox, { maxWidth: 600 }]}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHeaderTitleRow}>
                                <Feather name="file-text" size={20} color="#1e293b" style={{ marginRight: 8 }} />
                                <Text style={styles.modalTitle}>Assignment Details</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        {selectedAssignment && (
                            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                <View style={styles.detailHeaderRow}>
                                    <View>
                                        <Text style={styles.detailPatientName}>{selectedAssignment.patientName}</Text>
                                        <Text style={styles.detailPatientMRN}>MRN: {selectedAssignment.patientMRN || '—'}</Text>
                                    </View>
                                    {(() => {
                                        const detailStatusStyle = getAssignmentStatusStyles(selectedAssignment.status);
                                        return (
                                            <View style={[styles.statusBadge, detailStatusStyle.badge]}>
                                                <Text style={[styles.statusBadgeText, detailStatusStyle.text]}>
                                                    {selectedAssignment.status}
                                                </Text>
                                            </View>
                                        );
                                    })()}
                                </View>

                                <View style={styles.detailBox}>
                                    <View style={styles.detailBoxTitleRow}>
                                        <Feather name="package" size={15} color="#2563eb" style={{ marginRight: 6 }} />
                                        <Text style={styles.detailBoxTitle}>{selectedAssignment.packageName}</Text>
                                    </View>
                                    <View style={styles.detailGrid}>
                                        <View style={styles.detailGridItem}>
                                            <Text style={styles.detailGridLabel}>Effective Price</Text>
                                            <Text style={styles.detailGridValue}>{formatCurrency(selectedAssignment.effectivePrice)}</Text>
                                        </View>
                                        <View style={styles.detailGridItem}>
                                            <Text style={styles.detailGridLabel}>Extra Charges</Text>
                                            <Text style={styles.detailGridValue}>{formatCurrency(selectedAssignment.totalExtraCharges)}</Text>
                                        </View>
                                        <View style={styles.detailGridItem}>
                                            <Text style={styles.detailGridLabel}>Assigned</Text>
                                            <Text style={styles.detailGridValue}>{formatDate(selectedAssignment.assignedDate)}</Text>
                                        </View>
                                        <View style={styles.detailGridItem}>
                                            <Text style={styles.detailGridLabel}>Expires</Text>
                                            <Text style={styles.detailGridValue}>{formatDate(selectedAssignment.expiryDate)}</Text>
                                        </View>
                                        <View style={styles.detailGridItem}>
                                            <Text style={styles.detailGridLabel}>Assigned By</Text>
                                            <Text style={styles.detailGridValue}>{selectedAssignment.assignedByName || '—'}</Text>
                                        </View>
                                        <View style={styles.detailGridItem}>
                                            <Text style={styles.detailGridLabel}>Validity</Text>
                                            <Text style={styles.detailGridValue}>{selectedAssignment.validityDays} days</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.detailServicesSection}>
                                    <Text style={styles.detailSectionTitle}>Service Usage</Text>
                                    {(selectedAssignment.snapshotServices || []).map((s, idx) => (
                                        <View key={idx} style={styles.detailServiceItem}>
                                            <View style={{ flex: 1, marginRight: 8 }}>
                                                <Text style={styles.detailServiceName}>{s.serviceName}</Text>
                                                <Text style={styles.detailServiceMeta}>
                                                    {s.serviceCategory} • Extra: {formatCurrency(s.extraChargePerUnit)}/unit
                                                </Text>
                                            </View>
                                            <View style={styles.detailServiceUsageBadge}>
                                                <Text style={styles.detailServiceUsageText}>
                                                    {s.usedQuantity} / {s.includedQuantity === -1 ? '∞' : s.includedQuantity}
                                                </Text>
                                                <Text style={styles.detailServiceUsageSub}>used</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>

                                {(selectedAssignment.usageLog || []).length > 0 && (
                                    <View style={{ marginTop: 16 }}>
                                        <Text style={styles.detailSectionTitle}>Usage Log ({selectedAssignment.usageLog.length})</Text>
                                        {selectedAssignment.usageLog.map((log, idx) => (
                                            <View key={idx} style={styles.usageLogCard}>
                                                <View style={styles.usageLogRow}>
                                                    <Text style={styles.usageLogName}>{log.serviceName} × {log.quantity}</Text>
                                                    {log.isExtra && (
                                                        <Text style={styles.usageLogExtra}>Extra: {formatCurrency(log.extraAmount)}</Text>
                                                    )}
                                                </View>
                                                <Text style={styles.usageLogMeta}>
                                                    {formatDate(log.loggedAt)} {log.loggedByName ? `• by ${log.loggedByName}` : ''}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </ScrollView>
                        )}

                        <View style={[styles.modalFooter, { justifyContent: 'space-between' }]}>
                            {selectedAssignment.status === 'ACTIVE' ? (
                                <TouchableOpacity
                                    style={styles.btnDangerSm}
                                    onPress={() => {
                                        setShowDetailModal(false);
                                        setShowConfirmModal({ type: 'cancelAssignment', item: selectedAssignment });
                                    }}
                                >
                                    <Feather name="x-circle" size={13} color="#dc2626" style={{ marginRight: 4 }} />
                                    <Text style={styles.btnDangerSmText}>Cancel Assignment</Text>
                                </TouchableOpacity>
                            ) : <View />}
                            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowDetailModal(false)}>
                                <Text style={styles.btnSecondaryText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* CONFIRMATION DIALOG MODAL                                  */}
            {/* ════════════════════════════════════════════════════════════ */}
            <Modal visible={!!showConfirmModal} animationType="fade" transparent={true} onRequestClose={() => setShowConfirmModal(null)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalBox, { maxWidth: 420 }]}>
                        <View style={styles.confirmBody}>
                            <View style={[
                                styles.confirmIconContainer,
                                { backgroundColor: showConfirmModal?.type === 'delete' ? '#fef2f2' : '#fffbeb' }
                            ]}>
                                <Feather
                                    name="alert-circle"
                                    size={32}
                                    color={showConfirmModal?.type === 'delete' ? '#ef4444' : '#f59e0b'}
                                />
                            </View>
                            <Text style={styles.confirmTitle}>
                                {showConfirmModal?.type === 'delete' ? 'Delete Package?' : 'Cancel Assignment?'}
                            </Text>
                            <Text style={styles.confirmSubtitle}>
                                {showConfirmModal?.type === 'delete'
                                    ? `Are you sure you want to delete "${showConfirmModal?.item?.name}"? This cannot be undone.`
                                    : `Cancel the package assignment for "${showConfirmModal?.item?.patientName}"?`
                                }
                            </Text>
                        </View>

                        <View style={[styles.modalFooter, { justifyContent: 'center' }]}>
                            <TouchableOpacity
                                style={styles.btnSecondary}
                                onPress={() => setShowConfirmModal(null)}
                                disabled={!!(deletingId || cancellingId)}
                            >
                                <Text style={styles.btnSecondaryText}>No, Go Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btnDanger, (deletingId || cancellingId) && { opacity: 0.6 }]}
                                disabled={!!(deletingId || cancellingId)}
                                onPress={() => {
                                    if (showConfirmModal?.type === 'delete') handleDeletePackage(showConfirmModal.item);
                                    else handleCancelAssignment(showConfirmModal.item);
                                }}
                            >
                                {(deletingId || cancellingId) ? (
                                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                                ) : null}
                                <Text style={styles.btnDangerText}>
                                    {showConfirmModal?.type === 'delete'
                                        ? (deletingId ? 'Deleting...' : 'Yes, Delete')
                                        : (cancellingId ? 'Cancelling...' : 'Yes, Cancel')
                                    }
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Category Filter Picker Modal ── */}
            <Modal visible={showCategoryPicker} transparent={true} animationType="fade" onRequestClose={() => setShowCategoryPicker(false)}>
                <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowCategoryPicker(false)}>
                    <View style={styles.pickerBox}>
                        <Text style={styles.pickerHeaderTitle}>Filter by Category</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            <TouchableOpacity
                                style={[styles.pickerItem, !categoryFilter && styles.pickerItemActive]}
                                onPress={() => { setCategoryFilter(''); setShowCategoryPicker(false); }}
                            >
                                <Text style={[styles.pickerItemText, !categoryFilter && styles.pickerItemTextActive]}>All Categories</Text>
                            </TouchableOpacity>
                            {CATEGORIES.map(c => (
                                <TouchableOpacity
                                    key={c}
                                    style={[styles.pickerItem, categoryFilter === c && styles.pickerItemActive]}
                                    onPress={() => { setCategoryFilter(c); setShowCategoryPicker(false); }}
                                >
                                    <Text style={[styles.pickerItemText, categoryFilter === c && styles.pickerItemTextActive]}>{c}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── Status Filter Picker Modal ── */}
            <Modal visible={showStatusPicker} transparent={true} animationType="fade" onRequestClose={() => setShowStatusPicker(false)}>
                <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowStatusPicker(false)}>
                    <View style={styles.pickerBox}>
                        <Text style={styles.pickerHeaderTitle}>Filter by Status</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {['', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED'].map(s => (
                                <TouchableOpacity
                                    key={s || 'all'}
                                    style={[styles.pickerItem, statusFilter === s && styles.pickerItemActive]}
                                    onPress={() => { setStatusFilter(s); setShowStatusPicker(false); }}
                                >
                                    <Text style={[styles.pickerItemText, statusFilter === s && styles.pickerItemTextActive]}>
                                        {s ? s.charAt(0) + s.slice(1).toLowerCase() : 'All Status'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── Form Category Picker Modal ── */}
            <Modal visible={showFormCategoryPicker} transparent={true} animationType="fade" onRequestClose={() => setShowFormCategoryPicker(false)}>
                <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowFormCategoryPicker(false)}>
                    <View style={styles.pickerBox}>
                        <Text style={styles.pickerHeaderTitle}>Select Package Category</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {CATEGORIES.map(c => (
                                <TouchableOpacity
                                    key={c}
                                    style={[styles.pickerItem, formData.category === c && styles.pickerItemActive]}
                                    onPress={() => { setFormData(p => ({ ...p, category: c })); setShowFormCategoryPicker(false); }}
                                >
                                    <Text style={[styles.pickerItemText, formData.category === c && styles.pickerItemTextActive]}>{c}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── Service Category Picker Modal ── */}
            <Modal visible={activeServiceCategoryPickerIdx !== null} transparent={true} animationType="fade" onRequestClose={() => setActiveServiceCategoryPickerIdx(null)}>
                <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setActiveServiceCategoryPickerIdx(null)}>
                    <View style={styles.pickerBox}>
                        <Text style={styles.pickerHeaderTitle}>Select Service Category</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {SERVICE_CATEGORIES.map(c => (
                                <TouchableOpacity
                                    key={c}
                                    style={styles.pickerItem}
                                    onPress={() => {
                                        if (activeServiceCategoryPickerIdx !== null) {
                                            updateService(activeServiceCategoryPickerIdx, 'serviceCategory', c);
                                            setActiveServiceCategoryPickerIdx(null);
                                        }
                                    }}
                                >
                                    <Text style={styles.pickerItemText}>{c}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── Package Picker Modal (for Assignment) ── */}
            <Modal visible={showPackagePicker} transparent={true} animationType="fade" onRequestClose={() => setShowPackagePicker(false)}>
                <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowPackagePicker(false)}>
                    <View style={styles.pickerBox}>
                        <Text style={styles.pickerHeaderTitle}>Choose Active Package</Text>
                        <ScrollView style={{ maxHeight: 350 }}>
                            {packages.filter(p => p.isActive).map(p => (
                                <TouchableOpacity
                                    key={p._id}
                                    style={[styles.pickerItem, assignFormData.packageId === p._id && styles.pickerItemActive]}
                                    onPress={() => {
                                        setAssignFormData(f => ({ ...f, packageId: p._id }));
                                        setShowPackagePicker(false);
                                    }}
                                >
                                    <Text style={[styles.pickerItemText, assignFormData.packageId === p._id && styles.pickerItemTextActive]}>
                                        {p.name} — {formatCurrency(p.discountedPrice != null ? p.discountedPrice : p.totalPrice)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    headerLeft: {
        flex: 1,
        minWidth: 260,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#0f172a',
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    btnSecondary: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
    },
    btnSecondaryText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    btnPrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#16a34a',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
    },
    btnPrimaryText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#ffffff',
    },
    btnDanger: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dc2626',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
    },
    btnDangerText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#ffffff',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        minWidth: 150,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 3,
        elevation: 1,
    },
    statIcon: {
        width: 42,
        height: 42,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    statContent: {
        flex: 1,
    },
    statNumber: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    statLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    tabsContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        marginBottom: 16,
        gap: 12,
    },
    tabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
        gap: 8,
    },
    tabButtonActive: {
        borderBottomColor: '#2563eb',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    tabTextActive: {
        color: '#2563eb',
    },
    tabBadge: {
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    tabBadgeActive: {
        backgroundColor: '#eff6ff',
    },
    tabBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    tabBadgeTextActive: {
        color: '#2563eb',
    },
    toolbar: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    searchContainer: {
        flex: 1,
        minWidth: 220,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 40,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
        paddingVertical: 0,
    },
    filterDropdownBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 40,
        gap: 6,
    },
    filterDropdownText: {
        fontSize: 13,
        color: '#334155',
        fontWeight: '500',
    },
    loadingContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 10,
    },
    emptyContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        paddingVertical: 60,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 14,
    },
    emptySubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 4,
        textAlign: 'center',
    },
    cardsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    pkgCard: {
        flex: 1,
        minWidth: 280,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2,
    },
    pkgCardInactive: {
        opacity: 0.7,
        backgroundColor: '#f8fafc',
    },
    pkgCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    pkgCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    pkgCardCode: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    statusBadgeActive: {
        backgroundColor: '#f0fdfa',
        borderWidth: 1,
        borderColor: '#99f6e4',
    },
    statusBadgeTextActive: {
        color: '#0d9488',
        fontSize: 11,
        fontWeight: '600',
    },
    statusBadgeCompleted: {
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    statusBadgeTextCompleted: {
        color: '#15803d',
        fontSize: 11,
        fontWeight: '600',
    },
    statusBadgeWarning: {
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fde68a',
    },
    statusBadgeTextWarning: {
        color: '#b45309',
        fontSize: 11,
        fontWeight: '600',
    },
    statusBadgeDanger: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    statusBadgeTextDanger: {
        color: '#b91c1c',
        fontSize: 11,
        fontWeight: '600',
    },
    statusBadgeInactive: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    statusBadgeTextInactive: {
        color: '#64748b',
        fontSize: 11,
        fontWeight: '600',
    },
    statusBadgeInfo: {
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    statusBadgeTextInfo: {
        color: '#2563eb',
        fontSize: 11,
        fontWeight: '600',
    },
    pkgCategoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    pkgCategoryText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    pkgDescText: {
        fontSize: 12,
        color: '#475569',
        marginBottom: 10,
        lineHeight: 17,
    },
    servicesBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    servicesBoxTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    servicesChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    serviceChip: {
        backgroundColor: '#e0f2fe',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    serviceChipText: {
        fontSize: 11,
        color: '#0369a1',
        fontWeight: '500',
    },
    pricingRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 10,
    },
    effectivePrice: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    discountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    originalPrice: {
        fontSize: 13,
        color: '#94a3b8',
        textDecorationLine: 'line-through',
    },
    discountBadge: {
        backgroundColor: '#fef2f2',
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    discountBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#dc2626',
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        marginBottom: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        fontSize: 12,
        color: '#64748b',
    },
    pkgCardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        paddingTop: 4,
    },
    btnAssignQuick: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#16a34a',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginRight: 'auto',
    },
    btnAssignQuickText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#ffffff',
    },
    btnIconAction: {
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Assignment Cards
    assignCard: {
        flex: 1,
        minWidth: 280,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 2,
    },
    assignCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    assignPatientName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    assignPatientMRN: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    assignPkgRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    assignPkgName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#2563eb',
    },
    assignPkgCode: {
        fontSize: 12,
        color: '#64748b',
        marginLeft: 4,
    },
    usageContainer: {
        marginBottom: 14,
    },
    usageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    usageLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748b',
    },
    usagePct: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0f172a',
    },
    usageTrack: {
        height: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    usageFill: {
        height: '100%',
        borderRadius: 3,
    },
    assignDetailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        marginBottom: 12,
    },
    assignDetailItem: {
        width: '45%',
    },
    assignDetailLabel: {
        fontSize: 11,
        color: '#94a3b8',
    },
    assignDetailValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
        marginTop: 2,
    },
    assignCardFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 8,
    },
    btnSecondarySm: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    btnSecondarySmText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
    },
    btnDangerSm: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    btnDangerSmText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#dc2626',
    },
    // Modals
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalBox: {
        width: '100%',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        maxHeight: '90%',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    modalHeaderTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0f172a',
    },
    modalBody: {
        padding: 16,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        gap: 10,
        backgroundColor: '#f8fafc',
    },
    formRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    formGroup: {
        marginBottom: 12,
    },
    formLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 6,
    },
    required: {
        color: '#dc2626',
    },
    formInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#ffffff',
    },
    formSelectTrigger: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#ffffff',
    },
    formSelectText: {
        fontSize: 13,
        color: '#0f172a',
    },
    servicesBuilderSection: {
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 12,
    },
    servicesBuilderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    servicesBuilderTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    btnAddService: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    btnAddServiceText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#2563eb',
    },
    serviceItemCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    serviceItemTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 8,
    },
    serviceFieldLabel: {
        fontSize: 11,
        fontWeight: '500',
        color: '#64748b',
        marginBottom: 4,
    },
    serviceInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
        fontSize: 12,
        color: '#0f172a',
        backgroundColor: '#ffffff',
    },
    serviceSelectTrigger: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 7,
        backgroundColor: '#ffffff',
    },
    serviceSelectText: {
        fontSize: 12,
        color: '#0f172a',
    },
    btnRemoveService: {
        padding: 7,
        justifyContent: 'center',
        alignItems: 'center',
    },
    serviceItemBottomRow: {
        flexDirection: 'row',
    },
    serviceCol: {
        flex: 1,
    },
    serviceInputSm: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        fontSize: 12,
        color: '#0f172a',
        backgroundColor: '#ffffff',
    },
    patientSelectedNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    patientSelectedText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#16a34a',
    },
    patientResultsDropdown: {
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        backgroundColor: '#ffffff',
        maxHeight: 180,
    },
    patientResultItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    patientResultName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0f172a',
    },
    patientResultMeta: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    // Detail Modal Styles
    detailHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    detailPatientName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0f172a',
    },
    detailPatientMRN: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    detailBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 16,
    },
    detailBoxTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    detailBoxTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#2563eb',
    },
    detailGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    detailGridItem: {
        width: '45%',
    },
    detailGridLabel: {
        fontSize: 11,
        color: '#94a3b8',
    },
    detailGridValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
        marginTop: 2,
    },
    detailServicesSection: {
        marginBottom: 14,
    },
    detailSectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    detailServiceItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 6,
    },
    detailServiceName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0f172a',
    },
    detailServiceMeta: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    detailServiceUsageBadge: {
        alignItems: 'flex-end',
    },
    detailServiceUsageText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#2563eb',
    },
    detailServiceUsageSub: {
        fontSize: 10,
        color: '#94a3b8',
    },
    usageLogCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 6,
        padding: 8,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    usageLogRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    usageLogName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1e293b',
    },
    usageLogExtra: {
        fontSize: 11,
        fontWeight: '600',
        color: '#d97706',
    },
    usageLogMeta: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    // Confirm Dialog Styles
    confirmBody: {
        padding: 24,
        alignItems: 'center',
    },
    confirmIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    confirmTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 8,
    },
    confirmSubtitle: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 18,
    },
    // Generic Picker Modal
    pickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    pickerBox: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 6,
    },
    pickerHeaderTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    pickerItem: {
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    pickerItemActive: {
        backgroundColor: '#eff6ff',
    },
    pickerItemText: {
        fontSize: 14,
        color: '#334155',
    },
    pickerItemTextActive: {
        color: '#2563eb',
        fontWeight: '600',
    },
});

export default PackageManagement;
