-- ─────────────────────────────────────────────────────────────────────────────
-- V51 : Correction des lots de réception manquants pour CMD-6 et CMD-10
--
-- Problème : TransfertController.accepter (lot-service) était appelé
-- directement par le multiplicateur pour accepter les transferts TL-99F7245B-1
-- et TL-4F9BAB0E-A. Ce chemin crédite le stock du lot UPSemCL source (lot 17)
-- au lieu de créer un lot REC pour le multiplicateur.
-- Résultat : stock de lot 17 (UPSemCL) crédité à FERME-MULTI-02, aucun lot
-- REC créé → le multiplicateur voit le lot UPSemCL dans "Mes Lots".
--
-- Correction :
--   1. Créer REC-6-L5  (CMD-6,  ligne 5, 1000 kg, parent=lot 17)
--   2. Créer REC-10-L9 (CMD-10, ligne 9,  800 kg, parent=lot 17)
--   3. Rediriger TL-99F7245B-1 et TL-4F9BAB0E-A vers leurs lots REC
--   4. Supprimer le stock erroné (lot 17 à FERME-MULTI-02)
--   5. Créer les entrées stock pour les lots REC à FERME-MULTI-02
--   6. Corriger le parent de REC-9-L8 (39 → 17)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Créer REC-6-L5 (copie métadonnées du lot source G3-MAI-DK8031-2025)
INSERT INTO lot.lot_semencier (
    code_lot, id_variete, id_generation, id_lot_parent,
    campagne, quantite_nette, unite,
    statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece
)
SELECT
    'REC-6-L5', l.id_variete, l.id_generation, 17,
    COALESCE(l.campagne, EXTRACT(YEAR FROM NOW())::TEXT),
    1000.00, 'kg',
    'DISPONIBLE', 4, 'multiplicateur',
    NOW(), CURRENT_DATE, l.code_espece
FROM lot.lot_semencier l
WHERE l.id = 17
ON CONFLICT (code_lot) DO NOTHING;

-- 2. Créer REC-10-L9
INSERT INTO lot.lot_semencier (
    code_lot, id_variete, id_generation, id_lot_parent,
    campagne, quantite_nette, unite,
    statut_lot, id_org_producteur, username_createur,
    created_at, date_production, code_espece
)
SELECT
    'REC-10-L9', l.id_variete, l.id_generation, 17,
    COALESCE(l.campagne, EXTRACT(YEAR FROM NOW())::TEXT),
    800.00, 'kg',
    'DISPONIBLE', 4, 'multiplicateur',
    NOW(), CURRENT_DATE, l.code_espece
FROM lot.lot_semencier l
WHERE l.id = 17
ON CONFLICT (code_lot) DO NOTHING;

-- 3a. Rediriger TL-99F7245B-1 (CMD-6) → REC-6-L5
UPDATE lot.transfert_lot
SET id_lot = (SELECT id FROM lot.lot_semencier WHERE code_lot = 'REC-6-L5')
WHERE code_transfert = 'TL-99F7245B-1'
  AND id_lot = 17;

-- 3b. Rediriger TL-4F9BAB0E-A (CMD-10) → REC-10-L9
UPDATE lot.transfert_lot
SET id_lot = (SELECT id FROM lot.lot_semencier WHERE code_lot = 'REC-10-L9')
WHERE code_transfert = 'TL-4F9BAB0E-A'
  AND id_lot = 17;

-- 4. Supprimer le stock erroné du lot UPSemCL (lot 17) à FERME-MULTI-02
DELETE FROM stock.stock
WHERE id_lot = 17
  AND id_site = (SELECT id FROM stock.site WHERE code_site = 'FERME-MULTI-02');

-- 5a. Créer le stock de REC-6-L5 à FERME-MULTI-02 (1000 kg)
INSERT INTO stock.stock (id_lot, id_site, quantite_disponible, unite)
VALUES (
    (SELECT id FROM lot.lot_semencier WHERE code_lot = 'REC-6-L5'),
    (SELECT id FROM stock.site WHERE code_site = 'FERME-MULTI-02'),
    1000.00, 'kg'
)
ON CONFLICT (id_lot, id_site) DO UPDATE
SET quantite_disponible = stock.quantite_disponible + 1000.00,
    updated_at = NOW();

-- 5b. Créer le stock de REC-10-L9 à FERME-MULTI-02 (800 kg)
INSERT INTO stock.stock (id_lot, id_site, quantite_disponible, unite)
VALUES (
    (SELECT id FROM lot.lot_semencier WHERE code_lot = 'REC-10-L9'),
    (SELECT id FROM stock.site WHERE code_site = 'FERME-MULTI-02'),
    800.00, 'kg'
)
ON CONFLICT (id_lot, id_site) DO UPDATE
SET quantite_disponible = stock.quantite_disponible + 800.00,
    updated_at = NOW();

-- 6. Corriger le parent de REC-9-L8 : devrait être le lot G3 source (17) et non le lot REC-7-L6 (39)
UPDATE lot.lot_semencier
SET id_lot_parent = 17
WHERE code_lot = 'REC-9-L8'
  AND id_lot_parent = 39;
