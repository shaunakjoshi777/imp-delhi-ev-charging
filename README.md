# Delhi EV Charger Siting: website

A one-page site for the FLAME University Interdisciplinary Major Project on where public electric-car chargers could go in Delhi. It shows proposed sites from three siting methods (grid rule, weighted K-means, MCLP). It never says which method is better.

## See it on your computer

The page loads its data with `fetch`, so it needs a small local server. Opening `index.html` by double-clicking will not show the maps.

```
cd path/to/this/folder
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser. Press Ctrl+C in Terminal to stop the server.

## What is in this folder

- `index.html`: all page text, in the order of the design brief.
- `assets/site.css`: page layout. Colours, type, spacing and corners come only from the design system.
- `assets/explorer.js`: the explorer. It draws saved layouts and works out distances; it never moves a station.
- `data/explorer_data.json`: every station, demand square, existing charger and shared site the page shows.
- `design-system/`: tokens (`tokens.css`), component styles (`components/bundle.css`), the Forum font and the Delhi outline logo. `design-system/README.md` has the rules.
- `tools/`: how the data file was made (see below).
- `assets/vendor/katex/`: KaTeX 0.16.11 for the two formulas, and `design-system/fonts/` holds Forum and Source Sans 3, so the site needs no outside servers.

## Where the data comes from

Everything comes from `ev_siting_final.ipynb` (the team's final notebook).

1. `tools/run_nb.py` (with `tools/cells.json`, the code of the notebook cells it runs) runs the notebook's model cells unchanged (demand load, grid, K-means, MCLP, Scenario B, station-number runs, Monte Carlo and shared sites). It skips the cells the site does not use: rebuilding demand from OpenStreetMap, road distances, set cover, demand-surface and capacity checks, and the extensions.
2. `tools/export_site_data.py` turns those results into `data/explorer_data.json`, adding ward names and latitude/longitude.

To rebuild, put both scripts in the project folder (next to `Final Data/` and `data/`) and run:

```
python3 run_nb.py
python3 export_site_data.py data/explorer_data.json
```

MCLP runs with a time limit (the 1,570-site runs), so a rerun on another machine can give slightly different sites for those settings.

## Put it on GitHub Pages

1. Copy everything in this folder to the root of the repository (keep the folder structure).
2. Commit and push to a branch, then open a pull request into `main`.
3. In the repository, go to Settings → Pages and choose "Deploy from a branch", branch `main`, folder `/ (root)`.
4. A minute or two after merging, the site is live at `https://<user>.github.io/<repo>/`.

## Rules the site keeps

- No ranking, scoring, highlighting or sorting of methods. Figures show one method at a time.
- No invented stations, numbers or place names. Missing values show as `[TBD: ...]`.
- Keep the OpenStreetMap attribution.
