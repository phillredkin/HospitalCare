"""Service predicting the risk that a diabetic patient is readmitted within 30 days of discharge.

Run from the ml-service/ folder:
    uvicorn app.main:app --port 8000
API docs: http://localhost:8000/docs
"""
import json
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI
from threadpoolctl import threadpool_limits

from readmission.domain import check_domain
from readmission.explain import explain
from readmission.features import INPUT_COLUMNS, risk_category

from .schemas import PredictRequest, PredictResponse, api_field_name

ARTIFACTS = Path(os.environ.get("MODEL_DIR", Path(__file__).resolve().parent.parent / "artifacts"))
state = {}


@asynccontextmanager
async def lifespan(app):
    state["model"] = joblib.load(ARTIFACTS / "readmission_model.joblib")
    state["background"] = joblib.load(ARTIFACTS / "explainer_background.joblib")
    state["meta"] = json.loads((ARTIFACTS / "model_meta.json").read_text(encoding="utf-8"))
    yield
    state.clear()


app = FastAPI(
    title="HospitalCare ML API",
    version="1.0.0",
    description=(
        "Predicts the risk that a diabetic patient is readmitted to hospital within 30 days of discharge.\n\n"
        "- `status: ok` - prediction made.\n"
        "- `status: unsupported` - input is valid, but outside the range of the training data "
        "(e.g. stay longer than 14 days); no prediction, see `reasons`.\n"
        "- HTTP 422 - invalid input (wrong type, negative number, missing required field)."
    ),
    lifespan=lifespan,
)


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "hospitalcare-ml",
        "model_version": state["meta"]["model_version"],
    }


@app.get("/model-info")
def model_info():
    """Risk thresholds, supported ranges and codes, test metrics."""
    meta = state["meta"]
    return {
        "model_version": meta["model_version"],
        "trained_at": meta["trained_at"],
        "thresholds": meta["thresholds"],
        "domain": meta["domain"],
        "test_metrics": meta["test_metrics"]["hist_gradient_boosting"],
    }


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    meta = state["meta"]
    hospitalization = request.hospitalization
    record = hospitalization.to_model_record()
    response = {
        "request_id": request.request_id,
        "prediction_id": uuid.uuid4(),
        "model_version": meta["model_version"],
        "status": "ok",
        "probability": None,
        "risk_level": None,
        "top_factors": [],
        "reasons": check_domain(record, meta["domain"]),
    }
    if response["reasons"]:
        response["status"] = "unsupported"
        return response

    model = state["model"]
    X = pd.DataFrame([record]).reindex(columns=INPUT_COLUMNS)
    # On small inputs OpenMP multithreading only adds overhead: a single thread is ~5x faster.
    # The OpenMP limit applies to the calling thread, so it is set per request, not at startup.
    with threadpool_limits(1):
        probability = float(model.predict_proba(X)[0, 1])
        explanation = explain(model, state["background"], X)[0]
    values = hospitalization.flat_values()
    factors = []
    for factor in explanation:
        field = api_field_name(factor["field"])
        factors.append({**factor, "field": field, "value": values.get(field)})

    response.update({
        "probability": round(probability, 4),
        "risk_level": risk_category(probability, meta["thresholds"]),
        "top_factors": factors,
    })
    return response
