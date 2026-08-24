'use client';

import React, { useState } from 'react';
import { ContentItem, ContentType, ContentSource, GeminiAnalysisResult } from '../../lib/types';
import { findExact, addInboxItem, getDB } from '../../lib/db';
import { normalizeContent, getBasicLemmaCandidates } from '../../lib/normalizer';
import { analyzeWithGemini } from '../../lib/gemini';
import { DuplicateMatchCard } from '../../components/DuplicateMatchCard';
import { ItemDetailModal } from '../../components/ItemDetailModal';
import { EncounterModal } from '../../components/EncounterModal';
import { 
  PlusCircle, 
  Search, 
  Sparkles, 
  Check, 
  ArrowRight, 
  Youtube, 
  Radio, 
  Book, 
  Film, 
  Tv, 
  MessageSquare, 
  Headphones, 
  Compass,
  AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AddPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasVerified, setHasVerified] = useState(false);

  // Verification results
  const [exactMatch, setExactMatch] = useState<ContentItem | null>(null);
  const [aiMatch, setAiMatch] = useState<GeminiAnalysisResult | null>(null);
  const [candidateItem, setCandidateItem] = useState<ContentItem | null>(null);
  const [forceShowAddForm, setForceShowAddForm] = useState(false);

  // New item form fields
  const [contentType, setContentType] = useState<ContentType>('vocabulary');
  const [source, setSource] = useState<ContentSource>('youtube');
  const [sourceDetail, setSourceDetail] = useState('');
  const [timestampMarker, setTimestampMarker] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [contextSentence, setContextSentence] = useState('');
  const [meaningPt, setMeaningPt] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEncounterOpen, setIsEncounterOpen] = useState(false);

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

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = query.trim();
    if (!clean) return;

    setIsVerifying(true);
    setHasVerified(false);
    setExactMatch(null);
    setAiMatch(null);
    setCandidateItem(null);
    setForceShowAddForm(false);
    setSuccessMessage(null);

    try {
      // 1. DETERMINISTIC LOCAL SEARCH FIRST (0ms latency, zero AI cost)
      const exact = await findExact(clean);
      if (exact) {
        setExactMatch(exact);
        setHasVerified(true);
        setIsVerifying(false);
        return; // Done without AI
      }

      // 2. Local Candidate search for morphology / phrases
      const db = getDB();
      const norm = normalizeContent(clean);
      const lemmaCandidates = getBasicLemmaCandidates(norm);

      // Find if any candidate exists in DB
      let matchedCandidate: ContentItem | null = null;
      if (lemmaCandidates.length > 0) {
        const found = await db.content_items
          .where('normalized_content')
          .anyOf(lemmaCandidates)
          .first();
        if (found) {
          matchedCandidate = found;
        }
      }

      // If no morphological candidate, search for potential phrase candidates sharing key words
      const candidateListForAI: string[] = [];
      if (matchedCandidate) {
        candidateListForAI.push(matchedCandidate.content);
      }

      // Add a few phrase / vocab candidates if relevant
      if (clean.includes(' ')) {
        const words = norm.split(' ').filter(w => w.length > 3);
        if (words.length > 0) {
          const samplePhrases = await db.content_items
            .where('type')
            .anyOf(['survival_phrase', 'phrasal_verb'])
            .limit(100)
            .toArray();

          const related = samplePhrases.filter(p => 
            words.some(w => p.normalized_content.includes(w))
          ).slice(0, 5);

          related.forEach(r => candidateListForAI.push(r.content));
        }
      }

      // 3. CALL GEMINI FLASH FOR VARIANT / SEMANTIC ANALYSIS
      const aiResult = await analyzeWithGemini(clean, candidateListForAI, contextSentence);
      setAiMatch(aiResult);

      // If AI identified a match to an existing item, retrieve that item from DB
      if (aiResult.has_possible_match && aiResult.matched_existing_content) {
        const matchInDb = await findExact(aiResult.matched_existing_content);
        setCandidateItem(matchInDb || matchedCandidate);
      } else if (matchedCandidate && (aiResult.similarity_type === 'inflection' || norm.startsWith(matchedCandidate.normalized_content))) {
        setCandidateItem(matchedCandidate);
      }

      // Auto-populate form suggestions if adding
      setContentType(aiResult.classification || (clean.split(' ').length > 3 ? 'survival_phrase' : 'vocabulary'));
      setMeaningPt(aiResult.meaning_pt || '');
      if (aiResult.suggested_example && !contextSentence) {
        setContextSentence(aiResult.suggested_example);
      }

      setHasVerified(true);
    } catch (err) {
      console.error('Verification error:', err);
      setHasVerified(true);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveToInbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSaving(true);
    try {
      const saved = await addInboxItem({
        content: query.trim(),
        type: contentType,
        source,
        source_detail: sourceDetail.trim() || null,
        source_url: sourceUrl.trim() || null,
        timestamp_marker: timestampMarker.trim() || null,
        context_sentence: contextSentence.trim() || null,
        notes: notes.trim() || null,
        meaning_pt: meaningPt.trim() || null,
        example: contextSentence.trim() || null,
        base_form: aiMatch?.base_form || query.trim()
      });

      setSuccessMessage(`"${saved.content}" foi adicionado com sucesso à sua Inbox!`);
      // Reset form
      setQuery('');
      setHasVerified(false);
      setExactMatch(null);
      setAiMatch(null);
      setCandidateItem(null);
      setContextSentence('');
      setSourceDetail('');
      setTimestampMarker('');
      setSourceUrl('');
      setMeaningPt('');
      setNotes('');
    } catch (err) {
      console.error('Failed to save to inbox:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegisterEncounterOnExisting = (item: ContentItem) => {
    setSelectedItem(item);
    setIsEncounterOpen(true);
  };

  const handleViewExisting = (item: ContentItem) => {
    setSelectedItem(item);
    setIsDetailOpen(true);
  };

  const isDuplicateOrVariant = exactMatch || (aiMatch?.has_possible_match && candidateItem);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Adicionar à Inbox</h1>
            <p className="text-xs text-slate-500 font-medium">
              Verifique duplicatas e registre novos achados em menos de 15 segundos
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-800 font-semibold animate-in fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              <span>{successMessage}</span>
            </div>
            <button 
              onClick={() => router.push('/bank')}
              className="text-xs text-emerald-700 hover:underline font-bold"
            >
              Ver no Banco &rarr;
            </button>
          </div>
        )}

        {/* Primary Input Box */}
        <form onSubmit={handleVerify} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              O que você encontrou?
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: awkward, wallet, Where's the bathroom?, find out..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (hasVerified) setHasVerified(false);
                }}
                className="w-full px-4 py-3.5 pl-11 rounded-2xl border-2 border-slate-200 focus:border-blue-500 text-base font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
                autoFocus
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={!query.trim() || isVerifying}
            className="w-full py-3 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-sm shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                Verificando no banco e IA...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Verificar Disponibilidade
              </>
            )}
          </button>
        </form>
      </div>

      {/* Verification Result Section */}
      {hasVerified && !forceShowAddForm && isDuplicateOrVariant && (
        <DuplicateMatchCard
          inputQuery={query.trim()}
          exactMatch={exactMatch}
          aiMatch={aiMatch}
          existingCandidate={candidateItem}
          onRegisterEncounterOnExisting={handleRegisterEncounterOnExisting}
          onAddNewAnyway={() => setForceShowAddForm(true)}
          onDiscard={() => {
            setQuery('');
            setHasVerified(false);
          }}
          onViewExisting={handleViewExisting}
        />
      )}

      {/* New Item Form (Shows if no duplicate OR if user clicked 'Adicionar mesmo assim') */}
      {hasVerified && (!isDuplicateOrVariant || forceShowAddForm) && (
        <form onSubmit={handleSaveToInbox} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">Novo Conteúdo</span>
              <h3 className="text-lg font-bold text-slate-900">&ldquo;{query.trim()}&rdquo; pronto para salvar</h3>
            </div>
            {aiMatch && aiMatch.confidence > 0.5 && (
              <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Classificado por IA
              </span>
            )}
          </div>

          {/* Type Selector Pills */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Classificação
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'vocabulary' as ContentType, label: 'Vocabulário', color: 'blue' },
                { id: 'survival_phrase' as ContentType, label: 'Frase', color: 'emerald' },
                { id: 'phrasal_verb' as ContentType, label: 'Phrasal Verb', color: 'amber' },
              ].map((t) => {
                const isSel = contentType === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setContentType(t.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      isSel 
                        ? t.color === 'blue'
                          ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-100'
                          : t.color === 'emerald'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-100'
                            : 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-100'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Meaning / Translation in Portuguese */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Significado / Tradução em português <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ex: constrangedor, estranho"
              value={meaningPt}
              onChange={(e) => setMeaningPt(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Context Sentence */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Frase de Contexto <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              placeholder={`Ex: "That was awkward."`}
              value={contextSentence}
              onChange={(e) => setContextSentence(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Source Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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

          {/* Source Details & Timestamp */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nome/Canal <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Podcast do Luke"
                value={sourceDetail}
                onChange={(e) => setSourceDetail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setHasVerified(false);
                setForceShowAddForm(false);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 active:scale-95 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Adicionar à Inbox'}
            </button>
          </div>
        </form>
      )}

      {/* Item Detail Modal */}
      <ItemDetailModal
        item={selectedItem}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onItemUpdated={(upd) => setSelectedItem(upd)}
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
        onSuccess={(upd) => setSelectedItem(upd)}
      />
    </div>
  );
}
