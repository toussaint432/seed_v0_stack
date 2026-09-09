-- V75 — Flux G3 FIFO-DSS : proposition par ligne, décision multiplicateur, réception
-- Auteur : ISRA / CNRA — Plateforme Sen Jiw

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enrichissement de ligne_commande
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE orders.ligne_commande
    ADD COLUMN IF NOT EXISTS statut_ligne VARCHAR(20) NOT NULL DEFAULT 'SOUMISE';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Piste d'audit FIFO-DSS : proposition par ligne
--    Une proposition par ligne_commande ; unique pour garantir cohérence.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders.proposition_ligne (
    id                     BIGSERIAL    PRIMARY KEY,
    id_ligne_commande      BIGINT       NOT NULL REFERENCES orders.ligne_commande(id),
    id_lot_suggere_fifo    BIGINT,                          -- lot proposé par FIFO (null si indisponible)
    quantite_suggere       NUMERIC(14,2),
    id_lot_selectionne     BIGINT       NOT NULL,            -- choix final de l'agent UPSemCL
    quantite_selectionnee  NUMERIC(14,2) NOT NULL,
    motif_override         TEXT,                             -- obligatoire si différent du lot FIFO
    username_agent         VARCHAR(150),
    statut_proposition     VARCHAR(20)  NOT NULL DEFAULT 'PROPOSEE',
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_prop_ligne UNIQUE (id_ligne_commande)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Sources multi-lots par proposition (trace complète de l'allocation FIFO)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders.proposition_lot_source (
    id                    BIGSERIAL    PRIMARY KEY,
    id_proposition_ligne  BIGINT       NOT NULL REFERENCES orders.proposition_ligne(id),
    id_lot                BIGINT       NOT NULL,
    quantite              NUMERIC(14,2) NOT NULL,
    fifo_suggere          BOOLEAN      NOT NULL DEFAULT true,
    ordre_priorite        INTEGER      NOT NULL DEFAULT 1
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Confirmation de réception par le multiplicateur (bordereau BR)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders.reception_commande (
    id                  BIGSERIAL    PRIMARY KEY,
    id_commande         BIGINT       NOT NULL REFERENCES orders.commande(id),
    username_recepteur  VARCHAR(150),
    date_reception      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    statut_reception    VARCHAR(20)  NOT NULL DEFAULT 'COMPLET',   -- COMPLET / AVEC_ECART
    observations        TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reception_commande UNIQUE (id_commande)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Écarts de réception par lot (quantité transférée vs reçue)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders.reception_ecart (
    id                    BIGSERIAL    PRIMARY KEY,
    id_reception_commande BIGINT       NOT NULL REFERENCES orders.reception_commande(id),
    id_lot_source         BIGINT       NOT NULL,
    quantite_transferee   NUMERIC(14,2) NOT NULL,
    quantite_recue        NUMERIC(14,2) NOT NULL,
    observations          TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Index
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prop_ligne_ligne    ON orders.proposition_ligne(id_ligne_commande);
CREATE INDEX IF NOT EXISTS idx_prop_lot_src_prop   ON orders.proposition_lot_source(id_proposition_ligne);
CREATE INDEX IF NOT EXISTS idx_reception_commande  ON orders.reception_commande(id_commande);
CREATE INDEX IF NOT EXISTS idx_reception_ecart_rec ON orders.reception_ecart(id_reception_commande);
