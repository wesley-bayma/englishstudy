'use client';

import React from 'react';
import { ContentItem, GeminiAnalysisResult } from '../lib/types';
import { 
  AlertCircle, 
  Flame, 
  Check, 
  ArrowRight, 
  HelpCircle, 
  Trash2, 
  Plus, 
  Eye,
  Sparkles
} from 'lucide-react';

interface DuplicateMatchCardProps {
  inputQuery: string;
  exactMatch: ContentItem | null;
  aiMatch: GeminiAnalysisResult | null;
  existingCandidate: ContentItem | null;
  onRegisterEncounterOnExisting: (item: ContentItem) => void;
  onAddNewAnyway: () => void;
  onDiscard: () => void;
  onViewExisting: (item: ContentItem) => void;
}

export function DuplicateMatchCard({
  inputQuery,
  exactMatch,
  aiMatch,
  existingCandidate,
  onRegisterEncounterOnExisting,
  onAddNewAnyway,
  onDiscard,
  onViewExisting
}: DuplicateMatchCardProps) {
  // 1. EXACT DUPLICATE CASE
  if (exactMatch) {
    return (
      <div className="bg-dark-card border-2 border-rose-500/50 rounded-[32px] p-6 sm:p-7 shadow-2xl space-y-4 animate-in fade-in duration-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 flex-shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-rose-400 block mb-1">
              // Já Existe no seu Banco
            </span>
            <h3 className="text-2xl font-black text-white tracking-tight">
              &ldquo;{exactMatch.content}&rdquo; já está cadastrado
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Origem: <strong className="text-white">{exactMatch.source === 'base' ? `Base #${exactMatch.original_order}` : `Inbox (${exactMatch.source})`}</strong> • 
              Status no Anki: <strong className={exactMatch.anki_status === 'created' ? 'text-card-lime' : 'text-card-amber'}>
                {exactMatch.anki_status === 'created' ? '✅ Já criado' : '⏳ Ainda não criado'}
              </strong>
            </p>
          </div>
        </div>

        {/* Action options */}
        <div className="bg-dark-bg/80 rounded-2xl p-4 border border-dark-border space-y-3">
          <p className="text-xs text-slate-300 font-medium">
            Em vez de duplicar, você pode registrar que encontrou este termo novamente na prática para aumentar sua relevância:
          </p>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              onClick={() => onRegisterEncounterOnExisting(exactMatch)}
              className="flex items-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-xs font-black shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
            >
              <Flame className="w-4 h-4 fill-white" />
              Registrar Novo Encontro (+1)
            </button>

            <button
              onClick={() => onViewExisting(exactMatch)}
              className="flex items-center gap-1.5 px-4 py-3 bg-dark-card hover:bg-dark-border text-slate-200 border border-dark-border rounded-full text-xs font-bold transition-colors"
            >
              <Eye className="w-4 h-4 text-slate-400" />
              Ver no Banco
            </button>

            <button
              onClick={onDiscard}
              className="px-4 py-3 text-xs text-slate-400 hover:text-white font-bold transition-colors ml-auto"
            >
              Descartar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. MORPHOLOGICAL VARIANT / INFLECTION CASE (e.g. running -> run)
  if (aiMatch && aiMatch.similarity_type === 'inflection' && existingCandidate) {
    return (
      <div className="bg-dark-card border-2 border-card-amber/50 rounded-[32px] p-6 sm:p-7 shadow-2xl space-y-4 animate-in fade-in duration-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-card-amber/20 border border-card-amber/40 flex items-center justify-center text-card-amber flex-shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-card-amber block mb-1">
              // Variante ou Flexão Identificada
            </span>
            <h3 className="text-xl font-black text-white tracking-tight">
              &ldquo;{inputQuery}&rdquo; é uma flexão de &ldquo;{existingCandidate.content}&rdquo;
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              {aiMatch.explanation || `"${inputQuery}" deriva da palavra base "${existingCandidate.content}", que já existe no seu banco.`}
            </p>
          </div>
        </div>

        {/* Existing Item Card Summary */}
        <div className="bg-dark-bg rounded-2xl p-4 border border-dark-border flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400 block text-[11px] font-mono">Palavra base no banco:</span>
            <strong className="text-white text-base font-black">{existingCandidate.content}</strong>
            <span className="text-slate-400 ml-2 font-mono">({existingCandidate.source === 'base' ? `Base #${existingCandidate.original_order}` : 'Inbox'})</span>
          </div>
          <button
            onClick={() => onViewExisting(existingCandidate)}
            className="text-xs font-mono text-card-lime hover:underline font-bold flex items-center gap-1"
          >
            Ver Detalhes <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            onClick={() => onRegisterEncounterOnExisting(existingCandidate)}
            className="flex items-center gap-1.5 px-5 py-3 bg-card-amber hover:bg-card-amberDark text-dark-bg rounded-full text-xs font-black shadow-lg shadow-card-amber/10 active:scale-95 transition-all"
          >
            <Flame className="w-4 h-4 fill-dark-bg" />
            Registrar encontro em &ldquo;{existingCandidate.content}&rdquo;
          </button>

          <button
            onClick={onAddNewAnyway}
            className="flex items-center gap-1.5 px-4 py-3 bg-dark-card hover:bg-dark-border text-slate-200 border border-dark-border rounded-full text-xs font-bold transition-colors"
          >
            <Plus className="w-4 h-4 text-slate-400" />
            Adicionar &ldquo;{inputQuery}&rdquo; separado
          </button>

          <button
            onClick={onDiscard}
            className="px-4 py-3 text-xs text-slate-400 hover:text-white font-bold transition-colors ml-auto"
          >
            Descartar
          </button>
        </div>
      </div>
    );
  }

  // 3. SEMANTIC SIMILARITY (e.g. Where's the bathroom? vs Where is the restroom?)
  if (aiMatch && aiMatch.similarity_type === 'semantic_similarity' && existingCandidate) {
    return (
      <div className="bg-dark-card border-2 border-card-lime/50 rounded-[32px] p-6 sm:p-7 shadow-2xl space-y-4 animate-in fade-in duration-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-card-lime/20 border border-card-lime/40 flex items-center justify-center text-card-lime flex-shrink-0">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-card-lime block mb-1">
              // Frase Semelhante Encontrada
            </span>
            <h3 className="text-xl font-black text-white tracking-tight">
              Função comunicativa equivalente no banco
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              {aiMatch.explanation || 'As frases têm função comunicativa semelhante, mas não são idênticas.'}
            </p>
          </div>
        </div>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-dark-bg p-4 rounded-2xl border border-dark-border">
            <span className="text-[10px] font-mono font-bold text-card-lime block mb-1">NOVA ENTRADA:</span>
            <p className="text-sm font-bold text-white">&ldquo;{inputQuery}&rdquo;</p>
          </div>
          <div className="bg-dark-bg p-4 rounded-2xl border border-dark-border">
            <span className="text-[10px] font-mono font-bold text-slate-400 block mb-1">JÁ NO BANCO:</span>
            <p className="text-sm font-bold text-white">&ldquo;{existingCandidate.content}&rdquo;</p>
            {existingCandidate.meaning_pt && (
              <p className="text-xs text-slate-400 mt-0.5">{existingCandidate.meaning_pt}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            onClick={onAddNewAnyway}
            className="flex items-center gap-1.5 px-5 py-3 bg-card-lime hover:bg-card-limeDark text-dark-bg rounded-full text-xs font-black shadow-lg shadow-card-lime/10 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 text-dark-bg" />
            Adicionar Mesmo Assim
          </button>

          <button
            onClick={() => onViewExisting(existingCandidate)}
            className="flex items-center gap-1.5 px-4 py-3 bg-dark-card hover:bg-dark-border text-slate-200 border border-dark-border rounded-full text-xs font-bold transition-colors"
          >
            <Eye className="w-4 h-4 text-slate-400" />
            Ver Existente
          </button>

          <button
            onClick={onDiscard}
            className="px-4 py-3 text-xs text-slate-400 hover:text-white font-bold transition-colors ml-auto"
          >
            Descartar
          </button>
        </div>
      </div>
    );
  }

  return null;
}
