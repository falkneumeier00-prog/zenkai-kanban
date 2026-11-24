/** Kleine Helfer für API-Endpunkte, die sowohl JSON (Board) als auch Formulare (Archiv, Mitglieder) annehmen. */

export async function liesEingabe(request: Request): Promise<Record<string, unknown>> {
  const typ = request.headers.get('content-type') ?? '';
  if (typ.includes('application/json')) {
    try {
      const daten = await request.json();
      return daten && typeof daten === 'object' ? (daten as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typ.includes('form')) {
    const fd = await request.formData();
    return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '']));
  }
  return {};
}

const istFormular = (request: Request) => !(request.headers.get('content-type') ?? '').includes('application/json');

/** Formulare werden zur vorherigen Seite zurückgeleitet, JSON bekommt JSON. */
export function antwort(request: Request, daten: unknown = { ok: true }, status = 200): Response {
  if (istFormular(request)) {
    const ziel = sichererRuecksprung(request);
    return new Response(null, { status: 303, headers: { Location: ziel } });
  }
  return Response.json(daten, { status });
}

export function fehler(request: Request, meldung: string, status = 400): Response {
  if (istFormular(request)) {
    const ziel = new URL(sichererRuecksprung(request), 'http://x');
    ziel.searchParams.set('fehler', meldung);
    return new Response(null, { status: 303, headers: { Location: ziel.pathname + ziel.search } });
  }
  return Response.json({ ok: false, fehler: meldung }, { status });
}

/** Nur Rücksprünge auf die eigene Seite. */
function sichererRuecksprung(request: Request): string {
  const ref = request.headers.get('referer');
  try {
    if (ref) {
      const r = new URL(ref);
      const eigene = new URL(request.url);
      if (r.host === eigene.host) return r.pathname + r.search.replace(/([?&])fehler=[^&]*&?/, '$1').replace(/[?&]$/, '');
    }
  } catch { /* ignorieren */ }
  return '/board';
}

export function zahl(wert: unknown): number | null {
  const n = typeof wert === 'number' ? wert : typeof wert === 'string' && wert.trim() !== '' ? Number(wert) : NaN;
  return Number.isInteger(n) ? n : null;
}

export function textOderLeer(wert: unknown, max = 5000): string {
  return typeof wert === 'string' ? wert.trim().slice(0, max) : '';
}
