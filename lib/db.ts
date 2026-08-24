import Dexie, { Table } from 'dexie';
import { ContentItem, Encounter, DailyQueue, ContentType, ContentSource, AnkiStatus } from './types';
import { normalizeContent } from './normalizer';
import seedData from '../data/seed-data.json';

export class EnglishHubDB extends Dexie {
  content_items!: Table<ContentItem, string>;
  encounters!: Table<Encounter, string>;
  daily_queues!: Table<DailyQueue, string>;

  constructor() {
    super('EnglishStudyHubDB');
    this.version(1).stores({
      content_items: 'id, normalized_content, type, source, anki_status, original_order, times_encountered, date_added',
      encounters: 'id, content_id, source, created_at',
      daily_queues: 'id, date'
    });
  }
}

let dbInstance: EnglishHubDB | null = null;

export function getDB(): EnglishHubDB {
  if (typeof window === 'undefined') {
    // Return placeholder during server-side rendering
    return new EnglishHubDB();
  }
  if (!dbInstance) {
    dbInstance = new EnglishHubDB();
  }
  return dbInstance;
}

/**
 * Initializes the database. If empty, automatically seeds with the 3,250 canonical items.
 */
export async function initDatabase(): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = getDB();
  
  try {
    const count = await db.content_items.count();
    if (count === 0) {
      console.log('Database empty. Seeding with canonical data (3,250 items)...');
      const formattedSeeds: ContentItem[] = (seedData as any[]).map(item => ({
        ...item,
        normalized_content: item.normalized_content || normalizeContent(item.content),
        times_encountered: item.times_encountered || 0,
        anki_status: (item.anki_status as AnkiStatus) || 'not_created',
        date_added: item.date_added || new Date().toISOString()
      }));

      // Chunked insert for efficiency
      const chunkSize = 500;
      for (let i = 0; i < formattedSeeds.length; i += chunkSize) {
        const chunk = formattedSeeds.slice(i, i + chunkSize);
        await db.content_items.bulkAdd(chunk);
      }
      console.log('Seeding complete!');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

/**
 * Exact search by normalized text (0ms latency, zero AI cost)
 */
export async function findExact(rawText: string): Promise<ContentItem | null> {
  const db = getDB();
  const normalized = normalizeContent(rawText);
  if (!normalized) return null;
  
  const match = await db.content_items
    .where('normalized_content')
    .equals(normalized)
    .first();
    
  return match || null;
}

/**
 * Search items by partial query and filter pills
 */
export async function searchContentItems(options: {
  query?: string;
  sourceFilter?: 'all' | 'base' | 'inbox';
  typeFilter?: 'all' | ContentType;
  ankiFilter?: 'all' | 'not_created' | 'created';
  onlyEncountered?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ items: ContentItem[]; total: number }> {
  const db = getDB();
  const {
    query = '',
    sourceFilter = 'all',
    typeFilter = 'all',
    ankiFilter = 'all',
    onlyEncountered = false,
    limit = 50,
    offset = 0
  } = options;

  const normalizedQuery = normalizeContent(query);

  let collection = db.content_items.toCollection();

  // Filter in memory for maximum flexibility & speed
  let allFiltered = await collection.toArray();

  if (normalizedQuery) {
    allFiltered = allFiltered.filter(item => 
      item.normalized_content.includes(normalizedQuery) ||
      (item.meaning_pt && normalizeContent(item.meaning_pt).includes(normalizedQuery)) ||
      (item.example && normalizeContent(item.example).includes(normalizedQuery))
    );
  }

  if (sourceFilter === 'base') {
    allFiltered = allFiltered.filter(i => i.source === 'base');
  } else if (sourceFilter === 'inbox') {
    allFiltered = allFiltered.filter(i => i.source !== 'base');
  }

  if (typeFilter !== 'all') {
    allFiltered = allFiltered.filter(i => i.type === typeFilter);
  }

  if (ankiFilter !== 'all') {
    allFiltered = allFiltered.filter(i => i.anki_status === ankiFilter);
  }

  if (onlyEncountered) {
    allFiltered = allFiltered.filter(i => i.times_encountered > 0);
  }

  // Sort: highest encounters first if filter active, otherwise by original_order or recency
  if (onlyEncountered) {
    allFiltered.sort((a, b) => b.times_encountered - a.times_encountered);
  } else if (sourceFilter === 'base' && !normalizedQuery) {
    allFiltered.sort((a, b) => (a.original_order || 99999) - (b.original_order || 99999));
  } else {
    allFiltered.sort((a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime());
  }

  const total = allFiltered.length;
  const paginated = allFiltered.slice(offset, offset + limit);

  return { items: paginated, total };
}

/**
 * Record a natural encounter
 */
export async function recordEncounter(
  contentId: string, 
  details: {
    source: ContentSource;
    source_detail?: string | null;
    source_url?: string | null;
    timestamp_marker?: string | null;
    context_sentence?: string | null;
    notes?: string | null;
  }
): Promise<Encounter> {
  const db = getDB();
  const now = new Date().toISOString();

  const item = await db.content_items.get(contentId);
  if (!item) throw new Error('Item not found');

  const encounter: Encounter = {
    id: `enc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    content_id: contentId,
    source: details.source || 'other',
    source_detail: details.source_detail || null,
    source_url: details.source_url || null,
    timestamp_marker: details.timestamp_marker || null,
    context_sentence: details.context_sentence || null,
    notes: details.notes || null,
    created_at: now
  };

  await db.encounters.add(encounter);

  // Update item encounter count and last_encountered
  await db.content_items.update(contentId, {
    times_encountered: (item.times_encountered || 0) + 1,
    last_encountered: now,
    notes: details.notes || item.notes
  });

  return encounter;
}

/**
 * Add a new item to Inbox
 */
export async function addInboxItem(data: {
  content: string;
  type: ContentType;
  source: ContentSource;
  source_detail?: string | null;
  source_url?: string | null;
  timestamp_marker?: string | null;
  context_sentence?: string | null;
  notes?: string | null;
  meaning_pt?: string | null;
  example?: string | null;
  base_form?: string | null;
}): Promise<ContentItem> {
  const db = getDB();
  const now = new Date().toISOString();
  const id = `inbox_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

  const newItem: ContentItem = {
    id,
    content: data.content.trim(),
    normalized_content: normalizeContent(data.content),
    type: data.type,
    source: data.source || 'other',
    source_detail: data.source_detail || null,
    source_url: data.source_url || null,
    timestamp_marker: data.timestamp_marker || null,
    original_order: null,
    anki_status: 'not_created',
    anki_created_at: null,
    date_added: now,
    times_encountered: 1, // First encounter when added
    last_encountered: now,
    meaning_pt: data.meaning_pt || null,
    example: data.context_sentence || data.example || null,
    base_form: data.base_form || data.content.trim(),
    notes: data.notes || null
  };

  await db.content_items.add(newItem);

  // Also log the first encounter
  const firstEncounter: Encounter = {
    id: `enc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    content_id: id,
    source: data.source || 'other',
    source_detail: data.source_detail || null,
    source_url: data.source_url || null,
    timestamp_marker: data.timestamp_marker || null,
    context_sentence: data.context_sentence || null,
    notes: data.notes || null,
    created_at: now
  };
  await db.encounters.add(firstEncounter);

  return newItem;
}

/**
 * Toggle Anki Status
 */
export async function toggleAnkiStatus(contentId: string, forceStatus?: AnkiStatus): Promise<AnkiStatus> {
  const db = getDB();
  const item = await db.content_items.get(contentId);
  if (!item) throw new Error('Item not found');

  const newStatus: AnkiStatus = forceStatus || (item.anki_status === 'created' ? 'not_created' : 'created');
  const now = newStatus === 'created' ? new Date().toISOString() : null;

  await db.content_items.update(contentId, {
    anki_status: newStatus,
    anki_created_at: now
  });

  return newStatus;
}

/**
 * Get encounters history for an item
 */
export async function getItemEncounters(contentId: string): Promise<Encounter[]> {
  const db = getDB();
  return await db.encounters
    .where('content_id')
    .equals(contentId)
    .reverse()
    .sortBy('created_at');
}

/**
 * Get Stats
 */
export async function getStudyHubStats() {
  const db = getDB();
  const items = await db.content_items.toArray();
  const encounters = await db.encounters.toArray();

  const baseVocab = items.filter(i => i.source === 'base' && i.type === 'vocabulary');
  const basePhrases = items.filter(i => i.source === 'base' && i.type === 'survival_phrase');
  const basePvs = items.filter(i => i.source === 'base' && i.type === 'phrasal_verb');

  const inboxItems = items.filter(i => i.source !== 'base');

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const encountersThisWeek = encounters.filter(e => e.created_at >= oneWeekAgo).length;

  const topEncountered = items
    .filter(i => i.times_encountered > 0)
    .sort((a, b) => b.times_encountered - a.times_encountered)
    .slice(0, 10);

  return {
    base: {
      vocab: {
        total: baseVocab.length,
        created: baseVocab.filter(i => i.anki_status === 'created').length
      },
      phrases: {
        total: basePhrases.length,
        created: basePhrases.filter(i => i.anki_status === 'created').length
      },
      phrasal_verbs: {
        total: basePvs.length,
        created: basePvs.filter(i => i.anki_status === 'created').length
      }
    },
    inbox: {
      total: inboxItems.length,
      created: inboxItems.filter(i => i.anki_status === 'created').length
    },
    encountersThisWeek,
    topEncountered
  };
}
