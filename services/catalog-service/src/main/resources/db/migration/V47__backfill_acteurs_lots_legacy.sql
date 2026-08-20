-- ─────────────────────────────────────────────────────────────────────────────
-- V47 : Backfill traçabilité acteurs pour les lots legacy
--
-- Les lots créés par migration SQL (données initiales) n'ont pas de JWT,
-- donc responsable_nom / responsable_role / id_org_producteur sont NULL.
-- Cette migration les remplit selon les règles métier de la filière semencière.
--
-- Priorité des règles (ordre d'exécution) :
--   1. Lots avec id_org_producteur déjà renseigné → nom depuis shared.organisation
--   2. G0      → ISRA CNRA Bambey   (sélectionneur)
--   3. G1, G2  → UPSemCL Bambey     (multiplication intermédiaire)
--   4. G3      → UPSemCL ou Multiplicateur selon username_createur
--   5. G4, R1, R2 → Coopérative Sine-Saloum (multiplicateur commercial)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Lots avec id_org_producteur renseigné mais sans responsable_nom
--    → on résout le nom depuis shared.organisation
UPDATE lot.lot_semencier l
SET responsable_nom  = o.nom_organisation,
    responsable_role = CASE o.type_organisation
                         WHEN 'ISRA'          THEN 'seed-selector'
                         WHEN 'UPSEMCL'       THEN 'seed-upsemcl'
                         WHEN 'MULTIPLICATEUR' THEN 'seed-multiplicator'
                         ELSE l.responsable_role
                       END
FROM shared.organisation o
WHERE l.id_org_producteur = o.id
  AND (l.responsable_nom IS NULL OR l.responsable_nom = '');

-- 2. G0 encore sans acteur → ISRA CNRA Bambey (sélectionneur)
UPDATE lot.lot_semencier l
SET responsable_nom   = 'ISRA CNRA Bambey',
    responsable_role  = 'seed-selector',
    id_org_producteur = 1
FROM lot.generation_semence g
WHERE l.id_generation = g.id
  AND g.code_generation = 'G0'
  AND (l.responsable_nom IS NULL OR l.responsable_nom = '');

-- 3. G1, G2 encore sans acteur → UPSemCL Bambey
UPDATE lot.lot_semencier l
SET responsable_nom   = 'UPSemCL Bambey',
    responsable_role  = 'seed-upsemcl',
    id_org_producteur = 2
FROM lot.generation_semence g
WHERE l.id_generation = g.id
  AND g.code_generation IN ('G1', 'G2')
  AND (l.responsable_nom IS NULL OR l.responsable_nom = '');

-- 4a. G3 créé par un multiplicateur (selon username_createur) → Coopérative Sine-Saloum
UPDATE lot.lot_semencier l
SET responsable_nom   = 'Coopérative Sine-Saloum Semences',
    responsable_role  = 'seed-multiplicator',
    id_org_producteur = 4
FROM lot.generation_semence g
WHERE l.id_generation = g.id
  AND g.code_generation = 'G3'
  AND l.username_createur ILIKE '%multiplicat%'
  AND (l.responsable_nom IS NULL OR l.responsable_nom = '');

-- 4b. G3 restant sans acteur → UPSemCL Bambey (production G3 par UPSemCL avant transfert)
UPDATE lot.lot_semencier l
SET responsable_nom   = 'UPSemCL Bambey',
    responsable_role  = 'seed-upsemcl',
    id_org_producteur = 2
FROM lot.generation_semence g
WHERE l.id_generation = g.id
  AND g.code_generation = 'G3'
  AND (l.responsable_nom IS NULL OR l.responsable_nom = '');

-- 5. G4, R1, R2 encore sans acteur → Coopérative Sine-Saloum Semences (multiplicateur)
UPDATE lot.lot_semencier l
SET responsable_nom   = 'Coopérative Sine-Saloum Semences',
    responsable_role  = 'seed-multiplicator',
    id_org_producteur = 4
FROM lot.generation_semence g
WHERE l.id_generation = g.id
  AND g.code_generation IN ('G4', 'R1', 'R2')
  AND (l.responsable_nom IS NULL OR l.responsable_nom = '');
