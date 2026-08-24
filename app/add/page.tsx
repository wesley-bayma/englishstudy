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

  // Results
  const [exactMatch, setExactMatch] = useState<ContentItem | null>(null);
  const [aiMatch, setAiMatch] = useState<GeminiAnalysisResult | null>(null);
  const [candidateItem, setCandidateItem] = useState<ContentItem | null>(null);
  const [forceShowAddForm, setForceShowAddForm] = useState(false);

  // Form fields
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
      // 1. DETERMINISTIC LOCAL SEARCH (0ms)
      const exact = await findExact(clean);
      if (exact) {
        setExactMatch(exact);
        setHasVerified(true);
        setIsVerifying(false);
        return;
      }

      // 2. Candidate morphology check
      const db = getDB();
      const norm = normalizeContent(clean);
      const lemmaCandidates = getBasicLemmaCandidates(norm);

      let matchedCandidate: ContentItem | null = null;
      if (lemmaCandidates.length > 0) {
        const found = await db.content_items
          .where('normalized_content')
          .anyOf(lemmaCandidates)
          .first();
        if (found) matchedCandidate = found;
      }

      const candidateListForAI: string[] = [];
      if (matchedCandidate) candidateListForAI.push(matchedCandidate.content);

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

      // 3. GEMINI FLASH STRUCTURED CALL
      const aiResult = await analyzeWithGemini(clean, candidateListForAI, contextSentence);
      setAiMatch(aiResult);

      if (aiResult.has_possible_match && aiResult.matched_existing_content) {
        const matchInDb = await findExact(aiResult.matched_existing_content);
        setCandidateItem(matchInDb || matchedCandidate);
      } else if (matchedCandidate && (aiResult.similarity_type === 'inflection' || norm.startsWith(matchedCandidate.normalized_content))) {
        setCandidateItem(matchedCandidate);
      }

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

  const isDuplicateOrVariant = exactMatch || (aiMatch?.has_possible_match && candidateItem);

  return (
    <div className="space-y-8 max-w-2xl mx-auto pt-4">
      {/* Header */}
      <div className="bg-dark-card rounded-[32px] p-6 sm:p-8 border border-dark-border shadow-2xl space-y-6">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold tracking-widest text-card-lime uppercase">
            // Curadoria Rápida & Inbox
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Adicionar Novo Conteúdo
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Verifique instantaneamente no banco antes de registrar.
          </p>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-4 bg-card-lime/10 border border-card-lime/30 rounded-2xl flex items-center justify-between text-xs text-card-lime font-bold animate-in fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{successMessage}</span>
            </div>
            <button 
              onClick={() => router.push('/bank')}
              className="text-xs text-white hover:underline font-bold"
            >
              Ver no Banco &rarr;
            </button>
          </div>
        )}

        {/* Input Box */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2">
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
                className="w-full px-5 py-4 pl-12 rounded-2xl bg-dark-bg border-2 border-dark-border focus:border-card-lime text-white text-base font-medium focus:outline-none focus:ring-4 focus:ring-card-lime/10 transition-all placeholder:text-slate-500"
                autoFocus
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={!query.trim() || isVerifying}
            className="w-full py-4 px-6 rounded-full bg-card-lime hover:bg-card-limeDark disabled:bg-dark-border disabled:text-slate-500 text-dark-bg font-black text-sm shadow-xl shadow-card-lime/10 active:scale-98 transition-all flex items-center justify-center gap-2"
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

      {/* Verification Result */}
      {hasVerified && !forceShowAddForm && isDuplicateOrVariant && (
        <DuplicateMatchCard
          inputQuery={query.trim()}
          exactMatch={exactMatch}
          aiMatch={aiMatch}
          existingCandidate={candidateItem}
          onRegisterEncounterOnExisting={(it) => {
            setSelectedItem(it);
            setIsEncounterOpen(true);
          }}
          onAddNewAnyway={() => setForceShowAddForm(true)}
          onDiscard={() => {
            setQuery('');
            setHasVerified(false);
          }}
          onViewExisting={(it) => {
            setSelectedItem(it);
            setIsDetailOpen(true);
          }}
        />
      )}

      {/* New Item Form */}
      {hasVerified && (!isDuplicateOrVariant || forceShowAddForm) && (
        <form onSubmit={handleSaveToInbox} className="bg-dark-card rounded-[32px] p-6 sm:p-8 border border-dark-border shadow-2xl space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-dark-border">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-card-lime block">
                // Novo Conteúdo Disponível
              </span>
              <h3 className="text-xl font-black text-white">&ldquo;{query.trim()}&rdquo;</h3>
            </div>
            {aiMatch && aiMatch.confidence > 0.5 && (
              <span className="text-[11px] font-mono bg-dark-bg text-card-lime px-3 py-1 rounded-full border border-card-lime/30 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Classificado por IA
              </span>
            )}
          </div>

          {/* Classification Pills */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2">
              Classificação
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'vocabulary' as ContentType, label: 'Vocabulário', color: 'pink' },
                { id: 'survival_phrase' as ContentType, label: 'Frase', color: 'lime' },
                { id: 'phrasal_verb' as ContentType, label: 'Phrasal Verb', color: 'amber' },
              ].map((t) => {
                const isSel = contentType === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setContentType(t.id)}
                    className={`py-2.5 px-3 rounded-2xl text-xs font-black border transition-all ${
                      isSel 
                        ? t.color === 'pink'
                          ? 'bg-card-pink text-dark-bg border-card-pink ring-2 ring-card-pink/20'
                          : t.color === 'lime'
                            ? 'bg-card-lime text-dark-bg border-card-lime ring-2 ring-card-lime/20'
                            : 'bg-card-amber text-dark-bg border-card-amber ring-2 ring-card-amber/20'
                        : 'bg-dark-bg border-dark-border text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Meaning / Translation */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1">
              Significado em português
            </label>
            <input
              type="text"
              placeholder="Ex: constrangedor, estranho"
              value={meaningPt}
              onChange={(e) => setMeaningPt(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-dark-bg border border-dark-border text-white text-sm focus:outline-none focus:border-card-lime"
            />
          </div>

          {/* Context */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1">
              Frase de Contexto
            </label>
            <input
              type="text"
              placeholder={`Ex: "That was awkward."`}
              value={contextSentence}
              onChange={(e) => setContextSentence(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-dark-bg border border-dark-border text-white text-sm focus:outline-none focus:border-card-lime"
            />
          </div>

          {/* Source Selector */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2">
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
                        ? 'bg-card-lime border-card-lime text-dark-bg shadow-md'
                        : 'bg-dark-bg border-dark-border text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-dark-bg' : 'text-slate-400'}`} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-4 border-t border-dark-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setHasVerified(false);
                setForceShowAddForm(false);
              }}
              className="px-5 py-3 rounded-full text-xs font-bold text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-7 py-3 rounded-full text-xs font-black bg-card-lime hover:bg-card-limeDark text-dark-bg shadow-xl shadow-card-lime/10 active:scale-95 transition-all"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.5]" />
              {isSaving ? 'Salvando...' : 'Adicionar à Inbox'}
            </button>
          </div>
        </form>
      )}

      {/* Modals */}
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

      <EncounterModal
        item={selectedItem}
        isOpen={isEncounterOpen}
        onClose={() => setIsEncounterOpen(false)}
        onSuccess={(upd) => setSelectedItem(upd)}
      />
    </div>
  );
}
