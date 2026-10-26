import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, toQueryString } from './api';

describe('toQueryString', () => {
  it('omits empty filters and keeps paging/sort', () => {
    expect(toQueryString(DEFAULT_FILTERS)).toBe('sort=daysInStock&order=desc&page=1&pageSize=25');
  });
  it('includes active filters', () => {
    const qs = new URLSearchParams(
      toQueryString({ ...DEFAULT_FILTERS, make: 'Ford', model: 'Puma', minAge: '30', aging: true }),
    );
    expect(qs.get('make')).toBe('Ford');
    expect(qs.get('model')).toBe('Puma');
    expect(qs.get('minAge')).toBe('30');
    expect(qs.get('aging')).toBe('true');
    expect(qs.has('maxAge')).toBe(false);
  });
  it('encodes free-text search safely', () => {
    expect(toQueryString({ ...DEFAULT_FILTERS, q: 'a&b=c' })).toContain('q=a%26b%3Dc');
  });
});
