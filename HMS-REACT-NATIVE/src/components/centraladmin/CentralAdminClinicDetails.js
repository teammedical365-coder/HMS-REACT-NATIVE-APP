import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Pressable,
    StyleSheet,
    ActivityIndicator,
    TextInput,
    Alert,
    Switch,
    ScrollView,
    Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { simpleClinicAPI } from '../../utils/api';

const CentralAdminClinicDetails = ({ clinic, onBack }) => {
    const clinicId = clinic?._id || clinic?.id;

    // States
    const [loadingStats, setLoadingStats] = useState(true);
    const [clinicStats, setClinicStats] = useState(null);
    const [clinicSubscriptions, setClinicSubscriptions] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Appointment Mode
    const [clinicApptMode, setClinicApptMode] = useState(clinic?.appointmentMode || 'token');
    const [savingApptMode, setSavingApptMode] = useState(false);

    // Admin Account Form
    const [showManagerForm, setShowManagerForm] = useState(false);
    const [managerForm, setManagerForm] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        age: '',
        aadhaarNumber: ''
    });
    const [savingManager, setSavingManager] = useState(false);

    // Staff Account Form
    const [showStaffForm, setShowStaffForm] = useState(false);
    const [staffForm, setStaffForm] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        age: '',
        aadhaarNumber: '',
        staffRole: 'doctor'
    });
    const [savingStaff, setSavingStaff] = useState(false);

    // Billing / Rate Form
    const [rateForm, setRateForm] = useState({
        ratePerPatient: clinic?.subscription?.ratePerPatient ?? '',
        billingEnabled: clinic?.subscription?.billingEnabled ?? false
    });
    const [savingRate, setSavingRate] = useState(false);

    // Load Clinic Details and Statistics
    const loadClinicData = useCallback(async () => {
        if (!clinicId) return;
        // Safeguard: If facility is marked as a hospital, don't query simple clinic endpoints
        if (clinic?.clinicType && clinic.clinicType !== 'clinic') {
            setError('Selected facility is a hospital. Please view under hospital details.');
            setLoadingStats(false);
            return;
        }
        setLoadingStats(true);
        setError('');
        try {
            const [statsRes, subRes] = await Promise.all([
                simpleClinicAPI.getStats(clinicId),
                simpleClinicAPI.getSubscriptions(clinicId)
            ]);

            if (statsRes && statsRes.success) {
                setClinicStats(statsRes);
                if (statsRes.clinic) {
                    setClinicApptMode(statsRes.clinic.appointmentMode || 'token');
                    setRateForm({
                        ratePerPatient: String(statsRes.clinic.subscription?.ratePerPatient ?? ''),
                        billingEnabled: Boolean(statsRes.clinic.subscription?.billingEnabled)
                    });
                }
            } else {
                setError(statsRes?.message || 'Failed to load clinic statistics');
            }

            if (subRes && subRes.success) {
                setClinicSubscriptions(Array.isArray(subRes.subscriptions) ? subRes.subscriptions : []);
            }
        } catch (err) {
            if (err?.response?.status === 404) {
                console.warn('Clinic operations endpoint returned 404 for clinicId:', clinicId);
                setError('No operations data found for this clinic');
            } else {
                console.error('Error fetching clinic operations data:', err);
                setError(err?.response?.data?.message || 'Failed to communicate with clinic server');
            }
        } finally {
            setLoadingStats(false);
        }
    }, [clinicId, clinic?.clinicType]);

    useEffect(() => {
        loadClinicData();
    }, [loadClinicData]);

    // Handle Appointment Mode Change
    const handleSaveApptMode = async () => {
        setSavingApptMode(true);
        setError('');
        setSuccess('');
        try {
            const res = await simpleClinicAPI.updateAppointmentMode(clinicId, clinicApptMode);
            if (res && res.success) {
                setSuccess(`Appointment mode successfully updated to ${clinicApptMode === 'token' ? 'Token Queue' : 'Time Slot'} system.`);
                loadClinicData();
            } else {
                setError(res?.message || 'Failed to update appointment mode');
            }
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Error updating appointment mode');
        } finally {
            setSavingApptMode(false);
        }
    };

    // Handle Billing Rate Save
    const handleSaveRate = async () => {
        setSavingRate(true);
        setError('');
        setSuccess('');
        try {
            const payload = {
                ratePerPatient: Number(rateForm.ratePerPatient || 0),
                billingEnabled: Boolean(rateForm.billingEnabled)
            };
            const res = await simpleClinicAPI.setRate(clinicId, payload);
            if (res && res.success) {
                setSuccess('Billing rate configuration saved successfully!');
                loadClinicData();
            } else {
                setError(res?.message || 'Failed to save billing rate');
            }
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Error updating billing rate');
        } finally {
            setSavingRate(false);
        }
    };

    // Handle Mark Subscription Paid / Waived
    const handleUpdateSubscription = async (subId, status) => {
        setError('');
        setSuccess('');
        try {
            const res = await simpleClinicAPI.updateSubscription(clinicId, subId, { status });
            if (res && res.success) {
                setClinicSubscriptions(prev => prev.map(s => s._id === subId ? (res.subscription || { ...s, status }) : s));
                setSuccess(`Month marked as ${status.toUpperCase()}`);
            } else {
                setError(res?.message || `Failed to update status to ${status}`);
            }
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Error updating subscription');
        }
    };

    // Handle Create Clinic Manager / Admin
    const handleCreateManager = async () => {
        if (!managerForm.name.trim() || !managerForm.email.trim() || !managerForm.password.trim()) {
            Alert.alert('Required Fields', 'Please enter Name, Email, and Password');
            return;
        }
        if (managerForm.phone && managerForm.phone.length !== 10) {
            Alert.alert('Validation', 'Phone number must be exactly 10 digits');
            return;
        }
        setSavingManager(true);
        setError('');
        setSuccess('');
        try {
            const res = await simpleClinicAPI.createManager(clinicId, managerForm);
            if (res && res.success) {
                setSuccess(`Clinic Admin created successfully! ${res.manager?.name || managerForm.name} can now log in.`);
                setManagerForm({ name: '', email: '', password: '', phone: '', age: '', aadhaarNumber: '' });
                setShowManagerForm(false);
                loadClinicData();
            } else {
                setError(res?.message || 'Failed to create clinic manager');
            }
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Error creating clinic admin');
        } finally {
            setSavingManager(false);
        }
    };

    // Handle Create Clinic Staff
    const handleCreateStaff = async () => {
        if (!staffForm.name.trim() || !staffForm.email.trim() || !staffForm.password.trim()) {
            Alert.alert('Required Fields', 'Please enter Name, Email, and Password');
            return;
        }
        if (staffForm.phone && staffForm.phone.length !== 10) {
            Alert.alert('Validation', 'Phone number must be exactly 10 digits');
            return;
        }
        setSavingStaff(true);
        setError('');
        setSuccess('');
        try {
            const res = await simpleClinicAPI.createStaff(clinicId, staffForm);
            if (res && res.success) {
                setSuccess('Staff member added successfully!');
                setStaffForm({ name: '', email: '', password: '', phone: '', age: '', aadhaarNumber: '', staffRole: 'doctor' });
                setShowStaffForm(false);
                loadClinicData();
            } else {
                setError(res?.message || 'Failed to add staff member');
            }
        } catch (err) {
            setError(err?.response?.data?.message || err.message || 'Error adding staff');
        } finally {
            setSavingStaff(false);
        }
    };

    // Handle Delete Staff
    const handleDeleteStaff = (staffId, staffName) => {
        Alert.alert(
            'Remove Staff Member',
            `Are you sure you want to remove ${staffName || 'this staff member'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const res = await simpleClinicAPI.deleteStaff(clinicId, staffId);
                            if (res && res.success) {
                                setSuccess('Staff member removed successfully');
                                loadClinicData();
                            } else {
                                setError(res?.message || 'Failed to delete staff member');
                            }
                        } catch (err) {
                            setError(err?.response?.data?.message || err.message || 'Error removing staff');
                        }
                    }
                }
            ]
        );
    };

    const stats = clinicStats?.stats || {};
    const clinicObj = clinicStats?.clinic || clinic;
    const adminUser = clinicObj?.adminUserId;
    const staffList = stats?.staff || [];
    const recentAppointments = stats?.recentAppointments || [];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* ====== TOP HEADER & HERO BANNER ====== */}
            <View style={styles.heroBanner}>
                <View style={styles.heroTopRow}>
                    <View style={styles.clinicBadge}>
                        <Feather name="shield" size={14} color="#38bdf8" />
                        <Text style={styles.clinicBadgeText}>Clinic Profile</Text>
                    </View>
                    <Pressable 
                        onPress={onBack} 
                        style={({ pressed, hovered }) => [
                            styles.backBtn,
                            Platform.select({ web: { transition: 'all 0.15s ease', cursor: 'pointer' } }),
                            hovered && { backgroundColor: '#e2e8f0', transform: [{ translateY: -1 }] },
                            pressed && { transform: [{ scale: 0.97 }] }
                        ]}
                    >
                        <Feather name="arrow-left" size={16} color="#0f172a" />
                        <Text style={styles.backBtnText}>Back</Text>
                    </Pressable>
                </View>

                <View style={styles.heroMain}>
                    <View style={styles.iconCircle}>
                        <Feather name="plus-circle" size={32} color="#ffffff" />
                    </View>
                    <View style={styles.heroInfo}>
                        <Text style={styles.clinicName}>{clinicObj.name || 'Clinic'}</Text>
                        <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                                <Feather name="map-pin" size={12} color="#64748b" />
                                <Text style={styles.metaText}>
                                    {clinicObj.city ? `${clinicObj.city}${clinicObj.state ? `, ${clinicObj.state}` : ''}` : (clinicObj.address || 'Clinic Location')}
                                </Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Feather name="phone" size={12} color="#64748b" />
                                <Text style={styles.metaText}>{clinicObj.phone || 'N/A'}</Text>
                            </View>
                            {clinicObj.slug ? (
                                <View style={[styles.metaItem, styles.slugItem]}>
                                    <Feather name="link" size={12} color="#0d9488" />
                                    <Text style={styles.slugText}>{clinicObj.slug}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </View>

                {/* Status Bar */}
                <View style={styles.heroStatusBar}>
                    <View style={styles.statusItem}>
                        <Feather name="users" size={14} color="#6366f1" />
                        <Text style={styles.statusLabel}>Staff Members: </Text>
                        <Text style={styles.statusVal}>{staffList.length}</Text>
                    </View>
                    <View style={[styles.activePill, clinicObj.isActive === false ? styles.inactivePill : styles.activePillColor]}>
                        <View style={[styles.liveDot, clinicObj.isActive === false && { backgroundColor: '#ef4444' }]} />
                        <Text style={[styles.activePillText, clinicObj.isActive === false && { color: '#b91c1c' }]}>
                            {clinicObj.isActive === false ? 'INACTIVE' : 'ACTIVE'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* ====== NOTIFICATIONS ====== */}
            {Boolean(error) && (
                <View style={styles.errorAlert}>
                    <Feather name="alert-triangle" size={16} color="#dc2626" />
                    <Text style={styles.errorAlertText}>{error}</Text>
                </View>
            )}
            {Boolean(success) && (
                <View style={styles.successAlert}>
                    <Feather name="check-circle" size={16} color="#16a34a" />
                    <Text style={styles.successAlertText}>{success}</Text>
                </View>
            )}

            {/* ====== LOADING SPINNER ====== */}
            {loadingStats && !clinicStats ? (
                <View style={styles.loaderBox}>
                    <ActivityIndicator size="large" color="#2563eb" />
                    <Text style={styles.loaderText}>Synchronizing Clinic Intelligence...</Text>
                </View>
            ) : (
                <View>
                    {/* ====== 1. KPI CARDS GRID ====== */}
                    <View style={styles.kpiGrid}>
                        <View style={[styles.kpiCard, { borderLeftColor: '#3b82f6' }]}>
                            <Feather name="users" size={20} color="#3b82f6" />
                            <Text style={styles.kpiVal}>{stats.totalPatients ?? 0}</Text>
                            <Text style={styles.kpiLbl}>Total Patients</Text>
                            <Text style={styles.kpiSub}>Registered patients</Text>
                        </View>

                        <View style={[styles.kpiCard, { borderLeftColor: '#8b5cf6' }]}>
                            <Feather name="calendar" size={20} color="#8b5cf6" />
                            <Text style={styles.kpiVal}>{stats.totalAppointments ?? 0}</Text>
                            <Text style={styles.kpiLbl}>Appointments</Text>
                            <Text style={styles.kpiSub}>Booked consults</Text>
                        </View>

                        <View style={[styles.kpiCard, { borderLeftColor: '#10b981' }]}>
                            <Feather name="check-circle" size={20} color="#10b981" />
                            <Text style={styles.kpiVal}>{stats.completedAppointments ?? 0}</Text>
                            <Text style={styles.kpiLbl}>Completed</Text>
                            <Text style={styles.kpiSub}>Finished visits</Text>
                        </View>

                        <View style={[styles.kpiCard, { borderLeftColor: '#f59e0b' }]}>
                            <Text style={{ fontSize: 18, color: '#f59e0b', fontWeight: '800' }}>₹</Text>
                            <Text style={styles.kpiVal}>₹{(stats.revenue ?? 0).toLocaleString('en-IN')}</Text>
                            <Text style={styles.kpiLbl}>Revenue</Text>
                            <Text style={styles.kpiSub}>From paid visits</Text>
                        </View>
                    </View>

                    {/* ====== 2. CLINIC ADMIN ACCOUNT CARD ====== */}
                    <View style={styles.sectionCard}>
                        <View style={styles.cardHeaderRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>👤 Clinic Admin Account</Text>
                                <Text style={styles.cardSub}>Full administration access to this clinic.</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.actionBtnPrimary, showManagerForm && styles.actionBtnCancel]}
                                onPress={() => {
                                    setShowManagerForm(!showManagerForm);
                                    setShowStaffForm(false);
                                }}
                            >
                                <Text style={[styles.actionBtnPrimaryText, showManagerForm && styles.actionBtnCancelText]}>
                                    {showManagerForm ? 'Cancel' : adminUser ? '🔄 Update Admin' : '+ Add Clinic Admin'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Existing Admin Info */}
                        {adminUser && !showManagerForm && (
                            <View style={styles.adminProfileBox}>
                                <View style={styles.adminAvatar}>
                                    <Text style={styles.adminAvatarText}>
                                        {(adminUser.name || 'A').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.adminName}>{adminUser.name}</Text>
                                    <Text style={styles.adminEmail}>{adminUser.email}</Text>
                                    {adminUser.phone && <Text style={styles.adminPhone}>📞 {adminUser.phone}</Text>}
                                </View>
                                <View style={styles.adminRoleBadge}>
                                    <Text style={styles.adminRoleBadgeText}>CLINIC ADMIN</Text>
                                </View>
                            </View>
                        )}

                        {!adminUser && !showManagerForm && (
                            <View style={styles.emptyAdminBox}>
                                <Text style={styles.emptyAdminEmoji}>⚠️</Text>
                                <Text style={styles.emptyAdminTitle}>No admin assigned yet</Text>
                                <Text style={styles.emptyAdminSub}>Click + Add Clinic Admin to create login credentials.</Text>
                            </View>
                        )}

                        {/* Create Admin Form */}
                        {showManagerForm && (
                            <View style={styles.formContainer}>
                                <Text style={styles.formTitle}>Create Clinic Admin Account</Text>
                                <Text style={styles.inputLabel}>Full Name *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="e.g. Dr. Ramesh Sharma"
                                    value={managerForm.name}
                                    onChangeText={v => setManagerForm(prev => ({ ...prev, name: v }))}
                                />

                                <Text style={styles.inputLabel}>Email Address *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="admin@clinic.com"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={managerForm.email}
                                    onChangeText={v => setManagerForm(prev => ({ ...prev, email: v }))}
                                />

                                <Text style={styles.inputLabel}>Password *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Set temporary password"
                                    secureTextEntry
                                    value={managerForm.password}
                                    onChangeText={v => setManagerForm(prev => ({ ...prev, password: v }))}
                                />

                                <Text style={styles.inputLabel}>Phone Number (10 digits) *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="10-digit mobile number"
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                    value={managerForm.phone}
                                    onChangeText={v => setManagerForm(prev => ({ ...prev, phone: v.replace(/\D/g, '') }))}
                                />

                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>Age *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="Age"
                                            keyboardType="numeric"
                                            maxLength={3}
                                            value={managerForm.age}
                                            onChangeText={v => setManagerForm(prev => ({ ...prev, age: v.replace(/\D/g, '') }))}
                                        />
                                    </View>
                                    <View style={{ flex: 2 }}>
                                        <Text style={styles.inputLabel}>Aadhaar Number (12 digits) *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="12-digit Aadhaar"
                                            keyboardType="numeric"
                                            maxLength={12}
                                            value={managerForm.aadhaarNumber}
                                            onChangeText={v => setManagerForm(prev => ({ ...prev, aadhaarNumber: v.replace(/\D/g, '') }))}
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.submitFormBtn}
                                    onPress={handleCreateManager}
                                    disabled={savingManager}
                                >
                                    <Text style={styles.submitFormBtnText}>
                                        {savingManager ? 'Creating...' : '✅ Create Clinic Admin'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* ====== 3. ADDITIONAL STAFF MANAGEMENT ====== */}
                    <View style={styles.sectionCard}>
                        <View style={styles.cardHeaderRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>👥 Clinic Staff ({staffList.length})</Text>
                                <Text style={styles.cardSub}>Clinic Doctors & Reception personnel</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.actionBtnPrimary, showStaffForm && styles.actionBtnCancel]}
                                onPress={() => {
                                    setShowStaffForm(!showStaffForm);
                                    setShowManagerForm(false);
                                }}
                            >
                                <Text style={[styles.actionBtnPrimaryText, showStaffForm && styles.actionBtnCancelText]}>
                                    {showStaffForm ? 'Cancel' : '+ Add Staff'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Add Staff Form */}
                        {showStaffForm && (
                            <View style={styles.formContainer}>
                                <Text style={styles.formTitle}>Add Doctor / Staff Account</Text>
                                <Text style={styles.inputLabel}>Staff Full Name *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Doctor or Staff Name"
                                    value={staffForm.name}
                                    onChangeText={v => setStaffForm(prev => ({ ...prev, name: v }))}
                                />

                                <Text style={styles.inputLabel}>Email Address *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="staff@clinic.com"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={staffForm.email}
                                    onChangeText={v => setStaffForm(prev => ({ ...prev, email: v }))}
                                />

                                <Text style={styles.inputLabel}>Password *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Temporary password"
                                    secureTextEntry
                                    value={staffForm.password}
                                    onChangeText={v => setStaffForm(prev => ({ ...prev, password: v }))}
                                />

                                <Text style={styles.inputLabel}>Phone (10 digits) *</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Phone number"
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                    value={staffForm.phone}
                                    onChangeText={v => setStaffForm(prev => ({ ...prev, phone: v.replace(/\D/g, '') }))}
                                />

                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>Age *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="Age"
                                            keyboardType="numeric"
                                            maxLength={3}
                                            value={staffForm.age}
                                            onChangeText={v => setStaffForm(prev => ({ ...prev, age: v.replace(/\D/g, '') }))}
                                        />
                                    </View>
                                    <View style={{ flex: 2 }}>
                                        <Text style={styles.inputLabel}>Aadhaar Number (12 digits) *</Text>
                                        <TextInput
                                            style={styles.textInput}
                                            placeholder="12-digit Aadhaar"
                                            keyboardType="numeric"
                                            maxLength={12}
                                            value={staffForm.aadhaarNumber}
                                            onChangeText={v => setStaffForm(prev => ({ ...prev, aadhaarNumber: v.replace(/\D/g, '') }))}
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.submitFormBtn}
                                    onPress={handleCreateStaff}
                                    disabled={savingStaff}
                                >
                                    <Text style={styles.submitFormBtnText}>
                                        {savingStaff ? 'Adding...' : '✅ Add Staff Member'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Staff List */}
                        {staffList.length === 0 ? (
                            <Text style={styles.emptyListText}>No staff members added yet.</Text>
                        ) : (
                            staffList.map((s, idx) => (
                                <View key={s._id || idx} style={styles.staffItemRow}>
                                    <View style={styles.staffAvatar}>
                                        <Text style={styles.staffAvatarText}>{(s.name || 'S').charAt(0).toUpperCase()}</Text>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.staffName}>{s.name}</Text>
                                        <Text style={styles.staffEmail}>{s.email}</Text>
                                        <Text style={styles.staffRole}>{String(s.role || 'Doctor').toUpperCase()}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.deleteStaffBtn}
                                        onPress={() => handleDeleteStaff(s._id, s.name)}
                                    >
                                        <Feather name="trash-2" size={16} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </View>

                    {/* ====== 4. APPOINTMENT SYSTEM MODE TOGGLE ====== */}
                    <View style={styles.sectionCard}>
                        <View style={styles.cardHeaderRow}>
                            <View>
                                <Text style={styles.cardTitle}>🎟️ Appointment System Mode</Text>
                                <Text style={styles.cardSub}>Queue & Booking Management Engine</Text>
                            </View>
                            <View style={[styles.modeCurrentPill, clinicApptMode === 'token' ? styles.tokenModePill : styles.slotModePill]}>
                                <Text style={[styles.modeCurrentPillText, clinicApptMode === 'token' ? styles.tokenModeText : styles.slotModeText]}>
                                    Current: {clinicApptMode === 'token' ? 'Token Queue' : 'Time Slots'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.modeOptionsRow}>
                            {/* Token Mode Selection */}
                            <TouchableOpacity
                                style={[styles.modeOptionBox, clinicApptMode === 'token' && styles.modeOptionActiveToken]}
                                onPress={() => setClinicApptMode('token')}
                            >
                                <Text style={styles.modeIcon}>🎟️</Text>
                                <Text style={[styles.modeOptionTitle, clinicApptMode === 'token' && { color: '#b45309' }]}>
                                    Token Queue System
                                </Text>
                                <Text style={styles.modeOptionDesc}>
                                    Sequential tokens (1, 2, 3...) per day. Auto-resets at midnight. Best for walk-in OPD clinics.
                                </Text>
                                {clinicApptMode === 'token' && (
                                    <View style={styles.selectedBadge}>
                                        <Text style={styles.selectedBadgeText}>SELECTED</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Slot Mode Selection */}
                            <TouchableOpacity
                                style={[styles.modeOptionBox, clinicApptMode === 'slot' && styles.modeOptionActiveSlot]}
                                onPress={() => setClinicApptMode('slot')}
                            >
                                <Text style={styles.modeIcon}>🕐</Text>
                                <Text style={[styles.modeOptionTitle, clinicApptMode === 'slot' && { color: '#1d4ed8' }]}>
                                    Time Slot Booking
                                </Text>
                                <Text style={styles.modeOptionDesc}>
                                    Patients pick specific appointments (09:00, 09:30...). Fixed scheduling with conflict prevention.
                                </Text>
                                {clinicApptMode === 'slot' && (
                                    <View style={[styles.selectedBadge, { backgroundColor: '#3b82f6' }]}>
                                        <Text style={styles.selectedBadgeText}>SELECTED</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        {clinicApptMode !== (clinicObj.appointmentMode || 'token') && (
                            <View style={styles.modeWarningBox}>
                                <Feather name="info" size={14} color="#854d0e" />
                                <Text style={styles.modeWarningText}>
                                    Changing the appointment mode affects upcoming patient bookings.
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.saveApptModeBtn,
                                (savingApptMode || clinicApptMode === (clinicObj.appointmentMode || 'token')) && { opacity: 0.6 }
                            ]}
                            onPress={handleSaveApptMode}
                            disabled={savingApptMode || clinicApptMode === (clinicObj.appointmentMode || 'token')}
                        >
                            <Text style={styles.saveApptModeBtnText}>
                                {savingApptMode ? 'Saving...' : '💾 Save Appointment Mode'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* ====== 5. BILLING & SUBSCRIPTION MANAGEMENT ====== */}
                    <View style={styles.sectionCard}>
                        <Text style={styles.cardTitle}>💳 Billing & Subscription Cycle</Text>
                        <Text style={styles.cardSub}>
                            Patient Code: <Text style={{ fontWeight: '800', color: '#6366f1' }}>{clinicObj.clinicCode || '—'}</Text>
                        </Text>

                        {/* Rate Setting Form */}
                        <View style={styles.rateFormBox}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Rate per New Patient (₹)</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="e.g. 50"
                                    keyboardType="numeric"
                                    value={String(rateForm.ratePerPatient)}
                                    onChangeText={v => setRateForm(prev => ({ ...prev, ratePerPatient: v.replace(/\D/g, '') }))}
                                />
                            </View>
                            <View style={styles.switchRow}>
                                <Text style={styles.switchLabel}>Enable Billing:</Text>
                                <Switch
                                    value={rateForm.billingEnabled}
                                    onValueChange={v => setRateForm(prev => ({ ...prev, billingEnabled: v }))}
                                    trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
                                    thumbColor={rateForm.billingEnabled ? '#2563eb' : '#f8fafc'}
                                />
                            </View>
                            <TouchableOpacity
                                style={styles.saveRateBtn}
                                onPress={handleSaveRate}
                                disabled={savingRate}
                            >
                                <Text style={styles.saveRateBtnText}>{savingRate ? 'Saving...' : '💾 Save'}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Subscription History */}
                        <Text style={[styles.cardTitle, { fontSize: 14, marginTop: 14 }]}>Monthly Invoices & Billing History</Text>
                        {clinicSubscriptions.length === 0 ? (
                            <Text style={styles.emptyListText}>No subscription records generated yet.</Text>
                        ) : (
                            clinicSubscriptions.map((sub, idx) => {
                                const isPaid = sub.status === 'paid';
                                const isWaived = sub.status === 'waived';
                                const monthName = new Date(sub.year, (sub.month || 1) - 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

                                return (
                                    <View key={sub._id || idx} style={styles.subItemRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.subMonth}>{monthName}</Text>
                                            <Text style={styles.subDetail}>
                                                Patients: {sub.newPatientCount ?? 0} • Rate: ₹{sub.ratePerPatient ?? 0}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                                            <Text style={styles.subAmt}>₹{(sub.totalAmount ?? 0).toLocaleString('en-IN')}</Text>
                                            <View style={[styles.subStatusBadge, isPaid ? styles.subStatusPaid : isWaived ? styles.subStatusWaived : styles.subStatusPending]}>
                                                <Text style={[styles.subStatusBadgeText, isPaid ? styles.subPaidText : isWaived ? styles.subWaivedText : styles.subPendingText]}>
                                                    {(sub.status || 'Pending').toUpperCase()}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.subActionCol}>
                                            {!isPaid && (
                                                <TouchableOpacity
                                                    style={styles.markPaidBtn}
                                                    onPress={() => handleUpdateSubscription(sub._id, 'paid')}
                                                >
                                                    <Text style={styles.markPaidBtnText}>Mark Paid</Text>
                                                </TouchableOpacity>
                                            )}
                                            {sub.status === 'pending' && (
                                                <TouchableOpacity
                                                    style={styles.waiveBtn}
                                                    onPress={() => handleUpdateSubscription(sub._id, 'waived')}
                                                >
                                                    <Text style={styles.waiveBtnText}>Waive</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                );
                            })
                        )}
                    </View>

                    {/* ====== 6. RECENT APPOINTMENTS ====== */}
                    {recentAppointments.length > 0 && (
                        <View style={styles.sectionCard}>
                            <Text style={styles.cardTitle}>📅 Recent Consultations</Text>
                            {recentAppointments.map((appt, i) => (
                                <View key={appt._id || i} style={styles.apptItemRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.apptPatient}>
                                            {appt.clinicPatientId?.patientUid || appt.patientId || 'Patient'}
                                        </Text>
                                        <Text style={styles.apptDoctor}>Doctor: {appt.doctorName || 'Assigned'}</Text>
                                        <Text style={styles.apptDate}>
                                            {appt.appointmentDate ? new Date(appt.appointmentDate).toLocaleDateString('en-IN') : 'Recent'}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.apptAmt}>₹{appt.amount || 0}</Text>
                                        <Text style={[styles.apptStatus, appt.paymentStatus === 'paid' ? styles.subPaidText : styles.subPendingText]}>
                                            {appt.paymentStatus || 'Pending'}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}
            <View style={{ height: 40 }} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    scrollContent: { padding: 20, paddingBottom: 60, maxWidth: 1400, width: '100%', alignSelf: 'center' },
    heroBanner: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    clinicBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0f2fe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
    clinicBadgeText: { fontSize: 11, fontWeight: '700', color: '#0369a1' },
    backBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
    backBtnText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    heroMain: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    heroInfo: { flex: 1 },
    clinicName: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' },
    metaText: { fontSize: 11, color: '#475569', fontWeight: '600' },
    slugItem: { backgroundColor: '#f0fdfa', borderColor: '#ccfbf1' },
    slugText: { fontSize: 11, color: '#0f766e', fontWeight: '700' },
    heroStatusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    statusItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statusLabel: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    statusVal: { fontSize: 13, color: '#0f172a', fontWeight: '800' },
    activePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 6 },
    activePillColor: { backgroundColor: '#dcfce7' },
    inactivePill: { backgroundColor: '#fee2e2' },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' },
    activePillText: { fontSize: 11, fontWeight: '800', color: '#15803d' },

    errorAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fee2e2', padding: 12, borderRadius: 8, marginBottom: 12, gap: 8 },
    errorAlertText: { fontSize: 13, color: '#b91c1c', fontWeight: '600', flex: 1 },
    successAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', padding: 12, borderRadius: 8, marginBottom: 12, gap: 8 },
    successAlertText: { fontSize: 13, color: '#15803d', fontWeight: '600', flex: 1 },

    loaderBox: { padding: 40, alignItems: 'center' },
    loaderText: { marginTop: 12, fontSize: 14, color: '#2563eb', fontWeight: '700' },

    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    kpiCard: { flex: 1, minWidth: '45%', backgroundColor: '#ffffff', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4 },
    kpiVal: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 4 },
    kpiLbl: { fontSize: 12, fontWeight: '700', color: '#475569' },
    kpiSub: { fontSize: 10, color: '#94a3b8', marginTop: 2 },

    sectionCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    cardTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    cardSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
    actionBtnPrimary: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    actionBtnPrimaryText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
    actionBtnCancel: { backgroundColor: '#f1f5f9' },
    actionBtnCancelText: { color: '#475569' },

    adminProfileBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    adminAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center' },
    adminAvatarText: { fontSize: 18, fontWeight: '800', color: '#16a34a' },
    adminName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
    adminEmail: { fontSize: 12, color: '#64748b' },
    adminPhone: { fontSize: 12, color: '#64748b' },
    adminRoleBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    adminRoleBadgeText: { fontSize: 10, fontWeight: '800', color: '#15803d' },

    emptyAdminBox: { padding: 16, backgroundColor: '#fffbeb', borderRadius: 10, borderWidth: 1, borderColor: '#fef3c7', alignItems: 'center' },
    emptyAdminEmoji: { fontSize: 24, marginBottom: 4 },
    emptyAdminTitle: { fontSize: 13, fontWeight: '700', color: '#92400e' },
    emptyAdminSub: { fontSize: 11, color: '#b45309', textAlign: 'center', marginTop: 2 },

    formContainer: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 10 },
    formTitle: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 10 },
    inputLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4, marginTop: 8 },
    textInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: '#0f172a', backgroundColor: '#ffffff' },
    submitFormBtn: { backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 14 },
    submitFormBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },

    emptyListText: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic', paddingVertical: 8 },
    staffItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    staffAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center' },
    staffAvatarText: { fontSize: 14, fontWeight: '800', color: '#4f46e5' },
    staffName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    staffEmail: { fontSize: 11, color: '#64748b' },
    staffRole: { fontSize: 10, fontWeight: '800', color: '#2563eb', marginTop: 2 },
    deleteStaffBtn: { padding: 8 },

    modeCurrentPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    tokenModePill: { backgroundColor: '#fef3c7' },
    slotModePill: { backgroundColor: '#dbeafe' },
    modeCurrentPillText: { fontSize: 11, fontWeight: '800' },
    tokenModeText: { color: '#92400e' },
    slotModeText: { color: '#1d4ed8' },
    modeOptionsRow: { flexDirection: 'row', gap: 10, marginVertical: 12 },
    modeOptionBox: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    modeOptionActiveToken: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
    modeOptionActiveSlot: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
    modeIcon: { fontSize: 24, marginBottom: 4 },
    modeOptionTitle: { fontSize: 13, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
    modeOptionDesc: { fontSize: 10, color: '#64748b', lineHeight: 14 },
    selectedBadge: { alignSelf: 'flex-start', backgroundColor: '#f59e0b', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 8 },
    selectedBadgeText: { color: '#ffffff', fontSize: 9, fontWeight: '800' },
    modeWarningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef9c3', padding: 10, borderRadius: 8, gap: 6, marginBottom: 12 },
    modeWarningText: { fontSize: 11, color: '#713f12', flex: 1 },
    saveApptModeBtn: { backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    saveApptModeBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },

    rateFormBox: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginVertical: 10 },
    switchRow: { alignItems: 'center', justifyContent: 'center' },
    switchLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 4 },
    saveRateBtn: { backgroundColor: '#10b981', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
    saveRateBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },

    subItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    subMonth: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    subDetail: { fontSize: 11, color: '#64748b' },
    subAmt: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
    subStatusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
    subStatusPaid: { backgroundColor: '#dcfce7' },
    subStatusWaived: { backgroundColor: '#f1f5f9' },
    subStatusPending: { backgroundColor: '#fef3c7' },
    subStatusBadgeText: { fontSize: 10, fontWeight: '800' },
    subPaidText: { color: '#15803d' },
    subWaivedText: { color: '#64748b' },
    subPendingText: { color: '#92400e' },
    subActionCol: { flexDirection: 'column', gap: 4 },
    markPaidBtn: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    markPaidBtnText: { fontSize: 10, fontWeight: '800', color: '#15803d' },
    waiveBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    waiveBtnText: { fontSize: 10, fontWeight: '800', color: '#64748b' },

    apptItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    apptPatient: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
    apptDoctor: { fontSize: 11, color: '#64748b' },
    apptDate: { fontSize: 10, color: '#94a3b8' },
    apptAmt: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
    apptStatus: { fontSize: 11, fontWeight: '700' }
});

export default CentralAdminClinicDetails;
