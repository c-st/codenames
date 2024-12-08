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
    // programmatically assigned classes:
    "border-purple-500/40",
    "border-green-500/40",
    "border-pink-500/40",
    "border-blue-500/40",
    "bg-purple-500",
    "bg-green-500",
    "bg-pink-500",
    "bg-blue-500",
    "drop-shadow-md",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
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
    themes: ["night"],
  },
  plugins: [daisyui],
} satisfies Config;
