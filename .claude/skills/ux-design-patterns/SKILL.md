---
name: ux-design-patterns
description: Use when designing, building or reviewing any UI (websites, PWAs, app screens) – states, feedback, motion, layout, tokens and component behaviour – so it feels premium, not AI-made.
---

# UX Design Patterns

Senior-Designer-Regeln für Interfaces, destilliert aus 76 Pattern-Breakdowns. Ziel: UI, die durchdacht wirkt statt generiert. Gilt für Bauen **und** Reviewen.

## Grundhaltung

1. **Komponenten sind Systeme, keine Widgets.** Jede Komponente hat Zustände, Tastaturverhalten, Mobile-Variante, Fehler- und Ladefall. Wer nur den Happy Path baut, liefert einen Bug.
2. **Das Produkt zeigen statt dekorieren.** Generierte UI dekoriert, weil sie nichts Konkretes hat (Gradient-Blobs, Adjektiv-Headlines, Icon-im-Kreis-Features). Jede Deko durch etwas Echtes ersetzen.
3. **Wahrgenommene Geschwindigkeit ist Design.** Unter 400 ms reagieren, egal wie lange die echte Arbeit dauert.
4. **Eine Sache hervorheben.** Ein Akzent, ein Primär-CTA, ein hervorgehobener Plan pro View. Rot nur für Zerstörung.
5. **Nie nur Farbe.** Jede Farbcodierung bekommt Icon, Text, Form oder Muster dazu (~8 % sehen Farben anders).
6. **Werte kommen aus Skalen und Tokens**, nie aus dem Bauch (kein 7px, 13px, 23px).

## Vorgehen bei jeder UI-Aufgabe

1. Zweck klären: Was ist die **eine** Aktion auf diesem Screen?
2. Für jede Komponente die Zustände auflisten (siehe Zustands-Matrix) und alle bauen.
3. Tastatur, Fokus, Touch/Mobile mitdenken – nicht nachrüsten.
4. Werte aus Tokens/Skalen nehmen, Motion aus der Timing-Tabelle.
5. Copy schreiben wie ein hilfsbereiter Mensch.
6. Mit der Review-Checkliste am Ende prüfen.

---

## 1 · Motion

### Timing
| Was | Dauer | Kurve |
|---|---|---|
| Tap/Press-Feedback, Hover | < 100 ms (Linear-Stil: ~80 ms) | ease-out |
| Dropdown öffnen | ~150 ms | ease-out |
| Card-Hover-Lift | ~200 ms | ease-out |
| Eintritt (Modal, Sheet, Panel) | 200–300 ms, nie > 300 | ease-out |
| Toggle-Morph | ~250 ms | ease-out |
| Austritt | ~40 % schneller als Eintritt (250 → 150) | ease-in |
| Bewegung auf dem Screen | – | ease-in-out |
| Aufmerksamkeit (Notification) | 500–800 ms, Overshoot erlaubt | Spring |

- **Stagger** ~50 ms pro Listenelement (30 = Brei, 100 = kriecht). Reveal-Aktionen ~60 ms, Sterne ~30 ms.
- **Linear** nur für Endlos-Bewegung (Spinner, Marquee). Nie für UI, die startet und stoppt.
- **Spring** mit leichtem Overshoot für Press, Modal, Bestätigung – nie wobbeln lassen. Dichte Produkt-UIs (Linear-Stil): gar kein Bounce, Transitions < 150 ms.
- Wenige Kurven **überall gleich** verwenden – das macht Kohärenz aus.
- Gekoppelte Teile (Chevron + Panel, Tab-Indikator + Content-Fade) laufen auf **derselben** Kurve – schon wenige Frames Versatz wirken kaputt.
- Kein Hard-Cut beim Content-Wechsel: fade out → ~80 ms Pause → fade in, gleiche Panel-Höhe.
- `prefers-reduced-motion` respektieren.

