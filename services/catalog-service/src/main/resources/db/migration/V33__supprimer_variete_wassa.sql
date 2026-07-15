-- V33 : Suppression définitive de la variété Wassa (RIZ-WASSA)
-- Raison : variété hors catalogue officiel ISRA/CNRA — retrait demandé.
--
-- Dépendances identifiées avant suppression :
--   • 4 lots semenciers (G0 + 3 G1) liés à id_variete = Wassa
--   • 3 mouvements_stock liés à ces lots
--   • 3 stocks liés à ces lots
--   • 0 transferts, 0 certifications, 0 contrôles, 0 lignes de commande
--   • 0 lots d'autres variétés ayant un lot Wassa comme parent
--
-- Ordre de suppression (respect des FK) :
--   1. mouvement_stock         → référence id_lot
--   2. stock                   → référence id_lot
--   3. Neutralisation FK interne lot_semencier (id_lot_parent en auto-référence)
--   4. lot_semencier           → référence id_variete
--   5. variete_historique      → référence id_variete
--   6. variete                 → suppression finale

DO $$
DECLARE wassa_id BIGINT;
BEGIN
  SELECT id INTO wassa_id FROM variete WHERE code_variete = 'RIZ-WASSA';
  IF wassa_id IS NULL THEN
    RAISE NOTICE 'RIZ-WASSA déjà supprimée — migration ignorée.';
    RETURN;
  END IF;

  -- 1. Mouvements de stock liés aux lots Wassa
  DELETE FROM mouvement_stock
  WHERE id_lot IN (SELECT id FROM lot_semencier WHERE id_variete = wassa_id);

  -- 2. Stocks liés aux lots Wassa
  DELETE FROM stock
  WHERE id_lot IN (SELECT id FROM lot_semencier WHERE id_variete = wassa_id);

  -- 3. Neutralisation des auto-références FK (G1 → G0 dans la même série)
  --    Permet de supprimer tous les lots en une seule passe sans violation FK
  UPDATE lot_semencier SET id_lot_parent = NULL
  WHERE id_lot_parent IN (SELECT id FROM lot_semencier WHERE id_variete = wassa_id);

  -- 4. Suppression des lots semenciers (G0 + G1)
  DELETE FROM lot_semencier WHERE id_variete = wassa_id;

  -- 5. Historique de modifications de la variété
  DELETE FROM variete_historique WHERE id_variete = wassa_id;

  -- 6. Suppression de la variété elle-même
  DELETE FROM variete WHERE id = wassa_id;

  RAISE NOTICE 'Variété RIZ-WASSA et ses 4 lots supprimés avec succès.';
END $$;
