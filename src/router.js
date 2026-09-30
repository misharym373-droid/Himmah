// موجّه بسيط يعتمد على الـHash (يعمل على GitHub Pages بدون إعدادات خادم)
import { useSyncExternalStore } from 'react';

export const ROUTES = ['home', 'tasks', 'schedule', 'goals', 'habits', 'stats', 'achievements', 'rewards', 'shared', 'profile', 'settings'];

function read() {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const name = ROUTES.includes(path) ? path : 'home';
  return name + (query ? '?' + query : '');
}
let cached = read();
const listeners = new Set();
window.addEventListener('hashchange', () => {
  cached = read();
  listeners.forEach((l) => l());
});

export function navigate(to) {
  const target = '#/' + to;
  if (window.location.hash !== target) window.location.hash = target;
  window.scrollTo(0, 0);
}

export function useRoute() {
  const r = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => cached
  );
  const [name, query = ''] = r.split('?');
  return { name, params: Object.fromEntries(new URLSearchParams(query)) };
}
