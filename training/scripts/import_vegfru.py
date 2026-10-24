#!/usr/bin/env python3
"""Index a local copy of VegFru and emit a per-source index for the manifest.

VegFru (USTC) -- 292 fine-grained vegetable and fruit classes, grouped into 25
categories. Cite: Hou, Feng, Wang, "VegFru: A Domain-Specific Dataset for
Fine-grained Visual Categorization", ICCV 2017.

WHY THIS SCRIPT DOES NOT DOWNLOAD ANYTHING
------------------------------------------
The dataset is no longer obtainable from its official source:

* the README in ``ustc-vim/vegfru`` points at a Baidu Pan share
  (``http://pan.baidu.com/s/1boSNcV9``) that now reports itself as expired;
* that GitHub repository contains the HybridNet training code only -- it has no
  ``category.txt`` / ``subcategory.txt`` / split files and no images;
* the mirrors that do exist (a ~14 GB Kaggle copy and ~28 GB Hugging Face
  archives) are third-party redistributions with unclear licensing.

So you supply the images and this script builds the index. Point ``--images-dir``
at a directory whose immediate sub-directories are class names::

    <images-dir>/
      Apple/          *.jpg
      Banana/         *.jpg
      Chinese chestnut/  *.jpg
      ...

Some copies nest one extra level (e.g. ``fru92_images/<class>/``); use
``--images-dir <root>/fru92_images``, or ``--class-depth`` if the class sits
deeper. Use ``--archive`` to extract a ``.zip``/``.tar.gz``/``.tar`` first.

The manifest's train/val/test split is generated later by ``build_manifest.py``
because no authoritative VegFru split metadata could be verified.

Standard library only.
"""

from __future__ import annotations

import argparse
import json
import sys
import tarfile
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, List, Optional

SOURCE = "vegfru"
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")
DEFAULT_DATA_ROOT = Path(__file__).resolve().parents[1] / "data"

LICENSE_NOTE = """\
Licensing: the VegFru repository code is Apache-2.0, but that license does NOT
cover the images. No dataset-specific terms could be verified from a working
primary source. Treat any mirror you obtained as unlicensed unless you have
confirmed otherwise, and do not redistribute the images.
Official citation: Hou, Feng, Wang, ICCV 2017 (VegFru)."""


def extract_archive(archive: Path, dest: Path) -> None:
    dest = dest.resolve()
    dest.mkdir(parents=True, exist_ok=True)
    suffix = archive.name.lower()
    if suffix.endswith(".zip"):
        with zipfile.ZipFile(archive) as zf:
            _guard_zip(zf, dest)
            zf.extractall(dest)
        print(f"[extract] zip -> {dest}")
        return
    if suffix.endswith((".tar.gz", ".tgz", ".tar")):
        mode = "r:gz" if suffix.endswith((".tar.gz", ".tgz")) else "r:"
        with tarfile.open(archive, mode) as tar:
            members = []
            for member in tar.getmembers():
                target = (dest / member.name).resolve()
                if target != dest and not str(target).startswith(str(dest) + os.sep):
                    raise ValueError(f"refusing to extract outside destination: {member.name}")
                if member.issym() or member.islnk():
                    raise ValueError(f"refusing to extract link member: {member.name}")
                members.append(member)
            tar.extractall(dest, members=members)
        print(f"[extract] tar -> {dest}")
        return
    raise ValueError(f"unsupported archive type: {archive.name} (expected .zip, .tar.gz or .tar)")


def _guard_zip(zf: zipfile.ZipFile, dest: Path) -> None:
    for info in zf.infolist():
        target = (dest / info.filename).resolve()
        if target != dest and not str(target).startswith(str(dest) + os.sep):
            raise ValueError(f"refusing to extract outside destination: {info.filename}")


