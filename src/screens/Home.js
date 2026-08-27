import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const Home = () => {
  const navigation = useNavigation();

  const doctors = [
    { 
      name: "Dr. Elena Gilbert", 
      role: "Senior Embryologist", 
      image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400&h=400" 
    },
    { 
      name: "Dr. Stefan Salvatore", 
      role: "IVF Specialist", 
      image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=400&h=400" 
    },
    { 
      name: "Dr. Caroline Forbes", 
      role: "Reproductive Surgeon", 
      image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&q=80&w=400&h=400" 
    },
    { 
      name: "Dr. Alaric Saltzman", 
      role: "Andrologist", 
      image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400&h=400" 
    }
  ];

  return (
    <ScrollView style={styles.container}>
      
      {/* --- HERO SECTION --- */}
      <View style={styles.heroSection}>
        <View style={styles.heroContent}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>#1 Fertility Center</Text>
          </View>
          <Text style={styles.heroTitle}>Begin Your Journey to</Text>
          <Text style={styles.heroTitleHighlight}>Parenthood</Text>
          <Text style={styles.heroSubtext}>
            Realize your dream of family with world-class IVF technology, 
            personalized fertility plans, and compassionate care at every step.
          </Text>
          <View style={styles.heroButtons}>
            <TouchableOpacity 
              style={styles.btnPrimary}
              onPress={() => navigation.navigate('Services')}
            >
              <Text style={styles.btnPrimaryText}>Book Free Consultation</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.btnSecondary}
              onPress={() => navigation.navigate('Services')}
            >
              <Text style={styles.btnSecondaryText}>Explore Treatments</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>10k+</Text>
              <Text style={styles.statLabel}>Successful Births</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>98%</Text>
              <Text style={styles.statLabel}>Satisfaction Rate</Text>
            </View>
          </View>
        </View>

        <View style={styles.heroVisual}>
          <View style={styles.visualCardMain}>
            <Text style={styles.cardIcon}>🧬</Text>
            <Text style={styles.cardTitle}>Advanced Embryology</Text>
            <Text style={styles.cardDesc}>State-of-the-art genetic screening.</Text>
          </View>
        </View>
      </View>

      {/* --- WHY CHOOSE US SECTION --- */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Why Choose Our IVF Center</Text>
          <Text style={styles.sectionSubtitle}>Combining science and empathy to deliver the highest success rates.</Text>
        </View>
        
        <View style={styles.featuresGrid}>
          <View style={styles.featureCard}>
            <Text style={styles.iconBox}>🎯</Text>
            <Text style={styles.featureTitle}>High Success Rates</Text>
            <Text style={styles.featureDesc}>Our advanced protocols consistently deliver success rates well above the national average.</Text>
          </View>
          <View style={styles.featureCard}>
            <Text style={styles.iconBox}>🤝</Text>
            <Text style={styles.featureTitle}>Compassionate Care</Text>
            <Text style={styles.featureDesc}>A dedicated team of counselors and specialists to support you emotionally and physically.</Text>
          </View>
          <View style={styles.featureCard}>
            <Text style={styles.iconBox}>💡</Text>
            <Text style={styles.featureTitle}>Latest Technology</Text>
            <Text style={styles.featureDesc}>Equipped with Time-Lapse Imaging and Laser Assisted Hatching for better outcomes.</Text>
          </View>
        </View>
      </View>

      {/* --- SERVICES SECTION --- */}
      <View style={[styles.section, { backgroundColor: '#f8fafc' }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Fertility Treatments</Text>
          <Text style={styles.sectionSubtitle}>Comprehensive solutions tailored to your unique biology.</Text>
        </View>

        <View style={styles.servicesGrid}>
          {[
            { title: 'In Vitro Fertilization (IVF)', desc: 'Advanced assisted reproductive technology for complex fertility cases.' },
            { title: 'IUI (Insemination)', desc: 'A less invasive first step for many couples trying to conceive.' },
            { title: 'ICSI', desc: 'Intracytoplasmic Sperm Injection for severe male factor infertility.' },
            { title: 'Egg Freezing', desc: 'Empower your future by preserving your fertility today.' },
            { title: 'Male Infertility', desc: 'Comprehensive diagnosis and treatments for male reproductive health.' },
            { title: 'Genetic Testing', desc: 'PGT-A and PGT-M testing to ensure a healthy pregnancy.' }
          ].map((service, index) => (
            <View key={index} style={styles.serviceCard}>
              <Text style={styles.serviceTitle}>{service.title}</Text>
              <Text style={styles.serviceDesc}>{service.desc}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Services')}>
                <Text style={styles.learnMore}>View Details &rarr;</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      {/* --- DOCTORS SECTION --- */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Meet Our Fertility Experts</Text>
          <Text style={styles.sectionSubtitle}>Renowned specialists dedicated to making your dream come true.</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.doctorsScroll}>
          {doctors.map((doc, idx) => (
            <View key={idx} style={styles.doctorCard}>
              <Image source={{ uri: doc.image }} style={styles.doctorImg} />
              <View style={styles.doctorInfo}>
                <Text style={styles.doctorName}>{doc.name}</Text>
                <Text style={styles.doctorRole}>{doc.role}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* --- TESTIMONIALS SECTION --- */}
      <View style={[styles.section, { backgroundColor: '#f0fdf4' }]}>
        <Text style={[styles.sectionTitle, { textAlign: 'center', marginBottom: 20 }]}>Stories of Hope</Text>
        <View style={{ gap: 16 }}>
          <View style={styles.testimonialCard}>
            <Text style={styles.quoteIcon}>“</Text>
            <Text style={styles.testimonialText}>After 5 years of trying, this center gave us our miracle baby. The doctors were patient and the technology is top-notch.</Text>
            <Text style={styles.testimonialAuthor}>- The Williams Family</Text>
          </View>
          <View style={styles.testimonialCard}>
            <Text style={styles.quoteIcon}>“</Text>
            <Text style={styles.testimonialText}>Professionalism mixed with genuine care. They explained every step of the IVF process clearly. Highly recommended.</Text>
            <Text style={styles.testimonialAuthor}>- Sarah & James</Text>
          </View>
        </View>
      </View>

      {/* --- CTA SECTION --- */}
      <View style={styles.ctaSection}>
        <Text style={styles.ctaTitle}>Ready to Start Your Family?</Text>
        <Text style={styles.ctaDesc}>Book a confidential consultation with our fertility experts today.</Text>
        <TouchableOpacity 
          style={styles.btnWhite}
          onPress={() => navigation.navigate('Services')}
        >
          <Text style={styles.btnWhiteText}>Schedule Appointment</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  heroSection: { padding: 20, paddingTop: 40, backgroundColor: '#eff6ff' },
  heroContent: { alignItems: 'center', textAlign: 'center' },
  badge: { backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  badgeText: { color: '#2563eb', fontWeight: 'bold', fontSize: 12 },
  heroTitle: { fontSize: 32, fontWeight: '800', color: '#1e293b', textAlign: 'center' },
  heroTitleHighlight: { fontSize: 32, fontWeight: '800', color: '#2563eb', textAlign: 'center', marginBottom: 12 },
  heroSubtext: { fontSize: 16, color: '#475569', textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  heroButtons: { flexDirection: 'row', gap: 12, marginBottom: 30, flexWrap: 'wrap', justifyContent: 'center' },
  btnPrimary: { backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnSecondary: { backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#2563eb' },
  btnSecondaryText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
  statsRow: { flexDirection: 'row', gap: 24, justifyContent: 'center', marginBottom: 30 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  statLabel: { fontSize: 13, color: '#64748b' },
  heroVisual: { alignItems: 'center', marginTop: 20 },
  visualCardMain: { backgroundColor: '#fff', padding: 20, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, alignItems: 'center' },
  cardIcon: { fontSize: 32, marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  cardDesc: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  
  section: { padding: 24, paddingVertical: 40 },
  sectionHeader: { alignItems: 'center', marginBottom: 30 },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b', textAlign: 'center', marginBottom: 8 },
  sectionSubtitle: { fontSize: 15, color: '#64748b', textAlign: 'center' },
  
  featuresGrid: { gap: 20 },
  featureCard: { backgroundColor: '#fff', padding: 24, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  iconBox: { fontSize: 32, marginBottom: 16 },
  featureTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  featureDesc: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  
  servicesGrid: { gap: 16 },
  serviceCard: { backgroundColor: '#fff', padding: 20, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  serviceTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  serviceDesc: { fontSize: 14, color: '#64748b', marginBottom: 12 },
  learnMore: { color: '#2563eb', fontWeight: 'bold', fontSize: 14 },

  doctorsScroll: { paddingBottom: 20 },
  doctorCard: { width: 220, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginRight: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  doctorImg: { width: '100%', height: 220 },
  doctorInfo: { padding: 16 },
  doctorName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  doctorRole: { fontSize: 13, color: '#64748b' },

  testimonialCard: { backgroundColor: '#fff', padding: 24, borderRadius: 12, borderWidth: 1, borderColor: '#dcfce7' },
  quoteIcon: { fontSize: 40, color: '#16a34a', opacity: 0.2, marginBottom: -20 },
  testimonialText: { fontSize: 15, color: '#475569', fontStyle: 'italic', marginBottom: 16, lineHeight: 22, marginTop: 20 },
  testimonialAuthor: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },

  ctaSection: { backgroundColor: '#2563eb', padding: 40, alignItems: 'center' },
  ctaTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 12 },
  ctaDesc: { fontSize: 16, color: '#bfdbfe', textAlign: 'center', marginBottom: 24 },
  btnWhite: { backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 8 },
  btnWhiteText: { color: '#2563eb', fontWeight: 'bold', fontSize: 16 },
});

export default Home;
