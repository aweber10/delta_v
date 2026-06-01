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

  // --- Rotation mit Bordcomputer-Logik (Auto-Stop) ---
  // Zielwinkel setzen (wird im Input gesetzt, aber hier sicherheitshalber)
  ship.targetAngle = normalizeAngle(ship.targetAngle);

  // Angle-Difference: kürzester Weg zum Zielwinkel
  const angleDiff = normalizeAngle(ship.targetAngle - ship.angle);
  const absAngleDiff = Math.abs(angleDiff);
  const targetAngleRad = angleDiff;

  // Direction multiplier: +1 oder -1
  const direction = angleDiff > 0 ? 1 : -1;

  // Beschleunigen wenn weit vom Ziel entfernt
  let acc = 0;
  const MAX_ACC = ROT_ACCEL * dt;
  
  // Wenn Winkel-Differenz groß -> volle Beschleunigung
  if (absAngleDiff > 0.2) {
    acc = direction * MAX_ACC;
  } else if (absAngleDiff > 0.05) {
    // Bei mittlerer Nähe Geschwindigkeit reduzieren
    acc = direction * MAX_ACC * 0.5;
  } else if (absAngleDiff > 0.01) {
    // Bei sehr geringer Differenz nur noch minimal beschleunigen
    acc = direction * MAX_ACC * 0.2;
  } else {
    // Ziel fast erreicht: Keine Beschleunigung mehr
    acc = 0;
  }

  // Apply acceleration with gentle damping when close to target
  acc -= ship.angularVel * ROT_DAMP * 0.3; // leichte Bremse abhängig von Geschwindigkeit -> Auto-Stop

  const nextAngularVel = ship.angularVel + acc;
  
  // Prevent large velocity overshoots
  const MAX_VEL_MAG = 0.15; // limits angular velocity magnitude to prevent flipping
  ship.angularVel = Math.max(-MAX_VEL_MAG, Math.min(MAX_VEL_MAG, nextAngularVel));

  // Update ship angle (BEFORE setting to target)
  ship.angle += ship.angularVel * dt;
  ship.angle = normalizeAngle(ship.angle);

  // Final clamping: if extremely close align perfectly
  if (absAngleDiff < 0.005 && Math.abs(ship.angularVel) < 0.005) {
    ship.angle = ship.targetAngle;
    ship.angularVel = 0;
  }

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



  // Integrate velocity
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
}

function normalizeAngle(a) {
  a = (a + Math.PI * 2) % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  return a;
}
