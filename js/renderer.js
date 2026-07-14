import { SHIP_RADIUS, ARM_LENGTH, FUEL_START, normalizeAngle, RCS_ZONE_RADIUS_PX } from './constants.js';
import { worldToScreen, isWorldPointOnScreen } from './camera.js';

export function clear(ctx, canvas) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

export function drawStars(ctx, stars, cam, canvas, warpState = null) {
  if (warpState) {
    drawWarpStars(ctx, stars, canvas, warpState);
    return;
  }
  ctx.fillStyle = '#fff';
  for (const s of stars) {
    const p = worldToScreen(cam, s.x, s.y, canvas);
    ctx.fillRect(p.x, p.y, 1 * cam.zoom, 1 * cam.zoom);
  }
}

function drawWarpStars(ctx, stars, canvas, warpState) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const progress = Math.max(0, Math.min(1, warpState.progress));
  const dx = Math.cos(warpState.angle);
  const dy = Math.sin(warpState.angle);
  const streakBase = 4 + Math.pow(progress, 1.35) * Math.hypot(w, h) * 0.48;

  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < stars.length; i++) {
    const star = stars[i];
    // Während des Sprungs werden alle Weltsterne deterministisch über den Viewport verteilt.
    const x = ((star.x * 0.731 + star.y * 0.193 + i * 67) % w + w) % w;
    const y = ((star.y * 0.619 + star.x * 0.127 + i * 43) % h + h) % h;
    const depth = 0.45 + ((i * 37) % 100) / 180;
    const length = streakBase * depth;
    const alpha = 0.28 + progress * 0.68 * depth;
    ctx.strokeStyle = `rgba(218, 232, 255, ${alpha})`;
    ctx.lineWidth = 0.7 + progress * 1.9 * depth;
    ctx.beginPath();
    ctx.moveTo(x + dx * length * 0.18, y + dy * length * 0.18);
    ctx.lineTo(x - dx * length * 0.82, y - dy * length * 0.82);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRcsZone(ctx, ship, cam, canvas, flags) {
  const p = worldToScreen(cam, ship.x, ship.y, canvas);
  const r = RCS_ZONE_RADIUS_PX;

  ctx.save();
  ctx.translate(p.x, p.y);

  // Flash alpha: wenn RCS aktiv, kurz aufleuchten
  let ringAlpha = 0.35; // Erhöht von 0.15 für bessere Sichtbarkeit auf Schwarz
  if (flags.rcsFlash) {
    const flashAge = performance.now() - flags.rcsFlash.time;
    if (flashAge < 300) {
      const t = flashAge / 300;
      ringAlpha = 0.35 + 0.45 * Math.pow(1 - t, 2);
    }
  }

  // Radialer Gradient als Flächenfüllung (von Mitte bis Rand)
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  grad.addColorStop(0, `rgba(100, 180, 255, ${(ringAlpha * 0.8).toFixed(3)})`);
  grad.addColorStop(1, 'rgba(100, 180, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Gestrichelter Randring
  ctx.strokeStyle = `rgba(140, 200, 255, ${ringAlpha.toFixed(3)})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore(); // restore setzt lineDash automatisch zurück
}

export function drawShip(ctx, ship, cam, canvas, flags, visualScale = 1) {
  const p = worldToScreen(cam, ship.x, ship.y, canvas);
  const z = cam.zoom;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(ship.angle);
  ctx.scale(visualScale, visualScale);

  ctx.fillStyle = '#eee';
  ctx.beginPath();
  ctx.moveTo(SHIP_RADIUS * z, 0);
  ctx.lineTo(-SHIP_RADIUS * z, SHIP_RADIUS * 0.7 * z);
  ctx.lineTo(-SHIP_RADIUS * z, -SHIP_RADIUS * 0.7 * z);
  ctx.closePath();
  ctx.fill();

  // thrust flame
  ctx.fillStyle = 'orange';
  const isBurning = (flags.thrustMain || ship.thrustHeld || ship.tapThrustTime > 0);
  
  if (isBurning && ship.fuel > 0) {
    ctx.beginPath();
    ctx.moveTo(-SHIP_RADIUS * z, 0);
    ctx.lineTo(-SHIP_RADIUS * z - 6 * z, 4 * z);
    ctx.lineTo(-SHIP_RADIUS * z - 6 * z, -4 * z);
    ctx.closePath();
    ctx.fill();
  }

  // RCS flash (blaues Aufflackern an der Gegenseite)
  if (flags.rcsFlash) {
    const flashAge = performance.now() - flags.rcsFlash.time;
    if (flashAge < 200) {
      const alpha = (1 - flashAge / 200) * 0.85;
      ctx.save();
      // rotate so we face the rcs force direction, but we draw on the opposite side
      // the ship coordinate system is already rotated by ship.angle, so we must calculate relative angle
      const rcsWorldAngle = Math.atan2(flags.rcsFlash.dy, flags.rcsFlash.dx);
      const relativeRcsAngle = rcsWorldAngle - ship.angle;
      ctx.rotate(relativeRcsAngle);
      
      ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(-SHIP_RADIUS * z - 10 * z, 0); // draw at opposite side (negative x)
      ctx.lineTo(-SHIP_RADIUS * z, 5 * z);
      ctx.lineTo(-SHIP_RADIUS * z, -5 * z);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();
}

export function drawStation(ctx, station, cam, canvas, color = 'red') {
  const p = worldToScreen(cam, station.x, station.y, canvas);
  const z = cam.zoom;

  ctx.save();
  ctx.translate(p.x, p.y);

  if (station.stationVariant?.startsWith('proteus-')) {
    drawProteusStation(ctx, station, z);
    drawDockingArm(ctx, station, z, color);
  } else if (station.stationVariant === 'solas-complex') {
    ctx.rotate(station.orbitAngle + Math.PI / 2);
    drawSolasStation(ctx, station, z);
    drawSolasDockPorts(ctx, station, z, color);
  } else {
    drawStationBody(ctx, z);
    drawSolarPanels(ctx, z);
    drawDockingArm(ctx, station, z, color);
  }

  ctx.restore();
}

/**
 * Zeichnet alle Docking-Ports des Solas-Komplexes.
 * Inaktive Ports neutral (grau), der aktive Port farbig (Rot/Gelb/Grün).
 */
function drawSolasDockPorts(ctx, station, z, activeColor) {
  const ports = station.allDockPorts ?? [0];
  const activeId = station.activeDockPort?.id;

  for (const port of ports) {
    const isActive = port.id === activeId;
    if (!isActive) {
      drawInactiveSolasDock(ctx, port, z);
      continue;
    }
    drawDockingArmAt(ctx, port.angle, z, activeColor, station.docked, port.distance, true);
  }
}

function drawInactiveSolasDock(ctx, port, z) {
  ctx.save();
  ctx.rotate(port.angle);
  ctx.translate(port.distance * z, 0);
  ctx.fillStyle = '#172331';
  ctx.strokeStyle = 'rgba(115, 145, 170, 0.5)';
  ctx.lineWidth = Math.max(1, 1.25 * z);
  ctx.beginPath();
  ctx.arc(0, 0, 5 * z, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawSolasCollisionGuides(ctx, station, zones, ship, cam, canvas) {
  if (!zones?.length || Math.hypot(ship.x - station.x, ship.y - station.y) > 650) return;
  const p = worldToScreen(cam, station.x, station.y, canvas);
  const proximity = 1 - Math.min(1, Math.hypot(ship.x - station.x, ship.y - station.y) / 650);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(station.orbitAngle + Math.PI / 2);
  ctx.setLineDash([5, 7]);
  for (const zone of zones) {
    ctx.fillStyle = `rgba(255, 148, 70, ${0.025 + proximity * 0.055})`;
    ctx.strokeStyle = `rgba(255, 166, 92, ${0.22 + proximity * 0.42})`;
    ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
    ctx.beginPath();
    ctx.arc(
      zone.x * cam.zoom,
      zone.y * cam.zoom,
      (zone.radius + SHIP_RADIUS) * cam.zoom,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Zeichnet den Hauptkörper der Station (ISS-style Module). */
function drawStationBody(ctx, z) {
  // Central connecting truss (thin long bar)
  ctx.fillStyle = '#888';
  ctx.fillRect(-50 * z, -3 * z, 100 * z, 6 * z);

  // Main habitation module (center)
  ctx.fillStyle = '#999';
  ctx.fillRect(-14 * z, -10 * z, 28 * z, 20 * z);

  // Secondary modules left & right of center
  ctx.fillStyle = '#777';
  ctx.fillRect(-36 * z, -7 * z, 18 * z, 14 * z);
  ctx.fillRect(18 * z, -7 * z, 18 * z, 14 * z);

  // Module highlight lines (give cylindrical feel)
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 1 * z;
  ctx.strokeRect(-14 * z, -10 * z, 28 * z, 20 * z);
  ctx.strokeRect(-36 * z, -7 * z, 18 * z, 14 * z);
  ctx.strokeRect(18 * z, -7 * z, 18 * z, 14 * z);
}

/** Zeichnet alle 4 Solarmodul-Paare mit Verbindungsstreben. */
function drawSolarPanels(ctx, z) {
  // Struts connecting truss to panels
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1.5 * z;
  ctx.beginPath(); ctx.moveTo(-40 * z, -3 * z); ctx.lineTo(-40 * z, -18 * z); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-40 * z, 3 * z);  ctx.lineTo(-40 * z, 18 * z);  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(40 * z, -3 * z);  ctx.lineTo(40 * z, -18 * z);  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(40 * z, 3 * z);   ctx.lineTo(40 * z, 18 * z);   ctx.stroke();

  // Panel pairs (dark blue, long thin rectangles)
  ctx.fillStyle = '#1a3a5c';
  ctx.strokeStyle = '#2a5a8c';
  ctx.lineWidth = 0.5 * z;
  
  drawSolarPanelPair(ctx, z, -62, -26);  // top-left
  drawSolarPanelPair(ctx, z, -62, -15);
  drawSolarPanelPair(ctx, z, 18, -26);   // top-right
  drawSolarPanelPair(ctx, z, 18, -15);
  drawSolarPanelPair(ctx, z, -62, 7);    // bottom-left
  drawSolarPanelPair(ctx, z, -62, 18);
  drawSolarPanelPair(ctx, z, 18, 7);     // bottom-right
  drawSolarPanelPair(ctx, z, 18, 18);
}

/** Zeichnet ein einzelnes Solarmodul-Rechteck. */
function drawSolarPanelPair(ctx, z, x, y) {
  ctx.fillRect(x * z, y * z, 44 * z, 8 * z);
  ctx.strokeRect(x * z, y * z, 44 * z, 8 * z);
}

function drawProteusStation(ctx, station, z) {
  if (station.stationVariant === 'proteus-outer') {
    drawProteusOuterStation(ctx, z);
    return;
  }

  if (station.stationVariant === 'proteus-middle') {
    drawProteusMiddleStation(ctx, z);
    return;
  }

  drawProteusInnerStation(ctx, z);
}

function drawSolasStation(ctx, station, z) {
  // Orbitale Hauptstadt: breite Silhouette, klare Magistrale und warme Stadtlichter.
  const s = z * 2.75;

  drawSolasCityGlow(ctx, s);
  drawSolasStructuralFrame(ctx, s);
  drawSolasRotatingHabitatRing(ctx, s);
  drawSolasModules(ctx, s);
  drawSolasSolarArrays(ctx, s);
  drawSolasCoreTower(ctx, s);
  drawSolasDetails(ctx, s);
  drawSolasTraffic(ctx, s);
}

function drawSolasCityGlow(ctx, s) {
  const glow = ctx.createRadialGradient(0, 0, 8 * s, 0, 0, 105 * s);
  glow.addColorStop(0, 'rgba(255, 218, 145, 0.16)');
  glow.addColorStop(0.45, 'rgba(95, 155, 215, 0.07)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0, 0, 136 * s, 62 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#202b38';
  ctx.beginPath();
  ctx.roundRect(-108 * s, -12 * s, 216 * s, 24 * s, 7 * s);
  ctx.fill();
}

/** Tragstruktur: Haupt- und Querträger, diagonale Streben. */
function drawSolasStructuralFrame(ctx, s) {
  ctx.strokeStyle = '#6a788c';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(-112 * s, -6 * s);
  ctx.lineTo(114 * s, 9 * s);
  ctx.stroke();

  ctx.strokeStyle = '#5a6b80';
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(-18 * s, -48 * s);
  ctx.lineTo(22 * s, 52 * s);
  ctx.stroke();

  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(-96 * s, -28 * s);
  ctx.lineTo(-42 * s, 22 * s);
  ctx.moveTo(48 * s, -30 * s);
  ctx.lineTo(102 * s, 28 * s);
  ctx.stroke();
}

/** Rotierender Habitatring (zeitbasiert, rein visuell). */
function drawSolasRotatingHabitatRing(ctx, s) {
  const ringAngle = performance.now() * 0.00035;

  ctx.save();
  // Zwei unabhängige Habitatbezirke brechen die zentrale Ringsilhouette auf.
  ctx.strokeStyle = '#8195aa';
  ctx.lineWidth = 6 * s;
  ctx.beginPath();
  ctx.arc(-66 * s, -2 * s, 30 * s, ringAngle + 0.35, ringAngle + 2.75);
  ctx.arc(68 * s, 4 * s, 25 * s, -ringAngle - 2.6, -ringAngle - 0.15);
  ctx.stroke();

  ctx.strokeStyle = '#334457';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(-66 * s, -2 * s, 37 * s, ringAngle + 0.45, ringAngle + 2.65);
  ctx.arc(68 * s, 4 * s, 31 * s, -ringAngle - 2.5, -ringAngle - 0.25);
  ctx.stroke();

  for (let i = 0; i < 10; i++) {
    const left = i < 5;
    const a = (i / 5) * Math.PI * 2 + (left ? ringAngle : -ringAngle);
    const cx = (left ? -66 : 68) * s;
    const cy = (left ? -2 : 4) * s;
    const radius = (left ? 30 : 25) * s;
    const rx = cx + Math.cos(a) * radius;
    const ry = cy + Math.sin(a) * radius;
    ctx.fillStyle = i % 2 === 0 ? '#64788d' : '#405064';
    ctx.fillRect(rx - 2.5 * s, ry - 2.5 * s, 5 * s, 5 * s);
    if (i % 2 === 0) {
      ctx.fillStyle = '#ffd58f';
      ctx.beginPath();
      ctx.arc(rx, ry, 1 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/** Asymmetrisch angebaute Habitat- und Verwaltungsmodule. */
function drawSolasModules(ctx, s) {
  const modules = [
    { x: -108, y: -17, w: 24, h: 25, color: '#405268' },
    { x: -84, y: 10, w: 30, h: 18, color: '#52677e' },
    { x: -56, y: -34, w: 20, h: 22, color: '#485e75' },
    { x: -38, y: 12, w: 26, h: 18, color: '#5a6b80' },
    { x: -14, y: -42, w: 22, h: 18, color: '#4a5e78' },
    { x: 18, y: 18, w: 28, h: 17, color: '#5a6e85' },
    { x: 42, y: -32, w: 24, h: 20, color: '#485e75' },
    { x: 66, y: 12, w: 25, h: 22, color: '#52677e' },
    { x: 88, y: -18, w: 28, h: 24, color: '#405268' },
    { x: 104, y: 12, w: 18, h: 16, color: '#5a6b80' },
  ];

  for (const m of modules) {
    ctx.fillStyle = m.color;
    ctx.fillRect(m.x * s, m.y * s, m.w * s, m.h * s);
    ctx.strokeStyle = '#7a8da8';
    ctx.lineWidth = 1 * s;
    ctx.strokeRect(m.x * s, m.y * s, m.w * s, m.h * s);

    // Fensterreihen (besiedelt)
      ctx.fillStyle = (m.x + m.y) % 3 === 0 ? '#b9dcff' : '#ffd18a';
    const cols = Math.max(2, Math.floor(m.w / 6));
    const rows = Math.max(1, Math.floor(m.h / 6));
    for (let cx = 0; cx < cols; cx++) {
      for (let ry = 0; ry < rows; ry++) {
        if ((cx + ry) % 2 !== 0) continue;
        const wx = (m.x + 2 + cx * 5) * s;
        const wy = (m.y + 2 + ry * 5) * s;
        ctx.fillRect(wx, wy, 1.4 * s, 1.4 * s);
      }
    }
  }

  // Verbindungsrohre
  ctx.strokeStyle = 'rgba(130, 150, 170, 0.6)';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(-96 * s, 2 * s); ctx.lineTo(-70 * s, 14 * s);
  ctx.moveTo(-55 * s, -16 * s); ctx.lineTo(-28 * s, 14 * s);
  ctx.moveTo(-5 * s, -28 * s); ctx.lineTo(25 * s, 20 * s);
  ctx.moveTo(50 * s, -14 * s); ctx.lineTo(74 * s, 15 * s);
  ctx.moveTo(92 * s, -2 * s); ctx.lineTo(110 * s, 14 * s);
  ctx.stroke();
}

/** Ausladende Solarpanel-Arrays. */
function drawSolasSolarArrays(ctx, s) {
  const panels = [
    { x: -42, y: -58, w: 40, h: 6 },
    { x: 40, y: -28, w: 6, h: 36 },
    { x: 22, y: 52, w: 34, h: 6 },
    { x: -66, y: -24, w: 6, h: 30 },
  ];
  for (const pnl of panels) {
    ctx.fillStyle = '#2a3a55';
    ctx.fillRect(pnl.x * s, pnl.y * s, pnl.w * s, pnl.h * s);
    ctx.strokeStyle = '#4a6a90';
    ctx.lineWidth = 0.5 * s;
    ctx.strokeRect(pnl.x * s, pnl.y * s, pnl.w * s, pnl.h * s);
    // Panel-Gitterlinien
    ctx.strokeStyle = 'rgba(74, 106, 144, 0.7)';
    if (pnl.w > pnl.h) {
      for (let gx = 1; gx < pnl.w / 8; gx++) {
        const lx = (pnl.x + gx * 8) * s;
        ctx.beginPath();
        ctx.moveTo(lx, pnl.y * s);
        ctx.lineTo(lx, (pnl.y + pnl.h) * s);
        ctx.stroke();
      }
    } else {
      for (let gy = 1; gy < pnl.h / 8; gy++) {
        const ly = (pnl.y + gy * 8) * s;
        ctx.beginPath();
        ctx.moveTo(pnl.x * s, ly);
        ctx.lineTo((pnl.x + pnl.w) * s, ly);
        ctx.stroke();
      }
    }
  }
}

/** Zentraler gestaffelter Turm/Kern. */
function drawSolasCoreTower(ctx, s) {
  // Basis
  ctx.fillStyle = '#5a6b80';
  ctx.fillRect(-14 * s, -14 * s, 28 * s, 28 * s);
  ctx.strokeStyle = '#8a9ab0';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(-14 * s, -14 * s, 28 * s, 28 * s);

  // Mittelebene
  ctx.fillStyle = '#6a7a90';
  ctx.fillRect(-10 * s, -10 * s, 20 * s, 20 * s);
  ctx.strokeRect(-10 * s, -10 * s, 20 * s, 20 * s);

  // Leuchtende Zentralkammer
  ctx.shadowColor = 'rgba(255, 218, 150, 0.8)';
  ctx.shadowBlur = 12 * s;
  ctx.fillStyle = '#f0c982';
  ctx.beginPath();
  ctx.arc(0, 0, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff4d2';
  ctx.beginPath();
  ctx.arc(0, 0, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawSolasTraffic(ctx, s) {
  const time = performance.now() * 0.00035;
  const lanes = [
    { y: -72, width: 88, phase: 0, color: '#9ed9ff' },
    { y: 68, width: 76, phase: 1.7, color: '#ffd08a' },
    { y: 26, width: 112, phase: 3.1, color: '#b8e6ff' },
  ];
  for (const lane of lanes) {
    const t = (time + lane.phase) % 1;
    const x = (-lane.width + t * lane.width * 2) * s;
    ctx.strokeStyle = lane.color;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(x - 10 * s, lane.y * s);
    ctx.lineTo(x, lane.y * s);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = lane.color;
    ctx.fillRect(x, lane.y * s - 0.8 * s, 2.2 * s, 1.6 * s);
  }
}

/** Antennen, Navigationslichter, Ambient-Glow. */
function drawSolasDetails(ctx, s) {
  // Kommunikationsantennen
  ctx.strokeStyle = '#9ab0c8';
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(66 * s, 9 * s); ctx.lineTo(78 * s, 14 * s);
  ctx.moveTo(66 * s, 9 * s); ctx.lineTo(75 * s, 2 * s);
  ctx.moveTo(-58 * s, -6 * s); ctx.lineTo(-70 * s, -14 * s);
  ctx.moveTo(-12 * s, -50 * s); ctx.lineTo(-16 * s, -62 * s);
  ctx.moveTo(16 * s, 54 * s); ctx.lineTo(22 * s, 64 * s);
  ctx.stroke();

  // Blinkende Navigationslichter (rot/grün an Enden)
  const blink = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
  ctx.fillStyle = `rgba(255, 80, 80, ${0.4 + blink * 0.6})`;
  ctx.beginPath();
  ctx.arc(78 * s, 14 * s, 1.6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(80, 255, 120, ${0.4 + (1 - blink) * 0.6})`;
  ctx.beginPath();
  ctx.arc(-70 * s, -14 * s, 1.6 * s, 0, Math.PI * 2);
  ctx.fill();

  // Schwacher Ambient-Glow
  ctx.strokeStyle = 'rgba(143, 176, 255, 0.06)';
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.ellipse(0, 0, 90 * s, 74 * s, 0.15, 0, Math.PI * 2);
  ctx.stroke();
}

function drawProteusOuterStation(ctx, z) {
  drawEnergyHalo(ctx, z, '#66f5ff', 44, 0.18);

  ctx.strokeStyle = 'rgba(139, 246, 255, 0.85)';
  ctx.lineWidth = 2 * z;
  ctx.beginPath();
  ctx.moveTo(-46 * z, 0);
  ctx.lineTo(46 * z, 0);
  ctx.moveTo(0, -30 * z);
  ctx.lineTo(0, 30 * z);
  ctx.stroke();

  drawCrystal(ctx, z, 0, 0, 18, 34, '#b9fbff', '#1f7f91');
  drawCrystal(ctx, z, -42, 0, 10, 22, '#89e9f5', '#155b68');
  drawCrystal(ctx, z, 42, 0, 10, 22, '#89e9f5', '#155b68');
}

function drawProteusMiddleStation(ctx, z) {
  drawEnergyHalo(ctx, z, '#8cf7d8', 54, 0.2);

  ctx.strokeStyle = 'rgba(116, 255, 219, 0.72)';
  ctx.lineWidth = 1.5 * z;
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 14 * z, Math.sin(angle) * 14 * z);
    ctx.lineTo(Math.cos(angle) * 52 * z, Math.sin(angle) * 52 * z);
    ctx.stroke();
  }

  drawCrystal(ctx, z, 0, 0, 16, 28, '#c8fff0', '#227e74');
  drawCrystal(ctx, z, -28, -24, 9, 18, '#8cf7d8', '#185c55');
  drawCrystal(ctx, z, 34, -10, 11, 20, '#8cf7d8', '#185c55');
  drawCrystal(ctx, z, -12, 38, 10, 18, '#8cf7d8', '#185c55');
  drawLightNode(ctx, z, 0, -46, '#eafffb');
  drawLightNode(ctx, z, 45, 24, '#eafffb');
  drawLightNode(ctx, z, -45, 20, '#eafffb');
}

