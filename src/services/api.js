import { env } from '../config/env.js';
import { API_TIMEOUT_MS } from '../config/constants.js';

async function request(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.apiUrl}${path}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  gpsHistory: (limit = 200) => request(`/api/gps/history?limit=${limit}`),
  detections: (limit = 50) => request(`/api/detections?limit=${limit}`),
  systemLatest: () => request('/api/system/latest'),
  motorsLatest: () => request('/api/motors/latest'),
  binLatest: () => request('/api/bin/latest'),
};

// Runs all requests in parallel; one failure does not block the others.
export async function loadInitialData() {
  const [gps, det, sys, mot, bin] = await Promise.allSettled([
    api.gpsHistory(), api.detections(), api.systemLatest(), api.motorsLatest(), api.binLatest(),
  ]);
  const ok = (r) => (r.status === 'fulfilled' ? r.value : null);
  return { gps: ok(gps), detections: ok(det), system: ok(sys), motors: ok(mot), bin: ok(bin) };
}
