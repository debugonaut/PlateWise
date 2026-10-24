#!/usr/bin/env python3
"""Fine-tune MobileNetV3 / EfficientNet-B0 as a multi-label food classifier.

This follows the recipe in PLAN.md section 11:

1. start from ImageNet-pretrained weights,
2. replace the classifier with a multi-label head over the manifest's classes,
3. train with a binary cross-entropy objective,
4. augment with flips, colour jitter, random crops and MixUp.

Two deviations from that recipe, both deliberate:

* **pos_weight instead of WeightedRandomSampler.** A per-sample sampler cannot
  rebalance individual classes when one head predicts many labels at once.
  Weighting the positive term of BCE can, and costs nothing.
* **the official test split is never trained on.** If a source shipped one
  (Food-101 does), ``build_manifest.py`` locked it to ``test`` and this script
  only ever reads ``train`` and ``val``.

    python3 scripts/train.py --backbone mobilenet_v3_large --epochs 8

Checkpoints are written to ``<out>/best.pt`` and ``<out>/last.pt``, each carrying
the full class map so ``evaluate.py`` and ``export_tfjs.py`` do not need to be
told the label ordering.
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from platewise_ml import manifest as mf  # noqa: E402

DEFAULT_DATA_ROOT = Path(__file__).resolve().parents[1] / "data"
DEFAULT_OUT = Path(__file__).resolve().parents[1] / "artifacts"
BACKBONES = ("mobilenet_v3_large", "mobilenet_v3_small", "efficientnet_b0")


def load_config(path: Optional[Path]) -> Dict:
    if path is None:
        return {}
    if not path.is_file():
        raise SystemExit(f"config not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def build_model(torch, models, nn, backbone: str, num_classes: int, pretrained: bool):
    """Swap the 1000-class ImageNet head for a ``num_classes`` multi-label head."""
    if backbone == "mobilenet_v3_large":
        weights = models.MobileNet_V3_Large_Weights.DEFAULT if pretrained else None
        model = models.mobilenet_v3_large(weights=weights)
        model.classifier[3] = nn.Linear(model.classifier[3].in_features, num_classes)
    elif backbone == "mobilenet_v3_small":
        weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
        model = models.mobilenet_v3_small(weights=weights)
        model.classifier[3] = nn.Linear(model.classifier[3].in_features, num_classes)
    elif backbone == "efficientnet_b0":
        weights = models.EfficientNet_B0_Weights.DEFAULT if pretrained else None
        model = models.efficientnet_b0(weights=weights)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
    else:
        raise SystemExit(f"unsupported backbone {backbone!r}; choose from {', '.join(BACKBONES)}")
    return model


def freeze_backbone(model) -> int:
    """Freeze everything except ``classifier`` (both backbones use that name)."""
    frozen = 0
    for name, parameter in model.named_parameters():
        if not name.startswith("classifier"):
            parameter.requires_grad = False
            frozen += parameter.numel()
    return frozen


def mixup_batch(torch, images, targets, alpha: float, rng: random.Random):
    """Convex combination of a batch with a shuffled copy of itself."""
    if alpha <= 0:
        return images, targets
    lam = rng.betavariate(alpha, alpha)
    index = torch.randperm(images.size(0), device=images.device)
    return lam * images + (1.0 - lam) * images[index], lam * targets + (1.0 - lam) * targets[index]


def make_grad_scaler(torch, enabled: bool):
    """``torch.amp.GradScaler`` on torch >= 2.3, the older path before that."""
    if not enabled:
        return None
    try:
        return torch.amp.GradScaler("cuda", enabled=True)
    except (AttributeError, TypeError):
        return torch.cuda.amp.GradScaler(enabled=True)


def pick_device(torch, requested: str):
    if requested != "auto":
        return torch.device(requested)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", type=Path, default=None, help="JSON config to read defaults from")
    parser.add_argument("--data-root", type=Path, default=None, help=f"default: {DEFAULT_DATA_ROOT}")
    parser.add_argument("--manifest", type=Path, default=None, help="default: <data-root>/processed/manifest.jsonl")
    parser.add_argument("--class-map", type=Path, default=None, help="default: <data-root>/processed/class_map.json")
    parser.add_argument("--out", type=Path, default=None, help=f"checkpoint dir (default: {DEFAULT_OUT})")
    parser.add_argument("--backbone", default=None, choices=BACKBONES)
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=None)
    parser.add_argument("--lr", type=float, default=None)
    parser.add_argument("--weight-decay", type=float, default=None)
    parser.add_argument("--image-size", type=int, default=None)
    parser.add_argument("--mixup-alpha", type=float, default=None, help="0 disables MixUp")
    parser.add_argument("--num-workers", type=int, default=None)
    parser.add_argument("--device", default="auto", help="auto | cpu | cuda | mps (default: auto)")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--freeze-backbone", action="store_true", help="train the classifier head only")
    parser.add_argument("--no-pretrained", action="store_true", help="random init instead of ImageNet weights")
    parser.add_argument("--no-pos-weight", action="store_true", help="disable positive-class reweighting")
    parser.add_argument("--limit-train", type=int, default=0, help="cap training images, for a quick smoke run")
    parser.add_argument("--max-steps", type=int, default=0, help="stop an epoch after N optimizer steps")
    parser.add_argument("--force", action="store_true", help="train even if the manifest fails validation")
    args = parser.parse_args(argv)
    defaults = load_config(args.config)

    data_root = (args.data_root or DEFAULT_DATA_ROOT).resolve()
    args.data_root = data_root
    args.manifest = (args.manifest or (data_root / "processed" / "manifest.jsonl")).resolve()
    args.class_map = (args.class_map or (data_root / "processed" / "class_map.json")).resolve()
    args.out = (args.out or DEFAULT_OUT).resolve()

    settings = {
        "backbone": "mobilenet_v3_large",
        "epochs": 12,
        "batch_size": 32,
        "lr": 1e-3,
        "weight_decay": 1e-4,
        "image_size": 224,
        "mixup_alpha": 0.2,
        "num_workers": 0,
        "seed": 1337,
    }
    settings.update({key: value for key, value in defaults.items() if key in settings})
    for key in settings:
        value = getattr(args, key)
        if value is not None:
            settings[key] = value

    for path in (args.manifest, args.class_map):
        if not path.is_file():
            print(f"[error] missing {path}", file=sys.stderr)
            print("        Build it first: python3 scripts/build_manifest.py", file=sys.stderr)
            return 2

    try:
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader
        from torchvision import models

        from platewise_ml import datasets, metrics
    except ImportError as exc:
        print(f"[error] {exc}", file=sys.stderr)
        print("        Install the training extras: pip install -r requirements.txt", file=sys.stderr)
        return 2

    records = mf.read_jsonl(args.manifest)
    class_map = mf.read_json(args.class_map)

    errors, warnings = mf.validate_manifest(records, class_map, images_root=data_root)
    for warning in warnings[:10]:
        print(f"[warn] {warning}", file=sys.stderr)
    if errors:
        for error in errors:
            print(f"[error] {error}", file=sys.stderr)
        if not args.force:
            print("[error] refusing to train on an invalid manifest; pass --force to override", file=sys.stderr)
            return 1

    class_index = datasets.class_index_from_map(class_map)
    num_classes = class_map["num_classes"]

    train_records = datasets.records_for_split(records, "train")
    val_records = datasets.records_for_split(records, "val")
    if args.limit_train > 0:
        train_records = train_records[: args.limit_train]
    if not train_records:
        print("[error] no training records", file=sys.stderr)
        return 1
    if not val_records:
        print("[warn] no validation records; falling back to the training split for model selection",
              file=sys.stderr)
        val_records = train_records

    device = pick_device(torch, args.device)
    random.seed(settings["seed"])
    torch.manual_seed(settings["seed"])

    train_dataset = datasets.MultiLabelManifestDataset(
        train_records, class_index, data_root, datasets.build_transform(settings["image_size"], train=True),
        num_classes=num_classes,
    )
    val_dataset = datasets.MultiLabelManifestDataset(
        val_records, class_index, data_root, datasets.build_transform(settings["image_size"], train=False),
        num_classes=num_classes,
    )

    loader_kwargs = {
        "batch_size": settings["batch_size"],
        "num_workers": settings["num_workers"],
        "pin_memory": device.type == "cuda",
    }
    train_loader = DataLoader(train_dataset, shuffle=True, drop_last=len(train_dataset) > settings["batch_size"], **loader_kwargs)
    val_loader = DataLoader(val_dataset, shuffle=False, **loader_kwargs)

    model = build_model(torch, models, nn, settings["backbone"], num_classes, not args.no_pretrained)
    if args.freeze_backbone:
        frozen = freeze_backbone(model)
        print(f"[model] frozen {frozen:,} backbone parameters; training the head only")
    model.to(device)

    if args.no_pos_weight:
        pos_weight = None
    else:
        pos_weight = datasets.compute_pos_weight(train_dataset.label_matrix()).to(device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    parameters = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(parameters, lr=settings["lr"], weight_decay=settings["weight_decay"])
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max(1, settings["epochs"]))
    use_amp = device.type == "cuda"
    scaler = make_grad_scaler(torch, use_amp)

    print()
    print(f"[train] device        {device}")
    print(f"[train] backbone      {settings['backbone']} ({'ImageNet' if not args.no_pretrained else 'random'} init)")
    print(f"[train] classes       {num_classes}")
    print(f"[train] images        {len(train_records)} train / {len(val_records)} val")
    print(f"[train] batch/lr      {settings['batch_size']} / {settings['lr']}")
    print(f"[train] mixup alpha   {settings['mixup_alpha']}")
    print(f"[train] pos_weight    {'disabled' if pos_weight is None else 'enabled'}")
    print(f"[train] out           {args.out}")
    print()

    args.out.mkdir(parents=True, exist_ok=True)
    history: List[dict] = []
    best_metric = float("-inf")
    best_epoch = -1
    rng = random.Random(settings["seed"])

    for epoch in range(1, settings["epochs"] + 1):
        model.train()
        started = time.time()
        running_loss = 0.0
        seen = 0

        for step, (images, targets, _) in enumerate(train_loader, start=1):
            images = images.to(device, non_blocking=True)
            targets = targets.to(device, non_blocking=True)
            images, targets = mixup_batch(torch, images, targets, settings["mixup_alpha"], rng)

            optimizer.zero_grad(set_to_none=True)
            if use_amp:
                with torch.autocast(device_type="cuda", dtype=torch.float16):
                    loss = criterion(model(images), targets)
                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()
            else:
                loss = criterion(model(images), targets)
                loss.backward()
                optimizer.step()

            running_loss += float(loss.item()) * images.size(0)
            seen += images.size(0)
            if args.max_steps and step >= args.max_steps:
                break

        scheduler.step()

        predictions = metrics.collect_logits(model, val_loader, device, use_amp=False)
        summary = metrics.summarise(predictions["logits"], predictions["targets"], class_map)

        macro_ap = summary["macro_ap"]
        selection = macro_ap if macro_ap == macro_ap else summary["top1"]["accuracy"]
        if selection != selection:  # still nan
            selection = 0.0

        epoch_record = {
            "epoch": epoch,
            "train_loss": running_loss / max(1, seen),
            "seconds": round(time.time() - started, 1),
            "lr": optimizer.param_groups[0]["lr"],
            "val_top1": summary["top1"]["accuracy"],
            "val_top5": summary["top5"]["accuracy"],
            "val_macro_ap": summary["macro_ap"],
            "val_micro_ap": summary["micro_ap"],
        }
        history.append(epoch_record)

        marker = ""
        if selection > best_metric:
            best_metric = selection
            best_epoch = epoch
            marker = "  <- best"
            checkpoint = {
                "state_dict": {k: v.cpu() for k, v in model.state_dict().items()},
                "backbone": settings["backbone"],
                "num_classes": num_classes,
                "image_size": settings["image_size"],
                "class_map": class_map,
                "normalisation": {"mean": list(datasets.IMAGENET_MEAN), "std": list(datasets.IMAGENET_STD)},
                "epoch": epoch,
                "val_metrics": {k: v for k, v in summary.items() if k != "per_class"},
                "settings": settings,
            }
            torch.save(checkpoint, args.out / "best.pt")

        print(
            f"[epoch {epoch:>3}/{settings['epochs']}] "
            f"loss {epoch_record['train_loss']:.4f}  "
            f"top1 {epoch_record['val_top1']:.4f}  "
            f"top5 {epoch_record['val_top5']:.4f}  "
            f"mAP {epoch_record['val_macro_ap']:.4f}  "
            f"({epoch_record['seconds']}s){marker}"
        )

    torch.save(
        {
            "state_dict": {k: v.cpu() for k, v in model.state_dict().items()},
            "backbone": settings["backbone"],
            "num_classes": num_classes,
            "image_size": settings["image_size"],
            "class_map": class_map,
            "epoch": settings["epochs"],
            "settings": settings,
        },
        args.out / "last.pt",
    )

    mf.write_json(
        args.out / "training_log.json",
        {
            "settings": settings,
            "device": str(device),
            "train_images": len(train_records),
            "val_images": len(val_records),
            "best_epoch": best_epoch,
            "history": history,
        },
    )

    print()
    print(f"[done] best epoch {best_epoch} (selection metric {best_metric:.4f})")
    print(f"[done] {args.out / 'best.pt'}")
    print(f"[done] {args.out / 'training_log.json'}")
    print()
    print("Next: python3 scripts/evaluate.py --split test --checkpoint "
          f"{args.out / 'best.pt'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
