// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class", // enable dark mode via .dark class
  theme: {
    extend: {
      colors: {
        primary: "hsl(210, 100%, 55%)",
        secondary: "hsl(260, 80%, 55%)",
        accent: "hsl(45, 100%, 55%)",
        background: "hsl(210, 20%, 98%)",
        surface: "hsl(0, 0%, 100%)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
