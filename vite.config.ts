import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/forest-guardian-food-web/' : './',
  server: {
    host: '0.0.0.0',
  },
});
