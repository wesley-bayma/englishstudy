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
      <div className="bg-rose-50/90 border-2 border-rose-200 rounded-3xl p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 block mb-0.5">
              Correspondência Exata Encontrada
            </span>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              &ldquo;{exactMatch.content}&rdquo; já existe no seu banco
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Origem: <strong className="text-slate-800">{exactMatch.source === 'base' ? `Base #${exactMatch.original_order}` : `Inbox (${exactMatch.source})`}</strong> • 
              Tipo: <strong className="text-slate-800 capitalize">{exactMatch.type.replace('_', ' ')}</strong> • 
              Status no Anki: <strong className={exactMatch.anki_status === 'created' ? 'text-emerald-700' : 'text-amber-700'}>
                {exactMatch.anki_status === 'created' ? '✅ Já criado' : '⏳ Ainda não criado'}
              </strong>
            </p>
          </div>
        </div>

        {/* Action options */}
        <div className="bg-white/80 rounded-2xl p-4 border border-rose-100 space-y-2">
          <p className="text-xs text-slate-600 font-medium">
            Em vez de duplicar, você pode registrar que encontrou este termo novamente na prática:
          </p>

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <button
              onClick={() => onRegisterEncounterOnExisting(exactMatch)}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 active:scale-95 transition-all"
            >
              <Flame className="w-4 h-4 fill-white" />
              Registrar Novo Encontro (+1)
            </button>

            <button
              onClick={() => onViewExisting(exactMatch)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <Eye className="w-4 h-4 text-slate-500" />
              Ver Item no Banco
            </button>

            <button
              onClick={onDiscard}
              className="px-3 py-2.5 text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors ml-auto"
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
      <div className="bg-amber-50/90 border-2 border-amber-200 rounded-3xl p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block mb-0.5">
              Possível Flexão ou Variante
            </span>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              &ldquo;{inputQuery}&rdquo; é uma flexão de &ldquo;{existingCandidate.content}&rdquo;
            </h3>
            <p className="text-xs text-slate-700 mt-1">
              {aiMatch.explanation || `"${inputQuery}" deriva da palavra base "${existingCandidate.content}", que já existe no seu banco.`}
            </p>
          </div>
        </div>

        {/* Existing Item Card Summary */}
        <div className="bg-white/80 rounded-2xl p-3.5 border border-amber-200/60 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Item já existente:</span>
            <strong className="text-slate-900 text-sm font-bold">{existingCandidate.content}</strong>
            <span className="text-slate-500 ml-2">({existingCandidate.source === 'base' ? `Base #${existingCandidate.original_order}` : 'Inbox'})</span>
          </div>
          <button
            onClick={() => onViewExisting(existingCandidate)}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
          >
            Ver <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* User Decision Actions */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            onClick={() => onRegisterEncounterOnExisting(existingCandidate)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Flame className="w-4 h-4 fill-white" />
            Registrar encontro em &ldquo;{existingCandidate.content}&rdquo;
          </button>

          <button
            onClick={onAddNewAnyway}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <Plus className="w-4 h-4 text-slate-500" />
            Adicionar &ldquo;{inputQuery}&rdquo; separadamente
          </button>

          <button
            onClick={onDiscard}
            className="px-3 py-2.5 text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors ml-auto"
          >
            Descartar
          </button>
        </div>
      </div>
    );
  }

  // 3. SEMANTIC SIMILARITY / PHRASE FUNCTION (e.g. Where's the bathroom? vs Where is the restroom?)
  if (aiMatch && aiMatch.similarity_type === 'semantic_similarity' && existingCandidate) {
    return (
      <div className="bg-yellow-50/90 border-2 border-yellow-200 rounded-3xl p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-yellow-100 border border-yellow-200 flex items-center justify-center text-yellow-700 flex-shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-800 block mb-0.5">
              Frase Semelhante Encontrada
            </span>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              Função comunicativa semelhante no banco
            </h3>
            <p className="text-xs text-slate-700 mt-1">
              {aiMatch.explanation || 'As frases têm função comunicativa semelhante, mas não são idênticas.'}
            </p>
          </div>
        </div>

        {/* Side-by-side phrase comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white/90 p-3.5 rounded-2xl border border-yellow-200/80">
            <span className="text-[11px] font-bold text-yellow-800 block mb-1">NOVA ENTRADA:</span>
            <p className="text-sm font-semibold text-slate-900">&ldquo;{inputQuery}&rdquo;</p>
          </div>
          <div className="bg-white/90 p-3.5 rounded-2xl border border-yellow-200/80">
            <span className="text-[11px] font-bold text-slate-500 block mb-1">JÁ NO BANCO:</span>
            <p className="text-sm font-semibold text-slate-900">&ldquo;{existingCandidate.content}&rdquo;</p>
            {existingCandidate.meaning_pt && (
              <p className="text-xs text-slate-500 mt-0.5">{existingCandidate.meaning_pt}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            onClick={onAddNewAnyway}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 text-white" />
            Adicionar Mesmo Assim
          </button>

          <button
            onClick={() => onViewExisting(existingCandidate)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <Eye className="w-4 h-4 text-slate-500" />
            Ver Existente
          </button>

          <button
            onClick={onDiscard}
            className="px-3 py-2.5 text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors ml-auto"
          >
            Descartar
          </button>
        </div>
      </div>
    );
  }

  return null;
}
