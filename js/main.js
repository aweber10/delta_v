import { createShip } from './ship.js';
import { createCamera, updateCamera } from './camera.js';
import { createInputFlags, setupDesktopInput } from './input-desktop.js';
import { setupMobileInput } from './input-mobile.js';
import { updatePhysics } from './physics.js';
import { updateOrbitingStation, checkDock, dockColor, getPortPosition } from './station.js';
import * as renderer from './renderer.js';
import { FUEL_START, EVENT_HORIZON, ORBIT_STATION_RADIUS, ORBIT_STATION_SPEED, ORBIT_TOLERANCE, ORBIT_RADIAL_SPEED_OK, ORBIT_TANGENTIAL_SPEED_OK, normalizeAngle } from './constants.js';
import { initAudio, isMuted, playDeliveryComplete, playDock, playStart, toggleMute } from './audio.js';
import { createTutorial, updateTutorial, drawTutorial, setTutorialNearStation, setTutorialStationVisible, setTutorialArrowTarget } from './tutorial.js';
import { checkWellCollision, predictTrajectory } from './gravity.js';
import {
  checkAsteroidCollision,
  predictAsteroidTrajectory,
  resolveAsteroidCollision,
} from './asteroids.js';
import { getLevelByNumber, updateOrbitingMoon } from './levels.js';
import { isLevelUnlocked, markLevelComplete, TOTAL_LEVELS } from './progress.js';
import { DEMO_PHASE_COPY, updateDemoAutopilot as runDemoAutopilot } from './demo-autopilot.js';

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

let currentLevel = getLevelByNumber(1);
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

const tut = createTutorial();
let blackHoleResetTimer = null;
let blackHoleCollapseTimer = null;
let blackHoleCollapse = null;

const BLACK_HOLE_COLLAPSE_MS = 750;
const BLACK_HOLE_BLACKOUT_MS = 1000;

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
  currentLevel = getLevelByNumber(targetLevel);
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
    runDemoAutopilot({
      level,
      currentLevel,
      ship,
      flags,
      demoMode,
      setDemoPhase,
      updateDemoHud,
    });
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

  drawWorldBackground(well, asteroids, stationB);
  const stationRenderState = drawStations(stationA, stationB);
  drawTrajectoryPreview(well, asteroids);

  if (gameState === 'blackHoleCollapse' && blackHoleCollapse) {
    drawBlackHoleCollapse();
    return;
  }

  drawShipAndMotion();
  drawHudAndOverlays(well, stationB, stationRenderState);
}

function drawWorldBackground(well, asteroids, stationB) {
  renderer.clear(ctx, canvas);
  renderer.drawStars(ctx, stars, renderCam, canvas);

  if (level === 6 && currentLevel.planet) {
    renderer.drawGasPlanet(ctx, currentLevel.planet, renderCam, canvas);
    if (currentLevel.moon) {
      renderer.drawMoon(ctx, currentLevel.moon, renderCam, canvas);
    }
  }

  if (level === 7 && currentLevel.planet) {
    renderer.drawPlanet(ctx, currentLevel.planet, renderCam, canvas);
  }

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
}

function drawStations(stationA, stationB) {
  const checkA = checkDock(ship, stationA);
  const colorA = dockColor(checkA);
  renderer.drawStation(ctx, stationA, renderCam, canvas, colorA);

  const checkB = checkDock(ship, stationB);
  const colorB = dockColor(checkB);
  renderer.drawStation(ctx, stationB, renderCam, canvas, colorB);

  return { checkA, colorA, checkB, colorB };
}

function drawTrajectoryPreview(well, asteroids) {
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
}

function drawBlackHoleCollapse() {
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
}

function drawShipAndMotion() {
  renderer.drawRcsZone(ctx, renderShip, renderCam, canvas, flags);
  if (gameState !== 'crashed') {
    renderer.drawShip(ctx, renderShip, renderCam, canvas, flags);
  }
  renderer.drawParticles(ctx, renderCam, canvas, particles);
  renderer.drawTargetAngle(ctx, renderShip, renderCam, canvas);
  renderer.drawVelocityVec(ctx, renderShip, renderCam, canvas);
}

function drawHudAndOverlays(well, stationB, stationRenderState) {
  if (well && isInDanger) {
    renderer.drawEventHorizonWarning(ctx, canvas, eventHorizonPulse);
  }

  const targetCheck = targetStation === currentLevel.stationA ? stationRenderState.checkA : stationRenderState.checkB;
  const targetColor = targetStation === currentLevel.stationA ? stationRenderState.colorA : stationRenderState.colorB;
  renderer.drawHud(ctx, ship, canvas, targetStation, targetCheck, score, targetColor, level);
  renderer.drawTargetArrow(ctx, renderShip, targetStation, renderCam, canvas);

  if (level === 6) {
    const slingshotStatus = getSlingshotStatus(ship, currentLevel.well, trajX, trajY, trajValidSteps);
    renderer.drawSlingshotHud(ctx, ship, currentLevel.well, canvas, slingshotStatus);
  }

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
