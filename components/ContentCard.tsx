'use client';

import React from 'react';
import { ContentItem, ContentType, ContentSource } from '../lib/types';
import { 
  Check, 
  RotateCcw, 
  Flame, 
  ExternalLink, 
  Clock, 
  Eye, 
  Sparkles, 
  SkipForward,
  Plus
} from 'lucide-react';

interface ContentCardProps {
  item: ContentItem;
  isInDailyQueue?: boolean;
  onMarkCreated?: (item: ContentItem) => void;
  onSkip?: (item: ContentItem) => void;
  onViewDetails?: (item: ContentItem) => void;
  onAddEncounter?: (item: ContentItem) => void;
  highlightMatch?: boolean;
}

export function ContentCard({
  item,
  isInDailyQueue = false,
  onMarkCreated,
  onSkip,
  onViewDetails,
  onAddEncounter,
  highlightMatch = false
}: ContentCardProps) {
  // Semantic Color Palette
  const getTypeStyle = (type: ContentType) => {
    switch (type) {
      case 'vocabulary':
      case 'personal_vocabulary':
        return {
          badge: 'bg-blue-50 text-blue-700 border-blue-200',
          indicator: 'bg-blue-500',
          label: 'Vocabulário',
          textHover: 'group-hover:text-blue-600'
        };
      case 'survival_phrase':
      case 'personal_phrase':
        return {
          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          indicator: 'bg-emerald-500',
          label: 'Frase',
          textHover: 'group-hover:text-emerald-600'
        };
      case 'phrasal_verb':
        return {
          badge: 'bg-amber-50 text-amber-800 border-amber-200',
          indicator: 'bg-amber-500',
          label: 'Phrasal Verb',
          textHover: 'group-hover:text-amber-600'
        };
      default:
        return {
          badge: 'bg-slate-100 text-slate-700 border-slate-200',
          indicator: 'bg-slate-500',
          label: 'Conteúdo',
          textHover: 'group-hover:text-slate-900'
        };
    }
  };

  const getSourceLabel = (source: ContentSource) => {
    switch (source) {
      case 'base': return 'Base';
      case 'youtube': return 'YouTube';
      case 'podcast': return 'Podcast';
      case 'book': return 'Livro';
      case 'movie': return 'Filme';
      case 'series': return 'Série';
      case 'audio': return 'Áudio';
      case 'conversation': return 'Conversa';
      default: return 'Inbox';
    }
  };

  const typeStyle = getTypeStyle(item.type);
  const isCreated = item.anki_status === 'created';

  return (
    <div className={`group relative bg-white rounded-2xl border transition-all duration-200 p-4 shadow-sm hover:shadow-md ${
      isCreated 
        ? 'border-emerald-200/80 bg-gradient-to-r from-white to-emerald-50/20' 
        : highlightMatch 
          ? 'border-blue-400 ring-2 ring-blue-100' 
          : 'border-slate-200/90 hover:border-slate-300'
    }`}>
      {/* Top badges row */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Type Badge */}
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${typeStyle.badge}`}>
            {typeStyle.label}
          </span>

          {/* Source Badge */}
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {getSourceLabel(item.source)}
            {item.original_order ? ` #${item.original_order}` : ''}
          </span>

          {/* Encounters badge */}
          {item.times_encountered > 0 && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
              item.times_encountered >= 2 
                ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                : 'bg-amber-50 text-amber-700'
            }`}>
              <Flame className="w-3 h-3 text-rose-500 fill-rose-500" />
              {item.times_encountered === 1 ? '1 encontro' : `${item.times_encountered} encontros`}
            </span>
          )}
        </div>

        {/* Anki Status Pill */}
        <div>
          {isCreated ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3 stroke-[3]" />
              No Anki
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3 text-slate-400" />
              Pendente
            </span>
          )}
        </div>
      </div>

      {/* Main Content Title */}
      <div 
        onClick={() => onViewDetails && onViewDetails(item)}
        className="cursor-pointer"
      >
        <h3 className={`text-lg font-bold text-slate-900 tracking-tight transition-colors ${typeStyle.textHover}`}>
          {item.content}
        </h3>

        {/* Translation or Meaning if available */}
        {item.meaning_pt && (
          <p className="text-sm text-slate-600 mt-0.5 line-clamp-1 font-normal">
            {item.meaning_pt}
          </p>
        )}

        {/* Example sentence if available */}
        {item.example && item.example !== item.content && (
          <p className="text-xs text-slate-500 italic mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
            &ldquo;{item.example}&rdquo;
          </p>
        )}
      </div>

      {/* Footer action buttons */}
      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* Toggle Anki button */}
          {onMarkCreated && (
            <button
              onClick={() => onMarkCreated(item)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                isCreated
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-500/20'
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

          {/* Skip button if in daily queue */}
          {isInDailyQueue && onSkip && !isCreated && (
            <button
              onClick={() => onSkip(item)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Pular para o fim da fila e trazer outro"
            >
              <SkipForward className="w-3.5 h-3.5 text-slate-400" />
              Pular
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Add Encounter button */}
          {onAddEncounter && (
            <button
              onClick={() => onAddEncounter(item)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Registrar novo encontro natural"
            >
              <Flame className="w-4 h-4" />
            </button>
          )}

          {/* View Details button */}
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(item)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              Detalhes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
