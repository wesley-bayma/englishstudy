'use client';

import React, { useState } from 'react';
import { ContentItem, ContentType, ContentSource } from '../lib/types';
import { generateSentencesWithGemini, GeneratedSentenceOption } from '../lib/gemini';
import { 
  Check, 
  RotateCcw, 
  Flame, 
  Eye, 
  ArrowRight, 
  SkipForward,
  Sparkles,
  Copy,
  ChevronDown,
  ChevronUp,
  Volume2
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
  const [showSentences, setShowSentences] = useState(false);
  const [sentences, setSentences] = useState<GeneratedSentenceOption[]>([]);
  const [ipa, setIpa] = useState<string | null>(null);
  const [isLoadingSentences, setIsLoadingSentences] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState(false);

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
        aiBtn: 'bg-dark-bg text-card-lime hover:bg-dark-border border border-card-lime/30',
        subBox: 'bg-[#090a0f] border-[#232936] text-slate-300'
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
          aiBtn: 'bg-black text-[#bef264] hover:bg-slate-900',
          subBox: 'bg-white/80 border-black/10 text-dark-bg'
        };
      case 'phrasal_verb':
        return {
          bg: 'bg-[#fbbf24] text-[#090a0f] border-[#f59e0b]',
          textColor: 'text-[#090a0f]',
          subText: 'text-[#090a0f]/80',
          pill: 'bg-black text-[#fbbf24]',
          btnBorder: 'border-black hover:bg-black hover:text-[#fbbf24] text-[#090a0f]',
          aiBtn: 'bg-black text-[#fbbf24] hover:bg-slate-900',
          subBox: 'bg-white/80 border-black/10 text-dark-bg'
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
            aiBtn: 'bg-black text-[#f9a8d4] hover:bg-slate-900',
            subBox: 'bg-white/80 border-black/10 text-dark-bg'
          },
          {
            bg: 'bg-[#93c5fd] text-[#090a0f] border-[#60a5fa]',
            textColor: 'text-[#090a0f]',
            subText: 'text-[#090a0f]/80',
            pill: 'bg-black text-[#93c5fd]',
            btnBorder: 'border-black hover:bg-black hover:text-[#93c5fd] text-[#090a0f]',
            aiBtn: 'bg-black text-[#93c5fd] hover:bg-slate-900',
            subBox: 'bg-white/80 border-black/10 text-dark-bg'
          },
          {
            bg: 'bg-white text-[#090a0f] border-slate-300',
            textColor: 'text-[#090a0f]',
            subText: 'text-slate-700',
            pill: 'bg-[#090a0f] text-white',
            btnBorder: 'border-black hover:bg-black hover:text-white text-[#090a0f]',
            aiBtn: 'bg-[#090a0f] text-white hover:bg-slate-800',
            subBox: 'bg-slate-100 border-slate-200 text-dark-bg'
          }
        ];
        return vocabThemes[(index - 1) % vocabThemes.length];
    }
  };

  const theme = getCardTheme(item.type);
  const formattedIndex = String(index).padStart(2, '0') + '.';

  const handleToggleSentences = async () => {
    if (showSentences) {
      setShowSentences(false);
      return;
    }

    setShowSentences(true);

    if (sentences.length === 0) {
      setIsLoadingSentences(true);
      try {
        const res = await generateSentencesWithGemini(
          item.content,
          item.type,
          item.meaning_pt || ''
        );
        setSentences(res.sentences || []);
        if (res.ipa) setIpa(res.ipa);
        if (res.isOfflineFallback) setIsOffline(true);
      } catch (err) {
        console.error('Failed to generate sentences:', err);
      } finally {
        setIsLoadingSentences(false);
      }
    }
  };

  const handleCopySentence = (text: string, idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

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
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h3 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight ${theme.textColor}`}>
              {item.content}
            </h3>
            {ipa && (
              <span className="text-xs font-mono opacity-70 font-bold">
                {ipa}
              </span>
            )}
          </div>

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

        {/* AI Sentence Options Trigger */}
        <div className="pt-2">
          <button
            onClick={handleToggleSentences}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black tracking-tight transition-all active:scale-95 shadow-sm ${theme.aiBtn}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {showSentences ? 'Ocultar Opções de Frases' : '5 Opções de Frases (IA)'}
            {showSentences ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* EXPANDABLE AI 5 SENTENCES ACCORDION */}
        {showSentences && (
          <div className="space-y-2 pt-2 animate-in fade-in duration-200">
            {isLoadingSentences ? (
              <div className={`p-4 rounded-2xl border text-xs font-mono flex items-center gap-2 ${theme.subBox}`}>
                <Sparkles className="w-4 h-4 animate-spin text-card-lime" />
                <span>Gerando 5 frases curtas no nível A2 com Gemini Flash...</span>
              </div>
            ) : sentences.length === 0 ? (
              <div className={`p-3 rounded-2xl border text-xs ${theme.subBox}`}>
                Nenhuma frase encontrada. Verifique sua conexão ou chave de API.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono font-bold opacity-75 px-1">
                  <span>Escolha uma frase para seu card:</span>
                  {isOffline && <span className="text-[10px] text-amber-600">(Modo Offline)</span>}
                </div>

                {sentences.map((st, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-2xl border transition-all text-xs space-y-1 ${theme.subBox}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-sm leading-snug">
                        {st.en}
                      </div>

                      <button
                        onClick={(e) => handleCopySentence(st.en, idx, e)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/10 hover:bg-black/20 text-[11px] font-bold flex-shrink-0 transition-colors"
                        title="Copiar frase em inglês"
                      >
                        {copiedIdx === idx ? (
                          <>
                            <Check className="w-3 h-3 stroke-[3] text-emerald-600" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 opacity-60" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-[11px] opacity-80 font-medium">
                      {st.pt}
                    </p>

                    {st.clue && (
                      <div className="text-[10px] font-mono opacity-60 pt-0.5">
                        Frente do Anki: <span className="font-bold">{st.clue}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
