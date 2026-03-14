# Data Structure

How SagaVue stores series data and processes it at runtime.

---

## File layout

All series data lives in `data/` as individual JSON files, one per series. Files are auto-discovered — any `.json` file in `data/` (except `new_series_template.json`) is loaded at startup with no registry to update.

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

`data.js` fetches `data/`, parses the directory listing for filenames, and loads each one.

---

## Top-level fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | yes | string | Lowercase slug, no spaces. Used in the URL: `/series/my_series`. Must be unique. |
| `title` | yes | string | Full official display title. |
| `abbr` | yes | string[] | Search aliases: abbreviations, alternate romanisations, fan names. |
| `source` | yes | string | Origin medium: `"Manga"`, `"Light Novel"`, `"Manhwa"`, `"Original"`, etc. |
| `animeStatus` | yes | string | `"Finished"`, `"Ongoing"`, or `"Incomplete"` (anime stopped before the source ended). |
| `mangaStatus` | yes | string | `"Finished"`, `"Ongoing"`, or `"Hiatus"`. |
| `lastUpdated` | when Ongoing | string | ISO date `YYYY-MM-DD`. Required when `animeStatus` is `"Ongoing"`. Shows a "Data updated" notice. |
| `tags` | yes | string[] | Genre/demographic tags. 2 shown on the home card, all on the series header. 2-5 is ideal. |
| `malIds` | yes | object | MAL IDs for the info panel, season chips, and related media filtering. |
| `watchGuide` | optional | array | Step-by-step watch/read order. Only needed for series with non-obvious paths. |
| `meta` | yes | object | Chapter count, season groupings, contributor notes. |
| `arcs` | yes | array | Story arc definitions. |
| `episodes` | yes | array | Episode entries, both regular TV episodes and canon films. |
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
| `primary` | MAL anime ID for the main series. Used to fetch score, rank, members, synopsis, and cover art. |
| `manga` | MAL manga ID. `fetchBestInfo()` compares member counts between the anime and manga and shows whichever is higher in the stats panel. Berserk is the canonical example where the manga wins. |
| `canonIds` | All canonical MAL IDs. The Extras section auto-fetches related media and excludes these, so only OVAs, spinoffs, and non-canon films appear there. |
| `seasons` | Chips in the Seasons & Parts section (section 01). Include both TV seasons and canon films. Film chips scroll to the arc entry in the episode list; TV chips link to MAL. Add `"type": "movie"` to render a Film badge and distinct dot colour. |
| `alternativeSeries` | Earlier adaptations or parallel canon series covering the same source. Only `"tv"` and `"movie"` entries appear in section 01 — `"ova"` and `"special"` are excluded (they surface in the Extras section instead). Each entry takes `name`, `malId`, `eps`, `type`, and `note` (shown as a tooltip on hover). |

`malIds.seasons` drives the section 01 chips and can include films. `meta.seasons` drives the Season Map tab and the total episode count — TV only, and it must match `episodes[]` exactly.

---

## `watchGuide`

Rendered as the collapsible "How to Watch & Read" section (section 02). Only add this when the path is genuinely non-obvious: multiple adaptations covering the same material, mandatory manga gaps, or a community debate about watch order.

The section is collapsed by default, shows a step count and gap count badge, and expands on click. Series without a `watchGuide` field simply don't show the section.

### Step types

**`"anime"`** — a single series to watch:
```json
{ "step": 1, "type": "anime", "title": "Berserk (1997)", "subtitle": "25 episodes", "covers": "Ch 1-94", "malId": 33 }
```

**`"movie-set"`** — a film or film series:
```json
{ "step": 1, "type": "movie-set", "title": "Golden Age Arc Film Trilogy", "subtitle": "3 films", "covers": "Ch 9-94" }
```

**`"manga-required"`** — content that was skipped and must be read before continuing:
```json
{ "step": 2, "type": "manga-required", "title": "Read Manga: Lost Children Chapter", "covers": "Ch 95-116", "note": "Never animated. Skipped entirely. Must read or the next season makes no sense." }
```

Add `"startChapter"` when this step marks where the manga takes over from the anime:
```json
{ "step": 5, "type": "manga-required", "title": "Continue Manga from Chapter 238", "covers": "Ch 238+", "startChapter": 238 }
```

**`"choice"`** — viewer must pick between two valid paths covering the same chapters:
```json
{
  "step": 2,
  "type": "choice",
  "label": "Mugen Train: Film or TV arc? Pick one.",
  "note": "Both cover Ch 54-69. The film came first; the TV version has one anime-original intro episode.",
  "options": [
    { "type": "movie-set", "title": "Mugen Train (Film)", "subtitle": "1 film", "covers": "Ch 54-69", "malId": 40456 },
    { "type": "anime",     "title": "Mugen Train Arc (TV)", "subtitle": "7 episodes", "covers": "Ch 54-69", "malId": 47778 }
  ]
}
```

