import type { APIRoute } from 'astro';
import { db, schema } from '../../../db/client';
import { protokoll } from '../../../lib/verlauf';
import { kleinstePosition } from '../../../lib/board';
import { SPALTEN, type SpalteId } from '../../../lib/regeln';
import { fehler, liesEingabe, textOderLeer, zahl } from '../../../lib/http';

/** Neue Karte anlegen. Pflicht ist nur der Titel. */
export const POST: APIRoute = async ({ request, locals }) => {
  const ich = locals.mitglied!;
  const e = await liesEingabe(request);
  const titel = textOderLeer(e.titel, 140);
  if (titel.length < 2) return fehler(request, 'Bitte einen Titel mit mindestens 2 Zeichen.');
  const spalte: SpalteId = SPALTEN.includes(e.spalte as SpalteId) && e.spalte !== 'erledigt' ? (e.spalte as SpalteId) : 'idee';

  const karte = await db.transaction(async (tx) => {
    const [k] = await tx.insert(schema.karten).values({
      titel,
      beschreibung: textOderLeer(e.beschreibung),
      bereichId: zahl(e.bereichId),
      spalte,
      position: await kleinstePosition(spalte),
      erstelltVon: ich.id,
    }).returning();
    await protokoll(tx, { mitgliedId: ich.id, karteId: k.id, aktion: 'karte_angelegt', details: { titel, spalte } });
    if (e.ichMacheMit === true || e.ichMacheMit === 'true') {
      await tx.insert(schema.eintraege).values({ karteId: k.id, mitgliedId: ich.id, art: 'macht' });
      await protokoll(tx, { mitgliedId: ich.id, karteId: k.id, aktion: 'eingetragen', details: { art: 'macht' } });
    }
    return k;
  });
  return Response.json({ ok: true, id: karte.id });
};
