-- ============================================================
-- V14 — Correction des sites et organisation UPSemCL
--
-- Constat :
--   • Site 1  MAG-THIES   → UPSemCL Bambey  (code erroné, renommer → MAG-BAMBEY)
--   • Site 4  MAG-KAOLACK → UPSemCL Bambey  (site fantôme, fusionner vers MAG-BAMBEY)
--   • Site 10 MAG-STLOUIS → UPSemCL Saint-Louis (organisation fictive, fusionner + désactiver)
--
-- L'UPSemCL est une entité unique basée à Bambey (ISRA/CNRA).
-- Après migration, un seul site : MAG-BAMBEY → UPSemCL Bambey (UPSEMCL)
-- ============================================================

-- ── 1. Renommer le site principal (MAG-THIES → MAG-BAMBEY) ──────────────
UPDATE site
SET code_site = 'MAG-BAMBEY',
    nom_site  = 'Magasin Central Bambey'
WHERE id = 1;

-- ── 2. Fusionner les stocks de MAG-KAOLACK (site 4) → MAG-BAMBEY (site 1)
--       Lots 11, 22, 23, 24 : aucun conflit avec site 1 → simple réaffectation
UPDATE stock
SET id_site = 1
WHERE id_site = 4;

-- ── 3. Fusionner les stocks de MAG-STLOUIS (site 10) → MAG-BAMBEY (site 1)
--       Lot 21 : conflit — existe sur les deux sites → additionner les quantités

-- 3a. Ajouter la quantité MAG-STLOUIS au lot 21 déjà présent sur MAG-BAMBEY
UPDATE stock
SET quantite_disponible = quantite_disponible + (
    SELECT quantite_disponible FROM stock WHERE id_site = 10 AND id_lot = 21
)
WHERE id_site = 1 AND id_lot = 21;

-- 3b. Supprimer la ligne dupliquée (lot 21 sur MAG-STLOUIS)
DELETE FROM stock WHERE id_site = 10 AND id_lot = 21;

-- 3c. Réaffecter les lots restants de MAG-STLOUIS (lots 30 et 31, sans conflit)
UPDATE stock
SET id_site = 1
WHERE id_site = 10;

-- ── 4. Mettre à jour les références dans mouvement_stock ────────────────
UPDATE mouvement_stock
SET id_site_source = 1
WHERE id_site_source IN (4, 10);

UPDATE mouvement_stock
SET id_site_destination = 1
WHERE id_site_destination IN (4, 10);

-- ── 5. Supprimer les sites devenus vides ────────────────────────────────
DELETE FROM site WHERE id IN (4, 10);

-- ── 6. Désactiver l'organisation fictive UPSemCL Saint-Louis ────────────
--       Soft-delete : conservation de l'historique, exclusion des requêtes actives
UPDATE organisation
SET active = false
WHERE id = 34;
