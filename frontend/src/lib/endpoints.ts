/* ══════════════════════════════════════════════════════════════
   Endpoints centralisés — évite les URLs hardcodées partout
   V1.5 — Phase 2 : zones agro-écologiques + catalogue quotataire
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
  lotLineage:       (id: number) => `${LOT}/lots/${id}/lineage`,
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

  // ── Catalog Service — Zones agro-écologiques (Phase 2) ──
  zones:            `${CATALOG}/zones`,
  varietyZones:     (id: number) => `${CATALOG}/varieties/${id}/zones`,

  // ── Lot Service — Multiplicateur (isolation par org) ──
  lotsCatalogueG3: `${LOT}/lots/catalogue-g3`,
  lotsMesLots:     `${LOT}/lots/mes-lots`,

  // ── Lot Service — Transferts de lots (Phase 2bis) ──
  transfertsLot:          `${LOT}/transferts`,
  transfertsRecus:        `${LOT}/transferts/recus`,
  transfertAccepter: (id: number) => `${LOT}/transferts/${id}/accepter`,
  transfertRefuser:  (id: number) => `${LOT}/transferts/${id}/refuser`,

  // ── Stock Service (18083) ──
  stocks:     `${STOCK}/stocks`,
  stockById:        (id: number) => `${STOCK}/stocks/${id}`,
  movements:  `${STOCK}/movements`,
  sites:      `${STOCK}/sites`,
  siteById:         (id: number) => `${STOCK}/sites/${id}`,
  transfers:  `${STOCK}/transfers`,
  transferById:     (id: number) => `${STOCK}/transfers/${id}`,
  catalogue:        `${STOCK}/stocks/catalogue`,
  catalogueProximite: `${STOCK}/stocks/catalogue/proximite`,

  // ── Order Service (18084) ──
  orders:              `${ORDER}/orders`,
  orderById:           (id: number) => `${ORDER}/orders/${id}`,
  orderAllocate:       `${ORDER}/orders/allocate`,
  ordersMesCommandes:  `${ORDER}/orders/mes-commandes`,
  ordersATraiter:      `${ORDER}/orders/a-traiter`,
  orderStatut:         (id: number) => `${ORDER}/orders/${id}/statut`,
  organisations:    `${ORDER}/organisations`,
  organisationById: (id: number) => `${ORDER}/organisations/${id}`,

  // Phase 1 : Membres (liaison Keycloak ↔ organisation)
  membres:                `${ORDER}/membres`,
  membreMe:               `${ORDER}/membres/me`,
  membreByUsername:  (username: string) => `${ORDER}/membres/username/${username}`,
  membresByOrg:     (orgId: number) => `${ORDER}/membres/organisation/${orgId}`,

  // ── Order Service — Multiplicateur ──
  stockMonStock:           `${STOCK}/stocks/mon-stock`,
  ordersMesDemandesG3:     `${ORDER}/orders/mes-demandes-g3`,

  // ── Chat / Messagerie (order-service :18084) — Phase 6 ──
  chatConversations:  `${ORDER}/chat/conversations`,
  chatMessages:       (convId: number) => `${ORDER}/chat/conversations/${convId}/messages`,
  chatUpload:         (convId: number) => `${ORDER}/chat/conversations/${convId}/messages/upload`,
  chatUnread:         `${ORDER}/chat/unread-count`,

  // ── Swagger UI links ──
  swagger: {
    catalog: 'http://localhost:18081/swagger-ui/index.html',
    lot:     'http://localhost:18082/swagger-ui/index.html',
    stock:   'http://localhost:18083/swagger-ui/index.html',
    order:   'http://localhost:18084/swagger-ui/index.html',
  }
} as const
