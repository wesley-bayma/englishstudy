import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDB,
  hardResetDatabase,
  addInboxItem
} from '../lib/db';
import {
  getOrCreateTodayQueue,
  getTodayDateString,
  regenerateTodayQueue,
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
  beforeEach(async () => {
    vi.useRealTimers();
    await hardResetDatabase();
    await getDB().daily_queues.clear();
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

  it('keeps the same queue when refreshing on the same day', async () => {
    const today = getTodayDateString();
    const db = getDB();
    const existingQueue = queueFor(today, ['base_vocab_250']);

    await db.daily_queues.put(existingQueue);

    const result = await getOrCreateTodayQueue();

    expect(result.queue.items).toEqual(existingQueue.items);
    expect(result.items.map(item => item.id)).toEqual(['base_vocab_250']);
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
