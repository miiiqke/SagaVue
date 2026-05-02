/**
 * pickup.js — "Pick Up Here" widget.
 * Tells the user which manga chapter to start at after stopping at a given episode.
 */

// ── Core logic ────────────────────────────────────────────────────

/**
 * Returns a result object or a typed sentinel. Never throws.
 *
 * @param {Object}      seriesData   — enriched series from data.js
 * @param {number|null} episodeInput — episode number, or null = "just finished"
 * @returns {Object|null}
 */
export function getPickUpResult(seriesData, episodeInput) {
  const regularEps = seriesData.episodes
    .filter(e => e.type !== 'movie')
    .sort((a, b) => a.ep - b.ep);

  const totalEpisodes = regularEps.length;
  const isFinished    = episodeInput === null;
  const targetEp      = isFinished ? totalEpisodes : episodeInput;

  // Out-of-range guard
  if (targetEp < 1 || targetEp > totalEpisodes || !Number.isInteger(targetEp)) {
    return { error: 'out-of-range', max: totalEpisodes };
  }

  // ── 1. Derive startChapter from chapters[] ───────────────────────
  // Walk backwards from the target episode to find the nearest one
  // with real chapter numbers (skips filler / anime-original gaps).
  let startChapter = null;

  const targetIdx = regularEps.findIndex(e => e.ep === targetEp);
  let walkIdx = targetIdx !== -1 ? targetIdx : targetEp - 1;
  walkIdx = Math.min(walkIdx, regularEps.length - 1);

  while (walkIdx >= 0) {
    const ep = regularEps[walkIdx];
    const realChs = (ep.chapters || []).filter(
      c => Number.isFinite(Number(c)) && !isNaN(Number(c))
    ).map(Number);

    if (realChs.length) {
      startChapter = Math.max(...realChs) + 1;
      break;
    }
    walkIdx--;
  }

  // ── 2. Override: mangaEntry.afterFullAnime (just-finished path) ───
  if (isFinished && seriesData.mangaEntry?.afterFullAnime != null) {
    startChapter = seriesData.mangaEntry.afterFullAnime;
  }

  // ── 3. Override: last watchGuide manga-required step (just-finished) ─
  if (isFinished) {
    const guide = seriesData.config?.watchGuide;
    if (guide?.length) {
      const mangaSteps = guide.filter(s => s.type === 'manga-required' && s.startChapter);
      if (mangaSteps.length) {
        startChapter = mangaSteps[mangaSteps.length - 1].startChapter;
      }
    }
  }

  if (startChapter == null) return null;

  const totalChapters = seriesData.meta.totalChapters;

  // Caught-up check — only when the user has genuinely finished the anime
  // or is on the very last episode. A mid-series episode that happens to cover
  // the final chapter (e.g. AoT ep 93 shares ch 139 with ep 94) should NOT
  // trigger caught-up; clamp instead so we don't return a nonexistent chapter.
  if (startChapter > totalChapters) {
    if (isFinished || targetEp === totalEpisodes) return { caughtUp: true };
    startChapter = totalChapters; // clamp for mid-series overlap
  }

  const chaptersAhead = totalChapters ? totalChapters - startChapter + 1 : null;

  // Skipped arcs only relevant on the just-finished path
  const skippedArcs = isFinished ? (seriesData.mangaEntry?.skippedArcs ?? []) : [];

  // Resolve manga status from config (normalised by data.js)
  const mangaStatus = seriesData.config?.mangaStatus
    ?? seriesData.mangaStatus
    ?? null;

  return { startChapter, chaptersAhead, mangaStatus, skippedArcs };
}

// ── Rendering ─────────────────────────────────────────────────────

function renderPickupResult(result) {
  const el = document.getElementById('pickup-result');
  if (!el) return;

  if (!result) {
    el.hidden = true;
    return;
  }

  if (result.error === 'out-of-range') {
    el.innerHTML = `<div class="pickup-error">Enter a valid episode number (1–${result.max})</div>`;
    el.hidden = false;
    return;
  }

  if (result.caughtUp) {
    el.innerHTML = `
      <div class="pickup-answer pickup-caught-up">
        <span class="pickup-ch-icon">✓</span>
        <span>You're all caught up — the anime has adapted everything available so far.</span>
      </div>`;
    el.hidden = false;
    return;
  }

  const { startChapter, chaptersAhead, mangaStatus, skippedArcs } = result;

  const metaParts = [];
  if (chaptersAhead != null) {
    metaParts.push(`${chaptersAhead} chapter${chaptersAhead !== 1 ? 's' : ''} ahead`);
  }
  if (mangaStatus === 'Hiatus') {
    metaParts.push('Series on hiatus');
  } else if (mangaStatus && mangaStatus !== 'Unknown') {
    metaParts.push(mangaStatus);
  }
  const meta = metaParts.length
    ? `<span class="pickup-meta">· ${metaParts.join(' · ')}</span>`
    : '';

  const skippedHtml = skippedArcs.map(arc => `
    <div class="pickup-skipped">
      <span class="pickup-skipped-icon">⚠</span>
      The anime skipped <strong>${arc.name}</strong>${arc.chapters ? ` (${arc.chapters})` : ''} — ${arc.note}
    </div>`).join('');

  el.innerHTML = `
    <div class="pickup-answer">
      <span class="pickup-prefix">Start at</span>
      <strong class="pickup-ch">Chapter ${startChapter}</strong>
      ${meta}
    </div>
    ${skippedHtml}`;
  el.hidden = false;
}

// ── Widget init ───────────────────────────────────────────────────

/**
 * Wire up the widget for the currently displayed series.
 * Call this every time a new series page is shown.
 */
export function initPickupWidget(seriesData) {
  const section = document.getElementById('pickup-section');
  if (!section) return;

  const regularEps    = seriesData.episodes.filter(e => e.type !== 'movie');
  const totalEpisodes = regularEps.length;

  // Reset to blank state
  const resultEl = document.getElementById('pickup-result');
  if (resultEl) resultEl.hidden = true;

  // Replace nodes to wipe old event listeners
  const oldInput = document.getElementById('pickup-ep-input');
  const oldBtn   = document.getElementById('pickup-finished-btn');

  const newInput = oldInput.cloneNode(true);
  oldInput.parentNode.replaceChild(newInput, oldInput);
  const newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);

  newInput.value       = '';
  newInput.max         = totalEpisodes;
  newInput.placeholder = `Episode Number (1–${totalEpisodes})`;

  newInput.addEventListener('input', () => {
    const raw = newInput.value.trim();
    if (!raw) { document.getElementById('pickup-result').hidden = true; return; }
    const ep = parseInt(raw, 10);
    renderPickupResult(getPickUpResult(seriesData, isNaN(ep) ? -1 : ep));
  });

  newBtn.addEventListener('click', () => {
    newInput.value = '';
    renderPickupResult(getPickUpResult(seriesData, null));
  });
}
