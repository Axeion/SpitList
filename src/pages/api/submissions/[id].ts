import type { APIRoute } from 'astro';
import { approveSubmission, rejectSubmission } from '../../../lib/submissions';
import { safeEqual } from '../../../lib/request';

export const prerender = false;

/**
 * Moderation callback. n8n posts the Discord approval card's result here.
 *
 * Guarded by a shared bearer token rather than a login, because there are no
 * accounts yet (out of scope for v1) and the only caller is a machine. If
 * ADMIN_API_TOKEN is unset the route refuses everything — an unset secret must
 * never mean "open".
 *
 *   POST /api/submissions/:id
 *   Authorization: Bearer $ADMIN_API_TOKEN
 *   { "action": "approve" | "reject", "note": "...", "reviewer": "..." }
 */
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export const POST: APIRoute = async ({ params, request }) => {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    console.error('[api] ADMIN_API_TOKEN is not set; refusing moderation request');
    return json({ error: 'Moderation API is not configured.' }, 503);
  }

  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!safeEqual(token, expected)) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  const id = params.id;
  if (!id) return json({ error: 'Missing submission id.' }, 400);

  let body: { action?: string; note?: string; reviewer?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body must be JSON.' }, 400);
  }

  const reviewer = typeof body.reviewer === 'string' ? body.reviewer.slice(0, 120) : 'n8n';
  const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : null;

  if (body.action !== 'approve' && body.action !== 'reject') {
    return json({ error: "action must be 'approve' or 'reject'." }, 400);
  }

  const outcome =
    body.action === 'approve'
      ? await approveSubmission(id, reviewer)
      : await rejectSubmission(id, reviewer, note);

  if (outcome.ok) {
    return json(
      body.action === 'approve'
        ? { status: 'approved', car: outcome.carPublicRef, kind: outcome.kind }
        : { status: 'rejected' },
      200
    );
  }

  switch (outcome.reason) {
    case 'not_found':
      return json({ error: 'No such submission.' }, 404);
    case 'already_reviewed':
      // Two moderators, one card. Not an error worth alarming anyone about.
      return json({ error: 'Already reviewed.' }, 409);
    case 'conflict':
      return json(
        { error: 'That chassis number was registered while this sat in the queue.' },
        409
      );
    case 'empty':
      return json(
        { error: 'That correction proposes no changes; nothing to apply.' },
        422
      );
  }
};
