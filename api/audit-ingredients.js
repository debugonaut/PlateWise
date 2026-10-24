import Groq from 'groq-sdk';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { recipe, userInventory = [] } = req.body;
  if (!recipe || !recipe.ingredients) {
    return res.status(400).json({ success: false, message: 'Recipe with ingredients is required' });
  }

  const recipeIngredients = recipe.ingredients;
  const inventoryNames = userInventory.map((i) => (typeof i === 'string' ? i : i.name).toLowerCase());

  const availableItems = [];
  const missingItems = [];

  recipeIngredients.forEach((item) => {
    const isAvailable = inventoryNames.some(
      (inv) => inv.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(inv)
    );
    if (isAvailable) {
      availableItems.push(item);
    } else {
      missingItems.push(item);
    }
  });

  const matchPercentage = Math.round((availableItems.length / recipeIngredients.length) * 100);
  const surplusItems = userInventory.filter((inv) => {
    const invName = (typeof inv === 'string' ? inv : inv.name).toLowerCase();
    return !recipeIngredients.some(
      (req) => req.name.toLowerCase().includes(invName) || invName.includes(req.name.toLowerCase())
    );
  });

  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey && missingItems.length > 0) {
    const candidateModels = [
      process.env.GROQ_MODEL,
      'openai/gpt-oss-120b',
      'qwen/qwen3.8-27b',
      'llama-3.3-70b-versatile',
      'llama3-70b-8192',
    ].filter(Boolean);

    try {
      const groq = new Groq({ apiKey });
      const prompt = `Recipe: ${recipe.title}
Missing Ingredients: ${JSON.stringify(missingItems.map((m) => m.name))}
Surplus Kitchen Items: ${JSON.stringify(surplusItems.map((s) => (typeof s === 'string' ? s : s.name)))}

Provide culinary substitution advice in JSON format:
{
  "substitutions": [
    { "missing": "Heavy Cream", "substitute": "3 tbsp Milk + 1 tsp Butter", "impact": "Maintains rich texture." }
  ],
  "surplusAdvice": [
    { "surplusItem": "Extra Tomatoes", "action": "Blend for a fresh side dip." }
  ]
}`;

      for (const model of candidateModels) {
        try {
          const response = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model,
            response_format: { type: 'json_object' },
            temperature: 0.5,
          });

          const raw = response.choices?.[0]?.message?.content?.trim() || '';
          const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);

          if (parsed.substitutions || parsed.surplusAdvice) {
            return res.json({
              success: true,
              source: 'groq-ai',
              model,
              data: {
                matchPercentage,
                availableItems,
                missingItems,
                substitutions: parsed.substitutions || [],
                surplusAdvice: parsed.surplusAdvice || [],
              },
            });
          }
        } catch (modelErr) {
          console.warn(`[Audit API] Model ${model} failed:`, modelErr.message);
        }
      }
    } catch (err) {
      console.error('Groq audit client error:', err.message);
    }
  }

  // Fallback substitutions
  const fallbackSubstitutions = missingItems.map((item) => {
    const name = item.name.toLowerCase();
    if (name.includes('cream')) return { missing: item.name, substitute: 'Full-fat Milk + 1 tsp Butter', impact: 'Adds creamy richness.' };
    if (name.includes('butter') || name.includes('ghee')) return { missing: item.name, substitute: 'Cooking Oil + pinch of salt', impact: 'Clean heat transfer.' };
    return { missing: item.name, substitute: 'Skip or use a mild pantry spice', impact: 'Recipe will still taste balanced.' };
  });

  const fallbackSurplus = surplusItems.slice(0, 2).map((item) => ({
    surplusItem: typeof item === 'string' ? item : item.name,
    action: `Incorporate into a fresh side salad or save for tomorrow's stir-fry.`,
  }));

  return res.json({
    success: true,
    data: {
      matchPercentage,
      availableItems,
      missingItems,
      substitutions: fallbackSubstitutions,
      surplusAdvice: fallbackSurplus,
    },
  });
}
