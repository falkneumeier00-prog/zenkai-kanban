import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../../db/client';
import { protokoll } from '../../../lib/verlauf';
import { ladeKarte, kleinstePosition } from '../../../lib/board';
import { darfVerschieben, pruefeUrl, SPALTEN, type SpalteId } from '../../../lib/regeln';
import { antwort, fehler, liesEingabe, textOderLeer, zahl } from '../../../lib/http';

const PRIOS = ['niedrig', 'normal', 'hoch'] as const;

export const GET: APIRoute = async ({ params }) => {
  const id = zahl(params.id);
  const daten = id === null ? null : await ladeKarte(id);
  if (!daten) return Response.json({ ok: false, fehler: 'Karte nicht gefunden.' }, { status: 404 });
  return Response.json(daten);
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  const ich = locals.mitglied!;
  const id = zahl(params.id);
  if (id === null) return fehler(request, 'Ungültige Karte.', 404);
  const [karte] = await db.select().from(schema.karten).where(eq(schema.karten.id, id));
  if (!karte) return fehler(request, 'Karte nicht gefunden.', 404);
  const e = await liesEingabe(request);
  const jetzt = new Date();
  const log = (aktion: string, details?: Record<string, unknown>) =>
    protokoll(db, { mitgliedId: ich.id, karteId: id, aktion, details });
  const beruehren = () => db.update(schema.karten).set({ geaendertAm: jetzt }).where(eq(schema.karten.id, id));

  switch (e.aktion) {
    case 'bearbeiten': {
      const neu: Partial<typeof schema.karten.$inferInsert> = {};
      if ('titel' in e) {
        const t = textOderLeer(e.titel, 140);
        if (t.length < 2) return fehler(request, 'Bitte einen Titel mit mindestens 2 Zeichen.');
        neu.titel = t;
      }
      if ('beschreibung' in e) neu.beschreibung = textOderLeer(e.beschreibung);
      if ('bereichId' in e) neu.bereichId = zahl(e.bereichId);
      if ('projekt' in e) neu.projekt = textOderLeer(e.projekt, 60) || null;
      if ('prioritaet' in e && PRIOS.includes(e.prioritaet as never)) neu.prioritaet = e.prioritaet as (typeof PRIOS)[number];
      if ('frist' in e) {
        const f = textOderLeer(e.frist, 10);
        if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) return fehler(request, 'Frist bitte als Datum.');
        neu.frist = f || null;
      }
      if ('blockiert' in e) neu.blockiert = e.blockiert === true || e.blockiert === 'true';

      const vorher: Record<string, unknown> = {};
      const nachher: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(neu)) {
        const alt = (karte as Record<string, unknown>)[k];
        if (alt !== v) { vorher[k] = alt; nachher[k] = v; }
      }
      if (Object.keys(nachher).length === 0) return antwort(request);
      await db.update(schema.karten).set({ ...neu, geaendertAm: jetzt }).where(eq(schema.karten.id, id));
      await log('bearbeitet', { vorher, nachher });
      return antwort(request);
    }

    case 'verschieben': {
      const nach = e.nach as SpalteId;
      if (!SPALTEN.includes(nach)) return fehler(request, 'Unbekannte Spalte.');
      if (nach === karte.spalte) return antwort(request);
      const eingetragene = (await db.select({ m: schema.eintraege.mitgliedId }).from(schema.eintraege)
        .where(eq(schema.eintraege.karteId, id))).map((r) => r.m);
      const regel = darfVerschieben({ von: karte.spalte, nach, mitgliedId: ich.id, eingetragene });
      if (!regel.ok) return fehler(request, regel.grund, 403);
      await db.update(schema.karten)
        .set({ spalte: nach, position: await kleinstePosition(nach), geaendertAm: jetzt })
        .where(eq(schema.karten.id, id));
      await log('verschoben', { von: karte.spalte, nach });
      return antwort(request);
    }

    case 'eintragen': {
      const art = e.art === 'hilft_mit' ? 'hilft_mit' : 'macht';
      await db.insert(schema.eintraege).values({ karteId: id, mitgliedId: ich.id, art })
        .onConflictDoUpdate({ target: [schema.eintraege.karteId, schema.eintraege.mitgliedId], set: { art } });
      await log('eingetragen', { art });
      // Wer eine offene Karte übernimmt, bringt sie in Bearbeitung
      if (art === 'macht' && karte.spalte === 'offen') {
        await db.update(schema.karten).set({ spalte: 'in_arbeit', position: await kleinstePosition('in_arbeit'), geaendertAm: jetzt })
          .where(eq(schema.karten.id, id));
        await log('verschoben', { von: 'offen', nach: 'in_arbeit', automatisch: true });
      } else {
        await beruehren();
      }
      return antwort(request);
    }

    case 'austragen': {
      const r = await db.delete(schema.eintraege)
        .where(and(eq(schema.eintraege.karteId, id), eq(schema.eintraege.mitgliedId, ich.id))).returning();
      if (r.length) { await beruehren(); await log('ausgetragen'); }
      return antwort(request);
    }

    case 'kommentar': {
      const text = textOderLeer(e.text, 2000);
      if (!text) return fehler(request, 'Der Kommentar ist leer.');
      await db.insert(schema.kommentare).values({ karteId: id, mitgliedId: ich.id, text });
      await beruehren();
      return antwort(request);
    }

    case 'kommentar_zurueckziehen': {
      const kid = zahl(e.kommentarId);
      if (kid === null) return fehler(request, 'Kommentar fehlt.');
      // Zurückziehen kann man nur eigene Kommentare
      const r = await db.update(schema.kommentare).set({ zurueckgezogen: true })
        .where(and(eq(schema.kommentare.id, kid), eq(schema.kommentare.karteId, id), eq(schema.kommentare.mitgliedId, ich.id)))
        .returning();
      if (!r.length) return fehler(request, 'Nur eigene Kommentare lassen sich zurückziehen.', 403);
      await log('kommentar_zurueckgezogen', { kommentarId: kid });
      return antwort(request);
    }

    case 'link': {
      const url = pruefeUrl(e.url);
      if (!url.ok) return fehler(request, url.grund);
      const titel = textOderLeer(e.titel, 100) || new URL(String(e.url).trim()).hostname;
      await db.insert(schema.links).values({ karteId: id, titel, url: String(e.url).trim(), mitgliedId: ich.id });
      await beruehren();
      await log('link_hinzugefuegt', { titel });
      return antwort(request);
    }

    case 'link_entfernen': {
      const lid = zahl(e.linkId);
      if (lid === null) return fehler(request, 'Link fehlt.');
      const r = await db.delete(schema.links).where(and(eq(schema.links.id, lid), eq(schema.links.karteId, id))).returning();
      if (r.length) await log('link_entfernt', { titel: r[0].titel, url: r[0].url });
      return antwort(request);
    }

    case 'archivieren': {
      await db.update(schema.karten).set({ archiviertAm: jetzt, geaendertAm: jetzt }).where(eq(schema.karten.id, id));
      await log('archiviert');
      return antwort(request);
    }

    case 'zurueckholen': {
      const spalte = karte.spalte === 'erledigt' ? 'erledigt' : karte.spalte;
      await db.update(schema.karten)
        .set({ archiviertAm: null, geaendertAm: jetzt, position: await kleinstePosition(spalte) })
        .where(eq(schema.karten.id, id));
      await log('zurueckgeholt');
      return antwort(request);
    }

    default:
      return fehler(request, 'Unbekannte Aktion.');
  }
};
