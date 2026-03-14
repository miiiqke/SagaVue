/**
 * router.js — hash-based routing with real per-series URLs.
 *
 * URLs:
 *   /           → home
 *   /#series/berserk         → series page
 *   /#series/berserk/ep/27   → series page, jump to ep 27
 *
 * Cards on the home grid are rendered as <a href="#series/id"> so that
 * middle-click / Ctrl+click / right-click → "Open in new tab" all work
 * natively without any extra JS.
 */

let _onHome   = null;
let _onSeries = null;

export function initRouter(onHome, onSeries) {
  _onHome   = onHome;
  _onSeries = onSeries;

  document.getElementById('nav').classList.add('on-home');

  document.getElementById('nav-logo').addEventListener('click', e => {
    e.preventDefault(); navigate('home');
  });
  document.getElementById('back-btn').addEventListener('click', () => navigate('home'));

  // Mobile back arrow
  const mBack = document.getElementById('nav-back-mobile');
  if (mBack) mBack.addEventListener('click', () => navigate('home'));

  window.addEventListener('hashchange', handleHash);

  // Handle the initial URL on load
  handleHash();
}

export function navigate(view, seriesId = null, anchorId = null, tab = null) {
  if (view === 'home') {
    window.location.hash = '';
    showHome();
    _onHome?.();
  } else if (view === 'series' && seriesId) {
    const hash = anchorId
      ? `series/${seriesId}/${tab || 'ep'}/${anchorId}`
      : `series/${seriesId}`;
    // Only push a new history entry if the hash actually changes
    if (window.location.hash !== '#' + hash) {
      window.location.hash = hash;
    }
    showSeries();
    _onSeries?.(seriesId, anchorId, tab);
  }
}

/** Returns the bare href string for a series card link (used by renderGrid). */
export function seriesHref(seriesId) {
  return `#series/${seriesId}`;
}

function handleHash() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) {
    showHome();
    _onHome?.();
  } else if (hash.startsWith('series/')) {
    const parts    = hash.split('/');
    const seriesId = parts[1];
    const tab      = parts[2] || null;
    const anchorId = parts[3] || null;
    showSeries();
    _onSeries?.(seriesId, anchorId, tab);
  }
}

export function setBreadcrumb(text) {
  const bc    = document.getElementById('nav-bc');
  const mBack = document.getElementById('nav-back-mobile');

  bc.innerHTML = text
    ? `<span class="crumb" id="bc-home">Series</span><span style="color:var(--text3)">›</span><span>${text}</span>`
    : '';
  document.getElementById('bc-home')?.addEventListener('click', () => navigate('home'));

  if (mBack) {
    mBack.classList.toggle('hidden', !text);
    mBack.onclick = text ? () => navigate('home') : null;
  }
}

function showHome() {
  document.getElementById('home-page').classList.remove('hidden');
  document.getElementById('series-page').classList.add('hidden');
  document.getElementById('nav').classList.add('on-home');
  setBreadcrumb(null);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSeries() {
  document.getElementById('home-page').classList.add('hidden');
  const sp = document.getElementById('series-page');
  sp.classList.remove('hidden');
  document.getElementById('nav').classList.remove('on-home');
  window.scrollTo({ top: 0, behavior: 'instant' });
  // Trigger enter animation — remove first in case of re-navigation
  sp.classList.remove('page-entering');
  // Force reflow so removing+adding the class restarts the animation
  void sp.offsetWidth;
  sp.classList.add('page-entering');
  // Clean up after animation completes so it doesn't interfere with anything
  setTimeout(() => sp.classList.remove('page-entering'), 600);
}
