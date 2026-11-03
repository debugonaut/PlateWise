// Shared curated recipe engine.
//
// Both the Vercel functions (api/) and the local Express server (backend/) use
// this module for their offline fallback and for the demo kitchens. It is
// inventory-aware on purpose: the old fallback returned the same four recipes
// (and the same photos) for every photo and every context, which made the demo
// look broken. Here the pantry actually decides the menu.

const image = (id) =>
  `https://images.unsplash.com/photo-${id}?w=800&auto=format&fit=crop&q=80`;

const IMAGES = {
  egg: image('1525351484163-7529414344d8'),
  mediterranean: image('1540420773420-3366772f4999'),
  ratatouille: image('1572441713132-c542fc4fe282'),
  mushroom: image('1546069901-ba9599a7e63c'),
  potato: image('1518977676601-b53f82aba655'),
  potatoAlt: image('1447175008436-054170c2e979'),
  paneer: image('1631452180519-c014fe946bc7'),
  dal: image('1546833999-b9f581a1996d'),
  pasta: image('1473093295043-cdd812d0e601'),
  dosa: image('1601050690597-df0568f70950'),
  rice: image('1563379091339-03b21ab4a4f8'),
  curry: image('1589301760014-d929f3979dbc'),
  soup: image('1547592166-23ac45744acd'),
  chicken: image('1599488615731-7e5c2823ff28'),
  paratha: image('1626777552726-4a6b54c97e46'),
  noodles: image('1569718212165-3a8278d5f624'),
  salad: image('1512621776951-a57141f2eefd'),
  saladAlt: image('1540189549336-e6e99c3679fe'),
  sandwich: image('1528735602780-2552fd46c7af'),
};

const produce = 'Produce';
const dairy = 'Dairy';
const grains = 'Grains & Pulses';
const spices = 'Spices';
const oils = 'Oils & Sauces';
const proteins = 'Proteins & Nuts';

