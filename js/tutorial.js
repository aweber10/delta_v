import { normalizeAngle, RCS_ZONE_RADIUS_PX } from './constants.js';
import { worldToScreen } from './camera.js';

export function createTutorial() {
  return {
    step: 0,
    stepStartTime: performance.now(),
    // Tracking-Flags
    hasRotated: 0,
    hasThrust: false,
    hasRcs: false,
    hadHighSpeed: false,      // Schritt 2: Haupttriebwerk genutzt
    hasSlowedDown: false,     // Schritt 5: Geschwindigkeit nach hoher Speed reduziert
    hasPickedUpCargo: false,  // Schritt 7: Fracht aufgenommen
    completed: false,
    _nearStation: false,
    _stationVisible: false,
    _stationWasSeen: false,  // Station war mindestens einmal sichtbar → RCS-Schritt darf starten
    messages: [
      // 0 — Mission Briefing
      {
        title: "Willkommen, Pilot!",
        text: "Dein Ziel: Fliege zu Station A, docke an und nimm die Fracht auf.",
        subtext: "Der Pfeil am Bildschirmrand zeigt dir immer die Richtung zur Station.",
        arrowBlink: true,
      },
      // 1 — Rotation
      {
        title: "1. Schiff ausrichten",
        text: "Richte dein Schiff auf ein Ziel aus.",
        desktop: "Klicke außerhalb der blauen Zone.",
        mobile:  "Tippe außerhalb der blauen Zone.",
      },
      // 2 — Haupttriebwerk
      {
        title: "2. Haupttriebwerk",
        text: "Beschleunige kraftvoll in Blickrichtung — außerhalb der blauen Zone.",
        desktop: "Halte die Maus außen gedrückt.",
        mobile:  "Halte den Finger außerhalb der blauen Zone.",
        subtext: "Hoher Schub für große Entfernungen. Nutze ihn um Fahrt aufzunehmen.",
      },
      // 3 — Trägheit
      {
        title: "3. Drift im Weltraum",
        text: "Im Weltraum gibt es keinen Widerstand. Deine Drift bleibt erhalten.",
        subtext: "Du musst aktiv gegensteuern, um zu bremsen oder die Richtung zu ändern.",
      },
      // 4 — Gerichteter Bremsimpuls
      {
        title: "4. Gezielt bremsen",
        text: "Doppel-Tap in Gegenrichtung bremst deine Drift entlang dieser Achse.",
        desktop: "Doppelklick exakt entgegen der Bewegung stoppt das Schiff vollständig.",
        mobile:  "Doppel-Tap exakt entgegen der Bewegung stoppt das Schiff vollständig.",
        subtext: "Tippst du seitlich versetzt, bleibt die seitliche Drift erhalten.",
        arrowBlink: true,
      },
      // 5 — RCS-Steuerdüsen
      {
        title: "5. RCS-Steuerdüsen",
        text: "Präzise Korrekturen in der Nähe der Station — innerhalb der blauen Zone.",
        desktop: "Klicke in die blaue Zone.",
        mobile:  "Tippe kurz innerhalb der blauen Zone.",
        subtext: "Sparsamer Verbrauch, ideal für das finale Andockmanöver.",
      },
      // 6 — Docking
      {
        title: "6. Andocken",
        text: "Nähere dich langsam dem Port von Station A.",
        subtext: "Achte auf Geschwindigkeit und Winkel — dann dockt das Schiff automatisch an.",
      },
      // 7 — Lieferung
      {
        title: "Fracht aufgenommen!",
        text: "Fliege nun zur Station B und liefere die Fracht ab.",
        subtext: "Der Pfeil zeigt dir die neue Richtung.",
        arrowBlink: true,
      },
    ]
  };
}

