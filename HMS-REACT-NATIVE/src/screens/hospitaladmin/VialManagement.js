import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    StyleSheet, ActivityIndicator, Alert, Modal, Platform,
    Pressable, useWindowDimensions
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { vialAPI, patientAPI } from '../../utils/api';
import DatePickerInput from '../../components/common/DatePickerInput';
import TimePickerInput from '../../components/common/TimePickerInput';
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
    const { width: windowWidth } = useWindowDimensions();

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
    const [toastMessage, setToastMessage] = useState(null);

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
    const [showPatientDropdown, setShowPatientDropdown] = useState(false);
    const searchDebounceRef = useRef(null);
    const patientSearchContainerRef = useRef(null);

    // Close patient dropdown on outside click (1:1 Web parity)
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const handleClickOutside = (e) => {
            if (patientSearchContainerRef.current) {
                const node = patientSearchContainerRef.current;
                if (node.contains && !node.contains(e.target)) {
                    setShowPatientDropdown(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Store Vial Form State (clean empty initial state - no dummy data)
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

    const showNotification = (msg, isError = false) => {
        setToastMessage({ text: msg, isError });
        setTimeout(() => setToastMessage(null), 4000);
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

    // Patient live search — triggers ONLY when user types a name or search term
    const handlePatientSearchChange = (query) => {
        setPatientQuery(query);

        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }

        const trimmed = query.trim();
        if (!trimmed || trimmed.length < 1) {
            setPatientResults([]);
            setShowPatientDropdown(false);
            setSearchingPatients(false);
            return;
        }

        setShowPatientDropdown(true);
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
        setShowPatientDropdown(false);
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
        setShowPatientDropdown(false);
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
            showNotification('Please search and select a patient first', true);
            return;
        }
        if (!storeForm.vialType) {
            showNotification('Please select a Vial Type', true);
            return;
        }
        if (!storeForm.storageUnit || !storeForm.storageUnit.trim()) {
            showNotification('Storage Unit / Freezer is mandatory', true);
            return;
        }
        if (!storeForm.receivedAt || !storeForm.receivedAt.trim()) {
            showNotification('Received Date & Time is required', true);
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
                showNotification(res.message || 'Vial stored successfully');
                setShowStoreModal(false);
                fetchVials();
                fetchStats();
            } else {
                showNotification(res?.message || 'Failed to register vial', true);
            }
        } catch (err) {
            console.error('Store error:', err);
            showNotification(err?.response?.data?.message || err?.message || 'Error registering vial', true);
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
            showNotification('Destination Storage Unit is required', true);
            return;
        }
        if (!moveForm.reason || !moveForm.reason.trim()) {
            showNotification('Reason for movement is required', true);
            return;
        }

        setActionSubmitting(true);
        try {
            const res = await vialAPI.move(activeVial._id, moveForm);
            if (res && res.success) {
                showNotification(res.message || 'Vial moved successfully');
                setShowMoveModal(false);
                fetchVials();
                fetchStats();
            } else {
                showNotification(res?.message || 'Failed to move vial', true);
            }
        } catch (err) {
            showNotification(err?.response?.data?.message || 'Error moving vial', true);
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
            showNotification('Reason for retrieval is required', true);
            return;
        }
        if (!retrieveForm.retrievalDate || !retrieveForm.retrievalDate.trim()) {
            showNotification('Retrieval Date & Time is required', true);
            return;
        }

        setActionSubmitting(true);
        try {
            const res = await vialAPI.retrieve(activeVial._id, retrieveForm);
            if (res && res.success) {
                showNotification(res.message || 'Vial retrieved successfully');
                setShowRetrieveModal(false);
                fetchVials();
                fetchStats();
            } else {
                showNotification(res?.message || 'Failed to retrieve vial', true);
            }
        } catch (err) {
            showNotification(err?.response?.data?.message || 'Error retrieving vial', true);
        } finally {
            setActionSubmitting(false);
        }
    };

    // Open Return Modal
    const handleOpenReturn = (vial) => {
        setActiveVial(vial);
        // Look up last stored location from history if available
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
            showNotification('Storage Unit is required to return vial to storage', true);
            return;
        }
        if (!returnForm.returnDate || !returnForm.returnDate.trim()) {
            showNotification('Return Date & Time is required', true);
            return;
        }

        setActionSubmitting(true);
        try {
            const res = await vialAPI.returnToStorage(activeVial._id, returnForm);
            if (res && res.success) {
                showNotification(res.message || 'Vial returned to storage');
                setShowReturnModal(false);
                fetchVials();
                fetchStats();
            } else {
                showNotification(res?.message || 'Failed to return vial', true);
            }
        } catch (err) {
            showNotification(err?.response?.data?.message || 'Error returning vial', true);
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
            showNotification('Please enter a valid discard reason (at least 3 characters)', true);
            return;
        }
        if (!discardForm.discardDate || !discardForm.discardDate.trim()) {
            showNotification('Discard Date & Time is required', true);
            return;
        }

        setActionSubmitting(true);
        try {
            const res = await vialAPI.discard(activeVial._id, discardForm);
            if (res && res.success) {
                showNotification(res.message || 'Vial marked as discarded');
                setShowDiscardModal(false);
                fetchVials();
                fetchStats();
            } else {
                showNotification(res?.message || 'Failed to discard vial', true);
            }
        } catch (err) {
            showNotification(err?.response?.data?.message || 'Error discarding vial', true);
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
            showNotification('Error fetching vial details', true);
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

    // Format date time string (Exact Web formatDateTime)
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
        const key = (status || 'received').toLowerCase();
        switch (key) {
            case 'received':
                return { bg: '#e0f2fe', text: '#0284c7', border: '#bae6fd' };
            case 'stored':
                return { bg: '#dcfce7', text: '#059669', border: '#a7f3d0' };
            case 'moved':
                return { bg: '#f3e8ff', text: '#7c3aed', border: '#ddd6fe' };
            case 'retrieved':
                return { bg: '#fef3c7', text: '#d97706', border: '#fde68a' };
            case 'returned':
                return { bg: '#ccfbf1', text: '#0d9488', border: '#99f6e4' };
            case 'discarded':
                return { bg: '#ffe4e6', text: '#e11d48', border: '#fecdd3' };
            default:
                return { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
        }
    };

    const totalRecords = pagination.totalRecords !== undefined ? pagination.totalRecords : vials.length;
    const totalPages = pagination.totalPages || 1;
    const startRecord = totalRecords > 0 ? (page - 1) * (pagination.pageSize || 10) + 1 : 0;
    const endRecord = Math.min(page * (pagination.pageSize || 10), totalRecords);

    // Page numbers calculation for Web Pagination parity
    const getPageNumbers = () => {
        if (totalPages <= 5) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        if (page <= 3) {
            return [1, 2, 3, 4, '...', totalPages];
        }
        if (page >= totalPages - 2) {
            return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        }
        return [1, '...', page - 1, page, page + 1, '...', totalPages];
    };

    return (
        <View style={styles.container}>
            {/* Toast Notification Banner - Screen-Level Absolute Top Overlay */}
            {toastMessage ? (
                <View style={styles.toastOverlayContainer} pointerEvents="box-none">
                    <View style={[
                        styles.toastBanner,
                        toastMessage.isError ? styles.toastError : styles.toastSuccess
                    ]}>
                        <Feather
                            name={toastMessage.isError ? 'alert-circle' : 'check-circle'}
                            size={16}
                            color={toastMessage.isError ? '#e11d48' : '#059669'}
                            style={{ marginRight: 8 }}
                        />
                        <Text style={[
                            styles.toastText,
                            toastMessage.isError ? styles.toastTextError : styles.toastTextSuccess
                        ]}>
                            {toastMessage.text}
                        </Text>
                    </View>
                </View>
            ) : null}

            <ScrollView style={styles.mainScrollView} contentContainerStyle={styles.scrollContent}>

            {/* 1. PAGE HEADER (Exact Web .vm-header) */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>🧪 Vial Management Workspace</Text>
                    <Text style={styles.headerSubtitle}>
                        Track, store, move, retrieve, and audit laboratory and biological patient vials
                    </Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.btnSecondary}
                        onPress={() => { fetchVials(); fetchStats(); }}
                        activeOpacity={0.7}
                    >
                        <Feather name="refresh-cw" size={14} color="#475569" style={{ marginRight: 6 }} />
                        <Text style={styles.btnSecondaryText}>Refresh</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.btnPrimary}
                        onPress={handleOpenStoreModal}
                        activeOpacity={0.85}
                    >
                        <Feather name="plus" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.btnPrimaryText}>Store Vial</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* 2. STATS CARDS (Exact Web .vm-stats-grid) */}
            <View style={styles.statsGrid}>
                {/* Total Vials */}
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#e0f2fe' }]}>
                        <Feather name="box" size={22} color="#0284c7" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statVal}>
                            {statsLoading ? '...' : (stats.totalVials || 0)}
                        </Text>
                        <Text style={styles.statLabel}>Total Vials</Text>
                    </View>
                </View>

                {/* Currently Stored */}
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#dcfce7' }]}>
                        <Feather name="check-circle" size={22} color="#10b981" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statVal}>
                            {statsLoading ? '...' : (stats.currentlyStored || 0)}
                        </Text>
                        <Text style={styles.statLabel}>Currently Stored</Text>
                    </View>
                </View>

                {/* Retrieved */}
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
                        <Feather name="truck" size={22} color="#f59e0b" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statVal}>
                            {statsLoading ? '...' : (stats.retrievedCount || 0)}
                        </Text>
                        <Text style={styles.statLabel}>Retrieved</Text>
                    </View>
                </View>

                {/* Discarded */}
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, { backgroundColor: '#ffe4e6' }]}>
                        <Feather name="trash-2" size={22} color="#f43f5e" />
                    </View>
                    <View style={styles.statInfo}>
                        <Text style={styles.statVal}>
                            {statsLoading ? '...' : (stats.discardedCount || 0)}
                        </Text>
                        <Text style={styles.statLabel}>Discarded</Text>
                    </View>
                </View>
            </View>

            {/* 3. FILTER BAR (Exact Web .vm-filter-card) */}
            <View style={styles.filterCard}>
                <View style={styles.filterRow}>
                    {/* Search Input */}
                    <View style={styles.searchBox}>
                        <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by Vial ID, Patient, MRN..."
                            placeholderTextColor="#94a3b8"
                            value={searchTerm}
                            onChangeText={(val) => { setSearchTerm(val); setPage(1); }}
                        />
                        {searchTerm ? (
                            <TouchableOpacity onPress={() => { setSearchTerm(''); setPage(1); }}>
                                <Feather name="x" size={14} color="#94a3b8" />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {/* Vial Type Select */}
                    <View style={{ width: 165 }}>
                        <DropdownSelect
                            options={['All', ...VIAL_TYPES].map(t => ({
                                label: t === 'All' ? 'All Vial Types' : t,
                                value: t
                            }))}
                            value={selectedType}
                            onChange={(val) => { setSelectedType(val); setPage(1); }}
                            placeholder="All Vial Types"
                        />
                    </View>

                    {/* Status Select */}
                    <View style={{ width: 150 }}>
                        <DropdownSelect
                            options={STATUS_OPTIONS.map(s => ({
                                label: s === 'All' ? 'All Statuses' : s,
                                value: s
                            }))}
                            value={selectedStatus}
                            onChange={(val) => { setSelectedStatus(val); setPage(1); }}
                            placeholder="All Statuses"
                        />
                    </View>

                    {/* Storage Unit Input */}
                    <View style={[styles.searchBox, { maxWidth: 160, flex: 0, minWidth: 130 }]}>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Storage Unit..."
                            placeholderTextColor="#94a3b8"
                            value={storageUnitFilter}
                            onChangeText={(val) => { setStorageUnitFilter(val); setPage(1); }}
                        />
                        {storageUnitFilter ? (
                            <TouchableOpacity onPress={() => { setStorageUnitFilter(''); setPage(1); }}>
                                <Feather name="x" size={14} color="#94a3b8" />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {/* Date Filter Group */}
                    <View style={styles.dateFilterGroup}>
                        <Text style={styles.datePrefix}>From</Text>
                        <View style={{ width: 125 }}>
                            <DatePickerInput
                                value={startDate}
                                onChange={(d) => { setStartDate(d); setPage(1); }}
                                placeholder="From Date"
                                title="Received Date From"
                            />
                        </View>
                        <Text style={styles.datePrefix}>To</Text>
                        <View style={{ width: 125 }}>
                            <DatePickerInput
                                value={endDate}
                                onChange={(d) => { setEndDate(d); setPage(1); }}
                                placeholder="To Date"
                                title="Received Date To"
                            />
                        </View>
                    </View>

                    {/* Clear Filters Button */}
                    {(searchTerm || selectedStatus !== 'All' || selectedType !== 'All' || storageUnitFilter || startDate || endDate) && (
                        <TouchableOpacity style={styles.filterResetBtn} onPress={handleResetFilters}>
                            <Text style={styles.filterResetText}>Clear Filters</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* 4. VIALS TABLE CARD (Exact Web .vm-table-card) */}
            <View style={styles.tableCard}>
                <View style={styles.tableWrapper}>
                    {loading ? (
                        <View style={styles.stateBox}>
                            <ActivityIndicator size="large" color="#0284c7" />
                            <Text style={styles.stateTitle}>Loading vial records...</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.stateBox}>
                            <Feather name="alert-circle" size={44} color="#ef4444" style={{ marginBottom: 12 }} />
                            <Text style={[styles.stateTitle, { color: '#ef4444' }]}>{error}</Text>
                            <TouchableOpacity style={[styles.btnSecondary, { marginTop: 12 }]} onPress={fetchVials}>
                                <Text style={styles.btnSecondaryText}>Try Again</Text>
                            </TouchableOpacity>
                        </View>
                    ) : vials.length === 0 ? (
                        <View style={styles.stateBox}>
                            <Feather name="box" size={44} color="#94a3b8" style={{ marginBottom: 12 }} />
                            <Text style={styles.stateTitle}>No vials have been registered yet.</Text>
                            <Text style={styles.stateSubtitle}>
                                {searchTerm || selectedStatus !== 'All'
                                    ? 'No vials match your search filters. Try clearing your search parameters.'
                                    : 'Store your first biological or laboratory sample vial using the button above.'}
                            </Text>
                        </View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                            <View style={{ minWidth: 960 }}>
                                {/* Table Header Row (Exact Web 7 Columns) */}
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { width: 140 }]}>Vial ID</Text>
                                    <Text style={[styles.th, { width: 190 }]}>Patient</Text>
                                    <Text style={[styles.th, { width: 150 }]}>Vial Type</Text>
                                    <Text style={[styles.th, { width: 130 }]}>Received Date</Text>
                                    <Text style={[styles.th, { flex: 1, minWidth: 190 }]}>Current Location</Text>
                                    <Text style={[styles.th, { width: 110 }]}>Status</Text>
                                    <Text style={[styles.th, { width: 150, textAlign: 'right' }]}>Actions</Text>
                                </View>

                                {/* Table Body Rows */}
                                {vials.map((vial) => {
                                    const locStr = formatLocation(vial.currentLocation);
                                    const statusKey = (vial.currentStatus || 'received').toLowerCase();
                                    const patientObj = vial.patientId || vial.patientSnapshot || {};
                                    const stStyle = getStatusStyle(vial.currentStatus);

                                    return (
                                        <View key={vial._id} style={styles.tableRow}>
                                            {/* 1. Vial ID */}
                                            <View style={{ width: 140 }}>
                                                <View style={styles.vialIdBadge}>
                                                    <Feather name="tag" size={11} color="#0369a1" style={{ marginRight: 5 }} />
                                                    <Text style={styles.vialIdText} numberOfLines={1}>{vial.vialId || vial._id?.slice(-8)}</Text>
                                                </View>
                                            </View>

                                            {/* 2. Patient (Name + MRN) */}
                                            <View style={{ width: 190 }}>
                                                <Text style={styles.patientName} numberOfLines={1}>{patientObj.name || 'Unknown'}</Text>
                                                <Text style={styles.patientMrn} numberOfLines={1}>
                                                    MRN: {patientObj.mrn || patientObj.patientId || patientObj.uhid || '—'}
                                                </Text>
                                            </View>

                                            {/* 3. Vial Type */}
                                            <View style={{ width: 150 }}>
                                                <Text style={styles.vialTypeText} numberOfLines={1}>{vial.vialType || '—'}</Text>
                                            </View>

                                            {/* 4. Received Date */}
                                            <View style={{ width: 130 }}>
                                                <Text style={styles.receivedDateText}>{formatDate(vial.receivedAt)}</Text>
                                            </View>

                                            {/* 5. Current Location */}
                                            <View style={{ flex: 1, minWidth: 190 }}>
                                                {locStr ? (
                                                    <View style={styles.locationTag}>
                                                        <Feather name="map-pin" size={11} color="#0284c7" style={{ marginRight: 4 }} />
                                                        <Text style={styles.locationTagText} numberOfLines={1}>{locStr}</Text>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.locationEmptyText}>Not in storage</Text>
                                                )}
                                            </View>

                                            {/* 6. Status Badge */}
                                            <View style={{ width: 110 }}>
                                                <View style={[styles.statusBadge, { backgroundColor: stStyle.bg, borderColor: stStyle.border }]}>
                                                    <Text style={[styles.statusBadgeText, { color: stStyle.text }]}>{vial.currentStatus}</Text>
                                                </View>
                                            </View>

                                            {/* 7. Action Icons (Exact Web logic and tooltips) */}
                                            <View style={styles.actionGroup}>
                                                {/* View Details & Audit History */}
                                                <TouchableOpacity
                                                    style={[styles.btnIcon, styles.btnIconView]}
                                                    onPress={() => handleOpenDetails(vial)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Feather name="eye" size={14} color="#0284c7" />
                                                </TouchableOpacity>

                                                {/* Assign Storage Location (when Received) */}
                                                {vial.currentStatus === 'Received' && (
                                                    <TouchableOpacity
                                                        style={[styles.btnIcon, styles.btnIconStore]}
                                                        onPress={() => handleOpenMove(vial)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Feather name="box" size={14} color="#059669" />
                                                    </TouchableOpacity>
                                                )}

                                                {/* Move & Retrieve (when Stored, Moved, Returned) */}
                                                {['Stored', 'Moved', 'Returned'].includes(vial.currentStatus) && (
                                                    <>
                                                        <TouchableOpacity
                                                            style={[styles.btnIcon, styles.btnIconMove]}
                                                            onPress={() => handleOpenMove(vial)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <Feather name="truck" size={14} color="#7c3aed" />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={[styles.btnIcon, styles.btnIconRetrieve]}
                                                            onPress={() => handleOpenRetrieve(vial)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <Feather name="rotate-ccw" size={14} color="#d97706" />
                                                        </TouchableOpacity>
                                                    </>
                                                )}

                                                {/* Return to Storage (when Retrieved) */}
                                                {vial.currentStatus === 'Retrieved' && (
                                                    <TouchableOpacity
                                                        style={[styles.btnIcon, styles.btnIconReturn]}
                                                        onPress={() => handleOpenReturn(vial)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Feather name="box" size={14} color="#0d9488" />
                                                    </TouchableOpacity>
                                                )}

                                                {/* Mark as Discarded (when not already Discarded) */}
                                                {vial.currentStatus !== 'Discarded' && (
                                                    <TouchableOpacity
                                                        style={[styles.btnIcon, styles.btnIconDiscard]}
                                                        onPress={() => handleOpenDiscard(vial)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Feather name="trash-2" size={14} color="#e11d48" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    )}
                </View>

                {/* Pagination (Exact Web Component styling) */}
                {!loading && totalRecords > 0 && (
                    <View style={styles.paginationWrapper}>
                        <View style={styles.paginationInfo}>
                            <Text style={styles.infoText}>
                                Showing <Text style={styles.infoHighlight}>{startRecord}–{endRecord}</Text> of{' '}
                                <Text style={styles.infoHighlight}>{totalRecords}</Text> vials
                            </Text>
                        </View>

                        <View style={styles.paginationControls}>
                            {/* Previous Button */}
                            <TouchableOpacity
                                style={[styles.pageNavBtn, page <= 1 && styles.pageNavBtnDisabled]}
                                disabled={page <= 1}
                                onPress={() => setPage(p => Math.max(1, p - 1))}
                            >
                                <Text style={[styles.navArrow, page <= 1 && { color: '#cbd5e1' }]}>←</Text>
                                <Text style={[styles.navLabel, page <= 1 && { color: '#cbd5e1' }]}>Previous</Text>
                            </TouchableOpacity>

                            {/* Page Numbers */}
                            <View style={styles.pageNumbers}>
                                {getPageNumbers().map((num, idx) => {
                                    if (num === '...') {
                                        return (
                                            <Text key={`dot-${idx}`} style={styles.pageEllipsis}>…</Text>
                                        );
                                    }
                                    const isCurrent = num === page;
                                    return (
                                        <TouchableOpacity
                                            key={`page-${num}`}
                                            style={[styles.pageBtn, isCurrent && styles.pageBtnActive]}
                                            onPress={() => setPage(num)}
                                        >
                                            <Text style={[styles.pageBtnText, isCurrent && styles.pageBtnTextActive]}>
                                                {num}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Next Button */}
                            <TouchableOpacity
                                style={[styles.pageNavBtn, page >= totalPages && styles.pageNavBtnDisabled]}
                                disabled={page >= totalPages}
                                onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                            >
                                <Text style={[styles.navLabel, page >= totalPages && { color: '#cbd5e1' }]}>Next</Text>
                                <Text style={[styles.navArrow, page >= totalPages && { color: '#cbd5e1' }]}>→</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* ========================================================================= */}
            {/* MODAL 1: REGISTER & STORE PATIENT VIAL */}
            {/* ========================================================================= */}
            <Modal
                visible={showStoreModal}
                transparent
                animationType="fade"
                onRequestClose={() => !actionSubmitting && setShowStoreModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={() => {
                            if (showPatientDropdown) {
                                setShowPatientDropdown(false);
                                return;
                            }
                            if (!actionSubmitting) setShowStoreModal(false);
                        }}
                    />
                    <View style={styles.modal}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="box" size={18} color="#0284c7" />
                                <Text style={styles.modalTitle}>Register & Store Patient Vial</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => !actionSubmitting && setShowStoreModal(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Close Modal"
                            >
                                <Feather name="x" size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {/* Patient Selection Section */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>
                                    Select Patient <Text style={styles.req}>*</Text>
                                </Text>

                                {selectedPatient ? (
                                    <View style={styles.patientSelectedCard}>
                                        <View style={styles.patientSelectedAvatar}>
                                            <Text style={styles.patientSelectedAvatarText}>
                                                {selectedPatient.name?.charAt(0)?.toUpperCase() || 'P'}
                                            </Text>
                                        </View>
                                        <View style={styles.patientSelectedInfo}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Text style={styles.patientSelectedName}>{selectedPatient.name}</Text>
                                                <View style={styles.patientSelectedBadge}>
                                                    <Text style={styles.patientSelectedBadgeText}>Selected</Text>
                                                </View>
                                            </View>
                                            <View style={styles.patientSelectedMeta}>
                                                <Text style={styles.patientMetaText}>
                                                    <Text style={{ fontWeight: '700' }}>MRN / ID: </Text>
                                                    {selectedPatient.mrn || selectedPatient.patientId || selectedPatient.uhid || '—'}
                                                </Text>
                                                <Text style={styles.patientMetaText}>
                                                    <Text style={{ fontWeight: '700' }}>Phone: </Text>
                                                    {selectedPatient.phone || '—'}
                                                </Text>
                                                {selectedPatient.gender ? (
                                                    <Text style={styles.patientMetaText}>
                                                        <Text style={{ fontWeight: '700' }}>Gender: </Text>
                                                        {selectedPatient.gender}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.btnSecondarySmall}
                                            onPress={() => {
                                                setSelectedPatient(null);
                                                setPatientQuery('');
                                                setPatientResults([]);
                                                setShowPatientDropdown(false);
                                            }}
                                            accessibilityRole="button"
                                            accessibilityLabel="Change Patient"
                                        >
                                            <Text style={styles.btnSecondarySmallText}>Change</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View ref={patientSearchContainerRef} style={{ position: 'relative' }}>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="Type patient name, phone, or MRN..."
                                            placeholderTextColor="#94a3b8"
                                            value={patientQuery}
                                            onChangeText={handlePatientSearchChange}
                                            autoFocus={true}
                                        />
                                        {searchingPatients ? (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                                                <ActivityIndicator size="small" color="#0284c7" />
                                                <Text style={{ fontSize: 12, color: '#0284c7' }}>Searching...</Text>
                                            </View>
                                        ) : null}

                                        {Boolean(showPatientDropdown && patientQuery.trim().length > 0) ? (
                                            <View style={styles.patientSearchResults}>
                                                {searchingPatients && patientResults.length === 0 ? (
                                                    <View style={styles.patientEmptyState}>
                                                        <Text style={{ fontSize: 13, color: '#64748b' }}>Searching for "{patientQuery}"...</Text>
                                                    </View>
                                                ) : patientResults.length > 0 ? (
                                                    <>
                                                        <View style={styles.patientResultsHeader}>
                                                            <Text style={styles.patientResultsHeaderText}>
                                                                Found {patientResults.length} Matching Patient(s)
                                                            </Text>
                                                        </View>
                                                        {patientResults.map((p) => (
                                                            <TouchableOpacity
                                                                key={p._id}
                                                                style={styles.patientSearchItem}
                                                                onPress={() => handleSelectPatient(p)}
                                                            >
                                                                <View style={styles.patientItemAvatar}>
                                                                    <Text style={styles.patientItemAvatarText}>
                                                                        {p.name?.charAt(0)?.toUpperCase() || 'P'}
                                                                    </Text>
                                                                </View>
                                                                <View style={styles.patientItemDetails}>
                                                                    <Text style={styles.patientItemName}>{p.name}</Text>
                                                                    <Text style={styles.patientItemMeta}>
                                                                        ID: {p.patientId || p.mrn || p.uhid || '—'} • Phone: {p.phone || '—'}{p.gender ? ` • Gender: ${p.gender}` : ''}
                                                                    </Text>
                                                                </View>
                                                                <TouchableOpacity
                                                                    style={styles.btnPrimarySmall}
                                                                    onPress={() => handleSelectPatient(p)}
                                                                    accessibilityRole="button"
                                                                    accessibilityLabel={`Select ${p.name}`}
                                                                >
                                                                    <Text style={styles.btnPrimarySmallText}>Select</Text>
                                                                </TouchableOpacity>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <View style={styles.patientEmptyState}>
                                                        <Text style={{ fontWeight: '600', color: '#334155', fontSize: 13 }}>
                                                            No patients found matching "{patientQuery}"
                                                        </Text>
                                                        <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                                                            Search by full name, phone number, or patient ID.
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        ) : null}
                                    </View>
                                )}
                            </View>

                            {/* Vial ID & Vial Type */}
                            <View style={styles.formRow}>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>
                                        Vial ID <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 'normal' }}>(Leave blank to auto-generate)</Text>
                                    </Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Leave blank to auto-generate"
                                        placeholderTextColor="#94a3b8"
                                        value={storeForm.vialId}
                                        onChangeText={(t) => setStoreForm({ ...storeForm, vialId: t })}
                                    />
                                </View>

                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>
                                        Vial Type <Text style={styles.req}>*</Text>
                                    </Text>
                                    <DropdownSelect
                                        options={VIAL_TYPES.map(t => ({ label: t, value: t }))}
                                        value={storeForm.vialType}
                                        onChange={(t) => setStoreForm({ ...storeForm, vialType: t })}
                                        placeholder="-- Select Vial Type * --"
                                    />
                                </View>
                            </View>

                            {/* Received Date & Time & Sample Description */}
                            <View style={styles.formRow}>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>
                                        Received Date & Time <Text style={styles.req}>*</Text>
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <View style={{ flex: 3 }}>
                                            <DatePickerInput
                                                value={storeForm.receivedAt ? storeForm.receivedAt.slice(0, 10) : ''}
                                                onChange={(d) => {
                                                    const time = (storeForm.receivedAt && storeForm.receivedAt.includes('T'))
                                                        ? storeForm.receivedAt.slice(11, 16)
                                                        : new Date().toTimeString().slice(0, 5);
                                                    setStoreForm({ ...storeForm, receivedAt: d ? `${d}T${time}` : '' });
                                                }}
                                                placeholder="Received Date"
                                                title="Received Date"
                                            />
                                        </View>
                                        <View style={{ flex: 2 }}>
                                            <TimePickerInput
                                                value={(storeForm.receivedAt && storeForm.receivedAt.includes('T')) ? storeForm.receivedAt.slice(11, 16) : ''}
                                                onChange={(t) => {
                                                    const date = storeForm.receivedAt ? storeForm.receivedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
                                                    setStoreForm({ ...storeForm, receivedAt: `${date}T${t || '00:00'}` });
                                                }}
                                                placeholder="HH:mm"
                                                title="Received Time"
                                            />
                                        </View>
                                    </View>
                                </View>

                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Sample Description</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Enter sample description (Optional)"
                                        placeholderTextColor="#94a3b8"
                                        value={storeForm.description}
                                        onChangeText={(t) => setStoreForm({ ...storeForm, description: t })}
                                    />
                                </View>
                            </View>

                            {/* Hierarchical Storage Location */}
                            <View style={styles.sectionDivider}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                    <Feather name="map-pin" size={14} color="#0284c7" />
                                    <Text style={styles.sectionHeaderTitle}>Hierarchical Storage Location</Text>
                                </View>

                                <View style={styles.formRow}>
                                    <View style={[styles.formGroup, { flex: 1 }]}>
                                        <Text style={styles.formLabel}>Room / Storage Area</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="Enter Room (e.g. Room 102, Cryo Lab)"
                                            placeholderTextColor="#94a3b8"
                                            value={storeForm.room}
                                            onChangeText={(t) => setStoreForm({ ...storeForm, room: t })}
                                        />
                                    </View>
                                    <View style={[styles.formGroup, { flex: 1 }]}>
                                        <Text style={styles.formLabel}>
                                            Storage Unit / Freezer <Text style={styles.req}>*</Text>
                                        </Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="Enter storage unit / freezer"
                                            placeholderTextColor="#94a3b8"
                                            value={storeForm.storageUnit}
                                            onChangeText={(t) => setStoreForm({ ...storeForm, storageUnit: t })}
                                        />
                                    </View>
                                </View>

                                <View style={[styles.formRow, { marginTop: 8 }]}>
                                    <View style={[styles.formGroup, { flex: 1 }]}>
                                        <Text style={styles.formLabel}>Rack</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="Enter rack (Optional)"
                                            placeholderTextColor="#94a3b8"
                                            value={storeForm.rack}
                                            onChangeText={(t) => setStoreForm({ ...storeForm, rack: t })}
                                        />
                                    </View>
                                    <View style={[styles.formGroup, { flex: 1 }]}>
                                        <Text style={styles.formLabel}>Box</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="Enter box (Optional)"
                                            placeholderTextColor="#94a3b8"
                                            value={storeForm.box}
                                            onChangeText={(t) => setStoreForm({ ...storeForm, box: t })}
                                        />
                                    </View>
                                </View>

                                <View style={[styles.formRow, { marginTop: 8 }]}>
                                    <View style={[styles.formGroup, { flex: 1 }]}>
                                        <Text style={styles.formLabel}>Position / Well</Text>
                                        <TextInput
                                            style={styles.formInput}
                                            placeholder="Enter position / well (Optional)"
                                            placeholderTextColor="#94a3b8"
                                            value={storeForm.position}
                                            onChangeText={(t) => setStoreForm({ ...storeForm, position: t })}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Notes */}
                            <View style={[styles.formGroup, { marginTop: 12 }]}>
                                <Text style={styles.formLabel}>Notes</Text>
                                <TextInput
                                    style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                                    multiline
                                    placeholder="Enter intake notes or instructions (Optional)..."
                                    placeholderTextColor="#94a3b8"
                                    value={storeForm.notes}
                                    onChangeText={(t) => setStoreForm({ ...storeForm, notes: t })}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.btnSecondary}
                                disabled={actionSubmitting}
                                onPress={() => setShowStoreModal(false)}
                            >
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.btnPrimary}
                                disabled={actionSubmitting}
                                onPress={handleStoreSubmit}
                            >
                                <Text style={styles.btnPrimaryText}>
                                    {actionSubmitting ? 'Registering...' : 'Register & Store Vial'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL 2: MOVE VIAL */}
            {/* ========================================================================= */}
            <Modal
                visible={showMoveModal}
                transparent
                animationType="fade"
                onRequestClose={() => !actionSubmitting && setShowMoveModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={() => {
                            if (!actionSubmitting) setShowMoveModal(false);
                        }}
                    />
                    <View style={styles.modal}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="truck" size={18} color="#7c3aed" />
                                <Text style={styles.modalTitle}>Move Vial: {activeVial?.vialId}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => !actionSubmitting && setShowMoveModal(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Close Modal"
                            >
                                <Feather name="x" size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {/* Current Location Box */}
                            <View style={styles.infoLocationBox}>
                                <Text style={styles.infoLocationLabel}>Current Location:</Text>
                                <Text style={styles.infoLocationVal}>
                                    {formatLocation(activeVial?.currentLocation) || 'Not assigned'}
                                </Text>
                            </View>

                            <View style={styles.formRow}>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Destination Room / Area</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Enter destination room"
                                        placeholderTextColor="#94a3b8"
                                        value={moveForm.room}
                                        onChangeText={(t) => setMoveForm({ ...moveForm, room: t })}
                                    />
                                </View>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>
                                        Destination Storage Unit <Text style={styles.req}>*</Text>
                                    </Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Enter destination storage unit / freezer"
                                        placeholderTextColor="#94a3b8"
                                        value={moveForm.storageUnit}
                                        onChangeText={(t) => setMoveForm({ ...moveForm, storageUnit: t })}
                                        autoFocus={Platform.OS === 'web'}
                                    />
                                </View>
                            </View>

                            <View style={[styles.formRow, { marginTop: 8 }]}>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Rack</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Enter rack (Optional)"
                                        placeholderTextColor="#94a3b8"
                                        value={moveForm.rack}
                                        onChangeText={(t) => setMoveForm({ ...moveForm, rack: t })}
                                    />
                                </View>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Box</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Enter box (Optional)"
                                        placeholderTextColor="#94a3b8"
                                        value={moveForm.box}
                                        onChangeText={(t) => setMoveForm({ ...moveForm, box: t })}
                                    />
                                </View>
                            </View>

                            <View style={[styles.formRow, { marginTop: 8 }]}>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Position</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Enter position / well (Optional)"
                                        placeholderTextColor="#94a3b8"
                                        value={moveForm.position}
                                        onChangeText={(t) => setMoveForm({ ...moveForm, position: t })}
                                    />
                                </View>
                            </View>

                            <View style={[styles.formGroup, { marginTop: 12 }]}>
                                <Text style={styles.formLabel}>
                                    Reason for Movement <Text style={styles.req}>*</Text>
                                </Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="Enter reason for movement"
                                    placeholderTextColor="#94a3b8"
                                    value={moveForm.reason}
                                    onChangeText={(t) => setMoveForm({ ...moveForm, reason: t })}
                                />
                            </View>

                            <View style={[styles.formGroup, { marginTop: 12 }]}>
                                <Text style={styles.formLabel}>Notes</Text>
                                <TextInput
                                    style={[styles.formInput, { height: 50, textAlignVertical: 'top' }]}
                                    multiline
                                    placeholder="Enter notes (Optional)..."
                                    placeholderTextColor="#94a3b8"
                                    value={moveForm.notes}
                                    onChangeText={(t) => setMoveForm({ ...moveForm, notes: t })}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.btnSecondary}
                                disabled={actionSubmitting}
                                onPress={() => setShowMoveModal(false)}
                            >
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btnPrimary, { backgroundColor: '#7c3aed' }]}
                                disabled={actionSubmitting}
                                onPress={handleMoveSubmit}
                            >
                                <Text style={styles.btnPrimaryText}>
                                    {actionSubmitting ? 'Moving...' : 'Confirm Move'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL 3: RETRIEVE VIAL */}
            {/* ========================================================================= */}
            <Modal
                visible={showRetrieveModal}
                transparent
                animationType="fade"
                onRequestClose={() => !actionSubmitting && setShowRetrieveModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={() => {
                            if (!actionSubmitting) setShowRetrieveModal(false);
                        }}
                    />
                    <View style={styles.modal}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="rotate-ccw" size={18} color="#d97706" />
                                <Text style={styles.modalTitle}>Retrieve Vial: {activeVial?.vialId}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => !actionSubmitting && setShowRetrieveModal(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Close Modal"
                            >
                                <Feather name="x" size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {/* Stored At Box */}
                            <View style={[styles.infoLocationBox, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                                <Text style={[styles.infoLocationLabel, { color: '#92400e' }]}>Stored At:</Text>
                                <Text style={[styles.infoLocationVal, { color: '#78350f' }]}>
                                    {formatLocation(activeVial?.currentLocation) || 'Storage position'}
                                </Text>
                            </View>

                            <View style={[styles.formGroup, { marginTop: 12 }]}>
                                <Text style={styles.formLabel}>
                                    Reason for Retrieval <Text style={styles.req}>*</Text>
                                </Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="Enter reason for retrieval"
                                    placeholderTextColor="#94a3b8"
                                    value={retrieveForm.reason}
                                    onChangeText={(t) => setRetrieveForm({ ...retrieveForm, reason: t })}
                                    autoFocus={true}
                                />
                            </View>

                            <View style={[styles.formGroup, { marginTop: 12 }]}>
                                <Text style={styles.formLabel}>
                                    Retrieval Date & Time <Text style={styles.req}>*</Text>
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <View style={{ flex: 3 }}>
                                        <DatePickerInput
                                            value={retrieveForm.retrievalDate ? retrieveForm.retrievalDate.slice(0, 10) : ''}
                                            onChange={(d) => {
                                                const time = (retrieveForm.retrievalDate && retrieveForm.retrievalDate.includes('T'))
                                                    ? retrieveForm.retrievalDate.slice(11, 16)
                                                    : new Date().toTimeString().slice(0, 5);
                                                setRetrieveForm({ ...retrieveForm, retrievalDate: d ? `${d}T${time}` : '' });
                                            }}
                                            placeholder="Select Date"
                                            title="Retrieval Date"
                                        />
                                    </View>
                                    <View style={{ flex: 2 }}>
                                        <TimePickerInput
                                            value={(retrieveForm.retrievalDate && retrieveForm.retrievalDate.includes('T')) ? retrieveForm.retrievalDate.slice(11, 16) : ''}
                                            onChange={(t) => {
                                                const date = retrieveForm.retrievalDate ? retrieveForm.retrievalDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
                                                setRetrieveForm({ ...retrieveForm, retrievalDate: `${date}T${t || '00:00'}` });
                                            }}
                                            placeholder="HH:mm"
                                            title="Retrieval Time"
                                        />
                                    </View>
                                </View>
                            </View>

                            <View style={[styles.formGroup, { marginTop: 12 }]}>
                                <Text style={styles.formLabel}>Notes</Text>
                                <TextInput
                                    style={[styles.formInput, { height: 50, textAlignVertical: 'top' }]}
                                    multiline
                                    placeholder="Enter notes (Optional)..."
                                    placeholderTextColor="#94a3b8"
                                    value={retrieveForm.notes}
                                    onChangeText={(t) => setRetrieveForm({ ...retrieveForm, notes: t })}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.btnSecondary}
                                disabled={actionSubmitting}
                                onPress={() => setShowRetrieveModal(false)}
                            >
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btnPrimary, { backgroundColor: '#d97706' }]}
                                disabled={actionSubmitting}
                                onPress={handleRetrieveSubmit}
                            >
                                <Text style={styles.btnPrimaryText}>
                                    {actionSubmitting ? 'Retrieving...' : 'Confirm Retrieval'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL 4: RETURN TO STORAGE */}
            {/* ========================================================================= */}
            <Modal
                visible={showReturnModal}
                transparent
                animationType="fade"
                onRequestClose={() => !actionSubmitting && setShowReturnModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={() => {
                            if (!actionSubmitting) setShowReturnModal(false);
                        }}
                    />
                    <View style={styles.modal}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="box" size={18} color="#0d9488" />
                                <Text style={styles.modalTitle}>Return Vial to Storage: {activeVial?.vialId}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => !actionSubmitting && setShowReturnModal(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Close Modal"
                            >
                                <Feather name="x" size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <View style={styles.formRow}>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>
                                        Storage Unit / Freezer <Text style={styles.req}>*</Text>
                                    </Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Enter storage unit / freezer"
                                        placeholderTextColor="#94a3b8"
                                        value={returnForm.storageUnit}
                                        onChangeText={(t) => setReturnForm({ ...returnForm, storageUnit: t })}
                                        autoFocus={true}
                                    />
                                </View>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Rack</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Enter rack (Optional)"
                                        placeholderTextColor="#94a3b8"
                                        value={returnForm.rack}
                                        onChangeText={(t) => setReturnForm({ ...returnForm, rack: t })}
                                    />
                                </View>
                            </View>

                            <View style={[styles.formRow, { marginTop: 8 }]}>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Box</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Enter box (Optional)"
                                        placeholderTextColor="#94a3b8"
                                        value={returnForm.box}
                                        onChangeText={(t) => setReturnForm({ ...returnForm, box: t })}
                                    />
                                </View>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Position</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Enter position / well (Optional)"
                                        placeholderTextColor="#94a3b8"
                                        value={returnForm.position}
                                        onChangeText={(t) => setReturnForm({ ...returnForm, position: t })}
                                    />
                                </View>
                            </View>

                            <View style={[styles.formRow, { marginTop: 8 }]}>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>
                                        Return Date & Time <Text style={styles.req}>*</Text>
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <View style={{ flex: 3 }}>
                                            <DatePickerInput
                                                value={returnForm.returnDate ? returnForm.returnDate.slice(0, 10) : ''}
                                                onChange={(d) => {
                                                    const time = (returnForm.returnDate && returnForm.returnDate.includes('T'))
                                                        ? returnForm.returnDate.slice(11, 16)
                                                        : new Date().toTimeString().slice(0, 5);
                                                    setReturnForm({ ...returnForm, returnDate: d ? `${d}T${time}` : '' });
                                                }}
                                                placeholder="Select Date"
                                                title="Return Date"
                                            />
                                        </View>
                                        <View style={{ flex: 2 }}>
                                            <TimePickerInput
                                                value={(returnForm.returnDate && returnForm.returnDate.includes('T')) ? returnForm.returnDate.slice(11, 16) : ''}
                                                onChange={(t) => {
                                                    const date = returnForm.returnDate ? returnForm.returnDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
                                                    setReturnForm({ ...returnForm, returnDate: `${date}T${t || '00:00'}` });
                                                }}
                                                placeholder="HH:mm"
                                                title="Return Time"
                                            />
                                        </View>
                                    </View>
                                </View>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Notes</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="Enter notes (Optional)"
                                        placeholderTextColor="#94a3b8"
                                        value={returnForm.notes}
                                        onChangeText={(t) => setReturnForm({ ...returnForm, notes: t })}
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.btnSecondary}
                                disabled={actionSubmitting}
                                onPress={() => setShowReturnModal(false)}
                            >
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btnPrimary, { backgroundColor: '#0d9488' }]}
                                disabled={actionSubmitting}
                                onPress={handleReturnSubmit}
                            >
                                <Text style={styles.btnPrimaryText}>
                                    {actionSubmitting ? 'Saving...' : 'Return to Storage'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL 5: DISCARD VIAL */}
            {/* ========================================================================= */}
            <Modal
                visible={showDiscardModal}
                transparent
                animationType="fade"
                onRequestClose={() => !actionSubmitting && setShowDiscardModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={() => {
                            if (!actionSubmitting) setShowDiscardModal(false);
                        }}
                    />
                    <View style={styles.modal}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="trash-2" size={18} color="#dc2626" />
                                <Text style={[styles.modalTitle, { color: '#dc2626' }]}>Mark Vial as Discarded</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => !actionSubmitting && setShowDiscardModal(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Close Modal"
                            >
                                <Feather name="x" size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {/* Danger Banner */}
                            <View style={styles.dangerBanner}>
                                <Feather name="alert-circle" size={22} color="#dc2626" style={{ marginTop: 2 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.dangerBannerTitle}>Deliberate Action Required:</Text>
                                    <Text style={styles.dangerBannerDesc}>
                                        Are you sure you want to mark vial <Text style={{ fontWeight: '700' }}>{activeVial?.vialId}</Text> as discarded?
                                        This action is permanent and will close the vial record. The vial will remain searchable in history.
                                    </Text>
                                </View>
                            </View>

                            <View style={[styles.formGroup, { marginTop: 14 }]}>
                                <Text style={styles.formLabel}>
                                    Discard Reason <Text style={styles.req}>*</Text>
                                </Text>
                                <TextInput
                                    style={styles.formInput}
                                    placeholder="Enter reason for discarding"
                                    placeholderTextColor="#94a3b8"
                                    value={discardForm.discardReason}
                                    onChangeText={(t) => setDiscardForm({ ...discardForm, discardReason: t })}
                                    autoFocus={true}
                                />
                            </View>

                            <View style={[styles.formGroup, { marginTop: 12 }]}>
                                <Text style={styles.formLabel}>
                                    Discard Date & Time <Text style={styles.req}>*</Text>
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <View style={{ flex: 3 }}>
                                        <DatePickerInput
                                            value={discardForm.discardDate ? discardForm.discardDate.slice(0, 10) : ''}
                                            onChange={(d) => {
                                                const time = (discardForm.discardDate && discardForm.discardDate.includes('T'))
                                                    ? discardForm.discardDate.slice(11, 16)
                                                    : new Date().toTimeString().slice(0, 5);
                                                setDiscardForm({ ...discardForm, discardDate: d ? `${d}T${time}` : '' });
                                            }}
                                            placeholder="Select Date"
                                            title="Discard Date"
                                        />
                                    </View>
                                    <View style={{ flex: 2 }}>
                                        <TimePickerInput
                                            value={(discardForm.discardDate && discardForm.discardDate.includes('T')) ? discardForm.discardDate.slice(11, 16) : ''}
                                            onChange={(t) => {
                                                const date = discardForm.discardDate ? discardForm.discardDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
                                                setDiscardForm({ ...discardForm, discardDate: `${date}T${t || '00:00'}` });
                                            }}
                                            placeholder="HH:mm"
                                            title="Discard Time"
                                        />
                                    </View>
                                </View>
                            </View>

                            <View style={[styles.formGroup, { marginTop: 12 }]}>
                                <Text style={styles.formLabel}>Notes</Text>
                                <TextInput
                                    style={[styles.formInput, { height: 50, textAlignVertical: 'top' }]}
                                    multiline
                                    placeholder="Enter notes (Optional)..."
                                    placeholderTextColor="#94a3b8"
                                    value={discardForm.notes}
                                    onChangeText={(t) => setDiscardForm({ ...discardForm, notes: t })}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.btnSecondary}
                                disabled={actionSubmitting}
                                onPress={() => setShowDiscardModal(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Cancel"
                            >
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btnPrimary, { backgroundColor: '#dc2626' }]}
                                disabled={actionSubmitting}
                                onPress={handleDiscardSubmit}
                                accessibilityRole="button"
                                accessibilityLabel="Confirm Discard"
                            >
                                <Text style={styles.btnPrimaryText}>
                                    {actionSubmitting ? 'Discarding...' : 'Confirm Discard'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ========================================================================= */}
            {/* MODAL 6: VIEW VIAL DETAILS & MOVEMENT AUDIT TRAIL */}
            {/* ========================================================================= */}
            <Modal
                visible={showDetailsModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDetailsModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={() => setShowDetailsModal(false)}
                    />
                    <View style={[styles.modal, { maxWidth: 820, width: Math.min(820, windowWidth - 32) }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={styles.modalTitle}>🧪 Vial Details: {activeVial?.vialId}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowDetailsModal(false)}
                                accessibilityRole="button"
                                accessibilityLabel="Close Modal"
                            >
                                <Feather name="x" size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {/* Metadata Details Grid (Exact Web .vm-details-grid) */}
                            <View style={styles.detailsGrid}>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Patient Name</Text>
                                    <Text style={styles.detailVal}>
                                        {activeVial?.patientId?.name || activeVial?.patientSnapshot?.name || '—'}
                                    </Text>
                                </View>

                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>MRN / Patient ID</Text>
                                    <Text style={styles.detailVal}>
                                        {activeVial?.patientId?.mrn || activeVial?.patientId?.patientId || activeVial?.patientSnapshot?.mrn || '—'}
                                    </Text>
                                </View>

                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Vial Type</Text>
                                    <Text style={styles.detailVal}>{activeVial?.vialType || '—'}</Text>
                                </View>

                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Current Status</Text>
                                    <View style={{ marginTop: 2 }}>
                                        <View style={[
                                            styles.statusBadge,
                                            {
                                                backgroundColor: getStatusStyle(activeVial?.currentStatus).bg,
                                                borderColor: getStatusStyle(activeVial?.currentStatus).border,
                                                alignSelf: 'flex-start'
                                            }
                                        ]}>
                                            <Text style={[styles.statusBadgeText, { color: getStatusStyle(activeVial?.currentStatus).text }]}>
                                                {activeVial?.currentStatus}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Current Storage Location</Text>
                                    <Text style={styles.detailVal}>
                                        {formatLocation(activeVial?.currentLocation) || 'Not in storage'}
                                    </Text>
                                </View>

                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Received Date</Text>
                                    <Text style={styles.detailVal}>{formatDateTime(activeVial?.receivedAt)}</Text>
                                </View>

                                <View style={styles.detailItemFull}>
                                    <Text style={styles.detailLabel}>Sample Description</Text>
                                    <Text style={[styles.detailVal, { fontWeight: '400' }]}>
                                        {activeVial?.description || 'No description provided'}
                                    </Text>
                                </View>

                                {activeVial?.notes ? (
                                    <View style={styles.detailItemFull}>
                                        <Text style={styles.detailLabel}>Notes</Text>
                                        <Text style={[styles.detailVal, { fontWeight: '400' }]}>
                                            {activeVial.notes}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            {/* Movement & Audit History (Exact Web .vm-timeline) */}
                            <View style={{ marginTop: 18 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                    <Feather name="clock" size={15} color="#0284c7" />
                                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a' }}>
                                        Movement & Audit History
                                    </Text>
                                </View>

                                {(!activeVial?.auditHistory || activeVial.auditHistory.length === 0) ? (
                                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>No audit history recorded.</Text>
                                ) : (
                                    <View style={styles.timeline}>
                                        {activeVial.auditHistory.map((item, idx) => {
                                            const prevLoc = formatLocation(item.previousLocation);
                                            const newLoc = formatLocation(item.newLocation);

                                            return (
                                                <View key={item._id || idx} style={styles.timelineItem}>
                                                    <View style={styles.timelineNode}>
                                                        <Feather name="check-circle" size={12} color="#0284c7" />
                                                    </View>
                                                    <View style={styles.timelineHeader}>
                                                        <Text style={styles.timelineAction}>{item.action}</Text>
                                                        <Text style={styles.timelineDate}>{formatDateTime(item.timestamp)}</Text>
                                                        <Text style={styles.timelineUser}>
                                                            By: {item.performedByName || 'Hospital Admin'}
                                                        </Text>
                                                    </View>

                                                    {(item.reason || prevLoc || newLoc || item.notes) && (
                                                        <View style={styles.timelineBody}>
                                                            {item.reason ? (
                                                                <Text style={styles.timelineReason}>
                                                                    <Text style={{ fontWeight: '700' }}>Reason: </Text>
                                                                    {item.reason}
                                                                </Text>
                                                            ) : null}
                                                            {prevLoc && newLoc ? (
                                                                <View style={styles.timelineLocationDiff}>
                                                                    <Text style={{ fontSize: 12, color: '#475569' }}>{prevLoc}</Text>
                                                                    <Feather name="arrow-right" size={12} color="#0284c7" style={{ marginHorizontal: 4 }} />
                                                                    <Text style={{ fontSize: 12, color: '#0284c7', fontWeight: '600' }}>{newLoc}</Text>
                                                                </View>
                                                            ) : (!prevLoc && newLoc) ? (
                                                                <Text style={{ fontSize: 12, color: '#0284c7', marginTop: 2 }}>
                                                                    <Text style={{ fontWeight: '700' }}>Location: </Text>
                                                                    {newLoc}
                                                                </Text>
                                                            ) : null}
                                                            {item.notes ? (
                                                                <Text style={styles.timelineNotes}>"{item.notes}"</Text>
                                                            ) : null}
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.btnSecondary}
                                onPress={() => setShowDetailsModal(false)}
                            >
                                <Text style={styles.btnSecondaryText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    mainScrollView: {
        flex: 1,
    },
    toastOverlayContainer: {
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        zIndex: 9999,
        elevation: 9999,
        alignItems: 'center',
    },
    scrollContent: {
        padding: 24,
        maxWidth: 1440,
        alignSelf: 'center',
        width: '100%',
    },

    /* Toast Notification Banner */
    toastBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        maxWidth: 600,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 6,
    },
    toastSuccess: {
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
    },
    toastError: {
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
    },
    toastText: {
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    toastTextSuccess: {
        color: '#166534',
    },
    toastTextError: {
        color: '#991b1b',
    },

    /* 1. Header (Exact Web .vm-header) */
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        marginBottom: 24,
        flexWrap: 'wrap',
    },
    headerLeft: {
        flex: 1,
        minWidth: 260,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#64748b',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    btnPrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0284c7',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        elevation: 2,
        shadowColor: '#0284c7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    btnPrimaryText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    btnSecondary: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    btnSecondaryText: {
        color: '#475569',
        fontSize: 14,
        fontWeight: '600',
    },

    /* 2. Stats Grid (Exact Web .vm-stats-grid) */
    statsGrid: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
        flexWrap: 'wrap',
    },
    statCard: {
        flex: 1,
        minWidth: 200,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        paddingVertical: 18,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
    },
    statIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statInfo: {
        flexDirection: 'column',
    },
    statVal: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0f172a',
        lineHeight: 28,
    },
    statLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#64748b',
        marginTop: 2,
    },

    /* 3. Filter Bar (Exact Web .vm-filter-card) */
    filterCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 20,
        marginBottom: 20,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
    },
    searchBox: {
        flex: 1,
        minWidth: 220,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 42,
    },
    searchInput: {
        flex: 1,
        fontSize: 13.5,
        color: '#1e293b',
        paddingVertical: 0,
    },
    dateFilterGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    datePrefix: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    filterResetBtn: {
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        backgroundColor: '#f8fafc',
    },
    filterResetText: {
        color: '#64748b',
        fontSize: 13,
        fontWeight: '600',
    },

    /* 4. Table Card (Exact Web .vm-table-card) */
    tableCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 20,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
    },
    tableWrapper: {
        width: '100%',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 14,
        paddingHorizontal: 18,
        alignItems: 'center',
    },
    th: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    vialIdBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f9ff',
        borderWidth: 1,
        borderColor: '#bae6fd',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    vialIdText: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontWeight: '700',
        fontSize: 13,
        color: '#0369a1',
    },
    patientName: {
        fontWeight: '700',
        color: '#0f172a',
        fontSize: 14,
    },
    patientMrn: {
        fontSize: 12,
        color: '#64748b',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        marginTop: 2,
    },
    vialTypeText: {
        fontWeight: '600',
        color: '#334155',
        fontSize: 13.5,
    },
    receivedDateText: {
        color: '#475569',
        fontSize: 13,
    },
    locationTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    locationTagText: {
        color: '#334155',
        fontSize: 12,
        fontWeight: '600',
    },
    locationEmptyText: {
        color: '#94a3b8',
        fontStyle: 'italic',
        fontSize: 12,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 9999,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    actionGroup: {
        width: 150,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 6,
    },
    btnIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnIconView: {
        borderColor: '#bae6fd',
    },
    btnIconStore: {
        borderColor: '#a7f3d0',
    },
    btnIconMove: {
        borderColor: '#ddd6fe',
    },
    btnIconRetrieve: {
        borderColor: '#fde68a',
    },
    btnIconReturn: {
        borderColor: '#99f6e4',
    },
    btnIconDiscard: {
        borderColor: '#fecdd3',
    },

    /* States */
    stateBox: {
        paddingVertical: 60,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stateTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#334155',
        marginTop: 10,
        marginBottom: 6,
    },
    stateSubtitle: {
        fontSize: 13,
        color: '#64748b',
        maxWidth: 400,
        textAlign: 'center',
    },

    /* Pagination (Exact Web Pagination.css) */
    paginationWrapper: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        flexWrap: 'wrap',
        gap: 12,
    },
    paginationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoText: {
        fontSize: 13,
        color: '#64748b',
    },
    infoHighlight: {
        fontWeight: '700',
        color: '#0f172a',
    },
    paginationControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    pageNavBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
    },
    pageNavBtnDisabled: {
        opacity: 0.4,
    },
    navArrow: {
        fontSize: 13,
        color: '#1e293b',
        fontWeight: '700',
    },
    navLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
    },
    pageNumbers: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    pageBtn: {
        minWidth: 32,
        height: 32,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    pageBtnActive: {
        backgroundColor: '#0284c7',
        borderColor: '#0284c7',
    },
    pageBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    pageBtnTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    pageEllipsis: {
        fontSize: 14,
        color: '#94a3b8',
        paddingHorizontal: 4,
    },

    /* Modals (Exact Web .vm-modal) */
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modal: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        width: '100%',
        maxWidth: 600,
        maxHeight: '88%',
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 25 },
        shadowOpacity: 0.25,
        shadowRadius: 50,
    },
    modalHeader: {
        paddingVertical: 18,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
    },
    modalBody: {
        padding: 24,
    },
    modalFooter: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },

    /* Form Inputs */
    formGroup: {
        marginBottom: 14,
    },
    formRow: {
        flexDirection: 'row',
        gap: 12,
    },
    formLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    req: {
        color: '#e11d48',
        fontWeight: '700',
    },
    formInput: {
        width: '100%',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        fontSize: 14,
        color: '#1e293b',
        backgroundColor: '#f8fafc',
    },

    /* Patient Search inside Modal */
    patientSelectedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        borderRadius: 12,
        padding: 12,
    },
    patientSelectedAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#dcfce7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    patientSelectedAvatarText: {
        fontWeight: '800',
        color: '#166534',
        fontSize: 16,
    },
    patientSelectedInfo: {
        flex: 1,
    },
    patientSelectedName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    patientSelectedBadge: {
        backgroundColor: '#dcfce7',
        borderRadius: 6,
        paddingVertical: 2,
        paddingHorizontal: 6,
    },
    patientSelectedBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#166534',
    },
    patientSelectedMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 4,
    },
    patientMetaText: {
        fontSize: 12,
        color: '#64748b',
    },
    btnSecondarySmall: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
    },
    btnSecondarySmallText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    patientSearchResults: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        marginTop: 4,
        maxHeight: 200,
        elevation: 4,
    },
    patientResultsHeader: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    patientResultsHeaderText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    patientSearchItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    patientItemAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#e0f2fe',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    patientItemAvatarText: {
        fontWeight: '700',
        color: '#0284c7',
        fontSize: 13,
    },
    patientItemDetails: {
        flex: 1,
    },
    patientItemName: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#0f172a',
    },
    patientItemMeta: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 1,
    },
    btnPrimarySmall: {
        backgroundColor: '#0284c7',
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    btnPrimarySmallText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '700',
    },
    patientEmptyState: {
        padding: 16,
        alignItems: 'center',
    },

    /* Section Divider */
    sectionDivider: {
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 14,
        marginTop: 6,
    },
    sectionHeaderTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },

    /* Info Location Box in Move/Retrieve Modals */
    infoLocationBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 14,
    },
    infoLocationLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    infoLocationVal: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0f172a',
        marginTop: 2,
    },

    /* Danger Banner in Discard Modal */
    dangerBanner: {
        flexDirection: 'row',
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 10,
        padding: 14,
        gap: 12,
    },
    dangerBannerTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#991b1b',
    },
    dangerBannerDesc: {
        fontSize: 12.5,
        color: '#991b1b',
        marginTop: 4,
        lineHeight: 18,
    },

    /* Details Grid */
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    detailItem: {
        width: '48%',
        marginBottom: 6,
    },
    detailItemFull: {
        width: '100%',
        marginTop: 4,
    },
    detailLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    detailVal: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#0f172a',
        marginTop: 2,
    },

    /* Timeline in Details Modal */
    timeline: {
        borderLeftWidth: 2,
        borderLeftColor: '#e2e8f0',
        marginLeft: 8,
        paddingLeft: 16,
    },
    timelineItem: {
        marginBottom: 16,
        position: 'relative',
    },
    timelineNode: {
        position: 'absolute',
        left: -23,
        top: 2,
        backgroundColor: '#ffffff',
        borderRadius: 8,
    },
    timelineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    timelineAction: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#0f172a',
    },
    timelineDate: {
        fontSize: 12,
        color: '#64748b',
    },
    timelineUser: {
        fontSize: 12,
        color: '#64748b',
    },
    timelineBody: {
        marginTop: 6,
    },
    timelineReason: {
        fontSize: 12.5,
        color: '#334155',
    },
    timelineLocationDiff: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    timelineNotes: {
        fontSize: 12,
        color: '#64748b',
        fontStyle: 'italic',
        marginTop: 4,
    },
});

export default VialManagement;
