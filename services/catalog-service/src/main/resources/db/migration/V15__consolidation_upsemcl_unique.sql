-- ============================================================
-- V15 — Consolidation UPSemCL : une seule organisation canonique
--
-- Constat après V14 :
--   • Org 2  UPSEMCL-BAMBEY     → UPSemCL Bambey  (active, site MAG-BAMBEY) ✓ GARDER
--   • Org 3  UPSEMCL-NAT        → UPSemCL National — Dakar (active, sans site)
--                                   User "upsemcl" y est rattaché par erreur
--   • Org 34 UPSEMCL-STLOUIS    → UPSemCL Saint-Louis (inactive, sans site)
--                                   User "upsemcl_stlouis" + commande CMD-2026-NORD-001
--
-- Après migration : une seule organisation UPSEMCL = org 2 (UPSemCL Bambey)
-- ============================================================

-- ── 1. Rattacher le user "upsemcl" à l'org canonique (Bambey) ──────────────
UPDATE membre_organisation
SET id_organisation = 2
WHERE keycloak_username = 'upsemcl' AND id_organisation = 3;

-- ── 2. Rattacher "upsemcl_stlouis" à l'org canonique (Saint-Louis fusionné) ─
UPDATE membre_organisation
SET id_organisation = 2
WHERE id_organisation = 34;

-- ── 3. Réaffecter la commande CMD-2026-NORD-001 vers UPSemCL Bambey ─────────
UPDATE commande
SET id_organisation_fournisseur = 2
WHERE id_organisation_fournisseur = 34;

-- ── 4. Réaffecter toute commande encore liée à l'org 3 (National) ───────────
UPDATE commande
SET id_organisation_fournisseur = 2
WHERE id_organisation_fournisseur = 3;

-- ── 5. Réaffecter d'éventuels programmes liés à org 3 ───────────────────────
UPDATE programme_multiplication
SET id_organisation = 2
WHERE id_organisation = 3;

-- ── 6. Réaffecter les lots semenciers produits par org 3 ────────────────────
UPDATE lot_semencier
SET id_org_producteur = 2
WHERE id_org_producteur IN (3, 34);

-- ── 7. Supprimer les organisations fictives/redondantes ─────────────────────
DELETE FROM organisation WHERE id IN (3, 34);