---

## `meta`

```json
"meta": {
  "totalChapters": 139,
  "note": "Internal contributor note, not shown in the UI.",
  "seasons": [
    { "name": "Season 1", "eps": 25 },
    { "name": "Season 2", "eps": 12 }
  ]
}
```

| Field | Notes |
|-------|-------|
| `totalChapters` | The one field that needs ongoing maintenance. Update it when new chapters release. |
| `seasons` | TV seasons only, no films. The sum of `eps` must equal the number of non-movie entries in `episodes[]`. Drives the Season Map tab and all derived totals. |
| `note` | Contributor-facing note, not displayed in the UI. Good for documenting data decisions, known gaps, or update reminders. |

Values derived at runtime: `totalEpisodes` (sum of `seasons[].eps`), `adaptedChapters`, `adaptedPct`, `seasonMap`, `logicalStatus`.

---

## `arcs`

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | Unique snake_case identifier. Appears in search jump URLs, so keep it stable once published. Renaming it will break existing links. |
| `name` | yes | Display name shown on the arc card and episode table. |
| `chapterStart` / `chapterEnd` | yes | Set both to `0` for anime-original arcs. |
| `episodeStart` / `episodeEnd` | yes | Set both to `0` for unadapted arcs and movie arcs. |
| `status` | optional | Defaults to `"canon"`. Explicit values: `"filler"`, `"mixed"`, `"original"`. |
| `type` | optional | `"movie"` or `"special"` for standalone film/OVA entries. |
| `malId` | optional | MAL ID for the film or OVA. |
| `watchAfterEpisode` | optional | Renders a "watch here" marker after this overall episode number. |
| `note` | optional | Shown on the arc card. Good for adaptation notes, skip warnings, or alternative-version context. |

---

## `episodes`

| Field | Required | Notes |
|-------|----------|-------|
| `ep` | yes (TV) | Overall episode number across all seasons. If Season 1 had 25 episodes, Season 2 Episode 1 is `26`. |
| `title` | yes | Official title. Use `"TBA"` for upcoming untitled episodes. |
| `arc` | yes | Must exactly match an arc `id`. |
| `chapters` | yes | The source of truth for adaptation tracking. List the manga chapters this episode covers. Use `[]` for filler or unknown. Use `["Anime Original"]` for anime-original content, otherwise the `"Ch "` prefix will render incorrectly. |
| `series` | optional | Season label for display context. |
| `status` | optional | Defaults to `"canon"`. Only add for `"filler"`, `"mixed"`, or `"original"`. |
| `type` | movies | `"movie"` for canon film entries. Array position determines watch-order placement. |
| `malId` | movies | MAL ID for the film. |
| `note` | optional | Note shown in the episode table row. |

---

## `chapterTitles` (optional)

```json
"chapterTitles": {
  "1": "To You, in 2000 Years",
  "2": "That Day"
}
```

String keys mapping to official manga chapter titles. Fully optional. Missing entries fall back to `"Chapter N"`. When present, the chapter table shows titles, search indexes them, and the episode table shows titles as tooltips.

---

## `prequelChapters` (optional)

```json
"prequelChapters": [
  { "n": 0.1, "title": "Prequel Chapter Title" }
]
```

For films adapting chapters numbered below 1 (the JJK0 pattern). Leave as `[]` when unused.

---

## Stats panel: anime vs manga

`fetchBestInfo(animeId, mangaId)` fetches both MAL endpoints and returns whichever has more members. When the manga wins, the stat labels update ("MAL Score" becomes "Manga Score", etc.) and the source strip at the bottom of the panel reflects which medium is being shown. No hardcoded overrides needed.

---

## Adaptation tracking

A chapter is marked as adapted only if it appears in at least one episode's `chapters[]`. Arc `chapterStart`/`chapterEnd` are used for display and chapter-to-arc lookup only — they don't affect adaptation status. That means listing a chapter range in an arc is not enough; each chapter must explicitly appear in an episode's `chapters[]` to be counted.

---

## Tips

- `totalChapters` is the only field that needs regular maintenance. Everything else is either static or derived at runtime.
- Keep arc `id` values stable. Renaming them breaks search jump URLs.
- `meta.seasons` episode counts must match `episodes[]` exactly. Movie entries (`type: "movie"`) are excluded from this count.
- `malIds.seasons` and `meta.seasons` serve different purposes. `malIds.seasons` powers the section 01 chips and can include films. `meta.seasons` powers the Season Map tab and the episode count, and is TV only.
- Check the browser console for data errors. The app doesn't validate schemas at runtime, so mistakes usually show up as `undefined` in the UI.

See `berserk.json`, `demon_slayer.json`, and `hxh.json` for complete working examples of all features.
