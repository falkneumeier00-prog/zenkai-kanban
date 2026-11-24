import { defineMiddleware } from 'astro:middleware';
import { eq } from 'drizzle-orm';
import { db, schema } from './db/client';
import { leseAnmeldung, torIstOffen } from './lib/auth';

const OEFFENTLICH = ['/', '/api/tor'];
const NUR_TOR = ['/wer-bist-du', '/api/eingang/'];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const pfad = ctx.url.pathname;
  ctx.locals.torOffen = false;
  ctx.locals.mitglied = null;

  // Statische Dateien durchlassen
  if (pfad.startsWith('/_astro/') || pfad.startsWith('/favicon') || pfad.endsWith('.svg') || pfad.endsWith('.png')) {
    return next();
  }

  const anmeldung = await leseAnmeldung(ctx.cookies);
  if (anmeldung) {
    const [m] = await db.select().from(schema.mitglieder).where(eq(schema.mitglieder.id, anmeldung.mitgliedId));
    if (m && m.status === 'aktiv' && m.mudraHash && m.sitzungsVersion === anmeldung.version) {
      ctx.locals.mitglied = m;
      ctx.locals.torOffen = true;
    }
  }
  if (!ctx.locals.torOffen) ctx.locals.torOffen = await torIstOffen(ctx.cookies);

  const istApi = pfad.startsWith('/api/');
  const verweigern = (ziel: string) =>
    istApi ? Response.json({ ok: false, fehler: 'Nicht angemeldet.' }, { status: 401 }) : ctx.redirect(ziel);

  if (OEFFENTLICH.includes(pfad)) {
    if (ctx.locals.mitglied && pfad === '/') return ctx.redirect('/board');
    if (ctx.locals.torOffen && pfad === '/') return ctx.redirect('/wer-bist-du');
    return next();
  }
  if (NUR_TOR.some((p) => pfad === p || pfad.startsWith(p))) {
    if (ctx.locals.mitglied && pfad === '/wer-bist-du') return ctx.redirect('/board');
    return ctx.locals.torOffen ? next() : verweigern('/');
  }
  if (!ctx.locals.mitglied) return verweigern(ctx.locals.torOffen ? '/wer-bist-du' : '/');

  const antwort = await next();
  // Angemeldete Seiten nicht zwischenspeichern
  antwort.headers.set('Cache-Control', 'no-store');
  return antwort;
});
