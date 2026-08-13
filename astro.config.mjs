import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://spitplate.com',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port: Number(process.env.PORT ?? 4321), host: true },
  devToolbar: { enabled: false },
});
