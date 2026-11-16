import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { freeOpdAPI } from '../../utils/api';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const PatientMonitoring = () => {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Register Modal
    const [regModalOpen, setRegModalOpen] = useState(false);
    const [regForm, setRegForm] = useState({
        name: '',
        phone: '',
        age: '',
        gender: 'Male',
        bloodGroup: '',
        address: ''
    });
    const [registering, setRegistering] = useState(false);

    // Patient Overview Modal
    const [selectedPt, setSelectedPt] = useState(null);
    const [ptOverview, setPtOverview] = useState(null);
    const [loadingOverview, setLoadingOverview] = useState(false);
    const [overviewModalOpen, setOverviewModalOpen] = useState(false);

    const loadPatients = useCallback(async () => {
        setLoading(true);
        try {
            const res = await freeOpdAPI.searchPatients({ q: searchQuery });
            setPatients(res?.patients || res?.data || []);
        } catch (err) {
            console.error('Error fetching patients:', err);
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    useEffect(() => {
        loadPatients();
    }, [loadPatients]);

    const handleRegisterPatient = async () => {
        if (!regForm.name.trim() || !regForm.phone.trim()) {
            Alert.alert('Validation', 'Patient name and phone number are required.');
            return;
        }

        setRegistering(true);
        try {
            await freeOpdAPI.registerPatient({
                name: regForm.name.trim(),
                phone: regForm.phone.trim(),
                age: Number(regForm.age) || undefined,
                gender: regForm.gender,
                bloodGroup: regForm.bloodGroup,
                address: regForm.address.trim()
            });
            Alert.alert('Success', 'Patient registered successfully.');
            setRegModalOpen(false);
            setRegForm({ name: '', phone: '', age: '', gender: 'Male', bloodGroup: '', address: '' });
            loadPatients();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to register patient.');
        } finally {
            setRegistering(false);
        }
    };

    const handleOpenOverview = async (pt) => {
        setSelectedPt(pt);
        setOverviewModalOpen(true);
        setLoadingOverview(true);
        try {
            const res = await freeOpdAPI.getPatientOverview(pt._id);
            setPtOverview(res?.overview || res?.data || null);
        } catch (err) {
            console.error('Error loading overview:', err);
        } finally {
            setLoadingOverview(false);
        }
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(item.name || 'P')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.ptName}>{item.name}</Text>
                    <Text style={styles.ptMeta}>
                        {item.phone || 'No phone'} • {item.age ? `${item.age}y` : ''} • {item.gender || '—'}
                    </Text>
                    {item.bloodGroup ? <Text style={styles.ptBloodGroup}>Blood: {item.bloodGroup}</Text> : null}
                </View>
                <TouchableOpacity style={styles.viewBtn} onPress={() => handleOpenOverview(item)}>
                    <Feather name="eye" size={13} color="#0d9488" />
                    <Text style={styles.viewBtnText}>History</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Patient Monitoring Desk</Text>
                    <Text style={styles.subtitle}>Patient Directory &amp; Longitudinal History</Text>
                </View>
                <TouchableOpacity style={styles.regBtn} onPress={() => setRegModalOpen(true)}>
                    <Feather name="user-plus" size={14} color="#ffffff" />
                    <Text style={styles.regBtnText}>New Patient</Text>
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchBar}>
                <Feather name="search" size={16} color="#94a3b8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by patient name, mobile, or UHID..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.centerLoading}>
                    <ActivityIndicator size="large" color="#0d9488" />
                    <Text style={styles.loadingText}>Searching patients...</Text>
                </View>
            ) : (
                <FlatList
                    data={patients}
                    keyExtractor={item => item._id || String(Math.random())}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Feather name="users" size={40} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No patients found matching query.</Text>
                        </View>
                    }
                />
            )}

            {/* Register Patient Modal */}
            <Modal visible={regModalOpen} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Register New Patient</Text>
                            <TouchableOpacity onPress={() => setRegModalOpen(false)}>
                                <Feather name="x" size={20} color="#475569" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ padding: 16 }}>
                            <Text style={styles.inputLabel}>Full Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Patient Full Name"
                                value={regForm.name}
                                onChangeText={v => setRegForm(p => ({ ...p, name: v }))}
                            />
                            <Text style={styles.inputLabel}>Mobile Phone *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="10-digit mobile number"
                                keyboardType="phone-pad"
                                value={regForm.phone}
                                onChangeText={v => setRegForm(p => ({ ...p, phone: v }))}
                            />
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Age</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Age (yrs)"
                                        keyboardType="numeric"
                                        value={regForm.age}
                                        onChangeText={v => setRegForm(p => ({ ...p, age: v }))}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Blood Group</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. B+"
                                        value={regForm.bloodGroup}
                                        onChangeText={v => setRegForm(p => ({ ...p, bloodGroup: v }))}
                                    />
                                </View>
                            </View>
                            <Text style={styles.inputLabel}>Gender</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                {['Male', 'Female', 'Other'].map(g => (
                                    <TouchableOpacity
                                        key={g}
                                        style={[styles.genderChip, regForm.gender === g && styles.genderChipActive]}
                                        onPress={() => setRegForm(p => ({ ...p, gender: g }))}
                                    >
                                        <Text style={[styles.genderChipText, regForm.gender === g && styles.genderChipTextActive]}>{g}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={styles.inputLabel}>Residential Address</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="City / Address"
                                value={regForm.address}
                                onChangeText={v => setRegForm(p => ({ ...p, address: v }))}
                            />

                            <TouchableOpacity
                                style={[styles.submitBtn, registering && styles.submitBtnDisabled]}
                                onPress={handleRegisterPatient}
                                disabled={registering}
                            >
                                <Text style={styles.submitBtnText}>{registering ? 'Registering...' : 'Register Patient'}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Patient Overview Modal */}
            <Modal visible={overviewModalOpen} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>{selectedPt?.name || 'Patient'}</Text>
                                <Text style={styles.modalSubtitle}>{selectedPt?.phone} • {selectedPt?.age ? `${selectedPt.age}y` : ''}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setOverviewModalOpen(false)}>
                                <Feather name="x" size={20} color="#475569" />
                            </TouchableOpacity>
                        </View>
                        {loadingOverview ? (
                            <View style={styles.centerLoading}>
                                <ActivityIndicator size="large" color="#0d9488" />
                            </View>
                        ) : (
                            <ScrollView style={{ padding: 16 }}>
                                <Text style={styles.sectionHeader}>Past Consultations &amp; Visits</Text>
                                {(ptOverview?.consultations || []).length === 0 ? (
                                    <Text style={styles.emptyNotice}>No previous consultations on record.</Text>
                                ) : (
                                    (ptOverview?.consultations || []).map((c, i) => (
                                        <View key={i} style={styles.consultCard}>
                                            <Text style={styles.consultDate}>{new Date(c.date || c.appointmentDate).toLocaleDateString('en-IN')}</Text>
                                            <Text style={styles.consultDiagnosis}>Diagnosis: {c.diagnosis || 'Clinical Consult'}</Text>
                                            {c.pharmacy?.length ? (
                                                <Text style={styles.consultMeds}>Meds: {c.pharmacy.map(m => m.medicineName).join(', ')}</Text>
                                            ) : null}
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 10,
        backgroundColor: '#ffffff',
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    regBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#0d9488',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    regBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        marginHorizontal: 16,
        marginVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        gap: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 8,
        fontSize: 13,
        color: '#0f172a',
    },
    listContent: {
        padding: 16,
        paddingBottom: 30,
    },
    centerLoading: {
        paddingVertical: 48,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 13,
        color: '#94a3b8',
        marginTop: 10,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        marginBottom: 8,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#ccfbf1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f766e',
    },
    ptName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    ptMeta: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    ptBloodGroup: {
        fontSize: 10,
        fontWeight: '700',
        color: '#b91c1c',
        marginTop: 2,
    },
    viewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f0fdfa',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#99f6e4',
    },
    viewBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0d9488',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'flex-end',
    },
    modalBox: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    modalSubtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 4,
        marginTop: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
    },
    genderChip: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    genderChipActive: {
        backgroundColor: '#0d9488',
        borderColor: '#0d9488',
    },
    genderChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    genderChipTextActive: {
        color: '#ffffff',
    },
    submitBtn: {
        backgroundColor: '#0d9488',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 20,
    },
    submitBtnDisabled: {
        backgroundColor: '#94a3b8',
    },
    submitBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    sectionHeader: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 10,
    },
    consultCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 10,
        marginBottom: 8,
    },
    consultDate: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0d9488',
    },
    consultDiagnosis: {
        fontSize: 12,
        fontWeight: '600',
        color: '#0f172a',
        marginTop: 2,
    },
    consultMeds: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    emptyNotice: {
        fontSize: 12,
        color: '#94a3b8',
        paddingVertical: 14,
        textAlign: 'center',
    },
});

export default PatientMonitoring;

