import { subscribe } from '../store/store.js';
import { $, set } from '../utils/dom.js';
import { BIN_STATUS_COLOR, BATTERY_WARN_V, BATTERY_DANGER_V } from '../config/constants.js';
import { fmtCoord, pathLengthMeters } from '../utils/format.js';

export const hasFix = (g) => g && Number(g.latitude) !== 0 && Number(g.longitude) !== 0;

function renderGps({ gps: g }) {
  if (!g) return;
  set('dHeading', g.heading == null || g.heading_valid === false ? '--°' : `${Number(g.heading).toFixed(1)}°`);
  set('dSpeed', `${Number(g.speed || 0).toFixed(2)} m/s`);
  if (hasFix(g)) {
    set('dLat', fmtCoord(g.latitude));
    set('dLon', fmtCoord(g.longitude));
    set('mapOverlay', `${fmtCoord(g.latitude, 4)}, ${fmtCoord(g.longitude, 4)}`);
  } else {
    set('mapOverlay', 'NO GPS FIX');
  }
}

function renderSystem({ system: d }) {
  if (!d) return;
  const cpu = Number(d.cpu_percent || 0);
  const bat = Number(d.battery_voltage || 0);
  const batEl = $('dBattery');
  if (batEl) {
    batEl.textContent = `${bat.toFixed(1)} V`;
    batEl.className = 'val' + (bat < BATTERY_DANGER_V ? ' danger' : bat < BATTERY_WARN_V ? ' warn' : '');
  }
  set('dCpu', `${cpu.toFixed(0)}%`);
  set('dMem', `${Number(d.memory_percent || 0).toFixed(0)}%`);
  set('dStatus', d.status || '--');
  const bar = $('cpuBar');
  if (bar) bar.style.width = `${Math.min(cpu, 100)}%`;
}

function renderMotors({ motors: d }) {
  if (!d) return;
  set('dMotorL', `${d.motor_left_throttle || '--'} µs`);
  set('dMotorR', `${d.motor_right_throttle || '--'} µs`);
  set('dEsc', d.esc_status || '--');
}

function renderBin({ bin: d }) {
  if (!d) return;
  const status = d.status || 'EMPTY';
  const color = BIN_STATUS_COLOR[status] || 'var(--teal)';
  set('dBinScore', d.volume_score || 0);
  set('dBinItems', `${d.items_collected || 0} items`);
  set('dBinOcc', `${((d.occlusion_ratio || 0) * 100).toFixed(0)}%`);
  const bar = $('binBar');
  if (bar) { bar.style.width = `${Math.min(d.fill_percent || 0, 100)}%`; bar.style.background = color; }
  const label = $('dBinStatus');
  if (label) { label.textContent = status.replace(/_/g, ' '); label.style.color = color; }
}

export function initPanels() {
  subscribe((s, keys) => {
    if (keys.includes('gps')) renderGps(s);
    if (keys.includes('system')) renderSystem(s);
    if (keys.includes('motors')) renderMotors(s);
    if (keys.includes('bin')) renderBin(s);
    if (keys.includes('connection')) set('statUptime', s.connection === 'online' ? 'ONLINE' : 'OFFLINE');
    if (keys.includes('detections')) set('statTotal', s.detections.length);
    if (keys.includes('path')) set('statDist', `${Math.round(pathLengthMeters(s.path))}m`);
  });
}
