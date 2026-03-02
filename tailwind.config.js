/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Midnight Enterprise Theme
        midnight: {
          950: '#0f172a', // Deep obsidian workspace
          900: '#121212', // Alternative charcoal
          800: '#1e293b', // Cards & containers
          750: '#1a2332', // Intermediate shade
          700: '#334155', // Lighter borders
          600: '#475569', // Muted elements
        },
        enterprise: {
          text: '#f8fafc',     // Primary text - off-white
          silver: '#e2e8f0',   // Secondary text
          muted: '#94a3b8',    // Tertiary text
        },
        neon: {
          cyan: '#06b6d4',      // METPower signature cyan
          'cyan-glow': '#22d3ee', // Glowing neon variant
          'cyan-bright': '#67e8f9', // Brightest accent
        },
        status: {
          success: '#86efac',   // Pastel green (desaturated)
          error: '#fca5a5',     // Pastel red (desaturated)
          warning: '#fcd34d',   // Pastel amber
          info: '#93c5fd',      // Pastel blue
        },
        // Keep existing slate for backwards compatibility
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
      }
    },
  },
  plugins: [],
};
