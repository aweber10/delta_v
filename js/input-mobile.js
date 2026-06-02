import { RCS_PULSE_MS, RCS_ZONE_RADIUS_PX, normalizeAngle } from './constants.js';
import { screenToWorld, worldToScreen } from './camera.js';

export function setupMobileInput(flags, canvas, cam, ship) {
  let activeTouchId = null;
  let touchStartTime = 0;
  let holdTimer = null;

  canvas.addEventListener('touchstart', (ev) => {
    ev.preventDefault();
    const touch = ev.changedTouches[0];
    const point = getTouchPoint(canvas, touch);

    if (isInsideRcsZone(point, ship, cam, canvas)) {
      queueMobileRcsPulse(flags, point, ship, cam, canvas);
      return;
    }

    activeTouchId = touch.identifier;
    touchStartTime = performance.now();
    holdTimer = startTravelTouch(point, ship, cam, canvas, () => activeTouchId !== null);
  });

  canvas.addEventListener('touchend', handleTouchEnd);
  canvas.addEventListener('touchcancel', handleTouchEnd);

  function handleTouchEnd(ev) {
    for (let i = 0; i < ev.changedTouches.length; i++) {
      if (ev.changedTouches[i].identifier === activeTouchId) {
        finishTravelTouch(ship, touchStartTime, holdTimer);
        activeTouchId = null;
      }
    }
  }
}

function getTouchPoint(canvas, touch) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top,
  };
}

function isInsideRcsZone(point, ship, cam, canvas) {
  const shipScreen = worldToScreen(cam, ship.x, ship.y, canvas);
  return Math.hypot(point.x - shipScreen.x, point.y - shipScreen.y) <= RCS_ZONE_RADIUS_PX;
}

function queueMobileRcsPulse(flags, point, ship, cam, canvas) {
  const direction = getShipRelativeDirection(point, ship, cam, canvas);
  flags.rcsPulse = direction;
  flags.rcsFlash = { ...direction, time: performance.now() };
  setTimeout(() => (flags.rcsPulse = null), RCS_PULSE_MS + 10);
  setTimeout(() => (flags.rcsFlash = null), 200 + 10);
}

function startTravelTouch(point, ship, cam, canvas, isTouchActive) {
  ship.thrustHeld = false;
  ship.tapThrustTime = 0;
  ship.targetAngle = getTargetAngle(point, ship, cam, canvas);

  return setTimeout(() => {
    if (isTouchActive()) {
      ship.thrustHeld = true;
    }
  }, 150);
}

function finishTravelTouch(ship, touchStartTime, holdTimer) {
  const touchDuration = performance.now() - touchStartTime;
  clearTimeout(holdTimer);

  if (touchDuration < 150 && !ship.thrustHeld && isShipAligned(ship)) {
    ship.tapThrustTime = 300;
  }

  ship.thrustHeld = false;
}

function getTargetAngle(point, ship, cam, canvas) {
  const direction = getShipRelativeDirection(point, ship, cam, canvas);
  return Math.atan2(direction.dy, direction.dx);
}

function getShipRelativeDirection(point, ship, cam, canvas) {
  const world = screenToWorld(cam, point.x, point.y, canvas);
  const dx = world.x - ship.x;
  const dy = world.y - ship.y;
  const dist = Math.hypot(dx, dy);

  return {
    dx: dx / dist,
    dy: dy / dist,
  };
}

function isShipAligned(ship) {
  return Math.abs(normalizeAngle(ship.targetAngle - ship.angle)) < 0.05;
}
