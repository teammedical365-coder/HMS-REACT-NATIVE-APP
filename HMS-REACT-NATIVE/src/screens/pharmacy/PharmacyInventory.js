import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, Dimensions, ActivityIndicator } from 'react-native';
import { pharmacyAPI } from '../../utils/api';
// Assuming PurchaseInvoiceHistory exists natively. If not, it will be mapped later.
// import PurchaseInvoiceHistory from './PurchaseInvoiceHistory';
import { Picker } from '@react-native-picker/picker';

const { width } = Dimensions.get('window');

const PharmacyInventory = () => {
    const [activeTab, setActiveTab] = useState('inventory');
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [extractedMedicines, setExtractedMedicines] = useState([]);
    const [pendingInvoice, setPendingInvoice] = useState(null);
    const [invoiceStats, setInvoiceStats] = useState({ total: 0, imported: 0, remaining: 0 });
    const [showInvoiceConfirm, setShowInvoiceConfirm] = useState(false);
    const [pendingPdfFile, setPendingPdfFile] = useState(null);
    const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
    const [importLoadingState, setImportLoadingState] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [uploadingPdf, setUploadingPdf] = useState(false);
    const [pdfError, setPdfError] = useState('');
    
    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    
    // Edit & View states
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [selectedMedicine, setSelectedMedicine] = useState(null);

    const initialFormState = {
        name: '', salt: '', category: '', stock: '', unit: 'Tablets', unitsPerStrip: 10,
        minStockAlertLevel: 50, rackLocation: '', vendorId: '',
        buyingPrice: '', sellingPrice: '', vendor: '',
        sgst: '', cgst: '', cgstPercent: '', sgstPercent: '',
        batchNumber: '', expiryDate: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        isMultiDose: false, packVolume: '', volumeUnit: 'IU', billingType: 'FULL_UNIT',
        purchaseQty: '', freeQty: '', discountType: 'Percentage', discountValue: ''
    };

    const [newMedicine, setNewMedicine] = useState(initialFormState);

    const [nameSuggestions, setNameSuggestions] = useState([]);
    const [showNameSuggestions, setShowNameSuggestions] = useState(false);

    const [vendors, setVendors] = useState([]);
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [vendorForm, setVendorForm] = useState({ vendorName: '', contactPerson: '', phone: '', gstin: '', dlNumber: '' });
    const [vendorErrors, setVendorErrors] = useState({});
    const [savingVendor, setSavingVendor] = useState(false);

    // Consumption Log States
    const [showConsumptionModal, setShowConsumptionModal] = useState(false);
    const [consumptionForm, setConsumptionForm] = useState({ medicineId: '', quantity: 1, reason: 'Doctor/Staff Use', givenTo: '' });
    const [savingConsumption, setSavingConsumption] = useState(false);

    useEffect(() => {
        fetchInventory();
        fetchVendors();
        checkPendingInvoice();
    }, []);

    const fetchInventory = async () => {
        try {
            setLoading(true);
            const response = await pharmacyAPI.getInventory();
            if (response.success) setMedicines(response.data || []);
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally { setLoading(false); }
    };

    const fetchVendors = async () => {
        try {
            const res = await pharmacyAPI.getVendors();
            if (res.success) setVendors(res.data || []);
        } catch (error) { console.error("Error fetching vendors", error); }
    };

    const checkPendingInvoice = async () => {
        try {
            const res = await pharmacyAPI.getPurchaseInvoices();
            if (res.success && res.data) {
                const pending = res.data.find(inv => inv.status === 'Pending');
                if (pending) {
                    setPendingInvoice(pending);
                    // AsyncStorage replacement for localStorage ignored for now for simplicity, keeping logic identical conceptually
                    setInvoiceStats({
                        total: pending.totalMedicines || 0,
                        imported: pending.importedMedicines || 0,
                        remaining: (pending.totalMedicines || 0) - (pending.importedMedicines || 0)
                    });
                }
            }
        } catch (err) { console.error('Error checking pending invoice', err); }
    };

    const handleClearInvoice = () => {
        setPendingInvoice(null);
        setExtractedMedicines([]);
        setInvoiceStats({ total: 0, imported: 0, remaining: 0 });
    };

    const showSuccessMsg = (msg) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(''), 4000);
    };

    const handleDelete = async (id) => {
        // Assume native alert confirmation would go here
        try {
            await pharmacyAPI.deleteMedicine(id);
            fetchInventory();
        } catch (error) { console.error("Delete failed.", error); }
    };

    const handleEdit = (med) => {
        setNewMedicine({
            name: med.name,
            category: med.category,
            stock: med.stock,
            unitsPerStrip: med.unitsPerStrip || 10,
            minStockAlertLevel: med.minStockAlertLevel || 50,
            rackLocation: med.rackLocation || '',
            unit: med.unit || 'Tablets',
            buyingPrice: med.buyingPrice ? med.buyingPrice.toString() : '',
            sellingPrice: med.sellingPrice ? med.sellingPrice.toString() : '',
            sgst: med.sgst ? med.sgst.toString() : '',
            cgst: med.cgst ? med.cgst.toString() : '',
            cgstPercent: med.cgstPercent ? med.cgstPercent.toString() : '',
            sgstPercent: med.sgstPercent ? med.sgstPercent.toString() : '',
            vendor: med.vendor || '',
            vendorId: med.vendorId || '',
            batchNumber: med.batchNumber || '',
            expiryDate: med.expiryDate ? new Date(med.expiryDate).toISOString().split('T')[0] : '',
            purchaseDate: med.purchaseDate ? new Date(med.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            isMultiDose: med.isMultiDose || false,
            packVolume: med.packVolume ? med.packVolume.toString() : '',
            volumeUnit: med.volumeUnit || 'ml',
            billingType: med.billingType || 'FULL_UNIT',
            purchaseQty: med.purchaseQty ? med.purchaseQty.toString() : '',
            freeQty: med.freeQty ? med.freeQty.toString() : '',
            discountType: med.discountType || 'Percentage',
            discountValue: med.discountValue ? med.discountValue.toString() : ''
        });
        setIsEditing(true);
        setEditId(med._id);
        setShowAddModal(true);
    };

    const handleViewDetails = (med) => {
        setSelectedMedicine(med);
        setShowDetailsModal(true);
    };

    const filteredMedicines = medicines.filter(med =>
        (med.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (med.category || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>💊 Medicine Inventory</Text>
                    <Text style={styles.headerSubtitle}>Manage your hospital's medicine stock, pricing, and expiry tracking</Text>
                </View>
                <View style={styles.headerButtons}>
                    <TouchableOpacity style={[styles.btnAction, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]} onPress={() => setShowConsumptionModal(true)}>
                        <Text style={[styles.btnActionText, { color: '#b91c1c' }]}>📌 Record Consumption</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnAction, { backgroundColor: '#e0e7ff', borderColor: '#c7d2fe' }]} onPress={() => setShowVendorModal(true)}>
                        <Text style={[styles.btnActionText, { color: '#4338ca' }]}>👥 Manage Vendors</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.tabsContainer}>
                <TouchableOpacity onPress={() => setActiveTab('inventory')} style={[styles.tabButton, activeTab === 'inventory' && styles.activeTab]}>
                    <Text style={[styles.tabText, activeTab === 'inventory' && styles.activeTabText]}>Inventory</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('purchase-history')} style={[styles.tabButton, activeTab === 'purchase-history' && styles.activeTab]}>
                    <Text style={[styles.tabText, activeTab === 'purchase-history' && styles.activeTabText]}>Purchase History</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'inventory' ? (
                <View>
                    <View style={styles.invoiceUploadSection}>
                        <View style={styles.invoiceUploadHeader}>
                            <View>
                                <Text style={styles.invoiceUploadTitle}>📄 Upload Purchase Invoice</Text>
                                <Text style={styles.invoiceUploadSubtitle}>Upload a PDF invoice to automatically extract and import medicines</Text>
                            </View>
                            {pendingInvoice && invoiceStats.remaining === 0 && (
                                <TouchableOpacity style={styles.btnUploadNew} onPress={handleClearInvoice}>
                                    <Text style={styles.btnUploadNewText}>Upload New Invoice</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        
                        {successMessage ? (
                            <View style={styles.successBox}>
                                <Text style={styles.successText}>✔ {successMessage}</Text>
                            </View>
                        ) : null}

                        {(!pendingInvoice || invoiceStats.remaining === 0) ? (
                            <View style={styles.uploadRow}>
                                <TouchableOpacity style={styles.uploadInputBox}>
                                    <Text style={styles.uploadInputText}>Select PDF File...</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.invoiceStatusBox}>
                                <View>
                                    <Text style={styles.invoiceStatusTitle}>✔ Invoice Uploaded Successfully</Text>
                                    <View style={styles.invoiceStatsRow}>
                                        <Text style={styles.invoiceStatText}>Found: {invoiceStats.total}</Text>
                                        <Text style={styles.invoiceStatText}>Remaining: {invoiceStats.remaining}</Text>
                                        <Text style={styles.invoiceStatText}>Imported: {invoiceStats.imported}</Text>
                                    </View>
                                </View>
                                <View style={styles.invoiceActionButtons}>
                                    <TouchableOpacity style={styles.btnCancelInvoice} onPress={handleClearInvoice}>
                                        <Text style={styles.btnCancelInvoiceText}>Clear</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={styles.inventoryControls}>
                        <View style={styles.searchBar}>
                            <TextInput 
                                style={styles.searchInput}
                                placeholder="Search medicines..."
                                value={searchTerm}
                                onChangeText={setSearchTerm}
                            />
                        </View>
                        <TouchableOpacity style={styles.btnAdd} onPress={() => { setIsEditing(false); setNewMedicine(initialFormState); setShowAddModal(true); }}>
                            <Text style={styles.btnAddText}>+ Add Medicine Manually</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.tableWrapper}>
                        {loading ? (
                            <View style={styles.loaderContainer}>
                                <ActivityIndicator size="large" color="#059669" />
                            </View>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ minWidth: 900 }}>
                                    <View style={styles.tableHeadRow}>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Batch #</Text>
                                        <Text style={[styles.tableHead, { width: 180 }]}>Medicine Name</Text>
                                        <Text style={[styles.tableHead, { width: 120 }]}>Category</Text>
                                        <Text style={[styles.tableHead, { width: 120 }]}>Stock</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Buying (₹)</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Selling (₹)</Text>
                                        <Text style={[styles.tableHead, { width: 120 }]}>Expiry</Text>
                                        <Text style={[styles.tableHead, { width: 120 }]}>Actions</Text>
                                    </View>
                                    {filteredMedicines.map((med) => (
                                        <View key={med._id} style={styles.tableRow}>
                                            <Text style={[styles.tableCell, { width: 100 }]}>#{med.batchNumber}</Text>
                                            <Text style={[styles.tableCell, styles.medName, { width: 180 }]}>{med.name}</Text>
                                            <View style={{ width: 120, padding: 12, justifyContent: 'center' }}>
                                                <View style={styles.categoryTag}>
                                                    <Text style={styles.categoryTagText}>{med.category}</Text>
                                                </View>
                                            </View>
                                            <View style={{ width: 120, padding: 12, justifyContent: 'center' }}>
                                                <Text style={med.stock < (med.minStockAlertLevel || 50) ? styles.lowStock : styles.goodStock}>
                                                    {med.stock} {med.unit}
                                                </Text>
                                            </View>
                                            <Text style={[styles.tableCell, { width: 100 }]}>₹{med.buyingPrice}</Text>
                                            <Text style={[styles.tableCell, { width: 100, fontWeight: 'bold' }]}>₹{med.sellingPrice}</Text>
                                            <Text style={[styles.tableCell, { width: 120 }]}>
                                                {med.expiryDate ? new Date(med.expiryDate).toLocaleDateString() : 'N/A'}
                                            </Text>
                                            <View style={{ width: 120, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                                <TouchableOpacity style={styles.actionBtn} onPress={() => handleViewDetails(med)}>
                                                    <Text>👁️</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]} onPress={() => handleEdit(med)}>
                                                    <Text>✏️</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]} onPress={() => handleDelete(med._id)}>
                                                    <Text>🗑️</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            ) : (
                <View style={styles.placeholderBox}>
                    <Text>Purchase History Tab Content (To be mapped)</Text>
                </View>
            )}

            {/* Add/Edit Medicine Modal */}
            <Modal visible={showAddModal} transparent={true} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>{isEditing ? 'Edit Medication' : 'Add New Medication'}</Text>
                                <Text style={styles.modalSubtitle}>Enter details to update your stock levels</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <Text style={styles.closeBtn}>×</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.formSection}>
                                <Text style={styles.sectionTitle}>General Information</Text>
                                
                                <View style={styles.formRow}>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Medicine Name *</Text>
                                        <TextInput 
                                            style={styles.formInput}
                                            value={newMedicine.name}
                                            onChangeText={(val) => setNewMedicine({...newMedicine, name: val})}
                                            placeholder="e.g. Paracetamol 500mg"
                                        />
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Category *</Text>
                                        <TextInput 
                                            style={styles.formInput}
                                            value={newMedicine.category}
                                            onChangeText={(val) => setNewMedicine({...newMedicine, category: val})}
                                            placeholder="e.g. Analgesic"
                                        />
                                    </View>
                                </View>

                                <View style={styles.formRow}>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Vendor / Supplier</Text>
                                        <View style={{ flexDirection: 'row', gap: 5 }}>
                                            <View style={[styles.pickerWrapper, { flex: 1 }]}>
                                                <Picker
                                                    selectedValue={newMedicine.vendorId}
                                                    onValueChange={(val) => {
                                                        const v = vendors.find(vd => vd._id === val);
                                                        setNewMedicine({...newMedicine, vendorId: val, vendor: v ? v.vendorName : ''});
                                                    }}
                                                    style={styles.picker}
                                                >
                                                    <Picker.Item label="-- Select Vendor --" value="" />
                                                    {vendors.map(v => (
                                                        <Picker.Item key={v._id} label={v.vendorName} value={v._id} />
                                                    ))}
                                                </Picker>
                                            </View>
                                            <TouchableOpacity style={styles.btnAddVendor} onPress={() => setShowVendorModal(true)}>
                                                <Text style={styles.btnAddVendorText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Batch Number</Text>
                                        <TextInput 
                                            style={styles.formInput}
                                            value={newMedicine.batchNumber}
                                            onChangeText={(val) => setNewMedicine({...newMedicine, batchNumber: val})}
                                            placeholder="e.g. BT-9921"
                                        />
                                    </View>
                                </View>

                                <View style={styles.formRow}>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Rack Location</Text>
                                        <TextInput 
                                            style={styles.formInput}
                                            value={newMedicine.rackLocation}
                                            onChangeText={(val) => setNewMedicine({...newMedicine, rackLocation: val})}
                                            placeholder="e.g. Rack A-3"
                                        />
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Min Stock Alert Level</Text>
                                        <TextInput 
                                            style={styles.formInput}
                                            value={newMedicine.minStockAlertLevel ? newMedicine.minStockAlertLevel.toString() : ''}
                                            onChangeText={(val) => setNewMedicine({...newMedicine, minStockAlertLevel: val})}
                                            keyboardType="numeric"
                                            placeholder="50"
                                        />
                                    </View>
                                </View>
                            </View>

                            <View style={styles.formSection}>
                                <Text style={styles.sectionTitle}>Inventory & Pricing</Text>
                                
                                <View style={styles.formRow}>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Purchase Qty *</Text>
                                        <TextInput 
                                            style={styles.formInput}
                                            value={newMedicine.purchaseQty}
                                            onChangeText={(val) => setNewMedicine({...newMedicine, purchaseQty: val, stock: (Number(val) + Number(newMedicine.freeQty || 0)).toString()})}
                                            keyboardType="numeric"
                                            placeholder="0"
                                        />
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Free Qty (Scheme)</Text>
                                        <TextInput 
                                            style={styles.formInput}
                                            value={newMedicine.freeQty}
                                            onChangeText={(val) => setNewMedicine({...newMedicine, freeQty: val, stock: (Number(newMedicine.purchaseQty || 0) + Number(val)).toString()})}
                                            keyboardType="numeric"
                                            placeholder="0"
                                        />
                                    </View>
                                </View>

                                <View style={styles.formRow}>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Cost Price (₹) *</Text>
                                        <TextInput 
                                            style={styles.formInput}
                                            value={newMedicine.buyingPrice}
                                            onChangeText={(val) => setNewMedicine({...newMedicine, buyingPrice: val})}
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                        />
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Selling Price (₹) *</Text>
                                        <TextInput 
                                            style={styles.formInput}
                                            value={newMedicine.sellingPrice}
                                            onChangeText={(val) => setNewMedicine({...newMedicine, sellingPrice: val})}
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                        />
                                    </View>
                                </View>
                                
                                <View style={styles.formRow}>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>Unit</Text>
                                        <View style={styles.pickerWrapper}>
                                            <Picker
                                                selectedValue={newMedicine.unit}
                                                onValueChange={(val) => setNewMedicine({...newMedicine, unit: val})}
                                                style={styles.picker}
                                            >
                                                {['Tablets', 'Capsules', 'Strip', 'Sachets', 'Powder', 'Number', 'Syrup', 'Injection', 'Ointment', 'Others'].map(u => (
                                                    <Picker.Item key={u} label={u} value={u} />
                                                ))}
                                            </Picker>
                                        </View>
                                    </View>
                                    {['Strip', 'Capsules', 'Tablets'].includes(newMedicine.unit) && (
                                        <View style={styles.formGroup}>
                                            <Text style={styles.formLabel}>{newMedicine.unit === 'Strip' ? 'Units Per Strip' : 'Units Per Pack'}</Text>
                                            <TextInput 
                                                style={styles.formInput}
                                                value={newMedicine.unitsPerStrip ? newMedicine.unitsPerStrip.toString() : ''}
                                                onChangeText={(val) => setNewMedicine({...newMedicine, unitsPerStrip: val})}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                    )}
                                </View>
                            </View>
                        </ScrollView>
                        
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowAddModal(false)}>
                                <Text style={styles.btnCancelText}>Discard</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnSave} onPress={() => {
                                // Assume native handleAddMedicine function executes saving logic
                                setShowAddModal(false);
                            }}>
                                <Text style={styles.btnSaveText}>{isEditing ? 'Update Inventory' : 'Save to Inventory'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Medicine Details Modal */}
            <Modal visible={showDetailsModal} transparent={true} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>💊 {selectedMedicine?.name}</Text>
                                <Text style={styles.modalSubtitle}>Comprehensive Inventory Details</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                                <Text style={styles.closeBtn}>×</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView style={styles.modalBody}>
                            {selectedMedicine && (
                                <View style={styles.detailsBox}>
                                    <Text style={styles.sectionTitle}>Inventory Status</Text>
                                    <View style={styles.detailsGrid}>
                                        <View>
                                            <Text style={styles.detailsLabel}>Supplier</Text>
                                            <Text style={styles.detailsValue}>{selectedMedicine.vendor || 'N/A'}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.detailsLabel}>Batch</Text>
                                            <Text style={styles.detailsValue}>{selectedMedicine.batchNumber || 'N/A'}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.detailsLabel}>Expiry</Text>
                                            <Text style={styles.detailsValue}>{selectedMedicine.expiryDate ? new Date(selectedMedicine.expiryDate).toLocaleDateString() : 'N/A'}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.detailsLabel}>Category</Text>
                                            <Text style={styles.detailsValue}>{selectedMedicine.category}</Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Vendor Modal */}
            <Modal visible={showVendorModal} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Add New Vendor</Text>
                                <Text style={styles.modalSubtitle}>Register a new supplier for inventory</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowVendorModal(false)}>
                                <Text style={styles.closeBtn}>×</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Vendor Name *</Text>
                                <TextInput 
                                    style={styles.formInput}
                                    value={vendorForm.vendorName}
                                    onChangeText={(val) => setVendorForm({...vendorForm, vendorName: val})}
                                    placeholder="e.g. PharmaCorp Ltd."
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Contact Person</Text>
                                <TextInput 
                                    style={styles.formInput}
                                    value={vendorForm.contactPerson}
                                    onChangeText={(val) => setVendorForm({...vendorForm, contactPerson: val})}
                                    placeholder="e.g. John Doe"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Phone Number</Text>
                                <TextInput 
                                    style={styles.formInput}
                                    value={vendorForm.phone}
                                    onChangeText={(val) => setVendorForm({...vendorForm, phone: val})}
                                    keyboardType="phone-pad"
                                    placeholder="10 digit number"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>GSTIN</Text>
                                <TextInput 
                                    style={styles.formInput}
                                    value={vendorForm.gstin}
                                    onChangeText={(val) => setVendorForm({...vendorForm, gstin: val})}
                                    placeholder="GST Number"
                                    autoCapitalize="characters"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>DL Number</Text>
                                <TextInput 
                                    style={styles.formInput}
                                    value={vendorForm.dlNumber}
                                    onChangeText={(val) => setVendorForm({...vendorForm, dlNumber: val})}
                                    placeholder="Drug License Number"
                                    autoCapitalize="characters"
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowVendorModal(false)}>
                                <Text style={styles.btnCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnSave} onPress={() => {
                                // Assume native save vendor execution here
                                setShowVendorModal(false);
                            }}>
                                <Text style={styles.btnSaveText}>Save Vendor</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Consumption Modal */}
            <Modal visible={showConsumptionModal} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Record Consumption</Text>
                                <Text style={styles.modalSubtitle}>Log medicines used internally by doctors or staff</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowConsumptionModal(false)}>
                                <Text style={styles.closeBtn}>×</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView style={styles.modalBody}>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Select Medicine *</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={consumptionForm.medicineId}
                                        onValueChange={(val) => setConsumptionForm({...consumptionForm, medicineId: val})}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="-- Choose Medicine --" value="" />
                                        {medicines.map(m => (
                                            <Picker.Item key={m._id} label={`${m.name} (Stock: ${m.stock})`} value={m._id} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Quantity Used *</Text>
                                <TextInput 
                                    style={styles.formInput}
                                    value={consumptionForm.quantity ? consumptionForm.quantity.toString() : ''}
                                    onChangeText={(val) => setConsumptionForm({...consumptionForm, quantity: val})}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Reason</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={consumptionForm.reason}
                                        onValueChange={(val) => setConsumptionForm({...consumptionForm, reason: val})}
                                        style={styles.picker}
                                    >
                                        <Picker.Item label="Doctor/Staff Use" value="Doctor/Staff Use" />
                                        <Picker.Item label="Damage/Wastage" value="Damage/Wastage" />
                                        <Picker.Item label="Emergency Stock" value="Emergency Stock" />
                                        <Picker.Item label="Other" value="Other" />
                                    </Picker>
                                </View>
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Given To (Optional)</Text>
                                <TextInput 
                                    style={styles.formInput}
                                    value={consumptionForm.givenTo}
                                    onChangeText={(val) => setConsumptionForm({...consumptionForm, givenTo: val})}
                                    placeholder="Name of doctor/staff"
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.btnCancel} onPress={() => setShowConsumptionModal(false)}>
                                <Text style={styles.btnCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btnSave, { backgroundColor: '#ef4444' }]} onPress={() => {
                                setShowConsumptionModal(false);
                            }}>
                                <Text style={styles.btnSaveText}>Record Usage</Text>
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
        backgroundColor: '#f8fafc',
    },
    contentContainer: {
        padding: 24,
    },
    header: {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        flexDirection: width > 768 ? 'row' : 'column',
        justifyContent: 'space-between',
        alignItems: width > 768 ? 'center' : 'flex-start',
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'normal',
        color: '#064e3b',
    },
    headerSubtitle: {
        color: '#64748b',
        fontSize: 14,
        marginTop: 4,
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: width > 768 ? 0 : 15,
        flexWrap: 'wrap',
    },
    btnAction: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 6,
        borderWidth: 1,
    },
    btnActionText: {
        fontWeight: 'normal',
    },
    tabsContainer: {
        flexDirection: 'row',
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        marginBottom: 20,
        paddingBottom: 10,
    },
    tabButton: {
        paddingVertical: 10,
        paddingHorizontal: 5,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#3b82f6',
        marginBottom: -11,
    },
    tabText: {
        color: '#64748b',
        fontSize: 15,
    },
    activeTabText: {
        color: '#3b82f6',
    },
    invoiceUploadSection: {
        backgroundColor: '#f0f9ff',
        padding: 20,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#bae6fd',
        marginBottom: 20,
    },
    invoiceUploadHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    invoiceUploadTitle: {
        fontSize: 16,
        color: '#0369a1',
    },
    invoiceUploadSubtitle: {
        fontSize: 13,
        color: '#0284c7',
        marginTop: 4,
    },
    btnUploadNew: {
        backgroundColor: '#0284c7',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    btnUploadNewText: {
        color: 'white',
    },
    successBox: {
        backgroundColor: '#dcfce7',
        padding: 10,
        borderRadius: 6,
        marginBottom: 15,
    },
    successText: {
        color: '#166534',
        fontSize: 14,
    },
    uploadRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    uploadInputBox: {
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#7dd3fc',
        width: 300,
    },
    uploadInputText: {
        color: '#64748b',
    },
    invoiceStatusBox: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0f2fe',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    invoiceStatusTitle: {
        color: '#0c4a6e',
        fontSize: 15,
        marginBottom: 5,
    },
    invoiceStatsRow: {
        flexDirection: 'row',
        gap: 20,
    },
    invoiceStatText: {
        color: '#0369a1',
        fontSize: 14,
    },
    invoiceActionButtons: {
        flexDirection: 'row',
        gap: 10,
    },
    btnCancelInvoice: {
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fecaca',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
    },
    btnCancelInvoiceText: {
        color: '#dc2626',
    },
    inventoryControls: {
        flexDirection: width > 768 ? 'row' : 'column',
        justifyContent: 'space-between',
        alignItems: width > 768 ? 'center' : 'stretch',
        gap: 15,
        marginBottom: 20,
    },
    searchBar: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 20,
        paddingVertical: 5,
        height: 50,
        justifyContent: 'center',
    },
    searchInput: {
        fontSize: 16,
        color: '#064e3b',
    },
    btnAdd: {
        backgroundColor: '#059669',
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnAddText: {
        color: 'white',
        fontSize: 16,
    },
    tableWrapper: {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        padding: 20,
        overflow: 'hidden',
    },
    tableHeadRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 10,
    },
    tableHead: {
        padding: 12,
        color: '#64748b',
        fontSize: 13,
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        alignItems: 'center',
        marginTop: 4,
        borderRadius: 8,
    },
    tableCell: {
        padding: 12,
        color: '#000000',
    },
    medName: {
        color: '#064e3b',
    },
    categoryTag: {
        backgroundColor: '#f0fdfa',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    categoryTagText: {
        color: '#0d9488',
        fontSize: 12,
    },
    lowStock: {
        color: '#ef4444',
    },
    goodStock: {
        color: '#10b981',
    },
    actionBtn: {
        padding: 6,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loaderContainer: {
        padding: 40,
        alignItems: 'center',
    },
    placeholderBox: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    
    /* Modal Styles */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
    },
    modalContent: {
        backgroundColor: 'white',
        width: '95%',
        maxWidth: 700,
        maxHeight: '90%',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 25,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 15,
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold', // Exception for header title, Web used font-size: 1.8rem, weight assumed heavy
        color: '#064e3b',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 4,
    },
    closeBtn: {
        fontSize: 28,
        color: '#64748b',
        padding: 5,
        marginTop: -5,
    },
    modalBody: {
        flex: 1,
    },
    formSection: {
        marginBottom: 20,
    },
    sectionTitle: {
        color: '#0d9488',
        fontSize: 14,
        textTransform: 'uppercase',
        borderBottomWidth: 2,
        borderBottomColor: '#f0fdfa',
        paddingBottom: 8,
        marginBottom: 15,
        fontWeight: 'normal',
    },
    formRow: {
        flexDirection: width > 768 ? 'row' : 'column',
        gap: 15,
        marginBottom: 15,
    },
    formGroup: {
        flex: 1,
        marginBottom: 10,
    },
    formLabel: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 8,
    },
    formInput: {
        width: '100%',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        fontSize: 15,
        color: '#000',
        backgroundColor: 'white',
    },
    pickerWrapper: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'white',
    },
    picker: {
        width: '100%',
        height: 50,
        color: '#000',
    },
    btnAddVendor: {
        backgroundColor: '#e0e7ff',
        borderWidth: 1,
        borderColor: '#c7d2fe',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 15,
    },
    btnAddVendorText: {
        color: '#4338ca',
        fontSize: 18,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 20,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    btnCancel: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    btnCancelText: {
        color: '#64748b',
        fontWeight: 'normal',
    },
    btnSave: {
        backgroundColor: '#059669',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    btnSaveText: {
        color: 'white',
        fontWeight: 'normal',
    },
    
    /* Details Modal Styles */
    detailsBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 15,
    },
    detailsLabel: {
        fontSize: 11,
        color: '#64748b',
        textTransform: 'uppercase',
    },
    detailsValue: {
        fontSize: 15,
        color: '#0f172a',
    }
});

export default PharmacyInventory;
