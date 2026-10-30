import { onMessage } from './websocket.js';
import { getState, setState } from '../store/store.js';
import { WS_MESSAGE as W, DEVICE_STALE_MS } from '../config/constants.js';

// "Device online" means the DRONE is sending data. It is not the same as the backend link.
function markSeen(d) {
  setState({
    lastSeen: Date.now(), lastWillOffline: false, simulated: !!d?.simulated,
    deviceId: d?.device_id ?? d?.drone_id ?? getState().deviceId,
  });
}

export const seenFromRecord = (rec) => {
  const t = Date.parse(rec?.received_at);
  return Number.isNaN(t) ? null : t;
};

function recompute() {
  const s = getState();
  let v = 'unknown';
  if (s.lastWillOffline) v = 'offline';
  else if (s.lastSeen) v = Date.now() - s.lastSeen < DEVICE_STALE_MS ? 'online' : 'offline';
  if (v !== s.deviceStatus) setState({ deviceStatus: v });
}

export function initDevice() {
  [W.GPS, W.SYSTEM, W.MOTORS, W.BIN, W.DETECTION, W.FSM, W.HEARTBEAT].forEach((type) =>
    onMessage(type, (d) => { markSeen(d); recompute(); }));
  // MQTT Last Will: the broker announces a dropped device immediately
  onMessage(W.DEVICE, (d) => {
    if (d?.online === false) setState({ lastWillOffline: true, simulated: !!d?.simulated });
    else markSeen(d);
    recompute();
  });
  setInterval(recompute, 1000);
}
