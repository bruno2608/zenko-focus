module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        zenko: {
          background: '#020617',
          backgroundSoft: '#0b1220',
          surface: '#0f172a',
          surfaceElevated: '#15223a',
          primary: '#38bdf8',
          secondary: '#6366f1',
          accent: '#22d3ee',
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
