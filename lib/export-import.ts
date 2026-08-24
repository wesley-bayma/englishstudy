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

  let rawList: any[] = [];

  if (format === 'json') {
    try {
      const parsed = JSON.parse(fileContent);
      rawList = Array.isArray(parsed) ? parsed : (parsed.items || []);
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

  rawList.forEach((raw, index) => {
    const rowNum = index + 1;
    const content = (raw.content || raw.word || raw.phrase || '').trim();

    if (!content) {
      report.invalid_count++;
      report.errors.push({ row: rowNum, error: 'Campo "content" está vazio.', data: raw });
      return;
    }

    const rawType = (raw.type || 'vocabulary').trim().toLowerCase();
    const type: ContentType = validTypes.has(rawType as ContentType) ? (rawType as ContentType) : 'vocabulary';
    const source: ContentSource = raw.source || 'base';
    const normalized = normalizeContent(content);

    const isDuplicate = existingNormalizedMap.has(normalized);
    if (isDuplicate) {
      report.duplicate_count++;
    } else {
      report.new_count++;
    }

    const item: ContentItem = {
      id: raw.id || `import_${Date.now()}_${index}`,
      content,
      normalized_content: normalized,
      type,
      source,
      source_detail: raw.source_detail || null,
      source_url: raw.source_url || null,
      timestamp_marker: raw.timestamp_marker || null,
      original_order: raw.original_order ? Number(raw.original_order) : null,
      anki_status: raw.anki_status === 'created' ? 'created' : 'not_created',
      anki_created_at: raw.anki_created_at || null,
      date_added: raw.date_added || new Date().toISOString(),
      times_encountered: raw.times_encountered ? Number(raw.times_encountered) : 0,
      last_encountered: raw.last_encountered || null,
      meaning_pt: raw.meaning_pt || raw.translation || null,
      example: raw.example || null,
      base_form: raw.base_form || content,
      notes: raw.notes || null
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

  let toInsert = items;
  if (skipDuplicates) {
    toInsert = items.filter(i => !existingSet.has(i.normalized_content));
  }

  await db.content_items.bulkPut(toInsert);
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
