# Data Structure

How SagaVue stores series data and processes it at runtime.

---

## File layout

All series data lives in `data/` as individual JSON files, one per series. Files are auto-discovered, any `.json` file in `data/` (except `new_series_template.json`) is loaded at startup with no registry to update.

```
data/
  aot.json
  berserk.json
  demon_slayer.json
  fmab.json
  frieren.json
  hxh.json
  jjk.json
  vinland_saga.json
  new_series_template.json
```

**Auto-discovery:** `data.js` fetches `data/`, parses the directory listing for filenames, and loads each one.

---

## Top-level fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | ✅ | string | Lowercase slug, no spaces. Used in the URL: `/series/my_series`. Must be unique. |
| `title` | ✅ | string | Full official display title. |
| `abbr` | ✅ | string[] | Search aliases — abbreviations, alternate romanisations, fan names. |
| `source` | ✅ | string | Origin medium: `"Manga"`, `"Light Novel"`, `"Manhwa"`, `"Original"`, etc. |
| `animeStatus` | ✅ | string | `"Finished"` · `"Ongoing"` · `"Incomplete"` (anime stopped before source ended) |
| `mangaStatus` | ✅ | string | `"Finished"` · `"Ongoing"` · `"Hiatus"` |
| `lastUpdated` | when Ongoing | string | ISO date `YYYY-MM-DD`. Required when `animeStatus` is `"Ongoing"`. Shows a "Data updated" notice. |
| `tags` | ✅ | string[] | Genre/demographic tags. 2 shown on the home card, all on the series header. 2–5 ideal. |
| `malIds` | ✅ | object | MAL IDs for the info panel, season chips, and related media filtering. |
| `watchGuide` | optional | array | Step-by-step watch/read order. Only for series with non-obvious paths. |
| `meta` | ✅ | object | Chapter count, season groupings, contributor notes. |
| `arcs` | ✅ | array | Story arc definitions. |
| `episodes` | ✅ | array | Episode entries — regular TV episodes and canon films. |
| `chapterTitles` | optional | object | Maps chapter numbers to official manga titles. |
| `prequelChapters` | optional | array | Prequel chapters with fractional numbers (e.g. `0.1`, `0.2`). |

---

## `malIds`

```json
"malIds": {
  "primary": 16498,
  "manga": 23390,
  "canonIds": [16498, 25777, 35760, 99999],
  "seasons": [
    { "name": "Season 1", "malId": 16498, "eps": 25 },
    { "name": "Season 2", "malId": 25777, "eps": 12 },
    { "name": "Canon Film (2024)", "malId": 99999, "eps": 1, "type": "movie" }
  ],
  "alternativeSeries": [
    {
      "name": "Earlier Adaptation (2001)",
      "malId": 121,
      "eps": 51,
      "type": "tv",
      "note": "Adapts the opening arcs then diverges. Worth watching after the main series."
    }
  ]
}
```

| Field | Notes |
|-------|-------|
| `primary` | MAL anime ID for the main series. Used to fetch score, rank, members, synopsis, cover art. |
| `manga` | MAL manga ID. `fetchBestInfo()` compares member counts — whichever is higher is shown in the stats panel (Berserk is the canonical example where manga wins). |
| `canonIds` | All canonical MAL IDs. The Extras section auto-fetches related media and **excludes** these — only OVAs, spinoffs, and non-canon films appear there. |
| `seasons` | Chips in **Seasons & Parts** (section 01). Include both TV seasons and canon films here. Film chips scroll to the arc entry in the episode list; TV chips link to MAL. Add `"type": "movie"` to render a `Film` badge and distinct dot colour on the chip. |
| `alternativeSeries` | Earlier adaptations or parallel canon series covering the same source. Only `"tv"` and `"movie"` entries appear in section 01 — `"ova"` and `"special"` are excluded (they surface in the Extras section). Each entry: `name`, `malId`, `eps`, `type`, `note` (shown as tooltip on hover). |

> **`malIds.seasons` vs `meta.seasons`:** `malIds.seasons` drives the section 01 chips and can include films. `meta.seasons` drives the Season Map tab and the total episode count — TV only, must match `episodes[]` exactly.

---

## `watchGuide`

Rendered as the collapsible **"How to Watch & Read"** section (section 02). Add only when the path is non-obvious: multiple adaptations covering the same material, mandatory manga gaps, or a community debate about watch order.

The section is collapsed by default, shows a step count + gap count badge, and expands on click. Series without a `watchGuide` field simply don't show the section.

### Step types

**`"anime"`** — a single series to watch:
```json
{ "step": 1, "type": "anime", "title": "Berserk (1997)", "subtitle": "25 episodes", "covers": "Ch 1–94", "malId": 33 }
```

**`"movie-set"`** — a film or film series:
```json
{ "step": 1, "type": "movie-set", "title": "Golden Age Arc Film Trilogy", "subtitle": "3 films", "covers": "Ch 9–94" }
```

**`"manga-required"`** — content that was skipped and must be read before continuing:
```json
{ "step": 2, "type": "manga-required", "title": "Read Manga — Lost Children Chapter", "covers": "Ch 95–116", "note": "Never animated. Skipped entirely. Must read or the next season makes no sense." }
```

Add `"startChapter"` when this step marks where the manga takes over from the anime:
```json
{ "step": 5, "type": "manga-required", "title": "Continue Manga — From Chapter 238", "covers": "Ch 238+", "startChapter": 238 }
```

