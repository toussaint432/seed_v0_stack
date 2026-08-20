-- ============================================================
-- V63 : Sélectionneurs dédiés + chaînes G0→R1 complètes
--       pour les 9 espèces de la plateforme Sen Jiw
--
-- Sélectionneurs ajoutés : RIZ, MAI, FON, SES, BLE
-- Spécialisations déclarées sur tous les sélectionneurs
-- Chaînes G0→G1→G2→G3→R1 créées pour :
--   RIZ (Sahel 108), MAI (Jaboot), FON (Fofana), SES (ISRA 1),
--   BLE (Pendao), NIE (Melakh), SOR (CE145)
-- ARA (V8) et MIL (V8) déjà complets — non dupliqués
-- ============================================================

-- ── 0. Sélectionneurs manquants ─────────────────────────────

INSERT INTO shared.membre_organisation
  (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal, specialisation)
SELECT 'selecteur_riz', 'seed-selector', 'Oumar Sèye — Sélectionneur Riz',
  o.id, 'RESPONSABLE', true, 'RIZ'
FROM shared.organisation o WHERE o.code_organisation = 'ISRA-CNRA'
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO shared.membre_organisation
  (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal, specialisation)
SELECT 'selecteur_mai', 'seed-selector', 'Adja Ndiaye — Sélectionneur Maïs',
  o.id, 'RESPONSABLE', true, 'MAI'
FROM shared.organisation o WHERE o.code_organisation = 'ISRA-CNRA'
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO shared.membre_organisation
  (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal, specialisation)
SELECT 'selecteur_fon', 'seed-selector', 'Coumba Badji — Sélectionneur Fonio',
  o.id, 'RESPONSABLE', true, 'FON'
FROM shared.organisation o WHERE o.code_organisation = 'ISRA-CNRA'
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO shared.membre_organisation
  (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal, specialisation)
SELECT 'selecteur_ses', 'seed-selector', 'Rokhaya Mbaye — Sélectionneur Sésame',
  o.id, 'RESPONSABLE', true, 'SES'
FROM shared.organisation o WHERE o.code_organisation = 'ISRA-CNRA'
ON CONFLICT (keycloak_username) DO NOTHING;

INSERT INTO shared.membre_organisation
  (keycloak_username, keycloak_role, nom_complet, id_organisation, role_dans_org, principal, specialisation)
SELECT 'selecteur_ble', 'seed-selector', 'Mamadou Traoré — Sélectionneur Blé',
  o.id, 'RESPONSABLE', true, 'BLE'
FROM shared.organisation o WHERE o.code_organisation = 'ISRA-CNRA'
ON CONFLICT (keycloak_username) DO NOTHING;

-- ── 1. Spécialisations des sélectionneurs existants ─────────

UPDATE shared.membre_organisation SET specialisation = 'ARA'
WHERE keycloak_username = 'selecteur_ara' AND (specialisation IS NULL OR specialisation = '');

UPDATE shared.membre_organisation SET specialisation = 'MIL'
WHERE keycloak_username = 'selecteur_mil' AND (specialisation IS NULL OR specialisation = '');

UPDATE shared.membre_organisation SET specialisation = 'NIE'
WHERE keycloak_username = 'selecteur_nie' AND (specialisation IS NULL OR specialisation = '');

UPDATE shared.membre_organisation SET specialisation = 'SOR'
WHERE keycloak_username = 'selecteur_sor' AND (specialisation IS NULL OR specialisation = '');

