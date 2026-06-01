import { RCS_PULSE_MS } from './constants.js';

export function createInputFlags() {
  return {
    thrustMain: false,
    rotateLeft: false,
    rotateRight: false,
    rcsPulse: null, // {dx, dy}
  };
}

export function setupDesktopInput(flags, ship) {
  window.addEventListener('keydown', (e) => {
    // Hauptschub
    if (e.key === 'ArrowUp') flags.thrustMain = true;
    // Rotation mit Zieltwinkel für den Bordcomputer
    if (e.key === 'ArrowLeft') {
      ship.targetAngle += Math.PI * 0.03;
    }
    if (e.key === 'ArrowRight') {
      ship.targetAngle -= Math.PI * 0.03;
    }
    // RCS
    if (e.key === 'w') queueRcs(flags, ship, 0, -1);
    if (e.key === 's') queueRcs(flags, ship, 0, 1);
    if (e.key === 'a') queueRcs(flags, ship, -1, 0);
    if (e.key === 'd') queueRcs(flags, ship, 1, 0);
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') flags.thrustMain = false;
  });
}

function queueRcs(flags, ship, dx, dy) {
  flags.rcsPulse = { dx, dy };
  setTimeout(() => {
    flags.rcsPulse = null;
  }, RCS_PULSE_MS + 10);
}
