import { send, onMessage, onStatus } from './websocket.js';
import { getState, setState } from '../store/store.js';

// The operator key is typed by a person and kept only for this browser tab (sessionStorage).
// It is never in the source code or in a VITE_ variable, because those are public.
const KEY = 'ecofloat_operator_key';
const read = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch { /* ignore */ } };

export const isOperator = () => getState().operator === 'unlocked';

export function unlock(key) {
  if (!key) return;
  write(key);
  setState({ operator: 'checking', authError: '' });
  if (!send({ type: 'auth', key })) setState({ operator: 'locked', authError: 'Not connected to backend' });
}

export function lock() {
  write(null);
  setState({ operator: 'locked', authError: '' });
}

export function initAuth() {
  onMessage('auth_result', (d) => {
    if (d?.ok) setState({ operator: 'unlocked', authError: '' });
    else { write(null); setState({ operator: 'locked', authError: 'Wrong operator key' }); }
  });
  onMessage('denied', () => setState({ operator: 'locked', authError: 'Controls are locked' }));

  onStatus((s) => {
    if (s !== 'online') { setState({ operator: 'locked' }); return; }
    const saved = read(); // re-authenticate after a reconnect
    if (saved) { setState({ operator: 'checking' }); send({ type: 'auth', key: saved }); }
  });
}
