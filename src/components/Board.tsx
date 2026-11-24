import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import type { BoardDaten } from '../lib/board';
import { SPALTEN, SPALTEN_TITEL, type SpalteId } from '../lib/regeln';
import { get, post } from './api';
import KarteDetail from './KarteDetail';

type Karte = BoardDaten['karten'][number];

const SPALTEN_HINWEIS: Record<SpalteId, string> = {
  idee: 'Vorschläge, über die noch gesprochen wird',
  offen: 'Steht fest, sucht noch jemanden',
  in_arbeit: 'Jemand ist dran',
  pruefung: 'Fertig, ein anderes Mitglied schaut drüber',
  erledigt: 'Verschwindet nach 14 Tagen ins Archiv',
};

function fristText(frist: string | null) {
  if (!frist) return null;
  const d = new Date(frist + 'T12:00:00');
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const tage = Math.round((d.getTime() - heute.getTime()) / 86_400_000);
  const datum = d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  return { datum, ueberfaellig: tage < 0, bald: tage >= 0 && tage <= 3 };
}

export default function Board({ start }: { start: BoardDaten }) {
  const [daten, setDaten] = useState(start);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [offenId, setOffenId] = useState<number | null>(null);
  const [aktiveSpalte, setAktiveSpalte] = useState<SpalteId>('in_arbeit');
  const [suche, setSuche] = useState('');
  const [bereichF, setBereichF] = useState('');
  const [personF, setPersonF] = useState('');
  const [prioF, setPrioF] = useState('');
  const [projektF, setProjektF] = useState('');
  const [neuOffen, setNeuOffen] = useState(false);
  const meldungTimer = useRef<number | undefined>(undefined);

  const zeige = useCallback((t: string) => {
    setMeldung(t);
    window.clearTimeout(meldungTimer.current);
    meldungTimer.current = window.setTimeout(() => setMeldung(null), 6000);
  }, []);

  const neuLaden = useCallback(async () => {
    const d = await get<BoardDaten>('/api/board');
    if (d) setDaten(d);
  }, []);

  // Alle 30 Sekunden auffrischen, solange die Seite sichtbar ist
  useEffect(() => {
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void neuLaden(); }, 30_000);
    const sichtbar = () => { if (document.visibilityState === 'visible') void neuLaden(); };
    document.addEventListener('visibilitychange', sichtbar);
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', sichtbar); };
  }, [neuLaden]);

  const mitgliedName = useMemo(() => new Map(daten.mitglieder.map((m) => [m.id, m.name])), [daten.mitglieder]);
  const mitgliedStatus = useMemo(() => new Map(daten.mitglieder.map((m) => [m.id, m.status])), [daten.mitglieder]);
  const bereich = useMemo(() => new Map(daten.bereiche.map((b) => [b.id, b])), [daten.bereiche]);
  const eintraegeVon = useMemo(() => {
    const map = new Map<number, { mitgliedId: number; art: string }[]>();
    for (const e of daten.eintraege) map.set(e.karteId, [...(map.get(e.karteId) ?? []), e]);
    return map;
  }, [daten.eintraege]);
  const projekte = useMemo(
    () => [...new Set(daten.karten.map((k) => k.projekt).filter((p): p is string => !!p))].sort((a, b) => a.localeCompare(b, 'de')),
    [daten.karten],
  );
  const aktiveMitglieder = daten.mitglieder.filter((m) => m.status === 'aktiv');

  const sichtbar = useMemo(() => {
    const s = suche.trim().toLocaleLowerCase('de');
    return daten.karten.filter((k) => {
      if (bereichF && String(k.bereichId ?? '') !== bereichF) return false;
      if (prioF && k.prioritaet !== prioF) return false;
      if (projektF && k.projekt !== projektF) return false;
      if (personF) {
        const id = Number(personF);
        if (!(eintraegeVon.get(k.id) ?? []).some((e) => e.mitgliedId === id)) return false;
      }
      if (s && !`${k.titel} ${k.beschreibung} ${k.projekt ?? ''}`.toLocaleLowerCase('de').includes(s)) return false;
      return true;
    });
  }, [daten.karten, suche, bereichF, prioF, projektF, personF, eintraegeVon]);

  const filterAktiv = !!(suche || bereichF || personF || prioF || projektF);

  async function verschiebe(k: Karte, nach: SpalteId) {
    if (k.spalte === nach) return;
    const vorher = daten;
    setDaten({ ...daten, karten: daten.karten.map((x) => (x.id === k.id ? { ...x, spalte: nach, position: -1e9 } : x)) });
    const r = await post(`/api/karten/${k.id}`, { aktion: 'verschieben', nach });
    if (!r.ok) { setDaten(vorher); zeige(r.fehler ?? 'Verschieben hat nicht geklappt.'); }
    void neuLaden();
  }

  async function entscheide(antragId: number, entscheidung: 'genehmigt' | 'abgelehnt') {
    const r = await post(`/api/antraege/${antragId}`, { entscheidung });
    if (!r.ok) zeige(r.fehler ?? 'Das hat nicht geklappt.');
    void neuLaden();
  }

  const sensoren = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
  );

  function onDragEnd(ev: DragEndEvent) {
    const k = daten.karten.find((x) => `karte-${x.id}` === ev.active.id);
    const nach = ev.over?.id as SpalteId | undefined;
    if (k && nach && SPALTEN.includes(nach)) void verschiebe(k, nach);
  }

  const offeneKarte = offenId ? daten.karten.find((k) => k.id === offenId) : undefined;

  return (
    <div className="board-seite">
      {meldung && <div className="toast" role="alert" onClick={() => setMeldung(null)}>{meldung}</div>}

      {(daten.neuDabei.length > 0 || daten.antraege.length > 0) && (
        <section className="aushang" aria-label="Aushang">
          {daten.neuDabei.length > 0 && (
            <p>
              <strong>Neu dabei:</strong>{' '}
              {daten.neuDabei.map((m) => <span key={m.id} className="siegel">{m.name}</span>)}{' '}
              <a href="/mitglieder">Gehört jemand nicht dazu?</a>
            </p>
          )}
          {daten.antraege.map((a) => (
            <div key={a.id} className="antrag">
              <span><strong>{a.name}</strong> möchte die Mudra-Folge zurücksetzen. Frag vorher per Discord nach, ob der Antrag wirklich von {a.name} kommt.</span>
              <span className="antrag-knoepfe">
                <button className="knopf klein" onClick={() => entscheide(a.id, 'genehmigt')}>Genehmigen</button>
                <button className="knopf klein leise" onClick={() => entscheide(a.id, 'abgelehnt')}>Ablehnen</button>
              </span>
            </div>
          ))}
        </section>
      )}

      <div className="werkzeuge">
        <button className="knopf" onClick={() => setNeuOffen(true)}>Neue Karte</button>
        <input type="search" placeholder="Suchen" aria-label="Karten durchsuchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
        <select aria-label="Bereich" value={bereichF} onChange={(e) => setBereichF(e.target.value)}>
          <option value="">Alle Bereiche</option>
          {daten.bereiche.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select aria-label="Person" value={personF} onChange={(e) => setPersonF(e.target.value)}>
          <option value="">Alle Personen</option>
          <option value={daten.ich.id}>Nur meine Karten</option>
          {aktiveMitglieder.filter((m) => m.id !== daten.ich.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select aria-label="Priorität" value={prioF} onChange={(e) => setPrioF(e.target.value)}>
          <option value="">Jede Priorität</option>
          <option value="hoch">Hoch</option>
          <option value="normal">Normal</option>
          <option value="niedrig">Niedrig</option>
        </select>
        {projekte.length > 0 && (
          <select aria-label="Projekt" value={projektF} onChange={(e) => setProjektF(e.target.value)}>
            <option value="">Alle Projekte</option>
            {projekte.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {filterAktiv && (
          <button className="knopf klein leise" onClick={() => { setSuche(''); setBereichF(''); setPersonF(''); setPrioF(''); setProjektF(''); }}>
            Filter zurücksetzen
          </button>
        )}
      </div>

      <nav className="spalten-reiter" aria-label="Spalte wählen">
        {SPALTEN.map((s) => (
          <button key={s} aria-pressed={aktiveSpalte === s} onClick={(e) => { setAktiveSpalte(s); e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }}>
            {SPALTEN_TITEL[s]} <span>{sichtbar.filter((k) => k.spalte === s).length}</span>
          </button>
        ))}
      </nav>

      <DndContext sensors={sensoren} onDragEnd={onDragEnd}>
        <div className="spalten">
          {SPALTEN.map((s) => {
            const karten = sichtbar.filter((k) => k.spalte === s).sort((a, b) => a.position - b.position);
            return (
              <Spalte key={s} id={s} aktiv={aktiveSpalte === s} anzahl={karten.length}>
                {karten.length === 0 && <p className="spalte-leer">{filterAktiv ? 'Keine Karte passt zum Filter.' : SPALTEN_HINWEIS[s]}</p>}
                {karten.map((k) => (
                  <KarteKachel
                    key={k.id}
                    k={k}
                    farbe={k.bereichId ? bereich.get(k.bereichId)?.farbe : undefined}
                    bereichName={k.bereichId ? bereich.get(k.bereichId)?.name : undefined}
                    eintraege={(eintraegeVon.get(k.id) ?? []).map((e) => ({
                      ...e, name: mitgliedName.get(e.mitgliedId) ?? '?', status: mitgliedStatus.get(e.mitgliedId),
                    }))}
                    ichId={daten.ich.id}
                    kommentare={daten.kommentarZahlen[k.id] ?? 0}
                    onOeffnen={() => setOffenId(k.id)}
                  />
                ))}
              </Spalte>
            );
          })}
        </div>
      </DndContext>

      {neuOffen && (
        <NeueKarte
          bereiche={daten.bereiche}
          onSchliessen={() => setNeuOffen(false)}
          onAngelegt={async () => { setNeuOffen(false); await neuLaden(); }}
          onFehler={zeige}
        />
      )}

      {offeneKarte && (
        <KarteDetail
          karte={offeneKarte}
          daten={daten}
          onSchliessen={() => setOffenId(null)}
          onGeaendert={neuLaden}
          onFehler={zeige}
        />
      )}
    </div>
  );
}

function Spalte({ id, aktiv, anzahl, children }: { id: SpalteId; aktiv: boolean; anzahl: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} className={`spalte${aktiv ? ' aktiv' : ''}${isOver ? ' drueber' : ''}`} data-spalte={id} aria-label={SPALTEN_TITEL[id]}>
      <header className="spalte-kopf">
        <h2>{SPALTEN_TITEL[id]}</h2>
        <span className="anzahl" aria-label={`${anzahl} Karten`}>{anzahl}</span>
      </header>
      <div className="spalte-inhalt">{children}</div>
    </section>
  );
}

function KarteKachel(props: {
  k: Karte; farbe?: string; bereichName?: string; ichId: number; kommentare: number;
  eintraege: { mitgliedId: number; art: string; name: string; status?: string }[];
  onOeffnen: () => void;
}) {
  const { k, farbe, bereichName, eintraege, ichId, kommentare, onOeffnen } = props;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `karte-${k.id}` });
  const stil = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  const frist = fristText(k.frist);
  return (
    <article
      ref={setNodeRef}
      style={{ ...stil, borderLeftColor: farbe ?? 'var(--linie)' }}
      className={`karte${isDragging ? ' zieht' : ''}${k.blockiert ? ' blockiert' : ''}${k.spalte === 'erledigt' ? ' erledigt' : ''}`}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={`Karte ${k.titel} öffnen`}
      onClick={onOeffnen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOeffnen(); } }}
    >
      <div className="karte-meta">
        {bereichName && <span>{bereichName}</span>}
        {k.projekt && <span className="projekt">{k.projekt}</span>}
      </div>
      <h3>{k.titel}</h3>
      {(k.prioritaet === 'hoch' || k.blockiert || frist) && (
        <div className="karte-marken">
          {k.prioritaet === 'hoch' && <span className="marke hoch">Wichtig</span>}
          {k.blockiert && <span className="marke blockiert">Blockiert</span>}
          {frist && <span className={`marke frist${frist.ueberfaellig ? ' ueber' : frist.bald ? ' bald' : ''}`}>bis {frist.datum}</span>}
        </div>
      )}
      <div className="karte-fuss">
        <div className="siegel-reihe">
          {eintraege.length === 0 && k.spalte !== 'idee' && <span className="frei">Sucht jemanden</span>}
          {eintraege.map((e) => (
            <span
              key={e.mitgliedId}
              className={`siegel${e.art === 'hilft_mit' ? ' hilft' : ''}${e.mitgliedId === ichId ? ' ich' : ''}`}
              title={`${e.name} ${e.art === 'hilft_mit' ? 'hilft mit' : 'macht das'}${e.status === 'gefallen' ? ' (gefallen)' : ''}`}
            >
              {e.status === 'gefallen' ? '✝ ' : ''}{e.name}
            </span>
          ))}
        </div>
        {kommentare > 0 && <span className="kommentar-zahl" aria-label={`${kommentare} Kommentare`}>💬 {kommentare}</span>}
      </div>
    </article>
  );
}

