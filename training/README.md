# PlateWise — Ingredient Recognition Pipeline

Offline pipeline that fine-tunes a small image classifier to recognise fridge
**ingredients**, so the scanner works with no network call and no API key.

PlateWise reads a photo to fill a *pantry*: input is ingredients, output is
recipes. That single sentence decides everything below — what the model is
trained on, what it is allowed to output, and how it is evaluated.

---

## Status — read this first

| Part | State |
|------|-------|
| Dataset import, manifest build, validation | **Implemented and tested.** `bash tests/test_pipeline.sh` runs the whole data path on a synthetic fixture, no downloads. |
| `train.py`, `evaluate.py` | **Implemented and executed.** Trained MobileNetV3-Large on MPS on both datasets below; `artifacts/` holds the checkpoints and test reports. |
| `import_ingredients.py` | **Implemented and executed.** The **shipped** source: 36 raw-produce classes, 3,115 images, from a Hugging Face Parquet dataset. |
| `import_indian_food.py` | **Implemented and executed.** 15,404-image / 43-class Indian **dish** dataset. Kept as a standalone artifact — **not** in the app flow, see "Why dishes are not in the app". |
| `export_onnx.py` | **Implemented and executed.** PyTorch → ONNX for the Node backend; output verified against PyTorch to five decimals. |
| `export_tfjs.py` | **Implemented, not executed for the real model.** The backend uses ONNX, not TFJS — see §6b. The TFJS chain is only for a browser deployment and still needs two Python 3.12 envs. |
| Shipped model behind the app | **Yes, locally.** `backend/ingredient-classifier.js` loads the ingredient ONNX model; `backend/server.js` runs it before CLIP. See §7. |

### Why dishes are not in the app

An earlier iteration trained a 43-class Indian-**dish** classifier and surfaced it
as a "Looks like Samosa" badge. That was removed from the product, because a
dish is not a pantry item in either direction: it is not an input (the user
photographs *ingredients*) and it is not an output (the app produces recipes).
It was also actively harmful — the badge called a basket of raw vegetables
"Pakode", and an attempt to derive the pantry from a recognised dish invented
"Pav Bhaji Masala, Pav Buns" on a fridge shelf.

The dish model and its training/evaluation remain here because they are real,
reproducible artifacts (`artifacts/full/`, test top-1 91.0%), but nothing in the
app loads them.

### What the shipped ingredient model is and is not

| | |
|---|---|
| Held-out test top-1 (623 images) | **88.3%** |
| Held-out test top-5 | **98.1%** |
| Held-out test macro AP | **0.934** |
| Speed | ~0.7 s per image on CPU, no network |

It is a **single-item** recogniser on **raw produce**. Tiling it to detect many
items in one photo was implemented, measured and **removed**: crops of an ordinary
kitchen photo produced confident nonsense ("Soy Beans 97%" on a bowl of lemons),
and raising the crop threshold does not help because the wrong answers are the
high-confidence ones. Reproduce with
`node backend/scripts/calibrate-ingredient-model.mjs`.

**Known limitation.** Training images are single produce items on clean
backgrounds. On messy real-world photos — market stalls, hands, wooden tables —
accuracy drops sharply. That is a domain gap, not a threshold, and closing it
needs fine-tuning on ordinary phone photos of kitchens. The shipped behaviour is
designed around it: the model is trusted only above 50% confidence, and CLIP's
broader (noisier) list is the fallback, so a low-confidence photo falls back
rather than inventing a vegetable.

### The originally-planned sources

Food-101 + VegFru is **not** what got shipped. VegFru has no usable download
(expired Baidu Pan, unlicensed mirrors, 14–28 GB) and Food-101 is Western cooked
dishes, which is the wrong label space for a pantry. The pipeline is
source-agnostic, so the shipped model trains on the ingredients dataset instead;
the Food-101, VegFru and Indian-food importers still work if you supply them.

---

## Layout

