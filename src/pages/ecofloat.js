import { subscribe, getState } from '../store/store.js';
import { $, set } from '../utils/dom.js';
import { escapeHtml } from '../utils/format.js';
import {
  MISSION_STATE, BIN_STATUS_COLOR, TEMP_WARN_C, TEMP_DANGER_C,
  BATTERY_WARN_PCT, BATTERY_DANGER_PCT, BATTERY_WARN_V, BATTERY_DANGER_V,
} from '../config/constants.js';

const PAGE = `
<div id="page-ecofloat" class="page">
  <div class="analytics-inner">
    <div class="analytics-header">
      <div><div class="section-label">The Prototype</div><h1>EcoFloat 01</h1></div>
      <div class="eco-sub" id="ecoDevice"></div>
    </div>
    <div class="eco-grid" id="ecoGrid">
      <div class="stats-card">
        <span class="card-icon">📡</span><div class="card-label">Device connection</div>
        <div class="eco-big" id="ecoConn">--</div><div class="eco-sub" id="ecoSeen">&nbsp;</div>
      </div>
      <div class="stats-card eco-live">
        <span class="card-icon">🧭</span><div class="card-label">Mission state</div>
        <div class="eco-big" id="ecoState">--</div><div class="eco-sub" id="ecoRaw">&nbsp;</div>
      </div>
      <div class="stats-card eco-live">
        <span class="card-icon">🔋</span><div class="card-label">Status</div>
        <div class="stat-row">
          <div class="stat-box"><label>Battery</label><div class="val" id="ecoBat">--</div></div>
          <div class="stat-box"><label>Core temp</label><div class="val" id="ecoTemp">--</div></div>
        </div>
        <div class="eco-sub" id="ecoBatNote">&nbsp;</div>
      </div>
      <div class="stats-card eco-live">
        <span class="card-icon">🗑️</span><div class="card-label">Bin capacity</div>
        <div class="eco-big" id="ecoBinPct">--</div>
        <div class="progress-bar"><div class="progress-fill" id="ecoBinBar" style="width:0%"></div></div>
        <div class="eco-sub" id="ecoBinNote" style="margin-top:8px">&nbsp;</div>
      </div>
    </div>
  </div>
</div>`;

const TONE = { good: 'var(--green)', warn: 'var(--amber)', bad: 'var(--red)', neutral: 'var(--teal2)' };
const paint = (id, tone) => { const el = $(id); if (el) el.style.color = TONE[tone] || TONE.neutral; };
const cls = (id, c) => { const el = $(id); if (el) el.className = 'val' + (c ? ` ${c}` : ''); };

function renderAge() {
  const s = getState();
  if (!s.lastSeen) return set('ecoSeen', 'no data received yet');
  const sec = Math.max(0, Math.round((Date.now() - s.lastSeen) / 1000));
  set('ecoSeen', `last data ${sec < 90 ? `${sec} s` : `${Math.round(sec / 60)} min`} ago`);
}

function render(s) {
  const linked = s.connection === 'online';
  const conn = !linked ? ['NO BACKEND LINK', 'warn']
    : { online: ['ONLINE', 'good'], offline: ['OFFLINE', 'bad'], unknown: ['WAITING…', 'warn'] }[s.deviceStatus];
  set('ecoConn', conn[0]); paint('ecoConn', conn[1]);
  set('ecoDevice', s.deviceId ? `ID: ${s.deviceId}` : '');
  renderAge();
  $('ecoGrid')?.classList.toggle('eco-stale', !linked || s.deviceStatus !== 'online');

  // Mission state
  const m = MISSION_STATE[s.fsmState];
  set('ecoState', m ? m.label : '--'); paint('ecoState', m?.tone);
  set('ecoRaw', s.fsmState ? `FSM: ${s.fsmState}` : '\u00a0');

  // Battery + core temperature
  const sys = s.system;
  if (sys) {
    const pct = sys.battery_percent, v = Number(sys.battery_voltage);
    set('ecoBat', pct != null ? `${Math.round(pct)}%` : `${v.toFixed(1)} V`);
    const lowBat = pct != null ? (pct <= BATTERY_DANGER_PCT ? 'danger' : pct <= BATTERY_WARN_PCT ? 'warn' : '')
      : (v < BATTERY_DANGER_V ? 'danger' : v < BATTERY_WARN_V ? 'warn' : '');
    cls('ecoBat', lowBat);
    set('ecoBatNote', pct != null ? `${v.toFixed(2)} V (percent is an estimate)` : 'voltage only');
    const t = Number(sys.cpu_temp_c);
    set('ecoTemp', Number.isFinite(t) ? `${t.toFixed(0)} °C` : '--');
    cls('ecoTemp', t >= TEMP_DANGER_C ? 'danger' : t >= TEMP_WARN_C ? 'warn' : '');
  }

  // Bin
  const b = s.bin;
  if (b) {
    const fill = Math.min(100, Number(b.fill_percent || 0));
    const color = BIN_STATUS_COLOR[b.status] || 'var(--teal)';
    set('ecoBinPct', `${fill.toFixed(0)}%`);
    const bar = $('ecoBinBar');
    if (bar) { bar.style.width = `${fill}%`; bar.style.background = color; }
    set('ecoBinNote', `${String(b.status || '').replace(/_/g, ' ')} · ${b.items_collected || 0} items`);
  }
}

// Adds the page and its nav button; the app shell must already be mounted.
export function mountEcofloatPage() {
  document.getElementById('nav-landing')?.insertAdjacentHTML('afterend',
    '<button class="nav-btn" id="nav-ecofloat" data-page="ecofloat">EcoFloat</button>');
  document.getElementById('app').insertAdjacentHTML('beforeend', PAGE);

  const banner = document.createElement('div');
  banner.id = 'simBanner';
  banner.textContent = '⚠ SIMULATED DATA: not from a real EcoFloat';
  document.body.appendChild(banner);

  subscribe((s) => {
    render(s);
    banner.style.display = s.simulated && s.deviceStatus === 'online' ? 'block' : 'none';
  });
  setInterval(renderAge, 1000);
  render(getState());
}
