"""Turn the notebook's results (state.pkl from run_nb.py) into data/explorer_data.json for the website.
Nothing here moves a station: every position comes from the notebook's LAYOUTS."""
import json, pickle, sys
import numpy as np, pandas as pd, geopandas as gpd, shapely
from pyproj import Transformer
from scipy.spatial import cKDTree

OUT = sys.argv[1] if len(sys.argv) > 1 else "explorer_data.json"
S = pickle.load(open("state.pkl", "rb"))
L, dem, X, w, POP = S["LAYOUTS"], S["dem"], S["X"], S["w"], S["POP"]
CRS = "EPSG:32643"
tr = Transformer.from_crs(CRS, "EPSG:4326", always_xy=True)

wards = gpd.read_file("Final Data/delhi_ev_gis_v1.gpkg", layer="wards").to_crs(CRS)[["ward_no", "ward_name", "geometry"]]
ward_names = wards.set_index("ward_no")["ward_name"].to_dict()
study = gpd.read_file("Final Data/delhi_ev_gis_v1.gpkg", layer="study_area").to_crs(CRS)
geom = shapely.make_valid(study.union_all())

# origin: lower-left of the study area, km units, y up (the page flips it)
x0, y0, x1, y1 = geom.bounds
OX, OY = np.floor(x0 / 1000) * 1000, np.floor(y0 / 1000) * 1000
def k(v, o): return round((v - o) / 1000, 3)

def ward_of(P):
    g = gpd.GeoDataFrame(geometry=gpd.points_from_xy(P[:, 0], P[:, 1]), crs=CRS)
    j = gpd.sjoin(g, wards, predicate="within", how="left")
    j = j[~j.index.duplicated()]
    miss = j["ward_no"].isna()
    if miss.any():   # on a ward edge: nearest ward
        n = gpd.sjoin_nearest(g[miss], wards, how="left")
        j.loc[miss, "ward_no"] = n[~n.index.duplicated()]["ward_no"]
    return j["ward_no"].astype(int).to_numpy()

def stations(P, prefix, existing=None):
    P = np.asarray(P)
    lon, lat = tr.transform(P[:, 0], P[:, 1])
    wn = ward_of(P)
    rows = []
    for i, (p, lo, la, wd) in enumerate(zip(P, lon, lat, wn)):
        rows.append({"id": f"{prefix}-{i + 1:03d}", "x": k(p[0], OX), "y": k(p[1], OY),
                     "lat": round(float(la), 5), "lon": round(float(lo), 5), "ward": int(wd)})
    return rows

# outline as SVG path in km (y up)
def ring(r): return "M" + "L".join(f"{k(x, OX)},{k(y, OY)}" for x, y in r.coords) + "Z"
g2 = geom.simplify(25)
outline = "".join(ring(r) for p in getattr(g2, "geoms", [g2]) for r in [p.exterior, *p.interiors])

# demand cells: 1 km squares from cell_id grid index
ix = dem["cell_id"].str.extract(r"c(-?\d+)_(-?\d+)").astype(int).to_numpy()
cells = [[k(a * 1000, OX), k(b * 1000, OY), round(float(cx), 3), round(float(cy), 3), round(float(wt), 4), round(float(pp)), round(float(ar), 4), int(wd)]
         for (a, b), cx, cy, wt, pp, ar, wd in zip(ix, (X[:, 0] - OX) / 1000, (X[:, 1] - OY) / 1000, w, POP, dem["area_km2"], dem["ward_no"])]

E98 = S["E98"]
lay = {}
def add(key, scen, method, P, count_label, **kw):
    pref = scen + "-" + {"grid": "GR", "kmeans": "KM", "mclp": "MC"}[method]   # e.g. A-KM-001, numbered in the notebook's station order
    lay[key] = {"scenario": scen, "method": method, "count": count_label, **kw, "stations": stations(P, pref)}

