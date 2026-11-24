import type { APIRoute } from 'astro';
import { ladeBoard } from '../../lib/board';

export const GET: APIRoute = async ({ locals }) => Response.json(await ladeBoard(locals.mitglied!));
