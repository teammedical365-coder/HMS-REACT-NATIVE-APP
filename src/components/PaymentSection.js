import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker'; // Optional native picker
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n || 0);

const PaymentSection = ({
    splitPayments = [],
    onSplitChange,
    onAddSplit,
    onRemoveSplit,
    totalAmount = 0,
    upiOptions = [],
    paymentData = {},
    onPaymentDataChange,
    proofFile = null,
    onProofFileChange,
    label = 'Payment Breakdown',
    noUpiMessage = '',
    allowCash = true
}) => {
    const totalSplitAmount = splitPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const hasUpi = splitPayments.some(sp => sp.method === 'UPI');
    const upiAmount = hasUpi
        ? splitPayments.filter(sp => sp.method === 'UPI').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
        : 0;
    const selectedUpiId = paymentData?.upiId || upiOptions?.[0]?.upiId || '';
    const showQr = hasUpi && upiAmount > 0 && selectedUpiId && upiOptions.length > 0;
    const showNoUpiMsg = hasUpi && upiOptions.length === 0;

    const handlePickProof = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'] });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                onProofFileChange(result.assets[0]);
            }
        } catch (err) {
            console.error("Proof picking error", err);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.leftCol}>
                <Text style={styles.mainLabel}>
                    {label} <Text style={{ color: '#ef4444' }}>*(Total must match: {fmt(totalAmount)})</Text>
                </Text>
                
                <View style={styles.splitsContainer}>
                    {splitPayments.map((split, index) => (
                        <View key={index} style={styles.splitRowCard}>
                            <View style={styles.splitRowTop}>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={split.method}
                                        onValueChange={(val) => onSplitChange(index, 'method', val)}
                                        style={{ height: 40 }}
                                    >
                                        {allowCash && <Picker.Item label="Cash" value="Cash" />}
                                        <Picker.Item label="UPI" value="UPI" />
                                        <Picker.Item label="Card" value="Card" />
                                        <Picker.Item label="Cheque" value="Cheque" />
                                        <Picker.Item label="NEFT / RTGS" value="NEFT/RTGS" />
                                    </Picker>
                                </View>

                                <TextInput
                                    style={styles.amountInput}
                                    placeholder="Amount"
                                    value={String(split.amount)}
                                    onChangeText={(val) => onSplitChange(index, 'amount', val)}
                                    keyboardType="numeric"
                                />

                                {splitPayments.length > 1 && (
                                    <TouchableOpacity style={styles.removeBtn} onPress={() => onRemoveSplit(index)}>
                                        <Feather name="x" size={20} color="#dc2626" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {split.method === 'UPI' && upiOptions.length > 0 && (
                                <View style={styles.extraFieldsRow}>
                                    <View style={[styles.pickerWrapper, { flex: 1 }]}>
                                        <Picker
                                            selectedValue={paymentData?.upiId || ''}
                                            onValueChange={(val) => onPaymentDataChange({ ...paymentData, upiId: val })}
                                            style={{ height: 40 }}
                                        >
                                            <Picker.Item label="Select Dept UPI ID" value="" color="#94a3b8" />
                                            {upiOptions.map((opt, idx) => (
                                                <Picker.Item key={idx} label={`${opt.label} (${opt.upiId})`} value={opt.upiId} />
                                            ))}
                                        </Picker>
                                    </View>
                                    <TextInput
                                        style={styles.textInputFlex}
                                        placeholder="Txn Ref"
                                        value={paymentData?.transactionId || ''}
                                        onChangeText={(val) => onPaymentDataChange({ ...paymentData, transactionId: val })}
                                    />
                                </View>
                            )}

                            {split.method === 'UPI' && upiOptions.length === 0 && (
                                <View style={styles.warnBox}>
                                    <Text style={styles.warnBoxText}>
                                        ⚠️ {noUpiMessage || 'No UPI account has been configured for this department. Please contact Hospital Admin.'}
                                    </Text>
                                </View>
                            )}

                            {split.method === 'Card' && (
                                <View style={styles.extraFieldsRow}>
                                    <TextInput
                                        style={styles.textInputFlex}
                                        placeholder="Card (Last 4)"
                                        value={paymentData?.cardDetails || ''}
                                        onChangeText={(val) => onPaymentDataChange({ ...paymentData, cardDetails: val })}
                                        keyboardType="numeric"
                                    />
                                    <TextInput
                                        style={styles.textInputFlex}
                                        placeholder="Txn Ref"
                                        value={paymentData?.transactionId || ''}
                                        onChangeText={(val) => onPaymentDataChange({ ...paymentData, transactionId: val })}
                                    />
                                </View>
                            )}

                            {['Cheque', 'NEFT/RTGS'].includes(split.method) && (
                                <View style={styles.extraFieldsRow}>
                                    <TextInput
                                        style={styles.textInputFlex}
                                        placeholder="Bank Ref / Cheque No"
                                        value={paymentData?.bankReference || ''}
                                        onChangeText={(val) => onPaymentDataChange({ ...paymentData, bankReference: val })}
                                    />
                                </View>
                            )}

                            {split.method !== 'Cash' && !proofFile && (
                                <View style={styles.proofContainer}>
                                    <Text style={styles.proofLabel}>
                                        Payment Proof <Text style={{ color: '#ef4444' }}>*Required once for non-cash</Text>
                                    </Text>
                                    <TouchableOpacity style={styles.proofBtn} onPress={handlePickProof}>
                                        <Feather name="upload" size={16} color="#475569" />
                                        <Text style={styles.proofBtnText}>
                                            {proofFile ? proofFile.name : 'Select Proof File...'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    ))}

                    <View style={styles.footerRow}>
                        <TouchableOpacity style={styles.addBtn} onPress={onAddSplit}>
                            <Text style={styles.addBtnText}>+ Add Method</Text>
                        </TouchableOpacity>
                        <Text style={[
                            styles.splitTotalText,
                            { color: totalSplitAmount === Number(totalAmount) ? '#15803d' : '#ef4444' }
                        ]}>
                            Split Total: {fmt(totalSplitAmount)} / {fmt(totalAmount)}
                        </Text>
                    </View>
                </View>
            </View>

            {showQr && (
                <View style={styles.qrCol}>
                    <Text style={styles.qrHeader}>Scan QR to Pay {fmt(upiAmount)}</Text>
                    <Image
                        source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('upi://pay?pa=' + selectedUpiId.trim() + '&pn=Medical365&am=' + upiAmount + '&cu=INR')}` }}
                        style={styles.qrImg}
                    />
                    <Text style={styles.qrFooter}>UPI ID: {selectedUpiId}</Text>
                </View>
            )}

            {showNoUpiMsg && (
                <View style={styles.noUpiCol}>
                    <Text style={styles.noUpiIcon}>⚠️</Text>
                    <Text style={styles.noUpiText}>
                        {noUpiMessage || 'No UPI account has been configured for this department.'}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flexDirection: 'row', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' },
    leftCol: { flex: 1, minWidth: 300 },
    mainLabel: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 10 },
    splitsContainer: { gap: 10 },
    splitRowCard: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 },
    splitRowTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    pickerWrapper: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, backgroundColor: 'white', minWidth: 140, justifyContent: 'center' },
    amountInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, backgroundColor: 'white', paddingHorizontal: 12, height: 40, width: 100 },
    removeBtn: { padding: 8, backgroundColor: '#fee2e2', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    extraFieldsRow: { flexDirection: 'row', gap: 10 },
    textInputFlex: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, backgroundColor: 'white', paddingHorizontal: 12, height: 40 },
    warnBox: { padding: 12, backgroundColor: '#fef3c7', borderRadius: 8, borderWidth: 1, borderColor: '#f59e0b' },
    warnBoxText: { color: '#92400e', fontSize: 13 },
    proofContainer: { gap: 4, marginTop: 4 },
    proofLabel: { fontSize: 11, color: '#64748b', fontWeight: 'bold' },
    proofBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: 'white', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
    proofBtnText: { fontSize: 13, color: '#334155' },
    footerRow: { flexDirection: 'row', gap: 15, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
    addBtn: { backgroundColor: '#ccfbf1', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
    addBtnText: { color: '#0f766e', fontWeight: 'bold' },
    splitTotalText: { fontSize: 14, fontWeight: 'bold' },
    qrCol: { width: 200, alignItems: 'center', padding: 20, backgroundColor: '#f0fdfa', borderRadius: 12, borderWidth: 1, borderColor: '#0d9488', borderStyle: 'dashed' },
    qrHeader: { fontSize: 14, color: '#0f766e', fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    qrImg: { width: 150, height: 150, borderRadius: 8 },
    qrFooter: { fontSize: 11, color: '#64748b', marginTop: 8, textAlign: 'center' },
    noUpiCol: { width: 200, alignItems: 'center', padding: 20, backgroundColor: '#fef3c7', borderRadius: 12, borderWidth: 1, borderColor: '#f59e0b', borderStyle: 'dashed' },
    noUpiIcon: { fontSize: 28, marginBottom: 8 },
    noUpiText: { fontSize: 12, color: '#92400e', fontWeight: 'bold', textAlign: 'center' }
});

export default PaymentSection;
