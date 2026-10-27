// Keep in sync with app/config.py on the Raspberry Pi.
export const MAP_DEFAULT_CENTER = [14.5995, 120.9842];
export const MAP_DEFAULT_ZOOM = 16;
export const MAX_PATH_POINTS = 1000;
export const MAX_DETECTIONS = 50;

export const WS_MESSAGE = {
  GPS: 'gps', SYSTEM: 'system', MOTORS: 'motors', DETECTION: 'detection', BIN: 'bin',
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
