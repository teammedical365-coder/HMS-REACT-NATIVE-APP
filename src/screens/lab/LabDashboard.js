import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { labAPI } from '../../utils/api';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const LabDashboard = () => {
    const navigation = useNavigation();
    const [stats, setStats] = useState({ pending: 0, completed: 0, revenue: 0, labName: 'Lab' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await labAPI.getStats();
                if (res.success) {
                    setStats(res.stats);
                }
            } catch (err) {
                console.error("Error loading stats:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading Dashboard...</Text>
            </View>
        );
    }

    const isLargeScreen = width > 768;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <View style={[styles.header, !isLargeScreen && { flexDirection: 'column', alignItems: 'flex-start' }]}>
                <View>
                    <Text style={styles.headerTitle}>🔬 {stats.labName} Dashboard</Text>
                    <Text style={styles.headerSubtitle}>Manage test requests and upload reports</Text>
                </View>
            </View>

            <View style={[styles.statsGrid, !isLargeScreen && { flexDirection: 'column' }]}>
                <TouchableOpacity 
                    style={styles.statCard} 
                    onPress={() => navigation.navigate('AssignedTests')}
                    activeOpacity={0.8}
                >
                    <View style={[styles.cardIndicator, { backgroundColor: '#f59e0b' }]} />
                    <Text style={styles.statValue}>{stats.pending}</Text>
                    <Text style={styles.statLabel}>Pending Requests</Text>
                </TouchableOpacity>
                <View style={styles.statCard}>
                    <View style={[styles.cardIndicator, { backgroundColor: '#10b981' }]} />
                    <Text style={styles.statValue}>{stats.completed}</Text>
                    <Text style={styles.statLabel}>Completed Reports</Text>
                </View>
                <View style={styles.statCard}>
                    <View style={[styles.cardIndicator, { backgroundColor: '#8b5cf6' }]} />
                    <Text style={styles.statValue}>₹{stats.revenue}</Text>
                    <Text style={styles.statLabel}>Est. Revenue</Text>
                </View>
            </View>

            <View style={[styles.actionsContainer, !isLargeScreen && { flexDirection: 'column' }]}>
                <TouchableOpacity 
                    style={styles.actionBtnPrimary}
                    onPress={() => navigation.navigate('AssignedTests')}
                >
                    <LinearGradient
                        colors={['#3b82f6', '#06b6d4']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientBg}
                    >
                        <Text style={styles.actionBtnTextPrimary}>📋 View Assigned Tests</Text>
                    </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.actionBtnSecondary}
                    onPress={() => navigation.navigate('CompletedReports')}
                >
                    <Text style={styles.actionBtnTextSecondary}>🗄️ Past Records</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f3ff', // Approximate radial gradient fallback
    },
    contentContainer: {
        padding: 32,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f3ff'
    },
    loadingText: {
        marginTop: 10,
        color: '#64748b',
        fontSize: 16
    },
    header: {
        marginBottom: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        shadowColor: '#1f2687',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 32,
        elevation: 5,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#3b82f6', // Gradient text replacement fallback
    },
    headerSubtitle: {
        color: '#64748b',
        fontSize: 16,
        marginTop: 4
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 24,
        marginBottom: 40
    },
    statCard: {
        flex: 1,
        minWidth: 280,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        borderRadius: 20,
        padding: 28,
        position: 'relative',
        overflow: 'hidden',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 2
    },
    cardIndicator: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 6,
        height: '100%',
    },
    statValue: {
        fontSize: 48,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 8
    },
    statLabel: {
        color: '#64748b',
        fontSize: 17,
        fontWeight: '500'
    },
    actionsContainer: {
        flexDirection: 'row',
        gap: 20
    },
    actionBtnPrimary: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 5,
        flex: 1,
        minWidth: 200
    },
    gradientBg: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        alignItems: 'center',
        justifyContent: 'center'
    },
    actionBtnTextPrimary: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600'
    },
    actionBtnSecondary: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.2)',
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1f2687',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 32,
        elevation: 5,
        flex: 1,
        minWidth: 200
    },
    actionBtnTextSecondary: {
        color: '#3b82f6',
        fontSize: 16,
        fontWeight: '600'
    }
});

export default LabDashboard;
