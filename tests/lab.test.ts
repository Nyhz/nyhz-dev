// tests/lab.test.ts
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { mapLab } from '../src/scripts/content';
import { DEMOS } from '../src/scripts/lab';

describe('mapLab', () => {
  it('splits "how it works" into paragraphs and keeps the code as written', () => {
    const [l] = mapLab([{ slug: 'x', entry: {
      title: 'X', summary: 's', how: 'one\nline two\n\n  second  \n\n\n', tags: ['css'],
      code: 'a {\n  b: c;\n}\n\n', lang: 'css', source: 'https://g', order: 1,
    } }]);
    expect(l.how).toEqual(['one line two', 'second']);
    expect(l.code).toBe('a {\n  b: c;\n}');
    expect(l.lang).toBe('css');
  });
  it('falls back to ts for an unknown language, and sorts by order', () => {
    const out = mapLab([{ slug: 'b', entry: { order: 2, lang: 'cobol' } }, { slug: 'a', entry: { order: 1 } }]);
    expect(out.map((l) => l.slug)).toEqual(['a', 'b']);
    expect(out[1].lang).toBe('ts');
    expect(out[1].how).toEqual([]);
  });
});

describe('the lab', () => {
  it('has a demo for every entry in the content (and none without one)', () => {
    const slugs = readdirSync('src/content/lab').filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, '')).sort();
    expect(Object.keys(DEMOS).sort()).toEqual(slugs);
  });
});
