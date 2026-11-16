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

const RevisitSchedule = () => {
    const [revisits, setRevisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState('ALL'); // 'ALL' | 'OVERDUE' | 'TODAY' | 'UPCOMING'

    // Book Modal
    const [bookModalOpen, setBookModalOpen] = useState(false);
    const [selectedRevisit, setSelectedRevisit] = useState(null);
    const [bookTimeSlot, setBookTimeSlot] = useState('10:00 AM');
    const [booking, setBooking] = useState(false);

    const loadRevisits = useCallback(async () => {
        setLoading(true);
        try {
            const res = await freeOpdAPI.getRevisits();
            setRevisits(res?.revisits || res?.data || []);
        } catch (err) {
            console.error('Error fetching revisits:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRevisits();
    }, [loadRevisits]);

    const handleBookAppointment = async () => {
        if (!selectedRevisit) return;
        setBooking(true);
        try {
            await freeOpdAPI.bookRevisitAppointment(selectedRevisit._id, {
                timeSlot: bookTimeSlot,
                appointmentDate: new Date()
            });
            Alert.alert('Success', 'Follow-up appointment booked successfully.');
            setBookModalOpen(false);
            setSelectedRevisit(null);
            loadRevisits();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to book appointment.');
        } finally {
            setBooking(false);
        }
    };

    const todayStr = new Date().toISOString().slice(0, 10);

    const categorizeItem = (item) => {
        const dt = item.followUpDate ? item.followUpDate.slice(0, 10) : '';
        if (!dt) return 'UPCOMING';
        if (dt < todayStr) return 'OVERDUE';
        if (dt === todayStr) return 'TODAY';
        return 'UPCOMING';
    };

    const filteredRevisits = revisits.filter(item => {
        if (filterCategory === 'ALL') return true;
        return categorizeItem(item) === filterCategory;
    });

    const renderItem = ({ item }) => {
        const category = categorizeItem(item);
        const ptName = item.patientId?.name || item.patientName || 'Inpatient';
        const phone = item.patientId?.phone || item.phone || '';
        const followUpDateStr = item.followUpDate ? new Date(item.followUpDate).toLocaleDateString('en-IN') : 'Scheduled';

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.ptInfo}>
                        <Text style={styles.ptName}>{ptName}</Text>
                        <Text style={styles.ptMeta}>{phone} • Initial Consult: {new Date(item.appointmentDate || item.createdAt).toLocaleDateString('en-IN')}</Text>
                    </View>
                    <View style={[styles.badge, category === 'OVERDUE' ? styles.badgeDanger : category === 'TODAY' ? styles.badgeWarning : styles.badgeInfo]}>
                        <Text style={[styles.badgeText, category === 'OVERDUE' ? styles.textDanger : category === 'TODAY' ? styles.textWarning : styles.textInfo]}>
                            {category === 'OVERDUE' ? 'OVERDUE' : category === 'TODAY' ? 'DUE TODAY' : 'UPCOMING'}
                        </Text>
                    </View>
                </View>

                <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>Follow-up Target Date:</Text>
                    <Text style={styles.reasonDate}>{followUpDateStr}</Text>
                    {item.doctorNotes ? <Text style={styles.doctorAdvice}>Advice: {item.doctorNotes}</Text> : null}
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.bookActionBtn}
                        onPress={() => {
                            setSelectedRevisit(item);
                            setBookModalOpen(true);
                        }}
                    >
                        <Feather name="calendar" size={13} color="#ffffff" />
                        <Text style={styles.bookActionBtnText}>Schedule Revisit Token</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Revisit Schedule</Text>
                    <Text style={styles.subtitle}>Patient Follow-ups &amp; Continuity of Care</Text>
                </View>
                <TouchableOpacity style={styles.refreshBtn} onPress={loadRevisits}>
                    <Feather name="refresh-cw" size={16} color="#0d9488" />
                </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterRow}>
                {['ALL', 'TODAY', 'UPCOMING', 'OVERDUE'].map(cat => (
                    <TouchableOpacity
                        key={cat}
                        style={[styles.filterChip, filterCategory === cat && styles.filterChipActive]}
                        onPress={() => setFilterCategory(cat)}
                    >
                        <Text style={[styles.filterChipText, filterCategory === cat && styles.filterChipTextActive]}>
                            {cat}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.centerLoading}>
                    <ActivityIndicator size="large" color="#0d9488" />
                    <Text style={styles.loadingText}>Loading revisits...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredRevisits}
                    keyExtractor={item => item._id || String(Math.random())}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Feather name="clock" size={40} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No revisits scheduled in this view.</Text>
                        </View>
                    }
                />
            )}

            {/* Book Appointment Modal */}
            <Modal visible={bookModalOpen} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Book Revisit Appointment</Text>
                        <Text style={styles.modalSubtitle}>
                            Patient: {selectedRevisit?.patientId?.name || selectedRevisit?.patientName || 'Patient'}
                        </Text>
                        <Text style={styles.inputLabel}>Select Time Slot:</Text>
                        <View style={styles.timeSlotRow}>
                            {['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM', '04:00 PM'].map(s => (
                                <TouchableOpacity
                                    key={s}
                                    style={[styles.slotChip, bookTimeSlot === s && styles.slotChipActive]}
                                    onPress={() => setBookTimeSlot(s)}
                                >
                                    <Text style={[styles.slotChipText, bookTimeSlot === s && styles.slotChipTextActive]}>{s}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setBookModalOpen(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.submitBtn} onPress={handleBookAppointment} disabled={booking}>
                                <Text style={styles.submitBtnText}>{booking ? 'Booking...' : 'Confirm Revisit'}</Text>
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
    refreshBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
    },
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    filterChipActive: {
        backgroundColor: '#0d9488',
        borderColor: '#0d9488',
    },
    filterChipText: {
        fontSize: 11,
        fontWeight: '700',
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
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    ptInfo: {
        flex: 1,
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
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    badgeDanger: { backgroundColor: '#fee2e2' },
    badgeWarning: { backgroundColor: '#fef3c7' },
    badgeInfo: { backgroundColor: '#ccfbf1' },
    badgeText: { fontSize: 10, fontWeight: '700' },
    textDanger: { color: '#b91c1c' },
    textWarning: { color: '#b45309' },
    textInfo: { color: '#0f766e' },
    reasonBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        marginTop: 10,
    },
    reasonLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
    },
    reasonDate: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0d9488',
        marginTop: 2,
    },
    doctorAdvice: {
        fontSize: 11,
        color: '#334155',
        marginTop: 4,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 10,
    },
    bookActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#0d9488',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    bookActionBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalBox: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 18,
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
        marginBottom: 12,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 8,
    },
    timeSlotRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 16,
    },
    slotChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    slotChipActive: {
        backgroundColor: '#0d9488',
        borderColor: '#0d9488',
    },
    slotChipText: {
        fontSize: 11,
        color: '#475569',
        fontWeight: '600',
    },
    slotChipTextActive: {
        color: '#ffffff',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    cancelBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    cancelBtnText: {
        fontSize: 12,
        color: '#64748b',
    },
    submitBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        backgroundColor: '#0d9488',
    },
    submitBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
});

export default RevisitSchedule;

