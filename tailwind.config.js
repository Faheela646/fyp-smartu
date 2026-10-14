import animate from "tailwindcss-animate";
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      colors: {
        background: c("background"),
        surface: c("surface"),
        foreground: c("foreground"),
        muted: { DEFAULT: c("muted"), foreground: c("muted-foreground") },
        border: c("border"),
        ring: c("ring"),
        primary: { DEFAULT: c("primary"), foreground: c("primary-foreground"), soft: c("primary-soft") },
        accent: { DEFAULT: c("accent"), foreground: c("accent-foreground"), soft: c("accent-soft") },
        success: { DEFAULT: c("success"), soft: c("success-soft") },
        warning: { DEFAULT: c("warning"), soft: c("warning-soft") },
        danger: { DEFAULT: c("danger"), soft: c("danger-soft"), foreground: c("danger-foreground") },
        sidebar: { DEFAULT: c("sidebar"), foreground: c("sidebar-foreground"), muted: c("sidebar-muted"), border: c("sidebar-border") },
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"] },
      // Generous scale for great legibility on desktops and tablets:
      fontSize: {
        xs: ["0.875rem", "1.25rem"],
        sm: ["0.95rem", "1.45rem"],
        base: ["1.0625rem", "1.65rem"],
        lg: ["1.25rem", "1.85rem"],
        xl: ["1.45rem", "2rem"],
        "2xl": ["1.875rem", "2.3rem"],
        "3xl": ["2.25rem", "2.6rem"],
        "4xl": ["2.875rem", "3.2rem"],
      },
      borderRadius: { sm: "8px", md: "12px", lg: "18px", xl: "24px" },
      boxShadow: { soft: "var(--shadow-soft)", raised: "var(--shadow-raised)" },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        pulseRing: { "0%": { transform: "scale(.8)", opacity: ".8" }, "100%": { transform: "scale(2.4)", opacity: "0" } },
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
      animation: { shimmer: "shimmer 1.6s infinite", pulseRing: "pulseRing 1.8s ease-out infinite", floaty: "floaty 5s ease-in-out infinite" },
    },
  },
  plugins: [animate],
};
