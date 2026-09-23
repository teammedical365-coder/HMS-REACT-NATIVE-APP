import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    StyleSheet, ActivityIndicator, Alert, Modal, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { vialAPI, patientAPI } from '../../utils/api';
import DatePickerInput from '../../components/common/DatePickerInput';
import DropdownSelect from '../../components/common/DropdownSelect';

const VIAL_TYPES = [
    'Biological Sample',
    'Specimen',
    'Laboratory Sample',
    'Medication',
    'Reagent',
    'Cryogenic Sample',
    'Other'
];

const STATUS_OPTIONS = ['All', 'Received', 'Stored', 'Moved', 'Retrieved', 'Returned', 'Discarded'];

const VialManagement = () => {
    // Data State (Direct 1:1 with Web VialManagement.jsx)
    const [vials, setVials] = useState([]);
    const [stats, setStats] = useState({
        totalVials: 0,
        currentlyStored: 0,
        retrievedCount: 0,
        discardedCount: 0
    });
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Pagination & Filter State
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalRecords: 0,
        pageSize: 10
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('All');
    const [selectedType, setSelectedType] = useState('All');
    const [storageUnitFilter, setStorageUnitFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Modals State
    const [showStoreModal, setShowStoreModal] = useState(false);
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [showRetrieveModal, setShowRetrieveModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [showDiscardModal, setShowDiscardModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    const [activeVial, setActiveVial] = useState(null);
    const [actionSubmitting, setActionSubmitting] = useState(false);

    // Patient Search in Store Modal
    const [patientQuery, setPatientQuery] = useState('');
    const [patientResults, setPatientResults] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [searchingPatients, setSearchingPatients] = useState(false);
    const searchDebounceRef = useRef(null);

    // Store Vial Form State
    const [storeForm, setStoreForm] = useState({
        vialId: '',
        vialType: '',
        description: '',
        receivedAt: new Date().toISOString().slice(0, 16),
        room: '',
        storageUnit: '',
        rack: '',
        box: '',
        position: '',
        notes: '',
        initialStatus: 'Stored'
    });

    // Move Form State
    const [moveForm, setMoveForm] = useState({
        room: '',
        storageUnit: '',
        rack: '',
        box: '',
        position: '',
        reason: '',
        notes: ''
    });

    // Retrieve Form State
    const [retrieveForm, setRetrieveForm] = useState({
        reason: '',
        retrievalDate: new Date().toISOString().slice(0, 16),
        notes: ''
    });

    // Return Form State
    const [returnForm, setReturnForm] = useState({
        room: '',
        storageUnit: '',
        rack: '',
        box: '',
        position: '',
        returnDate: new Date().toISOString().slice(0, 16),
        notes: ''
    });

    // Discard Form State
    const [discardForm, setDiscardForm] = useState({
        discardReason: '',
        discardDate: new Date().toISOString().slice(0, 16),
        notes: ''
    });

    const showToast = (msg, isError = false) => {
        if (isError) {
            setError(msg);
            setTimeout(() => setError(null), 4500);
        } else {
            setSuccessMessage(msg);
            setTimeout(() => setSuccessMessage(null), 4500);
        }
    };

    // Fetch Stats (Direct Web API: vialAPI.getStats)
    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const res = await vialAPI.getStats();
            if (res && res.success && res.stats) {
                setStats(res.stats);
            }
        } catch (err) {
            console.error('Failed to load vial stats:', err);
        } finally {
            setStatsLoading(false);
        }
    };

    // Fetch Vials (Direct Web API: vialAPI.getAll)
    const fetchVials = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                page,
                limit: 10
            };
            if (searchTerm.trim()) params.search = searchTerm.trim();
            if (selectedStatus !== 'All') params.status = selectedStatus;
            if (selectedType !== 'All') params.vialType = selectedType;
            if (storageUnitFilter.trim()) params.storageUnit = storageUnitFilter.trim();
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const res = await vialAPI.getAll(params);
            if (res && res.success) {
                setVials(res.vials || []);
                if (res.pagination) {
                    setPagination(res.pagination);
                }
            } else {
                setError(res?.message || 'Unable to load vial information.');
                setVials([]);
            }
        } catch (err) {
            console.error('Error fetching vials:', err);
            setError(err?.response?.data?.message || 'Unable to load vial information. Please try again.');
            setVials([]);
        } finally {
            setLoading(false);
        }
    }, [page, searchTerm, selectedStatus, selectedType, storageUnitFilter, startDate, endDate]);

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        fetchVials();
    }, [fetchVials]);

    // Live Patient Search (Direct Web logic)
    const handlePatientSearchChange = (query) => {
        setPatientQuery(query);
        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }

        const trimmed = query.trim();
        if (!trimmed || trimmed.length < 1) {
            setPatientResults([]);
            setSearchingPatients(false);
            return;
        }

        searchDebounceRef.current = setTimeout(async () => {
            setSearchingPatients(true);
            try {
                const res = await patientAPI.search(trimmed);
                if (res && res.success && Array.isArray(res.data)) {
                    setPatientResults(res.data);
                } else {
                    setPatientResults([]);
                }
            } catch (err) {
                console.error('Patient search error:', err);
                setPatientResults([]);
            } finally {
                setSearchingPatients(false);
            }
        }, 250);
    };

    const handleSelectPatient = (patient) => {
        setSelectedPatient(patient);
        setPatientResults([]);
        setPatientQuery('');
    };

    // Reset Filters
    const handleResetFilters = () => {
        setSearchTerm('');
        setSelectedStatus('All');
        setSelectedType('All');
        setStorageUnitFilter('');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    // Open Store Modal
    const handleOpenStoreModal = () => {
        setSelectedPatient(null);
        setPatientQuery('');
        setPatientResults([]);
        setStoreForm({
            vialId: '',
            vialType: '',
            description: '',
            receivedAt: new Date().toISOString().slice(0, 16),
            room: '',
            storageUnit: '',
            rack: '',
            box: '',
            position: '',
            notes: '',
            initialStatus: 'Stored'
        });
        setShowStoreModal(true);
    };

    // Submit Store Vial
    const handleStoreSubmit = async () => {
        if (!selectedPatient) {
            Alert.alert('Validation', 'Please search and select a patient first');
            return;
        }
        if (!storeForm.vialType) {
            Alert.alert('Validation', 'Please select a Vial Type');
            return;
        }
        if (!storeForm.storageUnit || !storeForm.storageUnit.trim()) {
            Alert.alert('Validation', 'Storage Unit / Freezer is mandatory');
            return;
        }

        setActionSubmitting(true);
        try {
            const payload = {
                patientId: selectedPatient._id,
                vialId: storeForm.vialId.trim() || undefined,
                vialType: storeForm.vialType,
                description: storeForm.description.trim(),
                receivedAt: storeForm.receivedAt,
                initialStatus: storeForm.initialStatus,
                notes: storeForm.notes.trim(),
                currentLocation: {
                    room: storeForm.room.trim(),
                    storageUnit: storeForm.storageUnit.trim(),
                    rack: storeForm.rack.trim(),
                    box: storeForm.box.trim(),
                    position: storeForm.position.trim()
                }
            };

            const res = await vialAPI.create(payload);
            if (res && res.success) {
                showToast(res.message || 'Vial stored successfully');
                setShowStoreModal(false);
                fetchVials();
                fetchStats();
            } else {
                Alert.alert('Error', res?.message || 'Failed to register vial');
            }
        } catch (err) {
            console.error('Store error:', err);
            Alert.alert('Error', err?.response?.data?.message || err?.message || 'Error registering vial');
        } finally {
            setActionSubmitting(false);
        }
    };

    // Open Move Modal
    const handleOpenMove = (vial) => {
        setActiveVial(vial);
        const loc = vial.currentLocation || {};
        setMoveForm({
            room: loc.room || '',
            storageUnit: loc.storageUnit || '',
            rack: loc.rack || '',
            box: loc.box || '',
            position: loc.position || '',
            reason: '',
            notes: ''
        });
        setShowMoveModal(true);
    };

    const handleMoveSubmit = async () => {
        if (!moveForm.storageUnit.trim()) {
            Alert.alert('Validation', 'Destination Storage Unit is required');
            return;
        }

        setActionSubmitting(true);
        try {
            const res = await vialAPI.move(activeVial._id, moveForm);
            if (res && res.success) {
                showToast(res.message || 'Vial moved successfully');
                setShowMoveModal(false);
                fetchVials();
                fetchStats();
            } else {
                Alert.alert('Error', res?.message || 'Failed to move vial');
            }
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Error moving vial');
        } finally {
            setActionSubmitting(false);
        }
    };

    // Open Retrieve Modal
    const handleOpenRetrieve = (vial) => {
        setActiveVial(vial);
        setRetrieveForm({
            reason: '',
            retrievalDate: new Date().toISOString().slice(0, 16),
            notes: ''
        });
        setShowRetrieveModal(true);
    };

    const handleRetrieveSubmit = async () => {
        if (!retrieveForm.reason.trim()) {
            Alert.alert('Validation', 'Reason for retrieval is required');
            return;
        }

        setActionSubmitting(true);
        try {
            const res = await vialAPI.retrieve(activeVial._id, retrieveForm);
            if (res && res.success) {
                showToast(res.message || 'Vial retrieved successfully');
                setShowRetrieveModal(false);
                fetchVials();
                fetchStats();
            } else {
                Alert.alert('Error', res?.message || 'Failed to retrieve vial');
            }
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Error retrieving vial');
        } finally {
            setActionSubmitting(false);
        }
    };

    // Open Return Modal
    const handleOpenReturn = (vial) => {
        setActiveVial(vial);
        let lastLoc = {};
        if (Array.isArray(vial.auditHistory)) {
            const lastStoredOrMoved = [...vial.auditHistory].reverse().find(a => a.previousLocation && a.previousLocation.storageUnit);
            if (lastStoredOrMoved) {
                lastLoc = lastStoredOrMoved.previousLocation;
            }
        }
        setReturnForm({
            room: lastLoc.room || '',
            storageUnit: lastLoc.storageUnit || '',
            rack: lastLoc.rack || '',
            box: lastLoc.box || '',
            position: lastLoc.position || '',
            returnDate: new Date().toISOString().slice(0, 16),
            notes: ''
        });
        setShowReturnModal(true);
    };

    const handleReturnSubmit = async () => {
        if (!returnForm.storageUnit.trim()) {
            Alert.alert('Validation', 'Storage Unit is required to return vial to storage');
            return;
        }

        setActionSubmitting(true);
        try {
            const res = await vialAPI.returnToStorage(activeVial._id, returnForm);
            if (res && res.success) {
                showToast(res.message || 'Vial returned to storage');
                setShowReturnModal(false);
                fetchVials();
                fetchStats();
            } else {
                Alert.alert('Error', res?.message || 'Failed to return vial');
            }
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Error returning vial');
        } finally {
            setActionSubmitting(false);
        }
    };

    // Open Discard Modal
    const handleOpenDiscard = (vial) => {
        setActiveVial(vial);
        setDiscardForm({
            discardReason: '',
            discardDate: new Date().toISOString().slice(0, 16),
            notes: ''
        });
        setShowDiscardModal(true);
    };

    const handleDiscardSubmit = async () => {
        if (!discardForm.discardReason.trim() || discardForm.discardReason.trim().length < 3) {
            Alert.alert('Validation', 'Please enter a valid discard reason (at least 3 characters)');
            return;
        }

        setActionSubmitting(true);
        try {
            const res = await vialAPI.discard(activeVial._id, discardForm);
            if (res && res.success) {
                showToast(res.message || 'Vial marked as discarded');
                setShowDiscardModal(false);
                fetchVials();
                fetchStats();
            } else {
                Alert.alert('Error', res?.message || 'Failed to discard vial');
            }
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Error discarding vial');
        } finally {
            setActionSubmitting(false);
        }
    };

    // Open View Details Modal
    const handleOpenDetails = async (vial) => {
        try {
            const res = await vialAPI.getById(vial._id);
            if (res && res.success && res.vial) {
                setActiveVial(res.vial);
                setShowDetailsModal(true);
            } else {
                setActiveVial(vial);
                setShowDetailsModal(true);
            }
        } catch (err) {
            console.error('Error fetching vial details:', err);
            setActiveVial(vial);
            setShowDetailsModal(true);
        }
    };

    // Format location string (Exact Web formatLocation)
    const formatLocation = (loc) => {
        if (!loc || !loc.storageUnit) return null;
        const parts = [];
        if (loc.room) parts.push(loc.room);
        if (loc.storageUnit) parts.push(loc.storageUnit);
        if (loc.rack) parts.push(`Rack ${loc.rack}`);
        if (loc.box) parts.push(`Box ${loc.box}`);
        if (loc.position) parts.push(`Pos ${loc.position}`);
        return parts.join(' → ');
    };

    // Format date string (Exact Web formatDate)
    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Stored': return { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' };
            case 'Received': return { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' };
            case 'Moved': return { bg: '#ede9fe', text: '#6b21a8', border: '#ddd6fe' };
            case 'Retrieved': return { bg: '#fef3c7', text: '#92400e', border: '#fde68a' };
            case 'Returned': return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
            case 'Discarded': return { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' };
            default: return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
        }
    };

    const totalRecords = pagination.totalRecords !== undefined ? pagination.totalRecords : vials.length;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            {/* Page Header (Exact Web .vm-header) */}
            <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                    <Text style={styles.title}>🧪 Vial Management Workspace</Text>
                    <Text style={styles.subtitle}>Track, store, move, retrieve, and audit laboratory and biological patient vials</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        nativeID="btn-reset-filters-header"
                        style={styles.btnSecondary}
                        onPress={handleResetFilters}
                        activeOpacity={0.7}
                    >
                        <Feather name="refresh-cw" size={14} color="#475569" style={{ marginRight: 6 }} />
                        <Text style={styles.btnSecondaryText}>Reset Filters</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        nativeID="btn-store-vial-header"
                        style={styles.btnPrimary}
                        onPress={handleOpenStoreModal}
                        activeOpacity={0.85}
                    >
                        <Feather name="plus" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.btnPrimaryText}>Store New Vial</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Success & Error Banner Alerts (Exact Web .vm-alert-banner) */}
            {successMessage && (
                <View style={[styles.alertBanner, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                    <Feather name="check-circle" size={16} color="#16a34a" />
                    <Text style={{ color: '#166534', fontWeight: '600', fontSize: 13, flex: 1 }}>{successMessage}</Text>
                </View>
            )}
            {error && (
                <View style={[styles.alertBanner, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                    <Feather name="alert-triangle" size={16} color="#ef4444" />
                    <Text style={{ color: '#991b1b', fontWeight: '600', fontSize: 13, flex: 1 }}>{error}</Text>
                    <TouchableOpacity style={styles.tryAgainBtn} onPress={fetchVials}>
                        <Text style={styles.tryAgainText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* 4 Statistics KPI Cards (Exact Web .vm-stats-grid) */}
            <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                    <View style={[styles.statIconBox, { backgroundColor: '#e0f2fe' }]}>
                        <Feather name="database" size={22} color="#0284c7" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statVal}>{statsLoading ? '...' : (stats.totalVials ?? 0)}</Text>
                        <Text style={styles.statLabel}>Total Registered Vials</Text>
                        <Text style={styles.statSub}>All system records</Text>
                    </View>
                </View>

                <View style={styles.statCard}>
                    <View style={[styles.statIconBox, { backgroundColor: '#dcfce7' }]}>
                        <Feather name="package" size={22} color="#16a34a" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statVal}>{statsLoading ? '...' : (stats.currentlyStored ?? 0)}</Text>
                        <Text style={styles.statLabel}>Currently Stored</Text>
                        <Text style={styles.statSub}>In active storage units</Text>
                    </View>
                </View>

                <View style={styles.statCard}>
                    <View style={[styles.statIconBox, { backgroundColor: '#fef3c7' }]}>
                        <Feather name="check-circle" size={22} color="#d97706" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statVal}>{statsLoading ? '...' : (stats.retrievedCount ?? 0)}</Text>
                        <Text style={styles.statLabel}>Retrieved for Processing</Text>
                        <Text style={styles.statSub}>Out for lab use / testing</Text>
                    </View>
                </View>

                <View style={styles.statCard}>
                    <View style={[styles.statIconBox, { backgroundColor: '#ffe4e6' }]}>
                        <Feather name="trash-2" size={22} color="#e11d48" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statVal}>{statsLoading ? '...' : (stats.discardedCount ?? 0)}</Text>
                        <Text style={styles.statLabel}>Discarded Vials</Text>
                        <Text style={styles.statSub}>Disposed / decontaminated</Text>
                    </View>
                </View>
            </View>

            {/* Filter Card (Exact Web .vm-filter-card) */}
            <View style={styles.filterCard}>
                <View style={styles.filterRow}>
                    <View style={styles.searchBox}>
                        <Feather name="search" size={16} color="#94a3b8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by Vial ID, Patient name, MRN, Description..."
                            placeholderTextColor="#94a3b8"
                            value={searchTerm}
                            onChangeText={(val) => { setSearchTerm(val); setPage(1); }}
                        />
                        {searchTerm ? (
                            <TouchableOpacity onPress={() => { setSearchTerm(''); setPage(1); }}>
                                <Feather name="x" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    <View style={{ width: 170 }}>
                        <DropdownSelect
                            options={['All', ...VIAL_TYPES].map(t => ({ label: t === 'All' ? 'All Vial Types' : t, value: t }))}
                            value={selectedType}
                            onChange={v => { setSelectedType(v); setPage(1); }}
                            placeholder="All Vial Types"
                        />
                    </View>

                    <View style={{ width: 155 }}>
                        <DropdownSelect
                            options={STATUS_OPTIONS.map(s => ({ label: s === 'All' ? 'All Statuses' : s, value: s }))}
                            value={selectedStatus}
                            onChange={v => { setSelectedStatus(v); setPage(1); }}
                            placeholder="All Statuses"
                        />
                    </View>

                    <View style={[styles.searchBox, { maxWidth: 175, flex: 0, minWidth: 140 }]}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Storage unit / freezer..."
                            placeholderTextColor="#94a3b8"
                            value={storageUnitFilter}
                            onChangeText={(val) => { setStorageUnitFilter(val); setPage(1); }}
                        />
                        {storageUnitFilter ? (
                            <TouchableOpacity onPress={() => { setStorageUnitFilter(''); setPage(1); }}>
                                <Feather name="x" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {/* Date Filters */}
                    <View style={styles.dateFilterGroup}>
                        <Text style={styles.datePrefix}>From</Text>
                        <View style={{ width: 130 }}>
                            <DatePickerInput
                                value={startDate}
                                onChange={(d) => { setStartDate(d); setPage(1); }}
                                placeholder="From Date"
                                title="Received Date From"
                            />
                        </View>
                        <Text style={styles.datePrefix}>To</Text>
                        <View style={{ width: 130 }}>
                            <DatePickerInput
                                value={endDate}
                                onChange={(d) => { setEndDate(d); setPage(1); }}
                                placeholder="To Date"
                                title="Received Date To"
                            />
                        </View>
                    </View>

                    {(searchTerm || selectedStatus !== 'All' || selectedType !== 'All' || storageUnitFilter || startDate || endDate) && (
                        <TouchableOpacity style={styles.resetBtn} onPress={handleResetFilters}>
                            <Feather name="refresh-cw" size={13} color="#64748b" style={{ marginRight: 5 }} />
                            <Text style={styles.resetBtnText}>Reset</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Vials Table Card (Exact Web .vm-table-card) */}
            {loading ? (
                <View style={styles.emptyCard}>
                    <ActivityIndicator size="large" color="#0284c7" />
                    <Text style={{ marginTop: 12, color: '#64748b', fontSize: 14, fontWeight: '500' }}>Loading vial records...</Text>
                </View>
            ) : vials.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Feather name="database" size={44} color="#cbd5e1" />
                    <Text style={styles.emptyTitle}>No Vials Found</Text>
                    <Text style={styles.emptyDesc}>
                        {searchTerm || selectedStatus !== 'All' || selectedType !== 'All' || storageUnitFilter || startDate || endDate
                            ? 'No vials match your search criteria. Try adjusting your filters.'
                            : 'No vials have been registered yet. Register and store your first vial using the button above.'}
                    </Text>
                    <TouchableOpacity style={[styles.btnPrimary, { marginTop: 18 }]} onPress={handleOpenStoreModal}>
                        <Feather name="plus" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.btnPrimaryText}>Store New Vial</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.tableCard}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View style={{ minWidth: 1040 }}>
                            {/* Table Header Row */}
                            <View style={styles.tableHeader}>
                                <Text style={[styles.th, { width: 150 }]}>Vial ID</Text>
                                <Text style={[styles.th, { width: 180 }]}>Patient</Text>
                                <Text style={[styles.th, { width: 130 }]}>MRN</Text>
                                <Text style={[styles.th, { width: 150 }]}>Vial Type</Text>
                                <Text style={[styles.th, { width: 125 }]}>Received Date</Text>
                                <Text style={[styles.th, { flex: 1, minWidth: 180 }]}>Current Location</Text>
                                <Text style={[styles.th, { width: 115 }]}>Status</Text>
                                <Text style={[styles.th, { width: 160, textAlign: 'right' }]}>Actions</Text>
                            </View>

                            {/* Table Body Rows */}
                            {vials.map(vial => {
                                const vialStatus = vial.currentStatus || vial.status || 'Received';
                                const stStyle = getStatusStyle(vialStatus);
                                const patientName = vial.patientSnapshot?.name || vial.patientId?.name || '—';
                                const patientMrn = vial.patientSnapshot?.mrn || vial.patientId?.mrn || vial.patientId?.uhid || '—';
                                const locStr = formatLocation(vial.currentLocation);

                                return (
                                    <View key={vial._id} style={styles.tableRow}>
                                        <View style={{ width: 150 }}>
                                            <View style={styles.vialIdBadge}>
                                                <Feather name="tag" size={11} color="#0284c7" style={{ marginRight: 5 }} />
                                                <Text style={styles.vialCode} numberOfLines={1}>{vial.vialId || vial._id.slice(-8)}</Text>
                                            </View>
                                        </View>

                                        <View style={{ width: 180 }}>
                                            <Text style={styles.patientName} numberOfLines={1}>{patientName}</Text>
                                        </View>

                                        <View style={{ width: 130 }}>
                                            <Text style={styles.patientMrn} numberOfLines={1}>{patientMrn}</Text>
                                        </View>

                                        <View style={{ width: 150 }}>
                                            <Text style={styles.vialType} numberOfLines={1}>{vial.vialType || '—'}</Text>
                                        </View>

                                        <View style={{ width: 125 }}>
                                            <Text style={styles.dateText}>{formatDate(vial.receivedAt)}</Text>
                                        </View>

                                        <View style={{ flex: 1, minWidth: 180 }}>
                                            {locStr ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <Feather name="map-pin" size={12} color="#0284c7" />
                                                    <Text style={styles.locationText} numberOfLines={1}>{locStr}</Text>
                                                </View>
                                            ) : (
                                                <Text style={[styles.locationText, { color: '#94a3b8', fontStyle: 'italic' }]}>Not Assigned</Text>
                                            )}
                                        </View>

                                        <View style={{ width: 115 }}>
                                            <View style={[styles.statusBadge, { backgroundColor: stStyle.bg, borderColor: stStyle.border }]}>
                                                <Text style={[styles.statusText, { color: stStyle.text }]}>{vialStatus}</Text>
                                            </View>
                                        </View>

                                        {/* Action Icons matching Web conditions */}
                                        <View style={styles.rowActions}>
                                            <TouchableOpacity
                                                nativeID={`btn-view-${vial.vialId || vial._id}`}
                                                style={styles.actionIconBtn}
                                                onPress={() => handleOpenDetails(vial)}
                                            >
                                                <Feather name="eye" size={15} color="#0284c7" />
                                            </TouchableOpacity>

                                            {vialStatus === 'Received' && (
                                                <TouchableOpacity
                                                    nativeID={`btn-store-${vial.vialId || vial._id}`}
                                                    style={styles.actionIconBtn}
                                                    onPress={() => handleOpenMove(vial)}
                                                >
                                                    <Feather name="box" size={15} color="#0284c7" />
                                                </TouchableOpacity>
                                            )}

                                            {['Stored', 'Moved', 'Returned'].includes(vialStatus) && (
                                                <>
                                                    <TouchableOpacity
                                                        nativeID={`btn-move-${vial.vialId || vial._id}`}
                                                        style={styles.actionIconBtn}
                                                        onPress={() => handleOpenMove(vial)}
                                                    >
                                                        <Feather name="truck" size={15} color="#7c3aed" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        nativeID={`btn-retrieve-${vial.vialId || vial._id}`}
                                                        style={styles.actionIconBtn}
                                                        onPress={() => handleOpenRetrieve(vial)}
                                                    >
                                                        <Feather name="rotate-ccw" size={15} color="#d97706" />
                                                    </TouchableOpacity>
                                                </>
                                            )}

                                            {vialStatus === 'Retrieved' && (
                                                <TouchableOpacity
                                                    nativeID={`btn-return-${vial.vialId || vial._id}`}
                                                    style={styles.actionIconBtn}
                                                    onPress={() => handleOpenReturn(vial)}
                                                >
                                                    <Feather name="box" size={15} color="#059669" />
                                                </TouchableOpacity>
                                            )}

                                            {vialStatus !== 'Discarded' && (
                                                <TouchableOpacity
                                                    nativeID={`btn-discard-${vial.vialId || vial._id}`}
                                                    style={styles.actionIconBtn}
                                                    onPress={() => handleOpenDiscard(vial)}
                                                >
                                                    <Feather name="trash-2" size={15} color="#dc2626" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>

                    {/* Pagination Bar (Exact Web .vm-pagination) */}
                    <View style={styles.paginationBar}>
                        <Text style={styles.pageInfo}>
                            Showing {totalRecords > 0 ? (page - 1) * (pagination.pageSize || 10) + 1 : 0} to {Math.min(page * (pagination.pageSize || 10), totalRecords)} of {totalRecords} vials
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <TouchableOpacity
                                style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                                disabled={page <= 1}
                                onPress={() => setPage(p => Math.max(1, p - 1))}
                            >
                                <Feather name="chevron-left" size={16} color={page <= 1 ? '#cbd5e1' : '#1e293b'} />
                                <Text style={[styles.pageBtnText, page <= 1 && { color: '#cbd5e1' }]}>Previous</Text>
                            </TouchableOpacity>

                            <Text style={styles.pageCurrentText}>Page {page} of {pagination.totalPages || 1}</Text>

                            <TouchableOpacity
                                style={[styles.pageBtn, page >= (pagination.totalPages || 1) && styles.pageBtnDisabled]}
                                disabled={page >= (pagination.totalPages || 1)}
                                onPress={() => setPage(p => p + 1)}
                            >
                                <Text style={[styles.pageBtnText, page >= (pagination.totalPages || 1) && { color: '#cbd5e1' }]}>Next</Text>
                                <Feather name="chevron-right" size={16} color={page >= (pagination.totalPages || 1) ? '#cbd5e1' : '#1e293b'} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* ==================== 1. STORE MODAL ==================== */}
            <Modal visible={showStoreModal} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="box" size={20} color="#0284c7" />
                                <Text style={styles.modalTitle}>Register & Store New Vial</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowStoreModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
                            {/* Patient Selection Search (Exact Web) */}
                            <Text style={styles.inputLabel}>Patient Selection *</Text>
                            {selectedPatient ? (
                                <View style={styles.selectedPatientCard}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                        <Feather name="check-circle" size={20} color="#16a34a" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.patientCardName}>{selectedPatient.name}</Text>
                                            <Text style={styles.patientCardMeta}>
                                                MRN: {selectedPatient.mrn || selectedPatient.uhid || '—'}
                                                {selectedPatient.phone ? ` • ${selectedPatient.phone}` : ''}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={styles.selectedBadge}>
                                            <Text style={styles.selectedBadgeText}>Selected</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.changePatientBtn}
                                            onPress={() => setSelectedPatient(null)}
                                        >
                                            <Text style={styles.changePatientText}>Change</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View>
                                    <View style={styles.patientSearchInputWrapper}>
                                        <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                                        <TextInput
                                            style={styles.patientSearchInput}
                                            placeholder="Search patient by name, MRN, or phone number..."
                                            placeholderTextColor="#94a3b8"
                                            value={patientQuery}
                                            onChangeText={handlePatientSearchChange}
                                        />
                                    </View>
                                    {searchingPatients && (
                                        <ActivityIndicator size="small" color="#0284c7" style={{ marginVertical: 8 }} />
                                    )}
                                    {patientResults.length > 0 && (
                                        <View style={styles.patientSearchResults}>
                                            {patientResults.map(p => (
                                                <TouchableOpacity
                                                    key={p._id}
                                                    style={styles.patientSearchItem}
                                                    onPress={() => handleSelectPatient(p)}
                                                >
                                                    <Text style={{ fontWeight: '600', color: '#0f172a', fontSize: 13.5 }}>{p.name}</Text>
                                                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                                                        MRN: {p.mrn || p.uhid || '—'} {p.phone ? `• ${p.phone}` : ''}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Vial ID */}
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Vial ID (Optional - auto-generated if blank)</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="e.g. VIAL-2026-001"
                                placeholderTextColor="#94a3b8"
                                value={storeForm.vialId}
                                onChangeText={t => setStoreForm({ ...storeForm, vialId: t })}
                            />

                            {/* Vial Type */}
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Vial Type *</Text>
                            <DropdownSelect
                                options={VIAL_TYPES.map(vt => ({ label: vt, value: vt }))}
                                value={storeForm.vialType}
                                onChange={vt => setStoreForm({ ...storeForm, vialType: vt })}
                                placeholder="Select Vial Type..."
                            />

                            {/* Initial Status */}
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Initial Status *</Text>
                            <DropdownSelect
                                options={[
                                    { label: 'Stored (Assigned to location now)', value: 'Stored' },
                                    { label: 'Received (Pending storage)', value: 'Received' }
                                ]}
                                value={storeForm.initialStatus}
                                onChange={st => setStoreForm({ ...storeForm, initialStatus: st })}
                                placeholder="Select Initial Status"
                            />

                            {/* Received Date */}
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Received Date & Time *</Text>
                            <DatePickerInput
                                value={storeForm.receivedAt ? storeForm.receivedAt.slice(0, 10) : ''}
                                onChange={d => setStoreForm({ ...storeForm, receivedAt: d })}
                                placeholder="Select Received Date"
                                title="Received Date"
                            />

                            {/* Storage Location Heading */}
                            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Storage Location</Text>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subInputLabel}>Room</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. Cold Room 1"
                                        placeholderTextColor="#94a3b8"
                                        value={storeForm.room}
                                        onChangeText={t => setStoreForm({ ...storeForm, room: t })}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subInputLabel}>Storage Unit / Freezer *</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. Freezer -80C A"
                                        placeholderTextColor="#94a3b8"
                                        value={storeForm.storageUnit}
                                        onChangeText={t => setStoreForm({ ...storeForm, storageUnit: t })}
                                    />
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subInputLabel}>Rack</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. R-02"
                                        placeholderTextColor="#94a3b8"
                                        value={storeForm.rack}
                                        onChangeText={t => setStoreForm({ ...storeForm, rack: t })}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subInputLabel}>Box</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. B-05"
                                        placeholderTextColor="#94a3b8"
                                        value={storeForm.box}
                                        onChangeText={t => setStoreForm({ ...storeForm, box: t })}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subInputLabel}>Position</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. C-3"
                                        placeholderTextColor="#94a3b8"
                                        value={storeForm.position}
                                        onChangeText={t => setStoreForm({ ...storeForm, position: t })}
                                    />
                                </View>
                            </View>

                            {/* Description */}
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Sample Description</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="e.g. Blood plasma 5ml EDTA tube"
                                placeholderTextColor="#94a3b8"
                                value={storeForm.description}
                                onChangeText={t => setStoreForm({ ...storeForm, description: t })}
                            />

                            {/* Notes */}
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Internal Notes</Text>
                            <TextInput
                                style={[styles.modalInput, { height: 64, textAlignVertical: 'top' }]}
                                multiline
                                placeholder="Any additional clinical or storage handling notes..."
                                placeholderTextColor="#94a3b8"
                                value={storeForm.notes}
                                onChangeText={t => setStoreForm({ ...storeForm, notes: t })}
                            />
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowStoreModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleStoreSubmit} disabled={actionSubmitting}>
                                <Text style={styles.modalSubmitText}>{actionSubmitting ? 'Registering...' : 'Register & Store Vial'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ==================== 2. MOVE MODAL ==================== */}
            <Modal visible={showMoveModal} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="truck" size={20} color="#7c3aed" />
                                <Text style={styles.modalTitle}>Move Vial to New Storage Location</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowMoveModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.infoBanner}>
                            <Text style={{ color: '#475569', fontSize: 13 }}>
                                <Text style={{ fontWeight: '700', color: '#0f172a' }}>Current Location: </Text>
                                {formatLocation(activeVial?.currentLocation) || 'Not Assigned'}
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Destination Room</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. Cold Room 2"
                                    placeholderTextColor="#94a3b8"
                                    value={moveForm.room}
                                    onChangeText={t => setMoveForm({ ...moveForm, room: t })}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Destination Storage Unit *</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. Freezer B"
                                    placeholderTextColor="#94a3b8"
                                    value={moveForm.storageUnit}
                                    onChangeText={t => setMoveForm({ ...moveForm, storageUnit: t })}
                                />
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Rack</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. R-01"
                                    placeholderTextColor="#94a3b8"
                                    value={moveForm.rack}
                                    onChangeText={t => setMoveForm({ ...moveForm, rack: t })}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Box</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. B-02"
                                    placeholderTextColor="#94a3b8"
                                    value={moveForm.box}
                                    onChangeText={t => setMoveForm({ ...moveForm, box: t })}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Position</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. D-5"
                                    placeholderTextColor="#94a3b8"
                                    value={moveForm.position}
                                    onChangeText={t => setMoveForm({ ...moveForm, position: t })}
                                />
                            </View>
                        </View>

                        <Text style={[styles.inputLabel, { marginTop: 14 }]}>Reason for Movement</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Reorganization, temperature change, unit maintenance"
                            placeholderTextColor="#94a3b8"
                            value={moveForm.reason}
                            onChangeText={t => setMoveForm({ ...moveForm, reason: t })}
                        />

                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Notes</Text>
                        <TextInput
                            style={[styles.modalInput, { height: 50 }]}
                            placeholder="Optional notes..."
                            placeholderTextColor="#94a3b8"
                            value={moveForm.notes}
                            onChangeText={t => setMoveForm({ ...moveForm, notes: t })}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowMoveModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalSubmitBtn, { backgroundColor: '#7c3aed' }]}
                                onPress={handleMoveSubmit}
                                disabled={actionSubmitting}
                            >
                                <Text style={styles.modalSubmitText}>{actionSubmitting ? 'Moving...' : 'Confirm Move'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ==================== 3. RETRIEVE MODAL ==================== */}
            <Modal visible={showRetrieveModal} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="rotate-ccw" size={20} color="#d97706" />
                                <Text style={styles.modalTitle}>Retrieve Vial from Storage</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowRetrieveModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.infoBanner}>
                            <Text style={{ color: '#475569', fontSize: 13 }}>
                                <Text style={{ fontWeight: '700', color: '#0f172a' }}>Stored At: </Text>
                                {formatLocation(activeVial?.currentLocation) || 'Not Assigned'}
                            </Text>
                        </View>

                        <Text style={[styles.inputLabel, { marginTop: 14 }]}>Reason for Retrieval *</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Lab analysis, physician request, transfer to partner lab"
                            placeholderTextColor="#94a3b8"
                            value={retrieveForm.reason}
                            onChangeText={t => setRetrieveForm({ ...retrieveForm, reason: t })}
                        />

                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Retrieval Date & Time *</Text>
                        <DatePickerInput
                            value={retrieveForm.retrievalDate ? retrieveForm.retrievalDate.slice(0, 10) : ''}
                            onChange={d => setRetrieveForm({ ...retrieveForm, retrievalDate: d })}
                            placeholder="Select Retrieval Date"
                            title="Retrieval Date"
                        />

                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Retrieval Notes</Text>
                        <TextInput
                            style={[styles.modalInput, { height: 50 }]}
                            placeholder="Optional notes or handling instructions..."
                            placeholderTextColor="#94a3b8"
                            value={retrieveForm.notes}
                            onChangeText={t => setRetrieveForm({ ...retrieveForm, notes: t })}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowRetrieveModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalSubmitBtn, { backgroundColor: '#d97706' }]}
                                onPress={handleRetrieveSubmit}
                                disabled={actionSubmitting}
                            >
                                <Text style={styles.modalSubmitText}>{actionSubmitting ? 'Retrieving...' : 'Confirm Retrieval'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ==================== 4. RETURN MODAL ==================== */}
            <Modal visible={showReturnModal} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="box" size={20} color="#0d9488" />
                                <Text style={styles.modalTitle}>Return Vial to Storage</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowReturnModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Destination Storage Unit *</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. Freezer A"
                                    placeholderTextColor="#94a3b8"
                                    value={returnForm.storageUnit}
                                    onChangeText={t => setReturnForm({ ...returnForm, storageUnit: t })}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Destination Room</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. Cold Room 1"
                                    placeholderTextColor="#94a3b8"
                                    value={returnForm.room}
                                    onChangeText={t => setReturnForm({ ...returnForm, room: t })}
                                />
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Rack</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. R-01"
                                    placeholderTextColor="#94a3b8"
                                    value={returnForm.rack}
                                    onChangeText={t => setReturnForm({ ...returnForm, rack: t })}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Box</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. B-01"
                                    placeholderTextColor="#94a3b8"
                                    value={returnForm.box}
                                    onChangeText={t => setReturnForm({ ...returnForm, box: t })}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Position</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. A-1"
                                    placeholderTextColor="#94a3b8"
                                    value={returnForm.position}
                                    onChangeText={t => setReturnForm({ ...returnForm, position: t })}
                                />
                            </View>
                        </View>

                        <Text style={[styles.inputLabel, { marginTop: 14 }]}>Return Date & Time *</Text>
                        <DatePickerInput
                            value={returnForm.returnDate ? returnForm.returnDate.slice(0, 10) : ''}
                            onChange={d => setReturnForm({ ...returnForm, returnDate: d })}
                            placeholder="Select Return Date"
                            title="Return Date"
                        />

                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Return Notes</Text>
                        <TextInput
                            style={[styles.modalInput, { height: 50 }]}
                            placeholder="Optional notes..."
                            placeholderTextColor="#94a3b8"
                            value={returnForm.notes}
                            onChangeText={t => setReturnForm({ ...returnForm, notes: t })}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowReturnModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalSubmitBtn, { backgroundColor: '#0d9488' }]}
                                onPress={handleReturnSubmit}
                                disabled={actionSubmitting}
                            >
                                <Text style={styles.modalSubmitText}>{actionSubmitting ? 'Returning...' : 'Return to Storage'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ==================== 5. DISCARD MODAL ==================== */}
            <Modal visible={showDiscardModal} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="trash-2" size={20} color="#dc2626" />
                                <Text style={[styles.modalTitle, { color: '#dc2626' }]}>⚠️ Discard Vial Confirmation</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowDiscardModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.infoBanner, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                            <Text style={{ color: '#991b1b', fontSize: 13, lineHeight: 18 }}>
                                <Text style={{ fontWeight: '700' }}>Warning: </Text>
                                Discarding a vial marks it permanently disposed. This action cannot be undone.
                            </Text>
                        </View>

                        <Text style={[styles.inputLabel, { marginTop: 14 }]}>Reason for Discard * (min 3 chars)</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Expired sample, contaminated, test completed and consumed"
                            placeholderTextColor="#94a3b8"
                            value={discardForm.discardReason}
                            onChangeText={t => setDiscardForm({ ...discardForm, discardReason: t })}
                        />

                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Discard Date & Time *</Text>
                        <DatePickerInput
                            value={discardForm.discardDate ? discardForm.discardDate.slice(0, 10) : ''}
                            onChange={d => setDiscardForm({ ...discardForm, discardDate: d })}
                            placeholder="Select Discard Date"
                            title="Discard Date"
                        />

                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Discard Notes</Text>
                        <TextInput
                            style={[styles.modalInput, { height: 50 }]}
                            placeholder="Disposal method, witness, waste manifest ID..."
                            placeholderTextColor="#94a3b8"
                            value={discardForm.notes}
                            onChangeText={t => setDiscardForm({ ...discardForm, notes: t })}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowDiscardModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalSubmitBtn, { backgroundColor: '#dc2626' }]}
                                onPress={handleDiscardSubmit}
                                disabled={actionSubmitting}
                            >
                                <Text style={styles.modalSubmitText}>{actionSubmitting ? 'Discarding...' : 'Confirm Discard'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ==================== 6. DETAILS MODAL & AUDIT HISTORY ==================== */}
            <Modal visible={showDetailsModal} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { maxWidth: 640 }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={styles.modalTitle}>🧪 Vial Details: {activeVial?.vialId || activeVial?._id}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 490 }} showsVerticalScrollIndicator={false}>
                            {/* Metadata Grid */}
                            <View style={styles.detailGrid}>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Patient Name</Text>
                                    <Text style={styles.detailVal}>{activeVial?.patientSnapshot?.name || activeVial?.patientId?.name || '—'}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>MRN / UHID</Text>
                                    <Text style={styles.detailVal}>{activeVial?.patientSnapshot?.mrn || activeVial?.patientId?.mrn || activeVial?.patientId?.uhid || '—'}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Vial Type</Text>
                                    <Text style={styles.detailVal}>{activeVial?.vialType || '—'}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Current Status</Text>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(activeVial?.currentStatus || 'Received').bg, borderColor: getStatusStyle(activeVial?.currentStatus || 'Received').border, alignSelf: 'flex-start', marginTop: 2 }]}>
                                        <Text style={[styles.statusText, { color: getStatusStyle(activeVial?.currentStatus || 'Received').text }]}>{activeVial?.currentStatus || 'Received'}</Text>
                                    </View>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Current Storage Location</Text>
                                    <Text style={styles.detailVal}>{formatLocation(activeVial?.currentLocation) || 'Not Assigned'}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Received Date</Text>
                                    <Text style={styles.detailVal}>{formatDate(activeVial?.receivedAt)}</Text>
                                </View>
                                <View style={styles.detailItemFull}>
                                    <Text style={styles.detailLabel}>Sample Description</Text>
                                    <Text style={[styles.detailVal, { fontWeight: '400' }]}>{activeVial?.description || 'No description provided'}</Text>
                                </View>
                                {activeVial?.notes ? (
                                    <View style={styles.detailItemFull}>
                                        <Text style={styles.detailLabel}>Notes</Text>
                                        <Text style={[styles.detailVal, { fontWeight: '400' }]}>{activeVial.notes}</Text>
                                    </View>
                                ) : null}
                            </View>

                            {/* Movement & Audit History (1:1 Web Timeline) */}
                            <View style={{ marginTop: 20 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                                    <Feather name="clock" size={15} color="#0284c7" />
                                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>Movement & Audit History</Text>
                                </View>
                                {Array.isArray(activeVial?.auditHistory) && activeVial.auditHistory.length > 0 ? (
                                    activeVial.auditHistory.map((item, idx) => {
                                        const prevLoc = formatLocation(item.previousLocation);
                                        const newLoc = formatLocation(item.newLocation);
                                        return (
                                            <View key={item._id || idx} style={styles.auditRow}>
                                                <View style={styles.auditDot} />
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                                                        <Text style={styles.auditAction}>{item.action || 'Updated'}</Text>
                                                        <Text style={styles.auditMeta}>{formatDateTime(item.timestamp)} • By: {item.performedByName || item.performedBy?.name || 'Hospital Staff'}</Text>
                                                    </View>
                                                    {item.reason ? <Text style={styles.auditReason}>Reason: {item.reason}</Text> : null}
                                                    {prevLoc && newLoc ? (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                                            <Text style={{ fontSize: 12, color: '#475569' }}>{prevLoc}</Text>
                                                            <Feather name="arrow-right" size={12} color="#0284c7" />
                                                            <Text style={{ fontSize: 12, color: '#0284c7', fontWeight: '600' }}>{newLoc}</Text>
                                                        </View>
                                                    ) : (!prevLoc && newLoc) ? (
                                                        <Text style={{ fontSize: 12, color: '#0284c7', marginTop: 2 }}>Location: {newLoc}</Text>
                                                    ) : null}
                                                    {item.notes ? <Text style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>"{item.notes}"</Text> : null}
                                                </View>
                                            </View>
                                        );
                                    })
                                ) : (
                                    <Text style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>No historical movements recorded yet.</Text>
                                )}
                            </View>
                        </ScrollView>

                        <View style={[styles.modalActions, { justifyContent: 'flex-end', marginTop: 14 }]}>
                            <TouchableOpacity nativeID="btn-close-details" style={styles.modalCancelBtn} onPress={() => setShowDetailsModal(false)}>
                                <Text style={styles.modalCancelText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    scrollContent: { padding: 24, maxWidth: 1440, alignSelf: 'center', width: '100%' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 },
    headerLeft: { flex: 1, minWidth: 260 },
    title: { fontSize: 26, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
    subtitle: { fontSize: 14, color: '#64748b', marginTop: 6 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    btnPrimary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0284c7', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, shadowColor: '#0284c7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 3 },
    btnPrimaryText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
    btnSecondary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1' },
    btnSecondaryText: { color: '#475569', fontWeight: '600', fontSize: 14 },
    alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
    tryAgainBtn: { backgroundColor: '#ef4444', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
    tryAgainText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },

    /* Exact Web .vm-stats-grid */
    statsGrid: { flexDirection: 'row', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
    statCard: { flex: 1, minWidth: 200, backgroundColor: '#ffffff', padding: 18, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
    statIconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    statInfo: { flexDirection: 'column' },
    statVal: { fontSize: 24, fontWeight: '800', color: '#0f172a', lineHeight: 28 },
    statLabel: { fontSize: 13, color: '#334155', fontWeight: '700', marginTop: 2 },
    statSub: { fontSize: 11.5, color: '#94a3b8', marginTop: 1 },

    /* Exact Web .vm-filter-card */
    filterCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 6, elevation: 1 },
    filterRow: { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
    searchBox: { flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', paddingHorizontal: 14, borderRadius: 10, height: 42, borderWidth: 1, borderColor: '#cbd5e1' },
    searchInput: { flex: 1, fontSize: 13.5, color: '#1e293b' },
    dateFilterGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
    datePrefix: { fontSize: 12, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
    resetBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    resetBtnText: { fontSize: 13, color: '#64748b', fontWeight: '600' },

    emptyCard: { backgroundColor: '#ffffff', padding: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginVertical: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 14 },
    emptyDesc: { fontSize: 13, color: '#64748b', marginTop: 6, textAlign: 'center', maxWidth: 440 },

    /* Exact Web .vm-table-card */
    tableCard: { backgroundColor: '#ffffff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1, marginBottom: 20 },
    tableHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 12, paddingHorizontal: 16 },
    th: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    vialIdBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, alignSelf: 'flex-start' },
    vialCode: { fontSize: 13, fontWeight: '700', color: '#0284c7' },
    patientName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    patientMrn: { fontSize: 13, color: '#64748b' },
    vialType: { fontSize: 13.5, fontWeight: '600', color: '#334155' },
    dateText: { fontSize: 13, color: '#475569' },
    locationText: { fontSize: 13, color: '#334155' },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, alignSelf: 'flex-start' },
    statusText: { fontSize: 11.5, fontWeight: '700' },
    rowActions: { width: 160, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
    actionIconBtn: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
    paginationBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0', flexWrap: 'wrap', gap: 10 },
    pageInfo: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    pageCurrentText: { fontSize: 13, color: '#334155', fontWeight: '600' },
    pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1' },
    pageBtnDisabled: { opacity: 0.4 },
    pageBtnText: { fontSize: 13, fontWeight: '600', color: '#1e293b' },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 540, maxHeight: '90%', elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    infoBanner: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: 0.5 },
    inputLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
    subInputLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 4 },
    modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#0f172a' },
    selectedPatientCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', padding: 12, borderRadius: 8, marginBottom: 10 },
    patientCardName: { fontWeight: '700', fontSize: 14, color: '#0f172a' },
    patientCardMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
    selectedBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#86efac' },
    selectedBadgeText: { fontSize: 11, fontWeight: '700', color: '#166534' },
    changePatientBtn: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1' },
    changePatientText: { fontSize: 12, color: '#475569', fontWeight: '600' },
    patientSearchInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    patientSearchInput: { flex: 1, fontSize: 14, color: '#0f172a' },
    patientSearchResults: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginTop: 4, maxHeight: 160, overflow: 'hidden' },
    patientSearchItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 14 },
    modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
    modalCancelText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
    modalSubmitBtn: { backgroundColor: '#0284c7', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    modalSubmitText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, backgroundColor: '#f8fafc', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    detailItem: { width: '48%' },
    detailItemFull: { width: '100%', marginTop: 4 },
    detailLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
    detailVal: { fontSize: 14, color: '#0f172a', fontWeight: '700', marginTop: 2 },
    auditRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderLeftWidth: 2, borderLeftColor: '#e2e8f0', paddingLeft: 12, marginLeft: 6, marginBottom: 8 },
    auditDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0284c7', position: 'absolute', left: -5, top: 12 },
    auditAction: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    auditMeta: { fontSize: 11, color: '#64748b', marginTop: 1 },
    auditReason: { fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 2 }
});

export default VialManagement;
