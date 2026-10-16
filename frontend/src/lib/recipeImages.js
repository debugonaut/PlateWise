export const RECIPE_IMAGE_MAP = [
  {
    keywords: ['mediterranean', 'summer veggie', 'veggie medley', 'roasted vegetable', 'zucchini'],
    url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['ratatouille', 'provencal', 'garden stew', 'braised veggie'],
    url: 'https://images.unsplash.com/photo-1572441713132-c542fc4fe282?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['mushroom', 'sauté', 'skillet sauté', 'cremini', 'button mushroom'],
    url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['green bean', 'herb potato', 'skillet potato', 'crispy skillet'],
    url: 'https://images.unsplash.com/photo-1518013031184-41d4bd60014b?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['paneer', 'cottage cheese', 'makhani', 'shahi paneer', 'kadai paneer'],
    url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['dal', 'khichdi', 'lentil', 'toor', 'moong', 'tadka', 'sambar'],
    url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['pasta', 'penne', 'spaghetti', 'macaroni', 'carbonara', 'arrabbiata', 'alfredo'],
    url: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281292?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['chilla', 'dosa', 'crepe', 'pancake', 'uttapam'],
    url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['rice', 'biryani', 'pulao', 'fried rice', 'jeera rice', 'risotto'],
    url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['curry', 'gravy', 'masala', 'korma', 'kofta'],
    url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['soup', 'broth', 'shorba', 'chowder', 'rasam', 'corn soup'],
    url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['chicken', 'poultry', 'tikka', 'tandoori', 'roast chicken'],
    url: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['paratha', 'naan', 'roti', 'flatbread', 'kulcha', 'aloo paratha'],
    url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['egg', 'omelette', 'scramble', 'bhurji', 'poached', 'frittata'],
    url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['noodles', 'ramen', 'chow mein', 'pad thai', 'stir fry'],
    url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['salad', 'greens', 'cucumber', 'lettuce', 'bowl'],
    url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['sandwich', 'toast', 'burger', 'panini', 'wrap', 'taco', 'burrito'],
    url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['chole', 'chickpea', 'rajma', 'bean', 'hummus'],
    url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80',
  },
  {
    keywords: ['potato', 'aloo', 'fries', 'roast potato'],
    url: 'https://images.unsplash.com/photo-1518013031184-41d4bd60014b?w=800&auto=format&fit=crop&q=80',
  }
];

export function getAccurateRecipeImage(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  for (const item of RECIPE_IMAGE_MAP) {
    if (item.keywords.some((kw) => text.includes(kw))) {
      return item.url;
    }
  }
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80';
}
