import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

const N = 16384, R = 8, P = 1, LAENGE = 32;

function scryptAsync(wert: string, salz: Buffer): Promise<Buffer> {
  return new Promise((res, rej) =>
    scrypt(wert, salz, LAENGE, { N, r: R, p: P }, (err, key) => (err ? rej(err) : res(key))),
  );
}

/** Erzeugt einen Hash im Format scrypt:<salz>:<hash> (beides base64). */
export async function hashen(wert: string): Promise<string> {
  const salz = randomBytes(16);
  const key = await scryptAsync(wert, salz);
  return `scrypt:${salz.toString('base64')}:${key.toString('base64')}`;
}

export async function pruefen(wert: string, gespeichert: string | null | undefined): Promise<boolean> {
  if (!gespeichert) return false;
  const [art, salzB64, hashB64] = gespeichert.split(':');
  if (art !== 'scrypt' || !salzB64 || !hashB64) return false;
  const erwartet = Buffer.from(hashB64, 'base64');
  const key = await scryptAsync(wert, Buffer.from(salzB64, 'base64'));
  return key.length === erwartet.length && timingSafeEqual(key, erwartet);
}
