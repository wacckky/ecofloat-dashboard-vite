import { subscribe } from '../store/store.js';
import { $, set } from '../utils/dom.js';

const LABEL = { online: 'ONLINE', offline: 'OFFLINE', connecting: 'CONNECTING' };

export function initStatusBadge() {
  subscribe((s, keys) => {
    if (!keys.includes('connection')) return;
    $('navDot')?.classList.toggle('offline', s.connection === 'offline');
    set('navStatus', LABEL[s.connection]);
  });
}
