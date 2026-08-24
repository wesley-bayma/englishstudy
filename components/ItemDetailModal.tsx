'use client';

import React, { useState, useEffect } from 'react';
import { ContentItem, Encounter, GeminiAnalysisResult } from '../lib/types';
import { getItemEncounters, toggleAnkiStatus } from '../lib/db';
import { analyzeWithGemini } from '../lib/gemini';
import { 
  X, 
  Flame, 
  Check, 
  RotateCcw, 
  Calendar, 
  Sparkles, 
  BookOpen
} from 'lucide-react';

interface ItemDetailModalProps {
  item: ContentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onItemUpdated: (item: ContentItem) => void;
  onOpenEncounterModal: (item: ContentItem) => void;
}

export function ItemDetailModal({
  item,
  isOpen,
  onClose,
  onItemUpdated,
  onOpenEncounterModal
}: ItemDetailModalProps) {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<GeminiAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (item && isOpen) {
      getItemEncounters(item.id).then(setEncounters);
      setAiAnalysis(null);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleToggleAnki = async () => {
    try {
      const newStatus = await toggleAnkiStatus(item.id);
      const updated = { ...item, anki_status: newStatus, anki_created_at: newStatus === 'created' ? new Date().toISOString() : null };
      onItemUpdated(updated);
    } catch (err) {
      console.error('Failed to toggle anki status:', err);
    }
  };

  const handleRunAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await analyzeWithGemini(item.content, [], item.example || '');
      setAiAnalysis(res);
    } catch (err) {
      console.error('AI Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isCreated = item.anki_status === 'created';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-bg/85 backdrop-blur-xl animate-in fade-in duration-150">
      <div className="bg-dark-card rounded-[32px] w-full max-w-xl shadow-2xl border border-dark-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-dark-border flex items-start justify-between bg-dark-bg/40">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-xs font-mono font-bold px-3 py-0.5 rounded-full ${
                item.type === 'vocabulary' || item.type === 'personal_vocabulary'
                  ? 'bg-card-pink text-dark-bg'
                  : item.type === 'survival_phrase' || item.type === 'personal_phrase'
                    ? 'bg-card-lime text-dark-bg'
                    : 'bg-card-amber text-dark-bg'
              }`}>
                {item.type === 'vocabulary' ? 'Vocabulário' : item.type === 'survival_phrase' ? 'Frase' : 'Phrasal Verb'}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-dark-border text-slate-300">
                {item.source === 'base' ? `Base #${item.original_order}` : `Inbox (${item.source})`}
              </span>
              {item.times_encountered > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1 font-mono">
                  <Flame className="w-3.5 h-3.5 fill-white" />
                  {item.times_encountered}x encontros
                </span>
              )}
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">{item.content}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-dark-border transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 divide-y divide-dark-border">
          {/* Quick Info & Action Buttons */}
          <div className="space-y-4">
            {item.meaning_pt && (
              <div>
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">Significado / Tradução</span>
                <p className="text-lg text-slate-100 font-semibold">{item.meaning_pt}</p>
              </div>
            )}

            {/* Toggle Anki and Add Encounter Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleToggleAnki}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs font-black transition-all ${
                  isCreated
                    ? 'bg-dark-border text-slate-300 hover:bg-slate-700'
                    : 'bg-card-lime text-dark-bg hover:bg-card-limeDark shadow-lg shadow-card-lime/10 active:scale-95'
                }`}
              >
                {isCreated ? (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Marcado no Anki (Desmarcar)
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    Marcar como Criado no Anki
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenEncounterModal(item);
                }}
                className="flex items-center gap-1.5 py-3 px-4 rounded-2xl text-xs font-bold bg-dark-card text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 transition-colors"
              >
                <Flame className="w-4 h-4 fill-rose-500 text-rose-500" />
                + Encontro
              </button>
            </div>
          </div>

          {/* Encounters History */}
          <div className="pt-5">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              Histórico de Encontros Naturais ({encounters.length})
            </h3>
            {encounters.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Nenhum encontro adicional registrado.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {encounters.map((enc) => (
                  <div key={enc.id} className="text-xs bg-dark-bg p-3 rounded-2xl border border-dark-border">
                    <div className="flex items-center justify-between font-bold text-slate-200 mb-0.5">
                      <span className="capitalize">{enc.source} {enc.source_detail ? `• ${enc.source_detail}` : ''}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(enc.created_at).toLocaleDateString('pt-BR')} {enc.timestamp_marker ? `(${enc.timestamp_marker})` : ''}
                      </span>
                    </div>
                    {enc.context_sentence && (
                      <p className="text-slate-300 italic mt-0.5">&ldquo;{enc.context_sentence}&rdquo;</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gemini Flash Assistant */}
          <div className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-card-lime" />
                Consultar com Gemini Flash
              </h3>
              {!aiAnalysis && (
                <button
                  onClick={handleRunAiAnalysis}
                  disabled={isAnalyzing}
                  className="px-3 py-1 bg-dark-bg hover:bg-dark-border text-card-lime border border-card-lime/30 rounded-full text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isAnalyzing ? 'Analisando...' : 'Analisar Significado'}
                </button>
              )}
            </div>

            {aiAnalysis && (
              <div className="bg-dark-bg border border-dark-border rounded-2xl p-4 text-xs space-y-2 font-mono">
                <p className="text-slate-200">{aiAnalysis.explanation}</p>
                {aiAnalysis.suggested_example && (
                  <p className="text-card-lime italic p-2 bg-dark-card rounded-xl border border-dark-border">
                    &ldquo;{aiAnalysis.suggested_example}&rdquo;
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
