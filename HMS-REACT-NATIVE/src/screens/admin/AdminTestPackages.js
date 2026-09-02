import React, { useState, useEffect, useMemo } from 'react';
import { 
    View, Text, TouchableOpacity, ScrollView, TextInput, 
    StyleSheet, Alert, ActivityIndicator 
} from 'react-native';
import { labTestAPI, testPackageAPI } from '../../utils/api';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const AdminTestPackages = () => {
    const navigation = useNavigation();
    
    // === STATE ===
    const [activeTab, setActiveTab] = useState('packages'); // 'packages' | 'tests'
    const [tests, setTests] = useState([]);
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    // Package Form
    const [showPackageForm, setShowPackageForm] = useState(false);
    const [editingPackageId, setEditingPackageId] = useState(null);
    const [packageForm, setPackageForm] = useState({
        name: '', code: '', description: '', tests: [],
        price: '', discountedPrice: '', category: 'General', isActive: true
    });

    // Test Form
    const [showTestForm, setShowTestForm] = useState(false);
    const [editingTestId, setEditingTestId] = useState(null);
    const [testForm, setTestForm] = useState({
        name: '', code: '', description: '', price: '', category: 'General', isActive: true
    });

    // === FETCH DATA ===
    useEffect(() => {
        const checkRoleAndFetch = async () => {
            try {
                const userStr = await AsyncStorage.getItem('user');
                const user = userStr ? JSON.parse(userStr) : {};
                if (!['admin', 'hospitaladmin', 'centraladmin', 'superadmin'].includes(user.role)) {
                    navigation.navigate('Home');
                    return;
                }
                fetchAll();
            } catch (err) {
                console.error(err);
            }
        };
        checkRoleAndFetch();
    }, [navigation]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [testsRes, packagesRes] = await Promise.all([
                labTestAPI.getLabTests(),
                testPackageAPI.getPackages()
            ]);
            if (testsRes.success) setTests(testsRes.data);
            if (packagesRes.success) setPackages(packagesRes.data);
        } catch (err) {
            console.error('Fetch error:', err);
            setError('Failed to load data.');
        } finally {
            setLoading(false);
        }
    };

    // Auto-dismiss messages
    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => { setSuccess(''); setError(''); }, 4000);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

    // === DERIVED DATA ===
    const categories = useMemo(() => {
        const cats = new Set();
        tests.forEach(t => cats.add(t.category || 'General'));
        packages.forEach(p => cats.add(p.category || 'General'));
        return Array.from(cats).sort();
    }, [tests, packages]);

    const filteredTests = useMemo(() => {
        return tests.filter(t => {
            const matchesSearch = !searchTerm ||
                t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.code || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCat = !categoryFilter || t.category === categoryFilter;
            return matchesSearch && matchesCat;
        });
    }, [tests, searchTerm, categoryFilter]);

    const filteredPackages = useMemo(() => {
        return packages.filter(p => {
            const matchesSearch = !searchTerm ||
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.code || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCat = !categoryFilter || p.category === categoryFilter;
            return matchesSearch && matchesCat;
        });
    }, [packages, searchTerm, categoryFilter]);

    const totalTestPrice = useMemo(() => {
        return packageForm.tests.reduce((sum, testId) => {
            const test = tests.find(t => t._id === testId);
            return sum + (test?.price || 0);
        }, 0);
    }, [packageForm.tests, tests]);

    // === PACKAGE HANDLERS ===
    const resetPackageForm = () => {
        setPackageForm({
            name: '', code: '', description: '', tests: [],
            price: '', discountedPrice: '', category: 'General', isActive: true
        });
        setEditingPackageId(null);
    };

    const handlePackageChange = (name, value) => {
        setPackageForm(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
    };

    const toggleTestInPackage = (testId) => {
        setPackageForm(prev => ({
            ...prev,
            tests: prev.tests.includes(testId)
                ? prev.tests.filter(id => id !== testId)
                : [...prev.tests, testId]
        }));
    };

    const handlePackageSubmit = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const data = {
                ...packageForm,
                price: Number(packageForm.price) || 0,
                discountedPrice: Number(packageForm.discountedPrice) || 0
            };

            if (editingPackageId) {
                const res = await testPackageAPI.updatePackage(editingPackageId, data);
                if (res.success) setSuccess('✅ Package updated successfully!');
            } else {
                const res = await testPackageAPI.createPackage(data);
                if (res.success) setSuccess('✅ Package created successfully!');
            }

            setShowPackageForm(false);
            resetPackageForm();
            fetchAll();
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving package.');
        } finally {
            setLoading(false);
        }
    };

    const handleEditPackage = (pkg) => {
        setPackageForm({
            name: pkg.name,
            code: pkg.code || '',
            description: pkg.description || '',
            tests: pkg.tests?.map(t => t._id || t) || [],
            price: pkg.price !== undefined ? String(pkg.price) : '',
            discountedPrice: pkg.discountedPrice !== undefined ? String(pkg.discountedPrice) : '',
            category: pkg.category || 'General',
            isActive: pkg.isActive
        });
        setEditingPackageId(pkg._id);
        setShowPackageForm(true);
        setActiveTab('packages');
    };

    const handleDeletePackage = (id) => {
        Alert.alert('Confirm Delete', 'Are you sure you want to delete this package?', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive',
                onPress: async () => {
                    try {
                        const res = await testPackageAPI.deletePackage(id);
                        if (res.success) {
                            setSuccess('Package deleted.');
                            fetchAll();
                        }
                    } catch (err) {
                        setError(err.response?.data?.message || 'Error deleting package.');
                    }
                }
            }
        ]);
    };

    // === TEST HANDLERS ===
    const resetTestForm = () => {
        setTestForm({ name: '', code: '', description: '', price: '', category: 'General', isActive: true });
        setEditingTestId(null);
    };

    const handleTestChange = (name, value) => {
        setTestForm(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
    };

    const handleTestSubmit = async () => {
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const data = { ...testForm, price: Number(testForm.price) || 0 };

            if (editingTestId) {
                const res = await labTestAPI.updateLabTest(editingTestId, data);
                if (res.success) setSuccess('✅ Test updated!');
            } else {
                const res = await labTestAPI.createLabTest(data);
                if (res.success) setSuccess('✅ Test created!');
            }

            setShowTestForm(false);
            resetTestForm();
            fetchAll();
        } catch (err) {
            setError(err.response?.data?.message || 'Error saving test.');
        } finally {
            setLoading(false);
        }
    };

    const handleEditTest = (test) => {
        setTestForm({
            name: test.name,
            code: test.code || '',
            description: test.description || '',
            price: test.price !== undefined ? String(test.price) : '',
            category: test.category || 'General',
            isActive: test.isActive
        });
        setEditingTestId(test._id);
        setShowTestForm(true);
        setActiveTab('tests');
    };

    const handleDeleteTest = (id) => {
        Alert.alert('Confirm Delete', 'Are you sure you want to delete this test?', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive',
                onPress: async () => {
                    try {
                        const res = await labTestAPI.deleteLabTest(id);
                        if (res.success) {
                            setSuccess('Test deleted.');
                            fetchAll();
                        }
                    } catch (err) {
                        setError(err.response?.data?.message || 'Error deleting test.');
                    }
                }
            }
        ]);
    };

    const getPackagesForTest = (testId) => {
        return packages.filter(pkg =>
            pkg.tests?.some(t => (t._id || t) === testId)
        );
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.pageTitle}>Tests & Packages</Text>
                        <Text style={styles.pageSubtitle}>Create individual tests and bundle them into packages</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
                        <TouchableOpacity 
                            style={[styles.btnAction, { backgroundColor: '#f59e0b' }]}
                            onPress={() => { setShowTestForm(!showTestForm); setShowPackageForm(false); resetTestForm(); setActiveTab('tests'); }}
                        >
                            <Text style={styles.btnActionText}>{showTestForm && !editingTestId ? '✕ Cancel' : '+ Add Test'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.btnAction, { backgroundColor: '#3b82f6' }]}
                            onPress={() => { setShowPackageForm(!showPackageForm); setShowTestForm(false); resetPackageForm(); setActiveTab('packages'); }}
                        >
                            <Text style={styles.btnActionText}>{showPackageForm && !editingPackageId ? '✕ Cancel' : '📦 Create Package'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Messages */}
                {error ? <View style={styles.errorBanner}><Text style={styles.errorBannerText}>⚠️ {error}</Text></View> : null}
                {success ? <View style={styles.successBanner}><Text style={styles.successBannerText}>{success}</Text></View> : null}

                {/* Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statMini}>
                        <Text style={styles.statIcon}>🧪</Text>
                        <Text style={styles.statValue}>{tests.length}</Text>
                        <Text style={styles.statLabel}>Total Tests</Text>
                    </View>
                    <View style={styles.statMini}>
                        <Text style={styles.statIcon}>📦</Text>
                        <Text style={styles.statValue}>{packages.length}</Text>
                        <Text style={styles.statLabel}>Total Packages</Text>
                    </View>
                    <View style={styles.statMini}>
                        <Text style={styles.statIcon}>✅</Text>
                        <Text style={styles.statValue}>{tests.filter(t => t.isActive).length}</Text>
                        <Text style={styles.statLabel}>Active Tests</Text>
                    </View>
                    <View style={styles.statMini}>
                        <Text style={styles.statIcon}>📂</Text>
                        <Text style={styles.statValue}>{categories.length}</Text>
                        <Text style={styles.statLabel}>Categories</Text>
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <TouchableOpacity 
                        style={[styles.tabBtn, activeTab === 'packages' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('packages')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'packages' && styles.tabBtnTextActive]}>📦 Packages</Text>
                        <View style={[styles.tabCount, activeTab === 'packages' && styles.tabCountActive]}>
                            <Text style={styles.tabCountText}>{packages.length}</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tabBtn, activeTab === 'tests' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('tests')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'tests' && styles.tabBtnTextActive]}>🧪 Individual Tests</Text>
                        <View style={[styles.tabCount, activeTab === 'tests' && styles.tabCountActive]}>
                            <Text style={styles.tabCountText}>{tests.length}</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Search & Filter */}
                <View style={styles.toolbar}>
                    <View style={styles.searchBox}>
                        <Feather name="search" size={16} color="#94a3b8" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={activeTab === 'packages' ? 'Search packages...' : 'Search tests...'}
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                        />
                    </View>
                    
                    {/* Basic Category Select implementation using ScrollView tags for RN */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
                        <TouchableOpacity 
                            style={[styles.filterChip, categoryFilter === '' && styles.filterChipActive]}
                            onPress={() => setCategoryFilter('')}
                        >
                            <Text style={[styles.filterChipText, categoryFilter === '' && styles.filterChipTextActive]}>All Categories</Text>
                        </TouchableOpacity>
                        {categories.map(cat => (
                            <TouchableOpacity 
                                key={cat}
                                style={[styles.filterChip, categoryFilter === cat && styles.filterChipActive]}
                                onPress={() => setCategoryFilter(cat)}
                            >
                                <Text style={[styles.filterChipText, categoryFilter === cat && styles.filterChipTextActive]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ============== TEST FORM ============== */}
                {showTestForm && (
                    <View style={styles.formCard}>
                        <Text style={styles.formCardTitle}>{editingTestId ? '✏️ Edit Test' : '🧪 Add New Test'}</Text>
                        
                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Test Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={testForm.name}
                                    onChangeText={(t) => handleTestChange('name', t)}
                                    placeholder="e.g. Complete Blood Count"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Test Code</Text>
                                <TextInput
                                    style={styles.input}
                                    value={testForm.code}
                                    onChangeText={(t) => handleTestChange('code', t)}
                                    placeholder="e.g. CBC"
                                />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Category</Text>
                                <TextInput
                                    style={styles.input}
                                    value={testForm.category}
                                    onChangeText={(t) => handleTestChange('category', t)}
                                    placeholder="e.g. Hematology"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Price (₹)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={testForm.price}
                                    onChangeText={(t) => handleTestChange('price', t)}
                                    placeholder="e.g. 500"
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                                value={testForm.description}
                                onChangeText={(t) => handleTestChange('description', t)}
                                placeholder="e.g. Fasting required for 12 hours"
                                multiline
                            />
                        </View>

                        <TouchableOpacity 
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}
                            onPress={() => handleTestChange('isActive', !testForm.isActive)}
                        >
                            <View style={[styles.checkbox, testForm.isActive && styles.checkboxChecked]}>
                                {testForm.isActive && <Feather name="check" size={12} color="#fff" />}
                            </View>
                            <Text style={{ fontWeight: '600', color: '#334155' }}>Active (Visible to Doctors)</Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                            <TouchableOpacity onPress={handleTestSubmit} disabled={loading} style={[styles.btnAction, { backgroundColor: '#3b82f6', flex: 1, alignItems: 'center' }]}>
                                <Text style={styles.btnActionText}>{loading ? 'Saving...' : editingTestId ? 'Update Test' : 'Save Test'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setShowTestForm(false); resetTestForm(); }} style={[styles.btnAction, { backgroundColor: '#f1f5f9', flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' }]}>
                                <Text style={[styles.btnActionText, { color: '#475569' }]}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ============== PACKAGE FORM ============== */}
                {showPackageForm && (
                    <View style={styles.formCard}>
                        <Text style={styles.formCardTitle}>{editingPackageId ? '✏️ Edit Package' : '📦 Create New Package'}</Text>
                        
                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Package Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={packageForm.name}
                                    onChangeText={(t) => handlePackageChange('name', t)}
                                    placeholder="e.g. Complete Health Checkup"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Package Code</Text>
                                <TextInput
                                    style={styles.input}
                                    value={packageForm.code}
                                    onChangeText={(t) => handlePackageChange('code', t)}
                                    placeholder="e.g. CHC-001"
                                />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Category</Text>
                                <TextInput
                                    style={styles.input}
                                    value={packageForm.category}
                                    onChangeText={(t) => handlePackageChange('category', t)}
                                    placeholder="e.g. Preventive Health"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Status</Text>
                                <TouchableOpacity 
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}
                                    onPress={() => handlePackageChange('isActive', !packageForm.isActive)}
                                >
                                    <View style={[styles.checkbox, packageForm.isActive && styles.checkboxChecked]}>
                                        {packageForm.isActive && <Feather name="check" size={12} color="#fff" />}
                                    </View>
                                    <Text style={{ fontWeight: '600', color: '#334155' }}>Active</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                                value={packageForm.description}
                                onChangeText={(t) => handlePackageChange('description', t)}
                                placeholder="Describe what this package covers..."
                                multiline
                            />
                        </View>

                        {/* TEST SELECTION */}
                        <View style={styles.testSelectionSection}>
                            <View style={styles.testSelectionHeader}>
                                <Text style={styles.label}>Select Tests for this Package *</Text>
                                <Text style={styles.selectedCount}>
                                    {packageForm.tests.length} test{packageForm.tests.length !== 1 ? 's' : ''} selected
                                </Text>
                            </View>

                            {tests.length === 0 ? (
                                <Text style={{ color: '#94a3b8', fontStyle: 'italic', marginBottom: 12 }}>No tests available. Create tests first.</Text>
                            ) : (
                                <View style={styles.testCheckboxes}>
                                    {tests.map(test => (
                                        <TouchableOpacity
                                            key={test._id}
                                            style={[styles.testCheckboxItem, packageForm.tests.includes(test._id) && styles.testCheckboxItemChecked]}
                                            onPress={() => toggleTestInPackage(test._id)}
                                        >
                                            <View style={[styles.checkbox, packageForm.tests.includes(test._id) && styles.checkboxChecked]}>
                                                {packageForm.tests.includes(test._id) && <Feather name="check" size={12} color="#fff" />}
                                            </View>
                                            <View style={styles.testInfo}>
                                                <Text style={styles.testName} numberOfLines={1}>{test.name}</Text>
                                                <Text style={styles.testMeta}>{test.code ? `${test.code} • ` : ''}{test.category} • ₹{test.price}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {packageForm.tests.length > 0 && (
                                <View style={styles.pricePreview}>
                                    <Text style={styles.pricePreviewLabel}>Total individual test cost:</Text>
                                    <Text style={styles.pricePreviewValue}>₹{totalTestPrice}</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Package Price (₹)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={packageForm.price}
                                    onChangeText={(t) => handlePackageChange('price', t)}
                                    placeholder={`Suggested: ₹${totalTestPrice}`}
                                    keyboardType="numeric"
                                />
                                <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Original total: ₹{totalTestPrice} • Set a discounted price</Text>
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>Discounted Price (₹) <Text style={{ color: '#94a3b8', fontWeight: '400' }}>optional</Text></Text>
                                <TextInput
                                    style={styles.input}
                                    value={packageForm.discountedPrice}
                                    onChangeText={(t) => handlePackageChange('discountedPrice', t)}
                                    placeholder="e.g. 1299"
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                            <TouchableOpacity onPress={handlePackageSubmit} disabled={loading || packageForm.tests.length === 0} style={[styles.btnAction, { backgroundColor: '#3b82f6', flex: 1, alignItems: 'center', opacity: (loading || packageForm.tests.length === 0) ? 0.6 : 1 }]}>
                                <Text style={styles.btnActionText}>{loading ? 'Saving...' : editingPackageId ? 'Update Package' : 'Create Package'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setShowPackageForm(false); resetPackageForm(); }} style={[styles.btnAction, { backgroundColor: '#f1f5f9', flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' }]}>
                                <Text style={[styles.btnActionText, { color: '#475569' }]}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* ============== PACKAGES TAB ============== */}
                {activeTab === 'packages' && (
                    <View>
                        {loading && !packages.length ? (
                            <View style={[styles.formCard, { alignItems: 'center' }]}>
                                <ActivityIndicator size="large" color="#0d9488" />
                                <Text style={{ marginTop: 10, color: '#64748b' }}>Loading packages...</Text>
                            </View>
                        ) : filteredPackages.length === 0 ? (
                            <View style={[styles.formCard, styles.emptyState]}>
                                <Text style={styles.emptyIcon}>📦</Text>
                                <Text style={styles.emptyTitle}>{searchTerm || categoryFilter ? 'No packages match your filter' : 'No packages yet'}</Text>
                                <Text style={styles.emptyText}>
                                    {searchTerm || categoryFilter
                                        ? 'Try adjusting your search or filter criteria.'
                                        : 'Create your first test package by clicking "Create Package" button above.'}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.packagesGrid}>
                                {filteredPackages.map(pkg => {
                                    const individualTotal = (pkg.tests || []).reduce((s, t) => s + (t.price || 0), 0);
                                    const displayPrice = pkg.discountedPrice || pkg.price || individualTotal;
                                    const savings = individualTotal > displayPrice ? Math.round(((individualTotal - displayPrice) / individualTotal) * 100) : 0;

                                    return (
                                        <View key={pkg._id} style={styles.packageCard}>
                                            <View style={styles.packageCardHeader}>
                                                <View style={{ flex: 1, marginRight: 10 }}>
                                                    <Text style={styles.packageCardTitle}>{pkg.name}</Text>
                                                    {pkg.code && <Text style={styles.packageCode}>{pkg.code}</Text>}
                                                </View>
                                                <View style={[styles.packageStatus, pkg.isActive ? styles.packageStatusActive : styles.packageStatusInactive]}>
                                                    <Text style={[styles.packageStatusText, { color: pkg.isActive ? '#166534' : '#64748b' }]}>{pkg.isActive ? 'Active' : 'Hidden'}</Text>
                                                </View>
                                            </View>

                                            {pkg.description && (
                                                <Text style={styles.packageDescription}>{pkg.description}</Text>
                                            )}

                                            <View style={styles.packagePriceRow}>
                                                <Text style={styles.packagePrice}>₹{displayPrice}</Text>
                                                {savings > 0 && (
                                                    <>
                                                        <Text style={styles.packageOriginalPrice}>₹{individualTotal}</Text>
                                                        <View style={styles.packageDiscountBadge}>
                                                            <Text style={styles.packageDiscountBadgeText}>{savings}% OFF</Text>
                                                        </View>
                                                    </>
                                                )}
                                            </View>

                                            <View style={styles.categoryBadge}>
                                                <Text style={styles.categoryBadgeText}>{pkg.category}</Text>
                                            </View>

                                            <View style={styles.packageTestsList}>
                                                <Text style={styles.packageTestsTitle}>Includes {pkg.tests?.length || 0} test{(pkg.tests?.length || 0) !== 1 ? 's' : ''}</Text>
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                                    {(pkg.tests || []).map(test => (
                                                        <View key={test._id} style={styles.testChip}>
                                                            <Text style={styles.testChipText}>{test.name}</Text>
                                                            <Text style={styles.testChipPrice}>₹{test.price}</Text>
                                                        </View>
                                                    ))}
                                                    {(!pkg.tests || pkg.tests.length === 0) && (
                                                        <Text style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic', marginTop: 4 }}>No tests added yet</Text>
                                                    )}
                                                </View>
                                            </View>

                                            <View style={styles.packageCardActions}>
                                                <TouchableOpacity onPress={() => handleEditPackage(pkg)} style={[styles.btnAction, { flex: 1, backgroundColor: '#f1f5f9' }]}>
                                                    <Text style={[styles.btnActionText, { color: '#475569' }]}>Edit</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleDeletePackage(pkg._id)} style={[styles.btnAction, { flex: 1, backgroundColor: '#fee2e2' }]}>
                                                    <Text style={[styles.btnActionText, { color: '#b91c1c' }]}>Delete</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                )}

                {/* ============== TESTS TAB ============== */}
                {activeTab === 'tests' && (
                    <View style={styles.formCard}>
                        <Text style={styles.formCardTitle}>🧪 All Lab Tests</Text>
                        {loading && !tests.length ? (
                            <View style={{ alignItems: 'center', padding: 20 }}>
                                <ActivityIndicator size="large" color="#0d9488" />
                            </View>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={{ minWidth: 900 }}>
                                    <View style={styles.tableHeader}>
                                        <Text style={[styles.th, { flex: 2 }]}>Name</Text>
                                        <Text style={[styles.th, { flex: 1 }]}>Code</Text>
                                        <Text style={[styles.th, { flex: 1.5 }]}>Category</Text>
                                        <Text style={[styles.th, { flex: 1 }]}>Price</Text>
                                        <Text style={[styles.th, { flex: 2 }]}>In Packages</Text>
                                        <Text style={[styles.th, { flex: 1 }]}>Status</Text>
                                        <Text style={[styles.th, { flex: 1.5, textAlign: 'center' }]}>Actions</Text>
                                    </View>
                                    
                                    {filteredTests.length === 0 ? (
                                        <Text style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>
                                            {searchTerm || categoryFilter ? 'No tests match your filter.' : 'No tests defined yet.'}
                                        </Text>
                                    ) : (
                                        filteredTests.map(test => {
                                            const testPackages = getPackagesForTest(test._id);
                                            return (
                                                <View key={test._id} style={styles.tableRow}>
                                                    <Text style={[styles.td, { flex: 2, fontWeight: '600' }]}>{test.name}</Text>
                                                    <Text style={[styles.td, { flex: 1 }]}>{test.code || '-'}</Text>
                                                    <View style={[styles.td, { flex: 1.5 }]}>
                                                        <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{test.category}</Text></View>
                                                    </View>
                                                    <Text style={[styles.td, { flex: 1, fontWeight: '700', color: '#0d9488' }]}>₹{test.price}</Text>
                                                    <View style={[styles.td, { flex: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }]}>
                                                        {testPackages.length > 0 ? (
                                                            testPackages.map(p => (
                                                                <View key={p._id} style={styles.testPackageChip}>
                                                                    <Text style={styles.testPackageChipText}>{p.name}</Text>
                                                                </View>
                                                            ))
                                                        ) : (
                                                            <Text style={{ color: '#94a3b8', fontSize: 12 }}>—</Text>
                                                        )}
                                                    </View>
                                                    <View style={[styles.td, { flex: 1 }]}>
                                                        <View style={[styles.statusBadge, { backgroundColor: test.isActive ? '#dcfce7' : '#f1f5f9' }]}>
                                                            <Text style={[styles.statusBadgeText, { color: test.isActive ? '#166534' : '#64748b' }]}>{test.isActive ? 'Active' : 'Hidden'}</Text>
                                                        </View>
                                                    </View>
                                                    <View style={[styles.td, { flex: 1.5, flexDirection: 'row', justifyContent: 'center', gap: 6 }]}>
                                                        <TouchableOpacity onPress={() => handleEditTest(test)} style={[styles.btnAction, { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f1f5f9' }]}>
                                                            <Text style={[styles.btnActionText, { color: '#475569', fontSize: 12 }]}>Edit</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => handleDeleteTest(test._id)} style={[styles.btnAction, { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#fee2e2' }]}>
                                                            <Text style={[styles.btnActionText, { color: '#b91c1c', fontSize: 12 }]}>Delete</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            );
                                        })
                                    )}
                                </View>
                            </ScrollView>
                        )}
                    </View>
                )}
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
    btnAction: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnActionText: {
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
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 28,
    },
    statMini: {
        flex: 1,
        minWidth: 180,
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.6)',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
    },
    statValue: {
        fontSize: 28,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    statIcon: {
        fontSize: 24,
        marginBottom: 10,
    },
    tabsContainer: {
        flexDirection: 'row',
        gap: 4,
        backgroundColor: 'rgba(241, 245, 249, 0.6)',
        padding: 6,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.6)',
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    tabBtnActive: {
        backgroundColor: '#fff',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
    },
    tabBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748b',
    },
    tabBtnTextActive: {
        color: '#0d9488',
    },
    tabCount: {
        backgroundColor: 'rgba(13, 148, 136, 0.1)',
        paddingVertical: 2,
        paddingHorizontal: 10,
        borderRadius: 20,
    },
    tabCountActive: {
        backgroundColor: 'rgba(13, 148, 136, 0.15)',
    },
    tabCountText: {
        color: '#0d9488',
        fontSize: 12,
        fontWeight: '700',
    },
    toolbar: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    searchBox: {
        flex: 1,
        minWidth: 240,
        position: 'relative',
        justifyContent: 'center',
    },
    searchIcon: {
        position: 'absolute',
        left: 14,
        zIndex: 1,
    },
    searchInput: {
        width: '100%',
        paddingVertical: 12,
        paddingLeft: 44,
        paddingRight: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.8)',
        backgroundColor: '#fff',
        fontSize: 14,
        color: '#0f172a',
    },
    filterScrollView: {
        flexDirection: 'row',
        paddingVertical: 4,
    },
    filterChip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.8)',
        backgroundColor: '#fff',
        marginRight: 8,
    },
    filterChipActive: {
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.05)',
    },
    filterChipText: {
        fontSize: 14,
        color: '#0f172a',
    },
    filterChipTextActive: {
        color: '#0d9488',
        fontWeight: '600',
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
        backgroundColor: '#0d9488',
        borderColor: '#0d9488',
    },
    testSelectionSection: {
        marginTop: 8,
        marginBottom: 16,
    },
    testSelectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    selectedCount: {
        fontSize: 12,
        color: '#0d9488',
        fontWeight: '600',
        backgroundColor: 'rgba(13, 148, 136, 0.08)',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    testCheckboxes: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        maxHeight: 320,
        overflow: 'hidden', 
        padding: 4,
    },
    testCheckboxItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.6)',
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        width: 260,
    },
    testCheckboxItemChecked: {
        backgroundColor: 'rgba(13, 148, 136, 0.06)',
        borderColor: 'rgba(13, 148, 136, 0.3)',
    },
    testInfo: {
        flex: 1,
    },
    testName: {
        fontWeight: '600',
        color: '#0f172a',
        fontSize: 14,
    },
    testMeta: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    pricePreview: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: 'rgba(13, 148, 136, 0.06)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(13, 148, 136, 0.15)',
        marginTop: 12,
    },
    pricePreviewLabel: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    pricePreviewValue: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0d9488',
    },
    packagesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 20,
        marginTop: 16,
    },
    packageCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.6)',
        padding: 28,
        width: 380,
    },
    packageCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    packageCardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
    },
    packageCode: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    packageStatus: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
    },
    packageStatusActive: {
        backgroundColor: '#dcfce7',
        borderColor: '#bbf7d0',
    },
    packageStatusInactive: {
        backgroundColor: '#f1f5f9',
        borderColor: '#e2e8f0',
    },
    packageStatusText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    packageDescription: {
        color: '#64748b',
        fontSize: 14,
        marginBottom: 16,
        lineHeight: 20,
    },
    packagePriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    packagePrice: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0d9488',
    },
    packageOriginalPrice: {
        fontSize: 16,
        color: '#94a3b8',
        textDecorationLine: 'line-through',
        fontWeight: '500',
    },
    packageDiscountBadge: {
        backgroundColor: '#f59e0b',
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    packageDiscountBadgeText: {
        color: '#78350f',
        fontSize: 11,
        fontWeight: '700',
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
    },
    categoryBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
    },
    packageTestsList: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(226, 232, 240, 0.6)',
        paddingTop: 12,
    },
    packageTestsTitle: {
        fontSize: 12,
        textTransform: 'uppercase',
        color: '#64748b',
        fontWeight: '700',
        marginBottom: 10,
    },
    testChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 5,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(13, 148, 136, 0.08)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(13, 148, 136, 0.15)',
        marginRight: 6,
        marginBottom: 6,
    },
    testChipText: {
        color: '#0f766e',
        fontSize: 13,
        fontWeight: '600',
    },
    testChipPrice: {
        color: '#94a3b8',
        fontSize: 12,
    },
    packageCardActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(226, 232, 240, 0.6)',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        color: '#64748b',
        fontWeight: '700',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
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
    testPackageChip: {
        backgroundColor: 'rgba(13,148,136,0.08)',
        borderRadius: 6,
        paddingVertical: 2,
        paddingHorizontal: 8,
        marginBottom: 2,
    },
    testPackageChipText: {
        color: '#0f766e',
        fontSize: 11,
        fontWeight: '600',
    }
});

export default AdminTestPackages;
