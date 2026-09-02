import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../utils/api'; // using default export if available, else destructure if you named it differently in rn

const GlobalSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
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
                // Adjusting path to match RN axios setup or relative API structure
                const response = await api.get(`/api/search`, {
                    params: { q: query }
                });
                
                if (response.data?.success && isMounted) {
                    setResults(response.data.data || []);
                    setIsOpen(true);
                }
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchResults();
        }, 300);

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [query]);

    const handleResultClick = (result) => {
        setIsOpen(false);
        setQuery('');
        // Navigation route mapping depends on your RN setup
        // Assuming result.route maps to a valid screen name in DashboardLayout
        navigation.navigate(result.route);
    };

    const groupedResults = results.reduce((acc, result) => {
        if (!acc[result.type]) acc[result.type] = [];
        acc[result.type].push(result);
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
                >
                    <Text style={styles.resultItemTitle}>{result.title}</Text>
                    <Text style={styles.resultItemSubtitle}>{result.subtitle}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.inputWrapper}>
                <Feather name="search" size={16} color="#64748b" style={styles.iconLeft} />
                <TextInput
                    style={styles.input}
                    placeholder="Search patients, doctors, MRN..."
                    value={query}
                    onChangeText={setQuery}
                    onFocus={() => { if (results.length > 0) setIsOpen(true); }}
                />
                <View style={styles.iconRight}>
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#64748b" />
                    ) : query.length > 0 ? (
                        <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setIsOpen(false); }}>
                            <Feather name="x" size={16} color="#64748b" />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            {isOpen && query.length >= 2 && (
                <View style={styles.dropdown}>
                    {results.length === 0 && !isLoading ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No matching results found.</Text>
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
    container: { position: 'relative', zIndex: 50, width: '100%', paddingHorizontal: 16, paddingVertical: 10 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', height: 44, paddingHorizontal: 12 },
    iconLeft: { marginRight: 8 },
    input: { flex: 1, fontSize: 14, color: '#0f172a', height: '100%' },
    iconRight: { marginLeft: 8 },
    dropdown: { position: 'absolute', top: 54, left: 16, right: 16, backgroundColor: 'white', borderRadius: 8, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, maxHeight: 300 },
    list: { paddingVertical: 8 },
    emptyContainer: { padding: 16, alignItems: 'center' },
    emptyText: { color: '#64748b', fontSize: 14 },
    groupContainer: { marginBottom: 8 },
    groupTitle: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f8fafc' },
    resultItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    resultItemTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    resultItemSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 }
});

export default GlobalSearch;
