import { THRUST_MAIN, THRUST_RCS, ROT_DAMP, ROT_ACCEL, FUEL_MAIN, FUEL_RCS, RCS_PULSE_MS, WORLD_WIDTH, WORLD_HEIGHT } from './constants.js';

let lastRcsTime = 0;

export function updatePhysics(ship, flags, dt) {
  if (ship.dockedTimer > 0) {
    ship.dockedTimer -= dt * 16.6667;
    // reset velocities while docked
    ship.vx = 0;
    ship.vy = 0;
    ship.angularVel = 0;
    return;
  }

  // Rotation input
  if (flags.rotateLeft) ship.angularVel -= ROT_ACCEL * dt;
  if (flags.rotateRight) ship.angularVel += ROT_ACCEL * dt;

  ship.angularVel *= ROT_DAMP;
  ship.angle += ship.angularVel * dt;

  // Main thrust
  if (flags.thrustMain && ship.fuel > 0) {
    const ax = Math.cos(ship.angle) * THRUST_MAIN * dt;
    const ay = Math.sin(ship.angle) * THRUST_MAIN * dt;
    ship.vx += ax;
    ship.vy += ay;
    ship.fuel = Math.max(0, ship.fuel - FUEL_MAIN * dt);
  }

  // RCS impulse handling (pulses)
  const now = performance.now();
  if (flags.rcsPulse && ship.fuel > 0) {
    // if a new pulse requested, apply impulse once and mark time
    if (now - lastRcsTime > RCS_PULSE_MS) {
      ship.vx += flags.rcsPulse.dx * THRUST_RCS;
      ship.vy += flags.rcsPulse.dy * THRUST_RCS;
      ship.fuel = Math.max(0, ship.fuel - FUEL_RCS);
      lastRcsTime = now;
    }
  }

  // Brake gesture: single impulse opposite to velocity
  if (flags.brake && (ship.vx !== 0 || ship.vy !== 0) && ship.fuel > 0) {
    const speed = Math.hypot(ship.vx, ship.vy) || 0.0001;
    const nx = -ship.vx / speed;
    const ny = -ship.vy / speed;
    ship.vx += nx * THRUST_RCS * 2; // slightly stronger
    ship.vy += ny * THRUST_RCS * 2;
    ship.fuel = Math.max(0, ship.fuel - FUEL_RCS);
    flags.brake = false; // single pulse
  }

  // Integrate velocity
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
}
