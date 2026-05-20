import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        iron: {
          900: '#0a0a0b',
          800: '#131315',
          700: '#1c1c1f',
          600: '#2a2a2e',
          500: '#3f3f46',
          400: '#71717a',
        },
        fire: {
          500: '#c0392b',
          400: '#e74c3c',
          300: '#f39c12',
        },
        ice: {
          400: '#74b9ff',
          300: '#a29bfe',
        }
      },
      fontFamily: {
        serif: ['Cinzel', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
