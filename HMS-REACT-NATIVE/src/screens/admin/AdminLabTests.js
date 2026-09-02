import React, { useState, useEffect } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, TextInput, 
    StyleSheet, Alert, ActivityIndicator, Modal, Dimensions
} from 'react-native';
import { labTestAPI, hospitalAPI } from '../../utils/api';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Inline Custom Select for Hospital Filter
const CustomSelect = ({ options, value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedObj = options.find(o => o.value === value);
    const selectedName = selectedObj ? selectedObj.label : placeholder;

    return (
        <View style={{ position: 'relative', width: 220, zIndex: isOpen ? 50 : 1 }}>
            <TouchableOpacity 
                style={[styles.inputField, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' }]} 
                onPress={() => setIsOpen(!isOpen)}
                activeOpacity={0.7}
            >
                <Text style={{ color: value || value === '' ? '#0f172a' : '#94a3b8', fontSize: 13 }} numberOfLines={1}>{selectedName}</Text>
                <Feather name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>

            {isOpen && (
                <View style={styles.dropdownMenu}>
                    <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 150 }}>
                        <TouchableOpacity 
                            onPress={() => { onChange(''); setIsOpen(false); }}
                            style={[styles.dropdownItem, value === '' && styles.dropdownItemActive]}
                        >
                            <Text style={[styles.dropdownItemText, value === '' && styles.dropdownItemTextActive]}>{placeholder}</Text>
                        </TouchableOpacity>
                        {options.map(opt => (
                            <TouchableOpacity 
                                key={opt.value}
                                onPress={() => { onChange(opt.value); setIsOpen(false); }}
                                style={[styles.dropdownItem, opt.value === value && styles.dropdownItemActive]}
                            >
                                <Text style={[styles.dropdownItemText, opt.value === value && styles.dropdownItemTextActive]} numberOfLines={1}>{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};

const AdminLabTests = () => {
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        price: '',
        category: 'General',
        isActive: true
    });

    // Hospital pricing
    const [hospitals, setHospitals] = useState([]);
    const [selectedHospitalFilter, setSelectedHospitalFilter] = useState('');
    const [pricingTestId, setPricingTestId] = useState(null);
    const [hospitalPriceInputs, setHospitalPriceInputs] = useState({});
    const [savingPrice, setSavingPrice] = useState(false);
    const [isCentralAdmin, setIsCentralAdmin] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const userStr = await AsyncStorage.getItem('user');
                const user = userStr ? JSON.parse(userStr) : {};
                const central = user.role === 'centraladmin' || user.role === 'superadmin';
                setIsCentralAdmin(central);
                fetchTests();
                if (central) fetchHospitals();
            } catch (err) {
                console.error('Init error:', err);
            }
        };
        init();
    }, []);

    const fetchTests = async () => {
        try {
            setLoading(true);
            const res = await labTestAPI.getLabTests();
            if (res.success) {
                setTests(res.data);
            }
        } catch (err) {
            console.error('Error fetching lab tests:', err);
            setError('Failed to fetch lab tests.');
        } finally {
            setLoading(false);
        }
    };

    const fetchHospitals = async () => {
        try {
            const res = await hospitalAPI.getHospitals();
            if (res.success) setHospitals(res.hospitals);
        } catch (err) { console.error('Error fetching hospitals:', err); }
    };

    const handleChange = (name, value) => {
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
        setSuccess('');
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const dataToSubmit = {
                ...formData,
                price: Number(formData.price) || 0
            };

            if (editingId) {
                const res = await labTestAPI.updateLabTest(editingId, dataToSubmit);
                if (res.success) setSuccess('Lab test updated successfully!');
            } else {
                const res = await labTestAPI.createLabTest(dataToSubmit);
                if (res.success) setSuccess('Lab test created successfully!');
            }
            setShowForm(false);
            setEditingId(null);
            fetchTests();
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving lab test.');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (test) => {
        setFormData({
            name: test.name,
            code: test.code || '',
            description: test.description || '',
            price: test.price ? String(test.price) : '',
            category: test.category || 'General',
            isActive: test.isActive
        });
        setEditingId(test._id);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        Alert.alert('Confirm Delete', 'Are you sure you want to delete this lab test?', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive',
                onPress: async () => {
                    try {
                        const res = await labTestAPI.deleteLabTest(id);
                        if (res.success) {
                            setSuccess('Lab test deleted.');
                            fetchTests();
                        }
                    } catch (err) {
                        setError(err.response?.data?.message || 'Error deleting test.');
                    }
                }
            }
        ]);
    };

    const openPricingPanel = (test) => {
        if (pricingTestId === test._id) {
            setPricingTestId(null);
            return;
        }
        setPricingTestId(test._id);
        const prices = {};
        const hpMap = test.hospitalPrices || {};
        hospitals.forEach(h => {
            const existing = hpMap[h._id];
            prices[h._id] = existing !== undefined ? String(existing) : '';
        });
        setHospitalPriceInputs(prices);
    };

    const handleSaveHospitalPrice = async (testId, hospitalId) => {
        setSavingPrice(true);
        setError('');
        try {
            const priceVal = hospitalPriceInputs[hospitalId];
            const res = await labTestAPI.setHospitalPrice(
                testId,
                hospitalId,
                priceVal === '' ? null : Number(priceVal)
            );
            if (res.success) {
                setSuccess(`Price updated for ${hospitals.find(h => h._id === hospitalId)?.name || 'hospital'}`);
                fetchTests();
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving hospital price.');
        } finally {
            setSavingPrice(false);
        }
    };

    const getHospitalPrice = (test, hospitalId) => {
        const hpMap = test.hospitalPrices || {};
        return hpMap[hospitalId];
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.pageTitle}>Lab Tests Catalog</Text>
                        <Text style={styles.pageSubtitle}>Manage the predefined lab tests available for doctors and labs</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => { setShowForm(!showForm); setEditingId(null); setFormData({ name: '', code: '', description: '', price: '', category: 'General', isActive: true }); }} 
                        style={styles.btnPrimary}
                    >
                        <Text style={styles.btnPrimaryText}>{showForm ? 'Cancel' : '+ Add Lab Test'}</Text>
                    </TouchableOpacity>
                </View>

                {error ? <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{error}</Text></View> : null}
                {success ? <View style={styles.successBanner}><Text style={styles.successBannerText}>{success}</Text></View> : null}

                {/* Form Modal / Inline Card */}
                {showForm && (
                    <View style={styles.formCard}>
                        <Text style={styles.formCardTitle}>{editingId ? 'Edit Lab Test' : 'Add New Lab Test'}</Text>
                        
                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Test Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.name}
                                    onChangeText={(t) => handleChange('name', t)}
                                    placeholder="e.g. Complete Blood Count"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Test Code</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.code}
                                    onChangeText={(t) => handleChange('code', t)}
                                    placeholder="e.g. CBC"
                                />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Category</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.category}
                                    onChangeText={(t) => handleChange('category', t)}
                                    placeholder="e.g. Hematology"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Default Price (₹)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.price}
                                    onChangeText={(t) => handleChange('price', t)}
                                    placeholder="e.g. 500"
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Description / Guidelines</Text>
                            <TextInput
                                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                                value={formData.description}
                                onChangeText={(t) => handleChange('description', t)}
                                placeholder="e.g. Fasting required for 12 hours"
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        <TouchableOpacity 
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}
                            onPress={() => handleChange('isActive', !formData.isActive)}
                        >
                            <View style={[styles.checkbox, formData.isActive && styles.checkboxChecked]}>
                                {formData.isActive && <Feather name="check" size={12} color="#fff" />}
                            </View>
                            <Text style={{ fontWeight: '600', color: '#334155' }}>Active (Visible to Doctors)</Text>
                        </TouchableOpacity>

                        <View style={{ marginTop: 20 }}>
                            <TouchableOpacity onPress={handleSubmit} disabled={loading} style={[styles.btnPrimarySubmit, { maxWidth: 200, alignItems: 'center' }]}>
                                <Text style={styles.btnPrimaryText}>{loading ? 'Saving...' : 'Save Lab Test'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Hospital filter for viewing prices */}
                {isCentralAdmin && hospitals.length > 0 && (
                    <View style={[styles.formCard, { padding: 16, marginBottom: 20, zIndex: 100 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', zIndex: 100 }}>
                            <Text style={{ fontWeight: '700', fontSize: 14, color: '#334155' }}>View prices for:</Text>
                            <CustomSelect 
                                options={hospitals.map(h => ({
                                    label: `${h.name}${h.city ? ` — ${h.city}` : ''}`,
                                    value: h._id
                                }))}
                                value={selectedHospitalFilter}
                                onChange={setSelectedHospitalFilter}
                                placeholder="Default (Base Price)"
                            />
                            {selectedHospitalFilter !== '' && (
                                <Text style={{ fontSize: 12, color: '#64748b' }}>
                                    Showing hospital-specific prices. Click "Set Prices" on any test to edit.
                                </Text>
                            )}
                        </View>
                    </View>
                )}

                <View style={styles.tableCard}>
                    <Text style={styles.tableTitle}>Available Lab Tests</Text>
                    {loading && !tests.length ? (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <ActivityIndicator size="large" color="#3b82f6" />
                            <Text style={{ color: '#64748b', marginTop: 10 }}>Loading catalog...</Text>
                        </View>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ zIndex: 1 }}>
                            <View style={{ minWidth: selectedHospitalFilter ? 900 : 800 }}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { flex: 2 }]}>Name</Text>
                                    <Text style={[styles.th, { flex: 1 }]}>Code</Text>
                                    <Text style={[styles.th, { flex: 1.5 }]}>Category</Text>
                                    <Text style={[styles.th, { flex: 1 }]}>Base Price</Text>
                                    {selectedHospitalFilter !== '' && (
                                        <Text style={[styles.th, { flex: 1.5 }]}>Hospital Price</Text>
                                    )}
                                    <Text style={[styles.th, { flex: 1 }]}>Status</Text>
                                    <Text style={[styles.th, { flex: isCentralAdmin ? 2.5 : 1.5, textAlign: 'center' }]}>Actions</Text>
                                </View>
                                
                                {tests.length === 0 ? (
                                    <View style={{ padding: 20, alignItems: 'center' }}>
                                        <Text style={{ color: '#64748b' }}>No lab tests defined yet.</Text>
                                    </View>
                                ) : (
                                    tests.map(test => {
                                        const hospitalPrice = selectedHospitalFilter ? getHospitalPrice(test, selectedHospitalFilter) : undefined;
                                        return (
                                            <View key={test._id} style={{ borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                                                <View style={styles.tableRow}>
                                                    <Text style={[styles.td, { flex: 2, fontWeight: '600' }]}>{test.name}</Text>
                                                    <Text style={[styles.td, { flex: 1 }]}>{test.code || '-'}</Text>
                                                    <Text style={[styles.td, { flex: 1.5 }]}>{test.category}</Text>
                                                    <Text style={[styles.td, { flex: 1 }]}>₹{test.price}</Text>
                                                    {selectedHospitalFilter !== '' && (
                                                        <Text style={[styles.td, { flex: 1.5, fontWeight: '600', color: hospitalPrice !== undefined ? '#059669' : '#94a3b8' }]}>
                                                            {hospitalPrice !== undefined ? `₹${hospitalPrice}` : `₹${test.price} (default)`}
                                                        </Text>
                                                    )}
                                                    <View style={[styles.td, { flex: 1 }]}>
                                                        <View style={[styles.statusBadge, { backgroundColor: test.isActive ? '#dcfce7' : '#f1f5f9' }]}>
                                                            <Text style={[styles.statusBadgeText, { color: test.isActive ? '#166534' : '#64748b' }]}>
                                                                {test.isActive ? 'Active' : 'Hidden'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                    <View style={[styles.td, { flex: isCentralAdmin ? 2.5 : 1.5, flexDirection: 'row', justifyContent: 'center', gap: 6 }]}>
                                                        <TouchableOpacity onPress={() => handleEdit(test)} style={styles.actionBtn}>
                                                            <Text style={styles.actionBtnText}>Edit</Text>
                                                        </TouchableOpacity>
                                                        {isCentralAdmin && (
                                                            <TouchableOpacity 
                                                                onPress={() => openPricingPanel(test)} 
                                                                style={[styles.actionBtn, { backgroundColor: pricingTestId === test._id ? '#fef3c7' : '#eff6ff', borderColor: pricingTestId === test._id ? '#fbbf24' : '#93c5fd', borderWidth: 1 }]}
                                                            >
                                                                <Text style={[styles.actionBtnText, { color: pricingTestId === test._id ? '#92400e' : '#2563eb' }]}>
                                                                    {pricingTestId === test._id ? 'Close' : 'Set Prices'}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        )}
                                                        <TouchableOpacity onPress={() => handleDelete(test._id)} style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}>
                                                            <Text style={[styles.actionBtnText, { color: '#fff' }]}>Delete</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>

                                                {/* Hospital pricing panel */}
                                                {pricingTestId === test._id && (
                                                    <View style={styles.pricingPanel}>
                                                        <Text style={styles.pricingPanelTitle}>
                                                            Hospital-wise Pricing for "{test.name}" (Base: ₹{test.price})
                                                        </Text>
                                                        <View style={styles.pricingGrid}>
                                                            {hospitals.map(h => {
                                                                const currentHospitalPrice = getHospitalPrice(test, h._id);
                                                                return (
                                                                    <View key={h._id} style={styles.pricingRow}>
                                                                        <Text style={styles.pricingHospitalName} numberOfLines={1}>
                                                                            {h.name}
                                                                            {currentHospitalPrice !== undefined && (
                                                                                <Text style={{ color: '#059669', fontWeight: '400' }}> (₹{currentHospitalPrice})</Text>
                                                                            )}
                                                                        </Text>
                                                                        <TextInput
                                                                            style={styles.pricingInput}
                                                                            placeholder={`₹${test.price}`}
                                                                            value={hospitalPriceInputs[h._id] || ''}
                                                                            onChangeText={t => setHospitalPriceInputs(prev => ({ ...prev, [h._id]: t }))}
                                                                            keyboardType="numeric"
                                                                        />
                                                                        <TouchableOpacity 
                                                                            onPress={() => handleSaveHospitalPrice(test._id, h._id)} 
                                                                            disabled={savingPrice} 
                                                                            style={styles.pricingSaveBtn}
                                                                        >
                                                                            <Text style={styles.pricingSaveBtnText}>Save</Text>
                                                                        </TouchableOpacity>
                                                                    </View>
                                                                );
                                                            })}
                                                        </View>
                                                        <Text style={styles.pricingHint}>Leave empty and save to reset to the default base price.</Text>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })
                                )}
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
    inputField: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
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
    btnPrimarySubmit: {
        backgroundColor: '#3b82f6',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 6,
    },
    dropdownMenu: {
        position: 'absolute',
        top: 40,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderColor: '#cbd5e1',
        borderWidth: 1,
        borderRadius: 8,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    dropdownItem: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    dropdownItemActive: {
        backgroundColor: '#e0f2fe',
    },
    dropdownItemText: {
        fontSize: 13,
        color: '#334155',
    },
    dropdownItemTextActive: {
        color: '#0284c7',
        fontWeight: '600',
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
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    actionBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    actionBtnText: {
        color: '#475569',
        fontSize: 12,
        fontWeight: 'bold',
    },
    pricingPanel: {
        backgroundColor: '#f8fafc',
        padding: 16,
        borderTopWidth: 2,
        borderTopColor: '#e2e8f0',
    },
    pricingPanelTitle: {
        fontSize: 14,
        color: '#334155',
        fontWeight: 'bold',
        marginBottom: 12,
    },
    pricingGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    pricingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        width: 300,
        gap: 8,
    },
    pricingHospitalName: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    pricingInput: {
        width: 70,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        fontSize: 13,
    },
    pricingSaveBtn: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: '#059669',
        borderRadius: 4,
    },
    pricingSaveBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    pricingHint: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 10,
    }
});

export default AdminLabTests;
