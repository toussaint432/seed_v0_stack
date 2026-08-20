-- ─────────────────────────────────────────────────────────────────────────────
-- V56 : Référentiel Maïs officiel — 8 variétés homologuées ISRA/CNRA Bambey
--
-- Source : Catalogue variétal officiel ISRA/CNRA (pages 69-76)
--   Variétés : Xéewel Gi · Noor 96 · Doo Mer · Gaaw Na · Sooror ·
--              Goor Yomboul · Jaboot · Yaayi Séex
--
-- Actions :
--   1. Rediriger les 4 lots test V54 (MAI-DK8031, zones SO/HC/MC/BC) → MAI-JABOOT
--   2. Retirer MAI-DK8031 (RETIREE) — lots et commandes existants conservés
--   3. Supprimer MAI-ESPOIR, MAI-INITIAL, MAI-MAMBA, MAI-OBATAMPA (0 dépendances)
--   4. Mettre à jour les 4 variétés déjà présentes avec les données officielles
--   5. Insérer les 4 nouvelles variétés officielles
--   6. Reconstruire toutes les associations variete_zone pour MAI
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 1 : Rediriger les lots test V54 (MAI-DK8031 → MAI-JABOOT)
--           Jaboot couvre Sénégal Oriental + Casamance (SO, HC, MC, BC)
-- ═══════════════════════════════════════════════════════════════════════

UPDATE lot.lot_semencier
SET id_variete = (SELECT id FROM catalog.variete WHERE code_variete = 'MAI-JABOOT'),
    code_lot   = 'R2-MAI-JABOOT-2026-SO'
WHERE code_lot = 'R2-MAI-DK8031-2026-SO';

UPDATE lot.lot_semencier
SET id_variete = (SELECT id FROM catalog.variete WHERE code_variete = 'MAI-JABOOT'),
    code_lot   = 'R2-MAI-JABOOT-2026-HC'
WHERE code_lot = 'R2-MAI-DK8031-2026-HC';

UPDATE lot.lot_semencier
SET id_variete = (SELECT id FROM catalog.variete WHERE code_variete = 'MAI-JABOOT'),
    code_lot   = 'R2-MAI-JABOOT-2026-MC'
WHERE code_lot = 'R2-MAI-DK8031-2026-MC';

UPDATE lot.lot_semencier
SET id_variete = (SELECT id FROM catalog.variete WHERE code_variete = 'MAI-JABOOT'),
    code_lot   = 'R2-MAI-JABOOT-2026-BC'
WHERE code_lot = 'R2-MAI-DK8031-2026-BC';

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 2 : Retirer MAI-DK8031 (non homologuée — lots hérités conservés)
-- ═══════════════════════════════════════════════════════════════════════

UPDATE catalog.variete
SET statut_variete         = 'RETIREE',
    date_archivage         = NOW(),
    commentaire_archivage  = 'Non homologuée au catalogue ISRA/CNRA Bambey — données de test préservées'
WHERE code_variete = 'MAI-DK8031';

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 3 : Supprimer les variétés fictives sans dépendances
-- ═══════════════════════════════════════════════════════════════════════

DELETE FROM catalog.variete
WHERE code_variete IN ('MAI-ESPOIR', 'MAI-INITIAL', 'MAI-MAMBA', 'MAI-OBATAMPA');

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 4 : Mettre à jour les 4 variétés déjà présentes
-- ═══════════════════════════════════════════════════════════════════════

-- Gaaw Na — Composite IITA-ISRA, 75-80j, 2 t/ha, Fatick + Kaolack
UPDATE catalog.variete SET
    nom_variete          = 'Gaaw Na',
    origine              = 'Ibadan, Nigeria — IITA-ISRA',
    selectionneur_principal = 'IITA-ISRA',
    pedigree             = 'Tzee white',
    nature_genetique     = 'Composite',
    annee_creation       = 1996,
    annee_homologation   = 2009,
    cycle_min            = 75,
    cycle_max            = 80,
    rendement_min        = 2.0,
    rendement_max        = 2.0,
    type_grain           = 'Corné-denté',
    vocation_culturale   = 'Culture pluviale (Fatick, Kaolack)',
    statut_variete       = 'DIFFUSEE'
