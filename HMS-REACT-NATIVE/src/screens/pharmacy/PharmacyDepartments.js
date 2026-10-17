import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, 
    Modal, Dimensions, Alert, useWindowDimensions, KeyboardAvoidingView, 
    Platform, ActivityIndicator 
} from 'react-native';
import { pharmacyAPI, billingAPI } from '../../utils/api';
import DropdownSelect from '../../components/common/DropdownSelect';
import { fetchPharmacyInventoryWithOffline } from '../../services/offline/offlinePharmacyService';

const PharmacyDepartments = () => {
    const { width } = useWindowDimensions();
    const isLargeScreen = width > 768;
    const isMobile = width < 600;
    const [departments, setDepartments] = useState([]);
    const [stocks, setStocks] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [patients, setPatients] = useState([]);
    const [loadingData, setLoadingData] = useState(false);

    // Modals state
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showUsageModal, setShowUsageModal] = useState(false);

    // Form states
    const [deptForm, setDeptForm] = useState({ name: '', description: '' });
    const [transferForm, setTransferForm] = useState({ departmentId: '', medicineId: '', quantity: '' });
    const [usageForm, setUsageForm] = useState({ departmentId: '', medicineId: '', patientId: '', quantity: '', unitPrice: '' });
    const [patientSearch, setPatientSearch] = useState('');

    // Submission locks
    const [creatingDept, setCreatingDept] = useState(false);
    const [transferringStock, setTransferringStock] = useState(false);
    const [recordingUsage, setRecordingUsage] = useState(false);

    useEffect(() => {
        fetchData();
        fetchInventoryData();
    }, []);

    const fetchData = async () => {
        setLoadingData(true);
        try {
            const [deptRes, stockRes] = await Promise.allSettled([
                pharmacyAPI.getDepartments(),
                pharmacyAPI.getDepartmentStocks()
            ]);

            if (deptRes.status === 'fulfilled' && deptRes.value?.success) {
                setDepartments(deptRes.value.departments || []);
            }
            if (stockRes.status === 'fulfilled' && stockRes.value?.success) {
                setStocks(stockRes.value.stocks || []);
            }
        } catch (error) {
            console.error('Error fetching department data:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const fetchInventoryData = async () => {
        try {
            const res = await fetchPharmacyInventoryWithOffline({
                onCacheHit: (cached) => {
                    if (cached && Array.isArray(cached.medicines)) {
                        setInventory(cached.medicines);
                    }
                }
            });
            if (res && res.success && Array.isArray(res.medicines)) {
                setInventory(res.medicines);
                return;
            }
        } catch (offlineErr) {
            console.warn('fetchPharmacyInventoryWithOffline fallback:', offlineErr);
        }

        try {
            const res = await pharmacyAPI.getInventory();
            const invData = res?.medicines || res?.inventory || res?.data || (Array.isArray(res) ? res : []);
            setInventory(Array.isArray(invData) ? invData : []);
        } catch (error) {
            console.error('Error fetching inventory:', error);
        }
    };

    const handleCreateDepartment = async () => {
        if (creatingDept) return;
        if (!deptForm.name.trim()) {
            Alert.alert('Validation Error', 'Department name is required');
            return;
        }

        setCreatingDept(true);
        try {
            const res = await pharmacyAPI.createDepartment({
                name: deptForm.name.trim(),
                description: deptForm.description.trim()
            });
            if (res && (res.success || res._id || res.id)) {
                Alert.alert('Success', 'Department created successfully!');
                setShowDeptModal(false);
                setDeptForm({ name: '', description: '' });
                fetchData();
            } else {
                Alert.alert('Error', res?.message || 'Error creating department');
            }
        } catch (error) {
            console.error('Error creating department:', error);
            const msg = error?.response?.data?.message || error?.message || 'Error creating department';
            Alert.alert('Error', msg);
        } finally {
            setCreatingDept(false);
        }
    };

    const handleTransfer = async () => {
        if (transferringStock) return;
        if (!transferForm.departmentId) {
            Alert.alert('Validation Error', 'Please select a destination department');
            return;
        }
        if (!transferForm.medicineId) {
            Alert.alert('Validation Error', 'Please select a medicine');
            return;
        }
        const qty = Number(transferForm.quantity);
        if (isNaN(qty) || qty <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid quantity greater than 0');
            return;
        }

        setTransferringStock(true);
        try {
            const res = await pharmacyAPI.transferToDepartment({
                departmentId: transferForm.departmentId,
                medicineId: transferForm.medicineId,
                quantity: qty
            });
            if (res && (res.success || res._id || res.id)) {
                Alert.alert('Success', 'Stock transferred successfully!');
                setShowTransferModal(false);
                setTransferForm({ departmentId: '', medicineId: '', quantity: '' });
                fetchData();
                fetchInventoryData(); // refresh main stock
            } else {
                Alert.alert('Error', res?.message || 'Error transferring stock');
            }
        } catch (error) {
            console.error('Error transferring stock:', error);
            const msg = error?.response?.data?.message || error?.message || 'Error transferring stock';
            Alert.alert('Error', msg);
        } finally {
            setTransferringStock(false);
        }
    };

    const searchPatients = async (query) => {
        setPatientSearch(query);
        if (usageForm.patientId) {
            setUsageForm(prev => ({ ...prev, patientId: '' }));
        }
        if (query.trim().length < 2) {
            setPatients([]);
            return;
        }
        try {
            const res = await billingAPI.searchPatients(query.trim());
            if (res && res.success) {
                setPatients(res.patients || []);
            }
        } catch (error) {
            console.error('Error searching patients:', error);
        }
    };

    const handleUsage = async () => {
        if (recordingUsage) return;
        if (!usageForm.departmentId) {
            Alert.alert('Validation Error', 'Please select a department');
            return;
        }
        if (!usageForm.patientId) {
            Alert.alert('Validation Error', 'Please search and select a patient');
            return;
        }
        if (!usageForm.medicineId) {
            Alert.alert('Validation Error', 'Please select a medicine');
            return;
        }
        const qty = Number(usageForm.quantity);
        if (isNaN(qty) || qty <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid quantity');
            return;
        }
        const price = Number(usageForm.unitPrice);
        if (isNaN(price) || price < 0) {
            Alert.alert('Validation Error', 'Please enter a valid unit price');
            return;
        }

        setRecordingUsage(true);
        try {
            const res = await pharmacyAPI.recordDepartmentUsage({
                departmentId: usageForm.departmentId,
                medicineId: usageForm.medicineId,
                patientId: usageForm.patientId,
                quantity: qty,
                unitPrice: price
            });
            if (res && (res.success || res._id || res.id)) {
                Alert.alert('Success', 'Usage recorded and patient billed successfully!');
                setShowUsageModal(false);
                setUsageForm({ departmentId: '', medicineId: '', patientId: '', quantity: '', unitPrice: '' });
                setPatientSearch('');
                setPatients([]);
                fetchData();
            } else {
                Alert.alert('Error', res?.message || 'Error recording usage');
            }
        } catch (error) {
            console.error('Error recording usage:', error);
            const msg = error?.response?.data?.message || error?.message || 'Error recording usage';
            Alert.alert('Error', msg);
        } finally {
            setRecordingUsage(false);
        }
    };

    const handleUsageMedicineChange = (itemValue) => {
        const medId = itemValue;
        const stockItem = stocks.find(s => (s.medicineId?._id || s.medicineId?.id) === medId && (s.departmentId?._id || s.departmentId?.id) === usageForm.departmentId);

        setUsageForm(prev => ({
            ...prev,
            medicineId: medId,
            unitPrice: stockItem ? (stockItem.medicineId?.sellingPrice || stockItem.medicineId?.mrp || 0).toString() : '0'
        }));
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
            <View style={[styles.headerActions, { flexDirection: isLargeScreen ? 'row' : 'column', alignItems: isLargeScreen ? 'center' : 'stretch' }]}>
                <View style={{ flex: 1, marginBottom: isLargeScreen ? 0 : 12 }}>
                    <Text style={styles.headerTitle}>Departments & Stock Transfers</Text>
                </View>
                <View style={[styles.actionButtons, { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }]}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowDeptModal(true)}>
                        <Text style={styles.btnPrimaryText}>+ Add Department</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnWarning} onPress={() => setShowTransferModal(true)}>
                        <Text style={styles.btnWarningText}>→ Transfer to Dept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSuccess} onPress={() => setShowUsageModal(true)}>
                        <Text style={styles.btnSuccessText}>⚡ Record Usage & Bill</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.departmentsGrid}>
                {departments.map(dept => (
                    <View key={dept._id || dept.id} style={styles.departmentCard}>
                        <Text style={styles.deptCardTitle}>{dept.name}</Text>
                        <Text style={styles.deptCardDesc}>{dept.description || 'No description'}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.stockTableContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                    <Text style={styles.tableTitle}>Department Stock Levels</Text>
                    {isMobile && <Text style={{ fontSize: 11, color: '#94a3b8' }}>↔ Scrollable</Text>}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                    <View style={{ minWidth: 600 }}>
                        <View style={styles.tableHead}>
                            <Text style={[styles.th, { width: 150 }]}>Department</Text>
                            <Text style={[styles.th, { width: 200 }]}>Medicine</Text>
                            <Text style={[styles.th, { width: 100 }]}>Quantity</Text>
                            <Text style={[styles.th, { width: 150 }]}>Last Updated</Text>
                        </View>
                        {stocks.map(stock => (
                            <View key={stock._id || stock.id} style={styles.tableRow}>
                                <Text style={[styles.td, { width: 150 }]}>{stock.departmentId?.name || 'Unknown'}</Text>
                                <Text style={[styles.td, { width: 200 }]}>{stock.medicineId?.name || 'Unknown'}</Text>
                                <Text style={[styles.td, { width: 100, fontWeight: '600' }]}>{stock.quantity}</Text>
                                <Text style={[styles.td, { width: 150 }]}>
                                    {stock.updatedAt ? new Date(stock.updatedAt).toLocaleDateString() : 'N/A'}
                                </Text>
                            </View>
                        ))}
                        {stocks.length === 0 && (
                            <View style={styles.tableRow}>
                                <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>
                                    {loadingData ? 'Loading stocks...' : 'No department stock records found.'}
                                </Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </View>

            {/* Department Modal */}
            <Modal visible={showDeptModal} transparent={true} animationType="fade" onRequestClose={() => setShowDeptModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '90%', width: isMobile ? '95%' : 480 }]}>
                        <Text style={styles.modalTitle}>Add New Department</Text>

                        <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Department Name *</Text>
                                <TextInput
                                    style={styles.formInput}
                                    value={deptForm.name}
                                    onChangeText={(val) => setDeptForm(prev => ({ ...prev, name: val }))}
                                    placeholder="e.g., ICU, Ward A, ER"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Description</Text>
                                <TextInput
                                    style={[styles.formInput, { height: 80 }]}
                                    value={deptForm.description}
                                    onChangeText={(val) => setDeptForm(prev => ({ ...prev, description: val }))}
                                    placeholder="Optional description"
                                    placeholderTextColor="#94a3b8"
                                    multiline={true}
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowDeptModal(false)} disabled={creatingDept}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btnPrimary, creatingDept && { opacity: 0.7 }]} onPress={handleCreateDepartment} disabled={creatingDept}>
                                {creatingDept ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.btnPrimaryText}>Create</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Transfer Modal */}
            <Modal visible={showTransferModal} transparent={true} animationType="fade" onRequestClose={() => setShowTransferModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '92%', width: isMobile ? '95%' : 500, flexDirection: 'column' }]}>
                        <Text style={styles.modalTitle}>Transfer Stock to Department</Text>

                        <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Department *</Text>
                                <DropdownSelect
                                    insideModal={true}
                                    options={[
                                        { label: 'Select Department', value: '' },
                                        ...departments.map(d => ({ label: d.name, value: d._id || d.id }))
                                    ]}
                                    value={transferForm.departmentId}
                                    onChange={(val) => setTransferForm(prev => ({ ...prev, departmentId: val }))}
                                    placeholder="Select Department"
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Medicine (From Main Stock) *</Text>
                                <DropdownSelect
                                    insideModal={true}
                                    options={[
                                        { label: 'Select Medicine', value: '' },
                                        ...inventory.map(med => ({
                                            label: `${med.name} (Available: ${med.stockQuantity != null ? med.stockQuantity : (med.stock || 0)})`,
                                            value: med._id || med.id
                                        }))
                                    ]}
                                    value={transferForm.medicineId}
                                    onChange={(val) => setTransferForm(prev => ({ ...prev, medicineId: val }))}
                                    placeholder="Select Medicine"
                                    searchable={true}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Quantity to Transfer *</Text>
                                <TextInput
                                    style={styles.formInput}
                                    value={transferForm.quantity}
                                    onChangeText={(val) => setTransferForm(prev => ({ ...prev, quantity: val }))}
                                    keyboardType="numeric"
                                    placeholder="Enter quantity"
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowTransferModal(false)} disabled={transferringStock}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btnPrimary, transferringStock && { opacity: 0.7 }]} onPress={handleTransfer} disabled={transferringStock}>
                                {transferringStock ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.btnPrimaryText}>Transfer</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Usage Modal */}
            <Modal visible={showUsageModal} transparent={true} animationType="fade" onRequestClose={() => setShowUsageModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '94%', width: isMobile ? '95%' : 540, flexDirection: 'column' }]}>
                        <Text style={styles.modalTitle}>Record Usage & Bill Patient</Text>

                        <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }}>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Department Using Stock *</Text>
                                <DropdownSelect
                                    insideModal={true}
                                    options={[
                                        { label: 'Select Department', value: '' },
                                        ...departments.map(d => ({ label: d.name, value: d._id || d.id }))
                                    ]}
                                    value={usageForm.departmentId}
                                    onChange={(val) => setUsageForm(prev => ({ ...prev, departmentId: val, medicineId: '' }))}
                                    placeholder="Select Department"
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Patient (Search) *</Text>
                                <TextInput
                                    style={styles.formInput}
                                    value={patientSearch}
                                    onChangeText={searchPatients}
                                    placeholder="Type patient name or ID..."
                                    placeholderTextColor="#94a3b8"
                                />
                                {patients.length > 0 && !usageForm.patientId && (
                                    <View style={styles.searchResults}>
                                        {patients.map(p => (
                                            <TouchableOpacity
                                                key={p._id || p.id}
                                                style={styles.searchResultItem}
                                                onPress={() => {
                                                    setUsageForm(prev => ({ ...prev, patientId: p._id || p.id }));
                                                    setPatientSearch(`${p.name} (${p.patientId || 'ID'})`);
                                                    setPatients([]);
                                                }}
                                            >
                                                <Text style={styles.searchResultText}>{p.name} - {p.patientId || ''}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Medicine Used *</Text>
                                <DropdownSelect
                                    insideModal={true}
                                    options={[
                                        { label: 'Select Medicine', value: '' },
                                        ...stocks.filter(s => (s.departmentId?._id || s.departmentId?.id) === usageForm.departmentId).map(s => ({
                                            label: `${s.medicineId?.name || 'Medicine'} (Dept Stock: ${s.quantity})`,
                                            value: s.medicineId?._id || s.medicineId?.id
                                        }))
                                    ]}
                                    value={usageForm.medicineId}
                                    onChange={handleUsageMedicineChange}
                                    placeholder="Select Medicine"
                                    searchable={true}
                                />
                            </View>

                            <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
                                <View style={[styles.formGroup, !isMobile && { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Quantity Used *</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={usageForm.quantity}
                                        onChangeText={(val) => setUsageForm(prev => ({ ...prev, quantity: val }))}
                                        keyboardType="numeric"
                                        placeholder="Qty"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>
                                <View style={[styles.formGroup, !isMobile && { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Unit Price (₹) *</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={usageForm.unitPrice}
                                        onChangeText={(val) => setUsageForm(prev => ({ ...prev, unitPrice: val }))}
                                        keyboardType="numeric"
                                        placeholder="Unit Price"
                                        placeholderTextColor="#94a3b8"
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowUsageModal(false)} disabled={recordingUsage}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btnSuccess, recordingUsage && { opacity: 0.7 }]} onPress={handleUsage} disabled={recordingUsage}>
                                {recordingUsage ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.btnSuccessText}>Record & Bill</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f8f9fa',
    },
    headerActions: {
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 15,
    },
    headerTitle: {
        fontSize: 22, // Reduced from standard bold if requested, but web CSS has font-weight: 600
        fontWeight: 'normal',
        color: '#2c3e50',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        flexWrap: 'wrap',
    },
    btnPrimary: {
        backgroundColor: '#0066cc',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    btnPrimaryText: {
        color: '#ffffff',
        fontWeight: 'normal', // Removed bold
    },
    btnSuccess: {
        backgroundColor: '#10b981',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    btnSuccessText: {
        color: '#ffffff',
        fontWeight: 'normal',
    },
    btnWarning: {
        backgroundColor: '#f59e0b',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    btnWarningText: {
        color: '#ffffff',
        fontWeight: 'normal',
    },

    departmentsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 20,
        marginBottom: 30,
    },
    departmentCard: {
        flex: 1,
        minWidth: 300,
        backgroundColor: '#ffffff',
        padding: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    deptCardTitle: {
        marginVertical: 0,
        marginBottom: 8,
        color: '#1e293b',
        fontSize: 18,
    },
    deptCardDesc: {
        marginVertical: 0,
        color: '#64748b',
        fontSize: 14,
    },

    stockTableContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    tableTitle: {
        fontSize: 16,
        color: '#2c3e50',
        marginBottom: 15,
    },
    tableHead: {
        flexDirection: 'row',
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    th: {
        padding: 12,
        color: '#475569',
        fontWeight: 'normal', // web has 600, forced normal by instructions
        textAlign: 'left',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    td: {
        padding: 12,
        color: '#334155',
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#ffffff',
        padding: 24,
        borderRadius: 12,
        width: '90%',
        maxWidth: 500,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 25,
        elevation: 5,
    },
    modalTitle: {
        marginTop: 0,
        marginBottom: 20,
        color: '#1e293b',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 10,
        fontSize: 18,
    },
    formGroup: {
        marginBottom: 16,
    },
    formLabel: {
        marginBottom: 6,
        color: '#475569',
        fontWeight: 'normal',
        fontSize: 14,
    },
    formInput: {
        width: '100%',
        padding: 10,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        fontSize: 15,
        color: '#000000',
    },
    pickerWrapper: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        overflow: 'hidden',
    },
    picker: {
        width: '100%',
        height: 45,
        color: '#000000',
    },
    searchResults: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 4,
        marginTop: 4,
        maxHeight: 150,
    },
    searchResultItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    searchResultText: {
        color: '#334155',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 24,
    },
    btnSecondary: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    btnSecondaryText: {
        color: '#475569',
        fontWeight: 'normal',
    },
});

export default PharmacyDepartments;
