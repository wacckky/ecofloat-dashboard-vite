import { ensureMap } from '../components/map.js';
import { initAnalytics } from './analytics.js';

const PAGES = ['landing', 'dashboard', 'analytics'];
let current = 'landing';

export const getCurrentPage = () => current;

export function showPage(name) {
  if (!PAGES.includes(name)) name = 'landing';
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById(`page-${name}`)?.classList.add('active');
  document.getElementById(`nav-${name}`)?.classList.add('active');
  current = name;
  history.replaceState(null, '', `#${name}`);
  if (name === 'dashboard') ensureMap();
  if (name === 'analytics') initAnalytics();
}

export const initRouter = () => showPage(location.hash.slice(1) || 'landing');
