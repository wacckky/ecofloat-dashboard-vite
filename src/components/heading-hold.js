// L1 heading hold panel (Manual page, operator only).
// The boat keeps a compass heading by itself at the chosen speed. Touching the
// joystick/keys or Emergency Stop cancels it on the boat. Status comes from the
// boat's telemetry/mission message ("hold" field).
import { send } from '../services/websocket.js';
import { isOperator } from '../services/auth.js';
import { subscribe, getState } from '../store/store.js';
import { $, set } from '../utils/dom.js';
import { escapeHtml } from '../utils/format.js';
import { HEADING_HOLD as H } from '../config/constants.js';

const HTML = `
<div class="panel-card" id="hhCard">
  <div class="panel-title">Heading hold (L1) <div class="panel-title-dot"></div></div>
  <div class="hh-grid">
    <div><label>Target</label><b id="hhTarget">--</b></div>
    <div><label>Error</label><b id="hhErr">--</b></div>
    <div><label>Time</label><b id="hhTime">--</b></div>
    <div><label>Within ±${H.bandDeg}°</label><b id="hhBand">--</b></div>
  </div>
  <div class="hh-row">
    <label for="hhSpeed">Speed <b id="hhSpeedVal">${H.speedDefault}</b> %</label>
    <input type="range" id="hhSpeed" min="${H.speedMin}" max="${H.speedMax}" step="5" value="${H.speedDefault}">
  </div>
  <div class="hh-row">
    <label for="hhDur">Duration</label>
    <select id="hhDur" class="ms-input hh-select">${H.durations.map((d) =>
      `<option value="${d}" ${d === H.durationDefault ? 'selected' : ''}>${d} s${d === 60 ? ' (FR-4 test)' : ''}</option>`).join('')}</select>
  </div>
  <button class="cmd-btn ms-go" id="hhStart">🧭 Hold current heading</button>
  <div class="ms-row">
    <button class="cmd-btn cmd-home" id="hhLeft">◀ −${H.stepDeg}°</button>
    <button class="cmd-btn cmd-home" id="hhRight">+${H.stepDeg}° ▶</button>
  </div>
  <button class="cmd-btn cmd-home" id="hhStop">■ Stop hold</button>
  <ul class="ms-checks" id="hhMsg"></ul>
</div>`;

const hold = (action, extra = {}) => send({ type: 'command', command: 'heading_hold', action, ...extra });
const li = (cls, t) => `<li class="${cls}">${escapeHtml(t)}</li>`;

function render(s) {
  const m = s.mission, h = m?.hold, op = isOperator(), online = s.connection === 'online';
  const holding = m?.state === 'HEADING_HOLD';
  $('hhCard').classList.toggle('hh-locked', !op);
  set('hhTarget', h ? `${Math.round(h.target_deg) % 360}°` : '--');
  set('hhErr', holding && h?.err_deg != null ? `${h.err_deg > 0 ? '+' : ''}${h.err_deg.toFixed(1)}°` : '--');
  set('hhTime', holding && h?.elapsed_s != null ? `${Math.round(h.elapsed_s)} / ${Math.round(h.max_s)} s` : '--');
  set('hhBand', h?.stats?.pct_within_band != null ? `${h.stats.pct_within_band}%` : '--');
  $('hhStart').disabled = !op || !online || holding || !m?.hold_ready;
  $('hhLeft').disabled = $('hhRight').disabled = $('hhStop').disabled = !op || !online || !holding;

  const msg = [];
  if (!op) msg.push(li('warn', 'Unlock with the operator key (Link check panel) to use heading hold.'));
  else if (!m) msg.push(li('warn', 'No status from the boat yet (is run_boat running?).'));
  else if (holding) msg.push(li('ok', 'Holding. Touching the joystick or keys cancels it.'));
  else {
    (m.hold_blockers || []).forEach((b) => msg.push(li('bad', b)));
    if (m.hold_ready) msg.push(li('ok', '✓ Ready. Point the boat roughly where you want, then press Hold.'));
  }
  if (!holding && h && m?.reason?.startsWith('heading hold')) {
    msg.push(li('ok', `Boat: ${m.reason}`));
    const st = h.stats;
    if (st?.samples) {
      msg.push(li('ok', `Last hold: mean error ${st.mean_abs_err_deg}°, max ${st.max_abs_err_deg}°, `
        + `${st.pct_within_band}% within ±${st.band_deg}°${h.log_file ? ` (log ${h.log_file})` : ''}`));
    }
  }
  $('hhMsg').innerHTML = msg.join('');
}

export function mountHeadingHold(slot) {
  slot.insertAdjacentHTML('beforeend', HTML);
  const speed = () => Number($('hhSpeed').value);
  $('hhSpeed').addEventListener('input', () => set('hhSpeedVal', speed()));
  $('hhSpeed').addEventListener('change', () => { if (getState().mission?.state === 'HEADING_HOLD') hold('speed', { speed: speed() }); });
  $('hhStart').addEventListener('click', () => hold('start', { speed: speed(), duration_s: Number($('hhDur').value) }));
  $('hhLeft').addEventListener('click', () => hold('adjust', { delta: -H.stepDeg }));
  $('hhRight').addEventListener('click', () => hold('adjust', { delta: H.stepDeg }));
  $('hhStop').addEventListener('click', () => hold('stop'));
  subscribe((s, keys) => { if (keys.some((k) => ['mission', 'connection', 'operator'].includes(k))) render(s); });
  render(getState());
}
