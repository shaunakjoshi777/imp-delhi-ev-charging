"""Runs the model cells of ev_siting_final.ipynb unchanged, one by one, in the project folder.
Skipped: demand rebuild from OSM, road network, set cover, sensitivity extras. A cell whose last line only displays
a table that needs road distances is allowed to fail after its results are stored."""
import json, pickle, traceback, matplotlib
matplotlib.use("Agg")
G = {"__name__": "__main__"}
for i, src in json.load(open("cells.json")):
    print("### cell", i, flush=True)
    try:
        exec(compile(src, f"cell{i}", "exec"), G)
    except Exception as e:
        print("cell", i, "error (continuing):", repr(e), flush=True)
keys = ["LAYOUTS","cons","cardA","cardB","cs_rows","rad","curve","bud","thr","seeds","eq","kp1","opened","X","w","POP","EVR","E98","E_ALL","G3","K","M","S3","dem","mcv","kcv","TIMES"]
pickle.dump({k: G[k] for k in keys if k in G}, open("state.pkl", "wb"))
print("DONE", flush=True)
