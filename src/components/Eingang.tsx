import { useMemo, useState } from 'react';
import MudraPad from './MudraPad';
import { MUDRA_LAENGE } from '../lib/mudras';

type Name = { id: number; name: string; bereich: string | null; brauchtNeueFolge: boolean };
type Bereich = { id: number; name: string };
type Modus =
  | { art: 'liste' }
  | { art: 'anmelden'; m: Name }
  | { art: 'neu' }
  | { art: 'neueFolge'; m: Name };

async function senden(url: string, daten: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(daten) });
  return (await r.json().catch(() => ({ ok: false, fehler: 'Unerwartete Antwort.' }))) as { ok: boolean; fehler?: string; meldung?: string; neueFolge?: boolean };
}

export default function Eingang({ namen, bereiche }: { namen: Name[]; bereiche: Bereich[] }) {
  const [modus, setModus] = useState<Modus>({ art: 'liste' });
  const [suche, setSuche] = useState('');
  const [folge, setFolge] = useState<number[]>([]);
  const [folge2, setFolge2] = useState<number[]>([]);
  const [schritt, setSchritt] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [bereichId, setBereichId] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const gefiltert = useMemo(
    () => namen.filter((n) => n.name.toLocaleLowerCase('de').includes(suche.trim().toLocaleLowerCase('de'))),
    [namen, suche],
  );

  function wechsle(m: Modus) {
    setModus(m); setFolge([]); setFolge2([]); setSchritt(1); setFehler(null); setInfo(null);
  }

  async function anmelden(f: number[], m: Name) {
    setLaeuft(true); setFehler(null);
    const r = await senden('/api/eingang/anmelden', { mitgliedId: m.id, folge: f });
    setLaeuft(false);
    if (r.ok) { window.location.href = '/board'; return; }
    if (r.neueFolge) { wechsle({ art: 'neueFolge', m }); return; }
    setFehler(r.fehler ?? 'Das hat nicht geklappt.'); setFolge([]);
  }

  async function festlegen(url: string, daten: Record<string, unknown>) {
    setLaeuft(true); setFehler(null);
    const r = await senden(url, { ...daten, folge, folge2 });
    setLaeuft(false);
    if (r.ok) { window.location.href = '/board'; return; }
    setFehler(r.fehler ?? 'Das hat nicht geklappt.'); setFolge([]); setFolge2([]); setSchritt(1);
  }

  async function vergessen(m: Name) {
    setLaeuft(true);
    const r = await senden('/api/eingang/vergessen', { mitgliedId: m.id });
    setLaeuft(false);
    if (r.ok) setInfo(r.meldung ?? 'Antrag gestellt.'); else setFehler(r.fehler ?? 'Das hat nicht geklappt.');
  }

  /** Zwei Durchgänge: Folge festlegen, dann zur Bestätigung wiederholen. */
  function zweiDurchgaenge(abschicken: () => void) {
    if (schritt === 1) {
      return (
        <>
          <MudraPad folge={folge} onChange={setFolge} beschriftung="Lege deine geheime Folge aus 5 Fingerzeichen fest" deaktiviert={laeuft} />
          <button className="knopf" type="button" disabled={folge.length !== MUDRA_LAENGE} onClick={() => setSchritt(2)}>Weiter</button>
        </>
      );
    }
    return (
      <>
        <MudraPad folge={folge2} onChange={setFolge2} beschriftung="Wiederhole die Folge zur Bestätigung" deaktiviert={laeuft} />
        <div className="reihe">
          <button className="knopf leise" type="button" onClick={() => { setFolge([]); setFolge2([]); setSchritt(1); }}>Von vorn</button>
          <button className="knopf" type="button" disabled={folge2.length !== MUDRA_LAENGE || laeuft} onClick={abschicken}>Folge festlegen</button>
        </div>
      </>
    );
  }

  return (
    <div className="eingang">
      {fehler && <p className="meldung" role="alert">{fehler}</p>}
      {info && <p className="hinweis" role="status">{info}</p>}

      {modus.art === 'liste' && (
        <>
          <h1>Wer bist du, Shinobi?</h1>
          {namen.length > 6 && (
            <label className="feld">
              <span>Namen suchen</span>
              <input type="text" value={suche} onChange={(e) => setSuche(e.target.value)} />
            </label>
          )}
          {namen.length === 0 ? (
            <p className="leer">Noch hat sich niemand eingetragen. Sei die oder der Erste.</p>
          ) : (
            <ul className="namen">
              {gefiltert.map((n) => (
                <li key={n.id}>
                  <button type="button" className="name-knopf" onClick={() => wechsle(n.brauchtNeueFolge ? { art: 'neueFolge', m: n } : { art: 'anmelden', m: n })}>
                    <span className="siegel">{n.name}</span>
                    {n.bereich && <small>{n.bereich}</small>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button className="knopf leise" type="button" onClick={() => wechsle({ art: 'neu' })}>Ich bin neu und trage mich ein</button>
        </>
      )}

      {modus.art === 'anmelden' && (
        <>
          <h1>Willkommen zurück, {modus.m.name}</h1>
          <MudraPad
            folge={folge}
            beschriftung="Schließe deine Fingerzeichen"
            deaktiviert={laeuft}
            onChange={(f) => { setFolge(f); if (f.length === MUDRA_LAENGE) void anmelden(f, modus.m); }}
          />
          <div className="reihe">
            <button className="knopf leise" type="button" onClick={() => wechsle({ art: 'liste' })}>Anderer Name</button>
            <button className="text-knopf" type="button" disabled={laeuft} onClick={() => vergessen(modus.m)}>Mudra-Folge vergessen?</button>
          </div>
        </>
      )}

      {modus.art === 'neu' && (
        <>
          <h1>Neu in der Diplomatie</h1>
          <p className="leise">Trag deinen RP-Namen ein, so wie er im Spiel steht. Alle sehen eine Woche lang, dass du neu dabei bist.</p>
          {schritt === 1 && (
            <div className="formular">
              <label className="feld">
                <span>RP-Name</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={40} />
              </label>
              <label className="feld">
                <span>Bereich (freiwillig)</span>
                <select value={bereichId} onChange={(e) => setBereichId(e.target.value)}>
                  <option value="">Kein bestimmter Bereich</option>
                  {bereiche.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            </div>
          )}
          {name.trim().length >= 2
            ? zweiDurchgaenge(() => festlegen('/api/eingang/eintragen', { name, bereichId: bereichId || null }))
            : <p className="leise">Sobald dein Name steht, legst du deine Mudra-Folge fest.</p>}
          <button className="knopf leise" type="button" onClick={() => wechsle({ art: 'liste' })}>Zurück zur Namensliste</button>
        </>
      )}

      {modus.art === 'neueFolge' && (
        <>
          <h1>Neue Folge für {modus.m.name}</h1>
          <p className="leise">Deine Rücksetzung wurde genehmigt. Lege jetzt eine neue Mudra-Folge fest.</p>
          {zweiDurchgaenge(() => festlegen('/api/eingang/neue-folge', { mitgliedId: modus.m.id }))}
          <button className="knopf leise" type="button" onClick={() => wechsle({ art: 'liste' })}>Anderer Name</button>
        </>
      )}
    </div>
  );
}
