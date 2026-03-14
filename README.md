# SagaVue

You're watching an ongoing anime. The manga is way ahead. You want to know exactly where the anime left off without getting spoiled — or you need to know which episodes are filler before a rewatch. That's what SagaVue is for.

**[sagavue.net](https://sagavue.net)**

---

## What it does

- Search any episode, chapter, or arc by name or number (`aot s2e5`, `jjk ch200`, `hxh e67`)
- See exactly which manga chapters each episode adapts
- Filter out filler with one click
- Know where movies and OVAs fit in the watch order
- Check how far the anime has gotten into the manga

## Series

- [Attack on Titan](/series/aot)
- [Berserk](/series/berserk)
- [Demon Slayer](/series/demon_slayer)
- [Frieren: Beyond Journey's End](/series/frieren)
- [Fullmetal Alchemist: Brotherhood](/series/fmab)
- [Hunter x Hunter (2011)](/series/hxh)
- [Jujutsu Kaisen](/series/jjk)
- [Vinland Saga](/series/vinland_saga)

## ✏️ Add your favorite series

If a series you follow isn't here, you can add it yourself — no coding experience needed. All it takes is filling in a JSON file with episode and arc data.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full walkthrough. See [DATA_STRUCTURE.md](DATA_STRUCTURE.md) for the full field reference.

## How it's built

Pure vanilla JavaScript with no frameworks or build steps. All series data lives in flat JSON files that the app picks up automatically. Ratings, cover art, and related media are fetched live from the [Jikan API](https://jikan.moe/).

## Docs

- [CONTRIBUTING.md](CONTRIBUTING.md) — how to add a series or contribute code
- [DATA_STRUCTURE.md](DATA_STRUCTURE.md) — JSON schema and how the app processes data
- [SEARCH.md](SEARCH.md) — search syntax and how the fuzzy matching works

## License

MIT
