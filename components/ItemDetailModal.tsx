'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ContentItem, Encounter, StudySheet } from '../lib/types';
import { getItemEncounters } from '../lib/db';
import { ApiClientError, getStudySheetWithOpenRouter, prefetchStudySheetWithOpenRouter } from '../lib/openrouter';
import { getNextQueueItem } from '../lib/study-navigation';
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
  /** Retained for callers that update an item from another modal action. */
  onItemUpdated?: (item: ContentItem) => void;
  onOpenEncounterModal?: (item: ContentItem) => void;
  onToggleAnki?: (item: ContentItem) => Promise<ContentItem>;
  readOnly?: boolean;
  queueItems?: ContentItem[];
  onSelectNextItem?: (nextItem: ContentItem) => void;
}

export function ItemDetailModal({
  item,
  isOpen,
  onClose,
  onOpenEncounterModal,
  onToggleAnki,
  readOnly = false,
  queueItems = [],
  onSelectNextItem
}: ItemDetailModalProps) {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [sheet, setSheet] = useState<StudySheet | null>(null);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetRequestId, setSheetRequestId] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [autoAdvanceFeedback, setAutoAdvanceFeedback] = useState<string | null>(null);
  const [isSavingAnki, setIsSavingAnki] = useState(false);
  const feedbackTimerRef = useRef<number | null>(null);
  const itemId = item?.id;
  const itemContent = item?.content || '';
  const itemType = item?.type || 'vocabulary';
  const itemMeaning = item?.meaning_pt || '';
  const itemExample = item?.example || '';
  const itemIpa = item?.ipa || '';

  useEffect(() => {
    if (!itemId || !isOpen) return;

    let isActive = true;

    getItemEncounters(itemId).then(result => {
      if (isActive) setEncounters(result);
    });
    // Reset the modal's async resource state whenever the selected item changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoadingSheet(true);
    setSheet(null);
    setSheetError(null);
    setSheetRequestId(null);
    getStudySheetWithOpenRouter(itemContent, itemType, itemMeaning, itemExample, itemIpa)
      .then(res => {
        if (!isActive) return;
        setSheet(res);
        if (!res) {
      setSheetError('Não foi possível gerar a ficha deste item. Verifique a API do OpenRouter ou tente novamente.');
        }
      })
      .catch(err => {
        if (!isActive || err?.name === 'AbortError') return;
        console.error('Failed to load study sheet:', err);
        const detail = err instanceof Error ? err.message : '';
        setSheetRequestId(err instanceof ApiClientError ? err.requestId : null);
        setSheetError(detail
          ? `Não foi possível gerar a ficha: ${detail}`
          : 'Não foi possível carregar a ficha deste item. Tente novamente.');
      })
      .finally(() => {
        if (isActive) setIsLoadingSheet(false);
      });

    return () => {
      isActive = false;
    };
  }, [isOpen, itemId, itemContent, itemType, itemMeaning, itemExample, itemIpa, retryNonce]);

  useEffect(() => {
    if (!itemId || !isOpen || readOnly) return;
    const nextQueueItem = getNextQueueItem(queueItems, itemId);
    if (!nextQueueItem) return;

    prefetchStudySheetWithOpenRouter(
      nextQueueItem.content,
      nextQueueItem.type,
      nextQueueItem.meaning_pt || '',
      nextQueueItem.example || '',
      nextQueueItem.ipa || ''
    );
  }, [isOpen, itemId, readOnly, queueItems]);

  useEffect(() => {
    if (!autoAdvanceFeedback) return;
    feedbackTimerRef.current = window.setTimeout(() => {
      feedbackTimerRef.current = null;
      setAutoAdvanceFeedback(null);
    }, 1800);

    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, [autoAdvanceFeedback]);

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
    if (readOnly || !onToggleAnki || isSavingAnki) return;

    const nextItem = item.anki_status === 'created'
      ? null
      : getNextQueueItem(queueItems, item.id);
    setIsSavingAnki(true);

    try {
      const updated = await onToggleAnki(item);

      if (updated.anki_status === 'created' && onSelectNextItem) {
        if (nextItem) {
          setAutoAdvanceFeedback(`Salvo no Anki! Avançando para "${nextItem.content}"...`);
          onSelectNextItem(nextItem);
        } else {
          setAutoAdvanceFeedback(`🎉 Parabéns! Todos os cards da fila foram criados!`);
        }
      }
    } catch (err) {
      console.error('Failed to toggle anki status:', err);
      setAutoAdvanceFeedback('Não foi possível salvar no Anki. Tente novamente.');
    } finally {
      setIsSavingAnki(false);
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
            {!readOnly && onToggleAnki && (
              <button
                onClick={handleToggleAnki}
                disabled={isSavingAnki}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl text-xs font-black transition-all shadow-lg ${
                isCreated
                  ? 'bg-dark-border text-slate-300 hover:bg-slate-700'
                  : 'bg-card-lime text-dark-bg hover:bg-card-limeDark shadow-card-lime/10 active:scale-95'
              } disabled:cursor-wait disabled:opacity-70`}
            >
              {isSavingAnki ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : isCreated ? (
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
            )}

            {!readOnly && onOpenEncounterModal && (
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
            )}

            {readOnly && (
              <div className="w-full rounded-2xl border border-dark-border bg-dark-bg px-4 py-3 text-center text-xs font-mono text-slate-400">
                Histórico somente para consulta
              </div>
            )}
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
            <>
              {sheet.isFallback && (
                <div className="p-4 bg-dark-bg rounded-2xl border border-card-amber/40 text-xs text-card-amber leading-relaxed space-y-3">
                  <p>{sheet.fallbackMessage || 'A ficha está disponível apenas com os dados básicos informados.'}</p>
                  <button
                    type="button"
                    onClick={() => setRetryNonce(value => value + 1)}
                    className="rounded-full bg-card-lime px-4 py-2 text-xs font-black text-dark-bg hover:bg-card-limeDark transition-colors"
                  >
                    Tentar completar a ficha
                  </button>
                </div>
              )}
              <StudySheetView sheet={sheet} number={item.original_order || undefined} />
            </>
          ) : sheetError ? (
            <div className="p-6 bg-dark-bg rounded-3xl border border-card-amber/30 space-y-4">
              <p className="text-xs font-mono text-card-amber leading-relaxed text-center">{sheetError}</p>

              {(item.meaning_pt || item.example || item.notes) && (
                <div className="rounded-2xl border border-dark-border bg-dark-card/50 p-4 space-y-2 text-sm">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Dados já salvos do item</p>
                  {item.meaning_pt && <p><span className="font-bold text-slate-300">Tradução:</span> {item.meaning_pt}</p>}
                  {item.example && <p><span className="font-bold text-slate-300">Contexto:</span> {item.example}</p>}
                  {item.notes && <p><span className="font-bold text-slate-300">Observações:</span> {item.notes}</p>}
                </div>
              )}

              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRetryNonce(value => value + 1)}
                  className="rounded-full bg-card-lime px-5 py-2.5 text-xs font-black text-dark-bg hover:bg-card-limeDark transition-colors"
                >
                  Tentar novamente
                </button>
                {sheetRequestId && (
                  <span className="text-[10px] font-mono text-slate-500">Referência: {sheetRequestId}</span>
                )}
              </div>
            </div>
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
