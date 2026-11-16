import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Dimensions
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Line, Circle, Polyline, Text as SvgText, Rect, G } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ipdClinicalAPI, intakeOutputAPI, hospitalAPI } from '../../utils/api';
import { useAuth } from '../../store/hooks';
import { useBranding } from '../../context/BrandingContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TPRChartModal = ({
    visible,
    onClose,
    admissionId,
    patient,
    admission
}) => {
    const { user } = useAuth();
    const { branding } = useBranding();

    const [vitalsList, setVitalsList] = useState([]);
    const [ioList, setIoList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [selectedTab, setSelectedTab] = useState('table'); // 'table' | 'trends'

    const loadData = useCallback(async () => {
        if (!admissionId) return;
        setLoading(true);
        try {
            const [vitalsRes, ioRes] = await Promise.all([
                ipdClinicalAPI.getVitalsHistory(admissionId).catch(() => ({ vitals: [] })),
                intakeOutputAPI.getHistory(admissionId).catch(() => ({ data: [] }))
            ]);
            setVitalsList(vitalsRes?.vitals || []);
            setIoList(ioRes?.data || ioRes?.records || []);
        } catch (err) {
            console.error('Error fetching TPR data:', err);
            Alert.alert('Error', 'Unable to load TPR chart records.');
        } finally {
            setLoading(false);
        }
    }, [admissionId]);

    useEffect(() => {
        if (visible) {
            loadData();
        }
    }, [visible, loadData]);

    // Merged chronological list
    const mergedRecords = useMemo(() => {
        const rows = [];
        vitalsList.forEach(v => {
            const dt = new Date(v.recordedAt || v.createdAt);
            const dateStr = dt.toLocaleDateString('en-GB');
            const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            const empName = v.recordedBy?.name || 'Staff';
            const empId = v.recordedBy?.employeeId || '';
            const bp = v.systolicBP && v.diastolicBP ? `${v.systolicBP}/${v.diastolicBP}` : (v.systolicBP || '—');

            rows.push({
                id: v._id,
                date: dateStr,
                time: timeStr,
                rawDate: dt,
                bp,
                temp: v.temperature ? `${v.temperature}°F` : '—',
                numTemp: v.temperature || 98.6,
                pulse: v.pulse ? String(v.pulse) : '—',
                numPulse: v.pulse || 72,
                rr: v.respiratoryRate ? String(v.respiratoryRate) : '—',
                numRR: v.respiratoryRate || 18,
                spo2: v.spo2 ? `${v.spo2}%` : '—',
                numSpO2: v.spo2 || 98,
                input: '—',
                output: '—',
                remark: v.criticalAlertReason || v.remark || v.notes || '—',
                isCritical: !!v.isCriticalAlert,
                emp: empId ? `${empName} (${empId})` : empName
            });
        });

        // Overlay intake / output
        ioList.forEach(io => {
            const dt = new Date(io.recordedAt || io.createdAt);
            const dateStr = dt.toLocaleDateString('en-GB');
            const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            const empName = io.recordedBy?.name || 'Staff';

            rows.push({
                id: io._id,
                date: dateStr,
                time: timeStr,
                rawDate: dt,
                bp: '—',
                temp: '—',
                pulse: '—',
                rr: '—',
                spo2: '—',
                input: io.intakeAmount ? `${io.intakeAmount} ml` : '—',
                output: io.outputAmount ? `${io.outputAmount} ml` : '—',
                remark: io.intakeType || io.outputType || 'I/O Entry',
                isCritical: false,
                emp: empName
            });
        });

        // Sort descending
        return rows.sort((a, b) => b.rawDate - a.rawDate);
    }, [vitalsList, ioList]);

    // Trend points (ascending chronological order)
    const trendData = useMemo(() => {
        return [...vitalsList]
            .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt))
            .slice(-12); // Last 12 readings for clean curve
    }, [vitalsList]);

    const handlePrintOrPdf = async () => {
        setDownloading(true);
        try {
            const hospitalName = branding?.customHospitalName || branding?.hospitalName || 'Medical 365 Super Speciality Hospital';
            const patientName = patient?.name || admission?.patientId?.name || 'Inpatient';
            const uhid = patient?.uhid || patient?.patientId || '—';
            const ipdNo = admission?.ipdNumber || admission?.admissionId || '—';
            const ward = admission?.ward || 'General';
            const bed = admission?.bedNumber || '—';

            const rowsHtml = mergedRecords.map(r => `
                <tr style="background: ${r.isCritical ? '#fef2f2' : '#ffffff'};">
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${r.date}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${r.time}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: ${r.isCritical ? 'bold' : 'normal'}; color: ${r.isCritical ? '#b91c1c' : '#000'}">${r.bp}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${r.temp}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${r.pulse}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${r.rr}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${r.input}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: center;">${r.output}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: left; color: ${r.isCritical ? '#b91c1c' : '#334155'}; font-size: 11px;">${r.remark}</td>
                    <td style="padding: 5px; border: 1px solid #cbd5e1; text-align: left; font-size: 11px;">${r.emp}</td>
                </tr>
            `).join('');

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>TPR & Vital Observation Chart</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 15px; color: #0f172a; }
                        .hdr { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 8px; margin-bottom: 12px; }
                        .hosp-title { font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
                        .chart-name { font-size: 14px; font-weight: 700; color: #0d9488; margin-top: 4px; }
                        .nabh-tag { font-size: 10px; color: #64748b; font-weight: 600; }
                        .pt-line { display: flex; justify-content: space-between; font-size: 11px; background: #f8fafc; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 12px; }
                        table { width: 100%; border-collapse: collapse; font-size: 11px; }
                        th { background: #0d9488; color: #ffffff; padding: 6px; border: 1px solid #0f766e; text-align: center; font-size: 10px; }
                    </style>
                </head>
                <body>
                    <div class="hdr">
                        <div class="hosp-title">${hospitalName}</div>
                        <div class="chart-name">TPR &amp; VITAL OBSERVATION CHART (NABH COMPLIANT)</div>
                        <div class="nabh-tag">Standard COP.1 / COP.4 Patient Clinical Observation Record</div>
                    </div>
                    <div class="pt-line">
                        <span><strong>Patient:</strong> ${patientName}</span>
                        <span><strong>UHID:</strong> ${uhid}</span>
                        <span><strong>IPD No:</strong> ${ipdNo}</span>
                        <span><strong>Ward/Bed:</strong> ${ward} / ${bed}</span>
                        <span><strong>Printed:</strong> ${new Date().toLocaleDateString('en-GB')}</span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 10%;">Date</th>
                                <th style="width: 8%;">Time</th>
                                <th style="width: 9%;">BP</th>
                                <th style="width: 9%;">Temp</th>
                                <th style="width: 9%;">Pulse</th>
                                <th style="width: 9%;">RR</th>
                                <th style="width: 9%;">Input</th>
                                <th style="width: 9%;">Output</th>
                                <th style="width: 18%;">Remark / Observations</th>
                                <th style="width: 10%;">Emp ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml || '<tr><td colspan="10" style="text-align: center; padding: 15px;">No vitals recorded</td></tr>'}
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

    // Render SVG Trend Graph
    const renderTrendGraph = () => {
        if (trendData.length < 2) {
            return (
                <View style={styles.emptyTrend}>
                    <Feather name="trending-up" size={32} color="#cbd5e1" />
                    <Text style={styles.emptyTrendText}>Need at least 2 vitals entries to plot visual trends.</Text>
                </View>
            );
        }

        const chartWidth = SCREEN_WIDTH - 48;
        const chartHeight = 160;
        const paddingLeft = 36;
        const paddingBottom = 24;
        const paddingTop = 12;
        const graphWidth = chartWidth - paddingLeft - 10;
        const graphHeight = chartHeight - paddingBottom - paddingTop;

        // Pulse scale: 40 - 140
        const minPulse = 40;
        const maxPulse = 140;
        const getPulseY = (val) => paddingTop + graphHeight - ((val - minPulse) / (maxPulse - minPulse)) * graphHeight;

        // Temp scale: 95 - 105
        const minTemp = 95;
        const maxTemp = 105;
        const getTempY = (val) => paddingTop + graphHeight - ((val - minTemp) / (maxTemp - minTemp)) * graphHeight;

        const pulsePoints = trendData.map((d, i) => {
            const x = paddingLeft + (i / (trendData.length - 1)) * graphWidth;
            const y = getPulseY(d.pulse || 72);
            return `${x},${y}`;
        }).join(' ');

        const tempPoints = trendData.map((d, i) => {
            const x = paddingLeft + (i / (trendData.length - 1)) * graphWidth;
            const y = getTempY(d.temperature || 98.6);
            return `${x},${y}`;
        }).join(' ');

        return (
            <View style={styles.trendContainer}>
                <View style={styles.trendHeader}>
                    <Text style={styles.trendTitle}>Vitals Trend Visualization (Last {trendData.length} Readings)</Text>
                    <View style={styles.legendRow}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                            <Text style={styles.legendText}>Pulse (bpm)</Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: '#0d9488' }]} />
                            <Text style={styles.legendText}>Temp (°F)</Text>
                        </View>
                    </View>
                </View>

                <Svg width={chartWidth} height={chartHeight}>
                    {/* Background Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                        const y = paddingTop + pct * graphHeight;
                        const pulseLabel = Math.round(maxPulse - pct * (maxPulse - minPulse));
                        return (
                            <G key={idx}>
                                <Line
                                    x1={paddingLeft}
                                    y1={y}
                                    x2={paddingLeft + graphWidth}
                                    y2={y}
                                    stroke="#e2e8f0"
                                    strokeWidth="1"
                                    strokeDasharray="4 4"
                                />
                                <SvgText
                                    x={paddingLeft - 4}
                                    y={y + 3}
                                    fill="#94a3b8"
                                    fontSize="9"
                                    textAnchor="end"
                                >
                                    {pulseLabel}
                                </SvgText>
                            </G>
                        );
                    })}

                    {/* Pulse Polyline (Red) */}
                    <Polyline
                        points={pulsePoints}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2.5"
                    />

                    {/* Temp Polyline (Teal) */}
                    <Polyline
                        points={tempPoints}
                        fill="none"
                        stroke="#0d9488"
                        strokeWidth="2"
                    />

                    {/* Data Points */}
                    {trendData.map((d, i) => {
                        const x = paddingLeft + (i / (trendData.length - 1)) * graphWidth;
                        const py = getPulseY(d.pulse || 72);
                        const ty = getTempY(d.temperature || 98.6);
                        return (
                            <G key={i}>
                                <Circle cx={x} cy={py} r="3.5" fill="#ef4444" />
                                <Circle cx={x} cy={ty} r="3" fill="#0d9488" />
                            </G>
                        );
                    })}
                </Svg>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.modalBox}>
                    {/* Modal Top Bar */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>TPR &amp; Vital Observation Chart</Text>
                            <Text style={styles.subtitle}>
                                Patient: {patient?.name || admission?.patientId?.name || 'Inpatient'} | IPD #{admission?.ipdNumber || '—'}
                            </Text>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity
                                style={styles.pdfBtn}
                                onPress={handlePrintOrPdf}
                                disabled={downloading}
                            >
                                {downloading ? (
                                    <ActivityIndicator size="small" color="#ffffff" />
                                ) : (
                                    <>
                                        <Feather name="printer" size={14} color="#ffffff" />
                                        <Text style={styles.pdfBtnText}>Print / PDF</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                <Feather name="x" size={20} color="#475569" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Segment Control */}
                    <View style={styles.tabBar}>
                        <TouchableOpacity
                            style={[styles.tabItem, selectedTab === 'table' && styles.tabItemActive]}
                            onPress={() => setSelectedTab('table')}
                        >
                            <Feather name="list" size={14} color={selectedTab === 'table' ? '#0d9488' : '#64748b'} />
                            <Text style={[styles.tabText, selectedTab === 'table' && styles.tabTextActive]}>
                                Observation Sheet ({mergedRecords.length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabItem, selectedTab === 'trends' && styles.tabItemActive]}
                            onPress={() => setSelectedTab('trends')}
                        >
                            <Feather name="trending-up" size={14} color={selectedTab === 'trends' ? '#0d9488' : '#64748b'} />
                            <Text style={[styles.tabText, selectedTab === 'trends' && styles.tabTextActive]}>
                                Trend Curves
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Body */}
                    {loading ? (
                        <View style={styles.centerLoading}>
                            <ActivityIndicator size="large" color="#0d9488" />
                            <Text style={styles.loadingText}>Loading TPR records...</Text>
                        </View>
                    ) : selectedTab === 'trends' ? (
                        <ScrollView contentContainerStyle={styles.scrollContent}>
                            {renderTrendGraph()}
                        </ScrollView>
                    ) : (
                        <ScrollView horizontal style={styles.horizontalScroll}>
                            <ScrollView style={styles.verticalScroll}>
                                <View style={styles.table}>
                                    <View style={styles.tableHeader}>
                                        <Text style={[styles.th, { width: 75 }]}>Date</Text>
                                        <Text style={[styles.th, { width: 65 }]}>Time</Text>
                                        <Text style={[styles.th, { width: 75 }]}>BP</Text>
                                        <Text style={[styles.th, { width: 65 }]}>Temp</Text>
                                        <Text style={[styles.th, { width: 55 }]}>Pulse</Text>
                                        <Text style={[styles.th, { width: 50 }]}>RR</Text>
                                        <Text style={[styles.th, { width: 60 }]}>SpO2</Text>
                                        <Text style={[styles.th, { width: 65 }]}>Input</Text>
                                        <Text style={[styles.th, { width: 65 }]}>Output</Text>
                                        <Text style={[styles.th, { width: 140, textAlign: 'left' }]}>Remarks</Text>
                                        <Text style={[styles.th, { width: 100, textAlign: 'left' }]}>Recorded By</Text>
                                    </View>

                                    {mergedRecords.length === 0 ? (
                                        <View style={styles.emptyTable}>
                                            <Text style={styles.emptyTableText}>No vitals or I/O recorded yet.</Text>
                                        </View>
                                    ) : (
                                        mergedRecords.map((r, idx) => (
                                            <View
                                                key={r.id || idx}
                                                style={[
                                                    styles.tableRow,
                                                    idx % 2 === 1 && styles.tableRowAlt,
                                                    r.isCritical && styles.tableRowCritical
                                                ]}
                                            >
                                                <Text style={[styles.td, { width: 75 }]}>{r.date}</Text>
                                                <Text style={[styles.td, { width: 65 }]}>{r.time}</Text>
                                                <Text style={[styles.td, { width: 75, fontWeight: r.isCritical ? '700' : '500', color: r.isCritical ? '#b91c1c' : '#1e293b' }]}>
                                                    {r.bp}
                                                </Text>
                                                <Text style={[styles.td, { width: 65 }]}>{r.temp}</Text>
                                                <Text style={[styles.td, { width: 55 }]}>{r.pulse}</Text>
                                                <Text style={[styles.td, { width: 50 }]}>{r.rr}</Text>
                                                <Text style={[styles.td, { width: 60 }]}>{r.spo2}</Text>
                                                <Text style={[styles.td, { width: 65 }]}>{r.input}</Text>
                                                <Text style={[styles.td, { width: 65 }]}>{r.output}</Text>
                                                <Text style={[styles.td, { width: 140, textAlign: 'left', color: r.isCritical ? '#b91c1c' : '#475569' }]} numberOfLines={2}>
                                                    {r.remark}
                                                </Text>
                                                <Text style={[styles.td, { width: 100, textAlign: 'left' }]} numberOfLines={1}>
                                                    {r.emp}
                                                </Text>
                                            </View>
                                        ))
                                    )}
                                </View>
                            </ScrollView>
                        </ScrollView>
                    )}
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
        padding: 12,
    },
    modalBox: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        height: '90%',
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
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#ffffff',
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabItemActive: {
        borderBottomColor: '#0d9488',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '500',
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
    scrollContent: {
        padding: 16,
    },
    trendContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
    },
    trendHeader: {
        marginBottom: 8,
    },
    trendTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    legendRow: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 4,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 11,
        color: '#64748b',
    },
    emptyTrend: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
    },
    emptyTrendText: {
        marginTop: 8,
        fontSize: 13,
        color: '#94a3b8',
    },
    horizontalScroll: {
        flex: 1,
    },
    verticalScroll: {
        flex: 1,
    },
    table: {
        minWidth: 800,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#0d9488',
        paddingVertical: 8,
        paddingHorizontal: 8,
    },
    th: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
        textAlign: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: '#ffffff',
    },
    tableRowAlt: {
        backgroundColor: '#f8fafc',
    },
    tableRowCritical: {
        backgroundColor: '#fef2f2',
    },
    td: {
        fontSize: 11,
        color: '#334155',
        textAlign: 'center',
    },
    emptyTable: {
        padding: 32,
        alignItems: 'center',
    },
    emptyTableText: {
        fontSize: 13,
        color: '#94a3b8',
    },
});

export default TPRChartModal;

