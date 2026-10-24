#!/usr/bin/env python3
"""Export a checkpoint all the way to a TensorFlow.js graph model for the browser.

The chain, and why it is not shorter::

    PyTorch                torch.onnx.export        (this script)
      -> ONNX
    ONNX                   onnx2tf                  (separate env, Python >= 3.12)
      -> TensorFlow SavedModel
    SavedModel             tensorflowjs_converter   (separate env)
      -> TFJS graph model (model.json + weight shards)

``tensorflowjs_converter`` cannot read ONNX. Its documented inputs are
SavedModel / Keras formats, and the legacy ``onnx-tf`` bridge is unmaintained, so
``onnx2tf`` is the current path. onnx2tf pins its own TensorFlow and currently
requires Python >= 3.12, so it normally lives in its own virtualenv separate from
the training env -- hence the subprocess calls and the ``--onnx2tf`` /
``--tfjs-converter`` options.

onnx2tf defaults to emitting TFLite; ``-fdosm`` additionally emits the SavedModel
that ``tensorflowjs_converter`` needs.

Use ``--dry-run`` to print the exact commands without needing torch installed.

    python3 scripts/export_tfjs.py --dry-run
    python3 scripts/export_tfjs.py --quantize float16
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from platewise_ml import manifest as mf  # noqa: E402

HERE = Path(__file__).resolve().parents[1]
DEFAULT_CHECKPOINT = HERE / "artifacts" / "best.pt"
DEFAULT_OUT = HERE / "artifacts" / "web"
DEFAULT_WORKDIR = HERE / "artifacts" / "export"

TARGET_MODEL_MB = 25.0


def dir_size(path: Path) -> int:
    return sum(child.stat().st_size for child in path.rglob("*") if child.is_file())


def human(num_bytes: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if abs(num_bytes) < 1024.0:
            return f"{num_bytes:.1f}{unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f}TB"


def run(command: List[str], label: str) -> None:
    print(f"[{label}] $ {' '.join(command)}")
    result = subprocess.run(command, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout.rstrip())
    if result.returncode != 0:
        if result.stderr:
            print(result.stderr.rstrip(), file=sys.stderr)
        raise RuntimeError(f"{label} failed with exit code {result.returncode}")


def export_onnx(checkpoint_path: Path, onnx_path: Path, opset: int, torch=None) -> Dict:
    """Step 1 -- PyTorch -> ONNX with a fixed batch of 1 and a fixed image size."""
    sys.path.insert(0, str(HERE / "scripts"))
    from torchvision import models

    from train import build_model

    checkpoint = torch.load(checkpoint_path, map_location="cpu")
    image_size = int(checkpoint.get("image_size", 224))
    num_classes = int(checkpoint["num_classes"])

    model = build_model(torch, models, torch.nn, checkpoint["backbone"], num_classes, pretrained=False)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()

    dummy = torch.randn(1, 3, image_size, image_size)
    onnx_path.parent.mkdir(parents=True, exist_ok=True)

    export_kwargs = dict(
        input_names=["images"],
        output_names=["logits"],
        opset_version=opset,
        do_constant_folding=True,
    )
    try:
        # torch >= 2.5 exposes the classic exporter via dynamo=False; newer
        # releases default it to True, which changes the emitted graph.
        torch.onnx.export(model, dummy, str(onnx_path), dynamo=False, **export_kwargs)
    except TypeError:
        torch.onnx.export(model, dummy, str(onnx_path), **export_kwargs)

    print(f"[onnx] wrote {onnx_path} ({human(onnx_path.stat().st_size)}), "
          f"input [1,3,{image_size},{image_size}] NCHW, output 'logits' [{num_classes}]")
    return {
        "backbone": checkpoint["backbone"],
        "num_classes": num_classes,
        "image_size": image_size,
        "class_map": checkpoint["class_map"],
        "normalisation": checkpoint.get("normalisation", {}),
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT,
                        help=f"checkpoint from train.py (default: {DEFAULT_CHECKPOINT})")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT,
                        help=f"TFJS model output dir (default: {DEFAULT_OUT})")
    parser.add_argument("--workdir", type=Path, default=DEFAULT_WORKDIR,
                        help=f"intermediate ONNX/SavedModel dir (default: {DEFAULT_WORKDIR})")
    parser.add_argument("--opset", type=int, default=18, help="ONNX opset version (default: 18)")
    parser.add_argument("--quantize", default="none", choices=("none", "float16", "uint8"),
                        help="weight quantisation for the TFJS output (default: none)")
    parser.add_argument("--onnx2tf", default="onnx2tf",
                        help="onnx2tf executable (default: onnx2tf, needs its own Python >= 3.12 env)")
    parser.add_argument("--tfjs-converter", default="tensorflowjs_converter",
                        help="tensorflowjs_converter executable (default: from PATH)")
    parser.add_argument("--saved-model-tags", default="serve", help="default: serve")
    parser.add_argument("--signature-name", default="serving_default", help="default: serving_default")
    parser.add_argument("--skip-onnx", action="store_true", help="reuse an existing ONNX file")
    parser.add_argument("--skip-onnx2tf", action="store_true", help="reuse an existing SavedModel")
    parser.add_argument("--skip-tfjs", action="store_true", help="stop after the SavedModel")
    parser.add_argument("--clean", action="store_true", help="delete --out before converting")
    parser.add_argument("--dry-run", action="store_true",
                        help="print the commands and exit; torch is not required")
    args = parser.parse_args(argv)

    workdir = args.workdir.resolve()
    onnx_path = workdir / "platewise_classifier.onnx"
    saved_model_dir = workdir / "saved_model"
    out_dir = args.out.resolve()

    quantize_flag = {"none": [], "float16": ["--quantize_float16"], "uint8": ["--quantize_uint8"]}[args.quantize]

    onnx2tf_command = [
        args.onnx2tf,
        "-i", str(onnx_path),
        "-o", str(workdir / "onnx2tf_out"),
        "-tb", "flatbuffer_direct",
        "-fdosm",
    ]
    tfjs_command = [
        args.tfjs_converter,
        "--input_format=tf_saved_model",
        "--output_format=tfjs_graph_model",
        f"--saved_model_tags={args.saved_model_tags}",
        f"--signature_name={args.signature_name}",
        *quantize_flag,
        str(saved_model_dir),
        str(out_dir),
    ]

    if args.dry_run:
        print("Dry run -- commands this script would execute in order:")
        print()
        print(f"[onnx]        torch.onnx.export(<checkpoint>, <dummy 1x3xSxS>, {onnx_path},")
        print("                 input_names=['images'], output_names=['logits'], opset_version="
              f"{args.opset})")
        print(f"              requires: torch, torchvision, onnx")
        print()
        if not args.skip_onnx2tf:
            print(f"[onnx2tf]     {' '.join(onnx2tf_command)}")
            print("              requires: onnx2tf in a SEPARATE env running Python >= 3.12")
            print("              (onnx2tf pins its own TensorFlow; the training env is 3.9-3.11)")
        print()
        if not args.skip_tfjs:
            print(f"[tfjs]        {' '.join(tfjs_command)}")
            print("              requires: tensorflowjs (pip install tensorflowjs)")
        print()
        print(f"Output:       {out_dir}  (model.json + weight shards, target < {TARGET_MODEL_MB:.0f}MB)")
        print(f"Metadata:     {out_dir / 'metadata.json'}  (class map + preprocessing for the web app)")
        print()
        print("Install hints:")
        print("  training env    : pip install -r requirements.txt")
        print("  onnx2tf env     : python3.12 -m venv .venv-onnx2tf && "
              ".venv-onnx2tf/bin/pip install 'onnx2tf[tensorflow]'")
        print("  tfjs env        : python3.12 -m venv .venv-tfjs && "
              ".venv-tfjs/bin/pip install tensorflowjs")
        return 0

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

    metadata: Dict = {}
    if args.skip_onnx:
        if not onnx_path.is_file():
            print(f"[error] --skip-onnx but {onnx_path} does not exist", file=sys.stderr)
            return 2
        print(f"[onnx] reusing {onnx_path}")
    else:
        metadata = export_onnx(args.checkpoint, onnx_path, args.opset, torch=torch)

    if not args.skip_onnx2tf:
        try:
            run(onnx2tf_command, "onnx2tf")
        except FileNotFoundError:
            print(f"[error] could not run {args.onnx2tf!r}.", file=sys.stderr)
            print("        onnx2tf needs Python >= 3.12 and its own TensorFlow; install it in a", file=sys.stderr)
            print("        separate virtualenv and pass --onnx2tf /path/to/.venv-onnx2tf/bin/onnx2tf", file=sys.stderr)
            return 2
        except RuntimeError as exc:
            print(f"[error] {exc}", file=sys.stderr)
            print("        onnx2tf prints a per-layer coverage report; an unsupported TF op is the", file=sys.stderr)
            print("        usual cause. MobileNetV3 hard-swish and EfficientNet SiLU are the", file=sys.stderr)
            print("        activations to check first.", file=sys.stderr)
            return 1

        produced = sorted((workdir / "onnx2tf_out").rglob("saved_model.pb"))
        if not produced:
            print("[error] onnx2tf produced no saved_model.pb; check -fdosm is supported in your version",
                  file=sys.stderr)
            return 1
        if saved_model_dir.exists():
            shutil.rmtree(saved_model_dir)
        shutil.copytree(produced[0].parent, saved_model_dir)
        print(f"[onnx2tf] SavedModel -> {saved_model_dir}")

    if args.skip_tfjs:
        print("[tfjs] skipped")
        return 0

    if not saved_model_dir.is_dir():
        print(f"[error] no SavedModel at {saved_model_dir}; rerun without --skip-onnx2tf", file=sys.stderr)
        return 2

    if args.clean and out_dir.exists():
        shutil.rmtree(out_dir)

    try:
        run(tfjs_command, "tfjs")
    except FileNotFoundError:
        print(f"[error] could not run {args.tfjs_converter!r}.", file=sys.stderr)
        print("        Install it: pip install tensorflowjs", file=sys.stderr)
        return 2

    if not metadata:
        try:
            checkpoint = torch.load(args.checkpoint, map_location="cpu")
            metadata = {
                "backbone": checkpoint["backbone"],
                "num_classes": int(checkpoint["num_classes"]),
                "image_size": int(checkpoint.get("image_size", 224)),
                "class_map": checkpoint["class_map"],
                "normalisation": checkpoint.get("normalisation", {}),
            }
        except Exception as exc:  # a metadata file is nice-to-have, not essential
            print(f"[warn] could not recover checkpoint metadata: {exc}", file=sys.stderr)

    if metadata:
        metadata["quantization"] = args.quantize
        metadata["input"] = {
            "name": "images",
            "layout": "NHWC after onnx2tf (PyTorch exported NCHW)",
            "shape": [1, metadata.get("image_size", 224), metadata.get("image_size", 224), 3],
            "colour_order": "RGB",
            "scale": "pixel / 255, then subtract mean and divide by std",
        }
        metadata["labels"] = [
            {
                "id": entry["id"],
                "slug": entry["slug"],
                "name": entry["name"],
                "category": entry["category"],
                "kind": entry["kind"],
                "canonical": entry.get("canonical"),
            }
            for entry in metadata.get("class_map", {}).get("classes", [])
        ]
        mf.write_json(out_dir / "metadata.json", metadata)
        print(f"[tfjs] wrote {out_dir / 'metadata.json'}")

    if out_dir.is_dir():
        size_mb = dir_size(out_dir) / (1024 * 1024)
        print()
        print(f"[size] {out_dir} is {size_mb:.1f}MB")
        if size_mb > TARGET_MODEL_MB:
            print(f"[size] above the {TARGET_MODEL_MB:.0f}MB target -- retry with "
                  f"--quantize float16 (or uint8) and re-check accuracy")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
