import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        soil: { 950: "#0d0b08", 900: "#14110c", 850: "#1a1610", 800: "#221d15", 700: "#2f281d", 600: "#3f3627" },
        wheat: { 300: "#f3dc9b", 400: "#e8c66a", 500: "#d9a93c" },
        leaf: { 300: "#a8e07a", 400: "#7cc443", 500: "#4f9a2c" },
        rust: { 400: "#e0784a", 500: "#c4532a" },
        sky: { 400: "#7cc6e8" },
        bone: "#efe8d8",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["'Space Grotesk'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
