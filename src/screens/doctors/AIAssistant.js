import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, 
    ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, 
    Dimensions, Keyboard 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { reportAPI, patientAPI, doctorAPI } from '../../utils/api';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

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
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    const [allPatients, setAllPatients] = useState([]);
    const [isFetchingPatients, setIsFetchingPatients] = useState(true);

    const [selectedPatient, setSelectedPatient] = useState(null);
    const [reports, setReports] = useState([]);
    const [isReportsLoading, setIsReportsLoading] = useState(false);

    const [selectedReport, setSelectedReport] = useState(null);
    const [summary, setSummary] = useState(null);
    const [summaryUsage, setSummaryUsage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const [reportSearchQuery, setReportSearchQuery] = useState('');
    const [reportSearchResults, setReportSearchResults] = useState(null);
    const [reportSearchError, setReportSearchError] = useState(null);

    const [comparison, setComparison] = useState(null);
    const [isComparing, setIsComparing] = useState(false);
    const [compareError, setCompareError] = useState(null);

    const [historySummary, setHistorySummary] = useState(null);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState(null);

    // ── AI Token Tracker Modal State ──
    const [isTrackerOpen, setIsTrackerOpen] = useState(false);
    const [trackerStats, setTrackerStats] = useState(null);
    const [trackerLogs, setTrackerLogs] = useState([]);
    const [isTrackerLoading, setIsTrackerLoading] = useState(false);

    const fetchTrackerData = async () => {
        setIsTrackerLoading(true);
        try {
            const [statsRes, historyRes] = await Promise.all([
                reportAPI.getAIUsageStats(),
                reportAPI.getAIUsageHistory(30)
            ]);
            if (statsRes && statsRes.success) setTrackerStats(statsRes.stats);
            if (historyRes && historyRes.success) setTrackerLogs(historyRes.logs || []);
        } catch (err) {
            console.error("Error fetching AI usage tracker data:", err);
        } finally {
            setIsTrackerLoading(false);
        }
    };

    const handleOpenTracker = () => {
        setIsTrackerOpen(true);
        fetchTrackerData();
    };

    // ── AI Clinical Chat state (session-only) ──
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatScrollViewRef = useRef(null);

    const CHAT_SUGGESTIONS = [
        'Explain this report',
        'Summarize abnormalities',
        'Show important findings',
        'Explain medical terms',
        'Compare latest report',
    ];

    const handleChatSend = async (overrideText) => {
        const text = (overrideText || chatInput).trim();
        if (!text || !selectedPatient) return;

        Keyboard.dismiss();

        const doctorMsg = { role: 'doctor', text, timestamp: new Date() };
        setChatMessages(prev => [...prev, doctorMsg]);
        setChatInput('');
        setIsChatLoading(true);
        
        setTimeout(() => chatScrollViewRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            const patientContext = selectedPatient ? `Context: Patient name is ${selectedPatient.name}, age ${selectedPatient.profile?.age || 'unknown'}, gender ${selectedPatient.profile?.gender || 'unknown'}. ` : '';
            
            // Build message history for the AI
            const apiMessages = chatMessages.map(m => ({
                role: m.role === 'ai' ? 'assistant' : 'user',
                content: m.text
            }));
            
            // Append the new message with patient context
            apiMessages.push({ role: 'user', content: patientContext + text });

            const res = await reportAPI.chatWithAssistant(apiMessages);
            if (res.success && res.reply) {
                const aiMsg = { 
                    role: 'ai', 
                    text: res.reply, 
                    usage: res.usage || null,
                    timestamp: new Date() 
                };
                setChatMessages(prev => [...prev, aiMsg]);
            } else {
                throw new Error(res.message || "Failed to get AI response.");
            }
        } catch (err) {
            console.error("AI Chat Error:", err);
            const errorMsg = { role: 'ai', text: `Sorry, I encountered an error: ${err.message || "Failed to get response."}`, timestamp: new Date() };
            setChatMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsChatLoading(false);
            setTimeout(() => chatScrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
    };

    // Fetch only the doctor's department patients on mount
    useEffect(() => {
        const fetchDoctorPatients = async () => {
            try {
                const res = await doctorAPI.getPatients();
                if (res && res.success && res.patients) {
                    setAllPatients(res.patients);
                }
            } catch (err) {
                console.error("Error fetching doctor's patients:", err);
            } finally {
                setIsFetchingPatients(false);
            }
        };
        fetchDoctorPatients();
    }, []);

    // Local filter based on name, MRN or patientId
    useEffect(() => {
        if (!searchQuery || searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        const q = searchQuery.toLowerCase().trim();
        const filtered = allPatients.filter(p => {
            const nameMatch = p.name && p.name.toLowerCase().includes(q);
            const idMatch = p.patientId && p.patientId.toLowerCase().includes(q);
            const mrnMatch = p.profile?.mrn && p.profile.mrn.toLowerCase().includes(q);
            return nameMatch || idMatch || mrnMatch;
        });
        setSearchResults(filtered);
    }, [searchQuery, allPatients]);

    const handleSelectPatient = async (patient) => {
        setSelectedPatient(patient);
        setSearchResults([]);
        setSearchQuery('');
        setSelectedReport(null);
        setSummary(null);
        setError(null);
        setComparison(null);
        setCompareError(null);
        setHistorySummary(null);
        setHistoryError(null);

        // Fetch reports for the selected patient
        setIsReportsLoading(true);
        setReports([]);
        try {
            const res = await patientAPI.getDocuments(patient._id);
            if (res && res.success && res.documents) {
                setReports(res.documents);
            } else if (res && res.success && res.data) {
                setReports(res.data);
            }
        } catch (err) {
            console.error("Error fetching patient documents:", err);
        } finally {
            setIsReportsLoading(false);
        }
    };

    const handleGenerateSummary = async () => {
        if (!selectedReport) {
            setError("Please select a report first.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setSummary(null);
        setSummaryUsage(null);

        try {
            const res = await reportAPI.generateAISummary(selectedReport.url, selectedReport.mimeType || selectedReport.mimetype || 'application/pdf');
            if (res.success) {
                setSummary(res.summary);
                if (res.usage) setSummaryUsage(res.usage);
            } else {
                setError(res.message || "Unable to generate summary. Please try again.");
            }
        } catch (err) {
            console.error("AI Summary error:", err);
            setError("Unable to generate summary. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCompareReports = async () => {
        const sortedReports = reports ? [...reports].sort((a, b) => new Date(b.uploadedAt || b.date) - new Date(a.uploadedAt || a.date)) : [];
        if (sortedReports.length < 2) {
            setCompareError("At least two reports are required for comparison.");
            return;
        }

        const latestReport = sortedReports[0];
        const previousReport = sortedReports[1];

        setIsComparing(true);
        setCompareError(null);
        setComparison(null);

        try {
            const res = await reportAPI.compareReports(
                latestReport.url, latestReport.mimeType || 'application/pdf',
                previousReport.url, previousReport.mimeType || 'application/pdf'
            );
            if (res.success) {
                setComparison({
                    latestDate: latestReport.uploadedAt || latestReport.date,
                    previousDate: previousReport.uploadedAt || previousReport.date,
                    data: res.comparison,
                    usage: res.usage || null
                });
            } else {
                setCompareError(res.message || "Unable to compare reports.");
            }
        } catch (err) {
            console.error("Compare Reports error:", err);
            setCompareError("Unable to compare reports. Please try again.");
        } finally {
            setIsComparing(false);
        }
    };

    const generateHistorySummary = async () => {
        if (!selectedPatient) return;
        setIsHistoryLoading(true);
        setHistoryError(null);
        setHistorySummary(null);

        try {
            const patientId = selectedPatient._id || selectedPatient.patientUid || selectedPatient.patientId;
            const res = await patientAPI.getFullHistory(patientId);
            
            if (res.success) {
                const timeline = res.timeline || [];
                const patient = res.patient || selectedPatient;
                
                const appointments = timeline.filter(item => item.type === 'appointment').map(i => i.data);
                const totalVisits = appointments.length;
                
                let lastVisitDate = 'Not Available';
                if (appointments.length > 0) {
                    const dates = appointments.map(a => new Date(a.appointmentDate || a.createdAt).getTime()).filter(d => !isNaN(d));
                    if (dates.length > 0) {
                        lastVisitDate = new Date(Math.max(...dates)).toLocaleDateString();
                    }
                }
                
                const departments = [...new Set(appointments.map(a => a.department || a.serviceName).filter(Boolean))];
                const reportsCount = reports ? reports.length : 0;
                
                let diagnoses = [...new Set(timeline.filter(item => item.type === 'appointment' || item.type === 'clinicalVisit').map(i => i.summary?.outcome || i.data?.diagnosis).filter(d => d && d !== 'Pending' && d !== 'Processing' && d !== '—'))];
                
                let allergies = patient.fertilityProfile?.allergies || patient.allergies || patient.profile?.allergies;
                if (!allergies || allergies.trim() === '') allergies = 'Not Available';
                
                const currentMedicines = [];
                appointments.forEach(a => {
                    if (a.prescriptions && Array.isArray(a.prescriptions)) {
                        a.prescriptions.forEach(p => {
                            if (p.name && !currentMedicines.includes(p.name) && p.type !== 'lab_report') {
                                currentMedicines.push(p.name);
                            }
                        });
                    }
                });

                const recentLabReports = reports ? reports.slice(0, 3).map(r => r.fileName || r.name || 'Medical Report') : [];

                if (totalVisits === 0 && reportsCount === 0) {
                    setHistorySummary("No previous medical history available.");
                } else {
                    setHistorySummary({
                        totalVisits,
                        lastVisitDate,
                        departmentsVisited: departments.length > 0 ? departments : ['Not Available'],
                        reportsAvailable: reportsCount,
                        previousDiagnoses: diagnoses.length > 0 ? diagnoses : ['Not Available'],
                        knownAllergies: allergies,
                        currentMedicines: currentMedicines.length > 0 ? currentMedicines : ['Not Available'],
                        recentLabReports: recentLabReports.length > 0 ? recentLabReports : ['Not Available']
                    });
                }
            } else {
                setHistoryError(res.message || "Failed to fetch patient history.");
            }
        } catch (err) {
            console.error("Generate History error:", err);
            setHistoryError("Failed to fetch patient history.");
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const handleReportSearch = async () => {
        if (!selectedPatient) {
            setReportSearchError("Please select a patient first.");
            return;
        }
        if (!reportSearchQuery.trim()) {
            setReportSearchResults(null);
            setReportSearchError(null);
            return;
        }

        const keyword = reportSearchQuery.trim();
        setReportSearchError(null);
        setReportSearchResults(null);
        Keyboard.dismiss();

        try {
            const res = await reportAPI.searchReports(selectedPatient._id || selectedPatient.patientId, keyword);
            
            if (res.success && res.results && res.results.length > 0) {
                setReportSearchResults(res.results);
            } else {
                setReportSearchError(res.message || "No matching keyword found.");
                setReportSearchResults(null);
            }
        } catch (err) {
            console.error("Search inside reports error:", err);
            setReportSearchError("Failed to search reports. No matching keyword found.");
            setReportSearchResults(null);
        }
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
                
                <View style={styles.aiHeader}>
                    <View style={styles.aiHeaderTop}>
                        <View>
                            <Text style={styles.aiHeaderTitle}>🤖 AI Assistant</Text>
                            <Text style={styles.aiHeaderSubtitle}>Advanced patient insights, automated summaries & real-time analytics</Text>
                        </View>
                        <TouchableOpacity style={styles.aiTokenTrackerBtn} onPress={handleOpenTracker}>
                            <Text style={styles.aiTokenTrackerBtnText}>⚡ AI Token Tracker</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.aiGrid}>
                    {/* Left Column */}
                    <View style={styles.aiColLeft}>
                        {/* Patient Selection Card */}
                        <View style={styles.aiCard}>
                            <View style={styles.aiCardTitleContainer}>
                                <Feather name="user" size={16} color="#0f172a" />
                                <Text style={styles.aiCardTitle}>Select Patient</Text>
                            </View>
                            
                            <View style={styles.searchInputWrapper}>
                                <Feather name="search" size={16} color="#475569" style={styles.searchIcon} />
                                <TextInput 
                                    style={styles.searchInput}
                                    placeholder={isFetchingPatients ? "Loading your patients..." : "Search patient name, ID, or MRN..."}
                                    placeholderTextColor="#94a3b8"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    editable={!isFetchingPatients}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                                        <Text style={styles.clearSearchText}>✕</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {searchQuery.trim().length >= 2 && searchResults.length === 0 && !isFetchingPatients && (
                                <Text style={styles.errorText}>No patient found in your department.</Text>
                            )}

                            {searchResults.length > 0 && (
                                <View style={styles.searchResultsContainer}>
                                    {searchResults.map(p => (
                                        <TouchableOpacity 
                                            key={p._id}
                                            style={styles.searchResultItem}
                                            onPress={() => handleSelectPatient(p)}
                                        >
                                            <Text style={styles.searchResultName}>{p.name}</Text>
                                            <Text style={styles.searchResultSub}>{p.patientId} {p.profile?.mrn ? `| ${p.profile.mrn}` : ''}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            <View style={styles.aiPatientInfo}>
                                <View style={styles.aiInfoRow}>
                                    <Text style={styles.aiInfoLabel}>Name</Text>
                                    <Text style={styles.aiInfoValue}>{selectedPatient ? selectedPatient.name : '-'}</Text>
                                </View>
                                <View style={styles.aiInfoRow}>
                                    <Text style={styles.aiInfoLabel}>MRN / ID</Text>
                                    <Text style={styles.aiInfoValue}>{selectedPatient ? (selectedPatient.profile?.mrn || selectedPatient.patientId || '-') : '-'}</Text>
                                </View>
                                <View style={styles.aiInfoRow}>
                                    <Text style={styles.aiInfoLabel}>Age</Text>
                                    <Text style={styles.aiInfoValue}>{selectedPatient && selectedPatient.profile?.age ? `${selectedPatient.profile.age} Yrs` : '-'}</Text>
                                </View>
                                <View style={styles.aiInfoRow}>
                                    <Text style={styles.aiInfoLabel}>Gender</Text>
                                    <Text style={styles.aiInfoValue}>{selectedPatient && selectedPatient.profile?.gender ? selectedPatient.profile.gender : '-'}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Patient Reports Card */}
                        <View style={styles.aiCard}>
                            <View style={styles.aiCardTitleContainer}>
                                <Feather name="file-text" size={16} color="#0f172a" />
                                <Text style={styles.aiCardTitle}>Patient Reports</Text>
                            </View>
                            
                            {!selectedPatient && (
                                <Text style={styles.emptyStateText}>Please select a patient to view reports.</Text>
                            )}

                            {selectedPatient && isReportsLoading && (
                                <Text style={styles.emptyStateText}>Loading reports...</Text>
                            )}

                            {selectedPatient && !isReportsLoading && reports.length === 0 && (
                                <Text style={styles.emptyStateText}>No reports found for this patient.</Text>
                            )}

                            {selectedPatient && !isReportsLoading && reports.length > 0 && (
                                <View style={styles.aiReportList}>
                                    {reports.map((report) => {
                                        const isSelected = selectedReport && (
                                            (selectedReport._id && report._id && selectedReport._id === report._id) || 
                                            (selectedReport.url && report.url && selectedReport.url === report.url)
                                        );
                                        
                                        return (
                                            <View 
                                                key={report._id || report.url} 
                                                style={[styles.aiReportItem, isSelected && styles.aiReportItemSelected]}
                                            >
                                                <View style={styles.aiReportInfo}>
                                                    <Text style={styles.aiReportName} numberOfLines={1}>
                                                        {report.fileName || report.name || 'Document'}
                                                    </Text>
                                                    <Text style={styles.aiReportDate}>
                                                        {report.uploadedAt ? new Date(report.uploadedAt).toLocaleDateString() : (report.date || '')}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity 
                                                    style={[styles.aiBtnView, isSelected && styles.aiBtnViewSelected]}
                                                    onPress={() => isSelected ? setSelectedReport(null) : setSelectedReport(report)}
                                                >
                                                    <Text style={[styles.aiBtnViewText, isSelected && styles.aiBtnViewTextSelected]}>
                                                        {isSelected ? 'Selected' : 'Select'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>

                        {/* Compare Reports Section */}
                        <View style={styles.aiCard}>
                            <View style={styles.aiCardTitleContainer}>
                                <Text style={styles.aiCardTitle}>📊 Compare Reports</Text>
                            </View>
                            <Text style={styles.subText}>Compare the latest report with the previous one.</Text>
                            
                            <TouchableOpacity 
                                style={[styles.aiBtnPrimary, (!reports || reports.length < 2) ? styles.btnDisabled : (isComparing ? styles.btnLoading : {})]} 
                                onPress={handleCompareReports} 
                                disabled={isComparing || !reports || reports.length < 2}
                            >
                                <Text style={styles.aiBtnPrimaryText}>{isComparing ? 'Comparing...' : 'Compare Latest with Previous'}</Text>
                            </TouchableOpacity>

                            {(!reports || reports.length < 2) && (
                                <Text style={styles.hintText}>"At least two reports are required for comparison."</Text>
                            )}

                            {compareError && (
                                <Text style={styles.errorTextLarge}>{compareError}</Text>
                            )}

                            {comparison && (
                                <View style={styles.aiSummaryContent}>
                                    <View style={styles.comparisonDatesBox}>
                                        <View style={styles.compDateRow}>
                                            <Text style={styles.compDateLabel}>Latest Report</Text>
                                            <Text style={styles.compDateVal}>{comparison.latestDate ? new Date(comparison.latestDate).toLocaleDateString() : 'Unknown Date'}</Text>
                                        </View>
                                        <View style={styles.compDateRowBorder}>
                                            <Text style={styles.compDateLabel}>Previous Report</Text>
                                            <Text style={styles.compDateVal}>{comparison.previousDate ? new Date(comparison.previousDate).toLocaleDateString() : 'Unknown Date'}</Text>
                                        </View>
                                    </View>

                                    {comparison.data.NewFindings && comparison.data.NewFindings.length > 0 && (
                                        <View style={styles.compFindingsBox}>
                                            <Text style={styles.compFindingsTitle}>New Findings</Text>
                                            {comparison.data.NewFindings.map((finding, idx) => (
                                                <Text key={idx} style={styles.compFindingsItem}>• {finding}</Text>
                                            ))}
                                        </View>
                                    )}

                                    {comparison.data.ChangedFindings && comparison.data.ChangedFindings.length > 0 && (
                                        <View style={styles.compFindingsBox}>
                                            <Text style={styles.compFindingsTitle}>Changed Findings</Text>
                                            {comparison.data.ChangedFindings.map((finding, idx) => (
                                                <Text key={idx} style={styles.compFindingsItem}>• {finding}</Text>
                                            ))}
                                        </View>
                                    )}

                                    {comparison.data.RemovedFindings && comparison.data.RemovedFindings.length > 0 && (
                                        <View style={styles.compFindingsBox}>
                                            <Text style={styles.compFindingsTitle}>Removed Findings</Text>
                                            {comparison.data.RemovedFindings.map((finding, idx) => (
                                                <Text key={idx} style={styles.compFindingsItem}>• {finding}</Text>
                                            ))}
                                        </View>
                                    )}

                                    {comparison.data.OverallChange && (
                                        <View style={styles.overallChangeBox}>
                                            <Text style={styles.overallChangeTitle}>Overall Change</Text>
                                            <Text style={styles.overallChangeText}>{comparison.data.OverallChange}</Text>
                                        </View>
                                    )}

                                    {comparison.usage && (
                                        <View style={styles.aiTokenBadge}>
                                            <Text style={styles.tokenBadgeText}>⚡ Tokens: <Text style={styles.boldText}>{comparison.usage.totalTokens}</Text> (In: {comparison.usage.promptTokens} | Out: {comparison.usage.candidateTokens})</Text>
                                            <Text style={styles.tokenBadgeText}>• Est. Cost: <Text style={styles.boldText}>${comparison.usage.estimatedCostUsd?.toFixed(5) || '0.0001'}</Text></Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Patient History Summary Section */}
                        <View style={styles.aiCard}>
                            <View style={styles.historySummaryHeader}>
                                <Text style={styles.aiCardTitle}>📋 Patient History Summary</Text>
                                <TouchableOpacity 
                                    style={styles.aiBtnPrimarySmall} 
                                    onPress={generateHistorySummary} 
                                    disabled={isHistoryLoading || !selectedPatient}
                                >
                                    <Text style={styles.aiBtnPrimaryText}>{isHistoryLoading ? 'Loading...' : '🔄 Refresh Summary'}</Text>
                                </TouchableOpacity>
                            </View>

                            {historyError && (
                                <Text style={styles.errorTextLarge}>{historyError}</Text>
                            )}

                            {!historySummary && !isHistoryLoading && !historyError && (
                                <Text style={styles.emptyStateText}>Click refresh to load patient history summary.</Text>
                            )}

                            {typeof historySummary === 'string' && (
                                <Text style={styles.hintText}>{historySummary}</Text>
                            )}

                            {typeof historySummary === 'object' && historySummary !== null && (
                                <View style={styles.aiSummaryContent}>
                                    <View style={styles.summaryBlock}>
                                        <Text style={styles.summaryBlockTitle}>Overview</Text>
                                        <Text style={styles.summaryBlockItem}>• <Text style={styles.boldText}>Total Visits:</Text> {historySummary.totalVisits}</Text>
                                        <Text style={styles.summaryBlockItem}>• <Text style={styles.boldText}>Last Visit:</Text> {historySummary.lastVisitDate}</Text>
                                        <Text style={styles.summaryBlockItem}>• <Text style={styles.boldText}>Reports:</Text> {historySummary.reportsAvailable}</Text>
                                    </View>

                                    <View style={styles.summaryBlock}>
                                        <Text style={styles.summaryBlockTitle}>Clinical Details</Text>
                                        <Text style={styles.summaryBlockItem}>• <Text style={styles.boldText}>Allergies:</Text> {historySummary.knownAllergies}</Text>
                                        <Text style={styles.summaryBlockItem}>• <Text style={styles.boldText}>Departments:</Text> {historySummary.departmentsVisited.join(', ')}</Text>
                                    </View>

                                    <View style={styles.summaryBlock}>
                                        <Text style={styles.summaryBlockTitle}>Medical History</Text>
                                        <Text style={styles.summaryBlockItem}>• <Text style={styles.boldText}>Diagnoses:</Text></Text>
                                        {historySummary.previousDiagnoses.map((d, i) => <Text key={i} style={styles.nestedSummaryItem}>  - {d}</Text>)}
                                        
                                        <Text style={[styles.summaryBlockItem, {marginTop: 6}]}>• <Text style={styles.boldText}>Medicines:</Text></Text>
                                        {historySummary.currentMedicines.map((m, i) => <Text key={i} style={styles.nestedSummaryItem}>  - {m}</Text>)}
                                        
                                        <Text style={[styles.summaryBlockItem, {marginTop: 6}]}>• <Text style={styles.boldText}>Lab Reports:</Text></Text>
                                        {historySummary.recentLabReports.map((r, i) => <Text key={i} style={styles.nestedSummaryItem}>  - {r}</Text>)}
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Right Column */}
                    <View style={styles.aiColRight}>
                        {/* AI Summary Section */}
                        <View style={styles.aiCard}>
                            <View style={styles.aiCardTitleContainer}>
                                <Text style={styles.aiCardTitle}>🤖 AI Report Summary</Text>
                            </View>
                            <TouchableOpacity 
                                style={[styles.aiBtnPrimary, (isLoading || !selectedReport) && styles.btnDisabled]}
                                onPress={handleGenerateSummary}
                                disabled={isLoading || !selectedReport}
                            >
                                <Text style={styles.aiBtnPrimaryText}>{isLoading ? '⏳ Generating Summary...' : 'Generate Summary'}</Text>
                            </TouchableOpacity>
                            
                            {error && (
                                <Text style={styles.errorTextCenter}>{error}</Text>
                            )}

                            <View style={[styles.aiSummaryBox, summary && styles.aiSummaryBoxActive]}>
                                {!summary && !isLoading && !error && (
                                    <Text style={styles.emptySummaryText}>(No summary generated)</Text>
                                )}
                                
                                {summary && (
                                    <View style={styles.summaryContainer}>
                                        
                                        <View style={styles.summaryBlock}>
                                            <Text style={styles.summaryBlockLabel}>Report Type</Text>
                                            <Text style={styles.summaryBlockValueLarge}>{summary.ReportType}</Text>
                                        </View>

                                        <View style={styles.summaryBlock}>
                                            <Text style={styles.summaryBlockLabel}>Overall Summary</Text>
                                            <Text style={styles.summaryBlockValue}>{summary.OverallSummary}</Text>
                                        </View>

                                        <View style={styles.summaryBlock}>
                                            <Text style={styles.summaryBlockLabel}>Important Findings</Text>
                                            {summary.ImportantFindings?.map((finding, idx) => (
                                                <Text key={idx} style={styles.summaryListItem}>• {finding}</Text>
                                            ))}
                                        </View>

                                        {summary.AbnormalValues && summary.AbnormalValues.length > 0 && (
                                            <View style={styles.abnormalBlock}>
                                                <Text style={styles.abnormalBlockLabel}>Abnormal Findings</Text>
                                                {summary.AbnormalValues.map((val, idx) => (
                                                    <Text key={idx} style={styles.abnormalListItem}>• {val}</Text>
                                                ))}
                                            </View>
                                        )}

                                        {/* Real-time Token Consumption Badge */}
                                        {summaryUsage && (
                                            <View style={styles.aiTokenBadge}>
                                                <Text style={styles.tokenBadgeText}>⚡ Tokens: <Text style={styles.boldText}>{summaryUsage.totalTokens}</Text> (In: {summaryUsage.promptTokens} | Out: {summaryUsage.candidateTokens})</Text>
                                                <Text style={styles.tokenBadgeText}>• Model: <Text style={styles.codeText}>{summaryUsage.modelName || 'gemini-1.5-flash'}</Text></Text>
                                                <Text style={styles.tokenBadgeText}>• Est. Cost: <Text style={styles.boldText}>${summaryUsage.estimatedCostUsd?.toFixed(5) || '0.00008'}</Text> (~₹{summaryUsage.estimatedCostInr?.toFixed(3) || '0.007'})</Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        </View>


                        {/* Search Inside Reports Section */}
                        <View style={styles.aiCard}>
                            <View style={styles.aiCardTitleContainer}>
                                <Feather name="search" size={16} color="#0f172a" />
                                <Text style={styles.aiCardTitle}>Search Inside Reports</Text>
                            </View>
                            
                            <View style={styles.reportSearchInputWrapper}>
                                <Feather name="search" size={18} color="#475569" style={styles.searchIconLarge} />
                                <TextInput 
                                    style={styles.reportSearchInput}
                                    placeholder="Search inside patient's reports..."
                                    placeholderTextColor="#94a3b8"
                                    value={reportSearchQuery}
                                    onChangeText={setReportSearchQuery}
                                    onSubmitEditing={handleReportSearch}
                                    editable={!!selectedPatient}
                                />
                                {reportSearchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setReportSearchQuery('')} style={styles.clearSearchBtnLarge}>
                                        <Text style={styles.clearSearchTextLarge}>✕</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            
                            <View style={styles.reportSearchResultsWrapper}>
                                {reportSearchError && (
                                    <Text style={styles.reportSearchErrorText}>{reportSearchError}</Text>
                                )}

                                {!reportSearchResults && !reportSearchError && (
                                    <Text style={styles.emptyStateText}>(No results)</Text>
                                )}

                                {reportSearchResults && reportSearchResults.length > 0 && (
                                    <View>
                                        <Text style={styles.reportSearchMatchTitle}>
                                            Found matches for "{reportSearchQuery}"
                                        </Text>
                                        
                                        <View style={styles.reportSearchList}>
                                            {reportSearchResults.map((result, idx) => (
                                                <View key={idx} style={styles.reportSearchResultCard}>
                                                    <View style={styles.rsCardHeader}>
                                                        <Text style={styles.rsCardName}>{result.reportName}</Text>
                                                        <View style={styles.rsCardPageBadge}>
                                                            <Text style={styles.rsCardPageText}>Page: {result.pageNumber}</Text>
                                                        </View>
                                                    </View>
                                                    <View style={styles.rsCardBody}>
                                                        <HighlightKeyword text={result.match} keyword={result.keyword} />
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* ── AI Clinical Assistant Chat ── */}
                        <View style={styles.aiCard}>
                            <View style={styles.aiCardTitleContainer}>
                                <Text style={styles.aiCardTitle}>💬 AI Clinical Assistant</Text>
                            </View>

                            {!selectedPatient ? (
                                <View style={styles.chatDisabledState}>
                                    <Text style={styles.chatDisabledIcon}>🔒</Text>
                                    <Text style={styles.chatDisabledText}>Please select a patient first.</Text>
                                </View>
                            ) : (
                                <>
                                    {/* Conversation Area */}
                                    <ScrollView 
                                        ref={chatScrollViewRef}
                                        style={styles.chatMessagesArea}
                                        contentContainerStyle={styles.chatMessagesContent}
                                    >
                                        {chatMessages.length === 0 && !isChatLoading && (
                                            <View style={styles.chatEmptyState}>
                                                <Text style={styles.chatEmptyIcon}>🤖</Text>
                                                <Text style={styles.chatEmptyTitle}>Start a clinical conversation about your patient.</Text>
                                                <Text style={styles.chatEmptySub}>AI answers based on selected patient data, reports & medical history only.</Text>
                                            </View>
                                        )}

                                        {chatMessages.map((msg, idx) => (
                                            <View key={idx} style={[styles.chatBubbleContainer, msg.role === 'doctor' ? styles.chatBubbleRight : styles.chatBubbleLeft]}>
                                                <View style={styles.chatBubbleHeader}>
                                                    <Text style={[styles.chatRoleTag, msg.role === 'doctor' ? styles.chatRoleTagDoctor : styles.chatRoleTagAI]}>
                                                        {msg.role === 'doctor' ? '🩺 You' : '🤖 AI'}
                                                    </Text>
                                                    <Text style={styles.chatTimeTag}>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                                </View>
                                                <Text style={[styles.chatBubbleText, msg.role === 'doctor' ? styles.chatBubbleTextDoctor : styles.chatBubbleTextAI]}>
                                                    {msg.text}
                                                </Text>
                                                {msg.usage && (
                                                    <Text style={styles.chatTokenTag}>
                                                        ⚡ {msg.usage.totalTokens} tokens (${msg.usage.estimatedCostUsd?.toFixed(5) || '0.00005'})
                                                    </Text>
                                                )}
                                            </View>
                                        ))}

                                        {isChatLoading && (
                                            <View style={[styles.chatBubbleContainer, styles.chatBubbleLeft]}>
                                                <View style={styles.chatBubbleHeader}>
                                                    <Text style={[styles.chatRoleTag, styles.chatRoleTagAI]}>🤖 AI</Text>
                                                </View>
                                                <View style={styles.typingIndicator}>
                                                    <View style={styles.typingDot} />
                                                    <View style={styles.typingDot} />
                                                    <View style={styles.typingDot} />
                                                </View>
                                            </View>
                                        )}
                                    </ScrollView>

                                    {/* Quick Suggestion Chips */}
                                    <View style={styles.chatChipsContainer}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chatChipsScroll}>
                                            {CHAT_SUGGESTIONS.map((chip, i) => (
                                                <TouchableOpacity key={i} style={styles.chatChip} onPress={() => handleChatSend(chip)}>
                                                    <Text style={styles.chatChipText}>{chip}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>

                                    {/* Input Area */}
                                    <View style={styles.chatInputArea}>
                                        <TextInput
                                            style={styles.chatInput}
                                            placeholder="Type your clinical question..."
                                            placeholderTextColor="#94a3b8"
                                            value={chatInput}
                                            onChangeText={setChatInput}
                                            multiline={true}
                                        />
                                        <TouchableOpacity
                                            style={[styles.chatSendBtn, (!chatInput.trim() || isChatLoading) && styles.btnDisabled]}
                                            onPress={() => handleChatSend()}
                                            disabled={!chatInput.trim() || isChatLoading}
                                        >
                                            <Text style={styles.chatSendBtnText}>Send</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* ── AI Token Tracker & Analytics Modal ── */}
            <Modal visible={isTrackerOpen} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.trackerModal}>
                        <View style={styles.trackerHeader}>
                            <View style={styles.trackerTitleContainer}>
                                <Text style={styles.trackerTitle}>⚡ AI Token Usage & Cost Analytics</Text>
                            </View>
                            <TouchableOpacity style={styles.trackerCloseBtn} onPress={() => setIsTrackerOpen(false)}>
                                <Text style={styles.trackerCloseBtnText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.trackerBody}>
                            {isTrackerLoading && !trackerStats && (
                                <Text style={styles.trackerLoadingText}>Loading live token analytics...</Text>
                            )}

                            {trackerStats && (
                                <>
                                    {/* KPI Summary Cards */}
                                    <View style={styles.trackerKpiGrid}>
                                        <View style={[styles.trackerKpiCard, styles.trackerKpiCardHighlight]}>
                                            <Text style={styles.trackerKpiTitle}>Total Tokens Used</Text>
                                            <Text style={styles.trackerKpiValue}>{trackerStats.totalTokens ? Number(trackerStats.totalTokens).toLocaleString() : '0'}</Text>
                                            <Text style={styles.trackerKpiSub}>Prompt: {Number(trackerStats.totalPromptTokens || 0).toLocaleString()} | Candidate: {Number(trackerStats.totalCandidateTokens || 0).toLocaleString()}</Text>
                                        </View>

                                        <View style={styles.trackerKpiCard}>
                                            <Text style={styles.trackerKpiTitle}>Total Estimated Cost</Text>
                                            <Text style={[styles.trackerKpiValue, {color: '#16a34a'}]}>${trackerStats.totalCostUsd ? trackerStats.totalCostUsd.toFixed(4) : '0.0000'}</Text>
                                            <Text style={styles.trackerKpiSub}>≈ ₹{trackerStats.totalCostInr ? trackerStats.totalCostInr.toFixed(2) : '0.00'} INR</Text>
                                        </View>

                                        <View style={styles.trackerKpiCard}>
                                            <Text style={styles.trackerKpiTitle}>Today's Usage</Text>
                                            <Text style={styles.trackerKpiValue}>{trackerStats.todayTokens ? Number(trackerStats.todayTokens).toLocaleString() : '0'}</Text>
                                            <Text style={styles.trackerKpiSub}>{trackerStats.todayRequests || 0} requests today (${(trackerStats.todayCostUsd || 0).toFixed(4)})</Text>
                                        </View>

                                        <View style={styles.trackerKpiCard}>
                                            <Text style={styles.trackerKpiTitle}>Total AI Calls</Text>
                                            <Text style={styles.trackerKpiValue}>{trackerStats.totalRequests || 0}</Text>
                                            <Text style={styles.trackerKpiSub}>Active model: gemini-1.5-flash</Text>
                                        </View>
                                    </View>

                                    {/* Action Type Breakdown */}
                                    {trackerStats.actionBreakdown && trackerStats.actionBreakdown.length > 0 && (
                                        <View style={styles.trackerBreakdownBox}>
                                            <Text style={styles.trackerBreakdownTitle}>Activity Breakdown</Text>
                                            <View style={styles.trackerBreakdownTags}>
                                                {trackerStats.actionBreakdown.map((item, i) => (
                                                    <View key={i} style={styles.trackerBreakdownTag}>
                                                        <Text style={styles.breakdownTagLabel}>{item.actionType.replace('_', ' ')}:</Text>
                                                        <Text style={styles.breakdownTagVal}>{item.count} calls</Text>
                                                        <Text style={styles.breakdownTagVal}>• {Number(item.tokens).toLocaleString()} tokens</Text>
                                                        <Text style={styles.breakdownTagVal}>(${item.costUsd.toFixed(4)})</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}

                                    {/* Recent Activity Log Table (Simulated for Mobile) */}
                                    <View>
                                        <View style={styles.trackerTableTitleRow}>
                                            <Text style={styles.trackerTableTitle}>Recent AI Invocations</Text>
                                            <TouchableOpacity style={styles.trackerRefreshBtn} onPress={fetchTrackerData}>
                                                <Text style={styles.trackerRefreshBtnText}>🔄 Refresh</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.trackerTableContainer}>
                                            {trackerLogs.length === 0 ? (
                                                <Text style={styles.trackerEmptyTableText}>No AI requests recorded yet. Generate a summary or ask a chat question to see live tokens!</Text>
                                            ) : (
                                                trackerLogs.map((log) => {
                                                    let badgeStyle = styles.aiActionSummary;
                                                    let badgeTextStyle = styles.aiActionSummaryText;
                                                    if (log.actionType === 'CLINICAL_CHAT') { badgeStyle = styles.aiActionChat; badgeTextStyle = styles.aiActionChatText; }
                                                    if (log.actionType === 'REPORT_COMPARISON') { badgeStyle = styles.aiActionCompare; badgeTextStyle = styles.aiActionCompareText; }
                                                    if (log.actionType === 'OCR_EXTRACTION') { badgeStyle = styles.aiActionOcr; badgeTextStyle = styles.aiActionOcrText; }

                                                    return (
                                                        <View key={log._id} style={styles.trackerTableRow}>
                                                            <View style={styles.trackerTableRowTop}>
                                                                <Text style={styles.trackerLogTime}>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
                                                                <View style={[styles.trackerActionBadge, badgeStyle]}>
                                                                    <Text style={[styles.trackerActionBadgeText, badgeTextStyle]}>{log.actionType.replace('_', ' ')}</Text>
                                                                </View>
                                                                <Text style={styles.trackerLogCost}>${(log.estimatedCostUsd || 0).toFixed(5)}</Text>
                                                            </View>
                                                            <View style={styles.trackerTableRowBottom}>
                                                                <Text style={styles.trackerLogModel}>{log.modelName || 'gemini-1.5-flash'}</Text>
                                                                <Text style={styles.trackerLogTokens}>Tokens: <Text style={styles.boldText}>{log.totalTokens || 0}</Text> (In: {log.promptTokens || 0} | Out: {log.candidateTokens || 0})</Text>
                                                            </View>
                                                        </View>
                                                    );
                                                })
                                            )}
                                        </View>
                                    </View>
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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
        padding: 24,
    },
    aiHeader: {
        marginBottom: 24,
        padding: 32,
        paddingHorizontal: 40,
        borderRadius: 16,
        backgroundColor: '#7c3aed',
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 25,
        elevation: 10,
        overflow: 'hidden',
    },
    aiHeaderTop: {
        flexDirection: isTablet ? 'row' : 'column',
        justifyContent: 'space-between',
        alignItems: isTablet ? 'center' : 'flex-start',
        zIndex: 1,
    },
    aiHeaderTitle: {
        fontSize: 28,
        color: 'white',
        fontWeight: 'bold',
        marginBottom: 8,
    },
    aiHeaderSubtitle: {
        color: '#e0e7ff',
        fontSize: 16,
        marginBottom: isTablet ? 0 : 16,
    },
    aiTokenTrackerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderColor: 'rgba(255, 255, 255, 0.4)',
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12,
    },
    aiTokenTrackerBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    aiGrid: {
        flexDirection: isTablet ? 'row' : 'column',
    },
    aiColLeft: {
        width: isTablet ? 370 : '100%',
        marginRight: isTablet ? 24 : 0,
        marginBottom: isTablet ? 0 : 24,
    },
    aiColRight: {
        flex: 1,
    },
    aiCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    aiCardTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
        paddingBottom: 12,
        marginBottom: 16,
    },
    aiCardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        marginLeft: 8,
    },
    searchInputWrapper: {
        position: 'relative',
        justifyContent: 'center',
    },
    searchIcon: {
        position: 'absolute',
        left: 14,
        zIndex: 1,
    },
    searchInput: {
        width: '100%',
        paddingVertical: 11,
        paddingLeft: 42,
        paddingRight: 32,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 12,
        color: '#0f172a',
        fontSize: 14,
    },
    clearSearchBtn: {
        position: 'absolute',
        right: 12,
        padding: 4,
    },
    clearSearchText: {
        color: '#64748b',
        fontSize: 16,
    },
    errorText: {
        color: 'red',
        marginTop: 8,
        fontSize: 14,
    },
    errorTextCenter: {
        color: 'red',
        marginTop: 10,
        marginBottom: 16,
        fontSize: 14,
        textAlign: 'center',
    },
    errorTextLarge: {
        color: '#dc2626',
        marginTop: 16,
        fontSize: 14,
        textAlign: 'center',
    },
    searchResultsContainer: {
        marginTop: 8,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        maxHeight: 200,
        overflow: 'hidden',
    },
    searchResultItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchResultName: {
        fontWeight: 'bold',
        color: '#0f172a',
    },
    searchResultSub: {
        fontSize: 12,
        color: '#64748b',
    },
    aiPatientInfo: {
        marginTop: 20,
    },
    aiInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    aiInfoLabel: {
        color: '#64748b',
        fontSize: 14,
    },
    aiInfoValue: {
        color: '#1e293b',
        fontWeight: 'bold',
        fontSize: 14,
    },
    emptyStateText: {
        color: '#64748b',
        fontSize: 14,
        textAlign: 'center',
        paddingVertical: 20,
    },
    aiReportList: {
        marginTop: 12,
    },
    aiReportItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        marginBottom: 12,
    },
    aiReportItemSelected: {
        borderColor: '#8b5cf6',
        backgroundColor: '#f3e8ff',
    },
    aiReportInfo: {
        flex: 1,
        marginRight: 12,
    },
    aiReportName: {
        fontWeight: 'bold',
        color: '#0f172a',
        fontSize: 14,
    },
    aiReportDate: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },
    aiBtnView: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
    },
    aiBtnViewSelected: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    aiBtnViewText: {
        color: '#475569',
        fontSize: 13,
    },
    aiBtnViewTextSelected: {
        color: 'white',
    },
    subText: {
        color: '#64748b',
        fontSize: 14,
        marginBottom: 16,
    },
    hintText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
    },
    aiBtnPrimary: {
        width: '100%',
        paddingVertical: 12,
        backgroundColor: '#3b82f6',
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    aiBtnPrimarySmall: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#3b82f6',
        borderRadius: 6,
        alignItems: 'center',
        width: '100%',
    },
    aiBtnPrimaryText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    btnDisabled: {
        opacity: 0.5,
    },
    btnLoading: {
        opacity: 0.7,
    },
    aiSummaryContent: {
        marginTop: 20,
    },
    comparisonDatesBox: {
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    compDateRow: {
        paddingBottom: 8,
    },
    compDateRowBorder: {
        paddingTop: 8,
        borderTopWidth: 1,
        borderColor: '#e2e8f0',
    },
    compDateLabel: {
        fontSize: 12,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    compDateVal: {
        fontWeight: 'bold',
        color: '#0f172a',
        marginTop: 4,
    },
    compFindingsBox: {
        marginBottom: 16,
    },
    compFindingsTitle: {
        color: '#0f172a',
        marginBottom: 8,
        fontSize: 14,
        fontWeight: 'bold',
    },
    compFindingsItem: {
        color: '#334155',
        fontSize: 13,
        marginBottom: 4,
        paddingLeft: 10,
    },
    overallChangeBox: {
        backgroundColor: '#f0f9ff',
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#bae6fd',
    },
    overallChangeTitle: {
        color: '#0369a1',
        marginBottom: 8,
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: 'bold',
    },
    overallChangeText: {
        color: '#0c4a6e',
        fontSize: 13,
        lineHeight: 20,
    },
    historySummaryHeader: {
        marginBottom: 16,
    },
    summaryBlock: {
        backgroundColor: '#f8fafc',
        padding: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 12,
    },
    summaryBlockTitle: {
        color: '#0f172a',
        marginBottom: 10,
        fontSize: 13,
        fontWeight: 'bold',
    },
    summaryBlockItem: {
        color: '#334155',
        fontSize: 13,
        marginBottom: 6,
    },
    nestedSummaryItem: {
        color: '#334155',
        fontSize: 13,
        paddingLeft: 16,
        marginBottom: 4,
    },
    boldText: {
        fontWeight: 'bold',
    },
    aiSummaryBox: {
        padding: 24,
        marginTop: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#b0b9fd',
        borderStyle: 'dashed',
        backgroundColor: '#fbfbfe',
        alignItems: 'center',
    },
    aiSummaryBoxActive: {
        borderWidth: 0,
        backgroundColor: '#ffffff',
        alignItems: 'stretch',
    },
    emptySummaryText: {
        color: '#6b78e6',
        fontSize: 14,
    },
    summaryContainer: {
        gap: 16,
    },
    summaryBlockLabel: {
        color: '#334155',
        marginBottom: 8,
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: 'bold',
    },
    summaryBlockValueLarge: {
        color: '#0f172a',
        fontSize: 15,
        fontWeight: 'bold',
    },
    summaryBlockValue: {
        color: '#0f172a',
        fontSize: 14,
        lineHeight: 21,
    },
    summaryListItem: {
        color: '#0f172a',
        fontSize: 14,
        marginBottom: 6,
        paddingLeft: 10,
    },
    abnormalBlock: {
        backgroundColor: '#fef2f2',
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    abnormalBlockLabel: {
        color: '#dc2626',
        marginBottom: 12,
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: 'bold',
    },
    abnormalListItem: {
        color: '#991b1b',
        fontSize: 14,
        marginBottom: 6,
        paddingLeft: 10,
    },
    aiTokenBadge: {
        flexDirection: 'column',
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        padding: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginTop: 12,
        gap: 4,
    },
    tokenBadgeText: {
        color: '#334155',
        fontSize: 13,
    },
    codeText: {
        backgroundColor: '#e2e8f0',
        color: '#6b21a8',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    reportSearchInputWrapper: {
        position: 'relative',
        justifyContent: 'center',
        marginTop: 12,
    },
    searchIconLarge: {
        position: 'absolute',
        left: 14,
        zIndex: 1,
    },
    reportSearchInput: {
        width: '100%',
        paddingVertical: 14,
        paddingLeft: 44,
        paddingRight: 32,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 12,
        color: '#0f172a',
        fontSize: 16,
    },
    clearSearchBtnLarge: {
        position: 'absolute',
        right: 14,
        padding: 4,
    },
    clearSearchTextLarge: {
        color: '#64748b',
        fontSize: 18,
    },
    reportSearchResultsWrapper: {
        marginTop: 24,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
        borderRadius: 8,
        padding: 24,
    },
    reportSearchErrorText: {
        color: '#64748b',
        fontSize: 15,
        textAlign: 'center',
    },
    reportSearchMatchTitle: {
        color: '#0f172a',
        marginBottom: 16,
        fontSize: 15,
        fontWeight: 'bold',
    },
    reportSearchList: {
        gap: 16,
    },
    reportSearchResultCard: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    rsCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
        paddingBottom: 12,
    },
    rsCardName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    rsCardPageBadge: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    rsCardPageText: {
        fontSize: 13,
        color: '#475569',
        fontWeight: 'bold',
    },
    rsCardBody: {
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderColor: '#8b5cf6',
    },
    resultText: {
        fontSize: 15,
        color: '#334155',
        lineHeight: 24,
    },
    highlightedText: {
        backgroundColor: '#fef08a',
        color: '#166534',
        fontWeight: 'bold',
    },
    chatDisabledState: {
        alignItems: 'center',
        paddingVertical: 48,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        borderRadius: 12,
    },
    chatDisabledIcon: {
        fontSize: 28,
        marginBottom: 8,
    },
    chatDisabledText: {
        color: '#94a3b8',
        fontSize: 15,
    },
    chatMessagesArea: {
        height: 420,
        paddingHorizontal: 4,
    },
    chatMessagesContent: {
        paddingVertical: 16,
        gap: 14,
    },
    chatEmptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    chatEmptyIcon: {
        fontSize: 36,
        marginBottom: 6,
    },
    chatEmptyTitle: {
        fontSize: 15,
        color: '#64748b',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    chatEmptySub: {
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
    },
    chatBubbleContainer: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        maxWidth: '85%',
    },
    chatBubbleRight: {
        alignSelf: 'flex-end',
        backgroundColor: '#3249fd',
        borderBottomRightRadius: 4,
    },
    chatBubbleLeft: {
        alignSelf: 'flex-start',
        backgroundColor: '#f1f5f9',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    chatBubbleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    chatRoleTag: {
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 0.3,
    },
    chatRoleTagDoctor: {
        color: 'rgba(255,255,255,0.85)',
    },
    chatRoleTagAI: {
        color: '#64748b',
    },
    chatTimeTag: {
        fontSize: 11,
        opacity: 0.6,
        color: '#ffffff',
    },
    chatBubbleText: {
        fontSize: 14,
        lineHeight: 23,
    },
    chatBubbleTextDoctor: {
        color: '#ffffff',
    },
    chatBubbleTextAI: {
        color: '#1e293b',
    },
    chatTokenTag: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 4,
        opacity: 0.85,
    },
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        gap: 5,
    },
    typingDot: {
        width: 8,
        height: 8,
        backgroundColor: '#94a3b8',
        borderRadius: 4,
    },
    chatChipsContainer: {
        borderTopWidth: 1,
        borderColor: '#f1f5f9',
        paddingVertical: 12,
    },
    chatChipsScroll: {
        gap: 8,
    },
    chatChip: {
        paddingVertical: 7,
        paddingHorizontal: 14,
        backgroundColor: '#f0f4ff',
        borderWidth: 1,
        borderColor: '#d4dafe',
        borderRadius: 20,
    },
    chatChipText: {
        color: '#3249fd',
        fontSize: 13,
        fontWeight: 'bold',
    },
    chatInputArea: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
        paddingTop: 12,
        borderTopWidth: 1,
        borderColor: '#f1f5f9',
    },
    chatInput: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 12,
        fontSize: 14,
        color: '#1e293b',
        backgroundColor: '#f8fafc',
        maxHeight: 120,
    },
    chatSendBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#3249fd',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatSendBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    trackerModal: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        width: '100%',
        maxWidth: 850,
        maxHeight: '88%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 25 },
        shadowOpacity: 0.25,
        shadowRadius: 50,
        elevation: 20,
    },
    trackerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
        backgroundColor: '#f8fafc',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    trackerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    trackerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    trackerCloseBtn: {
        padding: 8,
    },
    trackerCloseBtnText: {
        fontSize: 24,
        color: '#64748b',
    },
    trackerBody: {
        padding: 24,
    },
    trackerLoadingText: {
        textAlign: 'center',
        paddingVertical: 40,
        color: '#64748b',
    },
    trackerKpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
    },
    trackerKpiCard: {
        flex: 1,
        minWidth: 180,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 16,
        gap: 6,
    },
    trackerKpiCardHighlight: {
        backgroundColor: '#f5f3ff',
        borderColor: '#c4b5fd',
    },
    trackerKpiTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    trackerKpiValue: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0f172a',
    },
    trackerKpiSub: {
        fontSize: 12,
        color: '#64748b',
    },
    trackerBreakdownBox: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 16,
        marginBottom: 24,
    },
    trackerBreakdownTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#334155',
        marginBottom: 12,
    },
    trackerBreakdownTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    trackerBreakdownTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
        gap: 8,
    },
    breakdownTagLabel: {
        fontWeight: 'bold',
        color: '#334155',
        fontSize: 13,
    },
    breakdownTagVal: {
        color: '#334155',
        fontSize: 13,
    },
    trackerTableTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    trackerTableTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    trackerRefreshBtn: {
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 6,
        paddingVertical: 4,
        paddingHorizontal: 10,
    },
    trackerRefreshBtnText: {
        fontSize: 12,
        color: '#0f172a',
    },
    trackerTableContainer: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        overflow: 'hidden',
    },
    trackerEmptyTableText: {
        textAlign: 'center',
        color: '#64748b',
        padding: 20,
    },
    trackerTableRow: {
        borderBottomWidth: 1,
        borderColor: '#f1f5f9',
        padding: 12,
    },
    trackerTableRowTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    trackerTableRowBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    trackerLogTime: {
        color: '#64748b',
        fontSize: 13,
    },
    trackerActionBadge: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    trackerActionBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    aiActionSummary: { backgroundColor: '#dbeafe' }, aiActionSummaryText: { color: '#1e40af' },
    aiActionChat: { backgroundColor: '#f3e8ff' }, aiActionChatText: { color: '#6b21a8' },
    aiActionCompare: { backgroundColor: '#fef3c7' }, aiActionCompareText: { color: '#92400e' },
    aiActionOcr: { backgroundColor: '#dcfce7' }, aiActionOcrText: { color: '#166534' },
    trackerLogCost: {
        color: '#16a34a',
        fontWeight: 'bold',
    },
    trackerLogModel: {
        fontSize: 11,
        color: '#475569',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    trackerLogTokens: {
        fontSize: 12,
        color: '#334155',
    }
});

export default AIAssistant;
