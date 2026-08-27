import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDB,
  hardResetDatabase,
  addInboxItem
} from '../lib/db';
import {
  getOrCreateTodayQueue,
  getTodayDateString,
  getAvailableQueueDates,
  getQueueForDate,
  regenerateTodayQueue,
  setQueueItemAnkiStatus,
  skipQueueItem
} from '../lib/daily-queue';
import { DailyQueue } from '../lib/types';

vi.stubGlobal('window', globalThis);

function shiftDate(dateString: string, days: number): string {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function queueFor(date: string, contentIds: string[], status: 'pending' | 'created' | 'skipped' = 'pending'): DailyQueue {
  return {
    id: `queue_${date}`,
    date,
    items: contentIds.map((contentId, index) => ({
      content_id: contentId,
      type: 'vocabulary' as const,
      status: index === 0 ? status : 'pending'
    })),
    completed_count: status === 'created' ? 1 : 0,
    target_count: contentIds.length
  };
}

describe('daily queue scheduling', () => {
  beforeAll(async () => {
    await hardResetDatabase();
  }, 30000);

  beforeEach(async () => {
    vi.useRealTimers();
    const db = getDB();
    const allItems = await db.content_items.toArray();
    const inboxIds = allItems.filter(item => item.source !== 'base').map(item => item.id);

    await db.daily_queues.clear();
    await db.study_sheets.clear();
    await db.encounters.clear();
    if (inboxIds.length > 0) await db.content_items.bulkDelete(inboxIds);
    const createdBaseItems = allItems
      .filter(item => item.source === 'base' && item.anki_status === 'created')
      .map(item => ({
        ...item,
        anki_status: 'not_created' as const,
        anki_created_at: null,
        times_encountered: 0,
        last_encountered: null
      }));
    if (createdBaseItems.length > 0) await db.content_items.bulkPut(createdBaseItems);
  });

  afterAll(async () => {
    vi.useRealTimers();
    await getDB().delete();
  });

  it('does not deliver yesterday\'s pending or created items again today', async () => {
    const today = getTodayDateString();
    const yesterday = shiftDate(today, -1);
    const db = getDB();

    await db.content_items.update('base_vocab_2', {
      anki_status: 'created',
      anki_created_at: `${yesterday}T12:00:00.000Z`
    });
    await db.daily_queues.put(queueFor(yesterday, ['base_vocab_1', 'base_vocab_2']));

    const result = await regenerateTodayQueue();
    const ids = result.items.map(item => item.id);

    expect(ids).not.toContain('base_vocab_1');
    expect(ids).not.toContain('base_vocab_2');
    expect((await db.content_items.get('base_vocab_1'))?.anki_status).toBe('not_created');
  });

  it('repairs a current queue that contains an item from a previous day', async () => {
    const today = getTodayDateString();
    const yesterday = shiftDate(today, -1);
    const db = getDB();

    await db.daily_queues.put(queueFor(yesterday, ['base_vocab_1']));
    await db.daily_queues.put(queueFor(today, ['base_vocab_1', 'base_vocab_20']));

    const result = await getOrCreateTodayQueue();
    const ids = result.items.map(item => item.id);

    expect(result.queue.id).toBe(`queue_${today}`);
    expect(ids).not.toContain('base_vocab_1');
    expect(result.queue.target_count).toBe(10);
  });

  it('repairs a created item from yesterday even when its old queue is missing', async () => {
    const today = getTodayDateString();
    const yesterday = shiftDate(today, -1);
    const db = getDB();

    await db.content_items.update('base_vocab_1', {
      anki_status: 'created',
      anki_created_at: `${yesterday}T12:00:00.000Z`
    });
    await db.daily_queues.put(queueFor(today, ['base_vocab_1', 'base_vocab_20']));

    const result = await getOrCreateTodayQueue();

    expect(result.items.map(item => item.id)).not.toContain('base_vocab_1');
    expect(result.queue.items.map(item => item.content_id)).not.toContain('base_vocab_1');
  });

  it('keeps the same queue when refreshing on the same day', async () => {
    const today = getTodayDateString();
    const db = getDB();
    const existingQueue = queueFor(today, ['base_vocab_250']);

    await db.daily_queues.put(existingQueue);

    const result = await getOrCreateTodayQueue();

    expect(result.queue.items).toEqual(existingQueue.items);
    expect(result.items.map(item => item.id)).toEqual(['base_vocab_250']);
  });

  it('respects a custom daily target without exceeding it', async () => {
    const oneCard = await regenerateTodayQueue(1);
    expect(oneCard.queue.target_count).toBe(1);
    expect(oneCard.items).toHaveLength(1);

    const twelveCards = await regenerateTodayQueue(12);
    expect(twelveCards.queue.target_count).toBe(12);
    expect(twelveCards.items).toHaveLength(12);
    expect(twelveCards.items.filter(item => item.type === 'survival_phrase')).toHaveLength(3);
    expect(twelveCards.items.filter(item => item.type === 'phrasal_verb')).toHaveLength(2);
  });

  it('loads a saved historical queue without creating a missing queue', async () => {
    const today = getTodayDateString();
    const yesterday = shiftDate(today, -1);
    const db = getDB();

    await db.daily_queues.put(queueFor(yesterday, ['base_vocab_250']));

    const historical = await getQueueForDate(yesterday);
    const missing = await getQueueForDate(shiftDate(yesterday, -1));

    expect(historical?.items.map(item => item.id)).toEqual(['base_vocab_250']);
    expect(missing).toBeNull();
    expect(await db.daily_queues.get(`queue_${shiftDate(yesterday, -1)}`)).toBeUndefined();
  });

  it('does not expose future queues as available navigation dates', async () => {
    const today = getTodayDateString();
    const tomorrow = shiftDate(today, 1);
    const db = getDB();

    await db.daily_queues.put(queueFor(tomorrow, ['base_vocab_250']));

    const dates = await getAvailableQueueDates();

    expect(dates).toContain(today);
    expect(dates).not.toContain(tomorrow);
  });

  it('updates the current queue when an item is marked in Anki', async () => {
    const result = await regenerateTodayQueue();
    const item = result.items[0];
    const db = getDB();

    const updated = await setQueueItemAnkiStatus(item.id, 'created');
    const storedItem = await db.content_items.get(item.id);
    const storedQueueItem = updated.queue.items.find(queueItem => queueItem.content_id === item.id);

    expect(storedItem?.anki_status).toBe('created');
    expect(storedQueueItem?.status).toBe('created');
    expect(updated.queue.completed_count).toBe(1);
  });

  it('allows a skipped item to be selected again in a future queue', async () => {
    const today = getTodayDateString();
    const yesterday = shiftDate(today, -1);
    const db = getDB();

    await db.daily_queues.put(queueFor(yesterday, ['base_vocab_1'], 'skipped'));

    const result = await regenerateTodayQueue();

    expect(result.items.map(item => item.id)).toContain('base_vocab_1');
  });

  it('does not use a previous day item as a skip replacement', async () => {
    const today = getTodayDateString();
    const yesterday = shiftDate(today, -1);
    const db = getDB();

    await db.daily_queues.put(queueFor(yesterday, ['base_vocab_2']));
    await db.daily_queues.put(queueFor(today, ['base_vocab_1']));

    const result = await skipQueueItem('base_vocab_1', 'vocabulary');
    const replacementIds = result.queue.items
      .filter(item => item.status === 'pending')
      .map(item => item.content_id);

    expect(replacementIds).not.toContain('base_vocab_2');
    expect(replacementIds).toContain('base_vocab_3');
  });

  it('delivers a new Inbox item once and excludes it on the next day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-01T10:00:00-03:00'));

    const inboxItem = await addInboxItem({
      content: 'test inbox item',
      type: 'vocabulary',
      source: 'other'
    });
    const firstDay = await regenerateTodayQueue();
    expect(firstDay.items.map(item => item.id)).toContain(inboxItem.id);

    vi.setSystemTime(new Date('2026-09-02T10:00:00-03:00'));
    const secondDay = await getOrCreateTodayQueue();

    expect(secondDay.items.map(item => item.id)).not.toContain(inboxItem.id);
  });
});
