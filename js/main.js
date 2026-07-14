import { createShip } from './ship.js';
import { createCamera, updateCamera, updateLevel8Camera, updateLevel9Camera, isWorldPointOnScreen } from './camera.js';
import { createInputFlags, setupDesktopInput } from './input-desktop.js';
import { setupMobileInput } from './input-mobile.js';
import { updatePhysics } from './physics.js';
import { updateOrbitingStation, checkDock, dockColor, getPortPosition } from './station.js';
import * as renderer from './renderer.js';
import { FUEL_MAIN, FUEL_START, EVENT_HORIZON, ORBIT_STATION_RADIUS, ORBIT_STATION_SPEED, ORBIT_TOLERANCE, ORBIT_RADIAL_SPEED_OK, ORBIT_TANGENTIAL_SPEED_OK, THRUST_MAIN, normalizeAngle, L9_HYPERDRIVE_TRIGGER_RADIUS, L9_WHITEOUT_DURATION_MS } from './constants.js';
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
const level8ClanScreen = document.getElementById('level8ClanScreen');
const level8ClanEyebrow = document.getElementById('level8ClanEyebrow');
const level8ClanTitle = document.getElementById('level8ClanTitle');
const level8ClanMission = document.getElementById('level8ClanMission');
const level8ClanContinueButton = document.getElementById('level8ClanContinueButton');

const level9StageScreen = document.getElementById('level9StageScreen');
const level9StageEyebrow = document.getElementById('level9StageEyebrow');
const level9StageTitle = document.getElementById('level9StageTitle');
const level9StageMission = document.getElementById('level9StageMission');
const level9StageContinueButton = document.getElementById('level9StageContinueButton');
const hyperdriveHud = document.getElementById('hyperdriveHud');
const hyperdriveButton = document.getElementById('hyperdriveButton');
const level9ArrivalScreen = document.getElementById('level9ArrivalScreen');
const level9ArrivalContinueButton = document.getElementById('level9ArrivalContinueButton');

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
let missionTargetIndex = 0;
let gameState = 'start';
let dockingApproach = null;
let level = 1;
const level8State = {
  phase: 'calder',
  hintTimer: 0,
  pendingFinal: false,
  cameraFocusStation: null,
  departureStation: null,
};
const LEVEL8_CLAN_COPY = [
  {
    eyebrow: 'Äußerer Clan',
    title: 'Die Vorsichtigen',
    mission: 'Der äußerste Clan empfängt dich förmlich. Sie prüfen dich lange, bevor sie überhaupt antworten. Als sie es tun, ist es ein einzelner, exakt formulierter Satz der Begrüßung. Du verstehst: Das war, für sie, überschwänglich.',
    button: 'Weiter zum zweiten Clan',
  },
  {
    eyebrow: 'Mittlerer Clan',
    title: 'Die Neugierigen',
    mission: 'Der zweite Clan stellt Fragen. Viele. Über Halvorsen, über Praskev, über Entscheidungen, die du vor Jahren getroffen hast und längst vergessen hattest. Sie haben nichts vergessen. Irgendwann merkst du, dass es kein Verhör ist – sie sind schlicht fasziniert. Eine Rasse, die in Jahrtausenden denkt, studiert eine, die in Quartalen plant. Du bist dir nicht sicher, ob das Bewunderung ist oder Sorge.',
    button: 'Weiter zum inneren Clan',
  },
  {
    eyebrow: 'Innerer Clan',
    title: 'Die Tonangebenden',
    mission: 'Der innerste Clan kreist im Schatten der Ringe, am nächsten am Zentrum der Macht. Hier wird nicht geprüft und nicht gefragt - hier wird entschieden. Sie empfangen dich, als wärst du erwartet worden, nicht erst seit Kestrel, sondern seit jenem kurzen Kontakt an deinem allerersten Tag.',
    button: 'Mission abschließen',
  },
];

const level9State = {
  phase: 'proteus',
  hyperdriveTriggered: false,
  whiteoutStart: 0,
  pendingFinal: false,
  cameraFocusStation: null,
  portIndex: 0,
  windowCycleStart: 0,
  windowPhase: 'warning',
  windowRemainingMs: 0,
  lastDockIndex: -1,
  revealStart: 0,
};

const LEVEL9_STAGE_COPY = [
  {
    backgroundClass: 'story-bg--solas-reception',
    eyebrow: 'Empfangsring',
    title: 'Zugang',
    mission: 'Der Empfangsring ist für Händler, Kuriere, akkreditierte Delegationen. Nicht für dich. Du landest trotzdem.\n\nDie erste Stunde ist Bürokratie. Formulare, Wartelisten, ein Sachbearbeiter der höflich erklärt, dass dein Anliegen an die zuständige Stelle weitergeleitet wird. Du fragst, welche Stelle das ist. Er weiß es nicht genau.\n\nDann zeigst du das Antriebsprotokoll. Die Reisedauer. Die Koordinaten von Kestrel. Er liest es zweimal. Dann steht er auf und holt jemanden.',
    button: 'Weiter zur Konsultationsebene',
  },
  {
    backgroundClass: 'story-bg--solas-consultation',
    eyebrow: 'Konsultationsebene',
    title: 'Position',
    mission: 'Die Konsultationsebene ist für Gespräche, die offiziell nicht stattfinden. Hier sitzen Menschen, die verstehen, was es bedeutet wenn etwas nicht ins Register passt.\n\nZwei von ihnen hören dir zu, ohne dich zu unterbrechen. Das ist ungewöhnlich. Einer stellt Fragen — nicht über die Proteus, sondern über dich. Wie lange du draußen warst. Ob du allein geflogen bist. Ob du weißt, was du mitgebracht hast.\n\nDu sagst: eine Geste. Einen Anfang. Keine Garantien.\n\nEr nickt. Er hat in seinem Leben zwei interstellare Verträge verhandelt. Er weiß, dass Anfänge das Wertvollste sind, was es gibt.',
    button: 'Weiter zur Zentralkammer',
  },
  {
    backgroundClass: 'story-bg--solas-chamber',
    eyebrow: 'Zentralkammer',
    title: 'Entscheidung',
    mission: 'Die Zentralkammer ist nicht groß. Das überrascht dich.\n\nHier wird nicht debattiert — das ist anderswo passiert, über Jahre, über Jahrzehnte. Hier wird nur noch entschieden. Drei Personen, ein Tisch, kein Publikum.\n\nDu trägst vor, was du weißt. Was du gesehen hast. Was die Proteus sind, soweit du das beurteilen kannst. Dass sie in Jahrtausenden denken. Dass sie die Menschheit studiert haben, nicht weil sie eine Bedrohung sahen, sondern weil sie etwas sahen, das sie nicht selbst haben.\n\nKeiner der drei unterbricht dich. Als du fertig bist, sagt niemand etwas. Dann, ohne Kommentar: die Menschheit wird antworten. Offiziell. Das wird Zeit brauchen.\n\nWas du mitgebracht hast, gehört ab jetzt nicht mehr nur dir.',
    button: 'Mission abschließen',
  },
];

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
const TRAJ_STEPS = 240;
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

const EXPLOSION_PARTICLE_TYPES = [
  { threshold: 0.25, speedMin: 2.5, speedMax: 6,    sizeMin: 2,  sizeMax: 4,  lifeMin: 18, lifeMax: 32, colors: ['#ffffff', '#ffee88'] },
  { threshold: 0.65, speedMin: 1.2, speedMax: 3.7,  sizeMin: 3,  sizeMax: 6.5,lifeMin: 28, lifeMax: 50, colors: ['#ff8800', '#ff5500', '#ffaa00', '#ff3300'] },
  { threshold: 1,    speedMin: 0.4, speedMax: 1.8,  sizeMin: 4,  sizeMax: 8,  lifeMin: 40, lifeMax: 70, colors: ['#aa2200', '#882200', '#664444', '#553333'] },
];

