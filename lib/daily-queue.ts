import { getDB, initDatabase } from './db';
import { ContentItem, DailyQueue, DailyQueueItem, ContentType } from './types';

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getFormattedDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Shuffles an array with Fisher-Yates while maintaining variety
 */
function shuffleWithVariety<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Selects candidate items for a specific content type based on priority rules
 */
async function selectItemsForCategory(
  type: ContentType,
  count: number,
  excludeIds: Set<string>
): Promise<ContentItem[]> {
  const db = getDB();
  const allOfType = await db.content_items
    .where('type')
    .equals(type)
    .toArray();

  // Filter out already created in Anki and already included in today's queue
  const pending = allOfType.filter(
    item => item.anki_status === 'not_created' && !excludeIds.has(item.id)
  );

  // 1. Priority 1: Base items naturally encountered (times_encountered > 0)
  const baseEncountered = pending.filter(i => i.source === 'base' && i.times_encountered > 0);
  baseEncountered.sort((a, b) => b.times_encountered - a.times_encountered);

  // 2. Priority 2: Inbox items (source !== 'base')
  const inboxItems = pending.filter(i => i.source !== 'base');
  inboxItems.sort((a, b) => {
    if (b.times_encountered !== a.times_encountered) {
      return b.times_encountered - a.times_encountered;
    }
    return new Date(b.date_added).getTime() - new Date(a.date_added).getTime();
  });

  // 3. Priority 3: Base items not yet encountered
  const baseUnseen = pending.filter(i => i.source === 'base' && i.times_encountered === 0);
  const shuffledBaseUnseen = shuffleWithVariety(baseUnseen);

  const selected: ContentItem[] = [];

  // Fill from Priority 1
  for (const item of baseEncountered) {
    if (selected.length >= count) break;
    selected.push(item);
    excludeIds.add(item.id);
  }

  // Fill from Priority 2
  for (const item of inboxItems) {
    if (selected.length >= count) break;
    selected.push(item);
    excludeIds.add(item.id);
  }

  // Fill from Priority 3
  for (const item of shuffledBaseUnseen) {
    if (selected.length >= count) break;
    selected.push(item);
    excludeIds.add(item.id);
  }

  return selected;
}

/**
 * Gets or creates today's daily queue, ensuring database is seeded and queue is not empty
 */
export async function getOrCreateTodayQueue(
  goals = { vocabulary: 5, phrases: 3, phrasal_verbs: 2 }
): Promise<{ queue: DailyQueue; items: ContentItem[] }> {
  const db = getDB();
  const todayStr = getTodayDateString();
  const queueId = `queue_${todayStr}`;

  // Ensure DB is initialized with seeds
  await initDatabase();

  let queue = await db.daily_queues.get(queueId);

  // If queue doesn't exist OR was saved empty (e.g. before initial seeding), regenerate it
  if (!queue || !queue.items || queue.items.length === 0) {
    return await regenerateTodayQueue(goals);
  }

  // Hydrate full content items
  const itemIds = queue.items.map(qi => qi.content_id);
  const hydratedItems = await db.content_items.where('id').anyOf(itemIds).toArray();

  // If hydration returned fewer items (e.g. 0), regenerate
  if (hydratedItems.length === 0) {
    return await regenerateTodayQueue(goals);
  }

  const idMap = new Map(hydratedItems.map(item => [item.id, item]));
  const orderedItems = queue.items
    .map(qi => idMap.get(qi.content_id))
    .filter((item): item is ContentItem => item !== undefined);

  return { queue, items: orderedItems };
}

/**
 * Force regenerates today's queue
 */
