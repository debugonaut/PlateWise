#!/usr/bin/env node
// Choose the ingredient classifier's thresholds from data.
//
// Two questions:
//   1. What whole-image confidence means "this really is that ingredient"? Too
//      low and every photo is declared a tomato; too high and real close-ups are
//      dropped.
//   2. How sure must a crop be before it may add an extra item? This is the one
//      that decides whether a kitchen counter sprouting nine vegetables is
//      useful or nonsense.
//
//   node backend/scripts/calibrate-ingredient-model.mjs

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const TRAINING = path.join(ROOT, 'training');

const { IngredientClassifier } = require('../ingredient-classifier.js');

const classifier = new IngredientClassifier();
if (!(await classifier.load())) {
  console.error('model not loadable -- export it first:');
  console.error('  python3 scripts/export_onnx.py --checkpoint artifacts/ingredients/best.pt --out artifacts/ingredients/onnx');
  process.exit(1);
}
console.log(`model: ${Object.keys(classifier.meta.classes).length} classes, ${classifier.meta.backbone}\n`);

// Held-out test split: every image holds exactly one known ingredient.
const manifest = fs
  .readFileSync(path.join(TRAINING, 'data', 'processed-ingredients', 'manifest.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
  .filter((r) => r.split === 'test');

const byClass = new Map();
for (const record of manifest) {
  const key = record.labels[0];
  if (!byClass.has(key)) byClass.set(key, []);
  if (byClass.get(key).length < 2) byClass.get(key).push(record);
}
const sample = [...byClass.values()].flat();

const rows = [];
for (const record of sample) {
  const file = path.join(TRAINING, 'data', record.image);
  if (!fs.existsSync(file)) continue;
  const result = await classifier.predict(file);
  if (!result) continue;
  rows.push({ slug: record.labels[0], top1: result.top1, margin: result.margin, said: result.ranked[0].slug });
}

const correct = rows.filter((r) => r.said === r.slug);
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const values = correct.map((r) => r.top1);

console.log(`=== single-ingredient test images (n=${rows.length}, ${byClass.size} classes) ===`);
console.log(`accuracy          ${pct(correct.length / rows.length)}`);
console.log(`top-1 (correct)   p01 ${pct(quantile(values, 0.01))}  p05 ${pct(quantile(values, 0.05))}  p10 ${pct(quantile(values, 0.1))}  median ${pct(quantile(values, 0.5))}`);
console.log(`margin (correct)  p01 ${pct(quantile(correct.map((r) => r.margin), 0.01))}  p05 ${pct(quantile(correct.map((r) => r.margin), 0.05))}`);

console.log('\nfull-image gate: how many real ingredients survive?');
for (const t of [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
  const kept = correct.filter((r) => r.top1 >= t).length;
  console.log(`  top1 >= ${(t * 100).toFixed(0)}%  -> ${kept}/${correct.length} (${pct(kept / correct.length)})`);
}

// How does tiling behave on a *single*-ingredient photo? It should not invent
// extra items, and that is exactly what the tile threshold controls.
const probeDir = process.argv[2];
if (probeDir && fs.existsSync(probeDir)) {
  const files = fs.readdirSync(probeDir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f)).sort();
  console.log(`\n=== tiled detect() on ${files.length} real photos ===`);
  for (const name of files) {
    const file = path.join(probeDir, name);
    const { items, full } = await classifier.detect(file);
    const list = items.map((i) => `${i.name} ${i.confidence}`).join(', ') || '(none)';
    console.log(`  ${name.replace(/\.jpg$/, '').padEnd(26)} full ${pct(full.top1)} ${full.ranked[0].name.padEnd(14)} -> ${items.length}: ${list}`);
  }
}

fs.writeFileSync(
  path.join(TRAINING, 'artifacts', 'ingredients', 'gate_calibration.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), n: rows.length, accuracy: correct.length / rows.length, rows }, null, 2)
);
console.log('\nwrote artifacts/ingredients/gate_calibration.json');
