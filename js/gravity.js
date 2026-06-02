import { G_STRENGTH, G_RADIUS, MIN_DIST_SQ } from './constants.js';

/**
 * Erzeugt eine Gravitationsquelle.
 */
export function createGravityWell(x, y, wellRadius) {
  return { x, y, wellRadius };
}

/**
 * Wendet die Gravitationskraft auf das Schiff an. Keine Objekte alloziert.
 */
export function applyGravity(ship, well, dt) {
  const dx = well.x - ship.x;
  const dy = well.y - ship.y;
  const distSq = dx * dx + dy * dy;
  if (distSq > G_RADIUS * G_RADIUS) return;
  const dist = Math.sqrt(distSq);
  const effectiveDist = Math.max(distSq, MIN_DIST_SQ);
  const force = (G_STRENGTH / effectiveDist) * dt;
  ship.vx += force * (dx / dist);
  ship.vy += force * (dy / dist);
}

/**
 * Prüft Kollision mit dem Körper der Quelle.
 */
export function checkWellCollision(ship, well) {
  const dx = well.x - ship.x;
  const dy = well.y - ship.y;
  return (dx * dx + dy * dy) <= well.wellRadius * well.wellRadius;
}

/**
 * Berechnet vorausgesagte Flugbahn in vorab allozierte Arrays (kein GC).
 * Gibt Anzahl gültiger Schritte zurück.
 */
export function predictTrajectory(ship, well, steps, outX, outY) {
  let px = ship.x;
  let py = ship.y;
  let vx = ship.vx;
  let vy = ship.vy;

  for (let i = 0; i < steps; i++) {
    const dx = well.x - px;
    const dy = well.y - py;
    const distSq = dx * dx + dy * dy;

    if (distSq <= well.wellRadius * well.wellRadius) {
      for (let j = i; j < steps; j++) { outX[j] = px; outY[j] = py; }
      return i;
    }

    if (distSq <= G_RADIUS * G_RADIUS) {
      const dist = Math.sqrt(distSq);
      const effectiveDist = Math.max(distSq, MIN_DIST_SQ);
      const force = G_STRENGTH / effectiveDist;
      vx += force * (dx / dist);
      vy += force * (dy / dist);
    }

    px += vx;
    py += vy;
    outX[i] = px;
    outY[i] = py;
  }
  return steps;
}
