import { MUDRAS, MUDRA_LAENGE } from '../lib/mudras';

type Props = {
  folge: number[];
  onChange: (folge: number[]) => void;
  beschriftung: string;
  deaktiviert?: boolean;
};

/** 11 Kacheln in fester Anordnung. Man tippt die Folge, Punkte zeigen den Fortschritt. */
export default function MudraPad({ folge, onChange, beschriftung, deaktiviert }: Props) {
  const voll = folge.length >= MUDRA_LAENGE;
  return (
    <div className="mudra">
      <div className="mudra-kopf">
        <span id="mudra-titel">{beschriftung}</span>
        <div className="mudra-punkte" aria-live="polite" aria-label={`${folge.length} von ${MUDRA_LAENGE} Fingerzeichen`}>
          {Array.from({ length: MUDRA_LAENGE }, (_, i) => (
            <span key={i} className={i < folge.length ? 'punkt voll' : 'punkt'} aria-hidden="true">
              {i < folge.length ? '●' : ''}
            </span>
          ))}
        </div>
      </div>
      <div className="mudra-raster" role="group" aria-labelledby="mudra-titel">
        {MUDRAS.map((m, i) => (
          <button
            key={m.name}
            type="button"
            className="mudra-kachel"
            disabled={deaktiviert || voll}
            onClick={() => onChange([...folge, i])}
          >
            <span className="zeichen" aria-hidden="true">{m.zeichen}</span>
            <span className="name">{m.name}</span>
          </button>
        ))}
        <button
          type="button"
          className="mudra-kachel zurueck"
          disabled={deaktiviert || folge.length === 0}
          onClick={() => onChange(folge.slice(0, -1))}
          aria-label="Letztes Zeichen zurücknehmen"
        >
          <span className="zeichen" aria-hidden="true">↶</span>
          <span className="name">Zurück</span>
        </button>
      </div>
    </div>
  );
}
