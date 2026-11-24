# Diplomatie Konoha – Kanban-Board

Eigenes Kanban-Board für die Diplomatie Konohagakures im Naruto-RP **Zenkai DE**.
Ziel: weniger Streit, klare Übersicht, wer woran arbeitet. Keine Ränge, keine Geheimnisse.

## Was die App kann

- **Tor der Diplomatie:** Gruppenpasswort am Eingang (Sperre nach 5 Fehlversuchen pro 15 Minuten).
- **„Wer bist du, Shinobi?“:** Eintragen mit RP-Name und einer geheimen **Mudra-Folge** aus 5 von 11 Fingerzeichen. Keine E-Mail.
- **Board** mit fünf Spalten: Ideen & Vorschläge → Offen → In Bearbeitung → Zur Prüfung → Abgeschlossen.
  Drag & Drop am PC, Spaltenreiter und Spaltenauswahl am Handy.
- **Karten:** Titel, Beschreibung, Bereich, Projekt-Schlagwort, Priorität, Frist, „blockiert“, Links, Kommentare, Verlauf.
- **Eintragen:** „Ich mache das“ / „Ich helfe mit“ – Namen erscheinen als rote Siegel auf der Karte.
- **Regel 1:** Wer eingetragen ist, schließt die eigene Karte nicht selbst ab. Das macht ein anderes Mitglied.
- **Regel 2:** Rücksetzen einer vergessenen Mudra-Folge genehmigen nur die Personen aus `RUECKSETZ_GENEHMIGER` (Hinabi oder Rei).
- **Mitgliederliste:** „Neu dabei“ eine Woche lang, Status aktiv / gefallen / ehemalig / „gehört nicht dazu“.
- **Archiv:** Abgeschlossenes wandert nach 14 Tagen von selbst dorthin. Nichts wird gelöscht.

## Technik

Astro 7 (Server-Modus) · React-Insel fürs Board · dnd-kit · Drizzle ORM · PostgreSQL (Neon) · Vercel.
Begründungen in [`docs/adr/`](docs/adr/).

## Lokal starten

Voraussetzungen: Node 22+, eine Postgres-Datenbank (lokal oder ein kostenloses Neon-Projekt).

```bash
npm install
cp .env.example .env
npm run hash-passwort -- "euer-gruppenpasswort"   # Ausgabe in TOR_PASSWORT_HASH eintragen
openssl rand -base64 48                             # Ausgabe in SESSION_SECRET eintragen
npm run db:migrate                                  # Tabellen + die fünf Bereiche anlegen
npm run dev                                         # http://localhost:4321
```

Tests: `npm test` (Regeln und Hashing). Der Klick-Durchlauf im Browser liegt in `tests/e2e/durchklicken.py`
(Python + Playwright, braucht einen laufenden Dev-Server und eine leere Datenbank).

## Auf Vercel + Neon bringen (wie bei einer normalen Astro-Seite)

1. **Neon:** kostenloses Projekt anlegen, Region Frankfurt (`aws-eu-central-1`). Die **pooled** Verbindungs-URL kopieren.
2. **Migrationen** einmal von deinem Rechner aus: `DATABASE_URL="<neon-url>" npm run db:migrate`
3. **GitHub:** Repo in einer GitHub-Organisation anlegen (nicht nur im eigenen Account), zweite Person als Admin.
4. **Vercel:** Repo importieren, Framework „Astro“ wird erkannt. Unter *Settings → Environment Variables* eintragen:
   `DATABASE_URL`, `TOR_PASSWORT_HASH`, `SESSION_SECRET`, `RUECKSETZ_GENEHMIGER`.
5. Deploy. Fertig. Jeder Push auf `main` geht live, jeder Pull Request bekommt eine Vorschau.

Betrieb (Passwort wechseln, Backups, Notfälle): [`docs/BETRIEB.md`](docs/BETRIEB.md).

## Mudras anpassen

Die 11 Mudras stehen in [`src/lib/mudras.ts`](src/lib/mudras.ts). Aktuell Platzhalter (klassische Fingerzeichen).
**Namen** dürfen jederzeit geändert werden. Die **Reihenfolge** nicht mehr, sobald sich jemand eingetragen hat:
gespeichert wird die Position, nicht der Name.
