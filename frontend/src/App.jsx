import React, { useState, useEffect } from 'react';
import { Camera, Compass, Layers, PlaySquare, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';

import Header from './components/Header';
import Stepper from './components/Stepper';
import StepScan from './components/steps/StepScan';
import StepSuggest from './components/steps/StepSuggest';
import StepAudit from './components/steps/StepAudit';
import StepCook from './components/steps/StepCook';
import StepVault from './components/steps/StepVault';
import Dock from './components/reactbits/Dock';

const STEPS = [
  { id: 'scan', label: 'SCAN', icon: Camera },
  { id: 'suggest', label: 'SUGGEST', icon: Compass },
  { id: 'audit', label: 'AUDIT', icon: Layers },
  { id: 'cook', label: 'COOK', icon: PlaySquare },
  { id: 'vault', label: 'SAVED', icon: Bookmark },
];

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // Seeded kitchen inventory from scanned image
  const [userInventory, setUserInventory] = useState([
    { name: 'Tomatoes', category: 'Produce' },
    { name: 'Onions', category: 'Produce' },
    { name: 'Garlic', category: 'Produce' },
    { name: 'Potatoes', category: 'Produce' },
    { name: 'Bell Peppers / Capsicum', category: 'Produce' },
    { name: 'Green Beans', category: 'Produce' },
    { name: 'Zucchini', category: 'Produce' },
    { name: 'Mushrooms', category: 'Produce' },
    { name: 'Lettuce / Salad Greens', category: 'Produce' },
    { name: 'Fresh Parsley', category: 'Produce' },
    { name: 'Mint Leaves', category: 'Produce' },
    { name: 'Olive Oil', category: 'Oils & Sauces' },
    { name: 'Black Pepper', category: 'Spices' },
    { name: 'Oregano & Chili Flakes', category: 'Spices' },
    { name: 'Red Chili Powder', category: 'Spices' },
  ]);

  // Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  const handleSelectRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setCurrentStep(2); // Advance to Audit (Step 03)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProceedToCook = () => {
    setCurrentStep(3); // Advance to Cook (Step 04)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCompleteRecipe = async (recipe) => {
    try {
      await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: recipe.id,
          title: recipe.title,
          cookedAt: new Date().toISOString(),
          rating: 5,
        }),
      });
      setCurrentStep(4); // Advance to Saved History (Step 05)
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Failed to log to vault:', err);
    }
  };

  const stepVariants = {
    initial: { opacity: 0, y: 12, scale: 0.99 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: 'easeOut' } },
    exit: { opacity: 0, y: -12, scale: 0.99, transition: { duration: 0.18, ease: 'easeIn' } },
  };

  return (
    <div className="min-h-screen fluted-backdrop py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-start pb-28">
      {/* Floating Canvas Container */}
      <main className="w-full max-w-5xl bg-[#FAFAFA] rounded-[36px] border border-neutral-800/80 shadow-2xl p-6 sm:p-10 lg:p-12 space-y-8 relative overflow-hidden transition-all">
        {/* Top Header */}
        <Header />

        {/* Minimalist Wizard Stepper */}
        <Stepper
          currentStep={currentStep}
          setStep={(idx) => {
            setCurrentStep(idx);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          steps={STEPS}
        />

        {/* Animated Step View */}
        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <motion.div key="step-scan" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <StepScan
                userInventory={userInventory}
                setUserInventory={setUserInventory}
                onNext={() => setCurrentStep(1)}
              />
            </motion.div>
          )}

          {currentStep === 1 && (
            <motion.div key="step-suggest" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <StepSuggest
                userInventory={userInventory}
                onSelectRecipe={handleSelectRecipe}
              />
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div key="step-audit" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <StepAudit
                recipe={selectedRecipe}
                userInventory={userInventory}
                setUserInventory={setUserInventory}
                onProceedToCook={handleProceedToCook}
                onBack={() => setCurrentStep(1)}
              />
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div key="step-cook" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <StepCook
                recipe={selectedRecipe}
                onBack={() => setCurrentStep(2)}
                onCompleteRecipe={handleCompleteRecipe}
              />
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div key="step-vault" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <StepVault
                onCookAgain={(recipe) => {
                  setSelectedRecipe(recipe);
                  setCurrentStep(2);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* React Bits Animated macOS Dock */}
      <Dock
        items={STEPS}
        activeTab={STEPS[currentStep].id}
        onSelectTab={(tabId) => {
          const idx = STEPS.findIndex((s) => s.id === tabId);
          if (idx !== -1) {
            setCurrentStep(idx);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      />
    </div>
  );
}
