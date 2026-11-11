// Mission planner (operator only): draw the fence, waypoints and home on the map,
// check them, send the plan to the boat, then Start / Abort / Return home.
// Viewers (no operator key) see the live mission status but cannot edit or send.
import L from 'leaflet';
import { subscribe, getState } from '../store/store.js';
import { $, set } from '../utils/dom.js';
import { escapeHtml } from '../utils/format.js';
import { haversine } from '../utils/geo.js';
import { isOperator } from '../services/auth.js';
import { emergencyStop, returnHome } from '../services/commands.js';
import { checkPlan, emptyPlan, newPlanId, parsePlanFile, planForBoat, uploadPlan, startMission, abortMission } from '../services/mission.js';
import { mountOperatorLock } from '../components/operator-lock.js';
import { hasFix } from '../components/panels.js';
import { CAPTURE, MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MISSION_STATE, TILES } from '../config/constants.js';

const DRAFT_KEY = 'ecofloat_mission_draft';
const MODES = {
  fence: 'Click the map to add fence corners in order around the water. Drag a corner to move it.',
  waypoints: 'Click the map to add waypoints in visiting order. ↑ moves one earlier. Right-click a pin to delete it.',
  home: 'Click the map to set home (open water where the boat should finish).',
};

const PAGE = `
<div id="page-mission" class="page">
 <div class="mc-layout">
  <div class="mc-controls">
    <div class="panel-card">
      <div class="panel-title">Mission planner <div class="panel-title-dot"></div></div>
      <div id="msOpSlot"></div>
      <div class="ms-viewer" id="msViewer">The planner is for the operator only. You can watch the mission status below.</div>
    </div>

    <div class="ms-op-only">
      <div class="panel-card">
        <div class="panel-title">1 · Draw the plan</div>
        <input id="msName" class="ms-input" maxlength="60" placeholder="Plan name (e.g. pool test 1)">
        <div class="time-range mc-tabs">
          <button class="range-btn active" data-ms-mode="fence">Fence <b id="msNF">0</b></button>
          <button class="range-btn" data-ms-mode="waypoints">Waypoints <b id="msNW">0</b></button>
          <button class="range-btn" data-ms-mode="home">Home</button>
        </div>
        <div class="mc-hint" id="msHint"></div>
        <label class="ms-check" id="msLaunchRow"><input type="checkbox" id="msLaunch"> No fixed home: use the launch point</label>
        <ol class="ms-list" id="msList"></ol>
        <div class="ms-row">
          <button class="cmd-btn cmd-home" id="msUndo">Undo last</button>
          <button class="cmd-btn cmd-home" id="msClear">Clear this list</button>
        </div>
        <button class="cmd-btn cmd-home" id="msCapture">📍 Capture from boat (30 s GPS average)</button>
        <div class="mc-hint" id="msCaptureMsg"></div>
      </div>

      <div class="panel-card">
        <div class="panel-title">2 · Check</div>
        <ul class="ms-checks" id="msChecks"></ul>
      </div>

      <div class="panel-card">
        <div class="panel-title">3 · Send and run</div>
        <button class="cmd-btn cmd-home" id="msSend">⬆ Send plan to boat</button>
        <div class="mc-hb" id="msSendMsg">Not sent yet.</div>
        <button class="cmd-btn ms-go" id="msStart">▶ Start mission</button>
        <ul class="ms-checks" id="msBlockers"></ul>
        <div class="ms-row">
          <button class="cmd-btn cmd-home" id="msAbort">Abort → go home</button>
          <button class="cmd-btn cmd-home" id="msHold">Abort → stop here</button>
        </div>
        <button class="cmd-btn cmd-home" id="msRth">🏠 Return home</button>
      </div>

      <div class="panel-card">
        <div class="panel-title">Files</div>
        <div class="ms-row">
          <button class="cmd-btn cmd-home" id="msExport">Export .json</button>
          <button class="cmd-btn cmd-home" id="msImportBtn">Import .json</button>
          <input type="file" id="msImport" accept=".json,application/json" hidden>
        </div>
        <button class="cmd-btn cmd-home" id="msNew">New empty plan</button>
        <div class="mc-hint">The draft is kept in this browser. Export it to share with the team or to load on the Pi
          (<code>python3 -m app.run_boat --plan file.json</code>).</div>
      </div>
    </div>

    <button class="cmd-btn cmd-stop" id="msEstop">🛑 Emergency Stop</button>
  </div>
  <div class="mc-map-col">
    <div id="missionMap"></div>
    <div class="mc-strip">
      <div class="stat-box"><label>Mission</label><div class="val" id="msState">--</div></div>
      <div class="stat-box"><label>Waypoint</label><div class="val" id="msWp">--</div></div>
      <div class="stat-box"><label>Distance</label><div class="val" id="msDist">--</div></div>
      <div class="stat-box"><label>GPS</label><div class="val" id="msGps">--</div></div>
      <div class="stat-box"><label>Heading</label><div class="val" id="msHead">--</div></div>
    </div>
    <div class="ms-reason" id="msReason"></div>
  </div>
 </div>
</div>`;

