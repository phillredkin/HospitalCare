import numpy as np
import pandas as pd

from .features import INPUT_COLUMNS

MIN_IMPACT = 0.005

FIELD_LABELS = {
    "age": "Age",
    "gender": "Gender",
    "admission_type_id": "Admission type",
    "discharge_disposition_id": "Discharge disposition",
    "admission_source_id": "Admission source",
    "medical_specialty": "Attending physician specialty",
    "time_in_hospital": "Length of stay (days)",
    "num_lab_procedures": "Number of lab tests",
    "num_procedures": "Number of procedures",
    "num_medications": "Number of medications",
    "number_outpatient": "Outpatient visits in the year before admission",
    "number_emergency": "Emergency visits in the year before admission",
    "number_inpatient": "Hospitalizations in the year before admission",
    "number_diagnoses": "Number of diagnoses",
    "diag_1": "Primary diagnosis",
    "diag_2": "Secondary diagnosis",
    "diag_3": "Additional diagnosis",
    "max_glu_serum": "Serum glucose",
    "A1Cresult": "HbA1c",
    "change": "Change in diabetes medication",
    "diabetesMed": "Diabetes medication",
}


def _plain(value):
    if pd.isna(value):
        return None
    return value.item() if hasattr(value, "item") else value


def explain(model, background, records, top_k=3):
    X = pd.DataFrame(records).reindex(columns=INPUT_COLUMNS).reset_index(drop=True)
    bg = background.reindex(columns=INPUT_COLUMNS).reset_index(drop=True)
    p = model.predict_proba(X)[:, 1]

    counts = [bg[field].value_counts(dropna=False) for field in INPUT_COLUMNS]
    sizes = [len(c) for c in counts]
    weights = np.concatenate([c.to_numpy() / len(bg) for c in counts])
    field_of_row = np.repeat(np.arange(len(INPUT_COLUMNS)), sizes)

    results = []
    for i in range(len(X)):
        blocks = []
        for field, c in zip(INPUT_COLUMNS, counts):
            block = X.iloc[[i] * len(c)].reset_index(drop=True)
            block[field] = c.index.to_numpy()
            blocks.append(block)
        p_swapped = model.predict_proba(pd.concat(blocks, ignore_index=True))[:, 1]
        impact = p[i] - np.bincount(field_of_row, weights=p_swapped * weights, minlength=len(INPUT_COLUMNS))

        factors = []
        for j in np.argsort(-impact)[:top_k]:
            if impact[j] < MIN_IMPACT:
                break
            field = INPUT_COLUMNS[j]
            factors.append({
                "field": field,
                "label": FIELD_LABELS.get(field, f"Medication: {field}"),
                "value": _plain(X.at[i, field]),
                "impact": round(float(impact[j]), 4),
            })
        results.append(factors)
    return results
