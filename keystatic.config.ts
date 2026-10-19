import { config, fields, singleton, collection } from '@keystatic/core';

export default config({
  storage: { kind: 'local' },
  singletons: {
    profile: singleton({
      label: 'Profile',
      path: 'src/content/profile',
      format: { data: 'yaml' },
      schema: {
        name: fields.text({ label: 'Name' }),
        role: fields.text({ label: 'Role' }),
        tagline: fields.text({ label: 'Tagline', description: 'One line under the name.' }),
        location: fields.text({ label: 'Location' }),
        socials: fields.array(
          fields.object({
            label: fields.text({ label: 'Label' }),
            url: fields.url({ label: 'URL' }),
          }),
          { label: 'Socials', itemLabel: (p) => p.fields.label.value },
        ),
      },
    }),
  },
  collections: {
    projects: collection({
      label: 'Projects',
      slugField: 'title',
      path: 'src/content/projects/*',
      format: { data: 'yaml' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({ label: 'Description', multiline: true }),
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Tags', itemLabel: (p) => p.value,
        }),
        repoUrl: fields.url({ label: 'GitHub URL' }),
        deployUrl: fields.url({ label: 'Live / deploy URL' }),
        downloadUrl: fields.url({ label: 'Download URL' }),
        coverUrl: fields.text({ label: 'Cover image URL or /public path' }),
        year: fields.text({ label: 'Year (e.g. 2026)' }),
        role: fields.text({ label: 'Role (e.g. solo · design + code) — optional' }),
        status: fields.select({
          label: 'Status',
          description: 'Leave on auto to derive it from the links (live / download / personal).',
          options: [{ label: 'auto (from the links)', value: '' }, { label: 'in progress', value: 'in progress' }],
          defaultValue: '',
        }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
      },
    }),
    skills: collection({
      label: 'Skills',
      slugField: 'title',
      path: 'src/content/skills/*',
      format: { data: 'yaml' },
      schema: {
        title: fields.slug({ name: { label: 'Category' } }),
        items: fields.array(fields.text({ label: 'Item' }), {
          label: 'Items', itemLabel: (p) => p.value,
        }),
        level: fields.integer({ label: 'Level (0–100)', defaultValue: 80 }),
        order: fields.integer({ label: 'Order', defaultValue: 0 }),
      },
    }),
  },
});
