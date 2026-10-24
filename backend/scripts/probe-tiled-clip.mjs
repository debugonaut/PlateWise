#!/usr/bin/env node
// Does tiling help CLIP enumerate the contents of a fridge/grocery photo?
//
// CLIP zero-shot scores the WHOLE image against each phrase, so it is really a
// "what is the single dominant thing here" model. A shelf with eight vegetables
// gets averaged into one answer (which is how a produce basket came back as
// "spaghetti"). Tiling cuts the image into overlapping crops so each crop holds
// fewer objects, then unions the per-crop answers.
//
// This script measures full-image vs tiled on the same photos so the choice is
// made on evidence.
//
//   node backend/scripts/probe-tiled-clip.mjs /tmp/ingredient-probe

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { pipeline } = require('@xenova/transformers');

const dir = process.argv[2] || '/tmp/ingredient-probe';
const files = fs.readdirSync(dir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f)).sort();

// Same phrase list is not imported from server.js (that file boots Express), so
// this is a focused subset covering what an Indian pantry shelf actually holds.
const LABELS = [
  'fresh red tomatoes', 'yellow or red onions', 'raw potatoes', 'garlic cloves and bulbs',
  'fresh ginger root', 'green chili peppers', 'bell peppers capsicum', 'orange carrots',
  'fresh green coriander cilantro', 'spinach palak greens', 'fresh cauliflower', 'cabbage',
  'green broccoli', 'green peas', 'sliced cucumber', 'yellow lemon or lime',
  'purple eggplant brinjal', 'mushrooms', 'fresh green zucchini courgette', 'fresh green beans',
  'fresh green parsley leaves', 'fresh mint leaves', 'fresh green salad lettuce',
  'spring onions scallions', 'curry leaves', 'fresh red apples', 'ripe yellow bananas',
  'oranges citrus fruit', 'red grapes', 'pomegranate', 'fresh coconut',
  'a carton of milk', 'yogurt curd in a bowl', 'paneer cottage cheese', 'eggs in a carton',
  'a bowl of cooked rice', 'lentils dal in a bowl', 'chickpeas chana', 'kidney beans rajma',
  'wheat flour atta', 'turmeric powder', 'red chili powder', 'cumin seeds', 'mustard seeds',
  'cooking oil bottle', 'ghee in a jar', 'a plate of cooked food', 'a person', 'an empty room',
  'a kitchen sink with dirty dishes', 'text and logos', 'a cat', 'a wall',
];

const clip = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');

const MIN_SCORE = 0.06;
const RELATIVE = 0.1;
const MAX = 10;

function pick(predictions) {
  const top = predictions[0].score;
  const floor = Math.max(MIN_SCORE, top * RELATIVE);
  return predictions.filter((p) => p.score >= floor).slice(0, MAX);
}

// RawImage/CLIP cannot read a Buffer here ("Unsupported input type: object"),
// so every derived crop is written to a temp file and passed by path.
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'tile-probe-'));
let tmpCounter = 0;
const asFile = async (buf) => {
  const file = path.join(TMP, `crop-${tmpCounter++}.jpg`);
  fs.writeFileSync(file, buf);
  return file;
};

async function bufferOf(file) {
  return sharp(file).rotate().resize(768, 768, { fit: 'inside' }).jpeg({ quality: 90 }).toBuffer();
}

async function tiles(file, grid = 3, overlap = 0.15) {
  const { width, height } = await sharp(file).metadata();
  const out = [];
  const tw = Math.round(width / (grid - (grid - 1) * overlap));
  const th = Math.round(height / (grid - (grid - 1) * overlap));
  for (let gy = 0; gy < grid; gy += 1) {
    for (let gx = 0; gx < grid; gx += 1) {
      const left = Math.round(gx * tw * (1 - overlap));
      const top = Math.round(gy * th * (1 - overlap));
      out.push(
        await sharp(file)
          .rotate()
          .extract({ left, top, width: Math.min(tw, width - left), height: Math.min(th, height - top) })
          .resize(384, 384, { fit: 'inside' })
          .jpeg({ quality: 90 })
          .toBuffer()
      );
    }
  }
  return out;
}

for (const name of files) {
  const file = path.join(dir, name);

  const full = await clip(await asFile(await bufferOf(file)), LABELS);

  const tileBufs = await tiles(file);
  const all = [];
  for (const t of tileBufs) {
    const preds = await clip(await asFile(t), LABELS);
    all.push(...preds);
  }
  // Union per label using the best score it achieved in any crop.
  const best = new Map();
  for (const p of all) best.set(p.label, Math.max(best.get(p.label) || 0, p.score));
  const merged = [...best.entries()].map(([label, score]) => ({ label, score })).sort((a, b) => b.score - a.score);

  const f = pick(full).map((p) => `${p.label} ${(p.score * 100).toFixed(0)}`);
  const t = pick(merged).map((p) => `${p.label} ${(p.score * 100).toFixed(0)}`);

  console.log(`\n${name}`);
  console.log(`  full  (${f.length}): ${f.join(', ') || '(none)'}`);
  console.log(`  tiled (${t.length}): ${t.join(', ') || '(none)'}`);
}
