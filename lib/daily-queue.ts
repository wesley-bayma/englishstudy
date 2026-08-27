import { getDB, initDatabase } from './db';
import { ContentItem, DailyQueue, DailyQueueItem, ContentType, AnkiStatus } from './types';

export type QueueResult = { queue: DailyQueue; items: ContentItem[] };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertDateString(dateStr: string): void {
  if (!DATE_PATTERN.test(dateStr)) {
    throw new Error(`Invalid queue date: ${dateStr}`);
  }
}

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalDateFromIso(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? null : getLocalDateString(date);
}

function getQueueId(dateStr: string): string {
  return `queue_${dateStr}`;
}

export function getTodayDateString(): string {
  return getLocalDateString(new Date());
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
async function getPreviouslyScheduledItemIds(targetDate: string): Promise<Set<string>> {
  assertDateString(targetDate);

  const db = getDB();
  const previousQueues = await db.daily_queues
    .where('date')
    .below(targetDate)
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

async function hydrateQueue(queue: DailyQueue): Promise<QueueResult> {
  const db = getDB();
  const queueItems = queue.items || [];
  const itemIds = queueItems.map(qi => qi.content_id);

  if (itemIds.length === 0) {
    return { queue, items: [] };
  }

  const hydratedItems = await db.content_items.where('id').anyOf(itemIds).toArray();
  const idMap = new Map(hydratedItems.map(item => [item.id, item]));
  const orderedItems = queueItems
    .map(qi => idMap.get(qi.content_id))
    .filter((item): item is ContentItem => item !== undefined);

  return { queue, items: orderedItems };
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

  // Filter out already created in Anki and already delivered in an earlier queue.
  const pending = allOfType.filter(
    item => item.anki_status === 'not_created' && !excludeIds.has(item.id)
  );

  // 1. Naturally encountered items (sorted by highest encounters, then original_order)
  const encountered = pending.filter(i => (i.times_encountered || 0) > 0);
  encountered.sort((a, b) => {
    if ((b.times_encountered || 0) !== (a.times_encountered || 0)) {
      return (b.times_encountered || 0) - (a.times_encountered || 0);
    }
    return (a.original_order || 999999) - (b.original_order || 999999);
  });

  // 2. Inbox items without encounters (sorted deterministically by date_added ascending)
  const inboxUnseen = pending.filter(i => i.source !== 'base' && (i.times_encountered || 0) === 0);
  inboxUnseen.sort((a, b) => new Date(a.date_added).getTime() - new Date(b.date_added).getTime());

  // 3. Base items strictly in canonical list order (1, 2, 3, 4, 5...)
  const baseUnseen = pending.filter(i => i.source === 'base' && (i.times_encountered || 0) === 0);
  baseUnseen.sort((a, b) => (a.original_order || 0) - (b.original_order || 0));

  const selected: ContentItem[] = [];

  for (const item of encountered) {
    if (selected.length >= count) break;
    selected.push(item);
    excludeIds.add(item.id);
  }

  for (const item of inboxUnseen) {
    if (selected.length >= count) break;
    selected.push(item);
    excludeIds.add(item.id);
  }

  for (const item of baseUnseen) {
    if (selected.length >= count) break;
    selected.push(item);
    excludeIds.add(item.id);
  }

  return selected;
}

async function selectDailyItems(
  totalTarget: number,
  excludeIds: Set<string>
): Promise<ContentItem[]> {
  const phraseItems = await selectItemsForCategory('survival_phrase', 3, excludeIds);
  const pvItems = await selectItemsForCategory('phrasal_verb', 2, excludeIds);
  const neededVocab = Math.max(0, totalTarget - (phraseItems.length + pvItems.length));
  const vocabItems = await selectItemsForCategory('vocabulary', neededVocab, excludeIds);

  return [...vocabItems, ...phraseItems, ...pvItems];
}

function queueItemsEqual(a: DailyQueueItem[], b: DailyQueueItem[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function synchronizeQueueItems(
  queueItems: DailyQueueItem[],
  contentById: Map<string, ContentItem>
): { items: DailyQueueItem[]; completedCount: number; changed: boolean } {
  let completedCount = 0;
  const items = queueItems.map(queueItem => {
    const contentItem = contentById.get(queueItem.content_id);
    let nextStatus = queueItem.status;

    if (queueItem.status !== 'skipped') {
      nextStatus = contentItem?.anki_status === 'created' ? 'created' : 'pending';
    }

    if (nextStatus === 'created') completedCount++;
    return nextStatus === queueItem.status
      ? queueItem
      : { ...queueItem, status: nextStatus };
  });

  return {
    items,
    completedCount,
    changed: !queueItemsEqual(queueItems, items)
  };
}

async function createQueueForDate(
  dateStr: string,
  totalTarget: number
): Promise<QueueResult> {
  assertDateString(dateStr);
  const db = getDB();
  await initDatabase();

  const excludeIds = await getPreviouslyScheduledItemIds(dateStr);
  const allSelected = await selectDailyItems(totalTarget, excludeIds);
  const queueItems: DailyQueueItem[] = allSelected.map(item => ({
    content_id: item.id,
    type: item.type,
    status: 'pending'
  }));

  const queue: DailyQueue = {
    id: getQueueId(dateStr),
    date: dateStr,
    items: queueItems,
    completed_count: 0,
    target_count: queueItems.length
  };

  await db.daily_queues.put(queue);
  return { queue, items: allSelected };
}

async function repairTodayQueue(
  queue: DailyQueue,
  hydratedItems: ContentItem[],
  invalidIds: Set<string>,
  totalTarget: number
): Promise<QueueResult> {
  const db = getDB();
  const todayStr = getTodayDateString();
  const contentById = new Map(hydratedItems.map(item => [item.id, item]));
  const synchronized = synchronizeQueueItems(queue.items || [], contentById);
  const validQueueItems = synchronized.items.filter(item => !invalidIds.has(item.content_id));
  const invalidTypes = (queue.items || [])
    .filter(item => invalidIds.has(item.content_id))
    .map(item => item.type);

  const excludeIds = await getPreviouslyScheduledItemIds(todayStr);
  validQueueItems.forEach(item => excludeIds.add(item.content_id));

  const replacements: ContentItem[] = [];
  for (const type of invalidTypes) {
    if (validQueueItems.length + replacements.length >= totalTarget) break;

    let selected = await selectItemsForCategory(type, 1, excludeIds);
    if (selected.length === 0 && type !== 'vocabulary') {
      selected = await selectItemsForCategory('vocabulary', 1, excludeIds);
    }
    replacements.push(...selected);
  }

  const remainingSlots = Math.max(
    0,
    totalTarget - (validQueueItems.length + replacements.length)
  );
  if (remainingSlots > 0) {
    const additional = await selectDailyItems(remainingSlots, excludeIds);
    replacements.push(...additional);
  }

  const replacementQueueItems: DailyQueueItem[] = replacements.map(item => ({
    content_id: item.id,
    type: item.type,
    status: 'pending'
  }));
  const repairedItems = [...validQueueItems, ...replacementQueueItems];
  const completedCount = repairedItems.filter(item => item.status === 'created').length;
  const repairedQueue: DailyQueue = {
    ...queue,
    id: getQueueId(todayStr),
    date: todayStr,
    items: repairedItems,
    completed_count: completedCount,
    target_count: repairedItems.length
  };

  await db.daily_queues.put(repairedQueue);
  return hydrateQueue(repairedQueue);
}

/**
 * Loads an existing queue for any date without generating a new one.
 * Historical dates are intentionally read-only at the UI layer.
 */
export async function getQueueForDate(dateStr: string): Promise<QueueResult | null> {
  assertDateString(dateStr);
  const db = getDB();
  await initDatabase();
  const queue = await db.daily_queues.get(getQueueId(dateStr));
  return queue ? hydrateQueue(queue) : null;
}

/**
 * Returns the dates that have persisted queues, plus today. Future dates are
 * excluded because the app is driven by the current local calendar day.
 */
export async function getAvailableQueueDates(): Promise<string[]> {
  const db = getDB();
  const todayStr = getTodayDateString();
  await initDatabase();

  const queues = await db.daily_queues.toArray();
  const dates = new Set<string>([todayStr]);
  for (const queue of queues) {
    if (DATE_PATTERN.test(queue.date) && queue.date <= todayStr) {
      dates.add(queue.date);
    }
  }

  return Array.from(dates).sort();
}

/**
 * Gets or creates today's daily queue in strict sequential order.
 * The queue is always keyed by the current local date; it never reuses
 * yesterday's queue as today's queue.
 */
export async function getOrCreateTodayQueue(
  totalTarget = 10
): Promise<QueueResult> {
  const db = getDB();
  const todayStr = getTodayDateString();

  await initDatabase();
  let queue = await db.daily_queues.get(getQueueId(todayStr));

  if (!queue || queue.date !== todayStr || !queue.items || queue.items.length === 0) {
    return createQueueForDate(todayStr, totalTarget);
  }

  const hydrated = await hydrateQueue(queue);
  const contentById = new Map(hydrated.items.map(item => [item.id, item]));
  const previouslyScheduledIds = await getPreviouslyScheduledItemIds(todayStr);
  const invalidIds = new Set<string>();
  const seenIds = new Set<string>();

  for (const queueItem of queue.items) {
    const contentItem = contentById.get(queueItem.content_id);
    const createdDate = getLocalDateFromIso(contentItem?.anki_created_at || null);

    if (
      seenIds.has(queueItem.content_id) ||
      !contentItem ||
      previouslyScheduledIds.has(queueItem.content_id) ||
      (contentItem.anki_status === 'created' && createdDate !== null && createdDate < todayStr)
    ) {
      invalidIds.add(queueItem.content_id);
    }
    seenIds.add(queueItem.content_id);
  }

  if (invalidIds.size > 0 || hydrated.items.length !== queue.items.length) {
    return repairTodayQueue(queue, hydrated.items, invalidIds, totalTarget);
  }

  const synchronized = synchronizeQueueItems(queue.items, contentById);
  if (synchronized.changed || queue.completed_count !== synchronized.completedCount) {
    queue = {
      ...queue,
      items: synchronized.items,
      completed_count: synchronized.completedCount
    };
    await db.daily_queues.put(queue);
  }

  return { queue, items: hydrated.items };
}

/**
 * Force regenerates today's queue in strict sequential order.
 */
export async function regenerateTodayQueue(
  totalTarget = 10
): Promise<QueueResult> {
  return createQueueForDate(getTodayDateString(), totalTarget);
}

/**
 * Skip a queue item and pull the next sequential replacement for the same category.
 */
export async function skipQueueItem(
  contentId: string,
  type: ContentType,
  queueDate = getTodayDateString()
): Promise<QueueResult> {
  const todayStr = getTodayDateString();
  if (queueDate !== todayStr) {
    throw new Error('Only the current day queue can be changed');
  }

  const db = getDB();
  const current = await getOrCreateTodayQueue();
  const queue = current.queue;
  const existingIds = await getPreviouslyScheduledItemIds(todayStr);
  queue.items.forEach(queueItem => existingIds.add(queueItem.content_id));

  let replacements = await selectItemsForCategory(type, 1, existingIds);
  if (replacements.length === 0) {
    replacements = await selectItemsForCategory('vocabulary', 1, existingIds);
  }

  const updatedItems = queue.items.map(queueItem => {
    if (queueItem.content_id === contentId) {
      return { ...queueItem, status: 'skipped' as const };
    }
    return queueItem;
  });

  if (replacements.length > 0) {
    updatedItems.push({
      content_id: replacements[0].id,
      type: replacements[0].type,
      status: 'pending'
    });
  }

  const completedCount = updatedItems.filter(item => item.status === 'created').length;
  await db.daily_queues.update(getQueueId(todayStr), {
    items: updatedItems,
    completed_count: completedCount
  });

  return hydrateQueue({
    ...queue,
    items: updatedItems,
    completed_count: completedCount
  });
}

/**
 * Updates Anki status and the current queue atomically from the app's point of view.
 */
export async function setQueueItemAnkiStatus(
  contentId: string,
  status: AnkiStatus,
  queueDate = getTodayDateString()
): Promise<QueueResult> {
  const todayStr = getTodayDateString();
  if (queueDate !== todayStr) {
    throw new Error('Only the current day queue can be changed');
  }

  const db = getDB();
  const current = await getOrCreateTodayQueue();
  const queue = current.queue;
  if (!queue.items.some(queueItem => queueItem.content_id === contentId)) {
    throw new Error('Item is not part of the current day queue');
  }

  const now = status === 'created' ? new Date().toISOString() : null;
  const updatedItems = queue.items.map(queueItem => {
    if (queueItem.content_id === contentId && queueItem.status !== 'skipped') {
      return { ...queueItem, status: status === 'created' ? 'created' as const : 'pending' as const };
    }
    return queueItem;
  });
  const completedCount = updatedItems.filter(item => item.status === 'created').length;

  await db.transaction('rw', db.content_items, db.daily_queues, async () => {
    await db.content_items.update(contentId, {
      anki_status: status,
      anki_created_at: now
    });
    await db.daily_queues.update(getQueueId(todayStr), {
      items: updatedItems,
      completed_count: completedCount
    });
  });

  return hydrateQueue({
    ...queue,
    items: updatedItems,
    completed_count: completedCount
  });
}

/**
 * Backwards-compatible helper for the existing mark-created flow.
 */
export async function markQueueItemCreated(
  contentId: string,
  queueDate = getTodayDateString()
): Promise<QueueResult> {
  return setQueueItemAnkiStatus(contentId, 'created', queueDate);
}
