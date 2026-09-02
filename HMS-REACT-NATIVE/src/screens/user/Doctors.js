import React, { useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Image
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { useCachedDoctors } from '../../store/hooks';
import { fetchDoctors, fetchServices } from '../../store/slices/publicDataSlice';

const Doctors = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const dispatch = useDispatch();

    const serviceId = route.params?.serviceId || null;

    const { services: servicesList } = useSelector((state) => state.publicData);
    const { doctors: doctorsData, loading, error } = useCachedDoctors(serviceId);

    const serviceInfo = useMemo(() => {
        if (!serviceId) return { title: 'Medical Team', description: 'World-renowned fertility experts committed to your success.' };

        const foundService = servicesList.find(s =>
            s.id === serviceId ||
            s._id === serviceId ||
            (s.title && s.title.toLowerCase() === serviceId.replace(/-/g, ' ').toLowerCase())
        );

        if (foundService) {
            return {
                title: foundService.title,
                description: foundService.description || `Highly qualified specialists dedicated to ${foundService.title} treatments.`
            };
        }

        const isMongoId = /^[0-9a-fA-F]{24}$/.test(serviceId);
        const formattedTitle = isMongoId
            ? 'Specialist'
            : serviceId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        return {
            title: formattedTitle,
            description: `Highly qualified specialists dedicated to your health and well-being.`
        };
    }, [serviceId, servicesList]);

    const doctors = useMemo(() => {
        return doctorsData.map((doctor, index) => ({
            id: doctor._id || doctor.doctorId,
            name: doctor.name.toLowerCase().startsWith('dr.') ? doctor.name : `Dr. ${doctor.name}`,
            specialty: doctor.specialty || 'Fertility Specialist',
            services: doctor.services || [],
            experience: doctor.experience || 'Experienced',
            patients: doctor.patientsCount || '100+',
            education: doctor.education || 'MD, Specialist',
            image: doctor.image || (index % 2 === 0 ? '👩‍⚕️' : '👨‍⚕️')
        }));
    }, [doctorsData]);

    useEffect(() => {
        if (servicesList.length === 0) {
            dispatch(fetchServices());
        }
        dispatch(fetchDoctors(serviceId || null));
    }, [serviceId, dispatch, servicesList.length]);

    const handleBookAppointment = (doctorId) => {
        navigation.navigate('Appointment', { doctorId, serviceId });
    };

    return (
        <ScrollView style={styles.page} contentContainerStyle={styles.contentWrapper}>
            {/* Header Section */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.navigate('Services')} style={styles.backLink}>
                    <Text style={styles.backLinkText}>← Back to Services</Text>
                </TouchableOpacity>

                <View style={styles.headerContent}>
                    <View style={styles.badge}><Text style={styles.badgeText}>MEET OUR EXPERTS</Text></View>
                    <Text style={styles.title}>
                        {serviceId ? (
                            <><Text style={styles.textGradient}>{serviceInfo.title}</Text> Specialists</>
                        ) : (
                            <>Our <Text style={styles.textGradient}>Medical Team</Text></>
                        )}
                    </Text>
                    <Text style={styles.subtext}>{serviceInfo.description}</Text>
                </View>
            </View>

            {/* Doctors Grid */}
            <View style={styles.gridSection}>
                {loading ? (
                    <View style={styles.messageContainer}>
                        <ActivityIndicator size="large" color="#14C38E" />
                        <Text style={styles.messageText}>Finding the best specialists for you...</Text>
                    </View>
                ) : error ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>Unable to load doctors. Please try again later.</Text>
                    </View>
                ) : doctors.length > 0 ? (
                    <View style={styles.grid}>
                        {doctors.map((doctor) => (
                            <View key={doctor.id} style={styles.doctorCard}>
                                {/* Doctor Image */}
                                <View style={styles.imageWrapper}>
                                    {doctor.image && doctor.image.startsWith('http') ? (
                                        <Image source={{ uri: doctor.image }} style={styles.doctorImage} />
                                    ) : (
                                        <Text style={styles.doctorEmoji}>{doctor.image}</Text>
                                    )}
                                </View>

                                {/* Doctor Info */}
                                <View style={styles.doctorInfo}>
                                    <View style={styles.specialtyBadge}><Text style={styles.specialtyBadgeText}>{doctor.specialty}</Text></View>
                                    <Text style={styles.doctorName}>{doctor.name}</Text>
                                    <Text style={styles.education}>{doctor.education}</Text>

                                    {/* Stats */}
                                    <View style={styles.statsContainer}>
                                        <View style={styles.statItem}>
                                            <Text style={styles.statIcon}>🎓</Text>
                                            <Text style={styles.statValue}>{doctor.experience}</Text>
                                            <Text style={styles.statLabel}>EXPERIENCE</Text>
                                        </View>
                                        <View style={styles.statItem}>
                                            <Text style={styles.statIcon}>🏥</Text>
                                            <Text style={styles.statValue}>{doctor.patients}</Text>
                                            <Text style={styles.statLabel}>PATIENTS</Text>
                                        </View>
                                    </View>

                                    {/* Services Tags */}
                                    <View style={styles.servicesTags}>
                                        {serviceId && <View style={[styles.serviceTag, styles.serviceTagActive]}><Text style={styles.serviceTagTextActive}>{serviceInfo.title}</Text></View>}
                                        {doctor.services
                                            .filter(s => s !== serviceId && s !== serviceInfo.title)
                                            .slice(0, 2)
                                            .map((s, i) => (
                                                <View key={i} style={styles.serviceTag}>
                                                    <Text style={styles.serviceTagText}>{s.length < 20 ? s.replace(/-/g, ' ') : 'Specialized Care'}</Text>
                                                </View>
                                            ))}
                                    </View>

                                    <TouchableOpacity style={styles.btnPrimary} onPress={() => handleBookAppointment(doctor.id)}>
                                        <Text style={styles.btnPrimaryText}>Book Appointment</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>👨‍⚕️</Text>
                        <Text style={styles.emptyTitle}>No Specialists Found</Text>
                        <Text style={styles.emptySubtext}>We couldn't find a doctor specifically matching "{serviceInfo.title}" at the moment.</Text>
                        <Text style={styles.emptySubtext}>However, our general fertility experts are available to assist you.</Text>
                        <View style={styles.emptyActions}>
                            <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('Doctors', { serviceId: null })}>
                                <Text style={styles.btnSecondaryText}>View All Doctors</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Appointment')}>
                                <Text style={styles.btnPrimaryText}>Book General Consultation</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* CTA Section */}
            {doctors.length > 0 && !loading && (
                <View style={styles.ctaCard}>
                    <Text style={styles.ctaTitle}>Need Help Choosing a Doctor?</Text>
                    <Text style={styles.ctaSubtext}>Our patient coordinators can help you find the perfect specialist for your needs.</Text>
                    <TouchableOpacity style={styles.btnWhite} onPress={() => navigation.navigate('Appointment')}>
                        <Text style={styles.btnWhiteText}>Get Personalized Recommendation</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: '#F8F9FD' },
    contentWrapper: { padding: 24, paddingTop: 40, paddingBottom: 100 },

    /* Header */
    header: { marginBottom: 50, alignItems: 'center' },
    backLink: { alignSelf: 'flex-start', marginBottom: 30 },
    backLinkText: { color: '#64748B', fontSize: 15, fontWeight: '600' },
    headerContent: { alignItems: 'center', width: '100%' },
    badge: { backgroundColor: 'rgba(20, 195, 142, 0.1)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginBottom: 20 },
    badgeText: { color: '#0A2647', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
    title: { fontSize: 32, fontWeight: '700', color: '#1E293B', marginBottom: 20, textAlign: 'center' },
    textGradient: { color: '#14C38E' },
    subtext: { fontSize: 16, color: '#64748B', textAlign: 'center', lineHeight: 24 },

    /* Messages */
    messageContainer: { padding: 60, alignItems: 'center' },
    messageText: { marginTop: 15, fontSize: 16, color: '#64748B' },
    errorContainer: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 24, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#EF4444', marginVertical: 40 },
    errorText: { color: '#EF4444', fontSize: 16 },

    /* Grid */
    gridSection: { marginBottom: 60 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'center' },

    /* Doctor Card */
    doctorCard: {
        backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', width: '100%',
        maxWidth: 350, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderColor: 'rgba(226, 232, 240, 0.8)',
        borderWidth: 1, marginBottom: 20
    },
    imageWrapper: { width: '100%', height: 250, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    doctorImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    doctorEmoji: { fontSize: 80 },

    /* Doctor Info */
    doctorInfo: { padding: 24 },
    specialtyBadge: { backgroundColor: 'rgba(20, 195, 142, 0.1)', alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginBottom: 12 },
    specialtyBadgeText: { color: '#14C38E', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    doctorName: { fontSize: 22, color: '#0A2647', fontWeight: '700', marginBottom: 8 },
    education: { fontSize: 13, color: '#64748B', marginBottom: 20 },

    /* Stats */
    statsContainer: { flexDirection: 'row', gap: 20, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(226, 232, 240, 0.5)', marginBottom: 20 },
    statItem: { flex: 1 },
    statIcon: { fontSize: 18, marginBottom: 4 },
    statValue: { fontSize: 16, fontWeight: '700', color: '#0A2647' },
    statLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2 },

    /* Tags */
    servicesTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    serviceTag: { backgroundColor: '#F8F9FD', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(226, 232, 240, 0.8)' },
    serviceTagText: { color: '#1E293B', fontSize: 12, fontWeight: '600' },
    serviceTagActive: { backgroundColor: '#14C38E', borderColor: '#14C38E' },
    serviceTagTextActive: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

    /* Buttons */
    btnPrimary: { backgroundColor: '#14C38E', paddingVertical: 14, borderRadius: 50, alignItems: 'center', width: '100%' },
    btnPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    btnSecondary: { backgroundColor: 'transparent', paddingVertical: 14, borderRadius: 50, alignItems: 'center', borderWidth: 2, borderColor: '#0A2647', width: '100%', marginBottom: 12 },
    btnSecondaryText: { color: '#0A2647', fontSize: 15, fontWeight: '600' },

    /* Empty State */
    emptyState: { alignItems: 'center', paddingVertical: 60 },
    emptyIcon: { fontSize: 64, opacity: 0.5, marginBottom: 20 },
    emptyTitle: { fontSize: 28, color: '#0A2647', fontWeight: '700', marginBottom: 12 },
    emptySubtext: { fontSize: 16, color: '#64748B', textAlign: 'center', marginBottom: 10, paddingHorizontal: 20 },
    emptyActions: { marginTop: 30, width: '100%', maxWidth: 350 },

    /* CTA Card */
    ctaCard: { backgroundColor: '#0A2647', borderRadius: 24, padding: 40, alignItems: 'center', marginTop: 40 },
    ctaTitle: { fontSize: 24, color: '#FFFFFF', fontWeight: '700', marginBottom: 15, textAlign: 'center' },
    ctaSubtext: { fontSize: 16, color: '#FFFFFF', opacity: 0.9, marginBottom: 30, textAlign: 'center' },
    btnWhite: { backgroundColor: '#FFFFFF', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 50, width: '100%', alignItems: 'center' },
    btnWhiteText: { color: '#0A2647', fontSize: 15, fontWeight: '700' }
});

export default Doctors;
