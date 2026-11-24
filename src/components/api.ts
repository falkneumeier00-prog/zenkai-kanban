export type Antwort<T = unknown> = { ok: boolean; fehler?: string } & T;

export async function post<T = unknown>(url: string, daten: unknown): Promise<Antwort<T>> {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(daten),
    });
    if (r.status === 401) { window.location.href = '/wer-bist-du'; return { ok: false, fehler: 'Abgemeldet.' } as Antwort<T>; }
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok && j.ok !== false, ...j };
  } catch {
    return { ok: false, fehler: 'Keine Verbindung. Bitte gleich nochmal versuchen.' } as Antwort<T>;
  }
}

export async function get<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (r.status === 401) { window.location.href = '/wer-bist-du'; return null; }
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}
