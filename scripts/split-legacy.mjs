// Run from the project root:  node scripts/split-legacy.mjs
// Splits your pasted index.html + legacy.css into components. Originals go to legacy-backup/.
import fs from 'node:fs';
import path from 'node:path';

const die = (m) => { console.error('\n✖ ' + m); process.exit(1); };
const BK = 'legacy-backup';
fs.mkdirSync(BK, { recursive: true });
const pick = (name, current) => {
  const b = path.join(BK, name);
  if (!fs.existsSync(b)) fs.copyFileSync(current, b); // safe to re-run: always reads the backup
  return fs.readFileSync(b, 'utf8');
};
const html = pick('index.html', 'index.html');
const css = pick('legacy.css', 'src/styles/legacy.css');
if (!html.includes('<nav>')) die('index.html has no <nav> markup. Paste your old body markup first.');
if (css.length < 2000) die('src/styles/legacy.css looks empty. Paste your old CSS first.');

const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s.trim() + '\n'); };
const at = (text, needle, back) => {
  const i = text.indexOf(needle);
  if (i < 0) die(`Marker not found: "${needle}"`);
  return back ? text.lastIndexOf(back, i) : i;
};

// ── CSS ──
const k = {
  vars: at(css, '── Variables', '/*'), reset: at(css, '── Reset', '/*'), nav: at(css, '── Nav', '/*'),
  p1: at(css, 'PAGE 1 — LANDING', '/*'), p2: at(css, 'PAGE 2 — DASHBOARD', '/*'),
  p3: at(css, 'PAGE 3 — ANALYTICS', '/*'), scroll: at(css, '/* Scrollbar', '/*'),
};
const order = Object.values(k);
if (order.some((v, i) => i && v <= order[i - 1])) die('CSS section markers are out of order.');
write('src/styles/tokens.css', css.slice(k.vars, k.reset));
write('src/styles/base.css', css.slice(k.reset, k.nav) + '\n' + css.slice(k.scroll));
write('src/styles/nav.css', css.slice(k.nav, k.p1));
write('src/styles/landing.css', css.slice(k.p1, k.p2));
write('src/styles/dashboard.css', css.slice(k.p2, k.p3) + '\n.motor-btn { touch-action: none; }\n');
write('src/styles/analytics.css', css.slice(k.p3, k.scroll));
write('src/styles/main.css',
  ['tokens', 'base', 'nav', 'landing', 'dashboard', 'analytics'].map((n) => `@import './${n}.css';`).join('\n'));

// ── HTML ──
let body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script'))
  .replace(/<!--\s*PASTE BODY[\s\S]*?-->/, '');
const h = {
  nav: at(body, '<nav>'), p1: at(body, 'PAGE 1 — LANDING', '<!--'),
  p2: at(body, 'PAGE 2 — DASHBOARD', '<!--'), p3: at(body, 'PAGE 3 — ANALYTICS', '<!--'),
};
// Inline onclick/onmousedown handlers become data-* attributes handled in src/app/events.js
const fix = (s) => s
  .replace(/onclick="showPage\('(\w+)'\)"/g, 'data-page="$1"')
  .replace(/onclick="setRange\('(\w+)',\s*this\)"/g, 'data-range="$1"')
  .replace(/onclick="sendCommand\('(\w+)'\)"/g, 'data-command="$1"')
  .replace(/onmousedown="startMotor\('(\w)'\)"/g, 'data-motor="$1"')
  .replace(/\s+on(?:mouseup|mouseleave|touchstart|touchend)="startMotor\('\w'\)"/g, '');

let landing = body.slice(h.p1, h.p2);
const before = landing;
landing = landing.replace('<span class="tech-pill">HC-SR04 Ultrasonic</span>',
  '<span class="tech-pill">JSN-SR04M-2 Ultrasonic ×2</span>\n        <span class="tech-pill">HMC5883L Compass</span>');
if (landing === before) console.warn('! Hardware pill "HC-SR04 Ultrasonic" not found, fix it by hand in src/pages/landing.html');

const parts = {
  'src/components/nav.html': body.slice(h.nav, h.p1), 'src/pages/landing.html': landing,
  'src/pages/dashboard.html': body.slice(h.p2, h.p3), 'src/pages/analytics.html': body.slice(h.p3),
};
for (const [file, text] of Object.entries(parts)) {
  const out = fix(text);
  const left = out.match(/\son(?:click|mousedown|mouseup|mouseleave|touchstart|touchend)=/g);
  if (left) console.warn(`! ${file}: ${left.length} inline handler(s) left, tell Claude`);
  write(file, out);
}

write('index.html', `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EcoFloat — Autonomous River Cleaner</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>`);
console.log('\n✔ Done. Originals saved in legacy-backup/. Now run: npm run dev');
