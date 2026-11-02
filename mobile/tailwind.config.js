/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Mirrors the web theme in frontend/app/globals.css.
      colors: {
        primary: { DEFAULT: '#232F3E', dark: '#131A22', light: '#37475A' },
        secondary: { DEFAULT: '#2D7A4F', container: '#E6F2EB', dark: '#1F5C3A' },
        trust: { emerald: '#2D7A4F', 'emerald-light': '#E6F2EB', 'emerald-border': '#B7D9C5' },
        emerald: {
          50: '#F0F7F3', 100: '#E6F2EB', 200: '#B7D9C5', 300: '#8FC4A5', 400: '#4CAF73',
          500: '#3A9463', 600: '#2D7A4F', 700: '#256A44', 800: '#1F5C3A', 900: '#174730',
        },
        grade: {
          'a-bg': '#E6F2EB', 'a-text': '#1F5C3A', 'b-bg': '#EEF3F8', 'b-text': '#37475A',
          'c-bg': '#FFF4E0', 'c-text': '#8A5300',
        },
        discount: { crimson: '#CC0C39', 'crimson-bg': '#FDECEF' },
        surface: { DEFAULT: '#FFFFFF', canvas: '#F5F5F0', alt: '#F5F5F0', dim: '#E3E3E3', container: '#EDEDE8' },
        borderc: '#E3E3E3',
        'border-strong': '#CFCFC8',
        text: { DEFAULT: '#0F1111', muted: '#565959', subtle: '#6F7373' },
        accent: { DEFAULT: '#FF9900', dark: '#E68900', light: '#FFB84D' },
        green: { DEFAULT: '#2D7A4F', dark: '#1F5C3A', light: '#4CAF73' },
        warm: { beige: '#F5F5F0', brown: '#555555', tan: '#8A8A8A' },
        danger: '#CC0C39',
        warning: '#FF9900',
        success: '#2D7A4F',
      },
      // Calmer hierarchy: nothing heavier than bold.
      fontWeight: { extrabold: '700', black: '700' },
    },
  },
  plugins: [],
};
