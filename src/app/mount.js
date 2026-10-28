import nav from '../components/nav.html?raw';
import landing from '../pages/landing.html?raw';
import dashboard from '../pages/dashboard.html?raw';
import analytics from '../pages/analytics.html?raw';

export function mountApp() {
  document.getElementById('app').innerHTML = nav + landing + dashboard + analytics;
}
