import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Alert, Modal, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { bedAPI } from '../../utils/api';

const BedManagement = () => {
    const navigation = useNavigation();
    const [beds, setBeds] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Filters
    const [filterWard, setFilterWard] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    
    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingBed, setEditingBed] = useState(null);
    const [formData, setFormData] = useState({ bedNumber: '', ward: '', bedType: 'General', status: 'AVAILABLE' });

    useEffect(() => {
        const checkAuth = async () => {
            const userStr = await AsyncStorage.getItem('user');
            if (!userStr) { navigation.navigate('Login'); return; }
            const user = JSON.parse(userStr);
            if (!['superadmin', 'centraladmin', 'admin', 'hospitaladmin'].includes((user.role || '').toLowerCase())) {
                Alert.alert('Unauthorized', 'Access denied.');
                navigation.navigate('Home');
            }
        };
        checkAuth();
    }, []);

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
            if (res.success) setBeds(res.beds || []);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const handleOpenModal = (bed = null) => {
        if (bed) {
            setEditingBed(bed);
            setFormData({ bedNumber: bed.bedNumber, ward: bed.ward, bedType: bed.bedType, status: bed.status });
        } else {
            setEditingBed(null);
            setFormData({ bedNumber: '', ward: '', bedType: 'General', status: 'AVAILABLE' });
        }
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.bedNumber || !formData.ward) {
            Alert.alert('Error', 'Bed Number and Ward are required');
            return;
        }
        try {
            if (editingBed) {
                await bedAPI.updateBed(editingBed._id, formData);
            } else {
                await bedAPI.createBed(formData);
            }
            setModalOpen(false);
            fetchBeds();
        } catch (error) { Alert.alert('Error', error.response?.data?.message || 'Error saving bed'); }
    };

    const handleDelete = async (id) => {
        Alert.alert('Confirm Delete', 'Are you sure you want to delete this bed?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                    await bedAPI.deleteBed(id);
                    fetchBeds();
                } catch (error) { Alert.alert('Error', error.response?.data?.message || 'Error deleting bed'); }
            }}
        ]);
    };

    // Group beds by ward
    const groupedBeds = beds.reduce((acc, bed) => {
        if (!acc[bed.ward]) acc[bed.ward] = [];
        acc[bed.ward].push(bed);
        return acc;
    }, {});

    const renderBed = ({ item: bed }) => (
        <View style={[styles.bedCard, bed.status === 'AVAILABLE' ? styles.borderAvailable : bed.status === 'OCCUPIED' ? styles.borderOccupied : styles.borderMaintenance]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.bedNumber}>{bed.bedNumber}</Text>
                        <Text style={styles.bedType}>{bed.bedType}</Text>
                    </View>
                    <Text style={[styles.statusBadge, bed.status === 'AVAILABLE' ? styles.bgAvailable : bed.status === 'OCCUPIED' ? styles.bgOccupied : styles.bgMaintenance]}>
                        {bed.status}
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleOpenModal(bed)}><Text>✏️</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.iconBtn, bed.status === 'OCCUPIED' && { opacity: 0.5 }]} disabled={bed.status === 'OCCUPIED'} onPress={() => handleDelete(bed._id)}><Text>🗑️</Text></TouchableOpacity>
                </View>
            </View>

            {bed.status === 'OCCUPIED' && bed.currentPatient ? (
                <View style={styles.patientInfo}>
                    <Text style={styles.patientText}>Patient: {bed.currentPatient.name}</Text>
                    <Text style={styles.patientSubText}>MRN: {bed.currentPatient.patientId || bed.currentPatient.mrn || 'N/A'}</Text>
                </View>
            ) : (
                <Text style={styles.readyText}>Ready for admission</Text>
            )}
        </View>
    );

    const renderWard = ({ item: wardName }) => (
        <View style={styles.wardSection}>
            <View style={styles.wardHeader}>
                <Text style={styles.wardTitle}>🏥 {wardName}</Text>
                <Text style={styles.wardCount}>{groupedBeds[wardName].length} Beds</Text>
            </View>
            <FlatList
                data={groupedBeds[wardName]}
                keyExtractor={item => item._id}
                renderItem={renderBed}
                scrollEnabled={false}
            />
        </View>
    );

    const allWards = Array.from(new Set(beds.map(b => b.ward)));

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.headerTitle}>🛏️ Bed Management</Text>
                    <Text style={styles.headerSub}>Manage wards and occupancy</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => handleOpenModal()}>
                    <Text style={styles.addBtnText}>+ Add Bed</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.filterRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Filter by Ward</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={filterWard} onValueChange={setFilterWard}>
                            <Picker.Item label="All Wards" value="" />
                            {allWards.map(w => <Picker.Item key={w} label={w} value={w} />)}
                        </Picker>
                    </View>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Filter by Status</Text>
                    <View style={styles.pickerContainer}>
                        <Picker selectedValue={filterStatus} onValueChange={setFilterStatus}>
                            <Picker.Item label="All Statuses" value="" />
                            <Picker.Item label="Available" value="AVAILABLE" />
                            <Picker.Item label="Occupied" value="OCCUPIED" />
                            <Picker.Item label="Maintenance" value="MAINTENANCE" />
                        </Picker>
                    </View>
                </View>
            </View>

            {loading ? <Text style={{ textAlign: 'center', marginTop: 20 }}>Loading beds...</Text> : (
                <FlatList
                    data={Object.keys(groupedBeds)}
                    keyExtractor={item => item}
                    renderItem={renderWard}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No beds found.</Text>}
                />
            )}

            <Modal visible={modalOpen} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingBed ? 'Edit Bed' : 'Add New Bed'}</Text>
                        
                        <Text style={styles.label}>Bed Number</Text>
                        <TextInput style={styles.input} value={formData.bedNumber} onChangeText={t => setFormData({...formData, bedNumber: t})} placeholder="e.g. B-101" />
                        
                        <Text style={styles.label}>Ward Name</Text>
                        <TextInput style={styles.input} value={formData.ward} onChangeText={t => setFormData({...formData, ward: t})} placeholder="e.g. General Ward" />
                        
                        <Text style={styles.label}>Bed Type</Text>
                        <View style={styles.pickerContainer}>
                            <Picker selectedValue={formData.bedType} onValueChange={t => setFormData({...formData, bedType: t})}>
                                <Picker.Item label="General" value="General" />
                                <Picker.Item label="ICU" value="ICU" />
                                <Picker.Item label="Private" value="Private" />
                                <Picker.Item label="Semi-Private" value="Semi-Private" />
                            </Picker>
                        </View>

                        {editingBed && (
                            <>
                                <Text style={styles.label}>Status</Text>
                                <View style={[styles.pickerContainer, (editingBed.status === 'OCCUPIED' || formData.status === 'OCCUPIED') && { backgroundColor: '#f1f5f9' }]}>
                                    <Picker selectedValue={formData.status} onValueChange={t => setFormData({...formData, status: t})} enabled={editingBed.status !== 'OCCUPIED' && formData.status !== 'OCCUPIED'}>
                                        <Picker.Item label="Available" value="AVAILABLE" />
                                        <Picker.Item label="Occupied" value="OCCUPIED" />
                                        <Picker.Item label="Maintenance" value="MAINTENANCE" />
                                    </Picker>
                                </View>
                            </>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}><Text style={{ color: '#475569', fontWeight: 'bold' }}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
    headerSub: { fontSize: 12, color: '#64748b' },
    addBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
    addBtnText: { color: 'white', fontWeight: 'bold' },
    filterRow: { flexDirection: 'row', gap: 10, backgroundColor: 'white', padding: 12, borderRadius: 8, marginBottom: 20, elevation: 1 },
    label: { fontSize: 12, fontWeight: 'bold', color: '#475569', marginBottom: 4 },
    pickerContainer: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
    wardSection: { marginBottom: 20 },
    wardHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#e2e8f0', paddingBottom: 8, marginBottom: 12 },
    wardTitle: { fontSize: 18, fontWeight: 'bold', color: '#334155', marginRight: 10 },
    wardCount: { fontSize: 12, backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, color: '#64748b', fontWeight: 'bold' },
    bedCard: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 10, elevation: 1, borderLeftWidth: 4 },
    borderAvailable: { borderLeftColor: '#22c55e' },
    borderOccupied: { borderLeftColor: '#ef4444' },
    borderMaintenance: { borderLeftColor: '#f59e0b' },
    bedNumber: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    bedType: { fontSize: 12, backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, color: '#64748b', overflow: 'hidden' },
    statusBadge: { alignSelf: 'flex-start', marginTop: 8, fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, overflow: 'hidden' },
    bgAvailable: { backgroundColor: '#dcfce7', color: '#166534' },
    bgOccupied: { backgroundColor: '#fee2e2', color: '#991b1b' },
    bgMaintenance: { backgroundColor: '#fef3c7', color: '#92400e' },
    iconBtn: { backgroundColor: '#f1f5f9', width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    patientInfo: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, marginTop: 12 },
    patientText: { fontSize: 14, color: '#475569', fontWeight: 'bold' },
    patientSubText: { fontSize: 12, color: '#64748b' },
    readyText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginTop: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', padding: 20, borderRadius: 12 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, marginBottom: 12 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
    cancelBtn: { padding: 10, backgroundColor: '#f1f5f9', borderRadius: 8 },
    saveBtn: { padding: 10, backgroundColor: '#3b82f6', borderRadius: 8 }
});

export default BedManagement;
