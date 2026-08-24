'use client';

import React, { useState } from 'react';
import { ContentItem, ContentSource } from '../lib/types';
import { recordEncounter } from '../lib/db';
import { 
  X, 
  Flame, 
  Youtube, 
  Radio, 
  Book, 
  Film, 
  Tv, 
  MessageSquare, 
  Headphones, 
  Compass, 
  Clock, 
  Check
} from 'lucide-react';

interface EncounterModalProps {
  item: ContentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedItem: ContentItem) => void;
}

export function EncounterModal({
  item,
  isOpen,
  onClose,
  onSuccess
}: EncounterModalProps) {
  const [source, setSource] = useState<ContentSource>('youtube');
  const [sourceDetail, setSourceDetail] = useState('');
  const [timestampMarker, setTimestampMarker] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [contextSentence, setContextSentence] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !item) return null;

  const sourceOptions: { id: ContentSource; label: string; icon: any }[] = [
    { id: 'youtube', label: 'YouTube', icon: Youtube },
    { id: 'podcast', label: 'Podcast', icon: Radio },
    { id: 'book', label: 'Livro', icon: Book },
    { id: 'movie', label: 'Filme', icon: Film },
    { id: 'series', label: 'Série', icon: Tv },
    { id: 'audio', label: 'Áudio', icon: Headphones },
    { id: 'conversation', label: 'Conversa', icon: MessageSquare },
    { id: 'other', label: 'Outro', icon: Compass },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    setIsSubmitting(true);
    try {
      await recordEncounter(item.id, {
        source,
        source_detail: sourceDetail.trim() || null,
        source_url: sourceUrl.trim() || null,
        timestamp_marker: timestampMarker.trim() || null,
        context_sentence: contextSentence.trim() || null,
        notes: notes.trim() || null
      });

      const updated: ContentItem = {
        ...item,
        times_encountered: (item.times_encountered || 0) + 1,
        last_encountered: new Date().toISOString()
      };

      onSuccess(updated);
      onClose();
      setSourceDetail('');
      setTimestampMarker('');
      setSourceUrl('');
      setContextSentence('');
      setNotes('');
    } catch (error) {
      console.error('Failed to record encounter:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-bg/85 backdrop-blur-xl animate-in fade-in duration-150">
      <div className="bg-dark-card rounded-[32px] w-full max-w-lg shadow-2xl border border-dark-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-dark-border flex items-center justify-between bg-dark-bg/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Flame className="w-5 h-5 fill-rose-500 text-rose-500" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Registrar Encontro Natural</h2>
              <p className="text-xs text-slate-400 font-mono">
                Termo: <span className="font-bold text-white">{item.content}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-dark-border transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {/* Source Selector */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
              Onde você encontrou?
            </label>
            <div className="grid grid-cols-4 gap-2">
              {sourceOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = source === opt.id;
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setSource(opt.id)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl text-xs font-bold border transition-all ${
                      isSelected
                        ? 'bg-card-lime border-card-lime text-dark-bg ring-2 ring-card-lime/20 shadow-md'
                        : 'bg-dark-bg border-dark-border text-slate-300 hover:bg-dark-border'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-dark-bg' : 'text-slate-400'}`} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Context Sentence */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
              Frase do contexto
            </label>
            <input
              type="text"
              placeholder={`Ex: "I forgot my ${item.content} at home."`}
              value={contextSentence}
              onChange={(e) => setContextSentence(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-dark-bg border border-dark-border text-white text-sm focus:outline-none focus:border-card-lime focus:ring-2 focus:ring-card-lime/10"
            />
          </div>

          {/* Source Detail & Timestamp */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                Nome/Canal
              </label>
              <input
                type="text"
                placeholder="Ex: Friends T02E04"
                value={sourceDetail}
                onChange={(e) => setSourceDetail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-dark-bg border border-dark-border text-white text-xs focus:outline-none focus:border-card-lime"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                Timestamp
              </label>
              <input
                type="text"
                placeholder="Ex: 08:37"
                value={timestampMarker}
                onChange={(e) => setTimestampMarker(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-dark-bg border border-dark-border text-white text-xs focus:outline-none focus:border-card-lime"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-4 border-t border-dark-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-xs font-bold text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 active:scale-95 transition-all"
            >
              <Flame className="w-4 h-4 fill-white" />
              {isSubmitting ? 'Registrando...' : 'Registrar Encontro (+1)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
