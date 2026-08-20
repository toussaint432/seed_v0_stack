/* ── Design tokens partagés ─────────────────────────────────────────────── */

const brand = {
  green:    '#00693e',
  greenSoft:'#e8f1ec',
  terra:    '#c44536',
} as const

const fonts = {
  display: 'var(--font-sans)',
  body:    'var(--font-sans)',
  mono:    'var(--font-mono)',
} as const

/* ── Landing page ── palette chaude/éditoriale ── */
export const TL = {
  ...brand,
  ...fonts,
  greenDeep:   '#00393d',
  greenBright: '#01b400',
  greenLeaf:   '#048a14',
  gold:        '#e8b04b',
  goldDeep:    '#c08a2a',
  ink:         '#131814',
  paper:       '#fafaf7',
  paper2:      '#f3f1ea',
  line:        '#e2dfd3',
  muted:       '#6e6f6a',
} as const

/* ── Application (Dashboard…) ── palette neutre/data ── */
export const TD = {
  ...brand,
  ...fonts,
  greenDeep:  '#003d24',
  blue:       '#1d4ed8',
  blueLight:  '#eff6ff',
  blueBorder: '#bfdbfe',
  ink:        '#111827',
  paper:      '#fafafa',
  paper2:     '#f8fafc',
  line:       '#e5e7eb',
  muted:      '#6b7280',
} as const