```
training/
├── platewise_ml/
│   ├── taxonomy.py     fridge categories + keyword rules + app pantry matching  (stdlib only)
│   ├── manifest.py     manifest build / stratified split / validation           (stdlib only)
│   ├── datasets.py     torch Dataset + transforms + pos_weight                  (needs torch)
│   └── metrics.py      top-k accuracy and mAP                                   (needs torch)
├── scripts/
│   ├── import_food101.py      download, verify and index Food-101
│   ├── import_vegfru.py       index a local VegFru copy (no download — see below)
│   ├── import_indian_food.py  download + decode the Indian-food dataset (Hugging Face)
│   ├── build_manifest.py      merge indexes → manifest.jsonl + class_map.json + splits
│   ├── validate_manifest.py   check it, gate training on it
│   ├── train.py               fine-tune
│   ├── evaluate.py            score a checkpoint on a split
│   ├── export_onnx.py         checkpoint → ONNX for the Node backend  ← what ships
│   └── export_tfjs.py         ONNX → SavedModel → TFJS graph model (browser only)
├── tests/
│   ├── make_fixture.py        synthetic Food-101 + VegFru-shaped dataset
│   └── test_pipeline.sh       end-to-end test of the data half
├── configs/default.json
├── requirements.txt           training env
├── requirements-export.txt    export env A (onnx2tf, Python ≥ 3.12)
├── requirements-tfjs.txt      export env B (tensorflowjs, Python ≥ 3.12)
└── data/ , artifacts/         generated — gitignored
```

Everything under `platewise_ml/taxonomy.py`, `platewise_ml/manifest.py`,
`import_food101.py`, `import_vegfru.py`, `build_manifest.py`,
`validate_manifest.py` and `tests/` runs on a bare Python 3 install. No numpy,
no PIL, no torch.

`import_indian_food.py` is the exception: it reads parquet and decodes embedded
JPEG bytes, so it needs `pyarrow` and `Pillow` (both in `requirements.txt`).

---

## 1. Try it without downloading anything

The fixture writes a tiny synthetic dataset that mimics both real ones on disk —
real, decodable PNGs, generated with `zlib`.

```bash
cd training
python3 tests/make_fixture.py --force
python3 scripts/import_food101.py --data-root data/fixture --skip-download
python3 scripts/import_vegfru.py --data-root data/fixture --images-dir data/fixture/raw/vegfru
python3 scripts/build_manifest.py --data-root data/fixture
python3 scripts/validate_manifest.py --data-root data/fixture --check-images
```

Expected: 100 images, 10 classes, splits `{"train": 80, "val": 10, "test": 10}`,
and `OK -- no errors, no warnings`.

Or just run the whole thing, including negative cases that prove the validator
actually rejects a broken manifest:

```bash
bash tests/test_pipeline.sh
```

---

## 2. Real data

### Food-101 — downloadable

101,000 photographs across 101 dish classes, 750 train + 250 test per class.

```bash
# Full dataset (~5 GB download, extracted in place)
python3 scripts/import_food101.py

# Or a quick subset to get moving
python3 scripts/import_food101.py --limit-per-class 50
```

The script downloads `http://data.vision.ee.ethz.ch/cvl/food-101.tar.gz`, extracts
it into `data/raw/`, verifies that all 101 class directories are present and that
`meta/classes.txt` agrees with what is on disk, then writes an index. It reads
`meta/train.json` and `meta/test.json` — the splits torchvision and TensorFlow
Datasets use — not the `.txt` files.

Already have the tarball? `--archive /path/to/food-101.tar.gz`. Already extracted?
`--skip-download`.

### VegFru — you must supply it

292 vegetable and fruit classes. **There is no download step, deliberately.**

The official link in the `ustc-vim/vegfru` README is a Baidu Pan share
(`http://pan.baidu.com/s/1boSNcV9`) that now reports itself as expired, and that
GitHub repository contains only HybridNet training code — no `category.txt`, no
split files, no images. Mirrors exist (~14 GB on Kaggle, ~28 GB on Hugging Face)
but they are third-party redistributions whose licence could not be confirmed
from any primary source. So this script takes a path instead of inventing a URL:

