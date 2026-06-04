import { createShip } from './ship.js';
import { createCamera, updateCamera } from './camera.js';
import { createInputFlags, setupDesktopInput } from './input-desktop.js';
import { setupMobileInput } from './input-mobile.js';
import { updatePhysics } from './physics.js';
import { createStation, checkDock, dockColor, getPortPosition } from './station.js';
import * as renderer from './renderer.js';
import { FUEL_START, WELL_RADIUS, EVENT_HORIZON } from './constants.js';
import { initAudio, isMuted, playDeliveryComplete, playDock, playStart, toggleMute } from './audio.js';
import { createTutorial, updateTutorial, drawTutorial } from './tutorial.js';
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
const startL1 = document.getElementById('startL1');
const startL2 = document.getElementById('startL2');
const startL3 = document.getElementById('startL3');
const startL4 = document.getElementById('startL4');
const muteButton = document.getElementById('muteButton');
const backToMenuButton = document.getElementById('backToMenuButton');

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

L1.stations = [L1.stationA, L1.stationB];
L2.stations = [L2.stationA, L2.stationB];
L3.stations = [L3.stationA, L3.stationB];
L4.stations = [L4.stationA, L4.stationB];

let currentLevel = L1;
const ship = createShip(currentLevel.shipStart.x, currentLevel.shipStart.y);
const cam = createCamera(ship.x, ship.y);
const flags = createInputFlags();
setupDesktopInput(flags, ship);
setupMobileInput(flags, canvas, cam, ship);

let score = 0;
let targetStation = currentLevel.stationA;
let gameState = 'start';
let level = 1;
const tut = createTutorial();

// Vorab allozierte Trajectory-Buffer (kein GC im Hot-Path)
const TRAJ_STEPS = 80;
const trajX = new Float32Array(TRAJ_STEPS);
const trajY = new Float32Array(TRAJ_STEPS);
let trajValidSteps = 0;
let trajFrameCounter = 0;
let trajWillHitAsteroid = false;
let trajHitAsteroid = null;

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

// stars
const stars = [];
for (let i=0;i<200;i++) stars.push({ x: Math.random()*2400, y: Math.random()*1600 });

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
  selectLevel(targetLevel);
  score = 0;
  resetLevel();
  startScreen.hidden = true;
  beginGameplay();
}

function selectLevel(targetLevel) {
  level = targetLevel;
  if (targetLevel === 1) currentLevel = L1;
  else if (targetLevel === 2) currentLevel = L2;
  else if (targetLevel === 3) currentLevel = L3;
  else currentLevel = L4;
}

async function beginGameplay() {
  await initAudio();
  playStart();
  gameState = 'playing';
  last = performance.now();
  accumulator = 0;
  syncRenderStates();
}

startL1.addEventListener('click', () => startLevel(1));
startL2.addEventListener('click', () => startLevel(2));
startL3.addEventListener('click', () => startLevel(3));
startL4.addEventListener('click', () => startLevel(4));

muteButton.addEventListener('click', async () => {
  await initAudio();
  const muted = toggleMute();
  muteButton.textContent = muted ? 'Sound aus' : 'Sound an';
  muteButton.setAttribute('aria-pressed', String(muted));
});

backToMenuButton.addEventListener('click', () => {
  levelCompleteScreen.hidden = true;
  startScreen.hidden = false;
  gameState = 'start';
});

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

  if (gameState !== 'playing') return;

  updatePhysics(ship, flags, dt, currentLevel.well);
  updateLevelSystems(dt, now);
  if (gameState !== 'playing') return;
  updateDocking();
}

function updateLevelSystems(dt, now) {
  if (level === 1) {
    updateTutorial(tut, ship, flags, dt);
  }

  if (currentLevel.well) {
    updateGravityHazards(now);
    updateGravityTrajectoryPrediction();
  }

  if (currentLevel.asteroids) {
    updateAsteroidHazards();
    updateAsteroidTrajectoryPrediction();
  }
}

function updateGravityHazards(now) {
  const well = currentLevel.well;
  if (checkWellCollision(ship, well)) {
    if (well.isBlackHole) {
      spaghettifyReset();
    } else {
      crashReset();
    }
    return;
  }

  const dist = Math.hypot(well.x - ship.x, well.y - ship.y);
  const dangerLimit = well.isBlackHole ? EVENT_HORIZON * 1.5 : EVENT_HORIZON;
  isInDanger = dist < dangerLimit;
  if (isInDanger) {
    eventHorizonPulse = 0.5 + 0.5 * Math.sin(now / 150);
  }
}

function spaghettifyReset() {
  gameState = 'crashed'; // Sperrt Input
  // Wir simulieren das Verschlucken durch schnelles Drehen und Skalieren in renderer.js
  // Hier setzen wir nur den Timeout für den Reset
  setTimeout(() => {
    resetLevel();
    gameState = 'playing';
    last = performance.now();
  }, 1500);
}

