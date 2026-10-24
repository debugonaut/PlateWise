#!/usr/bin/env python3
"""Fetch Food-101, verify it, and emit a per-source index for the manifest.

Food-101 (ETH Zurich) -- 101,000 photographs across 101 dish classes,
750 official train and 250 official test images per class.

    http://data.vision.ee.ethz.ch/cvl/food-101.tar.gz     (~5 GB)

Layout after extraction::

    food-101/
      images/<class_name>/<image_id>.jpg     # exactly 101 class directories
      meta/classes.txt                       # 101 lines, one class name each
      meta/train.json  meta/test.json        # authoritative splits
      meta/train.txt   meta/test.txt         # "<class>/<image_id>" lines
      license_agreement.txt
      README.txt

The JSON split files are what torchvision and TensorFlow Datasets read, so they
are preferred here, with the ``*.txt`` files as a fallback.

Cite: Bossard, Guillaumin, Van Gool, "Food-101 -- Mining Discriminative
Components with Random Forests", ECCV 2014.

Standard library only (urllib + tarfile), so this runs on a bare Python.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tarfile
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Dict, List, Optional

DOWNLOAD_URL = "http://data.vision.ee.ethz.ch/cvl/food-101.tar.gz"
USER_AGENT = "platewise-dataset-importer/1.0"
EXPECTED_CLASSES = 101
EXPECTED_TRAIN_TOTAL = 75_750
EXPECTED_TEST_TOTAL = 25_250
ARCHIVE_TOP_LEVEL = "food-101"

# The official archive is all .jpg, but mirrors re-encode, so resolve by stem.
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")

DEFAULT_DATA_ROOT = Path(__file__).resolve().parents[1] / "data"


def _human(size: float) -> str:
    for unit in ("B", "MB", "GB", "TB"):
        if abs(size) < 1024.0:
            return f"{size:3.1f}{unit}"
        size /= 1024.0
    return f"{size:.1f}PB"


def download(url: str, dest: Path, chunk: int = 1 << 20) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    print(f"[download] {url}")
    print(f"[download] -> {dest}")
    with urllib.request.urlopen(request, timeout=60) as response:
        total = int(response.headers.get("Content-Length") or 0)
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
                        pct = seen / total * 100
                        print(f"  {pct:5.1f}%  {_human(seen)} / {_human(total)}", flush=True)
                    else:
                        print(f"  {_human(seen)}", flush=True)
                    next_report = seen + 100 * chunk
    print(f"[download] complete: {_human(seen)}")
    return seen


def safe_extract(archive: Path, dest: Path) -> None:
    """Extract a tar.gz, refusing absolute paths, traversal and links."""
    dest = dest.resolve()
    dest.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive, "r:gz") as tar:
        members = []
        for member in tar.getmembers():
            target = (dest / member.name).resolve()
            if target != dest and not str(target).startswith(str(dest) + os.sep):
                raise ValueError(f"refusing to extract outside destination: {member.name}")
            if member.issym() or member.islnk():
                raise ValueError(f"refusing to extract link member: {member.name}")
            members.append(member)
        tar.extractall(dest, members=members)
    print(f"[extract] {len(members)} entries -> {dest}")


def _split_from_json(meta_dir: Path) -> Optional[Dict[str, List[str]]]:
    """Read meta/train.json + meta/test.json -> {"train": [...], "test": [...]}.

    Each file is either an object mapping class name to a list of image ids, or
    a flat list of "<class>/<image_id>" strings.
    """
    train_path = meta_dir / "train.json"
    test_path = meta_dir / "test.json"
    if not (train_path.is_file() and test_path.is_file()):
        return None

    def flatten(payload: object) -> List[str]:
        out: List[str] = []
        if isinstance(payload, dict):
            for class_name, image_ids in payload.items():
                if isinstance(image_ids, list):
                    out.extend(f"{class_name}/{image_id}" for image_id in image_ids)
        elif isinstance(payload, list):
            out.extend(str(entry) for entry in payload)
        return out

    return {
        "train": flatten(json.loads(train_path.read_text(encoding="utf-8"))),
        "test": flatten(json.loads(test_path.read_text(encoding="utf-8"))),
    }


def _split_from_txt(meta_dir: Path) -> Optional[Dict[str, List[str]]]:
    train_path = meta_dir / "train.txt"
    test_path = meta_dir / "test.txt"
    if not (train_path.is_file() and test_path.is_file()):
        return None

    def read_lines(path: Path) -> List[str]:
        return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]

    return {"train": read_lines(train_path), "test": read_lines(test_path)}


def read_classes(meta_dir: Path) -> List[str]:
    classes_path = meta_dir / "classes.txt"
    if not classes_path.is_file():
        raise FileNotFoundError(f"missing {classes_path}")
    classes = [line.strip() for line in classes_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(classes) != EXPECTED_CLASSES:
        print(
            f"[warn] meta/classes.txt lists {len(classes)} classes, expected {EXPECTED_CLASSES}",
            file=sys.stderr,
        )
    return classes


def verify(dataset_dir: Path) -> Dict[str, object]:
    """Check the extracted tree and report what is actually on disk."""
    meta_dir = dataset_dir / "meta"
    images_dir = dataset_dir / "images"
    classes = read_classes(meta_dir)

    class_dirs = sorted(p.name for p in images_dir.iterdir() if p.is_dir()) if images_dir.is_dir() else []
    on_disk = {
        name: sum(
            1
            for child in (images_dir / name).iterdir()
            if child.is_file() and child.suffix.lower() in IMAGE_EXTENSIONS
        )
        for name in class_dirs
    }

    problems: List[str] = []
    if class_dirs != sorted(classes):
        missing = sorted(set(classes) - set(class_dirs))
        extra = sorted(set(class_dirs) - set(classes))
        if missing:
            problems.append(f"{len(missing)} class directories missing (e.g. {missing[:3]})")
        if extra:
            problems.append(f"{len(extra)} unexpected class directories (e.g. {extra[:3]})")
    total = sum(on_disk.values())
    if total != EXPECTED_TRAIN_TOTAL + EXPECTED_TEST_TOTAL:
        problems.append(
            f"found {total} images, expected {EXPECTED_TRAIN_TOTAL + EXPECTED_TEST_TOTAL}"
        )

    splits = _split_from_json(meta_dir)
    split_source = "meta/{train,test}.json"
    if splits is None:
        splits = _split_from_txt(meta_dir)
        split_source = "meta/{train,test}.txt"
    if splits is None:
        problems.append("no split metadata found (meta/train.json + meta/test.json, or the .txt pair)")

    return {
        "classes": classes,
        "class_dirs": class_dirs,
        "image_counts": on_disk,
        "total_images": total,
        "splits": splits,
        "split_source": split_source,
        "problems": problems,
    }


def resolve_image(images_dir: Path, class_name: str, image_id: str) -> Optional[Path]:
    """Find the file behind a ``<class>/<image_id>`` metadata entry.

    Metadata ids normally omit the extension, and `image_id` may already end in
    `.jpg`; both shapes are handled, and the extension is probed.
    """
    stem = image_id
    for extension in IMAGE_EXTENSIONS:
        if stem.lower().endswith(extension):
            stem = stem[: -len(extension)]
            break
    class_dir = images_dir / class_name
    for extension in IMAGE_EXTENSIONS:
        candidate = class_dir / f"{stem}{extension}"
        if candidate.is_file():
            return candidate
    return None


def build_index(report: Dict[str, object], dataset_dir: Path, data_root: Path) -> List[dict]:
    """Turn the verified dataset into index records with relative image paths."""
    splits = report["splits"] or {}
    classes = set(report["classes"])
    records: List[dict] = []
    missing_files: Counter = Counter()

    for split_name, entries in (("train", splits.get("train", [])), ("test", splits.get("test", []))):
        for entry in entries:
            if "/" not in entry:
                continue
            class_name, image_id = entry.split("/", 1)
            if class_name not in classes:
                continue
            image_path = resolve_image(dataset_dir / "images", class_name, image_id)
            if image_path is None:
                missing_files[class_name] += 1
                continue
            records.append(
                {
                    "image": str(image_path.relative_to(data_root)),
                    "raw_label": class_name,
                    "source": "food101",
                    "source_split": split_name,
                }
            )

    if missing_files:
        total_missing = sum(missing_files.values())
        print(
            f"[warn] {total_missing} metadata entries had no image on disk "
            f"(e.g. class {missing_files.most_common(1)[0][0]})",
            file=sys.stderr,
        )
    return records


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT,
                        help=f"image root that manifest paths are relative to (default: {DEFAULT_DATA_ROOT})")
    parser.add_argument("--dest", type=Path, default=None,
                        help="directory to extract into (default: <data-root>/raw)")
    parser.add_argument("--archive", type=Path, default=None,
                        help="use an already-downloaded food-101.tar.gz instead of downloading")
    parser.add_argument("--url", default=DOWNLOAD_URL, help=f"override the download URL (default: {DOWNLOAD_URL})")
    parser.add_argument("--out", type=Path, default=None,
                        help="index output (default: <data-root>/processed/food101.index.jsonl)")
    parser.add_argument("--limit-per-class", type=int, default=0,
                        help="keep at most N images per class (0 = all); handy for a quick smoke run")
    parser.add_argument("--skip-download", action="store_true",
                        help="assume the archive is already extracted under --dest and only re-verify")
    parser.add_argument("--keep-archive", action="store_true", help="do not delete the .tar.gz after extraction")
    args = parser.parse_args(argv)

    data_root = args.data_root.resolve()
    dest = (args.dest or (data_root / "raw")).resolve()
    dataset_dir = dest / ARCHIVE_TOP_LEVEL
    out_path = args.out or (data_root / "processed" / "food101.index.jsonl")
    archive_path = (args.archive or (dest / "food-101.tar.gz")).resolve()

    data_root.mkdir(parents=True, exist_ok=True)

    if not args.skip_download and not dataset_dir.is_dir():
        if not archive_path.is_file():
            if args.archive:
                print(f"[error] --archive {archive_path} does not exist", file=sys.stderr)
                return 2
            try:
                download(args.url, archive_path)
            except Exception as exc:  # network, DNS, HTTP status
                print(f"[error] download failed: {exc}", file=sys.stderr)
                print(f"        Fetch {args.url} manually and re-run with --archive <path>.", file=sys.stderr)
                return 2
        safe_extract(archive_path, dest)
        if not args.keep_archive and not args.archive:
            archive_path.unlink(missing_ok=True)
    elif not dataset_dir.is_dir():
        print(f"[error] {dataset_dir} not found and --skip-download was set", file=sys.stderr)
        return 2

    report = verify(dataset_dir)
    print(f"[verify] split source: {report['split_source']}")
    print(f"[verify] classes: {len(report['class_dirs'])} directories on disk")
    print(f"[verify] images: {report['total_images']} (expected {EXPECTED_TRAIN_TOTAL + EXPECTED_TEST_TOTAL})")
    for problem in report["problems"]:
        print(f"[verify] PROBLEM: {problem}", file=sys.stderr)

    records = build_index(report, dataset_dir, data_root)

    if args.limit_per_class > 0:
        kept: Counter = Counter()
        limited = []
        for record in records:
            if kept[record["raw_label"]] >= args.limit_per_class:
                continue
            kept[record["raw_label"]] += 1
            limited.append(record)
        print(f"[limit] kept {len(limited)} of {len(records)} records (<= {args.limit_per_class}/class)")
        records = limited

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    by_split = Counter(record["source_split"] for record in records)
    print(f"[index] wrote {len(records)} records -> {out_path}")
    print(f"[index] splits: {dict(sorted(by_split.items()))}")
    print()
    print("Attribution: cite Bossard et al. (ECCV 2014) and read license_agreement.txt in the")
    print("dataset before redistributing the images.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
