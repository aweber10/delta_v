import { RCS_PULSE_MS, TOT_ZONE_RADIUS, RCS_ZONE_RADIUS } from './constants.js';
import { screenToWorld } from './camera.js';

export function setupMobileInput(flags, canvas, cam, ship) {
  canvas.addEventListener('touchstart', (ev) => {
    ev.preventDefault();
    const t = ev.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const sx = t.clientX - rect.left;
    const sy = t.clientY - rect.top;
    const world = screenToWorld(cam, sx, sy, canvas);
    const dx = world.x - ship.x;
    const dy = world.y - ship.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= TOT_ZONE_RADIUS) {
      flags.brake = true;
      return;
    }
    if (dist <= RCS_ZONE_RADIUS) {
      const nx = dx / dist;
      const ny = dy / dist;
      flags.rcsPulse = { dx: nx, dy: ny };
      setTimeout(() => (flags.rcsPulse = null), RCS_PULSE_MS + 10);
      return;
    }
    // outside RCS zone => travel mode: rotate to point + main thrust
    const ang = Math.atan2(dy, dx);
    // set rotation towards angle via flags: simple direct set
    const diff = normalizeAngle(ang - ship.angle);
    if (diff < 0) {
      flags.rotateLeft = true;
      setTimeout(() => (flags.rotateLeft = false), 200);
    } else {
      flags.rotateRight = true;
      setTimeout(() => (flags.rotateRight = false), 200);
    }
    flags.thrustMain = true;
    // stop thrust after short time
    setTimeout(() => (flags.thrustMain = false), 200);
  });
}

function normalizeAngle(a) {
  a = (a + Math.PI * 2) % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  return a;
}
