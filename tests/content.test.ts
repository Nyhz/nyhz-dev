// tests/content.test.ts
import { describe, it, expect } from 'vitest';
import { mapProfile, mapProjects } from '../src/scripts/content';

describe('mapProfile', () => {
  it('maps a full profile', () => {
    const out = mapProfile({
      name: 'nyhz', role: 'dev', location: 'earth',
      socials: [{ label: 'github', url: 'https://x' }],
    });
    expect(out).toEqual({
      name: 'nyhz', role: 'dev', location: 'earth',
      socials: [{ label: 'github', url: 'https://x' }],
    });
  });
  it('applies fallbacks for missing/invalid fields', () => {
    const out = mapProfile({});
    expect(out.name).toBe('');
    expect(out.role).toBe('');
    expect(out.location).toBe('');
    expect(out.socials).toEqual([]);
  });
});

describe('mapProjects', () => {
  it('maps and sorts by order ascending', () => {
    const out = mapProjects([
      { slug: 'b', entry: { title: 'B', description: 'd', tags: ['t'], repoUrl: 'u', order: 2 } },
      { slug: 'a', entry: { title: 'A', description: 'd', tags: [], repoUrl: 'u', order: 1 } },
    ]);
    expect(out.map((p) => p.slug)).toEqual(['a', 'b']);
  });
  it('defaults order to 0 and tags to []', () => {
    const out = mapProjects([{ slug: 'a', entry: { title: 'A', description: 'd', repoUrl: 'u' } }]);
    expect(out[0].order).toBe(0);
    expect(out[0].tags).toEqual([]);
  });
});
