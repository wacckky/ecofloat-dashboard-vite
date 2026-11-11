// Geometry for the mission planner. Same maths as the Pi (app/navigation/geo.py):
// a flat local frame in metres around a reference point is accurate enough for a few km.
import { haversine } from './format.js';

export { haversine };

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function localFrame([lat0, lon0]) {
  const k = Math.cos(rad(lat0));
  return {
    xy: ([lat, lon]) => [rad(lon - lon0) * R * k, rad(lat - lat0) * R],
  };
}

export function pointInPolygon([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function segmentsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/** A fence made of [lat, lon] points (open polygon: the last point joins the first). */
export function makeFence(latlons) {
  const f = localFrame(latlons[0]);
  const poly = latlons.map(f.xy);
  const edges = poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
  return {
    contains: (ll) => pointInPolygon(f.xy(ll), poly),
    marginM: (ll) => Math.min(...edges.map(([a, b]) => distToSegment(f.xy(ll), a, b))),
    selfIntersects: () => {
      for (let i = 0; i < edges.length; i++) {
        for (let j = i + 1; j < edges.length; j++) {
          if (j === i + 1 || (i === 0 && j === edges.length - 1)) continue;   // neighbours share a corner
          if (segmentsCross(edges[i][0], edges[i][1], edges[j][0], edges[j][1])) return true;
        }
      }
      return false;
    },
    /** Does the straight line a->b leave the fence anywhere? (checked every metre) */
    legLeaves: (a, b) => {
      const A = f.xy(a), B = f.xy(b), n = Math.max(2, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1])));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        if (!pointInPolygon([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t], poly)) return true;
      }
      return false;
    },
  };
}
