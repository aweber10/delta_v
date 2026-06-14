# Delta V

Spiele Delta V direkt im Browser:

https://aweber10.github.io/delta_v/

Delta V ist ein Zero-G-Frachtspiel über Drift, Treibstoff und präzises Andocken. Du fliegst Lieferungen durch das Calder-System, nutzt Schwung statt Dauerfeuer und lernst, früh zu bremsen.

## Steuerung

Die Hauptsteuerung funktioniert mit Maus oder Touch.

- Tippe oder klicke außerhalb der Zone um das Schiff, um einen Zielwinkel zu setzen.
- Kurzer Tap: kurzer Reiseimpuls, sobald das Schiff ausgerichtet ist.
- Halten: Hauptschub in Richtung des Zielwinkels.
- Doppeltap: Bremsimpuls, sobald das Schiff passend ausgerichtet ist.
- Tippe oder klicke in die Zone um das Schiff, um einen kurzen Steuerdüsen-Impuls in diese Richtung auszulösen.

## Fluggefühl

Hauptschub beschleunigt dein Schiff, bremst aber nicht automatisch. Wenn du zu spät abbremst, treibst du am Ziel vorbei oder kommst zu schnell zum Andocken.

Steuerdüsen sind für kleine Korrekturen gedacht. Sie helfen beim Ausrichten, beim Abbau von Restdrift und beim letzten Meter vor dem Docking-Port. Jeder Impuls kostet Treibstoff, also sind ruhige Kurse meist besser als hektische Korrekturen.

## Andocken

Andocken funktioniert nur, wenn alle Bedingungen gleichzeitig passen:

- Du bist nah genug am Docking-Port: maximal `30 px`.
- Deine Relativgeschwindigkeit ist niedrig genug: unter `0.4 px/frame`.
- Dein Schiff ist korrekt ausgerichtet: innerhalb von `20 Grad` zum Andockwinkel.

Das HUD zeigt den Docking-Zustand farbig:

- Gruen: Andocken ist moeglich.
- Gelb: Geschwindigkeit und Winkel passen, aber du bist noch nicht nah genug.
- Rot: mindestens eine Bedingung passt noch nicht.

## Treibstoff

Hauptschub verbraucht kontinuierlich Treibstoff. Steuerdüsen verbrauchen pro Impuls wenig Treibstoff. In manchen Leveln fuellt ein erfolgreiches Andocken den Tank wieder auf.
