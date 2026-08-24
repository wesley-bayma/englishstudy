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
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Revisar Meu Card</h1>
              <p className="text-xs text-slate-500 font-medium">
                Avaliação de qualidade segundo as regras canônicas do seu banco
              </p>
            </div>
          </div>
        </div>

        {/* Quick Canonical Examples Row */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Carregar exemplos canônicos para teste:
          </span>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <button
              onClick={() => loadExample('vocabulary')}
              className="px-3 py-1 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-semibold transition-colors"
            >
              Vocabulário
            </button>
            <button
              onClick={() => loadExample('survival_phrase')}
              className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-semibold transition-colors"
            >
              Frase
            </button>
            <button
              onClick={() => loadExample('phrasal_verb')}
              className="px-3 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-semibold transition-colors"
            >
              Phrasal Verb
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleReview} className="space-y-4">
          {/* Card Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tipo do Card
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'vocabulary' as ContentType, label: 'Vocabulário', color: 'blue' },
                { id: 'survival_phrase' as ContentType, label: 'Frase', color: 'emerald' },
                { id: 'phrasal_verb' as ContentType, label: 'Phrasal Verb', color: 'amber' },
              ].map((t) => {
                const isSel = type === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setType(t.id)}
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

          {/* FRONT Field */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
              Frente do Card (Front)
            </label>
            <textarea
              rows={3}
              placeholder="Cole o que você colocou na frente do flashcard..."
              value={front}
              onChange={(e) => setFront(e.target.value)}
              className="w-full p-3.5 rounded-2xl border border-slate-200 focus:border-indigo-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* BACK Field */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
              Verso do Card (Back)
            </label>
            <textarea
              rows={4}
              placeholder="Cole o que você colocou no verso do flashcard..."
              value={back}
              onChange={(e) => setBack(e.target.value)}
              className="w-full p-3.5 rounded-2xl border border-slate-200 focus:border-indigo-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!front.trim() || !back.trim() || isReviewing}
            className="w-full py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-md shadow-indigo-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            {isReviewing ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                Avaliando card com Gemini Flash...
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
        <div className={`rounded-3xl p-6 border-2 shadow-sm space-y-4 animate-in fade-in duration-200 ${
          result.status === 'good'
            ? 'bg-emerald-50/90 border-emerald-300'
            : result.status === 'improvable'
              ? 'bg-amber-50/90 border-amber-300'
              : 'bg-rose-50/90 border-rose-300'
        }`}>
          {/* Header Status */}
          <div className="flex items-center justify-between pb-3 border-b border-black/5">
            <div className="flex items-center gap-2">
              <span className={`text-base font-black px-3.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm ${
                result.status === 'good'
                  ? 'bg-emerald-600 text-white'
                  : result.status === 'improvable'
                    ? 'bg-amber-600 text-white'
                    : 'bg-rose-600 text-white'
              }`}>
                {result.status_label}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700">
              Pontuação: {result.score}/100
            </span>
          </div>

          {result.summary && (
            <p className="text-sm font-semibold text-slate-800">
              {result.summary}
            </p>
          )}

          {/* Observations (Max 3) */}
          <div className="bg-white/80 rounded-2xl p-4 border border-black/5 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Observações Práticas (Máx. 3):
            </span>
            <ul className="space-y-2">
              {result.observations.map((obs, idx) => (
                <li key={idx} className="text-xs text-slate-800 flex items-start gap-2">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                    result.status === 'good' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
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
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 text-xs text-slate-600 space-y-2">
        <strong className="text-slate-800 font-bold flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          Critérios Canônicos de um Bom Flashcard
        </strong>
        <ul className="space-y-1 text-slate-500 list-disc list-inside">
          <li><strong>Um único alvo por card</strong> — não teste duas palavras novas ao mesmo tempo.</li>
          <li><strong>Frases curtas</strong> — preferência por frases naturais de 5 a 7 palavras.</li>
          <li><strong>Recuperação ativa</strong> — a frente deve obrigar sua mente a resgatar o inglês.</li>
          <li><strong>Áudio sempre no VERSO</strong> — evita que o ouvido receba spoiler antes da tentativa.</li>
        </ul>
      </div>
    </div>
  );
}
