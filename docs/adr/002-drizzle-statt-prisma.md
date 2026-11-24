# ADR 002: Drizzle statt Prisma

**Entscheidung:** Drizzle ORM mit `pg`.

**Warum:** Drizzle ist reines TypeScript ohne zusätzliche Engine-Binärdateien. Das macht die Vercel-Funktion klein,
Migrationen sind lesbare SQL-Dateien im Repo, und es läuft auch in Umgebungen ohne Zugriff auf Prisma-Downloads.
Die Schreibweise (`db.select().from(...)`) ist nah an SQL.

**Folgen:** Migrationen mit `drizzle-kit generate`, eingespielt per `npm run db:migrate` (`scripts/migrate.mjs`).
