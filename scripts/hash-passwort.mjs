// Erzeugt den Hash für TOR_PASSWORT_HASH.
// Aufruf: npm run hash-passwort -- "euer-gruppenpasswort"
import { scrypt, randomBytes } from 'node:crypto';

const passwort = process.argv[2];
if (!passwort || passwort.length < 8) {
  console.error('Bitte ein Passwort mit mindestens 8 Zeichen angeben: npm run hash-passwort -- "…"');
  process.exit(1);
}
const salz = randomBytes(16);
scrypt(passwort, salz, 32, { N: 16384, r: 8, p: 1 }, (err, key) => {
  if (err) throw err;
  console.log(`scrypt:${salz.toString('base64')}:${key.toString('base64')}`);
});
