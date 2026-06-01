# Space Cargo — POC Level 1: „First Delivery"
## Implementierungsspezifikation

**Status:** In Entwicklung
**Zielplattform:** iPhone 13 (primär, Touch), Desktop-Browser (sekundär, Keyboard)
**Technologie:** JavaScript + HTML5 Canvas, Single-Page, keine Frameworks
**Performance-Ziel:** stabile 60 FPS auf iPhone 13

---

## 1. Zweck dieses POC

Dieser POC hat **ein einziges Erkenntnisziel**: herauszufinden, ob das Spielprinzip Spaß macht — konkret, ob der Übergang vom groben „Fliegen" (Drehen + Hauptschub) zum feinen „Einparken" (Steuerdüsen per Tap) sich befriedigend anfühlt oder ob man gegen die Steuerung kämpft.

Alles andere (Sound, Menüs, mehrere Level, Progression) ist bewusst **nicht** Teil dieses POC.

### Leitfrage für die Bewertung nach dem Bau
Nach dem Implementieren wird anhand von drei Fragen entschieden, ob das Prinzip trägt:

1. Fühlt sich das Bremsmanöver (180°-Drehung + Hauptschub) befriedigend an?
2. Sind die Steuerdüsen im Nahbereich präzise genug, ohne nervig zu sein?
3. Erzeugt die Treibstoffgrenze Spannung statt Frust?

Wenn 2 von 3 mit „Ja" beantwortet werden, trägt das Prinzip.

---

## 2. Spielziel & Game-Loop

Das Schiff startet frei im Raum. Der vollständige Missionszyklus:

1. Zu **Station A** fliegen (Reisephase).
2. An Station A andocken (Dockingphase) → Fracht wird automatisch geladen.
3. Zu **Station B** fliegen (Reisephase).
4. An Station B andocken (Dockingphase) → Fracht wird entladen → **Score +1**.
5. Zyklus wiederholt sich (B → A → B → …).

- Treibstoff ist begrenzt. Wer zu verschwenderisch beschleunigt oder bremst, kommt nicht an.
- **Treibstoff leer ≠ Game Over.** Der Schub fällt aus, das Schiff gleitet weiter.
- Bei erfolgreichem Andocken wird der Tank **vollständig aufgefüllt**.

---

## 3. Physik-Modell (Zero-G, Zero-Friction)

- **Keine globale Gravitation.**
- **Kein Drag/Reibungsverlust.** Ein einmal beschleunigtes Schiff gleitet endlos weiter.
- **Schub addiert Kraftvektoren** auf die Geschwindigkeit, die Geschwindigkeit wird auf die Position addiert.

### 3.1 Konstanten

| Konstante | Wert | Bedeutung |
|---|---|---|
| `THRUST_MAIN` | `0.08` | Hauptschub-Kraft pro Frame (px/frame²) |
| `THRUST_RCS` | `0.012` | Steuerdüsen-Kraft (~15 % der Hauptkraft) |
| `ROT_ACCEL` | `0.004` | Drehbeschleunigung pro Frame (rad/frame²) |
| `ROT_DAMP` | `0.96` | Dämpfung des Drehimpulses |
| `V_DOCK_MAX` | `0.4` | maximale Andockgeschwindigkeit (px/frame) |
| `ANGLE_DOCK_TOL` | `20°` | Winkeltoleranz beim Andocken |
| `DOCK_RADIUS` | `30` | Radius der Dock-Zone (px, World-Space) |
| `RCS_ZONE_RADIUS` | `300` | Annäherungsradius, ab dem Steuerdüsen aktiv werden |
| `FUEL_START` | `300` | Anfangstreibstoff (erhöht, um Andocken zu ermöglichen) |
| `FUEL_MAIN` | `1.0` | Verbrauch Hauptschub pro Frame |
| `FUEL_RCS` | `0.15` | Verbrauch pro Steuerdüsen-Impuls |
| `RCS_PULSE_MS` | `150` | Dauer eines Steuerdüsen-Einzelimpulses |
| `ARM_LENGTH` | `40` | Länge des Docking-Arms (px) |

### 3.2 Rotation

Rotation mit Drehträgheit: Drehinput erhöht `angularVel`, die pro Frame auf `angle` addiert wird. Leichte Dämpfung (`ROT_DAMP = 0.96`).

