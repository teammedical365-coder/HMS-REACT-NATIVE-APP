import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, TextInput, 
    StyleSheet, Alert, Dimensions, ActivityIndicator 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { adminEntitiesAPI } from '../../utils/api';
import PasswordInput from '../../components/PasswordInput';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AdminPharmacy = () => {
    const navigation = useNavigation();
    const [pharmacies, setPharmacies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editingPharmacy, setEditingPharmacy] = useState(null);
    const [showForm, setShowForm] = useState(false);
    
    const defaultAvailability = {
        monday: { available: false, startTime: '09:00', endTime: '17:00' },
        tuesday: { available: false, startTime: '09:00', endTime: '17:00' },
        wednesday: { available: false, startTime: '09:00', endTime: '17:00' },
        thursday: { available: false, startTime: '09:00', endTime: '17:00' },
        friday: { available: false, startTime: '09:00', endTime: '17:00' },
        saturday: { available: false, startTime: '09:00', endTime: '17:00' },
        sunday: { available: false, startTime: '09:00', endTime: '17:00' }
    };

    const initialFormState = {
        name: '',
        email: '',
        phone: '',
        address: '',
        password: '',
        availability: defaultAvailability,
        description: '',
        medications: []
    };

    const [formData, setFormData] = useState(initialFormState);
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    useEffect(() => {
        const checkRoleAndFetch = async () => {
            try {
                const userStr = await AsyncStorage.getItem('user');
                const user = userStr ? JSON.parse(userStr) : {};
                if (!['admin', 'hospitaladmin', 'centraladmin', 'superadmin'].includes(user.role)) {
                    navigation.navigate('Home');
                    return;
                }
                fetchPharmacies();
            } catch (err) {
                console.error(err);
            }
        };
        checkRoleAndFetch();
    }, [navigation]);

    const fetchPharmacies = async () => {
        try {
            setLoadingData(true);
            const response = await adminEntitiesAPI.getPharmacies();
            if (response.success) {
                setPharmacies(response.pharmacies);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error fetching pharmacies');
        } finally {
            setLoadingData(false);
        }
    };

    const handleChange = (name, value) => {
        setFormData({ ...formData, [name]: value });
        setError('');
        setSuccess('');
    };

    const handleAvailabilityChange = (day, field, value) => {
        setFormData(prev => ({
            ...prev,
            availability: {
                ...prev.availability,
                [day]: {
                    ...prev.availability[day],
                    [field]: field === 'available' ? value : value
                }
            }
        }));
    };

    const handleSubmit = async () => {
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (editingPharmacy) {
                const response = await adminEntitiesAPI.updatePharmacy(editingPharmacy._id, formData);
                if (response.success) {
                    setSuccess('Pharmacy updated successfully');
                    resetForm();
                    fetchPharmacies();
                }
            } else {
                // Validate required fields
                if (!formData.name || !formData.email) {
                    setError('Name and email are required');
                    setLoading(false);
                    return;
                }

                // Validate password for new pharmacies
                if (!formData.password || formData.password.length < 6) {
                    setError('Password is required and must be at least 6 characters');
                    setLoading(false);
                    return;
                }

                const response = await adminEntitiesAPI.createPharmacy(formData);
                if (response.success) {
                    let successMsg = 'Pharmacy created successfully';
                    if (response.generatedPassword) {
                        successMsg += `. Generated password: ${response.generatedPassword}`;
                    }
                    setSuccess(successMsg);
                    resetForm();
                    fetchPharmacies();
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving pharmacy');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (pharmacy) => {
        setEditingPharmacy(pharmacy);
        setFormData({
            name: pharmacy.name,
            email: pharmacy.email,
            phone: pharmacy.phone || '',
            address: pharmacy.address || '',
            password: '', // Don't show password when editing
            availability: pharmacy.availability || defaultAvailability,
            description: pharmacy.description || '',
            medications: pharmacy.medications || []
        });
        setShowForm(true);
    };

    const handleDelete = (id) => {
        Alert.alert('Confirm Delete', 'Are you sure you want to delete this pharmacy?', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive', 
                onPress: async () => {
                    try {
                        const response = await adminEntitiesAPI.deletePharmacy(id);
                        if (response.success) {
                            setSuccess('Pharmacy deleted successfully');
                            fetchPharmacies();
                        }
                    } catch (err) {
                        setError(err.response?.data?.message || 'Error deleting pharmacy');
                    }
                }
            }
        ]);
    };

    const resetForm = () => {
        setFormData(initialFormState);
        setEditingPharmacy(null);
        setShowForm(false);
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.pageTitle}>Manage Pharmacy</Text>
                        <Text style={styles.pageSubtitle}>Add and manage pharmacy information</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => setShowForm(!showForm)} 
                        style={styles.btnPrimary}
                    >
                        <Text style={styles.btnPrimaryText}>{showForm ? 'Cancel' : '+ Add Pharmacy'}</Text>
                    </TouchableOpacity>
                </View>

                {error ? <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{error}</Text></View> : null}
                {success ? <View style={styles.successBanner}><Text style={styles.successBannerText}>{success}</Text></View> : null}

                {showForm && (
                    <View style={styles.formCard}>
                        <Text style={styles.formCardTitle}>{editingPharmacy ? 'Edit Pharmacy' : 'Add New Pharmacy'}</Text>
                        
                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Pharmacy Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.name}
                                    onChangeText={(t) => handleChange('name', t)}
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Email *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.email}
                                    onChangeText={(t) => handleChange('email', t)}
                                    keyboardType="email-address"
                                />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Phone</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.phone}
                                    onChangeText={(t) => handleChange('phone', t.replace(/\D/g, '').slice(0, 10))}
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Address</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.address}
                                    onChangeText={(t) => handleChange('address', t)}
                                />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>{editingPharmacy ? 'New Password (leave blank to keep current)' : 'Password *'}</Text>
                                {/* Fallback to simple TextInput since PasswordInput depends on external bindings, or assumes it works identically */}
                                <TextInput
                                    style={styles.input}
                                    value={formData.password}
                                    onChangeText={(t) => handleChange('password', t)}
                                    placeholder={editingPharmacy ? 'Enter new password or leave blank' : 'Enter password for login'}
                                    secureTextEntry
                                />
                                <Text style={styles.formHint}>Minimum 6 characters. User will login with this email and password.</Text>
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                value={formData.description}
                                onChangeText={(t) => handleChange('description', t)}
                                multiline
                                numberOfLines={4}
                                placeholder="Pharmacy description..."
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.sectionLabel}>Availability</Text>
                            <View style={styles.availabilityGrid}>
                                {days.map(day => (
                                    <View key={day} style={styles.availabilityDay}>
                                        <TouchableOpacity 
                                            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}
                                            onPress={() => handleAvailabilityChange(day, 'available', !(formData.availability?.[day]?.available))}
                                        >
                                            <View style={[styles.checkbox, formData.availability?.[day]?.available && styles.checkboxChecked]}>
                                                {formData.availability?.[day]?.available && <Feather name="check" size={12} color="#fff" />}
                                            </View>
                                            <Text style={styles.dayLabel}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                                        </TouchableOpacity>

                                        {formData.availability?.[day]?.available && (
                                            <View style={styles.timeInputs}>
                                                <TextInput 
                                                    style={styles.timeInput}
                                                    value={formData.availability?.[day]?.startTime || ''}
                                                    onChangeText={t => handleAvailabilityChange(day, 'startTime', t)}
                                                    placeholder="09:00"
                                                />
                                                <Text style={{ marginHorizontal: 4, color: '#64748b' }}>to</Text>
                                                <TextInput 
                                                    style={styles.timeInput}
                                                    value={formData.availability?.[day]?.endTime || ''}
                                                    onChangeText={t => handleAvailabilityChange(day, 'endTime', t)}
                                                    placeholder="17:00"
                                                />
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>
                        </View>

                        <View style={styles.formActions}>
                            <TouchableOpacity onPress={resetForm} style={styles.btnSecondary}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSubmit} disabled={loading} style={styles.btnPrimarySubmit}>
                                <Text style={styles.btnPrimaryText}>{loading ? 'Saving...' : editingPharmacy ? 'Update Pharmacy' : 'Create Pharmacy'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={styles.tableCard}>
                    <Text style={styles.tableTitle}>All Pharmacies</Text>
                    {loadingData ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#3b82f6" />
                            <Text style={{ color: '#64748b', marginTop: 10 }}>Loading pharmacies...</Text>
                        </View>
                    ) : pharmacies.length === 0 ? (
                        <Text style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>No pharmacies found. Create one to get started.</Text>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ minWidth: 800 }}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { flex: 2 }]}>Name</Text>
                                    <Text style={[styles.th, { flex: 2 }]}>Email</Text>
                                    <Text style={[styles.th, { flex: 1.5 }]}>Phone</Text>
                                    <Text style={[styles.th, { flex: 2 }]}>Address</Text>
                                    <Text style={[styles.th, { flex: 1.5, textAlign: 'center' }]}>Actions</Text>
                                </View>
                                {pharmacies.map((pharmacy) => (
                                    <View key={pharmacy._id} style={styles.tableRow}>
                                        <Text style={[styles.td, { flex: 2, fontWeight: 'bold' }]}>{pharmacy.name}</Text>
                                        <Text style={[styles.td, { flex: 2 }]}>{pharmacy.email}</Text>
                                        <Text style={[styles.td, { flex: 1.5 }]}>{pharmacy.phone || '-'}</Text>
                                        <Text style={[styles.td, { flex: 2 }]}>{pharmacy.address || '-'}</Text>
                                        <View style={[styles.td, { flex: 1.5, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}>
                                            <TouchableOpacity onPress={() => handleEdit(pharmacy)} style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}>
                                                <Text style={styles.actionBtnText}>Edit</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDelete(pharmacy._id)} style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}>
                                                <Text style={styles.actionBtnText}>Delete</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    content: {
        padding: 20,
        maxWidth: 1200,
        marginHorizontal: 'auto',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16,
    },
    pageTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    pageSubtitle: {
        color: '#64748b',
        marginTop: 4,
    },
    btnPrimary: {
        backgroundColor: '#3b82f6',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    btnPrimaryText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    errorBanner: {
        backgroundColor: '#fee2e2',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#fca5a5',
    },
    errorBannerText: {
        color: '#b91c1c',
    },
    successBanner: {
        backgroundColor: '#dcfce7',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#86efac',
    },
    successBannerText: {
        color: '#15803d',
    },
    formCard: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 24,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    formCardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 20,
    },
    formRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 16,
    },
    formGroup: {
        flex: 1,
        minWidth: 200,
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        padding: 10,
        fontSize: 14,
        backgroundColor: '#fff',
        color: '#0f172a',
    },
    formHint: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 4,
    },
    sectionLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
        color: '#1e293b',
    },
    availabilityGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    availabilityDay: {
        padding: 10,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        width: 150,
    },
    checkbox: {
        width: 18,
        height: 18,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 4,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    dayLabel: {
        fontWeight: 'bold',
        textTransform: 'capitalize',
        color: '#1e293b',
    },
    timeInputs: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
    },
    timeInput: {
        flex: 1,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 4,
        fontSize: 12,
        backgroundColor: '#fff',
    },
    formActions: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 12,
        marginTop: 10,
    },
    btnPrimarySubmit: {
        backgroundColor: '#3b82f6',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 6,
    },
    btnSecondary: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    btnSecondaryText: {
        color: '#475569',
        fontWeight: 'bold',
    },
    tableCard: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    tableTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#1e293b',
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 10,
        marginBottom: 10,
    },
    th: {
        fontWeight: 'bold',
        color: '#475569',
        fontSize: 14,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 12,
        alignItems: 'center',
    },
    td: {
        fontSize: 14,
        color: '#334155',
    },
    actionBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    }
});

export default AdminPharmacy;
