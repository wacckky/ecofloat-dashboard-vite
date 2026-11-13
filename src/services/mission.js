// Mission plans: checks, file import/export, and the messages to the boat.
// The Pi checks every plan again (app/supervisor.py) - these checks are here so the
// operator sees problems on the map before sending anything.
import { send } from './websocket.js';
import { makeFence, haversine } from '../utils/geo.js';
import { MISSION_LIMITS as L } from '../config/constants.js';

export const newPlanId = () => `p-${Date.now().toString(36)}`;
export const emptyPlan = () => ({ id: newPlanId(), name: '', fence: [], home: null, waypoints: [] });

const fmtM = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`);
const fmtT = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`);

/** Returns { errors: [], warnings: [], info: [] } in plain words. Errors block "Send to boat". */
export function checkPlan(p) {
  const errors = [], warnings = [], info = [];
  if (p.fence.length < 3) errors.push(`Fence needs at least 3 corners (has ${p.fence.length}).`);
  if (p.fence.length > L.maxFence) errors.push(`Fence has more than ${L.maxFence} corners.`);
  if (!p.waypoints.length) errors.push('Add at least 1 waypoint.');
  if (p.waypoints.length > L.maxWaypoints) errors.push(`More than ${L.maxWaypoints} waypoints.`);
  if (p.fence.length < 3) return { errors, warnings, info };

  const fence = makeFence(p.fence);
  if (fence.selfIntersects()) errors.push('The fence lines cross each other. Move or remove a corner.');
  const all = [...p.fence, ...p.waypoints, ...(p.home ? [p.home] : [])];
  if (all.some((q) => haversine(p.fence[0], q) > L.maxSpanM)) {
    errors.push(`A point is more than ${L.maxSpanM} m from the fence. Wrong click or typo?`);
  }
  p.waypoints.forEach((w, i) => {
    if (!fence.contains(w)) { errors.push(`Waypoint ${i + 1} is outside the fence.`); return; }
    const m = fence.marginM(w);
    if (m < L.tooCloseM) warnings.push(`Waypoint ${i + 1} is only ${m.toFixed(1)} m from the wall (GPS error is about ${L.gpsErrorM} m).`);
    else if (m < L.tightM) warnings.push(`Waypoint ${i + 1} is ${m.toFixed(1)} m from the wall: the boat will slow down there.`);
  });
  if (p.home) {
    if (!fence.contains(p.home)) errors.push('Home is outside the fence.');
    else if (fence.marginM(p.home) < L.tooCloseM) warnings.push('Home is very close to the wall.');
  } else {
    info.push('Home = where the boat is when you press Start (launch point).');
  }

  const nodes = [
    ...(p.home ? [{ q: p.home, name: 'home' }] : []),
    ...p.waypoints.map((q, i) => ({ q, name: `waypoint ${i + 1}` })),
    ...(p.home ? [{ q: p.home, name: 'home' }] : []),
  ];
  let total = 0;
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1].q, b = nodes[i].q, d = haversine(a, b);
    total += d;
    const name = `Leg ${nodes[i - 1].name} → ${nodes[i].name}`;
    if (fence.contains(a) && fence.contains(b) && fence.legLeaves(a, b)) {
      warnings.push(`${name} cuts outside the fence: the boat would turn back. Add a waypoint at the bend.`);
    }
    if (d < L.arriveM) warnings.push(`${name} is only ${d.toFixed(1)} m: closer than the arrival radius.`);
  }
  if (p.home && p.waypoints.length) {
    const back = haversine(p.waypoints.at(-1), p.home) / L.cruiseMps;
    if (back > L.rthTimeoutS) warnings.push(`Return leg takes ~${fmtT(back)}, longer than the ${L.rthTimeoutS} s return-home limit.`);
  }
  if (total) info.push(`Route ${fmtM(total)}, about ${fmtT(total / L.cruiseMps)} at cruise speed (estimate, no current).`);
  return { errors, warnings, info };
}

/** Accepts the planner's own export and the Pi's mission JSON ([lat,lon] or {lat,lon} points). */
export function parsePlanFile(text) {
  const d = JSON.parse(text);
  const pt = (v) => {
    const a = Array.isArray(v) ? v : [v?.lat, v?.lon];
    const [lat, lon] = a.map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('bad point');
    return [lat, lon];
  };
  if (!Array.isArray(d.fence) || !Array.isArray(d.waypoints)) throw new Error('missing fence or waypoints');
  let fence = d.fence.map(pt);
  if (fence.length > 3 && fence[0][0] === fence.at(-1)[0] && fence[0][1] === fence.at(-1)[1]) fence = fence.slice(0, -1);
  return { id: newPlanId(), name: String(d.name || '').slice(0, 60), fence, home: d.home ? pt(d.home) : null, waypoints: d.waypoints.map(pt) };
}

const r7 = (v) => Math.round(v * 1e7) / 1e7;
export const planForBoat = (p) => ({
  id: p.id, name: p.name, fence: p.fence.map((q) => q.map(r7)),
  home: p.home ? p.home.map(r7) : null, waypoints: p.waypoints.map((q) => q.map(r7)),
});

export const uploadPlan = (p) => send({ type: 'mission', plan: planForBoat(p) });
export const startMission = () => send({ type: 'command', command: 'mission_start' });
export const abortMission = (returnHome = true) => send({ type: 'command', command: 'mission_abort', ...(returnHome ? {} : { return_home: false }) });
