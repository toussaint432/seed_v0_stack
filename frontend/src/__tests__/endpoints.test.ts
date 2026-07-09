import { describe, it, expect, beforeAll } from 'vitest'

/**
 * Tests des endpoints API — vérifie que les URLs générées sont correctes
 * et cohérentes avec les ports exposés par les micro-services.
 */

// Simuler VITE_API_BASE absent → comportement par défaut localhost
beforeAll(() => {
  // import.meta.env est géré par Vitest nativement (défaut = {})
})

// Import dynamique pour isoler l'effet de import.meta.env
const getEndpoints = async () => {
  const mod = await import('../lib/endpoints')
  return mod.endpoints
}

describe('endpoints — structure et URLs', () => {
  it('catalogue pointe vers le stock-service (port 18083)', async () => {
    const ep = await getEndpoints()
    expect(ep.catalogue).toContain('18083')
    expect(ep.catalogue).toContain('/stocks/catalogue')
  })

  it('catalogueProximite pointe vers /proximite', async () => {
    const ep = await getEndpoints()
    expect(ep.catalogueProximite).toContain('/stocks/catalogue/proximite')
  })

  it('varietyById(42) génère une URL avec l\'id correct', async () => {
    const ep = await getEndpoints()
    const url = ep.varietyById(42)
    expect(url).toContain('/42')
    expect(url).toContain('18081')
  })

  it('orderStatut(7) génère /api/orders/7/statut', async () => {
    const ep = await getEndpoints()
    const url = ep.orderStatut(7)
    expect(url).toContain('/orders/7/statut')
    expect(url).toContain('18084')
  })

  it('lotChild(5) génère /api/lots/5/child', async () => {
    const ep = await getEndpoints()
    const url = ep.lotChild(5)
    expect(url).toContain('/lots/5/child')
    expect(url).toContain('18082')
  })

  it('tous les services utilisent des ports distincts', async () => {
    const ep = await getEndpoints()
    const ports = new Set([
      ep.species.match(/:(\d+)\//)?.[1],
      ep.lots.match(/:(\d+)\//)?.[1],
      ep.stocks.match(/:(\d+)\//)?.[1],
      ep.orders.match(/:(\d+)\//)?.[1],
    ])
    // 4 services = 4 ports distincts
    expect(ports.size).toBe(4)
  })
})