function spawnExplosion(x, y) {
  const COUNT = 55;
  for (let i = 0; i < COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const config = pickExplosionConfig(Math.random());
    const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
    particles.push(createExplosionParticle(x, y, angle, speed, config));
  }
}

function pickExplosionConfig(roll) {
  for (const c of EXPLOSION_PARTICLE_TYPES) {
    if (roll < c.threshold) return c;
  }
  return EXPLOSION_PARTICLE_TYPES[EXPLOSION_PARTICLE_TYPES.length - 1];
}

function createExplosionParticle(x, y, angle, speed, config) {
  const size = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
  const maxLife = Math.round(config.lifeMin + Math.random() * (config.lifeMax - config.lifeMin));
  const color = config.colors[Math.floor(Math.random() * config.colors.length)];
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: maxLife, maxLife, size, color,
  };
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
  if (level8ClanScreen) level8ClanScreen.hidden = true;
  if (level9StageScreen) level9StageScreen.hidden = true;
  if (level9ArrivalScreen) level9ArrivalScreen.hidden = true;
  showLevelIntroOrStart(targetLevel);
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
  if ((e.key === 'h' || e.key === 'H') && level === 9 && level9State.phase === 'proteus' && !level9State.hyperdriveTriggered) {
    const dist = Math.hypot(ship.x - currentLevel.proteusStation.x, ship.y - currentLevel.proteusStation.y);
    // Outer orbit radius of L8 is ~3000. Let's use the constant L9_HYPERDRIVE_TRIGGER_RADIUS
    if (dist >= 2800) {
      triggerHyperdrive();
    }
  }
});

if (hyperdriveButton) {
  hyperdriveButton.addEventListener('click', () => {
    if (level === 9 && level9State.phase === 'proteus' && !level9State.hyperdriveTriggered) {
      triggerHyperdrive();
    }
  });
}

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
  if (level8ClanScreen) level8ClanScreen.hidden = true;
  if (level9StageScreen) level9StageScreen.hidden = true;
  if (level9ArrivalScreen) level9ArrivalScreen.hidden = true;
  startScreen.hidden = true;
  selectLevel(1);
  score = 0;
  resetLevel();
  showLevelIntroOrStart(1);
});

function showMainMenu() {
  stopDemo();
  levelCompleteScreen.hidden = true;
  finalCompleteScreen.hidden = true;
  if (level8ClanScreen) level8ClanScreen.hidden = true;
  if (level9StageScreen) level9StageScreen.hidden = true;
  if (level9ArrivalScreen) level9ArrivalScreen.hidden = true;
  if (hyperdriveHud) hyperdriveHud.hidden = true;
  startScreen.hidden = false;
  gameState = 'start';
  updateLevelSelectUI();
}

function startDemoLevel5() {
  selectLevel(7);
  score = 0;
  resetLevel();
  ship.cargo = 1;
  missionTargetIndex = 1;
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
  if (level8ClanScreen) level8ClanScreen.hidden = true;
  if (level9StageScreen) level9StageScreen.hidden = true;
  if (level9ArrivalScreen) level9ArrivalScreen.hidden = true;
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
  if (level === 8) {
    return level8State.phase === 'calder' ? [currentLevel.stationA] : currentLevel.stations;
  }
  if (level === 9) {
    return level9State.phase === 'proteus' ? [currentLevel.proteusStation] : (targetStation ? [targetStation] : []);
  }
  return currentLevel.stations;
}

function getGravityWells(sourceLevel = currentLevel) {
  if (level === 8 && sourceLevel === currentLevel && level8State.phase !== 'ring') {
    return [];
  }
  if (level === 9 && sourceLevel === currentLevel && level9State.phase !== 'solas') {
    return [];
  }

  if (sourceLevel.moonWell && sourceLevel.moon) {
    sourceLevel.moonWell.x = sourceLevel.moon.x;
    sourceLevel.moonWell.y = sourceLevel.moon.y;
  }

  const wells = [];
  if (sourceLevel.well) wells.push(sourceLevel.well);
  if (sourceLevel.moonWell) wells.push(sourceLevel.moonWell);
  return wells;
}

function getMissionStations() {
  if (level === 8) {
    return level8State.phase === 'calder' ? [currentLevel.stationA] : currentLevel.stations;
  }
  if (level === 9) {
    return level9State.phase === 'proteus' ? [currentLevel.proteusStation] : currentLevel.stations;
  }
  return currentLevel.stations;
}

function getOptionalDockStations() {
  return (currentLevel.optionalDockStations ?? [])
    .map(key => currentLevel[key])
    .filter(station => station && !station.optionalDockUsed);
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
    if (level === 8) {
      clearLevel8DepartureStationIfFar();
      updateLevel8Camera(cam, ship, {
        phase: level8State.phase,
        level: currentLevel,
        targetStation: level8State.cameraFocusStation ?? targetStation,
        departureStation: level8State.departureStation,
      }, canvas);
    } else if (level === 9) {
      updateLevel9Camera(cam, ship, {
        phase: level9State.phase,
        level: currentLevel,
        targetStation: level9State.cameraFocusStation ?? targetStation,
        revealStart: level9State.revealStart,
      }, canvas);
    } else {
      updateCamera(cam, ship, getStations());
    }

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

function clearLevel8DepartureStationIfFar() {
  const station = level8State.departureStation;
  if (!station) return;

  const dist = Math.hypot(ship.x - station.x, ship.y - station.y);
  if (dist > 1800) level8State.departureStation = null;
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

  updateDynamicLevelBodies(dt);
  updatePhysics(ship, flags, dt, getGravityWells());
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

    setTutorialStationVisible(tut, isWorldPointOnScreen(targetStation.x, targetStation.y, cam, canvas));
    setTutorialArrowTarget(tut, targetStation);
  }

  if (getGravityWells().length > 0) {
    updateGravityHazards(now);
    updateGravityTrajectoryPrediction();
  }

  if (currentLevel.asteroids) {
    updateAsteroidHazards();
    updateAsteroidTrajectoryPrediction();
  }

  if (level === 8) {
    updateLevel8Systems(dt);
  }
  if (level === 9) {
    updateLevel9Systems(performance.now());
  }
}

function updateDynamicLevelBodies(dt) {
  if (level === 6) {
    updateOrbitingMoon(currentLevel.moon, dt);
    currentLevel.planet.rotation += 0.00008 * dt;
  }

  if (level === 7) {
    updateOrbitingStation(currentLevel.stationB, dt);
    currentLevel.planet.rotation += 0.00012 * dt;
  }

  if (level === 8 && level8State.phase === 'calder') {
    updateOrbitingStation(currentLevel.stationA, dt);
    currentLevel.calderPlanet.rotation += 0.00012 * dt;
  }

  if (level === 8 && level8State.phase === 'ring') {
    for (const station of currentLevel.stations) {
      if (station.orbiting) updateOrbitingStation(station, dt);
    }
  }

  if (level === 9 && level9State.phase === 'solas') {
    // Ein Komplex-Objekt, immer aktualisiert → stabile Position im Orbit
    updateOrbitingStation(currentLevel.stationComplex, dt);
    currentLevel.planet.rotation += 0.00012 * dt;
  }

  if (level === 9 && level9State.phase === 'proteus') {
    updateOrbitingStation(currentLevel.proteusStation, dt);
    currentLevel.proteusPlanet.rotation += 0.00012 * dt;
  }
}

