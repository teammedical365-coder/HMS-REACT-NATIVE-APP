import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal, Dimensions, Alert, Image, ActivityIndicator, Platform, Linking, FlatList, useWindowDimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { clinicAPI, uploadAPI, medicineAPI, baseURL } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from 'react-redux';
import { STORAGE_KEYS } from '../../utils/Constants';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import DatePickerInput from '../../components/common/DatePickerInput';
import DropdownSelect from '../../components/common/DropdownSelect';

const CustomSelectDropdown = ({ value, placeholder = 'Select...', options = [], onSelect, style, insideModal = false }) => {
    const formattedOptions = (options || []).map(opt => {
        if (typeof opt === 'string') return { label: opt, value: opt };
        if (opt && typeof opt === 'object') return { label: opt.label || opt.name || String(opt.value), value: opt.value !== undefined ? opt.value : opt.name };
        return { label: String(opt), value: String(opt) };
    });

    return (
        <View style={[{ width: '100%' }, style]}>
            <DropdownSelect
                options={formattedOptions}
                value={value}
                onChange={onSelect}
                placeholder={placeholder}
                insideModal={insideModal}
            />
        </View>
    );
};

const TableDropdown = ({ value, placeholder = 'Select...', options = [], onSelect }) => {
    const [open, setOpen] = useState(false);
    return (
        <View style={{ position: 'relative', zIndex: open ? 9999 : 1, width: '100%' }}>
            <TouchableOpacity
                onPress={() => setOpen(!open)}
                style={{
                    backgroundColor: '#fff',
                    borderWidth: 1,
                    borderColor: '#e2e8f0',
                    borderRadius: 5,
                    paddingHorizontal: 7,
                    paddingVertical: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 32,
                }}
            >
                <Text style={{ fontSize: 12, color: value ? '#1e293b' : '#94a3b8' }} numberOfLines={1}>
                    {value || placeholder}
                </Text>
                <Text style={{ fontSize: 9, color: '#64748b', marginLeft: 4 }}>▼</Text>
            </TouchableOpacity>
            {open && (
                <View
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        minWidth: 140,
                        backgroundColor: '#fff',
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        borderRadius: 6,
                        marginTop: 2,
                        maxHeight: 180,
                        zIndex: 10000,
                        elevation: 10,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 6,
                    }}
                >
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
                        {options.map((opt, i) => {
                            const isSelected = value === opt;
                            return (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => {
                                        onSelect(opt);
                                        setOpen(false);
                                    }}
                                    style={{
                                        paddingHorizontal: 10,
                                        paddingVertical: 7,
                                        borderBottomWidth: i < options.length - 1 ? 1 : 0,
                                        borderBottomColor: '#f1f5f9',
                                        backgroundColor: isSelected ? '#eff6ff' : '#fff',
                                    }}
                                >
                                    <Text style={{ fontSize: 12, color: isSelected ? '#2563eb' : '#334155', fontWeight: isSelected ? '700' : '400' }}>
                                        {opt}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};


const useResponsive = () => {
    const { width, height } = useWindowDimensions();
    return {
        width,
        height,
        isNarrow: width < 375, // 320, 360
        isMobile: width < 600, // 320..480
        isTablet: width >= 600 && width < 1024, // 600..900
        isDesktop: width >= 1024, // 1024..1440
    };
};

// ─── PDF & REPORT HELPERS ──────────────────────────────────────────────────────────────
const reportURL = (filename) => (filename || '').startsWith('http://') || (filename || '').startsWith('https://')
    ? filename
    : `${baseURL}/api/patients/reports/${encodeURIComponent(filename)}`;

const getClinicInfo = async () => {
    try {
        const h = JSON.parse(await AsyncStorage.getItem('hospitalContext') || 'null');
        const u = JSON.parse(await AsyncStorage.getItem('user') || '{}');
        return { hName: h?.name || u?.hospitalName || 'Clinic', hAddr: [h?.address, h?.city, h?.state].filter(Boolean).join(', '), hPhone: h?.phone || '', issuedBy: u?.name || 'Staff' };
    } catch { return { hName: 'Clinic', hAddr: '', hPhone: '', issuedBy: 'Staff' }; }
};

export const printRegistrationSlip = async (patient) => {
    try {
        const { hName, hAddr, hPhone, issuedBy } = await getClinicInfo();
        const html = `
            <html>
                <body style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; text-align: center;">
                    <h2>${hName}</h2>
                    <p style="color: #64748b; font-size: 12px; margin: 2px 0;">${hAddr || ''} ${hPhone ? `| Ph: ${hPhone}` : ''}</p>
                    <hr style="border: none; border-top: 2px solid #16a34a; margin: 12px 0;" />
                    <h3 style="color: #16a34a; margin: 8px 0;">PATIENT REGISTRATION SLIP</h3>
                    <div style="text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                        <p style="margin: 6px 0;"><strong>Patient Name:</strong> ${patient?.name || '-'}</p>
                        <p style="margin: 6px 0;"><strong>Patient ID / MRN:</strong> ${patient?.patientUid || patient?._id || 'N/A'}</p>
                        <p style="margin: 6px 0;"><strong>Phone:</strong> ${patient?.phone || '-'}</p>
                        <p style="margin: 6px 0;"><strong>Gender / Age:</strong> ${patient?.gender || '-'} / ${patient?.age || '-'} yrs</p>
                        <p style="margin: 6px 0;"><strong>Blood Group:</strong> ${patient?.bloodGroup || '-'}</p>
                        <p style="margin: 6px 0;"><strong>Address:</strong> ${patient?.address || '-'}</p>
                        <p style="margin: 6px 0;"><strong>Registered Date:</strong> ${new Date().toLocaleString('en-IN')}</p>
                    </div>
                    <p style="font-size: 11px; color: #94a3b8;">Issued by: ${issuedBy} | Welcome to ${hName}</p>
                </body>
            </html>
        `;
        await Print.printAsync({ html });
    } catch (e) {
        console.warn('Registration print error:', e);
    }
};

export const printTokenReceipt = async (patient, appointment) => {
    try {
        const { hName, hAddr, hPhone, issuedBy } = await getClinicInfo();
        const html = `
            <html>
                <body style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; text-align: center;">
                    <h2>${hName}</h2>
                    <p style="color: #64748b; font-size: 12px; margin: 2px 0;">${hAddr || ''} ${hPhone ? `| Ph: ${hPhone}` : ''}</p>
                    <hr style="border: none; border-top: 2px solid #2563eb; margin: 12px 0;" />
                    <h3 style="color: #2563eb; margin: 8px 0;">CONSULTATION TOKEN RECEIPT</h3>
                    <div style="margin: 16px auto; padding: 12px; border: 2px dashed #2563eb; border-radius: 8px; width: 140px;">
                        <span style="font-size: 12px; color: #2563eb; font-weight: bold;">TOKEN</span>
                        <h1 style="margin: 4px 0; color: #1d4ed8;">#${appointment?.tokenNumber || '-'}</h1>
                    </div>
                    <div style="text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
                        <p style="margin: 6px 0;"><strong>Patient:</strong> ${patient?.name || '-'} (${patient?.patientUid || '-'})</p>
                        <p style="margin: 6px 0;"><strong>Phone:</strong> ${patient?.phone || '-'}</p>
                        <p style="margin: 6px 0;"><strong>Service:</strong> ${appointment?.serviceName || 'General Consultation'}</p>
                        <p style="margin: 6px 0;"><strong>Date:</strong> ${new Date(appointment?.appointmentDate || Date.now()).toLocaleDateString('en-IN')}</p>
                        <p style="margin: 6px 0;"><strong>Consultation Fee:</strong> ₹${Number(appointment?.amount || 0).toLocaleString('en-IN')} (PAID)</p>
                    </div>
                    <p style="font-size: 11px; color: #94a3b8;">Issued by: ${issuedBy} | Thank you for choosing ${hName}</p>
                </body>
            </html>
        `;
        await Print.printAsync({ html });
    } catch (e) {
        console.warn('Token print error:', e);
    }
};

export const printPrescriptionSlip = async (consulting, rx, vitalsData) => {
    try {
        const { hName, hAddr, hPhone, issuedBy } = await getClinicInfo();
        const pt = consulting?.clinicPatientId || {};
        const medicinesHtml = (rx?.medicines || []).map((m, i) => `
            <tr>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${i + 1}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;"><strong>${m.name || m.medicineName || '-'}</strong></td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${m.dose || m.dosage || m.frequency || '-'}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${m.days || m.duration || '-'}</td>
            </tr>
        `).join('');

        const html = `
            <html>
                <body style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b;">
                    <div style="text-align: center;">
                        <h2>${hName}</h2>
                        <p style="color: #64748b; font-size: 12px; margin: 2px 0;">${hAddr || ''} ${hPhone ? `| Ph: ${hPhone}` : ''}</p>
                        <hr style="border: none; border-top: 2px solid #10b981; margin: 12px 0;" />
                        <h3 style="color: #059669; margin: 8px 0;">PRESCRIPTION SLIP</h3>
                    </div>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                        <p style="margin: 4px 0;"><strong>Patient:</strong> ${pt.name || '-'} | <strong>ID:</strong> ${pt.patientUid || pt._id || '-'}</p>
                        <p style="margin: 4px 0;"><strong>Gender:</strong> ${pt.gender || '-'} | <strong>Token:</strong> #${consulting?.tokenNumber || '-'} | <strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</p>
                        ${rx?.diagnosis ? `<p style="margin: 4px 0;"><strong>Diagnosis:</strong> ${rx.diagnosis}</p>` : ''}
                    </div>
                    ${medicinesHtml ? `
                        <h4 style="margin: 10px 0 6px;">Medicines Prescribed:</h4>
                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                            <thead>
                                <tr style="background: #e2e8f0;">
                                    <th style="border: 1px solid #cbd5e1; padding: 6px;">#</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px;">Medicine</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px;">Dose</th>
                                    <th style="border: 1px solid #cbd5e1; padding: 6px;">Duration</th>
                                </tr>
                            </thead>
                            <tbody>${medicinesHtml}</tbody>
                        </table>
                    ` : ''}
                    ${rx?.notes ? `<p style="margin-top: 14px;"><strong>Doctor Notes:</strong> ${rx.notes}</p>` : ''}
                    <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 20px 0 10px;" />
                    <p style="text-align: right; font-size: 12px; margin: 4px 0;"><strong>Doctor:</strong> Dr. ${issuedBy}</p>
                </body>
            </html>
        `;
        await Print.printAsync({ html });
    } catch (e) {
        console.warn('Prescription print error:', e);
    }
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
const todayStr = () => new Date().toISOString().split('T')[0];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

// ─── 1:1 Web Parity: Treatment Plan Invoice PDF (GAP 8) ────────────────────
export const downloadTreatmentPlanPDF = async (plan) => {
    try {
        const { hName, hAddr, hPhone, issuedBy } = await getClinicInfo();
        const pt = plan.clinicPatientId || {};
        const planIdShort = (plan._id || '').slice(-6).toUpperCase();
        const invoiceNo = `INV-${planIdShort}-${Date.now().toString(36).toUpperCase()}`;
        const startDate = plan.visits?.length > 0 ? new Date(plan.visits[0].scheduledDate).toLocaleDateString('en-IN') : '—';
        const pending = plan.pendingBalance ?? ((plan.totalAmount || 0) - (plan.totalPaid || 0));

        // Payment History
        const allPayments = [];
        (plan.visits || []).forEach(v => {
            if (v.paymentHistory && v.paymentHistory.length > 0) {
                v.paymentHistory.forEach(ph => {
                    allPayments.push({
                        visitNumber: v.visitNumber,
                        visitDate: v.scheduledDate,
                        amount: ph.amount,
                        date: ph.date,
                        method: ph.method,
                        upiRef: ph.upiRef
                    });
                });
            } else if (v.amountPaid > 0) {
                allPayments.push({
                    visitNumber: v.visitNumber,
                    visitDate: v.scheduledDate,
                    amount: v.amountPaid,
                    date: v.paidAt || v.completedAt || v.scheduledDate,
                    method: v.paymentMethod || 'Cash',
                    upiRef: v.upiRef || ''
                });
            }
        });
        allPayments.sort((a, b) => new Date(a.date) - new Date(b.date));

        let runningBalance = plan.totalAmount || 0;
        const paymentRowsHtml = allPayments.map(p => {
            const balBefore = runningBalance;
            runningBalance = Math.max(0, runningBalance - (p.amount || 0));
            return `
                <tr>
                    <td style="border: 1px solid #e2e8f0; padding: 6px;">Visit ${p.visitNumber}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 6px;">${new Date(p.visitDate).toLocaleDateString('en-IN')}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 6px;">${p.date ? new Date(p.date).toLocaleDateString('en-IN') : '—'}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 6px;">${p.method || 'Cash'}${p.upiRef ? ` (${p.upiRef})` : ''}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 6px; font-weight: bold; color: #16a34a;">₹${Number(p.amount || 0).toLocaleString('en-IN')}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 6px;">₹${balBefore.toLocaleString('en-IN')}</td>
                    <td style="border: 1px solid #e2e8f0; padding: 6px;">₹${runningBalance.toLocaleString('en-IN')}</td>
                </tr>
            `;
        }).join('');

        // Visits Rows
        const visitRowsHtml = (plan.visits || []).map((v, i) => `
            <tr>
                <td style="border: 1px solid #e2e8f0; padding: 6px; font-weight: bold; color: #0891b2;">${v.visitNumber || i + 1}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${new Date(v.scheduledDate).toLocaleDateString('en-IN')} ${v.scheduledTime ? `· ${v.scheduledTime}` : ''}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${v.procedure || '—'}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px; text-transform: uppercase; font-weight: bold; color: ${v.status === 'completed' ? '#16a34a' : v.status === 'missed' ? '#dc2626' : '#2563eb'};">${v.status || 'Scheduled'}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${v.amountPaid > 0 ? `₹${v.amountPaid.toLocaleString('en-IN')}` : '—'}</td>
            </tr>
        `).join('');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Treatment Plan Invoice - ${invoiceNo}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.4; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .h-name { font-size: 22px; font-weight: bold; margin: 0; color: #0f172a; }
                    .h-addr { font-size: 11px; color: #64748b; margin: 4px 0; }
                    .inv-title { font-size: 15px; font-weight: 800; color: #0891b2; margin-top: 10px; border-bottom: 2px solid #0891b2; padding-bottom: 6px; }
                    .meta-row { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-top: 8px; }
                    .info-grid { display: flex; gap: 20px; margin: 16px 0; font-size: 12px; }
                    .info-col { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
                    .info-title { font-weight: bold; color: #0f172a; margin-bottom: 6px; font-size: 13px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
                    .financial-box { display: flex; justify-content: space-around; background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 8px; padding: 12px; margin: 16px 0; text-align: center; }
                    .fin-label { font-size: 11px; color: #0891b2; font-weight: 600; }
                    .fin-val { font-size: 18px; font-weight: 800; margin-top: 2px; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
                    th { background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: left; font-weight: bold; color: #475569; }
                    td { border: 1px solid #e2e8f0; padding: 6px; }
                    .sec-title { font-size: 13px; font-weight: bold; color: #0f172a; margin-top: 18px; margin-bottom: 4px; }
                    .footer { margin-top: 30px; font-size: 10px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="h-name">${hName}</div>
                    <div class="h-addr">${hAddr} ${hPhone ? `| Ph: ${hPhone}` : ''}</div>
                    <div class="inv-title">TREATMENT PLAN INVOICE</div>
                    <div class="meta-row">
                        <div>Invoice #: <strong>${invoiceNo}</strong></div>
                        <div>Print Date: <strong>${new Date().toLocaleDateString('en-IN')}</strong></div>
                    </div>
                </div>

                <div class="info-grid">
                    <div class="info-col">
                        <div class="info-title">Patient Information</div>
                        <div><strong>Name:</strong> ${pt.name || '—'}</div>
                        <div><strong>Patient ID:</strong> ${pt.patientUid || pt._id || '—'}</div>
                        <div><strong>Phone:</strong> ${pt.phone || '—'}</div>
                        <div><strong>Gender / Age:</strong> ${pt.gender || '—'} / ${pt.age || '—'} yrs</div>
                    </div>
                    <div class="info-col">
                        <div class="info-title">Plan Overview</div>
                        <div><strong>Title:</strong> ${plan.title || '—'}</div>
                        <div><strong>Total Visits:</strong> ${plan.visits?.length || 0}</div>
                        <div><strong>Start Date:</strong> ${startDate}</div>
                        <div><strong>Status:</strong> <span style="text-transform: uppercase; font-weight: bold;">${plan.status || 'active'}</span></div>
                        ${plan.description ? `<div><strong>Notes:</strong> ${plan.description}</div>` : ''}
                    </div>
                </div>

                <div class="financial-box">
                    <div>
                        <div class="fin-label">TOTAL COST</div>
                        <div class="fin-val" style="color: #0891b2;">₹${Number(plan.totalAmount || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                        <div class="fin-label">TOTAL PAID</div>
                        <div class="fin-val" style="color: #16a34a;">₹${Number(plan.totalPaid || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                        <div class="fin-label">BALANCE DUE</div>
                        <div class="fin-val" style="color: ${pending > 0 ? '#dc2626' : '#16a34a'};">
                            ${pending > 0 ? `₹${pending.toLocaleString('en-IN')}` : 'Cleared ✓'}
                        </div>
                    </div>
                </div>

                <div class="sec-title">Payment History</div>
                ${allPayments.length > 0 ? `
                    <table>
                        <thead>
                            <tr style="background: #dcfce7;">
                                <th>Visit</th>
                                <th>Visit Date</th>
                                <th>Payment Date</th>
                                <th>Method</th>
                                <th>Amount</th>
                                <th>Bal. Before</th>
                                <th>Bal. After</th>
                            </tr>
                        </thead>
                        <tbody>${paymentRowsHtml}</tbody>
                    </table>
                ` : '<div style="font-size: 11px; color: #94a3b8; padding: 6px 0;">No payments recorded yet.</div>'}

                <div class="sec-title">Visit Schedule</div>
                <table>
                    <thead>
                        <tr style="background: #e0f2fe;">
                            <th>#</th>
                            <th>Date & Time</th>
                            <th>Procedure</th>
                            <th>Status</th>
                            <th>Paid This Visit</th>
                        </tr>
                    </thead>
                    <tbody>${visitRowsHtml}</tbody>
                </table>

                <div class="footer">
                    Issued by: ${issuedBy} • Official Treatment Plan Invoice • Computer generated at ${new Date().toLocaleString('en-IN')}
                </div>
            </body>
            </html>
        `;

        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } else {
            await Print.printAsync({ html });
        }
    } catch (e) {
        Alert.alert('Invoice Generation Error', e.message);
    }
};

// ─── 1:1 Web Parity: Patient Profile Summary PDF (GAP 9) ───────────────────
export const generatePatientProfilePDF = async (patient, historyAppointments = []) => {
    try {
        const { hName, hAddr, hPhone, issuedBy } = await getClinicInfo();
        const validAppts = filterValidVisits(historyAppointments);

        const apptRowsHtml = validAppts.map(a => `
            <tr>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${fmtDate(a.appointmentDate)}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px; font-weight: bold;">${a.tokenNumber ? `#${a.tokenNumber}` : a.appointmentTime || '—'}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${a.doctorName || 'Doctor'}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${a.diagnosis || '—'}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${a.doctorNotes || a.notes || '—'}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px; text-transform: uppercase;">${a.status || 'Completed'}</td>
            </tr>
        `).join('');

        const allMedicines = [];
        validAppts.forEach(a => {
            const medList = a.medicines || a.pharmacy || a.prescriptions || [];
            if (Array.isArray(medList) && medList.length > 0) {
                medList.forEach(m => {
                    allMedicines.push({
                        date: fmtDate(a.appointmentDate),
                        name: m.name || m.medicineName || '—',
                        dosage: m.dosage || m.dose || m.frequency || '—',
                        frequency: m.frequency || '—',
                        duration: m.duration || (m.days ? `${m.days} days` : '—'),
                        instructions: m.instructions || m.notes || '—'
                    });
                });
            }
        });

        const medRowsHtml = allMedicines.map((m, idx) => `
            <tr>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${idx + 1}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${m.date}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px; font-weight: bold; color: #059669;">${m.name}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${m.dosage}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${m.duration}</td>
                <td style="border: 1px solid #e2e8f0; padding: 6px;">${m.instructions}</td>
            </tr>
        `).join('');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Patient Profile Summary - ${patient?.name || 'Patient'}</title>
                <style>
                    body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.4; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .h-name { font-size: 22px; font-weight: bold; margin: 0; color: #0f172a; }
                    .h-addr { font-size: 11px; color: #64748b; margin: 4px 0; }
                    .doc-title { font-size: 16px; font-weight: 800; color: #6366f1; margin-top: 8px; border-bottom: 2px solid #6366f1; padding-bottom: 6px; }
                    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
                    .info-table td { padding: 8px 12px; border: 1px solid #e2e8f0; }
                    .info-table td.label { font-weight: bold; color: #475569; width: 30%; background: #f8fafc; }
                    table.data-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
                    table.data-table th { background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: left; font-weight: bold; color: #475569; }
                    table.data-table td { border: 1px solid #e2e8f0; padding: 6px; }
                    .sec-title { font-size: 13px; font-weight: bold; color: #0f172a; margin-top: 20px; margin-bottom: 4px; }
                    .footer { margin-top: 30px; font-size: 10px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="h-name">${hName}</div>
                    <div class="h-addr">${hAddr} ${hPhone ? `| Ph: ${hPhone}` : ''}</div>
                    <div class="doc-title">PATIENT PROFILE SUMMARY</div>
                    <div style="text-align: right; font-size: 11px; color: #64748b; margin-top: 4px;">
                        Date: <strong>${new Date().toLocaleDateString('en-IN')}</strong>
                    </div>
                </div>

                <table class="info-table">
                    <tr>
                        <td class="label">Patient Name:</td>
                        <td><strong>${patient?.name || '—'}</strong></td>
                        <td class="label">Patient ID (MRN):</td>
                        <td><strong>${patient?.patientUid || patient?._id || 'N/A'}</strong></td>
                    </tr>
                    <tr>
                        <td class="label">Phone:</td>
                        <td>${patient?.phone || '—'}</td>
                        <td class="label">Gender / DOB:</td>
                        <td>${patient?.gender || '—'} / ${patient?.dob ? new Date(patient.dob).toLocaleDateString('en-IN') : (patient?.age ? `${patient.age} yrs` : '—')}</td>
                    </tr>
                    <tr>
                        <td class="label">Blood Group:</td>
                        <td>${patient?.bloodGroup || '—'}</td>
                        <td class="label">Allergies:</td>
                        <td>${patient?.allergies || 'None'}</td>
                    </tr>
                    <tr>
                        <td class="label">Chronic Conditions:</td>
                        <td colspan="3">${patient?.chronicConditions || 'None'}</td>
                    </tr>
                    <tr>
                        <td class="label">Address:</td>
                        <td colspan="3">${patient?.address || '—'}</td>
                    </tr>
                </table>

                <div class="sec-title">Consultation Visit History</div>
                ${validAppts.length > 0 ? `
                    <table class="data-table">
                        <thead>
                            <tr style="background: #eef2ff;">
                                <th>Date</th>
                                <th>Token/Slot</th>
                                <th>Doctor</th>
                                <th>Diagnosis</th>
                                <th>Notes</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>${apptRowsHtml}</tbody>
                    </table>
                ` : '<div style="font-size: 11px; color: #94a3b8; padding: 6px 0;">No consultation visits recorded.</div>'}

                <div class="sec-title">Prescribed Medicines Summary</div>
                ${allMedicines.length > 0 ? `
                    <table class="data-table">
                        <thead>
                            <tr style="background: #ecfdf5;">
                                <th>#</th>
                                <th>Date</th>
                                <th>Medicine</th>
                                <th>Dose / Freq</th>
                                <th>Duration</th>
                                <th>Instructions</th>
                            </tr>
                        </thead>
                        <tbody>${medRowsHtml}</tbody>
                    </table>
                ` : '<div style="font-size: 11px; color: #94a3b8; padding: 6px 0;">No prescribed medicines recorded.</div>'}

                <div class="footer">
                    Official Patient Profile Summary • ${hName} • Generated by ${issuedBy} on ${new Date().toLocaleString('en-IN')}
                </div>
            </body>
            </html>
        `;

        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } else {
            await Print.printAsync({ html });
        }
    } catch (e) {
        Alert.alert('Profile PDF Error', e.message);
    }
};

// ─────────────────────────────────────────────
// Role Modes
// ─────────────────────────────────────────────
const MODES = [
    { id: 'overview', icon: '📊', label: 'Overview', color: '#6366f1', bg: '#eef2ff' },
    { id: 'patients', icon: '👤', label: 'Patients', color: '#0ea5e9', bg: '#f0f9ff' },
    { id: 'doctor', icon: '🩺', label: 'Doctor', color: '#8b5cf6', bg: '#f5f3ff' },
    { id: 'reception', icon: '📋', label: 'Reception', color: '#10b981', bg: '#f0fdf4' },
    { id: 'pharmacy', icon: '💊', label: 'Pharmacy', color: '#f97316', bg: '#fff7ed' },
    { id: 'billing', icon: '💰', label: 'Billing', color: '#f59e0b', bg: '#fffbeb' },
    { id: 'plans', icon: '📅', label: 'Treatment Plans', color: '#0891b2', bg: '#ecfeff' },
];

// Helper: Safely extract string role from user (supports string role, populated Role object, roleName)
const getRoleStr = (u) => {
    if (!u) return '';
    if (typeof u === 'string') return u;
    if (typeof u.role === 'string') return u.role;
    if (u.role && typeof u.role === 'object' && u.role.name) return u.role.name;
    if (typeof u.roleName === 'string') return u.roleName;
    return '';
};

// ─────────────────────────────────────────────
// Root Component
// ─────────────────────────────────────────────
const ClinicDashboard = ({ navigation }) => {
    const { width: screenWidth, isNarrow, isMobile, isTablet, isDesktop } = useResponsive();
    const reduxUser = useSelector(state => state.auth?.user);
    const [currentUser, setCurrentUser] = useState(reduxUser || {});

    // Exact Web Match (L523-530): synchronous initial mode resolution
    const getInitialMode = () => {
        const u = reduxUser || currentUser;
        const role = getRoleStr(u).toLowerCase().replace(/[\s_-]+/g, '');
        if (role === 'doctor' || role === 'clinicdoctor') return 'doctor';
        if (role === 'reception' || role === 'receptionist') return 'reception';
        return 'overview';
    };
    const [mode, setMode] = useState(getInitialMode());
    const [preselectedPatient, setPreselectedPatient] = useState(null);
    const [pendingDownload, setPendingDownload] = useState(null);
    const [loadingUser, setLoadingUser] = useState(!getRoleStr(reduxUser));

    useEffect(() => {
        const loadUser = async () => {
            try {
                const userStr = await AsyncStorage.getItem('user') || await AsyncStorage.getItem(STORAGE_KEYS.USER);
                if (userStr) {
                    const parsed = JSON.parse(userStr);
                    setCurrentUser(prev => ({ ...parsed, ...prev }));
                    const role = getRoleStr(parsed).toLowerCase().replace(/[\s_-]+/g, '');
                    if (role === 'doctor' || role === 'clinicdoctor') setMode('doctor');
                    else if (role === 'reception' || role === 'receptionist') setMode('reception');
                }
            } catch (e) {
                console.log('[ClinicDashboard] loadUser error:', e?.message);
            } finally {
                setLoadingUser(false);
            }
        };
        if (!getRoleStr(reduxUser)) {
            loadUser();
        } else {
            setLoadingUser(false);
        }
    }, [reduxUser]);

    useEffect(() => {
        if (pendingDownload) {
            const timer = setTimeout(() => {
                setPendingDownload(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [pendingDownload]);

    const goToReception = (patient) => {
        setPreselectedPatient(patient);
        setMode('reception');
    };

    if (loadingUser) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
            </View>
        );
    }

    const isClinicDoctorUser = getRoleStr(currentUser || reduxUser).toLowerCase().includes('doctor');

    return (
        <View style={styles.container}>
            {/* Role Switcher */}
            {!isClinicDoctorUser && (
                <View style={[styles.roleSwitcher, isMobile && { paddingHorizontal: 12, paddingVertical: 10, gap: 6, marginHorizontal: 8, marginTop: 8, marginBottom: 12 }]}>
                    <Text style={[styles.switcherLabel, isMobile && { fontSize: 11, marginRight: 2 }]}>Mode:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll}>
                        <View style={styles.switcherButtons}>
                            {MODES.filter(m => {
                                const role = getRoleStr(currentUser || reduxUser).toLowerCase();
                                if (role === 'doctor' || role === 'clinic doctor') return ['doctor', 'patients', 'overview'].includes(m.id);
                                if (role === 'reception' || role === 'receptionist') return ['reception', 'patients', 'overview', 'billing', 'plans'].includes(m.id);
                                return true;
                            }).map(m => (
                                <TouchableOpacity
                                    key={m.id}
                                    style={[styles.switcherBtn, isMobile && { paddingHorizontal: 12, paddingVertical: 7 }, mode === m.id && { backgroundColor: m.color, borderColor: m.color }]}
                                    onPress={() => setMode(m.id)}
                                >
                                    <Text style={{ fontSize: isMobile ? 12 : 14 }}>{m.icon}</Text>
                                    <Text style={[styles.switcherBtnText, isMobile && { fontSize: 12 }, mode === m.id && { color: '#fff' }]}>{m.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                    {currentUser?.subscriptionPlan !== 'starter' && (
                        <View style={styles.switcherUser}>
                            <View style={styles.switcherAvatar}><Text style={styles.switcherAvatarText}>{currentUser?.name?.charAt(0)?.toUpperCase()}</Text></View>
                            {!isMobile && <Text style={styles.switcherUserName}>{currentUser?.name}</Text>}
                        </View>
                    )}
                </View>
            )}

            {isClinicDoctorUser && (
                <View style={[styles.roleSwitcher, { justifyContent: 'flex-end' }, isMobile && { paddingHorizontal: 10, paddingVertical: 8 }]}>
                    {currentUser?.subscriptionPlan !== 'starter' && (
                        <View style={styles.switcherUser}>
                            <View style={styles.switcherAvatar}><Text style={styles.switcherAvatarText}>{currentUser?.name?.charAt(0)?.toUpperCase()}</Text></View>
                            {!isMobile && <Text style={styles.switcherUserName}>Dr. {currentUser?.name}</Text>}
                        </View>
                    )}
                </View>
            )}

            {pendingDownload && (
                <View style={styles.downloadAlert}>
                    <Text style={styles.downloadAlertText}>✅ {pendingDownload.title || 'Document Generated'} — {pendingDownload.filename} is ready</Text>
                </View>
            )}

            <View style={[styles.modeContent, { padding: isNarrow ? 8 : (isMobile ? 12 : 16) }]}>
                {mode === 'overview' && <OverviewMode />}
                {mode === 'patients' && <PatientsMode onBookToken={goToReception} setPendingDownload={setPendingDownload} />}
                {mode === 'doctor' && <DoctorMode setPendingDownload={setPendingDownload} />}
                {mode === 'reception' && <ReceptionMode preselectedPatient={preselectedPatient} clearPreselected={() => setPreselectedPatient(null)} setPendingDownload={setPendingDownload} />}
                {mode === 'pharmacy' && <PharmacyMode />}
                {mode === 'billing' && <BillingMode />}
                {mode === 'plans' && <TreatmentPlanMode />}
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════
// OVERVIEW MODE
// ═══════════════════════════════════════════════════
const OverviewMode = () => {
    const { width: screenWidth, isNarrow, isMobile, isTablet, isDesktop } = useResponsive();
    const [stats, setStats] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [treatmentPlans, setTreatmentPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState({ defaultFee: '0', followUpDays: '0', defaultServiceName: 'General Consultation', appointmentMode: 'token' });
    const [cfgSaving, setCfgSaving] = useState(false);
    const [cfgMsg, setCfgMsg] = useState('');
    const [overviewMonthStr, setOverviewMonthStr] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    const [showAllKpis, setShowAllKpis] = useState(false);
    const [gridContainerWidth, setGridContainerWidth] = useState(0);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);

    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
        console.log('[ClinicDashboard][stats] START');
        console.log('[ClinicDashboard][appointments] START');
        console.log('[ClinicDashboard][treatmentPlans] START');
        console.log('[ClinicDashboard][config] START');
        Promise.allSettled([
            clinicAPI.getStats(),
            clinicAPI.getAppointments(),
            clinicAPI.getTreatmentPlans(),
            clinicAPI.getConfig()
        ]).then(([statsRes, apptRes, plansRes, cfgRes]) => {
            if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
                const sData = statsRes.value.stats || statsRes.value.data || statsRes.value;
                console.log('[ClinicDashboard][stats] STATUS', 200);
                console.log('[ClinicDashboard][stats] DATA_KEYS', Object.keys(sData || {}));
                setStats(sData);
                console.log('[ClinicDashboard][stats] SET_STATE');
            } else {
                const err = statsRes.reason || statsRes.value;
                const status = err?.response?.status || err?.status || 'FAIL';
                const message = err?.response?.data?.message || err?.message || 'Failed to load stats';
                console.log('[ClinicDashboard][stats] ERROR', { status, message });
                setFetchError(message);
            }

            if (apptRes.status === 'fulfilled' && apptRes.value?.success) {
                const appts = apptRes.value.appointments || apptRes.value.data || [];
                console.log('[ClinicDashboard][appointments] STATUS', 200);
                console.log('[ClinicDashboard][appointments] DATA_KEYS', Object.keys(appts[0] || {}));
                setAppointments(appts);
                console.log('[ClinicDashboard][appointments] SET_STATE');
            } else {
                const err = apptRes.reason || apptRes.value;
                const status = err?.response?.status || err?.status || 'FAIL';
                const message = err?.response?.data?.message || err?.message || 'Failed to load appointments';
                console.log('[ClinicDashboard][appointments] ERROR', { status, message });
            }

            if (plansRes.status === 'fulfilled' && plansRes.value?.success) {
                const plans = plansRes.value.plans || plansRes.value.data || [];
                console.log('[ClinicDashboard][treatmentPlans] STATUS', 200);
                console.log('[ClinicDashboard][treatmentPlans] DATA_KEYS', Object.keys(plans[0] || {}));
                setTreatmentPlans(plans);
                console.log('[ClinicDashboard][treatmentPlans] SET_STATE');
            } else {
                const err = plansRes.reason || plansRes.value;
                const status = err?.response?.status || err?.status || 'FAIL';
                const message = err?.response?.data?.message || err?.message || 'Failed to load treatment plans';
                console.log('[ClinicDashboard][treatmentPlans] ERROR', { status, message });
            }

            if (cfgRes.status === 'fulfilled' && cfgRes.value?.success) {
                const cfgR = cfgRes.value;
                console.log('[ClinicDashboard][config] STATUS', 200);
                console.log('[ClinicDashboard][config] DATA_KEYS', Object.keys(cfgR || {}));
                setConfig({
                    defaultFee: String(cfgR.defaultFee ?? 0),
                    followUpDays: String(cfgR.followUpDays ?? 0),
                    defaultServiceName: cfgR.defaultServiceName || 'General Consultation',
                    appointmentMode: cfgR.appointmentMode || 'token'
                });
                console.log('[ClinicDashboard][config] SET_STATE');
            } else {
                const err = cfgRes.reason || cfgRes.value;
                const status = err?.response?.status || err?.status || 'FAIL';
                const message = err?.response?.data?.message || err?.message || 'Failed to load config';
                console.log('[ClinicDashboard][config] ERROR', { status, message });
            }
        }).catch(err => {
            console.log('[ClinicDashboard][overview] ERROR', {
                status: err?.response?.status,
                message: err?.response?.data?.message || err?.message
            });
            setFetchError(err?.message);
        }).finally(() => setLoading(false));
    }, []);

    const saveConfig = async () => {
        setCfgSaving(true);
        try {
            const numConfig = { ...config, defaultFee: Number(config.defaultFee), followUpDays: Number(config.followUpDays) };
            const r = await clinicAPI.updateConfig(numConfig);
            setCfgMsg(r.success ? '✓ Saved' : (r.message || 'Error'));
        } catch { setCfgMsg('Error saving'); }
        finally { setCfgSaving(false); setTimeout(() => setCfgMsg(''), 3000); }
    };

    if (loading) return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={{ marginTop: 10, color: '#6366f1' }}>Loading overview...</Text>
        </View>
    );

    const getLocalYYYYMMDD = (d) => {
        const tzOffset = d.getTimezoneOffset() * 60000;
        return new Date(d - tzOffset).toISOString().split('T')[0];
    };
    const localTodayStr = getLocalYYYYMMDD(new Date());
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let todayApptRev = 0, todayTreatRev = 0;
    let monthApptRev = 0, monthTreatRev = 0;
    let totalApptRev = 0, totalTreatRev = 0;
    let todayCompletedVisits = 0;

    appointments.forEach(a => {
        if (a.status === 'completed') {
            const aDateStr = getLocalYYYYMMDD(new Date(a.appointmentDate));
            if (aDateStr === localTodayStr) todayCompletedVisits++;
        }
        if (a.amount > 0 && (a.paymentStatus === 'paid' || a.status === 'completed' || a.status === 'consulted')) {
            totalApptRev += a.amount;
            const d = new Date(a.appointmentDate);
            if (getLocalYYYYMMDD(d) === localTodayStr) todayApptRev += a.amount;
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) monthApptRev += a.amount;
        }
    });

    treatmentPlans.forEach(p => {
        if (Array.isArray(p.visits)) {
            p.visits.forEach(v => {
                if (v.status === 'completed') {
                    const vDate = v.completedAt ? new Date(v.completedAt) : new Date(v.scheduledDate);
                    if (getLocalYYYYMMDD(vDate) === localTodayStr) todayCompletedVisits++;
                }
                if (Array.isArray(v.paymentHistory) && v.paymentHistory.length > 0) {
                    v.paymentHistory.forEach(ph => {
                        if (ph.amount > 0) {
                            totalTreatRev += ph.amount;
                            const pd = new Date(ph.date);
                            if (getLocalYYYYMMDD(pd) === localTodayStr) todayTreatRev += ph.amount;
                            if (pd.getMonth() === currentMonth && pd.getFullYear() === currentYear) monthTreatRev += ph.amount;
                        }
                    });
                } else if (v.amountPaid > 0) {
                    totalTreatRev += v.amountPaid;
                    const fallbackDateStr = v.paidAt || v.completedAt || v.dueDate || p.createdAt;
                    if (fallbackDateStr) {
                        const fd = new Date(fallbackDateStr);
                        if (getLocalYYYYMMDD(fd) === localTodayStr) todayTreatRev += v.amountPaid;
                        if (fd.getMonth() === currentMonth && fd.getFullYear() === currentYear) monthTreatRev += v.amountPaid;
                    }
                }
            });
        }
    });

    const monthTotalRev = monthApptRev + monthTreatRev;
    const overallTotalRev = totalApptRev + totalTreatRev;

    const chartData = [];
    const selectedDate = new Date(overviewMonthStr + '-01T00:00:00');
    const m = selectedDate.getMonth();
    const y = selectedDate.getFullYear();

    let mAppt = 0;
    let mTreat = 0;

    appointments.forEach(a => {
        if (a.amount > 0 && (a.paymentStatus === 'paid' || a.status === 'completed' || a.status === 'consulted')) {
            const ad = new Date(a.appointmentDate);
            if (ad.getMonth() === m && ad.getFullYear() === y) mAppt += a.amount;
        }
    });

    treatmentPlans.forEach(p => {
        if (Array.isArray(p.visits)) {
            p.visits.forEach(v => {
                if (Array.isArray(v.paymentHistory) && v.paymentHistory.length > 0) {
                    v.paymentHistory.forEach(ph => {
                        if (ph.amount > 0) {
                            const pd = new Date(ph.date);
                            if (pd.getMonth() === m && pd.getFullYear() === y) mTreat += ph.amount;
                        }
                    });
                } else if (v.amountPaid > 0) {
                    const fallbackDateStr = v.paidAt || v.completedAt || v.dueDate || p.createdAt;
                    if (fallbackDateStr) {
                        const fd = new Date(fallbackDateStr);
                        if (fd.getMonth() === m && fd.getFullYear() === y) mTreat += v.amountPaid;
                    }
                }
            });
        }
    });

    chartData.push({ month: m, year: y, appt: mAppt, treat: mTreat, total: mAppt + mTreat });

    const kpis = [
        { label: "Today's Patients", value: stats?.todayPatients ?? 0, sub: 'Total visited today', icon: '👤', color: '#0ea5e9' },
        { label: "Today's Visits", value: todayCompletedVisits, sub: 'Total completed today', icon: '🎟️', color: '#8b5cf6' },
        { label: "Today's Appointment Collection", value: fmt(todayApptRev), sub: 'Appointments only', icon: '🩺', color: '#10b981' },
        { label: "Today's Treatment Collection", value: fmt(todayTreatRev), sub: 'Treatment plans only', icon: '📋', color: '#14b8a6' },
        { label: "Selected Month Appointment Collection", value: fmt(monthApptRev), sub: `${MONTHS[currentMonth]} ${currentYear}`, icon: '🩺', color: '#3b82f6' },
        { label: "Selected Month Treatment Collection", value: fmt(monthTreatRev), sub: `${MONTHS[currentMonth]} ${currentYear}`, icon: '📋', color: '#0ea5e9' },
        { label: "Selected Month Total Collection", value: fmt(monthTotalRev), sub: `${MONTHS[currentMonth]} ${currentYear}`, icon: '📅', color: '#6366f1' },
        { label: "Overall Collection", value: fmt(overallTotalRev), sub: 'Lifetime total revenue', icon: '💰', color: '#f59e0b' },
    ];

    // FIX A — OVERVIEW KPI: Web responsive layout parity
    // <= 480px: exactly 3 columns, gap 8 (governed by Web CSS @media (max-width: 480px) repeat(3, 1fr) !important)
    // > 480px: exactly 4 columns, gap 14 (governed by Web JSX inline style repeat(4, 1fr))
    const isMobileOverview = screenWidth <= 480;
    const ovGap = isMobileOverview ? 8 : 14;
    const ovCols = isMobileOverview ? 3 : 4;
    // Real container available width: account for DashboardLayout padding (10*2 for <400, 14*2 for >=400) + modeContent padding (16*2=32)
    const layoutPadH = screenWidth < 400 ? 20 : 28;
    const innerPadH = 32;
    const totalPadH = layoutPadH + innerPadH;
    const fallbackAvailWidth = Math.max(screenWidth - totalPadH, 240);
    const ovAvailWidth = gridContainerWidth > 0 ? gridContainerWidth : fallbackAvailWidth;
    const ovCardWidth = Math.floor((ovAvailWidth - (ovCols - 1) * ovGap) / ovCols);

    return (
        <ScrollView style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: isNarrow ? 20 : 24, fontWeight: 'bold', color: '#0f172a' }}>Dashboard Overview</Text>
            </View>

            <View
                style={{ width: '100%' }}
                onLayout={(e) => {
                    const w = e.nativeEvent?.layout?.width;
                    if (w > 0 && Math.abs(w - gridContainerWidth) > 2) {
                        setGridContainerWidth(w);
                    }
                }}
            >
                <View style={[styles.kpiGrid, { gap: ovGap, marginBottom: isMobileOverview ? 10 : 20 }]}>
                    {(isMobileOverview ? (showAllKpis ? kpis : kpis.slice(0, 3)) : kpis).map((k, i) => {
                        return (
                            <View
                                key={i}
                                style={[
                                    styles.kpiCard,
                                    {
                                        borderTopColor: k.color,
                                        borderTopWidth: 4,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flex: 0,
                                        width: ovCardWidth,
                                        minWidth: ovCardWidth,
                                        maxWidth: ovCardWidth,
                                        paddingVertical: isMobileOverview ? 10 : 18,
                                        paddingHorizontal: isMobileOverview ? 6 : 16,
                                    }
                                ]}
                            >
                                <Text style={{ fontSize: isMobileOverview ? 20 : 28, textAlign: 'center' }}>{k.icon}</Text>
                                <View style={{ marginTop: isMobileOverview ? 4 : 8, alignItems: 'center', width: '100%' }}>
                                    <Text style={{ fontSize: isMobileOverview ? 15 : 20, fontWeight: '800', color: k.color, textAlign: 'center' }} numberOfLines={1}>{k.value}</Text>
                                    <Text style={{ fontSize: isMobileOverview ? 10 : 12, color: '#64748b', fontWeight: '600', marginTop: 2, textAlign: 'center' }} numberOfLines={2}>{k.label}</Text>
                                    {k.sub && <Text style={{ fontSize: isMobileOverview ? 9 : 11, color: '#94a3b8', marginTop: 2, textAlign: 'center' }} numberOfLines={1}>{k.sub}</Text>}
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>
            {isMobileOverview && (
                <TouchableOpacity style={styles.kpiToggleBtn} onPress={() => setShowAllKpis(!showAllKpis)}>
                    <Text style={styles.kpiToggleText}>{showAllKpis ? '▲ Show Less' : '▼ View All Overview'}</Text>
                </TouchableOpacity>
            )}

            {/* Monthly Revenue Chart */}
            <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                <View style={{ flexDirection: isNarrow ? 'column' : 'row', justifyContent: 'space-between', alignItems: isNarrow ? 'flex-start' : 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    <Text style={{ fontSize: isNarrow ? 16 : 18, fontWeight: 'bold' }}>📈 Monthly Revenue</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#3b82f6' }} /><Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Appointment Revenue</Text></View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#10b981' }} /><Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Treatment Revenue</Text></View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#6366f1' }} /><Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>Total Revenue</Text></View>
                        </View>
                        <View style={{ minWidth: 150 }}>
                            <DropdownSelect
                                options={['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => {
                                    const y = overviewMonthStr.split('-')[0] || new Date().getFullYear();
                                    return {
                                        label: `${m} ${y}`,
                                        value: `${y}-${String(i + 1).padStart(2, '0')}`
                                    };
                                })}
                                value={overviewMonthStr}
                                onChange={(val) => setOverviewMonthStr(val)}
                                placeholder="Select Month"
                            />
                        </View>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', height: 180, alignItems: 'flex-end', justifyContent: 'space-around', paddingTop: 20 }}>
                    {chartData.map((m, i) => {
                        const maxTotal = Math.max(...chartData.map(x => x.total));
                        const apptPct = maxTotal > 0 ? (m.appt / maxTotal) * 100 : 0;
                        const treatPct = maxTotal > 0 ? (m.treat / maxTotal) * 100 : 0;
                        const totalPct = maxTotal > 0 ? (m.total / maxTotal) * 100 : 0;
                        return (
                            <View key={i} style={{ alignItems: 'center', flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, width: '100%', height: 130 }}>
                                    <View style={{ width: 14, height: `${apptPct}%`, minHeight: 4, backgroundColor: '#3b82f6', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                                    <View style={{ width: 14, height: `${treatPct}%`, minHeight: 4, backgroundColor: '#10b981', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                                    <View style={{ width: 14, height: `${totalPct}%`, minHeight: 4, backgroundColor: '#6366f1', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                                </View>
                                <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 'bold', marginTop: 6 }}>{MONTHS[m.month]}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Recent Appointments */}
            {stats?.recentAppointments?.length > 0 && (
                <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>📋 Recent Appointments</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View style={{ minWidth: Math.max(520, screenWidth - (isNarrow ? 36 : 64)) }}>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.th, { flex: 1 }]}>Token</Text>
                                <Text style={[styles.th, { flex: 2 }]}>Patient</Text>
                                <Text style={[styles.th, { flex: 1.5 }]}>Date</Text>
                                <Text style={[styles.th, { flex: 1.5 }]}>Status</Text>
                                <Text style={[styles.th, { flex: 1 }]}>Fee</Text>
                                <Text style={[styles.th, { flex: 1.2 }]}>Method</Text>
                            </View>
                            {stats.recentAppointments.map(a => (
                                <View key={a._id} style={styles.tableRow}>
                                    <Text style={[styles.td, { flex: 1, color: '#6366f1', fontWeight: 'bold' }]}>#{a.tokenNumber || '—'}</Text>
                                    <View style={{ flex: 2 }}>
                                        <Text style={[styles.td, { fontWeight: 'bold' }]}>{a.clinicPatientId?.name || a.patientId?.name || 'Walk-in'}</Text>
                                        <Text style={{ fontSize: 11, color: '#94a3b8' }}>{a.clinicPatientId?.patientUid || a.patientId}</Text>
                                    </View>
                                    <Text style={[styles.td, { flex: 1.5, fontSize: 12 }]}>{fmtDate(a.appointmentDate)}</Text>
                                    <View style={{ flex: 1.5, alignItems: 'flex-start' }}><StatusBadge status={a.status} /></View>
                                    <Text style={[styles.td, { flex: 1, color: '#16a34a', fontWeight: 'bold' }]}>{fmt(a.amount || 0)}</Text>
                                    <Text style={[styles.td, { flex: 1.2, color: '#64748b', textTransform: 'capitalize', fontSize: 12 }]}>{a.paymentMethod || 'Cash'}</Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* Low Stock Alert */}
            {stats?.lowStockItems?.length > 0 && (
                <View style={[styles.clinicCard, { borderColor: '#fecaca', borderWidth: 1 }, isMobile && styles.cardMobile]}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#dc2626', marginBottom: 12 }}>⚠️ Low Stock Alert</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {stats.lowStockItems.map(item => (
                            <View key={item._id} style={{ backgroundColor: '#fee2e2', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, maxWidth: '100%' }}>
                                <Text style={{ fontSize: 13, color: '#991b1b' }} numberOfLines={2}><Text style={{ fontWeight: 'bold' }}>{item.name}</Text> — only <Text style={{ color: '#dc2626', fontWeight: 'bold' }}>{item.stock}</Text> {item.unit} left</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* Clinic Settings */}
            <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 14 }}>⚙️ Clinic Settings</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: isMobile ? 'stretch' : 'flex-end' }}>
                    <View style={{ flex: isMobile ? undefined : 2, width: isMobile ? '100%' : undefined, minWidth: isMobile ? '100%' : 200 }}>
                        <Text style={styles.label}>Default Service Name</Text>
                        <TextInput style={styles.input} value={config.defaultServiceName} onChangeText={t => setConfig({ ...config, defaultServiceName: t })} placeholder="General Consultation" maxLength={50} />
                    </View>
                    <View style={{ flex: isMobile ? undefined : 1, width: isMobile ? '47%' : undefined, minWidth: isMobile ? '47%' : 120 }}>
                        <Text style={styles.label}>Default Fee (₹)</Text>
                        <TextInput style={styles.input} keyboardType="numeric" value={config.defaultFee} onChangeText={t => setConfig({ ...config, defaultFee: t })} />
                    </View>
                    <View style={{ flex: isMobile ? undefined : 1, width: isMobile ? '47%' : undefined, minWidth: isMobile ? '47%' : 140 }}>
                        <Text style={styles.label}>Follow-up Validity (Days)</Text>
                        <TextInput style={styles.input} keyboardType="numeric" value={config.followUpDays} onChangeText={t => setConfig({ ...config, followUpDays: t })} />
                    </View>
                    <View style={{ flex: isMobile ? undefined : 1.5, width: isMobile ? '100%' : undefined, minWidth: isMobile ? '100%' : 180 }}>
                        <Text style={styles.label}>Appointment Mode</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker selectedValue={config.appointmentMode} onValueChange={t => setConfig({ ...config, appointmentMode: t })}>
                                <Picker.Item label="Token (walk-in queue)" value="token" />
                                <Picker.Item label="Time Slot" value="slot" />
                            </Picker>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
                        <TouchableOpacity style={styles.btnPrimary} onPress={saveConfig} disabled={cfgSaving}>
                            <Text style={styles.btnPrimaryText}>{cfgSaving ? 'Saving…' : 'Save Settings'}</Text>
                        </TouchableOpacity>
                        {cfgMsg ? <Text style={{ fontSize: 13, color: cfgMsg.startsWith('✓') ? '#16a34a' : '#dc2626' }}>{cfgMsg}</Text> : null}
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

// ═══════════════════════════════════════════════════
// REPORT VIEWER MODAL
// ═══════════════════════════════════════════════════
const ReportViewerModal = ({ report, onClose }) => {
    const { width: screenWidth, height: screenHeight, isNarrow } = useResponsive();
    if (!report) return null;
    const url = reportURL(report.filename);
    const isPDF = report.mimetype === 'application/pdf' ||
        (report.filename || '').toLowerCase().endsWith('.pdf') ||
        (report.name || '').toLowerCase().endsWith('.pdf');

    return (
        <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: isNarrow ? 10 : 16 }}>
                <View style={{ width: '100%', maxWidth: 500, backgroundColor: '#1e293b', borderRadius: 12, overflow: 'hidden' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#334155' }}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, flex: 1 }} numberOfLines={1}>
                            📄 {report.name || 'Report'}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <TouchableOpacity onPress={() => Linking.openURL(url)}>
                                <Text style={{ fontSize: 12, color: '#7dd3fc' }}>Open ↗</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onClose} style={{ backgroundColor: '#ef4444', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 }}>
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>✕ Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ height: Math.min(350, Math.max(200, screenHeight * 0.45)), backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 10 }}>
                        {isPDF ? (
                            <View style={{ alignItems: 'center', padding: 20 }}>
                                <Ionicons name="document-text" size={64} color="#38bdf8" />
                                <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 10, textAlign: 'center' }}>PDF Document</Text>
                                <TouchableOpacity
                                    style={{ backgroundColor: '#0284c7', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginTop: 16 }}
                                    onPress={() => Linking.openURL(url)}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Open PDF in Browser ↗</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <Image
                                source={{ uri: url }}
                                style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                            />
                        )}
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', padding: 12, gap: 10, backgroundColor: '#1e293b' }}>
                        <TouchableOpacity
                            style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#334155', borderRadius: 6 }}
                            onPress={() => Linking.openURL(url)}
                        >
                            <Text style={{ color: '#38bdf8', fontSize: 12, fontWeight: '600' }}>Open External ↗</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#475569', borderRadius: 6 }}
                            onPress={onClose}
                        >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// ═══════════════════════════════════════════════════
// PATIENTS MODE (1:1 Web Parity)
// ═══════════════════════════════════════════════════
const PatientsMode = ({ onBookToken, setPendingDownload }) => {
    const { width: screenWidth, isNarrow, isMobile, isTablet, isDesktop } = useResponsive();
    const [tab, setTab] = useState('list');
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [patientHistory, setPatientHistory] = useState(null);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [patientReports, setPatientReports] = useState([]);
    const [viewReport, setViewReport] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [reportName, setReportName] = useState('');
    const [reportsTab, setReportsTab] = useState('upload'); // 'upload' | 'view'
    const [justRegistered, setJustRegistered] = useState(null);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [showEditModal, setShowEditModal] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '', phone: '', email: '', dob: '', gender: 'Male',
        address: '', bloodGroup: '', allergies: '', chronicConditions: '',
        medicalNotes: '', relatives: [], age: '', aadhaarNumber: ''
    });
    const [viewVisitModal, setViewVisitModal] = useState(null);

    const openEditModal = (p) => {
        setEditForm({
            name: p?.name || '',
            phone: p?.phone || '',
            email: p?.email || '',
            dob: p?.dob || '',
            gender: p?.gender || 'Male',
            address: p?.address || '',
            bloodGroup: p?.bloodGroup || '',
            allergies: p?.allergies || '',
            chronicConditions: p?.chronicConditions || '',
            medicalNotes: p?.medicalNotes || '',
            relatives: Array.isArray(p?.relatives) ? JSON.parse(JSON.stringify(p.relatives)) : [],
            age: p?.age !== undefined && p?.age !== null ? String(p.age) : '',
            aadhaarNumber: p?.aadhaarNumber || ''
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editForm.name.trim()) {
            Alert.alert('Validation Error', 'Patient name is required.');
            return;
        }
        setSavingEdit(true);
        try {
            const payload = {
                ...editForm,
                age: editForm.age ? Number(editForm.age) : undefined
            };
            const r = await clinicAPI.updatePatient(selectedPatient._id, payload);
            if (r.success) {
                const updated = r.patient || { ...selectedPatient, ...payload };
                setSelectedPatient(updated);
                setPatients(prev => prev.map(pt => pt._id === updated._id ? { ...pt, ...updated } : pt));
                setShowEditModal(false);
                flash('success', 'Patient details updated successfully.');
            } else {
                Alert.alert('Error', r.message || 'Failed to update patient');
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || err.message);
        } finally {
            setSavingEdit(false);
        }
    };
    const [form, setForm] = useState({
        name: '', phone: '', email: '', dob: '', gender: 'Male',
        address: '', city: '', state: '', pincode: '',
        bloodGroup: '', allergies: '', chronicConditions: '',
        relatives: [], age: '', aadhaarNumber: ''
    });

    const flash = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg({ type: '', text: '' }), 5000);
    };

    const loadPatients = () => {
        setLoading(true);
        console.log('[ClinicDashboard][patients] START');
        clinicAPI.getPatients()
            .then(r => {
                if (r.success) {
                    const patientList = r.patients || r.data || [];
                    console.log('[ClinicDashboard][patients] STATUS', 200);
                    console.log('[ClinicDashboard][patients] DATA_KEYS', Object.keys(patientList[0] || {}));
                    setPatients(patientList);
                    console.log('[ClinicDashboard][patients] SET_STATE');
                } else {
                    console.log('[ClinicDashboard][patients] ERROR', { status: 400, message: r.message });
                    flash('error', r.message || 'Failed to load patients');
                }
            })
            .catch(e => {
                const status = e?.response?.status || 'FAIL';
                const message = e?.response?.data?.message || e?.message;
                console.log('[ClinicDashboard][patients] ERROR', { status, message });
                flash('error', message);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadPatients();
    }, []);

    // Debounced search ref (matches Web debounce behavior)
    const searchDebounceRef = useRef(null);
    const handleSearch = (value) => {
        const q = value !== undefined ? value : search;
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setSearching(true);
            clinicAPI.getPatients(q.trim())
                .then(r => {
                    if (r.success) setPatients(r.patients || []);
                    else flash('error', r.message || 'Search failed');
                })
                .catch(e => flash('error', e.response?.data?.message || e.message))
                .finally(() => setSearching(false));
        }, 300);
    };

    const openHistory = async (p) => {
        setSelectedPatient(p);
        setLoadingHistory(true);
        setPatientHistory(null);
        setPatientReports([]);
        try {
            const r = await clinicAPI.getPatientHistory(p._id);
            if (r.success) {
                const cleanedAppts = filterValidVisits(r.appointments || []);
                setPatientHistory({ ...r, appointments: cleanedAppts });
                setPatientReports(r.patient?.reports || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleUploadReport = async () => {
        if (!selectedPatient) return;
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
            });
            if (res.canceled || !res.assets?.length) return;
            const fileAsset = res.assets[0];
            setUploading(true);
            const fd = new FormData();
            if (Platform.OS === 'web' && fileAsset.file) {
                fd.append('report', fileAsset.file);
            } else {
                fd.append('report', {
                    uri: fileAsset.uri,
                    name: fileAsset.name || 'report.pdf',
                    type: fileAsset.mimeType || 'application/pdf',
                });
            }
            if (reportName.trim()) {
                fd.append('name', reportName.trim());
            } else {
                fd.append('name', fileAsset.name || 'Report');
            }
            const r = await clinicAPI.uploadPatientReport(selectedPatient._id, fd);
            if (r.success) {
                setPatientReports(prev => [...prev, r.report]);
                setReportName('');
                flash('success', 'Report uploaded successfully');
            } else {
                flash('error', r.message || 'Failed to upload report');
            }
        } catch (e) {
            flash('error', e.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteReport = (reportId) => {
        if (!selectedPatient) return;
        Alert.alert(
            "Delete Report",
            "Are you sure you want to delete this report?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const r = await clinicAPI.deletePatientReport(selectedPatient._id, reportId);
                            if (r.success) {
                                setPatientReports(prev => prev.filter(rp => rp._id !== reportId));
                                flash('success', 'Report deleted');
                            } else {
                                flash('error', r.message || 'Failed to delete report');
                            }
                        } catch (e) {
                            flash('error', e.message);
                        }
                    }
                }
            ]
        );
    };

    const handleDownloadReport = async (report) => {
        const url = reportURL(report.filename);
        if (Platform.OS === 'web') {
            Linking.openURL(url);
        } else {
            try {
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(url);
                } else {
                    Linking.openURL(url);
                }
            } catch {
                Linking.openURL(url);
            }
        }
    };

    const handleRegister = async () => {
        // Match Web validation: name, phone, age, aadhaarNumber required. email/dob/address/city/state are optional.
        const trimmedName = (form.name || '').trim();
        if (trimmedName.length < 2) {
            Alert.alert('Validation Error', 'Patient name must be at least 2 characters.');
            return;
        }
        if (!/^\d{10}$/.test((form.phone || '').trim())) {
            Alert.alert('Validation Error', 'Phone number must be exactly 10 digits.');
            return;
        }
        if (!form.age || Number(form.age) < 1) {
            Alert.alert('Validation Error', 'Please enter a valid age (minimum 1).');
            return;
        }
        // G4 fix: Aadhaar is REQUIRED in Web (L1292). Must be non-empty and exactly 12 digits.
        if (!form.aadhaarNumber || !/^\d{12}$/.test((form.aadhaarNumber || '').trim())) {
            Alert.alert('Validation Error', 'Aadhaar Number is required and must be exactly 12 digits.');
            return;
        }

        setSaving(true);
        try {
            const r = await clinicAPI.registerPatient(form);
            if (r.success) {
                if (!r.existing) setPatients(prev => [r.patient, ...prev]);
                setJustRegistered(r.patient);
                printRegistrationSlip(r.patient);
                setForm({
                    name: '', phone: '', email: '', dob: '', gender: 'Male',
                    address: '', city: '', state: '', pincode: '',
                    bloodGroup: '', allergies: '', chronicConditions: '',
                    relatives: [], age: '', aadhaarNumber: ''
                });
            } else {
                Alert.alert("Error", r.message || "Failed to register");
            }
        } catch (error) {
            Alert.alert("Error", error.response?.data?.message || error.message);
        } finally {
            setSaving(false);
        }
    };

        // ── Patient Detail View (1:1 Web Parity) ──
    if (selectedPatient) {
        return (
            <ScrollView style={{ flex: 1 }}>
                {viewReport && <ReportViewerModal report={viewReport} onClose={() => setViewReport(null)} />}

                {/* Back to Patients Button */}
                <TouchableOpacity
                    style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }]}
                    onPress={() => { setSelectedPatient(null); setPatientHistory(null); }}
                >
                    <Ionicons name="arrow-back" size={16} color="#475569" />
                    <Text style={styles.backBtnText}>Back to Patients</Text>
                </TouchableOpacity>

                {/* Patient Header Card (1:1 Web Desktop & Mobile Parity) */}
                <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                    <View style={{ flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: 16 }}>
                        <View style={styles.clinicAvatarLg}>
                            <Text style={{ color: '#3b82f6', fontSize: 18, fontWeight: '800' }}>
                                {selectedPatient.name?.charAt(0)?.toUpperCase()}
                            </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: isMobile ? '100%' : 220 }}>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1e293b' }}>{selectedPatient.name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                <View style={{ backgroundColor: '#eef2ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                    <Text style={{ color: '#6366f1', fontWeight: 'bold', fontSize: 12 }}>{selectedPatient.patientUid}</Text>
                                </View>
                                {selectedPatient.phone ? <Text style={{ color: '#64748b', fontSize: 13 }}>📞 {selectedPatient.phone}</Text> : null}
                                {selectedPatient.gender ? <Text style={{ color: '#64748b', fontSize: 13 }}>· {selectedPatient.gender}</Text> : null}
                                {selectedPatient.dob ? <Text style={{ color: '#64748b', fontSize: 13 }}>· DOB: {fmtDate(selectedPatient.dob)}</Text> : null}
                            </View>
                            {selectedPatient.address ? <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>📍 {selectedPatient.address}</Text> : null}
                            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                                {selectedPatient.bloodGroup ? (
                                    <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '700' }}>🩸 {selectedPatient.bloodGroup}</Text>
                                    </View>
                                ) : null}
                                {selectedPatient.allergies ? (
                                    <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text style={{ color: '#92400e', fontSize: 11, fontWeight: '600' }}>⚠️ Allergies: {selectedPatient.allergies}</Text>
                                    </View>
                                ) : null}
                                {selectedPatient.chronicConditions ? (
                                    <View style={{ backgroundColor: '#f0f9ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text style={{ color: '#0369a1', fontSize: 11, fontWeight: '600' }}>🏥 {selectedPatient.chronicConditions}</Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>

                        {/* Right-Side Action Area (Web Desktop Layout: Top-Right on Desktop, Below on Mobile) */}
                        <View style={{
                            marginLeft: isMobile ? 0 : 'auto',
                            alignItems: isMobile ? 'flex-start' : 'flex-end',
                            gap: 8,
                            marginTop: isMobile ? 12 : 0,
                            paddingTop: isMobile ? 12 : 0,
                            borderTopWidth: isMobile ? 1 : 0,
                            borderColor: '#f1f5f9',
                            width: isMobile ? '100%' : undefined
                        }}>
                            {selectedPatient.createdAt ? (
                                <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                                    Registered: {fmtDate(selectedPatient.createdAt)}
                                </Text>
                            ) : null}
                            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                                <TouchableOpacity
                                    style={[styles.btnSecondary, { borderColor: '#bae6fd', backgroundColor: '#e0f2fe', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 }]}
                                    onPress={() => printRegistrationSlip(selectedPatient)}
                                >
                                    <Ionicons name="document-text-outline" size={14} color="#0369a1" />
                                    <Text style={{ color: '#0369a1', fontWeight: '700', fontSize: 12 }}>📄 Registration Slip</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.btnSecondary, { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 }]}
                                    onPress={() => generatePatientProfilePDF(selectedPatient, patientHistory?.appointments || [])}
                                >
                                    <Ionicons name="download-outline" size={14} color="#059669" />
                                    <Text style={{ color: '#059669', fontWeight: '700', fontSize: 12 }}>📥 Download Profile PDF</Text>
                                </TouchableOpacity>
                                
                            </View>
                        </View>
                    </View>

{/* Relatives / Emergency Contacts */}
                    {selectedPatient.relatives?.length > 0 && (
                        <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderColor: '#f1f5f9' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 8 }}>👨‍👩‍👧 Emergency Contacts</Text>
                            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                                {selectedPatient.relatives.map((rel, i) => (
                                    <View key={i} style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 8, padding: 8, minWidth: isNarrow ? '100%' : 140 }}>
                                        <Text style={{ fontWeight: '700', color: '#0f172a', fontSize: 12 }}>{rel.name}</Text>
                                        {rel.relation ? <Text style={{ color: '#0369a1', fontSize: 11 }}>{rel.relation}</Text> : null}
                                        {rel.phone ? <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>📞 {rel.phone}</Text> : null}
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                {/* Medical Reports Card */}
                <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 }}>
                        📄 Medical Reports ({patientReports.length})
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, borderBottomWidth: 1, borderColor: '#e2e8f0', paddingBottom: 10 }}>
                        <TouchableOpacity
                            style={[styles.btnSecondary, { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: reportsTab === 'upload' ? '#6366f1' : '#f1f5f9', borderColor: reportsTab === 'upload' ? '#6366f1' : '#e2e8f0' }]}
                            onPress={() => setReportsTab('upload')}
                        >
                            <Text style={{ color: reportsTab === 'upload' ? '#fff' : '#475569', fontWeight: 'bold', fontSize: 12 }}>Upload Reports</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.btnSecondary, { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: reportsTab === 'view' ? '#6366f1' : '#f1f5f9', borderColor: reportsTab === 'view' ? '#6366f1' : '#e2e8f0' }]}
                            onPress={() => setReportsTab('view')}
                        >
                            <Text style={{ color: reportsTab === 'view' ? '#fff' : '#475569', fontWeight: 'bold', fontSize: 12 }}>View Reports ({patientReports.length})</Text>
                        </TouchableOpacity>
                    </View>

                    {reportsTab === 'upload' && (
                        <View style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 8, padding: 12 }}>
                            <TextInput
                                style={[styles.input, { marginBottom: 10, backgroundColor: '#fff' }]}
                                placeholder="Report name (optional)"
                                value={reportName}
                                onChangeText={setReportName}
                            />
                            <TouchableOpacity
                                style={[styles.btnPrimary, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }]}
                                onPress={handleUploadReport}
                                disabled={uploading}
                            >
                                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                                <Text style={styles.btnPrimaryText}>{uploading ? 'Uploading...' : '⬆ Upload PDF / Image'}</Text>
                            </TouchableOpacity>
                            <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>Supports PDF, JPG, PNG · max 20 MB</Text>
                        </View>
                    )}

                    {reportsTab === 'view' && (
                        patientReports.length === 0 ? (
                            <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', paddingVertical: 14 }}>No reports uploaded yet.</Text>
                        ) : (
                            <View style={{ gap: 8 }}>
                                {patientReports.map(r => {
                                    const isPdf = r.mimetype === 'application/pdf' || (r.filename || '').toLowerCase().endsWith('.pdf') || (r.name || '').toLowerCase().endsWith('.pdf');
                                    return (
                                        <View key={r._id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e7ff', borderRadius: 8, padding: 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                                                <Text style={{ fontSize: 20 }}>{isPdf ? '📄' : '🖼️'}</Text>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#1e293b' }} numberOfLines={1}>{r.name}</Text>
                                                    <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                                        {isPdf ? 'PDF' : 'Image'} · {r.uploadedAt ? new Date(r.uploadedAt).toLocaleDateString('en-IN') : ''}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                                <TouchableOpacity
                                                    style={{ backgroundColor: '#6366f1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                                                    onPress={() => setViewReport(r)}
                                                >
                                                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>View</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={{ backgroundColor: '#10b981', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                                                    onPress={() => handleDownloadReport(r)}
                                                >
                                                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>Open</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }}
                                                    onPress={() => handleDeleteReport(r._id)}
                                                >
                                                    <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: 'bold' }}>✕</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )
                    )}
                </View>

                {/* Visit History Card */}
                <View style={[styles.clinicCard, { marginBottom: isMobile ? 12 : 30 }, isMobile && styles.cardMobile]}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 }}>
                        📋 Visit History ({patientHistory?.appointments?.length || 0} visits)
                    </Text>

                    {loadingHistory ? (
                        <Spinner text="Loading history..." />
                    ) : patientHistory?.appointments?.length === 0 ? (
                        <Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 16 }}>No visits yet.</Text>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                            <View style={{ minWidth: 700 }}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { width: 120 }]}>Date & Time</Text>
                                    <Text style={[styles.th, { width: 75 }]}>Token</Text>
                                    <Text style={[styles.th, { width: 150 }]}>Diagnosis</Text>
                                    <Text style={[styles.th, { width: 140 }]}>Medicines</Text>
                                    <Text style={[styles.th, { width: 85 }]}>Status</Text>
                                    <Text style={[styles.th, { width: 75, textAlign: 'right' }]}>Fee</Text>
                                    <Text style={[styles.th, { width: 75, textAlign: 'center' }]}>Action</Text>
                                </View>
                                {patientHistory?.appointments?.map(a => (
                                    <View key={a._id} style={styles.tableRow}>
                                        <View style={{ width: 120 }}>
                                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#1e293b' }}>{fmtDate(a.appointmentDate)}</Text>
                                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>{fmtTime(a.appointmentDate)}</Text>
                                        </View>
                                        <Text style={{ width: 75, fontWeight: 'bold', color: '#6366f1' }}>#{a.tokenNumber || '—'}</Text>
                                        <View style={{ width: 150 }}>
                                            <Text style={{ fontSize: 12, color: '#334155' }} numberOfLines={2}>{a.diagnosis || '—'}</Text>
                                            {a.vitals?.bp ? <Text style={{ fontSize: 10, color: '#6366f1', marginTop: 2 }}>BP: {a.vitals.bp}</Text> : null}
                                        </View>
                                        <View style={{ width: 140 }}>
                                            {(a.pharmacy || a.medicines || []).slice(0, 2).map((m, i) => (
                                                <Text key={i} style={{ fontSize: 11, color: '#64748b' }} numberOfLines={1}>• {m.medicineName || m.name}</Text>
                                            ))}
                                            {(a.pharmacy || a.medicines || []).length > 2 && (
                                                <Text style={{ fontSize: 10, color: '#94a3b8' }}>+{(a.pharmacy || a.medicines || []).length - 2} more</Text>
                                            )}
                                        </View>
                                        <View style={{ width: 85 }}>
                                            <StatusBadge status={a.status} />
                                        </View>
                                        <Text style={{ width: 75, textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>
                                            {fmt(a.amount)}
                                        </Text>
                                        <View style={{ width: 75, alignItems: 'center' }}>
                                            <TouchableOpacity
                                                style={[styles.btnSecondary, { paddingHorizontal: 8, paddingVertical: 4 }]}
                                                onPress={() => setViewVisitModal(a)}
                                            >
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#6366f1' }}>👁️ Details</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    )}
                </View>

                {/* Visit Details Modal */}
                {viewVisitModal && (
                    <Modal transparent visible animationType="fade" onRequestClose={() => setViewVisitModal(null)}>
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: isNarrow ? 10 : 16 }}>
                            <View style={{ width: '100%', maxWidth: 580, maxHeight: '90%', backgroundColor: '#fff', borderRadius: 14, padding: isNarrow ? 16 : 22, overflow: 'hidden' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingBottom: 12, marginBottom: 14 }}>
                                    <View>
                                        <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#0f172a' }}>
                                            Consultation Details
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                                            Token #{viewVisitModal.tokenNumber || '—'} · {fmtDate(viewVisitModal.appointmentDate)} {fmtTime(viewVisitModal.appointmentDate)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setViewVisitModal(null)} style={{ padding: 4 }}>
                                        <Text style={{ fontSize: 18, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={{ maxHeight: 420 }}>
                                    {/* Service & Fee row */}
                                    <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                                        <View>
                                            <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Service</Text>
                                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1e293b' }}>{viewVisitModal.serviceName || 'General Consultation'}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Fee Paid</Text>
                                            <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#16a34a' }}>{fmt(viewVisitModal.amount)} ({viewVisitModal.paymentMethod || 'Cash'})</Text>
                                        </View>
                                    </View>

                                    {/* Vitals Summary */}
                                    {viewVisitModal.vitals && Object.values(viewVisitModal.vitals).some(Boolean) && (
                                        <View style={{ marginBottom: 14 }}>
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0369a1', marginBottom: 8 }}>🩺 Recorded Vitals</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                {viewVisitModal.vitals.bp ? (
                                                    <View style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 }}>
                                                        <Text style={{ fontSize: 10, color: '#64748b' }}>BP</Text>
                                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>{viewVisitModal.vitals.bp}</Text>
                                                    </View>
                                                ) : null}
                                                {viewVisitModal.vitals.pulse ? (
                                                    <View style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 }}>
                                                        <Text style={{ fontSize: 10, color: '#64748b' }}>Pulse</Text>
                                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>{viewVisitModal.vitals.pulse} bpm</Text>
                                                    </View>
                                                ) : null}
                                                {viewVisitModal.vitals.temperature ? (
                                                    <View style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 }}>
                                                        <Text style={{ fontSize: 10, color: '#64748b' }}>Temp</Text>
                                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>{viewVisitModal.vitals.temperature} °F</Text>
                                                    </View>
                                                ) : null}
                                                {viewVisitModal.vitals.weight ? (
                                                    <View style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 }}>
                                                        <Text style={{ fontSize: 10, color: '#64748b' }}>Weight</Text>
                                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>{viewVisitModal.vitals.weight} kg</Text>
                                                    </View>
                                                ) : null}
                                                {viewVisitModal.vitals.height ? (
                                                    <View style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 }}>
                                                        <Text style={{ fontSize: 10, color: '#64748b' }}>Height</Text>
                                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>{viewVisitModal.vitals.height} cm</Text>
                                                    </View>
                                                ) : null}
                                                {viewVisitModal.vitals.bmi ? (
                                                    <View style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 }}>
                                                        <Text style={{ fontSize: 10, color: '#64748b' }}>BMI</Text>
                                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>{viewVisitModal.vitals.bmi}</Text>
                                                    </View>
                                                ) : null}
                                                {viewVisitModal.vitals.spo2 ? (
                                                    <View style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 }}>
                                                        <Text style={{ fontSize: 10, color: '#64748b' }}>SpO2</Text>
                                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>{viewVisitModal.vitals.spo2}%</Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>
                                    )}

                                    {/* Diagnosis & Notes */}
                                    <View style={{ marginBottom: 14 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Diagnosis</Text>
                                        <Text style={{ fontSize: 14, color: '#1e293b', fontWeight: '600', backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                            {viewVisitModal.diagnosis || 'No diagnosis recorded.'}
                                        </Text>
                                        {(viewVisitModal.doctorNotes || viewVisitModal.notes) ? (
                                            <View style={{ marginTop: 8 }}>
                                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Clinical Notes</Text>
                                                <Text style={{ fontSize: 13, color: '#334155', backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                                    {viewVisitModal.doctorNotes || viewVisitModal.notes}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>

                                    {/* Prescriptions */}
                                    {(viewVisitModal.pharmacy || viewVisitModal.medicines)?.length > 0 && (
                                        <View style={{ marginBottom: 14 }}>
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b', marginBottom: 6 }}>💊 Prescribed Medicines</Text>
                                            <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                                                <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 6, paddingHorizontal: 10 }}>
                                                    <Text style={{ flex: 2, fontSize: 11, fontWeight: '700', color: '#475569' }}>Medicine</Text>
                                                    <Text style={{ flex: 1.5, fontSize: 11, fontWeight: '700', color: '#475569' }}>Dose / Freq</Text>
                                                    <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: '#475569' }}>Days</Text>
                                                </View>
                                                {(viewVisitModal.pharmacy || viewVisitModal.medicines).map((m, idx) => (
                                                    <View key={idx} style={{ flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, borderColor: '#f1f5f9' }}>
                                                        <View style={{ flex: 2 }}>
                                                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1e293b' }}>{m.medicineName || m.name}</Text>
                                                            {m.saltName ? <Text style={{ fontSize: 10, color: '#94a3b8' }}>{m.saltName}</Text> : null}
                                                        </View>
                                                        <Text style={{ flex: 1.5, fontSize: 12, color: '#334155' }}>{m.frequency || m.dose || '—'}</Text>
                                                        <Text style={{ flex: 1, fontSize: 12, color: '#334155' }}>{m.duration || m.days || '—'}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}

                                    {/* Lab Tests */}
                                    {viewVisitModal.labTests?.length > 0 && (
                                        <View style={{ marginBottom: 14 }}>
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b', marginBottom: 6 }}>🧪 Recommended Lab Tests</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                                {viewVisitModal.labTests.map((t, i) => (
                                                    <View key={i} style={{ backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', borderRadius: 4, paddingVertical: 3, paddingHorizontal: 8 }}>
                                                        <Text style={{ fontSize: 11, color: '#7c3aed', fontWeight: '600' }}>{t}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}
                                </ScrollView>

                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, borderTopWidth: 1, borderColor: '#e2e8f0', paddingTop: 12, marginTop: 10 }}>
                                    <TouchableOpacity
                                        style={[styles.btnSecondary, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                                        onPress={() => printPrescriptionSlip(
                                            viewVisitModal,
                                            {
                                                medicines: viewVisitModal.pharmacy || viewVisitModal.medicines || [],
                                                diagnosis: viewVisitModal.diagnosis,
                                                notes: viewVisitModal.doctorNotes || viewVisitModal.notes,
                                                labTests: (viewVisitModal.labTests || []).join(', ')
                                            },
                                            viewVisitModal.vitals || {}
                                        )}
                                    >
                                        <Ionicons name="print-outline" size={16} color="#475569" />
                                        <Text style={styles.btnSecondaryText}>Print Slip</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.btnPrimary}
                                        onPress={() => setViewVisitModal(null)}
                                    >
                                        <Text style={styles.btnPrimaryText}>Close</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                )}

                {/* Edit Patient Modal */}
                {showEditModal && (
                    <Modal transparent visible animationType="fade" onRequestClose={() => setShowEditModal(false)}>
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: isNarrow ? 10 : 16 }}>
                            <View style={{ width: '100%', maxWidth: 540, maxHeight: '92%', backgroundColor: '#fff', borderRadius: 14, padding: isNarrow ? 16 : 22, overflow: 'hidden' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingBottom: 12, marginBottom: 14 }}>
                                    <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#0f172a' }}>
                                        ✏️ Edit Patient Profile
                                    </Text>
                                    <TouchableOpacity onPress={() => setShowEditModal(false)} style={{ padding: 4 }}>
                                        <Text style={{ fontSize: 18, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={{ maxHeight: 440 }}>
                                    <View style={{ gap: 10 }}>
                                        <View>
                                            <Text style={styles.label}>Full Name *</Text>
                                            <TextInput style={styles.input} value={editForm.name} onChangeText={t => setEditForm({ ...editForm, name: t })} placeholder="Full Name" />
                                        </View>
                                        <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 10 }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.label}>Phone *</Text>
                                                <TextInput style={styles.input} keyboardType="phone-pad" value={editForm.phone} maxLength={10} onChangeText={t => setEditForm({ ...editForm, phone: t.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit phone" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.label}>Age</Text>
                                                <TextInput style={styles.input} keyboardType="numeric" value={editForm.age} maxLength={3} onChangeText={t => setEditForm({ ...editForm, age: t.replace(/\D/g, '').slice(0, 3) })} placeholder="Age" />
                                            </View>
                                        </View>
                                        <View>
                                            <Text style={styles.label}>Email</Text>
                                            <TextInput style={styles.input} keyboardType="email-address" value={editForm.email} onChangeText={t => setEditForm({ ...editForm, email: t })} placeholder="Email address" />
                                        </View>
                                        <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 10 }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.label}>Gender</Text>
                                                <CustomSelectDropdown
                                                    insideModal={true}
                                                    value={editForm.gender}
                                                    placeholder="Select Gender"
                                                    options={['Male', 'Female', 'Other']}
                                                    onSelect={v => setEditForm({ ...editForm, gender: v })}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.label}>Blood Group</Text>
                                                <CustomSelectDropdown
                                                    insideModal={true}
                                                    value={editForm.bloodGroup}
                                                    placeholder="Select Blood Group"
                                                    options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']}
                                                    onSelect={v => setEditForm({ ...editForm, bloodGroup: v })}
                                                />
                                            </View>
                                        </View>
                                        <View>
                                            <Text style={styles.label}>Date of Birth</Text>
                                            <DatePickerInput
                                                value={editForm.dob}
                                                onChange={t => setEditForm({ ...editForm, dob: t })}
                                                placeholder="YYYY-MM-DD"
                                                title="Date of Birth"
                                            />
                                        </View>
                                        <View>
                                            <Text style={styles.label}>Address</Text>
                                            <TextInput style={styles.input} value={editForm.address} onChangeText={t => setEditForm({ ...editForm, address: t })} placeholder="Address" />
                                        </View>
                                        <View>
                                            <Text style={styles.label}>Known Allergies</Text>
                                            <TextInput style={styles.input} value={editForm.allergies} onChangeText={t => setEditForm({ ...editForm, allergies: t })} placeholder="e.g. Penicillin, Peanuts" />
                                        </View>
                                        <View>
                                            <Text style={styles.label}>Chronic Conditions / History</Text>
                                            <TextInput style={styles.input} value={editForm.chronicConditions} onChangeText={t => setEditForm({ ...editForm, chronicConditions: t })} placeholder="e.g. Diabetes, Hypertension" />
                                        </View>
                                        <View>
                                            <Text style={styles.label}>Medical Notes</Text>
                                            <TextInput style={styles.input} value={editForm.medicalNotes} onChangeText={t => setEditForm({ ...editForm, medicalNotes: t })} placeholder="Internal medical notes" />
                                        </View>

                                        {/* Emergency Contacts */}
                                        <View style={{ marginTop: 8 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <Text style={{ fontWeight: '700', fontSize: 12, color: '#374151' }}>👨‍👩‍👧 Emergency Contacts</Text>
                                                <TouchableOpacity
                                                    style={[styles.btnSecondary, { paddingVertical: 3, paddingHorizontal: 10, backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}
                                                    onPress={() => setEditForm({ ...editForm, relatives: [...editForm.relatives, { name: '', relation: '', phone: '' }] })}
                                                >
                                                    <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: 'bold' }}>+ Add</Text>
                                                </TouchableOpacity>
                                            </View>
                                            {editForm.relatives.map((rel, idx) => (
                                                <View key={idx} style={{ padding: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, marginBottom: 6 }}>
                                                    <TextInput style={[styles.input, { marginBottom: 4 }]} placeholder="Contact Name" value={rel.name} onChangeText={t => { const r = [...editForm.relatives]; r[idx].name = t; setEditForm({ ...editForm, relatives: r }); }} />
                                                    <TextInput style={[styles.input, { marginBottom: 4 }]} placeholder="Relation e.g. Spouse / Brother" value={rel.relation} onChangeText={t => { const r = [...editForm.relatives]; r[idx].relation = t; setEditForm({ ...editForm, relatives: r }); }} />
                                                    <TextInput style={[styles.input, { marginBottom: 4 }]} keyboardType="phone-pad" placeholder="Phone" maxLength={10} value={rel.phone} onChangeText={t => { const r = [...editForm.relatives]; r[idx].phone = t.replace(/\D/g, '').slice(0, 10); setEditForm({ ...editForm, relatives: r }); }} />
                                                    <TouchableOpacity style={{ alignSelf: 'flex-end', padding: 4 }} onPress={() => setEditForm({ ...editForm, relatives: editForm.relatives.filter((_, i) => i !== idx) })}>
                                                        <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: 'bold' }}>Remove</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </ScrollView>

                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, borderTopWidth: 1, borderColor: '#e2e8f0', paddingTop: 12, marginTop: 10 }}>
                                    <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowEditModal(false)}>
                                        <Text style={styles.btnSecondaryText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveEdit} disabled={savingEdit}>
                                        <Text style={styles.btnPrimaryText}>{savingEdit ? 'Saving…' : 'Save Changes'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                )}
            </ScrollView>
        );
    }

    // ── All Patients View & Register Sub-Tabs ──
    return (
        <ScrollView style={{ flex: 1 }}>
            {/* Sub-Tabs Bar */}
            <View style={styles.subTabs}>
                <TouchableOpacity
                    style={[styles.subTab, tab === 'list' && styles.subTabActive]}
                    onPress={() => setTab('list')}
                >
                    <Text style={[styles.subTabText, tab === 'list' && styles.subTabTextActive]}>
                        👥 All Patients ({patients.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.subTab, tab === 'register' && styles.subTabActive]}
                    onPress={() => setTab('register')}
                >
                    <Text style={[styles.subTabText, tab === 'register' && styles.subTabTextActive]}>
                        + Register New
                    </Text>
                </TouchableOpacity>
            </View>

            {msg.text ? (
                <View style={{ padding: 10, borderRadius: 8, backgroundColor: msg.type === 'error' ? '#fee2e2' : '#ecfdf5', marginBottom: 12 }}>
                    <Text style={{ color: msg.type === 'error' ? '#dc2626' : '#065f46', fontWeight: 'bold', fontSize: 12 }}>{msg.text}</Text>
                </View>
            ) : null}

            {/* TAB: LIST */}
            {tab === 'list' && (
                <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="Search by name, phone, patient ID, or Aadhaar..."
                            value={search}
                            onChangeText={setSearch}
                            onSubmitEditing={handleSearch}
                        />
                        <TouchableOpacity
                            style={[styles.btnSecondary, { paddingHorizontal: 16, justifyContent: 'center' }]}
                            onPress={handleSearch}
                            disabled={searching}
                        >
                            <Text style={styles.btnSecondaryText}>{searching ? '...' : '🔍 Search'}</Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <Spinner text="Loading patients..." />
                    ) : patients.length === 0 ? (
                        <Empty text="No patients yet. Register your first patient." />
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                            <View style={{ minWidth: 650 }}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { width: 110 }]}>Patient ID</Text>
                                    <Text style={[styles.th, { width: 180 }]}>Name</Text>
                                    <Text style={[styles.th, { width: 120 }]}>Phone</Text>
                                    <Text style={[styles.th, { width: 80 }]}>Gender</Text>
                                    <Text style={[styles.th, { width: 110 }]}>Registered</Text>
                                    <Text style={[styles.th, { width: 90, textAlign: 'center' }]}>Action</Text>
                                </View>
                                {patients.map(p => (
                                    <TouchableOpacity
                                        key={p._id}
                                        style={styles.tableRow}
                                        onPress={() => openHistory(p)}
                                    >
                                        <View style={{ width: 110 }}>
                                            <View style={{ backgroundColor: '#eef2ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' }}>
                                                <Text style={{ color: '#6366f1', fontWeight: 'bold', fontSize: 11 }}>{p.patientUid}</Text>
                                            </View>
                                        </View>
                                        <View style={{ width: 180, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center' }}>
                                                <Text style={{ color: '#6366f1', fontWeight: 'bold', fontSize: 12 }}>{p.name?.charAt(0)?.toUpperCase()}</Text>
                                            </View>
                                            <Text style={{ fontWeight: 'bold', color: '#1e293b', fontSize: 13, flex: 1 }} numberOfLines={1}>{p.name}</Text>
                                        </View>
                                        <Text style={{ width: 120, fontSize: 13, color: '#475569' }}>{p.phone || '—'}</Text>
                                        <Text style={{ width: 80, fontSize: 13, color: '#475569' }}>{p.gender || '—'}</Text>
                                        <Text style={{ width: 110, fontSize: 12, color: '#94a3b8' }}>{fmtDate(p.createdAt)}</Text>
                                        <View style={{ width: 90, alignItems: 'center' }}>
                                            <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#6366f1' }}>View →</Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    )}
                </View>
            )}

            {/* TAB: REGISTER */}
            {tab === 'register' && (
                <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                    {justRegistered ? (
                        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                            <Text style={{ fontSize: 48, marginBottom: 8 }}>✅</Text>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>Patient Registered!</Text>
                            <Text style={{ color: '#64748b', marginBottom: 20, textAlign: 'center' }}>
                                <Text style={{ fontWeight: 'bold' }}>{justRegistered.name}</Text> · <Text style={{ backgroundColor: '#eef2ff', color: '#6366f1', fontWeight: 'bold' }}> {justRegistered.patientUid} </Text> · {justRegistered.phone}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                                <TouchableOpacity style={styles.btnPrimary} onPress={() => onBookToken(justRegistered)}>
                                    <Text style={styles.btnPrimaryText}>🎟️ Book Token Now</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btnSecondary, { borderColor: '#16a34a' }]} onPress={() => printRegistrationSlip(justRegistered)}>
                                    <Text style={[styles.btnSecondaryText, { color: '#16a34a' }]}>🖨️ Print Slip</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.btnSecondary} onPress={() => setJustRegistered(null)}>
                                    <Text style={styles.btnSecondaryText}>+ Register Another</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.btnSecondary} onPress={() => { setJustRegistered(null); setTab('list'); }}>
                                    <Text style={styles.btnSecondaryText}>View All Patients</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={{ paddingBottom: 120 }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>👤 Register New Patient</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 }}>
                                <View style={{ width: isMobile ? "100%" : "48.5%" }}>
                                    <Text style={styles.label}>Full Name *</Text>
                                    <TextInput style={styles.input} placeholder="Patient's full name" value={form.name} onChangeText={t => setForm({ ...form, name: t })} maxLength={50} />
                                </View>
                                <View style={{ width: isMobile ? "100%" : "48.5%" }}>
                                    <Text style={styles.label}>Phone *</Text>
                                    <TextInput style={styles.input} keyboardType="phone-pad" placeholder="10-digit mobile number" maxLength={10} value={form.phone} onChangeText={t => setForm({ ...form, phone: t.replace(/\D/g, '').slice(0, 10) })} />
                                </View>
                                <View style={{ width: isMobile ? "100%" : "48.5%" }}>
                                    <Text style={styles.label}>Age *</Text>
                                    <TextInput style={styles.input} keyboardType="numeric" placeholder="Age" maxLength={3} value={form.age} onChangeText={t => setForm({ ...form, age: t.replace(/\D/g, '').slice(0, 3) })} />
                                </View>
                                <View style={{ width: isMobile ? "100%" : "48.5%" }}>
                                    <Text style={styles.label}>Aadhaar Number *</Text>
                                    <TextInput style={styles.input} keyboardType="numeric" placeholder="12-digit Aadhaar" maxLength={12} value={form.aadhaarNumber} onChangeText={t => setForm({ ...form, aadhaarNumber: t.replace(/\D/g, '').slice(0, 12) })} />
                                </View>
                                <View style={{ width: isMobile ? "100%" : "48.5%" }}>
                                    <Text style={styles.label}>Email *</Text>
                                    <TextInput style={styles.input} keyboardType="email-address" placeholder="Enter Email" value={form.email} onChangeText={t => setForm({ ...form, email: t })} />
                                </View>
                                <View style={{ width: isMobile ? "100%" : "48.5%" }}>
                                    <Text style={styles.label}>Date of Birth *</Text>
                                    <DatePickerInput
                                        value={form.dob}
                                        onChange={t => setForm({ ...form, dob: t })}
                                        placeholder="YYYY-MM-DD"
                                        title="Date of Birth"
                                    />
                                </View>
                                <View style={{ width: isMobile ? "100%" : "48.5%", zIndex: 100 }}>
                                    <Text style={styles.label}>Gender *</Text>
                                    <CustomSelectDropdown
                                        value={form.gender}
                                        placeholder="Select Gender"
                                        options={['Male', 'Female', 'Other']}
                                        onSelect={v => setForm({ ...form, gender: v })}
                                    />
                                </View>
                                <View style={{ width: isMobile ? "100%" : "48.5%", zIndex: 99 }}>
                                    <Text style={styles.label}>Blood Group</Text>
                                    <CustomSelectDropdown
                                        value={form.bloodGroup}
                                        placeholder="Select Blood Group"
                                        options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']}
                                        onSelect={v => setForm({ ...form, bloodGroup: v })}
                                    />
                                </View>
                                {/* Address / City / State / Pincode Grouped Row (1:1 Web Parity) */}
                                <View style={{ width: "100%", marginTop: 4 }}>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                        <View style={{ flex: isMobile ? undefined : 2, width: isMobile ? "100%" : undefined, minWidth: isMobile ? "100%" : 180 }}>
                                            <Text style={styles.label}>Address *</Text>
                                            <TextInput style={styles.input} placeholder="Enter Address" value={form.address} onChangeText={t => setForm({ ...form, address: t })} maxLength={50} />
                                        </View>
                                        <View style={{ flex: isMobile ? undefined : 1, width: isMobile ? "47%" : undefined, minWidth: isMobile ? "47%" : 120 }}>
                                            <Text style={styles.label}>City *</Text>
                                            <TextInput style={styles.input} placeholder="Enter City" value={form.city} onChangeText={t => setForm({ ...form, city: t.replace(/[0-9]/g, '') })} maxLength={20} />
                                        </View>
                                        <View style={{ flex: isMobile ? undefined : 1, width: isMobile ? "47%" : undefined, minWidth: isMobile ? "47%" : 120 }}>
                                            <Text style={styles.label}>State *</Text>
                                            <TextInput style={styles.input} placeholder="Enter State" value={form.state} onChangeText={t => setForm({ ...form, state: t.replace(/[0-9]/g, '') })} maxLength={15} />
                                        </View>
                                        <View style={{ flex: isMobile ? undefined : 1, width: isMobile ? "100%" : undefined, minWidth: isMobile ? "100%" : 100 }}>
                                            <Text style={styles.label}>Pincode</Text>
                                            <TextInput style={styles.input} keyboardType="numeric" placeholder="Enter Pincode" value={form.pincode} onChangeText={t => setForm({ ...form, pincode: t.replace(/\D/g, '') })} maxLength={6} />
                                        </View>
                                    </View>
                                </View>
                                {/* Known Allergies (Full Width 1:1 Web Parity) */}
                                <View style={{ width: "100%" }}>
                                    <Text style={styles.label}>Known Allergies</Text>
                                    <TextInput style={styles.input} placeholder="e.g. Penicillin, Dust (optional)" value={form.allergies} onChangeText={t => setForm({ ...form, allergies: t })} maxLength={100} />
                                </View>
                                {/* Chronic Conditions (Full Width 1:1 Web Parity) */}
                                <View style={{ width: "100%" }}>
                                    <Text style={styles.label}>Chronic Conditions</Text>
                                    <TextInput style={styles.input} placeholder="e.g. Diabetes, Hypertension (optional)" value={form.chronicConditions} onChangeText={t => setForm({ ...form, chronicConditions: t })} maxLength={100} />
                                </View>

                                <View style={{ width: "100%", marginTop: 8 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                        <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#374151' }}>👨‍👩‍👧 Relatives / Emergency Contacts</Text>
                                        <TouchableOpacity style={[styles.btnSecondary, { paddingVertical: 4, paddingHorizontal: 12, backgroundColor: '#f0fdf4', borderColor: '#86efac' }]} onPress={() => setForm(f => ({ ...f, relatives: [...f.relatives, { name: '', relation: '', phone: '' }] }))}>
                                            <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: 'bold' }}>+ Add Contact</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {form.relatives.length === 0 ? (
                                        <View style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#e2e8f0' }}>
                                            <Text style={{ fontSize: 12, color: '#94a3b8' }}>No contacts added. Click "+ Add Contact" to add a relative or emergency contact.</Text>
                                        </View>
                                    ) : (
                                        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                            <View style={{ width: '100%', minWidth: isNarrow ? 480 : '100%', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'visible' }}>
                                                {/* Relatives Table Header */}
                                                <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderColor: '#e2e8f0', paddingVertical: 8, paddingHorizontal: 10 }}>
                                                    <Text style={{ flex: 1.2, fontWeight: '700', fontSize: 13, color: '#374151' }}>Name</Text>
                                                    <Text style={{ flex: 1, fontWeight: '700', fontSize: 13, color: '#374151' }}>Relation</Text>
                                                    <Text style={{ flex: 1, fontWeight: '700', fontSize: 13, color: '#374151' }}>Phone</Text>
                                                    <View style={{ width: 40, alignItems: 'center' }} />
                                                </View>
                                                {/* Relatives Table Rows */}
                                                {form.relatives.map((rel, idx) => (
                                                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: '#f1f5f9', backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc', gap: 8, zIndex: 100 - idx }}>
                                                        <View style={{ flex: 1.2 }}>
                                                            <TextInput
                                                                value={rel.name}
                                                                onChangeText={t => { const r = [...form.relatives]; r[idx] = { ...r[idx], name: t }; setForm({ ...form, relatives: r }); }}
                                                                placeholder="e.g. Ramesh Kumar"
                                                                placeholderTextColor="#94a3b8"
                                                                style={{ width: '100%', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 5, paddingVertical: 5, paddingHorizontal: 7, fontSize: 12, backgroundColor: '#fff', color: '#1e293b' }}
                                                            />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <TableDropdown
                                                                value={rel.relation}
                                                                placeholder="Select..."
                                                                options={['Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Brother', 'Sister', 'Guardian', 'Friend', 'Other']}
                                                                onSelect={rVal => { const r = [...form.relatives]; r[idx] = { ...r[idx], relation: rVal }; setForm({ ...form, relatives: r }); }}
                                                            />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <TextInput
                                                                value={rel.phone}
                                                                keyboardType="phone-pad"
                                                                placeholder="10-digit number"
                                                                placeholderTextColor="#94a3b8"
                                                                maxLength={10}
                                                                onChangeText={t => { const r = [...form.relatives]; r[idx] = { ...r[idx], phone: t.replace(/\D/g, '').slice(0, 10) }; setForm({ ...form, relatives: r }); }}
                                                                style={{ width: '100%', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 5, paddingVertical: 5, paddingHorizontal: 7, fontSize: 12, backgroundColor: '#fff', color: '#1e293b' }}
                                                            />
                                                        </View>
                                                        <View style={{ width: 40, alignItems: 'center' }}>
                                                            <TouchableOpacity
                                                                onPress={() => setForm(f => ({ ...f, relatives: f.relatives.filter((_, i) => i !== idx) }))}
                                                                style={{ backgroundColor: '#fee2e2', borderRadius: 4, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
                                                            >
                                                                <Text style={{ color: '#dc2626', fontSize: 14, fontWeight: 'bold' }}>×</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        </ScrollView>
                                    )}
                                </View>

                                <TouchableOpacity style={[styles.btnPrimary, { width: "100%", marginTop: 16 }]} onPress={handleRegister} disabled={saving}>
                                    <Text style={styles.btnPrimaryText}>{saving ? 'Registering...' : '✅ Register Patient'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            )}
        </ScrollView>
    );
};

// ═══════════════════════════════════════════════════
// BookTokenForm
// ═══════════════════════════════════════════════════
const BookTokenForm = ({ patient, onBook, onCancel, flash, mode = 'token', defaultFee = 0, defaultServiceName = 'General Consultation', setPendingDownload }) => {
    const { width: screenWidth, isNarrow, isMobile } = useResponsive();
    const isSlotMode = mode === 'slot';

    const getTodayString = () => {
        const d = new Date();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${month}-${day}`;
    };

    const [form, setForm] = useState({
        amount: defaultFee > 0 ? String(defaultFee) : '',
        serviceName: defaultServiceName,
        notes: '',
        appointmentDate: getTodayString(),
        appointmentTime: '',
        paymentMethod: 'Cash',
        upiScreenshot: null,
        cardRef: ''
    });
    const [booking, setBooking] = useState(false);
    const [feeWaived, setFeeWaived] = useState(false);
    const [waiverMessage, setWaiverMessage] = useState('');
    const [bookedSlots, setBookedSlots] = useState([]);

    useEffect(() => {
        if (!patient?._id) return;
        clinicAPI.checkFeeWaiver(patient._id, form.appointmentDate)
            .then(r => {
                if (r.success && r.waived) {
                    setFeeWaived(true);
                    setWaiverMessage(r.message || 'Registration fee waived');
                    setForm(f => ({ ...f, amount: '0', paymentMethod: 'Free' }));
                } else {
                    setFeeWaived(false);
                    setWaiverMessage('');
                    setForm(prev => ({ ...prev, amount: String(defaultFee || 0), paymentMethod: 'Cash' }));
                }
            })
            .catch(console.error);
    }, [patient, form.appointmentDate, defaultFee]);

    useEffect(() => {
        const dateStr = form.appointmentDate || getTodayString();
        clinicAPI.getAppointments(dateStr)
            .then(r => {
                if (r.success) {
                    const booked = r.appointments.filter(a => a.status !== 'cancelled' && a.appointmentTime).map(a => a.appointmentTime);
                    setBookedSlots(booked);
                }
            })
            .catch(console.error);
    }, [form.appointmentDate]);

    const isSlotDisabled = (time) => {
        if (bookedSlots.includes(time)) return true;
        const selectedDate = form.appointmentDate || getTodayString();
        const todayDate = getTodayString();
        if (selectedDate === todayDate) {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const [sh, sm] = time.split(':').map(Number);
            if (sh < currentHour || (sh === currentHour && sm <= currentMinute)) {
                return true;
            }
        }
        return false;
    };

    const fee = Number(form.amount) || 0;
    const isUpi = form.paymentMethod === 'UPI';
    const isCard = form.paymentMethod === 'Card';
    const canSubmit = !booking && (fee === 0 || form.paymentMethod) && form.appointmentDate && (!isSlotMode || form.appointmentTime);

    const submit = async () => {
        if (!form.appointmentDate) { flash('error', 'Please select an appointment date'); return; }
        if (isSlotMode && !form.appointmentTime) { flash('error', 'Please select an appointment time'); return; }
        if (fee > 0 && !form.paymentMethod) { flash('error', 'Select a payment method to collect the fee'); return; }
        setBooking(true);
        try {
            let upiScreenshotUrl = null;
            if (isUpi && form.upiScreenshot) {
                const fd = new FormData();
                if (Platform.OS === 'web' && form.upiScreenshot.file) {
                    fd.append('images', form.upiScreenshot.file);
                } else {
                    fd.append('images', {
                        uri: form.upiScreenshot.uri,
                        name: form.upiScreenshot.name || 'screenshot.jpg',
                        type: form.upiScreenshot.mimeType || 'image/jpeg',
                    });
                }
                try {
                    const ur = await uploadAPI.uploadImages(fd);
                    if (ur.success && ur.urls?.length) upiScreenshotUrl = ur.urls[0];
                } catch (_) { /* screenshot upload is optional; proceed without it */ }
            }

            const payload = {
                patientId: patient._id,
                amount: fee,
                serviceName: form.serviceName,
                notes: form.notes,
                paymentMethod: fee > 0 ? form.paymentMethod : 'Free',
                appointmentDate: form.appointmentDate || getTodayString(),
                ...(isSlotMode && { appointmentTime: form.appointmentTime }),
                ...(form.cardRef && { cardRef: form.cardRef }),
                ...(upiScreenshotUrl && { upiScreenshotUrl }),
            };
            const r = await clinicAPI.bookAppointment(payload);
            if (r.success) {
                if (isSlotMode) {
                    flash('success', `✅ Payment collected. Appointment at ${form.appointmentTime} confirmed for ${patient.name}`);
                } else {
                    flash('success', `✅ Payment collected. Token #${r.appointment.tokenNumber} assigned to ${patient.name}`);
                }
                printTokenReceipt(patient, r.appointment);
                onBook();
            } else flash('error', r.message);
        } catch (e) { flash('error', e.response?.data?.message || e.message); }
        finally { setBooking(false); }
    };

    const timeSlots = [];
    for (let h = 7; h <= 20; h++) {
        timeSlots.push(`${String(h).padStart(2, '0')}:00`);
        if (h < 20) timeSlots.push(`${String(h).padStart(2, '0')}:30`);
    }

    const borderColor = isSlotMode ? '#bfdbfe' : '#bbf7d0';
    const bgColor = isSlotMode ? '#eff6ff' : '#f0fdf4';

    return (
        <View style={{ backgroundColor: bgColor, borderWidth: 1, borderColor: borderColor, borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, marginTop: 8 }}>
            <View style={{ backgroundColor: '#e0f2fe', borderColor: '#bae6fd', borderWidth: 1, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                <Text>💰 </Text>
                <Text style={{ fontSize: 12, color: '#0369a1', flexShrink: 1 }}>
                    <Text style={{ fontWeight: 'bold' }}>Payment is collected upfront.</Text> Token / appointment is confirmed only after fee is paid.
                </Text>
            </View>

            {feeWaived && (
                <View style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1.5, borderRadius: 6, padding: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                    <Text>🎁 </Text>
                    <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: 'bold' }}>{waiverMessage}</Text>
                </View>
            )}

            <View style={{ gap: 10 }}>
                <View>
                    <Text style={styles.label}>Service</Text>
                    <TextInput style={[styles.input, { backgroundColor: '#f1f5f9', color: '#94a3b8' }]} value={form.serviceName} editable={false} />
                </View>

                <View>
                    <Text style={styles.label}>Date *</Text>
                    <DatePickerInput
                        value={form.appointmentDate}
                        onChange={t => setForm({ ...form, appointmentDate: t, appointmentTime: '' })}
                        placeholder="YYYY-MM-DD"
                        title="Appointment Date"
                    />
                </View>

                {isSlotMode && (
                    <View>
                        <Text style={styles.label}>Time Slot *</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker selectedValue={form.appointmentTime} onValueChange={v => setForm({ ...form, appointmentTime: v })}>
                                <Picker.Item label="Select time…" value="" />
                                {timeSlots.map(t => {
                                    const disabled = isSlotDisabled(t);
                                    return <Picker.Item key={t} label={`${t} ${disabled ? '(Unavailable)' : ''}`} value={t} color={disabled ? '#94a3b8' : '#000'} />
                                })}
                            </Picker>
                        </View>
                    </View>
                )}

                <View>
                    <Text style={styles.label}>Fee (₹) *</Text>
                    <TextInput style={[styles.input, { backgroundColor: '#f1f5f9', color: '#94a3b8' }]} value={form.amount} editable={false} />
                </View>

                <View>
                    <Text style={[styles.label, { color: fee > 0 ? '#dc2626' : '#64748b', fontWeight: fee > 0 ? 'bold' : 'normal' }]}>Payment Method {fee > 0 ? '*' : ''}</Text>
                    <View style={[styles.pickerWrapper, { borderColor: fee > 0 && !form.paymentMethod ? '#dc2626' : '#e2e8f0', backgroundColor: feeWaived ? '#f1f5f9' : '#fff' }]}>
                        <Picker selectedValue={form.paymentMethod} enabled={!feeWaived} onValueChange={v => setForm({ ...form, paymentMethod: v, upiScreenshot: null, cardRef: '' })}>
                            <Picker.Item label="Cash" value="Cash" />
                            <Picker.Item label="UPI" value="UPI" />
                            <Picker.Item label="Card" value="Card" />
                            {feeWaived && <Picker.Item label="Free" value="Free" />}
                        </Picker>
                    </View>
                </View>

                {fee > 0 && isCard && (
                    <View>
                        <Text style={styles.label}>Card Last 4 / Reference</Text>
                        <TextInput style={styles.input} placeholder="e.g. 4242" value={form.cardRef} onChangeText={t => setForm({ ...form, cardRef: t })} maxLength={20} />
                    </View>
                )}

                {fee > 0 && isUpi && (
                    <View style={{ marginTop: 4 }}>
                        <Text style={styles.label}>Payment Screenshot (Optional)</Text>
                        <TouchableOpacity
                            style={[styles.btnSecondary, { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}
                            onPress={async () => {
                                try {
                                    const res = await DocumentPicker.getDocumentAsync({
                                        type: 'image/*',
                                        copyToCacheDirectory: true,
                                    });
                                    if (!res.canceled && res.assets?.length) {
                                        setForm(f => ({ ...f, upiScreenshot: res.assets[0] }));
                                    }
                                } catch (e) {
                                    console.warn(e);
                                }
                            }}
                        >
                            <Ionicons name="cloud-upload-outline" size={16} color="#16a34a" />
                            <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: 'bold' }}>
                                {form.upiScreenshot ? 'Change Screenshot' : '📎 Upload UPI Screenshot'}
                            </Text>
                        </TouchableOpacity>
                        {form.upiScreenshot && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: '600' }}>
                                    ✓ {form.upiScreenshot.name}
                                </Text>
                                <TouchableOpacity onPress={() => setForm(f => ({ ...f, upiScreenshot: null }))}>
                                    <Text style={{ fontSize: 11, color: '#dc2626', fontWeight: 'bold' }}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity style={[styles.btnPrimary, { opacity: canSubmit ? 1 : 0.6, flexGrow: 1 }]} disabled={!canSubmit} onPress={submit}>
                        <Text style={[styles.btnPrimaryText, { textAlign: 'center' }]}>{booking ? '...' : isSlotMode ? `💰 Pay${fee > 0 ? ` ₹${fee}` : ''} & Book Slot` : `💰 Pay${fee > 0 ? ` ₹${fee}` : ''} & Assign Token`}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnSecondary, { paddingHorizontal: 16, flexGrow: isNarrow ? 1 : 0 }]} onPress={onCancel}>
                        <Text style={[styles.btnSecondaryText, { textAlign: 'center' }]}>✕ Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

// ═══════════════════════════════════════════════════
// RECEPTION MODE
// ═══════════════════════════════════════════════════
const ReceptionMode = ({ preselectedPatient, clearPreselected, setPendingDownload }) => {
    const { width: screenWidth, isNarrow, isMobile } = useResponsive();
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [assigningFor, setAssigningFor] = useState(preselectedPatient?._id || null);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [appointmentMode, setAppointmentMode] = useState('token');
    const [defaultFee, setDefaultFee] = useState(0);
    const [defaultServiceName, setDefaultServiceName] = useState('General Consultation');
    const [showQuickReg, setShowQuickReg] = useState(false);
    const [qrForm, setQrForm] = useState({ name: '', phone: '', email: '', age: '', gender: 'Male' });
    const [qrSaving, setQrSaving] = useState(false);

    const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000); };
    const today = todayStr();
    const isSlotMode = appointmentMode === 'slot';

    // G5 fix: loadAll deps match Web [today] only — NOT [today, search].
    // search changes are handled by a separate 200ms debounced useEffect (patients-only).
    const loadAll = useCallback(() => {
        setLoading(true);
        console.log('[ClinicDashboard][reception] START');
        Promise.allSettled([
            clinicAPI.getPatients(search),
            clinicAPI.getAppointments(today),
        ]).then(([pr, ar]) => {
            if (pr.status === 'fulfilled' && pr.value?.success) {
                const pList = pr.value.patients || [];
                console.log('[ClinicDashboard][receptionPatients] STATUS', 200);
                console.log('[ClinicDashboard][receptionPatients] DATA_KEYS', Object.keys(pList[0] || {}));
                setPatients(pList);
                console.log('[ClinicDashboard][receptionPatients] SET_STATE');
            } else if (pr.status === 'rejected') {
                const err = pr.reason;
                const status = err?.response?.status || 'FAIL';
                const message = err?.response?.data?.message || err?.message;
                console.log('[ClinicDashboard][receptionPatients] ERROR', { status, message });
            }

            if (ar.status === 'fulfilled' && ar.value?.success) {
                const aList = ar.value.appointments || [];
                console.log('[ClinicDashboard][receptionAppointments] STATUS', 200);
                console.log('[ClinicDashboard][receptionAppointments] DATA_KEYS', Object.keys(aList[0] || {}));
                setAppointments(aList);
                console.log('[ClinicDashboard][receptionAppointments] SET_STATE');
            } else if (ar.status === 'rejected') {
                const err = ar.reason;
                const status = err?.response?.status || 'FAIL';
                const message = err?.response?.data?.message || err?.message;
                console.log('[ClinicDashboard][receptionAppointments] ERROR', { status, message });
            }
        }).catch(err => {
            console.log('[ClinicDashboard][reception] ERROR', {
                status: err?.response?.status,
                message: err?.response?.data?.message || err?.message
            });
        }).finally(() => setLoading(false));
    }, [today, search]);

    useEffect(() => {
        clinicAPI.getConfig().then(r => {
            if (r.success) {
                setAppointmentMode(r.appointmentMode || 'token');
                setDefaultFee(r.defaultFee ?? 0);
                setDefaultServiceName(r.defaultServiceName || 'General Consultation');
            }
        }).catch(() => { });
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    useEffect(() => {
        if (preselectedPatient) setAssigningFor(preselectedPatient._id);
    }, [preselectedPatient]);

    // G5 fix: Debounced search (200ms) re-fetches patients only — matches Web L2186-2194.
    // Does NOT re-fetch appointments on every keystroke.
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearching(true);
            clinicAPI.getPatients(search)
                .then(r => { if (r.success) setPatients(r.patients); })
                .finally(() => setSearching(false));
        }, 200);
        return () => clearTimeout(timer);
    }, [search]);

    const handleSearch = () => {
        setSearching(true);
        clinicAPI.getPatients(search).then(r => { if (r.success) setPatients(r.patients); }).finally(() => setSearching(false));
    };

    const handleQuickRegister = async () => {
        setQrSaving(true);
        try {
            const r = await clinicAPI.registerPatient(qrForm);
            if (r.success) {
                // Post-quick-register server refresh: re-fetch patients by phone (matches Web behavior)
                let refreshedList = null;
                try {
                    const sr = await clinicAPI.getPatients(qrForm.phone || '');
                    if (sr.success) refreshedList = sr.patients;
                } catch (_) {}
                setPatients(prev => {
                    if (refreshedList) return refreshedList;
                    return r.existing ? prev : [r.patient, ...prev];
                });
                setAssigningFor(r.patient._id);
                setShowQuickReg(false);
                setQrForm({ name: '', phone: '', email: '', age: '', gender: 'Male' });
                if (clearPreselected) clearPreselected();
                const actionWord = isSlotMode ? 'book an appointment below.' : 'assign a token below.';
                flash('success', `${r.existing ? 'Found' : 'Registered'}: ${r.patient.patientUid} — ${actionWord}`);
            } else flash('error', r.message);
        } catch (e) { flash('error', e.response?.data?.message || e.message); }
        finally { setQrSaving(false); }
    };

    const cancelAppt = async (id) => {
        Alert.alert("Confirm Cancel", isSlotMode ? 'Cancel this appointment?' : 'Cancel this token?', [
            { text: "No", style: "cancel" },
            {
                text: "Yes", onPress: async () => {
                    try {
                        await clinicAPI.cancelAppointment(id);
                        setAppointments(prev => prev.map(a => a._id === id ? { ...a, status: 'cancelled' } : a));
                    } catch (e) { flash('error', e.message); }
                }
            }
        ]);
    };

    const todayApptMap = {};
    appointments.forEach(a => {
        const pid = a.clinicPatientId?._id || a.clinicPatientId;
        if (pid) todayApptMap[pid.toString()] = a;
    });

    const activeTokens = appointments.filter(a => a.status === 'confirmed' || a.status === 'pending');
    const doneToday = appointments.filter(a => a.status === 'completed');

    const withToken = patients.filter(p => todayApptMap[p._id] && ['confirmed', 'pending'].includes(todayApptMap[p._id]?.status));
    const withoutToken = patients.filter(p => !todayApptMap[p._id] || !['confirmed', 'pending'].includes(todayApptMap[p._id]?.status));
    const displayList = [...withToken, ...withoutToken];

    return (
        <ScrollView style={{ flex: 1 }}>
            {msg.text ? <View style={{ padding: 10, backgroundColor: msg.type === 'error' ? '#fee2e2' : '#dcfce7', marginBottom: 10, borderRadius: 6 }}><Text style={{ color: msg.type === 'error' ? '#dc2626' : '#16a34a' }}>{msg.text}</Text></View> : null}

            <View style={[styles.clinicCard, { marginBottom: isMobile ? 12 : 14 }, isMobile && styles.cardMobile]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0f172a' }}>
                            📋 Reception — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
                            <Text style={{ color: '#64748b', fontSize: 12 }}>
                                {activeTokens.length} {isSlotMode ? 'scheduled' : 'in queue'} · {doneToday.length} done today · {patients.length} total patients
                            </Text>
                            <View style={{ backgroundColor: isSlotMode ? '#dbeafe' : '#fef3c7', paddingHorizontal: 8, paddingVertical: 1, borderRadius: 10 }}>
                                <Text style={{ color: isSlotMode ? '#1d4ed8' : '#92400e', fontSize: 11, fontWeight: '700' }}>
                                    {isSlotMode ? '🕐 Time Slots' : '🎟️ Tokens'}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.btnSecondary} onPress={loadAll}>
                        <Text style={styles.btnSecondaryText}>↻ Refresh</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TextInput style={[styles.input, { flex: 1 }]} placeholder="Search patient by name, phone, patient ID or Aadhaar..." value={search} onChangeText={setSearch} onSubmitEditing={handleSearch} />
                    <TouchableOpacity style={styles.btnSecondary} onPress={handleSearch} disabled={searching}>
                        <Text>{searching ? '...' : '🔍'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowQuickReg(!showQuickReg)}>
                        <Text style={styles.btnPrimaryText}>+ New Patient</Text>
                    </TouchableOpacity>
                </View>

                {showQuickReg && (
                    <View style={{ marginTop: 12, borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#fafbff' }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 10, color: '#6366f1' }}>Quick Register New Patient</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: isMobile ? 'stretch' : 'flex-end' }}>
                                <View style={{ flex: isMobile ? undefined : 2, width: isMobile ? "100%" : undefined, minWidth: isMobile ? "100%" : 150 }}>
                                <Text style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Full Name *</Text>
                                <TextInput style={styles.input} placeholder="Patient name" value={qrForm.name} onChangeText={t => setQrForm({ ...qrForm, name: t })} />
                            </View>
                            <View style={{ flex: isMobile ? undefined : 1, width: isMobile ? "47%" : undefined, minWidth: isMobile ? "47%" : 130 }}>
                                <Text style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Phone *</Text>
                                <TextInput style={styles.input} keyboardType="phone-pad" placeholder="10-digit number" value={qrForm.phone} maxLength={10} onChangeText={t => setQrForm({ ...qrForm, phone: t.replace(/\D/g, '').slice(0, 10) })} />
                            </View>
                            <View style={{ flex: isMobile ? undefined : 1, width: isMobile ? "47%" : undefined, minWidth: isMobile ? "47%" : 70 }}>
                                <Text style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Age *</Text>
                                <TextInput style={styles.input} keyboardType="numeric" placeholder="Age" value={qrForm.age} maxLength={3} onChangeText={t => setQrForm({ ...qrForm, age: t.replace(/\D/g, '').slice(0, 3) })} />
                            </View>
                            <View style={{ flex: isMobile ? undefined : 1, width: isMobile ? "100%" : undefined, minWidth: isMobile ? "100%" : 130 }}>
                                <Text style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Email *</Text>
                                <TextInput style={styles.input} keyboardType="email-address" placeholder="Email" value={qrForm.email} onChangeText={t => setQrForm({ ...qrForm, email: t })} />
                            </View>
                            <View style={{ flex: isMobile ? undefined : 1, width: isMobile ? "100%" : undefined, minWidth: isMobile ? "100%" : 110 }}>
                                <Text style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Gender</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker selectedValue={qrForm.gender} onValueChange={v => setQrForm({ ...qrForm, gender: v })}>
                                        <Picker.Item label="Male" value="Male" />
                                        <Picker.Item label="Female" value="Female" />
                                        <Picker.Item label="Other" value="Other" />
                                    </Picker>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                <TouchableOpacity style={styles.btnPrimary} onPress={handleQuickRegister} disabled={qrSaving}>
                                    <Text style={styles.btnPrimaryText}>{qrSaving ? '...' : (isSlotMode ? '✅ Register & Book' : '✅ Register & Assign Token')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowQuickReg(false)}>
                                    <Text style={styles.btnSecondaryText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 20 }} />
            ) : displayList.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: '#94a3b8' }}>No patients found. Register your first patient.</Text></View>
            ) : (
                <FlatList
                    data={displayList}
                    keyExtractor={p => p._id}
                    scrollEnabled={false}
                    contentContainerStyle={{ gap: 8 }}
                    renderItem={({ item: p }) => {
                        const appt = todayApptMap[p._id];
                        const hasToken = appt && (appt.status === 'confirmed' || appt.status === 'pending');
                        const isDone = appt && appt.status === 'completed';
                        const isExpanding = assigningFor === p._id;

                        return (
                            <View style={{ borderWidth: 1, borderColor: hasToken ? '#bbf7d0' : '#e2e8f0', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: hasToken ? '#f0fdf4' : isDone ? '#f8fafc' : '#fff' }}>
                                <View style={{ flexDirection: isNarrow ? 'column' : 'row', alignItems: isNarrow ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isNarrow ? 8 : 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                        <View style={styles.clinicAvatarSm}>
                                            <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 14 }}>{p.name?.charAt(0)?.toUpperCase()}</Text>
                                        </View>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text style={{ fontWeight: '700', fontSize: 14, color: '#0f172a' }}>{p.name}</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                                <View style={{ backgroundColor: '#eef2ff', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                                    <Text style={{ color: '#6366f1', fontWeight: '700', fontSize: 11 }}>{p.patientUid}</Text>
                                                </View>
                                                <Text style={{ fontSize: 12, color: '#64748b' }}>{p.phone}{p.gender ? ` · ${p.gender}` : ''}</Text>
                                                {p.bloodGroup ? (
                                                    <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 }}>
                                                        <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '600' }}>🩸 {p.bloodGroup}</Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', alignSelf: isNarrow ? 'flex-start' : 'center' }}>
                                        {hasToken && (
                                            <>
                                                <Text style={{ backgroundColor: isSlotMode ? '#3b82f6' : '#6366f1', color: '#fff', fontWeight: 'bold', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, fontSize: 13 }}>
                                                    {isSlotMode ? `🕐 ${appt.appointmentTime}` : `#${appt.tokenNumber}`}
                                                </Text>
                                                <StatusBadge status={appt.status} />
                                                <TouchableOpacity onPress={() => cancelAppt(appt._id)} style={styles.btnRemove}>
                                                    <Text style={styles.btnRemoveText}>✕</Text>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                        {isDone && <Text style={{ backgroundColor: '#dcfce7', color: '#16a34a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, fontSize: 12, fontWeight: 'bold' }}>✅ Visited Today</Text>}
                                        <TouchableOpacity
                                            style={[styles.btnSecondary, { paddingHorizontal: 8, paddingVertical: 4 }]}
                                            onPress={() => generatePatientProfilePDF(p)}
                                            title="Export Patient Profile PDF"
                                        >
                                            <Text style={{ fontSize: 13 }}>📄</Text>
                                        </TouchableOpacity>
                                        {!hasToken && (
                                            <TouchableOpacity style={styles.btnPrimary} onPress={() => setAssigningFor(isExpanding ? null : p._id)}>
                                                <Text style={styles.btnPrimaryText}>{isExpanding ? '✕ Cancel' : isDone ? '🎟️ Rebook / Assign Token' : isSlotMode ? '🕐 Book Slot' : '🎟️ Assign Token'}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                                {isExpanding && !hasToken && (
                                    <BookTokenForm
                                        patient={p}
                                        mode={appointmentMode}
                                        flash={flash}
                                        defaultFee={defaultFee}
                                        defaultServiceName={defaultServiceName}
                                        setPendingDownload={setPendingDownload}
                                        onBook={() => { setAssigningFor(null); if (clearPreselected) clearPreselected(); loadAll(); }}
                                        onCancel={() => { setAssigningFor(null); if (clearPreselected) clearPreselected(); }}
                                    />
                                )}
                            </View>
                        );
                    }}
                />
            )}
        </ScrollView>
    );
};

// ═══════════════════════════════════════════════════
// MEDICINE TABLE — prescription editor with per-row autocomplete
// ═══════════════════════════════════════════════════
const MedicineTable = ({ rx, setRx, inventory }) => {
    const { width: screenWidth, isMobile } = useResponsive();
    const [activeRow, setActiveRow] = useState(null);
    const [rowSearch, setRowSearch] = useState({});

    const getSuggestions = (idx) => {
        const q = (rowSearch[idx] ?? (rx.medicines[idx]?.name || rx.medicines[idx]?.medicineName) ?? '').trim().toLowerCase();
        if (!q || q.length < 1) return [];
        return inventory.filter(inv => inv.name.toLowerCase().includes(q)).slice(0, 8);
    };

    const selectSuggestion = (idx, med) => {
        setRx(r => {
            const ms = [...r.medicines];
            ms[idx] = { ...ms[idx], name: med.name, medicineName: med.name, saltName: med.saltName || '', dose: med.unit || '' };
            return { ...r, medicines: ms };
        });
        setRowSearch(prev => ({ ...prev, [idx]: med.name }));
        setActiveRow(null);
    };

    const handleNameChange = (idx, value) => {
        setRowSearch(prev => ({ ...prev, [idx]: value }));
        setRx(r => { const ms = [...r.medicines]; ms[idx] = { ...ms[idx], name: value }; return { ...r, medicines: ms }; });
        setActiveRow(idx);
    };

    const handleNameBlur = () => {
        setTimeout(() => setActiveRow(null), 200);
    };

    return (
        <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8 }}>
            {/* Table Header for Tablet/Desktop */}
            {!isMobile && (
                <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#e2e8f0' }}>
                    <Text style={{ flex: 3, paddingHorizontal: 8, fontWeight: '700', color: '#374151', fontSize: 12 }}>Medicine Name</Text>
                    <Text style={{ flex: 2, paddingHorizontal: 8, fontWeight: '700', color: '#374151', fontSize: 12 }}>Salt / Generic</Text>
                    <Text style={{ flex: 2, paddingHorizontal: 8, fontWeight: '700', color: '#374151', fontSize: 12 }}>Dose / Frequency</Text>
                    <Text style={{ flex: 1, paddingHorizontal: 8, fontWeight: '700', color: '#374151', fontSize: 12 }}>Days</Text>
                    <Text style={{ width: 40, paddingHorizontal: 8, fontWeight: '700', color: '#374151', fontSize: 12, textAlign: 'center' }}>X</Text>
                </View>
            )}

            {/* Table Body */}
            {rx.medicines.map((m, idx) => {
                const displayVal = rowSearch[idx] !== undefined ? rowSearch[idx] : (m.name || m.medicineName || '');
                const suggestions = getSuggestions(idx);
                const showDropdown = activeRow === idx && suggestions.length > 0;

                if (isMobile) {
                    // Mobile Card Representation: prevents squeezing columns into 320-430px
                    return (
                        <View key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc', padding: 10, borderBottomWidth: 1, borderColor: '#e2e8f0' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, zIndex: showDropdown ? 100 : 1, position: 'relative' }}>
                                <View style={{ flex: 1, position: 'relative' }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569', marginBottom: 2 }}>Medicine Name *</Text>
                                    <TextInput
                                        value={displayVal}
                                        onChangeText={val => handleNameChange(idx, val)}
                                        onFocus={() => setActiveRow(idx)}
                                        onBlur={handleNameBlur}
                                        placeholder="Search medicine..."
                                        style={[styles.rxInput, showDropdown && { borderColor: '#6366f1' }]}
                                    />
                                    {showDropdown && (
                                        <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#6366f1', borderRadius: 6, zIndex: 999, elevation: 6, maxHeight: 160 }}>
                                            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                {suggestions.map((med, si) => (
                                                    <TouchableOpacity
                                                        key={med._id || si}
                                                        onPress={() => selectSuggestion(idx, med)}
                                                        style={{ padding: 8, borderBottomWidth: si < suggestions.length - 1 ? 1 : 0, borderColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                                    >
                                                        <Text style={{ color: '#6366f1', fontSize: 12 }}>💊</Text>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={{ fontWeight: '600', color: '#1e293b', fontSize: 12 }}>{med.name}</Text>
                                                            {med.category && <Text style={{ fontSize: 10, color: '#94a3b8' }}>{med.category} · {med.unit || ''}</Text>}
                                                        </View>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        setRx(r => ({ ...r, medicines: r.medicines.filter((_, i) => i !== idx) }));
                                        setRowSearch(prev => { const next = { ...prev }; delete next[idx]; return next; });
                                    }}
                                    style={{ backgroundColor: '#fee2e2', width: 34, height: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginTop: 18 }}
                                >
                                    <Text style={{ color: '#dc2626', fontWeight: 'bold', fontSize: 14 }}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                                <View style={{ flex: 3 }}>
                                    <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '600', marginBottom: 2 }}>Salt / Generic</Text>
                                    <TextInput
                                        value={m.saltName || ''}
                                        onChangeText={val => setRx(r => { const ms = [...r.medicines]; ms[idx] = { ...ms[idx], saltName: val }; return { ...r, medicines: ms }; })}
                                        placeholder="Paracetamol"
                                        style={styles.rxInput}
                                    />
                                </View>
                                <View style={{ flex: 2 }}>
                                    <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '600', marginBottom: 2 }}>Dose / Frequency</Text>
                                    <TextInput
                                        value={m.dose || m.dosage || ''}
                                        onChangeText={val => setRx(r => { const ms = [...r.medicines]; ms[idx] = { ...ms[idx], dose: val }; return { ...r, medicines: ms }; })}
                                        placeholder="1 OD"
                                        style={styles.rxInput}
                                    />
                                </View>
                                <View style={{ width: 60 }}>
                                    <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '600', marginBottom: 2 }}>Days</Text>
                                    <TextInput
                                        value={m.days || m.duration || ''}
                                        onChangeText={val => setRx(r => { const ms = [...r.medicines]; ms[idx] = { ...ms[idx], days: val }; return { ...r, medicines: ms }; })}
                                        placeholder="5"
                                        keyboardType="numeric"
                                        style={[styles.rxInput, { textAlign: 'center' }]}
                                    />
                                </View>
                            </View>
                        </View>
                    );
                }

                return (
                    <View key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#f1f5f9', paddingVertical: 6 }}>
                            {/* Medicine Name */}
                            <View style={{ flex: 3, paddingHorizontal: 4, position: 'relative', zIndex: showDropdown ? 10 : 1 }}>
                                <TextInput
                                    value={displayVal}
                                    onChangeText={val => handleNameChange(idx, val)}
                                    onFocus={() => setActiveRow(idx)}
                                    onBlur={handleNameBlur}
                                    placeholder="Search medicine..."
                                    style={[styles.rxInput, showDropdown && { borderColor: '#6366f1' }]}
                                />
                                {showDropdown && (
                                    <View style={{ position: 'absolute', top: '100%', left: 4, right: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: '#6366f1', borderRadius: 6, zIndex: 999, elevation: 5, maxHeight: 150 }}>
                                        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                            {suggestions.map((med, si) => (
                                                <TouchableOpacity
                                                    key={med._id || si}
                                                    onPress={() => selectSuggestion(idx, med)}
                                                    style={{ padding: 8, borderBottomWidth: si < suggestions.length - 1 ? 1 : 0, borderColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                                >
                                                    <Text style={{ color: '#6366f1', fontSize: 12 }}>💊</Text>
                                                    <View>
                                                        <Text style={{ fontWeight: '600', color: '#1e293b', fontSize: 12 }}>{med.name}</Text>
                                                        {med.category && <Text style={{ fontSize: 10, color: '#94a3b8' }}>{med.category} · {med.unit || ''}</Text>}
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>

                            {/* Salt Name */}
                            <View style={{ flex: 2, paddingHorizontal: 4 }}>
                                <TextInput
                                    value={m.saltName || ''}
                                    onChangeText={val => setRx(r => { const ms = [...r.medicines]; ms[idx] = { ...ms[idx], saltName: val }; return { ...r, medicines: ms }; })}
                                    placeholder="e.g. Paracetamol"
                                    style={styles.rxInput}
                                />
                            </View>

                            {/* Dose */}
                            <View style={{ flex: 2, paddingHorizontal: 4 }}>
                                <TextInput
                                    value={m.dose || m.dosage || ''}
                                    onChangeText={val => setRx(r => { const ms = [...r.medicines]; ms[idx] = { ...ms[idx], dose: val }; return { ...r, medicines: ms }; })}
                                    placeholder="e.g. 1 OD"
                                    style={styles.rxInput}
                                />
                            </View>

                            {/* Days */}
                            <View style={{ flex: 1, paddingHorizontal: 4 }}>
                                <TextInput
                                    value={m.days || m.duration || ''}
                                    onChangeText={val => setRx(r => { const ms = [...r.medicines]; ms[idx] = { ...ms[idx], days: val }; return { ...r, medicines: ms }; })}
                                    placeholder="e.g. 5"
                                    keyboardType="numeric"
                                    style={styles.rxInput}
                                />
                            </View>

                            {/* Remove Row */}
                            <View style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}>
                                <TouchableOpacity
                                    onPress={() => {
                                        setRx(r => ({ ...r, medicines: r.medicines.filter((_, i) => i !== idx) }));
                                        setRowSearch(prev => { const next = { ...prev }; delete next[idx]; return next; });
                                    }}
                                    style={{ backgroundColor: '#fee2e2', width: 24, height: 24, borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Text style={{ color: '#dc2626', fontWeight: 'bold' }}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                );
            })}
            {rx.medicines.length === 0 && (
                <View style={{ padding: 16, alignItems: 'center' }}>
                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>No medicines added. Click "+ Add Row" to start prescribing.</Text>
                </View>
            )}
        </View>
    );
};

// ═══════════════════════════════════════════════════
// DOCTOR MODE
// ═══════════════════════════════════════════════════
const DoctorMode = ({ setPendingDownload }) => {
    const { width: screenWidth, isNarrow, isMobile, isTablet, isDesktop } = useResponsive();
    const [tab, setTab] = useState('staff'); // 'staff' | 'queue'
    const [staff, setStaff] = useState([]);
    const [staffLoading, setStaffLoading] = useState(true);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [consulting, setConsulting] = useState(null);
    const [rx, setRx] = useState({ diagnosis: '', notes: '', labTests: '', medicines: [] });
    const [vitals, setVitals] = useState({ weight: '', height: '', bmi: '', bp: '', temperature: '', pulse: '', spo2: '', rr: '' });
    const [showVitals, setShowVitals] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [inventory, setInventory] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [patientHistory, setPatientHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000); };

    const loadToday = () => {
        setLoading(true);
        const dateParam = todayStr();
        console.log('[ClinicDashboard][doctorAppointments] START');
        clinicAPI.getAppointments(dateParam)
            .then(r => {
                if (r.success) {
                    const list = r.appointments || r.data || [];
                    console.log('[ClinicDashboard][doctorAppointments] STATUS', 200);
                    console.log('[ClinicDashboard][doctorAppointments] DATA_KEYS', Object.keys(list[0] || {}));
                    setAppointments(list);
                    console.log('[ClinicDashboard][doctorAppointments] SET_STATE');
                } else {
                    console.log('[ClinicDashboard][doctorAppointments] ERROR', { status: 400, message: r.message });
                }
            })
            .catch(err => {
                const status = err?.response?.status || 'FAIL';
                const message = err?.response?.data?.message || err?.message;
                console.log('[ClinicDashboard][doctorAppointments] ERROR', { status, message });
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        clinicAPI.getStaff().then(r => { if (r.success) setStaff(r.staff || []); }).catch(() => { }).finally(() => setStaffLoading(false));
        loadToday();

        clinicAPI.getInventory()
            .then(invRes => {
                const localList = invRes.success ? (invRes.inventory || []) : [];
                setInventory(localList);
            })
            .catch(() => { });

        clinicAPI.getStats().then(r => { if (r.success) setAnalytics(r.stats); }).catch(() => { });
    }, []);

    const openConsult = (appt) => {
        setConsulting(appt);
        setShowHistory(false);
        setPatientHistory([]);
        setShowVitals(true);
        setRx({
            diagnosis: appt.diagnosis || '',
            notes: appt.doctorNotes || '',
            labTests: (appt.labTests || []).join(', '),
            medicines: appt.pharmacy || [],
        });
        setVitals({
            weight: appt.vitals?.weight || '',
            height: appt.vitals?.height || '',
            bmi: appt.vitals?.bmi || '',
            bp: appt.vitals?.bp || '',
            temperature: appt.vitals?.temperature || '',
            pulse: appt.vitals?.pulse || '',
            spo2: appt.vitals?.spo2 || '',
            rr: appt.vitals?.rr || '',
        });
        if (appt.clinicPatientId?._id) {
            setHistoryLoading(true);
            clinicAPI.getPatientHistory(appt.clinicPatientId._id)
                .then(r => { if (r.success) setPatientHistory(r.appointments || []); })
                .catch(() => { })
                .finally(() => setHistoryLoading(false));
        }
    };

    const handleVitalChange = (field, value) => {
        setVitals(prev => {
            const updated = { ...prev, [field]: value };
            if ((field === 'weight' || field === 'height') && updated.weight && updated.height) {
                const hM = parseFloat(updated.height) / 100;
                if (hM > 0) updated.bmi = (parseFloat(updated.weight) / (hM * hM)).toFixed(1);
            }
            return updated;
        });
    };

    const saveConsult = async () => {
        setSaving(true);
        try {
            const labArr = rx.labTests.split(',').map(t => t.trim()).filter(Boolean);
            const isEditing = consulting.status === 'completed';

            const payload = {
                diagnosis: rx.diagnosis,
                notes: rx.notes,
                vitals,
                medicines: rx.medicines.filter(m => (m.name || m.medicineName)?.trim()).map(m => ({
                    name: (m.name || m.medicineName || '').trim(),
                    saltName: (m.saltName || '').trim(),
                    dose: (m.dose || m.dosage || '').trim(),
                    days: (m.days || m.duration || '').trim(),
                    medicineName: (m.name || m.medicineName || '').trim(),
                    frequency: (m.dose || m.dosage || '').trim(),
                    duration: (m.days || m.duration || '').trim(),
                })),
                labTests: labArr,
            };

            const r = isEditing
                ? await clinicAPI.updateConsultation(consulting._id, payload)
                : await clinicAPI.completeAppointment(consulting._id, payload);

            if (r.success) {
                flash('success', isEditing ? 'Consultation updated successfully.' : 'Consultation saved. Prescription generated.');
                printPrescriptionSlip(consulting, rx, vitals);
                setConsulting(null);
                loadToday();
            } else flash('error', r.message);
        } catch (e) { flash('error', e.response?.data?.message || e.message); }
        finally { setSaving(false); }
    };

    const pending = appointments.filter(a => a.status === 'confirmed' || a.status === 'pending');
    const done = appointments.filter(a => a.status === 'completed');
    const pastVisits = patientHistory.filter(h => h._id !== consulting?._id && h.status === 'completed');

    // FIX B — DOCTOR VITALS: Dynamic repeat(auto-fill, minmax(150px, 1fr)) with gap: 14px
    // Available width inside vitals content area (modeContent padding + vitals content padding)
    const vitalsModePadH = screenWidth < 375 ? 16 : (screenWidth < 600 ? 24 : 32);
    const vitalsContentPadH = 36; // 18px horizontal padding on each side of .clinic-vitals-content
    const vitalsAvailWidth = screenWidth - vitalsModePadH - vitalsContentPadH;
    const vitalsGap = 14;
    const vitalsMinCol = 150;
    // columnCount = largest N where N * 150 + (N - 1) * 14 <= availableWidth
    const vitalsCols = Math.max(1, Math.floor((vitalsAvailWidth + vitalsGap) / (vitalsMinCol + vitalsGap)));
    // cardWidth = (availableWidth - (columnCount - 1) * 14) / columnCount
    const vitalsCardWidth = Math.floor((vitalsAvailWidth - (vitalsCols - 1) * vitalsGap) / vitalsCols);

    if (consulting) return (
        <ScrollView style={styles.container}>
            <TouchableOpacity onPress={() => setConsulting(null)} style={styles.backBtn}>
                <Text style={styles.backBtnText}>← Back to Queue</Text>
            </TouchableOpacity>

            {msg.text ? <View style={[styles.downloadAlert, { borderColor: msg.type === 'error' ? '#fecaca' : '#a7f3d0', backgroundColor: msg.type === 'error' ? '#fef2f2' : '#ecfdf5' }]}><Text style={{ color: msg.type === 'error' ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{msg.text}</Text></View> : null}

            <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                {/* Patient header */}
                <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 12, marginBottom: 16 }}>
                    <View style={styles.clinicAvatarLg}>
                        <Text style={{ color: '#3b82f6', fontSize: 18, fontWeight: '800' }}>{(consulting.clinicPatientId?.name || '?').charAt(0)?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>{consulting.clinicPatientId?.name || 'Patient'}</Text>
                        <Text style={{ fontSize: 13, color: '#64748b' }}>
                            {consulting.clinicPatientId?.patientUid || consulting.patientId} · Token #{consulting.tokenNumber} · {consulting.serviceName || 'General'}
                            {consulting.clinicPatientId?.gender ? ` · ${consulting.clinicPatientId.gender}` : ''}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                            {consulting.clinicPatientId?.bloodGroup && <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}><Text style={{ color: '#dc2626', fontSize: 12, fontWeight: 'bold' }}>🩸 {consulting.clinicPatientId.bloodGroup}</Text></View>}
                            {consulting.clinicPatientId?.allergies && <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}><Text style={{ color: '#92400e', fontSize: 12, fontWeight: 'bold' }}>⚠️ {consulting.clinicPatientId.allergies}</Text></View>}
                        </View>
                        {consulting.notes && <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Chief complaint: {consulting.notes}</Text>}
                        {consulting.clinicPatientId?.relatives?.length > 0 && (
                            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                {consulting.clinicPatientId.relatives.map((rel, i) => (
                                    <View key={i} style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}>
                                        <Text style={{ fontSize: 11, color: '#0369a1' }}>👤 {rel.name}{rel.relation ? ` (${rel.relation})` : ''}{rel.phone ? ` · ${rel.phone}` : ''}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6, alignSelf: 'flex-start', marginTop: 8 }}
                            onPress={() => generatePatientProfilePDF(consulting.clinicPatientId, patientHistory)}
                        >
                            <Text style={{ fontSize: 13 }}>📄</Text>
                            <Text style={{ color: '#4f46e5', fontWeight: '700', fontSize: 11 }}>Profile Summary PDF</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Past Visits */}
                {historyLoading ? (
                    <Text style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>Loading visit history...</Text>
                ) : pastVisits.length > 0 && (
                    <View style={{ marginBottom: 20, borderWidth: 1, borderColor: '#e0e7ff', borderRadius: 10, overflow: 'hidden' }}>
                        <TouchableOpacity
                            onPress={() => setShowHistory(h => !h)}
                            style={{ backgroundColor: '#eef2ff', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#4338ca' }}>📋 Past Visits ({pastVisits.length})</Text>
                            <Text style={{ color: '#4338ca' }}>{showHistory ? '▲' : '▼'}</Text>
                        </TouchableOpacity>
                        {showHistory && (
                            <View style={{ backgroundColor: '#f8faff', padding: 16, gap: 12 }}>
                                {pastVisits.map(v => (
                                    <View key={v._id} style={{ borderLeftWidth: 3, borderLeftColor: '#a5b4fc', paddingLeft: 12, marginBottom: 12 }}>
                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#6366f1' }}>{new Date(v.appointmentDate || v.createdAt).toLocaleDateString('en-IN')}</Text>
                                        {v.vitals && Object.values(v.vitals).some(x => x) && (
                                            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                                                {v.vitals.weight ? <Text style={{ fontSize: 11, color: '#0369a1' }}>Wt: <Text style={{ fontWeight: 'bold' }}>{v.vitals.weight}kg</Text></Text> : null}
                                                {v.vitals.bp ? <Text style={{ fontSize: 11, color: '#0369a1' }}>BP: <Text style={{ fontWeight: 'bold' }}>{v.vitals.bp}</Text></Text> : null}
                                                {v.vitals.temperature ? <Text style={{ fontSize: 11, color: '#0369a1' }}>Temp: <Text style={{ fontWeight: 'bold' }}>{v.vitals.temperature}°F</Text></Text> : null}
                                                {v.vitals.pulse ? <Text style={{ fontSize: 11, color: '#0369a1' }}>Pulse: <Text style={{ fontWeight: 'bold' }}>{v.vitals.pulse}bpm</Text></Text> : null}
                                                {v.vitals.spo2 ? <Text style={{ fontSize: 11, color: '#0369a1' }}>SpO₂: <Text style={{ fontWeight: 'bold' }}>{v.vitals.spo2}%</Text></Text> : null}
                                                {v.vitals.rr ? <Text style={{ fontSize: 11, color: '#0369a1' }}>RR: <Text style={{ fontWeight: 'bold' }}>{v.vitals.rr}/min</Text></Text> : null}
                                            </View>
                                        )}
                                        {v.diagnosis ? <Text style={{ fontSize: 13, color: '#1e293b', marginTop: 4 }}><Text style={{ fontWeight: 'bold' }}>Dx:</Text> {v.diagnosis}</Text> : null}
                                        {v.doctorNotes ? <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }}><Text style={{ fontWeight: 'bold' }}>Notes:</Text> {v.doctorNotes}</Text> : null}
                                        {(v.pharmacy || []).length > 0 && (
                                            <Text style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                                                <Text style={{ fontWeight: 'bold' }}>Rx:</Text> {v.pharmacy.map(m => m.medicineName || m.name).join(', ')}
                                            </Text>
                                        )}
                                        {(v.labTests || []).length > 0 && (
                                            <Text style={{ fontSize: 12, color: '#475569', marginTop: 2 }}><Text style={{ fontWeight: 'bold' }}>Labs:</Text> {v.labTests.join(', ')}</Text>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* Patient Reports — (Placeholder for PatientReportPanel to avoid undefined) */}
                <View style={{ marginBottom: 16 }}>
                    {/* PatientReportPanel component to be defined globally below */}
                    <PatientReportPanel patientId={consulting.clinicPatientId?._id} patientName={consulting.clinicPatientId?.name} />
                </View>

                {/* Vitals Panel (Exact Web .clinic-vitals-container CSS Parity) */}
                <View style={{ borderWidth: 1, borderColor: '#e0f2fe', borderRadius: 12, marginBottom: 24, overflow: 'hidden', backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
                    <TouchableOpacity
                        onPress={() => setShowVitals(v => !v)}
                        style={{ backgroundColor: '#f0f9ff', paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: showVitals ? 1 : 0, borderColor: '#e0f2fe' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0369a1' }}>🩺 Patient Vitals {Object.values(vitals).some(v => v) ? '✓' : ''}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0369a1' }}>{showVitals ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {showVitals && (
                        <View style={{ padding: 18, backgroundColor: '#fff' }}>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                                {[
                                    { label: '⚖️ Weight (kg)', field: 'weight', type: 'numeric', ph: 'e.g. 65' },
                                    { label: '📏 Height (cm)', field: 'height', type: 'numeric', ph: 'e.g. 170' },
                                    { label: '🔢 BMI (auto)', field: 'bmi', readOnly: true, ph: 'Auto' },
                                    { label: '💓 BP (mmHg)', field: 'bp', type: 'default', ph: 'e.g. 120/80' },
                                    { label: '🌡️ Temp (°F)', field: 'temperature', type: 'numeric', ph: 'e.g. 98.6' },
                                    { label: '🫀 Pulse (bpm)', field: 'pulse', type: 'numeric', ph: 'e.g. 72' },
                                    { label: '🫁 SpO₂ (%)', field: 'spo2', type: 'numeric', ph: 'e.g. 98' },
                                    { label: '🌬️ Resp. Rate (/min)', field: 'rr', type: 'numeric', ph: 'e.g. 16' }
                                ].map((vItem, i) => (
                                    <View key={i} style={{ width: vitalsCardWidth, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 5 }}>{vItem.label}</Text>
                                        <TextInput
                                            style={{ width: '100%', borderWidth: 0, backgroundColor: 'transparent', paddingVertical: 4, fontSize: 14, fontWeight: vItem.readOnly && vitals.bmi ? '700' : '600', color: '#0f172a' }}
                                            keyboardType={vItem.type}
                                            placeholder={vItem.ph}
                                            placeholderTextColor="#94a3b8"
                                            value={String(vitals[vItem.field] || '')}
                                            editable={!vItem.readOnly}
                                            onChangeText={text => handleVitalChange(vItem.field, text)}
                                        />
                                        {vItem.field === 'bmi' && vitals.bmi ? (
                                            <View style={{
                                                marginTop: 4,
                                                backgroundColor: parseFloat(vitals.bmi) < 18.5 ? '#fef9c3' : parseFloat(vitals.bmi) < 25 ? '#dcfce7' : parseFloat(vitals.bmi) < 30 ? '#ffedd5' : '#fee2e2',
                                                paddingHorizontal: 6,
                                                paddingVertical: 2,
                                                borderRadius: 4,
                                                alignSelf: 'flex-start'
                                            }}>
                                                <Text style={{
                                                    fontSize: 10,
                                                    color: parseFloat(vitals.bmi) < 18.5 ? '#a16207' : parseFloat(vitals.bmi) < 25 ? '#15803d' : parseFloat(vitals.bmi) < 30 ? '#c2410c' : '#b91c1c',
                                                    fontWeight: '700'
                                                }}>
                                                    {parseFloat(vitals.bmi) < 18.5 ? 'Underweight' : parseFloat(vitals.bmi) < 25 ? 'Normal' : parseFloat(vitals.bmi) < 30 ? 'Overweight' : 'Obese'}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                <View style={{ gap: 12 }}>
                    <View>
                        <Text style={styles.label}>Diagnosis / Chief Complaint</Text>
                        <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} multiline value={rx.diagnosis} onChangeText={t => setRx(r => ({ ...r, diagnosis: t }))} placeholder="e.g. Viral fever, URTI..." />
                    </View>
                    <View>
                        <Text style={styles.label}>Doctor Notes / Advice</Text>
                        <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} multiline value={rx.notes} onChangeText={t => setRx(r => ({ ...r, notes: t }))} placeholder="Clinical observations, advice..." />
                    </View>
                    <View>
                        <Text style={styles.label}>Lab Tests (comma separated)</Text>
                        <TextInput style={styles.input} value={rx.labTests} onChangeText={t => setRx(r => ({ ...r, labTests: t }))} placeholder="CBC, Blood Sugar, Urine Routine" />
                    </View>
                </View>

                {/* Prescription */}
                <View style={{ marginTop: 20 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 }}>💊 Prescription</Text>
                    <MedicineTable rx={rx} setRx={setRx} inventory={inventory} />
                    <TouchableOpacity
                        onPress={() => setRx(r => ({ ...r, medicines: [...r.medicines, { name: '', saltName: '', dose: '', days: '' }] }))}
                        style={{ marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f0fdf4', borderWidth: 1, borderStyle: 'dashed', borderColor: '#86efac', borderRadius: 6 }}
                    >
                        <Text style={{ color: '#16a34a', fontWeight: 'bold' }}>+ Add Row</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.btnPrimary, { marginTop: 24, paddingVertical: 14, alignItems: 'center' }]} disabled={saving} onPress={saveConsult}>
                    <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : '✅ Save & Generate Prescription'}</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    return (
        <ScrollView style={styles.container}>
            {msg.text ? <View style={[styles.downloadAlert, { borderColor: msg.type === 'error' ? '#fecaca' : '#a7f3d0', backgroundColor: msg.type === 'error' ? '#fef2f2' : '#ecfdf5' }]}><Text style={{ color: msg.type === 'error' ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{msg.text}</Text></View> : null}

            {/* Tab switcher */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {[{ id: 'staff', label: '👥 Doctor & Staff List' }, { id: 'queue', label: '🩺 Today\'s Queue' }]
                    .filter(t => true) // keeping both for now
                    .map(t => (
                        <TouchableOpacity key={t.id} style={[styles.switcherBtn, tab === t.id && { backgroundColor: '#6366f1', borderColor: '#6366f1' }]} onPress={() => setTab(t.id)}>
                            <Text style={[styles.switcherBtnText, tab === t.id && { color: '#fff' }]}>{t.label}</Text>
                        </TouchableOpacity>
                    ))}
            </View>

            {/* Staff List (1:1 Web Parity) */}
            {tab === 'staff' && (
                <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 14, color: '#1e293b' }}>👥 Clinic Staff</Text>
                    {staffLoading ? <Spinner /> : staff.length === 0 ? <Empty text="No staff members found for this clinic." /> : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                            <View style={{ minWidth: 620 }}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { width: 160 }]}>Name</Text>
                                    <Text style={[styles.th, { width: 110 }]}>Role</Text>
                                    <Text style={[styles.th, { width: 160 }]}>Email</Text>
                                    <Text style={[styles.th, { width: 110 }]}>Phone</Text>
                                    <Text style={[styles.th, { width: 80 }]}>Joined</Text>
                                </View>
                                {staff.map(s => (
                                    <View key={s._id} style={styles.tableRow}>
                                        <Text style={[styles.td, { width: 160, fontWeight: 'bold' }]}>{s.name}</Text>
                                        <View style={{ width: 110 }}>
                                            <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#bbf7d0', alignSelf: 'flex-start' }}>
                                                <Text style={{ color: '#16a34a', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>{s.roleName}</Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.td, { width: 160, fontSize: 12, color: '#64748b' }]} numberOfLines={1}>{s.email || '—'}</Text>
                                        <Text style={[styles.td, { width: 110, fontSize: 12, color: '#64748b' }]}>{s.phone || '—'}</Text>
                                        <Text style={[styles.td, { width: 80, fontSize: 11, color: '#94a3b8' }]}>{s.createdAt ? fmtDate(s.createdAt) : '—'}</Text>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    )}
                </View>
            )}

            {/* Queue Tab */}
            {tab === 'queue' && (
                <View>
                    {analytics && (
                        <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 14, color: '#1e293b' }}>📊 Clinic Performance — {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</Text>
                            <View style={styles.kpiGrid}>
                                {[
                                    { label: 'Seen Today', value: analytics.todayAppointments ?? '—', color: '#6366f1' },
                                    { label: 'This Month Revenue', value: `₹${(analytics.monthRevenue || 0).toLocaleString('en-IN')}`, color: '#16a34a' },
                                    { label: 'Total Patients', value: analytics.totalPatients ?? '—', color: '#0891b2' },
                                    { label: 'Completed All Time', value: analytics.completedAppointments ?? '—', color: '#7c3aed' },
                                ].map((s, i) => (
                                    <View key={i} style={{ flex: 1, minWidth: isNarrow ? '100%' : (isMobile ? '46%' : '22%'), alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: isNarrow ? 10 : 14 }}>
                                        <Text style={{ fontSize: isNarrow ? 18 : 22, fontWeight: '900', color: s.color }} numberOfLines={1}>{s.value}</Text>
                                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }} numberOfLines={1}>{s.label}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>🩺 Today's Patients — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
                                <Text style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{pending.length} waiting · {done.length} seen today</Text>
                            </View>
                            <TouchableOpacity style={styles.btnSecondary} onPress={loadToday}>
                                <Text style={styles.btnSecondaryText}>↻ Refresh</Text>
                            </TouchableOpacity>
                        </View>

                        {loading ? <Spinner /> : pending.length === 0 ? (
                            <Empty text="No patients in queue. Book tokens from Reception mode." />
                        ) : (
                            <FlatList
                                data={pending}
                                keyExtractor={a => a._id}
                                renderItem={({ item: a }) => (
                                    <View style={{ flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1', marginBottom: 12, alignItems: 'center', gap: 16 }}>
                                        <Text style={{ fontSize: 28, fontWeight: '900', color: '#6366f1', minWidth: 52, textAlign: 'center' }}>#{a.tokenNumber}</Text>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text style={{ fontWeight: '700', fontSize: 15, color: '#0f172a' }} numberOfLines={1}>{a.clinicPatientId?.name || '—'}</Text>
                                            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }} numberOfLines={1}>
                                                {a.clinicPatientId?.patientUid || a.patientId} · {a.serviceName || 'General'}
                                                {a.notes ? ` · "${a.notes}"` : ''}
                                            </Text>
                                        </View>
                                        <TouchableOpacity style={[styles.btnPrimary, { marginLeft: 'auto', paddingHorizontal: 18, paddingVertical: 8 }]} onPress={() => openConsult(a)}>
                                            <Text style={styles.btnPrimaryText}>Start →</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                scrollEnabled={false}
                            />
                        )}
                    </View>

                    {done.length > 0 && (
                        <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#1e293b' }}>✅ Seen Today ({done.length})</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                <View style={{ minWidth: 620 }}>
                                    <View style={styles.tableHeader}>
                                        <Text style={[styles.th, { width: 75 }]}>Token</Text>
                                        <Text style={[styles.th, { width: 160 }]}>Patient</Text>
                                        <Text style={[styles.th, { width: 160 }]}>Diagnosis</Text>
                                        <Text style={[styles.th, { width: 140 }]}>Medicines</Text>
                                        <Text style={[styles.th, { width: 85, textAlign: 'center' }]}>Action</Text>
                                    </View>
                                    {done.map(a => (
                                        <View key={a._id} style={styles.tableRow}>
                                            <Text style={[styles.td, { width: 75, fontWeight: 'bold', color: '#6366f1' }]}>#{a.tokenNumber}</Text>
                                            <View style={{ width: 160 }}>
                                                <Text style={[styles.td, { fontWeight: '600' }]} numberOfLines={1}>{a.clinicPatientId?.name || '—'}</Text>
                                                <Text style={{ fontSize: 11, color: '#94a3b8' }}>{a.clinicPatientId?.patientUid || a.patientId}</Text>
                                            </View>
                                            <Text style={[styles.td, { width: 160, fontSize: 12 }]} numberOfLines={2}>{a.diagnosis || '—'}</Text>
                                            <View style={{ width: 140 }}>
                                                {(a.pharmacy || []).slice(0, 2).map((m, i) => (
                                                    <Text key={i} style={{ fontSize: 11, color: '#64748b' }} numberOfLines={1}>• {m.medicineName || m.name}</Text>
                                                ))}
                                                {(a.pharmacy || []).length > 2 && <Text style={{ fontSize: 10, color: '#94a3b8' }}>+{(a.pharmacy || []).length - 2} more</Text>}
                                            </View>
                                            <View style={{ width: 85, alignItems: 'center' }}>
                                                <TouchableOpacity style={[styles.btnSecondary, { paddingHorizontal: 10, paddingVertical: 5 }]} onPress={() => openConsult(a)}>
                                                    <Text style={{ color: '#334155', fontSize: 11, fontWeight: '600' }}>✏️ Edit</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                    )}
                </View>
            )}
        </ScrollView>
    );
};

// ═══════════════════════════════════════════════════
// PHARMACY MODE
// ═══════════════════════════════════════════════════
const PharmacyMode = () => {
    const { width: screenWidth, isNarrow, isMobile } = useResponsive();
    const [tab, setTab] = useState('list');
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addForm, setAddForm] = useState({ name: '', category: 'General', unit: 'Tablets' });
    const [adding, setAdding] = useState(false);
    const [search, setSearch] = useState('');
    const [msg, setMsg] = useState({ type: '', text: '' });

    const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000); };

    const loadInventory = () => {
        setLoading(true);
        console.log('[ClinicDashboard] GET /api/clinic/inventory START');
        clinicAPI.getInventory()
            .then(r => {
                if (r.success) {
                    console.log('[ClinicDashboard] GET /api/clinic/inventory STATUS 200');
                    console.log('[ClinicDashboard] inventory items count:', (r.inventory || []).length);
                    setInventory(r.inventory || []);
                    console.log('[ClinicDashboard] setInventory called: true');
                } else {
                    console.log('[ClinicDashboard] GET /api/clinic/inventory STATUS ERROR', r.message);
                }
            })
            .catch(err => {
                const status = err?.response?.status || 'FAIL';
                console.log('[ClinicDashboard] GET /api/clinic/inventory STATUS', status, err?.response?.data || err?.message);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadInventory(); }, []);

    const handleAdd = async () => {
        if (!addForm.name.trim()) return flash('error', 'Medicine name is required');
        setAdding(true);
        try {
            const r = await clinicAPI.addInventory({ name: addForm.name, category: addForm.category, unit: addForm.unit });
            if (r.success) {
                setInventory(prev => [...prev, r.item].sort((a, b) => a.name.localeCompare(b.name)));
                setAddForm({ name: '', category: 'General', unit: 'Tablets' });
                setTab('list');
                flash('success', `"${r.item.name}" added to medicine list.`);
            }
        } catch (e) { flash('error', e.response?.data?.message || e.message); }
        finally { setAdding(false); }
    };

    const filtered = search.trim()
        ? inventory.filter(m => m.name.toLowerCase().includes(search.trim().toLowerCase()) || (m.category || '').toLowerCase().includes(search.trim().toLowerCase()))
        : inventory;

    const CATEGORIES = ['General', 'Antibiotic', 'Analgesic', 'Antacid', 'Vitamin', 'Antifungal', 'Antihistamine', 'Other'];
    const UNITS = ['Tablets', 'Capsules', 'Syrup (ml)', 'Injection', 'Cream/Ointment', 'Drops', 'Other'];

    return (
        <ScrollView style={styles.container}>
            {/* Info Banner */}
            <View style={{ backgroundColor: '#f0f9ff', borderWidth: 1, borderColor: '#bae6fd', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 24 }}>💡</Text>
                <Text style={{ flex: 1, fontSize: 13, color: '#0369a1' }}>
                    This is your <Text style={{ fontWeight: 'bold' }}>medicine list</Text> — add commonly used medicines here so doctors can quickly select them while prescribing. No stock tracking or billing.
                </Text>
            </View>

            <View style={styles.subTabs}>
                {[
                    { id: 'list', label: `💊 Medicine List (${inventory.length})` },
                    { id: 'add', label: '+ Add Medicine' },
                ].map(t => (
                    <TouchableOpacity
                        key={t.id}
                        style={[styles.subTab, tab === t.id && styles.subTabActive]}
                        onPress={() => setTab(t.id)}
                    >
                        <Text style={[styles.subTabText, tab === t.id && styles.subTabTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {msg.text ? <View style={[styles.downloadAlert, { borderColor: msg.type === 'error' ? '#fecaca' : '#a7f3d0', backgroundColor: msg.type === 'error' ? '#fef2f2' : '#ecfdf5' }]}><Text style={{ color: msg.type === 'error' ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{msg.text}</Text></View> : null}

            {loading ? <Spinner /> : (
                <View>
                    {tab === 'list' && (
                        <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>💊 Medicine List</Text>
                                <TouchableOpacity style={[styles.btnPrimary, { paddingHorizontal: 12, paddingVertical: 6 }]} onPress={() => setTab('add')}>
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>+ Add Medicine</Text>
                                </TouchableOpacity>
                            </View>
                            {inventory.length > 0 && (
                                <TextInput
                                    style={[styles.input, { marginBottom: 16 }]}
                                    placeholder="Search by name or category…"
                                    value={search}
                                    onChangeText={setSearch}
                                />
                            )}
                            {filtered.length === 0 ? (
                                <Empty text={inventory.length === 0 ? 'No medicines added yet. Click "+ Add Medicine" to get started.' : 'No matches found.'} />
                            ) : (
                                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                    <View style={{ minWidth: isNarrow ? 480 : '100%', width: '100%' }}>
                                        <View style={[styles.tableHeader, { paddingVertical: 8, paddingHorizontal: 12 }]}>
                                            <Text style={[styles.th, { width: 40, color: '#64748b' }]}>#</Text>
                                            <Text style={[styles.th, { flex: 2, minWidth: 160, color: '#374151' }]}>Medicine Name</Text>
                                            <Text style={[styles.th, { flex: 1.2, minWidth: 110, color: '#374151' }]}>Category</Text>
                                            <Text style={[styles.th, { flex: 1, minWidth: 90, color: '#374151' }]}>Unit / Form</Text>
                                        </View>
                                        {filtered.map((m, i) => (
                                            <View key={m._id || i} style={[styles.tableRow, { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc' }]}>
                                                <Text style={{ color: '#94a3b8', fontSize: 12, width: 40 }}>{i + 1}</Text>
                                                <View style={{ flex: 2, minWidth: 160 }}>
                                                    <Text style={{ fontWeight: 'bold', color: '#1e293b', fontSize: 13 }}>{m.name}</Text>
                                                </View>
                                                <View style={{ flex: 1.2, minWidth: 110, alignItems: 'flex-start' }}>
                                                    <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                                        <Text style={{ color: '#475569', fontSize: 11, fontWeight: '600' }}>{m.category || 'General'}</Text>
                                                    </View>
                                                </View>
                                                <Text style={{ flex: 1, minWidth: 90, fontSize: 12, color: '#64748b' }}>{m.unit || '—'}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    )}

                    {tab === 'add' && (
                        <View style={[styles.clinicCard, isMobile && styles.cardMobile, { maxWidth: 640 }]}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 6, color: '#1e293b' }}>+ Add Medicine to List</Text>
                            <Text style={{ color: '#64748b', fontSize: 13, marginBottom: 18 }}>
                                Add medicines your clinic commonly prescribes. Once added, doctors can search and select them instantly while writing prescriptions.
                            </Text>

                            <View style={{ gap: 14 }}>
                                <View>
                                    <Text style={styles.label}>Medicine Name *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. Paracetamol 500mg"
                                        value={addForm.name}
                                        onChangeText={t => setAddForm(f => ({ ...f, name: t }))}
                                    />
                                    <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Be specific — include strength if relevant (e.g. "Amoxicillin 250mg")</Text>
                                </View>

                                {/* We use basic Picker or simulated dropdowns. Let's use simple Pickers if available, or just map buttons. To save space, simulated simple Picker: */}
                                <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 14 }}>
                                    <View style={{ flex: 1, zIndex: 100 }}>
                                        <Text style={styles.label}>Category</Text>
                                        <CustomSelectDropdown
                                            value={addForm.category}
                                            placeholder="Select Category"
                                            options={CATEGORIES}
                                            onSelect={val => setAddForm(f => ({ ...f, category: val }))}
                                        />
                                    </View>
                                    <View style={{ flex: 1, zIndex: 99 }}>
                                        <Text style={styles.label}>Unit / Form</Text>
                                        <CustomSelectDropdown
                                            value={addForm.unit}
                                            placeholder="Select Type"
                                            options={UNITS}
                                            onSelect={val => setAddForm(f => ({ ...f, unit: val }))}
                                        />
                                    </View>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
                                    <TouchableOpacity style={[styles.btnPrimary, { paddingHorizontal: 18, paddingVertical: 10 }]} disabled={adding} onPress={handleAdd}>
                                        <Text style={styles.btnPrimaryText}>{adding ? 'Adding…' : '+ Add to List'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.btnSecondary, { paddingHorizontal: 18, paddingVertical: 10 }]} onPress={() => { setTab('list'); setAddForm({ name: '', category: 'General', unit: 'Tablets' }); }}>
                                        <Text style={{ color: '#475569', fontWeight: 'bold' }}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            )}
        </ScrollView>
    );
};

// ═══════════════════════════════════════════════════
// TREATMENT PLAN MODE
// ═══════════════════════════════════════════════════
const TreatmentPlanMode = () => {
    const { width: screenWidth, height: screenHeight, isNarrow, isMobile, isTablet, isDesktop } = useResponsive();
    const [view, setView] = useState('list');
    const [plans, setPlans] = useState([]);
    const [todayDue, setTodayDue] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    const [patients, setPatients] = useState([]);
    const [patSearch, setPatSearch] = useState('');
    const [form, setForm] = useState({
        clinicPatientId: '', title: '', description: '',
        totalAmount: '', totalDurationDays: '', startDate: '', intervalDays: '', numberOfVisits: '',
    });
    const [visits, setVisits] = useState([]);

    const [payModal, setPayModal] = useState(null);
    const [payInput, setPayInput] = useState({ amountPaid: '', paymentMethod: 'Cash', notes: '', upiId: 'payments@upi', upiRef: '', confirmedReceipt: false });

    // Reschedule visit state (1:1 Web Parity)
    const [rescheduleModal, setRescheduleModal] = useState(null); // { planId, visit }
    const [rescheduleInput, setRescheduleInput] = useState({ newDate: '', newTime: '', remarks: '' });

    const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 5000); };

    const getEffectiveStatus = (visit) => {
        if (visit.status === 'completed' || visit.status === 'missed') return visit.status;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sDate = new Date(visit.scheduledDate);
        sDate.setHours(0, 0, 0, 0);
        if (sDate <= today) return 'due';
        return visit.status;
    };

    const loadAll = () => {
        setLoading(true);
        console.log('[ClinicDashboard][treatmentPlans] START');
        Promise.allSettled([clinicAPI.getTreatmentPlans(), clinicAPI.getTodayDuePlans()])
            .then(([plansRes, dueRes]) => {
                if (plansRes.status === 'fulfilled' && plansRes.value?.success) {
                    const planList = plansRes.value.plans || plansRes.value.data || [];
                    console.log('[ClinicDashboard][treatmentPlans] STATUS', 200);
                    console.log('[ClinicDashboard][treatmentPlans] DATA_KEYS', Object.keys(planList[0] || {}));
                    setPlans(planList);
                    console.log('[ClinicDashboard][treatmentPlans] SET_STATE');
                } else if (plansRes.status === 'rejected') {
                    const err = plansRes.reason;
                    const status = err?.response?.status || 'FAIL';
                    const message = err?.response?.data?.message || err?.message;
                    console.log('[ClinicDashboard][treatmentPlans] ERROR', { status, message });
                }

                if (dueRes.status === 'fulfilled' && dueRes.value?.success) {
                    const dueList = dueRes.value.plans || dueRes.value.data || [];
                    console.log('[ClinicDashboard][todayDuePlans] STATUS', 200);
                    console.log('[ClinicDashboard][todayDuePlans] DATA_KEYS', Object.keys(dueList[0] || {}));
                    setTodayDue(dueList);
                    console.log('[ClinicDashboard][todayDuePlans] SET_STATE');
                } else if (dueRes.status === 'rejected') {
                    const err = dueRes.reason;
                    const status = err?.response?.status || 'FAIL';
                    const message = err?.response?.data?.message || err?.message;
                    console.log('[ClinicDashboard][todayDuePlans] ERROR', { status, message });
                }
            })
            .catch(err => {
                console.log('[ClinicDashboard][treatmentPlans] ERROR', {
                    status: err?.response?.status,
                    message: err?.response?.data?.message || err?.message
                });
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadAll(); }, []);

    useEffect(() => {
        const n = parseInt(form.numberOfVisits);
        const interval = parseInt(form.intervalDays);
        const start = form.startDate;
        if (!n || !start) return;
        const base = new Date(start);
        setVisits(Array.from({ length: n }, (_, i) => {
            const d = new Date(base);
            d.setDate(d.getDate() + (interval || 0) * i);
            return { visitNumber: i + 1, scheduledDate: d.toISOString().split('T')[0], scheduledTime: '', procedure: '' };
        }));
    }, [form.numberOfVisits, form.intervalDays, form.startDate]);

    useEffect(() => {
        if (view === 'create' && patSearch.length > 1) {
            const delay = setTimeout(() => {
                clinicAPI.getPatients(patSearch).then(r => {
                    if (r.success) setPatients(r.patients || []);
                }).catch(e => console.error(e));
            }, 300);
            return () => clearTimeout(delay);
        }
    }, [patSearch, view]);

    const handleCreateSubmit = async () => {
        if (!form.clinicPatientId || !form.title || !form.totalAmount || !form.totalDurationDays || !form.startDate || !form.numberOfVisits || !form.intervalDays || visits.length === 0)
            return flash('error', 'Please fill in all required fields (marked with *).');
        if (visits.some(v => !v.scheduledDate)) return flash('error', 'All visits must have a scheduled date.');
        setSaving(true);
        try {
            const r = await clinicAPI.createTreatmentPlan({ ...form, visits });
            if (r.success) {
                flash('success', 'Treatment plan created.');
                setPlans(prev => [r.plan, ...prev]);
                setView('list');
                setForm({ clinicPatientId: '', title: '', description: '', totalAmount: '', totalDurationDays: '', startDate: '', intervalDays: '', numberOfVisits: '' });
                setVisits([]);
                setPatSearch('');
            } else flash('error', r.message);
        } catch (e) { flash('error', e.response?.data?.message || e.message); }
        finally { setSaving(false); }
    };

    const openDetail = async (plan) => {
        try {
            const r = await clinicAPI.getTreatmentPlan(plan._id);
            if (r.success) { setSelectedPlan(r.plan); setView('detail'); }
        } catch { setSelectedPlan(plan); setView('detail'); }
    };

    const handlePay = async () => {
        if (!payModal) return;
        const paid = Number(payInput.amountPaid) || 0;
        if (paid <= 0) return flash('error', 'Enter a valid amount greater than zero.');
        if (paid > selectedPlan.pendingBalance) return flash('error', 'Payment amount cannot exceed outstanding balance.');

        const isUpiPay = payInput.paymentMethod === 'UPI';
        // R1+R2+R3+R4 fix: UPI validation now exactly matches Web (L3329-3338).
        if (isUpiPay) {
            // R1: upiId is required for UPI (matches Web L3331)
            const upiIdTrimmed = (payInput.upiId || '').trim();
            if (!upiIdTrimmed) return flash('error', 'Please enter the UPI ID.');
            if (upiIdTrimmed.length > 25) return flash('error', 'UPI ID cannot exceed 25 characters.');
            // R2: Strict raw-value validation — upiRef must be EXACTLY 12 numeric digits.
            // Validates the raw user-entered string (no stripping first), so mixed strings like
            // "123456ABCD789012" are rejected even though stripping gives 12 digits.
            const rawRef = (payInput.upiRef || '').trim();
            if (!rawRef) return flash('error', 'Transaction reference is required for UPI payments.');
            if (!/^\d{12}$/.test(rawRef)) return flash('error', 'Transaction reference must be exactly 12 numeric digits.');
            // refClean is the normalized value used in payload and duplicate check (matches Web L3333/L3351)
            const refClean = rawRef;
            // Receipt confirmation required (matches Web L3335)
            if (!payInput.confirmedReceipt) return flash('error', 'Please confirm you verified the receipt on the device.');
            // R4: Client-side duplicate UTR check against current plan visits (matches Web L3337-3338)
            const dupVisit = selectedPlan?.visits?.find(v =>
                v.paymentHistory && v.paymentHistory.some(ph => ph.method === 'UPI' && ph.upiRef === refClean)
            );
            if (dupVisit) return flash('error', `Duplicate transaction reference. Already used on Visit ${dupVisit.visitNumber}.`);
        }

        setSaving(true);
        try {
            const todayIso = new Date().toISOString().split('T')[0];
            // R3: Build payload matching Web exactly (L3343-3353)
            const payload = {
                amountPaid: paid,
                paymentDate: todayIso,
                paymentMethod: payInput.paymentMethod,
                notes: payInput.notes,
            };
            if (isUpiPay) {
                payload.upiId = (payInput.upiId || '').trim();
                // rawRef already validated as exactly 12 numeric digits — use directly
                payload.upiRef = (payInput.upiRef || '').trim();

                // R3: notes enriched with [UPI ID:..., Ref:...] matching Web L3352
                payload.notes = `[UPI ID: ${payload.upiId}, Ref: ${payload.upiRef}] ${payload.notes}`.trim();
            }

            const r = await clinicAPI.payVisit(payModal.planId, payModal.visit._id, payload);
            if (r.success) {
                setSelectedPlan(r.plan);
                setPlans(prev => prev.map(p => p._id === r.plan._id ? r.plan : p));
                setPayModal(null);
                flash('success', `₹${paid.toLocaleString('en-IN')} recorded. Remaining balance: ₹${r.plan.pendingBalance.toLocaleString('en-IN')}`);
            } else flash('error', r.message);
        } catch (e) { flash('error', e.response?.data?.message || e.message); }
        finally { setSaving(false); }
    };

    const isLastScheduled = (visitId) => {
        if (!selectedPlan || !selectedPlan.visits) return false;
        const remaining = selectedPlan.visits.filter(vis => ['scheduled', 'rescheduled'].includes(vis.status));
        return remaining.length === 1 && remaining[0]._id === visitId;
    };

    const handleComplete = async (planId, visitId) => {
        if (selectedPlan && isLastScheduled(visitId) && (selectedPlan.pendingBalance || 0) > 0) {
            Alert.alert(
                'Payment Required',
                `Please collect the pending balance of ₹${Number(selectedPlan.pendingBalance).toLocaleString('en-IN')} before completing the final visit.`
            );
            return;
        }
        Alert.alert(
            'Complete Visit',
            'Mark this visit as completed?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Complete',
                    onPress: async () => {
                        try {
                            const r = await clinicAPI.completeVisit(planId, visitId, {});
                            if (r.success) {
                                setSelectedPlan(r.plan);
                                setPlans(prev => prev.map(p => p._id === r.plan._id ? r.plan : p));
                                flash('success', r.plan.status === 'completed' ? '🎉 Treatment plan completed!' : 'Visit marked completed.');
                            } else flash('error', r.message);
                        } catch (e) { flash('error', e.response?.data?.message || e.message); }
                    }
                }
            ]
        );
    };

    // 1:1 Web Parity: Mark Visit as Missed (GAP 10)
    const handleMiss = (planId, visitId) => {
        Alert.alert(
            "Mark Visit as Missed",
            "Are you sure you want to mark this scheduled visit as missed?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Mark Missed",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const r = await clinicAPI.missVisit(planId, visitId);
                            if (r.success) {
                                setSelectedPlan(r.plan);
                                setPlans(prev => prev.map(p => p._id === r.plan._id ? r.plan : p));
                                flash('success', 'Visit marked as missed.');
                            } else {
                                flash('error', r.message || 'Failed to mark visit as missed');
                            }
                        } catch (e) {
                            flash('error', e.response?.data?.message || e.message);
                        }
                    }
                }
            ]
        );
    };

    // 1:1 Web Parity: Reschedule Visit (GAP 11)
    const handleRescheduleSubmit = async () => {
        if (!rescheduleModal) return;
        if (!rescheduleInput.newDate) return flash('error', 'New date is required.');
        setSaving(true);
        try {
            const r = await clinicAPI.rescheduleVisit(rescheduleModal.planId, rescheduleModal.visit._id, rescheduleInput);
            if (r.success) {
                setSelectedPlan(r.plan);
                setPlans(prev => prev.map(p => p._id === r.plan._id ? r.plan : p));
                setRescheduleModal(null);
                flash('success', 'Visit rescheduled successfully.');
            } else {
                flash('error', r.message || 'Failed to reschedule visit');
            }
        } catch (e) {
            flash('error', e.response?.data?.message || e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = (planId) => {
        Alert.alert(
            "Cancel Treatment Plan",
            "Are you sure you want to cancel this treatment plan?",
            [
                { text: "No", style: "cancel" },
                {
                    text: "Cancel Plan",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const r = await clinicAPI.cancelTreatmentPlan(planId);
                            if (r.success) {
                                setPlans(prev => prev.map(p => p._id === planId ? { ...p, status: 'cancelled' } : p));
                                if (selectedPlan?._id === planId) setSelectedPlan(prev => ({ ...prev, status: 'cancelled' }));
                                flash('success', 'Plan cancelled.');
                            } else {
                                flash('error', r.message || 'Failed to cancel plan');
                            }
                        } catch (e) {
                            flash('error', e.response?.data?.message || e.message);
                        }
                    }
                }
            ]
        );
    };

    const planStatusColor = { active: '#0891b2', completed: '#16a34a', cancelled: '#dc2626' };

    // --- LIST VIEW ---
    if (view === 'list') return (
        <ScrollView style={styles.container}>
            {todayDue.length > 0 && (
                <View style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <Text style={{ fontWeight: '800', color: '#92400e', fontSize: 14, marginBottom: 8 }}>🔔 Today's Visits Due</Text>
                    {todayDue.map(plan => plan.visits.filter(v => new Date(v.scheduledDate).toDateString() === new Date().toDateString() && ['scheduled', 'rescheduled'].includes(v.status)).map(v => (
                        <View key={v._id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <Text style={{ fontWeight: '700', color: '#78350f', flex: 1 }}>
                                📋 {plan.clinicPatientId?.name} — Visit {v.visitNumber} · "{plan.title}"
                                {v.scheduledTime ? ` · 🕐 ${v.scheduledTime}` : ''}
                                {plan.pendingBalance > 0 ? ` · ₹${Number(plan.pendingBalance).toLocaleString('en-IN')} pending` : ''}
                            </Text>
                            <TouchableOpacity onPress={() => openDetail(plan)} style={{ backgroundColor: '#f59e0b', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5 }}>
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>View Plan</Text>
                            </TouchableOpacity>
                        </View>
                    )))}
                </View>
            )}

            {msg.text ? <View style={[styles.downloadAlert, { borderColor: msg.type === 'error' ? '#fecaca' : '#a7f3d0', backgroundColor: msg.type === 'error' ? '#fef2f2' : '#ecfdf5' }]}><Text style={{ color: msg.type === 'error' ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{msg.text}</Text></View> : null}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a' }}>📅 Treatment Plans</Text>
                <TouchableOpacity style={[styles.btnPrimary, { paddingHorizontal: 12, paddingVertical: 6 }]} onPress={() => { setView('create'); loadAll(); }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>+ New Plan</Text>
                </TouchableOpacity>
            </View>

            {loading ? <Spinner /> : plans.length === 0 ? <Empty text="No treatment plans yet." /> : (
                <View style={{ gap: 12 }}>
                    {plans.map(plan => {
                        const nextVisit = (plan.visits || []).find(v => ['scheduled', 'rescheduled', 'due'].includes(v.status));
                        const pct = plan.totalAmount > 0 ? Math.min(100, Math.round(((plan.totalPaid || 0) / plan.totalAmount) * 100)) : 0;
                        return (
                            <TouchableOpacity key={plan._id} style={[styles.clinicCard, { borderLeftWidth: 4, borderLeftColor: planStatusColor[plan.status] || '#94a3b8' }, isMobile && styles.cardMobile]} onPress={() => openDetail(plan)}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                                    <View style={{ flex: 1, minWidth: 200 }}>
                                        <Text style={{ fontWeight: '800', fontSize: 15, color: '#0f172a' }}>{plan.title}</Text>
                                        <Text style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>👤 {plan.clinicPatientId?.name || '—'} · {plan.clinicPatientId?.patientUid || ''}</Text>
                                        {plan.description ? <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{plan.description}</Text> : null}
                                    </View>
                                    <View style={{ backgroundColor: (planStatusColor[plan.status] || '#94a3b8') + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: planStatusColor[plan.status] || '#94a3b8', textTransform: 'uppercase' }}>{plan.status}</Text>
                                    </View>
                                </View>
                                <View style={{ marginTop: 10 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text style={{ fontSize: 11, color: '#64748b' }}>Paid: <Text style={{ color: '#16a34a', fontWeight: 'bold' }}>₹{(plan.totalPaid || 0).toLocaleString('en-IN')}</Text> of <Text style={{ fontWeight: 'bold' }}>₹{(plan.totalAmount || 0).toLocaleString('en-IN')}</Text></Text>
                                        <Text style={{ color: plan.pendingBalance > 0 ? '#dc2626' : '#16a34a', fontWeight: '700', fontSize: 11 }}>
                                            {plan.pendingBalance > 0 ? `₹${(plan.pendingBalance || 0).toLocaleString('en-IN')} due` : '✓ Fully Paid'}
                                        </Text>
                                    </View>
                                    <View style={{ backgroundColor: '#e2e8f0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                                        <View style={{ height: '100%', width: `${pct}%`, backgroundColor: pct === 100 ? '#16a34a' : '#0891b2' }} />
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 16, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 12, color: '#475569' }}>
                                        📋 <Text style={{ fontWeight: 'bold' }}>{(plan.visits || []).filter(v => v.status === 'completed').length}</Text>/{(plan.visits || []).length} visits done
                                    </Text>
                                    {nextVisit ? (
                                        <Text style={{ fontSize: 12, color: '#0891b2' }}>
                                            📅 Next: <Text style={{ fontWeight: 'bold' }}>{new Date(nextVisit.scheduledDate).toLocaleDateString('en-IN')}</Text>{nextVisit.scheduledTime ? ` · ${nextVisit.scheduledTime}` : ''}
                                        </Text>
                                    ) : null}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </ScrollView>
    );

    // --- CREATE VIEW ---
    if (view === 'create') return (
        <ScrollView style={styles.container}>
            <TouchableOpacity onPress={() => setView('list')} style={{ marginBottom: 12 }}>
                <Text style={{ color: '#6366f1', fontWeight: 'bold' }}>← Back to Plans</Text>
            </TouchableOpacity>

            {msg.text ? <View style={[styles.downloadAlert, { borderColor: msg.type === 'error' ? '#fecaca' : '#a7f3d0', backgroundColor: msg.type === 'error' ? '#fef2f2' : '#ecfdf5' }]}><Text style={{ color: msg.type === 'error' ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{msg.text}</Text></View> : null}

            <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 20 }}>📅 New Treatment Plan</Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 }}>
                    <View style={{ width: '100%', zIndex: 50 }}>
                        <Text style={styles.label}>Patient *</Text>
                        {!form.clinicPatientId ? (
                            <TextInput style={styles.input} placeholder="Search patient..." value={patSearch} onChangeText={setPatSearch} />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 }}>
                                <Text style={{ marginRight: 8 }}>👤</Text>
                                <Text style={{ flex: 1, fontWeight: '600', color: '#1e293b' }}>{patSearch}</Text>
                                <TouchableOpacity onPress={() => { setForm(f => ({ ...f, clinicPatientId: '' })); setPatSearch(''); }}>
                                    <Text style={{ color: '#94a3b8', fontSize: 16 }}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {patSearch.trim().length > 0 && patients.length > 0 && !form.clinicPatientId && (
                            <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, maxHeight: 160, position: 'absolute', top: 60, left: 0, right: 0, zIndex: 100 }}>
                                <ScrollView nestedScrollEnabled>
                                    {patients.map(p => (
                                        <TouchableOpacity key={p._id} style={{ padding: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' }} onPress={() => { setForm(f => ({ ...f, clinicPatientId: p._id })); setPatSearch(p.name); setPatients([]); }}>
                                            <Text style={{ fontSize: 13 }}><Text style={{ fontWeight: 'bold' }}>{p.name}</Text> · {p.phone || ''}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    <View style={{ width: isMobile ? "100%" : "48.5%" }}>
                        <Text style={styles.label}>Plan Title *</Text>
                        <TextInput style={styles.input} placeholder="e.g. Root Canal, Orthodontic Course..." value={form.title} onChangeText={t => setForm(f => ({ ...f, title: t }))} />
                    </View>

                    <View style={{ width: isMobile ? "100%" : "48.5%" }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 }}>
                            <Text style={styles.label}>Description / Notes</Text>
                            <Text style={{ fontSize: 13, color: (form.description || '').length >= 500 ? '#ef4444' : '#64748b', fontWeight: '600' }}>
                                {(form.description || '').length} / 500
                            </Text>
                        </View>
                        <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} multiline maxLength={500} placeholder="Brief description (max 500 chars)..." value={form.description} onChangeText={t => setForm(f => ({ ...f, description: t }))} />
                    </View>

                    <View style={{ width: isMobile ? "100%" : "48.5%" }}>
                        <Text style={styles.label}>💰 Total Treatment Amount (₹) *</Text>
                        <TextInput style={styles.input} keyboardType="numeric" placeholder="e.g. 5000" value={form.totalAmount} onChangeText={t => setForm(f => ({ ...f, totalAmount: t }))} />
                        <Text style={{ fontSize: 13, color: '#64748b', marginTop: 3, fontWeight: '500' }}>Patient can pay any amount at any visit.</Text>
                    </View>

                    <View style={{ width: isMobile ? "100%" : "48.5%" }}>
                            <Text style={styles.label}>Number of Visits *</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                placeholder="e.g. 5"
                                maxLength={3}
                                value={form.numberOfVisits}
                                onChangeText={val => {
                                    const v = val.length > 3 ? val.slice(0, 3) : val;
                                    setForm(f => {
                                        const n = parseInt(v) || 0;
                                        const i = parseInt(f.intervalDays) || 0;
                                        return { ...f, numberOfVisits: v, totalDurationDays: String(n > 1 ? (n - 1) * i : 0) };
                                    });
                                }}
                            />
                        </View>
                    <View style={{ width: isMobile ? "100%" : "48.5%" }}>
                            <Text style={styles.label}>Interval Between Visits (days) *</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                placeholder="e.g. 3"
                                maxLength={3}
                                value={form.intervalDays}
                                onChangeText={val => {
                                    const v = val.length > 3 ? val.slice(0, 3) : val;
                                    setForm(f => {
                                        const i = parseInt(v) || 0;
                                        const n = parseInt(f.numberOfVisits) || 0;
                                        return { ...f, intervalDays: v, totalDurationDays: String(n > 1 ? (n - 1) * i : 0) };
                                    });
                                }}
                            />
                        </View>

                    <View style={{ width: isMobile ? "100%" : "48.5%" }}>
                            <Text style={styles.label}>Start Date *</Text>
                            <DatePickerInput
                                value={form.startDate}
                                onChange={d => setForm(f => ({ ...f, startDate: d }))}
                                placeholder="YYYY-MM-DD"
                                title="Start Date"
                            />
                        </View>
                    <View style={{ width: isMobile ? "100%" : "48.5%" }}>
                            <Text style={styles.label}>Total Duration (days) *</Text>
                            <TextInput style={[styles.input, { backgroundColor: '#e2e8f0', color: '#64748b' }]} editable={false} placeholder="Auto calculated..." value={form.totalDurationDays} />
                    </View>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
                    <TouchableOpacity style={[styles.btnPrimary, { flex: 1, minWidth: 100, backgroundColor: '#f1f5f9', alignItems: 'center' }]} onPress={() => setView('list')}>
                        <Text style={{ color: '#475569', fontWeight: 'bold' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnPrimary, { flex: 2, alignItems: 'center' }]} disabled={saving} onPress={handleCreateSubmit}>
                        <Text style={styles.btnPrimaryText}>{saving ? 'Creating...' : '✅ Create Treatment Plan'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );

    // --- DETAIL VIEW ---
    if (view === 'detail' && selectedPlan) {
        return (
            <ScrollView style={styles.container}>
                <TouchableOpacity onPress={() => setView('list')} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>← Back to Plans</Text>
                </TouchableOpacity>

                {msg.text ? <View style={[styles.downloadAlert, { borderColor: msg.type === 'error' ? '#fecaca' : '#a7f3d0', backgroundColor: msg.type === 'error' ? '#fef2f2' : '#ecfdf5' }]}><Text style={{ color: msg.type === 'error' ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{msg.text}</Text></View> : null}

                <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                    <View style={{ flexDirection: isNarrow ? 'column' : 'row', justifyContent: 'space-between', alignItems: isNarrow ? 'flex-start' : 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16, borderBottomWidth: 1, borderColor: '#f1f5f9', paddingBottom: 16 }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a' }}>{selectedPlan.title}</Text>
                            <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>👤 {selectedPlan.clinicPatientId?.name}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                            <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ecfeff', borderWidth: 1, borderColor: '#0891b2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                                onPress={() => downloadTreatmentPlanPDF(selectedPlan)}
                            >
                                <Text style={{ fontSize: 13 }}>📄</Text>
                                <Text style={{ color: '#0891b2', fontWeight: 'bold', fontSize: 12 }}>Invoice PDF</Text>
                            </TouchableOpacity>
                            {selectedPlan.status === 'active' && (
                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                                    onPress={() => handleCancel(selectedPlan._id)}
                                >
                                    <Text style={{ color: '#dc2626', fontWeight: 'bold', fontSize: 12 }}>✕ Cancel Plan</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                        {[
                            { label: 'Total Amount', value: '₹' + Number(selectedPlan.totalAmount || 0).toLocaleString('en-IN'), color: '#6366f1' },
                            { label: 'Total Paid', value: '₹' + Number(selectedPlan.totalPaid || 0).toLocaleString('en-IN'), color: '#16a34a' },
                            { label: 'Balance Due', value: selectedPlan.pendingBalance > 0 ? '₹' + Number(selectedPlan.pendingBalance).toLocaleString('en-IN') : '✓ Cleared', color: selectedPlan.pendingBalance > 0 ? '#dc2626' : '#16a34a' },
                            { label: 'Visits Done', value: `${(selectedPlan.visits || []).filter(v => v.status === 'completed').length} / ${(selectedPlan.visits || []).length}`, color: '#0891b2' },
                        ].map((s, i) => (
                            <View key={i} style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, borderTopWidth: 3, borderTopColor: s.color, minWidth: isNarrow ? '100%' : (isMobile ? '46%' : '22%'), flex: 1 }}>
                                <Text style={{ fontSize: 18, fontWeight: '800', color: s.color }}>{s.value}</Text>
                                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Progress bar */}
                    {selectedPlan.totalAmount > 0 && (
                        <View style={{ marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ fontSize: 11, color: '#64748b' }}>Payment Progress</Text>
                                <Text style={{ fontSize: 11, color: '#64748b' }}>{Math.min(100, Math.round(((selectedPlan.totalPaid || 0) / selectedPlan.totalAmount) * 100))}%</Text>
                            </View>
                            <View style={{ backgroundColor: '#e2e8f0', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                                <View style={{ height: '100%', width: `${Math.min(100, Math.round(((selectedPlan.totalPaid || 0) / selectedPlan.totalAmount) * 100))}%`, backgroundColor: selectedPlan.pendingBalance === 0 ? '#16a34a' : '#0891b2', borderRadius: 6 }} />
                            </View>
                        </View>
                    )}

                    {/* Warning if last visit and balance pending */}
                    {selectedPlan.status === 'active' && selectedPlan.pendingBalance > 0 && selectedPlan.visits.filter(v => ['scheduled', 'rescheduled'].includes(v.status)).length === 1 && (
                        <View style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                            <Text style={{ fontSize: 13, color: '#dc2626', fontWeight: 'bold' }}>
                                ⚠️ Last visit remaining. <Text style={{ fontWeight: 'normal' }}>Patient must pay ₹{Number(selectedPlan.pendingBalance).toLocaleString('en-IN')} before this visit can be closed.</Text>
                            </Text>
                        </View>
                    )}

                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 }}>Visit Schedule</Text>
                    <View style={{ borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                        {selectedPlan.visits.map((v, idx) => {
                            const effStatus = getEffectiveStatus(v);
                            const vDateStr = v.scheduledDate ? new Date(v.scheduledDate).toISOString().split('T')[0] : '';
                            const isFutureVisit = vDateStr > todayStr();
                            const hasPriorPayment = (selectedPlan.visits || []).some(prior => prior.visitNumber === v.visitNumber && prior._id !== v._id && prior.amountPaid > 0);
                            return (
                                <View key={v._id} style={{ padding: 12, borderBottomWidth: idx < selectedPlan.visits.length - 1 ? 1 : 0, borderColor: '#f1f5f9', backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <View>
                                            <Text style={{ fontWeight: 'bold', color: '#6366f1' }}>Visit {v.visitNumber} <Text style={{ color: '#1e293b' }}>· {new Date(v.scheduledDate).toLocaleDateString('en-IN')}</Text></Text>
                                            {v.scheduledTime ? <Text style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>🕐 {v.scheduledTime}</Text> : null}
                                            {v.originalScheduledDate ? (
                                                <Text style={{ color: '#a855f7', fontSize: 10, fontWeight: 'bold', marginTop: 2 }}>
                                                    Original: {new Date(v.originalScheduledDate).toLocaleDateString('en-IN')}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <View style={{ backgroundColor: effStatus === 'completed' ? '#dcfce7' : effStatus === 'missed' ? '#fee2e2' : effStatus === 'due' ? '#fef3c7' : effStatus === 'rescheduled' ? '#f3e8ff' : '#e2e8f0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                <Text style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', color: effStatus === 'completed' ? '#166534' : effStatus === 'missed' ? '#dc2626' : '#475569' }}>{effStatus}</Text>
                                            </View>
                                            {v.rescheduledToDate ? (
                                                <Text style={{ fontSize: 10, color: '#a855f7', marginTop: 4, fontWeight: '600' }}>
                                                    Rescheduled To: {new Date(v.rescheduledToDate).toLocaleDateString('en-IN')}
                                                </Text>
                                            ) : null}
                                            {v.status === 'completed' && v.completedAt ? (
                                                <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                                                    Completed: {new Date(v.completedAt).toLocaleDateString('en-IN')}
                                                </Text>
                                            ) : null}
                                        </View>
                                    </View>
                                    {v.procedure ? <Text style={{ fontSize: 12, color: '#1e293b', fontWeight: '500', marginBottom: 2 }}>{v.procedure}</Text> : null}
                                    {v.notes ? <Text style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{v.notes}</Text> : null}
                                    {v.amountPaid > 0 ? (
                                        <Text style={{ color: '#16a34a', fontWeight: '600', fontSize: 11, marginBottom: 4 }}>
                                            Paid: ₹{v.amountPaid.toLocaleString('en-IN')}{v.paymentMethod ? ` · ${v.paymentMethod}` : ''}
                                        </Text>
                                    ) : null}

                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                        {selectedPlan.status === 'active' && !['completed', 'missed'].includes(v.status) && (() => {
                                            const isLast = isLastScheduled(v._id);
                                            const isBlocked = isLast && (selectedPlan.pendingBalance || 0) > 0;
                                            return (
                                                <>
                                                    {selectedPlan.pendingBalance > 0 && !hasPriorPayment && (
                                                        <TouchableOpacity
                                                            disabled={isFutureVisit}
                                                            style={{
                                                                backgroundColor: isFutureVisit ? '#f1f5f9' : '#dcfce7',
                                                                paddingHorizontal: 12,
                                                                paddingVertical: 6,
                                                                borderRadius: 6,
                                                                opacity: isFutureVisit ? 0.6 : 1
                                                            }}
                                                            onPress={() => {
                                                                const remainingScheduled = (selectedPlan.visits || []).filter(vis => vis._id !== v._id && ['scheduled', 'rescheduled', 'due'].includes(vis.status));
                                                                const isFinalVisit = remainingScheduled.length === 0;
                                                                const autoAmount = (isFinalVisit && selectedPlan.pendingBalance > 0) ? String(selectedPlan.pendingBalance) : '';
                                                                setPayModal({ visit: v, planId: selectedPlan._id, isFinalVisit });
                                                                setPayInput(p => ({
                                                                    ...p,
                                                                    amountPaid: autoAmount,
                                                                    paymentDate: todayStr(),
                                                                    paymentMethod: 'Cash',
                                                                    upiId: '',
                                                                    upiRef: '',
                                                                    confirmedReceipt: false,
                                                                    notes: ''
                                                                }));
                                                            }}
                                                        >
                                                            <Text style={{ color: isFutureVisit ? '#94a3b8' : '#16a34a', fontSize: 12, fontWeight: 'bold' }}>💵 Pay</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                    <TouchableOpacity
                                                        disabled={isFutureVisit || isBlocked}
                                                        style={[
                                                            {
                                                                backgroundColor: (isFutureVisit || isBlocked) ? '#f1f5f9' : '#dbeafe',
                                                                paddingHorizontal: 12,
                                                                paddingVertical: 6,
                                                                borderRadius: 6,
                                                                opacity: (isFutureVisit || isBlocked) ? 0.6 : 1
                                                            },
                                                            isBlocked && { borderWidth: 1, borderColor: '#cbd5e1' }
                                                        ]}
                                                        onPress={() => {
                                                            if (isBlocked) {
                                                                Alert.alert(
                                                                    'Payment Required',
                                                                    `Please collect ₹${Number(selectedPlan.pendingBalance).toLocaleString('en-IN')} first before closing the final visit.`
                                                                );
                                                            } else {
                                                                handleComplete(selectedPlan._id, v._id);
                                                            }
                                                        }}
                                                    >
                                                        <Text style={{ color: (isFutureVisit || isBlocked) ? '#94a3b8' : '#1d4ed8', fontSize: 12, fontWeight: 'bold' }}>✓ Done</Text>
                                                    </TouchableOpacity>
                                                    {!hasPriorPayment && (
                                                        <TouchableOpacity
                                                            disabled={isFutureVisit}
                                                            style={{
                                                                backgroundColor: isFutureVisit ? '#f1f5f9' : '#fee2e2',
                                                                paddingHorizontal: 12,
                                                                paddingVertical: 6,
                                                                borderRadius: 6,
                                                                opacity: isFutureVisit ? 0.6 : 1
                                                            }}
                                                            onPress={() => handleMiss(selectedPlan._id, v._id)}
                                                        >
                                                            <Text style={{ color: isFutureVisit ? '#94a3b8' : '#dc2626', fontSize: 12, fontWeight: 'bold' }}>✗ Missed</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </>
                                            );
                                        })()}
                                        {v.status === 'missed' && !v.rescheduledToDate && selectedPlan.status === 'active' && (
                                            <TouchableOpacity
                                                style={{ backgroundColor: '#f3e8ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                                                onPress={() => {
                                                    setRescheduleModal({ planId: selectedPlan._id, visit: v });
                                                    setRescheduleInput({ newDate: todayStr(), newTime: v.scheduledTime || '', remarks: '' });
                                                }}
                                            >
                                                <Text style={{ color: '#9333ea', fontSize: 12, fontWeight: 'bold' }}>🔄 Reschedule</Text>
                                            </TouchableOpacity>
                                        )}
                                        {v.amountPaid > 0 && <Text style={{ color: '#16a34a', fontWeight: 'bold', fontSize: 12, alignSelf: 'center' }}>Paid ₹{v.amountPaid.toLocaleString('en-IN')}</Text>}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Payment Modal – full UPI flow matching Web */}
                {payModal && (() => {
                    const amt = Number(payInput.amountPaid) || 0;
                    const amtExceedsBalance = amt > (selectedPlan?.pendingBalance || 0);
                    const amtValid = amt > 0 && !amtExceedsBalance;
                    const upiRefClean = (payInput.upiRef || '').replace(/\D/g, '');
                    const upiRefValid = upiRefClean.length === 12;
                    const upiIdTrimmed = (payInput.upiId || '').trim();
                    const upiIdValid = upiIdTrimmed.length > 0 && upiIdTrimmed.length <= 25;
                    const isUPI = payInput.paymentMethod === 'UPI';
                    const allValid = amtValid && (!isUPI || (upiIdValid && upiRefValid && payInput.confirmedReceipt));

                    return (
                        <Modal transparent visible animationType="fade">
                            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                                <ScrollView style={{ width: '100%' }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }} keyboardShouldPersistTaps="handled">
                                    <View style={{ backgroundColor: '#fff', padding: isNarrow ? 16 : 32, borderRadius: 14, width: '100%', maxWidth: 520 }}>
                                        <Text style={{ fontSize: 17, fontWeight: '700', marginBottom: 20, color: '#0f172a' }}>💵 Record Payment — Visit {payModal.visit.visitNumber}</Text>
                                        <View style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <Text style={{ fontSize: 13, color: '#475569' }}>Total Treatment</Text>
                                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>₹{Number(selectedPlan?.totalAmount || 0).toLocaleString('en-IN')}</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <Text style={{ fontSize: 13, color: '#475569' }}>Paid so far</Text>
                                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#16a34a' }}>₹{Number(selectedPlan?.totalPaid || 0).toLocaleString('en-IN')}</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#e2e8f0', paddingTop: 6 }}>
                                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#dc2626' }}>Outstanding Balance</Text>
                                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#dc2626' }}>₹{Number(selectedPlan?.pendingBalance || 0).toLocaleString('en-IN')}</Text>
                                            </View>
                                        </View>

                                        <Text style={styles.label}>Amount Paying Now (₹) *</Text>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                { marginBottom: 4 },
                                                (payModal.isFinalVisit && (selectedPlan?.pendingBalance || 0) > 0) && { backgroundColor: '#e2e8f0', color: '#64748b' }
                                            ]}
                                            keyboardType="numeric"
                                            editable={!(payModal.isFinalVisit && (selectedPlan?.pendingBalance || 0) > 0)}
                                            value={payInput.amountPaid}
                                            onChangeText={t => setPayInput(p => ({ ...p, amountPaid: t }))}
                                            placeholder={`Up to ₹${Number(selectedPlan?.pendingBalance || 0).toLocaleString('en-IN')}`}
                                        />
                                        {payModal.isFinalVisit && (selectedPlan?.pendingBalance || 0) > 0 && (
                                            <Text style={{ fontSize: 11, marginTop: 4, color: '#0891b2', fontWeight: '600' }}>
                                                🔒 Final visit — full remaining balance must be paid.
                                            </Text>
                                        )}
                                        {amtExceedsBalance && (
                                            <Text style={{ fontSize: 12, marginTop: 4, color: '#dc2626', fontWeight: '600' }}>
                                                ⚠️ Payment amount cannot exceed outstanding balance.
                                            </Text>
                                        )}
                                        {amtValid && !amtExceedsBalance && (
                                            <Text style={{ fontSize: 12, marginTop: 4, color: amt >= (selectedPlan?.pendingBalance || 0) ? '#16a34a' : '#f97316', fontWeight: '600' }}>
                                                {amt >= (selectedPlan?.pendingBalance || 0)
                                                    ? '✓ This will clear the full outstanding balance.'
                                                    : `After payment: ₹${Math.max(0, (selectedPlan?.pendingBalance || 0) - amt).toLocaleString('en-IN')} still pending.`}
                                            </Text>
                                        )}

                                        <Text style={[styles.label, { marginTop: 14 }]}>Payment Date *</Text>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: '#f8fafc', color: '#64748b', marginBottom: 12 }]}
                                            editable={false}
                                            value={todayStr()}
                                        />

                                        <Text style={styles.label}>Payment Method *</Text>
                                        <View style={[styles.pickerWrapper, { marginBottom: 12 }]}>
                                            <Picker
                                                selectedValue={payInput.paymentMethod}
                                                onValueChange={val => setPayInput(p => ({ ...p, paymentMethod: val, upiId: '', upiRef: '', confirmedReceipt: false }))}
                                            >
                                                <Picker.Item label="Cash" value="Cash" />
                                                <Picker.Item label="UPI" value="UPI" />
                                            </Picker>
                                        </View>

                                        {/* UPI Section */}
                                        {isUPI && (
                                            <View style={{ backgroundColor: '#f0fdf4', borderColor: '#86efac', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12, gap: 10 }}>
                                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#15803d' }}>💳 UPI Payment Details</Text>

                                                <View>
                                                    <Text style={styles.label}>UPI ID *</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        placeholder="e.g. 9948977432 or payments@upi"
                                                        value={payInput.upiId}
                                                        onChangeText={t => {
                                                            let val = t;
                                                            setPayInput(p => ({ ...p, upiId: val.slice(0, 25) }));
                                                        }}
                                                        onBlur={() => {
                                                            const val = (payInput.upiId || '').trim();
                                                            if (/^\d{10}$/.test(val)) {
                                                                setPayInput(p => ({ ...p, upiId: val + '@ybl' }));
                                                            }
                                                        }}
                                                        autoCapitalize="none"
                                                        maxLength={25}
                                                    />
                                                    <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>
                                                        10-digit mobile will auto-append @ybl · Max 25 characters
                                                    </Text>
                                                </View>

                                                {payInput.upiId && payInput.amountPaid && Number(payInput.amountPaid) > 0 && (
                                                    <View style={{ alignItems: 'center', marginVertical: 8 }}>
                                                        <Text style={{ fontSize: 12, color: '#15803d', marginBottom: 6, fontWeight: '600' }}>Scan QR to Pay ₹{payInput.amountPaid}</Text>
                                                        <Image
                                                            source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=upi://pay?pa=${encodeURIComponent(upiIdTrimmed)}&pn=${encodeURIComponent(selectedPlan?.title || 'Clinic')}&am=${encodeURIComponent(payInput.amountPaid)}&cu=INR` }}
                                                            style={{ width: Math.min(140, screenWidth - 100), height: Math.min(140, screenWidth - 100), borderRadius: 8 }}
                                                            resizeMode="contain"
                                                        />
                                                    </View>
                                                )}

                                                <View>
                                                    <Text style={styles.label}>Transaction Reference Number (Ref #) *</Text>
                                                    <TextInput
                                                        style={[styles.input, {
                                                            borderColor: upiRefClean.length > 0 && !upiRefValid ? '#dc2626' : (upiRefValid ? '#16a34a' : '#e2e8f0')
                                                        }]}
                                                        placeholder="Enter 12-digit UPI reference ID"
                                                        value={payInput.upiRef}
                                                        onChangeText={t => {
                                                            const val = t.replace(/\D/g, '').slice(0, 12);
                                                            setPayInput(p => ({ ...p, upiRef: val }));
                                                        }}
                                                        keyboardType="number-pad"
                                                        maxLength={12}
                                                    />
                                                    {upiRefClean.length > 0 && !upiRefValid && (
                                                        <Text style={{ color: '#dc2626', fontSize: 11, marginTop: 3, fontWeight: '600' }}>
                                                            Enter a valid 12-character transaction reference. ({upiRefClean.length}/12)
                                                        </Text>
                                                    )}
                                                    {upiRefValid && (
                                                        <Text style={{ color: '#16a34a', fontSize: 11, marginTop: 3, fontWeight: '600' }}>
                                                            ✓ Valid reference ({upiRefClean.length}/12)
                                                        </Text>
                                                    )}
                                                </View>

                                                <TouchableOpacity
                                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}
                                                    onPress={() => setPayInput(p => ({ ...p, confirmedReceipt: !p.confirmedReceipt }))}
                                                >
                                                    <View style={{
                                                        width: 20, height: 20, borderRadius: 4,
                                                        borderWidth: 2, borderColor: payInput.confirmedReceipt ? '#16a34a' : '#94a3b8',
                                                        backgroundColor: payInput.confirmedReceipt ? '#16a34a' : '#fff',
                                                        justifyContent: 'center', alignItems: 'center'
                                                    }}>
                                                        {payInput.confirmedReceipt && <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</Text>}
                                                    </View>
                                                    <Text style={{ fontSize: 13, color: '#374151', flex: 1 }}>I have confirmed the payment receipt on the device</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 4 }}>
                                            <Text style={styles.label}>Notes (optional)</Text>
                                            <Text style={{ fontSize: 11, color: (payInput.notes || '').length >= 300 ? '#ef4444' : '#64748b', fontWeight: '600' }}>
                                                {(payInput.notes || '').length} / 300
                                            </Text>
                                        </View>
                                        <TextInput
                                            style={[styles.input, { marginBottom: 16 }]}
                                            placeholder="e.g. Partial payment, cash given"
                                            maxLength={300}
                                            value={payInput.notes}
                                            onChangeText={t => setPayInput(p => ({ ...p, notes: t }))}
                                        />

                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                                            <TouchableOpacity style={[styles.btnPrimary, { flex: 1, minWidth: 100, backgroundColor: '#f1f5f9', alignItems: 'center' }]} onPress={() => setPayModal(null)}>
                                                <Text style={{ color: '#475569', fontWeight: 'bold' }}>Cancel</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.btnPrimary, { flex: 1, minWidth: 140, alignItems: 'center' }, (!allValid || saving) && { opacity: 0.6 }]}
                                                disabled={saving || !allValid}
                                                onPress={handlePay}
                                            >
                                                <Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : '✅ Confirm Payment'}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </ScrollView>
                            </View>
                        </Modal>
                    );
                })()}

                {/* Reschedule Modal */}
                {rescheduleModal && (
                    <Modal transparent visible animationType="fade">
                        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: isNarrow ? 10 : 20 }}>
                            <View style={{ backgroundColor: '#fff', padding: isNarrow ? 16 : 28, borderRadius: 14, width: '100%', maxWidth: 400 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#0f172a' }}>🔄 Reschedule Visit {rescheduleModal.visit?.visitNumber}</Text>
                                <View style={{ backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                                    <Text style={{ fontSize: 12, color: '#6d28d9', fontWeight: 'bold', marginBottom: 2 }}>ℹ️ Automatic Date Shifter Enabled</Text>
                                    <Text style={{ fontSize: 11, color: '#6d28d9' }}>All subsequent scheduled visits will automatically move forward to maintain their relative spacing.</Text>
                                </View>

                                <Text style={styles.label}>New Visit Date *</Text>
                                <DatePickerInput
                                    value={rescheduleInput.newDate}
                                    onChange={d => setRescheduleInput(p => ({ ...p, newDate: d }))}
                                    placeholder="YYYY-MM-DD"
                                    title="Select Date"
                                />

                                <Text style={[styles.label, { marginTop: 12 }]}>New Visit Time (optional)</Text>
                                <TextInput
                                    style={[styles.input, { marginBottom: 12 }]}
                                    placeholder="e.g. 10:30 AM"
                                    value={rescheduleInput.newTime}
                                    onChangeText={t => setRescheduleInput(p => ({ ...p, newTime: t }))}
                                />

                                <Text style={styles.label}>Reason / Remarks (optional)</Text>
                                <TextInput
                                    style={[styles.input, { marginBottom: 16 }]}
                                    placeholder="e.g. Patient requested new slot"
                                    value={rescheduleInput.remarks}
                                    onChangeText={t => setRescheduleInput(p => ({ ...p, remarks: t }))}
                                />

                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                                    <TouchableOpacity style={[styles.btnPrimary, { flex: 1, minWidth: 100, backgroundColor: '#f1f5f9', alignItems: 'center' }]} onPress={() => setRescheduleModal(null)}>
                                        <Text style={{ color: '#475569', fontWeight: 'bold' }}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.btnPrimary, { flex: 1, minWidth: 140, alignItems: 'center', backgroundColor: '#9333ea' }]} disabled={saving} onPress={handleRescheduleSubmit}>
                                        <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : 'Reschedule Visit'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                )}
            </ScrollView>
        );
    }
    return null;
};

// ═══════════════════════════════════════════════════
// BILLING MODE
// ═══════════════════════════════════════════════════
const BillingMode = () => {
    const { width: screenWidth, isNarrow, isMobile, isTablet, isDesktop } = useResponsive();
    const [allRecords, setAllRecords] = useState([]);
    const [displayRecords, setDisplayRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [patSearch, setPatSearch] = useState('');
    const [detailsModal, setDetailsModal] = useState(null);

    // FIX C — BILLING KPI: Web auto-fit minmax(160px, 1fr) with max 5 cards
    // <= 480px: exactly 3 columns, gap 8 (@media (max-width: 480px) repeat(3, 1fr) !important)
    // > 480px: dynamic auto-fit min 160px, gap 14, capped at 5 cards
    const isMobileBilling = screenWidth <= 480;
    const billGap = isMobileBilling ? 8 : 14;
    const billContainerPadH = screenWidth < 375 ? 16 : (screenWidth < 600 ? 24 : 32);
    const billAvailWidth = screenWidth - billContainerPadH;
    const billCols = isMobileBilling
        ? 3
        : Math.min(5, Math.max(1, Math.floor((billAvailWidth + 14) / (160 + 14))));
    const billCardWidth = Math.floor((billAvailWidth - (billCols - 1) * billGap) / billCols);

    useEffect(() => {
        console.log('[ClinicDashboard] GET /api/clinic/appointments & treatment-plans & stats (Billing) START');
        Promise.allSettled([clinicAPI.getAppointments(), clinicAPI.getTreatmentPlans(), clinicAPI.getStats()])
            .then(([apptRes, plansRes, statsRes]) => {
                const apptR = apptRes.status === 'fulfilled' ? apptRes.value : { success: false, appointments: [] };
                const plansR = plansRes.status === 'fulfilled' ? plansRes.value : { success: false, plans: [] };
                const statsR = statsRes.status === 'fulfilled' ? statsRes.value : { success: false, stats: null };

                if (apptRes.status === 'fulfilled' && apptRes.value?.success) {
                    console.log('[ClinicDashboard] GET /api/clinic/appointments (Billing) STATUS 200');
                    console.log('[ClinicDashboard] appointments count:', (apptR.appointments || []).length);
                } else if (apptRes.status === 'rejected') {
                    const err = apptRes.reason;
                    const status = err?.response?.status || 'FAIL';
                    console.log('[ClinicDashboard] GET /api/clinic/appointments (Billing) STATUS', status, err?.response?.data || err?.message);
                }

                if (plansRes.status === 'fulfilled' && plansRes.value?.success) {
                    console.log('[ClinicDashboard] GET /api/clinic/treatment-plans (Billing) STATUS 200');
                    console.log('[ClinicDashboard] treatment-plans count:', (plansR.plans || []).length);
                } else if (plansRes.status === 'rejected') {
                    const err = plansRes.reason;
                    const status = err?.response?.status || 'FAIL';
                    console.log('[ClinicDashboard] GET /api/clinic/treatment-plans (Billing) STATUS', status, err?.response?.data || err?.message);
                }

                if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
                    console.log('[ClinicDashboard] GET /api/clinic/stats (Billing) STATUS 200');
                    console.log('[ClinicDashboard] setStats called: true');
                    setStats(statsRes.value.stats);
                } else if (statsRes.status === 'rejected') {
                    const err = statsRes.reason;
                    const status = err?.response?.status || 'FAIL';
                    console.log('[ClinicDashboard] GET /api/clinic/stats (Billing) STATUS', status, err?.response?.data || err?.message);
                }
                let combined = [];

                // 1. Consultation Bills (appointments with paid status or amount > 0)
                if (apptR.success && Array.isArray(apptR.appointments)) {
                    apptR.appointments
                        .filter(a => a.paymentStatus === 'paid' || (a.amount && a.amount > 0))
                        .forEach(a => {
                            combined.push({
                                _id: a._id,
                                date: a.appointmentDate,
                                tokenOrSlot: a.tokenNumber ? `#${a.tokenNumber}` : (a.appointmentTime ? `🕐 ${a.appointmentTime}` : 'Token'),
                                patientName: a.clinicPatientId?.name || '—',
                                patientUid: a.clinicPatientId?.patientUid || a.patientId || '—',
                                serviceName: a.serviceName || 'General Consultation',
                                category: 'Consultation Fee',
                                amount: a.amount || 0,
                                pendingAmount: 0,
                                paymentMethod: a.paymentMethod || 'Cash',
                                status: a.status || 'completed',
                                cardRef: a.cardRef,
                                upiScreenshotUrl: a.upiScreenshotUrl,
                                type: 'consultation',
                                rawRecord: a
                            });
                        });
                }

                // 2. Treatment Plan Bills / Procedures
                if (plansR.success && Array.isArray(plansR.plans)) {
                    plansR.plans.forEach(plan => {
                        const pName = plan.clinicPatientId?.name || plan.patientName || '—';
                        const pUid = plan.clinicPatientId?.patientUid || '—';

                        if (Array.isArray(plan.visits) && plan.visits.length > 0) {
                            plan.visits.forEach((v, idx) => {
                                if (v.isPaid || (v.amountPaid && v.amountPaid > 0) || (v.cost && v.cost > 0)) {
                                    combined.push({
                                        _id: `${plan._id}_v${v._id || idx}`,
                                        date: v.paidAt || v.completedAt || v.dueDate || plan.createdAt,
                                        tokenOrSlot: `Plan: ${plan.title || 'Procedure'}`,
                                        patientName: pName,
                                        patientUid: pUid,
                                        serviceName: `Treatment Plan: ${plan.title || 'Procedure'} (Visit #${v.visitNumber || (idx + 1)})`,
                                        category: 'Treatment Plan / Procedure',
                                        amount: v.amountPaid || (v.isPaid ? (v.cost || 0) : 0),
                                        pendingAmount: plan.pendingBalance || 0,
                                        paymentMethod: v.paymentMethod || 'Cash',
                                        status: v.isPaid ? 'completed' : (v.status || plan.status || 'pending'),
                                        type: 'treatment_plan',
                                        cardRef: v.cardRef,
                                        upiScreenshotUrl: v.upiScreenshotUrl,
                                        rawRecord: plan,
                                        rawVisit: v
                                    });
                                }
                            });
                        } else {
                            combined.push({
                                _id: plan._id,
                                date: plan.createdAt,
                                tokenOrSlot: `Plan: ${plan.title || 'Procedure'}`,
                                patientName: pName,
                                patientUid: pUid,
                                serviceName: `Treatment Plan: ${plan.title || 'Procedure'}`,
                                category: 'Treatment Plan / Procedure',
                                amount: plan.totalPaid || 0,
                                pendingAmount: plan.pendingBalance || 0,
                                paymentMethod: 'Multiple / Cash',
                                status: plan.status || 'active',
                                type: 'treatment_plan',
                                rawRecord: plan
                            });
                        }
                    });
                }

                // Sort by date descending
                combined.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

                setAllRecords(combined);
                setDisplayRecords(combined);
                if (statsR.success) setStats(statsR.stats);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const filterByPatient = () => {
        if (!patSearch.trim()) {
            setDisplayRecords(allRecords);
            return;
        }
        const q = patSearch.trim().toLowerCase();
        setDisplayRecords(allRecords.filter(r =>
            (r.patientName || '').toLowerCase().includes(q) ||
            (r.patientUid || '').toLowerCase().includes(q) ||
            (r.serviceName || '').toLowerCase().includes(q)
        ));
    };

    const todayTotal = allRecords
        .filter(r => new Date(r.date).toDateString() === new Date().toDateString())
        .reduce((s, r) => s + (r.amount || 0), 0);

    const handleInvoice = async (r, action = 'view') => {
        try {
            const { hName, hAddr, hPhone, issuedBy } = await getClinicInfo();
            const html = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="utf-8" />
                        <title>Invoice - ${r.patientName || 'Receipt'}</title>
                        <style>
                            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; margin: 0; }
                            .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #2563eb; padding-bottom: 12px; }
                            .title { font-size: 20px; font-weight: 800; color: #2563eb; margin: 6px 0; text-transform: uppercase; }
                            .sub { font-size: 12px; color: #64748b; margin: 2px 0; }
                            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
                            .grid { display: flex; justify-content: space-between; font-size: 13px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
                            th { background-color: #2980b9; color: white; padding: 10px; text-align: left; }
                            td { border: 1px solid #e2e8f0; padding: 10px; }
                            .paid { color: #16a34a; font-weight: bold; background-color: #f0fdf4; }
                            .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 12px; color: #64748b; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h2 style="margin: 0; color: #0f172a;">${hName}</h2>
                            <p class="sub">${hAddr || ''} ${hPhone ? `| Ph: ${hPhone}` : ''}</p>
                            <div class="title">INVOICE / RECEIPT</div>
                        </div>

                        <div class="card">
                            <div style="font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">Patient Information</div>
                            <div class="grid">
                                <div><strong>Name:</strong> ${r.patientName || '—'}</div>
                                <div><strong>Patient ID:</strong> ${r.patientUid || '—'}</div>
                                <div><strong>Date:</strong> ${new Date(r.date || Date.now()).toLocaleDateString('en-IN')}</div>
                            </div>
                        </div>

                        <table>
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th style="text-align: right;">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Date & Time</td>
                                    <td style="text-align: right;">${new Date(r.date || Date.now()).toLocaleString('en-IN')}</td>
                                </tr>
                                <tr>
                                    <td>Service / Procedure</td>
                                    <td style="text-align: right;">${r.serviceName || '—'}</td>
                                </tr>
                                <tr>
                                    <td>Token / Plan Reference</td>
                                    <td style="text-align: right;">${r.tokenOrSlot || '—'}</td>
                                </tr>
                                <tr>
                                    <td>Payment Method</td>
                                    <td style="text-align: right;">${r.paymentMethod || 'Cash'}${r.cardRef ? ` (Ref: ${r.cardRef})` : ''}</td>
                                </tr>
                                <tr class="paid">
                                    <td>Paid Amount</td>
                                    <td style="text-align: right; color: #16a34a;">₹${Number(r.amount || 0).toLocaleString('en-IN')}</td>
                                </tr>
                                <tr>
                                    <td>Pending Balance</td>
                                    <td style="text-align: right; color: ${Number(r.pendingAmount || 0) > 0 ? '#dc2626' : '#64748b'}; font-weight: ${Number(r.pendingAmount || 0) > 0 ? 'bold' : 'normal'};">₹${Number(r.pendingAmount || 0).toLocaleString('en-IN')}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div class="footer">
                            <div>
                                <p style="margin: 0;">Issued by: <strong>${issuedBy}</strong></p>
                                <p style="margin: 4px 0 0 0;">Thank you for your visit!</p>
                            </div>
                            <div style="text-align: right;">
                                <div style="height: 40px; border-bottom: 1px solid #94a3b8; width: 140px; margin-bottom: 4px;"></div>
                                <p style="margin: 0; font-weight: bold;">Authorized Signatory</p>
                            </div>
                        </div>
                    </body>
                </html>
            `;
            if (action === 'download') {
                const { uri } = await Print.printToFileAsync({ html });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
                } else {
                    Alert.alert('Invoice Saved', `PDF created at: ${uri}`);
                }
            } else {
                await Print.printAsync({ html });
            }
        } catch (e) {
            console.warn('Invoice generation error:', e);
            Alert.alert('Error', 'Failed to generate invoice.');
        }
    };

    return (
        <ScrollView style={styles.container}>
            {/* Collection Summary Strip */}
            {stats && (
                <View style={[styles.kpiGrid, { gap: billGap, marginBottom: isMobileBilling ? 12 : 16 }]}>
                    {[
                        { label: 'Total Collection', value: fmt(stats.totalRevenue || allRecords.reduce((sum, r) => sum + (r.amount || 0), 0)), icon: '💰', color: '#f59e0b' },
                        { label: "Today's Collection", value: fmt(stats.todayRevenue || todayTotal), icon: '📅', color: '#10b981' },
                        { label: 'Treatment Plan Revenue', value: fmt(stats.treatmentPlanRevenue || 0), icon: '📋', color: '#0891b2' },
                        { label: 'Treatment Plan Pending', value: fmt(stats.treatmentPlanPending || 0), icon: '⏳', color: '#dc2626' },
                        { label: 'Total Paid Transactions', value: String(allRecords.filter(r => (r.amount || 0) > 0).length), icon: '✅', color: '#0ea5e9' },
                    ].map((k, i) => (
                        <View key={i} style={[styles.kpiCard, {
                            borderTopColor: k.color,
                            borderTopWidth: 4,
                            borderRadius: 12,
                            backgroundColor: '#fff',
                            borderColor: '#e2e8f0',
                            borderWidth: 1,
                            flex: 0,
                            width: billCardWidth,
                            minWidth: billCardWidth,
                            maxWidth: billCardWidth,
                            paddingVertical: isMobileBilling ? 12 : 18,
                            paddingHorizontal: isMobileBilling ? 8 : 16,
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 3,
                            elevation: 1
                        }]}>
                            <Text style={{ fontSize: isMobileBilling ? 20 : 24 }}>{k.icon}</Text>
                            <Text style={{ fontSize: isMobileBilling ? 16 : 20, fontWeight: '800', color: k.color, marginVertical: 4 }}>{k.value}</Text>
                            <Text style={{ fontSize: isMobileBilling ? 11 : 12, color: '#64748b', textAlign: 'center' }}>{k.label}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={[styles.clinicCard, isMobile && styles.cardMobile]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>🧾 Billing & Collection Records</Text>
                    <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                        <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: 'bold' }}>Consultations & Treatment Plans</Text>
                    </View>
                </View>

                <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 8, marginBottom: 14 }}>
                    <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder="Search by patient name, ID or procedure..."
                        value={patSearch}
                        onChangeText={setPatSearch}
                        onSubmitEditing={filterByPatient}
                    />
                    <TouchableOpacity style={[styles.btnSecondary, { paddingHorizontal: 14, justifyContent: 'center' }]} onPress={filterByPatient}>
                        <Text style={styles.btnSecondaryText}>Search</Text>
                    </TouchableOpacity>
                    {patSearch ? (
                        <TouchableOpacity style={[styles.btnSecondary, { paddingHorizontal: 12, justifyContent: 'center', backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]} onPress={() => { setPatSearch(''); setDisplayRecords(allRecords); }}>
                            <Text style={{ color: '#dc2626', fontWeight: 'bold', fontSize: 12 }}>✕ Clear</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                {loading ? (
                    <Spinner />
                ) : displayRecords.length === 0 ? (
                    <Empty text="No collection records found." />
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                        <View style={{ minWidth: 1000 }}>
                            {/* Table Header */}
                            <View style={[styles.tableHeader, { paddingHorizontal: 8 }]}>
                                <Text style={[styles.th, { width: 90 }]}>Date</Text>
                                <Text style={[styles.th, { width: 110 }]}>Type</Text>
                                <Text style={[styles.th, { width: 100 }]}>Token / Plan</Text>
                                <Text style={[styles.th, { width: 140 }]}>Patient</Text>
                                <Text style={[styles.th, { width: 160 }]}>Service / Procedure</Text>
                                <Text style={[styles.th, { width: 90 }]}>Paid Fee</Text>
                                <Text style={[styles.th, { width: 100 }]}>Pending Dues</Text>
                                <Text style={[styles.th, { width: 110 }]}>Method</Text>
                                <Text style={[styles.th, { width: 100 }]}>Status</Text>
                                <Text style={[styles.th, { width: 140, textAlign: 'right' }]}>Actions</Text>
                            </View>

                            {/* Table Rows */}
                            {displayRecords.map((r, i) => (
                                <View key={r._id || i} style={[styles.tableRow, { paddingHorizontal: 8, backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc' }]}>
                                    <View style={{ width: 90 }}>
                                        <Text style={{ fontSize: 12, color: '#334155' }}>{fmtDate(r.date)}</Text>
                                    </View>
                                    <View style={{ width: 110 }}>
                                        <View style={{
                                            backgroundColor: r.type === 'treatment_plan' ? '#ecfeff' : '#f0fdf4',
                                            paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start'
                                        }}>
                                            <Text style={{
                                                color: r.type === 'treatment_plan' ? '#0891b2' : '#16a34a',
                                                fontSize: 10, fontWeight: '700'
                                            }}>
                                                {r.category || (r.type === 'treatment_plan' ? 'Treatment Plan' : 'Consultation')}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={{ width: 100 }}>
                                        <Text style={{ fontWeight: 'bold', color: '#6366f1', fontSize: 12 }}>{r.tokenOrSlot}</Text>
                                    </View>
                                    <View style={{ width: 140 }}>
                                        <Text style={{ fontWeight: '600', color: '#1e293b', fontSize: 12 }} numberOfLines={1}>{r.patientName}</Text>
                                        <Text style={{ fontSize: 11, color: '#94a3b8' }}>{r.patientUid}</Text>
                                    </View>
                                    <View style={{ width: 160 }}>
                                        <Text style={{ fontSize: 12, color: '#334155' }} numberOfLines={2}>{r.serviceName}</Text>
                                    </View>
                                    <View style={{ width: 90 }}>
                                        <Text style={{ fontWeight: 'bold', color: '#16a34a', fontSize: 13 }}>{fmt(r.amount)}</Text>
                                    </View>
                                    <View style={{ width: 90 }}>
                                        {r.pendingAmount > 0 ? (
                                            <Text style={{ fontWeight: 'bold', color: '#dc2626', fontSize: 13 }}>{fmt(r.pendingAmount)}</Text>
                                        ) : (
                                            <Text style={{ color: '#94a3b8', fontSize: 12 }}>₹0</Text>
                                        )}
                                    </View>
                                    <View style={{ width: 110 }}>
                                        <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' }}>
                                            <Text style={{ fontSize: 10, color: '#475569', fontWeight: '600' }}>{r.paymentMethod || 'Cash'}</Text>
                                        </View>
                                        {r.cardRef ? <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Ref: {r.cardRef}</Text> : null}
                                        {r.upiScreenshotUrl ? (
                                            <TouchableOpacity onPress={() => Linking.openURL(r.upiScreenshotUrl)}>
                                                <Text style={{ fontSize: 10, color: '#3b82f6', marginTop: 2, textDecorationLine: 'underline' }}>📎 Screenshot</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                    <View style={{ width: 100 }}>
                                        <StatusBadge status={r.status} />
                                        {r.type === 'treatment_plan' && r.rawVisit?.rescheduledToDate ? (
                                            <TouchableOpacity
                                                style={{ marginTop: 4, backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ddd6fe', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' }}
                                                onPress={() => setDetailsModal(r)}
                                            >
                                                <Text style={{ fontSize: 9, color: '#8b5cf6', fontWeight: '700' }}>🔄 Rescheduled</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                    <View style={{ width: 140, flexDirection: 'row', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                                        <TouchableOpacity
                                            style={[styles.btnSecondary, { paddingHorizontal: 6, paddingVertical: 4 }]}
                                            onPress={() => setDetailsModal(r)}
                                        >
                                            <Text style={{ fontSize: 11, color: '#334155' }}>👁️ Details</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.btnSecondary, { paddingHorizontal: 6, paddingVertical: 4, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}
                                            onPress={() => handleInvoice(r, 'view')}
                                        >
                                            <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: 'bold' }}>📄</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.btnSecondary, { paddingHorizontal: 6, paddingVertical: 4 }]}
                                            onPress={() => handleInvoice(r, 'download')}
                                        >
                                            <Text style={{ fontSize: 11 }}>⬇️</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                )}
            </View>

            {/* View Details Modal */}
            {detailsModal && (
                <Modal transparent visible animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: isNarrow ? 10 : 16 }}>
                        <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: isNarrow ? 14 : 28, width: '100%', maxWidth: 550, maxHeight: '90%' }}>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderColor: '#e2e8f0', paddingBottom: 12 }}>
                                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a' }}>📑 Billing Details</Text>
                                    <TouchableOpacity onPress={() => setDetailsModal(null)}>
                                        <Ionicons name="close" size={24} color="#64748b" />
                                    </TouchableOpacity>
                                </View>

                                {/* Patient Information */}
                                <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                    <View>
                                        <Text style={{ fontSize: 10, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Patient</Text>
                                        <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1e293b' }}>{detailsModal.patientName}</Text>
                                        <Text style={{ fontSize: 12, color: '#64748b' }}>{detailsModal.patientUid}</Text>
                                        {detailsModal.rawRecord?.clinicPatientId?.phone ? (
                                            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>📞 {detailsModal.rawRecord.clinicPatientId.phone}</Text>
                                        ) : null}
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontSize: 10, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Date</Text>
                                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#334155' }}>{fmtDate(detailsModal.date)}</Text>
                                        <View style={{ marginTop: 4 }}>
                                            <StatusBadge status={detailsModal.status} />
                                        </View>
                                        {detailsModal.type === 'treatment_plan' && detailsModal.rawVisit?.rescheduledToDate ? (
                                            <View style={{ marginTop: 4, backgroundColor: '#f5f3ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                <Text style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 'bold' }}>
                                                    🔄 Rescheduled: {fmtDate(detailsModal.rawVisit.rescheduledToDate)}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>

                                {/* Treatment & Payment Summary */}
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 8, borderBottomWidth: 1, borderColor: '#e2e8f0', paddingBottom: 4 }}>
                                        Treatment & Payment Summary
                                    </Text>
                                    <View style={{ gap: 8 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ color: '#64748b', fontSize: 13 }}>Service / Procedure:</Text>
                                            <Text style={{ fontWeight: '600', color: '#1e293b', fontSize: 13, flex: 1, textAlign: 'right' }}>{detailsModal.serviceName}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ color: '#64748b', fontSize: 13 }}>Payment Method:</Text>
                                            <Text style={{ fontWeight: '600', color: '#1e293b', fontSize: 13 }}>{detailsModal.paymentMethod}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ color: '#64748b', fontSize: 13 }}>Paid Amount:</Text>
                                            <Text style={{ fontWeight: 'bold', color: '#16a34a', fontSize: 15 }}>₹{detailsModal.amount}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={{ color: '#64748b', fontSize: 13 }}>Pending Balance:</Text>
                                            <Text style={{ fontWeight: 'bold', color: (detailsModal.pendingAmount > 0) ? '#dc2626' : '#94a3b8', fontSize: 15 }}>
                                                ₹{detailsModal.pendingAmount}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Complete Payment History for Treatment Plans */}
                                {detailsModal.type === 'treatment_plan' && detailsModal.rawVisit?.paymentHistory?.length > 0 && (
                                    <View style={{ marginBottom: 16 }}>
                                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 8, borderBottomWidth: 1, borderColor: '#e2e8f0', paddingBottom: 4 }}>
                                            Complete Payment History
                                        </Text>
                                        {detailsModal.rawVisit.paymentHistory.map((ph, idx) => (
                                            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f1f5f9' }}>
                                                <Text style={{ fontSize: 12, color: '#475569' }}>{fmtDate(ph.date)}</Text>
                                                <Text style={{ fontSize: 12, color: '#64748b' }}>{ph.method}</Text>
                                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#16a34a' }}>₹{ph.amount}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Action Buttons */}
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                    <TouchableOpacity style={[styles.btnSecondary, { flex: 1 }]} onPress={() => setDetailsModal(null)}>
                                        <Text style={styles.btnSecondaryText}>Close</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.btnPrimary, { flex: 1.2, alignItems: 'center' }]} onPress={() => handleInvoice(detailsModal, 'view')}>
                                        <Text style={styles.btnPrimaryText}>📄 View</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.btnPrimary, { flex: 1.4, alignItems: 'center', backgroundColor: '#10b981' }]} onPress={() => handleInvoice(detailsModal, 'download')}>
                                        <Text style={styles.btnPrimaryText}>⬇️ Download</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}
        </ScrollView>
    );
};

// ─────────────────────────────────────────────
// Small shared components
// ─────────────────────────────────────────────
const Spinner = ({ text = 'Loading...' }) => (
    <View style={{ padding: 40, alignItems: 'center' }}>
        <Text style={{ color: '#94a3b8', fontSize: 14 }}>{text}</Text>
    </View>
);

const Empty = ({ text }) => (
    <View style={{ padding: 32, alignItems: 'center' }}>
        <Text style={{ color: '#94a3b8', fontSize: 14 }}>{text}</Text>
    </View>
);

const StatusBadge = ({ status }) => {
    const map = {
        pending: { bg: '#fef9c3', color: '#854d0e' },
        confirmed: { bg: '#dbeafe', color: '#1d4ed8' },
        completed: { bg: '#dcfce7', color: '#16a34a' },
        cancelled: { bg: '#fee2e2', color: '#dc2626' },
    };
    const s = map[status] || { bg: '#f1f5f9', color: '#64748b' };
    return (
        <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
            <Text style={{ color: s.color, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>{status}</Text>
        </View>
    );
};

const PayBadge = ({ status }) => {
    const color = status === 'paid' ? '#16a34a' : status === 'refunded' ? '#0ea5e9' : '#dc2626';
    return <Text style={{ color, fontWeight: 'bold', fontSize: 12 }}>{status}</Text>;
};


const PatientReportPanel = ({ patientId, patientName }) => {
    const { width: screenWidth, isNarrow, isMobile } = useResponsive();
    const [reports, setReports] = useState([]);
    const [viewReport, setViewReport] = useState(null);
    const [open, setOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [reportName, setReportName] = useState('');

    const loadReports = useCallback(async () => {
        if (!patientId) return;
        try {
            const r = await clinicAPI.getPatientHistory(patientId);
            if (r.success) setReports(r.patient?.reports || []);
        } catch (e) {
            console.log('Error loading patient reports:', e);
        }
    }, [patientId]);

    useEffect(() => {
        loadReports();
    }, [loadReports]);

    const handlePickAndUpload = async () => {
        if (!patientId) return;
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf'],
                copyToCacheDirectory: true
            });

            if (res.canceled || !res.assets || !res.assets[0]) return;

            const file = res.assets[0];
            const name = reportName.trim() || file.name || 'Report';

            setUploading(true);
            const formData = new FormData();
            formData.append('report', {
                uri: file.uri,
                name: file.name || 'report.pdf',
                type: file.mimeType || 'application/pdf'
            });
            formData.append('name', name);

            const r = await clinicAPI.uploadPatientReport(patientId, formData);
            if (r.success) {
                Alert.alert('Success', 'Report uploaded successfully');
                setReportName('');
                loadReports();
            } else {
                Alert.alert('Upload Failed', r.message || 'Could not upload report');
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || err.message || 'File upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = (reportId) => {
        Alert.alert(
            'Delete Report',
            'Are you sure you want to delete this report?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const r = await clinicAPI.deletePatientReport(patientId, reportId);
                            if (r.success) {
                                setReports(prev => prev.filter(rp => (rp._id || rp.id) !== reportId));
                            } else {
                                Alert.alert('Error', r.message || 'Failed to delete');
                            }
                        } catch (e) {
                            Alert.alert('Error', e.response?.data?.message || 'Failed to delete');
                        }
                    }
                }
            ]
        );
    };

    if (!patientId) return null;

    return (
        <View style={{ marginVertical: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' }}>
            {viewReport && <ReportViewerModal report={viewReport} onClose={() => setViewReport(null)} />}
            <TouchableOpacity
                onPress={() => setOpen(o => !o)}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderBottomWidth: open ? 1 : 0, borderColor: '#e2e8f0' }}
            >
                <Text style={{ fontWeight: '700', fontSize: 13, color: '#1e293b' }}>
                    📄 Previous Reports ({reports.length})
                </Text>
                <Text style={{ color: '#64748b', fontWeight: '700' }}>{open ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {open && (
                <View style={{ padding: 12 }}>
                    {/* Upload Section */}
                    <View style={{ flexDirection: isNarrow ? 'column' : 'row', gap: 8, marginBottom: 12, alignItems: isNarrow ? 'stretch' : 'center' }}>
                        <TextInput
                            style={[styles.input, { flex: 1, backgroundColor: '#fff', fontSize: 15 }]}
                            placeholder="Report name (optional)"
                            value={reportName}
                            onChangeText={setReportName}
                        />
                        <TouchableOpacity
                            style={{ backgroundColor: uploading ? '#94a3b8' : '#6366f1', paddingHorizontal: 14, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 6 }}
                            disabled={uploading}
                            onPress={handlePickAndUpload}
                        >
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
                                {uploading ? 'Uploading...' : '⬆ Upload PDF / Image'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={{ width: '100%', fontSize: 11, color: '#94a3b8', marginTop: 2, marginBottom: 8 }}>Supports PDF, JPG, PNG, WEBP · max 20 MB</Text>

                    {/* Reports List */}
                    {reports.length === 0 ? (
                        <Text style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', paddingVertical: 12 }}>
                            No reports uploaded for {patientName || 'this patient'}.
                        </Text>
                    ) : (
                        <View style={{ gap: 8 }}>
                            {reports.map((r, i) => (
                                <View key={r._id || i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#fff', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 }}>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <Text style={{ fontSize: 20 }}>{(r.mimetype === 'application/pdf' || (r.filename || '').toLowerCase().endsWith('.pdf') || (r.name || '').toLowerCase().endsWith('.pdf')) ? '📄' : '🖼️'}</Text>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <Text style={{ fontWeight: '600', fontSize: 13, color: '#1e293b' }} numberOfLines={1}>{r.name || 'Report'}</Text>
                                            <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{(r.mimetype === 'application/pdf' || (r.filename || '').toLowerCase().endsWith('.pdf') || (r.name || '').toLowerCase().endsWith('.pdf')) ? 'PDF Document' : 'Image'} · {r.createdAt || r.uploadedAt ? new Date(r.createdAt || r.uploadedAt).toLocaleDateString('en-IN') : ''}</Text>
                                        </View>
                                    </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 6, flexShrink: 0 }}>
                                        <TouchableOpacity
                                            style={{ backgroundColor: '#e0e7ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                                            onPress={() => setViewReport(r)}
                                        >
                                            <Text style={{ color: '#4f46e5', fontSize: 11, fontWeight: '600' }}>View</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={{ backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}
                                            onPress={async () => {
                                                try {
                                                    const url = reportURL(r.filename);
                                                    await Linking.openURL(url);
                                                } catch (e) {
                                                    Alert.alert('Error', 'Cannot open report file');
                                                }
                                            }}
                                        >
                                            <Text style={{ color: '#16a34a', fontSize: 11, fontWeight: '600' }}>Download</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={{ backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                                            onPress={() => handleDelete(r._id || r.id)}
                                        >
                                            <Text style={{ color: '#dc2626', fontSize: 11, fontWeight: '600' }}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
    roleSwitcher: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginHorizontal: 16, marginTop: 16, marginBottom: 20, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 1 },
    switcherLabel: { fontWeight: '700', marginRight: 4, color: '#475569', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
    switcherScroll: { flexGrow: 0 },
    switcherButtons: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    switcherBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    switcherBtnText: { fontWeight: '600', fontSize: 14, color: '#475569' },
    switcherUser: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 8 },
    switcherAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center' },
    switcherAvatarText: { color: '#6366f1', fontWeight: '700', fontSize: 14 },
    switcherUserName: { fontWeight: '600', color: '#334155', fontSize: 13 },
    downloadAlert: { margin: 16, padding: 12, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 10 },
    downloadAlertText: { color: '#065f46', fontWeight: 'bold' },
    modeContent: { flex: 1, paddingHorizontal: 16, paddingBottom: 24 },

    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 20 },
    kpiCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', paddingVertical: 18, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', borderTopWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 1 },
    kpiToggleBtn: { alignSelf: 'center', width: '100%', marginTop: 8, marginBottom: 16, padding: 10, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 8, alignItems: 'center' },
    kpiToggleText: { color: '#6366f1', fontWeight: '700', fontSize: 13 },

    clinicCard: { backgroundColor: '#fff', padding: 24, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 1 },
    cardMobile: { paddingVertical: 14, paddingHorizontal: 10, marginBottom: 12 },
    dropdownBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 6 },
    dropdownMenu: { position: 'absolute', right: 16, top: 50, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 6, zIndex: 50, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
    dropdownItem: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },

    tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 2, borderColor: '#cbd5e1' },
    tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
    th: { fontWeight: '700', color: '#334155', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
    td: { fontSize: 13, color: '#0f172a' },

    label: { fontSize: 12, color: '#475569', marginBottom: 4, fontWeight: '700', letterSpacing: 0.3 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: '#1e293b' },
    rxInput: { width: '100%', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 5, paddingVertical: 5, paddingHorizontal: 7, fontSize: 12, backgroundColor: '#fff', color: '#1e293b' },
    pickerWrapper: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 6, overflow: 'hidden' },
    btnPrimary: { backgroundColor: '#6366f1', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    btnSecondary: { backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    btnSecondaryText: { color: '#475569', fontWeight: '600', fontSize: 14 },
    btnRemove: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
    btnRemoveText: { color: '#dc2626', fontWeight: '700', fontSize: 12 },
    backBtn: { backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4 },
    backBtnText: { color: '#475569', fontWeight: '600', fontSize: 13 },
    subTabs: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
    subTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    subTabActive: { borderColor: '#6366f1', backgroundColor: '#6366f1' },
    subTabText: { fontSize: 13, fontWeight: '600', color: '#475569' },
    subTabTextActive: { color: '#fff' },
    clinicAvatarSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center' },
    clinicAvatarLg: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#eff6ff', borderWidth: 2, borderColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
});

export default ClinicDashboard;
