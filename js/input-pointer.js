import { RCS_PULSE_MS, RCS_ZONE_RADIUS_PX, normalizeAngle } from './constants.js';
import { screenToWorld, worldToScreen } from './camera.js';

export const TAP_MAX_MS = 150;
export const DOUBLE_TAP_MAX_MS = 320;
export const DOUBLE_TAP_MAX_DISTANCE_PX = 42;

export function isInsideRcsZone(point, ship, cam, canvas) {
  const shipScreen = worldToScreen(cam, ship.x, ship.y, canvas);
  return Math.hypot(point.x - shipScreen.x, point.y - shipScreen.y) <= RCS_ZONE_RADIUS_PX;
}

export function queuePointerRcsPulse(flags, point, ship, cam, canvas) {
  const direction = getShipRelativeDirection(point, ship, cam, canvas);
  flags.rcsPulse = direction;
  flags.rcsFlash = { ...direction, time: performance.now() };
  setTimeout(() => (flags.rcsPulse = null), RCS_PULSE_MS + 10);
  setTimeout(() => (flags.rcsFlash = null), 200 + 10);
}

export function startTravelTap(point, ship, cam, canvas, isPointerActive) {
  ship.thrustHeld = false;
  ship.tapThrustTime = 0;
  ship.pendingBrakeImpulse = false;
  ship.targetAngle = getTargetAngle(point, ship, cam, canvas);

  return setTimeout(() => {
    if (isPointerActive()) {
      ship.thrustHeld = true;
    }
  }, TAP_MAX_MS);
}

export function finishTravelTap(ship, startTime, startPoint, holdTimer, lastTravelTap) {
  const now = performance.now();
  const duration = now - startTime;
  clearTimeout(holdTimer);

  if (duration < TAP_MAX_MS && !ship.thrustHeld && startPoint) {
    if (isDoubleTravelTap(startPoint, now, lastTravelTap)) {
      ship.tapThrustTime = 0;
      ship.pendingBrakeImpulse = true;
      lastTravelTap = null;
    } else {
      if (isShipAligned(ship)) {
        ship.tapThrustTime = 300;
      }
      lastTravelTap = { x: startPoint.x, y: startPoint.y, time: now };
    }
  }

  ship.thrustHeld = false;
  return lastTravelTap;
}

export function cancelTravelTap(ship, holdTimer) {
  clearTimeout(holdTimer);
  ship.thrustHeld = false;
}

export function getCanvasPoint(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
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