WHERE code_variete = 'MAI-GAAW-NA';

-- Goor Yomboul — Composite Suwan, 90-100j, 3-4 t/ha, grain jaune-orange
UPDATE catalog.variete SET
    nom_variete          = 'Goor Yomboul',
    origine              = 'Thaïlande',
    selectionneur_principal = NULL,
    pedigree             = 'Suwan',
    nature_genetique     = 'Composite',
    annee_creation       = 1998,
    annee_homologation   = 2009,
    cycle_min            = 90,
    cycle_max            = 100,
    rendement_min        = 3.0,
    rendement_max        = 4.0,
    type_grain           = 'Corné',
    vocation_culturale   = 'Culture pluviale (Kaolack, Fatick, Sénégal oriental, Casamance)',
    statut_variete       = 'DIFFUSEE'
WHERE code_variete = 'MAI-GOOR-YOMBOUL';

-- Jaboot — Synthétique Synth 9243, 90-95j, 3-4 t/ha, grain blanc
UPDATE catalog.variete SET
    nom_variete          = 'Jaboot',
    origine              = 'Thaïlande',
    selectionneur_principal = NULL,
    pedigree             = 'Synth 9243',
    nature_genetique     = 'Synthétique',
    annee_creation       = 1997,
    annee_homologation   = 2009,
    cycle_min            = 90,
    cycle_max            = 95,
    rendement_min        = 3.0,
    rendement_max        = 4.0,
    type_grain           = 'Corné-denté',
    vocation_culturale   = 'Culture pluviale (Kaolack, Fatick, Sénégal oriental, Casamance)',
    statut_variete       = 'DIFFUSEE'
WHERE code_variete = 'MAI-JABOOT';

-- Yaayi Séex — Composite Obatampa/CRI Ghana, 95-100j, 3 t/ha, grain blanc
UPDATE catalog.variete SET
    nom_variete          = 'Yaayi Séex',
    origine              = 'Ghana — CRI',
    selectionneur_principal = 'CRI',
    pedigree             = 'Obatampa',
    nature_genetique     = 'Composite',
    annee_creation       = 1998,
    annee_homologation   = 2009,
    cycle_min            = 95,
    cycle_max            = 100,
    rendement_min        = 3.0,
    rendement_max        = 3.0,
    type_grain           = 'Corné-denté',
    vocation_culturale   = 'Culture pluviale (Kaolack, Fatick)',
    statut_variete       = 'DIFFUSEE'
WHERE code_variete = 'MAI-YAAYI-SEEX';

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 5 : Insérer les 4 nouvelles variétés officielles
-- ═══════════════════════════════════════════════════════════════════════

-- Doo Mer — Composite DMR ESR white, 80j, 2.5 t/ha, grain blanc
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, annee_homologation,
    cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'MAI-DOO-MER', 'Doo Mer', e.id,
    'Ibadan, Nigeria — IITA-ISRA',
    'IITA-ISRA', 'DMR ESR white', 'Composite',
    1996, 2009,
    80, 80, 2.5, 2.5,
    'Corné-denté',
    'Culture pluviale (Kaolack, Fatick, Sénégal oriental, Casamance)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'MAI'
ON CONFLICT (code_variete) DO NOTHING;

-- Noor 96 — Composite Early Thaï, 80j, 2-3 t/ha, irrigué + pluvial
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, annee_homologation,
    cycle_min, cycle_max, rendement_min, rendement_max,
    vocation_culturale, statut_variete)
SELECT 'MAI-NOOR96', 'Noor 96', e.id,
    'Thaïlande',
    NULL, 'Early Thaï', 'Composite',
    1990, 2009,
    80, 80, 2.0, 3.0,
    'Culture irriguée et pluviale (Vallée du Fleuve Sénégal, Kaolack, Fatick, Sénégal oriental, Casamance)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'MAI'
ON CONFLICT (code_variete) DO NOTHING;

