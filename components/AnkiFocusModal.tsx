'use client';

import React, { useState } from 'react';
import { ContentItem } from '../lib/types';
import { generateAnkiCardData, FormattedAnkiCard } from '../lib/card-generator';
import confetti from 'canvas-confetti';
import { 
  X, 
  Copy, 
  Check, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight, 
  Sparkles, 
  BookOpen, 
  Volume2, 
  Flame, 
  Lightbulb,
  SkipForward
} from 'lucide-react';

interface AnkiFocusModalProps {
  items: ContentItem[];
  isOpen: boolean;
  onClose: () => void;
  onMarkCreated: (item: ContentItem) => Promise<void>;
  onSkipItem: (item: ContentItem) => Promise<void>;
}

export function AnkiFocusModal({
  items,
  isOpen,
  onClose,
  onMarkCreated,
  onSkipItem
}: AnkiFocusModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!isOpen || items.length === 0) return null;

  const currentItem = items[currentIndex] || items[0];
  const cardData = generateAnkiCardData(currentItem);
  const isCreated = currentItem.anki_status === 'created';
  const progressPercent = Math.round(((currentIndex + 1) / items.length) * 100);

  const copyText = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleNext = async (markAsDone: boolean = false) => {
    if (markAsDone && !isCreated) {
      await onMarkCreated(currentItem);
    }

    if (currentIndex < items.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Completed all
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 }
      });
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSkip = async () => {
    await onSkipItem(currentItem);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {currentIndex + 1}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Criar Card no Anki ({currentIndex + 1} de {items.length})
              </h2>
              <span className="text-[11px] text-slate-500 font-medium">
                Copie a Frente e o Verso diretamente para o seu deck
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-1.5">
          <div
            className="bg-blue-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Card Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Target & Badges Header */}
          <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                currentItem.type === 'vocabulary' || currentItem.type === 'personal_vocabulary'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : currentItem.type === 'survival_phrase' || currentItem.type === 'personal_phrase'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {currentItem.type === 'vocabulary' ? 'Vocabulário' : currentItem.type === 'survival_phrase' ? 'Frase' : 'Phrasal Verb'}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {currentItem.source === 'base' ? `Base #${currentItem.original_order}` : 'Inbox'}
              </span>
            </div>

            {isCreated && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                Já Marcado no Anki
              </span>
            )}
          </div>

          {/* FRONT PREVIEW */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 relative group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                Frente do Card (Front)
              </span>
              <button
                onClick={() => copyText(cardData.front, 'front')}
                className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 shadow-sm transition-all active:scale-95"
              >
                {copiedSection === 'front' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    Copiar Frente
                  </>
                )}
              </button>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 whitespace-pre-line select-all">
              {cardData.front}
            </div>
          </div>

          {/* BACK PREVIEW */}
          <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-200/80 space-y-2 relative group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Verso do Card (Back)
              </span>
              <button
                onClick={() => copyText(cardData.back, 'back')}
                className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 shadow-sm transition-all active:scale-95"
              >
                {copiedSection === 'back' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    Copiar Verso
                  </>
                )}
              </button>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 whitespace-pre-line select-all">
              {cardData.back}
            </div>
          </div>

          {/* EXPLANATION & PEDAGOGICAL TIPS */}
          <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 space-y-2.5 border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
              <Lightbulb className="w-4 h-4" />
              Explicação & Regras Canônicas
            </div>
            <p className="text-slate-300 leading-relaxed">
              {cardData.explanation}
            </p>
            <p className="text-slate-400 text-[11px] border-t border-slate-800 pt-2">
              💡 <strong>Dica de Recuperação Ativa:</strong> {cardData.pedagogicalTip}
            </p>
          </div>
        </div>

        {/* Footer Navigation & Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Anterior
            </button>

            <button
              onClick={handleSkip}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors"
              title="Pular este item e trazer outro"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Pular
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => copyText(cardData.copyFull, 'all')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              {copiedSection === 'all' ? 'Copiado Tudo!' : 'Copiar Tudo'}
            </button>

            <button
              onClick={() => handleNext(true)}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              {currentIndex === items.length - 1 ? 'Concluir Todos' : 'Já Criei & Próximo'}
              {currentIndex < items.length - 1 && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
