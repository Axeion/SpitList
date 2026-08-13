import type { APIRoute } from 'astro';
import {
  cookiesAreSecure,
  createSession,
  exchangeCode,
  isAllowed,
  OAUTH_COOKIE,
  readOAuthConfig,
  safeCompare,
  SESSION_COOKIE,
} from '../../../lib/auth';
import { clientIp } from '../../../lib/request';

export const prerender = false;

const fail = (redirect: (path: string, status: 302) => Response, reason: string) =>
  redirect(`/admin/login?error=${encodeURIComponent(reason)}`, 302);

export const GET: APIRoute = async ({ url, cookies, redirect, request, clientAddress }) => {
  const config = readOAuthConfig();
  if (!config.ok) return redirect('/admin/login?error=unconfigured', 302);

  const secure = cookiesAreSecure(config.config.siteUrl);
  const stash = cookies.get(OAUTH_COOKIE)?.value;
  cookies.delete(OAUTH_COOKIE, { path: '/admin' });

  // Google reports its own failures here — a denied consent screen, mostly.
  if (url.searchParams.get('error')) return fail(redirect, 'denied');
  if (!stash) return fail(redirect, 'expired');

  let parsed: { state?: string; verifier?: string; next?: string };
  try {
    parsed = JSON.parse(stash);
  } catch {
    return fail(redirect, 'expired');
  }

  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code') ?? '';
  if (!parsed.state || !parsed.verifier || !state || !code) return fail(redirect, 'expired');
  if (!safeCompare(parsed.state, state)) return fail(redirect, 'state');

  const result = await exchangeCode(config.config, code, parsed.verifier);
  if (!result.ok) return fail(redirect, result.reason);

  const { identity } = result;
  if (!identity.emailVerified) return fail(redirect, 'unverified');
  if (!isAllowed(config.config, identity.email)) {
    console.warn(`[auth] rejected sign-in for ${identity.email} (not on allowlist)`);
    return fail(redirect, 'not-allowed');
  }

  const { token, expiresAt } = await createSession(identity, {
    userAgent: request.headers.get('user-agent'),
    ip: clientIp(request, clientAddress),
  });

  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return redirect(parsed.next ?? '/admin/submissions', 302);
};
