import { SignJWT, jwtVerify } from 'jose';
import type { AstroCookies } from 'astro';
import { pflichtEnv, env } from './umgebung';

export const TOR_COOKIE = 'dipl_tor';
export const SHINOBI_COOKIE = 'dipl_shinobi';
const TOR_DAUER_S = 30 * 60; // 30 Minuten zwischen Tor und Namenswahl
const SHINOBI_DAUER_S = 90 * 24 * 60 * 60; // 90 Tage angemeldet bleiben

function schluessel(): Uint8Array {
  const s = pflichtEnv('SESSION_SECRET');
  if (s.length < 32) throw new Error('SESSION_SECRET muss mindestens 32 Zeichen haben.');
  return new TextEncoder().encode(s);
}

const istProduktion = () => env('NODE_ENV') === 'production' || env('VERCEL') === '1';

function cookieOptionen(maxAge: number) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: istProduktion(), path: '/', maxAge };
}

export async function torOeffnen(cookies: AstroCookies) {
  const jwt = await new SignJWT({ t: 'tor' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOR_DAUER_S}s`)
    .sign(schluessel());
  cookies.set(TOR_COOKIE, jwt, cookieOptionen(TOR_DAUER_S));
}

export async function torIstOffen(cookies: AstroCookies): Promise<boolean> {
  const wert = cookies.get(TOR_COOKIE)?.value;
  if (!wert) return false;
  try {
    const { payload } = await jwtVerify(wert, schluessel());
    return payload.t === 'tor';
  } catch {
    return false;
  }
}

export async function anmelden(cookies: AstroCookies, mitgliedId: number, sitzungsVersion: number) {
  const jwt = await new SignJWT({ t: 'm', mid: mitgliedId, v: sitzungsVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SHINOBI_DAUER_S}s`)
    .sign(schluessel());
  cookies.set(SHINOBI_COOKIE, jwt, cookieOptionen(SHINOBI_DAUER_S));
  // Wer angemeldet ist, hat das Tor auch passiert; so muss niemand nach 30 Minuten neu durchs Tor.
  cookies.set(TOR_COOKIE, await new SignJWT({ t: 'tor' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${SHINOBI_DAUER_S}s`).sign(schluessel()),
    cookieOptionen(SHINOBI_DAUER_S));
}

export async function leseAnmeldung(cookies: AstroCookies): Promise<{ mitgliedId: number; version: number } | null> {
  const wert = cookies.get(SHINOBI_COOKIE)?.value;
  if (!wert) return null;
  try {
    const { payload } = await jwtVerify(wert, schluessel());
    if (payload.t !== 'm' || typeof payload.mid !== 'number' || typeof payload.v !== 'number') return null;
    return { mitgliedId: payload.mid, version: payload.v };
  } catch {
    return null;
  }
}

export function abmelden(cookies: AstroCookies) {
  cookies.delete(SHINOBI_COOKIE, { path: '/' });
}
