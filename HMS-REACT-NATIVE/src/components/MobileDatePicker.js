import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';

const MobileDatePicker = ({ value, onChange, min, max, disabled, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const parseDate = (dateStr) => {
        if (!dateStr) return new Date();
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        return new Date();
    };

    const [currentMonth, setCurrentMonth] = useState(() => parseDate(value));
    const [viewMode, setViewMode] = useState('days'); // days, months, years
    const [yearPage, setYearPage] = useState(() => parseDate(value).getFullYear());
    
    useEffect(() => {
        if (value) setCurrentMonth(parseDate(value));
    }, [value]);

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const generateCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const totalDays = daysInMonth(year, month);
        const firstDay = firstDayOfMonth(year, month);
        
        let days = [];
        let firstDayAdjusted = firstDay === 0 ? 6 : firstDay - 1; // Mon = 0, Sun = 6
        days = Array(firstDayAdjusted).fill(null);
        
        for (let i = 1; i <= totalDays; i++) days.push(i);
        return days;
    };

    const handleDateSelect = (day) => {
        if (!day) return;
        const year = currentMonth.getFullYear();
        const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateString = `${year}-${month}-${dayStr}`;
        
        if (onChange) {
            onChange({ target: { value: dateString } }, dateString);
        }
        setIsOpen(false);
    };

    const formatDisplayDate = (val) => {
        if (!val) return '';
        const parts = val.split('-');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`; 
        return val;
    };

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const weekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    const daysArray = generateCalendar();

    return (
        <View style={styles.container}>
            <TouchableOpacity 
                style={[styles.trigger, disabled && styles.triggerDisabled]} 
                onPress={() => {
                    if (!disabled) {
                        setIsOpen(true);
                        setViewMode('days');
                    }
                }}
            >
                <Text style={[styles.triggerText, !value && {color: '#94a3b8'}]}>
                    {value ? formatDisplayDate(value) : (placeholder || 'DD-MM-YYYY')}
                </Text>
                <Text style={{fontSize: 16}}>📅</Text>
            </TouchableOpacity>

            <Modal visible={isOpen} transparent animationType="fade">
                <View style={styles.overlay}>
                    <View style={styles.popover}>
                        {viewMode === 'days' && (
                            <View>
                                <View style={styles.headerRow}>
                                    <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
                                        <Text style={styles.navBtn}>{'<'}</Text>
                                    </TouchableOpacity>
                                    <View style={styles.headerTitleRow}>
                                        <TouchableOpacity onPress={() => setViewMode('months')}>
                                            <Text style={styles.headerTitle}>{monthNames[currentMonth.getMonth()]}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => { setViewMode('years'); setYearPage(currentMonth.getFullYear()); }}>
                                            <Text style={styles.headerTitle}>{currentMonth.getFullYear()}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>
                                        <Text style={styles.navBtn}>{'>'}</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.weekDaysRow}>
                                    {weekDays.map(d => <Text key={d} style={styles.weekDayText}>{d}</Text>)}
                                </View>

                                <View style={styles.daysGrid}>
                                    {daysArray.map((day, idx) => {
                                        if (!day) return <View key={`empty-${idx}`} style={styles.dayCell} />;
                                        
                                        const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        const isSelected = value === dateStr;
                                        const isToday = new Date().toISOString().split('T')[0] === dateStr;
                                        
                                        let isOutOfRange = false;
                                        if (min && dateStr < min) isOutOfRange = true;
                                        if (max && dateStr > max) isOutOfRange = true;

                                        return (
                                            <TouchableOpacity 
                                                key={idx} 
                                                style={[
                                                    styles.dayCell, 
                                                    isSelected && styles.dayCellSelected,
                                                    isOutOfRange && {opacity: 0.3}
                                                ]}
                                                onPress={() => !isOutOfRange && handleDateSelect(day)}
                                                disabled={isOutOfRange}
                                            >
                                                <Text style={[
                                                    styles.dayText, 
                                                    isSelected && styles.dayTextSelected,
                                                    isToday && !isSelected && {color: '#6366f1'}
                                                ]}>{day}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {viewMode === 'months' && (
                            <View>
                                <View style={styles.headerRow}>
                                    <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1))}>
                                        <Text style={styles.navBtn}>{'<'}</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.headerTitle}>{currentMonth.getFullYear()}</Text>
                                    <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth(), 1))}>
                                        <Text style={styles.navBtn}>{'>'}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.gridContainer}>
                                    {monthNames.map((m, i) => (
                                        <TouchableOpacity 
                                            key={m} 
                                            style={[styles.gridCell, currentMonth.getMonth() === i && styles.dayCellSelected]}
                                            onPress={() => { setCurrentMonth(new Date(currentMonth.getFullYear(), i, 1)); setViewMode('days'); }}
                                        >
                                            <Text style={[styles.dayText, currentMonth.getMonth() === i && styles.dayTextSelected]}>{m}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {viewMode === 'years' && (
                            <View>
                                <View style={styles.headerRow}>
                                    <TouchableOpacity onPress={() => setYearPage(yearPage - 12)}>
                                        <Text style={styles.navBtn}>{'<'}</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.headerTitle}>{yearPage - 4} - {yearPage + 7}</Text>
                                    <TouchableOpacity onPress={() => setYearPage(yearPage + 12)}>
                                        <Text style={styles.navBtn}>{'>'}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.gridContainer}>
                                    {Array.from({length: 12}).map((_, i) => {
                                        const y = yearPage - 4 + i;
                                        return (
                                            <TouchableOpacity 
                                                key={y} 
                                                style={[styles.gridCell, currentMonth.getFullYear() === y && styles.dayCellSelected]}
                                                onPress={() => { setCurrentMonth(new Date(y, currentMonth.getMonth(), 1)); setViewMode('months'); }}
                                            >
                                                <Text style={[styles.dayText, currentMonth.getFullYear() === y && styles.dayTextSelected]}>{y}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        <View style={styles.footerRow}>
                            <TouchableOpacity onPress={() => { if(onChange) onChange({target: {value: ''}}, ''); setIsOpen(false); }}>
                                <Text style={styles.footerBtnText}>Clear</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{marginLeft: 20}} onPress={() => setIsOpen(false)}>
                                <Text style={styles.footerBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{marginLeft: 'auto'}} onPress={() => {
                                const today = new Date();
                                const dStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
                                if(onChange) onChange({target: {value: dStr}}, dStr);
                                setIsOpen(false);
                            }}>
                                <Text style={[styles.footerBtnText, {color: '#6366f1'}]}>Today</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', marginVertical: 4 },
    trigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, backgroundColor: 'white' },
    triggerDisabled: { backgroundColor: '#f1f5f9' },
    triggerText: { fontSize: 15, color: '#1e293b' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    popover: { backgroundColor: 'white', borderRadius: 16, padding: 20, width: 320, elevation: 10 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    navBtn: { fontSize: 24, color: '#475569', paddingHorizontal: 10 },
    headerTitleRow: { flexDirection: 'row', gap: 12 },
    headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    weekDaysRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
    weekDayText: { fontSize: 12, fontWeight: '600', color: '#64748b', width: 35, textAlign: 'center' },
    daysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
    dayCell: { width: 35, height: 35, justifyContent: 'center', alignItems: 'center', marginVertical: 2, borderRadius: 18 },
    dayCellSelected: { backgroundColor: '#6366f1' },
    dayText: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
    dayTextSelected: { color: 'white', fontWeight: 'bold' },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    gridCell: { width: '30%', height: 40, justifyContent: 'center', alignItems: 'center', marginVertical: 6, borderRadius: 8, backgroundColor: '#f8fafc' },
    footerRow: { flexDirection: 'row', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    footerBtnText: { color: '#64748b', fontWeight: 'bold', fontSize: 14 }
});

export default MobileDatePicker;
