# PlateWise 🍳🥗
> **AI-Driven Fridge-to-Recipe Kitchen Intelligence & Food Waste Mitigation Platform**

---

## 🌐 Live Production Deployment & Links
- **Production URL:** [https://platewise1705.vercel.app/](https://platewise1705.vercel.app/)
- **GitHub Repository:** [https://github.com/debugonaut/PlateWise](https://github.com/debugonaut/PlateWise)

---

## 📌 Problem Statement & Overview
Household food waste accounts for over 60% of global food loss, driven primarily by domestic "culinary friction"—the cognitive exhaustion of deciding what to cook with heterogeneous, partially depleted pantry items before spoilage occurs.

**PlateWise** is a production-grade full-stack web application that allows users to snap or upload unstructured photos of refrigerator shelves, kitchen countertops, or grocery hauls. The platform instantly analyzes the visual scene, extracts ingredient inventories, audits pantry compatibility, and synthesizes 4 context-aware gourmet recipes tailored to meal time, seasonal availability, and regional culinary cultures.

---

## 🚀 Key Features
1. **Multi-Modal Vision Recognition:** Fast multi-ingredient detection powered by Groq LPU inference (`qwen/qwen3.8-27b`, with fallback to `meta-llama/llama-4-scout` and `llama-3.2-11b-vision`).
2. **Context-Aware Culinary Reasoning:** Dynamic recipe synthesis considering meal time (Breakfast, Lunch, Dinner), seasonal availability (Monsoon, Summer, Winter), and regional cuisine styles (Indian Comfort, Mediterranean, Continental).
3. **Automated Pantry Audit Engine:** Computes quantitative pantry compatibility match percentages ($0\% - 100\%$), identifies missing items, and provides intelligent substitutions.
4. **Interactive Cooking Workstation:** Step-by-step guidance, interactive progress checklist, and dynamically queried YouTube Masterclass tutorials.
5. **Dual-Tier State Persistence:** Ephemeral serverless edge functions paired with browser `localStorage` mirroring to ensure zero state loss during cold starts.
6. **Zero-Cost Production Architecture:** 100% operational viability on free developer tiers (Vercel Serverless Edge + Groq LPU Cloud).

---

## 🛠️ Technology Stack
- **Frontend:** React 19, Vite, Vanilla CSS Design System (Glassmorphic dark/light aesthetics, responsive CSS Grid / Flexbox).
- **Backend / Edge:** Stateless Node.js Vercel Serverless Functions (`api/recommendations.js`, `api/vision-scan.js`, `api/vault.js`).
- **AI & Vision:** Groq Cloud LPU (`qwen/qwen3.8-27b`, `openai/gpt-oss-120b`, `llama-3.3-70b-versatile`).
- **Deployment:** Vercel Global Edge Network with automated continuous deployment from GitHub.

---

## 💻 Local Setup and Running
### Prerequisites
- Node.js >= 20.0.0
- npm >= 9.0.0
- Groq API Key (from [https://console.groq.com/](https://console.groq.com/))

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/debugonaut/PlateWise.git
   cd PlateWise
   ```
2. Install dependencies:
   ```bash
   npm run install:all
   ```
3. Configure environment variables:
   ```bash
   cp .env.example backend/.env
   # Add your GROQ_API_KEY inside backend/.env
   ```
4. Start the development servers:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