### 3.3 Weltgrenzen

- **Keine harten Grenzen, kein Abprallen.**
- Wenn die Zielstation außerhalb des sichtbaren Bildschirmbereichs ist, erscheint ein **roter Richtungspfeil am Bildschirmrand**, der direkt auf die Zielstation zeigt.
- Der Pfeil verschwindet, sobald die Zielstation wieder auf dem Bildschirm sichtbar ist.
- Neben dem Pfeil wird die aktuelle **Distanz** zur Zielstation angezeigt.

---

## 4. Steuerungskonzept

### 4.1 Reisephase — Drehen + Hauptschub

Grobe, mächtige Düse für Strecke und große Kursänderungen. Bewusst zu grob fürs Einparken — erzwingt ein Bremsmanöver vor der Station.

### 4.2 Dockingphase — Steuerdüsen per Tap

- Tap neben dem Schiff = Impuls in diese Richtung (zieht das Schiff dorthin)
- **Totzone** um das Schiff (Radius ~25px): Tap auf Schiff = automatischer Gegenschub (Bremse)
- Kontextueller Moduswechsel durch Nähe zur Station, kein manueller Knopf

### 4.3 Eingabe-Mapping

| Aktion | Mobile (iPhone 13) | Desktop |
|---|---|---|
| Drehen + Hauptschub | Touch in Richtung Zielpunkt (außerhalb RCS-Zone) | Pfeiltasten ← → (drehen), ↑ (Schub) |
| Steuerdüsen-Impuls | Tap neben Schiff (innerhalb RCS-Zone) | W / A / S / D |
| Brems-Geste | Tap auf Schiff (Totzone) | Leertaste |

---

## 5. Docking-Mechanik

Andocken zählt als Erfolg wenn **alle drei Bedingungen** gleichzeitig erfüllt sind:

1. **Position:** Schiffsmitte innerhalb `DOCK_RADIUS` um den **Port am Arm-Ende** (nicht Stationszentrum).
2. **Geschwindigkeit:** `speed < V_DOCK_MAX`
3. **Orientierung:** Schiffswinkel innerhalb `±ANGLE_DOCK_TOL` der Anflugrichtung (`dockAngle + π`)

### 5.1 Andock-Ablauf (automatisch bei Erfüllung aller drei Bedingungen)

1. Schiff wird für **1,5 Sekunden** am Port eingefroren (Position + Winkel fixiert, Physik pausiert).
2. Tank wird auf `FUEL_START` aufgefüllt.
3. Cargo wird geladen (leer → geladen) oder entladen (geladen → leer + Score +1).
4. Port der Station **leuchtet grün** für die Dauer des Timers.
5. Nach Ablauf: Schiff wird freigegeben, Zielstation wechselt automatisch.

### 5.2 Visuelles Feedback während des Anflugs

Der Dock-Ring am Port färbt sich live:

| Farbe | Bedeutung |
|---|---|
| **Rot** | **Geschwindigkeit oder Winkel noch nicht korrekt** – nicht bereit für Andocken |
| **Gelb** | Geschwindigkeit UND Winkel sind korrekt – nur noch Position anpassen, um einzurasten |
| **Grün** | alle Bedingungen (Position, Geschwindigkeit, Winkel) erfüllt → Andocken wird automatisch ausgelöst |

Zusätzlich ein **Geschwindigkeitsvektor-Pfeil** am Schiff (skaliert mit Zoom).

---

## 6. Kamera

- Folgt dem Schiff smooth per Lerp (`CAMERA_LERP = 0.08`).
- Zoomt basierend auf der **Distanz zur nächsten Station** (egal ob Ziel oder nicht):
  - Nähe (< 200px Distanz): `zoom = 1.0` (maximale Detailansicht)
  - Ferne (> 900px Distanz): `zoom = 0.6` (Überblick)
  - Interpolation mit `CAMERA_ZOOM_SPEED = 0.05`
- **Alle Objekte skalieren mit dem Zoom:** Schiff, Flamme, Station, Velocity-Vektor.
- Zoom bleibt groß direkt nach dem Andocken und fährt erst raus wenn das Schiff wegfliegt.
- Kamera startet initial auf Schiffsposition (kein Einflug-Effekt beim Start).

