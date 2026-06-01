# Delta V — Anforderungen

**Status:** Produktentwicklung nach erfolgreichem POC  
**Zielplattform:** Mobile Browser und PWA, primär Touch-Geräte wie iPhone 13, ohne gerätespezifische Optimierung  
**Technologie:** JavaScript + HTML5 Canvas, Single-Page, keine Frameworks  
**Performance-Ziel:** stabile 60 FPS auf aktuellen Mobilgeräten

---

## 1. Produktziel

Delta V ist ein Zero-G-Cargo-Spiel über präzises Fliegen, Bremsen und Andocken. Der erfolgreiche POC bildet das erste Level und bleibt die Grundlage für die Kernmechanik.

Das Spiel soll mobil als PWA spielbar sein. Eine Installation auf dem Homescreen soll möglich sein, der Canvas füllt den Bildschirm, Touch-Eingaben sollen nicht durch Browser-Gesten gestört werden.

---

## 2. Level-Struktur

Das Spiel wird zukünftig aus mehreren Leveln bestehen. Jedes Level definiert mindestens:

- Startposition und Startzustand des Schiffs
- Stationen und Zielreihenfolge
- Missionsziel
- Treibstoff- und Dockingparameter
- Abschlussbedingung
- optionale Hindernisse oder Sonderregeln

### 2.1 Level 1: First Delivery

Level 1 entspricht dem bisherigen POC-Inhalt:

1. Das Schiff startet frei im Raum.
2. Der Spieler fliegt zu Station A.
3. An Station A wird Fracht automatisch geladen.
4. Der Spieler fliegt zu Station B.
5. An Station B wird Fracht automatisch entladen.
6. Nach erfolgreicher Entladung ist Level 1 abgeschlossen.

**Abschlussbedingung:** Das erste Level ist geschafft, sobald der Spieler genau einen Transport erfolgreich durchgeführt hat: Fracht an Station A aufnehmen und an Station B abliefern.

---

## 3. Game-Loop

Der grundlegende Missionszyklus bleibt:

1. Zur Zielstation fliegen.
2. Geschwindigkeit abbauen und korrekt ausrichten.
3. Andocken.
4. Fracht laden oder entladen.
5. Bei Lieferung Score erhöhen und Levelabschluss prüfen.

Treibstoff ist begrenzt. Treibstoff leer ist kein Game Over; der Schub fällt aus und das Schiff gleitet weiter. Bei erfolgreichem Andocken wird der Tank vollständig aufgefüllt.

---

## 4. Startscreen und App-Shell

Das Spiel startet nicht direkt in der Simulation, sondern mit einem Startscreen.

Der Startscreen muss:

- Level und Spieltitel zeigen
- den ersten Start per Nutzerinteraktion auslösen
- Audio auf iOS-kompatible Weise freischalten
- eine Sound-Umschaltung anbieten

Während der Startscreen sichtbar ist, läuft keine Physik-Simulation. Nach dem Levelabschluss erscheint ein Abschlussbildschirm mit Neustart-Option.

---

## 5. Sound

Sound ist ab der Produktphase Teil des Spiels.

Pflichtsounds:

- Spielstart: kurzer Bestätigungston nach dem Start
- Andocken: klar erkennbarer Docking-Sound, sobald das Manöver erfolgreich war
- Lieferung abgeschlossen: eigener positiver Abschlussklang nach erfolgreichem Transport

Der Docking-Sound muss deutlich genug sein, dass erfolgreiches Andocken nicht nur visuell, sondern auch akustisch erkennbar ist. Audio darf erst nach einer Nutzerinteraktion starten, damit mobile Browser es zuverlässig erlauben.

---

## 6. PWA-Anforderungen

Die App muss als PWA bereitgestellt werden:

- Web App Manifest mit Name, Start-URL, Display-Modus, Theme-Farbe und Icon
- Service Worker für statische App-Dateien
- mobile Meta-Tags für Homescreen-Nutzung und Vollbilddarstellung
- responsive Canvas-Größe mit HiDPI-Schärfe
- keine Optimierung nur für ein einzelnes Gerät

Die Zielplattform ist Mobile-first, Desktop bleibt als sekundäre Test- und Spielumgebung erhalten.

---

## 7. Physik-Modell

- Keine globale Gravitation.
- Kein Drag/Reibungsverlust.
- Schub addiert Kraftvektoren auf die Geschwindigkeit.
- Geschwindigkeit wird auf die Position addiert.

### 7.1 Konstanten

