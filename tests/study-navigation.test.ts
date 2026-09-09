import { describe, expect, it } from 'vitest';
import { getNextQueueItem } from '../lib/study-navigation';
import { ContentItem } from '../lib/types';

function item(id: string, ankiStatus: ContentItem['anki_status'] = 'not_created'): ContentItem {
  return {
    id,
    content: id,
    normalized_content: id,
    type: 'vocabulary',
    source: 'base',
    source_detail: null,
    source_url: null,
    timestamp_marker: null,
    original_order: 1,
    anki_status: ankiStatus,
    anki_created_at: null,
    date_added: '2026-09-09',
    times_encountered: 0,
    last_encountered: null,
    meaning_pt: null,
    example: null,
    base_form: null,
    notes: null
  };
}

describe('study navigation', () => {
  it('keeps the next target from the queue snapshot after the current card is marked as created', () => {
    const beforeSave = [item('caption'), item('building'), item('bridge')];
    const next = getNextQueueItem(beforeSave, 'caption');
    const afterSave = [item('caption', 'created'), item('building'), item('bridge')];

    expect(next?.id).toBe('building');
    expect(getNextQueueItem(afterSave, 'caption')?.id).toBe('building');
  });

  it('skips cards already created when choosing the next manual card', () => {
    const queue = [item('caption'), item('building', 'created'), item('bridge')];
    expect(getNextQueueItem(queue, 'caption')?.id).toBe('bridge');
  });
});
