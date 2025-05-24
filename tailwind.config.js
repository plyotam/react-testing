/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'background-primary': 'var(--background-primary)',
        'background-secondary': 'var(--background-secondary)',
        'background-tertiary': 'var(--background-tertiary)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'accent-primary': 'var(--accent-primary)',
        'accent-secondary': 'var(--accent-secondary)',
        'border-color': 'var(--border-color)',
        'error-color': 'var(--error-color)',
        'info-color': 'var(--info-color)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        accent: ['Night Machine', 'Inter', 'sans-serif']
      },
      backgroundImage: {
        'gradient-accent': 'var(--gradient-accent)',
        'gradient-background': 'var(--gradient-background)',
      }
    },
  },
  plugins: [],
}; 