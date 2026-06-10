import { createShip } from './ship.js';
import { createCamera, updateCamera } from './camera.js';
import { createInputFlags, setupDesktopInput } from './input-desktop.js';
import { setupMobileInput } from './input-mobile.js';
import { updatePhysics } from './physics.js';
import { createStation, createOrbitingStation, updateOrbitingStation, checkDock, dockColor, getPortPosition } from './station.js';
import * as renderer from './renderer.js';
import { FUEL_START, WELL_RADIUS, EVENT_HORIZON, PLANET_RADIUS, PLANET_GRAVITY_STRENGTH, PLANET_GRAVITY_RADIUS, PLANET_WELL_RADIUS, ORBIT_STATION_RADIUS, ORBIT_STATION_SPEED, ORBIT_TOLERANCE, ORBIT_RADIAL_SPEED_OK, ORBIT_TANGENTIAL_SPEED_OK, normalizeAngle, L6_FUEL_START, L6_PLANET_RADIUS, L6_GRAVITY_STRENGTH, L6_GRAVITY_RADIUS, L6_WELL_RADIUS, L6_MOON_RADIUS, L6_MOON_ORBIT_RADIUS, L6_MOON_ORBIT_SPEED } from './constants.js';
import { initAudio, isMuted, playDeliveryComplete, playDock, playStart, toggleMute } from './audio.js';
import { createTutorial, updateTutorial, drawTutorial, setTutorialNearStation, setTutorialStationVisible, setTutorialArrowTarget } from './tutorial.js';
import { createGravityWell, checkWellCollision, predictTrajectory } from './gravity.js';
import {
  checkAsteroidCollision,
  createAsteroid,
  predictAsteroidTrajectory,
  resolveAsteroidCollision,
} from './asteroids.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const levelCompleteScreen = document.getElementById('levelCompleteScreen');
const finalCompleteScreen = document.getElementById('finalCompleteScreen');
const startL1 = document.getElementById('startL1');
const startL2 = document.getElementById('startL2');
const startL3 = document.getElementById('startL3');
const startL4 = document.getElementById('startL4');
const demoL5Button = document.getElementById('demoL5Button');
const demoHud = document.getElementById('demoHud');
const demoPhase = document.getElementById('demoPhase');
const demoCopy = document.getElementById('demoCopy');
const demoExitButton = document.getElementById('demoExitButton');
const muteButton = document.getElementById('muteButton');
const backToMenuButton = document.getElementById('backToMenuButton');
const finalMenuButton = document.getElementById('finalMenuButton');
const finalReplayButton = document.getElementById('finalReplayButton');

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width === width && canvas.height === height) return;

  canvas.width = width;
  canvas.height = height;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

let resizeQueued = false;
function queueResize() {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    resize();
  });
}

window.addEventListener('resize', queueResize);
window.addEventListener('orientationchange', queueResize);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', queueResize);
}
resize();

// --- Level 1 ---
const L1 = {
  shipStart: { x: 200, y: 200 },
  stationA: createStation(200, 1200, 0),
  stationB: createStation(1800, 300, Math.PI),
  well: null,
  asteroids: null,
};

// --- Level 2: Gravity Well ---
// Layout: 2400 × 1600 world space
// Station A links unten, Station B rechts oben.
// Gravitationsquelle mittig, leicht nach unten versetzt → direkte Linie streift den Rand.
const L2 = {
  shipStart: { x: 220, y: 1400 },
  stationA: createStation(220, 1400, -Math.PI * 0.25),   // Arm zeigt nach oben-rechts
  stationB: createStation(2180, 200, Math.PI + Math.PI * 0.25), // Arm zeigt nach unten-links
  well: createGravityWell(1200, 900, WELL_RADIUS),
  asteroids: null,
};

// --- Level 3: Asteroid Field ---
// Statisches, handplatziertes Feld mit freiem diagonalen Korridor.
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

// --- Level 4: The Singularity ---
// Schwarzes Loch in der Mitte.
const L4 = {
  shipStart: { x: 220, y: 1400 },
  stationA: createStation(220, 1400, -Math.PI * 0.25),
  stationB: createStation(2180, 200, Math.PI + Math.PI * 0.25),
  well: createGravityWell(1200, 800, EVENT_HORIZON * 0.5, true),
  asteroids: null,
};

// --- Level 5: Debris Field ---
const L_DEBRIS = {
  shipStart: { x: 780, y: 1280 },
  stationA: createStation(780, 1280, -Math.PI * 0.22),
  stationB: createStation(1560, 700, Math.PI + Math.PI * 0.22),
  well: null,
  debrisField: true,
  asteroids: [
    // Unterer Eingangsbereich (dicht)
    createAsteroid(420, 1260, 42, 201),
    createAsteroid(500, 1150, 36, 202),
    createAsteroid(580, 1310, 52, 203),
    createAsteroid(480, 1050, 44, 204),
    createAsteroid(350, 1100, 38, 205),
    // Linke Flanke
    createAsteroid(320, 900, 34, 206),
    createAsteroid(430, 820, 48, 207),
    createAsteroid(550, 950, 40, 208),
    createAsteroid(370, 720, 56, 209),
    // Falsche Gasse (links-mitte) — enger Durchgang der in Sackgasse führt
    createAsteroid(650, 1180, 62, 210),
    createAsteroid(720, 1080, 44, 211),
    createAsteroid(660, 960, 50, 212),
    createAsteroid(750, 860, 38, 213),
    createAsteroid(820, 980, 58, 214),
    // Mittleres Cluster (Herzstück des Felds)
    createAsteroid(900, 1160, 68, 215),
    createAsteroid(980, 1040, 42, 216),
    createAsteroid(1060, 1200, 54, 217),
    createAsteroid(1040, 880, 46, 218),
    createAsteroid(1150, 1060, 60, 219),
    createAsteroid(1240, 1180, 36, 220),
    createAsteroid(960, 720, 48, 221),
    createAsteroid(1100, 780, 40, 222),
    // Rechte Mittelzone (Hauptkorridor verläuft oben drüber)
    createAsteroid(1300, 980, 52, 223),
    createAsteroid(1380, 860, 44, 224),
    createAsteroid(1460, 1020, 64, 225),
    createAsteroid(1560, 900, 38, 226),
    createAsteroid(1320, 1180, 46, 227),
    createAsteroid(1500, 1140, 56, 228),
    // Obere Zone (Hauptkorridor — schmale Lücken)
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
    // Oberer Ausgang (Eingang zu Station B)
    createAsteroid(1880, 540, 44, 239),
    createAsteroid(1960, 420, 52, 240),
    createAsteroid(2020, 320, 38, 241),
    createAsteroid(2100, 440, 46, 242),
    // Rechte untere Flanke
    createAsteroid(1680, 760, 42, 243),
    createAsteroid(1800, 680, 34, 244),
    createAsteroid(1940, 780, 58, 245),
    createAsteroid(2060, 660, 40, 246),
    createAsteroid(2150, 560, 36, 247),
    // Randstreuung
    createAsteroid(280,1300,32,248),
    createAsteroid(600,1430,38,249),
    createAsteroid(1640,1240,30,250),
    // --- Ergänzungen: Randverschlüsse (Option B) ---
    // Oberer Rand (Y≈200‑280)
    createAsteroid(400, 230, 40, 251),
    createAsteroid(560, 200, 36, 252),
    createAsteroid(720, 250, 44, 253),
    createAsteroid(880, 210, 38, 254),
    createAsteroid(1040,240, 48, 255),
    createAsteroid(1200,200, 42, 256),
    createAsteroid(1360,230, 36, 257),
    createAsteroid(1520,210, 44, 258),
    createAsteroid(1700,240, 40, 259),
    createAsteroid(1860,200, 46, 260),
    // Rechter Rand unten (X>1900, Y≈900‑1450)
    createAsteroid(2080, 900, 42, 261),
    createAsteroid(2160,1040, 38, 262),
    createAsteroid(2040,1160, 50, 263),
    createAsteroid(2140,1290, 44, 264),
    createAsteroid(2060,1420, 40, 265),
    // Unterer Rand (Y>1200, X≈800‑2000)
    createAsteroid( 800,1410, 44, 266),
    createAsteroid( 980,1370, 38, 267),
    createAsteroid(1200,1400, 48, 268),
    createAsteroid(1400,1380, 42, 269),
    createAsteroid(1600,1420, 36, 270),
    createAsteroid(1800,1390, 46, 271),
    createAsteroid(1960,1350, 40, 272),
    // Linker Rand Lücke (Y≈946‑1050)
    createAsteroid(330,1000,44,273),
  ],
};
L_DEBRIS.stations = [L_DEBRIS.stationA, L_DEBRIS.stationB];

