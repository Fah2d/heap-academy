// Tailwind CSS runs as a PostCSS plugin in the Next.js build (ADR-0014).
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
