/**
 * render.js — all DOM rendering. Pure functions, no state.
 */

import { buildArcNameMap } from './data.js';
import { getStatusPills } from './status.js';
import { seriesHref } from './router.js';

// ── Helpers ──────────────────────────────────────────────────────
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';
const fmtNum = n => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(0)+'K' : String(n);

/**
 * Format a chapters array as a compact string of contiguous runs.
 * e.g. [2,3,4,17,18] → "Ch 2–4, 17–18"   [5] → "Ch 5"   [5,6] → "Ch 5–6"
 * Non-contiguous chapters are never collapsed into a misleading single range.
 */
function fmtChapters(chapters) {
  if (!chapters?.length) return '';
  // If every entry is a non-numeric label (e.g. "Anime Original"), return as-is — no "Ch" prefix.
  const allLabels = chapters.every(c => typeof c === 'string' && !Number.isFinite(Number(c)));
  if (allLabels) return chapters.join(', ');
  // Non-integer numeric keys (e.g. "0.1") — show as first–last range
  const nonInt = chapters.filter(c => !Number.isInteger(Number(c)) && Number.isFinite(Number(c)));
  const intChs  = chapters.filter(c =>  Number.isInteger(Number(c)));
  const runs = [];
  if (nonInt.length) {
    const s = nonInt[0], e = nonInt[nonInt.length - 1];
    runs.push(s === e ? `${s}` : `${s}–${e}`);
  }
  if (intChs.length) {
    const sorted = [...new Set(intChs)].map(Number).sort((a, b) => a - b);
    let start = sorted[0], end = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) { end = sorted[i]; }
      else { runs.push(start === end ? `${start}` : `${start}–${end}`); start = end = sorted[i]; }
    }
    runs.push(start === end ? `${start}` : `${start}–${end}`);
  }
  return 'Ch ' + runs.join(', ');
}

/**
 * Build a tooltip string listing manga chapter titles for a set of chapter
 * numbers. Used as the `title` attribute on chapter cells in the episode table
 * so contributors can see chapter names without cluttering the layout.
 * Returns null when no titles are defined for any of the given chapters.
 *
 * @param {number[]} chapters  — chapter numbers from an episode's chapters[]
 * @param {Object}   chapterTitles — { "1": "Prologue", … } from the series
 */
function fmtChapterTitleTooltip(chapters, chapterTitles) {
  if (!chapters?.length || !chapterTitles || !Object.keys(chapterTitles).length) return null;
  const titled = chapters
    .map(n => {
      const t = chapterTitles[String(n)] ?? chapterTitles[n];
      return t ? `Ch ${n}: ${t}` : null;
    })
    .filter(Boolean);
  return titled.length ? titled.join('\n') : null;
}

/**
 * Truncate text with a bit more character limit and mid-word breaks if needed.
 * @param {string} str - The string to truncate
 * @param {number} limit - Character limit
 */
const truncate = (str, limit) => {
  if (!str || str.length <= limit) return str;
  return str.slice(0, limit) + '...';
};
const emptyRow = cols => `<tr><td colspan="${cols}" style="padding:1.4rem;text-align:center;color:var(--text3);font-style:italic;font-size:.8rem">Nothing here.</td></tr>`;

