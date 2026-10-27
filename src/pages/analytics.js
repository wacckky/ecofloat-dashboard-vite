import L from 'leaflet';
import { getState } from '../store/store.js';
import { api } from '../services/api.js';
import { $, set } from '../utils/dom.js';
import { MAP_DEFAULT_CENTER } from '../config/constants.js';
import { escapeHtml, safeUrl, fmtCoord, pathLengthMeters } from '../utils/format.js';

const DAY = 86400000;
const RANGE_MS = { today: DAY, '7days': 7 * DAY, '30days': 30 * DAY };
let currentRange = 'today';
let heat, heatLayer;

function renderHeatmap(data) {
  if (!heat) {
    heat = L.map('heatmap', { zoomControl: false, attributionControl: false }).setView(MAP_DEFAULT_CENTER, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(heat);
    heatLayer = L.layerGroup().addTo(heat);
  }
  heat.invalidateSize();
  heatLayer.clearLayers();
  data.forEach((d) => L.circleMarker([d.latitude, d.longitude],
    { radius: 12, fillColor: '#f59e0b', fillOpacity: 0.4, color: '#f59e0b', weight: 1, opacity: 0.6 }).addTo(heatLayer));
}

function renderBarChart(data) {
  const chart = $('barChart');
  if (!chart) return;
  const hours = Array.from({ length: 24 }, (_, h) => data.filter((d) => new Date(d.timestamp).getHours() === h).length);
  const max = Math.max(...hours, 1);
  chart.innerHTML = hours.map((v, h) => `
    <div class="bar-wrap" title="${v} detections at ${h}:00">
      <div class="bar" style="height:${(v / max) * 120 + 4}px"></div>
    </div>`).join('');
}

function animateCount(id, target) {
  const el = $(id);
  if (!el) return;
  let cur = 0;
  const step = Math.max(1, Math.ceil(target / 30));
  const timer = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(timer);
  }, 30);
}

function renderTable(data) {
  const body = $('logTableBody');
  if (!body) return;
  if (!data.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:24px">// no detection logs yet</td></tr>';
    return;
  }
  body.innerHTML = data.slice(0, 30).map((d) => {
    const conf = ((d.confidence || 0) * 100).toFixed(0);
    const badge = `<span class="${d.label === 'litter' ? 'badge-litter' : 'badge-obstacle'}">${escapeHtml(d.label)}</span>`;
    const url = safeUrl(d.image_url);
    const img = url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="color:var(--teal);font-size:0.68rem">View</a>` : '<span style="color:var(--text3)">—</span>';
    return `<tr>
      <td>${new Date(d.timestamp).toLocaleString()}</td><td>${badge}</td>
      <td><div class="conf-bar"><div class="conf-fill" style="width:${conf * 0.6}px"></div><span>${conf}%</span></div></td>
      <td>${fmtCoord(d.latitude)}</td><td>${fmtCoord(d.longitude)}</td><td>${img}</td></tr>`;
  }).join('');
}

export async function initAnalytics() {
  try {
    const all = await api.detections(200);
    if (!Array.isArray(all)) return;
    const cutoff = Date.now() - RANGE_MS[currentRange];
    const data = all.filter((d) => new Date(d.timestamp).getTime() > cutoff);
    const meters = Math.round(pathLengthMeters(getState().path));

    animateCount('aTotal', data.length);
    animateCount('aDist', meters);
    set('aCycles', '—'); // needs real mission data (future /api/missions endpoint)
    set('aTotalDelta', `↑ ${data.length} events`);
    set('aDistDelta', `↑ ${meters}m (current session path)`);
    set('aCyclesDelta', 'needs mission data');
    renderHeatmap(data);
    renderBarChart(data);
    renderTable(data);
  } catch (e) {
    console.warn('Analytics error:', e);
  }
}

export function setRange(range, btn) {
  currentRange = range;
  document.querySelectorAll('.range-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  initAnalytics();
}
