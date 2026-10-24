#!/usr/bin/env node
// Calibrate the dish-classifier gate used by backend/server.js.
//
// The model is trained with BCE-with-logits, so *sigmoid* is what training
// optimised -- but a BCE head on single-label data has no "none of the above"
// class, so an out-of-distribution photo (a basket of raw vegetables) still gets
// a high sigmoid on some dish. Softmax over the logits treats the 43 classes as
// mutually exclusive (which they are at inference time: one dish per photo) and
// gives a much better "am I sure?" signal, especially the *margin* to runner-up.
//
// This script measures both on real test images and on deliberately wrong
// inputs, so the threshold in the backend is chosen from data, not guessed.
//
//   node scripts/calibrate_dish_gate.mjs --onnx ../training/artifacts/onnx

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TRAINING = path.resolve(HERE, '..', '..', 'training');
const ROOT = path.resolve(TRAINING, '..');

// Both packages are CommonJS; createRequire keeps the exports shape predictable
// (a dynamic import() would put them under .default).
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const ort = require('onnxruntime-node');

const onnxDir = path.resolve(
  process.argv.includes('--onnx') ? process.argv[process.argv.indexOf('--onnx') + 1] : path.join(TRAINING, 'artifacts', 'onnx')
);
const meta = JSON.parse(fs.readFileSync(path.join(onnxDir, 'metadata.json'), 'utf8'));
const session = await ort.InferenceSession.create(path.join(onnxDir, 'model.onnx'));

async function preprocess(file) {
  const size = meta.image_size || 224;
  const shorter = Math.round((size * 256) / 224);
  const { width, height } = await sharp(file).metadata();
  const scale = shorter / Math.min(width, height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const { data } = await sharp(file)
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

  const plane = size * size;
  const arr = new Float32Array(plane * 3);
  for (let c = 0; c < 3; c += 1) {
    for (let i = 0; i < plane; i += 1) {
      arr[c * plane + i] = (data[i * 3 + c] / 255 - meta.normalisation.mean[c]) / meta.normalisation.std[c];
    }
  }
  return new ort.Tensor('float32', arr, [1, 3, size, size]);
}

function score(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((x) => x / sum);
  const order = probs
    .map((p, i) => ({ i, p, name: meta.classes[i].name }))
    .sort((a, b) => b.p - a.p);
  const sig = logits.map((x) => 1 / (1 + Math.exp(-x)));
  const sigOrder = sig.map((p, i) => ({ p, name: meta.classes[i].name })).sort((a, b) => b.p - a.p);
  return {
    softmaxTop: order[0].p,
    softmaxName: order[0].name,
    softmaxMargin: order[0].p - order[1].p,
    softmaxEntropy: -probs.reduce((a, p) => a + (p > 0 ? p * Math.log(p) : 0), 0) / Math.log(probs.length),
    sigmoidTop: sigOrder[0].p,
    sigmoidName: sigOrder[0].name,
    top3: order.slice(0, 3).map((o) => `${o.name} ${(o.p * 100).toFixed(1)}%`),
  };
}

async function classify(file) {
  const tensor = await preprocess(file);
  const out = await session.run({ [meta.input.name]: tensor });
  return score(Array.from(out.logits.data));
}

const manifest = fs
  .readFileSync(path.join(TRAINING, 'data', 'processed', 'manifest.jsonl'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
  .filter((r) => r.split === 'test' && r.source === 'indianfood');

// Evenly sample across classes so the distribution is not dominated by one dish.
const byClass = new Map();
for (const r of manifest) {
  const key = r.labels[0];
  if (!byClass.has(key)) byClass.set(key, []);
  if (byClass.get(key).length < 2) byClass.get(key).push(r);
}
const sample = [...byClass.values()].flat();

const rows = [];
for (const record of sample) {
  const file = path.join(TRAINING, 'data', record.image);
  if (!fs.existsSync(file)) continue;
  const expected = record.labels[0].replace(/_/g, ' ').toLowerCase();
  const s = await classify(file);
  rows.push({ ...s, expected, correct: s.softmaxName.toLowerCase() === expected });
}

const correct = rows.filter((r) => r.correct);
const wrong = rows.filter((r) => !r.correct);
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

console.log(`\n=== real dish test images (n=${rows.length}, ${byClass.size} classes) ===`);
console.log(`accuracy (softmax argmax)   ${pct(correct.length / rows.length)}`);
console.log(`softmax top-1  correct: mean ${pct(mean(correct.map((r) => r.softmaxTop)))}  p05 ${pct(quantile(correct.map((r) => r.softmaxTop), 0.05))}  p10 ${pct(quantile(correct.map((r) => r.softmaxTop), 0.1))}`);
console.log(`sigmoid top-1  correct: mean ${pct(mean(correct.map((r) => r.sigmoidTop)))}  min ${pct(Math.min(...correct.map((r) => r.sigmoidTop)))}`);
if (wrong.length) {
  console.log(`\nwrong predictions (n=${wrong.length}):`);
  for (const r of wrong) console.log(`  softmax ${pct(r.softmaxTop)}  sigmoid ${pct(r.sigmoidTop)}  said ${r.softmaxName} / expected ${r.expected}`);
}

// How many correct predictions survive a given softmax gate?
console.log('\nsoftmax gate recall on real dishes:');
for (const t of [0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7]) {
  const kept = correct.filter((r) => r.softmaxTop >= t);
  console.log(`  >=${(t * 100).toFixed(0)}%  kept ${kept.length}/${correct.length} (${pct(kept.length / correct.length)})`);
}

// Deliberately OOD inputs: the exact failure from the screenshot, plus raw veg.
const extra = [
  'demo/veg-basket.jpg',
  'demo/pantry-shelf.jpg',
].map((p) => path.join(TRAINING, p)).filter((p) => fs.existsSync(p));

for (const file of extra) {
  const s = await classify(file);
  console.log(`\n=== OOD: ${path.basename(file)} ===`);
  console.log(`  softmax top-1 ${pct(s.softmaxTop)} (${s.softmaxName})  margin ${pct(s.softmaxMargin)}  entropy ${s.softmaxEntropy.toFixed(3)}`);
  console.log(`  sigmoid top-1 ${pct(s.sigmoidTop)} (${s.sigmoidName})   -> sigmoid would ${s.sigmoidTop >= 0.35 ? 'SHOW a dish (wrong)' : 'abstain'}`);
  console.log(`  top3 ${s.top3.join(' | ')}`);
}

fs.writeFileSync(
  path.join(TRAINING, 'artifacts', 'gate_calibration.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), n: rows.length, accuracy: correct.length / rows.length, rows }, null, 2)
);
console.log('\nwrote artifacts/gate_calibration.json');
