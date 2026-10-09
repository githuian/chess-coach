// Toolbar popup: lets you pick the coach's language without opening chess.com.
// It writes the same coachSettings the panel uses; the panel picks the change up live.
import { t, setLang, resolveLang } from './i18n.js';

const langs = document.getElementById('langs');
let current = 'auto';

function render() {
  setLang(resolveLang(current, navigator.language));
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const b of langs.children) b.classList.toggle('on', b.dataset.lang === current);
}

langs.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-lang]');
  if (!b) return;
  current = b.dataset.lang;
  render();
  const { coachSettings = {} } = await chrome.storage.local.get('coachSettings');
  await chrome.storage.local.set({ coachSettings: { ...coachSettings, lang: current } });
});

chrome.storage.local.get('coachSettings').then(({ coachSettings }) => {
  current = coachSettings?.lang || 'auto';
}).finally(render);
