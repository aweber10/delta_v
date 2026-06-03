import {
  ASTEROID_BOUNCE_DAMPING,
  ASTEROID_BOUNCE_FUEL_PENALTY,
  ASTEROID_BOUNCE_MAX_SPEED,
  ASTEROID_COLLISION_PADDING,
} from './constants.js';

const TWO_PI = Math.PI * 2;

export function createAsteroid(x, y, radius, seed = 1) {
  return {
    x,
    y,
    radius,
    seed,
    shape: createAsteroidShape(seed),
  };
}

function createAsteroidShape(seed) {
  const points = [];
  const count = 11 + (seed % 5);
  let state = seed * 1664525 + 1013904223;

  for (let i = 0; i < count; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const jitter = (state / 0xffffffff) * 0.32 - 0.16;
    points.push({
      angle: (i / count) * TWO_PI,
      scale: 0.86 + jitter,
    });
  }

  return points;
}

export function checkAsteroidCollision(ship, asteroids) {
  for (const asteroid of asteroids) {
    if (isShipTouchingAsteroid(ship, asteroid)) return asteroid;
  }

  return null;
}

export function resolveAsteroidCollision(ship, asteroid) {
  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > ASTEROID_BOUNCE_MAX_SPEED) return 'crash';

  const nxRaw = ship.x - asteroid.x;
  const nyRaw = ship.y - asteroid.y;
  const dist = Math.max(0.0001, Math.hypot(nxRaw, nyRaw));
  const nx = nxRaw / dist;
  const ny = nyRaw / dist;
  const minDist = asteroid.radius + ASTEROID_COLLISION_PADDING;
  const overlap = minDist - dist;

  if (overlap > 0) {
    ship.x += nx * (overlap + 0.5);
    ship.y += ny * (overlap + 0.5);
  }

  const dot = ship.vx * nx + ship.vy * ny;
  if (dot < 0) {
    ship.vx = (ship.vx - 2 * dot * nx) * ASTEROID_BOUNCE_DAMPING;
    ship.vy = (ship.vy - 2 * dot * ny) * ASTEROID_BOUNCE_DAMPING;
  } else {
    ship.vx *= ASTEROID_BOUNCE_DAMPING;
    ship.vy *= ASTEROID_BOUNCE_DAMPING;
  }

  ship.fuel = Math.max(0, ship.fuel - ASTEROID_BOUNCE_FUEL_PENALTY);
  return 'bounce';
}

export function predictAsteroidTrajectory(ship, asteroids, steps, outX, outY) {
  let px = ship.x;
  let py = ship.y;
  const vx = ship.vx;
  const vy = ship.vy;

  for (let i = 0; i < steps; i++) {
    px += vx;
    py += vy;
    outX[i] = px;
    outY[i] = py;

    const hitAsteroid = getPointAsteroidHit(px, py, asteroids);
    if (hitAsteroid) {
      for (let j = i + 1; j < steps; j++) {
        outX[j] = px;
        outY[j] = py;
      }
      return { validSteps: i + 1, willHit: true, hitAsteroid };
    }
  }

  return { validSteps: steps, willHit: false, hitAsteroid: null };
}

function isShipTouchingAsteroid(ship, asteroid) {
  const dx = ship.x - asteroid.x;
  const dy = ship.y - asteroid.y;
  const r = asteroid.radius + ASTEROID_COLLISION_PADDING;
  return dx * dx + dy * dy <= r * r;
}

function getPointAsteroidHit(x, y, asteroids) {
  for (const asteroid of asteroids) {
    const dx = x - asteroid.x;
    const dy = y - asteroid.y;
    const r = asteroid.radius + ASTEROID_COLLISION_PADDING;
    if (dx * dx + dy * dy <= r * r) return asteroid;
  }

  return null;
}
