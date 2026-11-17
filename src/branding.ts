/**
 * KAIROSWEB branding constants and flyer template presets.
 * KAIROSWEB turns any uploaded flyer into a fully editable layered design.
 */

export const BRAND = {
  name: 'KAIROSWEB',
  tagline: 'Upload any flyer. Edit everything. Export anywhere.',
  version: '2.0.0',
} as const;

export const ACCENT = '#e5484d';

export interface FlyerTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  bg: string;
  group: string;
}

export const FLYER_TEMPLATES: FlyerTemplate[] = [
  { id: 'a4', name: 'A4 flyer', width: 2480, height: 3508, bg: '#ffffff', group: 'Print' },
  { id: 'a5', name: 'A5 flyer', width: 1748, height: 2480, bg: '#ffffff', group: 'Print' },
  { id: 'letter', name: 'US Letter', width: 2550, height: 3300, bg: '#ffffff', group: 'Print' },
  { id: 'half-letter', name: 'Half Letter', width: 1650, height: 1275, bg: '#ffffff', group: 'Print' },
  { id: 'square-social', name: 'Square post', width: 1080, height: 1080, bg: '#101014', group: 'Social' },
  { id: 'story-social', name: 'Story 9x16', width: 1080, height: 1920, bg: '#101014', group: 'Social' },
  { id: 'custom', name: 'Custom size', width: 1240, height: 1754, bg: '#ffffff', group: 'Custom' },
];
