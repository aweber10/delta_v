import { SHIP_RADIUS, ARM_LENGTH, FUEL_START, normalizeAngle, RCS_ZONE_RADIUS_PX } from './constants.js';
import { worldToScreen } from './camera.js';

export function clear(ctx, canvas) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

export function drawStars(ctx, stars, cam, canvas) {
  ctx.fillStyle = '#fff';
  for (const s of stars) {
    const p = worldToScreen(cam, s.x, s.y, canvas);
    ctx.fillRect(p.x, p.y, 1 * cam.zoom, 1 * cam.zoom);
  }
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
  ctx.save();
  ctx.translate(p.x, p.y);

  const z = cam.zoom;

  // --- ISS-style body ---
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

  // --- Solar panels (ISS-style: 2 pairs, above and below truss) ---
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
  // top-left pair
  ctx.fillRect(-62 * z, -26 * z, 44 * z, 8 * z);
  ctx.strokeRect(-62 * z, -26 * z, 44 * z, 8 * z);
  ctx.fillRect(-62 * z, -15 * z, 44 * z, 8 * z);
  ctx.strokeRect(-62 * z, -15 * z, 44 * z, 8 * z);
  // top-right pair
  ctx.fillRect(18 * z, -26 * z, 44 * z, 8 * z);
  ctx.strokeRect(18 * z, -26 * z, 44 * z, 8 * z);
  ctx.fillRect(18 * z, -15 * z, 44 * z, 8 * z);
  ctx.strokeRect(18 * z, -15 * z, 44 * z, 8 * z);
  // bottom-left pair
  ctx.fillRect(-62 * z, 7 * z, 44 * z, 8 * z);
  ctx.strokeRect(-62 * z, 7 * z, 44 * z, 8 * z);
  ctx.fillRect(-62 * z, 18 * z, 44 * z, 8 * z);
  ctx.strokeRect(-62 * z, 18 * z, 44 * z, 8 * z);
  // bottom-right pair
  ctx.fillRect(18 * z, 7 * z, 44 * z, 8 * z);
  ctx.strokeRect(18 * z, 7 * z, 44 * z, 8 * z);
  ctx.fillRect(18 * z, 18 * z, 44 * z, 8 * z);
  ctx.strokeRect(18 * z, 18 * z, 44 * z, 8 * z);

  // --- Docking arm ---
  ctx.save();
  ctx.rotate(station.dockAngle);

  // arm strut
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 2.5 * z;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(ARM_LENGTH * z, 0);
  ctx.stroke();

  // small joint at midpoint
  ctx.fillStyle = '#bbb';
  ctx.beginPath();
  ctx.arc(ARM_LENGTH * 0.5 * z, 0, 3 * z, 0, Math.PI * 2);
  ctx.fill();

  // port circle at arm end
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * z;
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(ARM_LENGTH * z, 0, 5 * z, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // glowing dock ring
  if (station.docked) {
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
    ctx.lineWidth = 3.5 * z;
    ctx.beginPath();
    ctx.arc(ARM_LENGTH * z, 0, 8 * z, 0, Math.PI * 2);
    ctx.stroke();
  }

  // approach arrow: points AWAY from port (= from where ship must come)
  // arrow tip is at arm end, tail points toward the approaching ship
  const arrowDist = 18 * z;
  const ax = ARM_LENGTH * z + arrowDist;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(ax, 0);           // tip (pointing toward port)
  ctx.lineTo(ax + 10 * z,  5 * z);
  ctx.lineTo(ax + 10 * z, -5 * z);
  ctx.closePath();
  ctx.fill();

  // subtle approach cone
  ctx.strokeStyle = `${color}55`;
  ctx.lineWidth = 1 * z;
  ctx.beginPath();
  ctx.moveTo(ARM_LENGTH * z, 0);
  ctx.lineTo(ARM_LENGTH * z + 40 * z,  15 * z);
  ctx.moveTo(ARM_LENGTH * z, 0);
  ctx.lineTo(ARM_LENGTH * z + 40 * z, -15 * z);
  ctx.stroke();

  ctx.restore(); // end dock arm transform

  ctx.restore(); // end station transform
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

export function drawTargetArrow(ctx, ship, targetStation, cam, canvas) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // Direction from ship to target station in world space
  const dx = targetStation.x - ship.x;
  const dy = targetStation.y - ship.y;
  const dist = Math.hypot(dx, dy);

  // Check if station is already visible on screen
  const stationScreen = { x: width / 2 + dx * cam.zoom, y: height / 2 + dy * cam.zoom };
  const onScreen = stationScreen.x > 40 && stationScreen.x < width - 40 &&
                   stationScreen.y > 40 && stationScreen.y < height - 40;

  if (onScreen) return; // station visible, no arrow needed

  // Angle from ship to target
  const angle = Math.atan2(dy, dx);

  // Place arrow on a circle near screen edge, centered on screen
  const cx = width / 2;
  const cy = height / 2;
  const edgeR = Math.min(cx, cy) - 48;

  const arrowX = cx + Math.cos(angle) * edgeR;
  const arrowY = cy + Math.sin(angle) * edgeR;

  ctx.save();
  ctx.translate(arrowX, arrowY);
  ctx.rotate(angle);

  // Outer glow circle
  ctx.strokeStyle = 'rgba(255, 80, 80, 0.3)';
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
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.moveTo(14, 0);       // tip
  ctx.lineTo(2, -7);
  ctx.lineTo(6, 0);
  ctx.lineTo(2, 7);
  ctx.closePath();
  ctx.fill();

  // Shaft
  ctx.fillStyle = '#ff4444';
  ctx.fillRect(-10, -3, 16, 6);

  ctx.restore();

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
  ctx.fillStyle = '#ff9999';
  ctx.fillText(distLabel, labelX, labelY);
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

export function drawHud(ctx, ship, canvas, targetStation, dockCheck, score, dockColorValue, level = 1) {
  // top left info
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(10, 10, 220, 100);
  ctx.fillStyle = '#555';
  ctx.fillRect(15, 20, 210, 20);
  ctx.fillStyle = 'lime';
  ctx.fillRect(15, 20, (ship.fuel / FUEL_START) * 210, 20);

  ctx.fillStyle = '#fff';
  ctx.font = '14px sans-serif';
  ctx.fillText('Fuel: ' + Math.floor(ship.fuel), 20, 58);

  const speed = Math.hypot(ship.vx, ship.vy).toFixed(2);
  ctx.fillText('Speed: ' + speed, 20, 78);
  ctx.fillText('Cargo: ' + (ship.cargo > 0 ? 'Loaded' : 'Empty'), 20, 98);
  
  // top right info (target and score)
  const trX = canvas.clientWidth - 230;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(trX, 10, 220, 120);
  
  ctx.fillStyle = '#fff';
  ctx.fillText('Level: ' + level, trX + 10, 30);
  ctx.fillText('Score: ' + score, trX + 10, 50);
  ctx.fillText('Target Dist: ' + Math.floor(dockCheck.dist), trX + 10, 70);
  
  // Angle diff to degrees
  const targetApproachAngle = targetStation.dockAngle + Math.PI;
  const angleDiffDeg = Math.floor(Math.abs(ship.angle - targetApproachAngle) * (180/Math.PI)) % 360;
  const actualDiff = angleDiffDeg > 180 ? 360 - angleDiffDeg : angleDiffDeg;
  ctx.fillText('Target Angle: ' + actualDiff + '°', trX + 10, 90);
  
  // Dock status
  ctx.fillText('Dock Status: ', trX + 10, 110);
  ctx.fillStyle = dockColorValue;
  ctx.fillRect(trX + 100, 98, 14, 14);

  // Docked timer
  if (ship.dockedTimer > 0) {
    ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Docked! Transferring...', canvas.clientWidth / 2, canvas.clientHeight / 4);
    ctx.textAlign = 'left'; // reset
  }
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

  // Einflussfeld-Ringe (äußerster = G_RADIUS)
  const ringColors = [
    { r: 600 * z, alpha: 0.15 },
    { r: 420 * z, alpha: 0.25 },
    { r: 260 * z, alpha: 0.35 },
    { r: 140 * z, alpha: 0.50 },
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
  ctx.arc(0, 0, horizon * 0.98, 0, Math.PI * 2);
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
 * Zeichnet Orbit-HUD für Level 5: Zielorbit zuerst, Rendezvous danach.
 */
export function drawOrbitHud(ctx, ship, station, planet, canvas, orbit) {
  if (!station || !station.orbiting) return;

  const relVx = ship.vx - station.vx;
  const relVy = ship.vy - station.vy;
  const deltaV = Math.hypot(relVx, relVy);
  const dx = ship.x - planet.x;
  const dy = ship.y - planet.y;
  const radius = Math.hypot(dx, dy);
  const invRadius = radius > 0 ? 1 / radius : 0;
  const ux = dx * invRadius;
  const uy = dy * invRadius;
  const radialSpeed = ship.vx * ux + ship.vy * uy;
  const tangentialSpeed = ship.vx * -uy + ship.vy * ux;
  const radiusError = radius - orbit.orbitRadius;
  const tangentialError = tangentialSpeed - orbit.targetSpeed;

  const heightOk = Math.abs(radiusError) <= orbit.radiusTolerance;
  const radialOk = Math.abs(radialSpeed) <= orbit.radialSpeedOk;
  const tangentOk = Math.abs(tangentialError) <= orbit.tangentialSpeedOk;
  const orbitOk = heightOk && radialOk && tangentOk;

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
  const bandPhase = planet.cloudAngle + time * 0.012; // langsame Wolkenrotation

  ctx.save();
  ctx.translate(p.x, p.y);

  // Clip auf Planetenkreis
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();

  // --- 1. Basiskugel (orangebraun) ---
  const baseGrad = ctx.createRadialGradient(-r * 0.28, -r * 0.30, r * 0.05, 0, 0, r);
  baseGrad.addColorStop(0,    '#e8c080');  // helles Orange-Creme (Highlight)
  baseGrad.addColorStop(0.30, '#c97840');  // mittleres Orange-Braun
  baseGrad.addColorStop(0.65, '#8b4520');  // dunkles Braun
  baseGrad.addColorStop(1,    '#4a200a');  // sehr dunkles Braun am Rand
  ctx.fillStyle = baseGrad;
  ctx.fillRect(-r - 2, -r - 2, (r + 2) * 2, (r + 2) * 2);

  // --- 2. Horizontale Wolkenbänder ---
  // Jedes Band ist ein horizontaler Streifen, der sich leicht verschiebt
  for (let bi = 0; bi < GAS_CLOUD_BANDS.length; bi++) {
    const band = GAS_CLOUD_BANDS[bi];
    // Leichter horizontaler Versatz pro Band (simuliert Differentialrotation)
    const xOffset = Math.sin(bandPhase * (0.7 + bi * 0.18) + bi * 1.3) * r * 0.04;
    const bandY = band.y * r;
    const halfW = band.w * r;

    ctx.save();
    ctx.translate(xOffset, 0);

    // Band als horizontaler Rechteck-Streifen (innerhalb des Clips)
    ctx.fillStyle = band.color;
    ctx.globalAlpha = band.alpha;
    ctx.fillRect(-r - 4, bandY - halfW, (r + 4) * 2, halfW * 2);

    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // --- 3. Welligkeit der Bänder (turbulente Kanten) ---
  ctx.save();
  for (let bi = 0; bi < GAS_CLOUD_BANDS.length; bi++) {
    const band = GAS_CLOUD_BANDS[bi];
    const bandY = band.y * r;
    const halfW = band.w * r;

    // Wellige Oberkante mit Bezier-ähnlichem Sinus-Verlauf
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

    // Leicht hellere Kante
    const edgeColor = bi % 2 === 0 ? 'rgba(255,220,150,0.22)' : 'rgba(80,30,10,0.18)';
    ctx.fillStyle = edgeColor;
    ctx.fill();
  }
  ctx.restore();

  // --- 4. Großer Roter Fleck (Sturm-Oval) ---
  const spotPhase = bandPhase * 0.55;
  const spotX = Math.sin(spotPhase) * r * 0.18;  // bewegt sich leicht horizontal
  const spotY = r * 0.10;                          // leicht unterhalb Äquator
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

  // Heller Innenkern des Flecks
  const spotCore = ctx.createRadialGradient(spotX - spotRx * 0.15, spotY - spotRy * 0.15, 0, spotX, spotY, spotRx * 0.45);
  spotCore.addColorStop(0, 'rgba(255,160,100,0.6)');
  spotCore.addColorStop(1, 'rgba(255,100, 60,0)');
  ctx.fillStyle = spotCore;
  ctx.beginPath();
  ctx.ellipse(spotX, spotY, spotRx * 0.45, spotRy * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore(); // Ende Clip

  // --- 5. Atmosphären-Halo (orange/gelb) ---
  const atmInner = r * 0.97;
  const atmOuter = r * 1.16;
  const atmGrad = ctx.createRadialGradient(0, 0, atmInner, 0, 0, atmOuter);
  atmGrad.addColorStop(0,    'rgba(230, 150,  60, 0.50)');
  atmGrad.addColorStop(0.35, 'rgba(200, 110,  30, 0.26)');
  atmGrad.addColorStop(0.72, 'rgba(150,  70,  10, 0.09)');
  atmGrad.addColorStop(1,    'rgba(100,  40,   0, 0)');
  const atmCtx = ctx;
  atmCtx.save();
  atmCtx.translate(p.x, p.y);
  atmCtx.fillStyle = atmGrad;
  atmCtx.beginPath();
  atmCtx.arc(0, 0, atmOuter, 0, Math.PI * 2);
  atmCtx.fill();

  // --- 6. Terminator-Schatten ---
  const shadowGrad = atmCtx.createRadialGradient(r * 0.38, -r * 0.28, 0, -r * 0.1, r * 0.1, r * 1.2);
  shadowGrad.addColorStop(0,    'rgba(0,0,0,0)');
  shadowGrad.addColorStop(0.52, 'rgba(0,0,0,0)');
  shadowGrad.addColorStop(0.76, 'rgba(0,5,15,0.25)');
  shadowGrad.addColorStop(1,    'rgba(0,3,10,0.60)');
  atmCtx.beginPath();
  atmCtx.arc(0, 0, r, 0, Math.PI * 2);
  atmCtx.fillStyle = shadowGrad;
  atmCtx.fill();

  // --- 7. Spekularer Highlight ---
  const hlGrad = atmCtx.createRadialGradient(-r * 0.28, -r * 0.32, 0, -r * 0.28, -r * 0.32, r * 0.32);
  hlGrad.addColorStop(0, 'rgba(255,230,180,0.20)');
  hlGrad.addColorStop(0.5, 'rgba(255,210,140,0.06)');
  hlGrad.addColorStop(1,    'rgba(255,200,100,0)');
  atmCtx.fillStyle = hlGrad;
  atmCtx.beginPath();
  atmCtx.arc(0, 0, r, 0, Math.PI * 2);
  atmCtx.fill();

  atmCtx.restore();
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
 * Sanftes Slingshot-Assist-HUD:
 * - Closest Approach (Abstand zur Planetenoberfläche an dem nächsten Trajektoriepunkt)
 * - Geschwindigkeitsanzeige
 * - Farbcodierter Status (grün = sicherer Abstand, gelb = eng, rot = zu nah / Kollision)
 * @param {object} status - { closestApproach, speed, hasTrajectory }
 */
export function drawSlingshotHud(ctx, ship, well, canvas, status) {
  const w = canvas.clientWidth;
  const panelX = Math.floor(w / 2) - 130;
  const panelY = 10;
  const panelW = 260;
  const panelH = 76;

  ctx.save();

  // Panel-Hintergrund
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(panelX, panelY, panelW, panelH);

  // Titel
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#ffb860';
  ctx.fillText('Schwerkraftschleuder', panelX + 10, panelY + 18);

  if (!status.hasTrajectory) {
    ctx.fillStyle = '#6f8fa8';
    ctx.fillText('Trajektorie berechnen ...', panelX + 10, panelY + 42);
    ctx.restore();
    return;
  }

  // Closest Approach: Farbcodierung
  const ca = status.closestApproach;
  let caColor, caLabel;
  if (ca < 0) {
    caColor = '#ff4444';
    caLabel = 'KOLLISION';
  } else if (ca < 80) {
    caColor = '#ff8844';
    caLabel = Math.round(ca) + ' px — zu nah!';
  } else if (ca < 200) {
    caColor = '#ffdd44';
    caLabel = Math.round(ca) + ' px — eng';
  } else if (ca < 500) {
    caColor = '#88ff88';
    caLabel = Math.round(ca) + ' px — gut';
  } else {
    caColor = '#6f8fa8';
    caLabel = Math.round(ca) + ' px — zu weit';
  }

  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#8fd0ff';
  ctx.fillText('Closest Approach:', panelX + 10, panelY + 40);
  ctx.fillStyle = caColor;
  ctx.fillText(caLabel, panelX + 10, panelY + 58);

  // Geschwindigkeit rechts
  const speed = status.speed;
  const speedColor = speed > 2.5 ? '#88ff88' : speed > 1.2 ? '#ffdd44' : '#ff7744';
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#8fd0ff';
  ctx.textAlign = 'right';
  ctx.fillText('Geschw.:', panelX + panelW - 10, panelY + 40);
  ctx.fillStyle = speedColor;
  ctx.fillText(speed.toFixed(2) + ' px/f', panelX + panelW - 10, panelY + 58);
  ctx.textAlign = 'left';

  // Status-Dot oben rechts
  const dotColor = ca < 0 ? '#ff4444' : ca < 80 ? '#ff8844' : ca < 200 ? '#ffdd44' : ca < 500 ? '#44ff88' : '#6f8fa8';
  ctx.fillStyle = dotColor;
  ctx.beginPath();
  ctx.arc(panelX + panelW - 16, panelY + 18, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
