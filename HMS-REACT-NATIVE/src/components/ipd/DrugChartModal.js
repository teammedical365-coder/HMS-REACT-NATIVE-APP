import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ipdClinicalAPI, userAPI } from '../../utils/api';
import { useAuth } from '../../store/hooks';
import { useBranding } from '../../context/BrandingContext';

const TIME_SLOTS = ['06 AM', '10 AM', '02 PM', '10 PM'];

const DrugChartModal = ({
    visible,
    onClose,
    admissionId,
    patient,
    admission
}) => {
    const { user } = useAuth();
    const { branding } = useBranding();

    const [activePage, setActivePage] = useState(1); // 1 = Stat & IV Fluids, 2 = 7-Day MAR Grid
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);

    // Drug Chart Data
    const [chartData, setChartData] = useState(null);
    const [marRecords, setMarRecords] = useState([]);
    const [orders, setOrders] = useState([]);
    const [nurseList, setNurseList] = useState([]);

    // Allergy Banner State
    const [slot1, setSlot1] = useState('');
    const [slot2, setSlot2] = useState('');
    const [savingAllergy, setSavingAllergy] = useState(false);

    // Modals
    const [statModalOpen, setStatModalOpen] = useState(false);
    const [statForm, setStatForm] = useState({ drugName: '', dose: '', route: 'IV' });
    const [adminStatModalOpen, setAdminStatModalOpen] = useState(false);
    const [selectedStatId, setSelectedStatId] = useState(null);
    const [secondNurseId, setSecondNurseId] = useState('');
    const [statRemarks, setStatRemarks] = useState('');

    const [ivModalOpen, setIvModalOpen] = useState(false);
    const [ivForm, setIvForm] = useState({ fluidName: '', volume: '500 ml', infusionTimeHrs: '4 hrs' });

    const [marActionModal, setMarActionModal] = useState({ open: false, order: null, dateKey: '', slot: '', status: 'ADMINISTERED', reason: '' });

    const loadData = useCallback(async () => {
        if (!admissionId) return;
        setLoading(true);
        try {
            const [chartRes, marRes, ordRes] = await Promise.all([
                ipdClinicalAPI.getDrugChart(admissionId).catch(() => ({ chart: null })),
                ipdClinicalAPI.getMARRecords(admissionId).catch(() => ({ marRecords: [] })),
                ipdClinicalAPI.getActiveOrders(admissionId).catch(() => ({ orders: [] }))
            ]);

            const c = chartRes?.chart || {};
            setChartData(c);
            setSlot1(c.drugAllergies?.slot1 || '');
            setSlot2(c.drugAllergies?.slot2 || '');
            setMarRecords(marRes?.marRecords || marRes?.data || []);
            setOrders(ordRes?.orders || ordRes?.data || []);

            // Load staff list for dual sign-off
            const usersRes = await userAPI.getUsers().catch(() => ({ users: [] }));
            const nurses = (usersRes?.users || []).filter(u =>
                (u.role || '').toLowerCase().includes('nurse') && String(u._id) !== String(user?._id || user?.userId)
            );
            setNurseList(nurses);
        } catch (err) {
            console.error('Error loading drug chart:', err);
            Alert.alert('Error', 'Unable to load drug chart records.');
        } finally {
            setLoading(false);
        }
    }, [admissionId, user]);

    useEffect(() => {
        if (visible) {
            loadData();
        }
    }, [visible, loadData]);

    const handleSaveAllergies = async () => {
        setSavingAllergy(true);
        try {
            await ipdClinicalAPI.saveDrugChartAllergies(admissionId, { slot1, slot2 });
            Alert.alert('Success', 'Drug allergies updated.');
        } catch (err) {
            Alert.alert('Error', 'Failed to save drug allergies.');
        } finally {
            setSavingAllergy(false);
        }
    };

    const handleAddStatDose = async () => {
        if (!statForm.drugName.trim()) {
            Alert.alert('Validation', 'Drug name is required.');
            return;
        }
        try {
            await ipdClinicalAPI.addDrugChartStatDose(admissionId, {
                drugName: statForm.drugName.trim(),
                dose: statForm.dose.trim(),
                route: statForm.route || 'IV',
                date: new Date().toLocaleDateString('en-GB'),
                time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
            });
            setStatModalOpen(false);
            setStatForm({ drugName: '', dose: '', route: 'IV' });
            loadData();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to prescribe STAT dose.');
        }
    };

    const handleAdministerStat = async () => {
        if (!selectedStatId) return;
        try {
            await ipdClinicalAPI.updateDrugChartStatDose(admissionId, selectedStatId, {
                status: 'ADMINISTERED',
                checkedById: secondNurseId || null,
                remarks: statRemarks.trim()
            });
            setAdminStatModalOpen(false);
            setSelectedStatId(null);
            setStatRemarks('');
            loadData();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to administer STAT dose.');
        }
    };

    const handleAddIVFluid = async () => {
        if (!ivForm.fluidName.trim()) {
            Alert.alert('Validation', 'Fluid name is required.');
            return;
        }
        try {
            await ipdClinicalAPI.addDrugChartIVFluid(admissionId, {
                fluidName: ivForm.fluidName.trim(),
                volume: ivForm.volume.trim(),
                timeStart: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
                infusionTimeHrs: ivForm.infusionTimeHrs.trim(),
                date: new Date().toLocaleDateString('en-GB')
            });
            setIvModalOpen(false);
            setIvForm({ fluidName: '', volume: '500 ml', infusionTimeHrs: '4 hrs' });
            loadData();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to add IV fluid.');
        }
    };

    const handleStopIVFluid = async (entryId) => {
        try {
            await ipdClinicalAPI.updateDrugChartIVFluid(admissionId, entryId, { status: 'COMPLETED' });
            loadData();
        } catch (err) {
            Alert.alert('Error', 'Failed to complete IV fluid infusion.');
        }
    };

    // 7 Date Windows for MAR Grid (Today and previous 6 days)
    const dateWindows = useMemo(() => {
        const days = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
            const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            days.push({ key, label });
        }
        return days;
    }, []);

    const getMarCell = (orderId, dateKey, slot) => {
        const rec = marRecords.find(m => {
            const mDate = m.scheduledDateKey || (m.scheduledTime ? m.scheduledTime.slice(0, 10) : '');
            return String(m.orderId?._id || m.orderId) === String(orderId) &&
                mDate === dateKey &&
                (m.scheduledSlot === slot || !m.scheduledSlot);
        });
        return rec;
    };

    const handleCellPress = (order, dateKey, slot, existingRec) => {
        setMarActionModal({
            open: true,
            order,
            dateKey,
            slot,
            status: existingRec?.status || 'ADMINISTERED',
            reason: existingRec?.reason || ''
        });
    };

    const handleSaveMarAction = async () => {
        const { order, dateKey, slot, status, reason } = marActionModal;
        try {
            await ipdClinicalAPI.administerDrugChartMAR(admissionId, {
                orderId: order._id,
                scheduledDateKey: dateKey,
                scheduledSlot: slot,
                status,
                reason
            });
            setMarActionModal({ open: false, order: null, dateKey: '', slot: '', status: 'ADMINISTERED', reason: '' });
            loadData();
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.message || 'Failed to update MAR.');
        }
    };

    const handlePrintOrPdf = async () => {
        setDownloading(true);
        try {
            const hospitalName = branding?.customHospitalName || branding?.hospitalName || 'Medical 365 Super Speciality Hospital';
            const patientName = patient?.name || admission?.patientId?.name || 'Inpatient';
            const uhid = patient?.uhid || patient?.patientId || '—';
            const ipdNo = admission?.ipdNumber || admission?.admissionId || '—';

            const statRowsHtml = (chartData?.statDoses || []).map(s => `
                <tr>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${s.date} ${s.time}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: bold;">${s.drugName}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${s.dose}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${s.route}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1;">${s.doctorName || 'Dr. Attending'}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; color: ${s.status === 'ADMINISTERED' ? '#0f766e' : '#b91c1c'}; font-weight: bold;">${s.status}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1;">${s.givenByName || '—'}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1;">${s.checkedByName || '—'}</td>
                </tr>
            `).join('');

            const ivRowsHtml = (chartData?.ivFluids || []).map(f => `
                <tr>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${f.date}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; font-weight: bold;">${f.fluidName}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${f.volume}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${f.timeStart}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${f.infusionTimeHrs}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${f.status}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1;">${f.adminByName || 'Nurse'}</td>
                </tr>
            `).join('');

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>IPD Drug Chart (NABH MOM.3)</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 15px; color: #0f172a; font-size: 11px; }
                        .hdr { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 6px; margin-bottom: 8px; }
                        .hosp-title { font-size: 18px; font-weight: 800; color: #0f172a; }
                        .chart-name { font-size: 13px; font-weight: 700; color: #0d9488; }
                        .allergy-banner { background: #fee2e2; border: 2px solid #ef4444; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; color: #991b1b; font-weight: bold; }
                        table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 14px; }
                        th { background: #0d9488; color: #ffffff; padding: 5px; border: 1px solid #0f766e; text-align: center; }
                        .sec-title { font-size: 12px; font-weight: 700; color: #0f172a; margin: 10px 0 4px 0; }
                    </style>
                </head>
                <body>
                    <div class="hdr">
                        <div class="hosp-title">${hospitalName}</div>
                        <div class="chart-name">IPD DRUG CHART &amp; MEDICATION RECORD — NABH MOM.3</div>
                    </div>
                    <div class="allergy-banner">
                        âš ï¸  KNOWN DRUG ALLERGIES: ${slot1 || slot2 ? `${slot1} ${slot2}`.trim() : 'NO KNOWN DRUG ALLERGIES (NKDA)'}
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 10.5px; background: #f8fafc; padding: 6px 10px; border: 1px solid #e2e8f0; margin-bottom: 10px;">
                        <span><strong>Patient:</strong> ${patientName}</span>
                        <span><strong>UHID:</strong> ${uhid}</span>
                        <span><strong>IPD No:</strong> ${ipdNo}</span>
                        <span><strong>Printed:</strong> ${new Date().toLocaleDateString('en-GB')}</span>
                    </div>

                    <div class="sec-title">1. STAT / ONCE-ONLY DOSES (DUAL SIGN-OFF AUDIT)</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Date/Time</th>
                                <th>Drug Name</th>
                                <th>Dose</th>
                                <th>Route</th>
                                <th>Doctor</th>
                                <th>Status</th>
                                <th>Given By</th>
                                <th>Checked By (2nd Nurse)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${statRowsHtml || '<tr><td colspan="8" style="text-align: center; padding: 10px;">No STAT doses recorded</td></tr>'}
                        </tbody>
                    </table>

                    <div class="sec-title">2. INTRAVENOUS (IV) FLUIDS RECORD</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Fluid Name</th>
                                <th>Volume</th>
                                <th>Start Time</th>
                                <th>Infusion Duration</th>
                                <th>Status</th>
                                <th>Administered By</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ivRowsHtml || '<tr><td colspan="7" style="text-align: center; padding: 10px;">No IV fluids recorded</td></tr>'}
                        </tbody>
                    </table>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Alert.alert('Success', 'PDF generated successfully.');
            }
        } catch (err) {
            console.error('PDF error:', err);
            Alert.alert('Error', 'Failed to generate PDF.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.modalBox}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>IPD 2-Page Drug Chart &amp; MAR Grid</Text>
                            <Text style={styles.subtitle}>
                                Patient: {patient?.name || admission?.patientId?.name || 'Inpatient'} | IPD #{admission?.ipdNumber || '—'}
                            </Text>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity style={styles.pdfBtn} onPress={handlePrintOrPdf} disabled={downloading}>
                                {downloading ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <>
                                        <Feather name="printer" size={13} color="#ffffff" />
                                        <Text style={styles.pdfBtnText}>Print / PDF</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Feather name="x" size={20} color="#475569" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Prominent Drug Allergy Warning Banner */}
                    <View style={styles.allergyBanner}>
                        <View style={styles.allergyLeft}>
                            <Feather name="alert-triangle" size={16} color="#b91c1c" />
                            <Text style={styles.allergyTitle}>KNOWN DRUG ALLERGIES:</Text>
                        </View>
                        <TextInput
                            style={styles.allergyInput}
                            placeholder="Type allergies (or NKDA)"
                            placeholderTextColor="#f87171"
                            value={slot1}
                            onChangeText={setSlot1}
                            onBlur={handleSaveAllergies}
                        />
                        {savingAllergy && <ActivityIndicator size="small" color="#b91c1c" />}
                    </View>

                    {/* Page Tab Selector */}
                    <View style={styles.tabBar}>
                        <TouchableOpacity
                            style={[styles.tabItem, activePage === 1 && styles.tabItemActive]}
                            onPress={() => setActivePage(1)}
                        >
                            <Text style={[styles.tabText, activePage === 1 && styles.tabTextActive]}>
                                Page 1: STAT Doses &amp; IV Fluids
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabItem, activePage === 2 && styles.tabItemActive]}
                            onPress={() => setActivePage(2)}
                        >
                            <Text style={[styles.tabText, activePage === 2 && styles.tabTextActive]}>
                                Page 2: 7-Day MAR Grid
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Body */}
                    {loading ? (
                        <View style={styles.centerLoading}>
                            <ActivityIndicator size="large" color="#0d9488" />
                            <Text style={styles.loadingText}>Loading drug chart...</Text>
                        </View>
                    ) : activePage === 1 ? (
                        <ScrollView style={styles.pageBody} contentContainerStyle={styles.scrollContent}>
                            {/* STAT Doses Section */}
                            <View style={styles.sectionCard}>
                                <View style={styles.sectionHdrRow}>
                                    <View>
                                        <Text style={styles.sectionTitle}>STAT / Once-Only Doses</Text>
                                        <Text style={styles.sectionSub}>Dual-nurse verification enforced for administration</Text>
                                    </View>
                                    <TouchableOpacity style={styles.addBtn} onPress={() => setStatModalOpen(true)}>
                                        <Feather name="plus" size={13} color="#ffffff" />
                                        <Text style={styles.addBtnText}>Prescribe STAT</Text>
                                    </TouchableOpacity>
                                </View>

                                {(chartData?.statDoses || []).length === 0 ? (
                                    <Text style={styles.emptyNotice}>No STAT doses prescribed.</Text>
                                ) : (
                                    (chartData?.statDoses || []).map(s => (
                                        <View key={s._id} style={styles.statCard}>
                                            <View style={styles.statTopRow}>
                                                <Text style={styles.statDrugName}>{s.drugName} ({s.dose} - {s.route})</Text>
                                                <View style={[styles.statusBadge, s.status === 'ADMINISTERED' ? styles.badgeSuccess : styles.badgePending]}>
                                                    <Text style={[styles.statusBadgeText, s.status === 'ADMINISTERED' ? styles.textSuccess : styles.textPending]}>
                                                        {s.status}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={styles.statMeta}>
                                                Prescribed on {s.date} {s.time} by {s.doctorName || 'Doctor'}
                                            </Text>
                                            {s.status === 'ADMINISTERED' ? (
                                                <View style={styles.statAuditBox}>
                                                    <Text style={styles.auditText}>Given by: {s.givenByName || 'Nurse'}</Text>
                                                    <Text style={styles.auditText}>Checked by (2nd Nurse): {s.checkedByName || 'Verified'}</Text>
                                                    {s.remarks ? <Text style={styles.auditText}>Remarks: {s.remarks}</Text> : null}
                                                </View>
                                            ) : (
                                                <TouchableOpacity
                                                    style={styles.administerActionBtn}
                                                    onPress={() => {
                                                        setSelectedStatId(s._id);
                                                        setAdminStatModalOpen(true);
                                                    }}
                                                >
                                                    <Feather name="check-circle" size={13} color="#ffffff" />
                                                    <Text style={styles.administerActionBtnText}>Administer &amp; Dual Verify</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))
                                )}
                            </View>

                            {/* IV Fluids Section */}
                            <View style={styles.sectionCard}>
                                <View style={styles.sectionHdrRow}>
                                    <View>
                                        <Text style={styles.sectionTitle}>Intravenous (IV) Fluids</Text>
                                        <Text style={styles.sectionSub}>Continuous infusion tracker &amp; completion</Text>
                                    </View>
                                    <TouchableOpacity style={styles.addBtn} onPress={() => setIvModalOpen(true)}>
                                        <Feather name="plus" size={13} color="#ffffff" />
                                        <Text style={styles.addBtnText}>Add IV Fluid</Text>
                                    </TouchableOpacity>
                                </View>

                                {(chartData?.ivFluids || []).length === 0 ? (
                                    <Text style={styles.emptyNotice}>No IV fluids prescribed.</Text>
                                ) : (
                                    (chartData?.ivFluids || []).map(f => (
                                        <View key={f._id} style={styles.statCard}>
                                            <View style={styles.statTopRow}>
                                                <Text style={styles.statDrugName}>{f.fluidName} ({f.volume})</Text>
                                                <View style={[styles.statusBadge, f.status === 'COMPLETED' ? styles.badgeSuccess : styles.badgeRunning]}>
                                                    <Text style={[styles.statusBadgeText, f.status === 'COMPLETED' ? styles.textSuccess : styles.textRunning]}>
                                                        {f.status}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={styles.statMeta}>
                                                Started at {f.timeStart} on {f.date} | Infusion time: {f.infusionTimeHrs}
                                            </Text>
                                            {f.status !== 'COMPLETED' && (
                                                <TouchableOpacity style={styles.stopActionBtn} onPress={() => handleStopIVFluid(f._id)}>
                                                    <Feather name="stop-circle" size={13} color="#ffffff" />
                                                    <Text style={styles.administerActionBtnText}>Mark Infusion Complete</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))
                                )}
                            </View>
                        </ScrollView>
                    ) : (
                        /* Page 2: 7-Day MAR Grid */
                        <ScrollView horizontal style={styles.gridHorizontal}>
                            <ScrollView style={styles.gridVertical}>
                                <View style={styles.marTable}>
                                    {/* Table Header: Dates and Slots */}
                                    <View style={styles.marHeaderRow}>
                                        <View style={[styles.marThMed, { width: 180 }]}>
                                            <Text style={styles.marThText}>Medication &amp; Dosage</Text>
                                        </View>
                                        {dateWindows.map(d => (
                                            <View key={d.key} style={styles.marDateBlock}>
                                                <Text style={styles.marDateHeader}>{d.label}</Text>
                                                <View style={styles.marSlotSubRow}>
                                                    {TIME_SLOTS.map(s => (
                                                        <Text key={s} style={styles.marSlotSubText}>{s.replace(' ', '')}</Text>
                                                    ))}
                                                </View>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Medication Rows */}
                                    {orders.length === 0 ? (
                                        <View style={styles.emptyGrid}>
                                            <Text style={styles.emptyGridText}>No active medication orders found.</Text>
                                        </View>
                                    ) : (
                                        orders.map((ord, idx) => (
                                            <View key={ord._id || idx} style={[styles.marRow, idx % 2 === 1 && styles.marRowAlt]}>
                                                <View style={[styles.marTdMed, { width: 180 }]}>
                                                    <Text style={styles.marMedName}>{ord.medicineName}</Text>
                                                    <Text style={styles.marMedDose}>
                                                        {ord.dosageValue || ''} {ord.dosageUnit || ''} • {ord.route || 'Oral'}
                                                    </Text>
                                                    <Text style={styles.marMedFreq}>{ord.frequency || 'OD'}</Text>
                                                </View>

                                                {dateWindows.map(d => (
                                                    <View key={d.key} style={styles.marDateBlock}>
                                                        <View style={styles.marSlotCellsRow}>
                                                            {TIME_SLOTS.map(slot => {
                                                                const cell = getMarCell(ord._id, d.key, slot);
                                                                const isGiven = cell?.status === 'ADMINISTERED';
                                                                const isRefused = cell?.status === 'REFUSED';
                                                                const isHeld = cell?.status === 'HELD';

                                                                return (
                                                                    <TouchableOpacity
                                                                        key={slot}
                                                                        style={[
                                                                            styles.marCell,
                                                                            isGiven && styles.marCellGiven,
                                                                            isRefused && styles.marCellRefused,
                                                                            isHeld && styles.marCellHeld
                                                                        ]}
                                                                        onPress={() => handleCellPress(ord, d.key, slot, cell)}
                                                                    >
                                                                        <Text style={[styles.marCellText, isGiven && styles.marCellTextGiven]}>
                                                                            {isGiven ? 'G' : isRefused ? 'R' : isHeld ? 'H' : '—'}
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                );
                                                            })}
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        ))
                                    )}
                                </View>
                            </ScrollView>
                        </ScrollView>
                    )}

                    {/* Prescribe STAT Modal */}
                    <Modal visible={statModalOpen} transparent animationType="fade">
                        <View style={styles.subModalOverlay}>
                            <View style={styles.subModalBox}>
                                <Text style={styles.subModalTitle}>Prescribe STAT Dose</Text>
                                <TextInput
                                    style={styles.subInput}
                                    placeholder="Drug Name (e.g. Paracetamol IV)"
                                    value={statForm.drugName}
                                    onChangeText={v => setStatForm(p => ({ ...p, drugName: v }))}
                                />
                                <TextInput
                                    style={styles.subInput}
                                    placeholder="Dose (e.g. 1g / 100ml)"
                                    value={statForm.dose}
                                    onChangeText={v => setStatForm(p => ({ ...p, dose: v }))}
                                />
                                <TextInput
                                    style={styles.subInput}
                                    placeholder="Route (e.g. IV, IM, SC)"
                                    value={statForm.route}
                                    onChangeText={v => setStatForm(p => ({ ...p, route: v }))}
                                />
                                <View style={styles.subModalActions}>
                                    <TouchableOpacity style={styles.subCancel} onPress={() => setStatModalOpen(false)}>
                                        <Text style={styles.subCancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subSubmit} onPress={handleAddStatDose}>
                                        <Text style={styles.subSubmitText}>Prescribe</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>

                    {/* Dual Nurse Administration Modal */}
                    <Modal visible={adminStatModalOpen} transparent animationType="fade">
                        <View style={styles.subModalOverlay}>
                            <View style={styles.subModalBox}>
                                <Text style={styles.subModalTitle}>Dual-Nurse Administration Verification</Text>
                                <Text style={styles.subModalNotice}>
                                    Administering Nurse: {user?.name || 'Current Nurse'}
                                </Text>
                                <Text style={styles.subModalLabel}>Second Nurse Verification (NABH Mandatory):</Text>
                                <View style={styles.nursePickerContainer}>
                                    {nurseList.slice(0, 4).map(n => (
                                        <TouchableOpacity
                                            key={n._id}
                                            style={[styles.nurseChip, secondNurseId === n._id && styles.nurseChipActive]}
                                            onPress={() => setSecondNurseId(n._id)}
                                        >
                                            <Text style={[styles.nurseChipText, secondNurseId === n._id && styles.nurseChipTextActive]}>
                                                {n.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <TextInput
                                    style={styles.subInput}
                                    placeholder="Remarks / Observation"
                                    value={statRemarks}
                                    onChangeText={setStatRemarks}
                                />
                                <View style={styles.subModalActions}>
                                    <TouchableOpacity style={styles.subCancel} onPress={() => setAdminStatModalOpen(false)}>
                                        <Text style={styles.subCancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subSubmit} onPress={handleAdministerStat}>
                                        <Text style={styles.subSubmitText}>Confirm &amp; Sign-off</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>

                    {/* Add IV Fluid Modal */}
                    <Modal visible={ivModalOpen} transparent animationType="fade">
                        <View style={styles.subModalOverlay}>
                            <View style={styles.subModalBox}>
                                <Text style={styles.subModalTitle}>Start IV Fluid Infusion</Text>
                                <TextInput
                                    style={styles.subInput}
                                    placeholder="Fluid Name (e.g. Normal Saline 0.9%)"
                                    value={ivForm.fluidName}
                                    onChangeText={v => setIvForm(p => ({ ...p, fluidName: v }))}
                                />
                                <TextInput
                                    style={styles.subInput}
                                    placeholder="Volume (e.g. 500 ml)"
                                    value={ivForm.volume}
                                    onChangeText={v => setIvForm(p => ({ ...p, volume: v }))}
                                />
                                <TextInput
                                    style={styles.subInput}
                                    placeholder="Infusion Time (e.g. 4 hrs)"
                                    value={ivForm.infusionTimeHrs}
                                    onChangeText={v => setIvForm(p => ({ ...p, infusionTimeHrs: v }))}
                                />
                                <View style={styles.subModalActions}>
                                    <TouchableOpacity style={styles.subCancel} onPress={() => setIvModalOpen(false)}>
                                        <Text style={styles.subCancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subSubmit} onPress={handleAddIVFluid}>
                                        <Text style={styles.subSubmitText}>Start Infusion</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>

                    {/* MAR Action Modal */}
                    <Modal visible={marActionModal.open} transparent animationType="fade">
                        <View style={styles.subModalOverlay}>
                            <View style={styles.subModalBox}>
                                <Text style={styles.subModalTitle}>Record MAR Administration</Text>
                                <Text style={styles.subModalNotice}>
                                    {marActionModal.order?.medicineName} | {marActionModal.dateKey} ({marActionModal.slot})
                                </Text>
                                <View style={styles.marStatusRow}>
                                    {['ADMINISTERED', 'REFUSED', 'HELD'].map(st => (
                                        <TouchableOpacity
                                            key={st}
                                            style={[styles.statusOption, marActionModal.status === st && styles.statusOptionActive]}
                                            onPress={() => setMarActionModal(p => ({ ...p, status: st }))}
                                        >
                                            <Text style={[styles.statusOptionText, marActionModal.status === st && styles.statusOptionTextActive]}>
                                                {st === 'ADMINISTERED' ? 'Given (G)' : st === 'REFUSED' ? 'Refused (R)' : 'Held (H)'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <TextInput
                                    style={styles.subInput}
                                    placeholder="Reason / Notes (required if refused or held)"
                                    value={marActionModal.reason}
                                    onChangeText={v => setMarActionModal(p => ({ ...p, reason: v }))}
                                />
                                <View style={styles.subModalActions}>
                                    <TouchableOpacity style={styles.subCancel} onPress={() => setMarActionModal(p => ({ ...p, open: false }))}>
                                        <Text style={styles.subCancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.subSubmit} onPress={handleSaveMarAction}>
                                        <Text style={styles.subSubmitText}>Record</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        padding: 10,
    },
    modalBox: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        height: '92%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    pdfBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#0d9488',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    pdfBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#ffffff',
    },
    closeBtn: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: '#e2e8f0',
    },
    allergyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fee2e2',
        borderBottomWidth: 2,
        borderBottomColor: '#ef4444',
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 8,
    },
    allergyLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    allergyTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#991b1b',
    },
    allergyInput: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#f87171',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        fontSize: 12,
        color: '#991b1b',
        fontWeight: '600',
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#ffffff',
    },
    tabItem: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabItemActive: {
        borderBottomColor: '#0d9488',
    },
    tabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    tabTextActive: {
        color: '#0d9488',
        fontWeight: '700',
    },
    centerLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 8,
        fontSize: 13,
        color: '#64748b',
    },
    pageBody: {
        flex: 1,
    },
    scrollContent: {
        padding: 14,
        paddingBottom: 24,
    },
    sectionCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        marginBottom: 14,
    },
    sectionHdrRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    sectionSub: {
        fontSize: 11,
        color: '#64748b',
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#0d9488',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
    },
    addBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#ffffff',
    },
    emptyNotice: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        paddingVertical: 16,
    },
    statCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 10,
        marginBottom: 8,
    },
    statTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statDrugName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeSuccess: { backgroundColor: '#ccfbf1' },
    badgePending: { backgroundColor: '#fef3c7' },
    badgeRunning: { backgroundColor: '#dbeafe' },
    statusBadgeText: { fontSize: 10, fontWeight: '700' },
    textSuccess: { color: '#0f766e' },
    textPending: { color: '#b45309' },
    textRunning: { color: '#1d4ed8' },
    statMeta: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 4,
    },
    statAuditBox: {
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    auditText: {
        fontSize: 11,
        color: '#0f766e',
        fontWeight: '500',
    },
    administerActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#0d9488',
        paddingVertical: 6,
        borderRadius: 6,
        marginTop: 8,
    },
    stopActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#475569',
        paddingVertical: 6,
        borderRadius: 6,
        marginTop: 8,
    },
    administerActionBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
    },
    gridHorizontal: { flex: 1 },
    gridVertical: { flex: 1 },
    marTable: { padding: 10 },
    marHeaderRow: {
        flexDirection: 'row',
        backgroundColor: '#0d9488',
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
    },
    marThMed: {
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    marThText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
    },
    marDateBlock: {
        width: 140,
        borderLeftWidth: 1,
        borderLeftColor: '#0f766e',
    },
    marDateHeader: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
        textAlign: 'center',
        paddingVertical: 4,
        backgroundColor: '#0f766e',
    },
    marSlotSubRow: {
        flexDirection: 'row',
        backgroundColor: '#14b8a6',
    },
    marSlotSubText: {
        flex: 1,
        fontSize: 9,
        fontWeight: '600',
        color: '#ffffff',
        textAlign: 'center',
        paddingVertical: 2,
    },
    marRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#ffffff',
    },
    marRowAlt: {
        backgroundColor: '#f8fafc',
    },
    marTdMed: {
        padding: 8,
        justifyContent: 'center',
    },
    marMedName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a',
    },
    marMedDose: {
        fontSize: 10,
        color: '#64748b',
    },
    marMedFreq: {
        fontSize: 10,
        fontWeight: '600',
        color: '#0d9488',
    },
    marSlotCellsRow: {
        flexDirection: 'row',
        height: '100%',
    },
    marCell: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderLeftWidth: 1,
        borderLeftColor: '#f1f5f9',
        minHeight: 48,
    },
    marCellGiven: { backgroundColor: '#ccfbf1' },
    marCellRefused: { backgroundColor: '#fee2e2' },
    marCellHeld: { backgroundColor: '#fef3c7' },
    marCellText: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
    marCellTextGiven: { color: '#0f766e', fontWeight: '800' },
    emptyGrid: {
        padding: 32,
        alignItems: 'center',
    },
    emptyGridText: {
        fontSize: 12,
        color: '#94a3b8',
    },
    subModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    subModalBox: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 18,
        width: '100%',
        maxWidth: 360,
    },
    subModalTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 8,
    },
    subModalNotice: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 10,
    },
    subModalLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 6,
    },
    nursePickerContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
    },
    nurseChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    nurseChipActive: {
        backgroundColor: '#0d9488',
        borderColor: '#0d9488',
    },
    nurseChipText: {
        fontSize: 11,
        color: '#475569',
    },
    nurseChipTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    marStatusRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 12,
    },
    statusOption: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    statusOptionActive: {
        backgroundColor: '#0d9488',
        borderColor: '#0d9488',
    },
    statusOptionText: {
        fontSize: 11,
        color: '#475569',
        fontWeight: '600',
    },
    statusOptionTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    subInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        padding: 10,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
        marginBottom: 10,
    },
    subModalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 6,
    },
    subCancel: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    subCancelText: {
        fontSize: 12,
        color: '#64748b',
    },
    subSubmit: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        backgroundColor: '#0d9488',
    },
    subSubmitText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
});

export default DrugChartModal;

