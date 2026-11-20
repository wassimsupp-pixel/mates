/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./public/index.html', './public/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        mates: {
          green: '#C0FB18',
          greenHover: '#a6dc0c',
          dark: '#0B0F19',
          card: '#131A29',
          cardElevated: '#1B2438',
          border: '#23304A',
        },
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
