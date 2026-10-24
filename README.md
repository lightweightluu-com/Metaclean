# Metaclean

Entfernt Metadaten aus Word- (.docx) und PDF-Dateien – vollständig im Browser.
Dokument rein, Metadaten weg, Dokument raus. Nichts wird hochgeladen oder gespeichert.

Live: **https://metaclean.lightweightluu.com** (Repo-Name = Subdomain)

## Datenschutz
- Verarbeitung nur im Arbeitsspeicher des Browser-Tabs.
- Content-Security-Policy mit `connect-src 'none'`: Die Seite kann technisch keine Daten senden.
- Keine Cookies, kein localStorage/IndexedDB, kein Tracking, kein Backend.
- Funktioniert offline (Service Worker cacht nur den App-Code, nie Dateien).

## Was entfernt wird
**Word:** Dokumenteigenschaften (Autor, Firma, Manager, Titel, Stichwörter, eigene Felder, Daten,
Bearbeitungszeit, Programm), Kommentare samt Autoren, Änderungsverfolgung (wird angenommen),
rsid-Bearbeitungs-IDs, Vorlagenpfad, Dokument-IDs, Dokumentvariablen, customXml/SharePoint-Daten,
Vorschaubild, EXIF/GPS in Bildern, ZIP-Zeitstempel. Setzt zudem «Persönliche Informationen beim
Speichern entfernen» in Word.

**PDF:** Info-Dictionary, XMP auf allen Ebenen, PieceInfo, Dokument-ID, Autoren/Daten in
Anmerkungen, Daten von Anhängen, EXIF in JPEG-Bildern, frühere Bearbeitungsstände (inkrementelle
Updates) und unbenutzte Objekte.

## Nicht unterstützt (noch)
Alte `.doc`, verschlüsselte PDFs, Excel/PowerPoint. Eingebettete Objekte und PDF-Anhänge werden
nicht rekursiv bereinigt (die App weist darauf hin).

## Aufbau
- `src/strip/docx.js` – Word-Bereinigung (JSZip + DOMParser)
- `src/strip/pdf.js` – PDF-Bereinigung (pdf-lib)
- `src/strip/images.js` – EXIF/XMP/Text-Chunks aus JPEG/PNG
- `src/main.js` – Oberfläche (Download am PC, Teilen-Menü auf iPhone)

## Lokal
```bash
npm install
npm run dev
```

## Installieren
- **Windows:** in Edge/Chrome öffnen → Symbol «App installieren» in der Adressleiste.
- **iPhone:** in Safari öffnen → Teilen → «Zum Home-Bildschirm».
