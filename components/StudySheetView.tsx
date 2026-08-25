'use client';

import React, { useState } from 'react';
import { StudySheet, ContentType } from '../lib/types';
import { 
  Volume2, 
  Copy, 
  Check, 
  Lightbulb, 
  AlertTriangle, 
  BookOpen, 
  Layers, 
  Sparkles,
  Share2
} from 'lucide-react';

interface StudySheetViewProps {
  sheet: StudySheet;
  number?: number;
  onClose?: () => void;
}

export function StudySheetView({ sheet, number }: StudySheetViewProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const speak = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const copyFullSheet = () => {
    let text = `${number ? `${number}. ` : ''}${sheet.term}\n\n`;
    text += `Pronúncia: ${sheet.ipa}\n`;
    text += `Classe gramatical: ${sheet.grammatical_class}\n`;
    text += `Tradução: ${sheet.translation}\n\n`;
    if (sheet.connotation_usage) text += `${sheet.connotation_usage}\n\n`;
    
    if (sheet.useful_structures && sheet.useful_structures.length > 0) {
      text += `Estruturas úteis:\n${sheet.useful_structures.join('\n')}\n\n`;
    }

    text += `4 colocações comuns:\n\n`;
    sheet.collocations.forEach(c => {
      text += `${c.en} — ${c.pt}\n`;
    });

    text += `\n5 exemplos:\n\n`;
    sheet.examples.forEach(e => {
      text += `${e.en} — ${e.pt}\n`;
    });

    if (sheet.related_words && sheet.related_words.length > 0) {
      text += `\nPalavras relacionadas:\n${sheet.related_words.join(', ')}\n\n`;
    }

    if (sheet.tip_warning) {
      text += `${sheet.tip_warning}\n`;
    }

    copyText(text, 'full_sheet');
  };

  return (
    <div className="bg-[#12151c] border-2 border-[#232936] rounded-[32px] p-6 sm:p-8 text-slate-200 shadow-2xl space-y-6 animate-in fade-in duration-200 font-sans">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#232936] flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {number ? `${number}. ` : ''}{sheet.term}
            </h2>

            <button
              onClick={() => speak(sheet.term)}
              className="w-9 h-9 rounded-full bg-card-lime text-dark-bg flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md"
              title="Ouvir pronúncia"
            >
              <Volume2 className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs font-mono pt-1">
            <span className="bg-dark-bg text-card-lime px-3 py-1 rounded-full border border-card-lime/30 font-bold">
              Pronúncia: {sheet.ipa}
            </span>
            <span className="bg-dark-bg text-card-pink px-3 py-1 rounded-full border border-card-pink/30 font-bold">
              Classe: {sheet.grammatical_class}
            </span>
            <span className="bg-dark-bg text-white px-3 py-1 rounded-full border border-slate-700 font-semibold">
              Tradução: <strong className="text-card-lime">{sheet.translation}</strong>
            </span>
          </div>
        </div>

        <button
          onClick={copyFullSheet}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-dark-bg hover:bg-[#1a1e27] text-card-lime border border-card-lime/30 text-xs font-mono font-bold transition-all active:scale-95"
        >
          {copiedSection === 'full_sheet' ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              Ficha Copiada!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copiar Ficha Completa
            </>
          )}
        </button>
      </div>

      {/* Usage & Connotation Note */}
      {sheet.connotation_usage && (
        <div className="text-xs sm:text-sm text-slate-300 bg-dark-bg p-4 rounded-2xl border border-[#232936] leading-relaxed">
          <strong className="text-card-lime font-bold block mb-0.5 font-mono text-xs uppercase tracking-wider">
            // Uso & Particularidades
          </strong>
          {sheet.connotation_usage}
        </div>
      )}

      {/* Useful Structures if any */}
      {sheet.useful_structures && sheet.useful_structures.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-card-amber uppercase tracking-wider block">
            Estruturas úteis:
          </span>
          <div className="grid grid-cols-1 gap-2">
            {sheet.useful_structures.map((str, idx) => (
              <div key={idx} className="p-3 bg-dark-bg rounded-xl border border-[#232936] text-xs font-mono text-slate-200">
                {str}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 Collocations (Chunks) */}
      <div className="space-y-3">
        <span className="text-xs font-mono font-bold text-card-pink uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-card-pink" />
          4 Colocações Comuns (Chunks):
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {sheet.collocations.map((c, idx) => (
            <div 
              key={idx} 
              className="p-3.5 bg-dark-bg rounded-2xl border border-[#232936] hover:border-card-pink/40 flex items-center justify-between gap-2 text-xs transition-colors group"
            >
              <div>
                <span className="font-bold text-white block text-sm group-hover:text-card-pink transition-colors">
                  {c.en}
                </span>
                <span className="text-slate-400 text-xs">
                  — {c.pt}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => speak(c.en)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1f2430] transition-colors"
                  title="Ouvir"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => copyText(`${c.en} — ${c.pt}`, `colloc_${idx}`)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-card-pink hover:bg-[#1f2430] transition-colors"
                  title="Copiar colocação"
                >
                  {copiedSection === `colloc_${idx}` ? (
                    <Check className="w-3.5 h-3.5 text-card-lime" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5 Real Examples */}
      <div className="space-y-3">
        <span className="text-xs font-mono font-bold text-card-lime uppercase tracking-wider flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-card-lime" />
          5 Exemplos Reais para Anki:
        </span>
        <div className="space-y-2">
          {sheet.examples.map((ex, idx) => (
            <div 
              key={idx} 
              className="p-3.5 bg-dark-bg rounded-2xl border border-[#232936] hover:border-card-lime/40 flex items-center justify-between gap-3 text-xs transition-colors group"
            >
              <div className="space-y-0.5 flex-1">
                <div className="font-bold text-sm text-white leading-snug group-hover:text-card-lime transition-colors">
                  {ex.en}
                </div>
                <div className="text-slate-400 text-xs font-medium">
                  — {ex.pt}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => speak(ex.en)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1f2430] transition-colors"
                  title="Ouvir frase"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => copyText(`${ex.en} — ${ex.pt}`, `ex_${idx}`)}
                  className="p-2 rounded-xl text-slate-400 hover:text-card-lime hover:bg-[#1f2430] transition-colors"
                  title="Copiar frase completa"
                >
                  {copiedSection === `ex_${idx}` ? (
                    <Check className="w-4 h-4 text-card-lime stroke-[3]" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Related Words */}
      {sheet.related_words && sheet.related_words.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
            Palavras relacionadas:
          </span>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {sheet.related_words.map((w, idx) => (
              <span 
                key={idx}
                className="px-3 py-1 rounded-full bg-dark-bg text-slate-300 border border-[#232936] font-medium"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Canonical Anki Card Model */}
      <div className="pt-2 border-t border-[#232936] space-y-3">
        <span className="text-xs font-mono font-bold text-card-lime uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-card-lime" />
          Modelo de Card Canônico para Anki (Tipo Basic):
        </span>

        {(() => {
          const isPv = sheet.grammatical_class.toLowerCase().includes('phrasal');
          const isPhrase = sheet.grammatical_class.toLowerCase().includes('frase') || sheet.term.includes(' ');
          const firstEx = sheet.examples[0] || { en: sheet.term, pt: sheet.translation };

          let cardFront = '';
          let cardBack = '';

          if (isPv) {
            const pvMeaning = sheet.translation.split(';')[0].split(',')[0].trim();
            cardFront = firstEx.en.replace(new RegExp(`\\b${sheet.term}\\b`, 'i'), `(PV: ${pvMeaning})`);
            if (!cardFront.includes('(PV:')) {
              cardFront = `I need to (PV: ${pvMeaning}) this.`;
            }
            cardBack = `${sheet.term} ${sheet.ipa}\n${firstEx.en}`;
          } else if (isPhrase) {
            const words = firstEx.en.split(' ');
            const gapSentence = words.length > 3 
              ? words.slice(0, -2).join(' ') + ` (..?)?` 
              : `${firstEx.en} (..?)`;
            cardFront = `${gapSentence}\n${sheet.translation}`;
            cardBack = `${firstEx.en}`;
          } else {
            const vocabMeaning = sheet.translation.split(',')[0].split('/')[0].trim();
            cardFront = firstEx.en.replace(new RegExp(`\\b${sheet.term}\\b`, 'i'), `(${vocabMeaning})`);
            if (!cardFront.includes('(')) {
              cardFront = `I need (${vocabMeaning}) today.`;
            }
            cardBack = `${sheet.term} ${sheet.ipa}\n${firstEx.en}`;
          }

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Frente */}
              <div className="p-4 bg-dark-bg rounded-2xl border border-[#232936] space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-card-pink uppercase tracking-wider block mb-1">
                    FRENTE DO CARD:
                  </span>
                  <p className="text-sm font-bold text-white whitespace-pre-line leading-snug">
                    {cardFront}
                  </p>
                </div>

                <button
                  onClick={() => copyText(cardFront, 'card_front')}
                  className="mt-3 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-card-pink/10 hover:bg-card-pink/20 text-card-pink text-xs font-mono font-bold transition-colors w-full"
                >
                  {copiedSection === 'card_front' ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      Frente Copiada!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar Frente
                    </>
                  )}
                </button>
              </div>

              {/* Verso */}
              <div className="p-4 bg-dark-bg rounded-2xl border border-[#232936] space-y-2 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-card-lime uppercase tracking-wider block mb-1">
                    VERSO DO CARD:
                  </span>
                  <p className="text-sm font-medium text-slate-200 whitespace-pre-line leading-snug">
                    {cardBack}
                  </p>
                </div>

                <button
                  onClick={() => copyText(cardBack, 'card_back')}
                  className="mt-3 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-card-lime/10 hover:bg-card-lime/20 text-card-lime text-xs font-mono font-bold transition-colors w-full"
                >
                  {copiedSection === 'card_back' ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      Verso Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar Verso
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Tip / Warning Callout */}
      {sheet.tip_warning && (
        <div className="p-4 rounded-2xl bg-card-amber/10 border border-card-amber/30 text-xs text-card-amber leading-relaxed font-medium space-y-1">
          {sheet.tip_warning}
        </div>
      )}
    </div>
  );
}

