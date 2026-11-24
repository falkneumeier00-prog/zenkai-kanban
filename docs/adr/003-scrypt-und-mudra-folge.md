# ADR 003: Gruppenpasswort + Name + Mudra-Folge, gehasht mit scrypt

**Entscheidung:** Kein E-Mail- oder Discord-Login. Gruppenpasswort am Tor, danach RP-Name plus geheime Folge aus
5 von 11 Mudras (161.051 Möglichkeiten). Beides wird mit `scrypt` aus `node:crypto` gehasht (Format `scrypt:<salz>:<hash>`).

**Warum:** Keine echten Personendaten. Die Mudra-Folge verhindert, dass jemand mit Gruppenpasswort unter fremdem Namen
handelt. `scrypt` ist eingebaut, also keine nativen Zusatzpakete auf Vercel.
Trennzeichen `:` statt `$`, weil `.env`-Dateien `$` als Variable auslegen.

**Folgen:** Sperre nach 5 Fehlversuchen pro Name (15 Minuten), am Tor pro IP. Rücksetzung nur über Genehmigung.
