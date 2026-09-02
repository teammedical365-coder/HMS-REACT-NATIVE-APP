import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useAuth } from '../store/hooks';
import { useBranding } from '../context/BrandingContext';

const DashboardScreen = ({ title = 'Dashboard' }) => {
    const { user } = useAuth();
    const { branding } = useBranding();

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
                <Text style={styles.hospitalName}>{branding?.hospitalName || 'Medical 365'}</Text>
                <Text style={styles.subtitle}>{title}</Text>
            </View>

            <View style={styles.userCard}>
                <Text style={styles.userLabel}>Logged in as</Text>
                <Text style={styles.userName}>{user?.name || 'User'}</Text>
                <Text style={styles.userRole}>{user?.role || 'Staff'}</Text>
            </View>

            <View style={styles.content}>
                <Text style={styles.contentPlaceholder}>Content coming soon...</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        backgroundColor: '#14b8a6',
        paddingHorizontal: 16,
        paddingVertical: 20,
        paddingTop: 24,
    },
    hospitalName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
    },
    subtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
    },
    userCard: {
        backgroundColor: '#ffffff',
        marginHorizontal: 16,
        marginVertical: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#14b8a6',
    },
    userLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
    },
    userName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 4,
    },
    userRole: {
        fontSize: 13,
        color: '#14b8a6',
        fontWeight: '500',
        marginTop: 4,
    },
    content: {
        paddingHorizontal: 16,
        paddingVertical: 20,
    },
    contentPlaceholder: {
        fontSize: 15,
        color: '#94a3b8',
        textAlign: 'center',
    },
});

export default DashboardScreen;