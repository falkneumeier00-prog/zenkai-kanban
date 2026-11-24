# ADR 001: Astro statt Next.js

**Entscheidung:** Astro 7 im Server-Modus mit `@astrojs/vercel`, Board als React-Insel.

**Warum:** Gleicher Ablauf wie bei bereits betreuten Astro-Seiten auf Vercel (Push → Deploy). Die meisten Seiten
(Tor, Mitglieder, Archiv) sind einfache Serverseiten mit Formularen; nur Board und Eingang brauchen React.

**Folgen:** Anmeldung über ein signiertes Cookie (`jose`), nicht über Astro Sessions, weil diese auf Vercel einen
zusätzlichen Speicher (z. B. Redis) bräuchten.
