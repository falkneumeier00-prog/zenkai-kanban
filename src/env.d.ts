/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Gesetzt, wenn jemand das Tor (Gruppenpasswort) passiert hat. */
    torOffen: boolean;
    /** Gesetzt, wenn ein Mitglied angemeldet ist. */
    mitglied: import('./db/schema').Mitglied | null;
  }
}
