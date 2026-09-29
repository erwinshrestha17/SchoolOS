import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  changedFields,
  formSectionStatus,
  isFormDirty,
  parseDensity,
  parseHiddenColumns,
  parseInspectorId,
  serializeHiddenColumns,
  toggleHiddenColumn,
} from '../lib/workspace-view-state.ts';

const columns = [
  { id: 'name', label: 'Name', hideable: false },
  { id: 'class', label: 'Class' },
  { id: 'guardian', label: 'Guardian' },
];

describe('workspace view state (Phase 3E)', () => {
  it('density falls back to standard for anything unexpected', () => {
    assert.equal(parseDensity('compact'), 'compact');
    assert.equal(parseDensity('standard'), 'standard');
    assert.equal(parseDensity('huge'), 'standard');
    assert.equal(parseDensity(undefined), 'standard');
  });

  it('ignores unknown and non-hideable columns from a hand-edited URL', () => {
    assert.deepEqual(
      [...parseHiddenColumns('class,name,unknown, guardian', columns)].sort(),
      ['class', 'guardian'],
    );
    assert.equal(parseHiddenColumns('', columns).size, 0);
    assert.equal(parseHiddenColumns(42, columns).size, 0);
  });

  it('serializes deterministically', () => {
    assert.equal(
      serializeHiddenColumns(new Set(['guardian', 'class'])),
      'class,guardian',
    );
  });

  it('never hides an identifying column or every column', () => {
    assert.deepEqual([...toggleHiddenColumn(new Set(), 'name', columns)], []);
    const onlyOne = [{ id: 'a', label: 'A' }];
    assert.deepEqual([...toggleHiddenColumn(new Set(), 'a', onlyOne)], []);
    assert.deepEqual(
      [...toggleHiddenColumn(new Set(['class']), 'class', columns)],
      [],
    );
  });
});

describe('inspector id parsing (Phase 3F)', () => {
  it('accepts opaque ids and rejects injection-shaped values', () => {
    assert.equal(parseInspectorId('9c1f-ab_12'), '9c1f-ab_12');
    assert.equal(parseInspectorId(' abc '), 'abc');
    assert.equal(parseInspectorId('../etc'), null);
    assert.equal(parseInspectorId('<script>'), null);
    assert.equal(parseInspectorId(''), null);
    assert.equal(parseInspectorId(undefined), null);
    assert.equal(parseInspectorId('x'.repeat(129)), null);
  });
});

describe('form dirty state (Phase 3G)', () => {
  it('treats blank-equivalent values as unchanged', () => {
    assert.equal(
      isFormDirty({ a: '', b: null }, { a: null, b: undefined }),
      false,
    );
  });

  it('reports changed fields including nested values and dates', () => {
    assert.deepEqual(
      changedFields(
        { name: 'A', tags: ['x'], dob: new Date('2020-01-01'), meta: { k: 1 } },
        {
          name: 'A',
          tags: ['x', 'y'],
          dob: new Date('2020-01-02'),
          meta: { k: 1 },
        },
      ),
      ['dob', 'tags'],
    );
  });

  it('is insensitive to key order', () => {
    assert.equal(
      isFormDirty({ o: { a: 1, b: 2 } }, { o: { b: 2, a: 1 } }),
      false,
    );
  });

  it('derives section status with errors taking precedence', () => {
    assert.equal(formSectionStatus({ errors: 1, missingRequired: 3 }), 'error');
    assert.equal(
      formSectionStatus({ errors: 0, missingRequired: 2 }),
      'incomplete',
    );
    assert.equal(
      formSectionStatus({ errors: 0, missingRequired: 0 }),
      'complete',
    );
  });
});
