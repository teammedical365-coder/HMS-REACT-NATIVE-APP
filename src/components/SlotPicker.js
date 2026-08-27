import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { publicAPI } from '../utils/api';
import { Feather } from '@expo/vector-icons';

const DEFAULT_TIME_SLOTS = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30'
];

const parseDateRobust = (dateStr) => {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? new Date() : dateStr;
    const str = String(dateStr).trim();
    const dmyMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (dmyMatch) {
        const [_, d, m, y] = dmyMatch;
        return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00Z`);
    }
    const ymdMatch = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (ymdMatch) {
        const [_, y, m, d] = ymdMatch;
        return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00Z`);
    }
    const parsed = new Date(str);
    if (isNaN(parsed.getTime())) return new Date();
    return parsed;
};

const isSlotInPast = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return false;
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const slotDate = parseDateRobust(dateStr);
    slotDate.setHours(hours, minutes, 0, 0);
    return slotDate < now;
};

const SlotPicker = ({ doctorId, date, selectedTime, onSelectTime }) => {
    const [bookedSlots, setBookedSlots] = useState([]);
    const [timeSlots, setTimeSlots] = useState(DEFAULT_TIME_SLOTS);
    const [isAvailable, setIsAvailable] = useState(true);
    const [workingHours, setWorkingHours] = useState({ start: '09:00', end: '17:30', day: '' });
    const [doctorName, setDoctorName] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!doctorId || !date) {
            setBookedSlots([]);
            setTimeSlots(DEFAULT_TIME_SLOTS);
            setIsAvailable(true);
            return;
        }
        
        const fetchSlots = async () => {
            setLoading(true);
            try {
                const res = await publicAPI.getBookedSlots(doctorId, date);
                if (res.success) {
                    setBookedSlots(res.bookedSlots || []);
                    setIsAvailable(res.available !== false);
                    setWorkingHours({
                        start: res.startTime || '09:00',
                        end: res.endTime || '17:30',
                        day: res.dayName || ''
                    });
                    if (res.doctor?.name) {
                        setDoctorName(res.doctor.name);
                    }

                    if (Array.isArray(res.timeSlots) && res.timeSlots.length > 0) {
                        setTimeSlots(res.timeSlots);
                    } else if (res.available === false) {
                        setTimeSlots([]);
                    } else {
                        const start = res.startTime || '09:00';
                        const end = res.endTime || '17:30';
                        const [sH, sM] = start.split(':').map(Number);
                        const [eH, eM] = end.split(':').map(Number);
                        let cur = (sH || 0) * 60 + (sM || 0);
                        const endM = (eH || 0) * 60 + (eM || 0);
                        const genSlots = [];
                        while (cur < endM) {
                            const h = Math.floor(cur / 60);
                            const m = cur % 60;
                            genSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                            cur += 30;
                        }
                        setTimeSlots(genSlots.length > 0 ? genSlots : DEFAULT_TIME_SLOTS);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch booked slots', err);
                setBookedSlots([]);
                setTimeSlots(DEFAULT_TIME_SLOTS);
            } finally {
                setLoading(false);
            }
        };

        fetchSlots();
    }, [doctorId, date]);

    if (!doctorId || !date) {
        return (
            <View style={styles.messageBox}>
                <Text style={styles.messageText}>Select a doctor and date to view available slots.</Text>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={[styles.messageBox, { flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
                <ActivityIndicator size="small" color="#64748b" />
                <Text style={styles.messageText}>Loading doctor's availability & slots...</Text>
            </View>
        );
    }

    if (!isAvailable) {
        const formattedDay = workingHours.day ? (workingHours.day.charAt(0).toUpperCase() + workingHours.day.slice(1)) : 'this day';
        return (
            <View style={styles.notAvailableBox}>
                <Text style={styles.notAvailableIcon}>📅</Text>
                <View style={styles.notAvailableTextCol}>
                    <Text style={styles.notAvailableTitle}>Doctor Not Available on {formattedDay}s</Text>
                    <Text style={styles.notAvailableSub}>
                        {doctorName ? `Dr. ${doctorName.replace(/^Dr\.?\s*/i, '')}` : 'This specialist'} has no scheduled consultation hours on this day. Please select another date.
                    </Text>
                </View>
            </View>
        );
    }

    const formattedDay = workingHours.day ? (workingHours.day.charAt(0).toUpperCase() + workingHours.day.slice(1)) : '';

    return (
        <View style={styles.container}>
            <View style={styles.banner}>
                <Text style={styles.bannerTextMain}>
                    🕒 Working Hours {formattedDay ? `(${formattedDay})` : ''}: <Text style={{ color: '#14532d', fontSize: 14 }}>{workingHours.start} - {workingHours.end}</Text>
                </Text>
                <Text style={styles.bannerTextSub}>{timeSlots.length} Total Slots (30 min)</Text>
            </View>

            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendBox, styles.bgAvailable]} />
                    <Text style={styles.legendText}>Available</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendBox, styles.bgBooked]} />
                    <Text style={styles.legendText}>Booked</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendBox, styles.bgBlocked]} />
                    <Text style={styles.legendText}>Past/Blocked</Text>
                </View>
            </View>
            
            <View style={styles.grid}>
                {timeSlots.map(time => {
                    const isBooked = bookedSlots.includes(time);
                    const isPast = isSlotInPast(date, time);
                    const isDisabled = isBooked || isPast;
                    const isSelected = selectedTime === time;

                    let btnStyle = styles.slotBtnAvailable;
                    let txtStyle = styles.slotTxtAvailable;

                    if (isSelected) {
                        btnStyle = styles.slotBtnSelected;
                        txtStyle = styles.slotTxtSelected;
                    } else if (isBooked) {
                        btnStyle = styles.slotBtnBooked;
                        txtStyle = styles.slotTxtBooked;
                    } else if (isPast) {
                        btnStyle = styles.slotBtnBlocked;
                        txtStyle = styles.slotTxtBlocked;
                    }

                    return (
                        <TouchableOpacity
                            key={time}
                            style={[styles.slotBtn, btnStyle]}
                            onPress={() => !isDisabled && onSelectTime(time)}
                            disabled={isDisabled}
                        >
                            <Text style={[styles.slotTxt, txtStyle]}>{time}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    messageBox: { padding: 16, backgroundColor: '#f8fafc', borderRadius: 8, marginVertical: 10, alignItems: 'center' },
    messageText: { color: '#64748b', fontSize: 14 },
    notAvailableBox: { padding: 16, backgroundColor: '#fff7ed', borderWidth: 1.5, borderColor: '#ffedd5', borderRadius: 10, marginVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
    notAvailableIcon: { fontSize: 28 },
    notAvailableTextCol: { flex: 1 },
    notAvailableTitle: { fontWeight: 'bold', fontSize: 15, color: '#9a3412' },
    notAvailableSub: { fontSize: 13, color: '#c2410c', marginTop: 4 },
    container: { marginVertical: 10, width: '100%' },
    banner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 8, marginBottom: 12, flexWrap: 'wrap', gap: 8 },
    bannerTextMain: { fontSize: 13, color: '#166534', fontWeight: 'bold' },
    bannerTextSub: { fontSize: 12, color: '#15803d', fontWeight: 'bold' },
    legendRow: { flexDirection: 'row', gap: 16, marginBottom: 12, justifyContent: 'center', flexWrap: 'wrap' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendBox: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
    legendText: { fontSize: 13, color: '#475569', fontWeight: '500' },
    bgAvailable: { backgroundColor: '#e0e7ff', borderColor: '#c7d2fe' },
    bgBooked: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
    bgBlocked: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    slotBtn: { width: 75, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    slotTxt: { fontSize: 14, fontWeight: 'bold' },
    slotBtnAvailable: { backgroundColor: '#e0e7ff', borderColor: '#c7d2fe' },
    slotTxtAvailable: { color: '#4338ca' },
    slotBtnSelected: { backgroundColor: '#4f46e5', borderColor: '#4338ca' },
    slotTxtSelected: { color: 'white' },
    slotBtnBooked: { backgroundColor: '#fee2e2', borderColor: '#fca5a5', opacity: 0.8 },
    slotTxtBooked: { color: '#b91c1c', textDecorationLine: 'line-through' },
    slotBtnBlocked: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', opacity: 0.6 },
    slotTxtBlocked: { color: '#94a3b8' }
});

export default SlotPicker;
