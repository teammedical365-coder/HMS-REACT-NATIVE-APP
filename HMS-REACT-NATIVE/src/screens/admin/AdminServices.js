import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, TextInput, 
    StyleSheet, Alert, ActivityIndicator 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { adminEntitiesAPI } from '../../utils/api';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AdminServices = () => {
    const navigation = useNavigation();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editingService, setEditingService] = useState(null);
    const [showForm, setShowForm] = useState(false);
    
    const initialFormState = {
        id: '',
        title: '',
        description: '',
        icon: '🏥',
        color: '#14C38E',
        price: '0',
        duration: '',
        category: '',
        features: [],
        active: true
    };

    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        const init = async () => {
            try {
                const userStr = await AsyncStorage.getItem('user');
                const user = userStr ? JSON.parse(userStr) : {};
                if (user.role !== 'admin' && user.role !== 'hospitaladmin') {
                    navigation.navigate('Home');
                    return;
                }
                fetchServices();
            } catch (err) {
                console.error(err);
            }
        };
        init();
    }, [navigation]);

    const fetchServices = async () => {
        try {
            setLoadingData(true);
            const response = await adminEntitiesAPI.getServices();
            if (response.success) {
                setServices(response.services);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error fetching services');
        } finally {
            setLoadingData(false);
        }
    };

    const handleChange = (name, value) => {
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
        setSuccess('');
    };

    const handleFeatureChange = (text) => {
        const features = text.split('\n').filter(f => f.trim() !== '');
        setFormData(prev => ({ ...prev, features }));
    };

    const handleSubmit = async () => {
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const dataToSubmit = {
                ...formData,
                price: Number(formData.price) || 0
            };

            if (editingService) {
                const response = await adminEntitiesAPI.updateService(editingService._id, dataToSubmit);
                if (response.success) {
                    setSuccess('Service updated successfully');
                    resetForm();
                    fetchServices();
                }
            } else {
                const response = await adminEntitiesAPI.createService(dataToSubmit);
                if (response.success) {
                    setSuccess('Service created successfully');
                    resetForm();
                    fetchServices();
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving service');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (service) => {
        setEditingService(service);
        setFormData({
            id: service.id || '',
            title: service.title || '',
            description: service.description || '',
            icon: service.icon || '🏥',
            color: service.color || '#14C38E',
            price: service.price !== undefined ? String(service.price) : '0',
            duration: service.duration || '',
            category: service.category || '',
            features: service.features || [],
            active: service.active !== undefined ? service.active : true
        });
        setShowForm(true);
    };

    const handleDelete = (id) => {
        Alert.alert('Confirm Delete', 'Are you sure you want to delete this service?', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive',
                onPress: async () => {
                    try {
                        const response = await adminEntitiesAPI.deleteService(id);
                        if (response.success) {
                            setSuccess('Service deleted successfully');
                            fetchServices();
                        }
                    } catch (err) {
                        setError(err.response?.data?.message || 'Error deleting service');
                    }
                }
            }
        ]);
    };

    const resetForm = () => {
        setFormData(initialFormState);
        setEditingService(null);
        setShowForm(false);
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.pageTitle}>Manage Services</Text>
                        <Text style={styles.pageSubtitle}>Add and manage services that will be displayed to users</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => setShowForm(!showForm)} 
                        style={styles.btnPrimary}
                    >
                        <Text style={styles.btnPrimaryText}>{showForm ? 'Cancel' : '+ Add Service'}</Text>
                    </TouchableOpacity>
                </View>

                {error ? <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{error}</Text></View> : null}
                {success ? <View style={styles.successBanner}><Text style={styles.successBannerText}>{success}</Text></View> : null}

                {showForm && (
                    <View style={styles.formCard}>
                        <Text style={styles.formCardTitle}>{editingService ? 'Edit Service' : 'Add New Service'}</Text>
                        
                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Service ID *</Text>
                                <TextInput
                                    style={[styles.input, editingService && styles.inputDisabled]}
                                    value={formData.id}
                                    onChangeText={(t) => handleChange('id', t)}
                                    placeholder="e.g., ivf, iui"
                                    editable={!editingService}
                                />
                                <Text style={styles.formHint}>Unique identifier (lowercase, no spaces)</Text>
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Title *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.title}
                                    onChangeText={(t) => handleChange('title', t)}
                                    placeholder="e.g., In Vitro Fertilization (IVF)"
                                />
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Description *</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                value={formData.description}
                                onChangeText={(t) => handleChange('description', t)}
                                placeholder="Service description..."
                                multiline
                                numberOfLines={4}
                            />
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Icon Emoji</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.icon}
                                    onChangeText={(t) => handleChange('icon', t)}
                                    placeholder="🏥"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Color</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.color}
                                    onChangeText={(t) => handleChange('color', t)}
                                    placeholder="#14C38E"
                                />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Price ($/₹)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.price}
                                    onChangeText={(t) => handleChange('price', t)}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Duration</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.duration}
                                    onChangeText={(t) => handleChange('duration', t)}
                                    placeholder="e.g., 2-3 weeks"
                                />
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Category</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.category}
                                onChangeText={(t) => handleChange('category', t)}
                                placeholder="e.g., Fertility Treatment"
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Features (one per line)</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                value={formData.features.join('\n')}
                                onChangeText={handleFeatureChange}
                                placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                                multiline
                                numberOfLines={4}
                            />
                        </View>

                        <TouchableOpacity 
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}
                            onPress={() => handleChange('active', !formData.active)}
                        >
                            <View style={[styles.checkbox, formData.active && styles.checkboxChecked]}>
                                {formData.active && <Feather name="check" size={12} color="#fff" />}
                            </View>
                            <Text style={{ fontWeight: '600', color: '#334155' }}>Active (visible to users)</Text>
                        </TouchableOpacity>

                        <View style={styles.formActions}>
                            <TouchableOpacity onPress={resetForm} style={styles.btnSecondary}>
                                <Text style={styles.btnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSubmit} disabled={loading} style={styles.btnPrimarySubmit}>
                                <Text style={styles.btnPrimaryText}>{loading ? 'Saving...' : editingService ? 'Update Service' : 'Create Service'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={styles.tableCard}>
                    <Text style={styles.tableTitle}>All Services</Text>
                    {loadingData ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#3b82f6" />
                            <Text style={{ color: '#64748b', marginTop: 10 }}>Loading services...</Text>
                        </View>
                    ) : services.length === 0 ? (
                        <Text style={{ padding: 20, textAlign: 'center', color: '#64748b' }}>No services found. Create one to get started.</Text>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ minWidth: 800 }}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { flex: 1.5 }]}>ID</Text>
                                    <Text style={[styles.th, { flex: 2 }]}>Title</Text>
                                    <Text style={[styles.th, { flex: 1 }]}>Icon</Text>
                                    <Text style={[styles.th, { flex: 1 }]}>Price</Text>
                                    <Text style={[styles.th, { flex: 1 }]}>Active</Text>
                                    <Text style={[styles.th, { flex: 1.5, textAlign: 'center' }]}>Actions</Text>
                                </View>
                                {services.map((service) => (
                                    <View key={service._id} style={styles.tableRow}>
                                        <Text style={[styles.td, { flex: 1.5 }]}>{service.id}</Text>
                                        <Text style={[styles.td, { flex: 2, fontWeight: 'bold' }]}>{service.title}</Text>
                                        <Text style={[styles.td, { flex: 1, fontSize: 18 }]}>{service.icon}</Text>
                                        <Text style={[styles.td, { flex: 1 }]}>${service.price || 0}</Text>
                                        <View style={[styles.td, { flex: 1 }]}>
                                            <View style={[styles.statusBadge, { backgroundColor: service.active ? '#dcfce7' : '#fee2e2' }]}>
                                                <Text style={[styles.statusBadgeText, { color: service.active ? '#15803d' : '#b91c1c' }]}>
                                                    {service.active ? 'Yes' : 'No'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={[styles.td, { flex: 1.5, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}>
                                            <TouchableOpacity onPress={() => handleEdit(service)} style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}>
                                                <Text style={styles.actionBtnText}>Edit</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleDelete(service._id)} style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}>
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
    inputDisabled: {
        backgroundColor: '#f1f5f9',
        color: '#94a3b8',
    },
    formHint: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 4,
    },
    checkbox: {
        width: 18,
        height: 18,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    formActions: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 12,
        marginTop: 20,
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
    statusBadge: {
        alignSelf: 'flex-start',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '700',
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

export default AdminServices;
