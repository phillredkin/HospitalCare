"""Example prediction with the trained model - the FastAPI service calls it the same way.

Run from the ml-service/ folder:
    python predict.py [JSON file with a list of encounters]
"""
import json
import sys
from pathlib import Path

import joblib
import pandas as pd

from readmission.explain import explain
from readmission.features import INPUT_COLUMNS, risk_category

ROOT = Path(__file__).resolve().parent
ARTIFACTS = ROOT / "artifacts"


def load_model():
    model = joblib.load(ARTIFACTS / "readmission_model.joblib")
    background = joblib.load(ARTIFACTS / "explainer_background.joblib")
    meta = json.loads((ARTIFACTS / "model_meta.json").read_text(encoding="utf-8"))
    return model, background, meta


def predict(model, background, meta, records):
    """records: list of dicts with INPUT_COLUMNS fields (missing fields are allowed)."""
    X = pd.DataFrame(records).reindex(columns=INPUT_COLUMNS)
    probs = model.predict_proba(X)[:, 1]
    factors = explain(model, background, X)
    return [
        {
            "probability": round(float(p), 4),
            "risk_level": risk_category(p, meta["thresholds"]),
            "top_factors": f,
        }
        for p, f in zip(probs, factors)
    ]


if __name__ == "__main__":
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "example_input.json"
    records = json.loads(path.read_text(encoding="utf-8"))
    model, background, meta = load_model()
    results = predict(model, background, meta, records)
    print(json.dumps(results, indent=2, ensure_ascii=False))
