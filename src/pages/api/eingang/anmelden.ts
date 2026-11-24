import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../../db/client';
import { pruefen } from '../../../lib/krypto';
import { anmelden } from '../../../lib/auth';
import { pruefeMudraFolge, mudraFolgeAlsText, naechsteSperre } from '../../../lib/regeln';
import { liesEingabe, zahl } from '../../../lib/http';

export const POST: APIRoute = async ({ request, cookies }) => {
  const e = await liesEingabe(request);
  const id = zahl(e.mitgliedId);
  const folge = pruefeMudraFolge(e.folge);
  if (id === null || !folge.ok) return Response.json({ ok: false, fehler: folge.ok ? 'Name fehlt.' : folge.grund }, { status: 400 });

  const [m] = await db.select().from(schema.mitglieder).where(eq(schema.mitglieder.id, id));
  if (!m || m.status !== 'aktiv') return Response.json({ ok: false, fehler: 'Diesen Namen gibt es nicht (mehr).' }, { status: 404 });
  if (!m.mudraHash) return Response.json({ ok: false, fehler: 'Für diesen Namen muss zuerst eine neue Mudra-Folge festgelegt werden.', neueFolge: true }, { status: 409 });

  const jetzt = new Date();
  if (m.gesperrtBis && m.gesperrtBis > jetzt) {
    const min = Math.ceil((m.gesperrtBis.getTime() - jetzt.getTime()) / 60_000);
    return Response.json({ ok: false, fehler: `Zu viele Fehlversuche. Noch ${min} Minute(n) gesperrt.` }, { status: 429 });
  }

  const richtig = await pruefen(mudraFolgeAlsText(e.folge as number[]), m.mudraHash);
  if (!richtig) {
    const nachher = (m.gesperrtBis && m.gesperrtBis <= jetzt ? 0 : m.fehlversuche) + 1;
    const sperre = naechsteSperre(nachher, jetzt);
    await db.update(schema.mitglieder)
      .set({ fehlversuche: sperre ? 0 : nachher, gesperrtBis: sperre })
      .where(eq(schema.mitglieder.id, m.id));
    return Response.json({
      ok: false,
      fehler: sperre ? 'Falsche Mudra-Folge. Der Name ist jetzt 15 Minuten gesperrt.' : 'Falsche Mudra-Folge.',
    }, { status: 401 });
  }

  await db.update(schema.mitglieder).set({ fehlversuche: 0, gesperrtBis: null }).where(eq(schema.mitglieder.id, m.id));
  await anmelden(cookies, m.id, m.sitzungsVersion);
  return Response.json({ ok: true });
};
