// Curated demo kitchens for PlateWise.
//
// Each photo is paired with the pantry that is actually visible in the scene.
// That is what makes the walkthrough meaningful: three different kitchens,
// three different sets of ingredients, three different menus. Uploads still go
// through the live vision model; these fixed scenes keep the demo predictable.

export const DEMO_PHOTOS = [
  {
    id: 'stocked-fridge',
    label: 'Stocked Fridge',
    category: 'Full Fridge',
    description: 'Broccoli, zucchini, tomatoes, peppers, eggs & yogurt',
    file: '/demo/stocked-fridge.jpg',
    context: { timeOfDay: 'Dinner', season: 'Monsoon', culture: 'Continental' },
    inventory: [
      { name: 'Broccoli', category: 'Produce' },
      { name: 'Zucchini', category: 'Produce' },
      { name: 'Tomatoes', category: 'Produce' },
      { name: 'Bell Peppers / Capsicum', category: 'Produce' },
      { name: 'Cucumber', category: 'Produce' },
      { name: 'Mushrooms', category: 'Produce' },
      { name: 'Spinach / Palak', category: 'Produce' },
      { name: 'Eggs', category: 'Proteins & Nuts' },
      { name: 'Yogurt / Curd', category: 'Dairy' },
      { name: 'Milk', category: 'Dairy' },
      { name: 'Butter', category: 'Dairy' },
      { name: 'Black Pepper', category: 'Spices' },
    ],
  },
  {
    id: 'countertop-prep',
    label: 'Countertop Prep',
    category: 'Produce Haul',
    description: 'Tomatoes, onions, garlic, mushrooms, peppers & herbs',
    file: '/demo/countertop-prep.jpg',
    context: { timeOfDay: 'Dinner', season: 'Monsoon', culture: 'Indian Comfort' },
    inventory: [
      { name: 'Tomatoes', category: 'Produce' },
      { name: 'Onions', category: 'Produce' },
      { name: 'Garlic', category: 'Produce' },
      { name: 'Bell Peppers / Capsicum', category: 'Produce' },
      { name: 'Mushrooms', category: 'Produce' },
      { name: 'Coriander / Cilantro', category: 'Produce' },
      { name: 'Olive Oil', category: 'Oils & Sauces' },
      { name: 'Cumin Seeds (Jeera)', category: 'Spices' },
      { name: 'Turmeric Powder', category: 'Spices' },
      { name: 'Red Chili Powder', category: 'Spices' },
      { name: 'Black Pepper', category: 'Spices' },
      { name: 'Salt', category: 'Spices' },
    ],
  },
  {
    id: 'market-basket',
    label: 'Market Basket',
    category: 'Pantry & Produce',
    description: 'Carrots, lemons, chilies, spaghetti, chickpeas & parmesan',
    file: '/demo/market-basket.jpg',
    context: { timeOfDay: 'Dinner', season: 'Summer', culture: 'Continental' },
    inventory: [
      { name: 'Carrots', category: 'Produce' },
      { name: 'Lemon / Lime', category: 'Produce' },
      { name: 'Green Chilies', category: 'Produce' },
      { name: 'Garlic', category: 'Produce' },
      { name: 'Rosemary', category: 'Produce' },
      { name: 'Spaghetti / Noodles', category: 'Grains & Pulses' },
      { name: 'Chickpeas / Chole', category: 'Grains & Pulses' },
      { name: 'Cheese (Cheddar/Processed)', category: 'Dairy' },
      { name: 'Olive Oil', category: 'Oils & Sauces' },
      { name: 'Cumin Seeds (Jeera)', category: 'Spices' },
      { name: 'Turmeric Powder', category: 'Spices' },
      { name: 'Garam Masala', category: 'Spices' },
      { name: 'Black Pepper', category: 'Spices' },
      { name: 'Salt', category: 'Spices' },
    ],
  },
];

export default DEMO_PHOTOS;
