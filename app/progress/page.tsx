'use client';

import React, { useState, useEffect } from 'react';
import { getStudyHubStats } from '../../lib/db';
import { exportToJSON, exportToCSV, validateImportData, commitImport, ImportValidationReport } from '../../lib/export-import';
import { getStoredApiKey, setStoredApiKey } from '../../lib/gemini';
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

  // Settings
  const [apiKey, setApiKey] = useState('');
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);

  // Import
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
      <div className="py-20 text-center text-slate-500 font-mono text-sm">
        // Carregando métricas...
      </div>
    );
  }

  const vocabPercent = Math.round((stats.base.vocab.created / stats.base.vocab.total) * 100) || 0;
  const phrasePercent = Math.round((stats.base.phrases.created / stats.base.phrases.total) * 100) || 0;
  const pvPercent = Math.round((stats.base.phrasal_verbs.created / stats.base.phrasal_verbs.total) * 100) || 0;

  return (
    <div className="space-y-8 pt-4">
      {/* Header */}
      <div className="bg-dark-card rounded-[32px] p-6 sm:p-8 border border-dark-border shadow-2xl space-y-2">
        <span className="text-xs font-mono font-bold tracking-widest text-card-lime uppercase">
          // Métricas & Backup Soberano
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          Progresso de Conversão
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 font-medium">
          Acompanhamento dos 3.250 conteúdos canônicos e novos achados transformados em cards no Anki.
        </p>
      </div>

      {/* 1. BASE CANÔNICA METRICS */}
      <div className="bg-dark-card rounded-[32px] p-6 sm:p-8 border border-dark-border shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-dark-border">
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-card-lime" />
            Banco Principal (BASE)
          </h2>
          <span className="text-xs font-mono text-slate-400">3.250 itens originais</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Vocab */}
          <div className="bg-dark-bg p-5 rounded-2xl border border-dark-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-card-pink uppercase">Vocabulário</span>
              <span className="text-xs font-mono text-slate-400 font-bold">{vocabPercent}%</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {stats.base.vocab.created} <span className="text-sm font-normal text-slate-500">/ {stats.base.vocab.total}</span>
            </div>
            <div className="w-full bg-dark-border h-1.5 rounded-full overflow-hidden">
              <div className="bg-card-pink h-full transition-all duration-500" style={{ width: `${vocabPercent}%` }} />
            </div>
          </div>

          {/* Phrases */}
          <div className="bg-dark-bg p-5 rounded-2xl border border-dark-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-card-lime uppercase">Frases</span>
              <span className="text-xs font-mono text-slate-400 font-bold">{phrasePercent}%</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {stats.base.phrases.created} <span className="text-sm font-normal text-slate-500">/ {stats.base.phrases.total}</span>
            </div>
            <div className="w-full bg-dark-border h-1.5 rounded-full overflow-hidden">
              <div className="bg-card-lime h-full transition-all duration-500" style={{ width: `${phrasePercent}%` }} />
            </div>
          </div>

          {/* Phrasal Verbs */}
          <div className="bg-dark-bg p-5 rounded-2xl border border-dark-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-card-amber uppercase">Phrasal Verbs</span>
              <span className="text-xs font-mono text-slate-400 font-bold">{pvPercent}%</span>
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {stats.base.phrasal_verbs.created} <span className="text-sm font-normal text-slate-500">/ {stats.base.phrasal_verbs.total}</span>
            </div>
            <div className="w-full bg-dark-border h-1.5 rounded-full overflow-hidden">
              <div className="bg-card-amber h-full transition-all duration-500" style={{ width: `${pvPercent}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* 2. INBOX & ENCOUNTERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-dark-card rounded-[32px] p-6 sm:p-8 border border-dark-border shadow-2xl space-y-4">
          <span className="text-xs font-mono font-bold text-card-lime uppercase block">
            // Meus Achados (Inbox)
          </span>
          <div className="flex items-baseline gap-2">
            <div className="text-4xl font-black text-white font-mono">{stats.inbox.total}</div>
            <span className="text-xs text-slate-400 font-medium">conteúdos adicionados</span>
          </div>
          <p className="text-xs text-slate-400">
            {stats.inbox.created} já transformados manualmente em cards no Anki.
          </p>
        </div>

        <div className="bg-dark-card rounded-[32px] p-6 sm:p-8 border border-dark-border shadow-2xl space-y-4">
          <span className="text-xs font-mono font-bold text-rose-400 uppercase block flex items-center gap-1.5">
            <Flame className="w-4 h-4 fill-rose-400" />
            Encontros Naturais Esta Semana
          </span>
          <div className="flex items-baseline gap-2">
            <div className="text-4xl font-black text-white font-mono">{stats.encountersThisWeek}</div>
            <span className="text-xs text-slate-400 font-medium">vezes encontrados em vídeos e podcasts</span>
          </div>
          {stats.topEncountered.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {stats.topEncountered.slice(0, 4).map((top: any) => (
                <span key={top.id} className="text-xs font-bold px-3 py-1 rounded-full bg-dark-bg text-slate-200 border border-dark-border flex items-center gap-1 font-mono">
                  {top.content}
                  <span className="text-rose-400 text-[10px]">({top.times_encountered}x)</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. BACKUP & EXPORTAÇÃO */}
      <div className="bg-dark-card rounded-[32px] p-6 sm:p-8 border border-dark-border shadow-2xl space-y-4">
        <h2 className="text-xl font-black text-white flex items-center gap-2.5">
          <Download className="w-5 h-5 text-slate-400" />
          Exportação & Soberania dos Dados
        </h2>
        <p className="text-xs text-slate-400 max-w-xl">
          Faça backup de todo o seu banco a qualquer momento em JSON ou CSV.
        </p>

        <div className="flex items-center gap-3 flex-wrap pt-2">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-white hover:bg-slate-200 text-dark-bg font-black text-xs shadow-lg active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            Exportar Backup JSON
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-dark-bg hover:bg-dark-border text-slate-200 border border-dark-border font-bold text-xs transition-colors"
          >
            <FileText className="w-4 h-4 text-slate-400" />
            Exportar Planilha CSV
          </button>
        </div>
      </div>

      {/* 4. IMPORTAÇÃO */}
      <div className="bg-dark-card rounded-[32px] p-6 sm:p-8 border border-dark-border shadow-2xl space-y-4">
        <h2 className="text-xl font-black text-white flex items-center gap-2.5">
          <Upload className="w-5 h-5 text-slate-400" />
          Importar Arquivo Externo
        </h2>

        {importSuccess && (
          <div className="p-3.5 bg-card-lime/10 border border-card-lime/30 rounded-2xl text-xs text-card-lime font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {importSuccess}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="file"
            accept=".json,.csv"
            onChange={handleFileChange}
            className="block w-full text-xs text-slate-400 file:mr-4 file:py-3 file:px-5 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-dark-bg file:text-card-lime hover:file:bg-dark-border cursor-pointer font-mono"
          />

          {importReport && (
            <div className="bg-dark-bg p-5 rounded-2xl border border-dark-border text-xs space-y-3 animate-in fade-in font-mono">
              <strong className="text-white block font-sans text-sm">Relatório Pré-Importação:</strong>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-dark-card p-3 rounded-xl border border-dark-border">
                  <span className="text-slate-500 block text-[10px]">Total Lido</span>
                  <strong className="text-white text-base">{importReport.total_rows}</strong>
                </div>
                <div className="bg-dark-card p-3 rounded-xl border border-card-lime/30 text-card-lime">
                  <span className="text-slate-500 block text-[10px]">Novos</span>
                  <strong className="text-base">{importReport.new_count}</strong>
                </div>
                <div className="bg-dark-card p-3 rounded-xl border border-card-amber/30 text-card-amber">
                  <span className="text-slate-500 block text-[10px]">Duplicados</span>
                  <strong className="text-base">{importReport.duplicate_count}</strong>
                </div>
                <div className="bg-dark-card p-3 rounded-xl border border-rose-500/30 text-rose-400">
                  <span className="text-slate-500 block text-[10px]">Inválidos</span>
                  <strong className="text-base">{importReport.invalid_count}</strong>
                </div>
              </div>

              {importReport.new_count > 0 && (
                <button
                  onClick={handleConfirmImport}
                  disabled={isImporting}
                  className="w-full py-3 px-5 rounded-full bg-card-lime hover:bg-card-limeDark text-dark-bg font-black text-xs shadow-lg active:scale-95 transition-all mt-2"
                >
                  {isImporting ? 'Importando...' : `Confirmar Importação de ${importReport.new_count} Novos Itens`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. CONFIGURAÇÕES GEMINI FLASH */}
      <div className="bg-dark-card rounded-[32px] p-6 sm:p-8 border border-dark-border shadow-2xl space-y-4">
        <h2 className="text-xl font-black text-white flex items-center gap-2.5">
          <Key className="w-5 h-5 text-card-lime" />
          Configuração de IA (Gemini Flash)
        </h2>
        <p className="text-xs text-slate-400">
          Chave armazenada localmente no seu dispositivo.
        </p>

        <form onSubmit={handleSaveApiKey} className="space-y-3">
          <input
            type="password"
            placeholder="AIzaSy..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl bg-dark-bg border border-dark-border text-white text-sm font-mono focus:outline-none focus:border-card-lime"
          />

          <div className="flex items-center justify-end pt-1">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-6 py-3 bg-card-lime hover:bg-card-limeDark text-dark-bg rounded-full text-xs font-black shadow-lg active:scale-95 transition-all"
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
