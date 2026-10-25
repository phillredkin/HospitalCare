import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin

EXCLUDED_DISCHARGE_IDS = [11, 13, 14, 19, 20, 21]

MEDICATIONS = [
    "metformin", "repaglinide", "nateglinide", "glimepiride", "glipizide", "glyburide",
    "pioglitazone", "rosiglitazone", "acarbose", "insulin", "glyburide-metformin",
]
NUMERIC_INPUTS = [
    "time_in_hospital", "num_lab_procedures", "num_procedures", "num_medications",
    "number_outpatient", "number_emergency", "number_inpatient", "number_diagnoses",
]
ID_INPUTS = ["admission_type_id", "discharge_disposition_id", "admission_source_id"]
DIAG_INPUTS = ["diag_1", "diag_2", "diag_3"]

CATEGORY_DEFAULTS = {
    "gender": "Unknown",
    "medical_specialty": "Unknown",
    "max_glu_serum": "None",
    "A1Cresult": "None",
    "change": "No",
    "diabetesMed": "No",
}

INPUT_COLUMNS = [
    "age", "gender", *ID_INPUTS, "medical_specialty", *NUMERIC_INPUTS, *DIAG_INPUTS,
    "max_glu_serum", "A1Cresult", *MEDICATIONS, "change", "diabetesMed",
]

CATEGORICAL_FEATURES = [
    "gender", *ID_INPUTS, "medical_specialty", "max_glu_serum", "A1Cresult", "change",
    "diabetesMed", "diag_1_group", "diag_2_group", "diag_3_group", "diag_1_code", *MEDICATIONS,
]
NUMERIC_FEATURES = [
    "age_years", *NUMERIC_INPUTS, "n_visits_prior", "n_meds_active", "n_med_changes",
    "diabetes_any_diag",
]

RISK_LEVELS = ("low", "medium", "high")


def parse_age(value):
    if pd.isna(value):
        return np.nan
    s = str(value).strip()
    try:
        if s.startswith("["):
            return float(s[1:].split("-")[0]) + 5
        return float(int(float(s)) // 10 * 10 + 5)
    except ValueError:
        return np.nan


def icd9_group(code):
    if pd.isna(code) or str(code).strip() in ("", "?"):
        return "Missing"
    s = str(code).strip()
    if s[0] in "VE":
        return "Other"
    try:
        v = float(s)
    except ValueError:
        return "Other"
    if int(v) == 250:
        return "Diabetes"
    if 390 <= v < 460 or int(v) == 785:
        return "Circulatory"
    if 460 <= v < 520 or int(v) == 786:
        return "Respiratory"
    if 520 <= v < 580 or int(v) == 787:
        return "Digestive"
    if 580 <= v < 630 or int(v) == 788:
        return "Genitourinary"
    if 140 <= v < 240:
        return "Neoplasms"
    if 710 <= v < 740:
        return "Musculoskeletal"
    if 800 <= v < 1000:
        return "Injury"
    return "Other"


def icd9_code3(code):
    if pd.isna(code) or str(code).strip() in ("", "?"):
        return "Missing"
    return str(code).strip().split(".")[0]


def _id_to_str(value):
    if pd.isna(value):
        return "Unknown"
    try:
        return str(int(float(value)))
    except (TypeError, ValueError):
        return str(value)


def risk_category(prob, thresholds):
    if prob >= thresholds["high"]:
        return "high"
    if prob >= thresholds["medium"]:
        return "medium"
    return "low"


class FeatureBuilder(BaseEstimator, TransformerMixin):
    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X = pd.DataFrame(X).reindex(columns=INPUT_COLUMNS)
        out = pd.DataFrame(index=X.index)

        out["age_years"] = X["age"].map(parse_age)
        for c in NUMERIC_INPUTS:
            out[c] = pd.to_numeric(X[c], errors="coerce")
        out["n_visits_prior"] = out[["number_outpatient", "number_emergency", "number_inpatient"]].sum(axis=1)

        meds = X[MEDICATIONS].fillna("No").astype(str)
        out["n_meds_active"] = (meds != "No").sum(axis=1)
        out["n_med_changes"] = meds.isin(["Up", "Down"]).sum(axis=1)

        for c in DIAG_INPUTS:
            out[f"{c}_group"] = X[c].map(icd9_group)
        out["diabetes_any_diag"] = (out[[f"{c}_group" for c in DIAG_INPUTS]] == "Diabetes").any(axis=1).astype(int)
        out["diag_1_code"] = X["diag_1"].map(icd9_code3)

        for c in ID_INPUTS:
            out[c] = X[c].map(_id_to_str)
        for c, default in CATEGORY_DEFAULTS.items():
            out[c] = X[c].fillna(default).astype(str)
        for c in MEDICATIONS:
            out[c] = meds[c]

        return out[CATEGORICAL_FEATURES + NUMERIC_FEATURES]
