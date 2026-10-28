import { showPage } from '../pages/router.js';
import { setRange } from '../pages/analytics.js';
import { press, sendCommand } from '../components/control-pad.js';
import { MOTOR_CMD } from '../config/constants.js';

// One delegated listener per event type replaces all the old inline onclick attributes.
export function initEvents() {
  document.addEventListener('click', (e) => {
    const page = e.target.closest('[data-page]');
    if (page) return showPage(page.dataset.page);
    const range = e.target.closest('[data-range]');
    if (range) return setRange(range.dataset.range, range);
    const cmd = e.target.closest('[data-command]');
    if (cmd) sendCommand(cmd.dataset.command);
  });

  // Hold-to-drive buttons (pointer events cover mouse and touch)
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-motor]');
    if (b) { e.preventDefault(); press(b.dataset.motor); }
  });
  const release = (e) => {
    const b = e.target.closest('[data-motor]');
    if (b && b.dataset.motor !== MOTOR_CMD.STOP) press(MOTOR_CMD.STOP);
  };
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
  document.addEventListener('pointerleave', (e) => { if (e.target.matches?.('[data-motor]')) release(e); }, true);
}
