// postcss.config.mjs
//
// Tailwind v4 migration — v3-এর postcss.config.js (tailwindcss +
// autoprefixer আলাদা plugin) থেকে v4-এর single @tailwindcss/postcss
// plugin-এ (autoprefixer built-in, আলাদা করে লাগে না)। PM app-এর
// postcss.config.mjs-এর সাথে হুবহু মিলিয়ে — ecosystem-এর তিনটা app
// একই PostCSS setup ব্যবহার করবে।

const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