// --- Level 6 (ehem. 5): Orbital Rendezvous ---
// Der Spieler startet bei Station A (bekannt), fliegt zum Planeten in der Bildmitte-rechts,
// und muss in einen Orbit einschwenken um an Station B (orbiting) anzudocken.
// Weltgröße: 3600 × 2400
const L5_PLANET_X = 2600;
const L5_PLANET_Y = 1200;

function createPlanet(x, y, radius) {
  return { x, y, radius, rotation: 0, cloudAngle: 0 };
}

const L5 = {
  shipStart: { x: 220, y: 1800 },
  stationA: createStation(220, 1800, -Math.PI * 0.25),
  stationB: createOrbitingStation(
    L5_PLANET_X, L5_PLANET_Y,
    ORBIT_STATION_RADIUS,
    ORBIT_STATION_SPEED,
    Math.PI * 1.25  // Startposition: oben-links vom Planeten
  ),
  planet: createPlanet(L5_PLANET_X, L5_PLANET_Y, PLANET_RADIUS),
  well: createGravityWell(L5_PLANET_X, L5_PLANET_Y, PLANET_WELL_RADIUS, false),
  asteroids: null,
};
// Überschreibe G_STRENGTH für L5 mit eigenen Werten über ein erweitertes well-Objekt
L5.well.gravityStrength = PLANET_GRAVITY_STRENGTH;
L5.well.gravityRadius = PLANET_GRAVITY_RADIUS;
L5.well.isPlanet = true;

L1.stations = [L1.stationA, L1.stationB];
L2.stations = [L2.stationA, L2.stationB];
L3.stations = [L3.stationA, L3.stationB];
L4.stations = [L4.stationA, L4.stationB];
L5.stations = [L5.stationA, L5.stationB];

// --- Level 7 (ehem. 6): Schwerkraftschleuder ---
// Slingshot-Manöver um einen Gasriesen (Jupiter-artig).
// Weltgröße: 4200 × 2800. Direktflug unmöglich (zu wenig Treibstoff).
// Optimaler Weg: nahe am Gasriesen vorbei (links/unterhalb) → Gravitation schleudert
// das Schiff nach rechts-oben zu Station B.
const L6_PLANET_X = 2200;
const L6_PLANET_Y = 1400;

/**
 * Erzeugt einen dekorativen Mond, der um eine Position kreist.
 * @param {number} cx - Zentrum X (Welt-Koordinaten)
 * @param {number} cy - Zentrum Y
 * @param {number} orbitRadius - Orbitabstand
 * @param {number} radius - Mondradius
 * @param {number} startAngle - Startwinkel (Bogenmaß)
 */
function createMoon(cx, cy, orbitRadius, radius, startAngle = 0.8) {
  return {
    cx, cy,         // Orbitzenrum
    orbitRadius,
    radius,
    angle: startAngle,
    x: cx + Math.cos(startAngle) * orbitRadius,
    y: cy + Math.sin(startAngle) * orbitRadius,
  };
}

/**
 * Aktualisiert die Mondposition anhand seines Orbitwinkels.
 */
function updateOrbitingMoon(moon, dt) {
  moon.angle += L6_MOON_ORBIT_SPEED * dt;
  moon.x = moon.cx + Math.cos(moon.angle) * moon.orbitRadius;
  moon.y = moon.cy + Math.sin(moon.angle) * moon.orbitRadius;
}

const L6 = {
  shipStart: { x: 300, y: 2500 },
  stationA: createStation(300, 2500, -Math.PI * 0.18),
  stationB: createStation(3900, 300, Math.PI + Math.PI * 0.18),
  planet: createPlanet(L6_PLANET_X, L6_PLANET_Y, L6_PLANET_RADIUS),
  moon: createMoon(L6_PLANET_X, L6_PLANET_Y, L6_MOON_ORBIT_RADIUS, L6_MOON_RADIUS),
  well: createGravityWell(L6_PLANET_X, L6_PLANET_Y, L6_WELL_RADIUS, false),
  asteroids: null,
  fuelStart: L6_FUEL_START,
};
L6.well.gravityStrength = L6_GRAVITY_STRENGTH;
L6.well.gravityRadius = L6_GRAVITY_RADIUS;
L6.well.isPlanet = true;
L6.well.isGasPlanet = true;  // Unterscheidet Gasriese von Erdplanet (für Renderer)
L6.stations = [L6.stationA, L6.stationB];

let currentLevel = L1;
const ship = createShip(currentLevel.shipStart.x, currentLevel.shipStart.y);
const cam = createCamera(ship.x, ship.y);
const flags = createInputFlags();
setupDesktopInput(flags, canvas, cam, ship);
setupMobileInput(flags, canvas, cam, ship);

let score = 0;
let targetStation = currentLevel.stationA;
let gameState = 'start';
let dockingApproach = null;
let level = 1;
const demoMode = {
  active: false,
  phase: 'idle',
  phaseFrames: 0,
  stableOrbitFrames: 0,
  startedAt: 0,
  message: '',
};

