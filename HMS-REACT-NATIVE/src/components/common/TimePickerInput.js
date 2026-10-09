import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Feather } from '@expo/vector-icons';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const QUICK_PRESETS = [
    { label: 'Now', getVal: () => {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }},
    { label: '09:00', getVal: () => '09:00' },
    { label: '10:00', getVal: () => '10:00' },
    { label: '11:00', getVal: () => '11:00' },
    { label: '12:00', getVal: () => '12:00' },
    { label: '14:00', getVal: () => '14:00' },
    { label: '16:00', getVal: () => '16:00' },
    { label: '18:00', getVal: () => '18:00' },
];

/**
 * Universal TimePickerInput
 * On Web: Renders a true HTML5 <input type="time"> with exact Web CSS styles.
 * On Native: Renders an interactive native time-picker dialog with operating-system
 *            wheel/spinner Picker and quick presets. 0 typing required.
 */
const TimePickerInput = ({
    value = '',
    onChange = () => {},
    placeholder = 'HH:mm',
    style,
    inputStyle,
    disabled = false,
    title = 'Select Time',
    insideModal = false,
}) => {
    const parseInitial = (val) => {
        if (typeof val === 'string' && val.trim()) {
            const match = val.trim().match(/^(\d{1,2}):(\d{2})/);
            if (match) {
                const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
                const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
                return {
                    h: String(h).padStart(2, '0'),
                    m: String(m).padStart(2, '0')
                };
            }
        }
        const now = new Date();
        return {
            h: String(now.getHours()).padStart(2, '0'),
            m: '00'
        };
    };

    const [modalVisible, setModalVisible] = useState(false);
    const initial = parseInitial(value);
    const [selectedHour, setSelectedHour] = useState(initial.h);
    const [selectedMinute, setSelectedMinute] = useState(initial.m);

    useEffect(() => {
        if (modalVisible) {
            const parsed = parseInitial(value);
            setSelectedHour(parsed.h);
            setSelectedMinute(parsed.m);
        }
    }, [modalVisible, value]);

    if (Platform.OS === 'web') {
        return (
            <div style={{ position: 'relative', width: '100%', maxWidth: '100%', minWidth: 0, display: 'flex', alignItems: 'center', boxSizing: 'border-box', ...(typeof style === 'object' ? style : {}) }}>
                <input
                    type="time"
                    value={value || ''}
                    disabled={disabled}
                    onChange={(e) => {
                        onChange(e.target.value);
                    }}
                    style={{
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: 0,
                        height: '44px',
                        minHeight: '44px',
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
                        transitionProperty: 'border-color, box-shadow',
                        transitionDuration: '0.2s',
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

    const handleApply = () => {
        const timeStr = `${selectedHour}:${selectedMinute}`;
        onChange(timeStr);
        setModalVisible(false);
    };

    const handleClear = () => {
        onChange('');
        setModalVisible(false);
    };

    return (
        <View style={[styles.container, style]}>
            <TouchableOpacity
                style={[styles.touchField, disabled && styles.touchFieldDisabled, inputStyle]}
                onPress={() => {
                    if (!disabled) {
                        const parsed = parseInitial(value);
                        setSelectedHour(parsed.h);
                        setSelectedMinute(parsed.m);
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
                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="clock" size={18} color="#2563eb" />
                                <Text style={styles.modalTitle}>{title}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}>
                                <Text style={styles.closeBtn}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Digital Time Preview Banner */}
                        <View style={styles.digitalDisplay}>
                            <View style={styles.digitalUnit}>
                                <Text style={styles.digitalText}>{selectedHour}</Text>
                                <Text style={styles.digitalSub}>HOUR (24h)</Text>
                            </View>
                            <Text style={styles.digitalColon}>:</Text>
                            <View style={styles.digitalUnit}>
                                <Text style={styles.digitalText}>{selectedMinute}</Text>
                                <Text style={styles.digitalSub}>MINUTE</Text>
                            </View>
                        </View>

                        {/* Quick Presets */}
                        <View style={styles.presetSection}>
                            <Text style={styles.presetSectionTitle}>QUICK PRESETS</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
                                {QUICK_PRESETS.map((p) => (
                                    <TouchableOpacity
                                        key={p.label}
                                        style={styles.presetChip}
                                        onPress={() => {
                                            const val = p.getVal();
                                            const [h, m] = val.split(':');
                                            setSelectedHour(h);
                                            setSelectedMinute(m);
                                        }}
                                    >
                                        <Text style={styles.presetChipText}>{p.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Interactive Picker Wheels */}
                        <View style={styles.pickerSection}>
                            <View style={styles.pickerColumn}>
                                <Text style={styles.columnLabel}>Hour</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={selectedHour}
                                        onValueChange={(itemValue) => setSelectedHour(itemValue)}
                                        style={styles.nativePicker}
                                        itemStyle={styles.pickerItem}
                                    >
                                        {HOURS.map((h) => (
                                            <Picker.Item key={h} label={h} value={h} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>

                            <View style={styles.pickerDivider}>
                                <Text style={styles.pickerDividerColon}>:</Text>
                            </View>

                            <View style={styles.pickerColumn}>
                                <Text style={styles.columnLabel}>Minute</Text>
                                <View style={styles.pickerWrapper}>
                                    <Picker
                                        selectedValue={selectedMinute}
                                        onValueChange={(itemValue) => setSelectedMinute(itemValue)}
                                        style={styles.nativePicker}
                                        itemStyle={styles.pickerItem}
                                    >
                                        {MINUTES.map((m) => (
                                            <Picker.Item key={m} label={m} value={m} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>
                        </View>

                        {/* Actions */}
                        <View style={styles.modalFooter}>
                            {Boolean(value) && (
                                <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                                    <Text style={styles.clearBtnText}>Clear</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
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
        height: 44,
        minHeight: 44,
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
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 10,
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
    digitalDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 20,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    digitalUnit: {
        alignItems: 'center',
        minWidth: 70,
    },
    digitalText: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1e293b',
        fontVariant: ['tabular-nums'],
    },
    digitalSub: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748b',
        marginTop: 2,
    },
    digitalColon: {
        fontSize: 30,
        fontWeight: '800',
        color: '#94a3b8',
        marginHorizontal: 12,
        marginBottom: 12,
    },
    presetSection: {
        marginBottom: 14,
    },
    presetSectionTitle: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94a3b8',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    presetRow: {
        flexDirection: 'row',
        gap: 6,
        paddingVertical: 2,
    },
    presetChip: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    presetChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
    },
    pickerSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    pickerColumn: {
        flex: 1,
        alignItems: 'center',
    },
    columnLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    pickerWrapper: {
        width: '100%',
        height: 120,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    nativePicker: {
        width: '100%',
        height: 120,
    },
    pickerItem: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    pickerDivider: {
        width: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pickerDividerColon: {
        fontSize: 24,
        fontWeight: '800',
        color: '#64748b',
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 10,
    },
    clearBtn: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
        marginRight: 'auto',
    },
    clearBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ef4444',
    },
    cancelBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
    },
    cancelBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
    },
    applyBtn: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
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
