// Pre-commit: format and lint only what is staged (handbook section 2).
const config = {
  "*.{js,mjs,cjs,ts,tsx,css}": ["prettier --write", "eslint --max-warnings=0"],
  "*.{json,yml,yaml}": ["prettier --write"],
};

export default config;
