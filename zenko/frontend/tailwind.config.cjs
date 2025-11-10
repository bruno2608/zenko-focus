module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        zenko: {
          background: '#0f172a',
          surface: '#1e293b',
          primary: '#38bdf8',
          accent: '#94a3b8'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'sans-serif']
      }
    }
  },
  plugins: []
};
