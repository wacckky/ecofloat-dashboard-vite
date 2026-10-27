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

function render(s, keys) {
  if (!map) return;
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
  drone = L.marker(MAP_DEFAULT_CENTER, { icon: icon('🚤', 30) }).addTo(map).bindPopup('<b>EcoFloat 01</b>');
  line = L.polyline([], { color: '#00c8b4', weight: 2, opacity: 0.7, dashArray: '6,4' }).addTo(map);
  render(getState(), ['gps', 'path', 'detections']);
}

export const initMap = () => subscribe(render);
