/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#05070c',
          900: '#070b12',
          800: '#0b1220',
          700: '#111a2e',
        },
        frost: {
          50: 'rgba(255,255,255,0.92)',
          100: 'rgba(255,255,255,0.80)',
          200: 'rgba(255,255,255,0.65)',
          300: 'rgba(255,255,255,0.45)',
          400: 'rgba(255,255,255,0.25)',
        },
        accent: {
          steel: '#93c5fd',
          lilac: '#c4b5fd',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial'],
        pixel: ['"Press Start 2P"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glass: '0 14px 50px rgba(0,0,0,0.40)',
        glow: '0 0 0 1px rgba(255,255,255,0.06), 0 18px 60px rgba(0,0,0,0.50)',
      },
      backdropBlur: {
        glass: '20px',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.glass': {
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 14px 50px rgba(0,0,0,0.40)',
        },
        '.glass-strong': {
          backgroundColor: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(26px)',
          WebkitBackdropFilter: 'blur(26px)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 18px 60px rgba(0,0,0,0.55)',
        },
      })
    },
  ],
}

