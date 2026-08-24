'use client';

import React, { useState, useEffect } from 'react';
import { getStudyHubStats } from '../../lib/db';
import { exportToJSON, exportToCSV, validateImportData, commitImport, ImportValidationReport } from '../../lib/export-import';
import { getStoredApiKey, setStoredApiKey } from '../../lib/gemini';
import { ProgressBar } from '../../components/ProgressBar';
import { 
  BarChart3, 
  Download, 
  Upload, 
  Key, 
  Flame, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Settings, 
  FileText,
  AlertTriangle,
  Sparkles,
  Check
} from 'lucide-react';

export default function ProgressPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Settings state
  const [apiKey, setApiKey] = useState('');
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<ImportValidationReport | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    setApiKey(getStoredApiKey());
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getStudyHubStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredApiKey(apiKey);
    setIsApiKeySaved(true);
    setTimeout(() => setIsApiKeySaved(false), 2500);
  };

  const handleExportJSON = async () => {
    const jsonStr = await exportToJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `english-study-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = async () => {
    const csvStr = await exportToCSV();
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `english-study-hub-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportReport(null);
    setImportSuccess(null);

    const text = await file.text();
    const format = file.name.endsWith('.csv') ? 'csv' : 'json';
    const report = await validateImportData(text, format);
    setImportReport(report);
  };

  const handleConfirmImport = async () => {
    if (!importReport || importReport.valid_items.length === 0) return;

    setIsImporting(true);
    try {
      const count = await commitImport(importReport.valid_items, true);
      setImportSuccess(`Sucesso! ${count} novos itens foram importados para o banco.`);
      setImportFile(null);
      setImportReport(null);
      loadStats();
    } catch (err: any) {
      console.error('Import error:', err);
    } finally {
      setIsImporting(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm font-medium">
        Carregando métricas e progresso...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Progresso & Configurações</h1>
          <p className="text-xs text-slate-500 font-medium">
            Acompanhamento real da conversão manual para o Anki
          </p>
        </div>
      </div>

      {/* 1. BASE CANÔNICA STATS */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Banco Principal (BASE)
          </h2>
          <span className="text-xs text-slate-500 font-medium">3.250 itens canônicos</span>
        </div>

        <div className="space-y-4">
          {/* Vocab */}
          <div className="bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <strong className="text-blue-900 font-semibold">Vocabulário</strong>
              <span className="font-mono text-blue-700 font-bold">
                {stats.base.vocab.created} / {stats.base.vocab.total} cards criados
              </span>
            </div>
            <ProgressBar
              completed={stats.base.vocab.created}
              total={stats.base.vocab.total}
              color="blue"
              size="md"
            />
          </div>

          {/* Phrases */}
          <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <strong className="text-emerald-900 font-semibold">Frases de Sobrevivência</strong>
              <span className="font-mono text-emerald-700 font-bold">
                {stats.base.phrases.created} / {stats.base.phrases.total} cards criados
              </span>
            </div>
            <ProgressBar
              completed={stats.base.phrases.created}
              total={stats.base.phrases.total}
              color="emerald"
              size="md"
            />
          </div>

          {/* Phrasal Verbs */}
          <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <strong className="text-amber-900 font-semibold">Phrasal Verbs Mais Frequentes</strong>
              <span className="font-mono text-amber-700 font-bold">
                {stats.base.phrasal_verbs.created} / {stats.base.phrasal_verbs.total} cards criados
              </span>
            </div>
            <ProgressBar
              completed={stats.base.phrasal_verbs.created}
              total={stats.base.phrasal_verbs.total}
              color="amber"
              size="md"
            />
          </div>
        </div>
      </div>

      {/* 2. INBOX & NATURAL ENCOUNTERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Inbox Stats */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600" />
              Meus Achados (INBOX)
            </h2>
            <span className="text-xs text-slate-500 font-mono">{stats.inbox.total} adicionados</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Transformados em cards:</span>
              <strong className="text-indigo-700 font-mono font-bold">
                {stats.inbox.created} / {stats.inbox.total}
              </strong>
            </div>
            <ProgressBar
              completed={stats.inbox.created}
              total={stats.inbox.total || 1}
              color="indigo"
              size="sm"
            />
          </div>
        </div>

        {/* Encounters This Week */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-rose-500 fill-rose-500" />
              Encontros Naturais Esta Semana
            </h2>
            <span className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full font-bold">
              {stats.encountersThisWeek} registros
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Palavras e frases que você encontrou em vídeos, áudios, livros e podcasts nos últimos 7 dias.
          </p>

          {stats.topEncountered.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Top Mais Encontrados:</span>
              <div className="flex flex-wrap gap-1.5">
                {stats.topEncountered.slice(0, 5).map((top: any) => (
                  <span key={top.id} className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 flex items-center gap-1 border border-slate-200/60">
                    {top.content}
                    <span className="text-rose-600 text-[10px]">({top.times_encountered}x)</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. BACKUP & EXPORTAÇÃO */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Download className="w-4 h-4 text-slate-700" />
          Exportação & Backup dos Seus Dados
        </h2>
        <p className="text-xs text-slate-500">
          Você tem total soberania sobre seus dados. Exporte todo o banco, status do Anki e histórico de encontros a qualquer momento.
        </p>

        <div className="flex items-center gap-3 flex-wrap pt-1">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md shadow-slate-900/10 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            Exportar Backup Completo (JSON)
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            Exportar Planilha (CSV)
          </button>
        </div>
      </div>

      {/* 4. IMPORTAÇÃO DE CONTEÚDO */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Upload className="w-4 h-4 text-slate-700" />
          Importar Conteúdo Externo
        </h2>
        <p className="text-xs text-slate-500">
          Importe novos itens via arquivo JSON ou CSV. O sistema verificará duplicatas e validará a estrutura antes de confirmar.
        </p>

        {importSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {importSuccess}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="file"
            accept=".json,.csv"
            onChange={handleFileChange}
            className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />

          {importReport && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2.5 animate-in fade-in">
              <strong className="text-slate-800 block">Relatório Pré-Importação:</strong>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Total lido</span>
                  <strong className="text-slate-800 text-sm">{importReport.total_rows}</strong>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 text-emerald-700">
                  <span className="text-emerald-500 block text-[10px]">Novos itens</span>
                  <strong className="text-sm">{importReport.new_count}</strong>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-amber-200 text-amber-700">
                  <span className="text-amber-500 block text-[10px]">Já existem</span>
                  <strong className="text-sm">{importReport.duplicate_count}</strong>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-rose-200 text-rose-700">
                  <span className="text-rose-500 block text-[10px]">Inválidos</span>
                  <strong className="text-sm">{importReport.invalid_count}</strong>
                </div>
              </div>

              {importReport.new_count > 0 && (
                <button
                  onClick={handleConfirmImport}
                  disabled={isImporting}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all mt-2"
                >
                  {isImporting ? 'Importando...' : `Confirmar Importação de ${importReport.new_count} Novos Itens`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. CONFIGURAÇÕES DA API GEMINI FLASH */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">Configurações de IA (Gemini Flash)</h2>
        </div>
        <p className="text-xs text-slate-500">
          Sua chave de API do Google Gemini é armazenada de forma estritamente local no seu navegador. O sistema nunca gasta chamadas para comparações exatas simples.
        </p>

        <form onSubmit={handleSaveApiKey} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chave de API do Gemini (Google AI Studio)
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              Usa Gemini Flash com respostas JSON estruturadas.
            </span>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
            >
              {isApiKeySaved ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  Salvo!
                </>
              ) : (
                'Salvar Chave'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
