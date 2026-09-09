-- V74 : Passer de l'unicité globale du code à l'unicité par organisation
--       (multi-tenant : chaque org gère son propre espace de nommage)

-- 1. Backfill id_organisation pour les programmes dont le créateur est connu
UPDATE lot.programme_multiplication pm
SET    id_organisation = (
           SELECT mo.id_organisation
           FROM   shared.membre_organisation mo
           WHERE  mo.keycloak_username = pm.username_createur
           LIMIT  1
       )
WHERE  pm.id_organisation IS NULL
  AND  pm.username_createur IS NOT NULL;

-- 2. lot_semencier : remplacer UNIQUE(code_lot) par UNIQUE(id_org_producteur, code_lot)
ALTER TABLE lot.lot_semencier DROP CONSTRAINT IF EXISTS lot_semencier_code_lot_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lot_org_code
    ON lot.lot_semencier (id_org_producteur, code_lot);

-- 3. programme_multiplication : remplacer UNIQUE(code_programme) par UNIQUE(id_organisation, code_programme)
ALTER TABLE lot.programme_multiplication DROP CONSTRAINT IF EXISTS programme_multiplication_code_programme_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_prog_org_code
    ON lot.programme_multiplication (id_organisation, code_programme);