-- Sooror — Composite Tzee Yellow, 75-80j, 2 t/ha, grain jaune
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, annee_homologation,
    cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'MAI-SOOROR', 'Sooror', e.id,
    'Ibadan, Nigeria — IITA-ISRA',
    'IITA-ISRA', 'Tzee Yellow', 'Composite',
    1996, 2009,
    75, 80, 2.0, 2.0,
    'Corné-denté',
    'Culture pluviale (Sud de Thiès, Kaolack, Fatick)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'MAI'
ON CONFLICT (code_variete) DO NOTHING;

-- Xéewel Gi — Composite Across Pool 16-DR, 75-80j, 2-3 t/ha, grain blanc
INSERT INTO catalog.variete (code_variete, nom_variete, id_espece, origine,
    selectionneur_principal, pedigree, nature_genetique,
    annee_creation, annee_homologation,
    cycle_min, cycle_max, rendement_min, rendement_max,
    type_grain, vocation_culturale, statut_variete)
SELECT 'MAI-XEEWEL-GI', 'Xéewel Gi', e.id,
    'Ibadan, Nigeria — IITA-ISRA',
    'IITA-ISRA', 'Across Pool 16-DR', 'Composite',
    1986, 2009,
    75, 80, 2.0, 3.0,
    'Corné-denté',
    'Culture pluviale (Sud de Thiès, Kaolack, Fatick)',
    'DIFFUSEE'
FROM catalog.espece e WHERE e.code_espece = 'MAI'
ON CONFLICT (code_variete) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════
-- ÉTAPE 6 : Reconstruire les associations variete_zone pour MAI
--           (suppression propre des anciennes, réinsertion complète)
-- ═══════════════════════════════════════════════════════════════════════

DELETE FROM catalog.variete_zone
WHERE id_variete IN (
    SELECT id FROM catalog.variete v
    WHERE v.id_espece = (SELECT id FROM catalog.espece WHERE code_espece = 'MAI')
);

-- ── Doo Mer : BA (optimal), SO + Casamance (acceptable) ──────────────
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL'    FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MAI-DOO-MER'   AND z.code = 'BA'  ON CONFLICT DO NOTHING;
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'ACCEPTABLE' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MAI-DOO-MER'   AND z.code IN ('SO','HC','MC','BC') ON CONFLICT DO NOTHING;

-- ── Gaaw Na : BA (optimal) ───────────────────────────────────────────
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL'    FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MAI-GAAW-NA'   AND z.code = 'BA'  ON CONFLICT DO NOTHING;

-- ── Goor Yomboul : BA (optimal), SO + Casamance (optimal) ────────────
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL'    FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MAI-GOOR-YOMBOUL' AND z.code IN ('BA','SO','HC','MC','BC') ON CONFLICT DO NOTHING;

-- ── Jaboot : BA (optimal), SO + Casamance (optimal) ─────────────────
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL'    FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MAI-JABOOT'    AND z.code IN ('BA','SO','HC','MC','BC') ON CONFLICT DO NOTHING;

-- ── Noor 96 : VF (optimal), BA (optimal), SO + Casamance (acceptable) ─
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL'    FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MAI-NOOR96'    AND z.code IN ('VF','BA') ON CONFLICT DO NOTHING;
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'ACCEPTABLE' FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MAI-NOOR96'    AND z.code IN ('SO','HC','MC','BC') ON CONFLICT DO NOTHING;

-- ── Sooror : NAY (optimal), BA (optimal) ─────────────────────────────
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL'    FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MAI-SOOROR'    AND z.code IN ('NAY','BA') ON CONFLICT DO NOTHING;

-- ── Xéewel Gi : NAY (optimal), BA (optimal) ──────────────────────────
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL'    FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MAI-XEEWEL-GI' AND z.code IN ('NAY','BA') ON CONFLICT DO NOTHING;

-- ── Yaayi Séex : BA (optimal) ────────────────────────────────────────
INSERT INTO catalog.variete_zone (id_variete, id_zone, niveau_adaptation)
SELECT v.id, z.id, 'OPTIMAL'    FROM catalog.variete v, geo.zone_agro z
WHERE v.code_variete = 'MAI-YAAYI-SEEX' AND z.code = 'BA' ON CONFLICT DO NOTHING;
