import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      keyframes: {
        // === FADE ANIMATIONS ===
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'fade-slide-in': {
          from: { opacity: '0', transform: 'translateY(20px)', filter: 'blur(4px)' },
          to: { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
        'fade-slide-in-right': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },

        // === SCALE ANIMATIONS ===
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.9)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'scale-out': {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.9)' },
        },

        // === SLIDE ANIMATIONS ===
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'slide-down': { from: { transform: 'translateY(-100%)' }, to: { transform: 'translateY(0)' } },
        'slide-left': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-right': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },

        // === CLIP-PATH REVEALS ===
        'clip-reveal-right': {
          from: { clipPath: 'inset(0 100% 0 0)' },
          to: { clipPath: 'inset(0 0 0 0)' },
        },
        'clip-reveal-left': {
          from: { clipPath: 'inset(0 0 0 100%)' },
          to: { clipPath: 'inset(0 0 0 0)' },
        },
        'clip-reveal-up': {
          from: { clipPath: 'inset(100% 0 0 0)' },
          to: { clipPath: 'inset(0 0 0 0)' },
        },
        'clip-reveal-down': {
          from: { clipPath: 'inset(0 0 100% 0)' },
          to: { clipPath: 'inset(0 0 0 0)' },
        },

        // === CONTINUOUS ANIMATIONS ===
        'marquee': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'marquee-reverse': {
          from: { transform: 'translateX(-50%)' },
          to: { transform: 'translateX(0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },

        // === BACKGROUND ANIMATIONS ===
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'kenburns': {
          from: { transform: 'scale(1)' },
          to: { transform: 'scale(1.1)' },
        },

        // === SPECIAL EFFECTS ===
        'ripple': {
          from: { width: '0', height: '0', opacity: '0.5' },
          to: { width: '200px', height: '200px', opacity: '0' },
        },
        'beam-rotate': {
          to: { transform: 'rotate(360deg)' },
        },
        'shimmer': {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },

        // Radix Accordion
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        // === FADE ===
        'fade-in': 'fade-in 0.5s ease-out both',
        'fade-out': 'fade-out 0.3s ease-out both',
        'fade-slide-in': 'fade-slide-in 0.6s ease-out both',
        'fade-slide-in-right': 'fade-slide-in-right 0.5s ease-out both',
        'fade-slide-in-left': 'fade-slide-in-left 0.5s ease-out both',

        // === SCALE ===
        'scale-in': 'scale-in 0.3s ease-out both',
        'scale-out': 'scale-out 0.2s ease-in both',

        // === SLIDE ===
        'slide-up': 'slide-up 0.5s ease-out both',
        'slide-down': 'slide-down 0.5s ease-out both',
        'slide-left': 'slide-left 0.5s ease-out both',
        'slide-right': 'slide-right 0.5s ease-out both',

        // === CLIP REVEAL ===
        'clip-reveal-right': 'clip-reveal-right 0.8s ease-out both',
        'clip-reveal-left': 'clip-reveal-left 0.8s ease-out both',
        'clip-reveal-up': 'clip-reveal-up 0.8s ease-out both',
        'clip-reveal-down': 'clip-reveal-down 0.8s ease-out both',

        // === CONTINUOUS ===
        'marquee': 'marquee 30s linear infinite',
        'marquee-fast': 'marquee 15s linear infinite',
        'marquee-slow': 'marquee 45s linear infinite',
        'marquee-reverse': 'marquee-reverse 30s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'spin-slow': 'spin-slow 8s linear infinite',
        'blink': 'blink 1s step-end infinite',

        // === BACKGROUND ===
        'gradient-shift': 'gradient-shift 15s ease infinite',
        'kenburns': 'kenburns 20s ease-out forwards',

        // === SPECIAL ===
        'ripple': 'ripple 0.6s ease-out forwards',
        'beam-rotate': 'beam-rotate 2s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',

        // Radix
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