**`"choice"`** — viewer must pick between two valid paths covering the same chapters:
```json
{
  "step": 2,
  "type": "choice",
  "label": "Mugen Train — Film or TV arc? Pick ONE",
  "note": "Both cover Ch 54–69. Film came first; TV version has one anime-original intro episode.",
  "options": [
    { "type": "movie-set", "title": "Mugen Train (Film)", "subtitle": "1 film", "covers": "Ch 54–69", "malId": 40456 },
    { "type": "anime",     "title": "Mugen Train Arc (TV)", "subtitle": "7 episodes", "covers": "Ch 54–69", "malId": 47778 }
  ]
}
```

---

## `meta`

```json
"meta": {
  "totalChapters": 139,
  "note": "Internal contributor note — not shown in the UI.",
  "seasons": [
    { "name": "Season 1", "eps": 25 },
    { "name": "Season 2", "eps": 12 }
  ]
}
```

| Field | Notes |
|-------|-------|
| `totalChapters` | The one field that needs ongoing maintenance. Update when new chapters release. |
| `seasons` | TV seasons only (no films). Sum of `eps` must equal the number of non-movie entries in `episodes[]`. Drives the Season Map tab and all derived totals. |
| `note` | Contributor-facing note. Not displayed in the UI. Document data decisions, known gaps, update reminders. |

**Derived at runtime:** `totalEpisodes` (sum of `seasons[].eps`), `adaptedChapters`, `adaptedPct`, `seasonMap`, `logicalStatus`.

---

## `arcs`

| Field | Required | Notes |
|-------|----------|-------|
| `id` | ✅ | Unique snake_case. Appears in search jump URLs — keep stable; renaming breaks links. |
| `name` | ✅ | Display name on the arc card and episode table. |
| `chapterStart` / `chapterEnd` | ✅ | Set both to `0` for anime-original arcs. |
| `episodeStart` / `episodeEnd` | ✅ | Set both to `0` for unadapted arcs and movie arcs. |
| `status` | optional | Defaults to `"canon"`. Explicit values: `"filler"`, `"mixed"`, `"original"`. |
| `type` | optional | `"movie"` or `"special"` for standalone film/OVA entries. |
| `malId` | optional | MAL ID for the film/OVA. |
| `watchAfterEpisode` | optional | Renders a "watch here" marker after this overall episode number. |
| `note` | optional | Shown on the arc card. Use for adaptation notes, skip warnings, alternative-version context. |

---

## `episodes`

| Field | Required | Notes |
|-------|----------|-------|
| `ep` | ✅ (TV) | Overall episode number across all seasons. S2 Ep 1 = `26` if S1 had 25 episodes. |
| `title` | ✅ | Official title. Use `"TBA"` for upcoming untitled episodes. |
| `arc` | ✅ | Must exactly match an arc `id`. |
| `chapters` | ✅ | **Source of truth for adaptation tracking.** Manga chapters this episode covers. Use `[]` for filler/unknown. Use `["Anime Original"]` for anime-original content — prevents the `"Ch "` prefix rendering incorrectly. |
| `series` | optional | Season label for display context. |
| `status` | optional | Defaults to `"canon"`. Only add for `"filler"`, `"mixed"`, `"original"`. |
| `type` | movies | `"movie"` for canon film entries. Array position determines watch-order placement. |
| `malId` | movies | MAL ID for the film. |
| `note` | optional | Note shown in the episode table row. |

---

## `chapterTitles` *(optional)*

```json
"chapterTitles": {
  "1": "To You, in 2000 Years",
  "2": "That Day"
}
```

String keys → official manga chapter titles. Fully optional. Missing entries fall back to `"Chapter N"`. When present: chapter table shows titles, search indexes them, episode table shows titles as tooltips.

---

## `prequelChapters` *(optional)*

```json
"prequelChapters": [
  { "n": 0.1, "title": "Prequel Chapter Title" }
]
```

For films adapting chapters numbered below 1 (JJK0 pattern). Leave as `[]` when unused.

---

## Stats panel — anime vs manga

`fetchBestInfo(animeId, mangaId)` fetches both MAL endpoints and returns whichever has more members. When manga wins, the stat labels update ("MAL Score" → "Manga Score", etc.) and the source strip at the bottom of the panel shows which medium is displayed. No hardcoded overrides needed.

---

## Adaptation tracking

A chapter is marked **adapted** only if it appears in at least one episode's `chapters[]`. Arc `chapterStart`/`chapterEnd` are used for display and chapter→arc lookup only, they do not affect adaptation status. This means a chapter range in an arc is not sufficient; every chapter must explicitly appear in an episode's `chapters[]` to be counted as adapted.

---

## Tips

- **`totalChapters` is the one field requiring ongoing maintenance.** Everything else is either static or derived.
- **Keep arc `id` stable.** Renaming breaks search jump URLs.
- **`meta.seasons` episode counts must match `episodes[]` exactly.** Movie entries (`type: "movie"`) are excluded from this count.
- **`malIds.seasons` and `meta.seasons` serve different purposes.** `malIds.seasons` = section 01 chips (includes films). `meta.seasons` = Season Map tab and episode count (TV only).
- **Check the browser console for data errors.** The app doesn't validate schemas at runtime, errors usually surface as `undefined` in the UI.

See `berserk.json`, `demon_slayer.json`, and `hxh.json` for complete working examples of all features.