```bash
python3 scripts/import_vegfru.py --images-dir /path/to/vegfru

# or extract an archive you already have
python3 scripts/import_vegfru.py --archive ~/Downloads/vegfru.zip
```

It expects the immediate sub-directories to be class names:

```
<images-dir>/
  Apple/             *.jpg
  Chinese chestnut/  *.jpg
  ...
```

Some copies nest one extra level (`fru92_images/<class>/`); point `--images-dir` at
the inner directory, or set `--class-depth 2`.

VegFru ships no split metadata that could be verified, so its images are
stratified across train/val/test by `build_manifest.py` rather than using an
official split.

### Indian food — downloadable (this is what ships)

15,404 photographs across 43 Indian dish classes (biryani, masala_dosa,
chole_bhature, gulab_jamun, samosa, momos, …), served as parquet from Hugging
Face with the image bytes embedded in each row.

```bash
# Full dataset (all splits; ~1.9 GB download, decoded to real JPEGs in place)
.venv/bin/python scripts/import_indian_food.py

# A quick subset to prove the pipeline before the full download
.venv/bin/python scripts/import_indian_food.py --limit-per-class 30
```

Source: `SohlHealth/enhanced-indian-food-classification`, declared **CC BY 4.0**.
Two deviations from the source, both deliberate (see the module docstring):

* **The official split is re-stratified, not locked.** Its `test` split covers
  only 22 of the 43 classes, so locking it would leave 21 dishes with no test
  coverage. Every image is emitted with `source_split=None` so
  `build_manifest.py` stratifies all 43 dishes across train/val/test.
* **Images are re-encoded to JPEG** to normalise colour profiles and strip
  stray metadata.

This dataset is Indian dishes, so its labels are `kind: "dish"` — cooked plates,
not pantry ingredients. The trained model is therefore a **dish recognizer**,
which the app surfaces separately from the ingredient list (§7).

---

## 3. What `build_manifest.py` produces

Under `data/processed/`:

**`manifest.jsonl`** — one JSON object per image:

```json
{"image": "raw/vegfru/Apple/0001.png", "source": "vegfru", "kind": "ingredient",
 "labels": ["apple"], "source_split": null, "split": "train"}
```

`labels` is a list, because the format and the loss are multi-label even though
both source datasets happen to be single-label. Paths are relative to
`--data-root`.

**`class_map.json`** — the label ordering, which is what a checkpoint's output
layer is tied to. Ids are assigned after sorting by slug, so rebuilding from the
same sources reproduces the same ids:

```json
{"id": 5, "slug": "green_peas", "name": "Green Pea", "category": "Produce",
 "kind": "ingredient", "canonical": "Green Peas", "sources": ["vegfru"]}
```

`canonical` is the app's own pantry name from
`frontend/src/data/householdIngredients.js`, resolved through synonyms. When it is
set, a prediction can be handed straight to the app. About a third of VegFru's
classes resolve this way; the rest keep their dataset name.

Dish classes from Food-101 get `"kind": "dish"` and
`"category": "Prepared Dish"` — outside the seven fridge categories on purpose.
A leftover curry *is* worth detecting, but the app should not put "Sushi" in your
pantry list. Metrics are reported per kind so the two jobs can be judged
separately.

**`splits/{train,val,test}.txt`** — plain image-path lists.
**`stats.json`** — counts, per-source totals, dropped classes.

### Split policy

If a source shipped an official test split, it is **locked** to `test` and never
trained on; the remaining images are stratified into train/val. Sources without
one are stratified across all three. `--val-frac`, `--test-frac` and `--seed`
tune the rest.

---

## 4. Training

```bash
cd training
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

python3 scripts/train.py --config configs/default.json
```

Useful flags: `--backbone {mobilenet_v3_large,mobilenet_v3_small,efficientnet_b0}`,
`--epochs`, `--batch-size`, `--lr`, `--freeze-backbone`, `--limit-train`,
`--max-steps`, `--device {auto,cpu,cuda,mps}`.

