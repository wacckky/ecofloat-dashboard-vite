import { $, set } from '../utils/dom.js';
import { setMotor, emergencyStop, returnHome, installSafetyStops } from '../services/commands.js';
import { isOpen } from '../services/websocket.js';
import { MOTOR_CMD } from '../config/constants.js';
import { getCurrentPage } from '../pages/router.js';

const LABELS = { F: 'FORWARD', B: 'BACKWARD', L: 'LEFT', R: 'RIGHT', S: 'IDLE' };
const KEYS = { w: 'F', a: 'L', s: 'B', d: 'R', ' ': 'S', ArrowUp: 'F', ArrowLeft: 'L', ArrowDown: 'B', ArrowRight: 'R' };

export function press(cmd) {
  const c = setMotor(cmd);
  document.querySelectorAll('.motor-btn').forEach((b) => b.classList.remove('active'));
  $(`btn-${c}`)?.classList.add('active');
  set('motorCmdStatus', LABELS[c]);
}

export function sendCommand(cmd) {
  if (!isOpen()) { alert('Not connected to backend!'); return; }
  if (cmd === 'stop') { emergencyStop(); press(MOTOR_CMD.STOP); return; } // instant, no confirm
  if (confirm('Send Return to Home command?')) returnHome();
}

export function initControlPad() {
  installSafetyStops();
  window.addEventListener('blur', () => press(MOTOR_CMD.STOP));
  document.addEventListener('keydown', (e) => {
    if (getCurrentPage() !== 'dashboard' || !KEYS[e.key]) return;
    e.preventDefault();
    press(KEYS[e.key]);
  });
  document.addEventListener('keyup', (e) => {
    if (getCurrentPage() !== 'dashboard' || !KEYS[e.key] || e.key === ' ') return;
    press(MOTOR_CMD.STOP);
  });
}
