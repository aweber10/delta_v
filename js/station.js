import { DOCK_RADIUS, ANGLE_DOCK_TOL, V_DOCK_MAX, ARM_LENGTH, normalizeAngle } from './constants.js';

export function createStation(x, y, dockAngle = 0) {
  return {
    x,
    y,
    dockAngle,
    loading: false,
    docked: false,
    orbiting: false,
  };
}

/**
 * Erstellt eine kreisende Raumstation auf einer Umlaufbahn.
 * @param {number} cx - Mittelpunkt X (Planetenzentrum)
 * @param {number} cy - Mittelpunkt Y (Planetenzentrum)
 * @param {number} orbitRadius - Abstand vom Planetenzentrum
 * @param {number} orbitSpeed - rad/frame (Winkelgeschwindigkeit)
 * @param {number} startAngle - Startwinkel in Radiant
 */
export function createOrbitingStation(cx, cy, orbitRadius, orbitSpeed, startAngle = 0) {
  const angle = startAngle;
  return {
    cx,
    cy,
    orbitRadius,
    orbitSpeed,
    initialOrbitAngle: angle,
    orbitAngle: angle,
    x: cx + Math.cos(angle) * orbitRadius,
    y: cy + Math.sin(angle) * orbitRadius,
    // Docking-Arm sitzt seitlich am Orbit und zeigt tangential zur Flugbahn.
    dockAngle: angle + Math.PI / 2,
    loading: false,
    docked: false,
    orbiting: true,
    // Geschwindigkeit der Station (für Relativgeschwindigkeit beim Docking)
    vx: 0,
    vy: 0,
  };
}

/**
 * Aktualisiert Position und Geschwindigkeit der kreisenden Station.
 * Muss jeden Physik-Frame aufgerufen werden.
 */
export function updateOrbitingStation(station, dt) {
  const prevAngle = station.orbitAngle;
  station.orbitAngle += station.orbitSpeed * dt;

  const newX = station.cx + Math.cos(station.orbitAngle) * station.orbitRadius;
  const newY = station.cy + Math.sin(station.orbitAngle) * station.orbitRadius;

  // Geschwindigkeit aus Positionsdifferenz (für Relativgeschwindigkeit beim Docking)
  station.vx = newX - station.x;
  station.vy = newY - station.y;

  station.x = newX;
  station.y = newY;

  // Docking-Arm bleibt seitlich am Orbit, tangential zur Flugbahn.
  station.dockAngle = station.orbitAngle + Math.PI / 2;
}

export function getPortPosition(station) {
  // Port is at the end of the arm, pointing opposite to dockAngle
  return {
    x: station.x + Math.cos(station.dockAngle) * ARM_LENGTH,
    y: station.y + Math.sin(station.dockAngle) * ARM_LENGTH
  };
}

export function checkDock(ship, station) {
  const port = getPortPosition(station);
  const dx = ship.x - port.x;
  const dy = ship.y - port.y;
  const dist = Math.hypot(dx, dy);

  // Für orbiting stations: Relativgeschwindigkeit zum Station
  let relVx = ship.vx;
  let relVy = ship.vy;
  if (station.orbiting) {
    relVx -= station.vx;
    relVy -= station.vy;
  }
  const speed = Math.hypot(relVx, relVy);

  // Ship must approach FROM the direction of the dock angle (opposite)
  const targetApproachAngle = station.dockAngle + Math.PI;
  const angleDiff = Math.abs(normalizeAngle(ship.angle - targetApproachAngle));

  const posOk = dist <= DOCK_RADIUS;
  const speedOk = speed < V_DOCK_MAX;
  const angleOk = angleDiff <= ANGLE_DOCK_TOL;

  return { posOk, speedOk, angleOk, dist, relSpeed: speed };
}

export function dockColor(check) {
  // Grün: alle 3 Bedingungen erfüllt
  if (check.posOk && check.speedOk && check.angleOk) return 'green';
  // Gelb: sobald Geschwindigkeit UND Winkel passen (Position egal)
  if (check.speedOk && check.angleOk) return 'yellow';
  // Alles andere: Rot
  return 'red';
}
