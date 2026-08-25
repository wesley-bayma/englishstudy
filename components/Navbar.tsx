'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  CalendarDays, 
  PlusCircle, 
  BookOpen, 
  BarChart3, 
  CheckSquare,
  Sparkles,
  Layers
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Hoje', href: '/', icon: CalendarDays },
    { label: 'Adicionar', href: '/add', icon: PlusCircle, highlight: true },
    { label: 'Banco', href: '/bank', icon: BookOpen },
    { label: 'Revisor', href: '/reviewer', icon: CheckSquare },
    { label: 'Progresso', href: '/progress', icon: BarChart3 },
  ];

  return (
    <>
      {/* Top Header - Desktop & Tablet */}
      <header className="sticky top-0 z-30 bg-dark-bg/85 backdrop-blur-xl border-b border-dark-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            {/* Custom Brand Geometric Icon */}
            <div className="w-10 h-10 rounded-2xl bg-dark-card border border-dark-border flex items-center justify-center p-2 group-hover:border-card-lime transition-colors shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" className="w-full h-full">
                <path d="M 0 20 C 0 8.954 8.954 0 20 0 L 35 0 C 35 19.33 19.33 35 0 35 Z" fill="#bef264" />
                <path d="M 80 60 C 80 71.046 71.046 80 60 80 L 45 80 C 45 60.67 60.67 45 80 45 Z" fill="#bef264" />
                <circle cx="40" cy="40" r="14" fill="#f9a8d4" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tighter text-white group-hover:text-card-lime transition-colors">
                hub<span className="text-card-lime font-mono">.</span>
              </span>
              <span className="text-[11px] font-mono uppercase tracking-widest text-dark-muted px-2 py-0.5 rounded-full border border-dark-border/60 ml-1 hidden sm:inline-block">
                English Anki Hub
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold tracking-tight transition-all ${
                    isActive
                      ? 'bg-white text-dark-bg shadow-sm'
                      : item.highlight
                        ? 'bg-card-lime text-dark-bg hover:brightness-105'
                        : 'text-slate-400 hover:text-white hover:bg-dark-card'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive || item.highlight ? 'text-dark-bg stroke-[2.5]' : 'text-slate-400'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Bottom Navigation Bar - Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-bg/95 backdrop-blur-2xl border-t border-dark-border safe-area-pb shadow-2xl">
        <div className="grid grid-cols-5 h-16 max-w-md mx-auto px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            if (item.highlight) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center relative -top-3"
                >
                  <div className={`w-12 h-12 rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center justify-center ${
                    isActive 
                      ? 'bg-white text-dark-bg ring-4 ring-dark-card' 
                      : 'bg-card-lime text-dark-bg shadow-card-lime/20'
                  }`}>
                    <Icon className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <span className="text-[10px] font-bold mt-1 text-slate-300">
                    {item.label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 transition-colors active:scale-95 ${
                  isActive ? 'text-card-lime font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-card-lime stroke-[2.5]' : 'text-slate-500'}`} />
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
