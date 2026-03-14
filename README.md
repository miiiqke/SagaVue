<div align="center">
  <img src="assets/img/logo.png" alt="SagaVue" height="48" />
  <br /><br />
  <p><strong>Anime adaptation navigator — know where you are, never get spoiled.</strong></p>
  <a href="https://sagavue.net">sagavue.net</a> &nbsp;·&nbsp;
  <a href="https://github.com/miiiqke/SagaVue/issues">Report a bug</a> &nbsp;·&nbsp;
  <a href="https://github.com/miiiqke/SagaVue/issues">Suggest a series</a>
  <br /><br />
</div>

---

SagaVue helps you navigate the gap between an anime and its source material. Search any episode, chapter, or arc, see exactly which manga chapters each episode adapts, filter out filler, and follow the correct watch order — without getting spoiled.

The series catalogue is a **work in progress**. We are actively adding more titles and keeping existing data up to date.

## Features

- **Smart search** — query by episode number, chapter number, arc name, or free text across all series simultaneously (`aot s2e5`, `jjk ch200`, `berserk ep 14`)
- **Episode & chapter map** — every episode mapped to its exact manga chapters, with canon / filler / mixed status
- **Adaptation progress** — see how far into the manga the anime has gotten, and what remains unadapted
- **Watch order guide** — step-by-step guidance for series with films, alternative adaptations, or skipped arcs
- **Live MAL data** — scores, rankings, cover art, and related media fetched in real time from [MyAnimeList](https://myanimelist.net) via [Jikan](https://jikan.moe)

## Built with

Vanilla JavaScript, no frameworks, no build step. Series data lives in flat JSON files that are auto-discovered at runtime. Open `index.html` locally or deploy to any static host.

## Contributing

Contributions are welcome — whether that's adding a new series, fixing episode data, or improving the app itself.

- **Adding a series** requires no coding experience. Fill in a JSON file following the schema in [`DATA_STRUCTURE.md`](DATA_STRUCTURE.md) and open a pull request.
- **Code contributions** — see [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines and the file layout.

```bash
git clone https://github.com/miiiqke/SagaVue.git
cd SagaVue
python3 -m http.server   # open http://localhost:8000
```

## Documentation

| File | Contents |
|------|----------|
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to add a series or contribute code |
| [`DATA_STRUCTURE.md`](DATA_STRUCTURE.md) | Full JSON schema and field reference |
| [`SEARCH.md`](SEARCH.md) | Search syntax and fuzzy matching internals |

## License

[MIT](LICENSE)
