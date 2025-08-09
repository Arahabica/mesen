export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {
      // Only add prefixes for modern browsers
      overrideBrowserslist: [
        'last 2 Chrome versions',
        'last 2 Firefox versions',
        'last 2 Safari versions',
        'last 2 Edge versions',
        'not dead',
        'not IE 11',
        'not op_mini all'
      ]
    },
  },
}