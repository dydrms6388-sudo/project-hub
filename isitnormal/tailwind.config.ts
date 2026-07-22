import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1a1a2e",
        brand: { DEFAULT: "#5b6cff", dark: "#3f4ee0" },
        soft: "#f5f6fb",
      },
      maxWidth: { readable: "640px" },
    },
  },
  plugins: [],
} satisfies Config;
