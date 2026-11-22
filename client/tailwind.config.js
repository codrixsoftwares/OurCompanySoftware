/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // Exact light mode theme tokens matching codrix.co.in
        light: {
          DEFAULT: '#FBFBFE',
          50: '#FFFFFF',
          100: '#F7F5FE',
          200: '#F0ECFC',
          surface: '#F6F3FF',
          border: '#E7E0FB',
          text: '#120E24',
          subtext: '#585172',
        },
        // CodRix signature Electric Purple
        brand: {
          DEFAULT: '#7C2CF5',
          electric: '#7C2CF5',
          50: '#F5F0FF',
          100: '#EDE4FF',
          200: '#DDD0FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C2CF5',
          700: '#6B21A8',
          800: '#581C87',
          900: '#3B0764',
          950: '#120E24',
        },
        codrix: {
          DEFAULT: '#7C2CF5',
          electric: '#7C2CF5',
          50: '#F5F0FF',
          100: '#EDE4FF',
          200: '#DDD0FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C2CF5',
          700: '#6B21A8',
          800: '#581C87',
          900: '#3B0764',
          950: '#120E24',
        },
        indigo: {
          50: '#F5F0FF',
          100: '#EDE4FF',
          200: '#DDD0FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C2CF5',
          700: '#6B21A8',
          800: '#581C87',
          900: '#3B0764',
          950: '#120E24',
        }
      }
    },
  },
  plugins: [],
}
