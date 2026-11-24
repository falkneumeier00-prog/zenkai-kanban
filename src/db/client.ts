import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const url = import.meta.env.DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL fehlt (siehe .env.example)');

// Ein kleiner Pool reicht. Auf Vercel + Neon die "pooled" Verbindung verwenden.
const pool = new pg.Pool({ connectionString: url, max: 3 });

export const db = drizzle(pool, { schema });
export { schema };
