/**
 * Die Regeln der App, als reine Funktionen (ohne Datenbank), damit sie testbar sind.
 * Grundsatz: Jedes aktive Mitglied darf alles. Hier stehen nur die Ausnahmen.
 */
import { MUDRA_LAENGE, MUDRAS } from './mudras';

export const SPALTEN = ['idee', 'offen', 'in_arbeit', 'pruefung', 'erledigt'] as const;
export type SpalteId = (typeof SPALTEN)[number];

export const SPALTEN_TITEL: Record<SpalteId, string> = {
  idee: 'Ideen & Vorschläge',
  offen: 'Offen',
  in_arbeit: 'In Bearbeitung',
  pruefung: 'Zur Prüfung',
  erledigt: 'Abgeschlossen',
};

export type Ergebnis = { ok: true } | { ok: false; grund: string };
const OK: Ergebnis = { ok: true };

/**
 * Regel 1 (Abschluss): Wer auf einer Karte eingetragen ist, schließt sie nicht selbst ab.
 * Nach "Abgeschlossen" geht es nur aus "Zur Prüfung" heraus.
 */
export function darfVerschieben(args: {
  von: SpalteId;
  nach: SpalteId;
  mitgliedId: number;
  eingetragene: number[];
}): Ergebnis {
  const { von, nach, mitgliedId, eingetragene } = args;
  if (!SPALTEN.includes(nach)) return { ok: false, grund: 'Unbekannte Spalte.' };
  if (nach === 'erledigt' && von !== 'erledigt') {
    if (von !== 'pruefung') {
      return { ok: false, grund: 'Abgeschlossen wird nur, was vorher „Zur Prüfung“ war.' };
    }
    if (eingetragene.includes(mitgliedId)) {
      return { ok: false, grund: 'Wer eingetragen ist, schließt nicht selbst ab. Bitte ein anderes Mitglied darum bitten.' };
    }
  }
  return OK;
}

/** Regel 2 (Mudra-Folge zurücksetzen): nur Namen aus der Genehmigerliste, nie über den eigenen Antrag. */
export function darfRuecksetzungEntscheiden(args: {
  entscheiderName: string;
  entscheiderId: number;
  antragstellerId: number;
  genehmiger: string[];
}): Ergebnis {
  const name = normName(args.entscheiderName);
  if (!args.genehmiger.map(normName).includes(name)) {
    return { ok: false, grund: 'Rücksetzungen genehmigen nur die dafür eingetragenen Personen.' };
  }
  if (args.entscheiderId === args.antragstellerId) {
    return { ok: false, grund: 'Über den eigenen Antrag entscheidet die andere Person.' };
  }
  return OK;
}

export function genehmigerAusText(text: string | undefined): string[] {
  return (text ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function istGenehmiger(name: string, genehmiger: string[]): boolean {
  return genehmiger.map(normName).includes(normName(name));
}

/** Eine Mudra-Folge ist genau MUDRA_LAENGE Positionen von 0 bis 10, Wiederholungen erlaubt. */
export function pruefeMudraFolge(folge: unknown): Ergebnis {
  if (!Array.isArray(folge) || folge.length !== MUDRA_LAENGE) {
    return { ok: false, grund: `Die Mudra-Folge hat genau ${MUDRA_LAENGE} Zeichen.` };
  }
  if (!folge.every((x) => Number.isInteger(x) && x >= 0 && x < MUDRAS.length)) {
    return { ok: false, grund: 'Unbekanntes Mudra in der Folge.' };
  }
  return OK;
}

export function mudraFolgeAlsText(folge: number[]): string {
  return folge.join('-');
}

/** RP-Namen: 2–40 Zeichen, Buchstaben (auch mit Akzent), Leerzeichen, Bindestrich, Apostroph. */
export function pruefeName(name: unknown): Ergebnis {
  if (typeof name !== 'string') return { ok: false, grund: 'Name fehlt.' };
  const n = name.trim().replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 40) return { ok: false, grund: 'Der Name hat 2 bis 40 Zeichen.' };
  if (!/^[\p{L}][\p{L}\p{M} '\-]*$/u.test(n)) return { ok: false, grund: 'Bitte nur Buchstaben, Leerzeichen und Bindestriche.' };
  return OK;
}

export function normName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de');
}

/** Nach 5 Fehlversuchen ist ein Name 15 Minuten gesperrt. */
export const MAX_FEHLVERSUCHE = 5;
export const SPERRE_MINUTEN = 15;

export function naechsteSperre(fehlversucheNachher: number, jetzt: Date): Date | null {
  return fehlversucheNachher >= MAX_FEHLVERSUCHE ? new Date(jetzt.getTime() + SPERRE_MINUTEN * 60_000) : null;
}

/** Links nur auf http(s), damit niemand "javascript:"-Links einschleust. */
export function pruefeUrl(url: unknown): Ergebnis {
  if (typeof url !== 'string') return { ok: false, grund: 'Link fehlt.' };
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, grund: 'Nur http- und https-Links.' };
    return OK;
  } catch {
    return { ok: false, grund: 'Das sieht nicht wie ein Link aus.' };
  }
}

/** Erledigte Karten wandern nach 14 Tagen von selbst ins Archiv. */
export const AUTO_ARCHIV_TAGE = 14;
/** "Neu dabei" gilt eine Woche lang. */
export const NEU_DABEI_TAGE = 7;
