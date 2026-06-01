import { RCS_PULSE_MS } from './constants.js';

export function createInputFlags() {
  return {
    thrustMain: false,
    rotateLeft: false,
    rotateRight: false,
    rcsPulse: null, // {dx, dy}
  };
}

export function setupDesktopInput(flags) {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') flags.thrustMain = true;
    if (e.key === 'ArrowLeft') flags.rotateLeft = true;
    if (e.key === 'ArrowRight') flags.rotateRight = true;
    if (e.key === ' ') {
      flags.brake = true;
      e.preventDefault();
    }
    // WASD for RCS
    if (e.key === 'w') queueRcs(flags, 0, -1);
    if (e.key === 's') queueRcs(flags, 0, 1);
    if (e.key === 'a') queueRcs(flags, -1, 0);
    if (e.key === 'd') queueRcs(flags, 1, 0);
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') flags.thrustMain = false;
    if (e.key === 'ArrowLeft') flags.rotateLeft = false;
    if (e.key === 'ArrowRight') flags.rotateRight = false;
  });
}

function queueRcs(flags, dx, dy) {
  flags.rcsPulse = { dx, dy };
  setTimeout(() => {
    flags.rcsPulse = null;
  }, RCS_PULSE_MS + 10);
}