### Scroll-Animationen
- Native CSS: `animation-timeline: scroll()` / `view()`, `animation-range` für Triggerpunkte. Keine Scroll-Listener, kein `getBoundingClientRect`, keine JS-Library dafür.
- Mit `position: sticky` kombinieren für schrumpfende Header und Lesefortschritt.
- Parallax-Ebenen etwa 1× / 2.5× / 5× – dezent, nie vom Inhalt ablenken.

### Höhe animieren
`height: auto` lässt sich nicht animieren → `grid-template-rows: 0fr → 1fr` oder gemessene `scrollHeight`.

---

## 2 · Feedback & Zustände

### Reaktionszeit (Doherty)
< 200 ms fühlt sich sofort an, 200–400 ms ok, > 400 ms verliert der Nutzer den Faden. Innerhalb 400 ms **irgendeine** sichtbare Reaktion.

### Laden – das Muster aus dem Wissen wählen
| Situation | Muster |
|---|---|
| < 300 ms | **nichts zeigen** (Flackern wirkt wie ein Glitch) |
| Form des Inhalts bekannt, > 300 ms | Skeleton in exakten Massen + Shimmer; nach ~2 s Teilinhalt zeigen |
| kurz & Dauer unbekannt (< 3 s) | Spinner, lokal (Button, kleiner Bereich) – nie ganzseitig |
| > 3 s, Prozent bekannt | Progressbar + Meta (Restzeit, Geschwindigkeit) |
| reversible Aktion (Like, Save, Toggle, Reorder) | **Optimistic UI** |

- Skeleton und Spinner nie im selben View mischen. Skeleton darf beim Laden kein anderes Layout ergeben.
- **Optimistic UI**: sofort umschalten, im Hintergrund syncen, bei Fehler sauber zurückrollen + Meldung. Nie für Zahlung, Buchung, Überweisung – Geld wartet auf den Server.
- **Disabled ≠ Loading.** Beim Request: Fokus halten, Spinner, `aria-busy`.
- Nach Server-Antwort mit **Server-Wahrheit** neu rendern (echte ID, echter Preis). Client-Validierung = Speed, Server-Validierung = Vertrauen; Preise immer serverseitig neu berechnen, Multi-Writes in einer Transaktion.

### Fehler
- **Ort nach Typ:** Validierung inline am Feld · Verbindungsverlust als Banner/Toast · Crash/Berechtigung als eigener prominenter Bereich.
- **Fläche nach Schwere:** inline < Toast < Modal.
- **Jeder Fehler hat einen Ausweg:** Retry, Support-Link, aufklappbare Details. Kein „OK“ als einzige Option.
- Copy: was ist passiert, warum, was jetzt. Nie „Error 500“ oder „Ein Fehler ist aufgetreten“.

### Leere Zustände – 4 Arten, je eigene Copy + CTA
First Run · Keine Ergebnisse · Fehler · Weggefiltert.
Kleine Illustration/Icon (sonst wirkt es kaputt), warmer Satz, **eine** primäre CTA zum nächsten echten Schritt (nicht „Neu laden“). Ghost-Preview eines echten Elements = bestes Onboarding.

### Benachrichtigungen – vier Lautstärken
| Fläche | Wann | Persistenz |
|---|---|---|
| Badge | passiver Zähler | bis erledigt |
| Toast | niedrige Priorität, Bestätigung | Info ~4 s, Warnung ~7 s, kritisch bis bestätigt |
| Banner | degradierter Dienst, anhaltender Zustand | bis manuell geschlossen |
| Modal | blockierender Fehler / Entscheidung | bis Aktion |

- Toasts: Desktop unten rechts, Mobile oben, **nie Mitte**; max 3 sichtbar, Rest in Queue, Nachrücken mit Spring; Close-Button, Swipe mobil, Timer pausiert bei Hover; Typfarbe + Icon + linker Akzentrand.
- Toasts dürfen stapeln, Modals **nie**. Alles auf die lauteste Fläche → Nutzer ignorieren alles.

### Undo statt „Bist du sicher?“
- Sofort ausführen, Undo-Toast mit **sichtbarem Countdown** (Ring/Balken), 5–10 s.
- Soft-Delete (Flag, ~30 Tage Papierkorb), dann purgen.
- Harte Friction (Namen eintippen, Hold-to-confirm ~300 ms, Cooldown z. B. 14 Tage) **nur** für wirklich Irreversibles.
- Verzögertes Senden (~10 s) ist ein Feature.

