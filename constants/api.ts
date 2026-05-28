import Constants from 'expo-constants';

const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
export const API = `http://${host}:3000`;

export const fetchJSON = (url: string) => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  return fetch(url, { signal: ctrl.signal })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .finally(() => clearTimeout(timer));
};
