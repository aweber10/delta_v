import {
  GRAVITY_EVENT_BODY,
  GRAVITY_EVENT_RADIUS,
  GRAVITY_EVENT_STRENGTH,
  L6_FUEL_START,
  L6_GRAVITY_RADIUS,
  L6_GRAVITY_STRENGTH,
  L6_MOON_GRAVITY_RADIUS,
  L6_MOON_GRAVITY_STRENGTH,
  L6_MOON_ORBIT_RADIUS,
  L6_MOON_ORBIT_SPEED,
  L6_MOON_RADIUS,
  L6_PLANET_RADIUS,
  L6_WELL_RADIUS,
  ORBIT_STATION_RADIUS,
  ORBIT_STATION_SPEED,
  PLANET_GRAVITY_RADIUS,
  PLANET_GRAVITY_STRENGTH,
  PLANET_RADIUS,
  PLANET_WELL_RADIUS,
  RELAY_FUEL_START,
} from './constants.js';
import { createAsteroid } from './asteroids.js';
import { createGravityWell } from './gravity.js';
import { createOrbitingStation, createStation } from './station.js';

export function createPlanet(x, y, radius) {
  return { x, y, radius, rotation: 0, cloudAngle: 0 };
}

export function createMoon(cx, cy, orbitRadius, radius, startAngle = 0.8) {
  return {
    cx,
    cy,
    orbitRadius,
    radius,
    angle: startAngle,
    x: cx + Math.cos(startAngle) * orbitRadius,
    y: cy + Math.sin(startAngle) * orbitRadius,
  };
}

export function updateOrbitingMoon(moon, dt) {
  moon.angle += L6_MOON_ORBIT_SPEED * dt;
  moon.x = moon.cx + Math.cos(moon.angle) * moon.orbitRadius;
  moon.y = moon.cy + Math.sin(moon.angle) * moon.orbitRadius;
}

const L1 = {
  shipStart: { x: 200, y: 200 },
  stationA: createStation(200, 1200, 0),
  stationB: createStation(1800, 300, Math.PI),
  well: null,
  asteroids: null,
};

const L_RELAY = {
  shipStart: { x: 120, y: 1160 },
  stationA: createStation(220, 1280, -Math.PI * 0.18),
  stationB: createStation(980, 960, Math.PI * 0.08),
  stationC: createStation(1780, 430, Math.PI + Math.PI * 0.22),
  well: null,
  asteroids: null,
  fuelStart: RELAY_FUEL_START,
  missionSequence: ['stationA', 'stationB', 'stationC'],
};

const L_GRAVITY_EVENT = {
  shipStart: { x: 220, y: 1400 },
  stationA: createStation(220, 1400, -Math.PI * 0.25),
  stationB: createStation(2180, 200, Math.PI + Math.PI * 0.25),
  well: createGravityWell(1200, 850, GRAVITY_EVENT_BODY, true),
  asteroids: null,
};
L_GRAVITY_EVENT.well.gravityStrength = GRAVITY_EVENT_STRENGTH;
L_GRAVITY_EVENT.well.gravityRadius = GRAVITY_EVENT_RADIUS;

const L3 = {
  shipStart: { x: 220, y: 1380 },
  stationA: createStation(220, 1380, -Math.PI * 0.22),
  stationB: createStation(2200, 220, Math.PI + Math.PI * 0.22),
  well: null,
  asteroids: [
    createAsteroid(500, 1260, 46, 101),
    createAsteroid(560, 940, 38, 102),
    createAsteroid(690, 1330, 58, 103),
    createAsteroid(780, 760, 52, 104),
    createAsteroid(880, 1160, 44, 105),
    createAsteroid(980, 560, 62, 106),
    createAsteroid(1040, 1240, 72, 107),
    createAsteroid(1120, 720, 36, 108),
    createAsteroid(1220, 1040, 64, 109),
    createAsteroid(1320, 460, 48, 110),
    createAsteroid(1380, 860, 42, 111),
    createAsteroid(1480, 1180, 70, 112),
    createAsteroid(1560, 600, 58, 113),
    createAsteroid(1660, 960, 44, 114),
    createAsteroid(1740, 380, 64, 115),
    createAsteroid(1840, 780, 52, 116),
    createAsteroid(1940, 520, 38, 117),
    createAsteroid(2020, 1020, 60, 118),
    createAsteroid(420, 720, 34, 119),
    createAsteroid(520, 520, 56, 120),
    createAsteroid(660, 380, 44, 121),
    createAsteroid(760, 220, 36, 122),
    createAsteroid(900, 1480, 42, 123),
    createAsteroid(1160, 1460, 54, 124),
    createAsteroid(1380, 1420, 46, 125),
    createAsteroid(1600, 1340, 58, 126),
    createAsteroid(1840, 1260, 40, 127),
    createAsteroid(2100, 1220, 62, 128),
    createAsteroid(300, 1040, 40, 129),
    createAsteroid(2220, 760, 44, 130),
    createAsteroid(2140, 520, 34, 131),
    createAsteroid(1260, 220, 54, 132),
    createAsteroid(1060, 300, 38, 133),
    createAsteroid(1460, 250, 32, 134),
    createAsteroid(640, 1120, 34, 135),
    createAsteroid(920, 880, 32, 136),
    createAsteroid(1540, 760, 34, 137),
    createAsteroid(1880, 620, 30, 138),
  ],
};

