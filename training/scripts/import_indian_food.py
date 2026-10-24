#!/usr/bin/env python3
"""Index the Hugging Face Indian-food dataset and emit a per-source index.

Enhanced Indian Food Classification (SohlHealth on Hugging Face) -- 15,404
photographs across 43 Indian dish classes (biryani, masala_dosa, chole_bhature,
gulab_jamun, ...). Cite the dataset card and CC BY 4.0 licence before shipping.

    https://huggingface.co/datasets/SohlHealth/enhanced-indian-food-classification

Ships parquet shards with the image bytes embedded in each row::

    data/train-00000-of-00003.parquet   (+ 2 more)
    data/validation-00000-of-00001.parquet
    data/test-00000-of-00001.parquet

Schema per row: ``image: struct<bytes, path>`` + ``label: string``.

Unlike ``import_food101.py`` and ``import_vegfru.py`` this script is NOT
standard-library only: it needs ``pyarrow`` (to read parquet) and ``Pillow``
(to decode the embedded JPEG bytes). Those are the only two third-party
imports, and they are already in ``requirements.txt``.

Two deliberate deviations from the source dataset, both because of how its
splits are built:

* **The official split is re-stratified, not locked.** Its ``test`` split
  covers only 22 of the 43 classes, so using it as the held-out set would leave
  21 dishes with no test coverage. Every record is emitted with
  ``source_split=None`` so ``build_manifest.py`` performs a clean,
  class-stratified train/val/test split in which all 43 dishes appear. The
  author's original split counts are printed for the record.
* **Images are re-encoded to JPEG.** The bytes are already JPEG, but re-encoding
  normalises colour profiles and strips any stray metadata so the torch loader
  sees one predictable format.

    python3 scripts/import_indian_food.py                      # all splits
    python3 scripts/import_indian_food.py --limit-per-class 30 # smoke subset
    python3 scripts/import_indian_food.py --splits test        # one split only
"""

from __future__ import annotations

import argparse
import io
import json
import sys
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional

REPO = "SohlHealth/enhanced-indian-food-classification"
RAW_URL = "https://huggingface.co/datasets/{repo}/resolve/main/data/{name}"
USER_AGENT = "platewise-dataset-importer/1.0"
EXPECTED_CLASSES = 43

# split name -> parquet shard filenames, in the order they should be read.
SPLITS: Dict[str, List[str]] = {
    "train": [
        "train-00000-of-00003.parquet",
        "train-00001-of-00003.parquet",
        "train-00002-of-00003.parquet",
    ],
    "validation": ["validation-00000-of-00001.parquet"],
    "test": ["test-00000-of-00001.parquet"],
}

DEFAULT_DATA_ROOT = Path(__file__).resolve().parents[1] / "data"
SOURCE = "indianfood"


def _human(size: float) -> str:
    # KB must be in the ladder: without it a 453 MB shard divides past MB and
    # prints "432.3GB", which is what made the download look catastrophically
    # oversized when the bytes on disk were correct all along.
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(size) < 1024.0:
            return f"{size:3.1f}{unit}"
        size /= 1024.0
    return f"{size:.1f}PB"


def download(name: str, dest: Path, repo: str = REPO, chunk: int = 1 << 20) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = RAW_URL.format(repo=repo, name=name)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    print(f"[download] {name}")
    with urllib.request.urlopen(request, timeout=120) as response:
        # HF's resolve URL redirects, so Content-Length is often missing or plain
        # wrong (it once reported 246 GB for a 259 MB shard). Only trust it when
        # it is present and plausible for a dataset shard.
        total = int(response.headers.get("Content-Length") or 0)
        if total <= 0 or total > 50 * (1 << 30):
            total = 0
        seen = 0
        next_report = 0
        with dest.open("wb") as out:
            while True:
                block = response.read(chunk)
                if not block:
                    break
                out.write(block)
                seen += len(block)
                if seen >= next_report:
                    if total:
                        print(f"  {seen / total * 100:5.1f}%  {_human(seen)} / {_human(total)}", flush=True)
                    else:
                        print(f"  {_human(seen)}", flush=True)
                    next_report = seen + 100 * chunk
    print(f"[download] complete: {_human(seen)}")
    return seen


def ensure_shard(name: str, raw_dir: Path, repo: str, no_download: bool) -> Optional[Path]:
    path = raw_dir / name
    if path.is_file() and path.stat().st_size > 0:
        return path
    if no_download:
        print(f"[warn] {path} missing and --no-download set; skipping", file=sys.stderr)
        return None
    try:
        download(name, path, repo=repo)
        return path
    except Exception as exc:  # network, DNS, HTTP status
        print(f"[error] could not fetch {name}: {exc}", file=sys.stderr)
        return None


