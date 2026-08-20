-- ─────────────────────────────────────────────────────────────────────────────
-- V58 : Référentiel Mil officiel — 7 variétés homologuées ISRA/CNRA Bambey
--
-- Source : Catalogue variétal officiel ISRA/CNRA + Fiches techniques ISRA
--   Gawane · IBMV 8402 · IBV 8001 · IBV 8004 · ISMI 9507 · Souna 3 · Thialack 2
--
-- Actions :
--   1. Supprimer MIL-SN (Sanio Local) et ses 7 lots de simulation + dépendances
--   2. Supprimer les 4 variétés hors catalogue (BASSI, SOUNA11, TAAW, THIOU) — 0 lots
--   3. Mettre à jour 3 variétés existantes (IBV8004, SOUNA3, THIALACK2)
--   4. Insérer 4 nouvelles variétés officielles (GAWANE, IBMV8402, IBV8001, ISMI9507)
--   5. Reconstruire les associations variete_zone pour les 7 variétés MIL
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 1 : Supprimer MIL-SN et ses 7 lots de simulation (SIM-*)
-- ═══════════════════════════════════════════════════════════════════════

-- IDs des 7 lots MIL-SN : 28, 29, 30, 31, 32, 33, 34
-- Ordre de suppression : dépendances enfants d'abord, puis lots, puis variété

-- 1a. Nullifier les auto-références parent/enfant dans la chaîne
UPDATE lot.lot_semencier SET id_lot_parent = NULL
WHERE id IN (28, 29, 30, 31, 32, 33, 34);

-- 1b. Supprimer les tables dépendantes (ordre FK)
DELETE FROM lot.programme_multiplication WHERE id_lot_source IN (28, 29, 30, 31, 32, 33, 34);
DELETE FROM orders.allocation_commande WHERE id_lot IN (28, 29, 30, 31, 32, 33, 34);
DELETE FROM lot.certification WHERE id_lot IN (28, 29, 30, 31, 32, 33, 34);
DELETE FROM lot.controle_qualite WHERE id_lot IN (28, 29, 30, 31, 32, 33, 34);
DELETE FROM lot.transfert_lot WHERE id_lot IN (28, 29, 30, 31, 32, 33, 34);
DELETE FROM lot.historique_statut_lot WHERE id_lot IN (28, 29, 30, 31, 32, 33, 34);
DELETE FROM stock.stock WHERE id_lot IN (28, 29, 30, 31, 32, 33, 34);

-- 1c. Supprimer les lots (variete_zone auto-cascadée par FK variete)
DELETE FROM lot.lot_semencier WHERE id IN (28, 29, 30, 31, 32, 33, 34);

-- 1d. Supprimer la variété MIL-SN (variete_zone cascadée)
DELETE FROM catalog.variete WHERE code_variete = 'MIL-SN';

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 2 : Supprimer les 4 variétés hors catalogue (0 lots, zones cascadées)
-- ═══════════════════════════════════════════════════════════════════════

DELETE FROM catalog.variete WHERE code_variete IN ('MIL-BASSI', 'MIL-SOUNA11', 'MIL-TAAW', 'MIL-THIOU');

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 3 : Mettre à jour les 3 variétés MIL existantes avec données officielles
-- ═══════════════════════════════════════════════════════════════════════

-- IBV 8004 — Synthétique ISRA-ICRISAT, Thiès + Diourbel + Louga
UPDATE catalog.variete SET
    nom_variete             = 'IBV 8004',
    origine                 = 'Bambey, Sénégal — ISRA-ICRISAT',
    selectionneur_principal = 'ISRA-ICRISAT',
    pedigree                = 'Recombinaison de 700516 (Nigeria), Serere 2A et Serere 14 (Ouganda) et Souna 3 (Sénégal)',
    nature_genetique        = 'Synthétique',
    annee_creation          = 1980,
    annee_homologation      = 1987,
    cycle_min               = 75,
    cycle_max               = 85,
    rendement_min           = 1.0,
    rendement_max           = 2.6,
    type_grain              = 'Jaune clair',
    vocation_culturale      = 'Culture pluviale (Thiès, Diourbel et Louga)',
    statut_variete          = 'DIFFUSEE'
WHERE code_variete = 'MIL-IBV8004';

-- Souna 3 — Synthétique IRAT, Bassin Arachidier + Tambacounda
UPDATE catalog.variete SET
    nom_variete             = 'Souna 3',
    origine                 = 'Bambey, Sénégal — IRAT',
    selectionneur_principal = 'IRAT',
    pedigree                = 'Recombinaison de 8 lignées des populations PC 28 et PC 32 (106-7, 108-4, 113-3, 115-4, 134-5, 142-4, 143-4, 148-3)',
    nature_genetique        = 'Synthétique',
    annee_creation          = 1969,
    annee_homologation      = NULL,
    cycle_min               = 85,
    cycle_max               = 95,
    rendement_min           = 2.4,
    rendement_max           = 3.5,
    type_grain              = 'Jaune olive',
    vocation_culturale      = 'Culture pluviale (Fatick, Kaolack et Tambacounda)',
    statut_variete          = 'DIFFUSEE'
