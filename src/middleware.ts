import { defineMiddleware } from 'astro:middleware';
import { safeEqual } from './lib/request';

/**
 * HTTP Basic auth over /admin.
 *
 * A shared username and password, not accounts — accounts are explicitly out of
 * scope for v1 and there is one moderator. Basic auth is the honest fit: no
 * session store, no password reset flow, no half-built identity system to
 * migrate away from later. Replace it wholesale when real accounts arrive.
 *
 * /api/* is deliberately NOT covered here. It authenticates with its own bearer
 * token because its caller is n8n, not a browser.
 *
 * If ADMIN_USER or ADMIN_PASSWORD is unset the whole area returns 503. An
 * unconfigured secret must never mean "open".
 */
const challenge = () =>
  new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Spitplate moderation", charset="UTF-8"',
      'content-type': 'text/plain; charset=utf-8',
    },
  });

export const onRequest = defineMiddleware(async (context, next) => {
  if (!context.url.pathname.startsWith('/admin')) return next();

  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;

  if (!user || !password) {
    console.error('[admin] ADMIN_USER / ADMIN_PASSWORD unset; refusing access');
    return new Response('Moderation is not configured.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const header = context.request.headers.get('authorization') ?? '';
  if (!header.startsWith('Basic ')) return challenge();

  let decoded: string;
  try {
    // Buffer rather than atob: atob decodes as latin1 and mangles any
    // non-ASCII character in the password.
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return challenge();
  }

  const split = decoded.indexOf(':');
  if (split === -1) return challenge();

  // Evaluate both comparisons regardless, so a correct username can't be
  // distinguished from an incorrect one by response time.
  const userOk = safeEqual(decoded.slice(0, split), user);
  const passOk = safeEqual(decoded.slice(split + 1), password);
  if (!userOk || !passOk) return challenge();

  const response = await next();
  // Moderation queues must never be cached by a proxy or the browser.
  response.headers.set('cache-control', 'no-store, private');
  return response;
});
