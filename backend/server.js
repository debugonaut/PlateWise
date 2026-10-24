const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const { Groq } = require('groq-sdk');
const { pipeline, RawImage } = require('@xenova/transformers');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The trained ingredient recogniser (training/ -> ONNX). Optional: if the model
// or onnxruntime is missing, the server still boots and CLIP carries the scan.
const { IngredientClassifier } = require('./ingredient-classifier.js');
const ingredientClassifier = new IngredientClassifier();

dotenv.config();

const app = express();

// Some shells export PORT=0, and the string "0" is truthy -- so the original
// `process.env.PORT || 5001` bound a random ephemeral port while vite.config.js
// proxies /api to a hardcoded 5001. Every API call then failed with no obvious
// cause. Only accept a real positive port; otherwise use 5001.
const parsedPort = Number.parseInt(process.env.PORT ?? '', 10);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 5001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const upload = multer({ storage: multer.memoryStorage() });

let activeGroqKey = process.env.GROQ_API_KEY || '';
let userVault = [];
let visionPipeline = null;

// The CLIP zero-shot model is only a *fallback* for when Groq Vision is
// unavailable, and it weighs roughly 150 MB. Loading it lazily keeps local
// startup quick and avoids that download on every `npm run dev:backend` even
// when a GROQ_API_KEY is configured.
const loadVisionPipeline = async () => {
  if (!visionPipeline) {
    console.log('[Vision AI] Loading fallback CLIP zero-shot model (Xenova/clip-vit-base-patch32)...');
    visionPipeline = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
    console.log('[Vision AI] Fallback vision model loaded.');
  }
  return visionPipeline;
};

const getGroqClient = (customKey) => {
  const key = customKey || activeGroqKey || process.env.GROQ_API_KEY;
  if (!key) return null;
  return new Groq({ apiKey: key });
};

// Candidate Labels for Zero-Shot Food Recognition
// ---------------------------------------------------------------------------
// CLIP zero-shot labels.
//
// CLIP scores every phrase here against the image, so the phrase list *is* the
// model's entire vocabulary -- it can never name anything absent from this list.
// Two consequences:
//   1. The list is deliberately broad and includes Indian pantry items, because
//      the app's own pantry data is Indian-centric.
//   2. It also includes unrelated "distractor" phrases that are intentionally
//      absent from LABEL_TO_INGREDIENT. They absorb probability mass so ordinary
//      photos (a room, a person) do not get scored as food, which is what makes
//      the "this photo has no ingredients" answer meaningful.
// ---------------------------------------------------------------------------
const FOOD_LABELS = [
  // Produce -- shared
  'fresh red tomatoes',
  'yellow or red onions',
  'raw potatoes',
  'garlic cloves and bulbs',
  'fresh ginger root',
  'green chili peppers',
  'bell peppers capsicum',
  'orange carrots',
  'fresh green coriander cilantro',
  'spinach palak greens',
  'fresh cauliflower',
  'cabbage',
  'green broccoli',
  'green peas',
  'sliced cucumber',
  'yellow lemon or lime',
  'purple eggplant brinjal',
  'mushrooms',
  'fresh green zucchini courgette',
  'fresh green beans',
  'fresh green parsley leaves',
  'fresh mint leaves',
  'fresh green salad lettuce',
  'spring onions scallions',
  'curry leaves',
  'fenugreek leaves methi',
  // Produce -- Indian / regional
  'bitter gourd karela',
  'bottle gourd lauki',
  'okra ladyfinger bhindi',
  'drumstick moringa pods',
  'taro root arbi colocasia',
  'raw banana plantain',
  'round gourd tinda',
  'jackfruit',
  'sweet potato',
  'beetroot',
  'white radish daikon',
  'pumpkin',
  'sweet corn cob',
  'fresh coconut',
  'tamarind pods',
  // Produce -- fruit
  'ripe mangoes',
  'bananas',
  'red apples',
  'oranges',
  'grapes',
  'pomegranate',
  'watermelon',
  'guava',
  'papaya',
  'pineapple',
  'strawberries',
  'blueberries',
  'avocado',
  'peaches',
  // Dairy
  'paneer cottage cheese cubes',
  'butter block',
  'clarified butter ghee',
  'milk bottle carton',
  'yogurt curd dahi bowl',
  'heavy cream',
  'cheddar cheese block',
  'mozzarella cheese',
  'tofu block',
  'coconut milk can',
  // Grains & Pulses
  'cooked basmati rice',
  'wheat flour atta',
  'all purpose flour maida',
  'besan gram flour',
  'penne macaroni pasta',
  'spaghetti noodles',
  'poha flattened rice',
  'rava sooji semolina',
  'rolled oats',
  'bread slices loaf',
  'yellow moong dal',
  'toor arhar dal',
  'chana dal split chickpeas',
  'masoor dal red lentils',
  'urad dal black gram',
  'chickpeas chole',
  'kidney beans rajma',
  'idli dosa batter',
  // Spices
  'cumin seeds jeera',
  'mustard seeds rai',
  'turmeric powder',
  'red chili powder',
  'coriander powder',
  'garam masala',
  'dried fenugreek leaves kasuri methi',
  'chaat masala',
  'asafoetida hing',
  'black pepper peppercorns',
  'oregano and chili flakes',
  'cardamom and cinnamon sticks',
  'bay leaves',
  'cloves',
  'salt',
  // Oils & Sauces
  'cooking oil bottle',
  'olive oil bottle',
  'soy sauce bottle',
  'vinegar bottle',
  'tomato ketchup bottle',
  'red chili sauce bottle',
  'mayonnaise jar',
  'honey jar',
  'peanut butter jar',
  // Proteins & Nuts
  'raw eggs carton',
  'raw chicken meat',
  'peanuts groundnuts',
  'cashews and almonds',
  'fish fillets',
  'prawns shrimp',
  'raw mutton red meat',
  // Frozen
  'frozen peas packet',
  'ice cream tub',
  // Distractors -- deliberately unmapped. These exist so non-food photos score
  // here instead of inflating a real ingredient label.
  'an empty room with a wall',
  'a person posing for a photo',
  'a car parked on a street',
  'a smartphone on a desk',
  'a laptop computer',
  'a printed document or receipt',
  'folded clothing',
  'a dog or a cat',
  'a houseplant on a windowsill',
  'a kitchen sink with dirty dishes',
  'an empty plate on a table',
  'a cookbook cover',
  'the sky and clouds',
  'a stack of books',
];