export async function regenerateTodayQueue(
  goals = { vocabulary: 5, phrases: 3, phrasal_verbs: 2 }
): Promise<{ queue: DailyQueue; items: ContentItem[] }> {
  const db = getDB();
  const todayStr = getTodayDateString();
  const queueId = `queue_${todayStr}`;

  await initDatabase();

  const excludeIds = new Set<string>();

  const vocabItems = await selectItemsForCategory('vocabulary', goals.vocabulary, excludeIds);
  const phraseItems = await selectItemsForCategory('survival_phrase', goals.phrases, excludeIds);
  const pvItems = await selectItemsForCategory('phrasal_verb', goals.phrasal_verbs, excludeIds);

  const queueItems: DailyQueueItem[] = [
    ...vocabItems.map(i => ({ content_id: i.id, type: i.type, status: 'pending' as const })),
    ...phraseItems.map(i => ({ content_id: i.id, type: i.type, status: 'pending' as const })),
    ...pvItems.map(i => ({ content_id: i.id, type: i.type, status: 'pending' as const }))
  ];

  const queue: DailyQueue = {
    id: queueId,
    date: todayStr,
    items: queueItems,
    completed_count: 0,
    target_count: queueItems.length
  };

  await db.daily_queues.put(queue);

  const allSelected = [...vocabItems, ...phraseItems, ...pvItems];
  return { queue, items: allSelected };
}

/**
 * Skip a queue item and pull a replacement for the same category
 */
export async function skipQueueItem(
  contentId: string,
  type: ContentType
): Promise<{ queue: DailyQueue; items: ContentItem[] }> {
  const db = getDB();
  const todayStr = getTodayDateString();
  const queueId = `queue_${todayStr}`;

  let queue = await db.daily_queues.get(queueId);
  if (!queue) {
    const res = await getOrCreateTodayQueue();
    queue = res.queue;
  }

  const existingIds = new Set(queue.items.map(qi => qi.content_id));

  // Find a replacement item of the same type
  const replacements = await selectItemsForCategory(type, 1, existingIds);

  const updatedItems = queue.items.map(qi => {
    if (qi.content_id === contentId) {
      return { ...qi, status: 'skipped' as const };
    }
    return qi;
  });

  if (replacements.length > 0) {
    updatedItems.push({
      content_id: replacements[0].id,
      type: replacements[0].type,
      status: 'pending'
    });
  }

  queue.items = updatedItems;
  await db.daily_queues.update(queueId, { items: updatedItems });

  // Hydrate full content items
  const itemIds = queue.items.map(qi => qi.content_id);
  const hydratedItems = await db.content_items.where('id').anyOf(itemIds).toArray();
  const idMap = new Map(hydratedItems.map(item => [item.id, item]));
  const orderedItems = queue.items
    .map(qi => idMap.get(qi.content_id))
    .filter((item): item is ContentItem => item !== undefined);

  return { queue, items: orderedItems };
}

/**
 * Mark a queue item as created in Anki
 */
export async function markQueueItemCreated(
  contentId: string
): Promise<{ queue: DailyQueue; items: ContentItem[] }> {
  const db = getDB();
  const todayStr = getTodayDateString();
  const queueId = `queue_${todayStr}`;

  const now = new Date().toISOString();
  await db.content_items.update(contentId, {
    anki_status: 'created',
    anki_created_at: now
  });

  let queue = await db.daily_queues.get(queueId);
  if (!queue) {
    const res = await getOrCreateTodayQueue();
    queue = res.queue;
  }

  let completedCount = 0;
  const updatedItems = queue.items.map(qi => {
    if (qi.content_id === contentId) {
      qi.status = 'created';
    }
    if (qi.status === 'created') {
      completedCount++;
    }
    return qi;
  });

  queue.items = updatedItems;
  queue.completed_count = completedCount;

  await db.daily_queues.update(queueId, {
    items: updatedItems,
    completed_count: completedCount
  });

  const itemIds = queue.items.map(qi => qi.content_id);
  const hydratedItems = await db.content_items.where('id').anyOf(itemIds).toArray();
  const idMap = new Map(hydratedItems.map(item => [item.id, item]));
  const orderedItems = queue.items
    .map(qi => idMap.get(qi.content_id))
    .filter((item): item is ContentItem => item !== undefined);

  return { queue, items: orderedItems };
}
