import re, sys, json
from playwright.sync_api import sync_playwright, expect

import os
BASIS = os.environ.get("BASIS", "http://localhost:4321")
PW = os.environ.get("TOR_PASSWORT", "konoha-test-123")
MUDRAS = ["Ratte","Ochse","Tiger","Hase","Drache","Schlange","Pferd","Widder","Affe","Vogel","Hund"]
schritte = []
def hydriert(page):
    page.wait_for_selector("astro-island:not([ssr])", state="attached")

def ok(t): schritte.append("OK  " + t); print("OK ", t, flush=True)

def tippe(page, folge):
    for i in folge:
        page.locator(".mudra-kachel", has_text=MUDRAS[i]).click()

def durchs_tor(page):
    page.goto(BASIS + "/")
    page.fill("input[name=passwort]", PW)
    page.get_by_role("button", name="Eintreten").click()
    page.wait_for_url("**/wer-bist-du"); hydriert(page)

def eintragen(page, name, folge, bereich=None):
    durchs_tor(page)
    page.get_by_role("button", name="Ich bin neu und trage mich ein").click()
    page.get_by_label("RP-Name").fill(name)
    if bereich: page.get_by_label("Bereich (freiwillig)").select_option(label=bereich)
    tippe(page, folge); page.get_by_role("button", name="Weiter").click()
    tippe(page, folge); page.get_by_role("button", name="Folge festlegen").click()
    page.wait_for_url("**/board"); hydriert(page)

def neue_karte(page, titel, bereich, wohin="offen", selbst=False):
    page.get_by_role("button", name="Neue Karte").click()
    page.get_by_label("Worum geht es?").fill(titel)
    page.locator("dialog[open]").get_by_label("Bereich").select_option(label=bereich)
    page.get_by_label("Wohin?").select_option(wohin)
    if selbst: page.get_by_label("Ich übernehme das selbst").check()
    page.get_by_role("button", name="Karte anlegen").click()
    expect(page.locator(".karte", has_text=titel)).to_be_visible()

