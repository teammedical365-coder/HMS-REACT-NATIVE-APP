import React, { useState, useEffect } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, ScrollView, 
    StyleSheet, ActivityIndicator, Alert, Dimensions, Modal 
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { pharmacyAPI } from '../../utils/api';
// Assuming a custom hook or Redux auth slice is available natively. Using placeholder for useAuth.
// import { useAuth } from '../../store/hooks'; 
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const PurchaseInvoiceHistory = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'
    
    // Mock user for now, replace with actual auth logic if needed
    const user = { role: 'admin' }; 
    const navigation = useNavigation();

    const [showModal, setShowModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const res = await pharmacyAPI.getPurchaseInvoices();
            if (res.success && res.data) {
                setInvoices(res.data);
            }
        } catch (error) {
            console.error("Error fetching invoices:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id) => {
        Alert.alert(
            "Confirm Delete",
            "Are you sure you want to delete this invoice? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        const res = await pharmacyAPI.deletePurchaseInvoice(id);
                        if (res.success) {
                            setInvoices(invoices.filter(inv => inv._id !== id));
                        }
                    } catch (error) {
                        Alert.alert('Error', error.response?.data?.message || "Failed to delete invoice");
                    }
                }}
            ]
        );
    };

    const handleProcessInvoice = (id) => {
        Alert.alert(
            "Confirm Import",
            "Are you sure you want to process and import this invoice?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Process", onPress: async () => {
                    setLoading(true);
                    try {
                        const res = await pharmacyAPI.processPurchaseInvoice(id);
                        if (res.success) {
                            Alert.alert('Success', `Invoice processed successfully. ${res.importedCount} medicines imported.`);
                            fetchInvoices();
                        }
                    } catch (error) {
                        Alert.alert('Error', error.response?.data?.message || "Failed to process invoice");
                        setLoading(false);
                    }
                }}
            ]
        );
    };

    const handleView = async (invoice) => {
        setLoading(true);
        try {
            const res = await pharmacyAPI.getPurchaseInvoiceById(invoice._id);
            if (res.success && res.data) {
                setSelectedInvoice(res.data);
                setShowModal(true);
            }
        } catch (error) {
            Alert.alert('Error', error.response?.data?.message || "Failed to load invoice details");
        } finally {
            setLoading(false);
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        const vendorMatch = (inv.vendorName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const invoiceMatch = (inv.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
        return vendorMatch || invoiceMatch;
    }).sort((a, b) => {
        const dateA = new Date(a.uploadDate || a.createdAt);
        const dateB = new Date(b.uploadDate || b.createdAt);
        if (sortOrder === 'newest') return dateB - dateA;
        return dateA - dateB;
    });

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Purchase Invoice History</Text>
                    <Text style={styles.headerSubtitle}>Track, manage, and review all your pharmacy incoming purchase invoices.</Text>
                </View>
                <View style={styles.headerActions}>
                    <View style={styles.searchBox}>
                        <Text style={styles.searchIcon}>🔍</Text>
                        <TextInput 
                            style={styles.searchInput}
                            placeholder="Search invoice or vendor..." 
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                        />
                    </View>
                    <View style={styles.pickerWrapper}>
                        <Picker
                            selectedValue={sortOrder}
                            onValueChange={setSortOrder}
                            style={styles.picker}
                        >
                            <Picker.Item label="Latest First" value="newest" />
                            <Picker.Item label="Oldest First" value="oldest" />
                        </Picker>
                    </View>
                </View>
            </View>

            <View style={styles.tableContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ minWidth: 900 }}>
                        <View style={styles.tableHeadRow}>
                            <Text style={[styles.tableHead, { width: 150 }]}>Invoice Details</Text>
                            <Text style={[styles.tableHead, { width: 180 }]}>Vendor</Text>
                            <Text style={[styles.tableHead, { width: 120 }]}>Upload Info</Text>
                            <Text style={[styles.tableHead, { width: 120 }]}>Progress</Text>
                            <Text style={[styles.tableHead, { width: 100 }]}>Amount</Text>
                            <Text style={[styles.tableHead, { width: 100 }]}>Status</Text>
                            <Text style={[styles.tableHead, { width: 130, textAlign: 'right' }]}>Actions</Text>
                        </View>
                        
                        {loading ? (
                            <View style={styles.emptyState}>
                                <ActivityIndicator size="large" color="#0ea5e9" />
                                <Text style={styles.emptyStateText}>Loading real-time invoice data...</Text>
                            </View>
                        ) : filteredInvoices.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={{ fontSize: 48, marginBottom: 10 }}>📄</Text>
                                <Text style={styles.emptyStateTitle}>No Invoices Found</Text>
                                <Text style={styles.emptyStateText}>Try adjusting your search filters or upload a new invoice.</Text>
                            </View>
                        ) : (
                            filteredInvoices.map((inv) => (
                                <View key={inv._id} style={styles.tableRow}>
                                    <View style={[styles.tableCell, { width: 150 }]}>
                                        <Text style={styles.invoiceNumber}>{inv.invoiceNumber || 'N/A'}</Text>
                                        <Text style={styles.invoiceDate}>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : 'No Date'}</Text>
                                    </View>
                                    <View style={[styles.tableCell, { width: 180, flexDirection: 'row', alignItems: 'center' }]}>
                                        <View style={styles.vendorAvatar}>
                                            <Text style={styles.vendorAvatarText}>
                                                {((inv.vendorName && !/plot|road|street|floor|nagar|marg/i.test(inv.vendorName)) ? inv.vendorName[0] : 'V').toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            {inv.vendorName && /plot|road|street|floor|nagar|marg/i.test(inv.vendorName) ? (
                                                <View>
                                                    <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: 'bold' }}>Vendor Missing</Text>
                                                    <Text style={{ fontSize: 11, color: '#94a3b8' }} numberOfLines={1}>Addr: {inv.vendorName}</Text>
                                                </View>
                                            ) : (
                                                <Text style={styles.vendorName} numberOfLines={2}>{inv.vendorName || 'Unknown Vendor'}</Text>
                                            )}
                                        </View>
                                    </View>
                                    <View style={[styles.tableCell, { width: 120 }]}>
                                        <Text style={styles.uploadDate}>{inv.uploadDate ? new Date(inv.uploadDate).toLocaleDateString() : 'N/A'}</Text>
                                        <Text style={styles.uploadTime}>{inv.uploadTime || 'N/A'}</Text>
                                    </View>
                                    <View style={[styles.tableCell, { width: 120 }]}>
                                        <View style={styles.progressTextRow}>
                                            <Text style={styles.progressTextImported}>{inv.importedMedicines || 0} Imp.</Text>
                                            <Text style={styles.progressTextTotal}>{inv.totalMedicines || 0} Tot.</Text>
                                        </View>
                                        <View style={styles.progressBarBg}>
                                            <View style={[styles.progressBarFill, { width: `${Math.min(100, ((inv.importedMedicines || 0) / (inv.totalMedicines || 1)) * 100)}%`, backgroundColor: inv.status === 'Completed' ? '#10b981' : '#3b82f6' }]} />
                                        </View>
                                    </View>
                                    <View style={[styles.tableCell, { width: 100 }]}>
                                        <Text style={styles.amountText}>₹{inv.grandTotal?.toLocaleString('en-IN') || 0}</Text>
                                    </View>
                                    <View style={[styles.tableCell, { width: 100 }]}>
                                        <View style={[styles.statusBadge, inv.status === 'Completed' ? styles.statusCompleted : inv.status === 'Cancelled' ? styles.statusCancelled : styles.statusPending]}>
                                            <Text style={[styles.statusBadgeText, inv.status === 'Completed' ? styles.statusTextCompleted : inv.status === 'Cancelled' ? styles.statusTextCancelled : styles.statusTextPending]}>{inv.status}</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.tableCell, { width: 130, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }]}>
                                        <TouchableOpacity style={styles.actionBtn} onPress={() => handleView(inv)}>
                                            <Text>👁️</Text>
                                        </TouchableOpacity>
                                        {inv.status === 'Pending' && (
                                            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={() => handleProcessInvoice(inv._id)}>
                                                <Text style={{ color: 'white' }}>▶</Text>
                                            </TouchableOpacity>
                                        )}
                                        {inv.uploadedPDF?.generatedName && (
                                            <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert('Download', 'PDF download not supported natively without extra package')}>
                                                <Text>⬇️</Text>
                                            </TouchableOpacity>
                                        )}
                                        {user?.role === 'admin' && (
                                            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => handleDelete(inv._id)}>
                                                <Text>🗑️</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>
            </View>

            {/* Premium View Modal */}
            <Modal visible={showModal} transparent={true} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>
                                    {selectedInvoice?.vendorName && /plot|road|street|floor|nagar|marg/i.test(selectedInvoice.vendorName) ? 'Vendor Name Missing' : (selectedInvoice?.vendorName || 'Unknown Vendor')}
                                </Text>
                                <Text style={styles.modalSubtitle}>
                                    <Text style={{ fontWeight: 'bold' }}>Address: </Text>
                                    {selectedInvoice?.vendorAddress || (selectedInvoice?.vendorName && /plot|road|street|floor|nagar|marg/i.test(selectedInvoice.vendorName) ? selectedInvoice.vendorName : 'N/A')}
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 15, marginTop: 5 }}>
                                    <Text style={styles.modalSmallText}><Text style={{ fontWeight: 'bold' }}>GSTIN:</Text> {selectedInvoice?.vendorGST || 'N/A'}</Text>
                                    <Text style={styles.modalSmallText}><Text style={{ fontWeight: 'bold' }}>DL No:</Text> {selectedInvoice?.vendorDL || 'N/A'}</Text>
                                </View>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <TouchableOpacity onPress={() => setShowModal(false)}>
                                    <Text style={styles.closeBtn}>×</Text>
                                </TouchableOpacity>
                                <Text style={[styles.modalSmallText, { marginTop: 10 }]}><Text style={{ fontWeight: 'bold' }}>Invoice No:</Text> {selectedInvoice?.invoiceNumber || 'N/A'}</Text>
                                <Text style={styles.modalSmallText}><Text style={{ fontWeight: 'bold' }}>Date:</Text> {selectedInvoice?.invoiceDate ? new Date(selectedInvoice.invoiceDate).toLocaleDateString() : 'N/A'}</Text>
                                <View style={[styles.statusBadge, { marginTop: 5 }, selectedInvoice?.status === 'Completed' ? styles.statusCompleted : styles.statusPending]}>
                                    <Text style={[styles.statusBadgeText, selectedInvoice?.status === 'Completed' ? styles.statusTextCompleted : styles.statusTextPending]}>{selectedInvoice?.status}</Text>
                                </View>
                            </View>
                        </View>

                        <ScrollView style={styles.modalBody} horizontal={false}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ minWidth: 800 }}>
                                    <View style={[styles.tableHeadRow, { backgroundColor: '#f1f5f9' }]}>
                                        <Text style={[styles.tableHead, { width: 200 }]}>Medicine Name</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Batch</Text>
                                        <Text style={[styles.tableHead, { width: 80 }]}>Qty</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Price/Unit</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Base Amt</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Discount</Text>
                                        <Text style={[styles.tableHead, { width: 80 }]}>GST (%)</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Net Amount</Text>
                                    </View>
                                    {(selectedInvoice?.importedMedicinesList || []).length === 0 ? (
                                        <Text style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>No items found for this invoice.</Text>
                                    ) : (
                                        (selectedInvoice?.importedMedicinesList || []).map((med, idx) => {
                                            const qty = med.purchaseQty || 0;
                                            const price = med.buyingPrice || med.purchaseRate || 0;
                                            const baseAmt = qty * price;
                                            const discount = med.discountValue || med.discount || 0;
                                            const cgst = med.cgst || 0;
                                            const sgst = med.sgst || 0;
                                            const totalGstPercent = cgst + sgst;
                                            const afterDiscount = baseAmt - discount;
                                            const taxAmt = afterDiscount * (totalGstPercent / 100);
                                            const netAmount = afterDiscount + taxAmt;
                                            return (
                                                <View key={idx} style={styles.tableRow}>
                                                    <Text style={[styles.tableCell, { width: 200, fontWeight: 'bold' }]}>{med.name || med.medicineName}</Text>
                                                    <Text style={[styles.tableCell, { width: 100 }]}>{med.batchNumber || med.batch || 'N/A'}</Text>
                                                    <Text style={[styles.tableCell, { width: 80 }]}>{qty}</Text>
                                                    <Text style={[styles.tableCell, { width: 100 }]}>₹{price.toFixed(2)}</Text>
                                                    <Text style={[styles.tableCell, { width: 100 }]}>₹{baseAmt.toFixed(2)}</Text>
                                                    <Text style={[styles.tableCell, { width: 100 }]}>₹{discount.toFixed(2)}</Text>
                                                    <Text style={[styles.tableCell, { width: 80 }]}>{totalGstPercent}%</Text>
                                                    <Text style={[styles.tableCell, { width: 100, fontWeight: 'bold' }]}>₹{netAmount.toFixed(2)}</Text>
                                                </View>
                                            );
                                        })
                                    )}
                                </View>
                            </ScrollView>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                {selectedInvoice?.status === 'Pending' && (
                                    <TouchableOpacity style={styles.btnConfirmImport} onPress={() => { setShowModal(false); handleProcessInvoice(selectedInvoice._id); }}>
                                        <Text style={styles.btnConfirmImportText}>Confirm Import</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.grandTotalLabel}>Grand Total</Text>
                                <Text style={styles.grandTotalValue}>
                                    ₹{((selectedInvoice?.importedMedicinesList || []).reduce((sum, med) => {
                                        const qty = med.purchaseQty || 0;
                                        const price = med.buyingPrice || med.purchaseRate || 0;
                                        const discount = med.discountValue || med.discount || 0;
                                        const afterDiscount = (qty * price) - discount;
                                        const taxAmt = afterDiscount * ((med.cgst || 0) + (med.sgst || 0)) / 100;
                                        return sum + afterDiscount + taxAmt;
                                    }, 0) || selectedInvoice?.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Text>
                            </View>
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
        backgroundColor: '#f8fafc',
    },
    contentContainer: {
        padding: 24,
    },
    header: {
        flexDirection: width > 768 ? 'row' : 'column',
        justifyContent: 'space-between',
        alignItems: width > 768 ? 'center' : 'stretch',
        marginBottom: 30,
        gap: 15,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold', // 800 roughly translates to bold
        color: '#0f172a',
    },
    headerSubtitle: {
        color: '#64748b',
        fontSize: 15,
        marginTop: 8,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        width: 300,
        height: 42,
    },
    searchIcon: {
        color: '#94a3b8',
        marginRight: 10,
        fontSize: 16,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#000',
    },
    pickerWrapper: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        backgroundColor: 'white',
        height: 42,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    picker: {
        height: 42,
        width: 150,
        color: '#334155',
    },
    tableContainer: {
        backgroundColor: 'white',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
        elevation: 1,
    },
    tableHeadRow: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tableHead: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        fontSize: 13,
        fontWeight: 'bold', // 600
        color: '#475569',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: 'white',
    },
    tableCell: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        justifyContent: 'center',
    },
    emptyState: {
        padding: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyStateTitle: {
        fontSize: 18,
        color: '#1e293b',
        fontWeight: 'bold',
        marginBottom: 8,
    },
    emptyStateText: {
        color: '#64748b',
        fontSize: 14,
    },
    invoiceNumber: {
        fontWeight: 'bold',
        color: '#0f172a',
        fontSize: 15,
    },
    invoiceDate: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 4,
    },
    vendorAvatar: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#c7d2fe',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    vendorAvatarText: {
        color: '#4338ca',
        fontWeight: 'bold',
        fontSize: 14,
    },
    vendorName: {
        fontWeight: 'bold', // 600
        color: '#334155',
        fontSize: 14,
    },
    uploadDate: {
        fontSize: 14,
        color: '#334155',
    },
    uploadTime: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    progressTextRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    progressTextImported: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#059669',
    },
    progressTextTotal: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#64748b',
    },
    progressBarBg: {
        width: '100%',
        height: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    amountText: {
        fontWeight: 'bold', // 800
        color: '#0f172a',
        fontSize: 15,
    },
    statusBadge: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    statusCompleted: {
        backgroundColor: '#dcfce7',
        borderColor: '#bbf7d0',
    },
    statusCancelled: {
        backgroundColor: '#fee2e2',
        borderColor: '#fecaca',
    },
    statusPending: {
        backgroundColor: '#fef3c7',
        borderColor: '#fde68a',
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    statusTextCompleted: {
        color: '#166534',
    },
    statusTextCancelled: {
        color: '#991b1b',
    },
    statusTextPending: {
        color: '#92400e',
    },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnPrimary: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
        borderWidth: 0,
    },
    actionBtnDanger: {
        borderColor: '#fca5a5',
    },
    
    /* Modal Styles */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        width: '100%',
        maxWidth: 900,
        maxHeight: '90%',
        overflow: 'hidden',
    },
    modalHeader: {
        paddingVertical: 24,
        paddingHorizontal: 32,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold', // 800
        color: '#0f172a',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#475569',
        marginBottom: 2,
    },
    modalSmallText: {
        fontSize: 13,
        color: '#64748b',
    },
    closeBtn: {
        fontSize: 28,
        color: '#64748b',
        lineHeight: 28,
    },
    modalBody: {
        flex: 1,
    },
    modalFooter: {
        paddingVertical: 20,
        paddingHorizontal: 32,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    btnConfirmImport: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#3b82f6',
        borderRadius: 8,
    },
    btnConfirmImportText: {
        color: 'white',
        fontWeight: 'bold',
    },
    grandTotalLabel: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: 'bold', // 600
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    grandTotalValue: {
        fontSize: 28,
        fontWeight: 'bold', // 800
        color: '#0f172a',
    }
});

export default PurchaseInvoiceHistory;
