/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#241c16',
        paper: '#f3efe4',
        rule: '#d9d0c0',
        seal: '#9e2b2b',
        moss: '#1f4d40',
        brass: '#8a6a32',
      },
      fontFamily: {
        display: ['"Iowan Old Style"', 'Palatino', '"Apple Myungjo"', 'Batang', 'serif'],
        sans: ['"Avenir Next"', '"Apple SD Gothic Neo"', '"Malgun Gothic"', 'sans-serif'],
      },
      boxShadow: {
        sheet: '0 18px 50px rgba(36, 28, 22, 0.12)',
      },
    },
  },
  plugins: [],
}
