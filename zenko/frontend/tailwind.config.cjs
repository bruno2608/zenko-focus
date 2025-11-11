module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        zenko: {
          background: '#070b14',
          backgroundSoft: '#0d141f',
          surface: '#111b2a',
          surfaceElevated: '#18253a',
          primary: '#38bdf8',
          secondary: '#22d3ee',
          accent: '#34d399',
          muted: '#94a3b8'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'sans-serif']
      }
    }
  },
  plugins: []
};
