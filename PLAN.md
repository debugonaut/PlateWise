# PlateWise — Deployment & Handoff Plan

> **Project**: PlateWise — AI Fridge-to-Recipe Engine  
> **Stack**: React 19 + Vite (frontend) · Node.js Serverless Functions (backend) · Groq AI (Vision + LLM)  
> **Target**: Vercel (free hobby tier works)  
> **Estimated time to deploy**: ~20 minutes

---

## Table of Contents

1. [What This App Does](#1-what-this-app-does)
2. [Repository Structure](#2-repository-structure)
3. [Prerequisites](#3-prerequisites)
4. [Get a Groq API Key](#4-get-a-groq-api-key)
5. [Run Locally](#5-run-locally)
6. [Push to GitHub](#6-push-to-github)
7. [Deploy to Vercel](#7-deploy-to-vercel)
8. [Verify the Deployment](#8-verify-the-deployment)
9. [How the App Works (for interviews)](#9-how-the-app-works-for-interviews)
10. [Common Issues & Fixes](#10-common-issues--fixes)
11. [Food Recognition Model — Datasets](#11-food-recognition-model--datasets)

---

## 1. What This App Does

PlateWise is a 5-stage AI cooking assistant:

| Stage | What Happens |
|-------|-------------|
| **① Scan** | User uploads a photo of their fridge or pantry. Groq's **Llama 4 Scout Vision** model reads the image and returns a structured list of detected ingredients (name, category, estimated quantity). |
| **② Suggest** | User picks time-of-day, season, and cuisine. **Groq Llama 3.3-70B** generates 4 recipes that prioritise the scanned ingredients. |
| **③ Audit** | App cross-references each recipe's ingredient list against the user's pantry. Computes a **match %**, surfaces missing items, and uses the LLM to suggest smart substitutions. |
| **④ Cook** | Step-by-step checklist with an embedded YouTube tutorial auto-searched for the recipe. |
| **⑤ Vault** | Saves cooked recipes with date and rating. |

**If `GROQ_API_KEY` is not set**, every endpoint falls back to a curated hardcoded dataset — the app is fully functional without an API key.

---

## 2. Repository Structure

```
platewise/
│
├── api/                          ← Vercel serverless functions (Node.js ES modules)
│   ├── recommendations.js        ← GET  /api/recommendations?timeOfDay=&season=&culture=&inventory=
│   ├── vision-scan.js            ← POST /api/vision-scan          body: { image: "data:image/..." }
│   ├── audit-ingredients.js      ← POST /api/audit-ingredients    body: { recipe, userInventory }
│   └── vault.js                  ← GET/POST /api/vault
│
├── frontend/                     ← Vite + React 19 SPA
│   ├── src/
│   │   ├── App.jsx               ← Root app, step state machine
│   │   ├── components/
│   │   │   ├── steps/
│   │   │   │   ├── StepScan.jsx          ← Pantry input + AI scanner trigger
│   │   │   │   ├── StepSuggest.jsx       ← Recipe cards grid
│   │   │   │   ├── StepAudit.jsx         ← Ingredient match + substitutions
│   │   │   │   ├── StepCook.jsx          ← Checklist + YouTube embed
│   │   │   │   └── StepVault.jsx         ← History log
│   │   │   └── VisionScannerModal.jsx    ← Camera/upload modal (calls /api/vision-scan)
│   │   ├── data/
│   │   │   └── householdIngredients.js   ← ~200 item pantry dataset for click-to-add
│   │   └── lib/
│   │       └── recipeImages.js           ← Unsplash image URL helpers
│   ├── vite.config.js            ← Dev: proxies /api → localhost:5001
│   └── package.json
│
├── backend/                      ← Original Express server (local dev only, NOT deployed)
│   └── server.js
│
├── vercel.json                   ← Build config, rewrites, CORS headers
├── package.json                  ← Root: "type": "module", groq-sdk dependency
├── .gitignore
└── PLAN.md                       ← This file
```

> [!IMPORTANT]
> The `backend/` folder is **not deployed to Vercel**. It only runs locally during development.  
> All production API logic lives in `api/` as serverless functions.

---

## 3. Prerequisites

Install these before starting.

| Tool | Version | Check | Install |
|------|---------|-------|---------|
| Node.js | ≥ 18 | `node -v` | [nodejs.org](https://nodejs.org) |
| npm | ≥ 9 | `npm -v` | Comes with Node |
| Git | any | `git --version` | [git-scm.com](https://git-scm.com) |
| Vercel CLI (optional) | latest | `vercel --version` | `npm i -g vercel` |

---

## 4. Get a Groq API Key

> [!NOTE]
> This is free. Groq's free tier gives you generous token limits for both vision and text models.

1. Go to **[console.groq.com](https://console.groq.com)**
2. Sign up / log in
3. Click **API Keys → Create API Key**
4. Copy the key — it starts with `gsk_...`
5. Keep it safe — you'll add it to Vercel in Step 7

**Models used by PlateWise:**

| API function | Model | Purpose |
|---|---|---|
| `/api/vision-scan` | `meta-llama/llama-4-scout-17b-16e-instruct` | Food item detection from image |
| `/api/recommendations` | `llama-3.3-70b-versatile` | Recipe generation |
| `/api/audit-ingredients` | `llama-3.3-70b-versatile` | Substitution suggestions |

---

## 5. Run Locally

### 5a. Install dependencies

```bash
# Root (installs groq-sdk for the api/ serverless functions)
cd platewise
npm install

# Frontend
cd frontend
npm install
cd ..

# Backend (only needed for local dev)
cd backend
npm install
cd ..
```

### 5b. Set up environment variable

Create a `.env` file at the **root** of the project:

```bash
# platewise/.env
GROQ_API_KEY=gsk_your_key_here
```

> [!WARNING]
> Never commit `.env` to git. It's already in `.gitignore`.

### 5c. Start both servers

Open **two separate terminal windows**:

**Terminal 1 — Backend (Express, port 5001):**
```bash
cd platewise/backend
node server.js
```

You should see:
```
[PlateWise Server] Running on http://localhost:5001
[Vision AI] Loading Neural Zero-Shot Vision Model (CLIP-ViT)...
```

**Terminal 2 — Frontend (Vite, port 5188):**
```bash
cd platewise/frontend
npm run dev
```

Open **[http://localhost:5188](http://localhost:5188)**

The Vite dev server proxies all `/api/*` calls to `localhost:5001` automatically (configured in `vite.config.js`).

### 5d. Test each step locally

- [ ] Upload a photo of food → should get detected ingredients
- [ ] Click "CONTINUE TO SUGGESTIONS" → should see 4 recipe cards
- [ ] Select a recipe → should see pantry match %
- [ ] Click "COOK THIS" → should see step checklist + YouTube embed
- [ ] Mark as cooked → should appear in VAULT tab

---

## 6. Push to GitHub

### 6a. Create GitHub repo

1. Go to **[github.com/new](https://github.com/new)**
2. Repository name: `platewise`
3. Set to **Public** (required for Vercel hobby tier)
4. **Do NOT** check "Add README" — the repo already has files
5. Click **Create repository**

### 6b. Push code

```bash
cd platewise

# Add the GitHub remote (replace with your username)
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/platewise.git

# Push
git branch -M main
git push -u origin main
```

> [!NOTE]
> The git repo was already initialized with 2 commits:
> - `79823cc` — initial commit (all original source)
> - `bf94c62` — Vercel-ready deployment (api/ functions, vercel.json, .gitignore)

---

## 7. Deploy to Vercel

### Method A — Vercel Dashboard (recommended, no CLI needed)

1. Go to **[vercel.com](https://vercel.com)** → Sign in with GitHub
2. Click **"Add New… → Project"**
3. Find and **import** the `platewise` repository
4. Vercel will auto-detect the `vercel.json` — **do not change any build settings**

   It should show:
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
   - **Install Command**: `npm install`
   - **Framework**: Other

5. **Before clicking Deploy**, click **"Environment Variables"** and add:

   | Name | Value |
   |------|-------|
   | `GROQ_API_KEY` | `gsk_your_key_here` |

6. Click **Deploy**
7. Wait ~2 minutes → you'll get a URL like `platewise-xyz.vercel.app`

### Method B — Vercel CLI

```bash
# Install CLI globally if you haven't
npm i -g vercel

# From the project root
cd platewise
vercel

# Follow prompts:
# - Link to existing project? No → create new
# - Project name: platewise
# - In which directory is your code? ./
# - Want to override settings? No

# Add env variable
vercel env add GROQ_API_KEY
# Paste your gsk_... key, select all environments

# Deploy to production
vercel --prod
```

---

## 8. Verify the Deployment

After deployment, test each API endpoint directly:

### 8a. Test `/api/recommendations`
```bash
curl "https://your-app.vercel.app/api/recommendations?timeOfDay=Dinner&season=Monsoon&culture=Indian%20Comfort&inventory=Tomatoes%2COnions%2CGarlic"
```

Expected: `{ "success": true, "source": "groq-ai", "data": [...] }`

If `source` is `"curated-engine"` instead of `"groq-ai"`, your `GROQ_API_KEY` env var is not set correctly.

### 8b. Test `/api/vision-scan`
```bash
curl -X POST "https://your-app.vercel.app/api/vision-scan" \
  -H "Content-Type: application/json" \
  -d '{"image": "data:image/jpeg;base64,/9j/4AAQ..."}'
```

> For quick testing, use the **"Load Sample Kitchen Inventory"** button in the app — it bypasses the API and directly populates the pantry.

### 8c. Test `/api/vault`
```bash
curl "https://your-app.vercel.app/api/vault"
```

Expected: `{ "success": true, "data": [] }`

### 8d. Smoke test the full flow

- [ ] App loads at your Vercel URL
- [ ] Click "Load Sample Kitchen Inventory" → pantry fills
- [ ] Hit "CONTINUE TO SUGGESTIONS" → recipe cards appear with images
- [ ] Select a recipe → ingredient audit runs, match % shows
- [ ] "COOK THIS" → step checklist + YouTube embed loads
- [ ] "MARK AS COOKED" → recipe saved in VAULT

---

## 9. How the App Works (for interviews)

**Architecture overview:**

```
Browser (React SPA)
    │
    ├── /api/vision-scan  ──→  Groq Vision (Llama 4 Scout)
    │       └─ sends: { image: base64DataURL }
    │       └─ gets:  [{ name, category, estimatedQuantity }]
    │
    ├── /api/recommendations  ──→  Groq LLM (Llama 3.3-70B)
    │       └─ sends: ?timeOfDay=&season=&culture=&inventory=
    │       └─ gets:  [{ id, title, prepTime, ingredients, steps }]
    │
    ├── /api/audit-ingredients  ──→  Groq LLM (Llama 3.3-70B)
    │       └─ sends: { recipe, userInventory }
    │       └─ gets:  { matchPercentage, missingItems, substitutions }
    │
    └── /api/vault  ──→  In-memory (serverless)
            └─ GET/POST cooked recipe history
```

**Key technical decisions to talk about:**

1. **Why Groq Vision instead of CLIP/TensorFlow.js?**  
   CLIP via `@xenova/transformers` requires downloading a ~150MB model on every serverless cold start — Vercel would timeout. Groq's hosted vision API gives better accuracy, zero download time, and the free tier is more than enough for demos.

2. **Why serverless functions instead of Express?**  
   Express needs a persistent process. Vercel's model is serverless — each `/api/*.js` file becomes an isolated function that cold-starts per request. This is free, auto-scales, and requires zero infra management.

3. **Why `"type": "module"` in root `package.json`?**  
   Vercel runs the `api/` functions as ES modules. The `import Groq from 'groq-sdk'` syntax requires the module system to be ESM.

4. **What happens without an API key?**  
   Every function has a deterministic fallback. The app is fully demoable offline with `GROQ_API_KEY` unset.

5. **Why does the image get sent as a base64 data URL?**  
   Vercel serverless functions don't support multipart/form-data out of the box without a parser. Sending the image as a base64 string in a JSON body keeps the code simple and dependency-free.

---

## 10. Common Issues & Fixes

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `source: "curated-engine"` in API response | `GROQ_API_KEY` not set | Go to Vercel → Settings → Environment Variables → add key → redeploy |
| Build fails: `Cannot find module 'groq-sdk'` | Root `npm install` not run | Vercel runs `npm install` at root — check `installCommand` in `vercel.json` is set to `npm install` |
| `404` on `/api/recommendations` | Wrong output directory | Confirm `vercel.json → "outputDirectory": "frontend/dist"` |
| Vision scan always returns fallback | Image too large | Compress before upload; Vercel body limit is 4.5MB. The modal already reads the file as a data URL — ensure image is < 3MB |
| YouTube iframe blocked | Browser security policy | Click the "Watch on YouTube" link instead; the embed uses `listType=search` which some browsers block |
| Vault resets on every request | Expected — in-memory storage | Replace `userVault = []` in `api/vault.js` with Vercel KV (`@vercel/kv`) or a Supabase table for persistence |
| Tailwind classes not applying | `@tailwindcss/vite` plugin missing | Run `cd frontend && npm install` |
| `lucide-react` version mismatch | `^1.34.0` uses a different import style | Don't change the version in `frontend/package.json` — it matches the component imports |

---

## 11. Food Recognition Model — Datasets

> This section is relevant if you want to replace the Groq Vision API with a **locally trained model** (e.g., for offline use, faster inference, or custom food categories).

**The goal**: Train a multi-label image classifier that takes a photo of a fridge/pantry and outputs a list of food items present.

### Recommended datasets (publicly available):

| Dataset | Images | Classes | Best for | Link |
|---------|--------|---------|---------|------|
| **Food-101** (ETH Zurich) | 101,000 | 101 cooked dishes | Baseline classifier | [food-101.epfl.ch](https://data.vision.ee.ethz.ch/cvl/food-101.tar.gz) |
| **VegFru** | 29,200 | 292 vegetables & fruits | Raw produce identification (most relevant) | [GitHub](https://github.com/ustc-vim/vegfru) |
| **ISIA Food-500** | 399,000 | 500 categories | Large-scale fine-grained | [ISIA Lab](http://123.57.42.89/FoodComputing-Dataset/ISIA-Food500) |
| **iFood-2019** (CVPR) | 251,000 | 251 classes | Competition-grade accuracy | [Kaggle](https://www.kaggle.com/competitions/ifood-2019-fgvc6) |
| **Open Images v7** (subset) | ~2M total | ~60 food labels | Mixed kitchen scenes | [storage.googleapis.com/openimages](https://storage.googleapis.com/openimages/web/download_v7.html) |
| **FoodSeg103** | 7,118 | 103 segmentation classes | Pixel-level fridge region detection | [IITM](https://www.aitrics.com/foodseg103) |

### Recommended training approach for PlateWise use case:

**Architecture**: EfficientNet-B0 or MobileNetV3-Large (small enough for browser inference via TensorFlow.js)

**Training recipe**:
```
1. Pretrain backbone on ImageNet (use torchvision pretrained weights)
2. Fine-tune on VegFru + Food-101 combined (balance classes with WeightedRandomSampler)
3. Use multi-label BCE loss (a fridge has many items simultaneously)
4. Augment: RandomHorizontalFlip, ColorJitter, RandomCrop, MixUp
5. Export to ONNX → convert to TF.js graph model for browser inference
```

**Target metrics**:
- Top-5 accuracy ≥ 85% on VegFru test split
- Inference time < 200ms in browser (MobileNetV3 easily achieves this)
- Model size < 25MB after quantization

**Why not use these in PlateWise right now?**  
Training + converting + hosting a custom model adds days of work and complexity. The Groq Vision API (Llama 4 Scout) already achieves better contextual accuracy than a fine-tuned classifier because it understands phrases like *"that looks like paneer cut into cubes"* rather than just matching pixels to a fixed class list.

---

## Quick Reference Checklist

```
□ Clone the repo
□ npm install (root)
□ cd frontend && npm install
□ cd backend && npm install
□ Create platewise/.env with GROQ_API_KEY=gsk_...
□ node backend/server.js  (terminal 1)
□ cd frontend && npm run dev  (terminal 2)
□ Verify app at http://localhost:5188
□ Create GitHub repo → git remote add origin → git push
□ Import on vercel.com → add GROQ_API_KEY env var → Deploy
□ Test /api/recommendations, /api/vision-scan, /api/vault
□ Smoke test full 5-step flow on live URL
```

---

*Generated: October 2026 · Project: PlateWise · Author: Aadesh Khande*
