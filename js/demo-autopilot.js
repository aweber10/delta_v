import {
  ORBIT_RADIAL_SPEED_OK,
  ORBIT_STATION_RADIUS,
  ORBIT_TANGENTIAL_SPEED_OK,
  ORBIT_TOLERANCE,
  PLANET_GRAVITY_STRENGTH,
  normalizeAngle,
} from './constants.js';
import { getPortPosition } from './station.js';

export const DEMO_PHASE_COPY = {
  transfer: 'Anflug zum Planeten. Der Autopilot zielt auf den linken Rand der Zielumlaufbahn.',
  circularize: 'Orbit einschwenken: Altitude, Radial und Tangent werden stabilisiert.',
  holdOrbit: 'Stabiler Orbit erreicht. Die Demo hält die Bahn kurz, bevor sie zur Station phast.',
  phaseToStation: 'Der Abstand zur Station wird jetzt über einen leicht versetzten Orbit verringert.',
  rendezvous: 'Finaler Anflug: Relativgeschwindigkeit zur Station abbauen und Dockingwinkel treffen.',
  complete: 'Demo abgeschlossen: stabiler Orbit, Phasing und Rendezvous demonstriert.',
};

export function updateDemoAutopilot({
  level,
  currentLevel,
  ship,
  flags,
  demoMode,
  setDemoPhase,
  updateDemoHud,
}) {
  if (level !== 6 || !currentLevel.planet) return;

  demoMode.phaseFrames += 1;
  flags.rcsPulse = null;
  ship.pendingBrakeImpulse = false;
  ship.thrustHeld = false;

  const planet = currentLevel.planet;
  const station = currentLevel.stationB;
  const metrics = getDemoOrbitMetrics(ship, planet, ORBIT_STATION_RADIUS);
  const stationAngle = Math.atan2(station.y - planet.y, station.x - planet.x);
  const phaseAngle = normalizeAngle(stationAngle - metrics.angle);
  const stationDist = Math.hypot(ship.x - station.x, ship.y - station.y);

  if (demoMode.phase === 'transfer') {
    demoMode.message = DEMO_PHASE_COPY.transfer;
    flyDemoTransfer(ship, flags, metrics, planet);
    if (metrics.radius < ORBIT_STATION_RADIUS + 150) {
      setDemoPhase('circularize');
    }
  } else if (demoMode.phase === 'circularize') {
    demoMode.message = DEMO_PHASE_COPY.circularize;
    flyDemoOrbit(ship, flags, metrics, ORBIT_STATION_RADIUS);
    if (isDemoOrbitStable(metrics, ORBIT_STATION_RADIUS)) {
      demoMode.stableOrbitFrames += 1;
    } else {
      demoMode.stableOrbitFrames = 0;
    }
    if (demoMode.stableOrbitFrames > 120) {
      setDemoPhase('holdOrbit');
    }
  } else if (demoMode.phase === 'holdOrbit') {
    demoMode.message = DEMO_PHASE_COPY.holdOrbit;
    flyDemoOrbit(ship, flags, metrics, ORBIT_STATION_RADIUS);
    if (demoMode.phaseFrames > 180) {
      setDemoPhase('phaseToStation');
    }
  } else if (demoMode.phase === 'phaseToStation') {
    demoMode.message = DEMO_PHASE_COPY.phaseToStation;
    const phaseRadius = phaseAngle > 0 ? ORBIT_STATION_RADIUS - 125 : ORBIT_STATION_RADIUS + 105;
    flyDemoOrbit(ship, flags, metrics, phaseRadius);
    if ((Math.abs(phaseAngle) < 0.55 && stationDist < 420) || stationDist < 220) {
      setDemoPhase('rendezvous');
    }
  } else if (demoMode.phase === 'rendezvous') {
    demoMode.message = DEMO_PHASE_COPY.rendezvous;
    flyDemoRendezvous(ship, flags, currentLevel, station);
  } else {
    flags.thrustMain = false;
  }

  updateDemoHud();
}

function getDemoOrbitMetrics(sourceShip, planet, targetRadius) {
  const dx = sourceShip.x - planet.x;
  const dy = sourceShip.y - planet.y;
  const radius = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / radius;
  const uy = dy / radius;
  const progradeX = -uy;
  const progradeY = ux;
  const radialSpeed = sourceShip.vx * ux + sourceShip.vy * uy;
  const tangentialSpeed = sourceShip.vx * progradeX + sourceShip.vy * progradeY;
  const targetSpeed = Math.sqrt(PLANET_GRAVITY_STRENGTH / targetRadius);

  return {
    dx,
    dy,
    radius,
    ux,
    uy,
    progradeX,
    progradeY,
    radialSpeed,
    tangentialSpeed,
    targetSpeed,
    angle: Math.atan2(dy, dx),
  };
}

