import {
  NEPAL_SCHOOL_CHART_TEMPLATE,
  normalizeM9SourceModule,
  normalizeM9Token,
} from './m9-accounting.utils';

describe('M9 accounting utilities', () => {
  it('normalizes supported accounting source modules', () => {
    expect(normalizeM9SourceModule('fees')).toBe('FEES');
    expect(normalizeM9SourceModule('transport')).toBe('TRANSPORT');
  });

  it('normalizes posting tokens consistently', () => {
    expect(normalizeM9Token('Fee Payment')).toBe('FEE_PAYMENT');
  });

  it('provides Nepal school chart template accounts', () => {
    expect(NEPAL_SCHOOL_CHART_TEMPLATE.length).toBeGreaterThan(10);
    expect(NEPAL_SCHOOL_CHART_TEMPLATE.some((row) => row.code === '4000')).toBe(true);
    expect(NEPAL_SCHOOL_CHART_TEMPLATE.some((row) => row.code === '2220')).toBe(true);
  });
});