let map, layers = {}, plan = loadDraft(), mode = 'fence', capture = null, sentId = null;

function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (d && Array.isArray(d.fence) && Array.isArray(d.waypoints)) return { ...emptyPlan(), ...d };
  } catch { /* storage blocked or corrupt: start empty */ }
  return emptyPlan();
}
function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(plan)); } catch { /* ignore */ }
}

// Any edit makes a new plan id, so "the boat has this plan" is only true for exactly what was sent
function edited() {
  plan.id = newPlanId();
  saveDraft();
  draw();
  renderEditor();
}

// ── map ─────────────────────────────────────────────────────────────────────
const dot = (cls, text = '') => L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: `<div class="ms-pin ${cls}">${text}</div>` });
const ARROW = '<div class="drone-arrow"><svg viewBox="0 0 36 36"><path d="M18 3 L29 31 L18 25 L7 31 Z" fill="#00c8b4" stroke="#020b12" stroke-width="2" stroke-linejoin="round"/></svg></div>';

function ensure() {
  if (map) { map.invalidateSize(); return; }
  const imagery = L.tileLayer(TILES.imagery.url, { attribution: TILES.imagery.attribution, maxNativeZoom: TILES.imagery.maxNativeZoom, maxZoom: 21 });
  const street = L.tileLayer(TILES.street.url, { attribution: TILES.street.attribution, maxNativeZoom: TILES.street.maxNativeZoom, maxZoom: 21 });
  map = L.map('missionMap', { layers: [imagery], maxZoom: 21 });
  L.control.layers({ 'Satellite (Esri)': imagery, 'Street map (OSM)': street }, null, { position: 'topright' }).addTo(map);
  L.control.scale({ imperial: false }).addTo(map);
  layers.plan = L.layerGroup().addTo(map);
  layers.boat = L.marker(MAP_DEFAULT_CENTER, { icon: L.divIcon({ html: ARROW, iconSize: [36, 36], iconAnchor: [18, 18], className: '' }), opacity: 0, interactive: false }).addTo(map);
  layers.target = L.circleMarker(MAP_DEFAULT_CENTER, { radius: 14, color: '#f59e0b', weight: 3, fill: false, opacity: 0 }).addTo(map);
  map.on('click', (e) => addPoint([e.latlng.lat, e.latlng.lng]));
  const pts = [...plan.fence, ...plan.waypoints, ...(plan.home ? [plan.home] : [])];
  if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 19 });
  else if (hasFix(getState().gps)) map.setView([Number(getState().gps.latitude), Number(getState().gps.longitude)], 18);
  else map.setView(MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM);
  draw();
  renderLive(getState());
}

function draggable(ll, icon, onMove, onDelete) {
  const m = L.marker(ll, { icon, draggable: isOperator(), autoPan: true });
  m.on('dragend', () => { const p = m.getLatLng(); onMove([p.lat, p.lng]); });
  m.on('contextmenu', () => { if (isOperator()) onDelete(); });
  return m;
}

function draw() {
  if (!map) return;
  layers.plan.clearLayers();
  const { fence, waypoints, home } = plan;
  if (fence.length >= 2) L.polygon(fence, { color: '#00c8b4', weight: 2, fillOpacity: 0.08, interactive: false }).addTo(layers.plan);
  const route = [...(home ? [home] : []), ...waypoints, ...(home ? [home] : [])];
  if (route.length >= 2) L.polyline(route, { color: '#f59e0b', weight: 2, dashArray: '6,5', interactive: false }).addTo(layers.plan);
  fence.forEach((q, i) => draggable(q, dot('ms-corner'), (n) => { fence[i] = n; edited(); }, () => { fence.splice(i, 1); edited(); })
    .bindTooltip(`Fence corner ${i + 1}`).addTo(layers.plan));
  waypoints.forEach((q, i) => draggable(q, dot('ms-wp', i + 1), (n) => { waypoints[i] = n; edited(); }, () => { waypoints.splice(i, 1); edited(); })
    .bindTooltip(`Waypoint ${i + 1}`).addTo(layers.plan));
  if (home) draggable(home, dot('ms-home', '⌂'), (n) => { plan.home = n; edited(); }, () => { plan.home = null; edited(); })
    .bindTooltip('Home').addTo(layers.plan);
}