// ── Home grid ────────────────────────────────────────────────────
export function renderGrid(list, onSelect) {
  const grid = document.getElementById('series-grid');
  grid.innerHTML = list.map(s => {
    const m = s.meta;
    const genreTags = (m.tags || []).slice(0, 2).map(t => `<span class="ctag-genre">${t}</span>`).join('');
    const score = m.score;
    const displayTitle = truncate(m.title, 45);
    
    return `<a class="series-card" href="${seriesHref(s.id)}" data-id="${s.id}">
      <div class="cc">
        <div class="c-title-section">
          <div class="ctitle">${displayTitle}</div>
        </div>
        ${genreTags ? `<div class="cgenres">${genreTags}</div>` : '<div class="cgenres"></div>'}
        <div class="cstats">
          <div><div class="csv">${m.totalEpisodes}<span class="u">ep</span></div><div class="csl">Episodes</div></div>
          <div><div class="csv">${m.totalChapters}<span class="u">ch</span></div><div class="csl">Chapters</div></div>
          <div><div class="csv">${m.adaptedPct}<span class="u">%</span></div><div class="csl">Adapted</div></div>
        </div>
        <div class="card-bottom">
          <div class="cprog"><div class="cprog-fill" data-p="${m.adaptedPct}"></div></div>
          ${score ? `<div class="crating">★ ${score}</div>` : ''}
        </div>
      </div>
    </a>`;
  }).join('');

  grid.querySelectorAll('.series-card').forEach(c => {
    c.addEventListener('click', e => {
      // Middle-click or Ctrl/Cmd+click → let the browser open a new tab naturally
      if (e.button === 1 || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      onSelect(c.dataset.id);
    });
    c.addEventListener('mousemove', e => {
      const rect = c.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 10;
      const rotateY = (centerX - x) / 10;
      c.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    });
    c.addEventListener('mouseleave', () => {
      c.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    });
  });

  requestAnimationFrame(() => setTimeout(() => {
    grid.querySelectorAll('.cprog-fill[data-p]').forEach(el => {
      const p = Number(el.dataset.p) || 0;
      // Gradient always spans the full 100% range; background-size scales it so
      // the left anchor (blue) is always at 0% and the right anchor (red) always
      // represents 100%, regardless of how wide the fill actually is.
      const scale = p > 0 ? (100 / p * 100).toFixed(2) : '100';
      el.style.background = 'linear-gradient(90deg, var(--accent2), var(--accent), var(--accent3))';
      el.style.backgroundSize = `${scale}% 100%`;
      el.style.width = p + '%';
    });
  }, 500));
}

// ── MAL info panel ────────────────────────────────────────────────
export function renderInfoPanel(info, logicalStatus) {
  if (!info) return;
  
  // Add cover image if available
  if (info.image) {
    const container = document.getElementById('sp-cover-container');
    let img = container.querySelector('.sp-cover');
    if (!img) {
      img = document.createElement('img');
      img.className = 'sp-cover';
      container.appendChild(img);
    }
    img.src = info.image;
    img.alt = 'Cover';
  }

  // Move description to be inside the header content
  const descEl = document.getElementById('sp-desc');
  const headerContent = document.querySelector('.sp-header-content');
  if (descEl && headerContent && !headerContent.contains(descEl)) {
    headerContent.appendChild(descEl);
  }

  document.getElementById('ip-score').textContent   = info.score   ? `★ ${info.score}` : '—';
  document.getElementById('ip-rank').textContent    = info.rank    ? `#${info.rank}`    : '—';
  document.getElementById('ip-members').textContent = info.members ? fmtNum(info.members) : '—';

  // Source strip — spans full width below the four stat cells
  const mediumEl = document.getElementById('ip-medium');
  if (mediumEl) {
    const isManga  = info.medium === 'manga';
    const label    = isManga ? 'Manga' : 'Anime';
    const labelCls = isManga ? 'ip-medium-manga' : 'ip-medium-anime';
    const link     = info.url
      ? `<a href="${info.url}" target="_blank" rel="noopener" class="ip-mal-link">View on MyAnimeList ↗</a>`
      : '';
    mediumEl.innerHTML =
      `<span class="ip-source-label">Stats from</span>` +
      `<span class="ip-medium-badge ${labelCls}">${label}</span>` +
      link;
  }

  // Update stat labels to reflect the source medium
  const scoreLbl   = document.querySelector('#info-panel .info-stat:nth-child(1) .info-stat-lbl');
  const rankLbl    = document.querySelector('#info-panel .info-stat:nth-child(2) .info-stat-lbl');
  const membersLbl = document.querySelector('#info-panel .info-stat:nth-child(3) .info-stat-lbl');
  const src = info.medium === 'manga' ? 'Manga' : 'MAL';
  if (scoreLbl)   scoreLbl.textContent   = `${src} Score`;
  if (rankLbl)    rankLbl.textContent    = `${src} Rank`;
  if (membersLbl) membersLbl.textContent = `${src} Members`;
  
  if (descEl) {
    if (info.synopsis) {
      const fullText = info.synopsis;
      const limit = 400; // Increased limit for side-by-side layout
      if (fullText.length > limit) {
        descEl.innerHTML = `
          <span class="desc-text">${truncate(fullText, limit)}</span>
          <span class="desc-full" style="display:none">${fullText}</span>
          <button class="desc-toggle">See more</button>
        `;
        const toggleBtn = descEl.querySelector('.desc-toggle');
        const textSpan = descEl.querySelector('.desc-text');
        const fullSpan = descEl.querySelector('.desc-full');
        toggleBtn.addEventListener('click', () => {
          if (fullSpan.style.display === 'none') {
            textSpan.style.display = 'none';
            fullSpan.style.display = 'inline';
            toggleBtn.textContent = 'See less';
          } else {
            textSpan.style.display = 'inline';
            fullSpan.style.display = 'none';
            toggleBtn.textContent = 'See more';
          }
        });
      } else {
        descEl.textContent = fullText;
      }
    } else {
      descEl.textContent = '';
    }
  }
  
  // Handle new status object format with optional note
  let statusText = '—';
  if (logicalStatus) {
    if (typeof logicalStatus === 'object') {
      statusText = logicalStatus.status;
      if (logicalStatus.note) {
        // Add note as a smaller, different-colored subtext
        const statusEl = document.getElementById('ip-status');
        statusEl.innerHTML = `<span>${statusText}</span><br><span class="ip-status-note">${logicalStatus.note}</span>`;
        return;
      }
    } else {
      // Fallback for string status
      statusText = logicalStatus.replace('Finished (not fully adapted)', 'Finished');
    }
  } else if (info.status) {
    statusText = info.status.replace('Finished Airing','Finished').replace('Currently Airing','Airing');
  }
  document.getElementById('ip-status').innerHTML = statusText;
}

export function renderInfoLoading() {
  ['ip-score','ip-rank','ip-members','ip-status'].forEach(id => {
    document.getElementById(id).textContent = '…';
  });
  // Reset source strip while loading
  const mediumEl = document.getElementById('ip-medium');
  if (mediumEl) mediumEl.innerHTML = '';
  const scoreLbl   = document.querySelector('#info-panel .info-stat:nth-child(1) .info-stat-lbl');
  const rankLbl    = document.querySelector('#info-panel .info-stat:nth-child(2) .info-stat-lbl');
  const membersLbl = document.querySelector('#info-panel .info-stat:nth-child(3) .info-stat-lbl');
  if (scoreLbl)   scoreLbl.textContent   = 'MAL Score';
  if (rankLbl)    rankLbl.textContent    = 'Global Rank';
  if (membersLbl) membersLbl.textContent = 'Members';
}

// ── Series header ─────────────────────────────────────────────────
export function renderSeriesHeader(series) {
  const m = series.meta;
  const cfg = series.config;
  document.getElementById('sp-sub').textContent = `/ ${m.subtitle}`;
  const titleEl = document.getElementById('sp-title');
  titleEl.textContent = m.title;
  titleEl.onclick = () => titleEl.classList.toggle('expanded');
  
  // Adjust font size if title is too long
  titleEl.style.fontSize = '';
  const containerWidth = titleEl.parentElement.clientWidth;
  
  // Reset to base size first to get accurate scrollWidth
  titleEl.style.fontSize = '';
  
  // Reduce font size until it fits or reaches a minimum
  let fontSize = parseFloat(window.getComputedStyle(titleEl).fontSize);
  while (titleEl.scrollWidth > containerWidth && fontSize > 16) {
    fontSize -= 2;
    titleEl.style.fontSize = fontSize + 'px';
  }
  
  // Get separate anime/manga status pills
  const { animeStatus, mangaStatus } = getStatusPills(cfg);
  
  // Build status pills HTML
  let statusPillsHtml = '';
  if (animeStatus && animeStatus !== 'Unknown') {
    statusPillsHtml += `<span class="sp-tag sp-status-tag" style="border-color:var(--canon);color:var(--canon)">Anime: ${animeStatus}</span>`;
  }
  if (mangaStatus && mangaStatus !== 'Unknown') {
    statusPillsHtml += `<span class="sp-tag sp-status-tag" style="border-color:var(--accent3);color:var(--accent3)">Manga: ${mangaStatus}</span>`;
  }
  if (statusPillsHtml) {
    const statusContainer = document.getElementById('sp-status-pills');
    if (statusContainer) {
      statusContainer.innerHTML = statusPillsHtml;
      statusContainer.classList.remove('hidden');
    }
  }
  
  const tags = [
    m.source ? `Origin: ${m.source}` : null,
    `${m.totalEpisodes} Episodes`,
    `${m.totalChapters} Chapters`,
    m.adaptedPct === 100 ? 'Fully Adapted' : `${m.adaptedPct}% Adapted`,
  ].filter(Boolean);
  // Add genre tags if available
  if (m.tags && m.tags.length > 0) {
    tags.push(...m.tags);
  }
  document.getElementById('sp-tags').innerHTML = tags.map((t, i) => {
    const isOrigin = i === 0 && m.source;
    return `<span class="sp-tag${isOrigin ? ' sp-origin-tag' : ''}">${t}</span>`;
  }).join('');
}

// ── Adaptation bar ────────────────────────────────────────────────
export function renderOverview(series) {
  const m = series.meta;

  document.getElementById('ov-stats').innerHTML = `
    <div><div class="sv">${m.totalEpisodes}<span class="u">ep</span></div><div class="sl">Episodes</div></div>
    <div><div class="sv">${m.totalChapters}<span class="u">ch</span></div><div class="sl">Chapters</div></div>
    <div><div class="sv">${m.adaptedChapters}<span class="u">ch</span></div><div class="sl">Adapted</div></div>
    <div><div class="sv">${m.adaptedPct}<span class="u">%</span></div><div class="sl">Coverage</div></div>`;

  document.getElementById('bl-left').textContent  = `${m.adaptedPct}% adapted`;
  document.getElementById('bl-right').textContent = `${m.adaptedChapters} / ${m.totalChapters} chapters`;

  const fill = document.getElementById('bar-fill');
  const p = m.adaptedPct;
  const scale = p > 0 ? (100 / p * 100).toFixed(2) : '100';
  fill.style.cssText = `width:0;background:linear-gradient(90deg,var(--accent2),var(--accent),var(--accent3));background-size:${scale}% 100%`;
  requestAnimationFrame(() => setTimeout(() => { fill.style.width = p + '%'; }, 80));

  const rem = m.totalChapters - m.adaptedChapters;
  document.getElementById('bar-tip').innerHTML = m.adaptedPct < 100
    ? `<span class="tip-dot" style="background:var(--filler)"></span>${rem} chapters not yet adapted`
    : `<span class="tip-dot" style="background:var(--canon)"></span>Fully adapted — every chapter is covered`;

  const luEl = document.getElementById('bar-last-updated');
  if (luEl) {
    if (series.config.animeStatus === 'Ongoing' && series.config.lastUpdated) {
      const d = new Date(series.config.lastUpdated + 'T00:00:00');
      const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      luEl.textContent = `Data updated ${label}`;
      luEl.classList.remove('hidden');
    } else {
      luEl.classList.add('hidden');
    }
  }
}

// ── Seasons ───────────────────────────────────────────────────────
export function renderSeasons(series) {
  const seasons     = series.config?.malIds?.seasons || [];
  // Only TV series and films in section 01 — OVAs/specials belong in the Extras section at the bottom
  const altSeries   = (series.config?.malIds?.alternativeSeries || []).filter(s => s.type === 'tv' || s.type === 'movie');
  const canonMovies = series.arcs.filter(a => a.type === 'movie' && a.status === 'canon');
  const sec = document.getElementById('seasons-section');

  if (!seasons.length && !canonMovies.length && !altSeries.length) {
    sec.classList.add('hidden'); return;
  }
  sec.classList.remove('hidden');

  const typeLabel = t => ({ movie: 'Film', ova: 'OVA', tv: '' }[t] || '');

  // Primary seasons row — TV seasons AND any movies listed in malIds.seasons
  let primaryHtml = seasons.map(s => {
    const lbl = typeLabel(s.type);
    const eps = s.type === 'movie' ? '1 film' : `${s.eps} ep`;
    // Movie chips in the primary row scroll to their arc entry if one matches
    const arcMatch = canonMovies.find(m => m.malId === s.malId);
    if (arcMatch) {
      return `<div class="season-chip movie-chip" style="cursor:pointer" data-movie-chip="${arcMatch.id}">
        <span class="sdot"></span>
        ${lbl ? `<span class="chip-type-lbl">${lbl}</span>` : ''}${s.name}
        ${s.malId ? `<a href="https://myanimelist.net/anime/${s.malId}" target="_blank" rel="noopener" onclick="event.stopPropagation()">MAL ↗</a>` : ''}
      </div>`;
    }
    return `<div class="season-chip${s.type === 'movie' ? ' season-chip-film' : ''}">
      <span class="sdot"></span>
      ${lbl ? `<span class="chip-type-lbl">${lbl}</span>` : ''}${s.name}<span style="color:var(--text3);margin-left:.35rem">· ${eps}</span>
      ${s.malId ? `<a href="https://myanimelist.net/anime/${s.malId}" target="_blank" rel="noopener">MAL ↗</a>` : ''}
    </div>`;
  }).join('');

  // Canon movies from arcs that are NOT already listed in malIds.seasons — avoid duplicates
  const seasonMalIds = new Set(seasons.map(s => s.malId).filter(Boolean));
  primaryHtml += canonMovies
    .filter(m => !m.malId || !seasonMalIds.has(m.malId))
    .map(m =>
      `<div class="season-chip movie-chip" style="cursor:pointer" data-movie-chip="${m.id}">
        <span class="sdot"></span>
        <span class="chip-type-lbl">Film</span>${m.name}
        ${m.malId ? `<a href="https://myanimelist.net/anime/${m.malId}" target="_blank" rel="noopener" onclick="event.stopPropagation()">MAL ↗</a>` : ''}
      </div>`
    ).join('');

  // Alternative / parallel canon entries
  let altHtml = altSeries.map(s => {
    const lbl  = typeLabel(s.type);
    const eps  = s.type === 'movie' ? '1 film' : `${s.eps} ep`;
    const tip  = s.note ? ` title="${s.note.replace(/"/g, '&quot;')}"` : '';
    return `<div class="season-chip season-chip-alt"${tip}>
      <span class="sdot sdot-alt"></span>
      ${lbl ? `<span class="chip-type-lbl">${lbl}</span>` : ''}${s.name}<span style="color:var(--text3);margin-left:.35rem">· ${eps}</span>
      <a href="https://myanimelist.net/anime/${s.malId}" target="_blank" rel="noopener">MAL ↗</a>
    </div>`;
  }).join('');

  const html = primaryHtml
    + (altHtml ? `<div class="seasons-alt-divider" title="Alternative or parallel canon adaptations">also</div>${altHtml}` : '');

  document.getElementById('seasons-list').innerHTML = html;

  document.querySelectorAll('.movie-chip[data-movie-chip]').forEach(el =>
    el.addEventListener('click', () => highlightRow(`epr-movie-${el.dataset.movieChip}`))
  );
}

// ── Arc cards (with inline movie arcs) ───────────────────────────
export function renderArcs(series, onEpClick) {
  const arcNames = buildArcNameMap(series);
  const grid = document.getElementById('arcs-grid');
  let idx = 1;

  grid.innerHTML = series.arcs.map(arc => {
    const isMovie = arc.type === 'movie' || arc.type === 'special';
    const num = String(idx++).padStart(2, '0');
    const eps = series.episodes.filter(e => e.arc === arc.id).sort((a, b) => (a.ep ?? 0) - (b.ep ?? 0));

    // Chapter range — handles "0.1–0.4" style prequel ranges too
    const chRange = arc.chapterStart != null && arc.chapterEnd != null && arc.chapterStart !== 0
      ? `Ch ${arc.chapterStart}–${arc.chapterEnd}`
      : null;

    // Episode / film range label
    const epRange = isMovie
      ? (arc.type === 'movie' ? 'Film' : 'Special')
      : arc.episodeStart > 0 ? `Ep ${arc.episodeStart}–${arc.episodeEnd}` : 'Not yet adapted';

    // Episode list items — movies show "Movie" label, regular show "E{n}"
    const epItems = eps.length
      ? eps.map(ep => {
          if (ep.type === 'movie') {
            return `<div class="ep-item ep-item-movie" data-movie="${ep.arc}" style="cursor:pointer">
              <span class="ep-num" style="color:var(--text2)">Movie</span>
              <span class="ep-title">${ep.title}</span>
            </div>`;
          }
          return `<div class="ep-item" data-n="${ep.ep}">
            <span class="ep-num">E${ep.ep}</span>
            <span class="ep-title">${ep.title}</span>
            <span class="dot d-${ep.status}"></span>
          </div>`;
        }).join('')
      : '<div style="padding:.4rem 0;color:var(--text3);font-size:.78rem;font-style:italic">No episodes adapted for this arc yet.</div>';

    return `<div class="arc-card${isMovie ? ' arc-movie' : ''}" id="arc-${arc.id}">
      <div class="arc-hdr" onclick="this.closest('.arc-card').classList.toggle('open')">
        <div class="arc-n">${num}</div>
        <div class="arc-info">
          <div class="arc-name">${arc.name}</div>
          <div class="arc-range">
            ${chRange ? `<span>${chRange}</span>` : ''}
            ${!isMovie ? `<span>${epRange}</span>` : ''}
          </div>
        </div>
        <span class="arc-badge s-${arc.status || 'canon'}">${cap(arc.status || 'canon')}</span>
        <span class="arc-chev">▾</span>
      </div>
      <div class="arc-body">
        ${arc.note && !isMovie ? `<p class="arc-note">${arc.note}</p>` : ''}
        <div class="ep-list">${epItems}</div>

      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.ep-item[data-n]').forEach(el =>
    el.addEventListener('click', () => onEpClick(Number(el.dataset.n)))
  );
  grid.querySelectorAll('.ep-item[data-movie]').forEach(el =>
    el.addEventListener('click', () => highlightRow(`epr-movie-${el.dataset.movie}`))
  );
}

// ── Episode table ─────────────────────────────────────────────────
export function renderEpTable(series, filter) {
  const arcNames = buildArcNameMap(series);
  const chTitles = series.chapterTitles || {};
  // Keep movies in watch-order position but render them as banners, not table rows
  const allInOrder = [...series.episodes]; // already in watch order from JSON
  const regularEps = allInOrder.filter(e => e.type !== 'movie').sort((a, b) => a.ep - b.ep);
  let eps = filter !== 'all' ? regularEps.filter(e => e.status === filter) : regularEps;
  document.getElementById('ep-count').textContent = `${regularEps.length} episodes`;

  // Helper: movie row (table) or card — same structure as a regular ep, "Movie" label
  const movieBannerRow  = (ep) => {
    const cs = fmtChapters(ep.chapters) || '—';
    const tooltip = fmtChapterTitleTooltip(ep.chapters, chTitles);
    const chCell = tooltip
      ? `<td class="td-c" title="${tooltip.replace(/"/g, '&quot;')}">${cs}</td>`
      : `<td class="td-c">${cs}</td>`;
    return `<tr id="epr-movie-${ep.arc}" class="ep-movie-row">
      <td class="td-n" style="color:var(--text2)">Movie</td>
      <td class="td-t">${ep.title}</td>
      <td class="td-a">${arcNames[ep.arc] || '—'}</td>
      <td class="td-s"><span class="dot d-canon"></span>Canon</td>
      ${chCell}
    </tr>`;
  };
  const movieBannerCard = (ep) => {
    const cs = fmtChapters(ep.chapters) || null;
    const arc = arcNames[ep.arc] || null;
    const tooltip = fmtChapterTitleTooltip(ep.chapters, chTitles);
    return `<div class="ep-card ep-movie-card" id="epcard-movie-${ep.arc}">
      <div class="ep-card-num" style="color:var(--text2)">Movie</div>
      <div class="ep-card-body">
        <div class="ep-card-title">${ep.title}</div>
        <div class="ep-card-meta">
          ${arc ? `<span class="ep-card-arc">${arc}</span>` : ''}
          <span class="ep-card-status"><span class="dot d-canon"></span>Canon</span>
          ${cs ? `<span class="ep-card-ch"${tooltip ? ` title="${tooltip.replace(/"/g, '&quot;')}"` : ''}>${cs}</span>` : ''}
        </div>
      </div>
    </div>`;
  };

  // Build table rows with movie banners interleaved at correct watch positions
  const buildRows = (renderEp, renderMovie) => {
    const rows = [];
    let moviesDone = new Set();
    // Movies are always canon — only show them when filter is 'all' or 'canon'
    const showMovies = filter === 'all' || filter === 'canon';
    for (const ep of regularEps) {
      // Insert movie banners that should appear before this ep
      if (showMovies) {
        for (const m of allInOrder) {
          if (m.type !== 'movie' || moviesDone.has(m.title)) continue;
          const mIdx = allInOrder.indexOf(m);
          const epIdx = allInOrder.indexOf(ep);
          if (mIdx < epIdx) { rows.push(renderMovie(m)); moviesDone.add(m.title); }
        }
      }
      if (filter === 'all' || ep.status === filter) rows.push(renderEp(ep));
    }
    // Any trailing movies
    if (showMovies) {
      for (const m of allInOrder) {
        if (m.type === 'movie' && !moviesDone.has(m.title)) rows.push(renderMovie(m));
      }
    }
    return rows.join('');
  };

  // Table rows (desktop)
  const tableRows = buildRows(ep => {
      const cs = fmtChapters(ep.chapters) || '—';
      const tooltip = fmtChapterTitleTooltip(ep.chapters, chTitles);
      const chCell = tooltip
        ? `<td class="td-c" title="${tooltip.replace(/"/g, '&quot;')}">${cs}</td>`
        : `<td class="td-c">${cs}</td>`;
      return `<tr id="epr-${ep.ep}">
        <td class="td-n">E${ep.ep}</td>
        <td class="td-t">${ep.title}</td>
        <td class="td-a">${arcNames[ep.arc] || '—'}</td>
        <td class="td-s"><span class="dot d-${ep.status}"></span>${cap(ep.status)}</td>
        ${chCell}
      </tr>`;
    }, movieBannerRow);
  document.getElementById('ep-tbody').innerHTML = tableRows || emptyRow(5);

  // Cards (mobile)
  const cardRows = buildRows(ep => {
      const cs = fmtChapters(ep.chapters) || null;
      const arc = arcNames[ep.arc] || null;
      const tooltip = fmtChapterTitleTooltip(ep.chapters, chTitles);
      return `<div class="ep-card" id="epcard-${ep.ep}">
        <div class="ep-card-num">E${ep.ep}</div>
        <div class="ep-card-body">
          <div class="ep-card-title">${ep.title}</div>
          <div class="ep-card-meta">
            ${arc ? `<span class="ep-card-arc">${arc}</span>` : ''}
            <span class="ep-card-status"><span class="dot d-${ep.status}"></span>${cap(ep.status)}</span>
            ${cs ? `<span class="ep-card-ch"${tooltip ? ` title="${tooltip.replace(/"/g, '&quot;')}"` : ''}>${cs}</span>` : ''}
          </div>
        </div>
      </div>`;
    }, movieBannerCard);
  document.getElementById('ep-card-list').innerHTML = cardRows || '<div class="card-empty">Nothing here.</div>';
}

