import { subscribe, getState } from '../store/store.js';
import { $, set } from '../utils/dom.js';
import { isOperator } from '../services/auth.js';
import { reconnectNow } from '../services/websocket.js';
import { requestHeartbeat } from '../services/heartbeat.js';
import { setMotor, emergencyStop, stopAll } from '../services/commands.js';
import { setThrusters, stopThrusters } from '../services/thrusters.js';
import { mixJoystick } from '../utils/drive-math.js';
import { createLiveMap } from '../components/live-map.js';
import { mountOperatorLock } from '../components/operator-lock.js';
import { MISSION_STATE, MOTOR_CMD } from '../config/constants.js';

const PAGE = `
<div id="page-manual" class="page">
 <div class="mc-layout">
  <div class="mc-controls">
    <div class="panel-card">
      <div class="panel-title">Link check <div class="panel-title-dot"></div></div>
      <div class="mc-hb" id="mcSession">--</div>
      <button class="cmd-btn cmd-home" id="mcConnect">Connect to EcoFloat</button>
      <div class="mc-hb" id="mcHbText">Heartbeat: not checked yet</div>
      <button class="cmd-btn cmd-home" id="mcHeartbeat">Request device heartbeat</button>
      <div id="mcOpSlot"></div>
    </div>
    <div class="panel-card">
      <div class="panel-title">Controller <div class="panel-title-dot"></div></div>
      <div class="time-range mc-tabs">
        <button class="range-btn active" data-mc-mode="keys">Keyboard</button>
        <button class="range-btn" data-mc-mode="joystick">Joystick</button>
        <button class="range-btn" data-mc-mode="thrusters">Thrusters</button>
      </div>
      <div class="mc-pad" id="mcPad">
        <div class="mc-mode active" data-mode-panel="keys">
          <div class="mc-dpad">
            <div></div><button class="motor-btn" data-mm="F">▲<br><span>FORWARD (W)</span></button><div></div>
            <button class="motor-btn" data-mm="L">◄<br><span>LEFT (A)</span></button>
            <button class="motor-btn motor-stop" data-mm="S">■<br><span>STOP (SPACE)</span></button>
            <button class="motor-btn" data-mm="R">►<br><span>RIGHT (D)</span></button>
            <div></div><button class="motor-btn" data-mm="B">▼<br><span>BACK (S)</span></button><div></div>
          </div>
        </div>
        <div class="mc-mode" data-mode-panel="joystick">
          <div class="mc-joy" id="mcJoy"><div class="mc-knob" id="mcKnob"></div></div>
          <div class="eco-sub" id="mcJoyOut" style="text-align:center">L 0% · R 0%</div>
        </div>
        <div class="mc-mode" data-mode-panel="thrusters">
          <div class="mc-th">
            <button class="motor-btn" id="thL" data-th="l">◄ LEFT THRUSTER<br><span>HOLD · KEY A</span></button>
            <button class="motor-btn" id="thR" data-th="r">RIGHT THRUSTER ►<br><span>HOLD · KEY D</span></button>
          </div>
        </div>
        <div class="mc-power" id="mcPowerRow">
          <label>Max power <b id="mcPowerVal">50%</b></label>
          <input type="range" id="mcPower" min="10" max="100" step="5" value="50">
        </div>
      </div>
      <button class="cmd-btn cmd-stop" id="mcEstop" style="margin-top:12px">🛑 Emergency Stop</button>
      <div class="mc-hint" id="mcHint"></div>
    </div>
  </div>
  <div class="mc-map-col">
    <div id="manualMap"></div>
    <div class="mc-strip">
      <div class="stat-box"><label>State</label><div class="val" id="mcState">--</div></div>
      <div class="stat-box"><label>Battery</label><div class="val" id="mcBat">--</div></div>
      <div class="stat-box"><label>Heading</label><div class="val" id="mcHead">--</div></div>
      <div class="stat-box"><label>Speed</label><div class="val" id="mcSpeed">--</div></div>
      <div class="stat-box"><label>Motors L / R</label><div class="val" id="mcMotors">--</div></div>
    </div>
  </div>
 </div>
</div>`;

