import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import sklearn
from sklearn.calibration import calibration_curve
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    PrecisionRecallDisplay, RocCurveDisplay, average_precision_score, brier_score_loss,
    precision_score, recall_score, roc_auc_score,
)
from sklearn.model_selection import (
    GroupShuffleSplit, RandomizedSearchCV, StratifiedGroupKFold, cross_val_score,
)
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, OrdinalEncoder, StandardScaler

from readmission.domain import compute_domain
from readmission.explain import explain
from readmission.features import (
    CATEGORICAL_FEATURES, DIAG_INPUTS, EXCLUDED_DISCHARGE_IDS, INPUT_COLUMNS, NUMERIC_FEATURES,
    RISK_LEVELS, FeatureBuilder, risk_category,
)

ROOT = Path(__file__).resolve().parent
DATASET_URL = "https://archive.ics.uci.edu/dataset/296/diabetes+130-us+hospitals+for+years+1999-2008"
ARTIFACTS = ROOT / "artifacts"
REPORTS = ROOT / "reports"
RANDOM_STATE = 42
N_SEARCH_ITER = 20
N_BACKGROUND = 100

PARAM_SPACE = {
    "model__learning_rate": [0.03, 0.05, 0.1],
    "model__max_leaf_nodes": [15, 31, 63],
    "model__min_samples_leaf": [20, 50, 100, 200],
    "model__l2_regularization": [0.0, 0.1, 1.0, 10.0],
}


def load_data(path):
    df = pd.read_csv(path, na_values=["?"], keep_default_na=False,
                     dtype={c: str for c in DIAG_INPUTS}, low_memory=False)
    df = df[~df["discharge_disposition_id"].isin(EXCLUDED_DISCHARGE_IDS)]
    df = df[df["gender"] != "Unknown/Invalid"]
    return df.reset_index(drop=True)


def make_logreg():
    prep = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="infrequent_if_exist", min_frequency=30), CATEGORICAL_FEATURES),
        ("num", make_pipeline(SimpleImputer(strategy="median"), FunctionTransformer(np.log1p), StandardScaler()),
         NUMERIC_FEATURES),
    ])
    return Pipeline([("features", FeatureBuilder()), ("prep", prep), ("model", LogisticRegression(max_iter=3000))])


def make_hgb():
    encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=np.nan,
                             min_frequency=30, max_categories=60)
    prep = ColumnTransformer([
        ("cat", encoder, CATEGORICAL_FEATURES),
        ("num", "passthrough", NUMERIC_FEATURES),
    ])
    is_categorical = [True] * len(CATEGORICAL_FEATURES) + [False] * len(NUMERIC_FEATURES)
    model = HistGradientBoostingClassifier(
        categorical_features=is_categorical, max_iter=500, early_stopping=True,
        validation_fraction=0.1, n_iter_no_change=30, random_state=RANDOM_STATE,
    )
    return Pipeline([("features", FeatureBuilder()), ("prep", prep), ("model", model)])


