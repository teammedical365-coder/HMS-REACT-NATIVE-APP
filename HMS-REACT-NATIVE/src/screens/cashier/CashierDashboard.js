import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    useWindowDimensions,
    Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { billingAPI, hospitalAPI } from '../../utils/api';

const DEFAULT_FACILITIES = [
    { name: 'General Ward Bed', pricePerDay: 1000 },
    { name: 'Semi-Private Room', pricePerDay: 2500 },
    { name: 'Private Deluxe Room', pricePerDay: 5000 },
    { name: 'ICU / Critical Care Bed', pricePerDay: 8500 },
    { name: 'Oxygen Support Facility', pricePerDay: 1200 },
    { name: 'Ventilator Equipment Support', pricePerDay: 4000 }
];

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Net Banking', 'Insurance'];

const CashierDashboard = () => {
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 860;

    const [currentUser, setCurrentUser] = useState({});
    const [patients, setPatients] = useState([]);
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [sidebarSearch, setSidebarSearch] = useState('');
    const [selectedPatient, setSelectedPatient] = useState(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [patientInfo, setPatientInfo] = useState(null);
    const [billingData, setBillingData] = useState({
        appointments: [],
        labReports: [],
        pharmacyOrders: [],
        facilityCharges: [],
        admissions: []
    });

    const [activeTab, setActiveTab] = useState('dues'); // 'dues' | 'history'
    const [hospitalFacilities, setHospitalFacilities] = useState(DEFAULT_FACILITIES);
    const [addingFacility, setAddingFacility] = useState(false);
    const [facilityDropdownOpen, setFacilityDropdownOpen] = useState(false);
    const [facilityForm, setFacilityForm] = useState({
        name: '',
        pricePerDay: '',
        days: '1'
    });

    const [processingPayment, setProcessingPayment] = useState(false);
    const [paymentMode, setPaymentMode] = useState('Cash');

    // Auth & Permission Check
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const userStr = await AsyncStorage.getItem('user');
                if (!userStr) {
                    navigation.navigate('Login');
                    return;
                }
                const user = JSON.parse(userStr);
                setCurrentUser(user);
                const role = (user?.role || '').toLowerCase();
                const perms = user?.permissions || [];
                if (
                    !['billing', 'cashier', 'accountant', 'centraladmin', 'superadmin', 'hospitaladmin'].includes(role) &&
                    !perms.includes('billing_view') &&
                    !perms.includes('billing_manage') &&
                    !perms.includes('*')
                ) {
                    Alert.alert('Unauthorized', 'Access denied.');
                    navigation.navigate('Home');
                }
            } catch (err) {
                console.error('Auth verification error:', err);
            }
        };
        checkAuth();
        fetchPatientsList();
        fetchHospitalFacilities();
    }, []);

    // Filter patients by search term
    useEffect(() => {
        if (!sidebarSearch.trim()) {
            setFilteredPatients(patients);
        } else {
            const q = sidebarSearch.toLowerCase();
            setFilteredPatients(
                patients.filter(p =>
                    (p.name || '').toLowerCase().includes(q) ||
                    (p.mrn || '').toLowerCase().includes(q) ||
                    (p.patientId || '').toLowerCase().includes(q) ||
                    (p.phone || '').includes(q)
                )
            );
        }
    }, [sidebarSearch, patients]);

    const fetchPatientsList = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await billingAPI.getPatients();
            if (res.success) {
                setPatients(res.patients || []);
                setFilteredPatients(res.patients || []);
            }
        } catch (err) {
            console.error('Error fetching patients:', err);
            setError('Error fetching patients list');
        } finally {
            setLoading(false);
        }
    };

    const fetchHospitalFacilities = async () => {
        try {
            const res = await hospitalAPI.getMyHospital();
            if (res.success && res.hospital && res.hospital.facilities && res.hospital.facilities.length > 0) {
                setHospitalFacilities(res.hospital.facilities);
            }
        } catch (err) {
            console.log('Using default hospital facilities fallback:', err.message);
        }
    };

    const handleSelectPatient = async (p) => {
        setSelectedPatient(p);
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const identifier = p.mrn || p.patientId || p.phone || p._id;
            const res = await billingAPI.getPatientBills(identifier);
            if (res.success) {
                setPatientInfo(res.patient || p);
                setBillingData(res.billing || { appointments: [], labReports: [], pharmacyOrders: [], facilityCharges: [], admissions: [] });
            }
        } catch (err) {
            console.error('Error fetching patient bills:', err);
            setError(err.response?.data?.message || 'Error finding patient or bills');
            setPatientInfo(p);
            setBillingData({ appointments: [], labReports: [], pharmacyOrders: [], facilityCharges: [], admissions: [] });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectFacilityOption = (fac) => {
        setFacilityForm({
            ...facilityForm,
            name: fac.name,
            pricePerDay: String(fac.pricePerDay || '')
        });
        setFacilityDropdownOpen(false);
    };

    const handleAddFacilityCharge = async () => {
        if (!patientInfo) return;
        if (!facilityForm.name || !facilityForm.days) {
            Alert.alert('Validation Error', 'Please select a facility and enter the number of days.');
            return;
        }
        setAddingFacility(true);
        setError('');

        try {
            const data = {
                patientId: patientInfo._id,
                facilityName: facilityForm.name,
                pricePerDay: Number(facilityForm.pricePerDay) || 0,
                days: Number(facilityForm.days) || 1
            };
            const res = await billingAPI.addFacilityCharge(data);
            if (res.success) {
                setSuccess('Facility charge added to bill.');
                setFacilityForm({ name: '', pricePerDay: '', days: '1' });
                if (selectedPatient) handleSelectPatient(selectedPatient);
                fetchPatientsList();
            } else {
                setError(res.message || 'Failed to add facility charge');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error adding facility charge');
        } finally {
            setAddingFacility(false);
        }
    };

    const handlePayment = async () => {
        if (!patientInfo) return;
        setProcessingPayment(true);
        setError('');

        const appointmentIds = pendingAppointments.map(a => a._id);
        const labReportIds = pendingLab.map(l => l._id);
        const pharmacyOrderIds = pendingPharmacy.map(p => p._id);
        const facilityChargeIds = pendingFacilities.map(f => f._id);
        const admissionIds = pendingAdmissions.map(a => a._id);

        try {
            const res = await billingAPI.processPayment({
                appointmentIds,
                labReportIds,
                pharmacyOrderIds,
                facilityChargeIds,
                admissionIds,
                paymentMode: paymentMode === 'Net Banking' ? 'NetBanking' : paymentMode
            });
            if (res.success) {
                setSuccess('Payment processed successfully. Items marked as Paid.');
                Alert.alert('Payment Recorded', 'Payment processed successfully. Items marked as Paid.');
                if (selectedPatient) handleSelectPatient(selectedPatient);
                fetchPatientsList();
            } else {
                setError(res.message || 'Error processing payment');
            }
        } catch (err) {
            console.error('Payment error:', err);
            setError(err.response?.data?.message || 'Error processing payment');
        } finally {
            setProcessingPayment(false);
        }
    };

    const formatCurrency = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

    // Filter items by payment status
    const pendingAppointments = (billingData.appointments || []).filter(a => !['Paid', 'paid'].includes(a.paymentStatus));
    const pendingLab = (billingData.labReports || []).filter(l => !['PAID', 'Paid', 'paid'].includes(l.paymentStatus));
    const pendingPharmacy = (billingData.pharmacyOrders || []).filter(p => !['Paid', 'paid'].includes(p.paymentStatus));
    const pendingFacilities = (billingData.facilityCharges || []).filter(f => !['Paid', 'paid'].includes(f.paymentStatus));
    const pendingAdmissions = (billingData.admissions || []).filter(a => !['Paid', 'paid'].includes(a.paymentStatus));

    const paidAppointments = (billingData.appointments || []).filter(a => ['Paid', 'paid'].includes(a.paymentStatus));
    const paidLab = (billingData.labReports || []).filter(l => ['PAID', 'Paid', 'paid'].includes(l.paymentStatus));
    const paidPharmacy = (billingData.pharmacyOrders || []).filter(p => ['Paid', 'paid'].includes(p.paymentStatus));
    const paidFacilities = (billingData.facilityCharges || []).filter(f => ['Paid', 'paid'].includes(f.paymentStatus));
    const paidAdmissions = (billingData.admissions || []).filter(a => ['Paid', 'paid'].includes(a.paymentStatus));

    // Dues totals
    const totalAppointments = pendingAppointments.reduce((sum, a) => sum + (a.amount || 0), 0);
    const totalLab = pendingLab.reduce((sum, l) => sum + (l.amount || 0), 0);
    const totalPharmacy = pendingPharmacy.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalFacilities = pendingFacilities.reduce((sum, f) => sum + (f.totalAmount || 0), 0);
    const totalAdmissions = pendingAdmissions.reduce((sum, a) => sum + (a.totalAmount || 0), 0);
    const grandTotal = totalAppointments + totalLab + totalPharmacy + totalFacilities + totalAdmissions;

    // Paid totals (History)
    const paidTotalAppointments = paidAppointments.reduce((sum, a) => sum + (a.amount || 0), 0);
    const paidTotalLab = paidLab.reduce((sum, l) => sum + (l.amount || 0), 0);
    const paidTotalPharmacy = paidPharmacy.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const paidTotalFacilities = paidFacilities.reduce((sum, f) => sum + (f.totalAmount || 0), 0);
    const paidTotalAdmissions = paidAdmissions.reduce((sum, a) => sum + (a.totalAmount || 0), 0);
    const totalPaidSum = paidTotalAppointments + paidTotalLab + paidTotalPharmacy + paidTotalFacilities + paidTotalAdmissions;

    // Render Left Patient List Sidebar
    const renderPatientSidebar = () => (
        <View style={[styles.patientsSidebar, isDesktop ? styles.sidebarDesktop : styles.sidebarMobile]}>
            <View style={styles.searchRow}>
                <Feather name="search" size={16} color="#94a3b8" style={styles.searchIcon} />
                <TextInput
                    style={styles.sidebarSearchBox}
                    placeholder="Search name, phone, MRN..."
                    placeholderTextColor="#94a3b8"
                    value={sidebarSearch}
                    onChangeText={setSidebarSearch}
                />
                {sidebarSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setSidebarSearch('')}>
                        <Feather name="x" size={16} color="#94a3b8" />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView style={styles.patientsListWrapper} showsVerticalScrollIndicator={false}>
                {loading && patients.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                        <ActivityIndicator size="small" color="#3b82f6" />
                        <Text style={styles.emptyStateText}>Loading patients...</Text>
                    </View>
                ) : filteredPatients.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                        <Text style={styles.emptyStateText}>No patients found</Text>
                    </View>
                ) : (
                    filteredPatients.map((p) => {
                        const isSelected = selectedPatient?._id === p._id;
                        const hasDues = (p.pendingDues || 0) > 0;
                        return (
                            <TouchableOpacity
                                key={p._id || p.patientId || p.mrn}
                                style={[styles.patientListItem, isSelected && styles.patientListItemSelected]}
                                onPress={() => handleSelectPatient(p)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.patientListRow}>
                                    <Text style={styles.patientListName} numberOfLines={1}>{p.name}</Text>
                                    <View style={hasDues ? styles.badgeDues : styles.badgeSettled}>
                                        <Text style={hasDues ? styles.badgeDuesText : styles.badgeSettledText}>
                                            {hasDues ? `Dues: ${formatCurrency(p.pendingDues)}` : 'Settled'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.patientListMeta} numberOfLines={1}>
                                    MRN: {p.mrn || p.patientId || 'N/A'} | Mob: {p.phone || 'N/A'}
                                </Text>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );

    // Render Right Detail Panel
    const renderDetailsContent = () => {
        if (!selectedPatient || !patientInfo) {
            return (
                <View style={styles.placeholderCard}>
                    <Text style={styles.placeholderIcon}>🧾</Text>
                    <Text style={styles.placeholderTitle}>Billing Executive Dashboard</Text>
                    <Text style={styles.placeholderSub}>
                        Please select a patient from the sidebar list to view detailed outstanding dues, record facility charges, and view payment history.
                    </Text>
                </View>
            );
        }

        return (
            <View style={styles.dashboardDetailsSection}>
                {/* Mobile back to patient list */}
                {!isDesktop && (
                    <TouchableOpacity style={styles.mobileBackBtn} onPress={() => setSelectedPatient(null)}>
                        <Feather name="arrow-left" size={16} color="#3b82f6" />
                        <Text style={styles.mobileBackBtnText}>Back to Patients</Text>
                    </TouchableOpacity>
                )}

                {/* Patient Demographics Header */}
                <View style={[styles.patientInfoCard, { borderLeftColor: grandTotal > 0 ? '#ef4444' : '#10b981' }]}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={styles.patientInfoName}>{patientInfo.name}</Text>
                            <TouchableOpacity
                                style={styles.openFullProfileBtn}
                                onPress={() => navigation.navigate('PatientBillingProfile', { q: patientInfo.phone || patientInfo.mrn })}
                            >
                                <Feather name="external-link" size={14} color="#2563eb" />
                                <Text style={styles.openFullProfileText}>Full Profile</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.patientInfoMeta}>
                            <Text style={{ fontWeight: '700' }}>MRN:</Text> {patientInfo.mrn || patientInfo.patientId || 'N/A'}  •  
                            <Text style={{ fontWeight: '700' }}> Phone:</Text> {patientInfo.phone || 'N/A'}  •  
                            <Text style={{ fontWeight: '700' }}> Gender:</Text> {patientInfo.gender || 'N/A'}
                        </Text>
                    </View>
                </View>

                {/* Metrics Summary Row */}
                <View style={styles.metricsRow}>
                    <View style={[styles.metricBox, { borderTopColor: '#ef4444' }]}>
                        <Text style={[styles.metricValue, { color: '#ef4444' }]}>{formatCurrency(grandTotal)}</Text>
                        <Text style={styles.metricLabel}>PENDING DUES</Text>
                    </View>
                    <View style={[styles.metricBox, { borderTopColor: '#10b981' }]}>
                        <Text style={[styles.metricValue, { color: '#10b981' }]}>{formatCurrency(totalPaidSum)}</Text>
                        <Text style={styles.metricLabel}>TOTAL PAID</Text>
                    </View>
                    <View style={[styles.metricBox, { borderTopColor: grandTotal > 0 ? '#f59e0b' : '#10b981' }]}>
                        <Text style={[styles.metricValue, { color: grandTotal > 0 ? '#f59e0b' : '#10b981', fontSize: 15 }]}>
                            {grandTotal > 0 ? '🔴 Pending Payment' : '🟢 Settle / Clear'}
                        </Text>
                        <Text style={styles.metricLabel}>BILLING STATUS</Text>
                    </View>
                </View>

                {/* Tabs Container */}
                <View style={styles.tabButtonsContainer}>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'dues' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('dues')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'dues' && styles.tabBtnTextActive]}>
                            🧾 Outstanding Dues ({formatCurrency(grandTotal)})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('history')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'history' && styles.tabBtnTextActive]}>
                            📜 Payment History ({formatCurrency(totalPaidSum)})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* TAB 1: OUTSTANDING DUES */}
                {activeTab === 'dues' ? (
                    <View style={styles.billingGrid}>
                        <View style={styles.billingDetails}>
                            {/* ADD ROOM / FACILITY CHARGE FORM */}
                            <View style={styles.facilityCard}>
                                <Text style={styles.facilityCardTitle}>Add Room / Facility Usage</Text>
                                <View style={styles.facilityFormRow}>
                                    <View style={{ flex: 2, position: 'relative' }}>
                                        <TouchableOpacity
                                            style={styles.facilitySelectBtn}
                                            onPress={() => setFacilityDropdownOpen(!facilityDropdownOpen)}
                                        >
                                            <Text style={styles.facilitySelectBtnText} numberOfLines={1}>
                                                {facilityForm.name ? `${facilityForm.name} (${formatCurrency(facilityForm.pricePerDay)}/day)` : '-- Select Facility --'}
                                            </Text>
                                            <Feather name={facilityDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#64748b" />
                                        </TouchableOpacity>

                                        {facilityDropdownOpen && (
                                            <View style={styles.facilityDropdownMenu}>
                                                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                                                    {hospitalFacilities.map((fac, idx) => (
                                                        <TouchableOpacity
                                                            key={idx}
                                                            style={styles.facilityDropdownItem}
                                                            onPress={() => handleSelectFacilityOption(fac)}
                                                        >
                                                            <Text style={styles.facilityDropdownItemText}>
                                                                {fac.name} ({formatCurrency(fac.pricePerDay)}/day)
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        )}
                                    </View>

                                    <View style={{ width: 80 }}>
                                        <TextInput
                                            style={styles.daysInput}
                                            keyboardType="number-pad"
                                            placeholder="Days"
                                            value={facilityForm.days}
                                            onChangeText={(val) => setFacilityForm(prev => ({ ...prev, days: val }))}
                                        />
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.addFacilityBtn, (!facilityForm.name || addingFacility) && styles.btnDisabled]}
                                        onPress={handleAddFacilityCharge}
                                        disabled={!facilityForm.name || addingFacility}
                                    >
                                        <Text style={styles.addFacilityBtnText}>
                                            {addingFacility ? 'Adding...' : '+ Add Charge'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* WARD / ADMISSION DUES */}
                            {pendingAdmissions.length > 0 && (
                                <View style={styles.billingSection}>
                                    <Text style={styles.billingSectionTitle}>🛏️ Hospital Ward & Room Charges</Text>
                                    {pendingAdmissions.map((adm) => (
                                        <View key={adm._id} style={styles.tableRow}>
                                            <View style={{ flex: 2 }}>
                                                <Text style={styles.itemTitle}>{adm.ward} (Bed {adm.bedNumber || 'N/A'})</Text>
                                                <Text style={styles.itemSubtitle}>Admitted: {new Date(adm.admissionDate).toLocaleDateString('en-IN')}</Text>
                                                {adm.selectedFacilities?.map((f, fi) => (
                                                    <Text key={fi} style={styles.itemSmallNote}>
                                                        {f.facilityName} ({f.days} days @ {formatCurrency(f.pricePerDay)}/day)
                                                    </Text>
                                                ))}
                                            </View>
                                            <Text style={styles.itemPriceDues}>{formatCurrency(adm.totalAmount)}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* OTHER FACILITY CHARGES */}
                            {pendingFacilities.length > 0 && (
                                <View style={styles.billingSection}>
                                    <Text style={styles.billingSectionTitle}>🛌 Other Room / Facility Charges</Text>
                                    {pendingFacilities.map((f) => (
                                        <View key={f._id} style={styles.tableRow}>
                                            <View style={{ flex: 2 }}>
                                                <Text style={styles.itemTitle}>{f.facilityName}</Text>
                                                <Text style={styles.itemSubtitle}>{f.days} Days @ {formatCurrency(f.pricePerDay)}/day</Text>
                                            </View>
                                            <Text style={styles.itemPriceDues}>{formatCurrency(f.totalAmount)}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* CONSULTATIONS */}
                            {pendingAppointments.length > 0 && (
                                <View style={styles.billingSection}>
                                    <Text style={styles.billingSectionTitle}>👨‍⚕️ Consultations & Services</Text>
                                    {pendingAppointments.map((a) => (
                                        <View key={a._id} style={styles.tableRow}>
                                            <View style={{ flex: 2 }}>
                                                <Text style={styles.itemTitle}>{a.doctorName || 'General Consultation'}</Text>
                                                <Text style={styles.itemSubtitle}>
                                                    {new Date(a.appointmentDate).toLocaleDateString('en-IN')}  •  {a.serviceName || 'Consultation'}
                                                </Text>
                                            </View>
                                            <Text style={styles.itemPriceDues}>{formatCurrency(a.amount)}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* LAB TESTS */}
                            {pendingLab.length > 0 && (
                                <View style={styles.billingSection}>
                                    <Text style={styles.billingSectionTitle}>🧪 Laboratory Tests</Text>
                                    {pendingLab.map((l) => (
                                        <View key={l._id} style={styles.tableRow}>
                                            <View style={{ flex: 2 }}>
                                                <Text style={styles.itemTitle}>{l.testNames?.join(', ') || 'Lab Investigation'}</Text>
                                                <Text style={styles.itemSubtitle}>Ordered: {new Date(l.createdAt).toLocaleDateString('en-IN')}</Text>
                                            </View>
                                            <Text style={styles.itemPriceDues}>{formatCurrency(l.amount)}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* PHARMACY */}
                            {pendingPharmacy.length > 0 && (
                                <View style={styles.billingSection}>
                                    <Text style={styles.billingSectionTitle}>💊 Pharmacy Dispenses</Text>
                                    {pendingPharmacy.map((p) => (
                                        <View key={p._id} style={styles.tableRow}>
                                            <View style={{ flex: 2 }}>
                                                <Text style={styles.itemTitle}>
                                                    {p.items?.map(i => `${i.medicineName || 'Medicine'}${i.duration ? ` (${i.duration})` : ''}`).join(', ') || 'Prescription Items'}
                                                </Text>
                                                <Text style={styles.itemSubtitle}>Dispensed: {new Date(p.createdAt).toLocaleDateString('en-IN')}</Text>
                                            </View>
                                            <Text style={styles.itemPriceDues}>{formatCurrency(p.totalAmount)}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {grandTotal === 0 && (
                                <View style={styles.noDuesCard}>
                                    <Feather name="check-circle" size={40} color="#10b981" />
                                    <Text style={styles.noDuesTitle}>This patient has no outstanding dues.</Text>
                                </View>
                            )}
                        </View>

                        {/* Settle Panel Right Box */}
                        <View style={styles.billingSummary}>
                            <View style={styles.summaryCard}>
                                <Text style={styles.summaryCardTitle}>Settle Bill Payment</Text>
                                
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Consultations:</Text>
                                    <Text style={styles.summaryVal}>{formatCurrency(totalAppointments)}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Lab Dues:</Text>
                                    <Text style={styles.summaryVal}>{formatCurrency(totalLab)}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Pharmacy Dues:</Text>
                                    <Text style={styles.summaryVal}>{formatCurrency(totalPharmacy)}</Text>
                                </View>
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Facilities & Ward:</Text>
                                    <Text style={styles.summaryVal}>{formatCurrency(totalFacilities + totalAdmissions)}</Text>
                                </View>

                                <View style={styles.summaryTotalRow}>
                                    <Text style={styles.summaryTotalLabel}>Grand Total:</Text>
                                    <Text style={styles.summaryTotalVal}>{formatCurrency(grandTotal)}</Text>
                                </View>

                                {grandTotal > 0 && (
                                    <>
                                        <Text style={styles.paymentModeTitle}>Payment Mode</Text>
                                        <View style={styles.paymentModesGrid}>
                                            {PAYMENT_MODES.map((mode) => (
                                                <TouchableOpacity
                                                    key={mode}
                                                    style={[styles.paymentModeChip, paymentMode === mode && styles.paymentModeChipActive]}
                                                    onPress={() => setPaymentMode(mode)}
                                                >
                                                    <Text style={[styles.paymentModeChipText, paymentMode === mode && styles.paymentModeChipTextActive]}>
                                                        {mode}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        <TouchableOpacity
                                            style={[styles.payBtn, processingPayment && styles.btnDisabled]}
                                            onPress={handlePayment}
                                            disabled={processingPayment}
                                        >
                                            <Text style={styles.payBtnText}>
                                                {processingPayment ? 'Settle Payment...' : `Confirm Settle & Record Paid (${formatCurrency(grandTotal)})`}
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>
                    </View>
                ) : (
                    /* TAB 2: PAYMENT HISTORY */
                    <View style={styles.historyCard}>
                        <Text style={styles.historyCardTitle}>📜 Settle Payment History (Completed Collections)</Text>
                        {totalPaidSum === 0 ? (
                            <View style={styles.emptyHistoryState}>
                                <Text style={styles.emptyHistoryText}>No payment records found for this patient.</Text>
                            </View>
                        ) : (
                            <View style={{ gap: 16 }}>
                                {/* Ward history */}
                                {paidAdmissions.length > 0 && (
                                    <View style={styles.historySection}>
                                        <Text style={styles.historySectionTitle}>🛏️ Hospital Ward History</Text>
                                        {paidAdmissions.map((adm) => (
                                            <View key={adm._id} style={styles.tableRow}>
                                                <View style={{ flex: 2 }}>
                                                    <Text style={styles.itemTitle}>{adm.ward} (Bed {adm.bedNumber})</Text>
                                                    {adm.selectedFacilities?.map((f, i) => (
                                                        <Text key={i} style={styles.itemSmallNote}>
                                                            {f.facilityName} ({f.days} days @ {formatCurrency(f.pricePerDay)}/day)
                                                        </Text>
                                                    ))}
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.itemPricePaid}>{formatCurrency(adm.totalAmount)}</Text>
                                                    <View style={styles.badgeSettledSmall}><Text style={styles.badgeSettledSmallText}>Paid</Text></View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Facility history */}
                                {paidFacilities.length > 0 && (
                                    <View style={styles.historySection}>
                                        <Text style={styles.historySectionTitle}>🛌 Room & Facility History</Text>
                                        {paidFacilities.map((f) => (
                                            <View key={f._id} style={styles.tableRow}>
                                                <View style={{ flex: 2 }}>
                                                    <Text style={styles.itemTitle}>{f.facilityName}</Text>
                                                    <Text style={styles.itemSubtitle}>{f.days} Days @ {formatCurrency(f.pricePerDay)}/day</Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.itemPricePaid}>{formatCurrency(f.totalAmount)}</Text>
                                                    <View style={styles.badgeSettledSmall}><Text style={styles.badgeSettledSmallText}>Paid</Text></View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Consult history */}
                                {paidAppointments.length > 0 && (
                                    <View style={styles.historySection}>
                                        <Text style={styles.historySectionTitle}>👨‍⚕️ Consultation History</Text>
                                        {paidAppointments.map((a) => (
                                            <View key={a._id} style={styles.tableRow}>
                                                <View style={{ flex: 2 }}>
                                                    <Text style={styles.itemTitle}>{a.doctorName || 'Consultation'}</Text>
                                                    <Text style={styles.itemSubtitle}>
                                                        {new Date(a.appointmentDate).toLocaleDateString('en-IN')}  •  Method: {a.paymentMode || 'Cash'}
                                                    </Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.itemPricePaid}>{formatCurrency(a.amount)}</Text>
                                                    <View style={styles.badgeSettledSmall}><Text style={styles.badgeSettledSmallText}>Paid</Text></View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Lab history */}
                                {paidLab.length > 0 && (
                                    <View style={styles.historySection}>
                                        <Text style={styles.historySectionTitle}>🧪 Laboratory Tests History</Text>
                                        {paidLab.map((l) => (
                                            <View key={l._id} style={styles.tableRow}>
                                                <View style={{ flex: 2 }}>
                                                    <Text style={styles.itemTitle}>{l.testNames?.join(', ') || 'Lab Tests'}</Text>
                                                    <Text style={styles.itemSubtitle}>
                                                        {new Date(l.createdAt).toLocaleDateString('en-IN')}  •  Method: {l.paymentMode || 'Cash'}
                                                    </Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.itemPricePaid}>{formatCurrency(l.amount)}</Text>
                                                    <View style={styles.badgeSettledSmall}><Text style={styles.badgeSettledSmallText}>Paid</Text></View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Pharmacy history */}
                                {paidPharmacy.length > 0 && (
                                    <View style={styles.historySection}>
                                        <Text style={styles.historySectionTitle}>💊 Pharmacy Orders History</Text>
                                        {paidPharmacy.map((p) => (
                                            <View key={p._id} style={styles.tableRow}>
                                                <View style={{ flex: 2 }}>
                                                    <Text style={styles.itemTitle}>{p.items?.map(i => i.medicineName).join(', ') || 'Medicines'}</Text>
                                                    <Text style={styles.itemSubtitle}>{new Date(p.createdAt).toLocaleDateString('en-IN')}</Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.itemPricePaid}>{formatCurrency(p.totalAmount)}</Text>
                                                    <View style={styles.badgeSettledSmall}><Text style={styles.badgeSettledSmallText}>Paid</Text></View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <ScrollView style={styles.screenScroll} contentContainerStyle={styles.container}>
            {/* Header */}
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.headerTitle}>Billing Executive Dashboard</Text>
                    <Text style={styles.headerSubtitle}>
                        Manage patient dues, add dynamic ward/room charges, and record payments.
                    </Text>
                </View>
            </View>

            {/* Error / Success Banners */}
            {error ? (
                <View style={styles.errorBanner}>
                    <Feather name="alert-circle" size={16} color="#dc2626" />
                    <Text style={styles.errorBannerText}>{error}</Text>
                </View>
            ) : null}
            {success ? (
                <View style={styles.successBanner}>
                    <Feather name="check-circle" size={16} color="#16a34a" />
                    <Text style={styles.successBannerText}>{success}</Text>
                </View>
            ) : null}

            {/* Main Master-Detail Layout */}
            <View style={[styles.dashboardLayoutGrid, isDesktop ? styles.gridDesktop : styles.gridMobile]}>
                {/* On desktop, both sidebar and detail render side by side. On mobile, if patient selected, detail renders full width */}
                {(!selectedPatient || isDesktop) && renderPatientSidebar()}
                {(selectedPatient || isDesktop) && renderDetailsContent()}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    screenScroll: {
        flex: 1,
        backgroundColor: '#f8fafc'
    },
    container: {
        padding: 24,
        paddingBottom: 40
    },
    headerRow: {
        marginBottom: 20
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1e293b'
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 4
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fee2e2',
        borderLeftWidth: 4,
        borderLeftColor: '#ef4444',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        gap: 8
    },
    errorBannerText: {
        color: '#991b1b',
        fontSize: 14,
        fontWeight: '600'
    },
    successBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#dcfce7',
        borderLeftWidth: 4,
        borderLeftColor: '#22c55e',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        gap: 8
    },
    successBannerText: {
        color: '#166534',
        fontSize: 14,
        fontWeight: '600'
    },
    dashboardLayoutGrid: {
        marginTop: 8
    },
    gridDesktop: {
        flexDirection: 'row',
        gap: 24,
        alignItems: 'flex-start'
    },
    gridMobile: {
        flexDirection: 'column',
        gap: 16
    },
    patientsSidebar: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2
    },
    sidebarDesktop: {
        width: 320,
        minHeight: 620,
        maxHeight: 800
    },
    sidebarMobile: {
        width: '100%',
        minHeight: 350
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 14
    },
    searchIcon: {
        marginRight: 8
    },
    sidebarSearchBox: {
        flex: 1,
        height: 40,
        fontSize: 14,
        color: '#1e293b'
    },
    patientsListWrapper: {
        flex: 1
    },
    patientListItem: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        borderRadius: 8,
        marginBottom: 4
    },
    patientListItemSelected: {
        backgroundColor: '#eff6ff',
        borderLeftWidth: 4,
        borderLeftColor: '#3b82f6'
    },
    patientListRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
    },
    patientListName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        flex: 1,
        marginRight: 8
    },
    patientListMeta: {
        fontSize: 12,
        color: '#64748b'
    },
    badgeDues: {
        backgroundColor: '#fee2e2',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4
    },
    badgeDuesText: {
        color: '#ef4444',
        fontSize: 11,
        fontWeight: '800'
    },
    badgeSettled: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4
    },
    badgeSettledText: {
        color: '#16a34a',
        fontSize: 11,
        fontWeight: '800'
    },
    emptyStateContainer: {
        padding: 30,
        alignItems: 'center',
        justifyContent: 'center'
    },
    emptyStateText: {
        color: '#64748b',
        fontSize: 14,
        marginTop: 6
    },
    placeholderCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 60,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2
    },
    placeholderIcon: {
        fontSize: 56,
        marginBottom: 16
    },
    placeholderTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 8
    },
    placeholderSub: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        maxWidth: 480,
        lineHeight: 22
    },
    dashboardDetailsSection: {
        flex: 1
    },
    mobileBackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
        paddingVertical: 6
    },
    mobileBackBtnText: {
        color: '#3b82f6',
        fontSize: 14,
        fontWeight: '700'
    },
    patientInfoCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 18,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderLeftWidth: 5,
        marginBottom: 18,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2
    },
    patientInfoName: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a'
    },
    patientInfoMeta: {
        fontSize: 14,
        color: '#475569',
        marginTop: 6
    },
    openFullProfileBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#eff6ff',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6
    },
    openFullProfileText: {
        color: '#2563eb',
        fontSize: 12,
        fontWeight: '700'
    },
    metricsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 20
    },
    metricBox: {
        flex: 1,
        minWidth: 160,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderTopWidth: 4,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1
    },
    metricValue: {
        fontSize: 18,
        fontWeight: '800'
    },
    metricLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748b',
        marginTop: 4
    },
    tabButtonsContainer: {
        flexDirection: 'row',
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
        marginBottom: 20,
        gap: 12
    },
    tabBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
        marginBottom: -2
    },
    tabBtnActive: {
        borderBottomColor: '#3b82f6'
    },
    tabBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#64748b'
    },
    tabBtnTextActive: {
        color: '#3b82f6',
        fontWeight: '700'
    },
    billingGrid: {
        flexDirection: 'column',
        gap: 20
    },
    billingDetails: {
        flex: 1,
        gap: 16
    },
    facilityCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1
    },
    facilityCardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 10
    },
    facilityFormRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center'
    },
    facilitySelectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 42
    },
    facilitySelectBtnText: {
        fontSize: 13,
        color: '#1e293b',
        flex: 1,
        marginRight: 6
    },
    facilityDropdownMenu: {
        position: 'absolute',
        top: 46,
        left: 0,
        right: 0,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        zIndex: 99,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 6
    },
    facilityDropdownItem: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    facilityDropdownItemText: {
        fontSize: 13,
        color: '#1e293b'
    },
    daysInput: {
        height: 42,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        fontSize: 14,
        color: '#1e293b',
        textAlign: 'center'
    },
    addFacilityBtn: {
        backgroundColor: '#3b82f6',
        borderRadius: 8,
        paddingHorizontal: 14,
        height: 42,
        justifyContent: 'center',
        alignItems: 'center'
    },
    addFacilityBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700'
    },
    btnDisabled: {
        opacity: 0.6
    },
    billingSection: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1
    },
    billingSectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 12
    },
    tableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    itemTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b'
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2
    },
    itemSmallNote: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2
    },
    itemPriceDues: {
        fontSize: 15,
        fontWeight: '800',
        color: '#ef4444'
    },
    itemPricePaid: {
        fontSize: 15,
        fontWeight: '800',
        color: '#10b981'
    },
    badgeSettledSmall: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 3
    },
    badgeSettledSmallText: {
        color: '#16a34a',
        fontSize: 10,
        fontWeight: '800'
    },
    noDuesCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 10
    },
    noDuesTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#475569'
    },
    billingSummary: {
        marginTop: 8
    },
    summaryCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2
    },
    summaryCardTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 16
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    summaryLabel: {
        fontSize: 14,
        color: '#64748b'
    },
    summaryVal: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b'
    },
    summaryTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        marginTop: 6,
        borderTopWidth: 2,
        borderTopColor: '#e2e8f0'
    },
    summaryTotalLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a'
    },
    summaryTotalVal: {
        fontSize: 18,
        fontWeight: '900',
        color: '#ef4444'
    },
    paymentModeTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 16,
        marginBottom: 8
    },
    paymentModesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16
    },
    paymentModeChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#f8fafc'
    },
    paymentModeChipActive: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6'
    },
    paymentModeChipText: {
        fontSize: 13,
        color: '#334155',
        fontWeight: '600'
    },
    paymentModeChipTextActive: {
        color: '#ffffff',
        fontWeight: '700'
    },
    payBtn: {
        backgroundColor: '#10b981',
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6
    },
    payBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '800'
    },
    historyCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2
    },
    historyCardTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 16
    },
    emptyHistoryState: {
        padding: 36,
        alignItems: 'center'
    },
    emptyHistoryText: {
        color: '#94a3b8',
        fontSize: 14
    },
    historySection: {
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    historySectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 8
    }
});

export default CashierDashboard;
