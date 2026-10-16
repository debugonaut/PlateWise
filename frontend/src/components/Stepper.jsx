import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export default function Stepper({ currentStep, setStep, steps }) {
  return (
    <div className="w-full pb-6 border-b border-neutral-200/80">
      <div className="flex items-center justify-between max-w-3xl mx-auto px-2 sm:px-4">
        {steps.map((step, index) => {
          const isCompleted = currentStep > index;
          const isCurrent = currentStep === index;
          const isUpcoming = currentStep < index;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              {/* Step Node */}
              <div className="flex flex-col items-center gap-2 relative group">
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  disabled={isUpcoming}
                  className={`relative flex items-center justify-center w-10 h-10 rounded-2xl text-xs font-mono transition-all z-10 ${
                    isCurrent
                      ? 'bg-neutral-900 text-white shadow-lg shadow-black/15 scale-105 ring-4 ring-neutral-200'
                      : isCompleted
                      ? 'bg-neutral-900 text-white hover:bg-neutral-800 cursor-pointer shadow-xs'
                      : 'bg-neutral-100 text-neutral-400 border border-neutral-200/80 cursor-not-allowed'
                  }`}
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    >
                      <Check className="w-4 h-4 text-white stroke-[2.5]" />
                    </motion.div>
                  ) : (
                    <span>0{index + 1}</span>
                  )}

                  {/* Active Step Ambient Glow */}
                  {isCurrent && (
                    <motion.div
                      layoutId="activeStepGlow"
                      className="absolute inset-0 rounded-2xl bg-neutral-900 -z-10"
                      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                    />
                  )}
                </button>

                {/* Step Label */}
                <div className="flex flex-col items-center">
                  <span
                    className={`text-[11px] font-mono tracking-wider font-semibold transition-colors ${
                      isCurrent
                        ? 'text-neutral-900'
                        : isCompleted
                        ? 'text-neutral-700'
                        : 'text-neutral-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>

              {/* Connecting Progress Line (between steps) */}
              {!isLast && (
                <div className="flex-1 mx-2 sm:mx-3 relative h-0.5 bg-neutral-200 rounded-full overflow-hidden self-center mb-5">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-neutral-900 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: isCompleted ? '100%' : '0%' }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