// ── Chapter table ─────────────────────────────────────────────────
export function renderChTable(series, filter) {
  const arcNames = buildArcNameMap(series);
  let chs = [...series.chapters];
  if (filter === 'adapted')   chs = chs.filter(c => c.adapted);
  if (filter === 'unadapted') chs = chs.filter(c => !c.adapted);
  document.getElementById('ch-count').textContent = `${chs.length} chapters`;

  // Table rows (desktop)
  document.getElementById('ch-tbody').innerHTML = chs.length
    ? chs.map(ch => {
        const eps = series.chToEp[ch.n] || [];
        const fmtEpLabel = v => v === 'movie' ? 'Movie' : `E${v}`;
        const es = eps.length ? (eps.length === 1 ? fmtEpLabel(eps[0]) : `${fmtEpLabel(eps[0])}–${fmtEpLabel(eps[eps.length - 1])}`) : '—';
        // Show manga chapter title when available, else plain "Chapter N"
        const titleCell = ch.title
          ? `<td class="td-t"><span class="ch-manga-title">${ch.title}</span></td>`
          : `<td class="td-t">Chapter ${ch.n}</td>`;
        return `<tr id="chr-${ch.n}">
          <td class="td-n">Ch ${ch.n}</td>
          ${titleCell}
          <td class="td-a">${arcNames[ch.arcId] || '—'}</td>
          <td class="td-s">${ch.adapted ? '<span class="yes">✓ Adapted</span>' : '<span class="nope">Not adapted</span>'}</td>
          <td class="td-c">${es}</td>
        </tr>`;
      }).join('')
    : emptyRow(5);

  // Cards (mobile) — manga title as primary headline when available
  document.getElementById('ch-card-list').innerHTML = chs.length
    ? chs.map(ch => {
        const eps = series.chToEp[ch.n] || [];
        const fmtEpLabelC = v => v === 'movie' ? 'Movie' : `E${v}`;
        const es = eps.length ? (eps.length === 1 ? fmtEpLabelC(eps[0]) : `${fmtEpLabelC(eps[0])}–${fmtEpLabelC(eps[eps.length - 1])}`) : null;
        const arc = arcNames[ch.arcId] || null;
        const cardTitle = ch.title
          ? `<div class="ep-card-title">${ch.title}<span class="ch-num-badge">Ch ${ch.n}</span></div>`
          : `<div class="ep-card-title">Chapter ${ch.n}</div>`;
        return `<div class="ep-card" id="chcard-${ch.n}">
          <div class="ep-card-num">Ch<br>${ch.n}</div>
          <div class="ep-card-body">
            ${cardTitle}
            <div class="ep-card-meta">
              ${arc ? `<span class="ep-card-arc">${arc}</span>` : ''}
              ${ch.adapted
                ? `<span class="ep-card-adapted">✓ Adapted</span>${es ? `<span class="ep-card-ch">${es}</span>` : ''}`
                : `<span class="ep-card-unadapted">Not adapted</span>`
              }
            </div>
          </div>
        </div>`;
      }).join('')
    : '<div class="card-empty">No chapters match.</div>';
}

