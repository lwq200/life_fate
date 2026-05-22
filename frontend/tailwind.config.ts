import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f5f0e8',
          100: '#e8dcc8',
          200: '#d4c5a9',
          300: '#b8a080',
          400: '#9c7f5e',
          500: '#8b7355',
          600: '#6b5a42',
          700: '#4d3f2e',
          800: '#2d2520',
          900: '#1a1510',
          950: '#0d0b08',
        },
        gold: {
          50: '#fdf8ed',
          100: '#f9edcc',
          200: '#f0d68e',
          300: '#e8c05a',
          400: '#d4a84b',
          500: '#c9a96e',
          600: '#a8863e',
          700: '#8b6a2e',
          800: '#6e5224',
          900: '#523d1b',
        },
      },
      fontFamily: {
        serif: ['Georgia', '"Noto Serif SC"', '"Songti SC"', '"SimSun"', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(201,169,110,0.2)' },
          '50%': { boxShadow: '0 0 24px rgba(201,169,110,0.4)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
