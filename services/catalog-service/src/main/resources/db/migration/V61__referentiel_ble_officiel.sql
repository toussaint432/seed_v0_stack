-- V61 : Référentiel Blé officiel — 8 variétés ISRA/CNRA Bambey
--   Blé tendre : Pendao · Hamat · Diré 15 · Alioune
--   Blé dur    : Haby · Amina · Fanaye · Dioufissa

-- Marquer le sous-type sur les 5 variétés existantes
UPDATE catalog.variete SET type_grain = 'Blé tendre' WHERE code_variete IN ('BLE-PENDAO', 'BLE-HAMAT', 'BLE-ALIOUNE');
UPDATE catalog.variete SET type_grain = 'Blé dur'    WHERE code_variete IN ('BLE-FANAYE', 'BLE-DIOUFISSA');

-- Insérer les 3 variétés manquantes
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, type_grain, statut_variete)
SELECT 'BLE-DIRE15', 'Diré 15', e.id, 'Blé tendre', 'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'BLE'
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, type_grain, statut_variete)
SELECT 'BLE-HABY', 'Haby', e.id, 'Blé dur', 'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'BLE'
ON CONFLICT (code_variete) DO NOTHING;

INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, type_grain, statut_variete)
SELECT 'BLE-AMINA', 'Amina', e.id, 'Blé dur', 'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'BLE'
ON CONFLICT (code_variete) DO NOTHING;