function updateLevel8Systems(dt) {
  if (level8State.phase === 'calder') {
    const portal = currentLevel.portal;
    const dx = ship.x - portal.x;
    const dy = ship.y - portal.y;
    if (dx * dx + dy * dy <= portal.radius * portal.radius) {
      enterLevel8RingSystem();
    }
    return;
  }

  if (level8State.hintTimer > 0) {
    level8State.hintTimer = Math.max(0, level8State.hintTimer - dt);
  }
}

function updateLevel9Systems(now) {
  if (level !== 9) return;

  if (level9State.phase === 'solas') {
    updateSolasDockWindow(now);
    updateSolasStationCollision();
    return;
  }

  if (level9State.phase !== 'proteus') return;

  const dist = Math.hypot(ship.x - currentLevel.proteusStation.x, ship.y - currentLevel.proteusStation.y);

  if (!level9State.hyperdriveTriggered) {
    if (dist >= 2800) { // L9_HYPERDRIVE_TRIGGER_RADIUS
      hyperdriveHud.hidden = false;
    } else {
      hyperdriveHud.hidden = true;
    }
  } else {
    // Hyperdrive sequence running
    if (now - level9State.whiteoutStart > 1800) { // L9_WHITEOUT_DURATION_MS
      enterLevel9SolasSystem();
    }
  }
}

function updateSolasDockWindow(now) {
  const port = currentLevel.dockPorts[level9State.portIndex];
  const config = currentLevel.dockWindow;
  const elapsed = Math.max(0, now - level9State.windowCycleStart) % config.cycleMs;
  const openStart = config.warningMs;
  const openEnd = openStart + port.openMs;

  if (elapsed < openStart) {
    level9State.windowPhase = 'warning';
    level9State.windowRemainingMs = openStart - elapsed;
  } else if (elapsed < openEnd) {
    level9State.windowPhase = 'open';
    level9State.windowRemainingMs = openEnd - elapsed;
  } else {
    level9State.windowPhase = 'closed';
    level9State.windowRemainingMs = config.cycleMs - elapsed + openStart;
  }

  currentLevel.stationComplex.dockWindowOpen = level9State.windowPhase === 'open';
}

function updateSolasStationCollision() {
  if (ship.dockedTimer > 0 || gameState !== 'playing') return;
  const station = currentLevel.stationComplex;
  const orientation = station.orbitAngle + Math.PI / 2;
  const cos = Math.cos(orientation);
  const sin = Math.sin(orientation);

  for (const zone of currentLevel.stationCollisionZones) {
    const zoneX = station.x + zone.x * cos - zone.y * sin;
    const zoneY = station.y + zone.x * sin + zone.y * cos;
    if (Math.hypot(ship.x - zoneX, ship.y - zoneY) < zone.radius + 10) {
      crashAtSolasStation();
      return;
    }
  }
}

function crashAtSolasStation() {
  spawnExplosion(ship.x, ship.y);
  gameState = 'crashed';
  freezeShipInput();
  setTimeout(restoreSolasCheckpoint, 1200);
}

function restoreSolasCheckpoint() {
  particles = [];
  const station = currentLevel.stationComplex;
  if (level9State.lastDockIndex < 0) {
    const start = currentLevel.phaseBStart;
    Object.assign(ship, { x: start.x, y: start.y, vx: start.vx, vy: start.vy, angle: start.angle, targetAngle: start.angle });
  } else {
    const checkpointPort = currentLevel.dockPorts[level9State.lastDockIndex];
    const angle = station.orbitAngle + Math.PI / 2 + checkpointPort.angle;
    const safeDistance = checkpointPort.distance + 75;
    ship.x = station.x + Math.cos(angle) * safeDistance;
    ship.y = station.y + Math.sin(angle) * safeDistance;
    ship.vx = station.vx;
    ship.vy = station.vy;
    ship.angle = angle + Math.PI;
    ship.targetAngle = ship.angle;
  }
  ship.angularVel = 0;
  ship.dockedTimer = 0;
  ship.dockedStation = null;
  station.docked = false;
  resetTrajectoryState();
  syncRenderStates();
  resumeGameplay();
}

function triggerHyperdrive() {
  level9State.hyperdriveTriggered = true;
  level9State.whiteoutStart = performance.now();
  hyperdriveHud.hidden = true;
}

function enterLevel9SolasSystem() {
  level9State.phase = 'solas';
  level9State.hyperdriveTriggered = false;
  level9State.cameraFocusStation = null;

  const start = currentLevel.phaseBStart;
  ship.x = start.x;
  ship.y = start.y;
  ship.vx = start.vx;
  ship.vy = start.vy;
  ship.angle = start.angle;
  ship.targetAngle = start.angle;
  ship.angularVel = 0;
  ship.fuel = currentLevel.fuelStart ?? FUEL_START;
  ship.cargo = 1;
  ship.dockedTimer = 0;
  ship.dockedStation = null;
  ship.thrustHeld = false;
  ship.tapThrustTime = 0;
  ship.pendingBrakeImpulse = false;

  missionTargetIndex = 0;
  level9State.portIndex = 0;
  level9State.lastDockIndex = -1;
  level9State.revealStart = 0;
  activateSolasDockPort(0);
  resetSolasDockWindow();
  currentLevel.stationComplex.docked = false;
  targetStation = currentLevel.stationComplex;
  resetCameraState();

  // Solas-Ankunfts-Briefing anzeigen
  gameState = 'storyOverlay';
  if (level9ArrivalScreen) level9ArrivalScreen.hidden = false;
}

function enterLevel8RingSystem() {
  level8State.phase = 'ring';
  level8State.hintTimer = 360;
  level8State.departureStation = null;
  level8State.cameraFocusStation = null;

  const start = currentLevel.phaseBStart;
  ship.x = start.x;
  ship.y = start.y;
  ship.vx = start.vx;
  ship.vy = start.vy;
  ship.angle = start.angle;
  ship.targetAngle = start.angle;
  ship.angularVel = 0;
  ship.fuel = currentLevel.fuelStart ?? FUEL_START;
  ship.cargo = 1;
  ship.dockedTimer = 0;
  ship.dockedStation = null;
  ship.thrustHeld = false;
  ship.tapThrustTime = 0;
  ship.pendingBrakeImpulse = false;

  missionTargetIndex = 0;
  targetStation = getMissionStations()[0];
  resetCameraState();
  resetTrajectoryState();
  syncRenderStates();
}

function updateGravityHazards(now) {
  isInDanger = false;

  for (const well of getGravityWells()) {
    if (!checkWellCollision(ship, well)) continue;

    if (well.isBlackHole) {
      blackHoleCrashReset(now, well);
    } else {
      crashReset();
    }
    return;
  }

  for (const well of getGravityWells()) {
    // Bei Planeten und Monden keine Ereignishorizont-Vignette.
    if (well.isPlanet || well.isMoon) continue;

    const dist = Math.hypot(well.x - ship.x, well.y - ship.y);
    const dangerLimit = well.isBlackHole ? EVENT_HORIZON * 1.5 : EVENT_HORIZON;
    if (dist >= dangerLimit) continue;

    isInDanger = true;
    eventHorizonPulse = 0.5 + 0.5 * Math.sin(now / 150);
    return;
  }
}

function blackHoleCrashReset(now, well = currentLevel.well) {
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
    targetX: well.x,
    targetY: well.y,
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
  trajValidSteps = predictTrajectory(ship, getGravityWells(), TRAJ_STEPS, trajX, trajY);
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
  if (level === 8 && level8State.phase !== 'ring') return;
  if (level === 9 && level9State.phase !== 'solas') return;

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
  const easedT = easeOut(t);

  advanceOrbitingStationDuringApproach(dockingApproach.station, dt);
  interpolateShipToDockPort(dockingApproach, easedT);

  if (t >= 1) finalizeDockingApproach();
}

