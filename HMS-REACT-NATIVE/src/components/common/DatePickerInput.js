import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Platform,
    Pressable
} from 'react-native';
import { Feather } from '@expo/vector-icons';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/**
 * Safely parses any date value without timezone day shifts.
 * Returns local Date object or null.
 */
export const parseSafeDate = (val) => {
    if (!val) return null;
    if (typeof val === 'string') {
        const str = val.trim();
        // Match DD-Mon-YYYY (e.g. 11-Oct-2028, 11-OCT-2028, 11 Oct 2028)
        const dMonYMatch = str.match(/^(\d{1,2})[\/\-\s]([A-Za-z]{3,9})[\/\-\s](\d{4})/);
        if (dMonYMatch) {
            const day = parseInt(dMonYMatch[1], 10);
            const mStr = dMonYMatch[2].slice(0, 3).toLowerCase();
            const month = MONTH_NAMES.findIndex(m => m.toLowerCase() === mStr);
            const year = parseInt(dMonYMatch[3], 10);
            if (month !== -1) {
                return new Date(year, month, day);
            }
        }
        // Match YYYY-MM-DD or leading ISO date part
        const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (ymdMatch) {
            const year = parseInt(ymdMatch[1], 10);
            const month = parseInt(ymdMatch[2], 10) - 1;
            const day = parseInt(ymdMatch[3], 10);
            return new Date(year, month, day);
        }
        // Match DD-MM-YYYY or DD/MM/YYYY
        const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10) - 1;
            const year = parseInt(dmyMatch[3], 10);
            return new Date(year, month, day);
        }
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};

/**
 * Format local Date object to standard YYYY-MM-DD string for storage/API.
 */
