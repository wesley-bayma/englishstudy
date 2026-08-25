'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Lock, 
  KeyRound, 
  ArrowRight, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Sparkles 
} from 'lucide-react';

function LoginForm() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Por favor, digite sua senha de acesso.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Senha incorreta. Verifique e tente novamente.');
        setIsLoading(false);
        return;
      }

      // Success -> Redirect to protected route
      router.push(redirectPath);
      router.refresh();
    } catch (err) {
      setError('Erro ao conectar com o servidor.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans select-none">
      {/* Neo-brutalist ambient glows */}
      <div className="absolute w-[600px] h-[600px] bg-[#bef264]/8 rounded-full blur-[160px] pointer-events-none -top-40 -left-40" />
      <div className="absolute w-[500px] h-[500px] bg-[#f9a8d4]/8 rounded-full blur-[160px] pointer-events-none -bottom-40 -right-40" />

      <div className="w-full max-w-lg space-y-8 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-[#12151c] border-2 border-[#232936] shadow-2xl p-4 mb-1 hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" className="w-full h-full">
              <path d="M 0 20 C 0 8.954 8.954 0 20 0 L 35 0 C 35 19.33 19.33 35 0 35 Z" fill="#bef264" />
              <path d="M 80 60 C 80 71.046 71.046 80 60 80 L 45 80 C 45 60.67 60.67 45 80 45 Z" fill="#bef264" />
              <circle cx="40" cy="40" r="14" fill="#f9a8d4" />
            </svg>
          </div>

          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#bef264]/10 border border-[#bef264]/30 text-[#bef264] text-[11px] font-mono font-bold uppercase tracking-widest mb-3">
              <span className="w-2 h-2 rounded-full bg-[#bef264] animate-pulse" />
              Acesso Pessoal Protegido
            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter">
              hub<span className="text-[#bef264] font-mono">.</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
              English Study Hub • Gestão Soberana para Anki
            </p>
          </div>
        </div>

        {/* Decorative Floating Badges */}
        <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono">
          <span className="px-3 py-1 rounded-full bg-[#f9a8d4] text-[#090a0f] font-bold shadow-md">
            3.000 Palavras
          </span>
          <span className="px-3 py-1 rounded-full bg-[#bef264] text-[#090a0f] font-bold shadow-md">
            100 Frases
          </span>
          <span className="px-3 py-1 rounded-full bg-[#fbbf24] text-[#090a0f] font-bold shadow-md">
            150 Phrasal Verbs
          </span>
        </div>

        {/* Main Lock Card */}
        <div className="bg-[#12151c] border-2 border-[#232936] rounded-[36px] p-7 sm:p-10 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-xl">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#bef264]" />
                  Senha de Acesso
                </label>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha..."
                  autoFocus
                  className="w-full pl-5 pr-12 py-4 bg-[#090a0f] rounded-2xl border-2 border-[#232936] text-white text-base font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#bef264] transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 text-xs font-bold text-rose-400 flex items-center gap-2.5 animate-in fade-in">
                <Lock className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 rounded-2xl bg-[#bef264] hover:bg-[#a3e635] text-[#090a0f] font-black text-sm transition-all active:scale-95 shadow-xl shadow-[#bef264]/10 flex items-center justify-center gap-2.5 disabled:opacity-50 group cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-[#090a0f]" />
                  <span>Desbloqueando...</span>
                </>
              ) : (
                <>
                  <span>Desbloquear Aplicação</span>
                  <ArrowRight className="w-4 h-4 stroke-[3] group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Footer Security Features */}
          <div className="pt-4 border-t border-[#232936] flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-4 h-4 text-[#bef264]" />
              Sessão mantida por 60 dias
            </span>
            <span className="font-bold text-slate-400">
              100% Offline & Local
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center text-slate-400 font-mono text-xs">
        Carregando...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
