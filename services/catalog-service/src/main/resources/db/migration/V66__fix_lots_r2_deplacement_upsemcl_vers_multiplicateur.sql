-- Les 4 lots R2 (appartenant à Coopérative Sine-Saloum Semences, id_org=4)
-- étaient stockés par erreur sur UPSEMCL-SITE-BAMBEY (site id=24).
-- Leur vrai site est FERME-MULTI-03 (site id=12).
-- On déplace les quantités et on supprime les lignes fantômes.

DO $$
DECLARE
  v_site_upsemcl  BIGINT;
  v_site_multi    BIGINT;
BEGIN
  SELECT id INTO v_site_upsemcl FROM stock.site WHERE code_site = 'UPSEMCL-SITE-BAMBEY';
  SELECT id INTO v_site_multi    FROM stock.site WHERE code_site = 'FERME-MULTI-03';

  IF v_site_upsemcl IS NULL OR v_site_multi IS NULL THEN
    RAISE NOTICE 'Sites introuvables, migration ignorée.';
    RETURN;
  END IF;

  -- Crédit sur le vrai site multiplicateur (UPSERT)
  INSERT INTO stock.stock (id_lot, id_site, quantite_disponible, unite, updated_at, created_at)
  SELECT s.id_lot, v_site_multi, s.quantite_disponible, s.unite, NOW(), NOW()
  FROM stock.stock s
  JOIN lot.lot_semencier l ON l.id = s.id_lot
  WHERE s.id_site = v_site_upsemcl
    AND l.id_org_producteur = 4
    AND l.id_generation IN (SELECT id FROM lot.generation_semence WHERE code_generation IN ('R1','R2'))
  ON CONFLICT (id_lot, id_site)
  DO UPDATE SET
    quantite_disponible = stock.stock.quantite_disponible + EXCLUDED.quantite_disponible,
    updated_at          = NOW();

  -- Suppression des lignes incorrectes sur le site UPSemCL
  DELETE FROM stock.stock s
  USING lot.lot_semencier l
  WHERE s.id_lot = l.id
    AND s.id_site = v_site_upsemcl
    AND l.id_org_producteur = 4
    AND l.id_generation IN (SELECT id FROM lot.generation_semence WHERE code_generation IN ('R1','R2'));

  RAISE NOTICE 'Lots R2 Coopérative Sine-Saloum déplacés de UPSEMCL-SITE-BAMBEY vers FERME-MULTI-03.';
END $$;
