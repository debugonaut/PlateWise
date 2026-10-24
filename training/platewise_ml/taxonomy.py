"""Canonical ingredient taxonomy for the PlateWise food-recognition pipeline.

The seven fridge categories defined here mirror ``FOOD_CATEGORIES`` in
``api/vision-scan.js``. Keeping the two in sync means labels produced by a
locally trained classifier can be fed straight into the app's pantry model
without a translation layer.

This module is deliberately standard-library only: the data-preparation steps
must run on a bare Python install, without torch, PIL or TensorFlow.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, Iterable, List, Optional

# --------------------------------------------------------------------------
# Categories -- keep in sync with FOOD_CATEGORIES in api/vision-scan.js
# --------------------------------------------------------------------------
CATEGORIES: List[str] = [
    "Produce",
    "Dairy",
    "Proteins & Nuts",
    "Oils & Sauces",
    "Grains & Pulses",
    "Spices",
    "Frozen",
]

# Cooked-dish labels scored against Food-101 are not fridge categories. They
# stay trainable targets (a leftover curry in the fridge is real signal) but
# the app is expected to ignore them when assembling a pantry list.
DISH_CATEGORY = "Prepared Dish"

DEFAULT_INGREDIENT_CATEGORY = "Produce"

KIND_INGREDIENT = "ingredient"
KIND_DISH = "dish"

# --------------------------------------------------------------------------
# Keyword rules for ingredient labels. First match wins, so order matters:
# narrower / more surprising rules come first ("bell pepper" is Produce, but
# a bare "pepper" is a Spice).
# --------------------------------------------------------------------------
_CATEGORY_RULES: List[tuple] = [
    # Produce exceptions that would otherwise be swallowed by later rules:
    # a bell pepper is not a spice, and a chestnut is produce, not a protein.
    ("Produce", (
        "bell pepper", "sweet pepper", "capsicum", "chilli pepper", "chili pepper",
        "chestnut", "water chestnut", "coconut", "groundnut",
    )),
    ("Dairy", (
        "milk", "cheese", "paneer", "butter", "ghee", "curd", "yogurt", "yoghurt",
        "cream", "tofu", "mozzarella", "cheddar", "khoya",
    )),
    ("Spices", (
        "masala", "pepper", "peppercorn", "cumin", "turmeric", "cardamom", "clove",
        "cinnamon", "nutmeg", "saffron", "spice", "salt", "mustard seed", "fenugreek seed",
        "asafoetida", "hing", "chilli powder", "chili powder", "paprika", "oregano",
        "thyme", "rosemary", "bay leaf", "star anise", "coriander seed",
    )),
    ("Oils & Sauces", (
        "oil", "sauce", "ketchup", "mayonnaise", "mayo", "vinegar", "soy", "dressing",
        "pickle", "jam", "jelly", "honey", "syrup", "spread", "paste", "chutney",
    )),
    ("Grains & Pulses", (
        "rice", "flour", "atta", "maida", "bread", "pasta", "noodle", "spaghetti",
        "macaroni", "wheat", "oat", "barley", "quinoa", "semolina", "rava", "dal",
        "lentil", "chickpea", "gram", "rajma", "kidney bean", "vermicelli", "corn",
        "maize", "pizza", "burger", "bun", "cake", "pie", "tart", "dumpling", "waffle",
        "pancake", "dough", "cereal", "couscous", "millet", "sago", "poha",
    )),
    ("Proteins & Nuts", (
        "egg", "chicken", "mutton", "lamb", "beef", "pork", "bacon", "ham", "fish",
        "salmon", "tuna", "prawn", "shrimp", "crab", "squid", "meat", "sausage",
        "almond", "cashew", "peanut", "walnut", "pistachio", "hazelnut", "pecan",
        "nut", "seed", "soya", "soybean", "tempeh",
    )),
    ("Frozen", ("frozen", "ice cream", "icecream")),
    ("Produce", (
        "tomato", "onion", "potato", "garlic", "ginger", "chilli", "chili", "carrot",
        "coriander", "mint", "spinach", "cauliflower", "cabbage", "broccoli", "pea",
        "cucumber", "lemon", "lime", "eggplant", "brinjal", "aubergine", "mushroom",
        "beans", "zucchini", "courgette", "lettuce", "parsley", "scallion", "spring onion",
        "curry leaf", "fenugreek", "apple", "banana", "mango", "orange", "grape", "berry",
        "melon", "peach", "pear", "plum", "cherry", "pineapple", "papaya", "guava",
        "pomegranate", "coconut", "fig", "date", "kiwi", "avocado", "pumpkin", "radish",
        "beetroot", "turnip", "leek", "celery", "asparagus", "coriander leaf", "okra",
        "ladyfinger", "bitter gourd", "bottle gourd", "snake gourd", "taro", "yam",
        "sweet potato", "fruit", "vegetable", "sprout", "artichoke",
    )),
]

_SLUG_STRIP_RE = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    """``"Bell Peppers / Capsicum"`` -> ``"bell_peppers_capsicum"``."""
    lowered = name.strip().lower().replace("&", " and ")
    slug = _SLUG_STRIP_RE.sub("_", lowered).strip("_")
    return slug or "unknown"


def display_name(raw: str) -> str:
    """Normalise a dataset class name into a human-readable label.

    Food-101 ships ``apple_pie``; VegFru directory names are usually already
    spaced (``Chinese chestnut``). Underscores become spaces and small words
    stay lowercase, so ``baby_back_ribs`` -> ``Baby Back Ribs``.
    """
    cleaned = raw.replace("_", " ").replace("-", " ").strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    if not cleaned:
        return "Unknown"
    small = {"and", "or", "of", "with", "in", "the", "a", "an", "au", "de"}
    words = cleaned.split(" ")
    out = []
    for index, word in enumerate(words):
        if index > 0 and word.lower() in small:
            out.append(word.lower())
        else:
            out.append(word if word.isupper() and len(word) > 1 else word.capitalize())
    return " ".join(out)


def category_for(name: str, kind: str = KIND_INGREDIENT) -> str:
    """Map a label onto one of the seven fridge categories.

    Dish labels short-circuit to :data:`DISH_CATEGORY` because Food-101 classes
    describe cooked plates, not raw ingredients.
    """
    if kind == KIND_DISH:
        return DISH_CATEGORY
    haystack = name.lower().replace("_", " ")
    for category, keywords in _CATEGORY_RULES:
        for keyword in keywords:
            if keyword in haystack:
                return category
    return DEFAULT_INGREDIENT_CATEGORY


# --------------------------------------------------------------------------
# App-side canonical ingredients (frontend/src/data/householdIngredients.js)
# --------------------------------------------------------------------------
_HOUSEHOLD_ENTRY_RE = re.compile(
    r"name:\s*'(?P<name>[^']*)'\s*,\s*"
    r"category:\s*'(?P<category>[^']*)'\s*,\s*"
    r"synonyms:\s*\[(?P<synonyms>[^\]]*)\]",
    re.S,
)
_QUOTED_RE = re.compile(r"'([^']*)'")


def repo_root() -> Path:
    """Repository root, derived from this file's location."""
    return Path(__file__).resolve().parents[2]


