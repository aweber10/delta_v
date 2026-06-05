import { RCS_PULSE_MS } from './constants.js';
import {
  cancelTravelTap,
  finishTravelTap,
  getCanvasPoint,
  isInsideRcsZone,
  queuePointerRcsPulse,
  startTravelTap,
} from './input-pointer.js';

export function createInputFlags() {
  return {
    thrustMain: false,
    rotateLeft: false,
    rotateRight: false,
    rcsPulse: null, // {dx, dy}
    rcsFlash: null, // {dx, dy, time}
  };
}

export function setupDesktopInput(flags, canvas, cam, ship) {
  let mouseActive = false;
  let mouseStartTime = 0;
  let mouseStartPoint = null;
  let holdTimer = null;
  let lastTravelTap = null;

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

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const point = getCanvasPoint(canvas, e.clientX, e.clientY);
    if (isInsideRcsZone(point, ship, cam, canvas)) {
      queuePointerRcsPulse(flags, point, ship, cam, canvas);
      return;
    }

    mouseActive = true;
    mouseStartTime = performance.now();
    mouseStartPoint = point;
    holdTimer = startTravelTap(point, ship, cam, canvas, () => mouseActive);
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button !== 0 || !mouseActive) return;
    lastTravelTap = finishTravelTap(ship, mouseStartTime, mouseStartPoint, holdTimer, lastTravelTap);
    mouseActive = false;
    mouseStartPoint = null;
  });

  canvas.addEventListener('mouseleave', () => {
    if (!mouseActive) return;
    cancelTravelTap(ship, holdTimer);
    mouseActive = false;
    mouseStartPoint = null;
  });

  window.addEventListener('blur', () => {
    if (!mouseActive) return;
    cancelTravelTap(ship, holdTimer);
    mouseActive = false;
    mouseStartPoint = null;
  });
}

function queueRcs(flags, ship, dx, dy) {
  flags.rcsPulse = { dx, dy };
  setTimeout(() => {
    flags.rcsPulse = null;
  }, RCS_PULSE_MS + 10);
}