export const formatToYMD = (val) => {
    const d = val instanceof Date ? val : parseSafeDate(val);
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Format any date value to user-facing DD-Mon-YYYY (e.g., 11-Oct-2028).
 */
export const formatToDisplay = (val) => {
    const d = parseSafeDate(val);
    if (!d) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

/**
 * Universal Native + Web DatePickerInput
 * - Android: Opens native touch calendar modal dialog with 0 typing required.
 * - iOS: Opens native touch calendar modal dialog with 0 typing required.
 * - Web: Native HTML5 date input with DD-Mon-YYYY parity.
 * - Display format: DD-Mon-YYYY (e.g., 11-Oct-2028)
 * - API/Storage format: YYYY-MM-DD
 */
const DatePickerInput = ({
    value = '',
    onChange = () => {},
    placeholder = 'DD-Mon-YYYY',
    min,
    max,
    minimumDate,
    maximumDate,
    style,
    inputStyle,
    disabled = false,
    title = 'Select Date',
    label,
    error,
    required = false,
    insideModal = false,
    allowClear = true,
}) => {
    const minVal = min || minimumDate;
    const maxVal = max || maximumDate;

    // Web Platform: Native HTML5 date input
    if (Platform.OS === 'web') {
        const rawYMD = formatToYMD(parseSafeDate(value));
        const minYMD = minVal ? formatToYMD(parseSafeDate(minVal)) : undefined;
        const maxYMD = maxVal ? formatToYMD(parseSafeDate(maxVal)) : undefined;

        return (
            <View style={[styles.container, style]}>
                {label && (
                    <Text style={styles.fieldLabel}>
                        {label} {required && <Text style={{ color: '#ef4444' }}>*</Text>}
                    </Text>
                )}
                <div style={{ position: 'relative', width: '100%', maxWidth: '100%', minWidth: 0, display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
                    <style dangerouslySetInnerHTML={{ __html: `
                        .hms-date-picker-input::-webkit-calendar-picker-indicator {
                            position: absolute;
                            left: 10px;
                            top: 50%;
                            transform: translateY(-50%);
                            cursor: pointer;
                            opacity: 0.75;
                        }
                        .hms-date-picker-input::-webkit-calendar-picker-indicator:hover {
                            opacity: 1;
                        }
                    `}} />
                    <input
                        type="date"
                        className="hms-date-picker-input"
                        value={rawYMD}
                        min={minYMD}
                        max={maxYMD}
                        disabled={disabled}
                        onChange={(e) => {
                            onChange(e.target.value);
                        }}
                        onClick={(e) => {
                            try {
                                if (!disabled && typeof e.target.showPicker === 'function') {
                                    e.target.showPicker();
                                }
                            } catch (_) {}
                        }}
                        style={{
                            width: '100%',
                            maxWidth: '100%',
                            minWidth: 0,
                            height: '42px',
                            padding: '8px 14px 8px 36px',
                            borderRadius: '10px',
                            border: error ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1',
                            backgroundColor: disabled ? '#f1f5f9' : '#ffffff',
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
                    />
                </div>
                {error && <Text style={styles.errorText}>{error}</Text>}
            </View>
        );
    }

    // Native Platform: Pure Native Touch Calendar Picker (Android & iOS)
    const [isOpen, setIsOpen] = useState(false);
    const parsedCurrent = parseSafeDate(value);
    const [currentMonth, setCurrentMonth] = useState(() => parsedCurrent || new Date());
    const [viewMode, setViewMode] = useState('days'); // 'days' | 'months' | 'years'
    const [yearPage, setYearPage] = useState(() => (parsedCurrent || new Date()).getFullYear());

    useEffect(() => {
        if (value) {
            const parsed = parseSafeDate(value);
            if (parsed) {
                setCurrentMonth(parsed);
                setYearPage(parsed.getFullYear());
            }
        }
    }, [value]);

    const displayDate = formatToDisplay(value);

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const generateCalendarDays = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const totalDays = daysInMonth(year, month);
        const firstDay = firstDayOfMonth(year, month);
        const firstDayAdjusted = firstDay === 0 ? 6 : firstDay - 1;

        const days = [];
        for (let i = 0; i < firstDayAdjusted; i++) {
            days.push(null);
        }
        for (let d = 1; d <= totalDays; d++) {
            days.push(d);
        }
        return days;
    };

    const handleSelectDay = (day) => {
        if (!day) return;
        const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const ymd = formatToYMD(selectedDate);
        onChange(ymd);
        setIsOpen(false);
    };

    const handleClear = () => {
        onChange('');
        setIsOpen(false);
    };

    const handleToday = () => {
        const today = new Date();
        const ymd = formatToYMD(today);
        onChange(ymd);
        setCurrentMonth(today);
        setIsOpen(false);
    };

    const isDateOutOfRange = (year, month, day) => {
        const targetStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (minVal) {
            const minStr = formatToYMD(parseSafeDate(minVal));
            if (minStr && targetStr < minStr) return true;
        }
        if (maxVal) {
            const maxStr = formatToYMD(parseSafeDate(maxVal));
            if (maxStr && targetStr > maxStr) return true;
        }
        return false;
    };

    const selectedYMD = formatToYMD(parsedCurrent);
    const todayYMD = formatToYMD(new Date());
    const daysArray = generateCalendarDays();

    return (
        <View style={[styles.container, style]}>
            {label && (
                <Text style={styles.fieldLabel}>
                    {label} {required && <Text style={{ color: '#ef4444' }}>*</Text>}
                </Text>
            )}

            <TouchableOpacity
                style={[
                    styles.trigger,
                    disabled && styles.triggerDisabled,
                    error && styles.triggerError,
                    inputStyle
                ]}
                onPress={() => {
                    if (!disabled) {
                        const parsed = parseSafeDate(value) || new Date();
                        setCurrentMonth(parsed);
                        setYearPage(parsed.getFullYear());
                        setViewMode('days');
                        setIsOpen(true);
                    }
                }}
                activeOpacity={0.7}
                disabled={disabled}
            >
                <Feather name="calendar" size={16} color={disabled ? "#94a3b8" : "#0284c7"} style={{ marginRight: 8 }} />
                <Text style={[styles.triggerText, !displayDate && styles.placeholderText]}>
                    {displayDate || placeholder}
                </Text>

                {allowClear && !disabled && displayDate ? (
                    <TouchableOpacity
                        onPress={(e) => {
                            e.stopPropagation();
                            handleClear();
                        }}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        style={styles.clearBtn}
                    >
                        <Feather name="x" size={14} color="#94a3b8" />
                    </TouchableOpacity>
                ) : null}
            </TouchableOpacity>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {/* Native Calendar Modal */}
            <Modal
                visible={isOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsOpen(false)}
                statusBarTranslucent={true}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
                    <Pressable style={styles.calendarCard} onPress={(e) => e.stopPropagation()}>
                        {/* Header Bar */}
                        <View style={styles.calendarHeader}>
                            <TouchableOpacity
                                style={styles.navArrow}
                                onPress={() => {
                                    if (viewMode === 'days') {
                                        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
                                    } else if (viewMode === 'months') {
                                        setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1));
                                    } else if (viewMode === 'years') {
                                        setYearPage(yearPage - 12);
                                    }
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Feather name="chevron-left" size={20} color="#334155" />
                            </TouchableOpacity>

                            <View style={styles.headerTitleContainer}>
                                <TouchableOpacity
                                    style={[styles.headerTab, viewMode === 'months' && styles.headerTabActive]}
                                    onPress={() => setViewMode(viewMode === 'months' ? 'days' : 'months')}
                                >
                                    <Text style={[styles.headerTitleText, viewMode === 'months' && styles.headerTitleTextActive]}>
                                        {MONTH_NAMES[currentMonth.getMonth()]}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.headerTab, viewMode === 'years' && styles.headerTabActive]}
                                    onPress={() => {
                                        setYearPage(currentMonth.getFullYear());
                                        setViewMode(viewMode === 'years' ? 'days' : 'years');
                                    }}
                                >
                                    <Text style={[styles.headerTitleText, viewMode === 'years' && styles.headerTitleTextActive]}>
                                        {currentMonth.getFullYear()}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={styles.navArrow}
                                onPress={() => {
                                    if (viewMode === 'days') {
                                        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
                                    } else if (viewMode === 'months') {
                                        setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth(), 1));
                                    } else if (viewMode === 'years') {
                                        setYearPage(yearPage + 12);
                                    }
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Feather name="chevron-right" size={20} color="#334155" />
                            </TouchableOpacity>
                        </View>

                        {/* Days View */}
                        {viewMode === 'days' && (
                            <View>
                                <View style={styles.weekDaysRow}>
                                    {WEEK_DAYS.map((wd) => (
                                        <Text key={wd} style={styles.weekDayText}>{wd}</Text>
                                    ))}
                                </View>

                                <View style={styles.daysGrid}>
                                    {daysArray.map((day, idx) => {
                                        if (day === null) {
                                            return <View key={`blank-${idx}`} style={styles.dayCellPlaceholder} />;
                                        }

                                        const y = currentMonth.getFullYear();
                                        const m = currentMonth.getMonth();
                                        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        const isSelected = selectedYMD === dateStr;
                                        const isToday = todayYMD === dateStr;
                                        const isOutOfRange = isDateOutOfRange(y, m, day);

                                        return (
                                            <TouchableOpacity
                                                key={`day-${day}`}
                                                style={[
                                                    styles.dayCell,
                                                    isSelected && styles.dayCellSelected,
                                                    isToday && !isSelected && styles.dayCellToday,
                                                    isOutOfRange && styles.dayCellDisabled
                                                ]}
                                                onPress={() => !isOutOfRange && handleSelectDay(day)}
                                                disabled={isOutOfRange}
                                                activeOpacity={0.7}
                                            >
                                                <Text
                                                    style={[
                                                        styles.dayText,
                                                        isSelected && styles.dayTextSelected,
                                                        isToday && !isSelected && styles.dayTextToday,
                                                        isOutOfRange && styles.dayTextDisabled
                                                    ]}
                                                >
                                                    {day}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Months Selector View */}
                        {viewMode === 'months' && (
                            <View style={styles.monthsGrid}>
                                {MONTH_NAMES.map((mName, mIdx) => {
                                    const isSelectedMonth = currentMonth.getMonth() === mIdx;
                                    return (
                                        <TouchableOpacity
                                            key={mName}
                                            style={[styles.monthCell, isSelectedMonth && styles.monthCellSelected]}
                                            onPress={() => {
                                                setCurrentMonth(new Date(currentMonth.getFullYear(), mIdx, 1));
                                                setViewMode('days');
                                            }}
                                        >
                                            <Text style={[styles.monthText, isSelectedMonth && styles.monthTextSelected]}>
                                                {mName}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {/* Years Selector View */}
                        {viewMode === 'years' && (
                            <View style={styles.yearsGrid}>
                                {Array.from({ length: 12 }).map((_, i) => {
                                    const yVal = yearPage - 4 + i;
                                    const isSelectedYear = currentMonth.getFullYear() === yVal;
                                    return (
                                        <TouchableOpacity
                                            key={yVal}
                                            style={[styles.yearCell, isSelectedYear && styles.yearCellSelected]}
                                            onPress={() => {
                                                setCurrentMonth(new Date(yVal, currentMonth.getMonth(), 1));
                                                setViewMode('months');
                                            }}
                                        >
                                            <Text style={[styles.yearText, isSelectedYear && styles.yearTextSelected]}>
                                                {yVal}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {/* Footer Controls */}
                        <View style={styles.calendarFooter}>
                            <TouchableOpacity style={styles.footerActionBtn} onPress={handleClear}>
                                <Text style={styles.footerActionClear}>Clear</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.footerActionBtn} onPress={handleToday}>
                                <Text style={styles.footerActionToday}>Today</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.footerActionDone} onPress={() => setIsOpen(false)}>
                                <Text style={styles.footerActionDoneText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 44,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
    },
    triggerDisabled: {
        backgroundColor: '#f1f5f9',
        borderColor: '#e2e8f0',
    },
    triggerError: {
        borderColor: '#ef4444',
    },
    triggerText: {
        fontSize: 13.5,
        fontWeight: '600',
        color: '#0f172a',
        flex: 1,
    },
    placeholderText: {
        color: '#94a3b8',
        fontWeight: '500',
    },
    clearBtn: {
        padding: 4,
        marginLeft: 6,
    },
    errorText: {
        fontSize: 11,
        color: '#ef4444',
        marginTop: 4,
        fontWeight: '600',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    calendarCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        elevation: 10,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    navArrow: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: '#f8fafc',
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headerTab: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    headerTabActive: {
        backgroundColor: '#e0f2fe',
    },
    headerTitleText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#334155',
    },
    headerTitleTextActive: {
        color: '#0284c7',
    },
    weekDaysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    weekDayText: {
        width: 38,
        textAlign: 'center',
        fontSize: 11,
        fontWeight: '700',
        color: '#64748b',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    dayCellPlaceholder: {
        width: 38,
        height: 38,
        marginVertical: 2,
    },
    dayCell: {
        width: 38,
        height: 38,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 2,
        borderRadius: 8,
    },
    dayCellSelected: {
        backgroundColor: '#0284c7',
    },
    dayCellToday: {
        borderWidth: 1.5,
        borderColor: '#0284c7',
    },
    dayCellDisabled: {
        opacity: 0.25,
    },
    dayText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1e293b',
    },
    dayTextSelected: {
        color: '#ffffff',
        fontWeight: '700',
    },
    dayTextToday: {
        color: '#0284c7',
        fontWeight: '700',
    },
    dayTextDisabled: {
        color: '#94a3b8',
    },
    monthsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    monthCell: {
        width: '30%',
        paddingVertical: 12,
        alignItems: 'center',
        marginVertical: 4,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
    },
    monthCellSelected: {
        backgroundColor: '#0284c7',
    },
    monthText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    monthTextSelected: {
        color: '#ffffff',
        fontWeight: '700',
    },
    yearsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    yearCell: {
        width: '30%',
        paddingVertical: 12,
        alignItems: 'center',
        marginVertical: 4,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
    },
    yearCellSelected: {
        backgroundColor: '#0284c7',
    },
    yearText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#334155',
    },
    yearTextSelected: {
        color: '#ffffff',
        fontWeight: '700',
    },
    calendarFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    footerActionBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    footerActionClear: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#ef4444',
    },
    footerActionToday: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#0284c7',
    },
    footerActionDone: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        backgroundColor: '#f1f5f9',
    },
    footerActionDoneText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#64748b',
    },
});

export default DatePickerInput;
