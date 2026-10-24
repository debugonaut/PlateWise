"""Torch dataset over a built manifest, plus the transforms used by training.

Requires torch, torchvision and Pillow. Importing this module without them
raises ``ImportError``; the training scripts translate that into a friendly
"run pip install -r requirements.txt" message.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import torch
from PIL import Image
from torch.utils.data import Dataset
from torchvision import transforms

# ImageNet statistics: both backbones are initialised from ImageNet weights, so
# the same normalisation applies at train time and at browser inference time.
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def build_transform(image_size: int = 224, train: bool = False):
    """Augmentation for training; deterministic resize + centre crop for eval.

    The plan's recipe calls for flips, colour jitter and random crops. MixUp is
    available in the training loop rather than here because it mixes two samples
    and therefore cannot live inside a per-sample transform.
    """
    if train:
        return transforms.Compose(
            [
                transforms.RandomResizedCrop(image_size, scale=(0.6, 1.0), ratio=(0.8, 1.25)),
                transforms.RandomHorizontalFlip(),
                transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.05),
                transforms.ToTensor(),
                transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            ]
        )
    return transforms.Compose(
        [
            transforms.Resize(int(image_size * 256 / 224)),
            transforms.CenterCrop(image_size),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )


def class_index_from_map(class_map: Dict) -> Dict[str, int]:
    """``slug -> id``, taken straight from the class map so ids stay stable."""
    return {entry["slug"]: int(entry["id"]) for entry in class_map["classes"]}


def records_for_split(records: Sequence[dict], split: str) -> List[dict]:
    return [record for record in records if record.get("split") == split]


class MultiLabelManifestDataset(Dataset):
    """Reads ``<images_root>/<record["image"]>`` and emits a multi-hot target.

    A second (non-float) return value carries the record index so a training
    loop can report exactly which file failed to decode.
    """

    def __init__(
        self,
        records: Sequence[dict],
        class_index: Dict[str, int],
        images_root: Path,
        transform=None,
        num_classes: Optional[int] = None,
    ) -> None:
        self.records = list(records)
        self.class_index = dict(class_index)
        self.images_root = Path(images_root)
        self.transform = transform
        self.num_classes = num_classes if num_classes is not None else len(self.class_index)

    def __len__(self) -> int:
        return len(self.records)

    def image_path(self, index: int) -> Path:
        return self.images_root / self.records[index]["image"]

    def __getitem__(self, index: int) -> Tuple[torch.Tensor, torch.Tensor, int]:
        record = self.records[index]
        path = self.image_path(index)
        try:
            with Image.open(path) as handle:
                image = handle.convert("RGB")
        except (OSError, FileNotFoundError) as exc:
            raise RuntimeError(f"could not read image {path}: {exc}") from exc

        if self.transform is not None:
            image = self.transform(image)

        target = torch.zeros(self.num_classes, dtype=torch.float32)
        for label in record.get("labels", []):
            class_id = self.class_index.get(label)
            if class_id is not None:
                target[class_id] = 1.0
        return image, target, index

    def label_matrix(self) -> torch.Tensor:
        """Dense ``[N, num_classes]`` target matrix (used for pos_weight)."""
        matrix = torch.zeros((len(self.records), self.num_classes), dtype=torch.float32)
        for row, record in enumerate(self.records):
            for label in record.get("labels", []):
                class_id = self.class_index.get(label)
                if class_id is not None:
                    matrix[row, class_id] = 1.0
        return matrix


def compute_pos_weight(matrix: torch.Tensor, max_weight: float = 50.0) -> torch.Tensor:
    """``negatives / positives`` per class, which is what BCEWithLogitsLoss wants.

    This is the multi-label alternative to WeightedRandomSampler: a sampler
    rebalances which images appear, but with one head predicting many labels at
    once it cannot fix per-class imbalance. Weighting the positive term can, and
    it is cheap to compute. Classes with no positives get weight 1.0.
    """
    positives = matrix.sum(dim=0)
    negatives = matrix.shape[0] - positives
    weight = torch.where(positives > 0, negatives / positives.clamp(min=1.0), torch.ones_like(positives))
    return weight.clamp(max=max_weight)
