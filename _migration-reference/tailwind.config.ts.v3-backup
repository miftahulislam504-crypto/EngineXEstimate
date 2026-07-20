import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // CivilOS Design System — Light Clean
        // Hub-এর tailwind.config.ts থেকে হুবহু — দুই app পাশাপাশি
        // ব্যবহার হলে যেন ভিজ্যুয়াল মিল থাকে। এই টোকেন বদলাতে হলে
        // Hub-এও একসাথে বদলানো উচিত, নাহলে ecosystem-এ ভিজ্যুয়াল
        // ড্রিফট শুরু হবে।
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        surface: {
          DEFAULT: '#f8fafc',
          card: '#ffffff',
          hover: '#f1f5f9',
          border: '#e2e8f0',
        },
        text: {
          primary: '#0f172a',
          secondary: '#475569',
          muted: '#94a3b8',
        },
        status: {
          activeText: '#15803d',
          activeBg: '#dcfce7',
          activeBorder: '#86efac',
          holdText: '#b45309',
          holdBg: '#fef3c7',
          holdBorder: '#fcd34d',
          doneText: '#1d4ed8',
          doneBg: '#dbeafe',
          doneBorder: '#93c5fd',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.07)',
      },
    },
  },
  plugins: [],
}

export default config