const DEMO_PHASE_COPY = {
  transfer: 'Anflug zum Planeten. Der Autopilot zielt auf den linken Rand der Zielumlaufbahn.',
  circularize: 'Orbit einschwenken: Altitude, Radial und Tangent werden stabilisiert.',
  holdOrbit: 'Stabiler Orbit erreicht. Die Demo hält die Bahn kurz, bevor sie zur Station phast.',
  phaseToStation: 'Der Abstand zur Station wird jetzt über einen leicht versetzten Orbit verringert.',
  rendezvous: 'Finaler Anflug: Relativgeschwindigkeit zur Station abbauen und Dockingwinkel treffen.',
  complete: 'Demo abgeschlossen: stabiler Orbit, Phasing und Rendezvous demonstriert.',
};
const tut = createTutorial();
let blackHoleResetTimer = null;
let blackHoleCollapseTimer = null;
let blackHoleCollapse = null;

const PROGRESS_KEY = 'delta_v_progress';
const TOTAL_LEVELS = 7;
const BLACK_HOLE_COLLAPSE_MS = 750;
const BLACK_HOLE_BLACKOUT_MS = 1000;

function loadProgress() {
  try {
    const data = localStorage.getItem(PROGRESS_KEY);
    if (data) return JSON.parse(data);
  } catch {}
  return { completedLevels: [], unlockedLevel: 1 };
}

function saveProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function isLevelUnlocked(levelNum) {
  return levelNum <= loadProgress().unlockedLevel;
}

function markLevelComplete(levelNum) {
  const progress = loadProgress();
  if (!progress.completedLevels.includes(levelNum)) {
    progress.completedLevels.push(levelNum);
  }
  if (levelNum < TOTAL_LEVELS) {
    progress.unlockedLevel = Math.max(progress.unlockedLevel, levelNum + 1);
  }
  saveProgress(progress);
}

// Vorab allozierte Trajectory-Buffer (kein GC im Hot-Path)
const TRAJ_STEPS = 120;
const trajX = new Float32Array(TRAJ_STEPS);
const trajY = new Float32Array(TRAJ_STEPS);
let trajValidSteps = 0;
let trajFrameCounter = 0;
let trajWillHitAsteroid = false;
let trajHitAsteroid = null;
const orbitAssist = {
  periapsis: null,
  apoapsis: null,
  burnHint: null,
  orbitOk: false,
};

// Event Horizon Pulse (für Animation)
let eventHorizonPulse = 0;
let isInDanger = false;

// Explosionspartikel
let particles = [];

function spawnExplosion(x, y) {
  const COUNT = 55;
  for (let i = 0; i < COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const type = Math.random();

    let speed, size, maxLife, color;
    if (type < 0.25) {
      // Heißer Kern: klein, weiß/gelb, schnell, kurze Lebenszeit
      speed = 2.5 + Math.random() * 3.5;
      size = 2 + Math.random() * 2;
      maxLife = 18 + Math.random() * 14;
      color = Math.random() < 0.5 ? '#ffffff' : '#ffee88';
    } else if (type < 0.65) {
      // Flammenpartikel: mittel, orange/rot
      speed = 1.2 + Math.random() * 2.5;
      size = 3 + Math.random() * 3.5;
      maxLife = 28 + Math.random() * 22;
      const colors = ['#ff8800', '#ff5500', '#ffaa00', '#ff3300'];
      color = colors[Math.floor(Math.random() * colors.length)];
    } else {
      // Trümmer: größer, dunkelrot/grau, langsam, länger
      speed = 0.4 + Math.random() * 1.4;
      size = 4 + Math.random() * 4;
      maxLife = 40 + Math.random() * 30;
      const colors = ['#aa2200', '#882200', '#664444', '#553333'];
      color = colors[Math.floor(Math.random() * colors.length)];
    }

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: maxLife,
      maxLife,
      size,
      color,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

// stars — verteilt über den gesamten möglichen Weltbereich (inkl. L5 mit 3600×2400)
const stars = [];
for (let i=0;i<320;i++) stars.push({ x: Math.random()*4200, y: Math.random()*2800 });

const FIXED_STEP_MS = 1000 / 60;
const MAX_FRAME_MS = 250;
const MAX_STEPS_PER_FRAME = 5;
let accumulator = 0;
let last = performance.now();

const prevShipState = { x: ship.x, y: ship.y, angle: ship.angle };
const currShipState = { x: ship.x, y: ship.y, angle: ship.angle };
const prevCamState = { x: cam.x, y: cam.y, zoom: cam.zoom };
const currCamState = { x: cam.x, y: cam.y, zoom: cam.zoom };
const renderShip = Object.create(ship);
const renderCam = Object.create(cam);

function startLevel(targetLevel) {
  stopDemo();
  selectLevel(targetLevel);
  score = 0;
  resetLevel();
  startScreen.hidden = true;
  levelCompleteScreen.hidden = true;
  finalCompleteScreen.hidden = true;
  beginGameplay();
}

function selectLevel(targetLevel) {
  level = targetLevel;
  if (targetLevel === 1) currentLevel = L1;
  else if (targetLevel === 2) currentLevel = L2;
  else if (targetLevel === 3) currentLevel = L3;
  else if (targetLevel === 4) currentLevel = L4;
  else if (targetLevel === 5) currentLevel = L_DEBRIS;  // Debris Field
  else if (targetLevel === 6) currentLevel = L6;        // Schwerkraftschleuder (Slingshot)
  else currentLevel = L5;                               // Orbital Rendezvous ist jetzt Level 7
}

async function beginGameplay() {
  gameState = 'playing';
  last = performance.now();
  accumulator = 0;
  syncRenderStates();

  try {
    if (await initAudio()) playStart();
  } catch {}
}

function updateLevelSelectUI() {
  document.querySelectorAll('.level-card').forEach(btn => {
    const lvl = parseInt(btn.dataset.level);
    const unlocked = isLevelUnlocked(lvl);
    btn.hidden = false;
    btn.disabled = !unlocked;
    btn.setAttribute('aria-disabled', String(!unlocked));
    btn.classList.toggle('level-card--locked', !unlocked);
  });
}

document.querySelectorAll('.level-card').forEach(btn => {
  btn.addEventListener('click', () => {
    const lvl = parseInt(btn.dataset.level);
    if (!isLevelUnlocked(lvl)) return;
    startLevel(lvl);
  });
});

if (demoL5Button) {
  demoL5Button.addEventListener('click', startDemoLevel5);
}

if (demoExitButton) {
  demoExitButton.addEventListener('click', stopDemoAndShowMenu);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && demoMode.active) {
    stopDemoAndShowMenu();
  }
});

muteButton.addEventListener('click', async () => {
  await initAudio();
  const muted = toggleMute();
  muteButton.textContent = muted ? 'Ton aus' : 'Ton an';
  muteButton.setAttribute('aria-pressed', String(muted));
});

