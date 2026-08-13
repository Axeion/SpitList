/**
 * Client address resolution.
 *
 * X-Forwarded-For is only as trustworthy as the proxy in front of us. On
 * Railway the edge sets it, so the first entry is the real client. If this app
 * is ever exposed directly, the header becomes attacker-controlled and the rate
 * limit built on it becomes decorative — hence the narrow, documented use.
 */
export function clientIp(request: Request, fallback?: string): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return fallback ?? null;
}

import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time secret comparison.
 *
 * Both sides are hashed first so the buffers are always 32 bytes: comparing the
 * raw strings would bail out early on a length mismatch and leak the secret's
 * length through timing.
 */
export function safeEqual(a: string, b: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(a), digest(b));
}
