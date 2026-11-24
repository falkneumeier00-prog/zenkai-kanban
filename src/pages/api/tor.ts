import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';
import { db, schema } from '../../db/client';
import { pruefen } from '../../lib/krypto';
import { torOeffnen } from '../../lib/auth';
import { pflichtEnv } from '../../lib/umgebung';

const MAX = 5;
const FENSTER_MIN = 15;

function ipVon(ctx: Parameters<APIRoute>[0]): string {
  try { return ctx.clientAddress; } catch { /* lokal ggf. nicht verfügbar */ }
  return ctx.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unbekannt';
}

export const POST: APIRoute = async (ctx) => {
  const fd = await ctx.request.formData();
  const passwort = String(fd.get('passwort') ?? '');
  const ip = ipVon(ctx);

  // Fehlversuche pro IP in einem 15-Minuten-Fenster zählen
  const [stand] = await db.select().from(schema.torVersuche).where(sql`${schema.torVersuche.ip} = ${ip}`);
  const fensterAbgelaufen = !stand || Date.now() - stand.fensterStart.getTime() > FENSTER_MIN * 60_000;
  if (stand && !fensterAbgelaufen && stand.anzahl >= MAX) {
    return ctx.redirect('/?fehler=' + encodeURIComponent(`Zu viele Versuche. Bitte in ${FENSTER_MIN} Minuten erneut.`), 303);
  }

  const richtig = passwort.length > 0 && (await pruefen(passwort, pflichtEnv('TOR_PASSWORT_HASH')));
  if (!richtig) {
    await db.insert(schema.torVersuche)
      .values({ ip, anzahl: 1, fensterStart: new Date() })
      .onConflictDoUpdate({
        target: schema.torVersuche.ip,
        set: fensterAbgelaufen
          ? { anzahl: 1, fensterStart: new Date() }
          : { anzahl: sql`${schema.torVersuche.anzahl} + 1` },
      });
    return ctx.redirect('/?fehler=' + encodeURIComponent('Das Passwort stimmt nicht.'), 303);
  }

  if (stand) await db.delete(schema.torVersuche).where(sql`${schema.torVersuche.ip} = ${ip}`);
  await torOeffnen(ctx.cookies);
  return ctx.redirect('/wer-bist-du', 303);
};