WHERE code_variete = 'MIL-SOUNA3';

-- Thialack 2 — Composite ISRA, Bassin Arachidier (Fatick, Kaolack)
UPDATE catalog.variete SET
    nom_variete             = 'Thialack 2',
    origine                 = 'Bambey, Sénégal — ISRA',
    selectionneur_principal = 'ISRA',
    pedigree                = 'Population locale Sénégal',
    nature_genetique        = 'Composite',
    annee_creation          = 2008,
    annee_homologation      = 2010,
    cycle_min               = 95,
    cycle_max               = 95,
    rendement_min           = 2.0,
    rendement_max           = 3.0,
    type_grain              = 'Gris',
    vocation_culturale      = 'Culture pluviale (Fatick et Kaolack)',
    statut_variete          = 'DIFFUSEE'
WHERE code_variete = 'MIL-THIALACK2';

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 4 : Insérer les 4 nouvelles variétés officielles
-- ═══════════════════════════════════════════════════════════════════════

-- Gawane — Composite ISRA, Population locale Sénégal, Thiès + Diourbel
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, annee_homologation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'MIL-GAWANE', 'Gawane', e.id,
    'Bambey, Sénégal — ISRA',
    'ISRA', 'Population locale Sénégal', 'Composite',
    2006, 2010, 85, 85, 2.5, 2.5,
    'Jaune clair',
    'Culture pluviale (Thiès et Diourbel)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'MIL'
ON CONFLICT (code_variete) DO NOTHING;

-- IBMV 8402 — Synthétique ISRA-ICRISAT, 13 lignées ICMI, Thiès + Diourbel
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, annee_homologation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'MIL-IBMV8402', 'IBMV 8402', e.id,
    'Bambey, Sénégal — ISRA-ICRISAT',
    'ISRA-ICRISAT', 'Recombinaison de 13 lignées ICMI', 'Synthétique',
    1984, NULL, 75, 95, 2.0, 2.0,
    'Jaune clair',
    'Culture pluviale (Thiès et Diourbel)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'MIL'
ON CONFLICT (code_variete) DO NOTHING;

-- IBV 8001 — Synthétique ISRA-ICRISAT, Kaolack + Fatick
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, annee_homologation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'MIL-IBV8001', 'IBV 8001', e.id,
    'Bambey, Sénégal — ISRA-ICRISAT',
    'ISRA-ICRISAT', 'Recombinaison de 700516 (Nigeria), Serere 2A et Cassady (Ouganda)', 'Synthétique',
    1980, 1987, 90, 90, 2.4, 3.4,
    'Jaune clair',
    'Culture pluviale (Kaolack et Fatick)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'MIL'
ON CONFLICT (code_variete) DO NOTHING;

-- ISMI 9507 — Synthétique ISRA, 3 lignées en F7, Thiès + Diourbel
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, annee_homologation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'MIL-ISMI9507', 'ISMI 9507', e.id,
    'Bambey, Sénégal — ISRA',
    'ISRA', 'Recombinaison de 3 lignées en F7', 'Synthétique',
    1995, 2010, 85, 85, 2.5, 2.5,
    'Gris',
    'Culture pluviale (Thiès et Diourbel)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'MIL'
ON CONFLICT (code_variete) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 5 : Reconstruire les associations variete_zone pour les 7 variétés MIL
-- ═══════════════════════════════════════════════════════════════════════

DELETE FROM catalog.variete_zone
WHERE id_variete IN (
    SELECT id FROM catalog.variete
    WHERE id_espece = (SELECT id FROM catalog.espece WHERE code_espece = 'MIL')
);

-- Gawane : Culture pluviale Thiès (NAY) + Diourbel (BA)
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MIL-GAWANE' AND z.code IN ('NAY','BA') ON CONFLICT DO NOTHING;

-- IBMV 8402 : Culture pluviale Thiès (NAY) + Diourbel (BA)
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MIL-IBMV8402' AND z.code IN ('NAY','BA') ON CONFLICT DO NOTHING;

-- IBV 8001 : Culture pluviale Kaolack + Fatick — tous deux en BA
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MIL-IBV8001' AND z.code IN ('BA') ON CONFLICT DO NOTHING;

-- IBV 8004 : Culture pluviale Thiès (NAY) + Diourbel (BA) + Louga (ZSP)
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MIL-IBV8004' AND z.code IN ('NAY','BA','ZSP') ON CONFLICT DO NOTHING;

-- ISMI 9507 : Culture pluviale Thiès (NAY) + Diourbel (BA)
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MIL-ISMI9507' AND z.code IN ('NAY','BA') ON CONFLICT DO NOTHING;

-- Souna 3 : Culture pluviale Fatick + Kaolack (BA) + Tambacounda (SO)
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MIL-SOUNA3' AND z.code IN ('BA','SO') ON CONFLICT DO NOTHING;

-- Thialack 2 : Culture pluviale Fatick + Kaolack (BA)
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MIL-THIALACK2' AND z.code IN ('BA') ON CONFLICT DO NOTHING;