const L_DEBRIS = {
  shipStart: { x: 780, y: 1280 },
  stationA: createStation(200, 1500, -Math.PI * 0.17),
  stationB: createStation(1560, 700, Math.PI + Math.PI * 0.22),
  well: null,
  debrisField: true,
  asteroids: [
    createAsteroid(420, 1260, 42, 201),
    createAsteroid(500, 1150, 36, 202),
    createAsteroid(580, 1310, 52, 203),
    createAsteroid(480, 1050, 44, 204),
    createAsteroid(350, 1100, 38, 205),
    createAsteroid(320, 900, 34, 206),
    createAsteroid(430, 820, 48, 207),
    createAsteroid(550, 950, 40, 208),
    createAsteroid(370, 720, 56, 209),
    createAsteroid(650, 1180, 62, 210),
    createAsteroid(720, 1080, 44, 211),
    createAsteroid(660, 960, 50, 212),
    createAsteroid(750, 860, 38, 213),
    createAsteroid(820, 980, 58, 214),
    createAsteroid(900, 1160, 68, 215),
    createAsteroid(980, 1040, 42, 216),
    createAsteroid(1060, 1200, 54, 217),
    createAsteroid(1040, 880, 46, 218),
    createAsteroid(1150, 1060, 60, 219),
    createAsteroid(1240, 1180, 36, 220),
    createAsteroid(960, 720, 48, 221),
    createAsteroid(1100, 780, 40, 222),
    createAsteroid(1300, 980, 52, 223),
    createAsteroid(1380, 860, 44, 224),
    createAsteroid(1460, 1020, 64, 225),
    createAsteroid(1560, 900, 38, 226),
    createAsteroid(1320, 1180, 46, 227),
    createAsteroid(1500, 1140, 56, 228),
    createAsteroid(700, 580, 42, 229),
    createAsteroid(820, 460, 36, 230),
    createAsteroid(940, 560, 50, 231),
    createAsteroid(1060, 440, 44, 232),
    createAsteroid(1180, 540, 58, 233),
    createAsteroid(1300, 420, 34, 234),
    createAsteroid(1420, 520, 48, 235),
    createAsteroid(1540, 400, 40, 236),
    createAsteroid(1660, 500, 54, 237),
    createAsteroid(1780, 380, 36, 238),
    createAsteroid(1880, 540, 44, 239),
    createAsteroid(1960, 420, 52, 240),
    createAsteroid(2020, 320, 38, 241),
    createAsteroid(2100, 440, 46, 242),
    createAsteroid(1680, 760, 42, 243),
    createAsteroid(1800, 680, 34, 244),
    createAsteroid(1940, 780, 58, 245),
    createAsteroid(2060, 660, 40, 246),
    createAsteroid(2150, 560, 36, 247),
    createAsteroid(280, 1300, 32, 248),
    createAsteroid(600, 1430, 38, 249),
    createAsteroid(1640, 1240, 30, 250),
    createAsteroid(400, 230, 40, 251),
    createAsteroid(560, 200, 36, 252),
    createAsteroid(720, 250, 44, 253),
    createAsteroid(880, 210, 38, 254),
    createAsteroid(1040, 240, 48, 255),
    createAsteroid(1200, 200, 42, 256),
    createAsteroid(1360, 230, 36, 257),
    createAsteroid(1520, 210, 44, 258),
    createAsteroid(1700, 240, 40, 259),
    createAsteroid(1860, 200, 46, 260),
    createAsteroid(2080, 900, 42, 261),
    createAsteroid(2160, 1040, 38, 262),
    createAsteroid(2040, 1160, 50, 263),
    createAsteroid(2140, 1290, 44, 264),
    createAsteroid(2060, 1420, 40, 265),
    createAsteroid(800, 1410, 44, 266),
    createAsteroid(980, 1370, 38, 267),
    createAsteroid(1200, 1400, 48, 268),
    createAsteroid(1400, 1380, 42, 269),
    createAsteroid(1600, 1420, 36, 270),
    createAsteroid(1800, 1390, 46, 271),
    createAsteroid(1960, 1350, 40, 272),
    createAsteroid(330, 1000, 44, 273),
  ],
};