const HINTS = {
  keys: 'W A S D or arrow keys. Space stops. Buttons work on phones too.',
  joystick: 'Drag the stick. Up = forward, sideways = turn. Release to stop.',
  thrusters: 'Hold A or D (or the buttons) for the left or right thruster. Both = straight ahead.',
};
const KEYS = { w: 'F', a: 'L', s: 'B', d: 'R', ArrowUp: 'F', ArrowLeft: 'L', ArrowDown: 'B', ArrowRight: 'R' };
const manualMap = createLiveMap('manualMap');
const held = { l: false, r: false };
let mode = 'keys';

const active = () => $('page-manual')?.classList.contains('active');
const power = () => Number($('mcPower').value) / 100;

function hint(msg, warn) {
  const el = $('mcHint');
  el.textContent = msg;
  el.classList.toggle('mc-warn', !!warn);
  if (warn) setTimeout(() => hint(HINTS[mode]), 2500);
}
function allowed() {
  if (isOperator()) return true;
  hint('🔒 Unlock controls with the operator key first', true);
  return false;
}

const markPad = (cmd) => document.querySelectorAll('[data-mm]').forEach((b) => b.classList.toggle('active', b.dataset.mm === cmd));
function drive(cmd) { setMotor(cmd); markPad(cmd); }

function applyThrusters() {
  $('thL').classList.toggle('active', held.l);
  $('thR').classList.toggle('active', held.r);
  if (!held.l && !held.r) stopThrusters();
  else { const p = power(); setThrusters(held.l ? p : 0, held.r ? p : 0); }
}

const joy = () => $('mcJoy');
function joyMove(e) {
  const r = joy().getBoundingClientRect(), rad = r.width / 2;
  let x = (e.clientX - r.left - rad) / rad, y = (e.clientY - r.top - rad) / rad;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  $('mcKnob').style.transform = `translate(${x * (rad - 32)}px, ${y * (rad - 32)}px)`;
  const { left, right } = mixJoystick(x, y), p = power();
  setThrusters(left * p, right * p);
  set('mcJoyOut', `L ${Math.round(left * p * 100)}% · R ${Math.round(right * p * 100)}%`);
}
function joyEnd() {
  joy().classList.remove('dragging');
  $('mcKnob').style.transform = '';
  set('mcJoyOut', 'L 0% · R 0%');
  stopThrusters();
}

// Stop everything and reset every control to its resting look
function halt() {
  stopAll();
  held.l = held.r = false;
  markPad(null);
  $('thL')?.classList.remove('active');
  $('thR')?.classList.remove('active');
  if ($('mcJoy')) joyEnd();
}

