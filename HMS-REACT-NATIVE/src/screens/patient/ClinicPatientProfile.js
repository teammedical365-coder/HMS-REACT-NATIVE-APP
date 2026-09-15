import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    useWindowDimensions
} from 'react-native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { patientAPI, doctorAPI, clinicAPI } from '../../utils/api';
import AppointmentReports from '../../components/AppointmentReports';
import PatientVialsSection from '../../components/vials/PatientVialsSection';

export default function ClinicPatientProfile() {
    const route = useRoute();
    const navigation = useNavigation();
    const patientId = route.params?.id || route.params?.patientId;

    const { width } = useWindowDimensions();
    const isMobile = width < 768;

    const [patientData, setPatientData] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('timeline');
    const [savingVitals, setSavingVitals] = useState(false);

    // Vitals form
    const [vitalsForm, setVitalsForm] = useState({
        weight: '',
        height: '',
        bmi: '',
        bloodPressure: '',
        pulse: '',
        temperature: '',
        spo2: '',
        respiratoryRate: ''
    });

    useEffect(() => {
        if (patientId) {
            fetchProfile();
        } else {
            setLoading(false);
            setError('Patient ID is missing.');
        }
    }, [patientId]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const res = await patientAPI.getFullHistory(patientId);
            if (res.success) {
                if (res.user && Array.isArray(res.user.reports)) {
                    res.user.reports = Array.from(
                        new Map(res.user.reports.map(r => [r.filename || r.url || r.fileUrl || r.name, r])).values()
                    );
                }
                setPatientData(res.user);
                setTimeline(res.timeline || []);
            } else {
                setError(res.message || 'Failed to load profile data.');
            }
        } catch (err) {
            console.error('Fetch profile error:', err);
            setError('An error occurred while fetching the profile.');
        } finally {
            setLoading(false);
        }
    };

    // Helper to filter out unassigned/orphaned placeholder visits
    const filterValidVisits = (items) => {
        if (!Array.isArray(items) || items.length === 0) return [];

        const isUnassignedPlaceholder = (item) => {
            const d = item.data || item;
            const rawDoc = (d.doctorName || d.doctorSeen || d.doctorId?.name || d.assignedDoctor || '').toString().trim();
            const docClean = rawDoc.replace(/^dr\.\s*/i, '').toLowerCase();
            const isDocUnassigned = !docClean || docClean === 'not assigned' || docClean === 'pending' || docClean === 'unassigned' || docClean === 'none';

            const status = (d.status || '').toString().toLowerCase();
            const isStatusUnassigned = status === 'active' || status === 'pending' || !status;

            const hasDoctorActions = Boolean(
                (d.diagnosis && d.diagnosis !== '—' && d.diagnosis !== 'Processing' && d.diagnosis !== 'No diagnosis logged') ||
                (d.doctorNotes && d.doctorNotes.trim()) ||
                (d.notes && d.notes.trim() && d.notes !== '—') ||
                (d.prescriptions && d.prescriptions.length > 0) ||
                (d.medicines && d.medicines.length > 0) ||
                (d.pharmacy && d.pharmacy.length > 0)
            );

            return isDocUnassigned && isStatusUnassigned && !hasDoctorActions;
        };

        const hasValidConsultation = items.some(item => !isUnassignedPlaceholder(item));
        if (hasValidConsultation) {
            return items.filter(item => !isUnassignedPlaceholder(item));
        }
        return items;
    };

    // Calculate Metrics
    const calculateMetrics = () => {
        const validTimeline = filterValidVisits(timeline);
        const appointments = validTimeline.filter(t => t.type === 'appointment' || t.type === 'clinicalVisit') || [];
        const upcoming = appointments.filter(a => {
            const status = a.data?.status;
            const date = new Date(a.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return (status === 'pending' || status === 'confirmed') && date >= today;
        });

        let totalPaid = 0;
        let pendingDues = 0;

        appointments.forEach(a => {
            const amt = Number(a.data?.amount || 0);
            const pStatus = (a.data?.paymentStatus || '').toLowerCase();
            if (pStatus === 'paid') {
                totalPaid += amt;
            } else if (pStatus === 'pending') {
                pendingDues += amt;
            }
        });

        return {
            totalVisits: appointments.length,
            upcomingCount: upcoming.length,
            totalPaid,
            pendingDues
        };
    };

    // Auto-calculate BMI when height and weight change
    const updateVitalsField = (field, val) => {
        const next = { ...vitalsForm, [field]: val };
        const w = parseFloat(field === 'weight' ? val : next.weight);
        const hCm = parseFloat(field === 'height' ? val : next.height);
        if (w > 0 && hCm > 0) {
            const hM = hCm / 100;
            const bmiCalc = (w / (hM * hM)).toFixed(1);
            next.bmi = bmiCalc;
        }
        setVitalsForm(next);
    };

    const handleSaveVitals = async () => {
        if (!patientData?._id) return;
        setSavingVitals(true);
        try {
            const profileData = {
                vitals: {
                    weight: vitalsForm.weight,
                    height: vitalsForm.height,
                    bmi: vitalsForm.bmi,
                    bloodPressure: vitalsForm.bloodPressure,
                    pulse: vitalsForm.pulse,
                    temperature: vitalsForm.temperature,
                    spo2: vitalsForm.spo2,
                    respiratoryRate: vitalsForm.respiratoryRate,
                    lastRecorded: new Date().toISOString()
                }
            };
            await doctorAPI.updatePatientProfile(patientData._id, profileData);
            Alert.alert('Success', 'Vitals recorded successfully!');
            setVitalsForm({
                weight: '', height: '', bmi: '', bloodPressure: '', pulse: '', temperature: '', spo2: '', respiratoryRate: ''
            });
            fetchProfile();
        } catch (err) {
            console.error('Save vitals error:', err);
            Alert.alert('Error', err?.response?.data?.message || 'Failed to record vitals.');
        } finally {
            setSavingVitals(false);
        }
    };

    // Medicines extraction from timeline
    const getMedicinesList = () => {
        const list = [];
        timeline.filter(t => t.type === 'appointment').forEach(appt => {
            const meds = appt.data?.pharmacy || appt.data?.medicines || appt.data?.prescriptions || [];
            meds.forEach(m => {
                list.push({
                    name: m.medicineName || m.name || 'Medicine',
                    salt: m.saltName || m.salt || '—',
                    frequency: m.frequency || m.dosage || m.dose || '—',
                    duration: m.duration || (m.days ? `${m.days} days` : '—'),
                    date: appt.date
                });
            });
        });
        return list;
    };
    const medicinesList = getMedicinesList();

    // Financial invoices from timeline
    const getInvoicesList = () => {
        return timeline
            .filter(t => t.type === 'appointment' && Number(t.data?.amount || 0) > 0)
            .map(t => ({
                id: t.data?._id,
                date: t.date,
                amount: t.data?.amount,
                method: t.data?.paymentMethod || 'Cash',
                status: t.data?.paymentStatus || 'Pending'
            }));
    };
    const invoicesList = getInvoicesList();

    // Export PDF Summary via native expo-print
    const handleDownloadPDF = async () => {
        if (!patientData) return;
        try {
            const validTimeline = filterValidVisits(timeline);
            const appointments = validTimeline.filter(t => t.type === 'appointment' || t.type === 'clinicalVisit');
            const vitals = patientData.vitals || {};

            const apptRows = appointments.map(a => `
                <tr>
                    <td style="padding: 6px; border: 1px solid #e2e8f0;">${new Date(a.date).toLocaleDateString('en-IN')}</td>
                    <td style="padding: 6px; border: 1px solid #e2e8f0;">${a.data?.doctorName || a.data?.doctorSeen || 'Not Assigned'}</td>
                    <td style="padding: 6px; border: 1px solid #e2e8f0;">${a.data?.diagnosis || '—'}</td>
                    <td style="padding: 6px; border: 1px solid #e2e8f0;">${a.data?.notes || a.data?.doctorNotes || '—'}</td>
                    <td style="padding: 6px; border: 1px solid #e2e8f0;"><strong>${a.data?.status || 'Completed'}</strong></td>
                </tr>
            `).join('');

            const medRows = medicinesList.map((m, idx) => `
                <tr>
                    <td style="padding: 6px; border: 1px solid #e2e8f0;">${idx + 1}</td>
                    <td style="padding: 6px; border: 1px solid #e2e8f0;">${new Date(m.date).toLocaleDateString('en-IN')}</td>
                    <td style="padding: 6px; border: 1px solid #e2e8f0;"><strong>${m.name}</strong></td>
                    <td style="padding: 6px; border: 1px solid #e2e8f0;">${m.frequency}</td>
                    <td style="padding: 6px; border: 1px solid #e2e8f0;">${m.duration}</td>
                </tr>
            `).join('');

            const html = `
                <html>
                <body style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b;">
                    <div style="background: #4f46e5; color: white; padding: 18px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                        <h2 style="margin: 0;">CLINIC PATIENT PROFILE SUMMARY</h2>
                    </div>

                    <table style="width: 100%; margin-bottom: 20px; font-size: 13px;">
                        <tr>
                            <td><strong>Patient Name:</strong> ${patientData.name || '—'}</td>
                            <td><strong>Blood Group:</strong> ${patientData.bloodGroup || '—'}</td>
                        </tr>
                        <tr>
                            <td><strong>UID (MRN):</strong> ${patientData.patientUid || patientData._id || '—'}</td>
                            <td><strong>Gender / DOB:</strong> ${patientData.gender || '—'} / ${patientData.dob ? new Date(patientData.dob).toLocaleDateString('en-IN') : '—'}</td>
                        </tr>
                        <tr>
                            <td><strong>Phone:</strong> ${patientData.phone || '—'}</td>
                            <td><strong>Allergies:</strong> ${patientData.allergies || 'None'}</td>
                        </tr>
                    </table>

                    <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 12px;">
                        <h4 style="margin: 0 0 8px 0; color: #4f46e5;">LATEST RECORDED VITALS</h4>
                        <p style="margin: 4px 0;">Weight: ${vitals.weight || '—'} kg | Height: ${vitals.height || '—'} cm | BP: ${vitals.bloodPressure || vitals.bp || '—'} | Pulse: ${vitals.pulse || '—'} bpm | Temp: ${vitals.temperature || '—'}°F</p>
                    </div>

                    <h3 style="color: #4f46e5; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">Consultation Visit History</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px;">
                        <thead>
                            <tr style="background: #eef2ff;">
                                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: left;">Date</th>
                                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: left;">Doctor</th>
                                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: left;">Diagnosis</th>
                                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: left;">Notes</th>
                                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: left;">Status</th>
                            </tr>
                        </thead>
                        <tbody>${apptRows || '<tr><td colspan="5" style="padding: 8px; text-align: center;">No visits recorded</td></tr>'}</tbody>
                    </table>

                    <h3 style="color: #10b981; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">Prescribed Medicines Summary</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="background: #f0fdf4;">
                                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: left;">#</th>
                                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: left;">Date</th>
                                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: left;">Medicine</th>
                                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: left;">Dosage</th>
                                <th style="padding: 6px; border: 1px solid #cbd5e1; text-align: left;">Duration</th>
                            </tr>
                        </thead>
                        <tbody>${medRows || '<tr><td colspan="5" style="padding: 8px; text-align: center;">No medicines recorded</td></tr>'}</tbody>
                    </table>
                </body>
                </html>
            `;

            const file = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(file.uri, {
                    UTI: '.pdf',
                    mimeType: 'application/pdf',
                    dialogTitle: 'Export Patient Profile Summary'
                });
            } else {
                Alert.alert('PDF Generated', `Saved at: ${file.uri}`);
            }
        } catch (err) {
            console.error('PDF export error:', err);
            Alert.alert('Export Failed', err.message || 'Could not export PDF');
        }
    };

    if (loading) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loaderText}>Loading patient history details...</Text>
            </View>
        );
    }

    if (error || !patientData) {
        return (
            <View style={styles.loaderContainer}>
                <Feather name="alert-circle" size={48} color="#ef4444" />
                <Text style={styles.errorText}>{error || 'Patient profile not found.'}</Text>
                <TouchableOpacity style={styles.btnBack} onPress={() => navigation.goBack()}>
                    <Feather name="arrow-left" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.btnBackText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const metrics = calculateMetrics();
    const displayTimeline = filterValidVisits(timeline);
    const relative = patientData.relatives?.[0] || {};

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header Identity Card */}
            <View style={styles.headerCard}>
                <View style={styles.identityRow}>
                    <View style={styles.avatarLarge}>
                        <Text style={styles.avatarLetter}>{(patientData.name || 'P')[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.identityInfo}>
                        <Text style={styles.patientName}>{patientData.name}</Text>
                        <View style={styles.tagsRow}>
                            <View style={[styles.tagPill, { backgroundColor: '#e0e7ff' }]}>
                                <Text style={[styles.tagPillText, { color: '#4338ca' }]}>UID: {patientData.patientUid || patientData._id?.slice(-6)}</Text>
                            </View>
                            <View style={styles.tagPill}>
                                <Text style={styles.tagPillText}>📱 {patientData.phone || 'No phone'}</Text>
                            </View>
                            <View style={styles.tagPill}>
                                <Text style={styles.tagPillText}>🩸 {patientData.bloodGroup || '—'}</Text>
                            </View>
                            <View style={styles.tagPill}>
                                <Text style={styles.tagPillText}>👤 {patientData.gender || '—'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View style={styles.headerActionRow}>
                    <TouchableOpacity style={styles.btnBackAction} onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={15} color="#475569" style={{ marginRight: 4 }} />
                        <Text style={styles.btnBackActionText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnExport} onPress={handleDownloadPDF}>
                        <Feather name="download" size={15} color="#ffffff" style={{ marginRight: 4 }} />
                        <Text style={styles.btnExportText}>Export Summary</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Quick Metrics Cards */}
            <View style={styles.metricsGrid}>
                <View style={[styles.metricCard, { borderLeftColor: '#3b82f6' }]}>
                    <View>
                        <Text style={styles.metricLbl}>Total Visits</Text>
                        <Text style={styles.metricVal}>{metrics.totalVisits}</Text>
                    </View>
                    <Feather name="user-check" size={20} color="#3b82f6" />
                </View>
                <View style={[styles.metricCard, { borderLeftColor: '#f59e0b' }]}>
                    <View>
                        <Text style={styles.metricLbl}>Upcoming</Text>
                        <Text style={[styles.metricVal, { color: '#f59e0b' }]}>{metrics.upcomingCount}</Text>
                    </View>
                    <Feather name="calendar" size={20} color="#f59e0b" />
                </View>
                <View style={[styles.metricCard, { borderLeftColor: '#10b981' }]}>
                    <View>
                        <Text style={styles.metricLbl}>Total Paid</Text>
                        <Text style={[styles.metricVal, { color: '#10b981' }]}>₹{metrics.totalPaid.toLocaleString('en-IN')}</Text>
                    </View>
                    <FontAwesome5 name="rupee-sign" size={18} color="#10b981" />
                </View>
                <View style={[styles.metricCard, { borderLeftColor: '#ef4444' }]}>
                    <View>
                        <Text style={styles.metricLbl}>Pending Dues</Text>
                        <Text style={[styles.metricVal, { color: '#ef4444' }]}>₹{metrics.pendingDues.toLocaleString('en-IN')}</Text>
                    </View>
                    <Feather name="alert-circle" size={20} color="#ef4444" />
                </View>
            </View>

            {/* Sidebar Demographics and Clinical Notes */}
            <View style={styles.cardsRow}>
                {/* Demographics Card */}
                <View style={styles.subCard}>
                    <View style={styles.subCardHeader}>
                        <Feather name="user" size={16} color="#3b82f6" style={{ marginRight: 6 }} />
                        <Text style={styles.subCardTitle}>Demographics</Text>
                    </View>
                    <View style={styles.detailsList}>
                        <View style={styles.detailRow}><Text style={styles.dLbl}>Email:</Text><Text style={styles.dVal}>{patientData.email || 'No email'}</Text></View>
                        <View style={styles.detailRow}><Text style={styles.dLbl}>DOB:</Text><Text style={styles.dVal}>{patientData.dob ? new Date(patientData.dob).toLocaleDateString('en-IN') : '—'}</Text></View>
                        <View style={styles.detailRow}><Text style={styles.dLbl}>Address:</Text><Text style={styles.dVal}>{patientData.address || '—'}</Text></View>
                    </View>
                </View>

                {/* Clinical Alerts Card */}
                <View style={styles.subCard}>
                    <View style={styles.subCardHeader}>
                        <Feather name="alert-triangle" size={16} color="#f59e0b" style={{ marginRight: 6 }} />
                        <Text style={[styles.subCardTitle, { color: '#b45309' }]}>Clinical Alerts</Text>
                    </View>
                    <View style={styles.detailsList}>
                        <View style={styles.detailRow}>
                            <Text style={styles.dLbl}>Allergies:</Text>
                            <Text style={[styles.dVal, patientData.allergies && { color: '#ef4444', fontWeight: '700' }]}>{patientData.allergies || 'None'}</Text>
                        </View>
                        <View style={styles.detailRow}><Text style={styles.dLbl}>Chronic:</Text><Text style={styles.dVal}>{patientData.chronicConditions || 'None'}</Text></View>
                        <View style={styles.detailRow}><Text style={styles.dLbl}>Intake Notes:</Text><Text style={styles.dVal}>{patientData.medicalNotes || 'None'}</Text></View>
                    </View>
                </View>

                {/* Emergency Relative Card */}
                <View style={styles.subCard}>
                    <View style={styles.subCardHeader}>
                        <Feather name="phone" size={16} color="#059669" style={{ marginRight: 6 }} />
                        <Text style={[styles.subCardTitle, { color: '#059669' }]}>Emergency Contact</Text>
                    </View>
                    {relative.name ? (
                        <View style={styles.detailsList}>
                            <View style={styles.detailRow}><Text style={styles.dLbl}>Name:</Text><Text style={styles.dVal}>{relative.name}</Text></View>
                            <View style={styles.detailRow}><Text style={styles.dLbl}>Relation:</Text><Text style={styles.dVal}>{relative.relation || 'Relative'}</Text></View>
                            <View style={styles.detailRow}><Text style={styles.dLbl}>Phone:</Text><Text style={styles.dVal}>{relative.phone || '—'}</Text></View>
                        </View>
                    ) : (
                        <Text style={styles.emptyTextSub}>No emergency contact on file.</Text>
                    )}
                </View>
            </View>

            {/* Horizontal Tabs Bar */}
            <View style={styles.tabsBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity style={[styles.tabBtn, activeTab === 'timeline' && styles.tabBtnActive]} onPress={() => setActiveTab('timeline')}>
                        <Text style={[styles.tabBtnText, activeTab === 'timeline' && styles.tabBtnTextActive]}>📋 Visits ({displayTimeline.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tabBtn, activeTab === 'medicines' && styles.tabBtnActive]} onPress={() => setActiveTab('medicines')}>
                        <Text style={[styles.tabBtnText, activeTab === 'medicines' && styles.tabBtnTextActive]}>💊 Medicines ({medicinesList.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tabBtn, activeTab === 'vitals' && styles.tabBtnActive]} onPress={() => setActiveTab('vitals')}>
                        <Text style={[styles.tabBtnText, activeTab === 'vitals' && styles.tabBtnTextActive]}>💓 Vitals</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tabBtn, activeTab === 'billing' && styles.tabBtnActive]} onPress={() => setActiveTab('billing')}>
                        <Text style={[styles.tabBtnText, activeTab === 'billing' && styles.tabBtnTextActive]}>💰 Financials ({invoicesList.length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tabBtn, activeTab === 'vials' && styles.tabBtnActive]} onPress={() => setActiveTab('vials')}>
                        <Text style={[styles.tabBtnText, activeTab === 'vials' && styles.tabBtnTextActive]}>🧪 Vial Storage</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* Tab: Timeline */}
            {activeTab === 'timeline' && (
                <View style={styles.tabContentCard}>
                    <Text style={styles.contentCardTitle}>Visit Consultation Log</Text>
                    {displayTimeline.length === 0 ? (
                        <Text style={styles.emptyText}>No consultation visits recorded for this patient.</Text>
                    ) : (
                        displayTimeline.map((item, idx) => {
                            const dateStr = new Date(item.date).toLocaleDateString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric'
                            });
                            const timeStr = item.data?.appointmentTime || '';
                            const diag = item.data?.diagnosis || 'No diagnosis logged';
                            const status = item.data?.status || 'Completed';

                            return (
                                <View key={idx} style={styles.timelineItem}>
                                    <View style={styles.tlHeader}>
                                        <View>
                                            <Text style={styles.tlDoctor}>Dr. {item.data?.doctorName || 'Not Assigned'}</Text>
                                            <Text style={styles.tlDate}>{dateStr} {timeStr ? `• ${timeStr}` : ''}</Text>
                                        </View>
                                        <View style={styles.statusPill}>
                                            <Text style={styles.statusPillText}>{status.toUpperCase()}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.tlSection}>
                                        <Text style={styles.tlSectionLbl}>Diagnosis</Text>
                                        <Text style={styles.tlSectionVal}>{diag}</Text>
                                    </View>

                                    {item.data?.notes ? (
                                        <View style={styles.tlSection}>
                                            <Text style={styles.tlSectionLbl}>Symptoms</Text>
                                            <Text style={styles.tlSectionSub}>{item.data.notes}</Text>
                                        </View>
                                    ) : null}

                                    {item.data?.doctorNotes ? (
                                        <View style={styles.tlSection}>
                                            <Text style={styles.tlSectionLbl}>Doctor Notes</Text>
                                            <Text style={styles.tlSectionSub}>{item.data.doctorNotes}</Text>
                                        </View>
                                    ) : null}

                                    {/* Consultation Vitals */}
                                    {item.data?.vitals && Object.values(item.data.vitals).some(Boolean) ? (
                                        <View style={styles.tlVitalsWrap}>
                                            {item.data.vitals.weight ? <Text style={styles.vitalPill}>⚖️ {item.data.vitals.weight}kg</Text> : null}
                                            {item.data.vitals.height ? <Text style={styles.vitalPill}>📏 {item.data.vitals.height}cm</Text> : null}
                                            {item.data.vitals.bp ? <Text style={styles.vitalPill}>🩸 BP: {item.data.vitals.bp}</Text> : null}
                                            {item.data.vitals.temperature ? <Text style={styles.vitalPill}>🌡️ {item.data.vitals.temperature}°F</Text> : null}
                                            {item.data.vitals.pulse ? <Text style={styles.vitalPill}>💓 {item.data.vitals.pulse} bpm</Text> : null}
                                        </View>
                                    ) : null}

                                    {/* Embedded Appointment Reports */}
                                    <View style={{ marginTop: 10 }}>
                                        <AppointmentReports appointmentId={item.data?._id} prescriptions={item.data?.prescriptions} />
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>
            )}

            {/* Tab: Medicines */}
            {activeTab === 'medicines' && (
                <View style={styles.tabContentCard}>
                    <Text style={styles.contentCardTitle}>Prescribed Medicines Log</Text>
                    {medicinesList.length === 0 ? (
                        <Text style={styles.emptyText}>No prescribed medicines logged.</Text>
                    ) : (
                        medicinesList.map((m, idx) => (
                            <View key={idx} style={styles.medRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.medName}>{m.name}</Text>
                                    <Text style={styles.medSub}>{m.salt !== '—' ? `${m.salt} • ` : ''}{new Date(m.date).toLocaleDateString('en-IN')}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.medFreq}>{m.frequency}</Text>
                                    <Text style={styles.medDur}>{m.duration}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            )}

            {/* Tab: Vitals */}
            {activeTab === 'vitals' && (
                <View style={styles.tabContentCard}>
                    <Text style={styles.contentCardTitle}>Record Patient Vitals</Text>

                    {/* Vitals Form */}
                    <View style={styles.vitalsForm}>
                        <View style={styles.vitalsGrid}>
                            <View style={styles.vitalsField}>
                                <Text style={styles.vLabel}>⚖️ Weight (kg)</Text>
                                <TextInput
                                    style={styles.vInput}
                                    placeholder="e.g. 70"
                                    keyboardType="numeric"
                                    value={vitalsForm.weight}
                                    onChangeText={(v) => updateVitalsField('weight', v)}
                                />
                            </View>
                            <View style={styles.vitalsField}>
                                <Text style={styles.vLabel}>📏 Height (cm)</Text>
                                <TextInput
                                    style={styles.vInput}
                                    placeholder="e.g. 175"
                                    keyboardType="numeric"
                                    value={vitalsForm.height}
                                    onChangeText={(v) => updateVitalsField('height', v)}
                                />
                            </View>
                            <View style={styles.vitalsField}>
                                <Text style={styles.vLabel}>🩸 Blood Pressure</Text>
                                <TextInput
                                    style={styles.vInput}
                                    placeholder="120/80"
                                    value={vitalsForm.bloodPressure}
                                    onChangeText={(v) => updateVitalsField('bloodPressure', v)}
                                />
                            </View>
                            <View style={styles.vitalsField}>
                                <Text style={styles.vLabel}>💓 Pulse (bpm)</Text>
                                <TextInput
                                    style={styles.vInput}
                                    placeholder="72"
                                    keyboardType="numeric"
                                    value={vitalsForm.pulse}
                                    onChangeText={(v) => updateVitalsField('pulse', v)}
                                />
                            </View>
                            <View style={styles.vitalsField}>
                                <Text style={styles.vLabel}>🌡️ Temp (°F)</Text>
                                <TextInput
                                    style={styles.vInput}
                                    placeholder="98.6"
                                    keyboardType="numeric"
                                    value={vitalsForm.temperature}
                                    onChangeText={(v) => updateVitalsField('temperature', v)}
                                />
                            </View>
                            <View style={styles.vitalsField}>
                                <Text style={styles.vLabel}>🫁 SpO₂ (%)</Text>
                                <TextInput
                                    style={styles.vInput}
                                    placeholder="99"
                                    keyboardType="numeric"
                                    value={vitalsForm.spo2}
                                    onChangeText={(v) => updateVitalsField('spo2', v)}
                                />
                            </View>
                        </View>

                        {vitalsForm.bmi ? (
                            <Text style={styles.bmiDisplay}>Calculated BMI: {vitalsForm.bmi}</Text>
                        ) : null}

                        <TouchableOpacity style={styles.btnSaveVitals} onPress={handleSaveVitals} disabled={savingVitals}>
                            <Text style={styles.btnSaveVitalsText}>{savingVitals ? 'Saving...' : 'Save Vitals Record'}</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.contentCardTitle, { marginTop: 20 }]}>Historical Vitals Log</Text>
                    {displayTimeline.filter(t => t.data?.vitals && Object.values(t.data.vitals).some(Boolean)).length === 0 ? (
                        <Text style={styles.emptyText}>No historical vitals logged yet.</Text>
                    ) : (
                        displayTimeline.filter(t => t.data?.vitals && Object.values(t.data.vitals).some(Boolean)).map((item, idx) => (
                            <View key={idx} style={styles.vitalLogRow}>
                                <Text style={styles.vitalLogDate}>{new Date(item.date).toLocaleDateString('en-IN')}</Text>
                                <View style={styles.tlVitalsWrap}>
                                    {item.data.vitals.weight ? <Text style={styles.vitalPill}>⚖️ {item.data.vitals.weight}kg</Text> : null}
                                    {item.data.vitals.height ? <Text style={styles.vitalPill}>📏 {item.data.vitals.height}cm</Text> : null}
                                    {item.data.vitals.bp ? <Text style={styles.vitalPill}>🩸 {item.data.vitals.bp}</Text> : null}
                                    {item.data.vitals.temperature ? <Text style={styles.vitalPill}>🌡️ {item.data.vitals.temperature}°F</Text> : null}
                                    {item.data.vitals.pulse ? <Text style={styles.vitalPill}>💓 {item.data.vitals.pulse} bpm</Text> : null}
                                </View>
                            </View>
                        ))
                    )}
                </View>
            )}

            {/* Tab: Financials */}
            {activeTab === 'billing' && (
                <View style={styles.tabContentCard}>
                    <Text style={styles.contentCardTitle}>Consultation Financial Details</Text>
                    {invoicesList.length === 0 ? (
                        <Text style={styles.emptyText}>No billing records found.</Text>
                    ) : (
                        invoicesList.map((inv, idx) => (
                            <View key={idx} style={styles.invoiceRow}>
                                <View>
                                    <Text style={styles.invDate}>{new Date(inv.date).toLocaleDateString('en-IN')}</Text>
                                    <Text style={styles.invMethod}>{inv.method}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.invAmount}>₹{inv.amount}</Text>
                                    <View style={[styles.statusPill, { backgroundColor: inv.status.toLowerCase() === 'paid' ? '#dcfce7' : '#fee2e2' }]}>
                                        <Text style={[styles.statusPillText, { color: inv.status.toLowerCase() === 'paid' ? '#15803d' : '#dc2626' }]}>
                                            {inv.status.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            )}

            {/* Tab: Vials */}
            {activeTab === 'vials' && (
                <View style={styles.tabContentCard}>
                    <PatientVialsSection patientId={patientData._id || patientId} patientData={patientData} />
                </View>
            )}

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc', padding: 14 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: '#f8fafc' },
    loaderText: { marginTop: 12, color: '#3b82f6', fontWeight: '700', fontSize: 14 },
    errorText: { marginTop: 12, color: '#ef4444', fontWeight: '700', fontSize: 16, textAlign: 'center' },
    btnBack: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#64748b', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginTop: 16 },
    btnBackText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
    headerCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
    identityRow: { flexDirection: 'row', alignItems: 'center' },
    avatarLarge: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' },
    avatarLetter: { color: '#ffffff', fontSize: 24, fontWeight: '800' },
    identityInfo: { marginLeft: 14, flex: 1 },
    patientName: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    tagPill: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
    tagPillText: { fontSize: 11, fontWeight: '600', color: '#475569' },
    headerActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderColor: '#f1f5f9' },
    btnBackAction: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f1f5f9' },
    btnBackActionText: { color: '#475569', fontWeight: '700', fontSize: 13 },
    btnExport: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#4f46e5' },
    btnExportText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
    metricCard: { flex: 1, minWidth: 140, backgroundColor: '#ffffff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    metricLbl: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    metricVal: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 2 },
    cardsRow: { gap: 10, marginBottom: 14 },
    subCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    subCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 6 },
    subCardTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
    detailsList: { gap: 4 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dLbl: { fontSize: 12, color: '#64748b' },
    dVal: { fontSize: 12, fontWeight: '600', color: '#0f172a', maxWidth: '65%', textAlign: 'right' },
    emptyTextSub: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
    tabsBar: { marginBottom: 12 },
    tabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8 },
    tabBtnActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
    tabBtnText: { fontSize: 13, fontWeight: '600', color: '#475569' },
    tabBtnTextActive: { color: '#ffffff', fontWeight: '800' },
    tabContentCard: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    contentCardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 12 },
    emptyText: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic', marginVertical: 8 },
    timelineItem: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
    tlHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tlDoctor: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
    tlDate: { fontSize: 11, color: '#64748b', marginTop: 2 },
    statusPill: { backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    statusPillText: { fontSize: 10, fontWeight: '700', color: '#15803d' },
    tlSection: { marginTop: 8 },
    tlSectionLbl: { fontSize: 11, color: '#64748b', fontWeight: '600' },
    tlSectionVal: { fontSize: 13, fontWeight: '700', color: '#1e293b', marginTop: 2 },
    tlSectionSub: { fontSize: 12, color: '#475569', marginTop: 2 },
    tlVitalsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    vitalPill: { backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: '600' },
    medRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' },
    medName: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
    medSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
    medFreq: { fontSize: 12, fontWeight: '700', color: '#3b82f6' },
    medDur: { fontSize: 11, color: '#64748b' },
    vitalsForm: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    vitalsField: { width: '48%' },
    vLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', marginBottom: 4 },
    vInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, backgroundColor: '#ffffff' },
    bmiDisplay: { marginTop: 8, fontSize: 12, fontWeight: '700', color: '#059669' },
    btnSaveVitals: { backgroundColor: '#3b82f6', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 12 },
    btnSaveVitalsText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
    vitalLogRow: { paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f1f5f9' },
    vitalLogDate: { fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
    invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' },
    invDate: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    invMethod: { fontSize: 11, color: '#64748b' },
    invAmount: { fontSize: 14, fontWeight: '800', color: '#10b981' }
});
