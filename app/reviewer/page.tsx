'use client';

import React, { useState } from 'react';
import { ContentType, CardReviewResult } from '../../lib/types';
import { reviewCardWithGemini } from '../../lib/gemini';
import { 
  CheckSquare, 
  Sparkles, 
  Check, 
  AlertTriangle, 
  XCircle, 
  BookOpen, 
  Lightbulb, 
  Copy,
  ArrowRight
} from 'lucide-react';

export default function ReviewerPage() {
  const [type, setType] = useState<ContentType>('vocabulary');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [result, setResult] = useState<CardReviewResult | null>(null);

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;

    setIsReviewing(true);
    setResult(null);

    try {
      const res = await reviewCardWithGemini(front.trim(), back.trim(), type);
      setResult(res);
    } catch (err) {
      console.error('Failed to review card:', err);
    } finally {
      setIsReviewing(false);
    }
  };

  const loadExample = (exType: ContentType) => {
    setType(exType);
    if (exType === 'vocabulary') {
      setFront('I forgot my (carteira) again.');
      setBack('wallet /ˈwɑː.lət/\nI forgot my wallet again.\n🔊 Áudio no verso.');
    } else if (exType === 'survival_phrase') {
      setFront('Could you speak (..?)?\nVocê poderia falar mais devagar?');
      setBack('Could you speak more slowly?\n🔊 Áudio no verso.');
    } else {
      setFront('I need to (PV: descobrir) the truth.');
      setBack('find out — finding out — found out\nI need to find out the truth.\n🔊 Áudio no verso.');
    }
    setResult(null);
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto pt-4">
      {/* Header */}
      <div className="bg-dark-card rounded-[32px] p-6 sm:p-8 border border-dark-border shadow-2xl space-y-6">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold tracking-widest text-card-lime uppercase">
            // Avaliação Canônica de Flashcards
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Revisar Meu Card
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            Verifique se seu card atende aos critérios de recuperação ativa antes de salvar no Anki.
          </p>
        </div>

        {/* Example Pills */}
        <div className="bg-dark-bg p-4 rounded-2xl border border-dark-border space-y-2">
          <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
            Carregar exemplos canônicos:
          </span>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <button
              onClick={() => loadExample('vocabulary')}
              className="px-3.5 py-1.5 rounded-full bg-card-pink text-dark-bg font-black hover:brightness-105 transition-all"
            >
              Vocabulário
            </button>
            <button
              onClick={() => loadExample('survival_phrase')}
              className="px-3.5 py-1.5 rounded-full bg-card-lime text-dark-bg font-black hover:brightness-105 transition-all"
            >
              Frase
            </button>
            <button
              onClick={() => loadExample('phrasal_verb')}
              className="px-3.5 py-1.5 rounded-full bg-card-amber text-dark-bg font-black hover:brightness-105 transition-all"
            >
              Phrasal Verb
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleReview} className="space-y-5">
          {/* Card Type Selector */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2">
              Tipo do Card
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'vocabulary' as ContentType, label: 'Vocabulário', color: 'pink' },
                { id: 'survival_phrase' as ContentType, label: 'Frase', color: 'lime' },
                { id: 'phrasal_verb' as ContentType, label: 'Phrasal Verb', color: 'amber' },
              ].map((t) => {
                const isSel = type === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setType(t.id)}
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

          {/* FRONT */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1">
              Frente do Card (Front)
            </label>
            <textarea
              rows={3}
              placeholder="Cole o que você colocou na frente do flashcard..."
              value={front}
              onChange={(e) => setFront(e.target.value)}
              className="w-full p-4 rounded-2xl bg-dark-bg border border-dark-border focus:border-card-lime text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-card-lime/10 transition-all placeholder:text-slate-500 resize-none"
            />
          </div>

          {/* BACK */}
          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1">
              Verso do Card (Back)
            </label>
            <textarea
              rows={4}
              placeholder="Cole o que você colocou no verso do flashcard..."
              value={back}
              onChange={(e) => setBack(e.target.value)}
              className="w-full p-4 rounded-2xl bg-dark-bg border border-dark-border focus:border-card-lime text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-card-lime/10 transition-all placeholder:text-slate-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!front.trim() || !back.trim() || isReviewing}
            className="w-full py-4 px-6 rounded-full bg-card-lime hover:bg-card-limeDark disabled:bg-dark-border disabled:text-slate-500 text-dark-bg font-black text-sm shadow-xl shadow-card-lime/10 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            {isReviewing ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                Avaliando com Gemini Flash...
              </>
            ) : (
              <>
                <CheckSquare className="w-4 h-4" />
                Avaliar Qualidade do Card
              </>
            )}
          </button>
        </form>
      </div>

      {/* Review Feedback Result */}
      {result && (
        <div className={`rounded-[32px] p-6 sm:p-7 border-2 shadow-2xl space-y-4 animate-in fade-in duration-200 ${
          result.status === 'good'
            ? 'bg-dark-card border-card-lime text-slate-200'
            : result.status === 'improvable'
              ? 'bg-dark-card border-card-amber text-slate-200'
              : 'bg-dark-card border-rose-500 text-slate-200'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-dark-border">
            <span className={`text-sm font-black px-4 py-1 rounded-full ${
              result.status === 'good'
                ? 'bg-card-lime text-dark-bg'
                : result.status === 'improvable'
                  ? 'bg-card-amber text-dark-bg'
                  : 'bg-rose-600 text-white'
            }`}>
              {result.status_label}
            </span>
            <span className="text-xs font-mono font-bold text-slate-400">
              Nota: {result.score}/100
            </span>
          </div>

          {result.summary && (
            <p className="text-sm font-bold text-white">
              {result.summary}
            </p>
          )}

          <div className="bg-dark-bg p-4 rounded-2xl border border-dark-border space-y-2">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
              Observações (Máx. 3):
            </span>
            <ul className="space-y-2">
              {result.observations.map((obs, idx) => (
                <li key={idx} className="text-xs text-slate-300 flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-dark-card border border-dark-border flex items-center justify-center text-[10px] font-mono font-bold text-card-lime flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{obs}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Rules Summary Box */}
      <div className="bg-dark-card rounded-[32px] p-6 border border-dark-border text-xs text-slate-400 space-y-3">
        <strong className="text-white font-bold flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-card-amber" />
          Critérios de Ouro para Flashcards no Anki
        </strong>
        <ul className="space-y-1.5 list-disc list-inside text-slate-400 leading-relaxed font-mono text-[11px]">
          <li>1 único alvo por card.</li>
          <li>Frases curtas (5–7 palavras) para fluidez.</li>
          <li>Recuperação ativa forçada (dica como gatilho, não resposta).</li>
          <li>Áudio sempre no VERSO (confirmação, nunca spoiler).</li>
        </ul>
      </div>
    </div>
  );
}