`train.py` refuses to start if `validate_manifest.py` would find errors
(`--force` overrides). It writes `artifacts/best.pt`, `artifacts/last.pt` and
`artifacts/training_log.json`, and each checkpoint carries the full class map, so
`evaluate.py` and `export_tfjs.py` never need to be told the label ordering.

Two notes on the recipe:

- **`pos_weight`, not `WeightedRandomSampler`.** With a single head predicting
  many labels, resampling images cannot fix per-class imbalance — the same image
  still carries its other labels. Weighting BCE's positive term can. Disable with
  `--no-pos-weight`.
- **MixUp is in the training loop**, not in the transform, because it mixes pairs
  of samples. `--mixup-alpha 0` turns it off.

Model selection uses macro AP (falling back to top-1 if AP is undefined because
no class has positives yet).

---

## 5. Evaluating

```bash
python3 scripts/evaluate.py --split test
python3 scripts/evaluate.py --checkpoint artifacts/best.pt --split test --report artifacts/test_report.json
```

Reports top-1/top-5 (over the single-label subset only — undefined for genuinely
multi-label images, which are excluded rather than miscounted), macro and micro
AP, AP grouped by kind and category, and the weakest classes.

PLAN.md's target is top-5 ≥ 85% on a VegFru test split, < 200 ms inference in the
browser, and < 25 MB after quantisation. **None of those has been measured** — no
model has been trained.

---

## 6. Exporting to TensorFlow.js

Be aware of the shape of this before you start: `tensorflowjs_converter` **cannot
read ONNX files**. Its documented inputs are SavedModel and Keras formats, and the
legacy `onnx-tf` bridge is unmaintained. The chain that works is:

```
PyTorch ──torch.onnx.export──▶ ONNX ──onnx2tf──▶ SavedModel ──tensorflowjs_converter──▶ TFJS
   (training env)                (env A, Python ≥ 3.12)        (env B, Python ≥ 3.12)
```

onnx2tf pins its own TensorFlow build and currently requires Python ≥ 3.12, which
is why env A and env B are separate virtualenvs from the training env and from
each other — installing them together resolves to neither.

```bash
# 0. See what would happen, no torch required
python3 scripts/export_tfjs.py --dry-run

# 1. Two throwaway envs
python3.12 -m venv .venv-onnx2tf && .venv-onnx2tf/bin/pip install -r requirements-export.txt
python3.12 -m venv .venv-tfjs     && .venv-tfjs/bin/pip install -r requirements-tfjs.txt

# 2. Full chain
python3 scripts/export_tfjs.py \
  --onnx2tf .venv-onnx2tf/bin/onnx2tf \
  --tfjs-converter .venv-tfjs/bin/tensorflowjs_converter \
  --quantize float16
```

Outputs:

- `artifacts/web/model.json` + weight shards
- `artifacts/web/metadata.json` — class map, image size, normalisation, input
  layout and colour order, i.e. everything the frontend needs to preprocess an
  image correctly.

`--quantize float16` is the first size lever; `uint8` is more aggressive and costs
more accuracy. The script prints the output size and warns if it exceeds the 25 MB
target.

Known pitfalls with these two backbones, worth checking if conversion fails or
outputs differ: MobileNetV3 uses hard-swish and EfficientNet uses SiLU, and either
may hit an unsupported TensorFlow op; the input is `[1,3,H,W]` NCHW in PyTorch and
becomes NHWC after onnx2tf. **Always compare the exported model's outputs against
the PyTorch model on the same images before shipping it** — a successful
conversion is not evidence of a correct one. `onnx2tf` prints a per-layer coverage
report.

---

## 7. How this connects to the app

The shipped path is **ONNX on the backend**, not TFJS in the browser:

