-- ============================================================
-- 02_sync_live_schema.sql — Migration corrective DB live
-- À exécuter UNE SEULE FOIS sur la base PostgreSQL en production.
-- Synchronise le schéma live avec les entités Java et 01_schema.sql.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. lot_semencier — colonnes dénormalisées et workflows manquants
-- ────────────────────────────────────────────────────────────

ALTER TABLE lot_semencier
  ADD COLUMN IF NOT EXISTS campagne             VARCHAR(50),
  ADD COLUMN IF NOT EXISTS code_espece          VARCHAR(30),
  ADD COLUMN IF NOT EXISTS nom_variete          VARCHAR(200),
  ADD COLUMN IF NOT EXISTS code_variete         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS superficie_ha        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS production_brute_kg  NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS rendement_kg_ha      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cycle                VARCHAR(1),
  ADD COLUMN IF NOT EXISTS niveau_semence       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS quantite_semence_src_kg NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS certificat_path      VARCHAR(500),
  ADD COLUMN IF NOT EXISTS statut_certification VARCHAR(20) NOT NULL DEFAULT 'SANS_CERTIFICAT',
  ADD COLUMN IF NOT EXISTS approbateur_username VARCHAR(150),
  ADD COLUMN IF NOT EXISTS date_approbation     TIMESTAMP,
  ADD COLUMN IF NOT EXISTS motif_rejet_cert     TEXT,
  ADD COLUMN IF NOT EXISTS statut_edition       VARCHAR(20) NOT NULL DEFAULT 'BROUILLON',
  ADD COLUMN IF NOT EXISTS date_confirmation    TIMESTAMP;

-- ────────────────────────────────────────────────────────────
-- 2. lot_semencier — élargir CHECK statut_lot (4 valeurs manquantes)
-- ────────────────────────────────────────────────────────────

ALTER TABLE lot_semencier
  DROP CONSTRAINT IF EXISTS lot_semencier_statut_lot_check;

ALTER TABLE lot_semencier
  ADD CONSTRAINT lot_semencier_statut_lot_check
  CHECK (statut_lot IN ('DISPONIBLE','EN_PRODUCTION','CERTIFIE',
                        'TRANSFERE','EPUISE','RETIRE',
                        'DECLASS','EN_COURS_CERT','SOUCHE','PERDU'));

-- ────────────────────────────────────────────────────────────
-- 3. commande — élargir CHECK statut (TRANSFERE + RECEPTIONNEE)
-- ────────────────────────────────────────────────────────────

ALTER TABLE commande
  DROP CONSTRAINT IF EXISTS commande_statut_check;

ALTER TABLE commande
  ADD CONSTRAINT commande_statut_check
  CHECK (statut IN ('SOUMISE','ACCEPTEE','EN_PREPARATION',
                    'LIVREE','ANNULEE','REJETEE',
                    'EN_NEGOCIATION','ACCORDEE','EN_LIVRAISON',
                    'TRANSFERE','RECEPTIONNEE'));

COMMIT;
