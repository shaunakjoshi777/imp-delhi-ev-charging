# Website notes (running log)

Assumptions, open questions, placeholders, and differences between the explorer and the report.
Newest entries at the bottom of each section. Started 2026-11-23 (Phase 1).

## Decisions from the team (2026-11-23)

- **250 wards** (2022 MCD delimitation). The 273-row geojson is outdated and isn't used or cited as the ward source.
- Population is stated as **Census 2011** counts (via the SEC 2022 delimitation).
- Work from **`imp 2/`** plus the folders marked "Final"; the other folders at the top level are earlier iterations.
- Comparison strip: a **neutral table** with no highlighting, sorting or ranking, and **no "not a ranking" caption**.
  The "Why there's no winner" section stays.

## Status of the explorer data (updated 2026-11-23)

`imp 2/` supplied the missing files: `demand_weights.ipynb`, `demand_weights_mc.py`, `data/delhi_demand_weights.gpkg`,
`outputs/siting_all_layouts_v1.gpkg`, `outputs/evaluation_v1/`. `siting_lib.py` is at the project root.
The team's original working folder was laid out as `imp 2/*` + `siting_lib.py` + `website/` in one directory
(see `imp 2/.claude/launch.json`), so scripts must run with cwd = `imp 2/` and the project root on `sys.path`.

- `imp 2/.venv` was created on a teammate's machine and won't run here. The system
  Python 3.13 has every dependency (geopandas, shapely 2, scipy, sklearn).
- Re-running `siting_lib` from `imp 2/` reproduces the JSON's grid layouts (all 7 sizes) and K-means k=104 to within
  the 10 m rounding.
- `imp 2/Final Data`, `imp 2/outputs/{kmeans_v2,mclp_v1,siting_comparison_A_104.gpkg}` and the three model notebooks
  are byte-identical to the top-level copies.

## Schema of `explorer_data.json` (verified 2026-11-23)

324 KB, minified, coordinates rounded to 10 m, EPSG:32643 (UTM 43N).

| Key | Shape | Notes |
|---|---|---|
| `cells` | 1,570 × `[ix, iy, weight, population, area_km2, x, y]` | weights sum to 999.9992 (1,000 before 4-dp rounding); population sums to 16,419,781; area to 1,393.247 km² |
| `outline` | 3 rings (4, 246, 60 points) | study-area boundary, simplified at 120 m |
| `grids` | keys `1, 1.5, 2, 2.5, 3, 4, 5` | each `{n, size_km, stations[[x,y]], cells[[x0,y0,selected]]}` |
| `budgets` | 28 counts | 48, 50, 60, 69, 70, 80, 90, 104, 110, 120, 126, 130, 140, 150, 157, 160, 170, 180, 190, 200, 224, 237, 250, 275, 300, 350, 400, 404 |
| `kmeans`, `mclp` | keyed by budget | each list has exactly `budget` stations (checked for all 28) |
| `existing4w` | 98 points | |
| `consensus` | 77 × `[x, y, all_three_1km, robust_all]` | **extra key, not in the brief's schema, and not read by `index.html`** (the page recomputes consensus live). From the 104-station report baseline: 26 flagged all-three-within-1 km, 13 also robust |
| `notes` | `{mclp_candidates, radius_m: 2100, crs}` | extra key |

Grid layouts in the JSON:

| Cell size (km) | 1 | 1.5 | 2 | 2.5 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|---|
| Stations (`n`) | 404 | 237 | 157 | 126 | 104 | 69 | 48 |
| Cells listed | 1,567 | 740 | 431 | 293 | 208 | 127 | 88 |

## Cross-checks against the report outputs

- Grid 3 km (104), K-means k=104 and the 98 existing 4W chargers match `outputs/siting_comparison_A_104.gpkg` /
  `Final Data/delhi_ev_gis_v1.gpkg` point for point (all within 7 m, i.e. the 10 m rounding).
- MCLP p=104 does **not** match the report baseline (0 of 104 sites within 15 m). Expected: the explorer picks from
  the 1,570 cell centres, the report from the 206 3 km grid-cell centres. Keep the footnote caveat.
- 60/40 demand weighting: verified exactly on `demand_cells` in `outputs/siting_comparison_A_104.gpkg`:
  `weight/Σweight = 0.6·R/ΣR + 0.4·D/ΣD` (max error 2e-18). The code that builds `R` and `D` is missing (below).

## Inconsistencies found

