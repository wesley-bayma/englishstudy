'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ContentItem, ContentType, ContentSource } from '../../lib/types';
import { searchContentItems, toggleAnkiStatus } from '../../lib/db';
import { ContentCard } from '../../components/ContentCard';
import { ItemDetailModal } from '../../components/ItemDetailModal';
import { EncounterModal } from '../../components/EncounterModal';
import { 
  Search, 
  BookOpen, 
  Flame, 
  Check, 
  Clock, 
  Layers, 
  SlidersHorizontal,
  PlusCircle,
  X
} from 'lucide-react';
import Link from 'next/link';

export default function BankPage() {
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'base' | 'inbox'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ContentType>('all');
  const [ankiFilter, setAnkiFilter] = useState<'all' | 'created' | 'not_created'>('all');
  const [onlyEncountered, setOnlyEncountered] = useState(false);

  const [items, setItems] = useState<ContentItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 30;

  // Modals
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEncounterOpen, setIsEncounterOpen] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await searchContentItems({
        query,
        sourceFilter,
        typeFilter,
        ankiFilter,
        onlyEncountered,
        limit: pageSize,
        offset: page * pageSize
      });
      setItems(res.items);
      setTotalCount(res.total);
    } catch (err) {
      console.error('Error fetching bank items:', err);
    } finally {
      setLoading(false);
    }
  }, [query, sourceFilter, typeFilter, ankiFilter, onlyEncountered, page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleToggleAnki = async (item: ContentItem) => {
    try {
      const newStatus = await toggleAnkiStatus(item.id);
      const updated = {
        ...item,
        anki_status: newStatus,
        anki_created_at: newStatus === 'created' ? new Date().toISOString() : null
      };
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
      if (selectedItem && selectedItem.id === item.id) {
        setSelectedItem(updated);
      }
    } catch (err) {
      console.error('Failed to toggle Anki status:', err);
    }
  };

  const handleItemUpdated = (updated: ContentItem) => {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    if (selectedItem && selectedItem.id === updated.id) {
      setSelectedItem(updated);
    }
  };

  const resetFilters = () => {
    setQuery('');
    setSourceFilter('all');
    setTypeFilter('all');
    setAnkiFilter('all');
    setOnlyEncountered(false);
    setPage(0);
  };

  const hasActiveFilters = query || sourceFilter !== 'all' || typeFilter !== 'all' || ankiFilter !== 'all' || onlyEncountered;

  return (
    <div className="space-y-8 pt-4">
      {/* Header Banner */}
      <div className="bg-dark-card rounded-[32px] p-6 sm:p-8 border border-dark-border shadow-2xl space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold tracking-widest text-card-lime uppercase">
              // Biblioteca Geral
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Banco de Conteúdo
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-mono">
              {totalCount} itens cadastrados no total
            </p>
          </div>

          <Link
            href="/add"
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-card-lime hover:bg-card-limeDark text-dark-bg font-black text-xs shadow-lg active:scale-95 transition-all"
          >
            <PlusCircle className="w-4 h-4 stroke-[2.5]" />
            Adicionar Novo
          </Link>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar palavra, frase, phrasal verb ou significado..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            className="w-full px-5 py-4 pl-12 pr-12 rounded-2xl bg-dark-bg border-2 border-dark-border focus:border-card-lime text-white text-sm font-medium focus:outline-none focus:ring-4 focus:ring-card-lime/10 transition-all placeholder:text-slate-500"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
            <button
              onClick={() => { setSourceFilter('all'); setPage(0); }}
              className={`px-4 py-2 rounded-full transition-all ${
                sourceFilter === 'all' && !onlyEncountered
                  ? 'bg-white text-dark-bg shadow-sm'
                  : 'bg-dark-bg text-slate-400 hover:text-white border border-dark-border'
              }`}
            >
              Todos
            </button>

            <button
              onClick={() => { setSourceFilter('base'); setPage(0); }}
              className={`px-4 py-2 rounded-full transition-all ${
                sourceFilter === 'base'
                  ? 'bg-white text-dark-bg shadow-sm'
                  : 'bg-dark-bg text-slate-400 hover:text-white border border-dark-border'
              }`}
            >
              Base (3.250)
            </button>

            <button
              onClick={() => { setSourceFilter('inbox'); setPage(0); }}
              className={`px-4 py-2 rounded-full transition-all ${
                sourceFilter === 'inbox'
                  ? 'bg-card-pink text-dark-bg font-black shadow-sm'
                  : 'bg-dark-bg text-card-pink hover:bg-dark-border border border-dark-border'
              }`}
            >
              Meus Achados (Inbox)
            </button>

            <button
              onClick={() => { setOnlyEncountered(!onlyEncountered); setPage(0); }}
              className={`px-4 py-2 rounded-full flex items-center gap-1.5 transition-all ${
                onlyEncountered
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-dark-bg text-rose-400 hover:bg-rose-950/40 border border-rose-900/40'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Mais Encontrados
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-medium">
            <button
              onClick={() => { setTypeFilter(typeFilter === 'vocabulary' ? 'all' : 'vocabulary'); setPage(0); }}
              className={`px-3 py-1.5 rounded-xl border transition-all ${
                typeFilter === 'vocabulary'
                  ? 'bg-card-pink text-dark-bg border-card-pink font-bold'
                  : 'bg-dark-bg border-dark-border text-slate-400 hover:text-white'
              }`}
            >
              Vocabulário
            </button>

            <button
              onClick={() => { setTypeFilter(typeFilter === 'survival_phrase' ? 'all' : 'survival_phrase'); setPage(0); }}
              className={`px-3 py-1.5 rounded-xl border transition-all ${
                typeFilter === 'survival_phrase'
                  ? 'bg-card-lime text-dark-bg border-card-lime font-bold'
                  : 'bg-dark-bg border-dark-border text-slate-400 hover:text-white'
              }`}
            >
              Frases
            </button>

            <button
              onClick={() => { setTypeFilter(typeFilter === 'phrasal_verb' ? 'all' : 'phrasal_verb'); setPage(0); }}
              className={`px-3 py-1.5 rounded-xl border transition-all ${
                typeFilter === 'phrasal_verb'
                  ? 'bg-card-amber text-dark-bg border-card-amber font-bold'
                  : 'bg-dark-bg border-dark-border text-slate-400 hover:text-white'
              }`}
            >
              Phrasal Verbs
            </button>

            <span className="text-dark-border">|</span>

            <button
              onClick={() => { setAnkiFilter(ankiFilter === 'created' ? 'all' : 'created'); setPage(0); }}
              className={`px-3 py-1.5 rounded-xl border transition-all ${
                ankiFilter === 'created'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold'
                  : 'bg-dark-bg border-dark-border text-slate-400 hover:text-white'
              }`}
            >
              ✅ Já no Anki
            </button>

            <button
              onClick={() => { setAnkiFilter(ankiFilter === 'not_created' ? 'all' : 'not_created'); setPage(0); }}
              className={`px-3 py-1.5 rounded-xl border transition-all ${
                ankiFilter === 'not_created'
                  ? 'bg-white text-dark-bg border-white font-bold'
                  : 'bg-dark-bg border-dark-border text-slate-400 hover:text-white'
              }`}
            >
              ⏳ Pendentes
            </button>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-slate-400 hover:text-white underline ml-auto pl-2 whitespace-nowrap"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid Results */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 font-mono text-sm">
          // Buscando registros no banco...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-dark-card rounded-[32px] p-12 text-center border border-dark-border space-y-3">
          <p className="text-slate-400 text-sm">Nenhum item encontrado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {items.map((item, idx) => (
              <ContentCard
                key={item.id}
                item={item}
                index={page * pageSize + idx + 1}
                onMarkCreated={handleToggleAnki}
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

          {/* Pagination */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-between bg-dark-card p-4 rounded-2xl border border-dark-border text-xs font-bold text-slate-300 font-mono">
              <span>
                {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} de {totalCount}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  className="px-4 py-2 rounded-xl bg-dark-bg border border-dark-border disabled:opacity-30 hover:bg-dark-border text-white transition-colors"
                >
                  &larr; Anterior
                </button>
                <span>Página {page + 1}</span>
                <button
                  disabled={(page + 1) * pageSize >= totalCount}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 rounded-xl bg-dark-bg border border-dark-border disabled:opacity-30 hover:bg-dark-border text-white transition-colors"
                >
                  Próxima &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
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

      <EncounterModal
        item={selectedItem}
        isOpen={isEncounterOpen}
        onClose={() => setIsEncounterOpen(false)}
        onSuccess={handleItemUpdated}
      />
    </div>
  );
}
