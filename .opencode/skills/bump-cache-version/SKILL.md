---
name: bump-cache-version
description: Use when the user wants to commit, deploy, or bump the cache version in this project. Increments the Service Worker cache version in sw.js and the ?v= query parameter in index.html to bust mobile browser caches. Run `node scripts/bump-version.js` before committing.
---

# Skill: bump-cache-version

## Wann anwenden

Immer wenn der Nutzer:
- einen `git commit` durchführen möchte
- deployen möchte
- fragt, ob die Cache-Version aktuell ist
- Caching-Probleme auf dem Handy meldet

## Was automatisch passiert

Der Git **pre-commit Hook** (`.git/hooks/pre-commit`) ruft `node scripts/bump-version.js` auf und erledigt alles automatisch:

1. Liest die aktuelle Version aus `sw.js` (`CACHE_NAME = 'delta-v-vN'`)
2. Erhöht N um 1
3. Schreibt den neuen Wert in `sw.js` zurück
4. Aktualisiert den `?v=N`-Query-Parameter im `<script>`-Tag in `index.html`
5. Staged beide Dateien via `git add`

## Manuell ausführen

Falls der Hook nicht greift (z.B. `--no-verify` wurde genutzt):

```sh
node scripts/bump-version.js
git add sw.js index.html
```

## Betroffene Dateien

| Datei | Was geändert wird |
|---|---|
| `sw.js` | `const CACHE_NAME = 'delta-v-vN'` → `vN+1` |
| `index.html` | `<script src="./js/main.js?v=N">` → `?v=N+1` |

## Erklärung des Problems

Der Service Worker cached alle Assets beim ersten Laden. Ohne Versionsänderung
liefert er auf dem Handy dauerhaft die alte Version aus dem Cache, auch wenn
der Server bereits neue Dateien bereitstellt. Das Inkrementieren des Cache-Namens
zwingt den Browser, einen neuen Service Worker zu installieren und alle Assets
neu zu laden.
