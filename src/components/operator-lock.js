import { subscribe, getState } from '../store/store.js';
import { $ } from '../utils/dom.js';
import { unlock, lock } from '../services/auth.js';
import { stopAll } from '../services/commands.js';

// The "enter operator key" box. Reusable: one on the Dashboard panel, one on Manual Control.
export function mountOperatorLock(target, where = 'append') {
  const box = document.createElement('div');
  box.style.cssText = 'margin:10px 0;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg2)';
  box.innerHTML = `
    <div class="op-msg" style="font-family:'Space Mono',monospace;font-size:0.68rem;margin-bottom:8px"></div>
    <div class="op-form" style="display:flex;gap:6px">
      <input class="op-key" type="password" placeholder="Operator key" autocomplete="off"
        style="flex:1;min-width:0;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-family:'Space Mono',monospace;font-size:0.72rem">
      <button class="op-unlock cmd-btn cmd-home" style="width:auto;margin:0;padding:6px 12px">Unlock</button>
    </div>
    <button class="op-lock cmd-btn cmd-stop" style="margin:0;display:none">Lock controls</button>`;
  where === 'after' ? target.after(box) : target.append(box);

  const q = (c) => box.querySelector(c);
  const submit = () => { unlock(q('.op-key').value.trim()); q('.op-key').value = ''; };
  q('.op-unlock').addEventListener('click', submit);
  q('.op-key').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  q('.op-lock').addEventListener('click', () => { stopAll(); lock(); });

  const render = (s) => {
    const u = s.operator === 'unlocked';
    q('.op-form').style.display = u ? 'none' : 'flex';
    q('.op-lock').style.display = u ? 'block' : 'none';
    const msg = q('.op-msg');
    msg.style.color = u ? 'var(--green)' : s.authError ? 'var(--red)' : 'var(--text3)';
    msg.textContent = u ? '🔓 OPERATOR MODE' : s.operator === 'checking' ? 'CHECKING KEY…'
      : s.authError ? `🔒 ${s.authError.toUpperCase()}` : '🔒 VIEW ONLY: enter key to drive';
  };
  subscribe((s, keys) => { if (keys.includes('operator') || keys.includes('authError')) render(s); });
  render(getState());
  return box;
}

export function initOperatorLock() {
  const title = $('motorCmdStatus')?.closest('.panel-card')?.querySelector('.panel-title');
  if (title) mountOperatorLock(title, 'after');
}
