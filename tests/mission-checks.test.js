// Run: npm test   (bundles with esbuild, runs in Node; no browser needed)
import assert from 'node:assert/strict';
import { checkPlan, parsePlanFile, planForBoat } from '../src/services/mission.js';
import { makeFence } from '../src/utils/geo.js';

const O = [14.648, 121.0925];
const m = (dx, dy) => [O[0] + dy / 111320, O[1] + dx / (111320 * Math.cos((O[0] * Math.PI) / 180))];
// L-shaped water area 60 x 60 m with the top-right 30 x 30 m missing (concave, like a river bend)
const L_FENCE = [m(0, 0), m(60, 0), m(60, 30), m(30, 30), m(30, 60), m(0, 60)];
const plan = (o) => ({ id: 'p-1', name: 't', fence: L_FENCE, home: m(10, 10), waypoints: [m(50, 10), m(10, 50)], ...o });
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

test('fence geometry', () => {
  const f = makeFence(L_FENCE);
  assert.ok(f.contains(m(10, 10)));
  assert.ok(!f.contains(m(45, 45)), 'the missing corner is outside');
  assert.ok(Math.abs(f.marginM(m(10, 10)) - 10) < 0.2);
  assert.ok(f.legLeaves(m(50, 10), m(10, 50)) === false, 'diagonal stays inside? (it passes the inner corner)');
  assert.ok(f.legLeaves(m(50, 25), m(25, 50)), 'this one cuts across the missing corner');
  assert.ok(!f.selfIntersects());
  assert.ok(makeFence([m(0, 0), m(10, 10), m(10, 0), m(0, 10)]).selfIntersects(), 'bow-tie');
});

test('good plan has no errors', () => {
  const c = checkPlan(plan());
  assert.deepEqual(c.errors, []);
  assert.ok(c.info.some((t) => t.startsWith('Route')));
});

test('errors block sending', () => {
  assert.ok(checkPlan(plan({ fence: L_FENCE.slice(0, 2) })).errors.length);
  assert.ok(checkPlan(plan({ waypoints: [] })).errors.length);
  assert.ok(checkPlan(plan({ waypoints: [m(45, 45)] })).errors.some((e) => e.includes('outside')));
  assert.ok(checkPlan(plan({ home: m(45, 45) })).errors.some((e) => e.includes('Home')));
  assert.ok(checkPlan(plan({ fence: [m(0, 0), m(60, 60), m(60, 0), m(0, 60)] })).errors.some((e) => e.includes('cross')));
  assert.ok(checkPlan(plan({ waypoints: [m(5000, 10)] })).errors.length, 'far-away typo');
});

test('warnings for walls and corner-cutting legs', () => {
  assert.ok(checkPlan(plan({ waypoints: [m(1, 10)] })).warnings.some((w) => w.includes('from the wall')));
  assert.ok(checkPlan(plan({ waypoints: [m(50, 25), m(25, 50)] })).warnings.some((w) => w.includes('cuts outside')));
  assert.ok(checkPlan(plan({ waypoints: [m(10, 11)] })).warnings.some((w) => w.includes('arrival radius')));
});

test('launch-point home', () => {
  const c = checkPlan(plan({ home: null }));
  assert.deepEqual(c.errors, []);
  assert.ok(c.info.some((t) => t.includes('launch point')));
});

test('file round trip and Pi format', () => {
  const out = JSON.stringify(planForBoat(plan()));
  const back = parsePlanFile(out);
  assert.equal(back.waypoints.length, 2);
  const pi = parsePlanFile(JSON.stringify({ name: 'x', fence: [...L_FENCE, L_FENCE[0]].map(([lat, lon]) => ({ lat, lon })), home: null, waypoints: [[O[0], O[1]]] }));
  assert.equal(pi.fence.length, 6, 'closing point dropped');
  assert.throws(() => parsePlanFile('{"fence":[["a","b"]],"waypoints":[]}'));
  assert.throws(() => parsePlanFile('not json'));
});

console.log(`\n${n} tests passed`);
