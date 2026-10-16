import React, { useState, useEffect } from 'react';
import { Clock, ChevronRight, RefreshCw, Layers, Camera, Sparkles, Check, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import SpotlightCard from './reactbits/SpotlightCard';
import BlurText from './reactbits/BlurText';
import VisionScannerModal from './VisionScannerModal';

export default function ContextRecommender({ onSelectRecipe, userInventory = [], setUserInventory }) {
  const [timeOfDay, setTimeOfDay] = useState('Dinner');
  const [season, setSeason] = useState('Monsoon');
  const [culture, setCulture] = useState('Indian Comfort');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isVisionOpen, setIsVisionOpen] = useState(false);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/recommendations?timeOfDay=${timeOfDay}&season=${season}&culture=${culture}`
      );
      const json = await res.json();
      if (json.success) {
        setRecipes(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [timeOfDay, season, culture]);

  const handleVisionScanComplete = (detectedItems) => {
    if (setUserInventory) {
      setUserInventory((prev) => {
        const existingNames = new Set(prev.map((i) => (typeof i === 'string' ? i : i.name).toLowerCase()));
        const newItems = detectedItems.filter((d) => !existingNames.has(d.name.toLowerCase()));
        return [...prev, ...newItems];
      });
    }
  };

  // Compute live match score based on user fridge
  const computeMatch = (recipe) => {
    if (!recipe.ingredients || recipe.ingredients.length === 0) return 100;
    const invNames = userInventory.map((i) => (typeof i === 'string' ? i : i.name).toLowerCase());
    const count = recipe.ingredients.filter((req) =>
      invNames.some((inv) => inv.includes(req.name.toLowerCase()) || req.name.toLowerCase().includes(inv))
    ).length;
    return Math.round((count / recipe.ingredients.length) * 100);
  };

  return (
    <section className="space-y-8">
      {/* 1. Top Section: Camera Upload & AI Fridge Vision Scan Banner */}
      <div className="p-6 rounded-3xl bg-neutral-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="space-y-2 z-10 max-w-lg">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase">
              AI Vision Ingredient Scanner
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Snap your fridge or countertop to start.
          </h2>
          <p className="text-xs text-neutral-300 leading-relaxed">
            Llama 3.2 Vision automatically identifies your available ingredients and suggests tailored recipes with zero waste.
          </p>

          {/* Current Detected Ingredients Chip Row */}
          {userInventory.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              <span className="text-[10px] font-mono text-neutral-400 mr-1">In Fridge:</span>
              {userInventory.slice(0, 6).map((inv, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-0.5 rounded-md bg-neutral-800 text-neutral-200 text-[11px] font-mono border border-neutral-700"
                >
                  {typeof inv === 'string' ? inv : inv.name}
                </span>
              ))}
              {userInventory.length > 6 && (
                <span className="text-[10px] font-mono text-neutral-400">
                  +{userInventory.length - 6} more
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setIsVisionOpen(true)}
          className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white text-neutral-900 font-mono text-xs font-semibold hover:bg-neutral-100 transition-all shrink-0 shadow-lg group z-10"
        >
          <Camera className="w-4 h-4 text-neutral-800 group-hover:scale-110 transition-transform" />
          <span>SCAN FRIDGE PHOTO</span>
        </button>

        {/* Ambient Subtle Grid Glow */}
        <div className="absolute right-0 top-0 w-80 h-full bg-gradient-to-l from-neutral-800/30 to-transparent pointer-events-none" />
      </div>

      {/* 2. Headline & Context Controls */}
      <div className="space-y-6 pt-2">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900">
            <BlurText text="Recommended for your cravings" delay={40} />
          </h1>

          {/* Icon-Only Refresh Button */}
          <button
            onClick={fetchRecommendations}
            disabled={loading}
            title="Refresh recommendations"
            aria-label="Refresh recommendations"
            className="w-10 h-10 rounded-xl border border-neutral-200/90 bg-white flex items-center justify-center text-neutral-600 hover:text-neutral-900 hover:border-neutral-400 transition-all shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Snappy Magnetic Pill Filter Controls */}
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

          {/* Culture / Cuisine Context */}
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
      </div>

      {/* 3. Recommended Recipes Grid with High-Quality Thumbnails */}
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
            const imageUrl =
              recipe.image ||
              'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80';

            return (
              <SpotlightCard
                key={recipe.id}
                onClick={() => onSelectRecipe(recipe)}
                className="p-5 cursor-pointer flex flex-col justify-between group rounded-3xl"
              >
                <div className="space-y-4">
                  {/* High Quality Recipe Thumbnail */}
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
                      {recipe.ingredients ? `${recipe.ingredients.length} items` : '10 items'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-neutral-900 font-semibold group-hover:translate-x-1 transition-transform">
                    <span>Audit &amp; Cook</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      )}

      {/* Vision Scanner Modal */}
      <VisionScannerModal
        isOpen={isVisionOpen}
        onClose={() => setIsVisionOpen(false)}
        onScanComplete={handleVisionScanComplete}
      />
    </section>
  );
}
