"""Export the trained models to compact JSON so the demo can run them in the browser."""
import json
from pathlib import Path

import joblib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
M = ROOT / "backend" / "models"
OUT = ROOT / "frontend" / "public" / "models"
OUT.mkdir(parents=True, exist_ok=True)


def tree_arrays(t, unscale=None, leaf=None):
    f = t.feature.tolist()
    th = t.threshold.astype(float)
    if unscale is not None:  # move thresholds back to raw feature units
        mean, scale = unscale
        th = np.array([th[i] * scale[f[i]] + mean[f[i]] if f[i] >= 0 else 0 for i in range(len(f))])
    return {"f": f, "t": [round(float(x), 6) for x in th], "l": t.children_left.tolist(),
            "r": t.children_right.tolist(), "v": [leaf(t, i) if t.children_left[i] == -1 else 0 for i in range(t.node_count)]}


rec = joblib.load(M / "crop_recommender.joblib")
sc, rf = rec.named_steps["scale"], rec.named_steps["model"]


def cls_leaf(t, i):
    v = t.value[i][0]
    v = v / v.sum()
    return [[int(k), round(float(v[k]), 4)] for k in np.nonzero(v)[0]]


rec_json = {"classes": rf.classes_.tolist(),
            "trees": [tree_arrays(e.tree_, (sc.mean_, sc.scale_), cls_leaf) for e in rf.estimators_]}
(OUT / "recommender.json").write_text(json.dumps(rec_json, separators=(",", ":")))

y = joblib.load(M / "yield_predictor.joblib")
pre, dt = y.named_steps["pre"], y.named_steps["model"]
ohe = pre.named_transformers_["cat"]
num = pre.named_transformers_["num"]
y_json = {"cats": [c.tolist() for c in ohe.categories_], "mean": num.mean_.tolist(), "scale": num.scale_.tolist(),
          "tree": tree_arrays(dt.tree_, None, lambda t, i: round(float(t.value[i][0][0]), 2))}
(OUT / "yield.json").write_text(json.dumps(y_json, separators=(",", ":")))

for n in ["metrics.json", "profiles.json"]:
    (OUT / n).write_text((M / n).read_text())

# reference predictions for a JS parity test
import pandas as pd
samples = [dict(N=90, P=42, K=43, temperature=21, humidity=62, ph=6.5, rainfall=110),
           dict(N=20, P=60, K=20, temperature=27, humidity=60, ph=6.8, rainfall=60)]
ref = {"rec": [rec.predict_proba(pd.DataFrame([s]))[0].round(4).tolist() for s in samples], "rec_in": samples}
ys = [dict(Item="Wheat", Area="India", Year=2013, average_rain_fall_mm_per_year=780, pesticides_tonnes=42000, avg_temp=21),
      dict(Item="Rice, paddy", Area="India", Year=2013, average_rain_fall_mm_per_year=1500, pesticides_tonnes=42000, avg_temp=29)]
ref["yield"] = [float(y.predict(pd.DataFrame([s]))[0]) for s in ys]
ref["yield_in"] = ys
(OUT.parent.parent / "parity.json").write_text(json.dumps(ref))
print({p.name: p.stat().st_size for p in OUT.iterdir()})
