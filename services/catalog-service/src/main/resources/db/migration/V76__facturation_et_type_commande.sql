-- V76 — Facturation + type de commande + prix dans les propositions
-- Auteur : ISRA / CNRA — Plateforme Sen Jiw

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Type de commande sur commande
--    G3_UPSEMCL_MULT   : UPSemCL → Multiplicateur (flux G3 FIFO-DSS)
--    R2_MULT_QUOTATAIRE : Multiplicateur → Quotataire (flux R2 catalogue)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE orders.commande
    ADD COLUMN IF NOT EXISTS type_commande VARCHAR(30) NOT NULL DEFAULT 'R2_MULT_QUOTATAIRE';

-- Mise à jour rétrospective : les commandes existantes avec des lignes G3 (id_generation=4)
UPDATE orders.commande c
SET type_commande = 'G3_UPSEMCL_MULT'
WHERE EXISTS (
    SELECT 1 FROM orders.ligne_commande l
    WHERE l.id_commande = c.id
      AND l.id_generation = 4
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Prix dans les propositions de lots
--    Saisi par le vendeur au moment de la proposition ; base de la facture.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE orders.proposition_ligne
    ADD COLUMN IF NOT EXISTS prix_unitaire_ht NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS taux_tva         NUMERIC(5,2) NOT NULL DEFAULT 0.00;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Facture
--    type_facture : INSTITUTIONNELLE (ISRA/UPSemCL) | MULTIPLICATEUR
--    statut       : BROUILLON → EMISE → ACQUITTEE | CONTESTEE | ANNULEE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders.facture (
    id               BIGSERIAL     PRIMARY KEY,
    id_commande      BIGINT        NOT NULL REFERENCES orders.commande(id),
    numero_facture   VARCHAR(60)   NOT NULL UNIQUE,
    type_facture     VARCHAR(30)   NOT NULL DEFAULT 'MULTIPLICATEUR',
    date_emission    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    statut           VARCHAR(20)   NOT NULL DEFAULT 'EMISE',
    montant_ht       NUMERIC(14,2) NOT NULL DEFAULT 0,
    montant_tva      NUMERIC(14,2) NOT NULL DEFAULT 0,
    montant_ttc      NUMERIC(14,2) NOT NULL DEFAULT 0,
    username_emetteur VARCHAR(150),
    observations     TEXT,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_facture_commande UNIQUE (id_commande)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Lignes de facture (une par lot transféré)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders.facture_ligne (
    id               BIGSERIAL     PRIMARY KEY,
    id_facture       BIGINT        NOT NULL REFERENCES orders.facture(id) ON DELETE CASCADE,
    id_lot           BIGINT,
    code_lot         VARCHAR(80),
    nom_variete      VARCHAR(200),
    code_variete     VARCHAR(50),
    generation       VARCHAR(10),
    campagne         VARCHAR(20),
    quantite         NUMERIC(14,2) NOT NULL,
    unite            VARCHAR(10)   NOT NULL DEFAULT 'kg',
    prix_unitaire_ht NUMERIC(12,2) NOT NULL,
    taux_tva         NUMERIC(5,2)  NOT NULL DEFAULT 0.00,
    montant_ht       NUMERIC(14,2) NOT NULL,
    montant_ttc      NUMERIC(14,2) NOT NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Accusé de réception de facture (signé par l'acheteur)
--    statut : RECU | CONTESTE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders.accuse_reception_facture (
    id                 BIGSERIAL    PRIMARY KEY,
    id_facture         BIGINT       NOT NULL REFERENCES orders.facture(id) ON DELETE CASCADE,
    date_accusee       TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    username_acheteur  VARCHAR(150) NOT NULL,
    statut             VARCHAR(20)  NOT NULL DEFAULT 'RECU',
    observations       TEXT,
    CONSTRAINT uq_arf_facture UNIQUE (id_facture)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Index utiles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_facture_commande    ON orders.facture(id_commande);
CREATE INDEX IF NOT EXISTS idx_facture_statut      ON orders.facture(statut);
CREATE INDEX IF NOT EXISTS idx_facture_emetteur    ON orders.facture(username_emetteur);
CREATE INDEX IF NOT EXISTS idx_facture_ligne_fact  ON orders.facture_ligne(id_facture);
CREATE INDEX IF NOT EXISTS idx_arf_facture         ON orders.accuse_reception_facture(id_facture);
CREATE INDEX IF NOT EXISTS idx_commande_type       ON orders.commande(type_commande);
