import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Modal,
    ActivityIndicator,
    Platform,
    StyleSheet,
    Animated,
    KeyboardAvoidingView,
    useWindowDimensions
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import socket from '../../utils/socket';
import {
    admissionAPI,
    ipdClinicalAPI,
    nursingNoteAPI,
    nursingTaskAPI,
    intakeOutputAPI,
    ipdLineAPI,
    ipdCatheterAPI,
    woundCareAPI,
    nurseHandoverAPI,
    ipdNursingAPI,
    ipdCommandCenterAPI
} from '../../utils/api';

// ── Tab definitions ──
const TABS = [
    { key: 'overview', label: 'Overview', icon: 'eye' },
    { key: 'orders', label: 'Doctor Orders', icon: 'clipboard' },
    { key: 'vitals', label: 'Vitals', icon: 'activity' },
    { key: 'mar', label: 'MAR', icon: 'droplet' },
    { key: 'notes', label: 'Nursing Notes', icon: 'file-text' },
    { key: 'tasks', label: 'Tasks', icon: 'check-square' },
    { key: 'io', label: 'Intake / Output', icon: 'droplet' },
    { key: 'lines', label: 'Lines & Devices', icon: 'layers' },
    { key: 'wound', label: 'Wound Care', icon: 'file-plus' },
    { key: 'investigations', label: 'Investigations', icon: 'clipboard' },
    { key: 'handover', label: 'Handover', icon: 'refresh-cw' },
    { key: 'ot', label: 'OT & Post-Op', icon: 'scissors' },
    { key: 'discharge', label: 'Discharge Readiness', icon: 'log-out' },
    { key: 'timeline', label: 'Timeline', icon: 'clock' },
];

const VITALS_INIT = { systolicBP: '', diastolicBP: '', pulse: '', temperature: '', spo2: '', respiratoryRate: '', painScore: '', notes: '' };
const NOTE_INIT = { note: '', noteType: 'GENERAL', shift: 'Morning', priority: 'Normal' };
const TASK_INIT = { title: '', description: '', taskType: 'OTHER', priority: 'MEDIUM', scheduledAt: '' };
const IO_INIT = { category: 'INTAKE', type: 'Oral', amount: '', unit: 'ml', source: '', notes: '' };
const LINE_INIT = { lineType: 'IV_CANNULA', site: '', gauge: '20G', notes: '' };
const CATHETER_INIT = { catheterType: 'FOLEY', size: '16 Fr', site: 'Urethral', notes: '' };
const WOUND_INIT = { woundSite: '', woundType: 'Surgical', condition: 'Clean', dressingType: 'Gauze', drainageAmount: 'None', drainageType: '', notes: '' };
const HANDOVER_INIT = { shift: 'Morning to Evening', summary: '', importantObservations: '', pendingTasks: '', medicationConcerns: '', safetyConcerns: '' };

