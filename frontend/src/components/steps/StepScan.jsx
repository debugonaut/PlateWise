import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, ArrowRight, X, Search, Check, Sparkles, Image as ImageIcon } from 'lucide-react';
import { HOUSEHOLD_INGREDIENTS, INGREDIENT_CATEGORIES } from '../../data/householdIngredients';
import { DEMO_PHOTOS } from '../../data/demoPhotos';

export default function StepScan({ userInventory, setUserInventory, onNext }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [scanStatus, setScanStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isDragging, setIsDragging] = useState(false);
  const [demoBusy, setDemoBusy] = useState(null);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  // Prevent browser from opening dragged files when dropped outside dropzone
  useEffect(() => {
    const preventDragOver = (e) => {
      e.preventDefault();
    };
    const preventDrop = (e) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDragOver);
    window.addEventListener('drop', preventDrop);
    return () => {
      window.removeEventListener('dragover', preventDragOver);
      window.removeEventListener('drop', preventDrop);
    };
  }, []);

  // Phone photos are routinely 10-12 MP / 5-8 MB. Sending that raw is slow and
  // can be rejected by the vision API, so shrink to a sane edge length first.
  // Images already small enough are passed through untouched.
  const MAX_EDGE = 1024;
  const SMALL_ENOUGH_BYTES = 3 * 1024 * 1024;

  const readAndDownscale = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read that file.'));
      reader.onloadend = () => {
        const dataUrl = reader.result;
        const img = new Image();
        img.onerror = () => reject(new Error('That file is not a readable image.'));
        img.onload = () => {
          const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          if (scale === 1 && file.size <= SMALL_ENOUGH_BYTES) {
            resolve({ dataUrl, blob: file });
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve({ dataUrl, blob: file });
                return;
              }
              const out = new FileReader();
              out.onloadend = () => resolve({ dataUrl: out.result, blob });
              out.readAsDataURL(blob);
            },
            'image/jpeg',
            0.9
          );
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });

  const processFile = async (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      setScanStatus('That is not an image. Drop a JPG, PNG or WEBP photo.');
      return;
    }

    setLoading(true);
    setScanStatus('Preparing photo...');
    try {
      const { dataUrl, blob } = await readAndDownscale(file);
      setPreview(dataUrl);
      await runNeuralVisionScan(blob, dataUrl);
    } catch (err) {
      console.error('Image read error:', err);
      setScanStatus(err.message || 'Could not read that image.');
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) processFile(file);
  };

  const handleRemovePhoto = (e) => {
    e.stopPropagation();
    setPreview(null);
    setScanStatus('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Demo Mode runs the SAME request as a normal upload -- nothing is stubbed.
  // The photos were checked against the live model before shipping (see
  // backend/scripts/build-demo-set.mjs), so the demo shows real inference on
  // inputs that are known to be in distribution.
  const runDemoPhoto = async (photo) => {
    if (loading) return;
    setDemoBusy(photo.id);
    setPreview(photo.file);
    setScanStatus(`Scanning ${photo.label}...`);
    try {
      const res = await fetch(photo.file);
      if (!res.ok) throw new Error(`Could not load ${photo.file}`);
      const blob = await res.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      // Demo scans replace the pantry so the walkthrough starts from a coherent,
      // predictable state instead of accumulating items between clicks.
      await runNeuralVisionScan(blob, dataUrl, { replacePantry: true });
    } catch (err) {
      console.error('Demo photo error:', err);
      setScanStatus(err.message || 'Could not load that demo photo.');
      setLoading(false);
    } finally {
      setDemoBusy(null);
    }
  };

  const runNeuralVisionScan = async (file, base64, { replacePantry = false } = {}) => {
    setLoading(true);
    setScanStatus('Reading ingredients from your photo...');

    try {
      let imagePayload = typeof base64 === 'string' && base64.startsWith('data:') ? base64 : null;
      if (!imagePayload && file) {
        const reader = new FileReader();
        imagePayload = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      if (!imagePayload) {
        throw new Error('No valid image data available to scan.');
      }

      const res = await fetch('/api/vision-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagePayload }),
      });
      if (!res.ok) {
        throw new Error(`The scan service returned HTTP ${res.status}.`);
      }
      const json = await res.json();

      // Only real ingredient detections reach the pantry. The backend may also
      // return a `dish` guess, which this screen deliberately ignores: PlateWise
      // answers "what can I cook with these", not "what dish is this".
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setUserInventory((prev) => {
          if (replacePantry) return json.data;
          const existingNames = new Set(
            prev.map((i) => (typeof i === 'string' ? i : i.name).toLowerCase())
          );
          const fresh = json.data.filter((d) => !existingNames.has(d.name.toLowerCase()));
          return [...fresh, ...prev];
        });
        if (json.source === 'groq-vision') {
          setScanStatus(
            `Detected ${json.data.length} ingredient${json.data.length === 1 ? '' : 's'} from your photo.`
          );
        } else if (json.source === 'ingredient-model') {
          // Name the model and its confidence. Saying which reader answered is
          // the difference between a claim and a measurement.
          const hit = json.data[0];
          setScanStatus(`Recognised ${hit.name} (${hit.confidence}% confident).`);
        } else if (json.message) {
          // The server told us it fell back, so say so rather than implying a read.
          setScanStatus(json.message);
        } else {
          setScanStatus(`Detected ${json.data.length} ingredient(s) via the offline classifier.`);
        }
      } else {
        // The server distinguishes "read the photo, found no food" from "could not
        // read the photo", so prefer its wording when it sent one.
        setScanStatus(
          json.message ||
            'No ingredients were recognised. Try a closer, brighter photo or add items manually below.'
        );
      }
    } catch (err) {
      console.error('Vision scan error:', err);
      setScanStatus(
        err.message || 'Scan failed. You can add items manually below or try another photo.'
      );
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
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounter.current += 1;
          if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
          if (!isDragging) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragCounter.current -= 1;
          if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setIsDragging(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          dragCounter.current = 0;
          const dropped = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (dropped) {
            processFile(dropped);
          }
        }}
        className={`relative border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center transition-all shadow-xs ${
          isDragging
            ? 'border-neutral-900 bg-neutral-900/5 ring-4 ring-neutral-900/10 scale-[1.01]'
            : 'border-neutral-200 hover:border-neutral-400 bg-white'
        }`}
      >
        {/* Full-surface drag overlay with pointer-events-none to prevent child event interruptions */}
        {isDragging && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/95 backdrop-blur-xs rounded-3xl border-2 border-dashed border-neutral-900 pointer-events-none animate-in fade-in duration-150">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mb-3 shadow-lg">
              <Upload className="w-7 h-7 animate-bounce" />
            </div>
            <p className="text-sm font-semibold text-neutral-900">
              Drop photo to scan all ingredients
            </p>
            <p className="text-xs font-mono text-neutral-500 mt-1">
              Supports fridge shelves, pantry counters, grocery hauls
            </p>
          </div>
        )}

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
              {isDragging
                ? 'Drop the photo to scan it'
                : 'Drag & drop a photo of your fridge, pantry or groceries'}
            </p>
            <p className="text-[11px] font-mono text-neutral-400">
              JPG, PNG or WEBP — or pick a file below
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

        {/* Multi-ingredient Demo Scenarios */}
        {DEMO_PHOTOS.length > 0 && (
          <div className="mt-6 pt-5 border-t border-neutral-100 text-left">
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs font-mono text-neutral-600 inline-flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Or test with multi-ingredient demo photos
              </p>
              <span className="text-[10px] font-mono text-neutral-400 hidden sm:inline">1-click AI scan</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DEMO_PHOTOS.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => runDemoPhoto(photo)}
                  disabled={loading}
                  className={`group relative text-left p-3 rounded-2xl border transition-all flex flex-col justify-between ${
                    demoBusy === photo.id
                      ? 'border-neutral-900 ring-2 ring-neutral-900/20 bg-neutral-50'
                      : 'border-neutral-200 hover:border-neutral-400 bg-white hover:shadow-md hover:-translate-y-0.5'
                  } ${loading ? 'opacity-60 cursor-wait' : ''}`}
                >
                  <div className="relative w-full h-28 rounded-xl overflow-hidden mb-2.5 bg-neutral-100">
                    <img
                      src={photo.file}
                      alt={photo.label}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-mono font-medium text-white shadow-xs">
                      {photo.itemCount}
                    </span>
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-[9px] font-mono font-medium text-neutral-800 shadow-xs">
                      {photo.category}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-neutral-900 mb-0.5 group-hover:text-black">
                      {photo.label}
                    </div>
                    <div className="text-[10px] font-mono text-neutral-500 line-clamp-1">
                      {photo.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scan feedback stays visible after the spinner clears. */}
        {scanStatus && (!loading || !preview) && (
          <p
            className={`mt-3 text-[11px] font-mono ${
              loading ? 'text-neutral-400' : 'text-neutral-500'
            }`}
          >
            {scanStatus}
          </p>
        )}

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
