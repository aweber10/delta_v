import { RCS_PULSE_MS, RCS_ZONE_RADIUS_PX, normalizeAngle } from './constants.js';
import { screenToWorld, worldToScreen } from './camera.js';

const TAP_MAX_MS = 150;
const DOUBLE_TAP_MAX_MS = 320;
const DOUBLE_TAP_MAX_DISTANCE_PX = 42;

export function setupMobileInput(flags, canvas, cam, ship) {
  let activeTouchId = null;
  let touchStartTime = 0;
  let touchStartPoint = null;
  let holdTimer = null;
  let lastTravelTap = null;

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
    touchStartPoint = point;
    holdTimer = startTravelTouch(point, ship, cam, canvas, () => activeTouchId !== null);
  });

  canvas.addEventListener('touchend', handleTouchEnd);
  canvas.addEventListener('touchcancel', handleTouchEnd);

  function handleTouchEnd(ev) {
    for (let i = 0; i < ev.changedTouches.length; i++) {
      if (ev.changedTouches[i].identifier === activeTouchId) {
        lastTravelTap = finishTravelTouch(ship, touchStartTime, touchStartPoint, holdTimer, lastTravelTap);
        activeTouchId = null;
        touchStartPoint = null;
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
  // Tap-Richtung ist die gewünschte Impulsrichtung des Schiffs.
  const direction = getShipRelativeDirection(point, ship, cam, canvas);
  flags.rcsPulse = direction;
  flags.rcsFlash = { ...direction, time: performance.now() };
  setTimeout(() => (flags.rcsPulse = null), RCS_PULSE_MS + 10);
  setTimeout(() => (flags.rcsFlash = null), 200 + 10);
}

function startTravelTouch(point, ship, cam, canvas, isTouchActive) {
  ship.thrustHeld = false;
  ship.tapThrustTime = 0;
  ship.pendingBrakeImpulse = false;
  ship.targetAngle = getTargetAngle(point, ship, cam, canvas);

  return setTimeout(() => {
    if (isTouchActive()) {
      ship.thrustHeld = true;
    }
  }, TAP_MAX_MS);
}

function finishTravelTouch(ship, touchStartTime, touchStartPoint, holdTimer, lastTravelTap) {
  const now = performance.now();
  const touchDuration = now - touchStartTime;
  clearTimeout(holdTimer);

  if (touchDuration < TAP_MAX_MS && !ship.thrustHeld && touchStartPoint) {
    if (isDoubleTravelTap(touchStartPoint, now, lastTravelTap)) {
      ship.tapThrustTime = 0;
      ship.pendingBrakeImpulse = true;
      lastTravelTap = null;
    } else {
      if (isShipAligned(ship)) {
        ship.tapThrustTime = 300;
      }
      lastTravelTap = { x: touchStartPoint.x, y: touchStartPoint.y, time: now };
    }
  }

  ship.thrustHeld = false;
  return lastTravelTap;
}

function isDoubleTravelTap(point, now, lastTravelTap) {
  if (!lastTravelTap) return false;
  if (now - lastTravelTap.time > DOUBLE_TAP_MAX_MS) return false;

  const distance = Math.hypot(point.x - lastTravelTap.x, point.y - lastTravelTap.y);
  return distance <= DOUBLE_TAP_MAX_DISTANCE_PX;
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
  if (dist < 0.0001) {
    return {
      dx: Math.cos(ship.angle),
      dy: Math.sin(ship.angle),
    };
  }

  return {
    dx: dx / dist,
    dy: dy / dist,
  };
}

function isShipAligned(ship) {
  return Math.abs(normalizeAngle(ship.targetAngle - ship.angle)) < 0.05;
}