export const CURATED_RECIPES = [
  // ---------------------------------------------------------------------------
  // Stocked fridge kitchen
  // ---------------------------------------------------------------------------
  {
    id: 'fridge-spinach-mushroom-bhurji',
    title: 'Spinach & Mushroom Egg Bhurji',
    culture: 'Indian Comfort',
    mealType: 'Breakfast',
    season: 'Monsoon',
    prepTime: '15m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.egg,
    description:
      'Soft-scrambled eggs folded with wilted spinach, golden mushrooms, sweet tomatoes and cracked black pepper.',
    keyIngredients: ['Eggs', 'Spinach / Palak', 'Mushrooms'],
    ingredients: [
      { name: 'Eggs', amount: '4, beaten', category: proteins },
      { name: 'Spinach / Palak', amount: '2 cups, chopped', category: produce },
      { name: 'Mushrooms', amount: '150g, sliced', category: produce },
      { name: 'Tomatoes', amount: '2, diced', category: produce },
      { name: 'Butter', amount: '1 tbsp', category: dairy },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1/2 tsp', category: spices },
    ],
    steps: [
      'Melt butter in a wide non-stick pan over medium heat.',
      'Add sliced mushrooms and cook until their moisture evaporates and the edges turn golden.',
      'Stir in chopped spinach and diced tomatoes; cook for 2 minutes until the spinach wilts.',
      'Pour in the beaten eggs and fold gently with a spatula, pulling the set curds away from the pan.',
      'Season with black pepper and salt while the eggs are still glossy, then serve immediately.',
    ],
  },
  {
    id: 'fridge-creamy-spinach-broccoli',
    title: 'Creamy Spinach & Broccoli Skillet',
    culture: 'Continental',
    mealType: 'Dinner',
    season: 'Monsoon',
    prepTime: '20m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.mediterranean,
    description:
      'Charred broccoli and wilted spinach folded into a light yogurt cream with mushrooms and cracked pepper.',
    keyIngredients: ['Broccoli', 'Spinach / Palak', 'Yogurt / Curd'],
    ingredients: [
      { name: 'Broccoli', amount: '300g, cut into florets', category: produce },
      { name: 'Spinach / Palak', amount: '2 cups, chopped', category: produce },
      { name: 'Mushrooms', amount: '150g, sliced', category: produce },
      { name: 'Yogurt / Curd', amount: '1/2 cup, whisked', category: dairy },
      { name: 'Butter', amount: '1 tbsp', category: dairy },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1/2 tsp', category: spices },
    ],
    steps: [
      'Steam the broccoli florets for 3 minutes, until bright green but still crisp.',
      'Melt butter in a skillet and sear the mushrooms until deeply golden.',
      'Add the broccoli and spinach and toss over high heat for 2 minutes.',
      'Lower the heat, stir in the whisked yogurt and warm gently without letting it split.',
      'Finish with black pepper and salt and serve straight from the skillet.',
    ],
  },
  {
    id: 'fridge-stuffed-peppers',
    title: 'Mushroom & Spinach Stuffed Peppers',
    culture: 'Continental',
    mealType: 'Dinner',
    season: 'Monsoon',
    prepTime: '35m',
    difficulty: 'Medium',
    servings: 2,
    image: IMAGES.ratatouille,
    description:
      'Roasted bell peppers packed with a juicy mushroom, spinach and tomato filling under a peppery olive-oil glaze.',
    keyIngredients: ['Bell Peppers / Capsicum', 'Mushrooms', 'Spinach / Palak'],
    ingredients: [
      { name: 'Bell Peppers / Capsicum', amount: '3, halved', category: produce },
      { name: 'Mushrooms', amount: '200g, chopped', category: produce },
      { name: 'Spinach / Palak', amount: '2 cups, chopped', category: produce },
      { name: 'Tomatoes', amount: '2, diced', category: produce },
      { name: 'Olive Oil', amount: '2 tbsp', category: oils },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1/2 tsp', category: spices },
    ],
    steps: [
      'Heat the oven to 200 C and brush the pepper halves with olive oil.',
      'Sauté the mushrooms and tomatoes until most of the liquid has cooked away.',
      'Fold in the spinach, season with salt and black pepper, and take the pan off the heat.',
      'Spoon the filling into the peppers, press it down gently and drizzle with the remaining oil.',
      'Roast for 18 to 20 minutes until the peppers are tender and lightly charred at the edges.',
    ],
  },
  {
    id: 'fridge-cucumber-tomato-raita',
    title: 'Cucumber & Tomato Raita Bowl',
    culture: 'Indian Comfort',
    mealType: 'Lunch',
    season: 'Summer',
    prepTime: '10m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.salad,
    description:
      'Cool whisked yogurt with crunchy cucumber, sweet tomatoes and a dusting of toasted cumin.',
    keyIngredients: ['Cucumber', 'Tomatoes', 'Yogurt / Curd'],
    ingredients: [
      { name: 'Cucumber', amount: '1, grated', category: produce },
      { name: 'Tomatoes', amount: '2, diced', category: produce },
      { name: 'Yogurt / Curd', amount: '1 cup', category: dairy },
      { name: 'Cumin Seeds (Jeera)', amount: '1/2 tsp, toasted', category: spices },
      { name: 'Black Pepper', amount: '1/4 tsp', category: spices },
      { name: 'Salt', amount: '1/2 tsp', category: spices },
    ],
    steps: [
      'Squeeze the grated cucumber gently to remove excess water.',
      'Whisk the yogurt until smooth, then fold in the cucumber and tomatoes.',
      'Toast the cumin seeds in a dry pan until fragrant and crush them lightly.',
      'Stir the cumin, black pepper and salt through the raita.',
      'Chill for 10 minutes and serve as a cooling side with any warm meal.',
    ],
  },
  {
    id: 'fridge-sesame-broccoli-zucchini',
    title: 'Sesame Broccoli & Zucchini Stir-Fry',
    culture: 'Pan-Asian',
    mealType: 'Lunch',
    season: 'Monsoon',
    prepTime: '15m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.noodles,
    description:
      'Blistered broccoli and zucchini ribbons tossed with warm sesame spices and a hit of cracked pepper.',
    keyIngredients: ['Broccoli', 'Zucchini', 'Bell Peppers / Capsicum'],
    ingredients: [
      { name: 'Broccoli', amount: '250g, small florets', category: produce },
      { name: 'Zucchini', amount: '1, sliced into ribbons', category: produce },
      { name: 'Bell Peppers / Capsicum', amount: '1, sliced', category: produce },
      { name: 'Garlic', amount: '3 cloves, minced', category: produce },
      { name: 'Olive Oil', amount: '1 tbsp', category: oils },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1/2 tsp', category: spices },
    ],
    steps: [
      'Heat the oil in a wok until it shimmers.',
      'Add the broccoli and stir-fry for 3 minutes until the edges blister.',
      'Toss in the zucchini, bell pepper and garlic and keep everything moving for 2 minutes.',
      'Season with black pepper and salt, then splash in a tablespoon of water to steam the vegetables.',
      'Serve as soon as the vegetables are tender-crisp.',
    ],
  },
  {
    id: 'fridge-zucchini-tomato-saute',
    title: 'Zucchini & Blistered Tomato Sauté',
    culture: 'Continental',
    mealType: 'Dinner',
    season: 'Summer',
    prepTime: '18m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.mushroom,
    description:
      'Golden zucchini coins and burst tomatoes with mushrooms, olive oil and plenty of cracked pepper.',
    keyIngredients: ['Zucchini', 'Tomatoes', 'Mushrooms'],
    ingredients: [
      { name: 'Zucchini', amount: '2, sliced into coins', category: produce },
      { name: 'Tomatoes', amount: '3, halved', category: produce },
      { name: 'Mushrooms', amount: '150g, quartered', category: produce },
      { name: 'Olive Oil', amount: '2 tbsp', category: oils },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1/2 tsp', category: spices },
    ],
    steps: [
      'Heat the olive oil in a wide skillet over medium-high heat.',
      'Add the zucchini in a single layer and sear until golden on both sides.',
      'Push the zucchini to one side and add the mushrooms; cook until browned.',
      'Add the tomatoes cut-side down and cook until they blister and release their juices.',
      'Toss everything together, season with salt and pepper, and serve warm.',
    ],
  },

  {
    id: 'fridge-cucumber-yogurt-bowl',
    title: 'Chilled Cucumber & Yogurt Bowl',
    culture: 'Continental',
    mealType: 'Lunch',
    season: 'Summer',
    prepTime: '10m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.salad,
    description:
      'Cool whisked yogurt with crunchy cucumber, sweet tomatoes and cracked black pepper.',
    keyIngredients: ['Cucumber', 'Yogurt / Curd', 'Tomatoes'],
    ingredients: [
      { name: 'Cucumber', amount: '1, diced', category: produce },
      { name: 'Yogurt / Curd', amount: '1 cup', category: dairy },
      { name: 'Tomatoes', amount: '2, diced', category: produce },
      { name: 'Black Pepper', amount: '1/4 tsp', category: spices },
      { name: 'Salt', amount: '1/2 tsp', category: spices },
      { name: 'Olive Oil', amount: '1 tsp', category: oils },
    ],
    steps: [
      'Whisk the yogurt until smooth and season it with salt and black pepper.',
      'Fold in the diced cucumber and tomatoes.',
      'Chill for 10 minutes so the flavours settle.',
      'Drizzle with olive oil just before serving.',
    ],
  },
  {
    id: 'fridge-spinach-mushroom-frittata',
    title: 'Spinach & Mushroom Frittata',
    culture: 'Continental',
    mealType: 'Breakfast',
    season: 'Monsoon',
    prepTime: '25m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.egg,
    description:
      'A golden oven-baked frittata packed with spinach, mushrooms and a splash of milk.',
    keyIngredients: ['Eggs', 'Spinach / Palak', 'Mushrooms'],
    ingredients: [
      { name: 'Eggs', amount: '5', category: proteins },
      { name: 'Spinach / Palak', amount: '2 cups, chopped', category: produce },
      { name: 'Mushrooms', amount: '150g, sliced', category: produce },
      { name: 'Milk', amount: '1/4 cup', category: dairy },
      { name: 'Butter', amount: '1 tbsp', category: dairy },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1/2 tsp', category: spices },
    ],
    steps: [
      'Heat the oven to 190 C and melt the butter in an oven-safe skillet.',
      'Sauté the mushrooms until golden, then wilt the spinach in the same pan.',
      'Whisk the eggs with the milk, salt and black pepper and pour over the vegetables.',
      'Cook on the hob for 2 minutes until the edges set, then transfer to the oven.',
      'Bake for 12 minutes until puffed and just set in the centre.',
    ],
  },

  // ---------------------------------------------------------------------------
  // Countertop prep kitchen
  // ---------------------------------------------------------------------------
  {
    id: 'counter-tomato-mushroom-masala',
    title: 'Tomato & Mushroom Masala',
    culture: 'Indian Comfort',
    mealType: 'Dinner',
    season: 'Monsoon',
    prepTime: '25m',
    difficulty: 'Easy',
    servings: 3,
    image: IMAGES.curry,
    description:
      'Jammy tomatoes and seared mushrooms simmered in a cumin-scented onion masala with fresh coriander.',
    keyIngredients: ['Tomatoes', 'Mushrooms', 'Onions'],
    ingredients: [
      { name: 'Tomatoes', amount: '4, chopped', category: produce },
      { name: 'Mushrooms', amount: '250g, halved', category: produce },
      { name: 'Onions', amount: '2, finely chopped', category: produce },
      { name: 'Garlic', amount: '5 cloves, minced', category: produce },
      { name: 'Coriander / Cilantro', amount: '1/2 cup, chopped', category: produce },
      { name: 'Cumin Seeds (Jeera)', amount: '1 tsp', category: spices },
      { name: 'Turmeric Powder', amount: '1/2 tsp', category: spices },
      { name: 'Red Chili Powder', amount: '1 tsp', category: spices },
      { name: 'Olive Oil', amount: '2 tbsp', category: oils },
      { name: 'Salt', amount: '1 tsp', category: spices },
    ],
    steps: [
      'Bloom the cumin seeds in warm oil until they crackle, then add the onions and garlic.',
      'Cook the onions until deep golden, then stir in the turmeric and red chili powder.',
      'Add the tomatoes and cook until they collapse into a thick, jammy masala.',
      'Fold in the mushrooms and cook for 8 minutes so they absorb the sauce.',
      'Finish with salt and a generous handful of fresh coriander.',
    ],
  },
  {
    id: 'counter-capsicum-mushroom-jalfrezi',
    title: 'Capsicum & Mushroom Jalfrezi',
    culture: 'Indian Comfort',
    mealType: 'Dinner',
    season: 'Monsoon',
    prepTime: '30m',
    difficulty: 'Medium',
    servings: 3,
    image: IMAGES.paneer,
    description:
      'Crunchy capsicum and meaty mushrooms tossed through a tangy tomato-onion jalfrezi with garam masala.',
    keyIngredients: ['Bell Peppers / Capsicum', 'Mushrooms', 'Onions'],
    ingredients: [
      { name: 'Bell Peppers / Capsicum', amount: '2, thickly sliced', category: produce },
      { name: 'Mushrooms', amount: '200g, quartered', category: produce },
      { name: 'Onions', amount: '1, sliced', category: produce },
      { name: 'Tomatoes', amount: '2, chopped', category: produce },
      { name: 'Garlic', amount: '4 cloves, sliced', category: produce },
      { name: 'Coriander / Cilantro', amount: '1/2 cup', category: produce },
      { name: 'Cumin Seeds (Jeera)', amount: '1 tsp', category: spices },
      { name: 'Garam Masala', amount: '1 tsp', category: spices },
      { name: 'Olive Oil', amount: '2 tbsp', category: oils },
      { name: 'Salt', amount: '1 tsp', category: spices },
    ],
    steps: [
      'Sear the capsicum in a hot pan until it blisters, then set it aside.',
      'In the same pan, crackle the cumin and cook the onions and garlic until soft.',
      'Add the tomatoes and cook down until the oil separates.',
      'Return the capsicum, add the mushrooms and toss over high heat for 4 minutes.',
      'Sprinkle with garam masala, salt and coriander and serve with warm bread.',
    ],
  },
  {
    id: 'counter-tomato-coriander-shorba',
    title: 'Smoky Tomato & Coriander Shorba',
    culture: 'Indian Comfort',
    mealType: 'Lunch',
    season: 'Monsoon',
    prepTime: '20m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.soup,
    description:
      'A silky tomato soup perfumed with cumin, garlic and a bright finish of fresh coriander.',
    keyIngredients: ['Tomatoes', 'Coriander / Cilantro', 'Garlic'],
    ingredients: [
      { name: 'Tomatoes', amount: '6, halved', category: produce },
      { name: 'Onions', amount: '1, quartered', category: produce },
      { name: 'Garlic', amount: '4 cloves', category: produce },
      { name: 'Coriander / Cilantro', amount: '1 cup, plus extra to finish', category: produce },
      { name: 'Cumin Seeds (Jeera)', amount: '1 tsp', category: spices },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Olive Oil', amount: '1 tbsp', category: oils },
      { name: 'Salt', amount: '1 tsp', category: spices },
    ],
    steps: [
      'Toss the tomatoes, onion and garlic with olive oil and roast until charred at the edges.',
      'Toast the cumin seeds in a deep pot until fragrant.',
      'Add the roasted vegetables and 2 cups of water, then simmer for 10 minutes.',
      'Blend until smooth and return the soup to the pot to warm through.',
      'Season with salt and pepper and stir in the fresh coriander just before serving.',
    ],
  },
  {
    id: 'counter-garlic-mushroom-sukka',
    title: 'Garlic Mushroom Sukka',
    culture: 'Indian Comfort',
    mealType: 'Dinner',
    season: 'Monsoon',
    prepTime: '20m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.mushroom,
    description:
      'Dry-roasted mushrooms coated in a punchy garlic, red chili and coriander masala.',
    keyIngredients: ['Mushrooms', 'Garlic', 'Onions'],
    ingredients: [
      { name: 'Mushrooms', amount: '300g, quartered', category: produce },
      { name: 'Garlic', amount: '8 cloves, crushed', category: produce },
      { name: 'Onions', amount: '1, finely chopped', category: produce },
      { name: 'Coriander / Cilantro', amount: '1/2 cup', category: produce },
      { name: 'Red Chili Powder', amount: '1 tsp', category: spices },
      { name: 'Turmeric Powder', amount: '1/2 tsp', category: spices },
      { name: 'Olive Oil', amount: '2 tbsp', category: oils },
      { name: 'Salt', amount: '1/2 tsp', category: spices },
    ],
    steps: [
      'Dry-roast the mushrooms in a hot pan until their moisture is gone and they squeak against the pan.',
      'Push them to one side and add the oil, onions and garlic.',
      'Cook until the onions are golden and the garlic is fragrant but not burnt.',
      'Stir in the turmeric and red chili powder and toss the mushrooms to coat.',
      'Finish with salt and fresh coriander and serve as a dry side dish.',
    ],
  },
  {
    id: 'counter-tomato-garlic-confit',
    title: 'Slow-Roasted Tomato & Garlic Confit',
    culture: 'Continental',
    mealType: 'Dinner',
    season: 'Summer',
    prepTime: '40m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.mediterranean,
    description:
      'Sweet tomatoes and whole garlic cloves melted in olive oil until jammy, finished with fresh coriander.',
    keyIngredients: ['Tomatoes', 'Garlic', 'Olive Oil'],
    ingredients: [
      { name: 'Tomatoes', amount: '8, halved', category: produce },
      { name: 'Garlic', amount: '10 cloves, peeled', category: produce },
      { name: 'Olive Oil', amount: '1/2 cup', category: oils },
      { name: 'Coriander / Cilantro', amount: '1/2 cup', category: produce },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1 tsp', category: spices },
    ],
    steps: [
      'Heat the oven to 160 C.',
      'Arrange the tomato halves cut-side up in a baking dish with the garlic cloves tucked between them.',
      'Pour over the olive oil, season with salt and black pepper, and cover tightly with foil.',
      'Roast for 30 minutes, then uncover and roast for 8 more minutes until the tomatoes are jammy.',
      'Scatter with coriander and serve with bread or spooned over anything grilled.',
    ],
  },
  {
    id: 'counter-chili-garlic-pepper-stirfry',
    title: 'Chili-Garlic Pepper Stir-Fry',
    culture: 'Pan-Asian',
    mealType: 'Lunch',
    season: 'Monsoon',
    prepTime: '15m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.noodles,
    description:
      'Snappy capsicum, onions and mushrooms flashed in a fiery garlic-chili oil.',
    keyIngredients: ['Bell Peppers / Capsicum', 'Mushrooms', 'Garlic'],
    ingredients: [
      { name: 'Bell Peppers / Capsicum', amount: '2, sliced', category: produce },
      { name: 'Mushrooms', amount: '200g, sliced', category: produce },
      { name: 'Onions', amount: '1, sliced', category: produce },
      { name: 'Garlic', amount: '4 cloves, minced', category: produce },
      { name: 'Red Chili Powder', amount: '1 tsp', category: spices },
      { name: 'Olive Oil', amount: '2 tbsp', category: oils },
      { name: 'Salt', amount: '1/2 tsp', category: spices },
    ],
    steps: [
      'Heat the oil in a wok until almost smoking.',
      'Add the garlic and red chili powder and stir for 10 seconds to infuse the oil.',
      'Drop in the onions and capsicum and stir-fry over the highest heat for 2 minutes.',
      'Add the mushrooms and keep tossing until they are just cooked through.',
      'Season with salt and serve immediately while the vegetables are still crunchy.',
    ],
  },

  // ---------------------------------------------------------------------------
  // Market basket kitchen
  // ---------------------------------------------------------------------------
  {
    id: 'market-lemon-chili-spaghetti',
    title: 'Lemon-Chili Spaghetti',
    culture: 'Continental',
    mealType: 'Dinner',
    season: 'Summer',
    prepTime: '20m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.pasta,
    description:
      'Al dente spaghetti tossed with lemon zest, green chilies, grated cheese and glossy olive oil.',
    keyIngredients: ['Spaghetti / Noodles', 'Lemon / Lime', 'Cheese (Cheddar/Processed)'],
    ingredients: [
      { name: 'Spaghetti / Noodles', amount: '200g', category: grains },
      { name: 'Lemon / Lime', amount: '1, zest and juice', category: produce },
      { name: 'Green Chilies', amount: '2, finely sliced', category: produce },
      { name: 'Cheese (Cheddar/Processed)', amount: '40g, grated', category: dairy },
      { name: 'Olive Oil', amount: '3 tbsp', category: oils },
      { name: 'Garlic', amount: '3 cloves, sliced', category: produce },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1 tsp', category: spices },
    ],
    steps: [
      'Boil the spaghetti in well-salted water until just al dente and reserve a cup of pasta water.',
      'Warm the olive oil with the garlic and green chilies until the garlic turns pale gold.',
      'Toss the drained pasta through the chili oil with the lemon zest and juice.',
      'Add a splash of pasta water and the grated cheese and toss until the sauce turns silky.',
      'Finish with black pepper and an extra squeeze of lemon.',
    ],
  },
  {
    id: 'market-garlic-chili-spaghetti',
    title: 'Garlic-Chili Spaghetti Aglio e Olio',
    culture: 'Continental',
    mealType: 'Dinner',
    season: 'Winter',
    prepTime: '15m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.noodles,
    description:
      'The classic midnight pasta: garlic slowly toasted in olive oil with green chilies and a snowfall of cheese.',
    keyIngredients: ['Spaghetti / Noodles', 'Garlic', 'Green Chilies'],
    ingredients: [
      { name: 'Spaghetti / Noodles', amount: '200g', category: grains },
      { name: 'Garlic', amount: '6 cloves, thinly sliced', category: produce },
      { name: 'Green Chilies', amount: '2, sliced', category: produce },
      { name: 'Olive Oil', amount: '4 tbsp', category: oils },
      { name: 'Cheese (Cheddar/Processed)', amount: '30g, grated', category: dairy },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1 tsp', category: spices },
    ],
    steps: [
      'Cook the spaghetti in salted water until al dente, reserving a mug of the cooking water.',
      'Gently toast the garlic in the olive oil over low heat until it is golden and crisp.',
      'Add the green chilies and cook for 30 seconds.',
      'Toss in the pasta with a little pasta water and stir vigorously to emulsify the oil.',
      'Finish off the heat with cheese and black pepper and serve at once.',
    ],
  },
  {
    id: 'market-chickpea-carrot-curry',
    title: 'Chickpea & Carrot Curry',
    culture: 'Indian Comfort',
    mealType: 'Dinner',
    season: 'Monsoon',
    prepTime: '30m',
    difficulty: 'Easy',
    servings: 3,
    image: IMAGES.dal,
    description:
      'Tender chickpeas and sweet carrots simmered in a warming cumin and garam masala gravy.',
    keyIngredients: ['Chickpeas / Chole', 'Carrots', 'Garlic'],
    ingredients: [
      { name: 'Chickpeas / Chole', amount: '2 cups, cooked', category: grains },
      { name: 'Carrots', amount: '3, diced', category: produce },
      { name: 'Garlic', amount: '4 cloves, minced', category: produce },
      { name: 'Onions', amount: '1, chopped', category: produce },
      { name: 'Coconut Milk', amount: '1/2 cup', category: dairy },
      { name: 'Cumin Seeds (Jeera)', amount: '1 tsp', category: spices },
      { name: 'Turmeric Powder', amount: '1/2 tsp', category: spices },
      { name: 'Garam Masala', amount: '1 tsp', category: spices },
      { name: 'Olive Oil', amount: '2 tbsp', category: oils },
      { name: 'Salt', amount: '1 tsp', category: spices },
    ],
    steps: [
      'Soften the onions and garlic in olive oil with the cumin seeds.',
      'Stir in the turmeric and garam masala and cook for 30 seconds.',
      'Add the carrots with a splash of water and cook until just tender.',
      'Fold in the chickpeas and coconut milk and simmer gently for 12 minutes.',
      'Mash a few chickpeas against the pan to thicken the gravy, season with salt and serve.',
    ],
  },
  {
    id: 'market-lemon-chana-masala',
    title: 'Lemon Chana Masala',
    culture: 'Indian Comfort',
    mealType: 'Dinner',
    season: 'Monsoon',
    prepTime: '25m',
    difficulty: 'Easy',
    servings: 3,
    image: IMAGES.curry,
    description:
      'Chickpeas in a tangy tomato masala brightened with lemon and finished with garam masala.',
    keyIngredients: ['Chickpeas / Chole', 'Lemon / Lime', 'Garlic'],
    ingredients: [
      { name: 'Chickpeas / Chole', amount: '2 cups, cooked', category: grains },
      { name: 'Lemon / Lime', amount: '1, juiced', category: produce },
      { name: 'Garlic', amount: '4 cloves, minced', category: produce },
      { name: 'Onions', amount: '1, chopped', category: produce },
      { name: 'Tomatoes', amount: '2, chopped', category: produce },
      { name: 'Cumin Seeds (Jeera)', amount: '1 tsp', category: spices },
      { name: 'Coriander Powder', amount: '1 tsp', category: spices },
      { name: 'Garam Masala', amount: '1 tsp', category: spices },
      { name: 'Olive Oil', amount: '2 tbsp', category: oils },
      { name: 'Salt', amount: '1 tsp', category: spices },
    ],
    steps: [
      'Crackle the cumin seeds in olive oil, then cook the onions and garlic until golden.',
      'Add the tomatoes, coriander powder and garam masala and cook down to a thick masala.',
      'Fold in the chickpeas with a cup of water and simmer for 10 minutes.',
      'Lightly crush some chickpeas to thicken the sauce.',
      'Turn off the heat, stir in the lemon juice and season with salt.',
    ],
  },
  {
    id: 'market-carrot-chickpea-salad',
    title: 'Lemon-Herb Carrot & Chickpea Salad',
    culture: 'Continental',
    mealType: 'Lunch',
    season: 'Summer',
    prepTime: '15m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.saladAlt,
    description:
      'Grated carrots and chickpeas tossed in a lemon, rosemary and olive-oil dressing.',
    keyIngredients: ['Carrots', 'Chickpeas / Chole', 'Lemon / Lime'],
    ingredients: [
      { name: 'Carrots', amount: '3, grated', category: produce },
      { name: 'Chickpeas / Chole', amount: '1 cup, cooked', category: grains },
      { name: 'Lemon / Lime', amount: '1, juiced', category: produce },
      { name: 'Olive Oil', amount: '2 tbsp', category: oils },
      { name: 'Rosemary', amount: '2 sprigs, finely chopped', category: produce },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1/2 tsp', category: spices },
    ],
    steps: [
      'Whisk the lemon juice, olive oil, rosemary, salt and pepper into a dressing.',
      'Toss the grated carrots and chickpeas together in a large bowl.',
      'Pour over the dressing and fold until everything is coated.',
      'Let the salad sit for 5 minutes so the carrots soften slightly.',
      'Taste and adjust with more lemon or salt before serving.',
    ],
  },
  {
    id: 'market-roasted-carrot-chickpea-bowl',
    title: 'Roasted Carrot & Chickpea Power Bowl',
    culture: 'Continental',
    mealType: 'Dinner',
    season: 'Monsoon',
    prepTime: '30m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.potato,
    description:
      'Caramelised carrots and crisp chickpeas with rosemary, lemon and a garlicky olive-oil drizzle.',
    keyIngredients: ['Carrots', 'Chickpeas / Chole', 'Rosemary'],
    ingredients: [
      { name: 'Carrots', amount: '4, cut into batons', category: produce },
      { name: 'Chickpeas / Chole', amount: '2 cups, cooked', category: grains },
      { name: 'Olive Oil', amount: '2 tbsp', category: oils },
      { name: 'Lemon / Lime', amount: '1, juiced', category: produce },
      { name: 'Garlic', amount: '2 cloves, grated', category: produce },
      { name: 'Rosemary', amount: '2 sprigs', category: produce },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1 tsp', category: spices },
    ],
    steps: [
      'Heat the oven to 220 C.',
      'Toss the carrots and chickpeas with olive oil, rosemary, salt and pepper.',
      'Spread them on a tray in a single layer and roast for 20 minutes, shaking once.',
      'Whisk the lemon juice with the grated garlic and a little more olive oil.',
      'Pile the roasted carrots and chickpeas into bowls and spoon the dressing over the top.',
    ],
  },
  {
    id: 'market-pasta-e-ceci',
    title: 'Pasta e Ceci with Rosemary',
    culture: 'Continental',
    mealType: 'Dinner',
    season: 'Winter',
    prepTime: '25m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.mediterranean,
    description:
      'A comforting one-pot pasta and chickpea stew scented with rosemary and finished with cheese.',
    keyIngredients: ['Spaghetti / Noodles', 'Chickpeas / Chole', 'Rosemary'],
    ingredients: [
      { name: 'Spaghetti / Noodles', amount: '150g, broken', category: grains },
      { name: 'Chickpeas / Chole', amount: '1 cup, cooked', category: grains },
      { name: 'Garlic', amount: '3 cloves, sliced', category: produce },
      { name: 'Olive Oil', amount: '2 tbsp', category: oils },
      { name: 'Rosemary', amount: '2 sprigs', category: produce },
      { name: 'Cheese (Cheddar/Processed)', amount: '30g, grated', category: dairy },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1 tsp', category: spices },
    ],
    steps: [
      'Warm the olive oil with the garlic and rosemary until fragrant.',
      'Add the chickpeas and crush about a third of them against the pan.',
      'Pour in 3 cups of water and bring to a gentle simmer.',
      'Add the broken spaghetti and cook until the pasta is tender and the liquid has thickened.',
      'Stir in the cheese, season with salt and black pepper, and serve in deep bowls.',
    ],
  },
  {
    id: 'market-sweet-chili-chickpeas',
    title: 'Sweet Chili Chickpea Skillet',
    culture: 'Pan-Asian',
    mealType: 'Dinner',
    season: 'Monsoon',
    prepTime: '15m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.ratatouille,
    description:
      'Crisp chickpeas and carrots glazed in a sticky chili-garlic sauce with a squeeze of lemon.',
    keyIngredients: ['Chickpeas / Chole', 'Green Chilies', 'Carrots'],
    ingredients: [
      { name: 'Chickpeas / Chole', amount: '2 cups, cooked', category: grains },
      { name: 'Carrots', amount: '2, diced', category: produce },
      { name: 'Green Chilies', amount: '2, sliced', category: produce },
      { name: 'Garlic', amount: '3 cloves, minced', category: produce },
      { name: 'Lemon / Lime', amount: '1/2, juiced', category: produce },
      { name: 'Olive Oil', amount: '1 tbsp', category: oils },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1/2 tsp', category: spices },
    ],
    steps: [
      'Pat the chickpeas dry and sear them in a hot pan until lightly crisp.',
      'Add the oil, carrots, garlic and green chilies and stir-fry for 3 minutes.',
      'Splash in a little water and let it bubble until the carrots are just tender.',
      'Season with salt and black pepper and toss until the chickpeas are glossy.',
      'Finish with lemon juice and serve hot.',
    ],
  },
  {
    id: 'market-chili-carrot-noodles',
    title: 'Chili-Carrot Noodles',
    culture: 'Pan-Asian',
    mealType: 'Lunch',
    season: 'Monsoon',
    prepTime: '15m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.noodles,
    description:
      'Slurpable noodles with ribbons of carrot, green chili and a garlicky chili oil.',
    keyIngredients: ['Spaghetti / Noodles', 'Carrots', 'Green Chilies'],
    ingredients: [
      { name: 'Spaghetti / Noodles', amount: '200g', category: grains },
      { name: 'Carrots', amount: '2, julienned', category: produce },
      { name: 'Garlic', amount: '3 cloves, minced', category: produce },
      { name: 'Green Chilies', amount: '2, sliced', category: produce },
      { name: 'Olive Oil', amount: '2 tbsp', category: oils },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1 tsp', category: spices },
    ],
    steps: [
      'Boil the noodles in salted water until just tender and drain.',
      'Heat the oil and sizzle the garlic and green chilies for 30 seconds.',
      'Add the carrots and stir-fry for 2 minutes so they keep their crunch.',
      'Toss in the noodles with a splash of cooking water.',
      'Season with salt and black pepper and serve immediately.',
    ],
  },

  // ---------------------------------------------------------------------------
  // Everyday pantry
  // ---------------------------------------------------------------------------
  {
    id: 'pantry-crispy-potato-green-beans',
    title: 'Crispy Herb Potato & Green Bean Skillet',
    culture: 'Continental',
    mealType: 'Breakfast',
    season: 'Monsoon',
    prepTime: '20m',
    difficulty: 'Easy',
    servings: 2,
    image: IMAGES.potatoAlt,
    description:
      'Golden potato cubes and tender-crisp green beans with garlic chips and cracked pepper.',
    keyIngredients: ['Potatoes', 'Green Beans', 'Garlic'],
    ingredients: [
      { name: 'Potatoes', amount: '3, cubed', category: produce },
      { name: 'Green Beans', amount: '200g, trimmed', category: produce },
      { name: 'Garlic', amount: '4 cloves, sliced', category: produce },
      { name: 'Olive Oil', amount: '2 tbsp', category: oils },
      { name: 'Black Pepper', amount: '1/2 tsp', category: spices },
      { name: 'Salt', amount: '1/2 tsp', category: spices },
    ],
    steps: [
      'Par-boil the potato cubes for 5 minutes and drain them thoroughly.',
      'Heat the olive oil in a wide skillet over medium heat.',
      'Add the potatoes and cook until golden and crusty on all sides.',
      'Toss in the garlic and green beans and stir-fry for 4 minutes.',
      'Season with salt and black pepper and serve hot.',
    ],
  },
];