const ingredient = (name, category) => ({ name, category });

// Every food label above maps to a canonical name. Names reuse the app's own
// pantry vocabulary (frontend/src/data/householdIngredients.js) wherever one
// exists, so a detected chip feeds straight into the ingredient audit step.
const LABEL_TO_INGREDIENT = {
  // Produce
  'fresh red tomatoes': ingredient('Tomatoes', 'Produce'),
  'yellow or red onions': ingredient('Onions', 'Produce'),
  'raw potatoes': ingredient('Potatoes', 'Produce'),
  'garlic cloves and bulbs': ingredient('Garlic', 'Produce'),
  'fresh ginger root': ingredient('Ginger', 'Produce'),
  'green chili peppers': ingredient('Green Chilies', 'Produce'),
  'bell peppers capsicum': ingredient('Bell Peppers / Capsicum', 'Produce'),
  'orange carrots': ingredient('Carrots', 'Produce'),
  'fresh green coriander cilantro': ingredient('Coriander / Cilantro', 'Produce'),
  'spinach palak greens': ingredient('Spinach / Palak', 'Produce'),
  'fresh cauliflower': ingredient('Cauliflower', 'Produce'),
  'cabbage': ingredient('Cabbage', 'Produce'),
  'green broccoli': ingredient('Broccoli', 'Produce'),
  'green peas': ingredient('Green Peas', 'Produce'),
  'sliced cucumber': ingredient('Cucumber', 'Produce'),
  'yellow lemon or lime': ingredient('Lemon / Lime', 'Produce'),
  'purple eggplant brinjal': ingredient('Eggplant / Brinjal', 'Produce'),
  'mushrooms': ingredient('Mushrooms', 'Produce'),
  'fresh green zucchini courgette': ingredient('Zucchini', 'Produce'),
  'fresh green beans': ingredient('Green Beans', 'Produce'),
  'fresh green parsley leaves': ingredient('Fresh Parsley', 'Produce'),
  'fresh mint leaves': ingredient('Mint Leaves', 'Produce'),
  'fresh green salad lettuce': ingredient('Lettuce / Salad Greens', 'Produce'),
  'spring onions scallions': ingredient('Spring Onions', 'Produce'),
  'curry leaves': ingredient('Curry Leaves', 'Produce'),
  'fenugreek leaves methi': ingredient('Fenugreek / Methi', 'Produce'),
  // Produce -- Indian / regional, which the app's own pantry data leads with
  'bitter gourd karela': ingredient('Bitter Gourd / Karela', 'Produce'),
  'bottle gourd lauki': ingredient('Bottle Gourd / Lauki', 'Produce'),
  'okra ladyfinger bhindi': ingredient('Okra / Bhindi', 'Produce'),
  'drumstick moringa pods': ingredient('Drumstick / Moringa', 'Produce'),
  'taro root arbi colocasia': ingredient('Colocasia / Arbi', 'Produce'),
  'raw banana plantain': ingredient('Raw Banana / Plantain', 'Produce'),
  'round gourd tinda': ingredient('Tinda / Round Gourd', 'Produce'),
  'jackfruit': ingredient('Jackfruit', 'Produce'),
  'sweet potato': ingredient('Sweet Potato', 'Produce'),
  'beetroot': ingredient('Beetroot', 'Produce'),
  'white radish daikon': ingredient('Radish', 'Produce'),
  'pumpkin': ingredient('Pumpkin', 'Produce'),
  'sweet corn cob': ingredient('Sweet Corn', 'Produce'),
  'fresh coconut': ingredient('Fresh Coconut', 'Produce'),
  'tamarind pods': ingredient('Tamarind', 'Produce'),
  // Produce -- fruit (the app's category set has no separate fruit bucket)
  'ripe mangoes': ingredient('Mango', 'Produce'),
  'bananas': ingredient('Bananas', 'Produce'),
  'red apples': ingredient('Apples', 'Produce'),
  'oranges': ingredient('Oranges', 'Produce'),
  'grapes': ingredient('Grapes', 'Produce'),
  'pomegranate': ingredient('Pomegranate', 'Produce'),
  'watermelon': ingredient('Watermelon', 'Produce'),
  'guava': ingredient('Guava', 'Produce'),
  'papaya': ingredient('Papaya', 'Produce'),
  'pineapple': ingredient('Pineapple', 'Produce'),
  'strawberries': ingredient('Strawberries', 'Produce'),
  'blueberries': ingredient('Blueberries', 'Produce'),
  'avocado': ingredient('Avocado', 'Produce'),
  'peaches': ingredient('Peaches', 'Produce'),
  // Dairy
  'paneer cottage cheese cubes': ingredient('Paneer', 'Dairy'),
  'butter block': ingredient('Butter', 'Dairy'),
  'clarified butter ghee': ingredient('Ghee', 'Dairy'),
  'milk bottle carton': ingredient('Milk', 'Dairy'),
  'yogurt curd dahi bowl': ingredient('Yogurt / Curd', 'Dairy'),
  'heavy cream': ingredient('Heavy Cream', 'Dairy'),
  'cheddar cheese block': ingredient('Cheese (Cheddar/Processed)', 'Dairy'),
  'mozzarella cheese': ingredient('Mozzarella Cheese', 'Dairy'),
  'tofu block': ingredient('Tofu', 'Dairy'),
  'coconut milk can': ingredient('Coconut Milk', 'Dairy'),
  // Grains & Pulses
  'cooked basmati rice': ingredient('Basmati Rice', 'Grains & Pulses'),
  'wheat flour atta': ingredient('Wheat Flour (Atta)', 'Grains & Pulses'),
  'all purpose flour maida': ingredient('All-Purpose Flour (Maida)', 'Grains & Pulses'),
  'besan gram flour': ingredient('Besan (Gram Flour)', 'Grains & Pulses'),
  'penne macaroni pasta': ingredient('Penne / Macaroni Pasta', 'Grains & Pulses'),
  'spaghetti noodles': ingredient('Spaghetti / Noodles', 'Grains & Pulses'),
  'poha flattened rice': ingredient('Poha (Flattened Rice)', 'Grains & Pulses'),
  'rava sooji semolina': ingredient('Rava / Sooji (Semolina)', 'Grains & Pulses'),
  'rolled oats': ingredient('Rolled Oats', 'Grains & Pulses'),
  'bread slices loaf': ingredient('Bread Slices', 'Grains & Pulses'),
  'yellow moong dal': ingredient('Yellow Moong Dal', 'Grains & Pulses'),
  'toor arhar dal': ingredient('Toor / Arhar Dal', 'Grains & Pulses'),
  'chana dal split chickpeas': ingredient('Chana Dal', 'Grains & Pulses'),
  'masoor dal red lentils': ingredient('Masoor Dal (Red Lentils)', 'Grains & Pulses'),
  'urad dal black gram': ingredient('Urad Dal', 'Grains & Pulses'),
  'chickpeas chole': ingredient('Chickpeas / Chole', 'Grains & Pulses'),
  'kidney beans rajma': ingredient('Kidney Beans / Rajma', 'Grains & Pulses'),
  'idli dosa batter': ingredient('Idli / Dosa Batter', 'Grains & Pulses'),
  // Spices
  'cumin seeds jeera': ingredient('Cumin Seeds (Jeera)', 'Spices'),
  'mustard seeds rai': ingredient('Mustard Seeds (Rai)', 'Spices'),
  'turmeric powder': ingredient('Turmeric Powder', 'Spices'),
  'red chili powder': ingredient('Red Chili Powder', 'Spices'),
  'coriander powder': ingredient('Coriander Powder', 'Spices'),
  'garam masala': ingredient('Garam Masala', 'Spices'),
  'dried fenugreek leaves kasuri methi': ingredient('Kasuri Methi', 'Spices'),
  'chaat masala': ingredient('Chaat Masala', 'Spices'),
  'asafoetida hing': ingredient('Hing (Asafoetida)', 'Spices'),
  'black pepper peppercorns': ingredient('Black Pepper', 'Spices'),
  'oregano and chili flakes': ingredient('Oregano & Chili Flakes', 'Spices'),
  'cardamom and cinnamon sticks': ingredient('Cardamom & Cinnamon', 'Spices'),
  'bay leaves': ingredient('Bay Leaves', 'Spices'),
  'cloves': ingredient('Cloves', 'Spices'),
  'salt': ingredient('Salt', 'Spices'),
  // Oils & Sauces
  'cooking oil bottle': ingredient('Cooking Oil', 'Oils & Sauces'),
  'olive oil bottle': ingredient('Olive Oil', 'Oils & Sauces'),
  'soy sauce bottle': ingredient('Soy Sauce', 'Oils & Sauces'),
  'vinegar bottle': ingredient('Vinegar', 'Oils & Sauces'),
  'tomato ketchup bottle': ingredient('Tomato Ketchup', 'Oils & Sauces'),
  'red chili sauce bottle': ingredient('Green / Red Chili Sauce', 'Oils & Sauces'),
  'mayonnaise jar': ingredient('Mayonnaise', 'Oils & Sauces'),
  'honey jar': ingredient('Honey', 'Oils & Sauces'),
  'peanut butter jar': ingredient('Peanut Butter', 'Oils & Sauces'),
  // Proteins & Nuts
  'raw eggs carton': ingredient('Eggs', 'Proteins & Nuts'),
  'raw chicken meat': ingredient('Chicken Breast / Curry Cut', 'Proteins & Nuts'),
  'peanuts groundnuts': ingredient('Peanuts / Groundnuts', 'Proteins & Nuts'),
  'cashews and almonds': ingredient('Cashews & Almonds', 'Proteins & Nuts'),
  'fish fillets': ingredient('Fish', 'Proteins & Nuts'),
  'prawns shrimp': ingredient('Prawns / Shrimp', 'Proteins & Nuts'),
  'raw mutton red meat': ingredient('Mutton / Red Meat', 'Proteins & Nuts'),
  // Frozen
  'frozen peas packet': ingredient('Frozen Peas', 'Frozen'),
  'ice cream tub': ingredient('Ice Cream', 'Frozen'),
};

