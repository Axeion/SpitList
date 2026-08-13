import type { APIRoute } from 'astro';
import {
  buildAuthorizeUrl,
  cookiesAreSecure,
  OAUTH_COOKIE,
  pkceChallenge,
  randomToken,
  readOAuthConfig,
} from '../../../lib/auth';

export const prerender = false;

/**
 * Begins the Google flow. Stashes the CSRF state, the PKCE verifier and where
 * to land afterwards in one short-lived HttpOnly cookie, then hands off.
 */
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const config = readOAuthConfig();
  if (!config.ok) return redirect('/admin/login?error=unconfigured', 302);

  const state = randomToken();
  const verifier = randomToken();

  // Only ever return to our own /admin pages — an open redirect here would let
  // a crafted link bounce a signed-in moderator somewhere else.
  const requested = url.searchParams.get('next') ?? '/admin/submissions';
  const next = requested.startsWith('/admin') && !requested.startsWith('//')
    ? requested
    : '/admin/submissions';

  cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, next }), {
    httpOnly: true,
    secure: cookiesAreSecure(config.config.siteUrl),
    sameSite: 'lax',
    path: '/admin',
    maxAge: 600,
  });

  return redirect(buildAuthorizeUrl(config.config, state, pkceChallenge(verifier)), 302);
};
