// status.js — logic for determining series status (anime + manga)
// Uses JSON configuration for anime/manga status

/**
 * Compute the logical status of a series based on JSON config anime/manga state and adaptation coverage.
 * Returns an object with status and optional note:
 * - { status: 'Complete', note: null }
 * - { status: 'Finished', note: 'not fully adapted' }
 * - { status: 'Ongoing', note: null }
 * - { status: 'Hiatus', note: null }
 */
export function computeSeriesStatus({ meta, config }) {
  // Extract status from config
  const animeStatus = config?.animeStatus || null;
  const mangaStatus = config?.mangaStatus || null;
  const allAdapted = meta.adaptedPct === 100;

  // Normalize status strings
  const normalizeStatus = (s) => {
    if (!s) return null;
    if (s.includes('Incomplete')) return 'Incomplete';
    if (s.includes('Ongoing')) return 'Ongoing';
    if (s.includes('Finished')) return 'Finished';
    if (s === 'Upcoming') return 'Ongoing';
    if (s.includes('Hiatus')) return 'Hiatus';
    return s;
  };

  const normalizedAnimeStatus = normalizeStatus(animeStatus);
  const normalizedMangaStatus = normalizeStatus(mangaStatus);

  // Anime stopped/incomplete and there is still unadapted manga content
  if (normalizedAnimeStatus === 'Incomplete' && !allAdapted) {
    return { status: 'Incomplete', note: null };
  }
  // Determine final status based on adaptation and source material state
  if (allAdapted && normalizedAnimeStatus === 'Finished' && normalizedMangaStatus === 'Finished') {
    return { status: 'Complete', note: null };
  }
  if (normalizedAnimeStatus === 'Finished' && normalizedMangaStatus && normalizedMangaStatus !== 'Finished') {
    return { status: 'Finished', note: 'not fully adapted' };
  }
  if (normalizedAnimeStatus === 'Ongoing' || normalizedMangaStatus === 'Ongoing') {
    return { status: 'Ongoing', note: null };
  }
  if (normalizedAnimeStatus === 'Hiatus' || normalizedMangaStatus === 'Hiatus') {
    return { status: 'Hiatus', note: null };
  }
  // If both finished but not fully adapted
  if (normalizedAnimeStatus === 'Finished' && normalizedMangaStatus === 'Finished' && !allAdapted) {
    return { status: 'Finished', note: 'not fully adapted' };
  }
  // Fallback
  return { status: normalizedAnimeStatus || normalizedMangaStatus || 'Unknown', note: null };
}

/**
 * Get anime and manga status separately
 */
export function getStatusPills(config) {
  const animeStatus = config?.animeStatus || 'Unknown';
  const mangaStatus = config?.mangaStatus || 'Unknown';
  return { animeStatus, mangaStatus };
}
