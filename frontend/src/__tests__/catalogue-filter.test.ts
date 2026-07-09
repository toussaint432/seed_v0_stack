import { describe, it, expect } from 'vitest'

/**
 * Tests de la logique de filtrage du catalogue public.
 *
 * La logique de filtrage est extraite ici sous forme de fonction pure
 * afin d'être testable indépendamment du composant React (useMemo).
 * Ces tests vérifient les règles métier de recherche par nom, code variété
 * et espèce — identiques à celles de CataloguePublic.tsx.
 */

// ── Type minimal pour le test ──────────────────────────────────────────────
interface CatalogueItem {
  nomVariete: string
  codeVariete: string
  nomEspece: string
  quantiteDisponible: number
  organisationId?: number
}

// ── Fonction pure extraite de CataloguePublic.tsx (useMemo catalogueForMap) ─
function filtrerCatalogue(items: CatalogueItem[], search: string): CatalogueItem[] {
  const s = search.trim().toLowerCase()
  if (!s) return items
  return items.filter(item =>
    item.nomVariete.toLowerCase().includes(s) ||
    item.codeVariete.toLowerCase().includes(s) ||
    item.nomEspece.toLowerCase().includes(s)
  )
}

// ── Fixtures ───────────────────────────────────────────────────────────────
const CATALOGUE: CatalogueItem[] = [
  { nomVariete: 'Souna III', codeVariete: 'MIL-001', nomEspece: 'Mil', quantiteDisponible: 500 },
  { nomVariete: 'Gadiaba', codeVariete: 'MIL-002', nomEspece: 'Mil', quantiteDisponible: 300 },
  { nomVariete: 'Mouride', codeVariete: 'ARA-001', nomEspece: 'Arachide', quantiteDisponible: 200 },
  { nomVariete: 'Fleur 11', codeVariete: 'ARA-002', nomEspece: 'Arachide', quantiteDisponible: 150 },
  { nomVariete: 'Rosso', codeVariete: 'RIZ-001', nomEspece: 'Riz', quantiteDisponible: 100 },
]

describe('filtrerCatalogue — recherche textuelle', () => {
  it('retourne tout si la recherche est vide', () => {
    expect(filtrerCatalogue(CATALOGUE, '')).toHaveLength(5)
    expect(filtrerCatalogue(CATALOGUE, '   ')).toHaveLength(5)
  })

  it('filtre par nom de variété (insensible à la casse)', () => {
    const res = filtrerCatalogue(CATALOGUE, 'souna')
    expect(res).toHaveLength(1)
    expect(res[0].nomVariete).toBe('Souna III')
  })

  it('filtre par code variété', () => {
    const res = filtrerCatalogue(CATALOGUE, 'ARA-001')
    expect(res).toHaveLength(1)
    expect(res[0].nomVariete).toBe('Mouride')
  })

  it('filtre par espèce — retourne toutes les variétés correspondantes', () => {
    const res = filtrerCatalogue(CATALOGUE, 'arachide')
    expect(res).toHaveLength(2)
    expect(res.map(r => r.nomVariete)).toContain('Mouride')
    expect(res.map(r => r.nomVariete)).toContain('Fleur 11')
  })

  it('filtre par préfixe de code (ex: MIL)', () => {
    const res = filtrerCatalogue(CATALOGUE, 'mil')
    // "mil" matche nomEspece "Mil" ET codeVariete "MIL-001/MIL-002"
    expect(res.length).toBeGreaterThanOrEqual(2)
  })

  it('retourne un tableau vide si aucune correspondance', () => {
    const res = filtrerCatalogue(CATALOGUE, 'sorgho')
    expect(res).toHaveLength(0)
  })

  it('la recherche "11" matche la variété "Fleur 11"', () => {
    const res = filtrerCatalogue(CATALOGUE, '11')
    expect(res.some(r => r.nomVariete === 'Fleur 11')).toBe(true)
  })
})

describe('filtrerCatalogue — cas limites', () => {
  it('fonctionne sur un catalogue vide', () => {
    expect(filtrerCatalogue([], 'mil')).toHaveLength(0)
  })

  it('la recherche avec espaces est trimée', () => {
    const res = filtrerCatalogue(CATALOGUE, '  riz  ')
    expect(res).toHaveLength(1)
    expect(res[0].nomEspece).toBe('Riz')
  })
})
