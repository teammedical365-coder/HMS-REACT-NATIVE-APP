import React, { useState, useEffect } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, ScrollView, 
    StyleSheet, ActivityIndicator, Alert, Dimensions 
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { pharmacyOrderAPI, pharmacyAPI } from '../../utils/api';
// jsPDF and jsPDF-autotable removed as native PDF generation typically requires specific native libraries (e.g., expo-print). 
// Native PDF logic is stubbed.

const { width } = Dimensions.get('window');

const PharmacyReturns = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Process State
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [returnType, setReturnType] = useState('Refund');
    
    const [returnQuantities, setReturnQuantities] = useState({});
    const [returnReason, setReturnReason] = useState('');
    const [paymentMode, setPaymentMode] = useState('CASH');
    
    const [inventory, setInventory] = useState([]);
    const [exchangedItems, setExchangedItems] = useState([]); 

    useEffect(() => {
        if (selectedOrder && returnType === 'Exchange' && inventory.length === 0) {
            fetchInventory();
        }
    }, [selectedOrder, returnType]);

    const fetchInventory = async () => {
        try {
            const res = await pharmacyAPI.getInventory();
            if (res.success) setInventory(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            const res = await pharmacyOrderAPI.searchBills(searchQuery);
            if (res.success) setOrders(res.orders);
        } catch (error) {
            Alert.alert('Error', 'Search failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectOrder = (order) => {
        setSelectedOrder(order);
        const initialReturnQs = {};
        order.items.forEach((item, idx) => {
            initialReturnQs[idx] = { qty: '0', restockable: true };
        });
        setReturnQuantities(initialReturnQs);
        setExchangedItems([]);
        setReturnType('Refund');
        setReturnReason('');
    };

    const handleReturnQtyChange = (idx, field, value) => {
        setReturnQuantities(prev => ({
            ...prev,
            [idx]: {
                ...prev[idx],
                [field]: value
            }
        }));
    };

    const handleAddExchangeItem = () => {
        setExchangedItems([...exchangedItems, { medicineId: '', medicineName: '', quantity: '1', pricePerUnit: 0 }]);
    };

    const handleExchangeItemChange = (idx, field, value) => {
        const newItems = [...exchangedItems];
        if (field === 'medicineId') {
            const med = inventory.find(i => i._id === value);
            newItems[idx].medicineId = value;
            newItems[idx].medicineName = med ? med.name : '';
            newItems[idx].pricePerUnit = med ? med.sellingPrice : 0;
        } else {
            newItems[idx][field] = value;
        }
        setExchangedItems(newItems);
    };

    const handleRemoveExchangeItem = (idx) => {
        setExchangedItems(exchangedItems.filter((_, i) => i !== idx));
    };

    const getItemUnitPrice = (item) => {
        if (item.price && item.price > 0) return item.price;

        const rawName = String(item.medicineName || '').toLowerCase();
        const isLiquidOrInj = rawName.includes('injection') || rawName.includes('inj') || rawName.includes('syrup') || rawName.includes('ceftriaxone');

        let sellingPrice = Number(item.sellingPrice || item.unitRate || 0);
        if (sellingPrice === 0) {
            sellingPrice = isLiquidOrInj ? 120 : 15;
        }
        if (!isLiquidOrInj && sellingPrice >= 120) {
            sellingPrice = 15;
        }

        let effectiveRate = sellingPrice;
        if (isLiquidOrInj) {
            const volumePerUnit = Number(item.volumePerUnit || item.packSize || item.capacity || 10);
            effectiveRate = sellingPrice / volumePerUnit;
        }

        return effectiveRate;
    };

    const calculateTotals = () => {
        let totalRefund = 0;
        const returnedPayload = [];

        if (selectedOrder) {
            selectedOrder.items.forEach((item, idx) => {
                const returnData = returnQuantities[idx] || { qty: '0', restockable: true };
                const qty = Number(returnData.qty);
                if (qty > 0 && item.purchased) {
                    const unitPrice = getItemUnitPrice(item);
                    const refundAmt = qty * unitPrice;
                    totalRefund += refundAmt;
                    returnedPayload.push({
                        medicineName: item.medicineName,
                        quantity: qty,
                        pricePerUnit: unitPrice,
                        refundAmount: refundAmt,
                        restockable: returnData.restockable
                    });
                }
            });
        }

        let totalExchangeCost = 0;
        const exchangePayload = [];
        if (returnType === 'Exchange') {
            exchangedItems.forEach(item => {
                const qty = Number(item.quantity) || 0;
                if (item.medicineId && qty > 0) {
                    const cost = qty * item.pricePerUnit;
                    totalExchangeCost += cost;
                    exchangePayload.push({
                        ...item,
                        quantity: qty,
                        totalCost: cost
                    });
                }
            });
        }

        const netAmount = totalExchangeCost - totalRefund;
        return { totalRefund, totalExchangeCost, netAmount, returnedPayload, exchangePayload };
    };

    const { totalRefund, totalExchangeCost, netAmount, returnedPayload, exchangePayload } = calculateTotals();

    const handleSubmit = async () => {
        if (!selectedOrder) return;
        if (returnedPayload.length === 0) {
            return Alert.alert('Validation Error', 'Please specify quantities to return.');
        }

        let returnResponseData = null;
        const orderSnapshot = { ...selectedOrder };

        try {
            const res = await pharmacyOrderAPI.processReturn({
                originalOrderId: selectedOrder._id,
                returnType,
                returnedItems: returnedPayload,
                exchangedItems: exchangePayload,
                netAmount,
                returnReason,
                refundAmount: netAmount < 0 ? Math.abs(netAmount) : 0
            });

            if (res.success) {
                returnResponseData = res.data;
                Alert.alert('Success', `Success! ${res.message}`);
                setSelectedOrder(null);
                setSearchQuery('');
                setOrders([]);
            } else {
                Alert.alert('Warning', res.message || "Return processed but response was unexpected.");
            }
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || "Failed to process return.");
        }

        if (returnResponseData) {
            generatePDF(returnResponseData, orderSnapshot);
        }
    };

    const generatePDF = (returnData, orderInfo) => {
        // PDF logic adapted for RN environment. Use expo-print or similar if actual file generation is needed.
        console.log("PDF Generation triggered for:", returnData._id);
        Alert.alert('PDF Receipt', 'Receipt generated successfully. (Print logic requires expo-print)');
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Medicine Return & Exchange</Text>
                <Text style={styles.headerSubtitle}>Process refunds or medicine exchanges for patients.</Text>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchForm}>
                    <TextInput 
                        style={styles.searchInput}
                        placeholder="Search by Invoice ID, MRN, Name, or Mobile..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    <TouchableOpacity 
                        style={styles.btnSearch} 
                        onPress={handleSearch}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnSearchText}>Search Bill</Text>}
                    </TouchableOpacity>
                </View>

                {orders.length > 0 && !selectedOrder && (
                    <View style={styles.searchResults}>
                        <Text style={styles.resultsTitle}>Select a Bill</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ minWidth: 600 }}>
                                <View style={styles.tableHeadRow}>
                                    <Text style={[styles.tableHead, { width: 100 }]}>Date</Text>
                                    <Text style={[styles.tableHead, { width: 120 }]}>Invoice ID</Text>
                                    <Text style={[styles.tableHead, { width: 150 }]}>Patient</Text>
                                    <Text style={[styles.tableHead, { width: 100 }]}>Status</Text>
                                    <Text style={[styles.tableHead, { width: 100 }]}>Amount</Text>
                                    <Text style={[styles.tableHead, { width: 100 }]}>Action</Text>
                                </View>
                                {orders.map(order => (
                                    <View key={order._id} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { width: 100 }]}>{new Date(order.createdAt).toLocaleDateString()}</Text>
                                        <Text style={[styles.tableCell, { width: 120, fontSize: 12 }]}>{order._id}</Text>
                                        <View style={{ width: 150, padding: 12, justifyContent: 'center' }}>
                                            <Text style={{ color: '#000' }}>{order.userId?.name}</Text>
                                            <Text style={{ fontSize: 12, color: '#64748b' }}>{order.userId?.phone}</Text>
                                        </View>
                                        <Text style={[styles.tableCell, { width: 100, textTransform: 'capitalize' }]}>{order.orderStatus}</Text>
                                        <Text style={[styles.tableCell, { width: 100 }]}>₹{order.totalAmount}</Text>
                                        <View style={{ width: 100, padding: 12, justifyContent: 'center' }}>
                                            <TouchableOpacity style={styles.btnSelect} onPress={() => handleSelectOrder(order)}>
                                                <Text style={styles.btnSelectText}>Select</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                )}
            </View>

            {selectedOrder && (
                <View style={styles.processSection}>
                    <View style={styles.processHeader}>
                        <Text style={styles.processHeaderTitle}>Processing Invoice: <Text style={{ fontSize: 14 }}>{selectedOrder._id}</Text></Text>
                        <TouchableOpacity style={styles.btnCancel} onPress={() => setSelectedOrder(null)}>
                            <Text style={styles.btnCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.patientInfo}>
                        <Text style={{ fontSize: 16, color: '#000' }}>
                            <Text style={{ fontWeight: 'bold' }}>Patient: </Text>
                            {selectedOrder.userId?.name} ({selectedOrder.userId?.phone})
                        </Text>
                    </View>

                    <View style={styles.toggleType}>
                        <TouchableOpacity 
                            style={[styles.toggleLabel, returnType === 'Refund' && styles.toggleLabelActive]}
                            onPress={() => setReturnType('Refund')}
                        >
                            <Text style={returnType === 'Refund' ? styles.toggleTextActive : styles.toggleText}>Cash Refund</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.toggleLabel, returnType === 'Exchange' && styles.toggleLabelActive]}
                            onPress={() => setReturnType('Exchange')}
                        >
                            <Text style={returnType === 'Exchange' ? styles.toggleTextActive : styles.toggleText}>Exchange Medicine</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.itemsSection}>
                        <Text style={styles.sectionTitle}>Select Items to Return</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ minWidth: 600 }}>
                                <View style={styles.tableHeadRow}>
                                    <Text style={[styles.tableHead, { width: 200 }]}>Medicine</Text>
                                    <Text style={[styles.tableHead, { width: 120 }]}>Purchased Price</Text>
                                    <Text style={[styles.tableHead, { width: 100 }]}>Return Qty</Text>
                                    <Text style={[styles.tableHead, { width: 100 }]}>Restock?</Text>
                                    <Text style={[styles.tableHead, { width: 100 }]}>Refund Value</Text>
                                </View>
                                {selectedOrder.items.filter(i => i.purchased).map((item, idx) => {
                                    const retData = returnQuantities[idx] || { qty: '0', restockable: true };
                                    const unitPrice = getItemUnitPrice(item);
                                    return (
                                        <View key={idx} style={styles.tableRow}>
                                            <Text style={[styles.tableCell, { width: 200 }]}>{item.medicineName}</Text>
                                            <Text style={[styles.tableCell, { width: 120 }]}>₹{unitPrice.toFixed(2)}</Text>
                                            <View style={{ width: 100, padding: 12, justifyContent: 'center' }}>
                                                <TextInput 
                                                    style={styles.qtyInput}
                                                    value={retData.qty}
                                                    onChangeText={(val) => handleReturnQtyChange(idx, 'qty', val)}
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                            <View style={{ width: 100, padding: 12, justifyContent: 'center' }}>
                                                <TouchableOpacity 
                                                    style={[styles.checkbox, retData.restockable && styles.checkboxChecked]}
                                                    onPress={() => handleReturnQtyChange(idx, 'restockable', !retData.restockable)}
                                                >
                                                    {retData.restockable && <Text style={{ color: 'white', fontSize: 12 }}>✔</Text>}
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={[styles.tableCell, { width: 100 }]}>₹{(Number(retData.qty || 0) * unitPrice).toFixed(2)}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>

                    {returnType === 'Exchange' && (
                        <View style={styles.itemsSection}>
                            <Text style={styles.sectionTitle}>Select Items for Exchange</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ minWidth: 650 }}>
                                    <View style={styles.tableHeadRow}>
                                        <Text style={[styles.tableHead, { width: 250 }]}>Medicine</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Unit Price</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Quantity</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Total</Text>
                                        <Text style={[styles.tableHead, { width: 60 }]}>Action</Text>
                                    </View>
                                    {exchangedItems.map((item, idx) => (
                                        <View key={idx} style={styles.tableRow}>
                                            <View style={{ width: 250, padding: 12, justifyContent: 'center' }}>
                                                <View style={styles.pickerWrapper}>
                                                    <Picker
                                                        selectedValue={item.medicineId}
                                                        onValueChange={(val) => handleExchangeItemChange(idx, 'medicineId', val)}
                                                        style={styles.picker}
                                                    >
                                                        <Picker.Item label="Select Medicine" value="" />
                                                        {inventory.map(inv => (
                                                            <Picker.Item key={inv._id} label={`${inv.name} (Stock: ${inv.stock})`} value={inv._id} />
                                                        ))}
                                                    </Picker>
                                                </View>
                                            </View>
                                            <Text style={[styles.tableCell, { width: 100 }]}>₹{item.pricePerUnit}</Text>
                                            <View style={{ width: 100, padding: 12, justifyContent: 'center' }}>
                                                <TextInput 
                                                    style={styles.qtyInput}
                                                    value={item.quantity}
                                                    onChangeText={(val) => handleExchangeItemChange(idx, 'quantity', val)}
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                            <Text style={[styles.tableCell, { width: 100 }]}>₹{item.pricePerUnit * (Number(item.quantity) || 0)}</Text>
                                            <View style={{ width: 60, padding: 12, justifyContent: 'center', alignItems: 'center' }}>
                                                <TouchableOpacity style={styles.btnRemove} onPress={() => handleRemoveExchangeItem(idx)}>
                                                    <Text style={styles.btnRemoveText}>×</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                            <TouchableOpacity style={styles.btnAddItem} onPress={handleAddExchangeItem}>
                                <Text style={styles.btnAddItemText}>+ Add Medicine</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.summarySection}>
                        <Text style={styles.summaryTitle}>Summary</Text>
                        
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryText}>Total Refund Value:</Text>
                            <Text style={[styles.summaryText, styles.refundAmount]}>₹{totalRefund}</Text>
                        </View>
                        
                        {returnType === 'Exchange' && (
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryText}>Total Exchange Cost:</Text>
                                <Text style={styles.summaryText}>₹{totalExchangeCost}</Text>
                            </View>
                        )}
                        
                        <View style={styles.divider} />
                        
                        <View style={styles.summaryRowFinal}>
                            <Text style={styles.summaryTextFinal}>
                                {netAmount < 0 ? 'Amount to Refund Patient:' : 'Amount to Collect from Patient:'}
                            </Text>
                            <Text style={[styles.summaryTextFinal, netAmount < 0 ? styles.refundAmount : styles.collectAmount]}>
                                ₹{Math.abs(netAmount)}
                            </Text>
                        </View>

                        <TextInput 
                            style={styles.reasonInput}
                            placeholder="Reason for return/exchange (optional)"
                            value={returnReason}
                            onChangeText={setReturnReason}
                        />

                        <View style={styles.processActions}>
                            <TouchableOpacity style={styles.btnSubmit} onPress={handleSubmit}>
                                <Text style={styles.btnSubmitText}>Confirm & Print Receipt</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
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
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 24,
        color: '#2c3e50',
        marginBottom: 5,
        fontWeight: 'bold', // Kept generic bold for headers as standard RN practice if font missing, but colors match
    },
    headerSubtitle: {
        color: '#7f8c8d',
        fontSize: 14,
    },
    searchSection: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        marginBottom: 20,
    },
    searchForm: {
        flexDirection: width > 768 ? 'row' : 'column',
        gap: 15,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#ced4da',
        borderRadius: 4,
        fontSize: 16,
        color: '#000',
    },
    btnSearch: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#3498db',
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnSearchText: {
        color: 'white',
        fontWeight: '600',
    },
    searchResults: {
        marginTop: 20,
    },
    resultsTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 10,
    },
    tableHeadRow: {
        flexDirection: 'row',
        backgroundColor: '#f1f3f5',
    },
    tableHead: {
        padding: 12,
        color: '#495057',
        fontWeight: '600',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e9ecef',
        alignItems: 'center',
    },
    tableCell: {
        padding: 12,
        color: '#000',
    },
    btnSelect: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#2ecc71',
        borderRadius: 4,
        alignItems: 'center',
    },
    btnSelectText: {
        color: 'white',
    },
    processSection: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        marginBottom: 20,
    },
    processHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    processHeaderTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000',
    },
    btnCancel: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#e74c3c',
        borderRadius: 4,
    },
    btnCancelText: {
        color: 'white',
    },
    patientInfo: {
        marginBottom: 20,
        backgroundColor: '#f8f9fa',
        padding: 10,
        borderRadius: 4,
    },
    toggleType: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 25,
    },
    toggleLabel: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 4,
        flexDirection: 'row',
        alignItems: 'center',
    },
    toggleLabelActive: {
        backgroundColor: '#e3f2fd',
        borderColor: '#3498db',
    },
    toggleText: {
        fontWeight: '500',
        color: '#000',
    },
    toggleTextActive: {
        fontWeight: '500',
        color: '#2980b9',
    },
    itemsSection: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 10,
    },
    qtyInput: {
        width: 60,
        padding: 6,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        color: '#000',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#3498db',
        borderColor: '#3498db',
    },
    pickerWrapper: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        overflow: 'hidden',
    },
    picker: {
        width: '100%',
        height: 40,
        color: '#000',
    },
    btnRemove: {
        backgroundColor: '#e74c3c',
        width: 25,
        height: 25,
        borderRadius: 12.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnRemoveText: {
        color: 'white',
        fontWeight: 'bold',
    },
    btnAddItem: {
        marginTop: 10,
        paddingVertical: 8,
        paddingHorizontal: 15,
        backgroundColor: '#95a5a6',
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    btnAddItemText: {
        color: 'white',
    },
    summarySection: {
        backgroundColor: '#f8f9fa',
        padding: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#2c3e50',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    summaryText: {
        fontSize: 16,
        color: '#000',
    },
    summaryRowFinal: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 15,
    },
    summaryTextFinal: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
    },
    refundAmount: {
        color: '#e74c3c',
    },
    collectAmount: {
        color: '#2ecc71',
    },
    divider: {
        height: 1,
        backgroundColor: '#e9ecef',
        marginVertical: 10,
    },
    reasonInput: {
        width: '100%',
        padding: 10,
        marginTop: 15,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 4,
        color: '#000',
    },
    processActions: {
        marginTop: 25,
        alignItems: 'flex-end',
    },
    btnSubmit: {
        paddingVertical: 12,
        paddingHorizontal: 25,
        backgroundColor: '#2ecc71',
        borderRadius: 4,
    },
    btnSubmitText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default PharmacyReturns;