### Psychologie gezielt einsetzen
- **Peak-End:** Nutzer erinnern den Höhepunkt und das Ende. Einen bewussten Delight-Moment bauen, letzten Screen feiern statt kalt bestätigen, nie mit Fehler/Sackgasse enden.
- **Zeigarnik:** Offene Loops ziehen zurück (Profil 80 %, eine Onboarding-Box offen) – nur bei Zielen, die der Nutzer selbst will.
- **Serial Position:** Anfang und Ende werden erinnert, Mitte vergessen. Nav: Logo vorne, Primär-CTA hinten. Landing: stärkster USP zuerst, stärkster Beweis zuletzt.
- **Von Restorff:** Genau ein Element bricht eine ruhige Basis (Zielplan grösser + Badge, Rest gedimmt) – über Grösse, Elevation, Glow, nicht nur Farbe.

---

## 3 · Visuelle Hierarchie & Layout

- **Hierarchie-Hebel stapeln:** Primärelement ~2× Body-Grösse, Gewichte ~800/400/300, Kontrast (gefüllter Primär- vs. Ghost-Sekundärbutton), mehr Whitespace um das Wichtigste, ein Akzent.
- **Proximity:** Abstand innerhalb einer Gruppe < zwischen Gruppen (Formular z. B. ~12 px zwischen Feldern, ~40 px zwischen Sektionen). Erst Abstand, dann Border/Divider.
- **Gestalt:** gemeinsame Eigenschaft = Gruppe (Similarity), gemeinsame Achse (Continuity), Card gruppiert Entferntes (Common Region), Hintergrund dimmen/blurren hinter Modals (Figure-Ground).
- **Grid:** 12 Spalten; Verhältnisse 4:8, 6:6, 3:9; Gutter 8 (dicht) / 24 (ausgewogen) / 40 (editorial); Breakpoints 12 → 6 → 4 → 1. Erst etablieren, dann bewusst brechen (Bleed, Pull-Quote).
- **Ausrichtung:** Labels/IDs links, Zahlen/Daten rechts (tabular figures), Icons auf der Textlinie zentriert, nichts willkürlich zentriert.
- **Proportionen:** Golden-Ratio-Split ~62/38 für Haupt-/Nebeninhalt; Skalen mit ×1.618 möglich (8/13/21/34/55, Type 16/26/42/68), auf das Grid gerundet.

### Tiefe & Oberflächen
- **Schatten gestapelt** statt einer: enger Contact-Shadow (~0 1px 3px) + mittlerer + weicher weiter (≈ 2 / 12 / 32 px Blur). Optional dezenter Glow in Akzentfarbe.
- **Alternative (Linear-Stil):** keine Schatten, drei Hintergrundwerte (base / surface / raised) + 1px-Hairline bei ~8 % Weiss; Hover ändert den Surface-Wert.
- Mehr Elevation = wichtiger. Stärkste Elevation nur für das Wichtigste.
- **Premium-Card:** grosszügiges Padding (~40 px), Radius ~24 px, Titel ~600, Body ~55 % Opacity, zwei Schatten, Hairline-Border ~12 %, Hover-Lift.
- **Card-Hover:** Lift ~8 px + wachsender Schatten in ~200 ms; Bild `scale(1.05)` in `overflow: hidden`; versteckte Aktionen unten gestaffelt einblenden. **Nie die ganze Card skalieren** – das verschiebt das Grid.
- **Radius:** eine Skala (4 / 8 / 12 / 16 / 24), nach Grösse (Tooltip 4, Input 8, Card 12, Modal 16, Panel 24); verschachtelt: innen = aussen − Padding. Klein = seriös, gross = freundlich.

