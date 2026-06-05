import { normalizeAngle } from './constants.js';
import { worldToScreen } from './camera.js';

export function createTutorial() {
  return {
    step: 0,
    startTime: performance.now(),
    stepStartTime: performance.now(),
    hasRotated: 0,
    hasThrust: false,
    hasRcs: false,
    hadHighSpeed: false,
    completed: false,
    messages: [
      {
        title: "Willkommen Pilot!",
        text: "Steuere dein Schiff zu Station A, um die Fracht aufzunehmen.",
        subtext: "Das Tutorial führt dich durch die Grundlagen."
      },
      {
        title: "1. Rotation",
        text: "Richte dein Schiff auf ein Ziel aus.",
        desktop: "Klicke außerhalb der blauen Zone oder nutze [ ← ] [ → ].",
        mobile: "Tippe außerhalb der blauen Zone, um das Ziel auszurichten."
      },
      {
        title: "2. Hauptschub",
        text: "Beschleunige dein Schiff in Blickrichtung.",
        desktop: "Halte die Maus außen gedrückt oder nutze [ ↑ ].",
        mobile: "Halte den Finger außerhalb der blauen Zone."
      },
      {
        title: "3. Trägheit",
        text: "Im Weltraum gibt es keinen Widerstand. Deine Drift bleibt erhalten.",
        subtext: "Du musst aktiv in die Gegenrichtung steuern, um zu bremsen."
      },
      {
        title: "4. Bremsen",
        text: "Drehe das Schiff in die Gegenrichtung und gib einen kurzen Schub.",
        desktop: "Doppelklick außen: ausrichten und Bremsimpuls setzen.",
        mobile: "Doppel-Tap außen: ausrichten und Bremsimpuls setzen."
      },
      {
        title: "5. RCS-Feinsteuerung",
        text: "Nutze die Manövrierdüsen für präzise Seitwärtsbewegungen.",
        desktop: "Klicke in die blaue Zone oder nutze [ W A S D ].",
        mobile: "Tippe kurz innerhalb der blauen Zone."
      },
      {
        title: "6. Docking",
        text: "Nähere dich langsam dem Port von Station A.",
        subtext: "Achte auf Geschwindigkeit, Winkel und Position im HUD."
      }
    ]
  };
}

export function updateTutorial(tut, ship, flags, dt) {
  if (tut.completed) return;
  const now = performance.now();
  const stepAge = now - tut.stepStartTime;
  const speed = Math.hypot(ship.vx, ship.vy);

  switch (tut.step) {
    case 0: // Willkommen
      if (stepAge > 3500) nextStep(tut);
      break;
    case 1: // Rotation
      const angleDiff = Math.abs(ship.angularVel * dt);
      tut.hasRotated += angleDiff;
      if (tut.hasRotated > 1.5) nextStep(tut);
      break;
    case 2: // Schub
      if (speed > 0.6) {
        tut.hadHighSpeed = true;
        nextStep(tut);
      }
      break;
    case 3: // Trägheit
      if (stepAge > 3500) nextStep(tut);
      break;
    case 4: // Bremsen
      if (tut.hadHighSpeed && speed < 0.25) nextStep(tut);
      break;
    case 5: // RCS
      if (flags.rcsFlash) nextStep(tut);
      break;
    case 6: // Docking
      if (ship.cargo > 0) {
        tut.completed = true;
      }
      break;
  }
}

function nextStep(tut) {
  tut.step++;
  tut.stepStartTime = performance.now();
}

export function drawTutorial(ctx, canvas, tut, ship, flags, cam) {
  if (tut.completed || tut.step >= tut.messages.length) return;

  const msg = tut.messages[tut.step];
  const isMobile = 'ontouchstart' in window;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // --- Box-Dimensionen ---
  const boxW = Math.min(400, width - 40);
  const boxH = 110;
  const boxX = (width - boxW) / 2;
  const boxY = height - boxH - 40;

  // --- Zeichne Textbox ---
  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 12, 0.9)';
  ctx.strokeStyle = 'rgba(143, 208, 255, 0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, boxX, boxY, boxW, boxH, 12);
  ctx.fill();
  ctx.stroke();

  // Fortschritts-Indikator
  ctx.fillStyle = '#8fd0ff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${tut.step + 1} / 6`, boxX + boxW - 15, boxY + 20);

  // Titel
  ctx.textAlign = 'left';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(msg.title, boxX + 20, boxY + 30);

  // Haupttext
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#c8d3df';
  wrapText(ctx, msg.text, boxX + 20, boxY + 52, boxW - 40, 18);

  // Steuerungshinweis
  ctx.font = 'italic 12px sans-serif';
  ctx.fillStyle = '#8fd0ff';
  const controlHint = isMobile ? msg.mobile : msg.desktop;
  if (controlHint) {
    ctx.fillText(controlHint, boxX + 20, boxY + boxH - 15);
  } else if (msg.subtext) {
    ctx.fillText(msg.subtext, boxX + 20, boxY + boxH - 15);
  }

  // --- Visuelle Highlights ---
  const p = worldToScreen(cam, ship.x, ship.y, canvas);
  const z = cam.zoom;

  if (tut.step === 1) { // Rotation Highlight
    ctx.strokeStyle = 'rgba(143, 208, 255, 0.6)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 40 * z, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (tut.step === 2) { // Schub Pfeil
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ship.angle);
    ctx.fillStyle = 'rgba(255, 165, 0, 0.6)';
    ctx.beginPath();
    ctx.moveTo(30 * z, 0);
    ctx.lineTo(20 * z, -5 * z);
    ctx.lineTo(20 * z, 5 * z);
    ctx.fill();
    ctx.restore();
  }

  if (tut.step === 3) { // Trägheit (Vektor-Glow)
    // Highlight velocity vector
    const vx = ship.vx * 20 * z;
    const vy = ship.vy * 20 * z;
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#0ff';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + vx, p.y + vy);
    ctx.stroke();
  }

  if (tut.step === 4) { // Bremsen Highlight (Gegen-Pfeil)
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > 0.1) {
      const velAngle = Math.atan2(ship.vy, ship.vx);
      const oppAngle = velAngle + Math.PI;
      
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(oppAngle);
      ctx.fillStyle = 'rgba(255, 100, 100, 0.7)';
      ctx.beginPath();
      ctx.moveTo(40 * z, 0);
      ctx.lineTo(25 * z, -8 * z);
      ctx.lineTo(25 * z, 8 * z);
      ctx.fill();
      
      // Label "Bremsebene"
      ctx.rotate(-oppAngle);
      ctx.fillStyle = '#ff8888';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("BREMSRICHTUNG", Math.cos(oppAngle) * 55 * z, Math.sin(oppAngle) * 55 * z);
      ctx.restore();
    }
  }

  ctx.restore();
}

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
    let testLine = line + words[n] + ' ';
    let metrics = ctx.measureText(testLine);
    let testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}
