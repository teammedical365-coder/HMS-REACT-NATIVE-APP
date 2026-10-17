import React, { useState, useEffect } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, ScrollView, 
    StyleSheet, ActivityIndicator, Alert, Dimensions, useWindowDimensions 
} from 'react-native';
import DropdownSelect from '../../components/common/DropdownSelect';
import { formatToDisplay } from '../../components/common/DatePickerInput';
import { pharmacyAPI } from '../../utils/api';
import { fetchPharmacyInventoryWithOffline } from '../../services/offline/offlinePharmacyService';

const VendorReturns = () => {
    const { width } = useWindowDimensions();
    const [returnsHistory, setReturnsHistory] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [loadingInventory, setLoadingInventory] = useState(false);
    const [inventoryError, setInventoryError] = useState(null);
    
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
        setLoadingInventory(true);
        setInventoryError(null);
        try {
            const [returnsRes, invRes] = await Promise.allSettled([
                pharmacyAPI.getVendorReturns(),
                fetchPharmacyInventoryWithOffline({
                    onCacheHit: (cached) => {
                        if (cached && Array.isArray(cached.medicines) && cached.medicines.length > 0) {
                            setInventory(cached.medicines);
                            setLoadingInventory(false);
                        }
                    }
                })
            ]);

            if (returnsRes.status === 'fulfilled' && returnsRes.value) {
                const rData = returnsRes.value;
                if (rData.success || Array.isArray(rData.returns)) {
                    setReturnsHistory(rData.returns || []);
                }
            }

            let loadedMedicines = [];
            if (invRes.status === 'fulfilled' && invRes.value) {
                const iData = invRes.value;
                if (Array.isArray(iData.medicines)) {
                    loadedMedicines = iData.medicines;
                } else if (Array.isArray(iData.data)) {
                    loadedMedicines = iData.data;
                } else if (Array.isArray(iData.inventory)) {
                    loadedMedicines = iData.inventory;
                } else if (Array.isArray(iData)) {
                    loadedMedicines = iData;
                }
            }

            // Fallback to direct API if offline service returned empty
            if (loadedMedicines.length === 0) {
                try {
                    const directRes = await pharmacyAPI.getInventory();
                    const directData = directRes?.medicines || directRes?.data || directRes?.inventory || directRes?.items || (Array.isArray(directRes) ? directRes : []);
                    if (Array.isArray(directData) && directData.length > 0) {
                        loadedMedicines = directData;
                    }
                } catch (directErr) {
                    console.warn('Direct getInventory fallback error in VendorReturns:', directErr);
                }
            }

            if (loadedMedicines.length > 0) {
                setInventory(loadedMedicines);
            } else if (invRes.status === 'rejected') {
                setInventoryError('Failed to load inventory');
            }
        } catch (error) {
            console.error('Error fetching initial data in VendorReturns:', error);
            setInventoryError('Failed to load inventory');
        } finally {
            setLoadingInventory(false);
        }
    };

    const handleAddItem = () => {
        const qty = Number(returnQuantity);
        if (!selectedMedicineId) {
            Alert.alert('Validation Error', 'Please select a medicine');
            return;
        }
        if (isNaN(qty) || qty <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid quantity greater than 0');
            return;
        }
        
        const medicine = inventory.find(i => (i._id || i.id) === selectedMedicineId);
        if (!medicine) {
            Alert.alert('Error', 'Selected medicine not found in inventory');
            return;
        }

        const currentStock = Number(medicine.stock ?? medicine.quantity ?? 0);
        if (currentStock > 0 && qty > currentStock) {
            Alert.alert('Limit Exceeded', `Cannot return more than current stock (${currentStock})`);
            return;
        }

        const newItem = {
            inventoryId: medicine._id || medicine.id,
            medicineName: medicine.name,
            batchNumber: medicine.batchNumber || '',
            quantityReturned: qty,
            unitPrice: Number(medicine.buyingPrice || medicine.purchasePrice || medicine.sellingPrice || 0),
            reason: returnReason
        };

        setReturnItems(prev => [...prev, newItem]);
        setSelectedMedicineId('');
        setReturnQuantity('1');
    };

    const handleRemoveItem = (index) => {
        setReturnItems(prev => prev.filter((_, i) => i !== index));
    };

    const totalReturnAmount = returnItems.reduce((sum, item) => sum + (item.quantityReturned * item.unitPrice), 0);

    const handleSubmitReturn = async () => {
        if (loading) return;
        if (!vendorName.trim()) return Alert.alert('Validation Error', 'Vendor Name is required');
        if (returnItems.length === 0) return Alert.alert('Validation Error', 'Add at least one item to return');

        setLoading(true);
        try {
            const payload = {
                vendorName: vendorName.trim(),
                invoiceOrBillNo: invoiceOrBillNo.trim(),
                items: returnItems,
                totalReturnAmount
            };

            const res = await pharmacyAPI.createVendorReturn(payload);
            if (res && (res.success || res._id || res.id)) {
                Alert.alert('Success', 'Vendor return submitted successfully');
                // Reset form
                setVendorName('');
                setInvoiceOrBillNo('');
                setReturnItems([]);
                // Refresh data
                fetchInitialData();
            } else {
                Alert.alert('Error', res?.message || 'Error submitting return');
            }
        } catch (error) {
            Alert.alert('Error', error?.response?.data?.message || error?.message || 'Error submitting return');
            console.error('Error submitting vendor return:', error);
        } finally {
            setLoading(false);
        }
    };

    const isLargeScreen = width > 900;
    const isMobile = width < 600;

    // Filter available medicines with stock > 0, or fallback to all inventory if stocks are zero/untracked
    const availableInventory = inventory.filter(i => {
        const stockVal = Number(i.stock ?? i.quantity ?? 0);
        return stockVal > 0;
    });
    const displayInventory = availableInventory.length > 0 ? availableInventory : inventory;

    const medicineDropdownOptions = [
        { label: '-- Choose from Inventory --', value: '' },
        ...displayInventory.map(i => {
            const medId = i._id || i.id;
            const stockVal = Number(i.stock ?? i.quantity ?? 0);
            const batchInfo = i.batchNumber ? ` (Batch: ${i.batchNumber})` : '';
            return {
                label: `${i.name || 'Medicine'} (Stock: ${stockVal})${batchInfo}`,
                value: medId,
            };
        })
    ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, { paddingBottom: 60 }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Vendor Returns (RTV)</Text>
            </View>

            <View style={[styles.mainLayout, !isLargeScreen && { flexDirection: 'column' }]}>
                {/* Left Panel: Return Form */}
                <View style={[styles.panel, isLargeScreen && { flex: 1.2 }]}>
                    <Text style={styles.panelTitle}>New Return to Vendor</Text>
                    
                    <View style={[styles.formGrid, { flexDirection: isMobile ? 'column' : 'row' }]}>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Vendor Name *</Text>
                            <TextInput 
                                style={styles.input}
                                value={vendorName}
                                onChangeText={setVendorName}
                                placeholder="e.g. PharmaCorp Ltd."
                                placeholderTextColor="#94a3b8"
                            />
                        </View>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Invoice/Bill No.</Text>
                            <TextInput 
                                style={styles.input}
                                value={invoiceOrBillNo}
                                onChangeText={setInvoiceOrBillNo}
                                placeholder="Original Invoice No"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>
                    </View>

                    <View style={styles.addItemSection}>
                        <Text style={styles.addItemTitle}>Add Medicine to Return</Text>
                        <View style={[styles.addItemGrid, isMobile && { flexDirection: 'column', alignItems: 'stretch' }]}>
                            <View style={[styles.formGroup, !isMobile && { flex: 2 }]}>
                                <Text style={styles.labelSmall}>Select Medicine *</Text>
                                <DropdownSelect
                                    options={medicineDropdownOptions}
                                    value={selectedMedicineId}
                                    onChange={setSelectedMedicineId}
                                    placeholder="-- Choose from Inventory --"
                                    loading={loadingInventory}
                                    loadingText="Loading medicines..."
                                    emptyText={inventoryError || (inventory.length === 0 ? "No inventory medicines found" : "No available medicines")}
                                    searchable={true}
                                />
                            </View>
                            <View style={[styles.formGroup, !isMobile && { flex: 1 }]}>
                                <Text style={styles.labelSmall}>Qty *</Text>
                                <TextInput 
                                    style={styles.input}
                                    value={returnQuantity}
                                    onChangeText={setReturnQuantity}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={[styles.formGroup, !isMobile && { flex: 1.2 }]}>
                                <Text style={styles.labelSmall}>Reason</Text>
                                <DropdownSelect
                                    options={[
                                        { label: 'Expired', value: 'Expired' },
                                        { label: 'Damaged', value: 'Damaged' },
                                        { label: 'Excess Stock', value: 'Excess Stock' },
                                        { label: 'Other', value: 'Other' },
                                    ]}
                                    value={returnReason}
                                    onChange={setReturnReason}
                                    placeholder="Select Reason"
                                />
                            </View>
                            <View style={[styles.formGroup, !isMobile && { justifyContent: 'flex-end', marginBottom: 0 }]}>
                                <TouchableOpacity style={styles.btnAdd} onPress={handleAddItem}>
                                    <Text style={styles.btnAddText}>+ Add</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {returnItems.length > 0 && (
                        <View style={{ marginTop: 10 }}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                <View style={{ minWidth: isMobile ? 520 : '100%' }}>
                                    <View style={styles.tableHeadRow}>
                                        <Text style={[styles.tableHead, { width: 150 }]}>Medicine</Text>
                                        <Text style={[styles.tableHead, { width: 90 }]}>Batch</Text>
                                        <Text style={[styles.tableHead, { width: 60 }]}>Qty</Text>
                                        <Text style={[styles.tableHead, { width: 80 }]}>Price</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Reason</Text>
                                        <Text style={[styles.tableHead, { width: 40 }]}></Text>
                                    </View>
                                    {returnItems.map((item, index) => (
                                        <View key={index} style={styles.tableRow}>
                                            <Text style={[styles.tableCell, { width: 150, fontWeight: '500' }]}>{item.medicineName}</Text>
                                            <Text style={[styles.tableCell, { width: 90, color: '#64748b' }]}>{item.batchNumber || '-'}</Text>
                                            <Text style={[styles.tableCell, { width: 60, fontWeight: '600' }]}>{item.quantityReturned}</Text>
                                            <Text style={[styles.tableCell, { width: 80 }]}>₹{item.unitPrice}</Text>
                                            <Text style={[styles.tableCell, { width: 100 }]}>{item.reason}</Text>
                                            <TouchableOpacity 
                                                style={{ width: 40, padding: 8, alignItems: 'center' }}
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
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.btnSubmitText}>Submit Return</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* Right Panel: History */}
                <View style={[styles.panel, isLargeScreen && { flex: 1 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <Text style={styles.panelTitle}>Return History</Text>
                        <TouchableOpacity onPress={fetchInitialData} style={{ padding: 4 }}>
                            <Text style={{ color: '#2563eb', fontSize: 13, fontWeight: '600' }}>Refresh</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View style={{ minWidth: 460, width: '100%' }}>
                            <View style={styles.historyTableHeadRow}>
                                <Text style={[styles.historyTableHead, { width: 90 }]}>Date</Text>
                                <Text style={[styles.historyTableHead, { width: 130 }]}>Vendor</Text>
                                <Text style={[styles.historyTableHead, { width: 60 }]}>Items</Text>
                                <Text style={[styles.historyTableHead, { width: 90 }]}>Amount</Text>
                                <Text style={[styles.historyTableHead, { width: 90 }]}>Status</Text>
                            </View>
                            
                            {returnsHistory.length === 0 ? (
                                <View style={styles.noHistory}>
                                    <Text style={styles.noHistoryText}>No returns found</Text>
                                </View>
                            ) : (
                                returnsHistory.map((ret, idx) => (
                                    <View key={ret._id || ret.id || idx} style={styles.historyTableRow}>
                                        <Text style={[styles.historyTableCell, { width: 90 }]}>{formatToDisplay(ret.returnDate || ret.createdAt)}</Text>
                                        <Text style={[styles.historyTableCell, { width: 130, fontWeight: '500' }]}>{ret.vendorName}</Text>
                                        <Text style={[styles.historyTableCell, { width: 60 }]}>{ret.items?.length || 0}</Text>
                                        <Text style={[styles.historyTableCell, { width: 90, color: '#dc2626', fontWeight: '600' }]}>₹{ret.totalReturnAmount || 0}</Text>
                                        <View style={{ width: 90, paddingVertical: 8, paddingHorizontal: 4, justifyContent: 'center' }}>
                                            <View style={[
                                                styles.statusBadge,
                                                ret.status === 'Completed' || ret.status === 'Approved' ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fef3c7' }
                                            ]}>
                                                <Text style={[
                                                    styles.statusBadgeText,
                                                    ret.status === 'Completed' || ret.status === 'Approved' ? { color: '#166534' } : { color: '#92400e' }
                                                ]}>{ret.status || 'Submitted'}</Text>
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
