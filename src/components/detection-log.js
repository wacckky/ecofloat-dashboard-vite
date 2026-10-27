import { subscribe } from '../store/store.js';
import { $ } from '../utils/dom.js';
import { escapeHtml, fmtCoord, fmtTime } from '../utils/format.js';

export function initDetectionLog() {
  subscribe((s, keys) => {
    if (!keys.includes('detections')) return;
    const log = $('detectionLog');
    if (!log) return;
    if (!s.detections.length) { log.innerHTML = '<div class="empty-state">// awaiting data</div>'; return; }
    log.innerHTML = s.detections.slice(0, 15).map((d) => `
      <div class="detection-item">
        <div class="d-top">
          <span class="d-label">🗑️ ${escapeHtml(d.label)}</span>
          <span class="d-conf">${((d.confidence || 0) * 100).toFixed(0)}%</span>
        </div>
        <div class="d-coords">${fmtCoord(d.latitude)}, ${fmtCoord(d.longitude)}</div>
        <div class="d-time">${fmtTime(d.timestamp)}</div>
      </div>`).join('');
  });
}
