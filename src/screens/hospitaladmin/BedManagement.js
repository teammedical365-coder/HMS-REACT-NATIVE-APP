import React, { useState, useEffect } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, ScrollView, 
    StyleSheet, ActivityIndicator, Alert, Modal, Dimensions
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { bedAPI } from '../../utils/api';

// --- Custom Select Dropdown ---
const CustomSelect = ({ options, value, onChange, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedObj = options.find(o => o.value === value);
    const selectedName = selectedObj ? selectedObj.label : placeholder;

    return (
        <View style={{ position: 'relative', width: '100%', zIndex: isOpen ? 50 : 1 }}>
            <TouchableOpacity 
                style={[styles.staffInput, { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, disabled && { opacity: 0.6, backgroundColor: '#f1f5f9' }]} 
                onPress={() => !disabled && setIsOpen(!isOpen)}
                activeOpacity={0.7}
            >
                <Text style={{ color: value ? '#0f172a' : '#94a3b8', fontSize: 14 }}>{selectedName}</Text>
                <Feather name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>

            {isOpen && (
                <View style={styles.dropdownMenu}>
                    <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 150 }}>
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


const BedManagement = () => {
    const [beds, setBeds] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Filters
    const [filterWard, setFilterWard] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    
    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingBed, setEditingBed] = useState(null);
    const [formData, setFormData] = useState({
        bedNumber: '',
        ward: '',
        bedType: 'General',
        status: 'AVAILABLE'
    });

    useEffect(() => {
        fetchBeds();
    }, [filterWard, filterStatus]);

    const fetchBeds = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterWard) params.ward = filterWard;
            if (filterStatus) params.status = filterStatus;
            
            const res = await bedAPI.getBeds(params);
            if (res.success) {
                setBeds(res.beds);
            }
        } catch (error) {
            console.error("Error fetching beds:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (bed = null) => {
        if (bed) {
            setEditingBed(bed);
            setFormData({
                bedNumber: bed.bedNumber,
                ward: bed.ward,
                bedType: bed.bedType,
                status: bed.status
            });
        } else {
            setEditingBed(null);
            setFormData({
                bedNumber: '',
                ward: '',
                bedType: 'General',
                status: 'AVAILABLE'
            });
        }
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        try {
            if (editingBed) {
                await bedAPI.updateBed(editingBed._id, formData);
            } else {
                await bedAPI.createBed(formData);
            }
            setModalOpen(false);
            fetchBeds();
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || 'Error saving bed');
        }
    };

    const handleDelete = async (id) => {
        Alert.alert('Confirm Delete', 'Are you sure you want to delete this bed?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                    await bedAPI.deleteBed(id);
                    fetchBeds();
                } catch (error) {
                    Alert.alert('Error', error.response?.data?.message || 'Error deleting bed');
                }
            }}
        ]);
    };

    // Group beds by ward for rendering
    const groupedBeds = beds.reduce((acc, bed) => {
        if (!acc[bed.ward]) acc[bed.ward] = [];
        acc[bed.ward].push(bed);
        return acc;
    }, {});

    const uniqueWards = Array.from(new Set(beds.map(b => b.ward)));

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.pageTitle}>🛏️ Bed Management</Text>
                    <Text style={styles.pageSubtitle}>Manage hospital beds, wards, and occupancy status.</Text>
                </View>
                <TouchableOpacity style={styles.btnAdd} onPress={() => handleOpenModal()}>
                    <Feather name="plus" size={16} color="#fff" />
                    <Text style={styles.btnAddText}>Add New Bed</Text>
                </TouchableOpacity>
            </View>

            {/* Filters */}
            <View style={styles.filtersContainer}>
                <View style={[styles.filterGroup, { zIndex: 10 }]}>
                    <Text style={styles.filterLabel}>Filter by Ward</Text>
                    <CustomSelect 
                        options={uniqueWards.map(w => ({ label: w, value: w }))}
                        value={filterWard}
                        onChange={setFilterWard}
                        placeholder="All Wards"
                    />
                </View>
                <View style={[styles.filterGroup, { zIndex: 5 }]}>
                    <Text style={styles.filterLabel}>Filter by Status</Text>
                    <CustomSelect 
                        options={[
                            { label: 'Available', value: 'AVAILABLE' },
                            { label: 'Occupied', value: 'OCCUPIED' },
                            { label: 'Maintenance', value: 'MAINTENANCE' }
                        ]}
                        value={filterStatus}
                        onChange={setFilterStatus}
                        placeholder="All Statuses"
                    />
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                    <Text style={styles.loadingText}>Loading beds...</Text>
                </View>
            ) : Object.keys(groupedBeds).length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No beds found. Create some beds to get started.</Text>
                </View>
            ) : (
                Object.entries(groupedBeds).map(([wardName, wardBeds]) => (
                    <View key={wardName} style={styles.wardSection}>
                        <View style={styles.wardHeader}>
                            <Text style={styles.wardTitle}>🏥 {wardName}</Text>
                            <View style={styles.wardCountBadge}>
                                <Text style={styles.wardCountText}>{wardBeds.length} Beds</Text>
                            </View>
                        </View>
                        
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
                                                        <Text style={styles.bedTypeText}>{bed.bedType}</Text>
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
                                                        {bed.status}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                <TouchableOpacity onPress={() => handleOpenModal(bed)} style={styles.btnIcon}>
                                                    <Feather name="edit-2" size={14} color="#64748b" />
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    onPress={() => handleDelete(bed._id)} 
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

                                        {isOccupied && bed.currentPatient ? (
                                            <View style={styles.patientInfoBox}>
                                                <Text style={styles.patientInfoText}>
                                                    <Text style={{ fontWeight: 'bold' }}>Patient:</Text> {bed.currentPatient.name}
                                                </Text>
                                                <Text style={styles.patientInfoText}>
                                                    <Text style={{ fontWeight: 'bold' }}>MRN:</Text> {bed.currentPatient.patientId || bed.currentPatient.mrn || 'N/A'}
                                                </Text>
                                                {bed.currentAdmission && (
                                                    <Text style={styles.patientInfoText}>
                                                        <Text style={{ fontWeight: 'bold' }}>Admitted:</Text> {new Date(bed.currentAdmission.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </Text>
                                                )}
                                            </View>
                                        ) : (
                                            <View style={styles.readyBox}>
                                                <Text style={styles.readyText}>Ready for admission</Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                ))
            )}

            {/* Modal */}
            <Modal visible={modalOpen} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingBed ? 'Edit Bed' : 'Add New Bed'}</Text>
                        
                        <View style={{ marginBottom: 16 }}>
                            <Text style={styles.modalLabel}>Bed Number</Text>
                            <TextInput 
                                style={styles.staffInput}
                                value={formData.bedNumber}
                                onChangeText={t => setFormData({...formData, bedNumber: t})}
                                placeholder="e.g. B-101"
                            />
                        </View>
                        
                        <View style={{ marginBottom: 16 }}>
                            <Text style={styles.modalLabel}>Ward Name</Text>
                            <TextInput 
                                style={styles.staffInput}
                                value={formData.ward}
                                onChangeText={t => setFormData({...formData, ward: t})}
                                placeholder="e.g. General Ward"
                            />
                        </View>
                        
                        <View style={[styles.filterGroup, { marginBottom: 16, zIndex: 20 }]}>
                            <Text style={styles.modalLabel}>Bed Type</Text>
                            <CustomSelect 
                                options={[
                                    { label: 'General', value: 'General' },
                                    { label: 'ICU', value: 'ICU' },
                                    { label: 'Private', value: 'Private' },
                                    { label: 'Semi-Private', value: 'Semi-Private' },
                                    { label: 'Other', value: 'Other' }
                                ]}
                                value={formData.bedType}
                                onChange={v => setFormData({...formData, bedType: v})}
                                placeholder="Select Bed Type"
                            />
                        </View>
                        
                        {editingBed && (
                            <View style={[styles.filterGroup, { marginBottom: 24, zIndex: 10 }]}>
                                <Text style={styles.modalLabel}>Status</Text>
                                <CustomSelect 
                                    options={[
                                        { label: 'Available', value: 'AVAILABLE' },
                                        { label: 'Occupied (Set via Admission)', value: 'OCCUPIED' },
                                        { label: 'Maintenance', value: 'MAINTENANCE' }
                                    ]}
                                    value={formData.status}
                                    onChange={v => setFormData({...formData, status: v})}
                                    placeholder="Select Status"
                                    disabled={editingBed.status === 'OCCUPIED' || formData.status === 'OCCUPIED'}
                                />
                            </View>
                        )}
                        
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.btnCancel}>
                                <Text style={styles.btnCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSubmit} style={styles.btnSubmit}>
                                <Text style={styles.btnSubmitText}>Save Bed</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
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
    filtersContainer: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        flexWrap: 'wrap',
    },
    filterGroup: {
        flex: 1,
        minWidth: 200,
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
    emptyText: {
        color: '#64748b',
        fontSize: 14,
    },
    wardSection: {
        marginBottom: 32,
    },
    wardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 8,
        marginBottom: 16,
    },
    wardTitle: {
        color: '#334155',
        fontSize: 18,
        fontWeight: 'bold',
    },
    wardCountBadge: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    wardCountText: {
        color: '#64748b',
        fontSize: 11,
        fontWeight: '600',
    },
    bedsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    bedCard: {
        flex: 1,
        minWidth: 280,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        flexDirection: 'column',
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
        marginTop: 16,
    },
    patientInfoText: {
        fontSize: 12,
        color: '#475569',
        marginBottom: 4,
    },
    readyBox: {
        marginTop: 16,
        paddingTop: 12,
    },
    readyText: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
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
        borderRadius: 12,
        width: '100%',
        maxWidth: 400,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 25,
    },
    modalTitle: {
        fontSize: 18,
        color: '#1e293b',
        fontWeight: 'bold',
        marginBottom: 16,
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
        marginTop: 24,
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
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    btnSubmitText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    dropdownMenu: {
        position: 'absolute',
        top: 45,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        borderRadius: 8,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    dropdownItem: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    dropdownItemActive: {
        backgroundColor: '#e0f2fe',
    },
    dropdownItemText: {
        fontSize: 14,
        color: '#334155',
    },
    dropdownItemTextActive: {
        color: '#0284c7',
        fontWeight: '600',
    }
});

export default BedManagement;