const STOP_WORDS = new Set([
  'fresh', 'dried', 'ground', 'powder', 'seed', 'seeds', 'whole', 'large',
  'medium', 'small', 'chopped', 'sliced', 'cooked', 'beaten', 'grated',
  'minced', 'julienned', 'sprig', 'sprigs', 'clove', 'cloves', 'cup', 'cups',
  'tbsp', 'tsp', 'and', 'with', 'the', 'of', 'in', 'to', 'a', 'an',
]);

const normalizeName = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const singular = (token) => {
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.endsWith('oes')) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
};

const tokens = (value) =>
  normalizeName(value)
    .split(' ')
    .filter((token) => token && !STOP_WORDS.has(token))
    .map(singular);

const ingredientMatches = (recipeName, inventoryName) => {
  const a = normalizeName(recipeName);
  const b = normalizeName(inventoryName);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const aTokens = tokens(a);
  const bTokens = tokens(b);
  return (
    aTokens.some((token) => token.length > 2 && bTokens.includes(token)) ||
    bTokens.some((token) => token.length > 2 && aTokens.includes(token))
  );
};

const inventoryName = (item) =>
  typeof item === 'string' ? item : item && item.name ? item.name : '';

const scoreRecipe = (recipe, { inventory, timeOfDay, season, culture, index }) => {
  const pantry = inventory.map(inventoryName).filter(Boolean);
  const matchedIngredients = recipe.ingredients.filter((ingredient) =>
    pantry.some((item) => ingredientMatches(ingredient.name, item))
  );
  const keys = recipe.keyIngredients || recipe.ingredients.slice(0, 3).map((item) => item.name);
  const matchedKeys = keys.filter((key) =>
    pantry.some((item) => ingredientMatches(key, item))
  );
  const coverage = matchedIngredients.length / recipe.ingredients.length;

  let score = matchedIngredients.length * 4 + matchedKeys.length * 7 + coverage * 8;
  if (recipe.culture === culture) score += 6;
  if (recipe.mealType === timeOfDay) score += 3;
  if (recipe.season === season) score += 1;

  return {
    recipe,
    score,
    coverage,
    matchedKeys: matchedKeys.length,
    matchedIngredients: matchedIngredients.length,
    index,
  };
};

