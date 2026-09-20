/* ══════════════════════════════════════════════════════════════
   Endpoints centralisés — évite les URLs hardcodées partout
   Base d'URL configurée via VITE_API_BASE (variable d'environnement Vite).
   Valeur par défaut : http://localhost (dev local / Docker Desktop).
   En production, définir VITE_API_BASE=https://api.votre-domaine.sn
   ══════════════════════════════════════════════════════════════ */

const BASE     = (import.meta.env.VITE_API_BASE ?? 'http://localhost').replace(/\/$/, '')
const CATALOG  = `${BASE}:18081/api`
const LOT      = `${BASE}:18082/api`
const STOCK    = `${BASE}:18083/api`
const ORDER    = `${BASE}:18084/api`

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
  lotCertificatUpload:  (id: number) => `${LOT}/lots/${id}/certificat`,
  lotCertificatUrl:     (id: number) => `${LOT}/lots/${id}/certificat`,
  lotCertificatDelete:  (id: number) => `${LOT}/lots/${id}/certificat`,
  /** Lots G4/R1/R2 en attente de certification (UPSemCL / Admin) */
  lotsACertifier:       `${LOT}/lots/a-certifier`,
  /** Tous les lots G4/R1/R2 certifiables — vue complète (UPSemCL / Admin) */
  lotsCertifiables:     `${LOT}/lots/certifiables`,
  /** Lots G4/R1/R2 du multiplicateur connecté uniquement (isolation individuelle) */
  lotsMultCertif:       `${LOT}/lots/mes-lots-certif`,
  lotCertifier:         (id: number) => `${LOT}/lots/${id}/certifier`,
  lotRejeterCert:       (id: number) => `${LOT}/lots/${id}/rejeter-certification`,
  lotUpdate:            (id: number) => `${LOT}/lots/${id}`,
  lotDelete:            (id: number) => `${LOT}/lots/${id}`,
  lotConfirmer:         (id: number) => `${LOT}/lots/${id}/confirmer`,
  lotAudit:             (id: number) => `${LOT}/lots/${id}/audit`,

  controls:         `${LOT}/controls`,
  controlById:      (id: number) => `${LOT}/controls/${id}`,
  programs:         `${LOT}/programs`,
  programById:      (id: number) => `${LOT}/programs/${id}`,

  // ── Catalog Service — Zones agro-écologiques & géographie admin ──
  zones:                `${CATALOG}/zones`,
  maZone:               `${CATALOG}/zones/ma-zone`,
  zoneParDepartement:   (deptId: number) => `${CATALOG}/zones/par-departement/${deptId}`,
  regions:              `${CATALOG}/regions`,
  departements:         `${CATALOG}/departements`,
  departementsParRegion:(regionId: number) => `${CATALOG}/departements?regionId=${regionId}`,
  departementsParZone:  (zoneId: number)   => `${CATALOG}/departements?zoneId=${zoneId}`,
  zoneEspeces:          (id: number)        => `${CATALOG}/zones/${id}/especes`,
  varietyZones:         (id: number) => `${CATALOG}/varieties/${id}/zones`,
  varietyFicheUpload:   (id: number) => `${CATALOG}/varieties/${id}/fiche-varietale`,
  varietyFicheUrl:      (id: number) => `${CATALOG}/varieties/${id}/fiche-varietale`,
  varietyHistorique:    (id: number) => `${CATALOG}/varieties/${id}/historique`,
  especeItineraireUpload: (id: number) => `${CATALOG}/especes/${id}/itineraire-technique`,
  especeItineraireUrl:    (id: number) => `${CATALOG}/especes/${id}/itineraire-technique`,
  especeHistorique:       (id: number) => `${CATALOG}/species/${id}/historique`,

  // ── Lot Service — Multiplicateur (isolation par org) ──
  lotsStats:       `${LOT}/lots/stats`,
  lotsCatalogueG3: `${LOT}/lots/catalogue-g3`,
  lotsCatalogueG1: `${LOT}/lots/catalogue-g1`,
  lotsMesLots:     `${LOT}/lots/mes-lots`,

  // ── Alertes — badges de navigation ──
  alertsCountLots:       `${LOT}/lots/alerts/count`,
  alertsCountTransferts: `${LOT}/transferts/alerts/count`,
  alertsCountStock:      `${STOCK}/stocks/alerts/count`,
  alertsCountCommandes:  `${ORDER}/orders/alerts/count`,

  // ── Lot Service — Transferts de lots (Phase 2bis) ──
  transfertsLot:          `${LOT}/transferts`,
  transfertsRecus:        `${LOT}/transferts/recus`,
  transfertAccepter: (id: number) => `${LOT}/transferts/${id}/accepter`,
  transfertRefuser:  (id: number) => `${LOT}/transferts/${id}/refuser`,

  // ── Stock Service (18083) ──
  membresCarte: `${STOCK}/membres/carte`,
  stocks:       `${STOCK}/stocks`,
  stocksAgrege: `${STOCK}/stocks/agrege`,
  stockById:        (id: number) => `${STOCK}/stocks/${id}`,
  movements:  `${STOCK}/movements`,
  sites:      `${STOCK}/sites`,
  siteById:         (id: number) => `${STOCK}/sites/${id}`,
  /** Sites appartenant à l'org du connecté (multiplicateur / quotataire) */
  sitesMesSites:             `${STOCK}/sites/mes-sites`,
  siteMesSitesByCode:        (code: string) => `${STOCK}/sites/mes-sites/${code}`,
  siteMesSitesPrincipal:     (code: string) => `${STOCK}/sites/mes-sites/${code}/principal`,
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
  /** Valider ET livrer une commande G3 en une seule action (UPSemCL → Multiplicateur) */
  ordersValiderEtLivrer:   (id: number) => `${ORDER}/orders/${id}/valider-et-livrer`,
  /** Workflow négociation UPSemCL ↔ Multiplicateur */
  orderProposer:           (id: number) => `${ORDER}/orders/${id}/proposer`,
  orderAccepterProposition:(id: number) => `${ORDER}/orders/${id}/accepter-proposition`,
  orderRefuserProposition: (id: number) => `${ORDER}/orders/${id}/refuser-proposition`,
  orderFaireTransfert:     (id: number) => `${ORDER}/orders/${id}/faire-transfert`,
  orderAccuserReception:   (id: number) => `${ORDER}/orders/${id}/accuser-reception`,
  /** Flux G3 FIFO-DSS — nouveaux endpoints */
  orderPropositionsG3:         (id: number) => `${ORDER}/orders/${id}/propositions-g3`,
  orderDecisionMultiplicateur: (id: number) => `${ORDER}/orders/${id}/decision-multiplicateur`,
  orderConfirmerReception:     (id: number) => `${ORDER}/orders/${id}/confirmer-reception`,
  orderConfirmerEtTransferer:  (id: number) => `${ORDER}/orders/${id}/confirmer-et-transferer`,
  /** Flux R2 Catalogue — Multiplicateur → Quotataire */
  orderPropositionsR2:         (id: number) => `${ORDER}/orders/${id}/propositions-r2`,
  orderDecisionQuotataire:     (id: number) => `${ORDER}/orders/${id}/decision-quotataire`,
  /** Phase 4 — Facturation */
  orderGenererFacture:         (id: number) => `${ORDER}/orders/${id}/generer-facture`,
  orderFacture:                (id: number) => `${ORDER}/orders/${id}/facture`,
  factures:                    `${ORDER}/factures`,
  factureById:                 (id: number) => `${ORDER}/factures/${id}`,
  factureAccuserReception:     (id: number) => `${ORDER}/factures/${id}/accuser-reception`,
  orderBordereauTransfert:     (id: number) => `${ORDER}/orders/${id}/bordereau-transfert`,
  orderBordereauReception:     (id: number) => `${ORDER}/orders/${id}/bordereau-reception`,
  orderCatalogueG3:            `${ORDER}/orders/catalogue-g3`,
  orderLotsG3Fifo:             (idVariete: number) => `${ORDER}/orders/lots-g3/${idVariete}`,
  organisations:    `${ORDER}/organisations`,
  organisationById: (id: number) => `${ORDER}/organisations/${id}`,

  // Phase 1 : Membres (liaison Keycloak ↔ organisation)
  membres:                `${ORDER}/membres`,
  membreMe:               `${ORDER}/membres/me`,
  membreByUsername:  (username: string) => `${ORDER}/membres/username/${username}`,
  membresByOrg:     (orgId: number) => `${ORDER}/membres/organisation/${orgId}`,
  /** Membres filtrés par rôle Keycloak — ex. membresByRole('seed-multiplicator') */
  membresByRole:    (role: string) => `${ORDER}/membres?role=${encodeURIComponent(role)}`,
  /** Mettre à jour le téléphone et sa visibilité (public/privé) pour le connecté */
  membreMonProfil:      `${ORDER}/membres/mon-profil`,
  /** Proxy backend → Keycloak Account API (évite CORS navigateur → Keycloak) */
  membreKeycloakProfil: `${ORDER}/membres/keycloak-profil`,

  // ── Order Service — Multiplicateur ──
  stockMonStock:           `${STOCK}/stocks/mon-stock`,
  ordersMesDemandesG3:     `${ORDER}/orders/mes-demandes-g3`,

  // ── Expressions de besoins (order-service :18084) ──
  expressionBesoins:             `${ORDER}/expressions-besoins`,
  expressionBesoinsMesBesoins:   `${ORDER}/expressions-besoins/mes-besoins`,
  expressionBesoinsAgregees:     `${ORDER}/expressions-besoins/agregees`,
  expressionBesoinById:          (id: number) => `${ORDER}/expressions-besoins/${id}`,
  expressionBesoinPrendreCompte: (id: number) => `${ORDER}/expressions-besoins/${id}/prendre-en-compte`,
  expressionBesoinsAlerts:       `${ORDER}/expressions-besoins/alerts/count`,

  // ── Chat / Messagerie (order-service :18084) — Phase 6 ──
  chatConversations:  `${ORDER}/chat/conversations`,
  chatMessages:       (convId: number) => `${ORDER}/chat/conversations/${convId}/messages`,
  chatUpload:         (convId: number) => `${ORDER}/chat/conversations/${convId}/messages/upload`,
  chatUnread:         `${ORDER}/chat/unread-count`,
  chatMarkAllRead:    `${ORDER}/chat/mark-all-read`,

  // ── Swagger UI links ──
  swagger: {
    catalog: `${BASE}:18081/swagger-ui/index.html`,
    lot:     `${BASE}:18082/swagger-ui/index.html`,
    stock:   `${BASE}:18083/swagger-ui/index.html`,
    order:   `${BASE}:18084/swagger-ui/index.html`,
  },

  // ── Actuator Health (admin — publics, sans token) ──
  health: {
    catalog: `${BASE}:18081/actuator/health`,
    lot:     `${BASE}:18082/actuator/health`,
    stock:   `${BASE}:18083/actuator/health`,
    order:   `${BASE}:18084/actuator/health`,
  },
} as const
