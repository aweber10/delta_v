#!/usr/bin/env node
/**
 * bump-version.js
 * Liest die aktuelle Cache-Version aus sw.js, erhöht sie um 1,
 * schreibt sie in sw.js und index.html zurück und staged die Dateien.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// --- sw.js ---
const swPath = join(root, 'sw.js');
let sw = readFileSync(swPath, 'utf8');

const swMatch = sw.match(/const CACHE_NAME\s*=\s*'delta-v-v(\d+)'/);
if (!swMatch) {
  console.error('bump-version: CACHE_NAME nicht in sw.js gefunden.');
  process.exit(1);
}

const oldVersion = parseInt(swMatch[1], 10);
const newVersion = oldVersion + 1;

sw = sw.replace(
  `'delta-v-v${oldVersion}'`,
  `'delta-v-v${newVersion}'`
);
writeFileSync(swPath, sw, 'utf8');
console.log(`sw.js: delta-v-v${oldVersion} → delta-v-v${newVersion}`);

// --- index.html (Script-Tag mit ?v=…) ---
const htmlPath = join(root, 'index.html');
let html = readFileSync(htmlPath, 'utf8');

const htmlMatch = html.match(/main\.js\?v=(\d+)/);
if (htmlMatch) {
  html = html.replace(`main.js?v=${htmlMatch[1]}`, `main.js?v=${newVersion}`);
} else {
  // Kein ?v= vorhanden – füge es hinzu
  html = html.replace('main.js"', `main.js?v=${newVersion}"`);
  html = html.replace("main.js'", `main.js?v=${newVersion}'`);
}
writeFileSync(htmlPath, html, 'utf8');
console.log(`index.html: main.js?v=${newVersion}`);

// --- Git staging ---
execSync(`git add "${swPath}" "${htmlPath}"`, { cwd: root, stdio: 'inherit' });
console.log('Geänderte Dateien gestaged.');
