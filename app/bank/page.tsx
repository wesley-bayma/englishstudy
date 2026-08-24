'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ContentItem, ContentType, ContentSource, AnkiStatus } from '../../lib/types';
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
  const pageSize = 40;

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
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Banco de Conteúdo</h1>
              <p className="text-xs text-slate-500 font-medium">
                {totalCount} itens cadastrados • Base original e Inbox
              </p>
            </div>
          </div>

          <Link
            href="/add"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionar Novo</span>
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
            className="w-full px-4 py-3 pl-11 pr-10 rounded-2xl border-2 border-slate-200 focus:border-indigo-500 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills Grid / Scroll */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold">
            {/* Source */}
            <button
              onClick={() => { setSourceFilter('all'); setPage(0); }}
              className={`px-3 py-1.5 rounded-full transition-all ${
                sourceFilter === 'all' && !onlyEncountered
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos
            </button>

            <button
              onClick={() => { setSourceFilter('base'); setPage(0); }}
              className={`px-3 py-1.5 rounded-full transition-all ${
                sourceFilter === 'base'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Base (3.250)
            </button>

            <button
              onClick={() => { setSourceFilter('inbox'); setPage(0); }}
              className={`px-3 py-1.5 rounded-full transition-all ${
                sourceFilter === 'inbox'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Meus Achados (Inbox)
            </button>

            <button
              onClick={() => { setOnlyEncountered(!onlyEncountered); setPage(0); }}
              className={`px-3 py-1.5 rounded-full flex items-center gap-1 transition-all ${
                onlyEncountered
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Mais Encontrados
            </button>
          </div>

          {/* Type and Anki status filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-medium">
            <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider pl-1 mr-1">Tipo:</span>
            
            <button
              onClick={() => { setTypeFilter(typeFilter === 'vocabulary' ? 'all' : 'vocabulary'); setPage(0); }}
              className={`px-2.5 py-1 rounded-lg border transition-all ${
                typeFilter === 'vocabulary'
                  ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Vocabulário
            </button>

            <button
              onClick={() => { setTypeFilter(typeFilter === 'survival_phrase' ? 'all' : 'survival_phrase'); setPage(0); }}
              className={`px-2.5 py-1 rounded-lg border transition-all ${
                typeFilter === 'survival_phrase'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-700 font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Frases
            </button>

            <button
              onClick={() => { setTypeFilter(typeFilter === 'phrasal_verb' ? 'all' : 'phrasal_verb'); setPage(0); }}
              className={`px-2.5 py-1 rounded-lg border transition-all ${
                typeFilter === 'phrasal_verb'
                  ? 'bg-amber-50 border-amber-400 text-amber-700 font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Phrasal Verbs
            </button>

            <span className="text-slate-300">|</span>

            {/* Anki status */}
            <button
              onClick={() => { setAnkiFilter(ankiFilter === 'created' ? 'all' : 'created'); setPage(0); }}
              className={`px-2.5 py-1 rounded-lg border transition-all ${
                ankiFilter === 'created'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              ✅ Já no Anki
            </button>

            <button
              onClick={() => { setAnkiFilter(ankiFilter === 'not_created' ? 'all' : 'not_created'); setPage(0); }}
              className={`px-2.5 py-1 rounded-lg border transition-all ${
                ankiFilter === 'not_created'
                  ? 'bg-slate-900 border-slate-900 text-white font-bold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              ⏳ Pendentes
            </button>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-auto pl-2 whitespace-nowrap"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Items Results */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm font-medium">
          Buscando registros no banco...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 space-y-3">
          <p className="text-slate-600 font-medium">Nenhum item encontrado com os filtros selecionados.</p>
          {query && (
            <Link
              href={`/add`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-500/20"
            >
              <PlusCircle className="w-4 h-4" />
              Adicionar &ldquo;{query}&rdquo; à Inbox
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {items.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
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

          {/* Pagination Controls */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700">
              <span>
                Mostrando {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} de {totalCount}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  &larr; Anterior
                </button>
                <span className="font-mono">Página {page + 1}</span>
                <button
                  disabled={(page + 1) * pageSize >= totalCount}
                  onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  Próxima &rarr;
                </button>
              </div>
            </div>
          )}
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
