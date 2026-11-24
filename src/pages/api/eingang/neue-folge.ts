import type { APIRoute } from 'astro';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../../../db/client';
import { hashen } from '../../../lib/krypto';
import { anmelden } from '../../../lib/auth';
import { protokoll } from '../../../lib/verlauf';
import { pruefeMudraFolge, mudraFolgeAlsText } from '../../../lib/regeln';
import { liesEingabe, zahl } from '../../../lib/http';

/** Nach genehmigter Rücksetzung: neue Mudra-Folge festlegen. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const e = await liesEingabe(request);
  const id = zahl(e.mitgliedId);
  const folge = pruefeMudraFolge(e.folge);
  if (id === null) return Response.json({ ok: false, fehler: 'Name fehlt.' }, { status: 400 });
  if (!folge.ok) return Response.json({ ok: false, fehler: folge.grund }, { status: 400 });
  if (mudraFolgeAlsText(e.folge as number[]) !== mudraFolgeAlsText((e.folge2 as number[]) ?? [])) {
    return Response.json({ ok: false, fehler: 'Die beiden Mudra-Folgen sind nicht gleich.' }, { status: 400 });
  }
  const mudraHash = await hashen(mudraFolgeAlsText(e.folge as number[]));
  const [m] = await db.update(schema.mitglieder)
    .set({ mudraHash, fehlversuche: 0, gesperrtBis: null })
    .where(and(eq(schema.mitglieder.id, id), isNull(schema.mitglieder.mudraHash), eq(schema.mitglieder.status, 'aktiv')))
    .returning();
  if (!m) return Response.json({ ok: false, fehler: 'Für diesen Namen ist keine Rücksetzung genehmigt.' }, { status: 409 });
  await protokoll(db, { mitgliedId: m.id, aktion: 'mudra_neu_festgelegt' });
  await anmelden(cookies, m.id, m.sitzungsVersion);
  return Response.json({ ok: true });
};
