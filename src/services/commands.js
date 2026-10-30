import { send } from './websocket.js';
import { MOTOR_CMD, MOTOR_RESEND_MS } from '../config/constants.js';
import { stopThrusters } from './thrusters.js';

let current = MOTOR_CMD.STOP;
let timer = null;

// Wire format is unchanged from the old dashboard, so the backend needs no edits.
const sendMotor = (command) => send({ type: 'motor_command', command });

export function setMotor(cmd) {
  if (cmd === current) return current;
  current = cmd;
  clearInterval(timer);
  sendMotor(cmd);
  if (cmd !== MOTOR_CMD.STOP) timer = setInterval(() => sendMotor(cmd), MOTOR_RESEND_MS);
  return current;
}

export const stopMotors = () => setMotor(MOTOR_CMD.STOP);
export const stopAll = () => { stopMotors(); stopThrusters(); };

// Emergency stop: no confirm() dialog, it must be instant.
export const emergencyStop = () => { stopAll(); return send({ type: 'command', command: 'stop' }); };

// Return-to-home is not safety critical, so the UI may confirm before calling this.
export const returnHome = () => send({ type: 'command', command: 'return_home' });

// If the tab loses focus, key/mouse "up" events can be missed. Stop the motors.
export function installSafetyStops() {
  window.addEventListener('blur', stopAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });
  window.addEventListener('beforeunload', stopAll);
}
