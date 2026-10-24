'use strict';

// Ingredient recognition for PlateWise.
//
// PlateWise reads a photo to fill a PANTRY, so this model is trained on raw
// cooking ingredients (training/scripts/import_ingredients.py -> 35 produce
// classes) rather than on cooked dishes. Held-out test split: top-1 88.3%,
// top-5 98.1%, macro AP 0.934.
//
// Why not just CLIP: CLIP scores the WHOLE image against each phrase in a list,
// so it is really a "what is the single dominant thing here" model. Measured on
// ten clear single-subject produce photos it named the subject 6/10 times, and on
// a produce basket it returned "spaghetti". A purpose-trained closed-set
// classifier is simply a better fit for "is there an onion in this photo".
//
// SCOPE / LIMITATION -- read before trusting a number from this module.
//
// This is a SINGLE-ITEM recogniser. It was trained on centred, single-produce
// photographs, and that is what it is good at: 82.9% exact-match on the held-out
// split with a median top-1 of 99.9%.
//
// Tiling was implemented and then removed, because it does not work here.
// Measured with backend/scripts/calibrate-ingredient-model.mjs, crops of an
// ordinary kitchen photo produced confident nonsense ("Soy Beans 97%" on a
// bowl of lemons), and raising the crop threshold does not help because the
// wrong answers are the high-confidence ones. A tiled photo is therefore
// reported as its single best ingredient rather than as a fabricated list.
//
// On messy real-world photos (market stalls, hands, wooden tables) accuracy
// drops sharply -- that is a domain gap, not a threshold. Closing it needs
// fine-tuning on ordinary phone photos of kitchens, which is the documented
// next step in training/README.md.

const fs = require('fs');
const path = require('path');

let ort = null;
let sharp = null;
try {
  ort = require('onnxruntime-node');
} catch {
  ort = null;
}
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

const DEFAULT_DIR = path.resolve(__dirname, '..', 'training', 'artifacts', 'ingredients', 'onnx');

// Calibrated by backend/scripts/calibrate-ingredient-model.mjs against the
// held-out test split plus deliberately difficult photos.
// Every correct test-split answer sits above 62%, so 0.5 keeps 100% of them
// while still refusing the low-confidence guesses that come from photos this
// model was never trained on.
const FULL_MIN_TOP1 = 0.5;
const MAX_ITEMS = 3;

class IngredientClassifier {
  constructor(dir = DEFAULT_DIR) {
    this.dir = dir;
    this.session = null;
    this.meta = null;
  }

  get available() {
    return Boolean(ort && sharp);
  }

  async load() {
    if (this.session) return this;
    if (!this.available) return null;

    const modelPath = path.join(this.dir, 'model.onnx');
    const metaPath = path.join(this.dir, 'metadata.json');
    if (!fs.existsSync(modelPath) || !fs.existsSync(metaPath)) return null;

    this.meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    this.session = await ort.InferenceSession.create(modelPath);
    return this;
  }

  // Resize the shorter side to 256 then centre-crop 224, matching the eval
  // transform in training/platewise_ml/datasets.py exactly.
  async _preprocess(imagePath) {
    const size = this.meta.image_size || 224;
    const shorter = Math.round((size * 256) / 224);
    const { width, height } = await sharp(imagePath).metadata();
    if (!width || !height) return null;

    const scale = shorter / Math.min(width, height);
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const { data } = await sharp(imagePath)
      .rotate()
      .resize(w, h)
      .extract({
        left: Math.round((w - size) / 2),
        top: Math.round((h - size) / 2),
        width: size,
        height: size,
      })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (data.length < size * size * 3) return null;

    const { mean, std } = this.meta.normalisation;
    const plane = size * size;
    const arr = new Float32Array(plane * 3);
    for (let c = 0; c < 3; c += 1) {
      for (let i = 0; i < plane; i += 1) {
        arr[c * plane + i] = (data[i * 3 + c] / 255 - mean[c]) / std[c];
      }
    }
    return new ort.Tensor('float32', arr, [1, 3, size, size]);
  }

  async _run(tensor) {
    const out = await this.session.run({ [this.meta.input.name]: tensor });
    const logits = Array.from(out.logits.data);

    // Softmax: one ingredient per crop, so the 35 logits compete and sum to 1.
    const maxLogit = Math.max(...logits);
    const exps = logits.map((x) => Math.exp(x - maxLogit));
    const total = exps.reduce((a, b) => a + b, 0);
    const ranked = logits
      .map((_, i) => {
        const cls = this.meta.classes[i];
        return {
          slug: cls.slug,
          name: cls.canonical || cls.name,
          category: cls.category || 'Produce',
          confidence: exps[i] / total,
        };
      })
      .sort((a, b) => b.confidence - a.confidence);

    return {
      ranked,
      top1: ranked[0].confidence,
      margin: ranked.length > 1 ? ranked[0].confidence - ranked[1].confidence : ranked[0].confidence,
    };
  }

  // Whole-image answer, for a close-up of one or two ingredients.
  async predict(imagePath) {
    const tensor = await this._preprocess(imagePath);
    if (!tensor) return null;
    return this._run(tensor);
  }

  // Best single ingredient, or nothing when the model is not sure.
  //
  // Returning top-k as extra pantry items was tried and is wrong: the model's
  // runner-up on an out-of-distribution photo is a confident wrong vegetable, so
  // extras would put food in the pantry that was never in the picture.
  async detect(imagePath) {
    const full = await this.predict(imagePath);
    if (!full) return { items: [], full: null };

    const items =
      full.top1 >= FULL_MIN_TOP1
        ? [
            {
              name: full.ranked[0].name,
              category: full.ranked[0].category,
              confidence: Math.round(full.top1 * 100),
            },
          ]
        : [];

    return { items: items.slice(0, MAX_ITEMS), full };
  }

  // Ranked candidates, for scripts and for the UI's "did you mean" affordance.
  async candidates(imagePath, k = 3) {
    const full = await this.predict(imagePath);
    if (!full) return [];
    return full.ranked.slice(0, k).map((r) => ({
      name: r.name,
      category: r.category,
      confidence: Math.round(r.confidence * 100),
    }));
  }
}

module.exports = { IngredientClassifier, DEFAULT_DIR };