### Farbe
- Neutrale Basis, **ein** Akzent – nur für Auswahl und Primäraktion. Status als graues Icon statt bunter Pills.
- **Kontrast:** 4.5 : 1 Body, 3 : 1 grosser Text. Gedämpfte Grautöne (Nav, Labels, Sekundärtext) besonders prüfen.
- **Gradients:** benachbarte Farbtöne (≤ 60° Hue-Weg), Helligkeit in eine Richtung, als Ambiente (radialer Glow hinter Content) statt Fläche, 2–3 % Noise gegen Banding, kein Fliesstext in der Übergangszone.
- **Dark Mode:** Basis ~#121212 (nicht #000), höhere Ebenen heller, Akzente ~20 % entsättigen, kein reines Weiss für Text, Text-Hierarchie über Opacity-Stufen. Technisch: Token-Set tauschen, nicht invertieren.

### Icons
Ein Stroke (2 px), eine Bounding-Box, 24-px-Grid (16 für dichte UI), Fill **oder** Outline für das ganze Set, runde Formen optisch 5–8 % grösser.

### Charts
Balken-Y-Achse ab 0; Typ aus der Frage (Balken vergleichen, Linie zeigt Verlauf, Pie max ~5 Segmente); Seitenverhältnis so, dass die mittlere Steigung ~45° ist; keine Gridlines/3D/Schatten, Linien direkt beschriften; eine Hero-Farbe; Titel = Erkenntnis („Umsatz seit März flach“), nicht die Metrik.

### z-index
Braucht `position`; Stacking-Contexts begrenzen Kinder – kein 9999-Wettrüsten; `isolation: isolate` kapselt Komponenten.

---

## 4 · Design-System & Tokens

- Tokens nach **Bedeutung** benennen (`color-primary`, `space-md`), nie nach Wert (`blue-500`).
- Drei Ebenen: **primitive → semantic → component**, jede referenziert die darüber. Eine Änderung kaskadiert.
- Farbskala 100–900 → auf semantische Rollen (brand, success, error) gemappt.
- Spacing-Skala auf 4-px-Basis (4 … 64); Ausreisser auf die Skala snappen.
- Feste Type-Scale mit klaren Grössen und Gewichten.
- Komponenten = Varianten (primary / secondary / ghost / destructive) × Grössen (S / M / L) × Zustände.
- Motion-Tokens: Dauer 100–500 ms, Kurven nach Absicht (enter / move / exit).

---

## 5 · Copy & Content

- Buttons nennen die **Belohnung**: „Kostenloses Konto erstellen“ statt „Senden“; destruktiv benennt die Aktion: „Projekt löschen“ / „Projekt behalten“ statt Ja/Nein.
- Fehler als nächster Schritt: „Diese E-Mail ist schon registriert – einloggen?“
- Placeholder ist kein Label – immer persistentes Label über dem Feld. Placeholder darf beschreiben („Nach Name, SKU oder Marke suchen“).
- **De-AI-Hero:** Headline = konkretes Ergebnis, Subline = Zielgruppe; keine Adjektive (supercharge, seamless, powerful); kein Blob; ein Primärbutton + Textlink mit Pfeil (90/10 statt 50/50); statt „Trusted by 10'000+“ mit grauen Logos ein Zitat mit Name, Rolle und messbarem Ergebnis; statt drei Icon-Feature-Cards ein Produkt-Screenshot mit drei Annotationen.
- **Landing-Skelett:** Hero → Proof → Problem → Lösung → CTA. Hero beantwortet was / für wen / warum in ~3 s (kein Slider). Proof direkt unter dem Hero. Schmerz vor Lösung. Max. drei Benefits als Ergebnisse. Identische CTA oben und unten.

---

## 6 · Komponenten-Regeln

### Zustands-Matrix (Minimum)
- **Textfeld:** default · focus · error · success · disabled · loading
- **Button:** default · hover · active · focus-visible · loading (aria-busy) · (disabled nur mit sichtbarem Grund)
- **Chip:** idle · active (gefüllt + Check) · disabled (keine Treffer)
- **Liste/Seite:** loading · empty (4 Arten) · error · partial · ideal

