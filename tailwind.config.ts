import forms from "@tailwindcss/forms";
import type { Config } from "tailwindcss";

/* Tokens from the ContractForge design (ui-ux/). Colours are CSS variables (see src/styles.css)
   so the light palette from the design and a matching dark palette share one set of class names. */
const color = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const names = [
  "background", "surface", "surface-container-lowest", "surface-container-low", "surface-container",
  "surface-container-high", "surface-container-highest", "on-surface", "on-surface-variant", "outline",
  "outline-variant", "primary", "on-primary", "primary-container", "primary-fixed", "secondary",
  "error", "error-container", "on-error-container", "inverse-surface",
  "pos", "pos-bg", "pos-line", "neg", "neg-bg", "neg-line", "bnd", "bnd-bg", "bnd-line", "sec", "sec-bg", "sec-line",
  "get", "post", "put", "patch", "delete",
];

export default {
  content: ["./index.html", "./docs.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: Object.fromEntries(names.map((n) => [n, color(n)])),
      borderRadius: { DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" },
      spacing: {
        "space-xs": "0.25rem", "space-sm": "0.5rem", "space-md": "0.875rem", "space-lg": "1.25rem", "space-xl": "2rem",
        "margin-mobile": "1rem", "gutter-mobile": "0.75rem", gutter: "1.5rem", margin: "2rem",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        headline: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "body-sm": ["0.75rem", { lineHeight: "1.125rem" }],
        "body-md": ["0.875rem", { lineHeight: "1.375rem" }],
        "body-lg": ["1rem", { lineHeight: "1.625rem" }],
        "code-sm": ["0.6875rem", { lineHeight: "1rem", fontWeight: "500" }],
        "code-md": ["0.8125rem", { lineHeight: "1.375rem", fontWeight: "500" }],
        "label-sm": ["0.6875rem", { lineHeight: "0.875rem", fontWeight: "600" }],
        "label-md": ["0.8125rem", { lineHeight: "1.125rem", fontWeight: "600" }],
        "headline-md": ["1.125rem", { lineHeight: "1.625rem", fontWeight: "600" }],
        "headline-lg": ["1.5rem", { lineHeight: "2rem", fontWeight: "600" }],
        "headline-xl-mobile": ["1.5rem", { lineHeight: "2rem", fontWeight: "700" }],
        "headline-xl": ["2rem", { lineHeight: "2.5rem", fontWeight: "700" }],
      },
      boxShadow: { xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)" },
      backdropBlur: { xs: "2px" },
    },
  },
  plugins: [forms({ strategy: "class" })],
} satisfies Config;
