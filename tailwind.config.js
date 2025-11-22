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
            },
            typography: (theme) => ({
                DEFAULT: {
                    css: {
                        color: theme('colors.terminal.text'),
                        maxWidth: 'none',
                        h1: {
                            color: theme('colors.terminal.accent'),
                            fontFamily: theme('fontFamily.mono'),
                        },
                        h2: {
                            color: theme('colors.terminal.accent'),
                            fontFamily: theme('fontFamily.mono'),
                            marginTop: '1.5em',
                            marginBottom: '0.5em',
                        },
                        h3: {
                            color: theme('colors.terminal.text'),
                            fontFamily: theme('fontFamily.mono'),
                            marginTop: '1.5em',
                        },
                        strong: {
                            color: theme('colors.terminal.accent'),
                        },
                        a: {
                            color: theme('colors.terminal.accent'),
                            '&:hover': {
                                color: theme('colors.terminal.text'),
                            },
                        },
                        code: {
                            color: theme('colors.terminal.warn'),
                            backgroundColor: theme('colors.terminal.card'),
                            padding: '0.2em 0.4em',
                            borderRadius: '0.25rem',
                            fontWeight: '400',
                        },
                        'code::before': {
                            content: '""',
                        },
                        'code::after': {
                            content: '""',
                        },
                        ul: {
                            listStyleType: 'disc',
                            paddingLeft: '1.5em',
                        },
                        ol: {
                            listStyleType: 'decimal',
                            paddingLeft: '1.5em',
                        },
                    },
                },
            }),
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
