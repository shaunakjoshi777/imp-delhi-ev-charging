"""Precompute every layout shown on the explorer page and write website/explorer_data.json.

Grid: cell sizes 1-5 km (1% commercial/industrial rule). K-means and MCLP: a range of station counts that includes
every grid count, so the three can be compared at the same number of stations. MCLP picks from the 1,570 1 km cell
centres (R = 2.1 km, tie-break within 1 km). Run from the project folder: .venv/bin/python website/precompute_layouts.py
"""
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import shapely
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))   # project folder, for siting_lib
import siting_lib as sl

OUT = Path("website/explorer_data.json")
B = sl.load_base()
X, w, d = B["X"], B["w"], B["demand"]
r10 = lambda a: [int(round(v / 10) * 10) for v in a]          # 10 m precision keeps the file small

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
print("budgets:", budgets)

# --- K-means and MCLP ----------------------------------------------------------------------------------------
A21, A10 = sl.within_pairs(X, X, 2100), sl.within_pairs(X, X, 1000)
kmeans, mclp = {}, {}
for k in budgets:
    t0 = time.time()
    C, _ = sl.kmeans(X, w, k, n_init=10)
    t1 = time.time()
    o, _ = sl.mclp(w, A21, k, A10, time_limit=90)
    kmeans[str(k)] = [r10(p) for p in C]
    mclp[str(k)] = [r10(p) for p in X[o]]
    print(f"k={k}: kmeans {t1 - t0:.0f}s, mclp {time.time() - t1:.0f}s ({len(o)} sites)")

# --- background layers ---------------------------------------------------------------------------------------
ix = d["cell_id"].str.extract(r"c(\d+)_(\d+)").astype(int).to_numpy()
# [ix, iy, weight, population, area_km2, x, y]: the 1 km square index plus the demand point the models used
cells = [[int(a), int(b_), round(float(wt), 4), int(round(p)), round(float(ar), 3), *r10(pt)]
         for (a, b_), wt, p, ar, pt in zip(ix, w, d["pop_alloc"], d["area_km2"], X)]
outline = shapely.simplify(B["study_geom"], 120)
rings = []
for poly in getattr(outline, "geoms", [outline]):
    rings.append([r10(c) for c in poly.exterior.coords])
    rings += [[r10(c) for c in hole.coords] for hole in poly.interiors]

import geopandas as gpd
cs = gpd.read_file("outputs/siting_all_layouts_v1.gpkg", layer="consensus_sites")
consensus = [[*r10(p), int(bool(a)), int(bool(rb))] for p, a, rb in zip(sl.xy(cs), cs["all_three_1km"], cs["robust_all"])]

data = {"cells": cells, "outline": rings, "grids": grids, "budgets": budgets, "kmeans": kmeans, "mclp": mclp,
        "existing4w": [r10(p) for p in sl.xy(B["existing_4w"])], "consensus": consensus,
        "notes": {"mclp_candidates": "1,570 1 km cell centres", "radius_m": 2100, "crs": "EPSG:32643"}}
OUT.write_text(json.dumps(data, separators=(",", ":")))
print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.2f} MB)")
