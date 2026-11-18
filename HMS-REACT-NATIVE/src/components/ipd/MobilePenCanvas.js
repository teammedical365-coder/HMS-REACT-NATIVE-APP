import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { eraseStrokesAlongPath } from './penGeometry';

/**
 * MobilePenCanvas
 * 
 * High-performance, native-compatible vector handwriting and eraser canvas for React Native.
 * Features:
 * - Native PanResponder gesture tracking (stylus and finger)
 * - Immediate stroke finalization on touch-up (no continuous connecting lines between words)
 * - Single-point dot handling (periods, i-dots)
 * - Real-time partial stroke geometric eraser
 * - Smooth SVG path rendering via react-native-svg
 * - Passes document touches through when tool is 'type'
 */
const MobilePenCanvas = ({
    pageKey = 'page1',
    strokes = [],
    activeTool = 'type', // 'type' | 'pen' | 'eraser'
    penColor = '#1d4ed8',
    penWidth = 2,
    onSaveStrokes
}) => {
    const strokesRef = useRef(strokes);
    const [localStrokes, setLocalStrokes] = useState(strokes);
    const [activeStroke, setActiveStroke] = useState(null);

    const isDrawingRef = useRef(false);
    const currentStrokeRef = useRef(null);
    const lastEraserPointRef = useRef(null);
    const eraserModifiedRef = useRef(false);

    // Keep strokesRef and localStrokes in sync with incoming prop
    useEffect(() => {
        strokesRef.current = strokes;
        setLocalStrokes(strokes);
    }, [strokes]);

    const isInteractive = activeTool === 'pen' || activeTool === 'eraser';

    const panResponder = useMemo(() => {
        return PanResponder.create({
            onStartShouldSetPanResponder: () => isInteractive,
            onMoveShouldSetPanResponder: () => isInteractive,
            onStartShouldSetPanResponderCapture: () => isInteractive,
            onMoveShouldSetPanResponderCapture: () => isInteractive,

            onPanResponderGrant: (evt) => {
                if (!isInteractive) return;

                const { locationX, locationY } = evt.nativeEvent;
                const coords = {
                    x: Math.round(locationX * 10) / 10,
                    y: Math.round(locationY * 10) / 10,
                    pressure: 0.5
                };

                isDrawingRef.current = true;

                if (activeTool === 'eraser') {
                    lastEraserPointRef.current = coords;
                    eraserModifiedRef.current = false;
                    const eraserRadius = Math.max(16, penWidth * 4);

                    const res = eraseStrokesAlongPath(strokesRef.current, coords, coords, eraserRadius);
                    if (res.changed) {
                        strokesRef.current = res.strokes;
                        setLocalStrokes(res.strokes);
                        eraserModifiedRef.current = true;
                    }
                    return;
                }

                // PEN TOOL: Start new independent stroke
                const newStroke = {
                    id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    color: penColor,
                    width: penWidth,
                    tool: 'pen',
                    points: [coords]
                };
                currentStrokeRef.current = newStroke;
                setActiveStroke(newStroke);
            },

            onPanResponderMove: (evt) => {
                if (!isDrawingRef.current || !isInteractive) return;

                const { locationX, locationY } = evt.nativeEvent;
                const coords = {
                    x: Math.round(locationX * 10) / 10,
                    y: Math.round(locationY * 10) / 10,
                    pressure: 0.5
                };

                if (activeTool === 'eraser') {
                    const eraserRadius = Math.max(16, penWidth * 4);
                    const prev = lastEraserPointRef.current || coords;
                    const res = eraseStrokesAlongPath(strokesRef.current, prev, coords, eraserRadius);

                    if (res.changed) {
                        strokesRef.current = res.strokes;
                        setLocalStrokes(res.strokes);
                        eraserModifiedRef.current = true;
                    }
                    lastEraserPointRef.current = coords;
                    return;
                }

                // PEN TOOL: Append points
                const cur = currentStrokeRef.current;
                if (!cur) return;

                const prev = cur.points[cur.points.length - 1];
                if (prev && Math.abs(prev.x - coords.x) < 0.5 && Math.abs(prev.y - coords.y) < 0.5) {
                    return; // Skip identical micro-points
                }

                cur.points.push(coords);
                // Trigger re-render of active stroke in real time
                setActiveStroke({ ...cur, points: [...cur.points] });
            },

            onPanResponderRelease: () => {
                if (!isDrawingRef.current) return;
                isDrawingRef.current = false;

                if (activeTool === 'pen') {
                    const finished = currentStrokeRef.current;
                    currentStrokeRef.current = null;
                    setActiveStroke(null);

                    if (finished && finished.points.length >= 1) {
                        const updated = [...strokesRef.current, finished];
                        strokesRef.current = updated;
                        setLocalStrokes(updated);
                        if (typeof onSaveStrokes === 'function') {
                            onSaveStrokes(updated);
                        }
                    }
                } else if (activeTool === 'eraser') {
                    lastEraserPointRef.current = null;
                    if (eraserModifiedRef.current) {
                        eraserModifiedRef.current = false;
                        if (typeof onSaveStrokes === 'function') {
                            onSaveStrokes(strokesRef.current);
                        }
                    }
                }
            },

            onPanResponderTerminate: () => {
                if (!isDrawingRef.current) return;
                isDrawingRef.current = false;

                if (activeTool === 'pen') {
                    const finished = currentStrokeRef.current;
                    currentStrokeRef.current = null;
                    setActiveStroke(null);

                    if (finished && finished.points.length >= 1) {
                        const updated = [...strokesRef.current, finished];
                        strokesRef.current = updated;
                        setLocalStrokes(updated);
                        if (typeof onSaveStrokes === 'function') {
                            onSaveStrokes(updated);
                        }
                    }
                } else if (activeTool === 'eraser') {
                    lastEraserPointRef.current = null;
                    if (eraserModifiedRef.current) {
                        eraserModifiedRef.current = false;
                        if (typeof onSaveStrokes === 'function') {
                            onSaveStrokes(strokesRef.current);
                        }
                    }
                }
            }
        });
    }, [isInteractive, activeTool, penColor, penWidth, onSaveStrokes]);

    // Construct SVG path string from point array
    const makePathData = (points) => {
        if (!points || points.length < 2) return '';
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x} ${points[i].y}`;
        }
        return d;
    };

    return (
        <View
            style={[
                styles.container,
                { pointerEvents: isInteractive ? 'auto' : 'none' }
            ]}
            {...(isInteractive ? panResponder.panHandlers : {})}
        >
            <Svg style={StyleSheet.absoluteFill}>
                {/* Committed strokes */}
                <G>
                    {localStrokes.map((stroke) => {
                        if (!stroke.points || stroke.points.length === 0) return null;

                        // Single-point dot
                        if (stroke.points.length === 1) {
                            const pt = stroke.points[0];
                            const r = Math.max(1, (stroke.width || 2) / 2);
                            return (
                                <Circle
                                    key={stroke.id}
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={r}
                                    fill={stroke.color || '#1d4ed8'}
                                />
                            );
                        }

                        // Multi-point vector line
                        const d = makePathData(stroke.points);
                        return (
                            <Path
                                key={stroke.id}
                                d={d}
                                stroke={stroke.color || '#1d4ed8'}
                                strokeWidth={stroke.width || 2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                        );
                    })}
                </G>

                {/* Active in-progress stroke */}
                {activeStroke && activeStroke.points && activeStroke.points.length > 0 && (
                    <G>
                        {activeStroke.points.length === 1 ? (
                            <Circle
                                cx={activeStroke.points[0].x}
                                cy={activeStroke.points[0].y}
                                r={Math.max(1, (activeStroke.width || 2) / 2)}
                                fill={activeStroke.color || '#1d4ed8'}
                            />
                        ) : (
                            <Path
                                d={makePathData(activeStroke.points)}
                                stroke={activeStroke.color || '#1d4ed8'}
                                strokeWidth={activeStroke.width || 2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                        )}
                    </G>
                )}
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10
    }
});

export default MobilePenCanvas;

