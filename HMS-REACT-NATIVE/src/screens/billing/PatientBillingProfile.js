import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    Dimensions,
    Image,
    Modal,
    Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { billingAPI, admissionAPI, patientAPI, uploadAPI, hospitalAPI, receptionAPI } from '../../utils/api';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtDateTime = (dateVal, timeVal, fallbackCreatedAt) => {
    if (!dateVal && !fallbackCreatedAt) return '—';
    const baseDate = dateVal ? new Date(dateVal) : new Date(fallbackCreatedAt);
    const dStr = baseDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    if (timeVal && typeof timeVal === 'string' && timeVal.trim()) {
        return `${dStr}, ${timeVal.trim()}`;
    }
    const tStr = baseDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `${dStr}, ${tStr}`;
};

const getPharmacyTotal = (p) => {
    if (p.totalAmount && Number(p.totalAmount) > 0) return Number(p.totalAmount);
    if (!p.items || !p.items.length) return 0;
    return p.items.reduce((sum, item) => {
        const qty = parseInt(item.quantity) || parseInt(item.duration) || parseInt(item.days) || 1;
        return sum + (Number(item.price) || 50) * qty;
    }, 0);
};

const isPaid = (status) => status && status.toLowerCase() === 'paid';

const PatientBillingProfile = () => {
    const navigation = useNavigation();
    const route = useRoute();

    // Top view switcher: 'billing' or 'transactions'
    const [activeView, setActiveView] = useState(route.params?.view === 'transactions' ? 'transactions' : 'billing');

    // Search and data states
    const [searchQuery, setSearchQuery] = useState(route.params?.q || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [patient, setPatient] = useState(null);
    const [billing, setBilling] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');

    // Autocomplete suggestions
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchTimeoutRef = useRef(null);

    // Selected items for payment
    const [selected, setSelected] = useState({
        appointments: [],
        labReports: [],
        pharmacyOrders: [],
        facilityCharges: [],
        admissions: [],
        surgeryPlans: []
    });

    // Expandable pharmacy details
    const [expandedRows, setExpandedRows] = useState({});
    const toggleExpand = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

    // Payment collection state
    const [splitPayments, setSplitPayments] = useState([{ method: 'Cash', amount: '' }]);
    const [paymentData, setPaymentData] = useState({ upiId: '', transactionId: '', cardDetails: '', bankReference: '' });
    const [proofFile, setProofFile] = useState(null);
    const [paying, setPaying] = useState(false);
    const [dischargingId, setDischargingId] = useState(null);

    // UPI configurations
    const [upiOptions, setUpiOptions] = useState([]);

    // Transactions ledger state
    const [transactions, setTransactions] = useState([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [txnSearchQuery, setTxnSearchQuery] = useState('');

    // Proof viewer modal
    const [viewProofUrl, setViewProofUrl] = useState('');
    const [hospitalInfo, setHospitalInfo] = useState(null);
    const [selectedTxnForBill, setSelectedTxnForBill] = useState(null);
    const [downloadingBill, setDownloadingBill] = useState(false);

    // Load Hospital Information
    useEffect(() => {
        const fetchHospital = async () => {
            try {
                const res = await hospitalAPI.getMyHospital();
                if (res?.success && res.hospital) {
                    setHospitalInfo(res.hospital);
                }
            } catch (err) {
                console.warn('Failed to fetch hospital info:', err);
            }
        };
        fetchHospital();
    }, []);

    // Load Department UPI Options
    useEffect(() => {
        const fetchUpi = async () => {
            try {
                const deptRes = await hospitalAPI.getDepartmentUpiByRole('Billing');
                if (deptRes?.success && deptRes.departmentUpi) {
                    setUpiOptions([{ label: deptRes.departmentUpi.label, upiId: deptRes.departmentUpi.upiId }]);
                    return;
                }
            } catch (err) { }
            try {
                const recRes = await hospitalAPI.getDepartmentUpiByRole('Reception');
                if (recRes?.success && recRes.departmentUpi) {
                    setUpiOptions([{ label: recRes.departmentUpi.label, upiId: recRes.departmentUpi.upiId }]);
                    return;
                }
            } catch (err) { }
            try {
                const res = await hospitalAPI.getUpiIds();
                setUpiOptions(res?.upiIds || []);
            } catch (err) { }
        };
        fetchUpi();
    }, []);

    // Initial search if query passed
    useEffect(() => {
        if (searchQuery.trim() && activeView === 'billing') {
            loadPatientBilling(searchQuery.trim());
        }
    }, []);

    // Load transactions if view is transactions
    useEffect(() => {
        if (activeView === 'transactions') {
            fetchTransactions();
        }
    }, [activeView]);

    const fetchTransactions = async () => {
        setLoadingTransactions(true);
        try {
            const res = await receptionAPI.getTransactions();
            if (res?.success) {
                setTransactions(res.transactions || []);
            }
        } catch (err) {
            console.error('Failed to fetch transactions:', err);
        } finally {
            setLoadingTransactions(false);
        }
    };

    const loadPatientBilling = async (identifier) => {
        setLoading(true);
        setError('');
        setPatient(null);
        setBilling(null);
        setSelected({ appointments: [], labReports: [], pharmacyOrders: [], facilityCharges: [], admissions: [], surgeryPlans: [] });
        setSuccessMsg('');
        try {
            const res = await billingAPI.getPatientBills(identifier);
            if (res?.success) {
                setPatient(res.patient);
                setBilling(res.billing);
                // Pre-fill default split with 0
                setSplitPayments([{ method: 'Cash', amount: '' }]);
            } else {
                setError(res?.message || 'Patient not found');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Patient not found');
        } finally {
            setLoading(false);
        }
    };

    const handleQueryChange = (val) => {
        setSearchQuery(val);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(async () => {
            if (val.trim().length >= 2) {
                try {
                    const res = await patientAPI.search(val.trim());
                    if (res?.success) {
                        setSuggestions(res.data || []);
                        setShowSuggestions(true);
                    }
                } catch (err) {
                    setSuggestions([]);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);
    };

    const handleSearchSubmit = () => {
        if (!searchQuery.trim()) return;
        setShowSuggestions(false);
        loadPatientBilling(searchQuery.trim());
    };

    // Selection Handlers
    const toggle = (category, id) => {
        setSelected(prev => ({
            ...prev,
            [category]: prev[category].includes(id)
                ? prev[category].filter(x => x !== id)
                : [...prev[category], id]
        }));
    };

    const toggleAll = (category, items) => {
        const pendingIds = items.filter(x => !isPaid(x.paymentStatus)).map(x => x._id);
        setSelected(prev => {
            const allSelected = pendingIds.length > 0 && pendingIds.every(id => (prev[category] || []).includes(id));
            return { ...prev, [category]: allSelected ? [] : pendingIds };
        });
    };

    // Totals calculations
    const totalSelected = useCallback(() => {
        if (!billing) return 0;
        let total = 0;
        billing.appointments?.filter(a => selected.appointments?.includes(a._id)).forEach(a => total += (Number(a.amount) || 0));
        billing.labReports?.filter(l => selected.labReports?.includes(l._id)).forEach(l => total += (Number(l.amount || l.price) || 0));
        billing.pharmacyOrders?.filter(p => selected.pharmacyOrders?.includes(p._id)).forEach(p => total += getPharmacyTotal(p));
        billing.facilityCharges?.filter(f => selected.facilityCharges?.includes(f._id)).forEach(f => total += (Number(f.totalAmount) || 0));
        billing.admissions?.filter(a => selected.admissions?.includes(a._id)).forEach(a => total += (Number(a.totalAmount) || 0));
        billing.surgeryPlans?.filter(s => selected.surgeryPlans?.includes(s._id)).forEach(s => {
            const cost = Number(s.surgeryCost) || 0;
            const paid = Number(s.paidAmount) || 0;
            total += Math.max(0, cost - paid);
        });
        return total;
    }, [billing, selected]);

    const grandTotalBill = useCallback(() => {
        if (!billing) return 0;
        let total = 0;
        billing.appointments?.forEach(a => total += (Number(a.amount) || 0));
        billing.labReports?.forEach(l => total += (Number(l.amount || l.price) || 0));
        billing.pharmacyOrders?.forEach(p => total += getPharmacyTotal(p));
        billing.facilityCharges?.forEach(f => total += (Number(f.totalAmount) || 0));
        billing.admissions?.forEach(a => total += (Number(a.totalAmount) || 0));
        billing.surgeryPlans?.forEach(s => total += (Number(s.surgeryCost) || 0));
        return total;
    }, [billing]);

    const totalPaidBill = useCallback(() => {
        if (!billing) return 0;
        let modulePaid = 0;
        billing.appointments?.filter(a => isPaid(a.paymentStatus) || a.isPaid).forEach(a => modulePaid += (Number(a.amount) || 0));
        billing.labReports?.filter(l => isPaid(l.paymentStatus) || isPaid(l.status)).forEach(l => modulePaid += (Number(l.amount || l.price) || 0));
        billing.pharmacyOrders?.filter(p => isPaid(p.paymentStatus) || isPaid(p.status)).forEach(p => modulePaid += getPharmacyTotal(p));
        billing.facilityCharges?.filter(f => isPaid(f.paymentStatus)).forEach(f => modulePaid += (Number(f.totalAmount) || 0));
        billing.admissions?.filter(a => modulePaid += (Number(a.paidAmount) || (isPaid(a.paymentStatus) ? Number(a.totalAmount) : 0) || 0));
        billing.surgeryPlans?.forEach(s => modulePaid += (Number(s.paidAmount) || (s.paymentStatus === 'PAID' ? Number(s.surgeryCost) : 0) || 0));

        let historyPaid = 0;
        billing.paymentTransactions?.filter(p => isPaid(p.status || p.paymentStatus)).forEach(p => historyPaid += (Number(p.amount) || 0));
        return Math.max(modulePaid, historyPaid);
    }, [billing]);

    const pendingTotal = useCallback(() => Math.max(0, grandTotalBill() - totalPaidBill()), [grandTotalBill, totalPaidBill]);

    // Split Payments
    const handleSplitPaymentChange = (index, field, value) => {
        const newSplits = [...splitPayments];
        newSplits[index][field] = value;
        setSplitPayments(newSplits);
    };

    const addSplitPayment = () => setSplitPayments(prev => [...prev, { method: 'Cash', amount: '' }]);
    const removeSplitPayment = (index) => setSplitPayments(prev => prev.filter((_, i) => i !== index));

    const totalSplitAmount = useMemo(() => {
        return splitPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    }, [splitPayments]);

    // UPI QR parameters
    const hasUpi = splitPayments.some(sp => sp.method === 'UPI');
    const upiAmount = useMemo(() => {
        return splitPayments.filter(sp => sp.method === 'UPI').reduce((sum, curr) => sum + (Number(curr.amount) || 0), 0);
    }, [splitPayments]);
    const selectedUpiId = paymentData.upiId || upiOptions[0]?.upiId || '';
    const showUpiQr = hasUpi && upiAmount > 0 && selectedUpiId.length > 0;

    // Pick Proof File
    const handlePickProof = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf'],
                copyToCacheDirectory: true
            });
            if (!res.canceled && res.assets && res.assets.length > 0) {
                setProofFile(res.assets[0]);
            }
        } catch (err) {
            console.error('Proof picker error:', err);
        }
    };

    // Execute Payment
    const handleProcessPayment = async () => {
        const target = totalSelected();
        if (target <= 0) {
            Alert.alert('Selection Required', 'Please select at least one item to pay.');
            return;
        }

        if (totalSplitAmount !== target) {
            Alert.alert('Amount Mismatch', `Total split amount (${fmt(totalSplitAmount)}) must exactly match the selected amount (${fmt(target)}).`);
            return;
        }

        const hasNonCash = splitPayments.some(p => p.method !== 'Cash');
        if (hasNonCash && !proofFile) {
            Alert.alert('Proof Required', 'Please attach a payment proof (screenshot/receipt) for non-cash payments.');
            return;
        }

        setPaying(true);
        try {
            let proofUrl = '';
            let proofFileId = '';

            if (proofFile) {
                const formData = new FormData();
                if (proofFile.file) {
                    formData.append('images', proofFile.file);
                } else {
                    formData.append('images', {
                        uri: proofFile.uri,
                        name: proofFile.name || 'proof.jpg',
                        type: proofFile.mimeType || 'image/jpeg'
                    });
                }
                const uploadRes = await uploadAPI.uploadImages(formData);
                if (uploadRes?.success && uploadRes.files?.length > 0) {
                    proofUrl = uploadRes.files[0].url;
                    proofFileId = uploadRes.files[0].fileId;
                }
            }

            const res = await billingAPI.processPayment({
                appointmentIds: selected.appointments,
                labReportIds: selected.labReports,
                pharmacyOrderIds: selected.pharmacyOrders,
                facilityChargeIds: selected.facilityCharges,
                admissionIds: selected.admissions,
                surgeryPlanIds: selected.surgeryPlans,
                splitPayments,
                patientId: patient?._id,
                amount: target,
                transactionId: paymentData.transactionId,
                upiId: paymentData.upiId,
                cardDetails: paymentData.cardDetails,
                bankReference: paymentData.bankReference,
                proofUrl,
                proofFileId
            });

            if (res?.success) {
                Alert.alert('Payment Successful', `Payment of ${fmt(target)} has been successfully recorded.`);
                setSuccessMsg(`Payment of ${fmt(target)} processed successfully.`);
                // Reset states
                setSelected({ appointments: [], labReports: [], pharmacyOrders: [], facilityCharges: [], admissions: [], surgeryPlans: [] });
                setSplitPayments([{ method: 'Cash', amount: '' }]);
                setProofFile(null);
                setPaymentData({ upiId: '', transactionId: '', cardDetails: '', bankReference: '' });
                // Refresh billing
                loadPatientBilling(searchQuery.trim());
            } else {
                Alert.alert('Payment Failed', res?.message || 'Failed to process payment.');
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Payment processing failed.');
        } finally {
            setPaying(false);
        }
    };

    // Discharge Patient
    const handleDischargePatient = async (admissionId) => {
        Alert.alert(
            'Discharge Patient',
            'Are you sure you want to discharge this patient?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Discharge',
                    style: 'destructive',
                    onPress: async () => {
                        setDischargingId(admissionId);
                        try {
                            const res = await admissionAPI.dischargePatient(admissionId);
                            if (res?.success) {
                                Alert.alert('Discharged', 'Patient discharged successfully.');
                                loadPatientBilling(searchQuery.trim());
                            } else {
                                Alert.alert('Error', res?.message || 'Discharge failed.');
                            }
                        } catch (err) {
                            Alert.alert('Error', 'Failed to discharge patient.');
                        } finally {
                            setDischargingId(null);
                        }
                    }
                }
            ]
        );
    };

    // Universal PDF Print / Download Handler (Web + Native)
    const handleDownloadOrPrintPdf = async (html, title = 'Invoice') => {
        try {
            setDownloadingBill(true);
            if (Platform.OS === 'web') {
                await Print.printAsync({ html });
            } else {
                const { uri } = await Print.printToFileAsync({ html });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
                } else {
                    await Print.printAsync({ html });
                }
            }
        } catch (err) {
            console.error('PDF error:', err);
            Alert.alert('Error', 'Failed to generate PDF document.');
        } finally {
            setDownloadingBill(false);
        }
    };

    // Print / Download Consolidated Bill (Real Data Parity)
    const handlePrintConsolidatedBill = async () => {
        if (!patient || !billing) return;

        const hName = hospitalInfo?.name || 'Care Medical Hospital & Health Center';
        const hAddr = [hospitalInfo?.address, hospitalInfo?.city, hospitalInfo?.state].filter(Boolean).join(', ');
        const hPhone = hospitalInfo?.phone || '';
        const hEmail = hospitalInfo?.email || '';
        const hGst = hospitalInfo?.gstNo || hospitalInfo?.taxNumber || '';
        const pName = patient.name || 'Patient';
        const pMrn = patient.mrn || patient.patientId || 'N/A';
        const pPhone = patient.phone || '-';
        const pAgeGender = [patient.fertilityProfile?.age || patient.age ? `${patient.fertilityProfile?.age || patient.age} Yrs` : null, patient.gender].filter(Boolean).join(' / ') || '-';
        const invoiceNum = `INV-CONS-${(patient._id || '').slice(-6).toUpperCase()}-${new Date().getFullYear()}`;

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                <title>${invoiceNum} - Consolidated Bill</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #1e293b; background: #ffffff; line-height: 1.4; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 20px; }
                    .hospital-name { font-size: 24px; font-weight: 800; color: #0f766e; }
                    .hospital-sub { font-size: 11px; color: #64748b; margin-top: 3px; }
                    .invoice-title { font-size: 18px; font-weight: 800; text-align: right; color: #0f172a; text-transform: uppercase; }
                    .invoice-meta { font-size: 11px; color: #64748b; text-align: right; margin-top: 4px; }
                    .patient-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; }
                    .patient-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 12px; }
                    .patient-field { display: flex; }
                    .patient-field strong { color: #475569; width: 110px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
                    th { background: #0f766e; color: #ffffff; padding: 8px 10px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; }
                    td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
                    tr:nth-child(even) { background: #f8fafc; }
                    .status-paid { color: #16a34a; font-weight: bold; }
                    .status-pending { color: #d97706; font-weight: bold; }
                    .total-box { display: flex; justify-content: flex-end; margin-top: 20px; }
                    .total-table { width: 300px; font-size: 13px; }
                    .total-table td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
                    .grand-total { font-size: 16px; font-weight: 800; color: #0f766e; border-top: 2px solid #0f766e; }
                    .paid-row { color: #16a34a; font-weight: bold; }
                    .due-row { color: #dc2626; font-weight: bold; }
                    .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
                    .disclaimer { font-size: 10px; color: #94a3b8; margin-top: 6px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="hospital-name">${hName}</div>
                        ${hAddr ? `<div class="hospital-sub">${hAddr}</div>` : ''}
                        ${hPhone || hEmail ? `<div class="hospital-sub">${[hPhone && `Tel: ${hPhone}`, hEmail && `Email: ${hEmail}`].filter(Boolean).join(' | ')}</div>` : ''}
                        ${hGst ? `<div class="hospital-sub">GST / Tax ID: ${hGst}</div>` : ''}
                    </div>
                    <div>
                        <div class="invoice-title">CONSOLIDATED PATIENT INVOICE</div>
                        <div class="invoice-meta"><strong>Invoice No:</strong> ${invoiceNum}</div>
                        <div class="invoice-meta"><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        <div class="invoice-meta"><strong>Time:</strong> ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                </div>

                <div class="patient-card">
                    <div class="patient-grid">
                        <div class="patient-field"><strong>Patient Name:</strong> <span>${pName}</span></div>
                        <div class="patient-field"><strong>MRN / Patient ID:</strong> <span>${pMrn}</span></div>
                        <div class="patient-field"><strong>Phone Contact:</strong> <span>${pPhone}</span></div>
                        <div class="patient-field"><strong>Age / Gender:</strong> <span>${pAgeGender}</span></div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 35px;">#</th>
                            <th>Service Description & Itemization</th>
                            <th style="width: 110px;">Date</th>
                            <th style="width: 90px; text-align: center;">Status</th>
                            <th style="width: 100px; text-align: right;">Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(billing.appointments || []).map((a, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td><strong>Doctor Consultation</strong> — ${a.serviceName || 'OPD'} (Dr. ${a.doctorName || 'Consultant'})</td>
                                <td>${fmtDate(a.appointmentDate)}</td>
                                <td style="text-align: center;" class="${isPaid(a.paymentStatus) ? 'status-paid' : 'status-pending'}">${a.paymentStatus || 'Pending'}</td>
                                <td style="text-align: right; font-weight: 600;">₹${Number(a.amount || 0).toLocaleString('en-IN')}</td>
                            </tr>
                        `).join('')}
                        ${(billing.labReports || []).map((l, i) => `
                            <tr>
                                <td>${(billing.appointments?.length || 0) + i + 1}</td>
                                <td><strong>Laboratory Diagnostics</strong> — ${Array.isArray(l.testNames) ? l.testNames.join(', ') : (l.testName || 'Pathology')}</td>
                                <td>${fmtDate(l.createdAt)}</td>
                                <td style="text-align: center;" class="${isPaid(l.paymentStatus) ? 'status-paid' : 'status-pending'}">${l.paymentStatus || 'Pending'}</td>
                                <td style="text-align: right; font-weight: 600;">₹${Number(l.amount || l.price || 0).toLocaleString('en-IN')}</td>
                            </tr>
                        `).join('')}
                        ${(billing.pharmacyOrders || []).map((p, i) => `
                            <tr>
                                <td>${(billing.appointments?.length || 0) + (billing.labReports?.length || 0) + i + 1}</td>
                                <td><strong>Pharmacy Dispense</strong> (${p.items?.length || 0} prescription items)</td>
                                <td>${fmtDate(p.createdAt)}</td>
                                <td style="text-align: center;" class="${isPaid(p.paymentStatus) ? 'status-paid' : 'status-pending'}">${p.paymentStatus || 'Pending'}</td>
                                <td style="text-align: right; font-weight: 600;">₹${Number(getPharmacyTotal(p)).toLocaleString('en-IN')}</td>
                            </tr>
                        `).join('')}
                        ${(billing.facilityCharges || []).map((f, i) => `
                            <tr>
                                <td>${(billing.appointments?.length || 0) + (billing.labReports?.length || 0) + (billing.pharmacyOrders?.length || 0) + i + 1}</td>
                                <td><strong>Facility / ICU Services</strong> — ${f.facilityName} (${f.daysUsed || f.days || 1} day(s))</td>
                                <td>${fmtDate(f.createdAt)}</td>
                                <td style="text-align: center;" class="${isPaid(f.paymentStatus) ? 'status-paid' : 'status-pending'}">${f.paymentStatus || 'Pending'}</td>
                                <td style="text-align: right; font-weight: 600;">₹${Number(f.totalAmount || 0).toLocaleString('en-IN')}</td>
                            </tr>
                        `).join('')}
                        ${(billing.admissions || []).map((adm, i) => `
                            <tr>
                                <td>${(billing.appointments?.length || 0) + (billing.labReports?.length || 0) + (billing.pharmacyOrders?.length || 0) + (billing.facilityCharges?.length || 0) + i + 1}</td>
                                <td><strong>Inpatient Hospitalization</strong> (Ward: ${adm.ward || '-'}, Bed: ${adm.bedNumber || '-'})</td>
                                <td>${fmtDate(adm.admissionDate)}</td>
                                <td style="text-align: center;" class="${isPaid(adm.paymentStatus) ? 'status-paid' : 'status-pending'}">${adm.paymentStatus || 'Pending'}</td>
                                <td style="text-align: right; font-weight: 600;">₹${Number(adm.totalAmount || 0).toLocaleString('en-IN')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="total-box">
                    <table class="total-table">
                        <tr><td>Subtotal / Gross Bill:</td><td style="text-align: right;"><strong>${fmt(grandTotalBill())}</strong></td></tr>
                        <tr class="paid-row"><td>Total Paid:</td><td style="text-align: right;">${fmt(totalPaidBill())}</td></tr>
                        <tr class="due-row"><td>Net Balance Due:</td><td style="text-align: right;">${fmt(pendingTotal())}</td></tr>
                    </table>
                </div>

                <div class="footer">
                    <div>Thank you for choosing ${hName}.</div>
                    <div class="disclaimer">This is a computer-generated official billing document and requires no physical signature. Generated on ${new Date().toLocaleString('en-IN')}.</div>
                </div>
            </body>
            </html>
        `;

        await handleDownloadOrPrintPdf(html, invoiceNum);
    };

    // Download Single Transaction Bill / Receipt (Real Data Parity)
    const handleDownloadTransactionBill = async (pt) => {
        if (!pt) return;

        const hName = hospitalInfo?.name || 'Care Medical Hospital & Health Center';
        const hAddr = [hospitalInfo?.address, hospitalInfo?.city, hospitalInfo?.state].filter(Boolean).join(', ');
        const hPhone = hospitalInfo?.phone || '';
        const hEmail = hospitalInfo?.email || '';
        const hGst = hospitalInfo?.gstNo || hospitalInfo?.taxNumber || '';
        const pName = patient?.name || pt.userId?.name || 'Patient';
        const pMrn = patient?.mrn || patient?.patientId || pt.userId?.patientId || 'N/A';
        const pPhone = patient?.phone || pt.userId?.phone || '-';
        const invoiceNum = `INV-REC-${(pt.transactionId || pt._id || '').slice(-8).toUpperCase()}`;
        const isPaidStatus = isPaid(pt.paymentStatus || pt.status);
        const paymentMethod = pt.splitPayments?.length > 1
            ? pt.splitPayments.map(s => `${s.method}: ₹${s.amount}`).join(', ')
            : (pt.paymentMode || pt.method || 'Cash');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
                <title>${invoiceNum} - Receipt</title>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #1e293b; background: #ffffff; line-height: 1.5; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 20px; }
                    .hospital-name { font-size: 22px; font-weight: 800; color: #0f766e; }
                    .hospital-sub { font-size: 11px; color: #64748b; margin-top: 3px; }
                    .invoice-title { font-size: 18px; font-weight: 800; text-align: right; color: #0f172a; text-transform: uppercase; }
                    .invoice-meta { font-size: 11px; color: #64748b; text-align: right; margin-top: 3px; }
                    .badge-paid { display: inline-block; background: #dcfce7; color: #166534; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; }
                    .patient-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; }
                    .patient-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 12px; }
                    .patient-field { display: flex; }
                    .patient-field strong { color: #475569; width: 120px; }
                    .bill-details-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
                    .bill-details-table th { background: #0f766e; color: #ffffff; padding: 8px 12px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; }
                    .bill-details-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
                    .total-box { margin-top: 24px; padding: 16px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
                    .total-amount { font-size: 24px; font-weight: 800; color: #0f766e; }
                    .signatory-row { margin-top: 45px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 10px; }
                    .signatory-line { width: 180px; border-top: 1px solid #94a3b8; text-align: center; font-size: 11px; color: #64748b; padding-top: 4px; }
                    .footer { text-align: center; margin-top: 35px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 14px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="hospital-name">${hName}</div>
                        ${hAddr ? `<div class="hospital-sub">${hAddr}</div>` : ''}
                        ${hPhone || hEmail ? `<div class="hospital-sub">${[hPhone && `Tel: ${hPhone}`, hEmail && `Email: ${hEmail}`].filter(Boolean).join(' | ')}</div>` : ''}
                        ${hGst ? `<div class="hospital-sub">GST / Tax ID: ${hGst}</div>` : ''}
                    </div>
                    <div>
                        <div class="invoice-title">OFFICIAL PAYMENT RECEIPT</div>
                        <div class="invoice-meta"><strong>Receipt No:</strong> ${invoiceNum}</div>
                        <div class="invoice-meta"><strong>Date:</strong> ${fmtDate(pt.paymentDate || pt.createdAt)}</div>
                        <div class="invoice-meta" style="margin-top: 6px;"><span class="badge-paid">${isPaidStatus ? 'PAID ✓' : 'RECORDED'}</span></div>
                    </div>
                </div>

                <div class="patient-card">
                    <div class="patient-grid">
                        <div class="patient-field"><strong>Patient Name:</strong> <span>${pName}</span></div>
                        <div class="patient-field"><strong>MRN / ID:</strong> <span>${pMrn}</span></div>
                        <div class="patient-field"><strong>Phone Contact:</strong> <span>${pPhone}</span></div>
                        <div class="patient-field"><strong>Payment Method:</strong> <span>${paymentMethod}</span></div>
                        <div class="patient-field"><strong>Txn Reference / ID:</strong> <span>${pt.transactionId || pt.upiId || pt.bankReference || 'N/A'}</span></div>
                        <div class="patient-field"><strong>Status:</strong> <span style="color: #16a34a; font-weight: bold;">${pt.paymentStatus || 'Paid'}</span></div>
                    </div>
                </div>

                <table class="bill-details-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Description of Billed Item</th>
                            <th style="width: 120px; text-align: right;">Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>1</td>
                            <td>
                                <strong>${pt.description || 'Hospital Healthcare Settlement'}</strong>
                                ${pt.billedItems ? `<div style="font-size: 11px; color: #64748b; margin-top: 3px;">Includes itemized hospital charges cleared under transaction #${(pt._id || '').slice(-6)}</div>` : ''}
                            </td>
                            <td style="text-align: right; font-weight: bold;">${fmt(pt.amount)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="total-box">
                    <div>
                        <span style="font-size: 13px; font-weight: bold; color: #475569;">Total Amount Settled:</span>
                        <div style="font-size: 11px; color: #64748b;">Paid in full via ${paymentMethod}</div>
                    </div>
                    <span class="total-amount">${fmt(pt.amount)}</span>
                </div>

                <div class="signatory-row">
                    <div class="signatory-line">Billing Executive / Cashier</div>
                    <div class="signatory-line">Authorized Signatory</div>
                </div>

                <div class="footer">
                    <div>Thank you for choosing ${hName}.</div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">System generated bill receipt • ${new Date().toLocaleString('en-IN')}</div>
                </div>
            </body>
            </html>
        `;

        await handleDownloadOrPrintPdf(html, invoiceNum);
    };

    // Filtered Transactions for Transactions Ledger
    const filteredTransactions = useMemo(() => {
        if (!txnSearchQuery.trim()) return transactions;
        const q = txnSearchQuery.toLowerCase();
        return transactions.filter(t => {
            return String(t.userId?.name || '').toLowerCase().includes(q) ||
                   String(t.doctorName || '').toLowerCase().includes(q) ||
                   String(t.paymentMethod || '').toLowerCase().includes(q) ||
                   String(t.paymentStatus || '').toLowerCase().includes(q);
        });
    }, [transactions, txnSearchQuery]);

    const totalCollected = useMemo(() => transactions.reduce((sum, t) => sum + (t.amount || 0), 0), [transactions]);
    const totalTxnBills = transactions.length;
    const pendingTxnBills = useMemo(() => transactions.filter(t => (t.paymentStatus || '').toLowerCase() !== 'paid').length, [transactions]);

    const activeAdmissions = billing?.admissions?.filter(a => a.status === 'Admitted') || [];
    const pastAdmissions = billing?.admissions?.filter(a => a.status === 'Discharged') || [];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
            {/* 1. TOP HEADER WITH VIEW SWITCHER */}
            <View style={styles.billingHeader}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerTitleRow}>
                        <Text style={styles.headerTitleEmoji}>💳</Text>
                        <Text style={styles.headerTitle}>Patient Billing & Checkout</Text>
                    </View>
                    <Text style={styles.headerSubtitle}>Instant patient bill search, breakdown & multi-split payment settlement</Text>
                </View>

                {/* View Switcher Tabs */}
                <View style={styles.viewSwitcherGroup}>
                    <TouchableOpacity
                        style={[styles.viewSwitchBtn, activeView === 'billing' && styles.viewSwitchBtnActive]}
                        onPress={() => setActiveView('billing')}
                    >
                        <Feather name="credit-card" size={14} color={activeView === 'billing' ? '#0f766e' : '#ffffff'} />
                        <Text style={[styles.viewSwitchBtnText, activeView === 'billing' && styles.viewSwitchBtnTextActive]}>
                            Patient Billing
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.viewSwitchBtn, activeView === 'transactions' && styles.viewSwitchBtnActive]}
                        onPress={() => setActiveView('transactions')}
                    >
                        <Feather name="list" size={14} color={activeView === 'transactions' ? '#0f766e' : '#ffffff'} />
                        <Text style={[styles.viewSwitchBtnText, activeView === 'transactions' && styles.viewSwitchBtnTextActive]}>
                            Transactions ({transactions.length})
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* VIEW A: TRANSACTIONS LEDGER */}
            {activeView === 'transactions' ? (
                <View style={styles.transactionsViewContainer}>
                    {/* KPI Cards */}
                    <View style={styles.txnKpiGrid}>
                        <View style={[styles.txnKpiCard, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
                            <Text style={[styles.txnKpiTitle, { color: '#1e40af' }]}>Total Collected</Text>
                            <Text style={[styles.txnKpiValue, { color: '#1d4ed8' }]}>{fmt(totalCollected)}</Text>
                            <Text style={[styles.txnKpiSubtitle, { color: '#3b82f6' }]}>Lifetime collections</Text>
                        </View>
                        <View style={[styles.txnKpiCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                            <Text style={[styles.txnKpiTitle, { color: '#166534' }]}>Total Transactions</Text>
                            <Text style={[styles.txnKpiValue, { color: '#15803d' }]}>{totalTxnBills}</Text>
                            <Text style={[styles.txnKpiSubtitle, { color: '#22c55e' }]}>Total bills generated</Text>
                        </View>
                        <View style={[styles.txnKpiCard, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                            <Text style={[styles.txnKpiTitle, { color: '#991b1b' }]}>Pending Payments</Text>
                            <Text style={[styles.txnKpiValue, { color: '#b91c1c' }]}>{pendingTxnBills}</Text>
                            <Text style={[styles.txnKpiSubtitle, { color: '#ef4444' }]}>Requires attention</Text>
                        </View>
                    </View>

                    {/* Table Card */}
                    <View style={styles.txnTableCard}>
                        <View style={styles.txnTableHeaderRow}>
                            <Text style={styles.txnTableTitle}>Recent Billing Transactions</Text>
                            <View style={styles.txnSearchBox}>
                                <Feather name="search" size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                                <TextInput
                                    placeholder="Search by patient name..."
                                    placeholderTextColor="#94a3b8"
                                    value={txnSearchQuery}
                                    onChangeText={setTxnSearchQuery}
                                    style={styles.txnSearchInput}
                                />
                            </View>
                        </View>

                        {loadingTransactions ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#0f766e" />
                                <Text style={styles.loadingText}>Loading transaction ledger...</Text>
                            </View>
                        ) : filteredTransactions.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={{ fontSize: 36 }}>🧾</Text>
                                <Text style={styles.emptyTitle}>No Transactions Found</Text>
                                <Text style={styles.emptySubtitle}>There are no matching billing records to display.</Text>
                            </View>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                <View style={styles.tableWrapper}>
                                    <View style={styles.tableRowHeader}>
                                        <Text style={[styles.thCell, { width: 140 }]}>Date & Time</Text>
                                        <Text style={[styles.thCell, { width: 200 }]}>Patient Name</Text>
                                        <Text style={[styles.thCell, { width: 160 }]}>Doctor</Text>
                                        <Text style={[styles.thCell, { width: 140 }]}>Payment Method</Text>
                                        <Text style={[styles.thCell, { width: 110, textAlign: 'center' }]}>Status</Text>
                                        <Text style={[styles.thCell, { width: 120, textAlign: 'right' }]}>Amount</Text>
                                    </View>
                                    {filteredTransactions.map(t => (
                                        <View key={t._id} style={styles.tableRow}>
                                            <View style={[styles.tdCell, { width: 140 }]}>
                                                <Text style={styles.tdTextBold}>{fmtDate(t.createdAt)}</Text>
                                                <Text style={styles.tdTextSub}>{new Date(t.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                                            </View>
                                            <View style={[styles.tdCell, { width: 200 }]}>
                                                <Text style={styles.tdTextBold}>{t.userId?.name || 'Walk-in'}</Text>
                                                <Text style={styles.tdTextSub}>ID: {t.userId?.patientId || 'N/A'}</Text>
                                            </View>
                                            <View style={[styles.tdCell, { width: 160 }]}>
                                                <Text style={styles.tdTextRegular}>{t.doctorName || '-'}</Text>
                                            </View>
                                            <View style={[styles.tdCell, { width: 140 }]}>
                                                <View style={styles.paymentMethodPill}>
                                                    <Text style={styles.paymentMethodPillText}>{t.paymentMethod || 'Cash'}</Text>
                                                </View>
                                            </View>
                                            <View style={[styles.tdCell, { width: 110, alignItems: 'center' }]}>
                                                <View style={[styles.statusBadge, isPaid(t.paymentStatus) ? styles.statusBadgePaid : styles.statusBadgePending]}>
                                                    <Text style={[styles.statusBadgeText, isPaid(t.paymentStatus) ? { color: '#059669' } : { color: '#d97706' }]}>
                                                        {t.paymentStatus || 'Pending'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={[styles.tdCell, { width: 120, alignItems: 'flex-end' }]}>
                                                <Text style={styles.tdAmountText}>{fmt(t.amount)}</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            ) : (
                /* VIEW B: PATIENT BILLING & CHECKOUT */
                <View>
                    {/* Search Bar with Autocomplete Suggestions */}
                    <View style={styles.searchBarContainer}>
                        <View style={styles.searchBarBox}>
                            <Feather name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                            <TextInput
                                placeholder="Search by Phone / MRN / Patient ID..."
                                placeholderTextColor="#94a3b8"
                                value={searchQuery}
                                onChangeText={handleQueryChange}
                                style={styles.searchBarInput}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4, marginRight: 6 }}>
                                    <Feather name="x" size={16} color="#64748b" />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.searchSubmitBtn}
                                onPress={handleSearchSubmit}
                                disabled={loading}
                            >
                                <Text style={styles.searchSubmitBtnText}>{loading ? 'Searching...' : 'Search'}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Autocomplete suggestions dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                            <View style={styles.suggestionsDropdown}>
                                {suggestions.map(p => (
                                    <TouchableOpacity
                                        key={p._id}
                                        style={styles.suggestionItem}
                                        onPress={() => {
                                            setSearchQuery(p.mrn || p.patientId || p.phone || p.name);
                                            setShowSuggestions(false);
                                            loadPatientBilling(p.mrn || p.patientId || p.phone || p.name);
                                        }}
                                    >
                                        <Text style={styles.suggestionName}>{p.name}</Text>
                                        <Text style={styles.suggestionMeta}>
                                            MRN: {p.mrn || p.patientId || 'N/A'} • Phone: {p.phone || 'N/A'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Messages */}
                    {error.length > 0 && (
                        <View style={styles.errorAlert}>
                            <Feather name="alert-circle" size={16} color="#dc2626" style={{ marginRight: 8 }} />
                            <Text style={styles.errorAlertText}>{error}</Text>
                        </View>
                    )}
                    {successMsg.length > 0 && (
                        <View style={styles.successAlert}>
                            <Feather name="check-circle" size={16} color="#059669" style={{ marginRight: 8 }} />
                            <Text style={styles.successAlertText}>{successMsg}</Text>
                        </View>
                    )}

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#0f766e" />
                            <Text style={styles.loadingText}>Fetching consolidated patient bills...</Text>
                        </View>
                    ) : patient && billing && (
                        <View>
                            {/* Patient Info Card */}
                            <View style={styles.patientInfoCard}>
                                <View style={styles.patientAvatarBox}>
                                    <Text style={styles.patientAvatarLetter}>{patient.name?.charAt(0)?.toUpperCase() || 'P'}</Text>
                                </View>

                                <View style={styles.patientDetailsCol}>
                                    <Text style={styles.patientNameHeader}>{patient.name}</Text>
                                    <View style={styles.patientMetaRow}>
                                        <Text style={styles.patientMetaPill}>MRN: {patient.mrn || patient.patientId || '—'}</Text>
                                        <Text style={styles.patientMetaPill}>Phone: {patient.phone || '—'}</Text>
                                        {patient.gender && <Text style={styles.patientMetaPill}>Gender: {patient.gender}</Text>}
                                        {patient.dob && <Text style={styles.patientMetaPill}>DOB: {fmtDate(patient.dob)}</Text>}
                                    </View>
                                </View>

                                <View style={styles.patientTotalsCol}>
                                    <Text style={styles.totalsLabel}>Grand Total Bill</Text>
                                    <Text style={styles.totalsGrandAmount}>{fmt(grandTotalBill())}</Text>
                                    <View style={styles.totalsBreakdownRow}>
                                        <Text style={styles.totalsPaid}>Paid: {fmt(totalPaidBill())}</Text>
                                        <Text style={styles.totalsBalance}>Due: {fmt(pendingTotal())}</Text>
                                    </View>

                                    <TouchableOpacity style={styles.printBillBtn} onPress={handlePrintConsolidatedBill}>
                                        <Feather name="printer" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                                        <Text style={styles.printBillBtnText}>Print Consolidated Bill</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* 1. ACTIVE HOSPITALIZATION / ADMISSIONS */}
                            {activeAdmissions.length > 0 && (
                                <View style={[styles.sectionCard, { borderLeftColor: '#0f766e', borderLeftWidth: 4 }]}>
                                    <View style={styles.sectionHeader}>
                                        <View style={styles.sectionTitleRow}>
                                            <View style={[styles.badgePill, { backgroundColor: '#ccfbf1' }]}>
                                                <Text style={[styles.badgePillText, { color: '#0f766e' }]}>Currently Admitted</Text>
                                            </View>
                                            <Text style={styles.sectionTitle}>Active Hospitalization</Text>
                                        </View>
                                    </View>

                                    {activeAdmissions.map(adm => (
                                        <View key={adm._id} style={styles.admissionItemBox}>
                                            <View style={styles.admissionItemTop}>
                                                <View>
                                                    <Text style={styles.admissionTimeText}>
                                                        Admitted: {fmtDateTime(adm.admissionDate, adm.admissionTime, adm.createdAt)}
                                                    </Text>
                                                    <Text style={styles.admissionWardText}>
                                                        Ward: {adm.ward || 'General'} • Bed: {adm.bedNumber || 'Assigned'}
                                                    </Text>
                                                </View>

                                                <View style={styles.admissionActionRow}>
                                                    <TouchableOpacity
                                                        style={[styles.checkboxButton, selected.admissions.includes(adm._id) && styles.checkboxButtonActive]}
                                                        onPress={() => toggle('admissions', adm._id)}
                                                        disabled={isPaid(adm.paymentStatus)}
                                                    >
                                                        <Feather
                                                            name={isPaid(adm.paymentStatus) ? "check-circle" : (selected.admissions.includes(adm._id) ? "check-square" : "square")}
                                                            size={16}
                                                            color={isPaid(adm.paymentStatus) ? "#059669" : (selected.admissions.includes(adm._id) ? "#0f766e" : "#94a3b8")}
                                                        />
                                                        <Text style={styles.checkboxButtonText}>
                                                            {isPaid(adm.paymentStatus) ? 'Paid' : 'Mark to Pay'}
                                                        </Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        style={styles.dischargeBtn}
                                                        onPress={() => handleDischargePatient(adm._id)}
                                                        disabled={dischargingId === adm._id}
                                                    >
                                                        <Text style={styles.dischargeBtnText}>
                                                            {dischargingId === adm._id ? 'Discharging...' : 'Discharge'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {adm.selectedFacilities?.length > 0 && (
                                                <View style={styles.facilitiesSubTable}>
                                                    {adm.selectedFacilities.map((f, idx) => (
                                                        <View key={idx} style={styles.facilityRow}>
                                                            <Text style={styles.facilityName}>{f.facilityName} ({f.days}d @ {fmt(f.pricePerDay)}/d)</Text>
                                                            <Text style={styles.facilityAmount}>{fmt(f.totalAmount)}</Text>
                                                        </View>
                                                    ))}
                                                    <View style={styles.facilityTotalRow}>
                                                        <Text style={styles.facilityTotalLabel}>Admission Total:</Text>
                                                        <Text style={styles.facilityTotalVal}>{fmt(adm.totalAmount)}</Text>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* 2. SCHEDULED SURGERIES & OT PROCEDURES */}
                            {billing.surgeryPlans && billing.surgeryPlans.length > 0 && (
                                <View style={[styles.sectionCard, { borderLeftColor: '#7c3aed', borderLeftWidth: 4 }]}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionTitle}>🩺 Scheduled Surgeries & OT Procedures</Text>
                                        <TouchableOpacity onPress={() => toggleAll('surgeryPlans', billing.surgeryPlans)}>
                                            <Text style={styles.selectAllBtnText}>Toggle All</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {billing.surgeryPlans.map(s => {
                                        const cost = Number(s.surgeryCost) || 0;
                                        const paid = Number(s.paidAmount) || 0;
                                        const remaining = Math.max(0, cost - paid);
                                        const isSurgeryPaid = s.paymentStatus === 'PAID';

                                        return (
                                            <View key={s._id} style={styles.billingItemRow}>
                                                <TouchableOpacity
                                                    onPress={() => !isSurgeryPaid && toggle('surgeryPlans', s._id)}
                                                    disabled={isSurgeryPaid}
                                                    style={{ marginRight: 10 }}
                                                >
                                                    <Feather
                                                        name={isSurgeryPaid ? "check-circle" : (selected.surgeryPlans.includes(s._id) ? "check-square" : "square")}
                                                        size={18}
                                                        color={isSurgeryPaid ? "#059669" : (selected.surgeryPlans.includes(s._id) ? "#7c3aed" : "#94a3b8")}
                                                    />
                                                </TouchableOpacity>

                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.itemTitle}>{s.surgery}</Text>
                                                    <Text style={styles.itemSubtitle}>
                                                        Op: Dr. {s.surgeonId?.name || 'Surgeon'} • Room: {s.otRoomId?.name || 'OT'} • {fmtDate(s.surgeryDate)}
                                                    </Text>
                                                </View>

                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.itemAmount}>{fmt(cost)}</Text>
                                                    <View style={[styles.statusBadge, isSurgeryPaid ? styles.statusBadgePaid : styles.statusBadgePending]}>
                                                        <Text style={[styles.statusBadgeText, isSurgeryPaid ? { color: '#059669' } : { color: '#d97706' }]}>
                                                            {s.paymentStatus || 'Pending'}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* 3. CONSULTATIONS & APPOINTMENTS */}
                            {billing.appointments && billing.appointments.length > 0 && (
                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionTitle}>Appointments & Consultations ({billing.appointments.length})</Text>
                                        <TouchableOpacity onPress={() => toggleAll('appointments', billing.appointments)}>
                                            <Text style={styles.selectAllBtnText}>Toggle All</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {billing.appointments.map(a => {
                                        const isApptPaid = isPaid(a.paymentStatus);
                                        return (
                                            <View key={a._id} style={styles.billingItemRow}>
                                                <TouchableOpacity
                                                    onPress={() => !isApptPaid && toggle('appointments', a._id)}
                                                    disabled={isApptPaid}
                                                    style={{ marginRight: 10 }}
                                                >
                                                    <Feather
                                                        name={isApptPaid ? "check-circle" : (selected.appointments.includes(a._id) ? "check-square" : "square")}
                                                        size={18}
                                                        color={isApptPaid ? "#059669" : (selected.appointments.includes(a._id) ? "#2563eb" : "#94a3b8")}
                                                    />
                                                </TouchableOpacity>

                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.itemTitle}>Consultation - {a.serviceName || 'OPD'}</Text>
                                                    <Text style={styles.itemSubtitle}>
                                                        Dr. {a.doctorName || a.doctorId?.name || 'Assigned'} • {fmtDate(a.appointmentDate)} {a.appointmentTime || ''}
                                                    </Text>
                                                </View>

                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.itemAmount}>{fmt(a.amount)}</Text>
                                                    <View style={[styles.statusBadge, isApptPaid ? styles.statusBadgePaid : styles.statusBadgePending]}>
                                                        <Text style={[styles.statusBadgeText, isApptPaid ? { color: '#059669' } : { color: '#d97706' }]}>
                                                            {a.paymentStatus || 'Pending'}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* 4. LAB TESTS */}
                            {billing.labReports && billing.labReports.length > 0 && (
                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionTitle}>Lab Tests & Diagnostics ({billing.labReports.length})</Text>
                                        <TouchableOpacity onPress={() => toggleAll('labReports', billing.labReports)}>
                                            <Text style={styles.selectAllBtnText}>Toggle All</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {billing.labReports.map(l => {
                                        const isLabPaid = isPaid(l.paymentStatus);
                                        return (
                                            <View key={l._id} style={styles.billingItemRow}>
                                                <TouchableOpacity
                                                    onPress={() => !isLabPaid && toggle('labReports', l._id)}
                                                    disabled={isLabPaid}
                                                    style={{ marginRight: 10 }}
                                                >
                                                    <Feather
                                                        name={isLabPaid ? "check-circle" : (selected.labReports.includes(l._id) ? "check-square" : "square")}
                                                        size={18}
                                                        color={isLabPaid ? "#059669" : (selected.labReports.includes(l._id) ? "#2563eb" : "#94a3b8")}
                                                    />
                                                </TouchableOpacity>

                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.itemTitle}>
                                                        {Array.isArray(l.testNames) ? l.testNames.join(', ') : (l.testName || 'Diagnostics Test')}
                                                    </Text>
                                                    <Text style={styles.itemSubtitle}>{fmtDate(l.createdAt)}</Text>
                                                </View>

                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.itemAmount}>{fmt(l.amount || l.price)}</Text>
                                                    <View style={[styles.statusBadge, isLabPaid ? styles.statusBadgePaid : styles.statusBadgePending]}>
                                                        <Text style={[styles.statusBadgeText, isLabPaid ? { color: '#059669' } : { color: '#d97706' }]}>
                                                            {l.paymentStatus || 'Pending'}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* 5. PHARMACY ORDERS */}
                            {billing.pharmacyOrders && billing.pharmacyOrders.length > 0 && (
                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionTitle}>Pharmacy Orders ({billing.pharmacyOrders.length})</Text>
                                        <TouchableOpacity onPress={() => toggleAll('pharmacyOrders', billing.pharmacyOrders)}>
                                            <Text style={styles.selectAllBtnText}>Toggle All</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {billing.pharmacyOrders.map(p => {
                                        const isPharmPaid = isPaid(p.paymentStatus);
                                        const pTotal = getPharmacyTotal(p);
                                        const isExpanded = !!expandedRows[p._id];

                                        return (
                                            <View key={p._id} style={{ borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 10 }}>
                                                <View style={styles.billingItemRow}>
                                                    <TouchableOpacity
                                                        onPress={() => !isPharmPaid && toggle('pharmacyOrders', p._id)}
                                                        disabled={isPharmPaid}
                                                        style={{ marginRight: 10 }}
                                                    >
                                                        <Feather
                                                            name={isPharmPaid ? "check-circle" : (selected.pharmacyOrders.includes(p._id) ? "check-square" : "square")}
                                                            size={18}
                                                            color={isPharmPaid ? "#059669" : (selected.pharmacyOrders.includes(p._id) ? "#2563eb" : "#94a3b8")}
                                                        />
                                                    </TouchableOpacity>

                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.itemTitle}>Prescription ({p.items?.length || 0} items)</Text>
                                                        <Text style={styles.itemSubtitle}>{fmtDate(p.createdAt)}</Text>
                                                        <TouchableOpacity onPress={() => toggleExpand(p._id)}>
                                                            <Text style={styles.expandDetailsLink}>
                                                                {isExpanded ? 'Hide Medicines ▲' : 'View Medicines ▼'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </View>

                                                    <View style={{ alignItems: 'flex-end' }}>
                                                        <Text style={styles.itemAmount}>{fmt(pTotal)}</Text>
                                                        <View style={[styles.statusBadge, isPharmPaid ? styles.statusBadgePaid : styles.statusBadgePending]}>
                                                            <Text style={[styles.statusBadgeText, isPharmPaid ? { color: '#059669' } : { color: '#d97706' }]}>
                                                                {p.paymentStatus || 'Pending'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>

                                                {/* Expanded details */}
                                                {isExpanded && Array.isArray(p.items) && (
                                                    <View style={styles.expandedPharmacyBox}>
                                                        {p.items.map((item, idx) => {
                                                            const name = item.medicineName || item.name;
                                                            const qty = parseInt(item.quantity) || parseInt(item.duration) || parseInt(item.days) || 1;
                                                            const cost = (Number(item.price) || 50) * qty;
                                                            return (
                                                                <View key={idx} style={styles.medicineDetailRow}>
                                                                    <Text style={styles.medicineName}>• {name} {item.frequency ? `(${item.frequency})` : ''}</Text>
                                                                    <Text style={styles.medicineQty}>Qty: {qty}</Text>
                                                                    <Text style={styles.medicineCost}>{fmt(cost)}</Text>
                                                                </View>
                                                            );
                                                        })}
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* 6. ICU / FACILITY CHARGES */}
                            {billing.facilityCharges && billing.facilityCharges.length > 0 && (
                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionTitle}>ICU & Facility Charges ({billing.facilityCharges.length})</Text>
                                        <TouchableOpacity onPress={() => toggleAll('facilityCharges', billing.facilityCharges)}>
                                            <Text style={styles.selectAllBtnText}>Toggle All</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {billing.facilityCharges.map(f => {
                                        const isFacilityPaid = isPaid(f.paymentStatus);
                                        return (
                                            <View key={f._id} style={styles.billingItemRow}>
                                                <TouchableOpacity
                                                    onPress={() => !isFacilityPaid && toggle('facilityCharges', f._id)}
                                                    disabled={isFacilityPaid}
                                                    style={{ marginRight: 10 }}
                                                >
                                                    <Feather
                                                        name={isFacilityPaid ? "check-circle" : (selected.facilityCharges.includes(f._id) ? "check-square" : "square")}
                                                        size={18}
                                                        color={isFacilityPaid ? "#059669" : (selected.facilityCharges.includes(f._id) ? "#2563eb" : "#94a3b8")}
                                                    />
                                                </TouchableOpacity>

                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.itemTitle}>{f.facilityName}</Text>
                                                    <Text style={styles.itemSubtitle}>
                                                        {f.daysUsed || f.days || 1} Days @ {fmt(f.pricePerDay)}/day • {fmtDate(f.createdAt)}
                                                    </Text>
                                                </View>

                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.itemAmount}>{fmt(f.totalAmount)}</Text>
                                                    <View style={[styles.statusBadge, isFacilityPaid ? styles.statusBadgePaid : styles.statusBadgePending]}>
                                                        <Text style={[styles.statusBadgeText, isFacilityPaid ? { color: '#059669' } : { color: '#d97706' }]}>
                                                            {f.paymentStatus || 'Pending'}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* 7. PAYMENT SETTLEMENT & SPLIT PAYMENT BUILDER */}
                            {pendingTotal() > 0 && (
                                <View style={styles.paymentPanelCard}>
                                    <View style={styles.paymentSummaryHeader}>
                                        <View>
                                            <Text style={styles.paymentPanelTitle}>Collect & Settle Payment</Text>
                                            <Text style={styles.paymentPanelSubtitle}>Select payment methods & split amounts</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.selectedTargetAmount}>{fmt(totalSelected())}</Text>
                                            <Text style={styles.selectedTargetLabel}>Selected to Settle</Text>
                                        </View>
                                    </View>

                                    {/* Split rows */}
                                    <View style={styles.splitPaymentsSection}>
                                        {splitPayments.map((split, index) => (
                                            <View key={index} style={styles.splitRowCard}>
                                                <View style={styles.splitRowControls}>
                                                    {/* Method selector buttons */}
                                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                                            {['Cash', 'UPI', 'Card', 'Cheque', 'NEFT/RTGS'].map(m => (
                                                                <TouchableOpacity
                                                                    key={m}
                                                                    style={[styles.methodChip, split.method === m && styles.methodChipActive]}
                                                                    onPress={() => handleSplitPaymentChange(index, 'method', m)}
                                                                >
                                                                    <Text style={[styles.methodChipText, split.method === m && styles.methodChipTextActive]}>
                                                                        {m}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                        </View>
                                                    </ScrollView>

                                                    <TextInput
                                                        placeholder="Amount"
                                                        keyboardType="numeric"
                                                        value={String(split.amount)}
                                                        onChangeText={v => handleSplitPaymentChange(index, 'amount', v)}
                                                        style={styles.splitAmountInput}
                                                    />

                                                    {splitPayments.length > 1 && (
                                                        <TouchableOpacity onPress={() => removeSplitPayment(index)} style={styles.removeSplitBtn}>
                                                            <Feather name="x" size={16} color="#dc2626" />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>

                                                {/* Method Specific Inputs */}
                                                {split.method === 'UPI' && (
                                                    <View style={styles.methodExtraInputsRow}>
                                                        {upiOptions.length > 0 ? (
                                                            <View style={styles.upiDropdownWrapper}>
                                                                <Text style={styles.inputMiniLabel}>Select UPI Account:</Text>
                                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                                    <View style={{ flexDirection: 'row', gap: 6, marginVertical: 4 }}>
                                                                        {upiOptions.map((u, i) => (
                                                                            <TouchableOpacity
                                                                                key={i}
                                                                                style={[styles.upiOptChip, (paymentData.upiId === u.upiId || (!paymentData.upiId && i === 0)) && styles.upiOptChipActive]}
                                                                                onPress={() => setPaymentData({ ...paymentData, upiId: u.upiId })}
                                                                            >
                                                                                <Text style={[styles.upiOptChipText, (paymentData.upiId === u.upiId || (!paymentData.upiId && i === 0)) && styles.upiOptChipTextActive]}>
                                                                                    {u.label} ({u.upiId})
                                                                                </Text>
                                                                            </TouchableOpacity>
                                                                        ))}
                                                                    </View>
                                                                </ScrollView>
                                                            </View>
                                                        ) : (
                                                            <Text style={styles.noUpiWarning}>⚠️ No UPI ID registered for this department.</Text>
                                                        )}

                                                        <TextInput
                                                            placeholder="UPI Txn Reference (UTR)"
                                                            placeholderTextColor="#94a3b8"
                                                            value={paymentData.transactionId}
                                                            onChangeText={v => setPaymentData({ ...paymentData, transactionId: v })}
                                                            style={styles.extraInputField}
                                                        />
                                                    </View>
                                                )}

                                                {split.method === 'Card' && (
                                                    <View style={styles.methodExtraInputsRow}>
                                                        <TextInput
                                                            placeholder="Card Last 4 Digits"
                                                            placeholderTextColor="#94a3b8"
                                                            keyboardType="numeric"
                                                            maxLength={4}
                                                            value={paymentData.cardDetails}
                                                            onChangeText={v => setPaymentData({ ...paymentData, cardDetails: v })}
                                                            style={[styles.extraInputField, { flex: 1 }]}
                                                        />
                                                        <TextInput
                                                            placeholder="Txn Auth Reference"
                                                            placeholderTextColor="#94a3b8"
                                                            value={paymentData.transactionId}
                                                            onChangeText={v => setPaymentData({ ...paymentData, transactionId: v })}
                                                            style={[styles.extraInputField, { flex: 1 }]}
                                                        />
                                                    </View>
                                                )}

                                                {['Cheque', 'NEFT/RTGS'].includes(split.method) && (
                                                    <View style={styles.methodExtraInputsRow}>
                                                        <TextInput
                                                            placeholder="Bank Reference / Cheque No"
                                                            placeholderTextColor="#94a3b8"
                                                            value={paymentData.bankReference}
                                                            onChangeText={v => setPaymentData({ ...paymentData, bankReference: v })}
                                                            style={styles.extraInputField}
                                                        />
                                                    </View>
                                                )}
                                            </View>
                                        ))}

                                        {/* Split Total & Controls */}
                                        <View style={styles.splitControlsRow}>
                                            <TouchableOpacity style={styles.addSplitBtn} onPress={addSplitPayment}>
                                                <Feather name="plus" size={14} color="#0f766e" style={{ marginRight: 4 }} />
                                                <Text style={styles.addSplitBtnText}>Add Payment Split</Text>
                                            </TouchableOpacity>

                                            <Text style={[
                                                styles.splitValidationText,
                                                totalSplitAmount === totalSelected() && totalSelected() > 0 ? { color: '#16a34a' } : { color: '#dc2626' }
                                            ]}>
                                                Split Total: {fmt(totalSplitAmount)} / {fmt(totalSelected())}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Proof upload for non-cash */}
                                    {splitPayments.some(s => s.method !== 'Cash') && (
                                        <View style={styles.proofUploadBox}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.proofUploadLabel}>Payment Proof (Required for non-cash)</Text>
                                                <Text style={styles.proofUploadSubtext}>
                                                    {proofFile ? proofFile.name : 'Attach screenshot or receipt file (PDF / Image)'}
                                                </Text>
                                            </View>
                                            <TouchableOpacity style={styles.proofPickBtn} onPress={handlePickProof}>
                                                <Feather name="upload" size={14} color="#0f766e" style={{ marginRight: 4 }} />
                                                <Text style={styles.proofPickBtnText}>{proofFile ? 'Change' : 'Select Proof'}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {/* UPI QR Display */}
                                    {showUpiQr && (
                                        <View style={styles.upiQrBox}>
                                            <Text style={styles.upiQrTitle}>Scan to Pay {fmt(upiAmount)}</Text>
                                            <Image
                                                source={{
                                                    uri: `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`upi://pay?pa=${selectedUpiId.trim()}&pn=CITMedical365&am=${upiAmount}&cu=INR`)}`
                                                }}
                                                style={styles.upiQrImage}
                                            />
                                            <Text style={styles.upiQrSubtext}>UPI ID: {selectedUpiId}</Text>
                                        </View>
                                    )}

                                    {/* Settle / Pay Button */}
                                    <TouchableOpacity
                                        style={[
                                            styles.paySubmitBtn,
                                            (paying || totalSelected() === 0 || totalSplitAmount !== totalSelected()) && { opacity: 0.6 }
                                        ]}
                                        onPress={handleProcessPayment}
                                        disabled={paying || totalSelected() === 0 || totalSplitAmount !== totalSelected()}
                                    >
                                        {paying ? (
                                            <ActivityIndicator size="small" color="#ffffff" />
                                        ) : (
                                            <>
                                                <Feather name="check" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                                                <Text style={styles.paySubmitBtnText}>
                                                    Process & Settle {fmt(totalSelected())}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* 8. PAYMENT HISTORY TABLE */}
                            <View style={[styles.sectionCard, { marginTop: 20 }]}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>Payment & Receipt History</Text>
                                </View>

                                {(!billing.paymentTransactions || billing.paymentTransactions.length === 0) ? (
                                    <Text style={styles.emptyHistoryText}>No past payments recorded for this patient.</Text>
                                ) : (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                        <View style={styles.tableWrapper}>
                                            <View style={styles.tableRowHeader}>
                                                <Text style={[styles.thCell, { width: 120 }]}>Date</Text>
                                                <Text style={[styles.thCell, { width: 140 }]}>Mode / Split</Text>
                                                <Text style={[styles.thCell, { width: 140 }]}>Txn ID / Ref</Text>
                                                <Text style={[styles.thCell, { width: 170 }]}>Description</Text>
                                                <Text style={[styles.thCell, { width: 110, textAlign: 'right' }]}>Amount</Text>
                                                <Text style={[styles.thCell, { width: 90, textAlign: 'center' }]}>Status</Text>
                                                <Text style={[styles.thCell, { width: 60, textAlign: 'center' }]}>View</Text>
                                                <Text style={[styles.thCell, { width: 110, textAlign: 'center' }]}>Download</Text>
                                            </View>
                                            {billing.paymentTransactions.map(pt => (
                                                <View key={pt._id} style={styles.tableRow}>
                                                    <View style={[styles.tdCell, { width: 120 }]}>
                                                        <Text style={styles.tdTextBold}>{fmtDate(pt.paymentDate || pt.createdAt)}</Text>
                                                    </View>
                                                    <View style={[styles.tdCell, { width: 140 }]}>
                                                        <Text style={styles.tdTextBold}>
                                                            {pt.splitPayments?.length > 1
                                                                ? pt.splitPayments.map(sp => sp.method).join(' + ')
                                                                : (pt.paymentMode || pt.method || 'Cash')}
                                                        </Text>
                                                    </View>
                                                    <View style={[styles.tdCell, { width: 140 }]}>
                                                        <Text style={styles.tdTextSub}>{pt.transactionId || pt.upiId || pt.bankReference || '—'}</Text>
                                                    </View>
                                                    <View style={[styles.tdCell, { width: 170 }]}>
                                                        <Text style={styles.tdTextRegular}>{pt.description || 'General Settlement'}</Text>
                                                    </View>
                                                    <View style={[styles.tdCell, { width: 110, alignItems: 'flex-end' }]}>
                                                        <Text style={styles.tdAmountText}>{fmt(pt.amount)}</Text>
                                                    </View>
                                                    <View style={[styles.tdCell, { width: 90, alignItems: 'center' }]}>
                                                        <View style={[styles.statusBadge, isPaid(pt.paymentStatus || pt.status) ? styles.statusBadgePaid : styles.statusBadgePending]}>
                                                            <Text style={[styles.statusBadgeText, isPaid(pt.paymentStatus || pt.status) ? { color: '#059669' } : { color: '#d97706' }]}>
                                                                {pt.paymentStatus || pt.status || 'Paid'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <View style={[styles.tdCell, { width: 60, alignItems: 'center', justifyContent: 'center' }]}>
                                                        <TouchableOpacity
                                                            onPress={() => setSelectedTxnForBill(pt)}
                                                            style={{ padding: 6, borderRadius: 6, backgroundColor: '#eff6ff' }}
                                                            title="View Bill Details"
                                                            activeOpacity={0.7}
                                                        >
                                                            <Feather name="eye" size={15} color="#2563eb" />
                                                        </TouchableOpacity>
                                                    </View>
                                                    <View style={[styles.tdCell, { width: 110, alignItems: 'center', justifyContent: 'center' }]}>
                                                        <TouchableOpacity
                                                            onPress={() => handleDownloadTransactionBill(pt)}
                                                            disabled={downloadingBill}
                                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 6, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' }}
                                                            title="Download Bill PDF"
                                                            activeOpacity={0.7}
                                                        >
                                                            <Feather name="download" size={13} color="#059669" />
                                                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669' }}>Download</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    </ScrollView>
                                )}
                            </View>
                        </View>
                    )}
                </View>
            )}

            {/* Bill Details Modal — 1:1 Preview & Action Parity */}
            {selectedTxnForBill && (
                <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setSelectedTxnForBill(null)}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <View style={{ width: '100%', maxWidth: 540, backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 }}>
                            {/* Modal Header */}
                            <View style={{ backgroundColor: '#0f766e', padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <Feather name="file-text" size={20} color="#ffffff" />
                                    <View>
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#ffffff' }}>Bill & Invoice Details</Text>
                                        <Text style={{ fontSize: 11, color: '#ccfbf1', marginTop: 1 }}>
                                            Receipt #{((selectedTxnForBill.transactionId || selectedTxnForBill._id || '').slice(-8)).toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setSelectedTxnForBill(null)} style={{ padding: 6, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' }}>
                                    <Feather name="x" size={18} color="#ffffff" />
                                </TouchableOpacity>
                            </View>

                            {/* Modal Body */}
                            <View style={{ padding: 20 }}>
                                {/* Hospital & Patient Info */}
                                <View style={{ backgroundColor: '#f8fafc', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0f766e', marginBottom: 4 }}>
                                        {hospitalInfo?.name || 'Care Medical Hospital'}
                                    </Text>
                                    <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                                        {[hospitalInfo?.address, hospitalInfo?.city].filter(Boolean).join(', ')}
                                    </Text>
                                    <View style={{ height: 1, backgroundColor: '#e2e8f0', marginVertical: 6 }} />
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                        <Text style={{ fontSize: 12, color: '#334155' }}>
                                            <Text style={{ fontWeight: '700' }}>Patient: </Text>{patient?.name || 'Patient'}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#64748b' }}>
                                            MRN: {patient?.mrn || patient?.patientId || 'N/A'}
                                        </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                                        <Text style={{ fontSize: 12, color: '#334155' }}>
                                            <Text style={{ fontWeight: '700' }}>Date: </Text>{fmtDate(selectedTxnForBill.paymentDate || selectedTxnForBill.createdAt)}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#059669', fontWeight: '700' }}>
                                            Status: {selectedTxnForBill.paymentStatus || 'PAID'}
                                        </Text>
                                    </View>
                                </View>

                                {/* Service Item Details */}
                                <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                                    <View style={{ backgroundColor: '#f1f5f9', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Description</Text>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Amount</Text>
                                    </View>
                                    <View style={{ paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flex: 1, paddingRight: 10 }}>
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b' }}>
                                                {selectedTxnForBill.description || 'Hospital Healthcare Consultation & Services'}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                                Payment Method: {selectedTxnForBill.paymentMode || selectedTxnForBill.method || 'Cash'}
                                                {selectedTxnForBill.transactionId ? ` (Ref: ${selectedTxnForBill.transactionId})` : ''}
                                            </Text>
                                        </View>
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f766e' }}>
                                            {fmt(selectedTxnForBill.amount)}
                                        </Text>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                                    <TouchableOpacity
                                        style={{ flex: 1, backgroundColor: '#0f766e', borderRadius: 8, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                                        onPress={() => handleDownloadTransactionBill(selectedTxnForBill)}
                                        disabled={downloadingBill}
                                    >
                                        {downloadingBill ? (
                                            <ActivityIndicator size="small" color="#ffffff" />
                                        ) : (
                                            <>
                                                <Feather name="download" size={16} color="#ffffff" />
                                                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 13 }}>Download Bill (PDF)</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={{ flex: 1, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                                        onPress={() => handleDownloadTransactionBill(selectedTxnForBill)}
                                    >
                                        <Feather name="printer" size={16} color="#2563eb" />
                                        <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 13 }}>Print Bill</Text>
                                    </TouchableOpacity>
                                </View>

                                {selectedTxnForBill.proofUrl && (
                                    <TouchableOpacity
                                        style={{ marginTop: 10, paddingVertical: 10, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}
                                        onPress={() => setViewProofUrl(selectedTxnForBill.proofUrl)}
                                    >
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#6366f1' }}>📎 View Attached Proof Screenshot</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 60,
    },

    // Header
    billingHeader: {
        backgroundColor: '#0f766e',
        borderRadius: 16,
        padding: 22,
        flexDirection: width > 768 ? 'row' : 'column',
        justifyContent: 'space-between',
        alignItems: width > 768 ? 'center' : 'flex-start',
        gap: 16,
        marginBottom: 20,
        elevation: 3,
        shadowColor: '#0f766e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    headerLeft: {
        flex: 1,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerTitleEmoji: {
        fontSize: 24,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#ccfbf1',
        marginTop: 4,
    },
    viewSwitcherGroup: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 10,
        padding: 4,
        gap: 6,
    },
    viewSwitchBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
        gap: 6,
    },
    viewSwitchBtnActive: {
        backgroundColor: '#ffffff',
    },
    viewSwitchBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    viewSwitchBtnTextActive: {
        color: '#0f766e',
    },

    // Search Bar
    searchBarContainer: {
        position: 'relative',
        marginBottom: 20,
        zIndex: 100,
    },
    searchBarBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 6,
        elevation: 1,
    },
    searchBarInput: {
        flex: 1,
        fontSize: 14,
        color: '#1e293b',
        paddingVertical: 8,
    },
    searchSubmitBtn: {
        backgroundColor: '#0f766e',
        paddingVertical: 9,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    searchSubmitBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
    suggestionsDropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        marginTop: 4,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        maxHeight: 220,
    },
    suggestionItem: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    suggestionName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
    },
    suggestionMeta: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },

    // Patient Info Card
    patientInfoCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 20,
        flexDirection: width > 768 ? 'row' : 'column',
        alignItems: width > 768 ? 'center' : 'flex-start',
        gap: 16,
        marginBottom: 20,
        elevation: 2,
    },
    patientAvatarBox: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#0f766e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    patientAvatarLetter: {
        fontSize: 24,
        fontWeight: '800',
        color: '#ffffff',
    },
    patientDetailsCol: {
        flex: 1,
    },
    patientNameHeader: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
    },
    patientMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 6,
    },
    patientMetaPill: {
        fontSize: 12,
        color: '#475569',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        fontWeight: '600',
    },
    patientTotalsCol: {
        alignItems: width > 768 ? 'flex-end' : 'flex-start',
        borderLeftWidth: width > 768 ? 1 : 0,
        borderLeftColor: '#f1f5f9',
        paddingLeft: width > 768 ? 16 : 0,
        minWidth: 200,
    },
    totalsLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    totalsGrandAmount: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0f766e',
        marginVertical: 2,
    },
    totalsBreakdownRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 8,
    },
    totalsPaid: {
        fontSize: 12,
        fontWeight: '700',
        color: '#16a34a',
    },
    totalsBalance: {
        fontSize: 12,
        fontWeight: '700',
        color: '#dc2626',
    },
    printBillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2563eb',
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    printBillBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },

    // Section Cards
    sectionCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
        marginBottom: 16,
        elevation: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1e293b',
    },
    badgePill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    badgePillText: {
        fontSize: 11,
        fontWeight: '800',
    },
    selectAllBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f766e',
    },
    billingItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
    },
    itemTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
    },
    itemSubtitle: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    itemAmount: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
    },
    expandDetailsLink: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0f766e',
        marginTop: 4,
    },
    expandedPharmacyBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    medicineDetailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 3,
    },
    medicineName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
        flex: 1,
    },
    medicineQty: {
        fontSize: 12,
        color: '#64748b',
        marginHorizontal: 8,
    },
    medicineCost: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f766e',
    },

    // Admission Special
    admissionItemBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    admissionItemTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
    },
    admissionTimeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
    },
    admissionWardText: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    admissionActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    checkboxButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        gap: 6,
    },
    checkboxButtonActive: {
        borderColor: '#0f766e',
        backgroundColor: '#f0fdfa',
    },
    checkboxButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
    },
    dischargeBtn: {
        backgroundColor: '#fee2e2',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    dischargeBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#dc2626',
    },
    facilitiesSubTable: {
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 8,
    },
    facilityRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 3,
    },
    facilityName: {
        fontSize: 12,
        color: '#475569',
    },
    facilityAmount: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1e293b',
    },
    facilityTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 4,
    },
    facilityTotalLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f766e',
    },
    facilityTotalVal: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0f766e',
    },

    // Payment Panel Card
    paymentPanelCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#0f766e',
        padding: 20,
        marginTop: 10,
        elevation: 4,
        shadowColor: '#0f766e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    paymentSummaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        marginBottom: 16,
    },
    paymentPanelTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0f172a',
    },
    paymentPanelSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    selectedTargetAmount: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f766e',
    },
    selectedTargetLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
    },
    splitPaymentsSection: {
        gap: 12,
    },
    splitRowCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
    },
    splitRowControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    methodChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    methodChipActive: {
        borderColor: '#0f766e',
        backgroundColor: '#ccfbf1',
    },
    methodChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    methodChipTextActive: {
        color: '#0f766e',
        fontWeight: '700',
    },
    splitAmountInput: {
        width: 100,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 13,
        fontWeight: '700',
        color: '#1e293b',
    },
    removeSplitBtn: {
        padding: 6,
        backgroundColor: '#fee2e2',
        borderRadius: 6,
    },
    methodExtraInputsRow: {
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        gap: 8,
    },
    upiDropdownWrapper: {
        marginBottom: 4,
    },
    inputMiniLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    upiOptChip: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    upiOptChipActive: {
        borderColor: '#0f766e',
        backgroundColor: '#f0fdfa',
    },
    upiOptChipText: {
        fontSize: 11,
        color: '#475569',
    },
    upiOptChipTextActive: {
        color: '#0f766e',
        fontWeight: '700',
    },
    noUpiWarning: {
        fontSize: 12,
        color: '#b45309',
        backgroundColor: '#fef3c7',
        padding: 8,
        borderRadius: 6,
    },
    extraInputField: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 7,
        fontSize: 12,
        color: '#1e293b',
    },
    splitControlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    addSplitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ccfbf1',
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 6,
    },
    addSplitBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f766e',
    },
    splitValidationText: {
        fontSize: 13,
        fontWeight: '800',
    },
    proofUploadBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdfa',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#0f766e',
        borderRadius: 10,
        padding: 12,
        marginTop: 14,
        gap: 10,
    },
    proofUploadLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f766e',
    },
    proofUploadSubtext: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    proofPickBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#0f766e',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    proofPickBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f766e',
    },
    upiQrBox: {
        alignItems: 'center',
        backgroundColor: '#f0fdfa',
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#0d9488',
        padding: 16,
        marginTop: 14,
        gap: 8,
    },
    upiQrTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f766e',
    },
    upiQrImage: {
        width: 150,
        height: 150,
        borderRadius: 8,
    },
    upiQrSubtext: {
        fontSize: 11,
        color: '#64748b',
    },
    paySubmitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f766e',
        borderRadius: 10,
        paddingVertical: 12,
        marginTop: 16,
    },
    paySubmitBtnText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#ffffff',
    },

    // Transactions View
    transactionsViewContainer: {
        gap: 16,
    },
    txnKpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },
    txnKpiCard: {
        flex: 1,
        minWidth: 200,
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
    },
    txnKpiTitle: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 6,
    },
    txnKpiValue: {
        fontSize: 24,
        fontWeight: '800',
    },
    txnKpiSubtitle: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
    },
    txnTableCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
    },
    txnTableHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    txnTableTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
    },
    txnSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        width: 240,
    },
    txnSearchInput: {
        flex: 1,
        paddingVertical: 6,
        fontSize: 13,
        color: '#1e293b',
    },

    // Shared Table Styles
    tableWrapper: {
        minWidth: 850,
    },
    tableRowHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1.5,
        borderBottomColor: '#e2e8f0',
        paddingVertical: 10,
        borderRadius: 6,
    },
    thCell: {
        paddingHorizontal: 8,
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    tdCell: {
        paddingHorizontal: 8,
        justifyContent: 'center',
    },
    tdTextBold: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
    },
    tdTextRegular: {
        fontSize: 12,
        color: '#334155',
    },
    tdTextSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1,
    },
    tdAmountText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0f766e',
    },
    paymentMethodPill: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    paymentMethodPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    statusBadgePaid: {
        backgroundColor: '#ecfdf5',
    },
    statusBadgePending: {
        backgroundColor: '#fffbeb',
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },

    // Status / Messages
    errorAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    errorAlertText: {
        fontSize: 13,
        color: '#b91c1c',
        fontWeight: '600',
    },
    successAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    successAlertText: {
        fontSize: 13,
        color: '#065f46',
        fontWeight: '600',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 8,
    },
    loadingText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '600',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        gap: 6,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
    },
    emptySubtitle: {
        fontSize: 12,
        color: '#64748b',
    },
    emptyHistoryText: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
        padding: 14,
        textAlign: 'center',
    },
});

export default PatientBillingProfile;
