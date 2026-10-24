"""Build, split and validate the unified multi-label training manifest.

A manifest is a JSON Lines file, one record per image::

    {"image": "vegfru/Chinese_chestnut/f_07_03_0001.jpg",
     "source": "vegfru",
     "split": "train",
     "kind": "ingredient",
     "labels": ["chinese_chestnut"]}

Labels are class-map slugs, so a record can carry several of them (VegFru and
Food-101 are single-label, but the format and the loss are multi-label so that
future sources can contribute more than one ingredient per photo).

Standard library only.
"""

from __future__ import annotations

import json
import random
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from .taxonomy import CATEGORIES, DISH_CATEGORY

MANIFEST_VERSION = 1

VALID_SPLITS = ("train", "val", "test")


# --------------------------------------------------------------------------
# Plain JSON / JSONL helpers
# --------------------------------------------------------------------------
def read_jsonl(path: Path) -> List[dict]:
    records: List[dict] = []
    with Path(path).open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}:{line_number} is not valid JSON: {exc}") from exc
    return records


def write_jsonl(path: Path, records: Iterable[dict]) -> int:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1
    return count


def write_json(path: Path, payload: dict) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def read_json(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


# --------------------------------------------------------------------------
# Class map
# --------------------------------------------------------------------------
def build_class_map(label_records: Iterable[dict], version: int = MANIFEST_VERSION) -> dict:
    """Collapse per-source label records into a stable, sorted class map.

    Class ids are assigned after sorting by slug, so regenerating the map from
    the same sources produces the same ids -- important because a checkpoint's
    output layer is tied to this ordering.
    """
    by_slug: Dict[str, dict] = {}
    for record in label_records:
        slug = record["slug"]
        entry = by_slug.setdefault(
            slug,
            {
                "slug": slug,
                "name": record["name"],
                "category": record["category"],
                "kind": record["kind"],
                "canonical": record.get("canonical"),
                "sources": [],
            },
        )
        source = record.get("source")
        if source and source not in entry["sources"]:
            entry["sources"].append(source)
        if not entry.get("canonical") and record.get("canonical"):
            entry["canonical"] = record["canonical"]

    classes = sorted(by_slug.values(), key=lambda entry: entry["slug"])
    for index, entry in enumerate(classes):
        entry["id"] = index
        entry["sources"].sort()

    return {
        "version": version,
        "categories": list(CATEGORIES),
        "dish_category": DISH_CATEGORY,
        "num_classes": len(classes),
        "classes": classes,
    }


def slug_set(class_map: dict) -> set:
    return {entry["slug"] for entry in class_map.get("classes", [])}


# --------------------------------------------------------------------------
# Splitting
# --------------------------------------------------------------------------
def split_records(
    records: Sequence[dict],
    val_frac: float = 0.15,
    test_frac: float = 0.15,
    seed: int = 1337,
) -> List[dict]:
    """Stratify by primary label and assign a split to every record.

    Groups smaller than three images go entirely to ``train``: carving a
    one-image validation slice out of them would leave nothing to learn from.
    """
    if val_frac < 0 or test_frac < 0 or val_frac + test_frac >= 1:
        raise ValueError("val_frac and test_frac must be >= 0 and sum to < 1")

    grouped: Dict[str, List[dict]] = defaultdict(list)
    for record in records:
        labels = record.get("labels") or []
        primary = labels[0] if labels else "__unlabelled__"
        grouped[primary].append(record)

    rng = random.Random(seed)
    split_names = sorted(grouped.keys())
    rng.shuffle(split_names)

    assigned: List[dict] = []
    for primary in split_names:
        group = list(grouped[primary])
        rng.shuffle(group)
        total = len(group)

        if total < 3:
            n_val = n_test = 0
        else:
            n_val = int(total * val_frac)
            n_test = int(total * test_frac)
            # Always keep at least one training example per class.
            while n_val + n_test >= total:
                if n_test >= n_val and n_test > 0:
                    n_test -= 1
                elif n_val > 0:
                    n_val -= 1
                else:
                    break

        for index, record in enumerate(group):
            if index < n_val:
                split = "val"
            elif index < n_val + n_test:
                split = "test"
            else:
                split = "train"
            record["split"] = split
            assigned.append(record)

    assigned.sort(key=lambda record: (record["split"], record["image"]))
    return assigned


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------
def validate_manifest(
    records: Sequence[dict],
    class_map: dict,
    images_root: Optional[Path] = None,
    min_samples: int = 1,
) -> Tuple[List[str], List[str]]:
    """Return ``(errors, warnings)`` for a manifest read off disk.

    Errors mean the manifest cannot be trained on; warnings mean it will train
    but something is suspicious (thin classes, images missing on disk).
    """
    errors: List[str] = []
    warnings: List[str] = []

    if not records:
        errors.append("manifest is empty")
        return errors, warnings

    known = slug_set(class_map)
    if not known:
        errors.append("class map defines no classes")

    seen_images: Dict[str, int] = {}
    label_counts: Counter = Counter()
    unknown_labels: Counter = Counter()
    source_counts: Counter = Counter()
    split_counts: Counter = Counter()

    for index, record in enumerate(records):
        where = f"record {index} ({record.get('image', '<no image>')})"

        image = record.get("image")
        if not isinstance(image, str) or not image:
            errors.append(f"{where}: missing or empty 'image'")
            continue
        if Path(image).is_absolute():
            errors.append(f"{where}: 'image' must be relative, not absolute")
        if image in seen_images:
            errors.append(f"{where}: duplicate image, first seen at record {seen_images[image]}")
        else:
            seen_images[image] = index

        split = record.get("split")
        if split not in VALID_SPLITS:
            errors.append(f"{where}: split {split!r} not one of {VALID_SPLITS}")
        else:
            split_counts[split] += 1

        if not record.get("source"):
            errors.append(f"{where}: missing 'source'")

        labels = record.get("labels")
        if not isinstance(labels, list) or not labels:
            errors.append(f"{where}: 'labels' must be a non-empty list")
            continue
        for label in labels:
            if not isinstance(label, str) or not label:
                errors.append(f"{where}: label {label!r} is not a non-empty string")
                continue
            label_counts[label] += 1
            if label not in known:
                unknown_labels[label] += 1

        if images_root is not None and not (Path(images_root) / image).is_file():
            warnings.append(f"{where}: file not found under {images_root}")
        source_counts[str(record.get("source"))] += 1

    for label, count in sorted(unknown_labels.items()):
        errors.append(f"label {label!r} appears in {count} record(s) but not in the class map")

    unused = sorted(known - set(label_counts))
    if unused:
        warnings.append(f"{len(unused)} class(es) in the class map have no samples: {unused[:10]}")

    for label, count in sorted(label_counts.items()):
        if count < min_samples:
            warnings.append(f"class {label!r} has only {count} sample(s) (< min {min_samples})")

    if not split_counts.get("train"):
        errors.append("no training records after splitting")

    return errors, warnings


def manifest_stats(records: Sequence[dict], class_map: dict) -> dict:
    """Compact summary used by the CLI output and the README examples."""
    label_counts: Counter = Counter()
    kind_counts: Counter = Counter()
    split_counts: Counter = Counter()
    source_counts: Counter = Counter()

    for record in records:
        split_counts[record.get("split", "?")] += 1
        source_counts[str(record.get("source", "?"))] += 1
        for label in record.get("labels", []) or []:
            label_counts[label] += 1

    by_slug = {entry["slug"]: entry for entry in class_map.get("classes", [])}
    for slug, count in label_counts.items():
        kind = by_slug.get(slug, {}).get("kind", "unknown")
        kind_counts[kind] += count

    per_class = sorted(label_counts.items(), key=lambda item: (-item[1], item[0]))
    return {
        "num_images": len(records),
        "num_classes": class_map.get("num_classes", 0),
        "splits": dict(sorted(split_counts.items())),
        "sources": dict(sorted(source_counts.items())),
        "labels_by_kind": dict(sorted(kind_counts.items())),
        "busiest_classes": per_class[:5],
        "thinnest_classes": per_class[-5:] if len(per_class) > 5 else per_class,
    }