function addPoint(ll) {
  if (!isOperator()) return;
  if (mode === 'fence') plan.fence.push(ll);
  else if (mode === 'waypoints') plan.waypoints.push(ll);
  else { plan.home = ll; $('msLaunch').checked = false; }
  edited();
}

// ── capture from boat: average 30 s of the boat's own GPS ───────────────────
function startCapture() {
  if (capture) { capture = null; set('msCaptureMsg', 'Capture cancelled.'); renderEditor(); return; }
  capture = { mode, samples: [], until: Date.now() + CAPTURE.seconds * 1000, last: null };
  renderEditor();
  const tick = () => {
    if (!capture) return;
    const left = Math.ceil((capture.until - Date.now()) / 1000);
    if (left > 0) {
      set('msCaptureMsg', `Hold the boat still… ${left} s, ${capture.samples.length} GPS readings`);
      setTimeout(tick, 500);
      return;
    }
    finishCapture();
  };
  tick();
}

function onGpsForCapture(g) {
  if (!capture || !hasFix(g) || g.fix === false || g === capture.last) return;
  capture.last = g;
  capture.samples.push({ ll: [Number(g.latitude), Number(g.longitude)], sats: Number(g.satellites), hdop: Number(g.hdop) });
}

function finishCapture() {
  const c = capture;
  capture = null;
  const n = c.samples.length;
  let msg;
  if (n < CAPTURE.minSamples) {
    msg = `✗ Only ${n} GPS readings (need ${CAPTURE.minSamples}). Is the boat online with a fix?`;
  } else {
    const mean = [0, 1].map((k) => c.samples.reduce((s, x) => s + x.ll[k], 0) / n);
    const d = c.samples.map((x) => haversine(mean, x.ll)).sort((a, b) => a - b);
    const spread = d[Math.floor(0.95 * (n - 1))];
    const sats = Math.min(...c.samples.map((x) => x.sats).filter(Number.isFinite));
    const hdop = Math.max(...c.samples.map((x) => x.hdop).filter(Number.isFinite));
    if (spread > CAPTURE.maxSpreadM) msg = `✗ Readings scattered over ${spread.toFixed(1)} m (limit ${CAPTURE.maxSpreadM} m). Not saved. Try again away from the Skyway.`;
    else if (Number.isFinite(sats) && sats < CAPTURE.minSats) msg = `✗ Only ${sats} satellites (need ${CAPTURE.minSats}). Not saved.`;
    else if (Number.isFinite(hdop) && hdop > CAPTURE.maxHdop) msg = `✗ HDOP ${hdop.toFixed(1)} is too high (limit ${CAPTURE.maxHdop}). Not saved.`;
    else {
      const ll = mean.map((v) => Math.round(v * 1e7) / 1e7);
      if (c.mode === 'fence') plan.fence.push(ll);
      else if (c.mode === 'waypoints') plan.waypoints.push(ll);
      else { plan.home = ll; $('msLaunch').checked = false; }
      edited();
      msg = `✓ Saved ${c.mode === 'home' ? 'home' : `a ${c.mode === 'fence' ? 'fence corner' : 'waypoint'}`}: ${n} readings, 95 % within ${spread.toFixed(1)} m.`;
    }
  }
  set('msCaptureMsg', msg);
  renderEditor();
}

// ── panels ──────────────────────────────────────────────────────────────────
function li(cls, text) { return `<li class="${cls}">${escapeHtml(text)}</li>`; }

