const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const outDir = path.join(__dirname, 'images');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// 1. Architecture Diagram
const archHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; padding: 20px; }
  .box { stroke-width: 2; rx: 12; }
  .title { font-weight: 700; font-size: 15px; }
  .subtitle { font-size: 12px; fill: #64748b; }
  .badge { font-size: 10px; font-weight: 600; font-family: monospace; }
</style>
</head>
<body>
<svg width="1000" height="580" viewBox="0 0 1000 580" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="1000" height="580" fill="#f8fafc" rx="16" stroke="#e2e8f0" stroke-width="2"/>
  
  <text x="500" y="38" fill="#0f172a" font-size="20" font-weight="800" text-anchor="middle">PlateWise: System Architecture & Data Flow</text>
  <text x="500" y="58" fill="#64748b" font-size="12" text-anchor="middle">Full-Stack Cloud Native Architecture (Client-Side SPA &bull; Vercel Serverless Edge &bull; Groq LPU Inference)</text>

  <!-- Client Layer -->
  <rect x="40" y="85" width="270" height="460" fill="#ffffff" stroke="#cbd5e1" class="box" />
  <rect x="55" y="100" width="240" height="34" fill="#0f172a" rx="8" />
  <text x="175" y="122" fill="#ffffff" font-size="13" font-weight="700" text-anchor="middle">CLIENT TIER (React 19)</text>

  <rect x="55" y="150" width="240" height="60" fill="#f1f5f9" stroke="#e2e8f0" rx="8" />
  <text x="65" y="172" fill="#0f172a" class="title">Responsive UI & Wizard</text>
  <text x="65" y="192" fill="#64748b" class="subtitle">5-Step Animated Workflow (Framer Motion)</text>

  <rect x="55" y="225" width="240" height="60" fill="#f1f5f9" stroke="#e2e8f0" rx="8" />
  <text x="65" y="247" fill="#0f172a" class="title">Client-Side Downscaler</text>
  <text x="65" y="267" fill="#64748b" class="subtitle">HTML5 Canvas (1024px, JPEG 0.9, &lt;3MB)</text>

  <rect x="55" y="300" width="240" height="60" fill="#f1f5f9" stroke="#e2e8f0" rx="8" />
  <text x="65" y="322" fill="#0f172a" class="title">Smooth Momentum Scroll</text>
  <text x="65" y="342" fill="#64748b" class="subtitle">Lenis Engine + macOS-style Floating Dock</text>

  <rect x="55" y="375" width="240" height="60" fill="#f1f5f9" stroke="#e2e8f0" rx="8" />
  <text x="65" y="397" fill="#0f172a" class="title">Cold-Start LocalStorage Mirror</text>
  <text x="65" y="417" fill="#64748b" class="subtitle">Survives serverless idle scale-to-zero</text>

  <rect x="55" y="450" width="240" height="80" fill="#f1f5f9" stroke="#e2e8f0" rx="8" />
  <text x="65" y="472" fill="#0f172a" class="title">Interactive Cooking Workstation</text>
  <text x="65" y="492" fill="#64748b" class="subtitle">Embedded YouTube Cooking Masterclass</text>
  <text x="65" y="512" fill="#0284c7" class="badge">Stateful Progress Check-off</text>

  <!-- Serverless Gateway Layer -->
  <rect x="365" y="85" width="270" height="460" fill="#ffffff" stroke="#cbd5e1" class="box" />
  <rect x="380" y="100" width="240" height="34" fill="#0284c7" rx="8" />
  <text x="500" y="122" fill="#ffffff" font-size="13" font-weight="700" text-anchor="middle">VERCEL SERVERLESS EDGE API</text>

  <rect x="380" y="150" width="240" height="75" fill="#f0f9ff" stroke="#bae6fd" rx="8" />
  <text x="390" y="172" fill="#0369a1" class="title">POST /api/vision-scan</text>
  <text x="390" y="192" fill="#64748b" class="subtitle">Base64 Ingestion, MIME Validation</text>
  <text x="390" y="210" fill="#0284c7" class="badge">Qwen 3.8 27B &bull; Multi-Ingredient Parser</text>

  <rect x="380" y="240" width="240" height="75" fill="#f0f9ff" stroke="#bae6fd" rx="8" />
  <text x="390" y="262" fill="#0369a1" class="title">GET /api/recommendations</text>
  <text x="390" y="282" fill="#64748b" class="subtitle">Pantry + TimeOfDay + Season + Culture</text>
  <text x="390" y="300" fill="#0284c7" class="badge">openai/gpt-oss-120b &bull; 4 Structured Recipes</text>

  <rect x="380" y="330" width="240" height="75" fill="#f0f9ff" stroke="#bae6fd" rx="8" />
  <text x="390" y="352" fill="#0369a1" class="title">POST /api/audit-ingredients</text>
  <text x="390" y="372" fill="#64748b" class="subtitle">Mathematical Match % & Substitutions</text>
  <text x="390" y="390" fill="#0284c7" class="badge">Missing Produce & Pantry Alternatives</text>

  <rect x="380" y="420" width="240" height="75" fill="#f0f9ff" stroke="#bae6fd" rx="8" />
  <text x="390" y="442" fill="#0369a1" class="title">GET/POST /api/vault</text>
  <text x="390" y="462" fill="#64748b" class="subtitle">Recipe Vault & Prepared History</text>
  <text x="390" y="480" fill="#0284c7" class="badge">JSON Storage & Cook-Again Loop</text>

  <!-- AI & Cloud Services Layer -->
  <rect x="690" y="85" width="270" height="460" fill="#ffffff" stroke="#cbd5e1" class="box" />
  <rect x="705" y="100" width="240" height="34" fill="#059669" rx="8" />
  <text x="825" y="122" fill="#ffffff" font-size="13" font-weight="700" text-anchor="middle">GROQ AI CLOUD & EXTERNAL</text>

  <rect x="705" y="150" width="240" height="85" fill="#f0fdf4" stroke="#bbf7d0" rx="8" />
  <text x="715" y="172" fill="#15803d" class="title">Groq Vision Cloud</text>
  <text x="715" y="192" fill="#64748b" class="subtitle">Primary: qwen/qwen3.8-27b</text>
  <text x="715" y="210" fill="#64748b" class="subtitle">Fallback: llama-4-scout, 11b-vision</text>
  <text x="715" y="226" fill="#16a34a" class="badge">Inference Latency: ~1.2s</text>

  <rect x="705" y="250" width="240" height="85" fill="#f0fdf4" stroke="#bbf7d0" rx="8" />
  <text x="715" y="272" fill="#15803d" class="title">Groq Reasoning LLM</text>
  <text x="715" y="292" fill="#64748b" class="subtitle">Primary: openai/gpt-oss-120b</text>
  <text x="715" y="310" fill="#64748b" class="subtitle">Fallback: qwen3.8, llama-3.3-70b</text>
  <text x="715" y="326" fill="#16a34a" class="badge">Generation Latency: ~1.4s</text>

  <rect x="705" y="350" width="240" height="85" fill="#f0fdf4" stroke="#bbf7d0" rx="8" />
  <text x="715" y="372" fill="#15803d" class="title">YouTube Video API</text>
  <text x="715" y="392" fill="#64748b" class="subtitle">Culinary Masterclass Dynamic Embed</text>
  <text x="715" y="410" fill="#64748b" class="subtitle">Search Parameter Query Binding</text>
  <text x="715" y="426" fill="#16a34a" class="badge">Zero Cost &bull; Native Player</text>

  <!-- Connectors -->
  <path d="M 310 185 L 380 185" stroke="#0284c7" stroke-width="2" marker-end="url(#arrow)" />
  <path d="M 310 275 L 380 275" stroke="#0284c7" stroke-width="2" />
  <path d="M 310 365 L 380 365" stroke="#0284c7" stroke-width="2" />
  <path d="M 310 455 L 380 455" stroke="#0284c7" stroke-width="2" />

  <path d="M 620 185 L 705 185" stroke="#059669" stroke-width="2" />
  <path d="M 620 280 L 705 280" stroke="#059669" stroke-width="2" />
  <path d="M 620 370 L 705 370" stroke="#059669" stroke-width="2" />
  <path d="M 620 455 L 705 455" stroke="#059669" stroke-width="2" />
</svg>
</body>
</html>`;

// 2. Use Case Diagram
const usecaseHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; padding: 20px; }
  .actor-text { font-size: 14px; font-weight: 700; fill: #0f172a; }
  .uc-ellipse { fill: #f0fdf4; stroke: #16a34a; stroke-width: 2; }
  .uc-text { font-size: 12px; font-weight: 600; fill: #14532d; text-anchor: middle; }
</style>
</head>
<body>
<svg width="900" height="520" viewBox="0 0 900 520" xmlns="http://www.w3.org/2000/svg">
  <rect width="900" height="520" fill="#f8fafc" rx="16" stroke="#e2e8f0" stroke-width="2"/>
  
  <text x="450" y="38" fill="#0f172a" font-size="20" font-weight="800" text-anchor="middle">PlateWise: UML Use Case Diagram</text>
  <text x="450" y="58" fill="#64748b" font-size="12" text-anchor="middle">System Boundary: Zero-Waste Kitchen & Culinary Guidance Platform</text>

  <!-- System Box -->
  <rect x="230" y="80" width="480" height="415" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" rx="12"/>
  <text x="470" y="105" fill="#64748b" font-size="12" font-weight="700" text-anchor="middle">PLATEWISE APPLICATION BOUNDARY</text>

  <!-- Actor: Home Cook / User -->
  <g transform="translate(70, 200)">
    <!-- Stick figure -->
    <circle cx="40" cy="30" r="18" fill="#ffffff" stroke="#0f172a" stroke-width="2.5"/>
    <line x1="40" y1="48" x2="40" y2="105" stroke="#0f172a" stroke-width="2.5"/>
    <line x1="10" y1="68" x2="70" y2="68" stroke="#0f172a" stroke-width="2.5"/>
    <line x1="40" y1="105" x2="15" y2="155" stroke="#0f172a" stroke-width="2.5"/>
    <line x1="40" y1="105" x2="65" y2="155" stroke="#0f172a" stroke-width="2.5"/>
    <text x="40" y="180" class="actor-text" text-anchor="middle">User / Cook</text>
  </g>

  <!-- Actor: Groq AI Services -->
  <g transform="translate(750, 200)">
    <rect x="0" y="20" width="110" height="110" fill="#ffffff" stroke="#0284c7" stroke-width="2.5" rx="12"/>
    <text x="55" y="65" fill="#0284c7" font-size="14" font-weight="700" text-anchor="middle">&lt;&lt;System&gt;&gt;</text>
    <text x="55" y="85" fill="#0f172a" font-size="13" font-weight="700" text-anchor="middle">Groq Cloud</text>
    <text x="55" y="105" fill="#64748b" font-size="11" text-anchor="middle">Vision & LLM</text>
  </g>

  <!-- Use cases inside boundary -->
  <g transform="translate(470, 140)">
    <ellipse cx="0" cy="0" rx="150" ry="24" class="uc-ellipse"/>
    <text x="0" y="5" class="uc-text">UC1: Upload / Drag Fridge Photo</text>
  </g>

  <g transform="translate(470, 195)">
    <ellipse cx="0" cy="0" rx="150" ry="24" class="uc-ellipse"/>
    <text x="0" y="5" class="uc-text">UC2: Select Multi-Item Demo Preset</text>
  </g>

  <g transform="translate(470, 250)">
    <ellipse cx="0" cy="0" rx="150" ry="24" class="uc-ellipse"/>
    <text x="0" y="5" class="uc-text">UC3: Filter by Meal Context & Time</text>
  </g>

  <g transform="translate(470, 305)">
    <ellipse cx="0" cy="0" rx="150" ry="24" class="uc-ellipse"/>
    <text x="0" y="5" class="uc-text">UC4: Generate Tailored AI Recipes</text>
  </g>

  <g transform="translate(470, 360)">
    <ellipse cx="0" cy="0" rx="150" ry="24" class="uc-ellipse"/>
    <text x="0" y="5" class="uc-text">UC5: Audit Missing Items & Substitutions</text>
  </g>

  <g transform="translate(470, 415)">
    <ellipse cx="0" cy="0" rx="150" ry="24" class="uc-ellipse"/>
    <text x="0" y="5" class="uc-text">UC6: Cook with Interactive Checklist</text>
  </g>

  <g transform="translate(470, 465)">
    <ellipse cx="0" cy="0" rx="150" ry="20" class="uc-ellipse"/>
    <text x="0" y="4" class="uc-text">UC7: Archive Meal to Recipe Vault</text>
  </g>

  <!-- Links from User -->
  <line x1="120" y1="230" x2="320" y2="140" stroke="#64748b" stroke-width="1.5"/>
  <line x1="120" y1="240" x2="320" y2="195" stroke="#64748b" stroke-width="1.5"/>
  <line x1="120" y1="255" x2="320" y2="250" stroke="#64748b" stroke-width="1.5"/>
  <line x1="120" y1="270" x2="320" y2="305" stroke="#64748b" stroke-width="1.5"/>
  <line x1="120" y1="285" x2="320" y2="360" stroke="#64748b" stroke-width="1.5"/>
  <line x1="120" y1="300" x2="320" y2="415" stroke="#64748b" stroke-width="1.5"/>
  <line x1="120" y1="315" x2="320" y2="465" stroke="#64748b" stroke-width="1.5"/>

  <!-- Links to Groq AI -->
  <line x1="620" y1="140" x2="750" y2="230" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="4,4"/>
  <line x1="620" y1="305" x2="750" y2="250" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="4,4"/>
  <line x1="620" y1="360" x2="750" y2="270" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="4,4"/>
</svg>
</body>
</html>`;

// 3. Pipeline Flowchart Diagram
const flowHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; padding: 20px; }
  .step-box { rx: 10; stroke-width: 2; }
  .title { font-weight: 700; font-size: 14px; }
  .desc { font-size: 11px; fill: #475569; }
</style>
</head>
<body>
<svg width="960" height="340" viewBox="0 0 960 340" xmlns="http://www.w3.org/2000/svg">
  <rect width="960" height="340" fill="#f8fafc" rx="16" stroke="#e2e8f0" stroke-width="2"/>
  <text x="480" y="34" fill="#0f172a" font-size="18" font-weight="800" text-anchor="middle">PlateWise: 5-Stage Wizard Processing Pipeline</text>
  <text x="480" y="54" fill="#64748b" font-size="12" text-anchor="middle">From Fridge Photo Ingestion to Complete Cooked Meal Logging</text>

  <!-- Step 1 -->
  <g transform="translate(30, 80)">
    <rect width="165" height="210" fill="#ffffff" stroke="#0284c7" class="step-box"/>
    <rect width="165" height="32" fill="#0284c7" rx="10"/>
    <text x="82" y="21" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">STAGE 01 &bull; SCAN</text>
    <text x="12" y="60" fill="#0f172a" class="title">Visual Ingestion</text>
    <text x="12" y="80" class="desc">&bull; Camera / Drag & Drop</text>
    <text x="12" y="98" class="desc">&bull; 3 Multi-Item Demos</text>
    <text x="12" y="116" class="desc">&bull; Canvas Downscaler</text>
    <text x="12" y="134" class="desc">&bull; Groq Qwen Vision</text>
    <rect x="10" y="155" width="145" height="48" fill="#f0f9ff" rx="6"/>
    <text x="82" y="174" fill="#0369a1" font-size="10" font-weight="700" text-anchor="middle">Output: Inventory</text>
    <text x="82" y="190" fill="#64748b" font-size="9" text-anchor="middle">8 to 16 Produce Items</text>
  </g>

  <!-- Arrow 1-2 -->
  <path d="M 205 185 L 225 185" stroke="#94a3b8" stroke-width="3" />

  <!-- Step 2 -->
  <g transform="translate(225, 80)">
    <rect width="165" height="210" fill="#ffffff" stroke="#6366f1" class="step-box"/>
    <rect width="165" height="32" fill="#6366f1" rx="10"/>
    <text x="82" y="21" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">STAGE 02 &bull; SUGGEST</text>
    <text x="12" y="60" fill="#0f172a" class="title">Context Engine</text>
    <text x="12" y="80" class="desc">&bull; Meal: Breakfast/Dinner</text>
    <text x="12" y="98" class="desc">&bull; Season: Monsoon/Winter</text>
    <text x="12" y="116" class="desc">&bull; Cuisine: Indian Comfort</text>
    <text x="12" y="134" class="desc">&bull; Groq gpt-oss-120b</text>
    <rect x="10" y="155" width="145" height="48" fill="#eef2ff" rx="6"/>
    <text x="82" y="174" fill="#4338ca" font-size="10" font-weight="700" text-anchor="middle">Output: 4 Recipes</text>
    <text x="82" y="190" fill="#64748b" font-size="9" text-anchor="middle">Prep Time, Steps & Difficulty</text>
  </g>

  <!-- Arrow 2-3 -->
  <path d="M 400 185 L 420 185" stroke="#94a3b8" stroke-width="3" />

  <!-- Step 3 -->
  <g transform="translate(420, 80)">
    <rect width="165" height="210" fill="#ffffff" stroke="#059669" class="step-box"/>
    <rect width="165" height="32" fill="#059669" rx="10"/>
    <text x="82" y="21" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">STAGE 03 &bull; AUDIT</text>
    <text x="12" y="60" fill="#0f172a" class="title">Ingredient Audit</text>
    <text x="12" y="80" class="desc">&bull; Match Percentage</text>
    <text x="12" y="98" class="desc">&bull; Missing Ingredients</text>
    <text x="12" y="116" class="desc">&bull; Smart Substitutions</text>
    <text x="12" y="134" class="desc">&bull; Surplus Mitigation</text>
    <rect x="10" y="155" width="145" height="48" fill="#f0fdf4" rx="6"/>
    <text x="82" y="174" fill="#15803d" font-size="10" font-weight="700" text-anchor="middle">Output: Audit Score</text>
    <text x="82" y="190" fill="#64748b" font-size="9" text-anchor="middle">Calculated Compatibility</text>
  </g>

  <!-- Arrow 3-4 -->
  <path d="M 595 185 L 615 185" stroke="#94a3b8" stroke-width="3" />

  <!-- Step 4 -->
  <g transform="translate(615, 80)">
    <rect width="165" height="210" fill="#ffffff" stroke="#d97706" class="step-box"/>
    <rect width="165" height="32" fill="#d97706" rx="10"/>
    <text x="82" y="21" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">STAGE 04 &bull; COOK</text>
    <text x="12" y="60" fill="#0f172a" class="title">Culinary Station</text>
    <text x="12" y="80" class="desc">&bull; YouTube Video Player</text>
    <text x="12" y="98" class="desc">&bull; Dynamic Query Search</text>
    <text x="12" y="116" class="desc">&bull; Step Checklist</text>
    <text x="12" y="134" class="desc">&bull; Strike-through states</text>
    <rect x="10" y="155" width="145" height="48" fill="#fef3c7" rx="6"/>
    <text x="82" y="174" fill="#b45309" font-size="10" font-weight="700" text-anchor="middle">Action: Finish Meal</text>
    <text x="82" y="190" fill="#64748b" font-size="9" text-anchor="middle">Mark as Cooked</text>
  </g>

  <!-- Arrow 4-5 -->
  <path d="M 790 185 L 810 185" stroke="#94a3b8" stroke-width="3" />

  <!-- Step 5 -->
  <g transform="translate(810, 80)">
    <rect width="125" height="210" fill="#ffffff" stroke="#475569" class="step-box"/>
    <rect width="125" height="32" fill="#475569" rx="10"/>
    <text x="62" y="21" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">STAGE 05 &bull; VAULT</text>
    <text x="10" y="60" fill="#0f172a" class="title">Persistence</text>
    <text x="10" y="80" class="desc">&bull; History Archive</text>
    <text x="10" y="98" class="desc">&bull; LocalStorage</text>
    <text x="10" y="116" class="desc">&bull; /api/vault log</text>
    <text x="10" y="134" class="desc">&bull; Cook Again</text>
    <rect x="8" y="155" width="109" height="48" fill="#f1f5f9" rx="6"/>
    <text x="62" y="174" fill="#334155" font-size="10" font-weight="700" text-anchor="middle">Result: Saved</text>
    <text x="62" y="190" fill="#64748b" font-size="9" text-anchor="middle">Closed Feedback Loop</text>
  </g>
</svg>
</body>
</html>`;

const files = [
  { html: archHtml, name: 'platewise_architecture.png', w: 1000, h: 580 },
  { html: usecaseHtml, name: 'platewise_usecase.png', w: 900, h: 520 },
  { html: flowHtml, name: 'platewise_flowchart.png', w: 960, h: 340 },
];

for (const f of files) {
  const tempHtml = path.join(outDir, 'temp.html');
  const outPng = path.join(outDir, f.name);
  fs.writeFileSync(tempHtml, f.html);
  execSync(`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --window-size=${f.w},${f.h} --screenshot="${outPng}" "${tempHtml}"`);
  fs.unlinkSync(tempHtml);
  console.log(`Generated: ${outPng}`);
}
