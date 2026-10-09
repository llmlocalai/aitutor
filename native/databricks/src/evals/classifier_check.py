"""Step 9. Measure ai_classify against labels a person wrote, per class, before anything uses it.

An overall accuracy hides the class that matters. If 'travel' is 5% of invoices and the classifier
gets it wrong half the time, accuracy is still 97% and every travel invoice is checked against the
wrong policy. So the gate is per class: precision and recall each above a floor, on enough examples.

  SELECT c.invoice_id, c.category:response[0].value::string AS predicted,
         c.category:response[0].confidence_score::double AS confidence, l.label
  FROM fin_dev.ai.invoice_category c JOIN fin_dev.evals.category_labels l USING (invoice_id)
"""
from __future__ import annotations


def per_class(rows: list) -> dict:
    """rows: dicts with predicted, label. Returns {class: {precision, recall, support}}."""
    classes = sorted({r["label"] for r in rows} | {r["predicted"] for r in rows if r["predicted"]})
    out = {}
    for c in classes:
        tp = sum(1 for r in rows if r["predicted"] == c and r["label"] == c)
        fp = sum(1 for r in rows if r["predicted"] == c and r["label"] != c)
        fn = sum(1 for r in rows if r["predicted"] != c and r["label"] == c)
        out[c] = {"precision": round(tp / (tp + fp), 3) if tp + fp else 0.0,
                  "recall": round(tp / (tp + fn), 3) if tp + fn else 0.0,
                  "support": tp + fn}
    return out


def gate(stats: dict, floor: float = 0.85, min_support: int = 30) -> list:
    """Reasons the classifier may not be used. A class with too few labels is a failure, not a pass."""
    out = []
    for c, s in stats.items():
        if s["support"] < min_support:
            out.append(f"{c}: only {s['support']} labelled examples (need {min_support})")
            continue
        for k in ("precision", "recall"):
            if s[k] < floor:
                out.append(f"{c}: {k} {s[k]:.3f} below {floor}")
    return out


def confidence_cut(rows: list, target_precision: float = 0.95) -> float | None:
    """Lowest confidence at which predictions above it reach the target precision. Rows below the
    cut go to a person. None means no cut reaches the target."""
    for cut in [x / 100 for x in range(50, 100)]:
        kept = [r for r in rows if (r.get("confidence") or 0) >= cut]
        if kept and sum(1 for r in kept if r["predicted"] == r["label"]) / len(kept) >= target_precision:
            return cut
    return None
