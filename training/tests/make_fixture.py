#!/usr/bin/env python3
"""Generate a tiny synthetic dataset that mimics Food-101 and VegFru on disk.

This exists so the data pipeline can be exercised end to end on a laptop in a
couple of seconds, without downloading ~5 GB of Food-101 or hunting for a copy
of VegFru. It writes:

* ``<out>/raw/food-101/images/<class>/<id>.png`` plus ``meta/classes.txt`` and
  the authoritative ``meta/train.json`` / ``meta/test.json``
* ``<out>/raw/vegfru/<class>/<id>.png`` (no split metadata, matching the real
  dataset's missing annotations)

Images are real, decodable PNGs built with :mod:`zlib` -- no PIL required -- and
each class gets a distinct colour so the bytes actually differ.

The class names are real ones from both datasets, chosen so that several resolve
against the app's pantry list.
"""

from __future__ import annotations

import argparse
import json
import struct
import sys
import zlib
from pathlib import Path
from typing import List, Optional, Tuple

FOOD101_CLASSES = ["apple_pie", "pizza", "sushi", "baby_back_ribs", "hamburger"]
VEGFRU_CLASSES = ["Green pea", "Broccoli", "Tomato", "Chinese chestnut", "Black pepper"]

DEFAULT_OUT = Path(__file__).resolve().parents[1] / "data" / "fixture"


def png_bytes(width: int, height: int, rgb: Tuple[int, int, int]) -> bytes:
    """A minimal 8-bit truecolour PNG, built from scratch."""
    row = b"\x00" + bytes(rgb) * width
    raw = row * height

    def chunk(tag: bytes, payload: bytes) -> bytes:
        return (
            struct.pack(">I", len(payload))
            + tag
            + payload
            + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 8-bit RGB, no interlace
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 6))
        + chunk(b"IEND", b"")
    )


def colour_for(index: int) -> Tuple[int, int, int]:
    return ((index * 37) % 256, (index * 91 + 40) % 256, (index * 53 + 80) % 256)


def write_images(root: Path, class_name: str, count: int, offset: int, size: int) -> List[str]:
    class_dir = root / class_name
    class_dir.mkdir(parents=True, exist_ok=True)
    ids: List[str] = []
    for index in range(count):
        image_id = f"{offset + index:04d}"
        (class_dir / f"{image_id}.png").write_bytes(
            png_bytes(size, size, colour_for(offset + index + abs(hash(class_name)) % 97))
        )
        ids.append(image_id)
    return ids


def build_food101(out: Path, per_class_train: int, per_class_test: int, size: int) -> int:
    root = out / "raw" / "food-101"
    images = root / "images"
    meta = root / "meta"
    meta.mkdir(parents=True, exist_ok=True)

    (meta / "classes.txt").write_text(
        "".join(f"{name}\n" for name in FOOD101_CLASSES), encoding="utf-8"
    )

    train: dict = {}
    test: dict = {}
    total = 0
    for index, class_name in enumerate(FOOD101_CLASSES):
        ids = write_images(images, class_name, per_class_train + per_class_test, index * 100, size)
        train[class_name] = ids[:per_class_train]
        test[class_name] = ids[per_class_train:]
        total += len(ids)

    (meta / "train.json").write_text(json.dumps(train, indent=1), encoding="utf-8")
    (meta / "test.json").write_text(json.dumps(test, indent=1), encoding="utf-8")

    # Also emit the .txt pair, since real downloads ship both.
    (meta / "train.txt").write_text(
        "".join(f"{cls}/{img}\n" for cls, imgs in train.items() for img in imgs), encoding="utf-8"
    )
    (meta / "test.txt").write_text(
        "".join(f"{cls}/{img}\n" for cls, imgs in test.items() for img in imgs), encoding="utf-8"
    )
    (root / "license_agreement.txt").write_text(
        "Synthetic fixture. Not the real Food-101 license agreement.\n", encoding="utf-8"
    )
    return total


def build_vegfru(out: Path, per_class: int, size: int) -> int:
    root = out / "raw" / "vegfru"
    root.mkdir(parents=True, exist_ok=True)
    total = 0
    for index, class_name in enumerate(VEGFRU_CLASSES):
        total += len(write_images(root, class_name, per_class, index * 100, size))
    return total


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"fixture root (default: {DEFAULT_OUT})")
    parser.add_argument("--food101-train-per-class", type=int, default=8, help="default: 8")
    parser.add_argument("--food101-test-per-class", type=int, default=2, help="default: 2")
    parser.add_argument("--vegfru-per-class", type=int, default=10, help="default: 10")
    parser.add_argument("--image-size", type=int, default=8, help="PNG edge length in pixels (default: 8)")
    parser.add_argument("--force", action="store_true", help="overwrite an existing fixture")
    args = parser.parse_args(argv)

    out = args.out.resolve()
    if out.exists() and not args.force:
        existing = list(out.glob("raw/*"))
        if existing:
            print(f"[error] {out} already contains {len(existing)} dataset dir(s); pass --force to overwrite",
                  file=sys.stderr)
            return 2

    food101_total = build_food101(out, args.food101_train_per_class, args.food101_test_per_class, args.image_size)
    vegfru_total = build_vegfru(out, args.vegfru_per_class, args.image_size)

    print(f"fixture root:      {out}")
    print(f"food-101:          {food101_total:>5} images, {len(FOOD101_CLASSES)} classes")
    print(f"vegfru:            {vegfru_total:>5} images, {len(VEGFRU_CLASSES)} classes")
    print(f"total:             {food101_total + vegfru_total:>5} images")
    print()
    print("Next:")
    print(f"  python3 scripts/import_food101.py --data-root {out} --skip-download")
    print(f"  python3 scripts/import_vegfru.py --data-root {out} --images-dir {out / 'raw' / 'vegfru'}")
    print(f"  python3 scripts/build_manifest.py --data-root {out}")
    print(f"  python3 scripts/validate_manifest.py --data-root {out} --check-images")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
