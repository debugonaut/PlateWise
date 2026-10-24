#!/usr/bin/env bash
#
# End-to-end test for the standard-library half of the pipeline: fixture ->
# import -> build manifest -> validate, plus a negative case proving the
# validator actually rejects a broken manifest.
#
# No torch, no downloads. Runs in a couple of seconds.
#
#   bash tests/test_pipeline.sh

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRAINING="$(dirname "$HERE")"
PY="${PYTHON:-python3}"
FIXTURE="$TRAINING/data/fixture"
PROCESSED="$FIXTURE/processed"

cd "$TRAINING"

pass() { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; exit 1; }
step() { printf '\n== %s\n' "$1"; }

expect_exit() {
  local expected="$1"; shift
  local actual=0
  "$@" > /dev/null 2>&1 || actual=$?
  if [ "$actual" -ne "$expected" ]; then
    fail "expected exit $expected, got $actual: $*"
  fi
  pass "exit $expected: $*"
}

step "generating synthetic fixture"
rm -rf "$FIXTURE"
"$PY" tests/make_fixture.py --force > /dev/null || fail "make_fixture.py"
count=$(find "$FIXTURE/raw" -name '*.png' | wc -l | tr -d ' ')
[ "$count" = "100" ] || fail "expected 100 fixture images, found $count"
pass "100 fixture images written"

step "food-101 importer"
"$PY" scripts/import_food101.py --data-root "$FIXTURE" --skip-download > /dev/null 2>&1 \
  || fail "import_food101.py"
[ -s "$PROCESSED/food101.index.jsonl" ] || fail "food101 index missing"
records=$("$PY" -c "import json,sys;print(sum(1 for _ in open('$PROCESSED/food101.index.jsonl')))")
[ "$records" = "50" ] || fail "expected 50 food101 records, got $records"
pass "50 food-101 records indexed"

step "vegfru importer"
"$PY" scripts/import_vegfru.py --data-root "$FIXTURE" --images-dir "$FIXTURE/raw/vegfru" > /dev/null \
  || fail "import_vegfru.py"
records=$("$PY" -c "import json,sys;print(sum(1 for _ in open('$PROCESSED/vegfru.index.jsonl')))")
[ "$records" = "50" ] || fail "expected 50 vegfru records, got $records"
pass "50 vegfru records indexed"

step "build manifest"
"$PY" scripts/build_manifest.py --data-root "$FIXTURE" > /dev/null || fail "build_manifest.py"
for artifact in manifest.jsonl class_map.json stats.json splits/train.txt splits/val.txt splits/test.txt; do
  [ -s "$PROCESSED/$artifact" ] || fail "missing artifact $artifact"
done
pass "manifest, class map, stats and split files written"

step "manifest contents"
"$PY" - "$PROCESSED" <<'PYTHON'
import json, sys
from pathlib import Path

processed = Path(sys.argv[1])
records = [json.loads(line) for line in (processed / "manifest.jsonl").read_text().splitlines() if line.strip()]
class_map = json.loads((processed / "class_map.json").read_text())

assert len(records) == 100, f"expected 100 records, got {len(records)}"
assert class_map["num_classes"] == 10, f"expected 10 classes, got {class_map['num_classes']}"

splits = {}
for record in records:
    splits[record["split"]] = splits.get(record["split"], 0) + 1
assert set(splits) == {"train", "val", "test"}, f"missing a split: {splits}"
assert splits["test"] == 10, f"official food-101 test split should be 10, got {splits['test']}"

# The official Food-101 test images must be exactly the ones locked to test.
locked = [r for r in records if r.get("source_split") == "test"]
assert len(locked) == 10, f"expected 10 locked test records, got {len(locked)}"
assert all(r["split"] == "test" for r in locked), "a locked official test image leaked into train/val"

# Every ingredient class should map onto a category from the app's own list.
app_categories = {"Produce","Dairy","Proteins & Nuts","Oils & Sauces","Grains & Pulses","Spices","Frozen"}
for entry in class_map["classes"]:
    assert entry["category"] in app_categories | {"Prepared Dish"}, f"bad category {entry['category']}"

by_slug = {e["slug"]: e for e in class_map["classes"]}
assert by_slug["green_peas"]["canonical"] == "Green Peas", "synonym resolution regressed"
assert by_slug["chinese_chestnut"]["category"] == "Produce", "chestnut should not be a protein"
assert by_slug["apple_pie"]["kind"] == "dish", "food-101 classes should be dishes"
print("  assertions: splits, locked test set, categories, synonym resolution")
PYTHON
pass "manifest assertions hold"

step "validator accepts a good manifest"
expect_exit 0 "$PY" scripts/validate_manifest.py --data-root "$FIXTURE" --check-images

step "validator rejects a broken manifest"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# (a) unknown label + duplicate image, appended to a copy of the real manifest.
cp "$PROCESSED/manifest.jsonl" "$TMP_DIR/dupes.jsonl"
first_image=$("$PY" -c "import json;print(json.loads(open('$PROCESSED/manifest.jsonl').readline())['image'])")
printf '%s\n' "{\"image\": \"$first_image\", \"source\": \"vegfru\", \"kind\": \"ingredient\", \"split\": \"train\", \"labels\": [\"not_a_real_class\"]}" >> "$TMP_DIR/dupes.jsonl"
expect_exit 1 "$PY" scripts/validate_manifest.py \
  --manifest "$TMP_DIR/dupes.jsonl" --class-map "$PROCESSED/class_map.json" --data-root "$FIXTURE"

# (b) an illegal split name and an empty label list.
cat > "$TMP_DIR/badsplit.jsonl" <<'JSONL'
{"image": "raw/vegfru/Tomato/0200.png", "source": "vegfru", "kind": "ingredient", "split": "validation", "labels": ["tomatoes"]}
{"image": "raw/vegfru/Tomato/0201.png", "source": "vegfru", "kind": "ingredient", "split": "train", "labels": []}
JSONL
expect_exit 1 "$PY" scripts/validate_manifest.py \
  --manifest "$TMP_DIR/badsplit.jsonl" --class-map "$PROCESSED/class_map.json" --data-root "$FIXTURE"

step "exporter dry-run (must work without torch)"
expect_exit 0 "$PY" scripts/export_tfjs.py --dry-run

printf '\n\033[32mAll pipeline tests passed.\033[0m\n'
