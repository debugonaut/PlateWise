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

      const response = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        temperature: 0.5,
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      return res.json({
        success: true,
        data: {
          matchPercentage,
          availableItems,
          missingItems,
          substitutions: parsed.substitutions || [],
          surplusAdvice: parsed.surplusAdvice || [],
        },
      });
    } catch (err) {
      console.error('Groq audit error:', err.message);
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
