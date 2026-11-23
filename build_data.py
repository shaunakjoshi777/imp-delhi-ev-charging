"""Rebuild the data files the website reads.

    explorer_data.json  every layout the explorer draws (same format as precompute_layouts.py writes)
    site_facts.json     every number quoted in the page text, read from the project files

Run from the project folder that holds `imp 2/` and `siting_lib.py` (the scripts expect `imp 2/` as the working
directory, so this script switches into it):

    python3 website/build_data.py              # facts + grid + K-means; keeps the existing MCLP layouts
    python3 website/build_data.py --facts-only # only site_facts.json (a few seconds)
    python3 website/build_data.py --resolve-mclp   # also re-solve MCLP (can take over an hour; see README)

MCLP layouts are kept by default because re-solving them with a time limit on a different machine can return
worse layouts (see NOTES.md, item 7). The demand surface itself is not rebuilt here: `imp 2/demand_weights.ipynb`
writes into `imp 2/data/`, so run it on a copy if it ever needs re-running.
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent            # website/
ROOT = HERE.parent                                 # project folder (siting_lib.py)
WORK = ROOT / "imp 2"                              # working directory the team's code expects
OUT_DATA, OUT_FACTS = HERE / "explorer_data.json", HERE / "site_facts.json"

ap = argparse.ArgumentParser()
ap.add_argument("--facts-only", action="store_true")
ap.add_argument("--resolve-mclp", action="store_true")
ap.add_argument("--mclp-time-limit", type=float, default=90)
ap.add_argument("--out-dir", type=Path, default=HERE, help="write the JSON files here instead (for testing)")
args = ap.parse_args()
OUT_DIR = args.out_dir.resolve()
OUT_DATA, OUT_FACTS = OUT_DIR / "explorer_data.json", OUT_DIR / "site_facts.json"

os.chdir(WORK)
sys.path[:0] = [str(ROOT), str(WORK)]
import warnings
warnings.filterwarnings("ignore")
import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
import siting_lib as sl

B = sl.load_base()
X, w, d = B["X"], B["w"], B["demand"]
r10 = lambda a: [int(round(v / 10) * 10) for v in a]          # 10 m precision keeps the file small


# --- facts quoted in the page text ---------------------------------------------------------------------------
def facts():
    gis = sl.GIS
    wards = gpd.read_file(gis, layer="wards")
    wm = pd.read_csv("ward_master_v2.csv")
    study = gpd.read_file(gis, layer="study_area").to_crs(sl.CRS)
    excl = gpd.read_file(gis, layer="excluded_ndmc_cantonment").to_crs(sl.CRS)
    ch = gpd.read_file(gis, layer="existing_chargers")
    four = ch["is_4w"].fillna(0).astype(bool)
    pieces = gpd.read_file(sl.DEMAND, layer="demand_pieces")
    transit = gpd.read_file(sl.DEMAND, layer="transit_nodes")
    inside = transit[transit.to_crs(sl.CRS).within(B["study_geom"])]
    kind = next(c for c in transit.columns if c in ("kind", "type", "node_type", "category"))
    return {
        "wards": int(len(wards)),
        "population_census2011": int(wm["population"].sum()),
        "study_area_km2": round(float(study.to_crs(sl.CRS).area.sum() / 1e6), 2),
        "excluded_area_km2": round(float(excl.area.sum() / 1e6), 2),
        "demand_cells": int(len(d)),
        "demand_pieces": int(len(pieces)),
        "demand_weight_sum": round(float(w.sum()), 3),
        "lambda": 0.6,
        "chargers_total": int(len(ch)),
        "chargers_by_source": {k: int(v) for k, v in ch["source"].value_counts().items()} if "source" in ch else None,
        "chargers_in_study_area": int(ch["in_study_area"].astype(bool).sum()),
        "chargers_4w_flagged": int(four.sum()),
        "chargers_4w_in_study_area": int((four & ch["in_study_area"].astype(bool)).sum()),
        "existing4w_in_explorer": int(len(B["existing_4w"])),
        "ev_cars_vahan": int(round(wm["ev_cars"].sum())),
        "ev_taxis_vahan": int(round(wm["ev_taxis"].sum())),
        "ev_4w_vahan": int(round(wm["ev_4w_demand"].sum())),
        "transit_in_study_area": {k: int(v) for k, v in inside[kind].value_counts().items()},
        "mclp_radius_m": 2100,
        "mclp_tiebreak_m": 1000,
    }


F = facts()
print(json.dumps(F, indent=1))
if args.facts_only:
    OUT_FACTS.write_text(json.dumps(F, indent=1) + "\n")
    print(f"wrote {OUT_FACTS}")
    sys.exit()

SRC = HERE / "explorer_data.json"
old = json.loads(SRC.read_text()) if SRC.exists() else None

# --- grid layouts --------------------------------------------------------------------------------------------
grids = {}
for s in [1, 1.5, 2, 2.5, 3, 4, 5]:
    st, cells = sl.grid_model(B, s)
    b = np.array([g.bounds for g in cells.geometry])
    grids[str(s)] = {"size_km": s, "n": len(st),
                     "stations": [r10(p) for p in sl.xy(st)],
                     "cells": [[int(round(x0)), int(round(y0)), int(bool(q))] for (x0, y0, _, _), q in zip(b, cells["station"])]}
    print(f"grid {s} km: {len(st)} stations")

budgets = sorted(set([50, 60, 70, 80, 90, 104, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 224, 250, 275, 300, 350, 400]
                     + [g["n"] for g in grids.values() if 40 <= g["n"] <= 420]))

# --- K-means and MCLP ----------------------------------------------------------------------------------------
A21, A10 = sl.within_pairs(X, X, 2100), sl.within_pairs(X, X, 1000)
kmeans, mclp = {}, {}
for k in budgets:
    t0 = time.time()
    C, _ = sl.kmeans(X, w, k, n_init=10)
    kmeans[str(k)] = [r10(p) for p in C]
    if args.resolve_mclp or old is None or str(k) not in old["mclp"]:
        o, _ = sl.mclp(w, A21, k, A10, time_limit=args.mclp_time_limit)
        mclp[str(k)] = [r10(p) for p in X[o]]
        src = "re-solved"
    else:
        mclp[str(k)] = old["mclp"][str(k)]
        src = "kept"
    print(f"k={k}: {time.time() - t0:.0f}s, MCLP {src}")

# --- background layers ---------------------------------------------------------------------------------------
ix = d["cell_id"].str.extract(r"c(\d+)_(\d+)").astype(int).to_numpy()
cells = [[int(a), int(b_), round(float(wt), 4), int(round(p)), round(float(ar), 3), *r10(pt)]
         for (a, b_), wt, p, ar, pt in zip(ix, w, d["pop_alloc"], d["area_km2"], X)]
outline = shapely.simplify(B["study_geom"], 120)
rings = []
for poly in getattr(outline, "geoms", [outline]):
    rings.append([r10(c) for c in poly.exterior.coords])
    rings += [[r10(c) for c in hole.coords] for hole in poly.interiors]
cs = gpd.read_file("outputs/siting_all_layouts_v1.gpkg", layer="consensus_sites")
consensus = [[*r10(p), int(bool(a)), int(bool(rb))] for p, a, rb in zip(sl.xy(cs), cs["all_three_1km"], cs["robust_all"])]

data = {"cells": cells, "outline": rings, "grids": grids, "budgets": budgets, "kmeans": kmeans, "mclp": mclp,
        "existing4w": [r10(p) for p in sl.xy(B["existing_4w"])], "consensus": consensus,
        "notes": {"mclp_candidates": "1,570 1 km cell centres", "radius_m": 2100, "crs": "EPSG:32643"}}
OUT_DATA.write_text(json.dumps(data, separators=(",", ":")))
OUT_FACTS.write_text(json.dumps(F, indent=1) + "\n")
print(f"wrote {OUT_DATA} ({OUT_DATA.stat().st_size / 1e6:.2f} MB) and {OUT_FACTS}")
