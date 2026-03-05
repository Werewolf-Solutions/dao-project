/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand background
        primary: {
          DEFAULT: '#1a202c',
          light:   '#2d3748',
        },
        // Accent / CTA
        accent: {
          DEFAULT: '#8e2421',
          hover:   '#a12c29',
          muted:   '#8e242133',
        },
        // Surface layers (dark mode)
        surface: {
          DEFAULT: '#1e2533',
          card:    '#252d3d',
          nested:  '#2d3748',
          border:  '#3a4557',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
