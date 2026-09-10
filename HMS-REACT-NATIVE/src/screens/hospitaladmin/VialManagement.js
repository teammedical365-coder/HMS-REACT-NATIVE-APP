import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    StyleSheet, ActivityIndicator, Alert, Modal, Dimensions, Platform
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
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
    // Data State
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

    // Forms
    const [storeForm, setStoreForm] = useState({
        vialId: '',
        vialType: 'Biological Sample',
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

    const [moveForm, setMoveForm] = useState({
        room: '',
        storageUnit: '',
        rack: '',
        box: '',
        position: '',
        reason: '',
        notes: ''
    });

    const [retrieveForm, setRetrieveForm] = useState({
        reason: '',
        retrievalDate: new Date().toISOString().slice(0, 16),
        notes: ''
    });

    const [returnForm, setReturnForm] = useState({
        room: '',
        storageUnit: '',
        rack: '',
        box: '',
        position: '',
        returnDate: new Date().toISOString().slice(0, 16),
        notes: ''
    });

    const [discardForm, setDiscardForm] = useState({
        discardReason: '',
        discardDate: new Date().toISOString().slice(0, 16),
        notes: ''
    });

    const showToast = (msg, isError = false) => {
        if (isError) {
            setError(msg);
            setTimeout(() => setError(null), 4000);
        } else {
            setSuccessMessage(msg);
            setTimeout(() => setSuccessMessage(null), 4000);
        }
    };

    // Fetch Stats
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

    // Fetch Vials
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
            }
        } catch (err) {
            console.error('Error fetching vials:', err);
            setError(err?.response?.data?.message || 'Unable to load vial information.');
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

    // Live Patient Search
    const handlePatientSearchChange = (query) => {
        setPatientQuery(query);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

        const trimmed = query.trim();
        if (!trimmed) {
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
        }, 300);
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
            vialType: 'Biological Sample',
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

    // Store Submit
    const handleStoreSubmit = async () => {
        if (!selectedPatient) {
            Alert.alert('Validation', 'Please search and select a patient first');
            return;
        }
        if (!storeForm.storageUnit || !storeForm.storageUnit.trim()) {
            Alert.alert('Validation', 'Storage Unit / Freezer name is required');
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
            Alert.alert('Error', err?.response?.data?.message || 'Error registering vial');
        } finally {
            setActionSubmitting(false);
        }
    };

    // Move Submit
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

    // Retrieve Submit
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

    // Return Submit
    const handleOpenReturn = (vial) => {
        setActiveVial(vial);
        let lastLoc = {};
        if (Array.isArray(vial.auditHistory)) {
            const lastStoredOrMoved = [...vial.auditHistory].reverse().find(a => a.previousLocation && a.previousLocation.storageUnit);
            if (lastStoredOrMoved) lastLoc = lastStoredOrMoved.previousLocation;
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
            Alert.alert('Validation', 'Storage Unit is required to return vial');
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

    // Discard Submit
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
            Alert.alert('Validation', 'Please enter a discard reason (at least 3 characters)');
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

    // Details Modal
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
            setActiveVial(vial);
            setShowDetailsModal(true);
        }
    };

    const formatLocation = (loc) => {
        if (!loc || !loc.storageUnit) return 'Unassigned';
        const parts = [];
        if (loc.room) parts.push(loc.room);
        if (loc.storageUnit) parts.push(loc.storageUnit);
        if (loc.rack) parts.push(`Rack ${loc.rack}`);
        if (loc.box) parts.push(`Box ${loc.box}`);
        if (loc.position) parts.push(`Pos ${loc.position}`);
        return parts.join(' → ');
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
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

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
            {/* Header */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1, minWidth: 260 }}>
                    <Text style={styles.title}>🧪 Vial & Specimen Workspace</Text>
                    <Text style={styles.subtitle}>Track, store, move, retrieve, and audit biological patient vials.</Text>
                </View>
                <TouchableOpacity style={styles.storeBtn} onPress={handleOpenStoreModal} activeOpacity={0.8}>
                    <Feather name="plus" size={16} color="#fff" />
                    <Text style={styles.storeBtnText}>+ Store Vial</Text>
                </TouchableOpacity>
            </View>

            {/* Success & Error alerts */}
            {successMessage && (
                <View style={[styles.alertBanner, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                    <Feather name="check-circle" size={16} color="#16a34a" />
                    <Text style={{ color: '#166534', fontWeight: '600', fontSize: 13 }}>{successMessage}</Text>
                </View>
            )}
            {error && (
                <View style={[styles.alertBanner, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                    <Feather name="alert-triangle" size={16} color="#ef4444" />
                    <Text style={{ color: '#991b1b', fontWeight: '600', fontSize: 13 }}>{error}</Text>
                </View>
            )}

            {/* 4 KPI Stat Cards */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderLeftColor: '#3b82f6' }]}>
                    <View style={styles.statHeader}>
                        <Text style={styles.statLabel}>Total Vials</Text>
                        <Feather name="box" size={18} color="#3b82f6" />
                    </View>
                    <Text style={styles.statValue}>{stats.totalVials || 0}</Text>
                    <Text style={styles.statSub}>● All registered specimens</Text>
                </View>

                <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}>
                    <View style={styles.statHeader}>
                        <Text style={styles.statLabel}>Currently Stored</Text>
                        <Feather name="check-circle" size={18} color="#10b981" />
                    </View>
                    <Text style={styles.statValue}>{stats.currentlyStored || 0}</Text>
                    <Text style={styles.statSub}>● In freezers / racks</Text>
                </View>

                <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
                    <View style={styles.statHeader}>
                        <Text style={styles.statLabel}>Retrieved</Text>
                        <Feather name="truck" size={18} color="#f59e0b" />
                    </View>
                    <Text style={styles.statValue}>{stats.retrievedCount || 0}</Text>
                    <Text style={styles.statSub}>● Out for analysis</Text>
                </View>

                <View style={[styles.statCard, { borderLeftColor: '#ef4444' }]}>
                    <View style={styles.statHeader}>
                        <Text style={styles.statLabel}>Discarded</Text>
                        <Feather name="trash-2" size={18} color="#ef4444" />
                    </View>
                    <Text style={styles.statValue}>{stats.discardedCount || 0}</Text>
                    <Text style={styles.statSub}>● Expired or disposed</Text>
                </View>
            </View>

            {/* Filters Bar (Full Web Parity) */}
            <View style={styles.filterCard}>
                <View style={styles.filterRow}>
                    <View style={styles.searchBox}>
                        <Feather name="search" size={16} color="#94a3b8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by Vial ID, Patient, MRN..."
                            value={searchTerm}
                            onChangeText={(val) => { setSearchTerm(val); setPage(1); }}
                        />
                        {searchTerm ? (
                            <TouchableOpacity onPress={() => { setSearchTerm(''); setPage(1); }}>
                                <Feather name="x" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    <View style={styles.searchBox}>
                        <Feather name="layers" size={16} color="#94a3b8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Storage Unit..."
                            value={storageUnitFilter}
                            onChangeText={(val) => { setStorageUnitFilter(val); setPage(1); }}
                        />
                        {storageUnitFilter ? (
                            <TouchableOpacity onPress={() => { setStorageUnitFilter(''); setPage(1); }}>
                                <Feather name="x" size={16} color="#94a3b8" />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                {/* Dropdown Filters (Matching Web vm-select) */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                    <View style={{ flex: 1, minWidth: 180 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Vial Type</Text>
                        <DropdownSelect 
                            options={['All', ...VIAL_TYPES].map(t => ({ label: t === 'All' ? 'All Vial Types' : t, value: t }))}
                            value={selectedType}
                            onChange={v => { setSelectedType(v); setPage(1); }}
                            placeholder="All Vial Types"
                        />
                    </View>
                    <View style={{ flex: 1, minWidth: 180 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>Status</Text>
                        <DropdownSelect 
                            options={STATUS_OPTIONS.map(s => ({ label: s === 'All' ? 'All Statuses' : s, value: s }))}
                            value={selectedStatus}
                            onChange={v => { setSelectedStatus(v); setPage(1); }}
                            placeholder="All Statuses"
                        />
                    </View>
                </View>


                {/* Date Filter & Clear Controls */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>From</Text>
                        <View style={{ width: 140 }}>
                            <DatePickerInput
                                value={startDate}
                                onChange={(d) => { setStartDate(d); setPage(1); }}
                                placeholder="From Date"
                                title="Received Date From"
                            />
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>To</Text>
                        <View style={{ width: 140 }}>
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
                            <Feather name="rotate-ccw" size={13} color="#64748b" />
                            <Text style={styles.resetBtnText}>Clear Filters</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Vials Table / List */}
            {loading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#2563eb" />
                    <Text style={{ color: '#64748b', marginTop: 12, fontSize: 14 }}>Loading vial records...</Text>
                </View>
            ) : vials.length === 0 ? (
                <View style={styles.emptyCard}>
                    <Feather name="inbox" size={44} color="#94a3b8" />
                    <Text style={styles.emptyTitle}>No Vials Found</Text>
                    <Text style={styles.emptyDesc}>No vials match your search filters or no vials have been stored yet.</Text>
                    <TouchableOpacity style={[styles.storeBtn, { marginTop: 16 }]} onPress={handleOpenStoreModal}>
                        <Text style={styles.storeBtnText}>+ Store New Vial</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.tableCard}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.th, { width: 140 }]}>Vial ID</Text>
                        <Text style={[styles.th, { width: 160 }]}>Patient</Text>
                        <Text style={[styles.th, { width: 150 }]}>Type</Text>
                        <Text style={[styles.th, { flex: 1, minWidth: 160 }]}>Current Location</Text>
                        <Text style={[styles.th, { width: 110 }]}>Status</Text>
                        <Text style={[styles.th, { width: 150, textAlign: 'right' }]}>Actions</Text>
                    </View>

                    {vials.map(vial => {
                        const stStyle = getStatusStyle(vial.status);
                        const patientName = vial.patientId?.name || (vial.patientSnapshot?.name) || 'Unknown';
                        const patientUhid = vial.patientId?.uhid || (vial.patientSnapshot?.uhid) || '';

                        return (
                            <View key={vial._id} style={styles.tableRow}>
                                <View style={{ width: 140 }}>
                                    <Text style={styles.vialCode} numberOfLines={1}>{vial.vialId || vial._id.slice(-8)}</Text>
                                    <Text style={styles.vialDate}>{formatDate(vial.receivedAt)}</Text>
                                </View>

                                <View style={{ width: 160 }}>
                                    <Text style={styles.patientName} numberOfLines={1}>{patientName}</Text>
                                    {patientUhid ? <Text style={styles.patientUhid}>UHID: {patientUhid}</Text> : null}
                                </View>

                                <View style={{ width: 150 }}>
                                    <Text style={styles.vialType} numberOfLines={1}>{vial.vialType}</Text>
                                </View>

                                <View style={{ flex: 1, minWidth: 160 }}>
                                    <Text style={styles.locationText} numberOfLines={1}>
                                        {formatLocation(vial.currentLocation)}
                                    </Text>
                                </View>

                                <View style={{ width: 110 }}>
                                    <View style={[styles.statusBadge, { backgroundColor: stStyle.bg, borderColor: stStyle.border }]}>
                                        <Text style={[styles.statusText, { color: stStyle.text }]}>{vial.status}</Text>
                                    </View>
                                </View>

                                {/* Row Actions */}
                                <View style={styles.rowActions}>
                                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleOpenDetails(vial)} title="Details">
                                        <Feather name="eye" size={15} color="#2563eb" />
                                    </TouchableOpacity>

                                    {(vial.status === 'Stored' || vial.status === 'Moved') && (
                                        <>
                                            <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleOpenMove(vial)} title="Move">
                                                <Feather name="arrow-right" size={15} color="#7c3aed" />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleOpenRetrieve(vial)} title="Retrieve">
                                                <Feather name="truck" size={15} color="#d97706" />
                                            </TouchableOpacity>
                                        </>
                                    )}

                                    {vial.status === 'Retrieved' && (
                                        <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleOpenReturn(vial)} title="Return">
                                            <Feather name="rotate-ccw" size={15} color="#059669" />
                                        </TouchableOpacity>
                                    )}

                                    {vial.status !== 'Discarded' && (
                                        <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleOpenDiscard(vial)} title="Discard">
                                            <Feather name="trash-2" size={15} color="#dc2626" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        );
                    })}

                    {/* Server-Side Pagination Bar */}
                    <View style={styles.paginationBar}>
                        <Text style={styles.pageInfo}>
                            Showing Page {pagination.currentPage || 1} of {pagination.totalPages || 1} ({pagination.totalRecords || vials.length} Vials)
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                                disabled={page <= 1}
                                onPress={() => setPage(p => Math.max(1, p - 1))}
                            >
                                <Feather name="chevron-left" size={16} color={page <= 1 ? '#cbd5e1' : '#1e293b'} />
                                <Text style={[styles.pageBtnText, page <= 1 && { color: '#cbd5e1' }]}>Previous</Text>
                            </TouchableOpacity>

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

            {/* ==================== STORE MODAL ==================== */}
            <Modal visible={showStoreModal} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="box" size={20} color="#2563eb" />
                                <Text style={styles.modalTitle}>Store New Biological Vial</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowStoreModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
                            {/* Live Patient Search */}
                            <Text style={styles.inputLabel}>Select Patient *</Text>
                            {selectedPatient ? (
                                <View style={styles.selectedPatientPill}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 14, color: '#0f172a' }}>{selectedPatient.name}</Text>
                                        <Text style={{ fontSize: 12, color: '#64748b' }}>UHID: {selectedPatient.uhid} • Phone: {selectedPatient.phone || 'N/A'}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setSelectedPatient(null)}>
                                        <Feather name="x-circle" size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="Type patient name, phone, or UHID..."
                                        value={patientQuery}
                                        onChangeText={handlePatientSearchChange}
                                    />
                                    {searchingPatients && (
                                        <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 8 }} />
                                    )}
                                    {patientResults.length > 0 && (
                                        <View style={styles.patientSearchResults}>
                                            {patientResults.map(p => (
                                                <TouchableOpacity
                                                    key={p._id}
                                                    style={styles.patientSearchItem}
                                                    onPress={() => handleSelectPatient(p)}
                                                >
                                                    <Text style={{ fontWeight: '600', color: '#1e293b' }}>{p.name}</Text>
                                                    <Text style={{ fontSize: 12, color: '#64748b' }}>UHID: {p.uhid} | {p.phone || 'No phone'}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Vial Type */}
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Vial Type *</Text>
                            <DropdownSelect 
                                options={VIAL_TYPES.map(vt => ({ label: vt, value: vt }))}
                                value={storeForm.vialType}
                                onChange={vt => setStoreForm({ ...storeForm, vialType: vt })}
                                placeholder="-- Select Vial Type * --"
                            />

                            {/* Initial Status */}
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Initial Status *</Text>
                            <DropdownSelect 
                                options={[
                                    { label: 'Stored (Directly to Storage Unit)', value: 'Stored' },
                                    { label: 'Received (Pending Storage)', value: 'Received' }
                                ]}
                                value={storeForm.initialStatus}
                                onChange={st => setStoreForm({ ...storeForm, initialStatus: st })}
                                placeholder="Select Initial Status"
                            />


                            {/* Vial ID / Barcode */}
                            <Text style={styles.inputLabel}>Vial Barcode / Label ID (Optional)</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="e.g. VIAL-2026-001 (Auto-generated if blank)"
                                value={storeForm.vialId}
                                onChangeText={t => setStoreForm({ ...storeForm, vialId: t })}
                            />

                            {/* Received Date */}
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Received Date *</Text>
                            <DatePickerInput
                                value={storeForm.receivedAt ? storeForm.receivedAt.slice(0, 10) : ''}
                                onChange={d => setStoreForm({ ...storeForm, receivedAt: d })}
                                placeholder="Select Received Date"
                                title="Received Date"
                            />

                            {/* Storage Location Grid */}
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Storage Location</Text>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subInputLabel}>Storage Unit / Freezer *</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. Freezer A"
                                        value={storeForm.storageUnit}
                                        onChangeText={t => setStoreForm({ ...storeForm, storageUnit: t })}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subInputLabel}>Room</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. Lab 102"
                                        value={storeForm.room}
                                        onChangeText={t => setStoreForm({ ...storeForm, room: t })}
                                    />
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subInputLabel}>Rack</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. 03"
                                        value={storeForm.rack}
                                        onChangeText={t => setStoreForm({ ...storeForm, rack: t })}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subInputLabel}>Box</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. B-12"
                                        value={storeForm.box}
                                        onChangeText={t => setStoreForm({ ...storeForm, box: t })}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.subInputLabel}>Position</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        placeholder="e.g. D4"
                                        value={storeForm.position}
                                        onChangeText={t => setStoreForm({ ...storeForm, position: t })}
                                    />
                                </View>
                            </View>

                            {/* Description / Notes */}
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Notes / Specimen Details</Text>
                            <TextInput
                                style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
                                multiline
                                placeholder="Any clinical notes, temperature requirements, etc."
                                value={storeForm.notes}
                                onChangeText={t => setStoreForm({ ...storeForm, notes: t })}
                            />
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowStoreModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleStoreSubmit} disabled={actionSubmitting}>
                                <Text style={styles.modalSubmitText}>{actionSubmitting ? 'Storing...' : 'Save & Store Vial'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ==================== MOVE MODAL ==================== */}
            <Modal visible={showMoveModal} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="arrow-right" size={20} color="#7c3aed" />
                                <Text style={styles.modalTitle}>Move Vial to New Location</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowMoveModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>
                            Vial: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{activeVial?.vialId || activeVial?._id}</Text> • Current: {formatLocation(activeVial?.currentLocation)}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Destination Storage Unit *</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. Deep Freezer 02"
                                    value={moveForm.storageUnit}
                                    onChangeText={t => setMoveForm({ ...moveForm, storageUnit: t })}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Room</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. Basement Cold Storage"
                                    value={moveForm.room}
                                    onChangeText={t => setMoveForm({ ...moveForm, room: t })}
                                />
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Rack</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. 05"
                                    value={moveForm.rack}
                                    onChangeText={t => setMoveForm({ ...moveForm, rack: t })}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Box</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. C-1"
                                    value={moveForm.box}
                                    onChangeText={t => setMoveForm({ ...moveForm, box: t })}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Position</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="e.g. A2"
                                    value={moveForm.position}
                                    onChangeText={t => setMoveForm({ ...moveForm, position: t })}
                                />
                            </View>
                        </View>

                        <Text style={[styles.inputLabel, { marginTop: 14 }]}>Reason for Movement</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Routine freezer defrosting / reorganization"
                            value={moveForm.reason}
                            onChangeText={t => setMoveForm({ ...moveForm, reason: t })}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowMoveModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: '#7c3aed' }]} onPress={handleMoveSubmit} disabled={actionSubmitting}>
                                <Text style={styles.modalSubmitText}>{actionSubmitting ? 'Moving...' : 'Confirm Movement'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ==================== RETRIEVE MODAL ==================== */}
            <Modal visible={showRetrieveModal} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="truck" size={20} color="#d97706" />
                                <Text style={styles.modalTitle}>Retrieve Vial from Storage</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowRetrieveModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>
                            Vial: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{activeVial?.vialId || activeVial?._id}</Text>
                        </Text>

                        <Text style={styles.inputLabel}>Reason for Retrieval *</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Pathology review, clinical test, doctor requisition"
                            value={retrieveForm.reason}
                            onChangeText={t => setRetrieveForm({ ...retrieveForm, reason: t })}
                        />

                        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Notes</Text>
                        <TextInput
                            style={[styles.modalInput, { height: 60 }]}
                            placeholder="Additional instructions..."
                            value={retrieveForm.notes}
                            onChangeText={t => setRetrieveForm({ ...retrieveForm, notes: t })}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowRetrieveModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: '#d97706' }]} onPress={handleRetrieveSubmit} disabled={actionSubmitting}>
                                <Text style={styles.modalSubmitText}>{actionSubmitting ? 'Retrieving...' : 'Confirm Retrieval'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ==================== RETURN MODAL ==================== */}
            <Modal visible={showReturnModal} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="rotate-ccw" size={20} color="#059669" />
                                <Text style={styles.modalTitle}>Return Vial to Storage</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowReturnModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Destination Storage Unit *</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Freezer 01"
                            value={returnForm.storageUnit}
                            onChangeText={t => setReturnForm({ ...returnForm, storageUnit: t })}
                        />

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Rack</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Rack"
                                    value={returnForm.rack}
                                    onChangeText={t => setReturnForm({ ...returnForm, rack: t })}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.subInputLabel}>Position</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Pos"
                                    value={returnForm.position}
                                    onChangeText={t => setReturnForm({ ...returnForm, position: t })}
                                />
                            </View>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowReturnModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: '#059669' }]} onPress={handleReturnSubmit} disabled={actionSubmitting}>
                                <Text style={styles.modalSubmitText}>{actionSubmitting ? 'Returning...' : 'Return to Storage'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ==================== DISCARD MODAL ==================== */}
            <Modal visible={showDiscardModal} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="trash-2" size={20} color="#dc2626" />
                                <Text style={[styles.modalTitle, { color: '#dc2626' }]}>Discard Biological Specimen</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowDiscardModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>
                            Are you sure you want to mark vial <Text style={{ fontWeight: '700', color: '#0f172a' }}>{activeVial?.vialId || activeVial?._id}</Text> as discarded?
                        </Text>

                        <Text style={styles.inputLabel}>Discard Reason *</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Expired stability window, biohazard disposal"
                            value={discardForm.discardReason}
                            onChangeText={t => setDiscardForm({ ...discardForm, discardReason: t })}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowDiscardModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: '#dc2626' }]} onPress={handleDiscardSubmit} disabled={actionSubmitting}>
                                <Text style={styles.modalSubmitText}>{actionSubmitting ? 'Discarding...' : 'Confirm Discard'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ==================== DETAILS MODAL WITH AUDIT TRAIL ==================== */}
            <Modal visible={showDetailsModal} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { maxWidth: 640 }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="file-text" size={20} color="#2563eb" />
                                <Text style={styles.modalTitle}>Vial Audit Details</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 480 }}>
                            <View style={styles.detailGrid}>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Vial Code</Text>
                                    <Text style={styles.detailVal}>{activeVial?.vialId || activeVial?._id}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Patient</Text>
                                    <Text style={styles.detailVal}>{activeVial?.patientId?.name || activeVial?.patientSnapshot?.name || 'N/A'}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Vial Type</Text>
                                    <Text style={styles.detailVal}>{activeVial?.vialType || 'N/A'}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={styles.detailLabel}>Current Status</Text>
                                    <Text style={[styles.detailVal, { fontWeight: '800', color: '#2563eb' }]}>{activeVial?.status}</Text>
                                </View>
                                <View style={styles.detailItemFull}>
                                    <Text style={styles.detailLabel}>Location</Text>
                                    <Text style={styles.detailVal}>{formatLocation(activeVial?.currentLocation)}</Text>
                                </View>
                            </View>

                            {/* Audit History Timeline */}
                            <Text style={[styles.inputLabel, { marginTop: 18, marginBottom: 10 }]}>Audit History</Text>
                            {Array.isArray(activeVial?.auditHistory) && activeVial.auditHistory.length > 0 ? (
                                activeVial.auditHistory.map((item, idx) => (
                                    <View key={idx} style={styles.auditRow}>
                                        <View style={styles.auditDot} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.auditAction}>{item.action || 'Updated'}</Text>
                                            <Text style={styles.auditMeta}>
                                                {formatDate(item.timestamp)} • {item.performedBy?.name || 'Staff'}
                                            </Text>
                                            {item.reason ? <Text style={styles.auditReason}>Reason: {item.reason}</Text> : null}
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <Text style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>No historical movements recorded yet.</Text>
                            )}
                        </ScrollView>

                        <View style={[styles.modalActions, { justifyContent: 'flex-end' }]}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowDetailsModal(false)}>
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
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
    title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
    subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
    storeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, elevation: 2 },
    storeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
    statsRow: { flexDirection: 'row', gap: 14, marginBottom: 20, flexWrap: 'wrap' },
    statCard: { flex: 1, minWidth: 150, backgroundColor: '#fff', padding: 16, borderRadius: 12, borderLeftWidth: 4, elevation: 1, borderWidth: 1, borderColor: '#e2e8f0' },
    statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    statValue: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginTop: 6 },
    statSub: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
    filterCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 20, elevation: 1, borderWidth: 1, borderColor: '#e2e8f0' },
    filterRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
    searchBox: { flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f1f5f9', paddingHorizontal: 12, borderRadius: 8, height: 42, borderWidth: 1, borderColor: '#e2e8f0' },
    searchInput: { flex: 1, fontSize: 14, color: '#0f172a' },
    pillBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    pillBtnActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
    pillBtnText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    pillBtnTextActive: { color: '#2563eb', fontWeight: '700' },
    resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    resetBtnText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    emptyCard: { backgroundColor: '#fff', padding: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginTop: 16 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 12 },
    emptyDesc: { fontSize: 13, color: '#64748b', marginTop: 4, textAlign: 'center', maxWidth: 400 },
    tableCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0', elevation: 1 },
    tableHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 12, paddingHorizontal: 16 },
    th: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    vialCode: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    vialDate: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    patientName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    patientUhid: { fontSize: 11, color: '#64748b', marginTop: 1 },
    vialType: { fontSize: 13, color: '#475569' },
    locationText: { fontSize: 13, color: '#334155' },
    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, alignSelf: 'flex-start' },
    statusText: { fontSize: 11, fontWeight: '700' },
    rowActions: { width: 150, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
    actionIconBtn: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
    paginationBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0', flexWrap: 'wrap', gap: 10 },
    pageInfo: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1' },
    pageBtnDisabled: { opacity: 0.5 },
    pageBtnText: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 540, maxHeight: '90%', elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 12 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    inputLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
    subInputLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 4 },
    modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#0f172a' },
    selectedPatientPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', padding: 12, borderRadius: 8, marginBottom: 10 },
    patientSearchResults: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginTop: 4, maxHeight: 150, overflow: 'hidden' },
    patientSearchItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    typeOptionPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    typeOptionPillActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
    typeOptionText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    typeOptionTextActive: { color: '#2563eb', fontWeight: '700' },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 14 },
    modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
    modalCancelText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
    modalSubmitBtn: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
    modalSubmitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, backgroundColor: '#f8fafc', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    detailItem: { width: '48%' },
    detailItemFull: { width: '100%', marginTop: 4 },
    detailLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
    detailVal: { fontSize: 14, color: '#0f172a', fontWeight: '700', marginTop: 2 },
    auditRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderLeftWidth: 2, borderLeftColor: '#e2e8f0', paddingLeft: 12, marginLeft: 6, marginBottom: 8 },
    auditDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb', position: 'absolute', left: -5, top: 12 },
    auditAction: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    auditMeta: { fontSize: 11, color: '#64748b', marginTop: 1 },
    auditReason: { fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 2 }
});

export default VialManagement;
