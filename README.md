# EV Go Brrr: project website

Static one-page site for *A Comparative Analysis of Algorithms to Optimise EV Charging Station Locations in NCT Delhi*
(Interdisciplinary Major Project, FLAME University). It shows three siting methods (a policy grid rule, weighted
K-means and MCLP) side by side on the same demand estimate, with the Delhi Charger Siting Explorer as its centrepiece.

Plain HTML, CSS and JavaScript. No build step, no backend, no API keys.

## Files

| File | What it is |
|---|---|
| `index.html` | The page |
| `assets/site.css` | Styles (light and dark themes) |
| `assets/explorer.js` | Theme toggle, KaTeX formulas, the demand map and the explorer |
| `explorer_data.json` | Every layout the explorer draws (about 320 KB) |
| `site_facts.json` | The counts quoted in the page text, read from the project data |
| `build_data.py` | Rebuilds the two JSON files from the project data |
| `precompute_layouts.py` | The team's original export script (kept for reference; `build_data.py` follows it) |
| `NOTES.md` | Assumptions, open questions, placeholders and differences from the report |

External resources, loaded from CDNs: IBM Plex fonts (Google Fonts, with system-font fallbacks) and KaTeX 0.16.11
(jsDelivr). If they fail to load, the page still works: text falls back to system fonts and formulas show as plain text.

## Preview locally

From this folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` directly from disk won't work, because the page fetches
`explorer_data.json`.

## Rebuild the data

`build_data.py` needs the full project folder, which isn't in this repository: `siting_lib.py` and `imp 2/` (with
`Final Data/`, `data/delhi_demand_weights.gpkg`, `outputs/siting_all_layouts_v1.gpkg` and `ward_master_v2.csv`) next
to the `website/` folder. It needs Python 3.11+ with geopandas, shapely 2, scikit-learn and SciPy.

Run from the project folder:

```bash
python3 website/build_data.py --facts-only
```

```bash
python3 website/build_data.py
```

```bash
python3 website/build_data.py --resolve-mclp
```

- `--facts-only` rewrites `site_facts.json` only (a few seconds).
- With no flag it also rebuilds the grid and K-means layouts, the demand cells and the outline, and keeps the existing
  MCLP layouts.
- `--resolve-mclp` also re-solves MCLP for every station count (up to 90 s per stage for 28 station counts, so it can take over an hour). Check the
  result before publishing: with a time limit, a re-solve on a different machine can return a worse layout (see
  `NOTES.md`, item 7).

The demand surface itself isn't rebuilt by this script. It comes from `imp 2/demand_weights.ipynb`, which writes into
`imp 2/data/`; run it on a copy if it ever needs re-running.

## Deploy on GitHub Pages

1. Push this folder to the repository's `main` branch (it's the repository root).
2. On GitHub, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`,
   folder `/ (root)`, and save.
3. After a minute or two the site is at `https://<user>.github.io/<repository>/`.

The `.nojekyll` file tells GitHub Pages to serve the files as they are.

To deploy on Netlify instead, drag this folder onto <https://app.netlify.com/drop>, or connect the repository with no
build command and `.` as the publish directory.
