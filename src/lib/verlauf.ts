import { db, schema } from '../db/client';

type Tx = Pick<typeof db, 'insert'>;

/** Schreibt einen Eintrag in den Verlauf. Nur anfügen, nie ändern. */
export async function protokoll(
  tx: Tx,
  e: { mitgliedId: number | null; karteId?: number | null; aktion: string; details?: Record<string, unknown> },
) {
  await tx.insert(schema.verlauf).values({
    mitgliedId: e.mitgliedId,
    karteId: e.karteId ?? null,
    aktion: e.aktion,
    details: e.details ?? null,
  });
}
