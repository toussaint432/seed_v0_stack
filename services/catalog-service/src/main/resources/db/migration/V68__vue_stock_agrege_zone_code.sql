-- V68 : Ajout de zone_code dans la vue stock.v_stock_agrege
--
-- Problème : le frontend utilisait une map statique SITE_TO_ZAE pour associer
--            les sites aux ZAE. Les sites dynamiques (multiplicateurs, quotataires)
--            n'y figuraient pas → leurs ZAE n'étaient pas colorées sur la carte.
-- Solution : exposer si.zone_code directement dans la vue, pour que le frontend
--            puisse construire l'agrégation ZAE de façon 100% dynamique.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Backfill zone_code dans stock.site pour les sites dont la valeur est NULL.
-- Déduit de la localisation géographique de chaque site.
UPDATE stock.site SET zone_code = 'BA' WHERE code_site IN ('CNRA-BAMBEY','FERME-MULTI-01','ISRA-KAOLACK','UPSEMCL-SITE-BAMBEY','SITE-OP-CENTRE') AND zone_code IS NULL;
UPDATE stock.site SET zone_code = 'NAY' WHERE code_site = 'LAB-THIES'        AND zone_code IS NULL;
UPDATE stock.site SET zone_code = 'BC'  WHERE code_site IN ('MAG-ZIGUINCH','SITE-OP-CASAMANCE') AND zone_code IS NULL;
UPDATE stock.site SET zone_code = 'VF'  WHERE code_site = 'SAED-PODOR'       AND zone_code IS NULL;

-- CREATE OR REPLACE VIEW ne permet pas d'insérer une colonne au milieu de la liste
-- (PostgreSQL interprète ça comme un renommage). On doit DROP + CREATE.
DROP VIEW IF EXISTS stock.v_stock_agrege;

CREATE VIEW stock.v_stock_agrege AS
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
    )                                    AS lots_detail,
    si.zone_code
FROM  stock.stock          s
JOIN  lot.lot_semencier    ls ON s.id_lot         = ls.id
JOIN  stock.site           si ON s.id_site        = si.id
JOIN  lot.generation_semence g ON ls.id_generation = g.id
JOIN  catalog.variete       v ON ls.id_variete    = v.id
JOIN  catalog.espece        e ON v.id_espece      = e.id
GROUP BY
    ls.id_variete, ls.id_generation, s.id_site,
    si.code_site, si.nom_site, si.zone_code,
    g.code_generation,
    v.nom_variete, v.code_variete,
    e.nom_commun, e.code_espece,
    s.unite;