function renderEditor() {
  const op = isOperator();
  document.getElementById('page-mission').classList.toggle('ms-locked', !op);
  $('msViewer').style.display = op ? 'none' : 'block';
  set('msNF', plan.fence.length);
  set('msNW', plan.waypoints.length);
  if (document.activeElement !== $('msName')) $('msName').value = plan.name;
  set('msHint', MODES[mode]);
  $('msLaunchRow').style.display = mode === 'home' ? 'flex' : 'none';
  $('msLaunch').checked = !plan.home;

  const pts = mode === 'fence' ? plan.fence : mode === 'waypoints' ? plan.waypoints : (plan.home ? [plan.home] : []);
  $('msList').innerHTML = pts.map((q, i) => `<li><span>${mode === 'home' ? 'Home' : i + 1} · ${q[0].toFixed(6)}, ${q[1].toFixed(6)}</span>`
    + `<span>${mode === 'waypoints' && i > 0 ? `<button class="ms-x ms-up" data-ms-up="${i}" title="Visit earlier">↑</button>` : ''}`
    + `<button class="ms-x" data-ms-del="${i}" title="Delete">✕</button></span></li>`).join('') || '<li class="ms-empty">No points yet.</li>';
  $('msCapture').textContent = capture ? '✕ Cancel capture' : '📍 Capture from boat (30 s GPS average)';

  const ck = checkPlan(plan);
  $('msChecks').innerHTML = ck.errors.map((t) => li('bad', t)).join('') + ck.warnings.map((t) => li('warn', t)).join('')
    + ck.info.map((t) => li('ok', t)).join('') + (ck.errors.length || ck.warnings.length ? '' : li('ok', '✓ No problems found.'));
  $('msSend').disabled = !op || ck.errors.length > 0 || getState().connection !== 'online';
  renderBoatButtons(getState());
}

function renderBoatButtons(s) {
  const op = isOperator(), m = s.mission, online = s.connection === 'online';
  const running = m && ['NAVIGATE', 'RETURN_HOME'].includes(m.state);
  const boatHasIt = m?.plan?.id && m.plan.id === plan.id;
  $('msStart').disabled = !op || !online || !boatHasIt || !m?.ready_to_start || running;
  $('msAbort').disabled = $('msHold').disabled = !op || !online || !running;
  $('msRth').disabled = !op || !online;
  const b = [];
  if (!m) b.push(li('warn', 'No mission status from the boat yet (is run_boat running?).'));
  else {
    if (!boatHasIt) b.push(li('warn', m.plan ? `The boat has a different plan ("${m.plan.name || m.plan.id}"). Send this one first.` : 'The boat has no plan yet. Send this one first.'));
    (m.start_blockers || []).filter((x) => x !== 'no plan loaded').forEach((x) => b.push(li('bad', x)));
    if (boatHasIt && m.ready_to_start && !running) b.push(li('ok', '✓ Ready to start.'));
  }
  $('msBlockers').innerHTML = running ? li('ok', 'Mission running.') : b.join('');
}

function renderLive(s) {
  const m = s.mission, g = s.gps;
  const st = m?.state || s.fsmState;
  set('msState', st ? (MISSION_STATE[st]?.label || st) : '--');
  set('msWp', m?.wp_index ? `${m.wp_index} / ${m.wp_total}` : m?.state === 'RETURN_HOME' ? 'home' : '--');
  set('msDist', m?.dist_m != null ? `${m.dist_m} m` : '--');
  set('msGps', m?.gps ? (m.gps.fresh ? `${m.gps.sats ?? '?'} sats · HDOP ${m.gps.hdop ?? '?'}` : 'no fix') : (hasFix(g) ? 'fix' : '--'));
  set('msHead', g && g.heading != null && g.heading_valid !== false ? `${Number(g.heading).toFixed(0)}°` : '--');
  set('msReason', m?.reason ? `Boat: ${m.reason}${m.comms_lost ? ' · cloud link lost' : ''}` : '');
  if (!map) return;
  if (hasFix(g)) {
    layers.boat.setLatLng([Number(g.latitude), Number(g.longitude)]).setOpacity(1);
    const el = layers.boat.getElement()?.firstElementChild;
    if (el && g.heading != null && g.heading_valid !== false) el.style.transform = `rotate(${Number(g.heading)}deg)`;
  }
  if (m?.target && ['NAVIGATE', 'RETURN_HOME'].includes(m.state)) layers.target.setLatLng([m.target.lat, m.target.lon]).setStyle({ opacity: 1 });
  else layers.target.setStyle({ opacity: 0 });
}

