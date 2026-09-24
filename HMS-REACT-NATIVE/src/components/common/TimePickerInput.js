import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';

/**
 * Universal TimePickerInput
 * On Web: Renders a true HTML5 <input type="time"> with exact Web CSS styles,
 *         offering native time selection matching Web.
 * On Native: Renders a formatted time selector with clock icon and validation.
 */
const TimePickerInput = ({
    value = '',
    onChange = () => {},
    placeholder = 'HH:mm',
    style,
    inputStyle,
    disabled = false,
    title = 'Select Time',
}) => {
    if (Platform.OS === 'web') {
        return (
            <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                <input
                    type="time"
                    value={value || ''}
                    disabled={disabled}
                    onChange={(e) => {
                        onChange(e.target.value);
                    }}
                    style={{
                        width: '100%',
                        height: '42px',
                        padding: '8px 14px',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontSize: '14px',
                        fontWeight: '600',
                        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        ...inputStyle,
                    }}
                    onFocus={(e) => {
                        e.target.style.borderColor = '#2563eb';
                        e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.15)';
                    }}
                    onBlur={(e) => {
                        e.target.style.borderColor = '#cbd5e1';
                        e.target.style.boxShadow = 'none';
                    }}
                />
            </div>
        );
    }

    // Native Fallback
    const [modalVisible, setModalVisible] = useState(false);
    const [tempTime, setTempTime] = useState(value || '');

    const handleApply = () => {
        // Validate HH:mm
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (tempTime && timeRegex.test(tempTime)) {
            onChange(tempTime);
            setModalVisible(false);
        } else if (!tempTime) {
            onChange('');
            setModalVisible(false);
        }
    };

    return (
        <View style={[styles.container, style]}>
            <TouchableOpacity
                style={[styles.touchField, disabled && styles.touchFieldDisabled]}
                onPress={() => {
                    if (!disabled) {
                        setTempTime(value || '');
                        setModalVisible(true);
                    }
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={title}
            >
                <Feather name="clock" size={16} color="#64748b" style={{ marginRight: 8 }} />
                <Text style={[styles.touchText, !value && styles.placeholderText]}>
                    {value || placeholder}
                </Text>
            </TouchableOpacity>

            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalBackdrop}
                    activeOpacity={1}
                    onPress={() => setModalVisible(false)}
                >
                    <TouchableOpacity style={styles.modalCard} activeOpacity={1} onPress={(e) => e.stopPropagation?.()}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{title}</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Text style={styles.closeBtn}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={styles.inputLabel}>Enter Time (24h HH:mm)</Text>
                            <TextInput
                                style={styles.nativeInput}
                                value={tempTime}
                                onChangeText={setTempTime}
                                placeholder="HH:mm (e.g. 14:30)"
                                placeholderTextColor="#94a3b8"
                                maxLength={5}
                                keyboardType="numbers-and-punctuation"
                            />
                        </View>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.applyBtn}
                                onPress={handleApply}
                            >
                                <Text style={styles.applyBtnText}>Set Time</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    touchField: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 42,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
    },
    touchFieldDisabled: {
        backgroundColor: '#f1f5f9',
        borderColor: '#e2e8f0',
    },
    touchText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
    },
    placeholderText: {
        color: '#94a3b8',
        fontWeight: '400',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 20,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0f172a',
    },
    closeBtn: {
        fontSize: 16,
        color: '#64748b',
        fontWeight: '700',
    },
    modalBody: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    nativeInput: {
        height: 42,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
    },
    cancelBtn: {
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
    },
    cancelBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
    },
    applyBtn: {
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: '#2563eb',
    },
    applyBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
});

export default TimePickerInput;
