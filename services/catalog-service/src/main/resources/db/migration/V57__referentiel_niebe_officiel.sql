-- ─────────────────────────────────────────────────────────────────────────────
-- V57 : Référentiel Niébé officiel — 17 variétés homologuées ISRA/CNRA Bambey
--
-- Source : Catalogue variétal officiel ISRA/CNRA + Fiches techniques ISRA 2015
--   Variétés anciennes : 58-57 · 58-74 f · 66-35 f · Bambey 21 · C.B-5
--              Diongama · Mélakh · Mougne · Mouride · Ndiambour · Pakau
--              TN 88-63 · Yacine
--   Variétés 2015 ISRA-CNRA : Leona · Thieye · Sam · Kelle
--
-- Actions :
--   1. Renommer NIE-58-74 → NIE-5874F, NIE-66-35 → NIE-6635F (0 lots)
--   2. Mettre à jour les 4 variétés NIE existantes avec données officielles
--   3. Insérer les 11 nouvelles variétés officielles
--   4. Reconstruire toutes les associations variete_zone pour NIE
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 1 : Renommer les codes non-conformes (0 lots, safe)
-- ═══════════════════════════════════════════════════════════════════════

UPDATE catalog.variete SET code_variete = 'NIE-5874F'
WHERE code_variete = 'NIE-58-74';

UPDATE catalog.variete SET code_variete = 'NIE-6635F'
WHERE code_variete = 'NIE-66-35';

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 2 : Mettre à jour les 6 variétés NIE existantes
-- ═══════════════════════════════════════════════════════════════════════

-- 58-74 f — Lignée pure, Population locale, ISRA, irriguée + pluviale nord
UPDATE catalog.variete SET
    nom_variete             = '58-74 f',
    origine                 = 'Bambey, Sénégal — ISRA',
    selectionneur_principal = 'ISRA',
    pedigree                = 'Population locale',
    nature_genetique        = 'Lignée pure',
    annee_creation          = 1958,
    annee_homologation      = NULL,
    cycle_min               = NULL,
    cycle_max               = NULL,
    rendement_min           = NULL,
    rendement_max           = NULL,
    vocation_culturale      = 'Culture irriguée et pluviale (Fleuve Sénégal, Louga, Thiès, Diourbel)',
    statut_variete          = 'DIFFUSEE'
WHERE code_variete = 'NIE-5874F';

-- 66-35 f — Lignée pure, Population locale USA, ISRA, irriguée + pluviale nord
UPDATE catalog.variete SET
    nom_variete             = '66-35 f',
    origine                 = 'Bambey, Sénégal — ISRA',
    selectionneur_principal = 'ISRA',
    pedigree                = 'Population locale USA',
    nature_genetique        = 'Lignée pure',
    annee_creation          = 1966,
    annee_homologation      = NULL,
    cycle_min               = NULL,
    cycle_max               = NULL,
    rendement_min           = NULL,
    rendement_max           = NULL,
    vocation_culturale      = 'Culture irriguée et pluviale (Fleuve Sénégal, Louga, Thiès, Diourbel)',
    statut_variete          = 'DIFFUSEE'
WHERE code_variete = 'NIE-6635F';

-- Bambey 21 — Lignée pure, croisement complexe, pluviale Louga-Tivaouane
UPDATE catalog.variete SET
    nom_variete             = 'Bambey 21',
    origine                 = 'Bambey, Sénégal — ISRA',
    selectionneur_principal = 'ISRA',
    pedigree                = '5/8 de 58-40 + 1/4 de 66-74 + 1/8 de 58-50',
    nature_genetique        = 'Lignée pure',
    annee_creation          = 1975,
    annee_homologation      = NULL,
    cycle_min               = 57,
    cycle_max               = 60,
    rendement_min           = 1.5,
    rendement_max           = 1.5,
    type_grain              = 'Elliptique blanc',
    vocation_culturale      = 'Culture pluviale (Louga, Dépt. de Tivaouane)',
    statut_variete          = 'DIFFUSEE'
WHERE code_variete = 'NIE-BAMBEY21';

