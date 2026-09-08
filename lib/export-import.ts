import { ContentItem, Encounter, ContentType, ContentSource, AnkiStatus } from './types';
import { getDB, initDatabase } from './db';
import { normalizeContent } from './normalizer';

export interface ImportValidationReport {
  total_rows: number;
  valid_count: number;
  invalid_count: number;
  duplicate_count: number;
  new_count: number;
  errors: { row: number; error: string; data?: any }[];
  valid_items: ContentItem[];
}

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 20_000;
const MAX_TEXT_FIELD_LENGTH = 2_000;

/**
 * Exports all database records as a JSON string
 */
export async function exportToJSON(): Promise<string> {
  const db = getDB();
  const items = await db.content_items.toArray();
  const encounters = await db.encounters.toArray();

  const exportObj = {
    app: 'English Study Hub',
    version: 1,
    exported_at: new Date().toISOString(),
    total_items: items.length,
    total_encounters: encounters.length,
    items,
    encounters
  };

  return JSON.stringify(exportObj, null, 2);
}

/**
 * Exports all database records as CSV string
 */
export async function exportToCSV(): Promise<string> {
  const db = getDB();
  const items = await db.content_items.toArray();

  const headers = [
    'id',
    'content',
    'normalized_content',
    'type',
    'source',
    'source_detail',
    'source_url',
    'original_order',
    'anki_status',
    'anki_created_at',
    'times_encountered',
    'last_encountered',
    'meaning_pt',
    'example',
    'notes',
    'date_added'
  ];

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = items.map(item => [
    escapeCSV(item.id),
    escapeCSV(item.content),
    escapeCSV(item.normalized_content),
    escapeCSV(item.type),
    escapeCSV(item.source),
    escapeCSV(item.source_detail),
    escapeCSV(item.source_url),
    escapeCSV(item.original_order),
    escapeCSV(item.anki_status),
    escapeCSV(item.anki_created_at),
    escapeCSV(item.times_encountered),
    escapeCSV(item.last_encountered),
    escapeCSV(item.meaning_pt),
    escapeCSV(item.example),
    escapeCSV(item.notes),
    escapeCSV(item.date_added)
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Validates data from JSON or CSV text before importing
 */
export async function validateImportData(fileContent: string, format: 'json' | 'csv'): Promise<ImportValidationReport> {
  const db = getDB();
  const existingItems = await db.content_items.toArray();
  const existingNormalizedMap = new Set(existingItems.map(i => i.normalized_content));

  const validTypes = new Set<ContentType>([
    'vocabulary',
    'survival_phrase',
    'phrasal_verb',
    'personal_phrase',
    'personal_vocabulary'
  ]);

  const report: ImportValidationReport = {
    total_rows: 0,
    valid_count: 0,
    invalid_count: 0,
    duplicate_count: 0,
    new_count: 0,
    errors: [],
    valid_items: []
  };

  if (new TextEncoder().encode(fileContent).byteLength > MAX_IMPORT_BYTES) {
    report.errors.push({ row: 0, error: 'O arquivo excede o limite de 5 MB.' });
    return report;
  }

  let rawList: any[] = [];

  if (format === 'json') {
    try {
      const parsed = JSON.parse(fileContent);
      if (Array.isArray(parsed)) rawList = parsed;
      else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) rawList = parsed.items;
      else {
        report.errors.push({ row: 0, error: 'O JSON precisa ser uma lista ou conter o campo "items".' });
        return report;
      }
    } catch (e: any) {
      report.errors.push({ row: 0, error: 'JSON inválido ou corrompido: ' + e.message });
      return report;
    }
  } else {
    // Parse CSV
    const lines = fileContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      report.errors.push({ row: 0, error: 'Arquivo CSV vazio ou sem cabeçalho.' });
      return report;
    }
    if (lines.length - 1 > MAX_IMPORT_ROWS) {
      report.errors.push({ row: 0, error: 'O arquivo excede o limite de 20.000 linhas.' });
      return report;
    }

    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const obj: any = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || '';
      });
      rawList.push(obj);
    }
  }

  report.total_rows = rawList.length;
  if (rawList.length > MAX_IMPORT_ROWS) {
    report.errors.push({ row: 0, error: 'O arquivo excede o limite de 20.000 registros.' });
    return report;
  }

  const validSources = new Set<ContentSource>(['base', 'youtube', 'podcast', 'audio', 'book', 'movie', 'series', 'conversation', 'other']);
  const seenIds = new Set<string>();

  rawList.forEach((raw, index) => {
    const rowNum = index + 1;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      report.invalid_count++;
      report.errors.push({ row: rowNum, error: 'Registro inválido.', data: raw });
      return;
    }

    const contentValue = raw.content ?? raw.word ?? raw.phrase;
    const content = typeof contentValue === 'string' ? contentValue.trim() : '';

    if (!content || content.length > MAX_TEXT_FIELD_LENGTH) {
      report.invalid_count++;
      report.errors.push({ row: rowNum, error: 'Campo "content" vazio ou grande demais.', data: raw });
      return;
    }

    const rawType = raw.type === undefined || raw.type === '' ? 'vocabulary' : raw.type;
    const type = typeof rawType === 'string' ? rawType.trim().toLowerCase() : '';
    if (!validTypes.has(type as ContentType)) {
      report.invalid_count++;
      report.errors.push({ row: rowNum, error: 'Tipo de conteúdo inválido.', data: raw });
      return;
    }

    const rawSource = raw.source === undefined || raw.source === '' ? 'base' : raw.source;
    const source = typeof rawSource === 'string' ? rawSource.trim().toLowerCase() : '';
    if (!validSources.has(source as ContentSource)) {
      report.invalid_count++;
      report.errors.push({ row: rowNum, error: 'Fonte do conteúdo inválida.', data: raw });
      return;
    }

    const normalized = normalizeContent(content);
    const id = raw.id === undefined || raw.id === '' ? `import_${Date.now()}_${index}` : raw.id;
    if (typeof id !== 'string' || id.length === 0 || id.length > 200 || seenIds.has(id)) {
      report.invalid_count++;
      report.errors.push({ row: rowNum, error: 'ID vazio, grande demais ou repetido no arquivo.', data: raw });
      return;
    }

    const numberValue = (value: unknown, fallback: number | null): number | null => {
      if (value === undefined || value === null || value === '') return fallback;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    };
    const originalOrder = numberValue(raw.original_order, null);
    const timesEncountered = numberValue(raw.times_encountered, 0);
    if ((raw.original_order !== undefined && raw.original_order !== '' && originalOrder === null) ||
      (raw.times_encountered !== undefined && raw.times_encountered !== '' && timesEncountered === null)) {
      report.invalid_count++;
      report.errors.push({ row: rowNum, error: 'Campos numéricos inválidos.', data: raw });
      return;
    }

    const textValue = (value: unknown, fallback: string | null = null): string | null => {
      if (value === undefined || value === null || value === '') return fallback;
      return typeof value === 'string' && value.length <= MAX_TEXT_FIELD_LENGTH ? value : null;
    };
    const sourceDetail = textValue(raw.source_detail);
    const sourceUrl = textValue(raw.source_url);
    const meaning = textValue(raw.meaning_pt ?? raw.translation);
    const example = textValue(raw.example);
    const baseForm = textValue(raw.base_form, content);
    const notes = textValue(raw.notes);
    if (sourceDetail === null && raw.source_detail !== undefined && raw.source_detail !== null && raw.source_detail !== '' ||
      sourceUrl === null && raw.source_url !== undefined && raw.source_url !== null && raw.source_url !== '' ||
      meaning === null && (raw.meaning_pt !== undefined || raw.translation !== undefined) ||
      example === null && raw.example !== undefined && raw.example !== null && raw.example !== '' ||
      baseForm === null || notes === null && raw.notes !== undefined && raw.notes !== null && raw.notes !== '') {
      report.invalid_count++;
      report.errors.push({ row: rowNum, error: 'Um dos campos de texto excede o limite permitido.', data: raw });
      return;
    }

    const isDuplicate = existingNormalizedMap.has(normalized);
    if (isDuplicate) {
      report.duplicate_count++;
    } else {
      report.new_count++;
    }
    existingNormalizedMap.add(normalized);
    seenIds.add(id);

    const item: ContentItem = {
      id,
      content,
      normalized_content: normalized,
      type: type as ContentType,
      source: source as ContentSource,
      source_detail: sourceDetail,
      source_url: sourceUrl,
      timestamp_marker: textValue(raw.timestamp_marker),
      original_order: originalOrder,
      anki_status: raw.anki_status === 'created' ? 'created' : 'not_created',
      anki_created_at: textValue(raw.anki_created_at),
      date_added: textValue(raw.date_added, new Date().toISOString()) || new Date().toISOString(),
      times_encountered: timesEncountered || 0,
      last_encountered: textValue(raw.last_encountered),
      meaning_pt: meaning,
      example,
      base_form: baseForm || content,
      notes
    };

    report.valid_count++;
    report.valid_items.push(item);
  });

  return report;
}

/**
 * Commits valid import items into the database
 */
export async function commitImport(items: ContentItem[], skipDuplicates: boolean = true): Promise<number> {
  const db = getDB();
  const existing = await db.content_items.toArray();
  const existingSet = new Set(existing.map(i => i.normalized_content));

  const existingIds = new Set(existing.map(item => item.id));
  const seenIds = new Set<string>();
  const toInsert = items.filter(item => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    if (existingIds.has(item.id)) return false;
    if (skipDuplicates && existingSet.has(item.normalized_content)) return false;
    existingSet.add(item.normalized_content);
    existingIds.add(item.id);
    return true;
  });

  await db.content_items.bulkAdd(toInsert);
  return toInsert.length;
}

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
