import { useCallback, useEffect, useRef, useState } from 'react';
import type { BoardDaten } from '../lib/board';
import { SPALTEN, SPALTEN_TITEL, darfVerschieben, type SpalteId } from '../lib/regeln';
import { get, post } from './api';

type Karte = BoardDaten['karten'][number];
type Detail = {
  kommentare: { id: number; text: string; erstelltAm: string; zurueckgezogen: boolean; mitgliedId: number }[];
  links: { id: number; titel: string; url: string; mitgliedId: number }[];
  verlauf: { id: number; zeit: string; mitgliedId: number | null; aktion: string; details: Record<string, unknown> | null }[];
};

const FELD_NAMEN: Record<string, string> = {
  titel: 'Titel', beschreibung: 'Beschreibung', bereichId: 'Bereich', projekt: 'Projekt',
  prioritaet: 'Priorität', frist: 'Frist', blockiert: 'Blockiert',
};

function zeit(iso: string) {
  return new Date(iso).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function verlaufText(v: Detail['verlauf'][number]): string {
  const d = v.details ?? {};
  switch (v.aktion) {
    case 'karte_angelegt': return 'hat die Karte angelegt';
    case 'verschoben': return `hat sie von „${SPALTEN_TITEL[d.von as SpalteId]}“ nach „${SPALTEN_TITEL[d.nach as SpalteId]}“ verschoben${d.automatisch ? ' (beim Übernehmen)' : ''}`;
    case 'eingetragen': return d.art === 'hilft_mit' ? 'hilft jetzt mit' : 'macht das jetzt';
    case 'ausgetragen': return 'hat sich ausgetragen';
    case 'bearbeitet': return `hat ${Object.keys((d.nachher as object) ?? {}).map((k) => FELD_NAMEN[k] ?? k).join(', ')} geändert`;
    case 'link_hinzugefuegt': return `hat den Link „${d.titel}“ hinzugefügt`;
    case 'link_entfernt': return `hat den Link „${d.titel}“ entfernt`;
    case 'kommentar_zurueckgezogen': return 'hat einen Kommentar zurückgezogen';
    case 'archiviert': return 'hat die Karte archiviert';
    case 'zurueckgeholt': return 'hat die Karte aus dem Archiv geholt';
    default: return v.aktion;
  }
}

export default function KarteDetail(props: {
  karte: Karte; daten: BoardDaten;
  onSchliessen: () => void; onGeaendert: () => Promise<void> | void; onFehler: (t: string) => void;
}) {
  const { karte: k, daten } = props;
  const ref = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [form, setForm] = useState({
    titel: k.titel, beschreibung: k.beschreibung, bereichId: k.bereichId ? String(k.bereichId) : '',
    projekt: k.projekt ?? '', prioritaet: k.prioritaet, frist: k.frist ?? '', blockiert: k.blockiert,
  });
  const [kommentar, setKommentar] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitel, setLinkTitel] = useState('');
  const [laeuft, setLaeuft] = useState(false);

  const name = (id: number | null) => daten.mitglieder.find((m) => m.id === id)?.name ?? 'Jemand';
  const eintraege = daten.eintraege.filter((e) => e.karteId === k.id);
  const meinEintrag = eintraege.find((e) => e.mitgliedId === daten.ich.id);
  const eingetragene = eintraege.map((e) => e.mitgliedId);
  const bereichName = daten.bereiche.find((b) => b.id === k.bereichId)?.name;

  const laden = useCallback(async () => {
    const d = await get<Detail>(`/api/karten/${k.id}`);
    if (d) setDetail(d);
  }, [k.id]);

  useEffect(() => { ref.current?.showModal(); void laden(); }, [laden]);
  // Nach Änderungen von außen (Polling) Detail mitziehen
  useEffect(() => { void laden(); }, [k.geaendertAm, laden]);

  async function aktion(daten: Record<string, unknown>, danach?: () => void) {
    setLaeuft(true);
    const r = await post(`/api/karten/${k.id}`, daten);
    setLaeuft(false);
    if (!r.ok) { props.onFehler(r.fehler ?? 'Das hat nicht geklappt.'); return false; }
    danach?.();
    await props.onGeaendert();
    await laden();
    return true;
  }

  const spaltenWahl = SPALTEN.map((s) => ({
    s, regel: darfVerschieben({ von: k.spalte, nach: s, mitgliedId: daten.ich.id, eingetragene }),
  }));

  return (
    <dialog ref={ref} className="dialog" onClose={props.onSchliessen} aria-labelledby="karte-titel">
      <div className="dialog-inhalt">
        <div className="detail-kopf">
          <div>
            <p className="leise">{[bereichName, k.projekt].filter(Boolean).join(' / ') || 'Ohne Bereich'}</p>
            <h2 id="karte-titel">{k.titel}</h2>
          </div>
          <button className="schliessen" onClick={() => ref.current?.close()} aria-label="Schließen">×</button>
        </div>

        <section className="detail-block">
          <div className="siegel-reihe gross">
            {eintraege.length === 0 && <span className="leise">Noch niemand eingetragen.</span>}
            {eintraege.map((e) => (
              <span key={e.mitgliedId} className={`siegel${e.art === 'hilft_mit' ? ' hilft' : ''}${e.mitgliedId === daten.ich.id ? ' ich' : ''}`}>
                {name(e.mitgliedId)} {e.art === 'hilft_mit' ? '(hilft mit)' : ''}
              </span>
            ))}
          </div>
          <div className="knopf-reihe">
            {meinEintrag?.art !== 'macht' && (
              <button className="knopf" disabled={laeuft} onClick={() => aktion({ aktion: 'eintragen', art: 'macht' })}>Ich mache das</button>
            )}
            {meinEintrag?.art !== 'hilft_mit' && (
              <button className="knopf leise" disabled={laeuft} onClick={() => aktion({ aktion: 'eintragen', art: 'hilft_mit' })}>Ich helfe mit</button>
            )}
            {meinEintrag && (
              <button className="knopf leise" disabled={laeuft} onClick={() => aktion({ aktion: 'austragen' })}>Austragen</button>
            )}
          </div>
        </section>

        <section className="detail-block">
          <label className="feld">
            <span>Spalte</span>
            <select value={k.spalte} disabled={laeuft} onChange={(e) => aktion({ aktion: 'verschieben', nach: e.target.value })}>
              {spaltenWahl.map(({ s, regel }) => (
                <option key={s} value={s} disabled={!regel.ok}>
                  {SPALTEN_TITEL[s]}{!regel.ok && s === 'erledigt' && k.spalte === 'pruefung' ? ' (ein anderes Mitglied schließt ab)' : ''}
                </option>
              ))}
            </select>
          </label>
          {k.spalte === 'pruefung' && eingetragene.includes(daten.ich.id) && (
            <p className="leise">Du bist eingetragen. Abschließen kann ein anderes Mitglied, nachdem es drübergeschaut hat.</p>
          )}
          {k.spalte === 'pruefung' && !eingetragene.includes(daten.ich.id) && (
            <button className="knopf siegel-knopf" disabled={laeuft} onClick={() => aktion({ aktion: 'verschieben', nach: 'erledigt' })}>
              Geprüft, abschließen
            </button>
          )}
        </section>

        <section className="detail-block">
          {!bearbeiten ? (
            <>
              {k.beschreibung ? <p className="beschreibung">{k.beschreibung}</p> : <p className="leise">Keine Beschreibung.</p>}
              <dl className="eckdaten">
                <div><dt>Priorität</dt><dd>{k.prioritaet === 'hoch' ? 'Hoch' : k.prioritaet === 'niedrig' ? 'Niedrig' : 'Normal'}</dd></div>
                <div><dt>Frist</dt><dd>{k.frist ? new Date(k.frist + 'T12:00:00').toLocaleDateString('de-DE') : 'Keine'}</dd></div>
                <div><dt>Blockiert</dt><dd>{k.blockiert ? 'Ja' : 'Nein'}</dd></div>
                <div><dt>Angelegt</dt><dd>{name(k.erstelltVon)}, {zeit(k.erstelltAm)}</dd></div>
              </dl>
              <button className="knopf klein leise" onClick={() => setBearbeiten(true)}>Bearbeiten</button>
            </>
          ) : (
            <form className="bearbeiten" onSubmit={(e) => { e.preventDefault(); void aktion({ aktion: 'bearbeiten', ...form, bereichId: form.bereichId || null }, () => setBearbeiten(false)); }}>
              <label className="feld"><span>Titel</span>
                <input type="text" name="titel" value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })} required minLength={2} maxLength={140} />
              </label>
              <label className="feld"><span>Beschreibung</span>
                <textarea name="beschreibung" value={form.beschreibung} onChange={(e) => setForm({ ...form, beschreibung: e.target.value })} maxLength={5000} />
              </label>
              <div className="zwei">
                <label className="feld"><span>Bereich</span>
                  <select name="bereichId" value={form.bereichId} onChange={(e) => setForm({ ...form, bereichId: e.target.value })}>
                    <option value="">Ohne Bereich</option>
                    {daten.bereiche.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>
                <label className="feld"><span>Projekt (Schlagwort)</span>
                  <input type="text" name="projekt" list="projekte" value={form.projekt} onChange={(e) => setForm({ ...form, projekt: e.target.value })} maxLength={60} />
                  <datalist id="projekte">
                    {[...new Set(daten.karten.map((x) => x.projekt).filter(Boolean))].map((p) => <option key={p!} value={p!} />)}
                  </datalist>
                </label>
                <label className="feld"><span>Priorität</span>
                  <select name="prioritaet" value={form.prioritaet} onChange={(e) => setForm({ ...form, prioritaet: e.target.value as typeof form.prioritaet })}>
                    <option value="niedrig">Niedrig</option><option value="normal">Normal</option><option value="hoch">Hoch</option>
                  </select>
                </label>
                <label className="feld"><span>Frist</span>
                  <input type="date" name="frist" value={form.frist} onChange={(e) => setForm({ ...form, frist: e.target.value })} />
                </label>
              </div>
              <label className="haken">
                <input type="checkbox" checked={form.blockiert} onChange={(e) => setForm({ ...form, blockiert: e.target.checked })} />
                Blockiert, wartet auf etwas
              </label>
              <div className="knopf-reihe">
                <button type="button" className="knopf leise" onClick={() => setBearbeiten(false)}>Abbrechen</button>
                <button type="submit" className="knopf" disabled={laeuft}>Änderungen speichern</button>
              </div>
            </form>
          )}
        </section>

        <section className="detail-block">
          <h3>Links</h3>
          {detail?.links.length ? (
            <ul className="links">
              {detail.links.map((l) => (
                <li key={l.id}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer nofollow">{l.titel}</a>
                  <button className="text-knopf" onClick={() => aktion({ aktion: 'link_entfernen', linkId: l.id })}>entfernen</button>
                </li>
              ))}
            </ul>
          ) : <p className="leise">Entwürfe bleiben in Google Docs, PDFs oder Discord. Hier steht nur, wo sie liegen.</p>}
          <form className="link-form" onSubmit={(e) => { e.preventDefault(); void aktion({ aktion: 'link', url: linkUrl, titel: linkTitel }, () => { setLinkUrl(''); setLinkTitel(''); }); }}>
            <input type="url" placeholder="https://…" aria-label="Link-Adresse" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} required />
            <input type="text" placeholder="Bezeichnung (freiwillig)" aria-label="Link-Bezeichnung" value={linkTitel} onChange={(e) => setLinkTitel(e.target.value)} maxLength={100} />
            <button className="knopf klein" disabled={laeuft || !linkUrl}>Link hinzufügen</button>
          </form>
        </section>

        <section className="detail-block">
          <h3>Kommentare</h3>
          {detail?.kommentare.length ? (
            <ul className="kommentare">
              {detail.kommentare.map((c) => (
                <li key={c.id}>
                  <div className="kommentar-kopf"><strong>{name(c.mitgliedId)}</strong> <span className="leise">{zeit(c.erstelltAm)}</span></div>
                  {c.zurueckgezogen ? <p className="leise">Zurückgezogen.</p> : <p>{c.text}</p>}
                  {!c.zurueckgezogen && c.mitgliedId === daten.ich.id && (
                    <button className="text-knopf" onClick={() => aktion({ aktion: 'kommentar_zurueckziehen', kommentarId: c.id })}>zurückziehen</button>
                  )}
                </li>
              ))}
            </ul>
          ) : <p className="leise">Noch keine Kommentare.</p>}
          <form className="kommentar-form" onSubmit={(e) => { e.preventDefault(); void aktion({ aktion: 'kommentar', text: kommentar }, () => setKommentar('')); }}>
            <textarea placeholder="Kommentar schreiben" aria-label="Kommentar" value={kommentar} onChange={(e) => setKommentar(e.target.value)} maxLength={2000} />
            <button className="knopf klein" disabled={laeuft || !kommentar.trim()}>Kommentieren</button>
          </form>
        </section>

        <details className="detail-block verlauf">
          <summary>Verlauf</summary>
          <ol>
            {detail?.verlauf.map((v) => (
              <li key={v.id}><span className="leise">{zeit(v.zeit)}</span> <strong>{name(v.mitgliedId)}</strong> {verlaufText(v)}</li>
            ))}
          </ol>
        </details>

        <div className="knopf-reihe ende">
          <button className="knopf leise" disabled={laeuft} onClick={() => aktion({ aktion: 'archivieren' }, () => ref.current?.close())}>Ins Archiv legen</button>
        </div>
      </div>
    </dialog>
  );
}