-- Mélakh — Lignée pure, croisé IS86-292 x IT83s, irriguée + pluviale large
UPDATE catalog.variete SET
    nom_variete             = 'Mélakh',
    origine                 = 'Bambey, Sénégal — ISRA',
    selectionneur_principal = 'ISRA',
    pedigree                = 'IS86-292 x IT83s-742-13',
    nature_genetique        = 'Lignée pure',
    annee_creation          = 1989,
    annee_homologation      = NULL,
    cycle_min               = 52,
    cycle_max               = 61,
    rendement_min           = 1.0,
    rendement_max           = 1.0,
    type_grain              = 'Réniforme blanc crème',
    vocation_culturale      = 'Culture irriguée et pluviale (Fleuve Sénégal, Louga, Diourbel, Dépt. de Tivaouane)',
    statut_variete          = 'DIFFUSEE'
WHERE code_variete = 'NIE-MELAKH';

-- Mouride — Lignée pure, croisé 58-57 x IT81D, irriguée + pluviale nord
UPDATE catalog.variete SET
    nom_variete             = 'Mouride',
    origine                 = 'Bambey, Sénégal — ISRA',
    selectionneur_principal = 'ISRA',
    pedigree                = '58-57 x IT81D-1137',
    nature_genetique        = 'Lignée pure',
    annee_creation          = NULL,
    annee_homologation      = NULL,
    cycle_min               = 54,
    cycle_max               = 61,
    rendement_min           = NULL,
    rendement_max           = NULL,
    type_grain              = 'Réniforme blanc crème',
    vocation_culturale      = 'Culture irriguée et pluviale (Fleuve Sénégal, Louga, Diourbel, Dépt. de Tivaouane)',
    statut_variete          = 'DIFFUSEE'
WHERE code_variete = 'NIE-MOURIDE';

-- Yacine — Lignée pure, homologuée 2010, irriguée + pluviale nord
UPDATE catalog.variete SET
    nom_variete             = 'Yacine',
    origine                 = 'Bambey, Sénégal — ISRA',
    selectionneur_principal = 'ISRA',
    pedigree                = 'Mame Penda x Mélakh',
    nature_genetique        = 'Lignée pure',
    annee_creation          = 1991,
    annee_homologation      = 2010,
    cycle_min               = 62,
    cycle_max               = 62,
    rendement_min           = 2.5,
    rendement_max           = 2.5,
    type_grain              = 'Réniforme marron',
    vocation_culturale      = 'Culture irriguée et pluviale (Fleuve Sénégal, Louga, Thiès, Diourbel)',
    statut_variete          = 'DIFFUSEE'
WHERE code_variete = 'NIE-YACINE';

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 3 : Insérer les 11 nouvelles variétés officielles
-- ═══════════════════════════════════════════════════════════════════════

-- 58-57 — Lignée pure IRAT, pluviale Louga-Thiès-Diourbel
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'NIE-5857', '58-57', e.id,
    'Bambey, Sénégal — IRAT',
    'IRAT', 'Population locale de Podor', 'Lignée pure',
    1960, 62, 69, 1.0, 1.0,
    'Réniforme blanc crème',
    'Culture pluviale (Louga, Thiès, Diourbel)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'NIE'
ON CONFLICT (code_variete) DO NOTHING;

-- C.B-5 — Lignée pure USA, irriguée + pluviale Fleuve-Louga-Tivaouane
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'NIE-CB5', 'C.B-5', e.id,
    'USA',
    NULL, 'California Blackeye x Iron', 'Lignée pure',
    1982, 57, 59, 0.8, 1.5,
    'Réniforme blanche',
    'Culture irriguée et pluviale (Fleuve Sénégal, Louga, Dépt. de Tivaouane)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'NIE'
ON CONFLICT (code_variete) DO NOTHING;

