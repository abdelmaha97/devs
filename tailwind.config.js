const { heroui } = require("@heroui/react");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'IBM Plex Sans Arabic'", 'var(--font-sans)', 'sans-serif'],
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        dark: {
          colors: {
            background: "#141414ff",
            primary: {
              DEFAULT: "#8599a1ff", // Blue for trust and professionalism
              foreground: "#ffffff",
            },
            secondary: {
              DEFAULT: "#d6c9c4", // Green for growth and stability
              foreground: "#ffffff",
            },
            accent: {
              DEFAULT: "#fbbf24", // Gold for luxury and value
              foreground: "#3f3f3fff",
            },
            focus: "#22d3ee", // Cyan for highlights
            content1: "#2c2c2cff",
            content2: "#202020ff",
          },
        },
        light: {
          colors: {
            background: "#e0e7ef",
            primary: {
              DEFAULT: "#185691ff", // Blue for trust and professionalism
              foreground: "#ffffff",
            },
            secondary: {
              DEFAULT: "#d6c9c4", // Green for growth and stability
              foreground: "#ffffff",
            },
            accent: {
              DEFAULT: "#fbbf24", // Gold for luxury and value
              foreground: "#1e293b",
            },
            focus: "#06b6d4", // Cyan for highlights
            content1: "#f8fafc",
            content2: "rgba(245, 243, 243, 1)"
          },
        },
      },
    }),
  ],
};