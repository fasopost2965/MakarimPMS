import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5173/', pretendToBeVisual: true });
const { window } = dom;
globalThis.window = window; globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
globalThis.HTMLElement = window.HTMLElement; globalThis.Element = window.Element; globalThis.Node = window.Node;
globalThis.getComputedStyle = window.getComputedStyle;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.localStorage = window.localStorage;
const errors = []; console.error = (...a) => errors.push(a.map(String).join(' '));
await import('/tmp/app.mjs');
const root = document.getElementById('root');
const wait = (ms = 160) => new Promise((r) => setTimeout(r, ms));
await wait(400);
const txt = () => root.textContent.replace(/\s+/g, ' ');
const btn = () => [...root.querySelectorAll('button')];
const click = async (n) => { const b = btn().find(x => x.textContent.includes(n)); if (!b) return false; b.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); await wait(200); return true; };

const ecrans = ['Tableau de bord', 'Chambres', 'Réservations', 'Restaurant', 'Salle de conférence', 'Caisse', 'Tarifs'];
for (const e of ecrans) {
  await click(e);
  console.log(`écran « ${e} » rendu :`, root.querySelectorAll('main').length === 1 && txt().length > 200);
}

// Modale de réservation : labels associés
await click('Réservations');
await click('Nouvelle réservation');
const paires = [...root.querySelectorAll('label[for]')].map((l) => l.getAttribute('for'));
console.log('labels associés :', paires, '→ tous présents :', paires.every((id) => root.querySelector(`#${id}`)));

// Toast annoncé
await click('Fermer');
window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
await wait(150);
const live = root.querySelector('[role="status"][aria-live]');
console.log('zone live toast :', Boolean(live));

// Conférence : rendu du devis et capacité issue du référentiel
await click('Salle de conférence');
console.log('devis conférence :', txt().includes('Participants'), '| capacité 60 :', /60 places|capacité max\. 60/.test(txt()));

console.log('ERREURS CONSOLE :', errors.length, errors.slice(0, 3).join(' | '));
