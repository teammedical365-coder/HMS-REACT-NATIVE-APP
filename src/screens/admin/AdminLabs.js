import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, Alert, ActivityIndicator, Switch, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { adminEntitiesAPI } from '../../utils/api';

const AdminLabs = () => {
    const navigation = useNavigation();
    const [labs, setLabs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingLab, setEditingLab] = useState(null);

    const initialAvailability = {
        monday: { available: false, startTime: '09:00', endTime: '17:00' }, tuesday: { available: false, startTime: '09:00', endTime: '17:00' },
        wednesday: { available: false, startTime: '09:00', endTime: '17:00' }, thursday: { available: false, startTime: '09:00', endTime: '17:00' },
        friday: { available: false, startTime: '09:00', endTime: '17:00' }, saturday: { available: false, startTime: '09:00', endTime: '17:00' },
        sunday: { available: false, startTime: '09:00', endTime: '17:00' }
    };

    const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', password: '', services: '', description: '', facilities: '', availability: initialAvailability });
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    useEffect(() => {
        const checkAuth = async () => {
            const userStr = await AsyncStorage.getItem('user');
            if (!userStr) { navigation.navigate('Login'); return; }
            const user = JSON.parse(userStr);
            if (!['superadmin', 'centraladmin', 'admin'].includes(user.role)) {
                Alert.alert('Unauthorized', 'Access denied.');
                navigation.navigate('Home');
            }
        };
        checkAuth();
        fetchLabs();
    }, []);

    const fetchLabs = async () => {
        try {
            setLoadingData(true);
            const res = await adminEntitiesAPI.getLabs();
            if (res.success) setLabs(res.labs);
        } catch (err) { setError('Error fetching labs'); } 
        finally { setLoadingData(false); }
    };

    const handleChange = (name, value) => { setFormData(prev => ({ ...prev, [name]: value })); setError(''); setSuccess(''); };

    const handleAvailability = (day, field, value) => {
        setFormData(prev => ({
            ...prev, availability: { ...prev.availability, [day]: { ...prev.availability[day], [field]: value } }
        }));
    };

    const handleSubmit = async () => {
        setLoading(true); setError(''); setSuccess('');
        try {
            const payload = { ...formData, services: formData.services.split('\n').filter(s=>s.trim()), facilities: formData.facilities.split('\n').filter(f=>f.trim()) };
            if (editingLab) {
                const res = await adminEntitiesAPI.updateLab(editingLab._id, payload);
                if (res.success) { setSuccess('Lab updated'); setShowForm(false); fetchLabs(); }
            } else {
                if (!formData.name || !formData.email || !formData.password) return setError('Name, email, and password required');
                const res = await adminEntitiesAPI.createLab(payload);
                if (res.success) { setSuccess('Lab created'); setShowForm(false); fetchLabs(); }
            }
        } catch (err) { setError(err.response?.data?.message || 'Error saving lab'); } 
        finally { setLoading(false); }
    };

    const handleEdit = (lab) => {
        setEditingLab(lab);
        setFormData({
            name: lab.name, email: lab.email, phone: lab.phone || '', address: lab.address || '',
            password: '', services: lab.services?.join('\n') || '', facilities: lab.facilities?.join('\n') || '',
            description: lab.description || '', availability: lab.availability || initialAvailability
        });
        setShowForm(true);
    };

    const handleDelete = (id) => {
        Alert.alert('Delete', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                    const res = await adminEntitiesAPI.deleteLab(id);
                    if (res.success) { setSuccess('Deleted'); fetchLabs(); }
                } catch (err) { setError('Error deleting'); }
            }}
        ]);
    };

    const renderDayForm = ({ item: day }) => (
        <View style={styles.dayRow}>
            <View style={styles.dayToggle}>
                <Switch value={formData.availability[day].available} onValueChange={(v) => handleAvailability(day, 'available', v)} />
                <Text style={styles.dayText}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
            </View>
            {formData.availability[day].available && (
                <View style={styles.timeInputs}>
                    <TextInput style={styles.timeInput} value={formData.availability[day].startTime} onChangeText={(v) => handleAvailability(day, 'startTime', v)} placeholder="09:00" />
                    <Text> to </Text>
                    <TextInput style={styles.timeInput} value={formData.availability[day].endTime} onChangeText={(v) => handleAvailability(day, 'endTime', v)} placeholder="17:00" />
                </View>
            )}
        </View>
    );

    const renderLabItem = ({ item }) => (
        <View style={styles.listItem}>
            <View style={styles.listInfo}>
                <Text style={styles.listName}>{item.name}</Text>
                <Text style={styles.listSub}>{item.email} | {item.phone}</Text>
            </View>
            <View style={styles.listActions}>
                <TouchableOpacity onPress={() => handleEdit(item)} style={styles.editBtn}><Text style={styles.actionText}>Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.deleteBtn}><Text style={styles.actionText}>Del</Text></TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View><Text style={styles.title}>Manage Labs</Text></View>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => { setEditingLab(null); setFormData({ name: '', email: '', phone: '', address: '', password: '', services: '', description: '', facilities: '', availability: initialAvailability }); setShowForm(true); }}>
                    <Text style={styles.btnText}>+ Add</Text>
                </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {success ? <Text style={styles.successText}>{success}</Text> : null}

            <Modal visible={showForm} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingLab ? 'Edit Lab' : 'Add Lab'}</Text>
                            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={styles.closeText}>×</Text></TouchableOpacity>
                        </View>
                        <FlatList
                            data={['form']}
                            keyExtractor={(i)=>i}
                            style={styles.modalBody}
                            renderItem={() => (
                                <>
                                    <Text style={styles.label}>Lab Name *</Text>
                                    <TextInput style={styles.input} value={formData.name} onChangeText={(v) => handleChange('name', v)} />
                                    <Text style={styles.label}>Email *</Text>
                                    <TextInput style={styles.input} value={formData.email} onChangeText={(v) => handleChange('email', v)} autoCapitalize="none" keyboardType="email-address" />
                                    <Text style={styles.label}>Phone</Text>
                                    <TextInput style={styles.input} value={formData.phone} onChangeText={(v) => handleChange('phone', v)} keyboardType="phone-pad" maxLength={10} />
                                    <Text style={styles.label}>Address</Text>
                                    <TextInput style={styles.input} value={formData.address} onChangeText={(v) => handleChange('address', v)} />
                                    <Text style={styles.label}>{editingLab ? 'New Password (Optional)' : 'Password *'}</Text>
                                    <TextInput style={styles.input} value={formData.password} onChangeText={(v) => handleChange('password', v)} secureTextEntry />
                                    
                                    <Text style={styles.label}>Services (one per line)</Text>
                                    <TextInput style={[styles.input, {height: 80}]} multiline value={formData.services} onChangeText={(v) => handleChange('services', v)} placeholder="Blood Test\nUrine Test" />
                                    <Text style={styles.label}>Facilities (one per line)</Text>
                                    <TextInput style={[styles.input, {height: 80}]} multiline value={formData.facilities} onChangeText={(v) => handleChange('facilities', v)} />
                                    
                                    <Text style={styles.label}>Availability</Text>
                                    <FlatList
                                        data={days}
                                        keyExtractor={(day) => day}
                                        renderItem={renderDayForm}
                                        scrollEnabled={false}
                                    />
                                    
                                    <TouchableOpacity style={[styles.submitBtn, {marginTop: 20}]} onPress={handleSubmit} disabled={loading}>
                                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save</Text>}
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
                                    <View style={{height: 20}} />
                                </>
                            )}
                        />
                    </View>
                </View>
            </Modal>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>All Labs</Text>
                {loadingData ? <ActivityIndicator size="large" /> : (
                    <FlatList
                        data={labs}
                        keyExtractor={item => item._id}
                        renderItem={renderLabItem}
                        contentContainerStyle={{ paddingBottom: 40 }}
                    />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 22, fontWeight: 'bold' },
    primaryBtn: { backgroundColor: '#3b82f6', padding: 8, borderRadius: 8 },
    btnText: { color: '#fff', fontWeight: '600' },
    errorText: { color: '#ef4444', marginBottom: 12 },
    successText: { color: '#22c55e', marginBottom: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
    modalContent: { backgroundColor: '#fff', borderRadius: 12, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#e2e8f0' },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    closeText: { fontSize: 24, color: '#64748b' },
    modalBody: { padding: 16 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, marginBottom: 12, textAlignVertical: 'top' },
    dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f1f5f9' },
    dayToggle: { flexDirection: 'row', alignItems: 'center', width: 120 },
    dayText: { marginLeft: 8, fontSize: 14 },
    timeInputs: { flexDirection: 'row', alignItems: 'center' },
    timeInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 6, width: 60, textAlign: 'center' },
    submitBtn: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 8, alignItems: 'center' },
    submitBtnText: { color: '#fff', fontWeight: 'bold' },
    cancelBtn: { padding: 14, alignItems: 'center' },
    cancelBtnText: { color: '#64748b', fontWeight: '600' },
    card: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    listItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
    listInfo: { flex: 1 },
    listName: { fontSize: 16, fontWeight: '600' },
    listSub: { fontSize: 13, color: '#64748b' },
    listActions: { flexDirection: 'row' },
    editBtn: { backgroundColor: '#e0f2fe', padding: 6, borderRadius: 6, marginRight: 8 },
    deleteBtn: { backgroundColor: '#fee2e2', padding: 6, borderRadius: 6 },
    actionText: { fontWeight: '600', fontSize: 13 }
});

export default AdminLabs;
