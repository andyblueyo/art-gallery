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
        cream: "#f5f0e8",
        brown: {
          DEFAULT: "#2a2018",
          light: "#4a3d32",
          muted: "#6b5d4f",
        },
        gold: {
          DEFAULT: "#8B6914",
          light: "#a67c1a",
          dark: "#6b5010",
          frame: "#9a7b2e",
        },
        badge: {
          green: "#2d6a4f",
          "green-light": "#40916c",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Times New Roman", "serif"],
      },
      boxShadow: {
        frame: "inset 0 0 0 3px #6b5010, inset 0 0 0 5px #c4a035, 0 4px 12px rgba(42, 32, 24, 0.15)",
        "frame-oval":
          "inset 0 0 0 3px #6b5010, inset 0 0 0 5px #c4a035, 0 6px 16px rgba(42, 32, 24, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