def evaluate(y, p, thresholds):
    y, p = np.asarray(y), np.asarray(p)
    top10 = np.argsort(-p)[: len(p) // 10]
    metrics = {
        "roc_auc": roc_auc_score(y, p),
        "pr_auc": average_precision_score(y, p),
        "brier": brier_score_loss(y, p),
        "base_rate": y.mean(),
        "top10pct_rate": y[top10].mean(),
    }
    for level in ("medium", "high"):
        pred = p >= thresholds[level]
        metrics[f"precision_at_{level}"] = precision_score(y, pred, zero_division=0)
        metrics[f"recall_at_{level}"] = recall_score(y, pred, zero_division=0)
    return {k: round(float(v), 4) for k, v in metrics.items()}


def risk_table(y, p, thresholds):
    y = np.asarray(y)
    levels = np.array([risk_category(pi, thresholds) for pi in p])
    table = {}
    for level in RISK_LEVELS:
        mask = levels == level
        table[level] = {
            "count": int(mask.sum()),
            "share": round(float(mask.mean()), 4),
            "readmitted_rate": round(float(y[mask].mean()), 4) if mask.any() else None,
        }
    return table


def _save(fig, name):
    fig.tight_layout()
    fig.savefig(REPORTS / name, dpi=150)
    plt.close(fig)


def save_plots(y, probs, importance):
    REPORTS.mkdir(parents=True, exist_ok=True)
    y = np.asarray(y)

    fig, ax = plt.subplots(figsize=(6, 5))
    for name, p in probs.items():
        RocCurveDisplay.from_predictions(y, p, name=name, ax=ax)
    ax.plot([0, 1], [0, 1], "--", color="grey", lw=1)
    ax.set_title("ROC: readmission within 30 days")
    _save(fig, "roc.png")

    fig, ax = plt.subplots(figsize=(6, 5))
    for name, p in probs.items():
        PrecisionRecallDisplay.from_predictions(y, p, name=name, ax=ax)
    ax.axhline(y.mean(), ls="--", color="grey", lw=1)
    ax.set_title("Precision-Recall")
    _save(fig, "precision_recall.png")

    fig, ax = plt.subplots(figsize=(6, 5))
    for name, p in probs.items():
        frac_pos, mean_pred = calibration_curve(y, p, n_bins=10, strategy="quantile")
        ax.plot(mean_pred, frac_pos, "o-", label=name)
    upper = max(ax.get_xlim()[1], ax.get_ylim()[1])
    ax.plot([0, upper], [0, upper], "--", color="grey", lw=1, label="Perfect calibration")
    ax.set_xlabel("Predicted probability")
    ax.set_ylabel("Observed readmission rate (< 30 days)")
    ax.set_title("Calibration")
    ax.legend()
    _save(fig, "calibration.png")

    fig, ax = plt.subplots(figsize=(7, 6))
    top = importance.head(15).iloc[::-1]
    ax.barh(top.index, top.values)
    ax.set_xlabel("Drop in ROC-AUC when the field is shuffled")
    ax.set_title("Input field importance (permutation importance)")
    _save(fig, "feature_importance.png")


def _to_builtin(o):
    return o.item() if hasattr(o, "item") else str(o)


def main():
    data_path = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "diabetic_data.csv"
    if not data_path.exists():
        sys.exit(f"Dataset not found: {data_path}\nDownload it from {DATASET_URL} and put diabetic_data.csv there.")
    df = load_data(data_path)
    X = df[INPUT_COLUMNS]
    y = (df["readmitted"] == "<30").astype(int)
    groups = df["patient_nbr"]
    print(f"Encounters: {len(df)}, patients: {groups.nunique()}, readmitted < 30 days: {y.mean():.3f}")

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=RANDOM_STATE)
    train_idx, test_idx = next(splitter.split(X, y, groups))
    X_tr, X_te = X.iloc[train_idx], X.iloc[test_idx]
    y_tr, y_te = y.iloc[train_idx], y.iloc[test_idx]
    g_tr = groups.iloc[train_idx]
    cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)

    print("\n[1/3] Logistic regression (baseline)")
    logreg = make_logreg()
    lr_cv = cross_val_score(logreg, X_tr, y_tr, groups=g_tr, cv=cv, scoring="roc_auc")
    logreg.fit(X_tr, y_tr)
    print(f"  CV ROC-AUC: {lr_cv.mean():.4f} +- {lr_cv.std():.4f}")

    print(f"\n[2/3] HistGradientBoosting: hyperparameter search ({N_SEARCH_ITER} candidates x 5 folds)")
    search = RandomizedSearchCV(make_hgb(), PARAM_SPACE, n_iter=N_SEARCH_ITER, scoring="roc_auc",
                                cv=cv, random_state=RANDOM_STATE, verbose=1)
    search.fit(X_tr, y_tr, groups=g_tr)
    model = search.best_estimator_
    print(f"  CV ROC-AUC: {search.best_score_:.4f}")
    print(f"  Parameters: {search.best_params_}")

    base_rate = float(y_tr.mean())
    thresholds = {"medium": round(base_rate, 2), "high": round(2 * base_rate, 2)}

    print("\n[3/3] Evaluation on the held-out 20% of patients")
    p_hgb = model.predict_proba(X_te)[:, 1]
    p_lr = logreg.predict_proba(X_te)[:, 1]
    metrics = {
        "hist_gradient_boosting": evaluate(y_te, p_hgb, thresholds),
        "logistic_regression": evaluate(y_te, p_lr, thresholds),
    }
    print(f"  {'':24}{'HGB':>10}{'LogReg':>10}")
    for k, v in metrics["hist_gradient_boosting"].items():
        print(f"  {k:24}{v:>10.4f}{metrics['logistic_regression'][k]:>10.4f}")

    levels = risk_table(y_te, p_hgb, thresholds)
    print(f"\n  Risk levels (thresholds {thresholds}):")
    for level, row in levels.items():
        print(f"    {level:7} patients {row['count']:6} ({row['share']:.1%}), "
              f"readmitted < 30 days: {row['readmitted_rate']}")

    print("\n  Computing field importance (permutation importance)...")
    imp = permutation_importance(model, X_te, y_te, scoring="roc_auc", n_repeats=5, random_state=RANDOM_STATE)
    importance = pd.Series(imp.importances_mean, index=X_te.columns).sort_values(ascending=False)
    print(importance.head(10).round(4).to_string())
    save_plots(y_te, {"HistGradientBoosting": p_hgb, "LogisticRegression": p_lr}, importance)

    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, ARTIFACTS / "readmission_model.joblib")
    background = X_tr.sample(N_BACKGROUND, random_state=RANDOM_STATE).reset_index(drop=True)
    joblib.dump(background, ARTIFACTS / "explainer_background.joblib")

    print("\n  Example explanations for the 3 highest-risk patients:")
    top3 = np.argsort(-p_hgb)[:3]
    for idx, factors in zip(top3, explain(model, background, X_te.iloc[top3])):
        print(f"    p={p_hgb[idx]:.3f}: " + "; ".join(f"{f['field']}={f['value']} (+{f['impact']:.3f})" for f in factors))
    trained_at = datetime.now(timezone.utc)
    meta = {
        "model_version": f"readmission-{trained_at:%Y%m%d-%H%M}",
        "trained_at": trained_at.isoformat(timespec="seconds"),
        "sklearn_version": sklearn.__version__,
        "target": "readmitted == '<30'",
        "input_columns": INPUT_COLUMNS,
        "excluded_discharge_ids": EXCLUDED_DISCHARGE_IDS,
        "thresholds": thresholds,
        "domain": compute_domain(X_tr),
        "n_train": len(X_tr),
        "n_test": len(X_te),
        "cv_roc_auc": {
            "hist_gradient_boosting": round(float(search.best_score_), 4),
            "logistic_regression": round(float(lr_cv.mean()), 4),
        },
        "best_params": search.best_params_,
        "test_metrics": metrics,
        "test_risk_levels": levels,
        "permutation_importance_top15": importance.head(15).round(4).to_dict(),
    }
    (ARTIFACTS / "model_meta.json").write_text(
        json.dumps(meta, indent=2, ensure_ascii=False, default=_to_builtin), encoding="utf-8")
    print(f"\nModel: {ARTIFACTS / 'readmission_model.joblib'}")
    print(f"Plots: {REPORTS}")


if __name__ == "__main__":
    main()
