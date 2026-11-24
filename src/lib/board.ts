import { and, asc, eq, gt, isNull, lt, sql, desc } from 'drizzle-orm';
import { db, schema } from '../db/client';
import type { Mitglied } from '../db/schema';
import { AUTO_ARCHIV_TAGE, NEU_DABEI_TAGE, genehmigerAusText, istGenehmiger } from './regeln';
import { env } from './umgebung';

export type BoardDaten = Awaited<ReturnType<typeof ladeBoard>>;

export async function ladeBoard(ich: Mitglied) {
  // Erledigtes nach 14 Tagen automatisch archivieren
  await db.update(schema.karten)
    .set({ archiviertAm: new Date() })
    .where(and(
      eq(schema.karten.spalte, 'erledigt'),
      isNull(schema.karten.archiviertAm),
      lt(schema.karten.geaendertAm, sql`now() - make_interval(days => ${AUTO_ARCHIV_TAGE})`),
    ));

  const [karten, eintraege, mitglieder, bereiche, kommentarZahlen] = await Promise.all([
    db.select().from(schema.karten).where(isNull(schema.karten.archiviertAm))
      .orderBy(asc(schema.karten.position), desc(schema.karten.geaendertAm)),
    db.select({
      karteId: schema.eintraege.karteId, mitgliedId: schema.eintraege.mitgliedId, art: schema.eintraege.art,
    }).from(schema.eintraege)
      .innerJoin(schema.karten, eq(schema.karten.id, schema.eintraege.karteId))
      .where(isNull(schema.karten.archiviertAm)),
    db.select({
      id: schema.mitglieder.id, name: schema.mitglieder.name, status: schema.mitglieder.status,
      bereichId: schema.mitglieder.bereichId, eingetragenAm: schema.mitglieder.eingetragenAm,
    }).from(schema.mitglieder).orderBy(asc(schema.mitglieder.name)),
    db.select().from(schema.bereiche).orderBy(asc(schema.bereiche.reihenfolge)),
    db.select({ karteId: schema.kommentare.karteId, anzahl: sql<number>`count(*)::int` })
      .from(schema.kommentare).where(eq(schema.kommentare.zurueckgezogen, false)).groupBy(schema.kommentare.karteId),
  ]);

  const grenze = Date.now() - NEU_DABEI_TAGE * 86_400_000;
  const neuDabei = mitglieder.filter((m) => m.status === 'aktiv' && m.eingetragenAm.getTime() > grenze);

  const genehmiger = genehmigerAusText(env('RUECKSETZ_GENEHMIGER'));
  const darfGenehmigen = istGenehmiger(ich.name, genehmiger);
  const antraege = darfGenehmigen
    ? await db.select({
        id: schema.ruecksetzantraege.id, mitgliedId: schema.ruecksetzantraege.mitgliedId,
        beantragtAm: schema.ruecksetzantraege.beantragtAm, name: schema.mitglieder.name,
      }).from(schema.ruecksetzantraege)
        .innerJoin(schema.mitglieder, eq(schema.mitglieder.id, schema.ruecksetzantraege.mitgliedId))
        .where(eq(schema.ruecksetzantraege.status, 'offen'))
    : [];

  return {
    ich: { id: ich.id, name: ich.name },
    karten: karten.map((k) => ({ ...k, erstelltAm: k.erstelltAm.toISOString(), geaendertAm: k.geaendertAm.toISOString(), archiviertAm: null })),
    eintraege,
    mitglieder: mitglieder.map((m) => ({ ...m, eingetragenAm: m.eingetragenAm.toISOString() })),
    bereiche,
    kommentarZahlen: Object.fromEntries(kommentarZahlen.map((k) => [k.karteId, k.anzahl])),
    neuDabei: neuDabei.map((m) => ({ id: m.id, name: m.name })),
    darfGenehmigen,
    antraege: antraege.map((a) => ({ ...a, beantragtAm: a.beantragtAm.toISOString() })),
  };
}

export async function ladeKarte(id: number) {
  const [karte] = await db.select().from(schema.karten).where(eq(schema.karten.id, id));
  if (!karte) return null;
  const [kommentare, links, verlauf] = await Promise.all([
    db.select({
      id: schema.kommentare.id, text: schema.kommentare.text, erstelltAm: schema.kommentare.erstelltAm,
      zurueckgezogen: schema.kommentare.zurueckgezogen, mitgliedId: schema.kommentare.mitgliedId,
    }).from(schema.kommentare).where(eq(schema.kommentare.karteId, id)).orderBy(asc(schema.kommentare.erstelltAm)),
    db.select().from(schema.links).where(eq(schema.links.karteId, id)).orderBy(asc(schema.links.erstelltAm)),
    db.select().from(schema.verlauf).where(eq(schema.verlauf.karteId, id)).orderBy(desc(schema.verlauf.zeit)).limit(100),
  ]);
  return {
    karte,
    kommentare: kommentare.map((k) => ({ ...k, text: k.zurueckgezogen ? '' : k.text })),
    links,
    verlauf,
  };
}

/** Neue Karten landen oben in ihrer Spalte. */
export async function kleinstePosition(spalte: string): Promise<number> {
  const [r] = await db.select({ p: sql<number>`coalesce(min(${schema.karten.position}), 0)::int` })
    .from(schema.karten).where(and(sql`${schema.karten.spalte} = ${spalte}`, isNull(schema.karten.archiviertAm)));
  return (r?.p ?? 0) - 1;
}

export { gt };
