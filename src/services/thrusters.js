import { send } from './websocket.js';

// While active, the current left/right power is resent every 200 ms. This is also the
// keep-alive: the Pi stops the motors about 1 s after the messages stop (see the contract).
const PUMP_MS = 200;
let timer = null;
let cur = { left: 0, right: 0 };
const r2 = (n) => Math.round(n * 100) / 100;
const push = () => send({ type: 'thruster', left: r2(cur.left), right: r2(cur.right) });

export function setThrusters(left, right) {
  cur = { left, right };
  if (!timer) { push(); timer = setInterval(push, PUMP_MS); }
}

export function stopThrusters() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  cur = { left: 0, right: 0 };
  push();                                   // explicit zero
}