function flyDemoTransfer(ship, flags, metrics, planet) {
  const insertionAngle = Math.PI;
  const insertionRadius = ORBIT_STATION_RADIUS + 20;
  const target = {
    x: planet.x + Math.cos(insertionAngle) * insertionRadius,
    y: planet.y + Math.sin(insertionAngle) * insertionRadius,
  };
  const toX = target.x - ship.x;
  const toY = target.y - ship.y;
  const dist = Math.max(1, Math.hypot(toX, toY));
  const approachSpeed = Math.min(4.2, Math.max(0.55, dist / 90));
  const blend = demoClamp((900 - dist) / 700, 0, 1);
  const progradeX = 0;
  const progradeY = -1;
  const desiredVx = (toX / dist) * approachSpeed * (1 - blend) + progradeX * metrics.targetSpeed * blend;
  const desiredVy = (toY / dist) * approachSpeed * (1 - blend) + progradeY * metrics.targetSpeed * blend;
  steerDemoToVelocity(ship, flags, desiredVx, desiredVy, 0.075);
}

function flyDemoOrbit(ship, flags, metrics, targetRadius) {
  const targetSpeed = Math.sqrt(PLANET_GRAVITY_STRENGTH / targetRadius);
  const radiusError = metrics.radius - targetRadius;
  const radialTarget = demoClamp(-radiusError * 0.008, -0.65, 0.65);
  const tangentTarget = targetSpeed + demoClamp(-radiusError * 0.0008, -0.08, 0.08);
  const desiredVx = metrics.progradeX * tangentTarget + metrics.ux * radialTarget;
  const desiredVy = metrics.progradeY * tangentTarget + metrics.uy * radialTarget;
  steerDemoToVelocity(ship, flags, desiredVx, desiredVy, 0.058);
}

function flyDemoRendezvous(ship, flags, currentLevel, station) {
  const port = getPortPosition(station);
  const dx = port.x - ship.x;
  const dy = port.y - ship.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const metrics = getDemoOrbitMetrics(ship, currentLevel.planet, ORBIT_STATION_RADIUS);
  const radiusError = metrics.radius - ORBIT_STATION_RADIUS;
  const approachSpeed = Math.min(0.14, dist / 240);
  const radialGuard = metrics.radius < ORBIT_STATION_RADIUS - 48
    ? 0.42
    : demoClamp(-radiusError * 0.018, -0.22, 0.38);

  if (metrics.radius < ORBIT_STATION_RADIUS - 70) {
    const safeSpeed = Math.sqrt(PLANET_GRAVITY_STRENGTH / ORBIT_STATION_RADIUS);
    steerDemoToVelocity(
      ship,
      flags,
      metrics.progradeX * safeSpeed + metrics.ux * 0.46,
      metrics.progradeY * safeSpeed + metrics.uy * 0.46,
      0.06
    );
    return;
  }

  const desiredVx = station.vx + (dx / dist) * approachSpeed + metrics.ux * radialGuard;
  const desiredVy = station.vy + (dy / dist) * approachSpeed + metrics.uy * radialGuard;
  const relSpeed = Math.hypot(ship.vx - station.vx, ship.vy - station.vy);

  if (dist < 140 && relSpeed < 0.75 && Math.abs(radiusError) < 85) {
    ship.targetAngle = station.dockAngle + Math.PI;
    flags.thrustMain = false;
    applyDemoRcsToVelocity(ship, flags, desiredVx, desiredVy);
    return;
  }

  steerDemoToVelocity(ship, flags, desiredVx, desiredVy, 0.05);
}

function applyDemoRcsToVelocity(ship, flags, desiredVx, desiredVy) {
  const errX = desiredVx - ship.vx;
  const errY = desiredVy - ship.vy;
  const err = Math.hypot(errX, errY);
  if (err < 0.018) {
    flags.rcsPulse = null;
    return;
  }

  flags.rcsPulse = { dx: errX / err, dy: errY / err };
}

function steerDemoToVelocity(ship, flags, desiredVx, desiredVy, gain) {
  const ax = (desiredVx - ship.vx) * gain;
  const ay = (desiredVy - ship.vy) * gain;
  const accel = Math.hypot(ax, ay);
  if (accel < 0.008) {
    flags.thrustMain = false;
    return;
  }

  const targetAngle = Math.atan2(ay, ax);
  ship.targetAngle = targetAngle;
  const angleError = Math.abs(normalizeAngle(targetAngle - ship.angle));
  flags.thrustMain = angleError < 0.42;
}

function isDemoOrbitStable(metrics, targetRadius) {
  const targetSpeed = Math.sqrt(PLANET_GRAVITY_STRENGTH / targetRadius);
  return Math.abs(metrics.radius - targetRadius) < ORBIT_TOLERANCE
    && Math.abs(metrics.radialSpeed) < ORBIT_RADIAL_SPEED_OK
    && Math.abs(metrics.tangentialSpeed - targetSpeed) < ORBIT_TANGENTIAL_SPEED_OK;
}

function demoClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
