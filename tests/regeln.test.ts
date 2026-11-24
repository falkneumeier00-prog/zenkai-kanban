import { describe, it, expect } from 'vitest';
import {
  darfVerschieben, darfRuecksetzungEntscheiden, pruefeMudraFolge, pruefeName, pruefeUrl,
  naechsteSperre, istGenehmiger, genehmigerAusText,
} from '../src/lib/regeln';

describe('Abschluss-Regel', () => {
  it('erlaubt normales Verschieben für alle', () => {
    expect(darfVerschieben({ von: 'offen', nach: 'in_arbeit', mitgliedId: 1, eingetragene: [] }).ok).toBe(true);
    expect(darfVerschieben({ von: 'in_arbeit', nach: 'pruefung', mitgliedId: 1, eingetragene: [1] }).ok).toBe(true);
  });
  it('verbietet Eingetragenen, die eigene Karte abzuschließen', () => {
    const r = darfVerschieben({ von: 'pruefung', nach: 'erledigt', mitgliedId: 1, eingetragene: [1, 2] });
    expect(r.ok).toBe(false);
  });
  it('erlaubt einem anderen Mitglied den Abschluss', () => {
    expect(darfVerschieben({ von: 'pruefung', nach: 'erledigt', mitgliedId: 3, eingetragene: [1, 2] }).ok).toBe(true);
  });
  it('erlaubt den Abschluss nur aus "Zur Prüfung"', () => {
    expect(darfVerschieben({ von: 'in_arbeit', nach: 'erledigt', mitgliedId: 3, eingetragene: [1] }).ok).toBe(false);
    expect(darfVerschieben({ von: 'idee', nach: 'erledigt', mitgliedId: 3, eingetragene: [] }).ok).toBe(false);
  });
  it('erlaubt das Zurückholen aus "Abgeschlossen"', () => {
    expect(darfVerschieben({ von: 'erledigt', nach: 'in_arbeit', mitgliedId: 1, eingetragene: [1] }).ok).toBe(true);
  });
  it('lehnt unbekannte Spalten ab', () => {
    expect(darfVerschieben({ von: 'offen', nach: 'hokage' as never, mitgliedId: 1, eingetragene: [] }).ok).toBe(false);
  });
});

describe('Rücksetzung der Mudra-Folge', () => {
  const genehmiger = genehmigerAusText('Hinabi Kazan, Rei Hyuga');
  it('Hinabi darf über Antrag von Tsukumo entscheiden', () => {
    expect(darfRuecksetzungEntscheiden({ entscheiderName: 'Hinabi Kazan', entscheiderId: 1, antragstellerId: 5, genehmiger }).ok).toBe(true);
  });
  it('Groß/Kleinschreibung und Leerzeichen spielen keine Rolle', () => {
    expect(istGenehmiger('  rei   hyuga ', genehmiger)).toBe(true);
  });
  it('andere Mitglieder dürfen nicht', () => {
    expect(darfRuecksetzungEntscheiden({ entscheiderName: 'Tsukumo Himura', entscheiderId: 5, antragstellerId: 6, genehmiger }).ok).toBe(false);
  });
  it('niemand entscheidet über den eigenen Antrag', () => {
    expect(darfRuecksetzungEntscheiden({ entscheiderName: 'Rei Hyuga', entscheiderId: 2, antragstellerId: 2, genehmiger }).ok).toBe(false);
  });
});

describe('Mudra-Folge', () => {
  it('nimmt genau 5 gültige Zeichen, Wiederholungen erlaubt', () => {
    expect(pruefeMudraFolge([0, 0, 10, 3, 3]).ok).toBe(true);
  });
  it('lehnt falsche Länge und unbekannte Zeichen ab', () => {
    expect(pruefeMudraFolge([1, 2, 3, 4]).ok).toBe(false);
    expect(pruefeMudraFolge([1, 2, 3, 4, 11]).ok).toBe(false);
    expect(pruefeMudraFolge([1, 2, 3, 4, 1.5]).ok).toBe(false);
    expect(pruefeMudraFolge('1-2-3-4-5').ok).toBe(false);
  });
  it('sperrt nach dem fünften Fehlversuch für 15 Minuten', () => {
    const jetzt = new Date('2026-11-24T12:00:00Z');
    expect(naechsteSperre(4, jetzt)).toBeNull();
    expect(naechsteSperre(5, jetzt)?.toISOString()).toBe('2026-11-24T12:15:00.000Z');
  });
});

describe('Namen und Links', () => {
  it('akzeptiert RP-Namen', () => {
    expect(pruefeName('Tsukumo Himura').ok).toBe(true);
    expect(pruefeName('Saidatzu Amasako').ok).toBe(true);
    expect(pruefeName('Jürgen-Ōtsutsuki').ok).toBe(true);
  });
  it('lehnt Unsinn ab', () => {
    expect(pruefeName('x').ok).toBe(false);
    expect(pruefeName('<script>').ok).toBe(false);
    expect(pruefeName('123').ok).toBe(false);
  });
  it('lässt nur http(s)-Links zu', () => {
    expect(pruefeUrl('https://docs.google.com/document/d/abc').ok).toBe(true);
    expect(pruefeUrl('javascript:alert(1)').ok).toBe(false);
    expect(pruefeUrl('kein link').ok).toBe(false);
  });
});
