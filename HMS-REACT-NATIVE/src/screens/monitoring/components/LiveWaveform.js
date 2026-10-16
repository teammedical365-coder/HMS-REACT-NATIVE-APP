import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Polyline, Line, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { MOCK_ECG_DATA, MOCK_PLETH_DATA } from '../monitoringMockData';

export default function LiveWaveform({ heartRate = 72, spo2 = 98 }) {
  const [offset, setOffset] = useState(0);
  const heartScale = useRef(new Animated.Value(1)).current;

  // Pulse heart animation according to heart rate
  useEffect(() => {
    const bpm = Math.max(40, Math.min(180, heartRate || 72));
    const intervalMs = (60 / bpm) * 1000;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(heartScale, {
          toValue: 1.25,
          duration: 120,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(heartScale, {
          toValue: 1,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.delay(Math.max(100, intervalMs - 300)),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [heartRate, heartScale]);

  // Waveform scrolling animation
  useEffect(() => {
    const timer = setInterval(() => {
      setOffset((prev) => (prev + 1) % 400);
    }, 60);
    return () => clearInterval(timer);
  }, []);

  const rhythm =
    heartRate > 100
      ? { label: 'Sinus Tachycardia', color: '#f59e0b', bg: '#78350f40' }
      : heartRate < 60
      ? { label: 'Sinus Bradycardia', color: '#38bdf8', bg: '#0369a140' }
      : { label: 'Normal Sinus Rhythm', color: '#10b981', bg: '#064e3b40' };

  // Generate ECG Polyline string
  const renderECGPoints = (width = 300, height = 50) => {
    const totalPoints = 80;
    const pts = [];
    const baseline = height * 0.65;
    const ecgLen = MOCK_ECG_DATA.length;

    for (let i = 0; i < totalPoints; i++) {
      const x = (i / (totalPoints - 1)) * width;
      const dataIdx = (i + offset) % ecgLen;
      const val = MOCK_ECG_DATA[dataIdx] || 0;
      const y = baseline - val * (height * 0.55);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  };

  // Generate Pleth Polyline string
  const renderPlethPoints = (width = 300, height = 45) => {
    const totalPoints = 80;
    const pts = [];
    const baseline = height * 0.85;
    const plethLen = MOCK_PLETH_DATA.length;

    for (let i = 0; i < totalPoints; i++) {
      const x = (i / (totalPoints - 1)) * width;
      const dataIdx = (i + Math.floor(offset * 0.75)) % plethLen;
      const val = MOCK_PLETH_DATA[dataIdx] || 0;
      const y = baseline - val * (height * 0.75);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Feather name="activity" size={14} color="#14b8a6" />
          <Text style={styles.title}>Live Waveforms & Rhythm Analysis</Text>
          <View style={styles.specBadge}>
            <Text style={styles.specText}>Lead II • 25 mm/s • 10 mm/mV • Filter: ON</Text>
          </View>
        </View>

        <View style={styles.bpmWrap}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Feather name="heart" size={14} color="#ef4444" />
          </Animated.View>
          <Text style={styles.bpmNumber}>{heartRate}</Text>
          <Text style={styles.bpmUnit}>BPM</Text>
          <View style={[styles.rhythmBadge, { backgroundColor: rhythm.bg }]}>
            <Text style={[styles.rhythmText, { color: rhythm.color }]}>
              {rhythm.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Channel 1: ECG II */}
      <View style={styles.channelWrap}>
        <View style={styles.channelLabelRow}>
          <View style={[styles.tagBadge, { backgroundColor: '#134e4a' }]}>
            <Text style={[styles.tagText, { color: '#2dd4bf' }]}>ECG II</Text>
          </View>
          <Text style={styles.channelSub}>1.0 mV/cm • Auto</Text>
        </View>

        <View style={styles.oscilloscope}>
          <Svg width="100%" height={55} viewBox="0 0 300 55">
            {/* Grid Lines */}
            <Line x1="0" y1="18" x2="300" y2="18" stroke="#0f293d" strokeWidth="0.8" strokeDasharray="2,3" />
            <Line x1="0" y1="36" x2="300" y2="36" stroke="#0f293d" strokeWidth="0.8" strokeDasharray="2,3" />
            <Line x1="75" y1="0" x2="75" y2="55" stroke="#0f293d" strokeWidth="0.8" strokeDasharray="2,3" />
            <Line x1="150" y1="0" x2="150" y2="55" stroke="#0f293d" strokeWidth="0.8" strokeDasharray="2,3" />
            <Line x1="225" y1="0" x2="225" y2="55" stroke="#0f293d" strokeWidth="0.8" strokeDasharray="2,3" />

            {/* ECG Waveform */}
            <Polyline
              points={renderECGPoints(300, 55)}
              fill="none"
              stroke="#10b981"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </View>

      {/* Channel 2: PLETH (SpO2) */}
      <View style={styles.channelWrap}>
        <View style={styles.channelLabelRow}>
          <View style={[styles.tagBadge, { backgroundColor: '#0c4a6e' }]}>
            <Text style={[styles.tagText, { color: '#38bdf8' }]}>
              PLETH (SpO₂ {spo2}%)
            </Text>
          </View>
          <Text style={styles.channelSub}>Gain: Auto • Perfusion: Good</Text>
        </View>

        <View style={styles.oscilloscope}>
          <Svg width="100%" height={48} viewBox="0 0 300 48">
            {/* Grid Lines */}
            <Line x1="0" y1="16" x2="300" y2="16" stroke="#0f293d" strokeWidth="0.8" strokeDasharray="2,3" />
            <Line x1="0" y1="32" x2="300" y2="32" stroke="#0f293d" strokeWidth="0.8" strokeDasharray="2,3" />
            <Line x1="75" y1="0" x2="75" y2="48" stroke="#0f293d" strokeWidth="0.8" strokeDasharray="2,3" />
            <Line x1="150" y1="0" x2="150" y2="48" stroke="#0f293d" strokeWidth="0.8" strokeDasharray="2,3" />
            <Line x1="225" y1="0" x2="225" y2="48" stroke="#0f293d" strokeWidth="0.8" strokeDasharray="2,3" />

            {/* PLETH Waveform */}
            <Polyline
              points={renderPlethPoints(300, 48)}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </View>

      {/* Simulated Telemetry Notice */}
      <View style={styles.simNoticeWrap}>
        <Feather name="info" size={11} color="#64748b" style={{ marginRight: 5 }} />
        <Text style={styles.simNoticeText}>
          Simulated Telemetry: Waveforms are algorithmic simulations for demonstration and training. Not connected to medical monitoring hardware.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0f1d',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  specBadge: {
    backgroundColor: '#1e293b',
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  specText: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '600',
  },
  bpmWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bpmNumber: {
    fontSize: 15,
    fontWeight: '900',
    color: '#f8fafc',
  },
  bpmUnit: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94a3b8',
  },
  rhythmBadge: {
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  rhythmText: {
    fontSize: 9,
    fontWeight: '700',
  },
  channelWrap: {
    marginBottom: 6,
  },
  channelLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  tagBadge: {
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 3,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  channelSub: {
    fontSize: 9,
    color: '#64748b',
  },
  oscilloscope: {
    backgroundColor: '#040711',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0f172a',
    paddingHorizontal: 2,
  },
  simNoticeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.4)',
  },
  simNoticeText: {
    fontSize: 9.5,
    color: '#94a3b8',
    flex: 1,
    lineHeight: 13,
  },
});
