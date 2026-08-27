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
 * Returns content IDs that were already delivered by an earlier daily queue.
 * Skipped entries remain eligible for a future queue; all other entries are
 * reserved for the day on which they were first delivered.
 */
async function getPreviouslyScheduledItemIds(todayStr: string): Promise<Set<string>> {
  const db = getDB();
  const previousQueues = await db.daily_queues
    .where('date')
    .below(todayStr)
    .toArray();

  const scheduledIds = new Set<string>();
  for (const previousQueue of previousQueues) {
    for (const queueItem of previousQueue.items || []) {
      if (queueItem.status !== 'skipped') {
        scheduledIds.add(queueItem.content_id);
      }
    }
  }

  return scheduledIds;
}

/**
 * Selects candidate items for a specific content type in STRICT sequential order (NEVER RANDOM)
 */
async function selectItemsForCategory(
  type: ContentType,
  count: number,
  excludeIds: Set<string>
): Promise<ContentItem[]> {
  if (count <= 0) return [];

  const db = getDB();
  const allOfType = await db.content_items
    .where('type')
    .equals(type)
    .toArray();

  // Filter out already created in Anki and already included in today's queue
  const pending = allOfType.filter(
    item => item.anki_status === 'not_created' && !excludeIds.has(item.id)
  );

  // 1. Priority 1: Naturally encountered items (sorted by highest encounters, then original_order)
  const encountered = pending.filter(i => (i.times_encountered || 0) > 0);
  encountered.sort((a, b) => {
    if ((b.times_encountered || 0) !== (a.times_encountered || 0)) {
      return (b.times_encountered || 0) - (a.times_encountered || 0);
    }
    return (a.original_order || 999999) - (b.original_order || 999999);
  });

  // 2. Priority 2: Inbox items without encounters (sorted deterministically by date_added ascending)
  const inboxUnseen = pending.filter(i => i.source !== 'base' && (i.times_encountered || 0) === 0);
  inboxUnseen.sort((a, b) => new Date(a.date_added).getTime() - new Date(b.date_added).getTime());

  // 3. Priority 3: Base items strictly in canonical list order (1, 2, 3, 4, 5...)
  const baseUnseen = pending.filter(i => i.source === 'base' && (i.times_encountered || 0) === 0);
  baseUnseen.sort((a, b) => (a.original_order || 0) - (b.original_order || 0));

  const selected: ContentItem[] = [];

  // Fill from Priority 1
  for (const item of encountered) {
    if (selected.length >= count) break;
    selected.push(item);
    excludeIds.add(item.id);
  }

  // Fill from Priority 2
  for (const item of inboxUnseen) {
    if (selected.length >= count) break;
    selected.push(item);
    excludeIds.add(item.id);
  }

  // Fill from Priority 3 (Strict sequential list order)
  for (const item of baseUnseen) {
    if (selected.length >= count) break;
    selected.push(item);
    excludeIds.add(item.id);
  }

  return selected;
}

/**
 * Gets or creates today's daily queue in strict sequential order.
 * When phrases or phrasal verbs run out, the daily target of 10 is automatically filled by remaining vocabulary.
 */
export async function getOrCreateTodayQueue(
  totalTarget = 10
): Promise<{ queue: DailyQueue; items: ContentItem[] }> {
  const db = getDB();
  const todayStr = getTodayDateString();
  const queueId = `queue_${todayStr}`;

  // Ensure DB is initialized with seeds
  await initDatabase();

  let queue = await db.daily_queues.get(queueId);

  // If queue doesn't exist OR was saved empty, generate it
  if (!queue || !queue.items || queue.items.length === 0) {
    return await regenerateTodayQueue(totalTarget);
  }

  // A queue created by an older version may contain items already delivered
  // on a previous day. Repair it before showing it to the user.
  const previouslyScheduledIds = await getPreviouslyScheduledItemIds(todayStr);
  const hasHistoricalItems = queue.items.some(item => previouslyScheduledIds.has(item.content_id));
  if (hasHistoricalItems) {
    return await regenerateTodayQueue(totalTarget);
  }

  // Hydrate full content items
  const itemIds = queue.items.map(qi => qi.content_id);
  const hydratedItems = await db.content_items.where('id').anyOf(itemIds).toArray();

  if (hydratedItems.length === 0) {
    return await regenerateTodayQueue(totalTarget);
  }

  const idMap = new Map(hydratedItems.map(item => [item.id, item]));
  const orderedItems = queue.items
    .map(qi => idMap.get(qi.content_id))
    .filter((item): item is ContentItem => item !== undefined);

  return { queue, items: orderedItems };
}

/**
 * Force regenerates today's queue in strict sequential order.
 * - Phrases: up to 3/day (in order #1, #2, #3...)
 * - Phrasal Verbs: up to 2/day (in order #1, #2...)
 * - Vocabulary: Remaining count up to 10 (normally 5/day, becomes 8 when phrases end, 7 when PVs end, 10 when both end)
 */
export async function regenerateTodayQueue(
  totalTarget = 10
): Promise<{ queue: DailyQueue; items: ContentItem[] }> {
  const db = getDB();
  const todayStr = getTodayDateString();
  const queueId = `queue_${todayStr}`;

  await initDatabase();

  // Once an item has been delivered, it belongs to that day's agenda even if
  // the user has not yet marked it as created in Anki.
  const excludeIds = await getPreviouslyScheduledItemIds(todayStr);

  // 1. Select up to 3 Survival Phrases
  const phraseItems = await selectItemsForCategory('survival_phrase', 3, excludeIds);

  // 2. Select up to 2 Phrasal Verbs
  const pvItems = await selectItemsForCategory('phrasal_verb', 2, excludeIds);

  // 3. Fill the rest of the daily quota with Vocabulary (sequential order #1, #2, #3...)
  const neededVocab = Math.max(0, totalTarget - (phraseItems.length + pvItems.length));
  const vocabItems = await selectItemsForCategory('vocabulary', neededVocab, excludeIds);

  // Assemble queue strictly ordered: Vocabularies (#1..#5), Phrases (#1..#3), Phrasal Verbs (#1..#2)
  const allSelected = [...vocabItems, ...phraseItems, ...pvItems];

  const queueItems: DailyQueueItem[] = allSelected.map(i => ({
    content_id: i.id,
    type: i.type,
    status: 'pending' as const
  }));

  const queue: DailyQueue = {
    id: queueId,
    date: todayStr,
    items: queueItems,
    completed_count: 0,
    target_count: queueItems.length
  };

  await db.daily_queues.put(queue);

  return { queue, items: allSelected };
}

/**
 * Skip a queue item and pull the next sequential replacement for the same category
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

  const existingIds = await getPreviouslyScheduledItemIds(todayStr);
  queue.items.forEach(qi => existingIds.add(qi.content_id));

  // Find the NEXT sequential item in the list of the same type (or vocab if other category exhausted)
  let replacements = await selectItemsForCategory(type, 1, existingIds);
  if (replacements.length === 0) {
    replacements = await selectItemsForCategory('vocabulary', 1, existingIds);
  }

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