| Konstante | Wert | Bedeutung |
|---|---:|---|
| `THRUST_MAIN` | `0.08` | Hauptschub-Kraft pro Frame |
| `THRUST_RCS` | `0.012` | Steuerdüsen-Kraft |
| `ROT_ACCEL` | `0.004` | Drehbeschleunigung pro Frame |
| `ROT_DAMP` | `0.96` | Dämpfung des Drehimpulses |
| `V_DOCK_MAX` | `0.4` | maximale Andockgeschwindigkeit |
| `ANGLE_DOCK_TOL` | `20°` | Winkeltoleranz beim Andocken |
| `DOCK_RADIUS` | `30` | Radius der Dock-Zone |
| `RCS_ZONE_RADIUS` | `300` | Annäherungsradius für Steuerdüsen |
| `FUEL_START` | `300` | Start- und Auffülltreibstoff |
| `FUEL_MAIN` | `1.0` | Verbrauch Hauptschub pro Frame |
| `FUEL_RCS` | `0.15` | Verbrauch pro Steuerdüsen-Impuls |
| `RCS_PULSE_MS` | `150` | Dauer eines Steuerdüsenimpulses |
| `ARM_LENGTH` | `40` | Länge des Docking-Arms |

---

## 8. Steuerung

### 8.1 Mobile

- Touch außerhalb der RCS-Zone: Reisephase mit Ausrichtung und Hauptschub
- Tap neben dem Schiff innerhalb der RCS-Zone: Steuerdüsenimpuls in Tap-Richtung
- Tap auf das Schiff: Bremsimpuls entgegen der aktuellen Bewegung

### 8.2 Desktop

- Pfeiltasten links/rechts: Drehen
- Pfeiltaste hoch: Hauptschub
- W/A/S/D: Steuerdüsen
- Leertaste: Bremsimpuls

---

## 9. Docking

Andocken zählt als Erfolg, wenn alle Bedingungen gleichzeitig erfüllt sind:

1. Schiffsmitte innerhalb `DOCK_RADIUS` um den Port am Arm-Ende.
2. Geschwindigkeit kleiner als `V_DOCK_MAX`.
3. Schiffswinkel innerhalb `±ANGLE_DOCK_TOL` der Anflugrichtung.

### 9.1 Andock-Ablauf

1. Schiff wird kurz am Port fixiert.
2. Tank wird auf `FUEL_START` aufgefüllt.
3. Fracht wird geladen oder entladen.
4. Docking-Sound wird abgespielt.
5. Bei Entladung wird der Score erhöht und die Levelabschlussbedingung geprüft.

### 9.2 Visuelles Feedback

| Farbe | Bedeutung |
|---|---|
| Rot | Geschwindigkeit oder Winkel noch nicht korrekt |
| Gelb | Geschwindigkeit und Winkel korrekt, Position fehlt |
| Grün | alle Bedingungen erfüllt, Andocken wird ausgelöst |

---

## 10. Kamera und HUD

Die Kamera folgt dem Schiff smooth und zoomt abhängig von der Distanz zur nächsten Station.

Das HUD zeigt:

- Level
- Fuel-Balken und Fuel-Wert
- Geschwindigkeit
- Cargo-Status
- Score
- Distanz zum Ziel-Port
- Winkelabweichung
- Dock-Status

Bei Zielstationen außerhalb des Bildschirms zeigt ein roter Richtungspfeil mit Distanzangabe zum Ziel.

---

## 11. Architektur

```
index.html           // Canvas, Startscreen, Abschlussbildschirm, PWA-Metadaten
manifest.webmanifest // PWA-Manifest
sw.js                // Service Worker für statische App-Dateien
main.js              // Game-Loop, Init, Zustandsmaschine, handleDocking()
audio.js             // Web-Audio-Sounds und Mute-State
physics.js           // updatePhysics(): Flags -> Vektoren -> Position
ship.js              // createShip(): initialer Schiffs-State
station.js           // createStation(), checkDock(), dockColor(), getPortPosition()
camera.js            // createCamera(), updateCamera(), worldToScreen(), screenToWorld()
input-mobile.js      // Touch-Zonen / Taps -> setzt Flags
input-desktop.js     // Keyboard -> setzt Flags
renderer.js          // Canvas-Rendering
constants.js         // Tuning-Konstanten
```

---

## 12. Nächste Ausbaustufen

- Level-Konfigurationen aus Datenstruktur statt fest verdrahteter Stationen
- Levelauswahl oder Progression
- zusätzliche Levelziele und Varianten
- persistenter Fortschritt
- bessere Icon-Assets für App Stores und iOS Homescreen
