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
        primary: {
          DEFAULT: '#1a3a5c',
          light: '#2d5f8a',
        },
        accent: {
          DEFAULT: '#e85d04',
          light: '#f48c06',
        },
        success: '#2d6a4f',
        danger: '#c1121f',
        warning: '#f77f00',
      },
    },
  },
  plugins: [],
};
