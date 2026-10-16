import React, { useState, useEffect, useRef } from 'react';
import { Clock, ChevronRight, RefreshCw, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import SpotlightCard from '../reactbits/SpotlightCard';
import { getAccurateRecipeImage } from '../../lib/recipeImages';

export default function StepSuggest({ onSelectRecipe, userInventory = [] }) {
  const [timeOfDay, setTimeOfDay] = useState('Dinner');
  const [season, setSeason] = useState('Monsoon');
  const [culture, setCulture] = useState('Indian Comfort');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const lastFetchedKey = useRef('');

  const inventoryString = userInventory
    .map((i) => (typeof i === 'string' ? i : i.name))
    .sort()
    .join(',');

  const fetchRecommendations = async (force = false) => {
    const currentKey = `${timeOfDay}|${season}|${culture}|${inventoryString}`;
    if (!force && lastFetchedKey.current === currentKey && recipes.length > 0) {
      return;
    }

    setLoading(true);
    lastFetchedKey.current = currentKey;

    try {
      const res = await fetch(
        `/api/recommendations?timeOfDay=${timeOfDay}&season=${season}&culture=${culture}&inventory=${encodeURIComponent(
          inventoryString
        )}`
      );
      const json = await res.json();
      if (json.success && json.data) {
        setRecipes(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations(false);
  }, [timeOfDay, season, culture, inventoryString]);

  const computeMatch = (recipe) => {
    if (!recipe.ingredients || recipe.ingredients.length === 0) return 100;
    const invNames = userInventory.map((i) => (typeof i === 'string' ? i : i.name).toLowerCase());
    const count = recipe.ingredients.filter((req) =>
      invNames.some((inv) => inv.includes(req.name.toLowerCase()) || req.name.toLowerCase().includes(inv))
    ).length;
    return Math.round((count / recipe.ingredients.length) * 100);
  };

  return (
    <div className="space-y-8">
      {/* Magnetic Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Context */}
          <div className="flex items-center rounded-2xl bg-neutral-100/90 p-1 border border-neutral-200/70">
            {['Breakfast', 'Lunch', 'Dinner'].map((t) => {
              const isActive = timeOfDay === t;
              return (
                <button
                  key={t}
                  onClick={() => setTimeOfDay(t)}
                  className={`relative px-3.5 py-1.5 rounded-xl text-xs font-mono tracking-wider transition-colors z-10 ${
                    isActive ? 'text-white font-medium' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTimePill"
                      className="absolute inset-0 rounded-xl bg-neutral-900 shadow-sm -z-10"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  {t.toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* Season Context */}
          <div className="flex items-center rounded-2xl bg-neutral-100/90 p-1 border border-neutral-200/70">
            {['Monsoon', 'Summer', 'Winter'].map((s) => {
              const isActive = season === s;
              return (
                <button
                  key={s}
                  onClick={() => setSeason(s)}
                  className={`relative px-3.5 py-1.5 rounded-xl text-xs font-mono tracking-wider transition-colors z-10 ${
                    isActive ? 'text-white font-medium' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeSeasonPill"
                      className="absolute inset-0 rounded-xl bg-neutral-900 shadow-sm -z-10"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  {s.toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* Culture Context */}
          <div className="flex items-center rounded-2xl bg-neutral-100/90 p-1 border border-neutral-200/70">
            {['Indian Comfort', 'Continental', 'Pan-Asian'].map((c) => {
              const isActive = culture === c;
              return (
                <button
                  key={c}
                  onClick={() => setCulture(c)}
                  className={`relative px-3.5 py-1.5 rounded-xl text-xs font-mono tracking-wider transition-colors z-10 ${
                    isActive ? 'text-white font-medium' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeCulturePill"
                      className="absolute inset-0 rounded-xl bg-neutral-900 shadow-sm -z-10"
                      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    />
                  )}
                  {c.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => fetchRecommendations(true)}
          disabled={loading}
          aria-label="Refresh suggestions"
          className="w-9 h-9 rounded-xl border border-neutral-200 bg-white flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:border-neutral-400 transition-all shadow-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Suggested Recipes Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-80 rounded-3xl bg-neutral-100 border border-neutral-200" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recipes.map((recipe) => {
            const matchScore = computeMatch(recipe);
            const imageUrl = getAccurateRecipeImage(recipe.title, recipe.description);

            return (
              <SpotlightCard
                key={recipe.id}
                onClick={() => onSelectRecipe({ ...recipe, image: imageUrl })}
                className="p-5 cursor-pointer flex flex-col justify-between group rounded-3xl"
              >
                <div className="space-y-4">
                  {/* Accurate Recipe Thumbnail */}
                  <div className="relative aspect-16/9 rounded-2xl overflow-hidden bg-neutral-100 shadow-xs">
                    <img
                      src={imageUrl}
                      alt={recipe.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono text-white tracking-wider">
                      {recipe.culture}
                    </span>
                    <span
                      className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider backdrop-blur-md font-semibold border ${
                        matchScore >= 80
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                          : matchScore >= 50
                          ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                          : 'bg-neutral-900/80 text-neutral-300 border-neutral-700'
                      }`}
                    >
                      {matchScore}% MATCH
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1.5">
                    <h3 className="text-xl font-bold text-neutral-900 tracking-tight group-hover:text-black transition-colors">
                      {recipe.title}
                    </h3>
                    <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                      {recipe.description}
                    </p>
                  </div>
                </div>

                {/* Footer Metrics & Action */}
                <div className="pt-4 mt-4 border-t border-neutral-100 flex items-center justify-between text-xs font-mono text-neutral-500">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      {recipe.prepTime}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-neutral-400" />
                      {recipe.ingredients ? `${recipe.ingredients.length} items` : '8 items'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-neutral-900 font-semibold group-hover:translate-x-1 transition-transform">
                    <span>Inspect</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
