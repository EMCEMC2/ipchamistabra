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
                mono: ['"Space Mono"', 'monospace'],
                sans: ['"Sora"', 'sans-serif'],
                display: ['"Rajdhani"', 'sans-serif'],
            },
            colors: {
                terminal: {
                    bg: 'var(--bg-primary)',
                    card: 'var(--bg-secondary)',
                    border: 'var(--border-subtle)',
                    accent: 'var(--accent-info)',
                    danger: 'var(--accent-bearish)',
                    success: 'var(--accent-bullish)',
                    warn: 'var(--accent-warning)',
                    text: 'var(--text-primary)',
                    muted: 'var(--text-secondary)',
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