```bash
# Train the shipped ingredient model, then export it
.venv/bin/python scripts/import_ingredients.py
.venv/bin/python scripts/build_manifest.py --index data/processed/ingredients.index.jsonl \
  --out-dir data/processed-ingredients
.venv/bin/python scripts/train.py --manifest data/processed-ingredients/manifest.jsonl \
  --class-map data/processed-ingredients/class_map.json --out artifacts/ingredients \
  --backbone mobilenet_v3_large --epochs 18 --device mps
.venv/bin/python scripts/export_onnx.py --checkpoint artifacts/ingredients/best.pt \
  --out artifacts/ingredients/onnx
```

`backend/ingredient-classifier.js` loads `model.onnx` + `metadata.json` lazily via
`onnxruntime-node`; `backend/server.js` runs it before CLIP on every scan. The two
readers answer the same question at different breadths, and the model wins when it
has an answer:

* **The trained ONNX model** → one confident **raw ingredient** (35 produce
  classes: onion, garlic, ginger, tomato, potato, spinach, chilli pepper, …),
  trusted above 50% confidence. ~0.7 s, no network.
* **CLIP zero-shot** (fixed phrase list) → the broader fallback: spices, dairy,
  grains and anything outside those 35 classes. Used whenever the model abstains.

Only ingredients are returned. There is no `dish` field on the scan response and
no meal badge in the UI: input is ingredients, output is recipes.

Preprocessing must match training exactly: resize the shorter side to 256,
centre-crop to 224, ImageNet-normalise, NCHW layout, RGB order. `metadata.json`
carries all of it so the backend reads rather than hardcodes. Parity between the
PyTorch and ONNX outputs was verified to five decimal places on a real image
before shipping.

- `platewise_ml/taxonomy.py` holds the same seven categories as
  `FOOD_CATEGORIES` in `api/vision-scan.js`. Keep them in sync; the point is that
  a local model's output needs no translation layer.
- `api/vision-scan.js` (the Vercel function) does **not** yet serve the ONNX
  model — it still uses Groq Vision. Wiring the local classifier into the
  deployed function is the remaining gap if you take this to production.

---

## 8. Licensing and attribution

Neither dataset is covered by this repository's licence.

- **Food-101** — Bossard, Guillaumin, Van Gool, *"Food-101 — Mining Discriminative
  Components with Random Forests"*, ECCV 2014. Read
  `data/raw/food-101/license_agreement.txt` before redistributing any image; do not
  assume it is CC-licensed or cleared for commercial use.
- **VegFru** — Hou, Feng, Wang, *"VegFru: A Domain-Specific Dataset for
  Fine-grained Visual Categorization"*, ICCV 2017. The GitHub repository's code is
  Apache-2.0, but **that licence does not cover the images**, and no
  dataset-specific terms could be verified from a working source. Treat any mirror
  you obtained as unlicensed unless you have confirmed otherwise.

`training/.gitignore` excludes `data/` and `artifacts/`, so no images, archives or
checkpoints end up in git.

---

## 9. Known limitations

- The TFJS export chain (`export_tfjs.py`) has **never been run for the real
  model** — it needs two separate Python 3.12 envs (`onnx2tf` + `tensorflowjs`)
  and is only relevant for a browser deployment. The backend uses the ONNX
  path (`export_onnx.py`), which is tested end-to-end.
- **Licensing.** The Indian-food dataset declares CC BY 4.0 on its card, but the
  card does not document image provenance or confirm the uploader could
  relicense every image. The **ingredients dataset** (the shipped source)
  declares **no licence at all**, so it is for local experimentation and a
  demonstration only — do not redistribute those images. Get rights confirmation
  before shipping anything commercial.
- The shipped model recognises **35 raw produce classes**. Anything outside that
  set (spices, dairy, grains, packaged goods) is not something it can name; those
  come from CLIP. And while it is strong on its own kind of image (88.3% on the
  held-out split), it degrades on messy real-world photographs — see "What the
  shipped ingredient model is and is not" at the top.
- Category assignment for ingredient labels is keyword-based
  (`taxonomy._CATEGORY_RULES`) with a curated exception list. It is a heuristic;
  spot-check `class_map.json` after adding a source.
