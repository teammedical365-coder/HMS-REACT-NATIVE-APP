import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker'; // Optional native picker

const DynamicQuestionForm = ({ categoryName, questions, intakeData, setIntakeData, readOnly = false }) => {
    const handleAnswer = (q, val) => {
        if (readOnly) return;
        setIntakeData(prev => ({ ...prev, [q]: val }));
    };

    const handleCheckbox = (q, opt, isChecked) => {
        if (readOnly) return;
        setIntakeData(prev => {
            let current = prev[q] || [];
            if (!Array.isArray(current)) current = [];

            if (isChecked) {
                current = [...current, opt];
            } else {
                current = current.filter(i => i !== opt);
            }
            return { ...prev, [q]: current };
        });
    };

    return (
        <View style={styles.panel}>
            <Text style={styles.panelTitle}>📋 {categoryName}</Text>
            
            <View style={styles.questionsContainer}>
                {questions.map((item, idx) => {
                    if (item.condition && intakeData[item.parentQ] !== item.condition) return null;

                    const savedVal = intakeData[item.q] || "";

                    return (
                        <View key={idx} style={styles.fieldStyle}>
                            <Text style={styles.labelStyle}>{item.q}</Text>

                            {(item.type === 'text' || item.type === 'number' || item.type === 'date') && (
                                <TextInput
                                    style={[styles.inputStyle, readOnly && styles.inputDisabled]}
                                    value={savedVal}
                                    onChangeText={(val) => handleAnswer(item.q, val)}
                                    editable={!readOnly}
                                    keyboardType={item.type === 'number' ? 'numeric' : 'default'}
                                />
                            )}

                            {(item.type === 'select' || item.type === 'yes-no') && (
                                <View style={[styles.inputStyle, readOnly && styles.inputDisabled, { padding: 0, justifyContent: 'center' }]}>
                                    <Picker
                                        selectedValue={savedVal}
                                        onValueChange={(val) => handleAnswer(item.q, val)}
                                        enabled={!readOnly}
                                        style={{ height: 40 }}
                                    >
                                        <Picker.Item label="Select..." value="" color="#94a3b8" />
                                        {item.type === 'yes-no' ? (
                                            <>
                                                <Picker.Item label="Yes" value="Yes" />
                                                <Picker.Item label="No" value="No" />
                                            </>
                                        ) : (
                                            (item.options || []).map(o => (
                                                <Picker.Item key={o} label={o} value={o} />
                                            ))
                                        )}
                                    </Picker>
                                </View>
                            )}

                            {item.type === 'textarea' && (
                                <TextInput
                                    style={[styles.inputStyle, readOnly && styles.inputDisabled, styles.textareaStyle]}
                                    value={savedVal}
                                    onChangeText={(val) => handleAnswer(item.q, val)}
                                    editable={!readOnly}
                                    multiline
                                    numberOfLines={4}
                                />
                            )}

                            {item.type === 'checkbox-group' && (
                                <View style={styles.checkboxGrid}>
                                    {(item.options || []).map(opt => {
                                        const isChecked = Array.isArray(intakeData[item.q]) && intakeData[item.q].includes(opt);
                                        return (
                                            <TouchableOpacity 
                                                key={opt} 
                                                style={[styles.checkboxCard, isChecked && styles.checkboxCardChecked]}
                                                onPress={() => handleCheckbox(item.q, opt, !isChecked)}
                                                disabled={readOnly}
                                            >
                                                <View style={[styles.checkboxBox, isChecked && styles.checkboxBoxChecked]}>
                                                    {isChecked && <Feather name="check" size={14} color="white" />}
                                                </View>
                                                <Text style={[styles.checkboxText, isChecked && styles.checkboxTextChecked]}>{opt}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}

                            {(item.type === 'checkbox-date-group' || item.type === 'checkbox-text-group') && (
                                <View style={styles.complexGroupContainer}>
                                    <View style={styles.complexCheckboxGrid}>
                                        {(item.options || []).map(opt => {
                                            const isChecked = Array.isArray(intakeData[item.q]) && intakeData[item.q].includes(opt);
                                            const dateVal = intakeData[`${item.q}_date_${opt}`] || "";

                                            return (
                                                <View key={opt} style={styles.complexCheckboxRow}>
                                                    <TouchableOpacity 
                                                        style={[styles.checkboxCard, isChecked && styles.checkboxCardChecked]}
                                                        onPress={() => handleCheckbox(item.q, opt, !isChecked)}
                                                        disabled={readOnly}
                                                    >
                                                        <View style={[styles.checkboxBox, isChecked && styles.checkboxBoxChecked]}>
                                                            {isChecked && <Feather name="check" size={14} color="white" />}
                                                        </View>
                                                        <Text style={[styles.checkboxText, isChecked && styles.checkboxTextChecked]}>{opt}</Text>
                                                    </TouchableOpacity>

                                                    {opt !== 'None' && isChecked && (
                                                        <TextInput
                                                            style={[styles.inputStyle, readOnly && styles.inputDisabled, { paddingVertical: 6, fontSize: 12, marginTop: 4 }]}
                                                            value={dateVal}
                                                            onChangeText={(val) => handleAnswer(`${item.q}_date_${opt}`, val)}
                                                            placeholder={item.type === 'checkbox-text-group' ? 'Details...' : 'YYYY-MM-DD'}
                                                            editable={!readOnly}
                                                        />
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </View>
                                    
                                    {item.extra && (
                                        <View style={styles.extraRow}>
                                            <Text style={styles.extraLabel}>{item.extra}:</Text>
                                            <TextInput
                                                style={[styles.inputStyle, readOnly && styles.inputDisabled, { flex: 1 }]}
                                                value={intakeData[`${item.q}_extra`] || ""}
                                                onChangeText={(val) => handleAnswer(`${item.q}_extra`, val)}
                                                placeholder="Enter details..."
                                                editable={!readOnly}
                                            />
                                        </View>
                                    )}
                                </View>
                            )}

                            {item.type === 'row' && (
                                <View style={styles.rowTypeContainer}>
                                    {(item.fields || []).map(field => {
                                        const val = intakeData[field.q] || "";
                                        return (
                                            <View key={field.q} style={styles.rowFieldCol}>
                                                <Text style={styles.rowFieldLabel}>{field.q}</Text>
                                                <TextInput
                                                    style={[styles.inputStyle, readOnly && styles.inputDisabled]}
                                                    value={val}
                                                    onChangeText={(val) => handleAnswer(field.q, val)}
                                                    keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                                                    editable={!readOnly}
                                                />
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                        </View>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    panel: { width: '100%' },
    panelTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
    questionsContainer: { gap: 4 },
    fieldStyle: { marginBottom: 18, padding: 16, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    labelStyle: { fontWeight: 'bold', fontSize: 14, color: '#1e293b', marginBottom: 10 },
    inputStyle: { width: '100%', paddingHorizontal: 14, paddingVertical: 10, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, fontSize: 14, color: '#1e293b', backgroundColor: 'white' },
    inputDisabled: { backgroundColor: '#f8fafc' },
    textareaStyle: { minHeight: 80, textAlignVertical: 'top' },
    checkboxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    checkboxCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, backgroundColor: '#fafafa', minWidth: 150 },
    checkboxCardChecked: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
    checkboxBox: { width: 18, height: 18, borderWidth: 1.5, borderColor: '#94a3b8', borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
    checkboxBoxChecked: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
    checkboxText: { fontSize: 14, color: '#334155', fontWeight: '400' },
    checkboxTextChecked: { color: '#1e40af', fontWeight: '600' },
    complexGroupContainer: { backgroundColor: '#f8fafc', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    complexCheckboxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    complexCheckboxRow: { flexDirection: 'column', gap: 4, minWidth: 180, flex: 1 },
    extraRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', gap: 10 },
    extraLabel: { fontSize: 13, color: '#64748b', fontWeight: 'bold' },
    rowTypeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    rowFieldCol: { flex: 1, minWidth: 120 },
    rowFieldLabel: { fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 6 }
});

export default DynamicQuestionForm;
