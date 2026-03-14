/**
 * scripts/build-index.js
 *
 * Regenerates data/index.json from all series JSON files in data/.
 * Run this after adding or updating any series file:
 *
 *   node scripts/build-index.js
 *
 * index.json is the only file loaded on the home screen. It contains just
 * the fields needed to render the cards — no episode or chapter arrays.
 * This keeps the home screen fast regardless of how many series exist.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

const files = readdirSync(dataDir)
  .filter(f => f.endsWith('.json') && !f.includes('template') && f !== 'index.json')
  .sort();

const index = [];

for (const file of files) {
  const raw = readFileSync(join(dataDir, file), 'utf8');
  const d = JSON.parse(raw);

  const totalEpisodes = (d.meta?.seasons || []).reduce((s, x) => s + x.eps, 0);
  const totalChapters = d.meta?.totalChapters || 0;

  // Count adapted chapters the same way data.js does
  const adapted = new Set();
  for (const ep of (d.episodes || [])) {
    for (const ch of (ep.chapters || [])) {
      if (typeof ch === 'number') adapted.add(ch);
    }
  }
  const adaptedPct = totalChapters > 0
    ? Math.round(adapted.size / totalChapters * 100)
    : 0;

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
    malId: d.malIds?.primary || null,
  });
}

const outPath = join(dataDir, 'index.json');
writeFileSync(outPath, JSON.stringify(index, null, 2) + '\n');
console.log(`Written ${index.length} entries to data/index.json`);