export function updateTutorial(tut, ship, flags, dt) {
  if (tut.completed) return;
  const now = performance.now();
  const stepAge = now - tut.stepStartTime;
  const speed = Math.hypot(ship.vx, ship.vy);

  switch (tut.step) {
    case 0: // Mission Briefing — Mindestanzeigezeit 10 s
      if (stepAge > 10000) nextStep(tut);
      break;

    case 1: // Rotation — Mindest 5 s; endet früher sobald Fahrt aufgenommen
      tut.hasRotated += Math.abs(ship.angularVel * dt);
      if (stepAge > 5000 && tut.hasRotated > 1.5) nextStep(tut);
      if (speed > 0.6) nextStep(tut); // sofort weiter wenn Spieler bereits Gas gibt
      break;

    case 2: // Haupttriebwerk — Mindestanzeigezeit 5 s + ordentlicher Schub
      if (speed > 0.6) tut.hadHighSpeed = true;
      if (stepAge > 5000 && tut.hadHighSpeed) nextStep(tut);
      break;

    case 3: // Trägheit — Mindestanzeigezeit 5 s
      if (stepAge > 5000 && speed > 0.15) nextStep(tut);
      break;

    case 4: // Bremsimpuls — weitergehen erst wenn abgebremst UND Station sichtbar
      if (speed > 1.5) tut.hadHighSpeed = true;
      if (tut.hadHighSpeed && speed < 0.5 && stepAge > 3000) {
        tut.hasSlowedDown = true;
      }
      // Zu Schritt 5 nur wenn Station gerade sichtbar — sonst hier bleiben
      if (tut.hasSlowedDown && tut._stationVisible) nextStep(tut);
      break;

    case 5: // RCS-Düsen — Station ist sichtbar wenn dieser Schritt beginnt.
      // Weiterschalten: RCS benutzt in Stationsnähe, oder nach 8 s Fallback.
      if (flags.rcsFlash && tut._nearStation && stepAge > 5000) nextStep(tut);
      if (stepAge > 8000) nextStep(tut);
      break;

    case 6: // Docking — Fracht aufnehmen
      if (ship.cargo > 0 && !tut.hasPickedUpCargo) {
        tut.hasPickedUpCargo = true;
        nextStep(tut);
      }
      break;

    case 7: // Lieferung — Tutorial abschließen wenn Fracht abgeliefert
      // cargo wechselt zurück zu 0 nach erfolgreicher Lieferung
      if (tut.hasPickedUpCargo && ship.cargo === 0 && stepAge > 2000) {
        tut.completed = true;
      }
      break;
  }
}

/**
 * Wird von main.js aufgerufen um der Tutorial-Instanz die aktuelle
 * Stationsnähe mitzuteilen (saubere Entkopplung).
 */
export function setTutorialNearStation(tut, isNear) {
  tut._nearStation = isNear;
}

export function setTutorialStationVisible(tut, isVisible) {
  tut._stationVisible = isVisible;
  // Sobald die Station erstmals sichtbar wird, merken — dann darf RCS-Schritt starten
  if (isVisible) tut._stationWasSeen = true;
}

function nextStep(tut) {
  tut.step++;
  tut.stepStartTime = performance.now();
}

