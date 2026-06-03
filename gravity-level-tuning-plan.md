# Finaler Plan: Gravity-Level Visualisierung & Tuning

## Zielsetzung

Level 2 (Gravity Well) soll durch **sichtbare, planbare Mechaniken** vom "blinden Ausprobieren" zur **steuerbaren Herausforderung** werden. Zwei Hauptprobleme werden adressiert:

1. **Trajectory Prediction** (gepunktete Flugbahn-Vorhersage) — **zu schwach sichtbar**
2. **Gravity Field Rings** (Einflussfeld-Ringe) — **praktisch unsichtbar**

---

## Problem-Analyse

### Trajectory Prediction (`renderer.js:457-483`)

| Parameter | Aktuell | Problem |
|---|---|---|
| Alpha (safe) | 0.08 – 0.5 | Startet schwach, endet fast unsichtbar |
| Alpha (danger) | 0.1 – 0.7 | Besser, aber immer noch blass |
| Line Width | 1.5 px | Zu dünn auf HiDPI/weiten Zooms |
| Dash Pattern | `[3, 6]` | Zu große Lücken → Fragmentierung |

### Gravity Field Rings (`renderer.js:404-418`)

| Ring Radius | Aktuelles Alpha | Effekt |
|---|---|---|
| 600 px (äußerst) | **0.06** | Fast unsichtbar |
| 420 px | **0.10** | Kaum erkennbar |
| 260 px | **0.16** | Sehr subtil |
| 140 px (innerst) | **0.22** | Gerade sichtbar |

→ Auf schwarzem Hintergrund sind Alpha-Werte unter 0.2 praktisch unsichtbar.

---

## Änderungsplan

### 1. Trajectory Prediction — Sichtbarkeit massiv erhöhen

```javascript
// Bisher (Zeile 467-470):
const alpha = isInDanger ? (0.7 - t * 0.5) : (0.5 - t * 0.35);
// → alpha-Reichweite: 0.08 - 0.5 (safe), 0.1 - 0.7 (danger)

// Neu:
const alpha = isInDanger ? (0.9 - t * 0.25) : (0.8 - t * 0.3);
// → alpha-Reichweite: 0.5 - 0.8 (safe), 0.65 - 0.9 (danger)
```

**Alle Änderungen:**
| Parameter | Alt | Neu |
|---|---|---|
| Alpha safe | `0.5 - t * 0.35` → min `0.08` | `0.8 - t * 0.3` → min `0.5` |
| Alpha danger | `0.7 - t * 0.5` → min `0.1` | `0.9 - t * 0.25` → min `0.65` |
| Line Width | `1.5` | `2.0` |
| Dash Pattern | `[3, 6]` | `[4, 5]` |

### 2. Gravity Field Rings — deutlich sichtbar machen

```javascript
// Bisher (Zeile 405-408):
{ r: 600 * z, alpha: 0.06 },
{ r: 420 * z, alpha: 0.10 },
{ r: 260 * z, alpha: 0.16 },
{ r: 140 * z, alpha: 0.22 },

// Neu:
{ r: 600 * z, alpha: 0.15 },  // 2.5x
{ r: 420 * z, alpha: 0.25 },  // 2.5x
{ r: 260 * z, alpha: 0.35 },  // 2.2x
{ r: 140 * z, alpha: 0.50 },  // 2.3x
```

**Zusätzlich:** Line Width der Ringe von `1.5` → `2.0`

### 3. Fuel Economy Check

Zum Tuning zum Vergleich nochmal die Werte:

| Route | Fuel Cost | % von 300 | Beschreibung |
|---|---|---|---|
| Sicherer Bogen (Umfliegen) | ~60-80 | 20-27% | Weit außen rum, kein Risiko |
| Gravity-Assist (Swing-by) | ~30-50 | 10-17% | Enge Passage, ~40% Ersparnis |

→ Der **Anreiz für die riskantere Route** ist durch die ~40% Treibstoffersparnis bereits gut gegeben. Durch die bessere Visualisierung wird diese Entscheidung jetzt **sichtbar und planbar**.

---

## Betroffene Dateien

| Datei | Zeilen | Änderung |
|---|---|---|
| `js/renderer.js` | 405-408, 412, 461-462, 467-470 | Alpha-Werte, Line Widths, Dash Patterns |

**Keine Änderungen** an `js/main.js`, `js/gravity.js`, `js/physics.js` oder anderen Dateien nötig.

---

## Gewünschtes Spielgefühl nach Tuning

1. **Trajectory Prediction**: Eine klar sichtbare, lebendige cyan-farbene Bahnlinie, die das geplante Manöver visualisiert. Bei Gefahr (zu nah am Well) schlägt sie nach rot um und warnt.

2. **Gravity Field Rings**: Vier deutlich erkennbare orange Ringe, die das Gravitationsfeld in Zonen einteilen:
   - **Äußerster Ring (600px)**: "Hier beginnt der Gravitationseinfluss"
   - **Innerer Ring (140px)**: "Achtung, hier wird's kritisch"
   - Zwischenringe: Orientierung für die Flugbahn-Planung

3. **Ergebnis**: Der Spieler sieht seine vorhergesagte Bahn und das Gravitationsfeld klar genug, um **strategisch zu entscheiden**: "Swing-by riskieren für Treibstoff-Ersparnis, oder sicher weit außen rum fliegen?"

---

## Implementierungs-Reihenfolge

1. Gravity Field Rings Alpha-Werte erhöhen + Line Width
2. Trajectory Prediction Alpha, Line Width, Dash Pattern anpassen
3. Testen in Level 2 (visuelle Klarheit, Fahrverhalten)
4. Fine-Tuning falls nötig
