-- ============================================================
-- V45 — Schema per Service
-- Auteur : ISRA / CNRA — Plateforme Sen Jiwu
-- Objectif :
--   Séparer les tables en schémas PostgreSQL par domaine métier.
--   Chaque service possède son propre schéma ; les tables partagées
--   vont dans « shared » ou « geo ».
--
--   Schémas créés :
--     catalog  → espece, variete et leurs historiques
--     lot      → lot_semencier, transferts, outbox (lot-service)
--     stock    → site, stock, mouvements, outbox (stock-service)
--     orders   → commande, lignes, allocations
--     shared   → organisation, membres, messagerie
--     geo      → régions, départements, zones agro
--
--   La table flyway_schema_history reste dans public.
--   Le search_path du rôle seed est mis à jour pour que toutes
--   les requêtes non qualifiées continuent de fonctionner.
--
--   IDEMPOTENCE : chaque ALTER TABLE vérifie le schéma courant.
--   La migration est sûre quelle que soit la position de départ.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. CRÉER LES SCHÉMAS (idempotent par IF NOT EXISTS)
-- ────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS lot;
CREATE SCHEMA IF NOT EXISTS stock;
CREATE SCHEMA IF NOT EXISTS orders;
CREATE SCHEMA IF NOT EXISTS shared;
CREATE SCHEMA IF NOT EXISTS geo;

-- ────────────────────────────────────────────────────────────
-- 2. DROITS — le créateur est déjà owner des schémas.
--    On s'assure que CURRENT_USER a bien tous les droits.
-- ────────────────────────────────────────────────────────────
GRANT ALL PRIVILEGES ON SCHEMA catalog TO CURRENT_USER;
GRANT ALL PRIVILEGES ON SCHEMA lot     TO CURRENT_USER;
GRANT ALL PRIVILEGES ON SCHEMA stock   TO CURRENT_USER;
GRANT ALL PRIVILEGES ON SCHEMA orders  TO CURRENT_USER;
GRANT ALL PRIVILEGES ON SCHEMA shared  TO CURRENT_USER;
GRANT ALL PRIVILEGES ON SCHEMA geo     TO CURRENT_USER;

-- ────────────────────────────────────────────────────────────
-- 3. SEARCH_PATH — résolution sans qualification pour les
--    requêtes natives existantes (StockRepo, etc.)
-- ────────────────────────────────────────────────────────────
ALTER ROLE CURRENT_USER SET search_path TO catalog, lot, stock, orders, shared, geo, public;

-- ────────────────────────────────────────────────────────────
-- 4. SUPPRIMER LA VUE DEPUIS public SI ELLE Y EST ENCORE
-- ────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_stock_agrege;

-- ────────────────────────────────────────────────────────────
-- 5. FONCTION HELPER (session locale) pour déplacement idempotent
--    Move uniquement si la table est encore dans p_from_schema.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.move_table(
    p_table       TEXT,
    p_from_schema TEXT,
    p_to_schema   TEXT
) RETURNS VOID AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE  table_schema = p_from_schema
          AND  table_name   = p_table
    ) THEN
        EXECUTE format('ALTER TABLE %I.%I SET SCHEMA %I',
                       p_from_schema, p_table, p_to_schema);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────
-- 6. DÉPLACER — schéma geo
-- ────────────────────────────────────────────────────────────
SELECT pg_temp.move_table('regions',          'public', 'geo');
SELECT pg_temp.move_table('departements',     'public', 'geo');
SELECT pg_temp.move_table('zone_agro',        'public', 'geo');
SELECT pg_temp.move_table('departement_zone', 'public', 'geo');

-- ────────────────────────────────────────────────────────────
-- 7. DÉPLACER — schéma shared
-- ────────────────────────────────────────────────────────────
SELECT pg_temp.move_table('organisation',        'public', 'shared');
SELECT pg_temp.move_table('membre_organisation', 'public', 'shared');
SELECT pg_temp.move_table('conversation',        'public', 'shared');
SELECT pg_temp.move_table('message',             'public', 'shared');

-- ────────────────────────────────────────────────────────────
-- 8. DÉPLACER — schéma catalog
-- ────────────────────────────────────────────────────────────
SELECT pg_temp.move_table('espece',             'public', 'catalog');
SELECT pg_temp.move_table('variete',            'public', 'catalog');
SELECT pg_temp.move_table('variete_historique', 'public', 'catalog');
SELECT pg_temp.move_table('variete_zone',       'public', 'catalog');
SELECT pg_temp.move_table('espece_historique',  'public', 'catalog');