// ── Watch Guide (for complex multi-series / with gaps) ────────────
export function renderWatchGuide(series) {
  const guide = series.config?.watchGuide || series.watchGuide || null;
  const sec = document.getElementById('watch-guide-section');
  if (!sec) return;
  if (!guide?.length) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  // Collapsed by default — open on click via toggleWatchGuide()
  const body = document.getElementById('wg-body');
  const chev = document.getElementById('wg-chev');
  const badge = document.getElementById('wg-badge');
  if (body) { body.classList.remove('wg-open'); }
  if (chev) { chev.textContent = '▾'; }
  // Badge: count steps + call out any manga-required gaps
  if (badge) {
    const mangaGaps = guide.filter(s => s.type === 'manga-required').length;
    badge.textContent = mangaGaps > 0 ? `${guide.length} steps · ${mangaGaps} manga gap${mangaGaps > 1 ? 's' : ''}` : `${guide.length} steps`;
  }

  const typeIcon = { anime: '▶', 'movie-set': '🎬', 'manga-required': '📖', choice: '⚡' };
  const typeClass = {
    anime: 'wg-anime',
    'movie-set': 'wg-movie',
    'manga-required': 'wg-manga',
    choice: 'wg-choice',
  };

  const renderStep = (step, idx) => {
    if (step.type === 'choice') {
      const opts = (step.options || []).map((opt, oi) => `
        <div class="wg-option">
          <div class="wg-option-hdr">
            <span class="wg-type-badge ${typeClass[opt.type] || 'wg-anime'}">${typeIcon[opt.type] || '▶'} ${opt.subtitle || ''}</span>
            <strong class="wg-opt-title">${opt.title}</strong>
            ${opt.covers ? `<span class="wg-covers">Ch ${opt.covers.replace(/^Ch /, '')}</span>` : ''}
          </div>
          ${opt.note ? `<p class="wg-note">${opt.note}</p>` : ''}
          ${opt.malId ? `<a class="wg-mal-link" href="https://myanimelist.net/anime/${opt.malId}" target="_blank" rel="noopener">MAL ↗</a>` : ''}
        </div>
        ${oi < (step.options.length - 1) ? '<div class="wg-or">or</div>' : ''}
      `).join('');
      return `
        <div class="wg-step wg-choice-step" id="wg-step-${idx}">
          <div class="wg-step-num">${idx + 1}</div>
          <div class="wg-step-body">
            <div class="wg-step-label">${step.label || 'Choose one'}</div>
            ${step.note ? `<p class="wg-note wg-choice-note">${step.note}</p>` : ''}
            <div class="wg-options">${opts}</div>
          </div>
        </div>`;
    }

    const isManga = step.type === 'manga-required';
    return `
      <div class="wg-step ${typeClass[step.type] || ''}" id="wg-step-${idx}">
        <div class="wg-step-num">${idx + 1}</div>
        <div class="wg-step-body">
          <div class="wg-step-hdr">
            <span class="wg-type-badge ${typeClass[step.type] || 'wg-anime'}">${typeIcon[step.type] || '▶'} ${step.subtitle || (isManga ? 'Manga' : 'Anime')}</span>
            <strong class="wg-step-title">${step.title}</strong>
            ${step.covers ? `<span class="wg-covers">${step.covers.startsWith('Ch') ? step.covers : 'Ch ' + step.covers}</span>` : ''}
          </div>
          ${step.note ? `<p class="wg-note">${step.note}</p>` : ''}
          ${step.startChapter ? `<div class="wg-start-ch">▶ Start reading from <strong>Chapter ${step.startChapter}</strong></div>` : ''}
          ${step.malId ? `<a class="wg-mal-link" href="https://myanimelist.net/anime/${step.malId}" target="_blank" rel="noopener">MAL ↗</a>` : ''}
        </div>
      </div>`;
  };

  document.getElementById('watch-guide-list').innerHTML = guide.map(renderStep).join(
    '<div class="wg-connector"><div class="wg-connector-line"></div></div>'
  );
}


