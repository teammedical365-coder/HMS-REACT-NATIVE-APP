import React, { useState, useEffect, useRef } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, StyleSheet, 
    FlatList, ActivityIndicator, useWindowDimensions, Modal, Platform 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../utils/api';

const GlobalSearch = () => {
    const { width: windowWidth } = useWindowDimensions();
    const isMobile = windowWidth < 768;

    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [mobileExpanded, setMobileExpanded] = useState(false);
    const navigation = useNavigation();

    useEffect(() => {
        let isMounted = true;
        const fetchResults = async () => {
            if (query.trim().length < 2) {
                if (isMounted) {
                    setResults([]);
                    setIsOpen(false);
                }
                return;
            }

            setIsLoading(true);
            try {
                const response = await apiClient.get(`/api/search`, {
                    params: { q: query }
                });
                
                if (response.data?.success && isMounted) {
                    setResults(response.data.data || []);
                    setIsOpen(true);
                }
            } catch (error) {
                // Non-blocking catch
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchResults, 300);
        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [query]);

    const handleResultClick = (result) => {
        setIsOpen(false);
        setMobileExpanded(false);
        setQuery('');
        if (result?.route) {
            navigation.navigate(result.route);
        }
    };

    const groupedResults = results.reduce((acc, result) => {
        const type = result.type || 'Result';
        if (!acc[type]) acc[type] = [];
        acc[type].push(result);
        return acc;
    }, {});

    const renderGroup = ({ item: type }) => (
        <View style={styles.groupContainer}>
            <Text style={styles.groupTitle}>{type}s</Text>
            {groupedResults[type].map((result, idx) => (
                <TouchableOpacity 
                    key={result.id || idx} 
                    style={styles.resultItem}
                    onPress={() => handleResultClick(result)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.resultItemTitle}>{result.title}</Text>
                    {result.subtitle ? <Text style={styles.resultItemSubtitle}>{result.subtitle}</Text> : null}
                </TouchableOpacity>
            ))}
        </View>
    );

    // ── MOBILE VIEW: Circular Search Button + Top Slide Modal ─────────────
    if (isMobile) {
        return (
            <View>
                <TouchableOpacity 
                    style={styles.mobileSearchBtn} 
                    onPress={() => setMobileExpanded(true)}
                    activeOpacity={0.7}
                    accessibilityLabel="Search"
                >
                    <Feather name="search" size={17} color="#475569" />
                </TouchableOpacity>

                <Modal 
                    visible={mobileExpanded} 
                    transparent 
                    animationType="fade"
                    onRequestClose={() => { setMobileExpanded(false); setIsOpen(false); }}
                >
                    <View style={styles.mobileModalBackdrop}>
                        <View style={styles.mobileSearchHeader}>
                            <TouchableOpacity 
                                style={styles.mobileBackBtn} 
                                onPress={() => { setMobileExpanded(false); setIsOpen(false); }}
                            >
                                <Feather name="arrow-left" size={20} color="#0f172a" />
                            </TouchableOpacity>

                            <View style={styles.mobileInputWrapper}>
                                <Feather name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                                <TextInput
                                    style={styles.mobileInput}
                                    placeholder="Search patients, doctors, records..."
                                    placeholderTextColor="#94a3b8"
                                    value={query}
                                    onChangeText={setQuery}
                                    autoFocus
                                />
                                {isLoading ? (
                                    <ActivityIndicator size="small" color="#0d9488" />
                                ) : query.length > 0 ? (
                                    <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setIsOpen(false); }}>
                                        <Feather name="x" size={16} color="#64748b" />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        </View>

                        {/* Mobile Results Dropdown */}
                        {isOpen && query.length >= 2 && (
                            <View style={styles.mobileResultsContainer}>
                                {results.length === 0 && !isLoading ? (
                                    <View style={styles.emptyContainer}>
                                        <Text style={styles.emptyText}>No matching records found.</Text>
                                    </View>
                                ) : (
                                    <FlatList
                                        data={Object.keys(groupedResults)}
                                        keyExtractor={type => type}
                                        renderItem={renderGroup}
                                        keyboardShouldPersistTaps="handled"
                                    />
                                )}
                            </View>
                        )}
                    </View>
                </Modal>
            </View>
        );
    }

    // ── DESKTOP VIEW: Neat 280px Pill Input ────────────────────────────────
    return (
        <View style={styles.desktopContainer}>
            <View style={styles.desktopInputWrapper}>
                <Feather name="search" size={15} color="#0d9488" style={styles.iconLeft} />
                <TextInput
                    style={styles.desktopInput}
                    placeholder="Search patients, doctors, MRN..."
                    placeholderTextColor="#94a3b8"
                    value={query}
                    onChangeText={setQuery}
                    onFocus={() => { if (results.length > 0) setIsOpen(true); }}
                />
                <View style={styles.iconRight}>
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#0d9488" />
                    ) : query.length > 0 ? (
                        <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setIsOpen(false); }}>
                            <Feather name="x" size={15} color="#64748b" />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            {/* Desktop Dropdown */}
            {isOpen && query.length >= 2 && (
                <View style={styles.desktopDropdown}>
                    {results.length === 0 && !isLoading ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No matching records found.</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={Object.keys(groupedResults)}
                            keyExtractor={type => type}
                            renderItem={renderGroup}
                            keyboardShouldPersistTaps="handled"
                            style={styles.list}
                        />
                    )}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    // Desktop Styles
    desktopContainer: { 
        position: 'relative', 
        zIndex: 50, 
        width: 280, 
        maxWidth: 320 
    },
    desktopInputWrapper: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#ffffff', 
        borderRadius: 20, 
        borderWidth: 1, 
        borderColor: '#e2e8f0', 
        height: 38, 
        paddingHorizontal: 12,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1
    },
    iconLeft: { 
        marginRight: 8 
    },
    desktopInput: { 
        flex: 1, 
        fontSize: 13, 
        color: '#0f172a', 
        height: '100%',
        fontWeight: '500'
    },
    iconRight: { 
        marginLeft: 6 
    },
    desktopDropdown: { 
        position: 'absolute', 
        top: 44, 
        left: 0, 
        right: 0, 
        backgroundColor: '#ffffff', 
        borderRadius: 12, 
        borderWidth: 1,
        borderColor: '#e2e8f0',
        elevation: 5, 
        shadowColor: '#0f172a', 
        shadowOffset: { width: 0, height: 4 }, 
        shadowOpacity: 0.12, 
        shadowRadius: 10, 
        maxHeight: 280,
        zIndex: 9999
    },

    // Mobile Search Styles
    mobileSearchBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8
    },
    mobileModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        paddingTop: Platform.OS === 'ios' ? 44 : 12,
        paddingHorizontal: 12
    },
    mobileSearchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#0ea5e9',
        paddingHorizontal: 10,
        height: 48,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
        elevation: 6,
        gap: 8
    },
    mobileBackBtn: {
        padding: 4
    },
    mobileInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center'
    },
    mobileInput: {
        flex: 1,
        fontSize: 14,
        color: '#0f172a',
        height: '100%',
        fontWeight: '500'
    },
    mobileResultsContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        maxHeight: 360,
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 4
    },

    // Common List Styles
    list: { 
        paddingVertical: 4 
    },
    emptyContainer: { 
        padding: 16, 
        alignItems: 'center' 
    },
    emptyText: { 
        color: '#64748b', 
        fontSize: 13,
        fontWeight: '500'
    },
    groupContainer: { 
        marginBottom: 4 
    },
    groupTitle: { 
        fontSize: 10.5, 
        fontWeight: '800', 
        color: '#0d9488', 
        textTransform: 'uppercase', 
        paddingHorizontal: 14, 
        paddingVertical: 6, 
        backgroundColor: '#f8fafc',
        letterSpacing: 0.4
    },
    resultItem: { 
        paddingHorizontal: 14, 
        paddingVertical: 10, 
        borderBottomWidth: 1, 
        borderBottomColor: '#f1f5f9' 
    },
    resultItemTitle: { 
        fontSize: 13, 
        fontWeight: '600', 
        color: '#1e293b' 
    },
    resultItemSubtitle: { 
        fontSize: 11.5, 
        color: '#64748b', 
        marginTop: 2 
    }
});

export default GlobalSearch;
