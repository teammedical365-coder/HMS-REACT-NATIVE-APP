import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Dimensions } from 'react-native';
import { pharmacyAPI, billingAPI } from '../../utils/api';
import { Picker } from '@react-native-picker/picker'; // Using Picker for dropdowns

const { width } = Dimensions.get('window');

const PharmacyDepartments = () => {
    const [departments, setDepartments] = useState([]);
    const [stocks, setStocks] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [patients, setPatients] = useState([]);
    
    // Modals state
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showUsageModal, setShowUsageModal] = useState(false);

    // Form states
    const [deptForm, setDeptForm] = useState({ name: '', description: '' });
    const [transferForm, setTransferForm] = useState({ departmentId: '', medicineId: '', quantity: '' });
    const [usageForm, setUsageForm] = useState({ departmentId: '', medicineId: '', patientId: '', quantity: '', unitPrice: '' });
    const [patientSearch, setPatientSearch] = useState('');

    useEffect(() => {
        fetchData();
        fetchInventory();
    }, []);

    const fetchData = async () => {
        try {
            const deptRes = await pharmacyAPI.getDepartments();
            if (deptRes.success) setDepartments(deptRes.departments || []);

            const stockRes = await pharmacyAPI.getDepartmentStocks();
            if (stockRes.success) setStocks(stockRes.stocks || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const fetchInventory = async () => {
        try {
            const res = await pharmacyAPI.getInventory();
            const invData = res.medicines || res.inventory || res.data || res || [];
            setInventory(Array.isArray(invData) ? invData : []);
        } catch (error) {
            console.error('Error fetching inventory:', error);
        }
    };

    const handleCreateDepartment = async () => {
        try {
            const res = await pharmacyAPI.createDepartment(deptForm);
            if (res.success) {
                setShowDeptModal(false);
                setDeptForm({ name: '', description: '' });
                fetchData();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleTransfer = async () => {
        try {
            const res = await pharmacyAPI.transferToDepartment({
                ...transferForm,
                quantity: Number(transferForm.quantity)
            });
            if (res.success) {
                setShowTransferModal(false);
                setTransferForm({ departmentId: '', medicineId: '', quantity: '' });
                fetchData();
                fetchInventory();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const searchPatients = async (query) => {
        setPatientSearch(query);
        if (usageForm.patientId) {
            setUsageForm({ ...usageForm, patientId: '' });
        }
        if (query.length < 2) {
            setPatients([]);
            return;
        }
        try {
            const res = await billingAPI.searchPatients(query);
            if (res.success) {
                setPatients(res.patients || []);
            }
        } catch (error) {
            console.error('Error searching patients:', error);
        }
    };

    const handleUsage = async () => {
        try {
            const res = await pharmacyAPI.recordDepartmentUsage({
                ...usageForm,
                quantity: Number(usageForm.quantity),
                unitPrice: Number(usageForm.unitPrice)
            });
            if (res.success) {
                setShowUsageModal(false);
                setUsageForm({ departmentId: '', medicineId: '', patientId: '', quantity: '', unitPrice: '' });
                setPatientSearch('');
                fetchData();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleUsageMedicineChange = (itemValue) => {
        const medId = itemValue;
        const stockItem = stocks.find(s => s.medicineId?._id === medId && s.departmentId?._id === usageForm.departmentId);
        
        setUsageForm(prev => ({
            ...prev,
            medicineId: medId,
            unitPrice: stockItem ? (stockItem.medicineId?.sellingPrice || 0).toString() : '0'
        }));
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.headerActions}>
                <Text style={styles.headerTitle}>Departments & Stock Transfers</Text>
                <View style={styles.actionButtons}>
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
                    <View key={dept._id} style={styles.departmentCard}>
                        <Text style={styles.deptCardTitle}>{dept.name}</Text>
                        <Text style={styles.deptCardDesc}>{dept.description || 'No description'}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.stockTableContainer}>
                <Text style={styles.tableTitle}>Department Stock Levels</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ minWidth: 600 }}>
                        <View style={styles.tableHead}>
                            <Text style={[styles.th, { width: 150 }]}>Department</Text>
                            <Text style={[styles.th, { width: 200 }]}>Medicine</Text>
                            <Text style={[styles.th, { width: 100 }]}>Quantity</Text>
                            <Text style={[styles.th, { width: 150 }]}>Last Updated</Text>
                        </View>
                        {stocks.map(stock => (
                            <View key={stock._id} style={styles.tableRow}>
                                <Text style={[styles.td, { width: 150 }]}>{stock.departmentId?.name || 'Unknown'}</Text>
                                <Text style={[styles.td, { width: 200 }]}>{stock.medicineId?.name || 'Unknown'}</Text>
                                <Text style={[styles.td, { width: 100 }]}>{stock.quantity}</Text>
                                <Text style={[styles.td, { width: 150 }]}>
                                    {stock.updatedAt ? new Date(stock.updatedAt).toLocaleDateString() : 'N/A'}
                                </Text>
                            </View>
                        ))}
                        {stocks.length === 0 && (
                            <View style={styles.tableRow}>
                                <Text style={[styles.td, { flex: 1, textAlign: 'center' }]}>No department stock records found.</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </View>

            {/* Department Modal */}
            <Modal visible={showDeptModal} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add New Department</Text>
                        
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Department Name</Text>
                            <TextInput 
                                style={styles.formInput} 
                                value={deptForm.name} 
                                onChangeText={(val) => setDeptForm({...deptForm, name: val})}
                                placeholder="e.g., ICU, Ward A"
                            />
                        </View>
                        
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Description</Text>
                            <TextInput 
                                style={[styles.formInput, { height: 80 }]} 
                                value={deptForm.description} 
                                onChangeText={(val) => setDeptForm({...deptForm, description: val})}
                                multiline={true}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowDeptModal(false)}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnPrimary} onPress={handleCreateDepartment}>
                                <Text style={styles.btnPrimaryText}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Transfer Modal */}
            <Modal visible={showTransferModal} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Transfer Stock to Department</Text>
                        
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Department</Text>
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={transferForm.departmentId}
                                    onValueChange={(val) => setTransferForm({...transferForm, departmentId: val})}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="Select Department" value="" />
                                    {departments.map(d => (
                                        <Picker.Item key={d._id} label={d.name} value={d._id} />
                                    ))}
                                </Picker>
                            </View>
                        </View>
                        
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Medicine (From Main Stock)</Text>
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={transferForm.medicineId}
                                    onValueChange={(val) => setTransferForm({...transferForm, medicineId: val})}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="Select Medicine" value="" />
                                    {inventory.map(med => (
                                        <Picker.Item key={med._id} label={`${med.name} (Available: ${med.stockQuantity})`} value={med._id} />
                                    ))}
                                </Picker>
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Quantity to Transfer</Text>
                            <TextInput 
                                style={styles.formInput} 
                                value={transferForm.quantity} 
                                onChangeText={(val) => setTransferForm({...transferForm, quantity: val})}
                                keyboardType="numeric"
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowTransferModal(false)}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnPrimary} onPress={handleTransfer}>
                                <Text style={styles.btnPrimaryText}>Transfer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Usage Modal */}
            <Modal visible={showUsageModal} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Record Usage & Bill Patient</Text>
                        
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Department Using Stock</Text>
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={usageForm.departmentId}
                                    onValueChange={(val) => setUsageForm({...usageForm, departmentId: val})}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="Select Department" value="" />
                                    {departments.map(d => (
                                        <Picker.Item key={d._id} label={d.name} value={d._id} />
                                    ))}
                                </Picker>
                            </View>
                        </View>
                        
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Patient (Search)</Text>
                            <TextInput 
                                style={styles.formInput} 
                                value={patientSearch} 
                                onChangeText={searchPatients}
                                placeholder="Type patient name or ID..."
                            />
                            {patients.length > 0 && !usageForm.patientId && (
                                <View style={styles.searchResults}>
                                    {patients.map(p => (
                                        <TouchableOpacity 
                                            key={p._id} 
                                            style={styles.searchResultItem}
                                            onPress={() => {
                                                setUsageForm({...usageForm, patientId: p._id});
                                                setPatientSearch(`${p.name} (${p.patientId})`);
                                                setPatients([]);
                                            }}
                                        >
                                            <Text style={styles.searchResultText}>{p.name} - {p.patientId}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>Medicine Used</Text>
                            <View style={styles.pickerWrapper}>
                                <Picker
                                    selectedValue={usageForm.medicineId}
                                    onValueChange={handleUsageMedicineChange}
                                    style={styles.picker}
                                >
                                    <Picker.Item label="Select Medicine" value="" />
                                    {stocks.filter(s => s.departmentId?._id === usageForm.departmentId).map(s => (
                                        <Picker.Item key={s.medicineId?._id} label={`${s.medicineId?.name} (Stock: ${s.quantity})`} value={s.medicineId?._id} />
                                    ))}
                                </Picker>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                                <Text style={styles.formLabel}>Quantity Used</Text>
                                <TextInput 
                                    style={styles.formInput} 
                                    value={usageForm.quantity} 
                                    onChangeText={(val) => setUsageForm({...usageForm, quantity: val})}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                                <Text style={styles.formLabel}>Unit Price (₹)</Text>
                                <TextInput 
                                    style={styles.formInput} 
                                    value={usageForm.unitPrice} 
                                    onChangeText={(val) => setUsageForm({...usageForm, unitPrice: val})}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowUsageModal(false)}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnSuccess} onPress={handleUsage}>
                                <Text style={styles.btnSuccessText}>Record & Bill</Text>
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
        flex: 1,
        padding: 20,
        backgroundColor: '#f8f9fa',
    },
    headerActions: {
        flexDirection: width > 768 ? 'row' : 'column',
        justifyContent: 'space-between',
        alignItems: width > 768 ? 'center' : 'flex-start',
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
