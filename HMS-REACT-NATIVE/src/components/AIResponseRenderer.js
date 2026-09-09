import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, Platform, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

/**
 * Basic Markdown Parser for React Native Text
 */
const renderInlineMarkdown = (text, keyPrefix = '') => {
    if (!text) return null;
    
    // Split by **bold** or *italic* or `code` or [text](url)
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g);
    
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <Text key={`${keyPrefix}-${index}`} style={styles.mdBold}>{part.slice(2, -2)}</Text>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <Text key={`${keyPrefix}-${index}`} style={styles.mdItalic}>{part.slice(1, -1)}</Text>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return <Text key={`${keyPrefix}-${index}`} style={styles.mdInlineCode}>{part.slice(1, -1)}</Text>;
        }
        const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
        if (linkMatch) {
            const linkText = linkMatch[1];
            const linkUrl = linkMatch[2];
            return (
                <Text 
                    key={`${keyPrefix}-${index}`} 
                    style={styles.mdLink} 
                    onPress={() => {
                        Linking.canOpenURL(linkUrl).then(supported => {
                            if (supported) Linking.openURL(linkUrl);
                            else console.warn(`Don't know how to open URL: ${linkUrl}`);
                        }).catch(err => console.error('An error occurred', err));
                    }}
                >
                    {linkText}
                </Text>
            );
        }
        return <Text key={`${keyPrefix}-${index}`}>{part}</Text>;
    });
};

const renderMarkdownBlocks = (content) => {
    if (!content) return null;
    
    const lines = content.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeContent = [];
    let listItems = [];
    let inTable = false;
    let tableRows = [];

    const flushList = () => {
        if (listItems.length > 0) {
            elements.push(
                <View key={`list-${elements.length}`} style={styles.mdListContainer}>
                    {listItems}
                </View>
            );
            listItems = [];
        }
    };

    const flushTable = () => {
        if (tableRows.length > 0) {
            elements.push(
                <ScrollView horizontal key={`table-${elements.length}`} style={styles.mdTableWrapper}>
                    <View style={styles.mdTable}>
                        {tableRows}
                    </View>
                </ScrollView>
            );
            tableRows = [];
            inTable = false;
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('```')) {
            if (inCodeBlock) {
                elements.push(
                    <View key={`code-${elements.length}`} style={styles.mdCodeBlock}>
                        <Text style={styles.mdCodeText}>{codeContent.join('\n')}</Text>
                    </View>
                );
                codeContent = [];
                inCodeBlock = false;
            } else {
                inCodeBlock = true;
                flushList();
                flushTable();
            }
            continue;
        }

        if (inCodeBlock) {
            codeContent.push(line);
            continue;
        }

        // Tables
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            flushList();
            inTable = true;
            // Ignore alignment row `|---|`
            if (line.replace(/[\s|:-]/g, '').length === 0) continue;
            
            const cells = line.split('|').filter((_, idx, arr) => idx !== 0 && idx !== arr.length - 1);
            const isHeader = tableRows.length === 0;
            
            tableRows.push(
                <View key={`tr-${i}`} style={[styles.mdTableRow, isHeader && styles.mdTableHeaderRow]}>
                    {cells.map((cell, cIdx) => (
                        <View key={`tc-${cIdx}`} style={styles.mdTableCell}>
                            <Text style={isHeader ? styles.mdTableHeaderText : styles.mdTableText}>
                                {renderInlineMarkdown(cell.trim(), `td-${i}-${cIdx}`)}
                            </Text>
                        </View>
                    ))}
                </View>
            );
            continue;
        } else if (inTable) {
            flushTable();
        }

        // Headings
        if (line.startsWith('### ')) {
            flushList();
            elements.push(<Text key={`h3-${i}`} style={styles.mdH3}>{renderInlineMarkdown(line.slice(4), `h3-${i}`)}</Text>);
            continue;
        }
        if (line.startsWith('## ')) {
            flushList();
            elements.push(<Text key={`h2-${i}`} style={styles.mdH2}>{renderInlineMarkdown(line.slice(3), `h2-${i}`)}</Text>);
            continue;
        }
        if (line.startsWith('# ')) {
            flushList();
            elements.push(<Text key={`h1-${i}`} style={styles.mdH1}>{renderInlineMarkdown(line.slice(2), `h1-${i}`)}</Text>);
            continue;
        }

        // Blockquotes
        if (line.startsWith('> ')) {
            flushList();
            elements.push(
                <View key={`bq-${i}`} style={styles.mdBlockquote}>
                    <Text style={styles.mdBlockquoteText}>{renderInlineMarkdown(line.slice(2), `bq-${i}`)}</Text>
                </View>
            );
            continue;
        }

        // HR
        if (line.startsWith('---')) {
            flushList();
            elements.push(<View key={`hr-${i}`} style={styles.mdHr} />);
            continue;
        }

        // Unordered List
        if (line.trim().match(/^[-*]\s/)) {
            const text = line.trim().replace(/^[-*]\s/, '');
            const indent = line.search(/\S/);
            listItems.push(
                <View key={`li-${i}`} style={[styles.mdListItem, { marginLeft: indent * 10 }]}>
                    <Text style={styles.mdListBullet}>•</Text>
                    <Text style={styles.mdListText}>{renderInlineMarkdown(text, `li-${i}`)}</Text>
                </View>
            );
            continue;
        }
        
        // Ordered List
        const olMatch = line.trim().match(/^(\d+)\.\s/);
        if (olMatch) {
            const text = line.trim().substring(olMatch[0].length);
            const indent = line.search(/\S/);
            listItems.push(
                <View key={`oli-${i}`} style={[styles.mdListItem, { marginLeft: indent * 10 }]}>
                    <Text style={styles.mdListNumber}>{olMatch[1]}.</Text>
                    <Text style={styles.mdListText}>{renderInlineMarkdown(text, `oli-${i}`)}</Text>
                </View>
            );
            continue;
        }

        // Paragraph
        flushList();
        if (line.trim() === '') {
            elements.push(<View key={`br-${i}`} style={{ height: 8 }} />);
        } else {
            elements.push(<Text key={`p-${i}`} style={styles.mdParagraph}>{renderInlineMarkdown(line, `p-${i}`)}</Text>);
        }
    }

    flushList();
    flushTable();

    return elements;
};

