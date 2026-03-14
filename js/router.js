/**
 * router.js — History API routing with clean URLs.
 *
 * URLs:
 *   /                        → home
 *   /series/berserk          → series page
 *   /series/berserk/ep/27    → series page, jump to ep 27
 *
 * Cards on the home grid are rendered as <a href="/series/id"> so that
 * middle-click / Ctrl+click / right-click → "Open in new tab" all work
 * natively without any extra JS.
 *
 * The server (wrangler.jsonc not_found_handling: single-page-application)
 * serves index.html for all paths, so direct navigation and refresh work.
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

  const mBack = document.getElementById('nav-back-mobile');
  if (mBack) mBack.addEventListener('click', () => navigate('home'));

  window.addEventListener('popstate', handlePath);

  // Handle the initial URL on load
  handlePath();
}

export function navigate(view, seriesId = null, anchorId = null, tab = null) {
  if (view === 'home') {
    history.pushState(null, '', '/');
    showHome();
    _onHome?.();
  } else if (view === 'series' && seriesId) {
    const path = anchorId
      ? `/series/${seriesId}/${tab || 'ep'}/${anchorId}`
      : `/series/${seriesId}`;
    if (window.location.pathname !== path) {
      history.pushState(null, '', path);
    }
    showSeries();
    _onSeries?.(seriesId, anchorId, tab);
  }
}

/** Returns the bare href string for a series card link (used by renderGrid). */
export function seriesHref(seriesId) {
  return `/series/${seriesId}`;
}

function handlePath() {
  const path = window.location.pathname;
  if (path === '/' || path === '') {
    showHome();
    _onHome?.();
  } else if (path.startsWith('/series/')) {
    const parts    = path.split('/').filter(Boolean); // ['series', 'berserk', 'ep', '27']
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
  sp.classList.remove('page-entering');
  void sp.offsetWidth;
  sp.classList.add('page-entering');
  setTimeout(() => sp.classList.remove('page-entering'), 600);
}
