/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0B3C8A',
      },
      width: {
        '70': '17.5rem',
        '75': '18.75rem',
        '95': '23.5rem',
      },
      maxWidth: {
        '37.5': '9.375rem',
      },
      minHeight: {
        '87.5': '21.875rem',
      },
      aspectRatio: {
        '4/3': '4 / 3',
      },
      spacing: {
        '18': '4.5rem',
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar'),
  ],
}
