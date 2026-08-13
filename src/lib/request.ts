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

/** Constant-time-ish comparison, to avoid leaking token length by timing. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
