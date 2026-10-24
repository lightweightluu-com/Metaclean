# pwa-template

Vorlage für PWAs, die automatisch auf `<repo-name>.lightweightluu.com` live gehen.

## Neues Projekt starten
1. Auf GitHub **„Use this template“ → Create a new repository** (Owner: `lightweightluu-com`).
2. Repo-Name = Subdomain, z.B. `rezepte` → `rezepte.lightweightluu.com`.
   Nur Kleinbuchstaben, Zahlen und Bindestriche verwenden.
3. Repo in Claude Code öffnen und beschreiben, was gebaut werden soll.
4. Jeder Push auf `main` deployt automatisch. Die URL steht in der Zusammenfassung des Actions-Laufs.

## Lokal
```bash
npm install
npm run dev
```

## Voraussetzungen (einmalig, bereits erledigt)
- Org-Secrets `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` für alle Repos.
- Zone `lightweightluu.com` in Cloudflare.
- Für die gewünschte Subdomain darf noch kein DNS-Eintrag existieren.
