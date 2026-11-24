import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, schema } from '../../../db/client';
import { protokoll } from '../../../lib/verlauf';
import { antwort, fehler, liesEingabe, zahl } from '../../../lib/http';

const STATUS = ['aktiv', 'ehemalig', 'gefallen', 'ausgeblendet'] as const;

/** Status eines Namens ändern. Darf jedes Mitglied; steht im Verlauf. */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const ich = locals.mitglied!;
  const id = zahl(params.id);
  const e = await liesEingabe(request);
  const status = e.status as (typeof STATUS)[number];
  if (id === null || !STATUS.includes(status)) return fehler(request, 'Ungültige Angabe.');
  if (id === ich.id && status !== 'aktiv') return fehler(request, 'Den eigenen Namen bitte von jemand anderem umstellen lassen.');
  const [m] = await db.select().from(schema.mitglieder).where(eq(schema.mitglieder.id, id));
  if (!m) return fehler(request, 'Mitglied nicht gefunden.', 404);
  if (m.status === status) return antwort(request);
  await db.update(schema.mitglieder).set({ status }).where(eq(schema.mitglieder.id, id));
  await protokoll(db, { mitgliedId: ich.id, aktion: 'mitglied_status', details: { name: m.name, von: m.status, nach: status } });
  return antwort(request);
};