// One dish per family keeps a menu from becoming four chickpea curries. The
// ranking still decides the order; this only breaks up near-duplicates.
const RECIPE_FAMILY = {
  'fridge-spinach-mushroom-bhurji': 'egg',
  'fridge-creamy-spinach-broccoli': 'skillet',
  'fridge-stuffed-peppers': 'stuffed',
  'fridge-cucumber-tomato-raita': 'salad',
  'fridge-sesame-broccoli-zucchini': 'stir-fry',
  'fridge-zucchini-tomato-saute': 'skillet',
  'fridge-cucumber-yogurt-bowl': 'salad',
  'fridge-spinach-mushroom-frittata': 'egg',
  'counter-tomato-mushroom-masala': 'curry',
  'counter-capsicum-mushroom-jalfrezi': 'stir-fry',
  'counter-tomato-coriander-shorba': 'soup',
  'counter-garlic-mushroom-sukka': 'dry',
  'counter-tomato-garlic-confit': 'roast',
  'counter-chili-garlic-pepper-stirfry': 'stir-fry',
  'market-lemon-chili-spaghetti': 'pasta',
  'market-garlic-chili-spaghetti': 'pasta',
  'market-chickpea-carrot-curry': 'curry',
  'market-lemon-chana-masala': 'curry',
  'market-carrot-chickpea-salad': 'salad',
  'market-roasted-carrot-chickpea-bowl': 'bowl',
  'market-pasta-e-ceci': 'pasta',
  'market-sweet-chili-chickpeas': 'stir-fry',
  'market-chili-carrot-noodles': 'noodle',
  'pantry-crispy-potato-green-beans': 'skillet',
};