add("A_grid_104", "A", "grid", L["A_grid_3km"], 104, grid_km=3)
add("A_grid_157", "A", "grid", L["A_grid_2km"], 157, grid_km=2)
add("A_grid_404", "A", "grid", L["A_grid_1km"], 404, grid_km=1)
add("A_kmeans_104", "A", "kmeans", S["K"], 104)          # main run (20 restarts), as in the scorecard
for b in [157, 178, 206, 404]:
    add(f"A_kmeans_{b}", "A", "kmeans", L[f"A_kmeans_{b}"], b)
add("A_mclp_104_c206", "A", "mclp", L["A_mclp_104_c3km"], 104, candidates=206, radius=2100)
add("A_mclp_104_c206_R1500", "A", "mclp", L["A_mclp_104_R1500"], 104, candidates=206, radius=1500)
add("A_mclp_104_c206_R3000", "A", "mclp", L["A_mclp_104_R3000"], 104, candidates=206, radius=3000)
add("A_mclp_104_c1570", "A", "mclp", L["A_mclp_104_c1km"], 104, candidates=1570, radius=2100)
for b in [157, 178, 206, 404]:
    add(f"A_mclp_{b}_c1570", "A", "mclp", L[f"A_mclp1km_{b}"], b, candidates=1570, radius=2100)
add("B_grid_59", "B", "grid", L["B_grid_59new"], 59, grid_km=3)
add("B_kmeans_59", "B", "kmeans", L["B_k-means_59new"], 59)
add("B_mclp_59", "B", "mclp", L["B_mclp_59new"], 59, candidates=206, radius=2100)
add("B_kmeans_104", "B", "kmeans", L["B_k-means_104new"], 104)
add("B_mclp_104", "B", "mclp", L["B_mclp_104new"], 104, candidates=206, radius=2100)

# shared sites (rule of notebook cell 63): a grid station (3 km) that MCLP on the 206 grid points also opens and that has
# a K-means station (104) within 1 km. The notebook works this out at 2.1 km, with a stability test from its repeated runs.
# The same rule is applied to the notebook's 1.5 km and 3 km MCLP layouts; those have no stability test.
from scipy.spatial import cKDTree
cons = S["cons"]; G3, K = S["G3"], S["K"]
def near(A, B_): return cKDTree(B_).query(A)[0]
shared = {}
for R_, key in [(2100, "A_mclp_104_c3km"), (1500, "A_mclp_104_R1500"), (3000, "A_mclp_104_R3000")]:
    Mr = L[key]; gm = near(G3, Mr) < 1; dk = near(G3, K)
    sel = gm & (dk <= 1000)
    P = G3[sel]; rows = stations(P, "SH")
    for s_, i in zip(rows, np.flatnonzero(sel)):
        s_["kmeans_dist_m"] = round(float(dk[i]))
        if R_ == 2100:
            s_["stable"] = bool(cons.loc[i, "robust_all"]); s_["ward"] = int(cons.loc[i, "ward_no"])
        else:
            s_["stable"] = None
    shared[str(R_)] = rows
assert len(shared["2100"]) == int(cons.all_three_1km.sum())
ex = stations(E98, "EX")

data = {
    "meta": {"source": "ev_siting_final.ipynb (run of its model cells; see export_site_data.py)",
             "crs": CRS, "origin_utm": [OX, OY], "units": "km",
             "weight_sum": round(float(w.sum()), 3), "cells": len(cells),
             "shared_rule": "Scenario A, 104 stations, MCLP on the 206 grid points: grid site also opened by MCLP and with a K-means station within 1 km",
             "stable_rule": "2.1 km only: also reopened in repeated runs with changed demand weights: K-means at least 50% of runs, MCLP at least 80%"},
    "outline": outline, "wards": {int(a): b for a, b in ward_names.items()},
    "cells": cells, "existing": ex, "layouts": lay, "shared": shared,
}
json.dump(data, open(OUT, "w"), separators=(",", ":"))
print("layouts", {k_: len(v["stations"]) for k_, v in lay.items()})
print("shared", {k_: (len(v), sum(bool(x["stable"]) for x in v)) for k_, v in shared.items()})
