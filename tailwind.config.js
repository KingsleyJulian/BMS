/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        // Sidebar / brand maroon — sampled from the reference dashboard
        maroon: {
          950: '#1f0707',
          900: '#2a0a0a',
          800: '#3a1010',
          700: '#4a1818',
          600: '#5e1e1e',
          500: '#7a2828',
          accent: '#8c2d2d'
        },
        // Cream content background
        cream: {
          50: '#fdf8ef',
          100: '#faf3e7',
          200: '#f5ecd8',
          300: '#ecdfc1',
          400: '#dec99a'
        },
        // Gold accent (the SI logo, active highlights)
        gold: {
          400: '#d4b15a',
          500: '#c9a449',
          600: '#b8923a',
          700: '#9a7a2c'
        },
        ink: {
          900: '#241313',
          800: '#3a1f1f',
          700: '#5a3a3a',
          600: '#7a5555'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
}
