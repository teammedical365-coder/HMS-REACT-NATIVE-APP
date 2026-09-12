import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, Dimensions, ActivityIndicator, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pharmacyAPI } from '../../utils/api';
import PurchaseInvoiceHistory from './PurchaseInvoiceHistory';
import DropdownSelect from '../../components/common/DropdownSelect';
import DatePickerInput from '../../components/common/DatePickerInput';

const { width } = Dimensions.get('window');

const UNIT_OPTIONS = [
    { label: 'Tablets', value: 'Tablets' },
    { label: 'Capsules', value: 'Capsules' },
    { label: 'Strip', value: 'Strip' },
    { label: 'Sachets', value: 'Sachets' },
    { label: 'Powder', value: 'Powder' },
    { label: 'Number', value: 'Number' },
    { label: 'Syrup', value: 'Syrup' },
    { label: 'Injection', value: 'Injection' },
    { label: 'Ointment', value: 'Ointment' },
    { label: 'Others', value: 'Others' }
];

const REASON_OPTIONS = [
    { label: 'Doctor/Staff Use', value: 'Doctor/Staff Use' },
    { label: 'Damage/Wastage', value: 'Damage/Wastage' },
    { label: 'Emergency Stock', value: 'Emergency Stock' },
    { label: 'Other', value: 'Other' }
];

