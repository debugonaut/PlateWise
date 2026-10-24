#!/usr/bin/env python3
"""Merge per-source indexes into one multi-label manifest, class map and split.

Typical use::

    python3 scripts/import_food101.py --limit-per-class 20
    python3 scripts/import_vegfru.py --images-dir /path/to/vegfru
    python3 scripts/build_manifest.py

Outputs, all under ``<data-root>/processed``:

* ``manifest.jsonl``   one record per image (``image``, ``source``, ``split``,
                       ``kind``, ``labels``)
* ``class_map.json``   stable id -> class entry, with the app's canonical
                       ingredient name where one could be resolved
* ``splits/*.txt``     plain image-path lists per split
* ``stats.json``       counts, per-source totals and dropped classes

Split policy: a source that ships an authoritative test split (Food-101's
``meta/test.json``) has that split locked to ``test``; the remaining images are
stratified into ``train``/``val``. Sources without split metadata are stratified
across all three. Locking the official test set keeps the held-out score honest.

Standard library only.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from platewise_ml import manifest as mf  # noqa: E402
from platewise_ml import taxonomy as tx  # noqa: E402

DEFAULT_DATA_ROOT = Path(__file__).resolve().parents[1] / "data"

# Which label kind each source contributes. Dishes (Food-101) are cooked plates,
# ingredients (VegFru) are raw produce; they share one multi-label head but are
# reported separately so the app can ignore dish labels when building a pantry.
DEFAULT_SOURCE_KIND = {
    "vegfru": tx.KIND_INGREDIENT,
    "food101": tx.KIND_DISH,
    "indianfood": tx.KIND_DISH,
}


def discover_indexes(data_root: Path) -> List[Path]:
    processed = data_root / "processed"
    return sorted(processed.glob("*.index.jsonl"))


def parse_kind_overrides(pairs: Optional[List[str]]) -> Dict[str, str]:
    overrides: Dict[str, str] = {}
    for pair in pairs or []:
        if "=" not in pair:
            raise SystemExit(f"--kind expects SOURCE=KIND, got {pair!r}")
        source, kind = pair.split("=", 1)
        kind = kind.strip()
        if kind not in (tx.KIND_INGREDIENT, tx.KIND_DISH):
            raise SystemExit(f"--kind {source}: kind must be {tx.KIND_INGREDIENT!r} or {tx.KIND_DISH!r}")
        overrides[source.strip()] = kind
    return overrides


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT,
                        help=f"image root that manifest paths are relative to (default: {DEFAULT_DATA_ROOT})")
    parser.add_argument("--index", type=Path, action="append", default=None,
                        help="per-source index to read (repeatable; default: every processed/*.index.jsonl)")
    parser.add_argument("--out-dir", type=Path, default=None,
                        help="where to write the manifest (default: <data-root>/processed)")
    parser.add_argument("--val-frac", type=float, default=0.15, help="validation fraction (default: 0.15)")
    parser.add_argument("--test-frac", type=float, default=0.15,
                        help="test fraction for sources without an official split (default: 0.15)")
    parser.add_argument("--seed", type=int, default=1337, help="split RNG seed (default: 1337)")
    parser.add_argument("--kind", action="append", default=None, metavar="SOURCE=KIND",
                        help="override the label kind for a source (e.g. food101=ingredient)")
    parser.add_argument("--no-canonical", action="store_true",
                        help="do not resolve labels against the app's pantry list")
    parser.add_argument("--min-samples-per-class", type=int, default=1,
                        help="drop classes with fewer samples than this (default: 1)")
    args = parser.parse_args(argv)

    data_root = args.data_root.resolve()
    out_dir = (args.out_dir or (data_root / "processed")).resolve()
    index_paths = [p.resolve() for p in args.index] if args.index else discover_indexes(data_root)

    if not index_paths:
        print(f"[error] no index files found under {data_root / 'processed'}", file=sys.stderr)
        print("        Run scripts/import_food101.py, scripts/import_vegfru.py and/or", file=sys.stderr)
        print("        scripts/import_indian_food.py first.", file=sys.stderr)
        return 2

    kind_overrides = parse_kind_overrides(args.kind)
    index = None if args.no_canonical else tx.CanonicalIndex()

    raw_records: List[dict] = []
    for path in index_paths:
        if not path.is_file():
            print(f"[error] index not found: {path}", file=sys.stderr)
            return 2
        records = mf.read_jsonl(path)
        print(f"[read] {len(records):>7} records  {path}")
        raw_records.extend(records)

    if not raw_records:
        print("[error] indexes contained no records", file=sys.stderr)
        return 2

    # ---- labels -> class map ------------------------------------------------
    sources = sorted({str(record.get("source", "unknown")) for record in raw_records})
    kind_for: Dict[str, str] = {}
    for source in sources:
        if source in kind_overrides:
            kind_for[source] = kind_overrides[source]
        elif source in DEFAULT_SOURCE_KIND:
            kind_for[source] = DEFAULT_SOURCE_KIND[source]
        else:
            kind_for[source] = tx.KIND_INGREDIENT
            print(f"[warn] unknown source {source!r}; treating its labels as ingredients "
                  f"(override with --kind {source}=dish)", file=sys.stderr)

    # One label record per (source, raw_label) so shared classes merge cleanly.
    label_records: List[dict] = []
    for source in sources:
        raw_labels = sorted({str(r.get("raw_label")) for r in raw_records if str(r.get("source")) == source})
        for raw_label in raw_labels:
            label_records.append(tx.build_label_record(raw_label, source, kind_for[source], index))

    class_map = mf.build_class_map(label_records)
    known = mf.slug_set(class_map)
    print(f"[labels] {class_map['num_classes']} classes from {len(sources)} source(s): {', '.join(sources)}")

    # ---- records -> manifest ----------------------------------------------
    label_of = {}
    for record in label_records:
        label_of[(record["source"], record["raw"])] = record["slug"]

    built: List[dict] = []
    skipped_no_label = 0
    for record in raw_records:
        key = (str(record.get("source")), str(record.get("raw_label")))
        slug = label_of.get(key)
        if not slug or slug not in known:
            skipped_no_label += 1
            continue
        built.append(
            {
                "image": record["image"],
                "source": str(record.get("source")),
                "kind": kind_for[str(record.get("source"))],
                "labels": [slug],
                "source_split": record.get("source_split"),
            }
        )
    if skipped_no_label:
        print(f"[warn] skipped {skipped_no_label} record(s) with an unmapped label", file=sys.stderr)

    # ---- drop thin classes -------------------------------------------------
    counts = Counter(label for record in built for label in record["labels"])
    dropped = sorted(slug for slug, count in counts.items() if count < args.min_samples_per_class)
    if dropped:
        built = [
            {**record, "labels": [l for l in record["labels"] if l not in set(dropped)]}
            for record in built
        ]
        built = [record for record in built if record["labels"]]
        class_map = mf.build_class_map(
            [record for record in label_records if record["slug"] not in set(dropped)]
        )
        print(f"[thin] dropped {len(dropped)} class(es) with < {args.min_samples_per_class} samples: "
              f"{dropped[:10]}", file=sys.stderr)

    if not built:
        print("[error] no records survived label mapping", file=sys.stderr)
        return 2

    # ---- splits -----------------------------------------------------------
    locked_test = [record for record in built if record.get("source_split") == "test"]
    rest = [record for record in built if record.get("source_split") != "test"]

    if locked_test:
        split_records = mf.split_records(rest, val_frac=args.val_frac, test_frac=0.0, seed=args.seed)
        for record in locked_test:
            record["split"] = "test"
        split_records.extend(locked_test)
        split_records.sort(key=lambda record: (record["split"], record["image"]))
        print(f"[split] locked {len(locked_test)} official test image(s); "
              f"stratified the rest into train/val")
        if args.test_frac > 0:
            print("[split] note: an official test split was present, so --test-frac was ignored")
    else:
        split_records = mf.split_records(built, val_frac=args.val_frac, test_frac=args.test_frac, seed=args.seed)
        print("[split] no official split metadata found; stratified all images across train/val/test")

    # ---- write ------------------------------------------------------------
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = out_dir / "manifest.jsonl"
    class_map_path = out_dir / "class_map.json"
    stats_path = out_dir / "stats.json"

    mf.write_jsonl(manifest_path, split_records)
    mf.write_json(class_map_path, class_map)

    splits_dir = out_dir / "splits"
    splits_dir.mkdir(parents=True, exist_ok=True)
    split_lists: Dict[str, List[str]] = {name: [] for name in mf.VALID_SPLITS}
    for record in split_records:
        split_lists[record["split"]].append(record["image"])
    for name, images in split_lists.items():
        (splits_dir / f"{name}.txt").write_text(
            "".join(f"{image}\n" for image in images), encoding="utf-8"
        )

    stats = mf.manifest_stats(split_records, class_map)
    resolved = sum(1 for entry in class_map["classes"] if entry.get("canonical"))
    stats["classes_resolved_to_app_pantry"] = resolved
    stats["dropped_thin_classes"] = dropped
    stats["indexes"] = [str(path) for path in index_paths]
    mf.write_json(stats_path, stats)

    errors, warnings = mf.validate_manifest(split_records, class_map, images_root=data_root)
    for warning in warnings[:20]:
        print(f"[warn] {warning}", file=sys.stderr)

    print()
    print(f"[manifest] {stats['num_images']} images, {stats['num_classes']} classes")
    print(f"[manifest] splits: {stats['splits']}")
    print(f"[manifest] sources: {stats['sources']}")
    print(f"[manifest] labels by kind: {stats['labels_by_kind']}")
    print(f"[manifest] {resolved}/{stats['num_classes']} classes resolved to an app pantry item")
    print(f"[manifest] {manifest_path}")
    print(f"[manifest] {class_map_path}")
    print(f"[manifest] {stats_path}")

    if errors:
        print()
        for error in errors:
            print(f"[error] {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
