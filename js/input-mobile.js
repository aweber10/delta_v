import { RCS_PULSE_MS, RCS_ZONE_RADIUS_PX, RCS_ZONE_RADIUS, normalizeAngle } from './constants.js';
import { screenToWorld, worldToScreen } from './camera.js';



export function setupMobileInput(flags, canvas, cam, ship) {
  let activeTouchId = null;
  let touchStartTime = 0;
  let holdTimer = null;

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
      flags.rcsFlash = { dx: nx, dy: ny, time: performance.now() };
      setTimeout(() => (flags.rcsPulse = null), RCS_PULSE_MS + 10);
      return;
    }
    
    // Reise-Modus
    activeTouchId = t.identifier;
    touchStartTime = performance.now();
    ship.thrustHeld = false;
    ship.tapThrustTime = 0;
    
    const world = screenToWorld(cam, tx, ty, canvas);
    const dx = world.x - ship.x;
    const dy = world.y - ship.y;
    ship.targetAngle = Math.atan2(dy, dx);
    
    // Check for hold
    holdTimer = setTimeout(() => {
      if (activeTouchId !== null) {
        ship.thrustHeld = true;
      }
    }, 150);
  });

  canvas.addEventListener('touchend', handleTouchEnd);
  canvas.addEventListener('touchcancel', handleTouchEnd);

  function handleTouchEnd(ev) {
    for (let i = 0; i < ev.changedTouches.length; i++) {
      if (ev.changedTouches[i].identifier === activeTouchId) {
        const touchDuration = performance.now() - touchStartTime;
        clearTimeout(holdTimer);
        
        // War es ein kurzer Tap und das Schiff ist schon ausgerichtet?
        if (touchDuration < 150 && !ship.thrustHeld) {
          const angleDiff = Math.abs(normalizeAngle(ship.targetAngle - ship.angle));
          if (angleDiff < 0.05) {
            ship.tapThrustTime = 300; // 300ms Impuls
          }
        }
        
        activeTouchId = null;
        ship.thrustHeld = false;
      }
    }
  }
}
