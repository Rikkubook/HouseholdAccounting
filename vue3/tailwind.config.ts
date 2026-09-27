import type { Config } from "tailwindcss";

/** 所有色值與尺度都指向 tokens.css，Tailwind 只做映射，不自行定義新值。 */
export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: {
          DEFAULT: "var(--surface)",
          muted: "var(--surface-muted)",
          subtle: "var(--surface-subtle)",
        },
        track: "var(--track)",
        fg: {
          1: "var(--fg-1)",
          2: "var(--fg-2)",
          3: "var(--fg-3)",
          4: "var(--fg-4)",
          disabled: "var(--fg-disabled)",
          brand: "var(--fg-on-brand)",
        },
        dot: "var(--dot-idle)",
        brand: {
          500: "var(--brand-500)",
          600: "var(--brand-600)",
          tint: "var(--brand-tint)",
        },
        note: "var(--note)",
        action: {
          600: "var(--action-600)",
          tint: "var(--action-tint)",
        },
        state: {
          near: "var(--state-near-fg)",
          over: "var(--state-over-fg)",
        },
        danger: {
          DEFAULT: "var(--danger-fg)",
          tint: "var(--danger-tint)",
        },
        warning: {
          DEFAULT: "var(--warning-fg)",
          tint: "var(--warning-tint)",
        },
        success: {
          DEFAULT: "var(--success-fg)",
          tint: "var(--success-tint)",
        },
      },
      borderColor: {
        DEFAULT: "var(--border)",
        strong: "var(--border-strong)",
      },
      fontFamily: {
        sans: ["Noto Sans TC", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      fontSize: {
        hero: ["var(--fs-hero)", { letterSpacing: "var(--ls-hero)", lineHeight: "1.05" }],
        metric: ["var(--fs-metric)", { letterSpacing: "var(--ls-metric)", lineHeight: "1.1" }],
        "metric-sm": ["var(--fs-metric-sm)", { letterSpacing: "var(--ls-metric)", lineHeight: "1.15" }],
        title: ["var(--fs-page-title)", { lineHeight: "1.3" }],
        section: ["var(--fs-section)", { lineHeight: "1.4" }],
        body: ["var(--fs-body)", { lineHeight: "1.6" }],
        label: ["var(--fs-label)", { letterSpacing: "var(--ls-label)" }],
        mono: ["var(--fs-mono)", { lineHeight: "1.4" }],
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        card: "var(--r-card)",
        dialog: "var(--r-dialog)",
        pill: "var(--r-pill)",
      },
      spacing: {
        sidebar: "var(--sidebar-w)",
        hit: "var(--hit-min)",
      },
      maxWidth: {
        content: "var(--content-max)",
      },
      boxShadow: {
        none: "var(--shadow-none)",
        fab: "var(--shadow-fab)",
        dialog: "var(--shadow-dialog)",
        toast: "var(--shadow-toast)",
      },
      backgroundImage: {
        brand: "var(--gradient-brand)",
        action: "var(--gradient-action)",
        "budget-ok": "var(--gradient-budget-ok)",
        "budget-near": "var(--gradient-budget-near)",
        "budget-over": "var(--gradient-budget-over)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
      },
      screens: {
        // 全站唯一斷點
        md: "768px",
      },
    },
  },
  plugins: [],
} satisfies Config;
