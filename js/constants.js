export const WORLD_WIDTH = 2000;
export const WORLD_HEIGHT = 1500;

export const THRUST_MAIN = 0.08; // px/frame^2
export const THRUST_RCS = 0.035; // px/frame^2
export const ROT_ACCEL = 0.016; // rad/frame^2 (faster rotation)
export const ROT_DAMP = 0.96; // damping of angular velocity
export const V_DOCK_MAX = 0.4; // px/frame
export const ANGLE_DOCK_TOL = (20 * Math.PI) / 180; // radians
export const DOCK_RADIUS = 30; // px
// New magnetic docking radius (soft attraction)
export const DOCK_MAGNET_RADIUS = 80; // px – distance where magnetic pull starts
export const DOCK_MAGNET_STRENGTH = 0.012; // acceleration factor for magnetic pull (px/frame²)
export const FUEL_START = 300; // increased from 100 to allow more time for docking
export const FUEL_MAIN = 1.0; // per frame
export const FUEL_RCS = 0.15; // per pulse
export const RCS_PULSE_MS = 150; // ms

export const SHIP_RADIUS = 12; // visual

export const RCS_ZONE_RADIUS_PX = 80; // screen space radius for touch RCS pulses

// legacy world-space constants for physics/station calculations only

export const RCS_ZONE_RADIUS = 300; // px (world-space)

export const ARM_LENGTH = 40; // px

export const CAMERA_MIN_ZOOM = 0.6;
export const CAMERA_MAX_ZOOM = 1.0;
export const CAMERA_ZOOM_SPEED = 0.05; // interpolation speed
export const CAMERA_LERP = 0.08; // camera follow speed

export function normalizeAngle(a) {
  a = (a + Math.PI * 2) % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  return a;
}

// --- Level 2: Gravity Well ---
export const G_STRENGTH = 120.0;  // Anziehungsstärke
export const MIN_DIST_SQ = 2500;  // Nahbereich-Deckel (~50px Radius²)
export const G_RADIUS = 600;      // Einflussradius in World-Units
export const WELL_RADIUS = 40;    // sichtbarer/tödlicher Körperradius
export const EVENT_HORIZON = 80;  // Warnschwelle: ab hier ist Absturz gefährlich

// --- Level 3: Asteroid Field ---
export const ASTEROID_BOUNCE_MAX_SPEED = V_DOCK_MAX;
export const ASTEROID_BOUNCE_DAMPING = 0.55;
export const ASTEROID_COLLISION_PADDING = SHIP_RADIUS;
export const ASTEROID_BOUNCE_FUEL_PENALTY = 8;

// --- Level 5: Orbital Rendezvous ---
export const PLANET_RADIUS = 520;          // sichtbarer Planetenradius (world-px)
export const PLANET_GRAVITY_STRENGTH = 180.0;  // stärker als L2-Stern
export const PLANET_GRAVITY_RADIUS = 900;  // Einflussradius
export const PLANET_WELL_RADIUS = 530;     // tödliche Kollisionszone (Oberfläche)
export const ORBIT_STATION_RADIUS = 700;   // Orbithöhe der Station (world-px vom Planetenzentrum)
export const ORBIT_STATION_SPEED = Math.sqrt(PLANET_GRAVITY_STRENGTH / (ORBIT_STATION_RADIUS ** 3));
export const ORBIT_TOLERANCE = 35;
export const ORBIT_RADIAL_SPEED_OK = 0.08;
export const ORBIT_TANGENTIAL_SPEED_OK = 0.08;
// Docking-Toleranz für relative Geschwindigkeit: V_DOCK_MAX wird für Relativgeschwindigkeit genutzt

// --- Level 6: Schwerkraftschleuder (Slingshot) ---
export const L6_FUEL_START = 180;           // Knappes Treibstoff-Budget — Direktflug unmöglich
export const L6_PLANET_RADIUS = 480;        // Gasriese (Jupiter-artig)
export const L6_GRAVITY_STRENGTH = 220.0;   // Stark genug für spürbaren Slingshot-Boost
export const L6_GRAVITY_RADIUS = 1100;      // Großer Einflussbereich
export const L6_WELL_RADIUS = 492;          // Kollisionszone (leicht über Planetenradius)
export const L6_MOON_RADIUS = 72;           // Mond-Radius (rein visuell)
export const L6_MOON_ORBIT_RADIUS = 700;    // Mondabstand vom Gasriesen-Zentrum
export const L6_MOON_ORBIT_SPEED = 0.00055; // Mondrotationsgeschwindigkeit (rad/frame)
