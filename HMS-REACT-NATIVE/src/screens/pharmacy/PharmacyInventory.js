import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Alert, Platform, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { pharmacyAPI } from '../../utils/api';
import PurchaseInvoiceHistory from './PurchaseInvoiceHistory';
import DropdownSelect from '../../components/common/DropdownSelect';
import DatePickerInput, { formatToDisplay, formatToYMD } from '../../components/common/DatePickerInput';

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
    const { width: windowWidth } = useWindowDimensions();
    const isDesktop = windowWidth >= 1024;
    const isTablet = windowWidth >= 600 && windowWidth < 1024;
    const isMobile = windowWidth < 768;
    const isNarrow = windowWidth <= 600;
    const isSmallMobile = windowWidth <= 430;
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
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage.getItem(key);
        }
        return AsyncStorage.getItem(key);
    };

    const storageSet = async (key, value) => {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(key, value);
        } else {
            await AsyncStorage.setItem(key, value);
        }
    };

    const storageRemove = async (key) => {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(key);
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

    const handleSelectPdf = async () => {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.document !== 'undefined') {
            const input = window.document.createElement('input');
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
            try {
                const result = await DocumentPicker.getDocumentAsync({
                    type: ['application/pdf'],
                    copyToCacheDirectory: true
                });
                if (result.canceled || !result.assets || result.assets.length === 0) {
                    return;
                }
                const asset = result.assets[0];
                const ext = (asset.name || '').split('.').pop().toLowerCase();
                if (ext !== 'pdf' && asset.mimeType !== 'application/pdf') {
                    setPdfError('Please upload a valid PDF invoice.');
                    Alert.alert('Invalid File', 'Only PDF files are supported for invoice parsing.');
                    return;
                }
                if (asset.size && asset.size > 10 * 1024 * 1024) {
                    setPdfError('File size must be less than 10MB.');
                    Alert.alert('File Too Large', 'File size must be less than 10MB.');
                    return;
                }
                await processPdfUpload(asset);
            } catch (err) {
                console.error('Error selecting document:', err);
                Alert.alert('Error', 'Failed to pick invoice document.');
            }
        }
    };

    const processPdfUpload = async (file) => {
        setPdfError('');
        setImportLoadingState('Uploading PDF...');
        setUploadingPdf(true);
        try {
            const formData = new FormData();
            if (file && file.uri) {
                // Native mobile asset from expo-document-picker
                formData.append('invoice', {
                    uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
                    name: file.name || 'invoice.pdf',
                    type: file.mimeType || 'application/pdf'
                });
            } else {
                // Browser File object on web
                formData.append('invoice', file);
            }

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
            expiryDate: med.expiry ? (formatToYMD(med.expiry) || prev.expiryDate) : prev.expiryDate,
            purchaseDate: formatToYMD(new Date())
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
            expiryDate: med.expiryDate ? formatToYMD(med.expiryDate) : '',
            purchaseDate: med.purchaseDate ? formatToYMD(med.purchaseDate) : formatToYMD(new Date()),
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
                <View style={{ flex: 1, minWidth: 200 }}>
                    <Text style={styles.headerTitle}>💊 Medicine Inventory</Text>
                    <Text style={styles.headerSubtitle}>Manage your hospital's medicine stock, pricing, and expiry tracking</Text>
                </View>
                <View style={[styles.headerButtons, isMobile && { width: '100%', flexDirection: isSmallMobile ? 'column' : 'row', marginTop: 12 }]}>
                    <TouchableOpacity 
                        style={[styles.btnAction, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }, isSmallMobile && { width: '100%', alignItems: 'center' }]} 
                        onPress={() => setShowConsumptionModal(true)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.btnActionText, { color: '#b91c1c' }]}>📌 Record Consumption</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.btnAction, { backgroundColor: '#e0e7ff', borderColor: '#c7d2fe' }, isSmallMobile && { width: '100%', alignItems: 'center' }]} 
                        onPress={() => setShowVendorModal(true)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.btnActionText, { color: '#4338ca' }]}>👥 Manage Vendors</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* KPI Cards: Responsive 1-2 columns mobile, 4 columns desktop */}
            <View style={styles.pharmaKpiGrid}>
                <View style={[styles.pharmaKpiCard, isMobile && { minWidth: '47%' }]}>
                    <Text style={styles.pharmaKpiLabel}>Total Medicines</Text>
                    <Text style={styles.pharmaKpiValue}>{medicines.length}</Text>
                    <Text style={styles.pharmaKpiSub}>Unique formulations</Text>
                </View>
                <View style={[styles.pharmaKpiCard, { borderColor: '#fecaca', backgroundColor: '#fff5f5' }, isMobile && { minWidth: '47%' }]}>
                    <Text style={[styles.pharmaKpiLabel, { color: '#991b1b' }]}>Low Stock Alert</Text>
                    <Text style={[styles.pharmaKpiValue, { color: '#dc2626' }]}>
                        {medicines.filter(m => m.stock < (m.minStockAlertLevel || 50)).length}
                    </Text>
                    <Text style={[styles.pharmaKpiSub, { color: '#b91c1c' }]}>Requires reordering</Text>
                </View>
                <View style={[styles.pharmaKpiCard, isMobile && { minWidth: '47%' }]}>
                    <Text style={styles.pharmaKpiLabel}>Total Units</Text>
                    <Text style={styles.pharmaKpiValue}>
                        {medicines.reduce((acc, m) => acc + (Number(m.stock) || 0), 0)}
                    </Text>
                    <Text style={styles.pharmaKpiSub}>In pharmacy stock</Text>
                </View>
                <View style={[styles.pharmaKpiCard, isMobile && { minWidth: '47%' }]}>
                    <Text style={styles.pharmaKpiLabel}>Active Vendors</Text>
                    <Text style={styles.pharmaKpiValue}>{vendors.length}</Text>
                    <Text style={styles.pharmaKpiSub}>Registered suppliers</Text>
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
                            {/* Row 1: Medicine Name, Salt / Composition, Category */}
                            <View style={[styles.formRow, isNarrow && { flexDirection: 'column', gap: 12 }]}>
                                <View style={[styles.formGroup, isNarrow ? { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 } : (isTablet ? { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 } : { flex: 2 })]}>
                                    <Text style={styles.formLabel}>MEDICINE NAME *</Text>
                                    {(!isEditing && pendingInvoice && extractedMedicines && extractedMedicines.length > 0 && invoiceStats.remaining > 0) ? (
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
                                <View style={[styles.formGroup, isNarrow ? { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 } : (isTablet ? { width: '48%', minWidth: 160, flex: 1 } : { flex: 1.5 })]}>
                                    <Text style={styles.formLabel}>SALT / COMPOSITION</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.salt}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, salt: val})}
                                        placeholder="e.g. Acetaminophen"
                                    />
                                </View>
                                <View style={[styles.formGroup, isNarrow ? { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 } : (isTablet ? { width: '48%', minWidth: 160, flex: 1 } : { flex: 1 })]}>
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
                                <View style={[styles.formRow, isNarrow && { flexDirection: 'column', gap: 12 }]}>
                                    <View style={[styles.formGroup, isNarrow && { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 }]}>
                                        <Text style={styles.formLabel}>VOLUME / DOSAGE PER UNIT *</Text>
                                        <TextInput 
                                            style={styles.formInput}
                                            value={newMedicine.packVolume ? String(newMedicine.packVolume) : ''}
                                            onChangeText={(val) => setNewMedicine({...newMedicine, packVolume: val})}
                                            keyboardType="numeric"
                                            placeholder="e.g. 900"
                                        />
                                    </View>
                                    <View style={[styles.formGroup, isNarrow && { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 }]}>
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
                            <View style={[styles.formRow, isNarrow && { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }]}>
                                <View style={[styles.formGroup, isSmallMobile ? { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 } : (isNarrow ? { width: '48%', minWidth: 140, flex: 1 } : {})]}>
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
                                <View style={[styles.formGroup, isSmallMobile ? { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 } : (isNarrow ? { width: '48%', minWidth: 140, flex: 1 } : {})]}>
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
                                <View style={[styles.formGroup, isNarrow && { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 }]}>
                                    <Text style={styles.formLabel}>UNIT</Text>
                                    <DropdownSelect
                                        options={UNIT_OPTIONS}
                                        value={newMedicine.unit || 'Tablets'}
                                        onChange={(val) => setNewMedicine({...newMedicine, unit: val})}
                                        placeholder="Select Unit"
                                    />
                                </View>
                                {['Strip', 'Capsules', 'Tablets'].includes(newMedicine.unit) && (
                                    <View style={[styles.formGroup, isNarrow && { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 }]}>
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
                            <View style={[styles.formRow, isNarrow && { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }]}>
                                <View style={[styles.formGroup, isNarrow ? { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 } : {}]}>
                                    <Text style={styles.formLabel}>BUYING PRICE (₹) *</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.buyingPrice ? String(newMedicine.buyingPrice) : ''}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, buyingPrice: val})}
                                        keyboardType="numeric"
                                        placeholder="0.00"
                                    />
                                </View>
                                <View style={[styles.formGroup, isSmallMobile ? { width: '48%', minWidth: 120, flex: 1 } : (isNarrow ? { width: '48%', minWidth: 140, flex: 1 } : {})]}>
                                    <Text style={styles.formLabel}>CGST (%)</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.cgstPercent ? String(newMedicine.cgstPercent) : ''}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, cgstPercent: val})}
                                        keyboardType="numeric"
                                        placeholder="0"
                                    />
                                </View>
                                <View style={[styles.formGroup, isSmallMobile ? { width: '48%', minWidth: 120, flex: 1 } : (isNarrow ? { width: '48%', minWidth: 140, flex: 1 } : {})]}>
                                    <Text style={styles.formLabel}>SGST (%)</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.sgstPercent ? String(newMedicine.sgstPercent) : ''}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, sgstPercent: val})}
                                        keyboardType="numeric"
                                        placeholder="0"
                                    />
                                </View>
                                <View style={[styles.formGroup, isNarrow && { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 }]}>
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
                            <View style={[styles.formRow, isNarrow && { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }]}>
                                <View style={[styles.formGroup, isSmallMobile ? { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 } : (isNarrow ? { width: '48%', minWidth: 140, flex: 1 } : {})]}>
                                    <Text style={styles.formLabel}>SELLING PRICE (₹) *</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.sellingPrice ? String(newMedicine.sellingPrice) : ''}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, sellingPrice: val})}
                                        keyboardType="numeric"
                                        placeholder="0.00"
                                    />
                                </View>
                                <View style={[styles.formGroup, isSmallMobile ? { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 } : (isNarrow ? { width: '48%', minWidth: 140, flex: 1 } : {})]}>
                                    <Text style={styles.formLabel}>BATCH NUMBER</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.batchNumber}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, batchNumber: val})}
                                        placeholder="e.g. BT-2026-001"
                                    />
                                </View>
                                <View style={[styles.formGroup, isNarrow && { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 }]}>
                                    <Text style={styles.formLabel}>EXPIRY DATE *</Text>
                                    <DatePickerInput
                                        value={newMedicine.expiryDate}
                                        onChange={(d) => setNewMedicine({ ...newMedicine, expiryDate: d })}
                                        placeholder="Expiry Date"
                                    />
                                </View>
                                <View style={[styles.formGroup, isNarrow && { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 }]}>
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
                            <View style={[styles.formRow, isNarrow && { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }]}>
                                <View style={[styles.formGroup, isSmallMobile ? { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 } : (isNarrow ? { width: '48%', minWidth: 140, flex: 1 } : {})]}>
                                    <Text style={styles.formLabel}>RACK LOCATION</Text>
                                    <TextInput 
                                        style={styles.formInput}
                                        value={newMedicine.rackLocation}
                                        onChangeText={(val) => setNewMedicine({...newMedicine, rackLocation: val})}
                                        placeholder="e.g. Rack A-3"
                                    />
                                </View>
                                <View style={[styles.formGroup, isSmallMobile ? { width: '100%', minWidth: '100%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 } : (isNarrow ? { width: '48%', minWidth: 140, flex: 1 } : {})]}>
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
                            <View style={[styles.formActionButtonsRow, isNarrow && { flexDirection: 'column', width: '100%', gap: 10 }]}>
                                {isEditing && (
                                    <TouchableOpacity 
                                        style={[styles.btnCancelEdit, isNarrow && { width: '100%', minHeight: 46, alignItems: 'center', justifyContent: 'center' }]} 
                                        onPress={() => { setIsEditing(false); setEditId(null); setNewMedicine(initialFormState); }}
                                    >
                                        <Text style={styles.btnCancelEditText}>Cancel Edit</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity 
                                    style={[styles.btnSavePharma, savingMedicine && { opacity: 0.7 }, isNarrow && { width: '100%', minHeight: 46, alignItems: 'center', justifyContent: 'center' }]} 
                                    onPress={handleAddMedicine} 
                                    disabled={savingMedicine}
                                >
                                    <Text style={styles.btnSavePharmaText}>
                                        {savingMedicine ? 'Saving...' : (isEditing ? 'Update Medicine' : 'Add Medicine')}
                                    </Text>
                                </TouchableOpacity>
                                {!isEditing && (
                                    <TouchableOpacity 
                                        style={[styles.btnClearForm, isNarrow && { width: '100%', minHeight: 46, alignItems: 'center', justifyContent: 'center' }]} 
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
                                placeholder="Search medicines by name or category..."
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
                        ) : isMobile ? (
                            /* Mobile Card / List Presentation (Web 1:1 Parity, Responsive First) */
                            <View style={styles.mobileMedList}>
                                {filteredMedicines.length === 0 ? (
                                    <View style={styles.emptyMedCard}>
                                        <Text style={styles.emptyMedText}>No medicines match your search criteria.</Text>
                                    </View>
                                ) : (
                                    filteredMedicines.map((med) => {
                                        const isLow = med.stock < (med.minStockAlertLevel || 50);
                                        const expiryStr = med.expiryDate ? formatToDisplay(med.expiryDate) : 'N/A';
                                        return (
                                            <View key={med._id} style={styles.medCard}>
                                                {/* Header: Title + Category + Status */}
                                                <View style={styles.medCardHeader}>
                                                    <View style={{ flex: 1, marginRight: 8 }}>
                                                        <Text style={styles.medCardName}>{med.name}</Text>
                                                        {med.salt ? <Text style={styles.medCardSalt}>{med.salt}</Text> : null}
                                                    </View>
                                                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                                        <View style={styles.categoryTag}>
                                                            <Text style={styles.categoryTagText}>{med.category || 'General'}</Text>
                                                        </View>
                                                        <View style={[
                                                            styles.statusBadgeSmall,
                                                            med.stock <= 0 ? styles.badgeOutOfStock : (isLow ? styles.badgeLowStock : styles.badgeInStock)
                                                        ]}>
                                                            <Text style={[
                                                                styles.statusBadgeSmallText,
                                                                med.stock <= 0 ? styles.textOutOfStock : (isLow ? styles.textLowStock : styles.textInStock)
                                                            ]}>
                                                                {med.stock <= 0 ? 'Out of Stock' : (isLow ? 'Low Stock' : 'In Stock')}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>

                                                {/* Details Grid */}
                                                <View style={styles.medCardGrid}>
                                                    <View style={styles.medCardGridItem}>
                                                        <Text style={styles.medCardGridLabel}>Batch #</Text>
                                                        <Text style={styles.medCardGridVal}>#{med.batchNumber || '—'}</Text>
                                                    </View>
                                                    <View style={[styles.medCardGridItem, med.isMultiDose && { width: '100%' }]}>
                                                        <Text style={styles.medCardGridLabel}>Available Stock</Text>
                                                        {med.isMultiDose ? (
                                                            <View style={{ marginTop: 2 }}>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                                                    <Text style={[styles.medCardGridVal, isLow ? styles.lowStockText : styles.goodStockText, { fontWeight: '700' }]}>
                                                                        {med.stock} {med.unit || 'Vials'}
                                                                    </Text>
                                                                    <Text style={{ fontSize: 11.5, color: '#475569', fontWeight: 'normal' }}>
                                                                        ({med.openUnitVolume || 0}/{med.packVolume} {med.volumeUnit} open)
                                                                    </Text>
                                                                    {isLow && (
                                                                        <View style={styles.lowStockBadge}>
                                                                            <Text style={styles.lowStockBadgeText}>Low</Text>
                                                                        </View>
                                                                    )}
                                                                </View>
                                                                {Number(med.openUnitVolume) > 0 && (
                                                                    <View style={styles.stockProgressBarBg}>
                                                                        <View 
                                                                            style={[
                                                                                styles.stockProgressBarFill, 
                                                                                { width: `${Math.min(100, Math.max(0, ((Number(med.openUnitVolume) / (Number(med.packVolume) || 1)) * 100)))}%` }
                                                                            ]} 
                                                                        />
                                                                    </View>
                                                                )}
                                                            </View>
                                                        ) : (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                                                                {['Strip', 'Capsules', 'Tablets'].includes(med.unit) ? (
                                                                    <Text style={[styles.medCardGridVal, isLow ? styles.lowStockText : styles.goodStockText]}>
                                                                        {Math.floor(med.stock / (Number(med.unitsPerStrip) || 1))} {med.unit}{' '}
                                                                        <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 'normal' }}>({med.stock} Units)</Text>
                                                                    </Text>
                                                                ) : (
                                                                    <Text style={[styles.medCardGridVal, isLow ? styles.lowStockText : styles.goodStockText]}>
                                                                        {med.stock} {med.unit}
                                                                    </Text>
                                                                )}
                                                                {isLow && (
                                                                    <View style={styles.lowStockBadge}>
                                                                        <Text style={styles.lowStockBadgeText}>Low</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                        )}
                                                    </View>
                                                    <View style={styles.medCardGridItem}>
                                                        <Text style={styles.medCardGridLabel}>Min Stock Alert</Text>
                                                        <Text style={styles.medCardGridVal}>{med.minStockAlertLevel || 50} {med.unit}</Text>
                                                    </View>
                                                    <View style={styles.medCardGridItem}>
                                                        <Text style={styles.medCardGridLabel}>Expiry Date</Text>
                                                        <Text style={styles.medCardGridVal}>{expiryStr}</Text>
                                                    </View>
                                                    <View style={styles.medCardGridItem}>
                                                        <Text style={styles.medCardGridLabel}>Buying / Selling</Text>
                                                        <Text style={styles.medCardGridVal}>₹{med.buyingPrice} / ₹{med.sellingPrice}</Text>
                                                    </View>
                                                    <View style={styles.medCardGridItem}>
                                                        <Text style={styles.medCardGridLabel}>Rack Location</Text>
                                                        <Text style={styles.medCardGridVal}>{med.rackLocation || '—'}</Text>
                                                    </View>
                                                    <View style={[styles.medCardGridItem, { width: '100%' }]}>
                                                        <Text style={styles.medCardGridLabel}>Vendor</Text>
                                                        <Text style={styles.medCardGridVal} numberOfLines={2}>{med.vendor || 'N/A'}</Text>
                                                    </View>
                                                </View>

                                                {/* Actions Row */}
                                                <View style={styles.medCardActionsRow}>
                                                    <TouchableOpacity 
                                                        style={[styles.medCardActionBtn, { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' }]} 
                                                        onPress={() => handleViewDetails(med)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={[styles.medCardActionText, { color: '#0369a1' }]}>👁️ Details</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        style={[styles.medCardActionBtn, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]} 
                                                        onPress={() => handleEdit(med)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={[styles.medCardActionText, { color: '#059669' }]}>✏️ Edit</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        style={[styles.medCardActionBtn, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]} 
                                                        onPress={() => {
                                                            setConsumptionForm({
                                                                medicineId: med._id,
                                                                quantity: '',
                                                                reason: 'Doctor/Staff Use',
                                                                givenTo: ''
                                                            });
                                                            setShowConsumptionModal(true);
                                                        }}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={[styles.medCardActionText, { color: '#b45309' }]}>📌 Stock Adj.</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        style={[styles.medCardActionBtn, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]} 
                                                        onPress={() => handleDelete(med._id)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={[styles.medCardActionText, { color: '#dc2626' }]}>🗑️ Delete</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                            </View>
                        ) : (
                            /* Desktop / Tablet Horizontal Table View */
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ minWidth: 1080 }}>
                                    <View style={styles.tableHeadRow}>
                                        <Text style={[styles.tableHead, { width: 100 }]}>Batch #</Text>
                                        <Text style={[styles.tableHead, { width: 180 }]}>Medicine Name</Text>
                                        <Text style={[styles.tableHead, { width: 120 }]}>Category</Text>
                                        <Text style={[styles.tableHead, { width: 170 }]}>Stock</Text>
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
                                             <View style={{ width: 170, padding: 12, justifyContent: 'center' }}>
                                                 {med.isMultiDose ? (
                                                     <View style={{ flexDirection: 'column', gap: 4 }}>
                                                         <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                                                             <Text style={[med.stock < (med.minStockAlertLevel || 50) ? styles.lowStock : styles.goodStock, { fontWeight: '700' }]}>
                                                                 {med.stock} {med.unit || 'Vials'}
                                                             </Text>
                                                             <Text style={{ fontSize: 11, color: '#475569', fontWeight: 'normal' }}>
                                                                 ({med.openUnitVolume || 0}/{med.packVolume} {med.volumeUnit} open)
                                                             </Text>
                                                         </View>
                                                         {Number(med.openUnitVolume) > 0 && (
                                                             <View style={styles.stockProgressBarBg}>
                                                                 <View 
                                                                     style={[
                                                                         styles.stockProgressBarFill, 
                                                                         { width: `${Math.min(100, Math.max(0, ((Number(med.openUnitVolume) / (Number(med.packVolume) || 1)) * 100)))}%` }
                                                                     ]} 
                                                                 />
                                                             </View>
                                                         )}
                                                     </View>
                                                 ) : (
                                                     <View>
                                                         {['Strip', 'Capsules', 'Tablets'].includes(med.unit) ? (
                                                             <Text style={med.stock < (med.minStockAlertLevel || 50) ? styles.lowStock : styles.goodStock}>
                                                                 {Math.floor(med.stock / (Number(med.unitsPerStrip) || 1))} {med.unit}{' '}
                                                                 <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 'normal' }}>({med.stock} Units)</Text>
                                                             </Text>
                                                         ) : (
                                                             <Text style={med.stock < (med.minStockAlertLevel || 50) ? styles.lowStock : styles.goodStock}>
                                                                 {med.stock} {med.unit}
                                                             </Text>
                                                         )}
                                                     </View>
                                                 )}
                                             </View>
                                            <Text style={[styles.tableCell, { width: 100 }]}>₹{med.buyingPrice}</Text>
                                            <Text style={[styles.tableCell, { width: 100, fontWeight: 'bold' }]}>₹{med.sellingPrice}</Text>
                                            <Text style={[styles.tableCell, { width: 150, color: '#475569' }]} numberOfLines={1}>{med.vendor || 'N/A'}</Text>
                                            <Text style={[styles.tableCell, { width: 110 }]}>
                                                {med.expiryDate ? formatToDisplay(med.expiryDate) : 'N/A'}
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
            <Modal visible={showDetailsModal} transparent={true} animationType="slide" onRequestClose={() => setShowDetailsModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxWidth: 680, maxHeight: '90%' }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={styles.modalTitle} numberOfLines={1}>💊 {selectedMedicine?.name}</Text>
                                <Text style={styles.modalSubtitle}>Comprehensive Inventory Details</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => setShowDetailsModal(false)}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            >
                                <Text style={styles.closeBtn}>×</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView 
                            style={styles.modalBody}
                            contentContainerStyle={{ paddingBottom: 16 }}
                            showsVerticalScrollIndicator={true}
                        >
                            {selectedMedicine && (() => {
                                const groupedMedicines = medicines.filter(med =>
                                    (med.batchNumber && med.batchNumber === selectedMedicine.batchNumber &&
                                        (med.vendor === selectedMedicine.vendor || med.vendorId === selectedMedicine.vendorId)) ||
                                    (med._id === selectedMedicine._id)
                                );
                                const uniqueGrouped = Array.from(new Set(groupedMedicines.map(m => m._id)))
                                    .map(id => groupedMedicines.find(m => m._id === id));
                                let totalPurchaseQty = 0, totalFreeQty = 0, totalStockQty = 0, totalGrossPurchaseAmount = 0, totalDiscountAmount = 0, totalTaxableAmount = 0, totalCGST = 0, totalSGST = 0, totalGST = 0, totalFinalPurchaseAmount = 0, totalExpectedRevenue = 0;
                                uniqueGrouped.forEach(med => {
                                    const pQty = (med.purchaseQty !== undefined && med.purchaseQty !== null) ? Number(med.purchaseQty) : (Number(med.stock) || 0);
                                    const fQty = Number(med.freeQty) || 0;
                                    const stock = pQty + fQty;
                                    const buyingPrice = Number(med.buyingPrice) || 0;
                                    const sellingPrice = Number(med.sellingPrice) || 0;
                                    const gross = pQty * buyingPrice;
                                    let discountAmount = med.discountType === 'Flat Amount' ? Number(med.discountValue) || 0 : gross * ((Number(med.discountValue) || 0) / 100);
                                    const taxable = Math.max(0, gross - discountAmount);
                                    const cgstAmt = taxable * ((Number(med.cgstPercent) || 0) / 100);
                                    const sgstAmt = taxable * ((Number(med.sgstPercent) || 0) / 100);
                                    const gstAmt = cgstAmt + sgstAmt;
                                    totalPurchaseQty += pQty; totalFreeQty += fQty; totalStockQty += stock; totalGrossPurchaseAmount += gross; totalDiscountAmount += discountAmount; totalTaxableAmount += taxable; totalCGST += cgstAmt; totalSGST += sgstAmt; totalGST += gstAmt; totalFinalPurchaseAmount += (taxable + gstAmt); totalExpectedRevenue += (stock * sellingPrice);
                                });
                                const expectedProfit = totalExpectedRevenue - totalFinalPurchaseAmount;

                                return (
                                    <View>
                                        {/* Inventory Status Card */}
                                        <View style={styles.detailsBox}>
                                            <Text style={styles.sectionTitle}>Inventory Status</Text>
                                            <View style={styles.detailsGrid}>
                                                <View style={{ minWidth: '45%', flex: 1 }}>
                                                    <Text style={styles.detailsLabel}>Supplier</Text>
                                                    <Text style={styles.detailsValue}>{selectedMedicine.vendor || 'N/A'}</Text>
                                                </View>
                                                <View style={{ minWidth: '45%', flex: 1 }}>
                                                    <Text style={styles.detailsLabel}>Batch</Text>
                                                    <Text style={styles.detailsValue}>{selectedMedicine.batchNumber || 'N/A'}</Text>
                                                </View>
                                                <View style={{ minWidth: '45%', flex: 1 }}>
                                                    <Text style={styles.detailsLabel}>Expiry</Text>
                                                    <Text style={styles.detailsValue}>
                                                        {selectedMedicine.expiryDate ? formatToDisplay(selectedMedicine.expiryDate) : 'N/A'}
                                                    </Text>
                                                </View>
                                                <View style={{ minWidth: '45%', flex: 1 }}>
                                                    <Text style={styles.detailsLabel}>Category</Text>
                                                    <Text style={styles.detailsValue}>{selectedMedicine.category || 'General'}</Text>
                                                </View>
                                            </View>
                                        </View>

                                        {/* Detailed Inventory Table */}
                                        <View style={styles.detailsTableWrapper}>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled={true}>
                                                <View style={{ minWidth: 570 }}>
                                                    <View style={styles.detailsTableHeadRow}>
                                                        <Text style={[styles.detailsTableHead, { width: 140 }]}>Medicine Name</Text>
                                                        <Text style={[styles.detailsTableHead, { width: 80 }]}>Batch #</Text>
                                                        <Text style={[styles.detailsTableHead, { width: 85 }]}>Stock Qty</Text>
                                                        <Text style={[styles.detailsTableHead, { width: 95 }]}>Cost Price</Text>
                                                        <Text style={[styles.detailsTableHead, { width: 85 }]}>Selling Price</Text>
                                                        <Text style={[styles.detailsTableHead, { width: 85 }]}>Total Amount</Text>
                                                    </View>
                                                    {uniqueGrouped.map(med => {
                                                        const pQty = (med.purchaseQty !== undefined && med.purchaseQty !== null) ? Number(med.purchaseQty) : (Number(med.stock) || 0);
                                                        const buyingPrice = Number(med.buyingPrice) || 0;
                                                        const gross = pQty * buyingPrice;
                                                        let discountAmount = med.discountType === 'Flat Amount' ? Number(med.discountValue) || 0 : gross * ((Number(med.discountValue) || 0) / 100);
                                                        const taxable = Math.max(0, gross - discountAmount);
                                                        const cgstAmt = taxable * ((Number(med.cgstPercent) || 0) / 100);
                                                        const sgstAmt = taxable * ((Number(med.sgstPercent) || 0) / 100);
                                                        const totalFinalCost = taxable + cgstAmt + sgstAmt;
                                                        const isSelected = med._id === selectedMedicine._id;

                                                        return (
                                                            <View 
                                                                key={med._id} 
                                                                style={[
                                                                    styles.detailsTableRow,
                                                                    isSelected && styles.detailsTableRowSelected
                                                                ]}
                                                            >
                                                                <View style={{ width: 140, paddingRight: 6 }}>
                                                                    <Text style={[styles.detailsTableCell, { fontWeight: '700', color: '#0f172a' }]}>
                                                                        {med.name} {isSelected ? '(Selected)' : ''}
                                                                    </Text>
                                                                </View>
                                                                <View style={{ width: 80, paddingRight: 4 }}>
                                                                    <Text style={[styles.detailsTableCell, { color: '#475569' }]}>
                                                                        {med.batchNumber || 'N/A'}
                                                                    </Text>
                                                                </View>
                                                                <View style={{ width: 85, paddingRight: 4 }}>
                                                                    <Text style={[
                                                                        styles.detailsTableCell, 
                                                                        { fontWeight: '700', color: med.stock < (med.minStockAlertLevel || 50) ? '#dc2626' : '#059669' }
                                                                    ]}>
                                                                        {med.stock} {med.unit || 'Tabs'}
                                                                    </Text>
                                                                </View>
                                                                <View style={{ width: 95, paddingRight: 4 }}>
                                                                    <Text style={[styles.detailsTableCell, { color: '#1e293b' }]}>
                                                                        ₹{med.buyingPrice || 0}
                                                                    </Text>
                                                                    <Text style={{ fontSize: 9.5, color: '#64748b' }}>
                                                                        (+{med.cgstPercent || 0}% CGST)
                                                                    </Text>
                                                                </View>
                                                                <View style={{ width: 85, paddingRight: 4 }}>
                                                                    <Text style={[styles.detailsTableCell, { fontWeight: '700', color: '#059669' }]}>
                                                                        ₹{med.sellingPrice || 0}
                                                                    </Text>
                                                                </View>
                                                                <View style={{ width: 85, paddingRight: 4 }}>
                                                                    <Text style={[styles.detailsTableCell, { fontWeight: '700', color: '#0f172a' }]}>
                                                                        ₹{totalFinalCost.toFixed(2)}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            </ScrollView>
                                        </View>

                                        {/* Financial Summary */}
                                        <View style={styles.financialSummaryCard}>
                                            <View style={styles.financialSummaryGrid}>
                                                <View style={styles.financialMetricItem}>
                                                    <Text style={[styles.financialMetricLabel, styles.financialMetricLabelEmerald]}>Stock</Text>
                                                    <Text style={[styles.financialMetricValue, styles.financialMetricValueEmerald]}>{totalStockQty}</Text>
                                                </View>
                                                <View style={styles.financialMetricItem}>
                                                    <Text style={styles.financialMetricLabel}>Final Cost</Text>
                                                    <Text style={styles.financialMetricValue}>₹{totalFinalPurchaseAmount.toFixed(2)}</Text>
                                                </View>
                                                <View style={styles.financialMetricItem}>
                                                    <Text style={styles.financialMetricLabel}>Revenue</Text>
                                                    <Text style={styles.financialMetricValue}>₹{totalExpectedRevenue.toFixed(2)}</Text>
                                                </View>
                                                <View style={styles.financialMetricItem}>
                                                    <Text style={[styles.financialMetricLabel, styles.financialMetricLabelEmerald]}>Profit</Text>
                                                    <Text style={[styles.financialMetricValue, styles.financialMetricValueEmerald]}>₹{expectedProfit.toFixed(2)}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })()}
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
                                    insideModal={true}
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
                                    insideModal={true}
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
        padding: 14,
    },
    header: {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#064e3b',
    },
    headerSubtitle: {
        color: '#64748b',
        fontSize: 13,
        marginTop: 4,
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
        flexWrap: 'wrap',
    },
    btnAction: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
    btnActionText: {
        fontWeight: '600',
        fontSize: 13,
    },

    /* KPI Summary Cards */
    pharmaKpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
    },
    pharmaKpiCard: {
        flex: 1,
        minWidth: 140,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    pharmaKpiLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    pharmaKpiValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        marginVertical: 3,
    },
    pharmaKpiSub: {
        fontSize: 11,
        color: '#94a3b8',
    },

    tabsContainer: {
        flexDirection: 'row',
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        marginBottom: 16,
        paddingBottom: 8,
    },
    tabButton: {
        paddingVertical: 8,
        paddingHorizontal: 6,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: '#3b82f6',
        marginBottom: -10,
    },
    tabText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '500',
    },
    activeTabText: {
        color: '#3b82f6',
        fontWeight: '700',
    },
    invoiceUploadSection: {
        backgroundColor: '#f0f9ff',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#bae6fd',
        marginBottom: 16,
    },
    invoiceUploadHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    invoiceUploadTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0369a1',
    },
    invoiceUploadSubtitle: {
        fontSize: 12,
        color: '#0284c7',
        marginTop: 2,
    },
    btnUploadNew: {
        backgroundColor: '#0284c7',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    btnUploadNewText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    successBox: {
        backgroundColor: '#dcfce7',
        padding: 10,
        borderRadius: 6,
        marginBottom: 12,
    },
    successText: {
        color: '#166534',
        fontSize: 13,
        fontWeight: '600',
    },
    uploadRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    uploadInputBox: {
        backgroundColor: 'white',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#7dd3fc',
        width: '100%',
        maxWidth: 340,
    },
    uploadInputText: {
        color: '#64748b',
        fontSize: 13,
    },
    invoiceStatusBox: {
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0f2fe',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
    },
    invoiceStatusTitle: {
        color: '#0c4a6e',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    invoiceStatsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    invoiceStatText: {
        color: '#0369a1',
        fontSize: 13,
        fontWeight: '500',
    },
    invoiceActionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    btnCancelInvoice: {
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fecaca',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    btnCancelInvoiceText: {
        color: '#dc2626',
        fontSize: 12,
        fontWeight: '600',
    },
    inventoryControls: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    searchBar: {
        flex: 1,
        minWidth: 200,
        backgroundColor: 'white',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 14,
        paddingVertical: 4,
        height: 44,
        justifyContent: 'center',
    },
    searchInput: {
        fontSize: 14,
        color: '#064e3b',
    },
    btnAdd: {
        backgroundColor: '#059669',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnAddText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    tableWrapper: {
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        padding: 12,
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
    },

    /* Mobile Medicine Card List Styles */
    mobileMedList: {
        gap: 10,
    },
    emptyMedCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    emptyMedText: {
        color: '#64748b',
        fontSize: 13,
        textAlign: 'center',
    },
    medCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    medCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 8,
        marginBottom: 10,
    },
    medCardName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#064e3b',
    },
    medCardSalt: {
        fontSize: 12,
        color: '#64748b',
        fontStyle: 'italic',
        marginTop: 2,
    },
    medCardGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 10,
    },
    medCardGridItem: {
        width: '47%',
    },
    medCardGridLabel: {
        fontSize: 10,
        color: '#94a3b8',
        textTransform: 'uppercase',
        fontWeight: '700',
        marginBottom: 2,
    },
    medCardGridVal: {
        fontSize: 12.5,
        color: '#1e293b',
        fontWeight: '600',
    },
    lowStockText: {
        color: '#dc2626',
        fontWeight: '700',
    },
    goodStockText: {
        color: '#059669',
        fontWeight: '700',
    },
    lowStockBadge: {
        backgroundColor: '#fee2e2',
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    lowStockBadgeText: {
        color: '#dc2626',
        fontSize: 9,
        fontWeight: '800',
    },
    medCardActionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    medCardActionBtn: {
        flex: 1,
        minWidth: '47%',
        minHeight: 38,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    medCardActionText: {
        fontSize: 12,
        fontWeight: '700',
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
        fontWeight: '700',
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
        fontSize: 13,
    },
    medName: {
        color: '#064e3b',
        fontWeight: '600',
    },
    categoryTag: {
        backgroundColor: '#f0fdfa',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    categoryTagText: {
        color: '#0d9488',
        fontSize: 11,
        fontWeight: '600',
    },
    statusBadgeSmall: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusBadgeSmallText: {
        fontSize: 10,
        fontWeight: '700',
    },
    badgeInStock: {
        backgroundColor: '#dcfce7',
    },
    textInStock: {
        color: '#166534',
    },
    badgeLowStock: {
        backgroundColor: '#fef3c7',
    },
    textLowStock: {
        color: '#b45309',
    },
    badgeOutOfStock: {
        backgroundColor: '#fee2e2',
    },
    textOutOfStock: {
        color: '#dc2626',
    },
    lowStock: {
        color: '#ef4444',
        fontWeight: '700',
    },
    goodStock: {
        color: '#10b981',
        fontWeight: '700',
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
        width: '94%',
        maxWidth: 600,
        maxHeight: '88%',
        borderRadius: 20,
        padding: 16,
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
        paddingBottom: 12,
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#064e3b',
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    closeBtn: {
        fontSize: 24,
        color: '#64748b',
        padding: 4,
        marginTop: -4,
    },
    modalBody: {
        flex: 1,
    },
    formSection: {
        marginBottom: 16,
    },
    sectionTitle: {
        color: '#0d9488',
        fontSize: 13,
        textTransform: 'uppercase',
        borderBottomWidth: 2,
        borderBottomColor: '#f0fdfa',
        paddingBottom: 6,
        marginBottom: 12,
        fontWeight: '700',
    },
    formRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 12,
    },
    formGroup: {
        flex: 1,
        minWidth: 120,
        marginBottom: 8,
    },
    formLabel: {
        fontSize: 12,
        color: '#475569',
        marginBottom: 6,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    formInput: {
        width: '100%',
        minHeight: 46,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        fontSize: 14,
        color: '#000',
        backgroundColor: 'white',
    },
    pickerWrapper: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: 'white',
    },
    picker: {
        width: '100%',
        height: 44,
        color: '#000',
    },
    btnAddVendor: {
        backgroundColor: '#e0e7ff',
        borderWidth: 1,
        borderColor: '#c7d2fe',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    btnAddVendorText: {
        color: '#4338ca',
        fontSize: 16,
        fontWeight: 'bold',
    },
    formActionButtonsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 16,
    },
    modalActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    btnCancel: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 10,
    },
    btnCancelText: {
        color: '#64748b',
        fontWeight: '600',
        fontSize: 13,
    },
    btnSave: {
        backgroundColor: '#059669',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 10,
    },
    btnSaveText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 13,
    },
    
    /* Details Modal Styles */
    detailsBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 15,
        marginBottom: 16,
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
        fontWeight: '700',
    },
    detailsValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
        marginTop: 2,
    },
    stockProgressBarBg: {
        width: '100%',
        height: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        overflow: 'hidden',
        marginTop: 4,
    },
    stockProgressBarFill: {
        height: '100%',
        backgroundColor: '#3b82f6',
        borderRadius: 3,
    },
    detailsTableWrapper: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 16,
        backgroundColor: '#ffffff',
    },
    detailsTableHeadRow: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderBottomWidth: 1,
        borderBottomColor: '#cbd5e1',
        paddingVertical: 10,
        paddingHorizontal: 8,
    },
    detailsTableHead: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
        textTransform: 'uppercase',
    },
    detailsTableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 10,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    detailsTableRowSelected: {
        backgroundColor: '#fef9c3',
    },
    detailsTableCell: {
        fontSize: 12,
        color: '#1e293b',
    },
    financialSummaryCard: {
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
    },
    financialSummaryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 10,
    },
    financialMetricItem: {
        width: '47%',
        alignItems: 'center',
        paddingVertical: 4,
    },
    financialMetricLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        color: '#64748b',
    },
    financialMetricLabelEmerald: {
        color: '#065f46',
    },
    financialMetricValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0f172a',
        marginTop: 2,
    },
    financialMetricValueEmerald: {
        color: '#064e3b',
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

    /* Inline Form Card & Controls (Web 1:1 Parity) */
    pharmaFormCard: {
        backgroundColor: '#f8fafc',
        padding: 20,
        borderRadius: 12,
        marginTop: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    pharmaFormTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 16,
    },
    multiDoseBanner: {
        backgroundColor: '#f0f9ff',
        borderWidth: 1,
        borderColor: '#bae6fd',
        borderRadius: 8,
        padding: 14,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    multiDoseBannerActive: {
        backgroundColor: '#e0f2fe',
        borderColor: '#7dd3fc',
    },
    multiDoseText: {
        fontSize: 13.5,
        fontWeight: '600',
        color: '#0369a1',
        flex: 1,
    },
    btnCancelEdit: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 12,
        paddingHorizontal: 22,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    btnCancelEditText: {
        color: '#475569',
        fontWeight: '700',
        fontSize: 13.5,
    },
    btnSavePharma: {
        backgroundColor: '#059669',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 2,
    },
    btnSavePharmaText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 14,
    },
    btnClearForm: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 12,
        paddingHorizontal: 22,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    btnClearFormText: {
        color: '#64748b',
        fontWeight: '700',
        fontSize: 13.5,
    },
});

export default PharmacyInventory;
