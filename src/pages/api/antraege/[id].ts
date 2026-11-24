import type { APIRoute } from 'astro';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '../../../db/client';
import { protokoll } from '../../../lib/verlauf';
import { darfRuecksetzungEntscheiden, genehmigerAusText } from '../../../lib/regeln';
import { env } from '../../../lib/umgebung';
import { antwort, fehler, liesEingabe, zahl } from '../../../lib/http';

/** Hinabi oder Rei entscheiden über einen Rücksetzantrag. */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const ich = locals.mitglied!;
  const id = zahl(params.id);
  const e = await liesEingabe(request);
  const entscheidung = e.entscheidung === 'genehmigt' ? 'genehmigt' : e.entscheidung === 'abgelehnt' ? 'abgelehnt' : null;
  if (id === null || !entscheidung) return fehler(request, 'Ungültige Angabe.');

  const [antrag] = await db.select().from(schema.ruecksetzantraege)
    .where(and(eq(schema.ruecksetzantraege.id, id), eq(schema.ruecksetzantraege.status, 'offen')));
  if (!antrag) return fehler(request, 'Antrag nicht gefunden oder schon entschieden.', 404);

  const regel = darfRuecksetzungEntscheiden({
    entscheiderName: ich.name, entscheiderId: ich.id, antragstellerId: antrag.mitgliedId,
    genehmiger: genehmigerAusText(env('RUECKSETZ_GENEHMIGER')),
  });
  if (!regel.ok) return fehler(request, regel.grund, 403);

  const [betroffen] = await db.select().from(schema.mitglieder).where(eq(schema.mitglieder.id, antrag.mitgliedId));
  await db.transaction(async (tx) => {
    await tx.update(schema.ruecksetzantraege)
      .set({ status: entscheidung, entschiedenVon: ich.id, entschiedenAm: new Date() })
      .where(eq(schema.ruecksetzantraege.id, id));
    if (entscheidung === 'genehmigt') {
      // Folge löschen und alte Anmeldungen ungültig machen
      await tx.update(schema.mitglieder)
        .set({ mudraHash: null, fehlversuche: 0, gesperrtBis: null, sitzungsVersion: sql`${schema.mitglieder.sitzungsVersion} + 1` })
        .where(eq(schema.mitglieder.id, antrag.mitgliedId));
    }
    await protokoll(tx, { mitgliedId: ich.id, aktion: `ruecksetzung_${entscheidung}`, details: { fuer: betroffen?.name } });
  });
  return antwort(request);
};
