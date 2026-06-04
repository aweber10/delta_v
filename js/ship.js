import { FUEL_START } from './constants.js';

export function createShip(x = 300, y = 300) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVel: 0,
    fuel: FUEL_START,
    cargo: 0,
    dockedTimer: 0,
    targetAngle: 0, // Zielwinkel für die Ausrichtung
    thrustHeld: false, // Schub durch Halten
    tapThrustTime: 0, // Kurzer Impuls nach Tap wenn aligned
    pendingBrakeImpulse: false, // Einmaliger Komfortimpuls nach Doppel-Tap
  };
}
