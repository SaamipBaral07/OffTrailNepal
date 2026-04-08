/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  safelist: [
    'text-navy',
    'text-gold',
    'text-alpine',
    'text-gold-dark',
    'bg-navy/5',
    'bg-gold/5',
    'bg-alpine/5',
    'bg-navy/10',
    'bg-gold/10',
    'bg-alpine/10',
    'bg-gold-pale',
    'border-gold',
    'border-navy',
    'border-alpine',
  ],
  theme: {
    extend: {
      colors: {
        /* ── Primary: Deep Navy (from compass & mountain outlines) ── */
        navy: {
          DEFAULT: '#0C2340',
          light: '#163A5F',
          dark: '#081A2F',
          50: '#F0F4F8',
          100: '#D9E2EC',
          200: '#BCCCDC',
          300: '#9FB3C8',
          400: '#547AA5',
        },
        /* ── Accent: Rich Gold (from compass needle & sun rays) ── */
        gold: {
          DEFAULT: '#C8932A',
          light: '#E0B04A',
          dark: '#A67822',
          pale: '#FBF5E8',
          50: '#FDF8ED',
          100: '#F9EDCF',
          200: '#F0D99A',
          300: '#E5C165',
          400: '#D4A43A',
        },
        /* ── Nature: Alpine Green ── */
        alpine: {
          DEFAULT: '#2D6A4F',
          light: '#40916C',
          dark: '#1B4332',
        },
        /* ── Surface & Text ── */
        cream: '#FAF8F5',
        stone: '#E8E2D8',
        charcoal: '#1A1A2E',
      },
      fontFamily: {
        heading: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.7s ease-out forwards',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-down': 'slideDown 0.3s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(200, 147, 42, 0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(200, 147, 42, 0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}