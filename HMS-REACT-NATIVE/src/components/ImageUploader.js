import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { uploadAPI } from '../utils/api'; 
import { Feather } from '@expo/vector-icons';

const ImageUploader = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf'],
          multiple: true
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      setUploading(true);
      setError(null);

      const formData = new FormData();
      for (let i = 0; i < result.assets.length; i++) {
        formData.append('images', {
            uri: result.assets[i].uri,
            name: result.assets[i].name,
            type: result.assets[i].mimeType || 'application/octet-stream'
        });
      }

      const data = await uploadAPI.uploadImages(formData);
      if (data.success) {
        setUploadedFiles(prev => [...prev, ...data.files]);
        Alert.alert("Success", `Successfully uploaded ${data.count} images!`);
      }
    } catch (err) {
      console.error("Upload failed", err);
      setError(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Upload Images</Text>

      {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

      <View style={styles.inputWrapper}>
        <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload} disabled={uploading}>
            <Feather name="upload-cloud" size={20} color="white" />
            <Text style={styles.uploadBtnText}>Select Files to Upload</Text>
        </TouchableOpacity>
      </View>

      {uploading && (
          <View style={styles.statusRow}>
              <ActivityIndicator size="small" color="#6366f1" />
              <Text style={styles.statusText}>Uploading... Please wait.</Text>
          </View>
      )}

      {/* Preview Section */}
      <View style={styles.previewGrid}>
        {uploadedFiles.map((file, index) => (
          <View key={index} style={styles.previewItem}>
            <Image
              source={{ uri: file.url }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <Text style={styles.previewName} numberOfLines={1}>{file.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
    container: { padding: 16, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginVertical: 10 },
    header: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
    errorBox: { padding: 10, backgroundColor: '#fee2e2', borderRadius: 8, marginBottom: 12 },
    errorText: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
    inputWrapper: { marginBottom: 12 },
    uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6366f1', paddingVertical: 12, borderRadius: 8 },
    uploadBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    statusText: { fontSize: 13, color: '#6366f1', fontWeight: '600' },
    previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    previewItem: { width: 100, alignItems: 'center' },
    previewImage: { width: 100, height: 100, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 6 },
    previewName: { fontSize: 11, color: '#64748b', textAlign: 'center' }
});

export default ImageUploader;
