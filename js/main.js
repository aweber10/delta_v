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

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const levelCompleteScreen = document.getElementById('levelCompleteScreen');
const startL1 = document.getElementById('startL1');
const startL2 = document.getElementById('startL2');
const muteButton = document.getElementById('muteButton');
const backToMenuButton = document.getElementById('backToMenuButton');

function resize() {
  canvas.width = Math.floor(window.innerWidth * devicePixelRatio);
  canvas.height = Math.floor(window.innerHeight * devicePixelRatio);
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// --- Level 1 ---
const L1 = {
  shipStart: { x: 200, y: 200 },
  stationA: createStation(200, 1200, 0),
  stationB: createStation(1800, 300, Math.PI),
  well: null,
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
};

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

let last = performance.now();

function startLevel(targetLevel) {
  selectLevel(targetLevel);
  score = 0;
  resetLevel();
  startScreen.hidden = true;
  beginGameplay();
}

function selectLevel(targetLevel) {
  level = targetLevel;
  currentLevel = targetLevel === 1 ? L1 : L2;
}

async function beginGameplay() {
  await initAudio();
  playStart();
  gameState = 'playing';
  last = performance.now();
}

startL1.addEventListener('click', () => startLevel(1));
startL2.addEventListener('click', () => startLevel(2));

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
  return [currentLevel.stationA, currentLevel.stationB];
}

function loop() {
  const now = performance.now();
  const dt = Math.min(32, now - last) / 16.6667;
  last = now;

  updateGame(dt, now);
  updateCamera(cam, ship, getStations());
  renderFrame();

  requestAnimationFrame(loop);
}

function updateGame(dt, now) {
  updateParticles(dt);

  if (gameState !== 'playing') return;

  updatePhysics(ship, flags, dt, currentLevel.well);
  updateLevelSystems(dt, now);
  updateDocking();
}

function updateLevelSystems(dt, now) {
  if (level === 1) {
    updateTutorial(tut, ship, flags, dt);
  }

  if (currentLevel.well) {
    updateGravityHazards(now);
    updateTrajectoryPrediction();
  }
}

function updateGravityHazards(now) {
  const well = currentLevel.well;
  if (checkWellCollision(ship, well)) {
    crashReset();
    return;
  }

  const dist = Math.hypot(well.x - ship.x, well.y - ship.y);
  isInDanger = dist < EVENT_HORIZON;
  if (isInDanger) {
    eventHorizonPulse = 0.5 + 0.5 * Math.sin(now / 150);
  }
}

function updateTrajectoryPrediction() {
  trajFrameCounter++;
  if (trajFrameCounter < 2) return;

  trajFrameCounter = 0;
  trajValidSteps = predictTrajectory(ship, currentLevel.well, TRAJ_STEPS, trajX, trajY);
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

function renderFrame() {
  const well = currentLevel.well;
  const stationA = currentLevel.stationA;
  const stationB = currentLevel.stationB;

  renderer.clear(ctx, canvas);
  renderer.drawStars(ctx, stars, cam, canvas);

  // Level 2: Gravity Well zeichnen (vor Stationen, damit Ringe im Hintergrund)
  if (well) {
    renderer.drawGravityWell(ctx, well, cam, canvas, EVENT_HORIZON);
  }

  const checkA = checkDock(ship, stationA);
  const colorA = dockColor(checkA);
  renderer.drawStation(ctx, stationA, cam, canvas, colorA);
  const checkB = checkDock(ship, stationB);
  const colorB = dockColor(checkB);
  renderer.drawStation(ctx, stationB, cam, canvas, colorB);

  // Level 2: Trajectory-Vorschau zeichnen
  if (well && trajValidSteps > 1) {
    renderer.drawTrajectory(ctx, trajX, trajY, trajValidSteps, cam, canvas, isInDanger);
  }

  renderer.drawRcsZone(ctx, ship, cam, canvas, flags);
  if (gameState !== 'crashed') renderer.drawShip(ctx, ship, cam, canvas, flags);
  renderer.drawParticles(ctx, cam, canvas, particles);
  renderer.drawTargetAngle(ctx, ship, cam, canvas);
  renderer.drawVelocityVec(ctx, ship, cam, canvas);

  // Level 2: Event Horizon Vignette
  if (well && isInDanger) {
    renderer.drawEventHorizonWarning(ctx, canvas, eventHorizonPulse);
  }

  const targetCheck = targetStation === stationA ? checkA : checkB;
  const targetColor = targetStation === stationA ? colorA : colorB;
  renderer.drawHud(ctx, ship, canvas, targetStation, targetCheck, score, targetColor, level);
  renderer.drawTargetArrow(ctx, ship, targetStation, cam, canvas);

  if (level === 1) drawTutorial(ctx, canvas, tut, ship, flags, cam);
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

  eyebrow.textContent = copy.eyebrow;
  title.textContent = copy.title;
  mission.textContent = copy.mission;
}

function getLevelCompleteCopy(completedLevel) {
  if (completedLevel === 1) {
    return {
      eyebrow: 'Level 1 abgeschlossen',
      title: 'Transport erfolgreich',
      mission: 'Grundlagen gemeistert! Die erste Lieferung ist angekommen.',
    };
  }

  return {
    eyebrow: 'Level 2 abgeschlossen',
    title: 'Gravity Well bezwungen',
    mission: 'Du hast den Gravitationseinfluss gemeistert und die Fracht sicher geliefert.',
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
  particles = [];
  cam.x = ship.x;
  cam.y = ship.y;
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
    selectLevel(2);
    score = 0;
    resetLevel();
    levelCompleteScreen.hidden = true;
    showLevel2IntroOrStart();
    last = performance.now();
  });
}

function showLevel2IntroOrStart() {
  const level2StartScreen = document.getElementById('level2StartScreen');
  if (level2StartScreen) {
    level2StartScreen.hidden = false;
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

muteButton.textContent = isMuted() ? 'Sound aus' : 'Sound an';
loop();
