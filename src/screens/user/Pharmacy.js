import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, TextInput, Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../utils/api';

const Pharmacy = () => {
    const navigation = useNavigation();
    const [orders, setOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const token = await AsyncStorage.getItem('token');
            const userData = await AsyncStorage.getItem('user');

            if (token && userData) {
                try {
                    const user = JSON.parse(userData);
                    setLoggedInUser(user);
                    fetchPharmacyOrders(token);
                } catch (e) {
                    console.error('Error parsing user data:', e);
                    navigation.replace('Login');
                }
            } else {
                navigation.replace('Login');
            }
        };
        checkAuth();
    }, [navigation]);

    const fetchPharmacyOrders = async (token) => {
        try {
            setIsLoading(true);
            const response = await api.get('/api/pharmacy/my-orders');

            if (response.data.success) {
                const fetchedOrders = response.data.orders || [];
                setOrders(fetchedOrders);
                setFilteredOrders(fetchedOrders);
            }
        } catch (err) {
            console.error('Error fetching pharmacy orders:', err);
            setOrders([]);
            setFilteredOrders([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isLoading) return;

        let filtered = [...orders];

        if (filter !== 'all') {
            filtered = filtered.filter(order => order.status === filter);
        }

        if (searchTerm) {
            filtered = filtered.filter(order =>
                (order.orderId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (order.patientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.items?.some(item => (item.medicineName || item.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        setFilteredOrders(filtered);
    }, [filter, searchTerm, orders, isLoading]);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'delivered': return '✓ Delivered';
            case 'processing': return '⏳ Processing';
            case 'pending': return '⏸ Pending';
            case 'cancelled': return '✕ Cancelled';
            default: return status;
        }
    };

    const getPaymentColor = (paymentStatus) => {
        switch ((paymentStatus || '').toLowerCase()) {
            case 'paid': return '#14C38E';
            case 'pending': return '#ff9800';
            case 'refunded': return '#f44336';
            default: return '#1E293B';
        }
    };

    if (isLoading || !loggedInUser) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#14C38E" />
                <Text style={styles.loadingText}>Loading your pharmacy orders...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.page} contentContainerStyle={styles.contentWrapper}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
                    <Text style={styles.backLinkText}>← Back to Home</Text>
                </TouchableOpacity>

                <View style={styles.headerContent}>
                    <View style={styles.badge}><Text style={styles.badgeText}>PHARMACY ORDERS</Text></View>
                    <Text style={styles.title}>Your <Text style={styles.textGradient}>Pharmacy Orders</Text></Text>
                    <Text style={styles.subtext}>
                        View and track all your medication orders and purchases.
                    </Text>
                    {(loggedInUser.name || loggedInUser.email) && (
                        <Text style={styles.greeting}>
                            Welcome, <Text style={styles.greetingBold}>{loggedInUser.name || loggedInUser.email}</Text>
                        </Text>
                    )}
                </View>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                <View style={styles.searchBox}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by order ID, item name..."
                        placeholderTextColor="#64748B"
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                    />
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterButtons}>
                    {['all', 'delivered', 'processing', 'pending', 'cancelled'].map(f => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                            onPress={() => setFilter(f)}
                        >
                            <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Orders */}
            {filteredOrders.length > 0 ? (
                <View style={styles.ordersGrid}>
                    {filteredOrders.map((order) => (
                        <View key={order.id || order._id} style={styles.orderCard}>
                            {/* Card Header */}
                            <View style={styles.orderCardHeader}>
                                <View style={styles.orderId}>
                                    <Text style={styles.idLabel}>ORDER ID</Text>
                                    <Text style={styles.idValue}>{order.orderId}</Text>
                                </View>
                                <Text style={[
                                    styles.statusBadge,
                                    styles[`status${order.status}`] || {}
                                ]}>
                                    {getStatusLabel(order.status)}
                                </Text>
                            </View>

                            {/* Card Body */}
                            <View style={styles.orderCardBody}>
                                <View style={styles.orderMeta}>
                                    <View style={styles.metaItem}>
                                        <Text style={styles.metaIcon}>📅</Text>
                                        <View>
                                            <Text style={styles.metaLabel}>ORDER DATE</Text>
                                            <Text style={styles.metaValue}>{formatDate(order.createdAt || order.orderDate)}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.metaItem}>
                                        <Text style={styles.metaIcon}>💰</Text>
                                        <View>
                                            <Text style={styles.metaLabel}>TOTAL AMOUNT</Text>
                                            <Text style={styles.metaValue}>
                                                {order.totalAmount ? `₹${order.totalAmount}` : 'Calculated at Pharmacy'}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.metaItem}>
                                        <Text style={styles.metaIcon}>💳</Text>
                                        <View>
                                            <Text style={styles.metaLabel}>PAYMENT</Text>
                                            <Text style={[styles.metaValue, { color: getPaymentColor(order.paymentStatus) }]}>
                                                {order.paymentStatus}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Items */}
                                <View style={styles.orderItems}>
                                    <Text style={styles.itemsTitle}>Items ({order.items?.length || 0})</Text>
                                    {order.items?.map((item, idx) => (
                                        <View key={idx} style={styles.itemRow}>
                                            <View style={styles.itemInfo}>
                                                <Text style={styles.itemName}>{item.medicineName || item.name}</Text>
                                                <Text style={styles.itemQuantity}>
                                                    {item.quantity ? `Qty: ${item.quantity}` : `${item.frequency || ''} ${item.duration || ''}`}
                                                </Text>
                                            </View>
                                            <Text style={styles.itemPrice}>
                                                {item.price ? `₹${item.price}` : ''}
                                            </Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Delivery Address */}
                                {order.deliveryAddress && (
                                    <View style={styles.deliveryAddress}>
                                        <Text style={styles.addressIcon}>📍</Text>
                                        <Text style={styles.addressText}>{order.deliveryAddress}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Card Footer */}
                            <View style={styles.orderCardFooter}>
                                {order.status === 'delivered' && (
                                    <TouchableOpacity style={styles.btnPrimary} onPress={() => Alert.alert('Reorder', `Reordering ${order.orderId}...`)}>
                                        <Text style={styles.btnPrimaryText}>Reorder</Text>
                                    </TouchableOpacity>
                                )}
                                {order.status === 'processing' && (
                                    <TouchableOpacity style={styles.btnSecondary} onPress={() => Alert.alert('Track', `Tracking order ${order.orderId}...`)}>
                                        <Text style={styles.btnSecondaryText}>Track Order</Text>
                                    </TouchableOpacity>
                                )}
                                {order.status === 'pending' && (
                                    <TouchableOpacity style={styles.btnSecondary} onPress={() => Alert.alert('Details', `Order ${order.orderId} is pending...`)}>
                                        <Text style={styles.btnSecondaryText}>View Details</Text>
                                    </TouchableOpacity>
                                )}
                                {order.status === 'cancelled' && (
                                    <View style={[styles.btnSecondary, { opacity: 0.5 }]}>
                                        <Text style={[styles.btnSecondaryText, { color: '#64748B' }]}>Order Cancelled</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            ) : (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>💊</Text>
                    <Text style={styles.emptyTitle}>No Orders Found</Text>
                    <Text style={styles.emptySubtext}>
                        {searchTerm || filter !== 'all'
                            ? 'No orders match your search criteria. Try adjusting your filters.'
                            : "You don't have any pharmacy orders yet."}
                    </Text>
                    {(searchTerm || filter !== 'all') && (
                        <TouchableOpacity style={styles.btnPrimary} onPress={() => { setSearchTerm(''); setFilter('all'); }}>
                            <Text style={styles.btnPrimaryText}>Clear Filters</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* CTA */}
            {filteredOrders.length > 0 && (
                <View style={styles.ctaCard}>
                    <Text style={styles.ctaTitle}>Need to Order Medications?</Text>
                    <Text style={styles.ctaSubtext}>Browse our pharmacy catalog and place your order online.</Text>
                    <TouchableOpacity style={styles.btnWhite}>
                        <Text style={styles.btnWhiteText}>Browse Pharmacy</Text>
                    </TouchableOpacity>
                </View>
            )}

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: '#F8F9FD',
    },
    contentWrapper: {
        padding: 24,
        paddingTop: 40,
        paddingBottom: 100,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FD',
    },
    loadingText: {
        marginTop: 20,
        color: '#64748B',
        fontSize: 16,
    },

    /* Header */
    header: {
        marginBottom: 60,
    },
    backLink: {
        marginBottom: 30,
    },
    backLinkText: {
        color: '#64748B',
        fontSize: 15,
        fontWeight: '500',
    },
    headerContent: {
        alignItems: 'center',
    },
    badge: {
        backgroundColor: 'rgba(20, 195, 142, 0.1)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginBottom: 20,
    },
    badgeText: {
        color: '#0A2647',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 20,
        textAlign: 'center',
    },
    textGradient: {
        color: '#14C38E',
    },
    subtext: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: 700,
    },
    greeting: {
        fontSize: 15,
        color: '#64748B',
        marginTop: 12,
        fontStyle: 'italic',
    },
    greetingBold: {
        color: '#14C38E',
        fontWeight: '600',
    },

    /* Controls */
    controls: {
        marginBottom: 50,
        gap: 20,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
    },
    searchIcon: {
        position: 'absolute',
        left: 20,
        fontSize: 18,
        color: '#64748B',
        zIndex: 1,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 16,
        paddingLeft: 50,
        paddingRight: 20,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 50,
        fontSize: 15,
        backgroundColor: '#FFFFFF',
        color: '#1E293B',
    },
    filterButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 5,
    },
    filterBtn: {
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        backgroundColor: '#FFFFFF',
        borderRadius: 50,
    },
    filterBtnActive: {
        backgroundColor: '#14C38E',
        borderColor: '#14C38E',
    },
    filterBtnText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600',
    },
    filterBtnTextActive: {
        color: '#FFFFFF',
    },

    /* Orders Grid */
    ordersGrid: {
        gap: 30,
        marginBottom: 60,
    },

    /* Order Card */
    orderCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)',
    },
    orderCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 24,
        backgroundColor: 'rgba(20, 195, 142, 0.03)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(226, 232, 240, 0.8)',
    },
    orderId: {
        flexDirection: 'column',
        gap: 4,
    },
    idLabel: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    idValue: {
        fontSize: 16,
        color: '#1E293B',
        fontWeight: '700',
        fontFamily: 'monospace',
    },
    statusBadge: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        fontSize: 13,
        fontWeight: '600',
        overflow: 'hidden',
    },
    statusdelivered: { backgroundColor: 'rgba(20, 195, 142, 0.1)', color: '#14C38E' },
    statusprocessing: { backgroundColor: 'rgba(255, 193, 7, 0.1)', color: '#ff9800' },
    statuspending: { backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#2196f3' },
    statuscancelled: { backgroundColor: 'rgba(244, 67, 54, 0.1)', color: '#f44336' },

    orderCardBody: {
        padding: 24,
        gap: 20,
    },
    orderMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        width: '45%',
    },
    metaIcon: {
        fontSize: 20,
    },
    metaLabel: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    metaValue: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '600',
        marginTop: 4,
    },

    /* Order Items */
    orderItems: {
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(226, 232, 240, 0.8)',
    },
    itemsTitle: {
        fontSize: 15,
        color: '#1E293B',
        fontWeight: '600',
        marginBottom: 12,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F8F9FD',
        borderRadius: 12,
        marginBottom: 10,
    },
    itemInfo: {
        flex: 1,
        gap: 4,
    },
    itemName: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '500',
    },
    itemQuantity: {
        fontSize: 13,
        color: '#64748B',
    },
    itemPrice: {
        fontSize: 15,
        color: '#14C38E',
        fontWeight: '700',
    },

    /* Delivery Address */
    deliveryAddress: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        backgroundColor: 'rgba(20, 195, 142, 0.05)',
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#14C38E',
    },
    addressIcon: {
        fontSize: 18,
    },
    addressText: {
        fontSize: 14,
        color: '#1E293B',
        lineHeight: 21,
        flex: 1,
    },

    /* Card Footer */
    orderCardFooter: {
        padding: 20,
        paddingHorizontal: 24,
        borderTopWidth: 1,
        borderTopColor: 'rgba(226, 232, 240, 0.8)',
        backgroundColor: '#F8F9FD',
        flexDirection: 'row',
        gap: 12,
    },

    /* Buttons */
    btnPrimary: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#14C38E',
        borderRadius: 12,
        alignItems: 'center',
    },
    btnPrimaryText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    btnSecondary: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#14C38E',
        borderRadius: 12,
        alignItems: 'center',
    },
    btnSecondaryText: {
        color: '#14C38E',
        fontSize: 14,
        fontWeight: '600',
    },

    /* Empty State */
    emptyState: {
        alignItems: 'center',
        padding: 80,
    },
    emptyIcon: {
        fontSize: 64,
        opacity: 0.5,
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 24,
        color: '#1E293B',
        fontWeight: '700',
        marginBottom: 12,
    },
    emptySubtext: {
        fontSize: 15,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 30,
    },

    /* CTA */
    ctaCard: {
        backgroundColor: '#0A2647',
        padding: 48,
        borderRadius: 24,
        alignItems: 'center',
        marginTop: 60,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.1,
        shadowRadius: 25,
        elevation: 6,
    },
    ctaTitle: {
        fontSize: 24,
        color: '#FFFFFF',
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center',
    },
    ctaSubtext: {
        fontSize: 16,
        color: '#FFFFFF',
        opacity: 0.9,
        marginBottom: 24,
        textAlign: 'center',
    },
    btnWhite: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#14C38E',
    },
    btnWhiteText: {
        color: '#14C38E',
        fontSize: 15,
        fontWeight: '600',
    },
});

export default Pharmacy;
