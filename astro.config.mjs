import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://spitplate.com',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port: Number(process.env.PORT ?? 4321), host: true },

  // Railway terminates TLS at its edge and speaks plain HTTP to this container,
  // so the socket says `http` while the browser's Origin header says `https`.
  // Astro's CSRF check compares the two, decides every form POST is cross-site,
  // and answers "Cross-site POST form submissions are forbidden" — the submit
  // form, the admin queue, every POST on the site.
  //
  // This is the list of hosts whose X-Forwarded-* headers are trusted, which is
  // what lets Astro reconstruct the real https:// origin and compare like with
  // like. It is a trust list, not a relaxation: a genuine cross-site POST is
  // still rejected, because the check itself is untouched. Keep it to domains
  // this site is actually served on.
  //
  // Do not "fix" this by setting security.checkOrigin: false. That turns the
  // protection off for real attackers as well as for the proxy.
  security: {
    allowedDomains: [
      { protocol: 'https', hostname: 'spitplate.com' },
      { protocol: 'https', hostname: '*.spitplate.com' },
      // Railway's generated domain, live before the custom one is attached and
      // still routable afterwards.
      { protocol: 'https', hostname: '**.up.railway.app' },
    ],
  },

  devToolbar: { enabled: false },
});
