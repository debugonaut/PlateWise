import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

function DockItem({ mouseX, icon: Icon, label, isActive, onClick }) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current ? ref.current.getBoundingClientRect() : { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(distance, [-150, 0, 150], [44, 62, 44]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 170, damping: 12 });

  return (
    <motion.button
      ref={ref}
      style={{ width, height: width }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative flex items-center justify-center rounded-2xl transition-colors ${
        isActive
          ? 'bg-neutral-900 text-white shadow-md'
          : 'bg-white/80 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 border border-neutral-200/80 shadow-xs'
      }`}
      aria-label={label}
    >
      <Icon className="w-5 h-5 transition-transform" />

      {/* Active Dot Indicator */}
      {isActive && (
        <span className="absolute -bottom-1.5 w-1.5 h-1.5 rounded-full bg-neutral-900" />
      )}

      {/* Tooltip */}
      {hovered && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: -45, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="absolute pointer-events-none px-2.5 py-1 rounded-md bg-neutral-900 text-white text-[11px] font-mono tracking-wider whitespace-nowrap shadow-lg"
        >
          {label}
        </motion.div>
      )}
    </motion.button>
  );
}

export default function Dock({ items, activeTab, onSelectTab }) {
  const mouseX = useMotionValue(Infinity);

  return (
    <nav aria-label="Quick navigation" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="flex items-end gap-2.5 px-3 py-2.5 rounded-3xl bg-neutral-100/80 backdrop-blur-xl border border-neutral-300/70 shadow-2xl shadow-black/15"
      >
        {items.map((item) => (
          <DockItem
            key={item.id}
            mouseX={mouseX}
            icon={item.icon}
            label={item.label}
            isActive={activeTab === item.id}
            onClick={() => onSelectTab(item.id)}
          />
        ))}
      </motion.div>
    </nav>
  );
}
