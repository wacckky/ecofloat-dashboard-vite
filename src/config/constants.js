// Keep in sync with app/config.py on the Raspberry Pi.
export const MAP_DEFAULT_CENTER = [14.5995, 120.9842];
export const MAP_DEFAULT_ZOOM = 16;
export const MAX_PATH_POINTS = 1000;
export const MAX_DETECTIONS = 50;

export const WS_MESSAGE = {
  GPS: 'gps', SYSTEM: 'system', MOTORS: 'motors', DETECTION: 'detection', BIN: 'bin',
  FSM: 'fsm', DEVICE: 'device', HEARTBEAT: 'heartbeat',
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
};

export const TEMP_WARN_C = 70;   // Raspberry Pi 5 starts throttling around 80 C
export const TEMP_DANGER_C = 80;
export const BATTERY_WARN_PCT = 30;
export const BATTERY_DANGER_PCT = 20; // the Pi's FSM returns home at 20%
