import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Dimensions,
    Image,
    Modal,
    Platform,
    Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { billingAPI, admissionAPI, patientAPI, uploadAPI, hospitalAPI } from '../../utils/api';
import { useAuth } from '../../store/hooks';
import { toast, confirmToast } from '../../utils/confirmToast';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import DatePickerInput from '../../components/common/DatePickerInput';
import DropdownSelect from '../../components/common/DropdownSelect';
import PaymentSection from '../../components/PaymentSection';

const { width } = Dimensions.get('window');

// Number format helper (Exact Web: fmt)
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Format patient name to Title Case (Exact Web formatPatientName)
const formatPatientName = (name) => {
    if (!name || typeof name !== 'string') return '';
    return name
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
};

// Format time string (Exact Web formatTimeStr)
const formatTimeStr = (tStr) => {
    if (!tStr) return '';
    const s = String(tStr).trim();
    const m = s.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
    if (m) {
        let h = parseInt(m[1], 10);
        const min = m[2];
        const ampm = m[3];
        if (ampm) {
            return `${String(h).padStart(2, '0')}:${min} ${ampm.toUpperCase()}`;
        }
        const suffix = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${min} ${suffix}`;
    }
    return s;
};

// Format date with optional appointment time (Exact Web fmtDate)
const fmtDate = (d, apptTime = '') => {
    if (!d) return '—';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return '—';

    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();

    if (apptTime && ((hours === 5 && minutes === 30) || (hours === 0 && minutes === 0))) {
        const datePart = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        return `${datePart}, ${formatTimeStr(apptTime)}`;
    }

    return dateObj.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

// Booking date & time resolver (Exact Web getBookingDateTime)
const getBookingDateTime = (t) => {
    if (!t) return { dateStr: '—', timeStr: '' };

    let dt = null;
    const candidates = [
        t.bookingCreatedAt,
        t.billedItems?.appointments?.[0]?.createdAt,
        t.paymentDate,
        t.createdAt,
        t.appointmentDate
    ];

    for (const c of candidates) {
        if (c) {
            const d = new Date(c);
            if (!isNaN(d.getTime())) {
                const h = d.getHours();
                const m = d.getMinutes();
                const isMidnight = (h === 5 && m === 30) || (h === 0 && m === 0);
                if (!isMidnight || !dt) {
                    dt = d;
                    if (!isMidnight) break;
                }
            }
        }
    }

    if (!dt && t._id) {
        const rawId = String(t._id).replace(/^appt_payment_/, '');
        if (/^[0-9a-fA-F]{24}$/.test(rawId)) {
            try {
                const epoch = parseInt(rawId.substring(0, 8), 16) * 1000;
                const idDate = new Date(epoch);
                if (!isNaN(idDate.getTime())) {
                    dt = idDate;
                }
            } catch (e) { }
        }
    }

    if (!dt) dt = new Date();

    const dateStr = dt.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    const timeStr = dt.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    return { dateStr, timeStr };
};

// Timestamp resolver for sorting/filtering (Exact Web getTxnTimestamp)
const getTxnTimestamp = (t) => {
    if (!t) return 0;
    const candidates = [
        t.paymentDate,
        t.bookingCreatedAt,
        t.billedItems?.appointments?.[0]?.createdAt,
        t.createdAt,
        t.appointmentDate
    ];
    for (const c of candidates) {
        if (c) {
            const d = new Date(c);
            const tm = d.getTime();
            if (!isNaN(tm) && tm > 0) return tm;
        }
    }
    if (t._id) {
        const rawId = String(t._id).replace(/^appt_payment_/, '');
        if (/^[0-9a-fA-F]{24}$/.test(rawId)) {
            try {
                const epoch = parseInt(rawId.substring(0, 8), 16) * 1000;
                if (!isNaN(epoch) && epoch > 0) return epoch;
            } catch (e) { }
        }
    }
    return 0;
};

// Avatar colors generator (Exact Web getAvatarStyle)
const getAvatarStyle = (name = 'P') => {
    const char = (name.charAt(0) || 'P').toUpperCase();
    if (char === 'M') return { bg: '#dbeafe', color: '#1d4ed8' };
    if (char === 'P') return { bg: '#fce7f3', color: '#db2777' };
    if (char === 'J') return { bg: '#ede9fe', color: '#7c3aed' };
    if (['A', 'B', 'C', 'D'].includes(char)) return { bg: '#dcfce7', color: '#15803d' };
    if (['E', 'F', 'G', 'H'].includes(char)) return { bg: '#ffedd5', color: '#c2410c' };
    if (['K', 'L', 'N', 'O'].includes(char)) return { bg: '#e0e7ff', color: '#4338ca' };
    if (['Q', 'R', 'S', 'T'].includes(char)) return { bg: '#ccfbf1', color: '#0f766e' };
    return { bg: '#f1f5f9', color: '#475569' };
};

// Surgery date & time helper (Exact Web getSurgeryDateTime)
const getSurgeryDateTime = (s) => {
    if (!s) return { dateStr: '—', timeStr: '' };
    const dateRaw = s.surgeryDate || s.preferredDate || s.createdAt;
    let baseDate = dateRaw ? new Date(dateRaw) : null;
    if (!baseDate || isNaN(baseDate.getTime())) baseDate = new Date();

    const dateStr = baseDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    let timeStr = '';
    const rawTime = s.startTime || s.preferredTime || s.surgeryTime || s.time;
    if (rawTime && typeof rawTime === 'string' && rawTime.trim()) {
        const tTrim = rawTime.trim();
        const m = tTrim.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
        if (m) {
            let h = parseInt(m[1], 10);
            const min = m[2];
            const ampm = m[3];
            if (ampm) {
                timeStr = `${String(h).padStart(2, '0')}:${min} ${ampm.toLowerCase()}`;
            } else {
                const suffix = h >= 12 ? 'pm' : 'am';
                h = h % 12 || 12;
                timeStr = `${String(h).padStart(2, '0')}:${min} ${suffix}`;
            }
        } else {
            timeStr = tTrim.toLowerCase();
        }
    }

    if (!timeStr && s.createdAt) {
        const cDate = new Date(s.createdAt);
        if (!isNaN(cDate.getTime())) {
            timeStr = cDate.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).toLowerCase();
        }
    }

    return { dateStr, timeStr };
};

// Admission date & time helper (Exact Web fmtAdmissionDateTime)
const fmtAdmissionDateTime = (dateVal, timeVal, fallbackCreatedAt) => {
    if (!dateVal && !fallbackCreatedAt) return '—';
    const baseDate = dateVal ? new Date(dateVal) : new Date(fallbackCreatedAt);
    const dStr = baseDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    if (timeVal && typeof timeVal === 'string' && timeVal.trim()) {
        const tTrim = timeVal.trim();
        if (/^\d{1,2}:\d{2}$/.test(tTrim)) {
            const [h, m] = tTrim.split(':');
            const d = new Date();
            d.setHours(parseInt(h, 10), parseInt(m, 10));
            const formattedTime = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            return `${dStr}, ${formattedTime}`;
        }
        return `${dStr}, ${tTrim}`;
    }

    if (fallbackCreatedAt) {
        const cTime = new Date(fallbackCreatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        return `${dStr}, ${cTime}`;
    }

    const dTime = baseDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (dTime === '05:30 am' || dTime === '05:30 AM' || dTime === '12:00 am' || dTime === '12:00 AM') {
        return dStr;
    }
    return `${dStr}, ${dTime}`;
};

// Pharmacy total calculator (Exact Web getPharmacyTotal)
const getPharmacyTotal = (p) => {
    if (p.totalAmount && Number(p.totalAmount) > 0) return Number(p.totalAmount);
    if (!p.items || !p.items.length) return 0;
    return p.items.reduce((sum, item) => {
        const qty = parseInt(item.quantity) || parseInt(item.duration) || parseInt(item.days) || 1;
        return sum + (Number(item.price) || 50) * qty;
    }, 0);
};

const isPaid = (status) => status && (status.toLowerCase() === 'paid');

// Calculate total paid across modules and transactions (Exact Web inspectPaidTotal)
const inspectPaidTotal = (b) => {
    if (!b) return 0;
    let t = 0;
    b.appointments?.filter(a => (a.paymentStatus && a.paymentStatus.toLowerCase() === 'paid') || a.isPaid).forEach(a => t += (Number(a.amount) || 0));
    b.labReports?.filter(l => (l.paymentStatus && l.paymentStatus.toLowerCase() === 'paid') || (l.status && l.status.toLowerCase() === 'paid')).forEach(l => t += (Number(l.amount || l.price) || 0));
    b.pharmacyOrders?.filter(p => (p.paymentStatus && p.paymentStatus.toLowerCase() === 'paid') || (p.status && p.status.toLowerCase() === 'paid') || (p.orderStatus && p.orderStatus.toLowerCase() === 'paid')).forEach(p => t += getPharmacyTotal(p));
    b.facilityCharges?.filter(f => f.paymentStatus && f.paymentStatus.toLowerCase() === 'paid').forEach(f => t += (Number(f.totalAmount) || 0));
    b.admissions?.forEach(a => t += (Number(a.paidAmount) || (a.paymentStatus && a.paymentStatus.toLowerCase() === 'paid' ? Number(a.totalAmount) : 0) || 0));
    b.surgeryPlans?.forEach(s => t += (Number(s.paidAmount) || (s.paymentStatus === 'PAID' ? Number(s.surgeryCost) : 0) || 0));

    let historyPaid = 0;
    b.paymentTransactions?.filter(p => {
        const st = (p.paymentStatus || p.status || 'Paid').toLowerCase();
        return st === 'paid';
    }).forEach(p => historyPaid += (Number(p.amount) || 0));

    return Math.max(t, historyPaid);
};

// Calculate grand total across modules (Exact Web inspectGrandTotal)
const inspectGrandTotal = (b) => {
    if (!b) return 0;
    let t = 0;
    b.appointments?.forEach(a => t += (Number(a.amount) || 0));
    b.labReports?.forEach(l => t += (Number(l.amount || l.price) || 0));
    b.pharmacyOrders?.forEach(p => t += getPharmacyTotal(p));
    b.facilityCharges?.forEach(f => t += (Number(f.totalAmount) || 0));
    b.admissions?.forEach(a => t += (Number(a.totalAmount) || 0));
    b.surgeryPlans?.forEach(s => t += (Number(s.surgeryCost) || 0));
    const paid = inspectPaidTotal(b);
    return Math.max(t, paid);
};

// Real 12-digit UTR resolver (Exact Web getRealUtr)
const getRealUtr = (t) => {
    if (!t) return '—';
    const mode = (t.paymentMode || t.paymentMethod || '').toUpperCase();
    const rawTxn = (t.transactionId || t.cardRef || '').trim();

    if (mode === 'CASH' && (!rawTxn || rawTxn.includes('@'))) {
        return '—';
    }
    if (rawTxn && !rawTxn.includes('@') && rawTxn.length >= 6) {
        return rawTxn;
    }
    const d = t.paymentDate ? new Date(t.paymentDate) : new Date(t.createdAt || Date.now());
    const yy = String(d.getFullYear()).slice(-2);
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = String(Math.floor(diff / oneDay)).padStart(3, '0');
    const cleanId = String(t._id || '').replace(/\D/g, '').slice(-7) || '19284';
    const paddedSeq = cleanId.padStart(7, '0').slice(-7);
    return `4${yy}${dayOfYear}${paddedSeq}`.slice(0, 12);
};

// Robust Service & Doctor parser (Exact Web parseServiceAndDoctor)
const parseServiceAndDoctor = (item) => {
    if (!item) return { serviceTitle: 'OPD Consultation Fee', doctorSubtitle: '' };
    const rawDesc = (item.description || item.serviceName || 'OPD Consultation Fee').trim();
    let doc = (item.doctorName || '').trim();
    if (!doc && item.billedItems?.appointments?.[0]?.doctorName) {
        doc = item.billedItems.appointments[0].doctorName.trim();
    }

    let serv = rawDesc;
    if (rawDesc.includes(' - Dr. ')) {
        const parts = rawDesc.split(' - Dr. ');
        serv = parts[0].trim();
        if (!doc) doc = 'Dr. ' + parts[1].trim();
    } else if (rawDesc.includes(' - Dr ')) {
        const parts = rawDesc.split(' - Dr ');
        serv = parts[0].trim();
        if (!doc) doc = 'Dr. ' + parts[1].trim();
    } else if (rawDesc.includes(' - ')) {
        const lastHyphen = rawDesc.lastIndexOf(' - ');
        serv = rawDesc.substring(0, lastHyphen).trim();
        const afterHyphen = rawDesc.substring(lastHyphen + 3).trim();
        if (!doc) doc = afterHyphen;
    }

    if (doc) {
        doc = doc.trim();
        if (!doc.startsWith('Dr.') && !doc.startsWith('Dr ') && !doc.includes('Dept') && !doc.includes('Lab') && !doc.includes('Pharmacy') && !doc.includes('Unit')) {
            doc = `Dr. ${doc}`;
        }
    }
    return { serviceTitle: serv || 'OPD Consultation Fee', doctorSubtitle: doc || '' };
};

const getTodayDateStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const PatientBillingProfile = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user: currentUser } = useAuth();
    const rawRole = (currentUser?.role || '').toLowerCase().replace(/[\s_-]/g, '');
    const isHospitalAdmin = ['hospitaladmin', 'centraladmin', 'superadmin', 'admin'].includes(rawRole) || rawRole.includes('admin');

    const initialTab = isHospitalAdmin ? 'history' : (route.params?.tab === 'history' ? 'history' : 'patient');
    const initialQuery = route.params?.q || '';

    const mainScrollViewRef = useRef(null);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [patient, setPatient] = useState(null);
    const [billing, setBilling] = useState(null);
    const [selected, setSelected] = useState({ appointments: [], labReports: [], pharmacyOrders: [], facilityCharges: [], admissions: [], surgeryPlans: [] });

    // Hospital-wide payment history state & date range filters (Exact Web)
    const [historyTransactions, setHistoryTransactions] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historySearch, setHistorySearch] = useState('');
    const [historyMode, setHistoryMode] = useState('ALL');
    const [historyStatus, setHistoryStatus] = useState('ALL');
    const [datePreset, setDatePreset] = useState('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [historyMetrics, setHistoryMetrics] = useState({ totalCollected: 0, totalUpi: 0, totalCash: 0, count: 0 });

    // Details panel, pagination, and modals state
    const [historySort, setHistorySort] = useState('newest');
    const [showCustomRangePicker, setShowCustomRangePicker] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const [showMobileFiltersModal, setShowMobileFiltersModal] = useState(false);

    // Patient Bill Inspection Modal
    const [inspectPatientModal, setInspectPatientModal] = useState({ open: false, loading: false, patient: null, billing: null });
    // View Proof Modal
    const [viewProofModal, setViewProofModal] = useState({ open: false, url: '', meta: null });
    const setViewProofUrl = (url, meta = null) => {
        if (!url) {
            setViewProofModal({ open: false, url: '', meta: null });
        } else {
            setViewProofModal({ open: true, url, meta });
        }
    };

    // Download / Open Payment Proof URL (Exact Web pt.proofUrl handler)
    const downloadProofFile = async (proofUrl) => {
        if (!proofUrl) return;
        try {
            if (Platform.OS === 'web') {
                if (typeof window !== 'undefined') {
                    window.open(proofUrl, '_blank');
                }
                return;
            }
            const cleanUrl = proofUrl.split('?')[0];
            const ext = cleanUrl.split('.').pop() || 'jpg';
            const filename = `Payment_Proof_${Date.now()}.${ext}`;
            const fileUri = `${FileSystem.cacheDirectory}${filename}`;
            const downloadRes = await FileSystem.downloadAsync(proofUrl, fileUri);
            if (downloadRes && downloadRes.uri) {
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                    await Sharing.shareAsync(downloadRes.uri, {
                        dialogTitle: filename,
                    });
                    toast.success('Payment proof ready to save / share');
                    return;
                }
            }
            await Linking.openURL(proofUrl);
        } catch (err) {
            console.error('Error opening proof URL:', err);
            try {
                await Linking.openURL(proofUrl);
            } catch (linkErr) {
                toast.error('Could not open proof URL');
            }
        }
    };

    const [expandedRows, setExpandedRows] = useState({});

    const toggleExpand = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const [paymentMode, setPaymentMode] = useState('Cash');
    const [splitPayments, setSplitPayments] = useState([{ method: 'Cash', amount: '' }]);
    const [paymentModal, setPaymentModal] = useState({ open: false, data: { transactionId: '', upiId: '', cardDetails: '', bankReference: '' } });
    const [proofFile, setProofFile] = useState(null);
    const [paying, setPaying] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [dischargingId, setDischargingId] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [upiOptions, setUpiOptions] = useState([]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (historyMode !== 'ALL') count++;
        if (historyStatus !== 'ALL') count++;
        if (datePreset !== 'all') count++;
        if (historySort !== 'newest') count++;
        return count;
    }, [historyMode, historyStatus, datePreset, historySort]);

    // Instant reactive filtering across all transactions (Exact Web displayedTransactions)
    const displayedTransactions = useMemo(() => {
        let list = [...historyTransactions];
        const now = new Date();
        const todayStr = getTodayDateStr();

        // 1. Date Filter
        if (datePreset === 'today') {
            list = list.filter(t => {
                const d = new Date(getTxnTimestamp(t));
                const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                return dStr === todayStr;
            });
        } else if (datePreset === 'yesterday') {
            const yest = new Date(now);
            yest.setDate(yest.getDate() - 1);
            const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
            list = list.filter(t => {
                const d = new Date(getTxnTimestamp(t));
                const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                return dStr === yestStr;
            });
        } else if (datePreset === 'this_week') {
            const day = now.getDay();
            const diff = now.getDate() - (day === 0 ? 6 : day - 1);
            const weekStart = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
            const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            list = list.filter(t => {
                const time = getTxnTimestamp(t);
                return time >= weekStart.getTime() && time <= weekEnd.getTime();
            });
        } else if (datePreset === 'this_month') {
            const mStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            list = list.filter(t => {
                const time = getTxnTimestamp(t);
                return time >= mStart.getTime() && time <= mEnd.getTime();
            });
        } else if (datePreset === 'last_month') {
            const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
            const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            list = list.filter(t => {
                const time = getTxnTimestamp(t);
                return time >= lmStart.getTime() && time <= lmEnd.getTime();
            });
        } else if (datePreset === 'custom' && (customStartDate || customEndDate)) {
            let sTime = 0;
            let eTime = Infinity;
            if (customStartDate) {
                const parts = customStartDate.split('-').map(Number);
                sTime = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0).getTime();
            }
            if (customEndDate) {
                const parts = customEndDate.split('-').map(Number);
                eTime = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999).getTime();
            }
            if (sTime > eTime) {
                const tmp = sTime;
                sTime = eTime;
                eTime = tmp;
            }
            list = list.filter(t => {
                const time = getTxnTimestamp(t);
                return time >= sTime && time <= eTime;
            });
        }

        // 2. Mode Filter
        if (historyMode && historyMode !== 'ALL') {
            const m = historyMode.toUpperCase();
            list = list.filter(t => {
                const pMode = (t.paymentMode || '').toUpperCase();
                const hasSplitUpi = t.splitPayments?.some(sp => {
                    const method = (sp.method || '').toUpperCase();
                    return method.includes('UPI') || method.includes('ONLINE');
                });
                const hasSplitCash = t.splitPayments?.some(sp => (sp.method || '').toUpperCase().includes('CASH'));
                const hasSplitCard = t.splitPayments?.some(sp => (sp.method || '').toUpperCase().includes('CARD'));

                if (m === 'UPI') {
                    return pMode.includes('UPI') || pMode.includes('ONLINE') || hasSplitUpi;
                }
                if (m === 'CASH') {
                    return pMode.includes('CASH') || hasSplitCash;
                }
                if (m === 'CARD') {
                    return pMode.includes('CARD') || hasSplitCard;
                }
                return pMode.includes(m);
            });
        }

        // 3. Search Filter
        if (historySearch && historySearch.trim()) {
            const term = historySearch.trim().toLowerCase();
            list = list.filter(t => {
                const pat = t.patientId || {};
                const name = (pat.name || '').toLowerCase();
                const phone = (pat.phone || '').toLowerCase();
                const mrn = (pat.mrn || pat.patientId || '').toLowerCase();
                const txn = (t.transactionId || '').toLowerCase();
                const upi = (t.upiId || '').toLowerCase();
                const desc = (t.description || '').toLowerCase();
                const modeStr = (t.paymentMode || '').toLowerCase();
                return name.includes(term) || phone.includes(term) || mrn.includes(term) || txn.includes(term) || upi.includes(term) || desc.includes(term) || modeStr.includes(term);
            });
        }

        // 4. Status Filter
        if (historyStatus && historyStatus !== 'ALL') {
            const s = historyStatus.toUpperCase();
            list = list.filter(t => {
                const st = (t.paymentStatus || 'PAID').toUpperCase();
                return st.includes(s);
            });
        }

        // 5. Sorting
        if (historySort === 'oldest' || historySort === 'asc') {
            list.sort((a, b) => new Date(a.paymentDate || a.createdAt || 0) - new Date(b.paymentDate || b.createdAt || 0));
        } else if (historySort === 'amt_high' || historySort === 'amount_desc') {
            list.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
        } else if (historySort === 'amt_low' || historySort === 'amount_asc') {
            list.sort((a, b) => (Number(a.amount) || 0) - (Number(b.amount) || 0));
        } else {
            // newest first (default)
            list.sort((a, b) => new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0));
        }

        return list;
    }, [historyTransactions, datePreset, customStartDate, customEndDate, historyMode, historySearch, historyStatus, historySort]);

    const totalPages = Math.max(1, Math.ceil(displayedTransactions.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentTransactions = displayedTransactions.slice(startIndex, startIndex + itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [historySearch, historyMode, datePreset, historyStatus, historySort, customStartDate, customEndDate]);

    // Comprehensive Standard Revenue & Collection Overview with Dynamic Period Breakdown (Exact Web revenueStats)
    const revenueStats = useMemo(() => {
        const now = new Date();
        const todayStr = getTodayDateStr();

        const day = now.getDay();
        const diff = now.getDate() - (day === 0 ? 6 : day - 1);
        const weekStart = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0).getTime();
        const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

        let sTime = 0;
        let eTime = Infinity;
        if (customStartDate) {
            const parts = customStartDate.split('-').map(Number);
            sTime = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0).getTime();
        }
        if (customEndDate) {
            const parts = customEndDate.split('-').map(Number);
            eTime = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999).getTime();
        }
        if (sTime > eTime) {
            const tmp = sTime;
            sTime = eTime;
            eTime = tmp;
        }

        let totalRevenue = 0;
        let totalCount = 0;
        let totalCashCount = 0;
        let totalOnlineCount = 0;

        let todayRevenue = 0;
        let todayCount = 0;
        let todayCashCount = 0;
        let todayOnlineCount = 0;

        let weekRevenue = 0;
        let weekCount = 0;
        let weekCashCount = 0;
        let weekOnlineCount = 0;

        let monthRevenue = 0;
        let monthCount = 0;
        let monthCashCount = 0;
        let monthOnlineCount = 0;

        let customRevenue = 0;
        let customCount = 0;
        let customCashCount = 0;
        let customOnlineCount = 0;

        (historyTransactions || []).forEach(t => {
            const status = (t.paymentStatus || 'PAID').toUpperCase();
            if (status.includes('CANCEL') || status.includes('REFUND')) return;

            const amt = Number(t.amount) || 0;
            totalRevenue += amt;
            totalCount++;

            const tTime = getTxnTimestamp(t);
            const d = new Date(tTime || 0);
            const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            const isToday = dStr === todayStr;
            const isThisWeek = tTime >= weekStart && tTime <= weekEnd;
            const isThisMonth = tTime >= monthStart && tTime <= monthEnd;
            const isCustom = (customStartDate || customEndDate) ? (tTime >= sTime && tTime <= eTime) : false;

            if (isToday) {
                todayRevenue += amt;
                todayCount++;
            }
            if (isThisWeek) {
                weekRevenue += amt;
                weekCount++;
            }
            if (isThisMonth) {
                monthRevenue += amt;
                monthCount++;
            }
            if (isCustom) {
                customRevenue += amt;
                customCount++;
            }

            const mode = (t.paymentMode || t.paymentMethod || '').toUpperCase();
            const hasSplitUpi = t.splitPayments?.some(sp => {
                const method = (sp.method || '').toUpperCase();
                return method.includes('UPI') || method.includes('ONLINE');
            });
            const isOnline = mode.includes('UPI') || mode.includes('ONLINE') || mode.includes('CARD') || mode.includes('QR') || hasSplitUpi;

            if (isOnline) {
                totalOnlineCount++;
                if (isToday) todayOnlineCount++;
                if (isThisWeek) weekOnlineCount++;
                if (isThisMonth) monthOnlineCount++;
                if (isCustom) customOnlineCount++;
            } else {
                totalCashCount++;
                if (isToday) todayCashCount++;
                if (isThisWeek) weekCashCount++;
                if (isThisMonth) monthCashCount++;
                if (isCustom) customCashCount++;
            }
        });

        let activeCashCount = totalCashCount;
        let activeOnlineCount = totalOnlineCount;
        let activePeriodLabel = 'Overall';

        if (datePreset === 'today') {
            activeCashCount = todayCashCount;
            activeOnlineCount = todayOnlineCount;
            activePeriodLabel = 'Today';
        } else if (datePreset === 'this_week') {
            activeCashCount = weekCashCount;
            activeOnlineCount = weekOnlineCount;
            activePeriodLabel = 'This Week';
        } else if (datePreset === 'this_month') {
            activeCashCount = monthCashCount;
            activeOnlineCount = monthOnlineCount;
            activePeriodLabel = 'This Month';
        } else if (datePreset === 'custom') {
            activeCashCount = customCashCount;
            activeOnlineCount = customOnlineCount;
            activePeriodLabel = 'Custom Range';
        }

        return {
            totalRevenue,
            totalCount,
            todayRevenue,
            todayCount,
            weekRevenue,
            weekCount,
            monthRevenue,
            monthCount,
            customRevenue,
            customCount,
            activeCashCount,
            activeOnlineCount,
            activePeriodLabel
        };
    }, [historyTransactions, datePreset, customStartDate, customEndDate]);

    // Fetch hospital payment register
    const fetchHospitalHistory = async () => {
        try {
            setHistoryLoading(true);
            const res = await billingAPI.getPaymentHistory({ limit: 1000 });
            if (res?.success) {
                setHistoryTransactions(res.transactions || []);
                setHistoryMetrics({
                    totalCollected: res.totalCollected || 0,
                    totalUpi: res.totalUpi || 0,
                    totalCash: res.totalCash || 0,
                    count: res.count || (res.transactions || []).length
                });
            }
        } catch (err) {
            console.error('Failed to fetch hospital billing history:', err);
            toast.error(err.response?.data?.message || 'Failed to load hospital payment history');
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchHospitalHistory();
        if (route.params?.q) {
            setSearchQuery(route.params.q);
            loadPatientBilling(route.params.q);
            if (!isHospitalAdmin) setActiveTab('patient');
        }
    }, [route.params, isHospitalAdmin]);

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHospitalHistory();
        }
    }, [activeTab]);

    // Load Department UPI options
    useEffect(() => {
        const fetchUpiOptions = async () => {
            try {
                const deptRes = await hospitalAPI.getDepartmentUpiByRole('Billing');
                if (deptRes?.success && deptRes.departmentUpi) {
                    setUpiOptions([{ label: deptRes.departmentUpi.label, upiId: deptRes.departmentUpi.upiId }]);
                    return;
                }
            } catch (err) { }
            try {
                const recRes = await hospitalAPI.getDepartmentUpiByRole('Reception');
                if (recRes?.success && recRes.departmentUpi) {
                    setUpiOptions([{ label: recRes.departmentUpi.label, upiId: recRes.departmentUpi.upiId }]);
                    return;
                }
            } catch (err) { }
            try {
                const res = await hospitalAPI.getUpiIds();
                setUpiOptions(res?.upiIds || []);
            } catch (err) { }
        };
        fetchUpiOptions();
    }, []);

    // CSV Export (Exact Web handleExportCSV)
    const handleExportCSV = async () => {
        if (!displayedTransactions || !displayedTransactions.length) {
            toast.error('No payments to export');
            return;
        }

        const safe = (str) => `"${String(str ?? '').replace(/"/g, '""')}"`;
        const headers = [
            'S.No',
            'Patient Name',
            'MRN',
            'Phone',
            'Service / Description',
            'Doctor',
            'Payment Mode',
            'Payment Status',
            'Amount (INR)',
            'UTR / Transaction ID',
            'Date & Time'
        ];

        const rows = displayedTransactions.map((t, idx) => {
            const pat = (typeof t.patientId === 'object' && t.patientId !== null) ? t.patientId : {};
            const { dateStr, timeStr } = getBookingDateTime(t);
            const utrVal = getRealUtr(t);
            const { serviceTitle: serv, doctorSubtitle: doc } = parseServiceAndDoctor(t);
            const patName = pat.name || t.patientName || 'Walk-in Patient';
            const patMrn = pat.mrn || pat.patientId || t.patientMrn || '—';
            const patPhone = pat.phone || t.patientPhone || '—';
            const mode = t.paymentMode || t.paymentMethod || 'Cash';
            const status = t.paymentStatus || 'Paid';
            const amt = Number(t.amount) || 0;

            return [
                safe(idx + 1),
                safe(patName),
                safe(patMrn),
                safe(patPhone),
                safe(serv),
                safe(doc),
                safe(mode),
                safe(status),
                safe(amt),
                safe(utrVal),
                safe(`${dateStr} ${timeStr}`.trim())
            ].join(',');
        });

        const csvString = [headers.map(h => safe(h)).join(','), ...rows].join('\r\n');

        if (Platform.OS === 'web') {
            const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `hospital_payment_history_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                if (document.body.contains(link)) document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 500);
            toast.success(`Exported ${displayedTransactions.length} payment records as CSV`);
        } else {
            toast.success(`Exported ${displayedTransactions.length} records`);
        }
    };

    // Reset Filters (Exact Web handleResetFilters)
    const handleResetFilters = () => {
        setHistorySearch('');
        setHistoryMode('ALL');
        setHistoryStatus('ALL');
        setDatePreset('all');
        setCustomStartDate('');
        setCustomEndDate('');
        setHistorySort('newest');
        fetchHospitalHistory();
        toast.success('Filters reset');
    };

    // Dedicated Native Print Handler (Opens Android native print spooler / Web print)
    const printPdfDocument = async (htmlContent) => {
        try {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(htmlContent);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => printWindow.print(), 250);
                    return;
                }
            }
            await Print.printAsync({ html: htmlContent });
        } catch (err) {
            console.error('Print error:', err);
            // Fallback to generate and share
            await downloadPdfDocument(htmlContent, 'Print_Document');
        }
    };

    // Dedicated PDF Download & Native Save/Share Handler via Expo Print & Expo Sharing
    const downloadPdfDocument = async (htmlContent, fileName = 'Bill_Receipt') => {
        try {
            const cleanName = (fileName || 'Bill_Receipt').replace(/[/\\?%*:|"<>]/g, '_');
            const pdfFileName = cleanName.endsWith('.pdf') ? cleanName : `${cleanName}.pdf`;

            if (Platform.OS === 'web') {
                const { uri } = await Print.printToFileAsync({ html: htmlContent });
                if (typeof document !== 'undefined') {
                    const link = document.createElement('a');
                    link.href = uri;
                    link.download = pdfFileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast.success('Bill downloaded successfully');
                }
                return;
            }

            // Generate PDF via expo-print
            const printResult = await Print.printToFileAsync({ html: htmlContent });
            if (!printResult || !printResult.uri) {
                throw new Error('PDF generation failed (empty URI returned)');
            }
            let fileUri = printResult.uri;
            try {
                const destinationUri = `${FileSystem.cacheDirectory}${pdfFileName}`;
                await FileSystem.copyAsync({ from: printResult.uri, to: destinationUri });
                fileUri = destinationUri;
            } catch (copyErr) {
                fileUri = printResult.uri;
            }

            // Open native share/save dialog if available
            const isSharingAvailable = await Sharing.isAvailableAsync();
            if (isSharingAvailable) {
                await Sharing.shareAsync(fileUri, {
                    UTI: 'com.adobe.pdf',
                    mimeType: 'application/pdf',
                    dialogTitle: pdfFileName,
                });
                toast.success('Receipt PDF generated successfully');
            } else {
                // Fallback to native print spooler
                await Print.printAsync({ html: htmlContent });
            }
        } catch (err) {
            console.error('Download PDF error:', err);
            toast.error(err?.message || 'Failed to download bill PDF');
        }
    };

    // Universal Document Print / Share Handler for React Native
    const handleDownloadOrPrintPdf = async (htmlContent, docTitle = 'Document', action = 'download') => {
        if (action === 'print') {
            await printPdfDocument(htmlContent);
        } else {
            await downloadPdfDocument(htmlContent, docTitle);
        }
    };

    // Official Medical Bill Receipt Generator & Download (100% Exact Web downloadTransactionReceipt)
    const downloadTransactionReceipt = (t, action = 'download') => {
        if (!t) return;
        const pat = (typeof t.patientId === 'object' && t.patientId !== null) 
            ? t.patientId 
            : ((typeof t.patient === 'object' && t.patient !== null) ? t.patient : (patient || {}));
        const { dateStr, timeStr } = getBookingDateTime(t);
        const { serviceTitle, doctorSubtitle } = parseServiceAndDoctor(t);
        const realUtr = getRealUtr(t);
        const rawId = String(t._id || '00000000');
        const invNo = `INV-${rawId.slice(-8).toUpperCase()}`;
        const hospitalName = currentUser?.hospitalId?.name || currentUser?.hospitalName || 'Hospital';
        const amountVal = Number(t.amount) || 0;

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Bill Receipt - ${invNo}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 30px;
            background: #f8fafc;
        }
        .receipt-card {
            max-width: 680px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 36px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.06);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 18px;
            margin-bottom: 22px;
        }
        .hosp-title {
            font-size: 24px;
            font-weight: 800;
            color: #1e3a8a;
            margin: 0 0 4px 0;
            letter-spacing: -0.5px;
        }
        .hosp-sub {
            font-size: 13px;
            color: #64748b;
            margin: 0;
        }
        .inv-box {
            text-align: right;
        }
        .inv-type {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #2563eb;
        }
        .inv-num {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 2px;
        }
        .inv-date {
            font-size: 12px;
            color: #64748b;
            margin-top: 2px;
        }
        .patient-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px 20px;
            margin-bottom: 24px;
        }
        .p-field {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .p-field label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.5px;
        }
        .p-field strong {
            font-size: 14px;
            color: #0f172a;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
        }
        th {
            background: #f1f5f9;
            color: #334155;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 11px 14px;
            text-align: left;
            border-top: 1px solid #cbd5e1;
            border-bottom: 1px solid #cbd5e1;
        }
        td {
            padding: 14px;
            font-size: 13.5px;
            border-bottom: 1px solid #e2e8f0;
            color: #1e293b;
        }
        .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 28px;
        }
        .totals-table {
            width: 260px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px 18px;
        }
        .t-row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            color: #475569;
            margin-bottom: 6px;
        }
        .t-row.grand {
            border-top: 1px solid #cbd5e1;
            padding-top: 8px;
            margin-top: 6px;
            margin-bottom: 0;
            font-size: 16px;
            font-weight: 800;
            color: #059669;
        }
        .footer-stamp {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px dashed #cbd5e1;
            padding-top: 20px;
            margin-top: 10px;
        }
        .stamp-badge {
            display: inline-block;
            border: 2px solid #059669;
            color: #059669;
            font-weight: 900;
            font-size: 14px;
            letter-spacing: 2px;
            padding: 6px 14px;
            border-radius: 6px;
            text-transform: uppercase;
        }
        .sig-box {
            text-align: right;
            font-size: 12px;
            color: #64748b;
        }
        .sig-line {
            width: 140px;
            border-bottom: 1px solid #94a3b8;
            margin: 0 0 4px auto;
        }
        @media print {
            body { padding: 0; background: #fff; }
            .receipt-card { border: none; box-shadow: none; padding: 0; }
        }
    </style>
</head>
<body>
    <div class="receipt-card">
        <div class="header">
            <div>
                <h1 class="hosp-title">${hospitalName}</h1>
                <p class="hosp-sub">Official Hospital Payment Voucher & Invoice</p>
            </div>
            <div class="inv-box">
                <div class="inv-type">Receipt</div>
                <div class="inv-num">${invNo}</div>
                <div class="inv-date">${dateStr} ${timeStr}</div>
            </div>
        </div>

        <div class="patient-grid">
            <div class="p-field">
                <label>Patient Name</label>
                <strong>${formatPatientName(pat.name || t.patientName || 'Walk-in Patient')}</strong>
            </div>
            <div class="p-field">
                <label>MRN / Patient ID</label>
                <strong>${pat.mrn || pat.patientId || t.patientMrn || '—'}</strong>
            </div>
            <div class="p-field">
                <label>Phone Number</label>
                <strong>${pat.phone || t.patientPhone || '—'}</strong>
            </div>
            <div class="p-field">
                <label>Attending Doctor</label>
                <strong>${doctorSubtitle || '—'}</strong>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 40px;">#</th>
                    <th>Service & Description</th>
                    <th>Payment Mode</th>
                    <th>UTR / Reference</th>
                    <th style="text-align: right;">Amount (INR)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>1</td>
                    <td>
                        <strong>${serviceTitle}</strong>${doctorSubtitle ? `<br/><span style="color: #64748b; font-size: 12px;">Doctor: ${doctorSubtitle}</span>` : ''}
                    </td>
                    <td>${t.paymentMode || 'Cash'}</td>
                    <td><code>${realUtr !== '—' ? realUtr : 'N/A'}</code></td>
                    <td style="text-align: right; font-weight: 700;">₹${amountVal.toLocaleString('en-IN')}</td>
                </tr>
            </tbody>
        </table>

        <div class="totals-section">
            <div class="totals-table">
                <div class="t-row">
                    <span>Subtotal:</span>
                    <span>₹${amountVal.toLocaleString('en-IN')}</span>
                </div>
                <div class="t-row">
                    <span>Tax / Cess:</span>
                    <span>₹0</span>
                </div>
                <div class="t-row grand">
                    <span>Amount Paid:</span>
                    <span>₹${amountVal.toLocaleString('en-IN')}</span>
                </div>
            </div>
        </div>

        <div class="footer-stamp">
            <div>
                <span class="stamp-badge">✓ PAID</span>
            </div>
            <div class="sig-box">
                <div class="sig-line"></div>
                <span>Authorized Hospital Signatory</span>
            </div>
        </div>
    </div>
</body>
</html>`;

        if (action === 'print') {
            printPdfDocument(htmlContent);
        } else {
            downloadPdfDocument(htmlContent, `Bill_Receipt_${invNo}`);
        }
    };

    const printTransactionReceipt = (t) => downloadTransactionReceipt(t, 'print');

    // Consolidated Patient Billing Statement Print/Download (100% Exact Web downloadPatientStatement)
    const downloadPatientStatement = (pat, billingData, action = 'download') => {
        if (!pat || !billingData) return;
        const hospitalName = currentUser?.hospitalId?.name || currentUser?.hospitalName || 'Hospital';
        const gTotal = inspectGrandTotal(billingData);
        const pTotal = inspectPaidTotal(billingData);
        const bTotal = Math.max(0, gTotal - pTotal);

        let rows = [];
        let rIdx = 1;

        // Appointments
        (billingData.appointments || []).forEach(a => {
            rows.push(`
                <tr>
                    <td>${rIdx++}</td>
                    <td>Consultation - Dr. ${a.doctorName || 'Doctor'}</td>
                    <td>${fmtDate(a.appointmentDate || a.createdAt)}</td>
                    <td>${a.paymentMethod || 'Cash'}${a.cardRef ? ` (Ref: ${a.cardRef})` : ''}</td>
                    <td><span style="color: ${isPaid(a.paymentStatus) ? '#16a34a' : '#d97706'}; font-weight: 700;">${a.paymentStatus || (isPaid(a.paymentStatus) ? 'Paid' : 'Pending')}</span></td>
                    <td style="text-align: right; font-weight: 700;">₹${(Number(a.amount) || 0).toLocaleString('en-IN')}</td>
                </tr>
            `);
        });

        // Admissions
        (billingData.admissions || []).forEach(adm => {
            rows.push(`
                <tr>
                    <td>${rIdx++}</td>
                    <td>Hospitalization (Ward: ${adm.ward || 'General'}, Bed: ${adm.bedNumber || '—'})</td>
                    <td>Admitted: ${fmtAdmissionDateTime(adm.admissionDate, adm.admissionTime, adm.createdAt)}</td>
                    <td>${adm.paymentMethod || 'Inpatient'}</td>
                    <td><span style="color: ${isPaid(adm.paymentStatus) ? '#16a34a' : '#d97706'}; font-weight: 700;">${adm.paymentStatus || 'Pending'}</span></td>
                    <td style="text-align: right; font-weight: 700;">₹${(Number(adm.totalAmount) || 0).toLocaleString('en-IN')}</td>
                </tr>
            `);
        });

        // Surgery Plans
        (billingData.surgeryPlans || []).forEach(s => {
            rows.push(`
                <tr>
                    <td>${rIdx++}</td>
                    <td>Surgery: ${s.surgeryName || s.procedureName || 'Procedure'}</td>
                    <td>${fmtDate(s.surgeryDate || s.createdAt)}</td>
                    <td>${s.otRoom ? `OT: ${s.otRoom}` : 'Surgery'}</td>
                    <td><span style="color: ${s.paymentStatus === 'PAID' ? '#16a34a' : '#d97706'}; font-weight: 700;">${s.paymentStatus || 'Pending'}</span></td>
                    <td style="text-align: right; font-weight: 700;">₹${(Number(s.surgeryCost) || 0).toLocaleString('en-IN')}</td>
                </tr>
            `);
        });

        // Facility Charges
        (billingData.facilityCharges || []).forEach(f => {
            rows.push(`
                <tr>
                    <td>${rIdx++}</td>
                    <td>Facility / ICU: ${f.facilityName || 'Facility Charge'}</td>
                    <td>${fmtDate(f.date || f.createdAt)}</td>
                    <td>Facility</td>
                    <td><span style="color: ${isPaid(f.paymentStatus) ? '#16a34a' : '#d97706'}; font-weight: 700;">${f.paymentStatus || 'Pending'}</span></td>
                    <td style="text-align: right; font-weight: 700;">₹${(Number(f.totalAmount) || 0).toLocaleString('en-IN')}</td>
                </tr>
            `);
        });

        // Lab Reports
        (billingData.labReports || []).forEach(l => {
            rows.push(`
                <tr>
                    <td>${rIdx++}</td>
                    <td>Lab Test: ${l.testName || l.labTestId?.name || 'Diagnostic Test'}</td>
                    <td>${fmtDate(l.createdAt)}</td>
                    <td>Lab</td>
                    <td><span style="color: ${isPaid(l.paymentStatus || l.status) ? '#16a34a' : '#d97706'}; font-weight: 700;">${l.paymentStatus || l.status || 'Pending'}</span></td>
                    <td style="text-align: right; font-weight: 700;">₹${(Number(l.amount || l.price) || 0).toLocaleString('en-IN')}</td>
                </tr>
            `);
        });

        // Pharmacy Orders
        (billingData.pharmacyOrders || []).forEach(p => {
            rows.push(`
                <tr>
                    <td>${rIdx++}</td>
                    <td>Pharmacy: Order #${p.orderNumber || p._id?.slice(-6) || ''} (${p.items?.length || 0} items)</td>
                    <td>${fmtDate(p.orderDate || p.createdAt)}</td>
                    <td>Pharmacy</td>
                    <td><span style="color: ${isPaid(p.paymentStatus || p.status) ? '#16a34a' : '#d97706'}; font-weight: 700;">${p.paymentStatus || p.status || 'Pending'}</span></td>
                    <td style="text-align: right; font-weight: 700;">₹${getPharmacyTotal(p).toLocaleString('en-IN')}</td>
                </tr>
            `);
        });

        const rowsHtml = rows.join('') || '<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 16px;">No billing items recorded</td></tr>';

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Patient Statement - ${formatPatientName(pat.name)}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; background: #f8fafc; color: #0f172a; }
        .card { max-width: 750px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 36px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; }
        .hosp { font-size: 22px; font-weight: 800; color: #1e3a8a; margin: 0; }
        .sub { font-size: 13px; color: #64748b; margin: 2px 0 0 0; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; padding: 14px 18px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
        .meta div { font-size: 13px; }
        .meta strong { color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
        th { background: #f1f5f9; padding: 10px 12px; text-align: left; text-transform: uppercase; font-size: 11px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
        td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
        .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
        .t-box { width: 260px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 13px; }
        .t-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .t-row.grand { font-size: 15px; font-weight: 800; border-top: 1px solid #cbd5e1; padding-top: 6px; color: #1e3a8a; }
        @media print { body { padding: 0; background: #fff; } .card { border: none; box-shadow: none; padding: 0; } }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <div>
                <h1 class="hosp">${hospitalName}</h1>
                <p class="sub">Consolidated Patient Billing Statement</p>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase;">Statement</div>
                <div style="font-size: 13px; color: #64748b; margin-top: 4px;">${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
        </div>
        <div class="meta">
            <div><strong>Patient:</strong> ${formatPatientName(pat.name)}</div>
            <div><strong>MRN:</strong> ${pat.mrn || pat.patientId || '—'}</div>
            <div><strong>Phone:</strong> ${pat.phone || '—'}</div>
            <div><strong>Email:</strong> ${pat.email || '—'}</div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Item Description</th>
                    <th>Date</th>
                    <th>Payment Info</th>
                    <th>Status</th>
                    <th style="text-align: right;">Amount (INR)</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
        <div class="totals">
            <div class="t-box">
                <div class="t-row"><span>Grand Total:</span><strong>₹${gTotal.toLocaleString('en-IN')}</strong></div>
                <div class="t-row"><span>Total Paid:</span><strong style="color: #16a34a;">₹${pTotal.toLocaleString('en-IN')}</strong></div>
                <div class="t-row grand"><span>Balance Due:</span><span>₹${bTotal.toLocaleString('en-IN')}</span></div>
            </div>
        </div>
    </div>
</body>
</html>`;

        const fileName = `Patient_Statement_${pat.mrn || pat.patientId || pat.name || 'Statement'}`;
        if (action === 'print') {
            printPdfDocument(htmlContent);
        } else {
            downloadPdfDocument(htmlContent, fileName);
        }
    };

    const printPatientStatement = (pat, billingData) => downloadPatientStatement(pat, billingData, 'print');

    // Open patient billing profile flow (100% Exact Web openPatientBilling)
    const openPatientBilling = (txn) => {
        if (!txn) return;
        const pat = (typeof txn.patientId === 'object' && txn.patientId !== null) 
            ? txn.patientId 
            : ((typeof txn.patient === 'object' && txn.patient !== null) ? txn.patient : (patient || {}));
        const patIdStr = typeof txn.patientId === 'string' ? txn.patientId : (pat._id || '');
        const identifier = pat.patientId || pat.mrn || patIdStr || pat.phone || txn.patientMrn || txn.patientPhone || pat.name || txn.patientName;
        if (identifier) {
            setSearchQuery(pat.name || txn.patientName || identifier);
            loadPatientBilling(identifier, txn);
            setActiveTab('patient');
            mainScrollViewRef.current?.scrollTo({ y: 0, animated: false });
        } else {
            toast.error('Patient identifier not found for this transaction');
        }
    };

    // Load patient billing details (100% Exact Web loadPatientBilling)
    const loadPatientBilling = async (identifier, initialTxn = null) => {
        setLoading(true);
        setError('');

        let initialPat = null;
        if (initialTxn) {
            const patObj = (typeof initialTxn.patientId === 'object' && initialTxn.patientId !== null) 
                ? initialTxn.patientId 
                : ((typeof initialTxn.patient === 'object' && initialTxn.patient !== null) ? initialTxn.patient : {});
            initialPat = {
                _id: patObj._id || (typeof initialTxn.patientId === 'string' ? initialTxn.patientId : ''),
                name: patObj.name || initialTxn.patientName || 'Patient',
                mrn: patObj.mrn || patObj.patientId || initialTxn.patientMrn || '',
                patientId: patObj.patientId || patObj.mrn || initialTxn.patientMrn || '',
                phone: patObj.phone || initialTxn.patientPhone || '',
                gender: patObj.gender || '',
                dob: patObj.dob || ''
            };
            setPatient(initialPat);
            setBilling({
                appointments: initialTxn.billedItems?.appointments || [],
                labReports: [],
                pharmacyOrders: [],
                facilityCharges: [],
                admissions: [],
                surgeryPlans: [],
                paymentTransactions: [initialTxn]
            });
        } else {
            setPatient(null);
            setBilling(null);
        }

        setSelected({ appointments: [], labReports: [], pharmacyOrders: [], facilityCharges: [], admissions: [], surgeryPlans: [] });
        setSuccessMsg('');
        try {
            const res = await billingAPI.getPatientBills(identifier);
            if (res && res.success) {
                setPatient(res.patient || initialPat);
                const fetchedBilling = res.billing || {};
                if (initialTxn) {
                    fetchedBilling.paymentTransactions = fetchedBilling.paymentTransactions || [];
                    const hasTxn = fetchedBilling.paymentTransactions.some(p => String(p._id) === String(initialTxn._id));
                    if (!hasTxn) {
                        fetchedBilling.paymentTransactions.unshift(initialTxn);
                    }
                }
                setBilling(fetchedBilling);
            } else if (!initialTxn) {
                setError('Patient billing data not found');
            }
        } catch (err) {
            console.error('loadPatientBilling error:', err);
            if (!initialTxn) {
                setError(err.response?.data?.message || 'Patient not found');
            }
        } finally {
            setLoading(false);
        }
    };

    // Patient search input live change
    const searchTimeoutRef = useRef(null);
    const handleQueryChange = (val) => {
        setSearchQuery(val);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        searchTimeoutRef.current = setTimeout(async () => {
            if (val.trim().length >= 2) {
                try {
                    const res = await patientAPI.search(val.trim());
                    if (res?.success) {
                        setSuggestions(res.data || []);
                        setShowSuggestions(true);
                    }
                } catch (err) {
                    console.error(err);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);
    };

    const handleSearch = () => {
        if (!searchQuery.trim()) return;
        setShowSuggestions(false);
        loadPatientBilling(searchQuery.trim());
    };

    // Toggle selection
    const toggle = (category, id) => {
        setSelected(prev => ({
            ...prev,
            [category]: prev[category].includes(id)
                ? prev[category].filter(x => x !== id)
                : [...prev[category], id]
        }));
    };

    const toggleAll = (category, items) => {
        const pendingIds = items.filter(x => x.paymentStatus !== 'Paid' && x.paymentStatus !== 'PAID').map(x => x._id);
        setSelected(prev => {
            const allSelected = pendingIds.every(id => (prev[category] || []).includes(id));
            return { ...prev, [category]: allSelected ? [] : pendingIds };
        });
    };

    const totalSelected = () => {
        if (!billing) return 0;
        let total = 0;
        billing.appointments?.filter(a => selected.appointments?.includes(a._id)).forEach(a => total += (Number(a.amount) || 0));
        billing.labReports?.filter(l => selected.labReports?.includes(l._id)).forEach(l => total += (Number(l.amount || l.price) || 0));
        billing.pharmacyOrders?.filter(p => selected.pharmacyOrders?.includes(p._id)).forEach(p => total += getPharmacyTotal(p));
        billing.facilityCharges?.filter(f => selected.facilityCharges?.includes(f._id)).forEach(f => total += (Number(f.totalAmount) || 0));
        billing.admissions?.filter(a => selected.admissions?.includes(a._id)).forEach(a => total += (Number(a.totalAmount) || 0));
        billing.surgeryPlans?.filter(s => selected.surgeryPlans?.includes(s._id)).forEach(s => {
            const cost = Number(s.surgeryCost) || 0;
            const paid = Number(s.paidAmount) || 0;
            total += Math.max(0, cost - paid);
        });
        return total;
    };

    const pendingTotal = () => {
        if (!billing) return 0;
        let total = 0;
        billing.appointments?.filter(a => !isPaid(a.paymentStatus)).forEach(a => total += (Number(a.amount) || 0));
        billing.labReports?.filter(l => !isPaid(l.paymentStatus)).forEach(l => total += (Number(l.amount || l.price) || 0));
        billing.pharmacyOrders?.filter(p => !isPaid(p.paymentStatus)).forEach(p => total += getPharmacyTotal(p));
        billing.facilityCharges?.filter(f => !isPaid(f.paymentStatus)).forEach(f => total += (Number(f.totalAmount) || 0));
        billing.admissions?.filter(a => !isPaid(a.paymentStatus)).forEach(a => total += (Number(a.totalAmount) || 0));
        billing.surgeryPlans?.filter(s => s.paymentStatus !== 'PAID').forEach(s => {
            const cost = Number(s.surgeryCost) || 0;
            const paid = Number(s.paidAmount) || 0;
            total += Math.max(0, cost - paid);
        });
        return total;
    };

    const totalPaidBill = () => {
        if (!billing) return 0;
        let modulePaid = 0;
        billing.appointments?.filter(a => isPaid(a.paymentStatus) || a.isPaid).forEach(a => modulePaid += (Number(a.amount) || 0));
        billing.labReports?.filter(l => isPaid(l.paymentStatus) || isPaid(l.status)).forEach(l => modulePaid += (Number(l.amount || l.price) || 0));
        billing.pharmacyOrders?.filter(p => isPaid(p.paymentStatus) || isPaid(p.status) || isPaid(p.orderStatus)).forEach(p => modulePaid += getPharmacyTotal(p));
        billing.facilityCharges?.filter(f => isPaid(f.paymentStatus)).forEach(f => modulePaid += (Number(f.totalAmount) || 0));
        billing.admissions?.forEach(a => modulePaid += (Number(a.paidAmount) || (isPaid(a.paymentStatus) ? Number(a.totalAmount) : 0) || 0));
        billing.surgeryPlans?.forEach(s => modulePaid += (Number(s.paidAmount) || (s.paymentStatus === 'PAID' ? Number(s.surgeryCost) : 0) || 0));

        let historyPaid = 0;
        billing.paymentTransactions?.filter(p => {
            const st = (p.paymentStatus || p.status || 'Paid').toLowerCase();
            return st === 'paid';
        }).forEach(p => historyPaid += (Number(p.amount) || 0));

        return Math.max(modulePaid, historyPaid);
    };

    const grandTotalBill = () => {
        if (!billing) return 0;
        let total = 0;
        billing.appointments?.forEach(a => total += (Number(a.amount) || 0));
        billing.labReports?.forEach(l => total += (Number(l.amount || l.price) || 0));
        billing.pharmacyOrders?.forEach(p => total += getPharmacyTotal(p));
        billing.facilityCharges?.forEach(f => total += (Number(f.totalAmount) || 0));
        billing.admissions?.forEach(a => total += (Number(a.totalAmount) || 0));
        billing.surgeryPlans?.forEach(s => total += (Number(s.surgeryCost) || 0));

        const paid = totalPaidBill();
        return Math.max(total, paid);
    };

    const balanceBill = () => Math.max(0, grandTotalBill() - totalPaidBill());

    const printBookingInfo = useMemo(() => {
        if (!billing) return { dateStr: fmtDate(new Date()), timeStr: '' };
        const pt = (billing.paymentTransactions && billing.paymentTransactions.length > 0) ? billing.paymentTransactions[0] : null;
        if (pt) {
            const dt = getBookingDateTime(pt);
            return {
                dateStr: dt.dateStr || fmtDate(pt.paymentDate || pt.createdAt),
                timeStr: dt.timeStr || pt.appointmentTime || ''
            };
        }
        const apt = (billing.appointments && billing.appointments.length > 0) ? billing.appointments[0] : null;
        if (apt) {
            const dt = getBookingDateTime(apt);
            return {
                dateStr: dt.dateStr || fmtDate(apt.appointmentDate || apt.createdAt),
                timeStr: dt.timeStr || apt.appointmentTime || ''
            };
        }
        return { dateStr: fmtDate(new Date()), timeStr: '' };
    }, [billing]);

    // Consolidated Patient Bill / Receipt Print (Port of Web window.print() + .ha-printable-receipt)
    const printConsolidatedBill = (pat, billingData, action = 'print') => {
        if (!pat || !billingData) return;
        const hospitalName = currentUser?.hospitalId?.name || currentUser?.hospitalName || 'Hospital';
        const gTotal = grandTotalBill();
        const pTotal = totalPaidBill();
        const bTotal = balanceBill();
        const isSettled = bTotal === 0;

        let rowsHtml = '';
        let rowIdx = 1;

        // 1. Recorded Payment Transactions
        if (billingData.paymentTransactions && billingData.paymentTransactions.length > 0) {
            billingData.paymentTransactions.forEach((pt) => {
                const { dateStr, timeStr } = getBookingDateTime(pt);
                const utr = pt.transactionId || pt.upiId || pt.bankReference || '—';
                rowsHtml += `
                    <tr>
                        <td style="text-align: center;">${rowIdx++}</td>
                        <td><strong style="color: #0f172a;">${pt.description || 'Payment'}</strong></td>
                        <td>${pt.paymentMode || 'Cash'}</td>
                        <td><code>${utr}</code></td>
                        <td>${dateStr} ${timeStr ? `(${timeStr})` : ''}</td>
                        <td style="text-align: center;"><span class="ha-pr-status-badge">Paid</span></td>
                        <td style="text-align: right; font-weight: 700;">${fmt(pt.amount)}</td>
                    </tr>
                `;
            });
        }

        // 2. OPD Appointments & Consultations
        if (billingData.appointments && billingData.appointments.length > 0) {
            billingData.appointments.forEach((apt) => {
                const paid = isPaid(apt.paymentStatus);
                rowsHtml += `
                    <tr>
                        <td style="text-align: center;">${rowIdx++}</td>
                        <td><strong>OPD Consultation - Dr. ${apt.doctorName || 'Doctor'}</strong></td>
                        <td>${apt.paymentMethod || 'Cash'}</td>
                        <td><code>${apt.cardRef || '—'}</code></td>
                        <td>${fmtDate(apt.appointmentDate, apt.appointmentTime)}</td>
                        <td style="text-align: center;"><span class="${paid ? 'ha-pr-status-badge' : 'ha-pr-status-pending'}">${apt.paymentStatus || (paid ? 'Paid' : 'Pending')}</span></td>
                        <td style="text-align: right; font-weight: 700;">${fmt(apt.amount)}</td>
                    </tr>
                `;
            });
        }

        // 3. Hospital Admissions (Inpatient)
        if (billingData.admissions && billingData.admissions.length > 0) {
            billingData.admissions.forEach((adm) => {
                const paid = isPaid(adm.paymentStatus);
                rowsHtml += `
                    <tr>
                        <td style="text-align: center;">${rowIdx++}</td>
                        <td><strong>Hospitalization (Ward: ${adm.ward || 'General'}, Bed: ${adm.bedNumber || '—'})</strong></td>
                        <td>${adm.paymentMethod || 'Hospital Inpatient'}</td>
                        <td><code>—</code></td>
                        <td>Admitted: ${fmtAdmissionDateTime(adm.admissionDate, adm.admissionTime, adm.createdAt)}</td>
                        <td style="text-align: center;"><span class="${paid ? 'ha-pr-status-badge' : 'ha-pr-status-pending'}">${adm.paymentStatus || (paid ? 'Paid' : 'Pending')}</span></td>
                        <td style="text-align: right; font-weight: 700;">${fmt(adm.totalAmount)}</td>
                    </tr>
                `;
            });
        }

        // 4. Surgeries & OT Procedures
        if (billingData.surgeryPlans && billingData.surgeryPlans.length > 0) {
            billingData.surgeryPlans.forEach((s) => {
                const paid = s.paymentStatus === 'PAID';
                rowsHtml += `
                    <tr>
                        <td style="text-align: center;">${rowIdx++}</td>
                        <td><strong>Surgery / OT: ${s.surgeryName || s.procedureName || 'Surgical Procedure'}</strong></td>
                        <td>${s.paymentMethod || 'OT Procedure'}</td>
                        <td><code>${s.otRoom ? 'OT: ' + s.otRoom : '—'}</code></td>
                        <td>${fmtDate(s.surgeryDate || s.createdAt)}</td>
                        <td style="text-align: center;"><span class="${paid ? 'ha-pr-status-badge' : 'ha-pr-status-pending'}">${s.paymentStatus || (paid ? 'Paid' : 'Pending')}</span></td>
                        <td style="text-align: right; font-weight: 700;">${fmt(s.surgeryCost)}</td>
                    </tr>
                `;
            });
        }

        // 5. Facility / ICU Charges
        if (billingData.facilityCharges && billingData.facilityCharges.length > 0) {
            billingData.facilityCharges.forEach((f) => {
                const paid = isPaid(f.paymentStatus);
                rowsHtml += `
                    <tr>
                        <td style="text-align: center;">${rowIdx++}</td>
                        <td><strong>Facility / ICU: ${f.facilityName || 'Facility Charge'}</strong></td>
                        <td>Facility</td>
                        <td><code>—</code></td>
                        <td>${fmtDate(f.date || f.createdAt)}</td>
                        <td style="text-align: center;"><span class="${paid ? 'ha-pr-status-badge' : 'ha-pr-status-pending'}">${f.paymentStatus || (paid ? 'Paid' : 'Pending')}</span></td>
                        <td style="text-align: right; font-weight: 700;">${fmt(f.totalAmount)}</td>
                    </tr>
                `;
            });
        }

        // 6. Diagnostic Lab Reports
        if (billingData.labReports && billingData.labReports.length > 0) {
            billingData.labReports.forEach((l) => {
                const paid = isPaid(l.paymentStatus || l.status);
                rowsHtml += `
                    <tr>
                        <td style="text-align: center;">${rowIdx++}</td>
                        <td><strong>Lab Test: ${l.testName || l.labTestId?.name || 'Diagnostic Investigation'}</strong></td>
                        <td>Lab</td>
                        <td><code>—</code></td>
                        <td>${fmtDate(l.createdAt)}</td>
                        <td style="text-align: center;"><span class="${paid ? 'ha-pr-status-badge' : 'ha-pr-status-pending'}">${l.paymentStatus || l.status || (paid ? 'Paid' : 'Pending')}</span></td>
                        <td style="text-align: right; font-weight: 700;">${fmt(l.amount || l.price)}</td>
                    </tr>
                `;
            });
        }

        // 7. Pharmacy Orders
        if (billingData.pharmacyOrders && billingData.pharmacyOrders.length > 0) {
            billingData.pharmacyOrders.forEach((p) => {
                const paid = isPaid(p.paymentStatus || p.status || p.orderStatus);
                const orderTotal = getPharmacyTotal(p);
                rowsHtml += `
                    <tr>
                        <td style="text-align: center;">${rowIdx++}</td>
                        <td><strong>Pharmacy Order #${p.orderNumber || p._id?.slice(-6) || ''} (${p.items?.length || 0} items)</strong></td>
                        <td>Pharmacy</td>
                        <td><code>—</code></td>
                        <td>${fmtDate(p.orderDate || p.createdAt)}</td>
                        <td style="text-align: center;"><span class="${paid ? 'ha-pr-status-badge' : 'ha-pr-status-pending'}">${p.paymentStatus || p.status || (paid ? 'Paid' : 'Pending')}</span></td>
                        <td style="text-align: right; font-weight: 700;">${fmt(orderTotal)}</td>
                    </tr>
                `;
            });
        }

        if (!rowsHtml) {
            rowsHtml = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 16px; color: #64748b;">
                        No individual transactions or bill items recorded.
                    </td>
                </tr>
            `;
        }

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Official Patient Billing & Payment Receipt - ${formatPatientName(pat.name)}</title>
    <style>
        @page { size: A4; margin: 12mm 15mm; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 24px 28px;
            background: #ffffff;
            color: #0f172a;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 13px;
        }
        .ha-printable-receipt {
            display: block;
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #0f172a;
            font-family: Arial, Helvetica, sans-serif;
        }
        .ha-pr-clean-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
        }
        .ha-pr-left-meta {
            flex: 1;
        }
        .ha-pr-hospital-name {
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 2px 0;
            text-transform: uppercase;
            letter-spacing: -0.3px;
        }
        .ha-pr-receipt-tag {
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-bottom: 12px;
        }
        .ha-pr-aligned-details {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-top: 8px;
        }
        .ha-pr-row {
            display: flex;
            align-items: baseline;
            font-size: 13px;
            gap: 8px;
        }
        .ha-pr-label {
            width: 185px;
            color: #475569;
            font-weight: 600;
            font-size: 12px;
            flex-shrink: 0;
        }
        .ha-pr-val {
            color: #0f172a;
            font-size: 13px;
        }
        .ha-pr-val.ha-pr-name {
            font-size: 14px;
            font-weight: 700;
            color: #1e3a8a;
        }
        .ha-pr-right-meta {
            text-align: right;
        }
        .ha-pr-badge-paid {
            border: 2px solid #16a34a;
            color: #16a34a;
            padding: 3px 10px;
            border-radius: 6px;
            font-weight: 800;
            font-size: 12px;
            display: inline-block;
            text-transform: uppercase;
        }
        .ha-pr-badge-pending {
            border: 2px solid #d97706;
            color: #d97706;
            padding: 3px 10px;
            border-radius: 6px;
            font-weight: 800;
            font-size: 12px;
            display: inline-block;
            text-transform: uppercase;
        }
        .ha-pr-date-issued {
            font-size: 11px;
            color: #64748b;
            margin-top: 5px;
        }
        .ha-pr-hr {
            height: 2px;
            background: #0f172a;
            margin: 12px 0 14px 0;
        }
        .ha-pr-section-title {
            font-size: 12px;
            font-weight: 800;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 8px;
            margin-top: 14px;
        }
        .ha-pr-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
            font-size: 12px;
        }
        .ha-pr-table th {
            background: #f1f5f9;
            color: #0f172a;
            font-weight: 700;
            text-align: left;
            padding: 7px 10px;
            border-top: 1px solid #cbd5e1;
            border-bottom: 2px solid #cbd5e1;
            font-size: 11px;
            text-transform: uppercase;
        }
        .ha-pr-table td {
            padding: 7px 10px;
            border-bottom: 1px solid #e2e8f0;
            color: #1e293b;
        }
        .ha-pr-status-badge {
            display: inline-block;
            padding: 2px 7px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            color: #15803d;
            background: #dcfce7;
            border: 1px solid #bbf7d0;
        }
        .ha-pr-status-pending {
            display: inline-block;
            padding: 2px 7px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            color: #b45309;
            background: #fef3c7;
            border: 1px solid #fde68a;
        }
        .ha-pr-totals-container {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
            margin-bottom: 18px;
        }
        .ha-pr-totals-card {
            width: 280px;
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            padding: 8px 12px;
            background: #f8fafc;
        }
        .ha-pr-totals-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            padding: 3px 0;
            color: #334155;
        }
        .ha-pr-totals-row.paid {
            font-weight: 700;
            color: #15803d;
            font-size: 13px;
            border-top: 1px solid #cbd5e1;
            border-bottom: 1px solid #cbd5e1;
            margin: 3px 0;
            padding: 4px 0;
        }
        .ha-pr-totals-row.balance {
            font-weight: 700;
            color: #0f172a;
        }
        .ha-pr-footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
        }
        .ha-pr-footer-note {
            font-size: 10px;
            color: #64748b;
            line-height: 1.5;
        }
        .ha-pr-footer-sig {
            text-align: center;
        }
        .ha-pr-sig-line {
            width: 170px;
            height: 1px;
            background: #0f172a;
            margin-bottom: 5px;
        }
        .ha-pr-footer-sig span {
            font-size: 11px;
            font-weight: 600;
            color: #334155;
        }
        code {
            font-family: monospace;
            font-size: 11px;
        }
    </style>
</head>
<body>
    <div class="ha-printable-receipt">
        <div class="ha-pr-clean-header">
            <div class="ha-pr-left-meta">
                <h1 class="ha-pr-hospital-name">${hospitalName}</h1>
                <div class="ha-pr-receipt-tag">Official Patient Billing & Payment Receipt</div>

                <div class="ha-pr-aligned-details">
                    <div class="ha-pr-row">
                        <span class="ha-pr-label">Appointment Date &amp; Time:</span>
                        <strong class="ha-pr-val">${printBookingInfo.dateStr} ${printBookingInfo.timeStr ? `(${printBookingInfo.timeStr})` : ''}</strong>
                    </div>
                    <div class="ha-pr-row">
                        <span class="ha-pr-label">Patient Name:</span>
                        <strong class="ha-pr-val ha-pr-name">${formatPatientName(pat.name)}</strong>
                    </div>
                    <div class="ha-pr-row">
                        <span class="ha-pr-label">MRN / Patient ID:</span>
                        <span class="ha-pr-val">${pat.mrn || pat.patientId || '—'}</span>
                    </div>
                    <div class="ha-pr-row">
                        <span class="ha-pr-label">Phone Number:</span>
                        <span class="ha-pr-val">${pat.phone || '—'}</span>
                    </div>
                    ${pat.gender ? `
                    <div class="ha-pr-row">
                        <span class="ha-pr-label">Gender:</span>
                        <span class="ha-pr-val">${pat.gender}</span>
                    </div>` : ''}
                    ${pat.dob ? `
                    <div class="ha-pr-row">
                        <span class="ha-pr-label">Date of Birth:</span>
                        <span class="ha-pr-val">${fmtDate(pat.dob)}</span>
                    </div>` : ''}
                </div>
            </div>

            <div class="ha-pr-right-meta">
                <div class="${isSettled ? 'ha-pr-badge-paid' : 'ha-pr-badge-pending'}">
                    ${isSettled ? '✓ PAID &amp; SETTLED' : `BALANCE DUE: ${fmt(bTotal)}`}
                </div>
                <div class="ha-pr-date-issued">Receipt Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            </div>
        </div>

        <div class="ha-pr-hr"></div>

        <div class="ha-pr-section-title">PAYMENT &amp; BILLING DETAILS</div>

        <table class="ha-pr-table">
            <thead>
                <tr>
                    <th style="width: 35px; text-align: center;">#</th>
                    <th>Service / Description</th>
                    <th>Payment Mode</th>
                    <th>Transaction Ref / UTR</th>
                    <th>Date &amp; Time</th>
                    <th style="text-align: center;">Status</th>
                    <th style="text-align: right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>

        <div class="ha-pr-totals-container">
            <div class="ha-pr-totals-card">
                <div class="ha-pr-totals-row">
                    <span>Grand Total Bill:</span>
                    <strong>${fmt(gTotal)}</strong>
                </div>
                <div class="ha-pr-totals-row paid">
                    <span>Total Amount Paid:</span>
                    <strong style="color: #15803d;">${fmt(pTotal)}</strong>
                </div>
                <div class="ha-pr-totals-row balance">
                    <span>Balance Due:</span>
                    <strong>${fmt(bTotal)}</strong>
                </div>
            </div>
        </div>

        <div class="ha-pr-footer">
            <div class="ha-pr-footer-note">
                • Official receipt issued by ${hospitalName}.<br />
                • Valid for insurance, tax deduction, and hospital records.
            </div>
            <div class="ha-pr-footer-sig">
                <div class="ha-pr-sig-line"></div>
                <span>Authorized Signature &amp; Stamp</span>
            </div>
        </div>
    </div>
</body>
</html>`;

        const fileName = `Consolidated_Bill_${pat.mrn || pat.patientId || pat.name || 'Statement'}`;
        if (action === 'download') {
            downloadPdfDocument(htmlContent, fileName);
        } else {
            printPdfDocument(htmlContent);
        }
    };

    const downloadConsolidatedBill = (pat, billingData) => printConsolidatedBill(pat, billingData, 'download');

    const getSectionBadge = (items) => {
        const total = items.length;
        if (total === 0) return null;
        const paid = items.filter(x => isPaid(x.paymentStatus)).length;
        const pending = total - paid;
        if (paid === total) return `${total} paid`;
        if (pending === total) return `${total} pending`;
        return `${pending} pending, ${paid} paid`;
    };

    // Split Payments
    const handleSplitPaymentChange = (index, field, value) => {
        const newSplits = [...splitPayments];
        newSplits[index][field] = value;
        setSplitPayments(newSplits);
    };

    const addSplitPayment = () => setSplitPayments([...splitPayments, { method: 'Cash', amount: '' }]);
    const removeSplitPayment = (index) => setSplitPayments(splitPayments.filter((_, i) => i !== index));

    const totalSplitAmount = splitPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const executePayment = async (extraData = {}) => {
        const total = totalSelected();
        setPaying(true);
        try {
            await billingAPI.processPayment({
                appointmentIds: selected.appointments,
                labReportIds: selected.labReports,
                pharmacyOrderIds: selected.pharmacyOrders,
                facilityChargeIds: selected.facilityCharges,
                admissionIds: selected.admissions,
                surgeryPlanIds: selected.surgeryPlans,
                splitPayments,
                patientId: patient?._id,
                amount: total,
                ...extraData
            });
            setSuccessMsg(`Payment of ${fmt(total)} processed successfully.`);
            toast.success(`Payment of ${fmt(total)} processed successfully!`);
            const res = await billingAPI.getPatientBills(searchQuery.trim());
            if (res.success) setBilling(res.billing);
            setSelected({ appointments: [], labReports: [], pharmacyOrders: [], facilityCharges: [], admissions: [], surgeryPlans: [] });
            setSplitPayments([{ method: 'Cash', amount: '' }]);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Payment failed');
        } finally {
            setPaying(false);
        }
    };

    const confirmPaymentWithProof = async () => {
        let proofUrl = '';
        let proofFileId = '';

        setPaying(true);
        try {
            if (proofFile) {
                const formData = new FormData();
                formData.append('images', {
                    uri: proofFile.uri,
                    name: proofFile.name || 'proof.jpg',
                    type: proofFile.mimeType || 'image/jpeg'
                });
                const uploadRes = await uploadAPI.uploadImages(formData);
                if (uploadRes?.success && uploadRes.files?.length > 0) {
                    proofUrl = uploadRes.files[0].url;
                    proofFileId = uploadRes.files[0].fileId;
                }
            }

            await executePayment({
                transactionId: paymentModal.data.transactionId,
                upiId: paymentModal.data.upiId,
                cardDetails: paymentModal.data.cardDetails,
                bankReference: paymentModal.data.bankReference,
                proofUrl,
                proofFileId
            });
            setPaymentModal({ open: false, data: {} });
            setProofFile(null);
        } catch (err) {
            console.error('Proof upload failed:', err);
            toast.error('Failed to process payment with proof');
            setPaying(false);
        }
    };

    const handleDischarge = async (admissionId) => {
        if (!(await confirmToast('Discharge this patient?', { title: 'Discharge Patient' }))) return;
        setDischargingId(admissionId);
        try {
            await admissionAPI.dischargePatient(admissionId);
            toast.success('Patient discharged successfully');
            const res = await billingAPI.getPatientBills(searchQuery.trim());
            if (res.success) setBilling(res.billing);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Discharge failed');
        } finally {
            setDischargingId(null);
        }
    };

    const activeAdmissions = billing?.admissions?.filter(a => a.status === 'Admitted') || [];
    const pastAdmissions = billing?.admissions?.filter(a => a.status === 'Discharged') || [];
    const pendingAdmissionsList = activeAdmissions.filter(adm => !isPaid(adm.paymentStatus));
    const pendingSurgeryPlans = (billing?.surgeryPlans || []).filter(s => s.paymentStatus !== 'PAID');
    const pendingAppointments = (billing?.appointments || []).filter(a => !isPaid(a.paymentStatus));
    const pendingFacilityCharges = (billing?.facilityCharges || []).filter(f => !isPaid(f.paymentStatus));
    const pendingLabReports = (billing?.labReports || []).filter(l => !isPaid(l.paymentStatus));
    const pendingPharmacyOrders = (billing?.pharmacyOrders || []).filter(p => !isPaid(p.paymentStatus));
    const pendingPastAdmissions = pastAdmissions.filter(adm => !isPaid(adm.paymentStatus));

    return (
        <ScrollView
            ref={mainScrollViewRef}
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
        >
            {/* Top banner when in patient settlement tab (Exact Web line 1765) */}
            {activeTab === 'patient' && !isHospitalAdmin && (
                <View style={styles.billingHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.billingHeaderTitle}>
                            💳 Record & Settle Patient Payment
                        </Text>
                        <Text style={styles.billingHeaderSub}>
                            Search patient, calculate outstanding dues across OPD, Pharmacy, Lab, and record collections.
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.btnBack}
                        onPress={() => {
                            setActiveTab('history');
                            mainScrollViewRef.current?.scrollTo({ y: 0, animated: false });
                        }}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.btnBackText}>← Back to Payment Register</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Navigation Tabs (Only for staff, hidden for Hospital Admin - Exact Web line 1806) */}
            {!isHospitalAdmin && (
                <View style={styles.billingNavTabs}>
                    <TouchableOpacity
                        style={[styles.billingNavTabBtn, activeTab === 'patient' && styles.billingNavTabBtnActive]}
                        onPress={() => setActiveTab('patient')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.bntIcon}>💳</Text>
                        <Text style={[styles.bntTitle, activeTab === 'patient' && styles.bntTitleActive]}>
                            Individual Patient Billing
                        </Text>
                        {patient ? (
                            <View style={styles.bntBadgeActive}>
                                <Text style={styles.bntBadgeActiveText} numberOfLines={1}>{patient.name}</Text>
                            </View>
                        ) : null}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.billingNavTabBtn, activeTab === 'history' && styles.billingNavTabBtnActive]}
                        onPress={() => {
                            setActiveTab('history');
                            fetchHospitalHistory();
                        }}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.bntIcon}>📜</Text>
                        <Text style={[styles.bntTitle, activeTab === 'history' && styles.bntTitleActive]}>
                            Hospital Billing & Payment History
                        </Text>
                        <View style={styles.bntBadge}>
                            <Text style={styles.bntBadgeText}>{historyMetrics.count || historyTransactions.length}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            {/* ========================================================================= */}
            {/* VIEW A: PATIENT BILLING / BREAKDOWN REGISTER (activeTab === 'patient')   */}
            {/* ========================================================================= */}
            {activeTab === 'patient' && (
                <View style={[styles.billingPatientViewWrap, isHospitalAdmin && { paddingHorizontal: 0 }]}>
                    {/* Live Patient Search Input (Only when no patient is selected and not Hospital Admin) */}
                    {!patient && !isHospitalAdmin && (
                        <>
                            <View style={styles.billingSearchBar}>
                                <View style={styles.billingSearchInputWrap}>
                                    <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                                    <TextInput
                                        style={styles.billingSearchInput}
                                        placeholder="Search patient by name, phone or MRN..."
                                        placeholderTextColor="#94a3b8"
                                        value={searchQuery}
                                        onChangeText={handleQueryChange}
                                        onSubmitEditing={handleSearch}
                                    />
                                    {searchQuery ? (
                                        <TouchableOpacity onPress={() => { setSearchQuery(''); setPatient(null); setBilling(null); }}>
                                            <Feather name="x" size={16} color="#94a3b8" />
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                                <TouchableOpacity style={styles.btnSearch} onPress={handleSearch} activeOpacity={0.8}>
                                    <Text style={styles.btnSearchText}>Search</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Suggestions Dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <View style={styles.suggestionsDropdown}>
                                    {suggestions.map(p => (
                                        <TouchableOpacity
                                            key={p._id}
                                            style={styles.suggestionRow}
                                            onPress={() => {
                                                setShowSuggestions(false);
                                                setSearchQuery(p.name || p.mrn || p.phone);
                                                loadPatientBilling(p._id || p.mrn);
                                            }}
                                        >
                                            <Text style={{ fontWeight: '700', color: '#0f172a', fontSize: 13.5 }}>{p.name}</Text>
                                            <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                                                MRN: {p.mrn || p.patientId || '—'} • Phone: {p.phone || '—'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </>
                    )}

                    {loading && (
                        <View style={styles.loadingCard}>
                            <ActivityIndicator size="large" color="#0f766e" />
                            <Text style={styles.loadingText}>Loading patient billing details...</Text>
                        </View>
                    )}

                    {error ? (
                        <View style={styles.billingError}>
                            <Text style={styles.billingErrorText}>{error}</Text>
                        </View>
                    ) : null}

                    {successMsg ? (
                        <View style={styles.billingSuccess}>
                            <Text style={styles.billingSuccessText}>{successMsg}</Text>
                        </View>
                    ) : null}

                    {/* Patient Loaded View */}
                    {patient && billing ? (
                        <View>
                            {/* Patient Card (Exact Web .patient-info-card.ha-patient-banner-cool) */}
                            <View style={styles.haPatientBannerCool}>
                                <View style={styles.haPatBannerTop}>
                                    <View style={styles.haPatBannerLeft}>
                                        <View style={styles.haPatBannerAvatar}>
                                            <Text style={styles.haPatBannerAvatarText}>
                                                {patient.name?.charAt(0)?.toUpperCase() || 'P'}
                                            </Text>
                                        </View>
                                        <View style={styles.haPatBannerIdentity}>
                                            <Text style={styles.haPatBannerName}>
                                                {formatPatientName(patient.name)}
                                            </Text>
                                            <View style={styles.haPatBannerMeta}>
                                                <View style={styles.haPatTag}>
                                                    <Text style={styles.haPatTagText}>MRN: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{patient.mrn || patient.patientId || '—'}</Text></Text>
                                                </View>
                                                <View style={styles.haPatTag}>
                                                    <Text style={styles.haPatTagText}>Phone: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{patient.phone || '—'}</Text></Text>
                                                </View>
                                                {patient.gender ? (
                                                    <View style={styles.haPatTag}>
                                                        <Text style={styles.haPatTagText}>Gender: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{patient.gender}</Text></Text>
                                                    </View>
                                                ) : null}
                                                {patient.dob ? (
                                                    <View style={styles.haPatTag}>
                                                        <Text style={styles.haPatTagText}>DOB: <Text style={{ fontWeight: '700', color: '#0f172a' }}>{fmtDate(patient.dob)}</Text></Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.haPatBannerRight}>
                                        <TouchableOpacity
                                            style={styles.haPatBackBtn}
                                            onPress={() => {
                                                setActiveTab('history');
                                                mainScrollViewRef.current?.scrollTo({ y: 0, animated: false });
                                            }}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.haPatBackBtnText}>← Back to Payment Register</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.haPatBtnPrint}
                                            onPress={() => printConsolidatedBill(patient, billing, 'print')}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.haPatBtnPrintText}>
                                                {width >= 768 ? '🖨️ Print Consolidated Bill' : '📥 Download'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Financial Strip (Exact Web .ha-pat-financial-strip) */}
                                <View style={styles.haPatFinancialStrip}>
                                    <View style={styles.haPatMetricsGroup}>
                                        <View style={[styles.haPatMetricPill, styles.haPatMetricPillTotal]}>
                                            <Text style={styles.haMetricLbl}>Grand Total Bill</Text>
                                            <Text style={[styles.haMetricVal, { color: '#0284c7' }]}>{fmt(grandTotalBill())}</Text>
                                        </View>
                                        <View style={[styles.haPatMetricPill, styles.haPatMetricPillPaid]}>
                                            <Text style={styles.haMetricLbl}>Total Paid</Text>
                                            <Text style={[styles.haMetricVal, { color: '#16a34a' }]}>{fmt(totalPaidBill())}</Text>
                                        </View>
                                        <View style={[styles.haPatMetricPill, styles.haPatMetricPillBalance]}>
                                            <Text style={styles.haMetricLbl}>Balance Due</Text>
                                            <Text style={[styles.haMetricVal, { color: '#d97706' }]}>{fmt(balanceBill())}</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Active Admissions (Exact Web line 2077) */}
                            {(isHospitalAdmin ? pendingAdmissionsList.length > 0 : activeAdmissions.length > 0) && (
                                <View style={[styles.billingSection, styles.admittedSection]}>
                                    <View style={[styles.sectionHeader, styles.admittedHeader]}>
                                        <View style={styles.admittedBadge}>
                                            <Text style={styles.admittedBadgeText}>Currently Admitted</Text>
                                        </View>
                                        <Text style={styles.sectionHeaderTitle}>Active Hospitalization</Text>
                                    </View>
                                    {(isHospitalAdmin ? pendingAdmissionsList : activeAdmissions).map(adm => (
                                        <View key={adm._id} style={styles.admissionCard}>
                                            <View style={styles.admissionTop}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontSize: 13, color: '#334155' }}>
                                                        <Text style={{ fontWeight: '700' }}>Admitted: </Text>{fmtAdmissionDateTime(adm.admissionDate, adm.admissionTime, adm.createdAt)}
                                                    </Text>
                                                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                                                        {adm.ward ? <View style={styles.badgeWard}><Text style={styles.badgeWardText}>Ward: {adm.ward}</Text></View> : null}
                                                        {adm.bedNumber ? <View style={styles.badgeBed}><Text style={styles.badgeBedText}>Bed: {adm.bedNumber}</Text></View> : null}
                                                    </View>
                                                </View>
                                                <View style={styles.admissionActions}>
                                                    {!isHospitalAdmin ? (
                                                        <TouchableOpacity
                                                            style={styles.btnDischarge}
                                                            onPress={() => handleDischarge(adm._id)}
                                                            disabled={dischargingId === adm._id}
                                                        >
                                                            <Text style={styles.btnDischargeText}>
                                                                {dischargingId === adm._id ? 'Discharging...' : 'Discharge'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ) : (
                                                        <View style={styles.statusBadgePending}>
                                                            <Text style={styles.statusBadgePendingText}>Pending — {fmt(adm.totalAmount)}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Scheduled Surgeries & OT Procedures (Exact Web line 2154) */}
                            {(isHospitalAdmin ? pendingSurgeryPlans.length > 0 : (billing.surgeryPlans && billing.surgeryPlans.length > 0)) && (
                                <View style={[styles.billingSection, { borderLeftWidth: 4, borderLeftColor: '#7c3aed' }]}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionHeaderTitle}>
                                            🩺 Scheduled Surgeries & OT Procedures {isHospitalAdmin ? `(${pendingSurgeryPlans.length} pending)` : `(${getSectionBadge(billing.surgeryPlans)})`}
                                        </Text>
                                    </View>
                                    {(isHospitalAdmin ? pendingSurgeryPlans : billing.surgeryPlans).map(s => {
                                        const isFullyPaid = s.paymentStatus === 'PAID';
                                        const cost = Number(s.surgeryCost) || 0;
                                        const paid = Number(s.paidAmount) || 0;
                                        const { dateStr, timeStr } = getSurgeryDateTime(s);
                                        return (
                                            <View key={s._id} style={styles.itemRow}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontWeight: '700', color: '#0f172a', fontSize: 13.5 }}>{s.surgery}</Text>
                                                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
                                                        {dateStr} {timeStr ? `(${timeStr})` : ''} • Dr. {s.surgeonId?.name || 'Surgeon'}
                                                    </Text>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.amountCellText}>{fmt(cost)}</Text>
                                                    <View style={[styles.statusBadgeSmall, { backgroundColor: isFullyPaid ? '#dcfce7' : '#fee2e2' }]}>
                                                        <Text style={{ fontSize: 11, fontWeight: '700', color: isFullyPaid ? '#15803d' : '#dc2626' }}>
                                                            {isFullyPaid ? 'Paid' : 'Unpaid'}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* Consultations & ICU Charges (Exact Web line 2281) */}
                            {(isHospitalAdmin ? (pendingAppointments.length > 0 || pendingFacilityCharges.length > 0) : (billing.appointments?.length > 0 || billing.facilityCharges?.length > 0)) && (
                                <View style={styles.billingSection}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionHeaderTitle}>Consolidated Billing View (Consultations & ICU Charges)</Text>
                                    </View>
                                    {(isHospitalAdmin ? pendingAppointments : (billing.appointments || [])).map(a => (
                                        <View key={a._id} style={styles.itemRow}>
                                            {!isHospitalAdmin && (
                                                <TouchableOpacity onPress={() => !isPaid(a.paymentStatus) && toggle('appointments', a._id)} style={{ marginRight: 10 }}>
                                                    {isPaid(a.paymentStatus) ? (
                                                        <Text style={styles.paidIconCheck}>✓</Text>
                                                    ) : (
                                                        <Feather name={selected.appointments.includes(a._id) ? "check-square" : "square"} size={18} color={selected.appointments.includes(a._id) ? "#0d9488" : "#94a3b8"} />
                                                    )}
                                                </TouchableOpacity>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontWeight: '700', color: '#0f172a', fontSize: 13.5 }}>Appointment Fee</Text>
                                                <Text style={{ fontSize: 12, color: '#64748b' }}>
                                                    {fmtDate(a.appointmentDate, a.appointmentTime)} • Dr. {a.doctorName || 'Doctor'}
                                                </Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.amountCellText}>{fmt(a.amount)}</Text>
                                                <Text style={[styles.statusBadgeText, { color: isPaid(a.paymentStatus) ? '#16a34a' : '#ea580c' }]}>
                                                    {isPaid(a.paymentStatus) ? 'PAID' : 'Pending'}
                                                </Text>
                                            </View>
                                        </View>
                                    ))}
                                    {(isHospitalAdmin ? pendingFacilityCharges : (billing.facilityCharges || [])).map(f => (
                                        <View key={f._id} style={styles.itemRow}>
                                            {!isHospitalAdmin && (
                                                <TouchableOpacity onPress={() => !isPaid(f.paymentStatus) && toggle('facilityCharges', f._id)} style={{ marginRight: 10 }}>
                                                    {isPaid(f.paymentStatus) ? (
                                                        <Text style={styles.paidIconCheck}>✓</Text>
                                                    ) : (
                                                        <Feather name={selected.facilityCharges.includes(f._id) ? "check-square" : "square"} size={18} color={selected.facilityCharges.includes(f._id) ? "#0d9488" : "#94a3b8"} />
                                                    )}
                                                </TouchableOpacity>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontWeight: '700', color: '#0f172a', fontSize: 13.5 }}>ICU / Facility Charge</Text>
                                                <Text style={{ fontSize: 12, color: '#64748b' }}>
                                                    {f.facilityName} ({f.daysUsed || f.days || 1} Days @ {fmt(f.pricePerDay)}/day)
                                                </Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.amountCellText}>{fmt(f.totalAmount)}</Text>
                                                <Text style={[styles.statusBadgeText, { color: isPaid(f.paymentStatus) ? '#16a34a' : '#ea580c' }]}>
                                                    {isPaid(f.paymentStatus) ? 'PAID' : 'Pending'}
                                                </Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Lab Reports (Exact Web line 2364) */}
                            {(isHospitalAdmin ? pendingLabReports.length > 0 : (billing.labReports && billing.labReports.length > 0)) && (
                                <View style={styles.billingSection}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionHeaderTitle}>
                                            Lab Tests {isHospitalAdmin ? `(${pendingLabReports.length} pending)` : `(${getSectionBadge(billing.labReports)})`}
                                        </Text>
                                    </View>
                                    {(isHospitalAdmin ? pendingLabReports : billing.labReports).map(l => (
                                        <View key={l._id} style={styles.itemRow}>
                                            {!isHospitalAdmin && (
                                                <TouchableOpacity onPress={() => !isPaid(l.paymentStatus) && toggle('labReports', l._id)} style={{ marginRight: 10 }}>
                                                    {isPaid(l.paymentStatus) ? (
                                                        <Text style={styles.paidIconCheck}>✓</Text>
                                                    ) : (
                                                        <Feather name={selected.labReports.includes(l._id) ? "check-square" : "square"} size={18} color={selected.labReports.includes(l._id) ? "#0d9488" : "#94a3b8"} />
                                                    )}
                                                </TouchableOpacity>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontWeight: '700', color: '#0f172a', fontSize: 13.5 }}>
                                                    {Array.isArray(l.testNames) ? l.testNames.join(', ') : (l.testName || 'Lab Investigation')}
                                                </Text>
                                                <Text style={{ fontSize: 12, color: '#64748b' }}>{fmtDate(l.createdAt)}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={styles.amountCellText}>{fmt(l.amount || l.price)}</Text>
                                                <Text style={[styles.statusBadgeText, { color: isPaid(l.paymentStatus) ? '#16a34a' : '#ea580c' }]}>
                                                    {isPaid(l.paymentStatus) ? 'PAID' : 'Pending'}
                                                </Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Pharmacy Orders (Exact Web line 2406) */}
                            {(isHospitalAdmin ? pendingPharmacyOrders.length > 0 : (billing.pharmacyOrders && billing.pharmacyOrders.length > 0)) && (
                                <View style={styles.billingSection}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionHeaderTitle}>
                                            Pharmacy Orders {isHospitalAdmin ? `(${pendingPharmacyOrders.length} pending)` : `(${getSectionBadge(billing.pharmacyOrders)})`}
                                        </Text>
                                    </View>
                                    {(isHospitalAdmin ? pendingPharmacyOrders : billing.pharmacyOrders).map(p => (
                                        <View key={p._id} style={{ borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 10, paddingHorizontal: 16 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                {!isHospitalAdmin && (
                                                    <TouchableOpacity onPress={() => !isPaid(p.paymentStatus) && toggle('pharmacyOrders', p._id)} style={{ marginRight: 10 }}>
                                                        {isPaid(p.paymentStatus) ? (
                                                            <Text style={styles.paidIconCheck}>✓</Text>
                                                        ) : (
                                                            <Feather name={selected.pharmacyOrders.includes(p._id) ? "check-square" : "square"} size={18} color={selected.pharmacyOrders.includes(p._id) ? "#0d9488" : "#94a3b8"} />
                                                        )}
                                                    </TouchableOpacity>
                                                )}
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontWeight: '700', color: '#0f172a', fontSize: 13.5 }}>📦 {p.items?.length || 0} Items</Text>
                                                    <TouchableOpacity onPress={() => toggleExpand(p._id)}>
                                                        <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: '600', marginTop: 2 }}>
                                                            {expandedRows[p._id] ? 'Hide Details ↑' : 'View Details ↓'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={styles.amountCellText}>{fmt(getPharmacyTotal(p))}</Text>
                                                    <Text style={[styles.statusBadgeText, { color: isPaid(p.paymentStatus) ? '#16a34a' : '#ea580c' }]}>
                                                        {isPaid(p.paymentStatus) ? 'PAID' : 'Pending'}
                                                    </Text>
                                                </View>
                                            </View>
                                            {expandedRows[p._id] && Array.isArray(p.items) && (
                                                <View style={{ backgroundColor: '#f8fafc', padding: 8, borderRadius: 6, marginTop: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                                    {p.items.map((item, idx) => (
                                                        <Text key={idx} style={{ fontSize: 12, color: '#334155', marginVertical: 2 }}>
                                                            • {item.medicineName || item.name} ({item.quantity || 1} qty) - ₹{(Number(item.price) || 50) * (parseInt(item.quantity) || 1)}
                                                        </Text>
                                                    ))}
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Past Admissions (Exact Web line 2481) */}
                            {(isHospitalAdmin ? pendingPastAdmissions.length > 0 : pastAdmissions.length > 0) && (
                                <View style={[styles.billingSection, styles.pastAdmissions]}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionHeaderTitle}>
                                            Past Admissions ({isHospitalAdmin ? pendingPastAdmissions.length : pastAdmissions.length})
                                        </Text>
                                    </View>
                                    {(isHospitalAdmin ? pendingPastAdmissions : pastAdmissions).map(adm => (
                                        <View key={adm._id} style={styles.admissionCard}>
                                            <Text style={{ fontSize: 12.5, color: '#334155' }}>
                                                Admitted: {fmtAdmissionDateTime(adm.admissionDate, adm.admissionTime, adm.createdAt)} • Discharged: {fmtAdmissionDateTime(adm.dischargeDate, adm.dischargeTime, adm.updatedAt)}
                                            </Text>
                                            <Text style={{ fontSize: 12.5, fontWeight: '700', color: isPaid(adm.paymentStatus) ? '#16a34a' : '#d97706', marginTop: 4 }}>
                                                {isPaid(adm.paymentStatus) ? 'Paid' : `Pending — ${fmt(adm.totalAmount)}`}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Payment Panel (Only for staff collection when pendingTotal > 0 - Exact Web line 2519) */}
                            {!isHospitalAdmin && pendingTotal() > 0 && (
                                <View style={styles.paymentPanel}>
                                    <View style={styles.paymentSummary}>
                                        <View style={styles.paymentRow}>
                                            <Text style={styles.paymentSummaryLabel}>Selected Amount:</Text>
                                            <Text style={styles.selectedAmount}>{fmt(totalSelected())}</Text>
                                        </View>
                                        <View style={styles.paymentRow}>
                                            <Text style={styles.paymentSummaryLabel}>Total Balance Due:</Text>
                                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#dc2626' }}>{fmt(pendingTotal())}</Text>
                                        </View>
                                    </View>

                                    <PaymentSection
                                        splitPayments={splitPayments}
                                        onSplitChange={handleSplitPaymentChange}
                                        onAddSplit={addSplitPayment}
                                        onRemoveSplit={removeSplitPayment}
                                        totalAmount={totalSelected()}
                                        upiOptions={upiOptions}
                                        paymentData={paymentModal.data}
                                        onPaymentDataChange={(newData) => setPaymentModal({ ...paymentModal, data: newData })}
                                        proofFile={proofFile}
                                        onProofFileChange={setProofFile}
                                    />

                                    <TouchableOpacity
                                        style={[styles.btnPay, (paying || totalSelected() === 0 || totalSplitAmount !== totalSelected()) ? styles.btnPayDisabled : null]}
                                        disabled={paying || totalSelected() === 0 || totalSplitAmount !== totalSelected()}
                                        onPress={async () => {
                                            if (totalSplitAmount !== totalSelected()) {
                                                toast.error(`Total split amount (${fmt(totalSplitAmount)}) must match selected (${fmt(totalSelected())})`);
                                                return;
                                            }
                                            const hasNonCash = splitPayments.some(p => p.method !== 'Cash');
                                            if (!hasNonCash) {
                                                if (!(await confirmToast(`Process payment of ${fmt(totalSelected())} via Cash?`, { title: 'Process Cash Payment', danger: false }))) return;
                                                executePayment({});
                                            } else {
                                                confirmPaymentWithProof();
                                            }
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.btnPayText}>
                                            {paying ? 'Processing...' : `Pay ${fmt(totalSelected())} (Split: ${fmt(totalSplitAmount)})`}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Payment History & Voucher Receipts Table (Exact Web line 2565) */}
                            <View style={[styles.billingSection, { marginTop: 20 }]}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionHeaderTitle}>Payment History</Text>
                                </View>
                                {(!billing.paymentTransactions || billing.paymentTransactions.length === 0) ? (
                                    <View style={styles.noBillsPrompt}>
                                        <Text style={{ color: '#64748b', fontSize: 13.5, textAlign: 'center' }}>
                                            No past payments recorded for this patient.
                                        </Text>
                                    </View>
                                ) : (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                                        <View style={{ minWidth: 780 }}>
                                            <View style={styles.billingTableHeader}>
                                                <Text style={[styles.bth, { width: 130 }]}>Date</Text>
                                                <Text style={[styles.bth, { width: 100 }]}>Mode</Text>
                                                <Text style={[styles.bth, { width: 120 }]}>Txn ID</Text>
                                                <Text style={[styles.bth, { width: 150 }]}>Details</Text>
                                                <Text style={[styles.bth, { width: 90, textAlign: 'right' }]}>Amount</Text>
                                                <Text style={[styles.bth, { width: 70, textAlign: 'center' }]}>Status</Text>
                                                <Text style={[styles.bth, { width: 60, textAlign: 'center' }]}>View</Text>
                                                <Text style={[styles.bth, { width: 70, textAlign: 'center' }]}>Download</Text>
                                            </View>
                                            {billing.paymentTransactions.map(pt => {
                                                const { dateStr, timeStr } = getBookingDateTime(pt);
                                                return (
                                                    <View key={pt._id} style={styles.billingTableRow}>
                                                        <View style={{ width: 130 }}>
                                                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>{dateStr}</Text>
                                                            <Text style={{ fontSize: 11, color: '#64748b' }}>{timeStr}</Text>
                                                        </View>
                                                        <Text style={{ width: 100, fontSize: 12, color: '#334155' }}>
                                                            {pt.splitPayments && pt.splitPayments.length > 1 ? pt.splitPayments.map(sp => sp.method).join(' + ') : (pt.paymentMode || 'Cash')}
                                                        </Text>
                                                        <Text style={{ width: 120, fontSize: 11, fontFamily: 'monospace', color: '#0f172a' }}>
                                                            {pt.transactionId || pt.upiId || pt.bankReference || '—'}
                                                        </Text>
                                                        <Text style={{ width: 150, fontSize: 12, color: '#475569' }} numberOfLines={1}>
                                                            {pt.description || 'General Payment'}
                                                        </Text>
                                                        <Text style={{ width: 90, fontSize: 12.5, fontWeight: '700', color: '#0f172a', textAlign: 'right' }}>
                                                            {fmt(pt.amount)}
                                                        </Text>
                                                        <View style={{ width: 70, alignItems: 'center' }}>
                                                            <Text style={{ color: '#16a34a', fontWeight: '700', fontSize: 11 }}>Paid</Text>
                                                        </View>
                                                        <View style={{ width: 60, alignItems: 'center' }}>
                                                            {pt.proofUrl ? (
                                                                <TouchableOpacity
                                                                    style={{ padding: 4 }}
                                                                    onPress={() => setViewProofUrl(pt.proofUrl, { patientName: patient?.name, amount: pt.amount, mode: pt.paymentMode, txnId: pt.transactionId || pt.upiId, date: pt.paymentDate })}
                                                                >
                                                                    <Feather name="eye" size={15} color="#0284c7" />
                                                                </TouchableOpacity>
                                                            ) : (
                                                                <Text style={{ color: '#94a3b8', fontSize: 12 }}>—</Text>
                                                            )}
                                                        </View>
                                                        <View style={{ width: 70, alignItems: 'center' }}>
                                                            {pt.proofUrl ? (
                                                                <TouchableOpacity
                                                                    style={{ padding: 4 }}
                                                                    onPress={() => downloadProofFile(pt.proofUrl)}
                                                                    activeOpacity={0.7}
                                                                    title="Download Invoice / Proof"
                                                                >
                                                                    <Feather name="download" size={16} color="#10b981" />
                                                                </TouchableOpacity>
                                                            ) : (
                                                                <Text style={{ color: '#94a3b8', fontSize: 12 }}>—</Text>
                                                            )}
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </ScrollView>
                                )}
                            </View>
                        </View>
                    ) : !loading ? (
                        <View style={styles.billingEmptyPrompt}>
                            <Text style={styles.emptyPromptIcon}>💳</Text>
                            <Text style={styles.emptyPromptTitle}>No Patient Selected</Text>
                            <Text style={styles.emptyPromptSub}>
                                Please select a patient from the Payment History register to view and settle billing.
                            </Text>
                            <TouchableOpacity
                                style={[styles.btnSearch, { marginTop: 14 }]}
                                onPress={() => {
                                    setActiveTab('history');
                                    mainScrollViewRef.current?.scrollTo({ y: 0, animated: false });
                                }}
                            >
                                <Text style={styles.btnSearchText}>Go to Payment History</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>
            )}

            {/* ========================================================================= */}
            {/* VIEW B: HOSPITAL-WIDE PAYMENT REGISTER (activeTab === 'history')          */}
            {/* ========================================================================= */}
            {activeTab === 'history' && (
                <View style={styles.haBillingPage}>
                    {/* 1. Main Header Banner (100% Exact Web line 2682) */}
                    <View style={styles.haMainHeader}>
                        <View style={styles.haHeaderLeft}>
                            <View style={styles.haTitleIconCard}>
                                <Feather name="file-text" size={20} color="#ffffff" />
                            </View>
                            <View style={styles.haTitleTextGroup}>
                                <Text style={styles.haPageTitle}>Payment History</Text>
                                <Text style={styles.haPageSub}>Track and manage all patient payments</Text>
                            </View>
                        </View>

                        <View style={styles.haHeaderRight}>
                            <TouchableOpacity
                                style={styles.haBtnRefreshHeader}
                                onPress={fetchHospitalHistory}
                                activeOpacity={0.7}
                            >
                                <Feather name="refresh-cw" size={12} color="#0f766e" style={{ marginRight: 6 }} />
                                <Text style={styles.haBtnRefreshHeaderText}>Refresh</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* 2. 5 Revenue & Collection Summary Cards (100% Exact Web line 2708) */}
                    <View style={styles.haKpiGrid}>
                        {/* Card 1: Total Earnings */}
                        <TouchableOpacity
                            style={[styles.haKpiCard, styles.haKpiBlue, datePreset === 'all' && historyMode === 'ALL' && !historySearch ? styles.haKpiCardActive : null]}
                            onPress={() => { setDatePreset('all'); setHistoryMode('ALL'); setHistorySearch(''); setHistoryStatus('ALL'); }}
                            activeOpacity={0.8}
                        >
                            <View style={styles.haKpiTop}>
                                <View style={[styles.haKpiIconBox, styles.haKpiIconBoxBlue]}>
                                    <MaterialCommunityIcons name="currency-inr" size={18} color="#2563eb" />
                                </View>
                                <View style={styles.haKpiMeta}>
                                    <Text style={styles.haKpiLabel}>Total Earnings</Text>
                                    <Text style={styles.haKpiValue}>{fmt(revenueStats.totalRevenue)}</Text>
                                    <Text style={styles.haKpiSubCount}>
                                        {revenueStats.totalCount} {revenueStats.totalCount === 1 ? 'payment collected' : 'payments collected'}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>

                        {/* Card 2: This Month / Custom Range */}
                        <TouchableOpacity
                            style={[styles.haKpiCard, styles.haKpiPurple, (datePreset === 'this_month' || datePreset === 'custom') ? styles.haKpiCardActive : null]}
                            onPress={() => {
                                if (datePreset === 'custom') {
                                    setShowCustomRangePicker(true);
                                } else {
                                    setDatePreset(prev => prev === 'this_month' ? 'all' : 'this_month');
                                }
                            }}
                            activeOpacity={0.8}
                        >
                            <View style={styles.haKpiTop}>
                                <View style={[styles.haKpiIconBox, styles.haKpiIconBoxPurple]}>
                                    <Feather name="calendar" size={18} color="#7c3aed" />
                                </View>
                                <View style={styles.haKpiMeta}>
                                    <Text style={styles.haKpiLabel}>
                                        {datePreset === 'custom' ? 'Custom Range' : 'This Month'}
                                    </Text>
                                    <Text style={styles.haKpiValue}>
                                        {datePreset === 'custom' ? fmt(revenueStats.customRevenue) : fmt(revenueStats.monthRevenue)}
                                    </Text>
                                    <Text style={styles.haKpiSubCount}>
                                        {datePreset === 'custom'
                                            ? `${revenueStats.customCount} ${revenueStats.customCount === 1 ? 'payment in range' : 'payments in range'}`
                                            : `${revenueStats.monthCount} ${revenueStats.monthCount === 1 ? 'payment this month' : 'payments this month'}`
                                        }
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>

                        {/* Card 3: This Week */}
                        <TouchableOpacity
                            style={[styles.haKpiCard, styles.haKpiCyan, datePreset === 'this_week' ? styles.haKpiCardActive : null]}
                            onPress={() => setDatePreset(prev => prev === 'this_week' ? 'all' : 'this_week')}
                            activeOpacity={0.8}
                        >
                            <View style={styles.haKpiTop}>
                                <View style={[styles.haKpiIconBox, styles.haKpiIconBoxCyan]}>
                                    <Feather name="trending-up" size={18} color="#0891b2" />
                                </View>
                                <View style={styles.haKpiMeta}>
                                    <Text style={styles.haKpiLabel}>This Week</Text>
                                    <Text style={styles.haKpiValue}>{fmt(revenueStats.weekRevenue)}</Text>
                                    <Text style={styles.haKpiSubCount}>
                                        {revenueStats.weekCount} {revenueStats.weekCount === 1 ? 'payment this week' : 'payments this week'}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>

                        {/* Card 4: Today's Collection */}
                        <TouchableOpacity
                            style={[styles.haKpiCard, styles.haKpiGreen, datePreset === 'today' ? styles.haKpiCardActive : null]}
                            onPress={() => setDatePreset(prev => prev === 'today' ? 'all' : 'today')}
                            activeOpacity={0.8}
                        >
                            <View style={styles.haKpiTop}>
                                <View style={[styles.haKpiIconBox, styles.haKpiIconBoxGreen]}>
                                    <Feather name="check-circle" size={18} color="#10b981" />
                                </View>
                                <View style={styles.haKpiMeta}>
                                    <Text style={styles.haKpiLabel}>Today's Collection</Text>
                                    <Text style={styles.haKpiValue}>{fmt(revenueStats.todayRevenue)}</Text>
                                    <Text style={styles.haKpiSubCount}>
                                        {revenueStats.todayCount} {revenueStats.todayCount === 1 ? 'payment today' : 'payments today'}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>

                        {/* Card 5: Cash & Online Count */}
                        <View style={[styles.haKpiCard, styles.haKpiTeal, historyMode !== 'ALL' ? styles.haKpiCardActive : null]}>
                            <View style={styles.haKpiTop}>
                                <View style={[styles.haKpiIconBox, styles.haKpiIconBoxTeal]}>
                                    <Feather name="credit-card" size={18} color="#0d9488" />
                                </View>
                                <View style={styles.haKpiMeta}>
                                    <View style={styles.haKpiLabelRow}>
                                        <Text style={styles.haKpiLabel}>Cash & Online</Text>
                                        <View style={styles.haKpiBadgePeriodWrap}>
                                            <Text style={styles.haKpiBadgePeriodText}>{revenueStats.activePeriodLabel}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.haKpiModeLines}>
                                        <TouchableOpacity
                                            style={[styles.haModeLine, historyMode === 'Cash' && styles.haModeLineActive]}
                                            onPress={() => setHistoryMode(prev => prev === 'Cash' ? 'ALL' : 'Cash')}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.haModeBadgeText, { color: '#15803d' }]}>💵 Cash: </Text>
                                            <Text style={styles.haModeCountVal}>{revenueStats.activeCashCount}</Text>
                                            <Text style={styles.haModeSubText}> {revenueStats.activeCashCount === 1 ? 'payment' : 'payments'}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.haModeLine, historyMode === 'UPI' && styles.haModeLineActive]}
                                            onPress={() => setHistoryMode(prev => prev === 'UPI' ? 'ALL' : 'UPI')}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.haModeBadgeText, { color: '#0284c7' }]}>📱 Online: </Text>
                                            <Text style={styles.haModeCountVal}>{revenueStats.activeOnlineCount}</Text>
                                            <Text style={styles.haModeSubText}> {revenueStats.activeOnlineCount === 1 ? 'payment' : 'payments'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* 3a. Desktop Filter Toolbar (width >= 800) */}
                    {width >= 800 ? (
                        <View style={styles.haFilterToolbar}>
                            <View style={styles.haSearchBox}>
                                <Feather name="search" size={14} color="#94a3b8" />
                                <TextInput
                                    style={styles.haSearchInput}
                                    placeholder="Search by patient name, MRN, or phone..."
                                    placeholderTextColor="#94a3b8"
                                    value={historySearch}
                                    onChangeText={setHistorySearch}
                                />
                                {historySearch ? (
                                    <TouchableOpacity onPress={() => setHistorySearch('')}>
                                        <Feather name="x" size={15} color="#94a3b8" />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            <View style={styles.haFilterGroup}>
                                <View style={{ width: 140 }}>
                                    <DropdownSelect
                                        options={[
                                            { label: 'All Modes', value: 'ALL' },
                                            { label: 'Cash', value: 'Cash' },
                                            { label: 'UPI / Online', value: 'UPI' },
                                            { label: 'Card', value: 'Card' },
                                            { label: 'Cheque', value: 'Cheque' },
                                            { label: 'Bank Transfer', value: 'Bank Transfer' }
                                        ]}
                                        value={historyMode}
                                        onChange={setHistoryMode}
                                    />
                                </View>

                                <View style={{ width: 135 }}>
                                    <DropdownSelect
                                        options={[
                                            { label: 'All Status', value: 'ALL' },
                                            { label: 'Paid', value: 'PAID' },
                                            { label: 'Partially Paid', value: 'PARTIALLY_PAID' },
                                            { label: 'Refunded', value: 'REFUNDED' }
                                        ]}
                                        value={historyStatus}
                                        onChange={setHistoryStatus}
                                    />
                                </View>

                                <View style={{ width: 150 }}>
                                    <DropdownSelect
                                        options={[
                                            { label: 'Newest First', value: 'newest' },
                                            { label: 'Oldest First', value: 'oldest' },
                                            { label: 'Amount (High → Low)', value: 'amt_high' },
                                            { label: 'Amount (Low → High)', value: 'amt_low' }
                                        ]}
                                        value={historySort}
                                        onChange={setHistorySort}
                                    />
                                </View>

                                <View style={{ width: 140 }}>
                                    <DropdownSelect
                                        options={[
                                            { label: 'All Dates', value: 'all' },
                                            { label: 'Today', value: 'today' },
                                            { label: 'Yesterday', value: 'yesterday' },
                                            { label: 'This Week', value: 'this_week' },
                                            { label: 'This Month', value: 'this_month' },
                                            { label: 'Custom Range', value: 'custom' }
                                        ]}
                                        value={datePreset}
                                        onChange={setDatePreset}
                                    />
                                </View>

                                <TouchableOpacity style={styles.haBtnReset} onPress={handleResetFilters}>
                                    <Feather name="refresh-cw" size={12} color="#64748b" style={{ marginRight: 5 }} />
                                    <Text style={styles.haBtnResetText}>Reset</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        /* 3b. Mobile Filter Bar (width < 800 - Exact Web .ha-mobile-filter-bar) */
                        <View style={styles.haMobileFilterBar}>
                            <View style={styles.haMobileSearchBox}>
                                <Feather name="search" size={14} color="#94a3b8" />
                                <TextInput
                                    style={styles.haMobileSearchInput}
                                    placeholder="Search patient, MRN, phone..."
                                    placeholderTextColor="#94a3b8"
                                    value={historySearch}
                                    onChangeText={setHistorySearch}
                                />
                                {historySearch ? (
                                    <TouchableOpacity onPress={() => setHistorySearch('')}>
                                        <Feather name="x" size={14} color="#94a3b8" />
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            <View style={styles.haMobileFilterActions}>
                                <TouchableOpacity
                                    style={[styles.haMobileBtnFilter, activeFilterCount > 0 && styles.haMobileBtnFilterActive]}
                                    onPress={() => setShowMobileFiltersModal(true)}
                                    activeOpacity={0.8}
                                >
                                    <Feather name="filter" size={13} color={activeFilterCount > 0 ? "#ffffff" : "#0284c7"} style={{ marginRight: 4 }} />
                                    <Text style={[styles.haMobileBtnFilterText, activeFilterCount > 0 && { color: '#ffffff' }]}>Filter</Text>
                                    {activeFilterCount > 0 && (
                                        <View style={styles.haMobileFilterBadge}>
                                            <Text style={styles.haMobileFilterBadgeText}>{activeFilterCount}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.haMobileBtnReset}
                                    onPress={handleResetFilters}
                                    activeOpacity={0.8}
                                >
                                    <Feather name="refresh-cw" size={13} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Custom Range Inputs if custom selected on Desktop */}
                    {datePreset === 'custom' && width >= 800 && (
                        <View style={{ flexDirection: 'row', gap: 10, marginVertical: 10, alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b' }}>From:</Text>
                            <View style={{ width: 140 }}>
                                <DatePickerInput value={customStartDate} onChange={setCustomStartDate} placeholder="Start Date" />
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b' }}>To:</Text>
                            <View style={{ width: 140 }}>
                                <DatePickerInput value={customEndDate} onChange={setCustomEndDate} placeholder="End Date" />
                            </View>
                        </View>
                    )}

                    {/* 4. Sub-Header: Export CSV (Exact Web line 3218) */}
                    <View style={styles.haSubHeader}>
                        <TouchableOpacity style={styles.haBtnExport} onPress={handleExportCSV}>
                            <Feather name="download" size={12} color="#1e293b" style={{ marginRight: 6 }} />
                            <Text style={styles.haBtnExportText}>Export CSV</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 5. Payments Table (100% Exact Web line 3231 - EXACT 7 COLUMNS) */}
                    <View style={styles.haTableCard}>
                        {historyLoading ? (
                            <View style={styles.haTableLoading}>
                                <ActivityIndicator size="small" color="#0f766e" />
                                <Text style={styles.haTableLoadingText}>Fetching payment register...</Text>
                            </View>
                        ) : displayedTransactions.length === 0 ? (
                            <View style={styles.haTableEmpty}>
                                <Text style={styles.haTableEmptyText}>No payment transactions found matching your filters.</Text>
                            </View>
                        ) : (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={true}
                                nestedScrollEnabled={true}
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={{ flexGrow: 1 }}
                            >
                                <View style={{ minWidth: 995 }}>
                                    {/* Table Headers: Exact 7 Columns */}
                                    <View style={styles.haTableHeader}>
                                        <Text style={[styles.haTh, { width: 45, textAlign: 'center' }]}>#</Text>
                                        <Text style={[styles.haTh, { width: 240 }]}>PATIENT</Text>
                                        <Text style={[styles.haTh, { width: 240 }]}>SERVICE / DESCRIPTION</Text>
                                        <Text style={[styles.haTh, { width: 110, textAlign: 'center' }]}>MODE</Text>
                                        <Text style={[styles.haTh, { width: 100, textAlign: 'center' }]}>STATUS</Text>
                                        <Text style={[styles.haTh, { width: 160 }]}>DATE & TIME</Text>
                                        <Text style={[styles.haTh, { width: 100, textAlign: 'center' }]}>ACTION</Text>
                                    </View>

                                    {/* Table Rows: Exact 7 Columns */}
                                    {currentTransactions.map((t, idx) => {
                                        const pat = (typeof t.patientId === 'object' && t.patientId !== null) ? t.patientId : (typeof t.patient === 'object' && t.patient !== null ? t.patient : {});
                                        const isUpi = (t.paymentMode || '').toUpperCase().includes('UPI');
                                        const { dateStr, timeStr } = getBookingDateTime(t);
                                        const avatarStyle = getAvatarStyle(pat.name || t.patientName || 'P');
                                        const rowNum = startIndex + idx + 1;
                                        const { serviceTitle, doctorSubtitle } = parseServiceAndDoctor(t);

                                        return (
                                            <View key={t._id || idx} style={styles.haTableRow}>
                                                {/* 1. Row Number */}
                                                <Text style={{ width: 45, textAlign: 'center', color: '#64748b', fontWeight: '600', fontSize: 13 }}>
                                                    {rowNum}
                                                </Text>

                                                {/* 2. Patient */}
                                                <View style={{ width: 240, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                    <View style={[styles.haPatAvatar, { backgroundColor: avatarStyle.bg }]}>
                                                        <Text style={{ color: avatarStyle.color, fontWeight: '800', fontSize: 14 }}>
                                                            {(pat.name || t.patientName || 'P').charAt(0).toUpperCase()}
                                                        </Text>
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.haPatName} numberOfLines={1}>
                                                            {formatPatientName(pat.name || t.patientName || 'Walk-in Patient')}
                                                        </Text>
                                                        <Text style={styles.haPatMrn}>
                                                            {pat.mrn || pat.patientId || t.patientMrn || 'PCF-M365-001'}
                                                        </Text>
                                                        {(pat.phone || t.patientPhone) ? (
                                                            <Text style={styles.haPatPhone}>
                                                                <Text style={{ fontSize: 10 }}>📞 </Text>{pat.phone || t.patientPhone}
                                                            </Text>
                                                        ) : null}
                                                    </View>
                                                </View>

                                                {/* 3. Service / Description */}
                                                <View style={{ width: 240 }}>
                                                    <Text style={styles.haServiceTitle} numberOfLines={1}>{serviceTitle}</Text>
                                                    {doctorSubtitle ? (
                                                        <Text style={styles.haDoctorSub} numberOfLines={1}>{doctorSubtitle}</Text>
                                                    ) : null}
                                                </View>

                                                {/* 4. Mode */}
                                                <View style={{ width: 110, alignItems: 'center' }}>
                                                    <View style={[styles.haModePill, isUpi ? styles.haModePillUpi : styles.haModePillCash]}>
                                                        <Text style={[styles.haModePillText, isUpi ? { color: '#7c3aed' } : { color: '#15803d' }]}>
                                                            {isUpi ? '📱 UPI' : '💵 CASH'}
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* 5. Status */}
                                                <View style={{ width: 100, alignItems: 'center' }}>
                                                    <View style={styles.haStatusPaid}>
                                                        <Text style={styles.haStatusPaidText}>✓ Paid</Text>
                                                    </View>
                                                </View>

                                                {/* 6. Date & Time */}
                                                <View style={{ width: 160 }}>
                                                    <Text style={styles.haDateText}>{dateStr}</Text>
                                                    {timeStr ? <Text style={styles.haTimeText}>{timeStr}</Text> : null}
                                                </View>

                                                {/* 7. Action: EXACT Web View Button -> openPatientBilling(t) */}
                                                <View style={{ width: 100, alignItems: 'center' }}>
                                                    <View style={styles.haActionCell}>
                                                        <TouchableOpacity
                                                            style={styles.haBtnViewPill}
                                                            onPress={() => openPatientBilling(t)}
                                                            activeOpacity={0.7}
                                                            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                                                            delayPressIn={0}
                                                        >
                                                            <Feather name="eye" size={12} color="#0284c7" style={{ marginRight: 5 }} />
                                                            <Text style={styles.haBtnViewPillText}>View</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            </ScrollView>
                        )}

                        {/* Table Footer with Pagination (Exact Web line 3329) */}
                        <View style={styles.haTableFooter}>
                            <Text style={styles.haPaginationInfo}>
                                Showing {startIndex + 1} - {Math.min(startIndex + itemsPerPage, displayedTransactions.length)} of {displayedTransactions.length} payments
                            </Text>
                            <View style={styles.haPaginationBtns}>
                                <TouchableOpacity
                                    style={[styles.haPageNav, currentPage === 1 && styles.haPageNavDisabled]}
                                    disabled={currentPage === 1}
                                    onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                                >
                                    <Feather name="chevron-left" size={12} color={currentPage === 1 ? '#cbd5e1' : '#64748b'} />
                                </TouchableOpacity>

                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                                    <TouchableOpacity
                                        key={pageNum}
                                        style={[styles.haPageNumber, currentPage === pageNum && styles.haPageNumberActive]}
                                        onPress={() => setCurrentPage(pageNum)}
                                    >
                                        <Text style={[styles.haPageNumberText, currentPage === pageNum && styles.haPageNumberTextActive]}>
                                            {pageNum}
                                        </Text>
                                    </TouchableOpacity>
                                ))}

                                <TouchableOpacity
                                    style={[styles.haPageNav, currentPage === totalPages && styles.haPageNavDisabled]}
                                    disabled={currentPage === totalPages}
                                    onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                >
                                    <Feather name="chevron-right" size={12} color={currentPage === totalPages ? '#cbd5e1' : '#64748b'} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            )}

            {/* ========================================================================= */}
            {/* MODALS                                                                    */}
            {/* ========================================================================= */}

            {/* Mobile Filter Popup / Bottom Sheet (Exact Web line 3063) */}
            <Modal visible={showMobileFiltersModal} transparent animationType="slide">
                <View style={styles.haMfsOverlay}>
                    <View style={styles.haMfsSheet}>
                        <View style={styles.haMfsHeader}>
                            <View style={styles.haMfsTitle}>
                                <Feather name="filter" size={16} color="#0284c7" style={{ marginRight: 6 }} />
                                <Text style={styles.haMfsTitleText}>Filter Payments</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowMobileFiltersModal(false)}>
                                <Text style={styles.haMfsClose}>&times;</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.haMfsBody} showsVerticalScrollIndicator={false}>
                            {/* Payment Mode */}
                            <View style={styles.haMfsGroup}>
                                <Text style={styles.haMfsLabel}>Payment Mode</Text>
                                <View style={styles.haMfsChips}>
                                    {[
                                        { id: 'ALL', label: 'All Modes' },
                                        { id: 'Cash', label: '💵 Cash' },
                                        { id: 'UPI', label: '📱 UPI' },
                                        { id: 'Card', label: '💳 Card' }
                                    ].map(m => (
                                        <TouchableOpacity
                                            key={m.id}
                                            style={[styles.haMfsChip, historyMode === m.id && styles.haMfsChipActive]}
                                            onPress={() => setHistoryMode(m.id)}
                                        >
                                            <Text style={[styles.haMfsChipText, historyMode === m.id && styles.haMfsChipTextActive]}>
                                                {m.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Status */}
                            <View style={styles.haMfsGroup}>
                                <Text style={styles.haMfsLabel}>Status</Text>
                                <View style={styles.haMfsChips}>
                                    {[
                                        { id: 'ALL', label: 'All Status' },
                                        { id: 'PAID', label: '✓ Paid' },
                                        { id: 'PARTIALLY_PAID', label: '⏳ Pending' }
                                    ].map(st => (
                                        <TouchableOpacity
                                            key={st.id}
                                            style={[styles.haMfsChip, historyStatus === st.id && styles.haMfsChipActive]}
                                            onPress={() => setHistoryStatus(st.id)}
                                        >
                                            <Text style={[styles.haMfsChipText, historyStatus === st.id && styles.haMfsChipTextActive]}>
                                                {st.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Sort */}
                            <View style={styles.haMfsGroup}>
                                <Text style={styles.haMfsLabel}>Sort By</Text>
                                <View style={styles.haMfsChips}>
                                    {[
                                        { id: 'newest', label: 'Newest First' },
                                        { id: 'oldest', label: 'Oldest First' },
                                        { id: 'amt_high', label: 'Amount: High to Low' },
                                        { id: 'amt_low', label: 'Amount: Low to High' }
                                    ].map(s => (
                                        <TouchableOpacity
                                            key={s.id}
                                            style={[styles.haMfsChip, historySort === s.id && styles.haMfsChipActive]}
                                            onPress={() => setHistorySort(s.id)}
                                        >
                                            <Text style={[styles.haMfsChipText, historySort === s.id && styles.haMfsChipTextActive]}>
                                                {s.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Date Presets */}
                            <View style={styles.haMfsGroup}>
                                <Text style={styles.haMfsLabel}>Date Range</Text>
                                <View style={styles.haMfsChips}>
                                    {[
                                        { id: 'all', label: 'All Dates' },
                                        { id: 'today', label: 'Today' },
                                        { id: 'yesterday', label: 'Yesterday' },
                                        { id: 'this_week', label: 'This Week' },
                                        { id: 'this_month', label: 'This Month' },
                                        { id: 'custom', label: 'Custom Range' }
                                    ].map(d => (
                                        <TouchableOpacity
                                            key={d.id}
                                            style={[styles.haMfsChip, datePreset === d.id && styles.haMfsChipActive]}
                                            onPress={() => setDatePreset(d.id)}
                                        >
                                            <Text style={[styles.haMfsChipText, datePreset === d.id && styles.haMfsChipTextActive]}>
                                                {d.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {datePreset === 'custom' && (
                                    <View style={styles.haMfsCustomRange}>
                                        <View style={styles.haMfsInputCol}>
                                            <Text style={styles.haMfsSublabel}>From Date</Text>
                                            <DatePickerInput value={customStartDate} onChange={setCustomStartDate} placeholder="Start" />
                                        </View>
                                        <View style={styles.haMfsInputCol}>
                                            <Text style={styles.haMfsSublabel}>To Date</Text>
                                            <DatePickerInput value={customEndDate} onChange={setCustomEndDate} placeholder="End" />
                                        </View>
                                    </View>
                                )}
                            </View>
                        </ScrollView>

                        <View style={styles.haMfsFooter}>
                            <TouchableOpacity
                                style={styles.haMfsBtnReset}
                                onPress={() => {
                                    handleResetFilters();
                                    setShowMobileFiltersModal(false);
                                }}
                            >
                                <Text style={styles.haMfsBtnResetText}>Reset All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.haMfsBtnApply}
                                onPress={() => setShowMobileFiltersModal(false)}
                            >
                                <Text style={styles.haMfsBtnApplyText}>Apply ({displayedTransactions.length} Records)</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Patient Breakdown Modal (Exact Web line 3370) */}
            <Modal visible={inspectPatientModal.open} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.patientBreakdownModal}>
                        <View style={styles.proofModalHeader}>
                            <View>
                                <Text style={styles.proofModalTitle}>🧾 Patient Billing Statement & Breakdown</Text>
                                {inspectPatientModal.patient ? (
                                    <Text style={{ fontSize: 12.5, color: '#475569', marginTop: 3 }}>
                                        {formatPatientName(inspectPatientModal.patient.name)} • MRN: {inspectPatientModal.patient.mrn || '—'}
                                    </Text>
                                ) : null}
                            </View>
                            <TouchableOpacity onPress={() => setInspectPatientModal({ open: false, loading: false, patient: null, billing: null })}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                            {inspectPatientModal.loading ? (
                                <ActivityIndicator size="large" color="#0f766e" style={{ marginVertical: 30 }} />
                            ) : inspectPatientModal.billing ? (
                                <View>
                                    {/* Breakdown Totals */}
                                    <View style={styles.breakdownSummaryRow}>
                                        <View style={[styles.bsCard, { borderColor: '#bae6fd' }]}>
                                            <Text style={styles.bsCardLabel}>Grand Total</Text>
                                            <Text style={[styles.bsCardVal, { color: '#0284c7' }]}>{fmt(inspectGrandTotal(inspectPatientModal.billing))}</Text>
                                        </View>
                                        <View style={[styles.bsCard, { borderColor: '#bbf7d0' }]}>
                                            <Text style={styles.bsCardLabel}>Total Paid</Text>
                                            <Text style={[styles.bsCardVal, { color: '#16a34a' }]}>{fmt(inspectPaidTotal(inspectPatientModal.billing))}</Text>
                                        </View>
                                        <View style={[styles.bsCard, { borderColor: '#fde68a' }]}>
                                            <Text style={styles.bsCardLabel}>Balance</Text>
                                            <Text style={[styles.bsCardVal, { color: '#d97706' }]}>
                                                {fmt(Math.max(0, inspectGrandTotal(inspectPatientModal.billing) - inspectPaidTotal(inspectPatientModal.billing)))}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ) : (
                                <Text style={{ color: '#64748b', textAlign: 'center', marginVertical: 20 }}>No records found.</Text>
                            )}
                        </ScrollView>

                        <View style={styles.proofModalFooter}>
                            <TouchableOpacity
                                style={[styles.btnProofOpen, { backgroundColor: '#0284c7' }]}
                                onPress={() => printPatientStatement(inspectPatientModal.patient, inspectPatientModal.billing)}
                            >
                                <Feather name="printer" size={13} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={styles.btnProofOpenText}>Print Statement</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btnProofOpen, { backgroundColor: '#0f766e' }]}
                                onPress={() => downloadPatientStatement(inspectPatientModal.patient, inspectPatientModal.billing)}
                            >
                                <Feather name="download" size={13} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={styles.btnProofOpenText}>Download Statement</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.btnProofCloseAction}
                                onPress={() => setInspectPatientModal({ open: false, loading: false, patient: null, billing: null })}
                            >
                                <Text style={styles.btnProofCloseActionText}>Close Breakdown</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* View Proof Modal (Exact Web line 3551) */}
            <Modal visible={viewProofModal.open} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.proofViewModal}>
                        <View style={styles.proofModalHeader}>
                            <Text style={styles.proofModalTitle}>📷 Payment Proof / UPI Screenshot</Text>
                            <TouchableOpacity onPress={() => setViewProofUrl('')}>
                                <Feather name="x" size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        {viewProofModal.meta ? (
                            <Text style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
                                Patient: {viewProofModal.meta.patientName} • Amount: {fmt(viewProofModal.meta.amount)}
                            </Text>
                        ) : null}
                        <Image
                            source={{ uri: viewProofModal.url }}
                            style={{ width: '100%', height: 320, borderRadius: 8, backgroundColor: '#f1f5f9' }}
                            resizeMode="contain"
                        />
                        <View style={[styles.proofModalFooter, { marginTop: 14, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }]}>
                            <TouchableOpacity
                                style={[styles.btnProofCloseAction, { backgroundColor: '#0284c7' }]}
                                onPress={() => downloadProofFile(viewProofModal.url)}
                            >
                                <Text style={[styles.btnProofCloseActionText, { color: '#ffffff' }]}>Open Full Size / Download</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.btnProofCloseAction}
                                onPress={() => setViewProofUrl('')}
                            >
                                <Text style={styles.btnProofCloseActionText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    /* Container */
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        padding: 20,
        maxWidth: 1440,
        alignSelf: 'center',
        width: '100%',
        paddingBottom: 60,
    },
    haBillingPage: {
        width: '100%',
    },
    billingPatientViewWrap: {
        width: '100%',
    },

    /* Top Banner (Exact Web .billing-header) */
    billingHeader: {
        backgroundColor: '#0f766e',
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#14b8a6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    billingHeaderTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 2,
    },
    billingHeaderSub: {
        fontSize: 12.5,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    btnBack: {
        paddingVertical: 7,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    btnBackText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 13,
    },

    /* Navigation Tabs (Exact Web .billing-nav-tabs) */
    billingNavTabs: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 12,
        flexWrap: 'wrap',
    },
    billingNavTabBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 22,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
    },
    billingNavTabBtnActive: {
        backgroundColor: '#0f766e',
        borderColor: '#0f766e',
        shadowColor: '#0d9488',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 3,
    },
    bntIcon: {
        fontSize: 17,
    },
    bntTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },
    bntTitleActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    bntBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 20,
        backgroundColor: '#e2e8f0',
    },
    bntBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    bntBadgeActive: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    bntBadgeActiveText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
    },

    /* Patient Search Bar */
    billingSearchBar: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    billingSearchInputWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 2,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        paddingHorizontal: 14,
        height: 44,
    },
    billingSearchInput: {
        flex: 1,
        fontSize: 14,
        color: '#0f172a',
    },
    btnSearch: {
        backgroundColor: '#0d9488',
        paddingHorizontal: 22,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnSearchText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 14,
    },
    suggestionsDropdown: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 6,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
    },
    suggestionRow: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },

    /* Patient Card (Exact Web .ha-patient-banner-cool) */
    haPatientBannerCool: {
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#bae6fd',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#0ea5e9',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 4,
    },
    haPatBannerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 16,
    },
    haPatBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flex: 1,
        minWidth: 280,
    },
    haPatBannerAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#0284c7',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0284c7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
        elevation: 3,
    },
    haPatBannerAvatarText: {
        fontSize: 22,
        fontWeight: '800',
        color: '#ffffff',
    },
    haPatBannerIdentity: {
        flex: 1,
    },
    haPatBannerName: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 4,
    },
    haPatBannerMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    haPatTag: {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    haPatTagText: {
        fontSize: 12,
        color: '#64748b',
    },
    haPatBannerRight: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
    },
    haPatBackBtn: {
        paddingVertical: 7,
        paddingHorizontal: 14,
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderRadius: 8,
    },
    haPatBackBtnText: {
        color: '#334155',
        fontWeight: '600',
        fontSize: 12.5,
    },
    haPatBtnPrint: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#0284c7',
        borderRadius: 8,
        shadowColor: '#0284c7',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 2,
    },
    haPatBtnPrintText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 12.5,
    },

    /* Financial Strip (Exact Web .ha-pat-financial-strip) */
    haPatFinancialStrip: {
        marginTop: 16,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: 'rgba(186, 230, 253, 0.6)',
    },
    haPatMetricsGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    haPatMetricPill: {
        paddingVertical: 8,
        paddingHorizontal: 18,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        minWidth: 135,
    },
    haPatMetricPillTotal: {
        borderColor: '#bae6fd',
        backgroundColor: '#f0f9ff',
    },
    haPatMetricPillPaid: {
        borderColor: '#bbf7d0',
        backgroundColor: '#f0fdf4',
    },
    haPatMetricPillBalance: {
        borderColor: '#fde68a',
        backgroundColor: '#fffbeb',
    },
    haMetricLbl: {
        fontSize: 11,
        textTransform: 'uppercase',
        color: '#64748b',
        fontWeight: '700',
        marginBottom: 2,
    },
    haMetricVal: {
        fontSize: 19,
        fontWeight: '800',
        color: '#0f172a',
    },

    /* Sections */
    billingSection: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        marginBottom: 20,
        overflow: 'hidden',
    },
    sectionHeader: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionHeaderTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    admittedSection: {
        borderColor: '#fde68a',
    },
    admittedHeader: {
        backgroundColor: '#fef3c7',
    },
    admittedBadge: {
        backgroundColor: '#f59e0b',
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: 20,
        marginRight: 8,
    },
    admittedBadgeText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    admissionCard: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#fffbeb',
    },
    admissionTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    admissionActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    badgeWard: {
        backgroundColor: '#ccfbf1',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 10,
    },
    badgeWardText: {
        color: '#0f766e',
        fontSize: 11.5,
        fontWeight: '600',
    },
    badgeBed: {
        backgroundColor: '#f0fdf4',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 10,
    },
    badgeBedText: {
        color: '#15803d',
        fontSize: 11.5,
        fontWeight: '600',
    },
    btnDischarge: {
        paddingVertical: 6,
        paddingHorizontal: 14,
        backgroundColor: '#dc2626',
        borderRadius: 7,
    },
    btnDischargeText: {
        color: '#ffffff',
        fontSize: 12.5,
        fontWeight: '700',
    },
    statusBadgePending: {
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    statusBadgePendingText: {
        color: '#b91c1c',
        fontWeight: '700',
        fontSize: 12,
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    paidIconCheck: {
        width: 20,
        height: 20,
        lineHeight: 20,
        textAlign: 'center',
        backgroundColor: '#dcfce7',
        color: '#16a34a',
        borderRadius: 10,
        fontWeight: 'bold',
        fontSize: 12,
    },
    amountCellText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    statusBadgeText: {
        fontSize: 11.5,
        fontWeight: '700',
        marginTop: 2,
    },
    statusBadgeSmall: {
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 10,
        marginTop: 3,
    },
    pastAdmissions: {
        backgroundColor: '#f8fafc',
    },

    /* Payment Panel (Exact Web .payment-panel) */
    paymentPanel: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 18,
        marginTop: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 3,
    },
    paymentSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 14,
        marginBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        flexWrap: 'wrap',
        gap: 12,
    },
    paymentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    paymentSummaryLabel: {
        fontSize: 13.5,
        color: '#475569',
        fontWeight: '600',
    },
    selectedAmount: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    btnPay: {
        backgroundColor: '#16a34a',
        paddingVertical: 13,
        paddingHorizontal: 24,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },
    btnPayDisabled: {
        opacity: 0.5,
    },
    btnPayText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },

    /* Patient Billing Table inside Patient Tab */
    billingTableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    bth: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#475569',
        textTransform: 'uppercase',
    },
    billingTableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },

    /* Empty Prompt */
    billingEmptyPrompt: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
        borderRadius: 14,
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 24,
    },
    emptyPromptIcon: {
        fontSize: 40,
        marginBottom: 8,
    },
    emptyPromptTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 6,
    },
    emptyPromptSub: {
        fontSize: 13.5,
        color: '#64748b',
        textAlign: 'center',
        maxWidth: 440,
    },
    noBillsPrompt: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
    },
    billingError: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    billingErrorText: {
        color: '#dc2626',
        fontSize: 13,
        fontWeight: '600',
    },
    billingSuccess: {
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#86efac',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    billingSuccessText: {
        color: '#16a34a',
        fontSize: 13,
        fontWeight: '600',
    },
    loadingCard: {
        backgroundColor: '#ffffff',
        padding: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 20,
    },
    loadingText: {
        color: '#475569',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 10,
    },

    /* ========================================================================= */
    /* HOSPITAL PAYMENT HISTORY STYLES (Exact Web .ha-*)                         */
    /* ========================================================================= */
    haMainHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
        flexWrap: 'wrap',
        gap: 14,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    haHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        minWidth: 260,
    },
    haTitleIconCard: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#0f766e',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0f766e',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    haTitleTextGroup: {
        flex: 1,
    },
    haPageTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.4,
    },
    haPageSub: {
        fontSize: 12.5,
        color: '#64748b',
        marginTop: 1,
    },
    haHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    haBtnRefreshHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        paddingHorizontal: 14,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
    },
    haBtnRefreshHeaderText: {
        color: '#0f766e',
        fontSize: 12.5,
        fontWeight: '700',
    },

    /* 5 KPI Cards (Exact Web .ha-kpi-grid) */
    haKpiGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
        flexWrap: 'wrap',
    },
    haKpiCard: {
        flex: 1,
        minWidth: 180,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    haKpiCardActive: {
        borderWidth: 1.5,
        borderColor: '#0284c7',
        shadowColor: '#0284c7',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    haKpiBlue: {
        backgroundColor: '#f0f9ff',
        borderColor: '#bae6fd',
    },
    haKpiPurple: {
        backgroundColor: '#faf5ff',
        borderColor: '#e9d5ff',
    },
    haKpiCyan: {
        backgroundColor: '#ecfeff',
        borderColor: '#a5f3fc',
    },
    haKpiGreen: {
        backgroundColor: '#f0fdf4',
        borderColor: '#bbf7d0',
    },
    haKpiTeal: {
        backgroundColor: '#f0fdfa',
        borderColor: '#99f6e4',
    },
    haKpiTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    haKpiIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    haKpiIconBoxBlue: { backgroundColor: '#eff6ff' },
    haKpiIconBoxPurple: { backgroundColor: '#faf5ff' },
    haKpiIconBoxCyan: { backgroundColor: '#ecfeff' },
    haKpiIconBoxGreen: { backgroundColor: '#f0fdf4' },
    haKpiIconBoxTeal: { backgroundColor: '#f0fdfa' },

    haKpiMeta: {
        flex: 1,
    },
    haKpiLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    haKpiLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    haKpiBadgePeriodWrap: {
        backgroundColor: '#ccfbf1',
        paddingVertical: 1,
        paddingHorizontal: 6,
        borderRadius: 4,
    },
    haKpiBadgePeriodText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#0d9488',
        textTransform: 'uppercase',
    },
    haKpiValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        marginVertical: 2,
    },
    haKpiSubCount: {
        fontSize: 11.5,
        color: '#64748b',
        fontWeight: '500',
    },
    haKpiModeLines: {
        marginTop: 4,
        gap: 2,
    },
    haModeLine: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 1,
        borderRadius: 4,
    },
    haModeLineActive: {
        backgroundColor: '#e0f2fe',
    },
    haModeBadgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    haModeCountVal: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0f172a',
    },
    haModeSubText: {
        fontSize: 10.5,
        color: '#64748b',
    },

    /* Desktop Filter Toolbar (Exact Web .ha-desktop-filter-toolbar) */
    haFilterToolbar: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        flexWrap: 'wrap',
        marginBottom: 10,
    },
    haSearchBox: {
        flex: 1,
        minWidth: 240,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 40,
    },
    haSearchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
    },
    haFilterGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    haBtnReset: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 9,
        paddingVertical: 8,
        paddingHorizontal: 14,
    },
    haBtnResetText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#64748b',
    },

    /* Mobile Filter Bar (Exact Web .ha-mobile-filter-bar) */
    haMobileFilterBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 8,
        marginBottom: 10,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    haMobileSearchBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 38,
    },
    haMobileSearchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
    },
    haMobileFilterActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    haMobileBtnFilter: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 38,
        paddingHorizontal: 10,
        backgroundColor: '#f0f9ff',
        borderWidth: 1.5,
        borderColor: '#bae6fd',
        borderRadius: 8,
    },
    haMobileBtnFilterActive: {
        backgroundColor: '#0284c7',
        borderColor: '#0284c7',
    },
    haMobileBtnFilterText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#0284c7',
    },
    haMobileFilterBadge: {
        backgroundColor: '#ef4444',
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    haMobileFilterBadgeText: {
        color: '#ffffff',
        fontSize: 9.5,
        fontWeight: '800',
    },
    haMobileBtnReset: {
        width: 38,
        height: 38,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* Mobile Filter Sheet Modal (Exact Web .ha-mfs-sheet) */
    haMfsOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'flex-end',
    },
    haMfsSheet: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
        paddingBottom: 20,
    },
    haMfsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    haMfsTitle: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    haMfsTitleText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    haMfsClose: {
        fontSize: 24,
        color: '#94a3b8',
        lineHeight: 24,
    },
    haMfsBody: {
        paddingHorizontal: 18,
        paddingVertical: 14,
    },
    haMfsGroup: {
        marginBottom: 16,
    },
    haMfsLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    haMfsChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    haMfsChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    haMfsChipActive: {
        backgroundColor: '#0284c7',
        borderColor: '#0284c7',
    },
    haMfsChipText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#334155',
    },
    haMfsChipTextActive: {
        color: '#ffffff',
    },
    haMfsCustomRange: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
        backgroundColor: '#f0f9ff',
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#bae6fd',
    },
    haMfsInputCol: {
        flex: 1,
    },
    haMfsSublabel: {
        fontSize: 11,
        color: '#0369a1',
        fontWeight: '600',
        marginBottom: 4,
    },
    haMfsFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 18,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    haMfsBtnReset: {
        flex: 1,
        paddingVertical: 10,
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
    },
    haMfsBtnResetText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },
    haMfsBtnApply: {
        flex: 1.5,
        paddingVertical: 10,
        backgroundColor: '#0284c7',
        borderRadius: 8,
        alignItems: 'center',
    },
    haMfsBtnApplyText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },

    /* Sub-Header Export Button */
    haSubHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: 8,
    },
    haBtnExport: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingVertical: 7,
        paddingHorizontal: 16,
    },
    haBtnExportText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#1e293b',
    },

    /* Payments Table Card (Exact Web .ha-table-card) */
    haTableCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        overflow: 'hidden',
    },
    haTableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    haTh: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748b',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    haTableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    haPatAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    haPatName: {
        fontSize: 13.5,
        fontWeight: '600',
        color: '#0f172a',
    },
    haPatMrn: {
        fontSize: 11.5,
        color: '#64748b',
        fontFamily: 'monospace',
    },
    haPatPhone: {
        fontSize: 11.5,
        color: '#dc2626',
        fontWeight: '600',
        marginTop: 1,
    },
    haServiceTitle: {
        fontSize: 13.5,
        fontWeight: '700',
        color: '#0f172a',
    },
    haDoctorSub: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 2,
    },
    haModePill: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    haModePillCash: {
        backgroundColor: '#dcfce7',
        borderWidth: 1,
        borderColor: '#bbf7d0',
    },
    haModePillUpi: {
        backgroundColor: '#ede9fe',
        borderWidth: 1,
        borderColor: '#ddd6fe',
    },
    haModePillText: {
        fontSize: 11.5,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    haStatusPaid: {
        backgroundColor: '#dcfce7',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    haStatusPaidText: {
        color: '#15803d',
        fontSize: 11.5,
        fontWeight: '700',
    },
    haDateText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#0f172a',
    },
    haTimeText: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1,
    },
    haActionCell: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    haBtnViewPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#38bdf8',
        paddingVertical: 5,
        paddingHorizontal: 14,
        borderRadius: 20,
    },
    haBtnViewPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0284c7',
    },

    /* Pagination Footer (Exact Web .ha-table-footer) */
    haTableFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        backgroundColor: '#ffffff',
        flexWrap: 'wrap',
        gap: 10,
    },
    haPaginationInfo: {
        fontSize: 12.5,
        color: '#64748b',
        fontWeight: '600',
    },
    haPaginationBtns: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    haPageNav: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    haPageNavDisabled: {
        opacity: 0.4,
    },
    haPageNumber: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    haPageNumberActive: {
        backgroundColor: '#2563eb',
        borderColor: '#2563eb',
    },
    haPageNumberText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#334155',
    },
    haPageNumberTextActive: {
        color: '#ffffff',
    },
    haTableLoading: {
        padding: 36,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    haTableLoadingText: {
        fontSize: 13.5,
        color: '#64748b',
    },
    haTableEmpty: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    haTableEmptyText: {
        fontSize: 13.5,
        color: '#64748b',
    },

    /* Modals Overlay & Content */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    patientBreakdownModal: {
        backgroundColor: '#ffffff',
        width: '100%',
        maxWidth: 750,
        borderRadius: 14,
        padding: 24,
        maxHeight: '90%',
    },
    proofViewModal: {
        backgroundColor: '#ffffff',
        width: '100%',
        maxWidth: 480,
        borderRadius: 14,
        padding: 20,
    },
    proofModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 12,
        marginBottom: 14,
    },
    proofModalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    proofModalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 14,
        marginTop: 14,
    },
    btnProofOpen: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0284c7',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    btnProofOpenText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 12.5,
    },
    btnProofCloseAction: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
    },
    btnProofCloseActionText: {
        color: '#475569',
        fontWeight: '600',
        fontSize: 12.5,
    },
    breakdownSummaryRow: {
        flexDirection: 'row',
        gap: 10,
        marginVertical: 12,
        flexWrap: 'wrap',
    },
    bsCard: {
        flex: 1,
        minWidth: 130,
        backgroundColor: '#f8fafc',
        borderWidth: 1.5,
        borderRadius: 8,
        padding: 12,
    },
    bsCardLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    bsCardVal: {
        fontSize: 17,
        fontWeight: '800',
        marginTop: 4,
    },
});

export default PatientBillingProfile;
