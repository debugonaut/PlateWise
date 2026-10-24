"""Metrics for a multi-label classifier, implemented without scikit-learn.

Two families matter here:

* **top-1 / top-5 accuracy**, computed only over the single-label subset. VegFru
  and Food-101 are both single-label, so this is the number PLAN.md targets
  ("top-5 >= 85% on the VegFru test split"). It is undefined for genuinely
  multi-label images, which are excluded rather than silently miscounted.
* **average precision (mAP)**, which is the honest metric once a photo can carry
  several labels -- exactly the fridge case.

Per-class APs are also grouped by label ``kind`` so dish recognition and
ingredient recognition can be judged separately; a model that is excellent at
Food-101 dishes but weak on produce is useless for a fridge scan.
"""

from __future__ import annotations

from typing import Dict, List

import torch


def average_precision(scores: torch.Tensor, binary: torch.Tensor) -> float:
    """Average precision for one class, using the step-precision PR curve.

    ``scores`` and ``binary`` are 1-D: the class score and its 0/1 ground truth
    for every sample. Returns ``nan`` when the class has no positives.
    """
    total_positives = float(binary.sum().item())
    if total_positives == 0:
        return float("nan")

    order = torch.argsort(scores, descending=True)
    hits = binary[order]
    cumulative_hits = torch.cumsum(hits, dim=0)
    ranks = torch.arange(1, hits.numel() + 1, dtype=torch.float32)
    precision = cumulative_hits / ranks
    return float((precision * hits).sum().item() / total_positives)


def top_k_accuracy(logits: torch.Tensor, targets: torch.Tensor, k: int = 1) -> Dict[str, float]:
    """Top-k hit rate over samples that have exactly one positive label."""
    single = targets.sum(dim=1) == 1
    covered = int(single.sum().item())
    if covered == 0:
        return {"accuracy": float("nan"), "samples": 0}

    sub_logits = logits[single]
    true_index = targets[single].argmax(dim=1)
    width = min(k, sub_logits.shape[1])
    top = sub_logits.topk(width, dim=1).indices
    hits = (top == true_index.unsqueeze(1)).any(dim=1)
    return {"accuracy": float(hits.float().mean().item()), "samples": covered}


def per_class_report(logits: torch.Tensor, targets: torch.Tensor, class_map: Dict) -> List[dict]:
    rows: List[dict] = []
    for entry in class_map.get("classes", []):
        class_id = int(entry["id"])
        if class_id >= logits.shape[1]:
            continue
        rows.append(
            {
                "id": class_id,
                "slug": entry["slug"],
                "name": entry.get("name", entry["slug"]),
                "category": entry.get("category"),
                "kind": entry.get("kind"),
                "support": int(targets[:, class_id].sum().item()),
                "average_precision": average_precision(logits[:, class_id], targets[:, class_id]),
            }
        )
    return rows


def _macro(values: List[float]) -> float:
    usable = [value for value in values if value == value]  # drop nan
    return sum(usable) / len(usable) if usable else float("nan")


def summarise(logits: torch.Tensor, targets: torch.Tensor, class_map: Dict) -> Dict:
    """Full metric bundle for a split: top-k, macro/micro AP and per-kind AP."""
    rows = per_class_report(logits, targets, class_map)
    macro_ap = _macro([row["average_precision"] for row in rows])
    micro_ap = average_precision(logits.reshape(-1), targets.reshape(-1))

    by_kind: Dict[str, List[float]] = {}
    by_category: Dict[str, List[float]] = {}
    for row in rows:
        if row["support"] == 0:
            continue
        by_kind.setdefault(str(row["kind"]), []).append(row["average_precision"])
        by_category.setdefault(str(row["category"]), []).append(row["average_precision"])

    return {
        "num_samples": int(logits.shape[0]),
        "num_classes": int(logits.shape[1]),
        "top1": top_k_accuracy(logits, targets, k=1),
        "top5": top_k_accuracy(logits, targets, k=5),
        "macro_ap": macro_ap,
        "micro_ap": micro_ap,
        "macro_ap_by_kind": {kind: _macro(values) for kind, values in sorted(by_kind.items())},
        "macro_ap_by_category": {key: _macro(values) for key, values in sorted(by_category.items())},
        "per_class": rows,
    }


def collect_logits(model, loader, device, use_amp: bool = False) -> Dict[str, torch.Tensor]:
    """Run inference over a loader and return raw logits plus targets."""
    model.eval()
    logit_chunks: List[torch.Tensor] = []
    target_chunks: List[torch.Tensor] = []
    with torch.no_grad():
        for batch in loader:
            images, targets = batch[0], batch[1]
            images = images.to(device, non_blocking=True)
            if use_amp and device.type == "cuda":
                with torch.autocast(device_type="cuda", dtype=torch.float16):
                    outputs = model(images)
            else:
                outputs = model(images)
            logit_chunks.append(outputs.detach().float().cpu())
            target_chunks.append(targets.detach().float().cpu())
    if not logit_chunks:
        return {"logits": torch.zeros((0, 0)), "targets": torch.zeros((0, 0))}
    return {"logits": torch.cat(logit_chunks), "targets": torch.cat(target_chunks)}


def format_summary(summary: Dict, indent: str = "  ") -> str:
    """Compact human-readable rendering used by train/evaluate output."""
    lines = [
        f"{indent}samples            {summary['num_samples']}",
        f"{indent}classes            {summary['num_classes']}",
        f"{indent}top-1              {summary['top1']['accuracy']:.4f} "
        f"(over {summary['top1']['samples']} single-label images)",
        f"{indent}top-5              {summary['top5']['accuracy']:.4f}",
        f"{indent}macro AP           {summary['macro_ap']:.4f}",
        f"{indent}micro AP           {summary['micro_ap']:.4f}",
    ]
    if summary["macro_ap_by_kind"]:
        rendered = ", ".join(f"{kind}={value:.4f}" for kind, value in summary["macro_ap_by_kind"].items())
        lines.append(f"{indent}macro AP by kind   {rendered}")
    return "\n".join(lines)
