// Spielt alle Migrationen aus ./drizzle in die Datenbank aus DATABASE_URL ein.
// Aufruf: npm run db:migrate
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL fehlt'); process.exit(1); }
const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  console.log('Migrationen eingespielt.');
} catch (e) {
  console.error('Migration fehlgeschlagen:', e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
