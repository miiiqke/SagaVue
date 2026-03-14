# Contributing

Contributions come in two flavours: adding or updating series data (no coding required) and improving the app itself.

---

## ✏️ Adding a new series

All you're doing is filling out a JSON file. The full schema reference is in `DATA_STRUCTURE.md`. A working example is in `data/new_series_template.json`.

### Step 1 — Fork and clone

```bash
git clone https://github.com/YOUR_USERNAME/sagavue.git
cd sagavue
```

### Step 2 — Copy the template

```bash
cp data/new_series_template.json data/my_hero_academia.json
```

Use a short, lowercase, hyphen-free filename (`mha.json`, `vinland_saga.json`).

### Step 3 — Fill in the data

**Required fields at the top level:**

```json
{
  "id": "mha",
  "title": "My Hero Academia",
  "abbr": ["MHA", "BNHA", "Boku no Hero"],
  "source": "Manga",
  "animeStatus": "Ongoing",
  "mangaStatus": "Ongoing",
  "lastUpdated": "2026-03-13",
  "tags": ["Action", "Superheroes", "School", "Shonen"]
}
```

- `id` — short, lowercase, no spaces. Becomes the URL: `#series/mha`.
- `abbr` — everything fans search by. The more the better.
- `animeStatus` / `mangaStatus` — `"Ongoing"`, `"Finished"`, `"Incomplete"`, or `"Hiatus"`. The combined status badge is computed automatically.
- `lastUpdated` — required when `animeStatus` is `"Ongoing"`. Tells users how fresh the data is.

**MAL IDs** — adds ratings, cover art, synopsis, and section 01 chips:

```json
"malIds": {
  "primary": 31964,
  "manga": 75989,
  "canonIds": [31964, 33486, 36475],
  "seasons": [
    { "name": "Season 1", "malId": 31964, "eps": 13 },
    { "name": "Season 2", "malId": 33486, "eps": 25 },
    { "name": "Season 3", "malId": 36475, "eps": 25 },
    { "name": "Heroes Rising (Film)", "malId": 40707, "eps": 1, "type": "movie" }
  ]
}
```

- `primary` — MAL ID of the first/main anime season. Find it in the URL on myanimelist.net.
- `manga` — MAL manga ID. Used to compare anime vs manga member counts — whichever is higher is shown in the stats panel.
- `canonIds` — all canonical MAL IDs. Used to filter them out of the Extras section (only OVAs and spinoffs go there).
- `seasons` — renders as chips in the Seasons & Parts section. Include both TV seasons **and** canon films here (add `"type": "movie"` for films).
- `alternativeSeries` — earlier adaptations or parallel canon series (e.g. FMA 2003 alongside Brotherhood). Only `"tv"` and `"movie"` types appear in section 01. See `DATA_STRUCTURE.md` for full field reference.

**Meta block:**

```json
"meta": {
  "totalChapters": 430,
  "seasons": [
    { "name": "Season 1", "eps": 13 },
    { "name": "Season 2", "eps": 25 },
    { "name": "Season 3", "eps": 25 }
  ]
}
```

- `totalChapters` — update this as new chapters release.
- `seasons` — TV seasons only (no films). The sum of `eps` must match the number of non-movie entries in `episodes[]` exactly.

**Arcs:**

```json
"arcs": [
  {
    "id": "entrance_exam",
    "name": "Entrance Exam Arc",
    "chapterStart": 1, "chapterEnd": 3,
    "episodeStart": 1, "episodeEnd": 3
  },
  {
    "id": "unadapted_arc",
    "name": "Unadapted Arc",
    "chapterStart": 301, "chapterEnd": 350,
    "episodeStart": 0, "episodeEnd": 0,
    "note": "Not yet animated."
  },
  {
    "id": "heroes_rising",
    "name": "Heroes Rising",
    "type": "movie",
    "malId": 40707,
    "watchAfterEpisode": 88,
    "chapterStart": 0, "chapterEnd": 0,
    "status": "canon",
    "note": "Set between seasons 4 and 5. Watch after episode 88."
  }
]
```

- Set `episodeStart`/`episodeEnd` to `0` for unadapted arcs.
- Add `"type": "movie"` for canon films in the watch order.
- Arc `id` values appear in search jump URLs — keep them stable once published.

**Episodes:**

