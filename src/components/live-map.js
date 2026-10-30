import L from 'leaflet';
import { subscribe, getState, keyOf } from '../store/store.js';
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM } from '../config/constants.js';
import { escapeHtml, fmtTime } from '../utils/format.js';
import { hasFix } from './panels.js';

const ARROW = '<div class="drone-arrow no-heading"><svg viewBox="0 0 36 36"><path d="M18 3 L29 31 L18 25 L7 31 Z" fill="#00c8b4" stroke="#020b12" stroke-width="2" stroke-linejoin="round"/></svg></div>';
const droneIcon = () => L.divIcon({ html: ARROW, iconSize: [36, 36], iconAnchor: [18, 18], className: '' });
const trashIcon = () => L.divIcon({
  html: '<div style="font-size:18px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))">🗑️</div>',
  iconSize: [22, 22], className: '',
});

export function createLiveMap(containerId) {
  let map, drone, line, rotation = 0;
  const markers = new Map();               // detection key -> marker (prevents duplicates)

  function setHeading(g) {
    const el = drone?.getElement()?.firstElementChild;
    if (!el) return;
    const h = Number(g?.heading);
    const valid = g && g.heading != null && g.heading_valid !== false && Number.isFinite(h);
    el.classList.toggle('no-heading', !valid);
    if (!valid) return;
    rotation += ((h - rotation) % 360 + 540) % 360 - 180;   // shortest turn
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
        markers.set(k, L.marker([d.latitude, d.longitude], { icon: trashIcon() })
          .bindPopup(`<b>🗑️ ${escapeHtml(d.label)}</b><br>Confidence: ${((d.confidence || 0) * 100).toFixed(1)}%<br>${fmtTime(d.timestamp)}`)
          .addTo(map));
      }
    }
  }

  // Call when the page is shown (the container must be visible to get a size)
  function ensure() {
    if (map) { map.invalidateSize(); return; }
    if (!document.getElementById(containerId)) return;
    map = L.map(containerId).setView(MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    drone = L.marker(MAP_DEFAULT_CENTER, { icon: droneIcon() }).addTo(map).bindPopup('<b>EcoFloat 01</b>');
    line = L.polyline([], { color: '#00c8b4', weight: 2, opacity: 0.7, dashArray: '6,4' }).addTo(map);
    render(getState(), ['gps', 'path', 'detections']);
  }

  return { ensure, init: () => subscribe(render) };
}
