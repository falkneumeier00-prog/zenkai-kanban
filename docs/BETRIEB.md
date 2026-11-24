# Betrieb

Mindestens **zwei Personen** haben Zugang zu GitHub-Organisation, Vercel-Projekt, Neon-Projekt und Cloudflare R2.

## Gruppenpasswort ändern
1. `npm run hash-passwort -- "neues-passwort"`
2. In Vercel `TOR_PASSWORT_HASH` ersetzen, dann *Redeploy*.
3. Neues Passwort in der Diplomatie verteilen. Eingetragene Mitglieder bleiben angemeldet.

## Genehmiger für Rücksetzungen ändern
`RUECKSETZ_GENEHMIGER` in Vercel anpassen (RP-Namen, kommagetrennt, genau wie in der App), *Redeploy*.

## Notfall: beide Genehmiger länger nicht da
Rücksetzung direkt in der Datenbank (Neon SQL-Editor). Bitte im Discord kurz begründen.
```sql
UPDATE mitglied SET mudra_hash = NULL, fehlversuche = 0, gesperrt_bis = NULL, sitzungs_version = sitzungs_version + 1
WHERE name = 'Name des Mitglieds';
INSERT INTO verlauf (aktion, details) VALUES ('ruecksetzung_technisch', '{"fuer": "Name des Mitglieds"}');
```

## Gesperrtes Tor aufheben (z. B. nach Tippfehlern)
```sql
DELETE FROM tor_versuch;
```

## Backups
Workflow `.github/workflows/backup.yml` läuft jede Nacht: `pg_dump` → mit `age` verschlüsselt → Cloudflare R2.
Benötigte GitHub-Secrets: `DATABASE_URL_DIRECT` (Neon, **nicht** pooled), `AGE_PUBLIC_KEY`,
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
Der private `age`-Schlüssel liegt **offline bei zwei Personen**, nie im Repo.
Aufbewahrung per R2-Lifecycle-Regel (z. B. Objekte nach 90 Tagen löschen).

### Wiederherstellen
```bash
age -d -i schluessel.txt backup-2026-11-24.sql.gz.age | gunzip | psql "<ziel-datenbank-url>"
```
Einmal im Monat in ein leeres Neon-Testprojekt zurückspielen und prüfen, ob die Karten da sind.

## Neue Datenbank-Änderung
`npx drizzle-kit generate --name was-sich-aendert` → SQL in `drizzle/` prüfen → committen →
nach dem Merge `DATABASE_URL="<neon>" npm run db:migrate`.
