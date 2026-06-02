import { THRUST_MAIN, THRUST_RCS, ROT_DAMP, ROT_ACCEL, FUEL_MAIN, FUEL_RCS, RCS_PULSE_MS, WORLD_WIDTH, WORLD_HEIGHT, normalizeAngle } from './constants.js';
import { applyGravity } from './gravity.js';

let lastRcsTime = 0;

/**
 * @param {object} ship
 * @param {object} flags
 * @param {number} dt
 * @param {object|null} gravityWell - optionale Gravitationsquelle (Level 2+)
 */
export function updatePhysics(ship, flags, dt, gravityWell = null) {
  if (ship.dockedTimer > 0) {
    ship.dockedTimer -= dt * 16.6667;
    ship.vx = 0;
    ship.vy = 0;
    ship.angularVel = 0;
    return;
  }

  // --- Rotation mit Bordcomputer-Logik (Auto-Stop) ---
  ship.targetAngle = normalizeAngle(ship.targetAngle);
  const angleDiff = normalizeAngle(ship.targetAngle - ship.angle);
  const absAngleDiff = Math.abs(angleDiff);
  const direction = angleDiff > 0 ? 1 : -1;

  let acc = 0;
  const MAX_ACC = ROT_ACCEL * dt;
  
  if (absAngleDiff > 0.2) {
    acc = direction * MAX_ACC;
  } else if (absAngleDiff > 0.05) {
    acc = direction * MAX_ACC * 0.5;
  } else if (absAngleDiff > 0.01) {
    acc = direction * MAX_ACC * 0.2;
  }

  acc -= ship.angularVel * ROT_DAMP * 0.3; 

  const MAX_VEL_MAG = 0.15;
  const nextAngularVel = ship.angularVel + acc;
  ship.angularVel = Math.max(-MAX_VEL_MAG, Math.min(MAX_VEL_MAG, nextAngularVel));

  ship.angle += ship.angularVel * dt;
  ship.angle = normalizeAngle(ship.angle);

  let isAligned = false;
  if (absAngleDiff < 0.05 && Math.abs(ship.angularVel) < 0.02) {
    if (absAngleDiff < 0.005) {
        ship.angle = ship.targetAngle;
        ship.angularVel = 0;
    }
    isAligned = true;
  }

  // --- Schub-Logik ---
  let activeThrust = flags.thrustMain;

  if (ship.thrustHeld) {
    activeThrust = true;
  }
  
  if (ship.tapThrustTime > 0) {
    activeThrust = true;
    ship.tapThrustTime -= dt * 16.6667;
  }

  if (activeThrust && ship.fuel > 0) {
    const ax = Math.cos(ship.angle) * THRUST_MAIN * dt;
    const ay = Math.sin(ship.angle) * THRUST_MAIN * dt;
    ship.vx += ax;
    ship.vy += ay;
    ship.fuel = Math.max(0, ship.fuel - FUEL_MAIN * dt);
  }

  // RCS impulse handling
  const now = performance.now();
  if (flags.rcsPulse && ship.fuel > 0) {
    if (now - lastRcsTime > RCS_PULSE_MS) {
      ship.vx += flags.rcsPulse.dx * THRUST_RCS;
      ship.vy += flags.rcsPulse.dy * THRUST_RCS;
      ship.fuel = Math.max(0, ship.fuel - FUEL_RCS);
      lastRcsTime = now;
    }
  }

  // --- Gravitation (optional, Level 2+) ---
  if (gravityWell) {
    applyGravity(ship, gravityWell, dt);
  }

  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
}