function renderSend(s) {
  const r = s.missionResult, a = s.missionPlanAck;
  let t = 'Not sent yet.';
  if (sentId) {
    if (a && a.id === sentId) t = a.ok ? `✓ Boat accepted "${plan.name || sentId}".` : `✗ Boat rejected the plan: ${(a.errors || []).join('; ')}`;
    else if (r && r.id === sentId && !r.ok) t = `✗ Not sent: ${(r.errors || []).join('; ')}`;
    else if (r && r.id === sentId) t = 'Sent. Waiting for the boat to confirm…';
    else t = 'Sending…';
  }
  set('msSendMsg', t);
}

// ── wiring ──────────────────────────────────────────────────────────────────
function wire() {
  document.querySelectorAll('[data-ms-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.msMode;
    document.querySelectorAll('[data-ms-mode]').forEach((x) => x.classList.toggle('active', x === b));
    renderEditor();
  }));
  $('msName').addEventListener('input', (e) => { plan.name = e.target.value.replace(/[^\w .,()-]/g, ''); saveDraft(); });
  $('msName').addEventListener('change', edited);
  $('msLaunch').addEventListener('change', (e) => { if (e.target.checked) { plan.home = null; edited(); } });
  $('msList').addEventListener('click', (e) => {
    const up = e.target.closest('[data-ms-up]')?.dataset.msUp;
    if (up != null && isOperator()) {
      const w = plan.waypoints, k = Number(up);
      [w[k - 1], w[k]] = [w[k], w[k - 1]];
      edited();
      return;
    }
    const i = e.target.closest('[data-ms-del]')?.dataset.msDel;
    if (i == null || !isOperator()) return;
    if (mode === 'home') plan.home = null; else plan[mode].splice(Number(i), 1);
    edited();
  });
  $('msUndo').addEventListener('click', () => { if (mode === 'home') plan.home = null; else plan[mode].pop(); edited(); });
  $('msClear').addEventListener('click', () => {
    if (!confirm(`Delete all ${mode === 'home' ? 'home' : mode} points?`)) return;
    if (mode === 'home') plan.home = null; else plan[mode] = [];
    edited();
  });
  $('msCapture').addEventListener('click', startCapture);
  $('msSend').addEventListener('click', () => {
    if (checkPlan(plan).errors.length) return;
    sentId = plan.id;
    if (!uploadPlan(plan)) set('msSendMsg', '✗ Not connected to the backend.');
    else renderSend(getState());
  });
  $('msStart').addEventListener('click', () => {
    if (confirm(`Start "${plan.name || 'this plan'}"? Make sure the area is clear.`)) startMission();
  });
  $('msAbort').addEventListener('click', () => abortMission(true));
  $('msHold').addEventListener('click', () => abortMission(false));
  $('msRth').addEventListener('click', () => { if (confirm('Send the boat home?')) returnHome(); });
  $('msEstop').addEventListener('click', emergencyStop);
  $('msExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(planForBoat(plan), null, 1)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${(plan.name || 'mission').replace(/\W+/g, '_')}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('msImportBtn').addEventListener('click', () => $('msImport').click());
  $('msImport').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      plan = parsePlanFile(await f.text());
      edited();
      const pts = [...plan.fence, ...plan.waypoints];
      if (map && pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 19 });
    } catch (err) { alert(`Could not read that file: ${err.message}`); }
  });
  $('msNew').addEventListener('click', () => { if (confirm('Start a new empty plan? (Export the current one first if you need it.)')) { plan = emptyPlan(); edited(); } });
}

export function mountMissionPage() {
  document.getElementById('nav-manual')?.insertAdjacentHTML('afterend',
    '<button class="nav-btn" id="nav-mission" data-page="mission">Mission</button>');
  document.getElementById('app').insertAdjacentHTML('beforeend', PAGE);
  mountOperatorLock($('msOpSlot'), 'append');
  wire();
  subscribe((s, keys) => {
    if (keys.includes('gps')) onGpsForCapture(s.gps);
    if (keys.includes('operator')) { draw(); renderEditor(); }
    if (keys.some((k) => ['mission', 'connection'].includes(k))) renderBoatButtons(s);
    if (keys.includes('connection')) renderEditor();
    if (keys.some((k) => ['missionResult', 'missionPlanAck'].includes(k))) renderSend(s);
    if (keys.some((k) => ['gps', 'mission', 'fsmState'].includes(k))) renderLive(s);
  });
  renderEditor();
  renderLive(getState());
}

export const ensureMissionMap = () => ensure();
