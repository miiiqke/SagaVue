/**
 * main.js — application entry point.
 */

import { loadCatalog, loadSeries } from './data.js';
import { initSearch }                 from './search.js';
import { initRouter, navigate, setBreadcrumb } from './router.js';
import {
  renderGrid, renderSeriesHeader, renderOverview, renderSeasons,
  renderArcs, renderEpTable, renderChTable, renderSeasonMap,
  renderWatchGuide,
  renderInfoLoading, renderInfoPanel,
  renderExtrasLoading, renderExtras, renderExtrasError,
  highlightRow,
} from './render.js';
import { fetchSeriesInfo, fetchBestInfo, fetchExtras, fetchFullStatusData } from './api.js';
import { renderFooter } from './render-footer.js';
import { initPickupWidget } from './pickup.js';

let allSeries    = [];
let currentSeries = null;
let currentSort = 'default';
let currentSortDir = 'asc'; // 'asc' or 'desc'
// Exposed for inline HTML onclick handlers
window.app = {
  switchTab,
  filterEp(filter, btn) {
    document.querySelectorAll('#ep-filters .fb').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    renderEpTable(currentSeries, filter);
  },
  filterCh(filter, btn) {
    document.querySelectorAll('#ch-filters .fb').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    renderChTable(currentSeries, filter);
  },
  toggleWatchGuide() {
    const body  = document.getElementById('wg-body');
    const chev  = document.getElementById('wg-chev');
    const hint  = document.getElementById('wg-hint');
    const box   = document.getElementById('watch-guide-hdr');
    const open  = body.classList.toggle('wg-open');
    chev.textContent = open ? '▴' : '▾';
    if (hint) hint.textContent = open ? 'collapse' : 'expand';
    box.classList.toggle('wg-hdr-open', open);
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  renderFooter();
  initRouter(handleHome, handleSeries);
  try {
    // Load lightweight catalog first — renders cards instantly
    allSeries = await loadCatalog();
    renderGrid(allSeries, id => navigate('series', id));
    initFilters();

    // Load full series data in parallel for search — doesn't block the UI
    loadAllSeriesForSearch();
  } catch (e) {
    console.error('Boot failed:', e);
  }
});

function handleHome() {
  currentSeries = null;
  document.getElementById('search-input').value = '';
  document.getElementById('nav-search').classList.add('hidden');
}

async function loadAllSeriesForSearch() {
  // Load all full series in parallel for search indexing.
  // Uses the same loadSeries() calls as opening a series page — results are cached
  // so navigating to a series after search has already loaded it is instant.
  const SERIES_IDS = [
    'aot', 'berserk', 'demon_slayer', 'fmab',
    'frieren', 'hxh', 'jjk', 'vinland_saga',
  ];
  try {
    const fullSeries = await Promise.all(SERIES_IDS.map(id => loadSeries(id)));
    initSearch(fullSeries, (sid, aid, tab) => navigate('series', sid, aid, tab));
    initSearch(fullSeries, (sid, aid, tab) => navigate('series', sid, aid, tab), 'nav-search-input', 'nav-search-results');
  } catch (e) {
    console.error('Search index failed to load:', e);
  }
}

async function handleSeries(id, anchorId, tab) {
  document.getElementById('nav-search').classList.remove('hidden');
  try { currentSeries = await loadSeries(id); }
  catch (e) { console.error('Load series failed:', e); return; }

  setBreadcrumb(currentSeries.meta.title);

  renderSeriesHeader(currentSeries);
  renderOverview(currentSeries);
  renderSeasons(currentSeries);
  renderWatchGuide(currentSeries);
  initPickupWidget(currentSeries);
  renderArcs(currentSeries, jumpToEp);
  resetTables();
  renderEpTable(currentSeries, 'all');
  renderSeasonMap(currentSeries);
  renderChTable(currentSeries, 'all');

  // Update section numbers based on whether watch guide is visible
  const hasGuide = !!(currentSeries.config?.watchGuide?.length);
  document.getElementById('wg-lbl').textContent    = '02';
  document.getElementById('arc-lbl').textContent   = hasGuide ? '03' : '02';
  document.getElementById('table-lbl').textContent = hasGuide ? '04' : '03';
  const extrasLbl = document.getElementById('extras-lbl');
  if (extrasLbl) extrasLbl.textContent              = hasGuide ? '05' : '04';

  // MAL info — async, non-blocking
  const primaryId = currentSeries.config?.malIds?.primary;
  
  if (primaryId) {
    renderInfoLoading();
    const mangaId = currentSeries.config?.malIds?.manga ?? null;
    fetchBestInfo(primaryId, mangaId)
      .then(info => renderInfoPanel(info, currentSeries.meta.logicalStatus))
      .catch(() => renderInfoPanel(null, currentSeries.meta.logicalStatus));

    // Non-canon extras — async
    const canonIds = (currentSeries.arcs || [])
      .filter(a => a.malId)
      .map(a => a.malId);

    document.getElementById('extras-section').classList.add('hidden');
    renderExtrasLoading();
    fetchExtras(primaryId, canonIds)
      .then(renderExtras)
      .catch(renderExtrasError);
  }

  if (anchorId || tab) {
    setTimeout(() => {
      if (tab) switchTab(tab);
      if (anchorId) highlightRow(anchorId);
    }, 300);
  }
}