/** Ease-out-Kurve: f(t) = t*(2-t) */
function easeOut(t) {
  return t * (2 - t);
}

/** Bewegt eine orbitierende Station während des Anflugs weiter. */
function advanceOrbitingStationDuringApproach(station, dt) {
  if (station.orbiting) updateOrbitingStation(station, dt);
}

/** Interpoliert Position und Winkel des Schiffs zum Docking-Port. */
function interpolateShipToDockPort(approach, easedT) {
  const port = getPortPosition(approach.station);
  const targetAngle = normalizeAngle(approach.station.dockAngle + Math.PI);
  ship.x = lerp(approach.startX, port.x, easedT);
  ship.y = lerp(approach.startY, port.y, easedT);
  ship.angle = interpolateAngle(approach.startAngle, targetAngle, easedT);
  ship.targetAngle = ship.angle;
  ship.vx = 0;
  ship.vy = 0;
  ship.angularVel = 0;
}

/** Schließt den Andock-Anflug ab: setzt State zurück und löst Docking aus. */
function finalizeDockingApproach() {
  gameState = 'playing';
  const st = dockingApproach.station;
  dockingApproach = null;
  handleDocking(ship, st);
}

function getDockableTargetStation() {
  const check = checkDock(ship, targetStation);
  if (dockColor(check) === 'green') return targetStation;

  for (const station of getOptionalDockStations()) {
    const optionalCheck = checkDock(ship, station);
    if (dockColor(optionalCheck) === 'green') return station;
  }

  return null;
}

function renderFrame(alpha = 1) {
  prepareRenderState(alpha);

  if (gameState === 'blackout') {
    renderer.clear(ctx, canvas);
    return;
  }

  const wells = getGravityWells();
  const asteroids = currentLevel.asteroids;
  const stationB = currentLevel.stationB;

  drawWorldBackground(wells, asteroids, stationB);
  const stationRenderState = drawStations(getStations());
  drawTrajectoryPreview(wells, asteroids);

  if (gameState === 'blackHoleCollapse' && blackHoleCollapse) {
    drawBlackHoleCollapse();
    return;
  }

  drawShipAndMotion();
  drawHudAndOverlays(wells, stationB, stationRenderState);
}

function drawWorldBackground(wells, asteroids, stationB) {
  renderer.clear(ctx, canvas);
  const warpState = level === 9 && level9State.hyperdriveTriggered
    ? {
        progress: (performance.now() - level9State.whiteoutStart) / L9_WHITEOUT_DURATION_MS,
        angle: renderShip.angle,
      }
    : null;
  renderer.drawStars(ctx, stars, renderCam, canvas, warpState);

  if (level === 6 && currentLevel.planet) {
    renderer.drawGasPlanet(ctx, currentLevel.planet, renderCam, canvas);
    if (currentLevel.moon) {
      renderer.drawMoon(ctx, currentLevel.moon, renderCam, canvas);
    }
  }

  if (level === 7 && currentLevel.planet) {
    renderer.drawPlanet(ctx, currentLevel.planet, renderCam, canvas);
  }

  if (level === 8 && level8State.phase === 'calder') {
    renderer.drawPlanet(ctx, currentLevel.calderPlanet, renderCam, canvas);
    renderer.drawPortal(ctx, currentLevel.portal, renderCam, canvas);
  }

  if (level === 8 && level8State.phase === 'ring' && currentLevel.planet) {
    renderer.drawRingPlanet(ctx, currentLevel.planet, renderCam, canvas);
  }

  if (level === 9 && level9State.phase === 'solas' && currentLevel.planet) {
    renderer.drawSolasPlanet(ctx, currentLevel.planet, renderCam, canvas);
  }

  if (level === 9 && level9State.phase === 'proteus' && currentLevel.proteusPlanet) {
    renderer.drawRingPlanet(ctx, currentLevel.proteusPlanet, renderCam, canvas);
  }

  for (const well of wells) {
    if (!well.isPlanet && !well.isMoon) {
      renderer.drawGravityWell(ctx, well, renderCam, canvas, EVENT_HORIZON);
    }
  }

  if (level === 7 && currentLevel.planet) {
    const orbitStatus = getOrbitStatus(renderShip, currentLevel.planet);
    renderer.drawOrbitGuide(ctx, currentLevel.planet, renderShip, stationB, ORBIT_STATION_RADIUS, renderCam, canvas, orbitStatus);
  }

  if (level === 8 && level8State.phase === 'ring' && currentLevel.planet) {
    drawLevel8OrbitGuides();
  }

  if (level === 9 && level9State.phase === 'solas' && currentLevel.planet) {
    drawOrbitGuideForTarget();
  }

  if (level === 8 && level8State.phase === 'calder' && currentLevel.calderPlanet) {
    renderer.drawOrbitGuide(
      ctx,
      currentLevel.calderPlanet,
      renderShip,
      currentLevel.stationA,
      ORBIT_STATION_RADIUS,
      renderCam,
      canvas,
      { orbitOk: false, radialSpeed: 0, tangentialError: 0 }
    );
  }

  if (asteroids && !currentLevel.debrisField) {
    renderer.drawAsteroids(ctx, asteroids, renderCam, canvas, trajHitAsteroid);
  }

  if (asteroids && currentLevel.debrisField) {
    renderer.drawDebrisField(ctx, asteroids, renderCam, canvas, trajHitAsteroid);
  }
}

function drawStations(stations) {
  return stations.map(station => {
    const check = checkDock(ship, station);
    const color = dockColor(check);
    renderer.drawStation(ctx, station, renderCam, canvas, color);
    if (level === 9 && level9State.phase === 'solas' && station === currentLevel.stationComplex) {
      renderer.drawSolasCollisionGuides(
        ctx,
        station,
        currentLevel.stationCollisionZones,
        renderShip,
        renderCam,
        canvas
      );
    }
    return { station, check, color };
  });
}

function drawLevel8OrbitGuides() {
  for (const station of currentLevel.stations) {
    const orbitStatus = station === targetStation
      ? getOrbitStatusForRadius(renderShip, currentLevel.planet, station.orbitRadius, station.orbitSpeed)
      : { orbitOk: false, radialSpeed: 0, tangentialError: 0 };
    renderer.drawOrbitGuide(ctx, currentLevel.planet, renderShip, station, station.orbitRadius, renderCam, canvas, orbitStatus);
  }
}

function drawOrbitGuideForTarget() {
  if (!targetStation?.orbiting) return;
  const orbitStatus = getOrbitStatusForRadius(renderShip, currentLevel.planet, targetStation.orbitRadius, targetStation.orbitSpeed);
  renderer.drawOrbitGuide(ctx, currentLevel.planet, renderShip, targetStation, targetStation.orbitRadius, renderCam, canvas, orbitStatus);
}

