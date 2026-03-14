/**
 * footer.js — all footer content lives here.
 *
 * Edit this file to update links, text, or sections.
 * No other file needs to change.
 */

export const FOOTER_CONFIG = {

  // ── Brand ─────────────────────────────────────────────────────
  brand: {
    name:    'SagaVue',
    tagline: 'Adaptation Navigator',
    origin:  'Made in Europe 🇪🇺',
    year:    2026,                     // founding year — © ranges up to current year automatically
  },

  // ── Navigation columns ────────────────────────────────────────
  columns: [
    {
      heading: 'Project',
      links: [
        { label: 'GitHub',         href: 'https://github.com/miiiqke/SagaVue', external: true },
      ],
    },
    {
      heading: 'Legal',
      links: [
        { label: 'MIT License',       href: 'https://github.com/miiiqke/SagaVue/blob/main/LICENSE', external: true },
        { label: 'Privacy',           href: '/privacy', },
      ],
    },
    {
      heading: 'Contact',
      links: [
        { label: 'Report a bug',      href: 'https://github.com/miiiqke/SagaVue/issues', external: true },
        { label: 'Suggest a series',  href: 'https://github.com/miiiqke/SagaVue/issues', external: true },
      ],
    },
  ],

  // ── Bottom bar note (optional) ────────────────────────────────
  disclaimer: 'Series titles, characters, and story content are property of their respective authors and publishers. SagaVue is an independent fan resource and is not affiliated with any publisher or streaming service.',
};
