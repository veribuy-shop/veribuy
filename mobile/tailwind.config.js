/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0B192C',
          dark: '#0e1c2f',
          light: '#213145',
        },
        secondary: {
          DEFAULT: '#0D9488',
          container: '#86f2e4',
          dark: '#006a61',
        },
        trust: {
          emerald: '#059669',
          'emerald-light': '#ECFDF5',
          'emerald-border': '#A7F3D0',
        },
        grade: {
          'a-bg': '#F0FDF4',
          'a-text': '#15803D',
          'b-bg': '#EFF6FF',
          'b-text': '#1D4ED8',
          'c-bg': '#FEFCE8',
          'c-text': '#A16207',
        },
        discount: {
          crimson: '#E11D48',
          'crimson-bg': '#FFF1F2',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          canvas: '#F8FAFC',
          alt: '#eff4ff',
          dim: '#cbdbf5',
          container: '#e5eeff',
        },
        borderc: '#E2E8F0',
        'border-strong': '#CBD5E1',
        text: {
          DEFAULT: '#0B1C30',
          muted: '#44474C',
          subtle: '#64748B',
        },
        accent: {
          DEFAULT: '#FF9900',
          dark: '#E68900',
          light: '#FFB84D',
        },
        green: {
          DEFAULT: '#059669',
          dark: '#047857',
          light: '#10B981',
        },
        warm: {
          beige: '#F8FAFC',
          brown: '#555555',
          tan: '#AAAAAA',
        },
        danger: '#BA1A1A',
        warning: '#F59E0B',
        success: '#059669',
      },
    },
  },
  plugins: [],
};
