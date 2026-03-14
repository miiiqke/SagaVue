# Search

How SagaVue's search works. Useful for debugging unexpected results or extending search behavior.

---

## Overview

Search runs entirely client-side against in-memory data loaded at startup. No index server, no external service.

- Results appear as you type (150ms debounce)
- Understands multi-token queries like `aot s2e5` or `hxh ch200`
- Fuzzy matching handles typos and partial names
- Results capped at 30, interleaved across series so one series doesn't dominate

---

## Query syntax

### Context keywords

These words set the type for numbers that follow them:

| Input | What it means |
|-------|--------------|
| `episode 5`, `ep5`, `e5` | Episode number 5 |
| `season 2`, `s2` | Season 2 filter |
| `part 2` | Part 2 filter |
| `chapter 200`, `ch200`, `c200` | Chapter 200 |

Compact forms (`e5`, `ep5`, `s2`, `ch200`, `c200`) work the same as the spaced versions. You can combine them freely: `aot s2e5`, `jjk ep12`, `hxh c200`.

### Number assignment

Numbers bind to the keyword immediately before them. `s2 ep5` gives season=2, episode=5. A bare number with no keyword is treated as both an episode and chapter search simultaneously.

### Series detection

Non-keyword tokens are scored against every series title and abbreviation. If a token scores 60+ against a series, it becomes a series filter rather than a text search. That's why `aot 12` finds AoT episode 12 rather than trying to match "aot" against titles.

---

## Fuzzy scoring

`fuzzyScore(target, query)` returns 0-100:

| Score | Match type |
|-------|-----------|
| 100 | Exact match |
| 85 | Substring (target contains query) |
| 75 | First word of target starts with first word of query |
| up to 70 | Character subsequence, with bonuses for consecutive characters |
| 0 | Not all query characters found in order |

Thresholds: series match at 60, episode/arc title match at 50.

---

## Result priority

| Priority | Type | How matched |
|----------|------|-------------|
| 1 | Series | Name/abbr match, no episode/chapter context |
| 2 | Episode / Season | Episode number or title |
| 3 | Chapter | Chapter number |
| 4 | Arc | Arc name fuzzy match |

Within each group, results from different series are interleaved in rotation.

---

## Season-episode resolution

When a season filter is combined with an episode number (e.g. `aot s2e5`), the search uses `seasonMap` from meta to resolve the season-scoped number to the overall episode. If not found in `seasonMap`, it falls back to matching by overall episode number.

---

## Keyboard shortcuts

- `Cmd/Ctrl + K` — focus the search input
- `Escape` — close results and blur input

---

## Extending search

To make a new data field searchable, add logic to the inner loop in `run()` inside `search.js`. Follow the existing pattern: check the parsed query context, iterate the data, score with `fuzzyScore()`, and push results with a `priority` and `score`. Keep it fast — `run()` should stay under 10ms for typical dataset sizes.
