import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../../db/client';
import { protokoll } from '../../../lib/verlauf';
import { liesEingabe, zahl } from '../../../lib/http';

/** Legt einen Rücksetzantrag an. Genehmigen können nur die Personen aus RUECKSETZ_GENEHMIGER. */
export const POST: APIRoute = async ({ request }) => {
  const e = await liesEingabe(request);
  const id = zahl(e.mitgliedId);
  if (id === null) return Response.json({ ok: false, fehler: 'Name fehlt.' }, { status: 400 });
  const [m] = await db.select().from(schema.mitglieder).where(eq(schema.mitglieder.id, id));
  if (!m || m.status !== 'aktiv') return Response.json({ ok: false, fehler: 'Diesen Namen gibt es nicht (mehr).' }, { status: 404 });

  const [offen] = await db.select().from(schema.ruecksetzantraege)
    .where(and(eq(schema.ruecksetzantraege.mitgliedId, id), eq(schema.ruecksetzantraege.status, 'offen')));
  if (!offen) {
    await db.insert(schema.ruecksetzantraege).values({ mitgliedId: id });
    await protokoll(db, { mitgliedId: null, aktion: 'ruecksetzung_beantragt', details: { fuer: m.name } });
  }
  return Response.json({ ok: true, meldung: 'Antrag gestellt. Hinabi oder Rei melden sich bei dir, bevor sie genehmigen.' });
};
