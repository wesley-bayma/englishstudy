'use client';

import React, { useState, useEffect } from 'react';
import { ContentItem, DailyQueue, ContentType } from '../lib/types';
import { getOrCreateTodayQueue, markQueueItemCreated, skipQueueItem } from '../lib/daily-queue';
import { ContentCard } from '../components/ContentCard';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { EncounterModal } from '../components/EncounterModal';
import { ProgressBar } from '../components/ProgressBar';
import confetti from 'canvas-confetti';
import { 
  CalendarDays, 
  CheckCircle2, 
  Flame, 
  RotateCcw, 
  Sparkles, 
  Filter,
  PlusCircle,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';

export default function TodayPage() {
  const [queue, setQueue] = useState<DailyQueue | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | ContentType>('all');
  
  // Modals state
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEncounterOpen, setIsEncounterOpen] = useState(false);

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
          particleCount: 60,
          spread: 70,
          origin: { y: 0.7 }
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

  const filteredItems = activeTypeFilter === 'all' 
    ? items 
    : items.filter(i => {
        if (activeTypeFilter === 'vocabulary') return i.type === 'vocabulary' || i.type === 'personal_vocabulary';
        if (activeTypeFilter === 'survival_phrase') return i.type === 'survival_phrase' || i.type === 'personal_phrase';
        return i.type === 'phrasal_verb';
      });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Fila de Hoje</h1>
              <p className="text-xs text-slate-500 font-medium">
                10 novos conteúdos para criar manualmente no Anki
              </p>
            </div>
          </div>

          <Link
            href="/add"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionar Novo</span>
          </Link>
        </div>

        {/* Global Progress Bar */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
          <ProgressBar
            completed={totalDone}
            total={totalTarget}
            color="emerald"
            label="Meta Diária Total"
            subLabel="progresso"
            size="md"
          />

          {/* 3 Categories Breakdown Pills */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {/* Vocab */}
            <button
              onClick={() => setActiveTypeFilter(activeTypeFilter === 'vocabulary' ? 'all' : 'vocabulary')}
              className={`p-2 rounded-xl border text-left transition-all ${
                activeTypeFilter === 'vocabulary'
                  ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-100'
                  : 'bg-white border-slate-200/70 hover:bg-slate-50'
              }`}
            >
              <span className="text-[11px] font-semibold text-blue-600 block">Vocabulário</span>
              <span className="text-sm font-bold font-mono text-slate-800">
                {vocabDone}/{vocabItems.length}
              </span>
            </button>

            {/* Frases */}
            <button
              onClick={() => setActiveTypeFilter(activeTypeFilter === 'survival_phrase' ? 'all' : 'survival_phrase')}
              className={`p-2 rounded-xl border text-left transition-all ${
                activeTypeFilter === 'survival_phrase'
                  ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-100'
                  : 'bg-white border-slate-200/70 hover:bg-slate-50'
              }`}
            >
              <span className="text-[11px] font-semibold text-emerald-600 block">Frases</span>
              <span className="text-sm font-bold font-mono text-slate-800">
                {phraseDone}/{phraseItems.length}
              </span>
            </button>

            {/* Phrasal Verbs */}
            <button
              onClick={() => setActiveTypeFilter(activeTypeFilter === 'phrasal_verb' ? 'all' : 'phrasal_verb')}
              className={`p-2 rounded-xl border text-left transition-all ${
                activeTypeFilter === 'phrasal_verb'
                  ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-100'
                  : 'bg-white border-slate-200/70 hover:bg-slate-50'
              }`}
            >
              <span className="text-[11px] font-semibold text-amber-700 block">Phrasal Verbs</span>
              <span className="text-sm font-bold font-mono text-slate-800">
                {pvDone}/{pvItems.length}
              </span>
            </button>
          </div>
        </div>

        {totalDone === totalTarget && totalTarget > 0 && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 font-medium animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>
              Parabéns! Você concluiu a meta dos 10 conteúdos de hoje no Anki. Lembre-se de manter sua rotina de revisões em dia.
            </span>
          </div>
        )}
      </div>

      {/* Category Filter Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold">
        <button
          onClick={() => setActiveTypeFilter('all')}
          className={`px-3.5 py-1.5 rounded-full transition-all ${
            activeTypeFilter === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          Todos ({items.length})
        </button>

        <button
          onClick={() => setActiveTypeFilter('vocabulary')}
          className={`px-3.5 py-1.5 rounded-full transition-all ${
            activeTypeFilter === 'vocabulary'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
          }`}
        >
          Vocabulário ({vocabItems.length})
        </button>

        <button
          onClick={() => setActiveTypeFilter('survival_phrase')}
          className={`px-3.5 py-1.5 rounded-full transition-all ${
            activeTypeFilter === 'survival_phrase'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          Frases ({phraseItems.length})
        </button>

        <button
          onClick={() => setActiveTypeFilter('phrasal_verb')}
          className={`px-3.5 py-1.5 rounded-full transition-all ${
            activeTypeFilter === 'phrasal_verb'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
          }`}
        >
          Phrasal Verbs ({pvItems.length})
        </button>
      </div>

      {/* Items List */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm font-medium">
          Carregando fila diária...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 space-y-3">
          <p className="text-slate-500 text-sm">Nenhum item nesta categoria hoje.</p>
          <button
            onClick={() => setActiveTypeFilter('all')}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Ver todos os 10 itens
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredItems.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
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
