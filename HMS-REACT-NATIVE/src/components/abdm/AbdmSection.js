import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Modal,
    ActivityIndicator,
    Alert,
    ScrollView
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { abdmAPI } from '../../utils/api';

const AbdmSection = ({ patient, onPatientUpdate, compact = false }) => {
    const abdm = patient?.abdm || {};
    const isVerified = Boolean(abdm.isVerified);
    const patientId = patient?._id || patient?.id;

    // Modal state
    const [modalMode, setModalMode] = useState(null); // 'link' | 'create' | null
    const [step, setStep] = useState(1); // 1 = identifier input, 2 = OTP verification
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Form inputs
    const [abhaIdentifier, setAbhaIdentifier] = useState('');
    const [authMethod, setAuthMethod] = useState('AADHAAR_OTP');
    const [aadhaarInput, setAadhaarInput] = useState('');
    const [txnId, setTxnId] = useState('');
    const [otp, setOtp] = useState('');
    const [mobileInput, setMobileInput] = useState(patient?.phone || patient?.mobile || '');

    // Skip state
    const [skipped, setSkipped] = useState(false);

    const openLinkModal = () => {
        setModalMode('link');
        setStep(1);
        setErrorMessage('');
        setAbhaIdentifier('');
        setOtp('');
        setTxnId('');
    };

    const openCreateModal = () => {
        setModalMode('create');
        setStep(1);
        setErrorMessage('');
        setAadhaarInput('');
        setOtp('');
        setTxnId('');
        setMobileInput(patient?.phone || patient?.mobile || '');
    };

    const closeModal = () => {
        setModalMode(null);
        setStep(1);
        setErrorMessage('');
        setOtp('');
        setTxnId('');
        setLoading(false);
    };

    const handleSkip = () => {
        setSkipped(true);
        Alert.alert('ABHA Linking', 'ABHA linking skipped for now. You can link anytime from the patient profile.');
    };

    // Step 1: Initiate Link Existing ABHA
    const handleStartLink = async () => {
        if (!abhaIdentifier || abhaIdentifier.trim().length < 4) {
            setErrorMessage('Please enter a valid ABHA Number or ABHA Address');
            return;
        }

        setLoading(true);
        setErrorMessage('');
        try {
            const res = await abdmAPI.startLink({
                patientId,
                abhaIdentifier: abhaIdentifier.trim(),
                authMethod
            });

            if (res.success) {
                setTxnId(res.txnId);
                setStep(2);
                Alert.alert('Success', 'ABDM OTP initiated successfully');
            } else {
                setErrorMessage(res.message || 'Failed to initiate ABDM linking');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to connect to ABDM Sandbox';
            setErrorMessage(msg);
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Confirm Link Existing ABHA
    const handleVerifyLink = async () => {
        if (!otp || otp.trim().length !== 6) {
            setErrorMessage('Please enter the 6-digit OTP');
            return;
        }

        setLoading(true);
        setErrorMessage('');
        try {
            const res = await abdmAPI.verifyLink({
                patientId,
                txnId,
                otp: otp.trim()
            });

            if (res.success) {
                Alert.alert('Verified', 'ABHA successfully linked & verified!');
                closeModal();
                if (onPatientUpdate) onPatientUpdate(res.abha);
            } else {
                setErrorMessage(res.message || 'Failed to verify OTP');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'OTP verification failed';
            setErrorMessage(msg);
        } finally {
            setLoading(false);
        }
    };

    // Step 1: Initiate Create ABHA
    const handleStartCreate = async () => {
        const cleanAadhaar = String(aadhaarInput || '').trim();
        if (!/^\d{12}$/.test(cleanAadhaar)) {
            setErrorMessage('Please enter a valid 12-digit Aadhaar number');
            return;
        }

        const cleanMobile = String(mobileInput || patient?.phone || patient?.mobile || '').replace(/\D/g, '').slice(-10);
        if (!cleanMobile || cleanMobile.length !== 10) {
            setErrorMessage('Please enter a valid 10-digit mobile number for ABHA registration');
            return;
        }

        setLoading(true);
        setErrorMessage('');
        try {
            const res = await abdmAPI.startCreate({
                patientId,
                aadhaarNumber: cleanAadhaar
            });

            if (res.success) {
                setTxnId(res.txnId);
                setStep(2);
                Alert.alert('Success', 'Aadhaar OTP generated by ABDM');
            } else {
                setErrorMessage(res.message || 'Failed to initiate ABHA creation');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to connect to ABDM Sandbox';
            setErrorMessage(msg);
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Confirm Create ABHA
    const handleVerifyCreate = async () => {
        if (!otp || otp.trim().length !== 6) {
            setErrorMessage('Please enter the 6-digit OTP');
            return;
        }

        const cleanMobile = String(mobileInput || patient?.phone || patient?.mobile || '').replace(/\D/g, '').slice(-10);
        if (!cleanMobile || cleanMobile.length !== 10) {
            setErrorMessage('Please enter a valid 10-digit mobile number for ABHA profile creation');
            return;
        }

        setLoading(true);
        setErrorMessage('');
        try {
            const res = await abdmAPI.verifyCreate({
                patientId,
                txnId,
                otp: otp.trim(),
                mobile: cleanMobile
            });

            if (res.success) {
                Alert.alert('Verified', 'New ABHA successfully created and linked!');
                closeModal();
                if (onPatientUpdate) onPatientUpdate(res.abha);
            } else {
                setErrorMessage(res.message || 'Failed to verify OTP');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'OTP verification failed';
            setErrorMessage(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.card, compact && styles.compactCard]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <View style={styles.govIconBox}>
                        <MaterialCommunityIcons name="shield-check" size={20} color="#0d9488" />
                    </View>
                    <View style={styles.titleInfo}>
                        <Text style={styles.heading}>Ayushman Bharat Health Account (ABHA)</Text>
                        <Text style={styles.subheading}>Govt. of India ABDM National Digital Health Ecosystem</Text>
                    </View>
                </View>

                {isVerified ? (
                    <View style={styles.badgeVerified}>
                        <Feather name="check-circle" size={12} color="#059669" />
                        <Text style={styles.badgeVerifiedText}>Verified</Text>
                    </View>
                ) : (
                    <View style={styles.badgeUnlinked}>
                        <Feather name="alert-circle" size={12} color="#d97706" />
                        <Text style={styles.badgeUnlinkedText}>Not Linked</Text>
                    </View>
                )}
            </View>

            {/* Content Body */}
            {isVerified ? (
                <View style={styles.verifiedBody}>
                    <View style={styles.gridContainer}>
                        <View style={styles.fieldBox}>
                            <Text style={styles.fieldLabel}>ABHA Number</Text>
                            <Text style={styles.fieldValue}>
                                {abdm.maskedAbhaNumber || (abdm.abhaNumber ? `**-****-****-${abdm.abhaNumber.slice(-4)}` : '************')}
                            </Text>
                        </View>
                        <View style={styles.fieldBox}>
                            <Text style={styles.fieldLabel}>ABHA Address</Text>
                            <Text style={styles.fieldValue}>
                                {abdm.maskedAbhaAddress || abdm.abhaAddress || '********@abdm'}
                            </Text>
                        </View>
                        <View style={styles.fieldBox}>
                            <Text style={styles.fieldLabel}>Verification Date</Text>
                            <Text style={styles.fieldValue}>
                                {abdm.verifiedAt ? new Date(abdm.verifiedAt).toLocaleDateString('en-IN') : 'Verified'}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.footerNote}>
                        <Feather name="check" size={13} color="#059669" />
                        <Text style={styles.footerNoteText}>
                            Linked securely with Patient MRN: <Text style={{ fontWeight: '700' }}>{patient?.patientId || patient?.mrn || 'N/A'}</Text>
                        </Text>
                    </View>
                </View>
            ) : (
                <View style={styles.unlinkedBody}>
                    <Text style={styles.unlinkedInfo}>
                        Link the patient's Ayushman Bharat Health Account to enable interoperable healthcare records and unified clinical tracking.
                    </Text>

                    <View style={styles.actionButtonGroup}>
                        <TouchableOpacity style={styles.primaryBtn} onPress={openLinkModal}>
                            <Feather name="link-2" size={14} color="#ffffff" />
                            <Text style={styles.primaryBtnText}>Link Existing ABHA</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.secondaryBtn} onPress={openCreateModal}>
                            <Feather name="plus-circle" size={14} color="#0d9488" />
                            <Text style={styles.secondaryBtnText}>Create ABHA</Text>
                        </TouchableOpacity>

                        {!skipped && (
                            <TouchableOpacity style={styles.outlineBtn} onPress={handleSkip}>
                                <Text style={styles.outlineBtnText}>Skip for Now</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}

            {/* Modal for Link / Create Flow */}
            {modalMode && (
                <Modal visible transparent animationType="fade" onRequestClose={closeModal}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>
                                    {modalMode === 'link' ? 'Link Existing ABHA' : 'Create New ABHA'}
                                </Text>
                                <TouchableOpacity onPress={closeModal} style={styles.modalCloseBtn}>
                                    <Feather name="x" size={18} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                                {errorMessage ? (
                                    <View style={styles.errorAlert}>
                                        <Feather name="alert-triangle" size={14} color="#dc2626" />
                                        <Text style={styles.errorAlertText}>{errorMessage}</Text>
                                    </View>
                                ) : null}

                                {/* Modal Step 1: Link ABHA */}
                                {step === 1 && modalMode === 'link' && (
                                    <View>
                                        <View style={styles.formGroup}>
                                            <Text style={styles.inputLabel}>ABHA Number (14 Digits)</Text>
                                            <TextInput
                                                style={styles.textInput}
                                                placeholder="e.g. 12-3456-7890-1234"
                                                placeholderTextColor="#94a3b8"
                                                value={abhaIdentifier}
                                                onChangeText={setAbhaIdentifier}
                                                keyboardType="numeric"
                                                autoFocus
                                            />
                                            <Text style={styles.inputHint}>
                                                Enter the 14-digit ABHA number to initiate Aadhaar/Mobile OTP.
                                            </Text>
                                        </View>

                                        <View style={styles.formGroup}>
                                            <Text style={styles.inputLabel}>Authentication Mode</Text>
                                            <View style={styles.authModeRow}>
                                                <TouchableOpacity
                                                    style={[styles.authModeChip, authMethod === 'AADHAAR_OTP' && styles.authModeChipActive]}
                                                    onPress={() => setAuthMethod('AADHAAR_OTP')}
                                                >
                                                    <Text style={[styles.authModeChipText, authMethod === 'AADHAAR_OTP' && styles.authModeChipTextActive]}>
                                                        Aadhaar OTP
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.authModeChip, authMethod === 'MOBILE_OTP' && styles.authModeChipActive]}
                                                    onPress={() => setAuthMethod('MOBILE_OTP')}
                                                >
                                                    <Text style={[styles.authModeChipText, authMethod === 'MOBILE_OTP' && styles.authModeChipTextActive]}>
                                                        Mobile OTP
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        <View style={styles.modalFooter}>
                                            <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                                                <Text style={styles.cancelBtnText}>Cancel</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.submitBtn, loading && styles.disabledBtn]}
                                                onPress={handleStartLink}
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <>
                                                        <Text style={styles.submitBtnText}>Request ABDM OTP</Text>
                                                        <Feather name="arrow-right" size={14} color="#fff" style={{ marginLeft: 6 }} />
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                {/* Modal Step 1: Create ABHA */}
                                {step === 1 && modalMode === 'create' && (
                                    <View>
                                        <View style={styles.formGroup}>
                                            <Text style={styles.inputLabel}>Patient Aadhaar Number (12 Digits)</Text>
                                            <TextInput
                                                style={styles.textInput}
                                                maxLength={12}
                                                placeholder="12-digit Aadhaar Number"
                                                placeholderTextColor="#94a3b8"
                                                value={aadhaarInput}
                                                onChangeText={(val) => setAadhaarInput(val.replace(/\D/g, ''))}
                                                keyboardType="numeric"
                                                autoFocus
                                            />
                                            <Text style={styles.inputHint}>
                                                Authentication OTP will be sent to the Aadhaar-linked mobile number.
                                            </Text>
                                        </View>

                                        <View style={styles.formGroup}>
                                            <Text style={styles.inputLabel}>Mobile Number for ABHA (10 Digits)</Text>
                                            <TextInput
                                                style={styles.textInput}
                                                maxLength={10}
                                                placeholder="10-digit Mobile Number"
                                                placeholderTextColor="#94a3b8"
                                                value={mobileInput}
                                                onChangeText={(val) => setMobileInput(val.replace(/\D/g, ''))}
                                                keyboardType="phone-pad"
                                            />
                                        </View>

                                        <View style={styles.infoAlert}>
                                            <Feather name="shield" size={13} color="#0d9488" />
                                            <Text style={styles.infoAlertText}>
                                                Aadhaar is sent encrypted directly to ABDM/UIDAI and is not stored locally.
                                            </Text>
                                        </View>

                                        <View style={styles.modalFooter}>
                                            <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                                                <Text style={styles.cancelBtnText}>Cancel</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.submitBtn, loading && styles.disabledBtn]}
                                                onPress={handleStartCreate}
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <>
                                                        <Text style={styles.submitBtnText}>Generate Aadhaar OTP</Text>
                                                        <Feather name="arrow-right" size={14} color="#fff" style={{ marginLeft: 6 }} />
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                {/* Modal Step 2: OTP Verification */}
                                {step === 2 && (
                                    <View>
                                        <View style={styles.formGroup}>
                                            <Text style={styles.inputLabel}>Enter 6-Digit ABDM OTP</Text>
                                            <TextInput
                                                style={[styles.textInput, styles.otpInput]}
                                                maxLength={6}
                                                placeholder="••••••"
                                                placeholderTextColor="#cbd5e1"
                                                value={otp}
                                                onChangeText={(val) => setOtp(val.replace(/\D/g, ''))}
                                                keyboardType="numeric"
                                                autoFocus
                                            />
                                            <Text style={styles.inputHint}>
                                                Enter the verification OTP received on the registered mobile.
                                            </Text>
                                        </View>

                                        <View style={styles.modalFooter}>
                                            <TouchableOpacity
                                                style={styles.cancelBtn}
                                                onPress={() => setStep(1)}
                                                disabled={loading}
                                            >
                                                <Text style={styles.cancelBtnText}>Back</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.submitBtn, (loading || otp.length !== 6) && styles.disabledBtn]}
                                                onPress={modalMode === 'link' ? handleVerifyLink : handleVerifyCreate}
                                                disabled={loading || otp.length !== 6}
                                            >
                                                {loading ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <Text style={styles.submitBtnText}>
                                                        {modalMode === 'link' ? 'Verify & Link ABHA' : 'Verify & Create ABHA'}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 16,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    compactCard: {
        padding: 12,
        marginVertical: 6,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    govIconBox: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: '#f0fdfa',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#ccfbf1',
    },
    titleInfo: {
        flex: 1,
    },
    heading: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
    },
    subheading: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
    },
    badgeVerified: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    badgeVerifiedText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#059669',
    },
    badgeUnlinked: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fde68a',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    badgeUnlinkedText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#d97706',
    },
    verifiedBody: {
        marginTop: 12,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    fieldBox: {
        flex: 1,
        minWidth: 130,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    fieldLabel: {
        fontSize: 10,
        color: '#64748b',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    fieldValue: {
        fontSize: 12,
        fontWeight: '700',
        color: '#0f172a',
        marginTop: 4,
    },
    footerNote: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        gap: 6,
    },
    footerNoteText: {
        fontSize: 11,
        color: '#64748b',
    },
    unlinkedBody: {
        marginTop: 12,
    },
    unlinkedInfo: {
        fontSize: 12,
        color: '#475569',
        lineHeight: 18,
    },
    actionButtonGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0d9488',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
    },
    primaryBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdfa',
        borderWidth: 1,
        borderColor: '#0d9488',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
    },
    secondaryBtnText: {
        color: '#0d9488',
        fontSize: 12,
        fontWeight: '700',
    },
    outlineBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        justifyContent: 'center',
    },
    outlineBtnText: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 460,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    modalCloseBtn: {
        padding: 6,
    },
    modalScroll: {
        marginTop: 14,
    },
    errorAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
        padding: 10,
        borderRadius: 8,
        marginBottom: 12,
        gap: 8,
    },
    errorAlertText: {
        color: '#dc2626',
        fontSize: 12,
        flex: 1,
        fontWeight: '600',
    },
    formGroup: {
        marginBottom: 14,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    textInput: {
        height: 44,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 14,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
    },
    otpInput: {
        letterSpacing: 6,
        fontSize: 20,
        fontWeight: '800',
        textAlign: 'center',
    },
    inputHint: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 4,
    },
    authModeRow: {
        flexDirection: 'row',
        gap: 10,
    },
    authModeChip: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        backgroundColor: '#f8fafc',
    },
    authModeChipActive: {
        borderColor: '#0d9488',
        backgroundColor: '#f0fdfa',
    },
    authModeChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    authModeChipTextActive: {
        color: '#0d9488',
        fontWeight: '700',
    },
    infoAlert: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdfa',
        padding: 10,
        borderRadius: 8,
        marginBottom: 14,
        gap: 8,
    },
    infoAlertText: {
        fontSize: 11,
        color: '#0f766e',
        flex: 1,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
    },
    cancelBtn: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
    },
    cancelBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748b',
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0d9488',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 8,
    },
    submitBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    disabledBtn: {
        opacity: 0.5,
    },
});

export default AbdmSection;

