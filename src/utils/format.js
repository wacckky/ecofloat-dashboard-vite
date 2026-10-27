export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function safeUrl(url) {
  try { const u = new URL(url); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; }
  catch { return ''; }
}

export const fmtCoord = (n, digits = 5) => Number(n).toFixed(digits);
export const fmtPercent = (n, digits = 0) => `${Number(n || 0).toFixed(digits)}%`;
export const fmtTime = (ts) => new Date(ts).toLocaleTimeString();

// Real distance between GPS points (replaces the old `points * 0.5` guess)
export function haversine([lat1, lon1], [lat2, lon2]) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function pathLengthMeters(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversine(coords[i - 1], coords[i]);
  return total;
}
