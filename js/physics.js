import { THRUST_MAIN, THRUST_RCS, ROT_DAMP, ROT_ACCEL, FUEL_MAIN, FUEL_RCS, RCS_PULSE_MS, normalizeAngle } from './constants.js';
import { getPortPosition, checkDock } from './station.js';
import { applyGravity } from './gravity.js';

let lastRcsTime = 0;
const MAX_ANGULAR_VELOCITY = 0.15;
const BRAKE_ALIGNMENT_TOLERANCE = 0.005;
const BRAKE_ANGULAR_VELOCITY_TOLERANCE = 0.0001;
const ZERO_SPEED_EPSILON = 1e-9;

/**
 * @param {object} ship
 * @param {object} flags
 * @param {number} dt
 * @param {object|object[]|null} gravitySources - optionale Gravitationsquelle(n)
 */
export function updatePhysics(ship, flags, dt, gravitySources = null) {
  if (updateDockedShip(ship, dt)) return;

  updateRotation(ship, dt);
  applyPendingBrakeImpulse(ship, flags);
  applyMainThrust(ship, flags, dt);
  applyRcsImpulse(ship, flags);

  const wells = Array.isArray(gravitySources) ? gravitySources : (gravitySources ? [gravitySources] : []);
  for (const well of wells) {
    applyGravity(ship, well, dt);
  }

  integratePosition(ship, dt);
}

function updateDockedShip(ship, dt) {
  if (ship.dockedTimer <= 0) return false;

  ship.dockedTimer -= dt * 16.6667;

  if (ship.dockedStation) {
    // Orbiting station: Schiff wird aktiv zur aktuellen Port-Position der Station geführt
    // und übernimmt die Stationsgeschwindigkeit (für korrekten Abflug nach Undock)
    const s = ship.dockedStation;
    const port = getPortPosition(s);
    ship.x = port.x;
    ship.y = port.y;
    ship.vx = s.vx;
    ship.vy = s.vy;
    ship.angle = s.dockAngle + Math.PI;
    ship.targetAngle = ship.angle;
  } else {
    ship.vx = 0;
    ship.vy = 0;
  }

  ship.angularVel = 0;
  ship.pendingBrakeImpulse = false;
  return true;
}

function updateRotation(ship, dt) {
  ship.targetAngle = normalizeAngle(ship.targetAngle);
  const angleDiff = normalizeAngle(ship.targetAngle - ship.angle);
  const acc = getRotationAcceleration(ship, angleDiff, dt);
  const nextAngularVel = ship.angularVel + acc;

  ship.angularVel = clamp(nextAngularVel, -MAX_ANGULAR_VELOCITY, MAX_ANGULAR_VELOCITY);
  ship.angle = normalizeAngle(ship.angle + ship.angularVel * dt);
  snapAlignedShip(ship, angleDiff);
}

function getRotationAcceleration(ship, angleDiff, dt) {
  const absAngleDiff = Math.abs(angleDiff);
  const direction = angleDiff > 0 ? 1 : -1;
  const maxAcc = ROT_ACCEL * dt;
  let acc = 0;

  if (absAngleDiff > 0.2) {
    acc = direction * maxAcc;
  } else if (absAngleDiff > 0.05) {
    acc = direction * maxAcc * 0.5;
  } else if (absAngleDiff > 0.01) {
    acc = direction * maxAcc * 0.2;
  }

  return acc - ship.angularVel * ROT_DAMP * 0.3;
}

function snapAlignedShip(ship, angleDiff) {
  const absAngleDiff = Math.abs(angleDiff);
  if (absAngleDiff >= 0.05 || Math.abs(ship.angularVel) >= 0.02) return;
  if (absAngleDiff >= 0.005) return;

  ship.angle = ship.targetAngle;
  ship.angularVel = 0;
}

function applyMainThrust(ship, flags, dt) {
  if (!consumeTapThrust(ship, dt) && !flags.thrustMain && !ship.thrustHeld) return;
  if (ship.fuel <= 0) return;

  const ax = Math.cos(ship.angle) * THRUST_MAIN * dt;
  const ay = Math.sin(ship.angle) * THRUST_MAIN * dt;
  ship.vx += ax;
  ship.vy += ay;
  ship.fuel = Math.max(0, ship.fuel - FUEL_MAIN * dt);
}

function applyPendingBrakeImpulse(ship, flags) {
  if (!ship.pendingBrakeImpulse) return;
  if (!isBrakeImpulseAligned(ship)) return;

  ship.pendingBrakeImpulse = false;
  if (ship.fuel <= 0) return;

  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed <= ZERO_SPEED_EPSILON) {
    ship.vx = 0;
    ship.vy = 0;
    return;
  }

  const dx = Math.cos(ship.angle);
  const dy = Math.sin(ship.angle);
  ship.vx += dx * speed;
  ship.vy += dy * speed;

  if (Math.hypot(ship.vx, ship.vy) <= ZERO_SPEED_EPSILON) {
    ship.vx = 0;
    ship.vy = 0;
  }

  ship.fuel = Math.max(0, ship.fuel - FUEL_RCS);
  flags.rcsFlash = { dx, dy, time: performance.now() };
  setTimeout(() => {
    if (flags.rcsFlash && flags.rcsFlash.dx === dx && flags.rcsFlash.dy === dy) {
      flags.rcsFlash = null;
    }
  }, 200 + 10);
}

function isBrakeImpulseAligned(ship) {
  const angleDiff = Math.abs(normalizeAngle(ship.targetAngle - ship.angle));
  return angleDiff <= BRAKE_ALIGNMENT_TOLERANCE
    && Math.abs(ship.angularVel) <= BRAKE_ANGULAR_VELOCITY_TOLERANCE;
}

function consumeTapThrust(ship, dt) {
  if (ship.tapThrustTime <= 0) return false;

  ship.tapThrustTime -= dt * 16.6667;
  return true;
}

function applyRcsImpulse(ship, flags) {
  const now = performance.now();
  if (!flags.rcsPulse || ship.fuel <= 0) return;
  if (now - lastRcsTime <= RCS_PULSE_MS) return;

  ship.vx += flags.rcsPulse.dx * THRUST_RCS;
  ship.vy += flags.rcsPulse.dy * THRUST_RCS;
  ship.fuel = Math.max(0, ship.fuel - FUEL_RCS);
  lastRcsTime = now;
}

function integratePosition(ship, dt) {
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
