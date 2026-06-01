import { createShip } from './ship.js';
import { createCamera, updateCamera } from './camera.js';
import { createInputFlags, setupDesktopInput } from './input-desktop.js';
import { setupMobileInput } from './input-mobile.js';
import { updatePhysics } from './physics.js';
import { createStation, checkDock, dockColor, getPortPosition } from './station.js';
import * as renderer from './renderer.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from './constants.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = Math.floor(window.innerWidth * devicePixelRatio);
  canvas.height = Math.floor(window.innerHeight * devicePixelRatio);
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const ship = createShip(200, 200);
const cam = createCamera(ship.x, ship.y);
const flags = createInputFlags();
setupDesktopInput(flags);
setupMobileInput(flags, canvas, cam, ship);

const stationA = createStation(200, 1200, 0); // Arm points right (toward B)
const stationB = createStation(1800, 300, Math.PI); // Arm points left (toward A)

let score = 0;
let targetStation = stationA; // start by going to A to pick up

// stars
const stars = [];
for (let i=0;i<200;i++) stars.push({ x: Math.random()*WORLD_WIDTH, y: Math.random()*WORLD_HEIGHT });

let last = performance.now();

function loop() {
  const now = performance.now();
  const dt = Math.min(32, now - last) / 16.6667; // ~frames normalized to 60fps
  last = now;

  updatePhysics(ship, flags, dt);
  updateCamera(cam, ship, [stationA, stationB]);

  renderer.clear(ctx, canvas);
  renderer.drawStars(ctx, stars, cam, canvas);
  const checkA = checkDock(ship, stationA);
  const colorA = dockColor(checkA);
  renderer.drawStation(ctx, stationA, cam, canvas, colorA);
  const checkB = checkDock(ship, stationB);
  const colorB = dockColor(checkB);
  renderer.drawStation(ctx, stationB, cam, canvas, colorB);
  
  if (ship.dockedTimer <= 0) {
    if (colorA === 'green' && targetStation === stationA) {
      handleDocking(ship, stationA);
      targetStation = stationB;
    } else if (colorB === 'green' && targetStation === stationB) {
      handleDocking(ship, stationB);
      targetStation = stationA;
    }
  }

  renderer.drawShip(ctx, ship, cam, canvas, flags.thrustMain);
  renderer.drawVelocityVec(ctx, ship, cam, canvas);
  
  const targetCheck = targetStation === stationA ? checkA : checkB;
  const targetColor = targetStation === stationA ? colorA : colorB;
  renderer.drawHud(ctx, ship, canvas, targetStation, targetCheck, score, targetColor);
  renderer.drawTargetArrow(ctx, ship, targetStation, cam, canvas);

  requestAnimationFrame(loop);
}

function handleDocking(ship, station) {
  const port = getPortPosition(station);
  ship.dockedTimer = 1500; // 1.5 seconds
  ship.fuel = 100;
  ship.x = port.x;
  ship.y = port.y;
  ship.angle = station.dockAngle + Math.PI; // face away from port
  ship.vx = 0;
  ship.vy = 0;
  ship.angularVel = 0;
  station.docked = true;
  
  if (ship.cargo === 0) {
    ship.cargo = 1;
  } else {
    ship.cargo = 0;
    score += 1;
  }
  
  // Reset docked flag after timer
  setTimeout(() => {
    station.docked = false;
  }, 1500);
}

loop();
