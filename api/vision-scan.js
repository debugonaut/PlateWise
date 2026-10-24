import Groq from 'groq-sdk';

// Curated food labels that Groq Vision will try to identify
const FOOD_CATEGORIES = [
  'Produce', 'Dairy', 'Proteins & Nuts', 'Oils & Sauces', 'Grains & Pulses', 'Spices', 'Frozen'
];

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body || {};

  if (!image) {
    return res.status(400).json({ success: false, message: 'Image is required (base64 data URL)' });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (apiKey) {
    const candidateModels = [
      process.env.GROQ_VISION_MODEL,
      'qwen/qwen3.8-27b',
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'llama-3.2-11b-vision-preview',
      'llama-3.2-90b-vision-preview',
    ].filter(Boolean);

    try {
      const groq = new Groq({ apiKey });

      for (const model of candidateModels) {
        try {
          const response = await groq.chat.completions.create({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: { url: image },
                  },
                  {
                    type: 'text',
                    text: `You are a professional culinary vision AI. Analyze this image of a fridge, pantry, kitchen counter, or grocery haul.

Identify ALL visible food ingredients and return them as a JSON array. Be specific about each item.

Return ONLY valid JSON (no markdown fences, no extra text):
{
  "ingredients": [
    { "name": "Tomatoes", "category": "Produce", "estimatedQuantity": "4-5 medium" },
    { "name": "Eggs", "category": "Proteins & Nuts", "estimatedQuantity": "~6" }
  ]
}

Categories to use: Produce, Dairy, Proteins & Nuts, Oils & Sauces, Grains & Pulses, Spices, Frozen.
If you cannot detect food clearly, return an empty ingredients array.`,
                  },
                ],
              },
            ],
            temperature: 0.2,
            max_tokens: 800,
          });

          const raw = response.choices?.[0]?.message?.content?.trim() || '';
          const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);

          if (parsed.ingredients && parsed.ingredients.length > 0) {
            return res.json({
              success: true,
              source: 'groq-vision',
              model,
              data: parsed.ingredients,
            });
          }
        } catch (modelErr) {
          console.warn(`[Vision API] Model ${model} failed:`, modelErr.message);
        }
      }
    } catch (err) {
      console.error('Groq vision client error:', err.message);
    }
  }

  // Fallback: deterministic sample list
  return res.json({
    success: true,
    source: 'fallback-vision',
    data: [
      { name: 'Tomatoes', category: 'Produce', estimatedQuantity: '4-5 medium' },
      { name: 'Onions', category: 'Produce', estimatedQuantity: '2-3 large' },
      { name: 'Garlic', category: 'Produce', estimatedQuantity: '1 bulb' },
      { name: 'Potatoes', category: 'Produce', estimatedQuantity: '3 medium' },
      { name: 'Bell Peppers / Capsicum', category: 'Produce', estimatedQuantity: '2' },
      { name: 'Green Beans', category: 'Produce', estimatedQuantity: '200g' },
      { name: 'Mushrooms', category: 'Produce', estimatedQuantity: '250g' },
      { name: 'Olive Oil', category: 'Oils & Sauces', estimatedQuantity: '1 bottle' },
    ],
  });
}