function NeueKarte(props: {
  bereiche: BoardDaten['bereiche'];
  onSchliessen: () => void; onAngelegt: () => void; onFehler: (t: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [titel, setTitel] = useState('');
  const [bereichId, setBereichId] = useState('');
  const [spalte, setSpalte] = useState<'idee' | 'offen'>('offen');
  const [ichMache, setIchMache] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);

  async function anlegen(e: { preventDefault: () => void }) {
    e.preventDefault();
    setLaeuft(true);
    const r = await post('/api/karten', { titel, bereichId: bereichId || null, spalte, ichMacheMit: ichMache });
    setLaeuft(false);
    if (r.ok) props.onAngelegt(); else props.onFehler(r.fehler ?? 'Anlegen hat nicht geklappt.');
  }

  return (
    <dialog ref={ref} className="dialog klein" onClose={props.onSchliessen} aria-labelledby="neu-titel">
      <form onSubmit={anlegen} className="dialog-inhalt">
        <h2 id="neu-titel">Neue Karte</h2>
        <p className="leise">Nur Aufgaben, keine vertraulichen Inhalte.</p>
        <label className="feld">
          <span>Worum geht es?</span>
          <input type="text" value={titel} onChange={(e) => setTitel(e.target.value)} required minLength={2} maxLength={140} autoFocus />
        </label>
        <div className="zwei">
          <label className="feld">
            <span>Bereich</span>
            <select value={bereichId} onChange={(e) => setBereichId(e.target.value)}>
              <option value="">Ohne Bereich</option>
              {props.bereiche.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="feld">
            <span>Wohin?</span>
            <select value={spalte} onChange={(e) => setSpalte(e.target.value as 'idee' | 'offen')}>
              <option value="offen">Offen: steht fest</option>
              <option value="idee">Idee: erst besprechen</option>
            </select>
          </label>
        </div>
        <label className="haken">
          <input type="checkbox" checked={ichMache} onChange={(e) => setIchMache(e.target.checked)} />
          Ich übernehme das selbst
        </label>
        <div className="dialog-knoepfe">
          <button type="button" className="knopf leise" onClick={() => ref.current?.close()}>Abbrechen</button>
          <button type="submit" className="knopf" disabled={laeuft || titel.trim().length < 2}>Karte anlegen</button>
        </div>
      </form>
    </dialog>
  );
}
