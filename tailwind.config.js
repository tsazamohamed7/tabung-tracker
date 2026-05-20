/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      colors: {
        bg: {
          DEFAULT: '#0f0f11',
          surface: '#18181c',
          surface2: '#1e1e24',
          surface3: '#25252c',
        },
        accent: {
          DEFAULT: '#c5f135',
          hover: '#d4f548',
          blue: '#9de0f5',
          pink: '#f5b8d3',
          gold: '#f5c842',
        },
        brand: {
          maybank: '#f5c842',
          cimb: '#e05555',
          muamalat: '#70dba0',
        },
        status: {
          success: '#70dba0',
          danger: '#f07070',
          warn: '#f5b560',
          info: '#9de0f5',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.07)',
          strong: 'rgba(255,255,255,0.12)',
        },
        ink: {
          DEFAULT: '#e8e8ea',
          muted: '#8a8a96',
          faint: '#4a4a56',
        }
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4)',
        glow: '0 0 20px rgba(197,241,53,0.15)',
      }
    },
  },
  plugins: [],
}
