import { RCS_PULSE_MS, RCS_ZONE_RADIUS_PX, RCS_ZONE_RADIUS, normalizeAngle } from './constants.js';
import { screenToWorld, worldToScreen } from './camera.js';



export function setupMobileInput(flags, canvas, cam, ship) {
  canvas.addEventListener('touchstart', (ev) => {
    ev.preventDefault();
    const t = ev.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const tx = t.clientX - rect.left;
    const ty = t.clientY - rect.top;
    
    const shipScreen = worldToScreen(cam, ship.x, ship.y, canvas);
    const sx = shipScreen.x;
    const sy = shipScreen.y;
    
    const screenDist = Math.hypot(tx - sx, ty - sy);
    
    if (screenDist <= RCS_ZONE_RADIUS_PX) {
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
    
    // Reise-Modus: Ziel setzen, aber Schub wird von der Physik erst nach Ausrichtung gezündet
    const world = screenToWorld(cam, tx, ty, canvas);
    const dx = world.x - ship.x;
    const dy = world.y - ship.y;
    const ang = Math.atan2(dy, dx);
    
    ship.targetAngle = ang;
    ship.pendingThrustTime = 200; // 200ms geplanter Schub
  });
}