def decode_jpeg(image_struct: dict) -> Optional[bytes]:
    """Embedded parquet image -> normalised JPEG bytes, or None if unreadable."""
    from PIL import Image

    payload = image_struct.get("bytes") if isinstance(image_struct, dict) else None
    if not payload:
        return None
    try:
        with Image.open(io.BytesIO(payload)) as img:
            img = img.convert("RGB")
            out = io.BytesIO()
            img.save(out, format="JPEG", quality=90)
            return out.getvalue()
    except Exception:  # truncated / undecodable image
        return None


def index_split(
    split: str,
    shards: List[str],
    raw_dir: Path,
    images_root: Path,
    data_root: Path,
    repo: str,
    no_download: bool,
    limit_per_class: int,
) -> List[dict]:
    import pyarrow.parquet as pq

    records: List[dict] = []
    kept_per_class: Counter = Counter()
    skipped_undecodable = 0
    author_split_counts: Counter = Counter()

    for name in shards:
        path = ensure_shard(name, raw_dir, repo, no_download)
        if path is None:
            continue
        print(f"[read] {name}")
        parquet = pq.ParquetFile(path)
        for row_group in range(parquet.num_row_groups):
            table = parquet.read_row_group(row_group, columns=["image", "label"])
            for row in table.to_pylist():
                label = (row.get("label") or "").strip()
                if not label:
                    continue
                if limit_per_class and kept_per_class[label] >= limit_per_class:
                    continue
                jpeg = decode_jpeg(row.get("image") or {})
                if jpeg is None:
                    skipped_undecodable += 1
                    continue
                author_split_counts[split] += 1
                kept_per_class[label] += 1
                index = kept_per_class[label]
                class_dir = images_root / label
                class_dir.mkdir(parents=True, exist_ok=True)
                file_path = class_dir / f"{split}_{index:05d}.jpg"
                file_path.write_bytes(jpeg)
                records.append(
                    {
                        "image": str(file_path.relative_to(data_root)),
                        "raw_label": label,
                        "source": SOURCE,
                        # None => build_manifest re-stratifies; see module docstring.
                        "source_split": None,
                    }
                )

    if skipped_undecodable:
        print(f"[warn] skipped {skipped_undecodable} undecodable image(s)", file=sys.stderr)
    return records, author_split_counts


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT,
                        help=f"image root that manifest paths are relative to (default: {DEFAULT_DATA_ROOT})")
    parser.add_argument("--repo", default=REPO, help=f"Hugging Face dataset repo (default: {REPO})")
    parser.add_argument("--splits", default="train,validation,test",
                        help="comma-separated splits to import (default: train,validation,test)")
    parser.add_argument("--limit-per-class", type=int, default=0,
                        help="keep at most N images per class across all splits (0 = all); handy for a smoke run")
    parser.add_argument("--out", type=Path, default=None,
                        help="index output (default: <data-root>/processed/indianfood.index.jsonl)")
    parser.add_argument("--no-download", action="store_true",
                        help="only use shards already present under <data-root>/raw/indianfood")
    args = parser.parse_args(argv)

    try:
        import pyarrow  # noqa: F401
        from PIL import Image  # noqa: F401
    except ImportError as exc:
        print(f"[error] {exc}", file=sys.stderr)
        print("        This importer needs pyarrow and Pillow: pip install pyarrow pillow", file=sys.stderr)
        return 2

    data_root = args.data_root.resolve()
    raw_dir = data_root / "raw" / "indianfood"
    images_root = raw_dir / "images"
    out_path = args.out or (data_root / "processed" / "indianfood.index.jsonl")
    images_root.mkdir(parents=True, exist_ok=True)

    wanted = [s.strip() for s in args.splits.split(",") if s.strip()]
    for split in wanted:
        if split not in SPLITS:
            print(f"[error] unknown split {split!r}; choose from {', '.join(SPLITS)}", file=sys.stderr)
            return 2

    records: List[dict] = []
    author_totals: Counter = Counter()
    for split in wanted:
        split_records, counts = index_split(
            split, SPLITS[split], raw_dir, images_root, data_root,
            args.repo, args.no_download, args.limit_per_class,
        )
        records.extend(split_records)
        author_totals.update(counts)

    if not records:
        print("[error] no images imported", file=sys.stderr)
        return 2

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    classes = sorted({r["raw_label"] for r in records})
    print()
    print(f"[index] wrote {len(records)} records across {len(classes)} classes -> {out_path}")
    print(f"[index] author split counts (re-stratified by build_manifest): {dict(author_totals)}")
    if len(classes) < EXPECTED_CLASSES and args.limit_per_class:
        print(f"[index] note: {len(classes)} classes present because --limit-per-class trims sparse classes last")
    elif len(classes) < EXPECTED_CLASSES:
        print(f"[warn] expected {EXPECTED_CLASSES} classes, found {len(classes)}", file=sys.stderr)
    print()
    print("Licence: CC BY 4.0 (declared on the dataset card). Cite the dataset and confirm image")
    print("rights before redistributing. Source: SohlHealth/enhanced-indian-food-classification.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
