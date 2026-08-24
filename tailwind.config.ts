import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        dark: {
          bg: '#090a0f',
          card: '#12151c',
          cardHover: '#181d26',
          border: '#232936',
          muted: '#64748b',
        },
        card: {
          pink: '#f9a8d4',       // Soft vibrant pink
          pinkDark: '#f472b6',
          lime: '#bef264',       // Electric lime
          limeDark: '#a3e635',
          amber: '#fbbf24',      // Warm golden yellow
          amberDark: '#f59e0b',
          blue: '#93c5fd',       // Fresh sky blue
          blueDark: '#60a5fa',
          purple: '#c084fc',     // Soft lavender purple
          white: '#ffffff',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        '3xl': '24px',
        '4xl': '32px',
      }
    },
  },
  plugins: [],
};
export default config;
