#!/usr/bin/env python3
"""Decode the fruit/vegetable Parquet dataset into per-class JPEGs + an index.

Source: https://huggingface.co/datasets/Nattakarn/fruit-and-vegetable-image-recognition
(36 raw-produce classes, 2,492 train / 623 test images).

Why this source: PlateWise reads a photo to fill a *pantry*, so its labels must be
raw cooking ingredients. Food-101 and the Indian-food set are cooked dishes, and
CLIP zero-shot could only name the main subject of a produce photo about 40% of
the time (backend/scripts, probe runs). 36 produce classes train in minutes and
cover most of what the app's pantry actually holds.

Licence: the Hub card declares none, so treat this as unresolved for anything
beyond local experimentation, and do not redistribute the images. Only the
resulting model is shipped here.

Two deliberate deviations from the raw dataset:

* ``bell pepper`` and ``capsicum`` are the same vegetable under two names, as are
  ``corn``/``sweetcorn`` and ``chilli pepper``/``jalepeno``-adjacent spellings.
  They are kept as separate model classes because that is what the source
  contains, and ``build_manifest`` maps them to one pantry item at the label
  level instead of silently fusing two image distributions.
* Splits are recomputed rather than trusting the source split, so the pipeline's
  own stratified split is the one that gets evaluated.

    python3 scripts/import_ingredients.py
    python3 scripts/import_ingredients.py --limit 40   # quick subset per class
"""

from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

SOURCE = "ingredients"
DEFAULT_DATA_ROOT = HERE.parent / "data"
DEFAULT_PARQUET_DIR = DEFAULT_DATA_ROOT / "raw" / "ingredients" / "parquet"
DEFAULT_IMAGES_DIR = DEFAULT_DATA_ROOT / "raw" / "ingredients" / "images"
DEFAULT_INDEX = DEFAULT_DATA_ROOT / "processed" / "ingredients.index.jsonl"

# The fixture split is deliberately tiny; this import is the real one.
IMAGE_SUFFIX = ".jpg"

# The Parquet `label` column stores integer class ids, not names. This is the
# dataset's own class order (as reported by the Hub's datasets-server /info
# endpoint for this repo). The importer asserts the decoded ids stay in range,
# so a changed label set fails loudly instead of silently mislabelling images.
CLASS_NAMES = [
    "apple", "banana", "beetroot", "bell pepper", "cabbage", "capsicum",
    "carrot", "cauliflower", "chilli pepper", "corn", "cucumber", "eggplant",
    "garlic", "ginger", "grapes", "jalepeno", "kiwi", "lemon", "lettuce",
    "mango", "onion", "orange", "paprika", "pear", "peas", "pineapple",
    "pomegranate", "potato", "raddish", "soy beans", "spinach", "sweetcorn",
    "sweetpotato", "tomato", "turnip", "watermelon",
]


def slugify(name: str) -> str:
    return name.strip().lower().replace(" ", "_").replace("-", "_")


def human(size: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if abs(size) < 1024.0:
            return f"{size:.1f}{unit}"
        size /= 1024.0
    return f"{size:.1f}TB"


def decode_shard(shard: Path, images_dir: Path, limit: Optional[int], counts: Dict[str, int]) -> List[dict]:
    """Write every image row to disk and return the index records for that shard."""
    import pyarrow.parquet as pq
    from PIL import Image

    records: List[dict] = []
    table = pq.read_table(shard)
    labels = table.column("label").to_pylist()
    images = table.column("image").to_pylist()

    for label_id, payload in zip(labels, images):
        if not isinstance(label_id, int) or not 0 <= label_id < len(CLASS_NAMES):
            raise SystemExit(
                f"[error] label id {label_id!r} out of range for {len(CLASS_NAMES)} known classes; "
                "the dataset's class list has changed -- update CLASS_NAMES."
            )
        slug = slugify(CLASS_NAMES[label_id])
        if limit is not None and counts.get(slug, 0) >= limit:
            continue

        blob = payload.get("bytes") if isinstance(payload, dict) else None
        if not blob:
            continue

        class_dir = images_dir / slug
        class_dir.mkdir(parents=True, exist_ok=True)
        index = counts.get(slug, 0)
        filename = f"{index:05d}{IMAGE_SUFFIX}"
        # Manifest paths are relative to the data root, i.e. to images_dir's
        # grandparent (data/raw/ingredients/images -> data).
        rel = Path("raw") / "ingredients" / "images" / slug / filename
        target = class_dir / filename

        # Re-encode rather than dump the source bytes: the source is a mix of
        # formats and sizes, and a fixed RGB JPEG keeps the manifest uniform.
        try:
            with Image.open(io.BytesIO(blob)) as img:
                img.convert("RGB").save(target, "JPEG", quality=92)
        except Exception as exc:  # noqa: BLE001 - report and skip the bad row
            print(f"  ! {slug} row {index}: {exc}", file=sys.stderr)
            continue

        counts[slug] = index + 1
        # Field names match the other importers so build_manifest.py can read
        # this index the same way (it keys on raw_label, not labels).
        records.append(
            {
                "image": str(rel),
                "raw_label": CLASS_NAMES[label_id],
                "source": SOURCE,
                "source_split": shard.stem.split("-")[0],
            }
        )
    return records


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--parquet-dir", type=Path, default=DEFAULT_PARQUET_DIR,
                        help=f"directory holding *.parquet (default: {DEFAULT_PARQUET_DIR})")
    parser.add_argument("--images-dir", type=Path, default=DEFAULT_IMAGES_DIR,
                        help=f"where JPEGs are written (default: {DEFAULT_IMAGES_DIR})")
    parser.add_argument("--index", type=Path, default=DEFAULT_INDEX,
                        help=f"index output (default: {DEFAULT_INDEX})")
    parser.add_argument("--limit", type=int, default=None,
                        help="max images per class (default: all)")
    args = parser.parse_args(argv)

    shards = sorted(args.parquet_dir.glob("*.parquet"))
    if not shards:
        print(f"[error] no .parquet files in {args.parquet_dir}", file=sys.stderr)
        print("        Download them from the dataset's parquet/ branch first.", file=sys.stderr)
        return 2

    try:
        import pyarrow  # noqa: F401
        from PIL import Image  # noqa: F401
    except ImportError as exc:
        print(f"[error] {exc}", file=sys.stderr)
        print("        pip install pyarrow pillow", file=sys.stderr)
        return 2

    print(f"[import] {len(shards)} shard(s) from {args.parquet_dir}")
    counts: Dict[str, int] = {}
    records: List[dict] = []
    for shard in shards:
        before = len(records)
        records.extend(decode_shard(shard, args.images_dir, args.limit, counts))
        print(f"  {shard.name}: +{len(records) - before} images")

    if not records:
        print("[error] decoded no images", file=sys.stderr)
        return 1

    args.index.parent.mkdir(parents=True, exist_ok=True)
    with args.index.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record) + "\n")

    print(f"\n[import] {len(records)} images across {len(counts)} classes")
    print(f"[import] index -> {args.index}")

    largest = sorted(counts.items(), key=lambda kv: -kv[1])
    print(f"[import] busiest: {', '.join(f'{k}={v}' for k, v in largest[:6])}")
    thinnest = sorted(counts.items(), key=lambda kv: kv[1])
    print(f"[import] thinnest: {', '.join(f'{k}={v}' for k, v in thinnest[:6])}")
    print("\nLicence: the Hub card declares none -- local experimentation only, do not")
    print("redistribute the images. Cite Nattakarn/fruit-and-vegetable-image-recognition.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
