/**
 * SehatUP Premium Theme Tokens
 */

export const Palette = {
  primary: '#ff4757',       // Brand Red/Pink
  primarySoft: '#ffeef0',   // Light brand tint
  background: '#ffffff',     // Pure white for cleanliness
  surface: '#f8f9fa',       // Off-white for cards
  textPrimary: '#1a1a1a',   // Main headings
  textSecondary: '#666666', // Descriptions
  divider: '#eeeeee',       // Subtle lines
  white: '#ffffff',
  black: '#000000',
  glass: 'rgba(255, 255, 255, 0.8)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 32,
  grid: 8,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const Shadow = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 5,
  },
};

export default {
  Palette,
  Spacing,
  Radius,
  Shadow,
};
