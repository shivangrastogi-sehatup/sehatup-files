/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Dark TV theme — high contrast, readable from 3 metres on a 1920x1080 wall display.
      // Tweak these once the final brand variables are confirmed.
      colors: {
        bg: {
          DEFAULT: '#0b1020', // page background
          panel: '#141a2e', // card / panel surface
          elevated: '#1c2440', // hovered / raised surface
        },
        border: {
          DEFAULT: '#26304f',
        },
        text: {
          DEFAULT: '#e8edf7', // primary text
          muted: '#9aa7c7', // secondary / labels
          faint: '#5f6c8c', // watermark / disabled
        },
        accent: {
          DEFAULT: '#22d3ee', // cyan — primary accent
          green: '#34d399', // success / positive
          amber: '#fbbf24', // warning / pending
          red: '#f87171', // negative / cancelled
          violet: '#a78bfa', // secondary series
          blue: '#60a5fa', // tertiary series
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // Minimum 13px floor for 3-metre readability.
        base: ['15px', '1.4'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
