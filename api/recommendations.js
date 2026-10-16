import Groq from 'groq-sdk';

const FALLBACK_RECIPES = [
  {
    id: 'dish-1', title: 'Mediterranean Roasted Summer Veggie Medley', culture: 'Continental',
    mealType: 'Dinner', season: 'Monsoon', prepTime: '25m', difficulty: 'Easy', servings: 2,
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
    description: 'Caramelized zucchini ribbons, sweet bell peppers, mushrooms, and roasted garlic in aromatic olive oil.',
    ingredients: [
      { name: 'Zucchini', amount: '2 medium sliced', category: 'Produce' },
      { name: 'Bell Peppers / Capsicum', amount: '2 chopped', category: 'Produce' },
      { name: 'Mushrooms', amount: '200g sliced', category: 'Produce' },
      { name: 'Green Beans', amount: '150g trimmed', category: 'Produce' },
      { name: 'Potatoes', amount: '2 medium diced', category: 'Produce' },
      { name: 'Garlic', amount: '5 cloves minced', category: 'Produce' },
      { name: 'Olive Oil', amount: '3 tbsp', category: 'Oils & Sauces' },
    ],
    steps: [
      'Preheat cast iron skillet with 2 tbsp extra virgin olive oil.',
      'Toss cubed potatoes, sliced zucchini, bell peppers, and green beans with minced garlic and dried oregano.',
      'Sauté on medium-high until vegetables develop charred golden edges.',
      'Add sliced mushrooms during the last 6 minutes so they retain their juicy texture.',
      'Season with freshly cracked black pepper and finish with chopped fresh parsley.',
    ],
  },
  {
    id: 'dish-2', title: 'Rustic Mushroom & Tomato Skillet Sauté', culture: 'Continental',
    mealType: 'Dinner', season: 'Monsoon', prepTime: '15m', difficulty: 'Easy', servings: 2,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    description: 'Juicy skillet-seared mushrooms braised in blistered ripe tomatoes, sweet onions, garlic, and fresh mint.',
    ingredients: [
      { name: 'Mushrooms', amount: '250g sliced', category: 'Produce' },
      { name: 'Tomatoes', amount: '3 ripe diced', category: 'Produce' },
      { name: 'Onions', amount: '1 medium sliced', category: 'Produce' },
      { name: 'Garlic', amount: '4 cloves crushed', category: 'Produce' },
      { name: 'Olive Oil', amount: '2 tbsp', category: 'Oils & Sauces' },
    ],
    steps: [
      'Heat olive oil in a heavy skillet until shimmering.',
      'Sauté sliced onions and crushed garlic on medium heat until golden.',
      'Toss in sliced mushrooms and sear undisturbed for 3 minutes to develop umami browning.',
      'Fold in chopped tomatoes and cracked black pepper; simmer until a glossy sauce forms.',
      'Garnish with chopped parsley and fresh mint leaves before serving hot.',
    ],
  },
  {
    id: 'dish-3', title: 'Crispy Skillet Herb Potatoes with Green Beans', culture: 'Continental',
    mealType: 'Breakfast', season: 'Monsoon', prepTime: '20m', difficulty: 'Easy', servings: 2,
    image: 'https://images.unsplash.com/photo-1518013031184-41d4bd60014b?w=800&auto=format&fit=crop&q=80',
    description: 'Golden crispy skillet-fried potato cubes tossed with tender-crisp green beans, garlic chips, and paprika.',
    ingredients: [
      { name: 'Potatoes', amount: '3 medium cubed', category: 'Produce' },
      { name: 'Green Beans', amount: '200g trimmed', category: 'Produce' },
      { name: 'Garlic', amount: '4 cloves sliced thin', category: 'Produce' },
      { name: 'Olive Oil', amount: '2 tbsp', category: 'Oils & Sauces' },
    ],
    steps: [
      'Steam or par-boil potato cubes for 5 minutes until just fork-tender, then drain.',
      'Heat 2 tbsp olive oil in your skillet over medium heat.',
      'Add potato cubes and sear until golden and crusty on all sides (approx 8-10 minutes).',
      'Toss in sliced garlic and trimmed green beans; stir-fry for 4 minutes until bright green.',
      'Dust with paprika, oregano, sea salt, and black pepper. Serve steaming hot.',
    ],
  },
  {
    id: 'dish-4', title: 'Fresh Garden Ratatouille Skillet Stew', culture: 'Continental',
    mealType: 'Dinner', season: 'Monsoon', prepTime: '30m', difficulty: 'Medium', servings: 3,
    image: 'https://images.unsplash.com/photo-1572441713132-c542fc4fe282?w=800&auto=format&fit=crop&q=80',
    description: 'A vibrant French provincial skillet stew of slow-simmered tomatoes, layered zucchini, bell peppers, and garlic.',
    ingredients: [
      { name: 'Tomatoes', amount: '4 ripe pureed/diced', category: 'Produce' },
      { name: 'Zucchini', amount: '2 medium sliced in rounds', category: 'Produce' },
      { name: 'Bell Peppers / Capsicum', amount: '1 large sliced', category: 'Produce' },
      { name: 'Onions', amount: '2 medium sliced', category: 'Produce' },
      { name: 'Garlic', amount: '6 cloves minced', category: 'Produce' },
      { name: 'Olive Oil', amount: '3 tbsp', category: 'Oils & Sauces' },
    ],
    steps: [
      'Simmer minced garlic, onions, and crushed tomatoes with olive oil and oregano for 8 minutes.',
      'Arrange sliced zucchini and bell peppers over the sauce.',
      'Drizzle with olive oil, sprinkle with salt, black pepper, and chili flakes.',
      'Cover skillet and braise over low heat for 18 minutes until tender.',
      'Garnish with fresh parsley and mint, enjoy with toasted rustic bread.',
    ],
  },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { timeOfDay = 'Dinner', season = 'Monsoon', culture = 'Continental', inventory = '' } = req.query;

  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey) {
    try {
      const groq = new Groq({ apiKey });
      const prompt = `You are PlateWise, an elite culinary chef AI.
Generate 4 distinct, appetizing recipes for:
- Available Ingredients: ${inventory || 'Tomatoes, Onions, Garlic, Potatoes, Bell Peppers, Mushrooms, Olive Oil'}
- Time of Day: ${timeOfDay}
- Season: ${season}
- Cuisine: ${culture}

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
      "image": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80",
      "ingredients": [{ "name": "Ingredient", "amount": "quantity", "category": "Produce" }],
      "steps": ["Step 1", "Step 2"]
    }
  ]
}`;

      const response = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      if (parsed.recommendations?.length > 0) {
        return res.json({ success: true, source: 'groq-ai', data: parsed.recommendations });
      }
    } catch (err) {
      console.error('Groq error:', err.message);
    }
  }

  return res.json({ success: true, source: 'curated-engine', data: FALLBACK_RECIPES });
}
