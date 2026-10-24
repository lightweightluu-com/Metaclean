# Projekt-Konventionen für Claude

Dieses Repo stammt aus dem Template `lightweightluu-com/pwa-template`.
Jeder Push auf `main` wird automatisch als PWA auf
**https://<repo-name>.lightweightluu.com** veröffentlicht.

## Deployment – nicht verändern ohne Rückfrage
- `.github/workflows/deploy.yml` baut mit `npm run build` und deployt `dist/`
  als Cloudflare Worker (Static Assets) mit Custom Domain.
- Die Subdomain ist der Repo-Name in Kleinbuchstaben (`_` und `.` werden zu `-`).
- `wrangler.jsonc` wird im CI erzeugt und ist in `.gitignore` – nicht einchecken.
- Secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) kommen aus der Org.
  Niemals Tokens oder Keys in den Code schreiben.

## Stack
- Vite + `vite-plugin-pwa` (Manifest + Service Worker, `autoUpdate`).
- Build-Output muss in `dist/` landen.
- Kein Backend: alles läuft statisch. Wird ein Backend nötig, zuerst fragen
  (Optionen: Worker-Code im selben Projekt, Supabase).
- SPA-Routing ist aktiv (`not_found_handling: single-page-application`).
- Frameworks (React, Svelte, …) sind erlaubt, wenn das Projekt es braucht –
  `vite-plugin-pwa` und den `dist/`-Output beibehalten.

## Bei jedem neuen Projekt anpassen
1. In `vite.config.js`: `APP_NAME`, `APP_SHORT_NAME`, `THEME_COLOR`, `BACKGROUND_COLOR`.
2. In `index.html`: `<title>`, `meta description`, `theme-color`.
3. Icons in `public/icons/` (192, 512, maskable 512) und `public/apple-touch-icon.png`, `public/favicon.svg` ersetzen.
4. `name` in `package.json` auf den Repo-Namen setzen.
5. Nach dem ersten `npm install` die `package-lock.json` mit committen.

## Qualitätsregeln
- Vor jedem Push auf `main`: `npm run build` muss fehlerfrei durchlaufen.
- Mobile first, funktioniert ab 360 px Breite, respektiert Safe Areas.
- Hell- und Dunkelmodus über `prefers-color-scheme`.
- Barrierearm: semantisches HTML, ausreichende Kontraste, Labels für Formulare.
- Inhalte und UI-Texte auf Deutsch (Schweiz: „ss“ statt „ß“), sofern nicht anders gewünscht.
- Kleine, beschreibende Commits.
