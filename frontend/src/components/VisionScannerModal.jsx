import React, { useState } from 'react';
import { Camera, Upload, Check, AlertCircle, Sparkles, X } from 'lucide-react';

export default function VisionScannerModal({ isOpen, onClose, onScanComplete }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [detectedItems, setDetectedItems] = useState([]);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);

    try {
      // Send the base64 data URL as JSON — works in both dev and Vercel serverless
      const res = await fetch('/api/vision-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: preview }),
      });
      const data = await res.json();

      if (data.success && data.data) {
        setDetectedItems(data.data);
      } else {
        setError(data.message || 'Scan failed');
      }
    } catch (err) {
      setError(err.message || 'Vision scan connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToFridge = () => {
    if (detectedItems.length > 0) {
      onScanComplete(detectedItems);
      onClose();
    }
  };

  // Preset sample fridge photo for instant testing without camera
  const handleSampleFridge = () => {
    const sampleItems = [
      { name: 'Tomatoes', estimatedQuantity: '4 units', category: 'Produce', freshness: 'Fresh' },
      { name: 'Onions', estimatedQuantity: '3 units', category: 'Produce', freshness: 'Fresh' },
      { name: 'Paneer', estimatedQuantity: '200g', category: 'Dairy', freshness: 'Fresh' },
      { name: 'Butter', estimatedQuantity: '100g', category: 'Dairy', freshness: 'Fresh' },
      { name: 'Basmati Rice', estimatedQuantity: '1 kg', category: 'Grains', freshness: 'Pantry' },
      { name: 'Garlic', estimatedQuantity: '1 bulb', category: 'Produce', freshness: 'Fresh' },
      { name: 'Extra Potatoes', estimatedQuantity: '5 units', category: 'Produce', freshness: 'Surplus' }
    ];
    setDetectedItems(sampleItems);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl bg-white rounded-3xl border border-neutral-200 shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center text-white">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-neutral-900">AI Fridge Vision Scanner</h3>
              <span className="text-[10px] font-mono text-neutral-400">POWERED BY LLAMA 3.2 VISION</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Upload or Capture Canvas */}
        {!detectedItems.length ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-neutral-200 hover:border-neutral-400 rounded-2xl p-6 text-center space-y-3 transition-colors bg-neutral-50/50">
              {preview ? (
                <div className="relative max-h-52 overflow-hidden rounded-xl">
                  <img src={preview} alt="Fridge scan" className="w-full h-full object-cover" />
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-neutral-100 mx-auto flex items-center justify-center text-neutral-500">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-neutral-800">Upload or drag a photo of your fridge / counter</p>
                    <p className="text-[11px] font-mono text-neutral-400">Supports JPG, PNG, WEBP</p>
                  </div>
                </>
              )}

              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="fridge-upload"
              />
              <label
                htmlFor="fridge-upload"
                className="inline-block px-4 py-2 rounded-xl bg-white border border-neutral-300 text-xs font-mono text-neutral-700 hover:bg-neutral-50 cursor-pointer shadow-xs"
              >
                {preview ? 'Choose Different Image' : 'Select Photo from Device'}
              </label>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <button
                type="button"
                onClick={handleSampleFridge}
                className="text-neutral-500 hover:text-neutral-900 underline underline-offset-4"
              >
                Load Sample Kitchen Inventory
              </button>

              <button
                type="button"
                disabled={!preview || loading}
                onClick={handleScan}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{loading ? 'Analyzing with Llama Vision...' : 'Run Vision Scan'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Detected Ingredients Review */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-emerald-700 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Detected {detectedItems.length} Ingredients in Fridge
              </span>
              <button
                onClick={() => setDetectedItems([])}
                className="text-[11px] font-mono text-neutral-400 hover:text-neutral-900"
              >
                Scan Another Image
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {detectedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-200/70 text-xs"
                >
                  <span className="font-semibold text-neutral-900">{item.name}</span>
                  <div className="flex items-center gap-3 font-mono text-neutral-500">
                    <span>{item.estimatedQuantity}</span>
                    <span className="px-2 py-0.5 rounded-md bg-neutral-200/80 text-[10px] text-neutral-700">
                      {item.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-mono text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyToFridge}
                className="px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-mono hover:bg-neutral-800"
              >
                Sync with Recipe Auditor &rarr;
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
