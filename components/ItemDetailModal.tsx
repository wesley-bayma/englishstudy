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
  const [sheet, setSheet] = useState<StudySheet | null>(null);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);

  useEffect(() => {
    if (item && isOpen) {
      getItemEncounters(item.id).then(setEncounters);
      setIsLoadingSheet(true);
      getStudySheetWithGemini(item.content, item.type, item.meaning_pt || '')
        .then(res => setSheet(res))
        .catch(err => console.error('Failed to load study sheet:', err))
        .finally(() => setIsLoadingSheet(false));
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

  const isCreated = item.anki_status === 'created';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-bg/85 backdrop-blur-xl animate-in fade-in duration-150">
      <div className="bg-dark-card rounded-[32px] w-full max-w-2xl shadow-2xl border border-dark-border overflow-hidden flex flex-col max-h-[92vh]">
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
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Action Row */}
          <div className="flex items-center gap-3">
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

          {/* Full Pedagogical Study Sheet */}
          {isLoadingSheet ? (
            <div className="p-8 text-center bg-dark-bg rounded-3xl border border-dark-border space-y-2">
              <Sparkles className="w-6 h-6 animate-spin text-card-lime mx-auto" />
              <p className="text-xs font-mono text-slate-400">
                Carregando ficha de estudo completa (Pronúncia, 4 colocações, 5 exemplos)...
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