function updateGravityTrajectoryPrediction() {
  trajFrameCounter++;
  if (trajFrameCounter < 2) return;

  trajFrameCounter = 0;
  trajValidSteps = predictTrajectory(ship, currentLevel.well, TRAJ_STEPS, trajX, trajY);
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

  handleDocking(ship, station);
  targetStation = station === currentLevel.stationA ? currentLevel.stationB : currentLevel.stationA;
}

function getDockableTargetStation() {
  const check = checkDock(ship, targetStation);
  return dockColor(check) === 'green' ? targetStation : null;
}

function renderFrame(alpha = 1) {
  prepareRenderState(alpha);

  const well = currentLevel.well;
  const asteroids = currentLevel.asteroids;
  const stationA = currentLevel.stationA;
  const stationB = currentLevel.stationB;

  renderer.clear(ctx, canvas);
  renderer.drawStars(ctx, stars, renderCam, canvas);

  // Level 2: Gravity Well zeichnen (vor Stationen, damit Ringe im Hintergrund)
  if (well) {
    renderer.drawGravityWell(ctx, well, renderCam, canvas, EVENT_HORIZON);
  }

  if (asteroids) {
    renderer.drawAsteroids(ctx, asteroids, renderCam, canvas, trajHitAsteroid);
  }

  const checkA = checkDock(ship, stationA);
  const colorA = dockColor(checkA);
  renderer.drawStation(ctx, stationA, renderCam, canvas, colorA);
  const checkB = checkDock(ship, stationB);
  const colorB = dockColor(checkB);
  renderer.drawStation(ctx, stationB, renderCam, canvas, colorB);

  // Level 2: Trajectory-Vorschau zeichnen
  if (well && trajValidSteps > 1) {
    renderer.drawTrajectory(ctx, trajX, trajY, trajValidSteps, renderCam, canvas, isInDanger);
  }

  if (asteroids && trajValidSteps > 1) {
    renderer.drawTrajectory(ctx, trajX, trajY, trajValidSteps, renderCam, canvas, trajWillHitAsteroid);
  }

  renderer.drawRcsZone(ctx, renderShip, renderCam, canvas, flags);
  if (gameState !== 'crashed' || (well && well.isBlackHole)) {
    const isSpaghettifying = gameState === 'crashed' && well && well.isBlackHole;
    renderer.drawShip(ctx, renderShip, renderCam, canvas, flags, isSpaghettifying);
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

  if (level === 1) drawTutorial(ctx, canvas, tut, renderShip, flags, renderCam);
}

function handleDocking(ship, station) {
  dockShipAtStation(ship, station);
  transferCargo();
  scheduleUndock(station);
}

function dockShipAtStation(ship, station) {
  const port = getPortPosition(station);
  ship.dockedTimer = 1500;
  ship.fuel = FUEL_START;
  ship.x = port.x;
  ship.y = port.y;
  ship.angle = station.dockAngle + Math.PI;
  ship.vx = 0;
  ship.vy = 0;
  ship.angularVel = 0;
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
  }, 1500);
}

function completeLevel() {
  gameState = 'levelComplete';
  playDeliveryComplete();
  showLevelCompleteCopy(getLevelCompleteCopy(level));

  setTimeout(() => {
    levelCompleteScreen.hidden = false;
  }, 800);
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

  return {
    eyebrow: 'Level 4 abgeschlossen',
    title: 'Singularität überlebt',
    mission: 'Unglaublich. Du hast die Raumzeit-Krümmung zu deinem Vorteil genutzt.',
    nextLevelLabel: '',
  };
}

function resetLevel() {
  const start = currentLevel.shipStart;
  ship.x = start.x;
  ship.y = start.y;
  ship.vx = 0;
  ship.vy = 0;
  ship.angle = 0;
  ship.angularVel = 0;
  ship.targetAngle = 0;
  ship.fuel = FUEL_START;
  ship.cargo = 0;
  ship.dockedTimer = 0;
  ship.thrustHeld = false;
  ship.tapThrustTime = 0;
  currentLevel.stationA.docked = false;
  currentLevel.stationB.docked = false;
  targetStation = currentLevel.stationA;
  isInDanger = false;
  trajValidSteps = 0;
  trajWillHitAsteroid = false;
  trajHitAsteroid = null;
  particles = [];
  cam.x = ship.x;
  cam.y = ship.y;
  cam.targetZoom = 1;
  syncRenderStates();
}

function crashReset() {
  spawnExplosion(ship.x, ship.y);
  gameState = 'crashed';
  setTimeout(() => {
    particles = [];
    resetLevel();
    gameState = 'playing';
    last = performance.now();
  }, 1200);
}

const nextLevelButton = document.getElementById('nextLevelButton');
if (nextLevelButton) {
  nextLevelButton.addEventListener('click', () => {
    const nextLevel = Math.min(level + 1, 4);
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

muteButton.textContent = isMuted() ? 'Sound aus' : 'Sound an';
loop();
