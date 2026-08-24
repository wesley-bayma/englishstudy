'use client';

import React, { useState } from 'react';
import { ContentItem, ContentType, ContentSource } from '../lib/types';
import { generateAnkiCardData } from '../lib/card-generator';
import { 
  Check, 
  RotateCcw, 
  Flame, 
  Clock, 
  Eye, 
  Copy, 
  ArrowRight, 
  Sparkles,
  Volume2,
  SkipForward
} from 'lucide-react';

interface ContentCardProps {
  item: ContentItem;
  index?: number;
  isInDailyQueue?: boolean;
  onMarkCreated?: (item: ContentItem) => void;
  onSkip?: (item: ContentItem) => void;
  onViewDetails?: (item: ContentItem) => void;
  onAddEncounter?: (item: ContentItem) => void;
  highlightMatch?: boolean;
  defaultExpandedCard?: boolean;
}

export function ContentCard({
  item,
  index = 1,
  isInDailyQueue = false,
  onMarkCreated,
  onSkip,
  onViewDetails,
  onAddEncounter,
  highlightMatch = false,
  defaultExpandedCard = false
}: ContentCardProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const ankiData = generateAnkiCardData(item);
  const isCreated = item.anki_status === 'created';

  const copyText = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Color blocking theme matching reference image
  const getCardTheme = (type: ContentType) => {
    if (isCreated) {
      return {
        bg: 'bg-dark-card border-dark-border text-slate-200',
        textColor: 'text-white',
        mutedText: 'text-slate-400',
        subBox: 'bg-dark-bg/70 border-dark-border/80 text-slate-300',
        pill: 'bg-dark-border text-slate-300',
        btnBorder: 'border-slate-600 hover:border-white text-white',
        copyBtn: 'bg-dark-border/60 hover:bg-dark-border text-slate-300',
        accentPill: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
      };
    }

    switch (type) {
      case 'survival_phrase':
      case 'personal_phrase':
        return {
          bg: 'bg-card-lime text-dark-bg border-card-limeDark',
          textColor: 'text-dark-bg',
          mutedText: 'text-dark-bg/80',
          subBox: 'bg-white/70 border-black/10 text-dark-bg',
          pill: 'bg-black text-card-lime',
          btnBorder: 'border-black hover:bg-black hover:text-card-lime text-dark-bg',
          copyBtn: 'bg-black/10 hover:bg-black/20 text-dark-bg',
          accentPill: 'bg-black text-white'
        };
      case 'phrasal_verb':
        return {
          bg: 'bg-card-amber text-dark-bg border-card-amberDark',
          textColor: 'text-dark-bg',
          mutedText: 'text-dark-bg/80',
          subBox: 'bg-white/70 border-black/10 text-dark-bg',
          pill: 'bg-black text-card-amber',
          btnBorder: 'border-black hover:bg-black hover:text-card-amber text-dark-bg',
          copyBtn: 'bg-black/10 hover:bg-black/20 text-dark-bg',
          accentPill: 'bg-black text-white'
        };
      case 'vocabulary':
      default:
        // Alternate between pink, blue and white for variety in vocabulary
        const vocabColors = [
          {
            bg: 'bg-card-pink text-dark-bg border-card-pinkDark',
            textColor: 'text-dark-bg',
            mutedText: 'text-dark-bg/80',
            subBox: 'bg-white/70 border-black/10 text-dark-bg',
            pill: 'bg-black text-card-pink',
            btnBorder: 'border-black hover:bg-black hover:text-card-pink text-dark-bg',
            copyBtn: 'bg-black/10 hover:bg-black/20 text-dark-bg',
            accentPill: 'bg-black text-white'
          },
          {
            bg: 'bg-card-blue text-dark-bg border-card-blueDark',
            textColor: 'text-dark-bg',
            mutedText: 'text-dark-bg/80',
            subBox: 'bg-white/70 border-black/10 text-dark-bg',
            pill: 'bg-black text-card-blue',
            btnBorder: 'border-black hover:bg-black hover:text-card-blue text-dark-bg',
            copyBtn: 'bg-black/10 hover:bg-black/20 text-dark-bg',
            accentPill: 'bg-black text-white'
          },
          {
            bg: 'bg-white text-dark-bg border-slate-300',
            textColor: 'text-dark-bg',
            mutedText: 'text-slate-700',
            subBox: 'bg-slate-100 border-slate-200 text-dark-bg',
            pill: 'bg-dark-bg text-white',
            btnBorder: 'border-black hover:bg-black hover:text-white text-dark-bg',
            copyBtn: 'bg-slate-200 hover:bg-slate-300 text-dark-bg',
            accentPill: 'bg-dark-bg text-white'
          }
        ];
        return vocabColors[(index - 1) % vocabColors.length];
    }
  };

  const theme = getCardTheme(item.type);
  const formattedIndex = String(index).padStart(2, '0') + '.';

  const getSourceLabel = (source: ContentSource) => {
    switch (source) {
      case 'base': return `Base #${item.original_order || ''}`;
      case 'youtube': return 'YouTube';
      case 'podcast': return 'Podcast';
      case 'book': return 'Livro';
      case 'movie': return 'Filme';
      case 'series': return 'Série';
      default: return 'Inbox';
    }
  };

  return (
    <div className={`relative rounded-[28px] sm:rounded-[32px] p-6 sm:p-7 border-2 transition-all duration-300 flex flex-col justify-between shadow-xl ${theme.bg} ${
      isCreated ? 'opacity-90' : 'hover:-translate-y-1'
    }`}>
      {/* Top Meta Row */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          {/* Index & Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-black tracking-wider uppercase opacity-75">
              {formattedIndex}
            </span>
            <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${theme.pill}`}>
              {item.type === 'vocabulary' ? 'Vocabulário' : item.type === 'survival_phrase' ? 'Frase' : 'Phrasal Verb'}
            </span>
          </div>

          {/* Source & Encounters */}
          <div className="flex items-center gap-1.5">
            {item.times_encountered > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1">
                <Flame className="w-3 h-3 fill-white" />
                {item.times_encountered}x
              </span>
            )}

            <span className="text-[10px] font-mono opacity-70 font-semibold">
              {getSourceLabel(item.source)}
            </span>
          </div>
        </div>

        {/* Title */}
        <div>
          <h3 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight ${theme.textColor}`}>
            {item.content}
          </h3>
          {item.meaning_pt && (
            <p className={`text-xs font-semibold mt-1 ${theme.mutedText}`}>
              {item.meaning_pt}
            </p>
          )}
        </div>

        {/* FORMATTED ANKI CARD PREVIEWS */}
        <div className="space-y-2.5 pt-2">
          {/* FRONT */}
          <div className={`p-3.5 rounded-2xl border ${theme.subBox} space-y-1`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-60">
                FRENTE (ANKI)
              </span>
              <button
                onClick={(e) => copyText(ankiData.front, `front_${item.id}`, e)}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition-all flex items-center gap-1 ${theme.copyBtn}`}
              >
                {copiedSection === `front_${item.id}` ? (
                  <>
                    <Check className="w-3 h-3 stroke-[3]" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 opacity-60" />
                    Copiar Frente
                  </>
                )}
              </button>
            </div>
            <p className="text-xs font-mono font-medium whitespace-pre-line select-all leading-relaxed">
              {ankiData.front}
            </p>
          </div>

          {/* BACK */}
          <div className={`p-3.5 rounded-2xl border ${theme.subBox} space-y-1`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-60">
                VERSO (ANKI)
              </span>
              <button
                onClick={(e) => copyText(ankiData.back, `back_${item.id}`, e)}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition-all flex items-center gap-1 ${theme.copyBtn}`}
              >
                {copiedSection === `back_${item.id}` ? (
                  <>
                    <Check className="w-3 h-3 stroke-[3]" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 opacity-60" />
                    Copiar Verso
                  </>
                )}
              </button>
            </div>
            <p className="text-xs font-mono font-medium whitespace-pre-line select-all leading-relaxed">
              {ankiData.back}
            </p>
          </div>

          {/* Explanation */}
          <p className="text-[11px] opacity-75 leading-relaxed pt-1">
            <strong>💡 Dica:</strong> {ankiData.explanation}
          </p>
        </div>
      </div>

      {/* Bottom Circular Actions Row matching reference image */}
      <div className="pt-6 mt-4 border-t border-black/10 flex items-center justify-between gap-3">
        {/* Toggle Anki Button */}
        {onMarkCreated && (
          <button
            onClick={() => onMarkCreated(item)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-black tracking-tight transition-all active:scale-95 ${
              isCreated
                ? 'bg-slate-700 text-white hover:bg-slate-600'
                : 'bg-black text-white hover:bg-slate-900 shadow-md'
            }`}
          >
            {isCreated ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                Desmarcar
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                Já criei no Anki
              </>
            )}
          </button>
        )}

        <div className="flex items-center gap-2">
          {/* Skip button if in daily queue */}
          {isInDailyQueue && onSkip && !isCreated && (
            <button
              onClick={() => onSkip(item)}
              className="p-2 rounded-full text-xs opacity-60 hover:opacity-100 transition-opacity"
              title="Pular este item e trazer outro"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          )}

          {/* Details / Encounter */}
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(item)}
              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-transform active:scale-95 ${theme.btnBorder}`}
              title="Ver detalhes completos"
            >
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