### Formulare
- Label oben, Helper unten. Fehler = Farbe + Icon + Text (was falsch, wie lösen). Erfolg **im Feld** (grüner Haken), nicht per Toast.
- **Validierungs-Timing:** on blur; nach einem Fehler live für dieses Feld, damit er sofort verschwindet; nie bei jedem Tastendruck, nie erst bei Submit. CSS: `:user-invalid` statt `:invalid`.
- **Nicht disablen:** Submit aktiv lassen, beim Klick validieren, blockierende Felder markieren, Fokus aufs erste. Disabled-Buttons fallen aus der Tab-Reihenfolge, zeigen keine Tooltips und haben meist zu wenig Kontrast.
- Disabled-Feld ≠ opacity .5 (wirkt wie Laden): graue Fläche + not-allowed-Cursor. Loading: Spinner im Feld, Eingabe blockiert gegen Doppel-Submit.
- **Stepper:** nach Kontext chunken (Persönlich, Versand, Zahlung, Prüfen), Fortschritt zeigen, pro Schritt validieren, State bei jedem Schritt speichern (Back/Refresh verlieren nichts).
- **Input-Masking:** formatiert anzeigen, roh speichern; 4er-Gruppen bei Kartennummern, Marke aus erster Ziffer; Caret bleibt nach eingefügtem Separator an Ort; Paste säubern statt ablehnen; Validierung on blur.
- **OTP:** ein String als State, Kästchen sind nur eine Ansicht; Paste verteilt (Nicht-Ziffern entfernen); Auto-Advance, Backspace springt zurück; `inputmode="numeric"` + `autocomplete="one-time-code"`; Resend hinter sichtbarem 30-s-Countdown; falsch → Shake, leeren, refokussieren; richtig → grün + „Verifiziert“.
- **Passwort:** Live-Checkliste + Stärke-Meter (Länge/Entropie > Sonderzeichen-Pflicht), Auge-Toggle, Paste nie blockieren, generiertes Passwort anbieten.
- **Upload:** Drag-over reagiert (Border + Glow + Text); Prozent + Restzeit statt Spinner; Inline-Retry behält die Datei; Thumbnail + Typ + Grösse als Beweis; in der Queue pro Datei eigener Fortschritt und Retry.
- **Autosave:** Debounce ~800 ms; Status als State-Machine (tippt / speichert / gespeichert / offline / Fehler) – nie „Gespeichert“ lügen; offline lokal queuen mit Badge, älteste zuerst nachspielen; konkurrierende Edits mergen oder warnen; `beforeunload` bei Ungespeichertem.
- **Settings:** Apply-Modell nach Tragweite (Toggles sofort + „Gespeichert“, Identität wie E-Mail explizit Speichern/Abbrechen); nach Aufgabe gruppieren; durchsuchbar; Modified-Indikator + Reset pro Wert; Advanced einklappen; Danger Zone unten mit Namen-eintippen.

### Eingabe-Controls
- **Toggle:** Schiene = 2× Knopf, Knopf mit Padding = eigener Radius; morpht ~250 ms (Farbe, Position, Schatten, Label gleichzeitig); Space, Fokus-Ring, `aria-checked`; async optimistisch mit Spinner im Knopf, Fehler → zurück + Shake + Toast.
- **Dropdown:** Trigger ≥ 48 px mit Caret und Hover; flippt nach oben bei Platzmangel; Pfeile / Enter / Esc; ab ~10 Einträgen Suchfeld; Öffnen ~150 ms.
- **Range-Slider:** gefüllte Spur, ganze Zeile als Hit-Area, Snapping mit Ticks, Wert-Tooltip über dem Thumb beim Ziehen, Zwei-Thumb mit gefülltem Band, Pfeile/Home/End.
- **Date-Picker:** Presets zuerst (Heute, Gestern, 7/30 Tage, Quartal), Custom für den Rest; Hover-Vorschau, Klick Start, Klick Ende, Kanten ziehbar; zwei Monate nebeneinander; volle Tastatur inkl. Bild↑ (Monat) und Shift+Bild↑ (Jahr); Mobile: Vollbild-Sheet, heute oben, grosser Bestätigen-Button unten.
- **Color-Picker:** OKLCH neben Hex, zuletzt verwendete + gespeicherte Paletten, Live-Kontrast-Badge, Alpha auf Schachbrett (hell + dunkel), Tints/Shades aus einem Ton generieren.
- **Star-Rating:** Hover-Vorschau getrennt vom gespeicherten Wert (springt beim Verlassen zurück); Durchschnitte fraktional (4.4 = fünfter Stern zu 44 %), nie aufrunden; Füllung gestaffelt ~30 ms/Stern.
- **Inline-Editing:** Affordance auf Hover (Stift, Tönung); Text und Input pixelgleich; Enter speichert, Esc verwirft, Blur-Verhalten einmal festlegen und überall gleich; optimistisch speichern, bei Fehler zurückrollen und Entwurf behalten.