-- ════════════════════════════════════════════════════════════
-- 2. CHAÎNE RIZ — RIZ-SAHEL108 (Sahel 108, riz irrigué VF)
--    Acteurs : selecteur_riz → upsemcl_stlouis → multi_vf_stlouis
-- ════════════════════════════════════════════════════════════

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G0-RIZ-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'RIZ-SAHEL108'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G0'),
  NULL, '2026', '2026-01-10', 50.00, 'kg', 97.5, 99.5,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'RIZ', 'selecteur_riz',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'ISRA-CNRA')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G1-RIZ-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'RIZ-SAHEL108'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G1'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G0-RIZ-2026-001'),
  '2026', '2026-03-20', 420.00, 'kg', 95.5, 99.0,
  'TRANSFERE', 'SANS_CERTIFICAT', 'RIZ', 'upsemcl_stlouis',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-STLOUIS')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G2-RIZ-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'RIZ-SAHEL108'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G2'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G1-RIZ-2026-001'),
  '2026', '2026-05-25', 3800.00, 'kg', 94.0, 98.5,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'RIZ', 'upsemcl_stlouis',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-STLOUIS')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G3-RIZ-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'RIZ-SAHEL108'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G3'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G2-RIZ-2026-001'),
  '2026', '2026-07-18', 21000.00, 'kg', 92.0, 97.5,
  'TRANSFERE', 'SANS_CERTIFICAT', 'RIZ', 'upsemcl_stlouis',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-STLOUIS')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-R1-RIZ-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'RIZ-SAHEL108'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'R1'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G3-RIZ-2026-001'),
  '2026', '2026-09-30', 95000.00, 'kg', 90.0, 96.5,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'RIZ', 'multi_vf_stlouis',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-VF-01')
) ON CONFLICT (code_lot) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- 3. CHAÎNE MAÏS — MAI-JABOOT (Jaboot, composite ISRA)
--    Acteurs : selecteur_mai → upsemcl_bambey → multi_so_tambacounda
-- ════════════════════════════════════════════════════════════

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G0-MAI-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'MAI-JABOOT'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G0'),
  NULL, '2026', '2026-01-20', 50.00, 'kg', 97.0, 99.5,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'MAI', 'selecteur_mai',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'ISRA-CNRA')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G1-MAI-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'MAI-JABOOT'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G1'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G0-MAI-2026-001'),
  '2026', '2026-04-05', 480.00, 'kg', 95.0, 98.8,
  'TRANSFERE', 'SANS_CERTIFICAT', 'MAI', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G2-MAI-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'MAI-JABOOT'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G2'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G1-MAI-2026-001'),
  '2026', '2026-06-12', 4200.00, 'kg', 93.5, 98.0,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'MAI', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G3-MAI-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'MAI-JABOOT'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G3'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G2-MAI-2026-001'),
  '2026', '2026-08-20', 19500.00, 'kg', 91.5, 97.0,
  'TRANSFERE', 'SANS_CERTIFICAT', 'MAI', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-R1-MAI-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'MAI-JABOOT'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'R1'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G3-MAI-2026-001'),
  '2026', '2026-10-28', 110000.00, 'kg', 89.0, 96.0,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'MAI', 'multi_so_tambacounda',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-SO-01')
) ON CONFLICT (code_lot) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- 4. CHAÎNE FONIO — FON-FOFANA (Fofana, fonio blanc Casamance)
--    Acteurs : selecteur_fon → upsemcl_bambey → multi_hc_kolda
-- ════════════════════════════════════════════════════════════

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G0-FON-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'FON-FOFANA'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G0'),
  NULL, '2026', '2026-02-05', 50.00, 'kg', 96.5, 99.0,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'FON', 'selecteur_fon',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'ISRA-CNRA')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G1-FON-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'FON-FOFANA'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G1'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G0-FON-2026-001'),
  '2026', '2026-04-18', 350.00, 'kg', 94.5, 98.5,
  'TRANSFERE', 'SANS_CERTIFICAT', 'FON', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G2-FON-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'FON-FOFANA'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G2'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G1-FON-2026-001'),
  '2026', '2026-06-22', 2800.00, 'kg', 93.0, 98.0,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'FON', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G3-FON-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'FON-FOFANA'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G3'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G2-FON-2026-001'),
  '2026', '2026-08-15', 14000.00, 'kg', 91.0, 97.0,
  'TRANSFERE', 'SANS_CERTIFICAT', 'FON', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-R1-FON-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'FON-FOFANA'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'R1'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G3-FON-2026-001'),
  '2026', '2026-10-10', 62000.00, 'kg', 88.5, 95.5,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'FON', 'multi_hc_kolda',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-HC-01')
) ON CONFLICT (code_lot) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- 5. CHAÎNE SÉSAME — SES-ISRA1 (ISRA 1, sésame blanc ISRA)
--    Acteurs : selecteur_ses → upsemcl_bambey → multi_nay_thies
-- ════════════════════════════════════════════════════════════

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G0-SES-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'SES-ISRITA'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G0'),
  NULL, '2026', '2026-01-25', 50.00, 'kg', 96.0, 99.2,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'SES', 'selecteur_ses',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'ISRA-CNRA')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G1-SES-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'SES-ISRITA'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G1'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G0-SES-2026-001'),
  '2026', '2026-03-28', 310.00, 'kg', 94.0, 98.5,
  'TRANSFERE', 'SANS_CERTIFICAT', 'SES', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G2-SES-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'SES-ISRITA'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G2'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G1-SES-2026-001'),
  '2026', '2026-05-30', 2600.00, 'kg', 92.5, 97.8,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'SES', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G3-SES-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'SES-ISRITA'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G3'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G2-SES-2026-001'),
  '2026', '2026-07-28', 13500.00, 'kg', 90.5, 97.0,
  'TRANSFERE', 'SANS_CERTIFICAT', 'SES', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-R1-SES-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'SES-ISRITA'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'R1'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G3-SES-2026-001'),
  '2026', '2026-09-22', 58000.00, 'kg', 88.0, 95.5,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'SES', 'multi_nay_thies',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-NAY-01')
) ON CONFLICT (code_lot) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- 6. CHAÎNE BLÉ — BLE-PENDAO (Pendao, blé tendre ISRA irrigué)
--    Acteurs : selecteur_ble → upsemcl_stlouis → multi_vf_stlouis
-- ════════════════════════════════════════════════════════════

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G0-BLE-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'BLE-PENDAO'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G0'),
  NULL, '2026', '2025-11-12', 50.00, 'kg', 97.0, 99.3,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'BLE', 'selecteur_ble',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'ISRA-CNRA')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G1-BLE-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'BLE-PENDAO'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G1'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G0-BLE-2026-001'),
  '2026', '2026-01-22', 390.00, 'kg', 95.0, 98.8,
  'TRANSFERE', 'SANS_CERTIFICAT', 'BLE', 'upsemcl_stlouis',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-STLOUIS')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G2-BLE-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'BLE-PENDAO'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G2'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G1-BLE-2026-001'),
  '2026', '2026-03-10', 3500.00, 'kg', 93.5, 98.2,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'BLE', 'upsemcl_stlouis',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-STLOUIS')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G3-BLE-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'BLE-PENDAO'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G3'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G2-BLE-2026-001'),
  '2026', '2026-04-30', 17500.00, 'kg', 91.5, 97.3,
  'TRANSFERE', 'SANS_CERTIFICAT', 'BLE', 'upsemcl_stlouis',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-STLOUIS')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-R1-BLE-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'BLE-PENDAO'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'R1'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G3-BLE-2026-001'),
  '2026', '2026-06-20', 78000.00, 'kg', 89.5, 96.0,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'BLE', 'multi_vf_stlouis',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-VF-01')
) ON CONFLICT (code_lot) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- 7. CHAÎNE NIÉBÉ — NIE-MELAKH (Melakh, niébé précoce ISRA)
--    Acteurs : selecteur_nie → upsemcl_bambey → multi_fatick
-- ════════════════════════════════════════════════════════════

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G0-NIE-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'NIE-MELAKH'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G0'),
  NULL, '2026', '2026-02-12', 50.00, 'kg', 97.0, 99.4,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'NIE', 'selecteur_nie',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'ISRA-CNRA')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G1-NIE-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'NIE-MELAKH'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G1'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G0-NIE-2026-001'),
  '2026', '2026-04-10', 440.00, 'kg', 95.0, 99.0,
  'TRANSFERE', 'SANS_CERTIFICAT', 'NIE', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G2-NIE-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'NIE-MELAKH'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G2'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G1-NIE-2026-001'),
  '2026', '2026-06-08', 3900.00, 'kg', 93.5, 98.3,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'NIE', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G3-NIE-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'NIE-MELAKH'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G3'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G2-NIE-2026-001'),
  '2026', '2026-08-05', 20000.00, 'kg', 91.0, 97.2,
  'TRANSFERE', 'SANS_CERTIFICAT', 'NIE', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-R1-NIE-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'NIE-MELAKH'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'R1'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G3-NIE-2026-001'),
  '2026', '2026-10-15', 85000.00, 'kg', 89.0, 96.0,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'NIE', 'multi_fatick',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-SINSALOU')
) ON CONFLICT (code_lot) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- 8. CHAÎNE SORGHO — SOR-CE145 (CE145, sorgho grains Ferlo)
--    Acteurs : selecteur_sor → upsemcl_bambey → multi_zsp_louga
-- ════════════════════════════════════════════════════════════

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G0-SOR-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'SOR-CE145'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G0'),
  NULL, '2026', '2026-01-30', 50.00, 'kg', 96.5, 99.1,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'SOR', 'selecteur_sor',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'ISRA-CNRA')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G1-SOR-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'SOR-CE145'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G1'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G0-SOR-2026-001'),
  '2026', '2026-04-02', 460.00, 'kg', 95.0, 98.7,
  'TRANSFERE', 'SANS_CERTIFICAT', 'SOR', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G2-SOR-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'SOR-CE145'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G2'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G1-SOR-2026-001'),
  '2026', '2026-06-05', 4100.00, 'kg', 93.0, 98.0,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'SOR', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-G3-SOR-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'SOR-CE145'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'G3'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G2-SOR-2026-001'),
  '2026', '2026-08-12', 18000.00, 'kg', 91.5, 97.5,
  'TRANSFERE', 'SANS_CERTIFICAT', 'SOR', 'upsemcl_bambey',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'UPSEMCL-BAMBEY')
) ON CONFLICT (code_lot) DO NOTHING;

INSERT INTO lot.lot_semencier (
  code_lot, id_variete, id_generation, id_lot_parent, campagne,
  date_production, quantite_nette, unite, taux_germination, purete_physique,
  statut_lot, statut_certification, code_espece, username_createur, id_org_producteur
) VALUES (
  'SIM-R1-SOR-2026-001',
  (SELECT id FROM catalog.variete WHERE code_variete = 'SOR-CE145'),
  (SELECT id FROM lot.generation_semence WHERE code_generation = 'R1'),
  (SELECT id FROM lot.lot_semencier WHERE code_lot = 'SIM-G3-SOR-2026-001'),
  '2026', '2026-10-20', 80000.00, 'kg', 89.0, 96.2,
  'DISPONIBLE', 'SANS_CERTIFICAT', 'SOR', 'multi_zsp_louga',
  (SELECT id FROM shared.organisation WHERE code_organisation = 'MULTI-ZSP-01')
) ON CONFLICT (code_lot) DO NOTHING;
