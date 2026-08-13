import { defineMiddleware } from 'astro:middleware';
import { readOAuthConfig, readSession, SESSION_COOKIE } from './lib/auth';

/**
 * Gate over /admin.
 *
 * Google sign-in with an explicit email allowlist. The allowlist is re-checked
 * on every request rather than only at login, so removing someone ends the
 * session they already hold.
 *
 * /api/* is deliberately NOT covered here — it authenticates with its own
 * bearer token because its caller is n8n, not a browser. That also makes it the
 * break-glass path if sign-in is ever misconfigured: submissions can still be
 * approved without a browser session.
 */

/** Reachable without a session, or nobody could ever sign in. */
const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/auth/start', '/admin/auth/callback'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (!pathname.startsWith('/admin')) return next();

  const noStore = (response: Response) => {
    response.headers.set('cache-control', 'no-store, private');
    return response;
  };

  const config = readOAuthConfig();

  if (PUBLIC_ADMIN_PATHS.some((path) => pathname === path)) {
    return noStore(await next());
  }

  if (!config.ok) {
    // Unconfigured is closed, not open. The login page explains what's missing.
    return context.redirect('/admin/login?error=unconfigured', 302);
  }

  const session = await readSession(context.cookies.get(SESSION_COOKIE)?.value, config.config);

  if (!session) {
    const next = pathname + context.url.search;
    return context.redirect(`/admin/login?next=${encodeURIComponent(next)}`, 302);
  }

  context.locals.admin = session;
  return noStore(await next());
});
