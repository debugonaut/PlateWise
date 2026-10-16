import React from 'react';

export default function Header() {
  return (
    <header className="flex items-center justify-between pb-6 pt-1 border-b border-neutral-200/80">
      {/* Brand Mark (Minimalist) */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center text-white shadow-xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
            <path d="M6 14h6" />
          </svg>
        </div>
        <span className="font-semibold text-lg tracking-tight text-neutral-900">
          PlateWise
        </span>
      </div>

      {/* Right Search / Filter Pill */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-100/80 border border-neutral-200/80 text-xs font-mono text-neutral-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-neutral-400">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="text-neutral-400">Search recipes or ingredients...</span>
      </div>
    </header>
  );
}
