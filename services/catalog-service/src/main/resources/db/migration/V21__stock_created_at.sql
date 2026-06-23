-- V21 : Ajout de la date d'enregistrement sur la table stock
--        et mise à jour de la vue agrégée v_stock_agrege.

-- 1. Colonne created_at sur stock
--    DEFAULT NOW() pour rétrocompatibilité des lignes existantes.
ALTER TABLE stock
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. On doit DROP puis CREATE car PostgreSQL interdit l'insertion
--    d'une colonne au milieu d'une vue existante via CREATE OR REPLACE.
DROP VIEW IF EXISTS v_stock_agrege;

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