---

## 7. Stationen

### 7.1 Layout

- **Station A:** Position `(200, 1200)`, Docking-Arm zeigt nach rechts (`dockAngle = 0`)
- **Station B:** Position `(1800, 300)`, Docking-Arm zeigt nach links (`dockAngle = π`)
- Stationen „schauen sich an" — der Anflugkorridor verläuft zwischen ihnen.

### 7.2 Optik (ISS-artig)

- **Zentraler Truss-Balken** (horizontaler Verbindungsträger)
- **3 Körpermodule** unterschiedlicher Größe mit Konturlinien entlang des Truss
- **4 Solarflügel-Paare** (je 2 oben und 2 unten, dunkelblau `#1a3a5c`) mit Gitterlinien
- **Streben** verbinden Solarflügel mit dem Truss
- Alle Elemente skalieren mit `cam.zoom`

### 7.3 Docking-Arm

- Dünner Ausleger (`ARM_LENGTH = 40px`) in `dockAngle`-Richtung
- Kleines **Gelenk** (Kreis) in der Mitte des Arms als visuelles Detail
- **Port** am Arm-Ende: Kreis in der Dock-Statusfarbe (rot/gelb/grün)
- **Anflug-Pfeil** (weißer Pfeil) zeigt woher das Schiff kommen muss (entgegengesetzt zu `dockAngle`)
- **Anflug-Kegel** (halbtransparente Linien) zeigt den erlaubten Einflugbereich
- Bei erfolgreichem Andocken: grüner **Leuchtring** um den Port

---

## 8. HUD

### 8.1 Oben links
- Fuel-Balken (grün → leer)
- Fuel-Wert als Zahl
- Aktuelle Geschwindigkeit (Speed)
- Cargo-Status (`Empty` / `Loaded`)

### 8.2 Oben rechts
- Score (Anzahl abgeschlossener Lieferungen)
- Distanz zum Ziel-Port
- Winkelabweichung zur Andockrichtung (in Grad, 0° = perfekt ausgerichtet)
- Dock-Status-Ampel (farbiges Quadrat: rot / gelb / grün)

### 8.3 Zentriert (temporär während Andocken)
- „Docked! Transferring…" Overlay für 1,5 Sekunden nach erfolgreichem Andocken

---

## 9. Schiff

- Dreieckige Form (Spitze = Vorwärtsrichtung)
- Triebwerksflamme (orange) erscheint **nur bei aktivem Hauptschub** (`flags.thrustMain === true`), nicht bei bloßer Bewegung
- Größe skaliert mit `cam.zoom`
- State: `x, y, vx, vy, angle, angularVel, fuel, cargo, dockedTimer`

---

## 10. Architektur & Modulstruktur

```
main.js              // Game-Loop, Init, Zustandsmaschine, handleDocking()
physics.js           // updatePhysics(): Flags → Vektoren → Position
ship.js              // createShip(): initialer Schiffs-State
station.js           // createStation(), checkDock(), dockColor(), getPortPosition()
camera.js            // createCamera(), updateCamera(), worldToScreen(), screenToWorld()
input-mobile.js      // Touch-Zonen / Taps → setzt nur Flags
input-desktop.js     // Keyboard → setzt nur Flags
hud.js               // Stub (Rendering direkt in renderer.js für POC)
renderer.js          // drawShip(), drawStation(), drawVelocityVec(), drawTargetArrow(), drawHud()
constants.js         // Alle Tuning-Konstanten zentral
```

### 10.1 Koordinatensystem

- Physik und Weltpositionen in **World-Space** (px)
- Rendering ausschließlich über `worldToScreen(cam, x, y, canvas)` → **logische CSS-Pixel** (`clientWidth/clientHeight`), nicht physische Canvas-Pixel
- `ctx.setTransform(devicePixelRatio, …)` in `resize()` sorgt für Schärfe auf HiDPI-Displays

---

## 11. Bewusste Nicht-Ziele (Scope-Grenze)

- Sound, Musik, Menüs, Startbildschirm
- Mehrere Level, Progression, Highscores
- Hindernisse / Asteroiden
- Harte Weltgrenzen-Kollision oder Abprallen
- Allseitig anfliegbare Stationen
- Persistenz / Speicherstände