1. **Ward counts.** The GitHub geojson (`Data/DELHI Ward Boundaries and Land Use.geojson`) has 273 rows (260 unique
   ward codes; `ASSUMPTIONS.md` calls it "272-ward"). The study area actually comes from `Data/delhi_wards_2022.kml`
   (SEC 2022 delimitation, 251 polygons, ward 0 dropped → 250). The brief's source line "ward boundaries from a public
   GitHub repo" describes the old file, not the one the models use. Provenance of the KML: [TBD].
   **Resolved:** the site uses 250 wards and doesn't cite the 273-row file.
2. **Population source.** SEC 2022 delimitation figures are Census 2011 counts (A2). **Resolved:** the site says
   "Census 2011".
   Ward total 16,419,787; JSON cell total 16,419,781 (rounding).
3. **Chargers.** 1,404 total (1,322 SwitchDelhi + 82 OSM) → 1,323 inside the study area → 149 flagged 4W (by matching
   to the Kaggle dataset within 30 m; OSM points have unknown 4W status) → **98 4W inside the study area**. The brief
   doesn't mention the Kaggle 4W match. Older notebook output says 1,367 inside the boundary (old 272-ward boundary).
4. **Excluded area.** `excluded_ndmc_cantonment` layer: 91.3 km². `ASSUMPTIONS.md` A3 and `Final Data/README.md` say
   84 km². Study area 1,393 km² in both.
5. **Grid model versions.** `ev_grid_baseline_updated.ipynb` (Oct 7) uses the old boundary: 205 cells, **102**
   stations. The final grid (206 cells, **104** stations) comes from `siting_lib.grid_model` (missing). The explorer
   lists 208 cells at 3 km and 431 at 2 km (GIS file: 206 / 428); the extra cells are unselected, so station counts
   agree.
6. **Demand definition.** `Final Data/` (README, model_parameters, D2) still describes a **ward-level** demand
   (`ev_4w_demand` from VAHAN by RTO zone, 250 points). The final models and the explorer use the **1 km, 60/40**
   surface from `demand_weights.ipynb` (missing). The site describes the 1 km version.
7. **MCLP time limit.** The footnote says MCLP hit its time limit for 60–140 stations. `precompute_layouts.py` uses a
   90 s limit but its console log wasn't saved. **Re-run on 2026-11-23** (same code and settings, this Mac):
   - 48–69 and 150–404: solved to proven optimality. The JSON layouts at 60 and 69 are identical to the proven-optimal
     ones, so those two are optimal, not near-optimal.
   - **70–140: solver stopped at the 90 s limit** (remaining gap 0.19–0.45%, except p=120, below).
   - The JSON's layout covers at least as much demand as the re-run at every one of these budgets.
   - At p=120 the re-run stopped with a poor solution (38.45% covered, gap 160%); the JSON layout covers 99.73%.
     **So re-solving MCLP on a different machine can produce worse layouts.** The pipeline must keep the JSON's MCLP
     layouts as canonical and re-solve only on request.
   - Footnote wording changes to **"70–140 stations"**.
   - The JSON p=126 layout covers 99.72%, slightly less than p=120 (99.73%). This is another sign these are
     near-optimal. Fine to show; no need to comment on it on the site.
   Script: scratchpad `mclp_status.py` (writes nothing into the project).
8. **Grid sizes.** Brief says "1 to 5 km"; the data also has 1.5 and 2.5 km.
9. **Team name.** Mid-sem attendance sheet: "Adit Jai Jain", "Pranav Sreenivasan"; proposal and slides: "Adit Jain",
   "Pranav Tewari Sreenivasan". Using the brief's spelling.
10. **Evaluative outputs exist** in `ev_evaluation_and_extensions.ipynb` (scorecard, regret table,
    `yardsticks_won`). Per the brief, none of these go on the site.

## Missing files

Resolved by `imp 2/` (above). Still absent: `data/feasible_sites.geojson` (optional, the grid notebook passes `None`).

## Demand surface (from `imp 2/data/delhi_demand_weights_QA.md` and `demand_weights_mc.py`)

- 1,570 cells of 1 km, clipped to the 250-ward study area (1,393.25 km²); 3,259 cell-ward pieces.
- `w = 1000 · s / Σs`, `s = λ·R/ΣR + (1−λ)·D/ΣD`, **λ = 0.6**.
- **R (home side)** = ward income total spread over mapped residential land (dasymetric). Income per capita is flat
  (₹493,024 everywhere), so R is effectively **population**. 33 wards with < 1% residential cover fall back to
  an area split.
