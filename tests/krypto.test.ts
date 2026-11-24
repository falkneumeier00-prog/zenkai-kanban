import { describe, it, expect } from 'vitest';
import { hashen, pruefen } from '../src/lib/krypto';

describe('Hashing', () => {
  it('erkennt den richtigen Wert und lehnt falsche ab', async () => {
    const h = await hashen('3-7-1-9-4');
    expect(h.startsWith('scrypt:')).toBe(true);
    expect(await pruefen('3-7-1-9-4', h)).toBe(true);
    expect(await pruefen('3-7-1-9-5', h)).toBe(false);
    expect(await pruefen('x', null)).toBe(false);
  });
  it('erzeugt jedes Mal ein anderes Salz', async () => {
    expect(await hashen('gleich')).not.toBe(await hashen('gleich'));
  });
});