const L5_PLANET_X = 2600;
const L5_PLANET_Y = 1200;

const L5 = {
  shipStart: { x: 220, y: 1800 },
  stationA: createStation(220, 1800, -Math.PI * 0.25),
  stationB: createOrbitingStation(
    L5_PLANET_X,
    L5_PLANET_Y,
    ORBIT_STATION_RADIUS,
    ORBIT_STATION_SPEED,
    Math.PI * 1.25
  ),
  planet: createPlanet(L5_PLANET_X, L5_PLANET_Y, PLANET_RADIUS),
  well: createGravityWell(L5_PLANET_X, L5_PLANET_Y, PLANET_WELL_RADIUS, false),
  asteroids: null,
};
L5.well.gravityStrength = PLANET_GRAVITY_STRENGTH;
L5.well.gravityRadius = PLANET_GRAVITY_RADIUS;
L5.well.isPlanet = true;

const L6_PLANET_X = 2200;
const L6_PLANET_Y = 1400;

const L6 = {
  shipStart: { x: 300, y: 2500 },
  stationA: createStation(300, 2500, -Math.PI * 0.18),
  stationB: createStation(3900, 300, Math.PI + Math.PI * 0.18),
  planet: createPlanet(L6_PLANET_X, L6_PLANET_Y, L6_PLANET_RADIUS),
  moon: createMoon(L6_PLANET_X, L6_PLANET_Y, L6_MOON_ORBIT_RADIUS, L6_MOON_RADIUS),
  well: createGravityWell(L6_PLANET_X, L6_PLANET_Y, L6_WELL_RADIUS, false),
  moonWell: createGravityWell(0, 0, L6_MOON_RADIUS, false),
  asteroids: null,
  fuelStart: L6_FUEL_START,
};
L6.well.gravityStrength = L6_GRAVITY_STRENGTH;
L6.well.gravityRadius = L6_GRAVITY_RADIUS;
L6.well.isPlanet = true;
L6.well.isGasPlanet = true;
L6.moonWell.gravityStrength = L6_MOON_GRAVITY_STRENGTH;
L6.moonWell.gravityRadius = L6_MOON_GRAVITY_RADIUS;
L6.moonWell.isMoon = true;

L1.stations = [L1.stationA, L1.stationB];
L_RELAY.stations = [L_RELAY.stationA, L_RELAY.stationB, L_RELAY.stationC];
L3.stations = [L3.stationA, L3.stationB];
L_GRAVITY_EVENT.stations = [L_GRAVITY_EVENT.stationA, L_GRAVITY_EVENT.stationB];
L_DEBRIS.stations = [L_DEBRIS.stationA, L_DEBRIS.stationB];
L5.stations = [L5.stationA, L5.stationB];
L6.stations = [L6.stationA, L6.stationB];

export function getLevelByNumber(levelNum) {
  if (levelNum === 1) return L1;
  if (levelNum === 2) return L_RELAY;
  if (levelNum === 3) return L3;
  if (levelNum === 4) return L_GRAVITY_EVENT;
  if (levelNum === 5) return L_DEBRIS;
  if (levelNum === 6) return L6;
  if (levelNum === 7) return L5;
  throw new RangeError(`Unknown level number: ${levelNum}`);
}
