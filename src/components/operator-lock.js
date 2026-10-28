import { subscribe, getState } from '../store/store.js';
import { $ } from '../utils/dom.js';
import { unlock, lock } from '../services/auth.js';
import { stopMotors } from '../services/commands.js';

// Adds an "Unlock controls" box at the top of the Motor Control panel.
export function initOperatorLock() {
  const panel = $('motorCmdStatus')?.closest('.panel-card');
  if (!panel) return;
  const box = document.createElement('div');
  box.style.cssText = 'margin-bottom:12px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg2)';
  box.innerHTML = `
    <div id="opMsg" style="font-family:'Space Mono',monospace;font-size:0.68rem;margin-bottom:8px"></div>
    <div id="opForm" style="display:flex;gap:6px">
      <input id="opKey" type="password" placeholder="Operator key" autocomplete="off"
        style="flex:1;min-width:0;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-family:'Space Mono',monospace;font-size:0.72rem">
      <button id="opUnlock" class="cmd-btn cmd-home" style="width:auto;margin:0;padding:6px 12px">Unlock</button>
    </div>
    <button id="opLock" class="cmd-btn cmd-stop" style="margin:0;display:none">Lock controls</button>`;
  panel.querySelector('.panel-title').after(box);

  const submit = () => { unlock($('opKey').value.trim()); $('opKey').value = ''; };
  $('opUnlock').addEventListener('click', submit);
  $('opKey').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  $('opLock').addEventListener('click', () => { stopMotors(); lock(); });

  const render = (s) => {
    const u = s.operator === 'unlocked';
    $('opForm').style.display = u ? 'none' : 'flex';
    $('opLock').style.display = u ? 'block' : 'none';
    const msg = $('opMsg');
    msg.style.color = u ? 'var(--green)' : s.authError ? 'var(--red)' : 'var(--text3)';
    msg.textContent = u ? '🔓 OPERATOR MODE' : s.operator === 'checking' ? 'CHECKING KEY…'
      : s.authError ? `🔒 ${s.authError.toUpperCase()}` : '🔒 VIEW ONLY: enter key to drive';
  };
  subscribe((s, keys) => { if (keys.includes('operator') || keys.includes('authError')) render(s); });
  render(getState());
}
