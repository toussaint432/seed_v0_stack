-- ─────────────────────────────────────────────────────────────────────────────
-- V50 : Isolation des données — création d'une organisation distincte
--       pour multiplicateur_kaolack
--
-- Problème : multiplicateur_kaolack, multiplicateur et multi_fatick étaient
-- tous rattachés à l'organisation id=4 (Coopérative Sine-Saloum Semences).
-- Résultat : les trois utilisateurs voyaient les mêmes lots, le même stock
-- et les mêmes commandes (filtre idOrgProducteur = 4 pour tous).
--
-- Correction :
--   1. Créer une nouvelle organisation pour multiplicateur_kaolack (Kaolack)
--   2. Rattacher multiplicateur_kaolack à cette organisation (principal=true)
--   3. Créer son site de stockage / multiplication (FERME-MULTI-KAOLACK)
--   4. Corriger le doublon principal=true dans org 4 (seul multi_fatick reste principal)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Nouvelle organisation — Coopérative Kaolack
INSERT INTO shared.organisation (code_organisation, nom_organisation, type_organisation, region, localite, departement, active)
VALUES (
    'MULTI-KAOLACK',
    'Coopérative Semencière de Kaolack',
    'MULTIPLICATEUR',
    'Kaolack',
    'Kaolack',
    'Kaolack',
    true
) ON CONFLICT (code_organisation) DO NOTHING;

-- 2. Rattacher multiplicateur_kaolack à sa nouvelle organisation
UPDATE shared.membre_organisation
SET id_organisation = (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-KAOLACK'),
    principal       = true
WHERE keycloak_username = 'multiplicateur_kaolack';

-- 3. Site de stockage / multiplication pour multiplicateur_kaolack
INSERT INTO stock.site (code_site, nom_site, type_site, localite, region, departement, est_principal, id_organisation, id_membre)
VALUES (
    'FERME-MULTI-KAOLACK',
    'Ferme Semencière Kaolack',
    'FERME',
    'Kaolack',
    'Kaolack',
    'Kaolack',
    true,
    (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-KAOLACK'),
    (SELECT id FROM shared.membre_organisation WHERE keycloak_username = 'multiplicateur_kaolack')
) ON CONFLICT (code_site) DO NOTHING;

-- 4. Corriger le doublon principal=true dans org 4
-- multi_fatick (FERME-MULTI-03, Sine-Saloum) est le représentant principal de l'org 4
-- multiplicateur passe en membre secondaire (il a un site propre FERME-MULTI-02)
UPDATE shared.membre_organisation
SET principal = false
WHERE keycloak_username = 'multiplicateur'
  AND id_organisation   = (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-SINSALOU');
