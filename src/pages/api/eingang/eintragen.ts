import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';
import { db, schema } from '../../../db/client';
import { hashen } from '../../../lib/krypto';
import { anmelden } from '../../../lib/auth';
import { protokoll } from '../../../lib/verlauf';
import { pruefeMudraFolge, pruefeName, mudraFolgeAlsText } from '../../../lib/regeln';
import { liesEingabe, zahl } from '../../../lib/http';

export const POST: APIRoute = async ({ request, cookies }) => {
  const e = await liesEingabe(request);
  const name = pruefeName(e.name);
  if (!name.ok) return Response.json({ ok: false, fehler: name.grund }, { status: 400 });
  const folge = pruefeMudraFolge(e.folge);
  if (!folge.ok) return Response.json({ ok: false, fehler: folge.grund }, { status: 400 });
  if (mudraFolgeAlsText(e.folge as number[]) !== mudraFolgeAlsText((e.folge2 as number[]) ?? [])) {
    return Response.json({ ok: false, fehler: 'Die beiden Mudra-Folgen sind nicht gleich.' }, { status: 400 });
  }
  const sauberName = (e.name as string).trim().replace(/\s+/g, ' ');
  const bereichId = zahl(e.bereichId);

  const [vorhanden] = await db.select({ id: schema.mitglieder.id }).from(schema.mitglieder)
    .where(sql`lower(${schema.mitglieder.name}) = lower(${sauberName})`);
  if (vorhanden) return Response.json({ ok: false, fehler: 'Diesen Namen gibt es schon. Bitte in der Liste antippen.' }, { status: 409 });

  const mudraHash = await hashen(mudraFolgeAlsText(e.folge as number[]));
  const neu = await db.transaction(async (tx) => {
    const [m] = await tx.insert(schema.mitglieder).values({ name: sauberName, bereichId, mudraHash }).returning();
    await protokoll(tx, { mitgliedId: m.id, aktion: 'mitglied_eingetragen', details: { name: m.name } });
    return m;
  });
  await anmelden(cookies, neu.id, neu.sitzungsVersion);
  return Response.json({ ok: true });
};