const AIResponseRenderer = ({
    content = '',
    timestamp = '',
    role = 'ai',
    isTyping = false
}) => {
    const [copied, setCopied] = useState(false);
    const [reaction, setReaction] = useState(null);

    const handleCopy = async () => {
        if (!content) return;
        await Clipboard.setStringAsync(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (role === 'doctor' || role === 'user') {
        return (
            <View style={[styles.msgRow, styles.msgRowRight]}>
                <View style={[styles.msgBubble, styles.bubbleDoctor]}>
                    <Text style={styles.doctorText}>{content}</Text>
                    <View style={styles.msgTimeRow}>
                        <Text style={styles.timeText}>{timestamp}</Text>
                        <Text style={styles.checkText}>✓✓</Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.msgRow}>
            <View style={styles.avatarRobot}>
                <Text style={styles.avatarEmoji}>🤖</Text>
            </View>
            <View style={[styles.msgBubble, styles.bubbleAi]}>
                {/* Header Badge */}
                <View style={styles.aiHeader}>
                    <View style={styles.aiBrandTag}>
                        <View style={styles.aiBrandDot} />
                        <Text style={styles.aiBrandName}>Medical365 AI</Text>
                        <Text style={styles.aiBrandSub}>Clinical Intelligence</Text>
                    </View>
                    <TouchableOpacity 
                        style={[styles.btnCopy, copied && styles.btnCopied]} 
                        onPress={handleCopy}
                    >
                        <Feather name={copied ? "check" : "copy"} size={12} color={copied ? "#10b981" : "#64748b"} />
                        <Text style={[styles.copyText, copied && styles.copiedText]}>{copied ? 'Copied' : 'Copy'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Body */}
                <View style={styles.aiBody}>
                    {isTyping ? (
                        <View style={styles.typingIndicator}>
                            <Text style={styles.typingLabel}>Analyzing clinical report, imaging & medical parameters...</Text>
                            <View style={styles.typingDotsRow}>
                                {/* Basic static visual of typing for now without Animated API complexities if not needed */}
                                <Text style={styles.typingDot}>.</Text>
                                <Text style={styles.typingDot}>.</Text>
                                <Text style={styles.typingDot}>.</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.markdownWrapper}>
                            {renderMarkdownBlocks(content)}
                        </View>
                    )}
                </View>

                {/* Footer Reactions & Timestamp */}
                {!isTyping && (
                    <View style={styles.aiFooter}>
                        <View style={styles.reactionsGroup}>
                            <TouchableOpacity 
                                style={[styles.btnReaction, reaction === 'like' && styles.reactionActive]}
                                onPress={() => setReaction(reaction === 'like' ? null : 'like')}
                            >
                                <Feather name="thumbs-up" size={14} color={reaction === 'like' ? '#2563eb' : '#64748b'} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.btnReaction, reaction === 'dislike' && styles.reactionActive]}
                                onPress={() => setReaction(reaction === 'dislike' ? null : 'dislike')}
                            >
                                <Feather name="thumbs-down" size={14} color={reaction === 'dislike' ? '#2563eb' : '#64748b'} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.timeText}>{timestamp}</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20, paddingHorizontal: 16 },
    msgRowRight: { justifyContent: 'flex-end' },
    avatarRobot: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    avatarEmoji: { fontSize: 20 },
    msgBubble: { borderRadius: 18, maxWidth: '85%', padding: 16 },
    bubbleDoctor: { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
    bubbleAi: { backgroundColor: '#ffffff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
    doctorText: { color: '#ffffff', fontSize: 15, lineHeight: 22 },
    msgTimeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 6, gap: 4 },
    timeText: { fontSize: 11, color: '#94a3b8' },
    checkText: { fontSize: 11, color: '#93c5fd' },
    
    aiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 },
    aiBrandTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    aiBrandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
    aiBrandName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
    aiBrandSub: { fontSize: 11, color: '#64748b' },
    btnCopy: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    btnCopied: { backgroundColor: '#ecfdf5', borderColor: '#d1fae5' },
    copyText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
    copiedText: { color: '#10b981' },

    aiBody: { marginBottom: 12 },
    typingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    typingLabel: { fontSize: 13, color: '#64748b', fontStyle: 'italic' },
    typingDotsRow: { flexDirection: 'row' },
    typingDot: { fontSize: 20, color: '#cbd5e1', marginTop: -10 },

    aiFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
    reactionsGroup: { flexDirection: 'row', gap: 8 },
    btnReaction: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    reactionActive: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },

    // Markdown Styles
    markdownWrapper: { flexDirection: 'column' },
    mdParagraph: { fontSize: 15, color: '#334155', lineHeight: 24, flexWrap: 'wrap' },
    mdBold: { fontWeight: '700', color: '#0f172a' },
    mdItalic: { fontStyle: 'italic' },
    mdInlineCode: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: '#f1f5f9', color: '#e11d48', paddingHorizontal: 4, borderRadius: 4, fontSize: 14 },
    mdCodeBlock: { backgroundColor: '#0f172a', padding: 12, borderRadius: 8, marginVertical: 8 },
    mdCodeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#f8fafc', fontSize: 13 },
    mdBlockquote: { borderLeftWidth: 4, borderLeftColor: '#3b82f6', paddingLeft: 12, backgroundColor: '#eff6ff', paddingVertical: 8, borderRadius: 4, marginVertical: 8 },
    mdBlockquoteText: { fontStyle: 'italic', color: '#1e3a8a', fontSize: 15 },
    mdH1: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginTop: 16, marginBottom: 8 },
    mdH2: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 14, marginBottom: 6 },
    mdH3: { fontSize: 16, fontWeight: '600', color: '#1e293b', marginTop: 12, marginBottom: 4 },
    mdHr: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 12 },
    mdListContainer: { marginVertical: 8 },
    mdListItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
    mdListBullet: { fontSize: 15, color: '#3b82f6', marginRight: 8, marginTop: 2 },
    mdListNumber: { fontSize: 14, fontWeight: '600', color: '#64748b', marginRight: 6, marginTop: 2, minWidth: 18 },
    mdListText: { flex: 1, fontSize: 15, color: '#334155', lineHeight: 22 },
    
    mdTableWrapper: { marginVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
    mdTable: { flexDirection: 'column' },
    mdTableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    mdTableHeaderRow: { backgroundColor: '#f8fafc' },
    mdTableCell: { padding: 10, minWidth: 120, flex: 1, flexWrap: 'wrap', borderRightWidth: 1, borderRightColor: '#f1f5f9', justifyContent: 'center' },
    mdTableHeaderText: { fontWeight: '700', fontSize: 13, color: '#475569', textTransform: 'uppercase', flexWrap: 'wrap' },
    mdTableText: { fontSize: 14, color: '#334155', flexWrap: 'wrap' },
    mdLink: { color: '#2563eb', textDecorationLine: 'underline' }
});

export default AIResponseRenderer;