-- ────────────────────────────────────────────────────────────
-- 9. DÉPLACER — schéma lot
-- ────────────────────────────────────────────────────────────
SELECT pg_temp.move_table('campagne',                 'public', 'lot');
SELECT pg_temp.move_table('generation_semence',       'public', 'lot');
SELECT pg_temp.move_table('programme_multiplication', 'public', 'lot');
SELECT pg_temp.move_table('parcelle_multiplication',  'public', 'lot');
SELECT pg_temp.move_table('rendement_production',     'public', 'lot');
SELECT pg_temp.move_table('lot_semencier',            'public', 'lot');
SELECT pg_temp.move_table('transfert_lot',            'public', 'lot');
SELECT pg_temp.move_table('controle_qualite',         'public', 'lot');
SELECT pg_temp.move_table('certification',            'public', 'lot');
SELECT pg_temp.move_table('historique_statut_lot',    'public', 'lot');
SELECT pg_temp.move_table('outbox_events',            'public', 'lot');

-- ────────────────────────────────────────────────────────────
-- 10. DÉPLACER — schéma stock
-- ────────────────────────────────────────────────────────────
SELECT pg_temp.move_table('site',            'public', 'stock');
SELECT pg_temp.move_table('stock',           'public', 'stock');
SELECT pg_temp.move_table('mouvement_stock', 'public', 'stock');
SELECT pg_temp.move_table('transfert',       'public', 'stock');

-- ────────────────────────────────────────────────────────────
-- 11. DÉPLACER — schéma orders
-- ────────────────────────────────────────────────────────────
SELECT pg_temp.move_table('commande',            'public', 'orders');
SELECT pg_temp.move_table('ligne_commande',      'public', 'orders');
SELECT pg_temp.move_table('allocation_commande', 'public', 'orders');

-- ────────────────────────────────────────────────────────────
-- 12. CRÉER stock.outbox_events POUR STOCK-SERVICE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock.outbox_events (
    id             UUID         NOT NULL DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id   VARCHAR(100) NOT NULL,
    type           VARCHAR(100) NOT NULL,
    payload        JSONB        NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed      BOOLEAN      NOT NULL DEFAULT false,
    CONSTRAINT pk_stock_outbox_events PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_stock_outbox_unprocessed
    ON stock.outbox_events (created_at)
    WHERE processed = false;

-- ────────────────────────────────────────────────────────────
-- 13. VUE stock.v_stock_agrege (CREATE OR REPLACE pour idempotence)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW stock.v_stock_agrege AS
SELECT
    ls.id_variete,
    ls.id_generation,
    s.id_site,
    si.code_site,
    si.nom_site,
    g.code_generation,
    v.nom_variete,
    v.code_variete,
    e.nom_commun                         AS nom_espece,
    e.code_espece,
    s.unite,
    SUM(s.quantite_disponible)           AS quantite_totale,
    COUNT(DISTINCT s.id)                 AS nb_lots,
    MAX(s.updated_at)                    AS derniere_maj,
    MIN(s.created_at)                    AS premiere_entree,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'idStock',   s.id,
            'idLot',     ls.id,
            'codeLot',   ls.code_lot,
            'quantite',  s.quantite_disponible,
            'unite',     s.unite,
            'statut',    ls.statut_lot,
            'campagne',  ls.campagne,
            'createdAt', TO_CHAR(s.created_at AT TIME ZONE 'UTC',
                                 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        ) ORDER BY s.created_at ASC
    )                                    AS lots_detail
FROM  stock.stock          s
JOIN  lot.lot_semencier    ls ON s.id_lot         = ls.id
JOIN  stock.site           si ON s.id_site        = si.id
JOIN  lot.generation_semence g ON ls.id_generation = g.id
JOIN  catalog.variete       v ON ls.id_variete    = v.id
JOIN  catalog.espece        e ON v.id_espece      = e.id
GROUP BY
    ls.id_variete, ls.id_generation, s.id_site,
    si.code_site, si.nom_site,
    g.code_generation,
    v.nom_variete, v.code_variete,
    e.nom_commun, e.code_espece,
    s.unite;
