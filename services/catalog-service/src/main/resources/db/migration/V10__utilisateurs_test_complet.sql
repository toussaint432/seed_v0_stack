-- ============================================================
-- V10__utilisateurs_test_complet.sql
-- Complément acteurs : UPSemCL Saint-Louis, Multiplicateurs,
-- Organisations Professionnelles (OP) quotataires par zone.
-- Membres alignés sur les comptes Keycloak seed-v0 (V10 realm).
-- ============================================================

-- ── 1. NOUVELLES ORGANISATIONS ───────────────────────────────

INSERT INTO organisation (code_organisation, nom_organisation, type_organisation, region, localite, contact, active)
VALUES
  ('UPSEMCL-STLOUIS',  'UPSemCL Saint-Louis',              'UPSEMCL',       'Saint-Louis', 'Saint-Louis', 'upsemcl.sl@isra.sn',    true),
  ('MULTI-DIOURBEL',   'Coopérative Semencière Diourbel',  'MULTIPLICATEUR', 'Diourbel',   'Diourbel',   'coopsem@diourbel.sn',   true),
  ('OP-NORD',          'Organisation Paysanne Nord',        'AUTRE',          'Saint-Louis', 'Saint-Louis', 'op.nord@agri.sn',       true),
  ('OP-CENTRE',        'Organisation Paysanne Centre',      'AUTRE',          'Kaolack',    'Kaolack',    'op.centre@agri.sn',     true),
  ('OP-CASAMANCE',     'Organisation Paysanne Casamance',  'AUTRE',          'Ziguinchor', 'Ziguinchor', 'op.casamance@agri.sn',  true)
ON CONFLICT (code_organisation) DO NOTHING;

-- ── 2. SITES RATTACHÉS AUX NOUVELLES ORGANISATIONS ───────────

UPDATE site SET id_organisation = (SELECT id FROM organisation WHERE code_organisation = 'UPSEMCL-STLOUIS')
WHERE code_site = 'MAG-STLOUIS';

-- ── 3. NOUVEAUX MEMBRES KEYCLOAK ─────────────────────────────

-- upsemcl_bambey : existe déjà en DB V5, aucune action nécessaire

