/**
 * Die 11 Mudras von Zenkai.
 *
 * TODO: Namen und Reihenfolge durch die echten Zenkai-Mudras ersetzen.
 * Die Platzhalter sind die klassischen Fingerzeichen mit ihren Schriftzeichen.
 * WICHTIG: Gespeichert wird die Position (0–10), nicht der Name. Eine reine
 * Umbenennung ist also jederzeit möglich. Wer die REIHENFOLGE ändert, macht
 * alle bestehenden Mudra-Folgen ungültig.
 */
export const MUDRAS = [
  { name: 'Ratte', zeichen: '子' },
  { name: 'Ochse', zeichen: '丑' },
  { name: 'Tiger', zeichen: '寅' },
  { name: 'Hase', zeichen: '卯' },
  { name: 'Drache', zeichen: '辰' },
  { name: 'Schlange', zeichen: '巳' },
  { name: 'Pferd', zeichen: '午' },
  { name: 'Widder', zeichen: '未' },
  { name: 'Affe', zeichen: '申' },
  { name: 'Vogel', zeichen: '酉' },
  { name: 'Hund', zeichen: '戌' },
] as const;

export const MUDRA_LAENGE = 5;
