#!/usr/bin/env python3
"""Validate a built manifest, and optionally check the images exist on disk.

Exits non-zero when the manifest has errors, so it can gate a training run::

    python3 scripts/validate_manifest.py --check-images

Warnings (thin classes, images missing from a partial download) do not fail.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from platewise_ml import manifest as mf  # noqa: E402

DEFAULT_DATA_ROOT = Path(__file__).resolve().parents[1] / "data"


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifest", type=Path, default=None,
                        help="manifest file (default: <data-root>/processed/manifest.jsonl)")
    parser.add_argument("--class-map", type=Path, default=None,
                        help="class map (default: <data-root>/processed/class_map.json)")
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT,
                        help=f"image root for --check-images (default: {DEFAULT_DATA_ROOT})")
    parser.add_argument("--check-images", action="store_true",
                        help="also verify that each referenced image exists on disk")
    parser.add_argument("--min-samples", type=int, default=1,
                        help="warn about classes with fewer samples than this (default: 1)")
    parser.add_argument("--max-report", type=int, default=25,
                        help="cap how many messages of each kind are printed (default: 25)")
    args = parser.parse_args(argv)

    data_root = args.data_root.resolve()
    manifest_path = (args.manifest or (data_root / "processed" / "manifest.jsonl")).resolve()
    class_map_path = (args.class_map or (data_root / "processed" / "class_map.json")).resolve()

    for path in (manifest_path, class_map_path):
        if not path.is_file():
            print(f"[error] missing {path}", file=sys.stderr)
            print("        Build it first: python3 scripts/build_manifest.py", file=sys.stderr)
            return 2

    records = mf.read_jsonl(manifest_path)
    class_map = mf.read_json(class_map_path)

    errors, warnings = mf.validate_manifest(
        records,
        class_map,
        images_root=data_root if args.check_images else None,
        min_samples=args.min_samples,
    )

    stats = mf.manifest_stats(records, class_map)
    print(f"manifest:  {manifest_path}")
    print(f"class map: {class_map_path} ({class_map.get('num_classes', 0)} classes)")
    print(f"images:    {stats['num_images']}")
    print(f"splits:    {stats['splits']}")
    print(f"sources:   {stats['sources']}")
    print(f"by kind:   {stats['labels_by_kind']}")
    if args.check_images:
        missing = sum(1 for warning in warnings if "file not found" in warning)
        print(f"on disk:   {stats['num_images'] - missing} present, {missing} missing")
    print()

    if not errors and not warnings:
        print("OK -- no errors, no warnings")
        return 0

    for message in errors[: args.max_report]:
        print(f"ERROR   {message}")
    if len(errors) > args.max_report:
        print(f"ERROR   ... and {len(errors) - args.max_report} more")
    for message in warnings[: args.max_report]:
        print(f"WARNING {message}")
    if len(warnings) > args.max_report:
        print(f"WARNING ... and {len(warnings) - args.max_report} more")

    print()
    print(f"{len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