backToMenuButton.addEventListener('click', () => {
  showMainMenu();
});

finalMenuButton.addEventListener('click', () => {
  showMainMenu();
});

finalReplayButton.addEventListener('click', () => {
  finalCompleteScreen.hidden = true;
  levelCompleteScreen.hidden = true;
  startScreen.hidden = true;
  selectLevel(TOTAL_LEVELS);
  score = 0;
  resetLevel();
  beginGameplay();
});

function showMainMenu() {
  stopDemo();
  levelCompleteScreen.hidden = true;
  finalCompleteScreen.hidden = true;
  startScreen.hidden = false;
  gameState = 'start';
  updateLevelSelectUI();
}

function startDemoLevel5() {
  selectLevel(7);
  score = 0;
  resetLevel();
  ship.cargo = 1;
  targetStation = currentLevel.stationB;
  demoMode.active = true;
  demoMode.phase = 'transfer';
  demoMode.phaseFrames = 0;
  demoMode.stableOrbitFrames = 0;
  demoMode.startedAt = performance.now();
  demoMode.message = DEMO_PHASE_COPY.transfer;
  startScreen.hidden = true;
  levelCompleteScreen.hidden = true;
  finalCompleteScreen.hidden = true;
  setDemoHud(true);
  beginGameplay();
}

function stopDemoAndShowMenu() {
  stopDemo();
  showMainMenu();
}

function stopDemo() {
  demoMode.active = false;
  demoMode.phase = 'idle';
  demoMode.phaseFrames = 0;
  demoMode.stableOrbitFrames = 0;
  demoMode.message = '';
  flags.thrustMain = false;
  flags.rcsPulse = null;
  ship.thrustHeld = false;
  ship.pendingBrakeImpulse = false;
  setDemoHud(false);
}

function setDemoHud(visible) {
  if (!demoHud) return;
  demoHud.hidden = !visible;
  if (visible) updateDemoHud();
}

function updateDemoHud() {
  if (!demoHud || !demoMode.active) return;
  if (demoPhase) demoPhase.textContent = getDemoPhaseTitle(demoMode.phase);
  if (demoCopy) demoCopy.textContent = demoMode.message || DEMO_PHASE_COPY[demoMode.phase] || '';
}

function getDemoPhaseTitle(phase) {
  if (phase === 'transfer') return 'Transfer zum Planeten';
  if (phase === 'circularize') return 'In Orbit einschwenken';
  if (phase === 'holdOrbit') return 'Orbit stabilisieren';
  if (phase === 'phaseToStation') return 'Abstand zur Station verringern';
  if (phase === 'rendezvous') return 'Rendezvous und Docking';
  if (phase === 'complete') return 'Demo abgeschlossen';
  return 'Demo-Modus';
}

updateLevelSelectUI();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

function getStations() {
  return currentLevel.stations;
}

function loop() {
  const now = performance.now();
  const frameMs = Math.min(MAX_FRAME_MS, now - last);
  last = now;
  accumulator += frameMs;

  let steps = 0;
  while (accumulator >= FIXED_STEP_MS && steps < MAX_STEPS_PER_FRAME) {
    captureShipState(prevShipState, ship);
    captureCamState(prevCamState, cam);

    updateGame(1, now);
    updateCamera(cam, ship, getStations());

    captureShipState(currShipState, ship);
    captureCamState(currCamState, cam);

    accumulator -= FIXED_STEP_MS;
    steps++;
  }

  if (steps === MAX_STEPS_PER_FRAME && accumulator >= FIXED_STEP_MS) {
    accumulator = 0;
    syncRenderStates();
  }

  renderFrame(accumulator / FIXED_STEP_MS);

  requestAnimationFrame(loop);
}

function syncRenderStates() {
  captureShipState(prevShipState, ship);
  captureShipState(currShipState, ship);
  captureCamState(prevCamState, cam);
  captureCamState(currCamState, cam);
}

function captureShipState(target, source) {
  target.x = source.x;
  target.y = source.y;
  target.angle = source.angle;
}

function captureCamState(target, source) {
  target.x = source.x;
  target.y = source.y;
  target.zoom = source.zoom;
}

