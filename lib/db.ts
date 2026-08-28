import Dexie, { Table } from 'dexie';
import {
  ContentItem,
  Encounter,
  DailyQueue,
  ContentType,
  ContentSource,
  AnkiStatus,
  StudySheetCacheEntry
} from './types';
import { normalizeContent } from './normalizer';
import seedData from '../data/seed-data.json';

export class EnglishHubDB extends Dexie {
  content_items!: Table<ContentItem, string>;
  encounters!: Table<Encounter, string>;
  daily_queues!: Table<DailyQueue, string>;
  study_sheets!: Table<StudySheetCacheEntry, string>;

  constructor() {
    super('EnglishStudyHubDB_v2');
    this.version(1).stores({
      content_items: 'id, normalized_content, type, source, anki_status, original_order, times_encountered, date_added',
      encounters: 'id, content_id, source, created_at',
      daily_queues: 'id, date'
    });
    this.version(2).stores({
      content_items: 'id, normalized_content, type, source, anki_status, original_order, times_encountered, date_added',
      encounters: 'id, content_id, source, created_at',
      daily_queues: 'id, date',
      study_sheets: 'id, updated_at'
    });
  }
}

const LEGACY_DATABASE_NAME = 'EnglishStudyHubDB';
const LEGACY_MIGRATION_FLAG = 'english_hub_legacy_db_migrated_v1';
const CANONICAL_DATASET_VERSION = 'v4-fresh-start';
const CANONICAL_DATASET_VERSION_KEY = 'english_hub_dataset_version';

/**
 * The database name was bumped to v2 in a previous release. Keep the old
 * schema available long enough to recover the user's queues and Inbox data.
 */
class LegacyEnglishHubDB extends Dexie {
  content_items!: Table<ContentItem, string>;
  encounters!: Table<Encounter, string>;
  daily_queues!: Table<DailyQueue, string>;

  constructor() {
    super(LEGACY_DATABASE_NAME);
    this.version(1).stores({
      content_items: 'id, normalized_content, type, source, anki_status, original_order, times_encountered, date_added',
      encounters: 'id, content_id, source, created_at',
      daily_queues: 'id, date'
    });
  }
}

function latestIsoDate(...values: Array<string | null | undefined>): string | null {
  const validDates = values
    .filter((value): value is string => Boolean(value))
    .filter(value => !Number.isNaN(new Date(value).getTime()))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return validDates[0] || null;
}

function mergeLegacyContentItem(current: ContentItem, legacy: ContentItem): ContentItem {
  const currentIsCreated = current.anki_status === 'created';
  const legacyIsCreated = legacy.anki_status === 'created';

  return {
    ...current,
    anki_status: currentIsCreated || legacyIsCreated ? 'created' : current.anki_status,
    anki_created_at: currentIsCreated
      ? (current.anki_created_at || legacy.anki_created_at)
      : legacyIsCreated
        ? legacy.anki_created_at
        : current.anki_created_at,
    times_encountered: Math.max(current.times_encountered || 0, legacy.times_encountered || 0),
    last_encountered: latestIsoDate(current.last_encountered, legacy.last_encountered),
    meaning_pt: current.meaning_pt || legacy.meaning_pt,
    example: current.example || legacy.example,
    base_form: current.base_form || legacy.base_form,
    notes: current.notes || legacy.notes
  };
}

function markLegacyMigrationComplete(): void {
  try {
    window.localStorage.setItem(LEGACY_MIGRATION_FLAG, 'done');
  } catch {
    // Local storage can be unavailable; the migration remains idempotent.
  }
}

async function migrateLegacyDatabase(targetDb: EnglishHubDB): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if (window.localStorage.getItem(LEGACY_MIGRATION_FLAG) === 'done') return;
  } catch {
    // Continue without the one-time flag; all writes below are idempotent.
  }

  const legacyDb = new LegacyEnglishHubDB();
  try {
    await legacyDb.open();
    const [legacyItems, legacyQueues, legacyEncounters] = await Promise.all([
      legacyDb.content_items.toArray(),
      legacyDb.daily_queues.toArray(),
      legacyDb.encounters.toArray()
    ]);

    if (legacyItems.length === 0 && legacyQueues.length === 0 && legacyEncounters.length === 0) {
      markLegacyMigrationComplete();
      return;
    }

    const currentItems = await targetDb.content_items.toArray();
    const currentById = new Map(currentItems.map(item => [item.id, item]));
    const mergedItems: ContentItem[] = [];

    for (const legacyItem of legacyItems) {
      const currentItem = currentById.get(legacyItem.id);
      if (currentItem) {
        mergedItems.push(mergeLegacyContentItem(currentItem, legacyItem));
      } else {
        // Preserve user-created Inbox records that do not exist in the seed.
        mergedItems.push(legacyItem);
      }
    }

    const legacyQueueIds = legacyQueues.map(queue => queue.id);
    const existingQueues = await targetDb.daily_queues.bulkGet(legacyQueueIds);
    const queuesToImport = legacyQueues.filter((_, index) => !existingQueues[index]);

    const legacyEncounterIds = legacyEncounters.map(encounter => encounter.id);
    const existingEncounters = await targetDb.encounters.bulkGet(legacyEncounterIds);
    const encountersToImport = legacyEncounters.filter((_, index) => !existingEncounters[index]);

    await targetDb.transaction(
      'rw',
      targetDb.content_items,
      targetDb.daily_queues,
      targetDb.encounters,
      async () => {
        if (mergedItems.length > 0) await targetDb.content_items.bulkPut(mergedItems);
        if (queuesToImport.length > 0) await targetDb.daily_queues.bulkPut(queuesToImport);
        if (encountersToImport.length > 0) await targetDb.encounters.bulkPut(encountersToImport);
      }
    );

    markLegacyMigrationComplete();
    console.info(`Legacy database migrated: ${queuesToImport.length} queues recovered.`);
  } catch (error) {
    console.warn('Legacy database migration skipped:', error);
  } finally {
    legacyDb.close();
  }
}

