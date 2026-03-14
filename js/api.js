/**
 * api.js — Jikan v4 (MyAnimeList) wrapper.
 * Fetches only series-level info: score, rank, members, status, synopsis.
 * Related media is handled via static data in the JSON files (canon items)
 * or the non-canon extras section.
 */

const BASE = 'https://api.jikan.moe/v4';
const cache = new Map();
let lastRequestTime = 0;

async function jikan(path) {
  if (cache.has(path)) return cache.get(path);
  // Respect ~3 req/s rate limit — only throttle if a request was made recently
  const now = Date.now();
  const gap = now - lastRequestTime;
  if (lastRequestTime > 0 && gap < 350) {
    await new Promise(r => setTimeout(r, 350 - gap));
  }
  lastRequestTime = Date.now();
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Jikan ${res.status}: ${path}`);
  const json = await res.json();
  cache.set(path, json);
  return json;
}

/**
 * Fetch top-level info for a single MAL anime ID.
 * Returns a trimmed object with score, rank, members, status, url.
 */
export async function fetchSeriesInfo(malId) {
  const data = await jikan(`/anime/${malId}`);
  const a = data.data;
  return {
    score:    a.score    ?? null,
    rank:     a.rank     ?? null,
    members:  a.members  ?? null,
    status:   a.status   ?? null,
    url:      a.url      ?? null,
    synopsis: a.synopsis ?? null,
    image:    a.images?.jpg?.large_image_url ?? a.images?.jpg?.image_url ?? null,
    medium:   'anime',
  };
}

/**
 * Fetch both anime and manga MAL data, return whichever has more members.
 * This lets series like Berserk — where the manga dwarfs any anime adaptation
 * in popularity — display their most representative stats without special-casing.
 *
 * The returned object includes a `medium` field ('anime' | 'manga') so the
 * UI can label the source clearly.
 *
 * @param {number} animeId  — MAL anime ID (required)
 * @param {number} mangaId  — MAL manga ID (optional; falls back to anime-only)
 */
export async function fetchBestInfo(animeId, mangaId) {
  // Always fetch anime
  const animeData = await jikan(`/anime/${animeId}`);
  const a = animeData.data;
  const animeInfo = {
    score:    a.score    ?? null,
    rank:     a.rank     ?? null,
    members:  a.members  ?? 0,
    status:   a.status   ?? null,
    url:      a.url      ?? null,
    synopsis: a.synopsis ?? null,
    image:    a.images?.jpg?.large_image_url ?? a.images?.jpg?.image_url ?? null,
    medium:   'anime',
  };

  if (!mangaId) return animeInfo;

  // Fetch manga — non-blocking, graceful fallback
  try {
    const mangaData = await jikan(`/manga/${mangaId}`);
    const m = mangaData.data;
    const mangaInfo = {
      score:    m.score    ?? null,
      rank:     m.rank     ?? null,
      members:  m.members  ?? 0,
      status:   m.status   ?? null,
      url:      m.url      ?? null,
      synopsis: m.synopsis ?? null,
      image:    m.images?.jpg?.large_image_url ?? m.images?.jpg?.image_url ?? null,
      medium:   'manga',
    };
    // Pick the medium with more members — the more popular source tells a
    // better story about the series' cultural footprint
    return (mangaInfo.members > animeInfo.members) ? mangaInfo : animeInfo;
  } catch {
    return animeInfo; // manga fetch failed — anime is fine
  }
}

/**
 * Fetch full status data (anime + manga) for computing series state
 */
export async function fetchFullStatusData(animeId, mangaId) {
  try {
    const animeData = await jikan(`/anime/${animeId}`);
    const animeStatus = animeData.data?.status || null;
    
    let mangaStatus = null;
    if (mangaId) {
      try {
        const mangaData = await jikan(`/manga/${mangaId}`);
        mangaStatus = mangaData.data?.status || null;
      } catch {
        // Silently fail if manga data unavailable
      }
    }
    
    return { animeStatus, mangaStatus };
  } catch (e) {
    console.error('Error fetching full status data:', e);
    return { animeStatus: null, mangaStatus: null };
  }
}

/**
 * Fetch basic info for a specific MAL ID (used for movie cards).
 */
export async function fetchAnimeInfo(malId) {
  const data = await jikan(`/anime/${malId}`);
  return data.data;
}

/**
 * Fetch non-canon related entries (OVAs, specials, side-story films)
 * for a series — these go in the extras section at the bottom.
 * We use the relations endpoint and filter out the known canon entries.
 */
export async function fetchExtras(primaryMalId, canonMalIds = []) {
  const data = await jikan(`/anime/${primaryMalId}/relations`);
  const extras = [];

  for (const group of (data.data || [])) {
    const rel = group.relation;
    // Skip adaptations (manga), only keep anime-type entries
    for (const entry of (group.entry || [])) {
      if (entry.type !== 'anime') continue;
      if (canonMalIds.includes(entry.mal_id)) continue;
      // Only include side-stories, OVAs, specials, summaries
      if (['Side Story','Summary','Other','Spin-off'].includes(rel)) {
        await new Promise(r => setTimeout(r, 350));
        try {
          const detail = await jikan(`/anime/${entry.mal_id}`);
          const a = detail.data;
          if (['OVA','Special','Movie','ONA'].includes(a.type)) {
            extras.push({
              malId: a.mal_id,
              title: a.title_english || a.title,
              type:  a.type,
              episodes: a.episodes,
              aired: a.aired?.string || 'TBA',
              score: a.score,
              url:   a.url,
              relation: rel,
            });
          }
        } catch { /* skip silently */ }
      }
    }
  }
  return extras;
}
