import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-base":    "#0a0818",
        "bg-surface": "#110e28",
        "bg-card":    "#1a1635",
        "purple-1":   "#7c3aed",
        "purple-2":   "#9333ea",
        "purple-3":   "#a855f7",
        "purple-4":   "#c084fc",
        "pink-hot":   "#e040fb",
        "cyan-1":     "#06b6d4",
        "cyan-2":     "#22d3ee",
        "gold-1":     "#f59e0b",
        "gold-2":     "#fbbf24",
      },
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        body:    ["'DM Sans'", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        "2xl": "20px",
        "3xl": "28px",
      },
      backgroundImage: {
        "grad-purple": "linear-gradient(135deg, #7c3aed, #ec4899)",
        "grad-cyan":   "linear-gradient(135deg, #06b6d4, #14b8a6)",
        "grad-gold":   "linear-gradient(135deg, #f59e0b, #fbbf24)",
        "grad-card":   "linear-gradient(145deg, #1e1940, #15122e)",
      },
    },
  },
  plugins: [],
};
export default config;