/**
 * The canonical dataset now starts a fresh study count. Clear generated daily
 * history and base progress once, preserving the canonical content itself and
 * all user-created Inbox records.
 */
async function resetStudyProgressForDatasetVersion(targetDb: EnglishHubDB): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if (window.localStorage.getItem(CANONICAL_DATASET_VERSION_KEY) === CANONICAL_DATASET_VERSION) {
      return;
    }
  } catch {
    // Private browsing/test environments may not expose localStorage. Avoid
    // repeating a destructive reset when its completion cannot be recorded.
    return;
  }

  const baseItems = await targetDb.content_items.where('source').equals('base').toArray();
  const baseIds = new Set(baseItems.map(item => item.id));
  const baseEncounterIds = (await targetDb.encounters.toArray())
    .filter(encounter => baseIds.has(encounter.content_id))
    .map(encounter => encounter.id);

  await targetDb.transaction(
    'rw',
    targetDb.content_items,
    targetDb.encounters,
    targetDb.daily_queues,
    targetDb.study_sheets,
    async () => {
      await targetDb.content_items.bulkPut(baseItems.map(item => ({
        ...item,
        anki_status: 'not_created' as const,
        anki_created_at: null,
        times_encountered: 0,
        last_encountered: null
      })));
      if (baseEncounterIds.length > 0) await targetDb.encounters.bulkDelete(baseEncounterIds);
      await targetDb.daily_queues.clear();
      await targetDb.study_sheets.clear();
    }
  );

  try {
    window.localStorage.setItem(CANONICAL_DATASET_VERSION_KEY, CANONICAL_DATASET_VERSION);
  } catch {
    // The reset already happened; leave the app usable if persistence is blocked.
  }

  console.info('Study progress reset for canonical 10,000-word dataset.');
}

let dbInstance: EnglishHubDB | null = null;
let datasetSynchronized = false;
let initializationPromise: Promise<number> | null = null;

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
 * Performs the database initialization and canonical dataset synchronization.
 */
async function initializeDatabase(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  const db = getDB();
  
  try {
    const count = await db.content_items.count();
    const formattedSeeds: ContentItem[] = (seedData as any[]).map(item => ({
      ...item,
      normalized_content: item.normalized_content || normalizeContent(item.content),
      times_encountered: item.times_encountered || 0,
      anki_status: (item.anki_status as AnkiStatus) || 'not_created',
      date_added: item.date_added || new Date().toISOString()
    }));

    let initializedCount = count;

    if (count === 0) {
      console.log('Seeding canonical dataset v4 (10,311 items)...');

      // Chunked insert for efficiency
      const chunkSize = 5000;
      for (let i = 0; i < formattedSeeds.length; i += chunkSize) {
        const chunk = formattedSeeds.slice(i, i + chunkSize);
        await db.content_items.bulkPut(chunk);
      }
      console.log('Seeding complete! 10,000 vocabulary words plus phrases and phrasal verbs ready.');
      initializedCount = formattedSeeds.length;
    } else {
      const existingBaseItems = await db.content_items.where('source').equals('base').toArray();
      const existingBaseIds = new Set(existingBaseItems.map(item => item.id));
      const missingSeeds = formattedSeeds.filter(
        seed => seed.source === 'base' && !existingBaseIds.has(seed.id)
      );

      const chunkSize = 5000;
      for (let i = 0; i < missingSeeds.length; i += chunkSize) {
        const chunk = missingSeeds.slice(i, i + chunkSize);
        await db.content_items.bulkPut(chunk);
      }
      initializedCount = count + missingSeeds.length;
    }

    await migrateLegacyDatabase(db);
    await resetStudyProgressForDatasetVersion(db);
    return initializedCount;
  } catch (error) {
    console.error('Error initializing database:', error);
    return 0;
  }
}

/**
 * Initializes once per browser session and deduplicates concurrent callers.
 * Queue navigation can call this from several components without rescanning
 * all 10,311 records on every interaction.
 */
export function initDatabase(): Promise<number> {
  if (typeof window === 'undefined') return Promise.resolve(0);
  if (datasetSynchronized) return getDB().content_items.count();
  if (initializationPromise) return initializationPromise;

  initializationPromise = initializeDatabase()
    .then(initializedCount => {
      if (initializedCount > 0) datasetSynchronized = true;
      return initializedCount;
    })
    .finally(() => {
      initializationPromise = null;
    });

  return initializationPromise;
}

/**
 * Hard reset database to clean canonical state
 */
export async function hardResetDatabase(): Promise<void> {
  const db = getDB();
  await db.delete();
  dbInstance = new EnglishHubDB();
  datasetSynchronized = false;
  initializationPromise = null;
  await initDatabase();
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
  await initDatabase();
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
  await initDatabase();
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
