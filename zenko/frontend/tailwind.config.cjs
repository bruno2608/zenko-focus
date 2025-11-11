module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        zenko: {
          background: '#120322',
          backgroundSoft: '#1a0a33',
          surface: '#1f1236',
          surfaceElevated: '#2b194d',
          primary: '#c084fc',
          secondary: '#a855f7',
          accent: '#f472b6',
          muted: '#a78bfa'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'sans-serif']
      }
    }
  },
  plugins: []
};