- **D (destination side)** = 0.35 POIs + 0.30 commercial/industrial land + 0.20 roads + 0.15 transit.
  POIs: office 0.25, mall 0.25, hospital 0.20, hotel 0.15, parking 0.15 (1,153 / 62 / 605 / 375 / 488 after
  de-duplication). Roads = mean of arterial density, intersection density, arterial proximity. Transit = metro
  stations (194 in area) and bus terminals (59 in area).
- The θ weights are the team's reasoned starting values, **not from the literature** (the QA file says so). The site
  should say so too.
- Monte Carlo robustness: λ ~ U(0.3, 0.8), θ ~ Dirichlet(50·base), lognormal noise σ = 0.3.
- Not re-run: the notebook writes into `imp 2/data/`, which the brief says not to modify. If it ever needs re-running,
  do it on a copy.

## Documents

- Read: `Deliverables/IMP Proposal.pdf` (context, 21 references), `Deliverables/Mid-Sem Review.pdf` (minutes),
  `Deliverables/IMP Project Mid-Sem Review.pdf` (slides).
- Not readable: `IMP Project Abstract.pages`, `IMP Proposal.pages` (Apple iWork format). The proposal has a PDF copy;
  the abstract doesn't.

## Build (Phase 3, 2026-11-23)

- New page `index.html` with `assets/site.css` and `assets/explorer.js`. The original explorer is kept locally,
  unchanged except for its data path, at `reference/explorer.html`. It is git-ignored, because it still has the
  "best value" ● markers.
- Removed from the explorer: the `.best` class and its ● marker, and the `best()` / `flags` logic. The table has no
  highlighting, sorting or ranking, and no "not a ranking" caption (team decision). The variable that held the
  nearest-station distance in `metrics()` was renamed so the word "best" no longer appears in the code.
- Footnote: the MCLP time-limit range changed from 60–140 to **70–140** (item 7).
- Added: a theme toggle (saved in `localStorage` when available), `aria-valuetext` on the sliders, `role="img"` and
  `aria-describedby` on each canvas, and a screen-reader summary under each map, updated on every change.
- KaTeX 0.16.11 and the IBM Plex fonts load from CDNs (jsDelivr, Google Fonts) with system-font fallbacks.
- `build_data.py` writes `site_facts.json`; every count in the page text was checked against it or against the
  source named below.

### Where each number on the page comes from

| Number | Source |
|---|---|
| 25% BEV target; 3,734 points, 2,610 locations, 234 swap stations (end 2022); 18,000 target | Proposal, with its citations (GNCTD n.d.; Economic Survey 2022–23 = GNCTD Planning 2022) |
| 68,322 e-cars (13 area RTOs), 14,016 e-taxis (DL52), active vehicles registered 2020–2026 | `ward_master_v2.csv` (`ev_cars`, `ev_taxis`); `ASSUMPTIONS.md` V1–V3 |
| 98 4W chargers; 1,404 / 1,322 / 82 / 1,323; 30 m match and dedup | `site_facts.json`; `ASSUMPTIONS.md` A1, C4 |
| 250 wards; 1,393 km²; 16,419,787 people | `site_facts.json` |
| 1,570 cells; weights sum 1,000; 60/40; θ shares; 33 fallback wards; 194 metro, 59 bus | `site_facts.json`; `imp 2/data/delhi_demand_weights_QA.md` |
| Top 10% of cells hold 36% of the weight | QA file; recomputed from `explorer_data.json` (36.2%) |
| Grid 404 (1 km), 104 (3 km), 48 (5 km); 28 station counts, 48–404 | `explorer_data.json` |
| R = 2.1 km, 1 km tie-break, 90 s per stage, 10 K-means restarts, seed 42 | `precompute_layouts.py`, `siting_lib.py` |
| 206 grid-cell centres in the report's MCLP | `candidates_3km` (206 rows) |
| 70–140 near-optimal; others proven optimal | Re-run, item 7 |
| 118 ward pairs, 1.5–5 km apart, median detour 1.42 | `ASSUMPTIONS.md` (road network section) |
| Explorer table and stats | Computed in the browser from `explorer_data.json` |

## Placeholders (visible on the page as [TBD: …])

- [TBD: source URL for the 2022 ward boundary file] (`Data/delhi_wards_2022.kml`)
- [TBD: link to the final report] (due 2026-11-28)

Resolved: MCLP time-limit range (70–140). The 273-row GitHub ward geojson is not cited (team decision).
