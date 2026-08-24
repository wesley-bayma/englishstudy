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
  Sparkles
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
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
              EH
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-lg block leading-none">English Study Hub</span>
              <span className="text-[11px] text-slate-500 font-medium">Curadoria Pessoal & Anki Helper</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  } ${item.highlight && !isActive ? 'text-blue-600 font-semibold' : ''}`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-blue-600' : 'text-slate-500'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Bottom Navigation Bar - Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 safe-area-pb shadow-lg">
        <div className="grid grid-cols-5 h-16 max-w-md mx-auto">
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
                  <div className={`w-13 h-13 p-3 rounded-full shadow-lg transition-transform active:scale-95 flex items-center justify-center ${
                    isActive 
                      ? 'bg-slate-900 text-white ring-4 ring-slate-100' 
                      : 'bg-blue-600 text-white shadow-blue-500/30'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-semibold mt-1 text-slate-700">
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
                  isActive ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600 stroke-[2.5]' : 'text-slate-400'}`} />
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