const familyOf = (recipe) => RECIPE_FAMILY[recipe.id] || 'other';

// A cuisine only gets first refusal when its recipe genuinely fits the pantry.
// Without this, a mostly-missing Indian dish outranked a perfect Continental
// match just because of the selected cuisine.
const isStrongMatch = (entry) =>
  entry.matchedKeys >= 2 && entry.matchedIngredients >= 4 && entry.coverage >= 0.55;

/**
 * Pick recipes that actually use the supplied pantry.
 *
 * Recipes from the requested cuisine that match at least one key ingredient are
 * ranked first, then other relevant cuisines, so a cuisine filter still delivers
 * four cards even when that cuisine cannot cover the pantry alone.
 */
export function selectCuratedRecipes({
  inventory = [],
  timeOfDay = 'Dinner',
  season = 'Monsoon',
  culture = 'Indian Comfort',
  limit = 4,
} = {}) {
  const context = { inventory, timeOfDay, season, culture };
  const ranked = CURATED_RECIPES.map((recipe, index) =>
    scoreRecipe(recipe, { ...context, index })
  ).sort(
    (a, b) =>
      b.score - a.score ||
      b.matchedKeys - a.matchedKeys ||
      b.matchedIngredients - a.matchedIngredients ||
      a.index - b.index
  );

  const sameCuisineStrong = ranked.filter(
    (entry) => entry.recipe.culture === culture && isStrongMatch(entry)
  );
  const otherStrong = ranked.filter(
    (entry) => entry.recipe.culture !== culture && isStrongMatch(entry)
  );
  const sameCuisineRelevant = ranked.filter(
    (entry) => entry.recipe.culture === culture && !isStrongMatch(entry) && entry.matchedKeys > 0
  );
  const otherRelevant = ranked.filter(
    (entry) => entry.recipe.culture !== culture && !isStrongMatch(entry) && entry.matchedKeys > 0
  );
  const sameCuisineRest = ranked.filter(
    (entry) => entry.recipe.culture === culture && entry.matchedKeys === 0
  );
  const rest = ranked.filter(
    (entry) => entry.recipe.culture !== culture && entry.matchedKeys === 0
  );

  const ordered = [
    ...sameCuisineStrong,
    ...otherStrong,
    ...sameCuisineRelevant,
    ...otherRelevant,
    ...sameCuisineRest,
    ...rest,
  ];

  const seen = new Set();
  const usedFamilies = new Set();
  const picked = [];

  // First pass: one recipe per family, in ranked order.
  for (const entry of ordered) {
    if (picked.length >= limit) break;
    if (seen.has(entry.recipe.id) || usedFamilies.has(familyOf(entry.recipe))) continue;
    seen.add(entry.recipe.id);
    usedFamilies.add(familyOf(entry.recipe));
    picked.push(entry.recipe);
  }

  // Second pass: fill any remaining slots if the library is short on families.
  for (const entry of ordered) {
    if (picked.length >= limit) break;
    if (seen.has(entry.recipe.id)) continue;
    seen.add(entry.recipe.id);
    picked.push(entry.recipe);
  }

  return picked;
}

export default selectCuratedRecipes;
