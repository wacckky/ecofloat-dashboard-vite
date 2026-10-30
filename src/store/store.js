import { MAX_DETECTIONS, MAX_PATH_POINTS } from '../config/constants.js';

const state = {
  connection: 'connecting', // connecting | online | offline
  operator: 'locked', authError: '', heartbeat: { status: 'idle' }, deviceStatus: 'unknown', lastSeen: null, lastWillOffline: false,
  simulated: false, deviceId: '', fsmState: '', gps: null, system: null, motors: null, bin: null,
  path: [], detections: [],
};
const listeners = new Set();

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state, Object.keys(patch)));
}

export function addPathPoint(point) {
  setState({ path: [...state.path, point].slice(-MAX_PATH_POINTS) });
}

export const keyOf = (d) => d._id ?? `${d.timestamp}-${d.latitude}-${d.longitude}`;

export function addDetection(d) {
  // De-duplicate so reconnects don't create double markers
  if (state.detections.some((x) => keyOf(x) === keyOf(d))) return;
  setState({ detections: [d, ...state.detections].slice(0, MAX_DETECTIONS) });
}
