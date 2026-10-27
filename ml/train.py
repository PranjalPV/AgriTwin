"""Train the two AgriTwin models and write metrics + crop profiles.

Usage:  python ml/train.py
Outputs (backend/models/):
  crop_recommender.joblib   RandomForest pipeline   (N,P,K,temperature,humidity,ph,rainfall -> crop)
  yield_predictor.joblib    DecisionTree pipeline   (Item,Area,Year,rain,pesticides,temp -> hg/ha)
  metrics.json              every compared model + chosen one (use this table in the report)
  profiles.json             per-crop India median yields (benchmark for the twin)
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (accuracy_score, f1_score, mean_absolute_error, mean_squared_error,
                             precision_score, r2_score, recall_score)
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "backend" / "models"
OUT.mkdir(parents=True, exist_ok=True)
SEED = 42

REC_FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
YIELD_CAT = ["Item", "Area"]
YIELD_NUM = ["Year", "average_rain_fall_mm_per_year", "pesticides_tonnes", "avg_temp"]


def train_recommender() -> dict:
    df = pd.read_csv(DATA / "crop_recommendation.csv")
    X, y = df[REC_FEATURES], df["label"]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=SEED, stratify=y)

    candidates = {
        "Random Forest": RandomForestClassifier(n_estimators=300, random_state=SEED),
        "Decision Tree": DecisionTreeClassifier(random_state=SEED),
        "Logistic Regression": LogisticRegression(max_iter=3000),
        "K-Nearest Neighbors": KNeighborsClassifier(n_neighbors=5),
        "Gaussian Naive Bayes": GaussianNB(),
        "SVM (RBF)": SVC(probability=True, random_state=SEED),
    }
    results, fitted = [], {}
    for name, est in candidates.items():
        pipe = Pipeline([("scale", StandardScaler()), ("model", est)])
        pipe.fit(Xtr, ytr)
        p = pipe.predict(Xte)
        results.append({
            "model": name,
            "accuracy": round(accuracy_score(yte, p), 4),
            "precision": round(precision_score(yte, p, average="macro"), 4),
            "recall": round(recall_score(yte, p, average="macro"), 4),
            "f1": round(f1_score(yte, p, average="macro"), 4),
        })
        fitted[name] = pipe
        print(f"[rec] {name:22s} acc={results[-1]['accuracy']:.4f} f1={results[-1]['f1']:.4f}")

    chosen = "Random Forest"
    model = fitted[chosen]
    joblib.dump(model, OUT / "crop_recommender.joblib")
    importance = dict(zip(REC_FEATURES, model.named_steps["model"].feature_importances_.round(4).tolist()))

    # per-crop ideal conditions (means) for the UI
    ideals = df.groupby("label")[REC_FEATURES].mean().round(1).to_dict(orient="index")
    return {"chosen": chosen, "results": results, "importance": importance,
            "test_size": len(Xte), "classes": sorted(y.unique().tolist()), "ideals": ideals}


def train_yield() -> tuple[dict, dict]:
    df = pd.read_csv(DATA / "yield_df.csv").drop(columns=["Unnamed: 0"])
    X, y = df[YIELD_CAT + YIELD_NUM], df["hg/ha_yield"]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=SEED)

    def pre():
        return ColumnTransformer([
            ("cat", OneHotEncoder(handle_unknown="ignore"), YIELD_CAT),
            ("num", StandardScaler(), YIELD_NUM),
        ])

    candidates = {
        "Decision Tree": DecisionTreeRegressor(random_state=SEED),
        "Random Forest": RandomForestRegressor(n_estimators=150, random_state=SEED, n_jobs=-1),
        "Gradient Boosting": GradientBoostingRegressor(random_state=SEED),
        "K-Nearest Neighbors": KNeighborsRegressor(n_neighbors=5),
        "Linear Regression": LinearRegression(),
    }
    results, fitted = [], {}
    for name, est in candidates.items():
        pipe = Pipeline([("pre", pre()), ("model", est)])
        pipe.fit(Xtr, ytr)
        p = pipe.predict(Xte)
        results.append({
            "model": name,
            "r2": round(r2_score(yte, p), 4),
            "mae": round(mean_absolute_error(yte, p), 1),
            "rmse": round(float(np.sqrt(mean_squared_error(yte, p))), 1),
        })
        fitted[name] = pipe
        print(f"[yield] {name:20s} r2={results[-1]['r2']:.4f} mae={results[-1]['mae']:.0f}")

    chosen = "Decision Tree"
    joblib.dump(fitted[chosen], OUT / "yield_predictor.joblib")

    # ---- crop profiles for the twin-state engine ----
    profiles = {}
    india = df[df.Area == "India"]
    for crop, g in df.groupby("Item"):
        gi = india[india.Item == crop]
        profiles[crop] = {
            "india_median_hg": float(gi["hg/ha_yield"].median()) if len(gi) else float(g["hg/ha_yield"].median()),
            "global_median_hg": float(g["hg/ha_yield"].median()),
        }

    meta = {
        "chosen": chosen, "results": results, "test_size": len(Xte),
        "crops": sorted(df.Item.unique().tolist()),
        "countries": sorted(df.Area.unique().tolist()),
        "india_defaults": {
            "pesticides": float(india.pesticides_tonnes.median()),
            "annual_rainfall": float(india.average_rain_fall_mm_per_year.median()),
            "year": int(df.Year.max()),
        },
    }
    return meta, profiles


if __name__ == "__main__":
    rec = train_recommender()
    yld, profiles = train_yield()
    (OUT / "metrics.json").write_text(json.dumps({"recommendation": rec, "yield": yld}, indent=2))
    (OUT / "profiles.json").write_text(json.dumps(profiles, indent=2))
    print("\nSaved models + metrics to", OUT)
