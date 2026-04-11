import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2f855a",
          light:   "#7ddf92",
          glow:    "rgba(47, 133, 90, 0.18)",
        },
        secondary: "#68c18a",
        accent:    "#1b241d",
        background: {
          app:       "#f5f7f3",
          deep:      "#edf2eb",
          slate:     "#e4eadf",
          card:      "rgba(255, 255, 255, 0.82)",
          cardHover: "rgba(255, 255, 255, 0.96)",
        },
        foreground: {
          main:  "#1b241d",
          muted: "#486151",
          dim:   "#6f8576",
        },
        border: {
          glass:  "rgba(47, 133, 90, 0.12)",
          active: "rgba(47, 133, 90, 0.25)",
        },
      },
      fontFamily: {
        inter:  ["var(--font-inter)", "sans-serif"],
        outfit: ["var(--font-outfit)", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "24px",
      },
      boxShadow: {
        premium: "0 20px 40px rgba(47, 86, 61, 0.10), 0 8px 16px rgba(47, 86, 61, 0.06)",
        glow:    "0 0 24px rgba(47, 133, 90, 0.10)",
      },
    },
  },
  plugins: [],
} satisfies Config;
