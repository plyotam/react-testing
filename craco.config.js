module.exports = {
  style: {
    postcssOptions: {
      plugins: [
        require('@tailwindcss/postcss'),
        require('autoprefixer'),
      ],
    },
  },
}; 