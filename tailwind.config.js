/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', '"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        // Design System - Light Mode
        bg: {
          page: '#EBEBEB',
          card: '#FFFFFF',
          elevated: '#F9F9F9',
          input: '#F5F5F5',
        },
        text: {
          primary: '#111111',
          secondary: '#6B7280',
          muted: '#9CA3AF',
        },
        border: {
          DEFAULT: '#E5E7EB',
        },
        accent: '#1A1A1A',
        state: {
          blue: '#2563EB',
          green: '#22C55E',
          red: '#EF4444',
          pink: '#EC4899',
          amber: '#F97316',
        },
        // Dark Mode
        dark: {
          bg: {
            page: '#111111',
            card: '#1A1A1A',
            elevated: '#222222',
            input: '#2A2A2A',
          },
          text: {
            primary: '#F5F5F5',
            secondary: '#A1A1AA',
            muted: '#52525B',
          },
          border: '#2E2E2E',
          accent: '#FFFFFF',
          state: {
            blue: '#3B82F6',
            green: '#4ADE80',
            red: '#F87171',
            pink: '#F472B6',
            amber: '#FB923C',
          },
        },
        // Midnight Enterprise Theme (legacy)
        midnight: {
          950: '#0f172a',
          900: '#121212',
          800: '#1e293b',
          750: '#1a2332',
          700: '#334155',
          600: '#475569',
        },
        enterprise: {
          text: '#f8fafc',
          silver: '#e2e8f0',
          muted: '#94a3b8',
        },
        neon: {
          cyan: '#06b6d4',
          'cyan-glow': '#22d3ee',
          'cyan-bright': '#67e8f9',
        },
        status: {
          success: '#86efac',
          error: '#fca5a5',
          warning: '#fcd34d',
          info: '#93c5fd',
        },
        slate: {
          850: '#1a202e',
        }
      },
      boxShadow: {
        'neon-cyan': '0 0 20px rgba(34, 211, 238, 0.3)',
        'neon-cyan-lg': '0 0 30px rgba(34, 211, 238, 0.4)',
        'midnight': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
      },
      backgroundImage: {
        'midnight-gradient': 'linear-gradient(to bottom right, #0f172a, #1e293b)',
      },
      keyframes: {
        'pulse-once': {
          '0%':   { boxShadow: '0 0 0 0 rgba(34,211,238,0.5)' },
          '50%':  { boxShadow: '0 0 0 6px rgba(34,211,238,0.15)' },
          '100%': { boxShadow: '0 0 0 0 rgba(34,211,238,0)' },
        },
      },
      animation: {
        'pulse-once': 'pulse-once 1.2s ease-out 1',
      },
    },
  },
  plugins: [],
};
