import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    StyleSheet, ActivityIndicator, Alert, Modal
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { bedAPI } from '../../utils/api';
import DropdownSelect from '../../components/common/DropdownSelect';

const CustomSelect = (props) => <DropdownSelect {...props} />;

const BedManagement = () => {
    const [beds, setBeds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filters & Search
    const [filterWard, setFilterWard] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingBed, setEditingBed] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        bedNumber: '',
        ward: '',
        bedType: 'General',
        status: 'AVAILABLE'
    });

    useEffect(() => {
        fetchBeds();
    }, [filterWard, filterStatus]);

    const fetchBeds = async (showAlert = false) => {
        setLoading(true);
        if (showAlert) setIsRefreshing(true);
        try {
            const params = {};
            if (filterWard) params.ward = filterWard;
            if (filterStatus) params.status = filterStatus;

            const res = await bedAPI.getBeds(params);
            if (res.success) {
                setBeds(res.beds || []);
                if (showAlert) Alert.alert('Refreshed', 'Bed data refreshed successfully!');
            }
        } catch (error) {
            console.error("Error fetching beds:", error);
            Alert.alert('Error', error.response?.data?.message || 'Error fetching beds');
        } finally {
            setLoading(false);
            if (showAlert) setIsRefreshing(false);
        }
    };

    const handleOpenModal = (bed = null) => {
        if (bed) {
            setEditingBed(bed);
            setFormData({
                bedNumber: bed.bedNumber,
                ward: bed.ward,
                bedType: bed.bedType || 'General',
                status: bed.status || 'AVAILABLE'
            });
        } else {
            setEditingBed(null);
            setFormData({
                bedNumber: '',
                ward: filterWard || '',
                bedType: 'General',
                status: 'AVAILABLE'
            });
        }
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.bedNumber.trim() || !formData.ward.trim()) {
            Alert.alert('Validation Error', 'Bed number and ward are required');
            return;
        }

        setSaving(true);
        try {
            if (editingBed) {
                await bedAPI.updateBed(editingBed._id, formData);
                Alert.alert('Success', `Bed ${formData.bedNumber} updated successfully!`);
            } else {
                await bedAPI.createBed(formData);
                Alert.alert('Success', `Bed ${formData.bedNumber} created successfully!`);
            }
            setModalOpen(false);
            fetchBeds();
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'Error saving bed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (bed) => {
        if (bed.status === 'OCCUPIED') {
            Alert.alert('Action Forbidden', 'Cannot delete an occupied bed. Please discharge or reassign patient first.');
            return;
        }
        Alert.alert('Confirm Delete', `Are you sure you want to delete Bed ${bed.bedNumber}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete Bed', style: 'destructive', onPress: async () => {
                    try {
                        await bedAPI.deleteBed(bed._id);
                        Alert.alert('Success', `Bed ${bed.bedNumber} deleted`);
                        fetchBeds();
                    } catch (error) {
                        Alert.alert('Error', error.response?.data?.message || 'Error deleting bed');
                    }
                }
            }
        ]);
    };

    // Filter by search query (1:1 with Web)
    const filteredBeds = useMemo(() => {
        const q = (searchQuery || '').toLowerCase().trim();
        if (!q) return beds;
        return beds.filter(bed => {
            const num = (bed.bedNumber || '').toLowerCase();
            const ward = (bed.ward || '').toLowerCase();
            const type = (bed.bedType || '').toLowerCase();
            const status = (bed.status || '').toLowerCase();
            const patientName = (bed.currentPatient?.name || '').toLowerCase();
            return num.includes(q) || ward.includes(q) || type.includes(q) || status.includes(q) || patientName.includes(q);
        });
    }, [beds, searchQuery]);

    // Group beds by ward for rendering
    const groupedBeds = useMemo(() => {
        return filteredBeds.reduce((acc, bed) => {
            const w = bed.ward || 'General Ward';
            if (!acc[w]) acc[w] = [];
            acc[w].push(bed);
            return acc;
        }, {});
    }, [filteredBeds]);

    // Summary statistics (1:1 with Web)
    const totalBeds = beds.length;
    const availableBeds = beds.filter(b => b.status === 'AVAILABLE').length;
    const occupiedBeds = beds.filter(b => b.status === 'OCCUPIED').length;
    const maintenanceBeds = beds.filter(b => b.status === 'MAINTENANCE').length;
    const uniqueWards = Array.from(new Set(beds.map(b => b.ward).filter(Boolean)));
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* 1. Header Banner & Actions */}
            <View style={styles.header}>
                <View style={{ flex: 1, minWidth: 240 }}>
                    <Text style={styles.pageTitle}>Bed Management & Allocation</Text>
                    <Text style={styles.pageSubtitle}>
                        Monitor real-time ward occupancy, allocate patient admissions, and manage hospital bed infrastructure.
                    </Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.btnRefresh}
                        onPress={() => fetchBeds(true)}
                        disabled={isRefreshing}
                    >
                        <Feather name="refresh-cw" size={15} color="#475569" />
                        <Text style={styles.btnRefreshText}>{isRefreshing ? 'Refreshing...' : 'Refresh'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnAdd} onPress={() => handleOpenModal()}>
                        <Feather name="plus" size={16} color="#fff" />
                        <Text style={styles.btnAddText}>Add New Bed</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* 2. Stat Chips Row (Web 1:1 Parity) */}
            <View style={styles.statChipsGrid}>
                {/* Total Beds */}
                <View style={[styles.statChip, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                    <Text style={styles.statChipIcon}>🛏️</Text>
                    <View>
                        <Text style={[styles.statChipVal, { color: '#1e40af' }]}>{totalBeds}</Text>
                        <Text style={styles.statChipLabel}>Total Beds</Text>
                    </View>
                </View>

                {/* Available Beds */}
                <View style={[styles.statChip, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                    <Text style={styles.statChipIcon}>🟢</Text>
                    <View>
                        <Text style={[styles.statChipVal, { color: '#065f46' }]}>{availableBeds}</Text>
                        <Text style={styles.statChipLabel}>Available</Text>
                    </View>
                </View>

                {/* Occupied Beds */}
                <View style={[styles.statChip, { backgroundColor: '#fff1f2', borderColor: '#fecdd3' }]}>
                    <Text style={styles.statChipIcon}>🔴</Text>
                    <View>
                        <Text style={[styles.statChipVal, { color: '#9f1239' }]}>{occupiedBeds}</Text>
                        <Text style={styles.statChipLabel}>Occupied ({occupancyRate}%)</Text>
                    </View>
                </View>

                {/* Maintenance */}
                <View style={[styles.statChip, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                    <Text style={styles.statChipIcon}>🛠️</Text>
                    <View>
                        <Text style={[styles.statChipVal, { color: '#92400e' }]}>{maintenanceBeds}</Text>
                        <Text style={styles.statChipLabel}>Maintenance</Text>
                    </View>
                </View>

                {/* Active Wards */}
                <View style={[styles.statChip, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
                    <Text style={styles.statChipIcon}>🏥</Text>
                    <View>
                        <Text style={[styles.statChipVal, { color: '#6b21a8' }]}>{uniqueWards.length}</Text>
                        <Text style={styles.statChipLabel}>Active Wards</Text>
                    </View>
                </View>
            </View>

            {/* 3. Search & Filters Toolbar Card (Web 1:1 Parity) */}
            <View style={styles.filtersContainer}>
                {/* Search Box */}
                <View style={styles.searchBox}>
                    <Feather name="search" size={16} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search bed number, ward, type, or patient..."
                        placeholderTextColor="#94a3b8"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
                            <Feather name="x" size={14} color="#64748b" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Dropdown Filters */}
                <View style={styles.dropdownsRow}>
                    <View style={[styles.filterGroup, { zIndex: 10 }]}>
                        <Text style={styles.filterLabel}>Ward:</Text>
                        <CustomSelect
                            options={[
                                { label: `All Wards (${uniqueWards.length})`, value: '' },
                                ...uniqueWards.map(w => ({ label: w, value: w }))
                            ]}
                            value={filterWard}
                            onChange={setFilterWard}
                            placeholder="All Wards"
                        />
                    </View>
                    <View style={[styles.filterGroup, { zIndex: 5 }]}>
                        <Text style={styles.filterLabel}>Status:</Text>
                        <CustomSelect
                            options={[
                                { label: 'All Statuses', value: '' },
                                { label: 'Available Only', value: 'AVAILABLE' },
                                { label: 'Occupied Only', value: 'OCCUPIED' },
                                { label: 'Maintenance Only', value: 'MAINTENANCE' }
                            ]}
                            value={filterStatus}
                            onChange={setFilterStatus}
                            placeholder="All Statuses"
                        />
                    </View>
                </View>
            </View>

            {/* 4. Ward Sections & Bed Cards */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>Loading real-time bed allocation data...</Text>
                </View>
            ) : Object.keys(groupedBeds).length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>🛏️</Text>
                    <Text style={styles.emptyTitle}>No Beds Found</Text>
                    <Text style={styles.emptyText}>No hospital beds match your selected filters or search query.</Text>
                    <TouchableOpacity
                        style={styles.btnResetFilters}
                        onPress={() => { setFilterWard(''); setFilterStatus(''); setSearchQuery(''); }}
                    >
                        <Text style={styles.btnResetFiltersText}>Reset All Filters</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                Object.entries(groupedBeds).map(([wardName, wardBeds]) => {
                    const wardOccupied = wardBeds.filter(b => b.status === 'OCCUPIED').length;
                    const wardAvailable = wardBeds.filter(b => b.status === 'AVAILABLE').length;
                    const wardPct = wardBeds.length > 0 ? Math.round((wardOccupied / wardBeds.length) * 100) : 0;

                    return (
                        <View key={wardName} style={styles.wardSection}>
                            {/* Ward Header */}
                            <View style={styles.wardHeader}>
                                <View style={styles.wardTitleGroup}>
                                    <Text style={styles.wardIconBadge}>🏥</Text>
                                    <View>
                                        <Text style={styles.wardTitle}>{wardName}</Text>
                                        <View style={styles.wardMetaRow}>
                                            <Text style={styles.wardMetaAvail}>🟢 {wardAvailable} Available</Text>
                                            <Text style={styles.wardMetaOcc}>🔴 {wardOccupied} Occupied</Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.wardOccupancyBadge}>
                                    <View style={styles.wardCountBadge}>
                                        <Text style={styles.wardCountText}>{wardBeds.length} Beds</Text>
                                    </View>
                                    <View style={[
                                        styles.wardRateBadge,
                                        wardPct >= 80 ? styles.wardRateHigh : wardPct >= 50 ? styles.wardRateMed : styles.wardRateLow
                                    ]}>
                                        <Text style={[
                                            styles.wardRateText,
                                            wardPct >= 80 ? styles.wardRateTextHigh : wardPct >= 50 ? styles.wardRateTextMed : styles.wardRateTextLow
                                        ]}>{wardPct}% Full</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Bed Cards Grid */}
                            <View style={styles.bedsGrid}>
                                {wardBeds.map(bed => {
                                    const isAvailable = bed.status === 'AVAILABLE';
                                    const isOccupied = bed.status === 'OCCUPIED';

                                    return (
                                        <View key={bed._id} style={[
                                            styles.bedCard,
                                            {
                                                borderColor: isAvailable ? '#bbf7d0' : isOccupied ? '#fecaca' : '#fde68a',
                                                borderLeftColor: isAvailable ? '#22c55e' : isOccupied ? '#ef4444' : '#f59e0b',
                                                borderLeftWidth: 5
                                            }
                                        ]}>
                                            <View style={styles.bedCardHeader}>
                                                <View>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        <Text style={styles.bedNumber}>{bed.bedNumber}</Text>
                                                        <View style={styles.bedTypeBadge}>
                                                            <Text style={styles.bedTypeText}>{bed.bedType || 'General'}</Text>
                                                        </View>
                                                    </View>
                                                    <View style={[
                                                        styles.statusBadge,
                                                        { backgroundColor: isAvailable ? '#dcfce7' : isOccupied ? '#fee2e2' : '#fef3c7' }
                                                    ]}>
                                                        <Text style={[
                                                            styles.statusText,
                                                            { color: isAvailable ? '#166534' : isOccupied ? '#991b1b' : '#92400e' }
                                                        ]}>
                                                            {bed.status || 'AVAILABLE'}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    <TouchableOpacity
                                                        onPress={() => handleOpenModal(bed)}
                                                        style={styles.btnIcon}
                                                    >
                                                        <Feather name="edit-2" size={14} color="#64748b" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => handleDelete(bed)}
                                                        disabled={isOccupied}
                                                        style={[
                                                            styles.btnIcon,
                                                            { backgroundColor: isOccupied ? '#f1f5f9' : '#fef2f2' }
                                                        ]}
                                                    >
                                                        <Feather name="trash-2" size={14} color={isOccupied ? '#cbd5e1' : '#ef4444'} />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {/* Card Body */}
                                            {isOccupied && bed.currentPatient ? (
                                                <View style={styles.patientInfoBox}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                        <Text>👤</Text>
                                                        <Text style={styles.patientNameTxt}>{bed.currentPatient.name || 'Admitted Patient'}</Text>
                                                    </View>
                                                    <Text style={styles.patientInfoText}>
                                                        <Text style={{ fontWeight: 'bold' }}>MRN: </Text>
                                                        {bed.currentPatient.patientId || bed.currentPatient.mrn || 'N/A'}
                                                    </Text>
                                                    {bed.currentAdmission?.admissionDate && (
                                                        <Text style={styles.patientInfoText}>
                                                            <Text style={{ fontWeight: 'bold' }}>Date: </Text>
                                                            {new Date(bed.currentAdmission.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </Text>
                                                    )}
                                                </View>
                                            ) : isAvailable ? (
                                                <View style={styles.readyBox}>
                                                    <Feather name="check-circle" size={14} color="#16a34a" />
                                                    <Text style={styles.readyText}>Ready for admission</Text>
                                                </View>
                                            ) : (
                                                <View style={styles.maintBox}>
                                                    <Text style={styles.maintText}>🛠️ Under maintenance/cleaning</Text>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    );
                })
            )}

            {/* 5. Sleek Add / Edit Bed Modal (Web 1:1 Parity) */}
            <Modal visible={modalOpen} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeaderRow}>
                            <View>
                                <Text style={styles.modalTitle}>{editingBed ? 'Edit Bed Details' : 'Add New Hospital Bed'}</Text>
                                <Text style={styles.modalSubtitle}>Configure bed identification, ward location, and tier.</Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.modalCloseBtn}>
                                <Feather name="x" size={18} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ marginBottom: 14 }}>
                            <Text style={styles.modalLabel}>Bed Number / Code <Text style={{ color: '#ef4444' }}>*</Text></Text>
                            <TextInput
                                style={styles.staffInput}
                                value={formData.bedNumber}
                                onChangeText={t => setFormData({ ...formData, bedNumber: t })}
                                placeholder="e.g. B-101, ICU-04"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>

                        <View style={{ marginBottom: 14 }}>
                            <Text style={styles.modalLabel}>Ward Name <Text style={{ color: '#ef4444' }}>*</Text></Text>
                            <TextInput
                                style={styles.staffInput}
                                value={formData.ward}
                                onChangeText={t => setFormData({ ...formData, ward: t })}
                                placeholder="e.g. General Ward, ICU, Semi-Private"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>

                        <View style={[styles.filterGroup, { marginBottom: 14, zIndex: 20 }]}>
                            <Text style={styles.modalLabel}>Bed Type / Tier</Text>
                            <CustomSelect
                                options={[
                                    { label: 'General', value: 'General' },
                                    { label: 'ICU (Intensive Care)', value: 'ICU' },
                                    { label: 'NICU (Neonatal)', value: 'NICU' },
                                    { label: 'Private Room', value: 'Private' },
                                    { label: 'Semi-Private', value: 'Semi-Private' },
                                    { label: 'Emergency / Trauma', value: 'Emergency' },
                                    { label: 'Post-Op Recovery', value: 'Post-Op' },
                                    { label: 'Deluxe Suite', value: 'Deluxe' },
                                    { label: 'Other', value: 'Other' }
                                ]}
                                value={formData.bedType}
                                onChange={v => setFormData({ ...formData, bedType: v })}
                                placeholder="Select Bed Type"
                            />
                        </View>

                        {editingBed && (
                            <View style={[styles.filterGroup, { marginBottom: 20, zIndex: 10 }]}>
                                <Text style={styles.modalLabel}>Operational Status</Text>
                                <CustomSelect
                                    options={[
                                        { label: 'Available', value: 'AVAILABLE' },
                                        { label: 'Occupied (Set via Admission)', value: 'OCCUPIED' },
                                        { label: 'Maintenance / Cleaning', value: 'MAINTENANCE' }
                                    ]}
                                    value={formData.status}
                                    onChange={v => setFormData({ ...formData, status: v })}
                                    placeholder="Select Status"
                                    disabled={editingBed.status === 'OCCUPIED' || formData.status === 'OCCUPIED'}
                                />
                            </View>
                        )}

                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.btnCancel}>
                                <Text style={styles.btnCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSubmit} disabled={saving} style={styles.btnSubmit}>
                                {saving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.btnSubmitText}>{editingBed ? 'Save Changes' : 'Create Bed'}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 16,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    pageTitle: {
        margin: 0,
        color: '#1e293b',
        fontSize: 24,
        fontWeight: 'bold',
    },
    pageSubtitle: {
        marginTop: 4,
        color: '#64748b',
        fontSize: 14,
    },
    btnRefresh: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#fff',
    },
    btnRefreshText: {
        color: '#475569',
        fontSize: 13,
        fontWeight: '600',
    },
    btnAdd: {
        backgroundColor: '#3b82f6',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    btnAddText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    statChipsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    statChip: {
        flex: 1,
        minWidth: 140,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statChipIcon: {
        fontSize: 20,
    },
    statChipVal: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    statChipLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },
    filtersContainer: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        marginBottom: 24,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f8fafc',
        marginBottom: 14,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 14,
        color: '#0f172a',
    },
    searchClearBtn: {
        padding: 4,
    },
    dropdownsRow: {
        flexDirection: 'row',
        gap: 14,
        flexWrap: 'wrap',
    },
    filterGroup: {
        flex: 1,
        minWidth: 160,
    },
    filterLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 6,
    },
    staffInput: {
        width: '100%',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderColor: '#cbd5e1',
        borderWidth: 1,
        backgroundColor: '#fff',
        color: '#0f172a',
        fontSize: 14,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 10,
        color: '#64748b',
        fontSize: 14,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderColor: '#cbd5e1',
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    emptyIcon: {
        fontSize: 36,
        marginBottom: 10,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 6,
    },
    emptyText: {
        color: '#64748b',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 16,
    },
    btnResetFilters: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    btnResetFiltersText: {
        color: '#334155',
        fontWeight: '600',
        fontSize: 13,
    },
    wardSection: {
        marginBottom: 32,
    },
    wardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 10,
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 12,
    },
    wardTitleGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    wardIconBadge: {
        fontSize: 22,
    },
    wardTitle: {
        color: '#1e293b',
        fontSize: 18,
        fontWeight: 'bold',
    },
    wardMetaRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 3,
    },
    wardMetaAvail: {
        fontSize: 12,
        color: '#16a34a',
        fontWeight: '600',
    },
    wardMetaOcc: {
        fontSize: 12,
        color: '#dc2626',
        fontWeight: '600',
    },
    wardOccupancyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    wardCountBadge: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    wardCountText: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '600',
    },
    wardRateBadge: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    wardRateLow: {
        backgroundColor: '#ecfdf5',
    },
    wardRateMed: {
        backgroundColor: '#fffbeb',
    },
    wardRateHigh: {
        backgroundColor: '#fef2f2',
    },
    wardRateText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    wardRateTextLow: {
        color: '#059669',
    },
    wardRateTextMed: {
        color: '#d97706',
    },
    wardRateTextHigh: {
        color: '#dc2626',
    },
    bedsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    bedCard: {
        flex: 1,
        minWidth: 260,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
    },
    bedCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    bedNumber: {
        fontSize: 18,
        color: '#1e293b',
        fontWeight: 'bold',
    },
    bedTypeBadge: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
    },
    bedTypeText: {
        color: '#64748b',
        fontSize: 11,
        fontWeight: '600',
    },
    statusBadge: {
        alignSelf: 'flex-start',
        marginTop: 6,
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '800',
    },
    btnIcon: {
        backgroundColor: '#f1f5f9',
        width: 32,
        height: 32,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    patientInfoBox: {
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 8,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        marginTop: 14,
    },
    patientNameTxt: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    patientInfoText: {
        fontSize: 12,
        color: '#475569',
        marginBottom: 2,
    },
    readyBox: {
        marginTop: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f0fdf4',
        padding: 8,
        borderRadius: 6,
    },
    readyText: {
        fontSize: 12,
        color: '#16a34a',
        fontWeight: '600',
    },
    maintBox: {
        marginTop: 14,
        backgroundColor: '#fefce8',
        padding: 8,
        borderRadius: 6,
    },
    maintText: {
        fontSize: 12,
        color: '#a16207',
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 14,
        width: '100%',
        maxWidth: 440,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 25,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        color: '#1e293b',
        fontWeight: 'bold',
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 6,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 20,
    },
    btnCancel: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    btnCancelText: {
        color: '#475569',
        fontWeight: '600',
        fontSize: 14,
    },
    btnSubmit: {
        backgroundColor: '#3b82f6',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
    },
    btnSubmitText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
});

export default BedManagement;
