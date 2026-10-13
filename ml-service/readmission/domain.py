"""Model applicability domain: how similar an encounter is to the training data.

Bounds are computed at training time (train.py) and stored in model_meta.json;
the service checks every request against them. Outside the domain no prediction is made.
"""
from .features import EXCLUDED_DISCHARGE_IDS, ID_INPUTS, NUMERIC_INPUTS

MAX_AGE = 99  # the oldest age group in the data is [90-100)


def compute_domain(X):
    return {
        "numeric_ranges": {c: [int(X[c].min()), int(X[c].max())] for c in NUMERIC_INPUTS},
        "known_codes": {c: sorted(int(v) for v in X[c].dropna().unique()) for c in ID_INPUTS},
        "known_specialties": sorted(X["medical_specialty"].dropna().unique().tolist()),
        "max_age": MAX_AGE,
    }


def _reason(field, code, message):
    return {"field": field, "code": code, "message": message}


def check_domain(record, domain):
    """record: dict with INPUT_COLUMNS fields. Returns the reasons why no prediction is made."""
    reasons = []
    for field, codes in domain["known_codes"].items():
        value = record.get(field)
        if value is None:
            continue
        if field == "discharge_disposition_id" and value in EXCLUDED_DISCHARGE_IDS:
            reasons.append(_reason(field, "excluded_discharge",
                                   "Patient expired or was discharged to hospice; readmission is not predicted."))
        elif int(value) not in codes:
            reasons.append(_reason(field, "unknown_code", f"Code {value} does not occur in the training data."))

    for field, (lo, hi) in domain["numeric_ranges"].items():
        value = record.get(field)
        if value is not None and not lo <= value <= hi:
            reasons.append(_reason(field, "out_of_range",
                                   f"Value {value} is outside the training data range ({lo}-{hi})."))

    age = record.get("age")
    if isinstance(age, (int, float)) and age > domain["max_age"]:
        reasons.append(_reason("age", "out_of_range",
                               f"Age {age} is outside the training data range (0-{domain['max_age']})."))
    return reasons
