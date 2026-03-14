/**
 * search.js — multi-token fuzzy search with debounce
 */

let _all = [];
let _onResult = null;
let _searchTimeout = null;

// Debounce helper
function debounce(fn, ms) {
  return function(...args) {
    clearTimeout(_searchTimeout);
    _searchTimeout = setTimeout(() => fn(...args), ms);
  };
}

// Damerau-Levenshtein edit distance.
// Counts insertions, deletions, substitutions, and adjacent transpositions
// (e.g. breserk -> berserk is 1 transposition, not 2 substitutions).
function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost);
      if (i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i-2][j-2] + cost);
      }
    }
  }
  return dp[m][n];
}

// Returns a score 0-100 for how well query matches target.
// Handles exact matches, substrings, typos, transpositions and subsequences.
function fuzzyScore(target, query) {
  if (!query) return 0;
  const t = target.toLowerCase();
  const q = query.toLowerCase();

  // Exact match
  if (t === q) return 100;

  // Substring match
  if (t.includes(q)) return 85;

  // Word-start match
  if (t.split(/[\s-]/)[0].startsWith(q.split(/[\s-]/)[0])) return 75;

  // Typo tolerance — check query against the full target and each individual word.
  // Allow 1 edit for short queries (<=4 chars), 2 edits for longer ones.
  const tWords = t.replace(/-/g, ' ').split(/\s+/);
  let best = 0;
  for (const word of [t, ...tWords]) {
    if (word.length < 3) continue;
    const maxEdits = q.length <= 4 ? 1 : 2;
    if (Math.abs(word.length - q.length) > maxEdits) continue;
    const dist = editDistance(q, word);
    if (dist <= maxEdits) {
      const score = dist === 0 ? 80 : dist === 1 ? 65 : 55;
      best = Math.max(best, score);
    }
  }
  if (best > 0) return best;

  // Character subsequence fallback — all query chars present in target in order
  let qIdx = 0, lastMatchIdx = -1, score = 0;
  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      score += (i === lastMatchIdx + 1) ? 12 : 8;
      lastMatchIdx = i;
      qIdx++;
    }
  }
  return qIdx === q.length ? Math.min(score, 50) : 0;
}

