import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    ScrollView,
    StyleSheet,
    Platform
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { SUPPORTED_LANGUAGES } from '../../utils/questionLibraryI18n';

const LanguageSelector = ({ currentLang = 'en', onLanguageChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const activeLanguage = useMemo(() => {
        return SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[1] || SUPPORTED_LANGUAGES[0];
    }, [currentLang]);

    const filteredLanguages = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return SUPPORTED_LANGUAGES;
        return SUPPORTED_LANGUAGES.filter(lang =>
            lang.name.toLowerCase().includes(q) ||
            lang.native.toLowerCase().includes(q) ||
            lang.code.toLowerCase().includes(q)
        );
    }, [search]);

    const handleSelect = (code) => {
        if (typeof onLanguageChange === 'function') {
            onLanguageChange(code);
        }
        setIsOpen(false);
        setSearch('');
    };

    return (
        <View style={styles.wrapper}>
            <TouchableOpacity
                style={[styles.triggerBtn, isOpen && styles.triggerBtnActive]}
                onPress={() => setIsOpen(true)}
                activeOpacity={0.8}
            >
                <FontAwesome5 name="globe" size={13} color="#2563eb" style={styles.globeIcon} />
                <Text style={styles.flagText}>{activeLanguage.flag}</Text>
                <Text style={styles.codeText}>{activeLanguage.code.toUpperCase()}</Text>
                <FontAwesome5 name={isOpen ? "chevron-up" : "chevron-down"} size={10} color="#64748b" style={styles.chevronIcon} />
            </TouchableOpacity>

            <Modal
                visible={isOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => { setIsOpen(false); setSearch(''); }}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => { setIsOpen(false); setSearch(''); }}
                >
                    <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHeaderLeft}>
                                <FontAwesome5 name="language" size={16} color="#0d9488" />
                                <Text style={styles.modalTitle}>Select Language / भाषा चुनें</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={() => { setIsOpen(false); setSearch(''); }}
                            >
                                <FontAwesome5 name="times" size={14} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchBox}>
                            <FontAwesome5 name="search" size={12} color="#94a3b8" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search language / भाषा खोजें..."
                                placeholderTextColor="#94a3b8"
                                value={search}
                                onChangeText={setSearch}
                                autoFocus={Platform.OS === 'web'}
                            />
                            {search.length > 0 && (
                                <TouchableOpacity onPress={() => setSearch('')}>
                                    <FontAwesome5 name="times-circle" size={12} color="#94a3b8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView style={styles.langList} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
                            {filteredLanguages.map(lang => {
                                const isSelected = lang.code === currentLang;
                                return (
                                    <TouchableOpacity
                                        key={lang.code}
                                        style={[styles.langItem, isSelected && styles.langItemSelected]}
                                        onPress={() => handleSelect(lang.code)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.langItemFlag}>{lang.flag}</Text>
                                        <View style={styles.langItemInfo}>
                                            <Text style={[styles.langItemNative, isSelected && styles.langItemTextActive]}>{lang.native}</Text>
                                            <Text style={[styles.langItemEnglish, isSelected && styles.langItemSubActive]}>{lang.name}</Text>
                                        </View>
                                        {isSelected && (
                                            <FontAwesome5 name="check" size={12} color="#0d9488" />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                            {filteredLanguages.length === 0 && (
                                <View style={styles.noResults}>
                                    <Text style={styles.noResultsText}>No languages found / कोई भाषा नहीं मिली</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'relative',
    },
    triggerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        minHeight: 36,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease',
            },
            default: {
                elevation: 1,
            }
        })
    },
    triggerBtnActive: {
        borderColor: '#0d9488',
        backgroundColor: '#f0fdf4',
    },
    globeIcon: {
        marginRight: 2,
    },
    flagText: {
        fontSize: 14,
    },
    codeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
        letterSpacing: 0.5,
    },
    chevronIcon: {
        marginLeft: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 380,
        maxHeight: '80%',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        ...Platform.select({
            web: {
                boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            },
            default: {
                elevation: 8,
            }
        })
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    modalHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    closeBtn: {
        padding: 4,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginTop: 12,
        marginBottom: 10,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: '#0f172a',
        paddingVertical: 2,
        ...Platform.select({
            web: {
                outlineStyle: 'none',
            }
        })
    },
    langList: {
        maxHeight: 320,
    },
    langItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 4,
        backgroundColor: 'transparent',
    },
    langItemSelected: {
        backgroundColor: '#f0fdf4',
    },
    langItemFlag: {
        fontSize: 18,
        marginRight: 10,
    },
    langItemInfo: {
        flex: 1,
    },
    langItemNative: {
        fontSize: 13.5,
        fontWeight: '600',
        color: '#1e293b',
    },
    langItemEnglish: {
        fontSize: 11.5,
        color: '#64748b',
        marginTop: 1,
    },
    langItemTextActive: {
        color: '#0d9488',
        fontWeight: '700',
    },
    langItemSubActive: {
        color: '#047857',
    },
    noResults: {
        padding: 24,
        alignItems: 'center',
    },
    noResultsText: {
        fontSize: 13,
        color: '#94a3b8',
    }
});

export default LanguageSelector;
