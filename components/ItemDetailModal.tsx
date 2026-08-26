'use client';

import React, { useState, useEffect } from 'react';
import { ContentItem, Encounter, StudySheet } from '../lib/types';
import { getItemEncounters, toggleAnkiStatus } from '../lib/db';
import { getStudySheetWithGemini } from '../lib/gemini';
import { StudySheetView } from './StudySheetView';
import { 
  X, 
  Flame, 
  Check, 
  RotateCcw, 
  Calendar, 
  Sparkles, 
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ArrowRight
} from 'lucide-react';

interface ItemDetailModalProps {
  item: ContentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onItemUpdated: (item: ContentItem) => void;
  onOpenEncounterModal: (item: ContentItem) => void;
  queueItems?: ContentItem[];
  onSelectNextItem?: (nextItem: ContentItem) => void;
}

export function ItemDetailModal({
  item,
  isOpen,
  onClose,
  onItemUpdated,
  onOpenEncounterModal,
  queueItems = [],
  onSelectNextItem
}: ItemDetailModalProps) {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [sheet, setSheet] = useState<StudySheet | null>(null);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [autoAdvanceFeedback, setAutoAdvanceFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (item && isOpen) {
      getItemEncounters(item.id).then(setEncounters);
      setIsLoadingSheet(true);
      setSheet(null);
      getStudySheetWithGemini(item.content, item.type, item.meaning_pt || '')
        .then(res => setSheet(res))
        .catch(err => console.error('Failed to load study sheet:', err))
        .finally(() => setIsLoadingSheet(false));
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const currentIndex = queueItems.findIndex(i => i.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < queueItems.length - 1;

  const handlePrev = () => {
    if (hasPrev && onSelectNextItem) {
      onSelectNextItem(queueItems[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onSelectNextItem) {
      onSelectNextItem(queueItems[currentIndex + 1]);
    }
  };

  const handleToggleAnki = async () => {
    try {
      const newStatus = await toggleAnkiStatus(item.id);
      const updated = { 
        ...item, 
        anki_status: newStatus, 
        anki_created_at: newStatus === 'created' ? new Date().toISOString() : null 
      };
      onItemUpdated(updated);

      // AUTO-ADVANCE: If marking as created and there are next items, automatically advance!
      if (newStatus === 'created' && onSelectNextItem) {
        // Find next pending item first, or next item in sequence
        const nextPending = queueItems.find((qItem, idx) => idx > currentIndex && qItem.anki_status !== 'created');
        const nextItem = nextPending || (hasNext ? queueItems[currentIndex + 1] : null);

        if (nextItem) {
          setAutoAdvanceFeedback(`Salvo no Anki! Avançando para "${nextItem.content}"...`);
          setTimeout(() => {
            setAutoAdvanceFeedback(null);
            onSelectNextItem(nextItem);
          }, 600);
        } else {
          setAutoAdvanceFeedback(`🎉 Parabéns! Todos os cards da fila foram criados!`);
          setTimeout(() => setAutoAdvanceFeedback(null), 2500);
        }
      }
    } catch (err) {
      console.error('Failed to toggle anki status:', err);
    }
  };

  const isCreated = item.anki_status === 'created';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-bg/85 backdrop-blur-xl animate-in fade-in duration-150">
      <div className="bg-dark-card rounded-[32px] w-full max-w-2xl shadow-2xl border border-dark-border overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-dark-border flex items-center justify-between bg-dark-bg/40 gap-3">
          <div className="flex items-center gap-3">
            {/* Sequential Navigator */}
            {queueItems.length > 1 && (
              <div className="flex items-center gap-1 bg-dark-bg px-2.5 py-1 rounded-full border border-dark-border">
                <button
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="p-1 rounded-full text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                  title="Card anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold text-card-lime px-1">
                  {currentIndex >= 0 ? `${currentIndex + 1} / ${queueItems.length}` : ''}
                </span>
                <button
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="p-1 rounded-full text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
                  title="Próximo card"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full ${
                  item.type === 'vocabulary' || item.type === 'personal_vocabulary'
                    ? 'bg-card-pink text-dark-bg'
                    : item.type === 'survival_phrase' || item.type === 'personal_phrase'
                      ? 'bg-card-lime text-dark-bg'
                      : 'bg-card-amber text-dark-bg'
                }`}>
                  {item.type === 'vocabulary' ? 'Vocabulário' : item.type === 'survival_phrase' ? 'Frase' : 'Phrasal Verb'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-dark-border text-slate-300">
                  {item.source === 'base' ? `Base #${item.original_order}` : `Inbox (${item.source})`}
                </span>
                {item.times_encountered > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1 font-mono">
                    <Flame className="w-3 h-3 fill-white" />
                    {item.times_encountered}x
                  </span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">{item.content}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-dark-border transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auto-Advance Notification Banner */}
        {autoAdvanceFeedback && (
          <div className="bg-card-lime text-dark-bg px-6 py-2.5 text-xs font-black flex items-center justify-between animate-in slide-in-from-top duration-200">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 stroke-[3]" />
              {autoAdvanceFeedback}
            </span>
            <Sparkles className="w-4 h-4 animate-spin" />
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Action Row */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleAnki}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl text-xs font-black transition-all shadow-lg ${
                isCreated
                  ? 'bg-dark-border text-slate-300 hover:bg-slate-700'
                  : 'bg-card-lime text-dark-bg hover:bg-card-limeDark shadow-card-lime/10 active:scale-95'
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
                  Já criei no Anki ➔ Avançar
                </>
              )}
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenEncounterModal(item);
              }}
              className="flex items-center gap-1.5 py-3.5 px-4 rounded-2xl text-xs font-bold bg-dark-card text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 transition-colors"
            >
              <Flame className="w-4 h-4 fill-rose-500 text-rose-500" />
              + Encontro
            </button>
          </div>

          {/* Full Pedagogical Study Sheet */}
          {isLoadingSheet ? (
            <div className="p-8 text-center bg-dark-bg rounded-3xl border border-dark-border space-y-2">
              <Sparkles className="w-6 h-6 animate-spin text-card-lime mx-auto" />
              <p className="text-xs font-mono text-slate-400">
                Carregando ficha de estudo completa (Pronúncia, padrão comunicativo, exemplos)...
              </p>
            </div>
          ) : sheet ? (
            <StudySheetView sheet={sheet} number={item.original_order || undefined} />
          ) : null}

          {/* Encounters History */}
          {encounters.length > 0 && (
            <div className="pt-4 border-t border-dark-border">
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                Histórico de Encontros Naturais ({encounters.length})
              </h3>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
