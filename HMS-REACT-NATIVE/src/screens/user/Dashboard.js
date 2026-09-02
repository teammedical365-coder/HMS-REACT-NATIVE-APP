import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Modal, Linking
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../utils/api'; // Migrated Axios instance

const PrescriptionModal = ({ appointment, onClose }) => {
    if (!appointment) return null;

    const labReports = appointment.prescriptions?.filter(doc => doc.type === 'lab_report') || [];
    const doctorPrescriptions = appointment.prescriptions?.filter(doc => doc.type !== 'lab_report') || [];

    if (doctorPrescriptions.length === 0 && appointment.prescription) {
        doctorPrescriptions.push({ url: appointment.prescription, name: 'Prescription File' });
    }

    const pharmacyItems = appointment.pharmacy?.map(p => ({
        name: p.medicineName || p.name,
        frequency: p.frequency || '-',
        duration: p.duration || '-'
    })) || [];

    const dietItems = appointment.dietPlan || appointment.diet || [];

    return (
        <Modal transparent visible animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalHeaderTitle}>Treatment Details</Text>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                            <Text style={styles.modalCloseText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalBody}>
                        <View style={styles.detailsInfoGrid}>
                            <Text style={styles.detailsText}><Text style={styles.bold}>Doctor:</Text> {appointment.doctorName}</Text>
                            <Text style={styles.detailsText}><Text style={styles.bold}>Date:</Text> {new Date(appointment.appointmentDate).toLocaleDateString()}</Text>
                            <Text style={styles.detailsText}><Text style={styles.bold}>Service:</Text> {appointment.serviceName}</Text>
                        </View>

                        <View style={styles.hr} />

                        {appointment.notes ? (
                            <View style={styles.detailSection}>
                                <Text style={styles.detailSectionTitle}>DIAGNOSIS / NOTES</Text>
                                <Text style={styles.notesText}>{appointment.notes}</Text>
                            </View>
                        ) : null}

                        {appointment.labTests && appointment.labTests.length > 0 && (
                            <View style={styles.detailSection}>
                                <View style={styles.rowBetween}>
                                    <Text style={styles.detailSectionTitle}>RECOMMENDED LAB TESTS</Text>
                                    {labReports.length > 0 ? (
                                        <Text style={[styles.statusBadge, styles.statusCompleted, { fontSize: 10 }]}>Results Ready</Text>
                                    ) : (
                                        <Text style={[styles.statusBadge, styles.statusPending, { fontSize: 10 }]}>Processing</Text>
                                    )}
                                </View>
                                <View style={styles.tagsContainer}>
                                    {appointment.labTests.map((test, i) => (
                                        <View key={i} style={styles.detailTag}><Text style={styles.detailTagText}>{test}</Text></View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {labReports.length > 0 && (
                            <View style={[styles.detailSection, styles.labSection]}>
                                <Text style={styles.labSectionTitle}>🔬 Lab Results</Text>
                                <View style={styles.filesList}>
                                    {labReports.map((doc, i) => (
                                        <TouchableOpacity key={i} style={[styles.fileLink, { borderColor: '#0284c7' }]} onPress={() => Linking.openURL(doc.url)}>
                                            <Text style={[styles.fileLinkText, { color: '#0284c7' }]}>📄 {doc.name || 'Download Report'}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {pharmacyItems.length > 0 && (
                            <View style={styles.detailSection}>
                                <Text style={styles.detailSectionTitle}>PRESCRIBED MEDICATIONS</Text>
                                <View style={styles.medTable}>
                                    <View style={styles.medTableHeader}>
                                        <Text style={[styles.medTableCell, styles.medTableHeadText]}>Medicine</Text>
                                        <Text style={[styles.medTableCell, styles.medTableHeadText]}>Freq</Text>
                                        <Text style={[styles.medTableCell, styles.medTableHeadText]}>Dur</Text>
                                    </View>
                                    {pharmacyItems.map((med, i) => (
                                        <View key={i} style={styles.medTableRow}>
                                            <Text style={styles.medTableCell}>{med.name}</Text>
                                            <Text style={styles.medTableCell}>{med.frequency}</Text>
                                            <Text style={styles.medTableCell}>{med.duration}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {dietItems.length > 0 && (
                            <View style={styles.detailSection}>
                                <Text style={styles.detailSectionTitle}>DIETARY RECOMMENDATIONS</Text>
                                {dietItems.map((item, i) => (
                                    <Text key={i} style={styles.listItem}>• {item}</Text>
                                ))}
                            </View>
                        )}

                        {doctorPrescriptions.length > 0 && (
                            <View style={styles.detailSection}>
                                <Text style={styles.detailSectionTitle}>📝 PRESCRIPTIONS</Text>
                                <View style={styles.filesList}>
                                    {doctorPrescriptions.map((doc, i) => (
                                        <TouchableOpacity key={i} style={styles.fileLink} onPress={() => Linking.openURL(doc.url)}>
                                            <Text style={styles.fileLinkText}>📄 {doc.name || 'View Prescription'}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.authButton} onPress={onClose}>
                            <Text style={styles.authButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const Dashboard = () => {
    const navigation = useNavigation();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [labReports, setLabReports] = useState([]);
    const [pharmacyOrders, setPharmacyOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedAppointment, setSelectedAppointment] = useState(null);

    useEffect(() => {
        const checkAuth = async () => {
            const token = await AsyncStorage.getItem('token');
            const userData = await AsyncStorage.getItem('user');

            if (token && userData) {
                setIsAuthenticated(true);
                setUser(JSON.parse(userData));
                fetchDashboardData(token);
            } else {
                navigation.replace('Login'); // Replaced redirect with native nav
            }
        };
        checkAuth();
    }, [navigation]);

    const fetchDashboardData = async (token) => {
        setIsLoading(true);
        try {
            // Using exact routes with axios intercepted API
            const appRes = await api.get(`/api/appointments/my-appointments`);
            if (appRes.data.success) setAppointments(appRes.data.appointments || []);

            const labRes = await api.get(`/api/lab/my-reports`);
            if (labRes.data.success) setLabReports(labRes.data.reports || []);

            const rxRes = await api.get(`/api/pharmacy/orders/my-orders`);
            if (rxRes.data.success) setPharmacyOrders(rxRes.data.orders || []);
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const isUpcoming = (appointmentDate, appointmentTime) => {
        if (!appointmentDate || !appointmentTime) return false;
        return new Date(`${appointmentDate}T${appointmentTime}`) >= new Date();
    };

    const hasDetails = (app) => {
        return app.status === 'completed' || app.notes || app.prescription ||
            (app.prescriptions?.length > 0) || (app.labTests?.length > 0) || (app.pharmacy?.length > 0);
    };

    if (!isAuthenticated) return null;

    return (
        <ScrollView style={styles.dashboardPage} contentContainerStyle={styles.contentWrapper}>
            <View style={styles.dashboardHeader}>
                <View style={styles.badge}><Text style={styles.badgeText}>USER DASHBOARD</Text></View>
                <Text style={styles.headerTitle}>Welcome back,</Text>
                <Text style={styles.textGradient}>{user?.name || 'User'}</Text>
                {user?.patientId && (
                    <View style={styles.patientIdContainer}>
                        <Text style={styles.patientIdText}>Patient ID: {user.patientId}</Text>
                    </View>
                )}
            </View>

            {isLoading ? (
                <View style={styles.loadingState}>
                    <ActivityIndicator size="large" color="#d91a8a" />
                    <Text style={styles.loadingText}>Loading your dashboard...</Text>
                </View>
            ) : (
                <View style={styles.dashboardGrid}>

                    {/* --- APPOINTMENTS --- */}
                    <View style={styles.dashboardColumn}>
                        <View style={styles.columnHeaderApp}>
                            <View style={styles.columnIcon}><Text style={styles.iconText}>📅</Text></View>
                            <View>
                                <Text style={styles.columnTitle}>Appointments</Text>
                                <Text style={styles.columnCount}>{appointments.length} total</Text>
                            </View>
                        </View>
                        <View style={styles.columnContent}>
                            {appointments.length > 0 ? (
                                appointments.slice(0, 3).map((appointment) => {
                                    const upcoming = isUpcoming(appointment.appointmentDate, appointment.appointmentTime);
                                    return (
                                        <View key={appointment._id} style={[styles.dashboardItem, upcoming ? styles.upcomingBorder : styles.pastItem]}>
                                            <View style={styles.itemHeader}>
                                                <Text style={[styles.statusBadge, styles[`status${appointment.status}`] || styles.statusPending]}>
                                                    {appointment.status}
                                                </Text>
                                            </View>
                                            <View style={styles.itemBody}>
                                                <Text style={styles.itemTitle}>Dr. {appointment.doctorName}</Text>
                                                <View style={styles.itemDetails}>
                                                    <Text style={styles.detail}>📅 {formatDate(appointment.appointmentDate)}</Text>
                                                    <Text style={styles.detail}>🕐 {appointment.appointmentTime}</Text>
                                                </View>

                                                {appointment.pharmacy && appointment.pharmacy.length > 0 && (
                                                    <View style={styles.medsPreview}>
                                                        <Text style={styles.medsPreviewText}>
                                                            <Text style={{ color: '#0ea5e9', fontWeight: 'bold' }}>💊 Rx: </Text>
                                                            {appointment.pharmacy.map(p => p.medicineName || p.name).join(', ')}
                                                        </Text>
                                                    </View>
                                                )}

                                                {hasDetails(appointment) && (
                                                    <TouchableOpacity style={styles.viewPrescBtn} onPress={() => setSelectedAppointment(appointment)}>
                                                        <Text style={styles.viewPrescBtnText}>View Details</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })
                            ) : <View style={styles.emptyStateSmall}><Text style={styles.emptyStateText}>No appointments yet</Text></View>}
                        </View>
                        <View style={styles.columnFooter}>
                            <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
                                <Text style={styles.viewAllLink}>View Previous Appointments →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* --- LAB REPORTS --- */}
                    <View style={styles.dashboardColumn}>
                        <View style={styles.columnHeaderLab}>
                            <View style={styles.columnIcon}><Text style={styles.iconText}>🔬</Text></View>
                            <View>
                                <Text style={styles.columnTitle}>Lab Reports</Text>
                                <Text style={styles.columnCount}>{labReports.length} reports</Text>
                            </View>
                        </View>
                        <View style={styles.columnContent}>
                            {labReports.length > 0 ? (
                                labReports.slice(0, 3).map(report => (
                                    <View key={report._id} style={styles.dashboardItem}>
                                        <View style={styles.itemHeader}>
                                            <Text style={styles.itemId}>#{report._id.slice(-6).toUpperCase()}</Text>
                                            <Text style={[styles.statusBadge, styles[`status${report.testStatus?.toLowerCase()}`] || styles.statusPending]}>
                                                {report.testStatus}
                                            </Text>
                                        </View>
                                        <View style={styles.itemBody}>
                                            <Text style={styles.itemTitle}>{report.testNames?.join(', ') || 'Diagnostic Tests'}</Text>
                                            <View style={styles.itemDetails}>
                                                <Text style={styles.detail}>📅 {formatDate(report.createdAt)}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            ) : <View style={styles.emptyStateSmall}><Text style={styles.emptyStateText}>No lab reports</Text></View>}
                        </View>
                        <View style={styles.columnFooter}>
                            <TouchableOpacity onPress={() => navigation.navigate('LabReports')}>
                                <Text style={styles.viewAllLink}>View Previous Reports →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* --- PHARMACY --- */}
                    <View style={styles.dashboardColumn}>
                        <View style={styles.columnHeaderRx}>
                            <View style={styles.columnIcon}><Text style={styles.iconText}>💊</Text></View>
                            <View>
                                <Text style={styles.columnTitle}>Pharmacy</Text>
                                <Text style={styles.columnCount}>{pharmacyOrders.length} orders</Text>
                            </View>
                        </View>
                        <View style={styles.columnContent}>
                            {pharmacyOrders.length > 0 ? (
                                pharmacyOrders.slice(0, 3).map(order => (
                                    <View key={order._id} style={styles.dashboardItem}>
                                        <View style={styles.itemHeader}>
                                            <Text style={styles.itemId}>#{order._id.slice(-6).toUpperCase()}</Text>
                                            <Text style={[styles.statusBadge, styles[`status${order.orderStatus?.toLowerCase()}`] || styles.statusPending]}>
                                                {order.orderStatus}
                                            </Text>
                                        </View>
                                        <View style={styles.itemBody}>
                                            <Text style={styles.itemTitle}>{order.items?.length || 0} items</Text>
                                            <View style={styles.itemDetails}>
                                                <Text style={styles.detail}>📅 {formatDate(order.createdAt)}</Text>
                                                <Text style={styles.detail}>Status: {order.paymentStatus}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            ) : <View style={styles.emptyStateSmall}><Text style={styles.emptyStateText}>No orders yet</Text></View>}
                        </View>
                        <View style={styles.columnFooter}>
                            <TouchableOpacity onPress={() => navigation.navigate('Pharmacy')}>
                                <Text style={styles.viewAllLink}>View Previous Orders →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </View>
            )}

            {selectedAppointment && <PrescriptionModal appointment={selectedAppointment} onClose={() => setSelectedAppointment(null)} />}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    dashboardPage: {
        flex: 1,
        backgroundColor: '#fdfbf9', // --bg-warm
    },
    contentWrapper: {
        padding: 20,
        paddingTop: 40,
        maxWidth: 1400,
        alignSelf: 'center',
        width: '100%',
    },
    dashboardHeader: {
        alignItems: 'center',
        marginBottom: 50,
        padding: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 20,
        borderColor: '#ffffff',
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 30,
        elevation: 3,
    },
    badge: {
        backgroundColor: '#e0f7fa',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 30,
        marginBottom: 20,
    },
    badgeText: {
        color: '#0a7c86',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    headerTitle: {
        fontSize: 32, // approx 3rem native scaling
        color: '#2d2d2d',
        fontWeight: '700',
        marginBottom: 5,
    },
    textGradient: {
        fontSize: 32,
        fontWeight: '700',
        color: '#d91a8a', // Fallback for gradient text
        marginBottom: 15,
    },
    patientIdContainer: {
        backgroundColor: 'rgba(10, 124, 134, 0.08)',
        paddingVertical: 5,
        paddingHorizontal: 15,
        borderRadius: 10,
        marginBottom: 10,
    },
    patientIdText: {
        fontWeight: '600',
        color: '#0a7c86',
    },
    loadingState: {
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 20,
        color: '#999999',
    },
    dashboardGrid: {
        flexDirection: 'column',
        gap: 30,
        marginBottom: 60,
    },
    dashboardColumn: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 30,
        elevation: 3,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.02)',
    },
    columnHeaderApp: { backgroundColor: '#d91a8a', padding: 25, flexDirection: 'row', alignItems: 'center' }, // brand-pink
    columnHeaderLab: { backgroundColor: '#0a7c86', padding: 25, flexDirection: 'row', alignItems: 'center' }, // brand-teal
    columnHeaderRx: { backgroundColor: '#2d2d2d', padding: 25, flexDirection: 'row', alignItems: 'center' },

    columnIcon: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        width: 50, height: 50, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 18,
    },
    iconText: { fontSize: 24 },
    columnTitle: { color: '#fff', fontSize: 20, fontWeight: '600' },
    columnCount: { color: '#fff', fontSize: 13, opacity: 0.8 },

    columnContent: {
        padding: 25,
        backgroundColor: '#fff',
        minHeight: 200,
    },
    columnFooter: {
        paddingVertical: 20, paddingHorizontal: 25,
        borderTopWidth: 1, borderColor: '#f0f0f0',
        backgroundColor: '#fbfbfb',
        alignItems: 'center',
    },
    viewAllLink: { color: '#d91a8a', fontWeight: '600', fontSize: 14 },

    dashboardItem: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: '#f0f0f0',
        marginBottom: 15,
    },
    upcomingBorder: { borderLeftWidth: 4, borderLeftColor: '#0a7c86', backgroundColor: '#fafdfd' },
    pastItem: { opacity: 0.85 },

    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    itemId: { fontSize: 11, fontWeight: '700', color: '#999999', backgroundColor: '#f5f5f5', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4 },
    itemTitle: { fontSize: 16, color: '#2d2d2d', fontWeight: '600', marginBottom: 8 },
    itemDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
    detail: { fontSize: 12, color: '#555555', backgroundColor: '#f9f9f9', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, marginRight: 8 },

    statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    statusconfirmed: { backgroundColor: '#e0f7fa', color: '#0a7c86' },
    statuscompleted: { backgroundColor: '#e0f7fa', color: '#0a7c86' },
    statusdelivered: { backgroundColor: '#e0f7fa', color: '#0a7c86' },
    statuspending: { backgroundColor: '#fff8e1', color: '#f57c00' },
    statusprocessing: { backgroundColor: '#fff8e1', color: '#f57c00' },
    statuscancelled: { backgroundColor: '#ffebee', color: '#c62828' },

    medsPreview: { marginTop: 8, backgroundColor: '#f1f5f9', padding: 6, borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#0ea5e9' },
    medsPreviewText: { fontSize: 12, color: '#555' },

    viewPrescBtn: { marginTop: 10, padding: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#d91a8a', borderRadius: 30, alignItems: 'center' },
    viewPrescBtnText: { color: '#d91a8a', fontSize: 13, fontWeight: '600' },
    emptyStateSmall: { padding: 40, alignItems: 'center' },
    emptyStateText: { color: '#999999', marginTop: 10, fontWeight: '500' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', maxHeight: '90%' },
    modalHeader: { backgroundColor: '#d91a8a', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalHeaderTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    modalCloseText: { color: '#fff', fontSize: 20 },
    modalBody: { padding: 25 },
    detailsInfoGrid: { backgroundColor: '#fcfcfc', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#f0f0f0', marginBottom: 15 },
    detailsText: { fontSize: 14, marginBottom: 5 },
    bold: { fontWeight: 'bold' },
    hr: { height: 1, backgroundColor: '#eee', marginVertical: 15 },
    detailSection: { marginTop: 25 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    detailSectionTitle: { color: '#d91a8a', fontSize: 14, fontWeight: 'bold', borderBottomWidth: 2, borderBottomColor: '#ffeaf5', paddingBottom: 5, alignSelf: 'flex-start', marginBottom: 12 },
    notesText: { fontSize: 14, color: '#555' },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    detailTag: { backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginRight: 8, marginBottom: 8 },
    detailTagText: { fontSize: 12, color: '#333' },
    labSection: { backgroundColor: '#f0f9ff', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd' },
    labSectionTitle: { color: '#0284c7', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
    filesList: { flexDirection: 'column', gap: 8 },
    fileLink: { padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 8 },
    fileLinkText: { color: '#2d2d2d', fontWeight: '500' },
    medTable: { borderWidth: 1, borderColor: '#eee' },
    medTableHeader: { flexDirection: 'row', backgroundColor: '#e0f7fa', padding: 10 },
    medTableRow: { flexDirection: 'row', padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
    medTableCell: { flex: 1, fontSize: 13 },
    medTableHeadText: { fontWeight: '600', color: '#0a7c86' },
    listItem: { fontSize: 14, color: '#555', marginBottom: 5 },
    modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'flex-end' },
    authButton: { backgroundColor: '#2d2d2d', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 30 },
    authButtonText: { color: '#fff', fontWeight: '600' }
});

export default Dashboard;
