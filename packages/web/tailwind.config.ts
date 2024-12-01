import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    // dynamically calculated colors need to appear here
    "border-purple-500/20",
    "border-green-500/20",
    "border-pink-500/20",
    "border-blue-500/20",
    "bg-purple-500",
    "bg-green-500",
    "bg-pink-500",
    "bg-blue-500",
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
        "3xl": "2rem",
        "4xl": "3rem",
        "5xl": "4rem",
        "6xl": "5em",
      },
    },
  },
  plugins: [],
} satisfies Config;