### Overlays – erst fragen: blockiert es?
| Overlay | Einsatz |
|---|---|
| Modal | nur kritische/destruktive Entscheidung; volle Scrim; Fokus-Trap, Esc schliesst, Fokus zurück zum Auslöser |
| Bottom-Sheet | Mobile-Default; Seite bleibt sichtbar; Drag-Handle, Snap-Points (halb/voll), Drag-to-dismiss; Scrim + Body-Scroll sperren |
| Drawer | Navigation vom Rand; dimmt nur die eigene Fläche |
| Popover | klein (~200 px), am Auslöser verankert, kontextuell, nie blockierend |
| Tooltip | ~300 ms Delay, Pfeil zum Auslöser, flippt am Rand, schliesst bei Mouseleave/Esc/Blur/Tap aussen, max. ~300 px und ein Satz |

- **Kontextmenü:** misst Platz und flippt in den Viewport; nach Absicht gruppiert mit Dividern, Löschen unten und rot; Safe-Triangle für Submenus; Pfeile, Buchstaben-Sprung, Esc schliesst eine Ebene; Mobile: Long-Press öffnet dieselben Aktionen als Bottom-Sheet.
- **Command-Palette (⌘K):** Fuzzy-Match, gruppierte Ergebnisse (Zuletzt, Aktionen, Seiten), mit Vorschlägen vorbefüllt, volle Tastatur, async inline laden, verschachtelt mit Breadcrumb. Nur **zusätzlich** zur sichtbaren Navigation.
- Scroll-Lock und Dimmen per CSS: `body:has(dialog[open]) { overflow: hidden }` – keine Cleanup-Effekte.

### Navigation
- Mobile: Bottom-Tabs mit 3–5 Zielen. Desktop: persistente Sidebar ab ~5 Sektionen, nicht standardmässig eingeklappt. Hamburger nur für Sekundäres.
- Breadcrumbs erst ab > 2 Ebenen.
- **Tabs:** Indikator gleitet mit Spring; Overflow horizontal scrollen mit Edge-Fades (+ Chevrons Desktop), nie umbrechen; Pfeile/Home/End; Fokus-Ring ≠ Active-Farbe; Mobile < 5 Segmented-Control, > 5 Bottom-Sheet.
- **Pagination:** Cursor- statt Offset-Pagination bei sich ändernden Daten; Seitenzahl in der URL; Links kürzen auf erste, letzte, aktuelle ± Nachbarn mit Ellipse; Scroll-Position beim Zurückkommen wiederherstellen.

### Daten
- **Tabelle:** Sortierung dreistufig (auf → ab → Original); Zahlen rechtsbündig mit tabular figures; Header sticky, erste Spalte eingefroren (mit dezentem Schatten); Dichte als Token (z. B. 36 / 48 / 60 px), Zebra nur bei komfortabler Dichte; ganze Zeile klickbar (Tönung + Akzentbalken + Checkbox).
- **Bulk-Actions:** Header-Checkbox dreistufig (leer / teilweise → wählt alle / voll); „Alle 247 Treffer auswählen“ mit konkreter Zahl, live bei Filterwechsel; Shift-Klick für Bereiche; Auswahl im App-State (überlebt Seitenwechsel); destruktiv: Anzahl nennen, sofort ausführen, Undo mit Countdown.
- **Filter-Chips:** ODER innerhalb einer Gruppe, UND zwischen Gruppen; Trefferzahl im selben Frame aktualisieren; „Alle zurücksetzen“; eine horizontal scrollende Zeile mit Edge-Fade; aktive Filter in sticky Summary-Leiste.
- **Suche:** beschreibender Placeholder; letzte Suchen bei Fokus; Autocomplete nach Beliebtheit + Kategorie-Badge, wenige gute Treffer; volle Tastatur; 0 Treffer → beliebte Suchen, Kategorien, Schreibvarianten.

