import { describe, it, expect } from 'vitest'
import {
  GEN_ORDER,
  GEN_LABELS,
  GEN_COLORS,
  STATUT_LOT_LABELS,
  STATUT_LOT_COLORS,
  STATUT_COMMANDE_LABELS,
  STATUT_COMMANDE_COLORS,
  type StatutLot,
  type StatutCommande,
} from '../lib/types'

/**
 * Tests des constantes métier — vérifie la cohérence entre les enums Java
 * et leurs représentations TypeScript (labels, couleurs, ordre générationnel).
 */

describe('GEN_ORDER — ordre générationnel G0→R2', () => {
  it('contient exactement 6 générations dans le bon ordre', () => {
    expect(GEN_ORDER).toEqual(['G0', 'G1', 'G2', 'G3', 'R1', 'R2'])
  })

  it('chaque génération a un label dans GEN_LABELS', () => {
    GEN_ORDER.forEach(gen => {
      expect(GEN_LABELS[gen]).toBeDefined()
      expect(GEN_LABELS[gen].length).toBeGreaterThan(0)
    })
  })

  it('chaque génération a des couleurs dans GEN_COLORS', () => {
    GEN_ORDER.forEach(gen => {
      const color = GEN_COLORS[gen]
      expect(color).toBeDefined()
      expect(color.bg).toBeTruthy()
      expect(color.border).toBeTruthy()
      expect(color.text).toBeTruthy()
      expect(color.badge).toBeTruthy()
    })
  })
})

describe('STATUT_LOT — complétude labels et couleurs', () => {
  const statuts: StatutLot[] = [
    'DISPONIBLE', 'EN_PRODUCTION', 'CERTIFIE', 'TRANSFERE',
    'EPUISE', 'RETIRE', 'DECLASS', 'EN_COURS_CERT', 'SOUCHE', 'PERDU',
  ]

  it('tous les statuts ont un label', () => {
    statuts.forEach(s => {
      expect(STATUT_LOT_LABELS[s]).toBeDefined()
      expect(STATUT_LOT_LABELS[s].length).toBeGreaterThan(0)
    })
  })

  it('tous les statuts ont des couleurs complètes', () => {
    statuts.forEach(s => {
      const c = STATUT_LOT_COLORS[s]
      expect(c).toBeDefined()
      expect(c.bg).toMatch(/^#/)
      expect(c.border).toMatch(/^#/)
      expect(c.text).toMatch(/^#/)
    })
  })

  it('"DISPONIBLE" a un label humain correct', () => {
    expect(STATUT_LOT_LABELS['DISPONIBLE']).toBe('Disponible')
  })
})

describe('STATUT_COMMANDE — complétude labels et couleurs', () => {
  const statuts: StatutCommande[] = [
    'SOUMISE', 'ACCEPTEE', 'EN_PREPARATION', 'LIVREE', 'ANNULEE', 'REJETEE',
  ]

  it('tous les statuts commande ont un label', () => {
    statuts.forEach(s => {
      expect(STATUT_COMMANDE_LABELS[s]).toBeDefined()
    })
  })

  it('tous les statuts commande ont des couleurs', () => {
    statuts.forEach(s => {
      const c = STATUT_COMMANDE_COLORS[s]
      expect(c.bg).toMatch(/^#/)
      expect(c.border).toMatch(/^#/)
      expect(c.text).toMatch(/^#/)
    })
  })

  it('"LIVREE" a un label et une couleur verte', () => {
    expect(STATUT_COMMANDE_LABELS['LIVREE']).toBe('Livrée')
    expect(STATUT_COMMANDE_COLORS['LIVREE'].text).toBe('#166534')
  })
})
