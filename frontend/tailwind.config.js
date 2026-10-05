/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core Ikram Brand Colors
        brand: {
          green: {
            DEFAULT: '#3F6B3A',
            hover: '#31542D',
            light: '#EBF4EA',
            dark: '#223B1E',
          },
          gold: {
            DEFAULT: '#C9A24A',
            hover: '#B48528',
            light: '#F5EDDA',
            dark: '#8C6C26',
          },
          amber: {
            DEFAULT: '#D97706',
            hover: '#B45309',
            light: '#FEF3C7',
          },
        },
        // Surfaces & Backgrounds
        page: {
          DEFAULT: '#F7F5F0',
          soft: '#FAF8F5',
          accent: '#F4EFE3',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          soft: '#FAF8F5',
        },
        border: {
          DEFAULT: '#E5E2D9',
          light: '#E5E2D9',
          neutral: '#E5E7EB',
        },
        // Backwards compatibility mappings
        primary: {
          DEFAULT: '#C9A24A',
          hover: '#B48528',
          green: '#3F6B3A',
        },
        secondary: {
          DEFAULT: '#3F6B3A',
          dark: '#223B1E',
          light: '#EBF4EA',
        },
        // Semantic Status Colors
        status: {
          success: {
            bg: '#E6F4EC',
            text: '#2E7D32',
            border: '#A5D6A7',
          },
          warning: {
            bg: '#FEF3C7',
            text: '#B45309',
            border: '#FCD34D',
          },
          danger: {
            bg: '#FEE2E2',
            text: '#B91C1C',
            border: '#FCA5A5',
          },
          info: {
            bg: '#E0F2FE',
            text: '#0369A1',
            border: '#7DD3FC',
          },
        },
        danger: {
          DEFAULT: '#DC2626',
          hover: '#B91C1C',
          light: '#FEE2E2',
        },
        success: {
          DEFAULT: '#16A34A',
          hover: '#15803D',
          light: '#E6F4EC',
        },
        warning: {
          DEFAULT: '#D97706',
          hover: '#B45309',
          light: '#FEF3C7',
        },
      },
      fontFamily: {
        sans: ['Tajawal', 'Cairo', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
        'subtle': '0 2px 4px 0 rgba(63, 107, 58, 0.04)',
        'card': '0 4px 6px -1px rgba(63, 107, 58, 0.05), 0 2px 4px -1px rgba(63, 107, 58, 0.03)',
        'card-hover': '0 10px 15px -3px rgba(63, 107, 58, 0.08), 0 4px 6px -2px rgba(63, 107, 58, 0.04)',
        'dialog': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}