import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { adminAPI } from '../../utils/api';

const HospitalAdminQuestionLibrary = () => {
    const navigation = useNavigation();
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Create form state
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState({ text: '', type: 'text', options: [] });

    useEffect(() => {
        fetchQuestions();
    }, []);

    const fetchQuestions = async () => {
        setLoading(true);
        try {
            const res = await adminAPI.getQuestions();
            if (res.success) setQuestions(res.questions || []);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    };

    const handleSave = async () => {
        try {
            await adminAPI.createQuestion(formData);
            setModalOpen(false);
            fetchQuestions();
        } catch (err) { Alert.alert('Error', 'Failed to save question'); }
    };

    const handleDelete = async (id) => {
        Alert.alert('Confirm', 'Delete this question?', [
            { text: 'Cancel' },
            { text: 'Delete', onPress: async () => {
                try {
                    await adminAPI.deleteQuestion(id);
                    fetchQuestions();
                } catch (e) { Alert.alert('Error', 'Failed to delete'); }
            }}
        ]);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Question Library</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => setModalOpen(true)}>
                    <Text style={{color: 'white', fontWeight: 'bold'}}>+ Add Question</Text>
                </TouchableOpacity>
            </View>

            {loading ? <Text style={{textAlign: 'center', marginTop: 20}}>Loading...</Text> : (
                <FlatList
                    data={questions}
                    keyExtractor={i => i._id}
                    renderItem={({ item }) => (
                        <View style={styles.listCard}>
                            <View style={{flex: 1}}>
                                <Text style={styles.listTitle}>{item.text}</Text>
                                <Text style={styles.listSub}>Type: {item.type}</Text>
                            </View>
                            <TouchableOpacity style={styles.delBtn} onPress={() => handleDelete(item._id)}>
                                <Text style={{color: 'white'}}>Del</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    ListEmptyComponent={<Text style={{textAlign: 'center', marginTop: 20}}>No questions found.</Text>}
                />
            )}

            <Modal visible={modalOpen} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add Question</Text>
                        <TextInput style={styles.input} placeholder="Question Text" onChangeText={t => setFormData({...formData, text: t})} />
                        <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}><Text>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}><Text style={{color:'white'}}>Save</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 22, fontWeight: 'bold' },
    addBtn: { backgroundColor: '#10b981', padding: 10, borderRadius: 8 },
    listCard: { flexDirection: 'row', backgroundColor: 'white', padding: 16, borderRadius: 8, marginBottom: 10, elevation: 1, alignItems: 'center' },
    listTitle: { fontSize: 16, fontWeight: 'bold' },
    listSub: { color: '#64748b', marginTop: 4 },
    delBtn: { backgroundColor: '#ef4444', padding: 8, borderRadius: 6 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', padding: 20, borderRadius: 12 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', padding: 10, borderRadius: 8, marginBottom: 12 },
    cancelBtn: { flex: 1, padding: 12, backgroundColor: '#e2e8f0', borderRadius: 8, alignItems: 'center' },
    saveBtn: { flex: 1, padding: 12, backgroundColor: '#3b82f6', borderRadius: 8, alignItems: 'center' }
});

export default HospitalAdminQuestionLibrary;
