import { CAMERA_LERP, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM, CAMERA_ZOOM_SPEED } from './constants.js';

const LEVEL8_ZOOM_OUT_SPEED = 0.018;

export function createCamera(x = 0, y = 0) {
  return {
    x,
    y,
    zoom: 1,
    targetZoom: 1,
  };
}

export function updateCamera(cam, ship, stations) {
  // follow ship
  cam.x += (ship.x - cam.x) * CAMERA_LERP;
  cam.y += (ship.y - cam.y) * CAMERA_LERP;

  // Zoom based on distance to the NEAREST station
  // so zoom stays in while near any station and only zooms out as ship travels
  if (stations && stations.length > 0) {
    let minDist = Infinity;
    for (const st of stations) {
      const d = Math.hypot(ship.x - st.x, ship.y - st.y);
      if (d < minDist) minDist = d;
    }

    // max zoom (1.0) when dist < 200, min zoom (0.6) when dist > 900
    let zoomT = (minDist - 200) / (900 - 200);
    zoomT = Math.max(0, Math.min(1, zoomT));
    cam.targetZoom = CAMERA_MAX_ZOOM - zoomT * (CAMERA_MAX_ZOOM - CAMERA_MIN_ZOOM);
  }

  // smoothly interpolate zoom
  cam.zoom += (cam.targetZoom - cam.zoom) * CAMERA_ZOOM_SPEED;
}

export function updateLevel8Camera(cam, ship, levelState, canvas) {
  cam.x += (ship.x - cam.x) * CAMERA_LERP;
  cam.y += (ship.y - cam.y) * CAMERA_LERP;

  if (levelState?.phase !== 'ring') {
    const departureZoom = getDepartureZoom(ship, levelState.departureStation);
    const stationZoom = getStationApproachZoom(ship, levelState.targetStation);
    const portalZoom = getTargetApproachZoom(ship, levelState.level.portal, 180, 700, 0.82);
    cam.targetZoom = Math.max(0.68, departureZoom, stationZoom, portalZoom);
  } else {
    const planet = levelState.level.planet;
    const radius = Math.hypot(ship.x - planet.x, ship.y - planet.y);
    const zoomT = clamp((radius - 1200) / (3000 - 1200), 0, 1);
    const orbitZoom = 0.92 - zoomT * 0.5;
    const departureZoom = getDepartureZoom(ship, levelState.departureStation);
    const stationZoom = getStationApproachZoom(ship, levelState.targetStation);

    cam.targetZoom = Math.max(orbitZoom, departureZoom, stationZoom);
  }

  const zoomSpeed = cam.targetZoom < cam.zoom ? LEVEL8_ZOOM_OUT_SPEED : CAMERA_ZOOM_SPEED;
  cam.zoom += (cam.targetZoom - cam.zoom) * zoomSpeed;
}

function getStationApproachZoom(ship, station) {
  if (!station) return CAMERA_MIN_ZOOM;

  return getTargetApproachZoom(ship, station, 220, 950, CAMERA_MAX_ZOOM);
}

function getDepartureZoom(ship, station) {
  if (!station) return CAMERA_MIN_ZOOM;

  return getTargetApproachZoom(ship, station, 260, 1700, CAMERA_MAX_ZOOM);
}

function getTargetApproachZoom(ship, target, nearDist, farDist, maxZoom) {
  if (!target) return CAMERA_MIN_ZOOM;

  const dist = Math.hypot(ship.x - target.x, ship.y - target.y);
  const zoomT = clamp((dist - nearDist) / (farDist - nearDist), 0, 1);
  return maxZoom - zoomT * (maxZoom - CAMERA_MIN_ZOOM);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function worldToScreen(cam, worldX, worldY, canvas) {
  const cx = canvas.clientWidth / 2;
  const cy = canvas.clientHeight / 2;
  const sx = cx + (worldX - cam.x) * cam.zoom;
  const sy = cy + (worldY - cam.y) * cam.zoom;
  return { x: sx, y: sy };
}

export function screenToWorld(cam, sx, sy, canvas) {
  const cx = canvas.clientWidth / 2;
  const cy = canvas.clientHeight / 2;
  const wx = cam.x + (sx - cx) / cam.zoom;
  const wy = cam.y + (sy - cy) / cam.zoom;
  return { x: wx, y: wy };
}

/**
 * Prüft, ob ein Punkt in Weltkoordinaten auf dem Bildschirm sichtbar ist
 * (mit optionalem Randabstand in Pixeln).
 */
export function isWorldPointOnScreen(worldX, worldY, cam, canvas, margin = 40) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const p = worldToScreen(cam, worldX, worldY, canvas);
  return p.x > margin && p.x < w - margin && p.y > margin && p.y < h - margin;
}
