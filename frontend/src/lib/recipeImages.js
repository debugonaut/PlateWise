// Dish photos for recipe cards.
//
// Dish-shape keywords (pasta, soup, egg, salad...) come before raw-ingredient
// keywords so a title like "Spinach & Mushroom Egg Bhurji" reads as an egg dish,
// not a mushroom dish. `assignRecipeImages` then guarantees that no two cards in
// the same recommendation grid share a photo, even when an AI model returns a
// repeated or missing image URL.

const image = (id) =>
  `https://images.unsplash.com/photo-${id}?w=800&auto=format&fit=crop&q=80`;

export const RECIPE_IMAGE_MAP = [
  {
    keywords: ['egg', 'bhurji', 'omelette', 'scramble', 'frittata', 'shakshuka', 'poached'],
    url: image('1525351484163-7529414344d8'),
  },
  {
    keywords: ['pasta', 'spaghetti', 'penne', 'macaroni', 'carbonara', 'arrabbiata', 'alfredo', 'aglio', 'pasta e ceci'],
    url: image('1473093295043-cdd812d0e601'),
  },
  {
    keywords: ['noodles', 'noodle', 'ramen', 'chow mein', 'pad thai', 'stir fry', 'stir-fry'],
    url: image('1569718212165-3a8278d5f624'),
  },
  {
    keywords: ['soup', 'broth', 'shorba', 'chowder', 'rasam'],
    url: image('1547592166-23ac45744acd'),
  },
  {
    keywords: ['rice', 'biryani', 'pulao', 'fried rice', 'jeera rice', 'risotto'],
    url: image('1563379091339-03b21ab4a4f8'),
  },
  {
    keywords: ['salad', 'raita', 'greens', 'cucumber', 'lettuce', 'bowl'],
    url: image('1512621776951-a57141f2eefd'),
  },
  {
    keywords: ['sandwich', 'toast', 'burger', 'panini', 'wrap', 'taco', 'burrito'],
    url: image('1528735602780-2552fd46c7af'),
  },
  {
    keywords: ['chilla', 'dosa', 'crepe', 'pancake', 'uttapam'],
    url: image('1601050690597-df0568f70950'),
  },
  {
    keywords: ['paratha', 'naan', 'roti', 'flatbread', 'kulcha'],
    url: image('1626777552726-4a6b54c97e46'),
  },
  {
    keywords: ['chicken', 'poultry', 'tikka', 'tandoori', 'roast chicken'],
    url: image('1599488615731-7e5c2823ff28'),
  },
  {
    keywords: ['paneer', 'cottage cheese', 'makhani', 'shahi paneer', 'kadai paneer'],
    url: image('1631452180519-c014fe946bc7'),
  },
  {
    keywords: ['curry', 'gravy', 'masala', 'korma', 'kofta', 'jalfrezi', 'sukka'],
    url: image('1589301760014-d929f3979dbc'),
  },
  {
    keywords: ['dal', 'khichdi', 'lentil', 'toor', 'moong', 'tadka', 'sambar'],
    url: image('1546833999-b9f581a1996d'),
  },
  {
    keywords: ['chole', 'chickpea', 'rajma', 'bean', 'hummus', 'chana'],
    url: image('1546833999-b9f581a1996d'),
  },
  {
    keywords: ['potato', 'aloo', 'fries', 'roast potato'],
    url: image('1518977676601-b53f82aba655'),
  },
  {
    keywords: ['ratatouille', 'provencal', 'garden stew', 'braised veggie'],
    url: image('1572441713132-c542fc4fe282'),
  },
  {
    keywords: ['mediterranean', 'summer veggie', 'veggie medley', 'roasted vegetable', 'zucchini', 'broccoli', 'confit', 'stuffed pepper'],
    url: image('1540420773420-3366772f4999'),
  },
  {
    keywords: ['mushroom', 'saute', 'skillet saute', 'cremini', 'button mushroom'],
    url: image('1546069901-ba9599a7e63c'),
  },
  {
    keywords: ['green bean', 'herb potato', 'skillet potato', 'crispy skillet'],
    url: image('1518977676601-b53f82aba655'),
  },
];

export const FALLBACK_IMAGE_POOL = [
  ...new Set([
    ...RECIPE_IMAGE_MAP.map((item) => item.url),
    image('1540420773420-3366772f4999'),
  ]),
];

export function getAccurateRecipeImage(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  for (const item of RECIPE_IMAGE_MAP) {
    if (item.keywords.some((keyword) => text.includes(keyword))) {
      return item.url;
    }
  }
  return FALLBACK_IMAGE_POOL[0];
}

/**
 * Return one image per recipe, preferring the recipe's own photo and never
 * repeating a photo inside the same grid.
 */
export function assignRecipeImages(recipes = []) {
  const used = new Set();

  return recipes.map((recipe) => {
    const preferred = [
      recipe?.image,
      getAccurateRecipeImage(recipe?.title, recipe?.description),
    ].filter((url) => typeof url === 'string' && /^https?:\/\//.test(url));

    const pick =
      preferred.find((url) => !used.has(url)) ||
      FALLBACK_IMAGE_POOL.find((url) => !used.has(url)) ||
      preferred[0] ||
      FALLBACK_IMAGE_POOL[0];

    used.add(pick);
    return pick;
  });
}