export function renderSeasonMap(series) {
  const seasonMap = series.meta.seasonMap || [];

  // Desktop table
  document.getElementById('sv-tbody').innerHTML = seasonMap.length
    ? seasonMap.map(entry => `<tr id="sv-${entry.season}-${entry.seasonEp}">
        <td class="td-n">${entry.season}</td>
        <td class="td-n">Ep ${entry.seasonEp}</td>
        <td class="td-c">${entry.overallEp}</td>
      </tr>`).join('')
    : emptyRow(3);

  // Cards (mobile) — grouped by season
  const cardEl = document.getElementById('sv-card-list');
  if (!cardEl) return;
  if (!seasonMap.length) { cardEl.innerHTML = '<div class="card-empty">No season data.</div>'; return; }

  // Group entries by season name
  const groups = [];
  let cur = null;
  for (const entry of seasonMap) {
    if (!cur || cur.name !== entry.season) {
      cur = { name: entry.season, entries: [] };
      groups.push(cur);
    }
    cur.entries.push(entry);
  }

  cardEl.innerHTML = groups.map(g => `
    <div class="sv-season-group">
      <div class="sv-season-hdr">${g.name}</div>
      <div class="sv-season-eps">
        ${g.entries.map(e => `
          <div class="sv-ep-row" id="sv-${e.season}-${e.seasonEp}">
            <span class="sv-ep-local">Ep ${e.seasonEp}</span>
            <span class="sv-ep-overall">Overall E${e.overallEp}</span>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

// ── Extras (non-canon OVAs, films) at bottom ──────────────────────
export function renderExtrasLoading() {
  document.getElementById('noncanon-grid').innerHTML = '<div class="api-msg">Fetching from MyAnimeList…</div>';
}

export function renderExtras(items) {
  const grid = document.getElementById('noncanon-grid');
  const section = document.getElementById('extras-section');
  if (!items.length) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');

  const typeOrder = { Movie: 0, OVA: 1, Special: 2, ONA: 3 };
  items.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9));

  grid.innerHTML = items.map(item => `
    <div class="nc-card">
      <div class="nc-type">${item.type} · ${item.relation}</div>
      <div class="nc-title">${item.title}</div>
      <div class="nc-meta">${item.episodes ? item.episodes + ' ep · ' : ''}${item.aired || 'TBA'}</div>
      ${item.score ? `<div class="nc-score">★ ${item.score}</div>` : ''}
      ${item.url ? `<a class="nc-mal" href="${item.url}" target="_blank" rel="noopener">MyAnimeList ↗</a>` : ''}
    </div>`
  ).join('');
}

export function renderExtrasError() {
  const section = document.getElementById('extras-section');
  section.classList.remove('hidden');
  document.getElementById('noncanon-grid').innerHTML =
    '<div class="api-msg" style="color:var(--text3)">Could not load extras. Check connection and try again.</div>';
}

// ── Row highlight helper ──────────────────────────────────────────
export function highlightRow(id) {
  // On mobile the table is hidden; highlight the card instead
  const cardId = id.startsWith('epr-') ? 'epcard-' + id.slice(4)
               : id.startsWith('chr-') ? 'chcard-' + id.slice(4)
               : null;
  const el = (cardId && document.getElementById(cardId)?.offsetParent !== null)
    ? document.getElementById(cardId)
    : document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('hl');
  setTimeout(() => el.classList.remove('hl'), 3000);
}
