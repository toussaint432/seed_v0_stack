-- Backfill nom_variete et code_variete pour les lots existants à partir du catalogue
UPDATE lot.lot_semencier ls
SET
    nom_variete  = v.nom_variete,
    code_variete = v.code_variete
FROM catalog.variete v
WHERE ls.id_variete = v.id
  AND (ls.nom_variete IS NULL OR ls.code_variete IS NULL);