function drawTrajectoryPreview(wells, asteroids) {
  if (wells.length > 0 && trajValidSteps > 1) {
    const hitWell = trajValidSteps < TRAJ_STEPS ? findTrajectoryHitWell(wells) : null;
    const planetWell = wells.find(well => well.isPlanet);
    const willHitPlanet = Boolean(hitWell?.isPlanet);
    renderer.drawTrajectory(ctx, trajX, trajY, trajValidSteps, renderCam, canvas, isInDanger || willHitPlanet);
    if (planetWell) {
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

function findTrajectoryHitWell(wells) {
  const hitX = trajX[trajValidSteps];
  const hitY = trajY[trajValidSteps];
  return wells.find(well => {
    const dx = hitX - well.x;
    const dy = hitY - well.y;
    return dx * dx + dy * dy <= well.wellRadius * well.wellRadius;
  }) ?? null;
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

function drawHudAndOverlays(wells, stationB, stationRenderState) {
  if (wells.length > 0 && isInDanger) {
    renderer.drawEventHorizonWarning(ctx, canvas, eventHorizonPulse);
  }

  const targetRenderState = stationRenderState.find(state => state.station === targetStation);
  const portalCheck = getLevel8PortalHudCheck();
  const targetCheck = portalCheck ?? (targetStation ? (targetRenderState?.check ?? checkDock(ship, targetStation)) : null);
  const targetColor = portalCheck ? '#78d8ff' : (targetRenderState?.color ?? dockColor(targetCheck));
  const dockAngleDiff = portalCheck ? 0 : (targetStation ? computeDockAngleDiff(ship, targetStation) : 0);
  renderer.drawHud(ctx, ship, canvas, targetCheck, score, targetColor, level, dockAngleDiff, currentLevel.fuelStart ?? FUEL_START);
  drawNavigationMarkers();

  if (level === 2) {
    renderer.drawFuelRangeHud(ctx, canvas, computeFuelRangeHudData(renderShip, targetStation));
  }

  if (level === 6) {
    const slingshotStatus = getSlingshotStatus(ship, currentLevel.well, trajX, trajY, trajValidSteps);
    const slingshotHudData = computeSlingshotHudData(slingshotStatus);
    renderer.drawSlingshotHud(ctx, canvas, slingshotHudData);
  }

  if (level === 7) {
    const orbitHudData = computeOrbitHudData(renderShip, stationB, currentLevel.planet);
    renderer.drawOrbitHud(ctx, canvas, orbitHudData);
  }

  if (level === 8 && level8State.phase === 'ring') {
    drawOrbitHudForTarget();
    if (level8State.hintTimer > 0) {
      renderer.drawLevel8Hint(ctx, canvas);
    }
  }

  if (level === 9 && level9State.phase === 'solas') {
    drawOrbitHudForTarget();
    renderer.drawSolasWindowHud(ctx, canvas, {
      label: currentLevel.dockPorts[level9State.portIndex].label,
      phase: level9State.windowPhase,
      remainingMs: level9State.windowRemainingMs,
    });
  }

  if (level === 9 && level9State.hyperdriveTriggered) {
    renderer.drawHyperdriveWhiteout(ctx, canvas, performance.now() - level9State.whiteoutStart, L9_WHITEOUT_DURATION_MS);
  }

  if (level === 1) drawTutorial(ctx, canvas, tut, renderShip, flags, renderCam);
}

function drawOrbitHudForTarget() {
  const orbitHudData = computeOrbitHudDataForTarget(renderShip, targetStation, currentLevel.planet);
  renderer.drawOrbitHud(ctx, canvas, orbitHudData);
}

function getLevel8PortalHudCheck() {
  if (level !== 8 || level8State.phase !== 'calder') return null;
  const portal = currentLevel.portal;
  const dx = portal.x - ship.x;
  const dy = portal.y - ship.y;
  return {
    posOk: false,
    speedOk: false,
    angleOk: false,
    dist: Math.hypot(dx, dy),
    relSpeed: Math.hypot(ship.vx, ship.vy),
  };
}

function drawNavigationMarkers() {
  if (level === 8 && level8State.phase === 'calder') {
    renderer.drawTargetArrow(ctx, renderShip, currentLevel.portal, renderCam, canvas, {
      color: '#78d8ff',
      glow: 'rgba(120, 216, 255, 0.32)',
      labelColor: '#bfeeff',
    });
    return;
  }

  if (level === 9 && level9State.phase === 'proteus' && !level9State.hyperdriveTriggered) {
    const dist = Math.hypot(
      renderShip.x - currentLevel.proteusStation.x,
      renderShip.y - currentLevel.proteusStation.y
    );
    if (dist >= L9_HYPERDRIVE_TRIGGER_RADIUS) return;
    // Pfeil Richtung "Solas" — weg vom Proteus-System (nach links/oben)
    const solasWaypoint = { x: -2000, y: -2000 };
    renderer.drawTargetArrow(ctx, renderShip, solasWaypoint, renderCam, canvas, {
      color: '#8fb0ff',
      glow: 'rgba(143, 176, 255, 0.32)',
      labelColor: '#c2d4ff',
      showDistance: false,
    });
    return;
  }

  if (targetStation && level !== 9) {
    renderer.drawTargetArrow(ctx, renderShip, targetStation, renderCam, canvas);
  }

  if (level === 8 && level8State.phase === 'ring') {
    renderer.drawTargetArrow(ctx, renderShip, currentLevel.planet, renderCam, canvas, {
      color: '#f0c47a',
      glow: 'rgba(240, 196, 122, 0.24)',
      labelColor: '#f3d69a',
    });
  }

  if (level === 9 && level9State.phase === 'solas') {
    const activePort = getPortPosition(currentLevel.stationComplex);
    renderer.drawTargetArrow(ctx, renderShip, activePort, renderCam, canvas, {
      color: currentLevel.stationComplex.dockWindowOpen ? '#76f0b0' : '#8fb9df',
      glow: 'rgba(118, 240, 176, 0.28)',
      labelColor: '#c7f7df',
    });
    renderer.drawTargetArrow(ctx, renderShip, currentLevel.planet, renderCam, canvas, {
      color: '#8fb0ff',
      glow: 'rgba(143, 176, 255, 0.24)',
      labelColor: '#c2d4ff',
    });
  }
}

/**
 * Berechnet die Winkeldifferenz zwischen Schiffausrichtung und
 * dem optimalen Andockwinkel der Zielstation — in Grad (0–180).
 * Trennt die Physikberechnung von der HUD-Darstellung.
 */
function computeDockAngleDiff(sourceShip, station) {
  const targetApproachAngle = station.dockAngle + Math.PI;
  const angleDiffDeg = Math.floor(Math.abs(sourceShip.angle - targetApproachAngle) * (180 / Math.PI)) % 360;
  return angleDiffDeg > 180 ? 360 - angleDiffDeg : angleDiffDeg;
}

function computeFuelRangeHudData(sourceShip, station) {
  const distance = Math.hypot(station.x - sourceShip.x, station.y - sourceShip.y);
  const speed = Math.hypot(sourceShip.vx, sourceShip.vy);
  const brakingFuel = (speed / THRUST_MAIN) * FUEL_MAIN;
  const routeFuel = distance * 0.035;
  const reserve = sourceShip.fuel - brakingFuel - routeFuel;

  let color = '#88ff88';
  let label = 'Reserve OK';
  if (reserve < 0) {
    color = '#ff7744';
    label = 'zu knapp';
  } else if (reserve < 18) {
    color = '#ffdd44';
    label = 'knapp';
  }

  return {
    distance,
    reserve,
    color,
    label,
  };
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

function getOrbitStatusForRadius(sourceShip, planet, orbitRadius, orbitSpeed) {
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
  const radiusError = radius - orbitRadius;
  const tangentialError = tangentialSpeed - orbitRadius * orbitSpeed;
  const orbitOk = Math.abs(radiusError) <= ORBIT_TOLERANCE
    && Math.abs(radialSpeed) <= ORBIT_RADIAL_SPEED_OK
    && Math.abs(tangentialError) <= ORBIT_TANGENTIAL_SPEED_OK;

  return { orbitOk, radialSpeed, tangentialError };
}

/**
 * Klassifiziert den Closest-Approach-Wert in Farbe + Label.
 * Trennt die Entscheidungslogik vom Renderer.
 */
function classifyClosestApproach(ca) {
  if (ca < 0)   return { color: '#ff4444', label: 'KOLLISION' };
  if (ca < 80)  return { color: '#ff8844', label: Math.round(ca) + ' px — zu nah!' };
  if (ca < 200) return { color: '#ffdd44', label: Math.round(ca) + ' px — eng' };
  if (ca < 500) return { color: '#88ff88', label: Math.round(ca) + ' px — gut' };
  return { color: '#6f8fa8', label: Math.round(ca) + ' px — zu weit' };
}

/**
 * Klassifiziert die Fluggeschwindigkeit in eine Statusfarbe.
 */
function classifySlingshotSpeed(speed) {
  if (speed > 2.5) return '#88ff88';
  if (speed > 1.2) return '#ffdd44';
  return '#ff7744';
}

/**
 * Berechnet alle Anzeigedaten für das Slingshot-HUD (Level 6).
 * Der Renderer erhält ein fertiges Datenobjekt und enthält keine if/else-Logik.
 */
function computeSlingshotHudData(status) {
  const approach = classifyClosestApproach(status.closestApproach);
  const speedColor = classifySlingshotSpeed(status.speed);
  const dotColor = approach.color;
  return {
    hasTrajectory: status.hasTrajectory,
    caColor: approach.color,
    caLabel: approach.label,
    speed: status.speed,
    speedColor,
    dotColor,
  };
}

/**
 * Berechnet alle Anzeigedaten für das Orbit-HUD (Level 7).
 * Trennt die Physikberechnung vom Renderer — drawOrbitHud() erhält
 * nur noch ein fertiges Datenobjekt und muss keine Physik berechnen.
 */
function computeOrbitHudData(sourceShip, station, planet) {
  if (!station || !station.orbiting) return null;

  const relVx = sourceShip.vx - station.vx;
  const relVy = sourceShip.vy - station.vy;
  const deltaV = Math.hypot(relVx, relVy);

  const dx = sourceShip.x - planet.x;
  const dy = sourceShip.y - planet.y;
  const radius = Math.hypot(dx, dy);
  const invRadius = radius > 0 ? 1 / radius : 0;
  const ux = dx * invRadius;
  const uy = dy * invRadius;
  const radialSpeed = sourceShip.vx * ux + sourceShip.vy * uy;
  const tangentialSpeed = sourceShip.vx * -uy + sourceShip.vy * ux;
  const radiusError = radius - ORBIT_STATION_RADIUS;
  const tangentialError = tangentialSpeed - ORBIT_STATION_RADIUS * ORBIT_STATION_SPEED;

  const heightOk = Math.abs(radiusError) <= ORBIT_TOLERANCE;
  const radialOk = Math.abs(radialSpeed) <= ORBIT_RADIAL_SPEED_OK;
  const tangentOk = Math.abs(tangentialError) <= ORBIT_TANGENTIAL_SPEED_OK;
  const orbitOk = heightOk && radialOk && tangentOk;

  return { deltaV, radiusError, radialSpeed, tangentialError, heightOk, radialOk, tangentOk, orbitOk };
}

function computeOrbitHudDataForTarget(sourceShip, station, planet) {
  if (!station?.orbiting) return null;

  const relVx = sourceShip.vx - station.vx;
  const relVy = sourceShip.vy - station.vy;
  const deltaV = Math.hypot(relVx, relVy);
  const status = getOrbitStatusForRadius(sourceShip, planet, station.orbitRadius, station.orbitSpeed);
  const dx = sourceShip.x - planet.x;
  const dy = sourceShip.y - planet.y;
  const radius = Math.hypot(dx, dy);
  const radiusError = radius - station.orbitRadius;

  return {
    deltaV,
    radiusError,
    radialSpeed: status.radialSpeed,
    tangentialError: status.tangentialError,
    heightOk: Math.abs(radiusError) <= ORBIT_TOLERANCE,
    radialOk: Math.abs(status.radialSpeed) <= ORBIT_RADIAL_SPEED_OK,
    tangentOk: Math.abs(status.tangentialError) <= ORBIT_TANGENTIAL_SPEED_OK,
    orbitOk: status.orbitOk,
  };
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

  const { minI, maxI, minR, maxR } = findApsides(trajX, trajY, trajValidSteps, currentLevel.planet.x, currentLevel.planet.y);

  orbitAssist.periapsis = createApsisMarker(minI, 'PE');
  orbitAssist.apoapsis = createApsisMarker(maxI, 'AP');

  const assistOrbitRadius = getCurrentOrbitAssistRadius();
  const assistOrbitSpeed = getCurrentOrbitAssistSpeed();
  const orbitStatus = assistOrbitRadius && assistOrbitSpeed
    ? getOrbitStatusForRadius(ship, currentLevel.planet, assistOrbitRadius, assistOrbitSpeed)
    : getOrbitStatus(ship, currentLevel.planet);
  orbitAssist.orbitOk = orbitStatus.orbitOk;
  if (orbitStatus.orbitOk) return;

  orbitAssist.burnHint = computeBurnHint(orbitStatus, minI, maxI, minR, maxR, assistOrbitRadius ?? ORBIT_STATION_RADIUS);
}

function getCurrentOrbitAssistRadius() {
  if (isOrbitingTargetInRingPhase()) return targetStation.orbitRadius;
  return ORBIT_STATION_RADIUS;
}

function getCurrentOrbitAssistSpeed() {
  if (isOrbitingTargetInRingPhase()) return targetStation.orbitSpeed;
  return ORBIT_STATION_SPEED;
}

function isOrbitingTargetInRingPhase() {
  if (!targetStation?.orbiting) return false;
  if (level === 8 && level8State.phase === 'ring') return true;
  if (level === 9 && level9State.phase === 'solas') return true;
  return false;
}

/** Durchsucht die Trajektorie nach Apoapsis und Periapsis. */
function findApsides(trajX, trajY, steps, planetX, planetY) {
  let minI = 0, maxI = 0, minR = Infinity, maxR = -Infinity;
  for (let i = 0; i < steps; i++) {
    const dx = trajX[i] - planetX;
    const dy = trajY[i] - planetY;
    const r = Math.hypot(dx, dy);
    if (r < minR) { minR = r; minI = i; }
    if (r > maxR) { maxR = r; maxI = i; }
  }
  return { minI, maxI, minR, maxR };
}

/** Entscheidet, wo der nächste Zündungs-Hint (Burn) platziert werden soll. */
function computeBurnHint(orbitStatus, minI, maxI, minR, maxR, targetRadius = ORBIT_STATION_RADIUS) {
  if (Math.abs(orbitStatus.radialSpeed) > ORBIT_RADIAL_SPEED_OK * 1.5) {
    const i = Math.abs(minR - targetRadius) < Math.abs(maxR - targetRadius) ? minI : maxI;
    return createApsisMarker(i, 'RADIAL');
  }
  return createApsisMarker(minR < targetRadius ? maxI : minI, 'TAN');
}

function createApsisMarker(index, label) {
  return { x: trajX[index], y: trajY[index], label };
}

function handleDocking(ship, station) {
  dockShipAtStation(ship, station);
  if (level === 8) {
    level8State.departureStation = station;
  }
  advanceMissionAfterDock(station);
  scheduleUndock(station);
}

function dockShipAtStation(ship, station) {
  const port = getPortPosition(station);
  ship.dockedTimer = 1500;
  if (level === 9 && level9State.phase === 'solas') {
    ship.fuel = Math.min(currentLevel.fuelStart, ship.fuel + currentLevel.dockRefuelAmount);
  } else {
    ship.fuel = currentLevel.fuelStart ?? FUEL_START;
  }
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

function advanceMissionAfterDock(station) {
  if (getOptionalDockStations().includes(station)) {
    station.optionalDockUsed = true;
    return;
  }

  if (level === 9 && level9State.phase === 'solas') {
    advanceSolasDockPort(station);
    return;
  }

  const missionStations = getMissionStations();
  const completedTargetIndex = missionTargetIndex;
  const isExpectedStation = station === missionStations[completedTargetIndex];
  if (!isExpectedStation) return;

  if (completedTargetIndex === 0) {
    ship.cargo = 1;
  }

  if (completedTargetIndex < missionStations.length - 1) {
    missionTargetIndex += 1;
    targetStation = missionStations[missionTargetIndex];
    if (level === 8 && level8State.phase === 'ring') {
      showLevel8ClanScreen(completedTargetIndex, false);
    }
    return;
  }

  ship.cargo = 0;
  score += 1;
  if (level === 8 && level8State.phase === 'ring') {
    showLevel8ClanScreen(completedTargetIndex, true);
    return;
  }
  completeLevel();
}

/**
 * Fortschritt am Solas-Komplex: Nach jedem Andocken wird der nächste
 * Docking-Port (an einer anderen Seite desselben Komplexes) aktiviert.
 */
function advanceSolasDockPort(station) {
  if (station !== currentLevel.stationComplex) return;

  const ports = currentLevel.dockPorts;
  const completedIndex = level9State.portIndex;
  level9State.lastDockIndex = completedIndex;

  if (completedIndex === 0) ship.cargo = 1;

  const isLastPort = completedIndex >= ports.length - 1;
  if (isLastPort) {
    ship.cargo = 0;
    score += 1;
    showLevel9StageScreen(completedIndex, true);
    return;
  }

  showLevel9StageScreen(completedIndex, false);
}

function showLevel8ClanScreen(clanIndex, pendingFinal) {
  const copy = LEVEL8_CLAN_COPY[clanIndex];
  if (!copy || !level8ClanScreen) return;

  level8State.pendingFinal = pendingFinal;
  level8State.cameraFocusStation = getMissionStations()[clanIndex] ?? null;
  level8ClanEyebrow.textContent = copy.eyebrow;
  level8ClanTitle.textContent = copy.title;
  level8ClanMission.textContent = copy.mission;
  level8ClanContinueButton.textContent = copy.button;
  gameState = 'storyOverlay';
  level8ClanScreen.hidden = false;
}

function showLevel9StageScreen(stageIndex, pendingFinal) {
  const copy = LEVEL9_STAGE_COPY[stageIndex];
  if (!copy || !level9StageScreen) return;

  level9State.pendingFinal = pendingFinal;
  level9State.cameraFocusStation = currentLevel.stationComplex;
  level9StageEyebrow.textContent = copy.eyebrow;
  level9StageTitle.textContent = copy.title;
  level9StageMission.textContent = copy.mission;
  level9StageContinueButton.textContent = copy.button;
  level9StageScreen.classList.remove(
    'story-bg--solas-reception',
    'story-bg--solas-consultation',
    'story-bg--solas-chamber'
  );
  level9StageScreen.classList.add(copy.backgroundClass);
  gameState = 'storyOverlay';
  level9StageScreen.hidden = false;
}

function scheduleUndock(station) {
  setTimeout(() => {
    if (station.orbiting && ship.dockedStation === station) {
      ship.vx = station.vx;
      ship.vy = station.vy;
      ship.dockedTimer = 0;
    }
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
    showFinalScreen();
  } else {
    showLevelCompleteScreen();
  }
}

/** Zeigt das Final-Complete-Screen mit Verzögerung. */
function showFinalScreen() {
  setTimeout(() => {
    finalCompleteScreen.hidden = false;
  }, 800);
}

/** Zeigt den Level-Complete-Screen mit Verzögerung und Leveltext. */
function showLevelCompleteScreen() {
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
  const storyBgClasses = ['story-bg', 'story-bg--kestrel', 'story-bg--proteus', 'story-bg--solas'];

  eyebrow.textContent = copy.eyebrow;
  title.textContent = copy.title;
  mission.textContent = copy.mission;
  levelCompleteScreen.classList.remove(...storyBgClasses);
  if (copy.storyClass) {
    levelCompleteScreen.classList.add('story-bg', copy.storyClass);
  }
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
      title: 'Relay-Kette abgeschlossen',
      mission: 'Du hast den Tank diszipliniert genutzt und die Lieferung über mehrere Stationen gebracht.',
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
      title: 'Ereignishorizont gemieden',
      mission: 'Du hast die Trajektorie gelesen, den Swing-by kontrolliert und die Fracht sicher geliefert.',
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
      mission: 'Das Manöver hat geklappt — Gasriese und Mond haben dich auf Kurs gebracht.',
      nextLevelLabel: 'Nächstes Level',
    };
  }

  if (completedLevel === 7) {
    return {
      eyebrow: 'Erstkontakt',
      title: 'Kestrel',
      mission: 'Andocken erfolgreich. Die Luke öffnet sich - aber dahinter ist keine Crew.\n\nWas dich erwartet, hat keine feste Gestalt. Es verschiebt sich, Licht und Kristall, nie zweimal dasselbe - als hätte es sich noch nicht entschieden, wie es aussehen will. Acht Jahre lang hat es von dieser einen Station aus die Menschheit beobachtet, leise genug, um nicht zu stören. Du stehst da, Helm in der Hand, und merkst, dass du den Atem anhältst.\n\nDann bewegt es sich - nicht auf dich zu, sondern zur Seite. Es macht Platz. Du verstehst.\n\nSie wollen reden. In deinem Logbuch tippst du einen Namen ein, weil du einen brauchst: Proteus.\n\nSie haben bereits entschieden, mit wem: mit dir. Nicht weil du dafür ausgebildet bist. Sondern weil du der Mensch bist, den sie kennen.',
      storyClass: 'story-bg--kestrel',
      nextLevelLabel: 'Nächstes Level',
    };
  }

  if (completedLevel === 8) {
    return {
      eyebrow: 'Level 8 abgeschlossen',
      title: 'Botschafter',
      mission: 'Drei Clans, drei Beziehungen, formell aufgenommen. Soweit du das beurteilen kannst, hast du niemanden beleidigt.',
      nextLevelLabel: 'Nächstes Level',
    };
  }

  if (completedLevel === 9) {
    return {
      eyebrow: 'Mission abgeschlossen',
      title: 'Solas',
      mission: 'Für einen Anfang reicht das.', // placeholder, handled by finalCompleteScreen
      nextLevelLabel: null,
    };
  }

  return null;
}

function resetLevel() {
  clearBlackHoleTimers();
  resetLevel8State();
  resetLevel9State();
  resetShipState();
  resetStationStates();
  resetTrajectoryState();
  resetCameraState();
  syncRenderStates();
}

function resetLevel8State() {
  if (level !== 8) return;
  level8State.phase = 'calder';
  level8State.hintTimer = 0;
  level8State.pendingFinal = false;
  level8State.cameraFocusStation = null;
  level8State.departureStation = currentLevel.stationA;
}

function resetLevel9State() {
  if (level !== 9) return;
  level9State.phase = 'proteus';
  level9State.hyperdriveTriggered = false;
  level9State.whiteoutStart = 0;
  level9State.pendingFinal = false;
  level9State.cameraFocusStation = null;
  level9State.portIndex = 0;
  level9State.lastDockIndex = -1;
  level9State.revealStart = 0;
  activateSolasDockPort(0);
  resetSolasDockWindow();
  if (hyperdriveHud) hyperdriveHud.hidden = true;
}

/** Bricht laufende Black-Hole-Animationen ab und räumt Timer auf. */
function clearBlackHoleTimers() {
  if (blackHoleCollapseTimer) {
    clearTimeout(blackHoleCollapseTimer);
    blackHoleCollapseTimer = null;
  }
  if (blackHoleResetTimer) {
    clearTimeout(blackHoleResetTimer);
    blackHoleResetTimer = null;
  }
  blackHoleCollapse = null;
}

/** Setzt alle Schiff-Properties auf den Level-Startzustand zurück. */
function resetShipState() {
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
}

/** Setzt Andockstatus und Startpositionen aller Stationen zurück. */
function resetStationStates() {
  let resetStations = currentLevel.stations;
  if (level === 8) {
    resetStations = [currentLevel.stationA, ...currentLevel.stations];
  } else if (level === 9) {
    resetStations = [currentLevel.proteusStation, ...currentLevel.stations];
  }

  for (const station of resetStations) {
    station.docked = false;
    station.optionalDockUsed = false;
  }

  // Bei orbitierenden Stationen: Startposition zurücksetzen
  for (const station of resetStations) {
    if (!station.orbiting) continue;
    station.orbitAngle = station.initialOrbitAngle ?? Math.PI * 1.25;
    updateOrbitingStation(station, 0);
  }

  missionTargetIndex = 0;
  if (level === 8 && level8State.phase === 'calder') {
    targetStation = currentLevel.stationA;
    level8State.departureStation = currentLevel.stationA;
    placeShipAtKestrelPort();
  } else if (level === 9 && level9State.phase === 'proteus') {
    targetStation = currentLevel.proteusStation;
    placeShipAtL9StartPort();
  } else {
    targetStation = getMissionStations()[missionTargetIndex];
  }
  dockingApproach = null;
}

function placeShipAtKestrelPort() {
  const station = currentLevel.stationA;
  placeShipAtStationPort(station);
}

function placeShipAtL9StartPort() {
  const station = currentLevel.proteusStation;
  placeShipAtStationPort(station);
}

function placeShipAtStationPort(station) {
  const port = getPortPosition(station);
  ship.x = port.x;
  ship.y = port.y;
  ship.vx = station.vx ?? 0;
  ship.vy = station.vy ?? 0;
  ship.angle = station.dockAngle + Math.PI;
  ship.targetAngle = ship.angle;
}

/** Setzt Trajektorie-Buffer, Orbit-Assist-Marker und Partikel zurück. */
function resetTrajectoryState() {
  isInDanger = false;
  trajValidSteps = 0;
  trajWillHitAsteroid = false;
  trajHitAsteroid = null;
  orbitAssist.periapsis = null;
  orbitAssist.apoapsis = null;
  orbitAssist.burnHint = null;
  orbitAssist.orbitOk = false;
  particles = [];
}

/** Setzt die Kamera auf die Schiffposition zurück. */
function resetCameraState() {
  cam.x = ship.x;
  cam.y = ship.y;
  cam.targetZoom = 1;
}

function crashReset() {
  spawnExplosion(ship.x, ship.y);
  gameState = 'crashed';
  freezeShipInput();
  setTimeout(restoreAfterCrash, 1200);
}

/** Stoppt alle Schiff-Input-Aktionen sofort. */
function freezeShipInput() {
  ship.pendingBrakeImpulse = false;
  ship.thrustHeld = false;
  ship.tapThrustTime = 0;
}

/** Stellt den Zustand nach einem Crash wieder her und setzt das Spiel fort. */
function restoreAfterCrash() {
  particles = [];
  resetLevel();
  if (demoMode.active) restoreDemoStateAfterCrash();
  resumeGameplay();
}

/** Stellt Demo-spezifischen Zustand nach Crash wieder her. */
function restoreDemoStateAfterCrash() {
  ship.cargo = 1;
  missionTargetIndex = 1;
  targetStation = currentLevel.stationB;
  setDemoPhase('transfer');
}

/** Setzt den Gameplay-Zustand und Timer zurück. */
function resumeGameplay() {
  gameState = 'playing';
  last = performance.now();
}

const nextLevelButton = document.getElementById('nextLevelButton');
if (nextLevelButton) {
  nextLevelButton.addEventListener('click', () => {
    const nextLevel = Math.min(level + 1, TOTAL_LEVELS);
    selectLevel(nextLevel);
    score = 0;
    resetLevel();
    levelCompleteScreen.hidden = true;
    if (level8ClanScreen) level8ClanScreen.hidden = true;
    if (level9StageScreen) level9StageScreen.hidden = true;
  if (level9ArrivalScreen) level9ArrivalScreen.hidden = true;
    showLevelIntroOrStart(nextLevel);
    last = performance.now();
  });
}

if (level8ClanContinueButton) {
  level8ClanContinueButton.addEventListener('click', () => {
    level8ClanScreen.hidden = true;

    if (level8State.pendingFinal) {
      level8State.pendingFinal = false;
      completeLevel();
      return;
    }

    level8State.cameraFocusStation = null;
    resumeGameplay();
  });
}

if (level9StageContinueButton) {
  level9StageContinueButton.addEventListener('click', () => {
    level9StageScreen.hidden = true;

    if (level9State.pendingFinal) {
      level9State.pendingFinal = false;
      completeLevel();
      return;
    }

    activateNextSolasDockPort();
    level9State.cameraFocusStation = null;
    resumeGameplay();
  });
}

/** Aktiviert den nächsten Docking-Port am Solas-Komplex. */
function activateNextSolasDockPort() {
  const ports = currentLevel.dockPorts;
  level9State.portIndex += 1;
  activateSolasDockPort(level9State.portIndex);
  resetSolasDockWindow();
  currentLevel.stationComplex.docked = false;
  ship.dockedStation = null;
}

function activateSolasDockPort(index) {
  const complex = currentLevel.stationComplex;
  const port = currentLevel.dockPorts[index];
  complex.activeDockPort = port;
  complex.dockAngleOffset = port.angle;
  complex.dockRules = {
    maxSpeed: port.maxSpeed,
    angleTolerance: port.angleTolerance,
  };
  updateOrbitingStation(complex, 0);
}

function resetSolasDockWindow() {
  level9State.windowCycleStart = performance.now();
  level9State.windowPhase = 'warning';
  level9State.windowRemainingMs = currentLevel.dockWindow.warningMs;
  currentLevel.stationComplex.dockWindowOpen = false;
}

if (level9ArrivalContinueButton) {
  level9ArrivalContinueButton.addEventListener('click', () => {
    level9ArrivalScreen.hidden = true;
    level9State.revealStart = performance.now();
    resumeGameplay();
  });
}

function showLevelIntroOrStart(targetLevel) {
  const intro = document.getElementById(`level${targetLevel}StartScreen`);
  if (intro) {
    gameState = 'start';
    intro.hidden = false;
    return;
  }

  beginGameplay();
}

const level1StartButton = document.getElementById('level1StartButton');
if (level1StartButton) {
  level1StartButton.addEventListener('click', () => {
    document.getElementById('level1StartScreen').hidden = true;
    beginGameplay();
  });
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

const level4StartButton = document.getElementById('level4StartButton');
if (level4StartButton) {
  level4StartButton.addEventListener('click', () => {
    document.getElementById('level4StartScreen').hidden = true;
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

const level8StartButton = document.getElementById('level8StartButton');
if (level8StartButton) {
  level8StartButton.addEventListener('click', () => {
    document.getElementById('level8StartScreen').hidden = true;
    beginGameplay();
  });
}

const level9StartButton = document.getElementById('level9StartButton');
if (level9StartButton) {
  level9StartButton.addEventListener('click', () => {
    document.getElementById('level9StartScreen').hidden = true;
    beginGameplay();
  });
}

muteButton.textContent = isMuted() ? 'Ton aus' : 'Ton an';
loop();
