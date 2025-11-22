/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./App.tsx",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts}",
        "./store/**/*.{js,ts}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                mono: ['"JetBrains Mono"', 'monospace'],
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                terminal: {
                    bg: '#09090b',
                    card: '#18181b',
                    border: '#27272a',
                    accent: '#10b981', // Emerald 500
                    danger: '#ef4444', // Red 500
                    warn: '#f59e0b',   // Amber 500
                    text: '#e4e4e7',   // Zinc 200
                    muted: '#a1a1aa',  // Zinc 400
                }
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'glitch': 'glitch 1s linear infinite',
                'matrix-rain': 'matrix 20s linear infinite',
            },
            keyframes: {
                glitch: {
                    '2%, 64%': { transform: 'translate(2px,0) skew(0deg)' },
                    '4%, 60%': { transform: 'translate(-2px,0) skew(0deg)' },
                    '62%': { transform: 'translate(0,0) skew(5deg)' },
                },
                matrix: {
                    '0%': { backgroundPosition: '0% 0%' },
                    '100%': { backgroundPosition: '0% 100%' },
                }
            }
        },
    },
    plugins: [],
}
