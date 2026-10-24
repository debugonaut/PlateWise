#!/usr/bin/env node
// Decisive probe: can an open-vocabulary DETECTOR enumerate a shelf of food?
//
// CLIP zero-shot classifies the whole image against a phrase, so a shelf of
// eight vegetables averages into one answer. OWL-ViT detects objects instead:
// each candidate phrase is localised in the image, so several items can be
// reported at once with a score and a box. That is exactly the job here.
//
//   node backend/scripts/probe-owlvit.mjs /tmp/ingredient-probe

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { pipeline, env } = require('@xenova/transformers');

const dir = process.argv[2] || '/tmp/ingredient-probe';
const files = fs.readdirSync(dir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f)).sort();

// Singular, concrete nouns work best for detection prompts.
const LABELS = [
  'tomato', 'onion', 'potato', 'garlic', 'ginger', 'green chili pepper', 'bell pepper',
  'carrot', 'coriander leaves', 'spinach', 'cauliflower', 'cabbage', 'broccoli', 'green peas',
  'cucumber', 'lemon', 'eggplant', 'mushroom', 'zucchini', 'green beans', 'parsley', 'mint',
  'lettuce', 'spring onion', 'curry leaves', 'apple', 'banana', 'orange', 'grapes',
  'pomegranate', 'coconut', 'milk carton', 'yogurt', 'paneer', 'eggs', 'rice', 'lentils',
  'chickpeas', 'kidney beans', 'flour', 'spice jar', 'cooking oil bottle', 'ghee',
];

console.log('loading Xenova/owlvit-base-patch32 (first run downloads weights)...');
const started = Date.now();
const detector = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32');
console.log(`loaded in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);

const THRESHOLD = 0.05;

for (const name of files) {
  const file = path.join(dir, name);
  const t0 = Date.now();
  let out;
  try {
    out = await detector(file, LABELS, { threshold: THRESHOLD, percentage: true });
  } catch (err) {
    console.log(`${name}: ERROR ${err.message}`);
    continue;
  }
  const ms = Date.now() - t0;
  // One row per label keeps the strongest box for that label.
  const best = new Map();
  for (const d of out) {
    if (!best.has(d.label) || d.score > best.get(d.label).score) best.set(d.label, d);
  }
  const rows = [...best.values()].sort((a, b) => b.score - a.score);
  console.log(`${name}  (${rows.length} labels, ${ms}ms)`);
  for (const r of rows.slice(0, 12)) {
    const box = r.box || {};
    console.log(
      `   ${r.label.padEnd(20)} ${(r.score * 100).toFixed(0).padStart(3)}%  ` +
        `box x${Math.round(box.xmin || 0)} y${Math.round(box.ymin || 0)} ` +
        `w${Math.round((box.xmax || 0) - (box.xmin || 0))} h${Math.round((box.ymax || 0) - (box.ymin || 0))}`
    );
  }
  console.log('');
}
