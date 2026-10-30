import { send, onMessage, isOpen } from './websocket.js';
import { getState, setState } from '../store/store.js';

const TIMEOUT_MS = 5000;
let pending = null;
let timer = null;

// "Is EcoFloat reachable?" The backend forwards the request over MQTT; the Pi answers with the same id.
export function requestHeartbeat() {
  if (!isOpen() || getState().heartbeat.status === 'waiting') return;
  const id = `hb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  pending = { id, sentAt: performance.now() };
  setState({ heartbeat: { status: 'waiting', id } });
  send({ type: 'heartbeat', id });
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (pending?.id === id) { pending = null; setState({ heartbeat: { status: 'timeout', id } }); }
  }, TIMEOUT_MS);
}

export function initHeartbeat() {
  // The backend tells us whether it could publish the request at all
  onMessage('command_result', (d) => {
    if (d?.command === 'heartbeat' && d.ok === false && d.id === pending?.id) {
      clearTimeout(timer); pending = null;
      setState({ heartbeat: { status: 'unreachable', id: d.id } });
    }
  });
  onMessage('heartbeat', (d) => {
    if (!pending || d?.id !== pending.id) return;
    clearTimeout(timer);
    const rttMs = Math.round(performance.now() - pending.sentAt);
    pending = null;
    setState({ heartbeat: { status: 'ok', id: d.id, rttMs, deviceId: d.device_id ?? d.drone_id ?? '',
      state: d.state ?? '', timestamp: d.timestamp ?? '' } });
  });
}
