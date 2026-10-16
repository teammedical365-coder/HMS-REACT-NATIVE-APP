import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';

export default function DeviceTrendChart({ trends }) {
  const hrTrend = trends?.heartRate || [72, 75, 78, 80, 84, 88, 92, 95];
  const spo2Trend = trends?.spo2 || [98, 98, 97, 96, 95, 94, 94, 93];
  const bpSysTrend = trends?.bpSystolic || [120, 122, 125, 128, 130, 135, 138, 142];

  const svgWidth = 320;
  const svgHeight = 110;
  const paddingLeft = 30;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 20;

  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = svgHeight - paddingTop - paddingBottom;

  // Normalization helper: min-max mapping
  const normalize = (data, minVal, maxVal) => {
    return data.map((v, i) => {
      const x = paddingLeft + (i / (data.length - 1)) * chartW;
      const clamped = Math.max(minVal, Math.min(maxVal, v));
      const y = paddingTop + chartH - ((clamped - minVal) / (maxVal - minVal)) * chartH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  };

  const hrPoints = normalize(hrTrend, 50, 150);
  const spo2Points = normalize(spo2Trend, 85, 100);
  const bpPoints = normalize(bpSysTrend, 80, 180);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Feather name="trending-up" size={14} color="#0284c7" />
          <Text style={styles.title}>1-Hour Telemetry Multi-Parameter Trend</Text>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.legendText}>HR</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#0284c7' }]} />
            <Text style={styles.legendText}>SpO₂</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#8b5cf6' }]} />
            <Text style={styles.legendText}>BP Sys</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartWrap}>
        <Svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          {/* Horizontal Grid lines */}
          <Line
            x1={paddingLeft}
            y1={paddingTop}
            x2={svgWidth - paddingRight}
            y2={paddingTop}
            stroke="#f1f5f9"
            strokeWidth="1"
          />
          <Line
            x1={paddingLeft}
            y1={paddingTop + chartH * 0.33}
            x2={svgWidth - paddingRight}
            y2={paddingTop + chartH * 0.33}
            stroke="#f1f5f9"
            strokeWidth="1"
          />
          <Line
            x1={paddingLeft}
            y1={paddingTop + chartH * 0.66}
            x2={svgWidth - paddingRight}
            y2={paddingTop + chartH * 0.66}
            stroke="#f1f5f9"
            strokeWidth="1"
          />
          <Line
            x1={paddingLeft}
            y1={paddingTop + chartH}
            x2={svgWidth - paddingRight}
            y2={paddingTop + chartH}
            stroke="#cbd5e1"
            strokeWidth="1"
          />

          {/* Lines */}
          <Polyline
            points={hrPoints}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Polyline
            points={spo2Points}
            fill="none"
            stroke="#0284c7"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Polyline
            points={bpPoints}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Time axis labels */}
          <SvgText x={paddingLeft} y={svgHeight - 4} fontSize="8.5" fill="#94a3b8" textAnchor="start">
            -60m
          </SvgText>
          <SvgText
            x={paddingLeft + chartW * 0.33}
            y={svgHeight - 4}
            fontSize="8.5"
            fill="#94a3b8"
            textAnchor="middle"
          >
            -40m
          </SvgText>
          <SvgText
            x={paddingLeft + chartW * 0.66}
            y={svgHeight - 4}
            fontSize="8.5"
            fill="#94a3b8"
            textAnchor="middle"
          >
            -20m
          </SvgText>
          <SvgText
            x={svgWidth - paddingRight}
            y={svgHeight - 4}
            fontSize="8.5"
            fill="#94a3b8"
            textAnchor="end"
          >
            Now
          </SvgText>
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    marginBottom: 6,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748b',
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