function prepareRenderState(alpha) {
  renderShip.x = lerp(prevShipState.x, currShipState.x, alpha);
  renderShip.y = lerp(prevShipState.y, currShipState.y, alpha);
  renderShip.angle = interpolateAngle(prevShipState.angle, currShipState.angle, alpha);

  renderCam.x = lerp(prevCamState.x, currCamState.x, alpha);
  renderCam.y = lerp(prevCamState.y, currCamState.y, alpha);
  renderCam.zoom = lerp(prevCamState.zoom, currCamState.zoom, alpha);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function interpolateAngle(a, b, t) {
  let diff = b - a;
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function updateGame(dt, now) {
  updateParticles(dt);

  if (gameState === 'dockingApproach') {
    updateDockingApproach(dt);
    return;
  }

  if (gameState !== 'playing') return;

  if (demoMode.active) {
    updateDemoAutopilot(dt, now);
  }

  updatePhysics(ship, flags, dt, currentLevel.well);
  updateLevelSystems(dt, now);
  if (gameState !== 'playing') return;
  updateDocking();
}

function updateLevelSystems(dt, now) {
  if (level === 1) {
    updateTutorial(tut, ship, flags, dt);

    // Tutorial-Kontext: Stationsnähe, Sichtbarkeit und Pfeilziel aktualisieren
    const distA = Math.hypot(ship.x - currentLevel.stationA.x, ship.y - currentLevel.stationA.y);
    const distB = Math.hypot(ship.x - currentLevel.stationB.x, ship.y - currentLevel.stationB.y);
    setTutorialNearStation(tut, distA < 400 || distB < 400);

    // Station "in Sichtweite" = würde auf dem Bildschirm erscheinen (gleiche Logik wie drawTargetArrow)
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const tsDx = targetStation.x - ship.x;
    const tsDy = targetStation.y - ship.y;
    const tsScreenX = w / 2 + tsDx * cam.zoom;
    const tsScreenY = h / 2 + tsDy * cam.zoom;
    const stationOnScreen = tsScreenX > 40 && tsScreenX < w - 40 &&
                            tsScreenY > 40 && tsScreenY < h - 40;
    setTutorialStationVisible(tut, stationOnScreen);
    setTutorialArrowTarget(tut, targetStation);
  }

  if (currentLevel.well) {
    updateGravityHazards(now);
    updateGravityTrajectoryPrediction();
  }

  if (currentLevel.asteroids) {
    updateAsteroidHazards();
    updateAsteroidTrajectoryPrediction();
  }

  // Level 6: Mond animieren + Gasriese rotieren (Slingshot)
  if (level === 6) {
    updateOrbitingMoon(currentLevel.moon, dt);
    currentLevel.planet.rotation += 0.00008 * dt;
  }

  // Level 7: Orbiting Station bewegen + Planet rotieren (Orbital Rendezvous)
  if (level === 7) {
    updateOrbitingStation(currentLevel.stationB, dt);
    currentLevel.planet.rotation += 0.00012 * dt;
  }
}

function updateGravityHazards(now) {
  const well = currentLevel.well;
  if (checkWellCollision(ship, well)) {
    if (well.isBlackHole) {
      blackHoleCrashReset(now);
    } else {
      crashReset();
    }
    return;
  }

  const dist = Math.hypot(well.x - ship.x, well.y - ship.y);
  // Bei Planeten (L5) keine Gefahren-Vignette — der Planet ist das Ziel, nicht ein Hindernis
  if (!well.isPlanet) {
    const dangerLimit = well.isBlackHole ? EVENT_HORIZON * 1.5 : EVENT_HORIZON;
    isInDanger = dist < dangerLimit;
    if (isInDanger) {
      eventHorizonPulse = 0.5 + 0.5 * Math.sin(now / 150);
    }
  }
}

function blackHoleCrashReset(now) {
  if (gameState === 'blackHoleCollapse' || gameState === 'blackout') return;
  gameState = 'blackHoleCollapse';
  ship.pendingBrakeImpulse = false;
  ship.thrustHeld = false;
  ship.tapThrustTime = 0;
  isInDanger = false;
  trajValidSteps = 0;
  particles = [];

  blackHoleCollapse = {
    startTime: now,
    startX: ship.x,
    startY: ship.y,
    startAngle: ship.angle,
    targetX: currentLevel.well.x,
    targetY: currentLevel.well.y,
  };

  if (blackHoleCollapseTimer) clearTimeout(blackHoleCollapseTimer);
  blackHoleCollapseTimer = setTimeout(startBlackHoleBlackout, BLACK_HOLE_COLLAPSE_MS);
}

function startBlackHoleBlackout() {
  blackHoleCollapseTimer = null;
  blackHoleCollapse = null;
  gameState = 'blackout';

  if (blackHoleResetTimer) clearTimeout(blackHoleResetTimer);
  blackHoleResetTimer = setTimeout(() => {
    blackHoleResetTimer = null;
    resetLevel();
    gameState = 'playing';
    last = performance.now();
  }, BLACK_HOLE_BLACKOUT_MS);
}

function updateGravityTrajectoryPrediction() {
  trajFrameCounter++;
  if (trajFrameCounter < 2) return;

  trajFrameCounter = 0;
  trajValidSteps = predictTrajectory(ship, currentLevel.well, TRAJ_STEPS, trajX, trajY);
  updateOrbitAssist();
}

function updateAsteroidHazards() {
  if (ship.dockedTimer > 0) return;

  const asteroid = checkAsteroidCollision(ship, currentLevel.asteroids);
  if (!asteroid) return;

  const result = resolveAsteroidCollision(ship, asteroid);
  if (result === 'crash') {
    crashReset();
  }
}

function updateAsteroidTrajectoryPrediction() {
  trajFrameCounter++;
  if (trajFrameCounter < 2) return;

  trajFrameCounter = 0;
  const prediction = predictAsteroidTrajectory(ship, currentLevel.asteroids, TRAJ_STEPS, trajX, trajY);
  trajValidSteps = prediction.validSteps;
  trajWillHitAsteroid = prediction.willHit;
  trajHitAsteroid = prediction.hitAsteroid;
}

function updateDocking() {
  if (ship.dockedTimer > 0) return;

  const station = getDockableTargetStation();
  if (!station) return;

  // Starte weichen Andock-Anflug statt sofortigem Teleport
  dockingApproach = {
    station,
    timer: 0,
    duration: 25, // Physik-Ticks (~0.4s bei 60fps)
    startX: ship.x,
    startY: ship.y,
    startAngle: ship.angle
  };
  gameState = 'dockingApproach';
}

function updateDockingApproach(dt) {
  if (!dockingApproach) return;
  
  dockingApproach.timer += dt;
  const t = Math.min(1, dockingApproach.timer / dockingApproach.duration);
  const easedT = t * (2 - t); // Ease-out

  const station = dockingApproach.station;
  // Bei Orbit-Stationen bewegt sich der Port während des Anflugs weiter
  if (station.orbiting) {
    updateOrbitingStation(station, dt);
  }
  const port = getPortPosition(station);
  const targetAngle = normalizeAngle(station.dockAngle + Math.PI);

  ship.x = lerp(dockingApproach.startX, port.x, easedT);
  ship.y = lerp(dockingApproach.startY, port.y, easedT);
  ship.angle = interpolateAngle(dockingApproach.startAngle, targetAngle, easedT);
  ship.targetAngle = ship.angle;
  ship.vx = 0;
  ship.vy = 0;
  ship.angularVel = 0;

  if (t >= 1) {
    gameState = 'playing';
    const st = dockingApproach.station;
    dockingApproach = null;
    handleDocking(ship, st);
    targetStation = st === currentLevel.stationA ? currentLevel.stationB : currentLevel.stationA;
  }
}

function getDockableTargetStation() {
  const check = checkDock(ship, targetStation);
  return dockColor(check) === 'green' ? targetStation : null;
}

function renderFrame(alpha = 1) {
  prepareRenderState(alpha);

  if (gameState === 'blackout') {
    renderer.clear(ctx, canvas);
    return;
  }

  const well = currentLevel.well;
  const asteroids = currentLevel.asteroids;
  const stationA = currentLevel.stationA;
  const stationB = currentLevel.stationB;

  renderer.clear(ctx, canvas);
  renderer.drawStars(ctx, stars, renderCam, canvas);

  // Level 6: Gasriese + Mond zeichnen (Slingshot)
  if (level === 6 && currentLevel.planet) {
    renderer.drawGasPlanet(ctx, currentLevel.planet, renderCam, canvas);
    if (currentLevel.moon) {
      renderer.drawMoon(ctx, currentLevel.moon, renderCam, canvas);
    }
  }

  // Level 7: Erdplanet zeichnen (Orbital Rendezvous)
  if (level === 7 && currentLevel.planet) {
    renderer.drawPlanet(ctx, currentLevel.planet, renderCam, canvas);
  }

  // Level 2 / 5: Gravity Well zeichnen (vor Stationen, damit Ringe im Hintergrund)
  // Bei L5 (isPlanet) keinen Well-Ring zeichnen — der Planet ist das visuelle Objekt
  if (well && !well.isPlanet) {
    renderer.drawGravityWell(ctx, well, renderCam, canvas, EVENT_HORIZON);
  }

  if (level === 7 && currentLevel.planet) {
    const orbitStatus = getOrbitStatus(renderShip, currentLevel.planet);
    renderer.drawOrbitGuide(ctx, currentLevel.planet, renderShip, stationB, ORBIT_STATION_RADIUS, renderCam, canvas, orbitStatus);
  }

  if (asteroids && !currentLevel.debrisField) {
    renderer.drawAsteroids(ctx, asteroids, renderCam, canvas, trajHitAsteroid);
  }

  if (asteroids && currentLevel.debrisField) {
    renderer.drawDebrisField(ctx, asteroids, renderCam, canvas, trajHitAsteroid);
  }

  const checkA = checkDock(ship, stationA);
  const colorA = dockColor(checkA);
  renderer.drawStation(ctx, stationA, renderCam, canvas, colorA);
  const checkB = checkDock(ship, stationB);
  const colorB = dockColor(checkB);
  renderer.drawStation(ctx, stationB, renderCam, canvas, colorB);

  // Level 2 / 5: Trajectory-Vorschau zeichnen
  if (well && trajValidSteps > 1) {
    const willHitPlanet = well.isPlanet && trajValidSteps < TRAJ_STEPS;
    renderer.drawTrajectory(ctx, trajX, trajY, trajValidSteps, renderCam, canvas, isInDanger || willHitPlanet);
    if (well.isPlanet) {
      renderer.drawOrbitTrajectoryAssist(ctx, orbitAssist, renderCam, canvas);
    }
    if (willHitPlanet) {
      renderer.drawPlanetImpactMarker(ctx, trajX[trajValidSteps], trajY[trajValidSteps], renderCam, canvas);
    }
  }

  if (asteroids && trajValidSteps > 1) {
    renderer.drawTrajectory(ctx, trajX, trajY, trajValidSteps, renderCam, canvas, trajWillHitAsteroid);
  }

  if (gameState === 'blackHoleCollapse' && blackHoleCollapse) {
    const t = Math.min(1, (performance.now() - blackHoleCollapse.startTime) / BLACK_HOLE_COLLAPSE_MS);
    const eased = t * t * (3 - 2 * t);
    const collapseShip = {
      ...renderShip,
      x: lerp(blackHoleCollapse.startX, blackHoleCollapse.targetX, eased),
      y: lerp(blackHoleCollapse.startY, blackHoleCollapse.targetY, eased),
      angle: blackHoleCollapse.startAngle,
    };
    const collapseScale = Math.max(0.08, 1 - eased * 0.92);
    renderer.drawShip(ctx, collapseShip, renderCam, canvas, flags, collapseScale);
    return;
  }

  renderer.drawRcsZone(ctx, renderShip, renderCam, canvas, flags);
  if (gameState !== 'crashed') {
    renderer.drawShip(ctx, renderShip, renderCam, canvas, flags);
  }
  renderer.drawParticles(ctx, renderCam, canvas, particles);
  renderer.drawTargetAngle(ctx, renderShip, renderCam, canvas);
  renderer.drawVelocityVec(ctx, renderShip, renderCam, canvas);

  // Level 2: Event Horizon Vignette
  if (well && isInDanger) {
    renderer.drawEventHorizonWarning(ctx, canvas, eventHorizonPulse);
  }

  const targetCheck = targetStation === stationA ? checkA : checkB;
  const targetColor = targetStation === stationA ? colorA : colorB;
  renderer.drawHud(ctx, ship, canvas, targetStation, targetCheck, score, targetColor, level);
  renderer.drawTargetArrow(ctx, renderShip, targetStation, renderCam, canvas);

  // Level 6: Slingshot-HUD
  if (level === 6) {
    const slingshotStatus = getSlingshotStatus(ship, currentLevel.well, trajX, trajY, trajValidSteps);
    renderer.drawSlingshotHud(ctx, ship, currentLevel.well, canvas, slingshotStatus);
  }

  // Level 7: Orbit-HUD (Delta-V zur orbitierenden Station)
  if (level === 7) {
    renderer.drawOrbitHud(ctx, renderShip, stationB, currentLevel.planet, canvas, {
      orbitRadius: ORBIT_STATION_RADIUS,
      targetSpeed: ORBIT_STATION_RADIUS * ORBIT_STATION_SPEED,
      radiusTolerance: ORBIT_TOLERANCE,
      radialSpeedOk: ORBIT_RADIAL_SPEED_OK,
      tangentialSpeedOk: ORBIT_TANGENTIAL_SPEED_OK,
    });
  }

  if (level === 1) drawTutorial(ctx, canvas, tut, renderShip, flags, renderCam);
}

function getOrbitStatus(sourceShip, planet) {
  const dx = sourceShip.x - planet.x;
  const dy = sourceShip.y - planet.y;
  const radius = Math.hypot(dx, dy);
  if (radius <= 0) {
    return { orbitOk: false, radialSpeed: 0, tangentialError: 0 };
  }

  const ux = dx / radius;
  const uy = dy / radius;
  const radialSpeed = sourceShip.vx * ux + sourceShip.vy * uy;
  const tangentialSpeed = sourceShip.vx * -uy + sourceShip.vy * ux;
  const radiusError = radius - ORBIT_STATION_RADIUS;
  const tangentialError = tangentialSpeed - ORBIT_STATION_RADIUS * ORBIT_STATION_SPEED;
  const orbitOk = Math.abs(radiusError) <= ORBIT_TOLERANCE
    && Math.abs(radialSpeed) <= ORBIT_RADIAL_SPEED_OK
    && Math.abs(tangentialError) <= ORBIT_TANGENTIAL_SPEED_OK;

  return { orbitOk, radialSpeed, tangentialError };
}

/**
 * Berechnet Slingshot-Statusdaten für das L6-HUD:
 * - closestApproach: kürzeste Distanz zur Planetenoberfläche entlang der Trajektorie
 * - speedAtClosest: Geschwindigkeit an diesem Punkt
 * - approachAngle: Winkel des Schiffs relativ zum Planeten (ob der Kurs links/rechts angreift)
 */
function getSlingshotStatus(sourceShip, well, trajXArr, trajYArr, validSteps) {
  let closestDist = Infinity;
  let closestStep = 0;

  for (let i = 0; i < validSteps; i++) {
    const dx = trajXArr[i] - well.x;
    const dy = trajYArr[i] - well.y;
    const d = Math.sqrt(dx * dx + dy * dy) - well.wellRadius;
    if (d < closestDist) {
      closestDist = d;
      closestStep = i;
    }
  }

  // Winkel vom Planeten zum Schiff (zeigt ob der Spieler links/rechts ansetzt)
  const shipDx = sourceShip.x - well.x;
  const shipDy = sourceShip.y - well.y;
  const approachAngle = Math.atan2(shipDy, shipDx);

  // Geschwindigkeit des Schiffs
  const speed = Math.hypot(sourceShip.vx, sourceShip.vy);

  return {
    closestApproach: closestDist,
    closestStep,
    approachAngle,
    speed,
    hasTrajectory: validSteps > 2,
  };
}

function updateDemoAutopilot(dt, now) {
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
    flyDemoTransfer(metrics, planet);
    if (metrics.radius < ORBIT_STATION_RADIUS + 150) {
      setDemoPhase('circularize');
    }
  } else if (demoMode.phase === 'circularize') {
    demoMode.message = DEMO_PHASE_COPY.circularize;
    flyDemoOrbit(metrics, ORBIT_STATION_RADIUS);
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
    flyDemoOrbit(metrics, ORBIT_STATION_RADIUS);
    if (demoMode.phaseFrames > 180) {
      setDemoPhase('phaseToStation');
    }
  } else if (demoMode.phase === 'phaseToStation') {
    demoMode.message = DEMO_PHASE_COPY.phaseToStation;
    const phaseRadius = phaseAngle > 0 ? ORBIT_STATION_RADIUS - 125 : ORBIT_STATION_RADIUS + 105;
    flyDemoOrbit(metrics, phaseRadius);
    if ((Math.abs(phaseAngle) < 0.55 && stationDist < 420) || stationDist < 220) {
      setDemoPhase('rendezvous');
    }
  } else if (demoMode.phase === 'rendezvous') {
    demoMode.message = DEMO_PHASE_COPY.rendezvous;
    flyDemoRendezvous(station);
  } else {
    flags.thrustMain = false;
  }

  updateDemoHud();
}

function setDemoPhase(phase) {
  demoMode.phase = phase;
  demoMode.phaseFrames = 0;
  demoMode.message = DEMO_PHASE_COPY[phase] || '';
  if (phase === 'circularize') demoMode.stableOrbitFrames = 0;
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

function flyDemoTransfer(metrics, planet) {
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
  steerDemoToVelocity(desiredVx, desiredVy, 0.075);
}

function flyDemoOrbit(metrics, targetRadius) {
  const targetSpeed = Math.sqrt(PLANET_GRAVITY_STRENGTH / targetRadius);
  const radiusError = metrics.radius - targetRadius;
  const radialTarget = demoClamp(-radiusError * 0.008, -0.65, 0.65);
  const tangentTarget = targetSpeed + demoClamp(-radiusError * 0.0008, -0.08, 0.08);
  const desiredVx = metrics.progradeX * tangentTarget + metrics.ux * radialTarget;
  const desiredVy = metrics.progradeY * tangentTarget + metrics.uy * radialTarget;
  steerDemoToVelocity(desiredVx, desiredVy, 0.058);
}

function flyDemoRendezvous(station) {
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
    applyDemoRcsToVelocity(desiredVx, desiredVy);
    return;
  }

  steerDemoToVelocity(desiredVx, desiredVy, 0.05);
}

function applyDemoRcsToVelocity(desiredVx, desiredVy) {
  const errX = desiredVx - ship.vx;
  const errY = desiredVy - ship.vy;
  const err = Math.hypot(errX, errY);
  if (err < 0.018) {
    flags.rcsPulse = null;
    return;
  }

  flags.rcsPulse = { dx: errX / err, dy: errY / err };
}

function steerDemoToVelocity(desiredVx, desiredVy, gain) {
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

function updateOrbitAssist() {
  orbitAssist.periapsis = null;
  orbitAssist.apoapsis = null;
  orbitAssist.burnHint = null;
  orbitAssist.orbitOk = false;

  if (!currentLevel.well?.isPlanet || trajValidSteps < 4) return;

  let minI = 0;
  let maxI = 0;
  let minR = Infinity;
  let maxR = -Infinity;
  for (let i = 0; i < trajValidSteps; i++) {
    const dx = trajX[i] - currentLevel.planet.x;
    const dy = trajY[i] - currentLevel.planet.y;
    const r = Math.hypot(dx, dy);
    if (r < minR) {
      minR = r;
      minI = i;
    }
    if (r > maxR) {
      maxR = r;
      maxI = i;
    }
  }

  orbitAssist.periapsis = createApsisMarker(minI, 'PE');
  orbitAssist.apoapsis = createApsisMarker(maxI, 'AP');

  const orbitStatus = getOrbitStatus(ship, currentLevel.planet);
  orbitAssist.orbitOk = orbitStatus.orbitOk;
  if (orbitStatus.orbitOk) return;

  if (Math.abs(orbitStatus.radialSpeed) > ORBIT_RADIAL_SPEED_OK * 1.5) {
    orbitAssist.burnHint = createApsisMarker(Math.abs(minR - ORBIT_STATION_RADIUS) < Math.abs(maxR - ORBIT_STATION_RADIUS) ? minI : maxI, 'RADIAL');
  } else {
    orbitAssist.burnHint = createApsisMarker(minR < ORBIT_STATION_RADIUS ? maxI : minI, 'TAN');
  }
}

function createApsisMarker(index, label) {
  return { x: trajX[index], y: trajY[index], label };
}

function handleDocking(ship, station) {
  dockShipAtStation(ship, station);
  transferCargo();
  scheduleUndock(station);
}

function dockShipAtStation(ship, station) {
  const port = getPortPosition(station);
  ship.dockedTimer = 1500;
  ship.fuel = currentLevel.fuelStart ?? FUEL_START;
  ship.x = port.x;
  ship.y = port.y;
  ship.angle = station.dockAngle + Math.PI;
  ship.targetAngle = ship.angle;
  // Orbiting station: Schiff übernimmt Stationsgeschwindigkeit damit es mitfliegt
  ship.vx = station.orbiting ? station.vx : 0;
  ship.vy = station.orbiting ? station.vy : 0;
  ship.angularVel = 0;
  ship.thrustHeld = false;
  ship.tapThrustTime = 0;
  ship.pendingBrakeImpulse = false;
  // Referenz auf Station speichern, damit updateDockedShip die Position mitführen kann
  ship.dockedStation = station.orbiting ? station : null;
  station.docked = true;
  syncRenderStates();
  playDock();
}

function transferCargo() {
  if (ship.cargo === 0) {
    ship.cargo = 1;
    return;
  }

  ship.cargo = 0;
  score += 1;
  completeLevel();
}

function scheduleUndock(station) {
  setTimeout(() => {
    station.docked = false;
    ship.dockedStation = null;
  }, 1500);
}

function completeLevel() {
  if (demoMode.active) {
    completeDemo();
    return;
  }

  markLevelComplete(level);
  gameState = 'levelComplete';
  playDeliveryComplete();

  if (level >= TOTAL_LEVELS) {
    setTimeout(() => {
      finalCompleteScreen.hidden = false;
    }, 800);
    return;
  }

  showLevelCompleteCopy(getLevelCompleteCopy(level));

  setTimeout(() => {
    levelCompleteScreen.hidden = false;
  }, 800);
}

function completeDemo() {
  gameState = 'demoComplete';
  setDemoPhase('complete');
  updateDemoHud();
  playDeliveryComplete();

  setTimeout(() => {
    stopDemoAndShowMenu();
  }, 2600);
}

function showLevelCompleteCopy(copy) {
  const eyebrow = levelCompleteScreen.querySelector('.eyebrow');
  const title = levelCompleteScreen.querySelector('h1');
  const mission = levelCompleteScreen.querySelector('.mission');
  const nextLevelButton = document.getElementById('nextLevelButton');

  eyebrow.textContent = copy.eyebrow;
  title.textContent = copy.title;
  mission.textContent = copy.mission;
  if (nextLevelButton) {
    nextLevelButton.hidden = !copy.nextLevelLabel;
    nextLevelButton.textContent = copy.nextLevelLabel || 'Nächstes Level';
  }
}

function getLevelCompleteCopy(completedLevel) {
  if (completedLevel === 1) {
    return {
      eyebrow: 'Level 1 abgeschlossen',
      title: 'Transport erfolgreich',
      mission: 'Grundlagen gemeistert! Die erste Lieferung ist angekommen.',
      nextLevelLabel: 'Nächstes Level',
    };
  }

  if (completedLevel === 2) {
    return {
      eyebrow: 'Level 2 abgeschlossen',
      title: 'Gravity Well bezwungen',
      mission: 'Du hast den Gravitationseinfluss gemeistert und die Fracht sicher geliefert.',
      nextLevelLabel: 'Nächstes Level',
    };
  }

  if (completedLevel === 3) {
    return {
      eyebrow: 'Level 3 abgeschlossen',
      title: 'Feld durchquert',
      mission: 'Du hast die Drift sauber gehalten und die Fracht durch das Asteroidenfeld gebracht.',
      nextLevelLabel: 'Nächstes Level',
    };
  }

  if (completedLevel === 4) {
    return {
      eyebrow: 'Level 4 abgeschlossen',
      title: 'Singularität bezwungen',
      mission: 'Du hast dem Schwarzen Loch widerstanden und die Fracht unbeschadet geliefert.',
      nextLevelLabel: 'Nächstes Level',
    };
  }

  if (completedLevel === 5) {
    return {
      eyebrow: 'Level 5 abgeschlossen',
      title: 'Schrottfeld durchquert',
      mission: 'Präzise Arbeit — du hast das Feld aus Weltraummüll unbeschadet hinter dir gelassen.',
      nextLevelLabel: 'Nächstes Level',
    };
  }

  if (completedLevel === 6) {
    return {
      eyebrow: 'Level 6 abgeschlossen',
      title: 'Schwerkraftschleuder gemeistert',
      mission: 'Das Manöver hat geklappt — der Gasriese hat dich auf Kurs geschleudert.',
      nextLevelLabel: 'Nächstes Level',
    };
  }

  return null;
}

function resetLevel() {
  if (blackHoleCollapseTimer) {
    clearTimeout(blackHoleCollapseTimer);
    blackHoleCollapseTimer = null;
  }
  if (blackHoleResetTimer) {
    clearTimeout(blackHoleResetTimer);
    blackHoleResetTimer = null;
  }
  blackHoleCollapse = null;
  const start = currentLevel.shipStart;
  ship.x = start.x;
  ship.y = start.y;
  ship.vx = 0;
  ship.vy = 0;
  ship.angle = 0;
  ship.angularVel = 0;
  ship.targetAngle = 0;
  ship.fuel = currentLevel.fuelStart ?? FUEL_START;
  ship.cargo = 0;
  ship.dockedTimer = 0;
  ship.dockedStation = null;
  ship.thrustHeld = false;
  ship.tapThrustTime = 0;
  ship.pendingBrakeImpulse = false;
  currentLevel.stationA.docked = false;
  currentLevel.stationB.docked = false;
  // Bei orbitierenden Stationen: Startposition zurücksetzen
  if (currentLevel.stationB.orbiting) {
    currentLevel.stationB.orbitAngle = Math.PI * 1.25;
    updateOrbitingStation(currentLevel.stationB, 0);
  }
  targetStation = currentLevel.stationA;
  dockingApproach = null;
  isInDanger = false;
  trajValidSteps = 0;
  trajWillHitAsteroid = false;
  trajHitAsteroid = null;
  orbitAssist.periapsis = null;
  orbitAssist.apoapsis = null;
  orbitAssist.burnHint = null;
  orbitAssist.orbitOk = false;
  particles = [];
  cam.x = ship.x;
  cam.y = ship.y;
  cam.targetZoom = 1;
  syncRenderStates();
}

function crashReset() {
  spawnExplosion(ship.x, ship.y);
  gameState = 'crashed';
  ship.pendingBrakeImpulse = false;
  ship.thrustHeld = false;
  ship.tapThrustTime = 0;
  setTimeout(() => {
    particles = [];
    resetLevel();
    if (demoMode.active) {
      ship.cargo = 1;
      targetStation = currentLevel.stationB;
      setDemoPhase('transfer');
    }
    gameState = 'playing';
    last = performance.now();
  }, 1200);
}

const nextLevelButton = document.getElementById('nextLevelButton');
if (nextLevelButton) {
  nextLevelButton.addEventListener('click', () => {
    const nextLevel = Math.min(level + 1, TOTAL_LEVELS);
    selectLevel(nextLevel);
    score = 0;
    resetLevel();
    levelCompleteScreen.hidden = true;
    showLevelIntroOrStart(nextLevel);
    last = performance.now();
  });
}

function showLevelIntroOrStart(targetLevel) {
  const intro = document.getElementById(`level${targetLevel}StartScreen`);
  if (intro) {
    intro.hidden = false;
    return;
  }

  gameState = 'playing';
}

const level2StartButton = document.getElementById('level2StartButton');
if (level2StartButton) {
  level2StartButton.addEventListener('click', () => {
    document.getElementById('level2StartScreen').hidden = true;
    beginGameplay();
  });
}

const level3StartButton = document.getElementById('level3StartButton');
if (level3StartButton) {
  level3StartButton.addEventListener('click', () => {
    document.getElementById('level3StartScreen').hidden = true;
    beginGameplay();
  });
}

const level5StartButton = document.getElementById('level5StartButton');
if (level5StartButton) {
  level5StartButton.addEventListener('click', () => {
    document.getElementById('level5StartScreen').hidden = true;
    beginGameplay();
  });
}

const level6StartButton = document.getElementById('level6StartButton');
if (level6StartButton) {
  level6StartButton.addEventListener('click', () => {
    document.getElementById('level6StartScreen').hidden = true;
    beginGameplay();
  });
}

const level7StartButton = document.getElementById('level7StartButton');
if (level7StartButton) {
  level7StartButton.addEventListener('click', () => {
    document.getElementById('level7StartScreen').hidden = true;
    beginGameplay();
  });
}

muteButton.textContent = isMuted() ? 'Ton aus' : 'Ton an';
loop();
