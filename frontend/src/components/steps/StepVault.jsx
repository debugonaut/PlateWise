import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Star, X, ArrowRight, Layers, CheckCircle2 } from 'lucide-react';

const SEEDED_VAULT_RECIPES = [
  {
    id: 'vault-1',
    title: 'Paneer Makhani & Jeera Rice',
    culture: 'Indian Comfort',
    cookedAt: 'Yesterday, 8:30 PM',
    prepTime: '25m',
    difficulty: 'Medium',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&auto=format&fit=crop&q=80',
    description: 'Slow-simmered tomato cashew gravy with soft cottage cheese cubes over fragrant tempered cumin rice.',
    ingredients: [
      { name: 'Paneer', amount: '200g' },
      { name: 'Tomatoes', amount: '4 ripe' },
      { name: 'Heavy Cream', amount: '3 tbsp' },
      { name: 'Butter', amount: '2 tbsp' },
      { name: 'Basmati Rice', amount: '1 cup' },
      { name: 'Kasuri Methi', amount: '1 tsp' }
    ],
    steps: [
      'Rinse basmati rice and steam with 1 tsp cumin seeds and ghee.',
      'Saute onions, tomatoes, and cashews, then blend into a velvet puree.',
      'Simmer gravy with garam masala, fold in paneer cubes and cream.',
      'Garnish with crushed kasuri methi and serve hot.'
    ]
  },
  {
    id: 'vault-2',
    title: 'Comforting Tadka Dal Khichdi',
    culture: 'Indian Comfort',
    cookedAt: '3 days ago, 1:15 PM',
    prepTime: '20m',
    difficulty: 'Easy',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800&auto=format&fit=crop&q=80',
    description: 'The quintessential one-pot comfort meal infused with golden ghee, roasted cumin, garlic, and hing.',
    ingredients: [
      { name: 'Rice', amount: '1/2 cup' },
      { name: 'Yellow Toor Dal', amount: '1/2 cup' },
      { name: 'Ghee', amount: '2 tbsp' },
      { name: 'Garlic', amount: '5 cloves' },
      { name: 'Cumin Seeds', amount: '1 tsp' }
    ],
    steps: [
      'Pressure cook lentils and rice with turmeric and salt until creamy.',
      'Heat ghee in tadka pan; sizzle garlic, cumin, and whole dry red chilies.',
      'Pour sizzling tadka over khichdi, trap aroma for 2 minutes and serve.'
    ]
  },
  {
    id: 'vault-3',
    title: 'Roasted Garlic & Tomato Rustic Pasta',
    culture: 'Continental',
    cookedAt: 'Last Sunday, 9:00 PM',
    prepTime: '20m',
    difficulty: 'Easy',
    rating: 4,
    image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281292?w=800&auto=format&fit=crop&q=80',
    description: 'Al dente penne tossed in blistered cherry tomatoes, olive oil, roasted garlic chips, and fresh basil.',
    ingredients: [
      { name: 'Penne Pasta', amount: '200g' },
      { name: 'Tomatoes', amount: '4 ripe' },
      { name: 'Garlic', amount: '6 cloves' },
      { name: 'Olive Oil', amount: '3 tbsp' },
      { name: 'Parmesan Cheese', amount: '3 tbsp' }
    ],
    steps: [
      'Boil pasta in salted water until al dente; reserve 1/2 cup pasta water.',
      'Toast garlic in olive oil, add crushed tomatoes and simmer until sweet.',
      'Emulsify sauce with pasta water and toss in al dente penne.'
    ]
  },
  {
    id: 'vault-4',
    title: 'Crispy Moong Dal Chilla & Mint Chutney',
    culture: 'Indian Comfort',
    cookedAt: 'Aug 18, 9:30 AM',
    prepTime: '15m',
    difficulty: 'Easy',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&auto=format&fit=crop&q=80',
    description: 'High-protein savory crepes made from soaked yellow moong lentils stuffed with grated paneer and herbs.',
    ingredients: [
      { name: 'Moong Dal', amount: '1 cup soaked' },
      { name: 'Green Chilies', amount: '2 units' },
      { name: 'Paneer', amount: '80g grated' },
      { name: 'Mint & Coriander', amount: '1 cup' }
    ],
    steps: [
      'Blend soaked moong dal into smooth pourable batter.',
      'Spread on hot griddle, drizzle oil until crisp and golden.',
      'Top with paneer and herbs, fold and serve with spicy mint dip.'
    ]
  }
];

