import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { billingAPI } from '../../utils/api';

const CashierDashboard = () => {
    const navigation = useNavigation();
    const [patients, setPatients] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [billingData, setBillingData] = useState({ appointments: [], labReports: [], pharmacyOrders: [], facilityCharges: [], admissions: [] });
    const [loading, setLoading] = useState(false);
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const userStr = await AsyncStorage.getItem('user');
            if (!userStr) { navigation.navigate('Login'); return; }
            const user = JSON.parse(userStr);
            const role = (user.role || '').toLowerCase();
            const perms = user.permissions || [];
            if (!['billing', 'cashier', 'accountant', 'centraladmin', 'superadmin', 'hospitaladmin'].includes(role) && !perms.includes('billing_manage')) {
                Alert.alert('Unauthorized', 'Access denied.');
                navigation.navigate('Home');
            }
        };
        checkAuth();
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        setLoading(true);
        try {
            const res = await billingAPI.getPatients();
            if (res.success) setPatients(res.patients || []);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const handleSelectPatient = async (p) => {
        setSelectedPatient(p);
        try {
            const res = await billingAPI.getPatientBills(p.mrn || p.patientId || p.phone || p._id);
            if (res.success) setBillingData(res.billing || { appointments: [], labReports: [], pharmacyOrders: [], facilityCharges: [], admissions: [] });
        } catch (err) { Alert.alert('Error', 'Failed to fetch patient bills'); }
    };

    const handlePayment = async () => {
        setProcessing(true);
        try {
            const appointmentIds = pendingAppointments.map(a => a._id);
            const labReportIds = pendingLab.map(l => l._id);
            const pharmacyOrderIds = pendingPharmacy.map(p => p._id);
            const facilityChargeIds = pendingFacilities.map(f => f._id);
            const admissionIds = pendingAdmissions.map(a => a._id);

            const res = await billingAPI.processPayment({ appointmentIds, labReportIds, pharmacyOrderIds, facilityChargeIds, admissionIds, paymentMode });
            if (res.success) {
                Alert.alert('Success', 'Payment processed successfully.');
                handleSelectPatient(selectedPatient);
                fetchPatients();
            }
        } catch (err) { Alert.alert('Error', 'Payment failed'); } finally { setProcessing(false); }
    };

    const pendingAppointments = (billingData.appointments || []).filter(a => !['Paid', 'paid'].includes(a.paymentStatus));
    const pendingLab = (billingData.labReports || []).filter(l => !['PAID', 'Paid', 'paid'].includes(l.paymentStatus));
    const pendingPharmacy = (billingData.pharmacyOrders || []).filter(p => !['Paid', 'paid'].includes(p.paymentStatus));
    const pendingFacilities = (billingData.facilityCharges || []).filter(f => !['Paid', 'paid'].includes(f.paymentStatus));
    const pendingAdmissions = (billingData.admissions || []).filter(a => !['Paid', 'paid'].includes(a.paymentStatus));

    const grandTotal = 
        pendingAppointments.reduce((sum, a) => sum + (a.amount || 0), 0) +
        pendingLab.reduce((sum, l) => sum + (l.amount || 0), 0) +
        pendingPharmacy.reduce((sum, p) => sum + (p.totalAmount || 0), 0) +
        pendingFacilities.reduce((sum, f) => sum + (f.totalAmount || 0), 0) +
        pendingAdmissions.reduce((sum, a) => sum + (a.totalAmount || 0), 0);

    const filteredPatients = patients.filter(p => (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (p.phone || '').includes(searchQuery));

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Billing Executive Dashboard</Text>
            
            {!selectedPatient ? (
                <>
                    <TextInput style={styles.searchInput} placeholder="Search patients..." value={searchQuery} onChangeText={setSearchQuery} />
                    <FlatList
                        data={filteredPatients}
                        keyExtractor={item => item._id}
                        renderItem={({item}) => (
                            <TouchableOpacity style={styles.patientCard} onPress={() => handleSelectPatient(item)}>
                                <Text style={styles.patientName}>{item.name}</Text>
                                <Text style={styles.patientMeta}>Phone: {item.phone} | Dues: ₹{item.pendingDues || 0}</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20}}>No patients found.</Text>}
                    />
                </>
            ) : (
                <FlatList
                    ListHeaderComponent={<>
                        <View style={styles.activePatientCard}>
                            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                                <Text style={styles.patientName}>{selectedPatient.name}</Text>
                                <TouchableOpacity onPress={() => setSelectedPatient(null)}><Text style={{color: 'red'}}>Close</Text></TouchableOpacity>
                            </View>
                            <Text style={styles.patientMeta}>Phone: {selectedPatient.phone}</Text>
                            <Text style={styles.grandTotalText}>Total Pending Dues: ₹{grandTotal}</Text>
                        </View>
                    </>}
                    data={[
                        { title: 'Appointments', items: pendingAppointments, getDesc: i => `${i.doctorName || 'Consultation'}`, getAmt: i => i.amount },
                        { title: 'Lab Reports', items: pendingLab, getDesc: i => i.testNames?.join(', '), getAmt: i => i.amount },
                        { title: 'Pharmacy', items: pendingPharmacy, getDesc: i => 'Medicines', getAmt: i => i.totalAmount },
                        { title: 'Facilities', items: pendingFacilities, getDesc: i => `${i.facilityName} (${i.days} days)`, getAmt: i => i.totalAmount },
                        { title: 'Admissions', items: pendingAdmissions, getDesc: i => `${i.ward} Bed ${i.bedNumber}`, getAmt: i => i.totalAmount },
                    ].filter(sec => sec.items.length > 0)}
                    keyExtractor={item => item.title}
                    renderItem={({item}) => (
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionTitle}>{item.title}</Text>
                            {item.items.map(subItem => (
                                <View key={subItem._id} style={styles.billRow}>
                                    <Text style={{flex: 1}}>{item.getDesc(subItem)}</Text>
                                    <Text style={styles.billAmt}>₹{item.getAmt(subItem)}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                    ListFooterComponent={grandTotal > 0 ? (
                        <View style={styles.paymentSection}>
                            <Text style={styles.sectionTitle}>Settle Payment</Text>
                            <View style={{flexDirection: 'row', gap: 10, marginVertical: 10}}>
                                {['Cash', 'Card', 'UPI'].map(mode => (
                                    <TouchableOpacity key={mode} style={[styles.modeBtn, paymentMode === mode && styles.activeMode]} onPress={() => setPaymentMode(mode)}>
                                        <Text style={{color: paymentMode === mode ? 'white' : 'black'}}>{mode}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <TouchableOpacity style={styles.payBtn} onPress={handlePayment} disabled={processing}>
                                <Text style={{color: 'white', fontWeight: 'bold', textAlign: 'center'}}>
                                    {processing ? 'Processing...' : `Confirm Payment of ₹${grandTotal}`}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : <Text style={{textAlign: 'center', marginTop: 20, color: 'green', fontWeight: 'bold'}}>No outstanding dues.</Text>}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
    header: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#0f172a' },
    searchInput: { borderWidth: 1, borderColor: '#cbd5e1', padding: 12, borderRadius: 8, backgroundColor: 'white', marginBottom: 16 },
    patientCard: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 10, elevation: 1 },
    patientName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    patientMeta: { fontSize: 14, color: '#64748b', marginTop: 4 },
    activePatientCard: { backgroundColor: '#eff6ff', padding: 16, borderRadius: 8, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#3b82f6' },
    grandTotalText: { fontSize: 18, fontWeight: 'bold', color: '#ef4444', marginTop: 10 },
    sectionCard: { backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 12, elevation: 1 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#334155' },
    billRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    billAmt: { fontWeight: 'bold', color: '#ef4444' },
    paymentSection: { backgroundColor: '#e0f2fe', padding: 16, borderRadius: 8, marginTop: 10 },
    modeBtn: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#3b82f6', borderRadius: 6, alignItems: 'center' },
    activeMode: { backgroundColor: '#3b82f6' },
    payBtn: { backgroundColor: '#10b981', padding: 14, borderRadius: 8, marginTop: 10 }
});

export default CashierDashboard;