function switchTab(t) {
  const tabs = ['ep', 'sv', 'ch'];
  tabs.forEach(tab => {
    document.getElementById(`tsec-${tab}`).classList.toggle('on', tab === t);
    document.getElementById(`tbn-${tab}`).classList.toggle('on', tab === t);
  });
}

function jumpToEp(n) {
  switchTab('ep');
  setTimeout(() => highlightRow(`epr-${n}`), 60);
}

function resetTables() {
  switchTab('ep');
  document.querySelectorAll('#ep-filters .fb').forEach((b, i) => b.classList.toggle('on', i === 0));
  document.querySelectorAll('#ch-filters .fb').forEach((b, i) => b.classList.toggle('on', i === 0));
}

function getSortedSeries(series) {
  const sorted = [...series];
  const isAsc = currentSortDir === 'asc';
  
  if (currentSort === 'episodes') {
    sorted.sort((a, b) => isAsc ? a.meta.totalEpisodes - b.meta.totalEpisodes : b.meta.totalEpisodes - a.meta.totalEpisodes);
  } else if (currentSort === 'chapters') {
    sorted.sort((a, b) => isAsc ? a.meta.totalChapters - b.meta.totalChapters : b.meta.totalChapters - a.meta.totalChapters);
  } else if (currentSort === 'adapted') {
    sorted.sort((a, b) => isAsc ? a.meta.adaptedPct - b.meta.adaptedPct : b.meta.adaptedPct - a.meta.adaptedPct);
  } else if (currentSort === 'rating') {
    sorted.sort((a, b) => {
      const ratingA = a.meta.score;
      const ratingB = b.meta.score;
      if (ratingA == null && ratingB == null) return 0;
      if (ratingA == null) return 1;
      if (ratingB == null) return -1;
      return isAsc ? ratingA - ratingB : ratingB - ratingA;
    });
  } else if (currentSort === 'name') {
    sorted.sort((a, b) => isAsc ? a.meta.title.localeCompare(b.meta.title) : b.meta.title.localeCompare(a.meta.title));
  }
  return sorted;
}

function getButtonLabel(sortType, isDesc, isActive) {
  const labels = {
    default: 'Default',
    episodes: `Episodes ${isActive ? (isDesc ? '↑' : '↓') : ''}`,
    chapters: `Chapters ${isActive ? (isDesc ? '↑' : '↓') : ''}`,
    adapted: `Adapted % ${isActive ? (isDesc ? '↑' : '↓') : ''}`,
    rating: `Rating ${isActive ? (isDesc ? '↑' : '↓') : ''}`,
    name: isActive ? (isDesc ? 'Name Z–A' : 'Name A–Z') : 'Name A–Z',
  };
  return labels[sortType] || sortType;
}

function initFilters() {
  const hasScores = allSeries.some(s => s.meta.score != null);
  const ratingBtn = document.querySelector('#sort-filters .filter-btn[data-sort="rating"]');
  if (ratingBtn) ratingBtn.style.display = hasScores ? '' : 'none';

  document.querySelectorAll('#sort-filters .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sortType = btn.dataset.sort;
      const isCurrentSort = currentSort === sortType;
      
      // If same button clicked, toggle direction (except for default)
      if (isCurrentSort && sortType !== 'default') {
        currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        // New sort button: set to desc (high to low) by default for value sorts, asc for name
        currentSort = sortType;
        currentSortDir = (sortType === 'name' || sortType === 'default') ? 'asc' : 'desc';
      }

      // Update UI
      document.querySelectorAll('#sort-filters .filter-btn').forEach(b => {
        const isActive = b.dataset.sort === currentSort;
        b.classList.toggle('on', isActive);
        b.textContent = getButtonLabel(b.dataset.sort, currentSortDir === 'desc', isActive);
      });
      
      renderGrid(getSortedSeries(allSeries), id => navigate('series', id));
    });
  });
}

