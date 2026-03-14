# Contributing

There are two ways to contribute: adding or updating series data (no coding required), or improving the app itself.

---

## Adding a new series

All you're doing is filling out a JSON file. The full schema is in `DATA_STRUCTURE.md` and there's a working template at `data/new_series_template.json`.

### Step 1 — Fork and clone

```bash
git clone https://github.com/miiiqke/sagavue.git
cd sagavue
```

### Step 2 — Copy the template

```bash
cp data/new_series_template.json data/my_hero_academia.json
```

Use a short, lowercase filename with underscores, not hyphens (`mha.json`, `vinland_saga.json`).

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

- `id` is a short lowercase slug with no spaces. It becomes the URL: `#series/mha`.
- `abbr` should include everything fans actually search by. More is better.
- `animeStatus` / `mangaStatus` accept `"Ongoing"`, `"Finished"`, `"Incomplete"`, or `"Hiatus"`. The combined status badge is computed automatically.
- `lastUpdated` is required when `animeStatus` is `"Ongoing"`. It shows users how fresh the data is.

**MAL IDs** unlock ratings, cover art, synopsis, and the season chips:

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

- `primary` is the MAL ID of the first/main anime season. You can find it in the URL on myanimelist.net.
- `manga` is the MAL manga ID. The stats panel compares member counts between the anime and manga and shows whichever is higher.
- `canonIds` lists all canonical MAL IDs. The Extras section uses this to exclude them, so only OVAs and spinoffs show up there.
- `seasons` renders as chips in the Seasons & Parts section. Include both TV seasons and canon films here. Add `"type": "movie"` for films.
- `alternativeSeries` is for earlier adaptations or parallel canon series, e.g. FMA 2003 alongside Brotherhood. Only `"tv"` and `"movie"` types appear in section 01. See `DATA_STRUCTURE.md` for the full field reference.

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

- `totalChapters` needs to be updated as new chapters release.
- `seasons` is TV only, no films. The sum of `eps` must match the number of non-movie entries in `episodes[]` exactly.

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
- Arc `id` values appear in search jump URLs, so keep them stable once published.

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

- `ep` is the overall episode number across all seasons. If Season 1 had 25 episodes, Season 2 Episode 1 is `26`.
- `chapters` is what drives adaptation tracking. List the manga chapters this episode covers. Use `[]` for filler or unknown episodes, and `["Anime Original"]` for anime-original canon content.
- `status` defaults to canon, so only add it for `"filler"`, `"mixed"`, or `"original"`.
- For films, use `"type": "movie"` instead of `"ep"`.

**Watch guide** (optional, only for complex series):

Only add a `watchGuide` when the watch order is genuinely non-obvious: multiple adaptations covering the same content, mandatory manga gaps, or an active community debate about order. Straightforward linear series like AoT, Frieren, and JJK don't need one.

See `berserk.json`, `hxh.json`, and `demon_slayer.json` for real working examples. Full type documentation is in `DATA_STRUCTURE.md`.

**Chapter titles** (optional):

```json
"chapterTitles": {
  "1": "Izuku Midoriya: Origin",
  "2": "Rooftop"
}
```

String keys mapping to official chapter titles. Leave the field out entirely if you don't have the data.

### Step 4 — Check your work

```bash
python3 -m http.server
# open http://localhost:8000
```

Your series will appear on the home page automatically. Check the browser console for errors. The most common mistakes are:

- `meta.seasons` episode total not matching the number of `episodes[]` entries, which will break the adaptation bar.
- An `arc` field in an episode not matching any arc `id`, which will show `—` in the arc column.
- A chapter in `episodes[].chapters` being higher than `meta.totalChapters`, so it won't be counted as adapted.

### Step 5 — Submit

Open a pull request with a title like `Add My Hero Academia`. Include a brief note about the source you used for chapter-to-episode mapping (wiki, official site, etc.).

---

## Updating existing data

The most common update is bumping `totalChapters` and `lastUpdated` when a manga publishes new chapters. For ongoing anime, you'll also add new episode entries and update the arc's `episodeEnd`.

When a series finishes, set `animeStatus` to `"Finished"` or `"Incomplete"`, and optionally remove `lastUpdated` since it only shows when the anime is ongoing.

---

## Code contributions

No build step needed. Open `index.html` directly or serve locally with `python3 -m http.server`.

### File layout

```
index.html              — HTML shell and layout
privacy.html            — Privacy policy page
css/
  styles.css            — all styles
js/
  main.js               — entry point, wires everything together
  data.js               — loads JSON, builds derived structures (enrich())
  render.js             — DOM rendering (pure functions, no state)
  render-footer.js      — builds and injects the footer from footer.js config
  footer.js             — footer content config (links, columns, disclaimer)
  router.js             — hash-based routing (#series/id URLs, middle-click support)
  search.js             — live search with fuzzy matching and token parsing
  api.js                — Jikan (MAL) wrapper with caching, rate limiting, fetchBestInfo()
  status.js             — computes logicalStatus from animeStatus + mangaStatus
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
