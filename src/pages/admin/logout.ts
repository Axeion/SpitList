import type { APIRoute } from 'astro';
import { destroySession, SESSION_COOKIE } from '../../lib/auth';

export const prerender = false;

/** POST only: a GET logout can be triggered by any image tag on any page. */
export const POST: APIRoute = async ({ cookies, redirect }) => {
  await destroySession(cookies.get(SESSION_COOKIE)?.value);
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect('/admin/login?signed-out=1', 302);
};