```json
"episodes": [
  { "ep": 1,  "title": "Izuku Midoriya: Origin",     "arc": "entrance_exam", "chapters": [1, 2],   "series": "Season 1" },
  { "ep": 2,  "title": "What It Takes to Be a Hero", "arc": "entrance_exam", "chapters": [3],       "series": "Season 1" },
  { "ep": 14, "title": "Mixed Canon Episode",        "arc": "usj",           "chapters": [12, 13],  "series": "Season 1", "status": "mixed" },
  { "ep": 38, "title": "Anime-Original Episode",     "arc": "some_arc",      "chapters": ["Anime Original"], "status": "filler" },
  {
    "type": "movie",
    "title": "Heroes Rising",
    "arc": "heroes_rising",
    "malId": 40707,
    "chapters": [],
    "status": "canon"
  }
]
```

- `ep` — overall episode number across all seasons. S2 Ep 1 = `26` if S1 had 25 episodes.
- `chapters` — manga chapters this episode covers. **The source of truth for adaptation tracking.** Use `[]` for filler or unknown. Use `["Anime Original"]` for anime-original canon episodes.
- `status` — omit for canon episodes. Only add for `"filler"`, `"mixed"`, or `"original"`.
- For films, use `"type": "movie"` instead of `"ep": N`.

**Watch guide** *(optional — only for complex series)*:

Only add `watchGuide` when the watch order is non-obvious: multiple adaptations covering the same content, mandatory manga gaps, or an active community debate. Clean linear series (AoT, Frieren, JJK) don't need it.

See `berserk.json`, `hxh.json`, and `demon_slayer.json` for real working examples. Full type documentation is in `DATA_STRUCTURE.md`.

**Chapter titles** *(optional)*:

```json
"chapterTitles": {
  "1": "Izuku Midoriya: Origin",
  "2": "Rooftop"
}
```

String keys mapping to official chapter titles. Omit the field entirely if you don't have the data.

### Step 4 — Check your work

```bash
python3 -m http.server
# open http://localhost:8000
```

Your series appears on the home page automatically. Check the browser console for any errors. Common mistakes:

- `meta.seasons` episode total doesn't match the number of `episodes[]` entries — the adaptation bar will be wrong.
- An `arc` field in an episode doesn't match any arc `id` — the episode table will show `—` for the arc column.
- A chapter listed in `episodes[].chapters` is higher than `meta.totalChapters` — it won't be counted as adapted.

### Step 5 — Submit

Open a pull request with a title like `Add My Hero Academia`. Include a brief note about the source you used for chapter-to-episode mapping (wiki, official site, etc.).

---

## 🔄 Updating existing data

The most common update is bumping `totalChapters` and `lastUpdated` when a manga publishes new chapters. For ongoing anime, you'll also add new episode entries and update the arc's `episodeEnd`.

When a series finishes:
- Set `animeStatus` to `"Finished"` or `"Incomplete"`.
- Remove `lastUpdated` (or leave it — it only shows when `animeStatus` is `"Ongoing"`).
- Verify `adaptedPct` looks right in the UI.

---

## 🛠️ Code contributions

### Getting started

No build step. Open `index.html` directly or serve locally as above.

### File layout

```
index.html          — HTML shell and layout
css/styles.css      — all styles
js/
  main.js           — entry point, wires everything together
  data.js           — loads JSON, builds derived structures (enrich())
  render.js         — DOM rendering (pure functions, no state)
  router.js         — hash-based routing (#series/id URLs, middle-click support)
  search.js         — live search with fuzzy matching and token parsing
  api.js            — Jikan (MAL) wrapper with caching, rate limiting, fetchBestInfo()
  status.js         — computes logicalStatus from animeStatus + mangaStatus
data/
  *.json            — one file per series, auto-discovered at runtime
  new_series_template.json
assets/
  img/logo.png
  favicons/
```

### Guidelines

**Stay vanilla.** No npm packages or build steps. If something needs a library, simplify the approach instead.

**Keep render functions pure.** Functions in `render.js` take data and return/update DOM. They hold no state and make no API calls.

**One concern per file.** New logic that doesn't fit cleanly into an existing module gets its own file.

**`meta.seasons` is the episode count contract.** Any feature touching episode counts must respect the invariant: `sum(meta.seasons[].eps) === non-movie episode entries`.

**Test in multiple browsers.** Chrome and Firefox at minimum. The app targets standard ES2020.

**Update docs when you change the schema.** If you add a new JSON field or change how an existing one works, update `DATA_STRUCTURE.md`. If you change search behaviour, update `SEARCH.md`.

---

## License

MIT. See [LICENSE](LICENSE).