### Interaktionen
- **Drag & Drop:** Pickup = scale + tieferer Schatten + leichte Neigung; Ziel **vor** dem Loslassen zeigen (Einfügelinie zwischen Items, Flächen-Highlight für ganze Spalte); auf strukturierten Flächen snappen, gültige Slots gestrichelt; Undo-Toast ~5 s.
- **Swipe-Actions:** unsichtbar → beim ersten Mal andeuten; destruktiv: Teil-Swipe zeigt Button, Tap bestätigt (oder Full-Swipe + Undo); max. 2 Aktionen pro Seite, Links/Rechts-Bedeutung app-weit gleich; immer sichtbarer Fallback (Long-Press, Button in der Detailansicht).
- **Hover-Trap:** Touch hat kein Hover. Primäraktionen nie nur per Hover; Hover-Effekte hinter `@media (hover: hover)`, grössere Controls bei `pointer: coarse`; Hit-Area 44 px bei ~20-px-Icon.
- **Live-Cursors:** Positionen (~10/s) auf 60 fps interpolieren; Farbe per Hash der User-ID; Avatar-Stack mit +N; Auswahl sperrt Element mit Outline in User-Farbe; Follow-Mode.

### CSS, das JS ersetzt
- `:has()` als Parent-Selector: `.card:has(:checked)`, `.field:has(:user-invalid)`, `form:has(:user-invalid) button`, `.app:has(aside)`, Quantity-Query `.grid:has(> :nth-child(n + 5))`. DOM-Zustand nicht in JS-State spiegeln.

---

## 7 · Barrierefreiheit (Pflicht, nicht optional)

- Fokus-Ring: 2 px dick, 2 px Offset, ≥ 3 : 1 auf hellem und dunklem Grund; `:focus-visible`; nie `outline: none` ohne Ersatz.
- DOM-Reihenfolge = visuelle Reihenfolge.
- Skip-Link als erstes fokussierbares Element.
- Modals: Fokus-Trap, Esc, Fokus zurück.
- Interaktive Header sind `<button>` mit `aria-expanded` / `aria-controls`.
- Kontrast 4.5 : 1 / 3 : 1, nie nur Farbe.
- Touch-Ziele ≥ 44 px.

---

## Review-Checkliste

- [ ] Gibt es genau **eine** klar hervorgehobene Aktion pro Screen?
- [ ] Hat jede Komponente alle Zustände (inkl. loading, empty, error, disabled/busy)?
- [ ] Reagiert alles innerhalb 400 ms? Richtiges Lademuster gewählt, < 300 ms nichts gezeigt?
- [ ] Hat jeder Fehler einen Ausweg und menschliche Copy?
- [ ] Undo statt Bestätigungsdialog, wo die Aktion umkehrbar ist? Rot nur für Destruktives?
- [ ] Motion: Eintritt ≤ 300 ms ease-out, Austritt schneller, kein linear, gekoppelte Teile synchron, reduced-motion?
- [ ] Werte aus Tokens/Skalen (Spacing, Radius, Farbe, Type)? Innerer Radius korrekt?
- [ ] Abstände gruppieren (innen < aussen) statt Borders überall?
- [ ] Kontrast geprüft, nie nur Farbe?
- [ ] Tastatur komplett bedienbar, Fokus sichtbar, Mobile/Touch ohne Hover nutzbar?
- [ ] Keine AI-Tells: Gradient-Blob, Adjektiv-Headline, zwei gleiche Buttons, Fake-Social-Proof, Icon-im-Kreis-Features?
- [ ] Endet der Flow mit einem positiven Moment statt einer kalten Bestätigung?
