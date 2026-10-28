import 'leaflet/dist/leaflet.css';
import './styles/main.css';

import { connect, onMessage, onStatus } from './services/websocket.js';
import { loadInitialData } from './services/api.js';
import { WS_MESSAGE, MAX_DETECTIONS } from './config/constants.js';
import { setState, addPathPoint, addDetection } from './store/store.js';
import { initRouter } from './pages/router.js';
import { mountApp } from './app/mount.js';
import { initEvents } from './app/events.js';
import { initStatusBadge } from './components/status-badge.js';
import { initPanels, hasFix } from './components/panels.js';
import { initMap } from './components/map.js';
import { initDetectionLog } from './components/detection-log.js';
import { initControlPad } from './components/control-pad.js';

const ts = (x) => new Date(x.timestamp).getTime();
const sortAsc = (a) => (a.every((x) => x.timestamp) ? [...a].sort((x, y) => ts(x) - ts(y)) : [...a].reverse());
const sortDesc = (a) => (a.every((x) => x.timestamp) ? [...a].sort((x, y) => ts(y) - ts(x)) : [...a]);

async function hydrate() {
  const d = await loadInitialData();
  const patch = {};
  if (Array.isArray(d.gps) && d.gps.length) {
    const pts = sortAsc(d.gps).filter(hasFix);
    patch.path = pts.map((p) => [Number(p.latitude), Number(p.longitude)]);
    if (pts.length) patch.gps = pts[pts.length - 1];
  }
  if (Array.isArray(d.detections)) patch.detections = sortDesc(d.detections).slice(0, MAX_DETECTIONS);
  if (d.system?.status) patch.system = d.system;
  if (d.motors?.esc_status) patch.motors = d.motors;
  if (d.bin?.status) patch.bin = d.bin;
  setState(patch);
}

// Live messages -> store
onMessage(WS_MESSAGE.GPS, (d) => {
  setState({ gps: d });
  if (hasFix(d)) addPathPoint([Number(d.latitude), Number(d.longitude)]);
});
onMessage(WS_MESSAGE.SYSTEM, (d) => setState({ system: d }));
onMessage(WS_MESSAGE.MOTORS, (d) => setState({ motors: d }));
onMessage(WS_MESSAGE.BIN, (d) => setState({ bin: d }));
onMessage(WS_MESSAGE.DETECTION, addDetection);
onStatus((s) => { setState({ connection: s }); if (s === 'online') hydrate(); });

mountApp(); initEvents();
initStatusBadge(); initPanels(); initMap(); initDetectionLog(); initControlPad();
initRouter();
connect();
