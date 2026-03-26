/* ══════════════════════════════════════════════════════════════
   Endpoints centralisés — évite les URLs hardcodées partout
   ══════════════════════════════════════════════════════════════ */

const CATALOG  = 'http://localhost:18081/api'
const LOT      = 'http://localhost:18082/api'
const STOCK    = 'http://localhost:18083/api'
const ORDER    = 'http://localhost:18084/api'

export const endpoints = {
  // ── Catalog Service (18081) ──
  species:    `${CATALOG}/species`,
  varieties:  `${CATALOG}/varieties`,
  varietyById:      (id: number) => `${CATALOG}/varieties/${id}`,
  varietyStatut:    (id: number) => `${CATALOG}/varieties/${id}/statut`,
  varietyArchive:   (id: number) => `${CATALOG}/varieties/${id}/archive`,
  varietyDelete:    (id: number) => `${CATALOG}/varieties/${id}`,

  // ── Lot Service (18082) ──
  lots:       `${LOT}/lots`,
  lotById:          (id: number) => `${LOT}/lots/${id}`,
  lotChild:         (id: number) => `${LOT}/lots/${id}/child`,
  lotTransfer:      (id: number) => `${LOT}/lots/${id}/transfer`,
  generations:      `${LOT}/generations`,
  campagnes:        `${LOT}/campagnes`,
  certifications:         `${LOT}/certifications`,
  certificationById:      (id: number) => `${LOT}/certifications/${id}`,
  certificationUpload:    (id: number) => `${LOT}/certifications/${id}/upload`,
  certificationDocument:  (id: number) => `${LOT}/certifications/${id}/document`,
  controls:         `${LOT}/controls`,
  controlById:      (id: number) => `${LOT}/controls/${id}`,
  programs:         `${LOT}/programs`,
  programById:      (id: number) => `${LOT}/programs/${id}`,

  // ── Stock Service (18083) ──
  stocks:     `${STOCK}/stocks`,
  stockById:        (id: number) => `${STOCK}/stocks/${id}`,
  movements:  `${STOCK}/movements`,
  sites:      `${STOCK}/sites`,
  siteById:         (id: number) => `${STOCK}/sites/${id}`,
  transfers:  `${STOCK}/transfers`,
  transferById:     (id: number) => `${STOCK}/transfers/${id}`,

  // ── Order Service (18084) ──
  orders:     `${ORDER}/orders`,
  orderById:        (id: number) => `${ORDER}/orders/${id}`,
  orderAllocate:    `${ORDER}/orders/allocate`,
  organisations:    `${ORDER}/organisations`,
  organisationById: (id: number) => `${ORDER}/organisations/${id}`,

  // ── Swagger UI links ──
  swagger: {
    catalog: 'http://localhost:18081/swagger-ui/index.html',
    lot:     'http://localhost:18082/swagger-ui/index.html',
    stock:   'http://localhost:18083/swagger-ui/index.html',
    order:   'http://localhost:18084/swagger-ui/index.html',
  }
} as const
