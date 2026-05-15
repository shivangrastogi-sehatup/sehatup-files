import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  Dimensions, 
  TouchableOpacity,
  NativeScrollEvent,
  NativeSyntheticEvent
} from 'react-native';
import { Palette, Radius, Spacing } from '../constants/Theme';
import { AppButton } from '../components/common/AppButton';
import { MotiView } from 'moti';
import { Shield, Smartphone, HeartPulse } from 'lucide-react-native';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: 1,
    title: 'Integrated Healthcare',
    desc: 'Combining Allopathy, Ayurveda, and Homeopathy for your holistic wellness.',
    icon: Shield,
  },
  {
    id: 2,
    title: 'Consult Experts',
    desc: 'Book appointments with top-tier specialists from the comfort of your home.',
    icon: Smartphone,
  },
  {
    id: 3,
    title: 'Track Progress',
    desc: 'Access your health reports and monitor your recovery in real-time.',
    icon: HeartPulse,
  },
];

export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const router = useRouter();

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / width);
    setActiveIndex(index);
  };

  const handleFinish = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <MotiView
              from={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 800 }}
              style={styles.iconCircle}
            >
              <item.icon size={80} color={Palette.primary} />
            </MotiView>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.desc}>{item.desc}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.dot, 
                i === activeIndex && styles.activeDot
              ]} 
            />
          ))}
        </View>

        <AppButton 
          title={activeIndex === SLIDES.length - 1 ? "Get Started" : "Next"} 
          onPress={handleFinish}
          style={styles.btn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  slide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Palette.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  desc: {
    fontSize: 16,
    color: Palette.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  footer: {
    padding: Spacing.xl,
    paddingBottom: 60,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#eee',
    marginHorizontal: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: Palette.primary,
  },
  btn: {
    width: '100%',
  },
});
