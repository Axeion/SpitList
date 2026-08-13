import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { db } from './db';

/**
 * Google sign-in for the moderation area.
 *
 * Authorization Code flow with PKCE. The ID token is read from the token
 * endpoint response — received directly from Google over TLS using our client
 * secret, so per OpenID Connect it does not need signature verification — but
 * its issuer, audience, expiry and email_verified claim are all checked anyway,
 * because those are what actually decide who gets in.
 *
 * Access is an explicit allowlist. An empty allowlist admits nobody: an
 * unconfigured secret must never mean "open".
 */

const GOOGLE_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const VALID_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

export const SESSION_COOKIE = 'sp_session';
export const OAUTH_COOKIE = 'sp_oauth';
const SESSION_DAYS = 14;

export interface AdminSession {
  email: string;
  displayName: string | null;
  expiresAt: Date;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  siteUrl: string;
  allowed: string[];
}

/**
 * Reads configuration, or explains what is missing. Returning the reason rather
 * than throwing lets /admin/login render a useful page instead of a 500.
 */
export function readOAuthConfig(): { ok: true; config: OAuthConfig } | { ok: false; missing: string[] } {
  const missing: string[] = [];
  const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
  const siteUrl = (process.env.PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  const allowed = (process.env.ADMIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (!clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!siteUrl) missing.push('PUBLIC_SITE_URL');
  if (allowed.length === 0) missing.push('ADMIN_ALLOWED_EMAILS');

  if (missing.length) return { ok: false, missing };
  return { ok: true, config: { clientId, clientSecret, siteUrl, allowed } };
}

export const redirectUri = (siteUrl: string) => `${siteUrl}/admin/auth/callback`;

/** Cookies are only marked Secure when the public origin is actually https. */
export const cookiesAreSecure = (siteUrl: string) => siteUrl.startsWith('https://');

const base64url = (buffer: Buffer) => buffer.toString('base64url');
const sha256 = (value: string) => createHash('sha256').update(value).digest();

export const randomToken = () => base64url(randomBytes(32));

export function pkceChallenge(verifier: string): string {
  return base64url(sha256(verifier));
}

export function safeCompare(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

export function buildAuthorizeUrl(
  config: OAuthConfig,
  state: string,
  challenge: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri(config.siteUrl),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    // Always show the chooser: a shared machine should not silently sign in as
    // whoever used it last.
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTHORIZE}?${params}`;
}

interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/** Exchanges the code and returns the verified identity, or an error reason. */
export async function exchangeCode(
  config: OAuthConfig,
  code: string,
  verifier: string
): Promise<{ ok: true; identity: GoogleIdentity } | { ok: false; reason: string }> {
  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri(config.siteUrl),
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error('[auth] token exchange failed:', err);
    return { ok: false, reason: 'Could not reach Google to complete sign-in.' };
  }

  if (!response.ok) {
    console.error(`[auth] token endpoint returned ${response.status}`);
    return { ok: false, reason: 'Google rejected the sign-in attempt.' };
  }

  const body = (await response.json()) as { id_token?: string };
  if (!body.id_token) return { ok: false, reason: 'Google returned no identity token.' };

  const payload = decodeJwtPayload(body.id_token);
  if (!payload) return { ok: false, reason: 'Google returned an unreadable identity token.' };

  if (!VALID_ISSUERS.has(String(payload.iss))) {
    return { ok: false, reason: 'Identity token came from an unexpected issuer.' };
  }
  if (payload.aud !== config.clientId) {
    return { ok: false, reason: 'Identity token was issued for a different application.' };
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
    return { ok: false, reason: 'Identity token has already expired.' };
  }

  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (!email) return { ok: false, reason: 'Google did not return an email address.' };

  return {
    ok: true,
    identity: {
      email,
      // Google sends this as a boolean or the string "true" depending on flow.
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      name: typeof payload.name === 'string' ? payload.name : null,
    },
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export const isAllowed = (config: OAuthConfig, email: string) =>
  config.allowed.includes(email.toLowerCase());

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession(
  identity: GoogleIdentity,
  meta: { userAgent: string | null; ip: string | null }
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);

  await db()`
    insert into admin_sessions (token_hash, email, display_name, expires_at, user_agent, ip)
    values (
      ${base64url(sha256(token))}, ${identity.email}, ${identity.name},
      ${expiresAt}, ${meta.userAgent}, ${meta.ip}
    )
  `;

  // Opportunistic tidy-up; there is no scheduler and this table stays tiny.
  await db()`delete from admin_sessions where expires_at < now()`;

  return { token, expiresAt };
}

/**
 * Looks up a session and re-checks the allowlist on every request, so removing
 * an address takes effect immediately rather than at expiry.
 */
export async function readSession(
  token: string | undefined,
  config: OAuthConfig
): Promise<AdminSession | null> {
  if (!token) return null;

  const [row] = await db()`
    select email, display_name, expires_at
    from admin_sessions
    where token_hash = ${base64url(sha256(token))}
      and expires_at > now()
  `;
  if (!row) return null;

  if (!isAllowed(config, row.email)) {
    await destroySession(token);
    return null;
  }

  await db()`
    update admin_sessions set last_seen_at = now()
    where token_hash = ${base64url(sha256(token))}
  `;

  return { email: row.email, displayName: row.display_name ?? null, expiresAt: row.expires_at };
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db()`delete from admin_sessions where token_hash = ${base64url(sha256(token))}`;
}
