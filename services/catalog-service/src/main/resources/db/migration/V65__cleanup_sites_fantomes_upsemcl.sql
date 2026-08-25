-- V65 : Nettoyage des sites UPSemCL fantômes
--
-- Contexte :
--   V14 avait renommé MAG-THIES → MAG-BAMBEY et supprimé MAG-KAOLACK/MAG-STLOUIS (ids 4, 10).
--   V34 a créé UPSEMCL-SITE-BAMBEY comme site canonique (est_principal=true, org 2).
--        Il a aussi créé UPSEMCL-SITE-STLOUIS pour l'org 5 (UPSemCL National consolidé).
--   V35 a migré TOUS les stocks UPSemCL vers UPSEMCL-SITE-BAMBEY.
--
-- Après V35, les sites suivants n'ont plus de stock et ne sont plus principaux :
--   • MAG-BAMBEY            (ancien site UPSemCL, remplacé par UPSEMCL-SITE-BAMBEY)
--   • UPSEMCL-SITE-STLOUIS  (org 5 = UPSemCL National désactivé depuis V15)
--
-- Site conservé : UPSEMCL-SITE-BAMBEY (seul site UPSemCL actif)
-- ============================================================

-- ── Sécurité : déplacer tout stock résiduel éventuel vers UPSEMCL-SITE-BAMBEY ──
DO $$
DECLARE
  target_id  INTEGER := (SELECT id FROM site WHERE code_site = 'UPSEMCL-SITE-BAMBEY' LIMIT 1);
  source_ids INTEGER[];
BEGIN
  SELECT ARRAY(
    SELECT id FROM site
    WHERE code_site IN ('MAG-BAMBEY', 'UPSEMCL-SITE-STLOUIS')
  ) INTO source_ids;

  IF target_id IS NULL OR array_length(source_ids, 1) IS NULL THEN
    RETURN; -- Sites cibles introuvables, rien à faire
  END IF;

  -- Fusionner les stocks résiduels (au cas où V35 n'aurait pas tout couvert)
  INSERT INTO stock (id_lot, id_site, quantite_disponible, unite)
  SELECT s.id_lot, target_id, s.quantite_disponible, s.unite
  FROM stock s
  WHERE s.id_site = ANY(source_ids)
  ON CONFLICT (id_lot, id_site)
  DO UPDATE SET
    quantite_disponible = stock.quantite_disponible + EXCLUDED.quantite_disponible,
    updated_at = NOW();

  DELETE FROM stock WHERE id_site = ANY(source_ids);

  -- Corriger mouvement_stock
  UPDATE mouvement_stock SET id_site_source      = target_id WHERE id_site_source      = ANY(source_ids);
  UPDATE mouvement_stock SET id_site_destination = target_id WHERE id_site_destination = ANY(source_ids);
END $$;

-- ── Supprimer les sites fantômes (maintenant vides) ──
DELETE FROM site WHERE code_site IN ('MAG-BAMBEY', 'UPSEMCL-SITE-STLOUIS');

-- ── Garantir que UPSEMCL-SITE-BAMBEY est bien marqué principal ──
UPDATE site SET est_principal = true WHERE code_site = 'UPSEMCL-SITE-BAMBEY';
