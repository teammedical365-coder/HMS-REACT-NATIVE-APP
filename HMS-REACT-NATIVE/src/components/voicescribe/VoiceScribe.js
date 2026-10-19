import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { voiceScribeAPI } from '../../utils/api';

const inputLanguages = [
    { code: 'auto', label: '🌐 Auto-Detect (Hindi / English / Mixed)' },
    { code: 'en-IN', label: 'English (India)' },
    { code: 'hi-IN', label: 'Hindi (हिंदी)' },
    { code: 'bn-IN', label: 'Bengali (বাংলা)' },
    { code: 'mr-IN', label: 'Marathi (मराठी)' },
    { code: 'gu-IN', label: 'Gujarati (ગુજરાતી)' },
    { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
    { code: 'te-IN', label: 'Telugu (తెలుగు)' },
    { code: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)' },
    { code: 'pa-IN', label: 'Punjabi (ਪੰਜਾਬੀ)' },
    { code: 'ml-IN', label: 'Malayalam (മലയാളം)' },
];

const outputLanguages = [
    'English',
    'Hindi',
    'Bengali',
    'Marathi',
    'Gujarati',
    'Tamil',
    'Telugu',
    'Kannada',
    'Punjabi',
    'Malayalam'
];

const VoiceScribe = ({
    appointmentId,
    patientId,
    patient,
    appointment,
    sessionData,
    setSessionData,
    isLocked = false
}) => {
    const [selectedInputLang, setSelectedInputLang] = useState('auto');
    const [selectedOutputLang, setSelectedOutputLang] = useState('English');
    const [uiStatus, setUiStatus] = useState('IDLE'); // IDLE | RECORDING | PROCESSING | REVIEW | APPROVED | ERROR
    const [recordingTime, setRecordingTime] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [serverRecordId, setServerRecordId] = useState(null);

    // Live transcript & consultation text
    const [consultationText, setConsultationText] = useState('');
    const [audioFile, setAudioFile] = useState(null);
    const [recordedAudioUri, setRecordedAudioUri] = useState(null);

    // Analysis results
    const [analysisData, setAnalysisData] = useState({
        transcript: '',
        clinicalSummary: {
            chiefComplaint: [],
            historyOfPresentIllness: '',
            symptoms: [],
            vitalsMentioned: [],
            examinationFindings: [],
            assessment: [],
            plan: [],
            followUp: ''
        },
        soap: {
            subjective: '',
            objective: '',
            assessment: '',
            plan: ''
        }
    });

    const [submittingAction, setSubmittingAction] = useState(false);
    const timerRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingRef = useRef(null);

    // Load existing record for appointment if present
    useEffect(() => {
        if (appointmentId) {
            voiceScribeAPI.getForAppointment(appointmentId)
                .then(res => {
                    if (res && res.success && res.data) {
                        const record = res.data;
                        setServerRecordId(record._id);
                        if (record.analysis) {
                            setAnalysisData(record.analysis);
                            setUiStatus(record.status === 'APPROVED' ? 'APPROVED' : 'REVIEW');
                        }
                    }
                })
                .catch(() => {});
        }
    }, [appointmentId]);

    // Timer fallback effect
    useEffect(() => {
        if (uiStatus === 'RECORDING') {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [uiStatus]);

    // Resource cleanup on component unmount
    useEffect(() => {
        return () => {
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync()
                    .then(() => {
                        const uri = recordingRef.current?.getURI();
                        if (uri) {
                            FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
                        }
                    })
                    .catch(() => {});
            }
            if (recordedAudioUri) {
                FileSystem.deleteAsync(recordedAudioUri, { idempotent: true }).catch(() => {});
            }
        };
    }, [recordedAudioUri]);

    // Format seconds
    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Start Recording (Native expo-av hardware microphone or Web MediaRecorder fallback)
    const handleStartRecording = async () => {
        setErrorMessage('');
        setStatusMessage('');

        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new window.MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.start(250);
                setUiStatus('RECORDING');
                setRecordingTime(0);
                setStatusMessage('Recording consultation audio live in browser...');
            } catch (err) {
                console.warn('Web microphone access error:', err);
                Alert.alert('Microphone Access Notice', 'Web microphone access denied or not supported. You can enter or paste the consultation transcript directly below.');
                setErrorMessage('Microphone access denied. You may dictate or type notes manually.');
            }
        } else {
            // Native Android / iOS recording via expo-av
            try {
                const permission = await Audio.requestPermissionsAsync();
                if (!permission.granted) {
                    Alert.alert(
                        'Microphone Permission Required',
                        'VoiceScribe requires microphone access to record doctor-patient consultations for clinical transcription. Please allow microphone access in device settings, or dictate/paste notes manually.'
                    );
                    setErrorMessage('Microphone permission denied. Enter notes manually below.');
                    return;
                }

                // Audio session configuration for clinical speech capture
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: false,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false,
                });

                // Clear any leftover recording resource
                if (recordingRef.current) {
                    try {
                        await recordingRef.current.stopAndUnloadAsync();
                    } catch (_) {}
                    recordingRef.current = null;
                }
                if (recordedAudioUri) {
                    FileSystem.deleteAsync(recordedAudioUri, { idempotent: true }).catch(() => {});
                    setRecordedAudioUri(null);
                }

                // Create and begin native recording with progress callback
                const { recording } = await Audio.Recording.createAsync(
                    Audio.RecordingOptionsPresets.HIGH_QUALITY,
                    (status) => {
                        if (status?.isRecording && status.durationMillis !== undefined) {
                            setRecordingTime(Math.floor(status.durationMillis / 1000));
                        }
                    },
                    500
                );

                recordingRef.current = recording;
                setUiStatus('RECORDING');
                setRecordingTime(0);
                setStatusMessage('Recording consultation audio live via native microphone...');
            } catch (err) {
                console.error('Failed to start native microphone recording:', err);
                const msg = err?.message || 'Could not access device microphone. Please check permissions.';
                setErrorMessage(msg);
                Alert.alert('Microphone Error', msg);
            }
        }
    };

    // Stop and finalize recording
    const handleStopRecording = async () => {
        if (Platform.OS === 'web' && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.stop();
                if (mediaRecorderRef.current.stream) {
                    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
                }
            } catch (_) {}
            setUiStatus('IDLE');
            setStatusMessage('Web recording finished. Ready to analyze.');
        } else if (recordingRef.current) {
            try {
                await recordingRef.current.stopAndUnloadAsync();
                const uri = recordingRef.current.getURI();
                recordingRef.current = null;
                if (uri) {
                    setRecordedAudioUri(uri);
                    setStatusMessage(`Audio captured (${formatTime(recordingTime)}). Ready to generate clinical analysis.`);
                }
            } catch (err) {
                console.error('Failed to stop native recording:', err);
                setErrorMessage('Error stopping audio recording: ' + err.message);
            }
            setUiStatus('IDLE');
        } else {
            setUiStatus('IDLE');
        }
    };

    // Cancel recording safely and clean up temporary audio files
    const handleCancelRecording = async () => {
        if (Platform.OS === 'web' && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.stop();
                if (mediaRecorderRef.current.stream) {
                    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
                }
            } catch (_) {}
            audioChunksRef.current = [];
        } else if (recordingRef.current) {
            try {
                await recordingRef.current.stopAndUnloadAsync();
                const uri = recordingRef.current.getURI();
                recordingRef.current = null;
                if (uri) {
                    await FileSystem.deleteAsync(uri, { idempotent: true });
                }
            } catch (_) {}
        }

        if (recordedAudioUri) {
            FileSystem.deleteAsync(recordedAudioUri, { idempotent: true }).catch(() => {});
            setRecordedAudioUri(null);
        }

        setUiStatus('IDLE');
        setRecordingTime(0);
        setStatusMessage('Recording cancelled.');
    };

    // Pick Audio File fallback
    const handlePickAudioFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['audio/*', 'video/*'],
                copyToCacheDirectory: true
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setAudioFile(result.assets[0]);
                // Clear any live recording if a file is attached
                if (recordedAudioUri) {
                    FileSystem.deleteAsync(recordedAudioUri, { idempotent: true }).catch(() => {});
                    setRecordedAudioUri(null);
                }
                setStatusMessage(`Audio file attached: ${result.assets[0].name}`);
            }
        } catch (err) {
            console.error('File pick error:', err);
        }
    };

    // Clear recorded audio
    const handleClearRecordedAudio = async () => {
        if (recordedAudioUri) {
            await FileSystem.deleteAsync(recordedAudioUri, { idempotent: true }).catch(() => {});
            setRecordedAudioUri(null);
            setStatusMessage('Recorded audio removed.');
        }
    };

    // Analyze Audio / Consultation Text
    const handleAnalyze = async () => {
        if (!consultationText.trim() && !audioFile && !recordedAudioUri && audioChunksRef.current.length === 0) {
            Alert.alert('Audio or Dictation Required', 'Please record live consultation audio, attach an audio file, or enter consultation notes.');
            return;
        }

        setUiStatus('PROCESSING');
        setStatusMessage('Multilingual Clinical AI is analyzing consultation...');
        setErrorMessage('');

        try {
            const formData = new FormData();
            formData.append('language', selectedInputLang);
            formData.append('inputLanguage', selectedInputLang);
            formData.append('outputLanguage', selectedOutputLang);
            if (patientId) formData.append('patientId', patientId);
            if (appointmentId) formData.append('appointmentId', appointmentId);

            if (consultationText.trim()) {
                formData.append('transcriptText', consultationText.trim());
                formData.append('liveTranscript', consultationText.trim());
            }

            if (recordedAudioUri) {
                // Native recorded audio handoff (Multer processes req.file directly on backend)
                formData.append('audio', {
                    uri: recordedAudioUri,
                    name: 'consultation.m4a',
                    type: 'audio/m4a'
                });
                formData.append('mimeType', 'audio/m4a');
            } else if (audioFile) {
                formData.append('audio', {
                    uri: audioFile.uri,
                    name: audioFile.name || 'recording.m4a',
                    type: audioFile.mimeType || 'audio/m4a'
                });
                formData.append('mimeType', audioFile.mimeType || 'audio/m4a');
            } else if (Platform.OS === 'web' && audioChunksRef.current.length > 0) {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                formData.append('audio', audioBlob, 'consultation.webm');
                formData.append('mimeType', 'audio/webm');
            }

            const res = await voiceScribeAPI.analyze(formData);
            if (res && res.success && res.data) {
                const analysis = res.data.analysis || res.data;
                setAnalysisData(analysis);
                if (res.data._id) setServerRecordId(res.data._id);
                setUiStatus('REVIEW');
                setStatusMessage('Analysis complete! Review clinical summary and SOAP note below.');

                // Clean up temporary recording once processed
                if (recordedAudioUri) {
                    FileSystem.deleteAsync(recordedAudioUri, { idempotent: true }).catch(() => {});
                    setRecordedAudioUri(null);
                }
            } else {
                throw new Error(res?.message || 'Clinical analysis failed');
            }
        } catch (err) {
            console.error('VoiceScribe analysis error:', err);
            const msg = err?.response?.data?.message || err.message || 'AI analysis failed. Please try again.';
            setErrorMessage(msg);
            setUiStatus('ERROR');
        }
    };

    // Save Draft
    const handleSaveDraft = async () => {
        setSubmittingAction(true);
        try {
            const payload = {
                id: serverRecordId,
                patientId,
                appointmentId,
                analysis: analysisData,
                outputLanguage: selectedOutputLang,
                status: 'DRAFT'
            };
            const res = await voiceScribeAPI.saveDraft(payload);
            if (res && res.success) {
                if (res.data?._id) setServerRecordId(res.data._id);
                Alert.alert('Success', 'VoiceScribe clinical draft saved successfully.');
            } else {
                Alert.alert('Notice', res?.message || 'Draft saved.');
            }
        } catch (err) {
            Alert.alert('Error', err?.message || 'Failed to save draft.');
        } finally {
            setSubmittingAction(false);
        }
    };

    // Approve & Apply safely into consultation session notepad (does not overwrite existing doctor notes)
    const handleApprove = async () => {
        setSubmittingAction(true);
        try {
            if (serverRecordId) {
                await voiceScribeAPI.approve(serverRecordId, { analysis: analysisData });
            }

            if (setSessionData) {
                const soap = analysisData.soap || {};
                const summary = analysisData.clinicalSummary || {};
                const complaints = Array.isArray(summary.chiefComplaint) ? summary.chiefComplaint.join(', ') : '';
                const assessment = Array.isArray(summary.assessment) ? summary.assessment.join(', ') : (soap.assessment || '');

                setSessionData(prev => ({
                    ...prev,
                    diagnosis: prev?.diagnosis
                        ? `${prev.diagnosis}${assessment ? '; ' + assessment : ''}`
                        : (assessment || ''),
                    notes: `${prev?.notes ? prev.notes + '\n\n' : ''}--- VoiceScribe SOAP Note ---\nS: ${soap.subjective || ''}\nO: ${soap.objective || ''}\nA: ${soap.assessment || ''}\nP: ${soap.plan || ''}`.trim(),
                    chiefComplaint: prev?.chiefComplaint
                        ? `${prev.chiefComplaint}${complaints ? '; ' + complaints : ''}`
                        : (complaints || '')
                }));
            }

            setUiStatus('APPROVED');
            Alert.alert('Approved', 'VoiceScribe note approved and applied to consultation session!');
        } catch (err) {
            console.error('Approve error:', err);
            Alert.alert('Error', err?.message || 'Failed to approve note.');
        } finally {
            setSubmittingAction(false);
        }
    };

    // Discard
    const handleDiscard = async () => {
        Alert.alert(
            'Discard Scribe',
            'Are you sure you want to discard this VoiceScribe session?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Discard',
                    style: 'destructive',
                    onPress: async () => {
                        if (serverRecordId) {
                            try { await voiceScribeAPI.discard(serverRecordId); } catch (_) {}
                        }
                        if (recordedAudioUri) {
                            FileSystem.deleteAsync(recordedAudioUri, { idempotent: true }).catch(() => {});
                            setRecordedAudioUri(null);
                        }
                        setUiStatus('IDLE');
                        setConsultationText('');
                        setAudioFile(null);
                        setRecordingTime(0);
                        setAnalysisData({
                            transcript: '',
                            clinicalSummary: { chiefComplaint: [], historyOfPresentIllness: '', symptoms: [], vitalsMentioned: [], examinationFindings: [], assessment: [], plan: [], followUp: '' },
                            soap: { subjective: '', objective: '', assessment: '', plan: '' }
                        });
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            {/* Header / Language Controls */}
            <View style={styles.headerCard}>
                <View style={styles.headerRow}>
                    <Text style={styles.headerTitle}>🎙️ VoiceScribe AI Clinical Scribe</Text>
                    <View style={[styles.statusBadge, uiStatus === 'RECORDING' ? styles.statusRecording : uiStatus === 'APPROVED' ? styles.statusApproved : styles.statusIdle]}>
                        <Text style={styles.statusBadgeText}>
                            {uiStatus === 'RECORDING' ? `🔴 REC ${formatTime(recordingTime)}` : uiStatus}
                        </Text>
                    </View>
                </View>
                <Text style={styles.headerSub}>
                    Native ambient AI clinical scribe for doctor-patient consultations.
                </Text>

                {/* Input Language Chips */}
                <Text style={styles.sectionMiniTitle}>Spoken Consultation Language</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langScroll}>
                    {inputLanguages.map(l => (
                        <TouchableOpacity
                            key={l.code}
                            style={[styles.langChip, selectedInputLang === l.code && styles.langChipActive]}
                            onPress={() => setSelectedInputLang(l.code)}
                        >
                            <Text style={[styles.langChipText, selectedInputLang === l.code && styles.langChipTextActive]}>
                                {l.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Output Language Chips */}
                <Text style={[styles.sectionMiniTitle, { marginTop: 10 }]}>Clinical Summary Output Language</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langScroll}>
                    {outputLanguages.map(lang => (
                        <TouchableOpacity
                            key={lang}
                            style={[styles.langChip, selectedOutputLang === lang && styles.langChipActive]}
                            onPress={() => setSelectedOutputLang(lang)}
                        >
                            <Text style={[styles.langChipText, selectedOutputLang === lang && styles.langChipTextActive]}>
                                {lang}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Recording / Input Card */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Live Consultation Audio & Dictation</Text>

                <View style={styles.recControlsRow}>
                    {uiStatus === 'RECORDING' ? (
                        <>
                            <TouchableOpacity style={[styles.controlBtn, styles.stopBtn]} onPress={handleStopRecording}>
                                <Text style={styles.controlBtnText}>⏹️ Stop Recording</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.controlBtn, styles.cancelBtn]} onPress={handleCancelRecording}>
                                <Text style={styles.controlBtnText}>❌ Cancel</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity
                            style={[styles.controlBtn, styles.recordBtn, isLocked && { opacity: 0.5 }]}
                            onPress={handleStartRecording}
                            disabled={isLocked}
                        >
                            <Text style={styles.controlBtnText}>🔴 Start Live Consultation</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.controlBtn, styles.fileBtn]} onPress={handlePickAudioFile}>
                        <Text style={styles.fileBtnText}>📁 {audioFile ? audioFile.name.substring(0, 12) + '...' : 'Attach Audio'}</Text>
                    </TouchableOpacity>
                </View>

                {recordedAudioUri && uiStatus !== 'RECORDING' && (
                    <View style={styles.audioPreviewCard}>
                        <Text style={styles.audioPreviewText}>🎧 Native Audio Captured ({formatTime(recordingTime)})</Text>
                        <TouchableOpacity onPress={handleClearRecordedAudio} style={styles.audioClearBtn}>
                            <Text style={styles.audioClearBtnText}>🗑️ Remove</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {statusMessage ? (
                    <Text style={styles.statusMsgText}>{statusMessage}</Text>
                ) : null}

                {/* Transcript / Notes text area */}
                <Text style={styles.inputLabel}>Consultation Transcript / Doctor Dictation</Text>
                <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={consultationText}
                    onChangeText={setConsultationText}
                    placeholder="Dictate or type consultation conversation here. The AI will convert it into a structured clinical summary and SOAP note."
                    placeholderTextColor="#94a3b8"
                    multiline
                    numberOfLines={4}
                    editable={!isLocked}
                />

                <TouchableOpacity
                    style={[styles.analyzeBtn, (uiStatus === 'PROCESSING' || isLocked) && { opacity: 0.6 }]}
                    onPress={handleAnalyze}
                    disabled={uiStatus === 'PROCESSING' || isLocked}
                >
                    {uiStatus === 'PROCESSING' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <ActivityIndicator size="small" color="#ffffff" />
                            <Text style={styles.analyzeBtnText}>Analyzing Consultation...</Text>
                        </View>
                    ) : (
                        <Text style={styles.analyzeBtnText}>✨ Generate Clinical Summary & SOAP</Text>
                    )}
                </TouchableOpacity>

                {errorMessage ? (
                    <Text style={styles.errorMsgText}>⚠️ {errorMessage}</Text>
                ) : null}
            </View>

            {/* Analysis & SOAP Review Card */}
            {(uiStatus === 'REVIEW' || uiStatus === 'APPROVED') && (
                <View style={styles.card}>
                    <View style={styles.headerRow}>
                        <Text style={styles.cardTitle}>📋 Structured Clinical Analysis</Text>
                        <View style={[styles.statusBadge, uiStatus === 'APPROVED' ? styles.statusApproved : styles.statusIdle]}>
                            <Text style={styles.statusBadgeText}>{uiStatus === 'APPROVED' ? 'APPROVED' : 'DRAFT'}</Text>
                        </View>
                    </View>

                    {/* Chief Complaint */}
                    <View style={styles.reviewBox}>
                        <Text style={styles.reviewBoxTitle}>🩺 Chief Complaints:</Text>
                        <Text style={styles.reviewBoxContent}>
                            {Array.isArray(analysisData.clinicalSummary?.chiefComplaint) && analysisData.clinicalSummary.chiefComplaint.length > 0
                                ? analysisData.clinicalSummary.chiefComplaint.join(', ')
                                : 'None documented'}
                        </Text>
                    </View>

                    {/* Symptoms & HPI */}
                    <View style={styles.reviewBox}>
                        <Text style={styles.reviewBoxTitle}>🔍 Symptoms & History of Present Illness:</Text>
                        <Text style={styles.reviewBoxContent}>
                            {analysisData.clinicalSummary?.historyOfPresentIllness || (Array.isArray(analysisData.clinicalSummary?.symptoms) ? analysisData.clinicalSummary.symptoms.join(', ') : 'Not specified')}
                        </Text>
                    </View>

                    {/* SOAP Note */}
                    <Text style={[styles.cardTitle, { marginTop: 14 }]}>📑 Generated SOAP Note</Text>
                    <View style={styles.soapGrid}>
                        <View style={styles.soapCard}>
                            <Text style={styles.soapLabel}>S — Subjective</Text>
                            <TextInput
                                style={styles.soapInput}
                                value={analysisData.soap?.subjective}
                                onChangeText={v => setAnalysisData(prev => ({ ...prev, soap: { ...prev.soap, subjective: v } }))}
                                multiline
                                editable={!isLocked && uiStatus !== 'APPROVED'}
                            />
                        </View>
                        <View style={styles.soapCard}>
                            <Text style={styles.soapLabel}>O — Objective</Text>
                            <TextInput
                                style={styles.soapInput}
                                value={analysisData.soap?.objective}
                                onChangeText={v => setAnalysisData(prev => ({ ...prev, soap: { ...prev.soap, objective: v } }))}
                                multiline
                                editable={!isLocked && uiStatus !== 'APPROVED'}
                            />
                        </View>
                        <View style={styles.soapCard}>
                            <Text style={styles.soapLabel}>A — Assessment</Text>
                            <TextInput
                                style={styles.soapInput}
                                value={analysisData.soap?.assessment}
                                onChangeText={v => setAnalysisData(prev => ({ ...prev, soap: { ...prev.soap, assessment: v } }))}
                                multiline
                                editable={!isLocked && uiStatus !== 'APPROVED'}
                            />
                        </View>
                        <View style={styles.soapCard}>
                            <Text style={styles.soapLabel}>P — Plan</Text>
                            <TextInput
                                style={styles.soapInput}
                                value={analysisData.soap?.plan}
                                onChangeText={v => setAnalysisData(prev => ({ ...prev, soap: { ...prev.soap, plan: v } }))}
                                multiline
                                editable={!isLocked && uiStatus !== 'APPROVED'}
                            />
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionBtnRow}>
                        <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard}>
                            <Text style={styles.discardBtnText}>🗑️ Discard</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.saveDraftBtn}
                            onPress={handleSaveDraft}
                            disabled={submittingAction || isLocked}
                        >
                            <Text style={styles.saveDraftBtnText}>💾 Save Draft</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.approveBtn, (submittingAction || isLocked) && { opacity: 0.6 }]}
                            onPress={handleApprove}
                            disabled={submittingAction || isLocked}
                        >
                            <Text style={styles.approveBtnText}>
                                {submittingAction ? 'Applying...' : '✅ Approve & Apply'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    headerCard: { backgroundColor: '#ffffff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    headerTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    headerSub: { fontSize: 12, color: '#64748b', marginBottom: 10 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
    statusRecording: { backgroundColor: '#fee2e2' },
    statusApproved: { backgroundColor: '#dcfce7' },
    statusIdle: { backgroundColor: '#f1f5f9' },
    statusBadgeText: { fontSize: 11, fontWeight: '800', color: '#0f172a' },
    sectionMiniTitle: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 },
    langScroll: { flexDirection: 'row' },
    langChip: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginRight: 6, borderWidth: 1, borderColor: '#cbd5e1' },
    langChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
    langChipText: { fontSize: 11, color: '#475569', fontWeight: '600' },
    langChipTextActive: { color: '#ffffff', fontWeight: '700' },

    card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    cardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
    recControlsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    controlBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    recordBtn: { backgroundColor: '#ef4444' },
    stopBtn: { backgroundColor: '#1e293b' },
    cancelBtn: { backgroundColor: '#64748b' },
    fileBtn: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
    controlBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
    fileBtnText: { color: '#1e293b', fontWeight: '600', fontSize: 12 },
    audioPreviewCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 10 },
    audioPreviewText: { fontSize: 12, fontWeight: '700', color: '#166534' },
    audioClearBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    audioClearBtnText: { fontSize: 11, fontWeight: '700', color: '#dc2626' },
    statusMsgText: { fontSize: 12, color: '#2563eb', fontWeight: '600', marginBottom: 8 },
    inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4, marginTop: 4 },
    textInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#0f172a', backgroundColor: '#f8fafc', marginBottom: 10 },
    textArea: { height: 80, textAlignVertical: 'top' },
    analyzeBtn: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 4 },
    analyzeBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
    errorMsgText: { color: '#ef4444', fontSize: 12, marginTop: 8, fontWeight: '600' },

    reviewBox: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    reviewBoxTitle: { fontSize: 11, fontWeight: '800', color: '#1e40af', marginBottom: 2 },
    reviewBoxContent: { fontSize: 12, color: '#1e293b', lineHeight: 18 },

    soapGrid: { gap: 8, marginVertical: 8 },
    soapCard: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    soapLabel: { fontSize: 11, fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: 4 },
    soapInput: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, padding: 8, fontSize: 12, color: '#0f172a', minHeight: 40 },

    actionBtnRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    discardBtn: { backgroundColor: '#fee2e2', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
    discardBtnText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 },
    saveDraftBtn: { flex: 1, backgroundColor: '#f1f5f9', paddingVertical: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#cbd5e1' },
    saveDraftBtnText: { color: '#475569', fontWeight: '700', fontSize: 12 },
    approveBtn: { flex: 1, backgroundColor: '#16a34a', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    approveBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 }
});

export default VoiceScribe;
