import React, { useState } from 'react';
import { ChevronLeft, Play, CheckCircle, ExternalLink } from 'lucide-react';
import { getAccurateRecipeImage } from '../../lib/recipeImages';

export default function StepCook({ recipe, onBack, onCompleteRecipe }) {
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isDone, setIsDone] = useState(false);

  if (!recipe) return null;

  const toggleStep = (index) => {
    setCompletedSteps((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleMarkCooked = () => {
    setIsDone(true);
    onCompleteRecipe(recipe);
  };

  // A search embed (listType=search) is unreliable and often renders blank.
  // A tutorial card that opens YouTube in a new tab always works on stage.
  const tutorialUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `how to cook ${recipe.title} recipe`
  )}`;
  const posterUrl = recipe.image || getAccurateRecipeImage(recipe.title, recipe.description);

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-mono text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>BACK TO AUDIT</span>
        </button>
      </div>

      {/* Video & Step Checklist Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left (7 cols): Tutorial card (opens YouTube reliably) */}
        <div className="lg:col-span-7 space-y-3">
          <a
            href={tutorialUrl}
            target="_blank"
            rel="noreferrer"
            className="group relative block aspect-video rounded-3xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-2xl"
          >
            <img
              src={posterUrl}
              alt={`${recipe.title} tutorial`}
              className="w-full h-full object-cover opacity-65 group-hover:opacity-50 group-hover:scale-105 transition-all duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
              <span className="w-14 h-14 rounded-full bg-white text-neutral-900 flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform">
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </span>
              <div>
                <p className="text-sm sm:text-base font-semibold text-white">
                  Watch a step-by-step tutorial
                </p>
                <p className="text-[11px] font-mono text-neutral-300 mt-1">
                  Opens a YouTube search for “{recipe.title}”
                </p>
              </div>
            </div>
          </a>

          <div className="flex items-center justify-between text-xs font-mono text-neutral-500 px-1">
            <span>Tutorial search opens on YouTube</span>
            <a
              href={tutorialUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-neutral-900 underline underline-offset-4"
            >
              <span>Open on YouTube</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Right (5 cols): Step Checklist & Finish Action */}
        <div className="lg:col-span-5 space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">{recipe.title}</h2>
            <p className="text-xs text-neutral-500 font-mono mt-1">
              Prep: {recipe.prepTime} &bull; Difficulty: {recipe.difficulty || 'Easy'}
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-900 font-semibold">
              Step-by-Step Instructions
            </h3>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {recipe.steps?.map((step, idx) => {
                const isStepCompleted = completedSteps.includes(idx);
                return (
                  <div
                    key={idx}
                    onClick={() => toggleStep(idx)}
                    className={`flex items-start gap-3 p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                      isStepCompleted
                        ? 'bg-neutral-100/70 border-neutral-300 text-neutral-400 line-through'
                        : 'bg-white border-neutral-200 text-neutral-800 hover:border-neutral-400'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-mono ${
                        isStepCompleted
                          ? 'bg-neutral-300 text-white'
                          : 'bg-neutral-900 text-white'
                      }`}
                    >
                      {isStepCompleted ? '✓' : idx + 1}
                    </span>
                    <p className="leading-relaxed">{step}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mark as Cooked Button */}
          <div className="pt-2">
            {!isDone ? (
              <button
                onClick={handleMarkCooked}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-neutral-900 text-white font-mono text-xs hover:bg-neutral-800 transition-all shadow-xl shadow-black/10"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>SAVE RECIPE TO HISTORY &rarr;</span>
              </button>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                <span className="text-xs font-mono text-emerald-800 font-semibold block">
                  &check; Saved to your Recipe History!
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
