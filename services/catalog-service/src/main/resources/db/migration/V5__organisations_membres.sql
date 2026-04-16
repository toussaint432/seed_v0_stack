-- ============================================================
-- V5__organisations_membres.sql
-- Organisations ISRA/CNRA et membres alignés sur les
-- comptes Keycloak réels de la plateforme seed-v0
-- ============================================================

-- ── ORGANISATIONS ─────────────────────────────────────────────

INSERT INTO organisation (code_organisation, nom_organisation, type_organisation, region, localite, contact, active)
VALUES
  ('ISRA-CNRA',     'ISRA CNRA Bambey',              'ISRA',          'Diourbel',  'Bambey',   'cnra@isra.sn',       true),
  ('UPSEMCL-BAMBEY','UPSemCL Bambey',                'UPSEMCL',       'Diourbel',  'Bambey',   'upsemcl@isra.sn',    true),
  ('UPSEMCL-NAT',   'UPSemCL National — Dakar',      'UPSEMCL',       'Dakar',     'Dakar',    'upsemcl@isra.sn',    true),
  ('MULTI-SINSALOU','Coopérative Sine-Saloum Semences','MULTIPLICATEUR','Fatick',   'Kaolack',  'sinsalou@seed.sn',   true)
ON CONFLICT (code_organisation) DO NOTHING;

-- ── MEMBRES (alignés sur les comptes Keycloak seed-v0) ────────
-- keycloak_role doit correspondre aux rôles Keycloak :
--   seed-selector     → Sélectionneur ISRA/CNRA
--   seed-upsemcl      → Agent UPSemCL
--   seed-multiplicator→ Multiplicateur agréé

INSERT INTO membre_organisation
  (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
SELECT
  'selecteur_ara', 'seed-selector', 'Sélectionneur Arachide', o.id, 'RESPONSABLE', true
FROM organisation o WHERE o.code_organisation = 'ISRA-CNRA'
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO membre_organisation
  (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
SELECT
  'selecteur_mil', 'seed-selector', 'Sélectionneur Mil', o.id, 'RESPONSABLE', true
FROM organisation o WHERE o.code_organisation = 'ISRA-CNRA'
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO membre_organisation
  (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
SELECT
  'selecteur', 'seed-selector', 'Sélectionneur Généraliste', o.id, 'MEMBRE', false
FROM organisation o WHERE o.code_organisation = 'ISRA-CNRA'
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO membre_organisation
  (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
SELECT
  'upsemcl_bambey', 'seed-upsemcl', 'Agent UPSemCL Bambey', o.id, 'RESPONSABLE', true
FROM organisation o WHERE o.code_organisation = 'UPSEMCL-BAMBEY'
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO membre_organisation
  (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
SELECT
  'upsemcl', 'seed-upsemcl', 'Agent UPSemCL National', o.id, 'MEMBRE', false
FROM organisation o WHERE o.code_organisation = 'UPSEMCL-NAT'
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO membre_organisation
  (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal)
SELECT
  'multiplicateur', 'seed-multiplicator', 'Multiplicateur Agréé', o.id, 'RESPONSABLE', true
FROM organisation o WHERE o.code_organisation = 'MULTI-SINSALOU'
ON CONFLICT (keycloak_username) DO NOTHING;

-- ── SITES manquants (non présents dans V2) ────────────────────

INSERT INTO site (code_site, nom_site, type_site, localite, region) VALUES
  ('CNRA-BAMBEY',    'CNRA Bambey',                    'STATION_RECHERCHE',  'Bambey',    'Diourbel'),
  ('ISRA-KAOLACK',   'Station ISRA Kaolack',           'STATION_RECHERCHE',  'Kaolack',   'Kaolack'),
  ('MAG-STLOUIS',    'Magasin Saint-Louis',            'MAGASIN',            'Saint-Louis','Saint-Louis'),
  ('FERME-MULTI-03', 'Ferme multiplicatrice Fatick',   'FERME',              'Fatick',    'Fatick')
ON CONFLICT (code_site) DO NOTHING;

-- ── SITES rattachés aux organisations ─────────────────────────

UPDATE site SET id_organisation = (SELECT id FROM organisation WHERE code_organisation = 'ISRA-CNRA')
WHERE code_site IN ('CNRA-BAMBEY', 'FERME-MULTI-01', 'ISRA-KAOLACK', 'LAB-THIES');

UPDATE site SET id_organisation = (SELECT id FROM organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
WHERE code_site IN ('MAG-THIES', 'MAG-KAOLACK');

UPDATE site SET id_organisation = (SELECT id FROM organisation WHERE code_organisation = 'UPSEMCL-NAT')
WHERE code_site IN ('MAG-STLOUIS');

UPDATE site SET id_organisation = (SELECT id FROM organisation WHERE code_organisation = 'MULTI-SINSALOU')
WHERE code_site IN ('FERME-MULTI-02', 'FERME-MULTI-03');
