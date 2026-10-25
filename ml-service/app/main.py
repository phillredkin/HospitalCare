import json
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from threadpoolctl import threadpool_limits

from readmission.domain import check_domain
from readmission.explain import explain
from readmission.features import INPUT_COLUMNS, risk_category

from .db import Prediction, init_db
from .schemas import PredictRequest, PredictResponse, api_field_name

ARTIFACTS = Path(os.environ.get("MODEL_DIR", Path(__file__).resolve().parent.parent / "artifacts"))
state = {}


@asynccontextmanager
async def lifespan(app):
    state["model"] = joblib.load(ARTIFACTS / "readmission_model.joblib")
    state["background"] = joblib.load(ARTIFACTS / "explainer_background.joblib")
    state["meta"] = json.loads((ARTIFACTS / "model_meta.json").read_text(encoding="utf-8"))
    engine = init_db()
    state["sessions"] = sessionmaker(engine, expire_on_commit=False)
    yield
    engine.dispose()
    state.clear()


app = FastAPI(
    title="HospitalCare ML API",
    version="1.1.0",
    description=(
        "Predicts the risk that a diabetic patient is readmitted to hospital within 30 days of discharge.\n\n"
        "- `status: ok` - prediction made.\n"
        "- `status: unsupported` - input is valid, but outside the range of the training data "
        "(e.g. stay longer than 14 days); no prediction, see `reasons`.\n"
        "- HTTP 422 - invalid input (wrong type, negative number, missing required field).\n\n"
        "Every prediction is stored; fetch it later with `GET /predictions/{prediction_id}`. "
        "Repeating `POST /predict` with the same `request_id` returns the stored prediction."
    ),
    lifespan=lifespan,
)


@app.exception_handler(SQLAlchemyError)
def database_error(request, exc):
    return JSONResponse({"detail": "Database unavailable"}, status_code=503)


@app.get("/health")
def health():
    body = {
        "status": "healthy",
        "service": "hospitalcare-ml",
        "model_version": state["meta"]["model_version"],
        "database": "ok",
    }
    try:
        with state["sessions"]() as session:
            session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        body.update(status="unhealthy", database="unavailable")
        return JSONResponse(body, status_code=503)
    return body


@app.get("/model-info", description="Risk thresholds, supported ranges and codes, test metrics.")
def model_info():
    meta = state["meta"]
    return {
        "model_version": meta["model_version"],
        "trained_at": meta["trained_at"],
        "thresholds": meta["thresholds"],
        "domain": meta["domain"],
        "test_metrics": meta["test_metrics"]["hist_gradient_boosting"],
    }


def make_prediction(request):
    meta = state["meta"]
    hospitalization = request.hospitalization
    record = hospitalization.to_model_record()
    prediction = {
        "prediction_id": uuid.uuid4(),
        "request_id": request.request_id,
        "model_version": meta["model_version"],
        "status": "ok",
        "probability": None,
        "risk_level": None,
        "top_factors": [],
        "reasons": check_domain(record, meta["domain"]),
        "hospitalization": hospitalization.model_dump(mode="json"),
    }
    if prediction["reasons"]:
        prediction["status"] = "unsupported"
        return prediction

    model = state["model"]
    X = pd.DataFrame([record]).reindex(columns=INPUT_COLUMNS)
    with threadpool_limits(1):
        probability = float(model.predict_proba(X)[0, 1])
        explanation = explain(model, state["background"], X)[0]
    values = hospitalization.flat_values()
    factors = []
    for factor in explanation:
        field = api_field_name(factor["field"])
        factors.append({**factor, "field": field, "value": values.get(field)})

    prediction.update({
        "probability": round(probability, 4),
        "risk_level": risk_category(probability, meta["thresholds"]),
        "top_factors": factors,
    })
    return prediction


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    by_request_id = select(Prediction).where(Prediction.request_id == request.request_id)
    with state["sessions"]() as session:
        existing = session.scalar(by_request_id)
        if existing is not None:
            return existing

        row = Prediction(**make_prediction(request))
        session.add(row)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            row = session.scalar(by_request_id)
        return row


@app.get("/predictions/{prediction_id}", response_model=PredictResponse,
         description="Stored prediction by its id (the C# backend keeps only this id in PredictionLinks).",
         responses={404: {"description": "Prediction not found"}})
def get_prediction(prediction_id: uuid.UUID):
    with state["sessions"]() as session:
        row = session.get(Prediction, prediction_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return row
