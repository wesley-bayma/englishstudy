'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Key, ArrowRight, ShieldCheck, Eye, EyeOff, Sparkles } from 'lucide-react';

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
      setError('Por favor, digite sua senha.');
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
        setError(data.error || 'Senha incorreta.');
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
    <div className="min-h-screen bg-dark-bg text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute w-[500px] h-[500px] bg-card-lime/5 rounded-full blur-[140px] pointer-events-none top-1/4" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-dark-card border-2 border-dark-border shadow-2xl p-3.5 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" className="w-full h-full">
              <path d="M 0 20 C 0 8.954 8.954 0 20 0 L 35 0 C 35 19.33 19.33 35 0 35 Z" fill="#bef264" />
              <path d="M 80 60 C 80 71.046 71.046 80 60 80 L 45 80 C 45 60.67 60.67 45 80 45 Z" fill="#bef264" />
              <circle cx="40" cy="40" r="14" fill="#f9a8d4" />
            </svg>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter">
            English Study Hub<span className="text-card-lime">.</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Acesso Pessoal Protegido // Digite sua senha de acesso
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-dark-card border-2 border-dark-border rounded-[32px] p-7 sm:p-9 shadow-2xl space-y-6">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Key className="w-4 h-4 text-card-lime" />
                Senha de Acesso
              </label>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha..."
                  autoFocus
                  className="w-full pl-5 pr-12 py-4 bg-dark-bg rounded-2xl border-2 border-dark-border text-white text-sm font-mono placeholder:text-slate-600 focus:outline-none focus:border-card-lime transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-400 flex items-center gap-2 animate-in fade-in">
                <Lock className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 rounded-2xl bg-card-lime hover:bg-card-limeDark text-dark-bg font-black text-sm transition-all active:scale-95 shadow-xl shadow-card-lime/10 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Desbloquear Aplicação</span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-dark-border/60 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-card-lime" />
              Sessão segura de 60 dias
            </span>
            <span>v1.0 Soberano</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark-bg flex items-center justify-center text-slate-400 font-mono text-xs">
        Carregando...
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
