import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, 
    ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, 
    Dimensions, Keyboard, Linking, Image 
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { reportAPI, patientAPI, doctorAPI, aiWalletAPI } from '../../utils/api';
import VoiceScribe from '../../components/voicescribe/VoiceScribe';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

// ── AI Credits & Status Helpers matching Web ──
const formatCredits = (amount) => {
    const num = Number(amount) || 0;
    return `${num.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Credits`;
};

const getWalletStatusInfo = (status) => {
    switch (status) {
        case 'LOW':           return { label: 'Low Balance', color: '#f59e0b', bgColor: '#fef3c7', icon: '⚠️' };
        case 'CRITICAL':      return { label: 'Critical', color: '#f97316', bgColor: '#ffedd5', icon: '🔶' };
        case 'VERY_CRITICAL': return { label: 'Very Low', color: '#ef4444', bgColor: '#fee2e2', icon: '🔴' };
        case 'EXHAUSTED':     return { label: 'Exhausted', color: '#dc2626', bgColor: '#fecaca', icon: '🚫' };
        default:              return { label: 'Active', color: '#16a34a', bgColor: '#dcfce7', icon: '✅' };
    }
};

const isImageMime = (mime, url = '') => {
    if (mime && mime.startsWith('image/')) return true;
    if (url && (url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png') || url.endsWith('.webp'))) return true;
    return false;
};

const isPdfMime = (mime, url = '') => {
    if (mime === 'application/pdf') return true;
    if (url && url.endsWith('.pdf')) return true;
    return false;
};

const HighlightKeyword = ({ text, keyword }) => {
    if (!keyword || !text) return <Text style={styles.resultText}>{text}</Text>;
    const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
    return (
        <Text style={styles.resultText}>
            {parts.map((part, i) => 
                part.toLowerCase() === keyword.toLowerCase() ? (
                    <Text key={i} style={styles.highlightedText}>{part}</Text>
                ) : (
                    <Text key={i}>{part}</Text>
                )
            )}
        </Text>
    );
};

const AIAssistant = () => {
    const route = useRoute();
    const navigation = useNavigation();
    
    // Extract route parameters matching Web location.state
    const { 
        patientId: routePatientId, 
        appointmentId: routeAppointmentId, 
        appointment: routeAppointment,
        tab: routeTab 
    } = route.params || {};

    const [activeAIMode, setActiveAIMode] = useState(routeTab === 'voice_scribe' ? 'voice_scribe' : 'reports');

    // ── Patient State ──
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [allPatients, setAllPatients] = useState([]);
    const [isFetchingPatients, setIsFetchingPatients] = useState(true);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showPatientDetails, setShowPatientDetails] = useState(false);

    // ── Reports State ──
    const [reports, setReports] = useState([]);
    const [reportFilterQuery, setReportFilterQuery] = useState('');
    const [selectedReport, setSelectedReport] = useState(null);
    const [isReportsLoading, setIsReportsLoading] = useState(false);
    const [isReportSearchOpen, setIsReportSearchOpen] = useState(false);

    // ── Document Preview Modal State ──
    const [previewDoc, setPreviewDoc] = useState(null);

    // ── AI Summary State ──
    const [summary, setSummary] = useState(null);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState(null);

    // ── Inside Report Search State ──
    const [insideSearchQuery, setInsideSearchQuery] = useState('');
    const [insideSearchResults, setInsideSearchResults] = useState([]);
    const [isSearchingInside, setIsSearchingInside] = useState(false);
    const [insideSearchMessage, setInsideSearchMessage] = useState(null);

    // ── Compare Reports State ──
    const [compareReport1, setCompareReport1] = useState('');
    const [compareReport2, setCompareReport2] = useState('');
    const [comparisonResult, setComparisonResult] = useState(null);
    const [isComparing, setIsComparing] = useState(false);
    const [compareError, setCompareError] = useState(null);

    // ── AI Wallet & Credit State ──
    const [wallet, setWallet] = useState(null);
    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const [walletLogs, setWalletLogs] = useState([]);
    const [isWalletLoading, setIsWalletLoading] = useState(false);

    // ── Chat State ──
    const [chatMessages, setChatMessages] = useState([
        {
            role: 'ai',
            text: "Hello! I'm your AI Assistant.\nYou can ask me anything about this patient's reports, labs, medications or health trends.\nHow can I help you today?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatEndRef = useRef(null);

    // Fetch initial wallet & patients
    useEffect(() => {
        fetchWalletData();
        fetchDoctorPatients();
    }, []);

    const fetchWalletData = async () => {
        try {
            if (aiWalletAPI && aiWalletAPI.getWallet) {
                const res = await aiWalletAPI.getWallet();
                if (res && res.success && res.wallet) {
                    setWallet(res.wallet);
                    return;
                }
            }
            if (reportAPI && reportAPI.getAIUsageStats) {
                const statsRes = await reportAPI.getAIUsageStats();
                if (statsRes && statsRes.success) {
                    setWallet(statsRes.stats);
                }
            }
        } catch (err) {
            console.warn("Could not fetch AI wallet data:", err?.message);
        }
    };

    const fetchWalletModalData = async () => {
        setIsWalletLoading(true);
        try {
            let w = null;
            let logs = [];
            if (aiWalletAPI && aiWalletAPI.getWallet) {
                const wRes = await aiWalletAPI.getWallet();
                if (wRes && wRes.success && wRes.wallet) w = wRes.wallet;
            }
            if (aiWalletAPI && aiWalletAPI.getUsageHistory) {
                const hRes = await aiWalletAPI.getUsageHistory(30);
                if (hRes && hRes.success) logs = hRes.logs || [];
            } else if (reportAPI && reportAPI.getAIUsageHistory) {
                const hRes = await reportAPI.getAIUsageHistory(30);
                if (hRes && hRes.success) logs = hRes.logs || [];
            }
            if (w) setWallet(w);
            setWalletLogs(logs);
        } catch (err) {
            console.error("Error fetching AI wallet analytics:", err);
        } finally {
            setIsWalletLoading(false);
        }
    };

    const fetchDoctorPatients = async () => {
        setIsFetchingPatients(true);
        try {
            const res = await doctorAPI.getPatients();
            if (res && res.success && Array.isArray(res.patients) && res.patients.length > 0) {
                setAllPatients(res.patients);
                const targetPatientId = routePatientId;
                const matchedPatient = targetPatientId 
                    ? res.patients.find(pt => String(pt._id) === String(targetPatientId))
                    : null;
                const p = matchedPatient || res.patients[0];
                const patientObj = {
                    _id: p._id,
                    name: p.name || 'Patient',
                    status: 'Active',
                    profile: {
                        mrn: p.profile?.mrn || p.patientId || p.mrn || 'CIT-' + String(p._id).slice(-4),
                        gender: p.profile?.gender || p.gender || 'Not specified',
                        age: p.profile?.age || p.age || '--',
                        phone: p.phone || p.mobile || 'Not available'
                    }
                };
                setSelectedPatient(patientObj);
                loadPatientDocuments(p._id);
            } else if (routePatientId) {
                try {
                    const singleRes = await patientAPI.getPatient(routePatientId);
                    if (singleRes && singleRes.patient) {
                        const p = singleRes.patient;
                        const patientObj = {
                            _id: p._id,
                            name: p.name || 'Patient',
                            status: 'Active',
                            profile: {
                                mrn: p.patientId || p.mrn || 'CIT-' + String(p._id).slice(-4),
                                gender: p.gender || 'Not specified',
                                age: p.age || '--',
                                phone: p.phone || 'Not available'
                            }
                        };
                        setSelectedPatient(patientObj);
                        setAllPatients([p]);
                        loadPatientDocuments(p._id);
                    }
                } catch (e) {
                    setAllPatients([]);
                    setSelectedPatient(null);
                    setReports([]);
                }
            } else {
                setAllPatients([]);
                setSelectedPatient(null);
                setReports([]);
            }
        } catch (err) {
            console.error("Error fetching patients:", err);
            setAllPatients([]);
        } finally {
            setIsFetchingPatients(false);
        }
    };

    const isReportSelected = (r) => {
        if (!selectedReport || !r) return false;
        if (selectedReport._id && r._id) return String(selectedReport._id) === String(r._id);
        if (selectedReport.url && r.url) return selectedReport.url === r.url;
        if (selectedReport.fileUrl && r.fileUrl) return selectedReport.fileUrl === r.fileUrl;
        if (selectedReport.fileName && r.fileName) return selectedReport.fileName === r.fileName;
        if (selectedReport.name && r.name) return selectedReport.name === r.name;
        return false;
    };

    const loadPatientDocuments = async (patientId) => {
        setIsReportsLoading(true);
        setSummary(null);
        setSelectedReport(null);
        setInsideSearchResults([]);
        setInsideSearchMessage(null);
        setComparisonResult(null);

        try {
            const res = await patientAPI.getDocuments(patientId);
            if (res && res.success && Array.isArray(res.documents) && res.documents.length > 0) {
                setReports(res.documents);
                setSelectedReport(null);
                if (res.documents.length >= 2) {
                    setCompareReport1(res.documents[0].url || res.documents[0]._id || '');
                    setCompareReport2(res.documents[1].url || res.documents[1]._id || '');
                } else if (res.documents.length === 1) {
                    setCompareReport1(res.documents[0].url || res.documents[0]._id || '');
                    setCompareReport2(res.documents[0].url || res.documents[0]._id || '');
                }
            } else {
                setReports([]);
                setSelectedReport(null);
                setCompareReport1('');
                setCompareReport2('');
            }
        } catch (err) {
            console.warn("Error loading patient documents:", err?.message);
            setReports([]);
            setSelectedReport(null);
        } finally {
            setIsReportsLoading(false);
        }
    };

    // Patient autocomplete search
    useEffect(() => {
        if (!searchQuery || searchQuery.trim().length < 1) {
            setSearchResults([]);
            return;
        }
        const q = searchQuery.toLowerCase().trim();
        const filtered = allPatients.filter(p => {
            const nameMatch = p.name && p.name.toLowerCase().includes(q);
            const mrnMatch = (p.profile?.mrn || p.patientId || '').toLowerCase().includes(q);
            const phoneMatch = p.phone && String(p.phone).includes(q);
            return nameMatch || mrnMatch || phoneMatch;
        });
        setSearchResults(filtered);
    }, [searchQuery, allPatients]);

    const handleSelectPatient = (p) => {
        const patientObj = {
            _id: p._id,
            name: p.name || 'Patient',
            status: 'Active',
            profile: {
                mrn: p.profile?.mrn || p.patientId || p.mrn || 'CIT-' + String(p._id).slice(-4),
                gender: p.profile?.gender || p.gender || 'Not specified',
                age: p.profile?.age || p.age || '--',
                phone: p.phone || p.mobile || 'Not available'
            }
        };
        setSelectedPatient(patientObj);
        setSearchQuery('');
        setSearchResults([]);
        setSummary(null);
        loadPatientDocuments(p._id);
    };

    // Generate Summary handler matching Web 1:1
    const handleGenerateSummary = async () => {
        if (!selectedReport || isExhausted) return;
        setIsSummaryLoading(true);
        setSummaryError(null);

        try {
            const fileUrl = selectedReport.url || selectedReport.fileUrl;
            const mimeType = selectedReport.mimeType || 'application/pdf';
            const fileName = selectedReport.fileName || selectedReport.name || 'Medical Report';

            if (!fileUrl) {
                throw new Error("Selected report does not have a valid file URL.");
            }

            const res = await reportAPI.generateAISummary(fileUrl, mimeType, fileName);
            if (res && res.success && res.summary) {
                const s = res.summary;
                if (typeof s === 'string') {
                    setSummary(s);
                } else {
                    let formatted = `### 📋 ${s.ReportType || s.ContentType || 'Clinical Report Summary'}\n\n`;
                    if (s.OverallSummary) formatted += `**Summary:** ${s.OverallSummary}\n\n`;
                    if (Array.isArray(s.ImportantFindings) && s.ImportantFindings.length > 0) {
                        formatted += `#### 🔎 Key Findings\n${s.ImportantFindings.map(f => `- ${f}`).join('\n')}\n\n`;
                    }
                    if (Array.isArray(s.AbnormalValues) && s.AbnormalValues.length > 0) {
                        formatted += `#### ⚠️ Abnormal Values\n${s.AbnormalValues.map(a => `- **${a.parameter || a}**: \`${a.value || ''}\` (${a.interpretation || 'Review clinically'})`).join('\n')}\n\n`;
                    }
                    if (Array.isArray(s.VisibleObservations) && s.VisibleObservations.length > 0) {
                        formatted += `#### 👁️ Observations\n${s.VisibleObservations.map(o => `- ${o}`).join('\n')}\n`;
                    }
                    setSummary(formatted.trim());
                }

                if (res.wallet) setWallet(prev => ({ ...prev, ...res.wallet }));
                else if (res.usage?.wallet) setWallet(prev => ({ ...prev, ...res.usage.wallet }));
            } else {
                throw new Error(res?.message || "Failed to generate summary");
            }
        } catch (err) {
            console.error("Summary error:", err);
            const errMsg = err.response?.data?.message || err.message || "Failed to generate summary";
            if (err.response?.status === 402) {
                if (err.response?.data?.wallet) setWallet(prev => ({ ...prev, ...err.response.data.wallet }));
            }
            setSummaryError(errMsg);
        } finally {
            setIsSummaryLoading(false);
        }
    };

    // Inside Report Search handler matching Web 1:1
    const handleInsideSearch = async () => {
        const query = insideSearchQuery.trim();
        if (!query || !selectedPatient) return;

        setIsSearchingInside(true);
        setInsideSearchMessage(null);
        setInsideSearchResults([]);

        try {
            const res = await reportAPI.searchReports(selectedPatient._id, query);
            if (res && res.success && Array.isArray(res.results)) {
                setInsideSearchResults(res.results);
                if (res.results.length === 0) {
                    setInsideSearchMessage(`No matches found for "${query}" in this patient's reports.`);
                }
            } else {
                setInsideSearchMessage(res?.message || `No matches found for "${query}".`);
            }
        } catch (err) {
            console.error("Search inside error:", err);
            setInsideSearchMessage(err.response?.data?.message || "Error searching inside reports.");
        } finally {
            setIsSearchingInside(false);
        }
    };

    // Compare Reports handler matching Web 1:1
    const handleCompare = async () => {
        if (!compareReport1 || !compareReport2 || isExhausted) return;
        setIsComparing(true);
        setCompareError(null);
        setComparisonResult(null);

        try {
            const r1 = reports.find(r => (r.url || r._id) === compareReport1);
            const r2 = reports.find(r => (r.url || r._id) === compareReport2);

            if (!r1 || !r2 || !r1.url || !r2.url) {
                throw new Error("Please select two valid reports to compare.");
            }

            const res = await reportAPI.compareReports(
                r1.url,
                r1.mimeType || 'application/pdf',
                r2.url,
                r2.mimeType || 'application/pdf',
                selectedPatient?._id
            );

            if (res && res.success && res.comparison) {
                setComparisonResult(res.comparison);
                if (res.wallet) setWallet(prev => ({ ...prev, ...res.wallet }));
                else if (res.usage?.wallet) setWallet(prev => ({ ...prev, ...res.usage.wallet }));
            } else {
                throw new Error(res?.message || "Unable to compare these reports right now. Please try again.");
            }
        } catch (err) {
            console.error("Compare error:", err);
            setCompareError(err.response?.data?.message || err.message || "Unable to compare these reports right now. Please try again.");
        } finally {
            setIsComparing(false);
        }
    };

    // Context-Aware Chat Send matching Web 1:1
    const handleChatSend = async (overridePrompt = null) => {
        const text = (overridePrompt || chatInput).trim();
        if (!text || isExhausted) return;

        const doctorMsg = {
            role: 'doctor',
            text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, doctorMsg]);
        if (!overridePrompt) setChatInput('');
        setIsChatLoading(true);

        setTimeout(() => chatEndRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            const apiMessages = chatMessages.map(m => ({
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: m.text
            }));

            let reportContext = '';
            if (selectedReport) {
                reportContext = `Current Selected Report: "${selectedReport.fileName || selectedReport.name || 'Medical Report'}". `;
                if (summary) {
                    reportContext += `Generated Summary Context: ${typeof summary === 'string' ? summary.substring(0, 500) : ''}. `;
                }
            }

            const patientContext = selectedPatient 
                ? `Patient: ${selectedPatient.name}, MRN: ${selectedPatient.profile.mrn}, Age: ${selectedPatient.profile.age}, Gender: ${selectedPatient.profile.gender}. ${reportContext}`
                : reportContext;

            apiMessages.push({ 
                role: 'user', 
                content: (patientContext ? `[Clinical Context: ${patientContext}]\n\n` : '') + text 
            });

            const mediaUrls = (selectedReport && selectedReport.url) ? [{
                url: selectedReport.url,
                mimeType: selectedReport.mimeType || 'application/pdf'
            }] : [];

            const res = await reportAPI.chatWithAssistant(apiMessages, mediaUrls);
            if (res && res.success && res.reply) {
                const aiMsg = {
                    role: 'ai',
                    text: res.reply,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                setChatMessages(prev => [...prev, aiMsg]);
                if (res.wallet) setWallet(prev => ({ ...prev, ...res.wallet }));
                else if (res.usage?.wallet) setWallet(prev => ({ ...prev, ...res.usage.wallet }));
            } else {
                throw new Error(res?.message || "No reply received");
            }
        } catch (err) {
            console.error("Chat error:", err);
            if (err.response?.status === 402) {
                if (err.response?.data?.wallet) setWallet(prev => ({ ...prev, ...err.response.data.wallet }));
                const aiMsg = {
                    role: 'ai',
                    text: '⚠️ AI Credits Exhausted\n\nYour hospital\'s AI Credits have been fully used. Please contact your Hospital Administrator to recharge.',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                setChatMessages(prev => [...prev, aiMsg]);
            } else {
                const aiMsg = {
                    role: 'ai',
                    text: `⚠️ Clinical Analysis Notice\n\nUnable to process this query right now. Please retry shortly.\n\nError: ${err.message}`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                setChatMessages(prev => [...prev, aiMsg]);
            }
        } finally {
            setIsChatLoading(false);
            setTimeout(() => chatEndRef.current?.scrollToEnd({ animated: true }), 100);
        }
    };

    const handleClearChat = () => {
        setChatMessages([]);
    };

    // Filter reports
    const filteredReports = reports.filter(r => 
        (r.fileName || r.name || '').toLowerCase().includes(reportFilterQuery.toLowerCase())
    );

    // AI Credit Calculations matching Web
    const remainingRupees = wallet ? Number(wallet.remainingAmount ?? wallet.balance) || 0 : 2000;
    const budgetRupees = wallet ? Number(wallet.budgetAmount) || 2000 : 2000;
    const usedRupees = wallet ? Number(wallet.usedAmount) || 0 : 0;
    const usedPercent = budgetRupees > 0 ? Math.min(100, Math.round((usedRupees / budgetRupees) * 100)) : 0;
    const walletStatus = wallet?.status || wallet?.warningLevel || 'ACTIVE';
    const isExhausted = walletStatus === 'EXHAUSTED';
    const statusInfo = getWalletStatusInfo(walletStatus);

    const patientInitials = selectedPatient?.name
        ? selectedPatient.name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase()
        : 'PT';

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate('DoctorDashboard');
        }
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView 
                style={styles.scrollContainer} 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Top Header Card matching Web cca-exact-top-header-card ── */}
                <View style={styles.topHeaderCard}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                            <Text style={styles.backBtnText}>← Back</Text>
                        </TouchableOpacity>
                        <View style={styles.titleWrap}>
                            <Text style={styles.titleText}>AI Assistant</Text>
                            <View style={styles.aiPill}>
                                <Text style={styles.aiPillText}>AI Powered</Text>
                            </View>
                        </View>
                        <Text style={styles.headerSubtitle}>
                            Intelligent clinical companion to analyze patient reports, abnormal values & medical trends.
                        </Text>
                    </View>

                    {/* AI Credits Widget matching Web cca-exact-credits-header-box */}
                    <TouchableOpacity 
                        style={styles.creditsHeaderBox} 
                        activeOpacity={0.85}
                        onPress={() => { setIsWalletOpen(true); fetchWalletModalData(); }}
                    >
                        <View style={styles.cwTop}>
                            <View style={styles.cwLeft}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={styles.cwLabel}>AI Credits</Text>
                                    <Feather name="info" size={12} color="#64748b" />
                                </View>
                                <Text style={styles.cwAmount}>{formatCredits(remainingRupees)}</Text>
                                <Text style={styles.cwSub}>of {formatCredits(budgetRupees)} total budget</Text>
                            </View>
                            <TouchableOpacity 
                                style={styles.btnBuyCredits} 
                                onPress={() => { setIsWalletOpen(true); fetchWalletModalData(); }}
                            >
                                <Text style={styles.btnBuyCreditsText}>Buy Credits</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.cwProgressTrack}>
                            <View style={[styles.cwProgressFill, { 
                                width: `${usedPercent}%`,
                                backgroundColor: isExhausted ? '#dc2626' : walletStatus === 'VERY_CRITICAL' ? '#ef4444' : walletStatus === 'CRITICAL' ? '#f97316' : walletStatus === 'LOW' ? '#f59e0b' : '#4f46e5'
                            }]} />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* ── AI Feature Mode Switcher (Reports vs Voice Scribe) matching Web ── */}
                <View style={styles.aiModeNav}>
                    <TouchableOpacity
                        style={[styles.modeBtn, activeAIMode === 'reports' && styles.modeBtnActiveReports]}
                        onPress={() => setActiveAIMode('reports')}
                    >
                        <Text style={[styles.modeBtnText, activeAIMode === 'reports' && styles.modeBtnTextActiveReports]}>
                            📑 Document & Report Intelligence
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeBtn, activeAIMode === 'voice_scribe' && styles.modeBtnActiveScribe]}
                        onPress={() => setActiveAIMode('voice_scribe')}
                    >
                        <Text style={[styles.modeBtnText, activeAIMode === 'voice_scribe' && styles.modeBtnTextActiveScribe]}>
                            🎙️ AI Clinical Voice Scribe
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ════════ RENDER: VOICE SCRIBE WORKSPACE ════════ */}
                {activeAIMode === 'voice_scribe' ? (
                    <View style={styles.voiceScribeCard}>
                        <VoiceScribe
                            appointmentId={routeAppointmentId}
                            patientId={selectedPatient?._id}
                            patient={selectedPatient}
                            appointment={routeAppointment}
                            isLocked={false}
                        />
                    </View>
                ) : (
                    /* ════════ RENDER: 2-COLUMN MAIN WORKSPACE (REPORTS INTELLIGENCE) ════════ */
                    <View style={[styles.mainGrid, { flexDirection: isTablet ? 'row' : 'column' }]}>
                        
                        {/* ════════ LEFT COLUMN: Patient Row, Uploaded Reports, Summary, Inside Search & Compare ════════ */}
                        <View style={[styles.leftCol, isTablet && { width: '52%', marginRight: 18 }]}>
                            
                            {/* 1. Patient Search Bar & Selected Patient Card */}
                            <View style={styles.patientSearchRowUnified}>
                                <View style={styles.searchBox}>
                                    <Feather name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
                                    <TextInput 
                                        style={styles.searchInput}
                                        placeholder="Search patient by name, MRN, phone..."
                                        placeholderTextColor="#94a3b8"
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                    />
                                    {searchQuery.length > 0 && (
                                        <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                                            <Feather name="x" size={16} color="#64748b" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Autocomplete Dropdown */}
                                {searchResults.length > 0 && (
                                    <View style={styles.patientDropdown}>
                                        {searchResults.map(p => (
                                            <TouchableOpacity 
                                                key={p._id} 
                                                style={styles.dropdownItem} 
                                                onPress={() => handleSelectPatient(p)}
                                            >
                                                <View style={styles.ddAvatar}>
                                                    <Text style={styles.ddAvatarText}>{(p.name || 'P').charAt(0)}</Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.ddName}>{p.name}</Text>
                                                    <Text style={styles.ddSub}>
                                                        {p.profile?.mrn || p.patientId || 'CIT-001'} • {p.profile?.gender || p.gender || 'Patient'} • {p.profile?.age || p.age || '--'} Y
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                {/* Selected Patient Info */}
                                {selectedPatient && (
                                    <View style={styles.selectedPatientCard}>
                                        <View style={styles.patientLeft}>
                                            <View style={styles.avatarCircle}>
                                                <Text style={styles.avatarText}>{patientInitials}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={styles.patientName}>{selectedPatient.name}</Text>
                                                    <View style={styles.activeTag}>
                                                        <Text style={styles.activeTagText}>Active</Text>
                                                    </View>
                                                </View>
                                                <Text style={styles.patientMeta}>MRN: {selectedPatient.profile?.mrn}</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity 
                                            style={styles.btnViewDetails}
                                            onPress={() => setShowPatientDetails(!showPatientDetails)}
                                        >
                                            <Text style={styles.btnViewDetailsText}>Profile</Text>
                                            <Feather name={showPatientDetails ? "chevron-up" : "chevron-down"} size={13} color="#2563eb" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {showPatientDetails && selectedPatient && (
                                    <View style={styles.patientDetailsExpanded}>
                                        <Text style={styles.detailItem}>👤 Gender: <Text style={styles.detailVal}>{selectedPatient.profile?.gender || '—'}</Text></Text>
                                        <Text style={styles.detailItem}>🎂 Age: <Text style={styles.detailVal}>{selectedPatient.profile?.age ? `${selectedPatient.profile.age} Yrs` : '—'}</Text></Text>
                                        <Text style={styles.detailItem}>📞 Phone: <Text style={styles.detailVal}>{selectedPatient.profile?.phone || '—'}</Text></Text>
                                    </View>
                                )}
                            </View>

                            {/* 2. Uploaded Reports Card matching Web */}
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardTitleRow}>
                                        <Text style={styles.cardIcon}>📑</Text>
                                        <View>
                                            <Text style={styles.cardHeading}>Uploaded Reports ({filteredReports.length})</Text>
                                            <View style={styles.secPillBlue}>
                                                <Text style={styles.secPillBlueText}>Patient Documents</Text>
                                            </View>
                                        </View>
                                    </View>
                                    {isReportSearchOpen ? (
                                        <View style={styles.inlineSearchBox}>
                                            <TextInput
                                                style={styles.inlineSearchInput}
                                                placeholder="Filter..."
                                                placeholderTextColor="#94a3b8"
                                                value={reportFilterQuery}
                                                onChangeText={setReportFilterQuery}
                                                autoFocus
                                            />
                                            <TouchableOpacity onPress={() => { setIsReportSearchOpen(false); setReportFilterQuery(''); }}>
                                                <Feather name="x" size={14} color="#64748b" />
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity style={styles.iconBtn} onPress={() => setIsReportSearchOpen(true)}>
                                            <Feather name="search" size={16} color="#64748b" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {isReportsLoading ? (
                                    <View style={{ padding: 24, alignItems: 'center' }}>
                                        <ActivityIndicator size="small" color="#3b82f6" />
                                        <Text style={{ marginTop: 8, color: '#64748b', fontSize: 13 }}>Loading reports...</Text>
                                    </View>
                                ) : filteredReports.length === 0 ? (
                                    <View style={{ padding: 24, alignItems: 'center' }}>
                                        <Feather name="file-text" size={28} color="#94a3b8" />
                                        <Text style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>No uploaded reports for this patient.</Text>
                                    </View>
                                ) : (
                                    <View style={{ gap: 8, marginTop: 8 }}>
                                        {filteredReports.map((r, i) => {
                                            const isSelected = isReportSelected(r);
                                            return (
                                                <TouchableOpacity 
                                                    key={r._id || i}
                                                    style={[styles.reportItem, isSelected && styles.reportItemActive]}
                                                    onPress={() => setSelectedReport(r)}
                                                >
                                                    <View style={styles.reportIconWrap}>
                                                        <Text style={{ fontSize: 18 }}>{isImageMime(r.mimeType, r.url || r.fileUrl) ? '🖼️' : '📄'}</Text>
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.reportName} numberOfLines={1}>{r.fileName || r.name || 'Medical Document'}</Text>
                                                        <Text style={styles.reportMeta}>
                                                            {r.docType || (isPdfMime(r.mimeType, r.url) ? 'PDF' : 'Image')} • {r.date || (r.uploadedAt ? new Date(r.uploadedAt).toLocaleDateString('en-IN') : 'Uploaded')}
                                                        </Text>
                                                    </View>
                                                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                                        {isSelected ? (
                                                            <View style={styles.selectedTag}>
                                                                <Feather name="check" size={11} color="#059669" />
                                                                <Text style={styles.selectedTagText}>Selected</Text>
                                                            </View>
                                                        ) : (
                                                            <TouchableOpacity 
                                                                style={styles.btnSelectReport}
                                                                onPress={() => setSelectedReport(r)}
                                                            >
                                                                <Text style={styles.btnSelectReportText}>Select</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                        <TouchableOpacity 
                                                            style={styles.btnViewDoc}
                                                            onPress={() => setPreviewDoc(r)}
                                                        >
                                                            <Feather name="eye" size={12} color="#2563eb" />
                                                            <Text style={styles.btnViewDocText}>View</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>

                            {/* 3. AI Report Summary Card matching Web */}
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardTitleRow}>
                                        <Text style={styles.cardIcon}>🤖</Text>
                                        <View>
                                            <Text style={styles.cardHeading}>AI Report Summary</Text>
                                            <Text style={styles.targetReportHint}>
                                                {selectedReport ? `Target: ${selectedReport.fileName || selectedReport.name}` : 'Select a report above'}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity 
                                        style={[styles.btnGenerate, (!selectedReport || isSummaryLoading || isExhausted) && styles.btnDisabled]}
                                        onPress={handleGenerateSummary}
                                        disabled={!selectedReport || isSummaryLoading || isExhausted}
                                    >
                                        <Text style={styles.btnGenerateText}>
                                            ✨ {isSummaryLoading ? 'Generating...' : 'Generate Summary'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {summaryError && (
                                    <View style={styles.errorBanner}>
                                        <Feather name="alert-circle" size={14} color="#dc2626" />
                                        <Text style={styles.errorBannerText}>{summaryError}</Text>
                                    </View>
                                )}

                                {isSummaryLoading && (
                                    <View style={{ padding: 24, alignItems: 'center' }}>
                                        <ActivityIndicator size="small" color="#7c3aed" />
                                        <Text style={{ marginTop: 8, color: '#7c3aed', fontSize: 13, fontWeight: '600' }}>
                                            AI is analyzing report parameters and medical values...
                                        </Text>
                                    </View>
                                )}

                                {!isSummaryLoading && summary && (
                                    <View style={styles.summaryResultBox}>
                                        <Text style={styles.summaryResultText}>{summary}</Text>
                                    </View>
                                )}

                                {!isSummaryLoading && !summary && (
                                    <View style={{ padding: 24, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 24, marginBottom: 6 }}>📑</Text>
                                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>
                                            {selectedReport ? `Ready to summarize "${selectedReport.fileName || selectedReport.name}"` : 'No report selected'}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4, textAlign: 'center' }}>
                                            {selectedReport ? "Click 'Generate Summary' to analyze parameters and clinical observations." : "Select an uploaded report above to view AI generated summary"}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* 4. Search Inside Reports Card matching Web */}
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardTitleRow}>
                                        <Text style={styles.cardIcon}>🔍</Text>
                                        <View>
                                            <Text style={styles.cardHeading}>Search Inside Reports</Text>
                                            <View style={styles.secPillGreen}>
                                                <Text style={styles.secPillGreenText}>Keyword Search</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.insideSearchRow}>
                                    <View style={styles.insideInputBox}>
                                        <Feather name="search" size={14} color="#64748b" style={{ marginRight: 6 }} />
                                        <TextInput 
                                            style={styles.insideInput}
                                            placeholder="Search keywords (e.g. Hemoglobin, TLC, Sugar)..."
                                            placeholderTextColor="#94a3b8"
                                            value={insideSearchQuery}
                                            onChangeText={setInsideSearchQuery}
                                            onSubmitEditing={handleInsideSearch}
                                        />
                                        {insideSearchQuery.length > 0 && (
                                            <TouchableOpacity onPress={() => { setInsideSearchQuery(''); setInsideSearchResults([]); setInsideSearchMessage(null); }}>
                                                <Feather name="x" size={14} color="#64748b" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <TouchableOpacity 
                                        style={[styles.btnInsideSearch, (isSearchingInside || !insideSearchQuery.trim() || !selectedPatient) && styles.btnDisabled]}
                                        onPress={handleInsideSearch}
                                        disabled={isSearchingInside || !insideSearchQuery.trim() || !selectedPatient}
                                    >
                                        <Text style={styles.btnInsideSearchText}>
                                            {isSearchingInside ? '...' : 'Search'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {insideSearchMessage && (
                                    <Text style={styles.insideSearchMsg}>{insideSearchMessage}</Text>
                                )}

                                {insideSearchResults.length > 0 && (
                                    <View style={{ gap: 8, marginTop: 10 }}>
                                        {insideSearchResults.map((res, idx) => (
                                            <View key={idx} style={styles.insideResultCard}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <Text style={styles.insideResDoc}>📄 {res.reportName}</Text>
                                                    <Text style={styles.insideResPage}>Page {res.pageNumber || 1}</Text>
                                                </View>
                                                <HighlightKeyword text={`"...${res.match}..."`} keyword={insideSearchQuery} />
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* 5. Compare Reports Card matching Web */}
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardTitleRow}>
                                        <Text style={styles.cardIcon}>📊</Text>
                                        <View>
                                            <Text style={styles.cardHeading}>Compare Reports</Text>
                                            <View style={styles.secPillOrange}>
                                                <Text style={styles.secPillOrangeText}>Biomarker Trends</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.compareControlsRow}>
                                    <View style={styles.pickerBox}>
                                        <Picker
                                            selectedValue={compareReport1}
                                            onValueChange={setCompareReport1}
                                            style={styles.comparePicker}
                                        >
                                            {reports.map((r, i) => (
                                                <Picker.Item key={r._id || i} label={r.fileName || r.name || `Report ${i + 1}`} value={r.url || r._id} />
                                            ))}
                                        </Picker>
                                    </View>
                                    <Text style={styles.vsText}>vs</Text>
                                    <View style={styles.pickerBox}>
                                        <Picker
                                            selectedValue={compareReport2}
                                            onValueChange={setCompareReport2}
                                            style={styles.comparePicker}
                                        >
                                            {reports.map((r, i) => (
                                                <Picker.Item key={r._id || i} label={r.fileName || r.name || `Report ${i + 1}`} value={r.url || r._id} />
                                            ))}
                                        </Picker>
                                    </View>
                                    <TouchableOpacity 
                                        style={[styles.btnCompare, (isComparing || isExhausted || reports.length < 2) && styles.btnDisabled]}
                                        onPress={handleCompare}
                                        disabled={isComparing || isExhausted || reports.length < 2}
                                    >
                                        <Text style={styles.btnCompareText}>
                                            ⚡ {isComparing ? 'Comparing...' : 'Compare'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {compareError && (
                                    <View style={styles.errorBanner}>
                                        <Feather name="alert-circle" size={14} color="#dc2626" />
                                        <Text style={styles.errorBannerText}>{compareError}</Text>
                                    </View>
                                )}

                                {comparisonResult && (
                                    <View style={styles.comparisonResultsBox}>
                                        {comparisonResult.OverallChange && (
                                            <View style={styles.compOverall}>
                                                <Text style={styles.compOverallText}>
                                                    <Text style={{ fontWeight: 'bold' }}>Overall Assessment:</Text> {comparisonResult.OverallChange}
                                                </Text>
                                            </View>
                                        )}
                                        {Array.isArray(comparisonResult.ChangedFindings) && comparisonResult.ChangedFindings.length > 0 && (
                                            <View style={styles.compCardChanged}>
                                                <Text style={styles.compCardTitle}>⚡ Changed Values & Trends</Text>
                                                {comparisonResult.ChangedFindings.map((cf, i) => (
                                                    <Text key={i} style={styles.compCardItem}>
                                                        • {typeof cf === 'string' ? cf : `${cf.parameter || cf.name}: ${cf.previousValue || ''} ➔ ${cf.currentValue || ''}`}
                                                    </Text>
                                                ))}
                                            </View>
                                        )}
                                        {Array.isArray(comparisonResult.NewFindings) && comparisonResult.NewFindings.length > 0 && (
                                            <View style={styles.compCardNew}>
                                                <Text style={styles.compCardTitle}>🔎 New Findings</Text>
                                                {comparisonResult.NewFindings.map((nf, i) => (
                                                    <Text key={i} style={styles.compCardItem}>• {nf}</Text>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>

                        </View>

                        {/* ════════ RIGHT COLUMN: AI ASSISTANT CHAT PANEL matching Web 1:1 ════════ */}
                        <View style={[styles.rightCol, isTablet && { flex: 1 }]}>
                            <View style={styles.chatCard}>
                                
                                {/* Chat Header */}
                                <View style={styles.chatHeader}>
                                    <View style={styles.chatTitleGroup}>
                                        <View style={styles.botIconCircle}>
                                            <Text style={{ fontSize: 18 }}>🤖</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={styles.chatTitleText}>AI Assistant Chat</Text>
                                                <View style={styles.liveBadge}>
                                                    <Text style={styles.liveBadgeText}>Live Intelligence</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.chatSubtitle}>Get AI-driven insights and answers about this patient.</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity style={styles.btnClearChat} onPress={handleClearChat}>
                                        <Feather name="trash-2" size={13} color="#64748b" />
                                        <Text style={styles.btnClearChatText}>Clear</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Chat Messages Stream */}
                                <ScrollView 
                                    ref={chatEndRef}
                                    style={styles.chatStream}
                                    contentContainerStyle={{ padding: 14, gap: 12 }}
                                    nestedScrollEnabled
                                >
                                    {chatMessages.map((msg, i) => (
                                        <View 
                                            key={i} 
                                            style={[
                                                styles.chatBubble, 
                                                msg.role === 'doctor' ? styles.chatBubbleDoctor : styles.chatBubbleAI
                                            ]}
                                        >
                                            <View style={styles.chatBubbleHead}>
                                                <Text style={[styles.chatRoleTag, msg.role === 'doctor' ? styles.chatRoleDoctor : styles.chatRoleAI]}>
                                                    {msg.role === 'doctor' ? '🩺 You' : '🤖 AI Assistant'}
                                                </Text>
                                                <Text style={styles.chatTime}>{msg.timestamp}</Text>
                                            </View>
                                            <Text style={[styles.chatText, msg.role === 'doctor' ? styles.chatTextDoctor : styles.chatTextAI]}>
                                                {msg.text}
                                            </Text>
                                        </View>
                                    ))}

                                    {isChatLoading && (
                                        <View style={[styles.chatBubble, styles.chatBubbleAI]}>
                                            <View style={styles.chatBubbleHead}>
                                                <Text style={[styles.chatRoleTag, styles.chatRoleAI]}>🤖 AI Assistant</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                                                <ActivityIndicator size="small" color="#7c3aed" />
                                                <Text style={{ fontSize: 13, color: '#7c3aed', fontWeight: '600' }}>Thinking...</Text>
                                            </View>
                                        </View>
                                    )}
                                </ScrollView>

                                {/* Quick Clinical Chips */}
                                <View style={styles.quickChipsBar}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
                                        <TouchableOpacity 
                                            style={styles.quickChip}
                                            onPress={() => handleChatSend('Iska ilaj kaise hoga? Give 2 to 3 standard evidence-based clinical treatment pathways and management options.')}
                                            disabled={isChatLoading || isExhausted}
                                        >
                                            <Text style={styles.quickChipText}>🩺 Iska ilaj kaise hoga?</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            style={styles.quickChip}
                                            onPress={() => handleChatSend('Analyze all abnormal values in this report and highlight critical parameters.')}
                                            disabled={isChatLoading || isExhausted}
                                        >
                                            <Text style={styles.quickChipText}>⚠️ Abnormal Values</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            style={styles.quickChip}
                                            onPress={() => handleChatSend('Provide recommended follow-up diagnostic tests and diet/lifestyle guidelines.')}
                                            disabled={isChatLoading || isExhausted}
                                        >
                                            <Text style={styles.quickChipText}>🥗 Follow-up & Diet</Text>
                                        </TouchableOpacity>
                                    </ScrollView>
                                </View>

                                {/* Chat Input Box */}
                                <View style={styles.chatInputBox}>
                                    <View style={styles.chatInputRow}>
                                        <TextInput 
                                            style={styles.chatInput}
                                            placeholder={isExhausted ? 'AI Credits Exhausted — Contact Admin' : 'Ask anything, or "Iska ilaj kaise hoga?"...'}
                                            placeholderTextColor="#94a3b8"
                                            value={chatInput}
                                            onChangeText={setChatInput}
                                            multiline
                                            editable={!isExhausted}
                                        />
                                        <TouchableOpacity 
                                            style={[styles.btnSend, (!chatInput.trim() || isChatLoading || isExhausted) && styles.btnDisabled]}
                                            onPress={() => handleChatSend()}
                                            disabled={!chatInput.trim() || isChatLoading || isExhausted}
                                        >
                                            <Feather name="send" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.disclaimerText}>
                                        ✨ Medical365 AI • Verified clinical algorithms. Please verify clinically.
                                    </Text>
                                </View>

                            </View>
                        </View>

                    </View>
                )}
            </ScrollView>

            {/* ── Document Preview Modal ── */}
            {previewDoc && (
                <Modal visible={!!previewDoc} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.previewModal}>
                            <View style={styles.previewHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.previewTitle} numberOfLines={1}>{previewDoc.fileName || previewDoc.name || 'Document Preview'}</Text>
                                    <Text style={styles.previewSub}>{previewDoc.docType || (isPdfMime(previewDoc.mimeType, previewDoc.url) ? 'PDF Document' : 'Medical Image')}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                    {previewDoc.url && (
                                        <TouchableOpacity 
                                            style={styles.btnOpenExt}
                                            onPress={() => {
                                                Linking.openURL(previewDoc.url).catch(err => {
                                                    Alert.alert('Error', 'Could not open URL: ' + err.message);
                                                });
                                            }}
                                        >
                                            <Feather name="external-link" size={14} color="#2563eb" />
                                            <Text style={styles.btnOpenExtText}>Open</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity onPress={() => setPreviewDoc(null)}>
                                        <Feather name="x" size={20} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.previewBody}>
                                {isImageMime(previewDoc.mimeType, previewDoc.url) ? (
                                    <Image source={{ uri: previewDoc.url }} style={styles.previewImage} resizeMode="contain" />
                                ) : (
                                    <View style={{ padding: 40, alignItems: 'center' }}>
                                        <Feather name="file-text" size={48} color="#3b82f6" />
                                        <Text style={{ marginTop: 12, color: '#0f172a', fontWeight: 'bold' }}>PDF Document</Text>
                                        <TouchableOpacity 
                                            style={[styles.btnOpenExt, { marginTop: 14, backgroundColor: '#2563eb', paddingHorizontal: 16 }]}
                                            onPress={() => Linking.openURL(previewDoc.url)}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Open PDF Externally</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* ── AI Wallet Modal ── */}
            {isWalletOpen && (
                <Modal visible={isWalletOpen} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.walletModal}>
                            <View style={styles.previewHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={{ fontSize: 22 }}>🏥</Text>
                                    <View>
                                        <Text style={styles.previewTitle}>Hospital AI Wallet & AI Credits</Text>
                                        <Text style={styles.previewSub}>Live budget and credit usage logs.</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setIsWalletOpen(false)}>
                                    <Feather name="x" size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ maxHeight: 400, padding: 16 }}>
                                <View style={styles.walletKpiRow}>
                                    <View style={styles.walletKpiCard}>
                                        <Text style={styles.walletKpiLabel}>Available Balance</Text>
                                        <Text style={[styles.walletKpiValue, { color: statusInfo.color }]}>
                                            ⚡ {formatCredits(remainingRupees)}
                                        </Text>
                                        <Text style={styles.walletKpiSub}>
                                            Status: {statusInfo.icon} {statusInfo.label}
                                        </Text>
                                    </View>
                                    <View style={styles.walletKpiCard}>
                                        <Text style={styles.walletKpiLabel}>Used Credits</Text>
                                        <Text style={styles.walletKpiValue}>
                                            {formatCredits(usedRupees)}
                                        </Text>
                                        <Text style={styles.walletKpiSub}>
                                            Total Pool: {formatCredits(budgetRupees)}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={[styles.cardHeading, { marginTop: 16, marginBottom: 8 }]}>Recent AI Invocations</Text>
                                {isWalletLoading ? (
                                    <ActivityIndicator size="small" color="#3b82f6" />
                                ) : walletLogs.length === 0 ? (
                                    <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 16 }}>
                                        No AI requests recorded yet.
                                    </Text>
                                ) : (
                                    walletLogs.map((log) => (
                                        <View key={log._id} style={styles.walletLogRow}>
                                            <View>
                                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }}>{log.operation || 'CLINICAL_CHAT'}</Text>
                                                <Text style={{ fontSize: 10, color: '#64748b' }}>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.totalTokens || 0} tokens</Text>
                                            </View>
                                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#6366f1' }}>
                                                ⚡ {(log.actualApiCost || log.estimatedCostInr || 0).toFixed(2)} Credits
                                            </Text>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContainer: {
        flex: 1,
    },
    scrollContent: {
        padding: 18,
    },

    // ── Top Header ──
    topHeaderCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 1,
    },
    headerLeft: {
        marginBottom: 14,
    },
    backBtn: {
        backgroundColor: 'rgba(15, 23, 42, 0.06)',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    backBtnText: {
        color: '#475569',
        fontSize: 12,
        fontWeight: 'bold',
    },
    titleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    titleText: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0f172a',
    },
    aiPill: {
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(124, 58, 237, 0.25)',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    aiPillText: {
        color: '#7c3aed',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    headerSubtitle: {
        color: '#64748b',
        fontSize: 13,
        lineHeight: 18,
    },
    creditsHeaderBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 14,
    },
    cwTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    cwLeft: {
        flex: 1,
    },
    cwLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    cwAmount: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0f172a',
        marginTop: 2,
    },
    cwSub: {
        fontSize: 11,
        color: '#64748b',
    },
    btnBuyCredits: {
        backgroundColor: '#3b82f6',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
    btnBuyCreditsText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    cwProgressTrack: {
        height: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    cwProgressFill: {
        height: '100%',
        borderRadius: 3,
    },

    // ── Mode Switcher ──
    aiModeNav: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        padding: 4,
        borderRadius: 12,
        marginBottom: 16,
        gap: 6,
    },
    modeBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    modeBtnActiveReports: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 1,
    },
    modeBtnActiveScribe: {
        backgroundColor: '#10b981',
    },
    modeBtnText: {
        fontSize: 12.5,
        fontWeight: '600',
        color: '#64748b',
    },
    modeBtnTextActiveReports: {
        color: '#3b82f6',
        fontWeight: '800',
    },
    modeBtnTextActiveScribe: {
        color: '#ffffff',
        fontWeight: '800',
    },

    voiceScribeCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
    },

    // ── Main Workspace ──
    mainGrid: {
        width: '100%',
    },
    leftCol: {
        gap: 16,
    },
    rightCol: {
        marginTop: isTablet ? 0 : 16,
    },

    // ── Cards ──
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 16,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    cardIcon: {
        fontSize: 18,
    },
    cardHeading: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
    },
    secPillBlue: {
        backgroundColor: '#eff6ff',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    secPillBlueText: {
        color: '#2563eb',
        fontSize: 9.5,
        fontWeight: '700',
    },
    secPillGreen: {
        backgroundColor: '#ecfdf5',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    secPillGreenText: {
        color: '#059669',
        fontSize: 9.5,
        fontWeight: '700',
    },
    secPillOrange: {
        backgroundColor: '#fffbeb',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    secPillOrangeText: {
        color: '#d97706',
        fontSize: 9.5,
        fontWeight: '700',
    },

    // ── Patient Search Row ──
    patientSearchRowUnified: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 14,
        gap: 10,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 42,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
    },
    patientDropdown: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        overflow: 'hidden',
        maxHeight: 180,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        gap: 10,
    },
    ddAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#3b82f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ddAvatarText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    ddName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    ddSub: {
        fontSize: 11,
        color: '#64748b',
    },
    selectedPatientCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
    },
    patientLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    avatarCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#6366f1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    patientName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
    },
    activeTag: {
        backgroundColor: '#dcfce7',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    },
    activeTagText: {
        color: '#166534',
        fontSize: 9.5,
        fontWeight: 'bold',
    },
    patientMeta: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    btnViewDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.2)',
        borderRadius: 8,
        paddingVertical: 5,
        paddingHorizontal: 8,
    },
    btnViewDetailsText: {
        color: '#2563eb',
        fontSize: 11,
        fontWeight: '700',
    },
    patientDetailsExpanded: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        gap: 4,
    },
    detailItem: {
        fontSize: 12,
        color: '#64748b',
    },
    detailVal: {
        color: '#0f172a',
        fontWeight: '600',
    },

    // ── Reports List ──
    reportItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 10,
        gap: 10,
    },
    reportItemActive: {
        borderColor: '#3b82f6',
        backgroundColor: '#eff6ff',
    },
    reportIconWrap: {
        width: 34,
        height: 34,
        borderRadius: 8,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    reportName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#0f172a',
    },
    reportMeta: {
        fontSize: 10.5,
        color: '#64748b',
        marginTop: 2,
    },
    selectedTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#dcfce7',
        borderWidth: 1,
        borderColor: '#86efac',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    selectedTagText: {
        color: '#166534',
        fontSize: 11,
        fontWeight: 'bold',
    },
    btnSelectReport: {
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: 'rgba(37, 99, 235, 0.2)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    btnSelectReportText: {
        color: '#2563eb',
        fontSize: 11,
        fontWeight: 'bold',
    },
    btnViewDoc: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    btnViewDocText: {
        color: '#475569',
        fontSize: 11,
        fontWeight: 'bold',
    },
    inlineSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        borderRadius: 6,
        paddingHorizontal: 8,
        height: 32,
    },
    inlineSearchInput: {
        fontSize: 12,
        color: '#0f172a',
        width: 80,
    },
    iconBtn: {
        padding: 6,
    },

    // ── Summary Card ──
    targetReportHint: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1,
    },
    btnGenerate: {
        backgroundColor: '#7c3aed',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    btnGenerateText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
    },
    errorBannerText: {
        color: '#dc2626',
        fontSize: 12,
        flex: 1,
    },
    summaryResultBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 14,
    },
    summaryResultText: {
        fontSize: 13,
        color: '#1e293b',
        lineHeight: 20,
    },

    // ── Inside Search Card ──
    insideSearchRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    insideInputBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 38,
    },
    insideInput: {
        flex: 1,
        fontSize: 12,
        color: '#0f172a',
    },
    btnInsideSearch: {
        backgroundColor: '#059669',
        borderRadius: 8,
        paddingHorizontal: 14,
        height: 38,
        justifyContent: 'center',
    },
    btnInsideSearchText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    insideSearchMsg: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 8,
    },
    insideResultCard: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 10,
    },
    insideResDoc: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    insideResPage: {
        fontSize: 10,
        color: '#64748b',
    },
    resultText: {
        fontSize: 12,
        color: '#334155',
        lineHeight: 18,
    },
    highlightedText: {
        backgroundColor: '#fef08a',
        fontWeight: 'bold',
        color: '#854d0e',
    },

    // ── Compare Card ──
    compareControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pickerBox: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        overflow: 'hidden',
    },
    comparePicker: {
        height: 38,
        color: '#0f172a',
    },
    vsText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#64748b',
    },
    btnCompare: {
        backgroundColor: '#d97706',
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 38,
        justifyContent: 'center',
    },
    btnCompareText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    comparisonResultsBox: {
        marginTop: 12,
        gap: 8,
    },
    compOverall: {
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        borderRadius: 8,
        padding: 10,
    },
    compOverallText: {
        fontSize: 12,
        color: '#166534',
        lineHeight: 18,
    },
    compCardChanged: {
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fde68a',
        borderRadius: 8,
        padding: 10,
    },
    compCardNew: {
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        borderRadius: 8,
        padding: 10,
    },
    compCardTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#0f172a',
        marginBottom: 4,
    },
    compCardItem: {
        fontSize: 11.5,
        color: '#334155',
        lineHeight: 16,
    },

    // ── Right Column / Chat Card ──
    chatCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 1,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    chatTitleGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    botIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#ede9fe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatTitleText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0f172a',
    },
    liveBadge: {
        backgroundColor: '#dcfce7',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    liveBadgeText: {
        color: '#15803d',
        fontSize: 9.5,
        fontWeight: 'bold',
    },
    chatSubtitle: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 1,
    },
    btnClearChat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f1f5f9',
        paddingVertical: 5,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    btnClearChatText: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },
    chatStream: {
        minHeight: 280,
        maxHeight: 400,
        backgroundColor: '#f8fafc',
    },
    chatBubble: {
        borderRadius: 12,
        padding: 12,
        maxWidth: '88%',
    },
    chatBubbleDoctor: {
        alignSelf: 'flex-end',
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    chatBubbleAI: {
        alignSelf: 'flex-start',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    chatBubbleHead: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
        gap: 10,
    },
    chatRoleTag: {
        fontSize: 10.5,
        fontWeight: 'bold',
    },
    chatRoleDoctor: {
        color: '#2563eb',
    },
    chatRoleAI: {
        color: '#7c3aed',
    },
    chatTime: {
        fontSize: 9.5,
        color: '#94a3b8',
    },
    chatText: {
        fontSize: 13,
        lineHeight: 18,
    },
    chatTextDoctor: {
        color: '#1e3a8a',
    },
    chatTextAI: {
        color: '#1e293b',
    },
    quickChipsBar: {
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingVertical: 8,
        backgroundColor: '#ffffff',
    },
    quickChip: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        paddingVertical: 5,
        paddingHorizontal: 12,
    },
    quickChipText: {
        fontSize: 11,
        color: '#334155',
        fontWeight: '600',
    },
    chatInputBox: {
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        padding: 12,
        backgroundColor: '#ffffff',
        gap: 6,
    },
    chatInputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    chatInput: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
        color: '#0f172a',
        maxHeight: 80,
    },
    btnSend: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#2563eb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    disclaimerText: {
        fontSize: 10,
        color: '#94a3b8',
        textAlign: 'center',
    },

    btnDisabled: {
        opacity: 0.45,
    },

    // ── Modals ──
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    previewModal: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 600,
        maxHeight: '80%',
        overflow: 'hidden',
    },
    previewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    previewTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    previewSub: {
        fontSize: 11,
        color: '#64748b',
    },
    btnOpenExt: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#eff6ff',
        paddingVertical: 5,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    btnOpenExtText: {
        color: '#2563eb',
        fontSize: 11,
        fontWeight: 'bold',
    },
    previewBody: {
        height: 380,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },

    walletModal: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 500,
        overflow: 'hidden',
    },
    walletKpiRow: {
        flexDirection: 'row',
        gap: 10,
    },
    walletKpiCard: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 12,
    },
    walletKpiLabel: {
        fontSize: 11,
        color: '#64748b',
        fontWeight: '600',
    },
    walletKpiValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        marginTop: 4,
    },
    walletKpiSub: {
        fontSize: 10,
        color: '#94a3b8',
        marginTop: 2,
    },
    walletLogRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
});

export default AIAssistant;