-- Diongama — Lignée pure ISRA, irriguée + pluviale centre-sud
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'NIE-DIONGAMA', 'Diongama', e.id,
    'Bambey, Sénégal — ISRA',
    'ISRA', '58-57 x IT81D-1137', 'Lignée pure',
    1986, 64, 69, 1.0, 1.9,
    'Elliptique blanc crème',
    'Culture irriguée et pluviale (Thiès, Diourbel, Nioro, Casamance, Tambacounda)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'NIE'
ON CONFLICT (code_variete) DO NOTHING;

-- Mougne — Lignée pure ISRA, pluviale Thiès-Diourbel
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'NIE-MOUGNE', 'Mougne', e.id,
    'Bambey, Sénégal — ISRA',
    'ISRA', '58-74 x Pout', 'Lignée pure',
    1969, 61, 64, 0.9, 1.4,
    'Elliptique gris-bleu',
    'Culture pluviale (Thiès, Diourbel)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'NIE'
ON CONFLICT (code_variete) DO NOTHING;

-- Ndiambour — Lignée pure ISRA, irriguée + pluviale Louga-Thiès-Diourbel
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'NIE-NDIAMBOUR', 'Ndiambour', e.id,
    'Bambey, Sénégal — ISRA',
    'ISRA', '58-41 x 58-57', 'Lignée pure',
    1969, 61, 71, 0.9, 1.3,
    'Elliptique blanc crème',
    'Culture irriguée et pluviale (Louga, Thiès, Diourbel)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'NIE'
ON CONFLICT (code_variete) DO NOTHING;

-- Pakau — Lignée pure ISRA, irriguée + pluviale Nioro-Casamance
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'NIE-PAKAU', 'Pakau', e.id,
    'Bambey, Sénégal — ISRA',
    'ISRA', 'Mouride x 58-77', 'Lignée pure',
    1993, 61, 61, 3.5, 3.5,
    'Réniforme blanc crème',
    'Culture irriguée et pluviale (Nioro, Casamance)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'NIE'
ON CONFLICT (code_variete) DO NOTHING;

-- TN 88-63 — Lignée pure ISRA, irriguée + pluviale large couverture
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'NIE-TN8863', 'TN 88-63', e.id,
    'Bambey, Sénégal — ISRA',
    'ISRA', 'Population locale Nguigmi (Niger)', 'Lignée pure',
    1975, 55, 60, 1.0, 2.0,
    'Blanche',
    'Culture irriguée et pluviale (Fleuve Sénégal, Louga, Thiès, Diourbel, Nioro, Casamance)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'NIE'
ON CONFLICT (code_variete) DO NOTHING;

-- Leona — Lignée ISRA-CNRA 2015, hivernage Nord et Centre-Nord
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'NIE-LEONA', 'Leona', e.id,
    'ISRA-CNRA Bambey, Sénégal',
    'ISRA', 'Mélakh x Monteiro', 'Lignée',
    2015, 60, 60, 3.0, 3.0,
    'Réniforme blanche',
    'Culture d''hivernage (Nord et Centre-Nord du Sénégal)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'NIE'
ON CONFLICT (code_variete) DO NOTHING;

-- Thieye — Lignée ISRA-CNRA 2015, hivernage Nord et Centre-Nord
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'NIE-THIEYE', 'Thieye', e.id,
    'ISRA-CNRA Bambey, Sénégal',
    'ISRA', 'Mélakh x Monteiro', 'Lignée',
    2015, 59, 59, 3.0, 3.0,
    'Réniforme blanche',
    'Culture d''hivernage (Nord et Centre-Nord du Sénégal)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'NIE'
ON CONFLICT (code_variete) DO NOTHING;

-- Sam — Lignée ISRA-CNRA 2015, hivernage Nord et Centre-Nord
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'NIE-SAM', 'Sam', e.id,
    'ISRA-CNRA Bambey, Sénégal',
    'ISRA', 'Mélakh x Monteiro', 'Lignée',
    2015, 58, 58, 3.3, 3.3,
    'Réniforme blanche',
    'Culture d''hivernage (Nord et Centre-Nord du Sénégal)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'NIE'
ON CONFLICT (code_variete) DO NOTHING;

