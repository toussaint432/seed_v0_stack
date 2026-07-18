-- V35 : Corriger les affectations de sites dans la table stock
-- Règle métier :
--   • Lots G0/G1 au niveau des sites ISRA (org 1) → CNRA-BAMBEY
--   • Lots G0/G1/G2 au niveau des sites UPSemCL (org 2) → UPSEMCL-SITE-BAMBEY
-- Fusion des quantités si l'entrée cible existe déjà (ON CONFLICT DO UPDATE).

-- 1. G0/G1 stockés à un site ISRA autre que CNRA-BAMBEY → CNRA-BAMBEY
DO $$
DECLARE cnra_id INTEGER := (SELECT id FROM site WHERE code_site = 'CNRA-BAMBEY' LIMIT 1);
BEGIN
  INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
  SELECT s.id_lot, cnra_id, s.quantite_disponible, s.unite
  FROM stock s
  JOIN lot_semencier l ON s.id_lot = l.id
  JOIN generation_semence g ON l.id_generation = g.id
  WHERE g.code_generation IN ('G0','G1')
    AND s.id_site IN (SELECT id FROM site WHERE id_organisation = 1 AND code_site != 'CNRA-BAMBEY')
  ON CONFLICT (id_lot, id_site)
  DO UPDATE SET quantite_disponible = stock.quantite_disponible + EXCLUDED.quantite_disponible,
                updated_at = NOW();

  DELETE FROM stock
  WHERE id_lot IN (
    SELECT l.id FROM lot_semencier l
    JOIN generation_semence g ON l.id_generation = g.id
    WHERE g.code_generation IN ('G0','G1')
  )
    AND id_site IN (SELECT id FROM site WHERE id_organisation = 1 AND code_site != 'CNRA-BAMBEY');
END $$;

-- 2. G0/G1/G2 stockés à un site UPSemCL autre que UPSEMCL-SITE-BAMBEY → UPSEMCL-SITE-BAMBEY
DO $$
DECLARE upsemcl_id INTEGER := (SELECT id FROM site WHERE code_site = 'UPSEMCL-SITE-BAMBEY' LIMIT 1);
BEGIN
  INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
  SELECT s.id_lot, upsemcl_id, s.quantite_disponible, s.unite
  FROM stock s
  JOIN lot_semencier l ON s.id_lot = l.id
  JOIN generation_semence g ON l.id_generation = g.id
  WHERE g.code_generation IN ('G0','G1','G2')
    AND s.id_site IN (SELECT id FROM site WHERE id_organisation = 2 AND code_site != 'UPSEMCL-SITE-BAMBEY')
  ON CONFLICT (id_lot, id_site)
  DO UPDATE SET quantite_disponible = stock.quantite_disponible + EXCLUDED.quantite_disponible,
                updated_at = NOW();

  DELETE FROM stock
  WHERE id_lot IN (
    SELECT l.id FROM lot_semencier l
    JOIN generation_semence g ON l.id_generation = g.id
    WHERE g.code_generation IN ('G0','G1','G2')
  )
    AND id_site IN (SELECT id FROM site WHERE id_organisation = 2 AND code_site != 'UPSEMCL-SITE-BAMBEY');
END $$;
