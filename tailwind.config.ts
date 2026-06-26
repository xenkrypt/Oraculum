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
        obsidian: "var(--obsidian)",
        charcoal: "var(--charcoal)",
        surface: "var(--surface)",
        panel: "var(--panel)",
        amber: {
          DEFAULT: "var(--amber)",
          dim: "var(--amber-dim)",
          glow: "var(--amber-glow)",
        },
        jade: {
          DEFAULT: "var(--jade)",
          dim: "var(--jade-dim)",
          glow: "var(--jade-glow)",
        },
        crimson: "var(--crimson)",
        parchment: {
          DEFAULT: "var(--parchment)",
          dim: "var(--parchment-dim)",
          faint: "var(--parchment-faint)",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};
export default config;
