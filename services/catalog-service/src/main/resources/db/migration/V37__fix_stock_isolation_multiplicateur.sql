-- V37 : Isolation stock multiplicateur
-- Supprime les entrées stock où le lot appartient à une autre organisation que le site.
-- Un multiplicateur ne doit voir que le stock de SES propres lots (id_org_producteur = site.id_organisation).
-- Les lots UPSemCL (G3) présents par erreur aux sites multiplicateurs sont supprimés.

DELETE FROM stock
WHERE id IN (
    SELECT s.id
    FROM stock s
    JOIN lot_semencier l  ON l.id  = s.id_lot
    JOIN site si          ON si.id = s.id_site
    JOIN organisation org ON org.id = si.id_organisation
    WHERE org.type_organisation = 'MULTIPLICATEUR'
      AND l.id_org_producteur IS NOT NULL
      AND l.id_org_producteur != si.id_organisation
);