export default function StepVault({ onCookAgain }) {
  const [activeCard, setActiveCard] = useState(null);
  const [recipes, setRecipes] = useState(SEEDED_VAULT_RECIPES);

  useEffect(() => {
    // Read local cache first for instant display
    let localItems = [];
    try {
      localItems = JSON.parse(localStorage.getItem('platewise_vault') || '[]');
    } catch {}

    const formatEntry = (item) => ({
      id: item.id || `vault-${Date.now()}-${Math.random()}`,
      title: item.title,
      culture: 'Saved Dish',
      cookedAt: new Date(item.cookedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      prepTime: '20m',
      rating: item.rating || 5,
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
      description: 'Custom recipe saved from your active cooking session.',
      ingredients: [{ name: 'Core Ingredients', amount: 'In Stock' }],
      steps: ['Followed step-by-step guidance.'],
    });

    fetch('/api/vault')
      .then((res) => res.json())
      .then((json) => {
        const remoteItems = json.success && Array.isArray(json.data) ? json.data : [];
        const combined = [...remoteItems, ...localItems];
        // Deduplicate by title + cookedAt
        const seen = new Set();
        const unique = [];
        for (const item of combined) {
          const key = `${item.title}-${item.cookedAt}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(formatEntry(item));
          }
        }
        if (unique.length > 0) {
          setRecipes([...unique, ...SEEDED_VAULT_RECIPES]);
        }
      })
      .catch(() => {
        if (localItems.length > 0) {
          setRecipes([...localItems.map(formatEntry), ...SEEDED_VAULT_RECIPES]);
        }
      });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveCard(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="space-y-8">
      {/* Grid of Expandable Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {recipes.map((card) => (
          <motion.div
            layoutId={`card-${card.id}`}
            key={card.id}
            onClick={() => setActiveCard(card)}
            className="p-5 rounded-3xl bg-white border border-neutral-200/90 hover:border-neutral-400 hover:shadow-md cursor-pointer flex flex-col justify-between transition-all group"
          >
            <div className="space-y-4">
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-neutral-100">
                <img
                  src={card.image}
                  alt={card.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono text-white tracking-wider">
                  {card.culture}
                </span>
                <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[10px] font-mono text-neutral-900 tracking-wider font-semibold">
                  {card.cookedAt}
                </span>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-neutral-900 tracking-tight group-hover:text-black">
                  {card.title}
                </h3>
                <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                  {card.description}
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(card.rating || 5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-current" />
                ))}
              </div>

              <div className="flex items-center gap-1 text-xs font-mono font-semibold text-neutral-900 group-hover:translate-x-1 transition-transform">
                <span>View Details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Expandable Modal */}
      <AnimatePresence>
        {activeCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveCard(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              layoutId={`card-${activeCard.id}`}
              className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-white rounded-3xl border border-neutral-200 shadow-2xl z-10 p-6 sm:p-8 space-y-6"
            >
              <button
                onClick={() => setActiveCard(null)}
                className="absolute top-5 right-5 p-2 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors z-20"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative aspect-21/9 rounded-2xl overflow-hidden bg-neutral-100">
                <img
                  src={activeCard.image}
                  alt={activeCard.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-xs font-mono text-white">
                  Cooked: {activeCard.cookedAt}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-md bg-neutral-100 text-neutral-700">
                    {activeCard.culture}
                  </span>
                  <span className="text-xs font-mono text-neutral-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {activeCard.prepTime}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
                  {activeCard.title}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  {activeCard.description}
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t border-neutral-100">
                <h4 className="text-xs font-mono uppercase text-neutral-900 font-semibold tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Recipe Ingredients Used</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {activeCard.ingredients?.map((ing, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 border border-neutral-100">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-medium text-neutral-800">{ing.name}</span>
                      <span className="text-neutral-400 font-mono ml-auto">({ing.amount})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-neutral-100">
                <h4 className="text-xs font-mono uppercase text-neutral-900 font-semibold tracking-wider">
                  Preparation Method
                </h4>
                <div className="space-y-2">
                  {activeCard.steps?.map((step, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs text-neutral-700 p-2.5 rounded-xl bg-neutral-50/50">
                      <span className="w-5 h-5 rounded-full bg-neutral-900 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <p className="leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-100">
                <button
                  onClick={() => {
                    setActiveCard(null);
                    onCookAgain(activeCard);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-neutral-900 text-white font-mono text-xs hover:bg-neutral-800 transition-all shadow-xl shadow-black/10"
                >
                  <span>LOAD INTO AUDIT &amp; COOK AGAIN</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
