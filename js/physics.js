import { THRUST_MAIN, THRUST_RCS, ROT_DAMP, ROT_ACCEL, FUEL_MAIN, FUEL_RCS, RCS_PULSE_MS, normalizeAngle } from './constants.js';
import { applyGravity } from './gravity.js';

let lastRcsTime = 0;
const MAX_ANGULAR_VELOCITY = 0.15;

/**
 * @param {object} ship
 * @param {object} flags
 * @param {number} dt
 * @param {object|null} gravityWell - optionale Gravitationsquelle (Level 2+)
 */
export function updatePhysics(ship, flags, dt, gravityWell = null) {
  if (updateDockedShip(ship, dt)) return;

  updateRotation(ship, dt);
  applyMainThrust(ship, flags, dt);
  applyRcsImpulse(ship, flags);

  if (gravityWell) {
    applyGravity(ship, gravityWell, dt);
  }

  integratePosition(ship, dt);
}

function updateDockedShip(ship, dt) {
  if (ship.dockedTimer <= 0) return false;

  ship.dockedTimer -= dt * 16.6667;
  ship.vx = 0;
  ship.vy = 0;
  ship.angularVel = 0;
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
