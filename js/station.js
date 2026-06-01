import { DOCK_RADIUS, ANGLE_DOCK_TOL, V_DOCK_MAX, ARM_LENGTH, normalizeAngle } from './constants.js';

export function createStation(x, y, dockAngle = 0) {
  return {
    x,
    y,
    dockAngle,
    loading: false,
    docked: false,
  };
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
  const speed = Math.hypot(ship.vx, ship.vy);
  
  // Ship must approach FROM the direction of the dock angle (opposite)
  const targetApproachAngle = station.dockAngle + Math.PI;
  const angleDiff = Math.abs(normalizeAngle(ship.angle - targetApproachAngle));

  const posOk = dist <= DOCK_RADIUS;
  const speedOk = speed < V_DOCK_MAX;
  const angleOk = angleDiff <= ANGLE_DOCK_TOL;

  return { posOk, speedOk, angleOk, dist };
}

export function dockColor(check) {
  // Grün: alle 3 Bedingungen erfüllt
  if (check.posOk && check.speedOk && check.angleOk) return 'green';
  // Gelb: sobald Geschwindigkeit UND Winkel passen (Position egal)
  if (check.speedOk && check.angleOk) return 'yellow';
  // Alles andere: Rot
  return 'red';
}


