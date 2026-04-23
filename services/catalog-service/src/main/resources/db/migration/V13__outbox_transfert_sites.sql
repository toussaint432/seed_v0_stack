-- ═══════════════════════════════════════════════════════════════════════
-- V13 — Transactional Outbox Pattern + codes site sur le transfert stock
-- ═══════════════════════════════════════════════════════════════════════
-- Auteur : ISRA/CNRA Seed Platform
-- Objectif :
--   1. Ajouter les colonnes code_site_source / code_site_destination sur la
--      table transfert (stock-service) pour pouvoir identifier les sites
--      physiques à débiter/créditer lors de l'acceptation d'un transfert.
--   2. Créer la table outbox_events partagée (Transactional Outbox Pattern).
--      Les deux services (lot-service, stock-service) écrivent dans cette
--      table dans la même transaction que leur mise à jour métier.
--      Un OutboxRelay @Scheduled publie ensuite les événements vers Kafka
--      de façon asynchrone et durable.

-- ── 1. Colonnes site sur le transfert stock ──────────────────────────────
ALTER TABLE transfert
    ADD COLUMN IF NOT EXISTS code_site_source      VARCHAR(50),
    ADD COLUMN IF NOT EXISTS code_site_destination VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_trf_site_src
    ON transfert(code_site_source)
    WHERE code_site_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trf_site_dest
    ON transfert(code_site_destination)
    WHERE code_site_destination IS NOT NULL;

-- ── 2. Transactional Outbox ───────────────────────────────────────────────
-- Toutes les colonnes sont NOT NULL sauf processed qui a un défaut FALSE.
-- Le payload est stocké en JSONB pour bénéficier de l'indexation et de
-- la validation de structure côté PostgreSQL.
CREATE TABLE IF NOT EXISTS outbox_events (
    id             UUID         NOT NULL DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(100) NOT NULL,   -- ex : "TransfertLot", "Transfert"
    aggregate_id   VARCHAR(100) NOT NULL,   -- PK de l'agrégat source
    type           VARCHAR(100) NOT NULL,   -- ex : "LOT_TRANSFER_ACCEPTE"
    payload        JSONB        NOT NULL,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed      BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_outbox_events PRIMARY KEY (id)
);

-- Index partiel : le relay ne lit QUE les lignes non traitées, triées par
-- date de création. Avec processed=FALSE sur < 1 % des lignes en régime
-- normal, l'index est quasi-gratuit en lecture.
CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed
    ON outbox_events(created_at)
    WHERE processed = FALSE;
