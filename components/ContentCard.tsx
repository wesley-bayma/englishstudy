'use client';

import React from 'react';
import { ContentItem, ContentType, ContentSource } from '../lib/types';
import { 
  Check, 
  RotateCcw, 
  Flame, 
  Eye, 
  ArrowRight, 
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
}

export function ContentCard({
  item,
  index = 1,
  isInDailyQueue = false,
  onMarkCreated,
  onSkip,
  onViewDetails,
  onAddEncounter,
  highlightMatch = false
}: ContentCardProps) {
  const isCreated = item.anki_status === 'created';

  // Color blocking theme matching user's reference image
  const getCardTheme = (type: ContentType) => {
    if (isCreated) {
      return {
        bg: 'bg-[#12151c] border-[#232936] text-slate-200',
        textColor: 'text-white',
        subText: 'text-slate-400',
        pill: 'bg-[#232936] text-slate-300',
        btnBorder: 'border-slate-600 hover:border-white text-white',
        badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
      };
    }

    switch (type) {
      case 'survival_phrase':
      case 'personal_phrase':
        return {
          bg: 'bg-[#bef264] text-[#090a0f] border-[#a3e635]',
          textColor: 'text-[#090a0f]',
          subText: 'text-[#090a0f]/80',
          pill: 'bg-black text-[#bef264]',
          btnBorder: 'border-black hover:bg-black hover:text-[#bef264] text-[#090a0f]',
          badge: 'bg-black text-white'
        };
      case 'phrasal_verb':
        return {
          bg: 'bg-[#fbbf24] text-[#090a0f] border-[#f59e0b]',
          textColor: 'text-[#090a0f]',
          subText: 'text-[#090a0f]/80',
          pill: 'bg-black text-[#fbbf24]',
          btnBorder: 'border-black hover:bg-black hover:text-[#fbbf24] text-[#090a0f]',
          badge: 'bg-black text-white'
        };
      case 'vocabulary':
      default:
        const vocabThemes = [
          {
            bg: 'bg-[#f9a8d4] text-[#090a0f] border-[#f472b6]',
            textColor: 'text-[#090a0f]',
            subText: 'text-[#090a0f]/80',
            pill: 'bg-black text-[#f9a8d4]',
            btnBorder: 'border-black hover:bg-black hover:text-[#f9a8d4] text-[#090a0f]',
            badge: 'bg-black text-white'
          },
          {
            bg: 'bg-[#93c5fd] text-[#090a0f] border-[#60a5fa]',
            textColor: 'text-[#090a0f]',
            subText: 'text-[#090a0f]/80',
            pill: 'bg-black text-[#93c5fd]',
            btnBorder: 'border-black hover:bg-black hover:text-[#93c5fd] text-[#090a0f]',
            badge: 'bg-black text-white'
          },
          {
            bg: 'bg-white text-[#090a0f] border-slate-300',
            textColor: 'text-[#090a0f]',
            subText: 'text-slate-700',
            pill: 'bg-[#090a0f] text-white',
            btnBorder: 'border-black hover:bg-black hover:text-white text-[#090a0f]',
            badge: 'bg-[#090a0f] text-white'
          }
        ];
        return vocabThemes[(index - 1) % vocabThemes.length];
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

  const getTypeLabel = (type: ContentType) => {
    switch (type) {
      case 'vocabulary': return 'Vocabulário';
      case 'survival_phrase': return 'Frase de Sobrevivência';
      case 'phrasal_verb': return 'Phrasal Verb';
      default: return 'Conteúdo';
    }
  };

  return (
    <div className={`relative rounded-[28px] sm:rounded-[32px] p-6 sm:p-7 border-2 transition-all duration-300 flex flex-col justify-between shadow-xl min-h-[220px] ${theme.bg} ${
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
              {getTypeLabel(item.type)}
            </span>
          </div>

          {/* Source & Encounters */}
          <div className="flex items-center gap-1.5">
            {item.times_encountered > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white flex items-center gap-1 font-mono">
                <Flame className="w-3 h-3 fill-white" />
                {item.times_encountered}x
              </span>
            )}

            <span className="text-[10px] font-mono opacity-70 font-semibold">
              {getSourceLabel(item.source)}
            </span>
          </div>
        </div>

        {/* Big Word / Phrase / Phrasal Verb */}
        <div className="pt-1">
          <h3 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight ${theme.textColor}`}>
            {item.content}
          </h3>

          {/* Portuguese Translation / Meaning */}
          {item.meaning_pt && (
            <p className={`text-sm font-semibold mt-1.5 ${theme.subText}`}>
              {item.meaning_pt}
            </p>
          )}

          {/* Notes if any */}
          {item.notes && (
            <p className="text-xs opacity-75 mt-1 font-mono">
              Obs: {item.notes}
            </p>
          )}
        </div>
      </div>

      {/* Bottom Actions Row */}
      <div className="pt-6 mt-4 border-t border-black/10 flex items-center justify-between gap-3">
        {/* Toggle Anki Button */}
        {onMarkCreated && (
          <button
            onClick={() => onMarkCreated(item)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black tracking-tight transition-all active:scale-95 ${
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
              className="p-2.5 rounded-full text-xs opacity-60 hover:opacity-100 transition-opacity font-semibold"
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
              title="Ver detalhes / histórico"
            >
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
