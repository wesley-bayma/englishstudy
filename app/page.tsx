'use client';

import React, { useState, useEffect } from 'react';
import { ContentItem, DailyQueue, ContentType } from '../lib/types';
import { getOrCreateTodayQueue, markQueueItemCreated, skipQueueItem } from '../lib/daily-queue';
import { ContentCard } from '../components/ContentCard';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { EncounterModal } from '../components/EncounterModal';
import { AnkiFocusModal } from '../components/AnkiFocusModal';
import { generateAnkiCardData } from '../lib/card-generator';
import confetti from 'canvas-confetti';
import { 
  CalendarDays, 
  CheckCircle2, 
  Flame, 
  RotateCcw, 
  Sparkles, 
  PlayCircle,
  Copy,
  Check,
  ArrowUpRight,
  Layers
} from 'lucide-react';
import Link from 'next/link';

export default function TodayPage() {
  const [queue, setQueue] = useState<DailyQueue | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | ContentType>('all');
  const [copiedAll, setCopiedAll] = useState(false);
  
  // Modals state
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEncounterOpen, setIsEncounterOpen] = useState(false);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const res = await getOrCreateTodayQueue();
      setQueue(res.queue);
      setItems(res.items);
    } catch (err) {
      console.error('Failed to load today queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleMarkCreated = async (item: ContentItem) => {
    try {
      const res = await markQueueItemCreated(item.id);
      setQueue(res.queue);
      setItems(res.items);

      if (res.queue.completed_count === res.queue.target_count && res.queue.target_count > 0) {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
    } catch (err) {
      console.error('Failed to mark item created:', err);
    }
  };

  const handleSkip = async (item: ContentItem) => {
    try {
      const res = await skipQueueItem(item.id, item.type);
      setQueue(res.queue);
      setItems(res.items);
    } catch (err) {
      console.error('Failed to skip item:', err);
    }
  };

  const handleItemUpdated = (updated: ContentItem) => {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    if (selectedItem && selectedItem.id === updated.id) {
      setSelectedItem(updated);
    }
  };

  const handleCopyAllCards = () => {
    const text = items.map((item, idx) => {
      const card = generateAnkiCardData(item);
      return `=== CARD #${idx + 1} (${item.type.toUpperCase()}) ===\nFRENTE:\n${card.front}\n\nVERSO:\n${card.back}\n\nEXPLICAÇÃO:\n${card.explanation}\n`;
    }).join('\n----------------------------------------\n\n');

    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  // Category counts
  const vocabItems = items.filter(i => i.type === 'vocabulary' || i.type === 'personal_vocabulary');
  const phraseItems = items.filter(i => i.type === 'survival_phrase' || i.type === 'personal_phrase');
  const pvItems = items.filter(i => i.type === 'phrasal_verb');

  const vocabDone = vocabItems.filter(i => i.anki_status === 'created').length;
  const phraseDone = phraseItems.filter(i => i.anki_status === 'created').length;
  const pvDone = pvItems.filter(i => i.anki_status === 'created').length;
  const totalDone = (queue?.completed_count) || 0;
  const totalTarget = (queue?.target_count) || 10;
  const progressPercent = totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0;

  const filteredItems = activeTypeFilter === 'all' 
    ? items 
    : items.filter(i => {
        if (activeTypeFilter === 'vocabulary') return i.type === 'vocabulary' || i.type === 'personal_vocabulary';
        if (activeTypeFilter === 'survival_phrase') return i.type === 'survival_phrase' || i.type === 'personal_phrase';
        return i.type === 'phrasal_verb';
      });

  return (
    <div className="space-y-10">
      {/* Hero Section matching reference typography */}
      <div className="space-y-6 pt-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-xl space-y-3">
            <span className="text-xs font-mono font-bold tracking-widest text-card-lime uppercase">
              // Rotina Diária no Anki
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-white leading-[1.05]">
              English is an art <br />
              <span className="text-slate-400">and you&apos;re the curator.</span>
            </h1>
            <p className="text-sm text-slate-400 font-medium max-w-lg">
              10 cards prontos com explicações linguísticas e exemplos canônicos para você criar manualmente no seu deck do Anki.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <button
              onClick={() => setIsFocusModalOpen(true)}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-card-lime hover:bg-card-limeDark text-dark-bg font-black text-sm shadow-xl shadow-card-lime/10 active:scale-95 transition-all"
            >
              <PlayCircle className="w-4 h-4 stroke-[2.5]" />
              Modo Foco no Anki
              <ArrowUpRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleCopyAllCards}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-dark-card hover:bg-dark-border text-slate-200 border border-dark-border font-bold text-xs transition-colors"
            >
              {copiedAll ? <Check className="w-4 h-4 text-card-lime" /> : <Copy className="w-4 h-4 text-slate-400" />}
              {copiedAll ? '10 Cards Copiados!' : 'Copiar Todos os 10 Cards'}
            </button>
          </div>
        </div>

        {/* Minimalist Underlined Stats Bar matching reference top section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 pt-4 border-t border-dark-border/80">
          {/* Total Progress */}
          <div className="space-y-1">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">Meta Total</span>
            <div className="text-2xl font-black text-white font-mono">{totalDone}/{totalTarget}</div>
            <div className="w-full bg-dark-border h-1 rounded-full overflow-hidden mt-2">
              <div
                className="bg-card-lime h-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Vocab */}
          <button
            onClick={() => setActiveTypeFilter(activeTypeFilter === 'vocabulary' ? 'all' : 'vocabulary')}
            className="text-left space-y-1 group"
          >
            <span className="text-xs font-mono text-card-pink uppercase tracking-wider block group-hover:underline">01. Vocabulário</span>
            <div className="text-2xl font-black text-white font-mono">{vocabDone}/5</div>
            <span className="text-[11px] text-slate-500 font-medium block">palavras diárias</span>
          </button>

          {/* Frases */}
          <button
            onClick={() => setActiveTypeFilter(activeTypeFilter === 'survival_phrase' ? 'all' : 'survival_phrase')}
            className="text-left space-y-1 group"
          >
            <span className="text-xs font-mono text-card-lime uppercase tracking-wider block group-hover:underline">02. Frases</span>
            <div className="text-2xl font-black text-white font-mono">{phraseDone}/3</div>
            <span className="text-[11px] text-slate-500 font-medium block">sobrevivência prática</span>
          </button>

          {/* Phrasal Verbs */}
          <button
            onClick={() => setActiveTypeFilter(activeTypeFilter === 'phrasal_verb' ? 'all' : 'phrasal_verb')}
            className="text-left space-y-1 group"
          >
            <span className="text-xs font-mono text-card-amber uppercase tracking-wider block group-hover:underline">03. Phrasal Verbs</span>
            <div className="text-2xl font-black text-white font-mono">{pvDone}/2</div>
            <span className="text-[11px] text-slate-500 font-medium block">alta frequência</span>
          </button>
        </div>

        {totalDone === totalTarget && totalTarget > 0 && (
          <div className="p-4 bg-card-lime/10 border-2 border-card-lime rounded-2xl flex items-center gap-3 text-card-lime text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>
              Excelente! Meta diária de 10 cards atingida. Revise os cards no seu aplicativo do Anki ao longo do dia!
            </span>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
        <button
          onClick={() => setActiveTypeFilter('all')}
          className={`px-4 py-2 rounded-full transition-all ${
            activeTypeFilter === 'all'
              ? 'bg-white text-dark-bg shadow-sm'
              : 'bg-dark-card text-slate-400 hover:text-white border border-dark-border'
          }`}
        >
          Todos os Cards ({items.length})
        </button>

        <button
          onClick={() => setActiveTypeFilter('vocabulary')}
          className={`px-4 py-2 rounded-full transition-all ${
            activeTypeFilter === 'vocabulary'
              ? 'bg-card-pink text-dark-bg font-black shadow-sm'
              : 'bg-dark-card text-card-pink hover:bg-dark-border border border-dark-border'
          }`}
        >
          Vocabulário (5)
        </button>

        <button
          onClick={() => setActiveTypeFilter('survival_phrase')}
          className={`px-4 py-2 rounded-full transition-all ${
            activeTypeFilter === 'survival_phrase'
              ? 'bg-card-lime text-dark-bg font-black shadow-sm'
              : 'bg-dark-card text-card-lime hover:bg-dark-border border border-dark-border'
          }`}
        >
          Frases (3)
        </button>

        <button
          onClick={() => setActiveTypeFilter('phrasal_verb')}
          className={`px-4 py-2 rounded-full transition-all ${
            activeTypeFilter === 'phrasal_verb'
              ? 'bg-card-amber text-dark-bg font-black shadow-sm'
              : 'bg-dark-card text-card-amber hover:bg-dark-border border border-dark-border'
          }`}
        >
          Phrasal Verbs (2)
        </button>
      </div>

      {/* Modern Vibrant Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 font-mono text-sm">
          // Carregando cards de hoje...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-dark-card rounded-[32px] p-12 text-center border border-dark-border space-y-3">
          <p className="text-slate-400 text-sm">Nenhum card pendente nesta categoria.</p>
          <button
            onClick={() => setActiveTypeFilter('all')}
            className="text-xs font-bold text-card-lime hover:underline"
          >
            Ver todos os 10 cards
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {filteredItems.map((item, idx) => (
            <ContentCard
              key={item.id}
              item={item}
              index={idx + 1}
              isInDailyQueue={true}
              defaultExpandedCard={true}
              onMarkCreated={handleMarkCreated}
              onSkip={handleSkip}
              onViewDetails={(it) => {
                setSelectedItem(it);
                setIsDetailOpen(true);
              }}
              onAddEncounter={(it) => {
                setSelectedItem(it);
                setIsEncounterOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Step-by-Step Focus Modal */}
      <AnkiFocusModal
        items={items}
        isOpen={isFocusModalOpen}
        onClose={() => setIsFocusModalOpen(false)}
        onMarkCreated={handleMarkCreated}
        onSkipItem={handleSkip}
      />

      {/* Item Detail Modal */}
      <ItemDetailModal
        item={selectedItem}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onItemUpdated={handleItemUpdated}
        onOpenEncounterModal={(it) => {
          setSelectedItem(it);
          setIsEncounterOpen(true);
        }}
      />

      {/* Encounter Modal */}
      <EncounterModal
        item={selectedItem}
        isOpen={isEncounterOpen}
        onClose={() => setIsEncounterOpen(false)}
        onSuccess={handleItemUpdated}
      />
    </div>
  );
}
