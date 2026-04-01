import type { Config } from "tailwindcss";
import daisyui from "daisyui";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  safelist: [
    // Team borders
    "border-purple-400/40",
    "border-emerald-400/40",
    "border-pink-400/40",
    "border-blue-400/40",
    "border-amber-400/40",
    "border-cyan-400/40",
    "border-rose-400/40",
    "border-teal-400/40",
    // Team card gradients (from)
    "from-purple-500",
    "from-emerald-500",
    "from-pink-500",
    "from-blue-500",
    "from-amber-500",
    "from-cyan-500",
    "from-rose-500",
    "from-teal-500",
    // Team card gradients (to)
    "to-purple-300",
    "to-emerald-300",
    "to-pink-300",
    "to-blue-300",
    "to-amber-300",
    "to-cyan-300",
    "to-rose-300",
    "to-teal-300",
    // Team badge gradients (from)
    "from-purple-800",
    "from-emerald-800",
    "from-pink-800",
    "from-blue-800",
    "from-amber-800",
    "from-cyan-800",
    "from-rose-800",
    "from-teal-800",
    // Team badge gradients (to)
    "to-purple-600",
    "to-emerald-600",
    "to-pink-600",
    "to-blue-600",
    "to-amber-600",
    "to-cyan-600",
    "to-rose-600",
    "to-teal-600",
    // Misc
    "drop-shadow-md",
  ],
  theme: {
    extend: {
      colors: {
        base: "#0f0f1a",
        surface: "#1a1530",
        elevated: "#2a1f48",
        primary: "#8060c0",
        accent: "#a070e0",
      },
      fontSize: {
        sm: "0.8rem",
        base: "1rem",
        xl: "1.25rem",
        "2xl": "2rem",
        "3xl": "2.5rem",
        "4xl": "3rem",
        "5xl": "4rem",
        "6xl": "5em",
      },
    },
  },
  daisyui: {
    themes: [
      {
        codenames: {
          primary: "#8060c0",
          secondary: "#a070e0",
          accent: "#ffd060",
          neutral: "#1a1530",
          "base-100": "#0f0f1a",
          "base-200": "#1a1530",
          "base-300": "#2a1f48",
          info: "#4080d0",
          success: "#40b080",
          warning: "#ffd060",
          error: "#d04050",
        },
      },
    ],
  },
  plugins: [daisyui],
} satisfies Config;
