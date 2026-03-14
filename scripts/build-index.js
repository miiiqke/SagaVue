/**
 * scripts/build-index.js
 *
 * Regenerates data/index.json from all series JSON files in data/.
 * Runs automatically on every Cloudflare deploy via "npm run build".
 * Also fetches MAL scores so the Rating sort works without API calls at runtime.
 *
 * Run locally after adding or updating any series:
 *   node scripts/build-index.js
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

async function fetchScore(malId) {
  if (!malId) return null;
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.score ?? null;
  } catch {
    return null;
  }
}

const files = readdirSync(dataDir)
  .filter(f => f.endsWith('.json') && !f.includes('template') && f !== 'index.json')
  .sort();

const index = [];

for (const file of files) {
  const raw = readFileSync(join(dataDir, file), 'utf8');
  const d = JSON.parse(raw);

  const totalEpisodes = (d.meta?.seasons || []).reduce((s, x) => s + x.eps, 0);
  const totalChapters = d.meta?.totalChapters || 0;

  const adapted = new Set();
  for (const ep of (d.episodes || [])) {
    for (const ch of (ep.chapters || [])) {
      if (typeof ch === 'number') adapted.add(ch);
    }
  }
  const adaptedPct = totalChapters > 0
    ? Math.round(adapted.size / totalChapters * 100)
    : 0;

  const malId = d.malIds?.primary || null;

  console.log(`Fetching score for ${d.id} (MAL ${malId})...`);
  const score = await fetchScore(malId);
  // Jikan rate limit: ~3 req/s
  await new Promise(r => setTimeout(r, 350));

  index.push({
    id: d.id,
    title: d.title,
    abbr: d.abbr || [],
    tags: d.tags || [],
    totalEpisodes,
    totalChapters,
    adaptedPct,
    animeStatus: d.animeStatus,
    mangaStatus: d.mangaStatus,
    malId,
    score: score,
  });

  console.log(`  ${d.title}: score=${score}`);
}

const outPath = join(dataDir, 'index.json');
writeFileSync(outPath, JSON.stringify(index, null, 2) + '\n');
console.log(`\nWritten ${index.length} entries to data/index.json`);
