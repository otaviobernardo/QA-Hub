/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta Selbetti — cores reais extraídas do logo oficial
        selbetti: {
          green: '#00754A',
          'green-dark': '#183930',
          orange: '#EF8943',
          purple: '#534AB7',
        },
      },
    },
  },
  plugins: [],
};
