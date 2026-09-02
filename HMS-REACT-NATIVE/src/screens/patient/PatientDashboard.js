import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Modal, ActivityIndicator, Alert, Dimensions, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useBranding } from '../../context/BrandingContext';
import { patientAuthAPI, uploadAPI } from '../../utils/api';

const { width } = Dimensions.get('window');

const PatientDashboard = () => {
    const navigation = useNavigation();
    const { branding, hospitalName } = useBranding();
    
    const [patient, setPatient] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [activeTab, setActiveTab] = useState('dashboard');
    
    // Edit Profile State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [updatingProfile, setUpdatingProfile] = useState(false);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [profRes, apptRes, docRes] = await Promise.all([
                patientAuthAPI.getPatientProfile(),
                patientAuthAPI.getPatientAppointments(),
                patientAuthAPI.getPatientDocuments()
            ]);
            
            if (profRes.success) setProfileData(profRes.profile);
            if (apptRes.success) setAppointments(apptRes.appointments || []);
            if (docRes.success) setDocuments(docRes.documents || []);
            
        } catch (err) {
            console.error('Error loading dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = () => {
        if (!profileData) return;
        setEditForm({
            name: profileData.name || '',
            email: profileData.email || '',
            mobile: profileData.mobile || profileData.phone || '',
            dob: profileData.dob || '',
            age: profileData.age || '',
            gender: profileData.gender || '',
            bloodGroup: profileData.bloodGroup || '',
            houseNo: profileData.houseNo || '',
            city: profileData.city || '',
            avatar: profileData.avatar || ''
        });
        setIsEditing(true);
    };

    const handleSaveProfile = async () => {
        if (!editForm.name?.trim()) {
            Alert.alert("Error", "Name is required.");
            return;
        }

        setUpdatingProfile(true);
        try {
            const res = await patientAuthAPI.updatePatientProfile(editForm);
            if (res.success) {
                Alert.alert("Success", "Profile updated successfully!");
                setProfileData(res.profile);
                setIsEditing(false);
            } else {
                Alert.alert("Error", res.message || "Failed to update profile.");
            }
        } catch (err) {
            console.error(err);
            Alert.alert("Error", "Failed to save changes.");
        } finally {
            setUpdatingProfile(false);
        }
    };

    const renderDashboard = () => (
        <View style={styles.tabContent}>
            <Text style={styles.sectionHeader}>Overview</Text>
            <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                    <Text style={styles.statIcon}>📅</Text>
                    <View>
                        <Text style={styles.statValue}>{appointments.length}</Text>
                        <Text style={styles.statLabel}>Total Appointments</Text>
                    </View>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statIcon}>📄</Text>
                    <View>
                        <Text style={styles.statValue}>{documents.length}</Text>
                        <Text style={styles.statLabel}>Medical Records</Text>
                    </View>
                </View>
            </View>

            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Recent Appointments</Text>
            {appointments.length === 0 ? (
                <Text style={styles.emptyText}>No recent appointments.</Text>
            ) : (
                appointments.slice(0, 3).map((appt, i) => (
                    <View key={i} style={styles.listCard}>
                        <View>
                            <Text style={styles.listTitle}>Dr. {appt.doctorId?.name || 'Unknown'}</Text>
                            <Text style={styles.listSub}>{new Date(appt.appointmentDate).toDateString()} at {appt.appointmentTime}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: appt.status === 'confirmed' ? '#dcfce7' : '#fef3c7' }]}>
                            <Text style={[styles.statusText, { color: appt.status === 'confirmed' ? '#166534' : '#92400e' }]}>{appt.status}</Text>
                        </View>
                    </View>
                ))
            )}
        </View>
    );

    const renderProfile = () => (
        <View style={styles.tabContent}>
            <View style={styles.headerRow}>
                <Text style={styles.sectionHeader}>My Profile</Text>
                {!isEditing && (
                    <TouchableOpacity onPress={handleEditClick} style={styles.editBtn}>
                        <Text style={styles.editBtnText}>Edit Profile</Text>
                    </TouchableOpacity>
                )}
            </View>

            {isEditing ? (
                <View style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Full Name</Text>
                        <TextInput style={styles.input} value={editForm.name} onChangeText={(t) => setEditForm(p => ({...p, name: t}))} />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email Address</Text>
                        <TextInput style={styles.input} value={editForm.email} onChangeText={(t) => setEditForm(p => ({...p, email: t}))} />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Mobile</Text>
                        <TextInput style={styles.input} value={editForm.mobile} onChangeText={(t) => setEditForm(p => ({...p, mobile: t}))} keyboardType="numeric" />
                    </View>
                    <View style={styles.row}>
                        <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginRight: 10 }]} onPress={handleSaveProfile} disabled={updatingProfile}>
                            <Text style={styles.primaryBtnText}>{updatingProfile ? 'Saving...' : 'Save Changes'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]} onPress={() => setIsEditing(false)}>
                            <Text style={styles.secondaryBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                        <View style={styles.avatarLarge}>
                            {profileData?.avatar ? (
                                <Image source={{ uri: profileData.avatar }} style={styles.avatarImg} />
                            ) : (
                                <Text style={styles.avatarLetter}>{(profileData?.name || 'P')[0].toUpperCase()}</Text>
                            )}
                        </View>
                        <View style={{ marginLeft: 16 }}>
                            <Text style={styles.profileName}>{profileData?.name}</Text>
                            <Text style={styles.profileId}>MRN: {profileData?.patientId || 'N/A'}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.detailsGrid}>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Email</Text>
                            <Text style={styles.detailValue}>{profileData?.email || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Phone</Text>
                            <Text style={styles.detailValue}>{profileData?.phone || profileData?.mobile || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Blood Group</Text>
                            <Text style={styles.detailValue}>{profileData?.bloodGroup || 'N/A'}</Text>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loaderText}>Loading Dashboard...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.sidebar}>
                <Text style={styles.sidebarTitle}>{hospitalName || 'Patient Portal'}</Text>
                
                <TouchableOpacity style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]} onPress={() => setActiveTab('dashboard')}>
                    <Text style={[styles.navText, activeTab === 'dashboard' && styles.navTextActive]}>🏠 Dashboard</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.navItem, activeTab === 'appointments' && styles.navItemActive]} onPress={() => setActiveTab('appointments')}>
                    <Text style={[styles.navText, activeTab === 'appointments' && styles.navTextActive]}>📅 Appointments</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.navItem, activeTab === 'profile' && styles.navItemActive]} onPress={() => setActiveTab('profile')}>
                    <Text style={[styles.navText, activeTab === 'profile' && styles.navTextActive]}>👤 My Profile</Text>
                </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.mainContent}>
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'profile' && renderProfile()}
                {activeTab === 'appointments' && (
                    <View style={styles.tabContent}>
                        <Text style={styles.sectionHeader}>My Appointments</Text>
                        {appointments.length === 0 ? <Text style={styles.emptyText}>No appointments found.</Text> : appointments.map((appt, i) => (
                            <View key={i} style={styles.listCard}>
                                <View>
                                    <Text style={styles.listTitle}>Dr. {appt.doctorId?.name || 'Unknown'}</Text>
                                    <Text style={styles.listSub}>{new Date(appt.appointmentDate).toDateString()} at {appt.appointmentTime}</Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: appt.status === 'confirmed' ? '#dcfce7' : '#fef3c7' }]}>
                                    <Text style={[styles.statusText, { color: appt.status === 'confirmed' ? '#166534' : '#92400e' }]}>{appt.status}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
    loaderText: { color: '#3b82f6', fontWeight: '600', marginTop: 10 },
    container: { flex: 1, flexDirection: 'row', backgroundColor: '#f8fafc' },
    sidebar: { width: 250, backgroundColor: '#ffffff', borderRightWidth: 1, borderRightColor: '#e2e8f0', paddingVertical: 20 },
    sidebarTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', paddingHorizontal: 20, marginBottom: 30 },
    navItem: { paddingVertical: 12, paddingHorizontal: 20, borderLeftWidth: 3, borderLeftColor: 'transparent' },
    navItemActive: { borderLeftColor: '#3b82f6', backgroundColor: '#eff6ff' },
    navText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
    navTextActive: { color: '#2563eb', fontWeight: '700' },
    mainContent: { flex: 1 },
    tabContent: { padding: 30 },
    sectionHeader: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
    statsGrid: { flexDirection: 'row', gap: 20, marginBottom: 30 },
    statCard: { flex: 1, backgroundColor: '#ffffff', borderRadius: 12, padding: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', elevation: 2 },
    statIcon: { fontSize: 32, marginRight: 16 },
    statValue: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
    statLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    listCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    listTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
    listSub: { fontSize: 13, color: '#64748b' },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    statusText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
    emptyText: { color: '#64748b', fontSize: 14, fontStyle: 'italic' },
    
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    editBtn: { backgroundColor: '#eff6ff', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, borderWidth: 1, borderColor: '#bfdbfe' },
    editBtnText: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
    profileCard: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#e2e8f0' },
    profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 24 },
    avatarLarge: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    avatarImg: { width: '100%', height: '100%' },
    avatarLetter: { fontSize: 28, color: '#ffffff', fontWeight: '800' },
    profileName: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
    profileId: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 4 },
    detailsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    detailItem: { width: '50%', marginBottom: 16 },
    detailLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    detailValue: { fontSize: 15, color: '#1e293b', fontWeight: '600' },
    
    formContainer: { backgroundColor: '#ffffff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#e2e8f0' },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0f172a' },
    row: { flexDirection: 'row', marginTop: 10 },
    primaryBtn: { backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
    primaryBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
    secondaryBtn: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
    secondaryBtnText: { color: '#475569', fontWeight: '700', fontSize: 15 }
});

export default PatientDashboard;