// Parse search query with context-aware number extraction
// Numbers are associated with the keyword that precedes them
function parseQuery(q, allSeries) {
  const tokens = q.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
  const parsed = {
    episodeNumbers: [],
    seasonNumbers: [],
    partNumbers: [],
    chapterNumbers: [],
    textTokens: [],
    seriesFilter: null,
    searchForEpisode: false,
    searchForSeason: false,
    searchForChapter: false,
  };
  
  // Detect search context keywords anywhere in query
  parsed.searchForEpisode = tokens.some(t => t === 'episode' || t === 'ep' || t === 'e' || /^e\d+$/.test(t) || /^ep\d+$/.test(t));
  parsed.searchForSeason = tokens.some(t => t === 'season' || t === 's' || t === 'part' || /^s\d+$/.test(t));
  parsed.searchForChapter = tokens.some(t => t === 'chapter' || t === 'ch' || t === 'c' || /^c\d+$/.test(t) || /^ch\d+$/.test(t));
  
  // Parse tokens in order, associating numbers with their context keywords
  let lastKeywordType = null;
  let foundSeries = null;
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    // Check for keywords and update context
    // Handles: "episode", "ep", "e", and compact forms "e3" / "ep3"
    if (token === 'episode' || token === 'ep' || token === 'e') {
      lastKeywordType = 'episode';
      continue;
    }
    if (/^e(\d+)$/.test(token) || /^ep(\d+)$/.test(token)) {
      parsed.episodeNumbers.push(parseInt(token.match(/\d+$/)[0], 10));
      parsed.searchForEpisode = true;
      lastKeywordType = null;
      continue;
    }
    if (token === 'season' || token === 's' || /^s\d+$/.test(token)) {
      // Extract number from s\d+ format if present
      if (/^s(\d+)$/.test(token)) {
        parsed.seasonNumbers.push(parseInt(token.match(/\d+$/)[0], 10));
      }
      lastKeywordType = 'season';
      continue;
    }
    if (token === 'part') {
      lastKeywordType = 'part';
      continue;
    }
    // Handles: "chapter", "ch", "c", and compact forms "c3" / "ch3"
    if (token === 'chapter' || token === 'ch' || token === 'c') {
      lastKeywordType = 'chapter';
      continue;
    }
    if (/^c(\d+)$/.test(token) || /^ch(\d+)$/.test(token)) {
      parsed.chapterNumbers.push(parseInt(token.match(/\d+$/)[0], 10));
      parsed.searchForChapter = true;
      lastKeywordType = null;
      continue;
    }
    
    // Handle numbers - associate with last keyword context
    if (/^\d+$/.test(token)) {
      const num = parseInt(token, 10);
      if (lastKeywordType === 'episode') {
        parsed.episodeNumbers.push(num);
      } else if (lastKeywordType === 'season') {
        parsed.seasonNumbers.push(num);
      } else if (lastKeywordType === 'part') {
        parsed.partNumbers.push(num);
      } else if (lastKeywordType === 'chapter') {
        parsed.chapterNumbers.push(num);
      } else {
        // No context - treat as generic number
        // Could be episode, season, or chapter depending on search context
        if (parsed.searchForEpisode) {
          parsed.episodeNumbers.push(num);
        } else if (parsed.searchForSeason) {
          parsed.seasonNumbers.push(num);
        } else if (parsed.searchForChapter) {
          parsed.chapterNumbers.push(num);
        } else {
          // No specific context - will be used for all types in search
          parsed.episodeNumbers.push(num);
          parsed.chapterNumbers.push(num);
        }
      }
      lastKeywordType = null; // Reset after consuming number
    } else {
      // Check if this token matches any series name/abbr
      const titleScore = fuzzyScore(allSeries.reduce((s, series) => {
        const ts = fuzzyScore(series.meta.title, token);
        return ts > fuzzyScore(s.meta?.title || '', token) ? series : s;
      }, {}).meta?.title || '', token);
      
      for (const series of allSeries) {
        const ts = fuzzyScore(series.meta.title, token);
        const as = series.meta.abbr ? Math.max(...series.meta.abbr.map(a => fuzzyScore(a, token))) : 0;
        const score = Math.max(ts, as);
        
        if (score >= 55) {
          foundSeries = series.id;
          break;
        }
      }
      
      if (!foundSeries) {
        parsed.textTokens.push(token);
      }
      lastKeywordType = null;
    }
  }
  
  parsed.seriesFilter = foundSeries;
  return parsed;
}

// Check if token matches series name or abbreviation
function seriesMatches(series, tokenList) {
  if (!tokenList.length) return true;
  
  const m = series.meta;
  for (const token of tokenList) {
    const titleScore = fuzzyScore(m.title, token);
    const abbrScore = m.abbr ? Math.max(...m.abbr.map(a => fuzzyScore(a, token))) : 0;
    if (titleScore > 40 || abbrScore > 40) return true;
  }
  return false;
}

export function initSearch(allSeries, onResult, inputId = 'search-input', resultsId = 'search-results') {
  _all = allSeries;
  _onResult = onResult;

  const input = document.getElementById(inputId);

  // Debounced search handler
  const debouncedSearch = debounce(() => {
    const q = input.value.trim();
    q ? show(run(q), q, resultsId) : close(resultsId);
  }, 150); // 150ms debounce

  input.addEventListener('input', debouncedSearch);
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(resultsId); input.blur(); }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-container') && !e.target.closest('.nav-search')) close(resultsId);
  });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault(); input.focus(); input.select();
    }
  });
}

function close(resultsId = 'search-results') {
  const el = document.getElementById(resultsId);
  el.classList.remove('open');
  el.innerHTML = '';
}

