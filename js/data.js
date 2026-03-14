/**
 * data.js — loads JSON and builds derived structures.
 *
 * Two-layer loading strategy for scalability:
 *
 * 1. loadCatalog() — fetches data/index.json, a single lightweight file
 *    containing only the fields needed to render the home screen cards
 *    (id, title, tags, totalEpisodes, totalChapters, adaptedPct, malId).
 *    One request on the home screen regardless of how many series exist.
 *    Returns lightweight catalog objects, enough for the grid and search.
 *
 * 2. loadSeries(id) — fetches the full data/[id].json on demand, only when
 *    the user navigates to a specific series. Cached so revisiting is free.
 *
 * When adding a new series, regenerate index.json by running:
 *   node scripts/build-index.js
 * or follow the instructions in CONTRIBUTING.md.
 *
 * chapterTitles support: an optional top-level "chapterTitles" object
 * in the JSON (e.g. { "1": "Prologue", "2": "Departure" }) enriches
 * each chapter entry with a .title field used across the UI and search.
 */

import { computeSeriesStatus } from './status.js';

const loaded = new Map();

/**
 * Load the lightweight catalog from data/index.json.
 * Returns objects shaped to match what renderGrid and initSearch expect.
 */
export async function loadCatalog() {
  const res = await fetch('data/index.json');
  if (!res.ok) throw new Error('Failed to load data/index.json');
  const entries = await res.json();
  return entries.map(e => ({
    id: e.id,
    config: {
      id: e.id,
      title: e.title,
      abbr: e.abbr || [],
      malIds: e.malId ? { primary: e.malId } : {},
    },
    meta: {
      title: e.title,
      tags: e.tags || [],
      totalEpisodes: e.totalEpisodes,
      totalChapters: e.totalChapters,
      adaptedPct: e.adaptedPct,
      animeStatus: e.animeStatus,
      mangaStatus: e.mangaStatus,
    },
  }));
}

export async function loadSeries(seriesId) {
  if (loaded.has(seriesId)) return loaded.get(seriesId);

  const res = await fetch(`data/${seriesId}.json`);
  if (!res.ok) throw new Error(`Failed to load data/${seriesId}.json`);
  const json = await res.json();

  const enriched = enrich(json);
  loaded.set(seriesId, enriched);
  return enriched;
}

function enrich(json) {
  // Normalize arcs: default status to "canon" when omitted
  const arcs = (json.arcs || []).map(a => ({ ...a, status: a.status || 'canon' }));
  // Normalize episodes: default status to 'canon' when omitted (same as arcs)
  const episodes = (json.episodes || []).map(e => ({ ...e, status: e.status || 'canon' }));

  // Optional manga chapter titles: { "1": "Prologue", "2": "Title", … }
  // Keys are string representations of chapter numbers.
  const chapterTitles = json.chapterTitles || {};

  // Build chapter→episode map from actual episode data
  const chToEp = buildChToEp(episodes);

  // A chapter is adapted only if it genuinely appears in an episode's chapters[]
  const chapters = buildChapters(arcs, json.meta.totalChapters, chToEp, chapterTitles, json.prequelChapters || []);

  // Derive fields that don't need to be stored in JSON
  const subtitle       = json.source && json.source !== 'Original' ? `Anime · ${json.source}` : 'Anime';
  const totalEpisodes  = (json.meta.seasons || []).reduce((s, x) => s + x.eps, 0);
  const adaptedChapters = chapters.filter(c => c.adapted).length;
  const adaptedPct     = json.meta.totalChapters > 0
    ? Math.round(adaptedChapters / json.meta.totalChapters * 100)
    : 0;

  const logicalStatus = computeSeriesStatus({
    meta: { adaptedPct },
    config: {
      id: json.id,
      malIds: json.malIds,
      animeStatus: json.animeStatus,
      mangaStatus: json.mangaStatus
    }
  });

  return {
    id: json.id,
    config: {
      id: json.id,
      title: json.title,
      abbr: json.abbr,
      subtitle,
      source: json.source,
      animeStatus: json.animeStatus,
      mangaStatus: json.mangaStatus,
      lastUpdated: json.lastUpdated || null,
      tags: json.tags,
      colors: json.colors,
      malIds: json.malIds,
      watchGuide: json.watchGuide || null,
    },
    meta: {
      ...json.meta,
      title: json.title,
      subtitle,
      colors: json.colors,
      tags: json.tags,
      source: json.source,
      abbr: json.abbr,
      totalEpisodes,
      adaptedChapters,
      adaptedPct,
      seasonMap: buildSeasonMap(json.meta?.seasons || []),
      logicalStatus,
      hasChapterTitles: Object.keys(chapterTitles).length > 0,
    },
    arcs,
    episodes,
    chapters,
    chToEp,
    chapterTitles,
  };
}

/** Expand compact [{name, eps}] season list into the full seasonMap array. */
function buildSeasonMap(seasons) {
  const map = [];
  let overall = 1;
  for (const s of seasons) {
    for (let i = 1; i <= s.eps; i++) {
      map.push({ season: s.name, seasonEp: i, overallEp: overall++ });
    }
  }
  return map;
}

/** Mark a chapter adapted only if ≥1 episode actually covers it. */
function buildChapters(arcs, total, chToEp, chapterTitles = {}, prequelChapters = []) {
  const movieArc = arcs.find(a => a.type === 'movie') ?? null;
  const prequel = prequelChapters.map(pc => ({
    n: pc.n,
    arcId: movieArc?.id ?? null,
    adapted: !!(chToEp[pc.n] && chToEp[pc.n].length > 0),
    title: pc.title ?? chapterTitles[pc.n] ?? null,
    prequel: true,
  }));
  const main = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    const arc = arcs.find(a => n >= a.chapterStart && n <= a.chapterEnd && a.type !== 'movie');
    return {
      n,
      arcId: arc ? arc.id : null,
      adapted: !!(chToEp[n] && chToEp[n].length > 0),
      title: chapterTitles[String(n)] ?? chapterTitles[n] ?? null,
    };
  });
  return [...prequel, ...main];
}

function buildChToEp(episodes) {
  const map = {};
  for (const ep of episodes) {
    const label = ep.type === 'movie' ? 'movie' : ep.ep;
    for (const ch of (ep.chapters || [])) {
      (map[ch] = map[ch] || []).push(label);
    }
  }
  return map;
}

export function buildArcNameMap(series) {
  const map = {};
  for (const arc of series.arcs) map[arc.id] = arc.name;
  return map;
}
