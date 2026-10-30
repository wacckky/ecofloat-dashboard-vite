import { createLiveMap } from './live-map.js';

// The Dashboard page's map (same exports as before, so the router and main.js are unchanged)
const dashboardMap = createLiveMap('map');
export const ensureMap = dashboardMap.ensure;
export const initMap = dashboardMap.init;
