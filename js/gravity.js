import { G_STRENGTH, G_RADIUS, MIN_DIST_SQ } from './constants.js';

/**
 * Erzeugt eine Gravitationsquelle.
 */
export function createGravityWell(x, y, wellRadius, isBlackHole = false) {
  return { x, y, wellRadius, isBlackHole };
}

/**
 * Wendet die Gravitationskraft auf das Schiff an. Keine Objekte alloziert.
 * Unterstützt well-eigene gravityStrength/gravityRadius für individuelle Konfiguration (z.B. L5-Planet).
 */
export function applyGravity(ship, well, dt) {
  const dx = well.x - ship.x;
  const dy = well.y - ship.y;
  const distSq = dx * dx + dy * dy;

  // Eigene Werte bevorzugen (z.B. L5-Planet), sonst globale Konstanten
  const gStrength = well.gravityStrength !== undefined ? well.gravityStrength : G_STRENGTH;
  const gRadius = well.gravityRadius !== undefined ? well.gravityRadius : (well.isBlackHole ? G_RADIUS * 2 : G_RADIUS);

  if (distSq > gRadius * gRadius) return;

  const dist = Math.sqrt(distSq);
  const effectiveDist = Math.max(distSq, MIN_DIST_SQ);

  // Schwarze Löcher ziehen viel stärker an
  const strengthMult = well.isBlackHole ? 8 : 1;
  const force = (gStrength * strengthMult / effectiveDist) * dt;

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

  const gStrength = well.gravityStrength !== undefined ? well.gravityStrength : G_STRENGTH;
  const gRadius = well.gravityRadius !== undefined ? well.gravityRadius : (well.isBlackHole ? G_RADIUS * 2 : G_RADIUS);

  for (let i = 0; i < steps; i++) {
    const dx = well.x - px;
    const dy = well.y - py;
    const distSq = dx * dx + dy * dy;

    if (distSq <= well.wellRadius * well.wellRadius) {
      for (let j = i; j < steps; j++) { outX[j] = px; outY[j] = py; }
      return i;
    }

    if (distSq <= gRadius * gRadius) {
      const dist = Math.sqrt(distSq);
      const effectiveDist = Math.max(distSq, MIN_DIST_SQ);
      const strengthMult = well.isBlackHole ? 8 : 1;
      const force = (gStrength * strengthMult) / effectiveDist;
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
