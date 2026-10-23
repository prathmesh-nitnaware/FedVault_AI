/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#05070D',
          900: '#0A0E1A',
          850: '#0F1424',
          800: '#151B2E',
          700: '#1E263D',
        },
        gold: {
          300: '#F9E79F',
          400: '#F5D76E',
          500: '#E5BE3A',
          600: '#D4AF37',
          700: '#B8972E',
        },
        emerald: {
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
        }
      }
    },
  },
  plugins: [],
}
