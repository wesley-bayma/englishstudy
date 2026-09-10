import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionToken, verifySessionToken } from '../lib/session';
import { getDB } from '../lib/db';
import { commitImport, validateImportData } from '../lib/export-import';

vi.stubGlobal('window', globalThis);

describe('session security', () => {
  it('creates an opaque expiring token that validates only with the correct secret', async () => {
    const now = Date.UTC(2026, 0, 1);
    const token = await createSessionToken('a'.repeat(32), now);
    expect(token).not.toContain('password');
    expect(await verifySessionToken(token, 'a'.repeat(32), now)).toBe(true);
    expect(await verifySessionToken(token, 'b'.repeat(32), now)).toBe(false);
    expect(await verifySessionToken(token, 'a'.repeat(32), now + 31 * 24 * 60 * 60 * 1000)).toBe(false);
  });
});

describe('safe imports', () => {
  beforeEach(async () => {
    const db = getDB();
    await db.content_items.clear();
    await db.encounters.clear();
    await db.daily_queues.clear();
    await db.study_sheets.clear();
  });

  it('rejects invalid sources, repeated IDs and oversized text fields', async () => {
    const report = await validateImportData(JSON.stringify([
      { id: 'same', content: 'first', source: 'base' },
      { id: 'same', content: 'second', source: 'base' },
      { id: 'bad-source', content: 'third', source: 'not-a-source' },
      { id: 'too-large', content: 'fourth', source: 'base', notes: 'x'.repeat(2001) }
    ]), 'json');

    expect(report.valid_count).toBe(1);
    expect(report.invalid_count).toBe(3);
    expect(report.errors.length).toBe(3);
  });

  it('does not overwrite existing records when committing an import', async () => {
    const db = getDB();
    await db.content_items.add({
      id: 'existing', content: 'existing', normalized_content: 'existing', type: 'vocabulary', source: 'base',
      source_detail: null, source_url: null, timestamp_marker: null, original_order: 1, anki_status: 'created',
      anki_created_at: null, date_added: new Date().toISOString(), times_encountered: 4, last_encountered: null,
      meaning_pt: 'original', example: null, base_form: 'existing', notes: null
    });
    const count = await commitImport([{
      id: 'existing', content: 'changed', normalized_content: 'changed', type: 'vocabulary', source: 'base',
      source_detail: null, source_url: null, timestamp_marker: null, original_order: 1, anki_status: 'not_created',
      anki_created_at: null, date_added: new Date().toISOString(), times_encountered: 0, last_encountered: null,
      meaning_pt: 'changed', example: null, base_form: 'changed', notes: null
    }], false);

    expect(count).toBe(0);
    expect((await db.content_items.get('existing'))?.meaning_pt).toBe('original');
  });

  it('accepts and preserves IPA during JSON import', async () => {
    const report = await validateImportData(JSON.stringify([{
      id: 'ipa-item', content: 'regular', source: 'base', ipa: '/ˈreɡ.jə.lɚ/'
    }]), 'json');

    expect(report.valid_count).toBe(1);
    expect(report.valid_items[0].ipa).toBe('/ˈreɡ.jə.lɚ/');
  });
});
