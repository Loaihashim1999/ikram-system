/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#C9A24A',
          hover: '#8A6B24',
        },
        secondary: {
          DEFAULT: '#7C8D42',
          dark: '#546027',
        },
        surface: '#FFFFFF',
        page: '#F7F5F0',
        border: '#E5E2D9',
        success: '#3B8A5E',
        danger: '#C24B3F',
        warning: '#D89A2E',
      },
      fontFamily: {
        sans: ['Tajawal', 'sans-serif'],
      },
    },
  },
  plugins: [],
}