def classify_by_parent(images_dir: Path, class_depth: int) -> Dict[str, List[Path]]:
    """Group image files by the directory that names their class."""
    grouped: Dict[str, List[Path]] = defaultdict(list)
    if class_depth < 1:
        raise ValueError("--class-depth must be >= 1")

    for path in sorted(images_dir.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        try:
            relative = path.relative_to(images_dir)
        except ValueError:
            continue
        if len(relative.parts) < class_depth + 1:
            continue
        class_name = relative.parts[class_depth - 1].strip()
        if class_name:
            grouped[class_name].append(path)
    return grouped


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT,
                        help=f"image root that manifest paths are relative to (default: {DEFAULT_DATA_ROOT})")
    parser.add_argument("--images-dir", type=Path, default=None,
                        help="directory whose immediate sub-directories are class names")
    parser.add_argument("--archive", type=Path, default=None,
                        help=".zip/.tar.gz/.tar to extract into <data-root>/raw/vegfru before indexing")
    parser.add_argument("--class-depth", type=int, default=1,
                        help="how many directory levels below --images-dir name the class (default: 1)")
    parser.add_argument("--out", type=Path, default=None,
                        help="index output (default: <data-root>/processed/vegfru.index.jsonl)")
    parser.add_argument("--limit-per-class", type=int, default=0,
                        help="keep at most N images per class (0 = all)")
    args = parser.parse_args(argv)

    data_root = args.data_root.resolve()
    data_root.mkdir(parents=True, exist_ok=True)

    if args.images_dir is None and args.archive is None:
        print("[error] supply --images-dir (preferred) or --archive.\n", file=sys.stderr)
        print("        There is no download URL to fall back on: the official VegFru", file=sys.stderr)
        print("        Baidu Pan share is expired and the GitHub repo carries no images.", file=sys.stderr)
        return 2

    images_dir = args.images_dir
    if images_dir is None:
        extract_root = data_root / "raw"
        if not args.archive.is_file():
            print(f"[error] --archive {args.archive} does not exist", file=sys.stderr)
            return 2
        extract_archive(args.archive, extract_root)
        candidates = sorted(p for p in extract_root.iterdir() if p.is_dir())
        images_dir = candidates[0] if candidates else extract_root

    images_dir = images_dir.resolve()
    if not images_dir.is_dir():
        print(f"[error] {images_dir} is not a directory", file=sys.stderr)
        return 2

    grouped = classify_by_parent(images_dir, args.class_depth)
    if not grouped:
        print(f"[error] no images found under {images_dir}", file=sys.stderr)
        print(f"        Looked for {', '.join(IMAGE_EXTENSIONS)} at class depth {args.class_depth}.", file=sys.stderr)
        return 2

    out_path = args.out or (data_root / "processed" / "vegfru.index.jsonl")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    records: List[dict] = []
    for class_name in sorted(grouped):
        files = sorted(grouped[class_name])
        if args.limit_per_class > 0:
            files = files[: args.limit_per_class]
        for path in files:
            records.append(
                {
                    "image": str(path.relative_to(data_root)),
                    "raw_label": class_name,
                    "source": SOURCE,
                }
            )

    if not records:
        print("[error] no records produced", file=sys.stderr)
        return 2

    with out_path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    classes_path = out_path.with_suffix(".classes.json")
    class_names = sorted(grouped)
    classes_path.write_text(json.dumps(class_names, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    sizes = Counter({name: len(files) for name, files in grouped.items()})
    per_class = sorted(sizes.values())
    print(f"[index] images root: {images_dir}")
    print(f"[index] classes: {len(class_names)}")
    print(f"[index] images: {len(records)}")
    print(f"[index] per-class: min {per_class[0]}, median {per_class[len(per_class) // 2]}, max {per_class[-1]}")
    print(f"[index] smallest classes: {sizes.most_common()[-3:]}")
    print(f"[index] wrote {out_path}")
    print(f"[index] wrote {classes_path}")
    print()
    print(LICENSE_NOTE)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