const NursePatientWorkspace = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { width } = useWindowDimensions();
    const admissionId = route.params?.admissionId || route.params?.id || '';

    const [activeTab, setActiveTab] = useState('overview');
    const [admission, setAdmission] = useState(null);
    const [orders, setOrders] = useState([]);
    const [vitalsHistory, setVitalsHistory] = useState([]);
    const [latestVitals, setLatestVitals] = useState(null);
    const [marRecords, setMARRecords] = useState([]);
    const [notes, setNotes] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [ioRecords, setIoRecords] = useState([]);
    const [ioSummary, setIoSummary] = useState(null);
    const [lines, setLines] = useState([]);
    const [catheters, setCatheters] = useState([]);
    const [woundRecords, setWoundRecords] = useState([]);
    const [investigations, setInvestigations] = useState([]);
    const [handovers, setHandovers] = useState([]);
    const [otPlans, setOtPlans] = useState([]);
    const [timelineItems, setTimelineItems] = useState([]);
    const [dischargeReadiness, setDischargeReadiness] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [hospitalNurses, setHospitalNurses] = useState([]);

    const [loading, setLoading] = useState({
        admission: true,
        orders: false,
        vitals: false,
        mar: false,
        notes: false,
        tasks: false,
        io: false,
        lines: false,
        wound: false,
        investigations: false,
        handover: false,
        ot: false,
        timeline: false,
        discharge: false
    });

    // Form states
    const [vitalsForm, setVitalsForm] = useState(VITALS_INIT);
    const [noteForm, setNoteForm] = useState(NOTE_INIT);
    const [taskForm, setTaskForm] = useState(TASK_INIT);
    const [ioForm, setIoForm] = useState(IO_INIT);
    const [lineForm, setLineForm] = useState(LINE_INIT);
    const [catheterForm, setCatheterForm] = useState(CATHETER_INIT);
    const [woundForm, setWoundForm] = useState(WOUND_INIT);
    const [handoverForm, setHandoverForm] = useState(HANDOVER_INIT);

    // Modal states
    const [marModal, setMarModal] = useState({
        open: false,
        record: null,
        action: 'GIVE',
        actualDoseValue: '',
        actualDoseUnit: 'mg',
        reason: '',
        notes: '',
        errorMsg: ''
    });
    const [taskModal, setTaskModal] = useState({ open: false, task: null, action: '', notes: '' });
    const [deviceRemoveModal, setDeviceRemoveModal] = useState({ open: false, type: '', id: '', reason: '', notes: '' });
    const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
    const [newLineModalOpen, setNewLineModalOpen] = useState(false);
    const [newCathModalOpen, setNewCathModalOpen] = useState(false);

    // Assignment & Discharge Modals
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [assignForm, setAssignForm] = useState({ nurseId: '', shift: 'Morning', notes: '' });
    const [clearanceModalOpen, setClearanceModalOpen] = useState(false);
    const [clearanceNotes, setClearanceNotes] = useState('');

    // Clarification Modal
    const [clarificationModal, setClarificationModal] = useState({
        open: false,
        order: null,
        issueType: 'DOSAGE_CONFIRMATION',
        question: ''
    });
    const [blockersData, setBlockersData] = useState(null);

    // Filters
    const [orderFilter, setOrderFilter] = useState('ALL');
    const [marFilter, setMarFilter] = useState('ALL');
    const [taskFilter, setTaskFilter] = useState('ALL');

    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    }, []);

    // ── Data Fetching ──
    const fetchAdmission = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, admission: true }));
            let adm = null;
            try {
                const singleRes = await admissionAPI.getAdmissionById(admissionId);
                adm = singleRes?.admission || singleRes?.data || singleRes;
            } catch (singleErr) {
                const res = await admissionAPI.getActiveAdmissions();
                const list = res.admissions || res.data || [];
                adm = list.find(a => a._id === admissionId);
            }
            if (adm) setAdmission(adm);
        } catch (err) {
            console.error('Error fetching admission:', err);
        } finally {
            setLoading(prev => ({ ...prev, admission: false }));
        }
    }, [admissionId]);

    const fetchOrders = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, orders: true }));
            const res = await ipdClinicalAPI.getOrders(admissionId);
            setOrders(res.orders || res.data || []);
        } catch (err) {
            console.error('Error fetching orders:', err);
        } finally {
            setLoading(prev => ({ ...prev, orders: false }));
        }
    }, [admissionId]);

    const fetchDischargeBlockers = useCallback(async () => {
        if (!admissionId) return;
        try {
            const res = await ipdCommandCenterAPI.getDischargeBlockers(admissionId);
            if (res?.success || res?.blockers) setBlockersData(res);
        } catch (err) {
            console.warn('Error fetching discharge blockers:', err);
        }
    }, [admissionId]);

    const fetchVitals = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, vitals: true }));
            const [historyRes, latestRes] = await Promise.all([
                ipdClinicalAPI.getVitalsHistory(admissionId).catch(() => ({ vitals: [] })),
                ipdClinicalAPI.getLatestVitals(admissionId).catch(() => ({ vitals: null }))
            ]);
            setVitalsHistory(historyRes.vitals || []);
            setLatestVitals(latestRes.vitals || null);
        } catch (err) {
            console.error('Error fetching vitals:', err);
        } finally {
            setLoading(prev => ({ ...prev, vitals: false }));
        }
    }, [admissionId]);

    const fetchMAR = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, mar: true }));
            const res = await ipdClinicalAPI.getMARRecords(admissionId);
            setMARRecords(res.marRecords || []);
        } catch (err) {
            console.error('Error fetching MAR:', err);
        } finally {
            setLoading(prev => ({ ...prev, mar: false }));
        }
    }, [admissionId]);

    const fetchNotes = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, notes: true }));
            const res = await nursingNoteAPI.getNotes(admissionId);
            setNotes(res.notes || res.data || []);
        } catch (err) {
            console.error('Error fetching notes:', err);
        } finally {
            setLoading(prev => ({ ...prev, notes: false }));
        }
    }, [admissionId]);

    const fetchTasks = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, tasks: true }));
            const res = await nursingTaskAPI.getTasks(admissionId);
            setTasks(res.tasks || res.data || []);
        } catch (err) {
            console.error('Error fetching tasks:', err);
        } finally {
            setLoading(prev => ({ ...prev, tasks: false }));
        }
    }, [admissionId]);

    const fetchIO = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, io: true }));
            const [historyRes, summaryRes] = await Promise.all([
                intakeOutputAPI.getHistory(admissionId).catch(() => ({ records: [] })),
                intakeOutputAPI.getSummary(admissionId).catch(() => ({ summary: null }))
            ]);
            setIoRecords(historyRes.records || historyRes.data || []);
            setIoSummary(summaryRes.summary || summaryRes.data || null);
        } catch (err) {
            console.error('Error fetching I/O:', err);
        } finally {
            setLoading(prev => ({ ...prev, io: false }));
        }
    }, [admissionId]);

    const fetchDevices = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, lines: true }));
            const [linesRes, cathsRes] = await Promise.all([
                ipdLineAPI.getLines(admissionId).catch(() => ({ lines: [] })),
                ipdCatheterAPI.getCatheters(admissionId).catch(() => ({ catheters: [] }))
            ]);
            setLines(linesRes.lines || linesRes.data || []);
            setCatheters(cathsRes.catheters || cathsRes.data || []);
        } catch (err) {
            console.error('Error fetching devices:', err);
        } finally {
            setLoading(prev => ({ ...prev, lines: false }));
        }
    }, [admissionId]);

    const fetchWoundCare = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, wound: true }));
            const res = await woundCareAPI.getHistory(admissionId);
            setWoundRecords(res.records || res.data || []);
        } catch (err) {
            console.error('Error fetching wound care:', err);
        } finally {
            setLoading(prev => ({ ...prev, wound: false }));
        }
    }, [admissionId]);

    const fetchInvestigations = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, investigations: true }));
            const res = await ipdNursingAPI.getInvestigations(admissionId);
            setInvestigations(res.investigations || res.data?.investigations || []);
        } catch (err) {
            console.error('Error fetching investigations:', err);
        } finally {
            setLoading(prev => ({ ...prev, investigations: false }));
        }
    }, [admissionId]);

    const fetchHandovers = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, handover: true }));
            const res = await nurseHandoverAPI.getHandovers(admissionId);
            setHandovers(res.handovers || res.data || []);
        } catch (err) {
            console.error('Error fetching handovers:', err);
        } finally {
            setLoading(prev => ({ ...prev, handover: false }));
        }
    }, [admissionId]);

    const fetchOTPlans = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, ot: true }));
            const res = await ipdNursingAPI.getOTPlans(admissionId);
            setOtPlans(res.surgeryPlans || res.data || []);
        } catch (err) {
            console.error('Error fetching OT plans:', err);
        } finally {
            setLoading(prev => ({ ...prev, ot: false }));
        }
    }, [admissionId]);

    const fetchTimeline = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, timeline: true }));
            const res = await ipdNursingAPI.getTimeline(admissionId);
            setTimelineItems(res.timeline || res.data || []);
        } catch (err) {
            console.error('Error fetching timeline:', err);
        } finally {
            setLoading(prev => ({ ...prev, timeline: false }));
        }
    }, [admissionId]);

    const fetchDischargeReadiness = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, discharge: true }));
            const res = await ipdNursingAPI.getDischargeReadiness(admissionId);
            setDischargeReadiness(res.readiness || res.data || null);
        } catch (err) {
            console.error('Error fetching discharge readiness:', err);
        } finally {
            setLoading(prev => ({ ...prev, discharge: false }));
        }
    }, [admissionId]);

    const fetchAlerts = useCallback(async () => {
        try {
            const res = await ipdNursingAPI.getAdmissionAlerts(admissionId);
            setAlerts(res.alerts || res.data || []);
        } catch (err) {
            console.error('Error fetching alerts:', err);
        }
    }, [admissionId]);

    const fetchHospitalNurses = useCallback(async () => {
        try {
            const res = await ipdNursingAPI.getHospitalNurses();
            setHospitalNurses(res.nurses || res.data || []);
        } catch (err) {
            console.error('Error fetching hospital nurses:', err);
        }
    }, []);

    const fetchAllData = useCallback(() => {
        fetchAdmission();
        fetchOrders();
        fetchVitals();
        fetchMAR();
        fetchNotes();
        fetchTasks();
        fetchIO();
        fetchDevices();
        fetchWoundCare();
        fetchInvestigations();
        fetchHandovers();
        fetchOTPlans();
        fetchTimeline();
        fetchDischargeReadiness();
        fetchAlerts();
        fetchHospitalNurses();
        fetchDischargeBlockers();
    }, [fetchAdmission, fetchOrders, fetchVitals, fetchMAR, fetchNotes, fetchTasks, fetchIO, fetchDevices, fetchWoundCare, fetchInvestigations, fetchHandovers, fetchOTPlans, fetchTimeline, fetchDischargeReadiness, fetchAlerts, fetchHospitalNurses, fetchDischargeBlockers]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Socket.io sync
    useEffect(() => {
        const handleRefresh = (data) => {
            if (data?.admissionId && String(data.admissionId) !== String(admissionId)) return;
            fetchAllData();
        };

        socket.on('admission_updated', handleRefresh);
        socket.on('nurse_assigned', handleRefresh);
        socket.on('vitals_recorded', handleRefresh);
        socket.on('mar_administered', handleRefresh);
        socket.on('nursing_note_created', handleRefresh);
        socket.on('nursing_task_created', handleRefresh);
        socket.on('intake_output_recorded', handleRefresh);
        socket.on('line_status_changed', handleRefresh);

        return () => {
            socket.off('admission_updated', handleRefresh);
            socket.off('nurse_assigned', handleRefresh);
            socket.off('vitals_recorded', handleRefresh);
            socket.off('mar_administered', handleRefresh);
            socket.off('nursing_note_created', handleRefresh);
            socket.off('nursing_task_created', handleRefresh);
            socket.off('intake_output_recorded', handleRefresh);
            socket.off('line_status_changed', handleRefresh);
        };
    }, [admissionId, fetchAllData]);

    // ── Patient Info Helpers ──
    const patient = admission?.patientId || {};
    const patientName = typeof patient === 'object' ? (patient.name || 'Unknown Patient') : 'Unknown Patient';
    const patientUid = typeof patient === 'object' ? (patient.patientId || patient.mrn || '—') : '—';
    const doctor = admission?.doctorId || {};
    const doctorName = typeof doctor === 'object' ? (doctor.name || 'Not Assigned') : 'Not Assigned';
    const activeLines = lines.filter(l => l.status === 'ACTIVE');
    const activeCatheters = catheters.filter(c => c.status === 'ACTIVE');
    const activeAssignments = (admission?.assignedNurses || []).filter(n => n.status === 'ACTIVE');
    const assignedNurseNames = activeAssignments.map(a => {
        if (typeof a.nurseId === 'object' && a.nurseId?.name) return `${a.nurseId.name} (${a.shift || 'Shift'})`;
        const found = hospitalNurses.find(hn => String(hn._id) === String(a.nurseId));
        return found ? `${found.name} (${a.shift || 'Shift'})` : 'Assigned Nurse';
    });

    // ── Action Handlers ──
    // 1. Record Vitals
    const handleRecordVitals = async () => {
        try {
            setSubmitting(true);
            const payload = {
                systolicBP: vitalsForm.systolicBP ? Number(vitalsForm.systolicBP) : undefined,
                diastolicBP: vitalsForm.diastolicBP ? Number(vitalsForm.diastolicBP) : undefined,
                pulse: vitalsForm.pulse ? Number(vitalsForm.pulse) : undefined,
                temperature: vitalsForm.temperature ? Number(vitalsForm.temperature) : undefined,
                spo2: vitalsForm.spo2 ? Number(vitalsForm.spo2) : undefined,
                respiratoryRate: vitalsForm.respiratoryRate ? Number(vitalsForm.respiratoryRate) : undefined,
                painScore: vitalsForm.painScore !== '' ? Number(vitalsForm.painScore) : undefined,
                notes: vitalsForm.notes.trim() || undefined,
            };
            await ipdClinicalAPI.recordVitals(admissionId, payload);
            setVitalsForm(VITALS_INIT);
            showToast('Vitals recorded successfully');
            fetchVitals();
            fetchTimeline();
            fetchAlerts();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error recording vitals', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // 2. Add Note
    const handleAddNote = async () => {
        if (!noteForm.note.trim()) {
            showToast('Note content is required', 'error');
            return;
        }
        try {
            setSubmitting(true);
            await nursingNoteAPI.createNote(admissionId, noteForm);
            setNoteForm(NOTE_INIT);
            showToast('Nursing note saved');
            fetchNotes();
            fetchTimeline();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error saving note', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // 3. Create Task
    const handleCreateTask = async () => {
        if (!taskForm.title.trim()) {
            showToast('Task title is required', 'error');
            return;
        }
        try {
            setSubmitting(true);
            await nursingTaskAPI.createTask({ ...taskForm, admissionId });
            setTaskForm(TASK_INIT);
            setNewTaskModalOpen(false);
            showToast('Clinical task scheduled');
            fetchTasks();
            fetchTimeline();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error creating task', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // 4. Update Task Status
    const handleUpdateTaskStatus = async () => {
        if (!taskModal.task) return;
        try {
            setSubmitting(true);
            await nursingTaskAPI.updateTask(taskModal.task._id, {
                status: taskModal.action,
                notes: taskModal.notes
            });
            setTaskModal({ open: false, task: null, action: '', notes: '' });
            showToast(`Task marked as ${taskModal.action}`);
            fetchTasks();
            fetchTimeline();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error updating task', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // 5. Record I/O
    const handleRecordIO = async () => {
        if (!ioForm.amount || Number(ioForm.amount) <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }
        try {
            setSubmitting(true);
            await intakeOutputAPI.recordIO(admissionId, {
                category: ioForm.category,
                type: ioForm.type,
                amount: Number(ioForm.amount),
                unit: ioForm.unit,
                source: ioForm.source.trim() || undefined,
                notes: ioForm.notes.trim() || undefined,
            });
            setIoForm(IO_INIT);
            showToast('Fluid intake/output recorded');
            fetchIO();
            fetchTimeline();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error recording I/O', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // 6. Insert Line
    const handleInsertLine = async () => {
        if (!lineForm.site.trim()) {
            showToast('Anatomical site is required', 'error');
            return;
        }
        try {
            setSubmitting(true);
            await ipdLineAPI.insertLine(admissionId, lineForm);
            setLineForm(LINE_INIT);
            setNewLineModalOpen(false);
            showToast('Line/Cannula insertion recorded');
            fetchDevices();
            fetchTimeline();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error inserting line', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // 7. Insert Catheter
    const handleInsertCatheter = async () => {
        try {
            setSubmitting(true);
            await ipdCatheterAPI.insertCatheter(admissionId, catheterForm);
            setCatheterForm(CATHETER_INIT);
            setNewCathModalOpen(false);
            showToast('Catheter insertion recorded');
            fetchDevices();
            fetchTimeline();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error inserting catheter', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // 8. Remove Device
    const handleRemoveDevice = async () => {
        const { type, id, reason, notes } = deviceRemoveModal;
        if (!id) return;
        try {
            setSubmitting(true);
            if (type === 'LINE') {
                await ipdLineAPI.removeLine(id, { removalReason: reason, notes });
                showToast('Line removed from patient record');
            } else {
                await ipdCatheterAPI.removeCatheter(id, { removalReason: reason, notes });
                showToast('Catheter removed from patient record');
            }
            setDeviceRemoveModal({ open: false, type: '', id: '', reason: '', notes: '' });
            fetchDevices();
            fetchTimeline();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error removing device', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // 9. Record Wound Care
    const handleRecordWound = async () => {
        if (!woundForm.woundSite.trim()) {
            showToast('Wound site is required', 'error');
            return;
        }
        try {
            setSubmitting(true);
            await woundCareAPI.recordCare(admissionId, woundForm);
            setWoundForm(WOUND_INIT);
            showToast('Wound dressing recorded');
            fetchWoundCare();
            fetchTimeline();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error saving wound care', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // 10. Submit Shift Handover
    const handleSaveHandover = async () => {
        if (!handoverForm.summary.trim()) {
            showToast('Handover clinical summary is required', 'error');
            return;
        }
        try {
            setSubmitting(true);
            await nurseHandoverAPI.createHandover(admissionId, handoverForm);
            setHandoverForm(HANDOVER_INIT);
            showToast('Shift handover recorded');
            fetchHandovers();
            fetchTimeline();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error saving handover', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // 11. MAR Actions
    const openMARModal = (record, initialAction = 'GIVE') => {
        const order = typeof record?.orderId === 'object' ? record.orderId : {};
        const prescribedVal = order?.dosageValue !== undefined
            ? String(order.dosageValue)
            : (record?.actualDoseValue ? String(record.actualDoseValue) : (record?.dosageValue ? String(record.dosageValue) : ''));
        const prescribedUnit = order?.dosageUnit || record?.actualDoseUnit || record?.dosageUnit || 'mg';

        setMarModal({
            open: true,
            record,
            action: initialAction,
            actualDoseValue: prescribedVal,
            actualDoseUnit: prescribedUnit,
            reason: '',
            notes: '',
            errorMsg: ''
        });
    };

    const handleMARAction = async () => {
        const { record, action, reason, actualDoseValue, actualDoseUnit, notes } = marModal;
        if (!record) return;

        const isMandatoryReason = ['HOLD', 'HELD', 'REFUSE', 'REFUSED', 'MISS', 'MISSED'].includes(action);
        if (isMandatoryReason && (!reason || !reason.trim())) {
            setMarModal(p => ({
                ...p,
                errorMsg: `A specific reason is mandatory for ${action.includes('HOLD') ? 'Holding' : action.includes('REFUSE') ? 'Refusal' : 'Missed'} medication.`
            }));
            return;
        }

        let finalStatus = 'ADMINISTERED';
        if (action === 'HOLD' || action === 'HELD') finalStatus = 'HELD';
        if (action === 'REFUSE' || action === 'REFUSED') finalStatus = 'REFUSED';
        if (action === 'MISS' || action === 'MISSED') finalStatus = 'MISSED';

        const order = typeof record.orderId === 'object' ? record.orderId : {};
        const payload = {
            status: finalStatus,
            actualDoseValue: finalStatus === 'ADMINISTERED'
                ? (actualDoseValue && actualDoseValue.trim() !== '' ? Number(actualDoseValue) : (order?.dosageValue !== undefined ? Number(order.dosageValue) : undefined))
                : undefined,
            actualDoseUnit: finalStatus === 'ADMINISTERED' ? (actualDoseUnit?.trim() || order?.dosageUnit || undefined) : undefined,
            notes: (notes || '').trim(),
            reason: (reason || '').trim(),
        };

        try {
            setSubmitting(true);
            await ipdClinicalAPI.updateMARRecord(record._id, payload);
            setMarModal({ open: false, record: null, action: 'GIVE', actualDoseValue: '', actualDoseUnit: 'mg', reason: '', notes: '', errorMsg: '' });
            showToast(`Medication record updated to ${finalStatus}`);
            fetchMAR();
            fetchTimeline();
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Error updating MAR';
            setMarModal(p => ({ ...p, errorMsg: msg }));
            showToast(msg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAdministerDirect = async (record) => {
        openMARModal(record, 'GIVE');
    };

    // 12. Acknowledge Order
    const handleAcknowledgeOrder = async (orderId) => {
        try {
            setSubmitting(true);
            await ipdClinicalAPI.acknowledgeOrder(admissionId, orderId, {
                shift: 'General',
                notes: 'Acknowledged by bedside nurse'
            });
            showToast('Order acknowledged by nursing station');
            fetchOrders();
            fetchTimeline();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to acknowledge order', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // 13. Submit Clarification
    const handleSubmitClarification = async () => {
        if (!clarificationModal.question.trim() || !clarificationModal.order) return;
        try {
            setSubmitting(true);
            await ipdClinicalAPI.requestClarification(admissionId, clarificationModal.order._id, {
                issueType: clarificationModal.issueType,
                question: clarificationModal.question.trim()
            });
            showToast('Clarification request sent to attending doctor');
            setClarificationModal({ open: false, order: null, issueType: 'DOSAGE_CONFIRMATION', question: '' });
            fetchOrders();
            fetchTimeline();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to submit clarification', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // 14. Assign Nurse
    const handleAssignNurseSubmit = async () => {
        if (!assignForm.nurseId) {
            showToast('Please select a nurse to assign', 'error');
            return;
        }
        try {
            setSubmitting(true);
            await ipdNursingAPI.assignNurse(admissionId, assignForm);
            setAssignModalOpen(false);
            setAssignForm({ nurseId: '', shift: 'Morning', notes: '' });
            showToast('Nurse assigned successfully');
            fetchAdmission();
            fetchTimeline();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error assigning nurse', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // 15. Sign-off Nursing Clearance
    const handleSignOffClearance = async () => {
        try {
            setSubmitting(true);
            const res = await ipdNursingAPI.signOffNursingClearance(admissionId, {
                nursingNotes: clearanceNotes
            });
            setClearanceModalOpen(false);
            setClearanceNotes('');
            showToast(res.message || 'Nursing clinical clearance signed off successfully');
            fetchAdmission();
            fetchDischargeReadiness();
            fetchTimeline();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error signing clearance', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // ── TAB RENDERERS ──
    // ─────────────────────────────────────────────────────────────

    // TAB 1: OVERVIEW
    const renderOverview = () => (
        <View style={styles.tabContentWrap}>
            {/* Clinical & Safety Alerts */}
            {alerts.length > 0 && (
                <View style={styles.alertBannerCard}>
                    <View style={styles.alertBannerHeader}>
                        <Feather name="alert-triangle" size={18} color="#dc2626" style={{ marginRight: 8 }} />
                        <Text style={styles.alertBannerTitle}>Active Clinical & Safety Alerts ({alerts.length})</Text>
                    </View>
                    {alerts.map((alt, idx) => (
                        <View key={idx} style={styles.alertItemBox}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={styles.alertItemTitle}>{alt.title}</Text>
                                <View style={styles.severityTag}>
                                    <Text style={styles.severityTagText}>{alt.severity}</Text>
                                </View>
                            </View>
                            <Text style={styles.alertItemDesc}>{alt.description}</Text>
                        </View>
                    ))}
                </View>
            )}

            <View style={styles.cardGrid}>
                {/* Patient Information Card */}
                <View style={styles.infoCard}>
                    <Text style={styles.cardTitle}>Patient Information</Text>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Name</Text><Text style={styles.fieldValue}>{patientName}</Text></View>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Patient ID / MRN</Text><Text style={styles.fieldValue}>{patientUid}</Text></View>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Age / Gender</Text><Text style={styles.fieldValue}>{patient.age ? `${patient.age} yrs` : '—'} • {patient.gender || '—'}</Text></View>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Blood Group</Text><Text style={styles.fieldValue}>{patient.bloodGroup || '—'}</Text></View>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Contact</Text><Text style={styles.fieldValue}>{patient.phone || '—'}</Text></View>
                </View>

                {/* Admission Details Card */}
                <View style={styles.infoCard}>
                    <Text style={styles.cardTitle}>Admission Details</Text>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Ward</Text><Text style={styles.fieldValue}>{admission?.ward || '—'}</Text></View>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Bed Number</Text><Text style={styles.fieldValue}>{admission?.bedNumber || '—'}</Text></View>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Attending Doctor</Text><Text style={styles.fieldValue}>{doctorName !== 'Not Assigned' ? `Dr. ${doctorName}` : '—'}</Text></View>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Admitted Date</Text><Text style={styles.fieldValue}>{admission?.admissionDate ? new Date(admission.admissionDate).toLocaleDateString('en-IN') : '—'}</Text></View>
                    <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Care Nurse</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.fieldValue}>{assignedNurseNames.length > 0 ? assignedNurseNames.join(', ') : 'Unassigned'}</Text>
                            <TouchableOpacity
                                onPress={() => setAssignModalOpen(true)}
                                style={{ marginLeft: 6, minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Text style={{ color: '#0d9488', fontWeight: '700', fontSize: 13 }}>+ Assign</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Status</Text><Text style={[styles.fieldValue, { color: '#0d9488', fontWeight: '800' }]}>{admission?.status || 'Admitted'}</Text></View>
                </View>
            </View>

            {/* Latest Vitals Snapshot Card */}
            <View style={[styles.infoCard, { marginTop: 16 }]}>
                <Text style={styles.cardTitle}>Latest Vitals Snapshot</Text>
                {latestVitals ? (
                    <View style={styles.vitalsMiniGrid}>
                        <View style={styles.vitalMiniCell}><Text style={styles.vitalMiniLbl}>BP</Text><Text style={styles.vitalMiniVal}>{latestVitals.systolicBP || '—'}/{latestVitals.diastolicBP || '—'}</Text><Text style={styles.vitalMiniUnit}>mmHg</Text></View>
                        <View style={styles.vitalMiniCell}><Text style={styles.vitalMiniLbl}>Pulse</Text><Text style={styles.vitalMiniVal}>{latestVitals.pulse || '—'}</Text><Text style={styles.vitalMiniUnit}>bpm</Text></View>
                        <View style={styles.vitalMiniCell}><Text style={styles.vitalMiniLbl}>Temp</Text><Text style={styles.vitalMiniVal}>{latestVitals.temperature || '—'}</Text><Text style={styles.vitalMiniUnit}>°F</Text></View>
                        <View style={styles.vitalMiniCell}><Text style={styles.vitalMiniLbl}>SpO₂</Text><Text style={styles.vitalMiniVal}>{latestVitals.spo2 || '—'}</Text><Text style={styles.vitalMiniUnit}>%</Text></View>
                        <View style={styles.vitalMiniCell}><Text style={styles.vitalMiniLbl}>Resp Rate</Text><Text style={styles.vitalMiniVal}>{latestVitals.respiratoryRate || '—'}</Text><Text style={styles.vitalMiniUnit}>/min</Text></View>
                        <View style={styles.vitalMiniCell}><Text style={styles.vitalMiniLbl}>Pain</Text><Text style={styles.vitalMiniVal}>{latestVitals.painScore !== undefined ? latestVitals.painScore : '—'}</Text><Text style={styles.vitalMiniUnit}>/10</Text></View>
                    </View>
                ) : (
                    <Text style={styles.emptyInlineText}>No inpatient vitals recorded yet. Tap Vitals tab to record.</Text>
                )}
            </View>

            {/* Quick Actions Bar */}
            <View style={styles.quickActionsWrap}>
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => setActiveTab('vitals')}>
                    <Feather name="activity" size={16} color="#0d9488" />
                    <Text style={styles.quickActionText}>Record Vitals</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => setActiveTab('mar')}>
                    <Feather name="droplet" size={16} color="#0d9488" />
                    <Text style={styles.quickActionText}>Give Meds</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => setActiveTab('notes')}>
                    <Feather name="file-text" size={16} color="#0d9488" />
                    <Text style={styles.quickActionText}>Nursing Note</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickActionBtn} onPress={() => setActiveTab('io')}>
                    <Feather name="droplet" size={16} color="#0d9488" />
                    <Text style={styles.quickActionText}>Log I/O</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // TAB 2: DOCTOR ORDERS
    const filteredOrders = useMemo(() => {
        if (orderFilter === 'ALL') return orders;
        return orders.filter(o => (o.category || o.orderType || '').toUpperCase() === orderFilter);
    }, [orders, orderFilter]);

    const renderOrders = () => (
        <View style={styles.tabContentWrap}>
            <View style={styles.filterBarRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsScroll}>
                    {['ALL', 'MEDICATION', 'LAB', 'NURSING', 'DIET', 'VITALS'].map(f => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterChip, orderFilter === f && styles.filterChipActive]}
                            onPress={() => setOrderFilter(f)}
                        >
                            <Text style={[styles.filterChipText, orderFilter === f && styles.filterChipTextActive]}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {filteredOrders.length === 0 ? (
                <View style={styles.emptyCard}><Text style={styles.emptyText}>No clinical orders found for this filter.</Text></View>
            ) : (
                filteredOrders.map((ord, idx) => (
                    <View key={ord._id || idx} style={styles.itemCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemCardTitle}>{ord.medicineName || ord.orderTitle || ord.category || 'Clinical Order'}</Text>
                                <Text style={styles.itemCardSub}>
                                    {ord.dosageValue ? `${ord.dosageValue} ${ord.dosageUnit || ''} • ` : ''}
                                    {ord.route ? `${ord.route} • ` : ''}
                                    {ord.frequency || 'As Prescribed'}
                                </Text>
                                {ord.instructions ? <Text style={styles.itemCardNotes}>Note: {ord.instructions}</Text> : null}
                            </View>
                            <View style={styles.orderStatusTag}>
                                <Text style={styles.orderStatusText}>{ord.status || 'ACTIVE'}</Text>
                            </View>
                        </View>
                        <View style={styles.itemCardActions}>
                            <TouchableOpacity
                                style={styles.btnSmSuccess}
                                onPress={() => handleAcknowledgeOrder(ord._id)}
                            >
                                <Feather name="check" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                                <Text style={styles.btnSmSuccessText}>Acknowledge</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.btnSmOutline}
                                onPress={() => setClarificationModal({ open: true, order: ord, issueType: 'DOSAGE_CONFIRMATION', question: '' })}
                            >
                                <Feather name="help-circle" size={13} color="#64748b" style={{ marginRight: 4 }} />
                                <Text style={styles.btnSmOutlineText}>Clarify</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))
            )}
        </View>
    );

    // TAB 3: VITALS
    const renderVitals = () => (
        <View style={styles.tabContentWrap}>
            {/* Record Vitals Box */}
            <View style={styles.formCard}>
                <Text style={styles.cardTitle}>Record Inpatient Vitals</Text>
                <View style={styles.formGrid}>
                    <View style={styles.formCol}><Text style={styles.inputLabel}>Systolic BP</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="120" value={vitalsForm.systolicBP} onChangeText={t => setVitalsForm(p => ({ ...p, systolicBP: t }))} /></View>
                    <View style={styles.formCol}><Text style={styles.inputLabel}>Diastolic BP</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="80" value={vitalsForm.diastolicBP} onChangeText={t => setVitalsForm(p => ({ ...p, diastolicBP: t }))} /></View>
                    <View style={styles.formCol}><Text style={styles.inputLabel}>Pulse (bpm)</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="72" value={vitalsForm.pulse} onChangeText={t => setVitalsForm(p => ({ ...p, pulse: t }))} /></View>
                    <View style={styles.formCol}><Text style={styles.inputLabel}>Temp (°F)</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="98.6" value={vitalsForm.temperature} onChangeText={t => setVitalsForm(p => ({ ...p, temperature: t }))} /></View>
                    <View style={styles.formCol}><Text style={styles.inputLabel}>SpO₂ (%)</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="98" value={vitalsForm.spo2} onChangeText={t => setVitalsForm(p => ({ ...p, spo2: t }))} /></View>
                    <View style={styles.formCol}><Text style={styles.inputLabel}>Resp Rate (/min)</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="16" value={vitalsForm.respiratoryRate} onChangeText={t => setVitalsForm(p => ({ ...p, respiratoryRate: t }))} /></View>
                    <View style={styles.formCol}><Text style={styles.inputLabel}>Pain (0-10)</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="0" value={vitalsForm.painScore} onChangeText={t => setVitalsForm(p => ({ ...p, painScore: t }))} /></View>
                    <View style={[styles.formCol, { flexBasis: '100%' }]}><Text style={styles.inputLabel}>Clinical Notes</Text><TextInput style={[styles.input, { height: 60 }]} multiline placeholder="Patient state, posture, respiratory effort..." value={vitalsForm.notes} onChangeText={t => setVitalsForm(p => ({ ...p, notes: t }))} /></View>
                </View>
                <TouchableOpacity style={styles.btnPrimary} onPress={handleRecordVitals} disabled={submitting}>
                    {submitting ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.btnPrimaryText}>Save Vitals</Text>}
                </TouchableOpacity>
            </View>

            {/* Vitals History */}
            <View style={[styles.infoCard, { marginTop: 18 }]}>
                <Text style={styles.cardTitle}>Vitals History ({vitalsHistory.length})</Text>
                {vitalsHistory.length === 0 ? (
                    <Text style={styles.emptyInlineText}>No recorded vitals in this admission.</Text>
                ) : (
                    vitalsHistory.map((v, i) => (
                        <View key={v._id || i} style={styles.historyRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.historyTime}>{new Date(v.createdAt || v.recordedAt).toLocaleString('en-IN')}</Text>
                                <Text style={styles.historyStats}>BP: {v.systolicBP}/{v.diastolicBP} • Pulse: {v.pulse} bpm • Temp: {v.temperature}°F • SpO₂: {v.spo2}% • RR: {v.respiratoryRate}/min</Text>
                                {v.notes ? <Text style={styles.historyNotes}>Note: {v.notes}</Text> : null}
                            </View>
                        </View>
                    ))
                )}
            </View>
        </View>
    );

    // TAB 4: MAR (MEDICATION ADMINISTRATION RECORD)
    const filteredMAR = useMemo(() => {
        if (marFilter === 'ALL') return marRecords;
        return marRecords.filter(m => (m.status || '').toUpperCase() === marFilter);
    }, [marRecords, marFilter]);

    const renderMAR = () => (
        <View style={styles.tabContentWrap}>
            <View style={styles.filterBarRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsScroll}>
                    {['ALL', 'DUE', 'ADMINISTERED', 'HELD', 'REFUSED', 'MISSED'].map(f => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterChip, marFilter === f && styles.filterChipActive]}
                            onPress={() => setMarFilter(f)}
                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                        >
                            <Text style={[styles.filterChipText, marFilter === f && styles.filterChipTextActive]}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {filteredMAR.length === 0 ? (
                <View style={styles.emptyCard}><Text style={styles.emptyText}>No MAR records match this status.</Text></View>
            ) : (
                filteredMAR.map((rec, i) => {
                    const order = typeof rec.orderId === 'object' ? rec.orderId : {};
                    const medName = order?.medicineName || rec.medicineName || 'Scheduled Med';
                    const doseDisplay = rec.actualDoseValue
                        ? `${rec.actualDoseValue} ${rec.actualDoseUnit || ''}`.trim()
                        : (order?.dosageValue ? `${order.dosageValue} ${order.dosageUnit || ''}`.trim() : (rec.dosage || 'Standard'));
                    const routeDisplay = rec.route || order?.route || 'Oral';
                    const timeDisplay = rec.scheduledTime ? new Date(rec.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today';

                    return (
                        <View key={rec._id || i} style={styles.itemCard}>
                            <View style={styles.itemCardHeaderRow}>
                                <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                                    <Text style={styles.itemCardTitle}>{medName}</Text>
                                    <Text style={styles.itemCardSub}>
                                        Dose: {doseDisplay} • Route: {routeDisplay} • Scheduled: {timeDisplay}
                                    </Text>
                                    {rec.notes ? <Text style={styles.itemCardNotes}>Notes: {rec.notes}</Text> : null}
                                    {rec.reason ? <Text style={styles.itemCardNotes}>Reason: {rec.reason}</Text> : null}
                                </View>
                                <View style={[styles.statusPill, {
                                    backgroundColor: rec.status === 'ADMINISTERED'
                                        ? '#dcfce7'
                                        : rec.status === 'HELD'
                                        ? '#fef3c7'
                                        : rec.status === 'REFUSED'
                                        ? '#fee2e2'
                                        : rec.status === 'MISSED'
                                        ? '#f1f5f9'
                                        : '#e0f2fe'
                                }]}>
                                    <Text style={[styles.statusPillText, {
                                        color: rec.status === 'ADMINISTERED'
                                            ? '#15803d'
                                            : rec.status === 'HELD'
                                            ? '#b45309'
                                            : rec.status === 'REFUSED'
                                            ? '#b91c1c'
                                            : rec.status === 'MISSED'
                                            ? '#475569'
                                            : '#0369a1'
                                    }]}>{rec.status || 'DUE'}</Text>
                                </View>
                            </View>
                            {rec.status !== 'ADMINISTERED' && (
                                <View style={styles.marActionsGrid}>
                                    <TouchableOpacity
                                        style={[styles.marActionBtn, styles.btnSmSuccess]}
                                        onPress={() => openMARModal(rec, 'GIVE')}
                                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                                        activeOpacity={0.8}
                                    >
                                        <Feather name="check" size={13} color="#ffffff" style={{ marginRight: 5 }} />
                                        <Text style={styles.marActionBtnText}>Administer</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.marActionBtn, styles.btnSmWarning]}
                                        onPress={() => openMARModal(rec, 'HOLD')}
                                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                                        activeOpacity={0.8}
                                    >
                                        <Feather name="pause" size={13} color="#ffffff" style={{ marginRight: 5 }} />
                                        <Text style={styles.marActionBtnText}>Hold</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.marActionBtn, styles.btnSmDanger]}
                                        onPress={() => openMARModal(rec, 'REFUSE')}
                                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                                        activeOpacity={0.8}
                                    >
                                        <Feather name="x" size={13} color="#ffffff" style={{ marginRight: 5 }} />
                                        <Text style={styles.marActionBtnText}>Refuse</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.marActionBtn, styles.btnSmMissed]}
                                        onPress={() => openMARModal(rec, 'MISS')}
                                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                                        activeOpacity={0.8}
                                    >
                                        <Feather name="alert-triangle" size={13} color="#ffffff" style={{ marginRight: 5 }} />
                                        <Text style={styles.marActionBtnText}>Missed</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                })
            )}
        </View>
    );

    // TAB 5: NURSING NOTES
    const renderNotes = () => (
        <View style={styles.tabContentWrap}>
            <View style={styles.formCard}>
                <Text style={styles.cardTitle}>Add Clinical Nursing Note</Text>
                <TextInput
                    style={[styles.input, { height: 80, marginTop: 10 }]}
                    multiline
                    placeholder="Document patient progress, behavioral state, physical observations..."
                    value={noteForm.note}
                    onChangeText={t => setNoteForm(p => ({ ...p, note: t }))}
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Shift</Text>
                        <TextInput style={styles.input} value={noteForm.shift} onChangeText={t => setNoteForm(p => ({ ...p, shift: t }))} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Type</Text>
                        <TextInput style={styles.input} value={noteForm.noteType} onChangeText={t => setNoteForm(p => ({ ...p, noteType: t }))} />
                    </View>
                </View>
                <TouchableOpacity style={[styles.btnPrimary, { marginTop: 12 }]} onPress={handleAddNote} disabled={submitting}>
                    <Text style={styles.btnPrimaryText}>Add Nursing Note</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.infoCard, { marginTop: 18 }]}>
                <Text style={styles.cardTitle}>Progress Notes ({notes.length})</Text>
                {notes.length === 0 ? (
                    <Text style={styles.emptyInlineText}>No progress notes documented yet.</Text>
                ) : (
                    notes.map((n, i) => (
                        <View key={n._id || i} style={styles.noteCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={styles.noteMeta}>{n.shift || 'Shift'} • {new Date(n.createdAt).toLocaleString('en-IN')}</Text>
                                <View style={styles.badgeSm}><Text style={styles.badgeSmText}>{n.noteType || 'GENERAL'}</Text></View>
                            </View>
                            <Text style={styles.noteBody}>{n.note}</Text>
                            <Text style={styles.noteNurse}>Recorded by: {n.recordedBy?.name || 'Staff Nurse'}</Text>
                        </View>
                    ))
                )}
            </View>
        </View>
    );

    // TAB 6: TASKS
    const filteredTasks = useMemo(() => {
        if (taskFilter === 'ALL') return tasks;
        return tasks.filter(t => (t.status || '').toUpperCase() === taskFilter);
    }, [tasks, taskFilter]);

    const renderTasks = () => (
        <View style={styles.tabContentWrap}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.cardTitle}>Scheduled Tasks ({filteredTasks.length})</Text>
                <TouchableOpacity style={styles.btnSmPrimary} onPress={() => setNewTaskModalOpen(true)}>
                    <Feather name="plus" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={styles.btnSmPrimaryText}>Schedule Task</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.filterBarRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsScroll}>
                    {['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'].map(f => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterChip, taskFilter === f && styles.filterChipActive]}
                            onPress={() => setTaskFilter(f)}
                        >
                            <Text style={[styles.filterChipText, taskFilter === f && styles.filterChipTextActive]}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {filteredTasks.length === 0 ? (
                <View style={styles.emptyCard}><Text style={styles.emptyText}>No clinical tasks found.</Text></View>
            ) : (
                filteredTasks.map((t, i) => (
                    <View key={t._id || i} style={styles.itemCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemCardTitle}>{t.title}</Text>
                                {t.description ? <Text style={styles.itemCardSub}>{t.description}</Text> : null}
                                <Text style={styles.itemCardNotes}>Priority: {t.priority} • Scheduled: {t.scheduledAt ? new Date(t.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Shift'}</Text>
                            </View>
                            <View style={styles.statusPill}><Text style={styles.statusPillText}>{t.status || 'PENDING'}</Text></View>
                        </View>
                        {t.status !== 'COMPLETED' && (
                            <View style={styles.itemCardActions}>
                                <TouchableOpacity style={styles.btnSmSuccess} onPress={() => setTaskModal({ open: true, task: t, action: 'COMPLETED', notes: '' })}>
                                    <Feather name="check" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                                    <Text style={styles.btnSmSuccessText}>Complete</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.btnSmOutline} onPress={() => setTaskModal({ open: true, task: t, action: 'SKIPPED', notes: '' })}>
                                    <Feather name="skip-forward" size={13} color="#64748b" style={{ marginRight: 4 }} />
                                    <Text style={styles.btnSmOutlineText}>Skip</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                ))
            )}
        </View>
    );

    // TAB 7: INTAKE / OUTPUT
    const renderIO = () => (
        <View style={styles.tabContentWrap}>
            {/* 24-hr Summary */}
            <View style={styles.kpiRow}>
                <View style={styles.kpiMiniCard}>
                    <Text style={styles.kpiMiniVal}>{ioSummary?.totalIntake || 0} ml</Text>
                    <Text style={styles.kpiMiniLbl}>Total Intake</Text>
                </View>
                <View style={styles.kpiMiniCard}>
                    <Text style={styles.kpiMiniVal}>{ioSummary?.totalOutput || 0} ml</Text>
                    <Text style={styles.kpiMiniLbl}>Total Output</Text>
                </View>
                <View style={styles.kpiMiniCard}>
                    <Text style={[styles.kpiMiniVal, { color: (ioSummary?.balance || 0) >= 0 ? '#10b981' : '#ef4444' }]}>{ioSummary?.balance || 0} ml</Text>
                    <Text style={styles.kpiMiniLbl}>Fluid Balance</Text>
                </View>
            </View>

            {/* Record I/O */}
            <View style={[styles.formCard, { marginTop: 16 }]}>
                <Text style={styles.cardTitle}>Record Fluid Intake / Output</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginVertical: 10 }}>
                    <TouchableOpacity style={[styles.toggleBtn, ioForm.category === 'INTAKE' && styles.toggleBtnActive]} onPress={() => setIoForm(p => ({ ...p, category: 'INTAKE' }))}>
                        <Text style={[styles.toggleBtnText, ioForm.category === 'INTAKE' && styles.toggleBtnTextActive]}>Intake</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.toggleBtn, ioForm.category === 'OUTPUT' && styles.toggleBtnActive]} onPress={() => setIoForm(p => ({ ...p, category: 'OUTPUT' }))}>
                        <Text style={[styles.toggleBtnText, ioForm.category === 'OUTPUT' && styles.toggleBtnTextActive]}>Output</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.formGrid}>
                    <View style={styles.formCol}><Text style={styles.inputLabel}>Type (e.g. Oral, IV, Urine)</Text><TextInput style={styles.input} value={ioForm.type} onChangeText={t => setIoForm(p => ({ ...p, type: t }))} /></View>
                    <View style={styles.formCol}><Text style={styles.inputLabel}>Amount (ml)</Text><TextInput style={styles.input} keyboardType="numeric" placeholder="250" value={ioForm.amount} onChangeText={t => setIoForm(p => ({ ...p, amount: t }))} /></View>
                    <View style={[styles.formCol, { flexBasis: '100%' }]}><Text style={styles.inputLabel}>Source / Notes</Text><TextInput style={styles.input} placeholder="Normal Saline, Water, Drain..." value={ioForm.notes} onChangeText={t => setIoForm(p => ({ ...p, notes: t }))} /></View>
                </View>
                <TouchableOpacity style={[styles.btnPrimary, { marginTop: 12 }]} onPress={handleRecordIO} disabled={submitting}>
                    <Text style={styles.btnPrimaryText}>Record I/O</Text>
                </TouchableOpacity>
            </View>

            {/* Records List */}
            <View style={[styles.infoCard, { marginTop: 18 }]}>
                <Text style={styles.cardTitle}>I/O History ({ioRecords.length})</Text>
                {ioRecords.length === 0 ? (
                    <Text style={styles.emptyInlineText}>No fluid balance records logged.</Text>
                ) : (
                    ioRecords.map((r, i) => (
                        <View key={r._id || i} style={styles.historyRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.historyTime}>{new Date(r.createdAt || r.recordedAt).toLocaleString('en-IN')}</Text>
                                <Text style={styles.historyStats}>{r.category}: {r.type} • {r.amount} {r.unit || 'ml'}</Text>
                                {r.notes ? <Text style={styles.historyNotes}>Note: {r.notes}</Text> : null}
                            </View>
                        </View>
                    ))
                )}
            </View>
        </View>
    );

    // TAB 8: LINES & DEVICES
    const renderLines = () => (
        <View style={styles.tabContentWrap}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <TouchableOpacity style={styles.btnSmPrimary} onPress={() => setNewLineModalOpen(true)}>
                    <Feather name="plus" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={styles.btnSmPrimaryText}>+ Insert Line</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSmPrimary} onPress={() => setNewCathModalOpen(true)}>
                    <Feather name="plus" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={styles.btnSmPrimaryText}>+ Insert Catheter</Text>
                </TouchableOpacity>
            </View>

            {/* Active Lines */}
            <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Vascular Access Lines ({activeLines.length})</Text>
                {activeLines.length === 0 ? (
                    <Text style={styles.emptyInlineText}>No active lines or cannulas.</Text>
                ) : (
                    activeLines.map((l, i) => (
                        <View key={l._id || i} style={styles.itemCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemCardTitle}>{l.lineType} ({l.gauge})</Text>
                                    <Text style={styles.itemCardSub}>Site: {l.site} • Inserted: {l.insertedAt ? new Date(l.insertedAt).toLocaleDateString('en-IN') : 'Today'}</Text>
                                </View>
                                <TouchableOpacity style={styles.btnSmDanger} onPress={() => setDeviceRemoveModal({ open: true, type: 'LINE', id: l._id, reason: '', notes: '' })}>
                                    <Text style={styles.btnSmDangerText}>Remove</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </View>

            {/* Active Catheters */}
            <View style={[styles.infoCard, { marginTop: 18 }]}>
                <Text style={styles.cardTitle}>Urinary & Drainage Catheters ({activeCatheters.length})</Text>
                {activeCatheters.length === 0 ? (
                    <Text style={styles.emptyInlineText}>No active catheters recorded.</Text>
                ) : (
                    activeCatheters.map((c, i) => (
                        <View key={c._id || i} style={styles.itemCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemCardTitle}>{c.catheterType} ({c.size})</Text>
                                    <Text style={styles.itemCardSub}>Site: {c.site} • Inserted: {c.insertedAt ? new Date(c.insertedAt).toLocaleDateString('en-IN') : 'Today'}</Text>
                                </View>
                                <TouchableOpacity style={styles.btnSmDanger} onPress={() => setDeviceRemoveModal({ open: true, type: 'CATHETER', id: c._id, reason: '', notes: '' })}>
                                    <Text style={styles.btnSmDangerText}>Remove</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </View>
        </View>
    );

    // TAB 9: WOUND CARE
    const renderWoundCare = () => (
        <View style={styles.tabContentWrap}>
            <View style={styles.formCard}>
                <Text style={styles.cardTitle}>Record Wound Care & Dressing Change</Text>
                <View style={styles.formGrid}>
                    <View style={styles.formCol}><Text style={styles.inputLabel}>Wound Site *</Text><TextInput style={styles.input} placeholder="e.g. Abdomen, Right Knee" value={woundForm.woundSite} onChangeText={t => setWoundForm(p => ({ ...p, woundSite: t }))} /></View>
                    <View style={styles.formCol}><Text style={styles.inputLabel}>Type (Surgical, Trauma...)</Text><TextInput style={styles.input} value={woundForm.woundType} onChangeText={t => setWoundForm(p => ({ ...p, woundType: t }))} /></View>
                    <View style={styles.formCol}><Text style={styles.inputLabel}>Condition (Clean, Slough...)</Text><TextInput style={styles.input} value={woundForm.condition} onChangeText={t => setWoundForm(p => ({ ...p, condition: t }))} /></View>
                    <View style={styles.formCol}><Text style={styles.inputLabel}>Dressing Type</Text><TextInput style={styles.input} value={woundForm.dressingType} onChangeText={t => setWoundForm(p => ({ ...p, dressingType: t }))} /></View>
                    <View style={styles.formCol}><Text style={styles.inputLabel}>Drainage Amount</Text><TextInput style={styles.input} value={woundForm.drainageAmount} onChangeText={t => setWoundForm(p => ({ ...p, drainageAmount: t }))} /></View>
                    <View style={[styles.formCol, { flexBasis: '100%' }]}><Text style={styles.inputLabel}>Observations / Notes</Text><TextInput style={styles.input} placeholder="Wound edges approximated, no foul odor..." value={woundForm.notes} onChangeText={t => setWoundForm(p => ({ ...p, notes: t }))} /></View>
                </View>
                <TouchableOpacity style={[styles.btnPrimary, { marginTop: 12 }]} onPress={handleRecordWound} disabled={submitting}>
                    <Text style={styles.btnPrimaryText}>Record Dressing Change</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.infoCard, { marginTop: 18 }]}>
                <Text style={styles.cardTitle}>Dressing History ({woundRecords.length})</Text>
                {woundRecords.length === 0 ? (
                    <Text style={styles.emptyInlineText}>No wound care logs recorded.</Text>
                ) : (
                    woundRecords.map((w, i) => (
                        <View key={w._id || i} style={styles.historyRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.historyTime}>{new Date(w.createdAt).toLocaleString('en-IN')}</Text>
                                <Text style={styles.historyStats}>{w.woundSite} ({w.woundType}): {w.condition} • {w.dressingType} • Drainage: {w.drainageAmount}</Text>
                                {w.notes ? <Text style={styles.historyNotes}>Note: {w.notes}</Text> : null}
                            </View>
                        </View>
                    ))
                )}
            </View>
        </View>
    );

    // TAB 10: INVESTIGATIONS
    const renderInvestigations = () => (
        <View style={styles.tabContentWrap}>
            <Text style={styles.cardTitle}>Inpatient Diagnostic Investigations ({investigations.length})</Text>
            {investigations.length === 0 ? (
                <View style={[styles.emptyCard, { marginTop: 12 }]}><Text style={styles.emptyText}>No diagnostic investigations ordered for this admission.</Text></View>
            ) : (
                investigations.map((inv, i) => (
                    <View key={inv._id || i} style={styles.itemCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemCardTitle}>{inv.testName || inv.name || 'Diagnostic Investigation'}</Text>
                                <Text style={styles.itemCardSub}>Category: {inv.category || 'Clinical Lab'} • Ordered: {inv.orderedDate ? new Date(inv.orderedDate).toLocaleDateString('en-IN') : 'Inpatient'}</Text>
                                {inv.resultNotes ? <Text style={styles.itemCardNotes}>Results: {inv.resultNotes}</Text> : null}
                            </View>
                            <View style={styles.statusPill}><Text style={styles.statusPillText}>{inv.status || 'ORDERED'}</Text></View>
                        </View>
                    </View>
                ))
            )}
        </View>
    );

    // TAB 11: HANDOVER
    const renderHandover = () => (
        <View style={styles.tabContentWrap}>
            <View style={styles.formCard}>
                <Text style={styles.cardTitle}>Submit Shift Handover</Text>
                <View style={{ marginTop: 10 }}>
                    <Text style={styles.inputLabel}>Shift Transition</Text>
                    <TextInput style={styles.input} value={handoverForm.shift} onChangeText={t => setHandoverForm(p => ({ ...p, shift: t }))} />
                </View>
                <View style={{ marginTop: 10 }}>
                    <Text style={styles.inputLabel}>Clinical Summary *</Text>
                    <TextInput style={[styles.input, { height: 60 }]} multiline placeholder="Overall patient condition, changes in condition..." value={handoverForm.summary} onChangeText={t => setHandoverForm(p => ({ ...p, summary: t }))} />
                </View>
                <View style={{ marginTop: 10 }}>
                    <Text style={styles.inputLabel}>Important Observations</Text>
                    <TextInput style={styles.input} placeholder="Vitals spikes, wound status, fever..." value={handoverForm.importantObservations} onChangeText={t => setHandoverForm(p => ({ ...p, importantObservations: t }))} />
                </View>
                <View style={{ marginTop: 10 }}>
                    <Text style={styles.inputLabel}>Pending Tasks</Text>
                    <TextInput style={styles.input} placeholder="Pending lab draw, dressing change..." value={handoverForm.pendingTasks} onChangeText={t => setHandoverForm(p => ({ ...p, pendingTasks: t }))} />
                </View>
                <TouchableOpacity style={[styles.btnPrimary, { marginTop: 12 }]} onPress={handleSaveHandover} disabled={submitting}>
                    <Text style={styles.btnPrimaryText}>Submit Shift Handover</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.infoCard, { marginTop: 18 }]}>
                <Text style={styles.cardTitle}>Previous Handovers ({handovers.length})</Text>
                {handovers.length === 0 ? (
                    <Text style={styles.emptyInlineText}>No recorded shift handovers.</Text>
                ) : (
                    handovers.map((h, i) => (
                        <View key={h._id || i} style={styles.noteCard}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={styles.noteMeta}>{h.shift} • {new Date(h.createdAt).toLocaleString('en-IN')}</Text>
                                <Text style={styles.noteNurse}>{h.handoverBy?.name || 'Staff Nurse'}</Text>
                            </View>
                            <Text style={styles.noteBody}>{h.summary}</Text>
                            {h.pendingTasks ? <Text style={styles.itemCardNotes}>Pending: {h.pendingTasks}</Text> : null}
                        </View>
                    ))
                )}
            </View>
        </View>
    );

    // TAB 12: OT & POST-OP
    const renderOT = () => (
        <View style={styles.tabContentWrap}>
            <Text style={styles.cardTitle}>Surgical & OT Plans ({otPlans.length})</Text>
            {otPlans.length === 0 ? (
                <View style={[styles.emptyCard, { marginTop: 12 }]}><Text style={styles.emptyText}>No planned surgical procedures found for this admission.</Text></View>
            ) : (
                otPlans.map((ot, i) => (
                    <View key={ot._id || i} style={styles.itemCard}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.itemCardTitle}>{ot.procedureName || ot.surgeryName || 'Operative Procedure'}</Text>
                                <Text style={styles.itemCardSub}>Surgeon: Dr. {ot.surgeonId?.name || 'Assigned Surgeon'} • OT: {ot.otRoom || 'Main OT'}</Text>
                                <Text style={styles.itemCardNotes}>Scheduled: {ot.surgeryDate ? new Date(ot.surgeryDate).toLocaleString('en-IN') : 'Scheduled'}</Text>
                                {ot.postOpInstructions ? <Text style={[styles.itemCardNotes, { color: '#0d9488' }]}>Post-Op Care: {ot.postOpInstructions}</Text> : null}
                            </View>
                            <View style={styles.statusPill}><Text style={styles.statusPillText}>{ot.status || 'PLANNED'}</Text></View>
                        </View>
                    </View>
                ))
            )}
        </View>
    );

    // TAB 13: DISCHARGE READINESS
    const renderDischargeReadiness = () => {
        const isDischargeOrdered = !!dischargeReadiness?.doctorDischargeOrdered;
        const isNursingCleared = !!dischargeReadiness?.nursingClearance;

        return (
            <View style={styles.tabContentWrap}>
                <View style={[styles.infoCard, { backgroundColor: isDischargeOrdered && isNursingCleared ? '#f0fdf4' : '#fffbeb' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.cardTitle, { color: isDischargeOrdered && isNursingCleared ? '#15803d' : '#b45309' }]}>
                                {isDischargeOrdered && isNursingCleared ? '✓ Ready for Clinical Discharge' : '⚠️ Pending Discharge Clearances'}
                            </Text>
                            <Text style={styles.fieldLabel}>
                                Doctor Order: {isDischargeOrdered ? '✓ Ordered' : '✗ Pending'} • Nursing Clearance: {isNursingCleared ? '✓ Cleared' : '✗ Required'}
                            </Text>
                        </View>
                        {!isNursingCleared && (
                            <TouchableOpacity style={styles.btnSmPrimary} onPress={() => setClearanceModalOpen(true)}>
                                <Text style={styles.btnSmPrimaryText}>Sign Off Clearance</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Discharge Blockers Engine Checklist */}
                <View style={[styles.infoCard, { marginTop: 18 }]}>
                    <Text style={styles.cardTitle}>Discharge Blockers & Readiness Engine</Text>
                    {blockersData?.blockers && blockersData.blockers.length > 0 ? (
                        blockersData.blockers.map((b, i) => (
                            <View key={i} style={styles.historyRow}>
                                <Feather name="alert-circle" size={16} color="#dc2626" style={{ marginRight: 8 }} />
                                <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>{b.message || b.title || b}</Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyInlineText}>No active clinical discharge blockers detected.</Text>
                    )}
                </View>
            </View>
        );
    };

    // TAB 14: TIMELINE
    const renderTimeline = () => (
        <View style={styles.tabContentWrap}>
            <Text style={styles.cardTitle}>Unified Clinical Timeline ({timelineItems.length})</Text>
            {timelineItems.length === 0 ? (
                <View style={[styles.emptyCard, { marginTop: 12 }]}><Text style={styles.emptyText}>No clinical timeline events recorded.</Text></View>
            ) : (
                timelineItems.map((tm, i) => (
                    <View key={tm._id || i} style={styles.historyRow}>
                        <View style={styles.timelineDot} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.historyTime}>{new Date(tm.timestamp || tm.createdAt).toLocaleString('en-IN')}</Text>
                            <Text style={styles.itemCardTitle}>{tm.title || tm.eventType}</Text>
                            <Text style={styles.itemCardSub}>{tm.description}</Text>
                            {tm.performedBy ? <Text style={styles.historyNotes}>By: {tm.performedBy.name || tm.performedBy}</Text> : null}
                        </View>
                    </View>
                ))
            )}
        </View>
    );

    // ── Tab Router ──
    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview': return renderOverview();
            case 'orders': return renderOrders();
            case 'vitals': return renderVitals();
            case 'mar': return renderMAR();
            case 'notes': return renderNotes();
            case 'tasks': return renderTasks();
            case 'io': return renderIO();
            case 'lines': return renderLines();
            case 'wound': return renderWoundCare();
            case 'investigations': return renderInvestigations();
            case 'handover': return renderHandover();
            case 'ot': return renderOT();
            case 'discharge': return renderDischargeReadiness();
            case 'timeline': return renderTimeline();
            default: return null;
        }
    };

    if (loading.admission && !admission) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0d9488" />
                <Text style={styles.loadingText}>Loading inpatient workspace...</Text>
            </View>
        );
    }

    if (!admission && !loading.admission) {
        return (
            <View style={styles.loadingContainer}>
                <Feather name="alert-circle" size={48} color="#94a3b8" />
                <Text style={styles.errorTitle}>Admission Not Found</Text>
                <Text style={styles.errorSubtitle}>This admission may have been discharged or does not exist.</Text>
                <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.goBack()}>
                    <Text style={styles.btnPrimaryText}>Return to Command Center</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Toast feedback */}
            {toast && (
                <View style={[styles.toastBox, toast.type === 'error' ? styles.toastError : styles.toastSuccess]}>
                    <Feather name={toast.type === 'error' ? 'alert-circle' : 'check-circle'} size={16} color="#ffffff" />
                    <Text style={styles.toastText}>{toast.message}</Text>
                </View>
            )}

            {/* Top Bar Banner */}
            <LinearGradient
                colors={['#0f766e', '#0d9488', '#0891b2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.topbarBanner}
            >
                <View style={styles.topbarTop}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Feather name="arrow-left" size={16} color="#ffffff" />
                        <Text style={styles.backBtnText}>Back</Text>
                    </TouchableOpacity>
                    <View style={styles.topbarBadges}>
                        <View style={styles.badgePill}><Text style={styles.badgePillText}>{admission?.ward} • Bed {admission?.bedNumber}</Text></View>
                        <View style={[styles.badgePill, { backgroundColor: 'rgba(52,211,153,0.3)' }]}><Text style={styles.badgePillText}>{admission?.status || 'Admitted'}</Text></View>
                    </View>
                </View>

                <View style={styles.patientBannerRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.patientNameHeader}>{patientName}</Text>
                        <Text style={styles.patientSubHeader}>
                            MRN: {patientUid} • {patient.age ? `${patient.age}y` : ''} • {patient.gender || ''} • Attending: Dr. {doctorName}
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.refreshBtn} onPress={fetchAllData} activeOpacity={0.8}>
                        <Feather name="refresh-cw" size={15} color="#ffffff" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* 14 Tabs Horizontal Scroller */}
            <View style={styles.tabsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                                onPress={() => setActiveTab(tab.key)}
                                activeOpacity={0.8}
                            >
                                <Feather
                                    name={tab.icon}
                                    size={14}
                                    color={isActive ? '#0d9488' : '#64748b'}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Tab Active Content */}
            <View style={styles.mainTabContent}>
                {renderTabContent()}
            </View>

            {/* ── MODALS ── */}

            {/* 1. Care Nurse Assignment Modal */}
            <Modal visible={assignModalOpen} transparent animationType="fade" onRequestClose={() => setAssignModalOpen(false)}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidWrap}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Assign Care Nurse</Text>
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    onPress={() => setAssignModalOpen(false)}
                                >
                                    <Feather name="x" size={18} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView style={{ padding: 18, maxHeight: 360 }} keyboardShouldPersistTaps="handled">
                                <Text style={styles.inputLabel}>Select Staff Nurse</Text>
                                {hospitalNurses.map(n => (
                                    <TouchableOpacity
                                        key={n._id}
                                        style={[styles.modalOption, assignForm.nurseId === n._id && styles.modalOptionActive]}
                                        onPress={() => setAssignForm(p => ({ ...p, nurseId: n._id }))}
                                    >
                                        <Text style={[styles.modalOptionText, assignForm.nurseId === n._id && styles.modalOptionTextActive]}>{n.name}</Text>
                                        {assignForm.nurseId === n._id && <Feather name="check" size={16} color="#0d9488" />}
                                    </TouchableOpacity>
                                ))}
                                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Shift</Text>
                                <TextInput style={styles.input} value={assignForm.shift} onChangeText={t => setAssignForm(p => ({ ...p, shift: t }))} />
                            </ScrollView>
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.footerCancelBtn} onPress={() => setAssignModalOpen(false)}><Text style={styles.footerCancelBtnText}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.footerSubmitBtn} onPress={handleAssignNurseSubmit}><Text style={styles.footerSubmitBtnText}>Assign Nurse</Text></TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* 2. Nursing Clearance Modal */}
            <Modal visible={clearanceModalOpen} transparent animationType="fade" onRequestClose={() => setClearanceModalOpen(false)}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidWrap}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Sign Off Nursing Clearance</Text>
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    onPress={() => setClearanceModalOpen(false)}
                                >
                                    <Feather name="x" size={18} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <View style={{ padding: 18 }}>
                                <Text style={styles.inputLabel}>Final Nursing Clearance Notes</Text>
                                <TextInput style={[styles.input, { height: 80 }]} multiline placeholder="Lines removed, wound dressed, discharge summary reviewed with patient..." value={clearanceNotes} onChangeText={setClearanceNotes} />
                            </View>
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.footerCancelBtn} onPress={() => setClearanceModalOpen(false)}><Text style={styles.footerCancelBtnText}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.footerSubmitBtn} onPress={handleSignOffClearance}><Text style={styles.footerSubmitBtnText}>Confirm Clearance</Text></TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* 3. MAR Clinical Administration Modal */}
            <Modal visible={marModal.open} transparent animationType="fade" onRequestClose={() => setMarModal({ open: false, record: null, action: 'GIVE', actualDoseValue: '', actualDoseUnit: 'mg', reason: '', notes: '', errorMsg: '' })}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidWrap}>
                        <View style={[styles.modalCard, { maxHeight: '92%' }]}>
                            <View style={styles.modalHeader}>
                                <View style={{ flex: 1, paddingRight: 8 }}>
                                    <View style={styles.mamBadge}>
                                        <Text style={styles.mamBadgeText}>CLINICAL MEDICATION ADMINISTRATION</Text>
                                    </View>
                                    <Text style={styles.modalTitle}>Administer Medication</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    onPress={() => setMarModal({ open: false, record: null, action: 'GIVE', actualDoseValue: '', actualDoseUnit: 'mg', reason: '', notes: '', errorMsg: '' })}
                                >
                                    <Feather name="x" size={18} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ padding: 18 }} keyboardShouldPersistTaps="handled">
                                {marModal.record && (() => {
                                    const rec = marModal.record;
                                    const order = typeof rec.orderId === 'object' ? rec.orderId : {};
                                    const medicineName = order.medicineName || rec.medicineName || 'Medication';
                                    const prescribedDose = `${order.dosageValue || rec.dosageValue || ''} ${order.dosageUnit || rec.dosageUnit || ''}`.trim() || rec.dosage || 'Standard Dose';
                                    const route = order.route || rec.route || 'Oral';
                                    const frequency = order.frequency || rec.frequency || 'OD';
                                    const orderedDoctor = order.doctorId?.name ? `Dr. ${order.doctorId.name}` : (order.doctorId ? String(order.doctorId) : (doctorName !== 'Not Assigned' ? `Dr. ${doctorName}` : 'Attending Doctor'));
                                    const scheduledTimeStr = rec.scheduledTime ? new Date(rec.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today';
                                    const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                    return (
                                        <View>
                                            {/* Patient summary bar */}
                                            <View style={styles.mamPatientBar}>
                                                <Text style={styles.mamPatientName}>{patientName}</Text>
                                                <Text style={styles.mamPatientMeta}>{patient.gender || '—'} • {patient.age ? `${patient.age}y` : ''} • {admission?.ward || 'Ward'} (Bed {admission?.bedNumber || '—'})</Text>
                                            </View>

                                            {/* Prescription Order Card (Read Only) */}
                                            <View style={styles.rxPrescriptionCard}>
                                                <View style={styles.rxOrderHeader}>
                                                    <Text style={styles.rxOrderHeaderTitle}>DOCTOR'S PRESCRIBED ORDER</Text>
                                                    <View style={styles.rxReadOnlyBadge}>
                                                        <Feather name="shield" size={11} color="#64748b" />
                                                        <Text style={styles.rxReadOnlyBadgeText}>Read Only</Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.rxMedName}>{medicineName}</Text>
                                                <View style={styles.rxPillRow}>
                                                    <View style={[styles.rxPill, { backgroundColor: '#e0f2fe' }]}>
                                                        <Text style={[styles.rxPillText, { color: '#0369a1' }]}>{prescribedDose}</Text>
                                                    </View>
                                                    <View style={[styles.rxPill, { backgroundColor: '#f1f5f9' }]}>
                                                        <Text style={[styles.rxPillText, { color: '#475569' }]}>{route}</Text>
                                                    </View>
                                                    <View style={[styles.rxPill, { backgroundColor: '#fef3c7' }]}>
                                                        <Text style={[styles.rxPillText, { color: '#b45309' }]}>{frequency}</Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.rxMetaText}>Ordered by: <Text style={{ fontWeight: '700', color: '#1e293b' }}>{orderedDoctor}</Text></Text>
                                                {order.instructions ? <Text style={styles.rxMetaText}>Instructions: <Text style={{ fontStyle: 'italic' }}>{order.instructions}</Text></Text> : null}
                                            </View>

                                            {/* Administration Timing */}
                                            <View style={styles.mamTimingRow}>
                                                <View style={styles.mamTimingBox}>
                                                    <Text style={styles.mamTimingLbl}>Scheduled</Text>
                                                    <Text style={styles.mamTimingVal}>{scheduledTimeStr}</Text>
                                                </View>
                                                <View style={[styles.mamTimingBox, { borderColor: '#0d9488', backgroundColor: '#f0fdfa' }]}>
                                                    <Text style={[styles.mamTimingLbl, { color: '#0d9488' }]}>Current Time</Text>
                                                    <Text style={[styles.mamTimingVal, { color: '#0d9488' }]}>{currentTimeStr}</Text>
                                                </View>
                                            </View>

                                            {/* Action Selector */}
                                            <View style={styles.marActionTabs}>
                                                <TouchableOpacity
                                                    style={[styles.marTabBtn, marModal.action === 'GIVE' && styles.marTabBtnGive]}
                                                    onPress={() => setMarModal(p => ({ ...p, action: 'GIVE', errorMsg: '' }))}
                                                >
                                                    <Feather name="check" size={13} color={marModal.action === 'GIVE' ? '#ffffff' : '#10b981'} />
                                                    <Text style={[styles.marTabBtnText, marModal.action === 'GIVE' && styles.marTabBtnTextActive]}>Give</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[styles.marTabBtn, (marModal.action === 'HOLD' || marModal.action === 'HELD') && styles.marTabBtnHold]}
                                                    onPress={() => setMarModal(p => ({ ...p, action: 'HOLD', errorMsg: '' }))}
                                                >
                                                    <Feather name="pause" size={13} color={(marModal.action === 'HOLD' || marModal.action === 'HELD') ? '#ffffff' : '#f59e0b'} />
                                                    <Text style={[styles.marTabBtnText, (marModal.action === 'HOLD' || marModal.action === 'HELD') && styles.marTabBtnTextActive]}>Hold</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[styles.marTabBtn, (marModal.action === 'REFUSE' || marModal.action === 'REFUSED') && styles.marTabBtnRefuse]}
                                                    onPress={() => setMarModal(p => ({ ...p, action: 'REFUSE', errorMsg: '' }))}
                                                >
                                                    <Feather name="x" size={13} color={(marModal.action === 'REFUSE' || marModal.action === 'REFUSED') ? '#ffffff' : '#ef4444'} />
                                                    <Text style={[styles.marTabBtnText, (marModal.action === 'REFUSE' || marModal.action === 'REFUSED') && styles.marTabBtnTextActive]}>Refuse</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[styles.marTabBtn, (marModal.action === 'MISS' || marModal.action === 'MISSED') && styles.marTabBtnMiss]}
                                                    onPress={() => setMarModal(p => ({ ...p, action: 'MISS', errorMsg: '' }))}
                                                >
                                                    <Feather name="alert-triangle" size={13} color={(marModal.action === 'MISS' || marModal.action === 'MISSED') ? '#ffffff' : '#64748b'} />
                                                    <Text style={[styles.marTabBtnText, (marModal.action === 'MISS' || marModal.action === 'MISSED') && styles.marTabBtnTextActive]}>Missed</Text>
                                                </TouchableOpacity>
                                            </View>

                                            {/* Action-Specific Inputs */}
                                            {marModal.action === 'GIVE' ? (
                                                <View style={{ marginTop: 14 }}>
                                                    <Text style={styles.inputLabel}>Administered Dose Adjustment</Text>
                                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                                                        <View style={{ flex: 2 }}>
                                                            <TextInput
                                                                style={styles.input}
                                                                placeholder="Dose value (e.g. 500)"
                                                                keyboardType="numeric"
                                                                value={marModal.actualDoseValue}
                                                                onChangeText={t => setMarModal(p => ({ ...p, actualDoseValue: t }))}
                                                            />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <TextInput
                                                                style={styles.input}
                                                                placeholder="Unit (mg, ml)"
                                                                value={marModal.actualDoseUnit}
                                                                onChangeText={t => setMarModal(p => ({ ...p, actualDoseUnit: t }))}
                                                            />
                                                        </View>
                                                    </View>

                                                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>Clinical Administration Notes (Optional)</Text>
                                                    <TextInput
                                                        style={[styles.input, { height: 60 }]}
                                                        multiline
                                                        placeholder="e.g. Tolerated well, IV site clean and patent, taken with water"
                                                        value={marModal.notes}
                                                        onChangeText={t => setMarModal(p => ({ ...p, notes: t }))}
                                                    />
                                                </View>
                                            ) : (
                                                <View style={{ marginTop: 14 }}>
                                                    <Text style={[styles.inputLabel, { color: '#dc2626' }]}>
                                                        Mandatory Reason for {marModal.action.includes('HOLD') ? 'Holding' : marModal.action.includes('REFUSE') ? 'Refusal' : 'Missed'} Dose *
                                                    </Text>
                                                    <TextInput
                                                        style={[styles.input, { height: 70, borderColor: '#fca5a5' }]}
                                                        multiline
                                                        placeholder={
                                                            marModal.action.includes('HOLD')
                                                                ? 'e.g. Patient scheduled for OT / NPO, BP systolic < 90 mmHg, doctor advised pause'
                                                                : marModal.action.includes('REFUSE')
                                                                ? 'e.g. Patient refused injection stating nausea, doctor notified'
                                                                : 'e.g. Patient away in radiology department during round'
                                                        }
                                                        value={marModal.reason}
                                                        onChangeText={t => setMarModal(p => ({ ...p, reason: t }))}
                                                    />

                                                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>Additional Nursing Observations (Optional)</Text>
                                                    <TextInput
                                                        style={[styles.input, { height: 50 }]}
                                                        multiline
                                                        placeholder="e.g. Doctor notified via intercom at bedside round"
                                                        value={marModal.notes}
                                                        onChangeText={t => setMarModal(p => ({ ...p, notes: t }))}
                                                    />
                                                </View>
                                            )}

                                            {/* Error Message */}
                                            {marModal.errorMsg ? (
                                                <View style={styles.mamErrorBanner}>
                                                    <Feather name="alert-circle" size={14} color="#b91c1c" />
                                                    <Text style={styles.mamErrorText}>{marModal.errorMsg}</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    );
                                })()}
                            </ScrollView>

                            {/* Modal Footer */}
                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={styles.footerCancelBtn}
                                    onPress={() => setMarModal({ open: false, record: null, action: 'GIVE', actualDoseValue: '', actualDoseUnit: 'mg', reason: '', notes: '', errorMsg: '' })}
                                    disabled={submitting}
                                >
                                    <Text style={styles.footerCancelBtnText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.footerSubmitBtn,
                                        marModal.action === 'GIVE'
                                            ? { backgroundColor: '#10b981' }
                                            : (marModal.action === 'HOLD' || marModal.action === 'HELD')
                                            ? { backgroundColor: '#f59e0b' }
                                            : (marModal.action === 'REFUSE' || marModal.action === 'REFUSED')
                                            ? { backgroundColor: '#ef4444' }
                                            : { backgroundColor: '#64748b' }
                                    ]}
                                    onPress={handleMARAction}
                                    disabled={submitting}
                                >
                                    <Text style={styles.footerSubmitBtnText}>
                                        {submitting
                                            ? 'Recording...'
                                            : marModal.action === 'GIVE'
                                            ? 'Confirm Administered'
                                            : (marModal.action === 'HOLD' || marModal.action === 'HELD')
                                            ? 'Hold Medication Dose'
                                            : (marModal.action === 'REFUSE' || marModal.action === 'REFUSED')
                                            ? 'Record Patient Refused'
                                            : 'Record Missed Dose'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* 4. Task Action Modal (Complete/Skip) */}
            <Modal visible={taskModal.open} transparent animationType="fade" onRequestClose={() => setTaskModal({ open: false, task: null, action: '', notes: '' })}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidWrap}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{taskModal.action === 'COMPLETED' ? 'Complete Task' : 'Skip Task'}</Text>
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    onPress={() => setTaskModal({ open: false, task: null, action: '', notes: '' })}
                                >
                                    <Feather name="x" size={18} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <View style={{ padding: 18 }}>
                                <Text style={styles.inputLabel}>Completion Notes</Text>
                                <TextInput style={[styles.input, { height: 70 }]} multiline placeholder="Task observations, bedside findings..." value={taskModal.notes} onChangeText={t => setTaskModal(p => ({ ...p, notes: t }))} />
                            </View>
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.footerCancelBtn} onPress={() => setTaskModal({ open: false, task: null, action: '', notes: '' })}><Text style={styles.footerCancelBtnText}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.footerSubmitBtn} onPress={handleUpdateTaskStatus}><Text style={styles.footerSubmitBtnText}>Confirm</Text></TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* 5. Schedule New Task Modal */}
            <Modal visible={newTaskModalOpen} transparent animationType="fade" onRequestClose={() => setNewTaskModalOpen(false)}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidWrap}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Schedule Clinical Task</Text>
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    onPress={() => setNewTaskModalOpen(false)}
                                >
                                    <Feather name="x" size={18} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <View style={{ padding: 18 }}>
                                <Text style={styles.inputLabel}>Task Title *</Text>
                                <TextInput style={styles.input} placeholder="e.g. Draw Blood Culture, Mobilize Patient" value={taskForm.title} onChangeText={t => setTaskForm(p => ({ ...p, title: t }))} />
                                <Text style={[styles.inputLabel, { marginTop: 10 }]}>Description</Text>
                                <TextInput style={[styles.input, { height: 60 }]} multiline placeholder="Instructions..." value={taskForm.description} onChangeText={t => setTaskForm(p => ({ ...p, description: t }))} />
                            </View>
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.footerCancelBtn} onPress={() => setNewTaskModalOpen(false)}><Text style={styles.footerCancelBtnText}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.footerSubmitBtn} onPress={handleCreateTask}><Text style={styles.footerSubmitBtnText}>Create Task</Text></TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* 6. Insert Line Modal */}
            <Modal visible={newLineModalOpen} transparent animationType="fade" onRequestClose={() => setNewLineModalOpen(false)}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidWrap}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Insert Line / Cannula</Text>
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    onPress={() => setNewLineModalOpen(false)}
                                >
                                    <Feather name="x" size={18} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <View style={{ padding: 18 }}>
                                <Text style={styles.inputLabel}>Anatomical Site *</Text>
                                <TextInput style={styles.input} placeholder="e.g. Right Forearm, Left Hand" value={lineForm.site} onChangeText={t => setLineForm(p => ({ ...p, site: t }))} />
                                <Text style={[styles.inputLabel, { marginTop: 10 }]}>Gauge</Text>
                                <TextInput style={styles.input} placeholder="20G, 18G, 22G" value={lineForm.gauge} onChangeText={t => setLineForm(p => ({ ...p, gauge: t }))} />
                            </View>
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.footerCancelBtn} onPress={() => setNewLineModalOpen(false)}><Text style={styles.footerCancelBtnText}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.footerSubmitBtn} onPress={handleInsertLine}><Text style={styles.footerSubmitBtnText}>Insert Line</Text></TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* 7. Insert Catheter Modal */}
            <Modal visible={newCathModalOpen} transparent animationType="fade" onRequestClose={() => setNewCathModalOpen(false)}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidWrap}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Insert Catheter</Text>
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    onPress={() => setNewCathModalOpen(false)}
                                >
                                    <Feather name="x" size={18} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <View style={{ padding: 18 }}>
                                <Text style={styles.inputLabel}>Site / Route</Text>
                                <TextInput style={styles.input} value={catheterForm.site} onChangeText={t => setCatheterForm(p => ({ ...p, site: t }))} />
                                <Text style={[styles.inputLabel, { marginTop: 10 }]}>Size</Text>
                                <TextInput style={styles.input} value={catheterForm.size} onChangeText={t => setCatheterForm(p => ({ ...p, size: t }))} />
                            </View>
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.footerCancelBtn} onPress={() => setNewCathModalOpen(false)}><Text style={styles.footerCancelBtnText}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.footerSubmitBtn} onPress={handleInsertCatheter}><Text style={styles.footerSubmitBtnText}>Insert Catheter</Text></TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* 8. Remove Device Modal */}
            <Modal visible={deviceRemoveModal.open} transparent animationType="fade" onRequestClose={() => setDeviceRemoveModal({ open: false, type: '', id: '', reason: '', notes: '' })}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidWrap}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Remove {deviceRemoveModal.type === 'LINE' ? 'Line' : 'Catheter'}</Text>
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    onPress={() => setDeviceRemoveModal({ open: false, type: '', id: '', reason: '', notes: '' })}
                                >
                                    <Feather name="x" size={18} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <View style={{ padding: 18 }}>
                                <Text style={styles.inputLabel}>Reason for Removal</Text>
                                <TextInput style={styles.input} placeholder="e.g. Discharge, Infiltration, Finished Treatment" value={deviceRemoveModal.reason} onChangeText={t => setDeviceRemoveModal(p => ({ ...p, reason: t }))} />
                                <Text style={[styles.inputLabel, { marginTop: 10 }]}>Site Assessment Notes</Text>
                                <TextInput style={[styles.input, { height: 60 }]} multiline placeholder="Site intact, no redness, tip inspected..." value={deviceRemoveModal.notes} onChangeText={t => setDeviceRemoveModal(p => ({ ...p, notes: t }))} />
                            </View>
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.footerCancelBtn} onPress={() => setDeviceRemoveModal({ open: false, type: '', id: '', reason: '', notes: '' })}><Text style={styles.footerCancelBtnText}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.footerSubmitBtn, { backgroundColor: '#ef4444' }]} onPress={handleRemoveDevice}><Text style={styles.footerSubmitBtnText}>Remove Device</Text></TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* 9. Order Clarification Modal */}
            <Modal visible={clarificationModal.open} transparent animationType="fade" onRequestClose={() => setClarificationModal({ open: false, order: null, issueType: 'DOSAGE_CONFIRMATION', question: '' })}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidWrap}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Request Clarification</Text>
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    onPress={() => setClarificationModal({ open: false, order: null, issueType: 'DOSAGE_CONFIRMATION', question: '' })}
                                >
                                    <Feather name="x" size={18} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <View style={{ padding: 18 }}>
                                <Text style={styles.itemCardTitle}>{clarificationModal.order?.medicineName || 'Clinical Order'}</Text>
                                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Clarification Question</Text>
                                <TextInput style={[styles.input, { height: 80 }]} multiline placeholder="Describe the clinical discrepancy or dosage question..." value={clarificationModal.question} onChangeText={t => setClarificationModal(p => ({ ...p, question: t }))} />
                            </View>
                            <View style={styles.modalFooter}>
                                <TouchableOpacity style={styles.footerCancelBtn} onPress={() => setClarificationModal({ open: false, order: null, issueType: 'DOSAGE_CONFIRMATION', question: '' })}><Text style={styles.footerCancelBtnText}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.footerSubmitBtn} onPress={handleSubmitClarification}><Text style={styles.footerSubmitBtnText}>Send to Doctor</Text></TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    contentContainer: {
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        minHeight: 400,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1e293b',
        marginTop: 12,
    },
    errorSubtitle: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 20,
    },
    toastBox: {
        position: 'absolute',
        top: 20,
        right: 24,
        zIndex: 9999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        elevation: 6,
    },
    toastSuccess: { backgroundColor: '#10b981' },
    toastError: { backgroundColor: '#ef4444' },
    toastText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },

    // Top Bar Banner
    topbarBanner: {
        paddingVertical: 14,
        paddingHorizontal: 14,
    },
    topbarTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        borderRadius: 20,
        minHeight: 40,
        paddingVertical: 7,
        paddingHorizontal: 12,
        gap: 6,
        justifyContent: 'center',
    },
    backBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
    topbarBadges: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        flexShrink: 1,
    },
    badgePill: {
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 20,
    },
    badgePillText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '700',
    },
    patientBannerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    patientNameHeader: {
        fontSize: 18,
        fontWeight: '800',
        color: '#ffffff',
        flexShrink: 1,
    },
    patientSubHeader: {
        fontSize: 12,
        color: '#e0f2fe',
        marginTop: 3,
        lineHeight: 16,
    },
    refreshBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        minWidth: 40,
        minHeight: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },

    // Tab Navigation
    tabsContainer: {
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    tabsScroll: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        gap: 4,
    },
    tabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 2.5,
        borderBottomColor: 'transparent',
        minHeight: 42,
        flexShrink: 0,
    },
    tabButtonActive: {
        borderBottomColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.05)',
    },
    tabButtonText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#64748b',
    },
    tabButtonTextActive: {
        color: '#0d9488',
        fontWeight: '800',
    },
    mainTabContent: {
        padding: 12,
        maxWidth: 1440,
        alignSelf: 'center',
        width: '100%',
    },
    tabContentWrap: {
        width: '100%',
    },

    // Cards & Layout
    cardGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    infoCard: {
        flex: 1,
        minWidth: 280,
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 12,
    },
    fieldRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    fieldLabel: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
    },
    fieldValue: {
        fontSize: 12.5,
        color: '#0f172a',
        fontWeight: '700',
    },

    // Vitals Mini Grid
    vitalsMiniGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    vitalMiniCell: {
        flex: 1,
        minWidth: 90,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    vitalMiniLbl: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#64748b',
    },
    vitalMiniVal: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
        marginTop: 2,
    },
    vitalMiniUnit: {
        fontSize: 9.5,
        color: '#94a3b8',
    },

    // Quick Actions
    quickActionsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 16,
    },
    quickActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdfa',
        borderWidth: 1,
        borderColor: '#99f6e4',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        gap: 6,
    },
    quickActionText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0d9488',
    },

    // Alert Banner
    alertBannerCard: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
    },
    alertBannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    alertBannerTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#dc2626',
    },
    alertItemBox: {
        backgroundColor: '#ffffff',
        borderRadius: 8,
        padding: 10,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#fee2e2',
    },
    alertItemTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#991b1b',
    },
    alertItemDesc: {
        fontSize: 12,
        color: '#475569',
        marginTop: 2,
    },
    severityTag: {
        backgroundColor: '#fee2e2',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
    },
    severityTagText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#b91c1c',
    },

    // Filters
    filterBarRow: {
        marginBottom: 12,
    },
    filterChipsScroll: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 2,
        paddingVertical: 2,
    },
    filterChip: {
        paddingVertical: 7,
        paddingHorizontal: 13,
        backgroundColor: '#f1f5f9',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        minHeight: 34,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterChipActive: {
        backgroundColor: '#0d9488',
        borderColor: '#0d9488',
    },
    filterChipText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#64748b',
    },
    filterChipTextActive: {
        color: '#ffffff',
    },

    // Items List
    itemCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
        marginBottom: 10,
        width: '100%',
    },
    itemCardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    itemCardTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
        flexShrink: 1,
    },
    itemCardSub: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
        lineHeight: 17,
    },
    itemCardNotes: {
        fontSize: 11.5,
        color: '#475569',
        marginTop: 4,
        lineHeight: 16,
    },
    marActionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
        width: '100%',
    },
    marActionBtn: {
        flexBasis: '48%',
        flexGrow: 1,
        minWidth: 115,
        minHeight: 38,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 7,
    },
    marActionBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
    itemCardActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 10,
        justifyContent: 'flex-end',
    },
    orderStatusTag: {
        backgroundColor: '#f0fdfa',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    orderStatusText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0d9488',
    },
    statusPill: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 12,
        alignSelf: 'flex-start',
        flexShrink: 0,
    },
    statusPillText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#475569',
    },

    // Forms
    formCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
    },
    formGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    formCol: {
        flexBasis: '48%',
        flexGrow: 1,
    },
    inputLabel: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 4,
    },
    input: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingVertical: 7,
        paddingHorizontal: 10,
        fontSize: 13,
        color: '#0f172a',
        backgroundColor: '#ffffff',
    },
    btnPrimary: {
        backgroundColor: '#0d9488',
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 12,
    },
    btnPrimaryText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800',
    },
    btnSmPrimary: {
        backgroundColor: '#0d9488',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 38,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 7,
    },
    btnSmPrimaryText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
    btnSmSuccess: {
        backgroundColor: '#10b981',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 38,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    btnSmSuccessText: {
        color: '#ffffff',
        fontSize: 11.5,
        fontWeight: '700',
    },
    btnSmWarning: {
        backgroundColor: '#f59e0b',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 38,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    btnSmWarningText: {
        color: '#ffffff',
        fontSize: 11.5,
        fontWeight: '700',
    },
    btnSmDanger: {
        backgroundColor: '#ef4444',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 38,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    btnSmDangerText: {
        color: '#ffffff',
        fontSize: 11.5,
        fontWeight: '700',
    },
    btnSmOutline: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 38,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: '#ffffff',
    },
    btnSmOutlineText: {
        color: '#475569',
        fontSize: 11.5,
        fontWeight: '700',
    },
    btnSmMissed: {
        backgroundColor: '#64748b',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 38,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 6,
    },
    btnSmMissedText: {
        color: '#ffffff',
        fontSize: 11.5,
        fontWeight: '700',
    },

    // History Row
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    historyTime: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },
    historyStats: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
        marginTop: 2,
    },
    historyNotes: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 2,
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#0d9488',
    },

    // Notes
    noteCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    noteMeta: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },
    noteBody: {
        fontSize: 13,
        color: '#1e293b',
        marginTop: 4,
    },
    noteNurse: {
        fontSize: 11,
        color: '#0d9488',
        fontWeight: '600',
        marginTop: 4,
    },
    badgeSm: {
        backgroundColor: '#e2e8f0',
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
    },
    badgeSmText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#475569',
    },

    // KPI Mini Row
    kpiRow: {
        flexDirection: 'row',
        gap: 12,
    },
    kpiMiniCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
    },
    kpiMiniVal: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a',
    },
    kpiMiniLbl: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 2,
    },
    toggleBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 8,
    },
    toggleBtnActive: {
        backgroundColor: '#0d9488',
    },
    toggleBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
    },
    toggleBtnTextActive: {
        color: '#ffffff',
    },

    // Empty
    emptyCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 24,
        alignItems: 'center',
    },
    emptyText: {
        color: '#64748b',
        fontSize: 13,
        fontWeight: '600',
    },
    emptyInlineText: {
        color: '#94a3b8',
        fontSize: 12.5,
        fontStyle: 'italic',
        marginTop: 4,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    keyboardAvoidWrap: {
        width: '100%',
        maxWidth: 520,
        alignItems: 'center',
    },
    modalCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        width: '100%',
        maxWidth: 520,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
    },
    modalOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    modalOptionActive: {
        backgroundColor: '#f0fdfa',
    },
    modalOptionText: {
        fontSize: 13,
        color: '#334155',
        fontWeight: '600',
    },
    modalOptionTextActive: {
        color: '#0d9488',
        fontWeight: '700',
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 14,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        backgroundColor: '#f8fafc',
        gap: 10,
    },
    footerCancelBtn: {
        minHeight: 44,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 7,
        backgroundColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerCancelBtnText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#334155',
    },
    footerSubmitBtn: {
        minHeight: 44,
        paddingVertical: 8,
        paddingHorizontal: 18,
        borderRadius: 7,
        backgroundColor: '#0d9488',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerSubmitBtnText: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#ffffff',
    },
    modalCloseBtn: {
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mamBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#f0fdf4',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        marginBottom: 4,
    },
    mamBadgeText: {
        color: '#16a34a',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    mamPatientBar: {
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
    },
    mamPatientName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
    },
    mamPatientMeta: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 2,
    },
    rxPrescriptionCard: {
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#0d9488',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
    },
    rxOrderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    rxOrderHeaderTitle: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0d9488',
        letterSpacing: 0.5,
    },
    rxReadOnlyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    rxReadOnlyBadgeText: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
    },
    rxMedName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 6,
    },
    rxPillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    rxPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    rxPillText: {
        fontSize: 11,
        fontWeight: '700',
    },
    rxMetaText: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    mamTimingRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    mamTimingBox: {
        flex: 1,
        padding: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
    },
    mamTimingLbl: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
    },
    mamTimingVal: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#1e293b',
        marginTop: 2,
    },
    marActionTabs: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 4,
    },
    marTabBtn: {
        flex: 1,
        minWidth: '45%',
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
        gap: 5,
    },
    marTabBtnGive: {
        backgroundColor: '#10b981',
        borderColor: '#10b981',
    },
    marTabBtnHold: {
        backgroundColor: '#f59e0b',
        borderColor: '#f59e0b',
    },
    marTabBtnRefuse: {
        backgroundColor: '#ef4444',
        borderColor: '#ef4444',
    },
    marTabBtnMiss: {
        backgroundColor: '#64748b',
        borderColor: '#64748b',
    },
    marTabBtnText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#475569',
    },
    marTabBtnTextActive: {
        color: '#ffffff',
    },
    mamErrorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fee2e2',
        padding: 8,
        borderRadius: 6,
        marginTop: 10,
        gap: 6,
    },
    mamErrorText: {
        fontSize: 11.5,
        color: '#b91c1c',
        fontWeight: '600',
        flex: 1,
    },
});

export default NursePatientWorkspace;
