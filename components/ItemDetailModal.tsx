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
  Copy, 
  BookOpen, 
  ExternalLink,
  Volume2
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
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

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

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Generate suggested manual Anki card format based on canonical rules
  const getAnkiCardSuggestion = () => {
    if (item.type === 'vocabulary' || item.type === 'personal_vocabulary') {
      const clue = item.meaning_pt || 'significado';
      return {
        front: `I need a (${clue}).`,
        back: `${item.content}\n${item.example || `I need a ${item.content}.`}\n🔊 Áudio no verso.`
      };
    } else if (item.type === 'survival_phrase' || item.type === 'personal_phrase') {
      const words = item.content.split(' ');
      const blankIndex = Math.min(2, Math.max(0, words.length - 1));
      const targetWord = words[blankIndex];
      const blankFront = words.map((w, idx) => idx === blankIndex ? '(..?)' : w).join(' ');
      return {
        front: `${blankFront}\n${item.meaning_pt || 'Tradução da frase'}`,
        back: `${item.content}\n🔊 Áudio completo no verso.`
      };
    } else {
      // Phrasal verb
      const meaning = item.meaning_pt || 'significado do PV';
      return {
        front: `I have to (PV: ${meaning}) today.`,
        back: `${item.content} — ${item.content}ing — ${item.content}ed\n${item.example || `I have to ${item.content} today.`}\n🔊 Áudio no verso.`
      };
    }
  };

  const ankiSuggestion = getAnkiCardSuggestion();
  const isCreated = item.anki_status === 'created';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                item.type === 'vocabulary' || item.type === 'personal_vocabulary'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : item.type === 'survival_phrase' || item.type === 'personal_phrase'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {item.type === 'vocabulary' ? 'Vocabulário' : item.type === 'survival_phrase' ? 'Frase de Sobrevivência' : item.type === 'phrasal_verb' ? 'Phrasal Verb' : 'Personal'}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                {item.source === 'base' ? `Base #${item.original_order}` : `Inbox (${item.source})`}
              </span>
              {item.times_encountered > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                  {item.times_encountered} {item.times_encountered === 1 ? 'encontro natural' : 'encontros naturais'}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{item.content}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 divide-y divide-slate-100">
          {/* Quick Info */}
          <div className="space-y-3">
            {item.meaning_pt && (
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Significado / Tradução</span>
                <p className="text-base text-slate-800 font-medium">{item.meaning_pt}</p>
              </div>
            )}

            {item.example && (
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Exemplo em Contexto</span>
                <p className="text-sm text-slate-700 italic bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                  &ldquo;{item.example}&rdquo;
                </p>
              </div>
            )}

            {/* Anki and Encounter Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleToggleAnki}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                  isCreated
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 active:scale-95'
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
                className="flex items-center gap-1.5 py-2.5 px-3.5 rounded-xl text-sm font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                title="Registrar novo encontro natural"
              >
                <Flame className="w-4 h-4 fill-rose-500 text-rose-500" />
                + Encontro
              </button>
            </div>
          </div>

          {/* Encounters History */}
          <div className="pt-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              Histórico de Encontros Naturais ({encounters.length})
            </h3>
            {encounters.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Nenhum encontro adicional registrado ainda.</p>
            ) : (
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {encounters.map((enc) => (
                  <div key={enc.id} className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between font-semibold text-slate-700 mb-0.5">
                      <span className="capitalize">{enc.source} {enc.source_detail ? `• ${enc.source_detail}` : ''}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {new Date(enc.created_at).toLocaleDateString('pt-BR')} {enc.timestamp_marker ? `(${enc.timestamp_marker})` : ''}
                      </span>
                    </div>
                    {enc.context_sentence && (
                      <p className="text-slate-600 italic mt-0.5">&ldquo;{enc.context_sentence}&rdquo;</p>
                    )}
                    {enc.notes && (
                      <p className="text-slate-500 text-[11px] mt-0.5">Obs: {enc.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual Anki Flashcard Format Guide */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-600" />
                Guia Canônico para Flashcard Manual
              </h3>
              <button
                onClick={() => copyToClipboard(`FRENTE:\n${ankiSuggestion.front}\n\nVERSO:\n${ankiSuggestion.back}`, 'card')}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                {copiedSection === 'card' ? 'Copiado!' : 'Copiar Modelo'}
              </button>
            </div>
            
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-3.5 text-xs font-mono space-y-2 border border-slate-800">
              <div>
                <span className="text-amber-400 font-bold block">FRENTE:</span>
                <p className="text-slate-200 whitespace-pre-line">{ankiSuggestion.front}</p>
              </div>
              <div className="border-t border-slate-800 pt-2">
                <span className="text-emerald-400 font-bold block">VERSO:</span>
                <p className="text-slate-200 whitespace-pre-line">{ankiSuggestion.back}</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              💡 <strong>Regra de ouro:</strong> Áudio sempre no verso. 1 único alvo por card. Frase curta (5–7 palavras).
            </p>
          </div>

          {/* Gemini Flash Language Assistant */}
          <div className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Assistente Linguístico Gemini Flash
              </h3>
              {!aiAnalysis && (
                <button
                  onClick={handleRunAiAnalysis}
                  disabled={isAnalyzing}
                  className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isAnalyzing ? 'Analisando...' : 'Analisar com IA'}
                </button>
              )}
            </div>

            {aiAnalysis && (
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3.5 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-900">Classificação: {aiAnalysis.classification}</span>
                  <span className="text-indigo-600 font-medium">Base: {aiAnalysis.base_form}</span>
                </div>
                {aiAnalysis.meaning_pt && (
                  <p className="text-slate-700"><strong>Significado:</strong> {aiAnalysis.meaning_pt}</p>
                )}
                <p className="text-slate-700">{aiAnalysis.explanation}</p>
                {aiAnalysis.suggested_example && (
                  <p className="text-indigo-800 italic bg-white/80 p-2 rounded-lg border border-indigo-200/50">
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
