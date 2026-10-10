import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { medicineAPI } from '../../utils/api';
import { fetchSuperAdminMedicines } from '../../services/offline/offlineSuperAdminService';
import { subscribeNetworkStatus } from '../../services/offline/networkStatus';
import OfflineBanner from '../../components/OfflineBanner';
import OfflineEmptyState from '../../components/OfflineEmptyState';

const AdminMedicines = () => {
    const [medicines, setMedicines] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [offlineState, setOfflineState] = useState({
        isOffline: false,
        fromCache: false,
        lastFetchedAt: null,
        isSynthetic: false,
        noCache: false,
    });
    const [refreshing, setRefreshing] = useState(false);

    const [formData, setFormData] = useState({ name: '', genericName: '', description: '', category: 'General' });

    const fetchMedicines = async () => {
        try {
            setLoading(true);
            const res = await fetchSuperAdminMedicines({
                onCacheHit: (cached) => {
                    if (Array.isArray(cached?.data)) {
                        setMedicines(cached.data);
                        setOfflineState(prev => ({
                            ...prev,
                            fromCache: true,
                            lastFetchedAt: cached.lastFetchedAt,
                            isSynthetic: cached.isSynthetic,
                            noCache: false,
                        }));
                    }
                }
            });
            if (res.success && Array.isArray(res.data)) {
                setMedicines(res.data);
                setOfflineState({
                    isOffline: Boolean(res.isOffline),
                    fromCache: Boolean(res.fromCache),
                    lastFetchedAt: res.lastFetchedAt,
                    isSynthetic: Boolean(res.isSynthetic),
                    noCache: false,
                });
            } else if (res.noCache) {
                setOfflineState({
                    isOffline: true,
                    fromCache: false,
                    lastFetchedAt: null,
                    isSynthetic: false,
                    noCache: true,
                });
            }
        } catch (err) {
            setError('Failed to fetch medicines.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { 
        fetchMedicines(); 
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeNetworkStatus((netState) => {
            if (netState.isOnline) {
                fetchMedicines();
            } else {
                setOfflineState(prev => ({ ...prev, isOffline: true }));
            }
        });
        return unsubscribe;
    }, []);

    const handleChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        setError(''); setSuccess('');
    };

    const handleSubmit = async () => {
        setLoading(true); setError(''); setSuccess('');
        try {
            if (editingId) {
                const res = await medicineAPI.updateMedicine(editingId, formData);
                if (res.success) setSuccess('Medicine updated successfully!');
            } else {
                const res = await medicineAPI.createMedicine(formData);
                if (res.success) setSuccess('Medicine created successfully!');
            }
            setShowForm(false); setEditingId(null); fetchMedicines();
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving medicine.');
        } finally { setLoading(false); }
    };

    const handleEdit = (medicine) => {
        setFormData({
            name: medicine.name,
            genericName: medicine.genericName || '',
            description: medicine.description || '',
            category: medicine.category || 'General'
        });
        setEditingId(medicine._id); setShowForm(true);
    };

    const handleDelete = (id) => {
        Alert.alert('Delete Medicine', 'Are you sure you want to delete this medicine?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        const res = await medicineAPI.deleteMedicine(id);
                        if (res.success) { setSuccess('Medicine deleted.'); fetchMedicines(); }
                    } catch (err) { setError(err.response?.data?.message || 'Error deleting medicine.'); }
                }
            }
        ]);
    };

    return (
        <ScrollView 
            style={styles.container}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                        setRefreshing(true);
                        fetchMedicines();
                    }}
                    colors={['#2563eb']}
                    tintColor="#2563eb"
                />
            }
        >
            <OfflineBanner
                isOffline={offlineState.isOffline}
                fromCache={offlineState.fromCache}
                lastFetchedAt={offlineState.lastFetchedAt}
                isSynthetic={offlineState.isSynthetic}
                onRetry={() => {
                    setRefreshing(true);
                    fetchMedicines();
                }}
                retrying={refreshing || loading}
            />
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Medicine Catalog</Text>
                    <Text style={styles.subtitle}>Manage global medicines</Text>
                </View>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => { setShowForm(true); setEditingId(null); setFormData({ name: '', genericName: '', description: '', category: 'General' }); }}>
                    <Text style={styles.btnText}>+ Add</Text>
                </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {success ? <Text style={styles.successText}>{success}</Text> : null}

            <Modal visible={showForm} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingId ? 'Edit Medicine' : 'Add Medicine'}</Text>
                            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={styles.closeText}>×</Text></TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.label}>Medicine Name *</Text>
                            <TextInput style={styles.input} value={formData.name} onChangeText={(v) => handleChange('name', v)} placeholder="e.g. Paracetamol 500mg" />
                            
                            <Text style={styles.label}>Generic Name</Text>
                            <TextInput style={styles.input} value={formData.genericName} onChangeText={(v) => handleChange('genericName', v)} placeholder="e.g. Acetaminophen" />
                            
                            <Text style={styles.label}>Category</Text>
                            <TextInput style={styles.input} value={formData.category} onChangeText={(v) => handleChange('category', v)} placeholder="e.g. Analgesic" />
                            
                            <Text style={styles.label}>Description</Text>
                            <TextInput style={[styles.input, { height: 80 }]} value={formData.description} onChangeText={(v) => handleChange('description', v)} multiline placeholder="Instructions..." />
                            
                            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Medicine</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Available Medicines</Text>
                {loading && !medicines.length ? (
                    <ActivityIndicator size="large" />
                ) : medicines.length === 0 ? (
                    offlineState.noCache ? (
                        <OfflineEmptyState 
                            title="No Cached Medicines"
                            message="No offline medicines are cached on this device. Connect to the internet and tap Retry to synchronize."
                            onRetry={() => {
                                setRefreshing(true);
                                fetchMedicines();
                            }}
                            retrying={refreshing || loading}
                        />
                    ) : (
                        <Text style={styles.emptyText}>No medicines defined yet.</Text>
                    )
                ) : (
                    medicines.map(med => (
                        <View key={med._id} style={styles.listItem}>
                            <View style={styles.listInfo}>
                                <Text style={styles.listName}>{med.name}</Text>
                                <Text style={styles.listSub}>{med.category} | {med.genericName || '-'}</Text>
                            </View>
                            <View style={styles.listActions}>
                                <TouchableOpacity onPress={() => handleEdit(med)} style={styles.editBtn}><Text style={styles.actionText}>Edit</Text></TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(med._id)} style={styles.deleteBtn}><Text style={styles.actionText}>Del</Text></TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
    subtitle: { fontSize: 14, color: '#64748b' },
    primaryBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    btnText: { color: '#fff', fontWeight: '600' },
    errorText: { color: '#ef4444', marginBottom: 12 },
    successText: { color: '#22c55e', marginBottom: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
    modalContent: { backgroundColor: '#fff', borderRadius: 12, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    closeText: { fontSize: 24, color: '#64748b', marginTop: -5 },
    modalBody: { padding: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, marginBottom: 16, backgroundColor: '#fff' },
    submitBtn: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
    submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    cancelBtn: { padding: 14, alignItems: 'center' },
    cancelBtnText: { color: '#64748b', fontWeight: '600' },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    emptyText: { textAlign: 'center', color: '#64748b', padding: 20 },
    listItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
    listInfo: { flex: 1 },
    listName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
    listSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
    listActions: { flexDirection: 'row', alignItems: 'center' },
    editBtn: { backgroundColor: '#e0f2fe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginRight: 8 },
    deleteBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    actionText: { fontWeight: '600', fontSize: 13, color: '#475569' }
});

export default AdminMedicines;
