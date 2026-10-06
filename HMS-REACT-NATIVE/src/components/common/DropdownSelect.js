import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    TextInput,
    Pressable,
    Dimensions,
    Platform,
    ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';

/**
 * Universal DropdownSelect Component
 * Renders options in a root Modal/Portal overlay to prevent:
 * - Parent container clipping (overflow: hidden)
 * - Sibling card overlapping or zIndex fighting
 * - Option list getting cut off inside modals or cards
 */
const DropdownSelect = ({
    options = [],
    value = '',
    onChange = () => {},
    placeholder = '-- Select --',
    disabled = false,
    style,
    inputStyle,
    textStyle,
    dropdownStyle,
    searchable = false,
    insideModal = false,
    loading = false,
    loadingText = 'Loading...',
    emptyText = 'No options found',
    error = null,
    errorText = 'Unable to load options',
    onRetry = null,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState(null);
    const triggerRef = useRef(null);

    // Normalize options
    const normalizedOptions = (Array.isArray(options) ? options : [])
        .filter(opt => opt !== null && opt !== undefined)
        .map(opt => {
            if (typeof opt === 'object') {
                return {
                    label: opt.label !== undefined ? String(opt.label) : String(opt.value),
                    value: opt.value !== undefined ? opt.value : opt.label
                };
            }
            return { label: String(opt), value: opt };
        });

    const selectedOption = normalizedOptions.find(o => String(o.value) === String(value));
    const displayText = selectedOption ? selectedOption.label : (loading && !value ? loadingText : placeholder);
    const isPlaceholder = !selectedOption;

    const filteredOptions = normalizedOptions.filter(opt => {
        if (placeholder && (opt.value === '' || opt.label === placeholder)) {
            return false;
        }
        return opt.label.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const isSearchEnabled = searchable || normalizedOptions.length > 8;

    const handleOpen = () => {
        if (disabled) return;
        setSearchQuery('');

        if (insideModal) {
            setIsOpen(!isOpen);
            return;
        }

        if (Platform.OS === 'web' && triggerRef.current) {
            const node = triggerRef.current;
            if (typeof node.getBoundingClientRect === 'function') {
                const rect = node.getBoundingClientRect();
                calculatePosition(rect.left, rect.top, rect.width, rect.height);
                return;
            }
        }

        if (triggerRef.current && typeof triggerRef.current.measureInWindow === 'function') {
            triggerRef.current.measureInWindow((x, y, width, height) => {
                calculatePosition(x, y, width, height);
            });
        } else {
            setDropdownPosition(null);
            setIsOpen(true);
        }
    };

    const calculatePosition = (x, y, width, height) => {
        const windowHeight = Dimensions.get('window').height;
        const windowWidth = Dimensions.get('window').width;
        const estimatedHeight = Math.min(260, Math.max(100, filteredOptions.length * 44 + (isSearchEnabled ? 50 : 20)));

        let top = y + height + 4;
        let showAbove = false;

        if (top + estimatedHeight > windowHeight - 16 && y - estimatedHeight > 16) {
            top = Math.max(16, y - estimatedHeight - 4);
            showAbove = true;
        }

        const maxMenuWidth = Math.max(160, windowWidth - 20);
        const menuWidth = Math.min(maxMenuWidth, Math.max(width || 180, 160));
        const left = Math.max(10, Math.min(x || 10, windowWidth - menuWidth - 10));

        setDropdownPosition({ top, left, width: menuWidth, showAbove });
        setIsOpen(true);
    };

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
    };

    const renderMenuContent = () => {
        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.loadingText}>{loadingText}</Text>
                </View>
            );
        }

        if (error) {
            return (
                <View style={styles.errorContainer}>
                    <Feather name="alert-circle" size={16} color="#ef4444" style={{ marginBottom: 4 }} />
                    <Text style={styles.errorText}>
                        {typeof error === 'string' ? error : errorText}
                    </Text>
                    {onRetry ? (
                        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.7}>
                            <Feather name="refresh-cw" size={12} color="#2563eb" style={{ marginRight: 4 }} />
                            <Text style={styles.retryBtnText}>Retry</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            );
        }

        return (
            <>
                {isSearchEnabled && (
                    <View style={styles.searchContainer}>
                        <Feather name="search" size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search..."
                            placeholderTextColor="#94a3b8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus={Platform.OS === 'web'}
                        />
                        {searchQuery ? (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Feather name="x" size={14} color="#94a3b8" />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                )}

                <ScrollView
                    style={{ maxHeight: 220 }}
                    nestedScrollEnabled={true}
                    keyboardShouldPersistTaps="handled"
                >
                    {placeholder && (
                        <TouchableOpacity
                            style={[
                                styles.optionItem,
                                value === '' && styles.optionItemSelected
                            ]}
                            onPress={() => handleSelect('')}
                            activeOpacity={0.7}
                        >
                            <Text
                                style={[
                                    styles.optionText,
                                    value === '' && styles.optionTextSelected,
                                    { fontStyle: 'italic', color: '#94a3b8' }
                                ]}
                                numberOfLines={2}
                            >
                                {placeholder}
                            </Text>
                            {value === '' && (
                                <Feather name="check" size={14} color="#2563eb" />
                            )}
                        </TouchableOpacity>
                    )}

                    {filteredOptions.map((opt, idx) => {
                        const isSelected = String(opt.value) === String(value);
                        return (
                            <TouchableOpacity
                                key={`${opt.value}-${idx}`}
                                style={[
                                    styles.optionItem,
                                    isSelected && styles.optionItemSelected
                                ]}
                                onPress={() => handleSelect(opt.value)}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.optionText,
                                        isSelected && styles.optionTextSelected
                                    ]}
                                    numberOfLines={2}
                                >
                                    {opt.label}
                                </Text>
                                {isSelected && (
                                    <Feather name="check" size={15} color="#2563eb" />
                                )}
                            </TouchableOpacity>
                        );
                    })}

                    {filteredOptions.length === 0 && (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                {searchQuery ? 'No options found' : emptyText}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </>
        );
    };

    return (
        <View style={[{ width: '100%', position: 'relative' }, style]}>
            <TouchableOpacity
                ref={triggerRef}
                style={[
                    styles.trigger,
                    disabled && styles.triggerDisabled,
                    isOpen && styles.triggerActive,
                    inputStyle
                ]}
                onPress={handleOpen}
                activeOpacity={0.75}
                disabled={disabled}
            >
                <Text
                    style={[
                        styles.triggerText,
                        isPlaceholder ? styles.placeholderText : styles.selectedText,
                        textStyle
                    ]}
                    numberOfLines={1}
                >
                    {displayText}
                </Text>
                <Feather
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={disabled ? "#94a3b8" : "#64748b"}
                />
            </TouchableOpacity>

            {insideModal ? (
                isOpen && (
                    <View style={[styles.inlineDropdownMenu, dropdownStyle]}>
                        {renderMenuContent()}
                    </View>
                )
            ) : (
                <Modal
                    transparent={true}
                    visible={isOpen}
                    animationType="none"
                    onRequestClose={() => setIsOpen(false)}
                    statusBarTranslucent={true}
                >
                    <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
                        <View
                            style={[
                                styles.dropdownMenu,
                                dropdownPosition ? {
                                    position: 'absolute',
                                    top: dropdownPosition.top,
                                    left: dropdownPosition.left,
                                    width: dropdownPosition.width,
                                } : styles.fallbackCenter,
                                dropdownStyle
                            ]}
                            onStartShouldSetResponder={() => true}
                        >
                            {renderMenuContent()}
                        </View>
                    </Pressable>
                </Modal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    trigger: {
        minHeight: 42,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#cbd5e1',
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    triggerActive: {
        borderColor: '#2563eb',
        ...(Platform.OS === 'web' ? {
            boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.15)',
        } : {
            elevation: 2,
        }),
    },
    triggerDisabled: {
        backgroundColor: '#f1f5f9',
        borderColor: '#e2e8f0',
        opacity: 0.65,
    },
    triggerText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        marginRight: 8,
    },
    selectedText: {
        color: '#0f172a',
        fontWeight: '600',
    },
    placeholderText: {
        color: '#94a3b8',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    dropdownMenu: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 4,
        zIndex: 999999,
        ...Platform.select({
            web: {
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            },
            default: {
                elevation: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
            }
        })
    },
    fallbackCenter: {
        alignSelf: 'center',
        marginTop: '30%',
        width: '85%',
        maxWidth: 360,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
        padding: 0,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    optionItemSelected: {
        backgroundColor: '#eff6ff',
    },
    optionText: {
        fontSize: 13.5,
        color: '#334155',
        flex: 1,
    },
    optionTextSelected: {
        color: '#2563eb',
        fontWeight: '700',
    },
    emptyContainer: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: '#94a3b8',
        fontStyle: 'italic',
    },
    loadingContainer: {
        paddingVertical: 18,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    loadingText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    errorContainer: {
        paddingVertical: 14,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorText: {
        fontSize: 12.5,
        color: '#ef4444',
        textAlign: 'center',
        marginBottom: 8,
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 6,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    retryBtnText: {
        fontSize: 12,
        color: '#2563eb',
        fontWeight: '600',
    },
    inlineDropdownMenu: {
        marginTop: 4,
        backgroundColor: '#ffffff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        overflow: 'hidden',
        width: '100%',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    }
});

export default DropdownSelect;
