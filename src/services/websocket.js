import { env } from '../config/env.js';
import { WS_RECONNECT } from '../config/constants.js';

let socket = null;
let attempts = 0;
const handlers = new Map(); // message type -> Set<fn>
const statusListeners = new Set();

export const onMessage = (type, fn) => {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type).add(fn);
};
export const onStatus = (fn) => statusListeners.add(fn);
const emitStatus = (s) => statusListeners.forEach((fn) => fn(s));

export function connect() {
  emitStatus('connecting');
  socket = new WebSocket(env.wsUrl);

  socket.onopen = () => { attempts = 0; emitStatus('online'); };

  socket.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    handlers.get(msg.type)?.forEach((fn) => fn(msg.data));
  };

  socket.onclose = () => {
    emitStatus('offline');
    // Exponential backoff with jitter: 1s, 2s, 4s ... capped at 30s
    const delay = Math.min(WS_RECONNECT.baseMs * 2 ** attempts++, WS_RECONNECT.maxMs);
    setTimeout(connect, delay + Math.random() * 500);
  };

  socket.onerror = () => socket.close();
}

export const isOpen = () => socket?.readyState === WebSocket.OPEN;

export function send(payload) {
  if (!isOpen()) return false;
  socket.send(JSON.stringify(payload));
  return true;
}