const DISCOUNT_OPTIONS = [
    { label: 'Percentage (%)', value: 'Percentage' },
    { label: 'Flat Amount (₹)', value: 'Flat Amount' }
];

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
            if (response && (response.success || Array.isArray(response))) {
                const data = response.data || (Array.isArray(response) ? response : []);
                setMedicines(Array.isArray(data) ? data : []);
            } else {
                setMedicines([]);
            }
        } catch (error) {
            console.error("Fetch Error:", error);
            setMedicines([]);
        } finally { setLoading(false); }
    };

    const fetchVendors = async () => {
        try {
            const res = await pharmacyAPI.getVendors();
            if (res.success) setVendors(res.data || []);
        } catch (error) { console.error("Error fetching vendors", error); }
    };

    const STORAGE_KEY = (invoiceId) => 'pendingInvoiceMedicines_' + invoiceId;

    const storageGet = async (key) => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
            return localStorage.getItem(key);
        }
        return AsyncStorage.getItem(key);
    };

    const storageSet = async (key, value) => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
            localStorage.setItem(key, value);
        } else {
            await AsyncStorage.setItem(key, value);
        }
    };

    const storageRemove = async (key) => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
            localStorage.removeItem(key);
        } else {
            await AsyncStorage.removeItem(key);
        }
    };

    const checkPendingInvoice = async () => {
        try {
            const res = await pharmacyAPI.getPurchaseInvoices();
            if (res.success && res.data) {
                const pending = res.data.find(inv => inv.status === 'Pending');
                if (pending) {
                    setPendingInvoice(pending);
                    // Restore extracted medicines from storage (Web: localStorage, Native: AsyncStorage)
                    const savedMeds = await storageGet(STORAGE_KEY(pending._id));
                    if (savedMeds) {
                        const parsed = JSON.parse(savedMeds);
                        setExtractedMedicines(parsed);
                        setInvoiceStats({
                            total: pending.totalMedicines || parsed.length,
                            imported: pending.importedMedicines || 0,
                            remaining: parsed.length
                        });
                    } else {
                        setInvoiceStats({
                            total: pending.totalMedicines || 0,
                            imported: pending.importedMedicines || 0,
                            remaining: (pending.totalMedicines || 0) - (pending.importedMedicines || 0)
                        });
                    }
                }
            }
        } catch (err) { console.error('Error checking pending invoice', err); }
    };

    const handleClearInvoice = async () => {
        if (pendingInvoice) {
            await storageRemove(STORAGE_KEY(pendingInvoice._id));
        }
        setPendingInvoice(null);
        setExtractedMedicines([]);
        setInvoiceStats({ total: 0, imported: 0, remaining: 0 });
    };

    const handleSelectPdf = () => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const input = document.createElement('input');
            input.type = 'file';
            // Accept PDF, DOC, DOCX, JPG, JPEG, PNG, WEBP formats
            input.accept = 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp';
            input.onchange = async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const ext = file.name.split('.').pop().toLowerCase();
                const allowedExts = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'];
                if (!allowedExts.includes(ext)) {
                    setPdfError('Please upload a valid invoice file (PDF/DOC/DOCX/JPG/PNG/WEBP).');
                    Alert.alert('Invalid File', 'Please upload a PDF, DOC, DOCX, JPG, JPEG, PNG, or WEBP file.');
                    return;
                }
                if (file.size > 10 * 1024 * 1024) {
                    setPdfError('File size must be less than 10MB.');
                    Alert.alert('File Too Large', 'File size must be less than 10MB.');
                    return;
                }
                await processPdfUpload(file);
            };
            input.click();
        } else {
            Alert.alert('Info', 'Document picker is available on web runtime.');
        }
    };

    const processPdfUpload = async (file) => {
        setPdfError('');
        setImportLoadingState('Uploading PDF...');
        setUploadingPdf(true);
        try {
            const formData = new FormData();
            formData.append('invoice', file);

            const uploadRes = await pharmacyAPI.uploadPurchaseInvoice(formData);

            if (uploadRes.success && uploadRes.invoice && uploadRes.medicines?.length > 0) {
                setImportLoadingState('Preparing Medicines...');
                const meds = uploadRes.medicines;
                const newInvoiceId = uploadRes.invoice._id;

                setExtractedMedicines(meds);

                // Persist to storage (cross-platform: localStorage on web, AsyncStorage on native)
                await storageSet(STORAGE_KEY(newInvoiceId), JSON.stringify(meds));

                setPendingInvoice(uploadRes.invoice);
                setInvoiceStats({
                    total: uploadRes.invoice.totalMedicines || meds.length,
                    imported: 0,
                    remaining: meds.length
                });

                showSuccessMsg('Invoice Uploaded Successfully');
            } else {
                const msg = uploadRes?.message || 'No medicines found in the uploaded invoice.';
                setPdfError(msg);
                Alert.alert('Upload Error', msg);
            }
        } catch (error) {
            const msg = error.response?.data?.message || error.message || 'Unable to read this invoice.';
            setPdfError(msg);
            Alert.alert('Upload Failed', msg);
        } finally {
            setUploadingPdf(false);
            setImportLoadingState('');
        }
    };

    const handleSelectExtracted = (medName, list = extractedMedicines) => {
        const med = list.find(m => m.medicineName === medName);
        if (!med) {
            setNewMedicine(prev => ({ ...prev, name: medName }));
            return;
        }
        setNewMedicine(prev => ({
            ...prev,
            name: med.medicineName,
            batchNumber: med.batch || '',
            stock: (Number(med.purchaseQty) || 0) + (Number(med.freeQty) || 0) || '',
            purchaseQty: med.purchaseQty || '',
            freeQty: med.freeQty || '',
            discountType: 'Percentage',
            discountValue: med.discount || '',
            unit: med.unit || 'Tablets',
            buyingPrice: med.purchaseRate || '',
            sellingPrice: med.mrp || '',
            cgstPercent: med.gst ? (parseFloat(med.gst) / 2) : '',
            sgstPercent: med.gst ? (parseFloat(med.gst) / 2) : '',
            cgst: med.gst ? (parseFloat(med.gst) / 2) : '',
            sgst: med.gst ? (parseFloat(med.gst) / 2) : '',
            expiryDate: med.expiry ? new Date(med.expiry).toISOString().split('T')[0] : prev.expiryDate,
            purchaseDate: new Date().toISOString().split('T')[0]
        }));
    };

    const showSuccessMsg = (msg) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(''), 4000);
    };

    const [savingMedicine, setSavingMedicine] = useState(false);

    const handleDelete = async (id) => {
        Alert.alert('Confirm Delete', 'Are you sure you want to remove this medication from inventory?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await pharmacyAPI.deleteMedicine(id);
                        showSuccessMsg('Medicine removed from inventory');
                        fetchInventory();
                    } catch (error) {
                        console.error("Delete failed.", error);
                        Alert.alert('Error', error.response?.data?.message || 'Failed to delete medicine');
                    }
                }
            }
        ]);
    };

    const handleAddMedicine = async () => {
        if (!newMedicine.name || !newMedicine.name.trim()) {
            Alert.alert('Validation Error', 'Medicine name is required.');
            return;
        }

        const pQty = Number(newMedicine.purchaseQty) || 0;
        const fQty = Number(newMedicine.freeQty) || 0;
        let totalStock = pQty + fQty;
        let price = Number(newMedicine.buyingPrice) || 0;
        let selling = Number(newMedicine.sellingPrice) || 0;
        let ups = Number(newMedicine.unitsPerStrip) || 1;

        if (['Strip', 'Capsules', 'Tablets'].includes(newMedicine.unit)) {
            totalStock = totalStock * ups;
        } else if (['Number', 'Sachets', 'Powder', 'Ointment', 'Others', 'Syrup', 'Injection'].includes(newMedicine.unit)) {
            ups = 1;
        } else {
            if (ups > 1) totalStock = totalStock * ups;
        }

        let baseTotal = pQty * price;
        let disc = 0;
        if (newMedicine.discountType === 'Percentage') {
            disc = baseTotal * ((Number(newMedicine.discountValue) || 0) / 100);
        } else if (newMedicine.discountType === 'Flat Amount') {
            disc = Number(newMedicine.discountValue) || 0;
        } else {
            disc = Number(newMedicine.discountValue) || 0;
        }

        const afterDisc = Math.max(0, baseTotal - disc);
        const cgstAmt = afterDisc * ((Number(newMedicine.cgstPercent) || 0) / 100);
        const sgstAmt = afterDisc * ((Number(newMedicine.sgstPercent) || 0) / 100);
        const calculatedFinalAmount = afterDisc + cgstAmt + sgstAmt;

        const cleanedData = {
            ...newMedicine,
            name: newMedicine.name.trim(),
            category: newMedicine.category.trim(),
            salt: newMedicine.salt || '',
            stock: totalStock,
            unitsPerStrip: ups,
            minStockAlertLevel: Number(newMedicine.minStockAlertLevel) || 50,
            buyingPrice: price,
            sellingPrice: selling,
            sgst: Number(newMedicine.sgst) || sgstAmt,
            cgst: Number(newMedicine.cgst) || cgstAmt,
            cgstPercent: Number(newMedicine.cgstPercent) || 0,
            sgstPercent: Number(newMedicine.sgstPercent) || 0,
            vendorId: newMedicine.vendorId || null,
            vendor: newMedicine.vendor || '',
            batchNumber: newMedicine.batchNumber.trim(),
            expiryDate: newMedicine.expiryDate ? new Date(newMedicine.expiryDate) : undefined,
            purchaseDate: newMedicine.purchaseDate ? new Date(newMedicine.purchaseDate) : new Date(),
            isMultiDose: Boolean(newMedicine.isMultiDose),
            packVolume: Number(newMedicine.packVolume) || 1,
            purchaseQty: pQty,
            freeQty: fQty,
            discountType: newMedicine.discountType || 'Percentage',
            discountValue: Number(newMedicine.discountValue) || 0,
            finalAmount: calculatedFinalAmount
        };

        setSavingMedicine(true);
        try {
            let response;
            if (isEditing && editId) {
                response = await pharmacyAPI.updateMedicine(editId, cleanedData);
            } else {
                response = await pharmacyAPI.addMedicine(cleanedData);
            }

            if (response && (response.success || response.data)) {
                // If this medicine was from a pending invoice, remove it from the extracted list and update storage
                // Matches Web handleAddMedicine logic exactly
                if (pendingInvoice && extractedMedicines.some(m => m.medicineName === newMedicine.name)) {
                    showSuccessMsg('Medicine Imported Successfully');
                    const updatedMeds = extractedMedicines.filter(m => m.medicineName !== newMedicine.name);
                    setExtractedMedicines(updatedMeds);
                    await storageSet(STORAGE_KEY(pendingInvoice._id), JSON.stringify(updatedMeds));

                    const newImported = invoiceStats.imported + 1;
                    const newRemaining = updatedMeds.length;
                    setInvoiceStats({ ...invoiceStats, imported: newImported, remaining: newRemaining });

                    if (newRemaining === 0) {
                        showSuccessMsg('Invoice Completed Successfully');
                    }
                } else {
                    showSuccessMsg(isEditing ? 'Medicine updated successfully!' : 'Medicine saved to inventory!');
                }

                setShowAddModal(false);
                setIsEditing(false);
                setEditId(null);
                setNewMedicine(initialFormState);
                fetchInventory();
            } else {
                Alert.alert('Error', response?.message || 'Failed to save medicine');
            }
        } catch (err) {
            console.error('Error saving medicine:', err);
            Alert.alert('Error', err.response?.data?.message || 'Failed to save medicine');
        } finally {
            setSavingMedicine(false);
        }
    };

    const handleSaveVendor = async () => {
        if (!vendorForm.vendorName || !vendorForm.vendorName.trim()) {
            Alert.alert('Validation', 'Vendor name is required');
            return;
        }
        setSavingVendor(true);
        try {
            const res = await pharmacyAPI.addVendor(vendorForm);
            if (res && res.success) {
                showSuccessMsg('Vendor added successfully');
                setShowVendorModal(false);
                setVendorForm({ vendorName: '', contactPerson: '', phone: '', gstin: '', dlNumber: '' });
                fetchVendors();
            } else {
                Alert.alert('Error', res?.message || 'Failed to add vendor');
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to add vendor');
        } finally {
            setSavingVendor(false);
        }
    };

    const handleRecordConsumption = async () => {
        if (!consumptionForm.medicineId) {
            Alert.alert('Validation', 'Please select a medicine');
            return;
        }
        const selectedMed = medicines.find(m => m._id === consumptionForm.medicineId);
        const qty = Number(consumptionForm.quantity) || 0;
        if (qty <= 0) {
            Alert.alert('Validation', 'Quantity must be at least 1');
            return;
        }
        if (selectedMed && qty > selectedMed.stock) {
            Alert.alert('Validation', `Quantity cannot exceed available stock (${selectedMed.stock})`);
            return;
        }
        setSavingConsumption(true);
        try {
            const res = await pharmacyAPI.recordConsumption({
                ...consumptionForm,
                quantity: qty
            });
            if (res && res.success) {
                showSuccessMsg('Consumption logged successfully');
                setShowConsumptionModal(false);
                setConsumptionForm({ medicineId: '', quantity: 1, reason: 'Doctor/Staff Use', givenTo: '' });
                fetchInventory();
            } else {
                Alert.alert('Error', res?.message || 'Failed to record consumption');
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to record consumption');
        } finally {
            setSavingConsumption(false);
        }
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

                        {pdfError ? (
                            <View style={{ marginBottom: 12, padding: 10, backgroundColor: '#fef2f2', borderRadius: 8, borderWidth: 1, borderColor: '#fecaca' }}>
                                <Text style={{ color: '#dc2626', fontSize: 13, fontWeight: '500' }}>⚠️ {pdfError}</Text>
                            </View>
                        ) : null}

                        {(!pendingInvoice || invoiceStats.remaining === 0) ? (
                            <View style={styles.uploadRow}>
                                <TouchableOpacity 
                                    style={[styles.uploadInputBox, uploadingPdf && { opacity: 0.7 }]}
                                    onPress={handleSelectPdf}
                                    disabled={uploadingPdf}
                                    activeOpacity={0.7}
                                >
                                    {uploadingPdf ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <ActivityIndicator size="small" color="#2563eb" />
                                            <Text style={styles.uploadInputText}>{importLoadingState || 'Uploading PDF...'}</Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.uploadInputText}>Select PDF File...</Text>
                                    )}
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

                    {/* Inline Medicine Form Workspace (Exact Web Match) */}
                    <View style={styles.pharmaFormCard}>
                        <Text style={styles.pharmaFormTitle}>{isEditing ? 'Edit Medicine' : 'Add New Medicine'}</Text>
                        
                        <View style={styles.formSection}>
                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>MEDICINE NAME *</Text>
                                    {pendingInvoice ? (
                                        <DropdownSelect
                                            options={extractedMedicines.map(m => ({ label: m.medicineName, value: m.medicineName }))}
                                            value={newMedicine.name || ''}
                                            onChange={(val) => handleSelectExtracted(val)}
                                            placeholder="-- Select Medicine from Invoice --"
                                        />
                                    ) : (
                                        <View>
                                            <TextInput 
                                                style={styles.formInput}
                                                value={newMedicine.name}
                                                onChangeText={(val) => {
                                                    setNewMedicine({...newMedicine, name: val});
                                                    if (val.length >= 3) {
                                                        const matches = medicines.filter(m =>
                                                            (m.name || '').toLowerCase().includes(val.toLowerCase())
                                                        ).slice(0, 10);
                                                        setNameSuggestions(matches);
                                                        setShowNameSuggestions(true);
                                                    } else {
                                                        setShowNameSuggestions(false);
                                                    }
                                                }}
                                                onFocus={() => {
                                                    if (newMedicine.name && newMedicine.name.length >= 3) setShowNameSuggestions(true);
                                                }}
                                                onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                                                placeholder="e.g. Gonal-F 900 IU Pen / Menopur 75 IU"
                                            />
                                            {showNameSuggestions && nameSuggestions.length > 0 && (
                                                <View style={styles.suggestionList}>
                                                    {nameSuggestions.map((m, idx) => (
                                                        <TouchableOpacity
                                                            key={idx}
                                                            style={[
                                                                styles.suggestionItem,
                                                                idx < nameSuggestions.length - 1 && styles.suggestionItemBorder
                                                            ]}
                                                            onPress={() => {
                                                                setNewMedicine(prev => ({
                                                                    ...prev,
                                                                    name: m.name,
                                                                    salt: m.salt || prev.salt,
                                                                    category: m.category || prev.category,
                                                                    unit: m.unit || prev.unit
                                                                }));
                                                                setShowNameSuggestions(false);
                                                            }}
                                                        >
                                                            <Text style={styles.suggestionName}>{m.name}</Text>
                                                            <Text style={styles.suggestionMeta}>{m.salt || 'No Salt'} • {m.category || 'General'}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>SALT / COMPOSITION</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.salt}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, salt: val})}
                                        placeholder="e.g. Acetaminophen"
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>CATEGORY *</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.category}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, category: val})}
                                        placeholder="General"
                                    />
                                </View>
                            </View>

                            {/* Multi-Dose Tracking Section */}
                            <TouchableOpacity 
                                style={[styles.multiDoseBanner, newMedicine.isMultiDose && styles.multiDoseBannerActive]}
                                onPress={() => setNewMedicine({ ...newMedicine, isMultiDose: !newMedicine.isMultiDose })}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.multiDoseText}>{newMedicine.isMultiDose ? '☑' : '☐'} Enable Partial/Dosage Tracking (Multi-Dose items like Syrups, IV Fluids, Vials)</Text>
                            </TouchableOpacity>

                            {newMedicine.isMultiDose && (
                                <View style={styles.formRow}>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>VOLUME / DOSAGE PER UNIT *</Text>
                                        <TextInput 
                                            style={styles.formInput}
                                            value={newMedicine.packVolume ? String(newMedicine.packVolume) : ''}
                                            onChangeText={(val) => setNewMedicine({...newMedicine, packVolume: val})}
                                            keyboardType="numeric"
                                            placeholder="e.g. 900"
                                        />
                                    </View>
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>VOLUME UNIT *</Text>
                                        <DropdownSelect
                                            options={[
                                                { label: 'IU (International Units)', value: 'IU' },
                                                { label: 'IU/ml', value: 'IU/ml' },
                                                { label: 'Units', value: 'Units' },
                                                { label: 'ml', value: 'ml' },
                                                { label: 'mcg', value: 'mcg' },
                                                { label: 'mg', value: 'mg' },
                                                { label: 'Pills / Tablets', value: 'pills' },
                                            ]}
                                            value={newMedicine.volumeUnit || 'IU'}
                                            onChange={(val) => setNewMedicine({...newMedicine, volumeUnit: val})}
                                            placeholder="Select Volume Unit"
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Quantities & Unit */}
                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>PURCHASE QTY *</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.purchaseQty ? String(newMedicine.purchaseQty) : ''}
                                        onChangeText={(val) => {
                                            setNewMedicine({ ...newMedicine, purchaseQty: val, stock: (Number(val) || 0) + (Number(newMedicine.freeQty) || 0) });
                                        }}
                                        keyboardType="numeric"
                                        placeholder="e.g. 10"
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>FREE QTY (SCHEME)</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.freeQty ? String(newMedicine.freeQty) : ''}
                                        onChangeText={(val) => {
                                            setNewMedicine({ ...newMedicine, freeQty: val, stock: (Number(newMedicine.purchaseQty) || 0) + (Number(val) || 0) });
                                        }}
                                        keyboardType="numeric"
                                        placeholder="e.g. 2"
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>UNIT</Text>
                                    <DropdownSelect
                                        options={UNIT_OPTIONS}
                                        value={newMedicine.unit || 'Tablets'}
                                        onChange={(val) => setNewMedicine({...newMedicine, unit: val})}
                                        placeholder="Select Unit"
                                    />
                                </View>
                                {['Strip', 'Capsules', 'Tablets'].includes(newMedicine.unit) && (
                                    <View style={styles.formGroup}>
                                        <Text style={styles.formLabel}>{newMedicine.unit === 'Strip' ? 'UNITS PER STRIP' : 'UNITS PER PACK'}</Text>
                                        <TextInput 
                                            style={styles.formInput}
                                            value={newMedicine.unitsPerStrip ? String(newMedicine.unitsPerStrip) : ''}
                                            onChangeText={(val) => setNewMedicine({...newMedicine, unitsPerStrip: val})}
                                            keyboardType="numeric"
                                            placeholder="10"
                                        />
                                    </View>
                                )}
                            </View>

                            {/* Pricing & GST */}
                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>BUYING PRICE (₹) *</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.buyingPrice ? String(newMedicine.buyingPrice) : ''}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, buyingPrice: val})}
                                        keyboardType="numeric"
                                        placeholder="0.00"
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>CGST (%)</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.cgstPercent ? String(newMedicine.cgstPercent) : ''}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, cgstPercent: val})}
                                        keyboardType="numeric"
                                        placeholder="0"
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>SGST (%)</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.sgstPercent ? String(newMedicine.sgstPercent) : ''}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, sgstPercent: val})}
                                        keyboardType="numeric"
                                        placeholder="0"
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>FINAL AMOUNT (₹)</Text>
                                    <View style={[styles.formInput, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd', justifyContent: 'center' }]}>
                                        <Text style={{ color: '#0369a1', fontWeight: 'bold' }}>
                                            {(() => {
                                                const qty = Number(newMedicine.purchaseQty) || 0;
                                                const price = Number(newMedicine.buyingPrice) || 0;
                                                let baseTotal = qty * price;
                                                let disc = newMedicine.discountType === 'Percentage'
                                                    ? baseTotal * ((Number(newMedicine.discountValue) || 0) / 100)
                                                    : (Number(newMedicine.discountValue) || 0);
                                                const afterDisc = Math.max(0, baseTotal - disc);
                                                const cgst = afterDisc * ((Number(newMedicine.cgstPercent) || 0) / 100);
                                                const sgst = afterDisc * ((Number(newMedicine.sgstPercent) || 0) / 100);
                                                return (afterDisc + cgst + sgst).toFixed(2);
                                            })()}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Selling Price & Batch */}
                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>SELLING PRICE (₹) *</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.sellingPrice ? String(newMedicine.sellingPrice) : ''}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, sellingPrice: val})}
                                        keyboardType="numeric"
                                        placeholder="0.00"
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>BATCH NUMBER</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.batchNumber}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, batchNumber: val})}
                                        placeholder="e.g. BT-2026-001"
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>EXPIRY DATE *</Text>
                                    <DatePickerInput
                                        value={newMedicine.expiryDate}
                                        onChange={(d) => setNewMedicine({ ...newMedicine, expiryDate: d })}
                                        placeholder="Expiry Date"
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>VENDOR / SUPPLIER</Text>
                                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                        <View style={{ flex: 1 }}>
                                            <DropdownSelect
                                                options={vendors.map(v => ({ label: v.vendorName, value: v._id }))}
                                                value={newMedicine.vendorId}
                                                onChange={(val) => {
                                                    const v = vendors.find(vd => vd._id === val);
                                                    setNewMedicine({...newMedicine, vendorId: val, vendor: v ? v.vendorName : ''});
                                                }}
                                                placeholder="-- Select Vendor --"
                                            />
                                        </View>
                                        <TouchableOpacity style={styles.btnAddVendor} onPress={() => setShowVendorModal(true)}>
                                            <Text style={styles.btnAddVendorText}>+</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            {/* Rack & Min Alert */}
                            <View style={styles.formRow}>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>RACK LOCATION</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.rackLocation}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, rackLocation: val})}
                                        placeholder="e.g. Rack A-3"
                                    />
                                </View>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>MIN STOCK ALERT LEVEL</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.minStockAlertLevel ? String(newMedicine.minStockAlertLevel) : ''}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, minStockAlertLevel: val})}
                                        keyboardType="numeric"
                                        placeholder="50"
                                    />
                                </View>
                            </View>

                            {/* Form Action Buttons */}
                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                                {isEditing && (
                                    <TouchableOpacity 
                                        style={styles.btnCancelEdit} 
                                        onPress={() => { setIsEditing(false); setEditId(null); setNewMedicine(initialFormState); }}
                                    >
                                        <Text style={styles.btnCancelEditText}>Cancel Edit</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity 
                                    style={[styles.btnSavePharma, savingMedicine && { opacity: 0.7 }]} 
                                    onPress={handleAddMedicine} 
                                    disabled={savingMedicine}
                                >
                                    <Text style={styles.btnSavePharmaText}>
                                        {savingMedicine ? 'Saving...' : (isEditing ? 'Update Medicine' : 'Add Medicine')}
                                    </Text>
                                </TouchableOpacity>
                                {!isEditing && (
                                    <TouchableOpacity 
                                        style={styles.btnClearForm} 
                                        onPress={() => setNewMedicine(initialFormState)}
                                    >
                                        <Text style={styles.btnClearFormText}>Clear Form</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
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
                    </View>

                    <View style={styles.tableWrapper}>
                        {loading ? (
                            <View style={styles.loaderContainer}>
                                <ActivityIndicator size="large" color="#059669" />
                            </View>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ minWidth: 1040 }}>
                                    <View style={styles.tableHeadRow}>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Batch #</Text>
                                        <Text style={[styles.tableHead, { width: 180 }]}>Medicine Name</Text>
                                        <Text style={[styles.tableHead, { width: 120 }]}>Category</Text>
                                        <Text style={[styles.tableHead, { width: 130 }]}>Stock</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Buying (₹)</Text>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Selling (₹)</Text>
                                        <Text style={[styles.tableHead, { width: 150 }]}>Vendor</Text>
                                        <Text style={[styles.tableHead, { width: 110 }]}>Expiry</Text>
                                        <Text style={[styles.tableHead, { width: 120 }]}>Actions</Text>
                                    </View>
                                    {filteredMedicines.map((med) => (
                                        <View key={med._id} style={styles.tableRow}>
                                            <Text style={[styles.tableCell, { width: 100, color: '#64748b' }]}>#{med.batchNumber}</Text>
                                            <Text style={[styles.tableCell, styles.medName, { width: 180 }]}>{med.name}</Text>
                                            <View style={{ width: 120, padding: 12, justifyContent: 'center' }}>
                                                <View style={styles.categoryTag}>
                                                    <Text style={styles.categoryTagText}>{med.category}</Text>
                                                </View>
                                            </View>
                                            <View style={{ width: 130, padding: 12, justifyContent: 'center' }}>
                                                <Text style={med.stock < (med.minStockAlertLevel || 50) ? styles.lowStock : styles.goodStock}>
                                                    {med.stock} {med.unit}
                                                </Text>
                                            </View>
                                            <Text style={[styles.tableCell, { width: 100 }]}>₹{med.buyingPrice}</Text>
                                            <Text style={[styles.tableCell, { width: 100, fontWeight: 'bold' }]}>₹{med.sellingPrice}</Text>
                                            <Text style={[styles.tableCell, { width: 150, color: '#475569' }]} numberOfLines={1}>{med.vendor || 'N/A'}</Text>
                                            <Text style={[styles.tableCell, { width: 110 }]}>
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
                <PurchaseInvoiceHistory />
            )}

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
                            <TouchableOpacity style={[styles.btnSave, savingVendor && { opacity: 0.7 }]} onPress={handleSaveVendor} disabled={savingVendor}>
                                <Text style={styles.btnSaveText}>{savingVendor ? 'Saving...' : 'Save Vendor'}</Text>
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
                                <DropdownSelect
                                    options={medicines.map(m => ({ label: `${m.name} (Stock: ${m.stock})`, value: m._id }))}
                                    value={consumptionForm.medicineId}
                                    onChange={(val) => setConsumptionForm({...consumptionForm, medicineId: val})}
                                    placeholder="-- Choose Medicine --"
                                />
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
                                <DropdownSelect
                                    options={REASON_OPTIONS}
                                    value={consumptionForm.reason}
                                    onChange={(val) => setConsumptionForm({...consumptionForm, reason: val})}
                                    placeholder="Select Reason"
                                />
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
                            <TouchableOpacity style={[styles.btnSave, { backgroundColor: '#ef4444' }, savingConsumption && { opacity: 0.7 }]} onPress={handleRecordConsumption} disabled={savingConsumption}>
                                <Text style={styles.btnSaveText}>{savingConsumption ? 'Recording...' : 'Record Usage'}</Text>
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
    },

    /* Medicine Name Autocomplete */
    suggestionList: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        marginTop: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 5,
        maxHeight: 220,
        overflow: 'hidden',
    },
    suggestionItem: {
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    suggestionItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    suggestionName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
    },
    suggestionMeta: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1,
    },
});

export default PharmacyInventory;
