#!/usr/bin/env python3
"""Score a checkpoint on one split of the manifest.

    python3 scripts/evaluate.py --split test
    python3 scripts/evaluate.py --checkpoint artifacts/best.pt --split test --report artifacts/test_report.json

The test split is the honest number: if a source shipped an official test set,
``build_manifest.py`` locked it there and ``train.py`` never saw it.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from platewise_ml import manifest as mf  # noqa: E402

DEFAULT_DATA_ROOT = Path(__file__).resolve().parents[1] / "data"
DEFAULT_CHECKPOINT = Path(__file__).resolve().parents[1] / "artifacts" / "best.pt"


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT,
                        help=f"checkpoint from train.py (default: {DEFAULT_CHECKPOINT})")
    parser.add_argument("--split", default="test", choices=list(mf.VALID_SPLITS), help="split to score (default: test)")
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT, help=f"default: {DEFAULT_DATA_ROOT}")
    parser.add_argument("--manifest", type=Path, default=None, help="default: <data-root>/processed/manifest.jsonl")
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--num-workers", type=int, default=0)
    parser.add_argument("--device", default="auto", help="auto | cpu | cuda | mps (default: auto)")
    parser.add_argument("--report", type=Path, default=None, help="write the full JSON report here")
    parser.add_argument("--worst", type=int, default=15, help="how many weakest classes to list (default: 15)")
    args = parser.parse_args(argv)

    data_root = args.data_root.resolve()
    manifest_path = (args.manifest or (data_root / "processed" / "manifest.jsonl")).resolve()

    if not args.checkpoint.is_file():
        print(f"[error] checkpoint not found: {args.checkpoint}", file=sys.stderr)
        print("        Train one first: python3 scripts/train.py", file=sys.stderr)
        return 2
    if not manifest_path.is_file():
        print(f"[error] manifest not found: {manifest_path}", file=sys.stderr)
        return 2

    try:
        import torch
        from torch.utils.data import DataLoader
        from torchvision import models

        from platewise_ml import datasets, metrics
    except ImportError as exc:
        print(f"[error] {exc}", file=sys.stderr)
        print("        Install the training extras: pip install -r requirements.txt", file=sys.stderr)
        return 2

    from train import build_model, pick_device  # reuse the exact same architecture

    checkpoint = torch.load(args.checkpoint, map_location="cpu")
    class_map = checkpoint["class_map"]
    image_size = int(checkpoint.get("image_size", 224))
    class_index = datasets.class_index_from_map(class_map)

    records = mf.read_jsonl(manifest_path)
    split_records = datasets.records_for_split(records, args.split)
    if not split_records:
        print(f"[error] no records with split={args.split!r} in {manifest_path}", file=sys.stderr)
        return 2

    device = pick_device(torch, args.device)
    dataset = datasets.MultiLabelManifestDataset(
        split_records, class_index, data_root, datasets.build_transform(image_size, train=False),
        num_classes=class_map["num_classes"],
    )
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=False, num_workers=args.num_workers)

    model = build_model(torch, models, torch.nn, checkpoint["backbone"], class_map["num_classes"], pretrained=False)
    model.load_state_dict(checkpoint["state_dict"])
    model.to(device)

    predictions = metrics.collect_logits(model, loader, device)
    summary = metrics.summarise(predictions["logits"], predictions["targets"], class_map)

    print(f"checkpoint: {args.checkpoint} (epoch {checkpoint.get('epoch', '?')}, {checkpoint['backbone']})")
    print(f"split:      {args.split}")
    print()
    print(metrics.format_summary(summary))

    ranked = sorted(
        [row for row in summary["per_class"] if row["support"] > 0],
        key=lambda row: (row["average_precision"] if row["average_precision"] == row["average_precision"] else -1),
    )
    if ranked:
        print()
        print(f"weakest {min(args.worst, len(ranked))} classes by average precision:")
        for row in ranked[: args.worst]:
            print(f"  AP {row['average_precision']:.4f}  support {row['support']:>4}  "
                  f"{row['name']}  [{row['kind']}, {row['category']}]")

    report_path = args.report
    if report_path is None:
        report_path = args.checkpoint.parent / f"evaluation_{args.split}.json"
    mf.write_json(
        Path(report_path),
        {
            "checkpoint": str(args.checkpoint),
            "split": args.split,
            "image_size": image_size,
            "summary": summary,
        },
    )
    print()
    print(f"report: {report_path}")

    if summary["top5"]["samples"] == 0:
        print()
        print("note: no single-label images in this split, so top-k accuracy is undefined "
              "and only mAP is meaningful")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
