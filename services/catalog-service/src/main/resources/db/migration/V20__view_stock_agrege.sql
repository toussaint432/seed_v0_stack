-- Vue agrégée du stock par (variété, génération, site).
-- Principe : traçabilité conservée au niveau lot (table stock inchangée),
-- mais l'affichage opérationnel regroupe les lots de même variété/génération/site.
-- Les lots_detail fournissent le détail pour le drill-down frontend.
CREATE OR REPLACE VIEW v_stock_agrege AS
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
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'idStock',   s.id,
            'idLot',     ls.id,
            'codeLot',   ls.code_lot,
            'quantite',  s.quantite_disponible,
            'unite',     s.unite,
            'statut',    ls.statut_lot,
            'campagne',  ls.campagne,
            'createdAt', ls.created_at
        ) ORDER BY ls.created_at ASC
    )                                    AS lots_detail
FROM stock s
JOIN lot_semencier ls      ON s.id_lot        = ls.id
JOIN site si               ON s.id_site       = si.id
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
