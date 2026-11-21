import math

from .features import MEDICATIONS

RISK_RANK = {"low": 0, "medium": 1, "high": 2}
COST_RANK = {"low": 0, "medium": 1, "high": 2}
MANY_MEDICATIONS = 20
FREQUENT_VISITS = 2

MEASURES = {
    "care_coordinator": {
        "action": "Assign a care coordinator for 30 days after discharge (home visit, appointments, social support)",
        "cost": "high",
        "min_risk": "high",
        "when": "High risk and 2+ hospitalizations or emergency visits in the previous year",
    },
    "follow_up_visit": {
        "action": "Book an outpatient visit with the attending physician",
        "cost": "medium",
        "min_risk": "medium",
        "when": "Medium or high risk; within 7 days for high risk, 14 days for medium",
    },
    "medication_review": {
        "action": "Pharmacist review of the medication list before discharge",
        "cost": "medium",
        "min_risk": "medium",
        "when": f"Medium or high risk and diabetes medication changed or {MANY_MEDICATIONS}+ medications",
    },
    "diabetes_specialist": {
        "action": "Refer to a diabetes specialist to adjust the treatment",
        "cost": "medium",
        "min_risk": "low",
        "when": "HbA1c >8 or glucose >300 at any risk; HbA1c >7 or glucose >200 at medium or high risk",
    },
    "follow_up_call": {
        "action": "Nurse phone call to check symptoms, glucose and medication use",
        "cost": "low",
        "min_risk": "medium",
        "when": "Medium or high risk; within 2 days for high risk, 3 days for medium",
    },
    "discharge_education": {
        "action": "Discharge instructions and diabetes self-care education",
        "cost": "low",
        "min_risk": "low",
        "when": "Every patient",
    },
}


def _number(record, field):
    try:
        value = float(record.get(field))
    except (TypeError, ValueError):
        return 0
    return 0 if math.isnan(value) else value


def _patient_triggers(record):
    triggers = {}
    inpatient = _number(record, "number_inpatient")
    emergency = _number(record, "number_emergency")
    if inpatient >= FREQUENT_VISITS:
        triggers["frequent_admissions"] = f"{inpatient:.0f} hospitalizations in the previous year"
    if emergency >= FREQUENT_VISITS:
        triggers["frequent_emergency"] = f"{emergency:.0f} emergency visits in the previous year"

    a1c, glucose = record.get("A1Cresult"), record.get("max_glu_serum")
    if a1c == ">8" or glucose == ">300":
        triggers["poor_glucose_control"] = f"HbA1c {a1c}" if a1c == ">8" else f"Serum glucose {glucose}"
    elif a1c == ">7" or glucose == ">200":
        triggers["elevated_glucose"] = f"HbA1c {a1c}" if a1c == ">7" else f"Serum glucose {glucose}"

    if record.get("change") == "Ch" or any(record.get(m) in ("Up", "Down") for m in MEDICATIONS):
        triggers["medication_change"] = "Diabetes medication changed during the stay"
    medications = _number(record, "num_medications")
    if medications >= MANY_MEDICATIONS:
        triggers["many_medications"] = f"{medications:.0f} medications during the stay"
    return triggers


def recommend(record, probability, risk_level):
    rank = RISK_RANK[risk_level]
    patient = _patient_triggers(record)
    risk_trigger = f"{risk_level}_risk"
    risk_text = f"{risk_level.capitalize()} risk of readmission ({probability:.0%})"
    result = []

    def add(code, deadline_days, triggers, reasons):
        measure = MEASURES[code]
        result.append({
            "code": code,
            "action": measure["action"],
            "priority": risk_level,
            "deadline_days": deadline_days,
            "cost": measure["cost"],
            "triggers": triggers,
            "reason": "; ".join(reasons),
        })

    def matched(*codes):
        found = [c for c in codes if c in patient]
        return found, [patient[c] for c in found]

    if rank == 2:
        found, texts = matched("frequent_admissions", "frequent_emergency")
        if found:
            add("care_coordinator", 0, [risk_trigger, *found], [risk_text, *texts])
    if rank >= 1:
        add("follow_up_call", 2 if rank == 2 else 3, [risk_trigger], [risk_text])
        add("follow_up_visit", 7 if rank == 2 else 14, [risk_trigger], [risk_text])
        found, texts = matched("medication_change", "many_medications")
        if found:
            add("medication_review", 0, [risk_trigger, *found], texts)

    found, texts = matched("poor_glucose_control")
    if not found and rank >= 1:
        found, texts = matched("elevated_glucose")
    if found:
        add("diabetes_specialist", 14 if rank == 2 else 30, found, texts)

    add("discharge_education", 0, [risk_trigger], ["Recommended for every patient at discharge"])

    result.sort(key=lambda r: (r["deadline_days"], -COST_RANK[r["cost"]]))
    return result
