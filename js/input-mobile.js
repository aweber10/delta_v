import { RCS_PULSE_MS, RCS_ZONE_RADIUS_PX, RCS_ZONE_RADIUS } from './constants.js';
import { screenToWorld, worldToScreen } from './camera.js';

function normalizeAngle(a) {
  a = (a + Math.PI * 2) % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  return a;
}

function shortestDirToTarget(from, target) {
  const diff = normalizeAngle(target - from);
  return diff;
}

export function setupMobileInput(flags, canvas, cam, ship) {
  canvas.addEventListener('touchstart', (ev) => {
    ev.preventDefault();
    const t = ev.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    // Touch in CSS-Pixel
    const tx = t.clientX - rect.left;
    const ty = t.clientY - rect.top;
    
    // Schiff-Position auf dem Bildschirm berechnen (CSS-Pixel)
    const shipScreen = worldToScreen(cam, ship.x, ship.y, canvas);
    const sx = shipScreen.x;
    const sy = shipScreen.y;
    
    // Screen-space Distanz zwischen Tap und Schiff (CSS-Pixel)
    const screenDist = Math.hypot(tx - sx, ty - sy);
    
    if (screenDist <= RCS_ZONE_RADIUS_PX) {
      // Steuerdüsen-Impuls in Richtung des Taps
      const world = screenToWorld(cam, tx, ty, canvas);
      const dx = world.x - ship.x;
      const dy = world.y - ship.y;
      const dist = Math.hypot(dx, dy);
      const nx = dx / dist;
      const ny = dy / dist;
      flags.rcsPulse = { dx: nx, dy: ny };
      setTimeout(() => (flags.rcsPulse = null), RCS_PULSE_MS + 10);
      return;
    }
    
    // Außerhalb RCS-Zone: Reise-Modus -> Zielwinkel setzen
    const world = screenToWorld(cam, tx, ty, canvas);
    const dx = world.x - ship.x;
    const dy = world.y - ship.y;
    const ang = Math.atan2(dy, dx);
    ship.targetAngle = ang; // Bordcomputer-Zielwinkel setzen
    flags.thrustMain = true;
    // stoppe Schub nach kurzer Zeit
    setTimeout(() => (flags.thrustMain = false), 200);
  });
}
