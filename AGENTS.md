# Hinweise für KI-Assistenten (Claude, ChatGPT, …)

Lies zuerst `docs/KONZEPT.md`. Dieses Repo ist die einzige Quelle der Wahrheit, nicht frühere Chats.

## Stack
- Astro 7, `output: 'server'`, Adapter `@astrojs/vercel`. Seiten in `src/pages/*.astro`.
- Board und Eingang sind React-Inseln (`src/components/*.tsx`, `client:load`).
- Datenbank: PostgreSQL über **Drizzle ORM** (`src/db/schema.ts`). Kein Prisma (siehe ADR 002).
- Migrationen: `npx drizzle-kit generate --name <name>` erzeugt SQL in `drizzle/`, `npm run db:migrate` spielt sie ein.
- Keine weiteren Abhängigkeiten ohne kurze ADR in `docs/adr/`.

## Regeln, die nicht verletzt werden dürfen
1. **Keine Rollen, keine Ränge.** Jedes aktive Mitglied darf alles. Ausnahmen stehen ausschließlich in `src/lib/regeln.ts`:
   - Abschluss: Eingetragene schließen die eigene Karte nicht selbst ab (`darfVerschieben`).
   - Rücksetzung der Mudra-Folge: nur Namen aus `RUECKSETZ_GENEHMIGER` (`darfRuecksetzungEntscheiden`).
   Neue Ausnahmen nur nach ausdrücklicher Entscheidung der Diplomatie und mit Test.
2. **Keine Zahlen pro Person** (keine Ranglisten, Zähler, Aktivitätsstatistiken).
3. **Nichts löschen**, nur archivieren. Jede Änderung an Karten schreibt in den Verlauf (`src/lib/verlauf.ts`).
4. **Keine vertraulichen Inhalte**, keine E-Mail, keine Discord-IDs speichern.
5. Regeln werden **serverseitig** geprüft (API-Endpunkte), die Oberfläche spiegelt sie nur.

## Konventionen
- Code, Bezeichner und Texte auf Deutsch. Sätze in der Oberfläche kurz, Aktiv, keine Entschuldigungen.
- Endpunkte in `src/pages/api/`, Antworten `{ ok, fehler? }`. Formulare werden per `antwort()` zurückgeleitet.
- Vor jedem Pull Request: `npm run check`, `npm test`, `npm run build`.
- Ein Feature = ein Issue = ein Branch = ein Pull Request. Eine KI schreibt, die andere reviewt, ein Mensch merged.
- Testdaten sind erfunden. Keine echten Mitgliederlisten in Prompts kopieren.