function drawProteusInnerStation(ctx, z) {
  drawEnergyHalo(ctx, z, '#c896ff', 62, 0.24);

  ctx.strokeStyle = 'rgba(205, 150, 255, 0.78)';
  ctx.lineWidth = 3 * z;
  ctx.beginPath();
  ctx.arc(0, 0, 44 * z, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(105, 245, 255, 0.55)';
  ctx.lineWidth = 1.25 * z;
  ctx.beginPath();
  ctx.arc(0, 0, 28 * z, 0, Math.PI * 2);
  ctx.stroke();

  drawCrystal(ctx, z, 0, 0, 20, 40, '#ecd7ff', '#5d2f83');
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + (Math.PI * i) / 2;
    drawCrystal(
      ctx,
      z,
      Math.cos(angle) * 44,
      Math.sin(angle) * 44,
      9,
      20,
      '#d8b4ff',
      '#4a246b'
    );
  }
}

function drawEnergyHalo(ctx, z, color, radius, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 6 * z;
  ctx.beginPath();
  ctx.arc(0, 0, radius * z, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCrystal(ctx, z, x, y, width, height, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5 * z;
  ctx.beginPath();
  ctx.moveTo(x * z, (y - height * 0.5) * z);
  ctx.lineTo((x + width * 0.5) * z, y * z);
  ctx.lineTo(x * z, (y + height * 0.5) * z);
  ctx.lineTo((x - width * 0.5) * z, y * z);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawLightNode(ctx, z, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x * z, y * z, 4 * z, 0, Math.PI * 2);
  ctx.fill();
}

/** Zeichnet den Docking-Arm mit Port, Gelenk und Anflug-Indikatoren. */
function drawDockingArm(ctx, station, z, color) {
  ctx.save();
  ctx.rotate(station.dockAngle);

  drawArmStrut(ctx, z);
  drawArmJoint(ctx, z);
  drawDockingPort(ctx, z, color);
  if (station.docked) drawDockedRing(ctx, z);
  drawApproachIndicator(ctx, z, color);

  ctx.restore();
}

/** Zeichnet einen Docking-Arm an einem expliziten Winkel (für Multi-Port-Komplexe). */
function drawDockingArmAt(ctx, angle, z, color, docked, armLength = ARM_LENGTH, pulse = false) {
  ctx.save();
  ctx.rotate(angle);

  drawArmStrut(ctx, z, armLength);
  drawArmJoint(ctx, z, armLength);
  drawDockingPort(ctx, z, color, armLength);
  if (docked) drawDockedRing(ctx, z, armLength);
  drawApproachIndicator(ctx, z, color, armLength);
  if (pulse) drawActivePortPulse(ctx, z, color, armLength);

  ctx.restore();
}

function drawActivePortPulse(ctx, z, color, armLength) {
  const pulse = 0.5 + Math.sin(performance.now() * 0.006) * 0.5;
  ctx.globalAlpha = 0.35 + pulse * 0.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, 2.5 * z);
  ctx.beginPath();
  ctx.arc(armLength * z, 0, (10 + pulse * 7) * z, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Zeichnet die Hauptverbindung des Docking-Arms. */
function drawArmStrut(ctx, z, armLength = ARM_LENGTH) {
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 2.5 * z;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(armLength * z, 0);
  ctx.stroke();
}

/** Zeichnet das Gelenk am Mittelpunkt des Arms. */
function drawArmJoint(ctx, z, armLength = ARM_LENGTH) {
  ctx.fillStyle = '#bbb';
  ctx.beginPath();
  ctx.arc(armLength * 0.5 * z, 0, 3 * z, 0, Math.PI * 2);
  ctx.fill();
}

/** Zeichnet den Docking-Port am Ende des Arms. */
function drawDockingPort(ctx, z, color, armLength = ARM_LENGTH) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * z;
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(armLength * z, 0, 5 * z, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Zeichnet den grünen Glow-Ring für erfolgreiche Dockings. */
function drawDockedRing(ctx, z, armLength = ARM_LENGTH) {
  ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
  ctx.lineWidth = 3.5 * z;
  ctx.beginPath();
  ctx.arc(armLength * z, 0, 8 * z, 0, Math.PI * 2);
  ctx.stroke();
}

/** Zeichnet Pfeil und Kegel für die Anflugrichtung. */
function drawApproachIndicator(ctx, z, color, armLength = ARM_LENGTH) {
  const arrowDist = 18 * z;
  const ax = armLength * z + arrowDist;

  // Approach arrow
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(ax, 0);           // tip (pointing toward port)
  ctx.lineTo(ax + 10 * z,  5 * z);
  ctx.lineTo(ax + 10 * z, -5 * z);
  ctx.closePath();
  ctx.fill();

  // Subtle approach cone
  ctx.strokeStyle = `${color}55`;
  ctx.lineWidth = 1 * z;
  ctx.beginPath();
  ctx.moveTo(armLength * z, 0);
  ctx.lineTo(armLength * z + 40 * z,  15 * z);
  ctx.moveTo(armLength * z, 0);
  ctx.lineTo(armLength * z + 40 * z, -15 * z);
  ctx.stroke();
}

export function drawVelocityVec(ctx, ship, cam, canvas) {
  const p = worldToScreen(cam, ship.x, ship.y, canvas);
  const vx = ship.vx * 20 * cam.zoom;
  const vy = ship.vy * 20 * cam.zoom;
  ctx.strokeStyle = 'cyan';
  ctx.lineWidth = cam.zoom;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + vx, p.y + vy);
  ctx.stroke();
  ctx.lineWidth = 1;
}

export function drawTargetArrow(ctx, ship, targetStation, cam, canvas, options = null) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const color = options?.color ?? '#ff4444';
  const glow = options?.glow ?? 'rgba(255, 80, 80, 0.3)';
  const labelColor = options?.labelColor ?? '#ff9999';
  const showDistance = options?.showDistance ?? true;

  const dx = targetStation.x - ship.x;
  const dy = targetStation.y - ship.y;
  const dist = Math.hypot(dx, dy);

  // No arrow needed if station is visible on screen
  if (isWorldPointOnScreen(targetStation.x, targetStation.y, cam, canvas)) return;

  const angle = Math.atan2(dy, dx);

  const cx = width / 2;
  const cy = height / 2;
  const edgeR = Math.min(cx, cy) - 48;

  const arrowX = cx + Math.cos(angle) * edgeR;
  const arrowY = cy + Math.sin(angle) * edgeR;

  ctx.save();
  ctx.translate(arrowX, arrowY);
  ctx.rotate(angle);

  // Outer glow circle
  ctx.strokeStyle = glow;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.stroke();

  // Inner circle
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();

  // Arrow pointing in direction of target
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(14, 0);       // tip
  ctx.lineTo(2, -7);
  ctx.lineTo(6, 0);
  ctx.lineTo(2, 7);
  ctx.closePath();
  ctx.fill();

  // Shaft
  ctx.fillStyle = color;
  ctx.fillRect(-10, -3, 16, 6);

  ctx.restore();

  if (!showDistance) return;

  // Distance label next to arrow
  const labelX = cx + Math.cos(angle) * (edgeR + 28);
  const labelY = cy + Math.sin(angle) * (edgeR + 28);
  const distLabel = dist >= 1000 ? (dist / 1000).toFixed(1) + 'k' : Math.floor(dist) + '';

  ctx.save();
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(labelX - 20, labelY - 9, 40, 18);
  ctx.fillStyle = labelColor;
  ctx.fillText(distLabel, labelX, labelY);
  ctx.restore();
}

export function drawPortal(ctx, portal, cam, canvas) {
  const p = worldToScreen(cam, portal.x, portal.y, canvas);
  const r = portal.radius * cam.zoom;

  ctx.save();
  ctx.translate(p.x, p.y);

  const halo = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r * 1.75);
  halo.addColorStop(0, 'rgba(210, 235, 255, 0.46)');
  halo.addColorStop(0.35, 'rgba(80, 180, 255, 0.20)');
  halo.addColorStop(1, 'rgba(40, 80, 180, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.75, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(190, 230, 255, 0.86)';
  ctx.lineWidth = Math.max(1, 3 * cam.zoom);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(120, 210, 255, 0.55)';
  ctx.lineWidth = Math.max(1, 1.5 * cam.zoom);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
    ctx.lineTo(Math.cos(a) * r * 1.18, Math.sin(a) * r * 1.18);
    ctx.stroke();
  }

  const core = ctx.createRadialGradient(-r * 0.18, -r * 0.22, 0, 0, 0, r * 0.8);
  core.addColorStop(0, 'rgba(250, 255, 255, 0.72)');
  core.addColorStop(0.32, 'rgba(70, 170, 255, 0.32)');
  core.addColorStop(1, 'rgba(4, 8, 18, 0.75)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawTargetAngle(ctx, ship, cam, canvas) {
  const angleDiff = Math.abs(normalizeAngle(ship.targetAngle - ship.angle));
  if (angleDiff <= 0.05 && !ship.thrustHeld) return;
  
  const shipScreen = worldToScreen(cam, ship.x, ship.y, canvas);
  const lineLength = 60 * cam.zoom;
  
  const targetX = shipScreen.x + Math.cos(ship.targetAngle) * lineLength;
  const targetY = shipScreen.y + Math.sin(ship.targetAngle) * lineLength;
  
  const color = angleDiff < 0.05 ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 100, 100, 0.6)';
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(shipScreen.x, shipScreen.y);
  ctx.lineTo(targetX, targetY);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Zeichnet das Spiel-HUD mit Treibstoff-, Status- und Zielinformationen.
 * Empfängt vorberechnete Daten aus main.js — keine Physik- oder
 * Winkelberechnungen im Renderer.
 * @param {number} dockAngleDiff - Vorberechnete Winkeldifferenz in Grad (0–180)
 */
export function drawHud(ctx, ship, canvas, dockCheck, score, dockColorValue, level = 1, dockAngleDiff = 0, fuelMax = FUEL_START) {
  drawFuelPanel(ctx, ship, fuelMax);
  drawTargetPanel(ctx, ship, canvas, dockCheck, score, dockColorValue, level, dockAngleDiff);
  if (ship.dockedTimer > 0) drawDockedBanner(ctx, canvas);
}

function drawFuelPanel(ctx, ship, fuelMax) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(10, 10, 220, 100);
  ctx.fillStyle = '#555';
  ctx.fillRect(15, 20, 210, 20);
  ctx.fillStyle = 'lime';
  ctx.fillRect(15, 20, (ship.fuel / fuelMax) * 210, 20);

  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText('Fuel: ' + formatFuelValue(ship.fuel), 20, 58);

  const speed = Math.hypot(ship.vx, ship.vy).toFixed(2);
  ctx.fillText('Speed: ' + speed, 20, 78);
  ctx.fillText('Cargo: ' + (ship.cargo > 0 ? 'Loaded' : 'Empty'), 20, 98);
}

function formatFuelValue(fuel) {
  if (fuel <= 0) return '0';
  if (fuel < 10) return fuel.toFixed(1);
  return Math.floor(fuel).toString();
}

export function drawFuelRangeHud(ctx, canvas, data) {
  const panelX = 10;
  const panelY = 116;
  const panelW = 220;
  const panelH = 62;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(panelX, panelY, panelW, panelH);

  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#8fd0ff';
  ctx.fillText('Fuel Range', panelX + 10, panelY + 18);

  ctx.fillStyle = data.color;
  ctx.fillText(data.label, panelX + 10, panelY + 38);

  ctx.fillStyle = '#c8d8e0';
  const reservePrefix = data.reserve >= 0 ? '+' : '';
  ctx.fillText(
    `${reservePrefix}${Math.round(data.reserve)} fuel · ${Math.round(data.distance)} px`,
    panelX + 10,
    panelY + 54
  );

  ctx.restore();
}

export function drawLevel8Hint(ctx, canvas) {
  const width = canvas.clientWidth;
  const x = Math.max(12, width / 2 - 180);
  const y = 116;
  const w = Math.min(360, width - 24);
  const h = 64;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(120, 216, 255, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#bfeeff';
  ctx.fillText('Neues System', x + 12, y + 20);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#e8f6ff';
  ctx.fillText('Rot: Zielstation. Gold: Planetenzentrum.', x + 12, y + 42);
  ctx.restore();
}

export function drawSolasWindowHud(ctx, canvas, data) {
  const width = Math.min(330, canvas.clientWidth - 24);
  const x = (canvas.clientWidth - width) / 2;
  const y = 14;
  const seconds = Math.max(0, data.remainingMs / 1000).toFixed(1);
  const isOpen = data.phase === 'open';
  const accent = isOpen ? '#76f0b0' : data.phase === 'warning' ? '#ffd080' : '#8fb9df';
  const status = isOpen
    ? `ANDOCKEN FREIGEGEBEN · ${seconds}s`
    : data.phase === 'warning'
      ? `KORRIDOR ÖFFNET IN ${seconds}s`
      : `NÄCHSTE FREIGABE IN ${seconds}s`;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(3, 9, 16, 0.78)';
  ctx.fillRect(x, y, width, 58);
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.7;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, 57);
  ctx.globalAlpha = 1;
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#b9c8d8';
  ctx.fillText(data.label.toUpperCase(), x + 12, y + 20);
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = accent;
  ctx.fillText(status, x + 12, y + 42);
  ctx.restore();
}

export function drawHyperdriveWhiteout(ctx, canvas, elapsedMs, durationMs) {
  const progress = Math.min(1, elapsedMs / durationMs);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.save();

  // Whiteout über den gesamten Bildschirm
  let whiteAlpha = 0;
  if (progress < 0.8) {
    whiteAlpha = Math.pow(progress / 0.8, 2);
  } else {
    whiteAlpha = 1.0 - ((progress - 0.8) / 0.2);
  }

  if (whiteAlpha > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${whiteAlpha})`;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();
}

function drawTargetPanel(ctx, ship, canvas, dockCheck, score, dockColorValue, level, dockAngleDiff) {
  const trX = canvas.clientWidth - 230;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(trX, 10, 220, 120);

  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText('Level: ' + level, trX + 10, 30);
  ctx.fillText('Score: ' + score, trX + 10, 50);
  ctx.fillText('Target Dist: ' + Math.floor(dockCheck.dist), trX + 10, 70);
  ctx.fillText('Target Angle: ' + dockAngleDiff + '°', trX + 10, 90);

  ctx.fillText('Dock Status: ', trX + 10, 110);
  ctx.fillStyle = dockColorValue;
  ctx.fillRect(trX + 100, 98, 14, 14);
}

function drawDockedBanner(ctx, canvas) {
  ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
  ctx.font = '30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Docked! Transferring...', canvas.clientWidth / 2, canvas.clientHeight / 4);
  ctx.textAlign = 'left';
}

// ---- Level 3: Asteroid Field Rendering ----

export function drawAsteroids(ctx, asteroids, cam, canvas, highlightedAsteroid = null) {
  ctx.save();

  for (const asteroid of asteroids) {
    const p = worldToScreen(cam, asteroid.x, asteroid.y, canvas);
    const z = cam.zoom;
    const r = asteroid.radius * z;
    const isHighlighted = asteroid === highlightedAsteroid;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((asteroid.seed % 360) * Math.PI / 180);

    if (isHighlighted) {
      ctx.strokeStyle = 'rgba(255, 70, 70, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, (asteroid.radius + SHIP_RADIUS) * z, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const grad = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.1, 0, 0, r);
    grad.addColorStop(0, '#aeb6bd');
    grad.addColorStop(0.45, '#5f6870');
    grad.addColorStop(1, '#242a30');

    ctx.fillStyle = grad;
    ctx.strokeStyle = isHighlighted ? 'rgba(255, 100, 100, 0.95)' : 'rgba(180, 190, 200, 0.45)';
    ctx.lineWidth = isHighlighted ? 2 : 1.2;
    ctx.beginPath();

    for (let i = 0; i < asteroid.shape.length; i++) {
      const point = asteroid.shape[i];
      const x = Math.cos(point.angle) * r * point.scale;
      const y = Math.sin(point.angle) * r * point.scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.24, Math.max(2, r * 0.16), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  ctx.restore();
}

// ---- Level 5: Debris Field Rendering ----

/**
 * Zeichnet ein technisches Schrottfeld aus geometrischen Wrackteilen.
 * Verwendet Strategy-Map für verschiedene Debris-Typen statt lange if/else-Kette.
 * Der subtype wird deterministisch aus dem Seed abgeleitet.
 */
export function drawDebrisField(ctx, asteroids, cam, canvas, highlightedAsteroid = null) {
  ctx.save();

  for (const asteroid of asteroids) {
    drawDebrisObject(ctx, asteroid, cam, canvas, asteroid === highlightedAsteroid);
  }

  ctx.restore();
}

/** Strategy-Map: jeder Debris-Typ hat eine eigene Render-Funktion. */
const DEBRIS_RENDERERS = {
  0: drawDebrisSatellite,
  1: drawDebrisTank,
  2: drawDebrisPlate,
  3: drawDebrisChunk,
};

/** Zeichnet ein einzelnes Debris-Objekt mit Kollisionsring und typenspezifischem Renderer. */
function drawDebrisObject(ctx, asteroid, cam, canvas, isHighlighted) {
  const p = worldToScreen(cam, asteroid.x, asteroid.y, canvas);
  const z = cam.zoom;
  const r = asteroid.radius * z;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate((asteroid.seed * 137.508) % (Math.PI * 2));

  if (isHighlighted) drawCollisionWarningRing(ctx, asteroid, z);

  const subtype = asteroid.seed % 4;
  DEBRIS_RENDERERS[subtype](ctx, r, isHighlighted, asteroid);

  ctx.restore();
}

/** Zeichnet den roten Kollisions-Warnring um hervorgehobene Objekte. */
function drawCollisionWarningRing(ctx, asteroid, z) {
  ctx.strokeStyle = 'rgba(255, 70, 70, 0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, (asteroid.radius + SHIP_RADIUS) * z, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Zeichnet einen Satellitenbus: Zentrales Rechteck + Solarpanel-Stummel. */
function drawDebrisSatellite(ctx, r, isHighlighted) {
  const bw = r * 1.1;
  const bh = r * 0.7;
  const panelW = r * 0.9;
  const panelH = r * 0.22;

  // Rumpf
  const bodyGrad = ctx.createLinearGradient(-bw * 0.5, -bh * 0.5, bw * 0.5, bh * 0.5);
  bodyGrad.addColorStop(0, '#8a9aaa');
  bodyGrad.addColorStop(0.4, '#5a6a76');
  bodyGrad.addColorStop(1, '#2a3038');
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = isHighlighted ? 'rgba(255,100,100,0.95)' : 'rgba(160,180,200,0.55)';
  ctx.lineWidth = isHighlighted ? 2 : 1;
  ctx.beginPath();
  ctx.rect(-bw * 0.5, -bh * 0.5, bw, bh);
  ctx.fill();
  ctx.stroke();

  // Verbrannte Stellen (dunkel)
  ctx.fillStyle = 'rgba(20, 10, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(bw * 0.18, -bh * 0.1, r * 0.22, r * 0.14, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Solarpanels links + rechts
  const panelGrad = ctx.createLinearGradient(0, -panelH * 0.5, 0, panelH * 0.5);
  panelGrad.addColorStop(0, '#2a4a6a');
  panelGrad.addColorStop(0.5, '#1a3050');
  panelGrad.addColorStop(1, '#0a1828');
  ctx.fillStyle = panelGrad;
  ctx.strokeStyle = 'rgba(80, 140, 200, 0.5)';
  ctx.lineWidth = 0.8;
  // Links
  ctx.beginPath();
  ctx.rect(-bw * 0.5 - panelW, -panelH * 0.5, panelW, panelH);
  ctx.fill();
  ctx.stroke();
  // Rechts
  ctx.beginPath();
  ctx.rect(bw * 0.5, -panelH * 0.5, panelW, panelH);
  ctx.fill();
  ctx.stroke();
  // Panel-Gitterlinien
  ctx.strokeStyle = 'rgba(60, 110, 170, 0.6)';
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 3; i++) {
    const lx = -bw * 0.5 - panelW + panelW * (i / 3);
    ctx.beginPath(); ctx.moveTo(lx, -panelH * 0.5); ctx.lineTo(lx, panelH * 0.5); ctx.stroke();
    const rx = bw * 0.5 + panelW * (i / 3);
    ctx.beginPath(); ctx.moveTo(rx, -panelH * 0.5); ctx.lineTo(rx, panelH * 0.5); ctx.stroke();
  }

  // Reflektion oben links
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.beginPath();
  ctx.rect(-bw * 0.5 + 1, -bh * 0.5 + 1, bw * 0.4, bh * 0.28);
  ctx.fill();
}

/** Zeichnet einen Drucktank: Kugel mit Schweißnähten. */
function drawDebrisTank(ctx, r, isHighlighted) {
  const tankGrad = ctx.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.05, 0, 0, r);
  tankGrad.addColorStop(0, '#b0a090');
  tankGrad.addColorStop(0.35, '#7a6858');
  tankGrad.addColorStop(0.7, '#4a3a2c');
  tankGrad.addColorStop(1, '#1e1410');
  ctx.fillStyle = tankGrad;
  ctx.strokeStyle = isHighlighted ? 'rgba(255,100,100,0.95)' : 'rgba(180,160,130,0.5)';
  ctx.lineWidth = isHighlighted ? 2 : 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Schweißnähte (2 Ringe, 1 Meridian)
  ctx.strokeStyle = isHighlighted ? 'rgba(255,120,120,0.6)' : 'rgba(100, 85, 65, 0.8)';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.98, r * 0.38, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.stroke();

  // Rostflecken
  ctx.fillStyle = 'rgba(160, 80, 20, 0.3)';
  ctx.beginPath();
  ctx.ellipse(r * 0.3, r * 0.25, r * 0.28, r * 0.18, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Reflektion
  ctx.fillStyle = 'rgba(255, 240, 220, 0.18)';
  ctx.beginPath();
  ctx.arc(-r * 0.26, -r * 0.28, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

/** Zeichnet eine Metallplatte: Flaches Viereck, scharfkantig. */
function drawDebrisPlate(ctx, r, isHighlighted, asteroid) {
  const pw = r * 1.6;
  const ph = r * 0.55;
  // Leichte Verzerrung für zerstörten Look
  const skew = ((asteroid.seed * 73) % 20 - 10) / 100;

  const plateGrad = ctx.createLinearGradient(-pw * 0.5, 0, pw * 0.5, ph);
  plateGrad.addColorStop(0, '#9aa4ac');
  plateGrad.addColorStop(0.3, '#6a7478');
  plateGrad.addColorStop(0.7, '#3a4044');
  plateGrad.addColorStop(1, '#1a2024');
  ctx.fillStyle = plateGrad;
  ctx.strokeStyle = isHighlighted ? 'rgba(255,100,100,0.95)' : 'rgba(160,175,185,0.5)';
  ctx.lineWidth = isHighlighted ? 2 : 1;
  ctx.beginPath();
  ctx.moveTo(-pw * 0.5, -ph * 0.5 + skew * pw);
  ctx.lineTo(pw * 0.5, -ph * 0.5 - skew * pw);
  ctx.lineTo(pw * 0.5 - r * 0.08, ph * 0.5 - skew * pw);  // abgeknicktes Ende
  ctx.lineTo(-pw * 0.5 + r * 0.06, ph * 0.5 + skew * pw);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Nieten-Reihe
  ctx.fillStyle = 'rgba(200, 215, 225, 0.6)';
  const nivetCount = 5;
  for (let i = 0; i < nivetCount; i++) {
    const nx = -pw * 0.4 + (pw * 0.8 / (nivetCount - 1)) * i;
    ctx.beginPath();
    ctx.arc(nx, -ph * 0.22, Math.max(1, r * 0.055), 0, Math.PI * 2);
    ctx.fill();
  }

  // Verbiegung / Knick (dunkle Diagonale)
  ctx.strokeStyle = 'rgba(10, 15, 20, 0.6)';
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(pw * 0.15, -ph * 0.5);
  ctx.lineTo(pw * 0.28, ph * 0.5);
  ctx.stroke();

  // Reflektion
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.rect(-pw * 0.45, -ph * 0.45, pw * 0.35, ph * 0.35);
  ctx.fill();
}

/** Zeichnet ein Trümmerstück: Scharfkantiges, unregelmäßiges Polygon. */
function drawDebrisChunk(ctx, r, isHighlighted, asteroid) {
  const numPts = 6 + (asteroid.seed % 3);  // 6–8 Ecken
  const pts = [];
  for (let i = 0; i < numPts; i++) {
    const baseAngle = (i / numPts) * Math.PI * 2;
    // Scharfe, unregelmäßige Variation (mehr Jitter als Asteroiden)
    const jitterSeed = (asteroid.seed * 17 + i * 31) % 100;
    const scale = 0.55 + (jitterSeed / 100) * 0.55;
    pts.push({ angle: baseAngle, scale });
  }

  const chunkGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.05, 0, 0, r);
  chunkGrad.addColorStop(0, '#a09080');
  chunkGrad.addColorStop(0.4, '#605040');
  chunkGrad.addColorStop(0.75, '#382820');
  chunkGrad.addColorStop(1, '#181008');
  ctx.fillStyle = chunkGrad;
  ctx.strokeStyle = isHighlighted ? 'rgba(255,100,100,0.95)' : 'rgba(175,155,130,0.5)';
  ctx.lineWidth = isHighlighted ? 2 : 1.2;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const px = Math.cos(pts[i].angle) * r * pts[i].scale;
    const py = Math.sin(pts[i].angle) * r * pts[i].scale;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Roststreifen
  ctx.fillStyle = 'rgba(180, 70, 10, 0.28)';
  ctx.beginPath();
  ctx.ellipse(r * 0.1, r * 0.15, r * 0.35, r * 0.15, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Reflektion
  ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.beginPath();
  ctx.arc(-r * 0.18, -r * 0.22, Math.max(2, r * 0.14), 0, Math.PI * 2);
  ctx.fill();
}

// ---- Level 2: Gravity Well Rendering ----

/**
 * Zeichnet die Gravitationsquelle mit Einflussringen und Gradient.
 */
export function drawGravityWell(ctx, well, cam, canvas, eventHorizon) {
  if (well.isBlackHole) {
    drawBlackHole(ctx, well, cam, canvas, eventHorizon);
    return;
  }
  const p = worldToScreen(cam, well.x, well.y, canvas);
  const z = cam.zoom;

  ctx.save();
  ctx.translate(p.x, p.y);

  const gravityRadius = well.gravityRadius ?? 600;

  // Einflussfeld-Ringe (äußerster = gravityRadius)
  const ringColors = [
    { r: gravityRadius * z, alpha: 0.15 },
    { r: gravityRadius * 0.7 * z, alpha: 0.25 },
    { r: gravityRadius * 0.43 * z, alpha: 0.35 },
    { r: gravityRadius * 0.23 * z, alpha: 0.50 },
  ];
  for (const ring of ringColors) {
    ctx.strokeStyle = `rgba(255, 160, 40, ${ring.alpha})`;
    ctx.lineWidth = 2.0;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Radiales Glühen
  const glow = ctx.createRadialGradient(0, 0, well.wellRadius * z * 0.5, 0, 0, 180 * z);
  glow.addColorStop(0, 'rgba(255, 200, 80, 0.35)');
  glow.addColorStop(0.4, 'rgba(255, 120, 20, 0.12)');
  glow.addColorStop(1, 'rgba(255, 80, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 180 * z, 0, Math.PI * 2);
  ctx.fill();

  // Event Horizon Ring (Warnung)
  ctx.strokeStyle = 'rgba(255, 60, 60, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.arc(0, 0, eventHorizon * z, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Körper
  const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, well.wellRadius * z);
  bodyGrad.addColorStop(0, '#fff8e0');
  bodyGrad.addColorStop(0.3, '#ffcc44');
  bodyGrad.addColorStop(0.7, '#ff6600');
  bodyGrad.addColorStop(1, '#cc2200');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(0, 0, well.wellRadius * z, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Zeichnet die vorhergesagte Flugbahn als gepunktete Linie.
 * @param {number} validSteps - Anzahl gültiger Punkte aus predictTrajectory()
 */
export function drawTrajectory(ctx, outX, outY, validSteps, cam, canvas, isInDanger) {
  if (validSteps < 2) return;

  ctx.save();
  ctx.setLineDash([4, 5]);
  ctx.lineWidth = 2.0;

  for (let i = 1; i < validSteps; i++) {
    const t = i / validSteps;
    // Farbe: grün → gelb → rot je nach Nähe zur Quelle / Gefahr
    const alpha = isInDanger ? (0.9 - t * 0.25) : (0.8 - t * 0.3);
    ctx.strokeStyle = isInDanger
      ? `rgba(255, 80, 80, ${Math.max(0.65, alpha)})`
      : `rgba(100, 220, 255, ${Math.max(0.5, alpha)})`;

    const p0 = worldToScreen(cam, outX[i - 1], outY[i - 1], canvas);
    const p1 = worldToScreen(cam, outX[i], outY[i], canvas);

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

const BLACK_HOLE_FRAGMENTS = [
  [1.242, -1.331, 0.474, 1.296],
  [1.455, -0.757, 0.805, 0.863],
  [1.531, 0.391, 0.937, 0.614],
  [1.293, 1.134, 0.617, 1.076],
  [0.599, 1.803, 0.028, 1.36],
  [-0.887, 1.271, -0.893, 0.74],
  [-1.374, 0.551, -1.092, 0.133],
  [-1.596, -0.456, -0.996, -0.595],
  [-1.061, -1.576, -0.435, -1.183],
  [0.168, -1.551, 0.327, -1.029],
  [1.022, -1.408, 0.931, -0.789],
  [1.521, -0.613, 1.097, -0.226],
];

const BLACK_HOLE_HORIZON_POINTS = [
  [1.02, 0],
  [1.014, 0.298],
  [0.842, 0.541],
  [0.642, 0.74],
  [0.454, 0.995],
  [0.14, 0.973],
  [-0.14, 0.973],
  [-0.454, 0.995],
  [-0.642, 0.74],
  [-0.842, 0.541],
  [-1.014, 0.298],
  [-1.02, 0],
  [-0.944, -0.277],
  [-0.874, -0.562],
  [-0.694, -0.801],
  [-0.393, -0.861],
  [-0.15, -1.046],
  [0.15, -1.046],
  [0.393, -0.861],
  [0.694, -0.801],
  [0.874, -0.562],
  [0.944, -0.277],
  [1.02, 0],
];

export function drawBlackHole(ctx, well, cam, canvas, eventHorizon) {
  const p = worldToScreen(cam, well.x, well.y, canvas);
  const z = cam.zoom;
  const time = performance.now() * 0.001;
  const horizon = eventHorizon * z;
  const pulse = 0.5 + Math.sin(time * 0.9) * 0.5;

  ctx.save();
  ctx.translate(p.x, p.y);

  // Wenige statische Ringe halten den Eindruck, ohne pro Frame teuer zu rotieren.
  ctx.strokeStyle = `rgba(170, 20, 58, ${0.12 + pulse * 0.04})`;
  ctx.lineWidth = 1.25;
  ctx.setLineDash([10, 18]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 760 * z, 520 * z, -0.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, 520 * z, 350 * z, -0.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const outerRadius = 390 * z;
  const diskGrad = ctx.createRadialGradient(0, 0, horizon * 0.55, 0, 0, outerRadius);
  diskGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  diskGrad.addColorStop(0.16, `rgba(255, 238, 190, ${0.45 + pulse * 0.08})`);
  diskGrad.addColorStop(0.32, 'rgba(255, 68, 22, 0.28)');
  diskGrad.addColorStop(0.62, 'rgba(104, 8, 30, 0.12)');
  diskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = diskGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, outerRadius * 1.45, outerRadius * 0.34, -0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 78, 26, 0.58)';
  ctx.lineWidth = 8 * z;
  ctx.beginPath();
  ctx.ellipse(0, 0, horizon * 2.72, horizon * 1.05, -0.28, 0.22, Math.PI * 1.72);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 230, 166, ${0.62 + pulse * 0.1})`;
  ctx.lineWidth = 3 * z;
  ctx.beginPath();
  ctx.ellipse(0, 0, horizon * 2.34, horizon * 0.82, -0.28, Math.PI * 1.05, Math.PI * 1.82);
  ctx.stroke();

  ctx.lineCap = 'round';
  for (const [x1, y1, x2, y2] of BLACK_HOLE_FRAGMENTS) {
    ctx.strokeStyle = 'rgba(255, 58, 28, 0.46)';
    ctx.lineWidth = 2 * z;
    ctx.beginPath();
    ctx.moveTo(x1 * horizon, y1 * horizon);
    ctx.lineTo(x2 * horizon, y2 * horizon);
    ctx.stroke();
  }

  ctx.strokeStyle = `rgba(255, 220, 170, ${0.62 + pulse * 0.08})`;
  ctx.lineWidth = 3.5 * z;
  ctx.beginPath();
  ctx.arc(0, 0, horizon * 1.08, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 32, 32, 0.82)';
  ctx.lineWidth = 2 * z;
  ctx.beginPath();
  for (let i = 0; i < BLACK_HOLE_HORIZON_POINTS.length; i++) {
    const [px, py] = BLACK_HOLE_HORIZON_POINTS[i];
    const x = px * horizon;
    const y = py * horizon;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 5. Event Horizon (lichtloser Kern).
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(0, 0, horizon, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Zeichnet alle aktiven Explosionspartikel.
 * @param {Array} particles - Array mit Partikelobjekten
 */
export function drawParticles(ctx, cam, canvas, particles) {
  if (particles.length === 0) return;

  ctx.save();
  for (const p of particles) {
    const t = p.life / p.maxLife;          // 1 → 0 während Lebenszeit
    const alpha = t * t;                   // quadratisch → weicheres Ausblenden
    const r = Math.max(0.5, p.size * t);   // schrumpft mit der Zeit

    const sp = worldToScreen(cam, p.x, p.y, canvas);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r * cam.zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---- Level 5: Planet & Orbit Rendering ----

/**
 * Feste Kontinentformen (als normalisierte Polygone, skaliert mit Planetenradius).
 * Jeder Kontinent ist ein Array von [angle_offset, radius_factor]-Paaren.
 * Generiert deterministisch — keine zufälligen Werte zur Laufzeit.
 */
const CONTINENT_SHAPES = [
  // Nordamerika-ähnlich
  [
    [0.00, 0.52], [0.08, 0.61], [0.15, 0.58], [0.20, 0.67],
    [0.28, 0.70], [0.34, 0.63], [0.38, 0.55], [0.30, 0.48],
    [0.22, 0.44], [0.12, 0.46], [0.05, 0.50],
  ],
  // Europa/Afrika-ähnlich (schmaler, länglich)
  [
    [0.00, 0.38], [0.05, 0.45], [0.10, 0.50], [0.14, 0.55],
    [0.18, 0.62], [0.22, 0.65], [0.26, 0.60], [0.29, 0.50],
    [0.27, 0.40], [0.22, 0.34], [0.15, 0.32], [0.08, 0.34],
  ],
  // Asien/Pazifik (breit, unregelmäßig)
  [
    [0.00, 0.60], [0.06, 0.68], [0.14, 0.72], [0.22, 0.70],
    [0.30, 0.74], [0.38, 0.68], [0.44, 0.62], [0.42, 0.54],
    [0.36, 0.50], [0.28, 0.48], [0.18, 0.50], [0.10, 0.55],
  ],
  // Südamerika
  [
    [0.00, 0.42], [0.05, 0.50], [0.10, 0.54], [0.14, 0.50],
    [0.16, 0.43], [0.13, 0.37], [0.08, 0.34], [0.03, 0.37],
  ],
  // Australien
  [
    [0.00, 0.38], [0.06, 0.44], [0.12, 0.46], [0.16, 0.42],
    [0.18, 0.36], [0.14, 0.32], [0.08, 0.30], [0.03, 0.33],
  ],
];

// Continent placement: [baseAngle, baseRadius, rotationOffset, scaleX, scaleY]
const CONTINENT_PLACEMENTS = [
  { shape: 0, angle: -2.1, dist: 0.55, rot: -0.3, sx: 1.0, sy: 0.9 },
  { shape: 1, angle: 0.4,  dist: 0.52, rot:  0.5, sx: 0.75, sy: 1.1 },
  { shape: 2, angle: 1.2,  dist: 0.58, rot: -0.1, sx: 1.1, sy: 0.85 },
  { shape: 3, angle: -0.5, dist: 0.62, rot:  0.2, sx: 0.8, sy: 1.0 },
  { shape: 4, angle: 2.8,  dist: 0.68, rot:  0.4, sx: 0.9, sy: 0.8 },
];

// Cloud shapes: [startAngle, spanAngle, radiusFactor, widthFactor]
const CLOUD_BANDS = [
  { a: 0.60, span: 0.28, r: 1.005, w: 0.06 },
  { a: 1.80, span: 0.22, r: 1.008, w: 0.05 },
  { a: 3.20, span: 0.35, r: 1.003, w: 0.07 },
  { a: 4.50, span: 0.18, r: 1.006, w: 0.04 },
  { a: 5.40, span: 0.26, r: 1.004, w: 0.055 },
];

/**
 * Zeichnet einen schönen Erdplaneten mit Atmosphäre, Kontinenten und Wolken.
 * @param {object} planet - { x, y, radius, cloudAngle }
 */
export function drawSolasPlanet(ctx, planet, cam, canvas) {
  const p = worldToScreen(cam, planet.x, planet.y, canvas);
  const z = cam.zoom;
  const r = planet.radius * z;

  ctx.save();
  ctx.translate(p.x, p.y);

  // --- Hauptkörper: warmer, erdiger Ton (besiedelt, alt, Narben) ---
  const baseGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.28, r * 0.05, 0, 0, r);
  baseGrad.addColorStop(0, '#c4a86a');    // helles Gold (Highlight)
  baseGrad.addColorStop(0.3, '#8a7548');  // warmes Braun
  baseGrad.addColorStop(0.6, '#5a4e38');  // dunkles Braun
  baseGrad.addColorStop(1, '#2a2218');    // sehr dunkel am Rand
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // --- Narben/Lichter: dicht besiedelte Oberfläche ---
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.998, 0, Math.PI * 2);
  ctx.clip();

  // Stadtlichter / Besiedelungsmuster (goldene Punkte/Linien)
  ctx.globalAlpha = 0.35;
  const rot = planet.rotation * 0.3;
  for (let i = 0; i < 30; i++) {
    const angle = rot + (i * 7.3) % (Math.PI * 2);
    const dist = 0.2 + ((i * 13) % 60) / 100;
    const cx = Math.cos(angle) * dist * r;
    const cy = Math.sin(angle) * dist * r;
    const size = (2 + (i % 4)) * z;
    ctx.fillStyle = '#ffd080';
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Narben / alte Krater (dunkle Flecken)
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 8; i++) {
    const angle = (i * 11.7) % (Math.PI * 2);
    const dist = 0.3 + ((i * 17) % 40) / 100;
    const cx = Math.cos(angle) * dist * r;
    const cy = Math.sin(angle) * dist * r;
    const size = (8 + (i * 5 % 12)) * z;
    ctx.fillStyle = '#1a1510';
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // --- Atmosphäre: dünner warmer Glührand ---
  const atmoGrad = ctx.createRadialGradient(0, 0, r * 0.92, 0, 0, r * 1.06);
  atmoGrad.addColorStop(0, 'rgba(200, 160, 100, 0)');
  atmoGrad.addColorStop(0.6, 'rgba(200, 160, 100, 0.08)');
  atmoGrad.addColorStop(1, 'rgba(200, 160, 100, 0)');
  ctx.fillStyle = atmoGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.06, 0, Math.PI * 2);
  ctx.fill();

  // --- Schattierung: Kugel-Effekt ---
  const shadowGrad = ctx.createRadialGradient(r * 0.3, r * 0.3, 0, 0, 0, r);
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shadowGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.15)');
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawPlanet(ctx, planet, cam, canvas) {
  const p = worldToScreen(cam, planet.x, planet.y, canvas);
  const z = cam.zoom;
  const r = planet.radius * z;
  const time = performance.now() * 0.001;
  const cloudPhase = planet.cloudAngle + time * 0.018; // langsame Wolkenrotation

  ctx.save();
  ctx.translate(p.x, p.y);

  // --- 1. Ozean (Basiskugel blau) ---
  const oceanGrad = ctx.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.05, 0, 0, r);
  oceanGrad.addColorStop(0, '#5bb8f5');   // helles Ozeanblau (Highlight)
  oceanGrad.addColorStop(0.35, '#1e6fa8'); // mittleres Blau
  oceanGrad.addColorStop(0.72, '#0d4a82'); // tiefes Blau
  oceanGrad.addColorStop(1, '#092e55');   // sehr dunkles Blau am Rand
  ctx.fillStyle = oceanGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // --- 2. Kontinente ---
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.998, 0, Math.PI * 2);
  ctx.clip(); // Alles außerhalb des Planeten wird abgeschnitten

  for (const placement of CONTINENT_PLACEMENTS) {
    const shape = CONTINENT_SHAPES[placement.shape];
    const baseAngle = placement.angle + planet.rotation * 0.4; // leichte Rotation mit Planet
    const baseDist = placement.dist * r;

    ctx.save();
    ctx.rotate(baseAngle);
    ctx.scale(placement.sx, placement.sy);

    // Kontinentfarbe mit leichtem Gradient
    const contGrad = ctx.createRadialGradient(
      baseDist * 0.1, 0, 0,
      baseDist * 0.1, 0, baseDist * 0.6
    );
    contGrad.addColorStop(0, '#6abf59');  // helles Grün
    contGrad.addColorStop(0.4, '#3d8c35'); // mittleres Grün
    contGrad.addColorStop(0.75, '#2d6b2a'); // dunkles Grün
    contGrad.addColorStop(1, '#8a7a52');  // Küstensand

    ctx.fillStyle = contGrad;
    ctx.beginPath();

    // Kontinent als Polygon zeichnen
    for (let i = 0; i < shape.length; i++) {
      const [angOff, radFac] = shape[i];
      const pointAngle = angOff * Math.PI * 2 + placement.rot;
      const pointDist = radFac * r;
      const px = Math.cos(pointAngle) * pointDist + baseDist;
      const py = Math.sin(pointAngle) * pointDist;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Schneekappe an den Polen (oben/unten)
    if (placement.shape === 0 || placement.shape === 1) {
      ctx.fillStyle = 'rgba(240, 248, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(baseDist * 0.05, -baseDist * 0.05, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Polarkappen (Arktis / Antarktis — immer sichtbar)
  ctx.fillStyle = 'rgba(230, 245, 255, 0.82)';
  ctx.beginPath();
  ctx.arc(0, -r * 0.84, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(220, 240, 255, 0.72)';
  ctx.beginPath();
  ctx.arc(0, r * 0.87, r * 0.14, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // Ende Clip-Region

  // --- 3. Wolken (rotieren leicht, halbtransparent) ---
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();

  for (const band of CLOUD_BANDS) {
    const startA = band.a + cloudPhase;
    const endA = startA + band.span;
    const cr = band.r * r;
    const halfW = band.w * r;

    const cloudGrad = ctx.createRadialGradient(0, 0, cr - halfW, 0, 0, cr + halfW);
    cloudGrad.addColorStop(0, 'rgba(255,255,255,0)');
    cloudGrad.addColorStop(0.3, 'rgba(255,255,255,0.55)');
    cloudGrad.addColorStop(0.55, 'rgba(255,255,255,0.72)');
    cloudGrad.addColorStop(0.75, 'rgba(255,255,255,0.55)');
    cloudGrad.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = cloudGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, cr + halfW, startA, endA);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore(); // Ende Wolken-Clip

  // --- 4. Atmosphäre (blauer Halo-Ring außen) ---
  const atmInner = r * 0.97;
  const atmOuter = r * 1.18;
  const atmGrad = ctx.createRadialGradient(0, 0, atmInner, 0, 0, atmOuter);
  atmGrad.addColorStop(0, 'rgba(100, 180, 255, 0.55)');
  atmGrad.addColorStop(0.4, 'rgba(60, 140, 230, 0.28)');
  atmGrad.addColorStop(0.75, 'rgba(30, 90, 180, 0.10)');
  atmGrad.addColorStop(1, 'rgba(10, 40, 120, 0)');

  ctx.fillStyle = atmGrad;
  ctx.beginPath();
  ctx.arc(0, 0, atmOuter, 0, Math.PI * 2);
  ctx.fill();

  // --- 5. Terminator (Tageslicht-Schatten) ---
  // Leichter Schatten-Halbkreis auf der dem Licht abgewandten Seite
  const shadowGrad = ctx.createRadialGradient(r * 0.4, -r * 0.3, 0, -r * 0.1, r * 0.1, r * 1.2);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
  shadowGrad.addColorStop(0.55, 'rgba(0,0,0,0)');
  shadowGrad.addColorStop(0.78, 'rgba(0,10,30,0.22)');
  shadowGrad.addColorStop(1, 'rgba(0,5,20,0.58)');

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = shadowGrad;
  ctx.fillRect(-r - 10, -r - 10, (r + 10) * 2, (r + 10) * 2);
  ctx.restore();

  // --- 6. Spekularer Highlight (Lichtreflex auf Ozean) ---
  const hlGrad = ctx.createRadialGradient(-r * 0.30, -r * 0.35, 0, -r * 0.30, -r * 0.35, r * 0.35);
  hlGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
  hlGrad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hlGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawOrbitGuide(ctx, planet, ship, station, orbitRadius, cam, canvas, status) {
  const p = worldToScreen(cam, planet.x, planet.y, canvas);
  const r = orbitRadius * cam.zoom;
  const shipAngle = Math.atan2(ship.y - planet.y, ship.x - planet.x);
  const guideColor = status.orbitOk
    ? 'rgba(85, 255, 150, 0.62)'
    : Math.abs(status.radialSpeed) > 0.12 || Math.abs(status.tangentialError) > 0.14
      ? 'rgba(255, 210, 80, 0.58)'
      : 'rgba(140, 220, 255, 0.52)';

  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.strokeStyle = 'rgba(110, 190, 255, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = guideColor;
  ctx.lineWidth = 1.25;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const inner = r - 4;
    const outer = r + 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();
  }

  drawOrbitGuideArc(ctx, r, shipAngle - 0.34, shipAngle + 0.34, guideColor);
  drawOrbitGuideArrow(ctx, r, shipAngle + 0.44, guideColor);

  if (station?.orbiting) {
    const stationAngle = Math.atan2(station.y - planet.y, station.x - planet.x);
    drawOrbitGuideArrow(ctx, r, stationAngle + 0.25, 'rgba(140, 220, 255, 0.42)');
  }

  ctx.restore();
}

function drawOrbitGuideArc(ctx, radius, startAngle, endAngle, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, radius, startAngle, endAngle);
  ctx.stroke();
}

function drawOrbitGuideArrow(ctx, radius, angle, color) {
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  const tangent = angle + Math.PI / 2;
  const size = 7;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tangent);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.65, size * 0.5);
  ctx.lineTo(-size * 0.65, -size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawOrbitTrajectoryAssist(ctx, assist, cam, canvas) {
  if (!assist) return;

  if (assist.apoapsis) {
    drawOrbitMarker(ctx, assist.apoapsis, cam, canvas, '#8fd0ff');
  }
  if (assist.periapsis) {
    drawOrbitMarker(ctx, assist.periapsis, cam, canvas, '#8fd0ff');
  }
  if (assist.burnHint && !assist.orbitOk) {
    drawOrbitMarker(ctx, assist.burnHint, cam, canvas, '#ffdd66', true);
  }
}

function drawOrbitMarker(ctx, marker, cam, canvas, color, filled = false) {
  const p = worldToScreen(cam, marker.x, marker.y, canvas);
  const r = filled ? 7 : 5;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = filled ? 'rgba(255, 221, 102, 0.18)' : 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.font = filled ? 'bold 9px sans-serif' : 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(marker.label, p.x, p.y - r - 4);
  ctx.textAlign = 'left';
  ctx.restore();
}

export function drawPlanetImpactMarker(ctx, x, y, cam, canvas) {
  const p = worldToScreen(cam, x, y, canvas);
  const size = 9 * cam.zoom;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 90, 70, 0.95)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x - size, p.y - size);
  ctx.lineTo(p.x + size, p.y + size);
  ctx.moveTo(p.x + size, p.y - size);
  ctx.lineTo(p.x - size, p.y + size);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 80, 60, 0.18)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, size * 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Zeichnet Orbit-HUD für Level 7: Zielorbit zuerst, Rendezvous danach.
 * Empfängt vorberechnete Physikdaten aus computeOrbitHudData() in main.js —
 * keine Physikberechnungen im Renderer.
 * @param {object} data - { deltaV, radiusError, radialSpeed, tangentialError,
 *                          heightOk, radialOk, tangentOk, orbitOk }
 */
export function drawOrbitHud(ctx, canvas, data) {
  if (!data) return;

  const { deltaV, radiusError, radialSpeed, tangentialError,
          heightOk, radialOk, tangentOk, orbitOk } = data;

  const w = canvas.clientWidth;
  const panelX = Math.floor(w / 2) - 138;
  const panelY = 10;
  const panelW = 276;
  const panelH = 92;

  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(panelX, panelY, panelW, panelH);

  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#8fd0ff';
  ctx.fillText('Target Orbit', panelX + 10, panelY + 18);

  drawOrbitHudRow(ctx, panelX + 10, panelY + 36, 'Altitude', signed(radiusError, 0), heightOk);
  drawOrbitHudRow(ctx, panelX + 10, panelY + 54, 'Radial', signed(radialSpeed, 3) + ' px/f', radialOk);
  drawOrbitHudRow(ctx, panelX + 10, panelY + 72, 'Tangent', signed(tangentialError, 3) + ' px/f', tangentOk);

  const dvColor = orbitOk
    ? (deltaV < 0.4 ? '#44ff88' : deltaV < 1.2 ? '#ffdd44' : '#ff5555')
    : '#6f8fa8';
  ctx.fillStyle = dvColor;
  ctx.fillText('Rendezvous ΔV ' + deltaV.toFixed(3), panelX + 138, panelY + 54);

  ctx.fillStyle = orbitOk ? '#44ff88' : '#ffdd44';
  ctx.beginPath();
  ctx.arc(panelX + panelW - 16, panelY + 20, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(orbitOk ? 'OK' : 'ORB', panelX + panelW - 16, panelY + 23);
  ctx.textAlign = 'left';
}

function drawOrbitHudRow(ctx, x, y, label, value, ok) {
  ctx.fillStyle = ok ? '#44ff88' : '#ffdd44';
  ctx.fillText(label + ': ', x, y);
  ctx.fillStyle = ok ? '#b8ffd0' : '#ffe58a';
  ctx.fillText(value, x + 62, y);
}

function signed(value, digits) {
  const rounded = value.toFixed(digits);
  return value > 0 ? '+' + rounded : rounded;
}

/**
 * Zeichnet die Event-Horizon-Warnung (pulsierende rote Vignette).
 */
export function drawEventHorizonWarning(ctx, canvas, pulse) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const alpha = 0.15 + 0.2 * pulse;

  const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  grad.addColorStop(0, 'rgba(255,0,0,0)');
  grad.addColorStop(1, `rgba(200,0,0,${alpha})`);

  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Level 6: Gasriese (Jupiter-artig)
// ---------------------------------------------------------------------------

// Wolkenbänder: [yFactor, widthFactor, color, alpha]
// yFactor = Mitte des Bandes relativ zu r (−1 = Pol, +1 = Südpol)
const GAS_CLOUD_BANDS = [
  { y: -0.72, w: 0.10, color: '#c0956a', alpha: 0.82 },
  { y: -0.48, w: 0.14, color: '#e8c98a', alpha: 0.78 },
  { y: -0.22, w: 0.18, color: '#b87040', alpha: 0.85 },
  { y:  0.05, w: 0.20, color: '#f0dfa0', alpha: 0.72 },
  { y:  0.30, w: 0.16, color: '#c06030', alpha: 0.80 },
  { y:  0.55, w: 0.13, color: '#deb880', alpha: 0.74 },
  { y:  0.78, w: 0.09, color: '#a05828', alpha: 0.70 },
];

/**
 * Zeichnet einen Jupiter-artigen Gasriesen mit rotierenden Wolkenbändern
 * und einem markanten roten Sturmoval.
 * @param {object} planet - { x, y, radius, rotation, cloudAngle }
 */
export function drawGasPlanet(ctx, planet, cam, canvas) {
  const p = worldToScreen(cam, planet.x, planet.y, canvas);
  const z = cam.zoom;
  const r = planet.radius * z;
  const time = performance.now() * 0.001;
  const bandPhase = planet.cloudAngle + time * 0.012;

  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();

  drawGasPlanetSurface(ctx, r, bandPhase);
  drawGasCloudBands(ctx, r, bandPhase);
  drawGasBandWaviness(ctx, r, bandPhase);
  drawGreatRedSpot(ctx, r, bandPhase);

  ctx.restore();

  drawGasAtmosphereHalo(ctx, r, p);
  drawGasTerminator(ctx, r, p);
  drawGasHighlight(ctx, r, p);
}

export function drawRingPlanet(ctx, planet, cam, canvas) {
  const p = worldToScreen(cam, planet.x, planet.y, canvas);
  const z = cam.zoom;
  const r = planet.radius * z;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-0.18);

  drawRingPlanetBackRings(ctx, r);
  drawRingPlanetBody(ctx, r);
  drawRingPlanetFrontRings(ctx, r);

  ctx.restore();

  drawGasAtmosphereHalo(ctx, r, p);
  drawGasTerminator(ctx, r, p);
  drawGasHighlight(ctx, r, p);
}

function drawRingPlanetBody(ctx, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();

  const baseGrad = ctx.createRadialGradient(-r * 0.34, -r * 0.34, r * 0.06, 0, 0, r);
  baseGrad.addColorStop(0, '#f0d7a0');
  baseGrad.addColorStop(0.34, '#b98558');
  baseGrad.addColorStop(0.70, '#6f4f56');
  baseGrad.addColorStop(1, '#2c2638');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(-r, -r, r * 2, r * 2);

  const bands = [
    { y: -0.62, h: 0.10, c: 'rgba(250, 224, 160, 0.55)' },
    { y: -0.36, h: 0.16, c: 'rgba(130, 95, 100, 0.48)' },
    { y: -0.08, h: 0.14, c: 'rgba(238, 198, 128, 0.42)' },
    { y:  0.22, h: 0.18, c: 'rgba(92, 74, 96, 0.50)' },
    { y:  0.54, h: 0.12, c: 'rgba(224, 174, 112, 0.40)' },
  ];

  for (const band of bands) {
    ctx.fillStyle = band.c;
    ctx.fillRect(-r, band.y * r, r * 2, band.h * r);
  }

  ctx.restore();
}

function drawRingPlanetBackRings(ctx, r) {
  drawRingEllipse(ctx, r, 'back');
}

function drawRingPlanetFrontRings(ctx, r) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(-r * 2.65, 0, r * 5.3, r * 1.15);
  ctx.clip();
  drawRingEllipse(ctx, r, 'front');
  ctx.restore();
}

function drawRingEllipse(ctx, r, pass) {
  const alpha = pass === 'front' ? 0.68 : 0.38;
  const rings = [
    { scale: 1.52, width: 14, color: `rgba(230, 210, 170, ${alpha * 0.55})` },
    { scale: 1.82, width: 22, color: `rgba(168, 150, 142, ${alpha * 0.70})` },
    { scale: 2.12, width: 12, color: `rgba(245, 230, 190, ${alpha * 0.62})` },
    { scale: 2.42, width: 20, color: `rgba(120, 112, 128, ${alpha * 0.45})` },
  ];

  ctx.save();
  ctx.scale(1, 0.28);
  for (const ring of rings) {
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = Math.max(1, ring.width);
    ctx.beginPath();
    ctx.arc(0, 0, r * ring.scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Zeichnet die orange-braune Basiskugel des Gasriesen. */
function drawGasPlanetSurface(ctx, r, bandPhase) {
  const baseGrad = ctx.createRadialGradient(-r * 0.28, -r * 0.30, r * 0.05, 0, 0, r);
  baseGrad.addColorStop(0,    '#e8c080');
  baseGrad.addColorStop(0.30, '#c97840');
  baseGrad.addColorStop(0.65, '#8b4520');
  baseGrad.addColorStop(1,    '#4a200a');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(-r - 2, -r - 2, (r + 2) * 2, (r + 2) * 2);
}

/** Zeichnet die horizontalen Wolkenbänder mit differentieller Rotation. */
function drawGasCloudBands(ctx, r, bandPhase) {
  for (let bi = 0; bi < GAS_CLOUD_BANDS.length; bi++) {
    const band = GAS_CLOUD_BANDS[bi];
    const xOffset = Math.sin(bandPhase * (0.7 + bi * 0.18) + bi * 1.3) * r * 0.04;
    const bandY = band.y * r;
    const halfW = band.w * r;

    ctx.save();
    ctx.translate(xOffset, 0);
    ctx.fillStyle = band.color;
    ctx.globalAlpha = band.alpha;
    ctx.fillRect(-r - 4, bandY - halfW, (r + 4) * 2, halfW * 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** Zeichnet die welligen turbulenten Kanten an den Wolkenbändern. */
function drawGasBandWaviness(ctx, r, bandPhase) {
  ctx.save();
  for (let bi = 0; bi < GAS_CLOUD_BANDS.length; bi++) {
    const band = GAS_CLOUD_BANDS[bi];
    const bandY = band.y * r;
    const halfW = band.w * r;
    const waveAmp = r * 0.025;
    const waveFreq = 3.5 + bi * 0.4;
    const phase = bandPhase * (0.6 + bi * 0.2) + bi * 0.8;

    ctx.beginPath();
    ctx.moveTo(-r, bandY - halfW);
    for (let xi = -r; xi <= r; xi += 8) {
      const yw = bandY - halfW + Math.sin((xi / r) * Math.PI * waveFreq + phase) * waveAmp;
      ctx.lineTo(xi, yw);
    }
    ctx.lineTo(r, bandY + halfW * 0.3);
    ctx.lineTo(-r, bandY + halfW * 0.3);
    ctx.closePath();

    const edgeColor = bi % 2 === 0 ? 'rgba(255,220,150,0.22)' : 'rgba(80,30,10,0.18)';
    ctx.fillStyle = edgeColor;
    ctx.fill();
  }
  ctx.restore();
}

/** Zeichnet den Großen Roten Fleck (Sturm-Oval) mit hellem Kern. */
function drawGreatRedSpot(ctx, r, bandPhase) {
  const spotPhase = bandPhase * 0.55;
  const spotX = Math.sin(spotPhase) * r * 0.18;
  const spotY = r * 0.10;
  const spotRx = r * 0.22;
  const spotRy = r * 0.11;

  ctx.save();
  const spotGrad = ctx.createRadialGradient(spotX - spotRx * 0.2, spotY - spotRy * 0.2, spotRy * 0.1, spotX, spotY, spotRx);
  spotGrad.addColorStop(0,    'rgba(240, 100, 60, 0.95)');
  spotGrad.addColorStop(0.35, 'rgba(190,  55, 30, 0.90)');
  spotGrad.addColorStop(0.70, 'rgba(140,  28, 18, 0.80)');
  spotGrad.addColorStop(1,    'rgba( 80,  10,  5, 0)');
  ctx.fillStyle = spotGrad;
  ctx.beginPath();
  ctx.ellipse(spotX, spotY, spotRx, spotRy, 0, 0, Math.PI * 2);
  ctx.fill();

  const spotCore = ctx.createRadialGradient(spotX - spotRx * 0.15, spotY - spotRy * 0.15, 0, spotX, spotY, spotRx * 0.45);
  spotCore.addColorStop(0, 'rgba(255,160,100,0.6)');
  spotCore.addColorStop(1, 'rgba(255,100, 60,0)');
  ctx.fillStyle = spotCore;
  ctx.beginPath();
  ctx.ellipse(spotX, spotY, spotRx * 0.45, spotRy * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Zeichnet den orange/gelben Atmosphären-Halo um den Planeten. */
function drawGasAtmosphereHalo(ctx, r, p) {
  const atmInner = r * 0.97;
  const atmOuter = r * 1.16;
  const atmGrad = ctx.createRadialGradient(0, 0, atmInner, 0, 0, atmOuter);
  atmGrad.addColorStop(0,    'rgba(230, 150,  60, 0.50)');
  atmGrad.addColorStop(0.35, 'rgba(200, 110,  30, 0.26)');
  atmGrad.addColorStop(0.72, 'rgba(150,  70,  10, 0.09)');
  atmGrad.addColorStop(1,    'rgba(100,  40,   0, 0)');

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = atmGrad;
  ctx.beginPath();
  ctx.arc(0, 0, atmOuter, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Zeichnet den Terminator-Schatten auf der Nachtseite. */
function drawGasTerminator(ctx, r, p) {
  const shadowGrad = ctx.createRadialGradient(r * 0.38, -r * 0.28, 0, -r * 0.1, r * 0.1, r * 1.2);
  shadowGrad.addColorStop(0,    'rgba(0,0,0,0)');
  shadowGrad.addColorStop(0.52, 'rgba(0,0,0,0)');
  shadowGrad.addColorStop(0.76, 'rgba(0,5,15,0.25)');
  shadowGrad.addColorStop(1,    'rgba(0,3,10,0.60)');

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = shadowGrad;
  ctx.fill();
  ctx.restore();
}

/** Zeichnet den spekularen Highlight (Lichtreflex). */
function drawGasHighlight(ctx, r, p) {
  const hlGrad = ctx.createRadialGradient(-r * 0.28, -r * 0.32, 0, -r * 0.28, -r * 0.32, r * 0.32);
  hlGrad.addColorStop(0, 'rgba(255,230,180,0.20)');
  hlGrad.addColorStop(0.5, 'rgba(255,210,140,0.06)');
  hlGrad.addColorStop(1,    'rgba(255,200,100,0)');

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = hlGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Level 6: Mond (grau, kraterpockig)
// ---------------------------------------------------------------------------

// Vorberechnete Kraterpositionen: [xFac, yFac, rFac, shadowDir]
// xFac/yFac relativ zu Mondradius, rFac = Kraterradius / Mondradius
const MOON_CRATERS = [
  { xf: -0.30, yf: -0.22, rf: 0.18, bright: 0.55 },
  { xf:  0.38, yf:  0.15, rf: 0.14, bright: 0.50 },
  { xf: -0.10, yf:  0.40, rf: 0.11, bright: 0.60 },
  { xf:  0.20, yf: -0.38, rf: 0.16, bright: 0.48 },
  { xf: -0.42, yf:  0.32, rf: 0.09, bright: 0.62 },
  { xf:  0.05, yf:  0.10, rf: 0.07, bright: 0.45 },
];

/**
 * Zeichnet einen realistisch wirkenden grauen Mond mit Kratern.
 * @param {object} moon - { x, y, radius, ... }
 */
export function drawMoon(ctx, moon, cam, canvas) {
  const p = worldToScreen(cam, moon.x, moon.y, canvas);
  const z = cam.zoom;
  const r = moon.radius * z;

  ctx.save();
  ctx.translate(p.x, p.y);

  // --- 1. Mondbasis (grauer Radial-Gradient) ---
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();

  const baseGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.28, r * 0.04, 0, 0, r);
  baseGrad.addColorStop(0,    '#d8d8d8');  // helles Grau (Highlight)
  baseGrad.addColorStop(0.30, '#aaaaaa');  // mittleres Grau
  baseGrad.addColorStop(0.65, '#707070');  // dunkles Grau
  baseGrad.addColorStop(1,    '#3c3c3c');  // sehr dunkler Rand
  ctx.fillStyle = baseGrad;
  ctx.fillRect(-r - 1, -r - 1, (r + 1) * 2, (r + 1) * 2);

  // --- 2. Krater ---
  for (const cr of MOON_CRATERS) {
    const cx = cr.xf * r;
    const cy = cr.yf * r;
    const cr_r = cr.rf * r;

    // Äußerer dunkler Ring (Kraterwand)
    const rimGrad = ctx.createRadialGradient(cx, cy, cr_r * 0.55, cx, cy, cr_r);
    rimGrad.addColorStop(0,   `rgba(40,40,40,0.55)`);
    rimGrad.addColorStop(0.7, `rgba(30,30,30,0.35)`);
    rimGrad.addColorStop(1,   `rgba(20,20,20,0)`);
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, cr_r, 0, Math.PI * 2);
    ctx.fill();

    // Innenboden: leicht heller als Umgebung
    const floorGrad = ctx.createRadialGradient(
      cx - cr_r * 0.22, cy - cr_r * 0.18, 0,
      cx, cy, cr_r * 0.58
    );
    floorGrad.addColorStop(0,   `rgba(180,180,180,${cr.bright * 0.5})`);
    floorGrad.addColorStop(0.6, `rgba(130,130,130,${cr.bright * 0.25})`);
    floorGrad.addColorStop(1,   `rgba(100,100,100,0)`);
    ctx.fillStyle = floorGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, cr_r * 0.58, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // Ende Clip

  // --- 3. Terminator-Schatten ---
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();

  const shadowGrad = ctx.createRadialGradient(r * 0.35, -r * 0.25, 0, -r * 0.08, r * 0.08, r * 1.15);
  shadowGrad.addColorStop(0,    'rgba(0,0,0,0)');
  shadowGrad.addColorStop(0.50, 'rgba(0,0,0,0)');
  shadowGrad.addColorStop(0.75, 'rgba(0,0,10,0.28)');
  shadowGrad.addColorStop(1,    'rgba(0,0, 8,0.62)');
  ctx.fillStyle = shadowGrad;
  ctx.fillRect(-r - 1, -r - 1, (r + 1) * 2, (r + 1) * 2);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Level 6: Slingshot-HUD
// ---------------------------------------------------------------------------

/**
 * Zeichnet das Slingshot-HUD für Level 6.
 * Empfängt vorberechnete Anzeigedaten aus computeSlingshotHudData() in main.js —
 * keine Entscheidungslogik oder Schwellwertvergleiche im Renderer.
 * @param {object} data - { hasTrajectory, caColor, caLabel, speed, speedColor, dotColor }
 */
export function drawSlingshotHud(ctx, canvas, data) {
  const w = canvas.clientWidth;
  const panelX = Math.floor(w / 2) - 130;
  const panelY = 10;
  const panelW = 260;
  const panelH = 76;

  ctx.save();

  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(panelX, panelY, panelW, panelH);

  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#ffb860';
  ctx.fillText('Schwerkraftschleuder', panelX + 10, panelY + 18);

  if (!data.hasTrajectory) {
    ctx.fillStyle = '#6f8fa8';
    ctx.fillText('Trajektorie berechnen ...', panelX + 10, panelY + 42);
    ctx.restore();
    return;
  }

  ctx.fillStyle = '#8fd0ff';
  ctx.fillText('Closest Approach:', panelX + 10, panelY + 40);
  ctx.fillStyle = data.caColor;
  ctx.fillText(data.caLabel, panelX + 10, panelY + 58);

  ctx.fillStyle = '#8fd0ff';
  ctx.textAlign = 'right';
  ctx.fillText('Geschw.:', panelX + panelW - 10, panelY + 40);
  ctx.fillStyle = data.speedColor;
  ctx.fillText(data.speed.toFixed(2) + ' px/f', panelX + panelW - 10, panelY + 58);
  ctx.textAlign = 'left';

  ctx.fillStyle = data.dotColor;
  ctx.beginPath();
  ctx.arc(panelX + panelW - 16, panelY + 18, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
