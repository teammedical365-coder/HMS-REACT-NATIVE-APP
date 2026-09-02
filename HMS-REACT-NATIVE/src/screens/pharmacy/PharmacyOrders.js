import React, { useState, useEffect, useMemo } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, ScrollView, 
    StyleSheet, ActivityIndicator, Alert, Dimensions, Modal, Platform 
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { pharmacyOrderAPI, hospitalAPI } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Native PDF and printing normally requires expo-print and expo-sharing. 
// We will stub the generateReceipt print logic as requested, keeping the data calculations intact.

const { width } = Dimensions.get('window');
const backendUrl = 'https://hms-7ojp.onrender.com'; // Using the production fallback for RN since localhost differs on emulator

const PharmacyOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [checkedItems, setCheckedItems] = useState({});
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    // External Data
    const [inventory, setInventory] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [hospitalInfo, setHospitalInfo] = useState({});
    const [dashboardStats, setDashboardStats] = useState({ todayCollection: 0, overallCollection: 0, pendingCollection: 0, doctorGuaranteedAmount: 0 });
    const [billingSettings, setBillingSettings] = useState({ gstin: '', dlNumber: '' });

    // Modals
    const [showBillModal, setShowBillModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentFlowOrder, setPaymentFlowOrder] = useState(null);
    const [paymentSource, setPaymentSource] = useState('Patient'); // 'Patient' | 'Doctor'
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [authorizedByDoctor, setAuthorizedByDoctor] = useState('');
    const [authorizationNote, setAuthorizationNote] = useState('');
    const [discountPercent, setDiscountPercent] = useState('0');

    // Walk-in Billing
    const [showWalkInModal, setShowWalkInModal] = useState(false);
    const [walkInForm, setWalkInForm] = useState({
        patientName: '',
        patientPhone: '',
        doctorName: '',
        items: [],
        discountPercent: '0',
        subtotal: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        totalAmount: 0,
        discountAmount: 0,
        grandTotal: 0,
        paymentMode: 'CASH'
    });
    const [walkInSearch, setWalkInSearch] = useState('');
    const [walkInSaving, setWalkInSaving] = useState(false);

    useEffect(() => {
        fetchOrders();
        fetchInventory();
        fetchHospital();
        fetchDashboardStats();
        fetchDoctors();
    }, []);

    const fetchInventory = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${backendUrl}/api/pharmacy/inventory`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`API returned status: ${res.status}`);
            const data = await res.json();
            if (data.success) {
                const inventoryData = data.medicines || data.inventory || data.items || data.data || data || [];
                setInventory(Array.isArray(inventoryData) ? inventoryData : []);
            }
        } catch (error) {
            console.error("Failed to load inventory", error);
        }
    };

    const fetchDoctors = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${backendUrl}/api/doctor`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`API returned status: ${res.status}`);
            const data = await res.json();
            if (data.success) setDoctors(data.doctors || data.data || []);
        } catch (error) {
            console.error("Failed to load doctors", error);
        }
    };

    const fetchDashboardStats = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${backendUrl}/api/pharmacy/orders/dashboard-summary`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`API returned status: ${res.status}`);
            const data = await res.json();
            if (data.success) setDashboardStats(data.data);
        } catch (error) {
            console.error("Failed to load dashboard stats", error);
        }
    };

    const fetchHospital = async () => {
        try {
            const res = await hospitalAPI.getMyHospital();
            if (res.success && res.hospital) {
                setHospitalInfo({
                    name: res.hospital.name,
                    address: res.hospital.address,
                    phone: res.hospital.phone,
                    email: res.hospital.email,
                    logoUrl: res.hospital.logo || res.hospital.branding?.logoUrl,
                    gstin: res.hospital.gstin,
                    dlNumber: res.hospital.dlNumber
                });
                setBillingSettings({
                    gstin: res.hospital.gstin || '',
                    dlNumber: res.hospital.dlNumber || ''
                });
            }
        } catch (error) {
            console.warn("Failed to load hospital info. Using default layout.", error.message);
            setHospitalInfo({ name: 'Aryan Hospital', address: 'Hospital Address', phone: '0000000000' });
        }
    };

    const handleUpdateBillingSettings = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${backendUrl}/api/pharmacy/hospital-billing`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(billingSettings)
            });
            const data = await res.json();
            if (data.success) {
                Alert.alert("Success", "Pharmacy Billing Details updated successfully!");
                fetchHospital();
            } else {
                Alert.alert("Error", data.message || "Failed to update billing details");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Error updating billing details");
        }
    };

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const res = await pharmacyOrderAPI.getOrders();
            if (res.success) setOrders(res.orders);
        } catch (err) {
            console.error("Failed to fetch pharmacy orders", err);
        } finally {
            setLoading(false);
        }
    };

    const handleWalkInSubmit = async () => {
        if (walkInForm.items.length === 0) return Alert.alert("Error", "Add at least one item.");
        setWalkInSaving(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${backendUrl}/api/pharmacy/orders/outside-patient-bill`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    patientName: walkInForm.patientName,
                    patientPhone: walkInForm.patientPhone,
                    doctorName: walkInForm.doctorName,
                    items: walkInForm.items,
                    totalAmount: walkInForm.subtotal,
                    taxableAmount: walkInForm.subtotal,
                    cgstAmount: walkInForm.cgstAmount,
                    sgstAmount: walkInForm.sgstAmount,
                    discountAmount: walkInForm.discountAmount,
                    paymentMode: walkInForm.paymentMode
                })
            });
            const data = await res.json();
            if (data.success) {
                setShowWalkInModal(false);
                fetchOrders();
                fetchInventory();
                setWalkInForm({
                    patientName: '', patientPhone: '', doctorName: '', items: [], discountPercent: '0',
                    subtotal: 0, cgstAmount: 0, sgstAmount: 0, totalAmount: 0, discountAmount: 0, grandTotal: 0, paymentMode: 'CASH'
                });
                Alert.alert('Success', 'Walk-in Bill generated successfully!');
                
                setSelectedOrder(data.order);
                setShowBillModal(true);
            } else {
                Alert.alert('Error', data.message || 'Failed to generate bill');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Error generating walk-in bill');
        } finally {
            setWalkInSaving(false);
        }
    };

    const isChecked = (orderId, idx) => {
        if (!checkedItems[orderId]) return true;
        if (checkedItems[orderId][idx] === undefined) return true;
        return checkedItems[orderId][idx];
    };

    const toggleCheck = (orderId, idx) => {
        setCheckedItems(prev => {
            const current = (prev[orderId] && prev[orderId][idx] !== undefined) ? prev[orderId][idx] : true;
            return {
                ...prev,
                [orderId]: {
                    ...(prev[orderId] || {}),
                    [idx]: !current
                }
            };
        });
    };

    const parseDuration = (durationString) => {
        if (!durationString) return 1;
        const str = String(durationString).toLowerCase();
        const match = str.match(/(\d+)/);
        const num = match ? parseInt(match[1], 10) : 1;
        if (str.includes('week')) return num * 7;
        if (str.includes('month')) return num * 30;
        return num;
    };

    const formatFrequencyText = (freq) => {
        if (!freq) return '1/day';
        const map = {
            '1-0-0': '1 Morning', '0-1-0': '1 Afternoon', '0-0-1': '1 Night',
            '1-0-1': '2/day (M,N)', '1-1-1': '3/day', '1-1-1-1': '4/day',
            'SOS': 'As needed', 'STAT': 'Immediately',
            'TDS': '3 times/day', 'BD': '2 times/day', 'OD': '1 time/day', 'QID': '4 times/day'
        };
        return map[freq.toUpperCase()] || freq;
    };

    const calculateTotalQty = (item) => {
        const freq = item.frequency || '';
        const dur = item.duration || item.days || item.durationDays || '';

        const days = dur ? parseDuration(dur) : 1;
        let timesPerDay = 1;

        const fUpper = freq.toUpperCase();
        if (item.frequencyCount) {
            timesPerDay = Number(item.frequencyCount);
        } else if (fUpper.includes('-')) {
            timesPerDay = fUpper.split('-').reduce((sum, val) => sum + (val === '1' ? 1 : (parseInt(val) || 0)), 0);
        } else if (fUpper.includes('TDS') || fUpper.includes('TID')) {
            timesPerDay = 3;
        } else if (fUpper.includes('BD') || fUpper.includes('BID')) {
            timesPerDay = 2;
        } else if (fUpper.includes('QID')) {
            timesPerDay = 4;
        } else if (fUpper === 'SOS' || fUpper === 'STAT') {
            timesPerDay = 1;
        } else {
            const match = freq.match(/(\d+)/);
            if (match) timesPerDay = parseInt(match[1], 10);
        }

        return timesPerDay * days;
    };

    const getInvoiceCalculations = (order, appliedDiscountPercent = null) => {
        const items = order?.prescribedItems || order?.items || [];
        let totalSubtotal = 0;
        let processedItemsTemp = [];

        const tempItems = items.map((item) => {
            const rawName = String(item.medicineName || item.name || '').toLowerCase();
            const isLiquidOrInj = rawName.includes('injection') || rawName.includes('inj') || rawName.includes('syrup') || rawName.includes('ceftriaxone');

            const itemDose = Number(item.dosePerAdmin || item.doseAdmin || item.dose || item.qtyPerDose || 1);
            const itemDays = Number(item.days || item.duration || item.numberOfDays || 1);
            const fStr = String(item.frequency || item.schedule || item.timing || item.sched || '').toUpperCase();

            let itemFreqPerDay = 1;
            if (fStr.includes('TDS') || fStr.includes('3')) itemFreqPerDay = 3;
            else if (fStr.includes('BD') || fStr.includes('BID') || fStr.includes('2')) itemFreqPerDay = 2;
            else if (fStr.includes('QID') || fStr.includes('4')) itemFreqPerDay = 4;

            let finalQty = Number(item.qty || item.quantity || item.totalReqd || 0);
            if (finalQty === 0) {
                if (itemDose > 0 && itemDays > 0) {
                    finalQty = itemDose * itemFreqPerDay * itemDays;
                } else {
                    finalQty = isLiquidOrInj ? 36 : 9;
                }
            }

            const invMatch = (inventory || []).find(inv => {
                if (!inv || !inv.name) return false;
                const invName = inv.name.trim().toLowerCase();
                return (item.inventoryId && (inv._id === item.inventoryId || inv.id === item.inventoryId)) ||
                       (item.medicineId && (inv._id === item.medicineId || inv.id === item.medicineId)) ||
                       invName === rawName || rawName.includes(invName) || invName.includes(rawName);
            });

            let sellingPrice = invMatch ? Number(invMatch.sellingPrice || invMatch.price || 0) : Number(item.sellingPrice || item.price || item.unitRate || 0);
            let buyingPrice = invMatch ? Number(invMatch.buyingPrice || invMatch.costPrice || 0) : Number(item.buyingPrice || item.costPrice || 0);
            
            const unit = (invMatch ? (invMatch.unit || '') : (item.unit || '')).toLowerCase();
            const unitsPerStrip = invMatch ? Number(invMatch.unitsPerStrip) : 1; 
            const volumePerUnit = invMatch ? (Number(invMatch.volumePerUnit) || Number(invMatch.packVolume)) : 1; 

            if (sellingPrice === 0) {
                sellingPrice = isLiquidOrInj ? 120 : 15;
            }
            if (buyingPrice === 0) {
                buyingPrice = sellingPrice * 0.7;
            }
            
            if (!invMatch && !isLiquidOrInj && sellingPrice >= 120) {
                sellingPrice = 15;
                buyingPrice = 10;
            }

            let billedQty = finalQty;
            let displayUnit = unit || 'units';

            if (['strip', 'strips'].includes(unit) || (!isLiquidOrInj && unitsPerStrip > 1)) {
                const packCapacity = unitsPerStrip > 1 ? unitsPerStrip : 10;
                billedQty = Math.ceil(finalQty / packCapacity);
                displayUnit = 'strip(s)';
            } else if (['capsule', 'capsules', 'tablet', 'tablets', 'tabs'].includes(unit)) {
                if (unitsPerStrip > 1) {
                    billedQty = Math.ceil(finalQty / unitsPerStrip);
                    displayUnit = 'strip(s)';
                } else {
                    billedQty = finalQty;
                    displayUnit = 'tabs';
                }
            } else if (['syrup', 'injection', 'vial', 'drops', 'vials'].includes(unit) || isLiquidOrInj) {
                const fallbackVolume = rawName.includes('syrup') ? 100 : 10;
                const packCapacity = volumePerUnit > 1 ? volumePerUnit : fallbackVolume;
                billedQty = Math.ceil(finalQty / packCapacity);
                displayUnit = (unit === 'syrup' || rawName.includes('syrup')) ? 'bottle(s)' : 'vial(s)';
            } else {
                billedQty = finalQty;
                displayUnit = unit || 'units';
            }

            let packagingBreakdown = `${billedQty} ${displayUnit}`;
            const unitLabel = unit || 'units';
            const effectiveRate = sellingPrice;

            const itemBase = billedQty * sellingPrice; 
            const itemCostBase = billedQty * buyingPrice;
            const gstPercent = Number(item.gst || item.gstPercent || 12);
            
            totalSubtotal += itemBase;
            processedItemsTemp.push(item);

            const freqText = itemFreqPerDay === 3 ? 'TDS (3 times/day)' : itemFreqPerDay === 2 ? 'BD (2 times/day)' : 'OD (Once daily)';

            return {
                ...item,
                qtyDisplay: `${item.totalDosageRequired || finalQty} ${unitLabel}`,
                packagingBreakdown,
                dose: itemDose,
                freqText,
                durationDays: itemDays,
                unitRate: effectiveRate,
                unitLabel,
                finalQty,
                itemBase,
                itemCostBase,
                gstPercent,
                isLiquidOrInj
            };
        });

        const pct = appliedDiscountPercent !== null ? Number(appliedDiscountPercent) : Number(order?.discountPercent || order?.discountPercentage || 0);
        let finalDiscountAmount = 0;
        if (pct > 0) {
            finalDiscountAmount = (totalSubtotal * pct) / 100;
        } else {
            finalDiscountAmount = Number(order?.discountAmount || order?.discount || order?.discountValue || 0);
        }

        const discountRatio = totalSubtotal > 0 ? (finalDiscountAmount / totalSubtotal) : 0;

        let totalTax = 0;
        const finalizedItems = tempItems.map(item => {
            const discountedCostBase = item.itemCostBase * (1 - discountRatio);
            const itemTax = discountedCostBase * (item.gstPercent / 100);
            const itemTotal = item.itemBase; 
            totalTax += itemTax;
            
            return {
                ...item,
                itemTax,
                itemTotal
            };
        });

        const grandTotal = Math.max(0, totalSubtotal - finalDiscountAmount);
        const halfTax = totalTax / 2;

        return {
            processedItems: finalizedItems,
            subtotal: totalSubtotal.toFixed(2),
            cgst: halfTax.toFixed(2),
            sgst: halfTax.toFixed(2),
            totalTax: totalTax.toFixed(2),
            discountPercent: pct,
            discountAmount: finalDiscountAmount.toFixed(2),
            grandTotal: grandTotal.toFixed(2)
        };
    };

    const calculatedStats = useMemo(() => {
        let todayCollection = 0;
        let todayCash = 0;
        let todayOnline = 0;
        let overallCollection = 0;
        let overallCash = 0;
        let overallOnline = 0;
        let pendingCollection = 0;
        let doctorGuaranteedAmount = 0;

        const todayIST = new Date().toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" });

        (orders || []).forEach(order => {
            let amount = parseFloat(order.totalAmount || order.grandTotal) || 0;
            if (amount === 0 && (order.items?.length > 0 || order.prescribedItems?.length > 0)) {
                const calcs = getInvoiceCalculations(order);
                amount = Number(calcs.grandTotal) || 0;
            }

            const oStatus = (order.orderStatus || '').toLowerCase();
            const pStatus = (order.paymentStatus || '').toLowerCase();

            if (oStatus === 'completed') {
                if (pStatus === 'paid') {
                    overallCollection += amount;
                    
                    let modeStr = (order.paymentMode || 'cash').toLowerCase().trim();
                    let isCash = true;
                    if (['upi', 'online', 'card', 'net_banking', 'net banking', 'netbanking'].includes(modeStr)) {
                        isCash = false;
                    }
                    
                    if (isCash) overallCash += amount;
                    else overallOnline += amount;

                    const orderDateStr = order.updatedAt || order.createdAt || new Date();
                    const orderDate = new Date(orderDateStr).toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" });
                    if (orderDate === todayIST) {
                        todayCollection += amount;
                        if (isCash) todayCash += amount;
                        else todayOnline += amount;
                    }
                } else if (pStatus === 'paid_by_doctor' || order.paymentMode === 'DOCTOR_AUTHORIZATION') {
                    pendingCollection += amount;
                    doctorGuaranteedAmount += amount;
                } else {
                    pendingCollection += amount;
                }
            }
        });

        return {
            todayCollection, todayCash, todayOnline,
            overallCollection, overallCash, overallOnline,
            pendingCollection, doctorGuaranteedAmount
        };
    }, [orders]);

    const openPaymentModal = (order) => {
        setPaymentFlowOrder(order);
        setPaymentSource('Patient');
        setPaymentMode('CASH');
        setAuthorizedByDoctor('');
        setAuthorizationNote('');
        setDiscountPercent(String(order.discountPercent || 0));
        setShowPaymentModal(true);
    };

    const handleCompleteOrder = async (orderId, payloadObj = null, totalItems = 100) => {
        try {
            const purchasedIndices = Array.from({ length: totalItems }, (_, i) => i);
            const payload = payloadObj || { purchasedIndices };

            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${backendUrl}/api/pharmacy/orders/${orderId}/complete`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                Alert.alert("Success", "Order completed!");
                setOrders(prev => prev.map(o => o._id === orderId ? { ...o, paymentStatus: payload.paymentStatus || 'Paid', paymentMode: payload.paymentMode, status: 'COMPLETED', orderStatus: 'Completed' } : o));
                fetchDashboardStats();
            } else {
                Alert.alert("Error", data.message || "Failed to update order");
            }
        } catch (err) {
            Alert.alert("Error", "Failed to update order.");
        }
    };

    const isLargeScreen = width > 768;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Header Section */}
            <View style={[styles.header, !isLargeScreen && { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <View>
                    <Text style={styles.headerTitle}>Pharmacy Orders</Text>
                    <Text style={styles.headerSubtitle}>Process prescriptions sent by doctors and confirm payments.</Text>
                </View>
                <TouchableOpacity 
                    style={[styles.btnAction, { backgroundColor: '#10b981', marginTop: isLargeScreen ? 0 : 10 }]}
                    onPress={() => setShowWalkInModal(true)}
                >
                    <Text style={styles.btnActionText}>+ Outside Patient Bill</Text>
                </TouchableOpacity>
            </View>

            {/* KPI Grid */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                <View style={styles.kpiGrid}>
                    <View style={[styles.kpiCard, { borderLeftColor: '#10b981' }]}>
                        <Text style={styles.kpiTitle}>Today's Collection</Text>
                        <Text style={styles.kpiValue}>₹{(Number(calculatedStats?.todayCollection) || 0).toFixed(2)}</Text>
                        <Text style={[styles.kpiSubtitle, { color: '#059669' }]}>Cash: ₹{(Number(calculatedStats?.todayCash) || 0).toFixed(2)} | Online: ₹{(Number(calculatedStats?.todayOnline) || 0).toFixed(2)}</Text>
                    </View>
                    <View style={[styles.kpiCard, { borderLeftColor: '#3b82f6' }]}>
                        <Text style={styles.kpiTitle}>Overall Collection</Text>
                        <Text style={styles.kpiValue}>₹{(Number(calculatedStats?.overallCollection) || 0).toFixed(2)}</Text>
                        <Text style={[styles.kpiSubtitle, { color: '#2563eb' }]}>Cash: ₹{(Number(calculatedStats?.overallCash) || 0).toFixed(2)} | Online: ₹{(Number(calculatedStats?.overallOnline) || 0).toFixed(2)}</Text>
                    </View>
                    <View style={[styles.kpiCard, { borderLeftColor: '#f59e0b' }]}>
                        <Text style={styles.kpiTitle}>Pending / Dr Guaranteed</Text>
                        <Text style={styles.kpiValue}>₹{(Number(calculatedStats?.pendingCollection) || 0).toFixed(2)}</Text>
                        <Text style={[styles.kpiSubtitle, { color: '#8b5cf6' }]}>Dr Auth: ₹{(Number(calculatedStats?.doctorGuaranteedAmount) || 0).toFixed(2)}</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Billing Settings */}
            <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Pharmacy Billing Details</Text>
                <View style={[styles.filterGrid, !isLargeScreen && { flexDirection: 'column' }]}>
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>GST Number</Text>
                        <TextInput 
                            style={styles.input}
                            value={billingSettings.gstin}
                            onChangeText={(t) => setBillingSettings(prev => ({...prev, gstin: t}))}
                            placeholder="Enter GSTIN"
                        />
                    </View>
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>Drug License (DL) Number</Text>
                        <TextInput 
                            style={styles.input}
                            value={billingSettings.dlNumber}
                            onChangeText={(t) => setBillingSettings(prev => ({...prev, dlNumber: t}))}
                            placeholder="Enter DL Number"
                        />
                    </View>
                    <View style={{ justifyContent: 'flex-end', marginBottom: 5 }}>
                        <TouchableOpacity style={styles.btnActionSecondary} onPress={handleUpdateBillingSettings}>
                            <Text style={styles.btnActionSecondaryText}>Save Details</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Filters */}
            <View style={styles.sectionCard}>
                <View style={[styles.filterGrid, !isLargeScreen && { flexDirection: 'column' }]}>
                    <TextInput 
                        style={[styles.input, { flex: 2 }]}
                        placeholder="Search by Patient Name, Phone or Doctor..."
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                    />
                    <TextInput 
                        style={[styles.input, { flex: 1 }]}
                        placeholder="YYYY-MM-DD"
                        value={dateFilter}
                        onChangeText={setDateFilter}
                    />
                    <View style={[styles.pickerWrapper, { flex: 1 }]}>
                        <Picker
                            selectedValue={statusFilter}
                            onValueChange={setStatusFilter}
                            style={styles.picker}
                        >
                            <Picker.Item label="All Statuses" value="All" />
                            <Picker.Item label="Pending / Upcoming" value="Pending" />
                            <Picker.Item label="Completed" value="Completed" />
                        </Picker>
                    </View>
                    <TouchableOpacity 
                        style={[styles.btnActionSecondary, { backgroundColor: '#e2e8f0' }]} 
                        onPress={() => { setSearchTerm(''); setDateFilter(''); setStatusFilter('All'); }}
                    >
                        <Text style={{ color: '#475569', fontWeight: 'bold' }}>Clear Filters</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Orders Table */}
            <View style={[styles.sectionCard, { padding: 0, overflow: 'hidden' }]}>
                {loading ? (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#10b981" />
                        <Text style={{ marginTop: 10, color: '#64748b' }}>Loading Orders...</Text>
                    </View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={{ minWidth: 1000 }}>
                            <View style={styles.tableHeadRow}>
                                <Text style={[styles.tableHead, { width: 180 }]}>Patient Details</Text>
                                <Text style={[styles.tableHead, { width: 150 }]}>Doctor</Text>
                                <Text style={[styles.tableHead, { width: 250 }]}>Prescribed Items</Text>
                                <Text style={[styles.tableHead, { width: 120 }]}>Total</Text>
                                <Text style={[styles.tableHead, { width: 120 }]}>Status</Text>
                                <Text style={[styles.tableHead, { width: 160 }]}>Payment</Text>
                                <Text style={[styles.tableHead, { width: 180 }]}>Actions</Text>
                            </View>
                            {(orders || []).filter(order => {
                                let matchesSearch = true;
                                if (searchTerm) {
                                    const lowerSearch = searchTerm.toLowerCase();
                                    const patientName = String(order.isOutsidePatient ? order.patientName : order.userId?.name || '').toLowerCase();
                                    const patientPhone = String(order.isOutsidePatient ? order.patientPhone : order.patientId || order.patient?.uhid || '').toLowerCase();
                                    const doctorName = String(order.isOutsidePatient ? order.doctorName : order.doctorId?.name || '').toLowerCase();
                                    matchesSearch = patientName.includes(lowerSearch) || patientPhone.includes(lowerSearch) || doctorName.includes(lowerSearch);
                                }
                                let matchesDate = true;
                                if (dateFilter) {
                                    const orderDate = order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : '';
                                    matchesDate = orderDate === dateFilter;
                                }
                                let matchesStatus = true;
                                if (statusFilter !== 'All') {
                                    if (statusFilter === 'Pending') {
                                        matchesStatus = order.orderStatus === 'Upcoming' || order.orderStatus === 'Pending';
                                    } else if (statusFilter === 'Completed') {
                                        matchesStatus = order.orderStatus === 'Completed';
                                    }
                                }
                                return matchesSearch && matchesDate && matchesStatus;
                            }).map((order) => {
                                const orderItems = order.items || order.prescribedItems || [];
                                const calculatedData = getInvoiceCalculations(order);
                                const isCompleted = order.orderStatus === 'Completed';
                                const isPaid = order.paymentStatus === 'Paid' || order.paymentStatus === 'PAID_BY_DOCTOR';
                                
                                return (
                                    <View key={order._id} style={styles.tableRow}>
                                        <View style={[styles.tableCell, { width: 180 }]}>
                                            <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>{order.isOutsidePatient ? order.patientName : order.userId?.name}</Text>
                                            <Text style={{ fontSize: 12, color: order.isOutsidePatient ? '#059669' : '#64748b', fontWeight: order.isOutsidePatient ? 'bold' : 'normal' }}>
                                                {order.isOutsidePatient ? `[Walk-in] ${order.patientPhone}` : order.patientId}
                                            </Text>
                                        </View>
                                        <View style={[styles.tableCell, { width: 150 }]}>
                                            <Text style={{ color: '#334155' }}>Dr. {order.isOutsidePatient ? (order.doctorName || 'N/A') : order.doctorId?.name}</Text>
                                        </View>
                                        <View style={[styles.tableCell, { width: 250 }]}>
                                            {orderItems.map((item, idx) => (
                                                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                    {order.orderStatus === 'Upcoming' ? (
                                                        <TouchableOpacity 
                                                            style={[styles.checkbox, !isChecked(order._id, idx) && { backgroundColor: 'white' }]}
                                                            onPress={() => toggleCheck(order._id, idx)}
                                                        >
                                                            {isChecked(order._id, idx) && <Text style={{ color: 'white', fontSize: 10 }}>✓</Text>}
                                                        </TouchableOpacity>
                                                    ) : (
                                                        <Text style={{ color: (item.purchased || isCompleted || isPaid) ? '#16a34a' : '#ef4444', marginRight: 6 }}>
                                                            {(item.purchased || isCompleted || isPaid) ? '✓' : '✗'}
                                                        </Text>
                                                    )}
                                                    <Text style={{ 
                                                        color: (!isCompleted && !(item.purchased || isPaid)) && order.orderStatus !== 'Upcoming' ? '#94a3b8' : '#334155',
                                                        textDecorationLine: (!isCompleted && !(item.purchased || isPaid)) && order.orderStatus !== 'Upcoming' ? 'line-through' : 'none',
                                                        fontSize: 13,
                                                        flex: 1
                                                    }} numberOfLines={1}>
                                                        {item.medicineName} ({item.frequency})
                                                        {item.price > 0 && <Text style={{ color: '#059669', fontWeight: 'bold' }}> ₹{item.price}</Text>}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                        <View style={[styles.tableCell, { width: 120 }]}>
                                            {Number(calculatedData.discountAmount) > 0 ? (
                                                <View>
                                                    <Text style={{ textDecorationLine: 'line-through', color: '#94a3b8', fontSize: 12 }}>₹{(Number(calculatedData.subtotal) + Number(calculatedData.totalTax)).toFixed(2)}</Text>
                                                    <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>₹{calculatedData.grandTotal}</Text>
                                                    <View style={{ backgroundColor: '#dcfce7', alignSelf: 'flex-start', paddingHorizontal: 4, borderRadius: 4, marginTop: 2 }}>
                                                        <Text style={{ color: '#16a34a', fontSize: 10, fontWeight: 'bold' }}>Disc: ₹{calculatedData.discountAmount}</Text>
                                                    </View>
                                                </View>
                                            ) : (
                                                <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>₹{calculatedData.grandTotal}</Text>
                                            )}
                                        </View>
                                        <View style={[styles.tableCell, { width: 120 }]}>
                                            <View style={[styles.badge, isCompleted ? { backgroundColor: '#dcfce7' } : { backgroundColor: '#fef3c7' }]}>
                                                <Text style={[styles.badgeText, isCompleted ? { color: '#166534' } : { color: '#92400e' }]}>{order.orderStatus}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.tableCell, { width: 160 }]}>
                                            <Text style={{
                                                color: (order.paymentStatus === 'PAID_BY_DOCTOR' || order.paymentMode === 'DOCTOR_AUTHORIZATION') ? '#d97706' : (order.paymentStatus === 'Paid' ? '#166534' : (isCompleted && order.paymentStatus === 'Pending' ? '#000' : '#991b1b')),
                                                fontWeight: 'bold',
                                                fontSize: 13
                                            }}>
                                                {isCompleted && order.paymentStatus === 'Pending' ? '-' : ((order.paymentStatus === 'PAID_BY_DOCTOR' || order.paymentMode === 'DOCTOR_AUTHORIZATION') ? (order.authorizedDoctorName || order.doctorName || order.doctorId?.name ? `Pending by Doctor - ${order.authorizedDoctorName || order.doctorName || order.doctorId?.name}` : 'Doctor Approval Pending') : (order.paymentStatus === 'Paid' ? `Paid ${order.paymentMode ? `(${order.paymentMode})` : ''}` : order.paymentStatus))}
                                            </Text>
                                        </View>
                                        <View style={[styles.tableCell, { width: 180, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }]}>
                                            <TouchableOpacity 
                                                style={[styles.btnAction, { backgroundColor: '#0284c7', paddingVertical: 6, paddingHorizontal: 10 }]}
                                                onPress={() => {
                                                    setSelectedOrder(order);
                                                    setDiscountPercent(String(order.discountPercent || 0));
                                                    setShowBillModal(true);
                                                }}
                                            >
                                                <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>📋 View Bill</Text>
                                            </TouchableOpacity>
                                            {order.orderStatus === 'Upcoming' && (
                                                <TouchableOpacity 
                                                    style={[styles.btnAction, { backgroundColor: '#dcfce7', paddingVertical: 6, paddingHorizontal: 10 }]}
                                                    onPress={() => openPaymentModal(order)}
                                                >
                                                    <Text style={{ color: '#166534', fontSize: 12, fontWeight: 'bold' }}>Dispense & Collect</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                )}
            </View>

            {/* Bill/Invoice Modal (View Only native implementation) */}
            <Modal visible={showBillModal} transparent={true} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { width: '90%', maxWidth: 900, maxHeight: '90%' }]}>
                        {showBillModal && selectedOrder && (() => {
                            const invoiceData = getInvoiceCalculations(selectedOrder, discountPercent);
                            return (
                                <View style={{ flex: 1 }}>
                                    <View style={styles.modalHeader}>
                                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#115e59' }}>📑 Patient Bill / Invoice</Text>
                                        <TouchableOpacity onPress={() => setShowBillModal(false)}>
                                            <Text style={{ fontSize: 24, color: '#94a3b8' }}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView style={{ flex: 1, padding: 20 }}>
                                        <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16 }}>
                                            <View style={{ alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#0d9488', paddingBottom: 12 }}>
                                                <Text style={{ fontSize: 20, fontWeight: '900', color: '#1e3a8a' }}>{hospitalInfo?.name?.toUpperCase() || 'ARYAN HOSPITAL'}</Text>
                                                <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold', marginTop: 4 }}>Pharmacy & Dispensary Section</Text>
                                                <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{hospitalInfo?.address || 'Mumbai, Maharashtra'} | Ph: {hospitalInfo?.phone || '9089089899'}</Text>
                                            </View>
                                            
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 }}>
                                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155' }}>INV NO: <Text style={{ color: '#0f172a' }}>{selectedOrder?.billNo || selectedOrder?._id?.slice(-8).toUpperCase()}</Text></Text>
                                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#334155' }}>DATE: <Text style={{ color: '#0f172a' }}>{selectedOrder?.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</Text></Text>
                                            </View>

                                            <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}>
                                                <View style={{ flex: 1, minWidth: 120 }}>
                                                    <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 'bold' }}>PATIENT</Text>
                                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a' }}>{selectedOrder?.userId?.name || selectedOrder?.patientName || 'Unknown Patient'}</Text>
                                                </View>
                                                <View style={{ flex: 1, minWidth: 120 }}>
                                                    <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 'bold' }}>DOCTOR</Text>
                                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#334155' }}>Dr. {selectedOrder?.doctorId?.name || selectedOrder?.doctorName || 'Unknown'}</Text>
                                                </View>
                                            </View>

                                            <View style={{ marginTop: 16 }}>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                    <View style={{ minWidth: 600 }}>
                                                        <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 8, borderBottomWidth: 1, borderBottomColor: '#cbd5e1' }}>
                                                            <Text style={{ width: 30, fontSize: 10, fontWeight: 'bold', color: '#475569' }}>#</Text>
                                                            <Text style={{ width: 150, fontSize: 10, fontWeight: 'bold', color: '#475569' }}>Medicine Name</Text>
                                                            <Text style={{ width: 100, fontSize: 10, fontWeight: 'bold', color: '#475569' }}>Batch / Exp</Text>
                                                            <Text style={{ width: 150, fontSize: 10, fontWeight: 'bold', color: '#475569' }}>Qty & Schedule</Text>
                                                            <Text style={{ width: 80, fontSize: 10, fontWeight: 'bold', color: '#475569', textAlign: 'right' }}>MRP (₹)</Text>
                                                            <Text style={{ flex: 1, fontSize: 10, fontWeight: 'bold', color: '#475569', textAlign: 'right' }}>Total (₹)</Text>
                                                        </View>
                                                        {invoiceData.processedItems.map((item, idx) => (
                                                            <View key={idx} style={{ flexDirection: 'row', padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' }}>
                                                                <Text style={{ width: 30, fontSize: 11, color: '#334155' }}>{idx + 1}</Text>
                                                                <Text style={{ width: 150, fontSize: 11, fontWeight: 'bold', color: '#0f172a' }}>{item.medicineName || item.name}</Text>
                                                                <View style={{ width: 100 }}>
                                                                    <Text style={{ fontSize: 11, color: '#64748b' }}>{item.batch || 'N/A'}</Text>
                                                                    <Text style={{ fontSize: 9, color: '#64748b' }}>{item.exp || 'N/A'}</Text>
                                                                </View>
                                                                <View style={{ width: 150 }}>
                                                                    {selectedOrder?.orderStatus === 'Completed' ? (
                                                                        <Text style={{ fontSize: 11, color: '#0f172a', fontWeight: 'bold' }}>
                                                                            {item.packagingBreakdown ? `📦 ${item.packagingBreakdown}` : `${item.finalQty} ${item.unitLabel}`}
                                                                        </Text>
                                                                    ) : (
                                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                            <TextInput 
                                                                                style={{ width: 40, padding: 2, borderWidth: 1, borderColor: '#cbd5e1', fontSize: 11, textAlign: 'center' }}
                                                                                value={String(item.finalQty)}
                                                                                keyboardType="numeric"
                                                                                onChangeText={(val) => {
                                                                                    const num = Number(val);
                                                                                    if (num < 0) return;
                                                                                    const updatedOrder = { ...selectedOrder };
                                                                                    const itemsArray = updatedOrder.prescribedItems || updatedOrder.items || [];
                                                                                    itemsArray[idx] = { ...itemsArray[idx], qty: num, quantity: num, totalReqd: num };
                                                                                    if (updatedOrder.prescribedItems) updatedOrder.prescribedItems = itemsArray;
                                                                                    if (updatedOrder.items) updatedOrder.items = itemsArray;
                                                                                    setSelectedOrder(updatedOrder);
                                                                                }}
                                                                            />
                                                                            <Text style={{ fontSize: 10, color: '#059669' }}>{item.unitLabel}</Text>
                                                                        </View>
                                                                    )}
                                                                </View>
                                                                <Text style={{ width: 80, fontSize: 11, color: '#334155', textAlign: 'right' }}>₹{item.unitRate.toFixed(2)}</Text>
                                                                <Text style={{ flex: 1, fontSize: 11, fontWeight: 'bold', color: '#0f172a', textAlign: 'right' }}>₹{item.itemTotal.toFixed(2)}</Text>
                                                            </View>
                                                        ))}
                                                    </View>
                                                </ScrollView>
                                            </View>

                                            <View style={{ alignItems: 'flex-end', marginTop: 16 }}>
                                                <View style={{ width: 220, backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <Text style={{ fontSize: 11 }}>Subtotal:</Text>
                                                        <Text style={{ fontSize: 11, fontWeight: 'bold' }}>₹{invoiceData.subtotal}</Text>
                                                    </View>
                                                    {selectedOrder?.orderStatus !== 'Completed' && (
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                                                            <Text style={{ fontSize: 11 }}>Discount (%):</Text>
                                                            <TextInput 
                                                                style={{ width: 50, padding: 2, borderWidth: 1, borderColor: '#cbd5e1', fontSize: 11, textAlign: 'right' }}
                                                                value={String(discountPercent)}
                                                                keyboardType="numeric"
                                                                onChangeText={(val) => setDiscountPercent(val)}
                                                            />
                                                        </View>
                                                    )}
                                                    {Number(invoiceData.discountAmount) > 0 && (
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                            <Text style={{ fontSize: 11, color: '#dc2626' }}>Discount:</Text>
                                                            <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: 'bold' }}>-₹{invoiceData.discountAmount}</Text>
                                                        </View>
                                                    )}
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#cbd5e1' }}>
                                                        <Text style={{ fontSize: 13, fontWeight: '900' }}>Grand Total:</Text>
                                                        <Text style={{ fontSize: 13, fontWeight: '900', color: '#0f766e' }}>₹{invoiceData.grandTotal}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                            
                                        </View>
                                    </ScrollView>
                                    <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <TouchableOpacity style={[styles.btnAction, { backgroundColor: '#2563eb' }]} onPress={() => Alert.alert('Print', 'Printing requires expo-print package.')}>
                                            <Text style={{ color: 'white', fontWeight: 'bold' }}>🖨️ Print Receipt</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.btnAction, { backgroundColor: '#f1f5f9' }]} onPress={() => setShowBillModal(false)}>
                                            <Text style={{ color: '#334155', fontWeight: 'bold' }}>Close</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })()}
                    </View>
                </View>
            </Modal>

            {/* Payment Modal */}
            <Modal visible={showPaymentModal} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { width: 500, maxWidth: '90%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Confirm Payment & Dispense</Text>
                            <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                                <Text style={{ fontSize: 24, color: '#94a3b8' }}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ padding: 20 }}>
                            <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Payment Received From</Text>
                            <View style={{ flexDirection: 'row', gap: 20, marginBottom: 20 }}>
                                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => setPaymentSource('Patient')}>
                                    <View style={[styles.radio, paymentSource === 'Patient' && styles.radioSelected]} />
                                    <Text style={{ marginLeft: 8 }}>Patient</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => setPaymentSource('Doctor')}>
                                    <View style={[styles.radio, paymentSource === 'Doctor' && styles.radioSelected]} />
                                    <Text style={{ marginLeft: 8 }}>Pending by Doctor</Text>
                                </TouchableOpacity>
                            </View>

                            {paymentSource === 'Doctor' && (
                                <View style={{ backgroundColor: '#f8fafc', padding: 15, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 }}>
                                    <Text style={{ color: '#8b5cf6', fontWeight: 'bold', marginBottom: 5 }}>Select Authorizing Doctor *</Text>
                                    <View style={styles.pickerWrapper}>
                                        <Picker selectedValue={authorizedByDoctor} onValueChange={setAuthorizedByDoctor} style={styles.picker}>
                                            <Picker.Item label="-- Select Doctor --" value="" />
                                            {(doctors || []).map(dr => (
                                                <Picker.Item key={dr._id} label={`Dr. ${dr.name || dr.userId?.name}`} value={dr._id} />
                                            ))}
                                        </Picker>
                                    </View>
                                    <Text style={{ marginTop: 10, marginBottom: 5 }}>Authorization Note</Text>
                                    <TextInput 
                                        style={styles.input} 
                                        value={authorizationNote} 
                                        onChangeText={setAuthorizationNote} 
                                        placeholder="e.g. Doctor verbally approved" 
                                    />
                                </View>
                            )}

                            {paymentSource === 'Patient' && (
                                <View style={{ marginBottom: 20 }}>
                                    <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Payment Mode</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                        {['CASH', 'UPI', 'CARD', 'ONLINE'].map(mode => (
                                            <TouchableOpacity 
                                                key={mode} 
                                                style={[
                                                    styles.paymentModeBtn, 
                                                    paymentMode === mode && styles.paymentModeBtnSelected
                                                ]}
                                                onPress={() => setPaymentMode(mode)}
                                            >
                                                <Text style={[
                                                    styles.paymentModeBtnText,
                                                    paymentMode === mode && styles.paymentModeBtnTextSelected
                                                ]}>
                                                    {mode === 'ONLINE' ? 'Online / Net Banking' : mode}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            <Text style={{ color: '#64748b', fontSize: 13 }}>This will instantly complete the order, decrement stock, and log the payment.</Text>
                        </View>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={[styles.btnAction, { backgroundColor: '#f1f5f9', paddingHorizontal: 20 }]} onPress={() => setShowPaymentModal(false)}>
                                <Text style={{ color: '#334155', fontWeight: 'bold' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btnAction, { backgroundColor: '#10b981', paddingHorizontal: 20 }]} onPress={() => {
                                if (paymentSource === 'Doctor' && !authorizedByDoctor) {
                                    return Alert.alert('Error', 'Please select an authorizing doctor.');
                                }
                                let selectedDoctorName = '';
                                if (authorizedByDoctor) {
                                    const doc = doctors.find(d => d._id === authorizedByDoctor);
                                    if (doc) selectedDoctorName = doc.name;
                                }
                                const paymentFlowItems = paymentFlowOrder.items || paymentFlowOrder.prescribedItems || [];
                                const calcData = getInvoiceCalculations(paymentFlowOrder, discountPercent);
                                const payload = {
                                    purchasedIndices: Array.from({ length: paymentFlowItems.length }, (_, i) => i),
                                    updatedItems: paymentFlowItems,
                                    paymentMode: paymentSource === 'Doctor' ? 'DOCTOR_AUTHORIZATION' : paymentMode.toUpperCase(),
                                    paymentStatus: paymentSource === 'Doctor' ? 'PAID_BY_DOCTOR' : 'Paid',
                                    authorizedByDoctor: paymentSource === 'Doctor' ? authorizedByDoctor : undefined,
                                    authorizedDoctorName: paymentSource === 'Doctor' ? selectedDoctorName : undefined,
                                    authorizationNote: paymentSource === 'Doctor' ? authorizationNote : undefined,
                                    discountPercent: Number(discountPercent) || 0,
                                    discountAmount: Number(calcData.discountAmount) || 0,
                                    frontendTotals: {
                                        taxableAmount: Number(calcData.subtotal) || 0,
                                        cgstAmount: Number(calcData.cgst) || 0,
                                        sgstAmount: Number(calcData.sgst) || 0,
                                        totalAmount: Number(calcData.grandTotal) || 0
                                    }
                                };
                                setShowPaymentModal(false);
                                handleCompleteOrder(paymentFlowOrder._id, payload, paymentFlowItems.length);
                            }}>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Confirm & Dispense</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    contentContainer: { padding: 20 },
    header: { marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    headerSubtitle: { color: '#64748b', fontSize: 14, marginTop: 4 },
    btnAction: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    btnActionText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    kpiGrid: { flexDirection: 'row', gap: 15, paddingBottom: 10 },
    kpiCard: { backgroundColor: 'white', padding: 15, borderRadius: 8, width: 220, borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 } },
    kpiTitle: { color: '#64748b', fontSize: 13, marginBottom: 5 },
    kpiValue: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
    kpiSubtitle: { fontSize: 11, fontWeight: 'bold', marginTop: 4 },
    sectionCard: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
    filterGrid: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
    formGroup: { flex: 1, minWidth: 200 },
    label: { fontSize: 13, color: '#64748b', marginBottom: 4 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 12, height: 40, backgroundColor: 'white', color: '#0f172a' },
    pickerWrapper: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, overflow: 'hidden', height: 40, backgroundColor: 'white', justifyContent: 'center' },
    picker: { height: 40, color: '#0f172a' },
    btnActionSecondary: { paddingHorizontal: 16, height: 40, backgroundColor: '#0f766e', borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
    btnActionSecondaryText: { color: 'white', fontWeight: 'bold' },
    tableHeadRow: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 12 },
    tableHead: { fontSize: 12, fontWeight: 'bold', color: '#475569', paddingHorizontal: 12 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 12 },
    tableCell: { paddingHorizontal: 12, justifyContent: 'center' },
    checkbox: { width: 16, height: 16, borderRadius: 3, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
    badgeText: { fontSize: 11, fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', elevation: 5 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 15, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
    radioSelected: { borderColor: '#10b981', backgroundColor: '#10b981', borderWidth: 5 },
    paymentModeBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1' },
    paymentModeBtnSelected: { borderColor: '#10b981', backgroundColor: '#ecfdf5', borderWidth: 2 },
    paymentModeBtnText: { color: '#475569', fontWeight: 'bold', fontSize: 13 },
    paymentModeBtnTextSelected: { color: '#065f46' }
});

export default PharmacyOrders;