with sync_playwright() as p:
    browser = p.chromium.launch(args=["--no-sandbox"])
    tsu_ctx = browser.new_context(viewport={"width": 1440, "height": 900}, locale="de-DE")
    tsu = tsu_ctx.new_page()
    fehler_konsole = []
    tsu.on("pageerror", lambda e: fehler_konsole.append(str(e)))

    # 1. Tor
    tsu.goto(BASIS + "/board"); assert tsu.url.rstrip("/") == BASIS, tsu.url; ok("Board ohne Anmeldung leitet zum Tor")
    tsu.screenshot(path="tests/e2e/shots/01_tor.png")
    tsu.fill("input[name=passwort]", "falsch"); tsu.get_by_role("button", name="Eintreten").click()
    expect(tsu.get_by_role("alert")).to_contain_text("stimmt nicht"); ok("Falsches Passwort wird abgelehnt")

    # 2. Eintragen
    eintragen(tsu, "Tsukumo Himura", [0, 4, 4, 9, 2], "Innendienst"); ok("Tsukumo trägt sich ein und landet auf dem Board")
    for t, b, w, s in [
        ("Friedensvertrag Konoha–Suna zur Prüfung vorbereiten", "Innendienst", "offen", False),
        ("Claninformationen: Ansprechpartner sammeln", "Übergreifend", "offen", False),
        ("Schutzbegleitung für Verhandlung in Suna planen", "Schutzdivision", "offen", False),
        ("Diplomatiearchiv: alte Berichte sichern", "Innendienst", "idee", False),
        ("Leitfaden für Nachwuchs-Diplomaten", "Übergreifend", "idee", True),
        ("Handelsabkommen Konoha–Suna entwerfen", "Botschafter", "offen", False),
    ]:
        neue_karte(tsu, t, b, w, s)
    ok("Sechs Karten angelegt")

    # 3. Karte übernehmen und bis Prüfung bringen
    tsu.locator(".karte", has_text="Friedensvertrag").click()
    tsu.get_by_role("button", name="Ich mache das").click()
    expect(tsu.locator("dialog[open] select").first).to_have_value("in_arbeit"); ok("„Ich mache das“ bringt offene Karte in Bearbeitung")
    tsu.get_by_role("button", name="Bearbeiten").click()
    tsu.locator("dialog[open] [name=beschreibung]").fill("Artikel VIII: nur der jeweilige Kage kündigt, ein voller Kalendermonat Frist.")
    tsu.locator("dialog[open] [name=projekt]").fill("Frieden mit Suna")
    tsu.locator("dialog[open] [name=prioritaet]").select_option("hoch")
    tsu.locator("dialog[open] [name=frist]").fill("2026-12-05")
    tsu.get_by_role("button", name="Änderungen speichern").click()
    expect(tsu.locator("dialog[open] .beschreibung")).to_contain_text("Artikel VIII"); ok("Karte bearbeitet")
    tsu.get_by_placeholder("https://…").fill("https://docs.google.com/document/d/beispiel")
    tsu.get_by_placeholder("Bezeichnung (freiwillig)").fill("Vertragsentwurf v7")
    tsu.get_by_role("button", name="Link hinzufügen").click()
    expect(tsu.get_by_role("link", name="Vertragsentwurf v7")).to_be_visible(); ok("Link hinzugefügt")
    tsu.get_by_label("Kommentar").fill("Kündigungsfrist ist jetzt ein voller Kalendermonat.")
    tsu.get_by_role("button", name="Kommentieren").click()
    expect(tsu.locator(".kommentare")).to_contain_text("Kalendermonat"); ok("Kommentar geschrieben")
    tsu.locator("dialog[open] select").first.select_option("pruefung")
    expect(tsu.locator("dialog[open] select").first).to_have_value("pruefung")
    expect(tsu.locator("dialog[open] option[value=erledigt]")).to_have_attribute("disabled", ""); ok("Eigene Karte: „Abgeschlossen“ ist gesperrt")
    tsu.locator("dialog[open] summary", has_text="Verlauf").click()
    tsu.screenshot(path="tests/e2e/shots/04_karte_detail.png", full_page=True)
    tsu.get_by_role("button", name="Schließen").click()

    # API direkt: selbst abschließen muss scheitern
    kid = tsu.evaluate("""async () => { const r = await fetch('/api/board'); const d = await r.json(); return d.karten.find(k => k.titel.startsWith('Friedensvertrag')).id }""")
    st = tsu.evaluate(f"""async () => (await fetch('/api/karten/{kid}', {{method:'POST', headers:{{'content-type':'application/json'}}, body: JSON.stringify({{aktion:'verschieben', nach:'erledigt'}})}})).status""")
    assert st == 403, st; ok("Server lehnt Selbst-Abschluss ab (403)")

    # weitere Karte per Drag & Drop
    karte = tsu.locator(".karte", has_text="Claninformationen")
    ziel = tsu.locator('section.spalte[data-spalte="in_arbeit"]')
    kb = karte.bounding_box(); zb = ziel.bounding_box()
    tsu.mouse.move(kb["x"] + 40, kb["y"] + 20); tsu.mouse.down()
    tsu.mouse.move(kb["x"] + 60, kb["y"] + 30, steps=5)
    tsu.mouse.move(zb["x"] + zb["width"]/2, zb["y"] + 120, steps=15); tsu.mouse.up()
    expect(tsu.locator('section.spalte[data-spalte="in_arbeit"] .karte', has_text="Claninformationen")).to_be_visible(); ok("Drag & Drop zwischen Spalten")

    # 4. Hinabi schließt ab
    hin_ctx = browser.new_context(viewport={"width": 1440, "height": 900}, locale="de-DE")
    hin = hin_ctx.new_page()
    eintragen(hin, "Hinabi Kazan", [10, 10, 1, 7, 3], "Innendienst"); ok("Hinabi trägt sich ein")
    hin.locator(".karte", has_text="Friedensvertrag").click()
    hin.get_by_role("button", name="Geprüft, abschließen").click()
    expect(hin.locator("dialog[open] select").first).to_have_value("erledigt"); ok("Hinabi schließt Tsukumos Karte ab")
    hin.get_by_role("button", name="Schließen").click()
    hin.locator(".karte", has_text="Schutzbegleitung").click()
    hin.get_by_role("button", name="Ich helfe mit").click()
    hin.get_by_role("button", name="Schließen").click()
    hin.screenshot(path="tests/e2e/shots/03_board_desktop.png", full_page=True)

    # 5. Mudra vergessen -> Antrag -> Genehmigung -> neue Folge
    tsu.reload(); hydriert(tsu); tsu.get_by_role("button", name="Abmelden").click(); tsu.wait_for_url("**/wer-bist-du"); hydriert(tsu)
    tsu.screenshot(path="tests/e2e/shots/02_wer_bist_du.png")
    tsu.locator(".name-knopf", has_text="Tsukumo Himura").click()
    tsu.screenshot(path="tests/e2e/shots/02b_mudra.png")
    tsu.get_by_role("button", name="Mudra-Folge vergessen?").click()
    expect(tsu.get_by_role("status")).to_contain_text("Antrag gestellt"); ok("Rücksetzantrag gestellt")
    hin.reload(); hydriert(hin)
    expect(hin.locator(".antrag")).to_contain_text("Tsukumo Himura")
    hin.get_by_role("button", name="Genehmigen").click()
    expect(hin.locator(".antrag")).to_have_count(0); ok("Hinabi genehmigt den Antrag")
    tsu.reload(); hydriert(tsu); tsu.locator(".name-knopf", has_text="Tsukumo Himura").click()
    expect(tsu.get_by_role("heading")).to_contain_text("Neue Folge")
    tippe(tsu, [3, 3, 3, 1, 0]); tsu.get_by_role("button", name="Weiter").click()
    tippe(tsu, [3, 3, 3, 1, 0]); tsu.get_by_role("button", name="Folge festlegen").click()
    tsu.wait_for_url("**/board"); hydriert(tsu); ok("Neue Folge festgelegt, wieder angemeldet")

    # 6. Fremder Name ohne Rechte: darf nicht genehmigen; Sperre nach 5 Fehlversuchen
    fr_ctx = browser.new_context(viewport={"width": 390, "height": 844}, locale="de-DE", is_mobile=True, has_touch=True)
    fr = fr_ctx.new_page()
    eintragen(fr, "Hogiki Itami", [5, 6, 7, 8, 9], "Schutzdivision"); ok("Drittes Mitglied (Handy) trägt sich ein")
    fr.screenshot(path="tests/e2e/shots/05_board_handy.png", full_page=True)
    fr.get_by_role("button", name=re.compile("^In Bearbeitung")).click()
    fr.screenshot(path="tests/e2e/shots/06_board_handy_in_bearbeitung.png", full_page=True)
    fr.get_by_role("button", name="Abmelden").click(); fr.wait_for_url("**/wer-bist-du"); hydriert(fr)
    fr.locator(".name-knopf", has_text="Tsukumo Himura").click()
    for _ in range(5):
        tippe(fr, [0, 0, 0, 0, 0])
        fr.wait_for_timeout(400)
    expect(fr.get_by_role("alert")).to_contain_text("gesperrt"); ok("Nach 5 Fehlversuchen gesperrt")
    tippe(fr, [3, 3, 3, 1, 0]); fr.wait_for_timeout(400)
    expect(fr.get_by_role("alert")).to_contain_text("gesperrt"); ok("Auch die richtige Folge geht während der Sperre nicht")
    fr.screenshot(path="tests/e2e/shots/07_sperre_handy.png")

    # 7. Mitgliederliste
    tsu.goto(BASIS + "/mitglieder"); tsu.screenshot(path="tests/e2e/shots/08_mitglieder.png", full_page=True)
    expect(tsu.locator("text=neu").first).to_be_visible(); ok("Mitgliederliste zeigt „neu“")

    print("\nKonsolenfehler:", fehler_konsole)
    browser.close()
print("\n".join(schritte))
