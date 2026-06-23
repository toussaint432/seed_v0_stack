-- ============================================================
-- V23 — Corrections qualité et audit
-- Auteur : ISRA / CNRA — Plateforme Sen Jiw
-- Objectif :
--   1. Normaliser toutes les colonnes temporelles en TIMESTAMPTZ
--      (cohérence avec stock.created_at ajouté en V21)
--   2. Ajouter created_at manquant sur site et ligne_commande
--   3. Ajouter triggers updated_at niveau base de données
--      (garantie indépendante du ORM JPA)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. NORMALISATION TIMESTAMPTZ
--    Toutes les colonnes TIMESTAMP → TIMESTAMPTZ
--    Le fuseau Africa/Dakar (UTC+0 toute l'année) garantit
--    que les données existantes ne sont pas altérées.
-- ────────────────────────────────────────────────────────────

-- Tables du domaine Lots
ALTER TABLE lot_semencier
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE transfert_lot
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE controle_qualite
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE certification
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE historique_statut_lot
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE programme_multiplication
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE parcelle_multiplication
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE rendement_production
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

-- Tables du domaine Organisations
ALTER TABLE organisation
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE membre_organisation
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE membre_organisation
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ
    USING updated_at AT TIME ZONE 'Africa/Dakar';

-- Tables du domaine Stock
-- La vue v_stock_agrege dépend de stock.updated_at (MAX(s.updated_at)).
-- PostgreSQL interdit ALTER TYPE sur une colonne référencée par une vue.
-- Solution : DROP VIEW → ALTER TYPE → CREATE VIEW (même définition que V21).
DROP VIEW IF EXISTS v_stock_agrege;

ALTER TABLE stock
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ
    USING updated_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE mouvement_stock
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE transfert
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

-- Recréation de la vue v_stock_agrege (identique à V21)
CREATE VIEW v_stock_agrege AS
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
            'createdAt', TO_CHAR(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        ) ORDER BY s.created_at ASC
    )                                    AS lots_detail
FROM stock s
JOIN lot_semencier ls      ON s.id_lot         = ls.id
JOIN site si               ON s.id_site        = si.id
JOIN generation_semence g  ON ls.id_generation = g.id
JOIN variete v             ON ls.id_variete    = v.id
JOIN espece e              ON v.id_espece      = e.id
GROUP BY
    ls.id_variete, ls.id_generation, s.id_site,
    si.code_site, si.nom_site,
    g.code_generation,
    v.nom_variete, v.code_variete,
    e.nom_commun, e.code_espece,
    s.unite;

-- Tables du domaine Commandes
ALTER TABLE commande
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE allocation_commande
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

-- Tables du domaine Catalogue
ALTER TABLE campagne
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE variete
    ALTER COLUMN date_creation TYPE TIMESTAMPTZ
    USING date_creation AT TIME ZONE 'Africa/Dakar';

ALTER TABLE variete
    ALTER COLUMN date_archivage TYPE TIMESTAMPTZ
    USING date_archivage AT TIME ZONE 'Africa/Dakar';

-- Messagerie
ALTER TABLE conversation
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE conversation
    ALTER COLUMN dernier_message_at TYPE TIMESTAMPTZ
    USING dernier_message_at AT TIME ZONE 'Africa/Dakar';

ALTER TABLE message
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

-- Outbox
ALTER TABLE outbox_events
    ALTER COLUMN created_at TYPE TIMESTAMPTZ
    USING created_at AT TIME ZONE 'Africa/Dakar';

-- ────────────────────────────────────────────────────────────
-- 2. COLONNES created_at MANQUANTES
--    DEFAULT NOW() : les lignes existantes reçoivent la date
--    de migration (acceptable pour des données de test).
-- ────────────────────────────────────────────────────────────

ALTER TABLE site
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE ligne_commande
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ────────────────────────────────────────────────────────────
-- 3. TRIGGERS updated_at — garantie niveau base de données
--    Indépendant du ORM JPA : protège contre les UPDATE SQL
--    directs (maintenance, scripts, restore partiel).
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur stock (updated_at déjà présent)
DROP TRIGGER IF EXISTS trg_stock_updated_at ON stock;
CREATE TRIGGER trg_stock_updated_at
    BEFORE UPDATE ON stock
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();

-- Trigger sur membre_organisation (updated_at déjà présent)
DROP TRIGGER IF EXISTS trg_membre_updated_at ON membre_organisation;
CREATE TRIGGER trg_membre_updated_at
    BEFORE UPDATE ON membre_organisation
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();
