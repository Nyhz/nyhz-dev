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
        coverUrl: fields.text({ label: 'Cover image URL or /public path' }),
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
