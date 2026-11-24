import { sql } from 'drizzle-orm';
import {
  pgTable, serial, integer, text, timestamp, boolean, date, jsonb, pgEnum, uniqueIndex, index, primaryKey,
} from 'drizzle-orm/pg-core';

export const mitgliedStatus = pgEnum('mitglied_status', ['aktiv', 'ehemalig', 'gefallen', 'ausgeblendet']);
export const spalte = pgEnum('spalte', ['idee', 'offen', 'in_arbeit', 'pruefung', 'erledigt']);
export const prioritaet = pgEnum('prioritaet', ['niedrig', 'normal', 'hoch']);
export const eintragArt = pgEnum('eintrag_art', ['macht', 'hilft_mit']);
export const antragStatus = pgEnum('antrag_status', ['offen', 'genehmigt', 'abgelehnt']);

/** Ein Bereich der Diplomatie. Nur zum Filtern, verleiht keine Rechte. */
export const bereiche = pgTable('bereich', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  farbe: text('farbe').notNull(),
  reihenfolge: integer('reihenfolge').notNull().default(0),
});

/** Ein Mitglied ist ein RP-Name, keine echte Person und kein Konto. */
export const mitglieder = pgTable('mitglied', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  bereichId: integer('bereich_id').references(() => bereiche.id),
  mudraHash: text('mudra_hash'), // null = muss beim nächsten Eintritt neu festgelegt werden
  status: mitgliedStatus('status').notNull().default('aktiv'),
  fehlversuche: integer('fehlversuche').notNull().default(0),
  gesperrtBis: timestamp('gesperrt_bis', { withTimezone: true }),
  /** Wird bei einer Rücksetzung erhöht; alte Anmelde-Cookies werden damit ungültig. */
  sitzungsVersion: integer('sitzungs_version').notNull().default(1),
  eingetragenAm: timestamp('eingetragen_am', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('mitglied_name_lower').on(sql`lower(${t.name})`)]);

export const karten = pgTable('karte', {
  id: serial('id').primaryKey(),
  titel: text('titel').notNull(),
  beschreibung: text('beschreibung').notNull().default(''),
  bereichId: integer('bereich_id').references(() => bereiche.id),
  projekt: text('projekt'),
  spalte: spalte('spalte').notNull().default('idee'),
  prioritaet: prioritaet('prioritaet').notNull().default('normal'),
  frist: date('frist'),
  blockiert: boolean('blockiert').notNull().default(false),
  position: integer('position').notNull().default(0),
  erstelltVon: integer('erstellt_von').notNull().references(() => mitglieder.id),
  erstelltAm: timestamp('erstellt_am', { withTimezone: true }).notNull().defaultNow(),
  geaendertAm: timestamp('geaendert_am', { withTimezone: true }).notNull().defaultNow(),
  archiviertAm: timestamp('archiviert_am', { withTimezone: true }),
}, (t) => [index('karte_spalte').on(t.spalte)]);

/** Wer auf einer Karte eingetragen ist: "macht" oder "hilft mit". */
export const eintraege = pgTable('eintrag', {
  karteId: integer('karte_id').notNull().references(() => karten.id),
  mitgliedId: integer('mitglied_id').notNull().references(() => mitglieder.id),
  art: eintragArt('art').notNull(),
  seit: timestamp('seit', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.karteId, t.mitgliedId] })]);

export const kommentare = pgTable('kommentar', {
  id: serial('id').primaryKey(),
  karteId: integer('karte_id').notNull().references(() => karten.id),
  mitgliedId: integer('mitglied_id').notNull().references(() => mitglieder.id),
  text: text('text').notNull(),
  erstelltAm: timestamp('erstellt_am', { withTimezone: true }).notNull().defaultNow(),
  zurueckgezogen: boolean('zurueckgezogen').notNull().default(false),
});

/** Verweise auf Entwürfe in Google Docs, PDFs, Discord-Nachrichten. */
export const links = pgTable('link', {
  id: serial('id').primaryKey(),
  karteId: integer('karte_id').notNull().references(() => karten.id),
  titel: text('titel').notNull(),
  url: text('url').notNull(),
  mitgliedId: integer('mitglied_id').notNull().references(() => mitglieder.id),
  erstelltAm: timestamp('erstellt_am', { withTimezone: true }).notNull().defaultNow(),
});

/** Nur anfügen, nie ändern. */
export const verlauf = pgTable('verlauf', {
  id: serial('id').primaryKey(),
  zeit: timestamp('zeit', { withTimezone: true }).notNull().defaultNow(),
  mitgliedId: integer('mitglied_id').references(() => mitglieder.id),
  karteId: integer('karte_id').references(() => karten.id),
  aktion: text('aktion').notNull(),
  details: jsonb('details').$type<Record<string, unknown>>(),
}, (t) => [index('verlauf_karte').on(t.karteId)]);

export const ruecksetzantraege = pgTable('ruecksetzantrag', {
  id: serial('id').primaryKey(),
  mitgliedId: integer('mitglied_id').notNull().references(() => mitglieder.id),
  beantragtAm: timestamp('beantragt_am', { withTimezone: true }).notNull().defaultNow(),
  status: antragStatus('status').notNull().default('offen'),
  entschiedenVon: integer('entschieden_von').references(() => mitglieder.id),
  entschiedenAm: timestamp('entschieden_am', { withTimezone: true }),
});

/** Technische Hilfstabelle: Fehlversuche am Tor pro IP (gegen Durchprobieren). */
export const torVersuche = pgTable('tor_versuch', {
  ip: text('ip').primaryKey(),
  anzahl: integer('anzahl').notNull().default(0),
  fensterStart: timestamp('fenster_start', { withTimezone: true }).notNull().defaultNow(),
});

export type Mitglied = typeof mitglieder.$inferSelect;
export type Karte = typeof karten.$inferSelect;
export type Bereich = typeof bereiche.$inferSelect;
export type Spalte = (typeof spalte.enumValues)[number];
export type Prioritaet = (typeof prioritaet.enumValues)[number];
export type EintragArt = (typeof eintragArt.enumValues)[number];
export type MitgliedStatus = (typeof mitgliedStatus.enumValues)[number];
