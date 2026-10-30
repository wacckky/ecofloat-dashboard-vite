import L from 'leaflet';
import { subscribe, getState, keyOf } from '../store/store.js';
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from '../config/constants.js';
import { escapeHtml, fmtTime } from '../utils/format.js';
import { hasFix } from './panels.js';

let map, drone, line;
const markers = new Map(); // detection key -> marker (prevents duplicates)

const icon = (emoji, size) => L.divIcon({
  html: `<div style="font-size:${size}px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))">${emoji}</div>`,
  iconSize: [size + 4, size + 4], className: '',
});

// Boat marker: an SVG arrow that rotates with the calibrated compass heading (map stays north-up)
const ARROW = '<div class="drone-arrow no-heading"><svg viewBox="0 0 36 36"><path d="M18 3 L29 31 L18 25 L7 31 Z" fill="#00c8b4" stroke="#020b12" stroke-width="2" stroke-linejoin="round"/></svg></div>';
const droneIcon = L.divIcon({ html: ARROW, iconSize: [36, 36], iconAnchor: [18, 18], className: '' });
let rotation = 0;

function setHeading(g) {
  const el = drone?.getElement()?.firstElementChild;
  if (!el) return;
  const h = Number(g?.heading);
  const valid = g && g.heading != null && g.heading_valid !== false && Number.isFinite(h);
  el.classList.toggle('no-heading', !valid);   // grey arrow = heading unavailable
  if (!valid) return;
  rotation += ((h - rotation) % 360 + 540) % 360 - 180;   // shortest turn: no spin at 359 -> 1
  el.style.transform = `rotate(${rotation}deg)`;
}

function render(s, keys) {
  if (!map) return;
  if (keys.includes('gps')) setHeading(s.gps);
  if (keys.includes('gps') && hasFix(s.gps)) {
    const pos = [Number(s.gps.latitude), Number(s.gps.longitude)];
    drone.setLatLng(pos);
    map.panTo(pos);
  }
  if (keys.includes('path')) line.setLatLngs(s.path);
  if (keys.includes('detections')) {
    for (const d of s.detections) {
      const k = keyOf(d);
      if (markers.has(k)) continue;
      markers.set(k, L.marker([d.latitude, d.longitude], { icon: icon('🗑️', 18) })
        .bindPopup(`<b>🗑️ ${escapeHtml(d.label)}</b><br>Confidence: ${((d.confidence || 0) * 100).toFixed(1)}%<br>${fmtTime(d.timestamp)}`)
        .addTo(map));
    }
  }
}

// Called by the router when the Dashboard page is first shown (container must be visible)
export function ensureMap() {
  if (map) { map.invalidateSize(); return; }
  map = L.map('map').setView(MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
  drone = L.marker(MAP_DEFAULT_CENTER, { icon: droneIcon }).addTo(map).bindPopup('<b>EcoFloat 01</b>');
  line = L.polyline([], { color: '#00c8b4', weight: 2, opacity: 0.7, dashArray: '6,4' }).addTo(map);
  render(getState(), ['gps', 'path', 'detections']);
}

export const initMap = () => subscribe(render);