-- upsemcl_stlouis → UPSemCL Saint-Louis
INSERT INTO membre_organisation (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
SELECT 'upsemcl_stlouis', 'seed-upsemcl', 'Rokhaya UPSemCL Saint-Louis', o.id, 'RESPONSABLE', true
FROM organisation o WHERE o.code_organisation = 'UPSEMCL-STLOUIS'
ON CONFLICT (keycloak_username) DO NOTHING;

-- selecteur_sor → ISRA-CNRA, spécialisation Sorgho
INSERT INTO membre_organisation (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
SELECT 'selecteur_sor', 'seed-selector', 'Babacar Sélect-SOR', o.id, 'RESPONSABLE', true
FROM organisation o WHERE o.code_organisation = 'ISRA-CNRA'
ON CONFLICT (keycloak_username) DO NOTHING;

-- selecteur_nie → ISRA-CNRA, spécialisation Niébé
INSERT INTO membre_organisation (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
SELECT 'selecteur_nie', 'seed-selector', 'Mariama Sélect-NIE', o.id, 'RESPONSABLE', true
FROM organisation o WHERE o.code_organisation = 'ISRA-CNRA'
ON CONFLICT (keycloak_username) DO NOTHING;

-- multi_fatick → Coopérative Sine-Saloum (MULTI-SINSALOU déjà en V5)
INSERT INTO membre_organisation (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
SELECT 'multi_fatick', 'seed-multiplicator', 'Ibrahima Multi-Fatick', o.id, 'RESPONSABLE', true
FROM organisation o WHERE o.code_organisation = 'MULTI-SINSALOU'
ON CONFLICT (keycloak_username) DO NOTHING;

-- quotataire_nord → OP Nord (Saint-Louis)
INSERT INTO membre_organisation (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
SELECT 'quotataire_nord', 'seed-quotataire', 'Ndéye OP-Nord', o.id, 'RESPONSABLE', true
FROM organisation o WHERE o.code_organisation = 'OP-NORD'
ON CONFLICT (keycloak_username) DO NOTHING;

-- quotataire_centre → OP Centre (Kaolack)
INSERT INTO membre_organisation (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
SELECT 'quotataire_centre', 'seed-quotataire', 'Moussa OP-Centre', o.id, 'RESPONSABLE', true
FROM organisation o WHERE o.code_organisation = 'OP-CENTRE'
ON CONFLICT (keycloak_username) DO NOTHING;

-- quotataire_casamance → OP Casamance
INSERT INTO membre_organisation (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
SELECT 'quotataire_casamance', 'seed-quotataire', 'Fatoumata OP-Casamance', o.id, 'RESPONSABLE', true
FROM organisation o WHERE o.code_organisation = 'OP-CASAMANCE'
ON CONFLICT (keycloak_username) DO NOTHING;

-- ── 4. COMMANDES DE TEST PAR ZONE ────────────────────────────
-- Commandes representant les besoins des OP par zone et espèce

INSERT INTO commande (code_commande, client, statut, username_acheteur,
                      id_organisation_acheteur, id_organisation_fournisseur,
                      observations, created_at)
SELECT
  'CMD-2026-NORD-001',
  'Organisation Paysanne Nord',
  'SOUMISE',
  'quotataire_nord',
  (SELECT id FROM organisation WHERE code_organisation = 'OP-NORD'),
  (SELECT id FROM organisation WHERE code_organisation = 'UPSEMCL-STLOUIS'),
  'Besoin en riz irrigué — vallée du fleuve, campagne hivernage 2026',
  NOW()
WHERE EXISTS (SELECT 1 FROM organisation WHERE code_organisation = 'OP-NORD')
  AND EXISTS (SELECT 1 FROM organisation WHERE code_organisation = 'UPSEMCL-STLOUIS')
  AND NOT EXISTS (SELECT 1 FROM commande WHERE code_commande = 'CMD-2026-NORD-001');

INSERT INTO commande (code_commande, client, statut, username_acheteur,
                      id_organisation_acheteur, id_organisation_fournisseur,
                      observations, created_at)
SELECT
  'CMD-2026-CENTRE-001',
  'Organisation Paysanne Centre',
  'SOUMISE',
  'quotataire_centre',
  (SELECT id FROM organisation WHERE code_organisation = 'OP-CENTRE'),
  (SELECT id FROM organisation WHERE code_organisation = 'UPSEMCL-BAMBEY'),
  'Besoin en arachide R2 — bassin arachidier, campagne 2026',
  NOW()
WHERE EXISTS (SELECT 1 FROM organisation WHERE code_organisation = 'OP-CENTRE')
  AND EXISTS (SELECT 1 FROM organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
  AND NOT EXISTS (SELECT 1 FROM commande WHERE code_commande = 'CMD-2026-CENTRE-001');

INSERT INTO commande (code_commande, client, statut, username_acheteur,
                      id_organisation_acheteur, id_organisation_fournisseur,
                      observations, created_at)
SELECT
  'CMD-2026-CAS-001',
  'Organisation Paysanne Casamance',
  'SOUMISE',
  'quotataire_casamance',
  (SELECT id FROM organisation WHERE code_organisation = 'OP-CASAMANCE'),
  (SELECT id FROM organisation WHERE code_organisation = 'MULTI-SINSALOU'),
  'Besoin en niébé R2 — Casamance, campagne hivernage 2026',
  NOW()
WHERE EXISTS (SELECT 1 FROM organisation WHERE code_organisation = 'OP-CASAMANCE')
  AND EXISTS (SELECT 1 FROM organisation WHERE code_organisation = 'MULTI-SINSALOU')
  AND NOT EXISTS (SELECT 1 FROM commande WHERE code_commande = 'CMD-2026-CAS-001');

-- ── 5. LIGNES DE COMMANDE ─────────────────────────────────────

-- Ligne pour CMD-2026-NORD-001 (RIZ R2)
INSERT INTO ligne_commande (id_commande, id_variete, id_generation, quantite_demandee, unite)
SELECT
  c.id,
  v.id,
  g.id,
  5000.00,
  'kg'
FROM commande c, variete v, generation_semence g
WHERE c.code_commande = 'CMD-2026-NORD-001'
  AND v.code_variete  = 'RIZ-SAHEL108'
  AND g.code_generation = 'R2'
  AND NOT EXISTS (
    SELECT 1 FROM ligne_commande lc WHERE lc.id_commande = c.id
  );

-- Ligne pour CMD-2026-CENTRE-001 (ARA R2)
INSERT INTO ligne_commande (id_commande, id_variete, id_generation, quantite_demandee, unite)
SELECT
  c.id,
  v.id,
  g.id,
  10000.00,
  'kg'
FROM commande c, variete v, generation_semence g
WHERE c.code_commande = 'CMD-2026-CENTRE-001'
  AND v.code_variete  = 'ARA-FLEUR11'
  AND g.code_generation = 'R2'
  AND NOT EXISTS (
    SELECT 1 FROM ligne_commande lc WHERE lc.id_commande = c.id
  );

-- Ligne pour CMD-2026-CAS-001 (NIE R2)
INSERT INTO ligne_commande (id_commande, id_variete, id_generation, quantite_demandee, unite)
SELECT
  c.id,
  v.id,
  g.id,
  3000.00,
  'kg'
FROM commande c, variete v, generation_semence g
WHERE c.code_commande = 'CMD-2026-CAS-001'
  AND v.code_variete  = 'NIE-MELAKH'
  AND g.code_generation = 'R2'
  AND NOT EXISTS (
    SELECT 1 FROM ligne_commande lc WHERE lc.id_commande = c.id
  );
