# Unser Wunschzettel

Weihnachts-Wunschlisten für die Familie: Wünsche pro Advent und Heiligabend, mit Links,
und „Ich schenke das“-Markierungen, die der Wünschende selbst nie sieht.

- `docs/` – Webseite (GitHub Pages)
- `worker/` – Server + Datenbank (Cloudflare Workers + D1, kostenlos)

## Lokal starten

```powershell
cd worker
npm install
npm run db:local
npx wrangler dev
```

In einem zweiten Terminal die Webseite starten:

```powershell
npx --yes http-server@14.1.1 docs -p 8080 -c-1
```

Danach im Browser `http://localhost:8080/#/einladung/lokaler-test-code` öffnen.

Die Tests laufen gegen den lokalen Worker:

```powershell
cd worker; npm test
```

## Online stellen (einmalig)

### 1. Cloudflare (Server)
1. Ein kostenloses Konto auf cloudflare.com anlegen.
2. Im Ordner `worker` anmelden:
   ```powershell
   npx wrangler login
   ```
3. Die Datenbank anlegen:
   ```powershell
   npx wrangler d1 create wunschliste
   ```
   Die ausgegebene `database_id` in `worker/wrangler.toml` statt `local-placeholder` eintragen.
4. Die Tabellen anlegen:
   ```powershell
   npm run db:remote
   ```
5. Einen geheimen Einladungscode festlegen. Am besten ein langes, zufälliges Wort, denn wer den Code kennt, kann mitmachen:
   ```powershell
   npx wrangler secret put INVITE_CODE
   ```
6. In `worker/wrangler.toml` bei `ALLOWED_ORIGINS` deine GitHub-Pages-Adresse ergänzen, zum Beispiel
   `"https://DEIN-NAME.github.io,http://localhost:8080"`. Hier gehört nur der Teil ohne Pfad hinein.
7. Den Worker veröffentlichen:
   ```powershell
   npm run deploy
   ```
   Die angezeigte Adresse `https://wunschliste-api.….workers.dev` brauchst du im nächsten Schritt.

### 2. GitHub Pages (Webseite)
1. In `docs/config.js` bei `PRODUCTION_API` die Worker-Adresse eintragen.
2. Ein Repo auf GitHub anlegen und alles hochladen. `.gitignore` hält Geheimnisse und `node_modules` heraus.
3. Auf GitHub unter **Settings → Pages** als Quelle **Deploy from a branch** wählen, dann `main` und `/docs`.
4. Nach etwa einer Minute ist die Seite unter `https://DEIN-NAME.github.io/REPO/` erreichbar.

### 3. Familie einladen
Den eigenen Einladungslink öffnen: `https://DEIN-NAME.github.io/REPO/#/einladung/DEIN-CODE`.
Danach anmelden und oben auf **Familie einladen** klicken. Der Link wird kopiert und kann
per WhatsApp verschickt werden.

## Gut zu wissen
- **Verwaltung:** Admins (`users.is_admin = 1`, aktuell Iwan) finden unter **Konto → Verwaltung**:
  Passwort zurücksetzen, umbenennen, entfernen, Einladungslink erneuern. Jeder kann unter **Konto** sein eigenes Passwort ändern.
- **Weiteren Admin ernennen:**
  `npx wrangler d1 execute wunschliste --remote --command "UPDATE users SET is_admin = 1 WHERE name = 'Name'"`
- **Einladungscode:** Ein über die Verwaltung erneuerter Code steht in der Tabelle `settings` und hat Vorrang vor dem Secret `INVITE_CODE`.
- **Datenbank-Änderungen:** Neue Spalten/Tabellen kommen als Datei in `worker/migrations/` und werden einmalig mit
  `npx wrangler d1 execute wunschliste --remote --file=migrations/<datei>.sql` angewendet (vorher `wrangler d1 export` als Sicherung).
- **Tests:** Brauchen ein lokales Admin-Konto (Standard `Iwan` / `testpass1`, änderbar über `ADMIN_NAME` / `ADMIN_PASSWORD`).
- **Gelöschte Wünsche:** Löscht jemand einen Wunsch, den schon jemand schenken wollte, verschwindet auch die Markierung.
