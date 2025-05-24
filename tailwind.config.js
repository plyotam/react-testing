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
        'text-tertiary': 'var(--text-tertiary)',
        'accent-primary': 'var(--accent-primary)',
        'accent-secondary': 'var(--accent-secondary)',
        'accent-info': 'var(--accent-info)',
        'accent-success': 'var(--accent-success)',
        'accent-warning': 'var(--accent-warning)',
        'accent-danger': 'var(--accent-danger)',
        'accent-confirm': 'var(--accent-confirm)',
        'border-color-primary': 'var(--border-color-primary)',
        'border-color-secondary': 'var(--border-color-secondary)',
        'input-background': 'var(--input-background)',
        'background-hover-muted': 'var(--background-hover-muted)',
        'error-color': 'var(--error-color)',
        'info-color': 'var(--info-color)',
        'warning-color': 'var(--warning-color)',
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