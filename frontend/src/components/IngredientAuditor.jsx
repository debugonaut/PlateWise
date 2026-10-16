import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Camera,
  Plus,
  ArrowRight,
  Sparkles,
  Lightbulb,
  Layers,
  ChevronLeft
} from 'lucide-react';
import VisionScannerModal from './VisionScannerModal';

export default function IngredientAuditor({
  recipe,
  userInventory,
  setUserInventory,
  onProceedToCook,
  onBackToRecommender,
}) {
  const [isVisionOpen, setIsVisionOpen] = useState(false);
  const [newIngredient, setNewIngredient] = useState('');
  const [auditData, setAuditData] = useState(null);
  const [auditing, setAuditing] = useState(false);

  // Run audit against backend
  const runAudit = async () => {
    if (!recipe) return;
    setAuditing(true);
    try {
      const res = await fetch('/api/audit-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe,
          userInventory,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAuditData(data.data);
      }
    } catch (err) {
      console.error('Audit failed:', err);
    } finally {
      setAuditing(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, [recipe, userInventory]);

  const handleToggleIngredient = (ingredientName) => {
    const exists = userInventory.some((i) =>
      (typeof i === 'string' ? i : i.name).toLowerCase() === ingredientName.toLowerCase()
    );
    if (exists) {
      setUserInventory((prev) =>
        prev.filter((i) => (typeof i === 'string' ? i : i.name).toLowerCase() !== ingredientName.toLowerCase())
      );
    } else {
      setUserInventory((prev) => [...prev, { name: ingredientName, category: 'Manual' }]);
    }
  };

  const handleAddManual = (e) => {
    e.preventDefault();
    if (!newIngredient.trim()) return;
    setUserInventory((prev) => [...prev, { name: newIngredient.trim(), category: 'Pantry' }]);
    setNewIngredient('');
  };

  const handleVisionScanComplete = (detectedItems) => {
    setUserInventory((prev) => {
      const existingNames = new Set(prev.map((i) => (typeof i === 'string' ? i : i.name).toLowerCase()));
      const newItems = detectedItems.filter((d) => !existingNames.has(d.name.toLowerCase()));
      return [...prev, ...newItems];
    });
  };

  if (!recipe) {
    return (
      <div className="p-12 text-center space-y-4 border border-dashed border-neutral-200 rounded-3xl">
        <Layers className="w-8 h-8 text-neutral-400 mx-auto" />
        <p className="text-sm font-mono text-neutral-500">No recipe selected for audit.</p>
        <button
          onClick={onBackToRecommender}
          className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-mono"
        >
          Select a Recipe First
        </button>
      </div>
    );
  }

  const matchPercent = auditData?.matchPercentage ?? 0;

  return (
    <section className="space-y-8">
      {/* Top Breadcrumb & Selected Recipe Title */}
      <div className="space-y-4">
        <button
          onClick={onBackToRecommender}
          className="flex items-center gap-1.5 text-xs font-mono text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>BACK TO RECOMMENDATIONS</span>
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4 p-6 rounded-3xl bg-neutral-100/80 border border-neutral-200/80">
          <div className="space-y-1.5 max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
              {recipe.title}
            </h2>
            <p className="text-xs text-neutral-600 leading-relaxed">{recipe.description}</p>
          </div>

          {/* Large Match Percentage Pill */}
          <div className="flex flex-col items-end gap-1">
            <div
              className={`px-4 py-2 rounded-2xl border font-mono text-sm font-semibold ${
                matchPercent >= 80
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : matchPercent >= 50
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-rose-50 text-rose-800 border-rose-300'
              }`}
            >
              {matchPercent}% PANTRY MATCH
            </div>
            <span className="text-[10px] font-mono text-neutral-400">
              {auditData?.availableItems?.length || 0} of {recipe.ingredients?.length || 0} READY
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Required Checklist vs Smart AI Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (7 cols): Required Ingredients Checklist */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase text-neutral-900 font-semibold tracking-wider">
              Required Recipe Ingredients
            </h3>
            <button
              onClick={() => setIsVisionOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-neutral-300 hover:border-neutral-900 text-xs font-mono text-neutral-800 transition-all shadow-xs"
            >
              <Camera className="w-3.5 h-3.5 text-neutral-600" />
              <span>AI SCAN FRIDGE</span>
            </button>
          </div>

          <div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200/90 bg-white overflow-hidden shadow-xs">
            {recipe.ingredients?.map((item, idx) => {
              const isAvailable = userInventory.some((inv) =>
                (typeof inv === 'string' ? inv : inv.name).toLowerCase().includes(item.name.toLowerCase()) ||
                item.name.toLowerCase().includes((typeof inv === 'string' ? inv : inv.name).toLowerCase())
              );

              return (
                <div
                  key={idx}
                  onClick={() => handleToggleIngredient(item.name)}
                  className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                    isAvailable ? 'bg-white hover:bg-neutral-50' : 'bg-rose-50/20 hover:bg-rose-50/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isAvailable ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    )}
                    <div>
                      <span className={`text-sm font-medium ${isAvailable ? 'text-neutral-900' : 'text-neutral-800'}`}>
                        {item.name}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400 ml-2">({item.amount})</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      isAvailable
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {isAvailable ? 'In Stock' : 'Missing'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Quick Manual Add to Pantry */}
          <form onSubmit={handleAddManual} className="flex gap-2 pt-2">
            <input
              type="text"
              value={newIngredient}
              onChange={(e) => setNewIngredient(e.target.value)}
              placeholder="Add other ingredient in your fridge..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-mono hover:bg-neutral-800"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>
        </div>

        {/* Right Column (5 cols): AI Smart Advice & Action */}
        <div className="lg:col-span-5 space-y-6">
          {/* Smart AI Substitutions Callout */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-neutral-900" />
              <h3 className="text-xs font-mono uppercase text-neutral-900 font-semibold tracking-wider">
                AI Culinary Substitutions
              </h3>
            </div>

            {auditData?.substitutions?.length > 0 ? (
              <div className="space-y-2.5">
                {auditData.substitutions.map((sub, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                      <span>Missing: {sub.missing}</span>
                      <span className="text-[10px] font-mono text-amber-700">SUBSTITUTE</span>
                    </div>
                    <p className="text-xs font-mono text-amber-800">&rarr; {sub.substitute}</p>
                    <p className="text-[11px] text-amber-700/90 leading-tight">{sub.impact}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800">
                &check; All primary ingredients in stock. Zero substitutions required!
              </div>
            )}
          </div>

          {/* Smart Surplus Advice */}
          {auditData?.surplusAdvice?.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-neutral-700" />
                <h3 className="text-xs font-mono uppercase text-neutral-900 font-semibold tracking-wider">
                  Surplus Fridge Optimization
                </h3>
              </div>

              <div className="space-y-2.5">
                {auditData.surplusAdvice.map((sur, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-neutral-100/90 border border-neutral-200 space-y-1">
                    <span className="text-xs font-semibold text-neutral-900 block">
                      Extra {sur.surplusItem} detected:
                    </span>
                    <p className="text-xs text-neutral-600 leading-relaxed">{sur.action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proceed to Cook Station Button */}
          <div className="pt-4">
            <button
              onClick={onProceedToCook}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-neutral-900 text-white font-mono text-sm hover:bg-neutral-800 transition-all shadow-xl shadow-black/10 group"
            >
              <span>PROCEED TO COOK STATION</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Vision Scanner Modal */}
      <VisionScannerModal
        isOpen={isVisionOpen}
        onClose={() => setIsVisionOpen(false)}
        onScanComplete={handleVisionScanComplete}
      />
    </section>
  );
}
