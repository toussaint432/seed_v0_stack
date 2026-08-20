-- ─────────────────────────────────────────────────────────────────────────────
-- V52 : Isolation de `multiplicateur` — organisation propre, séparée de multi_fatick
--
-- Problème : multiplicateur et multi_fatick partagent l'organisation 4 (Sine-Saloum).
-- Filtre idOrgProducteur=4 → les deux utilisateurs voient les mêmes lots et le même stock.
--
-- Correction :
--   1. Créer une nouvelle organisation pour multiplicateur (Kaolack)
--   2. Rattacher multiplicateur à cette organisation
--   3. Déplacer FERME-MULTI-02 (site du multiplicateur) dans la nouvelle org
--   4. Corriger FERME-MULTI-03 (site de multi_fatick) : passe en principal
--   5. Mettre à jour les lots créés par multiplicateur (id_org_producteur 4 → nouvelle org)
--   6. Les lots de seed data sans username_createur restent dans l'org 4 (multi_fatick)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Nouvelle organisation pour multiplicateur (Kaolack, indépendante)
INSERT INTO shared.organisation (
    code_organisation, nom_organisation, type_organisation,
    region, localite, departement, active
)
VALUES (
    'MULTI-KAOLACK-02',
    'Multiplicateur Semencier Kaolack II',
    'MULTIPLICATEUR',
    'Kaolack', 'Kaolack', 'Kaolack',
    true
)
ON CONFLICT (code_organisation) DO NOTHING;

-- 2. Rattacher multiplicateur à la nouvelle organisation
UPDATE shared.membre_organisation
SET id_organisation = (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-KAOLACK-02'),
    principal       = true
WHERE keycloak_username = 'multiplicateur';

-- 3. Déplacer FERME-MULTI-02 vers la nouvelle organisation
UPDATE stock.site
SET id_organisation = (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-KAOLACK-02')
WHERE code_site = 'FERME-MULTI-02';

-- 4. FERME-MULTI-03 devient le site principal de multi_fatick dans org 4
UPDATE stock.site
SET est_principal = true
WHERE code_site = 'FERME-MULTI-03';

-- 5. Mettre à jour les lots du multiplicateur (tous créés par lui → nouvelle org)
UPDATE lot.lot_semencier
SET id_org_producteur = (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-KAOLACK-02')
WHERE username_createur = 'multiplicateur'
  AND id_org_producteur = 4;

-- Les lots sans username_createur (R1/R2 seed data, ids 18-25) conservent id_org_producteur=4
-- et restent visibles par multi_fatick uniquement.
