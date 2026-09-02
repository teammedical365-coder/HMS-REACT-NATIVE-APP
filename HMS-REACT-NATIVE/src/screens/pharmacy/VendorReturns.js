import React, { useState, useEffect } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, ScrollView, 
    StyleSheet, ActivityIndicator, Alert, Dimensions 
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { pharmacyAPI } from '../../utils/api';

const { width } = Dimensions.get('window');

const VendorReturns = () => {
    const [returnsHistory, setReturnsHistory] = useState([]);
    const [inventory, setInventory] = useState([]);
    
    // Form State
    const [vendorName, setVendorName] = useState('');
    const [invoiceOrBillNo, setInvoiceOrBillNo] = useState('');
    const [returnItems, setReturnItems] = useState([]);
    
    // Draft Item State
    const [selectedMedicineId, setSelectedMedicineId] = useState('');
    const [returnQuantity, setReturnQuantity] = useState('1');
    const [returnReason, setReturnReason] = useState('Expired');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [returnsRes, invRes] = await Promise.all([
                pharmacyAPI.getVendorReturns(),
                pharmacyAPI.getInventory()
            ]);
            if (returnsRes.success) setReturnsHistory(returnsRes.returns || []);
            if (invRes.success) setInventory(invRes.data || []);
        } catch (error) {
            console.error('Error fetching initial data:', error);
        }
    };

    const handleAddItem = () => {
        const qty = Number(returnQuantity);
        if (!selectedMedicineId || qty <= 0) return;
        
        const medicine = inventory.find(i => i._id === selectedMedicineId);
        if (!medicine) return;

        if (qty > medicine.stock) {
            Alert.alert('Limit Exceeded', `Cannot return more than current stock (${medicine.stock})`);
            return;
        }

        const newItem = {
            inventoryId: medicine._id,
            medicineName: medicine.name,
            batchNumber: medicine.batchNumber || '',
            quantityReturned: qty,
            unitPrice: medicine.buyingPrice || medicine.sellingPrice || 0,
            reason: returnReason
        };

        setReturnItems([...returnItems, newItem]);
        setSelectedMedicineId('');
        setReturnQuantity('1');
    };

    const handleRemoveItem = (index) => {
        setReturnItems(returnItems.filter((_, i) => i !== index));
    };

    const totalReturnAmount = returnItems.reduce((sum, item) => sum + (item.quantityReturned * item.unitPrice), 0);

    const handleSubmitReturn = async () => {
        if (!vendorName) return Alert.alert('Validation Error', 'Vendor Name is required');
        if (returnItems.length === 0) return Alert.alert('Validation Error', 'Add at least one item to return');

        setLoading(true);
        try {
            const payload = {
                vendorName,
                invoiceOrBillNo,
                items: returnItems,
                totalReturnAmount
            };

            const res = await pharmacyAPI.createVendorReturn(payload);
            if (res.success) {
                Alert.alert('Success', 'Vendor return submitted successfully');
                // Reset form
                setVendorName('');
                setInvoiceOrBillNo('');
                setReturnItems([]);
                // Refresh data
                fetchInitialData();
            } else {
                Alert.alert('Error', res.message || 'Error submitting return');
            }
        } catch (error) {
            Alert.alert('Error', 'Error submitting return');
            console.error(error);
        }
        setLoading(false);
    };

    const isLargeScreen = width > 768;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Vendor Returns (RTV)</Text>
            </View>

            <View style={[styles.mainLayout, !isLargeScreen && { flexDirection: 'column' }]}>
                {/* Left Panel: Return Form */}
                <View style={[styles.panel, isLargeScreen && { flex: 1 }]}>
                    <Text style={styles.panelTitle}>New Return to Vendor</Text>
                    
                    <View style={styles.formGrid}>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Vendor Name *</Text>
                            <TextInput 
                                style={styles.input}
                                value={vendorName}
                                onChangeText={setVendorName}
                                placeholder="e.g. PharmaCorp Ltd."
                            />
                        </View>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Invoice/Bill No.</Text>
                            <TextInput 
                                style={styles.input}
                                value={invoiceOrBillNo}
                                onChangeText={setInvoiceOrBillNo}
                                placeholder="Original Invoice No"
                            />
                        </View>
                    </View>

                    <View style={styles.addItemSection}>
                        <Text style={styles.addItemTitle}>Add Medicine to Return</Text>
                        <View style={[styles.addItemGrid, !isLargeScreen && { flexDirection: 'column', alignItems: 'stretch' }]}>
                            <View style={[styles.formGroup, isLargeScreen && { flex: 2 }]}>
                                <Text style={styles.labelSmall}>Select Medicine</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={selectedMedicineId}
                                        onValueChange={setSelectedMedicineId}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="-- Choose from Inventory --" value="" />
                                        {inventory.filter(i => i.stock > 0).map(i => (
                                            <Picker.Item key={i._id} label={`${i.name} (Stock: ${i.stock})`} value={i._id} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>
                            <View style={[styles.formGroup, isLargeScreen && { flex: 1 }]}>
                                <Text style={styles.labelSmall}>Qty</Text>
                                <TextInput 
                                    style={styles.input}
                                    value={returnQuantity}
                                    onChangeText={setReturnQuantity}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.formGroup, isLargeScreen && { flex: 1 }]}>
                                <Text style={styles.labelSmall}>Reason</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={returnReason}
                                        onValueChange={setReturnReason}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Expired" value="Expired" />
                                        <Picker.Item label="Damaged" value="Damaged" />
                                        <Picker.Item label="Excess Stock" value="Excess Stock" />
                                        <Picker.Item label="Other" value="Other" />
                                    </Picker>
                                </View>
                            </View>
                            <View style={[styles.formGroup, isLargeScreen && { justifyContent: 'flex-end', marginBottom: 0 }]}>
                                <TouchableOpacity style={styles.btnAdd} onPress={handleAddItem}>
                                    <Text style={styles.btnAddText}>Add</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {returnItems.length > 0 && (
                        <View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ minWidth: 600, width: '100%' }}>
                                    <View style={styles.tableHeadRow}>
                                        <Text style={[styles.tableHead, { width: 150 }]}>Medicine</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Batch</Text>
                                        <Text style={[styles.tableHead, { width: 80 }]}>Qty</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Price</Text>
                                        <Text style={[styles.tableHead, { width: 120 }]}>Reason</Text>
                                        <Text style={[styles.tableHead, { width: 50 }]}></Text>
                                    </View>
                                    {returnItems.map((item, index) => (
                                        <View key={index} style={styles.tableRow}>
                                            <Text style={[styles.tableCell, { width: 150 }]}>{item.medicineName}</Text>
                                            <Text style={[styles.tableCell, { width: 100 }]}>{item.batchNumber}</Text>
                                            <Text style={[styles.tableCell, { width: 80 }]}>{item.quantityReturned}</Text>
                                            <Text style={[styles.tableCell, { width: 100 }]}>₹{item.unitPrice}</Text>
                                            <Text style={[styles.tableCell, { width: 120 }]}>{item.reason}</Text>
                                            <TouchableOpacity 
                                                style={{ width: 50, padding: 8, alignItems: 'flex-end' }}
                                                onPress={() => handleRemoveItem(index)}
                                            >
                                                <Text style={styles.textRemove}>✕</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>

                            <View style={styles.totalBox}>
                                <Text style={styles.totalBoxLabel}>Total Return Amount:</Text>
                                <Text style={styles.totalBoxValue}>₹{totalReturnAmount.toFixed(2)}</Text>
                            </View>
                            
                            <View style={styles.submitRow}>
                                <TouchableOpacity 
                                    style={[styles.btnSubmit, loading && { opacity: 0.7 }]} 
                                    onPress={handleSubmitReturn}
                                    disabled={loading}
                                >
                                    <Text style={styles.btnSubmitText}>{loading ? 'Submitting...' : 'Submit Return'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* Right Panel: History */}
                <View style={[styles.panel, isLargeScreen && { flex: 1 }]}>
                    <Text style={styles.panelTitle}>Return History</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ minWidth: 500, width: '100%' }}>
                            <View style={styles.historyTableHeadRow}>
                                <Text style={[styles.historyTableHead, { width: 100 }]}>Date</Text>
                                <Text style={[styles.historyTableHead, { width: 150 }]}>Vendor</Text>
                                <Text style={[styles.historyTableHead, { width: 80 }]}>Items</Text>
                                <Text style={[styles.historyTableHead, { width: 100 }]}>Amount</Text>
                                <Text style={[styles.historyTableHead, { width: 100 }]}>Status</Text>
                            </View>
                            
                            {returnsHistory.length === 0 ? (
                                <View style={styles.noHistory}>
                                    <Text style={styles.noHistoryText}>No returns found</Text>
                                </View>
                            ) : (
                                returnsHistory.map((ret, idx) => (
                                    <View key={idx} style={styles.historyTableRow}>
                                        <Text style={[styles.historyTableCell, { width: 100 }]}>{new Date(ret.returnDate).toLocaleDateString()}</Text>
                                        <Text style={[styles.historyTableCell, { width: 150, fontWeight: '500' }]}>{ret.vendorName}</Text>
                                        <Text style={[styles.historyTableCell, { width: 80 }]}>{ret.items?.length || 0}</Text>
                                        <Text style={[styles.historyTableCell, { width: 100, color: '#dc2626', fontWeight: '500' }]}>₹{ret.totalReturnAmount}</Text>
                                        <View style={{ width: 100, padding: 12, justifyContent: 'center' }}>
                                            <View style={styles.statusBadge}>
                                                <Text style={styles.statusBadgeText}>{ret.status}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    contentContainer: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    mainLayout: {
        flexDirection: 'row',
        gap: 20,
    },
    panel: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
        marginBottom: 20,
    },
    panelTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#000',
    },
    formGrid: {
        flexDirection: width > 768 ? 'row' : 'column',
        gap: 15,
        marginBottom: 20,
    },
    formGroup: {
        flex: 1,
        marginBottom: 10,
    },
    label: {
        marginBottom: 5,
        fontWeight: '500',
        color: '#000',
    },
    input: {
        width: '100%',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 4,
        color: '#000',
        height: 40,
    },
    addItemSection: {
        padding: 15,
        backgroundColor: '#f8fafc',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20,
    },
    addItemTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#000',
    },
    addItemGrid: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-end',
    },
    labelSmall: {
        fontSize: 12,
        marginBottom: 4,
        color: '#000',
    },
    pickerWrapper: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 4,
        overflow: 'hidden',
        height: 40,
        backgroundColor: 'white',
        justifyContent: 'center',
    },
    picker: {
        width: '100%',
        height: 40,
        color: '#000',
    },
    btnAdd: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#3b82f6',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        height: 40,
    },
    btnAddText: {
        color: '#fff',
        fontWeight: 'normal',
    },
    tableHeadRow: {
        flexDirection: 'row',
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
    },
    tableHead: {
        padding: 8,
        fontSize: 12,
        color: '#64748b',
        fontWeight: 'bold',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        alignItems: 'center',
    },
    tableCell: {
        padding: 8,
        fontSize: 14,
        color: '#000',
    },
    textRemove: {
        color: '#ef4444',
        fontSize: 16,
        fontWeight: 'bold',
    },
    totalBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#f1f5f9',
        borderRadius: 6,
        marginTop: 15,
    },
    totalBoxLabel: {
        fontWeight: 'bold',
        color: '#000',
    },
    totalBoxValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f766e',
    },
    submitRow: {
        marginTop: 20,
        alignItems: 'flex-end',
    },
    btnSubmit: {
        paddingVertical: 10,
        paddingHorizontal: 24,
        backgroundColor: '#10b981',
        borderRadius: 6,
        alignItems: 'center',
    },
    btnSubmitText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    historyTableHeadRow: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
    },
    historyTableHead: {
        padding: 12,
        fontSize: 13,
        color: '#475569',
        fontWeight: 'bold',
    },
    historyTableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        alignItems: 'center',
    },
    historyTableCell: {
        padding: 12,
        fontSize: 14,
        color: '#000',
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        backgroundColor: '#dcfce3',
        alignSelf: 'flex-start',
    },
    statusBadgeText: {
        color: '#166534',
        fontSize: 12,
        fontWeight: 'bold',
    },
    noHistory: {
        padding: 20,
        alignItems: 'center',
    },
    noHistoryText: {
        color: '#94a3b8',
    }
});

export default VendorReturns;
