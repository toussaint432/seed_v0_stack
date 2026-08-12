import type { StatutLot } from './types'

// ── Générations semencières — couleurs UI ──────────────────────────────────

export const GEN_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  G0: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', badge: 'badge-blue' },
  G1: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', badge: 'badge-green' },
  G2: { bg: '#fef9ed', border: '#fde68a', text: '#92660a', badge: 'badge-gold' },
  G3: { bg: '#faf5ff', border: '#e9d5ff', text: '#6d28d9', badge: 'badge-violet' },
  G4: { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', badge: 'badge-orange' },
  R1: { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e', badge: 'badge-teal' },
  R2: { bg: '#dcfce7', border: '#86efac', text: '#15803d', badge: 'badge-green' },
}

// Couleurs hexadécimales pour graphiques/cartes (Recharts, Leaflet, etc.)
export const GEN_CHART_COLORS: Record<string, string> = {
  G0: '#6366f1',
  G1: '#0ea5e9',
  G2: '#22c55e',
  G3: '#f59e0b',
  G4: '#c2410c',
  R1: '#ec4899',
  R2: '#14b8a6',
}

// ── Rôles Keycloak — libellés courts (tableaux, badges UI) ────────────────

export const ROLE_LABELS: Record<string, string> = {
  'seed-selector':      'Sélectionneur ISRA',
  'seed-upsemcl':       'UPSem-CL',
  'seed-multiplicator': 'Multiplicateur',
  'seed-quotataire':    'Quotataire / OP',
  'seed-admin':         'Administrateur ISRA',
}

// Libellés complets (documents PDF, factures, rapports officiels)
export const ROLE_LABELS_LONG: Record<string, string> = {
  'seed-selector':      'Sélectionneur ISRA/CNRA',
  'seed-upsemcl':       'Unité de Production UPSemCL',
  'seed-multiplicator': 'Multiplicateur Agréé',
  'seed-quotataire':    'Distributeur / Quotataire',
  'seed-admin':         'Administrateur',
}

// ── Statuts lot — couleurs et libellés ────────────────────────────────────

export const STATUT_LOT_COLORS: Record<StatutLot, { bg: string; border: string; text: string }> = {
  DISPONIBLE:    { bg: '#dcfce7', border: '#86efac', text: '#15803d' },
  EN_PRODUCTION: { bg: '#fef3c7', border: '#fde68a', text: '#92660a' },
  CERTIFIE:      { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  TRANSFERE:     { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  EPUISE:        { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280' },
  RETIRE:        { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  DECLASS:       { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  EN_COURS_CERT: { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' },
  SOUCHE:        { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
  PERDU:         { bg: '#fdf2f8', border: '#f9a8d4', text: '#9d174d' },
}

export const STATUT_LOT_LABELS: Record<StatutLot, string> = {
  DISPONIBLE:    'Disponible',
  EN_PRODUCTION: 'En production',
  CERTIFIE:      'Certifié',
  TRANSFERE:     'Transféré',
  EPUISE:        'Épuisé',
  RETIRE:        'Retiré',
  DECLASS:       'Déclassé',
  EN_COURS_CERT: 'En cours de certification',
  SOUCHE:        'Souche',
  PERDU:         'Perdu',
}
