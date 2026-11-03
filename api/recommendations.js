import Groq from 'groq-sdk';
import { selectCuratedRecipes } from '../lib/curatedRecipes.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { timeOfDay = 'Dinner', season = 'Monsoon', culture = 'Continental', inventory = '' } = req.query;
  const inventoryNames = inventory
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey) {
    const candidateModels = [
      process.env.GROQ_MODEL,
      'openai/gpt-oss-120b',
      'qwen/qwen3.8-27b',
      'llama-3.3-70b-versatile',
      'llama3-70b-8192',
    ].filter(Boolean);

    try {
      const groq = new Groq({ apiKey });
      const prompt = `You are PlateWise, an elite culinary chef AI.
Generate 4 distinct, appetizing recipes for:
- Available Ingredients: ${inventory || 'Tomatoes, Onions, Garlic, Potatoes, Bell Peppers, Mushrooms, Olive Oil'}
- Time of Day: ${timeOfDay}
- Season: ${season}
- Cuisine: ${culture}

Prioritise dishes that directly use the available ingredients and keep missing items to a minimum.
Make the four recipes genuinely different: different dish families, different primary ingredients, and different cooking methods. Never repeat a title or return minor variations of the same dish.
Do not include an image field; the app assigns a photo to each recipe.

Return ONLY valid JSON:
{
  "recommendations": [
    {
      "id": "rec-1",
      "title": "Dish Name",
      "culture": "${culture}",
      "mealType": "${timeOfDay}",
      "season": "${season}",
      "prepTime": "20m",
      "difficulty": "Easy",
      "servings": 2,
      "description": "Short 1-sentence description.",
      "ingredients": [{ "name": "Ingredient", "amount": "quantity", "category": "Produce" }],
      "steps": ["Step 1", "Step 2"]
    }
  ]
}`;

      for (const model of candidateModels) {
        try {
          const response = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model,
            response_format: { type: 'json_object' },
            temperature: 0.7,
          });

          const raw = response.choices?.[0]?.message?.content?.trim() || '';
          const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);

          if (parsed.recommendations?.length > 0) {
            return res.json({
              success: true,
              source: 'groq-ai',
              model,
              data: parsed.recommendations,
            });
          }
        } catch (modelErr) {
          console.warn(`[Recommendations API] Model ${model} failed:`, modelErr.message);
        }
      }
    } catch (err) {
      console.error('Groq client error:', err.message);
    }
  }

  return res.json({
    success: true,
    source: 'curated-engine',
    data: selectCuratedRecipes({
      inventory: inventoryNames,
      timeOfDay,
      season,
      culture,
    }),
  });
}
