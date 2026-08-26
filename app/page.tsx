'use client';

import React, { useState, useEffect } from 'react';
import { ContentItem, DailyQueue, ContentType } from '../lib/types';
import { 
  getOrCreateTodayQueue, 
  markQueueItemCreated, 
  skipQueueItem,
  regenerateTodayQueue,
  getFormattedDate,
  getTodayDateString 
} from '../lib/daily-queue';
import { ContentCard } from '../components/ContentCard';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { EncounterModal } from '../components/EncounterModal';
import confetti from 'canvas-confetti';
import { 
  CalendarDays, 
  CheckCircle2, 
  Flame, 
  RotateCcw, 
  Sparkles, 
  Check, 
  ArrowUpRight,
  RefreshCw,
  Info,
  ListOrdered
} from 'lucide-react';
import Link from 'next/link';

export default function TodayPage() {
  const [queue, setQueue] = useState<DailyQueue | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | ContentType>('all');
  const [isAuditing, setIsAuditing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Modals state
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEncounterOpen, setIsEncounterOpen] = useState(false);

  const todayIso = getTodayDateString();
  const formattedToday = getFormattedDate(todayIso);

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

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const res = await regenerateTodayQueue();
      setQueue(res.queue);
      setItems(res.items);
    } catch (err) {
      console.error('Failed to regenerate queue:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

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
      {/* Date & Audit Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap p-4 sm:p-5 bg-dark-card border border-dark-border rounded-[28px] shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-card-lime/10 border border-card-lime/30 flex items-center justify-center text-card-lime">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-mono font-black text-card-lime capitalize block">
              Hoje: {formattedToday}
            </span>
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
              <ListOrdered className="w-3.5 h-3.5 text-card-lime" />
              Ordem sequencial estrita • {items.length} conteúdos para hoje
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAuditing(!isAuditing)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-dark-bg hover:bg-dark-border text-slate-300 text-xs font-mono font-bold border border-dark-border transition-colors"
          >
            <Info className="w-3.5 h-3.5 text-card-lime" />
            {isAuditing ? 'Ocultar Auditoria' : 'Auditar Sequência'}
          </button>

          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-dark-bg hover:bg-dark-border text-slate-300 text-xs font-mono font-bold border border-dark-border transition-colors"
            title="Recarregar sequência de hoje"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-card-lime' : 'text-slate-400'}`} />
            {isRegenerating ? 'Atualizando...' : 'Recarregar'}
          </button>
        </div>
      </div>

      {/* Audit Explanation Drawer */}
      {isAuditing && (
        <div className="p-6 bg-dark-card border-2 border-card-lime/40 rounded-[32px] text-xs font-mono space-y-4 animate-in fade-in">
          <div className="flex items-center gap-2 text-card-lime font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            Sequência Canônica de Hoje ({todayIso}):
          </div>
          <p className="text-slate-300 font-sans text-xs leading-relaxed">
            As palavras e frases seguem rigorosamente a ordem da lista (sem sorteio aleatório).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 bg-dark-bg rounded-2xl border border-card-pink/30 space-y-1">
              <span className="text-card-pink font-bold block">Vocabulário ({vocabItems.length}):</span>
              <ul className="text-slate-300 text-[11px] space-y-0.5">
                {vocabItems.map(i => (
                  <li key={i.id}>• {i.content} <span className="opacity-60">({i.source === 'base' ? `#${i.original_order}` : 'Inbox'})</span></li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-dark-bg rounded-2xl border border-card-lime/30 space-y-1">
              <span className="text-card-lime font-bold block">Frases ({phraseItems.length}):</span>
              {phraseItems.length === 0 ? (
                <span className="text-slate-500 text-[11px] italic">Frases concluídas!</span>
              ) : (
                <ul className="text-slate-300 text-[11px] space-y-0.5">
                  {phraseItems.map(i => (
                    <li key={i.id}>• {i.content} <span className="opacity-60">({i.source === 'base' ? `#${i.original_order}` : 'Inbox'})</span></li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-3 bg-dark-bg rounded-2xl border border-card-amber/30 space-y-1">
              <span className="text-card-amber font-bold block">Phrasal Verbs ({pvItems.length}):</span>
              {pvItems.length === 0 ? (
                <span className="text-slate-500 text-[11px] italic">Phrasal verbs concluídos!</span>
              ) : (
                <ul className="text-slate-300 text-[11px] space-y-0.5">
                  {pvItems.map(i => (
                    <li key={i.id}>• {i.content} <span className="opacity-60">({i.source === 'base' ? `#${i.original_order}` : 'Inbox'})</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 border-t border-dark-border pt-2">
            📌 <strong>Regra de transição:</strong> Quando as frases (#100) e os phrasal verbs (#150) terminarem, a cota diária de 10 continuará sendo preenchida exclusivamente pelas palavras de vocabulário da sequência.
          </p>
        </div>
      )}

      {/* Hero Section */}
      <div className="space-y-6">
        <div className="space-y-3">
          <span className="text-xs font-mono font-bold tracking-widest text-card-lime uppercase">
            // Curadoria Diária Sequencial
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-white leading-[1.05]">
            Conteúdos de Hoje.
          </h1>
          <p className="text-sm sm:text-base text-slate-400 font-medium max-w-xl">
            {vocabItems.length} vocabulários, {phraseItems.length} frases e {pvItems.length} phrasal verbs na ordem da lista para você estudar e criar no Anki.
          </p>
        </div>

        {/* Minimalist Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 pt-4 border-t border-dark-border/80">
          {/* Total Progress */}
          <div className="space-y-1">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">Meta de Hoje</span>
            <div className="text-2xl font-black text-white font-mono">{totalDone}/{totalTarget}</div>
            <div className="w-full bg-dark-border h-1.5 rounded-full overflow-hidden mt-2">
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
            <div className="text-2xl font-black text-white font-mono">{vocabDone}/{vocabItems.length}</div>
            <span className="text-[11px] text-slate-500 font-medium block">ordem da lista</span>
          </button>

          {/* Frases */}
          <button
            onClick={() => setActiveTypeFilter(activeTypeFilter === 'survival_phrase' ? 'all' : 'survival_phrase')}
            className="text-left space-y-1 group"
          >
            <span className="text-xs font-mono text-card-lime uppercase tracking-wider block group-hover:underline">02. Frases</span>
            <div className="text-2xl font-black text-white font-mono">{phraseDone}/{phraseItems.length}</div>
            <span className="text-[11px] text-slate-500 font-medium block">ordem da lista</span>
          </button>

          {/* Phrasal Verbs */}
          <button
            onClick={() => setActiveTypeFilter(activeTypeFilter === 'phrasal_verb' ? 'all' : 'phrasal_verb')}
            className="text-left space-y-1 group"
          >
            <span className="text-xs font-mono text-card-amber uppercase tracking-wider block group-hover:underline">03. Phrasal Verbs</span>
            <div className="text-2xl font-black text-white font-mono">{pvDone}/{pvItems.length}</div>
            <span className="text-[11px] text-slate-500 font-medium block">ordem da lista</span>
          </button>
        </div>

        {totalDone === totalTarget && totalTarget > 0 && (
          <div className="p-4 bg-card-lime/10 border-2 border-card-lime rounded-2xl flex items-center gap-3 text-card-lime text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>
              Parabéns! Você concluiu todos os {totalTarget} conteúdos de hoje no Anki.
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
          Todos os Itens ({items.length})
        </button>

        <button
          onClick={() => setActiveTypeFilter('vocabulary')}
          className={`px-4 py-2 rounded-full transition-all ${
            activeTypeFilter === 'vocabulary'
              ? 'bg-card-pink text-dark-bg font-black shadow-sm'
              : 'bg-dark-card text-card-pink hover:bg-dark-border border border-dark-border'
          }`}
        >
          Vocabulário ({vocabItems.length})
        </button>

        {phraseItems.length > 0 && (
          <button
            onClick={() => setActiveTypeFilter('survival_phrase')}
            className={`px-4 py-2 rounded-full transition-all ${
              activeTypeFilter === 'survival_phrase'
                ? 'bg-card-lime text-dark-bg font-black shadow-sm'
                : 'bg-dark-card text-card-lime hover:bg-dark-border border border-dark-border'
            }`}
          >
            Frases ({phraseItems.length})
          </button>
        )}

        {pvItems.length > 0 && (
          <button
            onClick={() => setActiveTypeFilter('phrasal_verb')}
            className={`px-4 py-2 rounded-full transition-all ${
              activeTypeFilter === 'phrasal_verb'
                ? 'bg-card-amber text-dark-bg font-black shadow-sm'
                : 'bg-dark-card text-card-amber hover:bg-dark-border border border-dark-border'
            }`}
          >
            Phrasal Verbs ({pvItems.length})
          </button>
        )}
      </div>

      {/* Modern Content Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 font-mono text-sm">
          // Carregando conteúdos de hoje na ordem da lista...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-dark-card rounded-[32px] p-12 text-center border border-dark-border space-y-4">
          <p className="text-slate-300 text-sm font-semibold">
            Nenhum item pendente nesta categoria.
          </p>
          <button
            onClick={handleRegenerate}
            className="px-6 py-3 bg-card-lime text-dark-bg rounded-full text-xs font-black shadow-lg"
          >
            Recarregar Fila
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
        queueItems={filteredItems}
        onSelectNextItem={(next) => setSelectedItem(next)}
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
