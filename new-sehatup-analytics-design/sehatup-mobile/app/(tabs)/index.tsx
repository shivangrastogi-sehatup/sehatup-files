import { 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { Palette, Radius, Shadow, Spacing } from '../../constants/Theme';
import { GlassCard } from '@/components/common/GlassCard';
import { 
  Search, 
  Stethoscope, 
  Pill, 
  Microscope, 
  ShieldCheck, 
  ChevronRight,
  Bell
} from 'lucide-react-native';
import { MotiView } from 'moti';

export default function HomeScreen() {
  const categories = [
    { id: 1, title: 'Book\nConsultation', icon: Stethoscope, color: '#E3F2FD' },
    { id: 2, title: 'Order\nMedicines', icon: Pill, color: '#E8F5E9' },
    { id: 3, title: 'Lab\nTests', icon: Microscope, color: '#FFF3E0' },
    { id: 4, title: 'Health\nPackages', icon: ShieldCheck, color: '#F3E5F5' },
  ];

  return (
    <SafeAreaView style={styles.mainContainer}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Section */}
        <MotiView 
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500 }}
          style={styles.header}
        >
          <View style={styles.greetingRow}>
            <View>
              <Text style={styles.greetingText}>Good Morning,</Text>
              <Text style={styles.userNameText}>Shivang 👋</Text>
            </View>
            <TouchableOpacity style={styles.notificationBtn}>
              <Bell size={24} color={Palette.textPrimary} />
              <View style={styles.notificationDot} />
            </TouchableOpacity>
          </View>

          {/* Smart Search */}
          <GlassCard style={styles.searchBar}>
            <Search size={20} color={Palette.textSecondary} />
            <TextInput 
              placeholder="Search doctors, medicines..."
              placeholderTextColor={Palette.textSecondary}
              style={styles.searchInput}
            />
          </GlassCard>
        </MotiView>

        {/* Categories Grid */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <View style={styles.categoryGrid}>
            {categories.map((cat, index) => (
              <MotiView
                key={cat.id}
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'timing', duration: 400, delay: index * 100 }}
                style={styles.categoryItem}
              >
                <TouchableOpacity style={styles.categoryCard}>
                  <View style={[styles.iconContainer, { backgroundColor: cat.color }]}>
                    <cat.icon size={28} color={Palette.primary} />
                  </View>
                  <Text style={styles.categoryLabel}>{cat.title}</Text>
                </TouchableOpacity>
              </MotiView>
            ))}
          </View>
        </View>

        {/* Health Highlight */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Medical Experts</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
          
          <GlassCard style={styles.doctorCard}>
            <View style={styles.doctorInfoRow}>
              <View style={styles.doctorAvatarContainer}>
                <Image 
                  source={{ uri: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=200&auto=format&fit=crop' }} 
                  style={styles.doctorAvatar}
                />
                <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
              </View>
              <View style={styles.doctorDetails}>
                <Text style={styles.doctorName}>Dr. Aryan Sharma</Text>
                <Text style={styles.doctorSubtext}>Senior Cardiologist • 12 yrs exp</Text>
                <View style={styles.ratingRow}>
                  <Text style={styles.ratingText}>⭐ 4.9</Text>
                  <Text style={styles.reviewsText}>(120+ Reviews)</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.bookBtn}>
                <ChevronRight size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>

        {/* Health Tips / Newsletter */}
        <GlassCard style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Daily Health Tip</Text>
          <Text style={styles.tipsDesc}>Staying hydrated boosts your focus. Aim for at least 8 glasses of water today!</Text>
        </GlassCard>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Palette.background,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  greetingText: {
    fontSize: 16,
    color: Palette.textSecondary,
    fontWeight: '500',
  },
  userNameText: {
    fontSize: 24,
    fontWeight: '700',
    color: Palette.textPrimary,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.primary,
    borderWidth: 2,
    borderColor: Palette.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    height: 54,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 16,
    color: Palette.textPrimary,
  },
  sectionContainer: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Palette.textPrimary,
    marginBottom: Spacing.md,
  },
  seeAllText: {
    color: Palette.primary,
    fontWeight: '600',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryItem: {
    width: '48%',
    marginBottom: Spacing.md,
  },
  categoryCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadow.soft,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: Palette.textPrimary,
  },
  doctorCard: {
    padding: Spacing.sm,
    backgroundColor: '#fff',
  },
  doctorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorAvatarContainer: {
    position: 'relative',
  },
  doctorAvatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  doctorDetails: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.textPrimary,
  },
  doctorSubtext: {
    fontSize: 12,
    color: Palette.textSecondary,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: Palette.textPrimary,
  },
  reviewsText: {
    fontSize: 11,
    color: Palette.textSecondary,
    marginLeft: 4,
  },
  bookBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsCard: {
    margin: Spacing.lg,
    marginTop: Spacing.xl,
    backgroundColor: Palette.primarySoft,
    padding: Spacing.lg,
    borderColor: 'transparent',
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Palette.primary,
    marginBottom: 4,
  },
  tipsDesc: {
    fontSize: 14,
    color: Palette.textPrimary,
    lineHeight: 20,
    opacity: 0.8,
  },
});