export function drawTutorial(ctx, canvas, tut, ship, flags, cam) {
  if (tut.completed || tut.step >= tut.messages.length) return;

  const msg = tut.messages[tut.step];
  const isMobile = 'ontouchstart' in window;
  const width  = canvas.clientWidth;
  const height = canvas.clientHeight;
  const now    = performance.now();
  const stepAge = now - tut.stepStartTime;

  // --- Textbox-Dimensionen ---
  const hasHint = isMobile ? !!msg.mobile : !!msg.desktop;
  const hasSubtext = !!msg.subtext;
  const lineCount = 1 + (hasHint ? 1 : 0) + (hasSubtext ? 1 : 0);
  const boxW = Math.min(420, width - 40);
  const boxH = 68 + lineCount * 18;
  const boxX = (width - boxW) / 2;
  // Schritte 0–3 oben anzeigen (Richtungspfeil am unteren Rand bleibt frei).
  // Ab Schritt 4 unten, da die visuellen Highlights am Schiff dann im Bild sind.
  const boxY = tut.step <= 3
    ? 56                          // oben, unterhalb HUD
    : height - boxH - 44;         // unten wie bisher

  // --- Zeichne Textbox ---
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 12, 0.92)';
  ctx.strokeStyle = 'rgba(143, 208, 255, 0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, boxX, boxY, boxW, boxH, 12);
  ctx.fill();
  ctx.stroke();

  // Fortschritts-Indikator (max. 7 sichtbare Lernschritte, Schritt 7 = Bonus)
  ctx.fillStyle = '#8fd0ff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'right';
  const displayStep = Math.min(tut.step + 1, 7);
  ctx.fillText(`${displayStep} / 7`, boxX + boxW - 14, boxY + 20);

  // Titel
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(msg.title, boxX + 18, boxY + 26);

  // Haupttext (zweizeilig falls nötig)
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#c8d3df';
  let textY = boxY + 46;
  wrapText(ctx, msg.text, boxX + 18, textY, boxW - 36, 17);
  textY += countWrappedLines(ctx, msg.text, boxW - 36) * 17;

  // Steuerungshinweis
  const controlHint = isMobile ? msg.mobile : msg.desktop;
  if (controlHint) {
    textY += 6;
    ctx.font = 'italic 12px sans-serif';
    ctx.fillStyle = '#8fd0ff';
    wrapText(ctx, controlHint, boxX + 18, textY, boxW - 36, 16);
    textY += countWrappedLines(ctx, controlHint, boxW - 36) * 16;
  }

  // Subtext
  if (msg.subtext && !controlHint) {
    textY += 6;
    ctx.font = 'italic 12px sans-serif';
    ctx.fillStyle = '#8fd0ff';
    wrapText(ctx, msg.subtext, boxX + 18, textY, boxW - 36, 16);
  } else if (msg.subtext && controlHint) {
    textY += 4;
    ctx.font = 'italic 11px sans-serif';
    ctx.fillStyle = 'rgba(143, 208, 255, 0.75)';
    wrapText(ctx, msg.subtext, boxX + 18, textY, boxW - 36, 15);
  }

  ctx.restore();

  // --- Pfeil-Blink bei bestimmten Schritten ---
  if (msg.arrowBlink) {
    drawArrowBlink(ctx, ship, tut, cam, canvas, now);
  }

  // --- Schritt-spezifische visuelle Highlights ---
  const p = worldToScreen(cam, ship.x, ship.y, canvas);
  const z = cam.zoom;

  if (tut.step === 1) {
    // Rotation: gepunkteter Kreis um das Schiff
    ctx.save();
    ctx.strokeStyle = 'rgba(143, 208, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 42 * z, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (tut.step === 2) {
    // Haupttriebwerk: Pfeil vor dem Schiff + Außenzone-Hinweisring
    ctx.save();
    ctx.translate(p.x, p.y);

    // Äußerer Hinweisring (Schubzone)
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, RCS_ZONE_RADIUS_PX * 2.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Schub-Pfeil vor dem Schiff
    ctx.rotate(ship.angle);
    ctx.fillStyle = 'rgba(255, 165, 0, 0.65)';
    ctx.beginPath();
    ctx.moveTo(34 * z, 0);
    ctx.lineTo(22 * z, -6 * z);
    ctx.lineTo(22 * z,  6 * z);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  if (tut.step === 3) {
    // Trägheit: Geschwindigkeitsvektor Glow
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > 0.15) {
      ctx.save();
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00ffff';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + ship.vx * 22 * z, p.y + ship.vy * 22 * z);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (tut.step === 4) {
    const speed = Math.hypot(ship.vx, ship.vy);

    if (speed > 0.2) {
      // Bremsimpuls: Gegenrichtungs-Pfeil + Vektor-Glow
      const velAngle = Math.atan2(ship.vy, ship.vx);
      const oppAngle = velAngle + Math.PI;

      ctx.save();

      // Aktueller Geschwindigkeitsvektor (cyan, gedimmt)
      ctx.strokeStyle = 'rgba(0, 220, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + ship.vx * 22 * z, p.y + ship.vy * 22 * z);
      ctx.stroke();
      ctx.setLineDash([]);

      // Bremsrichtungs-Pfeil (rot, in Gegenrichtung)
      ctx.translate(p.x, p.y);
      ctx.rotate(oppAngle);
      ctx.fillStyle = 'rgba(255, 90, 90, 0.80)';
      ctx.beginPath();
      ctx.moveTo(42 * z, 0);
      ctx.lineTo(26 * z, -8 * z);
      ctx.lineTo(26 * z,  8 * z);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    } else if (!tut._stationVisible && tut._arrowTarget) {
      // Nach dem Abbremsen, Station noch nicht in Sichtweite:
      // Richtungspfeil dauerhaft sanft pulsieren lassen
      drawArrowPulse(ctx, ship, tut, canvas, now);
    }
  }

  if (tut.step === 5) {
    // RCS-Zone: gefüllter blauer Kreis um das Schiff
    ctx.save();
    ctx.fillStyle = 'rgba(30, 130, 255, 0.10)';
    ctx.strokeStyle = 'rgba(80, 160, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, RCS_ZONE_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Dauerhafter sanfter Richtungspfeil-Puls (nach Abbremsen, Station noch weit)
// ---------------------------------------------------------------------------
function drawArrowPulse(ctx, ship, tut, canvas, now) {
  if (!tut._arrowTarget) return;

  const width  = canvas.clientWidth;
  const height = canvas.clientHeight;
  const cx = width / 2;
  const cy = height / 2;

  const dx = tut._arrowTarget.x - ship.x;
  const dy = tut._arrowTarget.y - ship.y;
  if (Math.hypot(dx, dy) < 10) return;

  const angle = Math.atan2(dy, dx);
  const edgeR = Math.min(cx, cy) - 48;
  const arrowX = cx + Math.cos(angle) * edgeR;
  const arrowY = cy + Math.sin(angle) * edgeR;

  // Sanfte, kontinuierliche Sinuspulse (1 Hz)
  const alpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(now * 0.006));

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(arrowX, arrowY);
  ctx.rotate(angle);

  ctx.strokeStyle = 'rgba(255, 230, 80, 0.9)';
  ctx.lineWidth = 3;
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'rgba(255, 220, 40, 0.8)';
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Richtungspfeil-Blink (3x pulsieren wenn ein Schritt mit arrowBlink startet)
// ---------------------------------------------------------------------------
function drawArrowBlink(ctx, ship, tut, cam, canvas, now) {
  const stepAge = now - tut.stepStartTime;
  const BLINK_DURATION = 2400; // 3 Blinker à 800 ms
  if (stepAge > BLINK_DURATION) return;

  // Pulsierender Alpha: 3 Zyklen
  const cycle = (stepAge % 800) / 800; // 0..1 pro Zyklus
  const alpha = Math.sin(cycle * Math.PI); // sanftes Ein/Ausblenden

  if (alpha < 0.05) return;

  const width  = canvas.clientWidth;
  const height = canvas.clientHeight;
  const cx = width / 2;
  const cy = height / 2;

  // Richtung zur Zielstation aus Schiffssicht
  const dx = tut._arrowTarget
    ? tut._arrowTarget.x - ship.x
    : 0;
  const dy = tut._arrowTarget
    ? tut._arrowTarget.y - ship.y
    : 0;

  if (Math.hypot(dx, dy) < 10) return;

  const angle = Math.atan2(dy, dx);
  const edgeR = Math.min(cx, cy) - 48;
  const arrowX = cx + Math.cos(angle) * edgeR;
  const arrowY = cy + Math.sin(angle) * edgeR;

  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  ctx.translate(arrowX, arrowY);
  ctx.rotate(angle);

  // Pulsierender Glow-Ring
  ctx.strokeStyle = 'rgba(255, 230, 80, 0.9)';
  ctx.lineWidth = 4;
  ctx.shadowBlur = 14;
  ctx.shadowColor = 'rgba(255, 220, 40, 0.9)';
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Setzt das Blink-Ziel des Pfeils (wird von main.js mit der aktuellen
 * Zielstation gefüllt, damit drawTutorial keine direkte Abhängigkeit hat).
 */
export function setTutorialArrowTarget(tut, station) {
  tut._arrowTarget = station;
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      ctx.fillText(line.trimEnd(), x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trimEnd(), x, y);
}

function countWrappedLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  let line = '';
  let count = 1;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      line = words[n] + ' ';
      count++;
    } else {
      line = testLine;
    }
  }
  return count;
}
