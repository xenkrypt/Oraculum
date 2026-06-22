import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17211f",
        moss: "#4d6f61",
        signal: "#d44f2e",
        paper: "#f8f5ef",
        mist: "#dce8e3"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 33, 31, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
