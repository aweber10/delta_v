export const WORLD_WIDTH = 2000;
export const WORLD_HEIGHT = 1500;

export const THRUST_MAIN = 0.08; // px/frame^2
export const THRUST_RCS = 0.012; // px/frame^2
export const ROT_ACCEL = 0.004; // rad/frame^2
export const ROT_DAMP = 0.96; // damping of angular velocity
export const V_DOCK_MAX = 0.4; // px/frame
export const DOCK_RADIUS = 30; // px
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