// Thresholds for turning ranked CLIP predictions into a short, defensible list.
//
// Calibrated against real photos rather than guessed: food images produced a top
// label between 0.17 and 0.71, while a landscape photo topped out at 0.04. That
// gap is what makes 0.06 a usable floor. The relative floor matters because CLIP
// spreads softmax mass across every candidate, so a 3-5% label is noise rather
// than a detection -- without it, any image returns a full list of wrong items.
const MIN_SCORE = 0.06;       // nothing below this is ever reported
const RELATIVE_FLOOR = 0.10;  // ...nor anything below 10% of the top score
const MAX_ITEMS = 6;          // a fridge photo rarely shows more than a handful
const DISTRACTOR_CONFIDENCE = 0.3; // above this, treat "not food" as the answer

// @xenova/transformers' RawImage.fromURL() goes through fetch(), which cannot
// read a base64 data: URL and fails with "404 Not Found". Writing the bytes to a
// temp file and passing the path is what actually works under Node.
const materialiseImage = (imageSource) => {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(imageSource);
  if (!match) return imageSource; // already a local path or an http(s) URL
  const extension = match[1].split('/')[1].replace('jpeg', 'jpg');
  const file = path.join(
    os.tmpdir(),
    `platewise-scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
  );
  fs.writeFileSync(file, Buffer.from(match[2], 'base64'));
  return file;
};

const selectIngredients = (predictions) => {
  if (!predictions || predictions.length === 0) return [];

  // If the single best-matching phrase is a deliberately unrelated distractor,
  // the photo most likely holds no food -- return nothing rather than guessing.
  const top = predictions[0];
  if (!LABEL_TO_INGREDIENT[top.label] && top.score > DISTRACTOR_CONFIDENCE) return [];

  const floor = Math.max(MIN_SCORE, top.score * RELATIVE_FLOOR);
  const picked = [];
  const seen = new Set();

  for (const prediction of predictions) {
    if (prediction.score < floor) break; // results arrive sorted descending
    const item = LABEL_TO_INGREDIENT[prediction.label];
    if (!item) continue; // distractor or unmapped -- never leak a raw phrase
    if (seen.has(item.name)) continue;
    seen.add(item.name);
    picked.push({
      name: item.name,
      category: item.category,
      confidence: Math.round(prediction.score * 100),
    });
    if (picked.length >= MAX_ITEMS) break;
  }
  return picked;
};

// Fallback high-res recipes tailored to the seeded kitchen inventory
const FALLBACK_RECIPES = [
  {
    id: 'dish-1',
    title: 'Mediterranean Roasted Summer Veggie Medley',
    culture: 'Continental',
    mealType: 'Dinner',
    season: 'Monsoon',
    prepTime: '25m',
    difficulty: 'Easy',
    servings: 2,
    youtubeId: '9nJbE39hK_M',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
    description: 'Caramelized zucchini ribbons, sweet bell peppers, mushrooms, green beans, and roasted garlic tossed in aromatic olive oil and herbs.',
    ingredients: [
      { name: 'Zucchini', amount: '2 medium sliced', category: 'Produce' },
      { name: 'Bell Peppers / Capsicum', amount: '2 chopped', category: 'Produce' },
      { name: 'Mushrooms', amount: '200g sliced', category: 'Produce' },
      { name: 'Green Beans', amount: '150g trimmed', category: 'Produce' },
      { name: 'Potatoes', amount: '2 medium diced', category: 'Produce' },
      { name: 'Garlic', amount: '5 cloves minced', category: 'Produce' },
      { name: 'Olive Oil', amount: '3 tbsp', category: 'Oils & Sauces' },
      { name: 'Oregano & Chili Flakes', amount: '1 tsp', category: 'Spices' },
      { name: 'Black Pepper', amount: '1/2 tsp', category: 'Spices' },
      { name: 'Fresh Parsley', amount: '2 tbsp finely chopped', category: 'Produce' }
    ],
    steps: [
      'Preheat cast iron skillet or baking tray with 2 tbsp extra virgin olive oil.',
      'Toss cubed potatoes, sliced zucchini, bell peppers, and green beans with minced garlic, paprika, and dried oregano.',
      'Sauté on medium-high until vegetables develop charred, golden edges.',
      'Add sliced mushrooms during the last 6 minutes so they retain their juicy texture.',
      'Season with freshly cracked black pepper and finish with chopped fresh parsley and mint leaves.'
    ]
  },
  {
    id: 'dish-2',
    title: 'Rustic Mushroom & Tomato Skillet Sauté',
    culture: 'Continental',
    mealType: 'Dinner',
    season: 'Monsoon',
    prepTime: '15m',
    difficulty: 'Easy',
    servings: 2,
    youtubeId: 'VnJ8_k1y34o',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    description: 'Juicy skillet-seared button mushrooms braised in blistered ripe tomatoes, sweet onions, garlic, and fresh garden mint.',
    ingredients: [
      { name: 'Mushrooms', amount: '250g sliced', category: 'Produce' },
      { name: 'Tomatoes', amount: '3 ripe diced', category: 'Produce' },
      { name: 'Onions', amount: '1 medium sliced', category: 'Produce' },
      { name: 'Garlic', amount: '4 cloves crushed', category: 'Produce' },
      { name: 'Olive Oil', amount: '2 tbsp', category: 'Oils & Sauces' },
      { name: 'Fresh Parsley', amount: '2 tbsp chopped', category: 'Produce' },
      { name: 'Black Pepper', amount: '1/2 tsp freshly ground', category: 'Spices' },
      { name: 'Red Chili Powder', amount: '1/2 tsp paprika', category: 'Spices' }
    ],
    steps: [
      'Heat olive oil in a heavy skillet until shimmering.',
      'Sauté sliced onions and crushed garlic on medium heat until golden and sweet.',
      'Toss in sliced mushrooms and sear undisturbed for 3 minutes to develop deep umami browning.',
      'Fold in chopped tomatoes, paprika, and cracked black pepper; simmer gently until a glossy rustic sauce forms.',
      'Garnish generously with chopped parsley and fresh mint leaves before serving hot.'
    ]
  },
  {
    id: 'dish-3',
    title: 'Crispy Skillet Herb Potatoes with Green Beans',
    culture: 'Continental',
    mealType: 'Breakfast',
    season: 'Monsoon',
    prepTime: '20m',
    difficulty: 'Easy',
    servings: 2,
    youtubeId: 'r53mK66vK90',
    image: 'https://images.unsplash.com/photo-1518013031184-41d4bd60014b?w=800&auto=format&fit=crop&q=80',
    description: 'Golden, crispy skillet-fried potato cubes tossed with tender-crisp green beans, garlic chips, paprika, and herbs.',
    ingredients: [
      { name: 'Potatoes', amount: '3 medium cubed', category: 'Produce' },
      { name: 'Green Beans', amount: '200g trimmed', category: 'Produce' },
      { name: 'Garlic', amount: '4 cloves sliced thin', category: 'Produce' },
      { name: 'Olive Oil', amount: '2 tbsp', category: 'Oils & Sauces' },
      { name: 'Red Chili Powder', amount: '1 tsp paprika', category: 'Spices' },
      { name: 'Oregano & Chili Flakes', amount: '1 tsp', category: 'Spices' },
      { name: 'Black Pepper', amount: '1/2 tsp', category: 'Spices' }
    ],
    steps: [
      'Steam or par-boil potato cubes for 5 minutes until just fork-tender, then drain thoroughly.',
      'Heat 2 tbsp olive oil in your skillet over medium heat.',
      'Add potato cubes and sear until golden and crusty on all sides (approx 8-10 minutes).',
      'Toss in sliced garlic and trimmed green beans; stir-fry for 4 minutes until bright green and tender.',
      'Dust with paprika, oregano, sea salt, and black pepper. Serve steaming hot.'
    ]
  },
  {
    id: 'dish-4',
    title: 'Fresh Garden Ratatouille Skillet Stew',
    culture: 'Continental',
    mealType: 'Dinner',
    season: 'Monsoon',
    prepTime: '30m',
    difficulty: 'Medium',
    servings: 3,
    youtubeId: 'sF2d4bZf8aE',
    image: 'https://images.unsplash.com/photo-1572441713132-c542fc4fe282?w=800&auto=format&fit=crop&q=80',
    description: 'A vibrant French provincial skillet stew of slow-simmered vine tomatoes, layered zucchini, bell peppers, onions, and garlic olive oil.',
    ingredients: [
      { name: 'Tomatoes', amount: '4 ripe pureed/diced', category: 'Produce' },
      { name: 'Zucchini', amount: '2 medium sliced in rounds', category: 'Produce' },
      { name: 'Bell Peppers / Capsicum', amount: '1 large sliced', category: 'Produce' },
      { name: 'Onions', amount: '2 medium sliced', category: 'Produce' },
      { name: 'Garlic', amount: '6 cloves minced', category: 'Produce' },
      { name: 'Olive Oil', amount: '3 tbsp', category: 'Oils & Sauces' },
      { name: 'Oregano & Chili Flakes', amount: '1 tsp', category: 'Spices' },
      { name: 'Fresh Parsley', amount: '2 tbsp', category: 'Produce' }
    ],
    steps: [
      'In a wide skillet, simmer minced garlic, onions, and crushed tomatoes with olive oil and oregano for 8 minutes to form the rich foundation sauce.',
      'Arrange sliced zucchini, bell peppers, and mushrooms in alternating concentric circles over the tomato sauce.',
      'Drizzle with olive oil, sprinkle with salt, black pepper, and chili flakes.',
      'Cover skillet with a lid and braise over low heat for 18 minutes until tender and deeply flavorful.',
      'Uncover, garnish with fresh parsley and mint, and enjoy with toasted rustic bread.'
    ]
  }
];

// 1. Contextual Recommendations (Prioritizing scanned inventory)
app.get('/api/recommendations', async (req, res) => {
  const {
    timeOfDay = 'Dinner',
    season = 'Monsoon',
    culture = 'Continental',
    inventory = ''
  } = req.query;

  const groq = getGroqClient();

  if (groq) {
    try {
      const prompt = `You are PlateWise, an elite culinary chef AI.
Generate 4 distinct, appetizing recipes tailored specifically for:
- Available Scanned Ingredients: ${inventory || 'Tomatoes, Onions, Garlic, Potatoes, Bell Peppers, Green Beans, Zucchini, Mushrooms, Olive Oil, Parsley, Mint, Black Pepper, Paprika, Oregano'}
- Time of Day: ${timeOfDay}
- Season: ${season}
- Cuisine: ${culture}

CRITICAL: You MUST prioritize dishes that directly utilize the available scanned ingredients above, minimizing missing items!

Return ONLY valid JSON matching:
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
      "ingredients": [
        { "name": "Ingredient Name", "amount": "quantity", "category": "Produce/Dairy/Pantry/Spices/Grains" }
      ],
      "steps": [
        "Step 1 instruction",
        "Step 2 instruction"
      ]
    }
  ]
}`;

      const response = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'openai/gpt-oss-120b',
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      if (parsed.recommendations && parsed.recommendations.length > 0) {
        return res.json({ success: true, source: 'groq-ai', data: parsed.recommendations });
      }
    } catch (err) {
      console.error('Groq recommendation error, using fallback:', err.message);
    }
  }

  return res.json({
    success: true,
    source: 'curated-engine',
    data: FALLBACK_RECIPES,
  });
});

// Open-vocabulary ingredient detection via Groq Vision.
//
// This mirrors api/vision-scan.js so the local server and the deployed Vercel
// function behave the same way. The CLIP zero-shot model below can only ever
// return a label from FOOD_LABELS, so that phrase list is its entire vocabulary;
// a hosted vision model has no such limit.
// Groq no longer serves Llama-4 Scout/Maverick to every account -- calling that
// model returns 404 model_not_found -- so the model must be named explicitly.
// Leave GROQ_VISION_MODEL unset (the default) to skip the hosted path entirely
// and use the local CLIP classifier, which needs no network call and no key.
// Set it to a genuinely available vision model (e.g. via backend/.env) to prefer
// hosted open-vocabulary detection.
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || '';

const GROQ_VISION_PROMPT = `You are a professional culinary vision AI. Analyze this image of a fridge, pantry, kitchen counter, or grocery haul.

