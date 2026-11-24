import type { APIRoute } from 'astro';
import { abmelden } from '../../lib/auth';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  abmelden(cookies);
  return redirect('/wer-bist-du', 303);
};
