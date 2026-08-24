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
      // Reset
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <Flame className="w-5 h-5 fill-rose-500 text-rose-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Registrar Encontro Natural</h2>
              <p className="text-xs text-slate-500">
                Termo: <span className="font-semibold text-slate-800">{item.content}</span> ({item.times_encountered} anteriores)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* Source Selector Pills */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
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
                    className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-100 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Context Sentence */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Frase do contexto <span className="text-slate-400 font-normal">(opcional, mas recomendado)</span>
            </label>
            <input
              type="text"
              placeholder={`Ex: "I forgot my ${item.content} at home."`}
              value={contextSentence}
              onChange={(e) => setContextSentence(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Source detail & Timestamp in row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome/Canal <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Friends T02E04"
                value={sourceDetail}
                onChange={(e) => setSourceDetail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Timestamp <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 08:37"
                value={timestampMarker}
                onChange={(e) => setTimestampMarker(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Link / URL <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Submit Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20 active:scale-95 transition-all"
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