function setMode(m) {
  halt();
  mode = m;
  document.querySelectorAll('[data-mode-panel]').forEach((p) => p.classList.toggle('active', p.dataset.modePanel === m));
  document.querySelectorAll('[data-mc-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mcMode === m));
  $('mcPowerRow').style.display = m === 'keys' ? 'none' : 'block';   // keyboard mode uses the Pi's own speeds
  hint(HINTS[m]);
}

function wire() {
  $('mcConnect').addEventListener('click', reconnectNow);
  $('mcHeartbeat').addEventListener('click', requestHeartbeat);
  $('mcEstop').addEventListener('click', () => { halt(); emergencyStop(); });
  document.querySelectorAll('[data-mc-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mcMode)));
  $('mcPower').addEventListener('input', () => { set('mcPowerVal', `${$('mcPower').value}%`); if (mode === 'thrusters') applyThrusters(); });
  $('mcPower').addEventListener('change', (e) => e.target.blur());   // so A/D keys keep working

  joy().addEventListener('pointerdown', (e) => {
    if (!allowed()) return;
    e.preventDefault();
    joy().setPointerCapture(e.pointerId);
    joy().classList.add('dragging');
    joyMove(e);
  });
  joy().addEventListener('pointermove', (e) => { if (joy().hasPointerCapture(e.pointerId)) joyMove(e); });
  joy().addEventListener('pointerup', joyEnd);
  joy().addEventListener('pointercancel', joyEnd);

  document.addEventListener('pointerdown', (e) => {
    if (!active()) return;
    const b = e.target.closest?.('[data-mm]');
    if (b) { e.preventDefault(); if (b.dataset.mm === MOTOR_CMD.STOP || allowed()) drive(b.dataset.mm); return; }
    const t = e.target.closest?.('[data-th]');
    if (t) { e.preventDefault(); if (allowed()) { held[t.dataset.th] = true; applyThrusters(); } }
  });
  const release = (e) => {
    if (!active()) return;
    const b = e.target.closest?.('[data-mm]');
    if (b && b.dataset.mm !== MOTOR_CMD.STOP) drive(MOTOR_CMD.STOP);
    const t = e.target.closest?.('[data-th]');
    if (t) { held[t.dataset.th] = false; applyThrusters(); }
  };
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
  document.addEventListener('pointerleave', (e) => { if (e.target.matches?.('[data-mm],[data-th]')) release(e); }, true);

  document.addEventListener('keydown', (e) => {
    if (!active() || e.target.matches?.('input[type=password], input[type=text], textarea')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === ' ') { e.preventDefault(); halt(); return; }            // space always stops
    if (mode === 'keys' && KEYS[k]) { e.preventDefault(); if (allowed()) drive(KEYS[k]); }
    else if (mode === 'thrusters' && (k === 'a' || k === 'd')) {
      e.preventDefault();
      if (allowed()) { held[k === 'a' ? 'l' : 'r'] = true; applyThrusters(); }
    }
  });
  document.addEventListener('keyup', (e) => {
    if (!active()) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (mode === 'keys' && KEYS[k]) drive(MOTOR_CMD.STOP);
    else if (mode === 'thrusters' && (k === 'a' || k === 'd')) { held[k === 'a' ? 'l' : 'r'] = false; applyThrusters(); }
  });
  window.addEventListener('blur', halt);
}

function render(s) {
  // Link check
  const online = s.connection === 'online';
  set('mcSession', online ? '✓ Session active (dashboard ↔ backend)'
    : s.connection === 'connecting' ? '… Connecting to backend' : '✗ No session, retrying automatically');
  $('mcConnect').disabled = online;
  $('mcConnect').textContent = online ? '✓ Connected to EcoFloat backend' : 'Connect to EcoFloat';
  const hb = s.heartbeat;
  const t = hb.timestamp && !Number.isNaN(Date.parse(hb.timestamp)) ? new Date(hb.timestamp).toLocaleTimeString() : hb.timestamp;
  set('mcHbText', {
    idle: 'Heartbeat: not checked yet',
    waiting: 'Heartbeat: waiting for EcoFloat…',
    ok: `✓ Heartbeat received\nDevice: ${hb.deviceId || '?'}\nState: ${hb.state || '?'}\nTimestamp: ${t || '?'}\nRound trip: ${hb.rttMs} ms`,
    timeout: '✗ No reply in 5 s. Is EcoFloat powered and online?',
    unreachable: '✗ The backend could not reach the MQTT broker',
  }[hb.status]);
  $('mcHeartbeat').disabled = !online || hb.status === 'waiting';
  $('mcPad').classList.toggle('mc-locked', !isOperator());

  // Live strip
  const m = MISSION_STATE[s.fsmState];
  set('mcState', m ? m.label : '--');
  const g = s.gps, sys = s.system, mot = s.motors;
  set('mcBat', sys ? (sys.battery_percent != null ? `${Math.round(sys.battery_percent)}%` : `${Number(sys.battery_voltage).toFixed(1)} V`) : '--');
  set('mcHead', g && g.heading != null && g.heading_valid !== false ? `${Number(g.heading).toFixed(0)}°` : '--');
  set('mcSpeed', g ? `${Number(g.speed || 0).toFixed(1)} m/s` : '--');
  set('mcMotors', mot ? `${mot.motor_left_throttle} / ${mot.motor_right_throttle}` : '--');
}

export function mountManualPage() {
  document.getElementById('nav-ecofloat')?.insertAdjacentHTML('afterend',
    '<button class="nav-btn" id="nav-manual" data-page="manual">Manual</button>');
  document.getElementById('app').insertAdjacentHTML('beforeend', PAGE);
  mountOperatorLock($('mcOpSlot'), 'append');
  manualMap.init();
  wire();
  subscribe(render);
  render(getState());
  setMode('keys');
}

export const ensureManualMap = () => manualMap.ensure();
export const leaveManual = () => halt();
