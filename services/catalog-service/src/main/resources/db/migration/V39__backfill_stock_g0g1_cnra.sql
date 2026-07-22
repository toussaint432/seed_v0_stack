-- Backfill : créer les entrées stock manquantes pour les lots G0/G1
-- Règle métier : les lots G0/G1 appartiennent exclusivement au site CNRA-BAMBEY.
-- Seuls les lots sans aucune entrée stock existante sont concernés.
INSERT INTO stock (id_lot, id_site, quantite_disponible, unite, created_at, updated_at)
SELECT
    ls.id                              AS id_lot,
    si.id                              AS id_site,
    COALESCE(ls.quantite_nette, 0)     AS quantite_disponible,
    COALESCE(ls.unite, 'kg')           AS unite,
    NOW()                              AS created_at,
    NOW()                              AS updated_at
FROM lot_semencier ls
JOIN generation_semence g ON g.id = ls.id_generation
JOIN site si               ON si.code_site = 'CNRA-BAMBEY'
WHERE g.code_generation IN ('G0', 'G1')
  AND COALESCE(ls.quantite_nette, 0) > 0
  AND NOT EXISTS (
      SELECT 1 FROM stock s WHERE s.id_lot = ls.id
  )
ON CONFLICT (id_lot, id_site) DO NOTHING;
