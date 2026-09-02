import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { billingAPI } from '../../utils/api';

const PatientBillingProfile = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const [searchQuery, setSearchQuery] = useState(route.params?.q || '');
    const [patient, setPatient] = useState(null);
    const [billing, setBilling] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const userStr = await AsyncStorage.getItem('user');
            if (!userStr) { navigation.navigate('Login'); return; }
        };
        checkAuth();
        if (searchQuery) handleSearch();
    }, []);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            const res = await billingAPI.getPatientBills(searchQuery.trim());
            if (res.success) {
                setPatient(res.patient);
                setBilling(res.billing);
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Patient not found');
            setPatient(null); setBilling(null);
        } finally {
            setLoading(false);
        }
    };

    const isPaid = (s) => s && s.toLowerCase() === 'paid';
    const fmt = (n) => `₹${n || 0}`;

    const grandTotal = () => {
        if (!billing) return 0;
        let t = 0;
        billing.appointments?.forEach(a => t += (Number(a.amount) || 0));
        billing.labReports?.forEach(l => t += (Number(l.amount || l.price) || 0));
        billing.pharmacyOrders?.forEach(p => t += (Number(p.totalAmount) || 0));
        billing.facilityCharges?.forEach(f => t += (Number(f.totalAmount) || 0));
        billing.admissions?.forEach(a => t += (Number(a.totalAmount) || 0));
        billing.surgeryPlans?.forEach(s => t += (Number(s.surgeryCost) || 0));
        return t;
    };

    const totalPaid = () => {
        if (!billing) return 0;
        let t = 0;
        billing.appointments?.filter(a => isPaid(a.paymentStatus)).forEach(a => t += (Number(a.amount) || 0));
        billing.labReports?.filter(l => isPaid(l.paymentStatus)).forEach(l => t += (Number(l.amount || l.price) || 0));
        billing.pharmacyOrders?.filter(p => isPaid(p.paymentStatus)).forEach(p => t += (Number(p.totalAmount) || 0));
        billing.facilityCharges?.filter(f => isPaid(f.paymentStatus)).forEach(f => t += (Number(f.totalAmount) || 0));
        billing.admissions?.forEach(a => t += (Number(a.paidAmount) || 0));
        billing.surgeryPlans?.forEach(s => t += (Number(s.paidAmount) || 0));
        return t;
    };

    const sections = [];
    if (billing) {
        if (billing.appointments?.length) sections.push({ title: 'Appointments', data: billing.appointments, getAmt: a => a.amount });
        if (billing.labReports?.length) sections.push({ title: 'Lab Reports', data: billing.labReports, getAmt: l => l.amount || l.price });
        if (billing.pharmacyOrders?.length) sections.push({ title: 'Pharmacy', data: billing.pharmacyOrders, getAmt: p => p.totalAmount });
        if (billing.facilityCharges?.length) sections.push({ title: 'ICU / Facilities', data: billing.facilityCharges, getAmt: f => f.totalAmount });
        if (billing.admissions?.length) sections.push({ title: 'Admissions', data: billing.admissions, getAmt: a => a.totalAmount });
        if (billing.surgeryPlans?.length) sections.push({ title: 'Surgeries', data: billing.surgeryPlans, getAmt: s => s.surgeryCost });
    }

    return (
        <View style={styles.container}>
            <View style={styles.searchBox}>
                <TextInput style={styles.input} placeholder="Search MRN/Phone..." value={searchQuery} onChangeText={setSearchQuery} />
                <TouchableOpacity style={styles.btn} onPress={handleSearch}><Text style={styles.btnText}>Search</Text></TouchableOpacity>
            </View>

            {loading ? <Text style={{ textAlign: 'center', marginTop: 20 }}>Loading bills...</Text> : patient && billing && (
                <FlatList
                    ListHeaderComponent={
                        <View style={styles.patientCard}>
                            <Text style={styles.pName}>{patient.name}</Text>
                            <Text style={styles.pMeta}>MRN: {patient.mrn || 'N/A'} | Phone: {patient.phone}</Text>
                            <View style={styles.summaryBox}>
                                <Text style={styles.totalText}>Grand Total: {fmt(grandTotal())}</Text>
                                <Text style={styles.paidText}>Paid: {fmt(totalPaid())}</Text>
                                <Text style={styles.dueText}>Due: {fmt(grandTotal() - totalPaid())}</Text>
                            </View>
                        </View>
                    }
                    data={sections}
                    keyExtractor={item => item.title}
                    renderItem={({ item }) => (
                        <View style={styles.sectionCard}>
                            <Text style={styles.secTitle}>{item.title}</Text>
                            {item.data.map((row, idx) => (
                                <View key={idx} style={styles.row}>
                                    <View>
                                        <Text style={{ fontWeight: 'bold' }}>{fmtDate(row.createdAt || row.appointmentDate)}</Text>
                                        <Text style={{ fontSize: 12, color: '#64748b' }}>Status: {row.paymentStatus || row.status || 'Pending'}</Text>
                                    </View>
                                    <Text style={{ fontWeight: 'bold', color: isPaid(row.paymentStatus) ? '#16a34a' : '#ef4444' }}>
                                        {fmt(item.getAmt(row))}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                />
            )}
        </View>
    );
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '';

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
    searchBox: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    input: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, backgroundColor: 'white' },
    btn: { backgroundColor: '#3b82f6', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 8 },
    btnText: { color: 'white', fontWeight: 'bold' },
    patientCard: { backgroundColor: '#0f766e', padding: 20, borderRadius: 12, marginBottom: 16 },
    pName: { color: 'white', fontSize: 22, fontWeight: 'bold' },
    pMeta: { color: '#ccfbf1', fontSize: 14, marginTop: 4 },
    summaryBox: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 8, marginTop: 12 },
    totalText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    paidText: { color: '#86efac', fontWeight: 'bold', marginTop: 4 },
    dueText: { color: '#fca5a5', fontWeight: 'bold', marginTop: 4 },
    sectionCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, elevation: 1 },
    secTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc' }
});

export default PatientBillingProfile;
