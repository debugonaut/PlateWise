import React, { useState, useRef } from 'react';
import { Camera, Upload, ArrowRight, X, Search, Check } from 'lucide-react';
import { HOUSEHOLD_INGREDIENTS, INGREDIENT_CATEGORIES } from '../../data/householdIngredients';

export default function StepScan({ userInventory, setUserInventory, onNext }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [scanStatus, setScanStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
        runNeuralVisionScan(file, reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = (e) => {
    e.stopPropagation();
    setPreview(null);
    setScanStatus('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const runNeuralVisionScan = async (file, base64) => {
    setLoading(true);
    setScanStatus('Running Neural Vision food detection...');

    try {
      const formData = new FormData();
      if (file) {
        formData.append('image', file);
      } else {
        formData.append('image', base64);
      }

      const res = await fetch('/api/vision-scan', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      if (json.success && json.data && json.data.length > 0) {
        setUserInventory((prev) => {
          const existingNames = new Set(
            prev.map((i) => (typeof i === 'string' ? i : i.name).toLowerCase())
          );
          const fresh = json.data.filter((d) => !existingNames.has(d.name.toLowerCase()));
          return [...fresh, ...prev];
        });
        setScanStatus(`AI detected ${json.data.length} ingredients from your photo.`);
      }
    } catch (err) {
      console.error('Vision scan error:', err);
      setScanStatus('Scan complete.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStaple = (item) => {
    const itemName = item.name;
    const exists = userInventory.some(
      (i) => (typeof i === 'string' ? i : i.name).toLowerCase() === itemName.toLowerCase()
    );
    if (exists) {
      setUserInventory((prev) =>
        prev.filter((i) => (typeof i === 'string' ? i : i.name).toLowerCase() !== itemName.toLowerCase())
      );
    } else {
      setUserInventory((prev) => [...prev, { name: item.name, category: item.category }]);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const name = searchQuery.trim();
    if (!userInventory.some((i) => (typeof i === 'string' ? i : i.name).toLowerCase() === name.toLowerCase())) {
      setUserInventory((prev) => [...prev, { name, category: 'Custom' }]);
    }
    setSearchQuery('');
  };

  const filteredPantry = HOUSEHOLD_INGREDIENTS.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.synonyms.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Upload Zone */}
      <div className="relative border-2 border-dashed border-neutral-200 hover:border-neutral-400 rounded-3xl p-6 sm:p-8 text-center transition-colors bg-white shadow-xs">
        {preview ? (
          <div className="relative max-h-60 overflow-hidden rounded-2xl mx-auto mb-4 bg-neutral-100 group">
            <img src={preview} alt="Fridge scan preview" className="w-full h-full object-contain max-h-60 mx-auto" />
            <button
              type="button"
              onClick={handleRemovePhoto}
              title="Remove photo"
              aria-label="Remove uploaded photo"
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-all shadow-md hover:scale-105 z-20"
            >
              <X className="w-4 h-4" />
            </button>

            {loading && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2 z-10">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="font-mono text-xs">{scanStatus}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-neutral-100 mx-auto flex items-center justify-center text-neutral-600">
              <Camera className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-neutral-900">
              Upload photo of your fridge, pantry, or ingredients
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="photo-upload"
        />
        <label
          htmlFor="photo-upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-mono hover:bg-neutral-800 cursor-pointer transition-all shadow-xs"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{preview ? 'Change Photo' : 'Select Photo to Scan'}</span>
        </label>
      </div>

      {/* Identified / Selected Ingredients */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
          <span>Active Pantry ({userInventory.length})</span>
          {userInventory.length > 0 && (
            <button
              onClick={() => setUserInventory([])}
              className="text-neutral-400 hover:text-neutral-900"
            >
              Clear All
            </button>
          )}
        </div>

        {userInventory.length === 0 ? (
          <div className="p-4 rounded-2xl border border-dashed border-neutral-200 text-center text-xs font-mono text-neutral-400">
            No ingredients added yet. Scan a photo or click items from the pantry below.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
            {userInventory.map((item, idx) => {
              const name = typeof item === 'string' ? item : item.name;
              return (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-neutral-200 text-xs font-mono text-neutral-800 shadow-xs"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>{name}</span>
                  <button
                    onClick={() =>
                      setUserInventory((prev) =>
                        prev.filter((i) => (typeof i === 'string' ? i : i.name).toLowerCase() !== name.toLowerCase())
                      )
                    }
                    className="p-0.5 rounded-md hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Household Ingredients Library */}
      <div className="space-y-4 pt-4 border-t border-neutral-200">
        {/* Search & Custom Input Bar */}
        <form onSubmit={handleManualSubmit} className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search or add any ingredient (e.g. Rice, Methi, Paneer, Pasta, Garlic, Eggs)..."
            className="w-full pl-10 pr-24 py-2.5 rounded-2xl border border-neutral-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
          />
          {searchQuery && (
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-neutral-900 text-white text-[11px] font-mono hover:bg-neutral-800"
            >
              + Add
            </button>
          )}
        </form>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5">
          {INGREDIENT_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-mono transition-all ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Ingredients Dataset Grid (Click to toggle) */}
        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
          {filteredPantry.map((item) => {
            const isAdded = userInventory.some(
              (i) => (typeof i === 'string' ? i : i.name).toLowerCase() === item.name.toLowerCase()
            );
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => handleToggleStaple(item)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition-all border ${
                  isAdded
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50'
                }`}
              >
                {isAdded ? '✓ ' : '+ '}
                {item.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Next */}
      <div className="pt-2 flex justify-end">
        <button
          onClick={onNext}
          disabled={userInventory.length === 0}
          className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-neutral-900 text-white font-mono text-xs hover:bg-neutral-800 transition-all shadow-lg disabled:opacity-40 group"
        >
          <span>CONTINUE TO SUGGESTIONS</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
