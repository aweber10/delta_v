import {
  finishTravelTap,
  getCanvasPoint,
  isInsideRcsZone,
  queuePointerRcsPulse,
  startTravelTap,
} from './input-pointer.js';

export function setupMobileInput(flags, canvas, cam, ship) {
  let activeTouchId = null;
  let touchStartTime = 0;
  let touchStartPoint = null;
  let holdTimer = null;
  let lastTravelTap = null;

  canvas.addEventListener('touchstart', (ev) => {
    ev.preventDefault();
    const touch = ev.changedTouches[0];
    const point = getCanvasPoint(canvas, touch.clientX, touch.clientY);

    if (isInsideRcsZone(point, ship, cam, canvas)) {
      queuePointerRcsPulse(flags, point, ship, cam, canvas);
      return;
    }

    activeTouchId = touch.identifier;
    touchStartTime = performance.now();
    touchStartPoint = point;
    holdTimer = startTravelTap(point, ship, cam, canvas, () => activeTouchId !== null);
  });

  canvas.addEventListener('touchend', handleTouchEnd);
  canvas.addEventListener('touchcancel', handleTouchEnd);

  function handleTouchEnd(ev) {
    for (let i = 0; i < ev.changedTouches.length; i++) {
      if (ev.changedTouches[i].identifier === activeTouchId) {
        lastTravelTap = finishTravelTap(ship, touchStartTime, touchStartPoint, holdTimer, lastTravelTap);
        activeTouchId = null;
        touchStartPoint = null;
      }
    }
  }
}
