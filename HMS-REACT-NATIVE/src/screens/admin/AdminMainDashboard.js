import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Dimensions, ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const AdminMainDashboard = () => {
    const navigation = useNavigation();

    const [stats, setStats] = useState({
        totalUsers: 0,
        totalRoles: 0,
        totalDoctors: 0,
        totalPatients: 0,
    });
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('Admin');

    useEffect(() => {
        const init = async () => {
            const userStr = await AsyncStorage.getItem('user');
            if (userStr) setUserName(JSON.parse(userStr).name || 'Admin');
            fetchStats();
        };
        init();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const [usersRes, rolesRes] = await Promise.all([
                api.get('/api/admin/users').catch(() => ({ data: { success: false, users: [] } })),
                api.get('/api/admin/roles').catch(() => ({ data: { success: false, data: [] } }))
            ]);

            const users = usersRes.data?.success ? usersRes.data.users : [];
            const roles = rolesRes.data?.success ? rolesRes.data.data : [];

            setStats({
                totalUsers: users.length,
                totalRoles: roles.length,
                totalDoctors: users.filter(u => (u.role || '').toLowerCase().includes('doctor')).length,
                totalPatients: users.filter(u => (u.role || '').toLowerCase() === 'patient').length,
            });
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const hour = new Date().getHours();
    let greeting = 'Good morning';
    let greetingEmoji = '☀️';
    if (hour >= 12 && hour < 17) { greeting = 'Good afternoon'; greetingEmoji = '🌤️'; }
    else if (hour >= 17) { greeting = 'Good evening'; greetingEmoji = '🌙'; }

    const dateString = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const statCards = [
        { icon: '👥', label: 'Total Users', value: stats.totalUsers, accent: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
        { icon: '🔑', label: 'Active Roles', value: stats.totalRoles, accent: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
        { icon: '👨‍⚕️', label: 'Doctors', value: stats.totalDoctors, accent: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        { icon: '🩺', label: 'Patients', value: stats.totalPatients, accent: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    ];

    const quickActions = [
        { icon: '👥', label: 'Manage Users', desc: 'View staff & patients, edit roles', path: 'AdminUsers', bg: 'rgba(20,184,166,0.12)' },
        { icon: '🔑', label: 'Roles', desc: 'Create custom roles & perms', path: 'AdminRoles', bg: 'rgba(99,102,241,0.12)' },
        { icon: '👨‍⚕️', label: 'Doctors', desc: 'Manage doctor profiles', path: 'AdminDoctors', bg: 'rgba(59,130,246,0.12)' },
        { icon: '🧪', label: 'Labs', desc: 'Configure lab departments', path: 'AdminLabs', bg: 'rgba(245,158,11,0.12)' },
        { icon: '💊', label: 'Pharmacy', desc: 'Manage pharmacy inventory', path: 'AdminPharmacy', bg: 'rgba(239,68,68,0.12)' },
        { icon: '🏥', label: 'Reception', desc: 'Set up reception desk workflows', path: 'AdminReception', bg: 'rgba(16,185,129,0.12)' },
    ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.greetingTitle}>
                    {greetingEmoji} {greeting}, <Text style={styles.brandText}>{userName}</Text>
                </Text>
                <Text style={styles.greetingSub}>{dateString} · Hospital Snapshot</Text>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
                {statCards.map((stat, idx) => (
                    <View key={idx} style={styles.statCard}>
                        <View style={[styles.statIconWrap, { backgroundColor: stat.bg }]}>
                            <Text style={styles.statIcon}>{stat.icon}</Text>
                        </View>
                        {loading ? (
                            <ActivityIndicator size="small" color={stat.accent} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
                        ) : (
                            <Text style={styles.statValue}>{stat.value}</Text>
                        )}
                        <Text style={styles.statLabel}>{stat.label}</Text>
                        <View style={[styles.statAccent, { backgroundColor: stat.accent }]} />
                    </View>
                ))}
            </View>

            {/* Actions Section */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>⚡ QUICK ACTIONS</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AdminUsers', { openCreateForm: true })}>
                    <Text style={styles.addBtnText}>+ Add Staff</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.actionsGrid}>
                {quickActions.map((action, idx) => (
                    <TouchableOpacity
                        key={idx}
                        style={styles.actionCard}
                        onPress={() => navigation.navigate(action.path)}
                    >
                        <View style={[styles.actionIconWrap, { backgroundColor: action.bg }]}>
                            <Text style={styles.actionIcon}>{action.icon}</Text>
                        </View>
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>{action.label}</Text>
                            <Text style={styles.actionDesc} numberOfLines={1}>{action.desc}</Text>
                        </View>
                        <Text style={styles.actionArrow}>→</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    scrollContent: { padding: 24, paddingBottom: 60 },

    header: { marginBottom: 24 },
    greetingTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
    brandText: { color: '#4f46e5' },
    greetingSub: { fontSize: 14, color: '#64748b', marginTop: 4 },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 32 },
    statCard: {
        width: (width - 64) / 2,
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2
    },
    statIconWrap: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    statIcon: { fontSize: 20 },
    statValue: { fontSize: 32, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
    statLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
    statAccent: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionLabel: { fontSize: 12, fontWeight: '800', color: '#94a3b8', letterSpacing: 1 },
    addBtn: { backgroundColor: '#4f46e5', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
    addBtnText: { color: 'white', fontWeight: 'bold', fontSize: 13 },

    actionsGrid: { gap: 12 },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    actionIconWrap: { width: 46, height: 46, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    actionIcon: { fontSize: 22 },
    actionContent: { flex: 1 },
    actionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
    actionDesc: { fontSize: 13, color: '#64748b' },
    actionArrow: { fontSize: 20, color: '#cbd5e1', fontWeight: 'bold' }
});

export default AdminMainDashboard;
