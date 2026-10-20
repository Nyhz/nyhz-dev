// src/scripts/content.ts
import { createReader } from '@keystatic/core/reader';
import keystaticConfig from '../../keystatic.config';

export type ProfileProps = {
  name: string; role: string; tagline: string; location: string;
  socials: { label: string; url: string }[];
};
export type ProjectProps = {
  slug: string; title: string; description: string;
  tags: string[]; repoUrl: string; deployUrl: string; downloadUrl: string; coverUrl: string; order: number;
  year: string; role: string;
  status: string; // optional override of statusOf's guess, e.g. 'in progress'
};
export type SkillProps = {
  slug: string; title: string; items: string[]; level: number; order: number;
};

/** how a project ships: a live deploy, a download, or just the repo */
export const statusOf = (p: { deployUrl: string; downloadUrl: string; status?: string }) =>
  (p.status || (p.deployUrl ? 'live' : p.downloadUrl ? 'download' : 'personal'));

/** reading time at ~220 words a minute, code included (the lab's posts) */
export const minutesToRead = (text: string) => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 220));

/** a lab post's section (an h2): its anchor, its number when the heading has one ("3. Same seed" → "03"), and its name */
export type Section = { id: string; n: string; text: string };
export function section(id: string, heading: string): Section {
  const m = heading.match(/^(\d+)\.\s+(.*)$/);
  return m ? { id, n: m[1].padStart(2, '0'), text: m[2] } : { id, n: '', text: heading };
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function mapProfile(raw: any): ProfileProps {
  return {
    name: str(raw?.name),
    role: str(raw?.role),
    tagline: str(raw?.tagline),
    location: str(raw?.location),
    socials: arr<any>(raw?.socials).map((s) => ({ label: str(s?.label), url: str(s?.url) })),
  };
}

export function mapProjects(items: { slug: string; entry: any }[]): ProjectProps[] {
  return items
    .map(({ slug, entry }) => ({
      slug,
      title: str(entry?.title),
      description: str(entry?.description),
      tags: arr<string>(entry?.tags).map(str),
      repoUrl: str(entry?.repoUrl),
      deployUrl: str(entry?.deployUrl),
      downloadUrl: str(entry?.downloadUrl),
      coverUrl: str(entry?.coverUrl),
      order: num(entry?.order),
      year: str(entry?.year),
      role: str(entry?.role),
      status: str(entry?.status),
    }))
    .sort((a, b) => a.order - b.order);
}

export function mapSkills(items: { slug: string; entry: any }[]): SkillProps[] {
  return items
    .map(({ slug, entry }) => ({
      slug,
      title: str(entry?.title),
      items: arr<string>(entry?.items).map(str),
      level: typeof entry?.level === 'number' ? entry.level : 80,
      order: num(entry?.order),
    }))
    .sort((a, b) => a.order - b.order);
}

export async function getContent(): Promise<{
  profile: ProfileProps; projects: ProjectProps[]; skills: SkillProps[];
}> {
  const reader = createReader(process.cwd(), keystaticConfig);
  const profileRaw = await reader.singletons.profile.read();
  const projectRaw = await reader.collections.projects.all();
  const skillRaw = await reader.collections.skills.all();
  return {
    profile: mapProfile(profileRaw),
    projects: mapProjects(projectRaw.map((p) => ({ slug: p.slug, entry: p.entry }))),
    skills: mapSkills(skillRaw.map((p) => ({ slug: p.slug, entry: p.entry }))),
  };
}
