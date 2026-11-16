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
    Modal
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { freeOpdAPI } from '../../utils/api';

const STATUS_FILTERS = ['ALL', 'Scheduled', 'In Consultation', 'Completed', 'Cancelled'];

const AppointmentManagement = () => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Book Appointment Modal
    const [bookModalOpen, setBookModalOpen] = useState(false);
    const [bookForm, setBookForm] = useState({
        name: '',
        phone: '',
        age: '',
        gender: 'Male',
        timeSlot: '10:00 AM',
        visitType: 'New Consultation',
        fee: '500',
        paymentMode: 'Cash'
    });
    const [booking, setBooking] = useState(false);

    // Cancel modal
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [selectedApptId, setSelectedApptId] = useState(null);
    const [cancelReason, setCancelReason] = useState('');

    const loadAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await freeOpdAPI.listAppointments();
            setAppointments(res?.appointments || res?.data || []);
        } catch (err) {
            console.error('Error fetching appointments:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAppointments();
    }, [loadAppointments]);

    const handleBookAppointment = async () => {
        if (!bookForm.name.trim() || !bookForm.phone.trim()) {
            Alert.alert('Validation', 'Patient name and phone number are required.');
            return;
        }

        setBooking(true);
        try {
            await freeOpdAPI.createAppointment({
                patientName: bookForm.name.trim(),
                phone: bookForm.phone.trim(),
                age: bookForm.age.trim(),
                gender: bookForm.gender,
                timeSlot: bookForm.timeSlot,
                visitType: bookForm.visitType,
                fee: Number(bookForm.fee) || 0,
                paymentMode: bookForm.paymentMode,
                appointmentDate: new Date()
            });
            Alert.alert('Success', 'Appointment booked successfully.');
            setBookModalOpen(false);
            setBookForm({
                name: '',
                phone: '',
                age: '',
                gender: 'Male',
                timeSlot: '10:00 AM',
                visitType: 'New Consultation',
                fee: '500',
                paymentMode: 'Cash'
            });
            loadAppointments();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to book appointment.');
        } finally {
            setBooking(false);
        }
    };

    const handleConfirmCancel = async () => {
        if (!selectedApptId) return;
        try {
            await freeOpdAPI.cancelAppointment(selectedApptId, cancelReason || 'Cancelled by doctor');
            setCancelModalOpen(false);
            setSelectedApptId(null);
            setCancelReason('');
            loadAppointments();
        } catch (err) {
            Alert.alert('Error', 'Failed to cancel appointment.');
        }
    };

    const filteredAppointments = appointments.filter(a => {
        const matchesStatus = statusFilter === 'ALL' || (a.status || '').toLowerCase() === statusFilter.toLowerCase();
        const ptName = a.patientId?.name || a.patientName || '';
        const ptPhone = a.patientId?.phone || a.phone || '';
        const matchesQuery = !searchQuery || ptName.toLowerCase().includes(searchQuery.toLowerCase()) || ptPhone.includes(searchQuery);
        return matchesStatus && matchesQuery;
    });

    const renderItem = ({ item }) => {
        const ptName = item.patientId?.name || item.patientName || 'Patient';
        const ptPhone = item.patientId?.phone || item.phone || '';
        const status = item.status || 'Scheduled';
        const isCompleted = status.toLowerCase() === 'completed';
        const isCancelled = status.toLowerCase() === 'cancelled';

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.tokenPill}>
                        <Text style={styles.tokenPillText}>#{item.tokenNumber || '—'}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.ptName}>{ptName}</Text>
                        <Text style={styles.ptMeta}>
                            {item.patientId?.age ? `${item.patientId.age} yrs • ` : ''}{item.patientId?.gender || ''} • {ptPhone}
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, isCompleted ? styles.badgeSuccess : isCancelled ? styles.badgeDanger : styles.badgeDefault]}>
                        <Text style={[styles.statusText, isCompleted ? styles.textSuccess : isCancelled ? styles.textDanger : styles.textDefault]}>
                            {status}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardDetailsRow}>
                    <View style={styles.detailItem}>
                        <Feather name="clock" size={12} color="#64748b" />
                        <Text style={styles.detailText}>{item.timeSlot || 'Anytime'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Feather name="tag" size={12} color="#64748b" />
                        <Text style={styles.detailText}>{item.visitType || 'Consultation'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Feather name="dollar-sign" size={12} color="#64748b" />
                        <Text style={styles.detailText}>₹{item.fee || '500'} ({item.paymentMode || 'Cash'})</Text>
                    </View>
                </View>

                {!isCompleted && !isCancelled && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => {
                                setSelectedApptId(item._id);
                                setCancelModalOpen(true);
                            }}
                        >
                            <Feather name="x-circle" size={13} color="#ef4444" />
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>OPD Appointment Desk</Text>
                    <Text style={styles.subtitle}>Scheduled &amp; Walk-in OPD Patients</Text>
                </View>
                <TouchableOpacity style={styles.bookBtn} onPress={() => setBookModalOpen(true)}>
                    <Feather name="plus" size={15} color="#ffffff" />
                    <Text style={styles.bookBtnText}>Book Appointment</Text>
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBar}>
                <Feather name="search" size={16} color="#94a3b8" />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by patient name or phone..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* Status Filters */}
            <View style={styles.filterRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {STATUS_FILTERS.map(st => (
                        <TouchableOpacity
                            key={st}
                            style={[styles.filterChip, statusFilter === st && styles.filterChipActive]}
                            onPress={() => setStatusFilter(st)}
                        >
                            <Text style={[styles.filterChipText, statusFilter === st && styles.filterChipTextActive]}>
                                {st}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.centerLoading}>
                    <ActivityIndicator size="large" color="#0d9488" />
                    <Text style={styles.loadingText}>Loading appointments...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredAppointments}
                    keyExtractor={item => item._id || String(Math.random())}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Feather name="calendar" size={40} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No appointments found.</Text>
                        </View>
                    }
                />
            )}

            {/* Book Appointment Modal */}
            <Modal visible={bookModalOpen} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Book OPD Appointment</Text>
                            <TouchableOpacity onPress={() => setBookModalOpen(false)}>
                                <Feather name="x" size={20} color="#475569" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ padding: 16 }}>
                            <Text style={styles.inputLabel}>Patient Full Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Ramesh Kumar"
                                value={bookForm.name}
                                onChangeText={v => setBookForm(p => ({ ...p, name: v }))}
                            />

                            <Text style={styles.inputLabel}>Phone Number *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="10-digit mobile number"
                                keyboardType="phone-pad"
                                value={bookForm.phone}
                                onChangeText={v => setBookForm(p => ({ ...p, phone: v }))}
                            />

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Age</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Age (yrs)"
                                        keyboardType="numeric"
                                        value={bookForm.age}
                                        onChangeText={v => setBookForm(p => ({ ...p, age: v }))}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Gender</Text>
                                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                                        {['Male', 'Female'].map(g => (
                                            <TouchableOpacity
                                                key={g}
                                                style={[styles.genderChip, bookForm.gender === g && styles.genderChipActive]}
                                                onPress={() => setBookForm(p => ({ ...p, gender: g }))}
                                            >
                                                <Text style={[styles.genderChipText, bookForm.gender === g && styles.genderChipTextActive]}>{g}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Consultation Fee (₹)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="500"
                                keyboardType="numeric"
                                value={bookForm.fee}
                                onChangeText={v => setBookForm(p => ({ ...p, fee: v }))}
                            />

                            <Text style={styles.inputLabel}>Payment Mode</Text>
                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                                {['Cash', 'UPI', 'Pending'].map(m => (
                                    <TouchableOpacity
                                        key={m}
                                        style={[styles.payChip, bookForm.paymentMode === m && styles.payChipActive]}
                                        onPress={() => setBookForm(p => ({ ...p, paymentMode: m }))}
                                    >
                                        <Text style={[styles.payChipText, bookForm.paymentMode === m && styles.payChipTextActive]}>{m}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.submitBtn, booking && styles.submitBtnDisabled]}
                                onPress={handleBookAppointment}
                                disabled={booking}
                            >
                                {booking ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <Text style={styles.submitBtnText}>Confirm Booking &amp; Issue Token</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Cancel Modal */}
            <Modal visible={cancelModalOpen} transparent animationType="fade">
                <View style={styles.subModalOverlay}>
                    <View style={styles.subModalBox}>
                        <Text style={styles.subModalTitle}>Cancel Appointment</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Reason for cancellation (optional)"
                            value={cancelReason}
                            onChangeText={setCancelReason}
                        />
                        <View style={styles.subModalActions}>
                            <TouchableOpacity style={styles.cancelSubBtn} onPress={() => setCancelModalOpen(false)}>
                                <Text style={styles.cancelSubBtnText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.confirmCancelBtn} onPress={handleConfirmCancel}>
                                <Text style={styles.confirmCancelBtnText}>Confirm Cancel</Text>
                            </TouchableOpacity>
                        </View>
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
    bookBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#0d9488',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    bookBtnText: {
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
    filterRow: {
        paddingHorizontal: 16,
        marginBottom: 8,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 6,
    },
    filterChipActive: {
        backgroundColor: '#0d9488',
        borderColor: '#0d9488',
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    filterChipTextActive: {
        color: '#ffffff',
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
        marginBottom: 10,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tokenPill: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#fef3c7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tokenPillText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#b45309',
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
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    badgeSuccess: { backgroundColor: '#ccfbf1' },
    badgeDanger: { backgroundColor: '#fee2e2' },
    badgeDefault: { backgroundColor: '#f1f5f9' },
    statusText: { fontSize: 10, fontWeight: '700' },
    textSuccess: { color: '#0f766e' },
    textDanger: { color: '#b91c1c' },
    textDefault: { color: '#475569' },
    cardDetailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        fontSize: 11,
        color: '#64748b',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 8,
    },
    cancelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    cancelBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#ef4444',
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
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 4,
        marginTop: 10,
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
    payChip: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    payChipActive: {
        backgroundColor: '#0d9488',
        borderColor: '#0d9488',
    },
    payChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    payChipTextActive: {
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
    subModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    subModalBox: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 16,
    },
    subModalTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 12,
    },
    subModalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 12,
    },
    cancelSubBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    cancelSubBtnText: {
        fontSize: 12,
        color: '#64748b',
    },
    confirmCancelBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: '#ef4444',
    },
    confirmCancelBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
});

export default AppointmentManagement;

