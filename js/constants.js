export const WORLD_WIDTH = 2000;
export const WORLD_HEIGHT = 1500;

export const THRUST_MAIN = 0.08; // px/frame^2
export const THRUST_RCS = 0.012; // px/frame^2
export const ROT_ACCEL = 0.004; // rad/frame^2
export const ROT_DAMP = 0.96; // damping of angular velocity
export const V_DOCK_MAX = 0.4; // px/frame
export const ANGLE_DOCK_TOL = (20 * Math.PI) / 180; // radians
export const DOCK_RADIUS = 30; // px
export const RCS_ZONE_RADIUS = 300; // px
export const FUEL_START = 300; // increased from 100 to allow more time for docking
export const FUEL_MAIN = 1.0; // per frame
export const FUEL_RCS = 0.15; // per pulse
export const RCS_PULSE_MS = 150; // ms

export const ROCKET_RADIUS = 12; // visual

export const TOT_ZONE_RADIUS = 25; // px (world-space, legacy name)

export const RCS_ZONE_RADIUS_PX = 120; // px (screen-space)
export const TOT_ZONE_RADIUS_PX = 40; // px (screen-space)

// legacy world-space constants for physics/station calculations
export const RCS_ZONE_RADIUS = 300; // px (world-space)

// ...[rest der Datei unverändert lassen]
