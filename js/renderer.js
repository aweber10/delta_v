import { SHIP_RADIUS, ARM_LENGTH, FUEL_START } from './constants.js';
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

export function drawShip(ctx, ship, cam, canvas, thrustActive) {
  const p = worldToScreen(cam, ship.x, ship.y, canvas);
  const z = cam.zoom;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(ship.angle);
  ctx.fillStyle = '#eee';
  ctx.beginPath();
  ctx.moveTo(SHIP_RADIUS * z, 0);
  ctx.lineTo(-SHIP_RADIUS * z, SHIP_RADIUS * 0.7 * z);
  ctx.lineTo(-SHIP_RADIUS * z, -SHIP_RADIUS * 0.7 * z);
  ctx.closePath();
  ctx.fill();

  // thrust flame
  ctx.fillStyle = 'orange';
  if (thrustActive && ship.fuel > 0) {
    ctx.beginPath();
    ctx.moveTo(-SHIP_RADIUS * z, 0);
    ctx.lineTo(-SHIP_RADIUS * z - 6 * z, 4 * z);
    ctx.lineTo(-SHIP_RADIUS * z - 6 * z, -4 * z);
    ctx.closePath();
    ctx.fill();
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
