'use client';

import React from 'react';

interface ProgressBarProps {
  completed: number;
  total: number;
  color?: 'blue' | 'emerald' | 'amber' | 'indigo';
  label?: string;
  subLabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({
  completed,
  total,
  color = 'blue',
  label,
  subLabel,
  size = 'md'
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  const colorClasses = {
    blue: 'bg-blue-600',
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-500',
    indigo: 'bg-indigo-600',
  };

  const bgClasses = {
    blue: 'bg-blue-100',
    emerald: 'bg-emerald-100',
    amber: 'bg-amber-100',
    indigo: 'bg-indigo-100',
  };

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className="w-full">
      {(label || subLabel) && (
        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
          {label && <span className="text-slate-700">{label}</span>}
          <span className="text-slate-500 font-mono">
            {completed}/{total} {subLabel ? `(${percentage}%)` : ''}
          </span>
        </div>
      )}
      <div className={`w-full rounded-full overflow-hidden ${bgClasses[color]} ${heightClasses[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