function run(q) {
  const parsed = parseQuery(q, _all);
  const results = [];
  const seen = new Set();

  // Determine search context: keywords take priority
  const searchOnlyEpisodes = parsed.searchForEpisode;
  const searchOnlySeasons = parsed.searchForSeason && !parsed.searchForEpisode;
  const searchOnlyChapters = parsed.searchForChapter && !parsed.searchForEpisode && !parsed.searchForSeason;
  
  const searchAll = !parsed.searchForEpisode && !parsed.searchForSeason && !parsed.searchForChapter;

  // Determine which series to search
  const seriesToSearch = parsed.seriesFilter 
    ? _all.filter(s => s.id === parsed.seriesFilter)
    : _all;

  for (const series of seriesToSearch) {
    const m = series.meta;
    
    // Series result (if series was matched by name/abbr and no specific content search)
    if (parsed.seriesFilter === series.id && searchAll && 
        !parsed.episodeNumbers.length && !parsed.seasonNumbers.length && 
        !parsed.chapterNumbers.length && !parsed.textTokens.length) {
      const key = `series-${series.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          type: 'series',
          label: m.title,
          meta: `${m.totalEpisodes} ep · ${m.totalChapters} ch`,
          sid: series.id,
          aid: '',
          tab: '',
          score: 100,
          priority: 1,
        });
      }
    }

    // ─ Episodes ───────────────────────────────────────────────
    // Search episodes if: searchOnlyEpisodes OR (searchAll with episode-related filters)
    if (searchOnlyEpisodes || (searchAll && (parsed.episodeNumbers.length > 0 || parsed.textTokens.length > 0))) {
      // Build season filter map if season numbers specified
      let seasonFilter = new Set();
      if (parsed.seasonNumbers.length > 0 || parsed.partNumbers.length > 0) {
        // Find which seasons match the seasonNumbers and/or partNumbers
        const seasonMap = m.seasonMap || [];
        // Get unique season names from seasonMap
        const uniqueSeasons = new Set();
        for (const seasonEntry of seasonMap) {
          uniqueSeasons.add(seasonEntry.season);
        }
        // Match against parsed season and part numbers
        for (const seasonName of uniqueSeasons) {
          const seasonNumMatch = seasonName.match(/Season\s+(\d+)/i);
          const partNumMatch = seasonName.match(/Part\s+(\d+)/i);
          
          if (seasonNumMatch) {
            const extractedSeasonNum = parseInt(seasonNumMatch[1], 10);
            const extractedPartNum = partNumMatch ? parseInt(partNumMatch[1], 10) : null;
            
            // Match logic:
            // 1. If seasonNumbers specified, season must match one
            // 2. If partNumbers specified, MUST have a part and it must match one
            // 3. If neither specified, match all
            const seasonMatches = parsed.seasonNumbers.length === 0 || parsed.seasonNumbers.includes(extractedSeasonNum);
            
            // If part numbers are specified, we require a part to exist AND match
            const partMatches = 
              parsed.partNumbers.length === 0 
                ? true  // If no part specified, any part (or no part) is fine
                : (extractedPartNum !== null && parsed.partNumbers.includes(extractedPartNum));  // If part specified, MUST exist and match
            
            if (seasonMatches && partMatches) {
              seasonFilter.add(seasonName);
            }
          }
        }
      }

      for (const ep of series.episodes) {
        let shouldInclude = false;
        let seasonName = null;
        let seasonEpNum = null;
        
        // If episode numbers specified, match against season-episode number
        if (parsed.episodeNumbers.length > 0) {
          // Find this episode's season-episode number via seasonMap
          const seasonMap = m.seasonMap || [];
          let foundInSeasonMap = false;
          
          for (const seasonEntry of seasonMap) {
            if (seasonEntry.overallEp === ep.ep) {
              // This episode is part of this season
              seasonEpNum = seasonEntry.seasonEp;
              seasonName = seasonEntry.season;
              
              // Check if it matches one of the requested episode numbers
              if (parsed.episodeNumbers.includes(seasonEpNum)) {
                // If season/part filters exist, validate them strictly
                if (parsed.seasonNumbers.length > 0 || parsed.partNumbers.length > 0) {
                  // Extract season and part numbers from seasonName
                  const seasonNumMatch = seasonName.match(/Season\s+(\d+)/i);
                  const partNumMatch = seasonName.match(/Part\s+(\d+)/i);
                  
                  if (seasonNumMatch) {
                    const seasonNum = parseInt(seasonNumMatch[1], 10);
                    const partNum = partNumMatch ? parseInt(partNumMatch[1], 10) : null;
                    
                    // Must match specified season numbers
                    const seasonOk = parsed.seasonNumbers.length === 0 || parsed.seasonNumbers.includes(seasonNum);
                    // If part specified, MUST exist and match
                    const partOk = parsed.partNumbers.length === 0 
                      ? true 
                      : (partNum !== null && parsed.partNumbers.includes(partNum));
                    
                    if (seasonOk && partOk) {
                      shouldInclude = true;
                    }
                  }
                } else {
                  // No season/part filter, just include the episode
                  shouldInclude = true;
                }
              }
              foundInSeasonMap = true;
              break;
            }
          }
          
          // Fallback: if episode not in seasonMap, match by overall episode number (only if no season/part filter)
          if (!foundInSeasonMap && parsed.episodeNumbers.includes(ep.ep) && parsed.seasonNumbers.length === 0 && parsed.partNumbers.length === 0) {
            shouldInclude = true;
          }
        }
        
        // Only match by title if we don't have explicit episode number filters
        if (!shouldInclude && parsed.textTokens.length > 0 && parsed.episodeNumbers.length === 0) {
          for (const token of parsed.textTokens) {
            const titleScore = fuzzyScore(ep.title, token);
            if (titleScore > 50) {
              shouldInclude = true;
              break;
            }
          }
        }
        
        if (shouldInclude) {
          const key = `ep-${series.id}-${ep.ep}`;
          if (!seen.has(key)) {
            seen.add(key);
            const scoreBase = parsed.textTokens.length > 0 ? 40 : 95;
            
            // Build abbreviated context like "S02P01E01" or "S02E01"
            let contextStr = '';
            if (seasonName && seasonEpNum) {
              const seasonNumMatch = seasonName.match(/Season\s+(\d+)/i);
              const partNumMatch = seasonName.match(/Part\s+(\d+)/i);
              // Fallback: derive season number from position in the unique ordered season list
              let seasonNum;
              if (seasonNumMatch) {
                seasonNum = parseInt(seasonNumMatch[1], 10);
              } else {
                const uniqueSeasons = [];
                for (const entry of (m.seasonMap || [])) {
                  if (!uniqueSeasons.includes(entry.season)) uniqueSeasons.push(entry.season);
                }
                seasonNum = uniqueSeasons.indexOf(seasonName) + 1;
                if (seasonNum < 1) seasonNum = 1;
              }
              const sPad = String(seasonNum).padStart(2, '0');
              const pPad = partNumMatch ? String(partNumMatch[1]).padStart(2, '0') : null;
              const ePad = String(seasonEpNum).padStart(2, '0');
              contextStr = pPad 
                ? ` <span class="r-ctx">S${sPad}P${pPad}E${ePad}</span>`
                : ` <span class="r-ctx">S${sPad}E${ePad}</span>`;
            }
            
            results.push({
              type: 'episode',
              label: `Episode ${ep.ep}: ${ep.title}${contextStr}`,
              meta: m.title,
              sid: series.id,
              aid: `epr-${ep.ep}`,
              tab: 'ep',
              score: scoreBase + (parsed.seriesFilter ? 5 : 0),
              priority: 2,
            });
          }
        }
      }
    }

    // ─ Chapters ─────────────────────────────────────────────
    // Search chapters if: searchOnlyChapters OR (searchAll with chapter numbers)
    if ((searchOnlyChapters || searchAll) && parsed.chapterNumbers.length > 0) {
      for (const chNum of parsed.chapterNumbers) {
        const ch = series.chapters.find(c => c.n === chNum);
        if (ch) {
          const key = `ch-${series.id}-${chNum}`;
          if (!seen.has(key)) {
            seen.add(key);
            // Include manga chapter title in label when available
            const chLabel = ch.title ? `Chapter ${chNum}: ${ch.title}` : `Chapter ${chNum}`;
            results.push({
              type: 'chapter',
              label: chLabel,
              meta: `${m.title} · ${ch.adapted ? 'Adapted' : 'Unadapted'}`,
              sid: series.id,
              aid: `chr-${chNum}`,
              tab: 'ch',
              score: 90 + (parsed.seriesFilter ? 5 : 0),
              priority: 3,
            });
          }
        }
      }
    }

    // ─ Chapter title text search ─────────────────────────────
    // Match text tokens against manga chapter titles (when defined)
    if ((searchOnlyChapters || searchAll) && parsed.textTokens.length > 0 && series.meta.hasChapterTitles) {
      for (const ch of series.chapters) {
        if (!ch.title) continue;
        for (const token of parsed.textTokens) {
          const titleScore = fuzzyScore(ch.title, token);
          if (titleScore > 50) {
            const key = `ch-${series.id}-${ch.n}`;
            if (!seen.has(key)) {
              seen.add(key);
              results.push({
                type: 'chapter',
                label: `Chapter ${ch.n}: ${ch.title}`,
                meta: `${m.title} · ${ch.adapted ? 'Adapted' : 'Unadapted'}`,
                sid: series.id,
                aid: `chr-${ch.n}`,
                tab: 'ch',
                score: titleScore + 20 + (parsed.seriesFilter ? 5 : 0),
                priority: 3,
              });
            }
            break; // Only add once per chapter even if multiple tokens match
          }
        }
      }
    }

    // ─ Arcs ──────────────────────────────────────────────────
    // Search arcs if: searchAll with text tokens (no specific context)
    if (searchAll && parsed.textTokens.length > 0 && 
        !searchOnlyEpisodes && !searchOnlySeasons && !searchOnlyChapters) {
      for (const arc of series.arcs) {
        for (const token of parsed.textTokens) {
          const arcScore = fuzzyScore(arc.name, token);
          if (arcScore > 50) {
            const key = `arc-${series.id}-${arc.id}`;
            if (!seen.has(key)) {
              seen.add(key);
              const type = arc.type === 'movie' ? 'movie' : arc.type === 'special' ? 'ova' : 'arc';
              results.push({
                type,
                label: arc.name,
                meta: m.title,
                sid: series.id,
                aid: `arc-${arc.id}`,
                tab: '',
                score: arcScore + 30,
                priority: 4,
              });
              break;
            }
          }
        }
      }
    }

    // ─ Seasons ───────────────────────────────────────────────
    // Search seasons if: searchOnlySeasons
    if (searchOnlySeasons) {
      const seasonMap = m.seasonMap || [];
      
      // Group episodes by season
      const seasonData = {};
      for (const season of seasonMap) {
        if (!seasonData[season.season]) {
          seasonData[season.season] = [];
        }
        seasonData[season.season].push(season);
      }
      
      // Generate results for each season
      for (const seasonName in seasonData) {
        let scoreMultiplier = 0;
        
        // Check if season number matches parsed seasonNumbers and part number matches parsed partNumbers
        const seasonNumMatch = seasonName.match(/Season\s+(\d+)/i);
        const partNumMatch = seasonName.match(/Part\s+(\d+)/i);
        
        if (parsed.seasonNumbers.length > 0 || parsed.partNumbers.length > 0) {
          if (seasonNumMatch) {
            const extractedSeasonNum = parseInt(seasonNumMatch[1], 10);
            const extractedPartNum = partNumMatch ? parseInt(partNumMatch[1], 10) : null;
            
            // Match logic:
            // 1. If seasonNumbers specified, season must match one
            // 2. If partNumbers specified, MUST have a part and it must match one
            const seasonMatches = parsed.seasonNumbers.length === 0 || parsed.seasonNumbers.includes(extractedSeasonNum);
            const partMatches = 
              parsed.partNumbers.length === 0 
                ? true  // If no part specified, any part (or no part) is fine
                : (extractedPartNum !== null && parsed.partNumbers.includes(extractedPartNum));  // If part specified, MUST exist and match
            
            if (seasonMatches && partMatches) {
              scoreMultiplier = 85;
            }
          }
        }
        
        // Check if season name matches text tokens (for fuzzy "part" searches and full text)
        if (scoreMultiplier === 0 && parsed.textTokens.length > 0) {
          for (const token of parsed.textTokens) {
            const nameScore = fuzzyScore(seasonName, token);
            if (nameScore > 40) {
              scoreMultiplier = Math.max(scoreMultiplier, nameScore);
            }
          }
        }
        
        // Include season if no filters specified (generic season search)
        if (scoreMultiplier === 0 && parsed.seasonNumbers.length === 0 && parsed.partNumbers.length === 0 && parsed.textTokens.length === 0) {
          scoreMultiplier = 50;
        }
        
        if (scoreMultiplier > 0) {
          const key = `season-${series.id}-${seasonName}`;
          if (!seen.has(key)) {
            seen.add(key);
            const eps = seasonData[seasonName].length;
            results.push({
              type: 'season',
              label: seasonName,
              meta: `${m.title} · ${eps} episodes`,
              sid: series.id,
              aid: `sv-${seasonName}-1`,
              tab: 'sv',
              score: scoreMultiplier + (parsed.seriesFilter ? 10 : 0),
              priority: 2,
            });
          }
        }
      }
    }
  }

  // Sort by priority, score, and interleave by series to avoid stacking
  // Group by priority level first
  const byPriority = {};
  for (const result of results) {
    if (!byPriority[result.priority]) byPriority[result.priority] = [];
    byPriority[result.priority].push(result);
  }
  
  const sorted = [];
  
  // For each priority level
  for (const priority of Object.keys(byPriority).sort((a, b) => Number(a) - Number(b))) {
    const priorityGroup = byPriority[priority];
    
    // Group by score within this priority
    const byScore = {};
    for (const result of priorityGroup) {
      const score = result.score || 0;
      if (!byScore[score]) byScore[score] = [];
      byScore[score].push(result);
    }
    
    // For each score level, interleave results from different series
    for (const scoreKey of Object.keys(byScore).sort((a, b) => Number(b) - Number(a))) {
      const scoreGroup = byScore[scoreKey];
      
      // Group by series within this score level
      const bySeries = {};
      for (const result of scoreGroup) {
        if (!bySeries[result.sid]) bySeries[result.sid] = [];
        bySeries[result.sid].push(result);
      }
      
      // Interleave: take one result from each series in rotation
      const seriesIds = Object.keys(bySeries);
      let index = 0;
      let stillAdding = true;
      
      while (stillAdding) {
        stillAdding = false;
        for (const sid of seriesIds) {
          if (bySeries[sid][index]) {
            sorted.push(bySeries[sid][index]);
            stillAdding = true;
          }
        }
        index++;
      }
    }
  }
  
  return sorted.slice(0, 30); // Limit to 30 results
}

function show(results, q, resultsId = 'search-results') {
  const el = document.getElementById(resultsId);
  
  if (!results.length) {
    el.innerHTML = `<div class="no-res">No results for "<em>${q}</em>"</div>`;
    el.classList.add('open');
    return;
  }

  el.innerHTML = results.map(r => {
    // Build highlighted label without corrupting HTML
    // Extract the main label text (without r-ctx spans)
    const labelText = r.label.replace(/<span class="r-ctx">.*?<\/span>/g, '');
    const contextMatch = r.label.match(/<span class="r-ctx">.*?<\/span>/);
    const contextHtml = contextMatch ? contextMatch[0] : '';
    
    // 1. Collect all positions to highlight first (working with original text)
    // 2. Remove overlaps
    // 3. Build final string in one pass
    let hl = labelText;
    const tokens = q.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    
    // Sort tokens by length (longest first)
    tokens.sort((a, b) => b.length - a.length);
    
    // Collect all positions to highlight
    const highlights = [];
    for (const token of tokens) {
      const regex = new RegExp(
        `(${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
        'gi'
      );
      let match;
      while ((match = regex.exec(hl)) !== null) {
        highlights.push({ start: match.index, end: match.index + match[0].length });
      }
    }
    
    // Remove overlapping highlights - keep non-overlapping ranges
    highlights.sort((a, b) => a.start - b.start);
    const unique = [];
    for (const h of highlights) {
      if (!unique.some(u => u.start <= h.start && h.end <= u.end)) {
        unique.push(h);
      }
    }
    
    // Build highlighted string in one pass
    let result = '';
    let lastEnd = 0;
    for (const { start, end } of unique) {
      result += hl.substring(lastEnd, start);
      result += `<span class="r-hl">${hl.substring(start, end)}</span>`;
      lastEnd = end;
    }
    result += hl.substring(lastEnd);
    result += contextHtml;

    return `<div class="r-item" data-sid="${r.sid}" data-aid="${r.aid}" data-tab="${r.tab}">
      <span class="r-badge rb-${r.type}">${r.type}</span>
      <span class="r-main">${result}</span>
      <span class="r-meta">${r.meta}</span>
    </div>`.replace(/data-sid(?=["\'])/g, 'data-sid'); // Normalize
  }).join('');

  el.querySelectorAll('.r-item').forEach(item => {
    item.addEventListener('click', () => {
      close(resultsId);
      // Clear both inputs
      document.getElementById('search-input').value = '';
      document.getElementById('nav-search-input').value = '';
      _onResult(item.dataset.sid, item.dataset.aid || null, item.dataset.tab || null);
    });
  });

  el.classList.add('open');
}