def household_ingredients_path() -> Path:
    return repo_root() / "frontend" / "src" / "data" / "householdIngredients.js"


def load_household_ingredients(path: Optional[Path] = None) -> List[Dict[str, object]]:
    """Parse the app's click-to-add pantry list.

    Returns a list of ``{"name", "category", "synonyms"}`` dicts. Parsing is
    best-effort: the JS file is a flat array of single-quoted object literals,
    which this regex reads reliably, but a hand-edited file that introduces
    multi-line strings would simply yield fewer entries rather than crash.
    """
    target = Path(path) if path else household_ingredients_path()
    if not target.is_file():
        return []
    text = target.read_text(encoding="utf-8")
    entries: List[Dict[str, object]] = []
    for match in _HOUSEHOLD_ENTRY_RE.finditer(text):
        entries.append(
            {
                "name": match.group("name").strip(),
                "category": match.group("category").strip(),
                "synonyms": [s.strip() for s in _QUOTED_RE.findall(match.group("synonyms"))],
            }
        )
    return entries


class CanonicalIndex:
    """Maps a predicted label back onto the app's canonical ingredient names.

    A model trained on VegFru will emit e.g. ``Green pea``; the app's pantry
    calls that ``Green Peas``. Resolving through this index lets the exported
    model's output be used directly.
    """

    def __init__(self, entries: Optional[Iterable[Dict[str, object]]] = None) -> None:
        if entries is None:
            entries = load_household_ingredients()
        self._by_key: Dict[str, str] = {}
        self._by_slug: Dict[str, str] = {}
        self._category: Dict[str, str] = {}
        for entry in entries:
            name = str(entry.get("name", "")).strip()
            if not name:
                continue
            keys = [name, *[str(s) for s in entry.get("synonyms", []) or []]]
            for key in keys:
                self._by_key.setdefault(key.strip().lower(), name)
            self._by_slug.setdefault(slugify(name), name)
            if entry.get("category"):
                self._category.setdefault(name, str(entry["category"]))

    def __len__(self) -> int:
        return len(self._by_key)

    def resolve(self, label: str) -> Optional[str]:
        """Return the app's canonical name for ``label``, or ``None``."""
        if not label:
            return None
        direct = self._by_key.get(label.strip().lower())
        if direct:
            return direct
        return self._by_slug.get(slugify(label))

    def canonical_category(self, label: str) -> Optional[str]:
        resolved = self.resolve(label)
        if not resolved:
            return None
        return self._category.get(resolved)


def build_label_record(
    raw: str,
    source: str,
    kind: str = KIND_INGREDIENT,
    index: Optional[CanonicalIndex] = None,
) -> Dict[str, Optional[str]]:
    """Turn a dataset class name into a canonical label record."""
    name = display_name(raw)
    resolved = index.resolve(name) if index is not None else None
    # Prefer the app's own category when the label resolves to a pantry item.
    category = None
    if resolved and index is not None:
        category = index.canonical_category(name)
    if not category:
        category = category_for(name, kind=kind)
    return {
        "name": name,
        "slug": slugify(resolved or name),
        "category": category,
        "kind": kind,
        "source": source,
        "raw": raw,
        "canonical": resolved,
    }