-- Kelle — Lignée ISRA-CNRA 2015, hivernage Nord et Centre-Nord
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'NIE-KELLE', 'Kelle', e.id,
    'ISRA-CNRA Bambey, Sénégal',
    'ISRA', 'Mélakh x Monteiro', 'Lignée',
    2015, 60, 60, 2.9, 2.9,
    'Réniforme blanche',
    'Culture d''hivernage (Nord et Centre-Nord du Sénégal)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'NIE'
ON CONFLICT (code_variete) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 4 : Reconstruire les associations variete_zone pour NIE
-- ═══════════════════════════════════════════════════════════════════════

DELETE FROM catalog.variete_zone
WHERE id_variete IN (
    SELECT id FROM catalog.variete
    WHERE id_espece = (SELECT id FROM catalog.espece WHERE code_espece = 'NIE')
);

-- 58-57 : pluviale Louga (ZSP), Thiès (NAY), Diourbel (BA)
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'NIE-5857' AND z.code IN ('ZSP','NAY','BA') ON CONFLICT DO NOTHING;

-- 58-74 f : irriguée/pluviale Fleuve (VF), Louga (ZSP), Thiès (NAY), Diourbel (BA)
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'NIE-5874F' AND z.code IN ('VF','ZSP','NAY','BA') ON CONFLICT DO NOTHING;

-- 66-35 f : même couverture que 58-74 f
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'NIE-6635F' AND z.code IN ('VF','ZSP','NAY','BA') ON CONFLICT DO NOTHING;

-- Bambey 21 : pluviale Louga (ZSP), Tivaouane/Thiès (NAY)
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'NIE-BAMBEY21' AND z.code IN ('ZSP','NAY') ON CONFLICT DO NOTHING;

-- C.B-5 : irriguée/pluviale Fleuve (VF), Louga (ZSP), Tivaouane/Thiès (NAY)
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'NIE-CB5' AND z.code IN ('VF','ZSP','NAY') ON CONFLICT DO NOTHING;

-- Diongama : Thiès (NAY), Diourbel-Nioro (BA), Tambacounda (SO), Casamance (HC,MC,BC)
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'NIE-DIONGAMA' AND z.code IN ('NAY','BA','SO','HC','MC','BC') ON CONFLICT DO NOTHING;

-- Mélakh : irriguée/pluviale VF, ZSP, BA, NAY
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'NIE-MELAKH' AND z.code IN ('VF','ZSP','BA','NAY') ON CONFLICT DO NOTHING;

-- Mougne : pluviale Thiès (NAY), Diourbel (BA)
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'NIE-MOUGNE' AND z.code IN ('NAY','BA') ON CONFLICT DO NOTHING;

-- Mouride : irriguée/pluviale VF, ZSP, BA, NAY
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'NIE-MOURIDE' AND z.code IN ('VF','ZSP','BA','NAY') ON CONFLICT DO NOTHING;

-- Ndiambour : irriguée/pluviale ZSP, NAY, BA
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'NIE-NDIAMBOUR' AND z.code IN ('ZSP','NAY','BA') ON CONFLICT DO NOTHING;

-- Pakau : irriguée/pluviale Nioro (BA), Casamance (HC, MC, BC)
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'NIE-PAKAU' AND z.code IN ('BA','HC','MC','BC') ON CONFLICT DO NOTHING;

-- TN 88-63 : couverture large VF, ZSP, NAY, BA, HC, MC, BC
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'NIE-TN8863' AND z.code IN ('VF','ZSP','NAY','BA','HC','MC','BC') ON CONFLICT DO NOTHING;

-- Yacine : irriguée/pluviale VF, ZSP, NAY, BA
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'NIE-YACINE' AND z.code IN ('VF','ZSP','NAY','BA') ON CONFLICT DO NOTHING;

-- Leona, Thieye, Sam, Kelle : hivernage Nord + Centre-Nord = VF, ZSP, NAY, BA
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete IN ('NIE-LEONA','NIE-THIEYE','NIE-SAM','NIE-KELLE')
  AND z.code IN ('VF','ZSP','NAY','BA') ON CONFLICT DO NOTHING;
