/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#232F3E',
          dark: '#131A22',
          light: '#37475A',
        },
        accent: {
          DEFAULT: '#FF9900',
          dark: '#E68900',
          light: '#FFB84D',
        },
        green: {
          DEFAULT: '#2D7A4F',
          dark: '#1F5C3A',
          light: '#4CAF73',
        },
        warm: {
          beige: '#F5F5F0',
          brown: '#555555',
          tan: '#AAAAAA',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#F5F5F0',
        },
        borderc: '#E3E3E3',
        text: {
          DEFAULT: '#0F1111',
          muted: '#565959',
        },
        danger: '#CC0C39',
        warning: '#FF9900',
        success: '#2D7A4F',
        trust: '#2D7A4F',
      },
    },
  },
  plugins: [],
};
