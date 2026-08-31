import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    Dimensions,
    Platform
} from 'react-native';
import { adminAPI } from '../../utils/api';
import { FontAwesome5 } from '@expo/vector-icons';

// Custom Toast / Confirm implementations using Alert for React Native
const toast = {
    success: (msg) => Alert.alert('Success', msg),
    error: (msg) => Alert.alert('Error', msg)
};

const confirmToast = (msg, options) => {
    return new Promise((resolve) => {
        Alert.alert(
            options?.title || 'Confirm',
            msg,
            [
                { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                { text: options?.confirmText || 'Confirm', onPress: () => resolve(true), style: 'destructive' }
            ]
        );
    });
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AdminRoles = () => {
    const [roles, setRoles] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        permissions: [],
        dashboardPath: '/',
        navLinks: [{ label: '', path: '' }]
    });
    const [editingRoleId, setEditingRoleId] = useState(null);
    const [loading, setLoading] = useState(false);

    const scrollViewRef = useRef(null);

    // Organized Permissions List
    const PERMISSIONS = [
        {
            category: "PATIENT MANAGEMENT",
            items: [
                { key: 'patient_create', label: 'Register New Patients' },
                { key: 'patient_search', label: 'Search Patient Database' },
                { key: 'patient_view', label: 'View Patient Profiles' },
                { key: 'patient_edit', label: 'Edit Patient Profiles' }
            ]
        },
        {
            category: "CLINICAL & MEDICAL",
            items: [
                { key: 'visit_intake', label: 'Nurse Intake (Vitals & History)' },
                { key: 'visit_diagnose', label: 'Doctor Diagnosis & Prescription' },
                { key: 'clinical_history_view', label: 'View Medical History' }
            ]
        },
        {
            category: "OPERATIONS",
            items: [
                { key: 'appointment_manage', label: 'Manage Appointments' },
                { key: 'appointment_view_all', label: 'View All Appointments' },
                { key: 'lab_view', label: 'View Lab Tests' },
                { key: 'lab_manage', label: 'Manage Lab Tests' },
                { key: 'pharmacy_view', label: 'View Pharmacy' },
                { key: 'pharmacy_manage', label: 'Pharmacy & Inventory' }
            ]
        },
        {
            category: "FINANCE & ACCOUNTING",
            items: [
                { key: 'finance_view', label: 'View Hospital Financials' },
                { key: 'billing_view', label: 'View Patient Billing' },
                { key: 'billing_manage', label: 'Manage Patient Billing (Cashier)' }
            ]
        },
        {
            category: "ADMIN",
            items: [
                { key: 'admin_manage_roles', label: 'Manage Roles' },
                { key: 'admin_view_stats', label: 'View Admin Stats' }
            ]
        }
    ];

    const PERMISSION_NAV_MAP = {
        patient_create: { label: 'Patient Registration', path: '/reception/dashboard' },
        patient_search: { label: 'Patient Search', path: '/doctor/patients' },
        patient_view: { label: 'Patient Records', path: '/doctor/patients' },
        patient_edit: { label: 'Edit Patients', path: '/doctor/patients' },
        visit_intake: { label: 'Nurse Intake', path: '/doctor/patients' },
        visit_diagnose: { label: 'Consultations', path: '/doctor/patients' },
        clinical_history_view: { label: 'Medical History', path: '/doctor/patients' },
        appointment_manage: { label: 'Reception', path: '/reception/dashboard' },
        appointment_view_all: { label: 'All Appointments', path: '/reception/dashboard' },
        lab_view: { label: 'Lab Dashboard', path: '/lab/dashboard' },
        lab_manage: { label: 'Lab Tests', path: '/lab/tests' },
        pharmacy_view: { label: 'Pharmacy', path: '/pharmacy/inventory' },
        pharmacy_manage: { label: 'Pharmacy Orders', path: '/pharmacy/orders' },
        admin_manage_roles: { label: 'Manage Users', path: '/admin/users' },
        admin_view_stats: { label: 'Admin Dashboard', path: '/admin' },
        finance_view: { label: 'Finance & Accounting', path: '/accountant/dashboard' },
        billing_view: { label: 'Patient Billing', path: '/cashier/billing' },
        billing_manage: { label: 'Patient Billing', path: '/cashier/billing' }
    };

    const getAutoNavLinks = (permissions) => {
        const seen = new Set();
        const links = [];
        permissions.forEach(perm => {
            const mapping = PERMISSION_NAV_MAP[perm];
            if (mapping && !seen.has(mapping.label)) {
                seen.add(mapping.label);
                links.push({ label: mapping.label, path: mapping.path });
            }
        });
        if (permissions.includes('admin_manage_roles') && !seen.has('Manage Roles')) {
            links.push({ label: 'Manage Roles', path: '/admin/roles' });
        }
        return links;
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            const res = await adminAPI.getRoles();
            console.log("🔥 API RESPONSE (AdminRoles):", res);
            const actualData = res?.data?.data || res?.data?.roles || res?.roles || res?.data || res || [];
            setRoles(Array.isArray(actualData) ? actualData : []);
        } catch (err) {
            console.error("Error fetching roles", err);
        }
    };

    const handlePermissionToggle = (key) => {
        setFormData(prev => {
            const exists = prev.permissions.includes(key);
            return {
                ...prev,
                permissions: exists ? prev.permissions.filter(p => p !== key) : [...prev.permissions, key]
            };
        });
    };

    const addNavLink = () => {
        setFormData(prev => ({ ...prev, navLinks: [...prev.navLinks, { label: '', path: '' }] }));
    };

    const updateNavLink = (index, field, value) => {
        const updated = [...formData.navLinks];
        updated[index][field] = value;
        setFormData(prev => ({ ...prev, navLinks: updated }));
    };

    const removeNavLink = (index) => {
        const updated = formData.navLinks.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, navLinks: updated.length ? updated : [{ label: '', path: '' }] }));
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            permissions: [],
            dashboardPath: '/',
            navLinks: [{ label: '', path: '' }]
        });
        setEditingRoleId(null);
    };

    const handleEdit = (role) => {
        setEditingRoleId(role._id);
        setFormData({
            name: role.name,
            description: role.description || '',
            permissions: role.permissions || [],
            dashboardPath: role.dashboardPath || '/',
            navLinks: role.navLinks && role.navLinks.length > 0 ? role.navLinks : [{ label: '', path: '' }]
        });
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    };

    const handleSubmit = async () => {
        setLoading(true);

        const trimmedName = formData.name.trim();
        if (!trimmedName) {
            toast.error('Role Name cannot be empty.');
            setLoading(false);
            return;
        }

        const isDuplicate = roles.some(r => r.name.toLowerCase() === trimmedName.toLowerCase() && r._id !== editingRoleId);
        if (isDuplicate) {
            toast.error('A role with this name already exists.');
            setLoading(false);
            return;
        }

        const pathRegex = /^\S+$/;
        if (formData.dashboardPath && !pathRegex.test(formData.dashboardPath)) {
            toast.error('Dashboard Path cannot contain spaces.');
            setLoading(false);
            return;
        }

        const manualLinks = formData.navLinks.filter(l => l.label.trim() && l.path.trim());
        for (const link of manualLinks) {
            if (!pathRegex.test(link.path)) {
                toast.error('Navigation paths cannot contain spaces.');
                setLoading(false);
                return;
            }
        }

        const autoLinks = getAutoNavLinks(formData.permissions);
        const combinedLinks = [...manualLinks];
        autoLinks.forEach(auto => {
            if (!combinedLinks.find(c => c.path === auto.path || c.label === auto.label)) {
                combinedLinks.push(auto);
            }
        });

        const cleanedData = {
            ...formData,
            navLinks: combinedLinks
        };

        try {
            if (editingRoleId) {
                await adminAPI.updateRole(editingRoleId, cleanedData);
                toast.success('Role updated successfully!');
            } else {
                await adminAPI.createRole(cleanedData);
                toast.success('Role created successfully!');
            }
            resetForm();
            fetchRoles();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving role');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, roleName) => {
        const confirmed = await confirmToast(
            `Are you sure you want to permanently delete the role "${roleName}"?`,
            { title: 'Delete Role', confirmText: 'Delete Role' }
        );
        if (!confirmed) return;

        try {
            await adminAPI.deleteRole(id);
            fetchRoles();
            toast.success(`Role "${roleName}" deleted successfully!`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete role');
        }
    };

    const permCount = formData.permissions.length;

    return (
        <ScrollView style={styles.rpmMainWrapper} contentContainerStyle={styles.rpmMainWrapperContent} ref={scrollViewRef}>
            <View style={styles.rpmHeaderRow}>
                <View style={styles.rpmHeaderLeft}>
                    <Text style={styles.rpmHeaderTitle}>Role & Permission Manager</Text>
                    <Text style={styles.rpmHeaderSubtitle}>Construct custom access levels, matrix permissions & sidebar navigation</Text>
                </View>
            </View>

            <View style={styles.rpmDashboardGrid}>
                {/* ─── LEFT PANEL: CREATE / EDIT ROLE ─── */}
                <View style={styles.rpmPanel}>
                    <View style={styles.rpmPanelHeader}>
                        <Text style={styles.rpmPanelHeaderTitle}>{editingRoleId ? 'Edit Role' : 'Create New Role'}</Text>
                        {editingRoleId && (
                            <TouchableOpacity onPress={resetForm} style={styles.rpmBtnCancelEdit}>
                                <Text style={styles.rpmBtnCancelEditText}>Cancel Edit</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View>
                        <View style={styles.rpmFormGroup}>
                            <Text style={styles.rpmFormLabel}>Role Name *</Text>
                            <TextInput
                                style={styles.rpmFormInput}
                                value={formData.name}
                                onChangeText={text => setFormData({ ...formData, name: text.slice(0, 100) })}
                                placeholder="e.g. Senior Nurse"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>

                        <View style={styles.rpmFormGroup}>
                            <Text style={styles.rpmFormLabel}>Description</Text>
                            <TextInput
                                style={styles.rpmFormInput}
                                value={formData.description}
                                onChangeText={text => setFormData({ ...formData, description: text.slice(0, 1000) })}
                                placeholder="What is this role for?"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>

                        <View style={styles.rpmFormGroup}>
                            <Text style={styles.rpmFormLabel}>Dashboard Path</Text>
                            <TextInput
                                style={styles.rpmFormInput}
                                value={formData.dashboardPath}
                                onChangeText={text => setFormData({ ...formData, dashboardPath: text.slice(0, 300) })}
                                placeholder="Dashboard Path (e.g. /reception/dashboard)"
                                placeholderTextColor="#94a3b8"
                            />
                        </View>

                        <View style={styles.rpmFormGroup}>
                            <Text style={styles.rpmFormLabel}>Navigation Links</Text>
                            {formData.navLinks.map((link, index) => (
                                <View key={index} style={styles.rpmNavLinkBlock}>
                                    <View style={[styles.rpmInputRow, { marginBottom: 8 }]}>
                                        <TextInput
                                            style={[styles.rpmFormInput, { flex: 1 }]}
                                            placeholder="Label (e.g. Patients)"
                                            placeholderTextColor="#94a3b8"
                                            value={link.label}
                                            onChangeText={text => updateNavLink(index, 'label', text.slice(0, 300))}
                                        />
                                        <View style={styles.rpmIconBtn}>
                                            <FontAwesome5 name="plus" size={13} color="#4a6072" />
                                        </View>
                                    </View>
                                    <View style={styles.rpmInputRow}>
                                        <TextInput
                                            style={[styles.rpmFormInput, { flex: 1 }]}
                                            placeholder="Path (e.g. /patients)"
                                            placeholderTextColor="#94a3b8"
                                            value={link.path}
                                            onChangeText={text => updateNavLink(index, 'path', text.slice(0, 300))}
                                        />
                                        <View style={styles.rpmIconBtn}>
                                            <FontAwesome5 name="folder" size={13} color="#4a6072" />
                                        </View>
                                        {formData.navLinks.length > 1 && (
                                            <TouchableOpacity
                                                style={[styles.rpmIconBtn, styles.deleteBtn]}
                                                onPress={() => removeNavLink(index)}
                                            >
                                                <FontAwesome5 name="times" size={13} color="#ef4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            ))}

                            <TouchableOpacity style={styles.rpmAddLinkBtn} onPress={addNavLink}>
                                <Text style={styles.rpmAddLinkBtnText}>+ Add Link</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ASSIGN PERMISSIONS SECTION */}
                        <View style={styles.rpmPermSection}>
                            <View style={styles.rpmPermHeaderFlex}>
                                <Text style={styles.rpmPermTitle}>ASSIGN PERMISSIONS</Text>
                                <View style={styles.rpmPermCounterBadge}>
                                    <Text style={styles.rpmPermCounter}>{permCount} selected</Text>
                                </View>
                            </View>

                            <View style={styles.rpmPermGridWrapper}>
                                <View style={styles.rpmPermCategoriesList}>
                                    {PERMISSIONS.map((cat) => (
                                        <View key={cat.category} style={styles.rpmCatBlock}>
                                            <Text style={styles.rpmPermSub}>{cat.category}</Text>
                                            <View style={styles.rpmCheckboxList}>
                                                {cat.items.map(item => {
                                                    const isChecked = formData.permissions.includes(item.key);
                                                    return (
                                                        <TouchableOpacity 
                                                            key={item.key} 
                                                            style={[styles.rpmCheckboxItem, isChecked && styles.rpmCheckboxItemActive]}
                                                            onPress={() => handlePermissionToggle(item.key)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <View style={styles.checkboxControl}>
                                                                {isChecked && <FontAwesome5 name="check" size={10} color="#38b2a1" />}
                                                            </View>
                                                            <Text style={[styles.rpmCheckboxItemText, isChecked && styles.rpmCheckboxItemTextActive]}>{item.label}</Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    ))}
                                </View>

                                {/* Hexagonal Nodes Visual Overlay (Simplified for React Native) */}
                                {Platform.OS === 'web' && SCREEN_WIDTH > 480 && (
                                    <View style={styles.rpmHexMatrixContainer}>
                                        <View style={styles.rpmHexRow}>
                                            <View style={[styles.rpmHexCell, permCount >= 1 && styles.rpmHexCellActive]}><Text style={[styles.rpmHexCellText, permCount >= 1 && styles.rpmHexCellTextActive]}>{permCount >= 1 ? '✓' : ''}</Text></View>
                                            <View style={[styles.rpmHexCell, permCount >= 2 && styles.rpmHexCellActive]}><Text style={[styles.rpmHexCellText, permCount >= 2 && styles.rpmHexCellTextActive]}>{permCount >= 2 ? '✦' : ''}</Text></View>
                                            <View style={[styles.rpmHexCell, permCount >= 3 && styles.rpmHexCellActive]}><Text style={[styles.rpmHexCellText, permCount >= 3 && styles.rpmHexCellTextActive]}>{permCount >= 3 ? '✓' : ''}</Text></View>
                                            <View style={[styles.rpmHexCell, permCount >= 4 && styles.rpmHexCellActive]}><Text style={[styles.rpmHexCellText, permCount >= 4 && styles.rpmHexCellTextActive]}>{permCount >= 4 ? '✓' : ''}</Text></View>
                                        </View>
                                        <View style={[styles.rpmHexRow, styles.rpmHexRowOffset]}>
                                            <View style={[styles.rpmHexCell, permCount >= 5 && styles.rpmHexCellActive]}><Text style={[styles.rpmHexCellText, permCount >= 5 && styles.rpmHexCellTextActive]}>{permCount >= 5 ? '✓' : ''}</Text></View>
                                            <View style={[styles.rpmHexCell, permCount >= 6 && styles.rpmHexCellActive]}><Text style={[styles.rpmHexCellText, permCount >= 6 && styles.rpmHexCellTextActive]}>{permCount >= 6 ? '✓' : ''}</Text></View>
                                            <View style={[styles.rpmHexCell, permCount >= 7 && styles.rpmHexCellActive]}><Text style={[styles.rpmHexCellText, permCount >= 7 && styles.rpmHexCellTextActive]}>{permCount >= 7 ? '✦' : ''}</Text></View>
                                        </View>
                                        <View style={styles.rpmHexRow}>
                                            <View style={[styles.rpmHexCell, permCount >= 8 && styles.rpmHexCellActive]}><Text style={[styles.rpmHexCellText, permCount >= 8 && styles.rpmHexCellTextActive]}>{permCount >= 8 ? '✓' : ''}</Text></View>
                                            <View style={[styles.rpmHexCell, permCount >= 9 && styles.rpmHexCellActive]}><Text style={[styles.rpmHexCellText, permCount >= 9 && styles.rpmHexCellTextActive]}>{permCount >= 9 ? '✓' : ''}</Text></View>
                                            <View style={[styles.rpmHexCell, permCount >= 10 && styles.rpmHexCellActive]}><Text style={[styles.rpmHexCellText, permCount >= 10 && styles.rpmHexCellTextActive]}>{permCount >= 10 ? '✦' : ''}</Text></View>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>

                        <TouchableOpacity 
                            style={[styles.rpmBtnSubmit, loading && styles.rpmBtnSubmitDisabled]} 
                            onPress={handleSubmit} 
                            disabled={loading}
                        >
                            <Text style={styles.rpmBtnSubmitText}>
                                {loading ? 'Saving...' : editingRoleId ? 'Update Role' : 'Create Role'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ─── RIGHT PANEL: ACTIVE ROLES ─── */}
                <View style={styles.rpmPanel}>
                    <View style={styles.rpmPanelHeader}>
                        <Text style={styles.rpmPanelHeaderTitle}>Active Roles</Text>
                        <View style={styles.rpmBadgeCountContainer}>
                            <Text style={styles.rpmBadgeCount}>{roles.length} roles found</Text>
                        </View>
                    </View>

                    <View style={styles.rpmRolesList}>
                        {roles.length === 0 && (
                            <View style={styles.rpmEmptyState}>
                                <Text style={styles.rpmEmptyStateText}>No roles defined yet. Create one on the left!</Text>
                            </View>
                        )}

                        {roles.map((role, idx) => {
                            const isSelected = editingRoleId === role._id || (!editingRoleId && idx === 0);
                            const perms = role.permissions || [];

                            return (
                                <View
                                    key={role._id}
                                    style={[styles.rpmRoleCard, isSelected && styles.rpmRoleCardHighlight]}
                                >
                                    <View style={styles.rpmCardActions}>
                                        <TouchableOpacity
                                            style={styles.rpmActionBtn}
                                            onPress={() => handleEdit(role)}
                                        >
                                            <FontAwesome5 name="edit" size={12} color="#627d98" />
                                        </TouchableOpacity>
                                        {!role.isSystemRole && (
                                            <TouchableOpacity
                                                style={[styles.rpmActionBtn, styles.deleteActionBtn]}
                                                onPress={() => handleDelete(role._id, role.name)}
                                            >
                                                <FontAwesome5 name="trash" size={12} color="#ef4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <View style={styles.rpmRoleCardTop}>
                                        <Text style={styles.rpmRoleName}>{role.name}</Text>
                                        <View style={styles.rpmBadgesGroup}>
                                            <View style={[styles.rpmTagBadge, styles.rpmTagBlue]}>
                                                <Text style={[styles.rpmTagBadgeText, styles.rpmTagBlueText]}>{perms.length} perms</Text>
                                            </View>
                                            {role.userCount > 0 && (
                                                <View style={[styles.rpmTagBadge, styles.rpmTagSoftBlue]}>
                                                    <Text style={[styles.rpmTagBadgeText, styles.rpmTagSoftBlueText]}>
                                                        {role.userCount} user{role.userCount !== 1 ? 's' : ''}
                                                    </Text>
                                                </View>
                                            )}
                                            {role.isSystemRole && (
                                                <View style={[styles.rpmTagBadge, styles.rpmTagYellow]}>
                                                    <Text style={[styles.rpmTagBadgeText, styles.rpmTagYellowText]}>System</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    <Text style={styles.rpmRoleDesc}>
                                        {role.description || "No description provided."}
                                    </Text>

                                    <View style={styles.rpmTagPills}>
                                        {perms.slice(0, 3).map(p => (
                                            <View key={p} style={styles.rpmPill}>
                                                <Text style={styles.rpmPillText}>{p.replace(/_/g, ' ')}</Text>
                                            </View>
                                        ))}
                                        {perms.length > 3 && (
                                            <View style={[styles.rpmPill, styles.rpmPillMore]}>
                                                <Text style={[styles.rpmPillText, styles.rpmPillMoreText]}>+{perms.length - 3} more</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};
// -------------------------------------------------------------
// EXACT 1:1 CSS TO STYLESHEET CONVERSION
// -------------------------------------------------------------
const styles = StyleSheet.create({
    rpmMainWrapper: {
        flex: 1,
        backgroundColor: '#e2eaf0', // Fallback for radial-gradient(circle at 50% 50%, #e2eaf0 0%, #bdcdd7 100%)
    },
    rpmMainWrapperContent: {
        paddingVertical: 30,
        paddingHorizontal: Platform.OS === 'web' && SCREEN_WIDTH > 1024 ? 40 : 16,
        minHeight: '100%',
    },
    rpmHeaderRow: {
        marginBottom: 24,
        zIndex: 1,
    },
    rpmHeaderLeft: {
        // Just for structure
    },
    rpmHeaderTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1b2e3b',
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    rpmHeaderSubtitle: {
        fontSize: 13,
        color: '#5a7184',
        fontWeight: '500',
    },
    rpmDashboardGrid: {
        flexDirection: Platform.OS === 'web' && SCREEN_WIDTH > 1024 ? 'row' : 'column',
        gap: 30,
        zIndex: 1,
        alignItems: 'flex-start',
    },
    rpmPanel: {
        flex: Platform.OS === 'web' && SCREEN_WIDTH > 1024 ? 1 : 0,
        width: Platform.OS === 'web' && SCREEN_WIDTH > 1024 ? 'auto' : '100%',
        backgroundColor: 'rgba(235, 244, 249, 0.95)', // Simulated blur fallback
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.9)',
        paddingVertical: 24,
        paddingHorizontal: 26,
        overflow: 'hidden',
        // Shadow mappings
        shadowColor: 'rgba(80, 110, 130, 0.22)',
        shadowOffset: { width: -10, height: 20 },
        shadowOpacity: 1,
        shadowRadius: 45,
        elevation: 5,
    },
    rpmPanelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    rpmPanelHeaderTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1b2e3b',
    },
    rpmBtnCancelEdit: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    rpmBtnCancelEditText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#ef4444',
    },
    rpmFormGroup: {
        marginBottom: 14,
    },
    rpmFormLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4a6072',
        marginBottom: 6,
    },
    rpmFormInput: {
        width: '100%',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(180, 205, 220, 0.85)',
        backgroundColor: 'rgba(245, 250, 252, 0.9)',
        color: '#1e293b',
        fontSize: 13.5,
    },
    rpmNavLinkBlock: {
        backgroundColor: 'rgba(240, 247, 250, 0.5)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
    },
    rpmInputRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
    },
    rpmIconBtn: {
        width: 36,
        height: 36,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderWidth: 1,
        borderColor: 'rgba(180, 205, 220, 0.85)',
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteBtn: {
        // additional styling if needed for delete button
    },
    rpmAddLinkBtn: {
        width: '100%',
        padding: 8,
        backgroundColor: 'rgba(210, 225, 235, 0.45)',
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#90b0c0',
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 16,
    },
    rpmAddLinkBtnText: {
        fontSize: 12,
        color: '#334e68',
        fontWeight: '700',
    },
    rpmPermSection: {
        backgroundColor: 'rgba(240, 247, 250, 0.65)',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.85)',
        marginBottom: 20,
        position: 'relative',
    },
    rpmPermHeaderFlex: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    rpmPermTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        letterSpacing: 0.6,
        color: '#334e68',
    },
    rpmPermCounterBadge: {
        backgroundColor: 'rgba(182, 234, 230, 0.7)',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(56, 178, 161, 0.3)',
    },
    rpmPermCounter: {
        fontSize: 11,
        fontWeight: '700',
        color: '#0c5e56',
    },
    rpmPermGridWrapper: {
        position: 'relative',
    },
    rpmPermCategoriesList: {
        maxHeight: 380,
    },
    rpmCatBlock: {
        marginBottom: 16,
    },
    rpmPermSub: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#627d98',
        marginBottom: 8,
        letterSpacing: 0.4,
    },
    rpmCheckboxList: {
        flexDirection: 'column',
        gap: 7,
    },
    rpmCheckboxItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    rpmCheckboxItemActive: {
        // active state styling for background not well supported without state, handled via text color
    },
    checkboxControl: {
        width: 15,
        height: 15,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 3,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff'
    },
    rpmCheckboxItemText: {
        fontSize: 12.5,
        color: '#243b53',
        fontWeight: '500',
    },
    rpmCheckboxItemTextActive: {
        color: '#0c5e56',
        fontWeight: '600',
    },
    rpmHexMatrixContainer: {
        position: 'absolute',
        top: 10,
        right: 10,
        flexDirection: 'column',
        gap: 5,
        opacity: 0.85,
    },
    rpmHexRow: {
        flexDirection: 'row',
        gap: 4,
    },
    rpmHexRowOffset: {
        marginLeft: 17,
    },
    rpmHexCell: {
        width: 32,
        height: 28,
        backgroundColor: 'rgba(185, 210, 222, 0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        // In RN, true hexagon clipping is hard without SVG, falling back to rounded rects visually similar
        borderRadius: 6,
    },
    rpmHexCellActive: {
        backgroundColor: '#73e6d6',
        shadowColor: 'rgba(115, 230, 214, 0.9)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 14,
        elevation: 3,
        transform: [{ scale: 1.08 }],
    },
    rpmHexCellText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#102a43',
    },
    rpmHexCellTextActive: {
        color: '#044e45',
    },
    rpmBtnSubmit: {
        width: '100%',
        paddingVertical: 13,
        paddingHorizontal: 20,
        backgroundColor: '#38b2a1', // Fallback for linear-gradient(135deg, #38b2a1 0%, #2ba594 100%)
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: 'rgba(56, 178, 161, 0.35)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 16,
        elevation: 4,
    },
    rpmBtnSubmitDisabled: {
        backgroundColor: '#94a3b8',
        shadowOpacity: 0,
        elevation: 0,
    },
    rpmBtnSubmitText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    rpmBadgeCountContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.9)',
    },
    rpmBadgeCount: {
        fontSize: 11.5,
        fontWeight: '600',
        color: '#4a6072',
    },
    rpmRolesList: {
        flexDirection: 'column',
        gap: 12,
        maxHeight: Platform.OS === 'web' ? 720 : undefined,
    },
    rpmEmptyState: {
        paddingVertical: 40,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    rpmEmptyStateText: {
        color: '#64748b',
        fontSize: 14,
        textAlign: 'center',
    },
    rpmRoleCard: {
        backgroundColor: 'rgba(248, 252, 254, 0.85)',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.85)',
        shadowColor: 'rgba(100, 130, 150, 0.08)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 14,
        elevation: 2,
    },
    rpmRoleCardHighlight: {
        backgroundColor: 'rgba(245, 250, 252, 0.88)', // Gradient fallback
        borderLeftWidth: 4.5,
        borderLeftColor: '#38b2a1',
        shadowColor: 'rgba(56, 178, 161, 0.18)',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 1,
        shadowRadius: 18,
        elevation: 4,
    },
    rpmCardActions: {
        position: 'absolute',
        right: 14,
        top: 14,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        zIndex: 2,
    },
    rpmActionBtn: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderWidth: 1,
        borderColor: 'rgba(180, 205, 220, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteActionBtn: {
        // Red overrides inline
    },
    rpmRoleCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingRight: Platform.OS === 'web' && SCREEN_WIDTH > 480 ? 68 : 0,
        flexWrap: 'wrap',
    },
    rpmRoleName: {
        fontWeight: '700',
        fontSize: 15,
        color: '#102a43',
    },
    rpmBadgesGroup: {
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
    },
    rpmTagBadge: {
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    rpmTagBadgeText: {
        fontSize: 10.5,
        fontWeight: '700',
    },
    rpmTagBlue: {
        backgroundColor: '#38b2a1',
    },
    rpmTagBlueText: {
        color: '#ffffff',
    },
    rpmTagYellow: {
        backgroundColor: '#fef08a',
        borderColor: '#fde047',
    },
    rpmTagYellowText: {
        color: '#854d0e',
    },
    rpmTagSoftBlue: {
        backgroundColor: '#bae6fd',
        borderColor: '#7dd3fc',
    },
    rpmTagSoftBlueText: {
        color: '#0369a1',
    },
    rpmRoleDesc: {
        fontSize: 12,
        color: '#627d98',
        marginVertical: 6,
        marginBottom: 10,
        lineHeight: 16,
    },
    rpmTagPills: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
    },
    rpmPill: {
        backgroundColor: 'rgba(215, 230, 240, 0.7)',
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(185, 210, 222, 0.5)',
    },
    rpmPillText: {
        fontSize: 10.5,
        color: '#334e68',
        fontWeight: '600',
    },
    rpmPillMore: {
        backgroundColor: 'rgba(182, 234, 230, 0.6)',
        borderColor: 'rgba(56, 178, 161, 0.4)',
    },
    rpmPillMoreText: {
        color: '#0c5e56',
    }
});

export default AdminRoles;