Identify ALL visible food ingredients and return them as a JSON array. Be specific about each item.

Return ONLY valid JSON (no markdown fences, no extra text):
{
  "ingredients": [
    { "name": "Tomatoes", "category": "Produce", "estimatedQuantity": "4-5 medium" },
    { "name": "Eggs", "category": "Proteins & Nuts", "estimatedQuantity": "~6" }
  ]
}

Categories to use: Produce, Dairy, Proteins & Nuts, Oils & Sauces, Grains & Pulses, Spices, Frozen.
If you cannot detect food clearly, return an empty ingredients array.`;

const detectWithGroqVision = async (imageSource) => {
  const groq = getGroqClient();
  if (!groq) return null;

  const response = await groq.chat.completions.create({
    model: GROQ_VISION_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageSource } },
          { type: 'text', text: GROQ_VISION_PROMPT },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 800,
  });

  const raw = response.choices[0].message.content.trim();
  // Strip markdown fences if the model wrapped the JSON in them (same as api/vision-scan.js).
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) return null;

  return parsed.ingredients
    .filter((item) => item && typeof item.name === 'string' && item.name.trim())
    .map((item) => ({
      name: item.name.trim(),
      category: item.category || 'Produce',
      estimatedQuantity: item.estimatedQuantity || '',
    }));
};

// 2. Vision scan -- Groq Vision (open vocabulary) with a CLIP fallback
app.post('/api/vision-scan', upload.single('image'), async (req, res) => {
  try {
    let imageSource = null;

    if (req.file) {
      imageSource = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    } else if (req.body.image) {
      imageSource = req.body.image;
    }

    if (!imageSource) {
      return res.status(400).json({ success: false, message: 'Image is required' });
    }

    // OPTIONAL PRIMARY: a hosted vision model, used only when GROQ_VISION_MODEL
    // names one that this account can actually reach.
    if (GROQ_VISION_MODEL && (activeGroqKey || process.env.GROQ_API_KEY)) {
      try {
        const hosted = await detectWithGroqVision(imageSource);
        if (hosted && hosted.length > 0) {
          console.log(`[Vision AI] ${GROQ_VISION_MODEL} detected ${hosted.length} ingredient(s)`);
          return res.json({ success: true, source: 'groq-vision', data: hosted });
        }
        console.log('[Vision AI] Hosted vision model found no food; using local CLIP.');
      } catch (err) {
        console.error('Groq vision error, using local CLIP instead:', err.message);
      }
    }

    // INGREDIENTS. Two offline readers run over the same temp file, and only
    // what was actually seen can reach the pantry.
    //
    //   1. CLIP zero-shot -- the broad fallback. Covers spices, dairy and
    //      pantry goods, but it scores the whole image against a phrase list, so
    //      on a produce photo it often names the wrong single thing.
    //   2. The trained ingredient recogniser (training/, 35 produce classes,
    //      88.3% top-1 on its held-out split). Sharper on raw produce, but a
    //      single-item model, so it is only trusted when it is confident.
    //
    // The model wins when it has an answer; CLIP's wider list is the fallback.
    const localPath = materialiseImage(imageSource);
    let detected = [];
    let source = 'clip-local-vision';
    try {
      const clip = await loadVisionPipeline();
      const rawPredictions = await clip(localPath, FOOD_LABELS);
      console.log(
        '[Vision AI] Top 5:',
        rawPredictions.slice(0, 5).map((p) => `${p.score.toFixed(3)} ${p.label}`)
      );
      detected = selectIngredients(rawPredictions);
      console.log(`[Vision AI] CLIP: ${detected.length} ingredient(s):`, detected.map((d) => d.name));

      try {
        const classifier = await ingredientClassifier.load();
        if (classifier) {
          const { items, full } = await ingredientClassifier.detect(localPath);
          if (items.length > 0) {
            detected = items;
            source = 'ingredient-model';
            console.log(`[Vision AI] Ingredient model: ${items[0].name} ${items[0].confidence}%`);
          } else {
            console.log(
              `[Vision AI] Ingredient model abstained (best ${full ? full.ranked[0].name : 'n/a'} ` +
                `${full ? Math.round(full.top1 * 100) : 0}%); keeping CLIP`
            );
          }
        }
      } catch (err) {
        // Model trouble must never block a scan; CLIP's answer already stands.
        console.error('[Vision AI] Ingredient model error (keeping CLIP):', err.message);
      }
    } finally {
      if (localPath !== imageSource) fs.rmSync(localPath, { force: true });
    }

    // Only ingredients are returned. PlateWise reads a photo to fill a pantry,
    // and a pantry holds ingredients -- so there is no dish/meal output here at
    // all: input is ingredients, output is recipes.
    return res.json({
      success: true,
      source,
      detected: detected.length > 0,
      data: detected,
      message: detected.length === 0
        ? 'No ingredients were recognised in that photo. Try a closer, brighter shot, or type them in below.'
        : undefined,
    });
  } catch (error) {
    console.error('Vision scan error:', error);
    // Return nothing rather than a fabricated list. The frontend adds every item
    // it receives to the pantry, so inventing ingredients here would silently put
    // food in the user's fridge that was never in the photo.
    return res.json({
      success: false,
      source: 'vision-unavailable',
      detected: false,
      message: 'The scan could not read that image. Try another photo, or add items manually below.',
      data: [],
    });
  }
});

// 3. Ingredient Audit & Smart Substitutions
app.post('/api/audit-ingredients', async (req, res) => {
  const { recipe, userInventory = [] } = req.body;
  if (!recipe || !recipe.ingredients) {
    return res.status(400).json({ success: false, message: 'Recipe with ingredients is required' });
  }

  const recipeIngredients = recipe.ingredients;
  const inventoryNames = userInventory.map((i) => (typeof i === 'string' ? i : i.name).toLowerCase());

  const availableItems = [];
  const missingItems = [];

  recipeIngredients.forEach((item) => {
    const isAvailable = inventoryNames.some((inv) =>
      inv.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(inv)
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
    return !recipeIngredients.some((req) => req.name.toLowerCase().includes(invName) || invName.includes(req.name.toLowerCase()));
  });

  const groq = getGroqClient();

  if (groq && missingItems.length > 0) {
    try {
      const prompt = `Recipe: ${recipe.title}
