import { createShip } from './ship.js';
import { createCamera, updateCamera } from './camera.js';
import { createInputFlags, setupDesktopInput } from './input-desktop.js';
import { setupMobileInput } from './input-mobile.js';
import { updatePhysics } from './physics.js';
import { createStation, checkDock, dockColor, getPortPosition } from './station.js';
import * as renderer from './renderer.js';
import { FUEL_START, WORLD_WIDTH, WORLD_HEIGHT, WELL_RADIUS, EVENT_HORIZON } from './constants.js';
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
let ship = createShip(currentLevel.shipStart.x, currentLevel.shipStart.y);
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

// stars
const stars = [];
for (let i=0;i<200;i++) stars.push({ x: Math.random()*2400, y: Math.random()*1600 });

let last = performance.now();

function startLevel(targetLevel) {
  if (targetLevel === 1) {
    level = 1;
    currentLevel = L1;
  } else {
    level = 2;
    currentLevel = L2;
  }
  
  ship = createShip(currentLevel.shipStart.x, currentLevel.shipStart.y);
  setupDesktopInput(flags, ship);
  setupMobileInput(flags, canvas, cam, ship);
  
  resetLevel();
  
  initAudio().then(() => {
    playStart();
    gameState = 'playing';
    startScreen.hidden = true;
    last = performance.now();
  });
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

  const well = currentLevel.well;
  const stationA = currentLevel.stationA;
  const stationB = currentLevel.stationB;

  if (gameState === 'playing') {
    updatePhysics(ship, flags, dt, well);
    if (level === 1) updateTutorial(tut, ship, flags, dt);

    // Level 2: Gravitations-Kollision
    if (well && checkWellCollision(ship, well)) {
      crashReset();
      return;
    }

    // Level 2: Event Horizon / Danger detection
    if (well) {
      const dx = well.x - ship.x;
      const dy = well.y - ship.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      isInDanger = dist < EVENT_HORIZON;
      if (isInDanger) {
        eventHorizonPulse = 0.5 + 0.5 * Math.sin(now / 150);
      }
    }

    // Level 2: Trajectory-Vorhersage (alle 2 Frames neu berechnen)
    if (well) {
      trajFrameCounter++;
      if (trajFrameCounter >= 2) {
        trajFrameCounter = 0;
        trajValidSteps = predictTrajectory(ship, well, TRAJ_STEPS, trajX, trajY);
      }
    }
  }

  updateCamera(cam, ship, getStations());

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

  if (gameState === 'playing' && ship.dockedTimer <= 0) {
    if (colorA === 'green' && targetStation === stationA) {
      handleDocking(ship, stationA);
      targetStation = stationB;
    } else if (colorB === 'green' && targetStation === stationB) {
      handleDocking(ship, stationB);
      targetStation = stationA;
    }
  }

  // Level 2: Trajectory-Vorschau zeichnen
  if (well && trajValidSteps > 1) {
    renderer.drawTrajectory(ctx, trajX, trajY, trajValidSteps, cam, canvas, isInDanger);
  }

  renderer.drawRcsZone(ctx, ship, cam, canvas, flags);
  renderer.drawShip(ctx, ship, cam, canvas, flags);
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

  requestAnimationFrame(loop);
}

function handleDocking(ship, station) {
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

  if (ship.cargo === 0) {
    ship.cargo = 1;
  } else {
    ship.cargo = 0;
    score += 1;
    completeLevel();
  }

  setTimeout(() => {
    station.docked = false;
  }, 1500);
}

function completeLevel() {
  gameState = 'levelComplete';
  playDeliveryComplete();

  // Level-Complete-Screen: Texte je nach Level anpassen
  const eyebrow = levelCompleteScreen.querySelector('.eyebrow');
  const title = levelCompleteScreen.querySelector('h1');
  const mission = levelCompleteScreen.querySelector('.mission');

  if (level === 1) {
    eyebrow.textContent = 'Level 1 abgeschlossen';
    title.textContent = 'Transport erfolgreich';
    mission.textContent = 'Grundlagen gemeistert! Die erste Lieferung ist angekommen.';
  } else if (level === 2) {
    eyebrow.textContent = 'Level 2 abgeschlossen';
    title.textContent = 'Gravity Well bezwungen';
    mission.textContent = 'Du hast den Gravitationseinfluss gemeistert und die Fracht sicher geliefert.';
  }

  setTimeout(() => {
    levelCompleteScreen.hidden = false;
  }, 800);
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
  cam.x = ship.x;
  cam.y = ship.y;
}

function crashReset() {
  // Kurzer visueller Blitz (Vignette ist schon rot), dann sofort zurücksetzen
  gameState = 'crashed';
  setTimeout(() => {
    resetLevel();
    gameState = 'playing';
    last = performance.now();
  }, 600);
}

// Der Mechanismus: levelCompleteScreen zeigt einen "Weiter"-Button für Level 2.

// Selektiere den Weiter-Button (falls vorhanden)
const nextLevelButton = document.getElementById('nextLevelButton');
if (nextLevelButton) {
  nextLevelButton.addEventListener('click', async () => {
    await initAudio();
    level = 2;
    currentLevel = L2;
    ship = createShip(L2.shipStart.x, L2.shipStart.y);
    // Input neu verdrahten
    setupDesktopInput(flags, ship);
    setupMobileInput(flags, canvas, cam, ship);
    targetStation = L2.stationA;
    score = 0;
    resetLevel();
    levelCompleteScreen.hidden = true;
    // Level-2-Startscreen anzeigen
    const l2screen = document.getElementById('level2StartScreen');
    if (l2screen) {
      l2screen.hidden = false;
    } else {
      gameState = 'playing';
    }
    last = performance.now();
  });
}

const level2StartButton = document.getElementById('level2StartButton');
if (level2StartButton) {
  level2StartButton.addEventListener('click', async () => {
    await initAudio();
    playStart();
    document.getElementById('level2StartScreen').hidden = true;
    gameState = 'playing';
    last = performance.now();
  });
}

muteButton.textContent = isMuted() ? 'Sound aus' : 'Sound an';
loop();
