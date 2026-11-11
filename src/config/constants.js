// Keep in sync with app/config.py on the Raspberry Pi.
export const MAP_DEFAULT_CENTER = [14.5995, 120.9842];
export const MAP_DEFAULT_ZOOM = 16;
export const MAX_PATH_POINTS = 1000;
export const MAX_DETECTIONS = 50;

export const WS_MESSAGE = {
  GPS: 'gps', SYSTEM: 'system', MOTORS: 'motors', DETECTION: 'detection', BIN: 'bin',
  FSM: 'fsm', DEVICE: 'device', HEARTBEAT: 'heartbeat',
  MISSION: 'mission', MISSION_PLAN: 'mission_plan', MISSION_RESULT: 'mission_result',
};

export const MOTOR_CMD = { FORWARD: 'F', BACKWARD: 'B', LEFT: 'L', RIGHT: 'R', STOP: 'S' };
export const MOTOR_RESEND_MS = 300; // must stay under the ESP32 watchdog (heartbeat 0.5 s)

export const BIN_STATUS_COLOR = {
  EMPTY: 'var(--green)', PARTIALLY_FILLED: 'var(--blue)',
  NEAR_FULL: 'var(--amber)', FULL: 'var(--red)',
};

// Battery voltage thresholds (LiFePO4 12V pack)
export const BATTERY_WARN_V = 11;
export const BATTERY_DANGER_V = 10;

export const WS_RECONNECT = { baseMs: 1000, maxMs: 30000 };
export const API_TIMEOUT_MS = 20000; // Render free tier cold start can take ~30 s

// Device presence: online if any telemetry arrived within this window (GPS is 1 Hz)
export const DEVICE_STALE_MS = 15000;

// Friendly mission labels for the raw FSM states (see docs/MESSAGE_CONTRACT.md)
export const MISSION_STATE = {
  IDLE: { label: 'Idle', tone: 'neutral' },
  HOLD: { label: 'On mission', tone: 'good' },
  NAVIGATE: { label: 'On mission', tone: 'good' },
  COLLECT: { label: 'On mission', tone: 'good' },
  AVOID: { label: 'On mission', tone: 'good' },
  RECOVERY: { label: 'On mission', tone: 'warn' },
  RTH: { label: 'Returning to dock', tone: 'warn' },
  DOCK: { label: 'Docked', tone: 'neutral' },
  MANUAL: { label: 'Manual control', tone: 'good' },
  FAULT: { label: 'Fault', tone: 'bad' },
  RETURN_HOME: { label: 'Returning home', tone: 'warn' },
  DONE: { label: 'Mission complete', tone: 'neutral' },
};

export const TEMP_WARN_C = 70;   // Raspberry Pi 5 starts throttling around 80 C
export const TEMP_DANGER_C = 80;
export const BATTERY_WARN_PCT = 30;
export const BATTERY_DANGER_PCT = 20; // the Pi's FSM returns home at 20%

// Mission planner. Keep in sync with app/config.py on the Pi.
export const MISSION_LIMITS = {
  maxWaypoints: 50, maxFence: 100, maxSpanM: 2000,
  tooCloseM: 2.0,        // GEO_TOO_CLOSE_M
  tightM: 6.0,           // the boat slows down within this distance of the wall
  gpsErrorM: 2.5,        // typical NEO-M8N error in the open
  arriveM: 2.0,          // WP_ARRIVE_RADIUS_M
  cruiseMps: 0.7,        // ~35 % thrust in the simulator speed model (estimate only)
  rthTimeoutS: 300,      // RTH_TIMEOUT_S
};
// "Capture from boat": average the boat's GPS before saving a point
export const CAPTURE = { seconds: 30, minSamples: 15, maxSpreadM: 3.0, minSats: 6, maxHdop: 2.0 };

// Map layers for the planner. Esri imagery for placing points; plain map as a check.
export const TILES = {
  imagery: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxNativeZoom: 19,
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxNativeZoom: 19,
  },
};
