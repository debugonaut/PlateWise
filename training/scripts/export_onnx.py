#!/usr/bin/env python3
"""Export a trained checkpoint to ONNX for the Node backend.

The app's vision runs on the **backend** (``backend/server.js``), which is Node
and already ships ``onnxruntime-node``. So the deployable artifact is a plain
``.onnx`` file -- no TensorFlow.js, no ``onnx2tf``, and therefore no Python 3.12
requirement. (``export_tfjs.py`` exists for the *browser* path; this script is
the one you actually want for the shipped backend.)

It reuses ``export_onnx()`` from ``export_tfjs.py`` so the PyTorch -> ONNX step
stays in one place, then writes a ``metadata.json`` next to the model carrying
everything the backend needs to preprocess an image and map ids back to labels:

    {"backbone", "num_classes", "image_size",
     "normalisation": {"mean": [...], "std": [...]},
     "input": {"name": "images", "layout": "NCHW", "colour": "RGB"},
     "classes": [{"id", "slug", "name", "category", "kind", "canonical"}]}

    python3 scripts/export_onnx.py --checkpoint artifacts/best.pt
    python3 scripts/export_onnx.py --checkpoint artifacts/best.pt --out artifacts/web

Requires torch + torchvision (the training env). No TensorFlow.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import List, Optional

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))

DEFAULT_CHECKPOINT = HERE.parent / "artifacts" / "best.pt"
DEFAULT_OUT = HERE.parent / "artifacts" / "onnx"


def human(size: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if abs(size) < 1024.0:
            return f"{size:3.1f}{unit}"
        size /= 1024.0
    return f"{size:.1f}TB"


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT,
                        help=f"checkpoint from train.py (default: {DEFAULT_CHECKPOINT})")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT,
                        help=f"output dir (default: {DEFAULT_OUT})")
    parser.add_argument("--opset", type=int, default=18, help="ONNX opset version (default: 18)")
    args = parser.parse_args(argv)

    if not args.checkpoint.is_file():
        print(f"[error] checkpoint not found: {args.checkpoint}", file=sys.stderr)
        print("        Train one first: python3 scripts/train.py", file=sys.stderr)
        return 2

    try:
        import torch
    except ImportError as exc:
        print(f"[error] {exc}", file=sys.stderr)
        print("        Install the training extras: pip install -r requirements.txt", file=sys.stderr)
        return 2

    # Reuse the proven PyTorch -> ONNX step rather than duplicating it.
    from export_tfjs import export_onnx

    onnx_path = args.out / "model.onnx"
    meta = export_onnx(args.checkpoint, onnx_path, args.opset, torch=torch)

    normalisation = meta.get("normalisation") or {}
    metadata = {
        "backbone": meta["backbone"],
        "num_classes": meta["num_classes"],
        "image_size": meta["image_size"],
        "normalisation": {
            "mean": normalisation.get("mean", [0.485, 0.456, 0.406]),
            "std": normalisation.get("std", [0.229, 0.224, 0.225]),
        },
        "input": {"name": "images", "layout": "NCHW", "colour": "RGB"},
        "classes": meta["class_map"]["classes"],
    }
    metadata_path = args.out / "metadata.json"
    args.out.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    total = onnx_path.stat().st_size
    print(f"[onnx] {onnx_path} ({human(total)})")
    print(f"[onnx] metadata -> {metadata_path} ({metadata['num_classes']} classes, "
          f"input {metadata['image_size']}x{metadata['image_size']} NCHW RGB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
