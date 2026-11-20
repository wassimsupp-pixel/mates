/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./public/index.html', './public/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // Graphite ramp. Volt (#C0FB18, from the logo) is the only accent.
        mates: {
          green: '#C0FB18',
          greenHover: '#cefc4f',
          deep: '#0f0f10',
          dark: '#141415',
          card: '#19191b',
          cardElevated: '#232325',
          hover: '#2a2a2d',
          border: '#29292c',
        },
        fg: { DEFAULT: '#ededed', 2: '#a1a1a6', 3: '#85858b' },
        ok: '#4cc38a',
        bad: '#e5484d',
        warn: '#e2a336',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      transitionDuration: { DEFAULT: '150ms' },
    },
  },
  plugins: [],
};