Missing Ingredients: ${JSON.stringify(missingItems.map(m => m.name))}
Surplus Kitchen Items: ${JSON.stringify(surplusItems.map(s => typeof s === 'string' ? s : s.name))}

Provide culinary advice in JSON format:
{
  "substitutions": [
    { "missing": "Heavy Cream", "substitute": "3 tbsp Milk + 1 tsp Butter or Cashew Paste", "impact": "Maintains rich velvety texture with zero grocery run." }
  ],
  "surplusAdvice": [
    { "surplusItem": "Extra Tomatoes", "action": "Blend remaining tomatoes with green chili for an instant side dip or tomato shorba." }
  ]
}`;

      const response = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'openai/gpt-oss-120b',
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
      console.error('Groq substitution error:', err.message);
    }
  }

  const fallbackSubstitutions = missingItems.map((item) => {
    const name = item.name.toLowerCase();
    if (name.includes('cream')) {
      return { missing: item.name, substitute: 'Full-fat Milk + 1 tsp Butter or Cashew Paste', impact: 'Adds creamy richness without packaged cream.' };
    }
    if (name.includes('kasuri methi')) {
      return { missing: item.name, substitute: 'Crushed dried oregano or fresh celery leaves', impact: 'Provides herbal aroma.' };
    }
    if (name.includes('butter') || name.includes('ghee')) {
      return { missing: item.name, substitute: 'Cooking Oil + tiny pinch of salt', impact: 'Clean heat transfer without dairy fat.' };
    }
    return { missing: item.name, substitute: `Skip or substitute with mild pantry spices`, impact: 'Recipe will still taste balanced.' };
  });

  const fallbackSurplus = surplusItems.slice(0, 2).map((item) => ({
    surplusItem: typeof item === 'string' ? item : item.name,
    action: `Incorporate into a fresh side salad or save for tomorrow's quick stir-fry.`,
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
});

// 4. Recipe Vault
app.get('/api/vault', (req, res) => {
  res.json({ success: true, data: userVault });
});

app.post('/api/vault', (req, res) => {
  const { recipeId, title, cookedAt = new Date().toISOString(), rating = 5 } = req.body;
  const entry = { id: `vault-${Date.now()}`, recipeId, title, cookedAt, rating };
  userVault.unshift(entry);
  res.json({ success: true, data: userVault });
});

app.listen(PORT, () => {
  console.log(`[PlateWise Server] Running on http://localhost:${PORT}`);
});
